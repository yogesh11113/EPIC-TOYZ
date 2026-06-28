/**
 * ============================================================
 * EPIC TOYZ — HOME PAGE CONTROLLER  (home.js)
 * Handles all homepage rendering, animations & interactions.
 * ============================================================
 */

/* ─── CONSTANTS & STATE ─────────────────────────────────────── */

const FEATURED_PAGE_SIZE = 8;
const NEW_ARRIVALS_LIMIT = 8;
const CATEGORY_SECTION_LIMIT = 5;

let featuredCurrentCategory = 'all';
let featuredPage = 1;
let featuredAllProducts = [];
let wishlistIds = new Set();

/* ─── ENTRY POINT ───────────────────────────────────────────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initHomePage);
} else {
  initHomePage();
}

async function initHomePage() {
  // Load navbar & footer (ui.js provides loadComponents)
  if (typeof loadComponents === 'function') {
    await loadComponents();
  }

  // Load wishlist from localStorage
  loadWishlistFromStorage();

  // Run these immediately (no data dependency)
  initScrollReveal();

  // Run data-dependent renders concurrently
  await Promise.allSettled([
    renderCategoryPills(),
    renderNewArrivals(),
    renderBestSellers(),
    renderDynamicCategorySections(),
    renderTestimonials(),
  ]);

  setupNewsletterForm();
}

/* ─── SCROLL REVEAL ─────────────────────────────────────────── */

function initScrollReveal() {
  const query = '.reveal, .reveal-left, .reveal-right, .reveal-scale';
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll(query).forEach(el => {
      el.classList.add('revealed', 'visible');
    });
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const siblings = entry.target.parentElement
            ? Array.from(entry.target.parentElement.querySelectorAll('.reveal:not(.revealed), .reveal-left:not(.revealed), .reveal-right:not(.revealed), .reveal-scale:not(.revealed)'))
            : [];
          const index = siblings.indexOf(entry.target);
          const delay = index >= 0 ? Math.min(index * 80, 400) : 0;
          setTimeout(() => {
            entry.target.classList.add('revealed', 'visible');
          }, delay);
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.02, rootMargin: '0px 0px 80px 0px' }
  );

  document.querySelectorAll(query).forEach(el => observer.observe(el));
}

/* ─── CATEGORY PILLS ────────────────────────────────────────── */

/**
 * Fetches categories from DB and renders pill buttons.
 * Clicking a pill smooth-scrolls to that category section on the page.
 */
async function renderCategoryPills() {
  const track = document.getElementById('catPillsTrack');
  if (!track) return;

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

    // Build pills HTML
    const pillsHtml = categories.map((cat, idx) => {
      const slug = cat.slug || cat.id || slugify(cat.name);
      const icon = cat.icon && !isImageUrl(cat.icon) ? cat.icon : '🏎️';
      return `
        <button
          class="cat-pill-btn ${idx === 0 ? 'active' : ''}"
          data-category-slug="${slug}"
          data-section-id="cat-section-${slug}"
          onclick="scrollToCategorySection('${slug}')"
          aria-label="Browse ${escapeHtml(cat.name)}"
        >
          <span class="cat-pill-icon">${icon}</span>
          ${escapeHtml(cat.name)}
        </button>
      `;
    }).join('');

    track.innerHTML = pillsHtml;

  } catch (err) {
    console.warn('[Home] renderCategoryPills error:', err);
    const cats = getDefaultCategories();
    track.innerHTML = cats.map((cat, idx) => {
      const slug = cat.slug || slugify(cat.name);
      return `<button class="cat-pill-btn ${idx === 0 ? 'active' : ''}" data-category-slug="${slug}" onclick="scrollToCategorySection('${slug}')">${cat.icon || '🏎️'} ${escapeHtml(cat.name)}</button>`;
    }).join('');
  }
}

/**
 * Smoothly scrolls the page to the section for the given category slug,
 * then sets that pill as active.
 */
function scrollToCategorySection(slug) {
  // Update active pill
  document.querySelectorAll('.cat-pill-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.categorySlug === slug);
  });

  // Scroll to section
  const target = document.getElementById(`cat-section-${slug}`);
  if (target) {
    const navbarHeight = document.getElementById('mainNavbar')?.offsetHeight || 70;
    const announcementHeight = document.getElementById('announcement-bar')?.offsetHeight || 40;
    const offset = navbarHeight + announcementHeight + 12;
    const top = target.getBoundingClientRect().top + window.scrollY - offset;
    window.scrollTo({ top, behavior: 'smooth' });
  }
}

