/**
 * Epic Toyz — Admin Module
 * Full CRUD for Products, Categories, Orders, Reviews, Inventory
 */

'use strict';

// ─────────────────────────────────────────────────────────
//  UTILITY HELPERS
// ─────────────────────────────────────────────────────────

/**
 * Format a number as Indian Rupees
 */
function formatCurrency(n) {
  if (n === null || n === undefined || isNaN(n)) return '₹0';
  return '₹' + Number(n).toLocaleString('en-IN');
}

/**
 * Format a date string to readable format
 */
function formatDate(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) { return dateStr; }
}

/**
 * Format date+time
 */
function formatDateTime(dateStr) {
  if (!dateStr) return '—';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  } catch (e) { return dateStr; }
}

/**
 * Escape HTML to prevent XSS
 */
function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Get badge HTML for product badge value (string or array)
 */
function getBadgeHTML(badgeOrArr) {
  const badges = Array.isArray(badgeOrArr)
    ? badgeOrArr
    : (badgeOrArr && badgeOrArr !== 'none' ? [badgeOrArr] : []);
  if (!badges.length) return '<span class="badge badge-none">—</span>';
  const map = {
    new: '<span class="badge badge-new">✨ New</span>',
    bestseller: '<span class="badge badge-bestseller">⭐ Best Seller</span>',
    featured: '<span class="badge badge-featured">🔥 Featured</span>',
    sale: '<span class="badge badge-sale">🏷️ Sale</span>',
    hot: '<span class="badge badge-sale" style="background:rgba(255,100,0,0.15);color:#ff6400;border-color:rgba(255,100,0,0.25);">🌶️ Hot</span>',
    limited: '<span class="badge badge-none" style="background:rgba(155,89,182,0.15);color:#9b59b6;border-color:rgba(155,89,182,0.25);">⏳ Limited</span>',
  };
  return badges.map(b => map[b] || `<span class="badge badge-none">${esc(b)}</span>`).join(' ');
}

/**
 * Get status badge HTML for orders
 */
function getStatusBadge(status) {
  const map = {
    pending: '⏳ Pending',
    confirmed: '✅ Confirmed',
    shipped: '🚚 Shipped',
    delivered: '📦 Delivered',
    cancelled: '❌ Cancelled',
  };
  const label = map[status] || status || '—';
  return `<span class="status-badge status-${status || 'pending'}">${esc(label)}</span>`;
}

/**
 * Generate a unique ID
 */
function generateId() {
  return 'et_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
}

/**
 * Generate order number
 */
function generateOrderNumber() {
  return 'ORD-' + Date.now().toString().slice(-8);
}

/**
 * Check if a string is a valid image URL/path/data URL
 */
function isImageUrl(url) {
  if (!url) return false;
  const lower = url.toLowerCase().trim();
  return lower.startsWith('data:image/') ||
         lower.startsWith('http://') ||
         lower.startsWith('https://') ||
         lower.startsWith('assets/') ||
         lower.startsWith('images/') ||
         lower.startsWith('/') ||
         lower.startsWith('./') ||
         lower.startsWith('../') ||
         /\.(jpg|jpeg|png|webp|gif|svg|bmp)($|\?)/i.test(lower);
}

// ─────────────────────────────────────────────────────────
//  TOAST NOTIFICATION SYSTEM
// ─────────────────────────────────────────────────────────

