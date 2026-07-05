import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader, Section, Skel, EmptyState } from "@/components/super/primitives";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Trash2, RotateCcw, Building2, Users, Megaphone, Ticket, AlertCircle, Radio, RefreshCw } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { superAction } from "@/lib/super";
import ConfirmDeleteDialog from "@/components/super/ConfirmDeleteDialog";

type Item = { id: string; label: string; sub?: string; deleted_at: string };

type Kind = {
  key: string;
  table: string;
  label: string;
  icon: any;
  fetch: () => Promise<Item[]>;
};

function daysUntilPurge(deleted_at: string) {
  const purge = new Date(new Date(deleted_at).getTime() + 30 * 86400000);
  const days = Math.ceil((purge.getTime() - Date.now()) / 86400000);
  return Math.max(0, days);
}

export default function SuperTrash() {
  const kinds = useMemo<Kind[]>(() => [
    {
      key: "schools", table: "schools", label: "Schools", icon: Building2,
      fetch: async () => {
        const { data } = await supabase.from("schools").select("id,name,slug,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
        return (data ?? []).map((s: any) => ({ id: s.id, label: s.name, sub: s.slug, deleted_at: s.deleted_at }));
      },
    },
    {
      key: "memberships", table: "memberships", label: "Users", icon: Users,
      fetch: async () => {
        const { data: m } = await supabase.from("memberships").select("id,user_id,role,school_id,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false }).limit(500);
        const uids = Array.from(new Set((m ?? []).map((x: any) => x.user_id)));
        const sids = Array.from(new Set((m ?? []).map((x: any) => x.school_id)));
        const [{ data: p }, { data: s }] = await Promise.all([
          uids.length ? supabase.from("profiles").select("id,full_name,email").in("id", uids) : Promise.resolve({ data: [] as any[] }),
          sids.length ? supabase.from("schools").select("id,name").in("id", sids) : Promise.resolve({ data: [] as any[] }),
        ]);
        const pm = new Map((p ?? []).map((x: any) => [x.id, x]));
        const sm = new Map((s ?? []).map((x: any) => [x.id, x.name]));
        return (m ?? []).map((x: any) => ({
          id: x.id,
          label: `${pm.get(x.user_id)?.full_name ?? pm.get(x.user_id)?.email ?? "—"}`,
          sub: `${x.role} · ${sm.get(x.school_id) ?? "—"}`,
          deleted_at: x.deleted_at,
        }));
      },
    },
    {
      key: "announcements", table: "announcements", label: "Announcements", icon: Megaphone,
      fetch: async () => {
        const { data } = await supabase.from("announcements").select("id,title,school_id,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
        return (data ?? []).map((x: any) => ({ id: x.id, label: x.title, deleted_at: x.deleted_at }));
      },
    },
    {
      key: "broadcast_jobs", table: "broadcast_jobs", label: "Broadcasts", icon: Radio,
      fetch: async () => {
        const { data } = await supabase.from("broadcast_jobs").select("id,title,status,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
        return (data ?? []).map((x: any) => ({ id: x.id, label: x.title, sub: x.status, deleted_at: x.deleted_at }));
      },
    },
    {
      key: "support_tickets", table: "support_tickets", label: "Tickets", icon: Ticket,
      fetch: async () => {
        const { data } = await supabase.from("support_tickets").select("id,subject,priority,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
        return (data ?? []).map((x: any) => ({ id: x.id, label: x.subject, sub: x.priority, deleted_at: x.deleted_at }));
      },
    },
    {
      key: "client_errors", table: "client_errors", label: "Errors", icon: AlertCircle,
      fetch: async () => {
        const { data } = await supabase.from("client_errors").select("id,message,route,deleted_at").not("deleted_at", "is", null).order("deleted_at", { ascending: false });
        return (data ?? []).map((x: any) => ({ id: x.id, label: x.message, sub: x.route ?? undefined, deleted_at: x.deleted_at }));
      },
    },
  ], []);

  const [active, setActive] = useState<string>(kinds[0].key);
  const [data, setData] = useState<Record<string, Item[] | null>>({});
  const [purge, setPurge] = useState<{ table: string; item: Item } | null>(null);

  async function loadKind(k: Kind) {
    setData(d => ({ ...d, [k.key]: null }));
    const items = await k.fetch();
    setData(d => ({ ...d, [k.key]: items }));
  }
  async function loadAll() { await Promise.all(kinds.map(loadKind)); }
  useEffect(() => { void loadAll(); /* eslint-disable-next-line */ }, []);

  async function restore(table: string, id: string) {
    try { await superAction("restore_deleted", { table, id }); toast.success("Restored"); await loadAll(); } catch {}
  }
  async function runMaintenance() {
    try { await superAction("run_trash_maintenance", {}); toast.success("Maintenance run: 30-day items purged"); await loadAll(); } catch {}
  }

  const totals = kinds.reduce((n, k) => n + (data[k.key]?.length ?? 0), 0);

  return (
    <div>
      <PageHeader
        title="Trash"
        description="Soft-deleted items across the platform. Everything here is permanently removed 30 days after deletion. Restore to bring an item back."
        actions={
          <Button variant="outline" size="sm" onClick={runMaintenance}>
            <RefreshCw className="size-3.5 mr-1.5" /> Run purge now
          </Button>
        }
      />

      <Section
        title={`Trash · ${totals} item${totals === 1 ? "" : "s"}`}
        description="Auto-purges 30 days after deletion. Errors also auto-resolve when unseen for 7 days."
      >
        <Tabs value={active} onValueChange={setActive}>
          <TabsList className="mb-4 flex-wrap h-auto">
            {kinds.map(k => {
              const n = data[k.key]?.length ?? 0;
              return (
                <TabsTrigger key={k.key} value={k.key} className="gap-2">
                  <k.icon className="size-3.5" />
                  {k.label}
                  {n > 0 && <Badge variant="secondary" className="ml-1 h-4 px-1.5 text-[10px]">{n}</Badge>}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {kinds.map(k => (
            <TabsContent key={k.key} value={k.key} className="mt-0">
              {data[k.key] === null ? (
                <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <Skel key={i} className="h-14" />)}</div>
              ) : (data[k.key] ?? []).length === 0 ? (
                <EmptyState icon={<Trash2 className="size-5 text-muted-foreground" />} title={`No deleted ${k.label.toLowerCase()}`} />
              ) : (
                <div className="divide-y divide-border border border-border rounded-lg overflow-hidden">
                  {(data[k.key] ?? []).map(item => {
                    const days = daysUntilPurge(item.deleted_at);
                    return (
                      <div key={item.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30">
                        <k.icon className="size-4 text-muted-foreground shrink-0" />
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium truncate">{item.label || "(untitled)"}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {item.sub && <span className="mr-2">{item.sub}</span>}
                            deleted {formatDistanceToNow(new Date(item.deleted_at), { addSuffix: true })}
                          </div>
                        </div>
                        <Badge
                          variant="outline"
                          className={days <= 3 ? "border-destructive/40 text-destructive" : "text-muted-foreground"}
                        >
                          {days === 0 ? "purges today" : `${days}d left`}
                        </Badge>
                        <Button size="sm" variant="outline" onClick={() => restore(k.table, item.id)}>
                          <RotateCcw className="size-3.5 mr-1.5" /> Restore
                        </Button>
                        <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => setPurge({ table: k.table, item })}>
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      </Section>

      <ConfirmDeleteDialog
        open={!!purge}
        onOpenChange={(v) => !v && setPurge(null)}
        title="Permanently delete this item"
        description="This immediately removes the record from the database. This cannot be undone."
        destructive="purge"
        itemName={purge?.item.label}
        onConfirm={async (confirm) => {
          if (!purge) return;
          try {
            await superAction("purge_now", { table: purge.table, id: purge.item.id, confirm });
            toast.success("Permanently deleted");
            await loadAll();
          } catch {}
        }}
      />
    </div>
  );
}