const { Client } = require('pg');

const host = 'db.wzqaawfqcjxztiyfsmof.supabase.co';
const user = 'postgres';
const password = 'yogesh123*';

async function run() {
  try {
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

    await client.connect();
    console.log('Connected successfully!');

    // Query columns of products table
    const res = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'products'
      ORDER BY ordinal_position;
    `);
    console.log('Columns of products table:', JSON.stringify(res.rows, null, 2));

    await client.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
