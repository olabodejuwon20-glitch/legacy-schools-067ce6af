import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, MessageCircle, Bot, BookOpen, Wallet,
  GraduationCap, Users, ClipboardCheck, UserSquare2, Bus, Library, Sparkles,
} from "lucide-react";

type NodeDef = {
  key: string;
  label: string;
  Icon: typeof BarChart3;
};

const NODES: NodeDef[] = [
  { key: "analytics",     label: "Analytics",     Icon: BarChart3 },
  { key: "ai",            label: "AI Copilot",    Icon: Bot },
  { key: "finance",       label: "Finance",       Icon: Wallet },
  { key: "parents",       label: "Parents",       Icon: Users },
  { key: "students",      label: "Students",      Icon: UserSquare2 },
  { key: "library",       label: "Library",       Icon: Library },
  { key: "transport",     label: "Transport",     Icon: Bus },
  { key: "exams",         label: "Examinations",  Icon: ClipboardCheck },
  { key: "teachers",      label: "Teachers",      Icon: GraduationCap },
  { key: "academics",     label: "Academics",     Icon: BookOpen },
  { key: "comms",         label: "Communication", Icon: MessageCircle },
];

const VIEW = 720;
const CENTER = VIEW / 2;
const RADIUS = 300;   // wider orbit so icons have space
const HUB_R = 74;     // where lines start (edge of the OS hub)
const ICON_R = 26;    // where lines end (edge of the icon tile)

type Layout = {
  key: string;
  label: string;
  Icon: NodeDef["Icon"];
  angle: number;
  x: number;
  y: number;
  sx: number; sy: number;
  ex: number; ey: number;
  leftPct: number;
  topPct: number;
  dur: number;
  delay: number;
};

function buildLayout(): Layout[] {
  return NODES.map((n, i) => {
    const angle = (-Math.PI / 2) + (i * (2 * Math.PI)) / NODES.length;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const x = CENTER + RADIUS * cos;
    const y = CENTER + RADIUS * sin;
    const sx = CENTER + HUB_R * cos;
    const sy = CENTER + HUB_R * sin;
    const ex = CENTER + (RADIUS - ICON_R) * cos;
    const ey = CENTER + (RADIUS - ICON_R) * sin;
    return {
      key: n.key,
      label: n.label,
      Icon: n.Icon,
      angle,
      x, y, sx, sy, ex, ey,
      leftPct: (x / VIEW) * 100,
      topPct: (y / VIEW) * 100,
      dur: 2.6 + (i % 5) * 0.3,
      delay: (i * 0.3) % 2,
    };
  });
}

