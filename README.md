# Patient Path Lite

A digital clinical file management system for hospital staff. Manage patient records, lab results, visit notes, and student health registrations from a single secure dashboard.

Also branded in the UI as **Crawford Clinicals**.

## Features

- **Patient records** — create, search, view, and import via CSV
- **Lab results** — attach PDF/image files stored in Supabase Storage
- **Visit notes** — symptoms, diagnosis, treatment, and doctor name
- **Student registration** — staff entry plus a public form at `/student-form`
- **Reports** — charts and printable summaries (gender, registrations, departments, diagnoses)
- **Role-based access** — admin, doctor, and nurse roles enforced with PostgreSQL RLS

## Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript |
| UI | React 19, Tailwind CSS 4, Radix UI / shadcn |
| Routing / SSR | TanStack Router, TanStack Start |
| Validation | Zod |
| Charts | Recharts |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| OAuth | Lovable Cloud Auth (Google) |
| Build | Vite 7 |
| Deployment | Cloudflare Workers (Wrangler) |

## Prerequisites

- Node.js 18+ and npm
- A [Supabase](https://supabase.com) project
- (Optional) [Cloudflare](https://cloudflare.com) account for production deployment

## Quick Start

### 1. Clone and install

```bash
git clone <repository-url>
cd patient-path-lite-main
npm install
```

### 2. Environment variables

```bash
cp .env.example .env
```

Fill in your Supabase credentials from **Dashboard → Project Settings → API**:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your-anon-key

SUPABASE_URL=https://your-project.supabase.co
SUPABASE_PUBLISHABLE_KEY=your-anon-key
```

`VITE_*` variables are used by the browser bundle. The unprefixed versions are used during server-side rendering on Cloudflare Workers.

### 3. Database setup

Open the **Supabase SQL Editor** and run these scripts in order:

1. [`supabase/full_schema.sql`](supabase/full_schema.sql) — core tables, RLS policies, and the `lab-results` storage bucket
2. [`supabase/students_table.sql`](supabase/students_table.sql) — students table and policies
3. All files in [`supabase/migrations/`](supabase/migrations/) in filename order
4. [`supabase/fix_permissions.sql`](supabase/fix_permissions.sql) — grants on RLS helper functions

The migration `20260626000000_allow_public_student_registration.sql` is required for the public `/student-form` page to work without login.

### 4. Create a staff account

**Option A — Sign up in the app**

1. Run the dev server (step 5 below)
2. Open the app and click **Sign up**
3. Enter a username (e.g. `admin`) — usernames without `@` get `@clinic.local` appended automatically

**Option B — Demo login**

If a demo user exists in Supabase Auth, use **Demo Login** on the sign-in screen (`admin@clinic.local` / `admin123`).

**Promote a user to admin**

New sign-ups receive the `nurse` role by default. To grant admin access, run in the SQL Editor:

```sql
INSERT INTO public.user_roles (user_id, role)
VALUES ('<user-uuid-from-auth-users>', 'admin')
ON CONFLICT (user_id, role) DO NOTHING;
```

Find the user UUID in **Supabase → Authentication → Users**.

### 5. Run locally

```bash
npm run dev
```

Open the URL shown in the terminal (typically `http://localhost:5173`).

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Production build (client + SSR worker) |
| `npm run preview` | Preview production build locally |
| `npm run lint` | Run ESLint |
| `npm run format` | Format code with Prettier |

## Project Structure

```
src/
  components/clinical/   # Main clinical dashboard (ClinicalApp.tsx)
  components/ui/         # Shared UI components (shadcn/Radix)
  integrations/
    supabase/            # Supabase client, types, auth middleware
    lovable/             # Google OAuth integration
  routes/
    index.tsx            # Staff dashboard (/)
    student-form.tsx     # Public student registration (/student-form)
supabase/
  full_schema.sql        # Complete database schema
  students_table.sql     # Students table
  migrations/            # Incremental SQL migrations
  fix_permissions.sql    # RLS function grants
```

## Deployment

### Cloudflare Workers

```bash
npm run build
npx wrangler deploy
```

Set these environment variables in **Cloudflare Dashboard → Workers → Settings → Variables**:

- `SUPABASE_URL`
- `SUPABASE_PUBLISHABLE_KEY`

Configuration lives in [`wrangler.jsonc`](wrangler.jsonc). Build output is written to `dist/server/`.

### Supabase production checklist

- Run all SQL scripts and migrations on your production Supabase project
- Add your deployed domain to **Authentication → URL Configuration** (site URL and redirect URLs)
- Enable Google OAuth in Supabase if using **Continue with Google**
- Confirm the `lab-results` storage bucket exists with the correct RLS policies

### Lovable

This project uses `@lovable.dev/vite-tanstack-config` and can also be deployed via the [Lovable](https://lovable.dev) platform with Supabase env vars configured there.

## Routes

| Path | Access | Description |
|------|--------|-------------|
| `/` | Staff (authenticated) | Clinical dashboard |
| `/student-form` | Public | Student self-registration form |

## Roles

| Role | Permissions |
|------|-------------|
| **Nurse** | View and create patients, lab results, visit notes, and students |
| **Doctor** | Same as nurse |
| **Admin** | All of the above plus delete patients, lab results, and students |

Roles are stored in `user_roles` and enforced by Supabase Row Level Security policies.

## Troubleshooting

**"Missing Supabase environment variables"**

Ensure `.env` exists with all four variables from `.env.example` and restart the dev server.

**"permission denied for function has_role" or RLS errors**

Run [`supabase/fix_permissions.sql`](supabase/fix_permissions.sql) in the SQL Editor.

**Public student form fails to submit**

Run [`supabase/migrations/20260626000000_allow_public_student_registration.sql`](supabase/migrations/20260626000000_allow_public_student_registration.sql). It allows anonymous inserts and makes `created_by` nullable on the students table.

**Lab file upload fails**

Confirm the `lab-results` storage bucket was created by `full_schema.sql` and that the signed-in user has a clinical staff role in `user_roles`.

**Demo login unavailable**

Create the user in Supabase Auth or sign up through the app instead.

## License

Private — see repository owner for terms.
