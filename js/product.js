/**
 * product.js — Epic Toyz Product Detail Page Logic
 * Handles gallery, specs, reviews, related products, recently viewed, cart/wishlist.
 */

'use strict';

/* =====================================================================
   STATE
   ===================================================================== */
let currentProduct = null;
let currentImageIndex = 0;
let selectedQuantity = 1;
let reviewRating = 0;
let galleryImages = [];

/* =====================================================================
   INIT
   ===================================================================== */
document.addEventListener('DOMContentLoaded', initProductPage);

async function initProductPage() {
  initNavbar();
  initFooter();

  const urlParams = new URLSearchParams(window.location.search);
  const slug = urlParams.get('slug') || urlParams.get('id');

  if (!slug) {
    showNotFound();
    return;
  }

  try {
    // Try slug first, then ID fallback
    if (typeof DB !== 'undefined') {
      if (DB.getProductBySlug) currentProduct = await DB.getProductBySlug(slug);
      if (!currentProduct && DB.getProductById) currentProduct = await DB.getProductById(slug);
    }

    // Fallback: search in PRODUCTS_DATA
    if (!currentProduct && typeof PRODUCTS_DATA !== 'undefined') {
      currentProduct = PRODUCTS_DATA.find(p => p.slug === slug || String(p.id) === String(slug)) || null;
    }

    if (!currentProduct) {
      showNotFound();
      return;
    }

    // Hide loader, show content
    document.getElementById('product-loading').style.display = 'none';
    document.getElementById('product-content').style.display = 'block';

    // Update page title + meta
    document.title = `${currentProduct.name} | Epic Toyz`;
    const metaDesc = document.querySelector('meta[name="description"]');
    if (metaDesc && currentProduct.description) {
      metaDesc.content = currentProduct.description.substring(0, 160);
    }

    // Render all sections
    renderBreadcrumb(currentProduct);
    renderProductDetails(currentProduct);
    renderGallery(currentProduct);
    renderSpecsTable(currentProduct);
    renderFeatures(currentProduct);
    await loadReviews(currentProduct.id);
    await loadRelatedProducts(currentProduct.category);
    loadRecentlyViewed();

    // Track this product as recently viewed
    if (typeof Store !== 'undefined' && Store.addRecentlyViewed) {
      Store.addRecentlyViewed(currentProduct);
    } else {
      addToRecentlyViewedLocal(currentProduct);
    }

    initQuantityControls();
    updateWishlistButton();
    initTabNav();
    initAdminControls();

  } catch (err) {
    console.error('[product.js] initProductPage error:', err);
    showNotFound();
  }
}

/* =====================================================================
   NAVBAR / FOOTER
   ===================================================================== */
function initNavbar() {
  if (typeof UI !== 'undefined' && UI.loadNavbar) UI.loadNavbar();
  else loadPartial('navbar-placeholder', 'partials/navbar.html');
}
function initFooter() {
  if (typeof UI !== 'undefined' && UI.loadFooter) UI.loadFooter();
  else loadPartial('footer-placeholder', 'partials/footer.html');
}
function loadPartial(id, url) {
  fetch(url).then(r => r.text()).then(html => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = html;
  }).catch(() => {});
}

/* =====================================================================
   BREADCRUMB
   ===================================================================== */
function renderBreadcrumb(product) {
  const catLink = document.getElementById('breadcrumb-category-link');
  const productName = document.getElementById('breadcrumb-product-name');

  if (product.category) {
    const catSlug = product.category.toLowerCase().replace(/\s+/g, '-');
    const catLabel = product.category.charAt(0).toUpperCase() + product.category.slice(1).replace(/-/g, ' ');
    if (catLink) {
      catLink.href = `shop.html?category=${catSlug}`;
      catLink.textContent = catLabel;
    }
  }

  if (productName) productName.textContent = product.name || 'Product';
}

/* =====================================================================
   PRODUCT DETAILS
   ===================================================================== */
