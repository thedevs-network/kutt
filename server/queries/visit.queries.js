const { isAfter, subDays, subHours, set, format } = require("date-fns");

const utils = require("../utils");
const redis = require("../redis");
const knex = require("../knex");
const env = require("../env");

async function add(params) {
  const data = {
    ...params,
    country: params.country.toLowerCase(),
    referrer: params.referrer.toLowerCase()
  };

  const nowUTC = new Date().toISOString();
  const truncatedNow = nowUTC.substring(0, 10) + " " + nowUTC.substring(11, 14) + "00:00";

  return knex.transaction(async (trx) => {
    // Create a subquery first that truncates the
    const subquery = trx("visits")
      .select("visits.*")
      .select({
        created_at_hours: utils.knexUtils(trx).truncatedTimestamp("created_at", "hour")
      })
      .where({ link_id: data.link_id })
      .as("subquery");

    const visit = await trx
      .select("*")
      .from(subquery)
      .where("created_at_hours", "=", truncatedNow)
      .forUpdate()
      .first();
      
    if (visit) {
      const countries = typeof visit.countries === "string" ? JSON.parse(visit.countries) : visit.countries;
      const referrers = typeof visit.referrers === "string" ? JSON.parse(visit.referrers) : visit.referrers;
      await trx("visits")
        .where({ id: visit.id })
        .increment(`br_${data.browser}`, 1)
        .increment(`os_${data.os}`, 1)
        .increment("total", 1)
        .update({
          updated_at: utils.dateToUTC(new Date()),
          countries: JSON.stringify({
            ...countries,
            [data.country]: (countries[data.country] ?? 0) + 1
          }),
          referrers: JSON.stringify({
            ...referrers,
             [data.referrer]: (referrers[data.referrer] ?? 0) + 1
          })
        });
    } else {
      // This must also happen in the transaction to avoid concurrency
      await trx("visits").insert({
        [`br_${data.browser}`]: 1,
        countries: { [data.country]: 1 },
        referrers: { [data.referrer]: 1 },
        [`os_${data.os}`]: 1,
        total: 1,
        link_id: data.link_id,
        user_id: data.user_id,
      });
    }

    return visit;
  });
}

async function find(match, total) {
  const { link_id } = match;
  
  if (link_id && env.REDIS_ENABLED) {
    const stats = await getRedisStats(link_id);
    if (stats) return stats;
  }

  // fallback to database query
  return getDatabaseStats(match, total);
}

async function getRedisStats(linkId) {
  const now = new Date();
  const dates = getLast30Days(now);
  const pipeline = redis.client.pipeline();
  
  // acquire the last 30 days data
  dates.forEach(date => {
    const key = `visit:${linkId}:${date}`;
    pipeline.hgetall(key);
  });
  
  const results = await pipeline.exec();
  if (!results) return null;
  
  // handle statistics data
  const stats = initializeStats();
  
  results.forEach((result, index) => {
    if (!result[1]) return;
    const hourlyData = result[1];
    
    Object.entries(hourlyData).forEach(([hour, count]) => {
      const hourNum = parseInt(hour.split(':')[1]);
      updateStats(stats, dates[index], hourNum, parseInt(count));
    });
  });
  
  return formatStats(stats);
}

function getLast30Days(now) {
  const dates = [];
  for (let i = 0; i < 30; i++) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    dates.push(date.toISOString().split('T')[0]);
  }
  return dates;
}

function initializeStats() {
  return {
    lastDay: { views: new Array(24).fill(0), total: 0 },
    lastWeek: { views: new Array(7).fill(0), total: 0 },
    lastMonth: { views: new Array(30).fill(0), total: 0 }
  };
}


module.exports = {
  add,
  find
};