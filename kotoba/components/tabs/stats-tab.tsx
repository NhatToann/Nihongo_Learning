"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import { daysAgoVN, todayVN } from "@/lib/supabase/client";
import { luckLabel } from "@/lib/gacha";
import type { GachaTier } from "@/lib/types";
import { ScreenHeader, StatTile, formatNumber } from "@/components/ui";
import { Icon } from "@/components/icons";
import { SettingsTab } from "./settings-tab";

// ═══════════════════════════════════════════════════════════════
//  Tab Thống kê — tiến độ, chuỗi, lịch học
// ═══════════════════════════════════════════════════════════════

interface StatsTabProps {
  diamonds: number;
  streak: number;
  calendar: Record<string, number>;
  vocabCount: number;
  kanjiCount: number;
  tiers: GachaTier[];
}

export function StatsTab({
  diamonds,
  streak,
  calendar,
  vocabCount,
  kanjiCount,
  tiers,
}: StatsTabProps) {
  const [showSettings, setShowSettings] = useState(false);

  if (showSettings) {
    return (
      <div>
        <button
          onClick={() => setShowSettings(false)}
          className="clay-interactive mb-4 flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.78rem] font-extrabold"
          style={{ background: "white" }}
        >
          <Icon name="arrowRight" className="size-3.5 rotate-180" />
          <span>Quay lại</span>
        </button>
        <SettingsTab tiers={tiers} />
      </div>
    );
  }

  const days = Array.from({ length: 28 }).map((_, i) => daysAgoVN(27 - i));
  const activeDays = days.filter((d) => (calendar[d] ?? 0) > 0).length;
  const today = todayVN();

  let running = 0;
  let best = 0;
  for (let i = days.length - 1; i >= 0; i--) {
    if ((calendar[days[i]] ?? 0) > 0) {
      running++;
      best = Math.max(best, running);
    } else {
      running = 0;
    }
  }

  return (
    <div>
      <ScreenHeader
        title="Thống kê"
        subtitle="Tiến độ học của bạn"
        action={
          <button
            onClick={() => setShowSettings(true)}
            className="clay-interactive flex size-10 items-center justify-center rounded-full"
            style={{ background: "white" }}
            aria-label="Cài đặt"
          >
            <Icon name="settings" className="size-5 text-ink" />
          </button>
        }
      />

      {/* ── Ô chính ── */}
      <div className="mt-2 grid grid-cols-2 gap-2.5">
        <StatTile
          label="Diamond"
          value={formatNumber(diamonds)}
          accent="#4FF0C6"
          icon={<Icon name="diamond" className="size-3.5" filled />}
        />
        <StatTile
          label="Chuỗi hiện tại"
          value={`${streak} ngày`}
          hint={streak > 0 ? luckLabel(streak) : undefined}
          accent="#00DAF3"
          icon={<Icon name="flame" className="size-3.5" filled />}
        />
        <StatTile
          label="Từ vựng"
          value={vocabCount}
          accent="#C1FA87"
          icon={<Icon name="book" className="size-3.5" />}
        />
        <StatTile
          label="Kanji"
          value={kanjiCount}
          accent="#7C6CFF"
          icon={<Icon name="kanji" className="size-3.5 jp" />}
        />
      </div>

      {/* ── Lịch 28 ngày ── */}
      <section className="clay mt-5 overflow-hidden p-4" style={{ background: "white" }}>
        <div className="flex items-center justify-between">
          <p className="text-[0.85rem] font-extrabold">Lịch học 4 tuần</p>
          <div className="flex gap-3 text-[0.66rem] font-bold text-ink-faint">
            <span className="flex items-center gap-1">
              <span className="size-2.5 rounded-sm bg-cloud" />
              Nghỉ
            </span>
            <span className="flex items-center gap-1">
              <span
                className="size-2.5 rounded-sm"
                style={{ backgroundImage: "linear-gradient(135deg,#4FF0C6,#00DAF3)" }}
              />
              Có học
            </span>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-1.5">
          {days.map((d) => {
            const active = (calendar[d] ?? 0) > 0;
            const isToday = d === today;
            return (
              <motion.div
                key={d}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                title={`${d}${active ? ` · ${calendar[d]} câu` : " · nghỉ"}`}
                className="aspect-square rounded-md"
                style={{
                  background: active
                    ? "linear-gradient(135deg, #4FF0C6, #00DAF3)"
                    : "#EDF2F3",
                  boxShadow: isToday
                    ? "0 0 0 2px #0B1220, 0 4px 10px -4px rgba(11,18,32,.3)"
                    : active
                      ? "0 4px 10px -4px rgba(79,240,198,.5)"
                      : "inset 0 1px 2px rgba(11,18,32,.05)",
                }}
              />
            );
          })}
        </div>

        <div className="mt-4 flex items-center justify-between text-[0.78rem] font-bold text-ink-soft">
          <span>
            {activeDays} ngày có học
          </span>
          <span>Chuỗi tốt nhất: {best} ngày</span>
        </div>
      </section>

      {/* ── Cách chơi ── */}
      <section className="clay mt-4 p-4" style={{ background: "white" }}>
        <p className="text-[0.85rem] font-extrabold">Cách chơi</p>
        <ul className="mt-3 space-y-2.5 text-[0.78rem] leading-relaxed text-ink-soft">
          <li className="flex gap-2.5">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-black text-ink"
              style={{ backgroundImage: "linear-gradient(135deg, #00DAF3, #4FF0C6)" }}
            >
              1
            </span>
            <span>
              <b className="text-ink">Combo:</b> trả lời đúng liên tiếp để nhân
              điểm (tối đa ×3).
            </span>
          </li>
          <li className="flex gap-2.5">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-black text-ink"
              style={{ backgroundImage: "linear-gradient(135deg, #4FF0C6, #C1FA87)" }}
            >
              2
            </span>
            <span>
              <b className="text-ink">Vòng quay thưởng:</b> hoàn thành bài với
              ≥80% chính xác, mỗi mode 1 lần/ngày.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-black text-ink"
              style={{ backgroundImage: "linear-gradient(135deg, #F8F971, #C1FA87)" }}
            >
              3
            </span>
            <span>
              <b className="text-ink">Vòng phạt:</b> bỏ học 1 ngày sẽ bị trừ
              diamond khi quay, cũng 1 lần/ngày.
            </span>
          </li>
          <li className="flex gap-2.5">
            <span
              className="flex size-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-black text-ink"
              style={{ backgroundImage: "linear-gradient(135deg, #C1FA87, #4FF0C6)" }}
            >
              4
            </span>
            <span>
              <b className="text-ink">Chuỗi ngày:</b> học liên tiếp mỗi ngày để
              giữ streak cao.
            </span>
          </li>
        </ul>
      </section>
    </div>
  );
}