function renderProductDetails(product) {
  // Badge pills — support multiple badges
  const badgePill = document.getElementById('product-badge-pill');
  if (badgePill) {
    const badgesArr = (product.badges && product.badges.length > 0)
      ? product.badges
      : (product.badge ? [product.badge] : []);
    if (badgesArr.length > 0) {
      const pillMap = {
        bestseller: '🔥 Best Seller',
        new: '🆕 New Arrival',
        featured: '⭐ Featured',
        sale: '🏷️ On Sale',
        hot: '🌶️ Hot',
        limited: '⏳ Limited Stock',
      };
      const pillClassMap = {
        hot: 'badge-sale',
        limited: 'badge-none',
      };
      badgePill.innerHTML = `<div class="product-badges-row">${
        badgesArr.map(b => {
          const label = pillMap[b] || (b.charAt(0).toUpperCase() + b.slice(1));
          const cls = pillClassMap[b] || `badge-${b}`;
          return `<span class="product-badge-pill ${cls}">${label}</span>`;
        }).join('')
      }</div>`;
    } else {
      badgePill.innerHTML = '';
    }
  }

  // Name
  setTextContent('product-name', product.name || 'Unnamed Product');

  // Rating
  const rating = product.rating || 0;
  const reviewCount = product.review_count || product.reviewCount || 0;
  setInnerHTML('product-rating-stars', renderStarsFull(rating));
  setTextContent('product-rating-score', rating.toFixed(1));
  setTextContent('product-review-count', `(${reviewCount} review${reviewCount !== 1 ? 's' : ''})`);
  setTextContent('review-tab-count', reviewCount > 0 ? `(${reviewCount})` : '');

  // Price
  const price = product.price || 0;
  const originalPrice = product.original_price || product.originalPrice || 0;
  const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  setTextContent('product-price-current', `₹${price.toLocaleString('en-IN')}`);
  const origEl = document.getElementById('product-price-original');
  if (origEl) origEl.textContent = originalPrice > price ? `₹${originalPrice.toLocaleString('en-IN')}` : '';
  const discEl = document.getElementById('product-price-discount');
  if (discEl) discEl.textContent = discount > 0 ? `${discount}% OFF` : '';

  // Short description
  setTextContent('product-short-desc', product.short_description || product.shortDescription || product.description?.substring(0, 200) || '');

  // Stock status
  renderStockStatus(product.stock);

  // Full description (for tab)
  const descEl = document.getElementById('product-full-description');
  if (descEl) {
    const fullDesc = product.full_description || product.fullDescription || product.description || '';
    // If it contains HTML tags, render as HTML; otherwise wrap in paragraphs
    if (/<[a-z][\s\S]*>/i.test(fullDesc)) {
      descEl.innerHTML = fullDesc;
    } else {
      descEl.innerHTML = fullDesc.split('\n\n').map(p => p.trim() ? `<p>${p.trim()}</p>` : '').join('');
    }
  }
}

function renderStarsFull(rating) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.5;
  let html = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= full) html += '<span style="color:#FFD700">★</span>';
    else if (i === full + 1 && half) html += '<span style="color:#FFD700">⯨</span>';
    else html += '<span style="color:#333">★</span>';
  }
  return html;
}

function renderStockStatus(stock) {
  const el = document.getElementById('product-stock-status');
  const text = document.getElementById('stock-text');
  if (!el) return;

  el.className = 'stock-status';
  if (stock === undefined || stock === null) {
    el.classList.add('in-stock');
    if (text) text.textContent = 'In Stock';
  } else if (stock <= 0) {
    el.classList.add('out-of-stock');
    if (text) text.textContent = 'Out of Stock';
    disableOrderButtons();
  } else if (stock <= 5) {
    el.classList.add('low-stock');
    if (text) text.textContent = `Only ${stock} left — Order soon!`;
  } else {
    el.classList.add('in-stock');
    if (text) text.textContent = 'In Stock';
  }
}

function disableOrderButtons() {
  const addCartBtn = document.getElementById('btn-add-cart');
  const buyNowBtn = document.getElementById('btn-buy-now');
  if (addCartBtn) { addCartBtn.disabled = true; addCartBtn.textContent = 'Out of Stock'; }
  if (buyNowBtn) { buyNowBtn.disabled = true; }
}

function setTextContent(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}
function setInnerHTML(id, html) {
  const el = document.getElementById(id);
  if (el) el.innerHTML = html;
}

/* =====================================================================
   IMAGE GALLERY
   ===================================================================== */
