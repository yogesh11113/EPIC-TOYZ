/**
 * checkout.js — Epic Toyz Checkout Page Logic
 * Handles 3-step checkout: Account → Delivery → Payment
 */

'use strict';

/* ============================================================
   STATE
   ============================================================ */
const CheckoutState = {
  currentStep: 1,
  user: null,            // logged in user or guest info
  isGuest: false,
  delivery: {},          // filled delivery form
  deliveryMethod: 'standard', // or 'express'
  paymentMethod: 'whatsapp',
  orderId: null,
};

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCheckoutPage();
});

async function initCheckoutPage() {
  // Guard: redirect to cart if empty
  const cart = Store.getCart();
  if (!cart || cart.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  renderSidebar();
  updateStandardShippingLabel();

  // Check if user is already logged in
  try {
    const user = await Auth.getCurrentUser();
    if (user) {
      CheckoutState.user = user;
      prefillDeliveryFromUser(user);
      showStep(2);
    } else {
      showStep(1);
    }
  } catch (e) {
    showStep(1);
  }

  // Delivery method change listener
  document.querySelectorAll('input[name="delivery"]').forEach(radio => {
    radio.addEventListener('change', () => {
      CheckoutState.deliveryMethod = radio.value;
      renderSidebar();
    });
  });
}

/* ============================================================
   STEP NAVIGATION
   ============================================================ */
function showStep(n) {
  // Hide all steps
  document.querySelectorAll('.checkout-step').forEach(el => el.classList.remove('active'));

  // Show target step
  const target = document.getElementById(`checkout-step-${n}`);
  if (target) {
    target.classList.add('active');
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  CheckoutState.currentStep = n;
  updateProgressBar(n);
  renderSidebar(); // keep sidebar fresh
}

function updateProgressBar(activeStep) {
  for (let i = 1; i <= 3; i++) {
    const indicator = document.getElementById(`step-indicator-${i}`);
    const circle = document.getElementById(`step-circle-${i}`);
    if (!indicator || !circle) continue;

    indicator.classList.remove('active', 'completed');
    if (i < activeStep) {
      indicator.classList.add('completed');
      circle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else if (i === activeStep) {
      indicator.classList.add('active');
      circle.textContent = i;
    } else {
      circle.textContent = i;
    }
  }
}

/* ============================================================
   AUTH TAB SWITCH
   ============================================================ */
function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));

  const tabBtn = document.querySelector(`.auth-tab[onclick="switchAuthTab('${tab}')"]`);
  const form = document.getElementById(`${tab}-form`);
  if (tabBtn) tabBtn.classList.add('active');
  if (form) form.classList.add('active');
}

/* ============================================================
   STEP 1: LOGIN
   ============================================================ */
async function handleLogin() {
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errMsg = document.getElementById('login-error-msg');
  const btn = document.getElementById('btn-login');

  clearFieldErrors(['login-email', 'login-password']);
  errMsg.style.display = 'none';

  let valid = true;
  if (!isValidEmail(email)) {
    showFieldError('login-email', 'login-email-error'); valid = false;
  }
  if (!password) {
    showFieldError('login-password', 'login-password-error'); valid = false;
  }
  if (!valid) return;

  setLoading(btn, true);
  try {
    const result = await Auth.login(email, password);
    if (result && result.user) {
      CheckoutState.user = result.user;
      CheckoutState.isGuest = false;
      prefillDeliveryFromUser(result.user);
      showToast('Logged in successfully!', 'success');
      showStep(2);
    } else {
      throw new Error('Login failed');
    }
  } catch (err) {
    errMsg.textContent = err.message || 'Invalid email or password. Please try again.';
    errMsg.style.display = 'block';
  } finally {
    setLoading(btn, false, 'Login & Continue');
  }
}

/* ============================================================
   STEP 1: REGISTER
   ============================================================ */
