import ms from 'ms';
import {
  differenceInDays,
  differenceInHours,
  differenceInMonths,
} from 'date-fns';

export const addProtocol = (url: string): string => {
  const hasProtocol = /^\w+:\/\//.test(url);
  return hasProtocol ? url : `http://${url}`;
};

export const generateShortLink = (id: string, domain?: string): string => {
  const protocol =
    process.env.CUSTOM_DOMAIN_USE_HTTPS === 'true' || !domain
      ? 'https://'
      : 'http://';
  return `${protocol}${domain || process.env.DEFAULT_DOMAIN}/${id}`;
};

export const isAdmin = (email: string): boolean =>
  process.env.ADMIN_EMAILS.split(',')
    .map(e => e.trim())
    .includes(email);

// TODO: Add statsLimit
export const getStatsLimit = (): number =>
  Number(process.env.DEFAULT_MAX_STATS_PER_LINK) || 100000000;

export const getStatsCacheTime = (total?: number): number => {
  let durationInMs;
  switch (true) {
    case total <= 5000:
      durationInMs = ms('5 minutes');
      break;
    case total > 5000 && total < 20000:
      durationInMs = ms('10 minutes');
      break;
    case total < 40000:
      durationInMs = ms('15 minutes');
      break;
    case total > 40000:
      durationInMs = ms('30 minutes');
      break;
    default:
      durationInMs = ms('5 minutes');
  }
  return durationInMs / 1000;
};

export const statsObjectToArray = (
  obj: Record<string, Record<string, number>>
) => {
  const objToArr = key =>
    Array.from(Object.keys(obj[key]))
      .map(name => ({
        name,
        value: obj[key][name],
      }))
      .sort((a, b) => b.value - a.value);

  return {
    browser: objToArr('browser'),
    os: objToArr('os'),
    country: objToArr('country'),
    referrer: objToArr('referrer'),
  };
};

export const getDifferenceFunction = (
  type: 'lastDay' | 'lastWeek' | 'lastMonth' | 'allTime'
): Function => {
  if (type === 'lastDay') return differenceInHours;
  if (type === 'lastWeek') return differenceInDays;
  if (type === 'lastMonth') return differenceInDays;
  if (type === 'allTime') return differenceInMonths;
  throw new Error('Unknown type.');
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
