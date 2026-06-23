/**
 * cart.js — Epic Toyz Shopping Cart Page Logic
 * Handles rendering, qty updates, removal, summary, and suggested products.
 */

'use strict';

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCartPage();
});

async function initCartPage() {
  renderCartItems();
  renderOrderSummary();
  await loadSuggestedProducts();
  initCartEventListeners();
}

/* ============================================================
   RENDER CART ITEMS
   ============================================================ */
function renderCartItems() {
  const cart = Store.getCart();
  const container = document.getElementById('cart-items-container');
  const headerCount = document.getElementById('cart-header-count');

  if (!container) return;

  const total = cart.reduce((sum, i) => sum + i.quantity, 0);
  if (headerCount) {
    headerCount.textContent = total === 1 ? '1 item' : `${total} items`;
  }

  if (cart.length === 0) {
    showEmptyCart();
    return;
  }

  container.innerHTML = cart.map((item, idx) => renderCartItem(item, idx)).join('');
}

function renderCartItem(item, idx) {
  const lineTotal = (item.price * item.quantity).toLocaleString('en-IN');
  const unitPrice = item.price.toLocaleString('en-IN');
  const imgSrc = item.image || 'assets/images/placeholder.svg';
  const delay = idx * 60;

  return `
    <div class="cart-item" data-id="${item.id}" style="animation-delay:${delay}ms">
      <img
        class="cart-item-img"
        src="${imgSrc}"
        alt="${escapeHtml(item.name)}"
        onerror="this.src='assets/images/placeholder.svg'"
      >
      <div class="cart-item-details">
        <h4>${escapeHtml(item.name)}</h4>
        <span class="item-category">${escapeHtml(item.category || 'RC Car')}</span>
        <p class="item-unit-price">₹${unitPrice} each</p>
      </div>
      <div class="qty-control">
        <button class="qty-btn" onclick="updateQty('${item.id}', ${item.quantity - 1})" aria-label="Decrease quantity" title="Decrease">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <span class="qty-display">${item.quantity}</span>
        <button class="qty-btn" onclick="updateQty('${item.id}', ${item.quantity + 1})" aria-label="Increase quantity" title="Increase">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
      </div>
      <div class="cart-item-price">₹${lineTotal}</div>
      <button class="btn-remove" onclick="removeItem('${item.id}')" aria-label="Remove ${escapeHtml(item.name)}" title="Remove item">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <polyline points="3 6 5 6 21 6"/>
          <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
          <path d="M10 11v6"/>
          <path d="M14 11v6"/>
          <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
        </svg>
      </button>
    </div>
  `;
}

/* ============================================================
   QTY / REMOVE
   ============================================================ */
function updateQty(productId, qty) {
  if (qty < 1) {
    removeItem(productId);
    return;
  }
  Store.updateQuantity(productId, qty);
  renderCartItems();
  renderOrderSummary();
  // Update global cart badge if ui.js exposes it
  if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();
}

function removeItem(productId) {
  // Animate out
  const el = document.querySelector(`.cart-item[data-id="${productId}"]`);
  if (el) {
    el.style.transition = 'opacity 0.25s, transform 0.25s';
    el.style.opacity = '0';
    el.style.transform = 'translateX(30px)';
    setTimeout(() => {
      Store.removeFromCart(productId);
      renderCartItems();
      renderOrderSummary();
      if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();
    }, 260);
  } else {
    Store.removeFromCart(productId);
    renderCartItems();
    renderOrderSummary();
    if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();
  }
}

/* ============================================================
   ORDER SUMMARY
   ============================================================ */
