const bcrypt = require('bcryptjs');
const _ = require('lodash/');
const { isAfter, subDays } = require('date-fns');
const driver = require('./neo4j');
const {
  generateShortUrl,
  statsObjectToArray,
  getDifferenceFunction,
  getUTCDate,
} = require('../utils');

const queryNewUrl = 'CREATE (l:URL { id: $id, target: $target, createdAt: $createdAt }) RETURN l';

const queryNewUserUrl = (domain, password) =>
  'MATCH (u:USER { email: $email })' +
  'CREATE (l:URL { id: $id, target: $target, createdAt: $createdAt' +
  `${password ? ', password: $password' : ''} })` +
  'CREATE (u)-[:CREATED]->(l)' +
  `${domain ? 'MERGE (l)-[:USES]->(:DOMAIN { name: $domain })' : ''}` +
  'RETURN l';

exports.createShortUrl = params =>
  new Promise(async (resolve, reject) => {
    const query = params.user ? queryNewUserUrl(params.user.domain, params.password) : queryNewUrl;
    const session = driver.session();
    const salt = params.password && (await bcrypt.genSalt(12));
    const hash = params.password && (await bcrypt.hash(params.password, salt));
    session
      .writeTransaction(tx =>
        tx.run(query, {
          createdAt: new Date().toJSON(),
          domain: params.user && params.user.domain,
          email: params.user && params.user.email,
          id: params.id,
          password: hash || '',
          target: params.target,
        })
      )
      .then(({ records }) => {
        session.close();
        const data = records[0].get('l').properties;
        resolve({
          ...data,
          password: !!data.password,
          reuse: !!params.reuse,
          shortUrl: generateShortUrl(
            data.id,
            params.user && params.user.domain,
            params.user && params.user.useHttps
          ),
        });
      })
      .catch(err => session.close() || reject(err));
  });

exports.createVisit = params =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (l:URL { id: $id }) ' +
            `${params.domain ? 'MATCH (l)-[:USES]->({ name: $domain })' : ''} ` +
            'SET l.count = l.count + 1 ' +
            'CREATE (v:VISIT)' +
            'MERGE (b:BROWSER { browser: $browser })' +
            'MERGE (c:COUNTRY { country: $country })' +
            'MERGE (o:OS { os: $os })' +
            'MERGE (r:REFERRER { referrer: $referrer })' +
            'MERGE (d:DATE { date: $date })' +
            'MERGE (v)-[:VISITED]->(l)' +
            'MERGE (v)-[:BROWSED_BY]->(b)' +
            'MERGE (v)-[:LOCATED_IN]->(c)' +
            'MERGE (v)-[:OS]->(o)' +
            'MERGE (v)-[:REFERRED_BY]->(r)' +
            'MERGE (v)-[:VISITED_IN]->(d)' +
            'RETURN l',
          {
            id: params.id,
            browser: params.browser,
            domain: params.domain,
            country: params.country,
            os: params.os,
            referrer: params.referrer,
            date: getUTCDate().toJSON(),
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const url = records.length && records[0].get('l').properties;
        resolve(url);
      })
      .catch(err => session.close() || reject(err));
  });

exports.findUrl = ({ id, domain, target }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .readTransaction(tx =>
        tx.run(
          `MATCH (l:URL { ${id ? 'id: $id' : 'target: $target'} })` +
            `${
              domain
                ? 'MATCH (l)-[:USES]->(d:DOMAIN { name: $domain })'
                : 'OPTIONAL MATCH (l)-[:USES]->(d)'
            }` +
            'OPTIONAL MATCH (u)-[:CREATED]->(l)' +
            'RETURN l, d.name AS domain, u.email AS user',
          {
            id,
            domain,
            target,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const url =
          records.length &&
          records.map(record => ({
            ...record.get('l').properties,
            domain: record.get('domain'),
            user: record.get('user'),
          }));
        resolve(url);
      })
      .catch(err => session.close() || reject(err));
  });

exports.getCountUrls = ({ user }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .readTransaction(tx =>
        tx.run('MATCH (u:USER {email: $email}) RETURN size((u)-[:CREATED]->()) as count', {
          email: user.email,
        })
      )
      .then(({ records }) => {
        session.close();
        const countAll = records.length ? records[0].get('count').toNumber() : 0;
        resolve({ countAll });
      })
      .catch(err => session.close() || reject(err));
  });

