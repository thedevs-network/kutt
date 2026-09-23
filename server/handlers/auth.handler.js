const i18n = require("../i18n");
const { differenceInDays, addMinutes } = require("date-fns");
const { nanoid } = require("nanoid");
const passport = require("passport");
const { randomUUID } = require("node:crypto");
const bcrypt = require("bcryptjs");

const { ROLES } = require("../consts");
const query = require("../queries");
const utils = require("../utils");
const redis = require("../redis");
const mail = require("../mail");
const env = require("../env");

const CustomError = utils.CustomError;

function authenticate(type, error, isStrict, redirect) {
  return function auth(req, res, next) {
    if (req.publicHost) {
      if (!isStrict) return next();
      return res.status(404).set("Cache-Control", "no-store").end();
    }
    if (req.user) return next();

    passport.authenticate(type, (err, user, info) => {
      if (
        (err || info instanceof Error) &&
        type === "oidc"
      ) {
        require("../oidc-client").failure(err?.authCode || info?.authCode);
        res.status(401).set("Cache-Control", "no-store");
        return next(new CustomError(i18n.t("messages.oidc_authentication_failed"), 401));
      };

      if (err) return next(err);

      if (
        req.isHTML &&
        redirect &&
        ((!user && isStrict) ||
        (user && isStrict && !user.verified) ||
        (user && user.banned))
      ) {
        if (redirect === "page") {
          res.redirect("/logout");
          return;
        }
        if (redirect === "header") {
          res.setHeader("HX-Redirect", "/logout");
          res.send("NOT_AUTHENTICATED");
          return;
        }
      }
      
      if (!user && isStrict) {
        throw new CustomError(i18n.t(error), 401);
      }

      if (user && user.banned) {
        throw new CustomError(i18n.t("messages.you_re_banned_from_using_this_website"), 403);
      }

      if (user && isStrict && !user.verified) {
        throw new CustomError(i18n.t("auth.email_unverified"), 400);
      }

      if (user) {
        req.authMethod = type;
        req.authInfo = info || {};
        res.locals.isAdmin = utils.isAdmin(user);
        req.user = {
          ...user,
          admin: utils.isAdmin(user)
        };

        // renew token if it's been at least one day since the token has been created
        // only do it for html page requests not api requests
        if (info?.exp && req.isHTML && redirect === "page") {
          const diff = Math.abs(differenceInDays(new Date(info.exp * 1000), new Date()));
          if (diff < 6) {
            const token = utils.signToken(user, info);
            utils.deleteCurrentToken(res);
            utils.setToken(res, token);
          }
        }
      }
      return next();
    })(req, res, next);
  }
}

const local = authenticate("local", "messages.login_credentials_are_wrong", true, null);
const jwt = authenticate("jwt", "messages.unauthorized", true, "header");
const jwtPage = authenticate("jwt", "messages.unauthorized", true, "page");
const jwtLoose = authenticate("jwt", "messages.unauthorized", false, "header");
const jwtLoosePage = authenticate("jwt", "messages.unauthorized", false, "page");
const apikey = authenticate("localapikey", "messages.api_key_is_not_correct", false, null);
const oidc = authenticate("oidc", "messages.unauthorized_2", true, "page");

async function admin(req, res, next) {
  const current = req.user && !req.apiToken && await require("../oidc-roles").fresh(
    await require("../knex")("users").where({ id: req.user.id }).first());
  if (current && !current.banned && current.verified && current.role === ROLES.ADMIN &&
      Number(current.auth_version) === Number(req.user.auth_version)) {
    req.user = { ...current, admin: true };
    res.locals.canCreateLocalAdmin = await require("../oidc-roles").canCreateLocalAdmin(current);
    return next();
  }
  throw new CustomError(i18n.t("messages.unauthorized_2"), 401);
}

function sessionOrigin(req, res, next) {
  // Exempt only the credential that actually selected the principal. JWT-only
  // routes must not let an ignored (even valid) foreign API key bypass CSRF.
  if (req.user && !req.apiToken && req.authMethod !== "localapikey") {
    require("./link-history.handler").sameOrigin(req);
  }
  next();
}

