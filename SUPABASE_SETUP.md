# 🚀 Epic Toyz — Supabase Setup Guide

Follow these steps to connect your Epic Toyz website to Supabase.

---

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com) and sign up / log in
2. Click **"New Project"**
3. Fill in:
   - **Project Name**: `epic-toyz`
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: `Southeast Asia (Singapore)` (closest to India)
4. Click **"Create new project"** and wait ~2 minutes for setup

---

## Step 2: Get Your API Keys

1. In your Supabase dashboard, go to **Settings → API**
2. Copy:
   - **Project URL** (looks like: `https://xxxxxx.supabase.co`)
   - **Project API Key → anon/public** (long string starting with `eyJ...`)

---

## Step 3: Update js/supabase.js

Open `js/supabase.js` in the project and replace:

```javascript
const SUPABASE_CONFIG = {
  url: 'YOUR_SUPABASE_URL',         // ← Replace with your Project URL
  anonKey: 'YOUR_SUPABASE_ANON_KEY' // ← Replace with your anon key
};
```

Example:
```javascript
const SUPABASE_CONFIG = {
  url: 'https://abcdefghij.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...'
};
```

---

## Step 4: Create the Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **"New Query"**
3. Paste and run the following SQL:

```sql
-- ============================================
-- EPIC TOYZ - FULL DATABASE SCHEMA
-- ============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABLE: categories
-- ============================================
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

-- ============================================
-- TABLE: products
-- ============================================
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

-- ============================================
-- TABLE: profiles (extends auth.users)
-- ============================================
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

-- ============================================
-- TABLE: orders
-- ============================================
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

-- ============================================
-- TABLE: order_items
-- ============================================
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

-- ============================================
-- TABLE: reviews
-- ============================================
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

-- ============================================
-- TABLE: wishlist
-- ============================================
CREATE TABLE IF NOT EXISTS wishlist (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  product_id UUID REFERENCES products(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, product_id)
);

-- ============================================
-- TABLE: inventory
-- ============================================
CREATE TABLE IF NOT EXISTS inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE UNIQUE NOT NULL,
  quantity INT DEFAULT 0,
  low_stock_threshold INT DEFAULT 5,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES for performance
-- ============================================
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category_id);
CREATE INDEX IF NOT EXISTS idx_products_badge ON products(badge);
CREATE INDEX IF NOT EXISTS idx_products_featured ON products(is_featured);
CREATE INDEX IF NOT EXISTS idx_products_active ON products(is_active);
CREATE INDEX IF NOT EXISTS idx_orders_user ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_reviews_product ON reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_wishlist_user ON wishlist(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE wishlist ENABLE ROW LEVEL SECURITY;

-- Products and categories: read by everyone, write by admin only
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;

-- Public read for products
CREATE POLICY "Products are publicly readable" ON products FOR SELECT USING (is_active = TRUE);
CREATE POLICY "Admin can manage products" ON products FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Public read for categories
CREATE POLICY "Categories are publicly readable" ON categories FOR SELECT USING (TRUE);
CREATE POLICY "Admin can manage categories" ON categories FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Profiles: users can read/update own profile
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "Admin can view all profiles" ON profiles FOR SELECT USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Orders: users see own orders, admin sees all
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create orders" ON orders FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admin can view all orders" ON orders FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Reviews: approved reviews are public
CREATE POLICY "Approved reviews are public" ON reviews FOR SELECT USING (is_approved = TRUE);
CREATE POLICY "Users can create reviews" ON reviews FOR INSERT WITH CHECK (TRUE);
CREATE POLICY "Admin can manage reviews" ON reviews FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');

-- Wishlist: users manage own wishlist
CREATE POLICY "Users manage own wishlist" ON wishlist FOR ALL USING (auth.uid() = user_id);

-- Inventory: admin only
CREATE POLICY "Admin manages inventory" ON inventory FOR ALL USING (auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com');
CREATE POLICY "Public can read inventory" ON inventory FOR SELECT USING (TRUE);

-- ============================================
-- TRIGGER: auto-update updated_at
-- ============================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER products_updated_at BEFORE UPDATE ON products FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- TRIGGER: auto-create profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, full_name) VALUES (NEW.id, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION handle_new_user();
```

