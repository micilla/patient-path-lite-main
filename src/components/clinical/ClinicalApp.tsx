import { lovable } from "@/integrations/lovable/index";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Copy,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  FileSpreadsheet,
  FileText,
  FileUp,
  FilePlus2,
  Files,
  GraduationCap,
  Link2,
  LogOut,
  Menu,
  NotebookPen,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Stethoscope,
  Trash2,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { z } from "zod";
import { Bar, BarChart, CartesianGrid, Cell, Legend, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type SessionUser = {
  id: string;
  email?: string;
};

type StaffProfile = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  department: string | null;
};

type StaffRole = "admin" | "doctor" | "nurse";
type Gender = "female" | "male" | "other" | "unknown";

type Patient = {
  id: string;
  patient_id: string;
  name: string;
  dob: string | null;
  age: number | null;
  gender: Gender;
  phone: string | null;
  address: string | null;
  created_at: string;
  updated_at: string;
};

type LabResult = {
  id: string;
  patient_id: string;
  test_name: string;
  result: string;
  file_path: string | null;
  date: string;
  created_at: string;
};

type VisitNote = {
  id: string;
  patient_id: string;
  symptoms: string;
  diagnosis: string;
  treatment: string;
  doctor_name: string;
  date: string;
  created_at: string;
};

type Student = {
  id: string;
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  date_of_birth: string | null;
  gender: Gender;
  phone: string | null;
  address: string | null;
  department: string | null;
  program: string | null;
  year_of_study: number | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  medical_notes: string | null;
  created_at: string;
  updated_at: string;
};

type ToastState = { type: "success" | "error" | "info"; message: string } | null;

type AuthMode = "login" | "signup";
type MainView = "dashboard" | "create" | "search" | "upload" | "note" | "record" | "student" | "reports" | "import";

const patientSchema = z.object({
  name: z.string().trim().min(2, "Full name is required").max(160),
  dob: z.string().optional(),
  age: z.coerce.number().min(0).max(130).optional().or(z.literal("")),
  gender: z.enum(["female", "male", "other", "unknown"]),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
});

const labSchema = z.object({
  patientId: z.string().uuid("Select a patient"),
  testName: z.string().trim().min(2, "Test name is required").max(140),
  result: z.string().trim().min(1, "Result description is required").max(2000),
  date: z.string().min(1, "Date is required"),
});

const noteSchema = z.object({
  patientId: z.string().uuid("Select a patient"),
  visitDate: z.string().min(1, "Visit date is required"),
  symptoms: z.string().trim().min(1, "Symptoms are required").max(2000),
  diagnosis: z.string().trim().min(1, "Diagnosis is required").max(2000),
  treatment: z.string().trim().min(1, "Treatment is required").max(3000),
  doctorName: z.string().trim().min(2, "Doctor name is required").max(120),
});

const studentSchema = z.object({
  firstName: z.string().trim().min(2, "First name is required").max(80),
  lastName: z.string().trim().min(2, "Last name is required").max(80),
  email: z.string().trim().email("Valid email is required").max(160),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["female", "male", "other", "unknown"]),
  phone: z.string().trim().max(30).optional(),
  address: z.string().trim().max(300).optional(),
  department: z.string().trim().max(100).optional(),
  program: z.string().trim().max(160).optional(),
  yearOfStudy: z.coerce.number().min(1).max(8).optional().or(z.literal("")),
  emergencyContactName: z.string().trim().max(160).optional(),
  emergencyContactPhone: z.string().trim().max(30).optional(),
  medicalNotes: z.string().trim().max(2000).optional(),
});

const CHART_COLORS = ["#0ea5e9", "#10b981", "#f59e0b", "#8b5cf6", "#ef4444", "#06b6d4", "#ec4899", "#14b8a6"];

const navItems: Array<{ view: MainView; label: string; icon: typeof Activity }> = [
  { view: "dashboard", label: "Dashboard", icon: Activity },
  { view: "student", label: "Student Details", icon: GraduationCap },
  { view: "create", label: "Create Patient", icon: Plus },
  { view: "import", label: "Import Patients (CSV)", icon: FileUp },
  { view: "search", label: "Search Patient", icon: Search },
  { view: "upload", label: "Upload Lab Result", icon: Upload },
  { view: "note", label: "Add Visit Note", icon: NotebookPen },
  { view: "reports", label: "Reports", icon: FileText },
];

function getToday() {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(date?: string | null) {
  if (!date) return "Not recorded";
  return new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" }).format(
    new Date(`${date}T00:00:00`),
  );
}

function getDisplayName(email?: string) {
  return email?.split("@")[0]?.replace(/[._-]+/g, " ").slice(0, 80) || "Clinical Staff";
}

