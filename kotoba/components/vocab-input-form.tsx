"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, useTransition } from "react";
import {
  applyJishoHit,
  displayJapanese,
  parseInputLine,
  withReading,
  type ParsedWord,
} from "@/lib/romaji";
import { insertVocab, type NewVocab } from "@/lib/supabase/queries";
import { ErrorNote, Toast } from "./ui";
import { useJishoLookup, type JishoHit } from "@/hooks/use-jisho-lookup";

// ═══════════════════════════════════════════════════════════════
//  Form nhập từ mới
//  Nhập mỗi dòng: "romaji, nghĩa tiếng Việt"
//  Romaji tự động -> hiragana + katakana. Nghĩa giữ nguyên.
// ═══════════════════════════════════════════════════════════════

interface ParsedLine {
  key: string;
  word: ParsedWord;
  meaning: string;
  note?: string;
  valid: boolean;
}

const EXAMPLES = [
  "nihongo, tiếng Nhật",
  "sakura, hoa anh đào",
  "renshuu, luyện tập",
  "tabemono, món ăn",
  "ryouri, nấu ăn",
];

export function VocabInputForm({ onSaved }: { onSaved?: () => void }) {
  const [raw, setRaw] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  // romaji bổ sung cho các mục kanji chưa có cách đọc
  const [readings, setReadings] = useState<Record<string, string>>({});
  // Danh sách dòng đã parse — có thể thay đổi khi Jisho enrich
  const [lines, setLines] = useState<ParsedLine[]>([]);

  // Mỗi khi raw đổi → parse lại (giữ nguyên key để Jisho state không reset)
  useEffect(() => {
    const next: ParsedLine[] = [];
    raw.split("\n").forEach((line, i) => {
      const trimmed = line.trim();
      if (!trimmed) return;
      const parsed = parseInputLine(trimmed);
      if (!parsed) {
        next.push({
          key: `bad-${i}`,
          word: {
            raw: trimmed,
            kanji: "",
            hiragana: "",
            katakana: "",
            romaji: "",
            hasKanji: false,
            needsReading: false,
            script: "raw",
          },
          meaning: "",
          valid: false,
        });
        return;
      }
      next.push({
        key: `ok-${i}-${parsed.word.raw}`,
        word: parsed.word,
        meaning: parsed.meaning,
        note: parsed.note,
        valid: true,
      });
    });
    setLines(next);
  }, [raw]);

  const validLines = lines.filter((l) => l.valid);
  const badLines = lines.filter((l) => !l.valid);
  const needsReading = validLines.filter(
    (l) => l.word.needsReading && !(readings[l.key] ?? "").trim(),
  );
  const canSave = validLines.length > 0 && needsReading.length === 0 && !isPending;

  /** Cập nhật word khi Jisho enrich */
  function updateWord(key: string, word: ParsedWord) {
    setLines((prev) =>
      prev.map((l) => (l.key === key ? { ...l, word } : l)),
    );
  }

  function handleSave() {
    setError(null);
    if (validLines.length === 0) {
      setError("Chưa có dòng nào hợp lệ.");
      return;
    }
    if (needsReading.length > 0) {
      setError(
        `${needsReading.length} mục kanji chưa có cách đọc. Hãy điền romaji ở ô phía dưới.`,
      );
      return;
    }

    const rows: NewVocab[] = validLines.map((l) => {
      let word = l.word;
      const extra = (readings[l.key] ?? "").trim();
      if (word.needsReading && extra) {
        word = withReading(word, extra);
      }
      return {
        romaji: word.romaji || word.raw,
        hiragana: word.hiragana,
        katakana: word.katakana,
        meaning_vi: l.meaning,
        note: l.note ?? null,
      };
    });

    startTransition(async () => {
      try {
        await insertVocab(rows);
        setRaw("");
        setReadings({});
        setToast(`Đã lưu ${rows.length} từ ✨`);
        onSaved?.();
        setTimeout(() => setToast(null), 2600);
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Lỗi khi lưu. Kiểm tra kết nối Supabase.",
        );
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* ── Hướng dẫn ── */}
      <div className="card px-4 py-3.5">
        <p className="text-[0.82rem] font-bold">
          Nhập mỗi dòng một từ
        </p>
        <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-soft">
          Định dạng: <code className="rounded bg-mist px-1.5 py-0.5 font-semibold text-ink">romaji, nghĩa tiếng Việt</code>
          <br />
          Romaji sẽ tự chuyển thành hiragana + katakana. Nghĩa giữ nguyên.
          <br />
          Có thể thêm ghi chú sau dấu <code className="font-semibold">#</code> hoặc <code className="font-semibold">;</code>.
        </p>
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          {EXAMPLES.map((ex) => (
            <button
              key={ex}
              type="button"
              className="chip"
              onClick={() => {
                setRaw((r) => (r ? `${r.trim()}\n${ex}` : ex));
              }}
            >
              + {ex.split(",")[0]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Ô nhập ── */}
      <div>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setError(null);
          }}
          rows={6}
          spellCheck={false}
          placeholder={"nihongo, tiếng Nhật\nsakura, hoa anh đào\nkaizen, cải tiến"}
          className="field resize-y font-mono text-[0.9rem] leading-relaxed"
        />
      </div>

      {/* ── Xem trước ── */}
      {lines.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
              Xem trước
            </p>
            <div className="flex gap-1.5 text-[0.7rem] font-bold">
              {validLines.length > 0 && (
                <span className="chip" data-active="true">
                  ✓ {validLines.length}
                </span>
              )}
              {badLines.length > 0 && (
                <span className="chip border-red-200 text-red-600">
                  ✕ {badLines.length}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-1.5">
            {lines.map((l) => (
              <PreviewRow
                key={l.key}
                line={l}
                reading={readings[l.key] ?? ""}
                onReadingChange={(v) =>
                  setReadings((prev) => ({ ...prev, [l.key]: v }))
                }
                onWordChange={(w) => updateWord(l.key, w)}
              />
            ))}
          </div>
        </div>
      )}

      {error ? <ErrorNote message={error} /> : null}

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleSave}
          disabled={!canSave}
          className="btn btn-primary flex-1 px-5 py-3 text-[0.92rem]"
        >
          {isPending ? "Đang lưu…" : `Lưu ${validLines.length || ""} từ vào Supabase`}
        </button>
        {raw.trim() && (
          <button
            type="button"
            onClick={() => {
              setRaw("");
              setReadings({});
              setError(null);
            }}
            className="btn btn-ghost px-4 py-3 text-[0.85rem]"
          >
            Xoá
          </button>
        )}
      </div>

      <AnimatePresence>
        {toast ? <Toast message={toast} /> : null}
      </AnimatePresence>
    </div>
  );
}

// ── Dòng xem trước ──────────────────────────────────────────────

function PreviewRow({
  line,
  reading,
  onReadingChange,
  onWordChange,
}: {
  line: ParsedLine;
  reading: string;
  onReadingChange: (v: string) => void;
  /** Báo cho parent biết ParsedWord đã thay đổi (do Jisho enrich) */
  onWordChange?: (word: ParsedWord) => void;
}) {
  // Lookup Jisho khi user nhập romaji-only (không có kanji, không phải kana)
  // Lấy phần "head" (trước dấu phẩy) từ raw để tra
  const head = line.word.raw.split(/[,\t]/)[0].trim();
  // Tách phần kana/romaji (bỏ kanji) để tra chính xác hơn
  const queryTarget = useMemo(() => {
    // Nếu word đã có hiragana/katakana → tra chính phần đó
    if (line.word.katakana) return line.word.katakana;
    if (line.word.hiragana) return line.word.hiragana;
    return head;
  }, [line.word, head]);
  const { hit, loading } = useJishoLookup(queryTarget, 300);

  // Áp dụng kết quả Jisho vào ParsedWord, báo lên parent
  useEffect(() => {
    if (!hit || !onWordChange) return;
    const enriched = applyJishoHit(line.word, hit);
    // Chỉ thông báo khi có thay đổi
    if (
      enriched.kanji !== line.word.kanji ||
      enriched.script !== line.word.script ||
      enriched.jishoMeaning !== line.word.jishoMeaning
    ) {
      onWordChange(enriched);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hit]);

  if (!line.valid) {
    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        className="flex items-start gap-2 rounded-sm border border-red-100 bg-red-50/60 px-3 py-2"
      >
        <span className="mt-0.5 text-[0.8rem] text-red-500">✕</span>
        <div className="min-w-0">
          <p className="truncate font-mono text-[0.78rem] text-red-700">
            {line.word.raw}
          </p>
          <p className="text-[0.72rem] text-red-500">
            Thiếu dấu phẩy hoặc nghĩa tiếng Việt
          </p>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      className="rounded-sm border border-line bg-white px-3 py-2.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="jp truncate text-[1.05rem] font-bold leading-tight">
            {displayJapanese(line.word)}
            {loading && (
              <span className="ml-1.5 inline-block h-3 w-3 animate-spin rounded-full border-2 border-cyan border-r-transparent align-middle" />
            )}
          </p>
          <p className="mt-0.5 truncate text-[0.72rem] font-medium text-ink-faint">
            {line.word.romaji && (
              <>
                {line.word.romaji}
                {line.word.katakana && line.word.katakana !== line.word.hiragana
                  ? ` · ${line.word.katakana}`
                  : ""}
              </>
            )}
            {line.word.jishoMeaning && (
              <span className="ml-1.5 italic text-cyan/80">
                ({line.word.jishoMeaning})
              </span>
            )}
          </p>
        </div>
        <p className="max-w-[45%] shrink-0 truncate text-right text-[0.85rem] font-bold text-ink">
          {line.meaning}
        </p>
      </div>

      {line.note ? (
        <p className="mt-1 truncate text-[0.72rem] italic text-ink-faint">
          ✎ {line.note}
        </p>
      ) : null}

      {/* Ô nhập romaji cho kanji chưa có cách đọc */}
      {line.word.needsReading && (
        <div className="mt-2 rounded-xs border border-dashed border-cyan/50 bg-cyan/5 px-2.5 py-2">
          <p className="text-[0.7rem] font-bold text-ink-soft">
            Nhập romaji để tạo hiragana / katakana
          </p>
          <input
            value={reading}
            onChange={(e) => onReadingChange(e.target.value)}
            placeholder="ví dụ: nihongo"
            spellCheck={false}
            className="field mt-1.5 !py-1.5 text-[0.82rem]"
          />
          {reading.trim() && (
            <p className="jp mt-1 text-[0.9rem] font-bold text-ink">
              →{" "}
              {displayJapanese(withReading(line.word, reading))}
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
}