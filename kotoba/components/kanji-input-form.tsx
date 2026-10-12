"use client";

import { motion } from "framer-motion";
import { useMemo, useState, useTransition } from "react";
import { toKatakana } from "wanakana";
import {
  insertKanji,
  dedupeKanjiWithin,
  filterKanjiAgainstDB,
  type NewKanji,
} from "@/lib/supabase/queries";
import { ErrorNote, Toast } from "./ui";

// ═══════════════════════════════════════════════════════════════
//  Form nhập kanji
//  Mỗi dòng: "kanji, nghĩa tiếng Việt, onyomi, kunyomi"
//  Chỉ cần "kanji, nghĩa" là đủ — phần đọc có thể bổ trống.
// ═══════════════════════════════════════════════════════════════

interface ParsedKanjiLine {
  key: string;
  character: string;
  meaning: string;
  onyomi: string;
  kunyomi: string;
  valid: boolean;
}

export function KanjiInputForm({
  onSaved,
  kanjiLessons = {},
}: {
  onSaved?: () => void;
  kanjiLessons?: Record<number, number>;
}) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [lesson, setLesson] = useState(0);

  const lessonOptions = useMemo(() => {
    const nums = Object.keys(kanjiLessons).map(Number).filter((n) => n > 0);
    nums.sort((a, b) => a - b);
    const next = nums.length > 0 ? Math.max(...nums) + 1 : 1;
    return { list: nums, next };
  }, [kanjiLessons]);

  const lines = useMemo<ParsedKanjiLine[]>(() => {
    const out: ParsedKanjiLine[] = [];
    raw.split("\n").forEach((line, i) => {
      const t = line.trim();
      if (!t) return;

      const parts = t.split(",").map((p) => p.trim());
      const character = parts[0] ?? "";
      const meaning = parts[1] ?? "";

      // Chỉ giữ kanji; bỏ qua kana và romaji trong ô đầu
      const kanjiOnly = [...character]
        .filter(
          (c) =>
            (c >= "一" && c <= "鿿") ||
            (c >= "㐀" && c <= "䶿") ||
            c === "々" ||
            c === "ヶ",
        )
        .join("");

      const valid = kanjiOnly.length > 0 && meaning.length > 0;

      out.push({
        key: `${i}-${kanjiOnly}`,
        character: kanjiOnly || character,
        meaning,
        onyomi: toKatakana(parts[2] ?? ""),
        kunyomi: parts[3] ?? "",
        valid,
      });
    });
    return out;
  }, [raw]);

  const validLines = lines.filter((l) => l.valid);
  const canSave = validLines.length > 0 && !isPending;

  function handleSave() {
    setError(null);
    if (validLines.length === 0) {
      setError("Chưa có dòng nào hợp lệ.");
      return;
    }

    const rows: NewKanji[] = validLines.map((l) => ({
      character: l.character,
      meaning_vi: l.meaning,
      onyomi: l.onyomi,
      kunyomi: l.kunyomi,
      lesson_number: lesson,
    }));

    startTransition(async () => {
      try {
        // Dedup nội bộ (cùng character trong 1 lần nhập)
        const internal = dedupeKanjiWithin(rows);
        // Dedup với DB (đã có sẵn)
        const { unique: toInsert, duplicates: dbDupes } =
          await filterKanjiAgainstDB(internal.unique);

        if (toInsert.length > 0) {
          await insertKanji(toInsert);
        }
        const skipped = internal.duplicates.length + dbDupes.length;
        setRaw("");
        if (toInsert.length > 0 && skipped === 0) {
          setToast(`Đã lưu ${toInsert.length} kanji 🈶`);
        } else if (toInsert.length > 0 && skipped > 0) {
          setToast(
            `Đã lưu ${toInsert.length} kanji · bỏ qua ${skipped} kanji trùng`,
          );
        } else if (toInsert.length === 0 && skipped > 0) {
          setError(
            `Tất cả ${skipped} kanji đã có sẵn — không thêm bản sao.`,
          );
          onSaved?.();
          setTimeout(() => setError(null), 4000);
          return;
        }
        onSaved?.();
        setTimeout(() => setToast(null), 3200);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Lỗi khi lưu.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="card px-4 py-3.5">
        <p className="text-[0.82rem] font-bold">Nhập kanji</p>
        <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-soft">
          Định dạng:{" "}
          <code className="rounded bg-mist px-1.5 py-0.5 font-semibold text-ink">
            kanji, nghĩa, onyomi, kunyomi
          </code>
          <br />
          onyomi sẽ tự chuyển sang katakana. Có thể bỏ trống nếu chưa biết.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {[
            "日, mặt trời, にち, ひ",
            "水, nước, スイ",
            "山, núi, サン",
            "本, sách, ホン",
          ].map((ex) => (
            <button
              key={ex}
              type="button"
              className="chip jp"
              onClick={() => setRaw((r) => (r ? `${r.trim()}\n${ex}` : ex))}
            >
              + {ex.split(",")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Chọn bài ── */}
      <div className="flex items-center gap-2">
        <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
          Bài
        </p>
        <div className="flex flex-1 flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setLesson(0)}
            className="chip"
            data-active={lesson === 0}
          >
            Chưa xếp
          </button>
          {lessonOptions.list.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setLesson(n)}
              className="chip"
              data-active={lesson === n}
            >
              Bài {n} ({kanjiLessons[n]})
            </button>
          ))}
          <button
            type="button"
            onClick={() => setLesson(lessonOptions.next)}
            className="chip"
            data-active={lesson === lessonOptions.next}
          >
            + Bài {lessonOptions.next}
          </button>
        </div>
      </div>

      <textarea
        value={raw}
        onChange={(e) => {
          setRaw(e.target.value);
          setError(null);
        }}
        rows={6}
        spellCheck={false}
        placeholder={"日, mặt trời, にち, ひ\n水, nước, スイ\n山, núi, サン"}
        className="field resize-y font-mono text-[0.9rem] leading-relaxed"
      />

      {lines.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
            Xem trước ({validLines.length}/{lines.length})
          </p>
          {lines.map((l) => (
            <motion.div
              key={l.key}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded-sm border px-3 py-2 ${
                l.valid ? "border-line bg-white" : "border-red-100 bg-red-50/60"
              }`}
            >
              <div className="flex items-center justify-between gap-3">
                <span
                  className={`jp text-[1.5rem] font-bold leading-none ${
                    l.valid ? "text-ink" : "text-red-400"
                  }`}
                >
                  {l.character}
                </span>
                <div className="min-w-0 flex-1 text-right">
                  <p className="truncate text-[0.85rem] font-bold">{l.meaning}</p>
                  {(l.onyomi || l.kunyomi) && (
                    <p className="jp truncate text-[0.72rem] text-ink-faint">
                      {[l.onyomi, l.kunyomi].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>
              {!l.valid && (
                <p className="mt-1 text-[0.7rem] text-red-500">
                  Cần kanji và nghĩa tiếng Việt
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {error ? <ErrorNote message={error} /> : null}

      <button
        type="button"
        onClick={handleSave}
        disabled={!canSave}
        className="btn btn-cyan w-full px-5 py-3 text-[0.92rem]"
      >
        {isPending ? "Đang lưu…" : `Lưu ${validLines.length || ""} kanji vào Supabase`}
      </button>

      {toast ? <Toast message={toast} /> : null}
    </div>
  );
}