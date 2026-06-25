const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function run() {
  try {
    const cname = await new Promise((resolve, reject) => {
      dns.resolveCname('aws-0-ap-south-1.pooler.supabase.com', (err, addresses) => {
        if (err) reject(err);
        else resolve(addresses);
      });
    });
    console.log('CNAME:', cname);
  } catch (e) {
    console.log('Failed:', e.message);
  }
}

run();
