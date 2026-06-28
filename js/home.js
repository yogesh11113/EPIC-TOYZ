/**
 * ============================================================
 * EPIC TOYZ — HOME PAGE CONTROLLER
 * js/home.js
 * Handles all homepage rendering, animations & interactions.
 * ============================================================
 */

/* ------------------------------------------------------------------ */
/*  CONSTANTS & STATE                                                   */
/* ------------------------------------------------------------------ */

const FEATURED_PAGE_SIZE = 8;
let featuredCurrentCategory = 'all';
let featuredPage = 1;
let featuredAllProducts = [];
let wishlistIds = new Set();

/* ------------------------------------------------------------------ */
/*  ENTRY POINT                                                         */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
  initHomePage();
});

/**
 * Main initialiser — bootstraps all homepage modules.
 */
async function initHomePage() {
  // Load navbar & footer components (if ui.js provides it)
  if (typeof loadComponents === 'function') {
    await loadComponents();
  }

  // Load saved wishlist from localStorage
  loadWishlistFromStorage();

  // Initialise UI modules in parallel where possible
  initHeroAnimations();
  initScrollReveal();
  initFeaturedTabs();

  // Render dynamic data (fire all concurrently)
  await Promise.allSettled([
    renderCategories(),
    renderBestSellers(),
    renderNewArrivals(),
    renderFeaturedProducts('all'),
    renderTestimonials(),
  ]);

  // Setup newsletter after DOM is ready
  setupNewsletterForm();
}

/* ------------------------------------------------------------------ */
/*  HERO ANIMATIONS                                                     */
/* ------------------------------------------------------------------ */

/**
 * Adds entrance animation classes to hero elements.
 * CSS animations are defined via keyframes in index.html.
 */
function initHeroAnimations() {
  // Hero animations and parallax removed to keep loading clean, static and instant.
}

/**
 * Animate a number counting up.
 * @param {HTMLElement} el    - Target element
 * @param {number}      end   - Final number
 * @param {number}      dur   - Duration in ms
 * @param {string}      suf   - Suffix string (e.g. '+')
 * @param {boolean}     short - Use shorthand like 10K+
 */
function animateCountUp(el, end, dur, suf = '', short = false) {
  const start = 0;
  const startTime = performance.now();

  function update(currentTime) {
    const elapsed = currentTime - startTime;
    const progress = Math.min(elapsed / dur, 1);
    // Ease out cubic
    const eased = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(start + (end - start) * eased);

    if (short && current >= 1000) {
      el.textContent = (current / 1000).toFixed(current >= 10000 ? 0 : 1) + 'K' + suf;
    } else {
      el.textContent = current.toLocaleString('en-IN') + suf;
    }

    if (progress < 1) {
      requestAnimationFrame(update);
    }
  }

  requestAnimationFrame(update);
}

/**
 * Subtle parallax movement for the hero visual.
 */
function handleHeroParallax(e) {
  const visual = document.querySelector('.hero-visual');
  if (!visual) return;
  const rect = document.getElementById('hero').getBoundingClientRect();
  const xPct = (e.clientX - rect.left) / rect.width - 0.5;
  const yPct = (e.clientY - rect.top) / rect.height - 0.5;
  visual.style.transform = `translate(${xPct * 18}px, ${yPct * 12}px)`;
}

/* ------------------------------------------------------------------ */
/*  SCROLL REVEAL                                                       */
/* ------------------------------------------------------------------ */

/**
 * Uses IntersectionObserver to animate elements with class "reveal"
 * as they scroll into the viewport.
 */
