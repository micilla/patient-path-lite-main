-- ============================================================
-- FIX: Grant execute permissions on RLS helper functions
-- Without this, ALL RLS policies that call has_role() or 
-- is_clinical_staff() fail with "permission denied for function"
-- ============================================================

-- Core fix: allow authenticated users to call these functions
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinical_staff(UUID) TO authenticated;

-- Also grant to anon role for completeness (some edge cases)
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO anon;
GRANT EXECUTE ON FUNCTION public.is_clinical_staff(UUID) TO anon;

-- ============================================================
-- FIX: Add foreign key constraints to auth.users (if missing)
-- These ensure referential integrity for staff_profiles and
-- user_roles. Using IF NOT EXISTS pattern via DO block.
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'staff_profiles_user_id_fkey'
      AND table_name = 'staff_profiles'
  ) THEN
    ALTER TABLE public.staff_profiles
      ADD CONSTRAINT staff_profiles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'user_roles_user_id_fkey'
      AND table_name = 'user_roles'
  ) THEN
    ALTER TABLE public.user_roles
      ADD CONSTRAINT user_roles_user_id_fkey
      FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- FIX: Protect created_by from being tampered with on UPDATE
-- ============================================================
CREATE OR REPLACE FUNCTION public.prevent_created_by_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'Cannot change created_by field';
  END IF;
  RETURN NEW;
END;
$$;

-- Create triggers only if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_patients_created_by') THEN
    CREATE TRIGGER protect_patients_created_by
    BEFORE UPDATE ON public.patients
    FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_lab_results_created_by') THEN
    CREATE TRIGGER protect_lab_results_created_by
    BEFORE UPDATE ON public.lab_results
    FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change();
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'protect_visit_notes_created_by') THEN
    CREATE TRIGGER protect_visit_notes_created_by
    BEFORE UPDATE ON public.visit_notes
    FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change();
  END IF;
END $$;
