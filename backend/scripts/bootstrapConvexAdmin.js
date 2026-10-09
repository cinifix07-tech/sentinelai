require('dotenv').config();

const bcrypt = require('bcrypt');

const email = String(process.env.ADMIN_EMAIL || '').trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD || '');
const siteUrl = String(process.env.CONVEX_SITE_URL || '').replace(/\/$/, '');
const controlToken = process.env.CONVEX_CONTROL_TOKEN;

if (!email || !password || !siteUrl || !controlToken) {
  throw new Error('ADMIN_EMAIL, ADMIN_PASSWORD, CONVEX_SITE_URL, and CONVEX_CONTROL_TOKEN are required.');
}

async function main() {
  const passwordHash = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS || 10));
  const response = await fetch(`${siteUrl}/app/users/sync`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-backend-control-token': controlToken,
    },
    body: JSON.stringify({
      payload: {
        user_id: `admin-${email}`,
        full_name: 'Sentinel AI Administrator',
        email,
        password_hash: passwordHash,
        role: 'ADMIN',
        is_active: true,
      },
    }),
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || `Convex request failed (${response.status})`);
  console.log(`Convex admin account ready: ${email}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