function initScrollReveal() {
  const query = '.reveal, .reveal-left, .reveal-right, .reveal-scale';
  if (!('IntersectionObserver' in window)) {
    // Fallback: just show everything
    document.querySelectorAll(query).forEach(el => {
      el.classList.add('revealed');
      el.classList.add('visible');
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          // Stagger siblings
          const siblings = entry.target.parentElement
            ? Array.from(entry.target.parentElement.querySelectorAll('.reveal:not(.revealed), .reveal-left:not(.revealed), .reveal-right:not(.revealed), .reveal-scale:not(.revealed)'))
            : [];
          const index = siblings.indexOf(entry.target);
          const delay = index >= 0 ? Math.min(index * 80, 400) : 0;

          setTimeout(() => {
            entry.target.classList.add('revealed');
            entry.target.classList.add('visible');
          }, delay);

          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.02, rootMargin: '0px 0px 80px 0px' }
  );

  document.querySelectorAll(query).forEach(el => observer.observe(el));
}

/* ------------------------------------------------------------------ */
/*  CATEGORIES                                                          */
/* ------------------------------------------------------------------ */

/**
 * Fetches categories from DB/data and renders them into #categories-grid.
 */
async function renderCategories() {
  const grid = document.getElementById('categories-grid');
  if (!grid) return;

  try {
    let categories;

    if (typeof DB !== 'undefined' && typeof DB.getCategories === 'function') {
      categories = await DB.getCategories();
    } else if (typeof SAMPLE_DATA !== 'undefined' && SAMPLE_DATA.categories) {
      categories = SAMPLE_DATA.categories;
    } else {
      categories = getDefaultCategories();
    }

    if (!categories || categories.length === 0) {
      categories = getDefaultCategories();
    }

    grid.innerHTML = categories.map(cat => renderCategoryCard(cat)).join('');
    initScrollReveal(); // Re-observe newly added elements

  } catch (err) {
    console.warn('[Home] renderCategories error:', err);
    const cats = getDefaultCategories();
    grid.innerHTML = cats.map(cat => renderCategoryCard(cat)).join('');
  }
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

/**
 * Returns HTML string for a single category card.
 */
function renderCategoryCard(cat) {
  const color = cat.color || '#E63946';
  const icon = cat.icon || '🏎️';
  const count = cat.productCount || cat.count || 0;
  const slug = cat.slug || cat.id || slugify(cat.name);

  const isImg = isImageUrl(icon);

  // Image-based: show as card cover photo
  if (isImg) {
    return `
      <a class="category-card reveal" href="shop.html?category=${slug}" style="--cat-color:${color}">
        <div class="category-card-img-cover">
          <img src="${icon}" alt="${escapeHtml(cat.name)}" loading="lazy" onerror="this.parentElement.style.background='var(--dark-700)'">
        </div>
        <div class="category-card-body">
          <div class="category-card-name">${escapeHtml(cat.name)}</div>
          ${cat.description ? `<div class="category-card-desc">${escapeHtml(cat.description)}</div>` : ''}
          ${count > 0 ? `<span class="category-count">${count} Products</span>` : ''}
        </div>
      </a>
    `;
  }

  // Emoji-based: classic icon layout
  return `
    <a class="category-card reveal" href="shop.html?category=${slug}" style="--cat-color:${color}">
      <div class="category-card-icon">${icon}</div>
      <div class="category-card-body">
        <div class="category-card-name">${escapeHtml(cat.name)}</div>
        ${cat.description ? `<div class="category-card-desc">${escapeHtml(cat.description)}</div>` : ''}
        ${count > 0 ? `<span class="category-count">${count} Products</span>` : ''}
      </div>
    </a>
  `;
}

/**
 * Fallback categories if data layer is unavailable.
 */
function getDefaultCategories() {
  return [
    { name: 'Drift Cars', description: 'Precision sideways machines', icon: '🏎️', color: '#E63946', slug: 'drift-cars', productCount: 48 },
    { name: 'Mini RC Cars', description: 'Compact & fast indoor cars', icon: '🚗', color: '#457B9D', slug: 'mini-rc', productCount: 32 },
    { name: 'Hobby Grade', description: 'Professional performance', icon: '🏁', color: '#2ecc71', slug: 'hobby-grade', productCount: 24 },
    { name: 'Crawlers', description: 'Off-road terrain beasts', icon: '🪨', color: '#e67e22', slug: 'crawlers', productCount: 19 },
    { name: 'Unique RC', description: 'Wall climbers, amphibians & more', icon: '⭐', color: '#9b59b6', slug: 'unique-rc', productCount: 120 },
  ];
}

/* ------------------------------------------------------------------ */
/*  PRODUCT CARD RENDERER                                              */
/* ------------------------------------------------------------------ */

/**
 * Renders a full product card HTML string.
 * @param {Object} product - Product data object
 * @returns {string} HTML string
 */
function renderProductCard(product) {
  if (!product) return '';

  const {
    id,
    name = 'RC Car',
    price = 0,
    stock = 10,
  } = product;

  // Support both snake_case (data.js) and camelCase
  const category = product.categories && product.categories.length > 0
    ? product.categories[0]
    : (product.category || '');
  const originalPrice = product.originalPrice || product.original_price || 0;
  const images = product.images || [];
  const image = product.image || product.image_url || '';
  const badge = product.badge || '';
  const badgesArr = (product.badges && product.badges.length > 0)
    ? product.badges
    : (badge ? [badge] : []);
  const isBestseller = product.isBestseller || product.is_bestseller || badgesArr.includes('bestseller');
  const isNew = product.isNew || product.is_new || badgesArr.includes('new');
  const isHot = product.isHot || product.is_hot || badgesArr.includes('hot');
  const isLimited = product.isLimited || product.is_limited || badgesArr.includes('limited');
  const onSale = product.onSale || product.on_sale || badgesArr.includes('sale');

  // Determine image URL
  const imgUrl = (images && images[0]) || image || 'assets/images/placeholder.svg';

  // Build badges list
  const badgeFallbacks = [];
  if (!badgesArr.length) {
    if (isBestseller) badgeFallbacks.push('bestseller');
    else if (isNew)   badgeFallbacks.push('new');
    else if (isHot)   badgeFallbacks.push('hot');
    else if (isLimited) badgeFallbacks.push('limited');
    else if (onSale)  badgeFallbacks.push('sale');
  }
  const finalBadges = badgesArr.length > 0 ? badgesArr : badgeFallbacks;

  const labelMap = {
    bestseller: '🔥 Best Seller',
    new: '✨ New',
    hot: '🔥 Hot',
    limited: '⏳ Limited',
    sale: '💸 Sale',
    featured: '⭐ Featured',
  };

  const badgesHtml = finalBadges.map(b => {
    const label = labelMap[b] || b;
    return `<span class="badge badge-${b}">${label}</span>`;
  }).join('');

  // Discount
  let discountHtml = '';
  if (originalPrice && originalPrice > price) {
    const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
    discountHtml = `<span class="product-discount">${pct}% OFF</span>`;
  }

  // Wishlist state
  const isWishlisted = wishlistIds.has(String(id));

  // Out of stock overlay
  const outOfStock = stock === 0;

  return `
    <div class="product-card hover-lift reveal" onclick="viewProduct('${id}')">
      <div class="product-card-image">
        ${badgesHtml ? `<div class="product-card-badges-row" style="position:absolute;top:10px;left:10px;z-index:2;display:flex;flex-wrap:wrap;gap:4px;">${badgesHtml}</div>` : ''}
        <img
          src="${imgUrl}"
          alt="${escapeHtml(name)}"
          loading="lazy"
          onerror="this.src='assets/images/placeholder.svg'"
        >
        ${outOfStock ? `<div style="position:absolute;inset:0;background:rgba(0,0,0,0.55);display:flex;align-items:center;justify-content:center;font-size:13px;font-weight:700;color:#aaa;letter-spacing:1px;">OUT OF STOCK</div>` : ''}
        <button
          class="wishlist-btn ${isWishlisted ? 'active' : ''}"
          onclick="toggleWishlist(event, '${id}')"
          data-id="${id}"
          title="${isWishlisted ? 'Remove from wishlist' : 'Add to wishlist'}"
          aria-label="Toggle wishlist"
        >
          ${isWishlisted
            ? `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
            : `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`
          }
        </button>
      </div>
      <div class="product-card-body">
        <div class="product-card-category">${escapeHtml(getCategoryLabel(category))}</div>
        <h3 class="product-card-title">${escapeHtml(name)}</h3>
        <div class="product-card-footer">
          <div class="price-group">
            <span class="product-price">₹${formatPrice(price)}</span>
            ${originalPrice && originalPrice > price
              ? `<span class="product-price-original">₹${formatPrice(originalPrice)}</span>`
              : ''}
            ${discountHtml}
          </div>
          <div class="product-card-actions">
            <button
              class="btn btn-primary btn-sm"
              onclick="addToCartFromCard(event, '${id}')"
              ${outOfStock ? 'disabled style="opacity:0.45;cursor:not-allowed;"' : ''}
            >
              ${outOfStock ? 'Sold Out' : 'Add to Cart'}
            </button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/* ------------------------------------------------------------------ */
/*  BEST SELLERS                                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetches and renders best seller products into #bestsellers-grid.
 */
async function renderBestSellers() {
  const grid = document.getElementById('bestsellers-grid');
  if (!grid) return;

  try {
    let products;

    if (typeof DB !== 'undefined' && typeof DB.getProducts === 'function') {
      products = await DB.getProducts({ badge: 'bestseller', limit: 8 });
    } else if (typeof window.SAMPLE_DATA !== 'undefined') {
      products = (window.SAMPLE_DATA.products || []).filter(
        p => p.badge === 'bestseller' || p.isBestseller || p.is_bestseller
      ).slice(0, 8);
    }

    if (!products || products.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px 0; font-size: 0.95rem;">No products available</div>';
      return;
    }

    grid.innerHTML = products.map(p => renderProductCard(p)).join('');
    refreshReveal(grid);

  } catch (err) {
    console.error('[Home] renderBestSellers error:', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--red); padding: 40px 0; font-size: 0.95rem;">⚠️ Failed to load products. Please check your connection.</div>';
  }
}

/* ------------------------------------------------------------------ */
/*  NEW ARRIVALS                                                        */
/* ------------------------------------------------------------------ */

/**
 * Fetches and renders new arrivals products into #new-arrivals-grid.
 */
async function renderNewArrivals() {
  const grid = document.getElementById('new-arrivals-grid');
  if (!grid) return;

  try {
    let products;

    if (typeof DB !== 'undefined' && typeof DB.getProducts === 'function') {
      products = await DB.getProducts({ isNew: true, limit: 8 });
    } else if (typeof window.SAMPLE_DATA !== 'undefined') {
      products = (window.SAMPLE_DATA.products || []).filter(
        p => p.isNew || p.is_new || p.badge === 'new'
      ).slice(0, 8);
    }

    if (!products || products.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px 0; font-size: 0.95rem;">No products available</div>';
      return;
    }

    grid.innerHTML = products.map(p => renderProductCard(p)).join('');
    refreshReveal(grid);

  } catch (err) {
    console.error('[Home] renderNewArrivals error:', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--red); padding: 40px 0; font-size: 0.95rem;">⚠️ Failed to load products. Please check your connection.</div>';
  }
}

/* ------------------------------------------------------------------ */
/*  FEATURED PRODUCTS                                                   */
/* ------------------------------------------------------------------ */

/**
 * Fetches and renders featured products into #featured-grid.
 * @param {string} category - Category filter ('all', 'drift', 'hobby', etc.)
 */
async function renderFeaturedProducts(category = 'all') {
  featuredCurrentCategory = category;
  featuredPage = 1;

  const grid = document.getElementById('featured-grid');
  if (!grid) return;

  // Show loading state
  grid.innerHTML = Array(4).fill('<div class="skeleton skeleton-card"></div>').join('');

  try {
    let products;

    if (typeof DB !== 'undefined' && typeof DB.getProducts === 'function') {
      const query = category === 'all' ? { featured: true } : { category, featured: true };
      products = await DB.getProducts(query);
    } else if (typeof window.SAMPLE_DATA !== 'undefined') {
      products = (window.SAMPLE_DATA.products || []).filter(p => {
        if (category === 'all') return true;
        return (p.category || '').toLowerCase().includes(category.toLowerCase());
      });
    }

    if (!products || products.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--text-secondary); padding: 40px 0; font-size: 0.95rem;">No products available</div>';
      featuredAllProducts = [];
      const loadMoreBtn = document.getElementById('load-more-btn');
      if (loadMoreBtn) loadMoreBtn.style.display = 'none';
      return;
    }

    featuredAllProducts = products;

    const toShow = products.slice(0, FEATURED_PAGE_SIZE);
    grid.innerHTML = toShow.map(p => renderProductCard(p)).join('');
    refreshReveal(grid);

    // Toggle "Load More" visibility
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
      loadMoreBtn.style.display = products.length > FEATURED_PAGE_SIZE ? 'inline-flex' : 'none';
    }

  } catch (err) {
    console.error('[Home] renderFeaturedProducts error:', err);
    grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; color: var(--red); padding: 40px 0; font-size: 0.95rem;">⚠️ Failed to load products. Please check your connection.</div>';
  }
}

