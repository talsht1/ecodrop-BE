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
  reports: {
    targetEmail: process.env.REPORT_TARGET_EMAIL || '',
    fromEmail: process.env.REPORT_FROM_EMAIL || '',
    apiKey: process.env.RESEND_API_KEY || '',
    apiUrl: 'https://api.resend.com/emails',
    timeoutMs: 10000
  },
  postgres: {
    db: process.env.POSTGRES_DB || 'ecodrop',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'postgres'
  }
};

module.exports = config;
