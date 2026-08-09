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
  /** Darker shade used for gradients/headings. Defaults to a derived shade. */
  brandDark?: string;
  /** Secondary school colour, used for accents. */
  accentColor?: string;
  /** CSS font stack applied to PDF output. */
  fontFamily?: string;
  /** Single font name used for the Word document. */
  wordFont?: string;
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

const slugFile = (s: string) =>
  (s || "export").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "export";

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Export the branded report as a real Office Open XML (.docx) document.
 * Generated with the `docx` library so Word, Google Docs and mobile viewers
 * all open it natively (an HTML file renamed .doc is reported as corrupt).
 */
export async function exportBrandedWord(opts: BrandedPDFOptions) {
  const {
    Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
    AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel,
  } = await import("docx");

  const brand = (opts.brandColor || "#4f46e5").replace("#", "");
  const accent = (opts.accentColor || opts.brandColor || "#4f46e5").replace("#", "");
  const wordFont = opts.wordFont || "Arial";
  const generated = new Date().toLocaleString();
  const CONTENT_W = 9360; // US Letter, 1" margins
  const border = { style: BorderStyle.SINGLE, size: 1, color: "E2E8F0" };
  const borders = { top: border, bottom: border, left: border, right: border };
  const margins = { top: 80, bottom: 80, left: 120, right: 120 };

  const cell = (text: string, w: number, o: { bold?: boolean; head?: boolean; size?: number; color?: string } = {}) =>
    new TableCell({
      borders,
      margins,
      width: { size: w, type: WidthType.DXA },
      shading: { fill: o.head ? brand : "FFFFFF", type: ShadingType.CLEAR, color: "auto" },
      children: [new Paragraph({ children: [new TextRun({
        text: text ?? "",
        bold: o.bold ?? o.head,
        size: o.size ?? 20,
        color: o.color ?? (o.head ? "FFFFFF" : "0F172A"),
      })] })],
    });

  const children: any[] = [];

  children.push(new Paragraph({ children: [new TextRun({
    text: (opts.schoolName || "Legacy Schools").toUpperCase(), size: 18, bold: true, color: "64748B",
  })] }));
  children.push(new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text: opts.title, bold: true, size: 40, color: brand })],
  }));
  if (opts.subtitle) {
    children.push(new Paragraph({ children: [new TextRun({ text: opts.subtitle, size: 22, color: "475569" })] }));
  }
  const metaBits = [
    opts.role ? `Role: ${opts.role}` : "",
    opts.generatedBy ? `Prepared by: ${opts.generatedBy}` : "",
    `Generated: ${generated}`,
  ].filter(Boolean).join("   •   ");
  children.push(new Paragraph({
    spacing: { after: 200 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: accent, space: 6 } },
    children: [new TextRun({ text: metaBits, size: 18, color: "64748B" })],
  }));

  if (opts.filters?.length) {
    children.push(new Paragraph({
      spacing: { after: 160 },
      children: [new TextRun({
        text: opts.filters.map(f => `${f.label}: ${f.value}`).join("   •   "),
        size: 18, color: "475569", italics: true,
      })],
    }));
  }

  if (opts.stats?.length) {
    const cols = opts.stats.length;
    const w = Math.floor(CONTENT_W / cols);
    const widths = Array.from({ length: cols }, (_, i) => (i === cols - 1 ? CONTENT_W - w * (cols - 1) : w));
    children.push(new Paragraph({ spacing: { before: 120, after: 80 }, children: [new TextRun({ text: "SUMMARY", bold: true, size: 20, color: brand })] }));
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: widths,
      rows: [new TableRow({
        children: opts.stats.map((s, i) => new TableCell({
          borders, margins,
          width: { size: widths[i], type: WidthType.DXA },
          shading: { fill: "F8FAFC", type: ShadingType.CLEAR, color: "auto" },
          children: [
            new Paragraph({ children: [new TextRun({ text: String(s.label).toUpperCase(), size: 16, color: "64748B", bold: true })] }),
            new Paragraph({ children: [new TextRun({ text: String(s.value), size: 28, bold: true, color: "0F172A" })] }),
            ...(s.hint ? [new Paragraph({ children: [new TextRun({ text: s.hint, size: 16, color: "64748B" })] })] : []),
          ],
        })),
      })],
    }));
  }

  (opts.sections || []).forEach(s => {
    if (s.kind !== "table") return;
    if (s.heading) {
      children.push(new Paragraph({
        spacing: { before: 300, after: 100 },
        children: [new TextRun({ text: s.heading.toUpperCase(), bold: true, size: 22, color: brand })],
      }));
    }
    const cols = Math.max(1, s.headers.length);
    const w = Math.floor(CONTENT_W / cols);
    const widths = Array.from({ length: cols }, (_, i) => (i === cols - 1 ? CONTENT_W - w * (cols - 1) : w));
    children.push(new Table({
      width: { size: CONTENT_W, type: WidthType.DXA },
      columnWidths: widths,
      rows: [
        new TableRow({
          tableHeader: true,
          children: s.headers.map((h, i) => cell(String(h), widths[i], { head: true, size: 18 })),
        }),
        ...s.rows.map(r => new TableRow({
          children: widths.map((cw, i) => cell(r[i] === undefined || r[i] === null ? "" : String(r[i]), cw)),
        })),
      ],
    }));
  });

  children.push(new Paragraph({
    spacing: { before: 400 },
    border: { top: { style: BorderStyle.SINGLE, size: 4, color: "E2E8F0", space: 6 } },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({
      text: `${opts.schoolName || "Legacy Schools"} · ${opts.footerNote || "Generated by Legacy Schools"} · ${generated}`,
      size: 16, color: "64748B",
    })],
  }));

  const doc = new Document({
    styles: { default: { document: { run: { font: wordFont, size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440 } } },
      children,
    }],
  });

  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `${slugFile(opts.title)}.docx`);
}

