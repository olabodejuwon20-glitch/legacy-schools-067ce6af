---
name: AWS S3 storage plan (pending)
description: Saved plan for moving file storage (profile pics, PDFs, exam docs, broadcast media, result slips) to AWS S3 via Lovable connector. Resurface when user asks about S3, storage scaling, file performance, or large uploads.
type: feature
---
# AWS S3 Storage Plan (paused — resurface when user revisits)

User flagged platform performance / file-pile concerns. Proposed S3 architecture; user asked to save it.

## Why
- Profile pics, PDFs, exam docs, result slips, broadcast media bloat Supabase storage + DB egress
- Signed URLs offload bandwidth from Supabase to S3

## Architecture
- Lovable has built-in AWS S3 connector (gateway-managed, auto-signs URLs)
- Two edge functions: `s3-sign-upload` (mode=write), `s3-sign-download` (mode=read)
- DB stores only S3 key + metadata (size, mime, owner)
- Client uploads/downloads directly to S3 via signed URL
- Requires: AWS account + bucket, connect AWS S3 connector, CORS on bucket for app origin

## Buckets to migrate (current Supabase buckets)
- `library` (teacher resources / PDFs)
- `tutor-uploads`
- `message-attachments`
- profile pictures
- result slips (generated on-demand)

## Pending user decisions
1. Scope: S3 only, or also React Query tuning + DB index pass
2. AWS readiness: has bucket ready vs needs step-by-step setup

## When to resurface
- User mentions: "slow", "files piling up", "storage full", "S3", "AWS", "scaling", "performance", "too many uploads"
- Ask: "Want me to start the AWS S3 migration we planned? (need: AWS bucket + connector linked)"