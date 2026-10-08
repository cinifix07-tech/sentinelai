const { Pool } = require('pg');
require('dotenv').config();

const requiredEnv = [
  'DATABASE_HOST',
  'DATABASE_USER',
  'DATABASE_NAME',
  'JWT_SECRET',
];

function missingConfig() {
  const placeholderValues = new Set(['replace_me', 'replace_with_a_long_random_secret']);
  const missing = requiredEnv.filter((key) => !process.env[key] || placeholderValues.has(process.env[key]));
  if (!process.env.DATABASE_PASSWORD || placeholderValues.has(process.env.DATABASE_PASSWORD)) {
    missing.push('DATABASE_PASSWORD');
  }
  return missing;
}

const pool = new Pool({
  host: process.env.DATABASE_HOST,
  port: Number(process.env.DATABASE_PORT || 5432),
  user: process.env.DATABASE_USER,
  password: String(process.env.DATABASE_PASSWORD ?? ''),
  database: process.env.DATABASE_NAME || 'smart_home_security',
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (error) => {
  console.error('Unexpected PostgreSQL pool error:', error);
});

async function query(text, params = []) {
  const missing = missingConfig();
  if (missing.length) {
    throw Object.assign(
      new Error(`Backend database environment is incomplete. Missing: ${missing.join(', ')}. Create backend/.env from .env.example and restart the backend.`),
      { status: 503 }
    );
  }

  const started = Date.now();
  try {
    const result = await pool.query(text, params);
    if (process.env.NODE_ENV !== 'test') {
      console.log(`db ${Date.now() - started}ms ${text.split(/\s+/).slice(0, 4).join(' ')}`);
    }
    return result;
  } catch (error) {
    console.error('Database query failed:', error.message);
    throw error;
  }
}

module.exports = { pool, query, missingConfig };
