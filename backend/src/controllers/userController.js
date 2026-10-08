const bcrypt = require('bcrypt');
const { query } = require('../config/database');
const { recordActivity } = require('../services/activityLog');

async function create(req, res, next) {
  try {
    const {
      first_name: firstName,
      last_name: lastName,
      phone,
      username,
      password,
      role = 'USER',
      noise_audio_data: noiseAudioData,
      noise_audio_name: noiseAudioName,
      noise_audio_type: noiseAudioType,
      voice_audio_data: voiceAudioData,
      voice_audio_name: voiceAudioName,
      voice_audio_type: voiceAudioType,
    } = req.body || {};

    const normalizedRole = String(role).toUpperCase();
    const email = String(username || '').trim().toLowerCase();
    if (!firstName?.trim() || !lastName?.trim() || !email || !password) {
      return res.status(400).json({ error: 'First name, last name, username, and password are required.' });
    }
    if (!['ADMIN', 'USER'].includes(normalizedRole)) return res.status(400).json({ error: 'Role must be ADMIN or USER.' });
    if (phone && !/^\d+$/.test(String(phone).trim())) return res.status(400).json({ error: 'Phone number must contain numbers only.' });
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/.test(String(password))) {
      return res.status(400).json({ error: 'Password must be 10+ characters and include uppercase, lowercase, number, and symbol.' });
    }
    if (noiseAudioData && String(noiseAudioData).length > 7_000_000) return res.status(413).json({ error: 'Background noise audio is too large.' });
    if (voiceAudioData && String(voiceAudioData).length > 7_000_000) return res.status(413).json({ error: 'Voice introduction audio is too large.' });

    await query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS first_name TEXT,
        ADD COLUMN IF NOT EXISTS last_name TEXT,
        ADD COLUMN IF NOT EXISTS username TEXT,
        ADD COLUMN IF NOT EXISTS noise_audio_data TEXT,
        ADD COLUMN IF NOT EXISTS noise_audio_name TEXT,
        ADD COLUMN IF NOT EXISTS noise_audio_type TEXT,
        ADD COLUMN IF NOT EXISTS voice_audio_data TEXT,
        ADD COLUMN IF NOT EXISTS voice_audio_name TEXT,
        ADD COLUMN IF NOT EXISTS voice_audio_type TEXT
    `);

    const existing = await query('SELECT user_id FROM users WHERE email = $1 OR username = $1 LIMIT 1', [email]);
    if (existing.rows[0]) return res.status(409).json({ error: 'That username is already registered.' });

    const passwordHash = await bcrypt.hash(String(password), 12);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const result = await query(
      `INSERT INTO users
        (full_name, first_name, last_name, email, username, phone, password_hash, role, is_active,
         noise_audio_data, noise_audio_name, noise_audio_type, voice_audio_data, voice_audio_name, voice_audio_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9, $10, $11, $12, $13, $14)
       RETURNING user_id, full_name, first_name, last_name, email, username, phone, role, is_active, created_at`,
      [fullName, firstName.trim(), lastName.trim(), email, email, phone?.trim() || null, passwordHash, normalizedRole,
        noiseAudioData || null, noiseAudioName || null, noiseAudioType || null,
        voiceAudioData || null, voiceAudioName || null, voiceAudioType || null]
    );
    const user = result.rows[0];
    await recordActivity({ req, actor: user, result: 'USER_CREATED', reason: `${req.user?.email || 'Admin'} created user ${user.email}` });
    return res.status(201).json(user);
  } catch (error) {
    return next(error);
  }
}

async function updateSelf(req, res, next) {
  try {
    const fullName = String(req.body?.full_name || req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const residence = String(req.body?.residence || '').trim();
    if (!fullName || !email || !residence) return res.status(400).json({ error: 'Full name, email, and residence are required.' });
    if (phone && !/^\d+$/.test(phone)) return res.status(400).json({ error: 'Phone number must contain numbers only.' });

    await query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS residence TEXT,
        ADD COLUMN IF NOT EXISTS phone TEXT
    `);
    const currentId = String(req.user?.user_id || '');
    const duplicate = await query(
      'SELECT user_id FROM users WHERE lower(email) = $1 AND user_id::text <> $2 LIMIT 1',
      [email, currentId]
    );
    if (duplicate.rows[0]) return res.status(409).json({ error: 'That email address is already in use.' });

    const result = await query(`
      UPDATE users
      SET full_name = $1, email = $2, phone = $3, residence = $4
      WHERE user_id::text = $5 OR lower(email) = lower($2)
      RETURNING user_id, full_name, email, phone, residence, role, is_active, created_at
    `, [fullName, email, phone || null, residence, currentId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User account not found.' });
    await recordActivity({ req, actor: result.rows[0], result: 'PROFILE_UPDATED', reason: `User updated profile details for ${email}` });
    return res.json(result.rows[0]);
  } catch (error) {
    return next(error);
  }
}

async function changePassword(req, res, next) {
  try {
    const userId = String(req.params.id || '').trim();
    const password = String(req.body?.password || '');
    if (!userId || !password) return res.status(400).json({ error: 'A new password is required.' });
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/.test(password)) {
      return res.status(400).json({ error: 'Password must be 10+ characters and include uppercase, lowercase, number, and symbol.' });
    }
    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(`
      UPDATE users
      SET password_hash = $1
      WHERE user_id::text = $2
      RETURNING user_id, full_name, email, role
    `, [passwordHash, userId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'User account not found.' });
    await recordActivity({ req, actor: result.rows[0], result: 'PASSWORD_CHANGED', reason: `${req.user?.email || 'Admin'} changed the password for ${result.rows[0].email}` });
    return res.json({ ok: true });
  } catch (error) {
    return next(error);
  }
}

async function changeSelfPassword(req, res, next) {
  try {
    const currentPassword = String(req.body?.current_password || req.body?.current || '');
    const newPassword = String(req.body?.new_password || req.body?.password || '');

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current password and new password are required.' });
    }
    if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).{10,}$/.test(newPassword)) {
      return res.status(400).json({ error: 'Password must be 10+ characters and include uppercase, lowercase, number, and symbol.' });
    }
    if (currentPassword === newPassword) {
      return res.status(400).json({ error: 'Your new password must be different from the current password.' });
    }

    const identity = String(req.user?.user_id || req.user?.email || '').trim();
    const accountResult = await query(`
      SELECT user_id, full_name, email, password_hash, password
        FROM users
       WHERE user_id::text = $1 OR lower(email) = lower($1)
       LIMIT 1
    `, [identity]);
    const account = accountResult.rows[0];
    const storedPassword = account?.password_hash || account?.password;
    const validCurrentPassword = account && storedPassword
      ? await bcrypt.compare(currentPassword, storedPassword)
      : false;

    if (!account || !validCurrentPassword) {
      await recordActivity({
        req,
        actor: account || req.user,
        result: 'PASSWORD_CHANGE_FAILED',
        reason: 'User entered an incorrect current password',
      });
      return res.status(401).json({ error: 'Current password is incorrect.' });
    }

    const passwordHash = await bcrypt.hash(newPassword, 12);
    await query('UPDATE users SET password_hash = $1 WHERE user_id = $2', [passwordHash, account.user_id]);
    await recordActivity({
      req,
      actor: account,
      result: 'PASSWORD_CHANGED',
      reason: 'User changed their account password',
    });
    return res.json({ ok: true, message: 'Account password updated successfully.' });
  } catch (error) {
    return next(error);
  }
}

module.exports = { create, updateSelf, changePassword, changeSelfPassword };
