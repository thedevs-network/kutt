const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");

module.exports = async ({ root }) => {
  const css = readFileSync(path.join(root, "static/css/styles.css"), "utf8");
  const variable = name => { const value = css.match(new RegExp(name + ":\\s*([^;]+);"))?.[1]; assert(value, name); return value; };
  const color = value => {
    if (/^#[\da-f]{6}$/i.test(value)) return [1, 3, 5].map(index => parseInt(value.slice(index, index + 2), 16) / 255);
    const parts = value.match(/^hsl\(([\d.]+),\s*([\d.]+)%,\s*([\d.]+)%\)$/);
    assert(parts, "Unsupported palette color " + value);
    const h = Number(parts[1]) / 60, s = Number(parts[2]) / 100, l = Number(parts[3]) / 100;
    const c = (1 - Math.abs(2 * l - 1)) * s, x = c * (1 - Math.abs(h % 2 - 1)), m = l - c / 2;
    const rgb = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][Math.floor(h) % 6];
    return rgb.map(value => value + m);
  };
  const luminance = rgb => rgb.map(value => value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  const contrast = (a, b) => { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); };
  assert.equal(contrast([1, 1, 1], [0, 0, 0]), 21);
  assert.equal(contrast([1, 1, 1], [1, 1, 1]), 1);
  for (const name of ["--color-primary", "--error-text-color", "--secondary-text-color"]) {
    for (const background of [color(variable("--bg-color")), color("#ffffff")]) assert(contrast(color(variable(name)), background) >= 4.5, name);
  }
  for (const name of ["primary", "secondary", "danger", "success"]) {
    const stops = variable("--button-bg-" + name).match(/hsl\([^)]+\)/g).map(color);
    assert.equal(stops.length, 2);
    for (let step = 0; step <= 32; step++) {
      const sample = stops[0].map((value, i) => value + (stops[1][i] - value) * step / 32);
      assert(contrast([1, 1, 1], sample) >= 4.5, name + " gradient at " + step);
    }
  }
  assert.match(css, /p\.error\s*\{\s*color:\s*var\(--error-text-color\)/);
  assert.match(css, /input\[type="password"\]::placeholder\s*\{[^}]*color:\s*#666/s);
  console.log("PASS: navigation/error/secondary text and 33 samples of each primary/secondary/danger/success gradient meet 4.5:1; shared error and placeholder styles use readable colors");
};
