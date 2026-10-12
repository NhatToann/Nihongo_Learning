"use client";

import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { useEffect, useState } from "react";
import type { GachaTier, QuizResult, SpinKind } from "@/lib/types";
import { GachaWheel } from "./gacha-wheel";
import { formatNumber } from "./ui";

// ═══════════════════════════════════════════════════════════════
//  Màn hình sau khi hoàn thành bài
//  Hiện điểm + mở vòng quay thưởng (hoặc phạt nếu bỏ ngày).
// ═══════════════════════════════════════════════════════════════

export interface ResultScreenProps {
  result: QuizResult;
  tiers: GachaTier[];
  /** Vòng thưởng đã quay hôm nay chưa */
  rewardSpun: boolean;
  /** Vòng phạt (do bỏ ngày) đã quay chưa */
  penaltySpun: boolean;
  /** Có ngày bỏ nào cần phạt không */
  penaltyAvailable: boolean;
  streak: number;
  onSpinDone: (kind: SpinKind) => Promise<void>;
  /** Ghi lại tier đã roll để app lưu DB sau khi quay */
  onTierRoll: (tier: GachaTier) => void;
  onRetry: () => void;
  onHome: () => void;
}

type WheelKind = "reward" | "penalty" | null;

export function ResultScreen({
  result,
  tiers,
  rewardSpun,
  penaltySpun,
  penaltyAvailable,
  streak,
  onSpinDone,
  onTierRoll,
  onRetry,
  onHome,
}: ResultScreenProps) {
  const [wheel, setWheel] = useState<WheelKind>(null);
  const accuracy = result.accuracy;
  const perfect = result.total > 0 && result.correct === result.total;

  // Pháo giấy khi đạt 100%
  useEffect(() => {
    if (perfect) {
      setTimeout(() => {
        confetti({
          particleCount: 140,
          spread: 130,
          origin: { x: 0.5, y: 0.4 },
          colors: ["#4FF0C6", "#00DAF3", "#C1FA87", "#F8F971"],
          disableForReducedMotion: true,
        });
      }, 320);
    }
  }, [perfect]);

  const canReward = accuracy >= 0.8 && !rewardSpun && result.total > 0;

  return (
    <div className="flex min-h-[78dvh] flex-col">
      {/* ── Tiêu đề ── */}
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 20 }}
        className="pt-6 text-center"
      >
        <p className="text-[0.74rem] font-bold uppercase tracking-[0.18em] text-ink-faint">
          {perfect ? "Hoàn hảo!" : "Hoàn thành"}
        </p>
        <h2 className="text-rainbow mt-1.5 text-[2.6rem] font-black leading-none">
          {result.correct}/{result.total}
        </h2>
      </motion.div>

      {/* ── Thẻ thống kê ── */}
      <div className="mt-6 grid grid-cols-3 gap-2.5">
        <StatCard label="Chính xác" value={`${Math.round(accuracy * 100)}%`} accent="#00DAF3" />
        <StatCard label="Combo cao nhất" value={`×${result.bestCombo}`} accent="#C1FA87" />
        <StatCard
          label="Diamond"
          value={formatNumber(result.diamonds)}
          accent="#4FF0C6"
        />
      </div>

      {/* ── Vòng quay ── */}
      {wheel === null && (
        <div className="mt-7 flex flex-1 flex-col justify-center gap-3">
          {canReward ? (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              onClick={() => setWheel("reward")}
              className="btn btn-primary w-full py-4 text-[1rem]"
            >
              <span>🎡</span>
              Quay thưởng hôm nay
            </motion.button>
          ) : rewardSpun ? (
            <InfoLine tone="muted" text="Bạn đã quay thưởng hôm nay rồi." />
          ) : accuracy < 0.8 ? (
            <InfoLine
              tone="warn"
              text={`Cần đạt 80% chính xác để mở vòng thưởng (bạn đang ${Math.round(accuracy * 100)}%).`}
            />
          ) : null}

          {penaltyAvailable && !penaltySpun ? (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.22 }}
              onClick={() => setWheel("penalty")}
              className="btn w-full py-4 text-[1rem]"
              style={{
                background: "linear-gradient(135deg, #FFF1F2, #FFE4E6)",
                color: "#B91C1C",
                border: "1.5px solid #FCA5A5",
                boxShadow: "0 10px 28px -8px rgba(220,38,60,.25)",
              }}
            >
              <span>⚠️</span>
              Bạn bỏ học — nhận vòng phạt
            </motion.button>
          ) : null}

          {streak > 0 && (
            <p className="text-center text-[0.82rem] font-bold text-ink-soft">
              🔥 Chuỗi học: <span className="text-ink">{streak} ngày</span>
            </p>
          )}
        </div>
      )}

      {/* ── Nội dung vòng quay ── */}
      {wheel !== null && (
        <div className="mt-4 flex-1">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
            <p className="mb-3 text-center text-[0.82rem] font-extrabold text-ink-soft">
              {wheel === "reward"
                ? "Vòng thưởng hôm nay"
                : "Vòng phạt — quay ngược chiều kim đồng hồ"}
            </p>

            <GachaWheel
              tiers={tiers}
              kind={wheel}
              alreadySpun={wheel === "reward" ? rewardSpun : penaltySpun}
              onSpin={async (tier) => {
                onTierRoll(tier);
                await onSpinDone(wheel);
              }}
            />

            <button
              onClick={() => setWheel(null)}
              className="btn btn-ghost mt-5 w-full py-3 text-[0.84rem]"
            >
              ← Quay lại kết quả
            </button>
          </motion.div>
        </div>
      )}

      {/* ── Nút cuối ── */}
      {wheel === null && (
        <div className="mt-5 space-y-2.5">
          <button onClick={onRetry} className="btn btn-cyan w-full py-4 text-[0.94rem]">
            Học lại bộ này
          </button>
          <button onClick={onHome} className="btn btn-ghost w-full py-3.5 text-[0.88rem]">
            Về trang chính
          </button>
        </div>
      )}
    </div>
  );
}

// ── Thẻ thống kê nhỏ ─────────────────────────────────────────────

function StatCard({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <div
      className="clay relative overflow-hidden p-3 text-center"
      style={{
        background: `linear-gradient(160deg, ${accent}1A 0%, white 70%)`,
      }}
    >
      <div
        className="absolute inset-x-2 top-0 h-1 rounded-full"
        style={{ background: `linear-gradient(90deg, ${accent}, ${accent}44)` }}
      />
      <p className="text-[0.66rem] font-bold uppercase tracking-[0.1em] text-ink-faint">
        {label}
      </p>
      <p className="mt-1.5 text-[1.3rem] font-black leading-none tabular-nums">
        {value}
      </p>
    </div>
  );
}

function InfoLine({ text, tone }: { text: string; tone: "muted" | "warn" }) {
  return (
    <p
      className={`rounded-sm px-4 py-3 text-center text-[0.82rem] font-semibold ${
        tone === "warn"
          ? "bg-sun/25 text-ink"
          : "bg-mist text-ink-soft"
      }`}
    >
      {text}
    </p>
  );
}