async function handleRegister() {
  const name = document.getElementById('reg-name').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const phone = document.getElementById('reg-phone').value.trim();
  const password = document.getElementById('reg-password').value;
  const confirm = document.getElementById('reg-confirm').value;
  const errMsg = document.getElementById('reg-error-msg');
  const btn = document.getElementById('btn-register');

  clearFieldErrors(['reg-name','reg-email','reg-phone','reg-password','reg-confirm']);
  errMsg.style.display = 'none';

  let valid = true;
  if (!name) { showFieldError('reg-name', 'reg-name-error'); valid = false; }
  if (!isValidEmail(email)) { showFieldError('reg-email', 'reg-email-error'); valid = false; }
  if (!isValidPhone(phone)) { showFieldError('reg-phone', 'reg-phone-error'); valid = false; }
  if (!password || password.length < 6) { showFieldError('reg-password', 'reg-password-error'); valid = false; }
  if (password !== confirm) { showFieldError('reg-confirm', 'reg-confirm-error'); valid = false; }
  if (!valid) return;

  setLoading(btn, true);
  try {
    const result = await Auth.register({ name, email, phone, password });
    if (result && (result.user || result.session)) {
      CheckoutState.user = result.user || { name, email, phone };
      CheckoutState.isGuest = false;
      prefillDeliveryFromUser(CheckoutState.user);
      showToast('Account created successfully!', 'success');
      showStep(2);
    } else {
      throw new Error('Registration failed');
    }
  } catch (err) {
    errMsg.textContent = err.message || 'Registration failed. Please try again.';
    errMsg.style.display = 'block';
  } finally {
    setLoading(btn, false, 'Create Account & Continue');
  }
}

/* ============================================================
   STEP 1: GUEST
   ============================================================ */
function continueAsGuest() {
  const name = document.getElementById('guest-name').value.trim();
  const email = document.getElementById('guest-email').value.trim();
  const phone = document.getElementById('guest-phone').value.trim();

  if (!name) {
    showToast('Please enter your name to continue', 'error');
    document.getElementById('guest-name').focus();
    return;
  }

  CheckoutState.isGuest = true;
  CheckoutState.user = { name, email, phone, isGuest: true };

  // Prefill delivery
  if (name) document.getElementById('d-name').value = name;
  if (email) document.getElementById('d-email').value = email;
  if (phone) document.getElementById('d-phone').value = phone;

  showStep(2);
}

/* ============================================================
   STEP 2: DELIVERY FORM
   ============================================================ */
function handleDeliverySubmit() {
  const fields = {
    'd-name':    'd-name-error',
    'd-phone':   'd-phone-error',
    'd-email':   'd-email-error',
    'd-addr1':   'd-addr1-error',
    'd-city':    'd-city-error',
    'd-state':   'd-state-error',
    'd-pincode': 'd-pincode-error',
  };
  clearFieldErrors(Object.keys(fields));

  const getValue = id => document.getElementById(id)?.value?.trim() || '';
  const name    = getValue('d-name');
  const phone   = getValue('d-phone');
  const email   = getValue('d-email');
  const addr1   = getValue('d-addr1');
  const addr2   = getValue('d-addr2');
  const city    = getValue('d-city');
  const state   = getValue('d-state');
  const pincode = getValue('d-pincode');

  let valid = true;
  if (!name)             { showFieldError('d-name',    'd-name-error');    valid = false; }
  if (!isValidPhone(phone)){ showFieldError('d-phone',  'd-phone-error');  valid = false; }
  if (!isValidEmail(email)){ showFieldError('d-email',  'd-email-error');  valid = false; }
  if (!addr1)            { showFieldError('d-addr1',   'd-addr1-error');   valid = false; }
  if (!city)             { showFieldError('d-city',    'd-city-error');    valid = false; }
  if (!state)            { showFieldError('d-state',   'd-state-error');   valid = false; }
  if (!isValidPincode(pincode)){ showFieldError('d-pincode','d-pincode-error'); valid = false; }
  if (!valid) return;

  // Determine delivery method
  const deliveryRadio = document.querySelector('input[name="delivery"]:checked');
  CheckoutState.deliveryMethod = deliveryRadio ? deliveryRadio.value : 'standard';

  CheckoutState.delivery = { name, phone, email, addr1, addr2, city, state, pincode };

  // Populate order review table
  populateOrderReview();
  renderSidebar();
  showStep(3);
}

