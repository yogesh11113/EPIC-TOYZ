/**
 * Vercel Serverless Function: POST /api/razorpay-verify
 *
 * Security & Reliability guarantees:
 * 1. Verifies HMAC-SHA256 signature with RAZORPAY_KEY_SECRET (timingSafeEqual).
 * 2. Verifies order ownership (authenticated user OR guestToken SHA-256 hash).
 * 3. Fetches Razorpay payment to confirm status === 'captured', order_id match, and amount match.
 * 4. Prevents reusing the same razorpay_payment_id across multiple orders (409 Conflict).
 * 5. Atomically updates Supabase orders (payment_status = 'paid', order_status = 'confirmed') using service_role.
 * 6. Sends Admin Web Push notification with [PUSH_SENT] / [PUSH_PENDING_RETRY] idempotent tracking.
 */

'use strict';

const crypto = require('crypto');
const webpush = require('web-push');

function getEnvConfig() {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  const supabaseUrl = process.env.SUPABASE_URL || '';
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

  if (!keyId || !keySecret) {
    throw new Error('Server misconfiguration: RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is not set.');
  }
  const isTestKey = keyId.startsWith('rzp_test_');
  const isLiveKey = keyId.startsWith('rzp_live_');
  if (!isTestKey && !isLiveKey) {
    throw new Error('Invalid RAZORPAY_KEY_ID format (must start with rzp_test_ or rzp_live_).');
  }
  if (isLiveKey && process.env.VERCEL_ENV !== 'production') {
    throw new Error('Razorpay Live Mode keys (rzp_live_*) are only permitted in Vercel Production.');
  }
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  }
  return {
    keyId,
    keySecret,
    supabaseUrl: supabaseUrl.replace(/\/$/, ''),
    serviceKey,
    vapidPublic: process.env.VAPID_PUBLIC_KEY || '',
    vapidPrivate: process.env.VAPID_PRIVATE_KEY || '',
    vapidSubject: process.env.VAPID_SUBJECT || 'mailto:epictoyz.in@gmail.com'
  };
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

async function getAuthenticatedUser(supabaseUrl, serviceKey, authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) return null;
  return await res.json();
}

function appendNoteMarker(existingNotes, marker) {
  const base = String(existingNotes || '').trim();
  if (base.includes(marker)) return base;
  return base ? `${base} | ${marker}` : marker;
}

