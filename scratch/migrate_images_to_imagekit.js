/**
 * Epic Toyz — Base64 → ImageKit Migration Script
 * ─────────────────────────────────────────────────────────────
 * Run once:  node scratch/migrate_images_to_imagekit.js
 *
 * Requires Node 18+ (native fetch, FormData, Blob).
 * Private Key is used only here (server-side). It is NEVER sent
 * to the browser or committed to client-side files.
 * ─────────────────────────────────────────────────────────────
 */

// ════════════════════════════════════════════════════════
//  CREDENTIALS — all pre-filled, do not edit
// ════════════════════════════════════════════════════════
const SUPABASE_URL  = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const SUPABASE_KEY  = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';

const IK_PRIVATE_KEY   = 'private_IhEtHmXEPaBQIj6ZtuLbAsqDSJ8=';
const IK_PUBLIC_KEY    = 'public_ltyTYNk61moMtNetYZNKGQfaZug=';
const IK_URL_ENDPOINT  = 'https://ik.imagekit.io/40toq7rru';
const IK_UPLOAD_URL    = 'https://upload.imagekit.io/api/v1/files/upload';
const IK_FOLDER        = '/products';

// Set true to preview without making any changes
const DRY_RUN = false;

// ════════════════════════════════════════════════════════
//  HELPERS
// ════════════════════════════════════════════════════════

const SB_HEADERS = {
  'apikey':        SUPABASE_KEY,
  'Authorization': `Bearer ${SUPABASE_KEY}`,
  'Content-Type':  'application/json',
};

// Basic-auth header for ImageKit server-side API (private key = username, empty password)
const IK_AUTH = 'Basic ' + Buffer.from(`${IK_PRIVATE_KEY}:`).toString('base64');

/** Fetch lightweight product list (id + name only) */
async function fetchProductList() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/products?select=id,name`, {
    headers: SB_HEADERS,
  });
  if (!res.ok) throw new Error(`Supabase product list failed: ${res.status} ${await res.text()}`);
  return res.json();
}

/** Fetch just the images[] column for one product */
async function fetchProductImages(id) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}&select=images`,
    { headers: SB_HEADERS }
  );
  if (!res.ok) throw new Error(`Supabase images fetch failed for ${id}: ${res.status}`);
  const rows = await res.json();
  return (rows[0]?.images) || [];
}

/** Overwrite the images[] column for one product */
async function patchImages(id, images) {
  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/products?id=eq.${encodeURIComponent(id)}`,
    {
      method:  'PATCH',
      headers: { ...SB_HEADERS, 'Prefer': 'return=minimal' },
      body:    JSON.stringify({ images }),
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Supabase PATCH failed for ${id}: ${res.status} ${body}`);
  }
}

/**
 * Upload a Base64 data-URL to ImageKit using the server-side (authenticated) API.
 * Uses the private key — never exposed to the browser.
 * @param {string} base64DataUrl   Full "data:image/jpeg;base64,..." string
 * @param {string} fileName        e.g. "et_productid_1.webp"
 * @returns {Promise<string>}      Permanent ImageKit CDN URL
 */
async function uploadToImageKit(base64DataUrl, fileName) {
  // Parse data URL
  const m = base64DataUrl.match(/^data:([^;]+);base64,(.+)$/s);
  if (!m) throw new Error('Not a valid Base64 data URL');
  const mimeType = m[1];
  const buffer   = Buffer.from(m[2], 'base64');

  // Build multipart body
  const blob = new Blob([buffer], { type: mimeType });
  const form = new FormData();
  form.append('file',      blob,     fileName);
  form.append('fileName',  fileName);
  form.append('folder',    IK_FOLDER);

  const res = await fetch(IK_UPLOAD_URL, {
    method:  'POST',
    headers: { 'Authorization': IK_AUTH },
    body:    form,
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`ImageKit upload failed (${res.status}): ${errText}`);
  }

  const json = await res.json();
  if (!json.url) throw new Error('ImageKit returned no URL: ' + JSON.stringify(json));

  // Append WebP + quality transform — ImageKit serves the right format automatically
  return json.url + '?tr=f-webp,q-80';
}

/** Small delay helper to avoid hammering ImageKit rate limits */
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// ════════════════════════════════════════════════════════
//  MAIN
// ════════════════════════════════════════════════════════

