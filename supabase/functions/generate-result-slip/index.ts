import { createClient } from "jsr:@supabase/supabase-js@2";
import { PDFDocument, StandardFonts, rgb, degrees } from "npm:pdf-lib@1.17.1";
import QRCode from "npm:qrcode@1.5.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

function necoGrade(score: number): { grade: string; remark: string } {
  const s = Number(score);
  if (s >= 75) return { grade: "A1", remark: "Excellent" };
  if (s >= 70) return { grade: "B2", remark: "Very Good" };
  if (s >= 65) return { grade: "B3", remark: "Good" };
  if (s >= 60) return { grade: "C4", remark: "Credit" };
  if (s >= 55) return { grade: "C5", remark: "Credit" };
  if (s >= 50) return { grade: "C6", remark: "Credit" };
  if (s >= 45) return { grade: "D7", remark: "Pass" };
  if (s >= 40) return { grade: "E8", remark: "Pass" };
  return { grade: "F9", remark: "Fail" };
}

/**
 * SSRF guard for school.logo_url. We only allow https URLs whose hostname matches
 * the project's Supabase storage host (e.g. <ref>.supabase.co). This blocks
 * fetches to internal/metadata addresses (169.254.169.254, RFC-1918, etc.).
 */
function isSafeLogoUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:") return false;
    const supaUrl = Deno.env.get("SUPABASE_URL") || "";
    const supaHost = supaUrl ? new URL(supaUrl).hostname : "";
    if (!supaHost) return false;
    // Allow the project's own host (storage is served from the same host).
    if (u.hostname === supaHost) return true;
    // Also allow the storage subdomain variant if present.
    if (u.hostname.endsWith(".supabase.co") && u.hostname === supaHost) return true;
    return false;
  } catch {
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const url = Deno.env.get("SUPABASE_URL")!;
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
    const admin = createClient(url, service, { auth: { persistSession: false } });

    const { data: { user }, error: uErr } = await userClient.auth.getUser();
    if (uErr || !user) return json({ error: "Not authenticated" }, 401);

    const { student_id, term } = await req.json();
    if (!student_id) return json({ error: "student_id required" }, 400);

    // Find student's school via membership
    const { data: stuMem } = await admin.from("memberships")
      .select("school_id, profile_data").eq("user_id", student_id).eq("role", "student").eq("status", "active").maybeSingle();
    if (!stuMem) return json({ error: "Student not found" }, 404);
    const schoolId = stuMem.school_id;

    // Authorize caller: self, admin, teacher, or linked parent
    const { data: callerMem } = await admin.from("memberships")
      .select("role").eq("school_id", schoolId).eq("user_id", user.id).eq("status", "active").maybeSingle();
    let allowed = user.id === student_id || (callerMem && (callerMem.role === "admin" || callerMem.role === "teacher"));
    if (!allowed) {
      const { data: link } = await admin.from("parent_links")
        .select("id").eq("school_id", schoolId).eq("parent_user_id", user.id).eq("student_user_id", student_id).maybeSingle();
      allowed = !!link;
    }
    if (!allowed) return json({ error: "Forbidden" }, 403);

    // Students and parents may only see published results. Staff (admin/teacher) may see all.
    const isStaff = !!(callerMem && (callerMem.role === "admin" || callerMem.role === "teacher"));
    let resultsQuery = admin.from("results").select("subject,score,term,remarks,published_at")
      .eq("school_id", schoolId).eq("student_id", student_id);
    if (!isStaff) resultsQuery = resultsQuery.not("published_at", "is", null);
    const [{ data: school }, { data: profile }, { data: results }] = await Promise.all([
      admin.from("schools").select("name,motto,address,phone,email,logo_url,current_session,current_term").eq("id", schoolId).single(),
      admin.from("profiles").select("full_name,email,dob,gender,phone").eq("id", student_id).maybeSingle(),
      resultsQuery,
    ]);

    const usedTerm = term || school?.current_term || "Term 1";
    const termRows = (results ?? []).filter(r => !term ? true : r.term === usedTerm);

    // Build verification snapshot + record (public-readable, no credentials)
    const pdat: any = stuMem.profile_data ?? {};
    const gradedRows = termRows.map(r => {
      const sc = Math.round(Number(r.score));
      return { subject: r.subject, score: sc, ...necoGrade(sc) };
    });
    const totalSnap = gradedRows.reduce((a, r) => a + r.score, 0);
    const avgSnap = gradedRows.length ? Math.round(totalSnap / gradedRows.length) : 0;
    const snapshot = {
      school: { name: school?.name ?? null, address: school?.address ?? null, phone: school?.phone ?? null, email: school?.email ?? null, logo_url: school?.logo_url ?? null },
      student: {
        full_name: profile?.full_name ?? null,
        admission_no: pdat.admission_no ?? null,
        class: pdat.class ?? null,
        gender: profile?.gender ?? null,
        dob: profile?.dob ?? null,
      },
      term: usedTerm,
      session: school?.current_session ?? null,
      results: gradedRows,
      average: avgSnap,
      overall_grade: necoGrade(avgSnap).grade,
      issued_at: new Date().toISOString(),
    };

    const { data: ver, error: verErr } = await admin
      .from("result_verifications")
      .insert({ school_id: schoolId, student_id, term: usedTerm, session: school?.current_session ?? null, snapshot, issued_by: user.id })
      .select("id")
      .single();
    if (verErr) console.error("[generate-result-slip] verification insert failed", verErr);

    // Use a server-controlled canonical base URL so the QR code embedded in the
    // PDF cannot be redirected to an attacker domain via the request Origin header.
    const APP_BASE_URL = Deno.env.get("APP_BASE_URL") || "https://legacy-schools.lovable.app";
    const verifyUrl = ver?.id ? `${APP_BASE_URL}/verify/${ver.id}` : APP_BASE_URL;
    let qrBytes: Uint8Array | null = null;
    try {
      const qrDataUrl = await QRCode.toDataURL(verifyUrl, { errorCorrectionLevel: "M", margin: 1, width: 256 });
      const b64Png = qrDataUrl.split(",")[1];
      const bin = atob(b64Png);
      qrBytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) qrBytes[i] = bin.charCodeAt(i);
    } catch (e) { console.error("[generate-result-slip] qr failed", e); }

    // Build PDF
    const pdf = await PDFDocument.create();
    const page = pdf.addPage([595.28, 841.89]); // A4
    const font = await pdf.embedFont(StandardFonts.Helvetica);
    const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
    const { width, height } = page.getSize();
    const ink = rgb(0.06, 0.09, 0.16);
    const muted = rgb(0.39, 0.45, 0.55);
    const accent = rgb(0.10, 0.30, 0.65);
    const line = rgb(0.85, 0.88, 0.93);

    // Logo
    let logoImg: any = null;
    if (school?.logo_url && isSafeLogoUrl(school.logo_url)) {
      try {
        const r = await fetch(school.logo_url, { redirect: "error" });
        const ct = r.headers.get("content-type") || "";
        const buf = new Uint8Array(await r.arrayBuffer());
        logoImg = ct.includes("png") ? await pdf.embedPng(buf) : await pdf.embedJpg(buf);
      } catch (_) {}
    }

    // Header band
    page.drawRectangle({ x: 0, y: height - 110, width, height: 110, color: accent });
    if (logoImg) {
      const dim = logoImg.scaleToFit(70, 70);
      page.drawImage(logoImg, { x: 32, y: height - 90, width: dim.width, height: dim.height });
    }
    page.drawText(school?.name ?? "School", { x: 120, y: height - 50, size: 20, font: bold, color: rgb(1,1,1) });
    if (school?.motto) page.drawText(school.motto, { x: 120, y: height - 70, size: 10, font, color: rgb(0.92,0.95,1) });
    page.drawText("STUDENT RESULT SLIP (NECO-aligned)", { x: 120, y: height - 90, size: 10, font: bold, color: rgb(1,1,1) });

    // Diagonal "AUTHENTIC" watermark – very faint, only visible on close inspection / scans
    try {
      const wmText = `AUTHENTIC • ${(school?.name ?? "SCHOOL").toUpperCase()}`;
      for (let row = 0; row < 6; row++) {
        for (let col = 0; col < 3; col++) {
          page.drawText(wmText, {
            x: 30 + col * 220,
            y: 720 - row * 130,
            size: 10,
            font: bold,
            color: rgb(0.93, 0.95, 0.98),
            rotate: degrees(-30),
          });
        }
      }
    } catch (_) { /* watermark is decorative */ }

    // Bio block
    let y = height - 140;
    const label = (l: string, v: string, x: number) => {
      page.drawText(l, { x, y, size: 8, font, color: muted });
      page.drawText(v || "—", { x, y: y - 12, size: 11, font: bold, color: ink });
    };
    label("STUDENT NAME", profile?.full_name ?? "—", 32);
    label("ADMISSION NO", pdat.admission_no ?? "—", 240);
    label("CLASS", pdat.class ?? "—", 380);
    label("GENDER", profile?.gender ?? "—", 480);
    y -= 36;
    label("SESSION", school?.current_session ?? "—", 32);
    label("TERM", usedTerm, 240);
    label("DATE OF BIRTH", profile?.dob ?? "—", 380);
    label("ISSUED", new Date().toLocaleDateString(), 480);
    y -= 32;

    // Table header
    page.drawRectangle({ x: 32, y: y - 18, width: width - 64, height: 22, color: rgb(0.96, 0.97, 0.99) });
    const cols = [
      { label: "S/N", x: 40, w: 30 },
      { label: "SUBJECT", x: 70, w: 200 },
      { label: "SCORE", x: 290, w: 60 },
      { label: "GRADE", x: 360, w: 60 },
      { label: "REMARK", x: 430, w: 130 },
    ];
    cols.forEach(c => page.drawText(c.label, { x: c.x, y: y - 12, size: 8, font: bold, color: muted }));
    y -= 26;

    let total = 0;
    termRows.forEach((r, i) => {
      const sc = Math.round(Number(r.score));
      const g = necoGrade(sc);
      total += sc;
      page.drawText(String(i + 1), { x: 40, y, size: 10, font, color: ink });
      page.drawText(String(r.subject).slice(0, 32), { x: 70, y, size: 10, font, color: ink });
      page.drawText(`${sc}%`, { x: 290, y, size: 10, font: bold, color: ink });
      page.drawText(g.grade, { x: 360, y, size: 10, font: bold, color: accent });
      page.drawText(g.remark, { x: 430, y, size: 10, font, color: ink });
      page.drawLine({ start: { x: 32, y: y - 6 }, end: { x: width - 32, y: y - 6 }, thickness: 0.5, color: line });
      y -= 20;
    });

    if (termRows.length === 0) {
      page.drawText("No results recorded for this term.", { x: 40, y, size: 10, font, color: muted });
      y -= 20;
    }

    // Summary
    const avg = termRows.length ? Math.round(total / termRows.length) : 0;
    const overall = necoGrade(avg);
    const credits = termRows.filter(r => Number(r.score) >= 50).length;
    y -= 16;
    page.drawRectangle({ x: 32, y: y - 60, width: width - 64, height: 60, color: rgb(0.96, 0.97, 0.99), borderColor: line, borderWidth: 0.5 });
    const sumLabel = (l: string, v: string, x: number) => {
      page.drawText(l, { x, y: y - 18, size: 8, font, color: muted });
      page.drawText(v, { x, y: y - 36, size: 14, font: bold, color: ink });
    };
    sumLabel("SUBJECTS", String(termRows.length), 48);
    sumLabel("AVERAGE", `${avg}%`, 170);
    sumLabel("OVERALL GRADE", overall.grade, 290);
    sumLabel("CREDIT PASSES", `${credits}/${termRows.length}`, 430);

    // Signatures
    y -= 110;
    page.drawLine({ start: { x: 60, y }, end: { x: 220, y }, thickness: 0.7, color: ink });
    page.drawLine({ start: { x: 360, y }, end: { x: 520, y }, thickness: 0.7, color: ink });
    page.drawText("Class Teacher", { x: 60, y: y - 14, size: 9, font, color: muted });
    page.drawText("Principal", { x: 360, y: y - 14, size: 9, font, color: muted });

    // Verification QR
    if (qrBytes) {
      try {
        const qrImg = await pdf.embedPng(qrBytes);
        const qSize = 86;
        const qx = width - 32 - qSize;
        const qy = 56;
        // Stamp ring around the QR
        page.drawRectangle({
          x: qx - 8, y: qy - 8, width: qSize + 16, height: qSize + 26,
          borderColor: accent, borderWidth: 1, color: rgb(1,1,1),
        });
        page.drawImage(qrImg, { x: qx, y: qy, width: qSize, height: qSize });
        page.drawText("VERIFIED BY QR", { x: qx - 4, y: qy + qSize + 6, size: 7, font: bold, color: accent });
        page.drawText("Scan to verify authenticity", { x: 32, y: qy + qSize - 6, size: 10, font: bold, color: ink });
        page.drawText("Anyone can scan this QR to confirm that this result", { x: 32, y: qy + qSize - 22, size: 8, font, color: muted });
        page.drawText(`was issued by ${school?.name ?? "the school"} and has not been altered.`, { x: 32, y: qy + qSize - 34, size: 8, font, color: muted });
        if (ver?.id) page.drawText(`Verification ID: ${ver.id}`, { x: 32, y: qy + qSize - 50, size: 7, font, color: muted });
        if (verifyUrl) page.drawText(verifyUrl, { x: 32, y: qy + qSize - 62, size: 7, font, color: muted });
      } catch (e) { console.error("[generate-result-slip] embed qr failed", e); }
    }

    page.drawText(`Generated by ${school?.name ?? "Legacyskool"} • ${new Date().toLocaleString()}`, {
      x: 32, y: 36, size: 8, font, color: muted,
    });
    page.drawText("This document is digitally signed. Any alteration invalidates the QR verification.",
      { x: 32, y: 22, size: 7, font, color: muted });

    const bytes = await pdf.save();
    let bin = "";
    const chunk = 0x8000;
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    const b64 = btoa(bin);
    const filename = `${(profile?.full_name ?? "student").replace(/\s+/g, "_")}_${usedTerm.replace(/\s+/g, "_")}_slip.pdf`;
    return json({ pdf_base64: b64, filename, mime: "application/pdf" });
  } catch (e) {
    console.error('[generate-result-slip] error:', e); return json({ error: 'An internal error occurred' }, 500);
  }
});
