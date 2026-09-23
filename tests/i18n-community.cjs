const assert = require("node:assert/strict");
const { randomUUID } = require("node:crypto");
const catalogs = require("../server/i18n").catalogs;

module.exports = async ({ request, session, url }) => {
  for (const locale of ["en", "fr", "es"]) {
    const catalog = catalogs[locale], prefix = "i18n-" + randomUUID().slice(0, 8);
    const headers = { "Accept-Language": locale }, links = [];
    const call = (method, route, body, extra = {}) => request(method, route, body, session, { ...headers, ...extra });
    const error = async (response, key, status = 400) => {
      assert.equal(response.status, status);
      assert.equal((await response.json()).error, catalog[key]);
    };
    try {
      for (const api of ["/api", "/api/v2"]) {
        await error(await call("GET", api + "/links?sort[]=address"), "sorting.invalid");
        await error(await call("GET", api + "/moderation?entity=__proto__"), "moderation.invalid_filter");
        await error(await call("POST", api + "/moderation/link/invalid/unban", {}, { Origin: url }), "moderation.invalid_target");
        await error(await call("POST", api + "/moderation/link/" + randomUUID() + "/unban", {}, { Origin: url }), "moderation.not_found", 404);
      }
      for (const [id, key, status] of [["invalid", "moderation.invalid_target", 400], [randomUUID(), "moderation.not_found", 404]]) {
        const response = await call("GET", "/admin/moderation/link/" + id, undefined, { Accept: "text/html" });
        assert.equal(response.status, status);
        assert((await response.text()).includes(require("hbs").handlebars.escapeExpression(catalog[key])));
      }
      for (const suffix of ["/bad..pdf", "/.hidden", "/bad%2epdf", "/bad\npdf"]) {
        await error(await call("POST", "/api/links", { customurl: prefix + suffix, target: "https://192.0.2.1/i18n" }), "messages.custom_url_is_not_valid");
      }
      for (const suffix of ["/b.v1.pdf", "/a.v1.pdf"]) {
        const created = await call("POST", "/api/links", { customurl: prefix + suffix, target: "https://192.0.2.1/i18n" });
        assert.equal(created.status, 201); links.push(await created.json());
      }
      const sorted = await call("GET", "/api/links?search=" + prefix + "&sort=address&direction=asc");
      assert.deepEqual((await sorted.json()).data.map(row => row.address), links.map(row => row.address).sort());
      const link = links[0], unban = "/api/moderation/link/" + link.id + "/unban";
      await error(await call("POST", "/api/links/admin/ban/" + link.id, { unknown: true }), "moderation.invalid_option");
      assert.equal((await call("POST", "/api/links/admin/ban/" + link.id, {})).status, 200);
      await error(await call("POST", unban, { links: true }), "moderation.extra_fields");
      for (const origin of ["null", "https://foreign.invalid"]) {
        await error(await call("POST", unban, {}, { Origin: origin }), "messages.invalid_request_origin", 403);
      }
      const snapshot = async language => (await (await call("GET", "/api/moderation?entity=link", undefined, { "Accept-Language": language })).json());
      const localized = await snapshot(locale), english = await snapshot("en");
      assert.deepEqual(localized, english, "Audit actions, entity names, identifiers and timestamps stay machine-readable");
      assert(localized.events.some(event => event.entity_id === link.id && event.entity === "link" && event.action === "ban"));
      const page = await call("GET", "/admin/moderation/link/" + link.id, undefined, { Accept: "text/html" });
      assert.equal(page.status, 200); assert.equal(page.headers.get("referrer-policy"), "same-origin");
      const html = await page.text();
      assert(html.includes(require("hbs").handlebars.escapeExpression(catalog["moderation.confirm_notice"])));
      assert(html.includes('action="/admin/moderation/link/' + link.id + '"'));
      const restored = await call("POST", unban, {}, { Origin: url });
      assert.equal(restored.status, 200); assert.equal((await restored.json()).message, catalog["moderation.removed"]);
      const redirect = await call("GET", "/" + link.address);
      assert.equal(redirect.status, 302); assert.equal(redirect.headers.get("location"), link.target);
      const input = { format: "json", conflict: "abort", content: JSON.stringify({ schema_version: 1, links: [{ address: prefix + "/invalid..pdf", target: link.target }] }) };
      const preview = await call("POST", "/api/transfer/preview", input);
      assert.equal(preview.status, 200); const result = await preview.json();
      assert.equal(result.valid, false); assert.equal(result.preview_token, null);
      assert(JSON.stringify(result).includes(catalog["messages.invalid_or_reserved_alias"]));
    } finally {
      for (const link of links) {
        await call("POST", "/api/moderation/link/" + link.id + "/unban", {});
        await call("DELETE", "/api/links/" + link.id);
      }
    }
  }
  console.log("PASS: English/French/Spanish moderation JSON and HTML errors, strict origins, unchanged audit values, sorting errors/order, dotted alias validation/redirects and import errors");
};