/**
 * Loads next page of featured products (appends to grid).
 */
function loadMoreFeatured() {
  const grid = document.getElementById('featured-grid');
  if (!grid || !featuredAllProducts.length) return;

  featuredPage++;
  const start = (featuredPage - 1) * FEATURED_PAGE_SIZE;
  const end = start + FEATURED_PAGE_SIZE;
  const nextProducts = featuredAllProducts.slice(start, end);

  if (nextProducts.length > 0) {
    const fragment = nextProducts.map(p => renderProductCard(p)).join('');
    grid.insertAdjacentHTML('beforeend', fragment);
    refreshReveal(grid);
  }

  if (end >= featuredAllProducts.length) {
    const btn = document.getElementById('load-more-btn');
    if (btn) btn.style.display = 'none';
  }
}

// Expose globally for onclick
window.loadMoreFeatured = loadMoreFeatured;

/* ------------------------------------------------------------------ */
/*  FEATURED TABS                                                       */
/* ------------------------------------------------------------------ */

/**
 * Sets up click handlers for featured product tab filters.
 */
function initFeaturedTabs() {
  const tabContainer = document.getElementById('featured-tabs');
  if (!tabContainer) return;

  tabContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;

    const tab = btn.dataset.tab;
    if (!tab || tab === featuredCurrentCategory) return;

    // Update active state
    tabContainer.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    renderFeaturedProducts(tab);
  });
}

