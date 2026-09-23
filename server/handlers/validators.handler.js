const i18n = require("../i18n");
const { addMilliseconds } = require("date-fns");
const { body, param, query: queryValidator } = require("express-validator");
const promisify = require("node:util").promisify;
const bcrypt = require("bcryptjs");
const dns = require("node:dns");
const URL = require("node:url");
const ms = require("ms");

const { ROLES } = require("../consts");
const query = require("../queries");
const utils = require("../utils");
const knex = require("../knex");
const env = require("../env");

const dnsLookup = promisify(dns.lookup);

const checkUser = (value, { req }) => !!req.user;
const sanitizeCheckbox = value => value === true || value === "on" || value;

const createLink = [
  body("target")
    .exists({ checkNull: true, checkFalsy: true })
    .withMessage(() => i18n.t("messages.target_is_missing"))
    .isString().bail()
    .trim()
    .isLength({ min: 1, max: 2040 })
    .withMessage(() => i18n.t("messages.maximum_url_length_is_2040"))
    .bail()
    .customSanitizer(utils.addProtocol)
    .custom(value => utils.urlRegex.test(value) || /^(?!https?|ftp)(\w+:|\/\/)/.test(value))
    .withMessage(() => i18n.t("messages.url_is_not_valid"))
    .custom(value => utils.removeWww(URL.parse(value).host) !== env.DEFAULT_DOMAIN)
    .withMessage(() => i18n.t("messages.value_urls_are_not_allowed", {value1: env.DEFAULT_DOMAIN})).bail()
    .custom(value => !!require("../destination-policy").requireAllowed(value)),
  body("password")
    .optional({ nullable: true, checkFalsy: true })
    .custom(checkUser)
    .withMessage(() => i18n.t("messages.only_users_can_use_this_field"))
    .isString()
    .isLength({ min: 3, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_3_and_64")),
  body("customurl")
    .optional({ nullable: true, checkFalsy: true })
    .custom(checkUser)
    .withMessage(() => i18n.t("messages.only_users_can_use_this_field"))
    .isString().bail()
    .custom(value => !/[\u0000-\u001f\u007f]/.test(value))
    .withMessage(() => i18n.t("messages.custom_url_is_not_valid")).bail()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage(() => i18n.t("messages.custom_url_length_must_be_between_1_and_64"))
    .custom(value => require("../link-alias").valid(value))
    .withMessage(() => i18n.t("messages.custom_url_is_not_valid"))
    .custom(value => !utils.preservedURLs.some(url => url.toLowerCase() === value))
    .withMessage(() => i18n.t("messages.you_can_t_use_this_custom_url")),
  body("reuse")
    .optional({ nullable: true })
    .custom(checkUser)
    .withMessage(() => i18n.t("messages.only_users_can_use_this_field"))
    .isBoolean()
    .withMessage(() => i18n.t("messages.reuse_must_be_boolean")),
  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 1, max: 2040 })
    .withMessage(() => i18n.t("messages.description_length_must_be_between_1_and_2040")),
  body("expire_in")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .custom(value => {
      try {
        return !!ms(value);
      } catch {
        return false;
      }
    })
    .withMessage(() => i18n.t("messages.expire_format_is_invalid_valid_examples_1m_8h_42_days"))
    .customSanitizer(ms)
    .custom(value => value >= ms("1m"))
    .withMessage(() => i18n.t("messages.expire_time_should_be_more_than_1_minute"))
    .customSanitizer(value => utils.dateToUTC(addMilliseconds(new Date(), value))),
  body("domain")
    .optional({ nullable: true, checkFalsy: true })
    .customSanitizer(value => value === env.DEFAULT_DOMAIN ? null : value)
    .custom(checkUser)
    .withMessage(() => i18n.t("messages.only_users_can_use_this_field"))
    .isString()
    .withMessage(() => i18n.t("messages.domain_should_be_string"))
    .customSanitizer(value => value.toLowerCase())
    .custom(async (address, { req }) => {
      const domain = await require("../domain-access").find(knex, req.user.id, { address });
      req.body.fetched_domain = domain || null;

      if (!domain) return Promise.reject();
    })
    .withMessage(() => i18n.t("messages.you_can_t_use_this_domain"))
];

