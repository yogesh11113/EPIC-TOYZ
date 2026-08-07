-- ============================================================================
-- MIGRATION: Fix handle_new_user() search_path & schema qualification
-- Resolves: ERROR: relation "profiles" does not exist (SQLSTATE 42P01)
-- Target Function: handle_new_user()
-- Target Trigger: on_auth_user_created ON auth.users
-- Safe for live production (Migration Only - No Data Loss, No Table Recreation)
-- ============================================================================

BEGIN;

-- 1. Recreate handle_new_user() function with explicit search_path = public
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (id, full_name)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''))
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    -- Exception block prevents user signup failure if profile insertion encounters an edge case
    RAISE WARNING 'handle_new_user profile insert warning: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 2. Recreate the trigger on auth.users safely
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

COMMIT;
