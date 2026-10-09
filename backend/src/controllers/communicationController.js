const { randomUUID } = require('crypto');
const { listRecords, insertRecord, updateRecord, deleteRecord } = require('../services/convexData');

let schemaPromise;

function ensureCommunicationSchema() {
  if (!schemaPromise) {
    schemaPromise = query(`
      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS residence TEXT,
        ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,
        ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
      CREATE TABLE IF NOT EXISTS communication_messages (
        message_id BIGSERIAL PRIMARY KEY,
        sender_user_id TEXT NOT NULL,
        recipient_user_id TEXT NOT NULL,
        message TEXT NOT NULL CHECK (length(trim(message)) > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        read_at TIMESTAMPTZ
      );
      ALTER TABLE communication_messages
        ADD COLUMN IF NOT EXISTS attachment_data TEXT,
        ADD COLUMN IF NOT EXISTS attachment_name TEXT,
        ADD COLUMN IF NOT EXISTS attachment_type TEXT,
        ADD COLUMN IF NOT EXISTS attachment_size INTEGER;
      ALTER TABLE communication_messages
        DROP CONSTRAINT IF EXISTS communication_messages_message_check;
      ALTER TABLE communication_messages
        ADD CONSTRAINT communication_messages_message_check
        CHECK (length(trim(message)) > 0 OR attachment_data IS NOT NULL);
      CREATE TABLE IF NOT EXISTS communication_visitors (
        visitor_id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        purpose TEXT NOT NULL,
        admin_user_id TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS communication_messages_participants_idx
        ON communication_messages (sender_user_id, recipient_user_id, created_at);
      CREATE TABLE IF NOT EXISTS communication_groups (
        group_id BIGSERIAL PRIMARY KEY,
        group_name TEXT NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE TABLE IF NOT EXISTS communication_group_members (
        group_id BIGINT NOT NULL REFERENCES communication_groups(group_id) ON DELETE CASCADE,
        user_id TEXT NOT NULL,
        joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        PRIMARY KEY (group_id, user_id)
      );
      CREATE TABLE IF NOT EXISTS communication_group_messages (
        message_id BIGSERIAL PRIMARY KEY,
        group_id BIGINT NOT NULL REFERENCES communication_groups(group_id) ON DELETE CASCADE,
        sender_user_id TEXT NOT NULL,
        message TEXT NOT NULL CHECK (length(trim(message)) > 0),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS communication_group_messages_idx
        ON communication_group_messages (group_id, created_at);
    `).catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function listPeople(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const filter = String(req.query.filter || 'all').toLowerCase();
    const role = filter === 'admin' ? 'ADMIN' : filter === 'residence' ? 'USER' : null;
    const result = await query(`
      SELECT user_id::text AS user_id, full_name, email, role, COALESCE(residence, 'Main Residence') AS residence,
        is_active, last_seen_at,
        (last_seen_at IS NULL OR last_seen_at > NOW() - INTERVAL '2 minutes') AS online,
        (SELECT COUNT(*)::int FROM communication_messages cm
          WHERE cm.sender_user_id = users.user_id::text
            AND cm.recipient_user_id = $2
            AND cm.read_at IS NULL) AS unread_count
      FROM users
      WHERE COALESCE(is_active, TRUE) = TRUE
        AND ($1::text IS NULL OR role = $1)
      UNION ALL
      SELECT visitor_id AS user_id, full_name, NULL AS email, 'VISITOR' AS role,
        'Visitor intake' AS residence, TRUE AS is_active, last_seen_at,
        (last_seen_at > NOW() - INTERVAL '15 minutes') AS online,
        (SELECT COUNT(*)::int FROM communication_messages cm
          WHERE cm.sender_user_id = communication_visitors.visitor_id
            AND cm.recipient_user_id = $2
            AND cm.read_at IS NULL) AS unread_count
      FROM communication_visitors
      WHERE $1::text IS NULL
      ORDER BY online DESC, role ASC, full_name ASC NULLS LAST, email ASC
    `, [role, String(req.user.user_id || req.user.email)]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

async function heartbeat(req, res, next) {
  try {
    await ensureCommunicationSchema();
    await query('UPDATE users SET last_seen_at = NOW() WHERE user_id::text = $1 OR email = $1', [String(req.user.user_id || req.user.email)]);
    res.json({ ok: true, last_seen_at: new Date().toISOString() });
  } catch (error) {
    next(error);
  }
}

async function listMessages(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const participant = String(req.params.userId || '').trim();
    if (!participant) return res.status(400).json({ error: 'A communication participant is required.' });
    const current = String(req.user.user_id || req.user.email);
    const result = await query(`
      SELECT message_id, sender_user_id, recipient_user_id, message, created_at, read_at,
        attachment_data, attachment_name, attachment_type, attachment_size
      FROM communication_messages
      WHERE (sender_user_id = $1 AND recipient_user_id = $2)
         OR (sender_user_id = $2 AND recipient_user_id = $1)
      ORDER BY created_at ASC
      LIMIT 300
    `, [current, participant]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

async function sendMessage(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const recipient = String(req.body?.recipient_user_id || '').trim();
    const message = String(req.body?.message || '').trim();
    const attachmentData = String(req.body?.attachment_data || '').trim();
    const attachmentName = String(req.body?.attachment_name || '').trim();
    const attachmentType = String(req.body?.attachment_type || '').trim().toLowerCase();
    const attachmentSize = Number(req.body?.attachment_size || 0);
    if (!recipient || (!message && !attachmentData)) return res.status(400).json({ error: 'Message or attachment is required.' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message must be 2000 characters or fewer.' });
    if (attachmentData) {
      const supportedTypes = ['application/pdf', 'text/plain', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!/^data:[\w.+-]+\/[\w.+-]+;base64,[a-z0-9+/=]+$/i.test(attachmentData)) return res.status(400).json({ error: 'Invalid attachment format.' });
      if (!attachmentName || !attachmentType || !Number.isFinite(attachmentSize) || attachmentSize <= 0 || attachmentSize > 8 * 1024 * 1024) return res.status(400).json({ error: 'Attachments must be 8 MB or smaller.' });
      if (!/^(image|video|audio)\//.test(attachmentType) && !supportedTypes.includes(attachmentType)) return res.status(400).json({ error: 'This file type is not supported.' });
    }
    const sender = String(req.user.user_id || req.user.email);
    if (sender === recipient) return res.status(400).json({ error: 'Choose another user to start a conversation.' });
    const result = await query(`
      INSERT INTO communication_messages (sender_user_id, recipient_user_id, message, attachment_data, attachment_name, attachment_type, attachment_size)
      VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, 0))
      RETURNING message_id, sender_user_id, recipient_user_id, message, created_at, read_at,
        attachment_data, attachment_name, attachment_type, attachment_size
    `, [sender, recipient, message, attachmentData, attachmentName, attachmentType, attachmentSize]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function markMessagesRead(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const current = String(req.user.user_id || req.user.email);
    const participant = String(req.params.userId || '').trim();
    await query(`
      UPDATE communication_messages
      SET read_at = NOW()
      WHERE sender_user_id = $1 AND recipient_user_id = $2 AND read_at IS NULL
    `, [participant, current]);
    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
}

async function listNotifications(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const current = String(req.user.user_id || req.user.email);
    const result = await query(`
      SELECT cm.message_id, cm.sender_user_id, cm.message, cm.created_at,
        COALESCE(u.full_name, u.email, 'User') AS sender_name
      FROM communication_messages cm
      LEFT JOIN users u ON u.user_id::text = cm.sender_user_id
      WHERE cm.recipient_user_id = $1 AND cm.read_at IS NULL
      ORDER BY cm.created_at DESC
      LIMIT 20
    `, [current]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

async function createGroup(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const name = String(req.body?.name || '').trim();
    const requestedMembers = Array.isArray(req.body?.member_user_ids) ? req.body.member_user_ids.map(String).map((id) => id.trim()).filter(Boolean) : [];
    const creator = String(req.user.user_id || req.user.email);
    const members = [...new Set([creator, ...requestedMembers])];
    if (!name) return res.status(400).json({ error: 'A group name is required.' });
    if (name.length > 80) return res.status(400).json({ error: 'Group name must be 80 characters or fewer.' });
    if (members.length < 2) return res.status(400).json({ error: 'Select at least one other user for the group.' });

    const groupResult = await query(`
      INSERT INTO communication_groups (group_name, created_by)
      VALUES ($1, $2)
      RETURNING group_id, group_name, created_by, created_at
    `, [name, creator]);
    const group = groupResult.rows[0];
    for (const userId of members) {
      await query(`
        INSERT INTO communication_group_members (group_id, user_id)
        VALUES ($1, $2)
        ON CONFLICT (group_id, user_id) DO NOTHING
      `, [group.group_id, userId]);
    }
    res.status(201).json({ ...group, member_user_ids: members });
  } catch (error) {
    next(error);
  }
}

async function listGroups(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const current = String(req.user.user_id || req.user.email);
    const result = await query(`
      SELECT cg.group_id, cg.group_name, cg.created_by, cg.created_at,
        COUNT(cgm.user_id)::int AS member_count,
        COALESCE(json_agg(json_build_object(
          'user_id', cgm.user_id,
          'full_name', COALESCE(u.full_name, u.email, cgm.user_id)
        ) ORDER BY COALESCE(u.full_name, u.email, cgm.user_id)) FILTER (WHERE cgm.user_id IS NOT NULL), '[]'::json) AS members
      FROM communication_groups cg
      JOIN communication_group_members mine ON mine.group_id = cg.group_id AND mine.user_id = $1
      LEFT JOIN communication_group_members cgm ON cgm.group_id = cg.group_id
      LEFT JOIN users u ON u.user_id::text = cgm.user_id
      GROUP BY cg.group_id
      ORDER BY cg.created_at DESC
    `, [current]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

async function deleteGroup(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const groupId = String(req.params.groupId || '').trim();
    if (!groupId) return res.status(400).json({ error: 'A group is required.' });
    const result = await query(`
      DELETE FROM communication_groups
      WHERE group_id = $1
      RETURNING group_id, group_name
    `, [groupId]);
    if (!result.rows[0]) return res.status(404).json({ error: 'Group chat not found.' });
    res.json({ deleted: true, group: result.rows[0] });
  } catch (error) {
    next(error);
  }
}

async function visitorIntake(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const visitorName = String(req.body?.name || '').trim();
    const purpose = String(req.body?.purpose || '').trim();
    if (!visitorName || !purpose) return res.status(400).json({ error: 'Name and purpose are required.' });
    if (visitorName.length > 120 || purpose.length > 500) return res.status(400).json({ error: 'Please keep the answers shorter.' });

    const adminResult = await query(`
      SELECT user_id, email, full_name
      FROM users
      WHERE UPPER(role) = 'ADMIN' AND COALESCE(is_active, TRUE) = TRUE
      ORDER BY user_id
      LIMIT 1
    `);
    const admin = adminResult.rows[0];
    if (!admin) return res.status(503).json({ error: 'No administrator is available right now.' });

    const visitorId = `visitor:${randomUUID()}`;
    const message = `New visitor intake\nName: ${visitorName}\nPurpose: ${purpose}`;
    await query(`
      INSERT INTO communication_visitors (visitor_id, full_name, purpose, admin_user_id)
      VALUES ($1, $2, $3, $4)
    `, [visitorId, visitorName, purpose, String(admin.user_id || admin.email)]);
    const result = await query(`
      INSERT INTO communication_messages (sender_user_id, recipient_user_id, message)
      VALUES ($1, $2, $3)
      RETURNING message_id, recipient_user_id, message, created_at
    `, [visitorId, String(admin.user_id || admin.email), message]);

    res.status(201).json({ ...result.rows[0], visitor_id: visitorId, admin_user_id: String(admin.user_id || admin.email), admin_name: admin.full_name || admin.email });
  } catch (error) {
    next(error);
  }
}

async function listGroupMessages(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const groupId = String(req.params.groupId || '').trim();
    const current = String(req.user.user_id || req.user.email);
    const member = await query('SELECT 1 FROM communication_group_members WHERE group_id = $1 AND user_id = $2', [groupId, current]);
    if (!member.rows.length) return res.status(403).json({ error: 'You are not a member of this chat group.' });
    const result = await query(`
      SELECT cgm.message_id, cgm.group_id, cgm.sender_user_id, cgm.message, cgm.created_at,
        COALESCE(u.full_name, u.email, cgm.sender_user_id) AS sender_name
      FROM communication_group_messages cgm
      LEFT JOIN users u ON u.user_id::text = cgm.sender_user_id
      WHERE group_id = $1
      ORDER BY created_at ASC
      LIMIT 300
    `, [groupId]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

async function sendGroupMessage(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const groupId = String(req.body?.group_id || '').trim();
    const message = String(req.body?.message || '').trim();
    const sender = String(req.user.user_id || req.user.email);
    if (!groupId || !message) return res.status(400).json({ error: 'Group and message are required.' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message must be 2000 characters or fewer.' });
    const member = await query('SELECT 1 FROM communication_group_members WHERE group_id = $1 AND user_id = $2', [groupId, sender]);
    if (!member.rows.length) return res.status(403).json({ error: 'You are not a member of this chat group.' });
    const result = await query(`
      INSERT INTO communication_group_messages (group_id, sender_user_id, message)
      VALUES ($1, $2, $3)
      RETURNING message_id, group_id, sender_user_id, message, created_at
    `, [groupId, sender, message]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function listVisitorMessages(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const visitorId = String(req.params.visitorId || '').trim();
    const visitor = (await query('SELECT visitor_id, admin_user_id FROM communication_visitors WHERE visitor_id = $1', [visitorId])).rows[0];
    if (!visitor) return res.status(404).json({ error: 'Visitor conversation not found.' });
    const result = await query(`
      SELECT message_id, sender_user_id, recipient_user_id, message, created_at, read_at,
        attachment_data, attachment_name, attachment_type, attachment_size
      FROM communication_messages
      WHERE (sender_user_id = $1 AND recipient_user_id = $2)
         OR (sender_user_id = $2 AND recipient_user_id = $1)
      ORDER BY created_at ASC
      LIMIT 300
    `, [visitor.visitor_id, visitor.admin_user_id]);
    await query('UPDATE communication_visitors SET last_seen_at = NOW() WHERE visitor_id = $1', [visitorId]);
    res.json(result.rows);
  } catch (error) {
    next(error);
  }
}

async function sendVisitorMessage(req, res, next) {
  try {
    await ensureCommunicationSchema();
    const visitorId = String(req.body?.visitor_id || '').trim();
    const message = String(req.body?.message || '').trim();
    const attachmentData = String(req.body?.attachment_data || '').trim();
    const attachmentName = String(req.body?.attachment_name || '').trim();
    const attachmentType = String(req.body?.attachment_type || '').trim().toLowerCase();
    const attachmentSize = Number(req.body?.attachment_size || 0);
    if (!visitorId || (!message && !attachmentData)) return res.status(400).json({ error: 'Visitor and message or attachment are required.' });
    if (message.length > 2000) return res.status(400).json({ error: 'Message must be 2000 characters or fewer.' });
    if (attachmentData) {
      const supportedTypes = ['application/pdf', 'text/plain', 'application/zip', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'];
      if (!/^data:[\w.+-]+\/[\w.+-]+;base64,[a-z0-9+/=]+$/i.test(attachmentData)) return res.status(400).json({ error: 'Invalid attachment format.' });
      if (!attachmentName || !attachmentType || !Number.isFinite(attachmentSize) || attachmentSize <= 0 || attachmentSize > 8 * 1024 * 1024) return res.status(400).json({ error: 'Attachments must be 8 MB or smaller.' });
      if (!/^(image|video|audio)\//.test(attachmentType) && !supportedTypes.includes(attachmentType)) return res.status(400).json({ error: 'This file type is not supported.' });
    }
    const visitor = (await query('SELECT visitor_id, admin_user_id FROM communication_visitors WHERE visitor_id = $1', [visitorId])).rows[0];
    if (!visitor) return res.status(404).json({ error: 'Visitor conversation not found.' });
    const result = await query(`
      INSERT INTO communication_messages (sender_user_id, recipient_user_id, message, attachment_data, attachment_name, attachment_type, attachment_size)
      VALUES ($1, $2, $3, NULLIF($4, ''), NULLIF($5, ''), NULLIF($6, ''), NULLIF($7, 0))
      RETURNING message_id, sender_user_id, recipient_user_id, message, created_at, read_at,
        attachment_data, attachment_name, attachment_type, attachment_size
    `, [visitor.visitor_id, visitor.admin_user_id, message, attachmentData, attachmentName, attachmentType, attachmentSize]);
    await query('UPDATE communication_visitors SET last_seen_at = NOW() WHERE visitor_id = $1', [visitorId]);
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
}

async function convexRows(table, order = 'created_at') {
  return listRecords(table, { order, limit: 1000 });
}

function rowId(row, field) {
  return String(row._legacy_id || row[field] || row.id || '');
}

async function convexPeople(req, res, next) {
  try {
    const filter = String(req.query.filter || 'all').toLowerCase();
    let people = await convexRows('users', 'full_name');
    people = people.filter((user) => user.is_active !== false && (filter === 'all' || (filter === 'admin' && String(user.role).toUpperCase() === 'ADMIN') || (filter === 'residence' && String(user.role).toUpperCase() === 'USER')));
    const messages = await convexRows('communication_messages', 'created_at');
    res.json(people.map((user) => {
      const id = String(user.user_id || user._legacy_id || user.email);
      const unread = messages.filter((message) => String(message.recipient_user_id) === id && !message.read_at).length;
      return { user_id: id, full_name: user.full_name || user.email, email: user.email, role: user.role || 'USER', residence: user.residence || 'Main Residence', is_active: user.is_active !== false, last_seen_at: user.last_seen_at || null, online: Boolean(user.last_seen_at && Date.now() - Date.parse(user.last_seen_at) < 120000), unread_count: unread };
    }));
  } catch (error) { next(error); }
}

async function convexHeartbeat(req, res, next) {
  try {
    const id = String(req.user.user_id || req.user.email);
    const user = await (async () => {
      const users = await convexRows('users', 'full_name');
      return users.find((item) => String(item.user_id || item.email) === id || String(item.email).toLowerCase() === id.toLowerCase());
    })();
    if (user) await updateRecord('users', rowId(user, 'user_id'), { last_seen_at: new Date().toISOString() }, 'user_id');
    res.json({ ok: true, last_seen_at: new Date().toISOString() });
  } catch (error) { next(error); }
}

async function convexListMessages(req, res, next) {
  try {
    const current = String(req.user.user_id || req.user.email);
    const participant = String(req.params.userId || '');
    const messages = await convexRows('communication_messages', 'created_at');
    res.json(messages.filter((message) => (String(message.sender_user_id) === current && String(message.recipient_user_id) === participant) || (String(message.sender_user_id) === participant && String(message.recipient_user_id) === current)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).slice(-300));
  } catch (error) { next(error); }
}

async function convexSendMessage(req, res, next) {
  try {
    const recipient = String(req.body?.recipient_user_id || req.body?.recipientId || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!recipient || !message) return res.status(400).json({ error: 'Recipient and message are required.' });
    const id = `message:${randomUUID()}`;
    const row = { message_id: id, sender_user_id: String(req.user.user_id || req.user.email), recipient_user_id: recipient, message, created_at: new Date().toISOString(), read_at: null, attachment_data: req.body?.attachment_data || null, attachment_name: req.body?.attachment_name || null, attachment_type: req.body?.attachment_type || null, attachment_size: req.body?.attachment_size || null };
    res.status(201).json(await insertRecord('communication_messages', id, row));
  } catch (error) { next(error); }
}

async function convexMarkMessagesRead(req, res, next) {
  try {
    const current = String(req.user.user_id || req.user.email);
    const participant = String(req.params.userId || '');
    const messages = await convexRows('communication_messages', 'created_at');
    await Promise.all(messages.filter((message) => String(message.sender_user_id) === participant && String(message.recipient_user_id) === current && !message.read_at).map((message) => updateRecord('communication_messages', rowId(message, 'message_id'), { read_at: new Date().toISOString() }, 'message_id')));
    res.json({ ok: true });
  } catch (error) { next(error); }
}

async function convexNotifications(req, res, next) {
  try {
    const current = String(req.user.user_id || req.user.email);
    const users = await convexRows('users', 'full_name');
    const messages = await convexRows('communication_messages', 'created_at');
    res.json(messages.filter((message) => String(message.recipient_user_id) === current).sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 50).map((message) => ({ ...message, sender_name: users.find((user) => String(user.user_id || user.email) === String(message.sender_user_id))?.full_name || 'User' })));
  } catch (error) { next(error); }
}

async function convexCreateGroup(req, res, next) {
  try {
    const name = String(req.body?.group_name || req.body?.name || '').trim();
    const members = Array.isArray(req.body?.member_ids) ? req.body.member_ids.map(String) : [];
    if (!name || members.length < 1) return res.status(400).json({ error: 'Group name and at least one member are required.' });
    const id = `group:${randomUUID()}`;
    const group = { group_id: id, group_name: name, created_by: String(req.user.user_id || req.user.email), created_at: new Date().toISOString() };
    await insertRecord('communication_groups', id, group);
    await Promise.all([...new Set([group.created_by, ...members])].map((userId) => insertRecord('communication_group_members', `${id}:${userId}`, { group_id: id, user_id: userId, joined_at: group.created_at })));
    res.status(201).json({ ...group, member_ids: [...new Set([group.created_by, ...members])] });
  } catch (error) { next(error); }
}

async function convexListGroups(req, res, next) {
  try {
    const current = String(req.user.user_id || req.user.email);
    const groups = await convexRows('communication_groups', 'created_at');
    const members = await convexRows('communication_group_members', 'joined_at');
    res.json(groups.filter((group) => members.some((member) => String(member.group_id) === String(group.group_id) && String(member.user_id) === current)).map((group) => ({ ...group, member_count: members.filter((member) => String(member.group_id) === String(group.group_id)).length, members: members.filter((member) => String(member.group_id) === String(group.group_id)) })));
  } catch (error) { next(error); }
}

async function convexDeleteGroup(req, res, next) {
  try {
    const groupId = String(req.params.groupId || '');
    const groups = await convexRows('communication_groups', 'created_at');
    const group = groups.find((item) => String(item.group_id) === groupId);
    if (!group) return res.status(404).json({ error: 'Group not found.' });
    await deleteRecord('communication_groups', rowId(group, 'group_id'), 'group_id');
    const members = await convexRows('communication_group_members', 'joined_at');
    await Promise.all(members.filter((member) => String(member.group_id) === groupId).map((member) => deleteRecord('communication_group_members', rowId(member, 'id'), 'id')));
    res.json(group);
  } catch (error) { next(error); }
}

async function convexListGroupMessages(req, res, next) {
  try {
    const groupId = String(req.params.groupId || '');
    const messages = await convexRows('communication_group_messages', 'created_at');
    res.json(messages.filter((message) => String(message.group_id) === groupId).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))).slice(-300));
  } catch (error) { next(error); }
}

async function convexSendGroupMessage(req, res, next) {
  try {
    const groupId = String(req.body?.group_id || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!groupId || !message) return res.status(400).json({ error: 'Group and message are required.' });
    const id = `group-message:${randomUUID()}`;
    res.status(201).json(await insertRecord('communication_group_messages', id, { message_id: id, group_id: groupId, sender_user_id: String(req.user.user_id || req.user.email), message, created_at: new Date().toISOString() }));
  } catch (error) { next(error); }
}

async function convexVisitorIntake(req, res, next) {
  try {
    const fullName = String(req.body?.full_name || req.body?.name || '').trim();
    const purpose = String(req.body?.purpose || '').trim();
    if (!fullName || !purpose) return res.status(400).json({ error: 'Name and purpose are required.' });
    const admins = (await convexRows('users', 'full_name')).filter((user) => String(user.role).toUpperCase() === 'ADMIN' && user.is_active !== false);
    const admin = admins[0];
    if (!admin) return res.status(503).json({ error: 'No administrator is available right now.' });
    const visitorId = `visitor:${randomUUID()}`;
    const createdAt = new Date().toISOString();
    await insertRecord('communication_visitors', visitorId, { visitor_id: visitorId, full_name: fullName, purpose, admin_user_id: String(admin.user_id || admin.email), created_at: createdAt, last_seen_at: createdAt });
    const messageId = `message:${randomUUID()}`;
    const message = `New visitor intake\nName: ${fullName}\nPurpose: ${purpose}`;
    const saved = await insertRecord('communication_messages', messageId, { message_id: messageId, sender_user_id: visitorId, recipient_user_id: String(admin.user_id || admin.email), message, created_at: createdAt, read_at: null });
    res.status(201).json({ visitor_id: visitorId, message: saved });
  } catch (error) { next(error); }
}

async function convexVisitorMessages(req, res, next) {
  try {
    const visitorId = String(req.params.visitorId || '');
    const visitors = await convexRows('communication_visitors', 'created_at');
    const visitor = visitors.find((item) => String(item.visitor_id) === visitorId);
    if (!visitor) return res.status(404).json({ error: 'Visitor conversation not found.' });
    const messages = await convexRows('communication_messages', 'created_at');
    res.json(messages.filter((item) => (String(item.sender_user_id) === visitorId && String(item.recipient_user_id) === String(visitor.admin_user_id)) || (String(item.sender_user_id) === String(visitor.admin_user_id) && String(item.recipient_user_id) === visitorId)).sort((a, b) => String(a.created_at).localeCompare(String(b.created_at))));
  } catch (error) { next(error); }
}

async function convexSendVisitorMessage(req, res, next) {
  try {
    const visitorId = String(req.body?.visitor_id || '').trim();
    const message = String(req.body?.message || '').trim();
    if (!visitorId || !message) return res.status(400).json({ error: 'Visitor and message are required.' });
    const visitors = await convexRows('communication_visitors', 'created_at');
    const visitor = visitors.find((item) => String(item.visitor_id) === visitorId);
    if (!visitor) return res.status(404).json({ error: 'Visitor conversation not found.' });
    const id = `message:${randomUUID()}`;
    res.status(201).json(await insertRecord('communication_messages', id, { message_id: id, sender_user_id: visitorId, recipient_user_id: String(visitor.admin_user_id), message, created_at: new Date().toISOString(), read_at: null }));
  } catch (error) { next(error); }
}

module.exports = { listPeople: convexPeople, heartbeat: convexHeartbeat, listMessages: convexListMessages, sendMessage: convexSendMessage, markMessagesRead: convexMarkMessagesRead, listNotifications: convexNotifications, createGroup: convexCreateGroup, listGroups: convexListGroups, deleteGroup: convexDeleteGroup, listGroupMessages: convexListGroupMessages, sendGroupMessage: convexSendGroupMessage, visitorIntake: convexVisitorIntake, listVisitorMessages: convexVisitorMessages, sendVisitorMessage: convexSendVisitorMessage };
