import bcrypt from "bcryptjs";
import { isAfter, subDays, set } from "date-fns";
import knex from "../knex";
import * as redis from "../redis";
import {
  generateShortLink,
  getRedisKey,
  getUTCDate,
  getDifferenceFunction,
  statsObjectToArray
} from "../utils";
import { banDomain } from "./domain";
import { banHost } from "./host";
import { banUser } from "./user";

interface CreateLink extends Link {
  reuse?: boolean;
  domainName?: string;
}

export const createShortLink = async (data: CreateLink, user: UserJoined) => {
  const { id: user_id = null, domain, domain_id = null } =
    user || ({} as UserJoined);
  let password;

  if (data.password) {
    const salt = await bcrypt.genSalt(12);
    password = await bcrypt.hash(data.password, salt);
  }

  const [link]: Link[] = await knex<Link>("links").insert(
    {
      domain_id,
      address: data.address,
      password,
      target: data.target,
      user_id
    },
    "*"
  );

  return {
    ...link,
    password: !!data.password,
    reuse: !!data.reuse,
    shortLink: generateShortLink(data.address, domain),
    shortUrl: generateShortLink(data.address, domain)
  };
};

export const addLinkCount = async (id: number) => {
  return knex<Link>("links")
    .where({ id })
    .increment("visit_count", 1);
};

interface ICreateVisit {
  browser: string;
  country: string;
  domain?: string;
  id: number;
  limit: number;
  os: string;
  referrer: string;
}

export const createVisit = async (params: ICreateVisit) => {
  const data = {
    ...params,
    country: params.country.toLowerCase(),
    referrer: params.referrer.toLowerCase()
  };

  const visit = await knex<Visit>("visits")
    .where({ link_id: params.id })
    .andWhere(
      knex.raw("date_trunc('hour', created_at) = date_trunc('hour', ?)", [
        knex.fn.now()
      ])
    )
    .first();

  if (visit) {
    await knex("visits")
      .where({ id: visit.id })
      .increment(`br_${data.browser}`, 1)
      .increment(`os_${data.os}`, 1)
      .increment("total", 1)
      .update({
        updated_at: new Date().toISOString(),
        countries: knex.raw(
          "jsonb_set(countries, '{??}', (COALESCE(countries->>?,'0')::int + 1)::text::jsonb)",
          [data.country, data.country]
        ),
        referrers: knex.raw(
          "jsonb_set(referrers, '{??}', (COALESCE(referrers->>?,'0')::int + 1)::text::jsonb)",
          [data.referrer, data.referrer]
        )
      });
  } else {
    await knex<Visit>("visits").insert({
      [`br_${data.browser}`]: 1,
      countries: { [data.country]: 1 },
      referrers: { [data.referrer]: 1 },
      [`os_${data.os}`]: 1,
      total: 1,
      link_id: data.id
    });
  }

  return visit;
};

interface IFindLink {
  address?: string;
  domain_id?: number | null;
  user_id?: number | null;
  target?: string;
}

export const findLink = async ({
  address,
  domain_id,
  user_id,
  target
}: IFindLink): Promise<Link> => {
  const redisKey = getRedisKey.link(address, domain_id, user_id);
  const cachedLink = await redis.get(redisKey);

  if (cachedLink) return JSON.parse(cachedLink);

  const link = await knex<Link>("links")
    .where({
      ...(address && { address }),
      ...(domain_id && { domain_id }),
      ...(user_id && { user_id }),
      ...(target && { target })
    })
    .first();

  if (link) {
    redis.set(redisKey, JSON.stringify(link), "EX", 60 * 60 * 2);
  }

  return link;
};

export const getUserLinksCount = async (params: {
  user_id: number;
  date?: Date;
}) => {
  const model = knex<Link>("links").where({ user_id: params.user_id });

  // TODO: Test counts;
  let res;
  if (params.date) {
    res = await model
      .andWhere("created_at", ">", params.date.toISOString())
      .count("id");
  } else {
    res = await model.count("id");
  }

  return res[0] && res[0].count;
};

interface IGetLinksOptions {
  count?: string;
  page?: string;
  search?: string;
}

