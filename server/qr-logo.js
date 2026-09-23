const { inflateSync } = require("node:zlib");
const { PNG } = require("pngjs");
const { crc32 } = require("pngjs/lib/crc");
const { CustomError } = require("./utils");
const i18n = require("./i18n");

const MAX_BYTES = 64 * 1024, MAX_SIDE = 512;
const PREFIX = "data:image/png;base64,";
const SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const fail = () => { throw new CustomError(i18n.t("qr.invalid_logo"), 400); };

function decode(input) {
  if (typeof input !== "string" || input.length > PREFIX.length + 4 * Math.ceil(MAX_BYTES / 3)) fail();
  const encoded = input.startsWith(PREFIX) ? input.slice(PREFIX.length) : input;
  if (!encoded.length || encoded.length > 4 * Math.ceil(MAX_BYTES / 3) || encoded.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(encoded)) fail();
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.length > MAX_BYTES || bytes.length < 45 || bytes.toString("base64") !== encoded || !bytes.subarray(0, 8).equals(SIGNATURE)) fail();
  if (bytes.readUInt32BE(8) !== 13 || bytes.toString("latin1", 12, 16) !== "IHDR") fail();
  const width = bytes.readUInt32BE(16), height = bytes.readUInt32BE(20), depth = bytes[24], color = bytes[25];
  const depths = { 0: [1, 2, 4, 8, 16], 2: [8, 16], 3: [1, 2, 4, 8], 4: [8, 16], 6: [8, 16] };
  if (!width || !height || width > MAX_SIDE || height > MAX_SIDE || !depths[color]?.includes(depth) || bytes[26] || bytes[27] || bytes[28]) fail();

  // Validate framing/CRC before any decompression. Only raster chunks reach pngjs;
  // metadata (including compressed profiles/text) is never interpreted or copied.
  const raster = [SIGNATURE], compressed = [];
  let offset = 8, count = 0, palette = 0, transparency = false, data = false, dataEnded = false, ended = false;
  while (offset < bytes.length) {
    if (++count > 128 || offset + 12 > bytes.length) fail();
    const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
    if (end > bytes.length) fail();
    const type = bytes.toString("latin1", offset + 4, offset + 8);
    if (!/^[A-Za-z]{2}[A-Z][A-Za-z]$/.test(type) ||
        (crc32(bytes.subarray(offset + 4, end - 4)) >>> 0) !== bytes.readUInt32BE(end - 4)) fail();
    if (type === "IHDR") { if (offset !== 8) fail(); }
    else if (type === "PLTE") {
      if (palette || data || transparency || !length || length > 768 || length % 3 || [0, 4].includes(color)) fail();
      palette = length / 3;
      if (color === 3 && palette > 2 ** depth) fail();
    } else if (type === "tRNS") {
      if (transparency || data || (color === 0 ? length !== 2 : color === 2 ? length !== 6 : color === 3 ? !palette || !length || length > palette : true)) fail();
      transparency = true;
    } else if (type === "IDAT") {
      if (dataEnded || (color === 3 && !palette)) fail();
      data = true; compressed.push(bytes.subarray(offset + 8, end - 4));
    } else if (type === "IEND") {
      if (length || !data || end !== bytes.length) fail();
      ended = true;
    } else if (/^[A-Z]/.test(type) || ["acTL", "fcTL", "fdAT"].includes(type)) fail();
    if (data && type !== "IDAT") dataEnded = true;
    if (["IHDR", "PLTE", "tRNS", "IDAT", "IEND"].includes(type)) raster.push(bytes.subarray(offset, end));
    offset = end;
  }
  if (!ended) fail();
  try {
    const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[color];
    const expected = (Math.ceil(width * channels * depth / 8) + 1) * height;
    // pngjs bounds non-interlaced inflation but can truncate excess output.
    // Require the exact raster length as well as a hard zlib output ceiling.
    const stream = Buffer.concat(compressed), inflated = inflateSync(stream, { maxOutputLength: expected, info: true });
    if (inflated.buffer.length !== expected || inflated.engine.bytesWritten !== stream.length) fail();
    const decoded = PNG.sync.read(Buffer.concat(raster), { checkCRC: true });
    if (decoded.width !== width || decoded.height !== height || decoded.data.length !== width * height * 4) fail();
    return { width, height, data: decoded.data };
  } catch { fail(); }
}

function placement(modules, width, logo) {
  const total = modules.size + 8;
  if (width < total * 2) throw new CustomError(i18n.t("qr.logo_size_required"), 400);
  // At most 20% of the symbol width (4% of its area), clear of all finders
  // and the four-module quiet zone. The plate is aligned to module edges.
  let span = Math.floor(modules.size / 5);
  if (span % 2 === 0) span--;
  const first = 4 + (modules.size - span) / 2;
  const start = Math.ceil(first * width / total), end = Math.ceil((first + span) * width / total);
  const padding = Math.max(2, Math.ceil(width / total)), available = end - start - padding * 2;
  const scale = available / Math.max(logo.width, logo.height);
  const w = Math.max(1, Math.floor(logo.width * scale)), h = Math.max(1, Math.floor(logo.height * scale));
  const image = new PNG({ width: w, height: h });
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const source = (Math.floor(y * logo.height / h) * logo.width + Math.floor(x * logo.width / w)) * 4;
    const at = (y * w + x) * 4, alpha = logo.data[source + 3] / 255;
    for (let c = 0; c < 3; c++) image.data[at + c] = Math.round(logo.data[source + c] * alpha + 255 * (1 - alpha));
    image.data[at + 3] = 255;
  }
  return { start, end, x: start + Math.floor((end - start - w) / 2), y: start + Math.floor((end - start - h) / 2), image };
}

module.exports = { decode, placement, MAX_BYTES, MAX_SIDE };
