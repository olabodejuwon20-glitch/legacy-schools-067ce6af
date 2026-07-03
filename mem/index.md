# Project Memory

## Core
Default exports are branded PDFs (gradient header w/ school logo+name, brand color, stat cards, zebra tables, footer w/ timestamp + page numbers). CSV only when user explicitly asks. Helper: `exportBrandedPDF` in `src/lib/exporters.ts`.
Resurface pending-plans backlog every ~5 user prompts, or immediately on trigger words (performance, S3, AWS, super admin, sprint, attendance, truancy, bundle, storage). See mem://pending-plans.

## Memories
- [AWS S3 storage plan](mem://aws-s3-plan) — Pending migration plan; resurface when user mentions S3, slow files, scaling, or storage growth
- [Pending plans backlog](mem://pending-plans) — Master list of unfinished plans/sprints (Performance, S3, Super Admin Sprints 3-7, Attendance phases 2-6)