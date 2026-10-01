// LegacySKool email wrapper with all transactional and promotional helpers
import { supabase } from '@/integrations/supabase/client';
import { renderTemplate } from '@/lib/emailTemplate';
import { sendEmail as resendSendEmail } from '@/lib/resend'; // fallback if needed
import * as copies from '@/lib/emailCopies';

export const DEFAULT_SUPPORT_EMAIL = 'nexolabsa@gmail.com';

export function getSupportEmail(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPPORT_EMAIL) return import.meta.env.VITE_SUPPORT_EMAIL;
  if (typeof process !== 'undefined' && process.env?.SUPPORT_EMAIL) return process.env.SUPPORT_EMAIL;
  return DEFAULT_SUPPORT_EMAIL;
}

export function getBrevoApiKey(): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_BREVO_API_KEY) return import.meta.env.VITE_BREVO_API_KEY;
    if ((import.meta.env as any).BREVO_API_KEY) return (import.meta.env as any).BREVO_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.BREVO_API_KEY) return process.env.BREVO_API_KEY;
    if (process.env.VITE_BREVO_API_KEY) return process.env.VITE_BREVO_API_KEY;
  }
  return undefined;
}

export function getBrevoSenderEmail(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_BREVO_SENDER_EMAIL) return import.meta.env.VITE_BREVO_SENDER_EMAIL;
  if (typeof process !== 'undefined' && process.env?.BREVO_SENDER_EMAIL) return process.env.BREVO_SENDER_EMAIL;
  return 'nexolabsa@gmail.com';
}

/** Simple token‑bucket rate limiter */
let tokens = 100;
const refillInterval = 60_000; // 1 min
if (typeof setInterval !== 'undefined') {
  setInterval(() => {
    tokens = 100;
  }, refillInterval);
}

function acquireToken() {
  if (tokens > 0) {
    tokens -= 1;
    return Promise.resolve();
  }
  return new Promise<void>((resolve) => {
    const check = () => {
      if (tokens > 0) {
        tokens -= 1;
        resolve();
      } else {
        setTimeout(check, 1000);
      }
    };
    setTimeout(check, 1000);
  });
}

