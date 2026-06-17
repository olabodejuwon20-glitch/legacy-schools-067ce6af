import { Bell } from "lucide-react";

export default function NotificationsView() {
  return (
    <div className="h-full overflow-auto p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold flex items-center gap-2 mb-4"><Bell className="size-6"/> Notifications</h1>
      <div className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">
        Real-time notifications are delivered as toasts via the bell in the top nav.
        A dedicated history view is on the roadmap — DMs, channel mentions, broadcasts and
        announcements all flow through the bell.
      </div>
    </div>
  );
}