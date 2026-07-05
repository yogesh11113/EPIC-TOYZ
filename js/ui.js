/**
 * ui.js — Epic Toyz Shared UI Components & Utilities
 * ───────────────────────────────────────────────────
 * Dynamically injects the premium header and footer across all pages.
 * Handles toast notifications, scroll reveal, modals, price formatting,
 * and WhatsApp sharing functionality.
 */

// Helper to determine relative path prefix based on file location
function getPathPrefix() {
  const path = window.location.pathname.replace(/\\/g, '/');
  if (path.includes('/admin/')) {
    return '../';
  } else if (path.includes('/pages/')) {
    return '../';
  }
  return '';
}

const prefix = getPathPrefix();

// --- INJECT NAV BAR ---
function injectNavbar() {
  const navbarPlaceholder = document.getElementById('navbar-placeholder');
  if (!navbarPlaceholder) return;

  const currentPath = window.location.pathname.replace(/\\/g, '/');
  const isHome = currentPath.endsWith('/') || currentPath.endsWith('index.html');
  const isShop = currentPath.endsWith('shop.html');
  const isWishlist = currentPath.endsWith('wishlist.html');
  const isCart = currentPath.endsWith('cart.html');
  const isAbout = currentPath.endsWith('about.html');
  const isContact = currentPath.endsWith('contact.html');
  const isFAQ = currentPath.endsWith('faq.html');
  
  const marqueeHTML = `
    <div class="announcement-marquee" id="announcementMarquee">
      <div class="marquee-content">
        <span>🚗 WELCOME TO EPIC TOYZ • PREMIUM RC CARS • FAST SHIPPING ACROSS INDIA • 100% GENUINE PRODUCTS •</span>
        <span>🚗 WELCOME TO EPIC TOYZ • PREMIUM RC CARS • FAST SHIPPING ACROSS INDIA • 100% GENUINE PRODUCTS •</span>
      </div>
    </div>
  `;

  const navbarHTML = `
    <nav class="navbar" id="mainNavbar">
      <div class="container navbar-inner">
        <!-- Hamburger (Mobile) -->
        <button class="hamburger" id="mobileMenuBtn" aria-label="Open menu" aria-expanded="false">
          <span></span><span></span><span></span>
        </button>

        <!-- Logo -->
        <a href="${prefix}index.html" class="navbar-logo">
          <img
            src="${prefix}assets/images/epictoyz-logo.png"
            alt="Epic Toyz Logo"
            class="navbar-logo-img"
            onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
          >
          <div class="logo-fallback" style="display:none;align-items:center;gap:8px;">
            <div class="logo-badge">ET</div>
            <div class="logo-text">EPIC <span>TOYZ</span></div>
          </div>
        </a>

        <!-- Desktop Navigation -->
        <div class="navbar-nav">
          <a href="${prefix}index.html" class="nav-link ${isHome ? 'active' : ''}">Home</a>
          <a href="${prefix}shop.html" class="nav-link ${isShop ? 'active' : ''}">Shop</a>

          <!-- Categories Dropdown -->
          <div class="nav-dropdown" id="categoriesNavDropdown">
            <button class="nav-link nav-dropdown-btn" id="categoriesDropdownTrigger" aria-haspopup="true" aria-expanded="false">
              Categories
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin-left:4px;transition:transform 0.2s;" id="catDropdownArrow"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            <div class="nav-dropdown-menu" id="categoriesDropdownMenu" role="menu">
              <a href="${prefix}shop.html?category=drift-cars" class="nav-dropdown-item" role="menuitem">
                <span class="nav-dropdown-icon">🏎️</span>
                <div>
                  <div class="nav-dropdown-label">Drift Cars</div>
                  <div class="nav-dropdown-sublabel">Precision sideways machines</div>
                </div>
              </a>
              <a href="${prefix}shop.html?category=mini-rc" class="nav-dropdown-item" role="menuitem">
                <span class="nav-dropdown-icon">🚗</span>
                <div>
                  <div class="nav-dropdown-label">Mini RC Cars</div>
                  <div class="nav-dropdown-sublabel">Compact & fast indoor cars</div>
                </div>
              </a>
              <a href="${prefix}shop.html?category=hobby-grade" class="nav-dropdown-item" role="menuitem">
                <span class="nav-dropdown-icon">⚡</span>
                <div>
                  <div class="nav-dropdown-label">Hobby Grade</div>
                  <div class="nav-dropdown-sublabel">Professional performance</div>
                </div>
              </a>
              <a href="${prefix}shop.html?category=crawlers" class="nav-dropdown-item" role="menuitem">
                <span class="nav-dropdown-icon">⛰️</span>
                <div>
                  <div class="nav-dropdown-label">Rock Crawlers</div>
                  <div class="nav-dropdown-sublabel">Off-road terrain beasts</div>
                </div>
              </a>
              <a href="${prefix}shop.html?category=unique-rc" class="nav-dropdown-item" role="menuitem">
                <span class="nav-dropdown-icon">🤖</span>
                <div>
                  <div class="nav-dropdown-label">Unique RC Cars</div>
                  <div class="nav-dropdown-sublabel">Wall climbers, amphibians & more</div>
                </div>
              </a>
              <a href="${prefix}shop.html" class="nav-dropdown-item nav-dropdown-all" role="menuitem">
                View All Products →
              </a>
            </div>
          </div>

          <a href="${prefix}pages/about.html" class="nav-link ${isAbout ? 'active' : ''}">About</a>
          <a href="${prefix}pages/contact.html" class="nav-link ${isContact ? 'active' : ''}">Contact</a>
          <a href="${prefix}pages/faq.html" class="nav-link ${isFAQ ? 'active' : ''}">FAQ</a>
        </div>

        <!-- Action Buttons -->
        <div class="navbar-actions">
          <!-- Search -->
          <a href="${prefix}shop.html?focusSearch=true" class="nav-icon-btn" title="Search Products" aria-label="Search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          </a>

          <!-- Wishlist -->
          <a href="${prefix}wishlist.html" class="nav-icon-btn ${isWishlist ? 'active' : ''}" title="Wishlist" aria-label="Wishlist">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>
            <span class="nav-badge wishlist-badge" style="display: none;">0</span>
          </a>

          <!-- Cart -->
          <a href="${prefix}cart.html" class="nav-icon-btn ${isCart ? 'active' : ''}" title="Cart" aria-label="Shopping Cart">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
            <span class="nav-badge cart-badge" style="display: none;">0</span>
          </a>

          <!-- Instagram -->
          <a href="https://www.instagram.com/epictoyz.in/" target="_blank" class="nav-icon-btn" title="Follow us on Instagram" aria-label="Instagram">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
          </a>

          <!-- Account -->
          <button class="nav-icon-btn" id="navAccountBtn" title="Account" aria-label="Account">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
          </button>
        </div>
      </div>

      <!-- Mobile Navigation Drawer -->
      <div class="mobile-nav" id="mobileNavMenu" role="navigation" aria-label="Mobile navigation">
        <a href="${prefix}index.html" class="nav-link ${isHome ? 'active' : ''}">🏠 Home</a>
        <a href="${prefix}shop.html" class="nav-link ${isShop ? 'active' : ''}">🛍️ All Products</a>
        <div class="mobile-nav-section-label">Categories</div>
        <a href="${prefix}shop.html?category=drift-cars" class="nav-link nav-link-sub">🏎️ Drift Cars</a>
        <a href="${prefix}shop.html?category=mini-rc" class="nav-link nav-link-sub">🚗 Mini RC Cars</a>
        <a href="${prefix}shop.html?category=hobby-grade" class="nav-link nav-link-sub">⚡ Hobby Grade</a>
        <a href="${prefix}shop.html?category=crawlers" class="nav-link nav-link-sub">⛰️ Rock Crawlers</a>
        <a href="${prefix}shop.html?category=unique-rc" class="nav-link nav-link-sub">🤖 Unique RC Cars</a>
        <div class="mobile-nav-divider"></div>
        <a href="${prefix}pages/about.html" class="nav-link ${isAbout ? 'active' : ''}">About Us</a>
        <a href="${prefix}pages/contact.html" class="nav-link ${isContact ? 'active' : ''}">Contact</a>
        <a href="${prefix}pages/faq.html" class="nav-link ${isFAQ ? 'active' : ''}">FAQ</a>
        <div class="mobile-nav-divider"></div>
        <a href="${prefix}cart.html" class="nav-link">🛒 Cart</a>
        <a href="${prefix}wishlist.html" class="nav-link">❤️ Wishlist</a>
        <a href="https://www.instagram.com/epictoyz.in/" target="_blank" class="nav-link" style="color: #FFD700 !important; font-weight: 600;">📸 Instagram (@epictoyz.in)</a>
        <div class="mobile-nav-divider auth-divider" style="display:none;"></div>
        <div id="mobileNavAuthSection"></div>
      </div>
    </nav>
  `;
  navbarPlaceholder.innerHTML = marqueeHTML + navbarHTML;

  // Inject Global Search Overlay if not present
  if (!document.getElementById('globalSearchOverlay')) {
    const overlayHTML = `
      <div class="search-overlay" id="globalSearchOverlay" style="display: none; position: fixed; inset: 0; z-index: 9999; flex-direction: column; align-items: center; justify-content: flex-start; padding-top: 80px; font-family: 'Inter', sans-serif;">
        <div class="search-overlay-backdrop" style="position: absolute; inset: 0; background: rgba(13, 14, 26, 0.95); backdrop-filter: blur(12px);"></div>
        <div class="search-overlay-container" style="position: relative; width: 90%; max-width: 700px; background: #12151F; border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(230, 57, 70, 0.1); display: flex; flex-direction: column; max-height: 80vh; overflow: hidden;">
          <div class="search-overlay-header" style="display: flex; align-items: center; gap: 16px; padding: 20px; border-bottom: 1px solid rgba(255, 255, 255, 0.08);">
            <div class="search-input-wrap" style="flex: 1; display: flex; align-items: center; gap: 12px; background: rgba(255, 255, 255, 0.03); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 12px; padding: 12px 16px; position: relative;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E63946" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input type="text" id="globalSearchInput" placeholder="Search remote control cars, drift, crawlers..." autocomplete="off" style="flex: 1; background: transparent; border: none; color: #fff; font-family: inherit; font-size: 1.05rem; font-weight: 500; outline: none;">
              <button class="search-clear-btn" id="globalSearchClear" style="display: none; background: transparent; border: none; color: #ADB5BD; font-size: 1.1rem; cursor: pointer; padding: 0 4px;">✕</button>
            </div>
            <button class="search-close-btn" id="globalSearchClose" style="background: transparent; border: 1.5px solid rgba(255, 255, 255, 0.2); color: #fff; font-family: inherit; font-size: 0.9rem; font-weight: 600; padding: 10px 18px; border-radius: 12px; cursor: pointer; transition: all 0.2s;">Close</button>
          </div>
          <div class="search-results-container" id="globalSearchResults" style="flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 12px;">
            <p style="text-align: center; color: #ADB5BD; font-size: 0.95rem; margin: 20px 0;">Type to search for RC cars...</p>
          </div>
        </div>
      </div>
    `;
    const container = document.createElement('div');
    container.innerHTML = overlayHTML;
    document.body.appendChild(container.firstElementChild);
    if (typeof initGlobalSearchLogic === 'function') initGlobalSearchLogic();
  }

  // Intercept Search Button click to open overlay
  const searchBtn = navbarPlaceholder.querySelector('a[aria-label="Search"]');
  if (searchBtn) {
    searchBtn.addEventListener('click', (e) => {
      e.preventDefault();
      if (typeof openGlobalSearchOverlay === 'function') openGlobalSearchOverlay();
    });
  }

  // --- NAVBAR INTERACTIVE BEHAVIOR ---
  
  // Categories Dropdown Toggle
  const categoriesDropdown = document.getElementById('categoriesNavDropdown');
  const dropdownMenu = document.getElementById('categoriesDropdownMenu');
  if (categoriesDropdown && dropdownMenu) {
    categoriesDropdown.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('open');
      categoriesDropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('open');
      categoriesDropdown.classList.remove('open');
    });
  }

  // Hamburger Toggle for Mobile
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileNavMenu = document.getElementById('mobileNavMenu');
  if (mobileMenuBtn && mobileNavMenu) {
    mobileMenuBtn.addEventListener('click', () => {
      mobileNavMenu.classList.toggle('open');
      const spans = mobileMenuBtn.querySelectorAll('span');
      if (mobileNavMenu.classList.contains('open')) {
        spans[0].style.transform = 'rotate(45deg) translate(5px, 5px)';
        spans[1].style.opacity = '0';
        spans[2].style.transform = 'rotate(-45deg) translate(5px, -5px)';
      } else {
        spans[0].style.transform = 'none';
        spans[1].style.opacity = '1';
        spans[2].style.transform = 'none';
      }
    });
  }

  // User Account Redirect
  const navAccountBtn = document.getElementById('navAccountBtn');
  if (navAccountBtn) {
    navAccountBtn.addEventListener('click', () => {
      // Check auth state
      if (typeof Auth !== 'undefined') {
        const currentUser = Auth.getCurrentUser();
        if (currentUser) {
          if (Auth.isAdmin(currentUser.email)) {
            window.location.href = `${prefix}admin/dashboard.html`;
          } else {
            window.location.href = `${prefix}profile.html`;
          }
        } else {
          window.location.href = `${prefix}admin/login.html`;
        }
      } else {
        window.location.href = `${prefix}admin/login.html`;
      }
    });
  }

  // Sticky navbar effect on scroll
  const mainNavbar = document.getElementById('mainNavbar');
  if (mainNavbar) {
    window.addEventListener('scroll', () => {
      if (window.scrollY > 10) {
        document.body.classList.add('scrolled-down');
      } else {
        document.body.classList.remove('scrolled-down');
      }

      if (window.scrollY > 50) {
        mainNavbar.classList.add('scrolled');
      } else {
        mainNavbar.classList.remove('scrolled');
      }
    });
  }

  // Trigger navbar auth update to populate user session info and mobile auth menu
  if (typeof Auth !== 'undefined' && Auth.updateNavbarAuth) {
    Auth.updateNavbarAuth();
  }
}

