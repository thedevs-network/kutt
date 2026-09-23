const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const Database = require("better-sqlite3");
const QRCode = require("qrcode");
const { PNG } = require("pngjs");

module.exports = async ({ request, session, database, account, restart, env }) => {
  const { renderPNG } = require("../server/qr-image");
  const fixture = QRCode.create("https://example.invalid/" + "x".repeat(21), { errorCorrectionLevel: "H" });
  assert.equal(fixture.modules.size, 41, "Deterministic upstream rounding case");
  for (const size of [128, 255, 256, 300, 512, 1024]) {
    const image = PNG.sync.read(renderPNG(fixture.modules, size));
    assert.equal(image.width, size); assert.equal(image.height, size);
    assert.deepEqual(Array.from(image.data.subarray(-4)), [255, 255, 255, 255]);
  }
  for (const size of [0, 127, 128.5, 1025, Infinity]) assert.throws(() => renderPNG(fixture.modules, size));
  const db = new Database(database);
  try {
    const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
    const other = db.prepare("SELECT id FROM users WHERE email='other@example.com'").get().id;
    const address = "qr-" + randomUUID();
    let response = await request("POST", "/api/links", { target: "https://192.0.2.1/private-target", customurl: address, password: "private-pass" }, session);
    assert.equal(response.status, 201); const link = await response.json();
    const api = "/api/v2/links/" + link.id + "/qr";
    const expected = "https://" + env.DEFAULT_DOMAIN + "/" + address;
    const before = db.prepare("SELECT visit_count,redirect_count FROM links WHERE uuid=?").get(link.id);
    assert.equal((await request("GET", api)).status, 401);
    assert.equal((await request("GET", "/link/qr/" + link.id)).status, 401);
    assert.equal((await request("GET", "/link/qr/" + link.id, undefined, undefined, { Accept: "text/html" })).status, 302);
    const png = async (path, size, level = "M", headers) => {
      const r = await request("GET", path, undefined, session, headers);
      assert.equal(r.status, 200, await r.clone().text());
      assert.match(r.headers.get("content-type"), /^image\/png/);
      assert.match(r.headers.get("content-disposition"), new RegExp(`attachment; filename="kutt-qr-${link.id}\\.png"`));
      assert.match(r.headers.get("cache-control"), /private, no-store/);
      assert.equal(r.headers.get("x-content-type-options"), "nosniff");
      const image = PNG.sync.read(Buffer.from(await r.arrayBuffer()));
      assert.equal(image.width, size); assert.equal(image.height, size);
      const { modules } = QRCode.create(expected, { errorCorrectionLevel: level });
      const scale = size / (modules.size + 8);
      for (let y = -4; y < modules.size + 4; y++) for (let x = -4; x < modules.size + 4; x++) {
        const dark = x >= 0 && y >= 0 && x < modules.size && y < modules.size && modules.get(y, x);
        const at = (Math.floor((y + 4.5) * scale) * size + Math.floor((x + 4.5) * scale)) * 4;
        assert.deepEqual(Array.from(image.data.subarray(at, at + 4)), dark ? [0, 0, 0, 255] : [255, 255, 255, 255], "Encoded modules and four-module quiet zone");
      }
    };
    for (const [size, level] of [[128, "L"], [256, "M"], [512, "Q"], [1024, "H"]]) await png(api + `?size=${size}&level=${level}`, size, level);
    response = await request("GET", api + "?format=svg", undefined, session);
    assert.equal(response.status, 200); assert.match(response.headers.get("content-type"), /^image\/svg\+xml/);
    assert.match(response.headers.get("content-disposition"), /\.svg"$/);
    assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; sandbox");
    const svg = await response.text(); assert.match(svg, /^<svg/); assert.match(svg, /viewBox=/);
    assert(!/script|foreignObject|href=|private-pass|private-target|<text/i.test(svg));
    for (const q of ["size=0", "size=127", "size=1025", "size=9999999999", "size=256.5", "size[]=512", "size=512&size=128", "level=X", "level[]=H", "format=html", "format[]=svg"]) {
      assert.equal((await request("GET", api + "?" + q, undefined, session)).status, 400, q);
    }
    response = await request("POST", "/api/tokens", { name: "QR read", scopes: ["links:read"], domain_scope: "default" }, session);
    assert.equal(response.status, 201); const read = await response.json();
    await png(api, 512, "M", { "X-API-Key": read.token });
    assert.equal((await request("GET", "/link/qr/" + link.id, undefined, session, { "X-API-Key": read.token })).status, 403);
    response = await request("POST", "/api/tokens", { name: "QR create only", scopes: ["links:create"] }, session);
    assert.equal(response.status, 201); const create = await response.json();
    assert.equal((await request("GET", api, undefined, session, { "X-API-Key": create.token })).status, 403, "No cookie elevation");
    for (const column of ["user_id", "banned", "deleted_at", "archived_domain"]) {
      const value = column === "user_id" ? other : column === "banned" ? 1 : column === "deleted_at" ? Date.now() : "retired-qr.invalid";
      db.prepare(`UPDATE links SET ${column}=? WHERE uuid=?`).run(value, link.id);
      const expectedStatus = ["user_id", "banned"].includes(column) ? 404 : 410;
      assert.equal((await request("GET", api, undefined, session)).status, expectedStatus, column);
      assert.equal((await request("GET", "/link/qr/" + link.id, undefined, session, { Accept: "application/json" })).status, expectedStatus);
      db.prepare(`UPDATE links SET ${column}=? WHERE uuid=?`).run(column === "user_id" ? owner : column === "banned" ? 0 : null, link.id);
    }
    db.prepare("UPDATE links SET paused=1,max_visits=1,redirect_count=1 WHERE uuid=?").run(link.id);
    response = await request("GET", "/link/qr/" + link.id, undefined, session, { Accept: "text/html" });
    assert.equal(response.status, 200); const html = await response.text();
    assert(html.includes("Password protected")); assert(!html.includes("private-target") && !html.includes("private-pass"));
    await png(api, 512);
    assert.equal((await request("GET", "/" + address)).status, 410, "QR export does not bypass lifecycle");
    assert.equal(db.prepare("SELECT visit_count FROM links WHERE uuid=?").get(link.id).visit_count, before.visit_count);
    assert.equal(db.prepare("SELECT redirect_count FROM links WHERE uuid=?").get(link.id).redirect_count, 1);
    const domain = Number(db.prepare("INSERT INTO domains(uuid,address,user_id,banned) VALUES(?,?,?,0)").run(randomUUID(), "qr-owned.invalid", owner).lastInsertRowid);
    db.prepare("UPDATE links SET domain_id=? WHERE uuid=?").run(domain, link.id);
    assert.equal((await request("GET", api, undefined, session, { "X-API-Key": read.token })).status, 404);
    response = await request("GET", "/link/qr/" + link.id, undefined, session, { Accept: "text/html" });
    assert.equal(response.status, 200); assert((await response.text()).includes("qr-owned.invalid/" + address));
    db.prepare("UPDATE domains SET banned=1 WHERE id=?").run(domain);
    assert.equal((await request("GET", api, undefined, session)).status, 410);
    db.prepare("UPDATE domains SET banned=0,user_id=? WHERE id=?").run(other, domain);
    assert.equal((await request("GET", api, undefined, session)).status, 410);
    db.prepare("UPDATE links SET domain_id=NULL WHERE uuid=?").run(link.id);
    await restart(); await png(api, 512);
    assert.equal((await request("DELETE", "/api/tokens/" + read.id, undefined, session)).status, 204);
    assert.equal((await request("GET", api, undefined, session, { "X-API-Key": read.token })).status, 401);
    assert.equal(db.pragma("quick_check", { simple: true }), "ok");
    assert.deepEqual(db.pragma("foreign_key_check"), []);
    console.log("PASS: QR PNG/SVG, pixel matrix/quiet-zone, dimensions, owner/domain/scopes, no cookie elevation, lifecycle/password privacy, zero visits, restart and revocation");
  } finally { db.close(); }
};
