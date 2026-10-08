const { listRecords, findRecord, insertRecord, updateRecord, deleteRecord } = require('../services/convexData');

const identifier = /^[a-z_][a-z0-9_]*$/i;
const idColumns = {
  users: 'user_id',
  devices: 'device_id',
  interview_questions: 'question_id',
  security_events: 'event_id',
  alerts: 'alert_id',
};

function assertIdentifier(value) {
  if (!identifier.test(value)) throw new Error(`Unsafe SQL identifier: ${value}`);
  return value;
}

function compact(data, allowed) {
  return Object.fromEntries(
    Object.entries(data || {}).filter(([key, value]) => allowed.includes(key) && value !== undefined)
  );
}

async function list(table, orderColumn = 'created_at', limit = 100) {
  table = assertIdentifier(table);
  orderColumn = assertIdentifier(orderColumn);
  return listRecords(table, { order: orderColumn, limit });
}

async function findById(table, idColumn, id) {
  table = assertIdentifier(table);
  idColumn = assertIdentifier(idColumn);
  return findRecord(table, id, idColumn);
}

async function insert(table, data, allowed) {
  table = assertIdentifier(table);
  const row = compact(data, allowed);
  const keys = Object.keys(row).map(assertIdentifier);
  if (!keys.length) throw Object.assign(new Error('No valid fields supplied'), { status: 400 });
  const id = String(row[idColumns[table] || 'id'] || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  return insertRecord(table, id, { ...row, [idColumns[table] || 'id']: id });
}

async function update(table, idColumn, id, data, allowed) {
  table = assertIdentifier(table);
  idColumn = assertIdentifier(idColumn);
  const row = compact(data, allowed);
  const keys = Object.keys(row).map(assertIdentifier);
  if (!keys.length) throw Object.assign(new Error('No valid fields supplied'), { status: 400 });
  return updateRecord(table, id, row, idColumn);
}

async function remove(table, idColumn, id) {
  table = assertIdentifier(table);
  idColumn = assertIdentifier(idColumn);
  return deleteRecord(table, id, idColumn);
}

module.exports = { compact, list, findById, insert, update, remove };
