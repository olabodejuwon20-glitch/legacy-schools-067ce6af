import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skel } from "@/components/super/primitives";
import ConfirmDeleteDialog from "@/components/super/ConfirmDeleteDialog";
import { formatDistanceToNow } from "date-fns";
import { AlertCircle, CheckCircle2, EyeOff, RefreshCw, Search, Trash2, CheckCheck } from "lucide-react";
import { toast } from "sonner";
import { superAction } from "@/lib/super";

type ErrorRow = {
  id: string;
  message: string;
  source: string | null;
  route: string | null;
  role: string | null;
  browser: string | null;
  os: string | null;
  fingerprint: string | null;
  stack: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
  resolution_status: string;
  resolution_note: string | null;
  resolved_at: string | null;
  school_id: string | null;
  affected_users: string[] | null;
  metadata: Record<string, unknown> | null;
};

const STATUS_COLORS: Record<string, string> = {
  open: "bg-destructive/15 text-destructive border-destructive/30",
  investigating: "bg-warning/15 text-warning border-warning/30",
  resolved: "bg-success/15 text-success border-success/30",
  ignored: "bg-muted text-muted-foreground border-border",
};

export default function SuperErrors() {
  const [rows, setRows] = useState<ErrorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState<string>("open");
  const [role, setRole] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<ErrorRow | null>(null);
  const [trashTarget, setTrashTarget] = useState<ErrorRow | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);

  async function load() {
    setLoading(true);
    let q = supabase
      .from("client_errors")
      .select("*")
      .is("deleted_at", null)
      .order("last_seen_at", { ascending: false })
      .limit(200);
    if (status !== "all") q = q.eq("resolution_status", status);
    if (role !== "all") q = q.eq("role", role);
    const { data, error } = await q;
    if (error) toast.error("Could not load errors");
    setRows((data as ErrorRow[]) ?? []);
    setLoading(false);
  }

  useEffect(() => { void load(); /* eslint-disable-next-line */ }, [status, role]);

  useEffect(() => {
    const channel = supabase
      .channel("super-errors")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_errors" }, () => {
        void load();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line
  }, [status, role]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r =>
      (r.message || "").toLowerCase().includes(q) ||
      (r.route || "").toLowerCase().includes(q) ||
      (r.source || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  const totals = useMemo(() => ({
    open: rows.filter(r => r.resolution_status === "open").length,
    investigating: rows.filter(r => r.resolution_status === "investigating").length,
    resolved: rows.filter(r => r.resolution_status === "resolved").length,
    occurrences: rows.reduce((s, r) => s + (r.occurrence_count || 0), 0),
  }), [rows]);

  async function updateStatus(id: string, next: string, note?: string) {
    const patch: Record<string, unknown> = { resolution_status: next, resolution_note: note ?? null };
    if (next === "resolved") patch.resolved_at = new Date().toISOString();
    else if (next === "open") patch.resolved_at = null;
    const { error } = await supabase.from("client_errors").update(patch).eq("id", id);
    if (error) { toast.error("Could not update"); return; }
    toast.success(`Marked as ${next}`);
    setSelected(null);
    void load();
  }

  async function resolveAllVisible() {
    const openIds = filtered.filter(r => r.resolution_status === "open" || r.resolution_status === "investigating").map(r => r.id);
    if (openIds.length === 0) return;
    setBulkBusy(true);
    try {
      await superAction("bulk_resolve_errors", { ids: openIds, status: "resolved", note: "Bulk resolved by Super Admin" });
      toast.success(`Resolved ${openIds.length} incident${openIds.length === 1 ? "" : "s"}`);
      void load();
    } catch {
      /* toasted */
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Live Error Console</h1>
          <p className="text-sm text-muted-foreground mt-1">Every runtime error across every school, grouped by fingerprint. Streams in real time.</p>
        </div>
        <div className="flex items-center gap-2">
          {totals.open > 0 && (
            <Button variant="outline" size="sm" onClick={() => void resolveAllVisible()} disabled={bulkBusy}>
              <CheckCheck className="size-4 mr-1.5" /> Resolve shown ({totals.open})
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`size-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Stat label="Open" value={totals.open} color="text-destructive" />
        <Stat label="Investigating" value={totals.investigating} color="text-warning" />
        <Stat label="Resolved" value={totals.resolved} color="text-success" />
        <Stat label="Occurrences (shown)" value={totals.occurrences} color="text-foreground" />
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search message, route, sourceÃ¢â‚¬Â¦" className="pl-9 h-9" />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="open">Open</SelectItem>
            <SelectItem value="investigating">Investigating</SelectItem>
            <SelectItem value="resolved">Resolved</SelectItem>
            <SelectItem value="ignored">Ignored</SelectItem>
            <SelectItem value="all">All statuses</SelectItem>
          </SelectContent>
        </Select>
        <Select value={role} onValueChange={setRole}>
          <SelectTrigger className="w-40 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All roles</SelectItem>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="teacher">Teacher</SelectItem>
            <SelectItem value="student">Student</SelectItem>
            <SelectItem value="parent">Parent</SelectItem>
            <SelectItem value="driver">Driver</SelectItem>
            <SelectItem value="super_admin">Super Admin</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <Card className="overflow-hidden">
        {loading && rows.length === 0 ? (
          <div className="p-4 space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-14" />)}</div>
        ) : filtered.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            <CheckCircle2 className="size-8 mx-auto mb-2 text-success" />
            No errors match these filters. Nice.
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filtered.map(r => (
              <button
                key={r.id}
                onClick={() => setSelected(r)}
                className="w-full text-left px-4 py-3 hover:bg-muted/50 flex items-start gap-3"
              >
                <AlertCircle className={`size-4 mt-0.5 shrink-0 ${r.resolution_status === "resolved" ? "text-success" : "text-destructive"}`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="font-medium text-sm truncate">{r.message}</div>
                    <Badge variant="outline" className={STATUS_COLORS[r.resolution_status]}>{r.resolution_status}</Badge>
                    {r.occurrence_count > 1 && (
                      <Badge variant="secondary" className="text-xs">Ãƒâ€”{r.occurrence_count}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                    {r.route && <span className="font-mono">{r.route}</span>}
                    {r.role && <span>role: {r.role}</span>}
                    {r.browser && <span>{r.browser}{r.os ? ` Ã‚Â· ${r.os}` : ""}</span>}
                    <span>last: {formatDistanceToNow(new Date(r.last_seen_at), { addSuffix: true })}</span>
                    {(r.affected_users?.length ?? 0) > 0 && <span>{r.affected_users!.length} user{r.affected_users!.length === 1 ? "" : "s"}</span>}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Card>

      <ErrorDetail
        row={selected}
        onClose={() => setSelected(null)}
        onUpdate={updateStatus}
        onTrash={(r) => { setSelected(null); setTrashTarget(r); }}
      />

      {trashTarget && (
        <ConfirmDeleteDialog
          open={!!trashTarget}
          onOpenChange={o => !o && setTrashTarget(null)}
          title="Move incident to 30-day Trash"
          description={`Soft-delete "${trashTarget.message.slice(0, 80)}"? You can restore it from Trash within 30 days.`}
          onConfirm={async () => {
            await superAction("soft_delete", { table: "client_errors", id: trashTarget.id, confirm: "DELETE" });
            toast.success("Incident moved to Trash");
            setTrashTarget(null);
            void load();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <Card className="p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className={`text-2xl font-semibold tracking-tight mt-1 ${color}`}>{value}</div>
    </Card>
  );
}

function ErrorDetail({ row, onClose, onUpdate, onTrash }: {
  row: ErrorRow | null;
  onClose: () => void;
  onUpdate: (id: string, next: string, note?: string) => void;
  onTrash: (row: ErrorRow) => void;
}) {
  const [note, setNote] = useState("");
  useEffect(() => { setNote(row?.resolution_note ?? ""); }, [row?.id]);
  if (!row) return null;
  return (
    <Sheet open={!!row} onOpenChange={o => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-left break-words">{row.message}</SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-5 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <Info label="Status"><Badge variant="outline" className={STATUS_COLORS[row.resolution_status]}>{row.resolution_status}</Badge></Info>
            <Info label="Occurrences">{row.occurrence_count}</Info>
            <Info label="First seen">{formatDistanceToNow(new Date(row.first_seen_at), { addSuffix: true })}</Info>
            <Info label="Last seen">{formatDistanceToNow(new Date(row.last_seen_at), { addSuffix: true })}</Info>
            <Info label="Role">{row.role || "Ã¢â‚¬â€"}</Info>
            <Info label="Source">{row.source || "Ã¢â‚¬â€"}</Info>
            <Info label="Browser">{row.browser || "Ã¢â‚¬â€"}{row.os ? ` Ã‚Â· ${row.os}` : ""}</Info>
            <Info label="Users affected">{row.affected_users?.length ?? 0}</Info>
          </div>
          {row.route && (
            <Info label="Route"><code className="text-xs bg-muted px-1.5 py-0.5 rounded">{row.route}</code></Info>
          )}
          {row.stack && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Stack trace</div>
              <pre className="text-[11px] font-mono bg-muted/50 border border-border rounded-md p-3 overflow-x-auto max-h-72 whitespace-pre-wrap break-all">{row.stack}</pre>
            </div>
          )}
          {row.metadata && Object.keys(row.metadata).length > 0 && (
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Metadata</div>
              <pre className="text-[11px] font-mono bg-muted/50 border border-border rounded-md p-3 overflow-x-auto">{JSON.stringify(row.metadata, null, 2)}</pre>
            </div>
          )}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1.5">Resolution note</div>
            <Textarea rows={3} value={note} onChange={e => setNote(e.target.value)} placeholder="Root cause, fix summary, or reason for ignoringÃ¢â‚¬Â¦" />
          </div>
          <div className="flex gap-2 flex-wrap pt-2 border-t border-border">
            <Button size="sm" variant="outline" onClick={() => onUpdate(row.id, "investigating", note)}>Investigating</Button>
            <Button size="sm" onClick={() => onUpdate(row.id, "resolved", note)} className="bg-success hover:bg-success/90 text-primary-foreground">
              <CheckCircle2 className="size-4 mr-1.5" /> Resolved
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUpdate(row.id, "ignored", note)}>
              <EyeOff className="size-4 mr-1.5" /> Ignore
            </Button>
            <div className="flex-1" />
            <Button size="sm" variant="ghost" className="text-destructive" onClick={() => onTrash(row)}>
              <Trash2 className="size-4 mr-1.5" /> Trash
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onUpdate(row.id, "open", note)}>Reopen</Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-0.5">{children}</div>
    </div>
  );
}