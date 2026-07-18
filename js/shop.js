/**
 * shop.js — Epic Toyz Shop Page Logic
 * Handles filtering, sorting, pagination, and rendering of all products.
 */

'use strict';

/* =====================================================================
   STATE
   ===================================================================== */
let allProducts = [];
let filteredProducts = [];
let currentPage = 1;
const PRODUCTS_PER_PAGE = 12;
const MAX_PRICE_DEFAULT = 100000;

let activeFilters = {
  categories: [],
  badges: [],
  minPrice: 0,
  maxPrice: MAX_PRICE_DEFAULT,
  search: '',
  sort: 'popular'
};

let currentView = 'grid'; // 'grid' | 'list'
let debounceTimer = null;
let shopCategories = [];

/* =====================================================================
   INIT
   ===================================================================== */
document.addEventListener('DOMContentLoaded', initShopPage);

async function initShopPage() {
  try {
    // Show animated skeleton loaders immediately before starting DB load
    const grid = document.getElementById('products-grid');
    if (grid && typeof Perf !== 'undefined') {
      Perf.renderSkeletons(grid, 8);
    }

    // Load products from DB (with localStorage fallback via data.js)
    if (typeof DB !== 'undefined' && DB.getProducts) {
      allProducts = await DB.getProducts();
    } else if (typeof window.SAMPLE_DATA !== 'undefined' && window.SAMPLE_DATA.products) {
      allProducts = window.SAMPLE_DATA.products;
    } else {
      allProducts = [];
    }

    // Read URL params first (e.g. ?category=drift-cars from homepage links)
    getURLParams();

    // Build category filter options based on actual data
    await renderCategoryFilters();

    // Sync price range inputs to actual product price range
    syncPriceRangeToData();

    // Apply initial filters + render
    applyShopFilters();

    // Wire up all event listeners
    initFilters();
    initMobileFilterDrawer();
    initViewToggle();
    initNavbar();
    initFooter();

  } catch (err) {
    console.error('[shop.js] initShopPage error:', err);
    showShopError();
  }
}

/* Helper: init navbar/footer placeholders if ui.js provides it */
function initNavbar() {
  if (typeof UI !== 'undefined' && UI.loadNavbar) UI.loadNavbar();
  else loadPartial('navbar-placeholder', 'partials/navbar.html');
}
function initFooter() {
  if (typeof UI !== 'undefined' && UI.loadFooter) UI.loadFooter();
  else loadPartial('footer-placeholder', 'partials/footer.html');
}
function loadPartial(placeholderId, url) {
  fetch(url).then(r => r.text()).then(html => {
    const el = document.getElementById(placeholderId);
    if (el) el.innerHTML = html;
  }).catch(() => {});
}

/* =====================================================================
   URL PARAMS
   ===================================================================== */
function getURLParams() {
  const params = new URLSearchParams(window.location.search);

  const category = params.get('category');
  if (category) {
    const cats = category.split(',').map(c => c.trim()).filter(Boolean);
    activeFilters.categories = cats;
  }

  const search = params.get('search') || params.get('q');
  if (search) {
    activeFilters.search = search.trim();
    const searchEl = document.getElementById('sidebar-search');
    if (searchEl) searchEl.value = activeFilters.search;
  }

  const badge = params.get('badge');
  if (badge) {
    activeFilters.badges = badge.split(',').map(b => b.trim()).filter(Boolean);
  }

  const sort = params.get('sort');
  if (sort) {
    activeFilters.sort = sort;
    const sortEl = document.getElementById('sort-select');
    if (sortEl) sortEl.value = sort;
  }

  const minPrice = params.get('min');
  if (minPrice) activeFilters.minPrice = parseInt(minPrice, 10) || 0;

  const maxPrice = params.get('max');
  if (maxPrice) activeFilters.maxPrice = parseInt(maxPrice, 10) || MAX_PRICE_DEFAULT;
}

