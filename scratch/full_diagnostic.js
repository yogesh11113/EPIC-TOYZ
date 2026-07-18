const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function fetchSupabase(path, extraHeaders = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(SUPABASE_URL + path);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        ...extraHeaders
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, headers: res.headers, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log('=== SUPABASE DIAGNOSTIC ===\n');

  // 1. Check products table columns via information_schema (RPC)
  console.log('--- 1. Products table columns ---');
  const colRes = await fetchSupabase('/rest/v1/products?select=*&limit=1');
  if (colRes.status === 200) {
    const rows = JSON.parse(colRes.body);
    if (rows.length > 0) {
      console.log('Actual columns in products table:', Object.keys(rows[0]).join(', '));
    } else {
      console.log('Products table is EMPTY');
    }
  } else {
    console.log('ERROR fetching products:', colRes.status, colRes.body.substring(0, 300));
  }

  console.log('');

  // 2. Test the exact select string used in db.js getProducts
  console.log('--- 2. Test exact getProducts select fields ---');
  const fields = 'id,name,slug,price,original_price,short_description,description,is_featured,badge,badges,stock_quantity,rating,review_count,images,specifications,category_id,categories,brand';
  const exactRes = await fetchSupabase(`/rest/v1/products?select=${encodeURIComponent(fields)}&limit=3`);
  console.log('Status:', exactRes.status);
  if (exactRes.status === 200) {
    const rows = JSON.parse(exactRes.body);
    console.log('Products returned:', rows.length);
    if (rows.length > 0) console.log('First product name:', rows[0].name);
  } else {
    console.log('ERROR:', exactRes.body.substring(0, 500));
  }

  console.log('');

  // 3. Test the join query used in queryProductsSafe
  console.log('--- 3. Test join query (categories relation) ---');
  const joinSelect = encodeURIComponent('*, category_rel:categories(id, name, slug)');
  const joinRes = await fetchSupabase(`/rest/v1/products?select=${joinSelect}&limit=3`);
  console.log('Status:', joinRes.status);
  if (joinRes.status === 200) {
    const rows = JSON.parse(joinRes.body);
    console.log('Products returned with join:', rows.length);
  } else {
    console.log('JOIN ERROR (expected if no FK):', joinRes.body.substring(0, 300));
  }

  console.log('');

  // 4. Count all products
  console.log('--- 4. Total product count ---');
  const countRes = await fetchSupabase('/rest/v1/products?select=id', { 'Prefer': 'count=exact' });
  console.log('Status:', countRes.status);
  console.log('Content-Range:', countRes.headers['content-range']);

  console.log('');

  // 5. Check categories
  console.log('--- 5. Categories ---');
  const catRes = await fetchSupabase('/rest/v1/categories?select=id,name,slug');
  if (catRes.status === 200) {
    const cats = JSON.parse(catRes.body);
    console.log('Categories:', cats.length);
    cats.forEach(c => console.log(`  id=${c.id} slug=${c.slug} name=${c.name}`));
  } else {
    console.log('ERROR:', catRes.body.substring(0, 300));
  }

  console.log('');

  // 6. Check the 'brand' column specifically (it was added in the perf optimization)
  console.log('--- 6. Check "brand" column exists ---');
  const brandRes = await fetchSupabase('/rest/v1/products?select=brand&limit=2');
  console.log('Status:', brandRes.status);
  console.log('Response:', brandRes.body.substring(0, 200));
}

main().catch(console.error);
