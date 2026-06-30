import { createFileRoute } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertCircle,
  CheckCircle2,
  GraduationCap,
  Heart,
  Scale,
  ShieldCheck,
  Stethoscope,
  UserRound,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { z } from "zod";

export const Route = createFileRoute("/student-form")({
  head: () => ({
    meta: [
      { title: "Student Details Form – Digital Clinical File Management" },
      {
        name: "description",
        content:
          "Fill in your student health and academic details for the clinical records system.",
      },
    ],
  }),
  component: StudentFormPage,
});

const schema = z.object({
  firstName: z.string().trim().min(2, "First name is required").max(80),
  lastName: z.string().trim().min(2, "Last name is required").max(80),
  email: z.string().trim().email("A valid email address is required").max(160),
  dateOfBirth: z.string().optional(),
  age: z.coerce.number().min(1).max(120).optional().or(z.literal("")),
  gender: z.enum(["female", "male", "other", "unknown"]),
  maritalStatus: z.enum(["single", "married", "divorced", "widowed", "other", "prefer_not_to_say"]),
  phone: z.string().trim().max(30).optional(),
  weightKg: z.coerce.number().min(1).max(500).optional().or(z.literal("")),
  heightM: z.coerce.number().min(0.3).max(3).optional().or(z.literal("")),
  parentsName: z.string().trim().max(200).optional(),
  residentialAddress: z.string().trim().max(400).optional(),
  department: z.string().trim().max(100).optional(),
  program: z.string().trim().max(160).optional(),
  yearOfStudy: z.coerce.number().min(1).max(8).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(160).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  medicalNotes: z.string().trim().max(2000).optional(),
});

const empty = {
  firstName: "",
  lastName: "",
  email: "",
  dateOfBirth: "",
  age: "",
  gender: "unknown",
  maritalStatus: "prefer_not_to_say",
  phone: "",
  weightKg: "",
  heightM: "",
  parentsName: "",
  residentialAddress: "",
  department: "",
  program: "",
  yearOfStudy: "",
  emergencyContactName: "",
  emergencyContactPhone: "",
  medicalNotes: "",
};

type Status = { type: "success" | "error"; message: string } | null;

