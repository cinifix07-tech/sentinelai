const socket = require('../socket');
const { listActivities, recordActivity } = require('../services/activityLog');

async function listAttempts(req, res, next) {
  try {
    res.json(await listActivities({ userId: req.user?.user_id, userEmail: req.user?.email }));
  } catch (error) { next(error); }
}

async function createAttempt(req, res, next) {
  try {
    const row = await recordActivity({
      req,
      result: req.body?.result || 'ACCESS_ATTEMPT',
      reason: req.body?.reason || 'Access attempt recorded',
      session_id: req.body?.session_id,
      device_id: req.body?.device_id,
      attempt_number: req.body?.attempt_number,
    });
    if (!row) return res.status(400).json({ error: 'Unable to save access activity.' });
    socket.emit(row.result === 'DENIED' ? 'access:denied' : 'access:attempt', row);
    res.status(201).json(row);
  } catch (error) { next(error); }
}

async function createActivity(req, res, next) {
  try {
    const row = await recordActivity({
      req,
      result: req.body?.result || 'USER_ACTIVITY',
      reason: req.body?.reason || 'User activity recorded',
      session_id: req.body?.session_id,
      device_id: req.body?.device_id,
    });
    if (!row) return res.status(400).json({ error: 'Unable to save activity.' });
    res.status(201).json(row);
  } catch (error) { next(error); }
}

module.exports = { listAttempts, createAttempt, createActivity };
