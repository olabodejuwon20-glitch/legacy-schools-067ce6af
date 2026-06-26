import { supabase } from "@/integrations/supabase/client";
import { escapeHtml } from "@/lib/exporters";

export type ReportCardSubjectRow = {
  subject: string;
  ca1?: number | null;
  ca2?: number | null;
  exam?: number | null;
  total?: number | null;
  grade?: string | null;
  position?: string | number | null;
  remark?: string | null;
};

export type ReportCardData = {
  schoolName: string;
  schoolMotto?: string | null;
  schoolLogo?: string | null;
  schoolAddress?: string | null;
  term: string;
  session?: string | null;
  studentName: string;
  studentClass?: string | null;
  admissionNo?: string | null;
  studentPhoto?: string | null;
  subjects: ReportCardSubjectRow[];
  attendance?: { present?: number; absent?: number; total?: number };
  overallPercentage?: number | null;
  overallGrade?: string | null;
  classPosition?: string | number | null;
  teacherComment?: string | null;
  principalComment?: string | null;
  nextTermBegins?: string | null;
};

/**
 * Premium branded report card. Opens a print window with a fully styled,
 * paginated HTML report using the school's logo, name and motto.
 * The user prints to PDF from the browser dialog.
 */
export function openPremiumReportCard(data: ReportCardData) {
  const w = window.open("", "_blank", "width=1000,height=820");
  if (!w) return;
  const e = escapeHtml;
  const rows = data.subjects.map((s, i) => `
    <tr class="${i % 2 ? "alt" : ""}">
      <td class="subj">${e(s.subject)}</td>
      <td>${s.ca1 ?? "—"}</td>
      <td>${s.ca2 ?? "—"}</td>
      <td>${s.exam ?? "—"}</td>
      <td class="total">${s.total ?? "—"}</td>
      <td><span class="grade g-${e((s.grade ?? "").toString().toLowerCase())}">${e(s.grade ?? "—")}</span></td>
      <td>${e(s.position?.toString() ?? "—")}</td>
      <td class="remark">${e(s.remark ?? "")}</td>
    </tr>`).join("");
  const att = data.attendance ?? {};
  const attPct = att.total ? Math.round(((att.present ?? 0) / att.total) * 100) : null;
  const logo = data.schoolLogo
    ? `<img src="${e(data.schoolLogo)}" alt="logo" class="logo"/>`
    : `<div class="logo placeholder">${e(data.schoolName.charAt(0))}</div>`;
  const photo = data.studentPhoto
    ? `<img src="${e(data.studentPhoto)}" alt="" class="photo"/>`
    : `<div class="photo placeholder">${e(data.studentName.charAt(0))}</div>`;

  w.document.write(`<!doctype html><html><head>
<title>Report Card — ${e(data.studentName)}</title>
<style>
  @page { size: A4; margin: 14mm; }
  *{box-sizing:border-box}
  body{font-family:'Inter','Helvetica Neue',Arial,sans-serif;color:#0f172a;margin:0;padding:0;background:#f8fafc;}
  .sheet{max-width:820px;margin:0 auto;background:#fff;padding:32px 36px;border-radius:14px;box-shadow:0 4px 24px rgba(15,23,42,.06);}
  .cover{background:linear-gradient(135deg,#0f172a 0%, #1e3a8a 60%, #3b82f6 100%);color:#fff;border-radius:14px;padding:40px 36px;position:relative;overflow:hidden;margin-bottom:18px;}
  .cover::after{content:"";position:absolute;inset:auto -80px -80px auto;width:280px;height:280px;background:radial-gradient(circle,#ffffff33,transparent 70%);border-radius:50%;}
  .cover h1{font-size:28px;margin:0;letter-spacing:.5px;font-weight:800;}
  .cover .motto{font-style:italic;font-size:13px;opacity:.85;margin-top:4px;}
  .cover .term{margin-top:18px;font-size:13px;opacity:.9;}
  .cover .title{margin-top:32px;font-size:36px;font-weight:800;letter-spacing:.5px;}
  .head{display:flex;align-items:center;gap:18px;}
  .logo{width:64px;height:64px;border-radius:12px;background:#fff;object-fit:contain;padding:6px;border:1px solid #e2e8f0;}
  .logo.placeholder{display:flex;align-items:center;justify-content:center;color:#1e3a8a;font-weight:800;font-size:28px;background:#fff;}
  .student{display:flex;gap:18px;align-items:center;padding:18px;border:1px solid #e2e8f0;border-radius:12px;background:#f8fafc;margin-bottom:18px;}
  .photo{width:80px;height:80px;border-radius:50%;object-fit:cover;border:3px solid #fff;box-shadow:0 2px 12px rgba(15,23,42,.12);}
  .photo.placeholder{display:flex;align-items:center;justify-content:center;background:#dbeafe;color:#1e3a8a;font-weight:800;font-size:32px;}
  .student .name{font-size:20px;font-weight:700;}
  .student .meta{color:#475569;font-size:12px;margin-top:2px;}
  table.scores{width:100%;border-collapse:collapse;font-size:12.5px;margin-top:6px;border-radius:10px;overflow:hidden;border:1px solid #e2e8f0;}
  table.scores th{background:linear-gradient(90deg,#1e3a8a,#3b82f6);color:#fff;padding:10px 12px;font-weight:600;text-align:left;font-size:11px;letter-spacing:.06em;text-transform:uppercase;}
  table.scores td{padding:10px 12px;border-bottom:1px solid #f1f5f9;}
  table.scores tr.alt td{background:#fafbfd;}
  table.scores td.subj{font-weight:600;}
  table.scores td.total{font-weight:700;color:#1e3a8a;}
  table.scores td.remark{color:#475569;font-size:11.5px;}
  .grade{display:inline-block;padding:2px 8px;border-radius:999px;font-weight:700;font-size:11px;background:#e2e8f0;color:#0f172a;}
  .grade.g-a, .grade.g-a1, .grade.g-a\\+ { background:#dcfce7;color:#15803d; }
  .grade.g-b, .grade.g-b2, .grade.g-b3 { background:#dbeafe;color:#1d4ed8; }
  .grade.g-c, .grade.g-c4, .grade.g-c5, .grade.g-c6 { background:#fef3c7;color:#92400e; }
  .grade.g-d, .grade.g-d7, .grade.g-e, .grade.g-e8 { background:#fed7aa;color:#9a3412; }
  .grade.g-f, .grade.g-f9 { background:#fee2e2;color:#b91c1c; }
  .summary{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:18px;}
  .stat{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff;}
  .stat .lbl{font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;}
  .stat .val{font-size:22px;font-weight:800;margin-top:4px;color:#0f172a;}
  .comments{margin-top:18px;display:grid;grid-template-columns:1fr 1fr;gap:12px;}
  .comment{border:1px solid #e2e8f0;border-radius:12px;padding:14px;background:#fff;}
  .comment .who{font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#1e3a8a;font-weight:700;}
  .comment .body{margin-top:6px;font-size:13px;line-height:1.5;color:#1f2937;}
  .footer{margin-top:24px;padding-top:14px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;color:#64748b;font-size:11px;}
  .watermark{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;pointer-events:none;opacity:.04;font-size:160px;font-weight:900;color:#1e3a8a;z-index:0;transform:rotate(-20deg);}
  @media print{ body{background:#fff;} .sheet{box-shadow:none;border-radius:0;padding:0;} .watermark{opacity:.05;} }
</style></head>
<body>
  <div class="watermark">${e(data.schoolName)}</div>
  <div class="sheet">
    <div class="cover">
      <div class="head">${logo}
        <div>
          <h1>${e(data.schoolName)}</h1>
          ${data.schoolMotto ? `<div class="motto">"${e(data.schoolMotto)}"</div>` : ""}
          ${data.schoolAddress ? `<div class="motto" style="opacity:.7">${e(data.schoolAddress)}</div>` : ""}
        </div>
      </div>
      <div class="term">${e(data.term)}${data.session ? ` · ${e(data.session)}` : ""}</div>
      <div class="title">Student Report Card</div>
    </div>

    <div class="student">
      ${photo}
      <div style="flex:1">
        <div class="name">${e(data.studentName)}</div>
        <div class="meta">
          ${data.studentClass ? `Class: <b>${e(data.studentClass)}</b>` : ""}
          ${data.admissionNo ? ` &nbsp;·&nbsp; Admission No: <b>${e(data.admissionNo)}</b>` : ""}
        </div>
      </div>
      ${data.overallPercentage != null ? `
        <div style="text-align:right">
          <div style="font-size:11px;color:#64748b;text-transform:uppercase;letter-spacing:.06em">Overall</div>
          <div style="font-size:28px;font-weight:800;color:#1e3a8a">${data.overallPercentage}%</div>
          ${data.overallGrade ? `<span class="grade g-${e(data.overallGrade.toLowerCase())}">${e(data.overallGrade)}</span>` : ""}
        </div>` : ""}
    </div>

    <table class="scores">
      <thead><tr>
        <th>Subject</th><th>CA1</th><th>CA2</th><th>Exam</th><th>Total</th><th>Grade</th><th>Pos</th><th>Remark</th>
      </tr></thead>
      <tbody>${rows || `<tr><td colspan="8" style="text-align:center;color:#94a3b8;padding:24px">No subject results released yet.</td></tr>`}</tbody>
    </table>

    <div class="summary">
      <div class="stat"><div class="lbl">Class Position</div><div class="val">${e(data.classPosition?.toString() ?? "—")}</div></div>
      <div class="stat"><div class="lbl">Attendance</div><div class="val">${attPct != null ? attPct + "%" : "—"}</div></div>
      <div class="stat"><div class="lbl">Present</div><div class="val">${att.present ?? "—"}</div></div>
      <div class="stat"><div class="lbl">Absent</div><div class="val">${att.absent ?? "—"}</div></div>
    </div>

    <div class="comments">
      <div class="comment"><div class="who">Class Teacher</div><div class="body">${e(data.teacherComment ?? "—")}</div></div>
      <div class="comment"><div class="who">Principal</div><div class="body">${e(data.principalComment ?? "—")}</div></div>
    </div>

    <div class="footer">
      <div>${e(data.schoolName)}${data.schoolMotto ? ` · <i>${e(data.schoolMotto)}</i>` : ""}</div>
      <div>${data.nextTermBegins ? `Next term begins: <b>${e(data.nextTermBegins)}</b>` : ""}</div>
    </div>
  </div>
  <script>window.onload=()=>setTimeout(()=>window.print(),350);</script>
</body></html>`);
  w.document.close();
}

/** Pull school + student + released subject scores from the database for a given term. */
export async function fetchReportCardData(
  schoolId: string,
  studentId: string,
  term: string,
): Promise<ReportCardData | null> {
  const { data: school } = await supabase
    .from("schools").select("name,motto,logo_url,address").eq("id", schoolId).maybeSingle();
  if (!school) return null;
  const { data: prof } = await supabase
    .from("profiles").select("full_name,avatar_url").eq("id", studentId).maybeSingle();
  const { data: results } = await supabase
    .from("results")
    .select("subject,ca1,ca2,exam,total,grade,position,remark")
    .eq("student_id", studentId)
    .eq("term", term);

  return {
    schoolName: (school as any).name,
    schoolMotto: (school as any).motto,
    schoolLogo: (school as any).logo_url,
    schoolAddress: (school as any).address,
    term,
    studentName: (prof as any)?.full_name ?? "Student",
    studentPhoto: (prof as any)?.avatar_url,
    subjects: ((results as any[]) ?? []).map(r => ({
      subject: r.subject, ca1: r.ca1, ca2: r.ca2, exam: r.exam,
      total: r.total, grade: r.grade, position: r.position, remark: r.remark,
    })),
  };
}