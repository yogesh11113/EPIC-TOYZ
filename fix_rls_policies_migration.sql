-- ============================================================================
-- MIGRATION: Fix Row-Level Security (RLS) Policies for Admin Access
-- Target Tables: products, categories, inventory, settings, reviews
-- Admin Email: epictoyz.in@gmail.com
-- Safe for live production (Migration Only - No Data Loss, No Table Recreation)
-- ============================================================================

BEGIN;

-- 1. Ensure Row-Level Security (RLS) is enabled on target tables
ALTER TABLE IF EXISTS products ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reviews ENABLE ROW LEVEL SECURITY;

-- Safeguard: Ensure settings table exists and has RLS enabled
CREATE TABLE IF NOT EXISTS settings (
    key text PRIMARY KEY,
    value jsonb,
    updated_at timestamptz DEFAULT now()
);
ALTER TABLE IF EXISTS settings ENABLE ROW LEVEL SECURITY;

-- 2. Dynamically drop all existing RLS policies on target tables
DO $$
DECLARE
    pol record;
BEGIN
    FOR pol IN 
        SELECT policyname, tablename 
        FROM pg_policies 
        WHERE tablename IN ('products', 'categories', 'inventory', 'settings', 'reviews')
          AND schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I', pol.policyname, pol.tablename);
    END LOOP;
END $$;


-- ============================================================================
-- 3. RE-CREATE RLS POLICIES WITH PROPER USING AND WITH CHECK CLAUSES
-- ============================================================================

-- ----------------------------------------------------------------------------
-- TABLE: products
-- ----------------------------------------------------------------------------
-- Public: Read active products
CREATE POLICY "Products public read policy"
    ON products FOR SELECT
    USING (is_active = TRUE);

-- Admin (epictoyz.in@gmail.com): Full CRUD (SELECT, INSERT, UPDATE, DELETE) access
CREATE POLICY "Admin full access on products"
    ON products FOR ALL
    USING (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com')
    WITH CHECK (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com');


-- ----------------------------------------------------------------------------
-- TABLE: categories
-- ----------------------------------------------------------------------------
-- Public: Read all categories
CREATE POLICY "Categories public read policy"
    ON categories FOR SELECT
    USING (TRUE);

-- Admin (epictoyz.in@gmail.com): Full CRUD access
CREATE POLICY "Admin full access on categories"
    ON categories FOR ALL
    USING (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com')
    WITH CHECK (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com');


-- ----------------------------------------------------------------------------
-- TABLE: inventory
-- ----------------------------------------------------------------------------
-- Public: Read inventory levels
CREATE POLICY "Inventory public read policy"
    ON inventory FOR SELECT
    USING (TRUE);

-- Admin (epictoyz.in@gmail.com): Full CRUD access
CREATE POLICY "Admin full access on inventory"
    ON inventory FOR ALL
    USING (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com')
    WITH CHECK (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com');


-- ----------------------------------------------------------------------------
-- TABLE: settings
-- ----------------------------------------------------------------------------
-- Public: Read shop settings
CREATE POLICY "Settings public read policy"
    ON settings FOR SELECT
    USING (TRUE);

-- Admin (epictoyz.in@gmail.com): Full CRUD access
CREATE POLICY "Admin full access on settings"
    ON settings FOR ALL
    USING (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com')
    WITH CHECK (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com');


-- ----------------------------------------------------------------------------
-- TABLE: reviews
-- ----------------------------------------------------------------------------
-- Public: Read approved reviews
CREATE POLICY "Approved reviews public read policy"
    ON reviews FOR SELECT
    USING (is_approved = TRUE);

-- Public/Customers: Submit new reviews
CREATE POLICY "Customers can submit reviews"
    ON reviews FOR INSERT
    WITH CHECK (TRUE);

-- Admin (epictoyz.in@gmail.com): Full CRUD access
CREATE POLICY "Admin full access on reviews"
    ON reviews FOR ALL
    USING (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com')
    WITH CHECK (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com');

COMMIT;
