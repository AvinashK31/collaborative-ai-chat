/*
 * Safe smoke test: pick one conversation_participants row, toggle aiEnabled,
 * verify the change, then restore original value. No lasting changes.
 */
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
    const [rows] = await conn.execute(
      'SELECT id, userId, conversationId, aiEnabled FROM conversation_participants LIMIT 1'
    );
    if (!rows.length) {
      console.log('No conversation_participants rows found; skipping');
      return;
    }
    const row = rows[0];
    console.log('Picked row:', row);
    const original = row.aiEnabled ? 1 : 0;
    const flipped = original ? 0 : 1;
    // Flip
    await conn.execute('UPDATE conversation_participants SET aiEnabled=? WHERE id=?', [flipped, row.id]);
    const [afterFlip] = await conn.execute('SELECT aiEnabled FROM conversation_participants WHERE id=?', [row.id]);
    const okFlip = (afterFlip[0]?.aiEnabled ?? -1) === flipped;
    console.log('Flip result:', okFlip ? 'OK' : 'FAILED');
    // Restore
    await conn.execute('UPDATE conversation_participants SET aiEnabled=? WHERE id=?', [original, row.id]);
    const [afterRestore] = await conn.execute('SELECT aiEnabled FROM conversation_participants WHERE id=?', [row.id]);
    const okRestore = (afterRestore[0]?.aiEnabled ?? -1) === original;
    console.log('Restore result:', okRestore ? 'OK' : 'FAILED');
    process.exit(okFlip && okRestore ? 0 : 2);
  } catch (e) {
    console.error('Smoke test failed:', e.message);
    process.exit(3);
  } finally {
    if (conn) await conn.end();
  }
}

main();