window.scrollToCategorySection = scrollToCategorySection;

/* ─── DYNAMIC CATEGORY SECTIONS ────────────────────────────── */

/**
 * Generates one section per category from the database, each showing up to 5 products.
 */
async function renderDynamicCategorySections() {
  const container = document.getElementById('dynamic-category-sections');
  if (!container) return;

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

    // Generate each section
    for (const cat of categories) {
      const slug = cat.slug || cat.id || slugify(cat.name);
      await renderCategorySection(container, cat, slug);
    }

    // Observe new prem-reveal elements added
    const newReveals = container.querySelectorAll('.prem-reveal:not(.prem-visible)');
    if ('IntersectionObserver' in window) {
      const obs = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            entry.target.classList.add('prem-visible');
            obs.unobserve(entry.target);
          }
        });
      }, { threshold: 0.05 });
      newReveals.forEach(el => obs.observe(el));
    } else {
      newReveals.forEach(el => el.classList.add('prem-visible'));
    }

  } catch (err) {
    console.warn('[Home] renderDynamicCategorySections error:', err);
  }
}

/**
 * Renders a single category section and appends it to the container.
 */
async function renderCategorySection(container, cat, slug) {
  const sectionId = `cat-section-${slug}`;

  // Create section element immediately with skeleton
  const section = document.createElement('section');
  section.className = 'dyn-cat-section';
  section.id = sectionId;
  section.innerHTML = `
    <div class="container">
      <div class="prem-section-header prem-reveal">
        <div class="prem-section-left">
          <div class="prem-section-eyebrow">${cat.icon && !isImageUrl(cat.icon) ? cat.icon : '🏎️'} ${escapeHtml(cat.description || 'RC Cars')}</div>
          <h2 class="prem-section-title">${escapeHtml(cat.name)}</h2>
        </div>
        <a href="shop.html?category=${slug}" class="prem-view-all">
          View All
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </a>
      </div>
      <div class="products-grid-5" id="cat-products-${slug}">
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
        <div class="skeleton skeleton-card"></div>
      </div>
    </div>
  `;
  container.appendChild(section);

  // Fetch products for this category
  try {
    let products;

    if (typeof DB !== 'undefined' && typeof DB.getProducts === 'function') {
      products = await DB.getProducts({ category: slug, limit: CATEGORY_SECTION_LIMIT });
    } else if (typeof SAMPLE_DATA !== 'undefined' && SAMPLE_DATA.products) {
      products = (SAMPLE_DATA.products || []).filter(p => {
        const cats = Array.isArray(p.categories) ? p.categories : [p.category || ''];
        return cats.some(c => String(c).toLowerCase() === slug.toLowerCase());
      }).slice(0, CATEGORY_SECTION_LIMIT);
    }

    const grid = document.getElementById(`cat-products-${slug}`);
    if (!grid) return;

    if (!products || products.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px 0;font-size:14px;">No products in this category yet.</div>`;
      return;
    }

    grid.innerHTML = products.map(p => renderProductCard(p)).join('');
    refreshReveal(grid);

  } catch (err) {
    console.warn(`[Home] renderCategorySection error for ${slug}:`, err);
    const grid = document.getElementById(`cat-products-${slug}`);
    if (grid) grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-muted);padding:40px 0;">No products available.</div>`;
  }
}

/* ─── NEW ARRIVALS ──────────────────────────────────────────── */

/**
 * Fetches and renders the newest products sorted by created_at descending.
 */
