const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  console.log('Querying Supabase API Schema...');
  try {
    const res = await fetch(`${url}/rest/v1/`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Orders definitions:');
    console.log(JSON.stringify(data.definitions?.orders, null, 2));
    console.log('\nOrder Items definitions:');
    console.log(JSON.stringify(data.definitions?.order_items, null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