function renderOrderSummary() {
  const cart = Store.getCart();
  const container = document.getElementById('summary-content');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = `<p style="color:var(--text-muted,#ADB5BD); font-size:0.9rem; text-align:center; padding:20px 0;">Add items to see summary</p>`;
    return;
  }

  const subtotal = cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const shipping = 50;
  const total = subtotal + shipping;

  const subtotalFmt = subtotal.toLocaleString('en-IN');
  const totalFmt = total.toLocaleString('en-IN');

  const promoHTML = `<div class="shipping-promo">🚚 Flat Delivery Charge of ₹50 applies to all orders</div>`;

  container.innerHTML = `
    ${promoHTML}
    <div class="summary-row">
      <span class="label">Subtotal (${cart.reduce((s,i)=>s+i.quantity,0)} items)</span>
      <span class="value">₹${subtotalFmt}</span>
    </div>
    <div class="summary-row">
      <span class="label">Shipping</span>
      <span class="value">₹50</span>
    </div>
    <hr class="summary-divider">
    <div class="summary-total">
      <span class="total-label">Total</span>
      <span class="total-value">₹${totalFmt}</span>
    </div>
    <a href="checkout.html" class="btn-checkout">
      Proceed to Checkout
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:6px; vertical-align:middle">
        <line x1="5" y1="12" x2="19" y2="12"/>
        <polyline points="12 5 19 12 12 19"/>
      </svg>
    </a>
    <a href="shop.html" class="btn-continue">Continue Shopping</a>
    <div class="trust-badges">
      <div class="trust-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2ecc71" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
        <span>Secure Checkout — SSL Encrypted</span>
      </div>
      <div class="trust-badge">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#25D366" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        <a href="https://wa.me/916383793890" target="_blank" rel="noopener" style="color:inherit; text-decoration:none;">WhatsApp Support</a>
      </div>
    </div>
  `;
}

/* ============================================================
   EMPTY CART STATE
   ============================================================ */
function showEmptyCart() {
  const container = document.getElementById('cart-items-container');
  const summaryContent = document.getElementById('summary-content');

  if (container) {
    container.innerHTML = `
      <div class="empty-cart">
        <span class="empty-cart-illustration">🛒</span>
        <h2>Your cart is empty</h2>
        <p>Looks like you haven't added any RC cars yet.<br>Explore our collection and find your perfect ride!</p>
        <a href="shop.html" class="btn-checkout" style="display:inline-block; width:auto; padding:14px 32px; text-decoration:none;">
          Shop Now
        </a>
      </div>
    `;
  }

  if (summaryContent) {
    summaryContent.innerHTML = `<p style="color:var(--text-muted,#ADB5BD); font-size:0.9rem; text-align:center; padding:20px 0;">Your cart is empty</p>`;
  }

  const header = document.querySelector('.cart-items-header');
  if (header) header.style.display = 'none';

  const headerCount = document.getElementById('cart-header-count');
  if (headerCount) headerCount.textContent = '0 items';
}

/* ============================================================
   SUGGESTED / RELATED PRODUCTS
   ============================================================ */
async function loadSuggestedProducts() {
  const suggestedGrid = document.getElementById('suggested-products');
  if (!suggestedGrid) return;

  try {
    let products = [];

    // Try to get products from DB or data.js
    if (typeof DB !== 'undefined' && DB.getProducts) {
      products = await DB.getProducts({ limit: 12 });
    } else if (typeof PRODUCTS !== 'undefined') {
      products = PRODUCTS.slice(0, 12);
    }

    if (!products || products.length === 0) {
      suggestedGrid.closest('.suggested-section').style.display = 'none';
      return;
    }

    // Filter out items already in cart
    const cart = Store.getCart();
    const cartIds = new Set(cart.map(i => String(i.id)));

    // Prefer products from same category as cart items
    const cartCategories = new Set(cart.map(i => i.category));
    let filtered = products.filter(p => !cartIds.has(String(p.id)));

    let suggested = [];
    if (cartCategories.size > 0) {
      const sameCat = filtered.filter(p => cartCategories.has(p.category));
      suggested = sameCat.slice(0, 4);
      if (suggested.length < 4) {
        const rest = filtered.filter(p => !cartCategories.has(p.category));
        suggested = [...suggested, ...rest].slice(0, 4);
      }
    } else {
      suggested = filtered.slice(0, 4);
    }

    if (suggested.length === 0) {
      suggestedGrid.closest('.suggested-section').style.display = 'none';
      return;
    }

    suggestedGrid.innerHTML = suggested.map(p => renderSuggestedCard(p)).join('');
  } catch (err) {
    console.warn('Could not load suggested products:', err);
    suggestedGrid.closest('.suggested-section').style.display = 'none';
  }
}

