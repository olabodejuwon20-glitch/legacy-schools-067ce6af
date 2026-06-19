import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type PilotStatus = "none" | "active" | "expired" | "converted";

export interface PilotInfo {
  pilot_status: PilotStatus;
  pilot_started_at: string | null;
  pilot_ends_at: string | null;
  pilot_premium_until: string | null;
  pilot_converted_at: string | null;
  days_remaining: number | null;
  premium_unlocked: boolean;
  read_only: boolean;
  plan: string;
  status: string;
}

const cache = new Map<string, { at: number; info: PilotInfo }>();
const TTL = 60_000;

export async function fetchPilot(schoolId: string, force = false): Promise<PilotInfo | null> {
  const hit = cache.get(schoolId);
  if (!force && hit && Date.now() - hit.at < TTL) return hit.info;
  const { data, error } = await supabase.rpc("pilot_my_status", { _school_id: schoolId });
  if (error || !data) return null;
  const info = data as unknown as PilotInfo;
  cache.set(schoolId, { at: Date.now(), info });
  return info;
}

export function usePilot(schoolId: string | undefined | null) {
  const [info, setInfo] = useState<PilotInfo | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!schoolId) { setInfo(null); setLoading(false); return; }
    setLoading(true);
    const r = await fetchPilot(schoolId, true);
    setInfo(r);
    setLoading(false);
  }, [schoolId]);

  useEffect(() => {
    let alive = true;
    if (!schoolId) { setInfo(null); setLoading(false); return; }
    setLoading(true);
    fetchPilot(schoolId).then(r => { if (alive) { setInfo(r); setLoading(false); } });
    return () => { alive = false; };
  }, [schoolId]);

  return { pilot: info, loading, reload };
}

export function pilotProgress(info: PilotInfo | null): number {
  if (!info?.pilot_started_at || !info.pilot_ends_at) return 0;
  const start = new Date(info.pilot_started_at).getTime();
  const end = new Date(info.pilot_ends_at).getTime();
  const now = Date.now();
  if (now >= end) return 100;
  if (now <= start) return 0;
  return Math.round(((now - start) / (end - start)) * 100);
}

export function pilotTone(info: PilotInfo | null): "ok" | "warn" | "bad" | "muted" {
  if (!info || info.pilot_status === "none") return "muted";
  if (info.pilot_status === "converted") return "ok";
  if (info.pilot_status === "expired") return "bad";
  const d = info.days_remaining ?? 0;
  if (d <= 7) return "bad";
  if (d <= 14) return "warn";
  return "ok";
}