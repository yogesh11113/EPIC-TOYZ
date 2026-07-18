/**
 * perf.js — Epic Toyz Performance Module
 * ─────────────────────────────────────────
 * Centralized caching, skeleton loaders, and lazy loading.
 * Loaded before db.js so the cache is available immediately.
 */

'use strict';

/* ═══════════════════════════════════════════════════════════
   PRODUCT CACHE
   ═══════════════════════════════════════════════════════════ */

const ProductCache = {
  _products: null,
  _categories: null,
  _productsTTL: 5 * 60 * 1000,   // 5 minutes
  _categoriesTTL: 10 * 60 * 1000, // 10 minutes
  _productsTimestamp: 0,
  _categoriesTimestamp: 0,
  _fetchingProducts: null,   // Promise deduplication
  _fetchingCategories: null,

  /** Check if products cache is still fresh */
  hasProducts() {
    return this._products !== null && (Date.now() - this._productsTimestamp) < this._productsTTL;
  },

  /** Check if categories cache is still fresh */
  hasCategories() {
    return this._categories !== null && (Date.now() - this._categoriesTimestamp) < this._categoriesTTL;
  },

  /** Get cached products (or null) */
  getProducts() {
    return this.hasProducts() ? this._products : null;
  },

  /** Get cached categories (or null) */
  getCategories() {
    return this.hasCategories() ? this._categories : null;
  },

  /** Store products in cache */
  setProducts(products) {
    this._products = products;
    this._productsTimestamp = Date.now();
  },

  /** Store categories in cache */
  setCategories(categories) {
    this._categories = categories;
    this._categoriesTimestamp = Date.now();
  },

  /** Invalidate products cache (e.g. after admin mutations) */
  invalidateProducts() {
    this._products = null;
    this._productsTimestamp = 0;
    this._fetchingProducts = null;
  },

  /** Invalidate categories cache */
  invalidateCategories() {
    this._categories = null;
    this._categoriesTimestamp = 0;
    this._fetchingCategories = null;
  },

  /** Invalidate everything */
  invalidateAll() {
    this.invalidateProducts();
    this.invalidateCategories();
  }
};

// Expose globally
window.ProductCache = ProductCache;

/* ═══════════════════════════════════════════════════════════
   SKELETON LOADERS
   ═══════════════════════════════════════════════════════════ */

const Perf = {

  /**
   * Renders animated skeleton product cards into a container.
   * @param {HTMLElement} container - Target grid element
   * @param {number} count - Number of skeleton cards (default 4)
   */
  renderSkeletons(container, count = 4) {
    if (!container) return;
    const skeletons = [];
    for (let i = 0; i < count; i++) {
      skeletons.push(`
        <div class="skeleton-card">
          <div class="skeleton-image skeleton-pulse"></div>
          <div class="skeleton-body">
            <div class="skeleton-line skeleton-line-sm skeleton-pulse"></div>
            <div class="skeleton-line skeleton-line-lg skeleton-pulse"></div>
            <div class="skeleton-line-row">
              <div class="skeleton-line skeleton-line-price skeleton-pulse"></div>
              <div class="skeleton-line skeleton-line-btn skeleton-pulse"></div>
            </div>
          </div>
        </div>
      `);
    }
    container.innerHTML = skeletons.join('');
  },

  /**
   * Renders skeleton category cards.
   * @param {HTMLElement} container
   * @param {number} count
   */
  renderCategorySkeletons(container, count = 5) {
    if (!container) return;
    const skeletons = [];
    for (let i = 0; i < count; i++) {
      skeletons.push(`
        <div class="skeleton-card skeleton-category">
          <div class="skeleton-image skeleton-pulse" style="height: 120px;"></div>
          <div class="skeleton-body" style="padding: 12px;">
            <div class="skeleton-line skeleton-line-lg skeleton-pulse"></div>
            <div class="skeleton-line skeleton-line-sm skeleton-pulse"></div>
          </div>
        </div>
      `);
    }
    container.innerHTML = skeletons.join('');
  },

  /**
   * Applies IntersectionObserver lazy loading to images inside a container.
   * @param {HTMLElement} container
   */
  lazyLoadImages(container) {
    if (!container || !('IntersectionObserver' in window)) return;

    const images = container.querySelectorAll('img[loading="lazy"]');
    if (!images.length) return;

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          const img = entry.target;
          if (img.dataset.src) {
            img.src = img.dataset.src;
            img.removeAttribute('data-src');
          }
          observer.unobserve(img);
        }
      });
    }, { rootMargin: '200px' });

    images.forEach(img => observer.observe(img));
  },

  /**
   * Pre-fetches and warms the product cache on page load.
   * Runs in background without blocking.
   */
  async prefetchProducts() {
    if (ProductCache.hasProducts()) return;
    try {
      if (typeof DB !== 'undefined' && DB.getProducts) {
        const products = await DB.getProducts();
        // Cache is set inside DB.getProducts already
        console.log('[Perf] Product cache warmed:', products.length, 'products');
      }
    } catch (e) {
      console.warn('[Perf] prefetchProducts failed:', e.message);
    }
  }
};

// Expose globally
window.Perf = Perf;
