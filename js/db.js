/**
 * Epic Toyz — Database Operations (DB)
 * Provides a unified async API for all CRUD operations.
 * When Supabase is configured it uses the remote database;
 * otherwise it falls back to localStorage + window.SAMPLE_DATA.
 */

'use strict';

/* ─── helpers ────────────────────────────────────────────────────────────── */

const LS = {
  get:    (key)       => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set:    (key, val)  => localStorage.setItem(key, JSON.stringify(val)),
  remove: (key)       => localStorage.removeItem(key),
};

const KEYS = {
  PRODUCTS:   'et_products',
  CATEGORIES: 'et_categories',
  ORDERS:     'et_orders',
  REVIEWS:    'et_reviews',
  WISHLIST:   'et_wishlist',
  INVENTORY:  'et_inventory',
};

/**
 * Initialise localStorage from SAMPLE_DATA if not already seeded.
 * Called once on script load.
 */
function seedLocalStorage() {
  if (!LS.get('et_initialized') && window.SAMPLE_DATA) {
    LS.set(KEYS.PRODUCTS,   window.SAMPLE_DATA.products   || []);
    LS.set(KEYS.CATEGORIES, window.SAMPLE_DATA.categories || []);
    LS.set(KEYS.ORDERS,     []);
    LS.set(KEYS.REVIEWS,    window.SAMPLE_DATA.reviews    || []);
    LS.set(KEYS.INVENTORY,  (window.SAMPLE_DATA.products || []).map(p => ({
      productId: p.id,
      quantity:  p.stock ?? 10,
    })));
    localStorage.setItem('et_initialized', 'true');
  }
}

/** @returns {object[]} */
function lsProducts()   { return LS.get(KEYS.PRODUCTS)   || []; }
/** @returns {object[]} */
function lsCategories() { return LS.get(KEYS.CATEGORIES) || []; }
/** @returns {object[]} */
function lsOrders()     { return LS.get(KEYS.ORDERS)     || []; }
/** @returns {object[]} */
function lsReviews()    { return LS.get(KEYS.REVIEWS)    || []; }

/** Generate a UUID-like id string */
function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/**
 * Maps a Supabase product database object (snake_case) to client-side naming (camelCase).
 * @param {object} p - Supabase product
 * @returns {object} - Client product
 */
function mapSupabaseProduct(p) {
  if (!p) return null;
  let resolvedCategory = p.categories?.slug;
  if (!resolvedCategory && p.category_id) {
    try {
      const cats = LS.get('et_categories') || [];
      const found = cats.find(c => String(c.id) === String(p.category_id));
      if (found) resolvedCategory = found.slug;
    } catch (e) {
      console.warn('[DB] mapSupabaseProduct local category resolve failed:', e);
    }
  }
  return {
    ...p,
    originalPrice: p.original_price != null ? Number(p.original_price) : null,
    price: p.price != null ? Number(p.price) : 0,
    shortDescription: p.short_description || '',
    isFeatured: !!p.is_featured,
    featured: !!p.is_featured,
    isNew: p.badge === 'new',
    stock: p.stock_quantity ?? 0,
    stockQuantity: p.stock_quantity ?? 0,
    reviewsCount: p.review_count ?? 0,
    image: (p.images && p.images.length > 0) ? p.images[0] : 'assets/images/placeholder.jpg',
    specs: p.specifications || {},
    specifications: p.specifications || {},
    category: resolvedCategory || p.category_id || p.category || '',
    categoryId: p.category_id || '',
    badges: Array.isArray(p.badges) ? p.badges : (p.badge ? [p.badge] : []),
    categories: Array.isArray(p.categories) ? p.categories : (p.category_id ? [p.category_id] : []),
  };
}

/**
 * Executes a Supabase products query, safely retrying without the categories relation join if it fails.
 * @param {function} buildQueryFn - Function that constructs query builder with select string
 * @param {boolean} [isSingle=false]
 * @returns {Promise<{data: any, error: any}>}
 */
