// A generation change cancels pending account-recovery capabilities as well as sessions.
module.exports = Object.freeze({
  reset_password_token: null,
  reset_password_expires: null,
  change_email_token: null,
  change_email_expires: null,
  change_email_address: null
});