exports.getUrls = ({ user, options, setCount }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    const { count = 5, page = 1, search = '' } = options;
    const limit = parseInt(count, 10);
    const skip = parseInt(page, 10);
    const searchQuery = search ? 'WHERE l.id =~ $search OR l.target =~ $search' : '';
    const setVisitsCount = setCount ? 'SET l.count = size((l)<-[:VISITED]-())' : '';
    session
      .readTransaction(tx =>
        tx.run(
          `MATCH (u:USER { email: $email })-[:CREATED]->(l) ${searchQuery} ` +
            'WITH l ORDER BY l.createdAt DESC ' +
            'WITH l SKIP $skip LIMIT $limit ' +
            `OPTIONAL MATCH (l)-[:USES]->(d) ${setVisitsCount} ` +
            'RETURN l, d.name AS domain, d.useHttps as useHttps',
          {
            email: user.email,
            limit,
            skip: limit * (skip - 1),
            search: `(?i).*${search}.*`,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const urls = records.map(record => {
          const visitCount = record.get('l').properties.count;
          const domain = record.get('domain');
          const protocol = record.get('useHttps') || !domain ? 'https://' : 'http://';
          return {
            ...record.get('l').properties,
            count: typeof visitCount === 'object' ? visitCount.toNumber() : visitCount,
            password: !!record.get('l').properties.password,
            shortUrl: `${protocol}${domain || process.env.DEFAULT_DOMAIN}/${
              record.get('l').properties.id
            }`,
          };
        });
        resolve({ list: urls });
      })
      .catch(err => session.close() || reject(err));
  });

exports.getCustomDomain = ({ customDomain }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .readTransaction(tx =>
        tx.run(
          'MATCH (d:DOMAIN { name: $customDomain })<-[:OWNS]-(u) RETURN u.email as email, d.homepage as homepage',
          {
            customDomain,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const data = records.length
          ? {
              email: records[0].get('email'),
              homepage: records[0].get('homepage'),
            }
          : {};
        resolve(data);
      })
      .catch(err => session.close() || reject(err));
  });

exports.setCustomDomain = ({ user, customDomain, homepage, useHttps }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (u:USER { email: $email }) ' +
            'OPTIONAL MATCH (u)-[r:OWNS]->() DELETE r ' +
            `MERGE (d:DOMAIN { name: $customDomain, homepage: $homepage, useHttps: $useHttps }) ` +
            'MERGE (u)-[:OWNS]->(d) RETURN u, d',
          {
            customDomain,
            homepage: homepage || '',
            email: user.email,
            useHttps: !!useHttps,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const data = records.length && records[0].get('d').properties;
        resolve(data);
      })
      .catch(err => session.close() || reject(err));
  });

exports.deleteCustomDomain = ({ user }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run('MATCH (u:USER { email: $email }) MATCH (u)-[r:OWNS]->() DELETE r RETURN u', {
          email: user.email,
        })
      )
      .then(({ records }) => {
        session.close();
        const data = records.length && records[0].get('u').properties;
        resolve(data);
      })
      .catch(err => session.close() || reject(err));
  });

exports.deleteUrl = ({ id, domain, user }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (u:USER { email: $email }) ' +
            'MATCH (u)-[:CREATED]->(l { id: $id }) ' +
            `${
              domain
                ? 'MATCH (l)-[:USES]->(:DOMAIN { name: $domain })'
                : 'MATCH (l) WHERE NOT (l)-[:USES]->()'
            }` +
            'OPTIONAL MATCH (l)-[:MATCHES]->(v) ' +
            'DETACH DELETE l, v RETURN u',
          {
            email: user.email,
            domain,
            id,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const data = records.length && records[0].get('u').properties;
        resolve(data);
      })
      .catch(err => session.close() || reject(err));
  });

/*
 ** Collecting stats
 */

const initialStats = {
  browser: {
    IE: 0,
    Firefox: 0,
    Chrome: 0,
    Opera: 0,
    Safari: 0,
    Edge: 0,
    Other: 0,
  },
  os: {
    Windows: 0,
    'Mac Os X': 0,
    Linux: 0,
    'Chrome OS': 0,
    Android: 0,
    iOS: 0,
    Other: 0,
  },
  country: {},
  referrer: {},
  dates: [],
};

