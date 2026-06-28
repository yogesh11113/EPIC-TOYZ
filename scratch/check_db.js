const { Client } = require('pg');

const host = 'db.wzqaawfqcjxztiyfsmof.supabase.co';
const user = 'postgres';
const password = 'yogesh123*';

async function run() {
  const client = new Client({
    host: host,
    port: 5432,
    database: 'postgres',
    user: user,
    password: password,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    await client.connect();
    console.log('Connected to PG!');

    // 1. Check for locks
    console.log('--- DB Locks ---');
    const locksRes = await client.query(`
      SELECT 
        coalesce(blockingl.relation::regclass::text,blockingl.locktype) as locked_item,
        blockeda.pid as blocked_pid,
        blockeda.query as blocked_query,
        blockedl.mode as blocked_mode,
        blockinga.pid as blocking_pid,
        blockinga.query as blocking_query,
        blockinga.state as blocking_state,
        blockinga.query_start as blocking_query_start
      FROM pg_catalog.pg_locks blockedl
      JOIN pg_catalog.pg_stat_activity blockeda ON blockeda.pid = blockedl.pid
      JOIN pg_catalog.pg_locks blockingl 
        ON blockingl.pid != blockedl.pid
        AND (blockingl.relation = blockedl.relation OR blockingl.relation IS NULL)
      JOIN pg_catalog.pg_stat_activity blockinga ON blockinga.pid = blockingl.pid
      WHERE NOT blockedl.granted;
    `);
    console.log(JSON.stringify(locksRes.rows, null, 2));

    // 2. Check running processes/queries
    console.log('--- Running Processes ---');
    const procRes = await client.query(`
      SELECT pid, state, query, age(clock_timestamp(), query_start) as duration
      FROM pg_stat_activity
      WHERE state IS NOT NULL AND query NOT LIKE '%pg_stat_activity%'
      ORDER BY duration DESC;
    `);
    console.log(JSON.stringify(procRes.rows.slice(0, 15), null, 2));

  } catch (err) {
    console.error('Error:', err);
  } finally {
    await client.end();
  }
}

run();
