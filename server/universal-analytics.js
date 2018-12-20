const ua = require('universal-analytics');
const config = require('./config');

const visitor = ua(config.GOOGLE_ANALYTICS);

module.exports = visitor;
