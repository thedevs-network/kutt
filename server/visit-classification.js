const { isbot } = require("isbot");
function userAgent(value) { return typeof value === "string" ? value.slice(0, 1000) : ""; }
function human(value) { return !isbot(userAgent(value)); }
module.exports = { userAgent, human };
