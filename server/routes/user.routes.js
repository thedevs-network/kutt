const { Router } = require("express");

const validators = require("../handlers/validators.handler");
const helpers = require("../handlers/helpers.handler");
const asyncHandler = require("../utils/asyncHandler");
const locals = require("../handlers/locals.handler");
const user = require("../handlers/users.handler");
const auth = require("../handlers/auth.handler");

const router = Router();

router.get(
  "/",
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(user.get)
);

router.get(
  "/admin",
  locals.viewTemplate("partials/admin/users/table"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  helpers.parseQuery,
  locals.adminTable,
  asyncHandler(user.getAdmin)
);

router.post(
  "/admin",
  locals.viewTemplate("partials/admin/dialog/create_user"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  validators.createUser,
  asyncHandler(helpers.verify),
  asyncHandler(user.create)
);

router.post(
  "/delete",
  locals.viewTemplate("partials/settings/delete_account"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  validators.deleteUser,
  asyncHandler(helpers.verify),
  asyncHandler(user.remove)
);

router.delete(
  "/admin/:id",
  locals.viewTemplate("partials/admin/dialog/delete_user"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  validators.deleteUserByAdmin,
  asyncHandler(helpers.verify),
  asyncHandler(user.removeByAdmin)
);

router.post(
  "/admin/ban/:id",
  locals.viewTemplate("partials/admin/dialog/ban_user"),
  asyncHandler(auth.apikey),
  asyncHandler(auth.jwt),
  asyncHandler(auth.admin),
  validators.banUser,
  asyncHandler(helpers.verify),
  asyncHandler(user.ban)
);

module.exports = router;
