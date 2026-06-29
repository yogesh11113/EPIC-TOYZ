const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  console.log('Fetching products images from Supabase...');
  try {
    const res = await fetch(`${url}/rest/v1/products?select=id,name,images`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });
    console.log('Status:', res.status);
    const data = await res.json();
    for (const p of data) {
      console.log(`Product: ${p.name}`);
      console.log(`- Images count: ${p.images ? p.images.length : 0}`);
      if (p.images) {
        for (let i = 0; i < p.images.length; i++) {
          const img = p.images[i];
          console.log(`  - Image ${i} length: ${img ? img.length : 0}`);
          if (img && img.startsWith('data:')) {
            console.log(`  - Image ${i} starts with data URL (base64)!`);
          } else if (img) {
            console.log(`  - Image ${i} URL: ${img.slice(0, 100)}`);
          }
        }
      }
    }
  } catch (err) {
    console.error('Error:', err);
  }
}

run();
