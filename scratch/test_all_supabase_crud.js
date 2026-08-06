const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function request(method, path, body = null) {
  return new Promise((resolve) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${path}`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: method,
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      }
    };
    const req = https.request(options, (res) => {
      let resBody = '';
      res.on('data', chunk => resBody += chunk);
      res.on('end', () => {
        let parsed = resBody;
        try { parsed = JSON.parse(resBody); } catch (e) {}
        resolve({ status: res.statusCode, data: parsed, raw: resBody });
      });
    });
    req.on('error', err => resolve({ error: err.message }));
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== SUPABASE DEEP CRUD & PERSISTENCE TEST ===\n');

  // 1. SETTINGS
  console.log('--- 1. Settings Table Test ---');
  const setInsert = await request('POST', 'settings', { key: 'shop_settings', value: { shopName: 'Epic Toyz', shipping: 65 } });
  console.log('Insert settings status:', setInsert.status, 'Response:', JSON.stringify(setInsert.data));
  const setGet = await request('GET', 'settings?key=eq.shop_settings');
  console.log('Read settings status:', setGet.status, 'Data:', JSON.stringify(setGet.data));

  // 2. REVIEWS
  console.log('\n--- 2. Reviews CRUD Test ---');
  // First get a product ID
  const prods = await request('GET', 'products?select=id,name&limit=1');
  if (prods.data && prods.data.length > 0) {
    const prodId = prods.data[0].id;
    console.log('Using product ID:', prodId);

    // Create Review
    const revCreate = await request('POST', 'reviews', {
      product_id: prodId,
      reviewer_name: 'Test Customer',
      reviewer_email: 'test@customer.com',
      rating: 5,
      title: 'Amazing RC Car!',
      review_text: 'This car is super fast and high quality!',
      is_approved: false
    });
    console.log('Create review status:', revCreate.status, 'Data:', JSON.stringify(revCreate.data));

    if (Array.isArray(revCreate.data) && revCreate.data[0]?.id) {
      const revId = revCreate.data[0].id;
      // Read review
      const revRead = await request('GET', `reviews?id=eq.${revId}`);
      console.log('Read review status:', revRead.status, 'Data:', JSON.stringify(revRead.data));

      // Approve review (Update)
      const revUpdate = await request('PATCH', `reviews?id=eq.${revId}`, { is_approved: true });
      console.log('Approve review status:', revUpdate.status, 'Data:', JSON.stringify(revUpdate.data));

      // Verify public read of approved review
      const revAppRead = await request('GET', `reviews?product_id=eq.${prodId}&is_approved=eq.true`);
      console.log('Public read approved review status:', revAppRead.status, 'Count:', revAppRead.data.length);

      // Clean up test review
      const revDel = await request('DELETE', `reviews?id=eq.${revId}`);
      console.log('Delete review status:', revDel.status);
    }
  }

  // 3. PROFILES / USER ACCOUNT
  console.log('\n--- 3. Profiles / User Account Test ---');
  const testUserId = '00000000-0000-4000-a000-000000000001';
  const profUpsert = await request('POST', 'profiles', { id: testUserId, full_name: 'Test Automation User', phone: '9998887776' });
  console.log('Profile upsert status:', profUpsert.status, 'Data:', JSON.stringify(profUpsert.data));
  const profGet = await request('GET', `profiles?id=eq.${testUserId}`);
  console.log('Profile read status:', profGet.status, 'Data:', JSON.stringify(profGet.data));
  const profDel = await request('DELETE', `profiles?id=eq.${testUserId}`);
  console.log('Profile delete status:', profDel.status);

  // 4. ORDERS
  console.log('\n--- 4. Orders CRUD Test ---');
  const orderTestId = '00000000-0000-4000-a000-000000000002';
  const orderCreate = await request('POST', 'orders', {
    id: orderTestId,
    order_number: 'ET-TEST-' + Date.now(),
    customer_name: 'Test Customer',
    customer_phone: '9998887776',
    customer_email: 'test@example.com',
    address_line1: '123 Test Street',
    city: 'Chennai',
    state: 'Tamil Nadu',
    pincode: '600001',
    subtotal: 1000,
    shipping: 65,
    total: 1065,
    order_status: 'pending'
  });
  console.log('Order create status:', orderCreate.status, 'Data:', JSON.stringify(orderCreate.data));
  const orderRead = await request('GET', `orders?id=eq.${orderTestId}`);
  console.log('Order read status:', orderRead.status, 'Data:', JSON.stringify(orderRead.data));
  const orderDel = await request('DELETE', `orders?id=eq.${orderTestId}`);
  console.log('Order delete status:', orderDel.status);

  console.log('\n=== TEST COMPLETE ===');
}

runTests();
