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
      if (ref.current) {
        ref.current.style.transform = `translate3d(${current.current.x - 200}px, ${current.current.y - 200}px, 0)`;
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
    <div
      ref={ref}
      aria-hidden
      className="pointer-events-none fixed left-0 top-0 z-[1] h-[400px] w-[400px] rounded-full opacity-70 mix-blend-plus-lighter"
      style={{
        background:
          "radial-gradient(circle, hsl(221 83% 60% / 0.22) 0%, hsl(221 83% 60% / 0.08) 30%, transparent 65%)",
        filter: "blur(20px)",
      }}
    />
  );
}