// --- INJECT FOOTER BAR ---
function injectFooter() {
  const footerPlaceholder = document.getElementById('footer-placeholder');
  if (!footerPlaceholder) return;

  const footerHTML = `
    <footer class="footer section">
      <div class="container footer-grid">
        <!-- Column 1: Brand Info -->
        <div class="footer-brand">
          <a href="${prefix}index.html" class="footer-logo" style="margin-bottom: var(--space-4); display: flex; align-items: center; gap: 8px;">
            <img
              src="${prefix}assets/images/epictoyz-logo.png"
              alt="Epic Toyz Logo"
              class="footer-logo-img"
              style="height:auto;width:140px;object-fit:contain;"
              onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
            >
            <div class="logo-fallback" style="display:none;align-items:center;gap:8px;">
              <div class="logo-badge">ET</div>
              <div class="logo-text">EPIC <span>TOYZ</span></div>
            </div>
          </a>
          <p class="footer-description" style="margin-bottom: var(--space-4);">
            India's ultimate high-end RC car shop. We supply top quality Drift Cars, Crawlers, Mini RC cars, and Hobby Grade racers.
          </p>
          <div class="footer-social" style="display: flex; gap: 8px; margin-bottom: 12px;">
            <a href="https://www.instagram.com/epictoyz.in/" target="_blank" class="social-icon instagram" title="Instagram"><i class="fa-brands fa-instagram"></i></a>
            <a href="https://facebook.com" target="_blank" class="social-icon facebook" title="Facebook"><i class="fa-brands fa-facebook-f"></i></a>
            <a href="https://www.youtube.com/@EpicToyz-q4t" target="_blank" class="social-icon youtube" title="YouTube"><i class="fa-brands fa-youtube"></i></a>
            <a href="https://chat.whatsapp.com/Bn4iOdLH5U22kpSyYIIV7i" target="_blank" class="social-icon whatsapp" title="WhatsApp Community"><i class="fa-brands fa-whatsapp"></i></a>
          </div>
          <a href="https://www.instagram.com/epictoyz.in/" target="_blank" class="btn btn-sm btn-ghost" style="margin-top: var(--space-2); display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.08); font-size: 12px; font-weight: 600; color: #ADB5BD; background: rgba(255,255,255,0.02);">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
            @epictoyz.in
          </a>
        </div>

        <!-- Column 2: Quick Links -->
        <div>
          <h4 class="footer-title" style="color: white; margin-bottom: var(--space-4);">Quick Links</h4>
          <ul class="footer-links">
            <li><a href="${prefix}index.html" class="footer-link">Home</a></li>
            <li><a href="${prefix}shop.html" class="footer-link">All Products</a></li>
            <li><a href="${prefix}pages/about.html" class="footer-link">About Us</a></li>
            <li><a href="${prefix}pages/contact.html" class="footer-link">Contact Us</a></li>
            <li><a href="${prefix}pages/faq.html" class="footer-link">FAQ</a></li>
          </ul>
        </div>

        <!-- Column 3: Categories -->
        <div>
          <h4 class="footer-title" style="color: white; margin-bottom: var(--space-4);">Categories</h4>
          <ul class="footer-links">
            <li><a href="${prefix}shop.html?category=drift-cars" class="footer-link">Drift Cars</a></li>
            <li><a href="${prefix}shop.html?category=mini-rc" class="footer-link">Mini RC Cars</a></li>
            <li><a href="${prefix}shop.html?category=hobby-grade" class="footer-link">Hobby Grade</a></li>
            <li><a href="${prefix}shop.html?category=crawlers" class="footer-link">Crawlers</a></li>
            <li><a href="${prefix}shop.html?category=unique-rc" class="footer-link">Unique RC Cars</a></li>
          </ul>
        </div>

        <!-- Column 4: Contact & Policy -->
        <div>
          <h4 class="footer-title" style="color: white; margin-bottom: var(--space-4);">Contact Info</h4>
          <ul class="footer-links" style="margin-bottom: var(--space-4);">
            <li class="footer-contact-item">📍 India</li>
            <li class="footer-contact-item">💬 Support: +91 6383793890</li>
            <li class="footer-contact-item">✉️ epictoyz.in@gmail.com</li>
          </ul>
          <h4 class="footer-title" style="color: white; margin-bottom: var(--space-2); font-size: var(--font-sm);">Legal</h4>
          <div class="flex gap-3">
            <a href="${prefix}pages/privacy.html" class="footer-link text-xs">Privacy Policy</a>
            <span class="text-muted text-xs">|</span>
            <a href="${prefix}pages/terms.html" class="footer-link text-xs">Terms & Conditions</a>
          </div>
        </div>
      </div>
      
      <div class="container footer-bottom" style="margin-top: var(--space-10); padding-top: var(--space-4); border-top: 1px solid var(--border); text-align: center;">
        <p class="text-muted text-xs">&copy; ${new Date().getFullYear()} Epic Toyz. All Rights Reserved. Created for premium RC enthusiasts in India.</p>
      </div>
    </footer>
  `;
  footerPlaceholder.innerHTML = footerHTML;
}

