/**
 * Vercel Serverless Function: /api/whatsapp-webhook
 *
 * Handles Meta WhatsApp Business Cloud API:
 * - GET  -> Webhook verification challenge (WHATSAPP_VERIFY_TOKEN)
 * - POST -> Delivery status notifications & failed-message retry marking
 *           Strictly requires META_APP_SECRET and verifies X-Hub-Signature-256
 *           against the exact raw request body bytes.
 */

'use strict';

const crypto = require('crypto');

function verifyMetaSignature(rawBodyBuffer, signatureHeader, appSecret) {
  if (!appSecret || !signatureHeader || !signatureHeader.startsWith('sha256=')) {
    return false;
  }
  const provided = signatureHeader.slice(7).trim();
  const expected = crypto.createHmac('sha256', appSecret).update(rawBodyBuffer).digest('hex');
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

async function markMessageRetryIfFailed(messageId) {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!supabaseUrl || !serviceKey || !messageId) return;

  const res = await fetch(
    `${supabaseUrl}/rest/v1/orders?notes=ilike.*${encodeURIComponent(`[WA_MSG_ID:${messageId}]`)}*&select=id,notes`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` } }
  );
  if (!res.ok) return;
  const rows = await res.json().catch(() => []);
  const order = Array.isArray(rows) ? rows[0] : null;
  if (!order) return;

  let notes = String(order.notes || '');
  if (!notes.includes('[WA_PENDING_RETRY]')) {
    notes = notes.replace(/\s*\|\s*\[WA_SENT\]/g, '').replace(/\[WA_SENT\]/g, '').trim();
    notes = notes ? `${notes} | [WA_PENDING_RETRY]` : '[WA_PENDING_RETRY]';
    await fetch(`${supabaseUrl}/rest/v1/orders?id=eq.${encodeURIComponent(order.id)}`, {
      method: 'PATCH',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ whatsapp_sent: false, notes })
    });
  }
}

async function handler(req, res) {
  if (req.method === 'GET') {
    const mode = req.query && req.query['hub.mode'];
    const token = req.query && req.query['hub.verify_token'];
    const challenge = req.query && req.query['hub.challenge'];
    const expectedToken = process.env.WHATSAPP_VERIFY_TOKEN || '';

    if (mode === 'subscribe' && expectedToken && token) {
      const tBuf = Buffer.from(String(token), 'utf8');
      const eBuf = Buffer.from(String(expectedToken), 'utf8');
      if (tBuf.length === eBuf.length && crypto.timingSafeEqual(tBuf, eBuf)) {
        res.statusCode = 200;
        res.setHeader('Content-Type', 'text/plain; charset=utf-8');
        return res.end(String(challenge || ''));
      }
    }
    return res.status(403).json({ error: 'Webhook verification failed.' });
  }

  if (req.method === 'POST') {
    const appSecret = process.env.META_APP_SECRET || '';
    if (!appSecret) {
      return res.status(500).json({ error: 'Server misconfiguration: META_APP_SECRET is required.' });
    }

    const rawBodyBuffer = await readRawBody(req);
    const sigHeader = req.headers['x-hub-signature-256'] || '';

    if (!verifyMetaSignature(rawBodyBuffer, sigHeader, appSecret)) {
      return res.status(401).json({ error: 'Invalid or missing Meta webhook signature.' });
    }

    try {
      const payload = JSON.parse(rawBodyBuffer.toString('utf8') || '{}');
      const entries = Array.isArray(payload.entry) ? payload.entry : [];
      for (const entry of entries) {
        const changes = Array.isArray(entry.changes) ? entry.changes : [];
        for (const change of changes) {
          const statuses = change?.value?.statuses;
          if (!Array.isArray(statuses)) continue;
          for (const st of statuses) {
            if (st.status === 'failed' && st.id) {
              await markMessageRetryIfFailed(st.id);
            }
          }
        }
      }
    } catch (err) {
      console.warn('[whatsapp-webhook] Non-fatal parse error:', err.message);
    }

    return res.status(200).json({ received: true });
  }

  return res.status(405).json({ error: 'Method not allowed.' });
}

handler.config = {
  api: {
    bodyParser: false
  }
};

module.exports = handler;
