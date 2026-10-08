const { pool } = require('../src/config/database');

function quoteIdentifier(value) {
  return `"${String(value).replace(/"/g, '""')}"`;
}

async function main() {
  const tables = await pool.query(`
    SELECT table_name
      FROM information_schema.tables
     WHERE table_schema = 'public'
       AND table_type = 'BASE TABLE'
     ORDER BY table_name
  `);

  for (const { table_name: tableName } of tables.rows) {
    const [columns, count] = await Promise.all([
      pool.query(`
        SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position
      `, [tableName]),
      pool.query(`SELECT COUNT(*)::int AS count FROM ${quoteIdentifier(tableName)}`),
    ]);
    console.log(JSON.stringify({ table: tableName, count: count.rows[0].count, columns: columns.rows }));
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