function populateOrderReview() {
  const cart = Store.getCart();
  const table = document.getElementById('order-review-table');
  if (!table) return;

  const rows = cart.map(item => {
    const lineTotal = (item.price * item.quantity).toLocaleString('en-IN');
    const img = item.image || 'assets/images/placeholder.svg';
    return `<tr>
      <td>
        <img src="${img}" alt="${escapeHtml(item.name)}" class="review-item-img" onerror="this.src='assets/images/placeholder.svg'">
        ${escapeHtml(item.name)}
      </td>
      <td style="color:#ADB5BD; text-align:center;">×${item.quantity}</td>
      <td>₹${lineTotal}</td>
    </tr>`;
  }).join('');

  table.innerHTML = `
    <thead>
      <tr>
        <th>Product</th>
        <th style="text-align:center;">Qty</th>
        <th>Total</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  `;
}

/* ============================================================
   PAYMENT PANEL TOGGLE
   ============================================================ */
function showPaymentPanel(method) {
  CheckoutState.paymentMethod = method;
  document.querySelectorAll('.payment-details-panel').forEach(p => p.classList.remove('visible'));
  const panel = document.getElementById(`panel-${method}`);
  if (panel) panel.classList.add('visible');
  renderSidebar();
}

/* ============================================================
   COPY UPI ID
   ============================================================ */
function copyUpiId() {
  const upiId = 'yogesh2007.gv@oksbi';
  navigator.clipboard.writeText(upiId).then(() => {
    showToast('UPI ID copied!', 'success');
  }).catch(() => {
    // Fallback
    const el = document.createElement('textarea');
    el.value = upiId;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast('UPI ID copied!', 'success');
  });
}

/* ============================================================
   WHATSAPP ORDER
   ============================================================ */
function generateWhatsAppOrder() {
  const cart = Store.getCart();
  const { delivery, deliveryMethod, paymentMethod } = CheckoutState;

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = 50;
  const codFee = paymentMethod === 'cod' ? 50 : 0;
  const total = subtotal + shipping + codFee;

  const itemLines = cart.map(item =>
    `  • ${item.name} ×${item.quantity} = ₹${(item.price * item.quantity).toLocaleString('en-IN')}`
  ).join('\n');

  const fullAddress = [delivery.addr1, delivery.addr2, delivery.city, delivery.state, delivery.pincode]
    .filter(Boolean).join(', ');

  const message = `🛒 *New Order Request - Epic Toyz*

👤 *Customer Name:* ${delivery.name || '—'}
📞 *Phone Number:* ${delivery.phone || '—'}
📍 *Address:* ${fullAddress || '—'}

📦 *ORDERED PRODUCTS:*
${itemLines}

💰 *Total Amount:* ₹${total.toLocaleString('en-IN')} (including shipping${codFee ? ' and COD fee' : ''})
💳 *Preferred Payment Method:* ${paymentMethodLabel(paymentMethod)}

💳 *Payment Details:*
UPI ID: 9363114113@sbi

Please complete the payment (if applicable) and send the payment screenshot along with this order message for faster confirmation.`;

  const encoded = encodeURIComponent(message);
  return `https://wa.me/916383793890?text=${encoded}`;
}

function paymentMethodLabel(method) {
  return { whatsapp: 'WhatsApp Order', upi: 'UPI Payment', cod: 'Cash on Delivery' }[method] || method;
}

/* ============================================================
   PLACE ORDER
   ============================================================ */
