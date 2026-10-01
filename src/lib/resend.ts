export interface SendEmailParams {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
}

export function getResendApiKey(): string | undefined {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_RESEND_API_KEY) return import.meta.env.VITE_RESEND_API_KEY;
    if ((import.meta.env as any).RESEND_API_KEY) return (import.meta.env as any).RESEND_API_KEY;
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.RESEND_API_KEY) return process.env.RESEND_API_KEY;
    if (process.env.VITE_RESEND_API_KEY) return process.env.VITE_RESEND_API_KEY;
  }
  return undefined;
}

export function getResendSender(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_RESEND_SENDER_EMAIL) return import.meta.env.VITE_RESEND_SENDER_EMAIL;
  if (typeof process !== 'undefined' && process.env?.RESEND_SENDER_EMAIL) return process.env.RESEND_SENDER_EMAIL;
  return 'LegacySKool <onboarding@resend.dev>';
}

export async function sendEmail({ to, subject, html, text, from }: SendEmailParams) {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is not configured');
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: from || getResendSender(),
      to,
      subject,
      html,
      text,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    console.error('Resend error response:', data);
    throw new Error(`Resend email failed: ${data.message || data.error || response.statusText}`);
  }
  return data;
}

