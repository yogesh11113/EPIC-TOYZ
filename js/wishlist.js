/**
 * wishlist.js — Epic Toyz Wishlist Page Logic
 * Handles rendering, sorting, remove, add-to-cart for wishlist items.
 */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
let _wishlistItems = [];   // working copy (may be sorted)
let _sortMode = 'default';

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initWishlistPage();
});

async function initWishlistPage() {
  // Load raw wishlist from Store
  _wishlistItems = Store.getWishlist();

  // Try to enrich with full product data from DB if available
  if (_wishlistItems.length > 0) {
    try {
      if (typeof DB !== 'undefined' && DB.getProductsByIds) {
        const ids = _wishlistItems.map(i => i.id);
        const fullProducts = await DB.getProductsByIds(ids);
        if (fullProducts && fullProducts.length > 0) {
          // Merge: prefer DB data, keep wishlist date_added
          const byId = {};
          _wishlistItems.forEach(i => { byId[i.id] = i; });
          _wishlistItems = fullProducts.map(p => ({
            ...byId[p.id],
            ...p,
            date_added: byId[p.id]?.date_added || Date.now(),
          }));
        }
      }
    } catch (err) {
      console.warn('Could not enrich wishlist from DB:', err);
    }
  }

  renderWishlist();
}

/* ============================================================
   RENDER WISHLIST
   ============================================================ */
function renderWishlist() {
  const grid = document.getElementById('wishlist-grid');
  const badge = document.getElementById('wishlist-count-badge');
  const addAllBtn = document.getElementById('btn-add-all');
  const toolbar = document.getElementById('wishlist-toolbar');
  const toolbarLabel = document.getElementById('wishlist-toolbar-label');

  if (!grid) return;

  const items = getSortedItems();
  const count = items.length;

  // Update badge
  if (badge) badge.textContent = count === 1 ? '1 item' : `${count} items`;

  // Update "Add All" button
  if (addAllBtn) addAllBtn.disabled = count === 0;

  if (count === 0) {
    showEmptyState();
    if (toolbar) toolbar.style.display = 'none';
    return;
  }

  // Show toolbar
  if (toolbar) toolbar.style.display = 'flex';
  if (toolbarLabel) {
    toolbarLabel.textContent = `Showing ${count} saved item${count !== 1 ? 's' : ''}`;
  }

  grid.innerHTML = items.map((item, idx) => renderWishlistCard(item, idx)).join('');
}

function getSortedItems() {
  let items = [..._wishlistItems];
  switch (_sortMode) {
    case 'price-asc':
      items.sort((a, b) => (a.price || 0) - (b.price || 0));
      break;
    case 'price-desc':
      items.sort((a, b) => (b.price || 0) - (a.price || 0));
      break;
    case 'name-asc':
      items.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
      break;
    case 'rating-desc':
      items.sort((a, b) => (b.rating || 0) - (a.rating || 0));
      break;
    default:
      // Date added (newest first)
      items.sort((a, b) => (b.date_added || 0) - (a.date_added || 0));
  }
  return items;
}

/* ============================================================
   RENDER SINGLE CARD
   ============================================================ */
function renderWishlistCard(item, idx) {
  const img = item.image || item.images?.[0] || 'assets/images/placeholder.svg';
  const price = (item.price || 0).toLocaleString('en-IN');
  const originalPrice = item.original_price || item.originalPrice;
  const rating = item.rating || 4.5;
  const reviewCount = item.reviews_count || item.reviewCount || 0;
  const delay = idx * 60;

  // Discount
  let discountBadge = '';
  let savingsTag = '';
  if (originalPrice && originalPrice > item.price) {
    const pct = Math.round((1 - item.price / originalPrice) * 100);
    discountBadge = `<span class="wish-discount-badge">${pct}% OFF</span>`;
    const savings = (originalPrice - item.price).toLocaleString('en-IN');
    savingsTag = `<span class="wish-savings">Save ₹${savings}</span>`;
  }

  // Stock badge
  const stock = item.stock ?? item.stock_count ?? 10; // default assume in stock
  let stockBadge = '';
  if (stock === 0) {
    stockBadge = `<span class="wish-stock-badge out-of-stock">Out of Stock</span>`;
  } else if (stock <= 3) {
    stockBadge = `<span class="wish-stock-badge low-stock">Only ${stock} left!</span>`;
  } else {
    stockBadge = `<span class="wish-stock-badge in-stock">In Stock</span>`;
  }

  // Add to Cart button state
  const isOutOfStock = stock === 0;
  const cartBtnText = isOutOfStock ? 'Out of Stock' : '+ Add to Cart';

  return `
    <div class="wishlist-card" data-id="${item.id}" style="animation-delay:${delay}ms">
      <!-- Remove button -->
      <button class="btn-remove-wish" onclick="removeFromWishlist('${item.id}')" title="Remove from wishlist" aria-label="Remove ${escapeHtml(item.name)} from wishlist">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
        </svg>
      </button>

      <!-- Image -->
      <div class="wish-card-img-wrapper">
        <a href="product.html?slug=${item.slug || item.id}" aria-label="View ${escapeHtml(item.name)}">
          <img class="wish-card-img" src="${img}" alt="${escapeHtml(item.name)}"
               onerror="this.src='assets/images/placeholder.svg'">
        </a>
        ${discountBadge}
        ${stockBadge}
      </div>

      <!-- Body -->
      <div class="wish-card-body">
        <p class="wish-category">${escapeHtml(item.category || 'RC Car')}</p>
        <h3 class="wish-name">
          <a href="product.html?slug=${item.slug || item.id}" style="color:inherit; text-decoration:none;">${escapeHtml(item.name || '')}</a>
        </h3>
        <div class="wish-rating">
          <span class="wish-stars" style="display: none !important;">${renderStars(rating)}</span>
          <span class="wish-review-count">(${reviewCount})</span>
        </div>
        <div class="wish-price-row">
          <span class="wish-price">₹${price}</span>
          ${originalPrice ? `<span class="wish-original-price">₹${Number(originalPrice).toLocaleString('en-IN')}</span>` : ''}
          ${savingsTag}
        </div>
      </div>

      <!-- Actions -->
      <div class="wish-card-actions">
        <button
          class="btn-wish-cart"
          onclick="addWishItemToCart('${item.id}')"
          ${isOutOfStock ? 'disabled' : ''}
          id="wish-cart-btn-${item.id}"
        >
          ${cartBtnText}
        </button>
        <a href="product.html?slug=${item.slug || item.id}" class="btn-wish-view" title="View product" aria-label="View ${escapeHtml(item.name)}">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </a>
      </div>
    </div>
  `;
}

