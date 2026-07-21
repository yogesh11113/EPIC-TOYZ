/**
 * Epic Toyz — ImageKit Auth Endpoint
 * ─────────────────────────────────────────────────────────────
 * Vercel Serverless Function: /api/imagekit-auth
 *
 * Called by the browser (js/imagekit.js) before every upload.
 * Generates the three auth parameters that ImageKit requires for
 * client-side uploads:
 *
 *   token     — a unique UUID (one-time use)
 *   expire    — Unix timestamp 30 min from now
 *   signature — HMAC-SHA1( token + expire,  privateKey )
 *
 * The IMAGEKIT_PRIVATE_KEY is read from Vercel Environment Variables.
 * It is NEVER sent to the browser or committed to source code.
 *
 * Setup (one-time):
 *   Vercel Dashboard → Your Project → Settings → Environment Variables
 *   → Add: IMAGEKIT_PRIVATE_KEY = private_IhEtHmXEPaBQIj6ZtuLbAsqDSJ8=
 * ─────────────────────────────────────────────────────────────
 */

'use strict';

const crypto = require('crypto');

/**
 * Generate a UUID v4 string (used as the one-time token).
 * @returns {string}
 */
function generateToken() {
  return crypto.randomUUID
    ? crypto.randomUUID()
    : crypto.randomBytes(16).toString('hex');
}

/**
 * Compute HMAC-SHA1 signature for ImageKit client-side uploads.
 * @param {string} privateKey  — ImageKit private key (from env var)
 * @param {string} token       — UUID token
 * @param {number} expire      — Unix timestamp
 * @returns {string}           — hex-encoded HMAC-SHA1
 */
function computeSignature(privateKey, token, expire) {
  return crypto
    .createHmac('sha1', privateKey)
    .update(token + expire)
    .digest('hex');
}

/**
 * Vercel serverless handler.
 * Supports OPTIONS pre-flight for CORS.
 */
module.exports = async function handler(req, res) {
  // ── CORS headers — allows the admin dashboard (same origin or
  //    Vercel preview URLs) to call this endpoint ──────────────
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS pre-flight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Only GET allowed
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed. Use GET.' });
  }

  // ── Read private key from environment ──────────────────────
  const privateKey = process.env.IMAGEKIT_PRIVATE_KEY;
  if (!privateKey) {
    console.error('[imagekit-auth] IMAGEKIT_PRIVATE_KEY env var is not set!');
    return res.status(500).json({
      error:
        'Server misconfiguration: IMAGEKIT_PRIVATE_KEY is not set. ' +
        'Add it in Vercel → Project Settings → Environment Variables.',
    });
  }

  // ── Generate auth params ────────────────────────────────────
  const token  = generateToken();
  const expire = Math.floor(Date.now() / 1000) + 1800; // 30 minutes from now
  const signature = computeSignature(privateKey, token, expire);

  // Return to the browser — these are safe to expose (they expire quickly)
  return res.status(200).json({ token, expire, signature });
};
