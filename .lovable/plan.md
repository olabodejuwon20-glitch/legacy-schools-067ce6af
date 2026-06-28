
# White-Label Onboarding & Digital Identity

Extends the current school + invite_codes + memberships model. Nothing existing is removed; new tables and pages are added alongside.

## 1. School Digital Identity

Augment `schools.settings` (JSONB) with an `identity` block: `school_code`, `primary_color`, `accent_color`, `favicon_url`, `welcome_message`, `contact_phone`, `contact_email`. Logo already exists.

- Auto-provision `school_code` (6-char alphanumeric, unique) on school creation via trigger.
- Subdomain = existing `schools.slug` (already implemented).
- Favicon + theme color already injected via `TenantHead.tsx`; extend it to read `identity` and inject CSS variables for primary/accent so the entire app rebrands per tenant.

## 2. Onboarding Center (Admin)

New page: `src/pages/admin/OnboardingCenter.tsx` mounted at `/:slug/app/admin/onboarding-center` with tabs:

1. **Identity & QR** — view/regenerate QR, download PNG, download branded PDF poster (logo + name + QR + instructions + contact), share link.
2. **Activation Codes** — generate / revoke / set expiry / filter by role. Reuses existing `invite_codes` table (already has `code`, `role`, `expires_at`, `max_uses`, `uses`, `admin_slot`). Add columns: `assigned_to_user_id uuid null`, `revoked_at timestamptz null`, `metadata jsonb default '{}'` (for admission_no / staff_id binding).
3. **Roles on Onboarding** — toggle which roles appear (stored in `schools.settings.onboarding.enabled_roles`). Reuses existing admin_role_slots for custom admin roles; for non-admin custom roles (Librarian, Nurse, …) add a lightweight `school_custom_roles` table (id, school_id, key, label, base_role, enabled, deleted_at).
4. **Policies** — password length, PIN length, OTP required toggle, code TTL default. Stored in `schools.settings.onboarding.policies`.
5. **History & Analytics** — query `invite_codes` joined with `memberships` to show generated/used/revoked counts and recent redemptions.

QR is generated client-side with `qrcode` (already common dep; install if missing) encoding `https://<origin>/<slug>/join?code=<optional>`. Poster PDF uses existing `exportBrandedPDF` utility.

## 3. White-Label Join Flow

Replace `src/pages/Join.tsx` with a role-picker first screen, then per-role form. Page already loads SchoolContext so branding is automatic; remove any Legacyskool wordmark from join/signin headers when on a tenant slug.

Roles shown = defaults (Student, Teacher, Parent, Driver, Staff) ∩ admin's enabled set + custom roles. Each role uses its required fields:

- **Student**: admission_no + activation code → PIN + password + photo upload.
- **Teacher / Driver / Staff / custom**: staff_id + activation code → PIN + password.
- **Parent**: child admission_no → if pre-registered phone exists, send OTP via existing `phone-auth` function; else collect phone + verify; then PIN/password. "Add another child" flow on parent dashboard performs the same verification and inserts another row into `parent_links`.

Activation codes single-use: enforced server-side in `join-with-code` (set `uses = max_uses = 1` for codes generated here, plus mark `revoked_at` on success).

## 4. Edge Function changes

- `join-with-code`: accept `admission_no` / `staff_id` / `child_admission_no`, validate against memberships/profiles, mark code consumed, write audit row to `auth_events`.
- New `generate-activation-codes`: admin-only, bulk-create codes for a role with TTL, returns printable list.
- New `parent-link-verify`: sends + verifies OTP for parent→child linking.

## 5. Branding injection

`TenantHead.tsx` already injects manifest + theme. Extend to also set `--primary` / `--accent` CSS vars on `:root` from `identity` colors so shadcn tokens follow the school. Add a `<BrandGate>` wrapper that hides the Legacyskool wordmark on any `/:slug/*` route (Super Admin portal unaffected).

## 6. Security

- All new tables get `school_id`, RLS, GRANTs, and composite indexes.
- Activation codes scoped to school via existing RLS pattern.
- QR encodes only the public slug + optional code — never user PII.
- Onboarding events logged to `auth_events` (existing).
- Soft-delete on `school_custom_roles` via `deleted_at`.

## Technical sections

**New tables**
- `school_custom_roles(id, school_id, key, label, base_role enum, enabled bool, deleted_at, created_at, updated_at)` — RLS: admin manage; authenticated read own school.
- `onboarding_events(id, school_id, code_id, user_id, role, event text, metadata jsonb, created_at)` — RLS: admin read; service write.

**Altered**
- `invite_codes` add: `assigned_to_user_id uuid`, `revoked_at timestamptz`, `metadata jsonb default '{}'`, index on `(school_id, role, revoked_at)`.
- `schools.settings.identity` + `schools.settings.onboarding` JSONB blocks.

**New files**
- `src/pages/admin/OnboardingCenter.tsx` (+ tab components under `src/components/admin/onboarding/`)
- `src/pages/JoinRolePicker.tsx` (replaces current `Join.tsx` entry)
- `src/pages/join/StudentJoin.tsx`, `TeacherJoin.tsx`, `ParentJoin.tsx`, `DriverStaffJoin.tsx`
- `src/lib/qr.ts`, `src/lib/onboardingPoster.ts`
- `supabase/functions/generate-activation-codes/index.ts`
- `supabase/functions/parent-link-verify/index.ts`

**Edited**
- `src/components/TenantHead.tsx` — CSS-var color injection
- `supabase/functions/join-with-code/index.ts` — role-specific validation + audit
- `src/modules/registry.ts` — add Onboarding Center sidebar entry for admin
- `src/App.tsx` — new routes

## What stays untouched
Multi-tenant RLS model, `memberships`, `profiles`, existing admin invite flow, Super Admin portal, payments, exams. Nothing in the existing auth/JWT path changes.
