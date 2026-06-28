'use strict';

/* ───────── LocalStorage Helpers ───────── */

const LS = {
  get: (key) => {
    try { return JSON.parse(localStorage.getItem(key)); }
    catch { return null; }
  },
  set: (key, val) => localStorage.setItem(key, JSON.stringify(val)),
};

const KEYS = {
  PRODUCTS: 'et_products',
  CATEGORIES: 'et_categories',
};

/* ───────── Seed ───────── */

function seedLocalStorage() {
  if (!localStorage.getItem('et_initialized') && window.SAMPLE_DATA) {
    LS.set(KEYS.PRODUCTS, window.SAMPLE_DATA.products || []);
    LS.set(KEYS.CATEGORIES, window.SAMPLE_DATA.categories || []);
    localStorage.setItem('et_initialized', 'true');
  }
}

/* ───────── Loaders ───────── */

const lsProducts = () => LS.get(KEYS.PRODUCTS) || [];
const lsCategories = () => LS.get(KEYS.CATEGORIES) || [];

/* ───────── Utils ───────── */

function mapProduct(p) {
  if (!p) return null;

  return {
    ...p,
    price: Number(p.price || 0),
    originalPrice: p.original_price ? Number(p.original_price) : null,
    shortDescription: p.short_description || '',
    isFeatured: !!p.is_featured,
    stock: p.stock_quantity ?? p.stock ?? 0,
    image: (p.images && p.images.length) ? p.images[0] : 'assets/images/placeholder.jpg',
    categoryId: p.category_id || '',
  };
}

/* ───────── DB ───────── */

const DB = {

  /* ================= PRODUCTS ================= */

  async getProducts(filters = {}) {

    // ── SUPABASE PATH ──
    if (false) {
      try {

        let query = window.EpicSupabase
          .from('products')
          .select('*') // ✅ IMPORTANT FIX (NO JOIN)

          .limit(filters.limit || 24); // ✅ prevents timeout

        if (filters.category) {
          query = query.eq('category_id', filters.category);
        }

        if (filters.featured) {
          query = query.eq('is_featured', true);
        }

        if (filters.search) {
          query = query.ilike('name', `%${filters.search}%`);
        }

        if (filters.minPrice != null) {
          query = query.gte('price', filters.minPrice);
        }

        if (filters.maxPrice != null) {
          query = query.lte('price', filters.maxPrice);
        }

        const sort = filters.sort || 'featured';

        if (sort === 'price-asc') {
          query = query.order('price', { ascending: true });
        } else if (sort === 'price-desc') {
          query = query.order('price', { ascending: false });
        } else if (sort === 'newest') {
          query = query.order('created_at', { ascending: false });
        } else {
          query = query.order('is_featured', { ascending: false });
        }

        const { data, error } = await query;

        if (error) throw error;

        return (data || []).map(mapProduct);

      } catch (err) {
        console.warn('[DB] Supabase failed, using local:', err.message);
      }
    }

    // ── LOCAL FALLBACK ──
    let products = lsProducts();

    return products
      .map(mapProduct)
      .slice(0, filters.limit || 24);
  },

  /* ================= SINGLE PRODUCT ================= */

  async getProductById(id) {
    const p = lsProducts().find(x => String(x.id) === String(id));
    return mapProduct(p);
  },

  /* ================= CATEGORIES ================= */

  async getCategories() {
    return lsCategories();
  }
};

/* ───────── INIT ───────── */

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', seedLocalStorage);
} else {
  seedLocalStorage();
}

window.DB = DB;