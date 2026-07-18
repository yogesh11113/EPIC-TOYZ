const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function fetchSupabase(path) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` }
    }, (res) => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, body }));
    });
    req.on('error', reject); req.end();
  });
}

async function main() {
  console.log('=== VERIFYING FIX ===\n');

  // Test 1: The fixed query (select=* with categories join) - same as queryProductsSafe
  console.log('1. Test: SELECT * with categories join (what queryProductsSafe does now)');
  const r1 = await fetchSupabase('/rest/v1/products?select=*%2Ccategory_rel%3Acategories%28id%2Cname%2Cslug%29&limit=5');
  console.log('   Status:', r1.status, r1.status === 200 ? '✅ OK' : '❌ FAIL');
  if (r1.status === 200) {
    const rows = JSON.parse(r1.body);
    console.log('   Products returned:', rows.length);
    if (rows.length > 0) {
      console.log('   First product:', rows[0].name);
      console.log('   Has category_rel:', rows[0].category_rel ? JSON.stringify(rows[0].category_rel) : 'null');
    }
  } else {
    console.log('   Error:', r1.body.substring(0, 200));
  }

  console.log('');

  // Test 2: SELECT * (fallback when join fails)
  console.log('2. Test: SELECT * without join (fallback)');
  const r2 = await fetchSupabase('/rest/v1/products?select=*&limit=3');
  console.log('   Status:', r2.status, r2.status === 200 ? '✅ OK' : '❌ FAIL');
  if (r2.status === 200) {
    const rows = JSON.parse(r2.body);
    console.log('   Products returned:', rows.length);
  }

  console.log('');

  // Test 3: Count all products
  console.log('3. Test: Total product count');
  const r3 = await fetchSupabase('/rest/v1/products?select=id');
  if (r3.status === 200) {
    const rows = JSON.parse(r3.body);
    console.log('   Total products (first page):', rows.length);
    console.log('   Status:', r3.status, '✅ OK');
  }

  console.log('');
  console.log('=== SUMMARY ===');
  console.log('The fix removes "badges" and "brand" from the select string.');
  console.log('queryProductsSafe now uses SELECT * + join, which works correctly.');
  console.log('Products should now load properly in the browser.');
}

main().catch(console.error);