function updateURL() {
  const params = new URLSearchParams();
  if (activeFilters.categories.length) params.set('category', activeFilters.categories.join(','));
  if (activeFilters.search) params.set('search', activeFilters.search);
  if (activeFilters.badges.length) params.set('badge', activeFilters.badges.join(','));
  if (activeFilters.sort && activeFilters.sort !== 'popular') params.set('sort', activeFilters.sort);
  if (activeFilters.minPrice > 0) params.set('min', activeFilters.minPrice);
  if (activeFilters.maxPrice < MAX_PRICE_DEFAULT) params.set('max', activeFilters.maxPrice);
  if (currentPage > 1) params.set('page', currentPage);

  const newURL = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;
  window.history.replaceState({}, '', newURL);
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

/* =====================================================================
   FILTER RENDERING
   ===================================================================== */
async function renderCategoryFilters() {
  const container = document.getElementById('category-filters');
  if (!container) return;

  let categories = [];
  try {
    if (typeof DB !== 'undefined' && typeof DB.getCategories === 'function') {
      categories = await DB.getCategories();
    } else if (typeof window.SAMPLE_DATA !== 'undefined' && window.SAMPLE_DATA.categories) {
      categories = window.SAMPLE_DATA.categories;
    }
  } catch (e) {
    console.warn('[shop.js] failed to load categories for filters:', e);
  }

  if (!categories || categories.length === 0) {
    categories = [
      { slug: 'drift-cars',   label: 'Drift Cars',    icon: '🏎️' },
      { slug: 'mini-rc',      label: 'Mini RC Cars',  icon: '🚗' },
      { slug: 'hobby-grade',  label: 'Hobby Grade',   icon: '⚡' },
      { slug: 'crawlers',     label: 'Rock Crawlers', icon: '⛰️' },
      { slug: 'unique-rc',    label: 'Unique RC',     icon: '🤖' }
    ];
  }

  // Map properties to ensure consistency
  categories = categories.map(c => ({
    slug: c.slug || c.id,
    label: c.name || c.label || c.slug,
    icon: c.icon
  }));

  shopCategories = categories;

  // Count products per category (supports multi-category products)
  const counts = {};
  shopCategories.forEach(c => { counts[c.slug] = 0; });
  allProducts.forEach(p => {
    // If product has a categories array, count it in every matching category
    if (Array.isArray(p.categories) && p.categories.length > 0) {
      p.categories.forEach(c => {
        const slug = (c || '').toLowerCase().replace(/\s+/g, '-');
        if (counts[slug] !== undefined) counts[slug]++;
        else if (counts[(c || '').toLowerCase()] !== undefined) counts[(c || '').toLowerCase()]++;
      });
    } else {
      // Fallback to single category
      const slug = (p.category || '').toLowerCase().replace(/\s+/g, '-');
      if (counts[slug] !== undefined) counts[slug]++;
      else if (counts[(p.category || '').toLowerCase()] !== undefined) counts[(p.category || '').toLowerCase()]++;
    }
  });

  container.innerHTML = shopCategories.map(cat => {
    const checked = activeFilters.categories.includes(cat.slug);
    const icon = cat.icon || '🗂️';
    const isImg = isImageUrl(icon);
    
    const iconHtml = isImg 
      ? `<img src="${icon}" alt="${cat.label}" style="width: 18px; height: 18px; object-fit: contain; vertical-align: middle; margin-right: 6px; border-radius: 3px;">`
      : `<span style="margin-right: 6px; vertical-align: middle;">${icon}</span>`;

    return `
      <label class="checkbox-item">
        <input type="checkbox" name="category" value="${cat.slug}" ${checked ? 'checked' : ''}>
        <span class="checkbox-custom"></span>
        <span class="checkbox-label" style="display: inline-flex; align-items: center;">${iconHtml}<span>${cat.label}</span></span>
        <span class="checkbox-count">${counts[cat.slug] || 0}</span>
      </label>
    `;
  }).join('');
}

function syncPriceRangeToData() {
  if (!allProducts.length) return;
  const prices = allProducts.map(p => p.price || 0);
  const dataMax = Math.max(...prices);
  const effectiveMax = Math.ceil(dataMax / 1000) * 1000 || MAX_PRICE_DEFAULT;

  const rangeMin = document.getElementById('range-min');
  const rangeMax = document.getElementById('range-max');
  const maxInput = document.getElementById('max-price-input');

  if (rangeMin) { rangeMin.max = effectiveMax; rangeMin.value = activeFilters.minPrice; }
  if (rangeMax) { rangeMax.max = effectiveMax; rangeMax.value = Math.min(activeFilters.maxPrice, effectiveMax); }
  if (maxInput) maxInput.placeholder = effectiveMax.toLocaleString('en-IN');

  updatePriceRangeTrack();
  syncPriceInputsFromSliders();
}

function updatePriceRangeTrack() {
  const rangeMin = document.getElementById('range-min');
  const rangeMax = document.getElementById('range-max');
  const track = document.getElementById('price-range-track');
  if (!rangeMin || !rangeMax || !track) return;

  const maxAttr = parseInt(rangeMax.max, 10) || MAX_PRICE_DEFAULT;
  const minVal = parseInt(rangeMin.value, 10);
  const maxVal = parseInt(rangeMax.value, 10);
  const leftPct = (minVal / maxAttr) * 100;
  const rightPct = ((maxAttr - maxVal) / maxAttr) * 100;
  track.style.left = leftPct + '%';
  track.style.right = rightPct + '%';
}

function syncPriceInputsFromSliders() {
  const rangeMin = document.getElementById('range-min');
  const rangeMax = document.getElementById('range-max');
  const minInput = document.getElementById('min-price-input');
  const maxInput = document.getElementById('max-price-input');
  if (rangeMin && minInput) minInput.value = rangeMin.value;
  if (rangeMax && maxInput) maxInput.value = rangeMax.value;
}

/* =====================================================================
   FILTER LOGIC
   ===================================================================== */
function applyShopFilters() {
  let results = [...allProducts];

  // Search
  if (activeFilters.search) {
    const q = activeFilters.search.toLowerCase();
    results = results.filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q) ||
      (p.brand || '').toLowerCase().includes(q)
    );
  }

  // Category filter (supports multi-category products)
  if (activeFilters.categories.length) {
    results = results.filter(p => {
      // Check single category string (backward compat)
      const catRaw = (p.category || '').toLowerCase();
      const catSlug = catRaw.replace(/\s+/g, '-');
      if (activeFilters.categories.includes(catSlug) || activeFilters.categories.includes(catRaw)) return true;
      // Check categories array for multi-category support
      if (Array.isArray(p.categories) && p.categories.length > 0) {
        return p.categories.some(c => {
          const cLower = (c || '').toLowerCase();
          const cSlug = cLower.replace(/\s+/g, '-');
          return activeFilters.categories.includes(cSlug) || activeFilters.categories.includes(cLower);
        });
      }
      return false;
    });
  }

  // Price
  results = results.filter(p => {
    const price = p.price || 0;
    return price >= activeFilters.minPrice && price <= activeFilters.maxPrice;
  });

  // Badges
  if (activeFilters.badges.length) {
      results = results.filter(p => {
        const productBadges = (p.badges && p.badges.length > 0) ? p.badges : (p.badge ? [p.badge] : []);
        return activeFilters.badges.some(b => productBadges.some(pb => pb.toLowerCase() === b.toLowerCase()));
      });
    }

  // Sort
  results = sortProducts(results, activeFilters.sort);

  filteredProducts = results;
  currentPage = 1;

  renderProducts(getPageProducts());
  renderPagination();
  updateResultCount();
  updateActiveFilterTags();
  updateFilterBadge();
  updateURL();
}

