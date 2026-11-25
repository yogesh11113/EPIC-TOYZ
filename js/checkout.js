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

function getCheckoutItems() {
  const params = new URLSearchParams(window.location.search);
  const isBuyNow = params.get('buynow') === 'true';
  if (isBuyNow) {
    const buyNowData = localStorage.getItem('et_buy_now');
    if (buyNowData) {
      try {
        return [JSON.parse(buyNowData)];
      } catch (e) {
        console.error('[Checkout] Failed to parse Buy Now data:', e);
      }
    }
  }
  return typeof Store !== 'undefined' ? Store.getCart() : [];
}

/* ============================================================
   INIT
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  initCheckoutPage();
});

async function initCheckoutPage() {
  // Guard: redirect to cart if empty
  const cart = getCheckoutItems();
  if (!cart || cart.length === 0) {
    window.location.href = 'cart.html';
    return;
  }

  renderSidebar();
  updateStandardShippingLabel();

  const params = new URLSearchParams(window.location.search);
  const isBuyNow = params.get('buynow') === 'true';

  // Check if user is already logged in
  let currentUser = null;
  try {
    currentUser = await Auth.getCurrentUser();
  } catch (e) {
    currentUser = null;
  }

  if (isBuyNow) {
    // ── BUY NOW FLOW: skip the login/guest choice screen ──────────────────
    // Go straight to delivery details for everyone.
    if (currentUser) {
      CheckoutState.user = currentUser;
      CheckoutState.isGuest = false;
      prefillDeliveryFromUser(currentUser);
      // Hide the guest mini-form since the user is logged in
      const guestSection = document.getElementById('buynow-guest-details');
      if (guestSection) guestSection.style.display = 'none';
    } else {
      // Guest: show a compact name/phone block at the top of the delivery form
      CheckoutState.isGuest = true;
      CheckoutState.user = { isGuest: true };
      const guestSection = document.getElementById('buynow-guest-details');
      if (guestSection) guestSection.style.display = 'block';
    }
    showStep(2);
  } else {
    // ── NORMAL CART CHECKOUT FLOW: existing behaviour unchanged ───────────
    if (currentUser) {
      CheckoutState.user = currentUser;
      prefillDeliveryFromUser(currentUser);
      showStep(2);
    } else {
      showStep(1);
    }
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
   STEP 1: GOOGLE & EMAIL LOGIN
   ============================================================ */
async function handleGoogleLogin() {
  const btn = document.getElementById('btn-google-checkout');
  if (btn) { btn.disabled = true; btn.textContent = 'Redirecting to Google...'; }
  try {
    if (typeof Auth === 'undefined' || !Auth.loginWithGoogle) {
      throw new Error('Google Sign-In is unavailable.');
    }
    const res = await Auth.loginWithGoogle(window.location.origin + '/checkout.html');
    if (res && res.error) throw new Error(res.error);
  } catch (err) {
    showToast(err.message || 'Could not start Google Sign-In.', 'error');
    if (btn) { btn.disabled = false; btn.textContent = 'Continue with Google'; }
  }
}

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
    const result = await Auth.register(email, password, { name, phone });
    if (result && result.user) {
      CheckoutState.user = result.user;
      CheckoutState.isGuest = false;
      prefillDeliveryFromUser(CheckoutState.user);
      showToast('Account created successfully!', 'success');
      showStep(2);
    } else {
      throw new Error(result?.error || 'Registration failed');
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
  prefillDeliveryName(name);
  const dPhone = document.getElementById('d-phone');
  if (dPhone && phone) dPhone.value = phone;

  showStep(2);
}

/* ============================================================
   STEP 2: DELIVERY FORM
   ============================================================ */
