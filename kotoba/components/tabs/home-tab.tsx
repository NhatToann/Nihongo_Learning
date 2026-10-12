"use client";

import { motion } from "framer-motion";
import type { StudyMode } from "@/lib/types";
import { luckLabel } from "@/lib/gacha";
import { ScreenHeader, StatTile, formatNumber } from "@/components/ui";
import { Icon } from "@/components/icons";

// ═══════════════════════════════════════════════════════════════
//  Trang chính — tổng quan + nút bắt đầu
//  Phong cách: Claymorphism + neon outline
// ═══════════════════════════════════════════════════════════════

interface HomeTabProps {
  diamonds: number;
  streak: number;
  vocabCount: number;
  kanjiCount: number;
  todayVocab: number;
  todayKanji: number;
  completed: Set<string>;
  missedDays: number;
  onStart: (mode: StudyMode) => void;
  onRogue: (mode: "vocab" | "kanji") => void;
  onOpenSettings: () => void;
}

export function HomeTab({
  diamonds,
  streak,
  vocabCount,
  kanjiCount,
  todayVocab,
  todayKanji,
  completed,
  missedDays,
  onStart,
  onRogue,
  onOpenSettings,
}: HomeTabProps) {
  const vocabDone = completed.has("daily");
  const reviewDone = completed.has("review");
  const kanjiDone = completed.has("kanji-daily");
  const allDone = vocabDone && reviewDone && kanjiDone;

  return (
    <div>
      <ScreenHeader
        title={
          <span className="flex items-center gap-2">
            <span className="jp text-[1.7rem] font-black leading-none">
              言葉
            </span>
            <span className="text-[1.4rem] font-black tracking-tight">
              Kotoba
            </span>
          </span>
        }
        subtitle={
          allDone
            ? "Hôm nay đã hoàn thành — nghỉ ngơi nhé!"
            : "Cùng học tiếng Nhật nào!"
        }
        action={
          <button
            onClick={onOpenSettings}
            className="clay-interactive flex size-10 items-center justify-center rounded-full"
            aria-label="Cài đặt"
            style={{ background: "white" }}
          >
            <Icon name="settings" className="size-5 text-ink" />
          </button>
        }
      />

      {/* ── Hero: chuỗi + diamond ── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="clay relative mt-5 overflow-hidden px-5 py-6"
      >
        {/* Decorative top strip */}
        <div className="rainbow-line absolute inset-x-0 top-0 h-1.5" />

        {/* Floating background shapes */}
        <div
          className="pointer-events-none absolute -right-8 -top-8 size-32 rounded-full opacity-30"
          style={{ background: "radial-gradient(circle, #C1FA87, transparent 70%)" }}
        />
        <div
          className="pointer-events-none absolute -bottom-10 -left-6 size-28 rounded-full opacity-25"
          style={{ background: "radial-gradient(circle, #00DAF3, transparent 70%)" }}
        />

        <div className="relative flex items-start justify-between gap-4">
          <div>
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
              Chuỗi học liên tiếp
            </p>
            <p className="mt-1.5 flex items-baseline gap-2">
              <span className="text-rainbow text-[3.2rem] font-black leading-none tabular-nums">
                {streak}
              </span>
              <span className="text-[0.95rem] font-bold text-ink-soft">
                ngày
              </span>
            </p>
            {streak > 0 && (
              <p className="mt-1.5 inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-cyan/20 to-mint/20 px-2.5 py-0.5 text-[0.74rem] font-extrabold text-ink">
                {streak >= 1 ? "🔥" : ""} {luckLabel(streak)}
              </p>
            )}
          </div>

          <div className="text-right">
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
              Diamond
            </p>
            <p className="mt-1.5 flex items-baseline justify-end gap-1.5">
              <Icon name="diamond" className="size-5 text-cyan" />
              <span className="text-[1.85rem] font-black leading-none tabular-nums">
                {formatNumber(diamonds)}
              </span>
            </p>
          </div>
        </div>

        {/* Thanh 7 ngày */}
        <div className="relative mt-5 flex items-end justify-between gap-1.5">
          {Array.from({ length: 7 }).map((_, i) => {
            const idx = 6 - i;
            const active = idx < Math.min(streak, 7);
            return (
              <div
                key={i}
                className="flex flex-1 flex-col items-center gap-1.5"
              >
                <div
                  className="h-10 w-full rounded-md transition-all"
                  style={{
                    background: active
                      ? "linear-gradient(180deg, #4FF0C6, #00DAF3)"
                      : "rgba(216, 230, 231, 0.5)",
                    boxShadow: active
                      ? "0 4px 12px -2px rgba(79,240,198,.6), inset 0 1px 0 rgba(255,255,255,.5)"
                      : "inset 0 1px 2px rgba(11,18,32,.05)",
                  }}
                />
                <span className="text-[0.62rem] font-bold text-ink-faint">
                  {["T2", "T3", "T4", "T5", "T6", "T7", "CN"][i]}
                </span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* ── Cảnh báo bỏ ngày ── */}
      {missedDays > 0 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="clay mt-3 flex items-start gap-3 px-4 py-3"
          style={{ borderColor: "rgba(255, 99, 99, 0.4)" }}
        >
          <span
            className="flex size-9 shrink-0 items-center justify-center rounded-full"
            style={{ background: "linear-gradient(135deg, #FF6B6B, #FF8E8E)" }}
          >
            <Icon name="alert" className="size-5 text-white" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[0.85rem] font-extrabold text-red-700">
              Bạn bỏ học {missedDays} ngày
            </p>
            <p className="mt-0.5 text-[0.74rem] leading-relaxed text-red-600">
              Làm bài hôm nay và quay vòng phạt để xoá nợ. Quay vòng phạt sẽ bị
              trừ diamond.
            </p>
          </div>
        </motion.div>
      )}

      {/* ── Thống kê ── */}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        <StatTile
          label="Từ vựng"
          value={vocabCount}
          hint={`${todayVocab} mới hôm nay`}
          accent="#4FF0C6"
          icon={<Icon name="book" className="size-5" />}
        />
        <StatTile
          label="Kanji"
          value={kanjiCount}
          hint={`${todayKanji} mới hôm nay`}
          accent="#00DAF3"
          icon={<Icon name="kanji" className="size-5 jp" />}
        />
      </div>

      {/* ── Nút học ── */}
      <div className="mt-5 space-y-3">
        <ActionCard
          accent="#4FF0C6"
          title="Học từ mới hôm nay"
          subtitle={
            todayVocab === 0
              ? "Chưa có từ nào hôm nay — thêm ở tab Học"
              : `${todayVocab} từ mới đang chờ`
          }
          badge={
            vocabDone
              ? "✓ Đã xong"
              : todayVocab > 0
                ? "Sẵn sàng"
                : undefined
          }
          done={vocabDone}
          disabled={todayVocab === 0}
          icon={<Icon name="sparkles" className="size-6" />}
          onClick={() => onStart("daily")}
        />

        <ActionCard
          accent="#C1FA87"
          title="Ôn tập tổng hợp"
          subtitle={
            vocabCount === 0
              ? "Chưa có dữ liệu"
              : `Toàn bộ ${vocabCount} từ · tự chọn số câu`
          }
          badge={reviewDone ? "✓ Đã xong" : undefined}
          done={reviewDone}
          disabled={vocabCount === 0}
          icon={<Icon name="shuffle" className="size-6" />}
          onClick={() => onStart("review")}
        />

        <ActionCard
          accent="#00DAF3"
          title="Học kanji hôm nay"
          subtitle={
            todayKanji === 0
              ? "Chưa có kanji nào hôm nay — thêm ở tab Học"
              : `${todayKanji} kanji mới đang chờ`
          }
          badge={
            kanjiDone
              ? "✓ Đã xong"
              : todayKanji > 0
                ? "Sẵn sàng"
                : undefined
          }
          done={kanjiDone}
          disabled={todayKanji === 0}
          icon={<Icon name="kanji" className="size-6 jp" />}
          onClick={() => onStart("kanji-daily")}
        />
      </div>

      {/* ── Gợi ý ── */}
      {!allDone && (todayVocab > 0 || todayKanji > 0) && (
        <p className="mt-5 text-center text-[0.76rem] font-semibold text-ink-soft">
          Hoàn thành bài với ≥80% chính xác để mở vòng quay thưởng
          <Icon name="diamond" className="mx-1 inline size-3.5 text-cyan" />
        </p>
      )}

      {/* ── Chế độ nâng cao ── */}
      <section className="mt-7">
        <div className="mb-3 flex items-center gap-2">
          <span className="h-px flex-1 bg-line" />
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Chế độ nâng cao
          </p>
          <span className="h-px flex-1 bg-line" />
        </div>

        <div className="space-y-3">
          <RogueCard
            title="Lục địa từ vựng"
            subtitle={
              vocabCount < 5
                ? "Cần ít nhất 5 từ để bắt đầu"
                : `Chinh phục 8 tầng với ${vocabCount} từ`
            }
            accent="#7C6CFF"
            disabled={vocabCount < 5}
            onClick={() => onRogue("vocab")}
          />
          <RogueCard
            title="Lục địa kanji"
            subtitle={
              kanjiCount < 5
                ? "Cần ít nhất 5 kanji để bắt đầu"
                : `Chinh phục 8 tầng với ${kanjiCount} kanji`
            }
            accent="#FF4D9D"
            disabled={kanjiCount < 5}
            onClick={() => onRogue("kanji")}
          />
        </div>
      </section>
    </div>
  );
}

// ── Thẻ rogue ──────────────────────────────────────────────────

function RogueCard({
  title,
  subtitle,
  accent,
  disabled,
  onClick,
}: {
  title: string;
  subtitle: string;
  accent: string;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="clay-interactive relative w-full overflow-hidden px-4 py-4 text-left disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: `linear-gradient(135deg, ${accent}15, white 65%)`,
      }}
    >
      {/* Decorative blob */}
      <div
        className="pointer-events-none absolute -right-6 -top-6 size-24 rounded-full opacity-40 blur-sm"
        style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)` }}
      />

      <div className="relative flex items-center gap-3.5">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-white"
          style={{
            backgroundImage: `linear-gradient(135deg, ${accent}, ${accent}AA)`,
            boxShadow: `0 8px 22px -8px ${accent}`,
          }}
        >
          <Icon name="map" className="size-6" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.96rem] font-extrabold text-ink">
            {title}
          </span>
          <span className="mt-0.5 block truncate text-[0.78rem] font-medium text-ink-soft">
            {subtitle}
          </span>
        </span>
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white shadow-sm">
          <Icon name="arrowRight" className="size-4 text-ink" />
        </span>
      </div>
    </motion.button>
  );
}

// ── Thẻ hành động ────────────────────────────────────────────────

function ActionCard({
  accent,
  title,
  subtitle,
  badge,
  done,
  disabled,
  icon,
  onClick,
}: {
  accent: string;
  title: string;
  subtitle: string;
  badge?: string;
  done: boolean;
  disabled: boolean;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <motion.button
      whileTap={disabled ? undefined : { scale: 0.98 }}
      onClick={onClick}
      disabled={disabled}
      className="clay-interactive relative w-full overflow-hidden px-4 py-4 text-left disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        background: `linear-gradient(135deg, ${done ? "#F0FDFA" : "white"}, ${accent}0A 100%)`,
      }}
    >
      {/* Decorative top strip */}
      <div
        className="absolute inset-x-3 top-0 h-1 rounded-full"
        style={{
          background: `linear-gradient(90deg, ${accent}, ${accent}66)`,
        }}
      />

      <div className="relative flex items-center gap-3.5 pt-1">
        <span
          className="flex size-12 shrink-0 items-center justify-center rounded-2xl text-ink"
          style={{
            backgroundImage: `linear-gradient(135deg, ${accent}, ${accent}77)`,
            boxShadow: `0 8px 22px -8px ${accent}, inset 0 1px 0 rgba(255,255,255,.4)`,
          }}
        >
          {done ? <Icon name="check" className="size-6" /> : icon}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <span className="truncate text-[0.96rem] font-extrabold text-ink">
              {title}
            </span>
            {badge ? (
              <span
                className="shrink-0 rounded-full px-2 py-0.5 text-[0.62rem] font-extrabold uppercase tracking-wider"
                style={{
                  background: done ? "#4FF0C6" : `${accent}33`,
                  color: "#0B1220",
                }}
              >
                {badge}
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[0.78rem] font-medium text-ink-soft">
            {subtitle}
          </span>
        </span>

        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{
            background: `${accent}1A`,
          }}
        >
          <Icon name="chevronRight" className="size-4 text-ink" />
        </span>
      </div>
    </motion.button>
  );
}