function sortProducts(products, sort) {
  const arr = [...products];
  switch (sort) {
    case 'price-asc':
      return arr.sort((a, b) => (a.price || 0) - (b.price || 0));
    case 'price-desc':
      return arr.sort((a, b) => (b.price || 0) - (a.price || 0));
    case 'newest':
      return arr.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    case 'rating':
      return arr.sort((a, b) => (b.rating || 0) - (a.rating || 0));
    case 'popular':
    default:
      return arr.sort((a, b) => {
        const scoreB = (b.review_count || b.reviewCount || 0) + (b.rating || 0) * 10;
        const scoreA = (a.review_count || a.reviewCount || 0) + (a.rating || 0) * 10;
        return scoreB - scoreA;
      });
  }
}

function getPageProducts() {
  const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
  return filteredProducts.slice(start, start + PRODUCTS_PER_PAGE);
}

/* =====================================================================
   RENDER PRODUCTS
   ===================================================================== */
function renderProducts(products) {
  const grid = document.getElementById('products-grid');
  if (!grid) return;

  if (!products.length) {
    grid.innerHTML = renderEmptyState();
    return;
  }

  grid.innerHTML = products.map(p => renderProductCard(p)).join('');

  // Apply view mode class
  if (currentView === 'list') {
    grid.classList.add('list-view');
  } else {
    grid.classList.remove('list-view');
  }

  // Attach wishlist button states
  products.forEach(p => {
    const btn = grid.querySelector(`.wishlist-btn-card[data-product-id="${p.id}"]`);
    if (btn && typeof Store !== 'undefined' && Store.isInWishlist) {
      if (Store.isInWishlist(p.id)) btn.classList.add('active');
    }
  });
}

