import React, { ReactNode } from 'react';
import AssistantChat from './AssistantChat';

/**
 * Super‑Admin layout wrapper.
 * All Super‑Admin pages (`src/pages/super/*.tsx`) are rendered inside this component.
 * It provides the common header/sidebar (if any) and injects the autonomous assistant UI.
 */
export default function SuperLayout({ children }: { children: ReactNode }) {
  return (
    <>
      {/* ---- Existing layout markup (you can replace this with your actual header/sidebar) ---- */}
      <div className="flex min-h-screen bg-background text-foreground">
        {/* Example placeholder sidebar – replace with your real one if needed */}
        <aside className="w-64 bg-muted p-4 hidden lg:block">
          <h2 className="font-bold mb-4">Super‑Admin Menu</h2>
          {/* Add navigation links here */}
        </aside>
        <main className="flex-1 p-6 overflow-auto">
          {children}
        </main>
      </div>

      {/* ---- Autonomous Assistant UI (floating button + chat modal) ---- */}
      <AssistantChat />
    </>
  );
}
