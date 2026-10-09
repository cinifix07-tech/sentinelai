require('dotenv').config();

const fs = require('fs');

const dumpPath = process.argv[2];
const convexUrl = String(process.env.CONVEX_SITE_URL || '').replace(/\/$/, '');
const token = process.env.CONVEX_MIGRATION_TOKEN;
const batchSize = 50;

if (!dumpPath || !convexUrl || !token) {
  throw new Error('Usage: node scripts/importSqlDumpToConvex.js <dump.sql> with CONVEX_SITE_URL and CONVEX_MIGRATION_TOKEN set.');
}

function decodeDump(file) {
  const bytes = fs.readFileSync(file);
  if (bytes.length >= 2 && bytes[0] === 0xff && bytes[1] === 0xfe) return bytes.subarray(2).toString('utf16le');
  if (bytes.includes(0)) return bytes.toString('utf16le');
  return bytes.toString('utf8');
}

function decodeCopyValue(value) {
  if (value === '\\N') return null;
  return value
    .replace(/\\\\/g, '\\')
    .replace(/\\t/g, '\t')
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r');
}

function parseCopyRows(text) {
  const lines = text.split(/\r?\n/);
  const tables = [];
  for (let index = 0; index < lines.length; index += 1) {
    const header = lines[index].match(/^COPY public\.([a-zA-Z0-9_]+) \((.+)\) FROM stdin;$/);
    if (!header) continue;
    const tableName = header[1];
    const columns = header[2].split(',').map((column) => column.trim());
    const records = [];
    index += 1;
    for (; index < lines.length && lines[index] !== '\\.'; index += 1) {
      if (!lines[index]) continue;
      const values = lines[index].split('\t').map(decodeCopyValue);
      const payload = Object.fromEntries(columns.map((column, columnIndex) => [column, values[columnIndex] ?? null]));
      const primaryKey = columns.find((column) => column.endsWith('_id')) || columns[0];
      records.push({ legacyId: String(payload[primaryKey] || `${tableName}-${records.length + 1}`), payload });
    }
    tables.push({ tableName, records });
  }
  return tables;
}

async function importTable(tableName, records) {
  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records.slice(offset, offset + batchSize);
    const response = await fetch(`${convexUrl}/migration/import`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, tableName, records: batch }),
    });
    const body = await response.text();
    if (!response.ok) throw new Error(`${tableName} batch ${offset}: ${response.status} ${body}`);
    process.stdout.write(`\r${tableName}: ${Math.min(offset + batch.length, records.length)}/${records.length}`);
  }
  process.stdout.write('\n');
}

async function main() {
  const tables = parseCopyRows(decodeDump(dumpPath));
  if (!tables.length) throw new Error('No PostgreSQL COPY data blocks found in the dump.');
  for (const table of tables) await importTable(table.tableName, table.records);
  console.log(`Imported ${tables.length} tables into Convex.`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
