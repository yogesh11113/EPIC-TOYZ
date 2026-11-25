/**
 * Vercel Serverless Function: POST /api/razorpay-create-order
 *
 * Security guarantees:
 * 1. Supports Razorpay Test Mode (rzp_test_*) in local/preview/production and Live Mode (rzp_live_*) ONLY in Vercel Production (VERCEL_ENV === 'production').
 * 2. Never exposes RAZORPAY_KEY_SECRET to frontend.
 * 3. Verifies order ownership (authenticated Supabase user OR guestToken SHA-256 hash).
 * 4. Recalculates authoritative amount from Supabase products.price * order_items.quantity + ₹150 flat shipping.
 */

'use strict';

const crypto = require('crypto');

const DELIVERY_CHARGE_INR = 150;

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
  return { keyId, keySecret, supabaseUrl: supabaseUrl.replace(/\/$/, ''), serviceKey };
}

async function supabaseFetch(supabaseUrl, serviceKey, path) {
  const res = await fetch(`${supabaseUrl}/rest/v1/${path}`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      'Content-Type': 'application/json'
    }
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch {}
  if (!res.ok) {
    throw new Error((data && (data.message || data.error)) || `Supabase request failed (${res.status})`);
  }
  return data;
}

async function getAuthenticatedUser(supabaseUrl, serviceKey, authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token) return null;

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${token}`
    }
  });
  if (!res.ok) return null;
  return await res.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed. Use POST.' });

  try {
    const { keyId, keySecret, supabaseUrl, serviceKey } = getEnvConfig();
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { dbOrderId, guestToken, customerPhone } = body;

    if (!dbOrderId || typeof dbOrderId !== 'string') {
      return res.status(400).json({ error: 'dbOrderId is required.' });
    }

    // 1. Fetch order from Supabase
    const orders = await supabaseFetch(
      supabaseUrl,
      serviceKey,
      `orders?id=eq.${encodeURIComponent(dbOrderId)}&select=id,order_number,user_id,customer_phone,customer_email,subtotal,shipping,total,payment_status,notes`
    );
    const order = Array.isArray(orders) ? orders[0] : null;
    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }
    if (order.payment_status === 'paid') {
      return res.status(409).json({ error: 'Order is already paid.' });
    }

    // 2. Verify order ownership (authenticated user OR guestToken hash)
    const authUser = await getAuthenticatedUser(supabaseUrl, serviceKey, req.headers.authorization);
    if (order.user_id) {
      if (!authUser || String(authUser.id) !== String(order.user_id)) {
        return res.status(403).json({ error: 'Forbidden: Order does not belong to authenticated user.' });
      }
    } else {
      if (!guestToken || typeof guestToken !== 'string') {
        return res.status(403).json({ error: 'Forbidden: Guest verification token is required.' });
      }
      const expectedHash = crypto.createHash('sha256').update(guestToken).digest('hex');
      const notesStr = String(order.notes || '');
      if (!notesStr.includes(`[GUEST_TOKEN:${expectedHash}]`)) {
        return res.status(403).json({ error: 'Forbidden: Invalid guest verification token.' });
      }
      if (customerPhone && String(customerPhone).trim() !== String(order.customer_phone || '').trim()) {
        return res.status(403).json({ error: 'Forbidden: Customer phone mismatch.' });
      }
    }

    // 3. Fetch saved order_items and authoritative product prices from Supabase
    const orderItems = await supabaseFetch(
      supabaseUrl,
      serviceKey,
      `order_items?order_id=eq.${encodeURIComponent(dbOrderId)}&select=product_id,quantity,price`
    );
    if (!Array.isArray(orderItems) || orderItems.length === 0) {
      return res.status(400).json({ error: 'Order has no saved items.' });
    }

    const productIds = [...new Set(orderItems.map(i => i.product_id).filter(Boolean))];
    if (productIds.length === 0) {
      return res.status(400).json({ error: 'Order items are missing valid product IDs.' });
    }

    const products = await supabaseFetch(
      supabaseUrl,
      serviceKey,
      `products?id=in.(${productIds.map(id => encodeURIComponent(id)).join(',')})&select=id,name,price,is_active,specifications`
    );
    const productMap = new Map((products || []).map(p => [String(p.id), p]));

    let authoritativeSubtotal = 0;
    for (const item of orderItems) {
      const qty = Number(item.quantity);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ error: 'Invalid item quantity in order.' });
      }
      const dbProduct = productMap.get(String(item.product_id));
      if (!dbProduct) {
        return res.status(400).json({ error: `Product ${item.product_id} not found in catalog.` });
      }
      if (dbProduct.specifications && dbProduct.specifications._payment_method === 'whatsapp') {
        return res.status(400).json({
          error: `"${dbProduct.name}" is available via WhatsApp Enquiry only and cannot be paid directly.`
        });
      }
      const unitPrice = Number(dbProduct.price);
      if (isNaN(unitPrice) || unitPrice < 0) {
        return res.status(400).json({ error: `Invalid price for product ${dbProduct.name}.` });
      }
      authoritativeSubtotal += unitPrice * qty;
    }

    const authoritativeTotal = authoritativeSubtotal + DELIVERY_CHARGE_INR;
    const expectedAmountPaise = Math.round(authoritativeTotal * 100);
    const orderTotalPaise = Math.round(Number(order.total) * 100);

    if (orderTotalPaise !== expectedAmountPaise) {
      return res.status(400).json({
        error: 'Order total mismatch against authoritative product prices and ₹150 delivery charge.'
      });
    }

    // 4. Create Razorpay Test Mode order
    const authString = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const rzpRes = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        Authorization: `Basic ${authString}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount: expectedAmountPaise,
        currency: 'INR',
        receipt: order.order_number || dbOrderId,
        notes: {
          db_order_id: dbOrderId,
          order_number: order.order_number || '',
          customer_phone: order.customer_phone || ''
        }
      })
    });

    const rzpData = await rzpRes.json();
    if (!rzpRes.ok || !rzpData.id) {
      console.error('[razorpay-create-order] Razorpay API error:', rzpData);
      return res.status(502).json({
        error: (rzpData && rzpData.error && rzpData.error.description) || 'Failed to create Razorpay order.'
      });
    }

    return res.status(200).json({
      order_id: rzpData.id,
      amount: rzpData.amount,
      currency: rzpData.currency || 'INR',
      key_id: keyId,
      razorpayOrderId: rzpData.id,
      keyId
    });
  } catch (err) {
    console.error('[razorpay-create-order] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
