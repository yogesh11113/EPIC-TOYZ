const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  console.log('Fetching all products to inspect category fields...');
  try {
    const res = await fetch(`${url}/rest/v1/products?select=id,name,category_id,categories`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    const data = await res.json();
    console.log('Products:', JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('Error fetching products:', err);
  }
}

run();
