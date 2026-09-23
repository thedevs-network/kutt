const assert = require("node:assert/strict");
const { spawnSync } = require("node:child_process");
const path = require("node:path");

module.exports = async ({ root, directory, env }) => {
  const result = spawnSync(process.execPath, ["-e", `
    const assert = require('node:assert/strict');
    const utils = require(${JSON.stringify(path.join(root, "server/utils"))});
    const parser = require(${JSON.stringify(path.join(root, "node_modules/express-useragent"))}).default;
    const samples = [
      ['safari', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15'],
      ['safari', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1'],
      ['chrome', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'],
      ['edge', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0'],
      ['opera', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 OPR/115.0.0.0'],
      ['firefox', 'Mozilla/5.0 (X11; Linux x86_64; rv:132.0) Gecko/20100101 Firefox/132.0'],
      ['other', ''], ['other', 'SyntheticUnknown/1.0']
    ];
    for (const [browser, text] of samples) assert.equal(utils.getUseragentBrowser(parser.parse(text)), browser, text);
    for (const [input, output] of [
      ['www.example.com', 'example.com'], ['WWW.example.com', 'WWW.example.com'],
      ['notwww.example.com', 'notwww.example.com'], ['sub.www.example.com', 'sub.www.example.com'],
      ['www.www.example.com', 'www.example.com'], ['www.example.com:443', 'example.com:443'],
      ['example.com', 'example.com'], ['', ''], [null, undefined], [undefined, undefined]
    ]) assert.equal(utils.removeWww(input), output, String(input));
    require(${JSON.stringify(path.join(root, "server/knex"))}).destroy();
  `], { cwd: directory, env, encoding: "utf8", timeout: 15000 });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  console.log("PASS: real browser parsing and prefix-only hostname normalization");
};
