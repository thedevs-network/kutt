const bcrypt = require('bcryptjs');
const nanoid = require('nanoid');
const subMinutes = require('date-fns/sub_minutes');
const driver = require('./neo4j');

exports.getUser = async ({ email = '', apikey = '' }) => {
  const session = driver.session();
  const { records = [] } = await session.readTransaction(tx =>
    tx.run(
      'MATCH (u:USER) WHERE u.email = $email OR u.apikey = $apikey ' +
        'OPTIONAL MATCH (u)-[r:RECEIVED]->(c) WITH u, collect(c.date) as cooldowns ' +
        'OPTIONAL MATCH (u)-[:OWNS]->(d) RETURN u, d, cooldowns',
      {
        apikey,
        email,
      }
    )
  );
  session.close();
  const user = records.length && records[0].get('u').properties;
  const cooldowns = records.length && records[0].get('cooldowns');
  const domainProps = records.length && records[0].get('d');
  const domain = domainProps ? domainProps.properties.name : '';
  const homepage = domainProps ? domainProps.properties.homepage : '';
  const useHttps = domainProps ? domainProps.properties.useHttps : '';
  return user && { ...user, cooldowns, domain, homepage, useHttps };
};

exports.createUser = async ({ email, password }) => {
  const session = driver.session();
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  const verificationToken = nanoid(40);
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run(
      'MERGE (u:USER { email: $email }) ' +
        'SET u.password = $hash , u.verified = $verified , ' +
        'u.verificationToken = $verificationToken , u.createdAt = $createdAt ' +
        'RETURN u',
      {
        email,
        hash,
        createdAt: new Date().toJSON(),
        verified: false,
        verificationToken,
      }
    )
  );
  session.close();
  const user = records[0].get('u').properties;
  return user;
};

exports.verifyUser = async ({ verificationToken }) => {
  const session = driver.session();
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run(
      'MATCH (u:USER { verificationToken: $verificationToken })' +
        'SET u.verified = true SET u.verificationToken = NULL RETURN u',
      {
        verificationToken,
      }
    )
  );
  session.close();
  const user = records.length && records[0].get('u').properties;
  return user;
};

exports.changePassword = async ({ email, password }) => {
  const session = driver.session();
  const salt = await bcrypt.genSalt(12);
  const hash = await bcrypt.hash(password, salt);
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run('MATCH (u:USER { email: $email }) SET u.password = $password RETURN u', {
      email,
      password: hash,
    })
  );
  session.close();
  const user = records.length && records[0].get('u').properties;
  return user;
};

exports.generateApiKey = async ({ email }) => {
  const session = driver.session();
  const apikey = nanoid(40);
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run('MATCH (u:USER { email: $email }) SET u.apikey = $apikey RETURN u', {
      email,
      apikey,
    })
  );
  session.close();
  const newApikey = records.length && records[0].get('u').properties.apikey;
  return { apikey: newApikey };
};

exports.requestPasswordReset = async ({ email }) => {
  const session = driver.session();
  const resetPasswordExprie = Date.now() + 3600000;
  const resetPasswordToken = nanoid(40);
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run(
      'MATCH (u:USER { email: $email }) ' +
        'SET u.resetPasswordToken = $resetPasswordToken ' +
        'SET u.resetPasswordExprie = $resetPasswordExprie ' +
        'RETURN u',
      {
        email,
        resetPasswordExprie,
        resetPasswordToken,
      }
    )
  );
  session.close();
  const user = records.length && records[0].get('u').properties;
  return user;
};

exports.resetPassword = async ({ resetPasswordToken }) => {
  const session = driver.session();
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run(
      'MATCH (u:USER { resetPasswordToken: $resetPasswordToken })' +
        'SET u.resetPasswordExprie = NULL SET u.resetPasswordToken = NULL RETURN u',
      {
        resetPasswordToken,
      }
    )
  );
  session.close();
  const user = records.length && records[0].get('u').properties;
  return user;
};

exports.addCooldown = async ({ email }) => {
  const session = driver.session();
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run(
      'MATCH (u:USER { email: $email }) ' +
        'MERGE (u)-[r:RECEIVED]->(c:COOLDOWN { date: $date }) ' +
        'RETURN COUNT(r) as count',
      {
        date: new Date().toJSON(),
        email,
      }
    )
  );
  session.close();
  const count = records.length && records[0].get('count').toNumber();
  return { count };
};

exports.getCooldowns = async ({ email }) => {
  const session = driver.session();
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run('MATCH (u:USER { email: $email }) MATCH (u)-[r:RECEIVED]->(c) RETURN c.date as date', {
      date: new Date().toJSON(),
      email,
    })
  );
  session.close();
  const cooldowns = records.map(record => record.get('date'));
  return { cooldowns };
};

exports.banUser = async ({ email }) => {
  const session = driver.session();
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run('MATCH (u:USER { email: $email }) SET u.banned = true RETURN u', {
      email,
    })
  );
  session.close();
  const user = records.length && records[0].get('u');
  return { user };
};

exports.addIPCooldown = async ip => {
  const session = driver.session();
  const { records = [] } = await session.writeTransaction(tx =>
    tx.run(
      'MERGE (i:IP { ip: $ip }) ' +
        'MERGE (i)-[r:RECEIVED]->(c:COOLDOWN { date: $date }) ' +
        'RETURN COUNT(r) as count',
      {
        date: new Date().toJSON(),
        ip,
      }
    )
  );
  session.close();
  const count = records.length && records[0].get('count').toNumber();
  return count;
};

exports.getIPCooldown = async ip => {
  const session = driver.session();
  const { records = [] } = await session.readTransaction(tx =>
    tx.run(
      'MATCH (i:IP { ip: $ip }) ' +
        'MATCH (i)-[:RECEIVED]->(c:COOLDOWN) ' +
        'WHERE c.date > $date ' +
        'RETURN c.date as date',
      {
        date: subMinutes(new Date(), Number(process.env.NON_USER_COOLDOWN)).toJSON(),
        ip,
      }
    )
  );
  session.close();
  const count = records.length && records[0].get('date');
  return count;
};

exports.clearIPs = async () => {
  const session = driver.session();
  await session.writeTransaction(tx =>
    tx.run('MATCH (i:IP)-[:RECEIVED]->(c:COOLDOWN) WHERE c.date < $date DETACH DELETE i, c', {
      date: subMinutes(new Date(), Number(process.env.NON_USER_COOLDOWN)).toJSON(),
    })
  );
  session.close();
};
