// CSV + print-to-PDF helpers
export const escapeHtml = (v: any) => {
  const s = v === null || v === undefined ? "" : String(v);
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
};
export const safeHtml = escapeHtml;

export function downloadCSV(filename: string, rows: Array<Record<string, any>>) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function printToPDF(title: string, html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><title>${escapeHtml(title)}</title>
  <style>
    body{font-family:ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#0f172a;padding:32px;}
    h1{font-size:22px;margin:0 0 4px;} .sub{color:#64748b;font-size:12px;margin-bottom:24px;}
    table{width:100%;border-collapse:collapse;font-size:13px;margin-top:12px;}
    th,td{padding:8px 10px;border-bottom:1px solid #e2e8f0;text-align:left;}
    th{background:#f8fafc;font-size:11px;text-transform:uppercase;letter-spacing:.04em;color:#475569;}
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:18px;}
    .card{border:1px solid #e2e8f0;border-radius:10px;padding:12px;}
    .label{font-size:11px;color:#64748b;text-transform:uppercase;}
    .value{font-size:20px;font-weight:700;margin-top:2px;}
    @media print{ body{padding:16px;} }
  </style></head><body>${html}
  <script>window.onload=()=>{setTimeout(()=>window.print(),250);};</script>
  </body></html>`);
  w.document.close();
}

export function tableHTML(headers: string[], rows: Array<Array<string | number>>) {
  return `<table><thead><tr>${headers.map(h=>`<th>${escapeHtml(h)}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${escapeHtml(c)}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

// ----------------------------------------------------------------------------
// Branded PDF exporter — gradient header, school logo, stat cards, zebra
// tables, footer w/ timestamp + page numbers. Use for all user-facing exports.
// ----------------------------------------------------------------------------

export type BrandedSection =
  | { kind: "table"; heading?: string; headers: string[]; rows: Array<Array<string | number>> }
  | { kind: "html"; html: string };

export type BrandedPDFOptions = {
  title: string;
  subtitle?: string;
  schoolName?: string;
  schoolLogo?: string | null;
  brandColor?: string; // hex, default Legacy Schools indigo
  stats?: Array<{ label: string; value: string | number; hint?: string }>;
  sections?: BrandedSection[];
  /** Raw HTML body, appended after stats + sections. Optional. */
  body?: string;
  /** Footer note (e.g. "Confidential — for parent only"). */
  footerNote?: string;
  /** Role of the person generating/viewing the export (e.g. "Teacher"). */
  role?: string;
  /** Name of the person generating the export. */
  generatedBy?: string;
  /** Filters applied to produce this export (label/value pairs). */
  filters?: Array<{ label: string; value: string | number }>;
};

const sectionHTML = (s: BrandedSection) => {
  if (s.kind === "html") return s.html;
  const head = s.heading ? `<h3>${escapeHtml(s.heading)}</h3>` : "";
  return head + tableHTML(s.headers, s.rows);
};

const slugifyHeading = (s: string, i: number) =>
  `sec-${i}-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;

export function exportBrandedPDF(opts: BrandedPDFOptions) {
  const brand = opts.brandColor || "#4f46e5"; // indigo-600
  const brandDark = "#3730a3";
  const w = window.open("", "_blank", "width=960,height=760");
  if (!w) return;
  const generated = new Date().toLocaleString();
  const logoTag = opts.schoolLogo
    ? `<img src="${escapeHtml(opts.schoolLogo)}" alt="" crossorigin="anonymous" />`
    : `<div class="logo-fallback">${escapeHtml((opts.schoolName || "LS").slice(0, 2).toUpperCase())}</div>`;
  const coverLogoTag = opts.schoolLogo
    ? `<img src="${escapeHtml(opts.schoolLogo)}" alt="" crossorigin="anonymous" class="cover-logo" />`
    : `<div class="cover-logo logo-fallback">${escapeHtml((opts.schoolName || "LS").slice(0, 2).toUpperCase())}</div>`;

  // Assign anchor ids to table sections with headings so the TOC can link to them
  const sectionList = opts.sections || [];
  const headedSections = sectionList
    .map((s, i) => (s.kind === "table" && s.heading ? { heading: s.heading!, id: slugifyHeading(s.heading!, i) } : null))
    .filter(Boolean) as Array<{ heading: string; id: string }>;

  const sectionsHTML = sectionList.map((s, i) => {
    if (s.kind === "html") return s.html;
    const id = s.heading ? slugifyHeading(s.heading, i) : "";
    const head = s.heading ? `<h3 id="${id}">${escapeHtml(s.heading)}</h3>` : "";
    return head + tableHTML(s.headers, s.rows);
  }).join("");

  const filtersHTML = opts.filters?.length
    ? `<div class="cover-block">
        <div class="cover-block-title">Filters applied</div>
        <div class="cover-chips">${opts.filters.map(f =>
          `<span class="chip"><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`
        ).join("")}</div>
      </div>`
    : "";

  const tocHTML = headedSections.length > 1
    ? `<div class="cover-block">
        <div class="cover-block-title">Contents</div>
        <ol class="toc">${headedSections.map(h =>
          `<li><a href="#${h.id}">${escapeHtml(h.heading)}</a></li>`
        ).join("")}</ol>
      </div>`
    : "";

  const coverHTML = `
    <section class="cover">
      <div class="cover-bg"></div>
      <div class="cover-inner">
        <div class="cover-brand">
          ${coverLogoTag}
          <div class="cover-school">${escapeHtml(opts.schoolName || "Legacy Schools")}</div>
        </div>
        <div class="cover-title-wrap">
          <div class="cover-eyebrow">Official Report</div>
          <h1 class="cover-title">${escapeHtml(opts.title)}</h1>
          ${opts.subtitle ? `<p class="cover-sub">${escapeHtml(opts.subtitle)}</p>` : ""}
        </div>
        <div class="cover-meta-grid">
          ${opts.role ? `<div><div class="cover-meta-label">Role</div><div class="cover-meta-value">${escapeHtml(opts.role)}</div></div>` : ""}
          ${opts.generatedBy ? `<div><div class="cover-meta-label">Prepared by</div><div class="cover-meta-value">${escapeHtml(opts.generatedBy)}</div></div>` : ""}
          <div><div class="cover-meta-label">Generated</div><div class="cover-meta-value">${escapeHtml(generated)}</div></div>
        </div>
        ${filtersHTML}
        ${tocHTML}
        <div class="cover-footer">${escapeHtml(opts.footerNote || "Generated by Legacy Schools")}</div>
      </div>
    </section>
  `;

  const statsHTML = opts.stats?.length
    ? `<div class="stat-grid">${opts.stats.map(s => `
        <div class="stat">
          <div class="stat-label">${escapeHtml(s.label)}</div>
          <div class="stat-value">${escapeHtml(s.value)}</div>
          ${s.hint ? `<div class="stat-hint">${escapeHtml(s.hint)}</div>` : ""}
        </div>`).join("")}</div>`
    : "";
  const bodyHTML = opts.body || "";
  const footerNote = opts.footerNote || "Generated by Legacy Schools";

  w.document.write(`<!doctype html><html><head><meta charset="utf-8"/><title>${escapeHtml(opts.title)}</title>
  <style>
    :root{
      --brand:${brand};
      --brand-dark:${brandDark};
      --ink:#0f172a;
      --muted:#64748b;
      --line:#e2e8f0;
      --soft:#f8fafc;
    }
    *{box-sizing:border-box;}
    html,body{margin:0;padding:0;}
    body{font-family:'Inter',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:var(--ink);background:#fff;}
    .page{padding:0 36px 80px;}

    /* ---------- Cover page ---------- */
    .cover{position:relative;height:100vh;min-height:980px;page-break-after:always;overflow:hidden;color:#fff;}
    .cover-bg{position:absolute;inset:0;background:
      radial-gradient(1200px 600px at 110% -10%, rgba(255,255,255,.18), transparent 60%),
      radial-gradient(900px 500px at -10% 110%, rgba(255,255,255,.12), transparent 55%),
      linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%);}
    .cover-inner{position:relative;height:100%;display:flex;flex-direction:column;padding:56px 56px 48px;gap:28px;}
    .cover-brand{display:flex;align-items:center;gap:14px;}
    .cover-logo{width:64px;height:64px;border-radius:16px;object-fit:cover;background:#fff;color:var(--brand);
      display:flex;align-items:center;justify-content:center;font-weight:800;font-size:20px;letter-spacing:.04em;
      box-shadow:0 10px 24px -10px rgba(0,0,0,.45);}
    .cover-school{font-size:15px;font-weight:600;letter-spacing:.02em;opacity:.95;}
    .cover-title-wrap{margin-top:8px;}
    .cover-eyebrow{font-size:12px;text-transform:uppercase;letter-spacing:.18em;opacity:.85;margin-bottom:10px;}
    .cover-title{font-size:46px;line-height:1.08;margin:0 0 12px;font-weight:800;letter-spacing:-.02em;max-width:680px;}
    .cover-sub{font-size:16px;opacity:.92;margin:0;max-width:620px;line-height:1.5;}
    .cover-meta-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px;margin-top:8px;
      background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:16px 18px;backdrop-filter:blur(4px);}
    .cover-meta-label{font-size:10.5px;text-transform:uppercase;letter-spacing:.12em;opacity:.8;margin-bottom:4px;}
    .cover-meta-value{font-size:14px;font-weight:600;}
    .cover-block{background:rgba(255,255,255,.10);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:16px 18px;}
    .cover-block-title{font-size:11px;text-transform:uppercase;letter-spacing:.14em;opacity:.85;margin-bottom:10px;font-weight:600;}
    .cover-chips{display:flex;flex-wrap:wrap;gap:8px;}
    .chip{display:inline-flex;align-items:center;gap:6px;padding:6px 10px;border-radius:999px;
      background:rgba(255,255,255,.16);border:1px solid rgba(255,255,255,.22);font-size:12px;}
    .chip b{font-weight:600;opacity:.85;font-size:11px;text-transform:uppercase;letter-spacing:.06em;}
    .toc{margin:0;padding-left:20px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px 24px;}
    .toc li{font-size:13px;line-height:1.5;}
    .toc a{color:#fff;text-decoration:none;border-bottom:1px dashed rgba(255,255,255,.4);}
    .cover-footer{margin-top:auto;font-size:11px;opacity:.8;letter-spacing:.04em;border-top:1px solid rgba(255,255,255,.2);padding-top:14px;}

    /* gradient header */
    .hero{
      margin:0 -36px 24px;
      padding:28px 36px 24px;
      background:linear-gradient(135deg,var(--brand) 0%,var(--brand-dark) 100%);
      color:#fff;
      display:flex;align-items:center;gap:18px;
      border-bottom:4px solid rgba(255,255,255,.25);
    }
    .hero img,.logo-fallback{
      width:56px;height:56px;border-radius:14px;object-fit:cover;
      background:#fff;color:var(--brand);
      display:flex;align-items:center;justify-content:center;
      font-weight:800;font-size:18px;letter-spacing:.04em;
      box-shadow:0 8px 20px -8px rgba(0,0,0,.35);
    }
    .hero-text{flex:1;min-width:0;}
    .eyebrow{font-size:11px;text-transform:uppercase;letter-spacing:.14em;opacity:.85;margin-bottom:4px;}
    .hero h1{font-size:24px;margin:0 0 4px;font-weight:700;letter-spacing:-.01em;}
    .hero .sub{font-size:13px;opacity:.92;margin:0;}
    .hero-meta{text-align:right;font-size:11px;opacity:.85;line-height:1.5;}

    h3{font-size:14px;text-transform:uppercase;letter-spacing:.08em;color:var(--brand-dark);margin:26px 0 10px;font-weight:700;}

    /* stat cards */
    .stat-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:4px 0 18px;}
    .stat{
      border:1px solid var(--line);border-radius:14px;padding:14px 16px;
      background:linear-gradient(180deg,#fff,#f8fafc);
      position:relative;overflow:hidden;
    }
    .stat::before{
      content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--brand);
    }
    .stat-label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;}
    .stat-value{font-size:22px;font-weight:700;margin-top:4px;color:var(--ink);}
    .stat-hint{font-size:11px;color:var(--muted);margin-top:2px;}

    /* tables */
    table{width:100%;border-collapse:separate;border-spacing:0;font-size:12.5px;margin-top:8px;border:1px solid var(--line);border-radius:12px;overflow:hidden;}
    th,td{padding:10px 12px;text-align:left;}
    thead th{
      background:var(--brand);color:#fff;font-size:11px;
      text-transform:uppercase;letter-spacing:.06em;font-weight:600;
      border-bottom:1px solid var(--brand-dark);
    }
    tbody tr:nth-child(even) td{background:var(--soft);}
    tbody td{border-top:1px solid var(--line);color:var(--ink);}

    /* legacy compatibility for old .grid/.card/.value markup */
    .grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:4px 0 18px;}
    .card{border:1px solid var(--line);border-radius:14px;padding:14px 16px;background:linear-gradient(180deg,#fff,#f8fafc);position:relative;overflow:hidden;}
    .card::before{content:"";position:absolute;left:0;top:0;bottom:0;width:4px;background:var(--brand);}
    .label{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:var(--muted);font-weight:600;}
    .value{font-size:22px;font-weight:700;margin-top:4px;color:var(--ink);}

    /* footer */
    .footer{
      position:fixed;left:0;right:0;bottom:0;
      padding:10px 36px;font-size:10.5px;color:var(--muted);
      border-top:1px solid var(--line);background:#fff;
      display:flex;justify-content:space-between;align-items:center;
    }
    .footer .accent{color:var(--brand-dark);font-weight:600;}

    @page{margin:14mm 0 18mm;}
    @media print{
      .page{padding:0 18mm 24mm;}
      .hero{margin:0 -18mm 18px;padding:22px 18mm 18px;}
      .footer{padding:8px 18mm;}
      .cover{height:auto;min-height:auto;page-break-after:always;}
      .cover-inner{min-height:248mm;padding:24mm 18mm;}
      .cover-title{font-size:40px;}
    }
  </style></head><body>
    ${coverHTML}
    <div class="page">
      <header class="hero">
        ${logoTag}
        <div class="hero-text">
          <div class="eyebrow">${escapeHtml(opts.schoolName || "Legacy Schools")}</div>
          <h1>${escapeHtml(opts.title)}</h1>
          ${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ""}
        </div>
        <div class="hero-meta">
          <div>${escapeHtml(generated)}</div>
          <div>Official document</div>
        </div>
      </header>
      ${statsHTML}
      ${sectionsHTML}
      ${bodyHTML}
    </div>
    <footer class="footer">
      <div><span class="accent">${escapeHtml(opts.schoolName || "Legacy Schools")}</span> · ${escapeHtml(footerNote)}</div>
      <div>${escapeHtml(generated)}</div>
    </footer>
    <script>window.onload=()=>{setTimeout(()=>window.print(),350);};</script>
  </body></html>`);
  w.document.close();
}