export const getLinks = async (
  user_id: number,
  options: IGetLinksOptions = {}
) => {
  const { count = "5", page = "1", search = "" } = options;
  const limit = parseInt(count) < 50 ? parseInt(count) : 50;
  const offset = (parseInt(page) - 1) * limit;

  const model = knex<LinkJoinedDomain>("links")
    .select(
      "links.id",
      "links.address",
      "links.banned",
      "links.created_at",
      "links.domain_id",
      "links.updated_at",
      "links.password",
      "links.target",
      "links.visit_count",
      "links.user_id",
      "domains.address as domain"
    )
    .offset(offset)
    .limit(limit)
    .orderBy("created_at", "desc")
    .where("links.user_id", user_id);

  if (search) {
    model.andWhereRaw("links.address || ' ' || target ILIKE '%' || ? || '%'", [
      search
    ]);
  }

  const matchedLinks = await model.leftJoin(
    "domains",
    "links.domain_id",
    "domains.id"
  );

  const links = matchedLinks.map(link => ({
    ...link,
    id: link.address,
    password: !!link.password,
    shortLink: generateShortLink(link.address, link.domain),
    shortUrl: generateShortLink(link.address, link.domain)
  }));

  return links;
};

interface IDeleteLink {
  address: string;
  user_id: number;
  domain?: string;
}

export const deleteLink = async (data: IDeleteLink) => {
  const link: LinkJoinedDomain = await knex<LinkJoinedDomain>("links")
    .select("links.id", "domains.address as domain")
    .where({
      "links.address": data.address,
      "links.user_id": data.user_id,
      ...(!data.domain && { domain_id: null })
    })
    .leftJoin("domains", "links.domain_id", "domains.id")
    .first();

  if (!link) return;

  if (link.domain !== data.domain) {
    return;
  }

  await knex<Visit>("visits")
    .where("link_id", link.id)
    .delete();

  const deletedLink = await knex<Link>("links")
    .where("id", link.id)
    .delete();

  redis.del(getRedisKey.link(link.address, link.domain_id, link.user_id));

  return !!deletedLink;
};

/*
 ** Collecting stats
 */

interface StatsResult {
  stats: {
    browser: { name: string; value: number }[];
    os: { name: string; value: number }[];
    country: { name: string; value: number }[];
    referrer: { name: string; value: number }[];
  };
  views: number[];
}

