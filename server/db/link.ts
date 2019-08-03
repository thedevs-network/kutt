import bcrypt from 'bcryptjs';
import _ from 'lodash';
import { isAfter, subDays } from 'date-fns';
import { Types } from 'mongoose';

import Link, { ILink } from '../models/link';
import Visit from '../models/visit';
import Domain, { IDomain } from '../models/domain';
import {
  generateShortLink,
  statsObjectToArray,
  getDifferenceFunction,
  getUTCDate,
} from '../utils';
import { getDomain, banDomain } from './domain';
import * as redis from '../redis';
import { banHost } from './host';
import { banUser } from './user';

interface ICreateLink extends ILink {
  reuse?: boolean;
}

export const createShortLink = async (data: ICreateLink) => {
  let password;
  if (data.password) {
    const salt = await bcrypt.genSalt(12);
    password = await bcrypt.hash(data.password, salt);
  }

  const link = await Link.create({
    id: data.id,
    password,
    target: data.target,
    user: data.user,
    domain: data.domain,
  });

  return {
    ...link,
    password: !!data.password,
    reuse: !!data.reuse,
    shortLink: generateShortLink(
      data.id,
      data.domain && (data.domain as IDomain).name
    ),
  };
};

export const addLinkCount = async (
  id: Types.ObjectId,
  customDomain?: string
) => {
  const domain = await (customDomain && getDomain({ name: customDomain }));
  const url = await Link.findOneAndUpdate(
    { id, domain: domain || { $exists: false } },
    { $inc: { count: 1 } }
  );
  return url;
};

interface ICreateVisit {
  browser: string;
  country: string;
  domain?: string;
  id: string;
  limit: number;
  os: string;
  referrer: string;
}

export const createVisit = async (params: ICreateVisit) => {
  const domain = await (params.domain && getDomain({ name: params.domain }));
  const link = await Link.findOne({
    id: params.id,
    domain: domain || { $exists: false },
  });

  if (link.count > params.limit) return null;

  const visit = await Visit.findOneAndUpdate(
    {
      data: getUTCDate().toJSON(),
      link,
    },
    {
      $inc: {
        [`browser.${params.browser}`]: 1,
        [`country.${params.country}`]: 1,
        [`os.${params.os}`]: 1,
        [`referrer.${params.referrer}`]: 1,
        total: 1,
      },
    },
    { upsert: true }
  );
  return visit;
};

interface IFindLink {
  id?: string;
  domain?: Types.ObjectId | string;
  user?: Types.ObjectId | string;
  target?: string;
}

export const findLink = async (
  { id = '', domain = '', user = '', target }: IFindLink,
  options?: { forceDomainCheck?: boolean }
) => {
  const redisKey = id + domain.toString() + user.toString();
  const cachedLink = await redis.get(redisKey);

  if (cachedLink) return JSON.parse(cachedLink);

  const link = await Link.findOne({
    ...(id && { id }),
    ...(domain && { domain }),
    ...(options.forceDomainCheck && { domain: domain || { $exists: false } }),
    ...(user && { user }),
    ...(target && { target }),
  }).populate('domain');

  redis.set(redisKey, JSON.stringify(link), 'EX', 60 * 60 * 2);

  // TODO: Get user?
  return link;
};

export const getUserLinksCount = async (params: {
  user: Types.ObjectId;
  date?: Date;
}) => {
  const count = await Link.find({
    user: params.user,
    ...(params.date && { createdAt: { $gt: params.date } }),
  }).count();
  return count;
};

interface IGetLinksOptions {
  count?: string;
  page?: string;
  search?: string;
}

export const getLinks = async (
  user: Types.ObjectId,
  options: IGetLinksOptions = {}
) => {
  const { count = '5', page = '1', search = '' } = options;
  const limit = parseInt(count, 10);
  const skip = parseInt(page, 10);
  const $regex = new RegExp(`.*${search}.*`, 'i');

  const matchedLinks = await Link.find({
    user,
    $or: [{ id: { $regex } }, { target: { $regex } }],
  })
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .populate('domain');

  const links = matchedLinks.map(link => ({
    ...link,
    password: !!link.password,
    shortLink: generateShortLink(
      link.id,
      link.domain && (link.domain as IDomain).name
    ),
  }));

  return links;
};

