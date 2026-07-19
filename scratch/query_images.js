/**
 * Verification: check all product images in Supabase.
 * Run after migration: node scratch/query_images.js
 */

const SUPABASE_URL = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_KEY = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

async function run() {
  console.log('🔍  Querying Supabase products for image status...\n');

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?select=id,name,images&order=name.asc`,
    { headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` } }
  );

  if (!res.ok) {
    console.error('❌  Supabase error:', res.status, await res.text());
    process.exit(1);
  }

  const products = await res.json();
  let b64Count = 0, urlCount = 0, emptyCount = 0, totalImages = 0;
  const b64Products = [];

  for (const p of products) {
    const images = p.images || [];
    const name   = (p.name || p.id).slice(0, 45);
    process.stdout.write(`  ${name.padEnd(47)}`);

    if (images.length === 0) {
      console.log('⚪  no images');
      emptyCount++;
      continue;
    }

    const imgStatuses = images.map(img => {
      totalImages++;
      if (!img) return '∅ null';
      if (img.startsWith('data:image')) { b64Count++; return `❌ BASE64 (${Math.round(img.length * 0.75 / 1024)} KB)`; }
      if (img.startsWith('http'))       { urlCount++;  return `✅ URL`; }
      return `⚠️  unknown (${img.slice(0, 30)})`;
    });

    const allOk = imgStatuses.every(s => s.startsWith('✅'));
    console.log(allOk ? `✅  ${images.length} URL(s)` : imgStatuses.join(' | '));

    if (imgStatuses.some(s => s.startsWith('❌'))) {
      b64Products.push({ id: p.id, name: p.name });
    }
  }

  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Total products:        ${products.length}`);
  console.log(`  Total images:          ${totalImages}`);
  console.log(`  ✅  ImageKit URLs:     ${urlCount}`);
  console.log(`  ❌  Still Base64:      ${b64Count}`);
  console.log(`  ⚪  No image:          ${emptyCount}`);
  console.log('═══════════════════════════════════════════════════');

  if (b64Count === 0 && urlCount > 0) {
    console.log('\n🎉  MIGRATION COMPLETE — all images are now ImageKit URLs!');
    console.log('    Supabase egress will be dramatically reduced.');
    console.log('    Products API response should now be < 100 KB.\n');
  } else if (b64Count > 0) {
    console.log(`\n⚠️   ${b64Count} Base64 image(s) remain in ${b64Products.length} product(s):`);
    b64Products.forEach(p => console.log(`    • ${p.name} (${p.id})`));
    console.log('\n    Re-run the migration: node scratch/migrate_images_to_imagekit.js\n');
  }

  // Also check approximate response size
  const approxSize = products.reduce((sum, p) => {
    return sum + JSON.stringify(p.images || []).length;
  }, 0);
  const approxKB = Math.round(approxSize / 1024);
  console.log(`  📊  Approx images data size: ${approxKB} KB`);
  if (approxKB < 200) {
    console.log('  ✅  Response size is healthy (< 200 KB).');
  } else {
    console.log('  ⚠️   Response is still large. Check for remaining Base64.');
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