/* ============================================================
   EMPTY STATE
   ============================================================ */
function showEmptyState() {
  const grid = document.getElementById('wishlist-grid');
  if (!grid) return;

  grid.innerHTML = `
    <div class="wishlist-empty" style="grid-column: 1 / -1;">
      <span class="empty-heart">🤍</span>
      <h2>Your wishlist is empty</h2>
      <p>
        Save your favourite RC cars here so you can find them later.<br>
        Start exploring our collection!
      </p>
      <a href="shop.html" class="btn-browse">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        Browse Products
      </a>
    </div>
  `;
}

/* ============================================================
   REMOVE FROM WISHLIST
   ============================================================ */
function removeFromWishlist(productId) {
  const card = document.querySelector(`.wishlist-card[data-id="${productId}"]`);
  if (card) {
    card.classList.add('removing');
    setTimeout(() => {
      Store.removeFromWishlist(productId);
      _wishlistItems = _wishlistItems.filter(i => String(i.id) !== String(productId));
      renderWishlist();
      if (typeof UI !== 'undefined' && UI.updateWishlistBadge) UI.updateWishlistBadge();
      showToast('Removed from wishlist', 'info');
    }, 300);
  } else {
    Store.removeFromWishlist(productId);
    _wishlistItems = _wishlistItems.filter(i => String(i.id) !== String(productId));
    renderWishlist();
    if (typeof UI !== 'undefined' && UI.updateWishlistBadge) UI.updateWishlistBadge();
  }
}

/* ============================================================
   ADD SINGLE ITEM TO CART
   ============================================================ */
function addWishItemToCart(productId) {
  const item = _wishlistItems.find(i => String(i.id) === String(productId));
  if (!item) return;

  const btn = document.getElementById(`wish-cart-btn-${productId}`);

  Store.addToCart(item);
  if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();

  // Visual feedback
  if (btn) {
    const originalText = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
    setTimeout(() => {
      btn.textContent = originalText;
      btn.style.background = '';
    }, 2000);
  }

  showToast(`${item.name} added to cart!`, 'success');
}

/* ============================================================
   ADD ALL TO CART
   ============================================================ */
function addAllToCart() {
  const items = _wishlistItems;
  if (items.length === 0) return;

  let addedCount = 0;
  items.forEach(item => {
    const stock = item.stock ?? item.stock_count ?? 10;
    if (stock !== 0) {
      Store.addToCart(item);
      addedCount++;
    }
  });

  if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();

  if (addedCount === 0) {
    showToast('All items are out of stock', 'error');
  } else if (addedCount < items.length) {
    showToast(`${addedCount} of ${items.length} items added to cart (some out of stock)`, 'info');
  } else {
    showToast(`All ${addedCount} items added to cart!`, 'success');
  }

  // Update all cart buttons
  items.forEach(item => {
    const btn = document.getElementById(`wish-cart-btn-${item.id}`);
    if (btn && !btn.disabled) {
      btn.textContent = '✓ In Cart';
      btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
    }
  });
}

/* ============================================================
   SORT
   ============================================================ */
function sortWishlist(mode) {
  _sortMode = mode;
  renderWishlist();
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#039;');
}

function showToast(message, type = 'info') {
  if (typeof UI !== 'undefined' && UI.showToast) { UI.showToast(message, type); return; }
  const colors = { success: '#2ecc71', error: '#e74c3c', info: '#457B9D' };
  const toast = document.createElement('div');
  toast.textContent = message;
  Object.assign(toast.style, {
    position: 'fixed', bottom: '24px', right: '24px', zIndex: '9999',
    background: colors[type] || colors.info, color: '#fff',
    padding: '12px 20px', borderRadius: '10px',
    fontFamily: 'Inter, sans-serif', fontSize: '0.9rem', fontWeight: '600',
    boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
    transition: 'opacity 0.3s, transform 0.3s', opacity: '0', transform: 'translateY(10px)'
  });
  document.body.appendChild(toast);
  requestAnimationFrame(() => { toast.style.opacity = '1'; toast.style.transform = 'translateY(0)'; });
  setTimeout(() => {
    toast.style.opacity = '0'; toast.style.transform = 'translateY(10px)';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}
