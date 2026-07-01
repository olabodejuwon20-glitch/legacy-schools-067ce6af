
# SaaS Operations Foundation — Plan (Items 1–5)

Goal: run Legacyskool like a real SaaS. See every bug the moment it happens, fix a single school without touching the platform, roll changes out safely, and cap runaway cost.

---

## 1. Live error console for Super Admin

**What you get:** a real-time feed of every error happening across every school — who hit it, on what page, and the technical trace (for you only).

**Build**
- Reuse existing `public.client_errors` table + `reportError()` (already installed globally).
- Extend the table with: `school_id`, `role`, `browser`, `resolved_at`, `resolved_by`, `fingerprint` (hash of message+route for grouping).
- New page `src/pages/super/ErrorConsole.tsx`:
  - Live tab (realtime subscription) — new rows stream in.
  - Grouped tab — dedupe by fingerprint, show count + last-seen + affected schools.
  - Filters: school, role, route, severity, time range.
  - Row detail drawer: stack trace, user, route, browser, "Mark resolved", "Open impersonation" (→ item 2).
- Add server-side errors too: shared helper `logEdgeError()` used by all edge functions, writing to same table with `source='edge'`.
- Add sidebar entry under Super → "Error Console".

**Success test:** trigger a bad request as a student, see it appear in Super console within 2 seconds, tagged with that school.

---

## 2. "Login as school admin" impersonation with audit trail

**What you get:** open any school's admin portal exactly as their principal sees it, read-only or read-write, with every action logged.

**Build**
- Table `public.impersonation_sessions` (id, super_user_id, target_user_id, school_id, reason, started_at, ended_at, mode ['read'|'write'], actions jsonb[]).
- Edge function `super-impersonate`:
  - Verifies caller is super admin.
  - Requires `reason` (min 10 chars) — enforced.
  - Mints a short-lived (30 min) JWT scoped to target user via admin API; returns session URL.
  - Inserts row into `impersonation_sessions`.
- On the app side: `ImpersonationBanner.tsx` — sticky red bar shown when `sessionStorage.impersonating=true`: "You are viewing as {name} @ {school}. Reason: …  [End session]".
- Client middleware: while impersonating, write every mutation to the session's `actions[]` array.
- Super page `Impersonation.tsx`: list past/active sessions with full audit; "End all active".
- Add "Impersonate admin" button on `super/SchoolDetail.tsx` and from Error Console rows.

**Guardrails:** default mode = read; write mode requires typing school name to confirm; auto-expire after 30 min; email notification to the real admin ("A support engineer accessed your account for reason: …").

---

## 3. Feature flags with staged rollout

**What you get:** ship risky features to 1 school → 10% → everyone, and kill switches when something breaks.

**Build**
- Table `public.feature_flags` (key, description, default_enabled, rollout_pct, enabled_schools uuid[], disabled_schools uuid[], updated_at).
- RPC `flag_enabled(_key text, _school_id uuid) → bool` using stable hash(school_id + key) < rollout_pct.
- Client hook `useFlag('bus_tracking_v2')`; server helper `flagEnabled()` for edge functions.
- Super page `super/FeatureFlags.tsx`:
  - Table of all flags, inline toggle for global, slider for %, add/remove schools.
  - "Kill switch" red button = set rollout_pct=0 immediately.
- Seed initial flags for existing risk areas: `ai_essay_marking`, `bus_realtime`, `exam_lockdown_v2`.

**Success test:** turn `bus_realtime` on for one pilot school only; other schools see the old view; flip global on when confident.

---

## 4. Per-school AI usage quotas (enforced)

**What you get:** no single school can burn your entire AI budget by looping a script.

**Build (mostly wiring existing pieces)**
- Table `school_ai_quotas` already exists (see `AISettings.tsx`) with `monthly_token_cap`, `monthly_cost_cap_usd`, `tokens_used`, `cost_used_usd`.
- What's missing: **hard enforcement** in `_shared/ai-call.ts`.
  - Before each call: `SELECT enabled, caps, used FROM school_ai_quotas`.
  - If disabled or over cap → return sanitized error `"AI features are paused for your school this month. Contact your admin."` (user-safe).
  - After each call: increment `tokens_used` + `cost_used_usd` atomically via RPC `bump_ai_usage(school_id, tokens, cost)`.
- Cron edge function `ai-quota-alerts` (daily): email admin at 70% / 90% / 100%.
- Super view `super/AIUsage.tsx`: table of every school's usage this month, sortable, red highlight at ≥90%.
- Super can override cap per-school (temp bump for a paying school).

**Success test:** set cap to 100 tokens on a test school → next AI call returns the friendly pause message; super sees the school flagged red.

---

## 5. Sentry integration (external error tracking)

**What you get:** professional-grade alerts, release tracking, and stack traces you can share with contractors — free up to 5k errors/month.

**Build**
- Add secret `SENTRY_DSN` (I'll prompt you when starting).
- `bun add @sentry/react`.
- Init in `src/main.tsx` after `installGlobalErrorReporter()`:
  - `beforeSend` runs the message through `error-sanitizer` — never send raw stack traces that contain user emails or tokens.
  - `tracesSampleRate: 0.1`, `environment` from `import.meta.env.MODE`, `release` from git SHA.
  - Tag every event with `school_id`, `role`, `route`.
- Edge functions: init `@sentry/deno` in a shared helper, wrap every function handler.
- Set up Slack/email alerts in Sentry dashboard (out of scope for code — I'll give you the checklist).

**Success test:** throw a test error, see it in your Sentry dashboard within 30s with school tag.

---

## Order of work & rollout

1. Item 1 (Error Console) — highest leverage, no risk.
2. Item 4 (AI Quotas enforcement) — protects your wallet immediately.
3. Item 3 (Feature Flags) — needed before items 2 & 5 go live safely.
4. Item 5 (Sentry) — 30 min once DSN is added.
5. Item 2 (Impersonation) — most sensitive, ship last behind a flag.

---

## Technical notes (for reference)

- All new admin surfaces go under `src/pages/super/` and are registered in existing Super sidebar in `SuperLayout.tsx`.
- RLS on every new table: super-admin-only for `impersonation_sessions`, `feature_flags`; per-school for `school_ai_quotas`; append-only for `client_errors`.
- Every new table follows the standard `GRANT SELECT/INSERT ON … TO authenticated` + `GRANT ALL … TO service_role` pattern.
- Impersonation JWT minting uses the service role inside the edge function only — never client-side.
- Sentry DSN is a publishable value, but we still store it as a secret so it's not baked into the git history.

---

## What I need from you before starting

- Confirm you want these 5 in this order (or reorder).
- For item 5: a Sentry account (free tier) so you can hand me the DSN when I ask.
- For item 2: confirm the 30-min session length and the "email the admin" notification behavior — some SaaS teams prefer silent access for security investigations.
