require('dotenv').config();
const crypto = require('crypto');

const isProd = process.env.NODE_ENV === 'production';

function secret(name) {
  const v = process.env[name];
  if (v && v.length >= 32 && v !== 'change-me' && v !== 'change-me-too') return v;
  if (isProd) {
    console.error(`FATAL: ${name} must be set to a strong random value (>=32 chars) in production.`);
    process.exit(1);
  }
  // Dev convenience only: ephemeral secret, sessions do not survive restarts.
  return crypto.randomBytes(48).toString('hex');
}

module.exports = {
  isProd,
  port: parseInt(process.env.PORT || '8080', 10),
  dbPath: process.env.DATABASE_PATH || './data/odg.db',
  jwt: {
    accessSecret: secret('JWT_ACCESS_SECRET'),
    refreshSecret: secret('JWT_REFRESH_SECRET'),
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtlDays: parseInt(process.env.REFRESH_TOKEN_TTL_DAYS || '7', 10),
  },
  corsOrigins: (process.env.CORS_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean),
  seedOnBoot: process.env.SEED_ON_BOOT === '1',
};