interface IDeleteLink {
  id: string;
  user: Types.ObjectId;
  domain?: Types.ObjectId;
}

export const deleteLink = async (data: IDeleteLink) => {
  const link = await Link.findOneAndDelete({
    id: data.id,
    user: data.user,
    domain: data.domain || { $exists: false },
  });
  await Visit.deleteMany({ link });

  const domainKey = link.domain ? link.domain.toString() : '';
  const userKey = link.user ? link.user.toString() : '';
  redis.del(link.id + domainKey);
  redis.del(link.id + domainKey + userKey);

  return link;
};

/*
 ** Collecting stats
 */

interface IStats {
  browser: Record<
    'chrome' | 'edge' | 'firefox' | 'ie' | 'opera' | 'other' | 'safari',
    number
  >;
  os: Record<
    'android' | 'ios' | 'linux' | 'macos' | 'other' | 'windows',
    number
  >;
  country: Record<string, number>;
  referrer: Record<string, number>;
  dates: Date[];
}

interface Stats {
  stats: IStats;
  views: number[];
}

const INIT_STATS: IStats = {
  browser: {
    chrome: 0,
    edge: 0,
    firefox: 0,
    ie: 0,
    opera: 0,
    other: 0,
    safari: 0,
  },
  os: {
    android: 0,
    ios: 0,
    linux: 0,
    macos: 0,
    other: 0,
    windows: 0,
  },
  country: {},
  referrer: {},
  dates: [],
};

const STATS_PERIODS: [number, 'lastDay' | 'lastWeek' | 'lastMonth'][] = [
  [1, 'lastDay'],
  [7, 'lastWeek'],
  [30, 'lastMonth'],
];

interface IGetStats {
  domain: Types.ObjectId;
  id: string;
  user: Types.ObjectId;
}

interface IGetStatsResponse {
  allTime: Stats;
  id: string;
  lastDay: Stats;
  lastMonth: Stats;
  lastWeek: Stats;
  shortLink: string;
  target: string;
  total: number;
  updatedAt: string;
}