// --- FLOATING WHATSAPP BUTTON ---
function renderWhatsAppFloat() {
  // Prevent duplicate floating buttons
  if (document.getElementById('whatsapp-float-btn')) return;

  const waFloat = document.createElement('a');
  waFloat.id = 'whatsapp-float-btn';
  waFloat.href = 'https://wa.me/916383793890?text=Hi%20Epic%20Toyz!%20I%20am%20interested%20in%20your%20RC%20cars.';
  waFloat.target = '_blank';
  waFloat.className = 'wa-float wa-pulse';
  waFloat.innerHTML = `<svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" style="display:block;"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>`; // Can styled as green WhatsApp icon
  waFloat.title = 'Order via WhatsApp';
  
  // Custom styling override directly in case components.css is still loading
  Object.assign(waFloat.style, {
    position: 'fixed',
    bottom: '24px',
    right: '24px',
    width: '56px',
    height: '56px',
    backgroundColor: '#25D366',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '28px',
    boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
    zIndex: '999',
    textDecoration: 'none',
    cursor: 'pointer'
  });

  document.body.appendChild(waFloat);
}

// --- TOAST NOTIFICATIONS ---
/**
 * Renders a highly styled toast notification.
 * @param {string} message - Message text.
 * @param {'success'|'error'|'warning'|'info'} type - Type of toast.
 */
