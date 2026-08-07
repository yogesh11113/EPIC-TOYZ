const { Client } = require('pg');

const host = 'db.wzqaawfqcjxztiyfsmof.supabase.co';
const user = 'postgres';
const password = 'yogesh123*';

async function run() {
  const client = new Client({
    host, port: 5432, database: 'postgres', user, password,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to PostgreSQL successfully!');

    // 1. Check if epictoyz.in@gmail.com exists in auth.users
    const resUser = await client.query(`
      SELECT id, email, encrypted_password, email_confirmed_at, role, created_at 
      FROM auth.users 
      WHERE lower(email) = 'epictoyz.in@gmail.com';
    `);

    console.log('auth.users result:', JSON.stringify(resUser.rows, null, 2));

    // 2. Check trigger on auth.users
    const resTrig = await client.query(`
      SELECT trigger_name, event_manipulation, action_statement 
      FROM information_schema.triggers 
      WHERE event_object_table = 'users';
    `);
    console.log('Triggers on auth.users:', JSON.stringify(resTrig.rows, null, 2));

    await client.end();
  } catch (err) {
    console.error('PG Error:', err);
  }
}

run();
