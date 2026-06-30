GRANT EXECUTE ON FUNCTION public.is_clinical_staff(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(UUID, public.app_role) TO authenticated;

-- Note: grants intentionally limited to `authenticated` role for safety.