async function renderNewArrivals() {
  const grid = document.getElementById('new-arrivals-grid');
  if (!grid) return;

  try {
    let products;

    if (typeof DB !== 'undefined' && typeof DB.getProducts === 'function') {
      products = await DB.getProducts({ sortBy: 'created_at', sortOrder: 'desc', limit: NEW_ARRIVALS_LIMIT });
    } else if (typeof window.SAMPLE_DATA !== 'undefined') {
      const allProducts = window.SAMPLE_DATA.products || [];
      products = [...allProducts]
        .sort((a, b) => {
          const da = new Date(a.created_at || a.createdAt || 0);
          const db2 = new Date(b.created_at || b.createdAt || 0);
          return db2 - da;
        })
        .slice(0, NEW_ARRIVALS_LIMIT);
    }

    if (!products || products.length === 0) {
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px 0;">No products available</div>`;
      return;
    }

    grid.innerHTML = products.map(p => renderProductCard(p)).join('');
    refreshReveal(grid);

  } catch (err) {
    console.warn('[Home] renderNewArrivals error:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px 0;">No products available</div>`;
  }
}

/* ─── BEST SELLERS ──────────────────────────────────────────── */

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
      grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px 0;">No products available</div>`;
      return;
    }

    grid.innerHTML = products.map(p => renderProductCard(p)).join('');
    refreshReveal(grid);

  } catch (err) {
    console.warn('[Home] renderBestSellers error:', err);
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:var(--text-secondary);padding:40px 0;">No products available</div>`;
  }
}

/* ─── PRODUCT CARD RENDERER ─────────────────────────────────── */

function renderProductCard(product) {
  if (!product) return '';

  const {
    id,
    name = 'RC Car',
    price = 0,
    stock = 10,
  } = product;

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

  const imgUrl = (images && images[0]) || image || 'assets/images/placeholder.svg';

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

  let discountHtml = '';
  if (originalPrice && originalPrice > price) {
    const pct = Math.round(((originalPrice - price) / originalPrice) * 100);
    discountHtml = `<span class="product-discount">${pct}% OFF</span>`;
  }

  const isWishlisted = wishlistIds.has(String(id));
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

/* ─── TESTIMONIALS ──────────────────────────────────────────── */

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

function getDefaultTestimonials() {
  return [
    { name: 'Arjun Sharma', location: 'Chennai, Tamil Nadu', rating: 5, review: 'Ordered a Traxxas Slash 4x4 — got it in 2 days! Quality is top-notch and the support team helped me set it up over WhatsApp. Best RC store in India!', verified: true },
    { name: 'Priya Menon', location: 'Bangalore, Karnataka', rating: 5, review: 'Amazing collection and super fast delivery. The drift car I bought is absolutely incredible. Will definitely order again. Epic Toyz lives up to its name!', verified: true },
    { name: 'Rahul Verma', location: 'Mumbai, Maharashtra', rating: 4, review: 'Great prices and genuine products. Ordered a hobby-grade rock crawler and it arrived perfectly packed. The WhatsApp order feature is super convenient!', verified: true },
    { name: 'Kiran Reddy', location: 'Hyderabad, Telangana', rating: 5, review: 'Been buying RC cars for 5 years — Epic Toyz is by far the most reliable store. Fast shipping, great prices, and they actually know their products!', verified: true },
    { name: 'Sanjay Kumar', location: 'Delhi, NCR', rating: 5, review: 'Bought two monster trucks for my kids. Outstanding quality, fast delivery and the packaging was perfect. Highly recommended for all RC enthusiasts!', verified: true },
    { name: 'Deepa Iyer', location: 'Coimbatore, Tamil Nadu', rating: 4, review: 'First time buying an RC car online — was a bit nervous but Epic Toyz made it so easy. Responsive team, good product and great prices. 10/10!', verified: true },
  ];
}

/* ─── NEWSLETTER ────────────────────────────────────────────── */

function setupNewsletterForm() {
  const form = document.getElementById('newsletter-form');
  if (!form) return;
  form.addEventListener('submit', handleNewsletterSubmit);
}

function handleNewsletterSubmit(e) {
  e.preventDefault();

  const input = document.getElementById('newsletter-email');
  if (!input) return;

  const email = input.value.trim();
  if (!email || !isValidEmail(email)) {
    showToast('Please enter a valid email address.', 'error');
    return;
  }

  if (typeof DB !== 'undefined' && typeof DB.subscribeNewsletter === 'function') {
    DB.subscribeNewsletter(email).catch(err => {
      console.warn('[Newsletter] DB error:', err);
    });
  }

  const subs = JSON.parse(localStorage.getItem('epictoyz_newsletter') || '[]');
  if (!subs.includes(email)) {
    subs.push(email);
    localStorage.setItem('epictoyz_newsletter', JSON.stringify(subs));
  }

  input.value = '';
  showToast('🎉 You\'re subscribed! Exclusive RC deals coming your way.', 'success');
}

window.handleNewsletterSubmit = handleNewsletterSubmit;

/* ─── WISHLIST ──────────────────────────────────────────────── */

function loadWishlistFromStorage() {
  try {
    const stored = JSON.parse(localStorage.getItem('epictoyz_wishlist') || '[]');
    wishlistIds = new Set(stored.map(String));
  } catch {
    wishlistIds = new Set();
  }
}

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

  localStorage.setItem('epictoyz_wishlist', JSON.stringify([...wishlistIds]));

  if (typeof STORE !== 'undefined' && typeof STORE.syncWishlist === 'function') {
    STORE.syncWishlist([...wishlistIds]);
  }
}