function showToast(message, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    container.className = 'toast-container';
    // Style toast container programmatically if needed
    Object.assign(container.style, {
      position: 'fixed',
      top: '90px',
      right: '20px',
      zIndex: '2000',
      display: 'flex',
      flexDirection: 'column',
      gap: '10px',
      pointerEvents: 'none'
    });
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const icons = {
    success: '✅',
    error: '❌',
    warning: '⚠️',
    info: 'ℹ️'
  };

  toast.innerHTML = `
    <span style="margin-right: var(--space-2);">${icons[type]}</span>
    <span>${message}</span>
  `;

  // Apply base toast styling inline in case styles load slowly
  Object.assign(toast.style, {
    minWidth: '280px',
    padding: '12px 20px',
    borderRadius: 'var(--radius-md, 8px)',
    backgroundColor: 'var(--dark-800, #12151F)',
    borderLeft: `4px solid ${
      type === 'success' ? '#2ecc71' : 
      type === 'error' ? '#e74c3c' : 
      type === 'warning' ? '#f39c12' : '#3498db'
    }`,
    boxShadow: 'var(--shadow-lg, 0 8px 24px rgba(0,0,0,0.4))',
    color: '#ffffff',
    fontSize: 'var(--font-sm, 14px)',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    pointerEvents: 'auto',
    animation: 'toastIn 0.3s ease forwards'
  });

  container.appendChild(toast);

  // Auto-remove toast after 3.5s
  setTimeout(() => {
    toast.style.animation = 'toastOut 0.3s ease forwards';
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3500);
}

// --- SCROLL REVEAL ANIMATIONS ---
function initScrollReveal() {
  const reveals = document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale');
  if (reveals.length === 0) return;

  const observerOptions = {
    root: null,
    rootMargin: '0px 0px 80px 0px',
    threshold: 0.02
  };

  const observer = new IntersectionObserver((entries, observer) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        entry.target.classList.add('revealed');
        observer.unobserve(entry.target);
      }
    });
  }, observerOptions);

  reveals.forEach(el => observer.observe(el));
}

