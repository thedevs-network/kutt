const assert = require("node:assert/strict");
const Module = require("node:module");
const path = require("node:path");
const test = require("node:test");

function loadWithMocks(modulePath, mocks) {
  const originalLoad = Module._load;
  Module._load = function (request, parent, isMain) {
    if (Object.hasOwn(mocks, request)) return mocks[request];
    return originalLoad.call(this, request, parent, isMain);
  };

  try {
    delete require.cache[require.resolve(modulePath)];
    return require(modulePath);
  } finally {
    Module._load = originalLoad;
  }
}

function runMiddleware(handlers, req) {
  const res = { locals: {} };
  for (const handler of handlers) {
    let nextCalled = false;
    handler(req, res, () => { nextCalled = true; });
    if (!nextCalled) break;
  }
}

test("POST protected-link verification uses the existing rate limiter", () => {
  const routes = new Map();
  const router = {
    delete() {},
    get() {},
    patch() {},
    post(route, ...handlers) { routes.set(route, handlers); },
  };
  const limiter = (req, res, next) => next();
  const middleware = () => (req, res, next) => next();
  const rateLimitOptions = [];
  function flexible(req, res, next) {
    if (typeof next === "function") return next();
    return flexible;
  }
  const helpers = {
    parseQuery: middleware(),
    rateLimit: (options) => {
      rateLimitOptions.push(options);
      return limiter;
    },
    verify: middleware(),
  };

  loadWithMocks(path.join(__dirname, "../server/routes/link.routes.js"), {
    cors: flexible,
    express: { Router: () => router },
    "../env": {},
    "../handlers/auth.handler": new Proxy({}, { get: () => flexible }),
    "../handlers/helpers.handler": helpers,
    "../handlers/links.handler": new Proxy({}, { get: () => flexible }),
    "../handlers/locals.handler": new Proxy({}, { get: () => flexible }),
    "../handlers/validators.handler": new Proxy({}, { get: () => flexible }),
    "../utils/asyncHandler": (handler) => handler,
  });

  assert.ok(routes.get("/:id/protected").includes(limiter));
  assert.deepEqual(rateLimitOptions, [{ window: 60, limit: 5 }]);
});

test("Basic Auth verification is rate limited without throttling ordinary redirects", () => {
  const routes = new Map();
  const app = {
    get(route, ...handlers) { routes.set(route, handlers); },
    listen() {},
    set() {},
    use() {},
  };
  let limitedRequests = 0;
  const rateLimitOptions = [];
  const limiter = (req, res, next) => {
    limitedRequests += 1;
    next();
  };
  const middleware = (req, res, next) => next();
  const express = Object.assign(() => app, {
    json: () => middleware,
    static: () => middleware,
    urlencoded: () => middleware,
  });

  loadWithMocks(path.join(__dirname, "../server/server.js"), {
    "./env": { NODE_APP_INSTANCE: 1, OIDC_ENABLED: false, TRUST_PROXY: false },
    "./cron": {},
    "./handlers/helpers.handler": {
      error: middleware,
      rateLimit: (options) => {
        rateLimitOptions.push(options);
        return limiter;
      },
    },
    "./handlers/links.handler": {
      redirect: middleware,
      redirectCustomDomainHomepage: middleware,
    },
    "./handlers/locals.handler": { config: middleware, isHTML: middleware },
    "./handlers/renders.handler": { notFound: middleware },
    "./passport": {},
    "./routes": { api: middleware, render: middleware },
    "./utils": { registerHandlebarsHelpers() {} },
    "./utils/asyncHandler": (handler) => handler,
    "cookie-parser": () => middleware,
    "cookie-session": () => middleware,
    express,
    hbs: {},
    helmet: () => middleware,
    passport: { initialize: () => middleware },
  });

  runMiddleware(routes.get("/:id"), { headers: { authorization: "Basic dXNlcjpwYXNz" } });
  assert.equal(limitedRequests, 1);

  runMiddleware(routes.get("/:id"), { headers: {} });
  assert.equal(limitedRequests, 1);
  assert.deepEqual(rateLimitOptions, [{ window: 60, limit: 5 }]);
});
