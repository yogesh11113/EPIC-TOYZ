-- ============================================================
-- EPIC TOYZ — FULL DATABASE SETUP
-- Run this entire script in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";


-- ============================================================
-- TABLE: categories
-- ============================================================
CREATE TABLE IF NOT EXISTS categories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  icon TEXT,
  color TEXT DEFAULT '#E63946',
  display_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE: products
-- ============================================================
CREATE TABLE IF NOT EXISTS products (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  short_description TEXT,
  price DECIMAL(10,2) NOT NULL,
  original_price DECIMAL(10,2),
  category_id UUID REFERENCES categories(id) ON DELETE SET NULL,
  images TEXT[] DEFAULT '{}',
  specifications JSONB DEFAULT '{}',
  features TEXT[] DEFAULT '{}',
  badge TEXT CHECK (badge IN ('new', 'bestseller', 'featured', 'sale', NULL)),
  is_featured BOOLEAN DEFAULT FALSE,
  is_active BOOLEAN DEFAULT TRUE,
  stock_quantity INT DEFAULT 0,
  rating DECIMAL(3,2) DEFAULT 0,
  review_count INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE: profiles (extends auth.users)
-- ============================================================
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE: orders
-- ============================================================
CREATE TABLE IF NOT EXISTS orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_number TEXT UNIQUE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  customer_name TEXT NOT NULL,
  customer_phone TEXT NOT NULL,
  customer_email TEXT,
  address_line1 TEXT NOT NULL,
  address_line2 TEXT,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  subtotal DECIMAL(10,2) NOT NULL,
  shipping DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) NOT NULL,
  payment_method TEXT DEFAULT 'whatsapp',
  payment_status TEXT DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'failed', 'refunded')),
  order_status TEXT DEFAULT 'pending' CHECK (order_status IN ('pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled')),
  whatsapp_sent BOOLEAN DEFAULT FALSE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE: order_items
-- ============================================================
CREATE TABLE IF NOT EXISTS order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  product_image TEXT,
  price DECIMAL(10,2) NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  line_total DECIMAL(10,2) NOT NULL
);


-- ============================================================
-- TABLE: reviews
-- ============================================================
CREATE TABLE IF NOT EXISTS reviews (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_name TEXT NOT NULL,
  reviewer_email TEXT,
  rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  title TEXT,
  review_text TEXT,
  is_verified BOOLEAN DEFAULT FALSE,
  is_approved BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- TABLE: wishlist  (singular — matches the schema)
-- ============================================================
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ============================================================
-- VIEW: wishlists  (plural alias — so any old code still works)
-- ============================================================
CREATE OR REPLACE VIEW wishlists AS SELECT * FROM wishlist;


-- ============================================================
-- TABLE: inventory
-- ============================================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE UNIQUE NOT NULL,
  quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ============================================================
-- INDEXES for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_badge     ON products(badge);
CREATE INDEX IF NOT EXISTS idx_products_featured  ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_active    ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user        ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status      ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_reviews_product    ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user      ON wishlist(user_id);


-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE profiles    ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews     ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist    ENABLE ROW LEVEL SECURITY;
ALTER TABLE products    ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory   ENABLE ROW LEVEL SECURITY;

-- Drop existing policies to avoid conflicts on re-run
DROP POLICY IF EXISTS "Products are publicly readable"   ON products;
DROP POLICY IF EXISTS "Admin can manage products"        ON products;
DROP POLICY IF EXISTS "Categories are publicly readable" ON categories;
DROP POLICY IF EXISTS "Admin can manage categories"      ON categories;
DROP POLICY IF EXISTS "Users can view own profile"       ON profiles;
DROP POLICY IF EXISTS "Users can update own profile"     ON profiles;
DROP POLICY IF EXISTS "Users can insert own profile"     ON profiles;
DROP POLICY IF EXISTS "Admin can view all profiles"      ON profiles;
DROP POLICY IF EXISTS "Users can view own orders"        ON orders;
DROP POLICY IF EXISTS "Users can create orders"          ON orders;
DROP POLICY IF EXISTS "Admin can view all orders"        ON orders;
DROP POLICY IF EXISTS "Approved reviews are public"      ON reviews;
DROP POLICY IF EXISTS "Users can create reviews"         ON reviews;
DROP POLICY IF EXISTS "Admin can manage reviews"         ON reviews;
DROP POLICY IF EXISTS "Users manage own wishlist"        ON wishlist;
DROP POLICY IF EXISTS "Admin manages inventory"          ON inventory;
DROP POLICY IF EXISTS "Public can read inventory"        ON inventory;
DROP POLICY IF EXISTS "Allow anonymous order inserts"    ON order_items;
DROP POLICY IF EXISTS "Admin can view order_items"       ON order_items;

-- Products: public read (active only), admin manages all
CREATE POLICY "Products are publicly readable"
  ON products FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin can manage products"
  ON products FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Categories: public read, admin manages
CREATE POLICY "Categories are publicly readable"
  ON categories FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage categories"
  ON categories FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Profiles
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile"
  ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin can view all profiles"
  ON profiles FOR SELECT USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Orders
CREATE POLICY "Users can view own orders"
  ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders"
  ON orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admin can view all orders"
  ON orders FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Order items
CREATE POLICY "Allow anonymous order inserts"
  ON order_items FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admin can view order_items"
  ON order_items FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Reviews
CREATE POLICY "Approved reviews are public"
  ON reviews FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users can create reviews"
  ON reviews FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admin can manage reviews"
  ON reviews FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Wishlist
CREATE POLICY "Users manage own wishlist"
  ON wishlist FOR ALL USING (auth.uid() = user_id);

-- Inventory
CREATE POLICY "Admin manages inventory"
  ON inventory FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');
CREATE POLICY "Public can read inventory"
  ON inventory FOR SELECT USING (TRUE);


-- ============================================================
-- TRIGGER: auto-update updated_at timestamp
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS products_updated_at ON products;
DROP TRIGGER IF EXISTS orders_updated_at   ON orders;
DROP TRIGGER IF EXISTS profiles_updated_at ON profiles;

CREATE TRIGGER products_updated_at
  BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at
  BEFORE UPDATE ON orders   FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- TRIGGER: auto-create profile on signup
-- ============================================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name)
  VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();


-- ============================================================
-- SEED: 5 product categories
-- ============================================================
INSERT INTO categories (name, slug, description, icon, color, display_order) VALUES
  ('Drift Cars',   'drift-cars',   'High-performance drift machines for precision sliding', '🏎️', '#E63946', 1),
  ('Mini RC Cars', 'mini-rc',      'Compact and fun micro RC cars for indoor play',          '🚗', '#457B9D', 2),
  ('Hobby Grade',  'hobby-grade',  'Professional-level RC cars for serious enthusiasts',     '🏁', '#2ecc71', 3),
  ('Crawlers',     'crawlers',     'Rock crawlers built for off-road adventures',             '🪨', '#e67e22', 4),
  ('Unique RC',    'unique-rc',    'Special RC cars unlike anything else',                   '⭐', '#9b59b6', 5)
ON CONFLICT (slug) DO NOTHING;


-- ============================================================
-- DONE — Verify results
-- ============================================================
SELECT
  'Epic Toyz database setup complete!' AS status,
  (SELECT COUNT(*) FROM categories)    AS categories_seeded,
  (SELECT COUNT(*) FROM products)      AS products_count;
