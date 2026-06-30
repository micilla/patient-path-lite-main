-- ============================================================
-- Allow public (unauthenticated) student self-registration
-- ============================================================
-- This migration enables students to submit their details via the
-- public /student-form page without requiring a login.
--
-- Changes:
--   1. Make `created_by` nullable (anonymous users have no auth.uid())
--   2. Add RLS policy: anon users can INSERT their own student record
-- ============================================================

-- 1. Allow created_by to be NULL (anonymous submissions)
ALTER TABLE public.students
  ALTER COLUMN created_by DROP NOT NULL;

-- 2. Allow anonymous (unauthenticated) users to insert student records
CREATE POLICY "Anyone can self-register as a student"
  ON public.students
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- 3. Grant INSERT privilege to the anon role so RLS can be evaluated
GRANT INSERT ON public.students TO anon;

-- ============================================================
-- DONE. Anonymous students can now submit the public form.
-- Staff (authenticated) can still view/edit/delete via existing policies.
-- ============================================================
