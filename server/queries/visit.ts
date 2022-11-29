import { isAfter, subDays, set } from "date-fns";

import * as utils from "../utils";
import redisClient, * as redis from "../redis";
import knex from "../knex";

interface Add {
  browser: string;
  country: string;
  domain?: string;
  id: number;
  os: string;
  referrer: string;
}

export const add = async (params: Add) => {
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

interface StatsResult {
  stats: {
    browser: { name: string; value: number }[];
    os: { name: string; value: number }[];
    country: { name: string; value: number }[];
    referrer: { name: string; value: number }[];
  };
  views: number[];
}

interface IGetStatsResponse {
  allTime: StatsResult;
  lastDay: StatsResult;
  lastMonth: StatsResult;
  lastWeek: StatsResult;
  updatedAt: string;
}

export const find = async (match: Partial<Visit>, total: number) => {
  if (match.link_id) {
    const key = redis.key.stats(match.link_id);
    const cached = await redisClient.get(key);
    if (cached) return JSON.parse(cached);
  }

  const stats = {
    lastDay: {
      stats: utils.getInitStats(),
      views: new Array(24).fill(0)
    },
    lastWeek: {
      stats: utils.getInitStats(),
      views: new Array(7).fill(0)
    },
    lastMonth: {
      stats: utils.getInitStats(),
      views: new Array(30).fill(0)
    },
    allTime: {
      stats: utils.getInitStats(),
      views: new Array(18).fill(0)
    }
  };

  const visitsStream: any = knex<Visit>("visits").where(match).stream();
  const nowUTC = utils.getUTCDate();
  const now = new Date();

  for await (const visit of visitsStream as Visit[]) {
    utils.STATS_PERIODS.forEach(([days, type]) => {
      const isIncluded = isAfter(
        new Date(visit.created_at),
        subDays(nowUTC, days)
      );
      if (isIncluded) {
        const diffFunction = utils.getDifferenceFunction(type);
        const diff = diffFunction(now, new Date(visit.created_at));
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
    const diffFunction = utils.getDifferenceFunction("allTime");
    const diff = diffFunction(
      set(new Date(), { date: 1 }),
      set(new Date(visit.created_at), { date: 1 })
    );
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
      stats: utils.statsObjectToArray(stats.allTime.stats),
      views: stats.allTime.views
    },
    lastDay: {
      stats: utils.statsObjectToArray(stats.lastDay.stats),
      views: stats.lastDay.views
    },
    lastMonth: {
      stats: utils.statsObjectToArray(stats.lastMonth.stats),
      views: stats.lastMonth.views
    },
    lastWeek: {
      stats: utils.statsObjectToArray(stats.lastWeek.stats),
      views: stats.lastWeek.views
    },
    updatedAt: new Date().toISOString()
  };

  if (match.link_id) {
    const cacheTime = utils.getStatsCacheTime(total);
    const key = redis.key.stats(match.link_id);
    redisClient.set(key, JSON.stringify(response), "EX", cacheTime);
  }

  return response;
};