/** Core resilient email sender: tries Supabase Edge Function -> direct Brevo -> direct Resend */
export async function brevoSendEmail(to: string, subject: string, html: string, text?: string) {
  await acquireToken();

  // Replace generic placeholders with official values
  const supportEmail = getSupportEmail();
  const finalHtml = html
    .replace(/\{SUPPORT_EMAIL\}/g, supportEmail)
    .replace(/\{YEAR\}/g, String(new Date().getFullYear()));

  // 1. First preference: server-side dispatch via Supabase Edge Function (avoids browser CORS and keeps API keys secure)
  try {
    const { data, error } = await supabase.functions.invoke('send-email', {
      body: { to, subject, html: finalHtml, text },
    });
    if (!error && (data as any)?.ok) {
      return data;
    }
    if (error) {
      console.warn('[Email] Edge function send-email returned error, trying direct provider fallback:', error);
    }
  } catch (edgeErr) {
    console.warn('[Email] Could not invoke send-email edge function, falling back to direct provider:', edgeErr);
  }

  // 2. Second preference: direct Brevo HTTP API
  const apiKey = getBrevoApiKey();
  if (apiKey) {
    try {
      const payload = {
        sender: {
          email: getBrevoSenderEmail(),
          name: 'LegacySKool',
        },
        to: [{ email: to }],
        subject,
        htmlContent: finalHtml,
        textContent: text,
      };

      const resp = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: {
          'api-key': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      const data = await resp.json().catch(() => ({}));
      if (resp.ok) {
        return data;
      }
      console.warn('[Email] Direct Brevo request failed, falling back to Resend:', data);
    } catch (brevoErr) {
      console.warn('[Email] Direct Brevo threw an error, trying Resend fallback:', brevoErr);
    }
  }

  // 3. Third preference: Resend fallback
  try {
    return await sendEmailFallback({ to, subject, html: finalHtml, text });
  } catch (resendErr) {
    console.warn('[Email] Resend fallback also failed or not configured:', resendErr);
  }

  // If no providers succeeded, log detailed instructions so setup is obvious without crashing UI
  console.warn(`[Email] Email to "${to}" with subject "${subject}" could not be sent. Please configure BREVO_API_KEY or RESEND_API_KEY in Supabase secrets or .env.local.`);
  return { ok: false, warning: 'NO_ACTIVE_EMAIL_PROVIDER' };
}

/** Helper to build full email HTML using the template */
function buildEmail(title: string, bodyHtml: string): string {
  return renderTemplate({ title, bodyHtml });
}

/** Transactional emails */
export async function sendVerificationEmail(email: string, code: string, expiry: number) {
  const title = 'Your verification code for LegacySKool';
  const bodyHtml = copies.verificationBody({ code, expiry });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendPasswordResetEmail(email: string, resetLink: string, expiry: number) {
  const title = 'Reset your LegacySKool password';
  const bodyHtml = copies.passwordResetBody({ resetLink }).replace('{EXPIRY_MIN}', expiry.toString());
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

/** Onboarding notice – sent immediately after request */
export async function sendOnboardingNotice(email: string, schoolName: string) {
  const title = 'Your school portal is being prepared';
  const bodyHtml = copies.onboardingNoticeBody({ schoolName });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

/** Final portal‑ready email */
export async function sendPortalReady(email: string, portalLink: string) {
  const title = 'Your LegacySKool school portal is ready';
  const bodyHtml = copies.portalReadyBody({ portalLink });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

/** Promotional / marketing helpers */
export async function sendFeatureSpotlight(email: string, featureName: string, ctaLink: string) {
  const title = `Introducing ${featureName} for your school`;
  const bodyHtml = copies.featureSpotlightBody({ featureName, ctaLink });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendSeasonalCampaign(email: string, ctaLink: string) {
  const title = 'Get ready for the new term with LegacySKool';
  const bodyHtml = copies.seasonalCampaignBody({ ctaLink });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendReferralProgram(email: string, referralLink: string) {
  const title = 'Invite a colleague and grow the LegacySKool community';
  const bodyHtml = copies.referralProgramBody({ referralLink });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

/** 4-Week Campaign Senders matching marketing roadmap */
export async function sendCampaignWeek1(email: string, schoolName: string) {
  const title = 'Your School Portal Is Being Prepared';
  const bodyHtml = copies.campaignWeek1WelcomeBody({ schoolName });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendCampaignWeek2(email: string, ctaLink: string) {
  const title = 'Simplify Attendance Tracking';
  const bodyHtml = copies.campaignWeek2AttendanceBody({ ctaLink });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendCampaignWeek3(email: string, ctaLink: string, discount = '15%') {
  const title = 'Back-to-School Bundle – 15 % Off';
  const bodyHtml = copies.campaignWeek3BackToSchoolBody({ ctaLink, discount });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendCampaignWeek4(email: string, referralLink: string) {
  const title = 'Invite a Colleague – Earn Credits';
  const bodyHtml = copies.campaignWeek4ReferralBody({ referralLink });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendCampaignEmail(
  week: 1 | 2 | 3 | 4,
  email: string,
  params: { schoolName?: string; ctaLink?: string; referralLink?: string; discount?: string }
) {
  switch (week) {
    case 1:
      return sendCampaignWeek1(email, params.schoolName || 'your school');
    case 2:
      return sendCampaignWeek2(email, params.ctaLink || 'https://legacyskool.com');
    case 3:
      return sendCampaignWeek3(email, params.ctaLink || 'https://legacyskool.com', params.discount);
    case 4:
      return sendCampaignWeek4(email, params.referralLink || 'https://legacyskool.com/refer');
  }
}

/** Billing / receipt helpers */
export async function sendPaymentReceipt(email: string, params: { invoiceNumber: string; studentName: string; paymentMethod: string; breakdownTable: string; pdfLink: string }) {
  const title = `Your LegacySKool payment receipt (Invoice ${params.invoiceNumber})`;
  const bodyHtml = copies.paymentReceiptBody(params);
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendInvoice(email: string, params: { invoiceNumber: string; paymentMethod: string; breakdownTable: string; pdfLink: string }) {
  const title = `Your new LegacySKool invoice is available (Invoice ${params.invoiceNumber})`;
  const bodyHtml = copies.invoiceBody(params);
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

/** Subscription helpers */
export async function sendSubscriptionActivated(email: string, params: { planName: string; startDate: string; endDate: string; price: string; dashboardLink: string }) {
  const title = 'Your LegacySKool Premium subscription is active';
  const bodyHtml = copies.subscriptionActivatedBody(params);
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendAddonPurchase(email: string, params: { addonName: string; startDate: string; price: string; dashboardLink: string }) {
  const title = `Your LegacySKool ${params.addonName} module is ready`;
  const bodyHtml = copies.addonPurchaseBody(params);
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

/** Miscellaneous */
export async function sendAccountDeletionConfirmation(email: string) {
  const title = 'Your LegacySKool account has been successfully deleted';
  const bodyHtml = copies.accountDeletionBody();
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendDataExportReady(email: string, exportLink: string, expiry: number) {
  const title = 'Your LegacySKool data export is ready to download';
  const bodyHtml = copies.dataExportReadyBody({ exportLink, expiry });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

export async function sendTrialEndingReminder(email: string, endDate: string, dashboardLink: string) {
  const title = 'Your LegacySKool trial ends in a few days';
  const bodyHtml = copies.trialEndingReminderBody({ endDate, dashboardLink });
  const html = buildEmail(title, bodyHtml);
  return brevoSendEmail(email, title, html);
}

/** Fallback using Resend if Brevo fails */
export async function sendEmailFallback(params: { to: string; subject: string; html: string; text?: string }) {
  const text = params.text || params.html.replace(/\<[^>]+\>/g, '');
  return resendSendEmail({ to: params.to, subject: params.subject, html: params.html, text });
}