const editLink = [
  body("target")
    .optional({ checkFalsy: true, nullable: true })
    .isString().bail()
    .trim()
    .isLength({ min: 1, max: 2040 })
    .withMessage(() => i18n.t("messages.maximum_url_length_is_2040"))
    .bail()
    .customSanitizer(utils.addProtocol)
    .custom(value => utils.urlRegex.test(value) || /^(?!https?|ftp)(\w+:|\/\/)/.test(value))
    .withMessage(() => i18n.t("messages.url_is_not_valid"))
    .custom(value => utils.removeWww(URL.parse(value).host) !== env.DEFAULT_DOMAIN)
    .withMessage(() => i18n.t("messages.value_urls_are_not_allowed", {value1: env.DEFAULT_DOMAIN})),
  body("password")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .isLength({ min: 3, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_3_and_64")),
  body("address")
    .optional({ checkFalsy: true, nullable: true })
    .isString().bail()
    .custom(value => !/[\u0000-\u001f\u007f]/.test(value))
    .withMessage(() => i18n.t("messages.custom_url_is_not_valid_2")).bail()
    .trim()
    .isLength({ min: 1, max: 64 })
    .withMessage(() => i18n.t("messages.custom_url_length_must_be_between_1_and_64"))
    .custom(value => require("../link-alias").valid(value))
    .withMessage(() => i18n.t("messages.custom_url_is_not_valid_2"))
    .custom(value => !utils.preservedURLs.some(url => url.toLowerCase() === value))
    .withMessage(() => i18n.t("messages.you_can_t_use_this_custom_url")),
  body("expire_in")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .custom(value => {
      try {
        return !!ms(value);
      } catch {
        return false;
      }
    })
    .withMessage(() => i18n.t("messages.expire_format_is_invalid_valid_examples_1m_8h_42_days"))
    .customSanitizer(ms)
    .custom(value => value >= ms("1m"))
    .withMessage(() => i18n.t("messages.expire_time_should_be_more_than_1_minute"))
    .customSanitizer(value => utils.dateToUTC(addMilliseconds(new Date(), value))),
  body("description")
    .optional({ nullable: true, checkFalsy: true })
    .isString()
    .trim()
    .isLength({ min: 0, max: 2040 })
    .withMessage(() => i18n.t("messages.description_length_must_be_between_0_and_2040")),
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 36, max: 36 })
];

