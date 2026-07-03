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

    // Query columns of orders table
    const ordersRes = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position;
    `);
    console.log('Columns of orders table:');
    console.log(ordersRes.rows.map(r => r.column_name).join(', '));

    // Query columns of order_items table
    const itemsRes = await client.query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'order_items'
      ORDER BY ordinal_position;
    `);
    console.log('\nColumns of order_items table:');
    console.log(itemsRes.rows.map(r => r.column_name).join(', '));

    await client.end();
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
