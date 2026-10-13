import React, { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Brain, GripVertical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface MovableCopilotProps {
  to: string;
  title: string;
  role: string;
}

const STORAGE_KEY = "legacyskool_copilot_pos_v1";
const PADDING = 16;

export function MovableCopilot({ to, title, role }: MovableCopilotProps) {
  const navigate = useNavigate();
  const buttonRef = useRef<HTMLDivElement | null>(null);

  // Position coordinates: { x, y } in px from viewport top-left
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const isPointerDownRef = useRef(false);
  const startPointerRef = useRef({ x: 0, y: 0 });
  const startPosRef = useRef({ x: 0, y: 0 });
  const hasMovedRef = useRef(false);

  // Load saved position or calculate default on mount
  useEffect(() => {
    const updateDefault = () => {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          if (typeof parsed.x === "number" && typeof parsed.y === "number") {
            const btnWidth = buttonRef.current?.offsetWidth || 90;
            const btnHeight = buttonRef.current?.offsetHeight || 38;
            const maxX = Math.max(PADDING, window.innerWidth - btnWidth - PADDING);
            const maxY = Math.max(PADDING, window.innerHeight - btnHeight - PADDING);
            setPosition({
              x: Math.min(Math.max(PADDING, parsed.x), maxX),
              y: Math.min(Math.max(PADDING, parsed.y), maxY),
            });
            return;
          }
        } catch {
          // ignore corrupted data
        }
      }

      // Default bottom-right position
      const btnWidth = buttonRef.current?.offsetWidth || 90;
      const btnHeight = buttonRef.current?.offsetHeight || 38;
      setPosition({
        x: Math.max(PADDING, window.innerWidth - btnWidth - 20),
        y: Math.max(PADDING, window.innerHeight - btnHeight - 20),
      });
    };

    updateDefault();

    const handleResize = () => {
      setPosition((prev) => {
        if (!prev) return null;
        const btnWidth = buttonRef.current?.offsetWidth || 90;
        const btnHeight = buttonRef.current?.offsetHeight || 38;
        const maxX = Math.max(PADDING, window.innerWidth - btnWidth - PADDING);
        const maxY = Math.max(PADDING, window.innerHeight - btnHeight - PADDING);
        return {
          x: Math.min(Math.max(PADDING, prev.x), maxX),
          y: Math.min(Math.max(PADDING, prev.y), maxY),
        };
      });
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    // Only primary button
    if (e.button !== 0) return;

    const el = buttonRef.current;
    if (!el) return;

    el.setPointerCapture(e.pointerId);
    isPointerDownRef.current = true;
    hasMovedRef.current = false;
    startPointerRef.current = { x: e.clientX, y: e.clientY };

    const rect = el.getBoundingClientRect();
    startPosRef.current = { x: rect.left, y: rect.top };
  }, []);

  const onPointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;

    const deltaX = e.clientX - startPointerRef.current.x;
    const deltaY = e.clientY - startPointerRef.current.y;

    if (!hasMovedRef.current && Math.hypot(deltaX, deltaY) > 5) {
      hasMovedRef.current = true;
      setIsDragging(true);
    }

    if (hasMovedRef.current) {
      const el = buttonRef.current;
      const btnWidth = el?.offsetWidth || 80;
      const btnHeight = el?.offsetHeight || 36;

      const rawX = startPosRef.current.x + deltaX;
      const rawY = startPosRef.current.y + deltaY;

      const clampedX = Math.min(Math.max(PADDING, rawX), window.innerWidth - btnWidth - PADDING);
      const clampedY = Math.min(Math.max(PADDING, rawY), window.innerHeight - btnHeight - PADDING);

      setPosition({ x: clampedX, y: clampedY });
    }
  }, []);

  const onPointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (!isPointerDownRef.current) return;
    isPointerDownRef.current = false;

    try {
      buttonRef.current?.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    if (hasMovedRef.current) {
      setIsDragging(false);
      // Persist new position
      if (position) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(position));
      }
    } else {
      // Normal click: navigate to copilot
      navigate(to);
    }
  }, [navigate, to, position]);

  const onPointerCancel = useCallback(() => {
    isPointerDownRef.current = false;
    setIsDragging(false);
  }, []);

  return (
    <div
      ref={buttonRef}
      role="button"
      tabIndex={0}
      title={`${title} (Drag to reposition)`}
      aria-label={title}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigate(to);
        }
      }}
      style={
        position
          ? {
              left: `${position.x}px`,
              top: `${position.y}px`,
              right: "auto",
              bottom: "auto",
            }
          : undefined
      }
      className={cn(
        "fixed z-50 select-none touch-none",
        "flex items-center gap-1.5 rounded-full px-2 py-1.5 sm:px-2.5 sm:py-1.5",
        "bg-primary text-primary-foreground shadow-lg ring-1 ring-white/20 backdrop-blur-sm",
        "transition-shadow duration-150",
        isDragging
          ? "cursor-grabbing scale-105 shadow-xl opacity-95 ring-2 ring-primary"
          : "cursor-grab hover:scale-102 hover:shadow-xl hover:opacity-95 active:scale-95",
        !position && "bottom-5 right-5" // Fallback before mount
      )}
    >
      {/* Subtle grip handle */}
      <span
        className="text-primary-foreground/50 hover:text-primary-foreground transition-colors p-0.5 rounded"
        title="Drag to reposition"
      >
        <GripVertical className="size-3 opacity-60" />
      </span>

      {/* Compact Copilot Brain Icon */}
      <div className="relative flex items-center justify-center">
        <Brain className="size-4 shrink-0 text-primary-foreground" />
        <Sparkles className="size-2 absolute -top-1 -right-1 text-amber-300" />
      </div>

      <span className="hidden sm:inline text-xs font-semibold tracking-tight whitespace-nowrap">
        Copilot
      </span>
    </div>
  );
}
