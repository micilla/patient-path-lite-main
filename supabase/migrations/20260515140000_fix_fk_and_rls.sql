-- Fix: Grant execute permissions on RLS helper functions to authenticated users
-- Without this, all RLS policies that call has_role() or is_clinical_staff() fail
-- with "permission denied for function has_role"
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_clinical_staff(UUID) TO authenticated;

-- Fix #7: Add foreign key constraints to auth.users for referential integrity
ALTER TABLE public.staff_profiles
  ADD CONSTRAINT staff_profiles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- Fix #8: Protect created_by from being tampered with on UPDATE
-- Patients: prevent changing created_by
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

CREATE TRIGGER protect_patients_created_by
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change();

CREATE TRIGGER protect_lab_results_created_by
BEFORE UPDATE ON public.lab_results
FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change();

CREATE TRIGGER protect_visit_notes_created_by
BEFORE UPDATE ON public.visit_notes
FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change();