export default function EducationNetwork() {
  const layout = useMemo(buildLayout, []);
  const [hovered, setHovered] = useState<string | null>(null);

  return (
    <div className="relative w-full">
      {/* Desktop / tablet */}
      <div className="hidden sm:block relative mx-auto aspect-square w-full max-w-[680px]">
        {/* soft background glow */}
        <div
          className="absolute inset-0 -z-10 rounded-full blur-3xl opacity-70"
          style={{
            background:
              "radial-gradient(circle at 50% 50%, hsl(221 83% 60% / 0.28), transparent 62%)",
          }}
        />

        {/* Rotating orbit layer — contains connectors + icons.
            The center logo lives OUTSIDE this so it stays perfectly still and centered. */}
        <motion.div
          className="absolute inset-0"
          animate={{ rotate: 360 }}
          transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
        >
          <svg viewBox={`0 0 ${VIEW} ${VIEW}`} className="absolute inset-0 w-full h-full overflow-visible">
            <defs>
              <radialGradient id="particle-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="hsl(221 100% 78%)" stopOpacity="1" />
                <stop offset="60%" stopColor="hsl(221 83% 60%)" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(221 83% 60%)" stopOpacity="0" />
              </radialGradient>
              <filter id="particle-blur" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="1.2" />
              </filter>
            </defs>

            {layout.map((n) => {
              const active = hovered === n.key;
              return (
                <g key={`g-${n.key}`}>
                  <path
                    id={`np-${n.key}`}
                    d={`M ${n.sx.toFixed(2)} ${n.sy.toFixed(2)} L ${n.ex.toFixed(2)} ${n.ey.toFixed(2)}`}
                    fill="none"
                    stroke={active ? "hsl(221 83% 60%)" : "hsl(221 40% 60% / 0.4)"}
                    strokeWidth={active ? 1.8 : 1.1}
                    strokeLinecap="round"
                    style={{ transition: "stroke 200ms, stroke-width 200ms" }}
                  />
                  {/* head dot at the icon end so every line clearly terminates on its icon */}
                  <circle
                    cx={n.ex}
                    cy={n.ey}
                    r={active ? 4.5 : 3.2}
                    fill="hsl(221 100% 70%)"
                    style={{
                      filter: "drop-shadow(0 0 4px hsl(221 100% 65% / 0.9))",
                      transition: "r 200ms",
                    }}
                  />
                </g>
              );
            })}

            {layout.map((n) => {
              const active = hovered === n.key;
              return (
                <circle
                  key={`d-${n.key}`}
                  r={active ? 5 : 3.5}
                  fill="url(#particle-glow)"
                  filter="url(#particle-blur)"
                >
                  <animateMotion
                    dur={`${active ? n.dur * 0.55 : n.dur}s`}
                    repeatCount="indefinite"
                    begin={`${n.delay}s`}
                    rotate="auto"
                  >
                    <mpath href={`#np-${n.key}`} />
                  </animateMotion>
                </circle>
              );
            })}
          </svg>

          {/* Icon nodes — positioned in the rotating layer, counter-rotated so they stay upright */}
          {layout.map((n) => {
            const active = hovered === n.key;
            const { Icon } = n;
            return (
              <motion.div
                key={n.key}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${n.leftPct}%`, top: `${n.topPct}%` }}
                animate={{ rotate: -360 }}
                transition={{ duration: 90, repeat: Infinity, ease: "linear" }}
              >
                <button
                  type="button"
                  onMouseEnter={() => setHovered(n.key)}
                  onMouseLeave={() => setHovered((prev) => (prev === n.key ? null : prev))}
                  onFocus={() => setHovered(n.key)}
                  onBlur={() => setHovered((prev) => (prev === n.key ? null : prev))}
                  className="flex flex-col items-center gap-1.5 focus:outline-none group"
                >
                  <motion.div
                    animate={{ scale: active ? 1.12 : 1 }}
                    transition={{ type: "spring", stiffness: 260, damping: 18 }}
                    className="grid place-items-center size-11 rounded-xl border border-border/70 bg-card/90 backdrop-blur text-primary shadow-md"
                    style={
                      active
                        ? { boxShadow: "0 0 0 3px hsl(221 83% 60% / 0.18), 0 12px 32px -10px hsl(221 83% 50% / 0.5)" }
                        : undefined
                    }
                  >
                    <Icon className="size-5" />
                  </motion.div>
                  <span
                    className="text-[11px] font-medium leading-none px-1.5 py-0.5 rounded whitespace-nowrap"
                    style={{
                      color: active ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
                      background: active ? "hsl(var(--primary) / 0.08)" : "transparent",
                    }}
                  >
                    {n.label}
                  </span>
                </button>
              </motion.div>
            );
          })}
        </motion.div>

        {/* Center — Legacyskool OS (outside rotating layer → always perfectly centered) */}
        <motion.div
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        >
          <div
            className="relative grid place-items-center size-32 sm:size-36 rounded-full border border-primary/40 backdrop-blur-xl"
            style={{
              background:
                "radial-gradient(circle at 30% 25%, hsl(0 0% 100% / 0.9), hsl(220 20% 98% / 0.7))",
              boxShadow:
                "0 0 0 6px hsl(221 83% 60% / 0.06), 0 20px 60px -20px hsl(221 83% 40% / 0.45), inset 0 1px 0 hsl(0 0% 100% / 0.7)",
            }}
          >
            <div className="absolute inset-0 rounded-full pointer-events-none"
              style={{ boxShadow: "0 0 40px hsl(221 83% 60% / 0.35)" }} />
            <div className="flex flex-col items-center gap-1.5 text-center px-3">
              <div className="grid place-items-center size-10 rounded-xl bg-primary text-primary-foreground shadow-md">
                <GraduationCap className="size-5" />
              </div>
              <div className="font-display font-bold text-[13px] leading-tight tracking-tight text-foreground">
                LEGACYSKOOL
              </div>
              <div className="inline-flex items-center gap-1 text-[10px] font-semibold text-primary uppercase tracking-[0.15em]">
                <Sparkles className="size-2.5" /> OS
              </div>
            </div>
            <motion.div
              className="absolute inset-0 rounded-full border border-primary/50"
              animate={{ scale: [1, 1.25], opacity: [0.5, 0] }}
              transition={{ duration: 2.6, repeat: Infinity, ease: "easeOut" }}
            />
          </div>
        </motion.div>
      </div>

      {/* Mobile — vertical flow */}
      <div className="sm:hidden relative">
        <div className="flex flex-col items-center gap-2">
          <div className="grid place-items-center size-20 rounded-full border border-primary/40 bg-card/90 backdrop-blur shadow-lg">
            <div className="flex flex-col items-center">
              <GraduationCap className="size-6 text-primary" />
              <span className="text-[9px] font-bold tracking-widest text-foreground mt-0.5">LEGACYSKOOL</span>
            </div>
          </div>
          {NODES.map((n, i) => (
            <div key={n.key} className="flex flex-col items-center gap-1.5">
              <div className="relative h-6 w-px overflow-hidden bg-primary/20">
                <motion.div
                  className="absolute left-1/2 -translate-x-1/2 size-1.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary))]"
                  animate={{ top: ["-8px", "24px"] }}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "linear", delay: (i * 0.15) % 1.6 }}
                />
              </div>
              <div className="flex items-center gap-2 rounded-lg border border-border/70 bg-card/90 backdrop-blur px-3 py-1.5 shadow-sm">
                <n.Icon className="size-4 text-primary" />
                <span className="text-xs font-medium">{n.label}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}