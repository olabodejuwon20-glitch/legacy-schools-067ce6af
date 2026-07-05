import { ReactNode, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSchool } from "@/contexts/SchoolContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LayoutDashboard, Building2, Package, KeyRound, Settings2, ShoppingBag, CreditCard, Receipt, Users, Megaphone, LifeBuoy, BarChart3, ShieldCheck, ScrollText, Cog, ChevronsLeft, ChevronsRight, ChevronRight, Search, LogOut, Rocket, AlertCircle, Zap, Flag, Sparkles, Bell, Activity, Command, TrendingUp, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Helmet } from "react-helmet-async";

const NAV = [
  { group: "Overview", items: [
    { to: "/super", icon: LayoutDashboard, label: "Dashboard", end: true },
  ]},
  { group: "Customers", items: [
    { to: "/super/schools", icon: Building2, label: "Schools" },
    { to: "/super/users", icon: Users, label: "Users & Roles" },
  ]},
  { group: "Products", items: [
    { to: "/super/products", icon: Package, label: "Products" },
    { to: "/super/configurations", icon: Settings2, label: "Tenant Config" },
    { to: "/super/academic-defaults", icon: Settings2, label: "Academic Defaults" },
  ]},
  { group: "Business", items: [
    { to: "/super/business", icon: TrendingUp, label: "Business" },
    { to: "/super/subscriptions", icon: CreditCard, label: "Subscriptions" },
  ]},
  { group: "Operations", items: [
    { to: "/super/operations", icon: Wrench, label: "Operations", badgeKey: "errors" },
  ]},
  { group: "Intelligence", items: [
    { to: "/super/intelligence", icon: BarChart3, label: "Intelligence" },
  ]},
  { group: "Security", items: [
    { to: "/super/security", icon: ShieldCheck, label: "Security Center" },
  ]},
  { group: "Platform Settings", items: [
    { to: "/super/settings", icon: Cog, label: "Preferences" },
  ]},
];

const BREADCRUMB_LABELS: Record<string, string> = {
  super: "Platform",
  schools: "Schools",
  pilots: "Pilot Program",
  users: "Users & Roles",
  products: "Products",
  modules: "Modules & Plugins",
  licensing: "Feature Licensing",
  configurations: "Tenant Config",
  "academic-defaults": "Academic Defaults",
  marketplace: "Marketplace",
  subscriptions: "Subscriptions",
  billing: "Billing & Revenue",
  business: "Business",
  operations: "Operations",
  intelligence: "Intelligence",
  announcements: "Announcements",
  tickets: "Support Tickets",
  errors: "Live Errors",
  quotas: "AI Quotas",
  "feature-flags": "Feature Flags",
  security: "Security Center",
  logs: "System Logs",
  settings: "Preferences",
  analytics: "Analytics",
  claim: "Claim Access",
};

function useIsSuperAdmin() {
  const { user, loading } = useSchool();
  const [state, setState] = useState<"loading" | "yes" | "no">("loading");
  const [hasAny, setHasAny] = useState<boolean | null>(null);
  useEffect(() => {
    if (loading) return;
    (async () => {
      const { count } = await supabase.from("user_roles").select("id", { count: "exact", head: true }).eq("role", "super_admin");
      setHasAny((count ?? 0) > 0);
      if (!user) { setState("no"); return; }
      const { data } = await supabase.rpc("is_super_admin" as any, { _user: user.id });
      setState(data ? "yes" : "no");
    })();
  }, [user, loading]);
  return { state, hasAny, user };
}

export function SuperGuard({ children }: { children: ReactNode }) {
  const nav = useNavigate();
  const { state, hasAny, user } = useIsSuperAdmin();
  useEffect(() => {
    if (state === "no") {
      if (!user) nav("/super/claim", { replace: true });
      else if (hasAny === false) nav("/super/claim", { replace: true });
      else nav("/", { replace: true });
    }
  }, [state, hasAny, user, nav]);
  if (state !== "yes") return <div className="min-h-screen grid place-items-center"><Loader2 className="size-5 animate-spin text-muted-foreground" /></div>;
  return <>{children}</>;
}

