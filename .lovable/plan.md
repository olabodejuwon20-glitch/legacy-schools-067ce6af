
# Performance Optimization Plan

Based on live DB metrics (`slow_queries` + `db_health`) and a scan of the codebase. Compute is healthy (58% mem, 5/60 conns) — the pain is **query patterns and client chatter**, not capacity. Fix those and both cost and UX improve.

## Findings (by real impact)

| # | Symptom | Evidence |
|---|---|---|
| 1 | `mock_questions` full-table scan — no WHERE, no pagination | 34 calls, **495 ms avg**, 742 ms max |
| 2 | `page_views` inserts firing on every navigation | **3,784 calls**, 8.2 s total |
| 3 | `auth_events` inserts too chatty | **3,125 calls**, 8.3 s total |
| 4 | `profiles` single-row select repeated per render | **7,638 calls** |
| 5 | `memberships` re-fetched across pages | 6,057 + 1,576 calls |
| 6 | `school_modules` joined on every route mount | 1,396 calls |
| 7 | `results` selected without student/exam filter | 418 calls, 15 ms avg |
| 8 | 39,316 rolled-back txns since boot — likely RLS denials from stale sessions | db_health |
| 9 | Single JS bundle (~3.2 MB) — no manual code splitting; 271 pages/components all eager | vite.config |

## Fixes

### A. Database (migrations)
1. **`mock_questions`** — add app-side pagination (`.range()`) and require `subject_id`/`session_id` filter. Add composite index `(subject_id, created_at DESC)`.
2. **`results`** — audit call sites; add index `(student_id, exam_id)` and stop selecting the whole table.
3. **`page_views` / `auth_events`** — add `(school_id, created_at DESC)` indexes only if we query them; primary win is on the client (below).
4. **`memberships`** — confirm index on `(user_id, status)` exists; add if missing.

### B. Client — cut request volume
5. **Batch analytics**: buffer `page_views` and `auth_events` writes in a queue, flush every 10 s or on `visibilitychange`. Cuts ~7k inserts/day to ~500.
6. **Cache profile + memberships** in React Query with `staleTime: 5 min`, keyed on `userId`. Add a single `useSession()` hook that everything reads from — eliminates the 7,638 profile fetches.
7. **Cache `school_modules`** in React Query with `staleTime: 10 min` (rarely changes).
8. **Debounce realtime status pings** and drop duplicate `auth_events` on the same session.

### C. Client — reduce re-renders
9. Wrap heavy list rows (results tables, question lists, roster tables) in `React.memo`; stabilise handlers with `useCallback`.
10. Replace `useState`+`useEffect` data fetches with `useQuery` where still lingering (found in a handful of admin pages).
11. Split large context providers (Auth + Tenant + Theme) so tenant/theme changes don't re-render the auth tree.

### D. Bundle
12. Convert route imports in `src/App.tsx` to `React.lazy` for `admin/*`, `super/*`, `driver/*`, `parent/*`, `teacher/*`, `student/*` groups. Wrap in `<Suspense>` with the existing skeleton.
13. Add `build.rollupOptions.output.manualChunks` in `vite.config.ts` for `react`, `@tanstack/react-query`, `recharts`, `pdf` libs, `mapbox/leaflet`. Target < 500 KB initial JS.
14. Lazy-load `exporters.ts` / `reportCard.ts` (pdf-lib is heavy) only when export buttons are clicked.

## Out of scope
- No functional changes, no UI redesign, no schema changes beyond indexes.
- Won't touch auth, RLS policies, or edge functions unless a specific query above requires it.

## Verification
- Re-run `slow_queries` after deploy — expect top 5 to drop by >70%.
- Check bundle report (`vite build`) — initial chunk under 500 KB.
- Spot-check console: no double-fetches of `profiles` / `memberships` on route change.
