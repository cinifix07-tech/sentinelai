const bcrypt = require('bcrypt');
const crypto = require('crypto');
const { getUserByEmail, listRecords, insertRecord, updateRecord, syncUserAccount } = require('../services/convexData');
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

    const existing = (await listRecords('users', { limit: 1000 })).find((item) => String(item.email || item.username || '').toLowerCase() === email);
    if (existing) return res.status(409).json({ error: 'That username is already registered.' });

    const passwordHash = await bcrypt.hash(String(password), 12);
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const userId = crypto.randomUUID();
    const user = await insertRecord('users', userId, {
      user_id: userId, full_name: fullName, first_name: firstName.trim(), last_name: lastName.trim(),
      email, username: email, phone: phone?.trim() || null, password_hash: passwordHash, role: normalizedRole,
      is_active: true, noise_audio_data: noiseAudioData || null, noise_audio_name: noiseAudioName || null,
      noise_audio_type: noiseAudioType || null, voice_audio_data: voiceAudioData || null,
      voice_audio_name: voiceAudioName || null, voice_audio_type: voiceAudioType || null,
      created_at: new Date().toISOString(),
    });
    await syncUserAccount(user);
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

    const currentId = String(req.user?.user_id || '');
    const users = await listRecords('users', { limit: 1000 });
    const duplicate = users.find((item) => String(item.email || '').toLowerCase() === email && String(item._legacy_id) !== currentId);
    if (duplicate) return res.status(409).json({ error: 'That email address is already in use.' });
    const account = users.find((item) => String(item._legacy_id) === currentId || String(item.email || '').toLowerCase() === String(req.user?.email || '').toLowerCase());
    if (!account) return res.status(404).json({ error: 'User account not found.' });
    const updated = await updateRecord('users', account._legacy_id, { full_name: fullName, email, phone: phone || null, residence });
    await syncUserAccount(updated);
    await recordActivity({ req, actor: updated, result: 'PROFILE_UPDATED', reason: `User updated profile details for ${email}` });
    return res.json(updated);
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
    const account = (await listRecords('users', { limit: 1000 })).find((item) => String(item._legacy_id) === userId);
    if (!account) return res.status(404).json({ error: 'User account not found.' });
    const updated = await updateRecord('users', account._legacy_id, { password_hash: passwordHash });
    await syncUserAccount(updated);
    await recordActivity({ req, actor: updated, result: 'PASSWORD_CHANGED', reason: `${req.user?.email || 'Admin'} changed the password for ${updated.email}` });
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
    const account = identity.includes('@')
      ? (await getUserByEmail(identity)).user
      : (await listRecords('users', { limit: 1000 })).find((item) => String(item._legacy_id) === identity);
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
    const updated = await updateRecord('users', account._legacy_id || account.user_id, { password_hash: passwordHash });
    await syncUserAccount({ ...account, ...updated, password_hash: passwordHash });
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
