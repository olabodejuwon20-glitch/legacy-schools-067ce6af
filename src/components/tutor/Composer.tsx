import { useEffect, useRef, useState } from "react";
import { Paperclip, Mic, Square, X, Send, Loader2, Image as ImageIcon, File as FileIcon, Volume2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Attachment, bytesToHuman, blobToBase64, uploadPrivate } from "@/lib/uploads";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface Props {
  bucket: "tutor-uploads" | "message-attachments";
  userId: string;
  prefix: string;
  disabled?: boolean;
  busy?: boolean;
  placeholder?: string;
  onSubmit: (text: string, attachments: Attachment[]) => void | Promise<void>;
  onStop?: () => void; // shown when streaming reply
  accept?: string;
  /** Whether to transcribe voice notes server-side and attach the transcript. */
  transcribeVoice?: boolean;
  /** Notifies the parent when the user is composing — used for typing indicators. */
  onTextChange?: (text: string) => void;
  /** School scope for credit accounting & access control on server endpoints. */
  schoolId?: string;
  /** Seed/overwrite composer text from a parent (e.g. AI draft). Increment a counter
   *  in `seedNonce` to re-apply the same string. */
  seedText?: string;
  seedNonce?: number;
}

export function Composer({
  bucket, userId, prefix, disabled, busy, placeholder = "Message…",
  onSubmit, onStop, accept = "image/*,application/pdf,.txt,.md,.docx", transcribeVoice = true, onTextChange, schoolId,
  seedText, seedNonce,
}: Props) {
  const [text, setText] = useState("");
  useEffect(() => {
    if (seedText == null) return;
    setText(seedText);
    onTextChange?.(seedText);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedNonce, seedText]);
  const [pending, setPending] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [recordSecs, setRecordSecs] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function onPickFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const list = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!list.length) return;
    setUploading(true);
    try {
      for (const f of list) {
        if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} is over 10MB`); continue; }
        const att = await uploadPrivate(bucket, userId, prefix, f, f.name);
        setPending(p => [...p, att]);
      }
    } catch (err: any) {
      toast.error(err?.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function startRecording() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream, { mimeType: "audio/webm" });
      chunksRef.current = [];
      mr.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (blob.size < 500) return; // discard accidental taps
        try {
          const att = await uploadPrivate(bucket, userId, prefix, blob, `voice-${Date.now()}.webm`);
          att.type = "audio";
          att.duration = recordSecs;
          if (transcribeVoice && blob.size < 8 * 1024 * 1024) {
            try {
              const base64 = await blobToBase64(blob);
              const { data } = await supabase.functions.invoke("transcribe-audio", {
                body: { audio_base64: base64, mime_type: "audio/webm", school_id: schoolId },
              });
              if (data?.transcript) att.transcript = data.transcript;
            } catch (e) { console.warn("transcribe failed", e); }
          }
          setPending(p => [...p, att]);
        } catch (e: any) {
          toast.error(e?.message || "Voice upload failed");
        }
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
      setRecordSecs(0);
      timerRef.current = window.setInterval(() => setRecordSecs(s => s + 1), 1000);
    } catch (e) {
      toast.error("Microphone access denied");
    }
  }

  function stopRecording(discard = false) {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setRecording(false);
    if (discard) {
      chunksRef.current = [];
      try { recRef.current?.stream.getTracks().forEach(t => t.stop()); } catch {}
      recRef.current?.stop();
      return;
    }
    recRef.current?.stop();
  }

  async function submit() {
    if ((!text.trim() && !pending.length) || disabled || busy) return;
    const t = text; const a = pending;
    setText(""); setPending([]);
    await onSubmit(t, a);
  }

  function onKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); }
  }

  return (
    <div className="border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
      <div className="max-w-3xl mx-auto px-3 sm:px-4 py-3">
        {pending.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {pending.map((a, i) => (
              <div key={i} className="flex items-center gap-2 rounded-full border border-border bg-secondary pl-2 pr-1 py-1 text-xs">
                {a.type === "image" ? <ImageIcon className="size-3.5" /> :
                 a.type === "audio" ? <Volume2 className="size-3.5" /> :
                 <FileIcon className="size-3.5" />}
                <span className="max-w-[140px] truncate">{a.name}</span>
                <span className="opacity-60">{bytesToHuman(a.size)}</span>
                <button onClick={() => setPending(p => p.filter((_, j) => j !== i))} className="rounded-full hover:bg-muted p-1">
                  <X className="size-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {recording ? (
          <div className="flex items-center gap-3 rounded-2xl border border-destructive/40 bg-destructive/5 px-3 py-2">
            <span className="size-2.5 rounded-full bg-destructive animate-pulse" />
            <span className="text-sm font-medium">Recording… {recordSecs}s</span>
            <div className="flex-1" />
            <Button type="button" size="sm" variant="ghost" onClick={() => stopRecording(true)}>Discard</Button>
            <Button type="button" size="sm" onClick={() => stopRecording(false)}><Square className="size-4 mr-1.5" />Stop</Button>
          </div>
        ) : (
          <div className="flex items-end gap-2 rounded-2xl border border-border bg-card focus-within:ring-2 focus-within:ring-ring px-2 py-1.5">
            <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" disabled={uploading || disabled}
              onClick={() => fileRef.current?.click()} aria-label="Attach file">
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Paperclip className="size-4" />}
            </Button>
            <input ref={fileRef} type="file" accept={accept} multiple hidden onChange={onPickFiles} />
            <Textarea
              value={text}
              onChange={e => { setText(e.target.value); onTextChange?.(e.target.value); }}
              onKeyDown={onKey}
              placeholder={placeholder}
              disabled={disabled}
              rows={1}
              className={cn(
                "flex-1 resize-none border-0 bg-transparent px-1 py-2 text-sm shadow-none focus-visible:ring-0 focus-visible:ring-offset-0 min-h-[40px] max-h-40",
              )}
            />
            <Button type="button" size="icon" variant="ghost" className="size-9 shrink-0" disabled={disabled}
              onClick={startRecording} aria-label="Record voice note">
              <Mic className="size-4" />
            </Button>
            {busy && onStop ? (
              <Button type="button" size="icon" className="size-9 shrink-0" variant="secondary" onClick={onStop} aria-label="Stop">
                <Square className="size-4" />
              </Button>
            ) : (
              <Button type="button" size="icon" className="size-9 shrink-0" onClick={submit}
                disabled={disabled || (!text.trim() && !pending.length)} aria-label="Send">
                <Send className="size-4" />
              </Button>
            )}
          </div>
        )}
        <p className="mt-1.5 text-[10px] text-muted-foreground text-center">Press Enter to send · Shift+Enter for newline</p>
      </div>
    </div>
  );
}