async function queryProductsSafe(buildQueryFn, isSingle = false) {
  try {
    // First try with the categories join
    const qJoin = buildQueryFn('*, categories(id, name, slug)');
    const result = isSingle ? await qJoin.single() : await qJoin;
    if (!result.error) return result;

    const err = result.error;
    const errMsg = err.message || '';

    // If the products table itself doesn't exist (PGRST205), throw to trigger localStorage fallback
    if ((err.code === 'PGRST205' || err.status === 404) && !errMsg.includes('categories')) {
      console.error('[DB] Supabase table not found (schema not set up?):', errMsg);
      throw err;
    }

    // If join to categories failed, retry without the join
    if (err.code === 'PGRST205' || err.status === 404 || errMsg.includes('categories') || errMsg.includes('relationship')) {
      console.warn('[DB] Supabase categories join failed, retrying without join:', errMsg);
      const qPlain = buildQueryFn('*');
      const retryResult = isSingle ? await qPlain.single() : await qPlain;
      if (retryResult.error) {
        const retryErr = retryResult.error;
        if (retryErr.code === 'PGRST205' || retryErr.status === 404) {
          console.error('[DB] Supabase products table not found (schema not set up?):', retryErr.message);
          throw retryErr;
        }
      }
      return retryResult;
    }
    return result;
  } catch (e) {
    console.error('[DB] queryProductsSafe caught exception — falling back to localStorage:', e.message || e);
    throw e; // Re-throw so getProducts() catch block uses localStorage
  }
}

/**
 * Maps a Supabase review database object (snake_case) to client-side naming (camelCase/expected keys).
 * @param {object} r - Supabase review
 * @returns {object} - Client review
 */
function mapSupabaseReview(r) {
  if (!r) return null;
  return {
    ...r,
    productId: r.product_id,
    name: r.reviewer_name,
    userName: r.reviewer_name,
    user_name: r.reviewer_name,
    text: r.review_text,
    comment: r.review_text,
    verifiedPurchase: r.is_verified,
    verified_purchase: r.is_verified,
    approved: r.is_approved,
    is_approved: r.is_approved,
    createdAt: r.created_at,
    date: r.created_at,
  };
}

/* ─── local-storage helpers ─────────────────────────────────────────────── */

/**
 * Filter & sort products from localStorage.
 * @param {object[]} products
 * @param {object}   filters
 * @returns {object[]}
 */
function applyFilters(products, filters = {}) {
  let result = [...products];

  if (filters.category) {
    result = result.filter(p => p.category === filters.category);
  }
  if (filters.badge) {
    result = result.filter(p => p.badge === filters.badge);
  }
  if (filters.featured) {
    result = result.filter(p => p.isFeatured);
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(p =>
      p.name.toLowerCase().includes(q) ||
      (p.shortDescription || '').toLowerCase().includes(q) ||
      (p.category || '').toLowerCase().includes(q)
    );
  }
  if (filters.minPrice != null) {
    result = result.filter(p => p.price >= filters.minPrice);
  }
  if (filters.maxPrice != null) {
    result = result.filter(p => p.price <= filters.maxPrice);
  }

  // Sorting
  const sort = filters.sort || 'featured';
  switch (sort) {
    case 'price-asc':  result.sort((a, b) => a.price - b.price);         break;
    case 'price-desc': result.sort((a, b) => b.price - a.price);         break;
    case 'rating':     result.sort((a, b) => b.rating - a.rating);       break;
    case 'newest':     result.sort((a, b) => (b.isNew ? 1 : 0) - (a.isNew ? 1 : 0)); break;
    case 'name':       result.sort((a, b) => a.name.localeCompare(b.name)); break;
    default:           result.sort((a, b) => (b.isFeatured ? 1 : 0) - (a.isFeatured ? 1 : 0));
  }

  return result;
}

/* ─── DB object ─────────────────────────────────────────────────────────── */

