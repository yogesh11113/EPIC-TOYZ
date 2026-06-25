const { Client } = require('pg');

const host = 'aws-0-ap-south-1.pooler.supabase.com';
const ip = '65.0.195.55'; // Hardcoded IP address from previous successful resolution
const user = 'postgres.wzqaawfqcjxztiyfsmof';
const password = 'yogesh123*';

async function run() {
  try {
    console.log(`Connecting to pooler IP ${ip} with SNI servername ${host}...`);

    const client = new Client({
      host: ip,
      port: 6543, // Transaction mode port
      database: 'postgres',
      user: user,
      password: password,
      ssl: {
        rejectUnauthorized: false,
        servername: host // Pass the SNI host
      }
    });

    await client.connect();
    console.log('Connected successfully!');

    // Query public tables
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public'
    `);
    console.log('Public tables:', res.rows.map(r => r.table_name));

    // Query auth users
    const usersRes = await client.query(`
      SELECT id, email FROM auth.users
    `);
    console.log('Auth users:', usersRes.rows);

    await client.end();
  } catch (err) {
    console.error('Error during execution:', err);
  }
}

run();