export function ClinicalApp() {
  const [loading, setLoading] = useState(true);
  const [appLoading, setAppLoading] = useState(false);
  const [user, setUser] = useState<SessionUser | null>(null);
  const [profile, setProfile] = useState<StaffProfile | null>(null);
  const [roles, setRoles] = useState<StaffRole[]>([]);
  const [toast, setToast] = useState<ToastState>(null);
  const [view, setView] = useState<MainView>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [recentPatients, setRecentPatients] = useState<Patient[]>([]);
  const [labResults, setLabResults] = useState<LabResult[]>([]);
  const [visitNotes, setVisitNotes] = useState<VisitNote[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [searchTerm, setSearchTerm] = useState("");

  const showToast = (message: string, type: "success" | "error" | "info" = "info") => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3600);
  };

  const roleLabel = roles[0] ? roles[0][0].toUpperCase() + roles[0].slice(1) : "Nurse";
  const isAdmin = roles.includes("admin");

  const filteredPatients = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (patient) =>
        patient.name.toLowerCase().includes(q) || patient.patient_id.toLowerCase().includes(q),
    );
  }, [patients, searchTerm]);

  const selectedLabs = useMemo(
    () => labResults.filter((result) => result.patient_id === selectedPatient?.id),
    [labResults, selectedPatient],
  );

  const selectedNotes = useMemo(
    () => visitNotes.filter((note) => note.patient_id === selectedPatient?.id),
    [visitNotes, selectedPatient],
  );

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      const sessionUser = data.session?.user
        ? { id: data.session.user.id, email: data.session.user.email ?? undefined }
        : null;
      setUser(sessionUser);
      if (sessionUser) {
        await ensureStaffSetup(sessionUser);
        await loadClinicalData();
      }
      setLoading(false);
    };

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      const sessionUser = session?.user
        ? { id: session.user.id, email: session.user.email ?? undefined }
        : null;
      setUser(sessionUser);
      if (sessionUser) {
        ensureStaffSetup(sessionUser);
        loadClinicalData();
      } else {
        setProfile(null);
        setRoles([]);
        setPatients([]);
        setLabResults([]);
        setVisitNotes([]);
        setSelectedPatient(null);
        setView("dashboard");
      }
    });

    bootstrap();

    return () => {
      active = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function ensureStaffSetup(sessionUser: SessionUser) {
    const emailPrefix = (sessionUser.email?.split("@")[0] || "staff")
      .toLowerCase()
      .replace(/[^a-z0-9._-]/g, "-")
      .slice(0, 40);
    const baseUsername = `${emailPrefix}-${sessionUser.id.slice(0, 6)}`;
    const displayName = getDisplayName(sessionUser.email);

    const { error: profileError } = await supabase.from("staff_profiles").upsert(
      {
        user_id: sessionUser.id,
        username: baseUsername,
        display_name: displayName,
        department: "Clinical Operations",
      },
      { onConflict: "user_id" },
    );

    const { error: roleError } = await supabase
      .from("user_roles")
      .upsert({ user_id: sessionUser.id, role: "nurse" }, { onConflict: "user_id,role", ignoreDuplicates: true });

    if (profileError || roleError) {
      showToast(profileError?.message || roleError?.message || "Unable to initialize staff account", "error");
    }

    await loadStaff(sessionUser.id);
  }

  async function loadStaff(userId: string) {
    const [{ data: profileData }, { data: roleData }] = await Promise.all([
      supabase.from("staff_profiles").select("id,user_id,username,display_name,department").eq("user_id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile((profileData as StaffProfile | null) ?? null);
    setRoles(((roleData ?? []) as Array<{ role: StaffRole }>).map((item) => item.role));
  }

  async function loadClinicalData() {
    setAppLoading(true);
    const [patientsResponse, labsResponse, notesResponse, studentsResponse] = await Promise.all([
      supabase.from("patients").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("lab_results").select("*").order("date", { ascending: false }).limit(300),
      supabase.from("visit_notes").select("*").order("date", { ascending: false }).limit(300),
      supabase.from("students").select("*").order("created_at", { ascending: false }).limit(200),
    ]);

    if (patientsResponse.error || labsResponse.error || notesResponse.error) {
      showToast(
        patientsResponse.error?.message || labsResponse.error?.message || notesResponse.error?.message || "Unable to load records",
        "error",
      );
    }

    setPatients((patientsResponse.data ?? []) as Patient[]);
    setRecentPatients(((patientsResponse.data ?? []) as Patient[]).slice(0, 5));
    setLabResults((labsResponse.data ?? []) as LabResult[]);
    setVisitNotes((notesResponse.data ?? []) as VisitNote[]);
    setStudents((studentsResponse.data ?? []) as Student[]);
    setAppLoading(false);
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    showToast("Logged out securely", "success");
  }

  function openRecord(patient: Patient) {
    setSelectedPatient(patient);
    setView("record");
    setSidebarOpen(false);
  }

  async function handleDeletePatient(patient: Patient) {
    if (!isAdmin) return;
    if (!window.confirm(`Permanently delete patient "${patient.name}" and all related lab results and visit notes? This cannot be undone.`)) return;
    const { error } = await supabase.from("patients").delete().eq("id", patient.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Patient record deleted", "success");
    if (selectedPatient?.id === patient.id) setSelectedPatient(null);
    await loadClinicalData();
    setView("search");
  }

  if (loading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen showToast={showToast} />;
  }

  return (
    <div className="min-h-screen bg-clinical-gradient text-foreground">
      <div className="pointer-events-none fixed inset-0 clinical-grid opacity-70" />
      <div className="relative flex min-h-screen">
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-sidebar/95 px-4 py-5 shadow-clinical backdrop-blur-xl transition-transform duration-300 lg:static lg:translate-x-0",
            sidebarOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
                <Stethoscope className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-sidebar-foreground">Digital Clinical File</p>
                <p className="text-xs text-muted-foreground">Management System</p>
              </div>
            </div>
            <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-8 rounded-lg border border-sidebar-border bg-card/80 p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
                <UserRound className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-card-foreground">
                  {profile?.display_name || getDisplayName(user.email)}
                </p>
                <p className="truncate text-xs text-muted-foreground">{user.email}</p>
              </div>
            </div>
            <div className="mt-3 inline-flex items-center gap-2 rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">
              <ShieldCheck className="h-3.5 w-3.5" />
              {roleLabel}
            </div>
          </div>

          <nav className="mt-6 space-y-1">
            {navItems.map((item) => (
              <button
                key={item.view}
                onClick={() => {
                  setView(item.view);
                  setSidebarOpen(false);
                }}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-all hover:bg-sidebar-accent hover:text-sidebar-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  view === item.view
                    ? "bg-sidebar-accent text-sidebar-accent-foreground shadow-soft"
                    : "text-muted-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </button>
            ))}
          </nav>

          <Button className="mt-8 w-full" variant="outline" onClick={handleLogout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </aside>

        {sidebarOpen && <button className="fixed inset-0 z-30 bg-background/50 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <main className="relative flex-1 px-4 py-4 sm:px-6 lg:px-8">
          <header className="mb-6 flex items-center justify-between rounded-lg border border-border bg-card/80 px-4 py-3 shadow-soft backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setSidebarOpen(true)}>
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">Clinical Records</h1>
                <p className="text-xs text-muted-foreground sm:text-sm">Secure patient file management for hospital staff</p>
              </div>
            </div>
            <Button variant="clinical" onClick={loadClinicalData} disabled={appLoading}>
              <Activity className="h-4 w-4" />
              Refresh
            </Button>
          </header>

          {toast && (
            <div
              className={cn(
                "fixed right-4 top-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-clinical",
                toast.type === "error" && "border-destructive bg-card text-destructive",
                toast.type === "success" && "border-primary bg-card text-primary",
                toast.type === "info" && "border-border bg-card text-card-foreground",
              )}
            >
              {toast.message}
            </div>
          )}

          {view === "dashboard" && (
            <DashboardView
              totalPatients={patients.length}
              totalStudents={students.length}
              recentPatients={recentPatients}
              recentNotes={visitNotes.slice(0, 4)}
              onView={setView}
              onOpenPatient={openRecord}
            />
          )}
          {view === "student" && <StudentDetailsView reload={loadClinicalData} showToast={showToast} />}
          {view === "reports" && (
            <ReportsView patients={patients} students={students} labResults={labResults} visitNotes={visitNotes} />
          )}
          {view === "create" && <CreatePatientView onCreated={openRecord} reload={loadClinicalData} showToast={showToast} />}
          {view === "import" && <CsvImportView reload={loadClinicalData} showToast={showToast} onView={setView} />}
          {view === "search" && (
            <SearchPatientView
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              patients={filteredPatients}
              onOpenPatient={openRecord}
            />
          )}
          {view === "upload" && (
            <LabUploadView patients={patients} reload={loadClinicalData} showToast={showToast} preselected={selectedPatient} />
          )}
          {view === "note" && (
            <VisitNoteView patients={patients} reload={loadClinicalData} showToast={showToast} preselected={selectedPatient} />
          )}
          {view === "record" && selectedPatient && (
            <PatientRecordView
              patient={selectedPatient}
              labs={selectedLabs}
              notes={selectedNotes}
              isAdmin={isAdmin}
              onDelete={handleDeletePatient}
              onAddLab={() => setView("upload")}
              onAddNote={() => setView("note")}
              showToast={showToast}
              reload={loadClinicalData}
            />
          )}
        </main>
      </div>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-clinical-gradient px-4">
      <div className="rounded-lg border border-border bg-card p-8 text-center shadow-clinical">
        <div className="mx-auto mb-4 h-12 w-12 animate-pulse rounded-lg bg-primary" />
        <p className="font-semibold text-card-foreground">Opening secure clinical workspace…</p>
      </div>
    </div>
  );
}

function AuthScreen({ showToast }: { showToast: (message: string, type?: "success" | "error" | "info") => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();

    // Validate before normalizing email
    if (!email.trim()) {
      showToast("Username is required", "error");
      return;
    }
    if (!password.trim()) {
      showToast("Password is required", "error");
      return;
    }
    if (password.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }
    if (mode === "signup" && password !== confirmPassword) {
      showToast("Passwords do not match", "error");
      return;
    }

    const normalizedEmail = email.trim().includes("@") ? email.trim() : `${email.trim()}@clinic.local`;
    setBusy(true);

    if (mode === "login") {
      // Strict login — do NOT auto-create accounts
      const loginRes = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
      setBusy(false);
      if (loginRes.error) {
        showToast("Invalid username or password. Please check your credentials.", "error");
        return;
      }
      showToast("Login successful", "success");
    } else {
      // Signup flow
      const signupRes = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: { emailRedirectTo: window.location.origin },
      });
      if (signupRes.error) {
        setBusy(false);
        showToast(signupRes.error.message, "error");
        return;
      }
      // For @clinic.local emails Supabase auto-confirms — sign in immediately
      if (normalizedEmail.endsWith("@clinic.local")) {
        const loginRes = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
        setBusy(false);
        if (loginRes.error) {
          showToast("Account created! Please log in with your credentials.", "success");
          setMode("login");
          return;
        }
        showToast("Staff account created and logged in!", "success");
      } else {
        setBusy(false);
        showToast("Check your email to verify your staff account.", "success");
      }
    }
  }

  async function handleGoogle() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
    setBusy(false);
    if (result.error) showToast(result.error.message, "error");
  }

  async function handleDemoLogin() {
    setBusy(true);
    const loginRes = await supabase.auth.signInWithPassword({ email: "admin@clinic.local", password: "admin123" });
    setBusy(false);
    if (loginRes.error) {
      showToast("Demo login unavailable. Please contact your administrator.", "error");
      return;
    }
    showToast("Demo admin login successful", "success");
  }

  function switchMode(next: AuthMode) {
    setMode(next);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirmPassword(false);
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-clinical-gradient px-4 py-8 text-foreground">
      <div className="pointer-events-none absolute inset-0 clinical-grid" />
      <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.08fr_0.92fr]">
        <section className="space-y-8">
          <div className="inline-flex items-center gap-2 rounded-md border border-border bg-card/75 px-3 py-2 text-sm font-medium text-muted-foreground shadow-soft backdrop-blur">
            <ShieldCheck className="h-4 w-4 text-primary" />
            Protected hospital records workspace
          </div>
          <div className="max-w-3xl">
            <h1 className="text-4xl font-black tracking-tight text-foreground sm:text-6xl">
              Crawford Clinicals
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground sm:text-lg">
              Manage patient records, lab documents, and visit notes in a clean clinical dashboard built for daily hospital operations.
            </p>
          </div>
          <div className="grid max-w-2xl gap-3 sm:grid-cols-3">
            {[
              ["Patients", "Create and search records"],
              ["Lab Results", "Upload PDF or image files"],
              ["Visit Notes", "Chronological clinical notes"],
            ].map(([title, copy]) => (
              <div key={title} className="rounded-lg border border-border bg-card/75 p-4 shadow-soft backdrop-blur">
                <p className="font-semibold text-card-foreground">{title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-card/90 p-6 shadow-clinical backdrop-blur-xl sm:p-8">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-card-foreground">{mode === "login" ? "Staff login" : "Create staff account"}</h2>
              <p className="mt-1 text-sm text-muted-foreground">Enter your staff credentials to continue.</p>
            </div>
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-soft">
              <Stethoscope className="h-6 w-6" />
            </div>
          </div>

          <form className="space-y-4" onSubmit={handleSubmit}>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-card-foreground">Username</span>
              <Input
                type="text"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="admin or staff@clinic.org"
                autoComplete="username"
                disabled={busy}
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-card-foreground">Password</span>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  disabled={busy}
                  className="pr-10"
                />
                <button
                  type="button"
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </label>

            {mode === "signup" && (
              <label className="block space-y-2">
                <span className="text-sm font-medium text-card-foreground">Confirm Password</span>
                <div className="relative">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="••••••••"
                    autoComplete="new-password"
                    disabled={busy}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground focus-visible:outline-none"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                    aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </label>
            )}

            <Button className="w-full" variant="clinical" size="lg" disabled={busy}>
              {busy ? "Please wait…" : mode === "login" ? "Login" : "Create account"}
            </Button>
          </form>

          {mode === "login" && (
            <Button className="mt-3 w-full" variant="secondary" size="lg" onClick={handleDemoLogin} disabled={busy}>
              {busy ? "Please wait…" : "Demo Login"}
            </Button>
          )}

          <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
            <div className="h-px flex-1 bg-border" />
            or
            <div className="h-px flex-1 bg-border" />
          </div>

          <Button className="w-full" variant="outline" size="lg" onClick={handleGoogle} disabled={busy}>
            Continue with Google
          </Button>

          <button
            className="mt-5 w-full text-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => switchMode(mode === "login" ? "signup" : "login")}
            type="button"
          >
            {mode === "login" ? "Need a staff account? Sign up" : "Already have credentials? Login"}
          </button>
        </section>
      </div>
    </div>
  );
}

function DashboardView({
  totalPatients,
  totalStudents,
  recentPatients,
  recentNotes,
  onView,
  onOpenPatient,
}: {
  totalPatients: number;
  totalStudents: number;
  recentPatients: Patient[];
  recentNotes: VisitNote[];
  onView: (view: MainView) => void;
  onOpenPatient: (patient: Patient) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard icon={Files} label="Total patients" value={String(totalPatients)} />
        <MetricCard icon={GraduationCap} label="Total students" value={String(totalStudents)} />
        <MetricCard icon={NotebookPen} label="Recent notes" value={String(recentNotes.length)} />
        <MetricCard icon={ShieldCheck} label="Protected modules" value="5" />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <ActionCard icon={GraduationCap} title="Student Details" onClick={() => onView("student")} />
        <ActionCard icon={Plus} title="Create Patient" onClick={() => onView("create")} />
        <ActionCard icon={FileUp} title="Import CSV" onClick={() => onView("import")} />
        <ActionCard icon={Search} title="Search Patient" onClick={() => onView("search")} />
        <ActionCard icon={Upload} title="Upload Lab Result" onClick={() => onView("upload")} />
        <ActionCard icon={NotebookPen} title="Add Visit Note" onClick={() => onView("note")} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Recent patients">
          {recentPatients.length === 0 ? (
            <EmptyState icon={Files} text="No patients have been created yet." />
          ) : (
            <div className="space-y-2">
              {recentPatients.map((patient) => (
                <button key={patient.id} className="record-row" onClick={() => onOpenPatient(patient)}>
                  <span>
                    <strong>{patient.name}</strong>
                    <small>{patient.patient_id}</small>
                  </span>
                  <span>{formatDate(patient.created_at.slice(0, 10))}</span>
                </button>
              ))}
            </div>
          )}
        </Panel>
        <Panel title="Recent activity">
          {recentNotes.length === 0 ? (
            <EmptyState icon={Activity} text="Visit notes will appear here." />
          ) : (
            <div className="space-y-3">
              {recentNotes.map((note) => (
                <div key={note.id} className="rounded-lg border border-border bg-muted/40 p-3">
                  <p className="text-sm font-semibold text-card-foreground">{note.diagnosis}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{formatDate(note.date)} · {note.doctor_name}</p>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

function StudentDetailsView({
  reload,
  showToast,
}: {
  reload: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    dateOfBirth: "",
    gender: "unknown",
    phone: "",
    address: "",
    department: "",
    program: "",
    yearOfStudy: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    medicalNotes: "",
  });

  const publicFormUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/student-form`;

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(publicFormUrl);
      setLinkCopied(true);
      showToast("Student form link copied to clipboard!", "success");
      window.setTimeout(() => setLinkCopied(false), 2500);
    } catch {
      showToast("Could not copy link – please copy it manually.", "error");
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = studentSchema.safeParse(form);
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || "Check student details", "error");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("students")
      .insert({
        first_name: parsed.data.firstName,
        last_name: parsed.data.lastName,
        email: parsed.data.email,
        date_of_birth: parsed.data.dateOfBirth || null,
        gender: parsed.data.gender,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
        department: parsed.data.department || null,
        program: parsed.data.program || null,
        year_of_study: parsed.data.yearOfStudy === "" || parsed.data.yearOfStudy === undefined ? null : Number(parsed.data.yearOfStudy),
        emergency_contact_name: parsed.data.emergencyContactName || null,
        emergency_contact_phone: parsed.data.emergencyContactPhone || null,
        medical_notes: parsed.data.medicalNotes || null,
      });
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Student details submitted successfully!", "success");
    setForm({
      firstName: "", lastName: "", email: "", dateOfBirth: "", gender: "unknown",
      phone: "", address: "", department: "", program: "", yearOfStudy: "",
      emergencyContactName: "", emergencyContactPhone: "", medicalNotes: "",
    });
    await reload();
  }

  return (
    <div className="space-y-5">
      {/* ── Public link banner ── */}
      <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-card/80 px-5 py-4 shadow-soft sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
            <Link2 className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-card-foreground">Share this form with students</p>
            <p className="mt-0.5 text-xs text-muted-foreground">Students can open the link below to fill in their details without logging in.</p>
            <a
              href={publicFormUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              {publicFormUrl}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={copyLink} className="gap-2">
            {linkCopied ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
            {linkCopied ? "Copied!" : "Copy Link"}
          </Button>
          <Button variant="clinical" size="sm" asChild>
            <a href={publicFormUrl} target="_blank" rel="noopener noreferrer" className="gap-2 flex items-center">
              <ExternalLink className="h-4 w-4" />
              Open Form
            </a>
          </Button>
        </div>
      </div>

      <Panel title="Student Details Form" eyebrow="Fill in your information">
        <form className="space-y-6" onSubmit={submit}>
          {/* Personal Information */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
              <UserRound className="h-4 w-4" />
              Personal Information
            </h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="First Name" value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} required />
              <Field label="Last Name" value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} required />
              <Field label="Email Address" type="email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} required />
              <Field label="Date of Birth" type="date" value={form.dateOfBirth} onChange={(v) => setForm({ ...form, dateOfBirth: v })} />
              <label className="block space-y-2">
                <span className="text-sm font-medium text-card-foreground">Gender</span>
                <select className="clinical-select" value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })}>
                  <option value="unknown">Select gender</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <Field label="Phone Number" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
              <label className="block space-y-2 lg:col-span-2">
                <span className="text-sm font-medium text-card-foreground">Address</span>
                <textarea className="clinical-textarea" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} rows={3} placeholder="Enter your full address" />
              </label>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Academic Information */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
              <GraduationCap className="h-4 w-4" />
              Academic Information
            </h3>
            <div className="grid gap-4 lg:grid-cols-3">
              <Field label="Department" value={form.department} onChange={(v) => setForm({ ...form, department: v })} />
              <Field label="Program / Course" value={form.program} onChange={(v) => setForm({ ...form, program: v })} />
              <Field label="Year of Study" type="number" value={form.yearOfStudy} onChange={(v) => setForm({ ...form, yearOfStudy: v })} />
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-border" />

          {/* Emergency & Medical */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-primary">
              <ShieldCheck className="h-4 w-4" />
              Emergency Contact & Medical Notes
            </h3>
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Emergency Contact Name" value={form.emergencyContactName} onChange={(v) => setForm({ ...form, emergencyContactName: v })} />
              <Field label="Emergency Contact Phone" value={form.emergencyContactPhone} onChange={(v) => setForm({ ...form, emergencyContactPhone: v })} />
              <label className="block space-y-2 lg:col-span-2">
                <span className="text-sm font-medium text-card-foreground">Medical Notes (allergies, conditions, etc.)</span>
                <textarea className="clinical-textarea" value={form.medicalNotes} onChange={(e) => setForm({ ...form, medicalNotes: e.target.value })} rows={4} placeholder="Any medical information the clinic should know about" />
              </label>
            </div>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <Button variant="clinical" size="lg" disabled={busy}>
              <GraduationCap className="h-4 w-4" />
              Submit Student Details
            </Button>
            {busy && <span className="text-sm text-muted-foreground animate-pulse">Saving…</span>}
          </div>
        </form>
      </Panel>
    </div>
  );
}

function ReportsView({
  patients,
  students,
  labResults,
  visitNotes,
}: {
  patients: Patient[];
  students: Student[];
  labResults: LabResult[];
  visitNotes: VisitNote[];
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const fp = useMemo(() => {
    if (!dateFrom && !dateTo) return patients;
    return patients.filter((p) => {
      const d = p.created_at.slice(0, 10);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
  }, [patients, dateFrom, dateTo]);

  const fs = useMemo(() => {
    if (!dateFrom && !dateTo) return students;
    return students.filter((s) => {
      const d = s.created_at.slice(0, 10);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
  }, [students, dateFrom, dateTo]);

  const fl = useMemo(() => {
    if (!dateFrom && !dateTo) return labResults;
    return labResults.filter((l) => {
      const d = l.created_at.slice(0, 10);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
  }, [labResults, dateFrom, dateTo]);

  const fv = useMemo(() => {
    if (!dateFrom && !dateTo) return visitNotes;
    return visitNotes.filter((v) => {
      const d = v.created_at.slice(0, 10);
      return (!dateFrom || d >= dateFrom) && (!dateTo || d <= dateTo);
    });
  }, [visitNotes, dateFrom, dateTo]);

  const genderData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of [...fp, ...fs]) {
      const g = item.gender || "unknown";
      counts[g] = (counts[g] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({
      name: name.charAt(0).toUpperCase() + name.slice(1),
      value,
    }));
  }, [fp, fs]);

  const monthlyData = useMemo(() => {
    const months: Record<string, { patients: number; students: number }> = {};
    for (const p of fp) {
      const m = p.created_at.slice(0, 7);
      if (!months[m]) months[m] = { patients: 0, students: 0 };
      months[m].patients++;
    }
    for (const s of fs) {
      const m = s.created_at.slice(0, 7);
      if (!months[m]) months[m] = { patients: 0, students: 0 };
      months[m].students++;
    }
    return Object.entries(months)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([month, data]) => ({ month, ...data }));
  }, [fp, fs]);

  const deptData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of fs) {
      const dept = s.department || "Unspecified";
      counts[dept] = (counts[dept] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
  }, [fs]);

  const diagnosisData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const v of fv) {
      const d = v.diagnosis.trim().slice(0, 40);
      if (d) counts[d] = (counts[d] || 0) + 1;
    }
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }, [fv]);

  return (
    <div className="report-container space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-2xl font-bold text-card-foreground">General Report</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Overview of all clinical records
            {(dateFrom || dateTo) && ` (${dateFrom || "start"} — ${dateTo || "present"})`}
          </p>
        </div>
        <Button variant="clinical" onClick={() => window.print()} className="no-print">
          <Printer className="h-4 w-4" />
          Print Report
        </Button>
      </div>

      <div className="no-print">
        <Panel title="Filter by Date Range">
          <div className="grid items-end gap-4 sm:grid-cols-3">
            <Field label="From" type="date" value={dateFrom} onChange={setDateFrom} />
            <Field label="To" type="date" value={dateTo} onChange={setDateTo} />
            <Button variant="outline" onClick={() => { setDateFrom(""); setDateTo(""); }}>
              Clear Filter
            </Button>
          </div>
        </Panel>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricCard icon={Files} label="Total Patients" value={String(fp.length)} />
        <MetricCard icon={GraduationCap} label="Total Students" value={String(fs.length)} />
        <MetricCard icon={Upload} label="Lab Results" value={String(fl.length)} />
        <MetricCard icon={NotebookPen} label="Visit Notes" value={String(fv.length)} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Gender Distribution">
          {genderData.length === 0 ? (
            <EmptyState icon={Activity} text="No data available." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={genderData}
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    innerRadius={50}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    paddingAngle={3}
                  >
                    {genderData.map((_, i) => (
                      <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Monthly Registrations">
          {monthlyData.length === 0 ? (
            <EmptyState icon={Activity} text="No data available." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="patients" name="Patients" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="students" name="Students" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Panel title="Students by Department">
          {deptData.length === 0 ? (
            <EmptyState icon={GraduationCap} text="No student data available." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deptData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={120} />
                  <Tooltip />
                  <Bar dataKey="count" name="Students" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>

        <Panel title="Top Diagnoses">
          {diagnosisData.length === 0 ? (
            <EmptyState icon={NotebookPen} text="No visit note data available." />
          ) : (
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={diagnosisData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis type="number" tick={{ fontSize: 12 }} allowDecimals={false} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip />
                  <Bar dataKey="count" name="Cases" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Panel>
      </div>

      <Panel title="Recent Patient Records">
        {fp.length === 0 ? (
          <EmptyState icon={Files} text="No patient records in the selected range." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left">
                  <th className="pb-3 pr-4 font-semibold text-muted-foreground">Patient ID</th>
                  <th className="pb-3 pr-4 font-semibold text-muted-foreground">Name</th>
                  <th className="pb-3 pr-4 font-semibold text-muted-foreground">Gender</th>
                  <th className="pb-3 pr-4 font-semibold text-muted-foreground">Age</th>
                  <th className="pb-3 font-semibold text-muted-foreground">Created</th>
                </tr>
              </thead>
              <tbody>
                {fp.slice(0, 15).map((p) => (
                  <tr key={p.id} className="border-b border-border/50">
                    <td className="py-2.5 pr-4 font-mono text-xs text-primary">{p.patient_id}</td>
                    <td className="py-2.5 pr-4 font-medium">{p.name}</td>
                    <td className="py-2.5 pr-4 capitalize">{p.gender}</td>
                    <td className="py-2.5 pr-4">{p.age ?? "—"}</td>
                    <td className="py-2.5 text-muted-foreground">{formatDate(p.created_at.slice(0, 10))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {fp.length > 15 && (
              <p className="mt-3 text-xs text-muted-foreground">Showing 15 of {fp.length} records</p>
            )}
          </div>
        )}
      </Panel>

      <div className="print-only text-center text-xs text-muted-foreground">
        <p>
          Generated on{" "}
          {new Date().toLocaleDateString("en", { year: "numeric", month: "long", day: "numeric" })}
          {" · "}Digital Clinical File Management System
        </p>
      </div>
    </div>
  );
}

// ─── CSV / Excel Import ────────────────────────────────────────────────────────

type CsvRow = {
  name: string;
  dob: string;
  age: string;
  gender: string;
  phone: string;
  address: string;
  _valid: boolean;
  _error: string;
};

const CSV_TEMPLATE_HEADERS = ["name", "dob", "age", "gender", "phone", "address"];

const COLUMN_ALIASES: Record<string, string> = {
  "full name": "name", "fullname": "name", "patient name": "name", "patient": "name", "name": "name",
  "date of birth": "dob", "dateofbirth": "dob", "dob": "dob", "birth date": "dob", "birthdate": "dob",
  "age": "age", "years": "age",
  "gender": "gender", "sex": "gender",
  "phone": "phone", "phone number": "phone", "phonenumber": "phone", "tel": "phone", "telephone": "phone", "mobile": "phone",
  "address": "address", "home address": "address", "location": "address",
};

function normalizeGender(raw: string): Gender {
  const v = raw.trim().toLowerCase();
  if (["f", "female", "woman", "girl"].includes(v)) return "female";
  if (["m", "male", "man", "boy"].includes(v)) return "male";
  if (["other", "non-binary", "nonbinary"].includes(v)) return "other";
  return "unknown";
}

function parseCsvText(text: string): { headers: string[]; rows: string[][] } {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Simple CSV parser that handles quoted fields
  function parseLine(line: string): string[] {
    const result: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') { current += '"'; i++; }
        else inQuotes = !inQuotes;
      } else if (ch === "," && !inQuotes) {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const headers = parseLine(lines[0]);
  const rows = lines.slice(1).map(parseLine);
  return { headers, rows };
}

function mapCsvToCsvRows(headers: string[], rows: string[][]): CsvRow[] {
  // Map header indices to our fields via aliases
  const colMap: Record<string, number> = {};
  headers.forEach((h, i) => {
    const key = COLUMN_ALIASES[h.trim().toLowerCase()];
    if (key && !(key in colMap)) colMap[key] = i;
  });

  return rows.map((cols) => {
    const get = (field: string) => (colMap[field] !== undefined ? (cols[colMap[field]] ?? "").trim() : "");
    const name = get("name");
    const dob = get("dob");
    const age = get("age");
    const gender = get("gender");
    const phone = get("phone");
    const address = get("address");

    let _valid = true;
    let _error = "";
    if (!name || name.length < 2) { _valid = false; _error = "Name is required (min 2 chars)"; }

    return { name, dob, age, gender, phone, address, _valid, _error };
  });
}

function downloadCsvTemplate() {
  const bom = "\uFEFF";
  const content = bom + CSV_TEMPLATE_HEADERS.join(",") + "\nJohn Doe,1990-05-15,34,male,08012345678,123 Main Street\nJane Smith,,28,female,09087654321,456 Oak Avenue";
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "patient_import_template.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function CsvImportView({
  reload,
  showToast,
  onView,
}: {
  reload: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  onView: (view: MainView) => void;
}) {
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [fileName, setFileName] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [importResult, setImportResult] = useState<{ imported: number; failed: number } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validRows = useMemo(() => csvRows.filter((r) => r._valid), [csvRows]);
  const invalidRows = useMemo(() => csvRows.filter((r) => !r._valid), [csvRows]);

  const processFile = useCallback((file: File) => {
    setImportResult(null);
    setFileName(file.name);

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) {
        showToast("Could not read the file. Make sure it is a .csv text file.", "error");
        return;
      }
      const { headers, rows } = parseCsvText(text);
      if (headers.length === 0 || rows.length === 0) {
        showToast("The file appears empty or has no data rows.", "error");
        return;
      }
      const mapped = mapCsvToCsvRows(headers, rows);
      setCsvRows(mapped);
      showToast(`Loaded ${mapped.length} rows from ${file.name}`, "info");
    };
    reader.onerror = () => showToast("Failed to read the file", "error");
    reader.readAsText(file);
  }, [showToast]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }

  function removeRow(index: number) {
    setCsvRows((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleImport() {
    if (validRows.length === 0) {
      showToast("No valid rows to import", "error");
      return;
    }
    setBusy(true);
    let imported = 0;
    let failed = 0;
    let lastError: string | null = null;

    // Try batch insert first (50 rows at a time)
    const batchSize = 50;
    for (let i = 0; i < validRows.length; i += batchSize) {
      const batch = validRows.slice(i, i + batchSize).map((row) => ({
        name: row.name,
        dob: row.dob || null,
        age: row.age ? Number(row.age) : null,
        gender: normalizeGender(row.gender),
        phone: row.phone || null,
        address: row.address || null,
      }));

      const { error, data } = await supabase.from("patients").insert(batch).select("id");
      if (error) {
        // Batch failed — fall back to row-by-row so good rows still get through
        for (const row of batch) {
          const { error: rowErr, data: rowData } = await supabase
            .from("patients")
            .insert(row)
            .select("id");
          if (rowErr) {
            failed += 1;
            lastError = rowErr.message;
          } else {
            imported += rowData?.length ?? 1;
          }
        }
      } else {
        imported += data?.length ?? batch.length;
      }
    }

    setBusy(false);
    setImportResult({ imported, failed });

    if (imported > 0 && failed === 0) {
      showToast(
        `Successfully imported ${imported} patient${imported > 1 ? "s" : ""}`,
        "success",
      );
      await reload();
    } else if (imported > 0 && failed > 0) {
      showToast(
        `Imported ${imported} patient${imported > 1 ? "s" : ""}, ${failed} row${failed > 1 ? "s" : ""} failed${lastError ? `: ${lastError}` : ""}`,
        "info",
      );
      await reload();
    } else {
      showToast(
        `Import failed for all ${failed} row${failed > 1 ? "s" : ""}${lastError ? ` — ${lastError}` : ""}`,
        "error",
      );
    }
  }

  return (
    <div className="space-y-5">
      <Panel title="Import Patients from CSV" eyebrow="Bulk Upload">
        <div className="space-y-5">
          {/* Instructions */}
          <div className="rounded-lg border border-border bg-muted/40 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-card-foreground">
              <FileSpreadsheet className="h-4 w-4 text-primary" />
              How it works
            </h3>
            <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
              <li>• Upload a <strong>.csv</strong> file with patient data (save Excel/Google Sheets as CSV first)</li>
              <li>• Required column: <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">name</code></li>
              <li>• Optional columns: <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">dob</code>, <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">age</code>, <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">gender</code>, <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">phone</code>, <code className="rounded bg-muted px-1 py-0.5 text-xs font-mono">address</code></li>
              <li>• Column names are flexible — <em>"Full Name"</em>, <em>"Patient Name"</em>, <em>"Sex"</em>, <em>"Phone Number"</em>, etc. all work</li>
            </ul>
            <Button variant="outline" size="sm" className="mt-3" onClick={downloadCsvTemplate}>
              <Download className="h-4 w-4" />
              Download Template CSV
            </Button>
          </div>

          {/* Drop zone */}
          <div
            className={cn(
              "relative flex min-h-40 cursor-pointer flex-col items-center justify-center gap-3 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
              dragOver
                ? "border-primary bg-primary/5"
                : "border-border bg-background/50 hover:border-primary/50 hover:bg-muted/30",
            )}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <FileUp className={cn("h-10 w-10 transition-colors", dragOver ? "text-primary" : "text-muted-foreground")} />
            <div>
              <p className="text-sm font-semibold text-card-foreground">Drop a CSV file here or click to browse</p>
              <p className="mt-1 text-xs text-muted-foreground">Accepts .csv files · Save Excel as CSV first</p>
            </div>
            {fileName && (
              <p className="text-xs font-medium text-primary">
                Loaded: {fileName}
              </p>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Preview table */}
          {csvRows.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-sm font-bold text-card-foreground">Preview ({csvRows.length} rows)</h3>
                  {validRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-400">
                      <CheckCircle2 className="h-3 w-3" />
                      {validRows.length} valid
                    </span>
                  )}
                  {invalidRows.length > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                      <AlertCircle className="h-3 w-3" />
                      {invalidRows.length} invalid
                    </span>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={() => { setCsvRows([]); setFileName(""); setImportResult(null); }}>
                  <X className="h-4 w-4" />
                  Clear
                </Button>
              </div>

              <div className="max-h-96 overflow-auto rounded-lg border border-border">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 z-10 bg-muted/90 backdrop-blur">
                    <tr>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">#</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Name</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">DOB</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Age</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Gender</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Phone</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Address</th>
                      <th className="px-3 py-2 text-left font-semibold text-muted-foreground">Status</th>
                      <th className="px-3 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {csvRows.map((row, i) => (
                      <tr key={i} className={cn("transition-colors hover:bg-muted/30", !row._valid && "bg-destructive/5")}>
                        <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 font-medium text-card-foreground">{row.name || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.dob || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.age || "—"}</td>
                        <td className="px-3 py-2 text-muted-foreground">{normalizeGender(row.gender)}</td>
                        <td className="px-3 py-2 text-muted-foreground">{row.phone || "—"}</td>
                        <td className="max-w-40 truncate px-3 py-2 text-muted-foreground" title={row.address}>{row.address || "—"}</td>
                        <td className="px-3 py-2">
                          {row._valid ? (
                            <span className="inline-flex items-center gap-1 text-xs text-emerald-400">
                              <CheckCircle2 className="h-3.5 w-3.5" /> OK
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-xs text-destructive" title={row._error}>
                              <AlertCircle className="h-3.5 w-3.5" /> {row._error}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2">
                          <button onClick={() => removeRow(i)} className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive" title="Remove row">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Import button */}
              <div className="flex items-center gap-3">
                <Button variant="clinical" size="lg" onClick={handleImport} disabled={busy || validRows.length === 0}>
                  <Upload className="h-4 w-4" />
                  {busy ? `Importing ${validRows.length} patients…` : `Import ${validRows.length} Patient${validRows.length !== 1 ? "s" : ""}`}
                </Button>
                {invalidRows.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {invalidRows.length} invalid row{invalidRows.length !== 1 ? "s" : ""} will be skipped
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Success result */}
          {importResult && (
            <div className={cn(
              "rounded-lg border p-4",
              importResult.imported > 0 ? "border-emerald-500/30 bg-emerald-500/5" : "border-destructive/30 bg-destructive/5",
            )}>
              <div className="flex items-center gap-3">
                {importResult.imported > 0 ? (
                  <CheckCircle2 className="h-6 w-6 text-emerald-400" />
                ) : (
                  <AlertCircle className="h-6 w-6 text-destructive" />
                )}
                <div>
                  <p className="font-semibold text-card-foreground">
                    {importResult.imported > 0
                      ? `Successfully imported ${importResult.imported} patient${importResult.imported > 1 ? "s" : ""}`
                      : "Import failed"}
                  </p>
                  {importResult.failed > 0 && (
                    <p className="text-sm text-muted-foreground">{importResult.failed} row{importResult.failed > 1 ? "s" : ""} failed to import</p>
                  )}
                </div>
              </div>
              <div className="mt-3 flex gap-2">
                <Button variant="outline" size="sm" onClick={() => { setCsvRows([]); setFileName(""); setImportResult(null); }}>
                  Import Another File
                </Button>
                <Button variant="clinical" size="sm" onClick={() => onView("search")}>
                  <Search className="h-4 w-4" />
                  View Patients
                </Button>
              </div>
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

function CreatePatientView({
  onCreated,
  reload,
  showToast,
}: {
  onCreated: (patient: Patient) => void;
  reload: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: "", dob: "", age: "", gender: "unknown", phone: "", address: "" });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = patientSchema.safeParse(form);
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || "Check patient details", "error");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase
      .from("patients")
      .insert({
        name: parsed.data.name,
        dob: parsed.data.dob || null,
        age: parsed.data.age === "" || parsed.data.age === undefined ? null : Number(parsed.data.age),
        gender: parsed.data.gender,
        phone: parsed.data.phone || null,
        address: parsed.data.address || null,
      })
      .select("*")
      .single();
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Patient created with a unique ID", "success");
    await reload();
    onCreated(data as Patient);
  }

  return (
    <Panel title="Create Patient">
      <form className="grid gap-4 lg:grid-cols-2" onSubmit={submit}>
        <Field label="Full Name" value={form.name} onChange={(value) => setForm({ ...form, name: value })} required />
        <Field label="Date of Birth" type="date" value={form.dob} onChange={(value) => setForm({ ...form, dob: value })} />
        <Field label="Age" type="number" value={form.age} onChange={(value) => setForm({ ...form, age: value })} />
        <label className="block space-y-2">
          <span className="text-sm font-medium text-card-foreground">Gender</span>
          <select className="clinical-select" value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value })}>
            <option value="unknown">Unknown</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>
        </label>
        <Field label="Phone Number" value={form.phone} onChange={(value) => setForm({ ...form, phone: value })} />
        <label className="block space-y-2 lg:col-span-2">
          <span className="text-sm font-medium text-card-foreground">Address</span>
          <textarea className="clinical-textarea" value={form.address} onChange={(event) => setForm({ ...form, address: event.target.value })} rows={4} />
        </label>
        <div className="lg:col-span-2">
          <Button variant="clinical" disabled={busy}>
            <Plus className="h-4 w-4" />
            Create Patient
          </Button>
        </div>
      </form>
    </Panel>
  );
}

function SearchPatientView({
  searchTerm,
  setSearchTerm,
  patients,
  onOpenPatient,
}: {
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  patients: Patient[];
  onOpenPatient: (patient: Patient) => void;
}) {
  return (
    <Panel title="Search Patient">
      <div className="mb-4 flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-2 shadow-soft">
        <Search className="h-5 w-5 text-muted-foreground" />
        <input
          className="h-10 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          placeholder="Search by patient name or patient ID"
        />
      </div>
      {patients.length === 0 ? (
        <EmptyState icon={Search} text="No matching patient records found." />
      ) : (
        <div className="grid gap-3">
          {patients.map((patient) => (
            <button key={patient.id} className="record-row" onClick={() => onOpenPatient(patient)}>
              <span>
                <strong>{patient.name}</strong>
                <small>{patient.patient_id} · {patient.gender}</small>
              </span>
              <span>{patient.phone || "No phone"}</span>
            </button>
          ))}
        </div>
      )}
    </Panel>
  );
}

function LabUploadView({
  patients,
  reload,
  showToast,
  preselected,
}: {
  patients: Patient[];
  reload: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  preselected: Patient | null;
}) {
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [form, setForm] = useState({ patientId: preselected?.id || "", testName: "", result: "", date: getToday() });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = labSchema.safeParse(form);
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || "Check lab details", "error");
      return;
    }
    if (file && !["application/pdf", "image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      showToast("Upload a PDF, PNG, JPG, or WEBP file", "error");
      return;
    }
    setBusy(true);
    let filePath: string | null = null;
    if (file) {
      filePath = `${parsed.data.patientId}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "-")}`;
      const { error: uploadError } = await supabase.storage.from("lab-results").upload(filePath, file);
      if (uploadError) {
        setBusy(false);
        showToast(uploadError.message, "error");
        return;
      }
    }
    const { error } = await supabase.from("lab_results").insert({
      patient_id: parsed.data.patientId,
      test_name: parsed.data.testName,
      result: parsed.data.result,
      date: parsed.data.date,
      file_path: filePath,
    });
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Lab result saved", "success");
    setForm({ patientId: preselected?.id || "", testName: "", result: "", date: getToday() });
    setFile(null);
    await reload();
  }

  return (
    <Panel title="Upload Lab Result">
      <ClinicalRecordForm patients={patients} patientId={form.patientId} setPatientId={(value) => setForm({ ...form, patientId: value })}>
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={submit}>
          <Field label="Test Name" value={form.testName} onChange={(value) => setForm({ ...form, testName: value })} required />
          <Field label="Date" type="date" value={form.date} onChange={(value) => setForm({ ...form, date: value })} required />
          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-card-foreground">Result Description</span>
            <textarea className="clinical-textarea" value={form.result} onChange={(event) => setForm({ ...form, result: event.target.value })} rows={4} required />
          </label>
          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-card-foreground">File Upload (PDF/Image)</span>
            <Input type="file" accept="application/pdf,image/png,image/jpeg,image/webp" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
          </label>
          <div className="lg:col-span-2">
            <Button variant="clinical" disabled={busy}>
              <FilePlus2 className="h-4 w-4" />
              Save Lab Result
            </Button>
          </div>
        </form>
      </ClinicalRecordForm>
    </Panel>
  );
}

function VisitNoteView({
  patients,
  reload,
  showToast,
  preselected,
}: {
  patients: Patient[];
  reload: () => Promise<void>;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  preselected: Patient | null;
}) {
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    patientId: preselected?.id || "",
    visitDate: getToday(),
    symptoms: "",
    diagnosis: "",
    treatment: "",
    doctorName: "",
  });

  async function submit(event: FormEvent) {
    event.preventDefault();
    const parsed = noteSchema.safeParse(form);
    if (!parsed.success) {
      showToast(parsed.error.issues[0]?.message || "Check visit note details", "error");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("visit_notes").insert({
      patient_id: parsed.data.patientId,
      date: parsed.data.visitDate,
      symptoms: parsed.data.symptoms,
      diagnosis: parsed.data.diagnosis,
      treatment: parsed.data.treatment,
      doctor_name: parsed.data.doctorName,
    });
    setBusy(false);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Visit note saved", "success");
    setForm({ ...form, symptoms: "", diagnosis: "", treatment: "", doctorName: "", visitDate: getToday() });
    await reload();
  }

  return (
    <Panel title="Add Visit Note">
      <ClinicalRecordForm patients={patients} patientId={form.patientId} setPatientId={(value) => setForm({ ...form, patientId: value })}>
        <form className="grid gap-4 lg:grid-cols-2" onSubmit={submit}>
          <Field label="Visit Date" type="date" value={form.visitDate} onChange={(value) => setForm({ ...form, visitDate: value })} required />
          <Field label="Doctor Name" value={form.doctorName} onChange={(value) => setForm({ ...form, doctorName: value })} required />
          <TextareaField label="Symptoms" value={form.symptoms} onChange={(value) => setForm({ ...form, symptoms: value })} />
          <TextareaField label="Diagnosis" value={form.diagnosis} onChange={(value) => setForm({ ...form, diagnosis: value })} />
          <label className="block space-y-2 lg:col-span-2">
            <span className="text-sm font-medium text-card-foreground">Treatment / Prescription</span>
            <textarea className="clinical-textarea" value={form.treatment} onChange={(event) => setForm({ ...form, treatment: event.target.value })} rows={4} required />
          </label>
          <div className="lg:col-span-2">
            <Button variant="clinical" disabled={busy}>
              <NotebookPen className="h-4 w-4" />
              Save Visit Note
            </Button>
          </div>
        </form>
      </ClinicalRecordForm>
    </Panel>
  );
}

function PatientRecordView({
  patient,
  labs,
  notes,
  isAdmin,
  onDelete,
  onAddLab,
  onAddNote,
  showToast,
  reload,
}: {
  patient: Patient;
  labs: LabResult[];
  notes: VisitNote[];
  isAdmin: boolean;
  onDelete: (patient: Patient) => void;
  onAddLab: () => void;
  onAddNote: () => void;
  showToast: (message: string, type?: "success" | "error" | "info") => void;
  reload: () => Promise<void>;
}) {
  return (
    <div className="space-y-4">
      <Panel title={patient.name} eyebrow={patient.patient_id}>
        <div className="flex flex-wrap gap-3">
          <Button variant="clinical" onClick={onAddLab}><Upload className="h-4 w-4" />Upload Lab Result</Button>
          <Button variant="secondary" onClick={onAddNote}><NotebookPen className="h-4 w-4" />Add Visit Note</Button>
          {isAdmin && <Button variant="destructive" onClick={() => onDelete(patient)}>Delete Patient</Button>}
        </div>
      </Panel>

      <Tabs defaultValue="details" className="w-full">
        <TabsList className="mb-4 flex h-auto w-full flex-wrap justify-start rounded-lg border border-border bg-card p-1 shadow-soft">
          <TabsTrigger value="details">Patient Details</TabsTrigger>
          <TabsTrigger value="labs">Lab Results</TabsTrigger>
          <TabsTrigger value="notes">Visit Notes</TabsTrigger>
        </TabsList>
        <TabsContent value="details">
          <Panel title="Patient Details">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Info label="Patient ID" value={patient.patient_id} />
              <Info label="Date of Birth" value={formatDate(patient.dob)} />
              <Info label="Age" value={patient.age?.toString() || "Not recorded"} />
              <Info label="Gender" value={patient.gender} />
              <Info label="Phone" value={patient.phone || "Not recorded"} />
              <Info label="Address" value={patient.address || "Not recorded"} />
            </div>
          </Panel>
        </TabsContent>
        <TabsContent value="labs">
          <Panel title="Lab Results">
            {labs.length === 0 ? <EmptyState icon={Upload} text="No lab results uploaded yet." /> : <LabResultsList labs={labs} showToast={showToast} reload={reload} isAdmin={isAdmin} />}
          </Panel>
        </TabsContent>
        <TabsContent value="notes">
          <Panel title="Visit Notes">
            {notes.length === 0 ? <EmptyState icon={NotebookPen} text="No visit notes added yet." /> : <VisitNotesList notes={notes} />}
          </Panel>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function LabResultsList({ labs, showToast, reload, isAdmin }: { labs: LabResult[]; showToast: (message: string, type?: "success" | "error" | "info") => void; reload: () => Promise<void>; isAdmin: boolean }) {
  async function openFile(path: string | null, download: boolean) {
    if (!path) return;
    const { data, error } = await supabase.storage.from("lab-results").createSignedUrl(path, 60, { download });
    if (error || !data?.signedUrl) {
      showToast(error?.message || "File unavailable", "error");
      return;
    }
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  }

  async function deleteLab(lab: LabResult) {
    if (!window.confirm(`Permanently delete lab result "${lab.test_name}"? This cannot be undone.`)) return;
    if (lab.file_path) {
      await supabase.storage.from("lab-results").remove([lab.file_path]);
    }
    const { error } = await supabase.from("lab_results").delete().eq("id", lab.id);
    if (error) {
      showToast(error.message, "error");
      return;
    }
    showToast("Lab result deleted", "success");
    await reload();
  }

  return (
    <div className="space-y-3">
      {labs.map((lab) => (
        <div key={lab.id} className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="font-semibold text-card-foreground">{lab.test_name}</p>
              <p className="mt-1 text-sm text-muted-foreground">{formatDate(lab.date)}</p>
              <p className="mt-3 text-sm leading-6 text-card-foreground">{lab.result}</p>
            </div>
            {lab.file_path && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openFile(lab.file_path, false)}>View</Button>
                <Button variant="outline" size="icon" onClick={() => openFile(lab.file_path, true)}><Download className="h-4 w-4" /></Button>
              </div>
            )}
          </div>
          {isAdmin && <Button className="mt-3" variant="ghost" size="sm" onClick={() => deleteLab(lab)}>Delete</Button>}
        </div>
      ))}
    </div>
  );
}

function VisitNotesList({ notes }: { notes: VisitNote[] }) {
  return (
    <div className="space-y-3">
      {notes.map((note) => (
        <article key={note.id} className="rounded-lg border border-border bg-muted/30 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="font-semibold text-card-foreground">{formatDate(note.date)}</h3>
            <span className="rounded-md bg-secondary px-2.5 py-1 text-xs font-medium text-secondary-foreground">{note.doctor_name}</span>
          </div>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <Info label="Symptoms" value={note.symptoms} />
            <Info label="Diagnosis" value={note.diagnosis} />
            <Info label="Treatment / Prescription" value={note.treatment} />
          </div>
        </article>
      ))}
    </div>
  );
}

function ClinicalRecordForm({ children, patients, patientId, setPatientId }: { children: ReactNode; patients: Patient[]; patientId: string; setPatientId: (value: string) => void }) {
  return (
    <div className="space-y-4">
      <label className="block space-y-2">
        <span className="text-sm font-medium text-card-foreground">Patient</span>
        <select className="clinical-select" value={patientId} onChange={(event) => setPatientId(event.target.value)} required>
          <option value="">Select a patient</option>
          {patients.map((patient) => (
            <option key={patient.id} value={patient.id}>{patient.name} · {patient.patient_id}</option>
          ))}
        </select>
      </label>
      {children}
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: typeof Activity; label: string; value: string }) {
  return (
    <div className="group rounded-lg border border-border bg-card/85 p-5 shadow-soft transition-transform duration-300 hover:-translate-y-1 hover:shadow-clinical">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-2 text-3xl font-black text-card-foreground">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-accent text-accent-foreground transition-transform duration-300 group-hover:rotate-3">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

function ActionCard({ icon: Icon, title, onClick }: { icon: typeof Activity; title: string; onClick: () => void }) {
  return (
    <button className="group rounded-lg border border-border bg-card/85 p-5 text-left shadow-soft transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-clinical focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" onClick={onClick}>
      <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-transform duration-300 group-hover:scale-105">
        <Icon className="h-5 w-5" />
      </div>
      <p className="font-bold text-card-foreground">{title}</p>
    </button>
  );
}

function Panel({ title, eyebrow, children }: { title: string; eyebrow?: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border bg-card/88 p-5 shadow-soft backdrop-blur-xl sm:p-6">
      <div className="mb-5">
        {eyebrow && <p className="text-xs font-bold uppercase tracking-wide text-primary">{eyebrow}</p>}
        <h2 className="text-xl font-bold text-card-foreground">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function EmptyState({ icon: Icon, text }: { icon: typeof Activity; text: string }) {
  return (
    <div className="flex min-h-44 flex-col items-center justify-center rounded-lg border border-dashed border-border bg-muted/30 p-8 text-center">
      <Icon className="mb-3 h-8 w-8 text-muted-foreground" />
      <p className="text-sm text-muted-foreground">{text}</p>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border bg-background/70 p-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm font-medium text-card-foreground">{value}</p>
    </div>
  );
}

function Field({ label, value, onChange, type = "text", required = false }: { label: string; value: string; onChange: (value: string) => void; type?: string; required?: boolean }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-card-foreground">{label}</span>
      <Input type={type} value={value} onChange={(event) => onChange(event.target.value)} required={required} />
    </label>
  );
}

function TextareaField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-card-foreground">{label}</span>
      <textarea className="clinical-textarea" value={value} onChange={(event) => onChange(event.target.value)} rows={4} required />
    </label>
  );
}
