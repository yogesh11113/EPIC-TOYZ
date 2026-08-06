const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function checkTable(table) {
  return new Promise((resolve) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${table}?select=*&limit=1`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
    }, (res) => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => resolve({ table, status: res.statusCode, body: body.slice(0, 200) }));
    });
    req.on('error', (e) => resolve({ table, error: e.message }));
    req.end();
  });
}

async function main() {
  const tables = ['categories', 'products', 'profiles', 'orders', 'order_items', 'reviews', 'wishlist', 'inventory', 'settings', 'store_settings'];
  for (const t of tables) {
    const res = await checkTable(t);
    console.log(`Table '${t}': status ${res.status} | body: ${res.body}`);
  }
}
main();
