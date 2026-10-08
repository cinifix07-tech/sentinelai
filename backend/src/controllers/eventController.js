const table = require('../models/table');
const socket = require('../socket');

async function createEvent(req, res, next) {
  try {
    const allowed = ['MOTION_DETECTED', 'VOICE_AUTH_SUCCESS', 'VOICE_AUTH_FAILED', 'ACCESS_GRANTED', 'ACCESS_DENIED'];
    if (!allowed.includes(req.body.event_type)) return res.status(400).json({ error: 'Unsupported event_type' });
    const body = {
      ...req.body,
      description: req.body.description ?? req.body.event_message,
      event_status: req.body.event_status ?? req.body.severity,
    };
    const row = await table.insert('security_events', body, [
      'device_id', 'session_id', 'event_type', 'event_status', 'description', 'confidence'
    ]);
    socket.emit('security:event', row);
    res.status(201).json(row);
  } catch (error) { next(error); }
}

module.exports = { createEvent, listEvents: tableList };

async function tableList(req, res, next) {
  try { res.json(await table.list('security_events', 'occurred_at')); } catch (error) { next(error); }
}
