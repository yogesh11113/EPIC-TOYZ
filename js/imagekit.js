/**
 * Epic Toyz — ImageKit Upload Module
 * ─────────────────────────────────────────────────────────────
 * Handles browser-side image upload to ImageKit CDN.
 * Converts images to WebP locally before uploading, so the
 * database always stores clean HTTPS URLs — never Base64.
 *
 * ── SETUP (one-time) ────────────────────────────────────────
 * 1. Create a FREE account at https://imagekit.io
 * 2. After sign-up, go to: Dashboard → Developer Options → API Keys
 * 3. Copy your "Public Key"  → paste into IMAGEKIT_PUBLIC_KEY below
 * 4. Copy your "URL Endpoint" from the top of the Dashboard
 *    (looks like: https://ik.imagekit.io/yourname)
 *    → paste into IMAGEKIT_URL_ENDPOINT below
 * 5. In ImageKit Dashboard → Settings → Upload settings:
 *    Enable "Allow unsigned API requests" (toggle ON)
 *
 * For the one-time migration script (scratch/migrate_images_to_imagekit.js)
 * you also need your Private Key — only put it in that server-side script,
 * NEVER in this browser file.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

// ── CREDENTIALS ──────────────────────────────────────────────
// Public Key is safe to include in browser code (read-only upload token).
// Private Key is NEVER placed here — it lives only in the server-side migration script.
const IMAGEKIT_PUBLIC_KEY    = 'public_ltyTYNk61moMtNetYZNKGQfaZug=';
const IMAGEKIT_URL_ENDPOINT  = 'https://ik.imagekit.io/40toq7rru';
// ─────────────────────────────────────────────────────────────

const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

const ImageKitUpload = {

  /**
   * Returns true when credentials have been filled in.
   * @returns {boolean}
   */
  isConfigured() {
    return (
      IMAGEKIT_PUBLIC_KEY  !== 'YOUR_IMAGEKIT_PUBLIC_KEY'  &&
      IMAGEKIT_URL_ENDPOINT !== 'YOUR_IMAGEKIT_URL_ENDPOINT' &&
      IMAGEKIT_PUBLIC_KEY.length > 10
    );
  },

  /**
   * Resize + convert a File to WebP, then upload to ImageKit.
   * Returns a permanent CDN URL with auto-WebP transform applied.
   *
   * @param {File}   file          - Raw image file from <input type="file">
   * @param {object} [opts]
   * @param {number} [opts.maxDimension=800] - Max width or height in px
   * @param {number} [opts.quality=0.82]     - WebP quality 0–1
   * @param {string} [opts.folder='/products'] - ImageKit folder path
   * @returns {Promise<string>} Permanent ImageKit URL
   */
  async uploadFile(file, { maxDimension = 800, quality = 0.82, folder = '/products' } = {}) {
    if (!this.isConfigured()) {
      throw new Error(
        'ImageKit is not configured.\n' +
        'Open js/imagekit.js and set IMAGEKIT_PUBLIC_KEY and IMAGEKIT_URL_ENDPOINT.\n' +
        'See setup instructions at the top of that file.'
      );
    }

    // Step 1: Resize + convert to WebP Blob
    const webpBlob = await this._toWebPBlob(file, maxDimension, quality);
    const fileName = `et_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`;

    // Step 2: Build multipart form data
    const form = new FormData();
    form.append('file', webpBlob, fileName);
    form.append('fileName', fileName);
    form.append('publicKey', IMAGEKIT_PUBLIC_KEY);
    form.append('folder', folder);

    // Step 3: Upload to ImageKit
    let res;
    try {
      res = await fetch(IMAGEKIT_UPLOAD_URL, { method: 'POST', body: form });
    } catch (networkErr) {
      throw new Error('ImageKit upload failed — network error: ' + networkErr.message);
    }

    if (!res.ok) {
      let errBody = '';
      try { errBody = await res.text(); } catch (_) {}
      throw new Error(`ImageKit upload failed (HTTP ${res.status}): ${errBody}`);
    }

    const json = await res.json();

    if (!json.url) {
      throw new Error('ImageKit did not return a URL. Response: ' + JSON.stringify(json));
    }

    // Return the CDN URL. ImageKit auto-serves WebP when the browser supports it,
    // and we append a quality transform for good measure.
    return json.url + '?tr=f-webp,q-80';
  },

  /**
   * Resize an image and convert to a WebP Blob using the browser canvas API.
   *
   * @param {File}   file
   * @param {number} maxDimension
   * @param {number} quality  (0–1)
   * @returns {Promise<Blob>}
   * @private
   */
  _toWebPBlob(file, maxDimension, quality) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onerror = () => reject(new Error('Could not read image file'));
      reader.onload = (ev) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Invalid image — could not decode'));
        img.onload = () => {
          // Compute new dimensions maintaining aspect ratio
          let w = img.width;
          let h = img.height;
          if (w > h) {
            if (w > maxDimension) { h = Math.round(h * maxDimension / w); w = maxDimension; }
          } else {
            if (h > maxDimension) { w = Math.round(w * maxDimension / h); h = maxDimension; }
          }

          const canvas = document.createElement('canvas');
          canvas.width  = w;
          canvas.height = h;
          canvas.getContext('2d').drawImage(img, 0, 0, w, h);

          // Try WebP first; fall back to JPEG if browser doesn't support webp blobs
          canvas.toBlob(
            (blob) => {
              if (blob) {
                resolve(blob);
              } else {
                // Fallback: JPEG blob
                canvas.toBlob(
                  (jpegBlob) => {
                    if (jpegBlob) resolve(jpegBlob);
                    else reject(new Error('Canvas toBlob failed — no blob produced'));
                  },
                  'image/jpeg',
                  quality
                );
              }
            },
            'image/webp',
            quality
          );
        };
        img.src = ev.target.result;
      };

      reader.readAsDataURL(file);
    });
  },
};

// ── Expose to global scope ────────────────────────────────────
window.ImageKitUpload     = ImageKitUpload;
window.IMAGEKIT_PUBLIC_KEY    = IMAGEKIT_PUBLIC_KEY;
window.IMAGEKIT_URL_ENDPOINT  = IMAGEKIT_URL_ENDPOINT;

// Startup check
if (!ImageKitUpload.isConfigured()) {
  console.warn(
    '[EpicToyz] ⚠️ ImageKit is NOT configured.\n' +
    'Product image uploads will fail until you set your credentials in js/imagekit.js.\n' +
    'See setup instructions inside that file.\n' +
    'Get a FREE account at: https://imagekit.io'
  );
} else {
  console.info('[EpicToyz] ✅ ImageKit configured — URL endpoint:', IMAGEKIT_URL_ENDPOINT);
}
