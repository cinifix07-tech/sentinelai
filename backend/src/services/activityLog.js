const { listRecords, insertRecord } = require('./convexData');
const socket = require('../socket');

const TABLE_NAME = 'access_attempts';
const RETAINED_ACTIVITY_LIMIT = 1000;

function convexActivityRow(row) {
  return { ...row, id: row.attempt_id || row._legacy_id, created_at: row.created_at || row.attempt_time };
}

async function listActivitiesConvex({ userId, userEmail } = {}) {
  const rows = await listRecords('access_attempts', { order: 'attempt_time', limit: RETAINED_ACTIVITY_LIMIT });
  return rows
    .filter((row) => !userId && !userEmail || (userId && String(row.user_id || '') === String(userId)) || (userEmail && String(row.user_email || '').toLowerCase() === String(userEmail).toLowerCase()))
    .map(convexActivityRow);
}

async function pruneActivityLogConvex() {
  return { total: 0, deleted: 0 };
}

async function recordActivityConvex({ req, actor, result = 'ACTIVITY', reason = 'Activity recorded', session_id, device_id } = {}) {
  try {
    const resolved = actor || req?.user || {};
    const id = `activity:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const now = new Date().toISOString();
    const row = {
      attempt_id: id,
      session_id: session_id || null,
      device_id: device_id || null,
      result: String(result),
      reason: String(reason),
      attempt_time: now,
      created_at: now,
      user_id: resolved.user_id || resolved.id || resolved.email || null,
      user_name: resolved.full_name || resolved.name || null,
      user_email: resolved.email || null,
    };
    const inserted = await insertRecord('access_attempts', id, row);
    const normalized = convexActivityRow(inserted);
    socket.emit('activity:new', normalized);
    return normalized;
  } catch (error) {
    console.warn('Convex activity log skipped:', error.message);
    return null;
  }
}
let cachedColumns = null;

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function getActivityColumns() {
  if (cachedColumns) return cachedColumns;
  await query(`
    ALTER TABLE ${quoteIdentifier(TABLE_NAME)}
      ADD COLUMN IF NOT EXISTS "user_id" TEXT,
      ADD COLUMN IF NOT EXISTS "user_name" TEXT,
      ADD COLUMN IF NOT EXISTS "user_email" TEXT
  `);
  const result = await query(
    `SELECT column_name
       FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = $1`,
    [TABLE_NAME]
  );
  cachedColumns = new Set(result.rows.map((row) => row.column_name));
  if (cachedColumns.has('reason')) {
    await query(`
      UPDATE ${quoteIdentifier(TABLE_NAME)} AS activity
         SET "user_id" = users.user_id::text,
             "user_name" = users.full_name,
             "user_email" = users.email
        FROM users
       WHERE (activity."user_id" IS NULL OR activity."user_name" IS NULL)
         AND activity.reason ILIKE '%' || users.email || '%'
    `);
  }
  return cachedColumns;
}

function getOrderColumn(columns) {
  if (columns.has('attempt_time')) return 'attempt_time';
  if (columns.has('created_at')) return 'created_at';
  if (columns.has('updated_at')) return 'updated_at';
  if (columns.has('attempt_id')) return 'attempt_id';
  if (columns.has('id')) return 'id';
  return null;
}

async function nextAttemptNumber(columns) {
  if (!columns.has('attempt_number')) return null;
  const result = await query(
    `SELECT COALESCE(MAX(attempt_number), 0) + 1 AS next_number FROM ${quoteIdentifier(TABLE_NAME)}`
  );
  return Number(result.rows[0]?.next_number || 1);
}

async function pruneActivityLog(columns = null) {
  const resolvedColumns = columns || await getActivityColumns();
  const orderColumn = getOrderColumn(resolvedColumns);
  const orderSql = orderColumn ? `${quoteIdentifier(orderColumn)} DESC NULLS LAST` : 'ctid DESC';
  const countResult = await query(`SELECT COUNT(*)::int AS total FROM ${quoteIdentifier(TABLE_NAME)}`);
  const total = Number(countResult.rows[0]?.total || 0);

  if (total === RETAINED_ACTIVITY_LIMIT) {
    socket.emit('activity:limit', {
      retained: RETAINED_ACTIVITY_LIMIT,
      deleted: 0,
      message: `Activity log reached ${RETAINED_ACTIVITY_LIMIT} records.`,
    });
  }

  if (total <= RETAINED_ACTIVITY_LIMIT) return { total, deleted: 0 };

  const deleteResult = await query(
    `DELETE FROM ${quoteIdentifier(TABLE_NAME)}
      WHERE ctid IN (
        SELECT ctid
          FROM ${quoteIdentifier(TABLE_NAME)}
         ORDER BY ${orderSql}
        OFFSET $1
      )`,
    [RETAINED_ACTIVITY_LIMIT]
  );
  const deleted = deleteResult.rowCount || 0;
  socket.emit('activity:retention', {
    retained: RETAINED_ACTIVITY_LIMIT,
    deleted,
    message: `${deleted} older activity record${deleted === 1 ? '' : 's'} permanently deleted. No archive was saved.`,
  });
  return { total: RETAINED_ACTIVITY_LIMIT, deleted };
}

async function listActivities({ userId, userEmail } = {}) {
  const columns = await getActivityColumns();
  await pruneActivityLog(columns);
  const orderColumn = getOrderColumn(columns);
  const orderSql = orderColumn ? `${quoteIdentifier(orderColumn)} DESC NULLS LAST` : 'ctid DESC';
  const selectFields = ['*'];
  const filters = [];
  const params = [];

  if (columns.has('user_id') && userId) {
    params.push(String(userId));
    filters.push(`${quoteIdentifier('user_id')} = $${params.length}`);
  } else if (columns.has('user_email') && userEmail) {
    params.push(String(userEmail).toLowerCase());
    filters.push(`lower(${quoteIdentifier('user_email')}) = $${params.length}`);
  }

  if (columns.has('attempt_time') && !columns.has('created_at')) {
    selectFields.push('attempt_time AS created_at');
  }
  if (!columns.has('reason')) {
    selectFields.push('result AS reason');
  }
  if (!columns.has('user_id')) {
    selectFields.push('NULL AS user_id');
  }
  if (!columns.has('device_id')) {
    selectFields.push('NULL AS device_id');
  }

  const result = await query(
    `SELECT ${selectFields.join(', ')}
       FROM ${quoteIdentifier(TABLE_NAME)}
      ${filters.length ? `WHERE ${filters.join(' AND ')}` : ''}
      ORDER BY ${orderSql}
      LIMIT $${params.length + 1}`,
    [...params, RETAINED_ACTIVITY_LIMIT]
  );
  return result.rows;
}

async function recordActivity({
  req,
  actor,
  result = 'ACTIVITY',
  reason = 'Activity recorded',
  session_id,
  device_id,
  attempt_number,
} = {}) {
  try {
    const columns = await getActivityColumns();
    const row = {};
    const resolvedActor = actor || req?.user || {};

    if (columns.has('session_id') && session_id !== undefined) row.session_id = session_id;
    if (columns.has('device_id') && device_id !== undefined) row.device_id = device_id;
    const requestActor = req?.user;
    const effectiveActor = requestActor || resolvedActor;
    let actorProfile = effectiveActor;
    if (effectiveActor.user_id || effectiveActor.id || effectiveActor.email) {
      const actorResult = await query(
        `SELECT user_id::text AS user_id, full_name, email
           FROM users
          WHERE user_id::text = $1 OR lower(email) = lower($1)
          LIMIT 1`,
        [String(effectiveActor.user_id || effectiveActor.id || effectiveActor.email)]
      );
      actorProfile = actorResult.rows[0] || effectiveActor;
    }
    if (columns.has('user_id') && (actorProfile.user_id || actorProfile.id || actorProfile.email)) {
      row.user_id = actorProfile.user_id || actorProfile.id || actorProfile.email;
    }
    if (columns.has('user_name') && (actorProfile.full_name || actorProfile.name)) {
      row.user_name = String(actorProfile.full_name || actorProfile.name).slice(0, 160);
    }
    if (columns.has('user_email') && actorProfile.email) {
      row.user_email = String(actorProfile.email).slice(0, 255);
    }
    if (columns.has('attempt_number')) row.attempt_number = attempt_number || await nextAttemptNumber(columns);
    if (columns.has('result')) row.result = String(result).slice(0, 80);
    if (columns.has('reason')) row.reason = String(reason).slice(0, 255);
    if (columns.has('attempt_time')) row.attempt_time = new Date();
    if (columns.has('created_at')) row.created_at = new Date();

    const keys = Object.keys(row);
    if (!keys.length) return null;

    const columnsSql = keys.map(quoteIdentifier).join(', ');
    const valuesSql = keys.map((_, index) => `$${index + 1}`).join(', ');
    let insertResult;
    try {
      insertResult = await query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAME)} (${columnsSql}) VALUES (${valuesSql}) RETURNING *`,
        keys.map((key) => row[key])
      );
    } catch (error) {
      if (!columns.has('result') || ['GRANTED', 'DENIED'].includes(row.result)) throw error;
      if (columns.has('reason')) row.reason = `[${row.result}] ${row.reason || reason}`.slice(0, 255);
      row.result = String(result).toUpperCase().includes('FAILED') ? 'DENIED' : 'GRANTED';
      const fallbackKeys = Object.keys(row);
      insertResult = await query(
        `INSERT INTO ${quoteIdentifier(TABLE_NAME)} (${fallbackKeys.map(quoteIdentifier).join(', ')}) VALUES (${fallbackKeys.map((_, index) => `$${index + 1}`).join(', ')}) RETURNING *`,
        fallbackKeys.map((key) => row[key])
      );
    }
    const inserted = insertResult.rows[0];
    await pruneActivityLog(columns);
    socket.emit('activity:new', inserted);
    return inserted;
  } catch (error) {
    console.warn('Activity log skipped:', error.message);
    return null;
  }
}

module.exports = {
  RETAINED_ACTIVITY_LIMIT,
  listActivities: listActivitiesConvex,
  pruneActivityLog: pruneActivityLogConvex,
  recordActivity: recordActivityConvex,
};
