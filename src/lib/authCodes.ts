import { supabase } from '@/integrations/supabase/client';
import { v4 as uuidv4 } from 'uuid';

export interface VerificationCode {
  id: string;
  email: string;
  code: string;
  expires_at: string; // ISO string
}

// Generate a 6‑digit numeric code
function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

/**
 * Create and store a verification code for the given email.
 * Returns the code (for emailing) and the DB record ID.
 */
export async function createVerificationCode(email: string): Promise<VerificationCode> {
  const code = generateCode();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString(); // 10 min
  const { data, error } = await supabase.from('auth_codes').insert({
    id: uuidv4(),
    email,
    code,
    expires_at: expiresAt,
  }).single();
  if (error) throw error;
  return data as VerificationCode;
}

/** Verify a code for an email. Returns true if valid and not expired. */
export async function verifyCode(email: string, code: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('auth_codes')
    .select('id, expires_at')
    .eq('email', email)
    .eq('code', code)
    .single();
  if (error) return false;
  if (!data) return false;
  const now = new Date();
  if (new Date(data.expires_at) < now) return false;
  // Optionally delete after verification
  await supabase.from('auth_codes').delete().eq('id', data.id);
  return true;
}
