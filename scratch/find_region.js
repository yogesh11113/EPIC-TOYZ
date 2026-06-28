const { Client } = require('pg');

const regions = [
  'ap-south-1',
  'ap-southeast-1',
  'us-east-1',
  'us-east-2',
  'us-west-1',
  'us-west-2',
  'eu-central-1',
  'eu-west-1',
  'eu-west-2',
  'ca-central-1',
  'sa-east-1',
  'ap-northeast-1',
  'ap-northeast-2',
  'ap-southeast-2'
];

const user = 'postgres.wzqaawfqcjxztiyfsmof';
const password = 'yogesh123*';

async function testRegion(region) {
  const host = `aws-0-${region}.pooler.supabase.com`;
  console.log(`Testing region ${region} (${host})...`);
  
  const client = new Client({
    host: host,
    port: 6543,
    database: 'postgres',
    user: user,
    password: password,
    connectionTimeoutMillis: 5000,
    ssl: {
      rejectUnauthorized: false,
      servername: host
    }
  });

  try {
    await client.connect();
    console.log(`✅ Success in region: ${region}`);
    const res = await client.query('SELECT 1 as val');
    console.log('Query result:', res.rows);
    await client.end();
    return true;
  } catch (err) {
    console.log(`❌ Failed in region ${region}: ${err.message}`);
    try { await client.end(); } catch (e) {}
    return false;
  }
}

async function run() {
  for (const region of regions) {
    const success = await testRegion(region);
    if (success) {
      console.log(`Found correct region: ${region}!`);
      break;
    }
  }
}

run();
