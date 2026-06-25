const dns = require('dns');
dns.setServers(['8.8.8.8', '1.1.1.1']);

async function run() {
  const hosts = [
    'aws-0-ap-south-1.pooler.supabase.com',
    'aws-0-ap-south-2.pooler.supabase.com',
    'aws-0-ap-southeast-2.pooler.supabase.com',
    'aws-0-ap-southeast-1.pooler.supabase.com'
  ];

  for (const host of hosts) {
    try {
      const addresses = await new Promise((resolve, reject) => {
        dns.resolve(host, (err, addresses) => {
          if (err) reject(err);
          else resolve(addresses);
        });
      });
      console.log(`${host} IP addresses:`, addresses);
    } catch (e) {
      console.log(`Failed to resolve ${host}:`, e.message);
    }
  }
}

run();
