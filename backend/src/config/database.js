const { Pool } = require('pg');
const path = require('path');

// Resolve the local file from this module so starting the backend from the
// repository root does not silently skip backend/.env.
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

function missingConfig() {
  const placeholderValues = new Set(['replace_me', 'replace_with_a_long_random_secret']);
  const missing = [];

  // Hosted providers expose one DATABASE_URL; local development can keep the
  // individual PostgreSQL settings below.
  if (!process.env.DATABASE_URL) {
    for (const key of ['DATABASE_HOST', 'DATABASE_USER', 'DATABASE_NAME', 'DATABASE_PASSWORD']) {
      if (!process.env[key] || placeholderValues.has(process.env[key])) missing.push(key);
    }
  }
  if (!process.env.JWT_SECRET || placeholderValues.has(process.env.JWT_SECRET)) missing.push('JWT_SECRET');
  return missing;
}

const pool = new Pool({
  ...(process.env.DATABASE_URL
    ? {
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: false },
      }
    : {
        host: process.env.DATABASE_HOST,
        port: Number(process.env.DATABASE_PORT || 5432),
        user: process.env.DATABASE_USER,
        password: String(process.env.DATABASE_PASSWORD ?? ''),
        database: process.env.DATABASE_NAME || 'smart_home_security',
      }),
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