/* ------------------------------------------------------------------ */
/*  TESTIMONIALS                                                        */
/* ------------------------------------------------------------------ */

/**
 * Renders testimonials from SAMPLE_DATA.testimonials.
 */
async function renderTestimonials() {
  const grid = document.getElementById('testimonials-grid');
  if (!grid) return;

  let testimonials;

  if (typeof window.SAMPLE_DATA !== 'undefined' && window.SAMPLE_DATA.testimonials) {
    testimonials = window.SAMPLE_DATA.testimonials;
  } else {
    testimonials = getDefaultTestimonials();
  }

  grid.innerHTML = testimonials.map(t => renderTestimonialCard(t)).join('');
  refreshReveal(grid);
}

/**
 * Returns HTML for a single testimonial card.
 */
function renderTestimonialCard(t) {
  const stars = '★'.repeat(Math.min(Math.round(t.rating || 5), 5));
  const initials = getInitials(t.name || 'Anonymous');

  return `
    <div class="testimonial-card reveal">
      <div class="testimonial-stars">${stars}</div>
      <p class="testimonial-text">"${escapeHtml(t.review || t.text || '')}"</p>
      <div class="testimonial-author">
        <div class="testimonial-avatar">${initials}</div>
        <div>
          <div class="testimonial-name">${escapeHtml(t.name || 'Anonymous')}</div>
          <div class="testimonial-location">${escapeHtml(t.location || 'India')}</div>
          ${t.verified !== false ? `<div class="verified-badge">✓ Verified Buyer</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/**
 * Fallback testimonials.
 */
function getDefaultTestimonials() {
  return [
    {
      name: 'Arjun Sharma',
      location: 'Chennai, Tamil Nadu',
      rating: 5,
      review: 'Ordered a Traxxas Slash 4x4 — got it in 2 days! Quality is top-notch and the support team helped me set it up over WhatsApp. Best RC store in India!',
      verified: true,
    },
    {
      name: 'Priya Menon',
      location: 'Bangalore, Karnataka',
      rating: 5,
      review: 'Amazing collection and super fast delivery. The drift car I bought is absolutely incredible. Will definitely order again. Epic Toyz lives up to its name!',
      verified: true,
    },
    {
      name: 'Rahul Verma',
      location: 'Mumbai, Maharashtra',
      rating: 4,
      review: 'Great prices and genuine products. Ordered a hobby-grade rock crawler and it arrived perfectly packed. The WhatsApp order feature is super convenient!',
      verified: true,
    },
    {
      name: 'Kiran Reddy',
      location: 'Hyderabad, Telangana',
      rating: 5,
      review: 'Been buying RC cars for 5 years — Epic Toyz is by far the most reliable store. Fast shipping, great prices, and they actually know their products!',
      verified: true,
    },
    {
      name: 'Sanjay Kumar',
      location: 'Delhi, NCR',
      rating: 5,
      review: 'Bought two monster trucks for my kids. Outstanding quality, fast delivery and the packaging was perfect. Highly recommended for all RC enthusiasts!',
      verified: true,
    },
    {
      name: 'Deepa Iyer',
      location: 'Coimbatore, Tamil Nadu',
      rating: 4,
      review: 'First time buying an RC car online — was a bit nervous but Epic Toyz made it so easy. Responsive team, good product and great prices. 10/10!',
      verified: true,
    },
  ];
}

/* ------------------------------------------------------------------ */
/*  NEWSLETTER                                                          */
/* ------------------------------------------------------------------ */

/**
 * Sets up the newsletter form submission handler.
 */
function setupNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', handleNewsletterSubmit);
}