Click **"Run"** — you should see "Success. No rows returned."

---

## Step 5: Set Up Supabase Authentication

1. Go to **Authentication → Settings**
2. Under **Email Auth**, ensure **"Enable Email Confirmations"** is set to your preference
   - For testing: **Disable** email confirmation
   - For production: **Enable** it
3. Go to **Authentication → URL Configuration**
4. Add your website URL to **"Site URL"** (e.g., `http://localhost:5500` for testing)
5. Add to **"Redirect URLs"**: `http://localhost:5500/**`

---

## Step 6: Set Up Supabase Storage (for Product Images)

1. Go to **Storage** in Supabase dashboard
2. Click **"New Bucket"**
3. Name: `product-images`
4. Set to **Public bucket** ✅
5. Click **"Create bucket"**

Then run this SQL to allow uploads:
```sql
CREATE POLICY "Admin can upload images" ON storage.objects FOR INSERT WITH CHECK (
  bucket_id = 'product-images' AND auth.jwt() ->> 'email' = 'epictoyz.in@gmail.com'
);
CREATE POLICY "Public can view images" ON storage.objects FOR SELECT USING (bucket_id = 'product-images');
```

---

## Step 7: Seed Initial Data (Optional)

Run this in SQL Editor to add the 5 categories:

```sql
INSERT INTO categories (name, slug, description, icon, color, display_order) VALUES
('Drift Cars', 'drift-cars', 'High-performance drift machines for precision sliding', '🏎️', '#E63946', 1),
('Mini RC Cars', 'mini-rc', 'Compact and fun micro RC cars for indoor play', '🚗', '#457B9D', 2),
('Hobby Grade', 'hobby-grade', 'Professional-level RC cars for serious enthusiasts', '🏁', '#2ecc71', 3),
('Crawlers', 'crawlers', 'Rock crawlers built for off-road adventures', '🪨', '#e67e22', 4),
('Unique RC', 'unique-rc', 'Special RC cars unlike anything else', '⭐', '#9b59b6', 5);
```

---

## Step 8: Create Admin Account

1. Go to **Authentication → Users** in Supabase
2. Click **"Invite user"** or **"Add user"**
3. Enter email: `epictoyz.in@gmail.com`
4. Enter password: `yogesh123*`
5. Click **"Create User"**

> **Note**: The admin check in the website looks for `epictoyz.in@gmail.com` — any Supabase account with this email will have admin access.

---

## Step 9: Test the Connection

1. Open your website in a browser
2. Open browser DevTools (F12) → Console
3. You should see: `✅ Supabase connected` (or similar)
4. If you see errors, double-check your URL and anon key in `js/supabase.js`

---

## 🔑 Quick Reference

| Item | Value |
|------|-------|
| Admin Email | epictoyz.in@gmail.com |
| Admin Password | yogesh123* |
| WhatsApp | 6383793890 |
| UPI ID | yogesh2007.gv@oksbi |
| Support Email | epictoyz.in@gmail.com |

---

## 🛡️ Security Checklist

- [ ] Replace `YOUR_SUPABASE_URL` in `js/supabase.js`
- [ ] Replace `YOUR_SUPABASE_ANON_KEY` in `js/supabase.js`
- [ ] Run the full SQL schema
- [ ] Enable RLS on all tables (done in schema above)
- [ ] Create admin Supabase account
- [ ] Set up email confirmation for production
- [ ] Add your production domain to Supabase allowed URLs

---

## 📞 Need Help?

- Supabase Docs: [https://supabase.com/docs](https://supabase.com/docs)
- WhatsApp: 6383793890
- Email: epictoyz.in@gmail.com