function renderGallery(product) {
  // Build images array
  galleryImages = [];

  if (product.images && Array.isArray(product.images) && product.images.length > 0) {
    galleryImages = product.images.filter(Boolean);
  } else if (product.image) {
    galleryImages = [product.image];
  }

  // Always ensure at least one image
  if (!galleryImages.length) galleryImages = ['assets/images/placeholder.svg'];

  // Set gallery badge — support multiple badges
  const badgeOverlay = document.getElementById('gallery-badge-overlay');
  if (badgeOverlay) {
    const badgesArr = (product.badges && product.badges.length > 0)
      ? product.badges
      : (product.badge ? [product.badge] : []);
    if (badgesArr.length > 0) {
      const badgeLabelMap = {
        bestseller: 'Best Seller', new: 'New', featured: 'Featured',
        sale: 'Sale', hot: 'Hot', limited: 'Limited',
      };
      badgeOverlay.innerHTML = badgesArr.map(b => {
        const cls = b.toLowerCase().replace(/\s+/g, '');
        const lbl = badgeLabelMap[cls] || (b.charAt(0).toUpperCase() + b.slice(1));
        return `<div class="gallery-badge badge-${cls}" style="margin-bottom:4px;">${lbl}</div>`;
      }).join('');
    } else {
      badgeOverlay.innerHTML = '';
    }
  }

  // Set main image
  changeMainImage(0);

  // Make main image wrap clickable for lightbox
  const galleryMainWrap = document.getElementById('gallery-main-wrap');
  if (galleryMainWrap) {
    galleryMainWrap.style.cursor = 'zoom-in';
    galleryMainWrap.onclick = () => openLightbox(currentImageIndex);
  }

  // Render thumbnails
  const thumbsContainer = document.getElementById('gallery-thumbs');
  if (!thumbsContainer) return;

  if (galleryImages.length <= 1) {
    thumbsContainer.style.display = 'none';
  } else {
    thumbsContainer.innerHTML = galleryImages.map((img, i) => `
      <div class="gallery-thumb ${i === 0 ? 'active' : ''}" onclick="changeMainImage(${i})" role="button" aria-label="View image ${i + 1}">
        <img src="${img}" alt="Product view ${i + 1}" loading="lazy" onerror="this.src='assets/images/placeholder.svg'">
      </div>
    `).join('');
  }

  // Render dot indicators (mobile-friendly)
  let dotsContainer = document.getElementById('gallery-dots');
  if (!dotsContainer) {
    dotsContainer = document.createElement('div');
    dotsContainer.id = 'gallery-dots';
    dotsContainer.className = 'gallery-dots';
    const galleryWrap = galleryMainWrap ? galleryMainWrap.parentElement : null;
    if (galleryWrap) galleryWrap.insertBefore(dotsContainer, thumbsContainer || galleryWrap.children[1]);
  }
  if (galleryImages.length > 1) {
    dotsContainer.innerHTML = galleryImages.map((_, i) =>
      `<button class="gallery-dot${i === 0 ? ' active' : ''}" onclick="changeMainImage(${i})" aria-label="Image ${i + 1}"></button>`
    ).join('');
    dotsContainer.style.display = 'flex';
  } else {
    dotsContainer.innerHTML = '';
    dotsContainer.style.display = 'none';
  }

  // Touch swipe support
  initGallerySwipe();
}

function changeMainImage(index) {
  if (index < 0 || index >= galleryImages.length) return;
  currentImageIndex = index;

  const mainImg = document.getElementById('gallery-main');
  if (mainImg) {
    mainImg.style.opacity = '0';
    mainImg.style.transform = 'scale(0.97)';
    setTimeout(() => {
      mainImg.src = galleryImages[index];
      mainImg.alt = (currentProduct?.name || 'Product') + ` - Image ${index + 1}`;
      mainImg.style.transition = 'opacity 0.3s, transform 0.3s';
      mainImg.style.opacity = '1';
      mainImg.style.transform = 'scale(1)';
    }, 150);
  }

  // Update active thumbnail
  document.querySelectorAll('.gallery-thumb').forEach((thumb, i) => {
    thumb.classList.toggle('active', i === index);
  });

  // Update active dots
  document.querySelectorAll('.gallery-dot').forEach((dot, i) => {
    dot.classList.toggle('active', i === index);
  });
}

/* =====================================================================
   TOUCH SWIPE SUPPORT FOR GALLERY
   ===================================================================== */
let _swipeStartX = 0;
let _swipeStartY = 0;

function initGallerySwipe() {
  const wrap = document.getElementById('gallery-main-wrap');
  if (!wrap) return;

  // Remove old listeners to avoid duplicates
  wrap.removeEventListener('touchstart', _handleSwipeStart);
  wrap.removeEventListener('touchend', _handleSwipeEnd);

  wrap.addEventListener('touchstart', _handleSwipeStart, { passive: true });
  wrap.addEventListener('touchend', _handleSwipeEnd, { passive: true });
}

function _handleSwipeStart(e) {
  _swipeStartX = e.changedTouches[0].clientX;
  _swipeStartY = e.changedTouches[0].clientY;
}

function _handleSwipeEnd(e) {
  const dx = e.changedTouches[0].clientX - _swipeStartX;
  const dy = e.changedTouches[0].clientY - _swipeStartY;
  // Only handle horizontal swipes (more X movement than Y)
  if (Math.abs(dx) < 40 || Math.abs(dy) > Math.abs(dx)) return;

  if (dx < 0) {
    // Swipe left => next image
    const next = (currentImageIndex + 1) % galleryImages.length;
    changeMainImage(next);
  } else {
    // Swipe right => previous image
    const prev = (currentImageIndex - 1 + galleryImages.length) % galleryImages.length;
    changeMainImage(prev);
  }
}

/* =====================================================================
   SPECS TABLE
   ===================================================================== */
function renderSpecsTable(product) {
  const tbody = document.getElementById('specs-tbody');
  if (!tbody) return;

  const specs = product.specifications || product.specs || {};
  let entries = [];

  if (Array.isArray(specs)) {
    entries = specs.map(item => [item.name || item.key || '', item.value || '']);
  } else if (typeof specs === 'object' && specs !== null) {
    const values = Object.values(specs);
    if (values.length > 0 && typeof values[0] === 'object' && values[0] !== null && ('name' in values[0] || 'key' in values[0] || 'value' in values[0])) {
      entries = values.map(item => [item.name || item.key || '', item.value || '']);
    } else {
      entries = Object.entries(specs);
    }
  }

  // Filter out entries without a key
  entries = entries.filter(([k, v]) => k);

  if (!entries.length) {
    tbody.innerHTML = '<tr><td colspan="2" style="padding:20px;color:#555;text-align:center;">No specifications available.</td></tr>';
    return;
  }

  tbody.innerHTML = entries.map(([key, value]) => `
    <tr>
      <th>${formatSpecKey(key)}</th>
      <td>${value}</td>
    </tr>
  `).join('');
}

