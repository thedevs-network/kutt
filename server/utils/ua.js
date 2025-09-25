const UAParser = require("ua-parser-js");

function normaliseOSName(name = "") {
  const s = String(name).toLowerCase();
  if (s.includes("windows")) return "windows";
  if (s.includes("mac os") || s.includes("macos") || s.startsWith("mac")) return "macos";
  if (s.includes("android")) return "android";
  if (s.includes("ios")) return "ios";
  if (s.includes("linux")) return "linux";
  return "other";
}

function normaliseUA(ua = "") {
  const parsed = new UAParser(ua).getResult();
  console.log('Parsed OS:', parsed.os); 
  console.log('Parsed Browser:', parsed.browser);
  const browserName = parsed.browser?.name || "";
  const osName = parsed.os?.name || "";

  // keep browser behaviour identical to before
  const browser = (() => {
    const b = browserName.toLowerCase();
    if (b.includes("edge"))    return "edge";
    if (b.includes("chrome"))  return "chrome";
    if (b.includes("firefox")) return "firefox";
    if (b.includes("safari"))  return "safari";
    if (b.includes("opera"))   return "opera";
    if (b.includes("ie") || b.includes("internet explorer")) return "ie";
    return "other";
  })();

  const os = normaliseOSName(osName);

  return { browser, os };
}

module.exports = { normaliseUA };
