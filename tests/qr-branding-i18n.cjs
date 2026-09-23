const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const i18n = require("../server/i18n");

module.exports = async ({ request, session, link, input, origin }) => {
  const base = "/api/links/" + link.id + "/qr";
  const root = path.resolve(__dirname, "..");
  const template = readFileSync(path.join(root, "server/views/qr.hbs"), "utf8");
  const sources = [template, ...["server/qr-logo.js", "server/server.js", "server/handlers/qr.handler.js"].map(file => readFileSync(path.join(root, file), "utf8"))].join("\n");
  const brandingKeys = Object.keys(i18n.catalogs.en).filter(key => key.startsWith("qr."));
  assert.equal(brandingKeys.length, 11);
  for (const key of brandingKeys) assert(sources.includes('"' + key + '"') || sources.includes("'" + key + "'"), "Unused branding key: " + key);
  const literalHTML = template.replace(/{{[\s\S]*?}}/g, "");
  assert(!/>[^<]*[A-Za-z][^<]*</.test(literalHTML), "QR template prose must use catalogs, not English literals");
  let plainPNG, plainSVG, brandedPNG, brandedSVG;
  for (const locale of ["en", "fr", "es"]) {
    const catalog = i18n.catalogs[locale], headers = { "Accept-Language": locale };
    const error = async (response, key, status = 400) => {
      assert.equal(response.status, status); assert.equal(response.headers.get("content-language"), locale);
      assert.match(response.headers.get("cache-control"), /private, no-store/);
      assert.deepEqual(await response.json(), { error: catalog[key] });
    };
    for (const api of [base, base.replace("/api/", "/api/v2/")]) {
      await error(await request("POST", api, { logo: "invalid" }, session, headers), "qr.invalid_logo");
      await error(await request("POST", api, { unknown: true }, session, headers), "qr.unknown_setting");
      await error(await request("POST", api, [], session, headers), "qr.json_required");
      await error(await request("POST", api, {}, session, { ...headers, "Content-Type": "text/plain" }), "qr.json_required");
      await error(await request("POST", api, { logo: "x".repeat(110000) }, session, headers), "qr.invalid_json", 413);
      await error(await fetch(origin + api, { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: '{"logo":' }), "qr.invalid_json");
      await error(await request("POST", api, input, undefined, headers), "messages.unauthorized", 401);
      await error(await request("POST", api, input, session, { ...headers, Origin: "null" }), "messages.invalid_request_origin", 403);
    }
    const page = await request("GET", "/link/qr/" + link.id, undefined, session, { ...headers, Accept: "text/html" });
    assert.equal(page.status, 200); const html = await page.text();
    const escape = require("hbs").handlebars.escapeExpression;
    for (const key of ["qr.logo_label", "qr.selected_logo", "qr.remove_logo", "qr.invalid_logo", "qr.changes_pending", "qr.generating", "qr.ready", "ui.password_protected_2"]) {
      assert(html.includes(escape(catalog[key])), locale + ": " + key);
    }
    assert(html.includes('name="level"') && html.includes('value="M" selected') && html.includes('value="H"'));
    assert(html.includes("kutt-qr-" + link.id + ".png"));
    assert(html.includes('<p class="qr-state">' + escape(catalog["messages.active"])), "Localized lifecycle label");
    for (const format of ["png", "svg"]) {
      const get = await request("GET", base + "?size=300&level=H&format=" + format, undefined, session, headers);
      assert.equal(get.status, 200); const bytes = Buffer.from(await get.arrayBuffer());
      const post = await request("POST", base, { ...input, format }, session, headers);
      assert.equal(post.status, 200); const branded = Buffer.from(await post.arrayBuffer());
      if (format === "png") { if (plainPNG) assert.deepEqual(bytes, plainPNG); plainPNG = bytes; if (brandedPNG) assert.deepEqual(branded, brandedPNG); brandedPNG = branded; }
      else { if (plainSVG) assert.deepEqual(bytes, plainSVG); plainSVG = bytes; if (brandedSVG) assert.deepEqual(branded, brandedSVG); brandedSVG = branded; }
    }
  }
  await Promise.all(["fr", "es", "en", "es", "fr", "en"].map(async locale => {
    const response = await request("POST", base, { logo: "invalid" }, undefined, {
      "Accept-Language": "en", Cookie: "token=" + session + "; kutt_locale=" + locale
    });
    assert.equal(response.status, 400); assert.equal(response.headers.get("content-language"), locale);
    assert.equal((await response.json()).error, i18n.catalogs[locale]["qr.invalid_logo"]);
  }));
  console.log("PASS: QR EN/FR/ES template/source catalogs, parser/auth/validation errors, cookie precedence, concurrent isolation and byte-identical localized GET/branded exports");
};