async function run() {
  // Node version check
  const [major] = process.versions.node.split('.').map(Number);
  if (major < 18) {
    console.error(`❌  Node.js 18+ required (you have ${process.versions.node}).`);
    console.error('    Run: nvm use 18  or update Node at https://nodejs.org');
    process.exit(1);
  }

  console.log('═══════════════════════════════════════════════════');
  console.log('  Epic Toyz — Base64 → ImageKit Migration');
  console.log(DRY_RUN ? '  MODE: DRY RUN (no writes)' : '  MODE: LIVE (will update Supabase)');
  console.log('═══════════════════════════════════════════════════\n');

  // 1. Fetch product list (lightweight)
  console.log('📡  Fetching product list from Supabase…');
  let products;
  try {
    products = await fetchProductList();
  } catch (e) {
    console.error('❌  Could not fetch products:', e.message);
    process.exit(1);
  }
  console.log(`✅  Found ${products.length} products.\n`);

  let totalBase64 = 0, totalUploaded = 0, totalSkipped = 0;
  let successProducts = 0, failProducts = 0;
  const errors = [];

  // 2. Process each product individually (memory-efficient)
  for (let pi = 0; pi < products.length; pi++) {
    const { id, name } = products[pi];
    const label = `[${pi + 1}/${products.length}] ${(name || id).slice(0, 50)}`;

    // Fetch this product's images
    let images;
    try {
      images = await fetchProductImages(id);
    } catch (e) {
      console.error(`  ❌  Could not fetch images for ${id}: ${e.message}`);
      errors.push(`${label}: image fetch failed — ${e.message}`);
      failProducts++;
      continue;
    }

    // Check if any image is Base64
    const hasBase64 = images.some(img => img && img.startsWith('data:image'));
    if (!hasBase64) {
      // Nothing to do for this product
      totalSkipped += images.filter(img => img && img.startsWith('http')).length;
      continue;
    }

    console.log(`\n${label}`);
    const newImages = [];
    let productFailed = false;

    for (let ii = 0; ii < images.length; ii++) {
      const img = images[ii];

      if (!img || !img.startsWith('data:image')) {
        newImages.push(img); // Already a URL, keep as-is
        totalSkipped++;
        continue;
      }

      totalBase64++;
      const sizeKB = Math.round((img.length * 3) / 4 / 1024);
      const fname  = `et_${id.slice(-8)}_img${ii + 1}_${Date.now()}.jpg`;
      process.stdout.write(`  📤  Image ${ii + 1}/${images.length} (${sizeKB} KB) → ImageKit… `);

      if (DRY_RUN) {
        console.log('[DRY RUN — skipped]');
        newImages.push(`${IK_URL_ENDPOINT}/placeholder.webp`);
        totalUploaded++;
        continue;
      }

      try {
        const url = await uploadToImageKit(img, fname);
        console.log('✅');
        console.log(`      URL: ${url.slice(0, 80)}`);
        newImages.push(url);
        totalUploaded++;
        await sleep(200); // be gentle on rate limits
      } catch (e) {
        console.log(`❌  ${e.message}`);
        errors.push(`${label} image ${ii + 1}: ${e.message}`);
        newImages.push(img); // keep original on failure
        productFailed = true;
      }
    }

    // Patch Supabase with the new image array
    if (!DRY_RUN) {
      try {
        await patchImages(id, newImages);
        console.log(`  💾  Supabase updated.`);
      } catch (e) {
        console.error(`  ❌  Supabase PATCH failed: ${e.message}`);
        errors.push(`${label}: Supabase patch failed — ${e.message}`);
        productFailed = true;
      }
    }

    if (productFailed) failProducts++;
    else successProducts++;
  }

  // 3. Summary
  console.log('\n\n═══════════════════════════════════════════════════');
  console.log('  Migration Summary');
  console.log('═══════════════════════════════════════════════════');
  console.log(`  ✅  Products migrated:   ${successProducts}`);
  console.log(`  📤  Images uploaded:     ${totalUploaded}`);
  console.log(`  ↩   Images already URLs: ${totalSkipped}`);
  console.log(`  ❌  Failures:            ${failProducts}`);

  if (errors.length) {
    console.log('\n  Errors:');
    errors.forEach(e => console.log('    •', e));
  }

  if (failProducts === 0) {
    console.log('\n🎉  Migration complete! Verify with:');
    console.log('    node scratch/query_images.js');
  } else {
    console.log('\n⚠️   Re-run this script to retry failed products (it is idempotent).');
  }
}

run().catch(e => { console.error('Fatal:', e); process.exit(1); });
