import { exportBrandedPDF } from "@/lib/exporters";

type PosterInput = {
  schoolName: string;
  schoolLogo?: string | null;
  brandColor?: string;
  joinUrl: string;
  schoolCode?: string | null;
  qrDataUrl: string;
  contactPhone?: string | null;
  contactEmail?: string | null;
  welcomeMessage?: string | null;
};

/** Open a print-ready branded onboarding poster in a new tab. */
export function printOnboardingPoster(p: PosterInput) {
  const body = `
    <div style="text-align:center;padding:24px 12px;">
      <h2 style="margin:0 0 6px;font-size:22px;">Welcome to ${escape(p.schoolName)}</h2>
      <p style="margin:0 0 18px;color:#555;font-size:13px;">
        ${escape(p.welcomeMessage || "Scan the QR code below to join your school portal.")}
      </p>
      <div style="display:inline-block;padding:16px;border:1px solid #e5e7eb;border-radius:16px;background:#fff;">
        <img src="${p.qrDataUrl}" alt="QR" style="width:320px;height:320px;display:block;" />
      </div>
      <div style="margin-top:14px;font-family:ui-monospace,Menlo,monospace;font-size:13px;color:#111;">
        ${escape(p.joinUrl)}
      </div>
      ${p.schoolCode ? `<div style="margin-top:6px;font-size:12px;color:#555;">School code: <b>${escape(p.schoolCode)}</b></div>` : ""}
      <ol style="text-align:left;max-width:520px;margin:24px auto 0;padding-left:20px;color:#333;font-size:13px;line-height:1.6;">
        <li>Open your phone camera and scan the code above.</li>
        <li>Pick your role (Student, Teacher, Parent, Staff or Driver).</li>
        <li>Enter the activation code given by your school.</li>
        <li>Create a password and PIN to finish setting up.</li>
      </ol>
      ${
        (p.contactPhone || p.contactEmail)
          ? `<div style="margin-top:20px;padding-top:12px;border-top:1px solid #e5e7eb;font-size:12px;color:#555;">
              Need help? ${p.contactPhone ? "Call <b>" + escape(p.contactPhone) + "</b>" : ""}
              ${p.contactPhone && p.contactEmail ? " · " : ""}
              ${p.contactEmail ? "Email <b>" + escape(p.contactEmail) + "</b>" : ""}
            </div>`
          : ""
      }
    </div>`;

  exportBrandedPDF({
    title: "Join " + p.schoolName,
    subtitle: "Onboarding poster",
    schoolName: p.schoolName,
    schoolLogo: p.schoolLogo,
    brandColor: p.brandColor,
    body,
    footerNote: "Print this poster and display it where new students, teachers and parents can scan it.",
  });
}

function escape(v: string) {
  return String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
}