/**
 * Handles newsletter form submission.
 * @param {Event} e - Submit event
 */
function handleNewsletterSubmit(e) {
  e.preventDefault();

  const input = document.getElementById('newsletter-email');
  if (!input) return;

  const email = input.value.trim();
  if (!email || !isValidEmail(email)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  // Try to save to DB if available
  if (typeof DB !== 'undefined' && typeof DB.subscribeNewsletter === 'function') {
    DB.subscribeNewsletter(email).catch(err => {
      console.warn('[Newsletter] DB error:', err);
    });
  }

  // Save locally
  const subs = JSON.parse(localStorage.getItem('epictoyz_newsletter') || '[]');
  if (!subs.includes(email)) {
    subs.push(email);
    localStorage.setItem('epictoyz_newsletter', JSON.stringify(subs));
  }

  // Clear & confirm
  input.value = '';
  showToast('🎉 You\'re subscribed! Exclusive RC deals coming your way.', 'success');
}

// Expose globally for inline onsubmit
window.handleNewsletterSubmit = handleNewsletterSubmit;

/* ------------------------------------------------------------------ */
/*  WISHLIST                                                            */
/* ------------------------------------------------------------------ */

/**
 * Loads wishlist IDs from localStorage.
 */
function loadWishlistFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem('epictoyz_wishlist') || '[]');
    wishlistIds = new Set(stored.map(String));
  } catch {
    wishlistIds = new Set();
  }
}