export default function SuperLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const { pathname } = useLocation();
  const { signOut, email } = useSchool();
  const [openErrors, setOpenErrors] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      const { count } = await supabase
        .from("client_errors")
        .select("id", { count: "exact", head: true })
        .eq("resolution_status", "open");
      if (alive) setOpenErrors(count ?? 0);
    }
    void load();
    const channel = supabase
      .channel("super-layout-errors")
      .on("postgres_changes", { event: "*", schema: "public", table: "client_errors" }, () => void load())
      .subscribe();
    return () => { alive = false; supabase.removeChannel(channel); };
  }, []);

  const segments = pathname.split("/").filter(Boolean);
  const crumbs = segments.map((seg, i) => ({
    label: BREADCRUMB_LABELS[seg] ?? seg.replace(/-/g, " "),
    to: "/" + segments.slice(0, i + 1).join("/"),
  }));

  return (
    <SuperGuard>
      <Helmet><meta name="robots" content="noindex, nofollow" /></Helmet>
      <div className="min-h-screen flex bg-[hsl(var(--background))] text-foreground selection:bg-primary/20">
        {/* Sidebar */}
        <aside className={cn(
          "sticky top-0 h-screen border-r border-border/70 bg-card/40 backdrop-blur flex flex-col transition-[width] duration-200 shrink-0",
          collapsed ? "w-[60px]" : "w-[232px]"
        )}>
          <div className="h-12 px-3 flex items-center gap-2 border-b border-border/70">
            <div className="size-6 rounded-md bg-gradient-to-br from-foreground to-foreground/70 text-background grid place-items-center text-[10px] font-bold shadow-sm">L</div>
            {!collapsed && (
              <div className="flex items-baseline gap-1.5 min-w-0">
                <span className="text-[13px] font-semibold tracking-tight">Legacyskool</span>
                <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">OS</span>
              </div>
            )}
          </div>
          <nav className="flex-1 overflow-y-auto overscroll-contain py-2 space-y-3 [scrollbar-width:thin] [scrollbar-color:hsl(var(--border))_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border/60 hover:[&::-webkit-scrollbar-thumb]:bg-border scroll-smooth">
            {NAV.map(group => (
              <SuperGroup key={group.group} group={group} collapsed={collapsed} pathname={pathname} badges={{ errors: openErrors ?? 0 }} />
            ))}
          </nav>
          <button onClick={() => setCollapsed(c => !c)} className="h-9 border-t border-border/70 text-muted-foreground hover:bg-muted/60 hover:text-foreground flex items-center justify-center text-[11px] gap-1.5 transition-colors">
            {collapsed ? <ChevronsRight className="size-3.5" /> : <><ChevronsLeft className="size-3.5" /> Collapse</>}
          </button>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-12 sticky top-0 z-30 border-b border-border/70 bg-background/85 backdrop-blur-md flex items-center px-4 gap-3">
            <div className="relative flex-1 max-w-xl group">
              <Search className="size-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search schools, modules, tickets, users…" className="pl-8 pr-16 h-8 text-[13px] bg-muted/40 border-transparent focus-visible:bg-background focus-visible:border-border rounded-md" />
              <kbd className="hidden md:inline-flex absolute right-2 top-1/2 -translate-y-1/2 h-5 items-center gap-0.5 px-1.5 rounded border border-border bg-muted/60 text-[10px] font-mono text-muted-foreground pointer-events-none">
                <Command className="size-2.5" />K
              </kbd>
            </div>
            <div className="flex items-center gap-1 text-xs">
              <button className="hidden md:inline-flex items-center gap-1.5 px-2 h-7 rounded-md border border-border/70 bg-card/60 hover:bg-muted text-[11px] text-muted-foreground transition-colors" title="Platform status">
                <span className="relative flex size-1.5">
                  <span className="absolute inline-flex size-full rounded-full bg-success opacity-75 animate-ping" />
                  <span className="relative inline-flex size-1.5 rounded-full bg-success" />
                </span>
                <Activity className="size-3" /> All systems normal
              </button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" title="AI Assistant"><Sparkles className="size-3.5" /></Button>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 relative" title="Notifications">
                <Bell className="size-3.5" />
                {(openErrors ?? 0) > 0 && <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />}
              </Button>
              <div className="hidden md:flex items-center gap-2 pl-2 ml-1 border-l border-border/70">
                <div className="size-6 rounded-full bg-gradient-to-br from-primary/80 to-primary/40 text-primary-foreground grid place-items-center text-[10px] font-semibold uppercase">
                  {(email?.[0] ?? "s")}
                </div>
                <span className="text-[11px] text-muted-foreground max-w-[140px] truncate">{email}</span>
              </div>
              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={signOut} title="Sign out"><LogOut className="size-3.5" /></Button>
            </div>
          </header>
          {crumbs.length > 1 && (
            <div className="px-6 pt-3 pb-1 flex items-center gap-1 text-[11px] text-muted-foreground">
              {crumbs.map((c, i) => (
                <span key={c.to} className="flex items-center gap-1">
                  {i > 0 && <ChevronRight className="size-3 opacity-50" />}
                  {i === crumbs.length - 1 ? (
                    <span className="text-foreground font-medium capitalize">{c.label}</span>
                  ) : (
                    <NavLink to={c.to} className="hover:text-foreground capitalize transition-colors">{c.label}</NavLink>
                  )}
                </span>
              ))}
            </div>
          )}
          <main className="flex-1 px-6 pt-4 pb-10 overflow-x-auto">
            <div className="max-w-[1400px] mx-auto">
              <Outlet key={pathname} />
            </div>
          </main>
        </div>
      </div>
    </SuperGuard>
  );
}

function SuperGroup({ group, collapsed, pathname, badges }: { group: { group: string; items: any[] }; collapsed: boolean; pathname: string; badges?: Record<string, number> }) {
  return (
    <div className="px-1.5">
      {!collapsed && (
        <div className="px-2.5 mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground/60">{group.group}</div>
      )}
      <div className="space-y-px">
          {group.items.map((item: any) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => cn(
                "group flex items-center gap-2 px-2 py-1.5 rounded-md text-[13px] font-medium transition-colors relative",
                isActive
                  ? "bg-muted text-foreground before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5 before:rounded-full before:bg-foreground"
                  : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="size-3.5 shrink-0 opacity-80 group-hover:opacity-100" />
              {!collapsed && <span className="truncate">{item.label}</span>}
              {!collapsed && item.badgeKey && (badges?.[item.badgeKey] ?? 0) > 0 && (
                <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground min-w-[16px] text-center">
                  {badges![item.badgeKey]}
                </span>
              )}
            </NavLink>
          ))}
      </div>
    </div>
  );
}