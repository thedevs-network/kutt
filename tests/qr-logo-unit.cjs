const assert = require("node:assert/strict");
const { deflateSync } = require("node:zlib");
const { PNG } = require("pngjs");
const QRCode = require("qrcode");
const { chunk, logo, uri, metadata } = require("./qr-logo-fixture.cjs");
const logos = require("../server/qr-logo"), renderer = require("../server/qr-image");
const { CustomError } = require("../server/utils");

(async () => {
  try {
    const bytes = logo(), encoded = metadata(bytes).toString("base64"), decoded = logos.decode(encoded);
    assert.deepEqual(logos.decode("data:image/png;base64," + encoded), decoded, "Plain base64 and exact legacy PNG data URI decode identically");
    assert.deepEqual(decoded.data, PNG.sync.read(bytes).data);
    assert.deepEqual(Object.keys(decoded).sort(), ["data", "height", "width"]);
    const i18n = require("../server/i18n");
    for (const locale of ["en", "fr", "es"]) i18n.run(locale, () => {
      assert.throws(() => logos.decode(null), error => error.statusCode === 400 && error.message === i18n.t("qr.invalid_logo"));
      assert.throws(() => logos.placement({ size: 81 }, 128, decoded), error => error.statusCode === 400 && error.message === i18n.t("qr.logo_size_required"));
    });
    const header = Buffer.from(bytes.subarray(16, 29));
    const withHeader = data => Buffer.concat([bytes.subarray(0, 8), chunk("IHDR", data), bytes.subarray(33)]);
    const bad = [null, {}, [], "", "https://example.invalid/logo.png", "data:image/svg+xml;base64,PHN2Zy8+", "data:image/png;base64,!!!!", uri(Buffer.from("<svg/>")),
      "data:image/jpeg;base64," + encoded, "DATA:image/png;base64," + encoded, "data:image/png;name=logo.png;base64," + encoded,
      "data:image/png," + encoded, " " + encoded, encoded + "\n", encoded.slice(0, -1) + "_",
      uri(bytes) + "=", uri(bytes).replace("base64,", "base64,\n"), uri(Buffer.alloc(65537)), uri(Buffer.concat([bytes, Buffer.from("junk")])), uri(bytes.subarray(0, -1)),
      uri(Buffer.concat([bytes.subarray(0, 33), chunk("acTL", Buffer.alloc(8)), bytes.subarray(33)])),
      uri(Buffer.concat([bytes.subarray(0, 33), bytes.subarray(8, 33), bytes.subarray(33)]))];
    for (const [offset, value] of [[0, 0], [0, 513], [4, 0], [4, 0xffffffff]]) {
      const valueHeader = Buffer.from(header); valueHeader.writeUInt32BE(value, offset); bad.push(uri(withHeader(valueHeader)));
    }
    for (const [offset, value] of [[8, 3], [9, 7], [10, 1], [11, 1], [12, 1]]) {
      const valueHeader = Buffer.from(header); valueHeader[offset] = value; bad.push(uri(withHeader(valueHeader)));
    }
    const corrupt = Buffer.from(bytes); corrupt[29] ^= 1; bad.push(uri(corrupt));
    const ancillary = metadata(bytes); ancillary[ancillary.indexOf("private-fixture")] ^= 1; bad.push(uri(ancillary));
    for (const text of ["k\0", "k\0x", "k\0xx"]) {
      const padded = Buffer.concat([bytes.subarray(0, 33), chunk("tEXt", Buffer.from(text)), bytes.subarray(33)]).toString("base64");
      if (!padded.endsWith("=")) continue;
      const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/", at = padded.length - (padded.endsWith("==") ? 3 : 2);
      const noncanonical = padded.slice(0, at) + alphabet[alphabet.indexOf(padded[at]) | 1] + padded.slice(at + 1);
      assert.deepEqual(Buffer.from(noncanonical, "base64"), Buffer.from(padded, "base64"));
      bad.push("data:image/png;base64," + noncanonical);
    }
    for (const payload of [deflateSync(Buffer.alloc(4 * 1024 * 1024)), deflateSync(Buffer.from([0])), Buffer.from("not-zlib")]) {
      bad.push(uri(Buffer.concat([bytes.subarray(0, 33), chunk("IDAT", payload), chunk("IEND", Buffer.alloc(0))])));
    }
    let calls = 0;
    const read = PNG.sync.read;
    PNG.sync.read = (...args) => { calls++; return read(...args); };
    const invalid = bad.flatMap(input => typeof input === "string" && input.startsWith("data:image/png;base64,")
      ? [input, input.slice("data:image/png;base64,".length)] : [input]);
    invalid.push("data:image/png;base64," + uri(bytes));
    try { for (const input of invalid) assert.throws(() => logos.decode(input), error => error instanceof CustomError && error.statusCode === 400); }
    finally { PNG.sync.read = read; }
    assert.equal(calls, 0, "Malformed/oversized/framing/inflate inputs must fail before the raster decoder");
    for (const dimensions of [[1, 1], [512, 1], [1, 512], [512, 512]]) {
      const bytes = logo(...dimensions);
      for (const input of [bytes.toString("base64"), uri(bytes)]) assert.equal(logos.decode(input).width, dimensions[0]);
    }

    const decoder = process.argv.includes("--decode") ? require(process.env.QR_DECODER_MODULE || "./browser-deps/node_modules/jsqr") : null;
    const urls = ["https://q.invalid/a", "https://q.invalid/guide.pdf", "https://qr.example.invalid/docs/v1.2/guide.pdf",
      "https://qr.example.invalid/" + "a".repeat(60) + ".pdf", "https://" + "domain".repeat(9) + ".invalid/" + "a".repeat(64),
      "https://q.invalid/" + "a".repeat(220), "https://q.invalid/" + "a".repeat(980)];
    let decodedCount = 0, normalizedCount = 0;
    for (const url of urls) for (const size of [128, 255, 256, 300, 512, 1024]) {
      const modules = QRCode.create(url, { errorCorrectionLevel: "H" }).modules;
      if (size < (modules.size + 8) * 2) { assert.throws(() => renderer.renderPNG(modules, size, decoded)); continue; }
      const placed = logos.placement(modules, size, decoded), plain = PNG.sync.read(renderer.renderPNG(modules, size));
      const branded = PNG.sync.read(renderer.renderPNG(modules, size, decoded));
      assert((placed.end - placed.start) <= Math.ceil(modules.size / (modules.size + 8) * size / 5));
      let changed = 0;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
        const at = (y * size + x) * 4, same = plain.data.subarray(at, at + 4).equals(branded.data.subarray(at, at + 4));
        if (x < placed.start || x >= placed.end || y < placed.start || y >= placed.end) assert(same, "QR outside center plate, finders and quiet zone unchanged");
        else if (!same) changed++;
      }
      assert(changed > 0);
      const svg = await renderer.renderSVG(url, modules, size, "H", decoded);
      assert(!/private-fixture|script|foreignObject|https?:\/\//.test(svg.replace('xmlns="http://www.w3.org/2000/svg"', "")));
      const embedded = PNG.sync.read(Buffer.from(svg.match(/href="data:image\/png;base64,([^"]+)"/)[1], "base64"));
      assert.equal(embedded.width, placed.image.width);
      assert.deepEqual(embedded.data, placed.image.data);
      if (decoder) {
        let result = decoder(new Uint8ClampedArray(branded.data), size, size)?.data;
        if (!result && size === 1024) {
          // jsQR can miss even the unbranded dense 1024px control. Normalize
          // sampling scale, not the QR content, and require both to decode.
          const sample = image => {
            const data = new Uint8ClampedArray(512 * 512 * 4);
            for (let y = 0; y < 512; y++) for (let x = 0; x < 512; x++) data.set(image.data.subarray((y * 2 * size + x * 2) * 4, (y * 2 * size + x * 2) * 4 + 4), (y * 512 + x) * 4);
            return decoder(data, 512, 512)?.data;
          };
          assert.equal(sample(plain), url, "The same decoder scale must work for the plain control");
          result = sample(branded); normalizedCount++;
        }
        assert.equal(result, url, `Decode ${size}px, ${modules.size} modules`); decodedCount++;
      }
    }
    console.log("PASS: equivalent plain base64/legacy data URI, identical bounded PNG framing/CRC/IHDR/inflate before decode, metadata stripping, center-only PNG/SVG branding and quiet zones" + (decoder ? "; jsQR decoded " + decodedCount + " size/alias cases (" + normalizedCount + " normalized scale, with plain control)" : ""));
  } finally { await require("../server/knex").destroy(); }
})().catch(error => { console.error(error.stack); process.exitCode = 1; });