/**
 * Toggles wishlist state for a product.
 * @param {Event}  e   - Click event (stops propagation to parent card)
 * @param {string} id  - Product ID
 */
function toggleWishlist(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();

  const strId = String(id);
  const btn = document.querySelector(`.wishlist-btn[data-id="${strId}"]`);

  if (wishlistIds.has(strId)) {
    wishlistIds.delete(strId);
    if (btn) {
      btn.classList.remove('active');
      btn.innerHTML = heartOutlineIcon();
      btn.title = 'Add to wishlist';
    }
    showToast('Removed from wishlist', 'info');
  } else {
    wishlistIds.add(strId);
    if (btn) {
      btn.classList.add('active');
      btn.innerHTML = heartFilledIcon();
      btn.title = 'Remove from wishlist';
    }
    showToast('❤️ Added to wishlist!', 'success');
  }

  // Persist
  localStorage.setItem('epictoyz_wishlist', JSON.stringify([...wishlistIds]));

  // Sync with store/auth if available
  if (typeof STORE !== 'undefined' && typeof STORE.syncWishlist === 'function') {
    STORE.syncWishlist([...wishlistIds]);
  }
}

// Expose globally
window.toggleWishlist = toggleWishlist;

function heartOutlineIcon() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

function heartFilledIcon() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

