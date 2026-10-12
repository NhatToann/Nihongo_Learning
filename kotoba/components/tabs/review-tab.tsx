"use client";

import { motion } from "framer-motion";
import { useMemo, useState } from "react";
import type { StudyMode } from "@/lib/types";
import { ScreenHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

// ═══════════════════════════════════════════════════════════════
//  Tab Ôn tập — theo bài (lesson) + ôn tổng hợp toàn bộ
// ═══════════════════════════════════════════════════════════════

interface ReviewTabProps {
  vocabCount: number;
  kanjiCount: number;
  /** Map { 1: 6, 2: 10, ... } — số từ/kanji trong mỗi bài */
  vocabLessons: Record<number, number>;
  kanjiLessons: Record<number, number>;
  onStart: (mode: StudyMode, count?: number, lesson?: number) => void;
  /** Tạo bài mới: gán tất cả item chưa có lesson_number vào bài `to` */
  onCreateLesson: (kind: "vocab" | "kanji", to: number) => Promise<number>;
}

const GLOBAL_LIMITS = [
  { value: 10, label: "10 câu" },
  { value: 20, label: "20 câu" },
  { value: 50, label: "50 câu" },
  { value: 100, label: "100 câu" },
  { value: 0, label: "Tất cả" },
];

export function ReviewTab({
  vocabCount,
  kanjiCount,
  vocabLessons,
  kanjiLessons,
  onStart,
  onCreateLesson,
}: ReviewTabProps) {
  const [vocabLimit, setVocabLimit] = useState(20);
  const [kanjiLimit, setKanjiLimit] = useState(10);
  const [vocabTab, setVocabTab] = useState<"lessons" | "all">("lessons");
  const [kanjiTab, setKanjiTab] = useState<"lessons" | "all">("lessons");

  // Bài mới nhất + đề xuất bài tiếp theo
  const vocabMax = useMemo(
    () => maxKey(vocabLessons),
    [vocabLessons],
  );
  const kanjiMax = useMemo(
    () => maxKey(kanjiLessons),
    [kanjiLessons],
  );

  return (
    <div>
      <ScreenHeader
        title="Ôn tập"
        subtitle="Theo bài hoặc tổng hợp toàn bộ"
      />

      <div className="mt-5 space-y-5">
        <LessonCard
          accent="#4FF0C6"
          title="Ôn tập từ vựng"
          icon={<Icon name="book" className="size-5" />}
          lessons={vocabLessons}
          currentLesson={vocabMax}
          totalCount={vocabCount}
          kind="vocab"
          mode="lesson"
          tab={vocabTab}
          onTabChange={setVocabTab}
          onStart={(n) => onStart("lesson", undefined, n)}
          onCreateLesson={onCreateLesson}
        />

        <LessonCard
          accent="#00DAF3"
          title="Ôn tập kanji"
          icon={<Icon name="kanji" className="size-5 jp" />}
          lessons={kanjiLessons}
          currentLesson={kanjiMax}
          totalCount={kanjiCount}
          kind="kanji"
          mode="kanji-lesson"
          tab={kanjiTab}
          onTabChange={setKanjiTab}
          onStart={(n) => onStart("kanji-lesson", undefined, n)}
          onCreateLesson={onCreateLesson}
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
          <p className="text-[0.84rem] font-extrabold text-ink">Mẹo ôn tập</p>
        </div>
        <ul className="space-y-1.5 text-[0.78rem] leading-relaxed text-ink-soft">
          <li className="flex gap-2">
            <span className="text-cyan">•</span>
            <span>Tạo bài mới khi đã thêm đủ từ — nhấn “Tạo bài N+1” để gộp</span>
          </li>
          <li className="flex gap-2">
            <span className="text-mint">•</span>
            <span>Bài chỉ chứa từ thuộc lesson_number đó — không bị trộn với bài khác</span>
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

// ── Helpers ──────────────────────────────────────────────────────

function maxKey(m: Record<number, number>): number {
  const keys = Object.keys(m).map(Number);
  if (keys.length === 0) return 0;
  return Math.max(...keys);
}

// ── Card theo bài ────────────────────────────────────────────────

function LessonCard({
  accent,
  title,
  icon,
  lessons,
  currentLesson,
  totalCount,
  kind,
  mode,
  tab,
  onTabChange,
  onStart,
  onCreateLesson,
}: {
  accent: string;
  title: string;
  icon: React.ReactNode;
  lessons: Record<number, number>;
  currentLesson: number;
  totalCount: number;
  kind: "vocab" | "kanji";
  mode: StudyMode;
  tab: "lessons" | "all";
  onTabChange: (t: "lessons" | "all") => void;
  onStart: (lesson: number) => void;
  onCreateLesson: (kind: "vocab" | "kanji", to: number) => Promise<number>;
}) {
  const [globalLimit, setGlobalLimit] = useState(20);
  const [busy, setBusy] = useState(false);
  const [hint, setHint] = useState<string | null>(null);

  const entries = useMemo(
    () =>
      Object.entries(lessons)
        .map(([k, v]) => [Number(k), v] as const)
        .sort((a, b) => a[0] - b[0]),
    [lessons],
  );
  const nextLesson = currentLesson + 1;
  const hasUnassigned = true; // ta luôn cho phep tao bai moi

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setHint(null);
    try {
      const n = await onCreateLesson(kind, nextLesson);
      setHint(
        n > 0
          ? `Đã gộp ${n} mục vào bài ${nextLesson}.`
          : "Không có mục nào chưa xếp bài.",
      );
    } catch (e) {
      setHint(e instanceof Error ? e.message : "Lỗi.");
    } finally {
      setBusy(false);
    }
  }

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

      {/* Header + count */}
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
              {totalCount > 0
                ? `${totalCount} ${kind === "vocab" ? "từ" : "kanji"} · ${entries.length} bài`
                : "Chưa có dữ liệu"}
            </p>
          </div>
        </div>
        <span
          className="clay shrink-0 rounded-full px-3 py-1.5 text-[0.72rem] font-black tabular-nums text-ink"
          style={{ background: "white" }}
        >
          {entries.length} bài
        </span>
      </div>

      {/* Tabs: theo bài / tổng hợp */}
      <div className="relative mt-3 flex gap-1.5">
        <TabBtn
          active={tab === "lessons"}
          onClick={() => onTabChange("lessons")}
        >
          Theo bài
        </TabBtn>
        <TabBtn active={tab === "all"} onClick={() => onTabChange("all")}>
          Tổng hợp
        </TabBtn>
      </div>

      {tab === "lessons" ? (
        <div className="relative mt-3">
          {entries.length === 0 ? (
            <EmptyLessons
              accent={accent}
              hasItems={totalCount > 0}
              busy={busy}
              onCreate={handleCreate}
              nextLesson={1}
            />
          ) : (
            <>
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {entries.map(([n, count]) => (
                  <motion.button
                    key={n}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => onStart(n)}
                    className="clay-interactive relative flex flex-col items-center gap-0.5 rounded-2xl px-2 py-2.5"
                    style={{
                      background: "white",
                      borderTop: `2px solid ${accent}`,
                    }}
                  >
                    <span
                      className="text-[0.62rem] font-black uppercase tracking-[0.1em] text-ink-faint"
                    >
                      Bài
                    </span>
                    <span className="jp text-[1.4rem] font-black leading-none text-ink">
                      {n}
                    </span>
                    <span className="text-[0.7rem] font-extrabold text-ink-soft">
                      {count} {kind === "vocab" ? "từ" : "kanji"}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* Nút tạo bài N+1 */}
              <motion.button
                whileTap={busy ? undefined : { scale: 0.98 }}
                onClick={handleCreate}
                disabled={busy}
                className="btn btn-primary mt-3 w-full py-3 text-[0.85rem]"
              >
                <Icon name="plus" className="size-4" />
                {busy
                  ? "Đang tạo…"
                  : hasUnassigned
                    ? `Tạo bài ${nextLesson}`
                    : `Bài ${nextLesson} (chưa có từ)`}
              </motion.button>
              {hint && (
                <p className="mt-1.5 text-center text-[0.7rem] font-semibold text-ink-soft">
                  {hint}
                </p>
              )}
            </>
          )}
        </div>
      ) : (
        <div className="relative mt-3">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
            Số câu hỏi
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {GLOBAL_LIMITS.map((opt) => {
              const tooMany = opt.value !== 0 && opt.value > totalCount;
              return (
                <button
                  key={opt.value}
                  disabled={totalCount === 0 || tooMany}
                  onClick={() => setGlobalLimit(opt.value)}
                  className="chip"
                  data-active={globalLimit === opt.value}
                  style={tooMany ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
                >
                  {opt.label}
                </button>
              );
            })}
          </div>
          <motion.button
            whileTap={totalCount === 0 ? undefined : { scale: 0.98 }}
            onClick={() => onStart(0)}
            disabled={totalCount === 0}
            className="btn btn-primary relative mt-3 w-full py-3.5 text-[0.9rem] disabled:opacity-45"
          >
            {totalCount === 0 ? (
              "Chưa có dữ liệu"
            ) : (
              <>
                <Icon name="play" className="size-4" filled />
                <span>
                  Ôn tập tổng hợp {globalLimit === 0 ? totalCount : Math.min(globalLimit, totalCount)} câu
                </span>
              </>
            )}
          </motion.button>
        </div>
      )}
    </div>
  );
}

function TabBtn({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-1 items-center justify-center rounded-xl py-1.5 text-[0.78rem] font-extrabold transition ${
        active
          ? "bg-ink/8 text-ink"
          : "text-ink-faint hover:text-ink-soft"
      }`}
    >
      {children}
    </button>
  );
}

function EmptyLessons({
  accent,
  hasItems,
  busy,
  onCreate,
  nextLesson,
}: {
  accent: string;
  hasItems: boolean;
  busy: boolean;
  onCreate: () => void;
  nextLesson: number;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-ink/15 bg-white/40 p-4 text-center">
      <p className="text-[0.82rem] font-bold text-ink-soft">
        Chưa có bài nào
      </p>
      <p className="mt-1 text-[0.7rem] text-ink-faint">
        {hasItems
          ? "Bấm bên dưới để tạo bài đầu tiên từ các từ chưa xếp."
          : "Thêm từ ở tab Học trước, rồi quay lại tạo bài."}
      </p>
      <motion.button
        whileTap={busy || !hasItems ? undefined : { scale: 0.98 }}
        onClick={onCreate}
        disabled={busy || !hasItems}
        className="btn btn-primary mt-3 w-full py-2.5 text-[0.82rem] disabled:opacity-45"
        style={{ backgroundImage: `linear-gradient(135deg, ${accent}, ${accent}cc)` }}
      >
        <Icon name="plus" className="size-3.5" />
        {busy ? "Đang tạo…" : `Tạo bài ${nextLesson}`}
      </motion.button>
    </div>
  );
}
