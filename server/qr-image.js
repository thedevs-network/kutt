const i18n = require("./i18n");
const { PNG } = require("pngjs");

function renderPNG(modules, width, logo) {
  const total = modules.size + 8;
  if (!Number.isInteger(width) || width < Math.max(128, total) || width > 1024) throw new Error(i18n.t("messages.invalid_qr_image_width"));
  const image = new PNG({ width, height: width });
  // Render the library's matrix on an exact integer canvas. node-qrcode's PNG
  // width calculation can round 1024 down to 1023 for a 41-module symbol.
  for (let y = 0; y < width; y++) for (let x = 0; x < width; x++) {
    const row = Math.floor(y * total / width) - 4, col = Math.floor(x * total / width) - 4;
    const value = row >= 0 && col >= 0 && row < modules.size && col < modules.size && modules.get(row, col) ? 0 : 255;
    const offset = (y * width + x) * 4;
    image.data[offset] = image.data[offset + 1] = image.data[offset + 2] = value;
    image.data[offset + 3] = 255;
  }
  if (logo) {
    const placed = require("./qr-logo").placement(modules, width, logo);
    for (let y = placed.start; y < placed.end; y++) for (let x = placed.start; x < placed.end; x++) {
      image.data.fill(255, (y * width + x) * 4, (y * width + x) * 4 + 4);
    }
    PNG.bitblt(placed.image, image, 0, 0, placed.image.width, placed.image.height, placed.x, placed.y);
  }
  return PNG.sync.write(image);
}

async function renderSVG(url, modules, width, level, logo) {
  const svg = await require("qrcode").toString(url, { type: "svg", width, margin: 4, errorCorrectionLevel: level,
    color: { dark: "#000000ff", light: "#ffffffff" } });
  if (!logo) return svg;
  const placed = require("./qr-logo").placement(modules, width, logo), scale = (modules.size + 8) / width;
  const png = PNG.sync.write(placed.image).toString("base64");
  return svg.replace("</svg>", `<g transform="scale(${scale})"><rect x="${placed.start}" y="${placed.start}" width="${placed.end - placed.start}" height="${placed.end - placed.start}" fill="#fff"/><image x="${placed.x}" y="${placed.y}" width="${placed.image.width}" height="${placed.image.height}" href="data:image/png;base64,${png}"/></g></svg>`);
}

module.exports = { renderPNG, renderSVG };