function formatSpecKey(key) {
  return key
    .replace(/_/g, ' ')
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, s => s.toUpperCase())
    .trim();
}

/* =====================================================================
   FEATURES
   ===================================================================== */
function renderFeatures(product) {
  const list = document.getElementById('features-list');
  if (!list) return;

  const features = product.features || [];

  if (!features.length) {
    list.innerHTML = '<li style="justify-content:center;color:#555;">No features listed.</li>';
    return;
  }

  list.innerHTML = features.map(feature => `
    <li>
      <span class="feature-check">✓</span>
      <span>${feature}</span>
    </li>
  `).join('');
}

/* =====================================================================
   QUANTITY CONTROLS
   ===================================================================== */
function initQuantityControls() {
  selectedQuantity = 1;
  updateQuantityDisplay();
}

function changeQuantity(delta) {
  const maxQty = (currentProduct?.stock && currentProduct.stock > 0) ? Math.min(currentProduct.stock, 99) : 99;
  selectedQuantity = Math.max(1, Math.min(maxQty, selectedQuantity + delta));
  updateQuantityDisplay();
}

function updateQuantityDisplay() {
  const display = document.getElementById('quantity-display');
  const decreaseBtn = document.getElementById('qty-decrease');
  const increaseBtn = document.getElementById('qty-increase');

  if (display) display.textContent = selectedQuantity;
  if (decreaseBtn) decreaseBtn.disabled = selectedQuantity <= 1;

  const maxQty = (currentProduct?.stock && currentProduct.stock > 0) ? Math.min(currentProduct.stock, 99) : 99;
  if (increaseBtn) increaseBtn.disabled = selectedQuantity >= maxQty;
}

/* =====================================================================
   CART / BUY / WHATSAPP
   ===================================================================== */
function addToCart() {
  if (!currentProduct) return;

  if (typeof Store !== 'undefined' && Store.addToCart) {
    Store.addToCart(currentProduct, selectedQuantity);
  }

  // Button feedback
  const btn = document.getElementById('btn-add-cart');
  if (btn) {
    const orig = btn.innerHTML;
    btn.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Added!';
    btn.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
    setTimeout(() => { btn.innerHTML = orig; btn.style.background = ''; }, 1800);
  }

  showToast(`"${currentProduct.name}" added to cart! 🛒`, 'success');
}

function buyNow() {
  if (!currentProduct) return;
  const buyNowItem = {
    id: currentProduct.id,
    name: currentProduct.name,
    price: currentProduct.price,
    image: currentProduct.image || (currentProduct.images && currentProduct.images[0]) || 'assets/images/placeholder.svg',
    quantity: selectedQuantity
  };
  localStorage.setItem('et_buy_now', JSON.stringify(buyNowItem));
  window.location.href = 'checkout.html?buynow=true';
}



/* =====================================================================
   WISHLIST
   ===================================================================== */
function toggleWishlistBtn() {
  if (!currentProduct) return;
  let isAdded = false;

  if (typeof Store !== 'undefined' && Store.toggleWishlist) {
    isAdded = Store.toggleWishlist(currentProduct);
  } else {
    isAdded = toggleWishlistLocal(currentProduct);
  }

  updateWishlistButton(isAdded);
  showToast(
    isAdded ? '♥ Added to wishlist!' : '♡ Removed from wishlist',
    isAdded ? 'success' : 'info'
  );
}

function updateWishlistButton(forceState) {
  const btn = document.getElementById('btn-wishlist');
  const iconEl = document.getElementById('wishlist-icon');
  const textEl = document.getElementById('wishlist-btn-text');
  if (!btn) return;

  let inWishlist = forceState;
  if (inWishlist === undefined) {
    if (typeof Store !== 'undefined' && Store.isInWishlist) {
      inWishlist = Store.isInWishlist(currentProduct?.id);
    } else {
      inWishlist = isInWishlistLocal(currentProduct?.id);
    }
  }

  btn.classList.toggle('active', inWishlist);
  if (iconEl) iconEl.setAttribute('fill', inWishlist ? '#E63946' : 'none');
  if (textEl) textEl.textContent = inWishlist ? 'In Wishlist' : 'Add to Wishlist';
}

/* Wishlist local fallback */
function toggleWishlistLocal(product) {
  let wishlist = JSON.parse(localStorage.getItem('epictoyz_wishlist') || '[]');
  const idx = wishlist.findIndex(p => p.id === product.id);
  if (idx > -1) {
    wishlist.splice(idx, 1);
    localStorage.setItem('epictoyz_wishlist', JSON.stringify(wishlist));
    return false;
  } else {
    wishlist.push(product);
    localStorage.setItem('epictoyz_wishlist', JSON.stringify(wishlist));
    return true;
  }
}
function isInWishlistLocal(productId) {
  const wishlist = JSON.parse(localStorage.getItem('epictoyz_wishlist') || '[]');
  return wishlist.some(p => p.id === productId);
}