function handleDeliverySubmit() {
  clearFieldErrors(['d-first-name', 'd-last-name', 'd-phone', 'd-address1', 'd-city', 'd-state', 'd-phone2']);

  const getValue = id => document.getElementById(id)?.value?.trim() || '';
  const firstName = getValue('d-first-name');
  const lastName  = getValue('d-last-name');
  const phone     = getValue('d-phone');
  const address1  = getValue('d-address1');
  const address2  = getValue('d-address2');
  const city      = getValue('d-city');
  const state     = getValue('d-state');
  const phone2    = getValue('d-phone2');

  let valid = true;
  if (!firstName) { showFieldError('d-first-name', 'd-first-name-error'); valid = false; }
  if (!lastName)  { showFieldError('d-last-name', 'd-last-name-error'); valid = false; }
  if (!isValidPhone(phone)) { showFieldError('d-phone', 'd-phone-error'); valid = false; }
  if (!address1)  { showFieldError('d-address1', 'd-address1-error'); valid = false; }
  if (!city)      { showFieldError('d-city', 'd-city-error'); valid = false; }
  if (!state)     { showFieldError('d-state', 'd-state-error'); valid = false; }
  if (phone2 && !isValidPhone(phone2)) { showFieldError('d-phone2', 'd-phone2-error'); valid = false; }
  if (!valid) return;

  const fullName = `${firstName} ${lastName}`.trim();
  const fullAddress = [address1, address2, city, state].filter(Boolean).join(', ');

  // Reset cached pending Razorpay order if delivery details were updated
  CheckoutState.pendingOrder = null;

  CheckoutState.delivery = {
    firstName,
    lastName,
    name: fullName,
    phone,
    secondaryPhone: phone2,
    addressLine1: address1,
    addressLine2: address2,
    city,
    state,
    address: fullAddress
  };

  // Populate address review box
  const reviewDiv = document.getElementById('review-delivery-info');
  if (reviewDiv) {
    reviewDiv.innerHTML = `
      <strong>${escapeHtml(fullName)}</strong><br>
      📞 ${escapeHtml(phone)}${phone2 ? ` &nbsp;|&nbsp; Alt: ${escapeHtml(phone2)}` : ''}<br>
      📍 ${escapeHtml(address1)}${address2 ? `, ${escapeHtml(address2)}` : ''}<br>
      ${escapeHtml(city)}, ${escapeHtml(state)}
    `;
  }

  // Populate order review table
  populateOrderReview();
  renderSidebar();
  showStep(3);
}