function renderProductCard(product) {
  const slug = product.slug || product.id;
  const name = product.name || 'Unnamed Product';
  const price = product.price || 0;
  const originalPrice = product.original_price || product.originalPrice || 0;
  const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const image = (product.images && product.images[0]) || product.image || 'assets/images/placeholder.svg';
  const rating = product.rating || 0;
  const reviewCount = product.review_count || product.reviewCount || 0;
  const stock = product.stock !== undefined ? product.stock : 10;

  let stockHtml = '';
  if (stock <= 0) {
    stockHtml = '<span class="stock-tag out-of-stock">Out of Stock</span>';
  } else if (stock <= 5) {
    stockHtml = `<span class="stock-tag low-stock">Only ${stock} left!</span>`;
  } else {
    stockHtml = '<span class="stock-tag in-stock">In Stock</span>';
  }

  const badge = product.badge || '';
  const badgesArr = (product.badges && product.badges.length > 0)
    ? product.badges
    : (badge ? [badge] : []);

  const badgeLabelMap = {
    bestseller: 'Best Seller',
    new: 'New',
    sale: 'Sale',
    featured: 'Featured',
    hot: 'Hot',
    limited: 'Limited Stock',
  };

  let badgeHtml = '';
  if (badgesArr.length > 0) {
    badgeHtml = `<div style="position:absolute;top:10px;left:10px;z-index:2;display:flex;flex-wrap:wrap;gap:4px;">${
      badgesArr.map(b => {
        const cls = b.toLowerCase().replace(/\s+/g, '');
        const lbl = badgeLabelMap[cls] || (b.charAt(0).toUpperCase() + b.slice(1));
        return `<div class="product-badge badge-${cls}">${lbl}</div>`;
      }).join('')
    }</div>`;
  }

  const starsHtml = renderStars(rating);

  const isOutOfStock = stock <= 0;

  return `
    <div class="product-card" data-product-id="${product.id}">
      <div class="product-card-img-wrap">
        ${badgeHtml}
        <img
          class="product-card-img"
          src="${image}"
          alt="${name}"
          loading="lazy"
          onerror="this.src='assets/images/placeholder.svg'"
          onclick="window.location.href='product.html?slug=${slug}'"
        >
        <button
          class="wishlist-btn-card"
          data-product-id="${product.id}"
          onclick="toggleWishlistCard(event, '${product.id}')"
          aria-label="Add to wishlist"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/>
          </svg>
        </button>
      </div>
      <div class="product-card-body">
        ${stockHtml}
        <h3 class="product-name" onclick="window.location.href='product.html?slug=${slug}'">${name}</h3>
        <div class="product-card-rating">
          <span class="stars" style="display: none !important;">${starsHtml}</span>
          <span class="rating-count">${rating.toFixed(1)} (${reviewCount})</span>
        </div>
        <div class="product-card-price">
          <span class="price-current">₹${price.toLocaleString('en-IN')}</span>
          ${originalPrice > price ? `<span class="price-original">₹${originalPrice.toLocaleString('en-IN')}</span>` : ''}
          ${discount > 0 ? `<span class="price-discount">${discount}% OFF</span>` : ''}
        </div>
        <div class="product-card-actions">
          <button
            class="btn-add-cart"
            onclick="addToCartFromCard(event, '${product.id}')"
            ${isOutOfStock ? 'disabled' : ''}
          >
            ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <a class="btn-view-product" href="product.html?slug=${slug}" aria-label="View product details">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
              <circle cx="12" cy="12" r="3"/>
            </svg>
          </a>
        </div>
      </div>
    </div>
  `;
}

