import subMinutes from 'date-fns/sub_minutes';
import IP from '../models/ip';

export const addIP = async (newIP: string) => {
  const ip = await IP.findOneAndUpdate(
    { ip: newIP },
    { ip: newIP, createdAt: new Date() },
    { new: true, upsert: true, runValidators: true }
  );
  return ip;
};
export const getIP = async (ip: string) => {
  const matchedIp = await IP.findOne({
    ip,
    createdAt: {
      $gt: subMinutes(new Date(), Number(process.env.NON_USER_COOLDOWN)),
    },
  });
  return matchedIp;
};
export const clearIPs = async () =>
  IP.deleteMany({
    createdAt: {
      $lt: subMinutes(new Date(), Number(process.env.NON_USER_COOLDOWN)),
    },
  });
