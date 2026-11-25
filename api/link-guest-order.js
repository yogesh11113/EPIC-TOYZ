/**
 * Vercel Serverless Function: POST /api/link-guest-order
 *
 * Securely links a verified guest order to an authenticated Google/Supabase user.
 * Security rules:
 * 1. Requires valid Supabase Bearer access_token.
 * 2. Requires a verified email on the authenticated Supabase user.
 * 3. Never overwrites an order already owned by a different user_id.
 * 4. If verified Google email matches order.customer_email, allows linking.
 * 5. If emails differ (or checkout email is empty), strictly requires a valid
 *    guestToken matching [GUEST_TOKEN:<sha256>] in orders.notes.
 * 6. Updates ONLY user_id — never alters payment_status, order_status, or total.
 */

'use strict';

const crypto = require('crypto');

function getConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  }
  return { supabaseUrl, serviceKey };
}

async function supabaseRest(supabaseUrl, serviceKey, path, options = {}) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    method: options.method || 'GET',
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    throw new Error((data && (data.message || data.error)) || `Supabase error (${res.status})`);
  }
  return data;
}

function isEmailVerified(user) {
  if (!user || !user.email) return false;
  if (user.email_confirmed_at) return true;
  if (user.user_metadata && user.user_metadata.email_verified === true) return true;
  if (Array.isArray(user.identities)) {
    return user.identities.some(id => id.identity_data && id.identity_data.email_verified === true);
  }
  return false;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const { supabaseUrl, serviceKey } = getConfig();
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    const token = authHeader.slice(7).trim();
    if (!token) {
      return res.status(401).json({ error: 'Empty access token.' });
    }

    const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
    });
    if (!userRes.ok) {
      return res.status(401).json({ error: 'Invalid or expired session.' });
    }
    const authUser = await userRes.json();

    if (!isEmailVerified(authUser)) {
      return res.status(403).json({ error: 'A verified email address is required to link orders.' });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { orderId, guestToken } = body;
    if (!orderId || typeof orderId !== 'string') {
      return res.status(400).json({ error: 'orderId is required.' });
    }

    const orders = await supabaseRest(
      supabaseUrl,
      serviceKey,
      `orders?id=eq.${encodeURIComponent(orderId)}&select=id,order_number,user_id,customer_email,notes`
    );
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.user_id) {
      if (String(order.user_id) === String(authUser.id)) {
        return res.status(200).json({ linked: true, alreadyLinked: true, orderId: order.id });
      }
      return res.status(403).json({ error: 'Forbidden: This order is already linked to another account.' });
    }

    const verifiedEmail = String(authUser.email || '').trim().toLowerCase();
    const checkoutEmail = String(order.customer_email || '').trim().toLowerCase();
    const emailsMatch = Boolean(checkoutEmail && verifiedEmail === checkoutEmail);

    let guestTokenValid = false;
    if (guestToken && typeof guestToken === 'string') {
      const expectedHash = crypto.createHash('sha256').update(guestToken).digest('hex');
      guestTokenValid = String(order.notes || '').includes(`[GUEST_TOKEN:${expectedHash}]`);
    }

    // If emails match, allow linking; if emails differ (or no checkout email), require valid guestToken
    if (!emailsMatch && !guestTokenValid) {
      return res.status(403).json({
        error: 'Google account email does not match checkout email, and guest ownership token could not be verified.'
      });
    }

    // Atomic conditional update: only link if still unowned (user_id IS NULL), never change payment_status
    await supabaseRest(
      supabaseUrl,
      serviceKey,
      `orders?id=eq.${encodeURIComponent(orderId)}&user_id=is.null`,
      {
        method: 'PATCH',
        body: { user_id: authUser.id }
      }
    );

    return res.status(200).json({
      linked: true,
      orderId: order.id,
      orderNumber: order.order_number
    });
  } catch (err) {
    console.error('[link-guest-order] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
