// LegacySKool email template utility
// Renders a branded HTML email using the LegacySKool colour palette.
// The layout follows the skeleton described in the implementation plan.

interface RenderParams {
  title: string;
  bodyHtml: string; // already escaped HTML fragments
}

/**
 * Returns the complete HTML string for an email.
 * The template includes the LegacySKool logo, header, body, and footer.
 */
export function renderTemplate({ title, bodyHtml }: RenderParams): string {
  const year = new Date().getFullYear();
  const logoUrl = "https://legacy.skool/public/logo-legacy.png"; // adjust if hosted elsewhere
  return `
    <table width="100%" style="font-family:Arial,sans-serif;background:#f9f9f9;padding:20px;">
      <tr>
        <td align="center">
          <img src="${logoUrl}" alt="LegacySKool" width="120" style="margin-bottom:20px;"/>
        </td>
      </tr>
      <tr>
        <td style="background:#ffffff;padding:30px;border-radius:8px;">
          <h2 style="color:#2C3E50;margin-top:0;">${title}</h2>
          ${bodyHtml}
        </td>
      </tr>
      <tr>
        <td style="font-size:12px;color:#777;padding-top:20px;text-align:center;line-height:1.6;">
          <p style="margin:0;">© ${year} LegacySKool – All rights reserved.</p>
          <p style="margin:4px 0 0;color:#6b7280;">Support: <a href="mailto:nexolabsa@gmail.com" style="color:#2563eb;text-decoration:none;">nexolabsa@gmail.com</a></p>
        </td>
      </tr>
    </table>
  `;
}