/* =====================================================================
   SHARE
   ===================================================================== */
function shareProduct() {
  const url = window.location.href;
  const title = currentProduct?.name || 'Check out this product';

  if (navigator.share) {
    navigator.share({ title, url }).catch(() => {});
  } else {
    navigator.clipboard.writeText(url).then(() => {
      showToast('🔗 Product link copied to clipboard!', 'success');
    }).catch(() => {
      // Fallback for older browsers
      const dummy = document.createElement('input');
      dummy.value = url;
      document.body.appendChild(dummy);
      dummy.select();
      document.execCommand('copy');
      document.body.remove && dummy.remove();
      showToast('🔗 Link copied!', 'success');
    });
  }
}

/* =====================================================================
   TAB NAVIGATION
   ===================================================================== */
function initTabNav() {
  // Already wired via onclick, but also support keyboard nav
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        btn.click();
      }
    });
  });
}

function switchTab(btn, panelId) {
  // Update tab buttons
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  // Update panels
  document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
  const panel = document.getElementById(panelId);
  if (panel) panel.classList.add('active');
}

function switchToReviewTab() {
  const reviewBtn = document.querySelector('.tab-btn[onclick*="reviews-panel"]');
  if (reviewBtn) {
    reviewBtn.click();
    setTimeout(() => {
      document.getElementById('tab-reviews-panel')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  }
}

/* =====================================================================
   REVIEWS
   ===================================================================== */
async function loadReviews(productId) {
  const container = document.getElementById('reviews-container');
  if (!container) return;

  try {
    let reviews = [];
    if (typeof DB !== 'undefined' && DB.getReviews) {
      reviews = await DB.getReviews(productId);
    } else {
      // Fallback: use product's embedded reviews if any
      reviews = currentProduct?.reviews || [];
    }

    renderReviews(reviews);
  } catch (err) {
    console.error('[product.js] loadReviews error:', err);
    container.innerHTML = '<div class="no-reviews"><span class="emoji">📝</span>Could not load reviews.</div>';
  }
}

function renderReviews(reviews) {
  const container = document.getElementById('reviews-container');
  if (!container) return;

  if (!reviews || !reviews.length) {
    container.innerHTML = '<div class="no-reviews"><span class="emoji">📝</span>No reviews yet. Be the first to review this product!</div>';
    return;
  }

  // Update tab badge
  setTextContent('review-tab-count', `(${reviews.length})`);

  container.innerHTML = reviews.map(review => {
    const stars = renderStarsSimple(review.rating || 5);
    const date = review.created_at ? new Date(review.created_at).toLocaleDateString('en-IN', { year: 'numeric', month: 'short', day: 'numeric' }) : '';
    const verified = review.verified_purchase || review.verifiedPurchase;
    return `
      <div class="review-card">
        <div class="review-header">
          <div>
            <div class="reviewer-name">${escapeHtml(review.user_name || review.name || 'Anonymous')}</div>
            <div class="review-date">${date}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px;">
            ${verified ? '<span class="verified-badge">✓ Verified</span>' : ''}
          </div>
        </div>
        <div class="review-stars">${stars}</div>
        ${review.title ? `<div style="font-size:14px;font-weight:600;color:#fff;margin-bottom:6px;">${escapeHtml(review.title)}</div>` : ''}
        <div class="review-text">${escapeHtml(review.text || review.comment || review.body || '')}</div>
      </div>
    `;
  }).join('');

  // Show/hide review form based on auth
  checkReviewFormAuth();
}

function renderStarsSimple(rating) {
  const full = Math.floor(rating);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

function checkReviewFormAuth() {
  const form = document.getElementById('review-form-wrap');
  const loginPrompt = document.getElementById('review-login-prompt');

  let isLoggedIn = false;
  if (typeof Auth !== 'undefined' && Auth.isLoggedIn) isLoggedIn = Auth.isLoggedIn();
  else isLoggedIn = !!localStorage.getItem('epictoyz_user');

  if (form) form.style.display = isLoggedIn ? 'block' : 'none';
  if (loginPrompt) loginPrompt.style.display = isLoggedIn ? 'none' : 'block';
}

async function submitReview(e) {
  e.preventDefault();

  const ratingVal = parseInt(document.getElementById('review-rating-value')?.value || '0', 10);
  const title = document.getElementById('review-title')?.value?.trim() || '';
  const text = document.getElementById('review-text')?.value?.trim() || '';

  if (ratingVal < 1) {
    showToast('Please select a star rating.', 'error');
    return;
  }
  if (!text || text.length < 20) {
    showToast('Review must be at least 20 characters.', 'error');
    return;
  }

  const submitBtn = document.querySelector('.btn-submit-review');
  if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = 'Submitting...'; }

  try {
    const reviewData = {
      product_id: currentProduct.id,
      rating: ratingVal,
      title,
      text,
      created_at: new Date().toISOString(),
    };

    if (typeof DB !== 'undefined' && DB.submitReview) {
      await DB.submitReview(reviewData);
    } else {
      // Local fallback
      const key = `epictoyz_reviews_${currentProduct.id}`;
      const existing = JSON.parse(localStorage.getItem(key) || '[]');
      existing.unshift({ ...reviewData, user_name: 'You', id: Date.now() });
      localStorage.setItem(key, JSON.stringify(existing));
    }

    showToast('✅ Review submitted! Thank you.', 'success');
    document.getElementById('review-form')?.reset();
    resetStarRating();
    await loadReviews(currentProduct.id);

  } catch (err) {
    console.error('[product.js] submitReview error:', err);
    showToast('Could not submit review. Please try again.', 'error');
  } finally {
    if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = 'Submit Review'; }
  }
}

/* Star rating input */
function setReviewRating(value) {
  reviewRating = value;
  const hiddenInput = document.getElementById('review-rating-value');
  if (hiddenInput) hiddenInput.value = value;
  document.querySelectorAll('.star-input').forEach((star, i) => {
    star.classList.toggle('selected', i < value);
    star.classList.remove('hovered');
  });
}

function resetStarRating() {
  reviewRating = 0;
  const hiddenInput = document.getElementById('review-rating-value');
  if (hiddenInput) hiddenInput.value = '0';
  document.querySelectorAll('.star-input').forEach(star => {
    star.classList.remove('selected', 'hovered');
  });
}

// Hover effects on stars
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.star-input').forEach((star, i, stars) => {
    star.addEventListener('mouseenter', () => {
      stars.forEach((s, j) => {
        s.classList.toggle('hovered', j <= i);
        s.classList.remove('selected');
      });
    });
    star.addEventListener('mouseleave', () => {
      stars.forEach((s, j) => {
        s.classList.remove('hovered');
        s.classList.toggle('selected', j < reviewRating);
      });
    });
  });
});

