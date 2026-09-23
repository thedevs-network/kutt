const assert = require("node:assert/strict");
const alias = require("../server/link-alias");
const forwarding = require("../server/link-forwarding");
const utils = require("../server/utils");

try {
  for (const value of ["guide.pdf", "v1.2.3", "docs/v1.2/guide.pdf", "A_b-1.C_d-2", "api.json", "README", "a".repeat(60) + ".pdf", Array(8).fill("a.b").join("/")]) {
    assert.equal(alias.valid(value), true, value);
  }
  for (const value of [null, {}, [], "", ".", "..", ".hidden", "file.", "a..b", "a...b", "a/.b", "a/b.", "a/../b", "a/./b",
    "/a.pdf", "a.pdf/", "a//b.pdf", "a%2eb", "a%252eb", "a%2fb", "a%5cb", "a\\b.pdf", "a?b.pdf", "a#b.pdf", "a\u0000b.pdf", "a\nb.pdf",
    "a.pdf\u007f", "a b.pdf", "a".repeat(61) + ".pdf", Array(9).fill("a.b").join("/"), "\u00e9.pdf"]) {
    assert.equal(alias.valid(value), false, String(value));
  }
  for (const value of [...utils.preservedURLs, "scripts", ".well-known", "favicon.ico", "robots.txt", "manifest.webmanifest"]) {
    for (const variant of [value, value.toUpperCase(), value + "/guide.pdf"]) assert.equal(alias.valid(variant), false, variant);
  }
  const original = utils.customAlphabetRegex;
  utils.customAlphabetRegex = /^[\s\S]+$/;
  try {
    assert.equal(alias.valid("legacy~name"), true);
    for (const value of [".hidden", "a..b", "a.", "a%2fb", "a\\b", "a\nb", "a?b", "a#b"]) assert.equal(alias.valid(value), false, value);
  } finally { utils.customAlphabetRegex = original; }
  // Forwarding suffixes are a separate grammar, not alias creation input.
  for (const value of ["docs/.hidden", "docs/a..b", "docs/file.", "docs/~file", "docs/" + "a".repeat(200)]) {
    assert.equal(forwarding.path(value), value);
  }
  for (const value of ["docs/..", "docs/.", "docs//a", "docs/%2e", "docs/a\\b"]) assert.throws(() => forwarding.path(value));
  console.log("PASS: dotted alias grammar, bounds, reserved roots, custom alphabet safety and unchanged forwarding suffixes");
} finally { require("../server/knex").destroy(); }
