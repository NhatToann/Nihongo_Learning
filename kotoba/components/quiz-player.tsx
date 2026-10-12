"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import confetti from "canvas-confetti";
import type { Question, QuizResult } from "@/lib/types";
import { checkAnswer, comboMultiplier, scoreForCorrect } from "@/lib/quiz";
import { ProgressBar, formatNumber } from "./ui";
import { Icon } from "./icons";

// ═══════════════════════════════════════════════════════════════
//  QuizPlayer — dùng chung cho cả 4 mode
//  Phong cách: claymorphism + neon outline + slide transition
// ═══════════════════════════════════════════════════════════════

export interface QuizPlayerProps {
  questions: Question[];
  title: string;
  onFinish: (result: QuizResult) => void;
  onExit: () => void;
  onAnswer?: (payload: {
    itemId: string;
    question: string;
    correct: boolean;
    answerMs: number;
    combo: number;
  }) => void;
}

type Phase = "asking" | "revealed";

export function QuizPlayer({
  questions,
  title,
  onFinish,
  onExit,
  onAnswer,
}: QuizPlayerProps) {
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("asking");
  const [selected, setSelected] = useState<string | null>(null);
  const [combo, setCombo] = useState(0);
  const [bestCombo, setBestCombo] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [lastCorrect, setLastCorrect] = useState(false);

  const [startedAt, setStartedAt] = useState(() => Date.now());
  const q = questions[index];

  const goNext = useCallback(() => {
    setSelected(null);
    setPhase("asking");
    setStartedAt(Date.now());
    setIndex((i) => i + 1);
  }, []);

  const handlePick = useCallback(
    (option: string) => {
      if (phase !== "asking" || !q) return;
      setSelected(option);

      const isCorrect = checkAnswer(option, q.answer, q.kind);
      const nextCombo = isCorrect ? combo + 1 : 0;
      const earned = isCorrect ? scoreForCorrect(nextCombo) : 0;

      setCombo(nextCombo);
      setLastCorrect(isCorrect);
      setCorrectCount((c) => (isCorrect ? c + 1 : c));
      setTotalEarned((d) => d + earned);
      if (nextCombo > bestCombo) setBestCombo(nextCombo);
      setPhase("revealed");

      onAnswer?.({
        itemId: q.itemId,
        question: q.kind,
        correct: isCorrect,
        answerMs: Date.now() - startedAt,
        combo: nextCombo,
      });

      if (isCorrect && (nextCombo === 5 || nextCombo === 10 || nextCombo === 15)) {
        fireComboConfetti(nextCombo);
      }
    },
    [phase, q, combo, bestCombo, onAnswer, startedAt],
  );

  // Phím tắt: 1-4 chọn đáp án, Enter/Space sang câu sau
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!q) return;
      if (phase === "asking") {
        const n = Number(e.key);
        if (n >= 1 && n <= q.options.length) {
          handlePick(q.options[n - 1]);
        }
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        if (index + 1 < questions.length) goNext();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phase, q, handlePick, goNext, index, questions.length]);

  const finish = useCallback(() => {
    onFinish({
      total: questions.length,
      correct: correctCount,
      diamonds: totalEarned,
      accuracy: questions.length > 0 ? correctCount / questions.length : 0,
      bestCombo,
    });
  }, [correctCount, questions.length, totalEarned, bestCombo, onFinish]);

  if (!q) return null;

  const isLast = index >= questions.length - 1;
  const multiplier = comboMultiplier(combo);

  return (
    <div className="flex min-h-[78dvh] flex-col">
      {/* ── Thanh trên (sticky) ── */}
      <div
        className="sticky top-0 z-30 -mx-4 mb-2 bg-gradient-to-b from-mist via-mist/95 to-transparent px-4 pb-3 pt-1 backdrop-blur-xl"
        style={{ paddingTop: "0.5rem" }}
      >
        <div className="flex items-center justify-between gap-2.5">
          <button
            onClick={onExit}
            className="clay-interactive flex size-10 shrink-0 items-center justify-center rounded-full"
            aria-label="Thoát"
            style={{ background: "white" }}
          >
            <Icon name="x" className="size-4 text-ink" />
          </button>
          <p className="min-w-0 flex-1 truncate text-center text-[0.82rem] font-extrabold text-ink-soft">
            {title}
          </p>
          <div
            className="clay flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5"
            style={{ background: "white" }}
          >
            <span className="text-[0.95rem] font-black tabular-nums leading-none text-ink">
              {index + 1}
            </span>
            <span className="text-[0.85rem] font-bold tabular-nums text-ink-faint">
              /{questions.length}
            </span>
          </div>
        </div>
        <div className="mt-3">
          <ProgressBar value={index + 1} max={questions.length} />
        </div>
      </div>

      {/* ── Combo + diamond floating ── */}
      <div className="mb-3 flex items-center justify-between gap-2">
        <AnimatePresence mode="popLayout">
          {combo >= 2 && (
            <motion.div
              key={combo}
              initial={{ scale: 0.6, opacity: 0, rotate: -8 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: "spring", stiffness: 420, damping: 18 }}
              className="flex items-center gap-1.5 rounded-full px-3.5 py-1.5"
              style={{
                backgroundImage: "linear-gradient(96deg, #00DAF3, #4FF0C6)",
                boxShadow: "0 8px 24px -8px rgba(0,218,243,.65)",
              }}
            >
              <span className="text-[0.8rem] font-black text-ink">
                COMBO ×{combo}
              </span>
              <span
                className="rounded-full bg-white/85 px-1.5 py-0.5 text-[0.68rem] font-black text-ink"
                style={{ boxShadow: "inset 0 1px 2px rgba(11,18,32,.08)" }}
              >
                {multiplier.toFixed(1)}×
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div
          key={totalEarned}
          initial={{ scale: 1.18 }}
          animate={{ scale: 1 }}
          className="clay ml-auto flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{ background: "white" }}
        >
          <Icon name="diamond" className="size-3.5 text-cyan" filled />
          <span className="text-[0.85rem] font-black tabular-nums text-ink">
            {formatNumber(totalEarned)}
          </span>
        </motion.div>
      </div>

      {/* ── Câu hỏi ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={q.id}
          initial={{ opacity: 0, x: 40 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -40 }}
          transition={{ duration: 0.22 }}
          className="flex-1"
        >
          <QuestionCard
            question={q}
            phase={phase}
            selected={selected}
            onPick={handlePick}
          />
        </motion.div>
      </AnimatePresence>

      {/* ── Nút tiếp ── */}
      <div className="sticky bottom-0 z-20 -mx-4 mt-5 bg-gradient-to-t from-mist via-mist/95 to-transparent px-4 pb-6 pt-3">
        <AnimatePresence>
          {phase === "revealed" && (
            <motion.button
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              onClick={isLast ? finish : goNext}
              className={`btn w-full py-4 text-[0.96rem] ${
                lastCorrect ? "btn-primary" : "btn-ghost"
              }`}
            >
              {isLast ? "Xem kết quả" : "Câu tiếp theo"}
              <Icon name="arrowRight" className="size-4" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
//  Thẻ câu hỏi
// ═══════════════════════════════════════════════════════════════

function QuestionCard({
  question,
  phase,
  selected,
  onPick,
}: {
  question: Question;
  phase: Phase;
  selected: string | null;
  onPick: (option: string) => void;
}) {
  // Câu hỏi hiện tiếng Nhật -> font lớn hơn
  const promptIsJP =
    question.kind === "jp2vi" ||
    question.kind === "kanji2vi" ||
    question.kind === "kanji2reading";

  return (
    <div className="clay relative overflow-hidden px-5 py-7">
      {/* Subtle inner glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 size-40 rounded-full opacity-30"
        style={{ background: "radial-gradient(circle, #C1FA87, transparent 70%)" }}
      />

      <p className="relative text-center text-[0.7rem] font-bold uppercase tracking-[0.16em] text-ink-faint">
        {kindLabel(question.kind)}
      </p>

      <div className="relative mt-4 flex min-h-[100px] items-center justify-center">
        <motion.p
          key={`${question.prompt}-${phase}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`jp text-center font-black leading-tight ${
            promptIsJP ? "text-[2.7rem]" : "text-[2rem]"
          }`}
        >
          {question.prompt}
        </motion.p>
      </div>

      {question.promptSub && (
        <p className="relative mt-1 text-center text-[0.8rem] font-semibold text-ink-faint">
          {question.promptSub}
        </p>
      )}

      <div className="relative mt-6 space-y-2.5">
        {question.options.map((opt, i) => {
          const isSelected = selected === opt;
          const isAnswer = opt === question.answer;
          const show = phase === "revealed";

          let tone =
            "border-line bg-white text-ink hover:border-cyan/60 hover:shadow-[0_6px_18px_-8px_rgba(0,218,243,.4)]";

          if (show && isAnswer) {
            tone =
              "border-mint text-ink";
          } else if (show && isSelected && !isAnswer) {
            tone = "border-red-300 bg-red-50 text-red-700";
          } else if (show) {
            tone = "border-line bg-white/50 text-ink-faint";
          }

          return (
            <motion.button
              key={`${opt}-${i}`}
              onClick={() => onPick(opt)}
              disabled={phase !== "asking"}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              whileTap={phase === "asking" ? { scale: 0.98 } : undefined}
              className={`flex w-full items-center gap-3 rounded-2xl border-[1.5px] px-4 py-3.5 text-left transition-all ${tone} disabled:cursor-default`}
              style={
                show && isAnswer
                  ? {
                      background:
                        "linear-gradient(135deg, rgba(79,240,198,.2), white)",
                      boxShadow: "0 8px 24px -8px rgba(79,240,198,.6)",
                    }
                  : undefined
              }
            >
              <span
                className={`flex size-7 shrink-0 items-center justify-center rounded-lg text-[0.78rem] font-black ${
                  show && isAnswer
                    ? "bg-mint text-ink"
                    : show
                      ? "bg-mist text-ink-faint"
                      : "bg-mist text-ink-soft"
                }`}
              >
                {show ? (isAnswer ? "✓" : "✕") : i + 1}
              </span>
              <span className="flex-1 text-[0.98rem] font-bold">{opt}</span>
            </motion.button>
          );
        })}
      </div>

      <AnimatePresence>
        {phase === "revealed" && question.detail && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="jp relative mt-3 overflow-hidden text-center text-[0.82rem] font-bold text-ink-soft"
          >
            {question.detail}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  );
}

function kindLabel(kind: Question["kind"]): string {
  switch (kind) {
    case "jp2vi":
    case "romaji2vi":
      return "Chọn nghĩa tiếng Việt";
    case "vi2jp":
      return "Chọn từ tiếng Nhật";
    case "kanji2vi":
      return "Nghĩa của kanji này?";
    case "vi2kanji":
      return "Kanji nào ứng với nghĩa này?";
    case "kanji2reading":
      return "Cách đọc của kanji";
    default:
      return "";
  }
}

// ── Confetti ─────────────────────────────────────────────────────

function fireComboConfetti(combo: number) {
  const intensity = Math.min(1, combo / 15);
  confetti({
    particleCount: Math.round(30 + intensity * 50),
    spread: 70,
    startVelocity: 28 + intensity * 22,
    origin: { x: 0.5, y: 0.32 },
    colors: ["#4FF0C6", "#00DAF3", "#C1FA87", "#8AF7A6", "#F8F971"],
    scalar: 0.9,
    disableForReducedMotion: true,
  });
}