/* =====================================================================
   RELATED PRODUCTS
   ===================================================================== */
async function loadRelatedProducts(category) {
  const grid = document.getElementById('related-products-grid');
  const section = document.getElementById('related-section');
  if (!grid || !section) return;

  try {
    let relatedAll = [];
    if (typeof DB !== 'undefined' && DB.getProducts) {
      try {
        relatedAll = await DB.getProducts({ category });
      } catch (err) {
        console.error('[product.js] Failed to fetch related products:', err);
      }
    }

    // Exclude current product and limit to 4
    const related = relatedAll
      .filter(p => p.id !== currentProduct.id)
      .slice(0, 4);

    if (!related.length) {
      section.style.display = 'none';
      return;
    }

    // Update "see all" link
    const seeAll = document.getElementById('related-see-all');
    if (seeAll) {
      const catSlug = category.toLowerCase().replace(/\s+/g, '-');
      seeAll.href = `shop.html?category=${catSlug}`;
    }

    grid.innerHTML = related.map(p => renderMiniCard(p)).join('');
    section.style.display = 'block';

  } catch (err) {
    console.error('[product.js] loadRelatedProducts error:', err);
    section.style.display = 'none';
  }
}

/* =====================================================================
   RECENTLY VIEWED
   ===================================================================== */
function loadRecentlyViewed() {
  const section = document.getElementById('recently-viewed-section');
  const grid = document.getElementById('recently-viewed-grid');
  if (!section || !grid) return;

  let recentlyViewed = [];
  try {
    recentlyViewed = JSON.parse(localStorage.getItem('epictoyz_recently_viewed') || '[]');
  } catch { recentlyViewed = []; }

  // Exclude current product
  const filtered = recentlyViewed.filter(p => p.id !== currentProduct?.id).slice(0, 4);

  if (!filtered.length) {
    section.style.display = 'none';
    return;
  }

  grid.innerHTML = filtered.map(p => renderMiniCard(p)).join('');
  section.style.display = 'block';
}

function addToRecentlyViewedLocal(product) {
  if (!product?.id) return;
  try {
    let rv = JSON.parse(localStorage.getItem('epictoyz_recently_viewed') || '[]');
    rv = rv.filter(p => p.id !== product.id);
    rv.unshift({
      id: product.id,
      slug: product.slug,
      name: product.name,
      price: product.price,
      original_price: product.original_price,
      image: (product.images && product.images[0]) || product.image,
      rating: product.rating,
      badge: product.badge,
      stock: product.stock
    });
    rv = rv.slice(0, 10); // max 10
    localStorage.setItem('epictoyz_recently_viewed', JSON.stringify(rv));
  } catch {}
}

/* =====================================================================
   MINI PRODUCT CARD (for related/recently viewed)
   ===================================================================== */
