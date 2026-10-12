"use client";

import { motion } from "framer-motion";
import type { Kanji, StudyMode } from "@/lib/types";
import { ScreenHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

interface KanjiTabProps {
  kanji: Kanji[];
  todayCount: number;
  completed: Set<string>;
  onStart: (mode: StudyMode) => void;
}

export function KanjiTab({ kanji, todayCount, completed, onStart }: KanjiTabProps) {
  const dailyDone = completed.has("kanji-daily");
  const reviewDone = completed.has("kanji-review");
  const total = kanji.length;

  return (
    <div>
      <ScreenHeader
        title="Mode Kanji"
        subtitle="Học và ôn tập kanji riêng biệt"
      />

      <div className="mt-5 space-y-3">
        <ActionCard
          accent="#00DAF3"
          title="Học kanji hôm nay"
          subtitle={
            todayCount === 0
              ? "Chưa có kanji hôm nay, thêm ở tab Học"
              : `${todayCount} kanji mới`
          }
          done={dailyDone}
          disabled={todayCount === 0}
          icon={<Icon name="kanji" className="size-6 jp" />}
          onClick={() => onStart("kanji-daily")}
        />

        <ActionCard
          accent="#7C6CFF"
          title="Ôn tập toàn bộ kanji"
          subtitle={
            total === 0
              ? "Chưa có kanji nào"
              : `${total} kanji, xáo trộn ngẫu nhiên`
          }
          done={reviewDone}
          disabled={total === 0}
          icon={<Icon name="shuffle" className="size-6" />}
          onClick={() => onStart("kanji-review")}
        />
      </div>

      <div className="mt-5 grid grid-cols-2 gap-2.5">
        <div
          className="clay relative overflow-hidden p-4"
          style={{
            background: "linear-gradient(135deg, rgba(0,218,243,0.15), white 70%)",
          }}
        >
          <div
            className="absolute inset-x-3 top-0 h-1 rounded-full"
            style={{ background: "linear-gradient(90deg, #00DAF3, #00DAF344)" }}
          />
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Tổng kanji
          </p>
          <p className="mt-1.5 text-[1.7rem] font-black leading-none tabular-nums">
            {total}
          </p>
        </div>
        <div
          className="clay relative overflow-hidden p-4"
          style={{
            background: "linear-gradient(135deg, rgba(79,240,198,0.15), white 70%)",
          }}
        >
          <div
            className="absolute inset-x-3 top-0 h-1 rounded-full"
            style={{ background: "linear-gradient(90deg, #4FF0C6, #4FF0C644)" }}
          />
          <p className="text-[0.66rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Hôm nay
          </p>
          <p className="mt-1.5 text-[1.7rem] font-black leading-none tabular-nums">
            {todayCount}
          </p>
        </div>
      </div>

      {kanji.length > 0 && (
        <section className="mt-7">
          <div className="mb-3 flex items-center gap-2">
            <span className="h-px flex-1 bg-line" />
            <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
              Kanji đã học
            </p>
            <span className="h-px flex-1 bg-line" />
          </div>
          <div className="grid grid-cols-4 gap-2">
            {kanji.slice(0, 40).map((k) => (
              <motion.div
                key={k.id}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                className="clay flex aspect-square flex-col items-center justify-center p-1.5"
                style={{ background: "white" }}
                title={k.meaning_vi}
              >
                <span className="jp text-[1.7rem] font-black leading-none">
                  {k.character}
                </span>
                <span className="mt-1 max-w-full truncate text-center text-[0.58rem] font-bold text-ink-soft">
                  {k.meaning_vi}
                </span>
              </motion.div>
            ))}
          </div>
          {kanji.length > 40 && (
            <p className="mt-3 text-center text-[0.74rem] font-semibold text-ink-faint">
              và {kanji.length - 40} kanji khác
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function ActionCard({
  accent,
  title,
  subtitle,
  done,
  disabled,
  icon,
  onClick,
}: {
  accent: string;
  title: string;
  subtitle: string;
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
        background: `linear-gradient(135deg, ${done ? "#F0FDFA" : "white"}, ${accent}10 100%)`,
      }}
    >
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
            {done ? (
              <span className="shrink-0 rounded-full bg-mint px-2 py-0.5 text-[0.62rem] font-black uppercase tracking-wider text-ink">
                Xong
              </span>
            ) : null}
          </span>
          <span className="mt-0.5 block truncate text-[0.78rem] font-semibold text-ink-soft">
            {subtitle}
          </span>
        </span>

        <span
          className="flex size-8 shrink-0 items-center justify-center rounded-full"
          style={{ background: `${accent}1A` }}
        >
          <Icon name="chevronRight" className="size-4 text-ink" />
        </span>
      </div>
    </motion.button>
  );
}
