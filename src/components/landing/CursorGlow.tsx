import { useEffect, useRef } from "react";

/**
 * Small, soft cursor shadow. Follows the pointer with a subtle fade
 * and stays hidden for touch / reduced-motion users.
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
    let targetX = -100;
    let targetY = -100;
    let currentX = -100;
    let currentY = -100;

    const onMove = (e: PointerEvent) => {
      targetX = e.clientX;
      targetY = e.clientY;
    };

    const tick = () => {
      // gentle lag so the shadow feels like a soft trailing companion
      currentX += (targetX - currentX) * 0.18;
      currentY += (targetY - currentY) * 0.18;
      shadow.style.transform = `translate3d(${currentX - 12}px, ${currentY - 12}px, 0)`;
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
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
      className="pointer-events-none fixed left-0 top-0 z-[1] h-6 w-6 rounded-full"
      style={{
        background: "hsl(230 40% 8% / 0.35)",
        boxShadow: "0 6px 20px hsl(230 40% 8% / 0.45), 0 0 8px hsl(230 40% 12% / 0.25)",
        filter: "blur(3px)",
        opacity: 0.75,
      }}
    />
  );
}
