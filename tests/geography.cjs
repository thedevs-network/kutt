const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const { randomUUID } = require("node:crypto");
const path = require("node:path");
const Database = require("better-sqlite3");
const { summarize } = require("../static/scripts/geography");
const map = require("../server/utils/map.json");

module.exports = async ({ request, session, database, account, root }) => {
  const codes = new Set(map.layers.map(row => row.id.toUpperCase()));
  assert.equal(codes.size, 177); assert.equal(codes.size, map.layers.length);
  assert(map.layers.every(row => /^[a-z]{2}$/.test(row.id) && row.d.length > 20));
  const rows = [{ name: "fr", visits: 10 }, { name: "ES", visits: 4 }, { name: "US", visits: 3 }, { name: "UNKNOWN", visits: 2 }, { name: "SG", visits: 1 }];
  const model = summarize(rows, 20, codes);
  assert.equal(model.counts.get("FR"), 10); assert.equal(model.share(10), .5);
  assert.equal(model.unmapped, 3); assert.deepEqual(model.limits, [4, 7, 10]);
  assert.equal(model.level(0), 0); assert.equal(model.level(10), 3);
  assert.equal(summarize(rows, 19, codes).share(10), null, "Do not normalize inconsistent legacy totals");
  assert.equal(summarize([], 0, codes).share(0), null);
  assert.equal(summarize([{ name: "FR", visits: 1 }], 10, codes).share(1), .1, "Denominator includes missing and unknown country counts");
  assert.equal(summarize([{ name: "__proto__", visits: 2 }, { name: '<img src=x onerror="alert(1)">', visits: 3 }], 5, codes).unmapped, 5);
  assert.equal(summarize([{ name: "fr", visits: 1 }, { name: "FR", visits: 2 }], 3, codes).counts.get("FR"), 3);
  for (const visits of [-1, 1.5, "1", Infinity]) assert.throws(() => summarize([{ name: "FR", visits }], 1, codes), TypeError);
  assert.throws(() => summarize([{ name: "FR", visits: Number.MAX_SAFE_INTEGER }, { name: "US", visits: 1 }], 1, codes), TypeError);
  const source = readFileSync(path.join(root, "static/scripts/geography.js"), "utf8");
  assert(!/innerHTML|outerHTML|insertAdjacentHTML|fetch\(|XMLHttpRequest|localStorage|eval\(/.test(source));
  const db = new Database(database);
  try {
    const owner = db.prepare("SELECT id FROM users WHERE email=?").get(account.email).id;
    const created = await request("POST", "/api/links", { customurl: "geography-" + randomUUID(), target: "https://192.0.2.1/geography" }, session);
    assert.equal(created.status, 201); const link = await created.json();
    const id = db.prepare("SELECT id FROM links WHERE uuid=?").get(link.id).id;
    db.prepare("INSERT INTO visits(link_id,user_id,created_at,total,countries,referrers) VALUES(?,?,?,?,?,?)")
      .run(id, owner, "2024-01-01 12:00:00", 20, JSON.stringify(Object.fromEntries(rows.map(row => [row.name, row.visits]))), "{}");
    const query = new URLSearchParams({ start: "2024-01-01", end: "2024-01-01", link: link.id });
    const snapshot = () => JSON.stringify({ link: db.prepare("SELECT visit_count FROM links WHERE id=?").get(id), visits: db.prepare("SELECT * FROM visits WHERE link_id=?").all(id) });
    const before = snapshot();
    for (const locale of ["en", "fr", "es"]) {
      const page = await request("GET", "/settings/analytics?" + query, undefined, session, { Accept: "text/html", "Accept-Language": locale });
      const html = await page.text(); // Drain large SVG responses even on assertion failure.
      assert.equal(page.status, 200); assert.match(page.headers.get("cache-control"), /no-store/);
      const catalog = require("../locales/" + locale + ".json");
      assert(html.includes(catalog["geography.title"])); assert(html.includes('id="analytics-country-table"'));
      assert.equal((html.match(/data-country="[a-z]{2}"/g) || []).length, 177);
      assert(html.includes('viewBox="' + map.viewBox + '"'));
      assert(html.includes('src="/scripts/geography.js"')); assert(!/on(?:click|keydown|mousemove)=/.test(html));
      const response = await request("GET", "/api/analytics?" + query, undefined, session, { "Accept-Language": locale });
      const data = await response.json(); assert.equal(response.status, 200);
      assert.equal(data.total, 20); assert.deepEqual(data.stats.country, rows.map(row => ({ ...row, name: row.name.toUpperCase() })));
    }
    for (const url of ["/scripts/geography.js", "/css/geography.css"]) {
      const response = await request("GET", url); await response.text(); assert.equal(response.status, 200);
    }
    const denied = await request("GET", "/settings/analytics?" + query, undefined, undefined, { Accept: "text/html" });
    const deniedBody = await denied.text(); assert(!deniedBody.includes('id="analytics-geography"')); assert.notEqual(denied.status, 200);
    assert.equal(snapshot(), before, "Viewing reports and assets creates no visits or counter updates");
  } finally { db.close(); }
  console.log("PASS: bundled geometry, country/share arithmetic, unknown and unmapped counts, legacy totals, safe DOM, EN/FR/ES private pages, unchanged API and zero visit writes");
};