function renderSuggestedCard(product) {
  const price = (product.price || 0).toLocaleString('en-IN');
  const originalPrice = product.original_price || product.originalPrice;
  const img = product.image || product.images?.[0] || 'assets/images/placeholder.svg';
  const rating = product.rating || 4.5;
  const stars = renderStars(rating);
  const discount = originalPrice && originalPrice > product.price
    ? Math.round((1 - product.price / originalPrice) * 100)
    : null;

  return `
    <div class="product-card" style="background:var(--card-bg,#12151F); border-radius:12px; overflow:hidden; border:1px solid rgba(255,255,255,0.07); transition:transform 0.2s, box-shadow 0.2s; cursor:pointer;"
         onmouseenter="this.style.transform='translateY(-4px)'; this.style.boxShadow='0 12px 32px rgba(0,0,0,0.3)'"
         onmouseleave="this.style.transform=''; this.style.boxShadow=''">
      <a href="product.html?slug=${product.slug || product.id}" style="text-decoration:none; display:block;">
        <div style="position:relative; height:180px; overflow:hidden; background:var(--surface,#1A1E2E);">
          <img src="${img}" alt="${escapeHtml(product.name || '')}"
               style="width:100%; height:100%; object-fit:cover;"
               onerror="this.src='assets/images/placeholder.svg'">
          ${discount ? `<span style="position:absolute; top:10px; left:10px; background:#E63946; color:#fff; font-size:0.72rem; font-weight:700; padding:3px 8px; border-radius:4px;">${discount}% OFF</span>` : ''}
        </div>
        <div style="padding:14px;">
          <p style="font-size:0.75rem; color:#457B9D; text-transform:uppercase; letter-spacing:0.05em; margin:0 0 4px;">${escapeHtml(product.category || 'RC Car')}</p>
          <h4 style="font-size:0.9rem; font-weight:600; color:#fff; margin:0 0 8px; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${escapeHtml(product.name || '')}</h4>
          <div style="display:flex; align-items:center; gap:6px; margin-bottom:10px;">
            <span style="color:#FFD700; font-size:0.8rem;">${stars}</span>
            <span style="font-size:0.75rem; color:#ADB5BD;">(${product.reviews_count || product.reviewCount || 0})</span>
          </div>
          <div style="display:flex; align-items:center; justify-content:space-between;">
            <div>
              <span style="font-size:1rem; font-weight:700; color:#fff;">₹${price}</span>
              ${originalPrice ? `<span style="font-size:0.8rem; color:#ADB5BD; text-decoration:line-through; margin-left:6px;">₹${Number(originalPrice).toLocaleString('en-IN')}</span>` : ''}
            </div>
          </div>
        </div>
      </a>
      <div style="padding:0 14px 14px;">
        <button onclick="addSuggestedToCart(${JSON.stringify(product).replace(/"/g,'&quot;')})"
                style="width:100%; padding:9px; background:rgba(230,57,70,0.12); color:#E63946; border:1px solid rgba(230,57,70,0.3); border-radius:8px; font-size:0.85rem; font-weight:600; cursor:pointer; transition:background 0.2s;"
                onmouseenter="this.style.background='rgba(230,57,70,0.22)'"
                onmouseleave="this.style.background='rgba(230,57,70,0.12)'">
          + Add to Cart
        </button>
      </div>
    </div>
  `;
}

function addSuggestedToCart(product) {
  Store.addToCart(product);
  renderCartItems();
  renderOrderSummary();
  if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();
  showToast(`${product.name} added to cart!`, 'success');
  // Re-render suggested to remove newly added item
  loadSuggestedProducts();
}

/* ============================================================
   EVENT LISTENERS
   ============================================================ */
function initCartEventListeners() {
  // Listen for storage changes (multi-tab sync)
  window.addEventListener('storage', (e) => {
    if (e.key === 'epictoyz_cart') {
      renderCartItems();
      renderOrderSummary();
    }
  });
}

/* ============================================================
   UTILITIES
   ============================================================ */
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  let stars = '';
  for (let i = 0; i < full; i++) stars += '★';
  if (half) stars += '½';
  const empty = 5 - full - (half ? 1 : 0);
  for (let i = 0; i < empty; i++) stars += '☆';
  return stars;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  // Use ui.js toast if available
  if (typeof UI !== 'undefined' && UI.showToast) {
    UI.showToast(message, type);
    return;
  }
  // Fallback minimal toast
  const toast = document.createElement('div');
  toast.textContent = message;
  const colors = { success: '#2ecc71', error: '#e74c3c', info: '#457B9D' };
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
    background: colors[type] || colors.info,
    color: '#fff', padding: '12px 20px', borderRadius: '10px',
    fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: '600',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    transition: 'opacity 0.3s, transform 0.3s',
    opacity: '0', transform: 'translateY(10px)'
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateY(0)';
  });
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