const DB = {

  /* ══════════════════════════════════════════════════════════
     PRODUCTS
     ══════════════════════════════════════════════════════════ */

  /**
   * Fetch all products, optionally filtered & sorted.
   * @param {object} filters - { category, search, badge, featured, minPrice, maxPrice, sort }
   * @returns {Promise<object[]>}
   */
  async getProducts(filters = {}) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const categories = await DB.getCategories();
        
        const buildQuery = (selectStr) => {
          let query = window.EpicSupabase.from('products').select(selectStr);
          
          if (filters.category) {
            const cat = categories.find(c => c.slug === filters.category || c.id === filters.category);
            if (cat) {
              query = query.eq('category_id', cat.id);
            }
          }
          if (filters.badge)    query = query.eq('badge', filters.badge);
          if (filters.featured) query = query.eq('is_featured', true);
          if (filters.search)   query = query.ilike('name', `%${filters.search}%`);
          if (filters.minPrice != null) query = query.gte('price', filters.minPrice);
          if (filters.maxPrice != null) query = query.lte('price', filters.maxPrice);

          const sort = filters.sort || 'featured';
          if (sort === 'price-asc')  query = query.order('price', { ascending: true });
          else if (sort === 'price-desc') query = query.order('price', { ascending: false });
          else if (sort === 'rating') query = query.order('rating', { ascending: false });
          else if (sort === 'newest') query = query.order('created_at', { ascending: false });
          else query = query.order('is_featured', { ascending: false });

          if (filters.limit) {
            query = query.limit(filters.limit);
          }
          return query;
        };

        const { data, error } = await queryProductsSafe(buildQuery);
        if (error) throw error;
        console.log('[DB] Supabase getProducts returned count:', data ? data.length : 0);
        return (data || []).map(mapSupabaseProduct);
      } catch (err) {
        console.warn('[DB] Supabase getProducts failed, using localStorage:', err.message);
      }
    }
    let products = applyFilters(lsProducts(), filters);
    if (filters.limit) {
      products = products.slice(0, filters.limit);
    }
    return products;
  },

  /**
   * Fetch a single product by its numeric/string ID.
   * @param {string|number} id
   * @returns {Promise<object|null>}
   */
  async getProductById(id) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const buildQuery = (selectStr) => {
          return window.EpicSupabase.from('products').select(selectStr).eq('id', id);
        };
        const { data, error } = await queryProductsSafe(buildQuery, true);
        if (error) throw error;
        return mapSupabaseProduct(data);
      } catch (err) {
        console.warn('[DB] Supabase getProductById failed:', err.message);
      }
    }
    return lsProducts().find(p => String(p.id) === String(id)) || null;
  },

  /**
   * Fetch a single product by URL slug.
   * @param {string} slug
   * @returns {Promise<object|null>}
   */
  async getProductBySlug(slug) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const buildQuery = (selectStr) => {
          return window.EpicSupabase.from('products').select(selectStr).eq('slug', slug);
        };
        const { data, error } = await queryProductsSafe(buildQuery, true);
        if (error) throw error;
        return mapSupabaseProduct(data);
      } catch (err) {
        console.warn('[DB] Supabase getProductBySlug failed:', err.message);
      }
    }
    return lsProducts().find(p => p.slug === slug) || null;
  },

  /**
   * Fetch multiple products by their numeric/string IDs.
   * @param {string[]|number[]} ids
   * @returns {Promise<object[]>}
   */
  async getProductsByIds(ids) {
    if (!ids || ids.length === 0) return [];
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const buildQuery = (selectStr) => {
          return window.EpicSupabase.from('products').select(selectStr).in('id', ids);
        };
        const { data, error } = await queryProductsSafe(buildQuery);
        if (error) throw error;
        return (data || []).map(mapSupabaseProduct);
      } catch (err) {
        console.warn('[DB] Supabase getProductsByIds failed:', err.message);
      }
    }
    return lsProducts().filter(p => ids.map(String).includes(String(p.id)));
  },

  /**
   * Fetch featured products.
   * @param {number} [limit=8]
   * @returns {Promise<object[]>}
   */
  async getFeaturedProducts(limit = 8) {
    const products = await this.getProducts({ featured: true });
    return products.slice(0, limit);
  },

  /**
   * Fetch new arrivals (isNew flag or newest by date).
   * @param {number} [limit=8]
   * @returns {Promise<object[]>}
   */
  async getNewArrivals(limit = 8) {
    const products = await this.getProducts({ badge: 'new', sort: 'newest' });
    return products.slice(0, limit);
  },

  /**
   * Helper to convert a string to a URL-friendly slug.
   */
  _slugify(str) {
    return (str || '')
      .toLowerCase()
      .trim()
      .replace(/\s+/g, '-')
      .replace(/[^a-z0-9-]/g, '')
      .replace(/-+/g, '-');
  },

  /**
   * Maps a camelCase client product object to a snake_case database columns object.
   */
  _mapClientToSupabaseProduct(data) {
    if (!data) return null;
    const p = {};

    if (data.id) p.id = data.id;
    if (data.name) {
      p.name = data.name;
      p.slug = data.slug || this._slugify(data.name);
    } else if (data.slug) {
      p.slug = data.slug;
    }

    if (data.description !== undefined) p.description = data.description;
    
    if (data.shortDescription !== undefined) p.short_description = data.shortDescription;
    else if (data.short_description !== undefined) p.short_description = data.short_description;

    if (data.price !== undefined) {
      p.price = isNaN(Number(data.price)) ? 0 : Number(data.price);
    }
    
    if (data.originalPrice !== undefined) {
      p.original_price = (data.originalPrice !== null && !isNaN(Number(data.originalPrice))) ? Number(data.originalPrice) : null;
    } else if (data.original_price !== undefined) {
      p.original_price = (data.original_price !== null && !isNaN(Number(data.original_price))) ? Number(data.original_price) : null;
    }

    const rawCat = data.categoryId || data.category_id || data.category;
    if (rawCat) {
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(rawCat).trim());
      if (isUUID) {
        p.category_id = String(rawCat).trim();
      } else {
        try {
          const cats = LS.get('et_categories') || [];
          const found = cats.find(c => c.slug === rawCat || c.name === rawCat);
          if (found) p.category_id = found.id;
        } catch (e) {
          console.warn('[DB] Failed to resolve category UUID for:', rawCat, e);
        }
      }
    }

    if (Array.isArray(data.images)) {
      p.images = data.images;
    } else if (data.image) {
      p.images = [data.image];
    } else if (data.images) {
      p.images = typeof data.images === 'string' ? [data.images] : [];
    }

    if (data.specifications !== undefined) p.specifications = data.specifications;
    else if (data.specs !== undefined) p.specifications = data.specs;

    if (data.features !== undefined) p.features = data.features;

    // Badge: single string for backward compat
    if (data.badge !== undefined) p.badge = data.badge;
    // Badges: array of badge strings (new multi-badge support)
    if (Array.isArray(data.badges)) p.badges = data.badges;

    // Categories: array of category IDs
    if (Array.isArray(data.categories)) p.categories = data.categories;

    if (data.isFeatured !== undefined) p.is_featured = !!data.isFeatured;
    else if (data.featured !== undefined) p.is_featured = !!data.featured;
    else if (data.is_featured !== undefined) p.is_featured = !!data.is_featured;

    if (data.isActive !== undefined) p.is_active = !!data.isActive;
    else if (data.is_active !== undefined) p.is_active = !!data.is_active;

    let stockVal = 0;
    if (data.stockQuantity !== undefined) stockVal = Number(data.stockQuantity);
    else if (data.stock !== undefined) stockVal = Number(data.stock);
    else if (data.stock_quantity !== undefined) stockVal = Number(data.stock_quantity);
    p.stock_quantity = isNaN(stockVal) ? 0 : stockVal;

    if (data.rating !== undefined) p.rating = isNaN(Number(data.rating)) ? 0 : Number(data.rating);
    
    let revCount = 0;
    if (data.reviewsCount !== undefined) revCount = Number(data.reviewsCount);
    else if (data.review_count !== undefined) revCount = Number(data.review_count);
    p.review_count = isNaN(revCount) ? 0 : revCount;

    // Updated timestamp
    if (data.updatedAt !== undefined) p.updated_at = data.updatedAt;

    return p;
  },

  /**
   * Create a new product (admin).
   * @param {object} data - Product fields
   * @returns {Promise<object>}
   */
  async createProduct(data) {
    const newProduct = { ...data, id: data.id || uid(), createdAt: new Date().toISOString() };
    if (isSupabaseConfigured() && window.EpicSupabase) {
      const dbProduct = this._mapClientToSupabaseProduct(newProduct);
      console.log('[DB] Supabase product insert request payload:', dbProduct);

      const { data: result, error } = await window.EpicSupabase
        .from('products')
        .insert([dbProduct])
        .select()
        .single();

      if (error) {
        console.error('[DB] Supabase product insert failed:', error);
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log('[DB] Supabase product insert succeeded. Record:', result, 'ID:', result.id);

      // Also upsert inventory row to keep the inventory table in sync
      const stockQty = dbProduct.stock_quantity ?? 0;
      try {
        const { error: invErr } = await window.EpicSupabase
          .from('inventory')
          .upsert({ product_id: result.id, quantity: stockQty }, { onConflict: 'product_id' });
        if (invErr) {
          console.warn('[DB] Supabase inventory auto-upsert failed for product:', result.id, invErr);
        } else {
          console.log('[DB] Supabase inventory auto-upsert succeeded for product:', result.id, 'quantity:', stockQty);
        }
      } catch (invEx) {
        console.warn('[DB] Supabase inventory auto-upsert threw exception:', invEx);
      }

      return mapSupabaseProduct(result);
    }

    // Local fallback when Supabase is not configured
    console.log('[DB] Supabase not configured — falling back to localStorage');
    const products = lsProducts();
    products.push(newProduct);
    LS.set(KEYS.PRODUCTS, products);
    return newProduct;
  },

  /**
   * Update an existing product (admin).
   * @param {string|number} id
   * @param {object} data - Partial product fields to update
   * @returns {Promise<object|null>}
   */
  async updateProduct(id, data) {
    const updated = { ...data, updatedAt: new Date().toISOString() };
    if (isSupabaseConfigured() && window.EpicSupabase) {
      const dbProduct = this._mapClientToSupabaseProduct(updated);
      console.log('[DB] Supabase product update request payload for ID:', id, dbProduct);

      const { data: result, error } = await window.EpicSupabase
        .from('products')
        .update(dbProduct)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('[DB] Supabase product update failed:', error);
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log('[DB] Supabase product update succeeded. Record:', result);

      // Keep inventory table in sync on stock update
      if (dbProduct.stock_quantity !== undefined) {
        try {
          const { error: invErr } = await window.EpicSupabase
            .from('inventory')
            .upsert({ product_id: id, quantity: dbProduct.stock_quantity }, { onConflict: 'product_id' });
          if (invErr) {
            console.warn('[DB] Supabase inventory auto-update failed for product:', id, invErr);
          } else {
            console.log('[DB] Supabase inventory auto-update succeeded for product:', id, 'quantity:', dbProduct.stock_quantity);
          }
        } catch (invEx) {
          console.warn('[DB] Supabase inventory auto-update threw exception:', invEx);
        }
      }

      return mapSupabaseProduct(result);
    }

    // Local fallback when Supabase is not configured
    console.log('[DB] Supabase not configured — falling back to localStorage');
    const products = lsProducts();
    const idx = products.findIndex(p => String(p.id) === String(id));
    if (idx === -1) return null;
    products[idx] = { ...products[idx], ...updated };
    LS.set(KEYS.PRODUCTS, products);
    return products[idx];
  },

  /**
   * Delete a product (admin).
   * @param {string|number} id
   * @returns {Promise<boolean>}
   */
  async deleteProduct(id) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      console.log('[DB] Supabase product delete request for ID:', id);

      const { error } = await window.EpicSupabase
        .from('products')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('[DB] Supabase product delete failed:', error);
        throw new Error(error.message || JSON.stringify(error));
      }

      console.log('[DB] Supabase product delete succeeded for ID:', id);
      return true;
    }

    // Local fallback when Supabase is not configured
    console.log('[DB] Supabase not configured — falling back to localStorage');
    const products = lsProducts().filter(p => String(p.id) !== String(id));
    LS.set(KEYS.PRODUCTS, products);
    return true;
  },

  /* ══════════════════════════════════════════════════════════
     CATEGORIES
     ══════════════════════════════════════════════════════════ */

  /**
   * Fetch all categories.
   * @returns {Promise<object[]>}
   */
  async getCategories() {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('categories').select('*').order('name', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('[DB] Supabase getCategories failed:', err.message);
      }
    }
    return lsCategories();
  },

  /**
   * Fetch a category by its ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getCategoryById(id) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('categories').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[DB] Supabase getCategoryById failed:', err.message);
      }
    }
    return lsCategories().find(c => c.id === id) || null;
  },

  /**
   * Create a category (admin).
   * @param {object} data
   * @returns {Promise<object>}
   */
  async createCategory(data) {
    const newCat = { ...data, id: data.id || uid() };
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data: result, error } = await window.EpicSupabase
          .from('categories').insert([newCat]).select().single();
        if (error) throw error;
        return result;
      } catch (err) {
        console.warn('[DB] Supabase createCategory failed:', err.message);
      }
    }
    const cats = lsCategories();
    cats.push(newCat);
    LS.set(KEYS.CATEGORIES, cats);
    return newCat;
  },

  /**
   * Update a category (admin).
   * @param {string} id
   * @param {object} data
   * @returns {Promise<object|null>}
   */
  async updateCategory(id, data) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data: result, error } = await window.EpicSupabase
          .from('categories').update(data).eq('id', id).select().single();
        if (error) throw error;
        return result;
      } catch (err) {
        console.warn('[DB] Supabase updateCategory failed:', err.message);
      }
    }
    const cats = lsCategories();
    const idx = cats.findIndex(c => c.id === id);
    if (idx === -1) return null;
    cats[idx] = { ...cats[idx], ...data };
    LS.set(KEYS.CATEGORIES, cats);
    return cats[idx];
  },

  /**
   * Delete a category (admin).
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteCategory(id) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { error } = await window.EpicSupabase
          .from('categories').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('[DB] Supabase deleteCategory failed:', err.message);
      }
    }
    LS.set(KEYS.CATEGORIES, lsCategories().filter(c => c.id !== id));
    return true;
  },

  /* ══════════════════════════════════════════════════════════
     ORDERS
     ══════════════════════════════════════════════════════════ */

  /**
   * Create a new order.
   * @param {object} orderData - { items, customer, total, paymentMethod, ... }
   * @returns {Promise<object>}
   */
  async createOrder(orderData) {
    const newOrder = {
      ...orderData,
      id:          orderData.id || uid(),
      orderNumber: window.generateOrderNumber ? window.generateOrderNumber() : `ET-${Date.now()}`,
      status:      'pending',
      createdAt:   new Date().toISOString(),
    };
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('orders').insert([newOrder]).select().single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[DB] Supabase createOrder failed:', err.message);
      }
    }
    const orders = lsOrders();
    orders.push(newOrder);
    LS.set(KEYS.ORDERS, orders);
    return newOrder;
  },

  /**
   * Get orders. If userId provided, filter to that user's orders.
   * @param {string|null} [userId]
   * @returns {Promise<object[]>}
   */
  async getOrders(userId = null) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        let query = window.EpicSupabase
          .from('orders').select('*').order('created_at', { ascending: false });
        if (userId) query = query.eq('user_id', userId);
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('[DB] Supabase getOrders failed:', err.message);
      }
    }
    const orders = lsOrders();
    if (userId) return orders.filter(o => o.userId === userId);
    return orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Get a single order by ID.
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async getOrderById(id) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('orders').select('*').eq('id', id).single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[DB] Supabase getOrderById failed:', err.message);
      }
    }
    return lsOrders().find(o => o.id === id) || null;
  },

  /**
   * Update order status (admin).
   * @param {string} id
   * @param {string} status - 'pending'|'processing'|'shipped'|'delivered'|'cancelled'
   * @returns {Promise<object|null>}
   */
  async updateOrderStatus(id, status) {
    const updated = { status, updatedAt: new Date().toISOString() };
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('orders').update(updated).eq('id', id).select().single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[DB] Supabase updateOrderStatus failed:', err.message);
      }
    }
    const orders = lsOrders();
    const idx = orders.findIndex(o => o.id === id);
    if (idx === -1) return null;
    orders[idx] = { ...orders[idx], ...updated };
    LS.set(KEYS.ORDERS, orders);
    return orders[idx];
  },

  /* ══════════════════════════════════════════════════════════
     REVIEWS
     ══════════════════════════════════════════════════════════ */

  /**
   * Get approved reviews for a product.
   * @param {string|number} productId
   * @returns {Promise<object[]>}
   */
  async getProductReviews(productId) {
    return this.getReviews(productId);
  },

  /**
   * Get reviews (optionally filtered by product ID).
   * @param {string|number|null} [productId]
   * @returns {Promise<object[]>}
   */
  async getReviews(productId = null) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        let query = window.EpicSupabase.from('reviews').select('*');
        if (productId) {
          query = query.eq('product_id', productId).eq('is_approved', true);
        }
        const { data, error } = await query.order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapSupabaseReview);
      } catch (err) {
        console.warn('[DB] Supabase getReviews failed:', err.message);
      }
    }
    const reviews = lsReviews();
    if (productId) {
      return reviews
        .filter(r => String(r.productId) === String(productId) && r.approved !== false)
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    }
    return reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  },

  /**
   * Submit a customer review (pending approval).
   * @param {object} reviewData - { productId, rating, title, text }
   * @returns {Promise<object>}
   */
  async submitReview(reviewData) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const user = window.Auth?.getCurrentUser?.();
        const reviewer_name = user?.name || 'Anonymous';
        const reviewer_email = user?.email || null;
        const user_id = user?.id || null;

        const { data, error } = await window.EpicSupabase
          .from('reviews')
          .insert([{
            product_id: reviewData.product_id || reviewData.productId,
            user_id: user_id,
            reviewer_name: reviewer_name,
            reviewer_email: reviewer_email,
            rating: reviewData.rating,
            title: reviewData.title || '',
            review_text: reviewData.text || reviewData.comment || '',
            is_verified: false,
            is_approved: false
          }])
          .select()
          .single();
        if (error) throw error;
        return mapSupabaseReview(data);
      } catch (err) {
        console.warn('[DB] Supabase submitReview failed:', err.message);
        throw err;
      }
    }

    // localStorage fallback
    const newReview = {
      ...reviewData,
      id:        uid(),
      approved:  false,
      createdAt: new Date().toISOString(),
      userName:  'You',
      user_name: 'You'
    };
    const reviews = lsReviews();
    reviews.push(newReview);
    LS.set(KEYS.REVIEWS, reviews);
    return newReview;
  },

  /**
   * Alias for submitReview (for backwards compatibility/admin CRUD).
   */
  async createReview(reviewData) {
    return this.submitReview(reviewData);
  },

  /**
   * Approve a pending review (admin).
   * @param {string} id
   * @returns {Promise<object|null>}
   */
  async approveReview(id) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('reviews').update({ is_approved: true }).eq('id', id).select().single();
        if (error) throw error;
        return mapSupabaseReview(data);
      } catch (err) {
        console.warn('[DB] Supabase approveReview failed:', err.message);
      }
    }
    const reviews = lsReviews();
    const idx = reviews.findIndex(r => r.id === id);
    if (idx === -1) return null;
    reviews[idx].approved = true;
    LS.set(KEYS.REVIEWS, reviews);
    return reviews[idx];
  },

  /**
   * Get all pending (unapproved) reviews (admin).
   * @returns {Promise<object[]>}
   */
  async getPendingReviews() {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('reviews')
          .select('*')
          .eq('is_approved', false)
          .order('created_at', { ascending: false });
        if (error) throw error;
        return (data || []).map(mapSupabaseReview);
      } catch (err) {
        console.warn('[DB] Supabase getPendingReviews failed:', err.message);
      }
    }
    return lsReviews().filter(r => r.approved === false);
  },

  /**
   * Delete a review (admin).
   * @param {string} id
   * @returns {Promise<boolean>}
   */
  async deleteReview(id) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { error } = await window.EpicSupabase
          .from('reviews').delete().eq('id', id);
        if (error) throw error;
        return true;
      } catch (err) {
        console.warn('[DB] Supabase deleteReview failed:', err.message);
      }
    }
    const reviews = lsReviews().filter(r => String(r.id) !== String(id));
    LS.set(KEYS.REVIEWS, reviews);
    return true;
  },

  /* ══════════════════════════════════════════════════════════
     WISHLIST  (localStorage primary, optional Supabase sync)
     ══════════════════════════════════════════════════════════ */

  /**
   * Get the current wishlist items (full product objects).
   * @returns {Promise<object[]>}
   */
  async getWishlist() {
    const raw = LS.get(KEYS.WISHLIST) || [];
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const user = window.Auth?.getCurrentUser?.();
        if (user) {
          const { data, error } = await window.EpicSupabase
            .from('wishlist')
            .select('*, product:products(*)')
            .eq('user_id', user.id);
          if (!error && data) {
            // Keep localStorage in sync
            const products = data.map(w => w.product).filter(Boolean);
            LS.set(KEYS.WISHLIST, products);
            return products;
          }
        }
      } catch (err) {
        console.warn('[DB] Supabase getWishlist failed:', err.message);
      }
    }
    return raw;
  },

  /**
   * Add a product to the wishlist.
   * @param {string|number} productId
   * @returns {Promise<void>}
   */
  async addToWishlistDB(productId) {
    const product = await this.getProductById(productId);
    if (!product) return;
    const wl = LS.get(KEYS.WISHLIST) || [];
    if (!wl.find(p => String(p.id) === String(productId))) {
      wl.push(product);
      LS.set(KEYS.WISHLIST, wl);
    }
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const user = window.Auth?.getCurrentUser?.();
        if (user) {
          await window.EpicSupabase
            .from('wishlist')
            .upsert([{ user_id: user.id, product_id: productId }]);
        }
      } catch (err) {
        console.warn('[DB] Supabase addToWishlistDB failed:', err.message);
      }
    }
  },

  /**
   * Remove a product from the wishlist.
   * @param {string|number} productId
   * @returns {Promise<void>}
   */
  async removeFromWishlistDB(productId) {
    const wl = (LS.get(KEYS.WISHLIST) || []).filter(p => String(p.id) !== String(productId));
    LS.set(KEYS.WISHLIST, wl);
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const user = window.Auth?.getCurrentUser?.();
        if (user) {
          await window.EpicSupabase
            .from('wishlist')
            .delete()
            .eq('user_id', user.id)
            .eq('product_id', productId);
        }
      } catch (err) {
        console.warn('[DB] Supabase removeFromWishlistDB failed:', err.message);
      }
    }
  },

  /* ══════════════════════════════════════════════════════════
     INVENTORY
     ══════════════════════════════════════════════════════════ */

  /**
   * Get full inventory list.
   * @returns {Promise<object[]>}
   */
  async getInventory() {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('inventory').select('*, product:products(name, price)');
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('[DB] Supabase getInventory failed:', err.message);
      }
    }
    const inventory = LS.get(KEYS.INVENTORY) || [];
    const products  = lsProducts();
    return inventory.map(inv => ({
      ...inv,
      product: products.find(p => String(p.id) === String(inv.productId)) || null,
    }));
  },

  /**
   * Update the stock quantity for a product.
   * @param {string|number} productId
   * @param {number}        quantity
   * @returns {Promise<object|null>}
   */
  async updateInventory(productId, quantity) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('inventory')
          .upsert([{ product_id: productId, quantity }])
          .select().single();
        if (error) throw error;
        return data;
      } catch (err) {
        console.warn('[DB] Supabase updateInventory failed:', err.message);
      }
    }
    const inventory = LS.get(KEYS.INVENTORY) || [];
    const idx = inventory.findIndex(i => String(i.productId) === String(productId));
    if (idx > -1) {
      inventory[idx].quantity = quantity;
    } else {
      inventory.push({ productId, quantity });
    }
    LS.set(KEYS.INVENTORY, inventory);

    // Also update product.stock in localStorage
    const products = lsProducts();
    const pidx = products.findIndex(p => String(p.id) === String(productId));
    if (pidx > -1) { products[pidx].stock = quantity; LS.set(KEYS.PRODUCTS, products); }

    return { productId, quantity };
  },

  /**
   * Get all products with stock below a threshold.
   * @param {number} [threshold=5]
   * @returns {Promise<object[]>}
   */
  async getLowStockItems(threshold = 5) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {
        const { data, error } = await window.EpicSupabase
          .from('inventory')
          .select('*, product:products(name, price, category)')
          .lte('quantity', threshold)
          .order('quantity', { ascending: true });
        if (error) throw error;
        return data || [];
      } catch (err) {
        console.warn('[DB] Supabase getLowStockItems failed:', err.message);
      }
    }
    return lsProducts().filter(p => (p.stock ?? 10) <= threshold);
  },

};

