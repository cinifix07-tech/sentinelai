const crud = require('./crudController');
const socket = require('../socket');
const { findRecord, updateRecord } = require('../services/convexData');

async function heartbeat(req, res, next) {
  try {
    const device = await findRecord('devices', req.params.device_code, 'device_code');
    if (!device) return res.status(404).json({ error: 'Device not found' });
    const row = await updateRecord('devices', device._legacy_id || req.params.device_code, { is_online: true, last_seen: new Date().toISOString() }, 'device_code');
    socket.emit('device:heartbeat', row);
    res.json(row);
  } catch (error) {
    next(error);
  }
}

module.exports = {
  list: crud.list('devices', 'last_seen'),
  create: crud.create('devices', 'device:created'),
  update: crud.patch('devices', 'device:updated'),
  heartbeat,
};
