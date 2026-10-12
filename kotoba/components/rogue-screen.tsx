"use client";

import { motion } from "framer-motion";
import { useCallback, useEffect, useMemo, useState } from "react";
import confetti from "canvas-confetti";
import type { Question, StudyItem } from "@/lib/types";
import { buildQuiz, sample } from "@/lib/quiz";
import {
  NODE_META,
  advance,
  addDiamonds,
  createRun,
  generateMap,
  getNode,
  heal,
  loseHp,
  runScore,
  winRun,
  type MapNode,
  type RunState,
} from "@/lib/rogue";
import { QuizPlayer } from "./quiz-player";
import { ProgressBar, formatNumber } from "./ui";

// ═══════════════════════════════════════════════════════════════
//  Rogue-lite: map dạng nhánh, node đa loại, HP, boss
// ═══════════════════════════════════════════════════════════════

interface RogueScreenProps {
  mode: "vocab" | "kanji";
  pool: StudyItem[];
  onExit: () => void;
  onFinish: (score: number) => void;
}

type Phase = "map" | "battle" | "reward" | "over";

export function RogueScreen({ mode, pool, onExit, onFinish }: RogueScreenProps) {
  const [seed] = useState(() => Date.now() % 2 ** 31);
  const map = useMemo(() => generateMap(seed), [seed]);
  const [run, setRun] = useState<RunState>(() => createRun(seed));
  const [phase, setPhase] = useState<Phase>("map");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [pendingNode, setPendingNode] = useState<MapNode | null>(null);
  const [lastBattleCorrect, setLastBattleCorrect] = useState(0);
  const [lastBattleTotal, setLastBattleTotal] = useState(0);

  // ── Bắt đầu trận ──
  const enterNode = useCallback(
    (node: MapNode) => {
      setPendingNode(node);

      if (node.kind === "rest") {
        setRun((r) => heal(r));
        setPhase("reward");
        return;
      }

      if (node.kind === "shop") {
        setPhase("reward");
        return;
      }

      // battle / elite / boss -> sinh câu hỏi
      const items = sample(pool, Math.min(node.questions, pool.length));
      const qs = buildQuiz(items, pool);
      if (qs.length === 0) {
        setPhase("reward");
        return;
      }
      setQuestions(qs);
      setPhase("battle");
    },
    [pool],
  );

  // ── Xử lý kết quả trận ──
  const handleBattleFinish = useCallback(
    (result: { total: number; correct: number; diamonds: number }) => {
      const node = pendingNode;
      if (!node) return;

      setLastBattleTotal(result.total);
      setLastBattleCorrect(result.correct);

      const allowedMiss = node.kind === "boss" ? 1 : node.kind === "elite" ? 2 : 1;
      const wrong = result.total - result.correct;
      const success = wrong <= allowedMiss;

      let next = run;

      if (!success) {
        // Thua trận: mất 1 HP
        next = loseHp(next, 1);
      } else {
        // Thắng: nhận diamond (elite x2, boss x3)
        const mult = node.kind === "boss" ? 3 : node.kind === "elite" ? 2 : 1;
        next = addDiamonds(next, result.diamonds * mult);

        if (node.kind === "boss") {
          next = winRun(next);
        }
      }

      setRun(next);
      setPhase(next.dead ? "over" : next.won ? "over" : "reward");

      if (next.won) {
        fireVictoryConfetti();
      } else if (!next.dead && success) {
        confetti({
          particleCount: 40,
          spread: 80,
          origin: { x: 0.5, y: 0.4 },
          colors: ["#4FF0C6", "#C1FA87"],
          disableForReducedMotion: true,
        });
      }
    },
    [pendingNode, run],
  );

  // ── Đi tiếp ──
  const goNextNode = useCallback(() => {
    if (!pendingNode) return;
    const nextIds = pendingNode.next;
    if (nextIds.length === 0) {
      setPhase("over");
      return;
    }
    const nextId = nextIds[0];
    const next = advance(map, run, nextId);
    setRun(next);

    const node = getNode(map, nextId);
    if (node) enterNode(node);
  }, [pendingNode, map, run, enterNode]);

  // ── Bắt đầu run mới ──
  const restart = useCallback(() => {
    const newSeed = Date.now() % 2 ** 31;
    window.location.reload();
    void newSeed;
  }, []);

  // ═══════════════════════════════════════════════════════════
  //  Render
  // ═══════════════════════════════════════════════════════════

  if (phase === "battle" && pendingNode) {
    return (
      <div className="min-h-dvh">
        {/* HUD */}
        <div className="sticky top-0 z-30 -mx-4 bg-white/90 px-4 pb-3 pt-4 backdrop-blur-xl">
          <div className="flex items-center justify-between">
            <button onClick={onExit} className="chip">
              ✕
            </button>
            <div className="flex items-center gap-1.5">
              {Array.from({ length: run.maxHp }).map((_, i) => (
                <span key={i} className="text-[1.05rem]">
                  {i < run.hp ? "❤️" : "🖤"}
                </span>
              ))}
            </div>
            <span
              className="rounded-full px-2.5 py-1 text-[0.72rem] font-extrabold text-ink"
              style={{
                backgroundImage: `linear-gradient(135deg, ${NODE_META[pendingNode.kind].color}, ${NODE_META[pendingNode.kind].color}66)`,
              }}
            >
              {NODE_META[pendingNode.kind].icon} {NODE_META[pendingNode.kind].label}
            </span>
          </div>
          <div className="mt-2.5">
            <ProgressBar
              value={run.hp}
              max={run.maxHp}
              accent={NODE_META[pendingNode.kind].color}
            />
          </div>
        </div>

        <QuizPlayer
          key={pendingNode.id}
          questions={questions}
          title={`${NODE_META[pendingNode.kind].label} · ${questions.length} câu`}
          onFinish={(r) => handleBattleFinish(r)}
          onExit={onExit}
        />
      </div>
    );
  }

  if (phase === "over") {
    return (
      <RunEnd
        run={run}
        onRestart={restart}
        onExit={onExit}
        onFinish={onFinish}
      />
    );
  }

  // ── Map hoặc reward ──
  const showReward = phase === "reward";

  return (
    <div className="min-h-dvh pb-8">
      {/* HUD */}
      <div className="sticky top-0 z-30 -mx-4 mb-4 bg-white/90 px-4 pb-3 pt-4 backdrop-blur-xl">
        <div className="flex items-center justify-between">
          <button onClick={onExit} className="chip">
            ✕
          </button>
          <div className="flex items-center gap-1.5">
            {Array.from({ length: run.maxHp }).map((_, i) => (
              <span key={i} className="text-[1.05rem]">
                {i < run.hp ? "❤️" : "🖤"}
              </span>
            ))}
          </div>
          <span className="rounded-full border border-line bg-white px-2.5 py-1 text-[0.72rem] font-extrabold tabular-nums">
            💎 {formatNumber(run.diamonds)}
          </span>
        </div>
        <div className="mt-2.5">
          <ProgressBar value={run.hp} max={run.maxHp} accent="#FF4D6D" />
        </div>
      </div>

      <div className="px-1">
        <p className="text-center text-[0.72rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
          Tầng {run.floor} ·{" "}
          {mode === "kanji" ? "Chinh phục lục địa kanji" : "Chinh phục lục địa từ vựng"}
        </p>
      </div>

      {/* ── Bản đồ ── */}
      <div className="relative mt-4 px-2">
        <MapView
          map={map}
          run={run}
          interactive={phase === "map"}
          onEnter={enterNode}
        />
      </div>

      {/* ── Reward overlay ── */}
      {showReward && pendingNode && (
        <RewardOverlay
          node={pendingNode}
          correct={lastBattleCorrect}
          total={lastBattleTotal}
          run={run}
          onContinue={goNextNode}
        />
      )}
    </div>
  );
}

