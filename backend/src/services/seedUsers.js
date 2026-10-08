require('dotenv').config();
const bcrypt = require('bcrypt');
const { query, pool } = require('../config/database');

const users = [
  { full_name: 'Cinifix Admin', email: 'admin@cinifix.com', password: '0147', role: 'ADMIN' },
  { full_name: 'Sarah Chen', email: 'client@cinifix.com', password: '0147', role: 'USER' },
];

async function seed() {
  const rounds = Number(process.env.BCRYPT_ROUNDS || 10);
  for (const user of users) {
    const hash = await bcrypt.hash(user.password, rounds);
    await query(
      `INSERT INTO users (full_name, email, password_hash, role)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (email)
       DO UPDATE SET full_name = EXCLUDED.full_name, password_hash = EXCLUDED.password_hash, role = EXCLUDED.role`,
      [user.full_name, user.email, hash, user.role]
    );
    console.log(`Seeded ${user.email}`);
  }
}

seed()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