// --- MODAL UTILITY ---
/**
 * Opens a clean modal overlay with the custom HTML content.
 * @param {string} contentHTML - HTML content for the modal body.
 */
function openModal(contentHTML) {
  let modalOverlay = document.getElementById('modal-overlay');
  if (!modalOverlay) {
    modalOverlay = document.createElement('div');
    modalOverlay.id = 'modal-overlay';
    modalOverlay.className = 'modal-overlay';
    
    Object.assign(modalOverlay.style, {
      position: 'fixed',
      inset: '0',
      backgroundColor: 'rgba(5, 5, 10, 0.85)',
      backdropFilter: 'blur(10px)',
      webkitBackdropFilter: 'blur(10px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: '1500',
      opacity: '0',
      transition: 'opacity 0.3s ease'
    });
    
    document.body.appendChild(modalOverlay);
  }

  modalOverlay.innerHTML = `
    <div class="modal reveal visible" style="background: var(--dark-800); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: var(--space-6); width: 90%; maxWidth: 500px; position: relative; box-shadow: var(--shadow-xl);">
      <button class="modal-close" onclick="closeModal()" style="position: absolute; top: 15px; right: 15px; font-size: 20px; color: var(--text-muted); cursor: pointer;">✕</button>
      <div class="modal-body">${contentHTML}</div>
    </div>
  `;

  modalOverlay.style.display = 'flex';
  setTimeout(() => {
    modalOverlay.style.opacity = '1';
  }, 10);
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  const modalOverlay = document.getElementById('modal-overlay');
  if (!modalOverlay) return;

  modalOverlay.style.opacity = '0';
  setTimeout(() => {
    modalOverlay.style.display = 'none';
    modalOverlay.innerHTML = '';
    document.body.style.overflow = '';
  }, 300);
}

