const env = require("./env");
const app = require("./app");

app.listen(env.PORT, () => {
  console.log(`> Ready on http://localhost:${env.PORT}`);
});