function renderMiniCard(product) {
  const slug = product.slug || product.id;
  const name = product.name || 'Product';
  const price = product.price || 0;
  const originalPrice = product.original_price || product.originalPrice || 0;
  const discount = originalPrice > price ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;
  const image = (product.images && product.images[0]) || product.image || 'assets/images/placeholder.svg';
  const rating = product.rating || 0;
  const badge = product.badge || '';
  const stock = product.stock;
  const isOutOfStock = stock !== undefined && stock !== null && stock <= 0;

  let badgeHtml = '';
  if (badge) {
    const badgeClass = badge.toLowerCase().replace(/\s+/g, '');
    const badgeLabel = badge === 'bestseller' ? 'Best Seller' : badge.charAt(0).toUpperCase() + badge.slice(1);
    badgeHtml = `<div class="product-badge badge-${badgeClass}" style="position:absolute;top:8px;left:8px;padding:3px 8px;border-radius:5px;font-size:10px;font-weight:700;text-transform:uppercase;z-index:2;">${badgeLabel}</div>`;
  }

  return `
    <div class="product-card" onclick="window.location.href='product.html?slug=${slug}'" style="cursor:pointer;">
      <div class="product-card-img-wrap">
        ${badgeHtml}
        <img class="product-card-img" src="${image}" alt="${name}" loading="lazy" onerror="this.src='assets/images/placeholder.svg'">
      </div>
      <div class="product-card-body">
        <h3 class="product-name" style="font-size:13px;">${name}</h3>
        <div class="product-card-rating">
          <span class="stars" style="font-size:11px;">${renderStarsSimple(rating)}</span>
          <span class="rating-count">${rating.toFixed(1)}</span>
        </div>
        <div class="product-card-price">
          <span class="price-current" style="font-size:15px;">₹${price.toLocaleString('en-IN')}</span>
          ${originalPrice > price ? `<span class="price-original" style="font-size:12px;">₹${originalPrice.toLocaleString('en-IN')}</span>` : ''}
          ${discount > 0 ? `<span class="price-discount">${discount}% OFF</span>` : ''}
        </div>
        <div class="product-card-actions">
          <button
            class="btn-add-cart"
            onclick="event.stopPropagation();addRelatedToCart('${product.id}','${escapeAttr(name)}',${price})"
            ${isOutOfStock ? 'disabled' : ''}
            style="font-size:12px;padding:8px;"
          >
            ${isOutOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
        </div>
      </div>
    </div>
  `;
}

function addRelatedToCart(productId, name, price) {
  if (typeof Store !== 'undefined' && Store.addToCart) {
    // Try to find full product data
    const product = { id: productId, name, price };
    Store.addToCart(product, 1);
  }
  showToast(`"${name}" added to cart! 🛒`, 'success');
}

/* =====================================================================
   ADMIN: IMAGE UPLOAD
   ===================================================================== */
function initAdminControls() {
  const adminBtn = document.getElementById('admin-image-btn');
  if (!adminBtn) return;

  let isAdmin = false;
  if (typeof Auth !== 'undefined' && Auth.isAdmin) isAdmin = Auth.isAdmin();
  else {
    try {
      const user = JSON.parse(localStorage.getItem('epictoyz_user') || 'null');
      isAdmin = user?.email === 'epictoyz.in@gmail.com' || user?.role === 'admin';
    } catch {}
  }

  adminBtn.classList.toggle('visible', isAdmin);
}

function openImageUploadModal() {
  const modal = document.getElementById('image-upload-modal');
  if (modal) modal.classList.add('open');
}

function closeImageUploadModal() {
  const modal = document.getElementById('image-upload-modal');
  if (modal) {
    modal.classList.remove('open');
    document.getElementById('image-url-input').value = '';
    document.getElementById('image-index-input').value = '1';
  }
}

async function confirmImageUpdate() {
  const url = document.getElementById('image-url-input')?.value?.trim();
  const index = parseInt(document.getElementById('image-index-input')?.value || '1', 10) - 1;

  if (!url) { showToast('Please enter an image URL.', 'error'); return; }
  if (!url.match(/^https?:\/\/.+/)) { showToast('Please enter a valid URL starting with http:// or https://', 'error'); return; }

  try {
    // Update local gallery images array
    while (galleryImages.length <= index) galleryImages.push('assets/images/placeholder.svg');
    galleryImages[index] = url;

    // Update product images
    if (!currentProduct.images) currentProduct.images = [];
    while (currentProduct.images.length <= index) currentProduct.images.push('assets/images/placeholder.svg');
    currentProduct.images[index] = url;

    // Persist via DB if available
    if (typeof DB !== 'undefined' && DB.updateProductImages) {
      await DB.updateProductImages(currentProduct.id, currentProduct.images);
    }

    // Re-render gallery
    renderGallery(currentProduct);
    closeImageUploadModal();
    showToast(`✅ Image ${index + 1} updated successfully!`, 'success');

  } catch (err) {
    console.error('[product.js] confirmImageUpdate error:', err);
    showToast('Could not update image. Please try again.', 'error');
  }
}

/* =====================================================================
   NOT FOUND
   ===================================================================== */
function showNotFound() {
  document.getElementById('product-loading').style.display = 'none';
  document.getElementById('product-not-found').style.display = 'block';
}

