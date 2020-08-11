import getConfig from "next/config";

const { publicRuntimeConfig } = getConfig();

export const DISALLOW_ANONYMOUS_LINKS =
  publicRuntimeConfig.DISALLOW_ANONYMOUS_LINKS === "true";

export const DISALLOW_REGISTRATION =
  publicRuntimeConfig.DISALLOW_REGISTRATION === "true";

export enum API {
  BAN_LINK = "/api/url/admin/ban",
  STATS = "/api/url/stats"
}

export enum APIv2 {
  AuthLogin = "/api/v2/auth/login",
  AuthSignup = "/api/v2/auth/signup",
  AuthRenew = "/api/v2/auth/renew",
  AuthResetPassword = "/api/v2/auth/reset-password",
  AuthChangePassword = "/api/v2/auth/change-password",
  AuthGenerateApikey = "/api/v2/auth/apikey",
  Users = "/api/v2/users",
  Domains = "/api/v2/domains",
  Links = "/api/v2/links"
}
