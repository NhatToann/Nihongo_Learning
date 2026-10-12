"use client";

import { motion } from "framer-motion";
import { useState } from "react";
import type { StudyMode } from "@/lib/types";
import { ScreenHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

// ═══════════════════════════════════════════════════════════════
//  Tab Ôn tập — xáo toàn bộ dữ liệu, giới hạn số câu
// ═══════════════════════════════════════════════════════════════

interface ReviewTabProps {
  vocabCount: number;
  kanjiCount: number;
  onStart: (mode: StudyMode, count: number) => void;
}

const LIMIT_OPTIONS = [
  { value: 10, label: "10 câu" },
  { value: 20, label: "20 câu" },
  { value: 50, label: "50 câu" },
  { value: 100, label: "100 câu" },
  { value: 0, label: "Tất cả" },
];

export function ReviewTab({ vocabCount, kanjiCount, onStart }: ReviewTabProps) {
  const [vocabLimit, setVocabLimit] = useState(20);
  const [kanjiLimit, setKanjiLimit] = useState(10);

  return (
    <div>
      <ScreenHeader
        title="Ôn tập tổng hợp"
        subtitle="Xáo toàn bộ dữ liệu thành bộ trắc nghiệm"
      />

      <div className="mt-5 space-y-4">
        <ReviewCard
          accent="#4FF0C6"
          title="Ôn tập từ vựng"
          count={vocabCount}
          noun="từ"
          limit={vocabLimit}
          onLimitChange={setVocabLimit}
          onStart={() => onStart("review", vocabLimit || vocabCount)}
          icon={<Icon name="book" className="size-5" />}
        />

        <ReviewCard
          accent="#00DAF3"
          title="Ôn tập kanji"
          count={kanjiCount}
          noun="kanji"
          limit={kanjiLimit}
          onLimitChange={setKanjiLimit}
          onStart={() => onStart("kanji-review", kanjiLimit || kanjiCount)}
          icon={<Icon name="kanji" className="size-5 jp" />}
        />
      </div>

      <div className="clay mt-5 px-4 py-4" style={{ background: "white" }}>
        <div className="mb-2 flex items-center gap-2">
          <span
            className="flex size-7 items-center justify-center rounded-full"
            style={{
              backgroundImage: "linear-gradient(135deg, #F8F971, #C1FA87)",
            }}
          >
            <Icon name="sparkles" className="size-3.5 text-ink" />
          </span>
          <p className="text-[0.84rem] font-extrabold text-ink">
            Mẹo ôn tập
          </p>
        </div>
        <ul className="space-y-1.5 text-[0.78rem] leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span className="text-cyan">•</span>
            <span>Trộn đều cả 2 chiều: Nhật → Việt và Việt → Nhật</span>
          </li>
          <li className="flex gap-2">
            <span className="text-mint">•</span>
            <span>Câu trả lời đúng liên tiếp tạo combo, nhân điểm diamond</span>
          </li>
          <li className="flex gap-2">
            <span className="text-sun">•</span>
            <span>Đạt 80% để mở vòng quay thưởng hôm nay</span>
          </li>
        </ul>
      </div>
    </div>
  );
}

// ── Thẻ ôn tập ───────────────────────────────────────────────────

function ReviewCard({
  accent,
  title,
  count,
  noun,
  limit,
  onLimitChange,
  onStart,
  icon,
}: {
  accent: string;
  title: string;
  count: number;
  noun: string;
  limit: number;
  onLimitChange: (v: number) => void;
  onStart: () => void;
  icon: React.ReactNode;
}) {
  const disabled = count === 0;
  const actual = limit === 0 ? count : Math.min(limit, count);

  return (
    <div
      className="clay relative overflow-hidden p-4"
      style={{
        background: `linear-gradient(135deg, ${accent}1A 0%, white 65%)`,
      }}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-30"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl text-ink"
            style={{
              backgroundImage: `linear-gradient(135deg, ${accent}, ${accent}88)`,
              boxShadow: `0 8px 22px -8px ${accent}`,
            }}
          >
            {icon}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[1rem] font-extrabold text-ink">{title}</p>
            <p className="mt-0.5 text-[0.78rem] font-semibold text-ink-soft">
              {disabled
                ? "Chưa có dữ liệu"
                : `${count} ${noun} trong thư viện`}
            </p>
          </div>
        </div>
        <span
          className="clay shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-black tabular-nums text-ink"
          style={{ background: "white" }}
        >
          {actual} câu
        </span>
      </div>

      <div className="relative mt-4">
        <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
          Số câu hỏi
        </p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {LIMIT_OPTIONS.map((opt) => {
            const tooMany = opt.value !== 0 && opt.value > count;
            return (
              <button
                key={opt.value}
                disabled={disabled || tooMany}
                onClick={() => onLimitChange(opt.value)}
                className="chip"
                data-active={limit === opt.value}
                style={tooMany ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      <motion.button
        whileTap={disabled ? undefined : { scale: 0.98 }}
        onClick={onStart}
        disabled={disabled}
        className="btn btn-primary relative mt-4 w-full py-3.5 text-[0.9rem] disabled:opacity-45"
      >
        {disabled ? (
          "Chưa có dữ liệu"
        ) : (
          <>
            <Icon name="play" className="size-4" filled />
            <span>Bắt đầu ôn tập {actual} câu</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