/* ------------------------------------------------------------------ */
/*  CART                                                                */
/* ------------------------------------------------------------------ */

/**
 * Adds a product to cart from the product card.
 * @param {Event}  e   - Click event (stops propagation)
 * @param {string} id  - Product ID
 */
function addToCartFromCard(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();

  const btn = e && e.target ? e.target.closest('button') : null;
  if (btn && btn.disabled) return;

  // Look up full product data
  let product = null;
  if (typeof window.SAMPLE_DATA !== 'undefined' && window.SAMPLE_DATA.products) {
    product = window.SAMPLE_DATA.products.find(p => String(p.id) === String(id));
  }
  if (!product) {
    // minimal fallback product object
    product = { id: String(id), name: 'RC Car', price: 0, quantity: 1 };
  }

  // Use Store (the correct global exposed by store.js)
  if (typeof Store !== 'undefined' && typeof Store.addToCart === 'function') {
    Store.addToCart(product, 1);
    // Animate the button
    if (btn) {
      const original = btn.textContent;
      btn.textContent = '✓ Added!';
      btn.style.background = 'var(--success, #2ecc71)';
      setTimeout(() => {
        btn.textContent = original;
        btn.style.background = '';
      }, 1200);
    }
    return;
  }

  // Fallback: localStorage cart using Store key format
  const cart = JSON.parse(localStorage.getItem('et_cart') || '[]');
  const existing = cart.find(item => String(item.id) === String(id));
  if (existing) {
    existing.quantity = (existing.quantity || 1) + 1;
  } else {
    cart.push({
      id: String(id),
      name: product.name || 'RC Car',
      price: product.price || 0,
      image: (product.images && product.images[0]) || product.image || product.image_url || '',
      category: product.category || 'RC Cars',
      quantity: 1,
    });
  }
  localStorage.setItem('et_cart', JSON.stringify(cart));
  updateCartBadge();

  showToast('🛒 Added to cart!', 'success');

  if (btn) {
    const original = btn.textContent;
    btn.textContent = '✓ Added!';
    btn.style.background = 'var(--success, #2ecc71)';
    setTimeout(() => {
      btn.textContent = original;
      btn.style.background = '';
    }, 1200);
  }
}

// Expose globally
window.addToCartFromCard = addToCartFromCard;

/**
 * Updates cart count badge in navbar.
 */