window.toggleWishlist = toggleWishlist;

function heartOutlineIcon() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

function heartFilledIcon() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="currentColor"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>`;
}

/* ─── CART ──────────────────────────────────────────────────── */

function addToCartFromCard(e, id) {
  if (e && e.stopPropagation) e.stopPropagation();

  const btn = e && e.target ? e.target.closest('button') : null;
  if (btn && btn.disabled) return;

  let product = null;
  if (typeof window.SAMPLE_DATA !== 'undefined' && window.SAMPLE_DATA.products) {
    product = window.SAMPLE_DATA.products.find(p => String(p.id) === String(id));
  }
  if (!product) {
    product = { id: String(id), name: 'RC Car', price: 0, quantity: 1 };
  }

  if (typeof Store !== 'undefined' && typeof Store.addToCart === 'function') {
    Store.addToCart(product, 1);
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

window.addToCartFromCard = addToCartFromCard;

function updateCartBadge() {
  const cart = JSON.parse(localStorage.getItem('epictoyz_cart') || '[]');
  const count = cart.reduce((acc, item) => acc + (item.qty || 1), 0);
  const badge = document.querySelector('.cart-count, .cart-badge, [data-cart-count]');
  if (badge) badge.textContent = count;
}

/* ─── NAVIGATE TO PRODUCT ───────────────────────────────────── */

function viewProduct(id) {
  window.location.href = `product.html?id=${id}`;
}

window.viewProduct = viewProduct;

/* ─── TOAST NOTIFICATIONS ───────────────────────────────────── */

function showToast(message, type = 'info', duration = 3500) {
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

window.showToast = showToast;

/* ─── CATEGORIES FALLBACK ───────────────────────────────────── */

function renderCategories() {
  // No-op: categories are now rendered as pills via renderCategoryPills()
  return Promise.resolve();
}

function getDefaultCategories() {
  return [
    { name: 'Drift Cars', description: 'Precision sideways machines', icon: '🏎️', color: '#E63946', slug: 'drift-cars', productCount: 48 },
    { name: 'Mini RC Cars', description: 'Compact & fast indoor cars', icon: '🚗', color: '#457B9D', slug: 'mini-rc', productCount: 32 },
    { name: 'Hobby Grade', description: 'Professional performance', icon: '🏁', color: '#2ecc71', slug: 'hobby-grade', productCount: 24 },
    { name: 'Crawlers', description: 'Off-road terrain beasts', icon: '🪨', color: '#e67e22', slug: 'crawlers', productCount: 19 },
    { name: 'Unique RC', description: 'Wall climbers, amphibians & more', icon: '⭐', color: '#9b59b6', slug: 'unique-rc', productCount: 120 },
  ];
}

/* ─── HELPER UTILITIES ──────────────────────────────────────── */

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

function formatPrice(price) {
  if (!price && price !== 0) return '0';
  return Number(price).toLocaleString('en-IN');
}

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

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function escapeHtml(str) {
  if (typeof str !== 'string') return String(str || '');
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function slugify(str) {
  return (str || '').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

function getInitials(name) {
  return name.split(' ').slice(0, 2).map(w => w[0] || '').join('').toUpperCase() || '?';
}

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

/* ─── LEGACY STUBS (kept for backward compat) ───────────────── */

function initHeroAnimations() {}
function initFeaturedTabs() {}
function renderFeaturedProducts() { return Promise.resolve(); }
function loadMoreFeatured() {}
window.loadMoreFeatured = loadMoreFeatured;

/* ─── END OF home.js ─────────────────────────────────────────── */