// --- PAGE TRANSITIONS ---
function initPageTransitions() {
  const overlay = document.getElementById('pageTransition') || document.createElement('div');
  if (!overlay.id) {
    overlay.id = 'pageTransition';
    overlay.className = 'page-transition';
    document.body.appendChild(overlay);
  }

  // Intercept all local links for smooth out transitions
  document.querySelectorAll('a').forEach(anchor => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:') || anchor.target === '_blank') {
        return;
      }
      
      e.preventDefault();
      overlay.classList.add('active');
      setTimeout(() => {
        try {
          const targetUrl = new URL(href, window.location.origin);
          if (targetUrl.pathname === window.location.pathname) {
            window.location.href = href;
            window.location.reload();
          } else {
            window.location.href = href;
          }
        } catch (err) {
          window.location.href = href;
        }
      }, 300);
    });
  });
}

// --- UTILITY FORMATTERS ---
/**
 * Formats a number to Indian Rupee (INR) currency format.
 * @param {number} num - Value in numbers.
 * @returns {string} Formatted string.
 */
function formatPrice(num) {
  if (num === null || num === undefined) return '';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0
  }).format(num);
}

/**
 * Formats a date string into readable text.
 * @param {string|Date} date - Date.
 * @returns {string} Formatted date.
 */
function formatDate(date) {
  if (!date) return '';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

/**
 * Generates Star Rating HTML markup.
 * @param {number} rating - Score out of 5.
 * @returns {string} SVG/Icon star markup.
 */
function renderStars(rating) {
  const rounded = Math.round(rating);
  let starsHTML = '';
  for (let i = 1; i <= 5; i++) {
    if (i <= rounded) {
      starsHTML += '<span class="star" style="color: var(--gold, #FFD700); margin-right: 2px;">★</span>';
    } else {
      starsHTML += '<span class="star-empty" style="color: var(--text-muted, #6c757d); margin-right: 2px;">★</span>';
    }
  }
  return starsHTML;
}

/**
 * Generates a unique order number for checkout.
 * @returns {string} Order format ET-XXXXXXXX.
 */
function generateOrderNumber() {
  const rand = Math.floor(10000000 + Math.random() * 90000000);
  return `ET-${rand}`;
}

/**
 * Helper to generate pre-filled WhatsApp message.
 * @param {Array} cart - Shopping cart array.
 * @param {Object} customer - Customer order details.
 * @returns {string} URL encoded WhatsApp query message.
 */
function generateWhatsAppMessage(cart, customer) {
  let message = `🏎️ *NEW ORDER FROM EPIC TOYZ* 🏎️\n\n`;
  
  if (customer && customer.orderId) {
    message += `*Order ID:* ${customer.orderId}\n`;
  }
  
  message += `*Products Ordered:*\n`;
  let subtotal = 0;
  cart.forEach(item => {
    message += `- ${item.name} x${item.quantity} (${formatPrice(item.price * item.quantity)})\n`;
    subtotal += item.price * item.quantity;
  });
  
  const shipping = 50;
  const total = subtotal + shipping;
  
  message += `\n*Subtotal:* ${formatPrice(subtotal)}`;
  message += `\n*Shipping:* ${formatPrice(shipping)}`;
  message += `\n*Grand Total:* ${formatPrice(total)}\n\n`;

  if (customer) {
    message += `👤 *Customer Details:*\n`;
    message += `- *Name:* ${customer.name}\n`;
    message += `- *Phone:* ${customer.phone}\n`;
    message += `- *Delivery Address:* ${customer.address}, ${customer.city} - ${customer.zip}\n\n`;
  }
  
  message += `💳 *Preferred Payment:* UPI ID (yogesh2007.gv@oksbi)\n`;
  message += `✨ Please confirm my order and send the payment request link.`;
  
  return encodeURIComponent(message);
}

/**
 * Debounce helper function.
 * @param {Function} fn - Target callback.
 * @param {number} delay - Timeout in milliseconds.
 * @returns {Function} Debounced function wrapper.
 */
function debounce(fn, delay) {
  let timer;
  return function (...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), delay);
  };
}