// ── Bản đồ ───────────────────────────────────────────────────

function MapView({
  map,
  run,
  interactive,
  onEnter,
}: {
  map: MapNode[];
  run: RunState;
  interactive: boolean;
  onEnter: (n: MapNode) => void;
}) {
  const rows = new Map<number, MapNode[]>();
  for (const n of map) {
    if (!rows.has(n.row)) rows.set(n.row, []);
    rows.get(n.row)!.push(n);
  }
  const maxRow = Math.max(...rows.keys());

  return (
    <div className="flex flex-col-reverse gap-3">
      {Array.from({ length: maxRow + 1 }).map((_, i) => {
        const r = maxRow - i;
        const rowNodes = rows.get(r) ?? [];
        return (
          <div key={r} className="flex justify-center gap-6">
            {rowNodes.map((node) => {
              const meta = NODE_META[node.kind];
              const visited = run.visited.includes(node.id);
              const available = run.available.includes(node.id);
              const isCurrent = run.currentNodeId === node.id;
              const locked = !visited && !available && !isCurrent;

              return (
                <motion.button
                  key={node.id}
                  initial={{ opacity: 0, scale: 0.7 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: r * 0.03 }}
                  onClick={() => {
                    if (interactive && available && !visited) onEnter(node);
                  }}
                  disabled={!interactive || locked || visited}
                  whileTap={available && !visited ? { scale: 0.9 } : undefined}
                  className="relative flex size-16 items-center justify-center rounded-full text-[1.4rem] transition-all disabled:cursor-default"
                  style={{
                    background: visited
                      ? "linear-gradient(135deg, #4FF0C6, #C1FA87)"
                      : locked
                        ? "#EDF2F3"
                        : `linear-gradient(135deg, ${meta.color}, ${meta.color}88)`,
                    boxShadow:
                      available && !visited
                        ? `0 0 0 3px white, 0 0 0 5px ${meta.color}, 0 8px 20px -8px ${meta.color}`
                        : isCurrent
                          ? `0 0 0 3px white, 0 0 0 6px #0B1220`
                          : "none",
                    opacity: locked ? 0.4 : 1,
                  }}
                  title={meta.label}
                >
                  {visited ? "✓" : locked ? "🔒" : meta.icon}

                  {isCurrent && (
                    <motion.span
                      animate={{ y: [0, -4, 0] }}
                      transition={{ repeat: Infinity, duration: 1.2 }}
                      className="absolute -top-5 text-[0.7rem]"
                    >
                      ▼
                    </motion.span>
                  )}
                </motion.button>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

// ── Overlay phần thưởng ─────────────────────────────────────────

function RewardOverlay({
  node,
  correct,
  total,
  run,
  onContinue,
}: {
  node: MapNode;
  correct: number;
  total: number;
  run: RunState;
  onContinue: () => void;
}) {
  const meta = NODE_META[node.kind];
  const isRest = node.kind === "rest";
  const isShop = node.kind === "shop";
  const success = total === 0 || correct > total / 2;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-night/70 px-6 backdrop-blur-sm"
    >
      <motion.div
        initial={{ scale: 0.85, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 22 }}
        className="w-full max-w-[340px] rounded-lg bg-white p-6 text-center"
      >
        <div
          className="mx-auto flex size-16 items-center justify-center rounded-full text-[1.8rem]"
          style={{
            backgroundImage: `linear-gradient(135deg, ${meta.color}, ${meta.color}66)`,
            boxShadow: `0 10px 28px -10px ${meta.color}`,
          }}
        >
          {meta.icon}
        </div>

        <p className="mt-3 text-[1.05rem] font-extrabold">{meta.label}</p>

        {isRest ? (
          <p className="mt-1.5 text-[0.85rem] text-ink-soft">
            Bạn hồi <b className="text-ink">1 HP</b>. Nghỉ một chút nhé!
          </p>
        ) : isShop ? (
          <p className="mt-1.5 text-[0.85rem] text-ink-soft">
            Cửa hàng hiện đang đóng. Hãy tiếp tục hành trình.
          </p>
        ) : success ? (
          <p className="mt-1.5 text-[0.85rem] text-ink-soft">
            Đúng {correct}/{total} câu
            {node.kind === "elite" && " · Thưởng x2!"}
            {node.kind === "boss" && " · Chiến thắng!"}
          </p>
        ) : (
          <p className="mt-1.5 text-[0.85rem] text-red-600">
            Sai quá nhiều ({correct}/{total}). Mất 1 HP.
          </p>
        )}

        <div className="mt-4 flex items-center justify-center gap-1.5">
          {Array.from({ length: run.maxHp }).map((_, i) => (
            <span key={i} className="text-[1.15rem]">
              {i < run.hp ? "❤️" : "🖤"}
            </span>
          ))}
        </div>

        <button onClick={onContinue} className="btn btn-primary mt-5 w-full py-3 text-[0.9rem]">
          Tiếp tục →
        </button>
      </motion.div>
    </motion.div>
  );
}

// ── Kết thúc run ───────────────────────────────────────────────

function RunEnd({
  run,
  onRestart,
  onExit,
  onFinish,
}: {
  run: RunState;
  onRestart: () => void;
  onExit: () => void;
  onFinish: (score: number) => void;
}) {
  useEffect(() => {
    onFinish(runScore(run));
  }, [run, onFinish]);

  const score = runScore(run);

  return (
    <div className="flex min-h-dvh flex-col justify-center px-2">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="card px-6 py-8 text-center"
      >
        <p className="text-[3.2rem] leading-none">{run.won ? "👑" : "💀"}</p>
        <p className="mt-2 text-rainbow text-[1.6rem] font-black leading-tight">
          {run.won ? "Thắng rồi!" : "Thua rồi..."}
        </p>
        <p className="mt-1 text-[0.85rem] font-semibold text-ink-soft">
          {run.won
            ? "Bạn đã chinh phục lục địa từ vựng!"
            : `Bạn đi được ${run.visited.length} node trước khi hết HP.`}
        </p>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniStat label="Node" value={String(run.visited.length)} />
          <MiniStat label="Diamond" value={formatNumber(run.diamonds)} />
          <MiniStat label="Điểm" value={formatNumber(score)} />
        </div>

        <div className="mt-5 space-y-2.5">
          <button onClick={onExit} className="btn btn-primary w-full py-3 text-[0.92rem]">
            Nhận thưởng và về trang chính
          </button>
          <button onClick={onRestart} className="btn btn-ghost w-full py-2.5 text-[0.85rem]">
            Chơi lại từ đầu
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-mist px-2 py-2.5">
      <p className="text-[0.62rem] font-bold uppercase tracking-wide text-ink-faint">
        {label}
      </p>
      <p className="mt-0.5 text-[1rem] font-extrabold tabular-nums">{value}</p>
    </div>
  );
}

// ── Hỗ trợ ─────────────────────────────────────────────────────

function fireVictoryConfetti() {
  confetti({
    particleCount: 150,
    spread: 140,
    origin: { x: 0.5, y: 0.35 },
    colors: ["#FF4D9D", "#C05CFF", "#F8F971", "#4FF0C6", "#00DAF3"],
    disableForReducedMotion: true,
  });
  setTimeout(() => {
    confetti({
      particleCount: 100,
      angle: 60,
      spread: 80,
      origin: { x: 0.2, y: 0.5 },
      colors: ["#FF4D9D", "#F8F971"],
      disableForReducedMotion: true,
    });
    confetti({
      particleCount: 100,
      angle: 120,
      spread: 80,
      origin: { x: 0.8, y: 0.5 },
      colors: ["#C05CFF", "#4FF0C6"],
      disableForReducedMotion: true,
    });
  }, 250);
}