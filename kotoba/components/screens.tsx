"use client";

import { motion } from "framer-motion";
import { formatNumber } from "./ui";
import { Icon } from "./icons";

// ═══════════════════════════════════════════════════════════════
//  Màn hình loading
// ═══════════════════════════════════════════════════════════════

export function LoadingScreen() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1.1, ease: "linear" }}
        className="relative size-16"
      >
        <div className="absolute inset-0 rounded-full border-[3px] border-cloud" />
        <div
          className="absolute inset-0 rounded-full border-[3px] border-transparent"
          style={{
            borderTopColor: "#00DAF3",
            borderRightColor: "#4FF0C6",
            filter: "drop-shadow(0 0 6px rgba(79,240,198,.5))",
          }}
        />
      </motion.div>
      <p className="mt-5 text-[0.85rem] font-extrabold text-ink-soft">
        Đang tải dữ liệu...
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Màn hình hướng dẫn setup Supabase
// ═══════════════════════════════════════════════════════════════

export function SetupScreen() {
  return (
    <div className="flex min-h-dvh flex-col justify-center py-6">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay relative overflow-hidden p-6"
        style={{ background: "white" }}
      >
        <div
          className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #4FF0C6, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -left-10 -bottom-10 size-32 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #F8F971, transparent 70%)" }}
        />

        <div className="relative">
          <p className="jp text-[2.2rem] font-black leading-none text-ink">言葉</p>
          <p className="text-rainbow mt-1 text-[1.15rem] font-black tracking-tight">
            Kotoba
          </p>

          <div className="mt-5 space-y-3 text-[0.85rem] leading-relaxed text-ink-soft">
            <p className="font-extrabold text-ink">
              Cần cấu hình Supabase trước
            </p>

            <ol className="space-y-3">
              <Step n={1}>
                Tạo project tại{" "}
                <a
                  href="https://supabase.com/dashboard"
                  target="_blank"
                  rel="noreferrer"
                  className="font-extrabold text-cyan underline underline-offset-2"
                >
                  supabase.com/dashboard
                </a>
              </Step>
              <Step n={2}>
                Mở <b>SQL Editor</b>, dán nội dung file{" "}
                <code className="rounded-md bg-cloud px-1.5 py-0.5 text-[0.78rem] font-extrabold text-ink">
                  supabase/schema.sql
                </code>{" "}
                rồi bấm <b>Run</b>.
              </Step>
              <Step n={3}>
                Vào <b>Project Settings → API</b>, copy <b>Project URL</b> và{" "}
                <b>anon public key</b>.
              </Step>
              <Step n={4}>
                Tạo file{" "}
                <code className="rounded-md bg-cloud px-1.5 py-0.5 text-[0.78rem] font-extrabold text-ink">
                  .env.local
                </code>{" "}
                ở thư mục gốc và điền 2 biến sau:
                <code
                  className="mt-2 block rounded-lg px-3 py-2.5 text-[0.7rem] leading-relaxed"
                  style={{
                    background: "linear-gradient(135deg, #0F172A, #1E293B)",
                    color: "#4FF0C6",
                    fontFamily: "ui-monospace, monospace",
                  }}
                >
                  NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
                  <br />
                  NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
                </code>
              </Step>
              <Step n={5}>
                Khởi động lại bằng{" "}
                <code className="rounded-md bg-cloud px-1.5 py-0.5 text-[0.78rem] font-extrabold text-ink">
                  npm run dev
                </code>
                .
              </Step>
            </ol>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span
        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full text-[0.74rem] font-black text-ink"
        style={{
          backgroundImage: "linear-gradient(135deg, #4FF0C6, #C1FA87 60%, #F8F971)",
          boxShadow: "0 4px 10px -4px rgba(79,240,198,.55)",
        }}
        aria-hidden
      >
        {n}
      </span>
      <span className="min-w-0">{children}</span>
    </li>
  );
}

/** Số diamond dạng ngắn gọn cho header */
export function DiamondBadge({ value }: { value: number }) {
  return (
    <span
      className="clay inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[0.78rem] font-black tabular-nums"
      style={{ background: "white" }}
    >
      <Icon name="diamond" className="size-3.5 text-cyan" filled />
      {formatNumber(value)}
    </span>
  );
}