// --- DOM INITIALIZER ---
document.addEventListener('DOMContentLoaded', () => {
  // 1. Inject common components
  injectNavbar();
  injectFooter();

  // 2. Add floating WhatsApp support
  renderWhatsAppFloat();

  // 3. Initialize animations and transitions
  initScrollReveal();
  initPageTransitions();

  // 4. Sync badges with Store values
  if (typeof Store !== 'undefined') {
    Store.syncCartBadge();
    Store.syncWishlistBadge();
  }
});

// Make utilities globally accessible
window.showToast = showToast;
window.openModal = openModal;
window.closeModal = closeModal;
window.formatPrice = formatPrice;
window.formatDate = formatDate;
window.renderStars = renderStars;
window.generateOrderNumber = generateOrderNumber;
window.generateWhatsAppMessage = generateWhatsAppMessage;
window.debounce = debounce;
window.getPathPrefix = getPathPrefix;

// Bridge the UI namespace to resolve Vercel deployment issues
window.UI = {
  loadNavbar: injectNavbar,
  loadFooter: injectFooter,
  toast: showToast,
  showToast: showToast,
  openModal: openModal,
  closeModal: closeModal,
  updateWishlistBadge: () => { if (typeof Store !== 'undefined') Store.syncWishlistBadge(); },
  updateCartBadge: () => { if (typeof Store !== 'undefined') Store.syncCartBadge(); }
};

// --- GLOBAL SEARCH OVERLAY ---
let searchProductsList = [];
let searchOverlayInitialized = false;

function openGlobalSearchOverlay() {
  const overlay = document.getElementById('globalSearchOverlay');
  if (!overlay) return;
  
  overlay.style.display = 'flex';
  document.body.style.overflow = 'hidden';
  
  const input = document.getElementById('globalSearchInput');
  if (input) {
    input.value = '';
    input.focus();
  }
  
  const resultsContainer = document.getElementById('globalSearchResults');
  if (resultsContainer) {
    resultsContainer.innerHTML = '<p style="text-align: center; color: #ADB5BD; font-size: 0.95rem; margin: 20px 0;">Type to search for RC cars...</p>';
  }
  
  const clearBtn = document.getElementById('globalSearchClear');
  if (clearBtn) clearBtn.style.display = 'none';

  // Load products dynamically on open to ensure it's always real-time
  loadSearchProducts();
}

function closeGlobalSearchOverlay() {
  const overlay = document.getElementById('globalSearchOverlay');
  if (overlay) {
    overlay.style.display = 'none';
    document.body.style.overflow = '';
  }
}

async function loadSearchProducts() {
  try {
    if (typeof DB !== 'undefined' && DB.getProducts) {
      searchProductsList = await DB.getProducts();
    } else {
      searchProductsList = JSON.parse(localStorage.getItem('et_products') || '[]');
    }
  } catch (e) {
    console.warn('[Search] Failed to fetch products from DB, using local fallback:', e);
    searchProductsList = JSON.parse(localStorage.getItem('et_products') || '[]');
  }
}

