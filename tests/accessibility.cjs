const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

module.exports = async ({ request, session, database }) => {
  const html = async url => {
    const response = await request("GET", url, undefined, session, { Accept: "text/html" });
    assert.equal(response.status, 200); return response.text();
  };
  const home = await html("/");
  assert(home.includes('aria-label="Destination URL"'));
  assert(home.includes('aria-label="Shorten link"'));
  assert(home.includes('/scripts/focus.js'));
  for (const kind of ["links", "users", "domains"]) {
    const page = await html("/api/" + kind + "/admin");
    assert.match(page, new RegExp('id="tab-' + kind + '"[\\s\\S]*?aria-selected="true" tabindex="0"'));
    assert.equal((page.match(/role="tab"/g) || []).length, 3);
    assert(!page.includes("setTab("));
    assert(page.includes('aria-label="Next page"'));
    for (const select of page.match(/<select\b[^>]*>/g) || []) assert(select.includes("aria-label="), select);
    const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
    assert.equal(new Set(ids).size, ids.length, "No repeated filter IDs");
  }
  const Database = require("better-sqlite3"), { randomUUID } = require("node:crypto");
  assert(database);
  const db = new Database(database, { fileMustExist: true }), prefix = "a11y-pages-" + randomUUID();
  try {
    for (let count = 0; count <= 11; count++) {
      if (count) db.prepare("INSERT INTO links(uuid,address,target) VALUES(?,?,?)")
        .run(randomUUID(), prefix + "-" + count, "https://example.invalid/pagination");
      if (![0, 1, 10, 11].includes(count)) continue;
      const page = await html("/api/links/admin?search=" + prefix + "&limit=10&skip=0");
      const buttons = page.match(/<button[^>]*aria-label="Next page"[^>]*>/g);
      assert.equal(buttons.length, 2);
      for (const button of buttons) assert.equal(button.includes("disabled"), count <= 10);
    }
    const last = await html("/api/links/admin?search=" + prefix + "&limit=10&skip=10");
    for (const button of last.match(/<button[^>]*aria-label="Next page"[^>]*>/g)) assert(button.includes("disabled"));
  } finally { db.prepare("DELETE FROM links WHERE address LIKE ?").run(prefix + "%"); db.close(); }

  const listeners = new Map(), elements = new Map();
  const document = {
    body: {}, documentElement: {}, activeElement: null,
    addEventListener(name, listener) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(listener); },
    removeEventListener(name, listener) { listeners.get(name)?.delete(listener); },
    getElementById(id) { return elements.get(id); }, querySelector() { return null; }
  };
  const emit = (name, event) => { for (const listener of [...(listeners.get(name) || [])]) listener(event); };
  const element = id => {
    const node = { id, isConnected: true, disabled: false, getClientRects: () => [1],
      focus() { document.activeElement = node; emit("focusin", { target: node }); } };
    elements.set(id, node); return node;
  };
  document.activeElement = document.body;
  const window = {};
  vm.runInNewContext(fs.readFileSync("static/scripts/focus.js", "utf8"), {
    window, document, location: { pathname: "/" }, sessionStorage: { getItem: () => null, removeItem() {} }, setTimeout, clearTimeout
  });
  const old = element("save"), other = element("draft"); old.focus();
  let ticket = window.KuttFocus.capture(); old.disabled = true; document.activeElement = document.body;
  old.disabled = false; window.KuttFocus.restore(ticket); assert.equal(document.activeElement, old);
  ticket = window.KuttFocus.capture(); old.isConnected = false; document.activeElement = document.body;
  const replacement = element("save"); window.KuttFocus.restore(ticket); assert.equal(document.activeElement, replacement);
  ticket = window.KuttFocus.capture(); other.focus(); window.KuttFocus.restore(ticket); assert.equal(document.activeElement, other);
  replacement.focus(); ticket = window.KuttFocus.capture(); replacement.isConnected = false; document.activeElement = document.body;
  elements.delete("save"); window.KuttFocus.restore(ticket, other); assert.equal(document.activeElement, other);
  assert.equal(listeners.get("focusin").size, 0);
  const xhr = {}; emit("htmx:beforeRequest", { detail: { xhr, elt: { getAttribute: () => null } } });
  assert.equal(listeners.get("focusin").size, 1);
  emit("htmx:afterRequest", { detail: { xhr, successful: true } });
  await new Promise(resolve => setTimeout(resolve, 550));
  assert.equal(listeners.get("focusin").size, 0, "No-swap responses release focus listeners");
  console.log("PASS: named personal/admin controls, selected native tabs, unique IDs, and focus recovery/removal/concurrent draft/no-swap cleanup");
};
