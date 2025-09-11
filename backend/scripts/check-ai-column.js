/* Quick DB smoke test to verify aiEnabled column exists */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const mysql = require('mysql2/promise');

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error('DATABASE_URL not found in env');
    process.exit(1);
  }
  let conn;
  try {
    conn = await mysql.createConnection(url);
    const [rows] = await conn.execute('DESCRIBE conversation_participants');
    const hasAi = rows.some((r) => String(r.Field) === 'aiEnabled');
    console.log('DESCRIBE conversation_participants => aiEnabled:', hasAi ? 'PRESENT' : 'MISSING');
    process.exit(hasAi ? 0 : 2);
  } catch (e) {
    console.error('DB check failed:', e.message);
    process.exit(3);
  } finally {
    if (conn) await conn.end();
  }
}

main();

