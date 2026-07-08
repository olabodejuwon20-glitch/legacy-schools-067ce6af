import { useEffect, useRef } from "react";

/**
 * Theme-aware cursor companion. A small, soft shadow that tracks the
 * pointer exactly (no lag), uses semantic foreground colour so it stays
 * readable in light and dark modes, and is disabled for touch / reduced
 * motion users.
 */
export default function CursorGlow() {
  const shadowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const shadow = shadowRef.current;
    if (!shadow) return;

    let raf = 0;
    let lastX = -100;
    let lastY = -100;
    let pendingX = -100;
    let pendingY = -100;
    let dirty = false;

    const onMove = (e: PointerEvent) => {
      pendingX = e.clientX - 10;
      pendingY = e.clientY - 10;
      if (!dirty) {
        dirty = true;
        raf = requestAnimationFrame(tick);
      }
    };

    const tick = () => {
      if (pendingX !== lastX || pendingY !== lastY) {
        lastX = pendingX;
        lastY = pendingY;
        shadow.style.transform = `translate3d(${pendingX}px, ${pendingY}px, 0)`;
      }
      dirty = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });

    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <div
      ref={shadowRef}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[1] h-5 w-5 rounded-full"
      style={{
        background: "hsl(var(--foreground) / 0.08)",
        boxShadow:
          "0 4px 14px hsl(var(--foreground) / 0.12), 0 0 6px hsl(var(--foreground) / 0.08)",
        filter: "blur(2.5px)",
        opacity: 0.7,
        willChange: "transform",
        contain: "layout style",
      }}
    />
  );
}
