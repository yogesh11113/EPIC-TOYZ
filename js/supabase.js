/**
 * Epic Toyz — Supabase Client Configuration
 * Replace SUPABASE_URL and SUPABASE_ANON_KEY with your real values
 * from the Supabase dashboard: https://supabase.com/dashboard
 */

'use strict';

/** @type {{ url: string, anonKey: string }} */
const SUPABASE_CONFIG = {
  url: window.process?.env?.SUPABASE_URL || window.ENV?.SUPABASE_URL || 'https://wzqaawfqcjxztiyfsmof.supabase.co',
  anonKey: window.process?.env?.SUPABASE_ANON_KEY || window.ENV?.SUPABASE_ANON_KEY || 'sb_publishable_bu2DUkhTlL2dLtQFLxnogw_nS0Dj8B9'
};

/**
 * Returns true when the Supabase credentials have been filled in.
 * @returns {boolean}
 */
function isSupabaseConfigured() {
  return (
    SUPABASE_CONFIG.url !== 'YOUR_SUPABASE_URL' &&
    SUPABASE_CONFIG.url.startsWith('https://') &&
    SUPABASE_CONFIG.anonKey !== 'YOUR_SUPABASE_ANON_KEY' &&
    SUPABASE_CONFIG.anonKey.length > 20
  );
}

/**
 * Creates and returns a Supabase client if credentials are configured.
 * Falls back gracefully when the supabase JS library is not present
 * or credentials are placeholder values.
 * @returns {import('@supabase/supabase-js').SupabaseClient | null}
 */
function getSupabaseClient() {
  if (!isSupabaseConfigured()) {
    console.info('[EpicToyz] Supabase not configured — using localStorage fallback.');
    return null;
  }

  if (typeof window === 'undefined' || !window.supabase) {
    console.warn('[EpicToyz] Supabase JS library not loaded.');
    return null;
  }

  try {
    const client = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
          storage: window.localStorage
        },
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      }
    );
    console.info('[EpicToyz] Supabase client initialised successfully.');
    return client;
  } catch (err) {
    console.error('[EpicToyz] Failed to create Supabase client:', err);
    return null;
  }
}

/** Shared Supabase client instance (null when not configured). */
const _supabase = getSupabaseClient();

// ─── Expose to global scope ──────────────────────────────────────────────────
window.EpicSupabase       = _supabase;
window.isSupabaseConfigured = isSupabaseConfigured;
window.SUPABASE_CONFIG    = SUPABASE_CONFIG;

/**
 * Convenience helper: returns true when a Supabase error indicates the row
 * was not found (PostgREST returns status 406 / code PGRST116).
 * @param {object} error
 * @returns {boolean}
 */
window.isNotFoundError = function isNotFoundError(error) {
  if (!error) return false;
  return error.code === 'PGRST116' || error.status === 406 || error.message?.includes('No rows');
};

/**
 * Thin wrapper that throws a descriptive error when a Supabase query fails.
 * @param {{ data: any, error: object | null }} result
 * @returns {any} data
 */
window.unwrap = function unwrap({ data, error }) {
  if (error) throw new Error(error.message || JSON.stringify(error));
  return data;
};
