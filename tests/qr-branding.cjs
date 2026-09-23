const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const Database = require("better-sqlite3");
const { PNG } = require("pngjs");
const { logo, metadata, uri } = require("./qr-logo-fixture.cjs");

module.exports = async ({ request, session, database, account, restart, root, directory, env }) => {
  const unit = spawnSync(process.execPath, [path.join(root, "tests/qr-logo-unit.cjs")], { cwd: directory, env, encoding: "utf8", timeout: 60000 });
  assert.equal(unit.status, 0, unit.stdout + unit.stderr); process.stdout.write(unit.stdout);
  const db = new Database(database), owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
  const other = db.prepare("SELECT id FROM users WHERE email='other@example.com'").get().id;
  const target = "https://192.0.2.1/private-qr-target", password = "private-qr-password";
  try {
    const created = await request("POST", "/api/links", { target, password, customurl: "brand-" + randomUUID() }, session);
    assert.equal(created.status, 201); const link = await created.json();
    const logoBytes = metadata(logo());
    const input = { logo: logoBytes.toString("base64"), size: 300, level: "L" };
    const base = "/api/links/" + link.id + "/qr", call = (body = input, headers = {}, token = session, api = base) => request("POST", api, body, token, headers);
    const initial = db.prepare("SELECT visit_count,redirect_count FROM links WHERE uuid=?").get(link.id);
    await require("./qr-branding-i18n.cjs")({ request, session, link, input, origin: "http://" + env.DEFAULT_DOMAIN });
    for (const api of [base, base.replace("/api/", "/api/v2/")]) {
      const plain = await request("GET", api + "?size=300&level=H", undefined, session);
      const branded = await call(input, {}, session, api);
      assert.equal(branded.status, 200); assert.match(branded.headers.get("cache-control"), /private, no-store/);
      assert.equal(branded.headers.get("x-content-type-options"), "nosniff");
      assert.match(branded.headers.get("content-disposition"), /\.png"$/);
      const pngBytes = Buffer.from(await branded.arrayBuffer());
      const image = PNG.sync.read(pngBytes); assert.equal(image.width, 300);
      const legacyPNG = await call({ ...input, logo: uri(logoBytes) }, {}, session, api);
      assert.equal(legacyPNG.status, 200);
      assert.deepEqual(Buffer.from(await legacyPNG.arrayBuffer()), pngBytes, "Both logo formats produce identical PNG bytes");
      assert(!image.data.equals(PNG.sync.read(Buffer.from(await plain.arrayBuffer())).data));
      const svg = await call({ ...input, format: "svg" }, {}, session, api);
      assert.equal(svg.status, 200); assert.equal(svg.headers.get("content-security-policy"), "default-src 'none'; img-src data:; sandbox");
      const text = await svg.text(); assert.match(text, /href="data:image\/png;base64,/);
      const legacySVG = await call({ ...input, logo: uri(logoBytes), format: "svg" }, {}, session, api);
      assert.equal(legacySVG.status, 200); assert.equal(await legacySVG.text(), text, "Both logo formats produce identical SVG bytes");
      for (const secret of [target, password, session, "private-fixture-metadata"]) assert(!text.includes(secret));
      const post = await call({ size: "300", level: "H" }, {}, session, api);
      assert.equal(post.status, 200);
      const get = await request("GET", api + "?size=300&level=H", undefined, session);
      assert.deepEqual(Buffer.from(await post.arrayBuffer()), Buffer.from(await get.arrayBuffer()), "Optional logo omission preserves plain output");
    }
    for (const headers of [{ Origin: "null" }, { Origin: "https://foreign.invalid" }, { "Sec-Fetch-Site": "cross-site" }]) assert.equal((await call(input, headers)).status, 403);
    assert.equal((await call(input, { Origin: "http://" + env.DEFAULT_DOMAIN })).status, 200);
    assert.equal((await request("POST", base, input)).status, 401);
    assert.equal((await request("POST", base, input, undefined, { Accept: "text/html" })).status, 401);
    const htmlError = await call({ logo: "invalid" }, { Accept: "text/html" });
    assert.equal(htmlError.status, 400); assert.match(htmlError.headers.get("content-type"), /application\/json/);
    for (const body of [{ logo: null }, { logo: "https://example.invalid/logo.png" }, { logo: "data:image/svg+xml;base64,PHN2Zy8+" },
      { logo: "data:image/jpeg;base64," + input.logo }, { logo: "data:image/png;name=logo.png;base64," + input.logo },
      { logo: "DATA:image/png;base64," + input.logo },
      { logo: uri(Buffer.alloc(65537)) }, { ...input, size: 1025 }, { ...input, level: ["H"] }, { ...input, level: "X" }, { ...input, format: "html" }, { ...input, target }, { ...input, password }]) {
      assert.equal((await call(body)).status, 400);
    }
    const corrupt = Buffer.from(logoBytes); corrupt[29] ^= 1;
    for (const encoded of ["", " " + input.logo, input.logo + "\n", input.logo + "=", corrupt.toString("base64"),
      Buffer.alloc(65537).toString("base64"), Buffer.from("<svg/>").toString("base64")]) {
      for (const api of [base, base.replace("/api/", "/api/v2/")]) for (const logo of [encoded, "data:image/png;base64," + encoded]) {
        assert.equal((await call({ logo }, {}, session, api)).status, 400);
      }
    }
    assert.equal((await call({ logo: "x".repeat(110000) })).status, 413, "Existing JSON limit remains in force");
    for (const route of [base, base.replace("/api/", "/api/v2/").replace(link.id, "%" + link.id.charCodeAt(0).toString(16) + link.id.slice(1))]) {
      const malformed = await fetch(new URL(route, created.url), { method: "POST", headers: {
        Cookie: "token=" + session, Accept: "text/html", "Content-Type": "application/json"
      }, body: '{"logo":"private-malformed-fixture', redirect: "manual" });
      assert.equal(malformed.status, 400); assert.match(malformed.headers.get("cache-control"), /private, no-store/);
      assert.deepEqual(await malformed.json(), { error: "Invalid or oversized QR JSON request." });
    }
    const token = async scopes => {
      const response = await request("POST", "/api/tokens", { name: "QR branding", scopes, domain_scope: "default" }, session);
      assert.equal(response.status, 201); return response.json();
    };
    const read = await token(["links:read"]), write = await token(["links:create"]);
    assert.equal((await call(input, { "X-API-Key": read.token })).status, 200);
    assert.equal((await call(input, { "X-API-Key": read.token, Origin: "null" })).status, 403);
    assert.equal((await call(input, { "X-API-Key": write.token })).status, 403);
    for (const [column, value, status] of [["user_id", other, 404], ["banned", 1, 404], ["deleted_at", Date.now(), 410], ["archived_domain", "retired.invalid", 410]]) {
      db.prepare(`UPDATE links SET ${column}=? WHERE uuid=?`).run(value, link.id);
      assert.equal((await call()).status, status);
      db.prepare(`UPDATE links SET ${column}=? WHERE uuid=?`).run(column === "user_id" ? owner : column === "banned" ? 0 : null, link.id);
    }
    const domain = Number(db.prepare("INSERT INTO domains(uuid,address,user_id,banned) VALUES(?,?,?,0)").run(randomUUID(), "branded.invalid", owner).lastInsertRowid);
    db.prepare("UPDATE links SET domain_id=? WHERE uuid=?").run(domain, link.id);
    assert.equal((await call(input, { "X-API-Key": read.token })).status, 404);
    assert.equal((await call()).status, 200);
    db.prepare("UPDATE domains SET banned=1 WHERE id=?").run(domain);
    assert.equal((await call()).status, 410);
    db.prepare("UPDATE links SET domain_id=NULL WHERE uuid=?").run(link.id);
    assert.deepEqual(db.prepare("SELECT visit_count,redirect_count FROM links WHERE uuid=?").get(link.id), initial);
    await restart(); assert.equal((await call()).status, 200);
    const plainAfter = await request("GET", base + "?format=svg", undefined, session);
    assert(!(await plainAfter.text()).includes("<image"), "Branding is never persisted");
    await request("DELETE", "/api/tokens/" + read.id, undefined, session);
    assert.equal((await call(input, { "X-API-Key": read.token })).status, 401);
    console.log("PASS: identical plain-base64/legacy-data-URI PNG+SVG output and invalid bounds on both API aliases, forced H, unchanged plain GET/POST, owner/domain/scopes/origin, privacy, zero visits, restart and revocation");
  } finally { db.close(); }
};