async function sendAdminPushNotifications(cfg, order) {
  if (!cfg.vapidPublic || !cfg.vapidPrivate) {
    return { status: 'skipped_no_vapid' };
  }

  webpush.setVapidDetails(cfg.vapidSubject, cfg.vapidPublic, cfg.vapidPrivate);

  let subscriptions = [];
  try {
    subscriptions = await supabaseRest(
      cfg.supabaseUrl,
      cfg.serviceKey,
      'admin_push_subscriptions?select=id,endpoint,p256dh,auth'
    );
  } catch (err) {
    console.warn('[razorpay-verify] Could not fetch admin_push_subscriptions:', err.message);
    return { status: 'retry_needed', error: err.message };
  }

  if (!Array.isArray(subscriptions) || subscriptions.length === 0) {
    return { status: 'sent', delivered: 0 };
  }

  const orderNum = order.order_number || String(order.id).slice(-8).toUpperCase();
  const amountFormatted = Number(order.total || 0).toLocaleString('en-IN');
  const payload = JSON.stringify({
    title: `New Paid Order #${orderNum}`,
    body: `₹${amountFormatted} received via Razorpay (${order.customer_name || 'Customer'})`,
    orderId: order.id,
    tag: `order-${order.id}`,
    url: `/admin/dashboard.html?section=orders&orderId=${encodeURIComponent(order.id)}`
  });

  let delivered = 0;
  let hadTransientFailure = false;

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth }
        },
        payload
      );
      delivered++;
    } catch (pushErr) {
      const code = pushErr.statusCode;
      if (code === 404 || code === 410) {
        // Clean up expired subscription
        await supabaseRest(
          cfg.supabaseUrl,
          cfg.serviceKey,
          `admin_push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`,
          { method: 'DELETE' }
        ).catch(() => {});
      } else {
        hadTransientFailure = true;
        console.warn('[razorpay-verify] Push send error:', pushErr.message);
      }
    }
  }

  if (delivered > 0 || !hadTransientFailure) {
    return { status: 'sent', delivered };
  }
  return { status: 'retry_needed', delivered: 0 };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const cfg = getEnvConfig();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
      dbOrderId,
      guestToken
    } = body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !dbOrderId) {
      return res.status(400).json({ error: 'Missing required payment verification fields.' });
    }

    // 1. Verify HMAC-SHA256 signature
    const expectedSig = crypto
      .createHmac('sha256', cfg.keySecret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    const sigBuf = Buffer.from(String(razorpay_signature), 'utf8');
    const expBuf = Buffer.from(expectedSig, 'utf8');
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(400).json({ error: 'Invalid payment signature.' });
    }

    // 2. Fetch order from Supabase
    const orders = await supabaseRest(
      cfg.supabaseUrl,
      cfg.serviceKey,
      `orders?id=eq.${encodeURIComponent(dbOrderId)}&select=id,order_number,user_id,customer_name,customer_phone,total,payment_status,order_status,notes`
    );
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // 3. Verify order ownership
    const authUser = await getAuthenticatedUser(cfg.supabaseUrl, cfg.serviceKey, req.headers.authorization);
    if (order.user_id) {
      if (!authUser || String(authUser.id) !== String(order.user_id)) {
        return res.status(403).json({ error: 'Forbidden: Order does not belong to authenticated user.' });
      }
    } else {
      if (!guestToken || typeof guestToken !== 'string') {
        return res.status(403).json({ error: 'Forbidden: Guest verification token required.' });
      }
      const expectedHash = crypto.createHash('sha256').update(guestToken).digest('hex');
      if (!String(order.notes || '').includes(`[GUEST_TOKEN:${expectedHash}]`)) {
        return res.status(403).json({ error: 'Forbidden: Invalid guest verification token.' });
      }
    }

    // 4. Prevent same Razorpay payment ID from being applied to another order
    const dupOrders = await supabaseRest(
      cfg.supabaseUrl,
      cfg.serviceKey,
      `orders?notes=ilike.*${encodeURIComponent(razorpay_payment_id)}*&id=neq.${encodeURIComponent(dbOrderId)}&select=id`
    );
    if (Array.isArray(dupOrders) && dupOrders.length > 0) {
      return res.status(409).json({ error: 'This Razorpay payment has already been applied to another order.' });
    }

    // 5. Verify payment capture & amount directly with Razorpay API
    const authString = Buffer.from(`${cfg.keyId}:${cfg.keySecret}`).toString('base64');
    const payRes = await fetch(`https://api.razorpay.com/v1/payments/${encodeURIComponent(razorpay_payment_id)}`, {
      headers: { Authorization: `Basic ${authString}` }
    });
    const payment = await payRes.json();
    if (!payRes.ok || !payment || !payment.id) {
      return res.status(502).json({ error: 'Could not fetch payment details from Razorpay.' });
    }
    if (payment.status !== 'captured') {
      return res.status(400).json({ error: `Payment is not captured (status: ${payment.status}).` });
    }
    if (payment.order_id !== razorpay_order_id) {
      return res.status(400).json({ error: 'Razorpay order ID mismatch.' });
    }

    const expectedAmountPaise = Math.round(Number(order.total) * 100);
    if (Number(payment.amount) !== expectedAmountPaise) {
      return res.status(400).json({ error: 'Captured payment amount does not match order total.' });
    }

    // 6. Atomic update if not already paid
    let updatedNotes = String(order.notes || '');
    if (order.payment_status !== 'paid') {
      updatedNotes = appendNoteMarker(updatedNotes, `Razorpay Payment ID: ${razorpay_payment_id}`);
      updatedNotes = appendNoteMarker(updatedNotes, `Razorpay Order ID: ${razorpay_order_id}`);

      const patched = await supabaseRest(
        cfg.supabaseUrl,
        cfg.serviceKey,
        `orders?id=eq.${encodeURIComponent(dbOrderId)}&payment_status=neq.paid`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: {
            payment_status: 'paid',
            order_status: 'confirmed',
            payment_method: 'razorpay',
            notes: updatedNotes
          }
        }
      );
      if (Array.isArray(patched) && patched[0]) {
        updatedNotes = patched[0].notes || updatedNotes;
      }
    }

    // 7. Send Admin Web Push only if not already marked [PUSH_SENT]
    let pushRetryNeeded = false;
    if (!updatedNotes.includes('[PUSH_SENT]')) {
      const pushResult = await sendAdminPushNotifications(cfg, order);
      if (pushResult.status === 'sent') {
        const cleanNotes = updatedNotes.replace(/\s*\|\s*\[PUSH_PENDING_RETRY\]/g, '').replace(/\[PUSH_PENDING_RETRY\]/g, '').trim();
        updatedNotes = appendNoteMarker(cleanNotes, '[PUSH_SENT]');
      } else if (pushResult.status === 'retry_needed') {
        pushRetryNeeded = true;
        updatedNotes = appendNoteMarker(updatedNotes, '[PUSH_PENDING_RETRY]');
      }
      await supabaseRest(
        cfg.supabaseUrl,
        cfg.serviceKey,
        `orders?id=eq.${encodeURIComponent(dbOrderId)}`,
        { method: 'PATCH', body: { notes: updatedNotes } }
      ).catch(() => {});
    }

    return res.status(200).json({
      verified: true,
      orderId: order.id,
      orderNumber: order.order_number,
      paymentId: razorpay_payment_id,
      total: Number(order.total),
      retryNeeded: { push: pushRetryNeeded }
    });
  } catch (err) {
    console.error('[razorpay-verify] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
