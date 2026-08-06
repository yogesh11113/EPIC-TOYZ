/**
 * Verification script for Epic Toyz DB & Data Systems
 */
const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function restFetch(endpoint) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${endpoint}`);
    const req = https.request({
      hostname: url.hostname, path: url.pathname + url.search, method: 'GET',
      headers: { 'apikey': SUPABASE_ANON_KEY, 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'Content-Type': 'application/json' }
    }, (res) => {
      let body = ''; res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body || '[]') }));
    });
    req.on('error', reject); req.end();
  });
}

async function runVerification() {
  console.log('--- STARTING VERIFICATION ---');
  
  // 1. Categories
  const cats = await restFetch('categories?select=id,name,slug');
  console.log(`[Categories] status ${cats.status}, count: ${Array.isArray(cats.data) ? cats.data.length : 0}`);

  // 2. Products
  const prods = await restFetch('products?select=id,name,price&limit=3');
  console.log(`[Products] status ${prods.status}, count: ${Array.isArray(prods.data) ? prods.data.length : 0}`);

  // 3. Profiles
  const profiles = await restFetch('profiles?select=id,full_name');
  console.log(`[Profiles] status ${profiles.status}, count: ${Array.isArray(profiles.data) ? profiles.data.length : 0}`);

  // 4. Reviews
  const reviews = await restFetch('reviews?select=id,rating,is_approved');
  console.log(`[Reviews] status ${reviews.status}, count: ${Array.isArray(reviews.data) ? reviews.data.length : 0}`);

  console.log('--- VERIFICATION COMPLETE ---');
}

runVerification();
