# Project Memory

## Core
Default exports are branded PDFs (gradient header w/ school logo+name, brand color, stat cards, zebra tables, footer w/ timestamp + page numbers). CSV only when user explicitly asks. Helper: `exportBrandedPDF` in `src/lib/exporters.ts`.

## Memories
- [AWS S3 storage plan](mem://aws-s3-plan) — Pending migration plan; resurface when user mentions S3, slow files, scaling, or storage growth