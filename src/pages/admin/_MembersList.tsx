import { useEffect, useMemo, useState } from "react";
import { Search, Users, GraduationCap, FileText, Mail, Phone, MapPin, Cake, BadgeCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ExportMenu } from "@/components/ExportMenu";
import type { BrandedPDFOptions } from "@/lib/exporters";
import { cacheGet, cacheSet } from "@/lib/dataCache";
import { publicEmail, publicEmailForSearch, publicInitials, publicContact } from "@/lib/identity";

type Role = "student" | "teacher";
type Tone = "student" | "teacher";

export default function MembersList({ role, tone }: { role: Role; tone: Tone }) {
  const avatarClass = tone === "student" ? "bg-student/15 text-student" : "bg-teacher/15 text-teacher";
  const { school } = useSchool();
  const cacheKey = school ? `members:${school.id}:${role}` : "";
  const cached = cacheKey ? cacheGet<any[]>(cacheKey) : null;
  const [rows, setRows] = useState<any[]>(cached ?? []);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<any | null>(null);
  const [isLoading, setIsLoading] = useState(!cached);

  useEffect(() => {
    if (!school) return;
    const key = `members:${school.id}:${role}`;
    const c = cacheGet<any[]>(key);
    if (c) { setRows(c); setIsLoading(false); }
    else setIsLoading(true);
    (async () => {
      try {
        const { data: m } = await supabase.rpc("admin_list_memberships_with_profile", {
          _school: school.id,
          _role: role as any,
        });
        if (!m?.length) { setRows([]); cacheSet(key, []); return; }
        const ids = m.map((x: any) => x.user_id);
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id,full_name,email,phone,dob,gender,address,photo_url")
          .in("id", ids);
        const byId: Record<string, any> = {};
        profiles?.forEach(p => (byId[p.id] = p));
        const merged = m.map((x: any) => ({ ...x, ...(byId[x.user_id] || { id: x.user_id }) }));
        setRows(merged);
        cacheSet(key, merged);
      } finally {
        setIsLoading(false);
      }
    })();
  }, [school, role]);

  const filtered = useMemo(() => {
    if (!q.trim()) return rows;
    const s = q.toLowerCase();
    return rows.filter(r =>
      (r.full_name || "").toLowerCase().includes(s) ||
      publicEmailForSearch(r.email).toLowerCase().includes(s) ||
      (r.profile_data?.grade_level || "").toLowerCase?.().includes(s)
    );
  }, [rows, q]);

  const Icon = role === "student" ? Users : GraduationCap;
  const title = role === "student" ? "Students" : "Teachers";

  function directoryData(): BrandedPDFOptions {
    const headers = role === "student"
      ? ["Name", "Email", "Class", "Phone", "Joined"]
      : ["Name", "Email", "Subjects", "Phone", "Joined"];
    const tableRows = filtered.map(r => role === "student"
      ? [r.full_name || "—", publicEmail(r.email) || "—", r.profile_data?.grade_level || "—", r.phone || "—", new Date(r.created_at).toLocaleDateString()]
      : [r.full_name || "—", publicEmail(r.email) || "—", (r.profile_data?.subjects || []).join(", ") || "—", r.phone || "—", new Date(r.created_at).toLocaleDateString()]
    );
    return {
      title: `${title} Directory`,
      subtitle: `${filtered.length} ${role}${filtered.length === 1 ? "" : "s"}`,
      schoolName: school?.name,
      schoolLogo: school?.logo_url,
      stats: [{ label: `Total ${role}s`, value: String(filtered.length) }],
      sections: [{ kind: "table", heading: title, headers, rows: tableRows }],
      footerNote: `${title} directory · Confidential`,
    };
  }

  return (
    <SectionCard
      title={title}
      description={isLoading ? "Loading…" : `${rows.length} ${role === "student" ? "enrolled" : "active"}`}
      action={
        <div className="flex items-center gap-2">
          <ExportMenu data={directoryData} disabled={!filtered.length} />
        </div>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
              <div className="size-11 rounded-full animate-pulse bg-muted shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 animate-pulse bg-muted rounded" />
                <div className="h-3 w-1/2 animate-pulse bg-muted rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState icon={Icon} title={`No ${role}s yet`} desc={`Generate a ${role} invite code to onboard members.`} />
      ) : (
        <>
          <div className="relative mb-4 max-w-md">
            <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder={`Search ${role}s by name, email…`} value={q} onChange={e => setQ(e.target.value)} className="pl-9" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {filtered.map(r => {
              const name = r.full_name || "Unnamed";
              const initials = publicInitials(r);
              return (
                <button key={r.user_id} onClick={() => setSelected(r)}
                  className="text-left rounded-xl border border-border bg-card hover:bg-secondary/40 hover:border-primary/40 transition-colors p-4 flex items-center gap-3">
                  <Avatar className="size-11 shrink-0">
                    {r.photo_url && <AvatarImage src={r.photo_url} alt={name} />}
                    <AvatarFallback className={`text-sm font-medium ${avatarClass}`}>{initials || "?"}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{name}</div>
                    <div className="text-xs text-muted-foreground truncate">{publicContact(r) || "—"}</div>
                    <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                      {role === "student" && r.profile_data?.grade_level && (
                        <Badge variant="secondary" className="text-[10px]">{r.profile_data.grade_level}</Badge>
                      )}
                      {role === "teacher" && Array.isArray(r.profile_data?.subjects) && r.profile_data.subjects.slice(0, 2).map((s: string) => (
                        <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                      ))}
                      {r.bio_completed
                        ? <span className="text-[10px] text-success inline-flex items-center gap-0.5"><BadgeCheck className="size-3" /> Verified</span>
                        : <span className="text-[10px] text-warning">Profile incomplete</span>}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {filtered.length === 0 && (
            <div className="text-center text-sm text-muted-foreground py-8">No matches for "{q}".</div>
          )}
        </>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{selected?.full_name || "Member"}</DialogTitle></DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <Avatar className="size-16">
                  {selected.photo_url && <AvatarImage src={selected.photo_url} />}
                  <AvatarFallback className={`${avatarClass} text-lg`}>
                    {publicInitials(selected)}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="font-display font-semibold text-lg">{selected.full_name || "—"}</div>
                  <div className="text-sm text-muted-foreground">{publicEmail(selected.email) || selected.phone || "—"}</div>
                  <Badge variant="outline" className="mt-1 capitalize">{selected.role}</Badge>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {selected.phone && <Row icon={Phone} label="Phone" value={selected.phone} />}
                {publicEmail(selected.email) && <Row icon={Mail} label="Email" value={publicEmail(selected.email)!} />}
                {selected.dob && <Row icon={Cake} label="DOB" value={new Date(selected.dob).toLocaleDateString()} />}
                {selected.gender && <Row label="Gender" value={selected.gender} />}
                {selected.address && <Row icon={MapPin} label="Address" value={selected.address} />}
                {role === "student" && selected.profile_data?.grade_level && <Row label="Class" value={selected.profile_data.grade_level} />}
                {role === "student" && selected.profile_data?.parent_contact && <Row label="Parent contact" value={selected.profile_data.parent_contact} />}
                {role === "teacher" && Array.isArray(selected.profile_data?.subjects) && selected.profile_data.subjects.length > 0 && (
                  <Row label="Subjects" value={selected.profile_data.subjects.join(", ")} />
                )}
                {role === "teacher" && selected.profile_data?.qualifications && <Row label="Qualifications" value={selected.profile_data.qualifications} />}
                <Row label="Joined" value={new Date(selected.created_at).toLocaleDateString()} />
                <Row label="Profile" value={selected.bio_completed ? "Verified" : "Incomplete"} />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </SectionCard>
  );
}

function Row({ icon: Icon, label, value }: { icon?: any; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2 min-w-0 rounded-lg border border-border p-2.5 bg-card">
      {Icon && <Icon className="size-3.5 text-muted-foreground mt-0.5 shrink-0" />}
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
        <div className="truncate text-sm">{value}</div>
      </div>
    </div>
  );
}