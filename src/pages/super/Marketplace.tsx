import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, StatusBadge, Skel, EmptyState } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Loader2, ShoppingBag, Inbox, Plus, CheckCircle2, XCircle, RefreshCw,
  Banknote, PackageCheck, Search,
} from "lucide-react";
import { superAction } from "@/lib/super";

type School = { id: string; name: string; slug: string; plan: string };
type Module = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string;
  pricing_model: string;
  monthly_price_cents: number;
  term_price_kobo: number;
};
type SchoolModule = {
  id: string;
  school_id: string;
  module_id: string;
  enabled: boolean;
  beta: boolean;
  term_price_kobo_override: number | null;
};
type Request = {
  id: string;
  school_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  module_id: string | null;
};

export default function SuperMarketplace() {
  const [schools, setSchools] = useState<School[] | null>(null);
  const [modules, setModules] = useState<Module[]>([]);
  const [schoolId, setSchoolId] = useState<string>("");
  const [matrix, setMatrix] = useState<SchoolModule[]>([]);
  const [requests, setRequests] = useState<Request[] | null>(null);
  const [filter, setFilter] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [reqFilter, setReqFilter] = useState<"pending" | "approved" | "rejected" | "all">("pending");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reqModuleMap, setReqModuleMap] = useState<Record<string, string>>({});

  // New request modal
  const [creatingReq, setCreatingReq] = useState(false);
  const [newReqSchoolId, setNewReqSchoolId] = useState("");
  const [newReqModuleId, setNewReqModuleId] = useState("custom");
  const [newReqTitle, setNewReqTitle] = useState("");
  const [newReqDesc, setNewReqDesc] = useState("");
  const [savingReq, setSavingReq] = useState(false);

  async function loadAll() {
    const [s, m, r] = await Promise.all([
      supabase.from("schools").select("id, name, slug, plan").is("deleted_at", null).order("name"),
      supabase.from("modules").select("id, slug, name, description, category, pricing_model, monthly_price_cents, term_price_kobo").is("deleted_at", null).neq("status", "archived").order("name"),
      supabase.from("module_requests").select("*").order("created_at", { ascending: false }),
    ]);
    const sList = (s.data as School[]) ?? [];
    const mList = (m.data as Module[]) ?? [];
    const rList = (r.data as Request[]) ?? [];
    setSchools(sList);
    setModules(mList);
    setRequests(rList);
    if (sList.length && !schoolId) setSchoolId(sList[0].id);
    if (sList.length && !newReqSchoolId) setNewReqSchoolId(sList[0].id);

    const map: Record<string, string> = {};
    for (const req of rList) {
      if (req.module_id) {
        map[req.id] = req.module_id;
      } else {
        const matched = mList.find(mod => req.title.toLowerCase().includes(mod.name.toLowerCase()) || req.title.toLowerCase().includes(mod.slug.toLowerCase()));
        if (matched) map[req.id] = matched.id;
      }
    }
    setReqModuleMap(map);
  }

  useEffect(() => { void loadAll(); }, []);

  async function loadSchoolMatrix(sid: string) {
    if (!sid) return;
    const { data } = await supabase
      .from("school_modules")
      .select("id, school_id, module_id, enabled, beta, term_price_kobo_override")
      .eq("school_id", sid);
    setMatrix((data as SchoolModule[]) ?? []);
  }

  useEffect(() => {
    if (schoolId) void loadSchoolMatrix(schoolId);
  }, [schoolId]);

  async function toggleModule(mod: Module, on: boolean) {
    if (!schoolId) return;
    setBusyId(mod.id);
    try {
      const existing = matrix.find(x => x.module_id === mod.id);
      const res = await superAction<{ ok: boolean; entitlement: SchoolModule }>("update_entitlement", {
        school_id: schoolId,
        module_id: mod.id,
        enabled: on,
        beta: existing?.beta ?? false,
        term_price_kobo_override: existing?.term_price_kobo_override ?? null,
      });
      if (res?.entitlement) {
        setMatrix(m => {
          const idx = m.findIndex(x => x.module_id === mod.id);
          if (idx >= 0) {
            const copy = [...m];
            copy[idx] = res.entitlement;
            return copy;
          }
          return [...m, res.entitlement];
        });
      } else {
        await loadSchoolMatrix(schoolId);
      }
      toast.success(`${mod.name} ${on ? "enabled" : "disabled"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Update failed");
    } finally { setBusyId(null); }
  }

  async function toggleBeta(mod: Module) {
    if (!schoolId) return;
    const existing = matrix.find(x => x.module_id === mod.id);
    const nextBeta = !existing?.beta;
    setBusyId(mod.id);
    try {
      await superAction("update_entitlement", {
        school_id: schoolId,
        module_id: mod.id,
        enabled: existing?.enabled ?? true,
        beta: nextBeta,
        term_price_kobo_override: existing?.term_price_kobo_override ?? null,
      });
      await loadSchoolMatrix(schoolId);
      toast.success(`${mod.name} beta ${nextBeta ? "enabled" : "removed"}`);
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update beta flag");
    } finally { setBusyId(null); }
  }

  async function resolveRequest(req: Request, status: "approved" | "rejected") {
    const selectedModuleId = reqModuleMap[req.id] && reqModuleMap[req.id] !== "none" ? reqModuleMap[req.id] : null;
    setBusyId(req.id);
    try {
      const res = await superAction<{ ok: boolean; provisioned?: boolean }>("update_module_request", {
        request_id: req.id,
        status,
        module_id: selectedModuleId,
        auto_enable: true,
      });
      setRequests(rs => rs?.map(x => x.id === req.id ? { ...x, status, module_id: selectedModuleId } : x) ?? null);
      if (status === "approved" && req.school_id === schoolId) {
        await loadSchoolMatrix(schoolId);
      }
      toast.success(
        status === "approved"
          ? (res?.provisioned ? "Request approved & module automatically enabled for school" : "Request approved")
          : "Request rejected"
      );
    } catch (e: any) {
      toast.error(e.message ?? "Could not update request");
    } finally {
      setBusyId(null);
    }
  }

  async function createRequest() {
    if (!newReqSchoolId || !newReqTitle.trim()) {
      toast.error("Select a school and enter a request title");
      return;
    }
    setSavingReq(true);
    try {
      await superAction("create_module_request", {
        school_id: newReqSchoolId,
        title: newReqTitle.trim(),
        description: newReqDesc.trim() || null,
        module_id: newReqModuleId !== "custom" ? newReqModuleId : null,
      });
      toast.success("Module request logged");
      setCreatingReq(false);
      setNewReqTitle("");
      setNewReqDesc("");
      setNewReqModuleId("custom");
      await loadAll();
    } catch (e: any) {
      toast.error(e.message ?? "Could not log request");
    } finally {
      setSavingReq(false);
    }
  }

  const categories = useMemo(() => Array.from(new Set(modules.map(m => m.category))).sort(), [modules]);

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    return modules.filter(m =>
      (catFilter === "all" || m.category === catFilter) &&
      (!q || m.name.toLowerCase().includes(q) || m.slug.toLowerCase().includes(q))
    );
  }, [modules, filter, catFilter]);

  const filteredRequests = useMemo(() => {
    if (!requests) return [];
    if (reqFilter === "all") return requests;
    return requests.filter(r => r.status === reqFilter);
  }, [requests, reqFilter]);

  const schoolSummary = useMemo(() => {
    const enabledRows = matrix.filter(x => x.enabled);
    const termAddonKobo = enabledRows.reduce((sum, r) => {
      const mod = modules.find(m => m.id === r.module_id);
      const price = r.term_price_kobo_override ?? mod?.term_price_kobo ?? 0;
      return sum + price;
    }, 0);
    return {
      enabledCount: enabledRows.length,
      termAddonKobo,
    };
  }, [matrix, modules]);

  const activeSchool = (schools ?? []).find(s => s.id === schoolId);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Marketplace"
        description="Enable, disable and price modules for each tenant. Approve incoming module requests with automatic provisioning."
        actions={
          <>
            <Button variant="outline" size="sm" onClick={loadAll}>
              <RefreshCw className="size-3.5 mr-1.5" />Refresh
            </Button>
            <Button size="sm" onClick={() => setCreatingReq(true)}>
              <Plus className="size-3.5 mr-1.5" />Log request
            </Button>
          </>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Section
            title="Module catalog per school"
            description="Toggle individual plug-ins or beta access on or off for the selected tenant."
          >
            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <div className="min-w-[220px] flex-1">
                <Select value={schoolId} onValueChange={setSchoolId}>
                  <SelectTrigger><SelectValue placeholder="Select school" /></SelectTrigger>
                  <SelectContent>
                    {(schools ?? []).map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name} · {s.plan}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Select value={catFilter} onValueChange={setCatFilter}>
                <SelectTrigger className="w-[150px] capitalize"><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
              <div className="relative flex-1 min-w-[180px]">
                <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input className="pl-8" placeholder="Filter modules…" value={filter} onChange={e => setFilter(e.target.value)} />
              </div>
            </div>

            {activeSchool && (
              <div className="mb-4 rounded-lg border border-border bg-muted/30 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-foreground">{activeSchool.name}</span>
                  <Badge variant="outline" className="text-[10px] capitalize">{activeSchool.plan}</Badge>
                </div>
                <div className="flex items-center gap-4 text-muted-foreground">
                  <span className="inline-flex items-center gap-1">
                    <PackageCheck className="size-3.5 text-success" />
                    <strong className="text-foreground">{schoolSummary.enabledCount}</strong> / {modules.length} enabled
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Banknote className="size-3.5 text-info" />
                    Add-ons: <strong className="text-foreground">₦{Math.round(schoolSummary.termAddonKobo / 100).toLocaleString("en-NG")}</strong>/term
                  </span>
                </div>
              </div>
            )}

            {schools === null ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skel key={i} className="h-14" />)}</div>
            ) : modules.length === 0 ? (
              <EmptyState
                icon={<ShoppingBag className="size-5 text-muted-foreground" />}
                title="No modules registered"
                description="Seed the registry from Modules & Plugins first."
              />
            ) : (
              <ul className="divide-y divide-border -my-2">
                {filtered.map(m => {
                  const row = matrix.find(x => x.module_id === m.id);
                  const on = !!row?.enabled;
                  const effectiveKobo = row?.term_price_kobo_override ?? m.term_price_kobo ?? 0;
                  return (
                    <li key={m.id} className="py-3 flex items-center gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground">{m.name}</span>
                          <Badge variant="secondary" className="text-[10px] capitalize">{m.category}</Badge>
                          {m.pricing_model !== "included" && (
                            <Badge variant="outline" className="text-[10px] capitalize">{m.pricing_model.replace("_", " ")}</Badge>
                          )}
                          {row?.beta && (
                            <Badge variant="outline" className="text-[10px] bg-warning/10 text-warning border-warning/30">Beta</Badge>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {effectiveKobo > 0
                            ? `₦${Math.round(effectiveKobo / 100).toLocaleString("en-NG")}/term${row?.term_price_kobo_override != null ? " (custom override)" : ""}`
                            : "Included in plan"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant={row?.beta ? "default" : "ghost"}
                          className="h-7 px-2 text-[11px]"
                          disabled={!schoolId || busyId === m.id}
                          onClick={() => toggleBeta(m)}
                        >
                          Beta
                        </Button>
                        {busyId === m.id
                          ? <Loader2 className="size-4 animate-spin text-muted-foreground" />
                          : <Switch checked={on} onCheckedChange={v => toggleModule(m, v)} disabled={!schoolId} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>

        <div className="space-y-6">
          <Section
            title="Incoming requests"
            description="Approving a request with a linked module automatically provisions it for the school."
          >
            <div className="flex items-center gap-1 mb-3">
              {(["pending", "approved", "rejected", "all"] as const).map(st => (
                <button
                  key={st}
                  type="button"
                  onClick={() => setReqFilter(st)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium capitalize transition-colors ${
                    reqFilter === st
                      ? "bg-foreground text-background"
                      : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {requests === null ? (
              <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <Skel key={i} className="h-16" />)}</div>
            ) : filteredRequests.length === 0 ? (
              <EmptyState
                icon={<Inbox className="size-5 text-muted-foreground" />}
                title={`No ${reqFilter === "all" ? "" : reqFilter} requests`}
                description="When schools request modules they will appear here."
              />
            ) : (
              <ul className="divide-y divide-border -my-2">
                {filteredRequests.map(r => {
                  const school = (schools ?? []).find(s => s.id === r.school_id);
                  const linkedMod = modules.find(m => m.id === (reqModuleMap[r.id] ?? r.module_id));
                  return (
                    <li key={r.id} className="py-3 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{r.title}</p>
                          <p className="text-[11px] text-muted-foreground">
                            {school?.name ?? "Unknown school"} · {new Date(r.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <StatusBadge status={r.status} />
                      </div>
                      {r.description && <p className="text-xs text-muted-foreground line-clamp-2">{r.description}</p>}

                      {r.status === "pending" ? (
                        <div className="space-y-2 pt-1">
                          <div>
                            <Label className="text-[10px] uppercase text-muted-foreground">Link module to auto-provision</Label>
                            <Select
                              value={reqModuleMap[r.id] ?? "none"}
                              onValueChange={v => setReqModuleMap(prev => ({ ...prev, [r.id]: v }))}
                            >
                              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Select module…" /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="none">— Custom request (no auto-enable) —</SelectItem>
                                {modules.map(m => (
                                  <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1"
                              disabled={busyId === r.id}
                              onClick={() => resolveRequest(r, "rejected")}
                            >
                              <XCircle className="size-3.5 mr-1" /> Reject
                            </Button>
                            <Button
                              size="sm"
                              className="flex-1"
                              disabled={busyId === r.id}
                              onClick={() => resolveRequest(r, "approved")}
                            >
                              {busyId === r.id ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <CheckCircle2 className="size-3.5 mr-1" />}
                              Approve
                            </Button>
                          </div>
                        </div>
                      ) : linkedMod ? (
                        <div className="text-[11px] text-muted-foreground">
                          Module: <span className="font-medium text-foreground">{linkedMod.name}</span>
                        </div>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      </div>

      {/* Log Module Request Modal */}
      <Dialog open={creatingReq} onOpenChange={setCreatingReq}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Log Module Request</DialogTitle>
            <DialogDescription>Record a module or feature request on behalf of a school.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs">School</Label>
              <Select value={newReqSchoolId} onValueChange={setNewReqSchoolId}>
                <SelectTrigger className="mt-1"><SelectValue placeholder="Select school" /></SelectTrigger>
                <SelectContent>
                  {(schools ?? []).map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Catalog Module (Optional)</Label>
              <Select
                value={newReqModuleId}
                onValueChange={v => {
                  setNewReqModuleId(v);
                  if (v !== "custom") {
                    const mod = modules.find(m => m.id === v);
                    if (mod && !newReqTitle) setNewReqTitle(`Enable ${mod.name}`);
                  }
                }}
              >
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="custom">Custom feature request</SelectItem>
                  {modules.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Title</Label>
              <Input
                value={newReqTitle}
                onChange={e => setNewReqTitle(e.target.value)}
                placeholder="e.g. Enable Transport Tracking"
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-xs">Notes / Context</Label>
              <Textarea
                rows={3}
                value={newReqDesc}
                onChange={e => setNewReqDesc(e.target.value)}
                placeholder="Principal requested 3 buses to be onboarded for Term 2…"
                className="mt-1"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setCreatingReq(false)}>Cancel</Button>
            <Button onClick={createRequest} disabled={savingReq}>
              {savingReq && <Loader2 className="size-4 mr-1.5 animate-spin" />}
              Submit request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
