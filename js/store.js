/**
 * store.js — Epic Toyz Cart and Wishlist Store
 * ─────────────────────────────────────────────
 * Manages the shopping cart, wishlist, and recently viewed products.
 * Synchronizes with localStorage and dispatches global events.
 */

const Store = {
  // --- KEYS ---
  CART_KEY: 'et_cart',
  WISHLIST_KEY: 'et_wishlist',
  RECENT_KEY: 'et_recent',

  // --- CART MANAGEMENT ---
  
  /**
   * Retrieves the current cart from localStorage.
   * @returns {Array} List of cart items.
   */
  getCart() {
    try {
      return JSON.parse(localStorage.getItem(this.CART_KEY) || '[]');
    } catch (e) {
      console.error('Error parsing cart from localStorage:', e);
      return [];
    }
  },

  /**
   * Saves the cart to localStorage and dispatches a change event.
   * @param {Array} cart - The updated cart array.
   */
  saveCart(cart) {
    try {
      localStorage.setItem(this.CART_KEY, JSON.stringify(cart));
      this._dispatchCartEvent();
      this.syncCartBadge();
    } catch (e) {
      console.error('Error saving cart to localStorage:', e);
    }
  },

  /**
   * Adds a product to the cart. If the product already exists, increments the quantity.
   * @param {Object} product - The product details object.
   * @param {number} quantity - Quantity to add (default is 1).
   */
  addToCart(product, quantity = 1) {
    const cart = this.getCart();
    // Support matching by ID (string or number)
    const idx = cart.findIndex(item => String(item.id) === String(product.id));
    
    if (idx > -1) {
      cart[idx].quantity += quantity;
    } else {
      cart.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.imageUrl || (product.images && product.images[0]) || 'assets/images/placeholder.svg',
        category: product.category || 'RC Cars',
        quantity: quantity,
        slug: product.slug
      });
    }
    
    this.saveCart(cart);
    if (typeof showToast === 'function') {
      showToast(`${product.name} added to cart!`, 'success');
    }
  },

  /**
   * Removes a product from the cart by its ID.
   * @param {string|number} productId - The product ID.
   */
  removeFromCart(productId) {
    let cart = this.getCart();
    const product = cart.find(item => String(item.id) === String(productId));
    cart = cart.filter(item => String(item.id) !== String(productId));
    this.saveCart(cart);
    if (product && typeof showToast === 'function') {
      showToast(`${product.name} removed from cart.`, 'info');
    }
  },

  /**
   * Updates the quantity of a product in the cart.
   * @param {string|number} productId - The product ID.
   * @param {number} quantity - The new quantity.
   */
  updateQuantity(productId, quantity) {
    const cart = this.getCart();
    const idx = cart.findIndex(item => String(item.id) === String(productId));
    
    if (idx > -1) {
      if (quantity <= 0) {
        this.removeFromCart(productId);
      } else {
        cart[idx].quantity = quantity;
        this.saveCart(cart);
      }
    }
  },

  /**
   * Clears all items from the cart.
   */
  clearCart() {
    this.saveCart([]);
  },

  /**
   * Calculates the total number of items in the cart.
   * @returns {number} Total count.
   */
  getCartCount() {
    return this.getCart().reduce((sum, item) => sum + item.quantity, 0);
  },

  /**
   * Calculates the total price of all items in the cart.
   * @returns {number} Total price in INR.
   */
  getCartTotal() {
    return this.getCart().reduce((sum, item) => sum + (item.price * item.quantity), 0);
  },

  /**
   * Synchronizes the navbar/header cart count badge.
   */
  syncCartBadge() {
    const badges = document.querySelectorAll('.cart-badge');
    const count = this.getCartCount();
    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  /**
   * Dispatches a custom event for cart updates.
   * @private
   */
  _dispatchCartEvent() {
    window.dispatchEvent(new CustomEvent('cart:updated', { detail: this.getCart() }));
  },

  // --- WISHLIST MANAGEMENT ---

  /**
   * Retrieves the current wishlist from localStorage.
   * @returns {Array} List of wishlist items.
   */
  getWishlist() {
    try {
      return JSON.parse(localStorage.getItem(this.WISHLIST_KEY) || '[]');
    } catch (e) {
      console.error('Error parsing wishlist from localStorage:', e);
      return [];
    }
  },

  /**
   * Toggles a product's presence in the wishlist.
   * @param {Object} product - The product details object.
   */
  toggleWishlist(product) {
    const wishlist = this.getWishlist();
    const idx = wishlist.findIndex(item => String(item.id) === String(product.id));
    
    if (idx > -1) {
      wishlist.splice(idx, 1);
      if (typeof showToast === 'function') {
        showToast(`${product.name} removed from wishlist.`, 'info');
      }
    } else {
      wishlist.push({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.imageUrl || (product.images && product.images[0]) || 'assets/images/placeholder.svg',
        category: product.category,
        slug: product.slug,
        rating: product.rating,
        reviewCount: product.reviewCount
      });
      if (typeof showToast === 'function') {
        showToast(`${product.name} added to wishlist!`, 'success');
      }
    }
    
    localStorage.setItem(this.WISHLIST_KEY, JSON.stringify(wishlist));
    window.dispatchEvent(new CustomEvent('wishlist:updated', { detail: wishlist }));
    this.syncWishlistBadge();
  },

  /**
   * Checks if a product is in the wishlist.
   * @param {string|number} productId - The product ID.
   * @returns {boolean} True if in wishlist, false otherwise.
   */
  isInWishlist(productId) {
    return this.getWishlist().some(item => String(item.id) === String(productId));
  },

  /**
   * Gets the total count of wishlist items.
   * @returns {number} Wishlist size.
   */
  getWishlistCount() {
    return this.getWishlist().length;
  },

  /**
   * Synchronizes the navbar/header wishlist count badge.
   */
  syncWishlistBadge() {
    const badges = document.querySelectorAll('.wishlist-badge');
    const count = this.getWishlistCount();
    badges.forEach(badge => {
      badge.textContent = count;
      badge.style.display = count > 0 ? 'flex' : 'none';
    });
  },

  // --- RECENTLY VIEWED PRODUCTS ---

  /**
   * Adds a product to the recently viewed list. Keeps list size at maximum 10 items.
   * @param {Object} product - The product details object.
   */
  addRecentlyViewed(product) {
    try {
      let recent = this.getRecentlyViewed().filter(item => String(item.id) !== String(product.id));
      recent.unshift({
        id: product.id,
        name: product.name,
        price: product.price,
        image: product.imageUrl || (product.images && product.images[0]) || 'assets/images/placeholder.svg',
        category: product.category,
        slug: product.slug,
        rating: product.rating,
        reviewCount: product.reviewCount
      });
      if (recent.length > 10) {
        recent.pop();
      }
      localStorage.setItem(this.RECENT_KEY, JSON.stringify(recent));
    } catch (e) {
      console.error('Error handling recently viewed products:', e);
    }
  },

  /**
   * Retrieves the list of recently viewed products.
   * @returns {Array} Recently viewed items.
   */
  getRecentlyViewed() {
    try {
      return JSON.parse(localStorage.getItem(this.RECENT_KEY) || '[]');
    } catch (e) {
      console.error('Error parsing recently viewed from localStorage:', e);
      return [];
    }
  }
};

// Make Store globally accessible
window.Store = Store;
