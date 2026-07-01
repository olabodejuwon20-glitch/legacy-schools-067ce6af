# SEO Optimization Plan — Legacyskool

## 1. Audit summary (current state)

- `index.html` has decent title/description/OG/Twitter and Organization+WebSite+SoftwareApplication JSON-LD. Good baseline.
- `public/robots.txt` and `public/sitemap.xml` exist but are minimal (only `/`, `/signin`, `/register`).
- `SEO.tsx` exists but is only used on a few admin/hub pages — most public routes (Landing, Register, SignIn, Join, Bio, Privacy, Terms, Help, Refer, VerifyResult) have no per-route title/description/canonical.
- No `og:image` per route; a single sitewide preview image is set.
- No lazy-loading defaults on images; no `alt` audit performed.
- No breadcrumb JSON-LD, no FAQ JSON-LD on landing.
- `sitemap.xml` is hand-edited and stale.

## 2. What I'll implement

### A. Head metadata & per-route SEO
- Add `<SEO>` component (or Helmet) to every public route: `Landing`, `SignIn`, `Register`, `Join`, `Bio`, `Privacy`, `Terms`, `Help`, `Refer`, `VerifyResult`, `SchoolHome`, `NotFound` (with noindex).
- Each gets: unique `<title>` (<60 chars, keyword-front-loaded), `<meta description>` (<160 chars), self-referencing `<link rel="canonical">`, matching `og:title/description/url/type`, `twitter:card=summary_large_image`.
- Remove sitewide `<link rel="canonical">` from `index.html` once per-route canonicals are in place; keep sitewide OG as fallback for non-JS crawlers.
- Add `noindex` on auth-gated `/app/*` routes via a small `<Helmet><meta name="robots" content="noindex" /></Helmet>` in `AppLayout`.

### B. Structured data (JSON-LD)
- Keep Organization + WebSite + SoftwareApplication in `index.html`.
- Add `BreadcrumbList` JSON-LD helper used on Landing, Register, Help.
- Add `FAQPage` JSON-LD on Landing (from existing FAQ section if present, else add 4–6 school-focused Q&As).
- Add `WebSite` `potentialAction` SearchAction pointing at `/help?q={search_term_string}` if a search route exists — otherwise skip.

### C. Headings & semantic HTML
- Audit Landing, Register, SignIn, Help, Bio, VerifyResult and enforce one `<h1>` per page, logical `h2`/`h3` order, `<main>`, `<nav>`, `<footer>` landmarks where missing.

### D. Images: alt text + lazy loading
- Sweep `<img>` usage in `src/pages/Landing.tsx`, `src/components/landing/*`, marketing surfaces. Add descriptive `alt=""` (empty for decorative), `loading="lazy"` and `decoding="async"` on non-LCP images, `fetchpriority="high"` on the LCP hero image.
- Ensure `<img>` has explicit `width`/`height` to prevent CLS.

### E. Sitemap & robots
- Convert `public/sitemap.xml` → generator `scripts/generate-sitemap.ts` wired via `predev`/`prebuild` scripts. Entries: `/`, `/register`, `/signin`, `/join`, `/help`, `/privacy`, `/terms`, `/refer`, `/verify-result`. Base URL: `https://legacy-schools.lovable.app`.
- `robots.txt`: keep `Allow: /`, add `Disallow: /app/`, `Disallow: /super/`, `Disallow: /admin-signin`, keep `Sitemap:` line.

### F. Friendly URLs & canonicals
- Confirm all public routes use lowercase, hyphenated paths (already the case). Ensure canonical URLs strip query strings and trailing slashes consistently in the `SEO` component.

### G. Performance / Core Web Vitals
- Preload LCP hero image in `index.html` with `<link rel="preload" as="image" fetchpriority="high">` once identified.
- Add `loading="lazy"` to below-the-fold imagery.
- Confirm Google Fonts already preconnected (they are). Add `font-display: swap` via `&display=swap` (already present).
- Ensure heavy routes (`AdminHub`, exam simulations) remain code-split — verify no eager imports in `App.tsx` for admin/super pages; convert to `React.lazy` where missing.

### H. Accessibility (helps SEO)
- Add `aria-label` to icon-only buttons in landing/nav.
- Ensure form fields on `SignIn`/`Register`/`Join` have associated `<label>`s (audit and fix).
- Skip-to-content link on `Landing`.
- Color contrast: leave tokens as-is (already themed).

### I. Internal linking strategy
- Landing footer: link to `/help`, `/privacy`, `/terms`, `/refer`, `/register`, `/signin`, `/verify-result`.
- Register/SignIn: cross-link to each other and to Help.
- Help page: link back to Landing + Register with descriptive anchor text ("Create your school account", not "click here").
- Bio and VerifyResult: link to Landing with branded anchor.

## 3. Files to add/change

Add:
- `scripts/generate-sitemap.ts`
- `src/components/seo/JsonLd.tsx` (helper for BreadcrumbList / FAQPage)

Edit:
- `index.html` (preload LCP, remove sitewide canonical, add `Disallow` reflections not needed here)
- `public/robots.txt`
- `package.json` (`predev`/`prebuild` sitemap hooks)
- `src/pages/Landing.tsx`, `SignIn.tsx`, `Register.tsx`, `Join.tsx`, `Bio.tsx`, `Privacy.tsx`, `Terms.tsx`, `Help.tsx`, `Refer.tsx`, `VerifyResult.tsx`, `NotFound.tsx`, `SchoolHome.tsx` — add `<SEO>` + heading/alt/lazy fixes
- `src/layouts/AppLayout.tsx` — add `noindex` for authed area
- `src/components/landing/*` — alt text, lazy loading, LCP hints

Delete:
- `public/sitemap.xml` (replaced by generator output; generator writes back to same path pre-build)

## 4. Verification

- Build succeeds; `sitemap.xml` regenerated with all public routes.
- Manual check: each public route ships unique `<title>` and canonical.
- Trigger SEO scan after implementation to confirm findings clear.

Reply **go** to implement, or tell me what to adjust (skip sections, add pages, change base URL, etc.).
