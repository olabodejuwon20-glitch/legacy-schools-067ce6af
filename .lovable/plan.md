## Legacyskool Communication Hub — Upgrade Plan

This refactors the existing messaging/announcement/support stack into one cohesive "Communication" workspace. **No data loss, no breaking changes.** Existing `messages`, `conversations`, `conversation_messages`, `announcements`, `platform_announcements`, `parent_comms`, `support_tickets`, and notifier realtime continue to work as-is — we layer on top.

---

### Phase 0 — Foundation (no schema risk)

1. **New module** `communication-hub` in `src/modules/registry.ts` replacing scattered entries:
   - Today: `messages`, `announcements`, `parent-comms` (teacher), `teacher-comms` (parent), Inbox (shared), Support (super only).
   - After: a single "Communication" group with sub-routes, role-filtered. Old slugs stay as aliases so existing links/bookmarks keep working.
2. **Shell layout** `src/pages/comms/Hub.tsx` — Slack-style 3-pane: left rail (channels/sections), middle list, right reading pane. Mobile responsive (stacked drawers via existing `Sheet`).
3. **Shared primitives** in `src/components/comms/`: `ChannelList`, `MessageThread`, `Composer` (reuses existing `MessagesPanel` logic), `UnreadBadge`, `PresenceDot`, `TemplatePicker`.

### Phase 1 — Unified Inbox & DMs

- **Unified Inbox**: merges DMs + announcements + parent comms + ticket replies + system notifications into one feed. Backed by a view `v_inbox_items` UNION across existing tables (read-only, RLS via underlying tables — no new auth surface).
- **Search/filters**: client-side over fetched window + server `ilike` for older. Filter chips: Unread, Starred, Archived, by role, by channel.
- **Starred/Archived**: extend `conversation_participants` (already has `archived`, `muted`) — add `starred boolean default false` column. Add `inbox_stars` table for non-conversation items (announcements, tickets).
- **Read receipts**: already have `conversation_participants.last_read_at` + `messages.read_at`. Surface them in UI.
- **Attachments**: existing `attachments jsonb` on `conversation_messages` — add upload via existing storage buckets; new bucket `comms-attachments` with RLS scoped to participant membership.

### Phase 2 — Class & Subject Channels

- **Auto-provisioned channels**: on `classes` insert (and backfill), create a `conversations` row with `kind='group'`, `title='SS1A'`, `metadata={ source: 'class', class_id }`. Participants synced from `class_enrollments` + `class_subject_teachers` via trigger.
- **Subject channels**: same pattern keyed by `(class_id, subject)` from `class_subject_teachers`.
- **No new messages table** — channels = `conversations` with a tag. RLS already enforces participant-only reads.
- **Parent Communication Center**: surfaces existing `parent_comms` + auto-generated alerts (attendance/results/fees/behavior) from already-existing tables. New `comms_templates` table for reusable message templates (admin/teacher managed).

### Phase 3 — Broadcast, Tickets, AI

- **Broadcast Center** (admin): wraps existing `announcements` + new `broadcast_jobs` table for scheduling, audience targeting (role/class/level/users), delivery channels (in-app now, email/SMS stubs ready), and delivery stats (`broadcast_deliveries`). Reuses existing `notify-recipients` edge function.
- **Scheduled Messages**: same `broadcast_jobs.send_at` powers DM/announcement scheduling. Cron via existing `automation-runner`.
- **Support Tickets**: existing `support_tickets`/`support_messages` already work for super admin — extend to school-scoped tickets with categories (`academic`, `result`, `payment`, `technical`, `admission`) and status workflow. Add school-admin policies.
- **AI Assistant**: extend `principal-copilot` edge function with new intents: `draft_message`, `improve_tone`, `translate`, `summarize_thread`, `generate_announcement`. UI: a "✨ AI" button in Composer.

### Super Admin Communication Center

- Extends existing `platform_announcements`: new audience targeting UI (all schools / selected schools / by plan / by status). Existing RLS unchanged.

### Communication Analytics

- New `comms_events` table (insert-only) capturing send/read/click. Lightweight aggregation view for: messages sent/received, read rates, parent engagement %, teacher avg response time, top channels. New `/communication/analytics` page reusing `recharts`.

---

### Routing & sidebar (addresses your "40+ routes" concern)

Collapse to **one parent route `/app/:role/communication`** with nested child routes:
```
/communication              → Inbox (default)
/communication/dm/:convId   → Direct messages
/communication/channels/:id → Class/Subject channel
/communication/announcements
/communication/broadcasts   (admin)
/communication/tickets
/communication/templates    (admin/teacher)
/communication/scheduled
/communication/analytics    (admin)
/communication/notifications
```
Old routes (`/messages`, `/announcements`, `/parent-comms`, `/teacher-comms`, `/inbox`) become **redirects** — zero breakage.

---

### Database changes (single migration, additive only)

1. `ALTER TABLE conversation_participants ADD COLUMN starred boolean DEFAULT false;`
2. `ALTER TABLE conversations ADD COLUMN metadata jsonb DEFAULT '{}'::jsonb, ADD COLUMN channel_type text;` (`'dm' | 'class' | 'subject' | 'group' | 'broadcast'`)
3. New tables (all RLS + GRANTs + tenant-scoped): `comms_templates`, `broadcast_jobs`, `broadcast_deliveries`, `comms_events`, `inbox_stars`, `support_ticket_categories`.
4. Triggers: auto-create class/subject channels on `classes` / `class_subject_teachers` insert; sync participants on enrollment changes.
5. Backfill function `comms_backfill_channels()` run once.

### Multi-tenant guarantee

Every new table has `school_id uuid not null` + RLS policy `using (is_member(school_id, auth.uid()))`. Broadcasts/channels never cross schools. Verified via existing `is_member`/`is_school_admin`/`has_school_role` helpers.

### Backward compatibility checklist

- ✅ `messages` table untouched (DM legacy path keeps working)
- ✅ `conversations`/`conversation_messages` only get additive columns
- ✅ `announcements`, `parent_comms`, `support_tickets` unchanged
- ✅ `RealtimeNotifier` keeps firing on `messages` INSERT
- ✅ Old sidebar slugs remain registered as hidden aliases for one release
- ✅ `MessagesPanel` becomes a thin wrapper around new `MessageThread`

---

### Delivery order (so you can ship incrementally)

| Step | Scope | Risk |
|---|---|---|
| 1 | Migration (additive cols + new tables + RLS + GRANTs) | low |
| 2 | Hub shell + sidebar consolidation + redirects | low |
| 3 | Unified Inbox + DMs (wraps existing) | low |
| 4 | Class/Subject channels + backfill | medium |
| 5 | Broadcast Center + Scheduled + Templates | medium |
| 6 | Tickets workflow + Parent Comm Center | low |
| 7 | AI assistant intents in Copilot | low |
| 8 | Analytics dashboard | low |

I'll execute Step 1 + Step 2 in the first batch after approval, then proceed sequentially with check-ins.

---

### On your route-count question

40+ routes is **fine** for a multi-role SaaS — Notion, Linear, and Teams have hundreds. What matters is:
1. **Grouping** by domain (this plan reduces Communication from 5 top-level entries to 1 with children).
2. **Role-based filtering** at the sidebar level (already done via `roles` in `MODULE_MANIFESTS`).
3. **Lazy loading** route components (consider `React.lazy` for heavy admin pages in a later pass).

After this consolidation you'll drop ~6 sidebar entries and gain a cleaner mental model.

Approve to proceed with Step 1 (migration) + Step 2 (hub shell).