async function signup(req, res) {
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(req.body.password, salt);
  
  const user = await query.user.add(
    { email: req.body.email, password },
    req.user
  );
  
  await mail.verification(user);

  if (req.isHTML) {
    res.render("partials/auth/verify");
    return;
  }
  
  return res.status(201).send({ message: i18n.t("messages.a_verification_email_has_been_sent") });
}

function completeBrowserLogin(req, res, token) {
  utils.setToken(res, token);
  // A full document navigation avoids reinjecting layout scripts into HTMX's
  // active document and racing its pending table initialization.
  if (req.get("HX-Request") === "true") return res.set("HX-Redirect", "/").status(204).end();
  return res.redirect(303, "/");
}

async function createAdminUser(req, res) {
  const isThereAUser = await query.user.findAny();
  if (isThereAUser) {
    throw new CustomError(i18n.t("messages.can_not_create_the_admin_user_because_a_user_already_exists"), 400);
  }
  
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(req.body.password, salt);

  const user = await query.user.add({
    email: req.body.email, 
    password, 
    role: ROLES.ADMIN, 
    verified: true 
  });

  const token = utils.signToken(user);

  if (req.isHTML) {
    return completeBrowserLogin(req, res, token);
  }
  
  return res.status(201).send({ token });
}

function login(req, res) {
  const token = utils.signToken(req.user, req.authInfo);

  if (req.isHTML) {
    return completeBrowserLogin(req, res, token);
  }
  
  return res.status(200).send({ token });
}

async function verify(req, res, next) {
  if (req.method === "HEAD") return next();
  if (!req.params.verificationToken) return next();

  const user = await query.user.update(
    {
      verification_token: req.params.verificationToken,
      verification_expires: [">", utils.dateToUTC(new Date())]
    },
    {
      verified: true,
      verification_token: null,
      verification_expires: null
    }
  );
  
  if (user) {
    res.locals.token_verified = true;
  }
  
  return next();
}

async function changePassword(req, res) {
  const isMatch = await bcrypt.compare(req.body.currentpassword, req.user.password);
  if (!isMatch) {
    const message = i18n.t("messages.current_password_is_not_correct");
    res.locals.errors = { currentpassword: message };
    throw new CustomError(message, 401);
  }

  const salt = await bcrypt.genSalt(12);
  const newpassword = await bcrypt.hash(req.body.newpassword, salt);
  
  const user = await query.user.update({ id: req.user.id, auth_version: req.user.auth_version }, { password: newpassword });
  
  if (!user) {
    throw new CustomError(i18n.t("messages.couldn_t_change_the_password_try_again_later"));
  }

  if (req.isHTML) {
    res.setHeader("HX-Trigger-After-Swap", "resetChangePasswordForm");
    res.render("partials/settings/change_password", {
      success: i18n.t("messages.password_has_been_changed")
    });
    return;
  }
  
  return res
    .status(200)
    .send({ message: i18n.t("messages.your_password_has_been_changed_successfully") });
}

async function generateApiKey(req, res) {
  const apikey = nanoid(40);
  
  if (env.REDIS_ENABLED) {
    redis.remove.user(req.user);
  }
  
  const user = await query.user.update({ id: req.user.id, auth_version: req.user.auth_version }, { apikey });
  
  if (!user) {
    throw new CustomError(i18n.t("messages.couldn_t_generate_api_key_please_try_again_later"));
  }

  if (req.isHTML) {
    res.render("partials/settings/apikey", {
      user: { apikey },
    });
    return;
  }
  
  return res.status(201).send({ apikey });
}

async function resetPassword(req, res) {
  const user = await query.user.update(
    { email: req.body.email },
    {
      reset_password_token: randomUUID(),
      reset_password_expires: utils.dateToUTC(addMinutes(new Date(), 30))
    }
  );

  if (user) {
    mail.resetPasswordToken(user).catch(error => {
      console.error("Send reset-password token email error:\n", error);
    });
  }

  if (req.isHTML) {
    res.render("partials/reset_password/request_form", {
      message: i18n.t("messages.if_the_email_address_exists_a_reset_password_email_will_be")
    });
    return;
  }
  
  return res.status(200).send({
    message: i18n.t("messages.if_email_address_exists_a_reset_password_email_has_been_sent")
  });
}

