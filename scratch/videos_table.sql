-- ============================================================
-- EPIC TOYZ — Product Videos Table & Storage Setup
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── EXTENSIONS ───────────────────────────────────────────────
-- Ensure UUID generator extension is active (provides uuid_generate_v4())
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TABLE ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS product_videos (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title         TEXT NOT NULL,
  video_url     TEXT NOT NULL,
  poster_url    TEXT,
  product_slug  TEXT NOT NULL,
  product_name  TEXT,
  display_order INT DEFAULT 0,
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── INDEX ────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_product_videos_active ON product_videos(is_active);
CREATE INDEX IF NOT EXISTS idx_product_videos_order  ON product_videos(display_order);

-- ── AUTO-UPDATE updated_at ───────────────────────────────────
-- Ensure the timestamp updater function exists before attaching the trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS product_videos_updated_at ON product_videos;
CREATE TRIGGER product_videos_updated_at
  BEFORE UPDATE ON product_videos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
ALTER TABLE product_videos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Videos are publicly readable" ON product_videos;
DROP POLICY IF EXISTS "Admin can manage videos"      ON product_videos;

-- Public can read active videos
CREATE POLICY "Videos are publicly readable"
  ON product_videos FOR SELECT
  USING (is_active = TRUE);

-- Admin can do everything
CREATE POLICY "Admin can manage videos"
  ON product_videos FOR ALL
  USING (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com')
  WITH CHECK (coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com');

-- ── STORAGE BUCKET ───────────────────────────────────────────
-- Run this in Supabase Dashboard → Storage → Create Bucket
-- Name: videos, Public: YES
-- OR execute via SQL:

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'videos',
  'videos',
  true,
  104857600,  -- 100 MB limit per file
  ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 104857600,
  allowed_mime_types = ARRAY['video/mp4', 'video/quicktime', 'video/webm', 'image/jpeg', 'image/png', 'image/webp'];

-- Storage RLS policies for videos bucket
DROP POLICY IF EXISTS "Public can read videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin can upload to videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin can delete from videos bucket" ON storage.objects;
DROP POLICY IF EXISTS "Admin can update videos bucket" ON storage.objects;

CREATE POLICY "Public can read videos bucket"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'videos');

CREATE POLICY "Admin can upload to videos bucket"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'videos' AND
    coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com'
  );

CREATE POLICY "Admin can delete from videos bucket"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'videos' AND
    coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com'
  );

CREATE POLICY "Admin can update videos bucket"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'videos' AND
    coalesce(lower((select auth.jwt() ->> 'email')), '') = 'epictoyz.in@gmail.com'
  );

-- ── VERIFY ───────────────────────────────────────────────────
SELECT 'product_videos table ready!' AS status,
       COUNT(*) AS video_count
FROM product_videos;