exports.getStats = ({ id, domain, user }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();

    const stats = {
      lastDay: {
        stats: _.cloneDeep(initialStats),
        views: new Array(24).fill(0),
      },
      lastWeek: {
        stats: _.cloneDeep(initialStats),
        views: new Array(7).fill(0),
      },
      lastMonth: {
        stats: _.cloneDeep(initialStats),
        views: new Array(30).fill(0),
      },
      allTime: {
        stats: _.cloneDeep(initialStats),
        views: new Array(18).fill(0),
      },
    };

    let total = 0;

    const statsPeriods = [[1, 'lastDay'], [7, 'lastWeek'], [30, 'lastMonth']];

    session
      .run(
        'MATCH (l:URL { id: $id })<-[:CREATED]-(u:USER { email: $email }) ' +
          `${domain ? 'MATCH (l)-[:USES]->(domain { name: $domain })' : ''}` +
          'MATCH (v)-[:VISITED]->(l) ' +
          'MATCH (v)-[:BROWSED_BY]->(b) ' +
          'MATCH (v)-[:LOCATED_IN]->(c) ' +
          'MATCH (v)-[:OS]->(o) ' +
          'MATCH (v)-[:REFERRED_BY]->(r) ' +
          'MATCH (v)-[:VISITED_IN]->(d) ' +
          'WITH l, b.browser AS browser, c.country AS country, ' +
          'o.os AS os, r.referrer AS referrer, d.date AS date ' +
          'RETURN l, browser, country, os, referrer, date ' +
          'ORDER BY date DESC',
        {
          email: user.email,
          domain,
          id,
        }
      )
      .subscribe({
        onNext(record) {
          total += 1;
          const browser = record.get('browser');
          const os = record.get('os');
          const country = record.get('country');
          const referrer = record.get('referrer');
          const date = record.get('date');

          statsPeriods.forEach(([days, type]) => {
            const isIncluded = isAfter(date, subDays(getUTCDate(), days));
            if (isIncluded) {
              const period = stats[type].stats;
              const diffFunction = getDifferenceFunction(type);
              const now = new Date();
              const diff = diffFunction(now, date);
              const index = stats[type].views.length - diff - 1;
              const view = stats[type].views[index];
              period.browser[browser] += 1;
              period.os[os] += 1;
              period.country[country] = period.country[country] + 1 || 1;
              period.referrer[referrer] = period.referrer[referrer] + 1 || 1;
              stats[type].views[index] = view + 1 || 1;
            }
          });

          const allTime = stats.allTime.stats;
          const diffFunction = getDifferenceFunction('allTime');
          const now = new Date();
          const diff = diffFunction(now, date);
          const index = stats.allTime.views.length - diff - 1;
          const view = stats.allTime.views[index];
          allTime.browser[browser] += 1;
          allTime.os[os] += 1;
          allTime.country[country] = allTime.country[country] + 1 || 1;
          allTime.referrer[referrer] = allTime.referrer[referrer] + 1 || 1;
          allTime.dates = [...allTime.dates, date];
          stats.allTime.views[index] = view + 1 || 1;
        },
        onCompleted() {
          stats.lastDay.stats = statsObjectToArray(stats.lastDay.stats);
          stats.lastWeek.stats = statsObjectToArray(stats.lastWeek.stats);
          stats.lastMonth.stats = statsObjectToArray(stats.lastMonth.stats);
          stats.allTime.stats = statsObjectToArray(stats.allTime.stats);
          const response = {
            total,
            id,
            updatedAt: new Date().toISOString(),
            lastDay: stats.lastDay,
            lastWeek: stats.lastWeek,
            lastMonth: stats.lastMonth,
            allTime: stats.allTime,
          };
          return resolve(response);
        },
        onError(error) {
          session.close();
          return reject(error);
        },
      });
  });

exports.urlCountFromDate = ({ date, email }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .readTransaction(tx =>
        tx.run(
          'MATCH (u:USER { email: $email })-[:CREATED]->(l) WHERE l.createdAt > $date ' +
            'WITH COUNT(l) as count RETURN count',
          {
            date,
            email,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const count = records.length && records[0].get('count').toNumber();
        return resolve({ count });
      })
      .catch(err => reject(err));
  });

exports.banUrl = async ({ id, domain, host, user }) => {
  const session = driver.session();
  const userQuery = user
    ? 'OPTIONAL MATCH (u:USER)-[:CREATED]->(l) SET u.banned = true WITH u ' +
      'OPTIONAL MATCH (u)-[:CREATED]->(ls:URL) SET ls.banned = true'
    : '';
  const domainQuery = domain
    ? 'MERGE (d:DOMAIN { name: $domain }) ON CREATE SET d.banned = true'
    : '';
  const hostQuery = host ? 'MERGE (h:HOST { name: $host }) ON CREATE SET h.banned = true' : '';
  const withL = user || domain || host ? 'WITH l' : '';
  await session.writeTransaction(tx =>
    tx.run(
      'MATCH (l:URL { id: $id }) WHERE NOT (l)-[:USES]->(:DOMAIN) ' +
        `SET l.banned = true ${withL} ${userQuery} ${domainQuery} ${hostQuery}`,
      {
        id,
        domain,
        host,
      }
    )
  );
  session.close();
};

exports.getBannedDomain = async (domain = '') => {
  const session = driver.session();
  const { records } = await session.readTransaction(tx =>
    tx.run('MATCH (d:DOMAIN { name: $domain, banned: true }) RETURN d', {
      domain,
    })
  );
  session.close();
  return records.length > 0;
};

exports.getBannedHost = async (host = '') => {
  const session = driver.session();
  const { records } = await session.readTransaction(tx =>
    tx.run('MATCH (h:HOST { name: $host, banned: true }) RETURN h', {
      host,
    })
  );
  session.close();
  return records.length > 0;
};
