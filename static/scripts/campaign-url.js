(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory(require("../../server/i18n"));
  else root.KuttCampaign = factory(root.KuttI18n);
})(typeof globalThis === "object" ? globalThis : this, function (i18n) {
  "use strict";
  const fields = Object.freeze(["utm_source", "utm_medium", "utm_campaign", "utm_term", "utm_content"]);
  function parse(target) {
    if (typeof target !== "string" || !target.trim() || target.length > 2040) throw new Error(i18n.t("ui.campaign_destination_must_be_a_url_of_at_most_2040_characters"));
    const value = target.trim();
    let url;
    try { url = new URL(/^[a-z][a-z\d+.-]*:/i.test(value) ? value : "https://" + value); }
    catch { throw new Error(i18n.t("ui.campaign_destination_must_be_a_valid_http_or_https_url")); }
    if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) throw new Error(i18n.t("ui.campaign_destination_must_use_http_or_https_without_embedded_credentials"));
    return url;
  }
  function apply(target, values) {
    const url = parse(target);
    if (!values || typeof values !== "object" || Array.isArray(values) || Object.keys(values).some(key => !fields.includes(key))) throw new Error(i18n.t("ui.unknown_campaign_parameter"));
    for (const key of fields) {
      if (!Object.hasOwn(values, key)) continue;
      const value = values[key];
      if (value !== null && (typeof value !== "string" || value.length > 255 || /[\u0000-\u001f\u007f]/.test(value))) throw new Error(i18n.t("campaign.invalid_value", { field: key }));
      if (value === null || value === "") url.searchParams.delete(key);
      else url.searchParams.set(key, value);
    }
    const result = url.href;
    if (result.length > 2040) throw new Error(i18n.t("ui.destination_including_campaign_parameters_exceeds_2040_characters"));
    return result;
  }
  function read(target) {
    const url = parse(target);
    return Object.fromEntries(fields.map(key => [key, url.searchParams.get(key) || ""]));
  }
  return Object.freeze({ fields, apply, read });
});
