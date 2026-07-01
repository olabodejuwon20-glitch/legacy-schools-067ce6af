import { supabase } from "@/integrations/supabase/client";

const KEY = "impersonation:current";

export type ImpersonationState = {
  sessionId: string;
  targetUserId: string;
  targetName: string;
  targetRole: string | null;
  schoolId: string | null;
  schoolName: string | null;
  schoolSlug: string | null;
  reason: string;
  startedAt: string;
  expiresAt: string;
};

export function getImpersonation(): ImpersonationState | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as ImpersonationState;
    if (new Date(s.expiresAt).getTime() <= Date.now()) {
      localStorage.removeItem(KEY);
      return null;
    }
    return s;
  } catch { return null; }
}

export function setImpersonation(s: ImpersonationState) {
  localStorage.setItem(KEY, JSON.stringify(s));
  window.dispatchEvent(new CustomEvent("impersonation:change"));
}

export function clearImpersonation() {
  localStorage.removeItem(KEY);
  window.dispatchEvent(new CustomEvent("impersonation:change"));
}

export async function startImpersonation(input: {
  targetUserId: string;
  targetName: string;
  targetRole: string | null;
  schoolId: string | null;
  schoolName: string | null;
  schoolSlug: string | null;
  reason: string;
  durationMinutes: number;
}): Promise<ImpersonationState> {
  const { data, error } = await supabase.rpc("start_impersonation" as any, {
    _target_user: input.targetUserId,
    _school_id: input.schoolId,
    _reason: input.reason,
    _duration_minutes: input.durationMinutes,
  });
  if (error) throw error;
  const state: ImpersonationState = {
    sessionId: data as string,
    targetUserId: input.targetUserId,
    targetName: input.targetName,
    targetRole: input.targetRole,
    schoolId: input.schoolId,
    schoolName: input.schoolName,
    schoolSlug: input.schoolSlug,
    reason: input.reason,
    startedAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + input.durationMinutes * 60_000).toISOString(),
  };
  setImpersonation(state);
  return state;
}

export async function endImpersonation(reason = "manual") {
  const s = getImpersonation();
  if (s) {
    try { await supabase.rpc("end_impersonation" as any, { _session_id: s.sessionId, _reason: reason }); } catch {}
  }
  clearImpersonation();
}