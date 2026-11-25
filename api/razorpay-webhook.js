/**
 * Vercel Serverless Function: POST /api/razorpay-webhook
 *
 * Security & Reliability guarantees:
 * 1. Verifies X-Razorpay-Signature (HMAC-SHA256) against the exact raw request body
 *    using RAZORPAY_WEBHOOK_SECRET (timingSafeEqual). Never bypasses if secret is missing.
 * 2. Handles payment.captured, payment.failed, and order.paid events.
 * 3. Resolves the existing Supabase order via Razorpay order ID (or db_order_id / receipt fallback)
 *    without ever creating duplicate orders or modifying order totals.
 * 4. Never marks an order paid unless payment.status === 'captured' and amount matches order.total.
 * 5. Deduplicates webhook deliveries & retries using Razorpay event IDs ([RZP_EVT:<id>] in orders.notes).
 * 6. Respects [PUSH_SENT] and whatsapp_sent / [WA_SENT] / [WA_OPT_IN] so neither admin push
 *    nor customer WhatsApp confirmations are ever duplicated across checkout verify & webhooks.
 */

'use strict';

const crypto = require('crypto');
const { sendOrderConfirmationWhatsApp } = require('../lib/whatsapp.js');

function verifyRazorpayWebhookSignature(rawBodyBuffer, signatureHeader, webhookSecret) {
  if (!webhookSecret || !signatureHeader || typeof signatureHeader !== 'string') {
    return false;
  }
  const provided = signatureHeader.trim();
  const expected = crypto
    .createHmac('sha256', webhookSecret)
    .update(rawBodyBuffer)
    .digest('hex');
  const pBuf = Buffer.from(provided, 'utf8');
  const eBuf = Buffer.from(expected, 'utf8');
  return pBuf.length === eBuf.length && crypto.timingSafeEqual(pBuf, eBuf);
}

async function readRawBody(req) {
  if (Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === 'string') return Buffer.from(req.body, 'utf8');
  if (req.rawBody && Buffer.isBuffer(req.rawBody)) return req.rawBody;
  if (typeof req.on === 'function') {
    const chunks = [];
    for await (const chunk of req) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    if (chunks.length > 0) return Buffer.concat(chunks);
  }
  if (req.body && typeof req.body === 'object') {
    return Buffer.from(JSON.stringify(req.body), 'utf8');
  }
  return Buffer.alloc(0);
}

function appendNoteMarker(existingNotes, marker) {
  const base = String(existingNotes || '').trim();
  if (!marker || base.includes(marker)) return base;
  return base ? `${base} | ${marker}` : marker;
}

function removeNoteMarkerPattern(existingNotes, regex) {
  return String(existingNotes || '')
    .replace(regex, '')
    .replace(/\s*\|\s*\|\s*/g, ' | ')
    .replace(/^\s*\|\s*|\s*\|\s*$/g, '')
    .trim();
}

const LEASE_TTL_MS = 60000;

function extractSendingLease(notes, prefix) {
  const re = new RegExp(`\\[${prefix}_SENDING:(\\d+)\\]`);
  const match = String(notes || '').match(re);
  if (!match) return null;
  const ts = Number(match[1]);
  return {
    tag: match[0],
    ts,
    expired: !Number.isFinite(ts) || (Date.now() - ts) >= LEASE_TTL_MS
  };
}

