import { useEffect, useMemo, useState } from "react";
import {
  Loader2, Sparkles, GraduationCap, BookOpen, Building2, Users, Layers,
  Plus, Pencil, Archive, Search, ChevronRight, CheckCircle2, Clock,
  ArrowRightCircle, Trash2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { cn } from "@/lib/utils";
import { useAdminPermissions } from "@/lib/adminPermissions";
import {
  listTemplates, getSchoolStructure, applyTemplate, promoteArm,
  type AcademicTemplate, type AClass, type Level, type Department, type Arm, type Subject,
} from "@/lib/academic";

export default function AcademicPage() {
  const { school } = useSchool();
  const { isFullAdmin, canEdit, can } = useAdminPermissions();
  const mayView = isFullAdmin || can("academic") || can("classes");
  const mayEdit = isFullAdmin || canEdit("academic") || canEdit("classes");

  if (!school) return <div className="py-16 grid place-items-center"><Loader2 className="size-5 animate-spin" /></div>;
  if (!mayView) {
    return (
      <div className="max-w-md mx-auto py-16 text-center space-y-3">
        <SEO title="Academic Structure" description="Academic structure" path="/admin/academic" />
        <h1 className="font-display text-lg font-semibold">Restricted</h1>
        <p className="text-sm text-muted-foreground">Ask your admin to grant you access on the Roles page.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <SEO title="Academic Structure" description="Manage levels, classes, arms, departments, subjects and promotion." path="/admin/academic" />
      <header className="flex items-center gap-3">
        <div className="size-10 rounded-lg bg-primary text-primary-foreground grid place-items-center">
          <GraduationCap className="size-5" />
        </div>
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-semibold tracking-tight">Academic Structure</h1>
          <p className="text-xs text-muted-foreground">Configure your school's classes, arms, departments and subjects.</p>
        </div>
      </header>

      <Tabs defaultValue="structure">
        <div className="-mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto no-scrollbar">
          <TabsList className="inline-flex w-max sm:w-full sm:flex-wrap h-auto gap-1 p-1">
            <TabsTrigger className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-3" value="structure">Structure</TabsTrigger>
            <TabsTrigger className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-3" value="classes">Classes &amp; Arms</TabsTrigger>
            <TabsTrigger className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-3" value="departments">Departments</TabsTrigger>
            <TabsTrigger className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-3" value="subjects">Subjects</TabsTrigger>
            <TabsTrigger className="shrink-0 whitespace-nowrap text-xs sm:text-sm px-3" value="promotion">Promotion</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="structure" className="mt-4"><StructureTab mayEdit={mayEdit} /></TabsContent>
        <TabsContent value="classes" className="mt-4"><ClassesTab mayEdit={mayEdit} /></TabsContent>
        <TabsContent value="departments" className="mt-4"><DepartmentsTab mayEdit={mayEdit} /></TabsContent>
        <TabsContent value="subjects" className="mt-4"><SubjectsTab mayEdit={mayEdit} /></TabsContent>
        <TabsContent value="promotion" className="mt-4"><PromotionTab mayEdit={mayEdit} /></TabsContent>
      </Tabs>
    </div>
  );
}

/* =========================================================================
 * STRUCTURE TAB — template chooser
 * ========================================================================= */
function StructureTab({ mayEdit }: { mayEdit: boolean }) {
  const { school } = useSchool();
  const [templates, setTemplates] = useState<AcademicTemplate[]>([]);
  const [linked, setLinked] = useState<string | null>(null);
  const [counts, setCounts] = useState({ levels: 0, classes: 0, departments: 0, subjects: 0, arms: 0 });
  const [busy, setBusy] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!school) return;
    setLoading(true);
    const [t, s, l, c, d, sub, arm] = await Promise.all([
      listTemplates(),
      getSchoolStructure(school.id),
      supabase.from("academic_levels").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("academic_classes").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("academic_departments").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("academic_subjects").select("id", { count: "exact", head: true }).eq("school_id", school.id),
      supabase.from("academic_arms").select("id", { count: "exact", head: true }).eq("school_id", school.id),
    ]);
    setTemplates(t);
    setLinked(s?.template_code ?? null);
    setCounts({
      levels: l.count ?? 0, classes: c.count ?? 0, departments: d.count ?? 0,
      subjects: sub.count ?? 0, arms: arm.count ?? 0,
    });
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  async function activate(code: string) {
    if (!school || !mayEdit) return;
    setBusy(code);
    try {
      const r: any = await applyTemplate(school.id, code);
      toast.success(`Template applied — ${r?.classes ?? 0} classes, ${r?.subjects ?? 0} subjects ready.`);
      load();
    } catch (e: any) { toast.error(e?.message || "Could not apply template"); }
    finally { setBusy(null); }
  }

  if (loading) return <div className="py-12 grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat icon={<Layers className="size-4" />}    label="Levels"      value={counts.levels} />
        <Stat icon={<BookOpen className="size-4" />}  label="Classes"     value={counts.classes} />
        <Stat icon={<Users className="size-4" />}     label="Arms"        value={counts.arms} />
        <Stat icon={<Building2 className="size-4" />} label="Departments" value={counts.departments} />
        <Stat icon={<GraduationCap className="size-4" />} label="Subjects"  value={counts.subjects} />
      </div>

      <div>
        <h2 className="font-display text-base font-semibold mb-1">Select academic structure</h2>
        <p className="text-xs text-muted-foreground mb-3">
          Nigerian Secondary School ships ready. More templates land soon — your data model is already future-proof.
        </p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {templates.map(t => {
            const isLinked = linked === t.code;
            const disabled = !t.is_active || !mayEdit;
            return (
              <div key={t.code}
                className={cn("relative rounded-lg border p-4 flex flex-col gap-2",
                  isLinked ? "border-primary bg-primary/5" : "border-border bg-card",
                  !t.is_active && "opacity-70")}>
                <div className="flex items-start gap-2">
                  <div className="size-8 rounded-md bg-primary/10 text-primary grid place-items-center"><Sparkles className="size-4" /></div>
                  <div className="min-w-0">
                    <div className="font-semibold text-sm truncate">{t.name}</div>
                    <div className="text-[11px] text-muted-foreground truncate">{t.country || "Global"}</div>
                  </div>
                  {isLinked && <CheckCircle2 className="size-4 text-primary ml-auto shrink-0" />}
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2lh]">{t.description || "—"}</p>
                <div className="flex items-center justify-between gap-2 mt-1">
                  <span className={cn("inline-flex items-center gap-1 text-[10px] uppercase tracking-wider",
                    t.is_active ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground")}>
                    {t.is_active ? <><CheckCircle2 className="size-3" /> Available</> : <><Clock className="size-3" /> Coming soon</>}
                  </span>
                  <Button size="sm" variant={isLinked ? "outline" : "default"}
                    disabled={disabled || busy === t.code}
                    onClick={() => activate(t.code)}>
                    {busy === t.code ? <Loader2 className="size-3.5 animate-spin mr-1.5" /> : null}
                    {isLinked ? "Re-apply defaults" : "Activate"}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card px-4 py-3">
      <div className="flex items-center gap-2 text-muted-foreground text-xs">{icon}<span>{label}</span></div>
      <div className="text-2xl font-display font-semibold mt-1">{value}</div>
    </div>
  );
}

/* =========================================================================
 * CLASSES & ARMS TAB
 * ========================================================================= */
function ClassesTab({ mayEdit }: { mayEdit: boolean }) {
  const { school } = useSchool();
  const [classes, setClasses] = useState<AClass[]>([]);
  const [levels, setLevels] = useState<Level[]>([]);
  const [arms, setArms] = useState<Arm[]>([]);
  const [armCounts, setArmCounts] = useState<Record<string, number>>({});
  const [enrollCounts, setEnrollCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [drawerClass, setDrawerClass] = useState<AClass | null>(null);

  async function load() {
    if (!school) return;
    setLoading(true);
    const [c, l, a, ec] = await Promise.all([
      supabase.from("academic_classes").select("*").eq("school_id", school.id).order("sort_order"),
      supabase.from("academic_levels").select("*").eq("school_id", school.id).order("sort_order"),
      supabase.from("academic_arms").select("*").eq("school_id", school.id),
      supabase.from("arm_enrollments").select("arm_id").eq("school_id", school.id).eq("status", "active"),
    ]);
    setClasses((c.data as any) || []);
    setLevels((l.data as any) || []);
    setArms((a.data as any) || []);
    const armsByClass: Record<string, number> = {};
    ((a.data as Arm[]) || []).forEach(x => { armsByClass[x.class_id] = (armsByClass[x.class_id] || 0) + 1; });
    setArmCounts(armsByClass);
    const enrolls: Record<string, number> = {};
    ((ec.data as any[]) || []).forEach((r) => { enrolls[r.arm_id] = (enrolls[r.arm_id] || 0) + 1; });
    setEnrollCounts(enrolls);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter(c => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q));
  }, [classes, query]);

  function studentCountForClass(classId: string) {
    return arms.filter(a => a.class_id === classId).reduce((sum, a) => sum + (enrollCounts[a.id] || 0), 0);
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search classes" className="h-8 pl-8 text-sm bg-background" />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} class{filtered.length === 1 ? "" : "es"}</span>
      </div>

      {loading ? (
        <div className="py-16 grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          No classes yet. Activate a template on the <b>Structure</b> tab to generate the defaults.
        </div>
      ) : (
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">Class</th>
              <th className="text-left font-medium px-4 py-2.5">Level</th>
              <th className="text-left font-medium px-4 py-2.5">Arms</th>
              <th className="text-left font-medium px-4 py-2.5">Students</th>
              <th className="text-left font-medium px-4 py-2.5">Capacity</th>
              <th className="text-left font-medium px-4 py-2.5">Status</th>
              <th className="px-2 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(c => {
              const lvl = levels.find(l => l.id === c.level_id);
              return (
                <tr key={c.id} className="border-t border-border hover:bg-muted/30 cursor-pointer"
                    onClick={() => setDrawerClass(c)}>
                  <td className="px-4 py-2.5"><div className="font-medium">{c.name}</div><div className="text-[11px] text-muted-foreground">{c.code}</div></td>
                  <td className="px-4 py-2.5 text-muted-foreground">{lvl?.name || "—"}</td>
                  <td className="px-4 py-2.5">{armCounts[c.id] || 0}</td>
                  <td className="px-4 py-2.5">{studentCountForClass(c.id)}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{c.capacity ?? "—"}</td>
                  <td className="px-4 py-2.5">
                    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium",
                      c.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                      {c.status}
                    </span>
                  </td>
                  <td className="px-2 py-2.5 text-right"><ChevronRight className="size-4 text-muted-foreground" /></td>
                </tr>
              );
            })}
          </tbody>
        </table></div>
      )}

      <ClassDrawer cls={drawerClass} open={!!drawerClass} onClose={() => setDrawerClass(null)} onChanged={load} mayEdit={mayEdit} />
    </div>
  );
}

function ClassDrawer({ cls, open, onClose, onChanged, mayEdit }:
  { cls: AClass | null; open: boolean; onClose: () => void; onChanged: () => void; mayEdit: boolean }) {
  const { school } = useSchool();
  const [arms, setArms] = useState<Arm[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingArm, setEditingArm] = useState<Partial<Arm> | null>(null);

  async function reload() {
    if (!cls || !school) return;
    const [a, d] = await Promise.all([
      supabase.from("academic_arms").select("*").eq("class_id", cls.id).order("name"),
      supabase.from("academic_departments").select("*").eq("school_id", school.id).eq("status", "active").order("name"),
    ]);
    setArms((a.data as any) || []);
    setDepartments((d.data as any) || []);
  }
  useEffect(() => { if (open && cls) reload(); /* eslint-disable-next-line */ }, [open, cls?.id]);

  async function saveArm() {
    if (!school || !cls || !editingArm || !mayEdit) return;
    const name = (editingArm.name || "").trim();
    if (!name) return toast.error("Arm name is required");
    setBusy(true);
    try {
      const payload: any = {
        school_id: school.id, class_id: cls.id,
        name, code: (editingArm.code || name).toUpperCase().replace(/\s+/g, "_"),
        department_id: editingArm.department_id || null,
        capacity: editingArm.capacity ?? null,
        status: "active",
      };
      if (editingArm.id) {
        const { error } = await supabase.from("academic_arms").update(payload).eq("id", editingArm.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academic_arms").insert(payload);
        if (error) throw error;
      }
      toast.success("Arm saved");
      setEditingArm(null);
      reload();
      onChanged();
    } catch (e: any) { toast.error(e?.message || "Could not save"); }
    finally { setBusy(false); }
  }

  async function archiveArm(arm: Arm) {
    if (!mayEdit) return;
    if (!confirm(`Archive arm "${arm.name}"?`)) return;
    const { error } = await supabase.from("academic_arms").update({ status: "archived" }).eq("id", arm.id);
    if (error) return toast.error(error.message);
    toast.success("Archived");
    reload(); onChanged();
  }

  return (
    <Sheet open={open} onOpenChange={v => !v && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        {cls && (
          <>
            <SheetHeader>
              <SheetTitle>{cls.name}</SheetTitle>
              <SheetDescription>{cls.code} · {cls.category || "—"}</SheetDescription>
            </SheetHeader>

            <div className="mt-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">Arms ({arms.length})</h3>
                {mayEdit && (
                  <Button size="sm" onClick={() => setEditingArm({ name: "", code: "" })}>
                    <Plus className="size-3.5 mr-1.5" /> Add arm
                  </Button>
                )}
              </div>

              {arms.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
                  No arms yet. Add one (e.g. <b>{cls.name} A</b>, <b>{cls.name} Science</b>).
                </p>
              ) : (
                <div className="rounded-lg border border-border divide-y divide-border">
                  {arms.map(a => (
                    <div key={a.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{a.name}</div>
                        <div className="text-[11px] text-muted-foreground truncate">
                          {a.code}{a.department_id ? " · " + (departments.find(d => d.id === a.department_id)?.name || "—") : ""}
                          {a.capacity ? ` · cap ${a.capacity}` : ""}
                          {a.status !== "active" ? ` · ${a.status}` : ""}
                        </div>
                      </div>
                      {mayEdit && (
                        <>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditingArm(a)} title="Edit">
                            <Pencil className="size-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="size-7" onClick={() => archiveArm(a)} title="Archive">
                            <Archive className="size-3.5 text-muted-foreground" />
                          </Button>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <Dialog open={!!editingArm} onOpenChange={v => !v && setEditingArm(null)}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{editingArm?.id ? "Edit arm" : "New arm"}</DialogTitle>
              <DialogDescription>Arms are sub-sections of a class (e.g. SS1 Science, SS1 Arts).</DialogDescription>
            </DialogHeader>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Name</Label>
                <Input value={editingArm?.name || ""} onChange={e => setEditingArm(s => ({ ...s, name: e.target.value }))} placeholder={`${cls?.name || "SS1"} Science`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">Code</Label>
                  <Input value={editingArm?.code || ""} onChange={e => setEditingArm(s => ({ ...s, code: e.target.value }))} placeholder="Auto" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Capacity</Label>
                  <Input type="number" value={editingArm?.capacity ?? ""} onChange={e => setEditingArm(s => ({ ...s, capacity: e.target.value ? Number(e.target.value) : null }))} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Department (optional)</Label>
                <Select value={editingArm?.department_id || "none"} onValueChange={v => setEditingArm(s => ({ ...s, department_id: v === "none" ? null : v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— None —</SelectItem>
                    {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingArm(null)}>Cancel</Button>
              <Button onClick={saveArm} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Save</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </SheetContent>
    </Sheet>
  );
}

/* =========================================================================
 * DEPARTMENTS TAB
 * ========================================================================= */
function DepartmentsTab({ mayEdit }: { mayEdit: boolean }) {
  const { school } = useSchool();
  const [rows, setRows] = useState<Department[]>([]);
  const [editing, setEditing] = useState<Partial<Department> | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    if (!school) return;
    const { data } = await supabase.from("academic_departments").select("*").eq("school_id", school.id).order("name");
    setRows((data as any) || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  async function save() {
    if (!school || !editing || !mayEdit) return;
    const name = (editing.name || "").trim();
    if (!name) return toast.error("Name required");
    setBusy(true);
    try {
      const payload: any = {
        school_id: school.id, name,
        code: (editing.code || name).toLowerCase().replace(/\s+/g, "_"),
        description: editing.description || null,
        status: editing.status || "active",
      };
      if (editing.id) {
        const { error } = await supabase.from("academic_departments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academic_departments").insert(payload);
        if (error) throw error;
      }
      toast.success("Saved"); setEditing(null); load();
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
    finally { setBusy(false); }
  }
  async function archive(d: Department) {
    if (!mayEdit) return;
    if (!confirm(`Archive "${d.name}"?`)) return;
    const { error } = await supabase.from("academic_departments").update({ status: "archived" }).eq("id", d.id);
    if (error) return toast.error(error.message);
    toast.success("Archived"); load();
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center px-3 py-2 border-b border-border bg-muted/30">
        <span className="text-xs text-muted-foreground">{rows.length} department{rows.length === 1 ? "" : "s"}</span>
        {mayEdit && (
          <Button size="sm" className="ml-auto" onClick={() => setEditing({ name: "" })}>
            <Plus className="size-3.5 mr-1.5" /> New department
          </Button>
        )}
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">Name{"\u00a0 \u00a0\u00a0"}</th>
            <th className="text-left font-medium px-4 py-2.5">Code</th>
            <th className="text-left font-medium px-4 py-2.5">Status</th>
            <th className="px-2 py-2.5 w-20"></th>
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr><td colSpan={4} className="px-4 py-10 text-center text-muted-foreground text-sm">No departments yet.</td></tr>
          ) : rows.map(d => (
            <tr key={d.id} className="border-t border-border hover:bg-muted/30">
              <td className="px-4 py-2.5 font-medium">{d.name}</td>
              <td className="px-4 py-2.5 text-muted-foreground text-xs">{d.code}</td>
              <td className="px-4 py-2.5">
                <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium",
                  d.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                  {d.status}
                </span>
              </td>
              <td className="px-2 py-2.5 text-right">
                {mayEdit && (
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(d)}><Pencil className="size-3.5" /></Button>
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => archive(d)}><Archive className="size-3.5 text-muted-foreground" /></Button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table></div>

      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit department" : "New department"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label>
              <Input value={editing?.name || ""} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} placeholder="Technology" />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Code</Label>
              <Input value={editing?.code || ""} onChange={e => setEditing(s => ({ ...s, code: e.target.value }))} placeholder="Auto" />
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Description</Label>
              <Textarea value={editing?.description || ""} onChange={e => setEditing(s => ({ ...s, description: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* =========================================================================
 * SUBJECTS TAB
 * ========================================================================= */
function SubjectsTab({ mayEdit }: { mayEdit: boolean }) {
  const { school } = useSchool();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [arms, setArms] = useState<Arm[]>([]);
  const [classes, setClasses] = useState<AClass[]>([]);
  const [assignments, setAssignments] = useState<{ subject_id: string; arm_id: string; is_required: boolean }[]>([]);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<Partial<Subject> | null>(null);
  const [assignFor, setAssignFor] = useState<Subject | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  async function load() {
    if (!school) return;
    setLoading(true);
    const [s, d, a, c, sa] = await Promise.all([
      supabase.from("academic_subjects").select("*").eq("school_id", school.id).order("name"),
      supabase.from("academic_departments").select("*").eq("school_id", school.id).order("name"),
      supabase.from("academic_arms").select("*").eq("school_id", school.id).order("name"),
      supabase.from("academic_classes").select("*").eq("school_id", school.id).order("sort_order"),
      supabase.from("subject_arm_assignments").select("subject_id, arm_id, is_required").eq("school_id", school.id),
    ]);
    setSubjects((s.data as any) || []);
    setDepartments((d.data as any) || []);
    setArms((a.data as any) || []);
    setClasses((c.data as any) || []);
    setAssignments((sa.data as any) || []);
    setLoading(false);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return subjects.filter(s => !q || s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q));
  }, [subjects, query]);

  function armsFor(subjectId: string) { return assignments.filter(a => a.subject_id === subjectId); }

  async function save() {
    if (!school || !editing || !mayEdit) return;
    const name = (editing.name || "").trim();
    if (!name) return toast.error("Name required");
    setBusy(true);
    try {
      const payload: any = {
        school_id: school.id, name,
        code: (editing.code || name).toUpperCase().replace(/\s+/g, "_"),
        department_id: editing.department_id || null,
        category: editing.category || "core",
        description: editing.description || null,
        status: editing.status || "active",
      };
      if (editing.id) {
        const { error } = await supabase.from("academic_subjects").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("academic_subjects").insert(payload);
        if (error) throw error;
      }
      toast.success("Saved"); setEditing(null); load();
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
    finally { setBusy(false); }
  }
  async function archive(s: Subject) {
    if (!mayEdit) return;
    if (!confirm(`Archive "${s.name}"?`)) return;
    const { error } = await supabase.from("academic_subjects").update({ status: "archived" }).eq("id", s.id);
    if (error) return toast.error(error.message);
    toast.success("Archived"); load();
  }

  async function toggleAssignment(subject: Subject, arm: Arm, on: boolean, required: boolean) {
    if (!school || !mayEdit) return;
    if (on) {
      const { error } = await supabase.from("subject_arm_assignments")
        .upsert({ school_id: school.id, subject_id: subject.id, arm_id: arm.id, is_required: required },
          { onConflict: "school_id,subject_id,arm_id" } as any);
      if (error) return toast.error(error.message);
    } else {
      const { error } = await supabase.from("subject_arm_assignments").delete()
        .eq("school_id", school.id).eq("subject_id", subject.id).eq("arm_id", arm.id);
      if (error) return toast.error(error.message);
    }
    load();
  }

  if (loading) return <div className="py-12 grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border bg-muted/30">
        <div className="relative flex-1 max-w-sm">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search subjects" className="h-8 pl-8 text-sm bg-background" />
        </div>
        <span className="text-xs text-muted-foreground ml-auto">{filtered.length} shown</span>
        {mayEdit && (
          <Button size="sm" onClick={() => setEditing({ name: "", category: "core" })}>
            <Plus className="size-3.5 mr-1.5" /> New subject
          </Button>
        )}
      </div>

      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
          <tr>
            <th className="text-left font-medium px-4 py-2.5">Subject</th>
            <th className="text-left font-medium px-4 py-2.5">Department</th>
            <th className="text-left font-medium px-4 py-2.5">Category</th>
            <th className="text-left font-medium px-4 py-2.5">Arms</th>
            <th className="text-left font-medium px-4 py-2.5">Status</th>
            <th className="px-2 py-2.5 w-28"></th>
          </tr>
        </thead>
        <tbody>
          {filtered.length === 0 ? (
            <tr><td colSpan={6} className="px-4 py-10 text-center text-sm text-muted-foreground">No subjects yet.</td></tr>
          ) : filtered.map(s => {
            const dept = departments.find(d => d.id === s.department_id);
            const sAssigns = armsFor(s.id);
            return (
              <tr key={s.id} className="border-t border-border hover:bg-muted/30">
                <td className="px-4 py-2.5"><div className="font-medium">{s.name}</div><div className="text-[11px] text-muted-foreground">{s.code}</div></td>
                <td className="px-4 py-2.5 text-muted-foreground">{dept?.name || "—"}</td>
                <td className="px-4 py-2.5 capitalize text-xs">{s.category}</td>
                <td className="px-4 py-2.5">{sAssigns.length}</td>
                <td className="px-4 py-2.5">
                  <span className={cn("inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium",
                    s.status === "active" ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" : "bg-muted text-muted-foreground")}>
                    {s.status}
                  </span>
                </td>
                <td className="px-2 py-2.5 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="sm" variant="ghost" className="h-7" onClick={() => setAssignFor(s)}>Arms</Button>
                    {mayEdit && <>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(s)}><Pencil className="size-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="size-7" onClick={() => archive(s)}><Archive className="size-3.5 text-muted-foreground" /></Button>
                    </>}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table></div>

      {/* Edit subject dialog */}
      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit subject" : "New subject"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">Name</Label>
              <Input value={editing?.name || ""} onChange={e => setEditing(s => ({ ...s, name: e.target.value }))} placeholder="Physics" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Code</Label>
                <Input value={editing?.code || ""} onChange={e => setEditing(s => ({ ...s, code: e.target.value }))} placeholder="PHY" />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Category</Label>
                <Select value={editing?.category || "core"} onValueChange={v => setEditing(s => ({ ...s, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="core">Core</SelectItem>
                    <SelectItem value="junior">Junior</SelectItem>
                    <SelectItem value="department">Department</SelectItem>
                    <SelectItem value="elective">Elective</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Department</Label>
              <Select value={editing?.department_id || "none"} onValueChange={v => setEditing(s => ({ ...s, department_id: v === "none" ? null : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {departments.map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save} disabled={busy}>{busy ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Arms assignment drawer */}
      <Sheet open={!!assignFor} onOpenChange={v => !v && setAssignFor(null)}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {assignFor && (
            <>
              <SheetHeader>
                <SheetTitle>{assignFor.name}</SheetTitle>
                <SheetDescription>Assign this subject to arms. Students in those arms inherit it automatically.</SheetDescription>
              </SheetHeader>
              <div className="mt-4 space-y-4">
                {classes.map(c => {
                  const ca = arms.filter(a => a.class_id === c.id);
                  if (ca.length === 0) return null;
                  return (
                    <div key={c.id}>
                      <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">{c.name}</div>
                      <div className="rounded-lg border border-border divide-y divide-border">
                        {ca.map(a => {
                          const cur = assignments.find(x => x.subject_id === assignFor.id && x.arm_id === a.id);
                          const on = !!cur;
                          return (
                            <div key={a.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium truncate">{a.name}</div>
                                <div className="text-[11px] text-muted-foreground">{a.code}</div>
                              </div>
                              {on && (
                                <label className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                                  Required
                                  <Switch checked={!!cur?.is_required} disabled={!mayEdit}
                                    onCheckedChange={v => toggleAssignment(assignFor, a, true, v)} />
                                </label>
                              )}
                              <Switch checked={on} disabled={!mayEdit}
                                onCheckedChange={v => toggleAssignment(assignFor, a, v, cur?.is_required ?? true)} />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {arms.length === 0 && (
                  <p className="text-sm text-muted-foreground py-6 text-center border border-dashed border-border rounded-lg">
                    No arms exist yet. Create arms under a class first.
                  </p>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}

/* =========================================================================
 * PROMOTION TAB
 * ========================================================================= */
function PromotionTab({ mayEdit }: { mayEdit: boolean }) {
  const { school } = useSchool();
  const [classes, setClasses] = useState<AClass[]>([]);
  const [arms, setArms] = useState<Arm[]>([]);
  const [rules, setRules] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editing, setEditing] = useState<any>(null);

  async function load() {
    if (!school) return;
    const [c, a, r] = await Promise.all([
      supabase.from("academic_classes").select("*").eq("school_id", school.id).order("sort_order"),
      supabase.from("academic_arms").select("*").eq("school_id", school.id).eq("status", "active"),
      supabase.from("academic_promotion_rules").select("*").eq("school_id", school.id),
    ]);
    setClasses((c.data as any) || []);
    setArms((a.data as any) || []);
    setRules((r.data as any) || []);
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  async function saveRule() {
    if (!school || !editing || !mayEdit) return;
    setBusy("save");
    try {
      const payload = {
        school_id: school.id,
        from_class_id: editing.from_class_id,
        to_class_id: editing.to_class_id || null,
        min_average: Number(editing.min_average || 0),
        min_attendance_pct: Number(editing.min_attendance_pct || 0),
        notes: editing.notes || null,
      };
      const op = editing.id
        ? supabase.from("academic_promotion_rules").update(payload).eq("id", editing.id)
        : supabase.from("academic_promotion_rules").insert(payload);
      const { error } = await op;
      if (error) throw error;
      toast.success("Saved"); setEditing(null); load();
    } catch (e: any) { toast.error(e?.message || "Save failed"); }
    finally { setBusy(null); }
  }

  async function runPromotion(fromArmId: string, toArmId: string) {
    if (!confirm("Move all active students from this arm to the target arm?")) return;
    setBusy(fromArmId);
    try {
      const r: any = await promoteArm(fromArmId, toArmId);
      toast.success(`Promoted ${r?.moved ?? 0} student${r?.moved === 1 ? "" : "s"}`);
      load();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-sm font-semibold">Promotion rules</span>
          {mayEdit && (
            <Button size="sm" className="ml-auto" onClick={() => setEditing({})}><Plus className="size-3.5 mr-1.5" /> New rule</Button>
          )}
        </div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead className="text-[11px] uppercase tracking-wider text-muted-foreground bg-muted/20">
            <tr>
              <th className="text-left font-medium px-4 py-2.5">From class</th>
              <th className="text-left font-medium px-4 py-2.5">To class</th>
              <th className="text-left font-medium px-4 py-2.5">Min average</th>
              <th className="text-left font-medium px-4 py-2.5">Min attendance %</th>
              <th className="px-2 py-2.5 w-10"></th>
            </tr>
          </thead>
          <tbody>
            {rules.length === 0 ? (
              <tr><td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">No rules configured. Default is unrestricted promotion.</td></tr>
            ) : rules.map(r => (
              <tr key={r.id} className="border-t border-border">
                <td className="px-4 py-2.5">{classes.find(c => c.id === r.from_class_id)?.name || "—"}</td>
                <td className="px-4 py-2.5">{classes.find(c => c.id === r.to_class_id)?.name || "Graduation"}</td>
                <td className="px-4 py-2.5">{r.min_average ?? 0}</td>
                <td className="px-4 py-2.5">{r.min_attendance_pct ?? 0}%</td>
                <td className="px-2 py-2.5 text-right">
                  {mayEdit && (
                    <Button size="icon" variant="ghost" className="size-7" onClick={() => setEditing(r)}><Pencil className="size-3.5" /></Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table></div>
      </div>

      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <div className="flex items-center px-3 py-2 border-b border-border bg-muted/30">
          <span className="text-sm font-semibold">Run promotion</span>
        </div>
        <div className="divide-y divide-border">
          {classes.map(c => {
            const target = classes.find(x => x.id === c.promotion_target_class_id);
            const fromArms = arms.filter(a => a.class_id === c.id);
            const toArms = target ? arms.filter(a => a.class_id === target.id) : [];
            return (
              <div key={c.id} className="px-4 py-3 text-sm">
                <div className="flex items-center gap-2 font-medium">
                  {c.name} <ArrowRightCircle className="size-3.5 text-muted-foreground" />
                  <span className="text-muted-foreground">{target?.name || "Graduation"}</span>
                </div>
                {fromArms.length === 0 ? (
                  <div className="text-[11px] text-muted-foreground mt-1">No arms in this class.</div>
                ) : (
                  <div className="mt-2 grid sm:grid-cols-2 gap-2">
                    {fromArms.map(fa => (
                      <div key={fa.id} className="rounded-md border border-border p-2 flex items-center gap-2">
                        <div className="text-xs flex-1 min-w-0 truncate">{fa.name}</div>
                        {target && (
                          <PromoSelect toArms={toArms} disabled={!mayEdit || busy === fa.id}
                            onRun={(toArmId) => runPromotion(fa.id, toArmId)} />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <Dialog open={!!editing} onOpenChange={v => !v && setEditing(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>{editing?.id ? "Edit promotion rule" : "New promotion rule"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5"><Label className="text-xs">From class</Label>
              <Select value={editing?.from_class_id || ""} onValueChange={v => setEditing((s: any) => ({ ...s, from_class_id: v }))}>
                <SelectTrigger><SelectValue placeholder="Choose…" /></SelectTrigger>
                <SelectContent>{classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">To class</Label>
              <Select value={editing?.to_class_id || "graduation"} onValueChange={v => setEditing((s: any) => ({ ...s, to_class_id: v === "graduation" ? null : v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="graduation">Graduation</SelectItem>
                  {classes.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label className="text-xs">Min average</Label>
                <Input type="number" value={editing?.min_average ?? 0} onChange={e => setEditing((s: any) => ({ ...s, min_average: e.target.value }))} />
              </div>
              <div className="space-y-1.5"><Label className="text-xs">Min attendance %</Label>
                <Input type="number" value={editing?.min_attendance_pct ?? 0} onChange={e => setEditing((s: any) => ({ ...s, min_attendance_pct: e.target.value }))} />
              </div>
            </div>
            <div className="space-y-1.5"><Label className="text-xs">Notes</Label>
              <Textarea value={editing?.notes || ""} onChange={e => setEditing((s: any) => ({ ...s, notes: e.target.value }))} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveRule} disabled={busy === "save" || !editing?.from_class_id}>
              {busy === "save" ? <Loader2 className="size-4 animate-spin mr-2" /> : null}Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromoSelect({ toArms, disabled, onRun }: { toArms: Arm[]; disabled: boolean; onRun: (id: string) => void }) {
  const [v, setV] = useState<string>("");
  return (
    <div className="flex items-center gap-1">
      <Select value={v} onValueChange={setV}>
        <SelectTrigger className="h-7 text-xs w-[120px]"><SelectValue placeholder="→ Arm" /></SelectTrigger>
        <SelectContent>{toArms.map(a => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}</SelectContent>
      </Select>
      <Button size="sm" className="h-7" disabled={disabled || !v} onClick={() => onRun(v)}>Run</Button>
    </div>
  );
}