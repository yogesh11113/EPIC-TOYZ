/**
 * Vercel Serverless Function: /api/push-subscribe
 *
 * Manages Admin Web Push subscriptions in Supabase `admin_push_subscriptions`.
 * - GET ?type=vapid  -> returns public VAPID key (safe for browser subscription)
 * - POST / DELETE / GET -> strictly requires authenticated Admin JWT (ADMIN_EMAIL)
 */

'use strict';

function getConfig() {
  const supabaseUrl = (process.env.SUPABASE_URL || '').replace(/\/$/, '');
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  const adminEmail = (process.env.ADMIN_EMAIL || 'epictoyz.in@gmail.com').toLowerCase().trim();
  const vapidPublic = process.env.VAPID_PUBLIC_KEY || '';

  if (!supabaseUrl || !serviceKey) {
    throw new Error('Server misconfiguration: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set.');
  }
  return { supabaseUrl, serviceKey, adminEmail, vapidPublic };
}

async function verifyAdminUser(supabaseUrl, serviceKey, adminEmail, authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { ok: false, status: 401, error: 'Missing Authorization Bearer token.' };
  }
  const token = authHeader.slice(7).trim();
  if (!token) {
    return { ok: false, status: 401, error: 'Empty token.' };
  }

  const res = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${token}` }
  });
  if (!res.ok) {
    return { ok: false, status: 401, error: 'Invalid or expired session token.' };
  }
  const user = await res.json();
  const email = String(user?.email || '').toLowerCase().trim();
  if (!email || email !== adminEmail) {
    return { ok: false, status: 403, error: 'Forbidden: Admin access required.' };
  }
  return { ok: true, user };
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const cfg = getConfig();

    // Public VAPID key lookup
    if (req.method === 'GET' && req.query && req.query.type === 'vapid') {
      if (!cfg.vapidPublic) {
        return res.status(500).json({ error: 'VAPID_PUBLIC_KEY is not configured on the server.' });
      }
      return res.status(200).json({ publicKey: cfg.vapidPublic });
    }

    // All other actions require authenticated Admin JWT
    const auth = await verifyAdminUser(cfg.supabaseUrl, cfg.serviceKey, cfg.adminEmail, req.headers.authorization);
    if (!auth.ok) {
      return res.status(auth.status).json({ error: auth.error });
    }

    if (req.method === 'GET') {
      const r = await fetch(`${cfg.supabaseUrl}/rest/v1/admin_push_subscriptions?select=id,endpoint,user_agent,created_at`, {
        headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` }
      });
      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(200).json({ subscriptions: data });
    }

    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});

    if (req.method === 'POST') {
      const sub = body.subscription || body;
      const endpoint = sub?.endpoint;
      const p256dh = sub?.keys?.p256dh;
      const authKey = sub?.keys?.auth;

      if (!endpoint || !p256dh || !authKey) {
        return res.status(400).json({ error: 'Invalid PushSubscription payload.' });
      }

      const r = await fetch(`${cfg.supabaseUrl}/rest/v1/admin_push_subscriptions?on_conflict=endpoint`, {
        method: 'POST',
        headers: {
          apikey: cfg.serviceKey,
          Authorization: `Bearer ${cfg.serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'resolution=merge-duplicates,return=representation'
        },
        body: JSON.stringify([{
          endpoint,
          p256dh,
          auth: authKey,
          user_agent: req.headers['user-agent'] || '',
          updated_at: new Date().toISOString()
        }])
      });

      const data = await r.json();
      if (!r.ok) return res.status(r.status).json(data);
      return res.status(200).json({ subscribed: true });
    }

    if (req.method === 'DELETE') {
      const endpoint = body.endpoint;
      if (!endpoint) return res.status(400).json({ error: 'endpoint is required.' });

      const r = await fetch(
        `${cfg.supabaseUrl}/rest/v1/admin_push_subscriptions?endpoint=eq.${encodeURIComponent(endpoint)}`,
        {
          method: 'DELETE',
          headers: { apikey: cfg.serviceKey, Authorization: `Bearer ${cfg.serviceKey}` }
        }
      );
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        return res.status(r.status).json(err);
      }
      return res.status(200).json({ unsubscribed: true });
    }

    return res.status(405).json({ error: 'Method not allowed.' });
  } catch (err) {
    console.error('[push-subscribe] Error:', err);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
};
