const { domainToASCII } = require("node:url");
const { isIP } = require("node:net");

function hostname(value) {
  if (typeof value !== "string" || !value || value.length > 253 || /[\s\u0000-\u001f\u007f/@?#%\\]/.test(value)) return null;
  if (value.startsWith("[")) {
    if (!value.endsWith("]") || isIP(value.slice(1, -1)) !== 6) return null;
    return new URL("http://" + value).hostname.toLowerCase();
  }
  const original = value.replace(/\.$/, "").toLowerCase();
  const ascii = domainToASCII(original).toLowerCase();
  if (!ascii || ascii.length > 253 || ascii.split(".").some(label => !/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label))) return null;
  let parsed;
  try { parsed = new URL("http://" + ascii).hostname; } catch { return null; }
  // Do not accept ambiguous numeric IPv4 spellings in the operator's rules.
  if (isIP(parsed) && parsed !== original) return null;
  return ascii;
}

function compile(raw) {
  if (raw === "") return Object.freeze({ enabled: false, hosts: Object.freeze([]), allows: () => true });
  const invalid = () => { throw new Error("DESTINATION_ALLOWED_HOSTS must be a JSON array of at most 100 exact hosts or *.domain rules."); };
  let entries;
  try { entries = JSON.parse(raw); } catch { invalid(); }
  if (!Array.isArray(entries) || entries.length > 100 || raw.length > 30000) invalid();
  const rules = entries.map(value => {
    if (typeof value !== "string") invalid();
    const wildcard = value.startsWith("*."), host = hostname(wildcard ? value.slice(2) : value);
    if (!host || (wildcard && (isIP(host.replace(/^\[|\]$/g, "")) || !host.includes(".")))) invalid();
    return { wildcard, host };
  });
  const hosts = [...new Set(rules.map(rule => (rule.wildcard ? "*." : "") + rule.host))];
  return Object.freeze({ enabled: true, hosts: Object.freeze(hosts), allows(value) {
    if (typeof value !== "string" || value.length > 2040 || /[\s\u0000-\u001f\u007f\\]/.test(value)) return false;
    let url;
    try { url = new URL(value); } catch { return false; }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) return false;
    const host = hostname(url.hostname);
    return !!host && rules.some(rule => rule.wildcard ? host !== rule.host && host.endsWith("." + rule.host) : host === rule.host);
  } });
}

let configured;
const current = () => configured ||= compile(require("./env").DESTINATION_ALLOWED_HOSTS);
function requireAllowed(value, status = 400) {
  if (!current().allows(value)) {
    throw new (require("./utils").CustomError)(require("./i18n").t("destination_policy.denied"), status);
  }
  return value;
}
const status = () => ({ enabled: current().enabled, hosts: current().hosts });

async function editTarget(req, res, link) {
  const value = req.body.target;
  if (!value || current().allows(value)) return;
  const db = require("./knex"), i18n = require("./i18n");
  const { CustomError } = require("./utils");
  const user = await db("users").where({ id: req.user.id, verified: true, banned: false }).first();
  if (!user || Number(user.auth_version) !== Number(req.user.auth_version)) {
    throw new CustomError(i18n.t("messages.sign_in_again"), 401);
  }
  const admin = req.user.admin && !req.apiToken && user.role === "ADMIN";
  if ((!admin && link.user_id !== user.id) || (req.apiTokenDomain !== undefined &&
      (link.domain_id !== req.apiTokenDomain || link.archived_domain))) {
    throw new CustomError(i18n.t("messages.link_was_not_found"), 404);
  }
  if (value === link.target) {
    // Do not write this snapshot back if another request repairs the target.
    delete req.body.target;
    return;
  }
  try { requireAllowed(value); }
  catch (error) { res.locals.errors = { ...res.locals.errors, target: error.message }; throw error; }
}

module.exports = { compile, hostname, current, requireAllowed, status, editTarget };
