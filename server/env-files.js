const { readFileSync } = require("node:fs");

module.exports = function loadFiles(keys, values = process.env) {
  for (const key of keys) {
    const fileKey = key + "_FILE";
    if (!(fileKey in values)) continue;
    try { values[key] = readFileSync(values[fileKey], "utf8").trim(); }
    catch { throw new Error("Unable to read configured " + fileKey + "."); }
  }
};
