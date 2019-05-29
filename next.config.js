const { parsed: localEnv } = require('dotenv').config();
const webpack = require('webpack'); // eslint-disable-line

module.exports = {
  webpack(config) {
    config.plugins.push(new webpack.EnvironmentPlugin(localEnv));

    return config;
  },
};
