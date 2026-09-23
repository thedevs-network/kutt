const i18n = require("./i18n");
const { CustomError } = require("./utils");
const MAX_NAMES = 128;
const MAX_BYTES = 1000000;
const OTHER = "(other)";
const invalid = () => { throw new CustomError(i18n.t("messages.stored_analytics_referrers_are_unavailable"), 503); };
function count(value) {
  const result = Number(value);
  if (!Number.isSafeInteger(result) || result < 0) invalid();
  return result;
}
function parse(value) {
  try {
    if (typeof value === "string") {
      if (Buffer.byteLength(value) > MAX_BYTES) return null;
      value = JSON.parse(value);
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) invalid();
    return value;
  } catch { invalid(); }
}
function add(map, name, value) {
  // A bounded presentation, including when several bounded hourly buckets merge.
  if (name.length > 1265 || (!map.has(name) && map.size >= MAX_NAMES)) name = OTHER;
  const next = count(map.get(name) || 0) + count(value);
  map.set(name, count(next));
}
function entries(value, total) {
  const object = parse(value);
  if (object === null) return [[OTHER, count(total)]];
  const map = new Map();
  for (const [name, visits] of Object.entries(object)) add(map, name, visits);
  return [...map];
}
function append(value, name) {
  const object = parse(value);
  // Do not rewrite or destroy pre-upgrade oversized detail. Reports use the
  // authoritative total; new hourly buckets get the bounded representation.
  if (object === null) return value;
  const key = Object.hasOwn(object, name) || Object.keys(object).length < MAX_NAMES ? name : OTHER;
  return JSON.stringify({ ...object, [key]: count(count(Object.hasOwn(object, key) ? object[key] : 0) + 1) });
}
module.exports = { MAX_NAMES, MAX_BYTES, OTHER, add, entries, append };