export const getStats = async (data: IGetStats) => {
  const stats = {
    lastDay: {
      stats: _.cloneDeep(INIT_STATS),
      views: new Array(24).fill(0),
    },
    lastWeek: {
      stats: _.cloneDeep(INIT_STATS),
      views: new Array(7).fill(0),
    },
    lastMonth: {
      stats: _.cloneDeep(INIT_STATS),
      views: new Array(30).fill(0),
    },
    allTime: {
      stats: _.cloneDeep(INIT_STATS),
      views: new Array(18).fill(0),
    },
  };

  const domain = await (data.domain && Domain.findOne({ name: data.domain }));
  const link = await Link.findOne({
    id: data.id,
    user: data.user,
    ...(domain && { domain }),
  });

  if (!link) throw new Error("Couldn't get stats for this link.");

  const visits = await Visit.find({
    link: link.id,
  });

  visits.forEach(visit => {
    STATS_PERIODS.forEach(([days, type]) => {
      const isIncluded = isAfter(visit.date, subDays(getUTCDate(), days));
      if (isIncluded) {
        const diffFunction = getDifferenceFunction(type);
        const now = new Date();
        const diff = diffFunction(now, visit.date);
        const index = stats[type].views.length - diff - 1;
        const view = stats[type].views[index];
        const period = stats[type].stats;
        stats[type].stats = {
          browser: {
            chrome: period.chrome + visit.browser.chrome,
            edge: period.edge + visit.browser.edge,
            firefox: period.firefox + visit.browser.firefox,
            ie: period.ie + visit.browser.ie,
            opera: period.opera + visit.browser.opera,
            other: period.other + visit.browser.other,
            safari: period.safari + visit.browser.safari,
          },
          os: {
            android: period.android + visit.os.android,
            ios: period.ios + visit.os.ios,
            linux: period.linux + visit.os.linux,
            macos: period.macos + visit.os.macos,
            other: period.other + visit.os.other,
            windows: period.windows + visit.os.windows,
          },
          country: {
            ...period.country,
            ...Object.keys(visit.country).reduce(
              (obj, key) => ({
                ...obj,
                [key]: period.country[key] + visit.country[key],
              }),
              {}
            ),
          },
          referrer: {
            ...period.referrer,
            ...Object.keys(visit.referrer).reduce(
              (obj, key) => ({
                ...obj,
                [key]: period.referrer[key] + visit.referrer[key],
              }),
              {}
            ),
          },
        };
        stats[type].views[index] = view + 1 || 1;
      }
    });

    const allTime = stats.allTime.stats;
    const diffFunction = getDifferenceFunction('allTime');
    const now = new Date();
    const diff = diffFunction(now, visit.date);
    const index = stats.allTime.views.length - diff - 1;
    const view = stats.allTime.views[index];
    stats.allTime.stats = {
      browser: {
        chrome: allTime.chrome + visit.browser.chrome,
        edge: allTime.edge + visit.browser.edge,
        firefox: allTime.firefox + visit.browser.firefox,
        ie: allTime.ie + visit.browser.ie,
        opera: allTime.opera + visit.browser.opera,
        other: allTime.other + visit.browser.other,
        safari: allTime.safari + visit.browser.safari,
      },
      os: {
        android: allTime.android + visit.os.android,
        ios: allTime.ios + visit.os.ios,
        linux: allTime.linux + visit.os.linux,
        macos: allTime.macos + visit.os.macos,
        other: allTime.other + visit.os.other,
        windows: allTime.windows + visit.os.windows,
      },
      country: {
        ...allTime.country,
        ...Object.keys(visit.country).reduce(
          (obj, key) => ({
            ...obj,
            [key]: allTime.country[key] + visit.country[key],
          }),
          {}
        ),
      },
      referrer: {
        ...allTime.referrer,
        ...Object.keys(visit.referrer).reduce(
          (obj, key) => ({
            ...obj,
            [key]: allTime.referrer[key] + visit.referrer[key],
          }),
          {}
        ),
      },
    };
    stats.allTime.views[index] = view + 1 || 1;
  });

  stats.lastDay.stats = statsObjectToArray(stats.lastDay.stats);
  stats.lastWeek.stats = statsObjectToArray(stats.lastWeek.stats);
  stats.lastMonth.stats = statsObjectToArray(stats.lastMonth.stats);
  stats.allTime.stats = statsObjectToArray(stats.allTime.stats);
  const response: IGetStatsResponse = {
    allTime: stats.allTime,
    id: link.id,
    lastDay: stats.lastDay,
    lastMonth: stats.lastMonth,
    lastWeek: stats.lastWeek,
    shortLink: generateShortLink(
      link.id,
      link.domain && (link.domain as IDomain).name
    ),
    target: link.target,
    total: link.count,
    updatedAt: new Date().toISOString(),
  };
  return response;
};

interface IBanLink {
  adminId?: Types.ObjectId;
  banUser?: boolean;
  domain?: string;
  host?: string;
  id: string;
}

export const banLink = async (data: IBanLink) => {
  const tasks = [];
  const bannedBy = data.adminId;

  // Ban link
  const link = await Link.findOneAndUpdate(
    { id: data.id },
    { banned: true, bannedBy },
    { new: true }
  );

  if (!link) throw new Error('No link has been found.');

  // If user, ban user and all of their links.
  if (data.banUser && link.user) {
    tasks.push(banUser(link.user, bannedBy));
    tasks.push(
      Link.updateMany({ user: link.user }, { banned: true, bannedBy })
    );
  }

  // Ban host
  if (data.host) tasks.push(banHost(data.host, bannedBy));

  // Ban domain
  if (data.domain) tasks.push(banDomain(data.domain, bannedBy));

  const domainKey = link.domain ? link.domain.toString() : '';
  const userKey = link.user ? link.user.toString() : '';
  redis.del(link.id + domainKey);
  redis.del(link.id + domainKey + userKey);

  return Promise.all(tasks);
};
