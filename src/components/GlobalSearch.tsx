import { useEffect, useMemo, useState, type ComponentType } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Command as CmdIcon, CornerDownLeft } from "lucide-react";
import {
  CommandDialog, CommandInput, CommandList, CommandEmpty,
  CommandGroup, CommandItem, CommandSeparator,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export type SearchItem = {
  label: string;
  to: string;                 // absolute path to navigate to
  icon?: ComponentType<{ className?: string }>;
  hint?: string;              // right-hand hint text (e.g. section name)
  keywords?: string[];        // extra terms for cmdk matching
};

export type SearchGroup = { heading: string; items: SearchItem[] };

/**
 * Async fetcher for live results (people, records, etc.). Called with the
 * current query (>= 2 chars). Return an array of groups, or an empty array.
 */
export type SearchFetcher = (query: string, signal: AbortSignal) => Promise<SearchGroup[]>;

interface Props {
  /** Static, always-visible groups (typically navigation entries). */
  groups: SearchGroup[];
  /** Optional live/dynamic results. */
  fetcher?: SearchFetcher;
  /** Placeholder shown in the palette input. */
  placeholder?: string;
  /** Trigger variant. `bar` matches the previous header input; `icon` is a compact button. */
  triggerVariant?: "bar" | "icon";
  /** Optional class overrides for the trigger. */
  triggerClassName?: string;
}

export function GlobalSearch({
  groups,
  fetcher,
  placeholder = "Search anything…",
  triggerVariant = "bar",
  triggerClassName,
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [dynamicGroups, setDynamicGroups] = useState<SearchGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  // Cmd/Ctrl+K opens the palette anywhere in the portal.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setOpen((o) => !o);
      }
      if (e.key === "/" && !open) {
        const t = e.target as HTMLElement | null;
        const tag = t?.tagName?.toLowerCase();
        if (tag === "input" || tag === "textarea" || t?.isContentEditable) return;
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  // Reset query when closing.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setDynamicGroups([]);
    }
  }, [open]);

  // Debounced dynamic fetch.
  useEffect(() => {
    if (!fetcher) return;
    const q = query.trim();
    if (q.length < 2) {
      setDynamicGroups([]);
      setLoading(false);
      return;
    }
    const ctrl = new AbortController();
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetcher(q, ctrl.signal);
        if (!ctrl.signal.aborted) setDynamicGroups(res);
      } catch {
        if (!ctrl.signal.aborted) setDynamicGroups([]);
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 180);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [query, fetcher]);

  const go = (to: string) => {
    setOpen(false);
    navigate(to);
  };

  const allGroups = useMemo(() => [...dynamicGroups, ...groups], [dynamicGroups, groups]);

  return (
    <>
      {triggerVariant === "bar" ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "hidden md:flex relative items-center h-9 w-[260px] rounded-md bg-secondary/60 border border-transparent hover:bg-secondary transition-colors text-left",
            triggerClassName,
          )}
          aria-label="Open global search"
        >
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <span className="pl-9 pr-16 text-sm text-muted-foreground truncate">{placeholder}</span>
          <kbd className="hidden lg:inline-flex absolute right-2 top-1/2 -translate-y-1/2 h-5 items-center gap-0.5 px-1.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-muted-foreground">
            <CmdIcon className="size-2.5" />K
          </kbd>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            "inline-flex items-center justify-center size-9 rounded-md hover:bg-secondary/60 text-muted-foreground",
            triggerClassName,
          )}
          aria-label="Open global search"
          title="Search (⌘K)"
        >
          <Search className="size-5" />
        </button>
      )}

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Searching…" : "No results found."}
          </CommandEmpty>
          {allGroups.map((group, gi) => (
            <div key={`${group.heading}-${gi}`}>
              {gi > 0 && <CommandSeparator />}
              <CommandGroup heading={group.heading}>
                {group.items.map((it) => {
                  const Icon = it.icon;
                  const value = [it.label, it.hint ?? "", ...(it.keywords ?? [])].join(" ");
                  return (
                    <CommandItem
                      key={`${group.heading}:${it.to}:${it.label}`}
                      value={value}
                      onSelect={() => go(it.to)}
                      className="gap-2"
                    >
                      {Icon && <Icon className="size-4 text-muted-foreground" />}
                      <span className="truncate">{it.label}</span>
                      {it.hint && (
                        <span className="ml-auto text-[11px] text-muted-foreground truncate max-w-[45%]">
                          {it.hint}
                        </span>
                      )}
                      <CornerDownLeft className="size-3 text-muted-foreground/50 opacity-0 data-[selected=true]:opacity-100" />
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </div>
          ))}
        </CommandList>
      </CommandDialog>
    </>
  );
}
