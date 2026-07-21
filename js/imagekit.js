/**
 * Epic Toyz — ImageKit Upload Module
 * ─────────────────────────────────────────────────────────────
 * Handles browser-side image upload to ImageKit CDN.
 *
 * Auth flow (secure — private key never touches the browser):
 *   1. Browser calls  GET /api/imagekit-auth
 *   2. Vercel serverless function generates token + expire + signature
 *      using the Private Key (stored only in Vercel env vars)
 *   3. Browser POSTs the image to ImageKit with those 4 auth params
 *   4. ImageKit returns a permanent CDN URL
 *
 * ── SETUP CHECKLIST ─────────────────────────────────────────
 * Public credentials below are already filled in — do not change them.
 *
 * ONE-TIME server setup (Vercel dashboard):
 *   Dashboard → Your Project → Settings → Environment Variables → Add:
 *     IMAGEKIT_PRIVATE_KEY = private_IhEtHmXEPaBQIj6ZtuLbAsqDSJ8=
 *
 * The Private Key must NEVER be placed in this file or any browser JS.
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

// ── PUBLIC CREDENTIALS (safe for browser) ────────────────────
const IMAGEKIT_PUBLIC_KEY   = 'public_ltyTYNk61moMtNetYZNKGQfaZug=';
const IMAGEKIT_URL_ENDPOINT = 'https://ik.imagekit.io/40toq7rru';
// ─────────────────────────────────────────────────────────────

const IMAGEKIT_UPLOAD_URL = 'https://upload.imagekit.io/api/v1/files/upload';

/**
 * The URL of the serverless auth endpoint.
 * Works on Vercel (deployed) and locally if you run `vercel dev`.
 * Automatically resolves to the same origin — no hard-coded domain needed.
 */
const IMAGEKIT_AUTH_ENDPOINT = '/api/imagekit-auth';

const ImageKitUpload = {

  /**
   * Returns true when the public credentials have been filled in.
   * @returns {boolean}
   */
  isConfigured() {
    return (
      IMAGEKIT_PUBLIC_KEY   !== 'YOUR_IMAGEKIT_PUBLIC_KEY'  &&
      IMAGEKIT_URL_ENDPOINT !== 'YOUR_IMAGEKIT_URL_ENDPOINT' &&
      IMAGEKIT_PUBLIC_KEY.length > 10
    );
  },

  /**
   * Fetch a fresh set of auth parameters from the serverless endpoint.
   * Returns { token, expire, signature }.
   *
   * @returns {Promise<{token: string, expire: number, signature: string}>}
   * @private
   */
  async _getAuthParams() {
    let res;
    try {
      res = await fetch(IMAGEKIT_AUTH_ENDPOINT, { method: 'GET' });
    } catch (networkErr) {
      throw new Error(
        'Could not reach ImageKit auth endpoint (/api/imagekit-auth). ' +
        'Make sure the site is deployed on Vercel (or run "vercel dev" locally). ' +
        'Network error: ' + networkErr.message
      );
    }

    if (!res.ok) {
      let body = '';
      try { body = await res.text(); } catch (_) {}
      throw new Error(
        `ImageKit auth endpoint returned HTTP ${res.status}. ` +
        'Check that IMAGEKIT_PRIVATE_KEY is set in Vercel Environment Variables. ' +
        'Details: ' + body
      );
    }

    const data = await res.json();

    if (!data.token || !data.expire || !data.signature) {
      throw new Error(
        'ImageKit auth endpoint returned incomplete data: ' + JSON.stringify(data)
      );
    }

    return data; // { token, expire, signature }
  },

  /**
   * Resize + convert a File to WebP, fetch auth params, then upload to ImageKit.
   * Returns a permanent CDN URL.
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
        'Open js/imagekit.js and verify IMAGEKIT_PUBLIC_KEY and IMAGEKIT_URL_ENDPOINT.'
      );
    }

    // Step 1: Resize + convert to WebP Blob
    const webpBlob = await this._toWebPBlob(file, maxDimension, quality);
    const fileName = `et_${Date.now()}_${Math.random().toString(36).slice(2, 7)}.webp`;

    // Step 2: Get server-generated auth params (token, expire, signature)
    let authParams;
    try {
      authParams = await this._getAuthParams();
    } catch (authErr) {
      throw authErr; // already has a descriptive message
    }

    // Step 3: Build multipart form data with all required ImageKit auth params
    const form = new FormData();
    form.append('file',      webpBlob, fileName);
    form.append('fileName',  fileName);
    form.append('publicKey', IMAGEKIT_PUBLIC_KEY);
    form.append('token',     authParams.token);
    form.append('expire',    String(authParams.expire));
    form.append('signature', authParams.signature);
    form.append('folder',    folder);

    // Step 4: Upload to ImageKit
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

    // Return the CDN URL with WebP + quality transform
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

          // Try WebP first; fall back to JPEG if browser doesn't support WebP blobs
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
window.ImageKitUpload    = ImageKitUpload;
window.IMAGEKIT_PUBLIC_KEY   = IMAGEKIT_PUBLIC_KEY;
window.IMAGEKIT_URL_ENDPOINT = IMAGEKIT_URL_ENDPOINT;

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
