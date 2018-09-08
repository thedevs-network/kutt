const bcrypt = require('bcryptjs');
const _ = require('lodash/');
const {
  isAfter,
  isSameHour,
  isSameDay,
  isSameMonth,
  subDays,
  subHours,
  subMonths,
} = require('date-fns');
const driver = require('./neo4j');
const config = require('../config');
const { generateShortUrl } = require('../utils');

const getUTCDate = (dateString = Date.now()) => {
  const date = new Date(dateString);
  return new Date(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), date.getUTCHours());
};

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
          shortUrl: generateShortUrl(data.id, params.user.domain),
        });
      })
      .catch(() => session.close() && reject);
  });

exports.createVisit = params =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (l:URL { id: $id })' +
            `${params.domain ? 'MATCH (l)-[:USES]->({ name: $domain })' : ''}` +
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
      .catch(() => session.close() && reject);
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
      .catch(() => session.close() && reject);
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

exports.getUrls = ({ user, options }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    const { count = 5, page = 1, search = '' } = options;
    const limit = parseInt(count, 10);
    const skip = parseInt(page, 10);
    const searchQuery = search ? 'WHERE l.id =~ $search OR l.target =~ $search' : '';
    session
      .readTransaction(tx =>
        tx.run(
          `MATCH (u:USER { email: $email })-[:CREATED]->(l) ${searchQuery} ` +
            'WITH l ORDER BY l.createdAt DESC ' +
            'WITH l SKIP $skip LIMIT $limit ' +
            'OPTIONAL MATCH (l)-[:USES]->(d) ' +
            'RETURN l, d.name AS domain, size((l)<-[:VISITED]-()) as count',
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
        const urls = records.map(record => ({
          ...record.get('l').properties,
          password: !!record.get('l').properties.password,
          count: record.get('count').toNumber(),
          shortUrl: `http${!record.get('domain') ? 's' : ''}://${record.get('domain') ||
            config.DEFAULT_DOMAIN}/${record.get('l').properties.id}`,
        }));
        resolve({ list: urls });
      })
      .catch(err => session.close() || reject(err));
  });

exports.getCustomDomain = ({ customDomain }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .readTransaction(tx =>
        tx.run('MATCH (d:DOMAIN { name: $customDomain })<-[:OWNS]-(u) RETURN u', {
          customDomain,
        })
      )
      .then(({ records }) => {
        session.close();
        const data = records.length && records[0].get('u').properties;
        resolve(data);
      })
      .catch(() => session.close() && reject);
  });

exports.setCustomDomain = ({ user, customDomain }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (u:USER { email: $email }) ' +
            'OPTIONAL MATCH (u)-[r:OWNS]->() DELETE r ' +
            'MERGE (d:DOMAIN { name: $customDomain }) ' +
            'MERGE (u)-[:OWNS]->(d) RETURN u, d',
          {
            customDomain,
            email: user.email,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const data = records.length && records[0].get('d').properties;
        resolve(data);
      })
      .catch(() => session.close() && reject);
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
      .catch(() => session.close() && reject);
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
      .catch(() => session.close() && reject);
  });

/* Collecting stats */
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

const filterByDate = days => record => isAfter(record.date, subDays(getUTCDate(), days));

/* eslint-disable no-param-reassign */
const calcStats = (obj, record) => {
  obj.browser[record.browser] += 1;
  obj.os[record.os] += 1;
  obj.country[record.country] = obj.country[record.country] + 1 || 1;
  obj.referrer[record.referrer] = obj.referrer[record.referrer] + 1 || 1;
  obj.dates = [...obj.dates, record.date];
  return obj;
};
/* eslint-enable no-param-reassign */

const objectToArray = item => {
  const objToArr = key =>
    Array.from(Object.keys(item[key]))
      .map(name => ({
        name,
        value: item[key][name],
      }))
      .sort((a, b) => b.value - a.value);

  return {
    browser: objToArr('browser'),
    os: objToArr('os'),
    country: objToArr('country'),
    referrer: objToArr('referrer'),
  };
};

const calcViewPerDate = (views, period, sub, compare, lastDate = getUTCDate(), arr = []) => {
  if (arr.length === period) return arr;

  const matchedStats = views.filter(date => compare(date, lastDate));
  const viewsPerDate = [matchedStats.length, ...arr];

  return calcViewPerDate(views, period, sub, compare, sub(lastDate, 1), viewsPerDate);
};

const calcViews = {
  0: views => calcViewPerDate(views, 24, subHours, isSameHour),
  1: views => calcViewPerDate(views, 7, subDays, isSameDay),
  2: views => calcViewPerDate(views, 30, subDays, isSameDay),
  3: views => calcViewPerDate(views, 18, subMonths, isSameMonth),
};

exports.getStats = ({ id, domain, user }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();

    session
      .readTransaction(tx =>
        tx.run(
          'MATCH (l:URL { id: $id })<-[:CREATED]-(u:USER { email: $email }) ' +
            `${domain ? 'MATCH (l)-[:USES]->(domain { name: $domain })' : ''}` +
            'MATCH (v)-[:VISITED]->(l) ' +
            'MATCH (v)-[:BROWSED_BY]->(b) ' +
            'MATCH (v)-[:LOCATED_IN]->(c) ' +
            'MATCH (v)-[:OS]->(o) ' +
            'MATCH (v)-[:REFERRED_BY]->(r) ' +
            'MATCH (v)-[:VISITED_IN]->(d) ' +
            'RETURN l, b.browser AS browser, c.country AS country,' +
            `${domain ? 'domain.name AS domain, ' : ''}` +
            'o.os AS os, r.referrer AS referrer, d.date AS date ' +
            'ORDER BY d.date DESC',
          {
            email: user.email,
            domain,
            id,
          }
        )
      )
      .then(({ records }) => {
        session.close();

        if (!records.length) resolve([]);

        const allStats = records.map(record => ({
          browser: record.get('browser'),
          os: record.get('os'),
          country: record.get('country'),
          referrer: record.get('referrer'),
          date: record.get('date'),
        }));

        const statsPeriods = [1, 7, 30, 550];

        const stats = statsPeriods
          .map(statsPeriod => allStats.filter(filterByDate(statsPeriod)))
          .map(statsPeriod => statsPeriod.reduce(calcStats, _.cloneDeep(initialStats)))
          .map((statsPeriod, index) => ({
            stats: objectToArray(statsPeriod),
            views: calcViews[index](statsPeriod.dates),
          }));

        const response = {
          total: records.length,
          id,
          shortUrl: `http${!domain ? 's' : ''}://${
            domain ? records[0].get('domain') : config.DEFAULT_DOMAIN
          }/${id}`,
          target: records[0].get('l').properties.target,
          lastDay: stats[0],
          lastWeek: stats[1],
          lastMonth: stats[2],
          allTime: stats[3],
        };

        return resolve(response);
      })
      .catch(() => session.close() && reject);
  });

exports.urlCountFromDate = ({ date, email }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .readTransaction(tx =>
        tx.run(
          'MATCH (u:USER { email: $email })-[:CREATED]->(l) WHERE l.createdAt > $date ' +
            'RETURN COUNT(l) as count',
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
