const { query } = require('../config/database');

const identifier = /^[a-z_][a-z0-9_]*$/i;

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
  const result = await query(`SELECT * FROM ${table} ORDER BY ${orderColumn} DESC LIMIT $1`, [limit]);
  return result.rows;
}

async function findById(table, idColumn, id) {
  table = assertIdentifier(table);
  idColumn = assertIdentifier(idColumn);
  const result = await query(`SELECT * FROM ${table} WHERE ${idColumn} = $1`, [id]);
  return result.rows[0] || null;
}

async function insert(table, data, allowed) {
  table = assertIdentifier(table);
  const row = compact(data, allowed);
  const keys = Object.keys(row).map(assertIdentifier);
  if (!keys.length) throw Object.assign(new Error('No valid fields supplied'), { status: 400 });
  const columns = keys.join(', ');
  const placeholders = keys.map((_, index) => `$${index + 1}`).join(', ');
  const values = keys.map((key) => row[key]);
  const result = await query(`INSERT INTO ${table} (${columns}) VALUES (${placeholders}) RETURNING *`, values);
  return result.rows[0];
}

async function update(table, idColumn, id, data, allowed) {
  table = assertIdentifier(table);
  idColumn = assertIdentifier(idColumn);
  const row = compact(data, allowed);
  const keys = Object.keys(row).map(assertIdentifier);
  if (!keys.length) throw Object.assign(new Error('No valid fields supplied'), { status: 400 });
  const setSql = keys.map((key, index) => `${key} = $${index + 1}`).join(', ');
  const values = keys.map((key) => row[key]);
  values.push(id);
  const result = await query(`UPDATE ${table} SET ${setSql} WHERE ${idColumn} = $${values.length} RETURNING *`, values);
  return result.rows[0] || null;
}

async function remove(table, idColumn, id) {
  table = assertIdentifier(table);
  idColumn = assertIdentifier(idColumn);
  const result = await query(`DELETE FROM ${table} WHERE ${idColumn} = $1 RETURNING *`, [id]);
  return result.rows[0] || null;
}

module.exports = { compact, list, findById, insert, update, remove };
