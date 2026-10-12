"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";

// ═══════════════════════════════════════════════════════════════
//  Header dùng chung cho mọi màn hình
// ═══════════════════════════════════════════════════════════════

export function ScreenHeader({
  title,
  subtitle,
  action,
}: {
  title: ReactNode;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <header className="relative -mx-4 mb-5 bg-gradient-to-b from-white/95 via-white/80 to-transparent px-4 pb-4 pt-1 backdrop-blur-xl">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-[1.65rem] font-extrabold leading-tight tracking-tight">
            {title}
          </h1>
          {subtitle ? (
            <p className="mt-1 truncate text-[0.84rem] font-medium text-ink-soft">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
    </header>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Ô thống kê nhỏ — clay pill
// ═══════════════════════════════════════════════════════════════

export function StatTile({
  label,
  value,
  hint,
  accent = "#00DAF3",
  icon,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: string;
  icon?: ReactNode;
}) {
  return (
    <div
      className="clay relative overflow-hidden px-4 py-3.5"
      style={{
        background: `linear-gradient(135deg, ${accent}1A 0%, white 70%)`,
      }}
    >
      {/* Decorative top strip */}
      <div
        className="absolute inset-x-3 top-0 h-1 rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}44)` }}
      />

      <div className="flex items-center justify-between gap-2">
        <p className="text-[0.66rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
          {label}
        </p>
        {icon ? (
          <span
            className="flex size-7 items-center justify-center rounded-full"
            style={{ background: `${accent}33`, color: "#0B1220" }}
          >
            {icon}
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 text-[1.55rem] font-black leading-none tabular-nums">
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-[0.72rem] font-semibold text-ink-soft">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Trạng thái rỗng
// ═══════════════════════════════════════════════════════════════

export function EmptyState({
  icon,
  title,
  hint,
  action,
}: {
  icon?: ReactNode;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="clay flex flex-col items-center px-6 py-12 text-center"
    >
      {icon ? <div className="mb-4 text-5xl">{icon}</div> : null}
      <p className="text-[1.05rem] font-extrabold">{title}</p>
      {hint ? (
        <p className="mt-2 max-w-[36ch] text-[0.85rem] leading-relaxed text-ink-soft">
          {hint}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Thanh tiến trình
// ═══════════════════════════════════════════════════════════════

export function ProgressBar({
  value,
  max,
  accent = "#00DAF3",
  height = 10,
}: {
  value: number;
  max: number;
  accent?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      className="relative w-full overflow-hidden rounded-full bg-mist"
      style={{
        height,
        boxShadow: "inset 0 1px 2px rgba(11,18,32,.08)",
      }}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
    >
      <motion.div
        className="h-full rounded-full"
        style={{
          backgroundImage: `linear-gradient(90deg, ${accent}, #4FF0C6)`,
          boxShadow: `0 0 12px ${accent}80`,
        }}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ type: "spring", stiffness: 180, damping: 24 }}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Lỗi
// ═══════════════════════════════════════════════════════════════

export function ErrorNote({ message }: { message: string }) {
  return (
    <div className="clay px-4 py-3 text-[0.85rem] font-semibold text-red-700">
      <span className="mr-2">⚠️</span>
      {message}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Toast nhỏ (tự ẩn)
// ═══════════════════════════════════════════════════════════════

export function Toast({
  message,
  tone = "ok",
}: {
  message: string;
  tone?: "ok" | "warn" | "bad";
}) {
  const colors = {
    ok: "from-mint to-lime text-ink",
    warn: "from-sun to-lime text-ink",
    bad: "from-red-400 to-red-500 text-white",
  } as const;

  return (
    <motion.div
      initial={{ opacity: 0, y: 24, scale: 0.94 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -12, scale: 0.96 }}
      transition={{ type: "spring", stiffness: 320, damping: 24 }}
      className={`pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto w-fit max-w-[90%] rounded-full bg-gradient-to-r px-5 py-2.5 text-[0.85rem] font-bold shadow-lift ${colors[tone]}`}
    >
      {message}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Formatter
// ═══════════════════════════════════════════════════════════════

export function formatNumber(n: number): string {
  return new Intl.NumberFormat("vi-VN").format(n);
}

/** Rút gọn số lớn: 1.2K, 3.4M */
export function formatCompact(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}