function populateOrderReview() {
  const cart = getCheckoutItems();
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
      <td style="color:#536273; text-align:center;">×${item.quantity}</td>
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
   WHATSAPP ORDER
   ============================================================ */
function generateWhatsAppOrder() {
  const cart = getCheckoutItems();
  const { delivery } = CheckoutState;

  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = 150;
  const total = subtotal + shipping;

  const itemLines = cart.map(item =>
    `  • ${item.name} ×${item.quantity} = ₹${(item.price * item.quantity).toLocaleString('en-IN')}`
  ).join('\n');

  const addressLines = [delivery.addressLine1, delivery.addressLine2, delivery.city, delivery.state]
    .filter(Boolean)
    .join(', ') || delivery.address || '—';

  const message = `🛒 *New Order Request - Epic Toyz*

👤 *Customer Name:* ${delivery.name || '—'}
📞 *Phone Number:* ${delivery.phone || '—'}${delivery.secondaryPhone ? `\n📱 *Secondary Phone:* ${delivery.secondaryPhone}` : ''}
📍 *Address:* ${addressLines}

📦 *ORDERED PRODUCTS:*
${itemLines}

🚚 *Delivery Charge:* ₹${shipping}
💰 *Total Amount:* ₹${total.toLocaleString('en-IN')}

💳 *Payment Details (Direct UPI):*
UPI ID: 9363114113@sbi

Please complete the payment and send the payment screenshot along with this order message for faster confirmation.`;

  const encoded = encodeURIComponent(message);
  return `https://wa.me/916383793890?text=${encoded}`;
}

/* ============================================================
   RAZORPAY TEST MODE CHECKOUT
   ============================================================ */
function generateGuestToken() {
  const bytes = new Uint8Array(16);
  window.crypto.getRandomValues(bytes);
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

async function sha256Hex(str) {
  const buf = new TextEncoder().encode(str);
  const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
  return Array.from(new Uint8Array(hashBuf), b => b.toString(16).padStart(2, '0')).join('');
}

async function parseApiResponse(res) {
  const rawText = await res.text();
  if (!rawText) return { data: {}, isJson: true };
  try {
    return { data: JSON.parse(rawText), isJson: true };
  } catch (e) {
    return {
      data: { error: `Server returned non-JSON response (${res.status}). Please contact support if payment was deducted.` },
      isJson: false,
      rawText
    };
  }
}

async function getSupabaseAccessToken() {
  try {
    if (window.EpicSupabase && window.EpicSupabase.auth) {
      const { data } = await window.EpicSupabase.auth.getSession();
      return data?.session?.access_token || null;
    }
  } catch (e) {}
  return null;
}

function clearCheckoutCart() {
  const params = new URLSearchParams(window.location.search);
  const isBuyNow = params.get('buynow') === 'true';
  if (isBuyNow) {
    localStorage.removeItem('et_buy_now');
  } else if (typeof Store !== 'undefined') {
    Store.clearCart();
    if (Store.syncCartBadge) Store.syncCartBadge();
  }
  if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();
}

async function payWithRazorpay() {
  const cart = getCheckoutItems();
  if (!cart || cart.length === 0) {
    showToast('Your cart is empty!', 'error');
    return;
  }
  if (cart.some(i => i.paymentMethod === 'whatsapp')) {
    showToast('One or more items require WhatsApp Enquiry before payment. Please use the Ask on WhatsApp button on the product page.', 'error');
    return;
  }
  if (typeof window.Razorpay === 'undefined') {
    showToast('Razorpay SDK failed to load. Please refresh and try again.', 'error');
    return;
  }

  const btn = document.getElementById('btn-razorpay-pay');
  setLoading(btn, true);

  try {
    const subtotal = cart.reduce((s, i) => s + Number(i.price) * Number(i.quantity), 0);
    const shipping = 150;
    const total = subtotal + shipping;

    const accessToken = await getSupabaseAccessToken();
    let dbOrderId = CheckoutState.pendingOrder?.id || null;
    let dbOrderNumber = CheckoutState.pendingOrder?.orderNumber || null;
    let guestToken = CheckoutState.pendingOrder?.guestToken || null;

    if (!dbOrderId) {
      guestToken = accessToken ? null : generateGuestToken();
      const guestHashNote = guestToken ? `[GUEST_TOKEN:${await sha256Hex(guestToken)}]` : '';

      const orderData = {
        items: cart.map(item => ({
          id: item.id || item.productId,
          name: item.name,
          price: item.price,
          quantity: item.quantity,
          image: item.image
        })),
        delivery: CheckoutState.delivery,
        subtotal,
        shipping,
        total,
        paymentMethod: 'razorpay',
        user: CheckoutState.user,
        notes: guestHashNote
      };

      if (typeof DB === 'undefined' || !DB.createOrder) {
        throw new Error('Order database service is unavailable.');
      }

      const createdOrder = await DB.createOrder(orderData);
      if (!createdOrder || !createdOrder.id) {
        throw new Error('Could not create pending order.');
      }
      dbOrderId = createdOrder.id;
      dbOrderNumber = createdOrder.orderNumber || createdOrder.id;
      CheckoutState.pendingOrder = { id: dbOrderId, orderNumber: dbOrderNumber, guestToken };
    }
    CheckoutState.orderId = dbOrderId;

    const headers = { 'Content-Type': 'application/json' };
    if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

    const createRes = await fetch('/api/razorpay-create-order', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        dbOrderId,
        guestToken,
        customerPhone: CheckoutState.delivery?.phone || ''
      })
    });
    const { data: createData } = await parseApiResponse(createRes);
    const rzpOrderId = createData.order_id || createData.razorpayOrderId;
    const rzpKeyId = createData.key_id || createData.keyId;
    if (!createRes.ok || !rzpOrderId || !rzpKeyId) {
      throw new Error(createData.error || 'Failed to initialize Razorpay payment.');
    }

    const rzpOptions = {
      key: rzpKeyId,
      amount: createData.amount,
      currency: createData.currency || 'INR',
      name: 'Epic Toyz',
      description: `Order ${dbOrderNumber}`,
      order_id: rzpOrderId,
      prefill: {
        name: CheckoutState.delivery?.name || '',
        contact: CheckoutState.delivery?.phone || '',
        email: CheckoutState.user?.email || ''
      },
      theme: { color: '#E63946' },
      modal: {
        ondismiss: () => {
          setLoading(btn, false, '🔒 Pay Securely with Razorpay');
          showToast('Payment was cancelled before completion. Your cart is still saved.', 'error');
        }
      },
      handler: async (rzpResponse) => {
        try {
          const freshAccessToken = await getSupabaseAccessToken();
          const verifyHeaders = { 'Content-Type': 'application/json' };
          if (freshAccessToken) verifyHeaders.Authorization = `Bearer ${freshAccessToken}`;

          const verifyPayload = {
            razorpay_order_id: rzpResponse.razorpay_order_id,
            razorpay_payment_id: rzpResponse.razorpay_payment_id,
            razorpay_signature: rzpResponse.razorpay_signature,
            dbOrderId,
            guestToken
          };

          const verifyRes = await fetch('/api/razorpay-verify', {
            method: 'POST',
            headers: verifyHeaders,
            body: JSON.stringify(verifyPayload)
          });
          const { data: verifyData } = await parseApiResponse(verifyRes);

          // Safe idempotent retry if admin push notification had a transient failure
          if (verifyRes.ok && verifyData.verified && verifyData.retryNeeded && verifyData.retryNeeded.push) {
            await fetch('/api/razorpay-verify', {
              method: 'POST',
              headers: verifyHeaders,
              body: JSON.stringify(verifyPayload)
            }).catch(() => {});
          }

          if (!verifyRes.ok || !verifyData.verified) {
            throw new Error(verifyData.error || 'Payment signature verification failed.');
          }

          sessionStorage.setItem('et_verified_order', JSON.stringify({
            verified: true,
            orderId: verifyData.orderId,
            orderNumber: verifyData.orderNumber || dbOrderNumber,
            paymentId: verifyData.paymentId,
            total: verifyData.total || total,
            checkoutEmail: CheckoutState.user?.email || '',
            guestToken: guestToken || null,
            isGuestOrder: !accessToken
          }));

          clearCheckoutCart();
          window.location.href = 'order-confirmed.html';
        } catch (verifyErr) {
          console.error('[Checkout] Razorpay verify failed:', verifyErr);
          setLoading(btn, false, '🔒 Pay Securely with Razorpay');
          showToast(verifyErr.message || 'Payment verification failed. Contact support: 6383793890', 'error');
        }
      }
    };

    const rzp = new window.Razorpay(rzpOptions);
    rzp.on('payment.failed', (resp) => {
      console.error('[Checkout] Razorpay payment failed:', resp.error);
      setLoading(btn, false, '🔒 Pay Securely with Razorpay');
      showToast((resp.error && resp.error.description) || 'Payment failed. Please try again.', 'error');
    });
    rzp.open();
  } catch (err) {
    console.error('[Checkout] payWithRazorpay error:', err);
    setLoading(btn, false, '🔒 Pay Securely with Razorpay');
    showToast(err.message || 'Could not start Razorpay checkout.', 'error');
  }
}

