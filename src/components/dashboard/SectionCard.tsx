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
      <header className="flex items-center justify-between px-5 py-4 border-b border-border">
        <div>
          <h3 className="font-display font-semibold">{title}</h3>
          {description && <p className="text-xs text-muted-foreground mt-0.5">{description}</p>}
        </div>
        {action}
      </header>
      <div className="p-5">{children}</div>
    </section>
  );
}