/** Export the branded report's tabular data as CSV (all table sections). */
export function exportBrandedCSV(opts: BrandedPDFOptions) {
  const esc = (v: any) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines: string[] = [];
  lines.push(esc(opts.title));
  if (opts.subtitle) lines.push(esc(opts.subtitle));
  if (opts.schoolName) lines.push(esc(opts.schoolName));
  lines.push(esc(`Generated: ${new Date().toLocaleString()}`));
  if (opts.filters?.length) lines.push(esc(opts.filters.map(f => `${f.label}: ${f.value}`).join(" | ")));

  if (opts.stats?.length) {
    lines.push("");
    lines.push("Summary");
    lines.push(["Metric", "Value", "Note"].join(","));
    opts.stats.forEach(s => lines.push([esc(s.label), esc(s.value), esc(s.hint ?? "")].join(",")));
  }

  (opts.sections || []).forEach(s => {
    if (s.kind !== "table") return;
    lines.push("");
    if (s.heading) lines.push(esc(s.heading));
    lines.push(s.headers.map(esc).join(","));
    s.rows.forEach(r => lines.push(r.map(esc).join(",")));
  });

  downloadBlob(
    new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8;" }),
    `${slugFile(opts.title)}.csv`,
  );
}

const slugifyHeading = (s: string, i: number) =>
  `sec-${i}-${s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40)}`;

export function exportBrandedPDF(opts: BrandedPDFOptions) {
  const brand = opts.brandColor || "#4f46e5"; // indigo-600
  const brandDark = opts.brandDark || "#3730a3";
  const accent = opts.accentColor || brand;
  const fontStack = opts.fontFamily || "'Inter',ui-sans-serif,system-ui,-apple-system,Segoe UI,Roboto,sans-serif";
  const w = window.open("", "_blank", "width=960,height=760");
  if (!w) return;
  const generated = new Date().toLocaleString();
  const logoTag = opts.schoolLogo
    ? `<img src="${escapeHtml(opts.schoolLogo)}" alt="" crossorigin="anonymous" />`
    : `<div class="logo-fallback">${escapeHtml((opts.schoolName || "LS").slice(0, 2).toUpperCase())}</div>`;
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
    ? `<div class="block">
        <div class="block-title">Filters applied</div>
        <div class="chips">${opts.filters.map(f =>
          `<span class="chip"><b>${escapeHtml(f.label)}:</b> ${escapeHtml(f.value)}</span>`
        ).join("")}</div>
      </div>`
    : "";

  const tocHTML = headedSections.length > 1
    ? `<div class="block">
        <div class="block-title">Contents</div>
        <ol class="toc">${headedSections.map(h =>
          `<li><a href="#${h.id}">${escapeHtml(h.heading)}</a></li>`
        ).join("")}</ol>
      </div>`
    : "";

  const metaHTML = `
    <div class="meta-grid">
      ${opts.role ? `<div><div class="meta-label">Role</div><div class="meta-value">${escapeHtml(opts.role)}</div></div>` : ""}
      ${opts.generatedBy ? `<div><div class="meta-label">Prepared by</div><div class="meta-value">${escapeHtml(opts.generatedBy)}</div></div>` : ""}
      <div><div class="meta-label">Generated</div><div class="meta-value">${escapeHtml(generated)}</div></div>
      <div><div class="meta-label">Document</div><div class="meta-value">Official report</div></div>
    </div>`;

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

    /* ---------- meta + info blocks (compact, on white) ---------- */
    .meta-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 16px;
      border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--soft);}
    .meta-label{font-size:9.5px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:2px;font-weight:600;}
    .meta-value{font-size:12px;font-weight:600;color:var(--ink);}
    .block{border:1px solid var(--line);border-radius:12px;padding:12px 14px;margin:0 0 16px;}
    .block-title{font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--muted);margin-bottom:8px;font-weight:700;}
    .chips{display:flex;flex-wrap:wrap;gap:8px;}
    .chip{display:inline-flex;align-items:center;gap:6px;padding:4px 10px;border-radius:999px;
      background:var(--soft);border:1px solid var(--line);font-size:11.5px;color:var(--ink);}
    .chip b{font-weight:700;color:var(--muted);font-size:10px;text-transform:uppercase;letter-spacing:.06em;}
    .toc{margin:0;padding-left:18px;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:4px 24px;}
    .toc li{font-size:12px;line-height:1.5;}
    .toc a{color:var(--brand-dark);text-decoration:none;}

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
      thead{display:table-header-group;}
      tr,.stat,.block{page-break-inside:avoid;}
    }
  </style></head><body>
    <div class="page">
      <header class="hero">
        ${logoTag}
        <div class="hero-text">
          <div class="eyebrow">${escapeHtml(opts.schoolName || "Legacy Schools")} · Official report</div>
          <h1>${escapeHtml(opts.title)}</h1>
          ${opts.subtitle ? `<p class="sub">${escapeHtml(opts.subtitle)}</p>` : ""}
        </div>
        <div class="hero-meta">
          <div>${escapeHtml(generated)}</div>
          ${opts.generatedBy ? `<div>${escapeHtml(opts.generatedBy)}</div>` : ""}
        </div>
      </header>
      ${metaHTML}
      ${filtersHTML}
      ${tocHTML}
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