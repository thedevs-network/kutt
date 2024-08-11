const { differenceInMinutes, addMinutes, subMinutes } = require("date-fns");
const passport = require("passport");
const { v4: uuid } = require("uuid");
const bcrypt = require("bcryptjs");
const nanoid = require("nanoid");
const axios = require("axios");

const { CustomError } = require("../utils");
const query = require("../queries");
const utils = require("../utils");
const redis = require("../redis");
const mail = require("../mail");
const env = require("../env");

function authenticate(type, error, isStrict) {
  return function auth(req, res, next) {
    if (req.user) return next();

    passport.authenticate(type, (err, user) => {
      if (err) return next(err);
      const accepts = req.accepts(["json", "html"]);

      if (!user && isStrict) {
        if (accepts === "html") {
          return utils.sleep(2000).then(() => {
            return res.render("partials/login_signup", {
              layout: null,
              error
            });
          });
        } else {
          throw new CustomError(error, 401);
        }
      }

      if (user && isStrict && !user.verified) {
        const errorMessage = "Your email address is not verified. " +
          "Sign up to get the verification link again."
        if (accepts === "html") {
          return res.render("partials/login_signup", {
            layout: null,
            error: errorMessage
          });
        } else {
          throw new CustomError(errorMessage, 400);
        }
      }

      if (user && user.banned) {
        const errorMessage = "You're banned from using this website.";
        if (accepts === "html") {
          return res.render("partials/login_signup", {
            layout: null,
            error: errorMessage
          });
        } else {
          throw new CustomError(errorMessage, 403);
        }
      }

      if (user) {
        req.user = {
          ...user,
          admin: utils.isAdmin(user.email)
        };
        return next();
      }
      return next();
    })(req, res, next);
  }
}

const local = authenticate("local", "Login credentials are wrong.", true);
const jwt = authenticate("jwt", "Unauthorized.", true);
const jwtLoose = authenticate("jwt", "Unauthorized.", false);
const apikey = authenticate("localapikey", "API key is not correct.", false);

/**
 * @type {import("express").Handler}
 */
async function cooldown(req, res, next) {
  if (env.DISALLOW_ANONYMOUS_LINKS) return next();
  const cooldownConfig = env.NON_USER_COOLDOWN;
  if (req.user || !cooldownConfig) return next();
  
  const ip = await query.ip.find({
    ip: req.realIP.toLowerCase(),
    created_at: [">", subMinutes(new Date(), cooldownConfig).toISOString()]
  });
  
  if (ip) {
    const timeToWait =
      cooldownConfig - differenceInMinutes(new Date(), new Date(ip.created_at));
    throw new CustomError(
      `Non-logged in users are limited. Wait ${timeToWait} minutes or log in.`,
      400
    );
  }
  next();
}

/**
 * @type {import("express").Handler}
 */
function admin(req, res, next) {
  // FIXME: attaching to req is risky, find another way
  if (req.user.admin) return next();
  throw new CustomError("Unauthorized", 401);
}

/**
 * @type {import("express").Handler}
 */
async function signup(req, res) {
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(req.body.password, salt);

  const accepts = req.accepts(["json", "html"]);
  
  const user = await query.user.add(
    { email: req.body.email, password },
    req.user
  );
  
  await mail.verification(user);

  if (accepts === "html") {
    return res.render("partials/signup_verify_email", { layout: null });
  }
  
  return res.status(201).send({ message: "A verification email has been sent." });
}

/**
 * @type {import("express").Handler}
 */
function login(req, res) {
  const token = utils.signToken(req.user);

  const accepts = req.accepts(["json", "html"]);

  if (accepts === "html") {
    res.cookie("token", token, {
      maxAge: 1000 * 60 * 15, // expire after seven days
      httpOnly: true,
      secure: env.isProd
    });
    return res.render("partials/login_welcome", { layout: false });
  }
  
  return res.status(200).send({ token });
}

/**
 * @type {import("express").Handler}
 */
