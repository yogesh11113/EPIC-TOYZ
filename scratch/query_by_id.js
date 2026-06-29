const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  const ids = [
    "39866df9-8d92-473e-ac31-0ac32d970eb1",
    "92414ea2-1244-4513-8a36-683d821c8495",
    "97ef87f7-87cb-47cb-8016-9519d87cfd34",
    "450d5cb1-bd7c-44fa-b7b2-234ffe8ce994",
    "94555efb-344d-462f-9c63-d42719c8d66d"
  ];

  // First fetch all 17 IDs using the lightweight query
  try {
    const fields = 'id,name';
    const res = await fetch(`${url}/rest/v1/products?select=${fields}`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    const allProducts = await res.json();
    console.log(`Fetched ${allProducts.length} IDs. Testing images for each...`);

    for (const p of allProducts) {
      console.log(`Testing ID: ${p.id} (${p.name.slice(0, 30)}...)`);
      try {
        const itemRes = await fetch(`${url}/rest/v1/products?id=eq.${p.id}&select=images`, {
          method: 'GET',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`
          }
        });
        if (itemRes.status !== 200) {
          console.log(`❌ FAILED for ID: ${p.id} with status: ${itemRes.status}`);
          const text = await itemRes.text();
          console.log(`Error body: ${text}`);
        } else {
          const data = await itemRes.json();
          const imgLen = data[0]?.images ? JSON.stringify(data[0].images).length : 0;
          console.log(`✅ SUCCESS: images size = ${imgLen} chars`);
        }
      } catch (err) {
        console.log(`❌ ERROR for ID: ${p.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('Error fetching IDs:', err);
  }
}

run();
