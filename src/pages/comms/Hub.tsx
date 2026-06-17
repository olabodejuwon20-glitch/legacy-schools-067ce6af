import { NavLink, Outlet, useParams } from "react-router-dom";
import { Inbox, MessageSquare, Hash, Megaphone, Radio, LifeBuoy, FileText, Clock, BarChart3, Bell } from "lucide-react";
import { useSchool } from "@/contexts/SchoolContext";
import { cn } from "@/lib/utils";
import SEO from "@/components/SEO";

/**
 * Communication Hub shell — Slack/Teams-style 2-pane layout that hosts all
 * messaging surfaces under a single parent route. Each sub-page is a nested
 * route so URLs stay shareable and the existing sidebar stays clean.
 */

const NAV = [
  { to: "inbox",         label: "Inbox",         icon: Inbox,         roles: ["admin", "teacher", "student", "parent"] },
  { to: "dm",            label: "Direct Messages", icon: MessageSquare, roles: ["admin", "teacher", "student", "parent"] },
  { to: "channels",      label: "Channels",      icon: Hash,          roles: ["admin", "teacher", "student", "parent"] },
  { to: "announcements", label: "Announcements", icon: Megaphone,     roles: ["admin", "teacher", "student", "parent"] },
  { to: "broadcasts",    label: "Broadcast Center", icon: Radio,      roles: ["admin"] },
  { to: "tickets",       label: "Support Tickets", icon: LifeBuoy,    roles: ["admin", "teacher", "student", "parent"] },
  { to: "templates",     label: "Templates",     icon: FileText,      roles: ["admin", "teacher"] },
  { to: "scheduled",     label: "Scheduled",     icon: Clock,         roles: ["admin", "teacher"] },
  { to: "notifications", label: "Notifications", icon: Bell,          roles: ["admin", "teacher", "student", "parent"] },
  { to: "analytics",     label: "Analytics",     icon: BarChart3,     roles: ["admin"] },
] as const;

export default function CommsHub() {
  const { activeRole } = useSchool();
  const params = useParams();
  const items = NAV.filter((i) => activeRole && (i.roles as readonly string[]).includes(activeRole));

  return (
    <>
      <SEO title="Communication Hub" description="Unified inbox, channels, broadcasts and tickets for your school." />
      <div className="h-[calc(100vh-3.5rem)] flex bg-background">
        <aside className="w-56 shrink-0 border-r bg-card/40 overflow-y-auto">
          <div className="px-4 py-3">
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Communication
            </div>
          </div>
          <nav className="px-2 pb-4 space-y-0.5">
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <NavLink
                  key={it.to}
                  to={it.to}
                  className={({ isActive }) =>
                    cn(
                      "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
                      isActive
                        ? "bg-primary/10 text-primary font-medium"
                        : "text-foreground/80 hover:bg-muted hover:text-foreground"
                    )
                  }
                >
                  <Icon className="size-4" />
                  <span className="truncate">{it.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <main className="flex-1 min-w-0 overflow-hidden">
          <Outlet key={params.convId ?? params.channelId ?? "root"} />
        </main>
      </div>
    </>
  );
}