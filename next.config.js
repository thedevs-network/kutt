const withTypescript = require('@zeit/next-typescript');
const { parsed: localEnv } = require('dotenv').config();
const webpack = require('webpack'); // eslint-disable-line

module.exports = withTypescript({
  webpack(config) {
    config.plugins.push(new webpack.EnvironmentPlugin(localEnv));

    return config;
  }
});
