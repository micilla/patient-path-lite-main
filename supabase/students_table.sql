-- ============================================================
-- STUDENT DETAILS TABLE
-- Run this script in your Supabase SQL Editor
-- (Dashboard > SQL Editor > New Query > Paste > Run)
-- ============================================================

-- Create students table
CREATE TABLE public.students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id TEXT NOT NULL UNIQUE DEFAULT ('STU-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  first_name TEXT NOT NULL CHECK (char_length(trim(first_name)) BETWEEN 2 AND 80),
  last_name TEXT NOT NULL CHECK (char_length(trim(last_name)) BETWEEN 2 AND 80),
  email TEXT NOT NULL CHECK (char_length(trim(email)) BETWEEN 5 AND 160),
  date_of_birth DATE,
  gender public.gender_type NOT NULL DEFAULT 'unknown',
  phone TEXT CHECK (phone IS NULL OR char_length(trim(phone)) <= 30),
  address TEXT CHECK (address IS NULL OR char_length(trim(address)) <= 300),
  department TEXT CHECK (department IS NULL OR char_length(trim(department)) <= 100),
  program TEXT CHECK (program IS NULL OR char_length(trim(program)) <= 160),
  year_of_study INTEGER CHECK (year_of_study IS NULL OR (year_of_study >= 1 AND year_of_study <= 8)),
  emergency_contact_name TEXT CHECK (emergency_contact_name IS NULL OR char_length(trim(emergency_contact_name)) <= 160),
  emergency_contact_phone TEXT CHECK (emergency_contact_phone IS NULL OR char_length(trim(emergency_contact_phone)) <= 30),
  medical_notes TEXT CHECK (medical_notes IS NULL OR char_length(trim(medical_notes)) <= 2000),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX idx_students_student_id ON public.students(student_id);
CREATE INDEX idx_students_name ON public.students USING gin (to_tsvector('simple', first_name || ' ' || last_name));
CREATE INDEX idx_students_email ON public.students(email);

-- Triggers
CREATE TRIGGER update_students_updated_at
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER protect_students_created_by
BEFORE UPDATE ON public.students
FOR EACH ROW EXECUTE FUNCTION public.prevent_created_by_change();

-- Enable RLS
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Clinical staff can view students"
ON public.students FOR SELECT TO authenticated
USING (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff can create students"
ON public.students FOR INSERT TO authenticated
WITH CHECK (public.is_clinical_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Clinical staff can update students"
ON public.students FOR UPDATE TO authenticated
USING (public.is_clinical_staff(auth.uid()))
WITH CHECK (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Only admins can remove students"
ON public.students FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- ============================================================
-- DONE! The students table is ready.
-- ============================================================
