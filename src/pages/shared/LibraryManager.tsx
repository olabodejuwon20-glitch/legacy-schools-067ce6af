import { useEffect, useRef, useState } from "react";
import { FileText, Upload, Trash2, Loader2, Download, Search, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useSchool } from "@/contexts/SchoolContext";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { EmptyState } from "@/components/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

const CATEGORIES = ["general", "textbook", "notes", "past-questions", "syllabus", "resource", "other"];

export default function LibraryManager() {
  const { school, user, activeRole } = useSchool();
  const [rows, setRows] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");
  const [uploadCat, setUploadCat] = useState<string>("general");
  const ref = useRef<HTMLInputElement>(null);

  const load = async () => {
    if (!school) return;
    const { data } = await supabase
      .from("library_files").select("*")
      .eq("school_id", school.id)
      .order("created_at", { ascending: false });
    setRows(data ?? []);
  };
  useEffect(() => { load(); }, [school]);

  async function upload(file: File) {
    if (!school || !user) return;
    setBusy(true);
    try {
      const path = `${school.id}/${Date.now()}-${file.name.replace(/[^\w.\-]+/g, "_")}`;
      const { error: e1 } = await supabase.storage.from("library").upload(path, file);
      if (e1) throw e1;
      const { error: e2 } = await supabase.from("library_files").insert({
        school_id: school.id, uploaded_by: user.id, name: file.name,
        storage_path: path, size_bytes: file.size, category: uploadCat,
      });
      if (e2) throw e2;
      toast.success("File uploaded"); await load();
    } catch (e: any) { toast.error(e.message); }
    finally { setBusy(false); if (ref.current) ref.current.value = ""; }
  }

  async function open(r: any) {
    const { data, error } = await supabase.storage.from("library").createSignedUrl(r.storage_path, 60 * 5);
    if (error) return toast.error(error.message);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  }

  async function remove(r: any) {
    if (!confirm(`Delete "${r.name}"?`)) return;
    await supabase.storage.from("library").remove([r.storage_path]);
    const { error } = await supabase.from("library_files").delete().eq("id", r.id);
    if (error) return toast.error(error.message);
    toast.success("Deleted"); await load();
  }

  const filtered = rows.filter(r =>
    (cat === "all" || (r.category || "general") === cat) &&
    (!q || r.name.toLowerCase().includes(q.toLowerCase()))
  );

  const canDelete = (r: any) => activeRole === "admin" || r.uploaded_by === user?.id;
  const canManage = activeRole === "admin" || activeRole === "teacher";

  const stats = {
    total: rows.length,
    sizeMb: (rows.reduce((s, r) => s + Number(r.size_bytes || 0), 0) / 1024 / 1024).toFixed(1),
    categories: new Set(rows.map(r => r.category || "general")).size,
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Stat label="Total files" value={stats.total} />
        <Stat label="Storage used" value={`${stats.sizeMb} MB`} />
        <Stat label="Categories" value={stats.categories} />
      </div>

      {canManage && <SectionCard
        title="Upload to library"
        description="Share textbooks, notes, past questions and other resources with the school."
      >
        <div className="flex flex-col sm:flex-row gap-3">
          <Select value={uploadCat} onValueChange={setUploadCat}>
            <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>{CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
          </Select>
          <input ref={ref} hidden type="file" onChange={e => e.target.files?.[0] && upload(e.target.files[0])} />
          <Button onClick={() => ref.current?.click()} disabled={busy} className="sm:w-auto">
            {busy ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Upload className="size-4 mr-2" />}
            Upload file
          </Button>
        </div>
      </SectionCard>}

      <SectionCard
        title="Materials"
        action={
          <div className="flex gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input value={q} onChange={e => setQ(e.target.value)} placeholder="Search" className="pl-9 h-9 w-44" />
            </div>
            <Select value={cat} onValueChange={setCat}>
              <SelectTrigger className="h-9 w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState icon={FolderOpen} title="No resources" desc="Upload your first file to get started." />
        ) : (
          <ul className="divide-y divide-border">
            {filtered.map(r => (
              <li key={r.id} className="py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="size-9 rounded-lg bg-primary/10 grid place-items-center shrink-0">
                    <FileText className="size-4 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-medium truncate">{r.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {r.category || "general"} · {(Number(r.size_bytes || 0) / 1024).toFixed(1)} KB · {new Date(r.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => open(r)}><Download className="size-4 mr-2" />Open</Button>
                  {canManage && canDelete(r) && (
                    <Button size="icon" variant="ghost" onClick={() => remove(r)}>
                      <Trash2 className="size-4 text-destructive" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </SectionCard>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: any }) {
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="text-xs text-muted-foreground uppercase tracking-wide">{label}</div>
      <div className="mt-1 text-2xl font-display font-bold">{value}</div>
    </div>
  );
}