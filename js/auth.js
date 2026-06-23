/**
 * Epic Toyz — Authentication Module
 * Handles admin & customer login, registration, session management.
 * Uses Supabase Auth when configured; falls back to localStorage sessions.
 */

'use strict';

const Auth = {

  /* ─── constants ─────────────────────────────────────────────────────── */
  ADMIN_EMAIL:    'epictoyz.in@gmail.com',
  ADMIN_PASSWORD: 'yogesh123*',
  SESSION_KEY:    'et_session',
  USER_KEY:       'et_user',

  /* ─── path helper ───────────────────────────────────────────────────── */
  _getPath(target) {
    const pathname = window.location.pathname;
    const isSub = pathname.includes('/admin/') || pathname.includes('/pages/');
    const prefix = isSub ? '../' : '';
    
    if (target === 'home') {
      return prefix + 'index.html';
    }
    if (target === 'admin-dashboard') {
      return pathname.includes('/admin/') ? 'dashboard.html' : prefix + 'admin/dashboard.html';
    }
    if (target === 'admin-login') {
      return pathname.includes('/admin/') ? 'login.html' : prefix + 'admin/login.html';
    }
    if (target === 'checkout-login') {
      return prefix + 'checkout.html?login=true';
    }
    // Remove leading slash if any
    let cleanTarget = target.startsWith('/') ? target.substring(1) : target;
    return prefix + cleanTarget;
  },

  /* ══════════════════════════════════════════════════════════
     LOGIN
     ══════════════════════════════════════════════════════════ */

  /**
   * Log in a user with email and password.
   * Tries Supabase first; falls back to admin credential check in localStorage.
   * @param {string} email
   * @param {string} password
   * @returns {Promise<{ user: object, error: string|null }>}
   */
  async login(email, password) {
    // ── Supabase path ──────────────────────────────────────────────────
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase.auth.signInWithPassword({
          email: email.trim().toLowerCase(),
          password,
        });
        if (error) throw error;
        const user = this._normaliseUser(data.user);
        this._storeSession(user, data.session?.access_token);
        this.updateNavbarAuth();
        return { user, error: null };
      } catch (err) {
        return { user: null, error: err.message || 'Login failed. Please check your credentials.' };
      }
    }

    // ── localStorage / admin fallback ──────────────────────────────────
    const normalEmail = email.trim().toLowerCase();

    if (
      normalEmail === this.ADMIN_EMAIL.toLowerCase() &&
      password    === this.ADMIN_PASSWORD
    ) {
      const user = {
        id:        'admin-001',
        email:     this.ADMIN_EMAIL,
        name:      'Admin',
        role:      'admin',
        createdAt: new Date().toISOString(),
      };
      this._storeSession(user, 'local-admin-token');
      this.updateNavbarAuth();
      return { user, error: null };
    }

    // Check registered users stored locally
    const users = JSON.parse(localStorage.getItem('et_users') || '[]');
    const found = users.find(u => u.email.toLowerCase() === normalEmail && u.password === password);
    if (found) {
      const { password: _pw, ...safeUser } = found; // never expose password
      this._storeSession(safeUser, `local-token-${safeUser.id}`);
      this.updateNavbarAuth();
      return { user: safeUser, error: null };
    }

    return { user: null, error: 'Invalid email or password.' };
  },

  /* ══════════════════════════════════════════════════════════
     LOGOUT
     ══════════════════════════════════════════════════════════ */

  /**
   * Log out the current user, clear all session data, redirect to home.
   * @returns {Promise<void>}
   */
  async logout() {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        await window.EpicSupabase.auth.signOut();
      } catch (err) {
        console.warn('[Auth] Supabase signOut error:', err.message);
      }
    }
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.updateNavbarAuth();
    window.location.href = this._getPath('home');
  },

  /* ══════════════════════════════════════════════════════════
     REGISTER
     ══════════════════════════════════════════════════════════ */

  /**
   * Register a new customer account.
   * @param {string} email
   * @param {string} password
   * @param {object} userData - { name, phone }
   * @returns {Promise<{ user: object|null, error: string|null }>}
   */
  async register(email, password, userData = {}) {
    const normalEmail = email.trim().toLowerCase();

    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase.auth.signUp({
          email:    normalEmail,
          password,
          options: {
            data: {
              name:  userData.name  || '',
              phone: userData.phone || '',
            },
          },
        });
        if (error) throw error;
        const user = this._normaliseUser(data.user);
        this._storeSession(user, data.session?.access_token);
        this.updateNavbarAuth();
        return { user, error: null };
      } catch (err) {
        return { user: null, error: err.message || 'Registration failed.' };
      }
    }

    // localStorage fallback
    const users = JSON.parse(localStorage.getItem('et_users') || '[]');
    if (users.find(u => u.email.toLowerCase() === normalEmail)) {
      return { user: null, error: 'An account with this email already exists.' };
    }

    const newUser = {
      id:        `user-${Date.now()}`,
      email:     normalEmail,
      name:      userData.name  || '',
      phone:     userData.phone || '',
      role:      'customer',
      password,  // NOTE: plain-text — acceptable only in localStorage dev mode
      createdAt: new Date().toISOString(),
    };
    users.push(newUser);
    localStorage.setItem('et_users', JSON.stringify(users));

    const { password: _pw, ...safeUser } = newUser;
    this._storeSession(safeUser, `local-token-${safeUser.id}`);
    this.updateNavbarAuth();
    return { user: safeUser, error: null };
  },

  /* ══════════════════════════════════════════════════════════
     SESSION HELPERS
     ══════════════════════════════════════════════════════════ */

  /**
   * Get the currently authenticated user object, or null.
   * @returns {object|null}
   */
  getCurrentUser() {
    // Try Supabase session first
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        // For synchronous access we rely on the cached localStorage copy
        // (Supabase persists its session there automatically).
        const raw = localStorage.getItem('sb-' + (window.SUPABASE_CONFIG?.url?.split('//')[1]?.split('.')[0]) + '-auth-token');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.user) return this._normaliseUser(parsed.user);
        }
      } catch { /* fall through */ }
    }

    // Local session fallback
    try {
      const session = JSON.parse(localStorage.getItem(this.SESSION_KEY));
      if (session && session.user) return session.user;
    } catch { /* fall through */ }

    return null;
  },

  /**
   * Returns true when a user is logged in.
   * @returns {boolean}
   */
  isLoggedIn() {
    return !!this.getCurrentUser();
  },

  /**
   * Returns true when the given email belongs to the admin account.
   * @param {string} email
   * @returns {boolean}
   */
  isAdmin(email) {
    return (email || '').toLowerCase() === this.ADMIN_EMAIL.toLowerCase();
  },

  /**
   * Returns true when the currently logged-in user is the admin.
   * @returns {boolean}
   */
  isCurrentUserAdmin() {
    const user = this.getCurrentUser();
    return user ? this.isAdmin(user.email) : false;
  },

  /**
   * Redirect to admin login if the current user is not an admin.
   * @returns {boolean} true if allowed to continue
   */
  requireAdmin() {
    const user = this.getCurrentUser();
    if (!user) {
      window.location.href = this._getPath('admin-login');
      return false;
    }
    if (!this.isAdmin(user.email)) {
      window.location.href = this._getPath('home');
      return false;
    }
    return true;
  },

  /**
   * Redirect to checkout/login if not authenticated.
   * @param {string} [redirectPath='/checkout.html?login=true']
   * @returns {boolean} true if allowed to continue
   */
  requireLogin(redirectPath = '/checkout.html?login=true') {
    if (!this.isLoggedIn()) {
      window.location.href = this._getPath(redirectPath);
      return false;
    }
    return true;
  },

  /* ══════════════════════════════════════════════════════════
     PASSWORD RESET
     ══════════════════════════════════════════════════════════ */

  /**
   * Send a password-reset email via Supabase (no-op when not configured).
   * @param {string} email
   * @returns {Promise<{ success: boolean, error: string|null }>}
   */
  async sendPasswordReset(email) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { error } = await window.EpicSupabase.auth.resetPasswordForEmail(
          email.trim().toLowerCase(),
          { redirectTo: `${window.location.origin}/reset-password.html` }
        );
        if (error) throw error;
        return { success: true, error: null };
      } catch (err) {
        return { success: false, error: err.message };
      }
    }
    // Fallback — simulate success for demo
    return { success: true, error: null };
  },

  /* ══════════════════════════════════════════════════════════
     NAVBAR AUTH UPDATE
     ══════════════════════════════════════════════════════════ */

  /**
   * Update all navbar user/login icon elements based on auth state.
   * Call this after login, logout, or on DOMContentLoaded.
   */
  updateNavbarAuth() {
    const user = this.getCurrentUser();
    const loginBtns  = document.querySelectorAll('[data-auth="login"]');
    const logoutBtns = document.querySelectorAll('[data-auth="logout"]');
    const userNames  = document.querySelectorAll('[data-auth="username"]');
    const adminLinks = document.querySelectorAll('[data-auth="admin"]');
    const navUserIcon = document.querySelector('#nav-user-btn');

    if (user) {
      loginBtns.forEach(el  => el.classList.add('hidden'));
      logoutBtns.forEach(el => el.classList.remove('hidden'));
      userNames.forEach(el  => { el.textContent = user.name || user.email.split('@')[0]; });
      if (this.isAdmin(user.email)) {
        adminLinks.forEach(el => el.classList.remove('hidden'));
      }
      if (navUserIcon) {
        navUserIcon.title   = user.name || 'My Account';
        navUserIcon.href    = this.isAdmin(user.email) ? this._getPath('admin-dashboard') : this._getPath('checkout-login');
        navUserIcon.innerHTML = '👤';
      }
    } else {
      loginBtns.forEach(el  => el.classList.remove('hidden'));
      logoutBtns.forEach(el => el.classList.add('hidden'));
      userNames.forEach(el  => { el.textContent = ''; });
      adminLinks.forEach(el => el.classList.add('hidden'));
      if (navUserIcon) {
        navUserIcon.title   = 'Login';
        navUserIcon.href    = this._getPath('admin-login');
        navUserIcon.innerHTML = '🔑';
      }
    }
  },

  /* ══════════════════════════════════════════════════════════
     PRIVATE HELPERS
     ══════════════════════════════════════════════════════════ */

  /**
   * Normalise a Supabase user object to the Epic Toyz user shape.
   * @param {object} sbUser - Raw Supabase auth user
   * @returns {object}
   */
  _normaliseUser(sbUser) {
    if (!sbUser) return null;
    return {
      id:        sbUser.id,
      email:     sbUser.email,
      name:      sbUser.user_metadata?.name  || sbUser.email.split('@')[0],
      phone:     sbUser.user_metadata?.phone || '',
      role:      this.isAdmin(sbUser.email) ? 'admin' : 'customer',
      createdAt: sbUser.created_at,
    };
  },

  /**
   * Persist a local session to localStorage.
   * @param {object} user
   * @param {string} token
   */
  _storeSession(user, token) {
    const session = { user, token, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 };
    localStorage.setItem(this.SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(this.USER_KEY,    JSON.stringify(user));
  },
};

/* ─── Expose globally ───────────────────────────────────────────────────── */
window.Auth = Auth;

/* ─── Auto-update navbar on page load ──────────────────────────────────── */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Auth.updateNavbarAuth());
} else {
  Auth.updateNavbarAuth();
}
