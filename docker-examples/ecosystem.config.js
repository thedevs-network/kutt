module.exports = {
  apps: [
    {
      name: 'kutt',
      script: './server/server.js',
      env_production: {
        NODE_ENV: 'production',
      },
    },
  ],
};
