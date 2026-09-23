const fs = require("node:fs");

module.exports = async (hbs, bundled, custom) => {
  const register = directory => new Promise((resolve, reject) => {
    hbs.registerPartials(directory, error => error ? reject(error) : resolve());
  });
  await register(bundled);
  // Completion order, not filesystem timing, determines custom precedence.
  if (fs.existsSync(custom)) await register(custom);
};
