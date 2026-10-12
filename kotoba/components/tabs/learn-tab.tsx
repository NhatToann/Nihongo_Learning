"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { Kanji, Vocab } from "@/lib/types";
import { KanjiInputForm } from "@/components/kanji-input-form";
import { VocabInputForm } from "@/components/vocab-input-form";
import { ScreenHeader } from "@/components/ui";
import { Icon } from "@/components/icons";

// ═══════════════════════════════════════════════════════════════
//  Tab Học — nhập từ / kanji mới
// ═══════════════════════════════════════════════════════════════

interface LearnTabProps {
  onSaved: () => void;
  vocabToday: Vocab[];
  kanjiToday: Kanji[];
  vocabLessons: Record<number, number>;
  kanjiLessons: Record<number, number>;
  onDeleteVocab: (id: string) => Promise<void>;
  onDeleteKanji: (id: string) => Promise<void>;
}

type SubTab = "vocab" | "kanji";

export function LearnTab({
  onSaved,
  vocabToday,
  kanjiToday,
  vocabLessons,
  kanjiLessons,
  onDeleteVocab,
  onDeleteKanji,
}: LearnTabProps) {
  const [sub, setSub] = useState<SubTab>("vocab");

  return (
    <div>
      <ScreenHeader
        title="Học từ mới"
        subtitle="Nhập từ hôm nay vào Supabase"
      />

      {/* ── Chuyển tab con (clay pill) ── */}
      <div
        className="clay flex gap-1 p-1.5"
        style={{ background: "white" }}
      >
        <SubButton
          active={sub === "vocab"}
          onClick={() => setSub("vocab")}
          count={vocabToday.length}
          icon={<Icon name="book" className="size-4" />}
        >
          Từ vựng
        </SubButton>
        <SubButton
          active={sub === "kanji"}
          onClick={() => setSub("kanji")}
          count={kanjiToday.length}
          icon={<Icon name="kanji" className="size-4 jp" />}
        >
          Kanji
        </SubButton>
      </div>

      {/* ── Nội dung ── */}
      <div className="mt-4">
        {sub === "vocab" ? (
          <>
            <VocabInputForm onSaved={onSaved} vocabLessons={vocabLessons} />
            <TodayList
              items={vocabToday}
              kind="vocab"
              onDelete={onDeleteVocab}
            />
          </>
        ) : (
          <>
            <KanjiInputForm onSaved={onSaved} kanjiLessons={kanjiLessons} />
            <TodayList
              items={kanjiToday}
              kind="kanji"
              onDelete={onDeleteKanji}
            />
          </>
        )}
      </div>
    </div>
  );
}

function SubButton({
  active,
  onClick,
  count,
  icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl py-2.5 text-[0.85rem] font-extrabold transition-all ${
        active ? "text-ink" : "text-ink-faint"
      }`}
      style={
        active
          ? {
              backgroundImage:
                "linear-gradient(96deg, #4FF0C6, #C1FA87 60%, #F8F971)",
              boxShadow: "0 6px 18px -8px rgba(79,240,198,.55)",
            }
          : undefined
      }
    >
      {icon}
      <span>{children}</span>
      {count > 0 && (
        <span
          className={`ml-1 rounded-full px-1.5 text-[0.65rem] font-black ${
            active ? "bg-ink/15 text-ink" : "bg-ink/8 text-ink-soft"
          }`}
        >
          {count}
        </span>
      )}
    </button>
  );
}

// ── Danh sách từ/kanji hôm nay ───────────────────────────────────

function TodayList({
  items,
  kind,
  onDelete,
}: {
  items: Array<Vocab | Kanji>;
  kind: "vocab" | "kanji";
  onDelete: (id: string) => Promise<void>;
}) {
  if (items.length === 0) return null;

  return (
    <section className="mt-8">
      <div className="mb-3 flex items-center gap-2">
        <span className="h-px flex-1 bg-line" />
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
          Đã thêm hôm nay ({items.length})
        </p>
        <span className="h-px flex-1 bg-line" />
      </div>

      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {items.map((item) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -30 }}
              className="clay flex items-center gap-3 px-3.5 py-2.5"
              style={{ background: "white" }}
            >
              {kind === "kanji" ? (
                <KanjiRow
                  item={item as Kanji}
                  onDelete={() => void onDelete(item.id)}
                />
              ) : (
                <VocabRow
                  item={item as Vocab}
                  onDelete={() => void onDelete(item.id)}
                />
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </section>
  );
}

function VocabRow({ item, onDelete }: { item: Vocab; onDelete: () => void }) {
  return (
    <>
      <span className="jp w-[42%] shrink-0 truncate text-[1.15rem] font-black leading-tight">
        {item.hiragana || item.romaji}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.85rem] font-bold">
          {item.meaning_vi}
        </span>
        <span className="block truncate text-[0.72rem] text-ink-faint">
          {item.romaji}
          {item.katakana && item.katakana !== item.hiragana
            ? ` · ${item.katakana}`
            : ""}
        </span>
      </span>
      <DeleteButton onClick={onDelete} />
    </>
  );
}

function KanjiRow({ item, onDelete }: { item: Kanji; onDelete: () => void }) {
  return (
    <>
      <span className="jp flex w-10 shrink-0 items-center justify-center text-[1.7rem] font-black leading-none">
        {item.character}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.85rem] font-bold">
          {item.meaning_vi}
        </span>
        {(item.onyomi || item.kunyomi) && (
          <span className="jp block truncate text-[0.72rem] text-ink-faint">
            {[item.onyomi, item.kunyomi].filter(Boolean).join(" · ")}
          </span>
        )}
      </span>
      <DeleteButton onClick={onDelete} />
    </>
  );
}

function DeleteButton({ onClick }: { onClick: () => void }) {
  const [confirming, setConfirming] = useState(false);

  if (confirming) {
    return (
      <span className="flex shrink-0 items-center gap-1">
        <button
          onClick={onClick}
          className="rounded-lg bg-red-500 px-2.5 py-1 text-[0.7rem] font-black text-white"
        >
          Xoá
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="rounded-lg border border-line px-2.5 py-1 text-[0.7rem] font-extrabold text-ink-soft"
        >
          Huỷ
        </button>
      </span>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="clay-interactive flex size-8 shrink-0 items-center justify-center rounded-full"
      style={{ background: "white" }}
      aria-label="Xoá"
    >
      <Icon name="x" className="size-3.5 text-ink-faint" />
    </button>
  );
}
