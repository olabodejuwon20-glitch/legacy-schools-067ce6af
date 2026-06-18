import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { HeartHandshake, Loader2, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";

interface Alert {
  id: string;
  kind: string;
  severity: string;
  status: string;
  draft_message: string | null;
  signal: any;
  student_id: string;
  parent_id: string;
  created_at: string;
  sent_at: string | null;
}

export default function ParentAlertsView() {
  const { school, user } = useSchool();
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);

  const load = async () => {
    if (!school) return;
    setLoading(true);
    const { data } = await (supabase as any).from("parent_alerts")
      .select("id,kind,severity,status,draft_message,signal,student_id,parent_id,created_at,sent_at")
      .eq("school_id", school.id).order("created_at", { ascending: false }).limit(100);
    setAlerts((data ?? []) as Alert[]);
    setLoading(false);
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [school?.id]);

  const scan = async () => {
    if (!school) return;
    setScanning(true);
    const { data, error } = await supabase.functions.invoke("parent-alerts-scan", { body: { school_id: school.id } });
    setScanning(false);
    const err = error?.message ?? (data as any)?.error;
    if (err) { toast.error(err); return; }
    toast.success(`Scan complete — ${(data as any)?.created ?? 0} new alerts`);
    load();
  };

  const send = async (a: Alert) => {
    if (!school || !user) return;
    setSendingId(a.id);
    const { error: mErr } = await supabase.from("messages").insert({
      school_id: school.id, sender_id: user.id, recipient_id: a.parent_id,
      body: a.draft_message ?? "Notice from school", attachments: [] as any,
    });
    if (mErr) { toast.error(mErr.message); setSendingId(null); return; }
    await (supabase as any).from("parent_alerts")
      .update({ status: "sent", sent_at: new Date().toISOString() }).eq("id", a.id);
    setSendingId(null);
    toast.success("Alert delivered to parent");
    load();
  };

  return (
    <div className="h-full overflow-auto p-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <HeartHandshake className="size-6"/> Parent Alerts
        </h1>
        <Button onClick={scan} disabled={scanning}>
          {scanning ? <Loader2 className="size-4 mr-1 animate-spin"/> : <RefreshCw className="size-4 mr-1"/>}
          Run scan
        </Button>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Auto-detects attendance issues and drafts a parent message you can review and send.
      </p>
      {loading && <div className="text-sm text-muted-foreground flex items-center gap-2"><Loader2 className="size-4 animate-spin"/> Loading…</div>}
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className="rounded-xl border bg-card p-4">
            <div className="flex items-center gap-2 mb-1">
              <Badge variant={a.severity === "high" ? "destructive" : "secondary"} className="capitalize">{a.severity}</Badge>
              <span className="text-sm font-medium capitalize">{a.kind}</span>
              <Badge variant="outline" className="ml-auto capitalize">{a.status}</Badge>
              {a.status !== "sent" && (
                <Button size="sm" variant="outline" disabled={sendingId === a.id} onClick={() => send(a)}>
                  {sendingId === a.id ? <Loader2 className="size-3.5 animate-spin"/> : <Send className="size-3.5"/>}
                  <span className="ml-1">Send to parent</span>
                </Button>
              )}
            </div>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{a.draft_message}</p>
            <div className="text-[11px] text-muted-foreground mt-2 flex gap-3 flex-wrap">
              <span>Created: {new Date(a.created_at).toLocaleString()}</span>
              {a.sent_at && <span>Sent: {new Date(a.sent_at).toLocaleString()}</span>}
              {a.signal?.absences_14d != null && <span>Absences (14d): {a.signal.absences_14d}</span>}
            </div>
          </div>
        ))}
        {!loading && alerts.length === 0 && (
          <div className="text-sm text-muted-foreground py-12 text-center">No alerts yet — run a scan to generate them.</div>
        )}
      </div>
    </div>
  );
}