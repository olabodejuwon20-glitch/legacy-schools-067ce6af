import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session, User } from "@supabase/supabase-js";
import { getResolvedSchoolSlug, storeSchoolSlug } from "@/lib/tenant";
import { trackAuthEvent } from "@/lib/analytics";

export type Role = "admin" | "teacher" | "student" | "parent";

export const ROLE_META: Record<Role, { name: string; subtitle: string; color: string; portal: string }> = {
  admin:   { name: "Admin",   subtitle: "Administrator", color: "hsl(var(--admin))",   portal: "School Management" },
  teacher: { name: "Teacher", subtitle: "Teacher",       color: "hsl(var(--teacher))", portal: "School Management" },
  student: { name: "Student", subtitle: "Student",       color: "hsl(var(--student))", portal: "Student Portal" },
  parent:  { name: "Parent",  subtitle: "Parent",        color: "hsl(var(--parent))",  portal: "Parent Portal" },
};

export interface School { id: string; name: string; slug: string; logo_url: string | null }
export interface Membership { school_id: string; role: Role; bio_completed?: boolean; must_change_pin?: boolean; admin_slot?: number | null }

interface Ctx {
  user: User | null;
  session: Session | null;
  loading: boolean;
  displayName: string;
  email: string;
  photoUrl: string | null;
  school: School | null;          // resolved-from-URL school (may be null on landing)
  schoolLoading: boolean;
  memberships: Membership[];      // all schools the current user belongs to
  activeRole: Role | null;        // role within `school` if member
  theme: "light" | "dark";
  toggleTheme: () => void;
  refreshMemberships: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSchool: () => Promise<void>;
  signOut: () => Promise<void>;
}
const SchoolContext = createContext<Ctx | null>(null);

const detectSlug = getResolvedSchoolSlug;

export function SchoolProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark">(() => (localStorage.getItem("edusmart-theme") as any) || "light");
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [school, setSchool] = useState<School | null>(null);
  const [schoolLoading, setSchoolLoading] = useState(true);
  const [memberships, setMemberships] = useState<Membership[]>([]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    localStorage.setItem("edusmart-theme", theme);
  }, [theme]);

  const loadSchoolFromContext = useCallback(async () => {
    const slug = detectSlug();
    if (!slug) { setSchool(null); setSchoolLoading(false); return; }
    setSchoolLoading(true);
    const { data } = await supabase.rpc("get_school_by_slug", { _slug: slug });
    const row = Array.isArray(data) ? data[0] : null;
    setSchool(row ?? null);
    if (row?.slug) storeSchoolSlug(row.slug);
    setSchoolLoading(false);
  }, []);

  // Resolve school from URL once
  useEffect(() => {
    loadSchoolFromContext();
  }, [loadSchoolFromContext]);

  useEffect(() => {
    if (loading || school || memberships.length === 0 || detectSlug()) return;

    let cancelled = false;
    setSchoolLoading(true);

    supabase
      .from("schools")
      .select("id,name,slug,logo_url")
      .eq("id", memberships[0].school_id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        const row = data as School | null;
        setSchool(row ?? null);
        if (row?.slug) storeSchoolSlug(row.slug);
        setSchoolLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [loading, memberships, school]);

  const loadMemberships = useCallback(async (uid: string) => {
    const { data } = await supabase.from("memberships").select("school_id,role,bio_completed,must_change_pin,admin_slot").eq("user_id", uid).eq("status", "active");
    setMemberships((data ?? []) as Membership[]);
  }, []);

  const loadProfile = useCallback(async (uid: string, fallbackEmail: string) => {
    const { data } = await supabase.from("profiles").select("full_name,email,photo_url").eq("id", uid).maybeSingle();
    setDisplayName(data?.full_name || fallbackEmail);
    setEmail(data?.email || fallbackEmail);
    setPhotoUrl(data?.photo_url ?? null);
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) {
        setTimeout(() => {
          loadProfile(s.user.id, s.user.email ?? "");
          loadMemberships(s.user.id);
          if (event === "SIGNED_IN") trackAuthEvent("sign_in", s.user.id);
        }, 0);
      } else {
        setDisplayName(""); setEmail(""); setPhotoUrl(null); setMemberships([]);
        if (event === "SIGNED_OUT") trackAuthEvent("sign_out");
      }
    });
    supabase.auth.getSession().then(async ({ data: { session: s } }) => {
      setSession(s); setUser(s?.user ?? null);
      if (s?.user) {
        await Promise.all([loadProfile(s.user.id, s.user.email ?? ""), loadMemberships(s.user.id)]);
      }
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, [loadMemberships, loadProfile]);

  const activeRole = school ? (memberships.find(m => m.school_id === school.id)?.role ?? null) : null;

  const refreshMemberships = async () => { if (user) await loadMemberships(user.id); };
  const refreshProfile = async () => { if (user) await loadProfile(user.id, user.email ?? ""); };
  const refreshSchool = async () => { await loadSchoolFromContext(); };
  const signOut = async () => { await supabase.auth.signOut(); };

  return (
    <SchoolContext.Provider value={{
      user, session, loading, displayName, email, photoUrl,
      school, schoolLoading, memberships, activeRole,
      theme, toggleTheme: () => setTheme(t => t === "light" ? "dark" : "light"),
      refreshMemberships, refreshProfile, refreshSchool, signOut,
    }}>{children}</SchoolContext.Provider>
  );
}

export const useSchool = () => {
  const c = useContext(SchoolContext);
  if (!c) throw new Error("useSchool must be used within SchoolProvider");
  return c;
};