/* =====================================================================
   TOAST
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
    cursor: pointer;
  `;
  toast.textContent = message;
  toast.onclick = () => toast.remove();
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
function escapeHtml(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(str) {
  if (typeof str !== 'string') return '';
  return str.replace(/'/g, "\\'").replace(/"/g, '&quot;');
}

function renderStarsSimple(rating) {
  const full = Math.floor(rating || 0);
  return '★'.repeat(full) + '☆'.repeat(5 - full);
}

/* Generate WhatsApp message (can be called externally) */
function generateWhatsAppMessage(items, notes) {
  let lines = items.map(item => {
    const price = (item.price || 0) * (item.quantity || 1);
    return `• *${item.name}* x${item.quantity} = ₹${price.toLocaleString('en-IN')}`;
  });
  const total = items.reduce((sum, i) => sum + (i.price || 0) * (i.quantity || 1), 0);
  let msg = `Hi! I want to order:\n\n${lines.join('\n')}\n\n*Total: ₹${total.toLocaleString('en-IN')}*`;
  if (notes) msg += `\n\nNotes: ${notes}`;
  msg += '\n\nPlease confirm availability. Thank you! 🙏';
  return encodeURIComponent(msg);
}

/* =====================================================================
   LIGHTBOX / GALLERY VIEWER
   ===================================================================== */
let isLightboxOpen = false;

function openLightbox(index) {
  const modal = document.getElementById('lightbox-modal');
  if (!modal) return;

  isLightboxOpen = true;
  modal.classList.add('open');
  modal.setAttribute('aria-hidden', 'false');
  document.body.style.overflow = 'hidden';

  updateLightboxImage(index);
  initLightboxEvents();
}

function closeLightbox() {
  const modal = document.getElementById('lightbox-modal');
  if (!modal) return;

  isLightboxOpen = false;
  modal.classList.remove('open');
  modal.setAttribute('aria-hidden', 'true');
  document.body.style.overflow = '';
  removeLightboxEvents();
}

function updateLightboxImage(index) {
  if (index < 0 || index >= galleryImages.length) return;
  currentImageIndex = index;

  const lightboxImg = document.getElementById('lightbox-img');
  const counter = document.getElementById('lightbox-counter');
  
  if (lightboxImg) {
    lightboxImg.src = galleryImages[index];
  }
  if (counter) {
    counter.textContent = `${index + 1} / ${galleryImages.length}`;
  }

  // Update main gallery too, so they stay in sync
  changeMainImage(index);
}

function navigateLightbox(direction) {
  let nextIndex = currentImageIndex + direction;
  if (nextIndex < 0) nextIndex = galleryImages.length - 1;
  if (nextIndex >= galleryImages.length) nextIndex = 0;
  updateLightboxImage(nextIndex);
}

// Touch swipe variables
let touchStartX = 0;
let touchEndX = 0;

function handleLightboxTouchStart(e) {
  touchStartX = e.changedTouches[0].screenX;
}

function handleLightboxTouchEnd(e) {
  touchEndX = e.changedTouches[0].screenX;
  handleSwipe();
}

function handleSwipe() {
  const threshold = 50; // minimum distance for swipe
  if (touchEndX < touchStartX - threshold) {
    navigateLightbox(1);
  } else if (touchEndX > touchStartX + threshold) {
    navigateLightbox(-1);
  }
}

function handleLightboxKeyDown(e) {
  if (!isLightboxOpen) return;
  if (e.key === 'Escape') {
    closeLightbox();
  } else if (e.key === 'ArrowRight') {
    navigateLightbox(1);
  } else if (e.key === 'ArrowLeft') {
    navigateLightbox(-1);
  }
}

function initLightboxEvents() {
  const modal = document.getElementById('lightbox-modal');
  const closeBtn = document.getElementById('lightbox-close');
  const prevBtn = document.getElementById('lightbox-prev');
  const nextBtn = document.getElementById('lightbox-next');

  if (closeBtn) closeBtn.onclick = closeLightbox;
  if (prevBtn) prevBtn.onclick = (e) => { e.stopPropagation(); navigateLightbox(-1); };
  if (nextBtn) nextBtn.onclick = (e) => { e.stopPropagation(); navigateLightbox(1); };

  if (modal) {
    modal.onclick = (e) => {
      if (e.target === modal || e.target.id === 'lightbox-content' || e.target.classList.contains('lightbox-content')) {
        closeLightbox();
      }
    };
  }

  window.addEventListener('keydown', handleLightboxKeyDown);
  if (modal) {
    modal.addEventListener('touchstart', handleLightboxTouchStart, { passive: true });
    modal.addEventListener('touchend', handleLightboxTouchEnd, { passive: true });
  }
}

function removeLightboxEvents() {
  const modal = document.getElementById('lightbox-modal');
  window.removeEventListener('keydown', handleLightboxKeyDown);
  if (modal) {
    modal.removeEventListener('touchstart', handleLightboxTouchStart);
    modal.removeEventListener('touchend', handleLightboxTouchEnd);
  }
}
