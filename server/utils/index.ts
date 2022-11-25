import ms from "ms";
import nanoid from "nanoid";
import JWT from "jsonwebtoken";
import {
  differenceInDays,
  differenceInHours,
  differenceInMonths,
  addDays
} from "date-fns";

import query from "../queries";
import env from "../env";

export class CustomError extends Error {
  public statusCode?: number;
  public data?: any;
  public constructor(message: string, statusCode = 500, data?: any) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.data = data;
  }
}

export const isAdmin = (email: string): boolean =>
  env.ADMIN_EMAILS.split(",")
    .map((e) => e.trim())
    .includes(email);

export const signToken = (user: UserJoined) =>
  JWT.sign(
    {
      iss: "ApiAuth",
      sub: user.email,
      domain: user.domain || "",
      admin: isAdmin(user.email),
      iat: parseInt((new Date().getTime() / 1000).toFixed(0)),
      exp: parseInt((addDays(new Date(), 7).getTime() / 1000).toFixed(0))
    } as Record<string, any>,
    env.JWT_SECRET
  );

export const generateId = async (domain_id: number = null) => {
  const address = nanoid(
    "abcdefghkmnpqrstuvwxyzABCDEFGHKLMNPQRSTUVWXYZ23456789",
    env.LINK_LENGTH
  );
  const link = await query.link.find({ address, domain_id });
  if (!link) return address;
  return generateId(domain_id);
};

export const addProtocol = (url: string): string => {
  const hasProtocol = /^\w+:\/\//.test(url);
  return hasProtocol ? url : `http://${url}`;
};

export const generateShortLink = (id: string, domain?: string): string => {
  const protocol =
    env.CUSTOM_DOMAIN_USE_HTTPS || !domain ? "https://" : "http://";
  return `${protocol}${domain || env.DEFAULT_DOMAIN}/${id}`;
};

export const getRedisKey = {
  // TODO: remove user id and make domain id required
  link: (address: string, domain_id?: number, user_id?: number) =>
    `${address}-${domain_id || ""}-${user_id || ""}`,
  domain: (address: string) => `d-${address}`,
  host: (address: string) => `h-${address}`,
  user: (emailOrKey: string) => `u-${emailOrKey}`
};

// TODO: Add statsLimit
export const getStatsLimit = (): number =>
  env.DEFAULT_MAX_STATS_PER_LINK || 100000000;

export const getStatsCacheTime = (total?: number): number => {
  return (total > 50000 ? ms("5 minutes") : ms("1 minutes")) / 1000;
};

export const statsObjectToArray = (obj: Stats) => {
  const objToArr = (key) =>
    Array.from(Object.keys(obj[key]))
      .map((name) => ({
        name,
        value: obj[key][name]
      }))
      .sort((a, b) => b.value - a.value);

  return {
    browser: objToArr("browser"),
    os: objToArr("os"),
    country: objToArr("country"),
    referrer: objToArr("referrer")
  };
};

export const getDifferenceFunction = (
  type: "lastDay" | "lastWeek" | "lastMonth" | "allTime"
) => {
  if (type === "lastDay") return differenceInHours;
  if (type === "lastWeek") return differenceInDays;
  if (type === "lastMonth") return differenceInDays;
  if (type === "allTime") return differenceInMonths;
  throw new Error("Unknown type.");
};

export const getUTCDate = (dateString?: Date) => {
  const date = new Date(dateString || Date.now());
  return new Date(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    date.getUTCHours()
  );
};

export const STATS_PERIODS: [number, "lastDay" | "lastWeek" | "lastMonth"][] = [
  [1, "lastDay"],
  [7, "lastWeek"],
  [30, "lastMonth"]
];

export const getInitStats = (): Stats => {
  return Object.create({
    browser: {
      chrome: 0,
      edge: 0,
      firefox: 0,
      ie: 0,
      opera: 0,
      other: 0,
      safari: 0
    },
    os: {
      android: 0,
      ios: 0,
      linux: 0,
      macos: 0,
      other: 0,
      windows: 0
    },
    country: {},
    referrer: {}
  });
};

export const sanitize = {
  domain: (domain: Domain): DomainSanitized => ({
    ...domain,
    id: domain.uuid,
    uuid: undefined,
    user_id: undefined,
    banned_by_id: undefined
  }),
  link: (link: LinkJoinedDomain): LinkSanitized => ({
    ...link,
    banned_by_id: undefined,
    domain_id: undefined,
    user_id: undefined,
    uuid: undefined,
    id: link.uuid,
    password: !!link.password,
    link: generateShortLink(link.address, link.domain)
  })
};

export const removeWww = (host = "") => {
  return host.replace("www.", "");
};
