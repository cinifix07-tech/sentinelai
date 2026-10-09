const crud = require('./crudController');
const socket = require('../socket');
const { findRecord, updateRecord } = require('../services/convexData');

async function markRead(req, res, next) {
  try {
    const alert = await findRecord('alerts', req.params.id, 'alert_id');
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    const row = await updateRecord('alerts', alert._legacy_id || req.params.id, { is_read: true }, 'alert_id');
    socket.emit('alert:read', row);
    res.json(row);
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
