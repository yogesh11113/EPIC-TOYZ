const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  console.log('Fetching latest orders from Supabase...');
  try {
    const res = await fetch(`${url}/rest/v1/orders?select=*,order_items(*)&order=created_at.desc&limit=5`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Latest 5 orders:');
    console.log(JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
