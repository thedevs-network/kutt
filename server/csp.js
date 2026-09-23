const { AsyncLocalStorage } = require("node:async_hooks");
const { randomBytes } = require("node:crypto");

const requests = new AsyncLocalStorage();
const modes = ["off", "report-only", "enforce"];

function policy(nonce) {
  if (!/^[A-Za-z0-9+/]{32}$/.test(nonce)) throw new Error("Invalid CSP nonce");
  return [
    "default-src 'none'", "base-uri 'none'", "object-src 'none'", "frame-ancestors 'self'", "frame-src 'none'",
    `script-src 'nonce-${nonce}'`, "script-src-attr 'none'",
    `style-src 'self' 'nonce-${nonce}'`, "style-src-attr 'none'",
    "img-src 'self' data: blob:", "font-src 'self'", "connect-src 'self'",
    "form-action 'self'", "manifest-src 'self'", "worker-src 'none'", "media-src 'none'"
  ].join("; ");
}

function middleware(mode) {
  if (!modes.includes(mode)) throw new Error("Invalid CSP mode");
  return (req, res, next) => {
    const nonce = mode === "off" ? "" : randomBytes(24).toString("base64");
    const api = /^\/api(?:\/|$)/i.test(req.path);
    const render = res.render;
    res.render = function (view, options, callback) {
      if (mode !== "off") {
        // Intermediary HTML rewriting can inject scripts into documents or fragments.
        res.set("Cache-Control", "private, no-store, no-transform");
        // A fragment's nonce/policy cannot replace its owning document's policy.
        if (res.locals.layout !== null && !api) {
          res.set(mode === "enforce" ? "Content-Security-Policy" : "Content-Security-Policy-Report-Only", policy(nonce));
        }
      }
      return render.call(this, view, options, callback);
    };
    requests.run({ mode, nonce }, next);
  };
}

function register(hbs) {
  // Helpers take no model arguments: body/query/locals cannot supply a nonce.
  hbs.registerHelper("cspNonce", () => requests.getStore()?.nonce || "");
  hbs.registerHelper("cspEnabled", () => modes.slice(1).includes(requests.getStore()?.mode));
  hbs.registerHelper("cspEnforced", () => requests.getStore()?.mode === "enforce");
}

module.exports = { middleware, register, policy };
