const https = require('https');

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

function authRequest(endpoint, payload) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/auth/v1/${endpoint}`);
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
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body || '{}') }));
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function main() {
  console.log('Testing signInWithPassword for epictoyz.in@gmail.com...');
  const signInRes = await authRequest('token?grant_type=password', {
    email: 'epictoyz.in@gmail.com',
    password: 'yogesh123*'
  });
  console.log('SignIn Status:', signInRes.status);
  console.log('SignIn Response:', JSON.stringify(signInRes.body, null, 2));

  if (signInRes.status !== 200) {
    console.log('\nUser does not exist or password mismatch. Attempting signUp...');
    const signUpRes = await authRequest('signup', {
      email: 'epictoyz.in@gmail.com',
      password: 'yogesh123*'
    });
    console.log('SignUp Status:', signUpRes.status);
    console.log('SignUp Response:', JSON.stringify(signUpRes.body, null, 2));
  }
}

main();
