const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function fetchSupabase(table, select) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}?select=${encodeURIComponent(select)}&limit=3`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
    }, (res) => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject); req.end();
  });
}

async function main() {
  console.log('Testing Supabase REST API...');
  console.log('URL:', SUPABASE_URL);
  console.log('Key:', SUPABASE_ANON_KEY.substring(0, 20) + '...\n');

  try {
    const r1 = await fetchSupabase('categories', 'id,name');
    console.log('Categories - Status:', r1.status);
    console.log('Response:', r1.body.substring(0, 500), '\n');
  } catch (e) { console.error('Categories error:', e.message); }

  try {
    const r2 = await fetchSupabase('products', 'id,name,price');
    console.log('Products - Status:', r2.status);
    console.log('Response:', r2.body.substring(0, 500));
  } catch (e) { console.error('Products error:', e.message); }
}
main();
