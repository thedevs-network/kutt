const bcrypt = require('bcryptjs');
const nanoid = require('nanoid');
const driver = require('./neo4j');

exports.getUser = ({ email = '', apikey = '' }) =>
  new Promise((resolve, reject) => {
    const session = driver.session();
    session
      .readTransaction(tx =>
        tx.run(
          'MATCH (u:USER) WHERE u.email = $email OR u.apikey = $apikey ' +
            'OPTIONAL MATCH (u)-[:OWNS]->(l) RETURN u, l',
          {
            apikey,
            email,
          }
        )
      )
      .then(res => {
        session.close();
        const user = res.records.length && res.records[0].get('u').properties;
        const domainProps = res.records.length && res.records[0].get('l');
        const domain = domainProps ? domainProps.properties.name : '';
        return resolve(user && { ...user, domain });
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
      .catch(reject);
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
      .catch(reject);
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
      .catch(reject);
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
