import { useEffect, useRef } from "react";

/**
 * Dark shiny sparkly cursor trail. Follows the pointer with zero delay
 * and emits small sparkle particles that fade out.
 * Hidden for touch / reduced-motion users.
 */
export default function CursorGlow() {
  const coreRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(hover: none), (prefers-reduced-motion: reduce)");
    if (mq.matches) return;

    const canvas = canvasRef.current!;
    const ctx = canvas.getContext("2d")!;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener("resize", resize);

    type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; hue: number };
    const particles: P[] = [];
    let mx = -400, my = -400;

    const onMove = (e: PointerEvent) => {
      mx = e.clientX;
      my = e.clientY;
      if (coreRef.current) {
        coreRef.current.style.transform = `translate3d(${mx - 26}px, ${my - 26}px, 0)`;
      }
      const n = 2;
      for (let i = 0; i < n; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.4 + Math.random() * 1.6;
        particles.push({
          x: mx + (Math.random() - 0.5) * 4,
          y: my + (Math.random() - 0.5) * 4,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed + 0.2,
          life: 0,
          max: 40 + Math.random() * 40,
          size: 0.6 + Math.random() * 1.6,
          hue: 210 + Math.random() * 60,
        });
      }
      if (particles.length > 220) particles.splice(0, particles.length - 220);
    };

    let raf = 0;
    const tick = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.globalCompositeOperation = "lighter";
      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.life++;
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= 0.96;
        p.vy = p.vy * 0.96 + 0.02;
        const t = p.life / p.max;
        if (t >= 1) { particles.splice(i, 1); continue; }
        const alpha = (1 - t) * 0.95;
        const r = p.size * (1 - t * 0.4);
        const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, r * 6);
        grad.addColorStop(0, `hsla(${p.hue}, 100%, 85%, ${alpha})`);
        grad.addColorStop(0.3, `hsla(${p.hue}, 95%, 60%, ${alpha * 0.6})`);
        grad.addColorStop(1, `hsla(${p.hue}, 90%, 40%, 0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${p.hue}, 100%, 95%, ${alpha})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <>
      <canvas
        ref={canvasRef}
        aria-hidden
        className="pointer-events-none fixed inset-0 z-[1]"
      />
      <div
        ref={coreRef}
        aria-hidden
        className="pointer-events-none fixed left-0 top-0 z-[2] h-[52px] w-[52px] rounded-full"
        style={{
          background:
            "radial-gradient(circle, hsl(230 90% 12% / 0.85) 0%, hsl(230 80% 20% / 0.55) 30%, hsl(230 70% 30% / 0.15) 55%, transparent 72%)",
          boxShadow:
            "0 0 14px hsl(230 90% 40% / 0.55), inset 0 0 10px hsl(220 100% 80% / 0.35)",
          filter: "blur(0.4px)",
        }}
      />
    </>
  );
}