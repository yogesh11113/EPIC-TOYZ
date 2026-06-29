const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  console.log('Fetching products listing fields for all 17 products...');
  try {
    const fields = 'id,name,slug,price,original_price,stock_quantity,badge,is_featured,rating,review_count,category_id,images';
    const res = await fetch(`${url}/rest/v1/products?select=${fields}`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log('Status:', res.status);
    if (res.status === 200) {
      const data = await res.json();
      console.log('Success! Count:', data.length);
    } else {
      const text = await res.text();
      console.log('Failed! Body:', text);
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