/* ─── Bootstrap ─────────────────────────────────────────────────────────── */
// Seed localStorage when the script loads (after data.js has set SAMPLE_DATA)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', seedLocalStorage);
} else {
  seedLocalStorage();
}

window.DB = DB;

// Automatically update LocalStorage products to remove Bronco and add MH2 GTR
(function migrateProducts() {
  try {
    const productsKey = 'et_products';
    let products = JSON.parse(localStorage.getItem(productsKey)) || [];
    
    // Remove Ford Bronco
    const originalLength = products.length;
    products = products.filter(p => !p.name.toLowerCase().includes('bronco') && !p.name.toLowerCase().includes('ford'));
    
    // Check if MH2 GTR already exists
    const hasMH2 = products.some(p => p.id === 'product-mh2-gtr' || p.name.includes('MH2 GTR'));
    
    if (!hasMH2) {
      const mh2Product = {
        id: 'product-mh2-gtr',
        name: 'MH2 GTR High Performance Model',
        slug: 'mh2-gtr-performance',
        category: 'hobby-grade',
        price: 14999,
        originalPrice: 19999,
        image: 'assets/images/new-product-1.jpg?v=2',
        images: ['assets/images/new-product-1.jpg?v=2', 'assets/images/new-product-2.jpg?v=2'],
        shortDescription: 'High performance hobby-grade track model featuring dual-motor AWD drive and realistic MH2 decals.',
        description: 'The MH2 GTR represents the pinnacle of compact track racing. Engineered with high-strength carbon composites and a high-performance brushless motor, this 1:10 scale replica delivers blinding speed and authentic track performance. Pre-assembled and ready-to-run (RTR) with a premium 2.4GHz radio system.',
        stock: 8,
        rating: 5.0,
        reviewsCount: 12,
        isFeatured: true,
        isNew: true,
        badge: 'bestseller',
        features: ['AWD Drivetrain', 'Brushless Power System', 'Authentic Decals & Finish', 'Adjustable Suspension'],
        specs: [
          { name: 'Scale', value: '1:10' },
          { name: 'Motor', value: 'Brushless 3300KV' },
          { name: 'Speed', value: '65+ km/h' },
          { name: 'Battery', value: '2S LiPo Supported' }
        ],
        created_at: new Date().toISOString()
      };
      products.push(mh2Product);
      localStorage.setItem(productsKey, JSON.stringify(products));
      
      // Update inventory entry
      const inventoryKey = 'et_inventory';
      let inventory = JSON.parse(localStorage.getItem(inventoryKey)) || [];
      const hasInv = inventory.some(i => i.productId === 'product-mh2-gtr');
      if (!hasInv) {
        inventory.push({ productId: 'product-mh2-gtr', quantity: 8 });
        localStorage.setItem(inventoryKey, JSON.stringify(inventory));
      }
      console.log('[Migration] Added MH2 GTR product & removed Ford Bronco.');
    } else {
      // Ensure existing MH2 GTR product has the cache-busting image URLs in localStorage
      let updated = false;
      products = products.map(p => {
        if (p.id === 'product-mh2-gtr' || p.name.includes('MH2 GTR')) {
          if (p.image !== 'assets/images/new-product-1.jpg?v=2') {
            p.image = 'assets/images/new-product-1.jpg?v=2';
            p.images = ['assets/images/new-product-1.jpg?v=2', 'assets/images/new-product-2.jpg?v=2'];
            updated = true;
          }
        }
        return p;
      });
      if (updated || products.length !== originalLength) {
        localStorage.setItem(productsKey, JSON.stringify(products));
        console.log('[Migration] Updated existing MH2 GTR product image URLs with cache-buster.');
      }
    }
  } catch (err) {
    console.warn('[Migration] Error migrating products:', err);
  }
})();

