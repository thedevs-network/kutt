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

export enum Colors {
  Bg = "hsl(206, 12%, 95%)",
  CheckIcon = "hsl(144, 50%, 60%)",
  CopyIcon = "hsl(144, 40%, 57%)",
  CopyIconBg = "hsl(144, 100%, 96%)",
  Divider = "hsl(200, 20%, 92%)",
  EditIcon = "hsl(46, 90%, 50%)",
  EditIconBg = "hsl(46, 100%, 94%)",
  ExtensionsBg = "hsl(230, 15%, 20%)",
  FeaturesBg = "hsl(230, 15%, 92%)",
  Icon = "hsl(200, 35%, 45%)",
  IconShadow = "hsla(200, 15%, 60%, 0.12)",
  Map0 = "hsl(200, 15%, 92%)",
  Map06 = "hsl(261, 46%, 68%)",
  Map05 = "hsl(261, 46%, 72%)",
  Map04 = "hsl(261, 46%, 76%)",
  Map03 = "hsl(261, 46%, 82%)",
  Map02 = "hsl(261, 46%, 86%)",
  Map01 = "hsl(261, 46%, 90%)",
  PieIcon = "hsl(260, 100%, 69%)",
  PieIconBg = "hsl(260, 100%, 96%)",
  QrCodeIcon = "hsl(0, 0%, 35%)",
  QrCodeIconBg = "hsl(0, 0%, 94%)",
  Spinner = "hsl(200, 15%, 70%)",
  StatsLastUpdateText = "hsl(200, 14%, 60%)",
  StatsTotalUnderline = "hsl(200, 35%, 65%)",
  StopIcon = "hsl(10, 100%, 40%)",
  StopIconBg = "hsl(10, 100%, 96%)",
  TableBorder = "hsl(200, 14%, 90%)",
  TableHeadBg = "hsl(200, 12%, 95%)",
  TableHeadBorder = "hsl(200, 14%, 94%)",
  TableRowHover = "hsl(200, 14%, 98%)",
  TableRowBanned = "hsl(0, 100%, 98%)",
  TableRowBannedHower = "hsl(0, 100%, 96%)",
  TableShadow = "hsla(200, 20%, 70%, 0.3)",
  Text = "hsl(200, 35%, 25%)",
  TrashIcon = "hsl(0, 100%, 69%)",
  TrashIconBg = "hsl(0, 100%, 96%)"
}
