"use client";

import { motion } from "framer-motion";
import type { Tab } from "@/lib/types";
import { Icon, type IconName } from "@/components/icons";

// ═══════════════════════════════════════════════════════════════
//  Thanh điều hướng dưới — floating clay dock
// ═══════════════════════════════════════════════════════════════

const ITEMS: Array<{ id: Tab; label: string; icon: IconName }> = [
  { id: "home", label: "Trang chính", icon: "home" },
  { id: "learn", label: "Học từ", icon: "edit" },
  { id: "review", label: "Ôn tập", icon: "review" },
  { id: "kanji", label: "Kanji", icon: "kanji" },
  { id: "stats", label: "Thống kê", icon: "stats" },
];

interface BottomNavProps {
  tab: Tab;
  onChange: (t: Tab) => void;
}

export function BottomNav({ tab, onChange }: BottomNavProps) {
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 px-3 pb-3"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div
        className="clay mx-auto flex max-w-[520px] items-stretch justify-around px-1.5 py-1.5"
        style={{
          background: "rgba(255, 255, 255, 0.92)",
          backdropFilter: "blur(20px)",
        }}
      >
        {ITEMS.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onChange(item.id)}
              className="relative flex flex-1 flex-col items-center gap-0.5 rounded-2xl px-1 py-2 transition-colors"
              aria-current={active ? "page" : undefined}
            >
              {active && (
                <motion.span
                  layoutId="nav-indicator"
                  className="absolute inset-0 rounded-2xl"
                  style={{
                    backgroundImage:
                      "linear-gradient(135deg, rgba(79,240,198,0.18), rgba(0,218,243,0.18))",
                    boxShadow: "inset 0 0 0 1.5px rgba(79,240,198,0.55)",
                  }}
                  transition={{ type: "spring", stiffness: 380, damping: 30 }}
                />
              )}
              <span
                className={`relative z-10 transition-transform ${
                  active ? "scale-110" : "opacity-50"
                }`}
                style={{ color: active ? "#0B1220" : "#8A97AD" }}
              >
                <Icon name={item.icon} className="size-5" filled={active} />
              </span>
              <span
                className={`relative z-10 text-[0.66rem] font-extrabold tracking-tight transition-colors ${
                  active ? "text-ink" : "text-ink-faint"
                }`}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