const getInitStats = (): Stats =>
  Object.create({
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

const STATS_PERIODS: [number, "lastDay" | "lastWeek" | "lastMonth"][] = [
  [1, "lastDay"],
  [7, "lastWeek"],
  [30, "lastMonth"]
];

interface IGetStatsResponse {
  allTime: StatsResult;
  id: string;
  lastDay: StatsResult;
  lastMonth: StatsResult;
  lastWeek: StatsResult;
  shortLink: string;
  shortUrl: string;
  target: string;
  total: number;
  updatedAt: string;
}

export const getStats = async (link: Link, domain: Domain) => {
  const stats = {
    lastDay: {
      stats: getInitStats(),
      views: new Array(24).fill(0)
    },
    lastWeek: {
      stats: getInitStats(),
      views: new Array(7).fill(0)
    },
    lastMonth: {
      stats: getInitStats(),
      views: new Array(30).fill(0)
    },
    allTime: {
      stats: getInitStats(),
      views: new Array(18).fill(0)
    }
  };

  const visitsStream: any = knex<Visit>("visits")
    .where("link_id", link.id)
    .stream();
  const nowUTC = getUTCDate();
  const now = new Date();

  for await (const visit of visitsStream as Visit[]) {
    STATS_PERIODS.forEach(([days, type]) => {
      const isIncluded = isAfter(
        new Date(visit.created_at),
        subDays(nowUTC, days)
      );
      if (isIncluded) {
        const diffFunction = getDifferenceFunction(type);
        const diff = diffFunction(now, visit.created_at);
        const index = stats[type].views.length - diff - 1;
        const view = stats[type].views[index];
        const period = stats[type].stats;
        stats[type].stats = {
          browser: {
            chrome: period.browser.chrome + visit.br_chrome,
            edge: period.browser.edge + visit.br_edge,
            firefox: period.browser.firefox + visit.br_firefox,
            ie: period.browser.ie + visit.br_ie,
            opera: period.browser.opera + visit.br_opera,
            other: period.browser.other + visit.br_other,
            safari: period.browser.safari + visit.br_safari
          },
          os: {
            android: period.os.android + visit.os_android,
            ios: period.os.ios + visit.os_ios,
            linux: period.os.linux + visit.os_linux,
            macos: period.os.macos + visit.os_macos,
            other: period.os.other + visit.os_other,
            windows: period.os.windows + visit.os_windows
          },
          country: {
            ...period.country,
            ...Object.entries(visit.countries).reduce(
              (obj, [country, count]) => ({
                ...obj,
                [country]: (period.country[country] || 0) + count
              }),
              {}
            )
          },
          referrer: {
            ...period.referrer,
            ...Object.entries(visit.referrers).reduce(
              (obj, [referrer, count]) => ({
                ...obj,
                [referrer]: (period.referrer[referrer] || 0) + count
              }),
              {}
            )
          }
        };
        stats[type].views[index] = view + visit.total;
      }
    });

    const allTime = stats.allTime.stats;
    const diffFunction = getDifferenceFunction("allTime");
    const diff = diffFunction(
      set(new Date(), { date: 1 }),
      set(new Date(visit.created_at), { date: 1 })
    );
    console.log(diff);
    const index = stats.allTime.views.length - diff - 1;
    const view = stats.allTime.views[index];
    stats.allTime.stats = {
      browser: {
        chrome: allTime.browser.chrome + visit.br_chrome,
        edge: allTime.browser.edge + visit.br_edge,
        firefox: allTime.browser.firefox + visit.br_firefox,
        ie: allTime.browser.ie + visit.br_ie,
        opera: allTime.browser.opera + visit.br_opera,
        other: allTime.browser.other + visit.br_other,
        safari: allTime.browser.safari + visit.br_safari
      },
      os: {
        android: allTime.os.android + visit.os_android,
        ios: allTime.os.ios + visit.os_ios,
        linux: allTime.os.linux + visit.os_linux,
        macos: allTime.os.macos + visit.os_macos,
        other: allTime.os.other + visit.os_other,
        windows: allTime.os.windows + visit.os_windows
      },
      country: {
        ...allTime.country,
        ...Object.entries(visit.countries).reduce(
          (obj, [country, count]) => ({
            ...obj,
            [country]: (allTime.country[country] || 0) + count
          }),
          {}
        )
      },
      referrer: {
        ...allTime.referrer,
        ...Object.entries(visit.referrers).reduce(
          (obj, [referrer, count]) => ({
            ...obj,
            [referrer]: (allTime.referrer[referrer] || 0) + count
          }),
          {}
        )
      }
    };
    stats.allTime.views[index] = view + visit.total;
  }

  const response: IGetStatsResponse = {
    allTime: {
      stats: statsObjectToArray(stats.allTime.stats),
      views: stats.allTime.views
    },
    id: link.address,
    lastDay: {
      stats: statsObjectToArray(stats.lastDay.stats),
      views: stats.lastDay.views
    },
    lastMonth: {
      stats: statsObjectToArray(stats.lastMonth.stats),
      views: stats.lastMonth.views
    },
    lastWeek: {
      stats: statsObjectToArray(stats.lastWeek.stats),
      views: stats.lastWeek.views
    },
    shortLink: generateShortLink(link.address, domain.address),
    shortUrl: generateShortLink(link.address, domain.address),
    target: link.target,
    total: link.visit_count,
    updatedAt: new Date().toISOString()
  };
  return response;
};

interface IBanLink {
  adminId?: number;
  banUser?: boolean;
  domain?: string;
  host?: string;
  address: string;
}

export const banLink = async (data: IBanLink) => {
  const tasks = [];
  const banned_by_id = data.adminId;

  // Ban link
  const [link]: Link[] = await knex<Link>("links")
    .where({ address: data.address, domain_id: null })
    .update(
      { banned: true, banned_by_id, updated_at: new Date().toISOString() },
      "*"
    );

  if (!link) throw new Error("No link has been found.");

  // If user, ban user and all of their links.
  if (data.banUser && link.user_id) {
    tasks.push(banUser(link.user_id, banned_by_id));
    tasks.push(
      knex<Link>("links")
        .where({ user_id: link.user_id })
        .update(
          { banned: true, banned_by_id, updated_at: new Date().toISOString() },
          "*"
        )
    );
  }

  // Ban host
  if (data.host) tasks.push(banHost(data.host, banned_by_id));

  // Ban domain
  if (data.domain) tasks.push(banDomain(data.domain, banned_by_id));

  redis.del(getRedisKey.link(link.address, link.domain_id, link.user_id));

  return Promise.all(tasks);
};