async function verify(req, res, next) {
  if (!req.params.verificationToken) return next();
  
  const [user] = await query.user.update(
    {
      verification_token: req.params.verificationToken,
      verification_expires: [">", new Date().toISOString()]
    },
    {
      verified: true,
      verification_token: null,
      verification_expires: null
    }
  );
  
  if (user) {
    const token = utils.signToken(user);
    req.token = token;
  }
  
  return next();
}

/**
 * @type {import("express").Handler}
 */
async function changePassword(req, res) {
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(req.body.password, salt);
  
  const [user] = await query.user.update({ id: req.user.id }, { password });
  
  if (!user) {
    throw new CustomError("Couldn't change the password. Try again later.");
  }
  
  return res
    .status(200)
    .send({ message: "Your password has been changed successfully." });
}

/**
 * @type {import("express").Handler}
 */
async function generateApiKey(req, res) {
  const apikey = nanoid(40);
  
  redis.remove.user(req.user);
  
  const [user] = await query.user.update({ id: req.user.id }, { apikey });
  
  if (!user) {
    throw new CustomError("Couldn't generate API key. Please try again later.");
  }
  
  return res.status(201).send({ apikey });
}

/**
 * @type {import("express").Handler}
 */
async function resetPasswordRequest(req, res) {
  const [user] = await query.user.update(
    { email: req.body.email },
    {
      reset_password_token: uuid(),
      reset_password_expires: addMinutes(new Date(), 30).toISOString()
    }
  );
  
  if (user) {
    await mail.resetPasswordToken(user);
  }
  
  return res.status(200).send({
    message: "If email address exists, a reset password email has been sent."
  });
}

/**
 * @type {import("express").Handler}
 */
async function resetPassword(req, res, next) {
  const { resetPasswordToken } = req.params;
  
  if (resetPasswordToken) {
    const [user] = await query.user.update(
      {
        reset_password_token: resetPasswordToken,
        reset_password_expires: [">", new Date().toISOString()]
      },
      { reset_password_expires: null, reset_password_token: null }
    );
  
    if (user) {
      const token = utils.signToken(user);
      req.token = token;
    }
  }
  return next();
}

/**
 * @type {import("express").Handler}
 */
function signupAccess(req, res, next) {
  if (!env.DISALLOW_REGISTRATION) return next();
  return res.status(403).send({ message: "Registration is not allowed." });
}

/**
 * @type {import("express").Handler}
 */
async function changeEmailRequest(req, res) {
  const { email, password } = req.body;
  
  const isMatch = await bcrypt.compare(password, req.user.password);
  
  if (!isMatch) {
    throw new CustomError("Password is wrong.", 400);
  }
  
  const currentUser = await query.user.find({ email });
  
  if (currentUser) {
    throw new CustomError("Can't use this email address.", 400);
  }
  
  const [updatedUser] = await query.user.update(
    { id: req.user.id },
    {
      change_email_address: email,
      change_email_token: uuid(),
      change_email_expires: addMinutes(new Date(), 30).toISOString()
    }
  );
  
  redis.remove.user(updatedUser);
  
  if (updatedUser) {
    await mail.changeEmail({ ...updatedUser, email });
  }
  
  return res.status(200).send({
    message:
      "If email address exists, an email " +
      "with a verification link has been sent."
  });
}

/**
 * @type {import("express").Handler}
 */
async function changeEmail(req, res, next) {
  const { changeEmailToken } = req.params;
  
  if (changeEmailToken) {
    const foundUser = await query.user.find({
      change_email_token: changeEmailToken
    });
  
    if (!foundUser) return next();
  
    const [user] = await query.user.update(
      {
        change_email_token: changeEmailToken,
        change_email_expires: [">", new Date().toISOString()]
      },
      {
        change_email_token: null,
        change_email_expires: null,
        change_email_address: null,
        email: foundUser.change_email_address
      }
    );
  
    redis.remove.user(foundUser);
  
    if (user) {
      const token = utils.signToken(user);
      req.token = token;
    }
  }
  return next();
}

module.exports = {
  admin,
  apikey,
  changeEmail,
  changeEmailRequest,
  changePassword,
  cooldown,
  generateApiKey,
  jwt,
  jwtLoose,
  local,
  login,
  resetPassword,
  resetPasswordRequest,
  signup,
  signupAccess,
  verify,
}