/* ============================================================
   PLACE ORDER (WHATSAPP)
   ============================================================ */
async function placeOrder() {
  const cart = getCheckoutItems();
  if (!cart || cart.length === 0) {
    showToast('Your cart is empty!', 'error');
    return;
  }

  const btn = document.getElementById('btn-place-order');
  setLoading(btn, true);

  // Save the order to DB
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = 150;
  const total = subtotal + shipping;

  const orderData = {
    items: cart.map(item => ({
      id: item.id || item.productId,
      name: item.name,
      price: item.price,
      quantity: item.quantity,
      image: item.image
    })),
    delivery: CheckoutState.delivery,
    subtotal: subtotal,
    shipping: shipping,
    total: total,
    paymentMethod: CheckoutState.paymentMethod,
    user: CheckoutState.user
  };

  try {
    if (typeof DB !== 'undefined' && DB.createOrder) {
      const createdOrder = await DB.createOrder(orderData);
      if (createdOrder) {
        CheckoutState.orderId = createdOrder.id;
        console.log('[Checkout] Order stored successfully:', createdOrder);
      }
    }
  } catch (err) {
    console.error('[Checkout] Failed to save order:', err);
  }

  // Generate WhatsApp link
  const whatsappUrl = generateWhatsAppOrder();

  // Clear the appropriate cart
  const params = new URLSearchParams(window.location.search);
  const isBuyNow = params.get('buynow') === 'true';
  if (isBuyNow) {
    localStorage.removeItem('et_buy_now');
  } else {
    if (typeof Store !== 'undefined') {
      Store.clearCart();
      if (Store.syncCartBadge) Store.syncCartBadge();
    }
  }

  if (typeof UI !== 'undefined' && UI.updateCartBadge) UI.updateCartBadge();

  // Redirect the browser immediately
  window.location.href = whatsappUrl;
}

/* ============================================================
   SIDEBAR RENDER
   ============================================================ */
function renderSidebar() {
  const cart = getCheckoutItems();
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
  }).join('') || '<p style="font-size:0.85rem; color:#536273; text-align:center; padding:10px 0;">Cart is empty</p>';

  // Summary
  const subtotal = cart.reduce((s, i) => s + i.price * i.quantity, 0);
  const shipping = 150;
  const total = subtotal + shipping;

  sidebarSummary.innerHTML = `
    <div class="sidebar-summary-row">
      <span class="lbl">Subtotal</span>
      <span class="val">₹${subtotal.toLocaleString('en-IN')}</span>
    </div>
    <div class="sidebar-summary-row">
      <span class="lbl">Shipping</span>
      <span class="val">₹${shipping}</span>
    </div>
    <div class="sidebar-total">
      <span class="lbl">Total</span>
      <span class="val">₹${total.toLocaleString('en-IN')}</span>
    </div>
  `;
}

/* ============================================================
   HELPERS
   ============================================================ */
function prefillDeliveryName(fullName) {
  if (!fullName) return;
  const parts = String(fullName).trim().split(/\s+/);
  const first = parts[0] || '';
  const last = parts.slice(1).join(' ');
  const fEl = document.getElementById('d-first-name');
  const lEl = document.getElementById('d-last-name');
  if (fEl && first) fEl.value = first;
  if (lEl && last) lEl.value = last;
}

function prefillDeliveryFromUser(user) {
  if (!user) return;
  const safe = (id, val) => { const el = document.getElementById(id); if (el && val) el.value = val; };
  prefillDeliveryName(user.name || user.user_metadata?.name || user.user_metadata?.full_name);
  safe('d-phone', user.phone || user.user_metadata?.phone);
}

function updateStandardShippingLabel() {
  const el = document.getElementById('standard-price-label');
  if (!el) return;
  el.textContent = '₹150';
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