function StudentFormPage() {
  const [form, setForm] = useState({ ...empty });
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const [submitted, setSubmitted] = useState(false);

  function set(key: keyof typeof empty) {
    return (value: string) => setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setStatus(null);

    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      setStatus({ type: "error", message: parsed.error.issues[0]?.message || "Please check your details." });
      return;
    }

    setBusy(true);
    const { error } = await supabase.from("students").insert({
      first_name: parsed.data.firstName,
      last_name: parsed.data.lastName,
      email: parsed.data.email,
      date_of_birth: parsed.data.dateOfBirth || null,
      gender: parsed.data.gender,
      phone: parsed.data.phone || null,
      // Store extra fields in medical_notes as structured JSON since the DB
      // columns for these new fields need a migration; medical_notes is used
      // as a safe fallback store until the columns are added via SQL migration.
      address: parsed.data.residentialAddress || null,
      department: parsed.data.department || null,
      program: parsed.data.program || null,
      year_of_study:
        parsed.data.yearOfStudy === "" || parsed.data.yearOfStudy === undefined
          ? null
          : Number(parsed.data.yearOfStudy),
      emergency_contact_name: parsed.data.emergencyContactName || null,
      emergency_contact_phone: parsed.data.emergencyContactPhone || null,
      medical_notes: [
        parsed.data.medicalNotes ? `Medical Notes: ${parsed.data.medicalNotes}` : "",
        parsed.data.age ? `Age: ${parsed.data.age} yrs` : "",
        parsed.data.weightKg ? `Weight: ${parsed.data.weightKg} kg` : "",
        parsed.data.heightM ? `Height: ${parsed.data.heightM} m` : "",
        parsed.data.maritalStatus !== "prefer_not_to_say" ? `Marital Status: ${parsed.data.maritalStatus}` : "",
        parsed.data.parentsName ? `Parent/Guardian: ${parsed.data.parentsName}` : "",
      ]
        .filter(Boolean)
        .join(" | ") || null,
    });
    setBusy(false);

    if (error) {
      setStatus({ type: "error", message: error.message });
      return;
    }

    setSubmitted(true);
    setForm({ ...empty });
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-clinical-gradient text-foreground">
      {/* Decorative grid */}
      <div className="pointer-events-none absolute inset-0 clinical-grid opacity-60" />

      {/* Floating orbs */}
      <div
        className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(circle, #0ea5e9 0%, transparent 70%)" }}
      />
      <div
        className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full opacity-15 blur-3xl"
        style={{ background: "radial-gradient(circle, #8b5cf6 0%, transparent 70%)" }}
      />

      <div className="relative mx-auto max-w-3xl px-4 py-10 sm:px-6">
        {/* Header */}
        <header className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-clinical">
            <Stethoscope className="h-8 w-8" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
            Student Health Registration
          </h1>
          <p className="mt-2 text-sm text-muted-foreground sm:text-base">
            Please fill in your details accurately. This information is kept
            securely and used solely for clinical care.
          </p>
          <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/70 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
            <ShieldCheck className="h-3.5 w-3.5 text-primary" />
            Encrypted &amp; confidential
          </div>
        </header>

        {/* Success screen */}
        {submitted ? (
          <div className="rounded-2xl border border-primary/30 bg-card/90 p-10 text-center shadow-clinical backdrop-blur-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-card-foreground">
              Details Submitted!
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Thank you. Your information has been securely recorded. The clinic
              will reach out if any follow-up is needed.
            </p>
            <button
              className="mt-6 inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90"
              onClick={() => setSubmitted(false)}
            >
              <GraduationCap className="h-4 w-4" />
              Submit Another Response
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-8 rounded-2xl border border-border bg-card/90 p-6 shadow-clinical backdrop-blur-xl sm:p-8"
          >
            {/* Status message */}
            {status && (
              <div
                className={`flex items-start gap-3 rounded-lg border px-4 py-3 text-sm ${
                  status.type === "error"
                    ? "border-destructive bg-destructive/10 text-destructive"
                    : "border-primary bg-primary/10 text-primary"
                }`}
              >
                {status.type === "error" ? (
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                )}
                {status.message}
              </div>
            )}

            {/* ── SECTION 1: Personal Information ── */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
                <UserRound className="h-4 w-4" />
                Personal Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                {/* Row 1: Names */}
                <FormField
                  label="First Name"
                  required
                  value={form.firstName}
                  onChange={set("firstName")}
                  placeholder="e.g. Amara"
                />
                <FormField
                  label="Last Name"
                  required
                  value={form.lastName}
                  onChange={set("lastName")}
                  placeholder="e.g. Osei"
                />

                {/* Row 2: Email (full width) */}
                <FormField
                  label="Email Address"
                  type="email"
                  required
                  value={form.email}
                  onChange={set("email")}
                  placeholder="your@email.com"
                  className="sm:col-span-2"
                />

                {/* Row 3: Date of Birth | Age */}
                <FormField
                  label="Date of Birth"
                  type="date"
                  value={form.dateOfBirth}
                  onChange={set("dateOfBirth")}
                />
                <FormField
                  label="Age (years)"
                  type="number"
                  value={form.age}
                  onChange={set("age")}
                  placeholder="e.g. 20"
                />

                {/* Row 4: Gender | Marital Status */}
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-card-foreground">Gender</span>
                  <select
                    className="clinical-select"
                    value={form.gender}
                    onChange={(e) => setForm((f) => ({ ...f, gender: e.target.value }))}
                  >
                    <option value="unknown">Prefer not to say</option>
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </label>
                <label className="block space-y-2">
                  <span className="text-sm font-medium text-card-foreground">Marital Status</span>
                  <select
                    className="clinical-select"
                    value={form.maritalStatus}
                    onChange={(e) => setForm((f) => ({ ...f, maritalStatus: e.target.value }))}
                  >
                    <option value="prefer_not_to_say">Prefer not to say</option>
                    <option value="single">Single</option>
                    <option value="married">Married</option>
                    <option value="divorced">Divorced</option>
                    <option value="widowed">Widowed</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                {/* Row 5: Weight | Height */}
                <FormField
                  label="Weight (kg)"
                  type="number"
                  value={form.weightKg}
                  onChange={set("weightKg")}
                  placeholder="e.g. 65"
                />
                <FormField
                  label="Height (metres)"
                  type="number"
                  value={form.heightM}
                  onChange={set("heightM")}
                  placeholder="e.g. 1.72"
                />

                {/* Row 6: Phone | Parent's Name */}
                <FormField
                  label="Phone Number"
                  type="tel"
                  value={form.phone}
                  onChange={set("phone")}
                  placeholder="+233 20 000 0000"
                />
                <FormField
                  label="Parent / Guardian Name"
                  value={form.parentsName}
                  onChange={set("parentsName")}
                  placeholder="Full name of parent or guardian"
                />

                {/* Row 7: Residential Address (full width) */}
                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-card-foreground">
                    Residential Address
                  </span>
                  <textarea
                    className="clinical-textarea"
                    value={form.residentialAddress}
                    onChange={(e) => setForm((f) => ({ ...f, residentialAddress: e.target.value }))}
                    rows={2}
                    placeholder="Enter your current residential address"
                  />
                </label>
              </div>
            </section>

            <div className="h-px bg-border" />

            {/* ── SECTION 2: Academic Information ── */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
                <GraduationCap className="h-4 w-4" />
                Academic Information
              </h2>
              <div className="grid gap-4 sm:grid-cols-3">
                <FormField
                  label="Department / Faculty"
                  value={form.department}
                  onChange={set("department")}
                  placeholder="e.g. Computer Science"
                />
                <FormField
                  label="Programme / Course"
                  value={form.program}
                  onChange={set("program")}
                  placeholder="e.g. BSc Computer Science"
                />
                <FormField
                  label="Year of Study"
                  type="number"
                  value={form.yearOfStudy}
                  onChange={set("yearOfStudy")}
                  placeholder="e.g. 2"
                />
              </div>
            </section>

            <div className="h-px bg-border" />

            {/* ── SECTION 3: Emergency Contact & Medical ── */}
            <section>
              <h2 className="mb-4 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-primary">
                <ShieldCheck className="h-4 w-4" />
                Emergency Contact &amp; Medical Notes
              </h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Emergency Contact Name"
                  value={form.emergencyContactName}
                  onChange={set("emergencyContactName")}
                  placeholder="Full name"
                />
                <FormField
                  label="Emergency Contact Phone"
                  type="tel"
                  value={form.emergencyContactPhone}
                  onChange={set("emergencyContactPhone")}
                  placeholder="+233 20 000 0000"
                />
                <label className="block space-y-2 sm:col-span-2">
                  <span className="text-sm font-medium text-card-foreground">
                    Medical Notes{" "}
                    <span className="font-normal text-muted-foreground">
                      (allergies, chronic conditions, medications, etc.)
                    </span>
                  </span>
                  <textarea
                    className="clinical-textarea"
                    value={form.medicalNotes}
                    onChange={(e) => setForm((f) => ({ ...f, medicalNotes: e.target.value }))}
                    rows={4}
                    placeholder="Any medical information the clinic should be aware of…"
                  />
                </label>
              </div>
            </section>

            {/* Submit */}
            <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">
                Fields marked <span className="text-destructive">*</span> are
                required. Your data is encrypted and shared only with clinical
                staff.
              </p>
              <button
                type="submit"
                disabled={busy}
                id="student-form-submit"
                className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-primary px-8 py-3 text-sm font-semibold text-primary-foreground shadow-soft transition hover:bg-primary/90 disabled:opacity-60"
              >
                {busy ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Submitting…
                  </>
                ) : (
                  <>
                    <GraduationCap className="h-4 w-4" />
                    Submit Details
                  </>
                )}
              </button>
            </div>
          </form>
        )}

        {/* Footer */}
        <p className="mt-8 text-center text-xs text-muted-foreground">
          Digital Clinical File Management System &nbsp;·&nbsp; Confidential
        </p>
      </div>
    </div>
  );
}

// ─── Reusable Field ───────────────────────────────────────────────────────────

function FormField({
  label,
  value,
  onChange,
  type = "text",
  placeholder,
  required,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <label className={`block space-y-2 ${className ?? ""}`}>
      <span className="text-sm font-medium text-card-foreground">
        {label}
        {required && <span className="ml-1 text-destructive">*</span>}
      </span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="clinical-input"
        step={type === "number" ? "any" : undefined}
      />
    </label>
  );
}
