# Exam & CBT Redesign — Student Portal

Goal: make the exam and practice screens feel like a purpose-built testing appliance — calm, dense where it matters, zero chrome that competes with the question.

## Screens in scope
- `MockPicker` (choose WAEC/NECO/UTME practice)
- `MockRunner` + `ExamInterface` (the live CBT runner)
- `TradExamRunner` (school paper runner)
- `MockResult` / `ExamReview` (post-exam)
- `Practice` (untimed study)

## The redesign

### 1. Exam Lobby (replaces the current picker)
A single pre-flight card instead of a form: exam board, subject, question count, duration, and a readiness checklist (fullscreen, connection, camera if proctored). One large "Start" action. Recent attempts shown as compact score chips underneath so students see progress before they start.

### 2. Runner shell — three fixed zones
```text
┌──────────────────────────────────────────────┐
│  subject · Q7/40      ◍ 24:13     [Submit]   │  slim command bar
├───────────────────────────────┬──────────────┤
│                               │  palette     │
│      QUESTION CANVAS          │  1..40 grid  │
│      (max ~720px, large       │  legend:     │
│       readable type)          │  answered /  │
│                               │  flagged /   │
│      options as tall          │  unseen      │
│      tap targets A–D          │              │
│                               │  [Flag]      │
├───────────────────────────────┴──────────────┤
│  ← Prev              Next →                  │  persistent footer
└──────────────────────────────────────────────┘
```
- Timer becomes the existing `TimerRing` (already built) in the command bar — colour shifts amber under 5 min, red under 1 min.
- Palette moves to a right rail on desktop, collapses to a bottom sheet on mobile (thumb-reachable), instead of sitting below the question.
- Options get single-key shortcuts (A–D, arrows, F to flag, Enter to advance) with a discreet hint row.
- Autosave status ("Saved") replaces silent persistence so students trust it.

### 3. Question canvas polish
- Larger question type scale, generous line-height, math rendered via the existing `Math` component so equations stop showing raw `$...$`.
- Diagrams get a click-to-zoom lightbox rather than a fixed 256px cap.
- Selected option: filled accent + check affordance, not just a tint.
- Flag/bookmark per question, surfaced in the palette and in the submit dialog.

### 4. Submit flow
Replace the plain confirm with a summary sheet: answered / unanswered / flagged counts, unanswered numbers listed as jump links, then confirm. Time-up auto-submit shows the same summary read-only.

### 5. Results & review
- Result screen leads with a score ring, then per-topic accuracy bars so the student knows what to revise.
- Review lists questions with correct/chosen side by side, explanation collapsed by default, filter chips: All / Wrong / Flagged.

### 6. Practice mode
Reframed from a file list into "Study" cards with subject grouping, plus an untimed practice runner that reuses the same canvas (no timer, instant feedback per question).

## Technical notes
- Extract shared runner pieces into `src/components/exam/`: `ExamCommandBar`, `QuestionCanvas`, `OptionList`, `QuestionPalette`, `SubmitSummaryDialog`. `MockRunner`, `ExamInterface` and `TradExamRunner` all consume them — this also removes the current triplication of runner logic.
- Reuse existing `TimerRing` and `Math`; no new deps.
- All colour via semantic tokens; add `--exam-answered` / `--exam-flagged` tokens in `index.css` so light and dark both read cleanly.
- No backend, RLS, scoring, or proctoring logic changes — presentation layer only.

## Suggested order
1. Shared components + tokens
2. Runner shell (MockRunner, then ExamInterface, then TradExamRunner)
3. Submit summary + results/review
4. Lobby + practice
