import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import nanoid from 'nanoid';
import uuid from 'uuid/v4';
import addMinutes from 'date-fns/add_minutes';

import User from '../models/user';
import * as redis from '../redis';

export const getUser = async (emailOrKey: string = '') => {
  const cachedUser = await redis.get(emailOrKey);

  if (cachedUser) return JSON.parse(cachedUser);

  const user = await User.findOne({
    $or: [{ email: emailOrKey }, { apikey: emailOrKey }],
  })
    .populate('domain')
    .lean();

  redis.set(emailOrKey, JSON.parse(user), 'EX', 60 * 60 * 1);

  return user;
};

export const createUser = async (email: string, password: string) => {
  const salt = await bcrypt.genSalt(12);
  const hashedPassword = await bcrypt.hash(password, salt);

  const user = await User.findOneAndUpdate(
    { email },
    {
      email,
      password: hashedPassword,
      verificationToken: uuid(),
      verificationExpires: addMinutes(new Date(), 60),
    },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );

  redis.del(user.email);

  return user;
};

export const verifyUser = async (verificationToken: string) => {
  const user = await User.findOneAndUpdate(
    { verificationToken, verificationExpires: { $gt: new Date() } },
    {
      verified: true,
      verificationToken: undefined,
      verificationExpires: undefined,
    },
    { new: true }
  );

  redis.del(user.email);

  return user;
};

export const changePassword = async (
  id: Types.ObjectId,
  newPassword: string
) => {
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(newPassword, salt);

  const user = await User.findByIdAndUpdate(id, { password }, { new: true });

  redis.del(user.email);
  redis.del(user.apikey);

  return user;
};

export const generateApiKey = async (id: Types.ObjectId) => {
  const apikey = nanoid(40);

  const user = await User.findByIdAndUpdate(id, { apikey });

  redis.del(user.email);
  redis.del(user.apikey);

  return { ...user, apikey };
};

export const requestPasswordReset = async (email: string) => {
  const resetPasswordToken = uuid();

  const user = await User.findOneAndUpdate(
    { email },
    {
      resetPasswordToken,
      resetPasswordExpires: addMinutes(new Date(), 30),
    },
    { new: true }
  );

  redis.del(user.email);
  redis.del(user.apikey);

  return user;
};

export const resetPassword = async (resetPasswordToken: string) => {
  const user = await User.findOneAndUpdate(
    { resetPasswordToken, resetPasswordExpires: { $gt: new Date() } },
    { resetPasswordExpires: undefined, resetPasswordToken: undefined },
    { new: true }
  );

  redis.del(user.email);
  redis.del(user.apikey);

  return user;
};

export const addCooldown = async (id: Types.ObjectId) => {
  const user = await User.findByIdAndUpdate(
    id,
    { $push: { cooldowns: new Date() } },
    { new: true }
  );

  redis.del(user.email);
  redis.del(user.apikey);

  return user;
};

export const banUser = async (
  id: Types.ObjectId,
  bannedBy?: Types.ObjectId
) => {
  const user = await User.findByIdAndUpdate(
    id,
    {
      banned: true,
      bannedBy,
    },
    { new: true }
  );

  redis.del(user.email);
  redis.del(user.apikey);

  return user;
};
