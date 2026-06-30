CREATE TYPE public.app_role AS ENUM ('admin', 'doctor', 'nurse');
CREATE TYPE public.gender_type AS ENUM ('female', 'male', 'other', 'unknown');

CREATE TABLE public.staff_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE CHECK (char_length(trim(username)) BETWEEN 3 AND 50),
  display_name TEXT NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 2 AND 100),
  department TEXT CHECK (department IS NULL OR char_length(trim(department)) <= 80),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

CREATE TABLE public.patients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id TEXT NOT NULL UNIQUE DEFAULT ('DCF-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  name TEXT NOT NULL CHECK (char_length(trim(name)) BETWEEN 2 AND 160),
  dob DATE,
  age INTEGER CHECK (age IS NULL OR (age >= 0 AND age <= 130)),
  gender public.gender_type NOT NULL DEFAULT 'unknown',
  phone TEXT CHECK (phone IS NULL OR char_length(trim(phone)) <= 30),
  address TEXT CHECK (address IS NULL OR char_length(trim(address)) <= 300),
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.lab_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  test_name TEXT NOT NULL CHECK (char_length(trim(test_name)) BETWEEN 2 AND 140),
  result TEXT NOT NULL CHECK (char_length(trim(result)) BETWEEN 1 AND 2000),
  file_path TEXT CHECK (file_path IS NULL OR char_length(trim(file_path)) <= 500),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.visit_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  symptoms TEXT NOT NULL CHECK (char_length(trim(symptoms)) BETWEEN 1 AND 2000),
  diagnosis TEXT NOT NULL CHECK (char_length(trim(diagnosis)) BETWEEN 1 AND 2000),
  treatment TEXT NOT NULL CHECK (char_length(trim(treatment)) BETWEEN 1 AND 3000),
  doctor_name TEXT NOT NULL CHECK (char_length(trim(doctor_name)) BETWEEN 2 AND 120),
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_by UUID NOT NULL DEFAULT auth.uid(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_staff_profiles_user_id ON public.staff_profiles(user_id);
CREATE INDEX idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX idx_patients_patient_id ON public.patients(patient_id);
CREATE INDEX idx_patients_name ON public.patients USING gin (to_tsvector('simple', name));
CREATE INDEX idx_lab_results_patient_date ON public.lab_results(patient_id, date DESC);
CREATE INDEX idx_visit_notes_patient_date ON public.visit_notes(patient_id, date DESC);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER update_staff_profiles_updated_at
BEFORE UPDATE ON public.staff_profiles
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_patients_updated_at
BEFORE UPDATE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_lab_results_updated_at
BEFORE UPDATE ON public.lab_results
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_visit_notes_updated_at
BEFORE UPDATE ON public.visit_notes
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_clinical_staff(_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role IN ('admin', 'doctor', 'nurse')
  )
$$;

ALTER TABLE public.staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visit_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Staff can view their own profile or admins can view all"
ON public.staff_profiles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can create their own profile"
ON public.staff_profiles
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Staff can update their own profile or admins can update all"
ON public.staff_profiles
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'))
WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Staff can view their own role or admins can view all"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "New staff can assign nurse role to themselves"
ON public.user_roles
FOR INSERT
TO authenticated
WITH CHECK ((auth.uid() = user_id AND role = 'nurse') OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can update roles"
ON public.user_roles
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can remove roles"
ON public.user_roles
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clinical staff can view patients"
ON public.patients
FOR SELECT
TO authenticated
USING (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff can create patients"
ON public.patients
FOR INSERT
TO authenticated
WITH CHECK (public.is_clinical_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Clinical staff can update patients"
ON public.patients
FOR UPDATE
TO authenticated
USING (public.is_clinical_staff(auth.uid()))
WITH CHECK (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Only admins can remove patients"
ON public.patients
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clinical staff can view lab results"
ON public.lab_results
FOR SELECT
TO authenticated
USING (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff can create lab results"
ON public.lab_results
FOR INSERT
TO authenticated
WITH CHECK (public.is_clinical_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Clinical staff can update lab results"
ON public.lab_results
FOR UPDATE
TO authenticated
USING (public.is_clinical_staff(auth.uid()))
WITH CHECK (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Only admins can remove lab results"
ON public.lab_results
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Clinical staff can view visit notes"
ON public.visit_notes
FOR SELECT
TO authenticated
USING (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff can create visit notes"
ON public.visit_notes
FOR INSERT
TO authenticated
WITH CHECK (public.is_clinical_staff(auth.uid()) AND created_by = auth.uid());

CREATE POLICY "Clinical staff can update visit notes"
ON public.visit_notes
FOR UPDATE
TO authenticated
USING (public.is_clinical_staff(auth.uid()))
WITH CHECK (public.is_clinical_staff(auth.uid()));

CREATE POLICY "Only admins can remove visit notes"
ON public.visit_notes
FOR DELETE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lab-results',
  'lab-results',
  false,
  10485760,
  ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Clinical staff can view lab result files"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'lab-results' AND public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff can upload lab result files"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'lab-results' AND public.is_clinical_staff(auth.uid()));

CREATE POLICY "Clinical staff can update lab result files"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'lab-results' AND public.is_clinical_staff(auth.uid()))
WITH CHECK (bucket_id = 'lab-results' AND public.is_clinical_staff(auth.uid()));

CREATE POLICY "Only admins can remove lab result files"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'lab-results' AND public.has_role(auth.uid(), 'admin'));
