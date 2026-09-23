const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

module.exports = async ({ root }) => {
  const source = readFileSync(path.join(root, "static/scripts/copy.js"), "utf8");
  for (const file of ["shortener", "links/tr", "admin/links/tr", "settings/apikey"]) {
    assert.match(readFileSync(path.join(root, "server/views/partials", file + ".hbs"), "utf8"), /data-copy-container/);
  }
  assert.match(readFileSync(path.join(root, "server/views/layout.hbs"), "utf8"), /scripts\/copy\.js/);
  const document = { body: {}, activeElement: null };
  const element = () => ({
    children: [], attributes: {}, className: "", textContent: "",
    append(...children) { this.children.push(...children); },
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() { document.activeElement = this; },
    select() { this.selected = true; }
  });
  document.createElement = element;
  const copied = new Set();
  const clipboard = { classList: { add: value => copied.add(value), remove: value => copied.delete(value) } };
  const host = Object.assign(element(), { isConnected: true, querySelector: () => clipboard });
  const button = { closest: () => host, dataset: { url: "synthetic-value-not-in-status" } };
  const navigator = {};
  const context = vm.createContext({ document, navigator, window: { KuttI18n: require("../server/i18n").current() } });
  vm.runInContext(source, context);
  const copy = context.handleShortURLCopyLink;
  const status = () => host.children[0].children[0];
  const fallback = () => host.children[0].children[1];
  const input = () => fallback().children[0];
  let finish, calls = 0;
  navigator.clipboard = { writeText: value => { assert.equal(value, button.dataset.url); calls++; return new Promise(resolve => { finish = resolve; }); } };
  document.activeElement = button;
  const pending = copy(button);
  assert.equal(status().textContent, "Copying...");
  assert.equal(host.attributes["aria-busy"], "true");
  assert.equal(copied.size, 0);
  await copy(button); assert.equal(calls, 1);
  finish(); await pending;
  assert.equal(status().textContent, "Copied.");
  assert(copied.has("copied")); assert.equal(document.activeElement, button);
  assert.equal(host.attributes["aria-busy"], undefined);
  navigator.clipboard.writeText = async () => { throw new Error(button.dataset.url); };
  await copy(button);
  assert.equal(copied.size, 0); assert.equal(fallback().hidden, false);
  assert.equal(input().value, button.dataset.url); assert(input().readOnly && input().selected);
  assert.equal(document.activeElement, input());
  assert.equal(status().attributes.role, "status");
  assert(!status().textContent.includes(button.dataset.url));
  assert.match(status().textContent, /Copy failed/);
  const otherControl = {}; document.activeElement = otherControl;
  delete navigator.clipboard;
  await copy(button); assert.equal(document.activeElement, otherControl);
  navigator.clipboard = { writeText: () => { throw new Error("Synchronous failure"); } };
  await copy(button); assert.equal(document.activeElement, otherControl);
  navigator.clipboard.writeText = async () => {};
  await copy(button); assert.equal(fallback().hidden, true); assert.equal(input().value, "");
  assert.equal(host.children.length, 1, "Reuse one status region");
  navigator.clipboard.writeText = () => new Promise((resolve, reject) => { finish = reject; });
  document.activeElement = button;
  const removed = copy(button); host.isConnected = false;
  finish(new Error("Removed row")); await removed;
  assert.equal(document.activeElement, button); assert.equal(fallback().hidden, true);
  assert.equal(host.attributes["aria-busy"], undefined);
  assert.equal(copied.size, 0);
  console.log("PASS: clipboard confirmed success only, rejected/missing/synchronous failures, selectable fallback, no secret announcements, duplicate suppression, no focus theft, retry and detached-target safety");
  await require("./token-secret.cjs")({ root });
};
