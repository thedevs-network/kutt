const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

module.exports = async ({ request, session }) => {
  const headers = { Accept: "text/html" };
  for (const route of ["/", "/admin", "/settings"]) {
    const response = await request("GET", route, undefined, session, headers);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert(html.includes('/scripts/dialogs.js'));
    assert.match(html, /<dialog[^>]+aria-modal="true"[^>]+hx-sync="closest dialog:drop"/);
    assert(!/hx-on:click=['"]openDialog/.test(html), "Open during the same pre-request event used for tracking");
  }
  const otherEmail = "modal-boundary@example.invalid", password = require("node:crypto").randomBytes(32).toString("hex");
  const created = await request("POST", "/api/users/admin", {
    email: otherEmail, password, verified: true
  }, session);
  assert.equal(created.status, 201);
  // Confirmation fragments remain authenticated; admin forms remain admin-only.
  const signedIn = await request("POST", "/api/auth/login", { email: otherEmail, password });
  assert.equal(signedIn.status, 200);
  const ordinaryToken = (await signedIn.json()).token;
  for (const route of ["/create-user", "/add-domain", "/confirm-user-ban", "/confirm-user-delete", "/confirm-domain-ban", "/confirm-link-ban"]) {
    const anonymous = await request("GET", route, undefined, undefined, headers);
    assert.equal(anonymous.status, 200, route);
    assert.equal(anonymous.headers.get("HX-Redirect"), "/logout");
    assert.equal(await anonymous.text(), "NOT_AUTHENTICATED");
    const denied = await request("GET", route, undefined, ordinaryToken);
    assert.equal(denied.status, 401, route);
    assert.equal((await denied.json()).error, "Unauthorized");
    const html = await (await request("GET", route, undefined, ordinaryToken, headers)).text();
    assert(!/hx-(post|put|delete|patch)=/.test(html), "Denied HTML has no privileged HTMX action");
    const forms = [...html.matchAll(/<form\b[^>]*>/g)].map(match => match[0]);
    assert(forms.length <= 1 && forms.every(form => form === '<form action="/language" method="post" class="language-selector">'), "Only the public language preference form is allowed on denied HTML");
  }

  // Deterministic request-state tests complement the real native-modal browser suite.
  const listeners = new Map(), window = { KuttI18n: require("../server/i18n").current() };
  const document = {
    activeElement: null,
    addEventListener(name, listener) { listeners.set(name, listener); },
    getElementById() { return dialog; },
    querySelector(selector) { return selector === "dialog.dialog[open]" ? (dialog.open ? dialog : null) : fallback; }
  };
  const control = () => ({ disabled: false, isConnected: true, tabIndex: 0,
    getClientRects: () => [1], closest: () => null, focus() { document.activeElement = this; } });
  const opener = control(), fallback = control(), close = control(), field = control();
  const message = { textContent: "" }, attributes = new Map();
  let contentReady = false;
  const content = { replaceChildren() { contentReady = false; }, querySelector() { return contentReady ? field : null; }, querySelectorAll() { return []; } };
  const dialog = {
    id: "test-dialog", open: false, className: "dialog", classList: { add() {} },
    showModal() { this.open = true; }, close() { this.open = false; },
    setAttribute(k, v) { attributes.set(k, v); }, removeAttribute(k) { attributes.delete(k); },
    contains(node) { return node === close || node === field; },
    querySelector(selector) {
      return selector === ".dialog-status" ? message : selector === ".dialog-close" ? close :
        selector === ".content-wrapper" ? content : null;
    }
  };
  vm.runInNewContext(fs.readFileSync("static/scripts/dialogs.js", "utf8"), { window, document });
  const emit = (name, detail) => {
    const event = { detail, defaultPrevented: false, preventDefault() { this.defaultPrevented = true; } };
    listeners.get(name)?.(event); return event;
  };
  const start = verb => {
    const xhr = { aborted: false, abort() { this.aborted = true; emit("htmx:afterRequest", { xhr, successful: false }); } };
    const event = emit("htmx:before-request", { target: { closest: () => dialog }, xhr, requestConfig: { verb } });
    return { xhr, event };
  };
  assert(listeners.has("htmx:before-request"), "Track after the capture-phase opener, not its earlier camel-case event");
  window.openDialog("test-dialog", null, opener);
  assert.equal(document.activeElement, close);
  const first = start("get"); assert.equal(first.xhr.timeout, 30000);
  assert.equal(window.closeDialog(), true); assert(first.xhr.aborted);
  assert.equal(document.activeElement, opener);
  window.openDialog("test-dialog", null, opener);
  assert(emit("htmx:beforeOnLoad", { xhr: first.xhr }).defaultPrevented,
    "Closed responses must not reach normal or out-of-band swaps");
  const failed = start("get"); emit("htmx:afterRequest", { xhr: failed.xhr, successful: false });
  assert.match(message.textContent, /Could not load/); assert(!close.disabled);
  const saved = start("post");
  assert(close.disabled); assert.equal(window.closeDialog(), false); assert(dialog.open);
  assert(start("post").event.defaultPrevented, "Concurrent writes are rejected");
  emit("htmx:afterRequest", { xhr: saved.xhr, successful: false });
  assert.match(message.textContent, /Check the saved state/); assert(!close.disabled);
  const retry = start("post"); contentReady = true;
  emit("htmx:afterRequest", { xhr: retry.xhr, successful: true });
  assert.equal(message.textContent, "");
  opener.isConnected = false; window.closeDialog(); assert.equal(document.activeElement, fallback);
  console.log("PASS: modal authentication, shared frame, cancelled/stale requests, bounded errors, write lock/retry and removed-opener focus");
};
