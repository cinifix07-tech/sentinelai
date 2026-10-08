const { query } = require('../config/database');
const crud = require('./crudController');
const socket = require('../socket');

async function markRead(req, res, next) {
  try {
    const result = await query('UPDATE alerts SET is_read = true WHERE alert_id = $1 RETURNING *', [req.params.id]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Alert not found' });
    socket.emit('alert:read', result.rows[0]);
    res.json(result.rows[0]);
  } catch (error) { next(error); }
}

async function createAlert(req, res, next) {
  try {
    const body = {
      ...req.body,
      alert_level: req.body.alert_level ?? req.body.severity ?? req.body.alert_type,
    };
    const row = await require('../models/table').insert('alerts', body, [
      'session_id', 'alert_level', 'title', 'message', 'is_read'
    ]);
    socket.emit('alert:new', row);
    res.status(201).json(row);
  } catch (error) { next(error); }
}

module.exports = {
  list: crud.list('alerts', 'created_at'),
  create: createAlert,
  markRead,
};
