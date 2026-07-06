import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, StatusBadge, Skel, EmptyState } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { LifeBuoy, Search, Send, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { superAction, timeAgo } from "@/lib/super";
import { useSchool } from "@/contexts/SchoolContext";

type Ticket = { id: string; school_id: string; subject: string; body: string; status: string; priority: string; assignee: string | null; opened_by: string; created_at: string; updated_at: string; school_name?: string };
type Msg = { id: string; author: string; body: string; internal: boolean; created_at: string; author_name?: string };

export default function SuperTickets() {
  const { user } = useSchool();
  const [tickets, setTickets] = useState<Ticket[] | null>(null);
  const [tab, setTab] = useState("open");
  const [q, setQ] = useState("");
  const [active, setActive] = useState<Ticket | null>(null);
  const [thread, setThread] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [internal, setInternal] = useState(false);
  const [busy, setBusy] = useState(false);

  async function load() {
    setTickets(null);
    const { data } = await supabase.from("support_tickets").select("*").order("updated_at", { ascending: false }).limit(500);
    const schoolIds = Array.from(new Set((data ?? []).map((t: any) => t.school_id)));
    const { data: schools } = schoolIds.length
      ? await supabase.from("schools").select("id,name").in("id", schoolIds)
      : { data: [] as any[] };
    const smap = new Map((schools ?? []).map((s: any) => [s.id, s.name]));
    setTickets((data ?? []).map((t: any) => ({ ...t, school_name: smap.get(t.school_id) ?? "—" })));
  }
  useEffect(() => { load(); }, []);

  async function openTicket(t: Ticket) {
    setActive(t); setThread([]); setReply(""); setInternal(false);
    const { data: msgs } = await supabase.from("support_messages").select("*").eq("ticket_id", t.id).order("created_at");
    const authorIds = Array.from(new Set((msgs ?? []).map((m: any) => m.author)));
    const { data: profs } = authorIds.length
      ? await supabase.from("profiles").select("id,full_name").in("id", authorIds)
      : { data: [] as any[] };
    const pmap = new Map((profs ?? []).map((p: any) => [p.id, p.full_name]));
    setThread((msgs ?? []).map((m: any) => ({ ...m, author_name: pmap.get(m.author) ?? "User" })));
  }

  async function send() {
    if (!active || !reply.trim()) return;
    setBusy(true);
    try {
      await superAction("reply_ticket", { ticket_id: active.id, message: reply, internal });
      await superAction("update_ticket", { ticket_id: active.id, status: active.status === "open" ? "pending" : active.status });
      setReply(""); setInternal(false);
      await openTicket(active); await load();
      toast.success(internal ? "Internal note saved" : "Reply sent");
    } catch {/* toasted */} finally { setBusy(false); }
  }

  async function changeStatus(status: string) {
    if (!active) return;
    await superAction("update_ticket", { ticket_id: active.id, status });
    setActive({ ...active, status }); await load();
  }
  async function assignSelf() {
    if (!active || !user) return;
    await superAction("update_ticket", { ticket_id: active.id, assignee: user.id });
    setActive({ ...active, assignee: user.id }); await load();
    toast.success("Assigned to you");
  }

  const filtered = useMemo(() => {
    if (!tickets) return [];
    const needle = q.trim().toLowerCase();
    return tickets.filter(t =>
      (tab === "all" || t.status === tab) &&
      (!needle || t.subject.toLowerCase().includes(needle) || (t.school_name ?? "").toLowerCase().includes(needle)),
    );
  }, [tickets, tab, q]);

  const counts = useMemo(() => {
    const c = { open: 0, pending: 0, resolved: 0, closed: 0 } as Record<string, number>;
    (tickets ?? []).forEach(t => { if (c[t.status] !== undefined) c[t.status]++; });
    return c;
  }, [tickets]);

  return (
    <div>
      <PageHeader title="Support Tickets" description="Inbound issues from every tenant. Reply, assign, and close from here." />

      <div className="flex items-center justify-between mb-4 gap-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="open">Open · {counts.open ?? 0}</TabsTrigger>
            <TabsTrigger value="pending">Pending · {counts.pending ?? 0}</TabsTrigger>
            <TabsTrigger value="resolved">Resolved · {counts.resolved ?? 0}</TabsTrigger>
            <TabsTrigger value="closed">Closed · {counts.closed ?? 0}</TabsTrigger>
            <TabsTrigger value="all">All</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-64">
          <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search subject or school…" className="pl-7 h-9" />
        </div>
      </div>

      <Section title={`Inbox · ${filtered.length}`}>
        {tickets === null ? (
          <div className="space-y-2">{Array.from({length:6}).map((_,i)=><Skel key={i} className="h-14" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState icon={<LifeBuoy className="size-5 text-muted-foreground" />} title="Nothing here" />
        ) : (
          <ul className="divide-y divide-border -my-2">
            {filtered.map(t => (
              <li key={t.id}>
                <button onClick={() => openTicket(t)} className="w-full text-left py-3 flex items-start gap-3 hover:bg-muted/40 -mx-5 px-5 transition">
                  <div className="size-9 rounded-md bg-muted grid place-items-center"><LifeBuoy className="size-4 text-muted-foreground" /></div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm truncate">{t.subject}</span>
                      <StatusBadge status={t.status} />
                      <StatusBadge status={t.priority} />
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 truncate">{t.school_name} · {timeAgo(t.updated_at)}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Sheet open={!!active} onOpenChange={v => !v && setActive(null)}>
        <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
          {active && (
            <>
              <SheetHeader>
                <SheetTitle className="text-base">{active.subject}</SheetTitle>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <StatusBadge status={active.status} />
                  <StatusBadge status={active.priority} />
                  <span className="text-[11px] text-muted-foreground">{active.school_name}</span>
                </div>
              </SheetHeader>

              <div className="flex items-center gap-2 mt-4 mb-4">
                <Select value={active.status} onValueChange={changeStatus}>
                  <SelectTrigger className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Open</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="resolved">Resolved</SelectItem>
                    <SelectItem value="closed">Closed</SelectItem>
                  </SelectContent>
                </Select>
                {active.assignee !== user?.id && (
                  <Button size="sm" variant="outline" onClick={assignSelf}><UserCheck className="size-3.5 mr-1.5" />Assign to me</Button>
                )}
              </div>

              <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm whitespace-pre-wrap mb-4">{active.body}</div>

              <div className="space-y-2 mb-4">
                {thread.map(m => (
                  <div key={m.id} className={`rounded-lg border p-3 text-sm ${m.internal ? "border-warning/40 bg-warning/5" : "border-border bg-card"}`}>
                    <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1">
                      <span className="font-medium text-foreground">{m.author_name}{m.internal && " · internal"}</span>
                      <span>{timeAgo(m.created_at)}</span>
                    </div>
                    <div className="whitespace-pre-wrap">{m.body}</div>
                  </div>
                ))}
                {thread.length === 0 && <div className="text-xs text-muted-foreground">No replies yet.</div>}
              </div>

              <div className="space-y-2">
                <Textarea rows={4} value={reply} onChange={e => setReply(e.target.value)} placeholder={internal ? "Internal note (only super admins see this)…" : "Reply to the school…"} />
                <div className="flex items-center justify-between">
                  <label className="text-xs flex items-center gap-2"><input type="checkbox" checked={internal} onChange={e => setInternal(e.target.checked)} />Internal note</label>
                  <Button size="sm" onClick={send} disabled={busy || !reply.trim()}><Send className="size-3.5 mr-1.5" />Send</Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}