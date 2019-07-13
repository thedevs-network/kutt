const bcrypt = require('bcryptjs');
const nanoid = require('nanoid');
const uuid = require('uuid/v4');
const subMinutes = require('date-fns/sub_minutes');
const addMinutes = require('date-fns/add_minutes');
const User = require('../models/user');
const Ip = require('../models/ip');

exports.getUser = async (emailOrKey = '') => {
  const user = await User.findOne({
    $or: [{ email: emailOrKey }, { apikey: emailOrKey }],
  }).lean();
  // TODO: Get domains

  // const session = driver.session();
  // const { records = [] } = await session.readTransaction(tx =>
  //   tx.run(
  //     'MATCH (u:USER) WHERE u.email = $email OR u.apikey = $apikey ' +
  //       'OPTIONAL MATCH (u)-[r:RECEIVED]->(c) WITH u, collect(c.date) as cooldowns ' +
  //       'OPTIONAL MATCH (u)-[:OWNS]->(d) RETURN u, d, cooldowns',
  //     {
  //       apikey,
  //       email,
  //     }
  //   )
  // );
  // session.close();
  // const user = records.length && records[0].get('u').properties;
  // const cooldowns = records.length && records[0].get('cooldowns');
  // const domainProps = records.length && records[0].get('d');
  // const domain = domainProps ? domainProps.properties.name : '';
  // const homepage = domainProps ? domainProps.properties.homepage : '';
  // const useHttps = domainProps ? domainProps.properties.useHttps : '';
  // return user && { ...user, cooldowns, domain, homepage, useHttps };
  return user;
};

exports.createUser = async (email, password) => {
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

  return user;
};

exports.verifyUser = async verificationToken => {
  const user = await User.findOneAndUpdate(
    { verificationToken, verificationExpires: { $gt: new Date() } },
    {
      verified: true,
      verificationToken: undefined,
      verificationExpires: undefined,
    },
    { new: true }
  );

  return user;
};

exports.changePassword = async (id, newPassword) => {
  const salt = await bcrypt.genSalt(12);
  const password = await bcrypt.hash(newPassword, salt);

  const user = await User.findByIdAndUpdate(id, { password }, { new: true });

  return user;
};

exports.generateApiKey = async id => {
  const apikey = nanoid(40);

  const user = await User.findByIdAndUpdate(id, { apikey }, { new: true });

  return user;
};

exports.requestPasswordReset = async email => {
  const resetPasswordToken = uuid();

  const user = await User.findOneAndUpdate(
    { email },
    {
      resetPasswordToken,
      resetPasswordExpires: addMinutes(new Date(), 30),
    },
    { new: true }
  );

  return user;
};

exports.resetPassword = async resetPasswordToken => {
  const user = await User.findOneAndUpdate(
    { resetPasswordToken, resetPasswordExpires: { $gt: new Date() } },
    { resetPasswordExpires: undefined, resetPasswordToken: undefined },
    { new: true }
  );

  return user;
};

exports.addCooldown = async id => {
  const user = await User.findByIdAndUpdate(
    id,
    { $push: { cooldowns: new Date() } },
    { new: true }
  );

  return user;
};

exports.banUser = async id => {
  const user = await User.findByIdAndUpdate(
    id,
    {
      banned: true,
    },
    { new: true }
  );

  return user;
};

exports.addIp = async newIp => {
  const ip = await Ip.findOneAndUpdate(
    { ip: newIp },
    { ip: newIp, createdAt: new Date() },
    { new: true, upsert: true, runValidators: true }
  );
  return ip;
};

exports.getIp = async ip => {
  const matchedIp = await Ip.findOne({
    ip,
    createdAt: { $gt: subMinutes(new Date(), Number(process.env.NON_USER_COOLDOWN)) },
  });
  return matchedIp;
};

exports.clearIps = async () =>
  Ip.deleteMany({
    createdAt: { $lt: subMinutes(new Date(), Number(process.env.NON_USER_COOLDOWN)) },
  });
