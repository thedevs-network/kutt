const bcrypt = require('bcryptjs');
const nanoid = require('nanoid');
const subMinutes = require('date-fns/sub_minutes');
const driver = require('./neo4j');

exports.getUser = ({ email = '', apikey = '' }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .readTransaction(tx =>
        tx.run(
          'MATCH (u:USER) WHERE u.email = $email OR u.apikey = $apikey ' +
            'OPTIONAL MATCH (u)-[r:RECEIVED]->(c) WITH u, collect(c.date) as cooldowns ' +
            'OPTIONAL MATCH (u)-[:OWNS]->(d) RETURN u, d, cooldowns',
          {
            apikey,
            email,
          }
        )
      )
      .then(res => {
        session.close();
        const user = res.records.length && res.records[0].get('u').properties;
        const cooldowns = res.records.length && res.records[0].get('cooldowns');
        const domainProps = res.records.length && res.records[0].get('d');
        const domain = domainProps ? domainProps.properties.name : '';
        const homepage = domainProps ? domainProps.properties.homepage : '';
        const useHttps = domainProps ? domainProps.properties.useHttps : '';
        return resolve(user && { ...user, cooldowns, domain, homepage, useHttps });
      })
      .catch(err => reject(err));
  });

exports.createUser = ({ email, password }) =>
  new Promise(async (resolve, reject) => {
    const session = driver.session();
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);
    const verificationToken = nanoid(40);
    session
      .writeTransaction(tx =>
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
      )
      .then(res => {
        session.close();
        const user = res.records[0].get('u').properties;
        return resolve(user);
      })
      .catch(err => reject(err));
  });

exports.verifyUser = ({ verificationToken }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (u:USER { verificationToken: $verificationToken })' +
            'SET u.verified = true SET u.verificationToken = NULL RETURN u',
          {
            verificationToken,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const user = records.length && records[0].get('u').properties;
        return resolve(user);
      })
      .catch(err => reject(err));
  });

exports.changePassword = ({ email, password }) =>
  new Promise(async (resolve, reject) => {
    const session = driver.session();
    const salt = await bcrypt.genSalt(12);
    const hash = await bcrypt.hash(password, salt);
    session
      .writeTransaction(tx =>
        tx.run('MATCH (u:USER { email: $email }) SET u.password = $password RETURN u', {
          email,
          password: hash,
        })
      )
      .then(res => {
        session.close();
        const user = res.records.length && res.records[0].get('u').properties;
        return resolve(user);
      })
      .catch(err => session.close() || reject(err));
  });

exports.generateApiKey = ({ email }) =>
  new Promise(async (resolve, reject) => {
    const session = driver.session();
    const apikey = nanoid(40);
    session
      .writeTransaction(tx =>
        tx.run('MATCH (u:USER { email: $email }) SET u.apikey = $apikey RETURN u', {
          email,
          apikey,
        })
      )
      .then(res => {
        session.close();
        const newApikey = res.records.length && res.records[0].get('u').properties.apikey;
        return resolve({ apikey: newApikey });
      })
      .catch(err => session.close() || reject(err));
  });

exports.requestPasswordReset = ({ email }) =>
  new Promise(async (resolve, reject) => {
    const session = driver.session();
    const resetPasswordExprie = Date.now() + 3600000;
    const resetPasswordToken = nanoid(40);
    session
      .writeTransaction(tx =>
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
      )
      .then(res => {
        session.close();
        const user = res.records.length && res.records[0].get('u').properties;
        return resolve(user);
      })
      .catch(err => session.close() || reject(err));
  });

exports.resetPassword = ({ resetPasswordToken }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (u:USER { resetPasswordToken: $resetPasswordToken })' +
            'SET u.resetPasswordExprie = NULL SET u.resetPasswordToken = NULL RETURN u',
          {
            resetPasswordToken,
          }
        )
      )
      .then(({ records }) => {
        session.close();
        const user = records.length && records[0].get('u').properties;
        return resolve(user);
      })
      .catch(err => reject(err));
  });

exports.addCooldown = ({ email }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (u:USER { email: $email }) ' +
            'MERGE (u)-[r:RECEIVED]->(c:COOLDOWN { date: $date }) ' +
            'RETURN COUNT(r) as count',
          {
            date: new Date().toJSON(),
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

exports.getCooldowns = ({ email }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run(
          'MATCH (u:USER { email: $email }) MATCH (u)-[r:RECEIVED]->(c) RETURN c.date as date',
          {
            date: new Date().toJSON(),
            email,
          }
        )
      )
      .then(({ records = [] }) => {
        session.close();
        const cooldowns = records.map(record => record.get('date'));
        return resolve({ cooldowns });
      })
      .catch(err => reject(err));
  });

exports.banUser = ({ email }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .writeTransaction(tx =>
        tx.run('MATCH (u:USER { email: $email }) SET u.banned = true RETURN u', {
          email,
        })
      )
      .then(({ records = [] }) => {
        session.close();
        const user = records.length && records[0].get('u');
        return resolve({ user });
      })
      .catch(err => reject(err));
  });

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
