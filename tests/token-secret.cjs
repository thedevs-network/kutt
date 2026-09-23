const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

module.exports = async ({ root }) => {
  const template = readFileSync(path.join(root, "server/views/partials/settings/tokens.hbs"), "utf8");
  const rendered = require("hbs").handlebars.compile(template)({ newToken: "synthetic-only" }, { helpers: { t: (key, options) => require("../server/i18n").t(key, options.hash) }, partials: Object.fromEntries(["eye", "copy", "x", "trash", "zap", "spinner"].map(name => ["icons/" + name, ""])) });
  assert.match(rendered, /type="password" aria-label="New API token"/);
  assert(!template.includes('data-url="{{newToken}}"'));
  assert.match(readFileSync(path.join(root, "server/views/layout.hbs"), "utf8"), /scripts\/token-secret\.js/);
  const events = {}, windowEvents = {}, timers = new Map(); let sequence = 0;
  const document = { hidden: false, addEventListener: (name, handler) => { events[name] = handler; } };
  const element = () => ({
    attributes: {}, dataset: {}, disabled: true, textContent: "",
    setAttribute(name, value) { this.attributes[name] = value; },
    removeAttribute(name) { delete this.attributes[name]; },
    focus() { document.activeElement = this; },
    classList: { add() {}, remove() {} }
  });
  function fixture() {
    const box = { ...element(), isConnected: true }, input = { ...element(), value: "synthetic-token", type: "text" }, status = element();
    input.attributes.value = input.value;
    const buttons = Object.fromEntries(["copy", "hide", "reveal"].map(action => {
      const button = { ...element(), dataset: { tokenAction: action }, closest: selector => selector === "[data-token-secret]" ? box : button };
      return [action, button];
    }));
    box.querySelector = selector => selector === "input" ? input : selector === '[role="status"]' ? status : buttons.reveal;
    box.querySelectorAll = selector => selector === "button" ? Object.values(buttons) : [];
    box.matches = selector => selector === "[data-token-secret]";
    return { box, input, status, buttons };
  }
  let current = fixture();
  document.querySelectorAll = () => [current.box];
  const navigator = {};
  vm.runInNewContext(readFileSync(path.join(root, "static/scripts/token-secret.js"), "utf8"), {
    document, navigator, window: { KuttI18n: require("../server/i18n").current(), addEventListener: (name, handler) => { windowEvents[name] = handler; } },
    setTimeout: handler => { const id = ++sequence; timers.set(id, handler); return id; },
    clearTimeout: id => timers.delete(id)
  });
  const click = action => events.click({ target: current.buttons[action] });
  assert.equal(current.input.type, "password");
  assert(Object.values(current.buttons).every(button => !button.disabled));
  await click("reveal"); assert.equal(current.input.type, "text");
  assert.equal(current.buttons.reveal.attributes["aria-pressed"], "true");
  document.hidden = true; events.visibilitychange(); assert.equal(current.input.type, "password");
  let copied, finish, calls = 0;
  navigator.clipboard = { writeText: value => { calls++; copied = value; return new Promise(resolve => { finish = resolve; }); } };
  let pending = click("copy"); await click("copy");
  assert.equal(calls, 1); assert.equal(current.status.textContent, "Copying...");
  finish(); await pending;
  assert.equal(copied, "synthetic-token"); assert.equal(current.status.textContent, "Token copied.");
  assert.equal(current.input.type, "password");
  navigator.clipboard.writeText = async () => { throw new Error("synthetic-token"); };
  await click("copy"); assert.match(current.status.textContent, /^Copy failed/);
  assert(!current.status.textContent.includes(current.input.value));
  assert.equal(current.input.type, "password", "Failure must not reveal the secret");
  delete navigator.clipboard; await click("copy"); assert.match(current.status.textContent, /^Copy failed/);
  navigator.clipboard = { writeText: () => new Promise(resolve => { finish = resolve; }) };
  pending = click("copy");
  await click("hide"); finish(); await pending;
  assert.equal(current.input.value, ""); assert.equal(current.input.attributes.value, undefined);
  assert.equal(current.input.type, "password"); assert(Object.values(current.buttons).every(button => button.disabled));
  assert.match(current.status.textContent, /^Token hidden/); assert.equal(current.box.attributes["aria-busy"], undefined);
  current = fixture(); events["htmx:afterSwap"]();
  pending = click("copy"); [...timers.values()].forEach(handler => handler()); await pending;
  assert.match(current.status.textContent, /^Copy failed/); assert.equal(current.buttons.copy.disabled, false);
  await click("reveal"); windowEvents.pagehide();
  assert.equal(current.input.value, ""); assert.equal(current.input.attributes.value, undefined);
  current = fixture(); events["htmx:afterSwap"]();
  const detached = current;
  pending = click("copy"); detached.box.isConnected = false; finish(); await pending;
  assert.equal(detached.status.textContent, "Copying...", "Detached request must not announce completion");
  events["htmx:beforeCleanupElement"]({ detail: { elt: current.box } });
  assert.equal(current.input.value, "");
  console.log("PASS: token masking/reveal, hidden-tab remask, confirmed copy, rejection/missing/timeout, no auto-reveal, duplicate suppression, hide during pending copy, HTMX initialization/cleanup and pagehide clearing");
};
