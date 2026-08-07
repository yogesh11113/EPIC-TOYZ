const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function signup(payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/auth/v1/signup`);
    const data = JSON.stringify(payload);
    const req = https.request({
      hostname: url.hostname,
      path: url.pathname,
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
  console.log('Testing signup with metadata...');
  const res = await signup({
    email: 'epictoyz.in@gmail.com',
    password: 'yogesh123*',
    data: { full_name: 'Epic Toyz Admin' }
  });
  console.log('Status:', res.status);
  console.log('Response:', JSON.stringify(res.data, null, 2));
}

main();