async function acquireNotificationLease(supabaseUrl, serviceKey, orderId, currentNotes, prefix, extraGuard = '') {
  const lease = extractSendingLease(currentNotes, prefix);
  if (lease && !lease.expired) {
    return { acquired: false, reason: 'in_flight', notes: currentNotes };
  }

  const stripSendingRe = new RegExp(`\\[${prefix}_SENDING:\\d+\\]`, 'g');
  const stripRetryRe = new RegExp(`\\[${prefix}_PENDING_RETRY\\]`, 'g');
  let nextNotes = removeNoteMarkerPattern(currentNotes, stripSendingRe);
  nextNotes = removeNoteMarkerPattern(nextNotes, stripRetryRe);
  nextNotes = appendNoteMarker(nextNotes, `[${prefix}_SENDING:${Date.now()}]`);

  const guard = lease
    ? `notes=ilike.*${encodeURIComponent(lease.tag)}*`
    : `notes=not.ilike.*${encodeURIComponent(`[${prefix}_SENDING:`)}*`;

  const path = `orders?id=eq.${encodeURIComponent(orderId)}${extraGuard}&${guard}`;
  const patched = await supabaseRest(supabaseUrl, serviceKey, path, {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: { notes: nextNotes }
  });

  if (!Array.isArray(patched) || patched.length === 0) {
    return { acquired: false, reason: 'lost_race', notes: currentNotes };
  }
  return { acquired: true, notes: patched[0].notes || nextNotes };
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
  try { data = text ? JSON.parse(text) : null; } catch { }
  if (!res.ok) {
    throw new Error((data && (data.message || data.error)) || `Supabase error (${res.status})`);
  }
  return data;
}

const ORDER_SELECT = 'id,order_number,user_id,customer_name,customer_phone,address_line1,address_line2,city,state,pincode,total,payment_status,order_status,whatsapp_sent,notes';

async function findOrderForWebhook(supabaseUrl, serviceKey, { razorpayOrderId, dbOrderId, receipt }) {
  if (razorpayOrderId) {
    const byRzpOrder = await supabaseRest(
      supabaseUrl,
      serviceKey,
      `orders?notes=ilike.*${encodeURIComponent(`Razorpay Order ID: ${razorpayOrderId}`)}*&select=${ORDER_SELECT}`
    );
    if (Array.isArray(byRzpOrder) && byRzpOrder[0]) {
      return byRzpOrder[0];
    }
  }

  if (dbOrderId) {
    const byId = await supabaseRest(
      supabaseUrl,
      serviceKey,
      `orders?id=eq.${encodeURIComponent(dbOrderId)}&select=${ORDER_SELECT}`
    );
    if (Array.isArray(byId) && byId[0]) {
      return byId[0];
    }
  }

  if (receipt) {
    const byOrderNum = await supabaseRest(
      supabaseUrl,
      serviceKey,
      `orders?order_number=eq.${encodeURIComponent(receipt)}&select=${ORDER_SELECT}`
    );
    if (Array.isArray(byOrderNum) && byOrderNum[0]) {
      return byOrderNum[0];
    }
  }

  return null;
}

async function fetchRazorpayOrderNotes(razorpayOrderId) {
  const keyId = process.env.RAZORPAY_KEY_ID || '';
  const keySecret = process.env.RAZORPAY_KEY_SECRET || '';
  if (!keyId || !keySecret || !razorpayOrderId) return {};
  try {
    const authString = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const res = await fetch(`https://api.razorpay.com/v1/orders/${encodeURIComponent(razorpayOrderId)}`, {
      headers: { Authorization: `Basic ${authString}` }
    });
    if (!res.ok) return {};
    const data = await res.json().catch(() => ({}));
    return {
      dbOrderId: data?.notes?.db_order_id || '',
      receipt: data?.receipt || ''
    };
  } catch {
    return {};
  }
}

async function sendAdminPushNotifications(supabaseUrl, serviceKey, order) {
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || '';
  const vapidPrivate = process.env.VAPID_PRIVATE_KEY || '';
  const vapidSubject = process.env.VAPID_SUBJECT || 'mailto:epictoyz.in@gmail.com';
  if (!vapidPublic || !vapidPrivate) {
    return { status: 'skipped_no_vapid' };
  }

  let webpush;
  try {
    const webpushMod = await import('web-push');
    webpush = webpushMod.default || webpushMod;
    webpush.setVapidDetails(vapidSubject, vapidPublic, vapidPrivate);
  } catch (importErr) {
    console.warn('[razorpay-webhook] Failed to load web-push:', importErr.message);
    return { status: 'retry_needed', error: importErr.message };
  }

  let subscriptions = [];
  try {
    subscriptions = await supabaseRest(
      supabaseUrl,
      serviceKey,
      'admin_push_subscriptions?select=id,endpoint,p256dh,auth'
    );
  } catch (err) {
    console.warn('[razorpay-webhook] Could not fetch admin_push_subscriptions:', err.message);
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
        await supabaseRest(
          supabaseUrl,
          serviceKey,
          `admin_push_subscriptions?id=eq.${encodeURIComponent(sub.id)}`,
          { method: 'DELETE' }
        ).catch(() => { });
      } else {
        hadTransientFailure = true;
        console.warn('[razorpay-webhook] Push send error:', pushErr.message);
      }
    }
  }

  if (delivered > 0 || !hadTransientFailure) {
    return { status: 'sent', delivered };
  }
  return { status: 'retry_needed', delivered: 0 };
}

