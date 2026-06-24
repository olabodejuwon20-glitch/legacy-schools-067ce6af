import { useEffect, useMemo, useState } from "react";
import { Users, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { publicContact, publicEmailForSearch, publicInitials } from "@/lib/identity";

export default function TeacherStudents() {
  const { school, user } = useSchool();
  const [rows, setRows] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [byClass, setByClass] = useState<Record<string, string[]>>({});
  const [q, setQ] = useState("");
  const [classId, setClassId] = useState("all");

  useEffect(() => {
    if (!school || !user) return;
    (async () => {
      const { data: cls } = await supabase.from("classes").select("id,code,name").eq("teacher_id", user.id);
      setClasses(cls ?? []);
      const ids = cls?.map(c => c.id) ?? [];
      if (!ids.length) return setRows([]);
      const { data: enr } = await supabase.from("class_enrollments").select("student_id,class_id").in("class_id", ids);
      const map: Record<string, string[]> = {};
      enr?.forEach(e => { (map[e.class_id] ||= []).push(e.student_id); });
      setByClass(map);
      const sids = Array.from(new Set(enr?.map(e => e.student_id) ?? []));
      if (!sids.length) return setRows([]);
      const { data: profs } = await supabase.from("profiles").select("id,full_name,email,photo_url,phone").in("id", sids);
      setRows(profs ?? []);
    })();
  }, [school, user]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    const allowed = classId === "all" ? null : new Set(byClass[classId] ?? []);
    return rows.filter(r => {
      if (allowed && !allowed.has(r.id)) return false;
      if (!s) return true;
      return `${r.full_name ?? ""} ${publicEmailForSearch(r.email)} ${r.phone ?? ""}`.toLowerCase().includes(s);
    });
  }, [rows, q, classId, byClass]);

  return (
    <SectionCard title="My Students" description={`${filtered.length} of ${rows.length}`}
      action={
        <div className="flex gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:flex-none">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="pl-8 w-full sm:w-[200px]" />
          </div>
          <Select value={classId} onValueChange={setClassId}>
            <SelectTrigger className="w-[130px] sm:w-[160px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All classes</SelectItem>
              {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.code}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      }>
      {filtered.length === 0 ? <EmptyState icon={Users} title="No students" /> :
        <ul className="divide-y divide-border">
          {filtered.map(s => {
            const inClasses = classes.filter(c => byClass[c.id]?.includes(s.id));
            return (
              <li key={s.id} className="py-3 flex items-center gap-3">
                <Avatar className="size-9"><AvatarImage src={s.photo_url ?? undefined} /><AvatarFallback>{publicInitials(s)}</AvatarFallback></Avatar>
                <div className="flex-1 min-w-0">
                  <div className="font-medium truncate">{s.full_name || "Unnamed student"}</div>
                  <div className="text-xs text-muted-foreground truncate">{publicContact(s) || "—"}</div>
                </div>
                <div className="hidden sm:flex gap-1 flex-wrap justify-end max-w-[40%]">
                  {inClasses.slice(0,3).map(c => <Badge key={c.id} variant="secondary" className="text-[10px]">{c.code}</Badge>)}
                  {inClasses.length > 3 && <Badge variant="outline" className="text-[10px]">+{inClasses.length - 3}</Badge>}
                </div>
              </li>
            );
          })}
        </ul>}
    </SectionCard>
  );
}
