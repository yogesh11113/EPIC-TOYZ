const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const host = 'db.wzqaawfqcjxztiyfsmof.supabase.co';
const password = 'yogesh123*'; // Let's try the admin password

async function run() {
  const client = new Client({
    host: host,
    port: 5432,
    database: 'postgres',
    user: 'postgres',
    password: password,
    ssl: {
      rejectUnauthorized: false
    }
  });

  try {
    console.log(`Connecting to Postgres database at ${host}...`);
    await client.connect();
    console.log('Successfully connected to database!');

    // Read the SUPABASE_SETUP.md and extract SQL
    const setupContent = fs.readFileSync(path.join(__dirname, '../SUPABASE_SETUP.md'), 'utf8');
    
    // Extract SQL block between step 4 and step 5
    const sqlBlockRegex = /```sql([\s\S]*?)```/g;
    const matches = [];
    let match;
    while ((match = sqlBlockRegex.exec(setupContent)) !== null) {
      matches.push(match[1]);
    }

    if (matches.length === 0) {
      console.error('Could not find SQL blocks in SUPABASE_SETUP.md');
      await client.end();
      return;
    }

    console.log(`Found ${matches.length} SQL block(s). Running first SQL block (database schema)...`);
    const schemaSql = matches[0];

    // Execute the SQL
    await client.query(schemaSql);
    console.log('Database schema created successfully!');

    if (matches.length > 2) {
      console.log('Running third SQL block (seed data)...');
      const seedSql = matches[2]; // Index 0: schema, Index 1: storage policies, Index 2: seed categories
      await client.query(seedSql);
      console.log('Categories seeded successfully!');
    }

  } catch (err) {
    console.error('Failed to run schema SQL:', err);
  } finally {
    try {
      await client.end();
    } catch (e) {}
  }
}

run();
