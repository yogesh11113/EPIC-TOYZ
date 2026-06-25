const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

const { Client } = require('pg');

const host = 'aws-0-ap-south-1.pooler.supabase.com';
const user = 'postgres.wzqaawfqcjxztiyfsmof';
const password = 'yogesh123*';

async function run() {
  try {
    console.log(`Resolving IP for ${host} using custom DNS...`);
    const ips = await new Promise((resolve, reject) => {
      dns.resolve4(host, (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
    const ip = ips[0];
    console.log(`Resolved to IP: ${ip}. Connecting to pooler...`);

    const client = new Client({
      host: ip,
      port: 5432,
      database: 'postgres',
      user: user,
      password: password,
      ssl: {
        rejectUnauthorized: false
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
