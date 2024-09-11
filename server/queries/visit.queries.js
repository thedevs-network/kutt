const { isAfter, subDays, subHours, set } = require("date-fns");

const utils = require("../utils");
const redis = require("../redis");
const knex = require("../knex");

async function add(params) {
  const data = {
    ...params,
    country: params.country.toLowerCase(),
    referrer: params.referrer.toLowerCase()
  };

  const truncatedNow = new Date();
  truncatedNow.setMinutes(0, 0, 0);

  // Create a subquery first that truncates the
  const subquery = knex("visits")
    .select("visits.*")
    .select({
      created_at_hours: utils.knexUtils(knex).truncatedTimestamp("created_at", "hour")
    })
    .where({ link_id: params.id })
    .as("subquery");

  const visit = await knex
    .select("*")
    .from(subquery)
    .where("created_at_hours", "=", truncatedNow.toISOString())
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
    await knex("visits").insert({
      [`br_${data.browser}`]: 1,
      countries: { [data.country]: 1 },
      referrers: { [data.referrer]: 1 },
      [`os_${data.os}`]: 1,
      total: 1,
      link_id: data.id
    });
  }

  return visit;
}

async function find(match, total) {
  // if (match.link_id) {
  //   const key = redis.key.stats(match.link_id);
  //   const cached = await redis.client.get(key);
  //   if (cached) return JSON.parse(cached);
  // }

  const stats = {
    lastDay: {
      stats: utils.getInitStats(),
      views: new Array(24).fill(0),
      total: 0
    },
    lastWeek: {
      stats: utils.getInitStats(),
      views: new Array(7).fill(0),
      total: 0
    },
    lastMonth: {
      stats: utils.getInitStats(),
      views: new Array(30).fill(0),
      total: 0
    },
    lastYear: {
      stats: utils.getInitStats(),
      views: new Array(12).fill(0),
      total: 0
    }
  };

  const visitsStream = knex("visits").where(match).stream();
  const nowUTC = utils.getUTCDate();
  const now = new Date();

  const periods = utils.getStatsPeriods(now);

  for await (const visit of visitsStream) {
    periods.forEach(([type, fromDate]) => {
      const isIncluded = isAfter(new Date(visit.created_at), fromDate);
      if (!isIncluded) return;
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
      stats[type].views[index] += visit.total;
      stats[type].total += visit.total;
    });
  }

  const response = {
    lastYear: {
      stats: utils.statsObjectToArray(stats.lastYear.stats),
      views: stats.lastYear.views,
      total: stats.lastYear.total
    },
    lastDay: {
      stats: utils.statsObjectToArray(stats.lastDay.stats),
      views: stats.lastDay.views,
      total: stats.lastDay.total
    },
    lastMonth: {
      stats: utils.statsObjectToArray(stats.lastMonth.stats),
      views: stats.lastMonth.views,
      total: stats.lastMonth.total
    },
    lastWeek: {
      stats: utils.statsObjectToArray(stats.lastWeek.stats),
      views: stats.lastWeek.views,
      total: stats.lastWeek.total
    },
    updatedAt: new Date().toISOString()
  };

  if (match.link_id) {
    const cacheTime = utils.getStatsCacheTime(total);
    const key = redis.key.stats(match.link_id);
    redis.client.set(key, JSON.stringify(response), "EX", cacheTime);
  }

  return response;
};


module.exports = {
  add,
  find
};