async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed. Use POST.' });
  }

  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || '';
  if (!webhookSecret) {
    return res.status(500).json({ error: 'Server misconfiguration: RAZORPAY_WEBHOOK_SECRET is required.' });
  }

  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({ error: 'Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is required.' });
  }

  const rawBodyBuffer = await readRawBody(req);
  const sigHeader = req.headers['x-razorpay-signature'] || '';
  if (!verifyRazorpayWebhookSignature(rawBodyBuffer, sigHeader, webhookSecret)) {
    return res.status(401).json({ error: 'Invalid or missing Razorpay webhook signature.' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBodyBuffer.toString('utf8') || '{}');
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload.' });
  }

  const event = String(payload.event || '');
  const supportedEvents = new Set(['payment.captured', 'payment.failed', 'order.paid']);
  if (!supportedEvents.has(event)) {
    return res.status(200).json({ received: true, ignored: true, event });
  }

  const paymentEntity = payload?.payload?.payment?.entity || null;
  const orderEntity = payload?.payload?.order?.entity || null;
  const razorpayOrderId = paymentEntity?.order_id || orderEntity?.id || '';
  const razorpayPaymentId = paymentEntity?.id || '';

  if (!razorpayOrderId) {
    return res.status(400).json({ error: 'Missing Razorpay order ID in webhook payload.' });
  }

  const headerEventId = String(req.headers['x-razorpay-event-id'] || '').trim();
  const eventId = headerEventId || String(payload.id || '').trim() || `${event}:${razorpayPaymentId || razorpayOrderId}`;
  const eventMarker = `[RZP_EVT:${eventId}]`;

  try {
    let dbOrderId = paymentEntity?.notes?.db_order_id || orderEntity?.notes?.db_order_id || '';
    let receipt = orderEntity?.receipt || '';

    let order = await findOrderForWebhook(supabaseUrl, serviceKey, {
      razorpayOrderId,
      dbOrderId,
      receipt
    });

    if (!order && !dbOrderId) {
      const remoteOrderInfo = await fetchRazorpayOrderNotes(razorpayOrderId);
      if (remoteOrderInfo.dbOrderId || remoteOrderInfo.receipt) {
        order = await findOrderForWebhook(supabaseUrl, serviceKey, {
          razorpayOrderId,
          dbOrderId: remoteOrderInfo.dbOrderId,
          receipt: remoteOrderInfo.receipt
        });
      }
    }

    if (!order) {
      return res.status(200).json({ received: true, status: 'order_not_found', razorpayOrderId });
    }

    let updatedNotes = String(order.notes || '');

    // Duplicate-event protection using persisted Razorpay event ID
    if (updatedNotes.includes(eventMarker)) {
      return res.status(200).json({ received: true, duplicate: true, eventId, orderId: order.id });
    }

    if (event === 'payment.failed') {
      if (order.payment_status === 'paid') {
        updatedNotes = appendNoteMarker(updatedNotes, eventMarker);
        await supabaseRest(
          supabaseUrl,
          serviceKey,
          `orders?id=eq.${encodeURIComponent(order.id)}`,
          { method: 'PATCH', body: { notes: updatedNotes } }
        );
        return res.status(200).json({ received: true, status: 'already_paid_ignored_failure', orderId: order.id });
      }

      updatedNotes = appendNoteMarker(updatedNotes, `Razorpay Order ID: ${razorpayOrderId}`);
      if (razorpayPaymentId) {
        updatedNotes = appendNoteMarker(updatedNotes, `Razorpay Failed Payment ID: ${razorpayPaymentId}`);
      }
      updatedNotes = appendNoteMarker(updatedNotes, eventMarker);

      await supabaseRest(
        supabaseUrl,
        serviceKey,
        `orders?id=eq.${encodeURIComponent(order.id)}&payment_status=neq.paid`,
        {
          method: 'PATCH',
          body: {
            payment_status: 'failed',
            notes: updatedNotes
          }
        }
      );

      return res.status(200).json({ received: true, status: 'payment_failed_recorded', orderId: order.id });
    }

    // payment.captured or order.paid
    if (!paymentEntity || paymentEntity.status !== 'captured') {
      return res.status(200).json({
        received: true,
        status: 'ignored_not_captured',
        paymentStatus: paymentEntity?.status || null,
        orderId: order.id
      });
    }

    if (paymentEntity.order_id && paymentEntity.order_id !== razorpayOrderId) {
      return res.status(400).json({ error: 'Razorpay order ID mismatch.' });
    }

    const expectedAmountPaise = Math.round(Number(order.total) * 100);
    if (Number(paymentEntity.amount) !== expectedAmountPaise) {
      return res.status(400).json({ error: 'Captured payment amount does not match order total.' });
    }

    // Prevent same Razorpay payment ID from being applied to another order
    if (razorpayPaymentId) {
      const dupOrders = await supabaseRest(
        supabaseUrl,
        serviceKey,
        `orders?notes=ilike.*${encodeURIComponent(razorpayPaymentId)}*&id=neq.${encodeURIComponent(order.id)}&select=id`
      );
      if (Array.isArray(dupOrders) && dupOrders.length > 0) {
        return res.status(409).json({ error: 'This Razorpay payment has already been applied to another order.' });
      }
    }

    if (razorpayPaymentId) {
      updatedNotes = appendNoteMarker(updatedNotes, `Razorpay Payment ID: ${razorpayPaymentId}`);
    }
    updatedNotes = appendNoteMarker(updatedNotes, `Razorpay Order ID: ${razorpayOrderId}`);
    updatedNotes = appendNoteMarker(updatedNotes, eventMarker);

    if (order.payment_status !== 'paid') {
      const patched = await supabaseRest(
        supabaseUrl,
        serviceKey,
        `orders?id=eq.${encodeURIComponent(order.id)}&payment_status=neq.paid`,
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
      if (!Array.isArray(patched) || patched.length === 0) {
        // Another concurrent request (checkout verify or parallel webhook) just transitioned this order to paid.
        return res.status(200).json({
          received: true,
          status: 'concurrent_already_paid',
          event,
          eventId,
          orderId: order.id
        });
      }
      updatedNotes = patched[0].notes || updatedNotes;
      order = patched[0];
    } else {
      const patchedExisting = await supabaseRest(
        supabaseUrl,
        serviceKey,
        `orders?id=eq.${encodeURIComponent(order.id)}`,
        {
          method: 'PATCH',
          headers: { Prefer: 'return=representation' },
          body: { notes: updatedNotes }
        }
      );
      if (Array.isArray(patchedExisting) && patchedExisting[0]) {
        updatedNotes = patchedExisting[0].notes || updatedNotes;
        order = patchedExisting[0];
      }
    }

    // Admin Web Push: crash-safe lease lock [PUSH_SENDING:<ts>] before sending, then [PUSH_SENT] only after success
    if (!updatedNotes.includes('[PUSH_SENT]')) {
      try {
        const pushLease = await acquireNotificationLease(
          supabaseUrl,
          serviceKey,
          order.id,
          updatedNotes,
          'PUSH',
          `&notes=not.ilike.*${encodeURIComponent('[PUSH_SENT]')}*`
        );
        if (pushLease.acquired) {
          updatedNotes = pushLease.notes;
          try {
            const pushResult = await sendAdminPushNotifications(supabaseUrl, serviceKey, order);
            let finalNotes = removeNoteMarkerPattern(updatedNotes, /\[PUSH_SENDING:\d+\]/g);
            if (pushResult.status === 'sent') {
              finalNotes = appendNoteMarker(finalNotes, '[PUSH_SENT]');
            } else if (pushResult.status === 'retry_needed') {
              finalNotes = appendNoteMarker(finalNotes, '[PUSH_PENDING_RETRY]');
            }
            updatedNotes = finalNotes;
            await supabaseRest(
              supabaseUrl,
              serviceKey,
              `orders?id=eq.${encodeURIComponent(order.id)}`,
              { method: 'PATCH', body: { notes: updatedNotes } }
            ).catch(() => { });
          } catch (sendErr) {
            let rollbackNotes = removeNoteMarkerPattern(updatedNotes, /\[PUSH_SENDING:\d+\]/g);
            rollbackNotes = appendNoteMarker(rollbackNotes, '[PUSH_PENDING_RETRY]');
            updatedNotes = rollbackNotes;
            await supabaseRest(
              supabaseUrl,
              serviceKey,
              `orders?id=eq.${encodeURIComponent(order.id)}`,
              { method: 'PATCH', body: { notes: updatedNotes } }
            ).catch(() => { });
            throw sendErr;
          }
        }
      } catch (pushErr) {
        console.warn('[razorpay-webhook] Push notification error (non-fatal):', pushErr.message);
      }
    }

    // Customer WhatsApp Confirmation: crash-safe lease lock [WA_SENDING:<ts>] before sending; whatsapp_sent=true ONLY after send succeeds
    const hasWhatsAppOptIn = updatedNotes.includes('[WA_OPT_IN]');
    if (hasWhatsAppOptIn && !order.whatsapp_sent && !updatedNotes.includes('[WA_SENT]')) {
      try {
        const waLease = await acquireNotificationLease(
          supabaseUrl,
          serviceKey,
          order.id,
          updatedNotes,
          'WA',
          `&whatsapp_sent=is.false&notes=not.ilike.*${encodeURIComponent('[WA_SENT]')}*`
        );

        if (waLease.acquired) {
          updatedNotes = waLease.notes;
          try {
            const orderItems = await supabaseRest(
              supabaseUrl,
              serviceKey,
              `order_items?order_id=eq.${encodeURIComponent(order.id)}&select=product_name,quantity,price`
            ).catch(() => []);

            const waResult = await sendOrderConfirmationWhatsApp({ order, items: orderItems });
            let finalNotes = removeNoteMarkerPattern(updatedNotes, /\[WA_SENDING:\d+\]/g);
            if (waResult.status === 'sent') {
              finalNotes = appendNoteMarker(finalNotes, '[WA_SENT]');
              if (waResult.messageId) {
                finalNotes = appendNoteMarker(finalNotes, `[WA_MSG_ID:${waResult.messageId}]`);
              }
              updatedNotes = finalNotes;
              await supabaseRest(
                supabaseUrl,
                serviceKey,
                `orders?id=eq.${encodeURIComponent(order.id)}`,
                { method: 'PATCH', body: { whatsapp_sent: true, notes: updatedNotes } }
              ).catch(() => { });
            } else {
              if (waResult.status === 'retry_needed') {
                finalNotes = appendNoteMarker(finalNotes, '[WA_PENDING_RETRY]');
              }
              updatedNotes = finalNotes;
              await supabaseRest(
                supabaseUrl,
                serviceKey,
                `orders?id=eq.${encodeURIComponent(order.id)}`,
                { method: 'PATCH', body: { notes: updatedNotes } }
              ).catch(() => { });
            }
          } catch (sendErr) {
            let rollbackNotes = removeNoteMarkerPattern(updatedNotes, /\[WA_SENDING:\d+\]/g);
            rollbackNotes = appendNoteMarker(rollbackNotes, '[WA_PENDING_RETRY]');
            updatedNotes = rollbackNotes;
            await supabaseRest(
              supabaseUrl,
              serviceKey,
              `orders?id=eq.${encodeURIComponent(order.id)}`,
              { method: 'PATCH', body: { notes: updatedNotes } }
            ).catch(() => { });
            throw sendErr;
          }
        }
      } catch (waErr) {
        console.warn('[razorpay-webhook] WhatsApp confirmation error (non-fatal):', waErr.message);
      }
    }

    return res.status(200).json({
      received: true,
      status: 'processed',
      event,
      eventId,
      orderId: order.id
    });
  } catch (err) {
    console.error('[razorpay-webhook] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

handler.config = {
  api: {
    bodyParser: false
  }
};

module.exports = handler;