function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= full) html += '★';
    else if (i === full + 1 && half) html += '½';
    else html += '☆';
  }
  return html;
}

function renderEmptyState() {
  const hasFilters = activeFilters.categories.length || activeFilters.badges.length ||
    activeFilters.search || activeFilters.minPrice > 0 || activeFilters.maxPrice < MAX_PRICE_DEFAULT;

  return `
    <div class="empty-state">
      <div class="empty-state-icon">🔍</div>
      <h3>${hasFilters ? 'No products match your filters' : 'No products found'}</h3>
      <p>${hasFilters ? 'Try adjusting your filters or search term.' : 'We\'re stocking up — check back soon!'}</p>
      ${hasFilters ? '<button class="btn-clear-empty" onclick="clearAllFilters()">Clear All Filters</button>' : ''}
    </div>
  `;
}

function showShopError() {
  const grid = document.getElementById('products-grid');
  if (grid) {
    grid.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Something went wrong</h3>
        <p>Could not load products. Please try refreshing the page.</p>
        <button class="btn-clear-empty" onclick="window.location.reload()">Refresh Page</button>
      </div>
    `;
  }
}

/* =====================================================================
   PAGINATION
   ===================================================================== */
function renderPagination() {
  const container = document.getElementById('pagination');
  if (!container) return;

  const total = filteredProducts.length;
  const totalPages = Math.ceil(total / PRODUCTS_PER_PAGE);

  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }

  let html = '';

  // Prev button
  html += `<button class="page-btn" onclick="goToPage(${currentPage - 1})" ${currentPage === 1 ? 'disabled' : ''} aria-label="Previous page">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"/></svg>
  </button>`;

  // Page numbers with ellipsis logic
  const pageNums = getPageNumbers(currentPage, totalPages);
  pageNums.forEach(p => {
    if (p === '...') {
      html += `<button class="page-btn" disabled style="cursor:default;">…</button>`;
    } else {
      html += `<button class="page-btn ${p === currentPage ? 'active' : ''}" onclick="goToPage(${p})" aria-label="Page ${p}" aria-current="${p === currentPage ? 'page' : 'false'}">${p}</button>`;
    }
  });

  // Next button
  html += `<button class="page-btn" onclick="goToPage(${currentPage + 1})" ${currentPage === totalPages ? 'disabled' : ''} aria-label="Next page">
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"/></svg>
  </button>`;

  container.innerHTML = html;
}

function getPageNumbers(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    pages.push(1, 2, 3, 4, 5, '...', total);
  } else if (current >= total - 3) {
    pages.push(1, '...', total - 4, total - 3, total - 2, total - 1, total);
  } else {
    pages.push(1, '...', current - 1, current, current + 1, '...', total);
  }
  return pages;
}

function goToPage(page) {
  const totalPages = Math.ceil(filteredProducts.length / PRODUCTS_PER_PAGE);
  if (page < 1 || page > totalPages) return;
  currentPage = page;
  renderProducts(getPageProducts());
  renderPagination();
  updateURL();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* =====================================================================
   RESULT COUNT + FILTER BADGE
   ===================================================================== */
function updateResultCount() {
  const total = filteredProducts.length;
  const countEl = document.getElementById('count-display');
  const headerEl = document.getElementById('header-result-count');
  if (countEl) countEl.textContent = total;
  if (headerEl) headerEl.textContent = `${total} product${total !== 1 ? 's' : ''} found`;
}

function updateFilterBadge() {
  const count = getActiveFilterCount();
  const badge = document.getElementById('filter-count-badge');
  const clearBtn = document.getElementById('clear-all-btn');
  const mobileBadge = document.getElementById('mobile-filter-count');
  const mobileClearCount = document.getElementById('mobile-filter-count');

  if (badge) {
    badge.textContent = count;
    badge.classList.toggle('visible', count > 0);
  }
  if (clearBtn) clearBtn.classList.toggle('visible', count > 0);
  if (mobileBadge) {
    mobileBadge.textContent = count;
    mobileBadge.classList.toggle('visible', count > 0);
  }
}

function getActiveFilterCount() {
  let count = 0;
  count += activeFilters.categories.length;
  count += activeFilters.badges.length;
  if (activeFilters.search) count++;
  if (activeFilters.minPrice > 0) count++;
  if (activeFilters.maxPrice < MAX_PRICE_DEFAULT) count++;
  return count;
}

/* =====================================================================
   ACTIVE FILTER TAGS
   ===================================================================== */
function updateActiveFilterTags() {
  const container = document.getElementById('active-filter-tags');
  if (!container) return;

  const tags = [];

  if (activeFilters.search) {
    tags.push({ label: `Search: "${activeFilters.search}"`, action: () => { activeFilters.search = ''; const el = document.getElementById('sidebar-search'); if (el) el.value = ''; applyShopFilters(); } });
  }

  activeFilters.categories.forEach(cat => {
    const catObj = shopCategories.find(c => c.slug === cat);
    tags.push({ label: catObj ? catObj.label : cat, action: () => { activeFilters.categories = activeFilters.categories.filter(c => c !== cat); syncCategoryCheckboxes(); applyShopFilters(); } });
  });

  activeFilters.badges.forEach(badge => {
    tags.push({ label: badge.charAt(0).toUpperCase() + badge.slice(1), action: () => { activeFilters.badges = activeFilters.badges.filter(b => b !== badge); syncBadgeChips(); applyShopFilters(); } });
  });

  if (activeFilters.minPrice > 0) {
    tags.push({ label: `Min: ₹${activeFilters.minPrice.toLocaleString('en-IN')}`, action: () => { activeFilters.minPrice = 0; syncPriceUI(); applyShopFilters(); } });
  }

  if (activeFilters.maxPrice < MAX_PRICE_DEFAULT) {
    tags.push({ label: `Max: ₹${activeFilters.maxPrice.toLocaleString('en-IN')}`, action: () => { activeFilters.maxPrice = MAX_PRICE_DEFAULT; syncPriceUI(); applyShopFilters(); } });
  }

  container.innerHTML = tags.map((tag, i) => `
    <div class="filter-tag">
      ${tag.label}
      <button class="filter-tag-remove" data-tag-index="${i}" aria-label="Remove filter">×</button>
    </div>
  `).join('');

  // Attach remove listeners
  container.querySelectorAll('.filter-tag-remove').forEach((btn, i) => {
    btn.addEventListener('click', () => tags[i].action());
  });
}

function syncCategoryCheckboxes() {
  document.querySelectorAll('#category-filters input[type="checkbox"]').forEach(cb => {
    cb.checked = activeFilters.categories.includes(cb.value);
  });
}

function syncBadgeChips() {
  document.querySelectorAll('.badge-chip').forEach(chip => {
    const active = activeFilters.badges.includes(chip.dataset.badge);
    chip.classList.toggle('active', active);
    chip.setAttribute('aria-pressed', active);
  });
}

function syncPriceUI() {
  const rangeMin = document.getElementById('range-min');
  const rangeMax = document.getElementById('range-max');
  const minInput = document.getElementById('min-price-input');
  const maxInput = document.getElementById('max-price-input');
  if (rangeMin) rangeMin.value = activeFilters.minPrice;
  if (rangeMax) rangeMax.value = activeFilters.maxPrice;
  if (minInput) minInput.value = activeFilters.minPrice || '';
  if (maxInput) maxInput.value = activeFilters.maxPrice < MAX_PRICE_DEFAULT ? activeFilters.maxPrice : '';
  updatePriceRangeTrack();
}

/* =====================================================================
   EVENT LISTENERS
   ===================================================================== */
function initFilters() {
  // Category checkboxes
  document.getElementById('category-filters')?.addEventListener('change', e => {
    if (e.target.name === 'category') {
      const val = e.target.value;
      if (e.target.checked) {
        if (!activeFilters.categories.includes(val)) activeFilters.categories.push(val);
      } else {
        activeFilters.categories = activeFilters.categories.filter(c => c !== val);
      }
      applyShopFilters();
    }
  });

  // Badge chips
  document.getElementById('badge-filters')?.addEventListener('click', e => {
    const chip = e.target.closest('.badge-chip');
    if (!chip) return;
    const badge = chip.dataset.badge;
    if (activeFilters.badges.includes(badge)) {
      activeFilters.badges = activeFilters.badges.filter(b => b !== badge);
      chip.classList.remove('active');
      chip.setAttribute('aria-pressed', 'false');
    } else {
      activeFilters.badges.push(badge);
      chip.classList.add('active');
      chip.setAttribute('aria-pressed', 'true');
    }
    applyShopFilters();
  });

  // Price range sliders
  const rangeMin = document.getElementById('range-min');
  const rangeMax = document.getElementById('range-max');
  let priceTimer = null;

  rangeMin?.addEventListener('input', () => {
    let minVal = parseInt(rangeMin.value, 10);
    let maxVal = parseInt(rangeMax.value, 10);
    if (minVal > maxVal - 500) {
      minVal = maxVal - 500;
      if (minVal < 0) minVal = 0;
      rangeMin.value = minVal;
    }
    activeFilters.minPrice = minVal;
    updatePriceRangeTrack();
    syncPriceInputsFromSliders();
    clearTimeout(priceTimer);
    priceTimer = setTimeout(applyShopFilters, 400);
  });

  rangeMax?.addEventListener('input', () => {
    let minVal = parseInt(rangeMin.value, 10);
    let maxVal = parseInt(rangeMax.value, 10);
    if (maxVal < minVal + 500) {
      maxVal = minVal + 500;
      const maxAttr = parseInt(rangeMax.max, 10);
      if (maxVal > maxAttr) maxVal = maxAttr;
      rangeMax.value = maxVal;
    }
    activeFilters.maxPrice = maxVal;
    updatePriceRangeTrack();
    syncPriceInputsFromSliders();
    clearTimeout(priceTimer);
    priceTimer = setTimeout(applyShopFilters, 400);
  });

  // Price number inputs
  document.getElementById('min-price-input')?.addEventListener('input', e => {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(() => {
      const val = parseInt(e.target.value, 10) || 0;
      activeFilters.minPrice = Math.max(0, val);
      const rangeMinEl = document.getElementById('range-min');
      if (rangeMinEl) rangeMinEl.value = activeFilters.minPrice;
      updatePriceRangeTrack();
      applyShopFilters();
    }, 500);
  });

  document.getElementById('max-price-input')?.addEventListener('input', e => {
    clearTimeout(priceTimer);
    priceTimer = setTimeout(() => {
      const val = parseInt(e.target.value, 10) || MAX_PRICE_DEFAULT;
      activeFilters.maxPrice = Math.max(0, val);
      const rangeMaxEl = document.getElementById('range-max');
      if (rangeMaxEl) rangeMaxEl.value = activeFilters.maxPrice;
      updatePriceRangeTrack();
      applyShopFilters();
    }, 500);
  });

  // Search input (debounced 300ms)
  let searchTimer = null;
  document.getElementById('sidebar-search')?.addEventListener('input', e => {
    clearTimeout(searchTimer);
    searchTimer = setTimeout(() => {
      activeFilters.search = e.target.value.trim();
      applyShopFilters();
    }, 300);
  });

  document.getElementById('sidebar-search')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      clearTimeout(searchTimer);
      activeFilters.search = e.target.value.trim();
      applyShopFilters();
    }
  });

  // Sort dropdown
  document.getElementById('sort-select')?.addEventListener('change', e => {
    activeFilters.sort = e.target.value;
    applyShopFilters();
  });

  // Clear all button
  document.getElementById('clear-all-btn')?.addEventListener('click', clearAllFilters);
}

function clearAllFilters() {
  activeFilters = {
    categories: [],
    badges: [],
    minPrice: 0,
    maxPrice: MAX_PRICE_DEFAULT,
    search: '',
    sort: activeFilters.sort // keep sort
  };

  // Reset UI
  syncCategoryCheckboxes();
  syncBadgeChips();
  syncPriceUI();
  const searchEl = document.getElementById('sidebar-search');
  if (searchEl) searchEl.value = '';

  applyShopFilters();
}

/* =====================================================================
   VIEW TOGGLE
   ===================================================================== */
function initViewToggle() {
  const gridBtn = document.getElementById('grid-view-btn');
  const listBtn = document.getElementById('list-view-btn');

  gridBtn?.addEventListener('click', () => {
    currentView = 'grid';
    gridBtn.classList.add('active');
    listBtn.classList.remove('active');
    gridBtn.setAttribute('aria-pressed', 'true');
    listBtn.setAttribute('aria-pressed', 'false');
    renderProducts(getPageProducts());
  });

  listBtn?.addEventListener('click', () => {
    currentView = 'list';
    listBtn.classList.add('active');
    gridBtn.classList.remove('active');
    listBtn.setAttribute('aria-pressed', 'true');
    gridBtn.setAttribute('aria-pressed', 'false');
    renderProducts(getPageProducts());
  });
}

/* =====================================================================
   MOBILE FILTER DRAWER
   ===================================================================== */
function initMobileFilterDrawer() {
  const openBtn = document.getElementById('mobile-filter-btn');
  const closeBtn = document.getElementById('sidebar-close-btn');
  const overlay = document.getElementById('filter-overlay');
  const sidebar = document.getElementById('filter-sidebar');

  // Show close button only on mobile
  if (closeBtn) {
    const checkMobile = () => {
      const isMobile = window.innerWidth <= 900;
      closeBtn.style.display = isMobile ? 'flex' : 'none';
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
  }

  openBtn?.addEventListener('click', () => {
    sidebar?.classList.add('open');
    overlay?.classList.add('open');
    openBtn.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  });

  const closeDrawer = () => {
    sidebar?.classList.remove('open');
    overlay?.classList.remove('open');
    openBtn?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  };

  closeBtn?.addEventListener('click', closeDrawer);
  overlay?.addEventListener('click', closeDrawer);

  // Close on escape
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sidebar?.classList.contains('open')) closeDrawer();
  });
}

/* =====================================================================
   CART / WISHLIST (card actions)
   ===================================================================== */
function addToCartFromCard(e, productId) {
  e.stopPropagation();
  const product = allProducts.find(p => p.id == productId);
  if (!product) return;

  if (typeof Store !== 'undefined' && Store.addToCart) {
    Store.addToCart(product, 1);
  }
  showToast(`"${product.name}" added to cart! 🛒`, 'success');

  // Button feedback
  const btn = e.currentTarget;
  const orig = btn.textContent;
  btn.textContent = '✓ Added!';
  btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
  setTimeout(() => {
    btn.textContent = orig;
    btn.style.background = '';
  }, 1500);
}

function toggleWishlistCard(e, productId) {
  e.stopPropagation();
  const product = allProducts.find(p => String(p.id) === String(productId));
  if (!product) return;

  if (typeof Store !== 'undefined' && Store.toggleWishlist) {
    const wasWishlisted = Store.isInWishlist(productId);
    Store.toggleWishlist(product);
    const isNowWishlisted = Store.isInWishlist(productId);
    const btn = e.currentTarget;
    btn.classList.toggle('active', isNowWishlisted);
    showToast(isNowWishlisted ? '♥ Added to wishlist' : '♡ Removed from wishlist', isNowWishlisted ? 'success' : 'info');
  }
}

/* =====================================================================
   TOAST NOTIFICATIONS
   ===================================================================== */
function showToast(message, type = 'info', duration = 3000) {
  if (typeof UI !== 'undefined' && UI.showToast) {
    UI.showToast(message, type, duration);
    return;
  }

  const container = document.getElementById('toast-container');
  if (!container) return;

  const colors = { success: '#2ecc71', error: '#e74c3c', info: '#457B9D', warning: '#f39c12' };
  const toast = document.createElement('div');
  toast.style.cssText = `
    padding: 12px 20px;
    background: #1A1E2E;
    border: 1px solid ${colors[type] || colors.info};
    border-left: 4px solid ${colors[type] || colors.info};
    border-radius: 10px;
    color: #fff;
    font-size: 14px;
    font-family: Inter, sans-serif;
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
    max-width: 320px;
    opacity: 0;
    transform: translateX(20px);
    transition: all 0.3s;
  `;
  toast.textContent = message;
  container.appendChild(toast);

  requestAnimationFrame(() => {
    toast.style.opacity = '1';
    toast.style.transform = 'translateX(0)';
  });

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(20px)';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/* =====================================================================
   UTILITY
   ===================================================================== */
function debounce(fn, delay) {
  return function (...args) {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => fn.apply(this, args), delay);
  };
}
