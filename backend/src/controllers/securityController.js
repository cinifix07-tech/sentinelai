const table = require('../models/table');
const socket = require('../socket');

async function createSession(req, res, next) {
  try {
    const body = {
      ...req.body,
      session_status: req.body.session_status ?? req.body.status,
      final_result: req.body.final_result ?? req.body.authorization_result,
    };
    const session = await table.insert('security_sessions', body, [
      'device_id', 'trigger_source', 'session_status', 'started_at', 'ended_at', 'final_result'
    ]);
    socket.emit('session:created', session);
    res.status(201).json(session);
  } catch (error) {
    next(error);
  }
}

module.exports = { createSession };