const Toast = {
  show(message, type = 'info', duration = 3500) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${esc(message)}</span>`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('toast-out');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },

  success(msg) { this.show(msg, 'success'); },
  error(msg) { this.show(msg, 'error'); },
  info(msg) { this.show(msg, 'info'); },
  warning(msg) { this.show(msg, 'warning'); }
};

// ─────────────────────────────────────────────────────────
//  LOCAL STORAGE DB FALLBACK
//  (Used when DB module is unavailable or returns nothing)
// ─────────────────────────────────────────────────────────

const LocalDB = {
  _get(key) {
    try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
  },
  _set(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { console.warn('LocalDB write error', e); }
  },

  // PRODUCTS
  getProducts() { return this._get('et_products') || []; },
  setProducts(arr) { this._set('et_products', arr); },
  findProduct(id) { return this.getProducts().find(p => String(p.id) === String(id)) || null; },
  createProduct(data) {
    const products = this.getProducts();
    const product = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    products.push(product);
    this.setProducts(products);
    return product;
  },
  updateProduct(id, data) {
    const products = this.getProducts().map(p => String(p.id) === String(id) ? { ...p, ...data, updatedAt: new Date().toISOString() } : p);
    this.setProducts(products);
    return products.find(p => String(p.id) === String(id));
  },
  deleteProduct(id) {
    this.setProducts(this.getProducts().filter(p => String(p.id) !== String(id)));
  },

  // CATEGORIES
  getCategories() { return this._get('et_categories') || []; },
  setCategories(arr) { this._set('et_categories', arr); },
  createCategory(data) {
    const cats = this.getCategories();
    const cat = { ...data, id: generateId(), createdAt: new Date().toISOString() };
    cats.push(cat);
    this.setCategories(cats);
    return cat;
  },
  updateCategory(id, data) {
    const cats = this.getCategories().map(c => String(c.id) === String(id) ? { ...c, ...data } : c);
    this.setCategories(cats);
    return cats.find(c => String(c.id) === String(id));
  },
  deleteCategory(id) {
    this.setCategories(this.getCategories().filter(c => String(c.id) !== String(id)));
  },

  // ORDERS
  getOrders() { return this._get('et_orders') || []; },
  setOrders(arr) { this._set('et_orders', arr); },
  findOrder(id) { return this.getOrders().find(o => String(o.id) === String(id)) || null; },
  updateOrder(id, data) {
    const orders = this.getOrders().map(o => String(o.id) === String(id) ? { ...o, ...data, updatedAt: new Date().toISOString() } : o);
    this.setOrders(orders);
    return orders.find(o => String(o.id) === String(id));
  },
  deleteOrder(id) { this.setOrders(this.getOrders().filter(o => String(o.id) !== String(id))); },

  // REVIEWS
  getReviews() { return this._get('et_reviews') || []; },
  setReviews(arr) { this._set('et_reviews', arr); },
  findReview(id) { return this.getReviews().find(r => String(r.id) === String(id)) || null; },
  approveReview(id) {
    const reviews = this.getReviews().map(r => String(r.id) === String(id) ? { ...r, approved: true } : r);
    this.setReviews(reviews);
  },
  deleteReview(id) { this.setReviews(this.getReviews().filter(r => String(r.id) !== String(id))); },
};

// ─────────────────────────────────────────────────────────
//  SAFE DB WRAPPER
//  Tries DB module first, falls back to LocalDB
// ─────────────────────────────────────────────────────────

async function safeGetProducts(opts = {}) {
  try {
    if (window.DB && typeof DB.getProducts === 'function') {
      const res = await DB.getProducts(opts);
      if (Array.isArray(res)) return res;
    }
  } catch (e) { console.warn('DB.getProducts failed, using LocalDB', e); }
  let products = LocalDB.getProducts();
  if (opts.search) {
    const q = opts.search.toLowerCase();
    products = products.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.shortDescription || p.description || '').toLowerCase().includes(q)
    );
  }
  return products;
}

async function safeGetOrders() {
  try {
    if (window.DB && typeof DB.getOrders === 'function') {
      const res = await DB.getOrders();
      if (Array.isArray(res)) return res;
    }
  } catch (e) { console.warn('DB.getOrders failed, using LocalDB', e); }
  return LocalDB.getOrders();
}

async function safeGetCategories() {
  try {
    if (window.DB && typeof DB.getCategories === 'function') {
      const res = await DB.getCategories();
      if (Array.isArray(res)) return res;
    }
  } catch (e) { console.warn('DB.getCategories failed, using LocalDB', e); }
  return LocalDB.getCategories();
}

async function safeGetReviews() {
  try {
    if (window.DB && typeof DB.getReviews === 'function') {
      const res = await DB.getReviews();
      if (Array.isArray(res)) return res;
    }
  } catch (e) { console.warn('DB.getReviews failed, using LocalDB', e); }
  return LocalDB.getReviews();
}

// ─────────────────────────────────────────────────────────
//  SIMPLE AUTH CHECK (no Auth module dependency)
// ─────────────────────────────────────────────────────────

function checkAdminAuth() {
  console.log('[Admin] checkAdminAuth() running...');

  // ── Strategy: check ALL session sources before redirecting. ──
  // This prevents redirect loops caused by one store having a session
  // while the other doesn't.

  const ADMIN_EMAIL_ADDR = 'epictoyz.in@gmail.com';
  let authenticatedAdmin = false;

  // 1. Check Auth module session (et_session)
  if (window.Auth && typeof Auth.getCurrentUser === 'function') {
    try {
      const user = Auth.getCurrentUser();
      if (user) {
        console.log('[Admin] checkAdminAuth: Auth module found user:', user.email);
        if (Auth.isAdmin(user.email)) {
          authenticatedAdmin = true;
          console.log('[Admin] checkAdminAuth: ✅ Auth module confirms admin');
        } else {
          console.warn('[Admin] checkAdminAuth: user is not admin — redirecting home');
          window.location.href = '../index.html';
          return false;
        }
      }
    } catch (e) {
      console.warn('[Admin] checkAdminAuth: Auth module threw:', e.message);
    }
  }

  // 2. Check et_admin_session (admin.js's own session)
  if (!authenticatedAdmin) {
    try {
      const raw = localStorage.getItem('et_admin_session');
      if (raw) {
        const session = JSON.parse(raw);
        if (session.email && session.email.toLowerCase() === ADMIN_EMAIL_ADDR && Date.now() < session.expires) {
          authenticatedAdmin = true;
          console.log('[Admin] checkAdminAuth: ✅ et_admin_session is valid');

          // Synchronize: also store in Auth module's session so Auth.getCurrentUser works
          if (window.Auth && typeof Auth._storeSession === 'function') {
            const existingAuthSession = localStorage.getItem('et_session');
            if (!existingAuthSession) {
              console.log('[Admin] checkAdminAuth: syncing et_admin_session → et_session');
              Auth._storeSession({
                id: 'admin-001',
                email: ADMIN_EMAIL_ADDR,
                name: 'Admin',
                role: 'admin',
                createdAt: session.loginTime || new Date().toISOString(),
              }, 'local-admin-token');
            }
          }
        } else {
          console.warn('[Admin] checkAdminAuth: et_admin_session expired or invalid, clearing');
          localStorage.removeItem('et_admin_session');
        }
      }
    } catch (e) {
      console.warn('[Admin] checkAdminAuth: error reading et_admin_session:', e.message);
    }
  }

  // 3. Check et_admin_email fallback
  if (!authenticatedAdmin) {
    const email = localStorage.getItem('et_admin_email') || '';
    if (email && email.toLowerCase() === ADMIN_EMAIL_ADDR) {
      console.log('[Admin] checkAdminAuth: ✅ et_admin_email found, granting access');
      authenticatedAdmin = true;
    }
  }

  // ── Final verdict ──
  if (authenticatedAdmin) {
    console.log('[Admin] checkAdminAuth: ✅ Admin authenticated successfully');
    return true;
  }

  console.warn('[Admin] checkAdminAuth: ❌ No valid admin session — redirecting to login');
  window.location.href = 'login.html';
  return false;
}

// ─────────────────────────────────────────────────────────
//  MAIN ADMIN OBJECT
// ─────────────────────────────────────────────────────────

const Admin = {
  currentSection: 'dashboard',
  _productPage: 1,
  _productPageSize: 10,
  _productSearch: '',
  _productCategoryFilter: '',
  _productBadgeFilter: '',
  _orderPage: 1,
  _orderPageSize: 10,
  _inventoryChanges: {},
  _clockInterval: null,

  // ══════════════════════════════════════════
  //  INIT
  // ══════════════════════════════════════════

  async init() {
    console.log('[Admin] Admin.init() starting...');
    // Auth guard
    if (!checkAdminAuth()) {
      console.warn('[Admin] Auth guard failed — stopping init');
      return;
    }

    console.log('[Admin] ✅ Auth guard passed — loading dashboard');

    // Hide page loader
    setTimeout(() => {
      const loader = document.getElementById('page-loader');
      if (loader) loader.classList.add('hidden');
    }, 600);

    // Show content
    this.updateAdminInfo();
    this.initNav();
    this.startClock();
    await this.loadSection('dashboard');
    console.log('[Admin] ✅ Dashboard fully loaded');
  },

  // ══════════════════════════════════════════
  //  ADMIN USER INFO
  // ══════════════════════════════════════════

  updateAdminInfo() {
    let email = 'epictoyz.in@gmail.com';
    try {
      if (window.Auth && typeof Auth.getCurrentUser === 'function') {
        const user = Auth.getCurrentUser();
        if (user && user.email) email = user.email;
      } else {
        const session = JSON.parse(localStorage.getItem('et_admin_session') || '{}');
        if (session.email) email = session.email;
      }
    } catch (e) {}

    const nameEl = document.getElementById('admin-name');
    const emailEl = document.getElementById('admin-email-display');
    if (nameEl) nameEl.textContent = email.split('@')[0].replace(/\./g, ' ').replace(/\b\w/g, l => l.toUpperCase());
    if (emailEl) emailEl.textContent = email;
  },

  // ══════════════════════════════════════════
  //  CLOCK
  // ══════════════════════════════════════════

  startClock() {
    const updateClock = () => {
      const now = new Date();
      const timeEl = document.getElementById('header-time');
      const dateEl = document.getElementById('header-date');
      if (timeEl) timeEl.textContent = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      if (dateEl) dateEl.textContent = now.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' });
    };
    updateClock();
    this._clockInterval = setInterval(updateClock, 1000);
  },

  // ══════════════════════════════════════════
  //  SIDEBAR NAV
  // ══════════════════════════════════════════

  initNav() {
    const navItems = document.querySelectorAll('.nav-item[data-section]');
    navItems.forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        this.loadSection(section);
        // Close mobile sidebar
        const sidebar = document.getElementById('sidebar');
        const overlay = document.getElementById('sidebar-overlay');
        if (sidebar) sidebar.classList.remove('open');
        if (overlay) overlay.classList.remove('open');
      });
    });

    // Mobile sidebar toggle buttons wire-up
    const toggleBtn = document.getElementById('sidebar-toggle');
    const overlay = document.getElementById('sidebar-overlay');
    const sidebar = document.getElementById('sidebar');
    if (toggleBtn && sidebar && overlay) {
      toggleBtn.addEventListener('click', () => {
        sidebar.classList.toggle('open');
        overlay.classList.toggle('open');
      });
      overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
      });
    }

    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => this.logout());
    }
  },

  setActiveNav(section) {
    document.querySelectorAll('.nav-item[data-section]').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });
  },

  setPageHeader(title, breadcrumb) {
    const heading = document.getElementById('page-heading');
    const bc = document.getElementById('page-breadcrumb-current');
    if (heading) heading.textContent = title;
    if (bc) bc.textContent = breadcrumb || title;
  },

  // ══════════════════════════════════════════
  //  SECTION LOADER
  // ══════════════════════════════════════════

  async loadSection(section) {
    this.currentSection = section;
    this.setActiveNav(section);

    // Hide all sections
    document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));

    // Show target section
    const el = document.getElementById(`section-${section}`);
    if (el) el.classList.add('active');

    const titles = {
      dashboard: ['Dashboard', 'Overview'],
      products: ['Products', 'Manage Products'],
      categories: ['Categories', 'Manage Categories'],
      orders: ['Orders', 'Manage Orders'],
      reviews: ['Reviews', 'Manage Reviews'],
      inventory: ['Inventory', 'Stock Management'],
      users: ['Users', 'Registered Users'],
      settings: ['Settings', 'Store Settings'],
    };
    const [title, bc] = titles[section] || [section, section];
    this.setPageHeader(title, bc);

    // Render
    switch (section) {
      case 'dashboard':  await this.renderDashboard();  break;
      case 'products':   await this.renderProducts();    break;
      case 'categories': await this.renderCategories(); break;
      case 'orders':     await this.renderOrders();      break;
      case 'reviews':    await this.renderReviews();     break;
      case 'inventory':  await this.renderInventory();   break;
      case 'users':      await this.renderUsers();       break;
      case 'settings':   await this.renderSettings();    break;
    }
  },

  // ══════════════════════════════════════════
  //  LOGOUT
  // ══════════════════════════════════════════

  logout() {
    this.confirm('Are you sure you want to logout from the admin panel?', 'Logout', async () => {
      try {
        if (window.Auth && typeof Auth.logout === 'function') await Auth.logout();
      } catch (e) {}
      localStorage.removeItem('et_admin_session');
      localStorage.removeItem('et_admin_email');
      window.location.href = 'login.html';
    });
  },

  // ══════════════════════════════════════════
  //  MODAL UTILITIES
  // ══════════════════════════════════════════

  openModal(id) {
    const backdrop = document.getElementById(id);
    if (backdrop) {
      backdrop.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  closeModal(id) {
    const backdrop = document.getElementById(id);
    if (backdrop) {
      backdrop.classList.remove('open');
      document.body.style.overflow = '';
    }
  },

  confirm(message, title = 'Confirm', onConfirm) {
    document.getElementById('confirm-message').textContent = message;
    document.getElementById('confirm-title').textContent = title;
    const btn = document.getElementById('confirm-ok-btn');
    btn.onclick = () => {
      this.closeModal('confirm-modal-backdrop');
      if (typeof onConfirm === 'function') onConfirm();
    };
    this.openModal('confirm-modal-backdrop');
  },

  // ══════════════════════════════════════════
  //  SECTION: DASHBOARD
  // ══════════════════════════════════════════

  async renderDashboard() {
    const [products, orders] = await Promise.all([safeGetProducts(), safeGetOrders()]);

    // Stats
    const totalRevenue = orders
      .filter(o => o.status !== 'cancelled')
      .reduce((sum, o) => sum + (Number(o.total) || Number(o.totalAmount) || 0), 0);
    const pendingOrders = orders.filter(o => o.status === 'pending' || !o.status).length;

    const el = (id, val) => { const e = document.getElementById(id); if (e) e.textContent = val; };
    el('stat-products', products.length);
    el('stat-orders', orders.length);
    el('stat-revenue', formatCurrency(totalRevenue));
    el('stat-pending', pendingOrders);

    // Update pending badge in sidebar
    const badge = document.getElementById('pending-orders-badge');
    if (badge) {
      badge.textContent = pendingOrders;
      badge.style.display = pendingOrders > 0 ? 'inline-flex' : 'none';
    }

    // Recent Orders (last 5)
    const recentEl = document.getElementById('recent-orders-list');
    if (recentEl) {
      const recent = [...orders]
        .sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0))
        .slice(0, 5);

      if (recent.length === 0) {
        recentEl.innerHTML = '<div class="table-empty"><div class="empty-icon">📋</div><div>No orders yet</div></div>';
      } else {
        recentEl.innerHTML = `
          <table class="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Customer</th>
                <th>Total</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${recent.map(o => `
                <tr style="cursor:pointer;" onclick="Admin.openOrderModal('${esc(String(o.id))}')">
                  <td><strong>${esc(o.orderNumber || String(o.id).slice(-6))}</strong></td>
                  <td>${esc(o.customerName || o.name || 'Unknown')}</td>
                  <td style="color:var(--red); font-weight:700;">${formatCurrency(o.total || o.totalAmount)}</td>
                  <td>${getStatusBadge(o.status)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        `;
      }
    }

    // Low Stock (< 5)
    const lowStockEl = document.getElementById('low-stock-list');
    if (lowStockEl) {
      const lowStock = products.filter(p => Number(p.stock || p.stockQuantity || 0) < 5);
      if (lowStock.length === 0) {
        lowStockEl.innerHTML = '<div class="table-empty"><div class="empty-icon">✅</div><div style="color:var(--success)">All products well stocked!</div></div>';
      } else {
        lowStockEl.innerHTML = lowStock.map(p => `
          <div class="alert-item">
            <div class="alert-icon">${p.image ? `<img src="${esc(p.image)}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;">` : '📦'}</div>
            <div class="alert-name">${esc(p.name)}</div>
            <div class="alert-stock">${Number(p.stock || p.stockQuantity || 0)} left</div>
          </div>
        `).join('');
      }
    }
  },

  async renderUsers() {
    const tbody = document.getElementById('users-tbody');
    const countLabel = document.getElementById('users-count-label');
    if (!tbody) return;

    let users = [];
    try {
      const rawUsers = localStorage.getItem('et_users');
      if (rawUsers) {
        users = JSON.parse(rawUsers);
      }
      if (users.length === 0) {
        const rawUser = localStorage.getItem('et_user');
        if (rawUser) {
          users = [JSON.parse(rawUser)];
        }
      }
      if (users.length === 0) {
        users = [
          { name: 'Yogesh Kumar', email: 'yogesh2007.gv@gmail.com', phone: '9363114113', role: 'user', createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString() },
          { name: 'Admin', email: 'epictoyz.in@gmail.com', phone: '6383793890', role: 'admin', createdAt: new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString() },
          { name: 'Karan Sharma', email: 'karan.sharma@gmail.com', phone: '9876543210', role: 'user', createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString() }
        ];
        localStorage.setItem('et_users', JSON.stringify(users));
      }
    } catch (e) {
      console.warn('[Admin] Failed to fetch users:', e);
    }

    if (countLabel) {
      countLabel.textContent = `${users.length} registered user account${users.length !== 1 ? 's' : ''}`;
    }

    if (users.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="empty-icon">👥</div><div>No registered users found</div></div></td></tr>`;
    } else {
      tbody.innerHTML = users.map(u => `
        <tr>
          <td><strong>${esc(u.name || '—')}</strong></td>
          <td>${esc(u.email || '—')}</td>
          <td>${esc(u.phone || '—')}</td>
          <td><span class="badge ${u.role === 'admin' ? 'badge-featured' : 'badge-none'}">${esc(u.role || 'user')}</span></td>
          <td>${formatDate(u.createdAt || u.created_at)}</td>
        </tr>
      `).join('');
    }
  },

  async renderSettings() {
    let settings = {
      shopName: 'Epic Toyz',
      whatsapp: '916383793890',
      upi: '9363114113@sbi',
      shipping: 50
    };

    try {
      const saved = localStorage.getItem('et_shop_settings');
      if (saved) {
        settings = { ...settings, ...JSON.parse(saved) };
      } else {
        localStorage.setItem('et_shop_settings', JSON.stringify(settings));
      }
    } catch (e) {
      console.warn('[Admin] Failed to read settings:', e);
    }

    const nameInput = document.getElementById('settings-shop-name');
    const waInput = document.getElementById('settings-whatsapp');
    const upiInput = document.getElementById('settings-upi');
    const shippingInput = document.getElementById('settings-shipping');

    if (nameInput) nameInput.value = settings.shopName || '';
    if (waInput) waInput.value = settings.whatsapp || '';
    if (upiInput) upiInput.value = settings.upi || '';
    if (shippingInput) shippingInput.value = settings.shipping ?? 50;
  },

  saveSettings(event) {
    if (event) event.preventDefault();

    const nameInput = document.getElementById('settings-shop-name');
    const waInput = document.getElementById('settings-whatsapp');
    const upiInput = document.getElementById('settings-upi');
    const shippingInput = document.getElementById('settings-shipping');

    const settings = {
      shopName: nameInput ? nameInput.value.trim() : 'Epic Toyz',
      whatsapp: waInput ? waInput.value.trim().replace(/[^0-9]/g, '') : '916383793890',
      upi: upiInput ? upiInput.value.trim() : '9363114113@sbi',
      shipping: shippingInput ? parseInt(shippingInput.value, 10) || 0 : 50
    };

    try {
      localStorage.setItem('et_shop_settings', JSON.stringify(settings));
      Toast.success('Settings saved successfully!');
    } catch (e) {
      console.error('[Admin] Failed to save settings:', e);
      Toast.error('Failed to save settings.');
    }
  },

  // ══════════════════════════════════════════
  //  SECTION: PRODUCTS
  // ══════════════════════════════════════════

  async renderProducts(search = '', page = 1) {
    this._productSearch = search !== undefined ? search : this._productSearch;
    this._productPage = page;

    const catFilter = (document.getElementById('products-category-filter') || {}).value || '';
    const badgeFilter = (document.getElementById('products-badge-filter') || {}).value || '';
    this._productCategoryFilter = catFilter;
    this._productBadgeFilter = badgeFilter;

    let [products, categories] = await Promise.all([
      safeGetProducts({ search: this._productSearch }),
      safeGetCategories()
    ]);

    // Populate category filter
    const catFilterEl = document.getElementById('products-category-filter');
    if (catFilterEl && categories.length > 0) {
      const currentVal = catFilterEl.value;
      catFilterEl.innerHTML = '<option value="">All Categories</option>' +
        categories.map(c => `<option value="${esc(c.id)}" ${c.id == currentVal ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    }

    // Apply local filters
    if (catFilter) {
      products = products.filter(p => String(p.categoryId) === String(catFilter) || String(p.category) === String(catFilter));
    }
    if (badgeFilter) {
      products = products.filter(p => {
        const productBadges = p.badges && p.badges.length > 0 ? p.badges : (p.badge ? [p.badge] : []);
        return productBadges.some(b => b.toLowerCase() === badgeFilter.toLowerCase());
      });
    }

    // Update count label
    const countLabel = document.getElementById('products-count-label');
    if (countLabel) countLabel.textContent = `${products.length} product${products.length !== 1 ? 's' : ''} found`;

    // Pagination
    const total = products.length;
    const pageSize = this._productPageSize;
    const totalPages = Math.max(1, Math.ceil(total / pageSize));
    const currentPage = Math.min(this._productPage, totalPages);
    this._productPage = currentPage;
    const paginated = products.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    // Build category lookup
    const catMap = {};
    categories.forEach(c => { catMap[c.id] = c; });

    // Render table body
    const tbody = document.getElementById('products-tbody');
    if (!tbody) return;

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7"><div class="table-empty"><div class="empty-icon">📦</div><div>No products found</div><div style="margin-top:8px;"><button class="btn btn-primary btn-sm" onclick="Admin.openProductModal()">➕ Add First Product</button></div></div></td></tr>`;
    } else {
      tbody.innerHTML = paginated.map(p => {
        const stock = Number(p.stock || p.stockQuantity || 0);
        const catName = (catMap[p.categoryId] || catMap[p.category] || {}).name || p.category || '—';
        const price = p.price ? formatCurrency(p.price) : '—';
        const statusHtml = stock === 0
          ? '<span class="status-badge status-outofstock">Out of Stock</span>'
          : stock < 5
            ? `<span class="status-badge status-low">⚠️ Low (${stock})</span>`
            : `<span class="status-badge status-instock">✅ In Stock</span>`;

        const imgHtml = p.image
          ? `<div class="product-thumb"><img src="${esc(p.image)}" alt="" onerror="this.parentElement.innerHTML='📦'"></div>`
          : `<div class="product-thumb">📦</div>`;

        return `
          <tr>
            <td>
              <div class="product-info">
                ${imgHtml}
                <div>
                  <div class="product-name">${esc(p.name)}</div>
                  <div class="product-id">#${esc(String(p.id).slice(-8))}</div>
                </div>
              </div>
            </td>
            <td>${esc(catName)}</td>
            <td>
              <div style="font-weight:700; color:var(--red);">${price}</div>
              ${p.originalPrice ? `<div style="font-size:11px; color:var(--text-muted); text-decoration:line-through;">${formatCurrency(p.originalPrice)}</div>` : ''}
            </td>
            <td>
              <span style="font-weight:700; color:${stock < 5 ? 'var(--error)' : 'var(--text)'};">${stock}</span>
            </td>
            <td><div style="display:flex;flex-wrap:wrap;gap:4px;">${getBadgeHTML(p.badges && p.badges.length > 0 ? p.badges : (p.badge || ''))}</div></td>
            <td>${statusHtml}</td>
            <td>
              <div style="display:flex; gap:6px;">
                <button class="btn btn-secondary btn-sm" onclick="Admin.openProductModal('${esc(String(p.id))}')">✏️ Edit</button>
                <button class="btn btn-danger btn-sm" onclick="Admin.deleteProduct('${esc(String(p.id))}')">🗑️</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    // Pagination controls
    this.renderPagination('products-pagination', currentPage, totalPages, 'Admin.goToProductPage');
  },

  handleProductSearch(value) {
    clearTimeout(this._searchTimeout);
    this._searchTimeout = setTimeout(() => {
      this.renderProducts(value, 1);
    }, 350);
  },

  goToProductPage(pg) {
    this.renderProducts(this._productSearch, pg);
  },

  // ── PRODUCT MODAL ──────────────────────────────────────

  async openProductModal(productId = null) {
    const isEdit = productId !== null;
    document.getElementById('product-modal-title').textContent = isEdit ? 'Edit Product' : 'Add Product';
    document.getElementById('save-product-btn').textContent = isEdit ? '💾 Update Product' : '💾 Save Product';

    // Show/hide queue button based on whether we are adding or editing
    const queueBtn = document.getElementById('queue-product-btn');
    if (queueBtn) {
      queueBtn.style.display = isEdit ? 'none' : 'inline-flex';
    }

    // Reset form
    document.getElementById('product-form').reset();
    document.getElementById('product-id').value = '';
    this.clearImageRows();
    this.addImageRow(); // Start with one empty image row
    this.clearSpecRows();
    this.clearFeatureRows();
    this.addSpecRow(); // Start with one empty row
    this.addFeatureRow();

    // Populate category checkboxes
    const categories = await safeGetCategories();
    const catContainer = document.getElementById('product-categories-container');
    if (catContainer) {
      catContainer.innerHTML = categories.map(c => `
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-size:14px; color:#fff; margin-bottom:4px;">
          <input type="checkbox" name="product-categories" value="${esc(String(c.id))}">
          <span>${esc(c.name)}</span>
        </label>
      `).join('');
    }

    if (isEdit) {
      // Load product data
      let product = null;
      const allProducts = await safeGetProducts();
      product = allProducts.find(p => String(p.id) === String(productId));

      if (!product) {
        Toast.error('Product not found');
        return;
      }

      document.getElementById('product-id').value = product.id;
      document.getElementById('product-name').value = product.name || '';

      // Select the active checkboxes
      const categoriesArray = product.categories || (product.categoryId ? [product.categoryId] : (product.category ? [product.category] : []));
      const mappedCatsArray = categoriesArray.map(catVal => {
        const found = categories.find(c => String(c.id) === String(catVal) || c.slug === String(catVal));
        return found ? String(found.id) : String(catVal);
      });
      document.querySelectorAll('#product-categories-container input[type="checkbox"]').forEach(cb => {
        cb.checked = mappedCatsArray.includes(cb.value);
      });
      // Update hidden fallback
      document.getElementById('product-category').value = mappedCatsArray[0] || '';

      // Restore badge checkboxes
      const badgesArr = product.badges && product.badges.length > 0
        ? product.badges
        : (product.badge ? [product.badge] : []);
      document.querySelectorAll('#product-badges-container input[type="checkbox"]').forEach(cb => {
        cb.checked = badgesArr.includes(cb.value);
      });
      document.getElementById('product-badge').value = badgesArr[0] || '';
      document.getElementById('product-price').value = product.price || '';
      document.getElementById('product-original-price').value = product.originalPrice || '';
      document.getElementById('product-stock').value = product.stock ?? product.stockQuantity ?? 0;
      document.getElementById('product-short-desc').value = product.shortDescription || product.shortDesc || '';
      document.getElementById('product-desc').value = product.description || product.fullDescription || '';
      document.getElementById('product-featured').checked = !!product.featured || !!product.isFeatured;

      // Images
      this.clearImageRows();
      const imgs = (product.images && Array.isArray(product.images) && product.images.length > 0)
        ? product.images.filter(Boolean)
        : (product.image ? [product.image] : []);
      if (imgs.length > 0) {
        imgs.forEach(imgUrl => this.addImageRow(imgUrl));
      } else {
        this.addImageRow();
      }

      // Specs
      this.clearSpecRows();
      const specs = product.specifications || product.specs || {};
      const specEntries = Array.isArray(specs)
        ? specs
        : Object.entries(specs).map(([key, value]) => ({ key, value }));
      if (specEntries.length > 0) {
        specEntries.forEach(s => this.addSpecRow(s.key || '', s.value || ''));
      } else {
        this.addSpecRow();
      }

      // Features
      this.clearFeatureRows();
      const features = product.features || [];
      if (features.length > 0) {
        features.forEach(f => this.addFeatureRow(typeof f === 'string' ? f : (f.text || f.name || '')));
      } else {
        this.addFeatureRow();
      }
    }

    this.openModal('product-modal-backdrop');
  },

  clearSpecRows() {
    const editor = document.getElementById('specs-editor');
    if (editor) editor.innerHTML = '';
  },

  clearFeatureRows() {
    const editor = document.getElementById('features-editor');
    if (editor) editor.innerHTML = '';
  },

  // ── Multi-image helpers ──────────────────────────────────────
  clearImageRows() {
    const editor = document.getElementById('images-editor');
    if (editor) editor.innerHTML = '';
  },

  addImageRow(value = '') {
    const editor = document.getElementById('images-editor');
    if (!editor) return;
    const idx = editor.children.length;
    const row = document.createElement('div');
    row.className = 'image-row';
    row.innerHTML = `
      <img class="image-row-preview${value ? ' visible' : ''}" src="${esc(value)}" alt="Preview ${idx + 1}">
      <input type="text" class="form-control image-url-input" placeholder="Paste image URL or upload file..." value="${esc(value)}" oninput="Admin.handleImageRowUrl(this)">
      <button type="button" class="image-row-upload" title="Upload image file" onclick="this.nextElementSibling.click()">&#128193;</button>
      <input type="file" accept="image/*" style="display:none;" onchange="Admin.handleGalleryImageUpload(this)">
      <button type="button" class="spec-remove" onclick="this.closest('.image-row').remove()">&#x2715;</button>
    `;
    editor.appendChild(row);
  },

  handleImageRowUrl(input) {
    const preview = input.previousElementSibling;
    if (!preview) return;
    const url = input.value.trim();
    if (url) {
      preview.src = url;
      preview.classList.add('visible');
      preview.onerror = () => { preview.classList.remove('visible'); };
    } else {
      preview.classList.remove('visible');
      preview.src = '';
    }
  },

  async handleGalleryImageUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    const row = input.closest('.image-row');
    if (!row) return;
    try {
      const compressedDataUrl = await this.compressImage(file, 600, 0.6);
      const urlInput = row.querySelector('.image-url-input');
      const preview = row.querySelector('.image-row-preview');
      if (urlInput) urlInput.value = compressedDataUrl;
      if (preview) {
        preview.src = compressedDataUrl;
        preview.classList.add('visible');
      }
    } catch (err) {
      console.error('[Admin] handleGalleryImageUpload compression failed:', err);
      Toast.error('Failed to process image. Please try another image.');
    }
  },

  compressImage(file, maxDimension = 256, quality = 0.7) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          if (width > height) {
            if (width > maxDimension) {
              height = Math.round((height * maxDimension) / width);
              width = maxDimension;
            }
          } else {
            if (height > maxDimension) {
              width = Math.round((width * maxDimension) / height);
              height = maxDimension;
            }
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);

          const dataUrl = canvas.toDataURL('image/jpeg', quality);
          resolve(dataUrl);
        };
        img.onerror = () => reject(new Error('Invalid image file'));
        img.src = e.target.result;
      };
      reader.onerror = () => reject(new Error('File reading failed'));
      reader.readAsDataURL(file);
    });
  },

  async handleCategoryUpload(input) {
    const file = input.files && input.files[0];
    if (!file) return;
    try {
      const compressedDataUrl = await Admin.compressImage(file, 256, 0.7);
      const urlInput = document.getElementById('category-icon');
      if (urlInput) {
        urlInput.value = compressedDataUrl;
        Admin.handleCategoryImageUrl(compressedDataUrl);
      }
    } catch (err) {
      console.error('[Admin] Error compressing category image:', err);
      Toast.error('Failed to load image file. Please try another image.');
    }
  },

  async handleMultipleImagesUpload(input) {
    const files = input.files;
    if (!files || files.length === 0) return;
    
    // If the first image row is empty, clear it before appending
    const editor = document.getElementById('images-editor');
    if (editor && editor.children.length === 1) {
      const firstRowInput = editor.querySelector('.image-url-input');
      if (firstRowInput && !firstRowInput.value.trim()) {
        this.clearImageRows();
      }
    }

    for (const file of Array.from(files)) {
      try {
        const compressedDataUrl = await this.compressImage(file, 600, 0.6);
        this.addImageRow(compressedDataUrl);
      } catch (err) {
        console.error('[Admin] handleMultipleImagesUpload compression failed:', err);
      }
    }
    // Clear input so selecting the same files again triggers change event
    input.value = '';
  },

  queueProduct() {
    const name = document.getElementById('product-name').value.trim();
    const selectedCategories = this.getSelectedCategoriesFromForm();
    const category = selectedCategories[0] || '';
    const selectedBadges = this.getSelectedBadgesFromForm();
    const badge = selectedBadges[0] || null;
    const price = parseFloat(document.getElementById('product-price').value);
    const originalPrice = parseFloat(document.getElementById('product-original-price').value) || null;
    const stock = parseInt(document.getElementById('product-stock').value, 10);
    const shortDesc = document.getElementById('product-short-desc').value.trim();
    const desc = document.getElementById('product-desc').value.trim();
    const featured = document.getElementById('product-featured').checked;
    const images = this.getImagesFromForm();
    const imageUrl = images.length > 0 ? images[0] : '';
    const specs = this.getSpecsFromForm();
    const features = this.getFeaturesFromForm();

    if (!name) { Toast.error('Product name is required'); return; }
    if (!category) { Toast.error('Please select at least one category'); return; }
    if (isNaN(price) || price < 0) { Toast.error('Please enter a valid price'); return; }
    if (isNaN(stock) || stock < 0) { Toast.error('Please enter a valid stock quantity'); return; }

    const data = {
      name,
      categoryId: category,
      category,
      categories: selectedCategories,
      badge,
      badges: selectedBadges,
      price,
      originalPrice,
      stock,
      stockQuantity: stock,
      shortDescription: shortDesc,
      description: desc,
      featured,
      isFeatured: featured,
      image: imageUrl || null,
      images: images.length > 0 ? images : (imageUrl ? [imageUrl] : []),
      specifications: specs,
      specs,
      features,
    };

    this.queuedProducts = this.queuedProducts || [];
    this.queuedProducts.push(data);

    Toast.success(`Added "${name}" to queue!`);

    // Reset the fields in the form so user can easily add another product
    document.getElementById('product-name').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-original-price').value = '';
    document.getElementById('product-stock').value = '';
    document.getElementById('product-short-desc').value = '';
    document.getElementById('product-desc').value = '';
    document.getElementById('product-featured').checked = false;
    this.clearImageRows();
    this.addImageRow(); // Start with one empty row
    this.clearSpecRows();
    this.clearFeatureRows();
    this.addSpecRow();
    this.addFeatureRow();

    // Update queue button
    this.updateQueueButton();
  },

  updateQueueButton() {
    const queue = this.queuedProducts || [];
    const btn = document.getElementById('post-queue-btn');
    if (!btn) return;
    if (queue.length > 0) {
      btn.style.display = 'inline-flex';
      btn.textContent = `📤 Post Queue (${queue.length})`;
    } else {
      btn.style.display = 'none';
    }
  },

  async postQueuedProducts() {
    const queue = this.queuedProducts || [];
    if (queue.length === 0) return;

    const btn = document.getElementById('post-queue-btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = '⏳ Posting...';
    }

    let successCount = 0;
    try {
      for (const product of queue) {
        if (isSupabaseConfigured()) {
          await DB.createProduct(product);
        } else {
          LocalDB.createProduct(product);
        }
        successCount++;
      }
      Toast.success(`Successfully posted all ${successCount} products!`);
      this.queuedProducts = [];
      this.updateQueueButton();
      await this.renderProducts(this._productSearch, this._productPage);
    } catch (e) {
      console.error('[Admin] postQueuedProducts failed:', e);
      Toast.error('Failed to post queued products: ' + (e.message || 'Unknown error'));
    } finally {
      if (btn) {
        btn.disabled = false;
        this.updateQueueButton();
      }
    }
  },

  getImagesFromForm() {
    const images = [];
    document.querySelectorAll('#images-editor .image-url-input').forEach(input => {
      const url = (input.value || '').trim();
      if (url) images.push(url);
    });
    return images;
  },

  addSpecRow(key = '', value = '') {
    const editor = document.getElementById('specs-editor');
    if (!editor) return;
    const row = document.createElement('div');
    row.className = 'spec-row';
    row.innerHTML = `
      <input type="text" class="form-control spec-key" placeholder="Key (e.g. Motor)" value="${esc(key)}">
      <input type="text" class="form-control spec-val" placeholder="Value (e.g. 540 Brushed)" value="${esc(value)}">
      <button type="button" class="spec-remove" onclick="this.parentElement.remove()">✕</button>
    `;
    editor.appendChild(row);
  },

  addFeatureRow(text = '') {
    const editor = document.getElementById('features-editor');
    if (!editor) return;
    const row = document.createElement('div');
    row.className = 'feature-row';
    row.innerHTML = `
      <input type="text" class="form-control feature-text" placeholder="e.g. Waterproof electronics" value="${esc(text)}">
      <button type="button" class="spec-remove" onclick="this.parentElement.remove()">✕</button>
    `;
    editor.appendChild(row);
  },

  getSpecsFromForm() {
    const specs = {};
    document.querySelectorAll('#specs-editor .spec-row').forEach(row => {
      const key = (row.querySelector('.spec-key')?.value || '').trim();
      const val = (row.querySelector('.spec-val')?.value || '').trim();
      if (key) specs[key] = val;
    });
    return specs;
  },

  getFeaturesFromForm() {
    const features = [];
    document.querySelectorAll('#features-editor .feature-text').forEach(input => {
      const text = (input.value || '').trim();
      if (text) features.push(text);
    });
    return features;
  },

  getSelectedBadgesFromForm() {
    const checkboxes = document.querySelectorAll('#product-badges-container input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  },

  getSelectedCategoriesFromForm() {
    const checkboxes = document.querySelectorAll('#product-categories-container input[type="checkbox"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  },

  async saveProduct() {
    const id = document.getElementById('product-id').value;
    const isEdit = !!id;

    const name = document.getElementById('product-name').value.trim();
    const selectedCategories = this.getSelectedCategoriesFromForm();
    const category = selectedCategories[0] || '';
    const selectedBadges = this.getSelectedBadgesFromForm();
    const badge = selectedBadges[0] || null;
    const price = parseFloat(document.getElementById('product-price').value);
    const originalPrice = parseFloat(document.getElementById('product-original-price').value) || null;
    const stock = parseInt(document.getElementById('product-stock').value, 10);
    const shortDesc = document.getElementById('product-short-desc').value.trim();
    const desc = document.getElementById('product-desc').value.trim();
    const featured = document.getElementById('product-featured').checked;
    const images = this.getImagesFromForm();
    const imageUrl = images.length > 0 ? images[0] : '';
    const specs = this.getSpecsFromForm();
    const features = this.getFeaturesFromForm();

    if (!name) { Toast.error('Product name is required'); return; }
    if (!category) { Toast.error('Please select at least one category'); return; }
    if (isNaN(price) || price < 0) { Toast.error('Please enter a valid price'); return; }
    if (isNaN(stock) || stock < 0) { Toast.error('Please enter a valid stock quantity'); return; }

    const data = {
      name,
      categoryId: category,
      category,
      categories: selectedCategories,
      badge,
      badges: selectedBadges,
      price,
      originalPrice,
      stock,
      stockQuantity: stock,
      shortDescription: shortDesc,
      description: desc,
      featured,
      isFeatured: featured,
      image: imageUrl || null,
      images: images.length > 0 ? images : (imageUrl ? [imageUrl] : []),
      specifications: specs,
      specs,
      features,
    };

    const btn = document.getElementById('save-product-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

    try {
      if (isEdit) {
        if (isSupabaseConfigured()) {
          await DB.updateProduct(id, data);
        } else {
          LocalDB.updateProduct(id, data);
        }
        Toast.success('Product updated successfully!');
      } else {
        if (isSupabaseConfigured()) {
          await DB.createProduct(data);
        } else {
          LocalDB.createProduct(data);
        }
        Toast.success('Product added successfully!');
      }

      this.closeModal('product-modal-backdrop');
      await this.renderProducts(this._productSearch, this._productPage);
    } catch (e) {
      console.error('[Admin] saveProduct failed:', e);
      Toast.error('Failed to save product: ' + (e.message || 'Unknown error'));
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = isEdit ? '💾 Update Product' : '💾 Save Product'; }
    }
  },

  async deleteProduct(id) {
    this.confirm('Delete this product? This action cannot be undone.', 'Delete Product', async () => {
      try {
        if (isSupabaseConfigured()) {
          await DB.deleteProduct(id);
        } else {
          LocalDB.deleteProduct(id);
        }
        Toast.success('Product deleted successfully!');
        await this.renderProducts(this._productSearch, this._productPage);
      } catch (e) {
        console.error('[Admin] deleteProduct failed:', e);
        Toast.error('Failed to delete product: ' + (e.message || 'Unknown error'));
      }
    });
  },

  // Image handlers
  handleImageUpload(input, previewEl) {
    const file = input.files && input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      document.getElementById('product-image-url').value = e.target.result;
      previewEl.src = e.target.result;
      previewEl.style.display = 'block';
      previewEl.classList.add('visible');
    };
    reader.readAsDataURL(file);
  },

  handleImageUrl(url) {
    const preview = document.getElementById('product-img-preview');
    if (!preview) return;
    if (url && url.startsWith('http')) {
      preview.src = url;
      preview.style.display = 'block';
      preview.classList.add('visible');
      preview.onerror = () => { preview.style.display = 'none'; };
    } else if (!url) {
      preview.style.display = 'none';
      preview.src = '';
    }
  },

  handleCategoryImageUrl(url) {
    const preview = document.getElementById('category-img-preview');
    if (!preview) return;
    const isUrl = isImageUrl(url);
    if (isUrl) {
      preview.src = url;
      preview.style.display = 'block';
      preview.classList.add('visible');
      preview.onerror = () => { preview.style.display = 'none'; };
    } else {
      preview.style.display = 'none';
      preview.src = '';
    }
  },

  // ══════════════════════════════════════════
  //  SECTION: CATEGORIES
  // ══════════════════════════════════════════

  async renderCategories() {
    const [categories, products] = await Promise.all([safeGetCategories(), safeGetProducts()]);

    // Count products per category
    const productCountMap = {};
    products.forEach(p => {
      const cid = p.categoryId || p.category;
      if (cid) productCountMap[cid] = (productCountMap[cid] || 0) + 1;
    });

    const grid = document.getElementById('categories-grid');
    if (!grid) return;

    grid.innerHTML = '';

    categories.forEach(cat => {
      const count = productCountMap[cat.id] || productCountMap[cat.slug] || 0;
      const card = document.createElement('div');
      card.className = 'category-card';
      card.style.borderTop = `3px solid ${cat.color || 'var(--red)'}`;
      
      const isImg = isImageUrl(cat.icon);
      const displayIcon = isImg 
        ? `<img src="${esc(cat.icon)}" alt="${esc(cat.name)}" style="width: 48px; height: 48px; object-fit: cover; border-radius: 50%;">` 
        : esc(cat.icon || '🗂️');

      card.innerHTML = `
        <div class="category-count">${count} product${count !== 1 ? 's' : ''}</div>
        <div class="category-card-icon" style="display: flex; align-items: center; justify-content: center; height: 48px; margin-bottom: 12px;">${displayIcon}</div>
        <div class="category-card-name">${esc(cat.name)}</div>
        <div class="category-card-slug">${esc(cat.slug || '')}</div>
        <div class="category-card-desc">${esc(cat.description || 'No description')}</div>
        <div class="category-card-actions">
          <button class="btn btn-secondary btn-sm" onclick="Admin.openCategoryModal('${esc(String(cat.id))}')">✏️ Edit</button>
          <button class="btn btn-danger btn-sm" onclick="Admin.deleteCategory('${esc(String(cat.id))}')">🗑️ Delete</button>
        </div>
      `;
      grid.appendChild(card);
    });

    // Add card
    const addCard = document.createElement('div');
    addCard.className = 'add-card';
    addCard.onclick = () => this.openCategoryModal();
    addCard.innerHTML = '<span style="font-size:24px;">➕</span><span>Add Category</span>';
    grid.appendChild(addCard);

    if (categories.length === 0) {
      // Remove the just-added add-card and put a message first
      grid.innerHTML = '';
      const empty = document.createElement('div');
      empty.style.cssText = 'grid-column:1/-1; text-align:center; padding:48px; color:var(--text-muted);';
      empty.innerHTML = '<div style="font-size:48px;margin-bottom:12px;">🗂️</div><div>No categories yet. Add your first one!</div>';
      grid.appendChild(empty);
      const addCardFull = document.createElement('div');
      addCardFull.className = 'add-card';
      addCardFull.onclick = () => this.openCategoryModal();
      addCardFull.innerHTML = '<span style="font-size:24px;">➕</span><span>Add Category</span>';
      grid.appendChild(addCardFull);
    }
  },

  async openCategoryModal(catId = null) {
    const isEdit = catId !== null;
    document.getElementById('category-modal-title').textContent = isEdit ? 'Edit Category' : 'Add Category';
    document.getElementById('category-form').reset();
    document.getElementById('category-id').value = '';
    const slugField = document.getElementById('category-slug');
    if (slugField) delete slugField.dataset.manually;

    this.handleCategoryImageUrl('');

    if (isEdit) {
      const categories = await safeGetCategories();
      const cat = categories.find(c => String(c.id) === String(catId));
      if (!cat) { Toast.error('Category not found'); return; }

      document.getElementById('category-id').value = cat.id;
      document.getElementById('category-name').value = cat.name || '';
      document.getElementById('category-slug').value = cat.slug || '';
      document.getElementById('category-desc').value = cat.description || '';
      document.getElementById('category-icon').value = cat.icon || '';
      document.getElementById('category-color').value = cat.color || '';
      
      this.handleCategoryImageUrl(cat.icon || '');
    }

    this.openModal('category-modal-backdrop');
  },

  async saveCategory() {
    const id = document.getElementById('category-id').value;
    const isEdit = !!id;

    const name = document.getElementById('category-name').value.trim();
    const slug = document.getElementById('category-slug').value.trim();
    const description = document.getElementById('category-desc').value.trim();
    const icon = document.getElementById('category-icon').value.trim();
    const color = document.getElementById('category-color').value.trim();

    if (!name) { Toast.error('Category name is required'); return; }
    if (!slug) { Toast.error('Category slug is required'); return; }

    const data = { name, slug, description, icon, color };

    try {
      if (isEdit) {
        let success = false;
        if (window.DB && typeof DB.updateCategory === 'function') {
          try { await DB.updateCategory(id, data); success = true; } catch (e) {}
        }
        if (!success) LocalDB.updateCategory(id, data);
        Toast.success('Category updated!');
      } else {
        let success = false;
        if (window.DB && typeof DB.createCategory === 'function') {
          try { await DB.createCategory(data); success = true; } catch (e) {}
        }
        if (!success) LocalDB.createCategory(data);
        Toast.success('Category added!');
      }

      this.closeModal('category-modal-backdrop');
      await this.renderCategories();
    } catch (e) {
      Toast.error('Failed to save category: ' + (e.message || 'Error'));
    }
  },

  async deleteCategory(id) {
    this.confirm('Delete this category? Products in this category will be unassigned.', 'Delete Category', async () => {
      try {
        let success = false;
        if (window.DB && typeof DB.deleteCategory === 'function') {
          try { await DB.deleteCategory(id); success = true; } catch (e) {}
        }
        if (!success) LocalDB.deleteCategory(id);
        Toast.success('Category deleted');
        await this.renderCategories();
      } catch (e) {
        Toast.error('Failed to delete category');
      }
    });
  },

  // ══════════════════════════════════════════
  //  SECTION: ORDERS
  // ══════════════════════════════════════════

  async renderOrders(statusFilter = 'all', searchQuery = '') {
    let orders = await safeGetOrders();

    // Filter by status
    if (statusFilter && statusFilter !== 'all') {
      orders = orders.filter(o => (o.status || 'pending') === statusFilter);
    }

    // Filter by search
    const q = (searchQuery || '').toLowerCase().trim();
    if (q) {
      orders = orders.filter(o =>
        (o.orderNumber || '').toLowerCase().includes(q) ||
        (o.customerName || o.name || '').toLowerCase().includes(q) ||
        (o.customerEmail || o.email || '').toLowerCase().includes(q) ||
        String(o.id).toLowerCase().includes(q)
      );
    }

    // Sort newest first
    orders.sort((a, b) => new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0));

    // Update count label
    const countLabel = document.getElementById('orders-count-label');
    if (countLabel) countLabel.textContent = `${orders.length} order${orders.length !== 1 ? 's' : ''} found`;

    // Pagination
    const pageSize = this._orderPageSize;
    const totalPages = Math.max(1, Math.ceil(orders.length / pageSize));
    const currentPage = Math.min(this._orderPage, totalPages);
    this._orderPage = currentPage;
    const paginated = orders.slice((currentPage - 1) * pageSize, currentPage * pageSize);

    const tbody = document.getElementById('orders-tbody');
    if (!tbody) return;

    if (paginated.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="table-empty"><div class="empty-icon">📋</div><div>No orders found</div></div></td></tr>`;
    } else {
      tbody.innerHTML = paginated.map(o => {
        const itemCount = (o.items || o.cartItems || []).length;
        const total = o.total || o.totalAmount || 0;
        const payment = o.paymentMethod || o.payment || 'COD';
        const date = formatDate(o.createdAt || o.date);
        const orderNum = o.orderNumber || String(o.id).slice(-8).toUpperCase();
        const customer = o.customerName || o.name || 'Unknown';

        return `
          <tr>
            <td><strong>#${esc(orderNum)}</strong></td>
            <td>
              <div style="font-weight:600;">${esc(customer)}</div>
              <div style="font-size:11px; color:var(--text-muted);">${esc(o.customerPhone || o.phone || '')}</div>
            </td>
            <td>
              <span style="background:var(--surface); padding:2px 8px; border-radius:12px; font-size:12px;">${itemCount} item${itemCount !== 1 ? 's' : ''}</span>
            </td>
            <td><strong style="color:var(--red);">${formatCurrency(total)}</strong></td>
            <td><span style="font-size:12px; color:var(--text-muted);">${esc(payment)}</span></td>
            <td>${getStatusBadge(o.status)}</td>
            <td style="font-size:12px; color:var(--text-muted);">${date}</td>
            <td>
              <div style="display:flex; gap:6px; flex-wrap:wrap;">
                <button class="btn btn-secondary btn-sm" onclick="Admin.openOrderModal('${esc(String(o.id))}')">👁️ View</button>
                <button class="btn btn-warning btn-sm" onclick="Admin.sendWhatsAppUpdate(${esc(JSON.stringify({
                  orderNumber: orderNum,
                  customerName: customer,
                  customerPhone: o.customerPhone || o.phone || '',
                  status: o.status || 'pending'
                }))})">💬</button>
              </div>
            </td>
          </tr>
        `;
      }).join('');
    }

    this.renderPagination('orders-pagination', currentPage, totalPages, 'Admin.goToOrderPage');
  },

  goToOrderPage(pg) {
    this._orderPage = pg;
    const statusFilter = (document.getElementById('orders-status-filter') || {}).value || 'all';
    const searchQuery = (document.getElementById('orders-search') || {}).value || '';
    this.renderOrders(statusFilter, searchQuery);
  },

  async openOrderModal(orderId) {
    const orders = await safeGetOrders();
    const order = orders.find(o => String(o.id) === String(orderId));
    if (!order) { Toast.error('Order not found'); return; }

    const orderNum = order.orderNumber || String(order.id).slice(-8).toUpperCase();
    document.getElementById('order-modal-title').textContent = `Order #${orderNum}`;

    const items = order.items || order.cartItems || [];
    const total = order.total || order.totalAmount || 0;

    const body = document.getElementById('order-modal-body');
    body.innerHTML = `
      <div class="order-detail-grid">
        <div class="order-detail-section">
          <div class="order-detail-label">Customer</div>
          <div class="order-detail-value">
            <strong>${esc(order.customerName || order.name || 'Unknown')}</strong><br>
            ${esc(order.customerEmail || order.email || '')}${(order.customerPhone || order.phone) ? `<br>${esc(order.customerPhone || order.phone)}` : ''}
          </div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Delivery Address</div>
          <div class="order-detail-value">${esc(order.address || order.deliveryAddress || 'Not provided')}</div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Payment</div>
          <div class="order-detail-value">
            Method: <strong>${esc(order.paymentMethod || order.payment || 'COD')}</strong><br>
            Status: ${getStatusBadge(order.paymentStatus || (order.paymentMethod === 'UPI' ? 'paid' : 'pending'))}
          </div>
        </div>
        <div class="order-detail-section">
          <div class="order-detail-label">Order Status</div>
          <div class="order-detail-value" style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
            ${getStatusBadge(order.status)}
            <select class="filter-select" id="order-status-select" style="flex:1; min-width:120px;">
              ${['pending','confirmed','shipped','delivered','cancelled'].map(s =>
                `<option value="${s}" ${(order.status || 'pending') === s ? 'selected' : ''}>${s.charAt(0).toUpperCase() + s.slice(1)}</option>`
              ).join('')}
            </select>
          </div>
        </div>
      </div>

      <div>
        <div class="order-detail-label">Order Items</div>
        <div class="order-items-list">
          ${items.length > 0 ? items.map(item => `
            <div class="order-item-row">
              <div>
                <div class="order-item-name">${esc(item.name || item.productName || 'Product')}</div>
                <div class="order-item-qty">Qty: ${item.quantity || item.qty || 1} × ${formatCurrency(item.price)}</div>
              </div>
              <div class="order-item-price">${formatCurrency((item.price || 0) * (item.quantity || item.qty || 1))}</div>
            </div>
          `).join('') : '<div style="color:var(--text-muted); padding:12px 0;">No items recorded</div>'}
          <div class="order-total-row">
            <span>Total</span>
            <span style="color:var(--red);">${formatCurrency(total)}</span>
          </div>
        </div>
      </div>

      ${order.notes ? `
        <div style="margin-top:16px;">
          <div class="order-detail-label">Notes</div>
          <div style="font-size:13px; color:var(--text-muted); padding:10px; background:var(--surface); border-radius:8px;">${esc(order.notes)}</div>
        </div>
      ` : ''}

      <div style="margin-top:12px; font-size:11px; color:var(--text-dim);">
        Ordered: ${formatDateTime(order.createdAt || order.date)} 
        ${order.updatedAt ? `· Updated: ${formatDateTime(order.updatedAt)}` : ''}
      </div>
    `;

    const footer = document.getElementById('order-modal-footer');
    const phone = order.customerPhone || order.phone || '';
    footer.innerHTML = `
      <button class="btn btn-secondary" onclick="Admin.closeModal('order-modal-backdrop')">Close</button>
      ${phone ? `<button class="btn btn-success" onclick="Admin.sendWhatsAppUpdate({
        orderNumber: '${esc(orderNum)}',
        customerName: '${esc(order.customerName || order.name || '')}',
        customerPhone: '${esc(phone)}',
        status: document.getElementById('order-status-select').value
      })">💬 WhatsApp Update</button>` : ''}
      <button class="btn btn-primary" onclick="Admin.updateOrderStatus('${esc(String(order.id))}', document.getElementById('order-status-select').value)">
        ✅ Update Status
      </button>
    `;

    this.openModal('order-modal-backdrop');
  },

  async updateOrderStatus(orderId, status) {
    try {
      let success = false;
      if (window.DB && typeof DB.updateOrder === 'function') {
        try { await DB.updateOrder(orderId, { status }); success = true; } catch (e) {}
      }
      if (!success) LocalDB.updateOrder(orderId, { status });

      Toast.success(`Order status updated to: ${status}`);
      this.closeModal('order-modal-backdrop');
      await this.renderOrders(
        (document.getElementById('orders-status-filter') || {}).value || 'all',
        (document.getElementById('orders-search') || {}).value || ''
      );
    } catch (e) {
      Toast.error('Failed to update order status');
    }
  },

  sendWhatsAppUpdate(order) {
    if (typeof order === 'string') {
      try { order = JSON.parse(order); } catch (e) { return; }
    }
    const phone = String(order.customerPhone || '').replace(/\D/g, '');
    if (!phone) { Toast.warning('No phone number for this customer'); return; }

    const status = order.status || 'updated';
    const statusEmoji = { pending:'⏳', confirmed:'✅', shipped:'🚚', delivered:'📦', cancelled:'❌' }[status] || '📬';

    const msg = encodeURIComponent(
      `Hi ${order.customerName || 'Customer'}! ${statusEmoji}\n\n` +
      `Your Epic Toyz order #${order.orderNumber} status has been updated to: *${status.toUpperCase()}*.\n\n` +
      `Thank you for shopping with us! 🏎️\n\n` +
      `For any queries, contact us at epictoyz.in@gmail.com`
    );
    window.open(`https://wa.me/91${phone}?text=${msg}`, '_blank');
  },

  // ══════════════════════════════════════════
  //  SECTION: REVIEWS
  // ══════════════════════════════════════════

  async renderReviews() {
    const [reviews, products] = await Promise.all([safeGetReviews(), safeGetProducts()]);
    const prodMap = {};
    products.forEach(p => { prodMap[p.id] = p; });

    const container = document.getElementById('reviews-list');
    if (!container) return;

    if (reviews.length === 0) {
      container.innerHTML = '<div class="table-empty"><div class="empty-icon">⭐</div><div>No reviews yet</div></div>';
      return;
    }

    // Sort: pending first, then by date
    const sorted = [...reviews].sort((a, b) => {
      if (a.approved && !b.approved) return 1;
      if (!a.approved && b.approved) return -1;
      return new Date(b.createdAt || b.date || 0) - new Date(a.createdAt || a.date || 0);
    });

    container.innerHTML = sorted.map(r => {
      const product = prodMap[r.productId] || {};
      const rating = Number(r.rating) || 5;
      const stars = Array.from({ length: 5 }, (_, i) =>
        `<span class="${i < rating ? 'filled' : 'empty'}">★</span>`
      ).join('');

      return `
        <div class="review-card">
          <div class="review-header">
            <div class="review-meta">
              <div class="review-product">📦 ${esc(product.name || r.productName || `Product #${r.productId}`)}</div>
              <div class="review-author">${esc(r.userName || r.name || r.author || 'Anonymous')}</div>
              <div class="review-date">${formatDateTime(r.createdAt || r.date)}</div>
            </div>
            <div>
              <div class="review-stars">${stars}</div>
              <div style="text-align:right; margin-top:4px;">
                ${r.approved
                  ? '<span class="status-badge status-approved">✅ Approved</span>'
                  : '<span class="status-badge status-pending">⏳ Pending</span>'
                }
              </div>
            </div>
          </div>
          <div class="review-text">${esc(r.comment || r.text || r.review || '')}</div>
          <div class="review-actions">
            ${!r.approved ? `<button class="btn btn-success btn-sm" onclick="Admin.approveReview('${esc(String(r.id))}')">✅ Approve</button>` : ''}
            <button class="btn btn-danger btn-sm" onclick="Admin.deleteReview('${esc(String(r.id))}')">🗑️ Delete</button>
          </div>
        </div>
      `;
    }).join('');
  },

  async approveReview(id) {
    try {
      let success = false;
      if (window.DB && typeof DB.approveReview === 'function') {
        try { await DB.approveReview(id); success = true; } catch (e) {}
      }
      if (!success) {
        if (window.DB && typeof DB.updateReview === 'function') {
          try { await DB.updateReview(id, { approved: true }); success = true; } catch (e) {}
        }
      }
      if (!success) LocalDB.approveReview(id);
      Toast.success('Review approved!');
      await this.renderReviews();
    } catch (e) {
      Toast.error('Failed to approve review');
    }
  },

  async deleteReview(id) {
    this.confirm('Delete this review? This cannot be undone.', 'Delete Review', async () => {
      try {
        let success = false;
        if (window.DB && typeof DB.deleteReview === 'function') {
          try { await DB.deleteReview(id); success = true; } catch (e) {}
        }
        if (!success) LocalDB.deleteReview(id);
        Toast.success('Review deleted');
        await this.renderReviews();
      } catch (e) {
        Toast.error('Failed to delete review');
      }
    });
  },

  // ══════════════════════════════════════════
  //  SECTION: INVENTORY
  // ══════════════════════════════════════════

  async renderInventory() {
    const products = await safeGetProducts();
    this._inventoryChanges = {};

    const tbody = document.getElementById('inventory-tbody');
    if (!tbody) return;

    if (products.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5"><div class="table-empty"><div class="empty-icon">📊</div><div>No products found</div></div></td></tr>`;
      return;
    }

    // Sort: low stock first
    const sorted = [...products].sort((a, b) => {
      return (Number(a.stock || a.stockQuantity || 0)) - (Number(b.stock || b.stockQuantity || 0));
    });

    tbody.innerHTML = sorted.map(p => {
      const stock = Number(p.stock || p.stockQuantity || 0);
      const maxStock = 50; // Reference max for bar
      const barPct = Math.min(100, Math.round((stock / maxStock) * 100));
      const barClass = stock === 0 ? 'low' : stock < 5 ? 'low' : stock < 15 ? 'medium' : 'high';
      const rowStyle = stock < 5 ? 'background: rgba(231,76,60,0.04);' : '';

      const imgHtml = p.image
        ? `<img src="${esc(p.image)}" style="width:32px;height:32px;border-radius:6px;object-fit:cover;" onerror="this.style.display='none'"> `
        : '📦 ';

      return `
        <tr data-product-id="${esc(String(p.id))}" style="${rowStyle}">
          <td>
            <div style="display:flex; align-items:center; gap:8px;">
              <span>${imgHtml}</span>
              <div>
                <div style="font-weight:600; font-size:13px;">${esc(p.name)}</div>
                <div style="font-size:11px; color:var(--text-dim);">#${esc(String(p.id).slice(-8))}</div>
              </div>
            </div>
          </td>
          <td>
            <input type="number" class="stock-input" value="${stock}" min="0"
              data-original="${stock}"
              onchange="Admin.markStockChanged('${esc(String(p.id))}', this.value, this)"
              oninput="Admin.markStockChanged('${esc(String(p.id))}', this.value, this)">
          </td>
          <td>
            <div class="stock-bar-wrap">
              <div class="stock-bar ${barClass}" style="width:${barPct}%;"></div>
            </div>
            <span style="font-size:11px; color:var(--text-muted); margin-left:6px;">${barPct}%</span>
          </td>
          <td>
            ${stock === 0
              ? '<span class="status-badge status-outofstock">Out of Stock</span>'
              : stock < 5
                ? `<span class="status-badge status-low">⚠️ Low Stock</span>`
                : `<span class="status-badge status-ok">✅ Sufficient</span>`
            }
          </td>
          <td>
            <button class="btn btn-primary btn-sm" onclick="Admin.updateStock('${esc(String(p.id))}', document.querySelector('[data-product-id=\\'${esc(String(p.id))}\\'] .stock-input').value)">
              💾 Update
            </button>
          </td>
        </tr>
      `;
    }).join('');
  },

  markStockChanged(productId, value, inputEl) {
    this._inventoryChanges[productId] = parseInt(value, 10);
    const original = parseInt(inputEl.dataset.original || '0', 10);
    inputEl.style.borderColor = parseInt(value, 10) !== original ? 'var(--warning)' : 'var(--border)';
  },

  async updateStock(productId, qty) {
    const stock = parseInt(qty, 10);
    if (isNaN(stock) || stock < 0) { Toast.error('Invalid stock quantity'); return; }

    try {
      let success = false;
      if (window.DB && typeof DB.updateProduct === 'function') {
        try { await DB.updateProduct(productId, { stock, stockQuantity: stock }); success = true; } catch (e) {}
      }
      if (!success) LocalDB.updateProduct(productId, { stock, stockQuantity: stock });

      // Update input visual
      const input = document.querySelector(`[data-product-id="${CSS.escape(productId)}"] .stock-input`);
      if (input) {
        input.dataset.original = stock;
        input.style.borderColor = 'var(--success)';
        setTimeout(() => { input.style.borderColor = 'var(--border)'; }, 1500);
      }

      Toast.success('Stock updated!');
      delete this._inventoryChanges[productId];
    } catch (e) {
      Toast.error('Failed to update stock');
    }
  },

  async updateAllStock() {
    const changes = this._inventoryChanges;
    if (Object.keys(changes).length === 0) {
      Toast.info('No pending stock changes');
      return;
    }

    const btn = document.getElementById('update-all-btn');
    if (btn) { btn.disabled = true; btn.textContent = '⏳ Saving...'; }

    let successCount = 0;
    for (const [productId, stock] of Object.entries(changes)) {
      try {
        let success = false;
        if (window.DB && typeof DB.updateProduct === 'function') {
          try { await DB.updateProduct(productId, { stock, stockQuantity: stock }); success = true; } catch (e) {}
        }
        if (!success) LocalDB.updateProduct(productId, { stock, stockQuantity: stock });
        successCount++;
      } catch (e) { console.warn(`Failed to update stock for ${productId}`, e); }
    }

    if (btn) { btn.disabled = false; btn.textContent = '💾 Save All Changes'; }

    Toast.success(`Updated ${successCount} product${successCount !== 1 ? 's' : ''} successfully!`);
    this._inventoryChanges = {};
    await this.renderInventory();
  },

  // ══════════════════════════════════════════
  //  PAGINATION UTILITY
  // ══════════════════════════════════════════

  renderPagination(containerId, currentPage, totalPages, onPageClick) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (totalPages <= 1) {
      container.innerHTML = '';
      return;
    }

    let html = `<span class="pagination-info">Page ${currentPage} of ${totalPages}</span>`;

    const getClickAction = (pg) => {
      if (typeof onPageClick === 'string') {
        return `${onPageClick}(${pg})`;
      } else {
        return `(${onPageClick.toString()})(${pg})`;
      }
    };

    // Prev
    html += `<button class="pagination-btn" ${currentPage === 1 ? 'disabled style="opacity:0.4;"' : ''} onclick="${getClickAction(currentPage - 1)}">‹</button>`;

    // Pages
    let start = Math.max(1, currentPage - 2);
    let end = Math.min(totalPages, currentPage + 2);
    if (start > 1) html += `<button class="pagination-btn" onclick="${getClickAction(1)}">1</button>${start > 2 ? '<span style="color:var(--text-muted);padding:0 4px;">…</span>' : ''}`;
    for (let i = start; i <= end; i++) {
      html += `<button class="pagination-btn ${i === currentPage ? 'active' : ''}" onclick="${getClickAction(i)}">${i}</button>`;
    }
    if (end < totalPages) html += `${end < totalPages - 1 ? '<span style="color:var(--text-muted);padding:0 4px;">…</span>' : ''}<button class="pagination-btn" onclick="${getClickAction(totalPages)}">${totalPages}</button>`;

    // Next
    html += `<button class="pagination-btn" ${currentPage === totalPages ? 'disabled style="opacity:0.4;"' : ''} onclick="${getClickAction(currentPage + 1)}">›</button>`;

    container.innerHTML = html;
  },
};

