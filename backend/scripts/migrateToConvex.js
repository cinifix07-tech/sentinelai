/*
 * Idempotent PostgreSQL -> Convex migration.
 *
 * Usage (PowerShell):
 *   $env:CONVEX_MIGRATION_TOKEN = "the-token-set-in-convex"
 *   node backend/scripts/migrateToConvex.js
 *
 * The script never deletes PostgreSQL data. Re-running it updates the same
 * Convex documents by their PostgreSQL primary key.
 */
require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });

const path = require("path");
const { pool } = require("../src/config/database");

const convexRoot = path.resolve(__dirname, "../../convex");
const token = process.env.CONVEX_MIGRATION_TOKEN;
const batchSize = Number(process.env.CONVEX_MIGRATION_BATCH_SIZE || 50);
const convexUrl = process.env.CONVEX_SITE_URL || "https://elated-eel-973.convex.site";
const chunkSize = 200000;

const tables = [
  "access_attempts",
  "alerts",
  "authorized_profiles",
  "communication_group_members",
  "communication_group_messages",
  "communication_groups",
  "communication_messages",
  "communication_visitors",
  "device_logs",
  "devices",
  "interview_questions",
  "iot_security_state",
  "security_events",
  "security_sessions",
  "sensor_readings",
  "users",
  "voice_interactions",
];

function normalize(value) {
  if (value === undefined) return undefined;
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("base64");
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "number" && !Number.isFinite(value)) return null;
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .map(([key, item]) => [key, normalize(item)])
        .filter(([, item]) => item !== undefined),
    );
  }
  return value;
}

function chunkLargeStrings(value, fieldPath = "", chunks = []) {
  if (Array.isArray(value)) {
    return [value.map((item, index) => chunkLargeStrings(item, `${fieldPath}[${index}]`, chunks)), chunks];
  }
  if (value && typeof value === "object") {
    const output = {};
    for (const [key, item] of Object.entries(value)) {
      const path = fieldPath ? `${fieldPath}.${key}` : key;
      [output[key]] = chunkLargeStrings(item, path, chunks);
    }
    return [output, chunks];
  }
  if (typeof value === "string" && value.length > chunkSize) {
    for (let offset = 0, index = 0; offset < value.length; offset += chunkSize, index += 1) {
      chunks.push({ fieldPath, chunkIndex: index, data: value.slice(offset, offset + chunkSize) });
    }
    return [{ __convexChunked: true, length: value.length, chunks: Math.ceil(value.length / chunkSize) }, chunks];
  }
  return [value, chunks];
}

async function getPrimaryKey(table) {
  const result = await pool.query(
    `SELECT kcu.column_name
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.table_schema = 'public'
        AND tc.table_name = $1
        AND tc.constraint_type = 'PRIMARY KEY'
      ORDER BY kcu.ordinal_position`,
    [table],
  );
  return result.rows.map((row) => row.column_name);
}

async function runConvex(tableName, records) {
  const response = await fetch(`${convexUrl}/migration/import`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-migration-token": token,
    },
    body: JSON.stringify({ token, tableName, records }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`Convex import failed for ${tableName}: ${response.status} ${text}`);
  process.stdout.write(`${text}\n`);
}

async function migrateTable(table) {
  const primaryKey = await getPrimaryKey(table);
  const result = await pool.query(`SELECT * FROM "${table}" ORDER BY 1`);
  const records = result.rows.map((row, index) => {
    const key = primaryKey.length
      ? primaryKey.map((column) => `${column}=${String(row[column])}`).join("|")
      : `row-${index + 1}`;
    const normalized = normalize(row);
    const [payload, chunks] = chunkLargeStrings(normalized);
    const sourceCreatedAt = payload.created_at || payload.recorded_at || payload.occurred_at;
    return {
      legacyId: key,
      payload,
      ...(chunks.length ? { chunks } : {}),
      ...(sourceCreatedAt ? { sourceCreatedAt: String(sourceCreatedAt) } : {}),
    };
  });

  for (let offset = 0; offset < records.length; offset += batchSize) {
    await runConvex(table, records.slice(offset, offset + batchSize));
    process.stdout.write(`Migrated ${table}: ${Math.min(offset + batchSize, records.length)}/${records.length}\n`);
  }
  if (records.length === 0) process.stdout.write(`Migrated ${table}: 0/0\n`);
}

async function main() {
  if (!token) throw new Error("CONVEX_MIGRATION_TOKEN is required");
  if (!Number.isInteger(batchSize) || batchSize < 1 || batchSize > 100) {
    throw new Error("CONVEX_MIGRATION_BATCH_SIZE must be an integer from 1 to 100");
  }

  for (const table of tables) await migrateTable(table);
  process.stdout.write("Convex migration completed. PostgreSQL was not modified.\n");
}

main()
  .catch((error) => {
    console.error(error.message || error);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
