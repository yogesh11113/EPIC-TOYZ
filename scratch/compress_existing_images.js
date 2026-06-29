const url = 'https://wzqaawfqcjxztiyfsmof.supabase.co';
const anonKey = 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9';
const { Jimp } = require('jimp');

async function compressImage(base64Str) {
  if (!base64Str || !base64Str.startsWith('data:image')) {
    return base64Str; // Not a base64 data URL, return as-is
  }

  try {
    // Extract base64 part
    const matches = base64Str.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return base64Str;
    }

    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    // Read with Jimp
    const image = await Jimp.read(buffer);

    // Resize to maximum 400px width
    if (image.bitmap.width > 400) {
      image.resize({ w: 400 });
      console.log(`  Resized image from width ${image.bitmap.width} to 400px`);
    } else {
      // Force resize to re-encode and compress even if smaller
      image.resize({ w: Math.min(image.bitmap.width, 400) });
    }

    // Export with 50% JPEG quality
    const compressedBuffer = await image.getBuffer('image/jpeg', { quality: 50 });
    return `data:image/jpeg;base64,${compressedBuffer.toString('base64')}`;
  } catch (err) {
    console.error('Error compressing image:', err.message);
    return base64Str; // Return original on error
  }
}

async function run() {
  console.log('Fetching lightweight product list...');
  try {
    const fieldsRes = await fetch(`${url}/rest/v1/products?select=id,name`, {
      method: 'GET',
      headers: {
        'apikey': anonKey,
        'Authorization': `Bearer ${anonKey}`
      }
    });

    const allProducts = await fieldsRes.json();
    console.log(`Found ${allProducts.length} products in database. Processing one by one...`);

    for (const p of allProducts) {
      console.log(`Processing Product: ${p.id} (${p.name.slice(0, 40)}...)`);

      // Fetch the full images array
      const itemRes = await fetch(`${url}/rest/v1/products?id=eq.${p.id}&select=images`, {
        method: 'GET',
        headers: {
          'apikey': anonKey,
          'Authorization': `Bearer ${anonKey}`
        }
      });
      const data = await itemRes.json();
      const images = data[0]?.images || [];

      if (images.length === 0) {
        console.log('  No images to compress.');
        continue;
      }

      let updated = false;
      const compressedImages = [];

      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (img && img.startsWith('data:image')) {
          console.log(`  Compressing image ${i + 1}/${images.length} (original size: ${img.length} chars)...`);
          const compressed = await compressImage(img);
          console.log(`  -> Compressed size: ${compressed.length} chars (reduction: ${Math.round((img.length - compressed.length) / img.length * 100)}%)`);
          compressedImages.push(compressed);
          updated = true;
        } else {
          compressedImages.push(img);
        }
      }

      if (updated) {
        console.log(`  Updating product ${p.id} in Supabase...`);
        const updateRes = await fetch(`${url}/rest/v1/products?id=eq.${p.id}`, {
          method: 'PATCH',
          headers: {
            'apikey': anonKey,
            'Authorization': `Bearer ${anonKey}`,
            'Content-Type': 'application/json',
            'Prefer': 'return=representation'
          },
          body: JSON.stringify({ images: compressedImages })
        });
        console.log(`  Update response status: ${updateRes.status}`);
      } else {
        console.log('  No base64 images found/updated.');
      }
    }

    console.log('Done image compression migration!');
  } catch (err) {
    console.error('Migration failed:', err);
  }
}

run();
