const config = require('./app/config');
const { createApp, pool } = require('./app/server');

if (require.main === module) {
  const app = createApp({ pool });
  app.listen(config.app.port, () => {
    console.log(`EcoDrop API listening on port ${config.app.port}`);
  });
}

module.exports = { createApp, pool };