async function placeOrder() {
  const cart = Store.getCart();
  if (!cart || cart.length === 0) {
    showToast('Your cart is empty!', 'error');
    return;
  }

  const paymentRadio = document.querySelector('input[name="payment"]:checked');
  const paymentMethod = paymentRadio ? paymentRadio.value : 'whatsapp';
  CheckoutState.paymentMethod = paymentMethod;

  const btn = document.getElementById('btn-place-order');
  setLoading(btn, true);

  // Generate WhatsApp link
  const whatsappUrl = generateWhatsAppOrder();

  // Open WhatsApp chat in a new tab
  window.open(whatsappUrl, '_blank');

  // Clear cart
  Store.clearCart();
  if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();

  setLoading(btn, false, 'Continue Order on WhatsApp');

  // Update retry button link in success step
  const successWaBtn = document.getElementById('success-whatsapp-btn');
  if (successWaBtn) {
    successWaBtn.href = whatsappUrl;
  }

  // Show transition step (checkout-step-success)
  document.querySelectorAll('.checkout-step').forEach(el => el.classList.remove('active'));
  const successStep = document.getElementById('checkout-step-success');
  if (successStep) {
    successStep.classList.add('active');
    successStep.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  // Update progress bar to show completed
  for (let i = 1; i <= 3; i++) {
    const ind = document.getElementById(`step-indicator-${i}`);
    const circle = document.getElementById(`step-circle-${i}`);
    if (ind && circle) {
      ind.classList.remove('active');
      ind.classList.add('completed');
      circle.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    }
  }
}

/* ============================================================
   SIDEBAR RENDER
   ============================================================ */
function renderSidebar() {
  const cart = Store.getCart();
  const sidebarItems = document.getElementById('sidebar-items');
  const sidebarSummary = document.getElementById('sidebar-summary');
  if (!sidebarItems || !sidebarSummary) return;

  // Items
  sidebarItems.innerHTML = cart.map(item => {
    const img = item.image || 'assets/images/placeholder.svg';
    return `
      <div class="sidebar-item">
        <img class="sidebar-item-img" src="${img}" alt="${escapeHtml(item.name)}" onerror="this.src='assets/images/placeholder.svg'">
        <div class="sidebar-item-info">
          <div class="sidebar-item-name">${escapeHtml(item.name)}</div>
          <div class="sidebar-item-qty">Qty: ${item.quantity}</div>
        </div>
        <div class="sidebar-item-price">₹${(item.price * item.quantity).toLocaleString('en-IN')}</div>
      </div>
    `;
  }).join('') || '<p style="font-size:0.85rem; color:#ADB5BD; text-align:center; padding:10px 0;">Cart is empty</p>';

  // Summary
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const deliveryMethod = CheckoutState.deliveryMethod || 'standard';
  const shipping = 50;
  const paymentMethod = CheckoutState.paymentMethod || 'whatsapp';
  const codFee = paymentMethod === 'cod' ? 50 : 0;
  const total = subtotal + shipping + codFee;

  sidebarSummary.innerHTML = `
    <div class="sidebar-summary-row">
      <span class="lbl">Subtotal</span>
      <span class="val">₹${subtotal.toLocaleString('en-IN')}</span>
    </div>
    <div class="sidebar-summary-row">
      <span class="lbl">Shipping</span>
      <span class="val">₹${shipping}</span>
    </div>
    ${codFee ? `<div class="sidebar-summary-row"><span class="lbl">COD Fee</span><span class="val">₹${codFee}</span></div>` : ''}
    <div class="sidebar-total">
      <span class="lbl">Total</span>
      <span class="val">₹${total.toLocaleString('en-IN')}</span>
    </div>
  `;
}

/* ============================================================
   HELPERS
   ============================================================ */
function prefillDeliveryFromUser(user) {
  if (!user) return;
  const safe = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  safe('d-name',  user.name || user.user_metadata?.name || user.user_metadata?.full_name);
  safe('d-email', user.email);
  safe('d-phone', user.phone || user.user_metadata?.phone);
}

function updateStandardShippingLabel() {
  const el = document.getElementById('standard-price-label');
  if (!el) return;
  el.textContent = '₹50';
  el.style.color = '#ADB5BD';
}

function generateOrderId() {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substr(2, 5).toUpperCase();
  return `ET-${timestamp}${random}`;
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function isValidPhone(phone) {
  return /^[6-9]\d{9}$/.test(phone);
}

function isValidPincode(pin) {
  return /^\d{6}$/.test(pin);
}

function showFieldError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const error = document.getElementById(errorId);
  if (input) input.classList.add('error');
  if (error) error.classList.add('visible');
}

function clearFieldErrors(inputIds) {
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('error');
    // Find related error div
    const errEl = document.getElementById(`${id}-error`);
    if (errEl) errEl.classList.remove('visible');
  });
}

function setLoading(btn, loading, originalText) {
  if (!btn) return;
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> Processing...`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || originalText || 'Continue';
    btn.disabled = false;
  }
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
  }, 3500);
}