function initGlobalSearchLogic() {
  if (searchOverlayInitialized) return;
  
  const input = document.getElementById('globalSearchInput');
  const closeBtn = document.getElementById('globalSearchClose');
  const backdrop = document.querySelector('.search-overlay-backdrop');
  const clearBtn = document.getElementById('globalSearchClear');
  const resultsContainer = document.getElementById('globalSearchResults');
  
  if (input) {
    input.addEventListener('input', (e) => {
      const q = e.target.value.trim().toLowerCase();
      if (clearBtn) clearBtn.style.display = q ? 'block' : 'none';
      
      if (!q) {
        resultsContainer.innerHTML = '<p style="text-align: center; color: #ADB5BD; font-size: 0.95rem; margin: 20px 0;">Type to search for RC cars...</p>';
        return;
      }
      
      // Perform Search (case-insensitive, partial matching)
      const matches = searchProductsList.filter(p => 
        (p.name || '').toLowerCase().includes(q) ||
        (p.category || '').toLowerCase().includes(q) ||
        (p.brand || '').toLowerCase().includes(q) ||
        (p.description || '').toLowerCase().includes(q)
      );
      
      renderSearchResults(matches, q);
    });
    
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        closeGlobalSearchOverlay();
      }
    });
  }
  
  if (clearBtn && input) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      clearBtn.style.display = 'none';
      input.focus();
      resultsContainer.innerHTML = '<p style="text-align: center; color: #ADB5BD; font-size: 0.95rem; margin: 20px 0;">Type to search for RC cars...</p>';
    });
  }
  
  if (closeBtn) {
    closeBtn.addEventListener('click', closeGlobalSearchOverlay);
  }
  
  if (backdrop) {
    backdrop.addEventListener('click', closeGlobalSearchOverlay);
  }
  
  searchOverlayInitialized = true;
}

function renderSearchResults(products, query) {
  const container = document.getElementById('globalSearchResults');
  if (!container) return;
  
  if (products.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px 20px; color: #ADB5BD;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">🔍</div>
        <h3 style="color: #fff; font-size: 1.1rem; margin-bottom: 6px;">No products found for "${escapeHtml(query)}"</h3>
        <p style="font-size: 0.9rem;">Try searching for "drift", "crawler", or "hyper go"</p>
      </div>
    `;
    return;
  }
  
  const prefix = getPathPrefix();
  
  container.innerHTML = products.map(p => {
    const img = p.image || (p.images && p.images[0]) || 'assets/images/placeholder.svg';
    const price = typeof p.price === 'number' ? p.price.toLocaleString('en-IN') : p.price;
    const catName = p.category ? p.category.charAt(0).toUpperCase() + p.category.slice(1).replace('-', ' ') : 'RC Car';
    
    return `
      <a href="${prefix}product.html?id=${p.id}" class="search-result-item" style="display: flex; align-items: center; gap: 16px; padding: 12px; background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.04); border-radius: 12px; text-decoration: none; transition: all 0.25s ease;">
        <img src="${prefix}${img}" alt="" class="search-result-img" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px; background: rgba(255, 255, 255, 0.05);" onerror="this.src='${prefix}assets/images/placeholder.svg'">
        <div class="search-result-info" style="flex: 1;">
          <div class="search-result-name" style="font-weight: 600; color: #fff; font-size: 0.95rem; margin-bottom: 2px;">${escapeHtml(p.name)}</div>
          <div class="search-result-meta" style="font-size: 0.78rem; color: #ADB5BD; display: flex; gap: 8px;">
            <span>Category: <strong>${escapeHtml(catName)}</strong></span>
            ${p.brand ? `<span>Brand: <strong>${escapeHtml(p.brand)}</strong></span>` : ''}
          </div>
        </div>
        <div class="search-result-price" style="font-weight: 700; color: #E63946; font-size: 1rem;">₹${price}</div>
      </a>
    `;
  }).join('');

  // Add hover effect dynamically via JS
  const items = container.querySelectorAll('.search-result-item');
  items.forEach(item => {
    item.addEventListener('mouseenter', () => {
      item.style.background = 'rgba(230, 57, 70, 0.08)';
      item.style.borderColor = 'rgba(230, 57, 70, 0.3)';
      item.style.transform = 'translateY(-2px)';
    });
    item.addEventListener('mouseleave', () => {
      item.style.background = 'rgba(255, 255, 255, 0.02)';
      item.style.borderColor = 'rgba(255, 255, 255, 0.04)';
      item.style.transform = 'none';
    });
  });
}

// Expose functions globally
window.openGlobalSearchOverlay = openGlobalSearchOverlay;
window.closeGlobalSearchOverlay = closeGlobalSearchOverlay;
window.initGlobalSearchLogic = initGlobalSearchLogic;

function escapeHtml(str) {
  if (!str) return '';
  return str
    .toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
window.escapeHtml = escapeHtml;
