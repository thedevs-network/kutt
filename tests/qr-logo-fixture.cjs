const { PNG } = require("pngjs");
const { crc32 } = require("pngjs/lib/crc");
function chunk(type, data) {
  const bytes = Buffer.alloc(data.length + 12);
  bytes.writeUInt32BE(data.length); bytes.write(type, 4); data.copy(bytes, 8);
  bytes.writeUInt32BE(crc32(bytes.subarray(4, -4)) >>> 0, bytes.length - 4);
  return bytes;
}
function logo(width = 32, height = 24) {
  const image = new PNG({ width, height });
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const at = (y * width + x) * 4;
    image.data.set(x < width / 2 ? [10, 128, 93, 255] : [194, 25, 60, y < height / 2 ? 128 : 255], at);
  }
  return PNG.sync.write(image);
}
const uri = bytes => "data:image/png;base64," + bytes.toString("base64");
const metadata = bytes => Buffer.concat([bytes.subarray(0, 33), chunk("tEXt", Buffer.from("Comment\0private-fixture-metadata")), bytes.subarray(33)]);
module.exports = { chunk, logo, uri, metadata };
