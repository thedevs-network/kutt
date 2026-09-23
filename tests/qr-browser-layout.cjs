const assert = require("node:assert/strict");

module.exports = async page => {
  const results = await page.locator('.qr-page h1, .qr-page label, .qr-page input, .qr-page select, .qr-page button, .qr-page a, .qr-page p, .qr-page figcaption').evaluateAll(nodes => {
    const parse = value => value.match(/[\d.]+/g).map(Number);
    const blend = (a, b) => a.slice(0, 3).map((v, i) => v * (a[3] ?? 1) + b[i] * (1 - (a[3] ?? 1)));
    const lum = a => a.slice(0, 3).map(v => v / 255).map(v => v <= .04045 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4).reduce((sum, v, i) => sum + v * [.2126, .7152, .0722][i], 0);
    return nodes.filter(node => node.getClientRects().length && !node.disabled && node.getAttribute("aria-disabled") !== "true").map(node => {
      const chain = []; for (let p = node; p; p = p.parentElement) chain.unshift(p);
      let bg = [255, 255, 255], gradient = false;
      for (const p of chain) {
        const style = getComputedStyle(p), color = parse(style.backgroundColor);
        bg = blend(color, bg);
        if ((color[3] ?? 1) === 1) gradient = false;
        if (style.backgroundImage.startsWith("linear-gradient(")) gradient = true;
      }
      const s = getComputedStyle(node), fg = lum(blend(parse(s.color), bg)), b = lum(bg);
      const rect = node.getBoundingClientRect();
      return { id: node.id || node.tagName, text: (node.textContent || "").trim().slice(0, 60),
        contrast: gradient ? null : (Math.max(fg, b) + .05) / (Math.min(fg, b) + .05),
        overflow: node.scrollWidth > node.clientWidth + 1 && node.tagName !== "INPUT",
        outside: rect.left < -1 || rect.right > innerWidth + 1 };
    });
  });
  for (const result of results) {
    assert(!result.overflow && !result.outside, "QR layout: " + JSON.stringify(result));
    if (result.contrast !== null) assert(result.contrast >= 4.5, "QR contrast: " + JSON.stringify(result));
  }
};
