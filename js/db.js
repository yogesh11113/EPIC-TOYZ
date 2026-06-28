'use strict';

/* ─── helpers ────────────────────────────────────────────────────────────── */

const LS = {
  get: (key) => { try { return JSON.parse(localStorage.getItem(key)); } catch { return null; } },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
  remove: (key) => localStorage.removeItem(key),
};

const KEYS = {
  PRODUCTS: 'et_products',
  CATEGORIES: 'et_categories',
  ORDERS: 'et_orders',
  REVIEWS: 'et_reviews',
  WISHLIST: 'et_wishlist',
  INVENTORY: 'et_inventory',
};

function seedLocalStorage() {
  if (!LS.get('et_initialized') && window.SAMPLE_DATA) {
    LS.set(KEYS.PRODUCTS, window.SAMPLE_DATA.products || []);
    LS.set(KEYS.CATEGORIES, window.SAMPLE_DATA.categories || []);
    LS.set(KEYS.ORDERS, []);
    LS.set(KEYS.REVIEWS, window.SAMPLE_DATA.reviews || []);
    LS.set(KEYS.INVENTORY, (window.SAMPLE_DATA.products || []).map(p => ({
      productId: p.id,
      quantity: p.stock ?? 10,
    })));
    localStorage.setItem('et_initialized', 'true');
  }
}

function lsProducts() { return LS.get(KEYS.PRODUCTS) || []; }
function lsCategories() { return LS.get(KEYS.CATEGORIES) || []; }
function lsOrders() { return LS.get(KEYS.ORDERS) || []; }
function lsReviews() { return LS.get(KEYS.REVIEWS) || []; }

function uid() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
  });
}

/* ─── SAFE QUERY FIX ─────────────────────────────────────────────────────── */

async function queryProductsSafe(buildQueryFn, isSingle = false) {
  try {
    // ❌ OLD: categories join removed to fix timeout
    const qJoin = buildQueryFn('*');

    const result = isSingle ? await qJoin.single() : await qJoin;
    if (!result.error) return result;

    const err = result.error;
    const errMsg = err.message || '';

    if ((err.code === 'PGRST205' || err.status === 404)) {
      throw err;
    }

    const qPlain = buildQueryFn('*');
    const retryResult = isSingle ? await qPlain.single() : await qPlain;

    return retryResult;

  } catch (e) {
    console.error('[DB] queryProductsSafe failed:', e.message || e);
    throw e;
  }
}

/* ─── PRODUCT MAPPING ───────────────────────────────────────────────────── */

function mapSupabaseProduct(p) {
  if (!p) return null;

  return {
    ...p,
    originalPrice: p.original_price != null ? Number(p.original_price) : null,
    price: p.price != null ? Number(p.price) : 0,
    shortDescription: p.short_description || '',
    isFeatured: !!p.is_featured,
    stock: p.stock_quantity ?? 0,
    stockQuantity: p.stock_quantity ?? 0,
    reviewsCount: p.review_count ?? 0,
    image: (p.images && p.images.length > 0) ? p.images[0] : 'assets/images/placeholder.jpg',
    specs: p.specifications || {},
    specifications: p.specifications || {},
    category: p.category_id || '',
    categoryId: p.category_id || '',
  };
}

/* ─── DB ─────────────────────────────────────────────────────────────────── */

const DB = {

  async getProducts(filters = {}) {
    if (isSupabaseConfigured() && window.EpicSupabase) {
      try {

        const buildQuery = (selectStr) => {
          let query = window.EpicSupabase.from('products').select(selectStr);

          if (filters.category) {
            query = query.eq('category_id', filters.category);
          }

          if (filters.featured) query = query.eq('is_featured', true);
          if (filters.search) query = query.ilike('name', `%${filters.search}%`);
          if (filters.minPrice != null) query = query.gte('price', filters.minPrice);
          if (filters.maxPrice != null) query = query.lte('price', filters.maxPrice);

          const sort = filters.sort || 'featured';
          if (sort === 'price-asc') query = query.order('price', { ascending: true });
          else if (sort === 'price-desc') query = query.order('price', { ascending: false });
          else query = query.order('is_featured', { ascending: false });

          // ✅ LIMIT FIX (IMPORTANT)
          query = query.limit(filters.limit || 24);

          return query;
        };

        const { data, error } = await queryProductsSafe(buildQuery);
        if (error) throw error;

        return (data || []).map(mapSupabaseProduct);

      } catch (err) {
        console.warn('[DB] Supabase getProducts failed:', err.message);
      }
    }

    let products = lsProducts();

    if (filters.limit) {
      products = products.slice(0, filters.limit);
    } else {
      products = products.slice(0, 24);
    }

    return products;
  },

  async getProductById(id) {
    const p = lsProducts().find(p => String(p.id) === String(id));
    return p || null;
  },

  async getCategories() {
    return lsCategories();
  }
};

/* ─── BOOT ──────────────────────────────────────────────────────────────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', seedLocalStorage);
} else {
  seedLocalStorage();
}

window.DB = DB;