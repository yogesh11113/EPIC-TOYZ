const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  console.log('Fetching lightweight product fields from Supabase...');
  try {
    const fields = 'id,name,slug,price,stock_quantity,badge,is_featured,is_active,category_id';
    const res = await fetch(`${url}/rest/v1/products?select=${fields}`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    console.log('Total Products Count:', data.length);
    console.log('First 5 Products:', JSON.stringify(data.slice(0, 5), null, 2));
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
