import { useEffect, useMemo, useState } from "react";
import { UserSquare2, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { publicContact, publicEmailForSearch, publicInitials } from "@/lib/identity";

export default function TeacherParents() {
  const { school, user } = useSchool();
  const [parents, setParents] = useState<any[]>([]);
  const [students, setStudents] = useState<Record<string, any>>({});
  const [links, setLinks] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const { data: cls } = await supabase.from("classes").select("id").eq("teacher_id", user.id);
      const cids = cls?.map(c => c.id) ?? [];
      if (!cids.length) return;
      const { data: enr } = await supabase.from("class_enrollments").select("student_id").in("class_id", cids);
      const sids = Array.from(new Set((enr ?? []).map(e => e.student_id)));
      if (!sids.length) return;
      const [{ data: pl }, { data: sProfs }] = await Promise.all([
        supabase.from("parent_links").select("parent_user_id,student_user_id").eq("school_id", school.id).in("student_user_id", sids),
        supabase.from("profiles").select("id,full_name,email").in("id", sids),
      ]);
      setLinks(pl ?? []);
      const sMap: Record<string, any> = {};
      sProfs?.forEach(p => sMap[p.id] = p);
      setStudents(sMap);
      const pids = Array.from(new Set((pl ?? []).map(l => l.parent_user_id)));
      if (!pids.length) return;
      const { data: pProfs } = await supabase.from("profiles").select("id,full_name,email,phone,photo_url").in("id", pids);
      setParents(pProfs ?? []);
    })();
  }, [school, user]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return parents;
    return parents.filter(p => `${p.full_name ?? ""} ${publicEmailForSearch(p.email)} ${p.phone ?? ""}`.toLowerCase().includes(s));
  }, [parents, q]);

  const childrenOf = (pid: string) =>
    links.filter(l => l.parent_user_id === pid).map(l => students[l.student_user_id]).filter(Boolean);

  return (
    <SectionCard title="Parents" description={`Parents of your students · ${filtered.length} of ${parents.length} (read-only)`}
      action={
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="pl-8 w-[220px]" />
        </div>
      }>
      {filtered.length === 0 ? (
        <EmptyState icon={UserSquare2} title="No parents connected yet" desc="When parents link their accounts to their children, their contact details will show up here." />
      ) : (
        <ul className="divide-y divide-border">
          {filtered.map(p => {
            const kids = childrenOf(p.id);
            return (
              <li key={p.id} className="py-3 flex items-center gap-3">
                <Avatar className="size-9"><AvatarImage src={p.photo_url ?? undefined} /><AvatarFallback>{publicInitials(p)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{p.full_name || "Unnamed parent"}</div>
                  <div className="text-xs text-muted-foreground truncate">{publicContact(p) || "—"}</div>
                </div>
                <div className="hidden sm:flex gap-1 flex-wrap justify-end max-w-[45%]">
                  {kids.slice(0,3).map((k: any) => <Badge key={k.id} variant="secondary" className="text-[10px]">{k.full_name || "Student"}</Badge>)}
                  {kids.length > 3 && <Badge variant="outline" className="text-[10px]">+{kids.length - 3}</Badge>}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}