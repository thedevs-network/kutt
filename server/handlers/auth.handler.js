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
    if (req.user) return next();
    
    passport.authenticate(type, (err, user, info) => {
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
        throw new CustomError(error, 401);
      }

      if (user && user.banned) {
        throw new CustomError("You're banned from using this website.", 403);
      }

      if (user && isStrict && !user.verified) {
        throw new CustomError("Your email address is not verified. " +
          "Sign up to get the verification link again.", 400);
      }

      if (user) {
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
            const token = utils.signToken(user);
            utils.deleteCurrentToken(res);
            utils.setToken(res, token);
          }
        }
      }
      return next();
    })(req, res, next);
  }
}

const local = authenticate("local", "Login credentials are wrong.", true, null);
const jwt = authenticate("jwt", "Unauthorized.", true, "header");
const jwtPage = authenticate("jwt", "Unauthorized.", true, "page");
const jwtLoose = authenticate("jwt", "Unauthorized.", false, "header");
const jwtLoosePage = authenticate("jwt", "Unauthorized.", false, "page");
const apikey = authenticate("localapikey", "API key is not correct.", false, null);

function admin(req, res, next) {
  if (req.user.admin) return next();
  throw new CustomError("Unauthorized", 401);
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
  
  return res.status(201).send({ message: "A verification email has been sent." });
}

async function createAdminUser(req, res) {
  const isThereAUser = await query.user.findAny();
  if (isThereAUser) {
    throw new CustomError("Can not create the admin user because a user already exists.", 400);
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
    utils.setToken(res, token);
    res.render("partials/auth/welcome");
    return;
  }
  
  return res.status(201).send({ token });
}

function login(req, res) {
  const token = utils.signToken(req.user);

  if (req.isHTML) {
    utils.setToken(res, token);
    res.render("partials/auth/welcome");
    return;
  }
  
  return res.status(200).send({ token });
}

async function verify(req, res, next) {
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
    const token = utils.signToken(user);
    utils.deleteCurrentToken(res);
    utils.setToken(res, token);
    res.locals.token_verified = true;
    req.cookies.token = token;
  }
  
  return next();
}

async function changePassword(req, res) {
  const isMatch = await bcrypt.compare(req.body.currentpassword, req.user.password);
  if (!isMatch) {
    const message = "Current password is not correct.";
    res.locals.errors = { currentpassword: message };
    throw new CustomError(message, 401);
  }

  const salt = await bcrypt.genSalt(12);
  const newpassword = await bcrypt.hash(req.body.newpassword, salt);
  
  const user = await query.user.update({ id: req.user.id }, { password: newpassword });
  
  if (!user) {
    throw new CustomError("Couldn't change the password. Try again later.");
  }

  if (req.isHTML) {
    res.setHeader("HX-Trigger-After-Swap", "resetChangePasswordForm");
    res.render("partials/settings/change_password", {
      success: "Password has been changed."
    });
    return;
  }
  
  return res
    .status(200)
    .send({ message: "Your password has been changed successfully." });
}

async function generateApiKey(req, res) {
  const apikey = nanoid(40);
  
  if (env.REDIS_ENABLED) {
    redis.remove.user(req.user);
  }
  
  const user = await query.user.update({ id: req.user.id }, { apikey });
  
  if (!user) {
    throw new CustomError("Couldn't generate API key. Please try again later.");
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
      message: "If the email address exists, a reset password email will be sent to it."
    });
    return;
  }
  
  return res.status(200).send({
    message: "If email address exists, a reset password email has been sent."
  });
}

async function newPassword(req, res) {
  const { new_password, reset_password_token } = req.body;

  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(req.body.new_password, salt);
  
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
    throw new CustomError("Could not set the password. Please try again later.");
  }

  res.render("partials/reset_password/new_password_success");
}

async function changeEmailRequest(req, res) {
  const { email, password } = req.body;
  
  const isMatch = await bcrypt.compare(password, req.user.password);
  
  if (!isMatch) {
    const error = "Password is not correct.";
    res.locals.errors = { password: error };
    throw new CustomError(error, 401);
  }
  
  const user = await query.user.find({ email });
  
  if (user) {
    const error = "Can't use this email address.";
    res.locals.errors = { email: error };
    throw new CustomError(error, 400);
  }
  
  const updatedUser = await query.user.update(
    { id: req.user.id },
    {
      change_email_address: email,
      change_email_token: randomUUID(),
      change_email_expires: utils.dateToUTC(addMinutes(new Date(), 30))
    }
  );
  
  if (updatedUser) {
    await mail.changeEmail({ ...updatedUser, email });
  }

  const message = "A verification link has been sent to the requested email address."
  
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
  const changeEmailToken = req.params.changeEmailToken;
  
  if (changeEmailToken) {
    const foundUser = await query.user.find({
      change_email_token: changeEmailToken,
      change_email_expires: [">", utils.dateToUTC(new Date())]
    });
  
    if (!foundUser) return next();
  
    const user = await query.user.update(
      { id: foundUser.id },
      {
        change_email_token: null,
        change_email_expires: null,
        change_email_address: null,
        email: foundUser.change_email_address
      }
    );
  
    if (user) {
      const token = utils.signToken(user);
      utils.deleteCurrentToken(res);
      utils.setToken(res, token);
      res.locals.token_verified = true;
      req.cookies.token = token;
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
          throw new CustomError("Request is not allowed.", 400);
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
  resetPassword,
  signup,
  verify,
}
