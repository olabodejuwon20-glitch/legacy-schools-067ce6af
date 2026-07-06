import { useEffect, useRef } from "react";

/**
 * Subtle blue glow that follows the cursor. Mounted only on the landing page.
 * Uses rAF + translate3d for smooth 60fps and pointer-events-none so it never
 * blocks clicks. Hidden for touch / reduced-motion users.
 */
export default function CursorGlow() {
  const ref = useRef<HTMLDivElement>(null);
  const target = useRef({ x: -400, y: -400 });
  const current = useRef({ x: -400, y: -400 });
  const ringRef = useRef<HTMLDivElement>(null);
  const ringTarget = useRef({ x: -400, y: -400 });
  const ringCurrent = useRef({ x: -400, y: -400 });

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    let raf = 0;
    const onMove = (e: PointerEvent) => {
      target.current.x = e.clientX;
      target.current.y = e.clientY;
    };
    const tick = () => {
      current.current.x += (target.current.x - current.current.x) * 0.18;
      current.current.y += (target.current.y - current.current.y) * 0.18;
      ringCurrent.current.x += (target.current.x - ringCurrent.current.x) * 0.08;
      ringCurrent.current.y += (target.current.y - ringCurrent.current.y) * 0.08;
      if (ref.current) {
        ref.current.style.transform = `translate3d(${current.current.x - 80}px, ${current.current.y - 80}px, 0)`;
      }
      if (ringRef.current) {
        ringRef.current.style.transform = `translate3d(${ringCurrent.current.x - 22}px, ${ringCurrent.current.y - 22}px, 0)`;
      }
      raf = requestAnimationFrame(tick);
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => {
      window.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      {/* soft aurora halo — the ambient glow */}
      <div
        ref={ref}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[1] h-[160px] w-[160px] rounded-full opacity-90 mix-blend-plus-lighter"
        style={{
          background:
            "radial-gradient(circle, hsl(221 100% 68% / 0.35) 0%, hsl(262 83% 65% / 0.18) 35%, hsl(199 89% 55% / 0.08) 60%, transparent 75%)",
          filter: "blur(14px)",
        }}
      />
      {/* crisp trailing ring — adds definition */}
      <div
        ref={ringRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[1] h-11 w-11 rounded-full opacity-60"
        style={{
          border: "1px solid hsl(221 83% 60% / 0.55)",
          boxShadow:
            "0 0 12px hsl(221 83% 60% / 0.35), inset 0 0 8px hsl(221 100% 75% / 0.25)",
        }}
      />
    </>
  );
}