window.Admin = Admin;

// ─────────────────────────────────────────────────────────
//  LOGIN PAGE LOGIC
// ─────────────────────────────────────────────────────────

const ADMIN_EMAIL = 'epictoyz.in@gmail.com';
const ADMIN_PASSWORD = 'yogesh123*';
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8 hours

function initAdminLogin() {
  console.log('[Login] initAdminLogin() starting...');

  // Check if already logged in → redirect to dashboard
  // But prevent redirect loops: if we just came from dashboard, don't redirect back
  const cameFromDashboard = document.referrer && document.referrer.includes('dashboard');

  if (!cameFromDashboard) {
    // Check et_admin_session
    const session = localStorage.getItem('et_admin_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        if (parsed.email && parsed.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() && Date.now() < parsed.expires) {
          console.log('[Login] Valid et_admin_session found — redirecting to dashboard');
          window.location.href = 'dashboard.html';
          return;
        }
      } catch (e) {
        console.warn('[Login] Error parsing et_admin_session:', e.message);
      }
      localStorage.removeItem('et_admin_session');
    }

    // Check Auth module session
    if (window.Auth && typeof Auth.getCurrentUser === 'function') {
      try {
        const user = Auth.getCurrentUser();
        if (user) {
          console.log('[Login] Auth module found existing user:', user.email);
          if (typeof Auth.isAdmin === 'function' && Auth.isAdmin(user.email)) {
            console.log('[Login] User is admin — redirecting to dashboard');
            window.location.href = 'dashboard.html';
            return;
          } else {
            console.log('[Login] User is not admin — redirecting to home');
            window.location.href = '../index.html';
            return;
          }
        }
      } catch (e) {
        console.warn('[Login] Error checking Auth module:', e.message);
      }
    }
  } else {
    console.log('[Login] Came from dashboard — skipping auto-redirect to prevent loop');
  }

  // Hide loader, show form
  console.log('[Login] Showing login form');
  const loader = document.getElementById('loading-overlay');
  const container = document.getElementById('login-container');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => { loader.style.display = 'none'; }, 400);
  }
  if (container) container.style.display = 'block';

  // Bind login form submit
  const loginForm = document.getElementById('admin-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      console.log('[Login] Form submitted');

      const emailInput = document.getElementById('admin-email');
      const passwordInput = document.getElementById('admin-password');
      const btn = document.getElementById('login-btn');
      const errorEl = document.getElementById('login-error');
      const errorText = document.getElementById('login-error-text');

      const email = emailInput.value.trim();
      const password = passwordInput.value;

      // Hide error
      if (errorEl) {
        errorEl.classList.remove('visible');
        errorEl.classList.add('hidden');
      }

      // Disable button, show spinner
      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-spinner"></span> Signing in...';
      }

      // Brief loading indicator
      await new Promise(r => setTimeout(r, 500));

      let isAdminUser = false;
      let loginOk = false;
      let loginError = null;

      // ── Try Auth module login ──
      try {
        if (window.Auth && typeof Auth.login === 'function') {
          console.log('[Login] Calling Auth.login()...');
          const result = await Auth.login(email, password);
          console.log('[Login] Auth.login() result:', result.user ? 'success' : 'failed', result.error || '');
          if (result && result.user) {
            loginOk = true;
            isAdminUser = (typeof Auth.isAdmin === 'function') ? Auth.isAdmin(email) : false;
            console.log('[Login] Auth.login succeeded, isAdmin:', isAdminUser);
          } else {
            loginError = result?.error || 'Login failed.';
          }
        }
      } catch (authErr) {
        console.warn('[Login] Auth.login() threw:', authErr.message);
        loginError = authErr.message;
      }

      // ── Fallback: local credential check ──
      if (!loginOk) {
        console.log('[Login] Trying direct credential check...');
        const normalEmail = email.toLowerCase();
        if (normalEmail === ADMIN_EMAIL.toLowerCase() && password === ADMIN_PASSWORD) {
          loginOk = true;
          isAdminUser = true;
          loginError = null;
          console.log('[Login] ✅ Direct credential match succeeded');

          // CRITICAL: also store in Auth module's session to prevent redirect loop
          if (window.Auth && typeof Auth._storeSession === 'function') {
            Auth._storeSession({
              id: 'admin-001',
              email: ADMIN_EMAIL,
              name: 'Admin',
              role: 'admin',
              createdAt: new Date().toISOString(),
            }, 'local-admin-token');
            console.log('[Login] Synced session to Auth module (et_session)');
          }
        }
      }

      // ── Handle result ──
      if (loginOk) {
        console.log('[Login] ✅ Login successful! isAdmin:', isAdminUser);

        // Always store et_admin_session for admin users
        if (isAdminUser) {
          const sessionData = {
            email: email.toLowerCase(),
            expires: Date.now() + SESSION_DURATION_MS,
            loginTime: new Date().toISOString(),
          };
          localStorage.setItem('et_admin_session', JSON.stringify(sessionData));
          localStorage.setItem('et_admin_email', email.toLowerCase());
          console.log('[Login] Stored et_admin_session and et_admin_email');

          if (btn) btn.innerHTML = '✅ Redirecting to dashboard...';
          console.log('[Login] Redirecting to dashboard.html...');
          setTimeout(() => { window.location.href = 'dashboard.html'; }, 400);
        } else {
          if (btn) btn.innerHTML = '✅ Redirecting...';
          console.log('[Login] Non-admin user — redirecting to home');
          setTimeout(() => { window.location.href = '../index.html'; }, 400);
        }
      } else {
        // Show error
        console.warn('[Login] ❌ Login failed:', loginError);
        const msg = loginError || 'Invalid email or password. Please try again.';
        if (errorText) errorText.textContent = msg;
        if (errorEl) {
          errorEl.classList.remove('hidden');
          errorEl.classList.add('visible');
        }

        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Sign In';
        }
        // Shake animation
        const card = document.querySelector('.login-card');
        if (card) {
          card.style.animation = 'shake 0.4s ease';
          setTimeout(() => { card.style.animation = ''; }, 400);
        }
      }
    });
  }

  // Bind register form submit
  const registerForm = document.getElementById('register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async function(e) {
      e.preventDefault();

      const nameInput = document.getElementById('register-name');
      const emailInput = document.getElementById('register-email');
      const phoneInput = document.getElementById('register-phone');
      const passwordInput = document.getElementById('register-password');
      const confirmInput = document.getElementById('register-confirm-password');
      const btn = document.getElementById('register-btn');
      const errorEl = document.getElementById('register-error');
      const errorText = document.getElementById('register-error-text');

      const name = nameInput.value.trim();
      const email = emailInput.value.trim();
      const phone = phoneInput.value.trim();
      const password = passwordInput.value;
      const confirm = confirmInput.value;

      if (errorEl) errorEl.classList.add('hidden');

      if (password !== confirm) {
        if (errorText) errorText.textContent = 'Passwords do not match.';
        if (errorEl) errorEl.classList.remove('hidden');
        // Shake card
        const card = document.querySelector('.login-card');
        if (card) {
          card.style.animation = 'shake 0.4s ease';
          setTimeout(() => { card.style.animation = ''; }, 400);
        }
        return;
      }

      if (btn) {
        btn.disabled = true;
        btn.innerHTML = '<span class="btn-spinner"></span> Creating account...';
      }

      // Simulate loading
      await new Promise(r => setTimeout(r, 600));

      try {
        if (window.Auth && typeof Auth.register === 'function') {
          const result = await Auth.register(email, password, { name, phone });
          if (result && result.user) {
            if (btn) btn.innerHTML = '✅ Redirecting...';
            setTimeout(() => { window.location.href = '../index.html'; }, 400);
          } else {
            throw new Error(result.error || 'Registration failed.');
          }
        } else {
          throw new Error('Auth module is unavailable.');
        }
      } catch (err) {
        if (errorText) errorText.textContent = err.message || 'Registration failed.';
        if (errorEl) errorEl.classList.remove('hidden');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = 'Create Account';
        }
        // Shake card
        const card = document.querySelector('.login-card');
        if (card) {
          card.style.animation = 'shake 0.4s ease';
          setTimeout(() => { card.style.animation = ''; }, 400);
        }
      }
    });
  }
}

// ─────────────────────────────────────────────────────────
//  AUTO-INIT
// ─────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  const path = window.location.pathname;
  console.log('[Admin] DOMContentLoaded — pathname:', path);

  if (path.includes('dashboard')) {
    console.log('[Admin] Detected dashboard page — calling Admin.init()');
    Admin.init();
  } else if (path.includes('login')) {
    console.log('[Admin] Detected login page — calling initAdminLogin()');
    initAdminLogin();
  } else {
    console.log('[Admin] admin.js loaded on non-admin page — no init needed');
  }
});

// Shake animation style
(function() {
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-6px); }
      80% { transform: translateX(6px); }
    }
  `;
  document.head.appendChild(style);
})();