function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('epictoyz_cart') || '[]');
  const count = cart.reduce((acc, item) => acc + (item.qty || 1), 0);
  const badge = document.querySelector('.cart-count, .cart-badge, [data-cart-count]');
  if (badge) badge.textContent = count;
}

/* ------------------------------------------------------------------ */
/*  NAVIGATE TO PRODUCT                                                  */
/* ------------------------------------------------------------------ */

/**
 * Navigates to the product detail page.
 * @param {string} id - Product ID
 */
function viewProduct(id) {
  window.location.href = `product.html?id=${id}`;
}

// Expose globally
window.viewProduct = viewProduct;

/* ------------------------------------------------------------------ */
/*  TOAST NOTIFICATIONS                                                 */
/* ------------------------------------------------------------------ */

/**
 * Shows a toast notification.
 * @param {string} message  - Toast message
 * @param {string} type     - 'success' | 'error' | 'info'
 * @param {number} duration - Auto-dismiss duration in ms
 */
function showToast(message, type = 'info', duration = 3500) {
  // Use global if available
  if (typeof UI !== 'undefined' && typeof UI.toast === 'function') {
    UI.toast(message, type);
    return;
  }

  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const icons = { success: '✅', error: '❌', info: 'ℹ️' };
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || 'ℹ️'}</span>
    <span class="toast-msg">${escapeHtml(message)}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toastIn 0.4s ease reverse both';
    setTimeout(() => toast.remove(), 400);
  }, duration);
}

// Expose globally
window.showToast = showToast;

/* ------------------------------------------------------------------ */
/*  DEFAULT PRODUCTS (FALLBACK)                                         */
/* ------------------------------------------------------------------ */

/**
 * Returns hardcoded fallback products when DB/SAMPLE_DATA unavailable.
 * @param {string} type  - Filter type
 * @param {number} count - Number of products to return
 */
function getDefaultProducts(type, count = 4) {
  return [];
}

/* ------------------------------------------------------------------ */
/*  HELPER UTILITIES                                                    */
/* ------------------------------------------------------------------ */

/**
 * Returns star HTML string for a given rating.
 * @param {number} rating - Rating value (0–5)
 */
function renderStars(rating) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}

/**
 * Formats a price number with Indian number formatting.
 * @param {number} price
 */
function formatPrice(price) {
  if (!price && price !== 0) return '0';
  return Number(price).toLocaleString('en-IN');
}

/**
 * Returns display label for category slug.
 * @param {string} category
 */
function getCategoryLabel(category) {
  const map = {
    drift: 'Drift Car',
    hobby: 'Hobby Grade',
    crawler: 'Rock Crawler',
    truck: 'Monster Truck',
    accessories: 'Accessories',
    buggy: 'Buggy',
    touring: 'Touring Car',
  };
  return map[(category || '').toLowerCase()] || (category || 'RC Car');
}

/**
 * Validates email format.
 * @param {string} email
 */
function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Escapes HTML special characters to prevent XSS.
 * @param {string} str
 */
function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Converts a string to URL slug.
 * @param {string} str
 */
function slugify(str) {
  return (str || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

/**
 * Gets initials from a full name.
 * @param {string} name
 */
function getInitials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

/**
 * Re-runs IntersectionObserver on newly added .reveal elements within a container.
 * @param {HTMLElement} container
 */
function refreshReveal(container) {
  if (!container) return;
  const newEls = container.querySelectorAll('.reveal:not(.revealed)');
  if (!newEls.length) return;

  if (!('IntersectionObserver' in window)) {
    newEls.forEach(el => el.classList.add('revealed'));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          setTimeout(() => entry.target.classList.add('revealed'), i * 80);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
  );

  newEls.forEach(el => observer.observe(el));
}

/* ------------------------------------------------------------------ */
/*  END OF home.js                                                      */
/* ------------------------------------------------------------------ */
