const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  console.log('Fetching categories from Supabase REST API...');
  const startTime = Date.now();
  try {
    const res = await fetch(`${url}/rest/v1/categories?select=*`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log('Status:', res.status);
    console.log('Time taken:', Date.now() - startTime, 'ms');
    const text = await res.text();
    console.log('Raw response:', text);
  } catch (err) {
    console.error('Error fetching categories:', err);
  }
}

run();
