const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function request(path, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}${path}`);
    const data = JSON.stringify(payload);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'POST',
      headers: {
        'apikey': SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(data)
      }
    }, (res) => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('1. Testing sign-in with email & password...');
  const res1 = await request('/auth/v1/token?grant_type=password', {
    email: 'epictoyz.in@gmail.com',
    password: 'yogesh123*'
  });
  console.log('Sign-in result:', res1.status, res1.data);

  if (res1.status !== 200) {
    console.log('\n2. Testing sign-up for epictoyz.in@gmail.com...');
    const res2 = await request('/auth/v1/signup', {
      email: 'epictoyz.in@gmail.com',
      password: 'yogesh123*'
    });
    console.log('Sign-up result:', res2.status, res2.data);
  }
}

main();
