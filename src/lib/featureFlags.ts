import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Per-school feature flags. Resolved server-side via the `is_feature_enabled`
 * RPC so overrides and rollout buckets are consistent for every client.
 *
 * Also exposes the raw list of school overrides for admins/debug UIs.
 */

export interface ResolvedFlag {
  flag_key: string;
  name: string;
  category: string;
  enabled: boolean;
  is_kill_switch: boolean;
}

/** Single-flag check. Returns undefined while loading. */
export function useFeatureFlag(schoolId: string | undefined | null, key: string) {
  const q = useQuery({
    queryKey: ["feature-flag", schoolId, key],
    enabled: !!schoolId && !!key,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("is_feature_enabled" as any, {
        _school_id: schoolId, _key: key,
      });
      if (error) throw error;
      return Boolean(data);
    },
  });
  return { enabled: q.data, loading: q.isLoading };
}

/** Bulk check: returns a map of key -> boolean for the school. */
export function useFeatureFlags(schoolId: string | undefined | null, keys: string[]) {
  return useQuery({
    queryKey: ["feature-flags", schoolId, keys.slice().sort().join(",")],
    enabled: !!schoolId && keys.length > 0,
    staleTime: 60_000,
    queryFn: async () => {
      const entries = await Promise.all(keys.map(async (k) => {
        const { data } = await supabase.rpc("is_feature_enabled" as any, {
          _school_id: schoolId, _key: k,
        });
        return [k, Boolean(data)] as const;
      }));
      return Object.fromEntries(entries) as Record<string, boolean>;
    },
  });
}

/** Imperative check for non-hook contexts (e.g. inside event handlers). */
export async function isFeatureEnabled(schoolId: string, key: string) {
  const { data } = await supabase.rpc("is_feature_enabled" as any, {
    _school_id: schoolId, _key: key,
  });
  return Boolean(data);
}