async function newPassword(req, res) {
  const { new_password, reset_password_token } = req.body;
  const match = { reset_password_token, reset_password_expires: [">", utils.dateToUTC(new Date())] };
  if (!await query.user.find(match)) {
    throw new CustomError(i18n.t("messages.could_not_set_the_password_please_try_again_later"), 400);
  }
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(new_password, salt);
  
  const user = await query.user.update(
    {
      reset_password_token,
      reset_password_expires: [">", utils.dateToUTC(new Date())]
    },
    { 
      reset_password_expires: null, 
      reset_password_token: null,
      password,
    }
  );

  if (!user) {
    throw new CustomError(i18n.t("messages.could_not_set_the_password_please_try_again_later"), 400);
  }

  res.render("partials/reset_password/new_password_success");
}

async function changeEmailRequest(req, res) {
  const { email, password } = req.body;
  
  const isMatch = await bcrypt.compare(password, req.user.password);
  
  if (!isMatch) {
    const error = i18n.t("messages.password_is_not_correct");
    res.locals.errors = { password: error };
    throw new CustomError(error, 401);
  }
  
  const user = await query.user.find({ email });
  
  if (user) {
    const error = i18n.t("messages.can_t_use_this_email_address");
    res.locals.errors = { email: error };
    throw new CustomError(error, 400);
  }
  
  const updatedUser = await query.user.update(
    { id: req.user.id, auth_version: req.user.auth_version },
    {
      change_email_address: email,
      change_email_token: randomUUID(),
      change_email_expires: utils.dateToUTC(addMinutes(new Date(), 30))
    }
  );
  
  if (updatedUser) {
    await mail.changeEmail({ ...updatedUser, email });
  } else {
    throw new CustomError(i18n.t("messages.sign_in_again_before_changing_your_email_address"), 401);
  }

  const message = i18n.t("messages.a_verification_link_has_been_sent_to_the_requested_email_address")
  
  if (req.isHTML) {
    res.setHeader("HX-Trigger-After-Swap", "resetChangeEmailForm");
    res.render("partials/settings/change_email", {
      success: message
    });
    return;
  }
  
  return res.status(200).send({ message });
}

async function changeEmail(req, res, next) {
  if (req.method === "HEAD") return next();
  const changeEmailToken = req.params.changeEmailToken;
  
  if (changeEmailToken) {
    const foundUser = await query.user.find({
      change_email_token: changeEmailToken,
      change_email_expires: [">", utils.dateToUTC(new Date())]
    });
  
    if (!foundUser) return next();
  
    const user = await query.user.update(
      { id: foundUser.id, auth_version: foundUser.auth_version, change_email_token: changeEmailToken,
        change_email_expires: [">", utils.dateToUTC(new Date())] },
      {
        change_email_token: null,
        change_email_expires: null,
        change_email_address: null,
        email: foundUser.change_email_address
      }
    );
  
    if (user) {
      res.locals.token_verified = true;
    }
  }
  return next();
}

function featureAccess(features, redirect) {
  return function(req, res, next) {
    for (let i = 0; i < features.length; ++i) {
      if (!features[i]) {
        if (redirect) {
          return res.redirect("/");
        } else {
          throw new CustomError(i18n.t("messages.request_is_not_allowed"), 400);
        }
      } 
    }
    next();
  }
}

function featureAccessPage(features) {
  return featureAccess(features, true);
}

module.exports = {
  admin,
  sessionOrigin,
  apikey,
  changeEmail,
  changeEmailRequest,
  changePassword,
  createAdminUser,
  featureAccess,
  featureAccessPage,
  generateApiKey,
  jwt,
  jwtLoose,
  jwtLoosePage,
  jwtPage,
  local,
  login,
  newPassword,
  oidc,
  resetPassword,
  signup,
  verify,
}
