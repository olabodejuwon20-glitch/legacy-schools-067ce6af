
# Per-school installable app (white-label)

Goal: when a school's portal is installed to a phone home screen, the icon and label show **that school's name and logo** instead of "Legacyskool".

## Scope

Two install paths, same source of truth (the school's branding in the database):

1. **Installable web app (PWA)** — shipped now. Each school portal URL (`/:slug`) serves its own dynamic manifest, icon and head tags. Parents/students "Add to Home Screen" and see the school's name + logo.
2. **Native app (Capacitor) per school** — documented + scaffolded so a school that wants their own App Store / Play Store listing can be built from the same branding. This is heavy ongoing work (one build, one developer account, one store review per school), so we ship the foundation, not 1000 stores listings.

## What the admin sees

In **Admin → Settings → Branding**, add a new "App install" card:

- **App display name** (new field, max 12 chars recommended) — what shows under the home-screen icon. Defaults to a trimmed version of the school name.
- **Short description** — optional, used as the install prompt subtitle.
- Live preview tile showing how the icon + label will look on a phone home screen.
- Reuses the existing **logo upload** for the icon (no second upload).
- A note: "Already installed users may need to reinstall after changing this — phones cache the name and icon at install time."

Stored on `schools.settings` (JSON) as `app_install: { display_name, short_description }` — no new table needed.

## How the PWA per-school name works

Today `index.html` references a single static `/manifest.webmanifest` with "Legacyskool". We replace this with a per-tenant dynamic manifest:

1. **Dynamic manifest route** — a small edge function `school-manifest` at `/manifest/:slug.webmanifest` that reads the school's name, app display name, logo URL and theme color, then returns a fully-formed manifest JSON with:
   - `name`, `short_name` from the admin field
   - `icons[]` pointing at the school logo (resized via existing storage)
   - `theme_color` from the school's report theme
   - `start_url` = `/:slug/app`
   - `scope` = `/:slug/`
   - `id` = `/:slug/` (so each school is a distinct installable app on the device)

2. **Per-tenant head tags** — on every school route (`/:slug/*`), a small `<TenantHead>` component (uses the existing `react-helmet-async` setup) injects:
   - `<link rel="manifest" href="/manifest/<slug>.webmanifest">`
   - `<link rel="apple-touch-icon" href="<logo>">`
   - `<meta name="apple-mobile-web-app-title" content="<app display name>">`
   - `<meta name="theme-color" content="<primary>">`
   - Title prefix swapped to the school name

3. **Fallback** — visitors on `/` (the platform marketing site) still see the existing Legacyskool manifest and icon. Only school portal routes get the tenant manifest.

4. **Generated icons** — the manifest references the school's already-uploaded logo through an image transform URL (192px and 512px). If a school hasn't uploaded a logo, fall back to a generated initials tile so install never breaks.

## Native (Capacitor) per-school — foundation only

Add `docs/WHITE_LABEL_NATIVE.md` that documents the supported flow when a school asks for their own store app:

- Fork the repo branch per school (or use a single branch with env-driven config).
- `capacitor.config.ts` is parameterized by env vars: `APP_ID`, `APP_NAME`, `APP_ICON_PATH`, `START_URL` (their `/:slug` portal).
- Build script `scripts/build-school-app.mjs` reads a `school-build.json` (name, slug, icon, splash, bundle id) and writes the Capacitor config + copies icons into `android/` and `ios/` resource folders before `cap sync`.
- Each school needs their own Apple Developer + Google Play account (legal requirement); we cannot share one publisher across unrelated schools.

We don't add per-school store automation — just the parameterized config so any school that requests it can be built and shipped without code changes.

## What changes in code

```text
supabase/functions/school-manifest/index.ts      new — dynamic manifest per :slug
src/components/TenantHead.tsx                    new — injects per-school head tags
src/pages/admin/Settings.tsx                     add "App install" card under Branding
src/lib/reportCard.ts / branding helpers         expose app_install fields
src/App.tsx or src/layouts/AppLayout.tsx         mount <TenantHead/> on /:slug/* routes
index.html                                       keep platform manifest as fallback only
capacitor.config.ts                              env-driven (APP_ID/APP_NAME/icons)
scripts/build-school-app.mjs                     new — per-school native build helper
docs/WHITE_LABEL_NATIVE.md                       new — store-publishing guide
```

No schema migration is needed — the new settings go into the existing `schools.settings` JSON.

## Caveats I'll surface in the UI

- **Renaming after install** doesn't update phones that already installed the app — they must reinstall. Shown as a note next to the field.
- **iOS** shows `short_name` (≤12 chars works best), so we cap and preview the trimmed value live.
- **Native store apps** require each school to own their developer accounts; this is unavoidable.

## Out of scope (ask if you want any of these next)

- Per-school custom domains (e.g. `app.greenfield.edu` instead of `legacy-schools.lovable.app/greenfield`).
- Auto-generating store screenshots / listing copy.
- Push notifications branded per school (separate workstream — needs FCM keys per app).
