const dotenv = require('dotenv');

dotenv.config();

const config = {
  app: {
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT || 3000)
  },
  database: {
    url: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/ecodrop'
  },
  cors: {
    origin: process.env.CORS_ORIGIN || '*'
  },
  postgres: {
    db: process.env.POSTGRES_DB || 'ecodrop',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres'
  }
};

module.exports = config;
