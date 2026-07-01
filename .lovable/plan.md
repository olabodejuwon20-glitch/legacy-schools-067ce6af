# SaaS Operations Foundation

Build the internal tooling that lets you run LegacySkool like a professional SaaS: catch bugs before users complain, fix one school without touching others, control costs, and roll out risky changes safely.

Five modules, built in order. Each is independently useful — you can stop after any step.

---

## 1. Live Error Console (Super Admin)

**Goal:** See every error happening across every school, in real time, grouped so you're not drowning in duplicates.

**What you get:**
- New page at `/app/super/errors` showing a live feed of client + edge function errors.
- Errors are **grouped by fingerprint** (same error + same file + same line = one row with a count), not one row per occurrence.
- Filters: school, role (student/teacher/admin/parent), route, browser, time range, resolved/unresolved.
- Click a group → see all occurrences, stack trace, affected users, breadcrumb of what they did before it broke.
- Mark as **Resolved** / **Ignored** / **Investigating** with a note. Resolved errors auto-reopen if they happen again after the fix.
- Realtime badge in the sidebar showing unresolved error count (red if new errors in last 5 min).

**Technical:**
- Extend `client_errors` table: add `role`, `browser`, `os`, `fingerprint`, `occurrence_count`, `first_seen_at`, `last_seen_at`, `resolved_at`, `resolved_by`, `resolution_status`, `resolution_note`.
- Add a `report_client_error` RPC that computes fingerprint (hash of message + top stack frame) and upserts, incrementing count.
- Global `window.onerror` + React ErrorBoundary + edge function try/catch → send to RPC. User never sees the technical error (already sanitized in earlier work), but you see everything.
- Enable Supabase Realtime on `client_errors` for the super admin dashboard.

---

## 2. School Impersonation ("Login as")

**Goal:** When a school reports "my dashboard is broken," you log in as their admin, reproduce the bug, fix it — without asking them for passwords or breaking anything for other schools.

**What you get:**
- On any school row in `/app/super/schools`, an **"Impersonate"** button (super admin only).
- Opens a modal: pick which admin/teacher/student to log in as, type a reason (required — auditing), duration (default 30 min, max 4 hours).
- New browser tab opens with you logged in as that user. A red banner across the top: **"IMPERSONATING [name] at [school]. End session"**.
- Everything you do is logged to `impersonation_sessions` with before/after diffs on any writes.
- Auto-expires after the duration. School admin gets a notification that a support session happened (transparency).

**Technical:**
- New `impersonation_sessions` table (super_admin_id, target_user_id, school_id, reason, started_at, expires_at, ended_at, actions_jsonb).
- Edge function `start-impersonation` — verifies caller is super admin, mints a scoped JWT with a custom claim `impersonated_by`, logs the session.
- Client detects the claim and shows the red banner + tracks writes.
- All existing RLS keeps working because you're using a real session for that user.

---

## 3. Feature Flags & Staged Rollouts

**Goal:** Ship risky features to 1 school first, then 10, then everyone. Kill a broken feature instantly without a redeploy.

**What you get:**
- New page `/app/super/feature-flags` — list of flags with toggles.
- Each flag: name, description, status (off / on / rollout), target rules (all schools / specific schools / % rollout / specific plan tier).
- Global kill switch per flag — flip to off, everyone loses access in <5 seconds.
- Code uses `useFeatureFlag('new-bus-tracking-v2')` hook — returns true/false per current school.
- Audit log of every flag change (who, when, from/to).

**Technical:**
- Extend `feature_flags` table + new `feature_flag_targets` for per-school/percentage rules.
- `resolve_feature_flag` RPC — takes flag key + school_id, returns boolean. Cached client-side for 60s.
- Realtime subscription for instant kill-switch.

---

## 4. Per-School AI Quotas & Cost Guardrails

**Goal:** One school can't burn your entire AI budget. Costs are predictable and capped.

**What you get:**
- Per-school monthly quota (tokens or ₦ cost) — set default per plan tier (Basic/Standard/Premium), override per school.
- Live meter in `/app/super/schools/[id]` showing usage this month + burn rate.
- When a school hits 80% → email their admin. At 100% → AI calls return a friendly "monthly AI limit reached" message (not a crash).
- Per-model routing (already built in `ai_model_routing`) is respected — cheap models for cheap tasks stays enforced.
- Super admin can grant a one-time top-up.

**Technical:**
- Extend `school_ai_quotas`: `monthly_limit_tokens`, `monthly_limit_cost_ngn`, `current_period_start`, `current_usage_tokens`, `current_usage_cost`, `alert_sent_at`.
- Atomic `consume_ai_quota` RPC called by every AI edge function before the model call. Uses `FOR UPDATE` lock so parallel requests can't overshoot.
- Nightly cron resets quotas at start of new billing period.
- Simple graph in the school detail page (last 30 days usage).

---

## 5. Sentry Integration (Professional Error Tracking)

**Goal:** Your Live Error Console (step 1) shows what's happening now. Sentry gives you deep post-mortem tooling — stack traces with source maps, release tracking, alerts to email/Slack, performance monitoring.

**What you get:**
- Sentry captures every client + edge function error automatically.
- Source maps uploaded on every deploy → stack traces show your actual code, not minified junk.
- Email/Slack alert when: new error type appears, error spike (10x normal rate), specific school crosses error threshold.
- Session replay on errors — watch a video of what the user did before it broke.
- Tag every event with `school_id`, `role`, `plan_tier` — filter and alert per school.

**Technical:**
- Add `@sentry/react` + `@sentry/node` (for edge functions).
- Requires Sentry account (free tier: 5k errors/month — plenty for launch). I'll walk you through it and need a DSN.
- Environment-aware: only ships events from production, not preview.
- Also forwards to our own `client_errors` table so step 1 still works offline.

---

## Order & rough scope

1. **Live Error Console** — 1 build session. Immediate value. No external accounts needed.
2. **Impersonation** — 1 session. Second most valuable, unlocks real support.
3. **Feature Flags** — 1 session.
4. **AI Quotas** — 1 session.
5. **Sentry** — needs your Sentry account first.

Say **"start"** and I'll build #1. Or say a number to jump to that one.