const redirectProtected = [
  body("password", () => i18n.t("messages.password_is_invalid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isString()
    .isLength({ min: 3, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_3_and_64")),
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 36, max: 36 })
];

const addDomain = [
  body("address", () => i18n.t("messages.domain_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isString().bail()
    .isLength({ min: 3, max: 64 })
    .withMessage(() => i18n.t("messages.domain_length_must_be_between_3_and_64")).bail()
    .trim()
    .customSanitizer(utils.addProtocol)
    .custom(value => utils.urlRegex.test(value)).bail()
    .customSanitizer(value => {
      const parsed = URL.parse(value);
      return utils.removeWww(parsed.hostname || parsed.href);
    })
    .custom(value => value !== env.DEFAULT_DOMAIN)
    .withMessage(() => i18n.t("messages.you_can_t_use_the_default_domain"))
    .custom(value => !require("../management-origin").reserved(value))
    .withMessage(() => i18n.t("domain_grants.management_reserved"))
    .custom(async value => {
      const domain = await query.domain.find({ address: value });
      if (domain?.user_id || domain?.banned) return Promise.reject();
    })
    .withMessage(() => i18n.t("messages.you_can_t_add_this_domain")),
  body("homepage")
    .optional({ checkFalsy: true, nullable: true })
    .isString().bail()
    .isLength({ max: 2040 }).withMessage(() => i18n.t("messages.maximum_homepage_url_length_is_2040")).bail()
    .customSanitizer(utils.addProtocol)
    .custom(value => utils.urlRegex.test(value) || /^(?!https?|ftp)(\w+:|\/\/)/.test(value))
    .withMessage(() => i18n.t("messages.homepage_is_not_valid")).bail()
    .custom(value => !!require("../destination-policy").requireAllowed(value))
];

const addDomainAdmin = [
  body("address", () => i18n.t("messages.domain_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isString().bail()
    .isLength({ min: 3, max: 64 })
    .withMessage(() => i18n.t("messages.domain_length_must_be_between_3_and_64")).bail()
    .trim()
    .customSanitizer(utils.addProtocol)
    .custom(value => utils.urlRegex.test(value)).bail()
    .customSanitizer(value => {
      const parsed = URL.parse(value);
      return utils.removeWww(parsed.hostname || parsed.href);
    })
    .custom(value => value !== env.DEFAULT_DOMAIN)
    .withMessage(() => i18n.t("messages.you_can_t_add_the_default_domain"))
    .custom(value => !require("../management-origin").reserved(value))
    .withMessage(() => i18n.t("domain_grants.management_reserved"))
    .custom(async value => {
      const domain = await query.domain.find({ address: value });
      if (domain) return Promise.reject();
    })
    .withMessage(() => i18n.t("messages.domain_already_exists")),
  body("homepage")
    .optional({ checkFalsy: true, nullable: true })
    .isString().bail()
    .isLength({ max: 2040 }).withMessage(() => i18n.t("messages.maximum_homepage_url_length_is_2040")).bail()
    .customSanitizer(utils.addProtocol)
    .custom(value => utils.urlRegex.test(value) || /^(?!https?|ftp)(\w+:|\/\/)/.test(value))
    .withMessage(() => i18n.t("messages.homepage_is_not_valid")).bail()
    .custom(value => !!require("../destination-policy").requireAllowed(value)),
  body("banned")
    .optional({ nullable: true })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean().toBoolean(),
]

const removeDomain = [
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

const removeDomainAdmin = [
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isNumeric(),
  queryValidator("links")
    .optional({ nullable: true })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean()
    .toBoolean(),
];

const deleteLink = [
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

const reportLink = [
  body("link", () => i18n.t("messages.no_link_has_been_provided"))
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isString().bail()
    .isLength({ max: 4096 }).bail()
    .custom(value => !/[\u0000-\u0020\u007f<>]/.test(value)).bail()
    .customSanitizer(utils.addProtocol)
    .custom(
      value => {
        const parsed = new URL.URL(value);
        return ["https:", "http:"].includes(parsed.protocol) && !parsed.username && !parsed.password &&
          utils.removeWww(parsed.host) === env.DEFAULT_DOMAIN;
      }
    )
    .withMessage(() => i18n.t("messages.you_can_only_report_a_value_link", {value1: env.DEFAULT_DOMAIN}))
];

const banLink = [
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 }),
  body("host", () => i18n.t("messages.host_should_be_a_boolean"))
    .optional({
      nullable: true
    })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean(),
  body("user", () => i18n.t("messages.user_should_be_a_boolean"))
    .optional({
      nullable: true
    })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean(),
  body("userLinks", () => i18n.t("messages.userlinks_should_be_a_boolean"))
    .optional({
      nullable: true
    })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean(),
  body("domain", () => i18n.t("messages.domain_should_be_a_boolean"))
    .optional({
      nullable: true
    })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean()
];

const banUser = [
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isNumeric(),
  body("links", () => i18n.t("messages.links_should_be_a_boolean"))
    .optional({
      nullable: true
    })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean(),
  body("domains", () => i18n.t("messages.domains_should_be_a_boolean"))
    .optional({
      nullable: true
    })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean()
];

const banDomain = [
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isNumeric(),
  body("links", () => i18n.t("messages.links_should_be_a_boolean"))
    .optional({
      nullable: true
    })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean(),
  body("user", () => i18n.t("messages.user_should_be_a_boolean"))
    .optional({
      nullable: true
    })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean()
];

const createUser = [
  body("password", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_8_and_64")),
  body("email", () => i18n.t("messages.email_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage(() => i18n.t("messages.email_length_must_be_max_255"))
    .isEmail()
    .custom(async (value, { req }) => {
      const user = await query.user.find({ email: value });
      if (user) 
        return Promise.reject();
    })
    .withMessage(() => i18n.t("messages.user_already_exists")),
  body("role", () => i18n.t("messages.role_is_not_valid"))
    .optional({ nullable: true, checkFalsy: true })
    .trim()
    .isIn([ROLES.USER, ROLES.ADMIN]),
  body("verified")
    .optional({ nullable: true })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean().toBoolean(),
  body("banned")
    .optional({ nullable: true })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean().toBoolean(),
  body("verification_email")
    .optional({ nullable: true })
    .customSanitizer(sanitizeCheckbox)
    .isBoolean().toBoolean(),
];

const getStats = [
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({
      checkFalsy: true,
      checkNull: true
    })
    .isLength({ min: 36, max: 36 })
];

const signup = [
  body("password", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_8_and_64")),
  body("email", () => i18n.t("messages.email_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isLength({ min: 0, max: 255 })
    .withMessage(() => i18n.t("messages.email_length_must_be_max_255"))
    .isEmail()
];

const signupEmailTaken = [
  body("email", () => i18n.t("messages.email_is_not_valid"))
    .custom(async (value, { req }) => {
      const user = await query.user.find({ email: value });

      if (user) {
        req.user = user;
      }

      if (user?.verified) {
        return Promise.reject();
      }
    })
    .withMessage(() => i18n.t("messages.you_can_t_use_this_email_address"))
];

const login = [
  body("password", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_8_and_64")),
  body("email", () => i18n.t("messages.email_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage(() => i18n.t("messages.email_length_must_be_max_255"))
    .isEmail()
];

const createAdmin = [
  body("password", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_8_and_64")),
  body("email", () => i18n.t("messages.email_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isLength({ min: 0, max: 255 })
    .withMessage(() => i18n.t("messages.email_length_must_be_max_255"))
    .isEmail()
];

const changePassword = [
  body("currentpassword", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_8_and_64")),
  body("newpassword", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_8_and_64"))
];

const changeEmail = [
  body("password", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_8_and_64")),
  body("email", () => i18n.t("messages.email_address_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isLength({ min: 1, max: 255 })
    .withMessage(() => i18n.t("messages.email_length_must_be_max_255"))
    .isEmail()
];

const resetPassword = [
  body("email", () => i18n.t("messages.email_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .trim()
    .isLength({ min: 0, max: 255 })
    .withMessage(() => i18n.t("messages.email_length_must_be_max_255"))
    .isEmail()
];

const newPassword = [
  body("reset_password_token", () => i18n.t("messages.reset_password_token_is_invalid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 36, max: 36 }),
  body("new_password", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .withMessage(() => i18n.t("messages.password_length_must_be_between_8_and_64")),
  body("repeat_password", () => i18n.t("messages.password_is_not_valid"))
    .custom((repeat_password, { req }) => {
      return repeat_password === req.body.new_password;
    })
    .withMessage(() => i18n.t("messages.passwords_don_t_match")),
];

const deleteUser = [
  body("password", () => i18n.t("messages.password_is_not_valid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isLength({ min: 8, max: 64 })
    .custom(async (password, { req }) => {
      const isMatch = await bcrypt.compare(password, req.user.password);
      if (!isMatch) return Promise.reject();
    })
    .withMessage(() => i18n.t("messages.password_is_not_correct"))
];

const deleteUserByAdmin = [
  param("id", () => i18n.t("messages.id_is_invalid"))
    .exists({ checkFalsy: true, checkNull: true })
    .isNumeric()
];

async function bannedDomain(domain) {
  const isBanned = await require("../knex")("domains").where({
    address: domain,
    banned: true
  }).first();

  if (isBanned) {
    throw new utils.CustomError(i18n.t("messages.domain_is_banned"), 400);
  }
};

async function bannedHost(domain) {
  let isBanned;

  try {
    const dnsRes = await dnsLookup(domain);

    if (!dnsRes || !dnsRes.address) return;

    isBanned = await require("../knex")("hosts").where({
      address: dnsRes.address,
      banned: true
    }).first();
  } catch (error) {
    isBanned = null;
  }

  if (isBanned) {
    throw new utils.CustomError(i18n.t("messages.url_is_containing_malware_scam"), 400);
  }
};

module.exports = {
  addDomain,
  addDomainAdmin,
  banDomain,
  banLink,
  banUser,
  bannedDomain,
  bannedHost,
  changeEmail,
  changePassword,
  checkUser,
  createAdmin,
  createLink,
  createUser,
  deleteLink,
  deleteUser,
  deleteUserByAdmin,
  editLink,
  getStats,
  login, 
  newPassword,
  redirectProtected,
  removeDomain,
  removeDomainAdmin,
  reportLink,
  resetPassword,
  signup,
  signupEmailTaken,
}
