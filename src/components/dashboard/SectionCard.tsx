import { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface Props {
  title: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  description?: ReactNode;
}

export function SectionCard({ title, action, children, className, description }: Props) {
  return (
    <section className={cn("rounded-xl bg-card border border-border shadow-card", className)}>
      <header className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-b border-border">
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action && <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">{action}</div>}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
