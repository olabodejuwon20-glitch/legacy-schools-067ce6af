import { ReactNode, useEffect, useState } from "react";
import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useSchool } from "@/contexts/SchoolContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, LayoutDashboard, Building2, Package, KeyRound, Settings2, ShoppingBag, CreditCard, Receipt, Users, Megaphone, LifeBuoy, BarChart3, ShieldCheck, ScrollText, Cog, ChevronLeft, ChevronRight, Search, LogOut, Rocket } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const NAV = [
  { group: "Overview", items: [
    { to: "/super", icon: LayoutDashboard, label: "Dashboard", end: true },
    { to: "/super/analytics", icon: BarChart3, label: "Analytics" },
  ]},
  { group: "Tenants", items: [
    { to: "/super/schools", icon: Building2, label: "Schools" },
    { to: "/super/pilots", icon: Rocket, label: "Pilot Program" },
    { to: "/super/users", icon: Users, label: "Users & Roles" },
  ]},
  { group: "Catalog", items: [
    { to: "/super/modules", icon: Package, label: "Modules & Plugins" },
    { to: "/super/licensing", icon: KeyRound, label: "Feature Licensing" },
    { to: "/super/configurations", icon: Settings2, label: "Tenant Config" },
    { to: "/super/academic-defaults", icon: Settings2, label: "Academic Defaults" },
    { to: "/super/marketplace", icon: ShoppingBag, label: "Marketplace" },
  ]},
  { group: "Revenue", items: [
    { to: "/super/subscriptions", icon: CreditCard, label: "Subscriptions" },
    { to: "/super/billing", icon: Receipt, label: "Billing & Revenue" },
  ]},
  { group: "Operations", items: [
    { to: "/super/announcements", icon: Megaphone, label: "Announcements" },
    { to: "/super/tickets", icon: LifeBuoy, label: "Support Tickets" },
  ]},
  { group: "Platform", items: [
    { to: "/super/security", icon: ShieldCheck, label: "Security Center" },
    { to: "/super/logs", icon: ScrollText, label: "System Logs" },
    { to: "/super/settings", icon: Cog, label: "Platform Settings" },
  ]},
];

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

  return (
    <SuperGuard>
      <div className="min-h-screen flex bg-background">
        {/* Sidebar */}
        <aside className={cn("border-r border-border bg-card flex flex-col transition-[width] duration-200", collapsed ? "w-[68px]" : "w-[240px]")}>
          <div className="h-14 px-4 flex items-center gap-2 border-b border-border">
            <div className="size-7 rounded-md bg-foreground text-background grid place-items-center text-xs font-bold">E</div>
            {!collapsed && <div className="text-sm font-semibold tracking-tight">Legacyskool <span className="text-muted-foreground font-normal">OS</span></div>}
          </div>
          <nav className="flex-1 overflow-y-auto py-3 space-y-4">
            {NAV.map(group => (
              <SuperGroup key={group.group} group={group} collapsed={collapsed} pathname={pathname} />
            ))}
          </nav>
          <button onClick={() => setCollapsed(c => !c)} className="h-10 border-t border-border text-muted-foreground hover:bg-muted flex items-center justify-center text-xs gap-1">
            {collapsed ? <ChevronRight className="size-4" /> : <><ChevronLeft className="size-4" /> Collapse</>}
          </button>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          <header className="h-14 sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur flex items-center px-6 gap-4">
            <div className="relative flex-1 max-w-md">
              <Search className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search schools, modules, tickets…" className="pl-9 h-9 bg-muted/40 border-transparent focus-visible:bg-background" />
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="hidden md:inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-border bg-card">
                <span className="size-1.5 rounded-full bg-success" /> Live
              </span>
              <span className="hidden md:inline text-muted-foreground">{email}</span>
              <Button variant="ghost" size="sm" onClick={signOut} title="Sign out"><LogOut className="size-4" /></Button>
            </div>
          </header>
          <main className="flex-1 px-6 py-8 overflow-x-auto">
            <div className="max-w-7xl mx-auto">
              <Outlet key={pathname} />
            </div>
          </main>
        </div>
      </div>
    </SuperGuard>
  );
}

function SuperGroup({ group, collapsed, pathname }: { group: { group: string; items: any[] }; collapsed: boolean; pathname: string }) {
  const isCollapsible = group.items.length > 1 && group.group !== "Overview";
  const containsActive = group.items.some(it => (it.end ? pathname === it.to : pathname === it.to || pathname.startsWith(it.to + "/")));
  const storageKey = `super-sidebar:open:${group.group}`;
  const [open, setOpen] = useState<boolean>(() => {
    if (!isCollapsible) return true;
    try {
      const v = localStorage.getItem(storageKey);
      if (v === "1") return true;
      if (v === "0") return false;
    } catch {}
    return containsActive;
  });
  useEffect(() => { if (isCollapsible && containsActive) setOpen(true); }, [containsActive, isCollapsible]);
  const toggle = () => setOpen(o => {
    const next = !o;
    try { localStorage.setItem(storageKey, next ? "1" : "0"); } catch {}
    return next;
  });

  return (
    <div>
      {!collapsed && (
        isCollapsible ? (
          <button type="button" onClick={toggle} aria-expanded={open}
            className="w-full flex items-center justify-between px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 hover:text-foreground transition-colors">
            <span>{group.group}</span>
            <ChevronRight className={cn("size-3 transition-transform", open && "rotate-90")} />
          </button>
        ) : (
          <div className="px-4 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">{group.group}</div>
        )
      )}
      {(collapsed || !isCollapsible || open) && (
        <div className="space-y-0.5 px-2">
          {group.items.map((item: any) => (
            <NavLink key={item.to} to={item.to} end={item.end}
              className={({ isActive }) => cn(
                "flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-colors",
                isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
              title={collapsed ? item.label : undefined}
            >
              <item.icon className="size-4 shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}