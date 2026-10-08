const table = require('../models/table');
const { recordActivity } = require('../services/activityLog');

const fields = {
  users: ['full_name', 'name', 'email', 'phone', 'role', 'is_active'],
  devices: ['device_code', 'device_name', 'location', 'device_type', 'firmware_version', 'is_online', 'last_seen'],
  interview_questions: ['session_id', 'question_text', 'question_order'],
  security_events: ['device_id', 'session_id', 'event_type', 'event_status', 'description', 'confidence'],
  alerts: ['session_id', 'alert_level', 'title', 'message', 'is_read'],
};

const idColumns = {
  users: 'user_id',
  devices: 'device_id',
  interview_questions: 'question_id',
  security_events: 'event_id',
  alerts: 'alert_id',
};

function list(tableName, order = 'created_at') {
  return async (req, res, next) => {
    try { res.json(await table.list(tableName, order)); } catch (error) { next(error); }
  };
}

function get(tableName) {
  return async (req, res, next) => {
    try {
      const row = await table.findById(tableName, idColumns[tableName], req.params.id);
      if (!row) return res.status(404).json({ error: 'Record not found' });
      res.json(row);
    } catch (error) { next(error); }
  };
}

function create(tableName, eventName) {
  return async (req, res, next) => {
    try {
      const row = await table.insert(tableName, req.body, fields[tableName]);
      if (eventName) require('../socket').emit(eventName, row);
      res.status(201).json(row);
    } catch (error) { next(error); }
  };
}

function patch(tableName, eventName) {
  return async (req, res, next) => {
    try {
      const row = await table.update(tableName, idColumns[tableName], req.params.id, req.body, fields[tableName]);
      if (!row) return res.status(404).json({ error: 'Record not found' });
      if (eventName) require('../socket').emit(eventName, row);
      if (tableName === 'users') {
        await recordActivity({
          req,
          actor: row,
          result: 'USER_UPDATED',
          reason: `${req.user?.email || 'Admin'} updated user ${row.email || req.params.id}`,
        });
      }
      res.json(row);
    } catch (error) { next(error); }
  };
}

function remove(tableName) {
  return async (req, res, next) => {
    try {
      const row = await table.remove(tableName, idColumns[tableName], req.params.id);
      if (!row) return res.status(404).json({ error: 'Record not found' });
      if (tableName === 'users') {
        await recordActivity({
          req,
          actor: row,
          result: 'USER_DELETED',
          reason: `${req.user?.email || 'Admin'} deleted user ${row.email || req.params.id}`,
        });
      }
      res.json({ deleted: true, record: row });
    } catch (error) { next(error); }
  };
}

module.exports = { list, get, create, patch, remove };
