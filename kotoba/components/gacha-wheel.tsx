"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import confetti from "canvas-confetti";
import type { GachaTier, SpinKind } from "@/lib/types";
import { rollTier, tierArcs } from "@/lib/gacha";
import { formatNumber } from "./ui";

// ═══════════════════════════════════════════════════════════════
//  GachaWheel — vòng quay trợ thưởng / phạt
//  Dùng SVG để sắc nét trên mọi màn hình, dễ đổi màu theo tier.
// ═══════════════════════════════════════════════════════════════

interface GachaWheelProps {
  tiers: GachaTier[];
  kind: SpinKind;
  disabled?: boolean;
  /** true nếu hôm nay đã quay rồi */
  alreadySpun: boolean;
  onSpin: (tier: GachaTier) => Promise<void> | void;
}

const SIZE = 300;
const CENTER = SIZE / 2;
const RADIUS = 128;
const SPIN_MS = 4200;

export function GachaWheel({
  tiers,
  kind,
  disabled = false,
  alreadySpun,
  onSpin,
}: GachaWheelProps) {
  const [rotation, setRotation] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<GachaTier | null>(null);
  const [showResult, setShowResult] = useState(false);
  const timerRef = useRef<number | null>(null);

  const isPenalty = kind === "penalty";
  const arcs = tierArcs(tiers);

  useEffect(() => {
    return () => {
      if (timerRef.current) window.clearTimeout(timerRef.current);
    };
  }, []);

  const handleSpin = useCallback(async () => {
    if (spinning || disabled || alreadySpun) return;

    setSpinning(true);
    setShowResult(false);

    // 1) Roll tier trước (client) để animation khớp kết quả
    const tier = rollTier(tiers);

    // 2) Tính góc dừng: kim ở đỉnh (12h = -90deg trong SVG)
    const arc = arcs.find((a) => a.tier.tier_index === tier.tier_index) ?? arcs[0];
    const span = arc.end - arc.start;
    const jitter = Math.random() * span * 0.7;
    const stopMid = arc.start + span * 0.15 + jitter;

    // Góc cuối để kim chạm giữa ô (SVG 0° nằm bên phải, kim ở -90°)
    const targetMod = 360 - stopMid;
    const current = rotation % 360;
    const turns = 6;
    const delta =
      ((targetMod - current + 360) % 360) + 360 * turns;

    // Chiều quay: thưởng = kim đồng hồ, phạt = ngược chiều
    const signedDelta = isPenalty ? -delta : delta;
    const finalRotation = rotation + signedDelta;

    setRotation(finalRotation);

    // 3) Đợi animation xong rồi mới ghi DB
    timerRef.current = window.setTimeout(async () => {
      setSpinning(false);
      setResult(tier);
      setShowResult(true);
      await onSpin(tier);
      fireWheelConfetti(tier, isPenalty);
    }, SPIN_MS);
  }, [spinning, disabled, alreadySpun, tiers, arcs, rotation, isPenalty, onSpin]);

  return (
    <div className="flex flex-col items-center">
      {/* ── Vòng quay ── */}
      <div
        className="relative"
        style={{ width: SIZE, height: SIZE }}
        role="img"
        aria-label={
          alreadySpun
            ? "Đã quay hôm nay"
            : isPenalty
              ? "Vòng quay phạt - bấm để quay"
              : "Vòng quay thưởng - bấm để quay"
        }
      >
        {/* Nền tròn + các ô màu */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="absolute inset-0 -rotate-90"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {/* Vòng ngoài */}
          <circle
            cx={CENTER}
            cy={CENTER}
            r={RADIUS + 8}
            fill="none"
            stroke="url(#wheel-ring)"
            strokeWidth="6"
          />

          {arcs.map(({ tier, start, end }) => {
            const a0 = (start - 90) * (Math.PI / 180);
            const a1 = (end - 90) * (Math.PI / 180);
            const x0 = CENTER + RADIUS * Math.cos(a0);
            const y0 = CENTER + RADIUS * Math.sin(a0);
            const x1 = CENTER + RADIUS * Math.cos(a1);
            const y1 = CENTER + RADIUS * Math.sin(a1);
            const largeArc = end - start > 180 ? 1 : 0;

            return (
              <path
                key={tier.tier_index}
                d={`M ${CENTER} ${CENTER} L ${x0} ${y0} A ${RADIUS} ${RADIUS} 0 ${largeArc} 1 ${x1} ${y1} Z`}
                fill={tier.color}
                opacity={0.92}
              />
            );
          })}

          {/* Đường chia ô */}
          {arcs.map(({ tier, start }) => {
            const a = (start - 90) * (Math.PI / 180);
            return (
              <line
                key={`div-${tier.tier_index}`}
                x1={CENTER}
                y1={CENTER}
                x2={CENTER + RADIUS * Math.cos(a)}
                y2={CENTER + RADIUS * Math.sin(a)}
                stroke="white"
                strokeWidth="1.5"
                opacity="0.85"
              />
            );
          })}

          <defs>
            <linearGradient id="wheel-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#4FF0C6" />
              <stop offset="50%" stopColor="#00DAF3" />
              <stop offset="100%" stopColor="#C1FA87" />
            </linearGradient>
          </defs>
        </svg>

        {/* Nhãn mệnh giá (không xoay theo vòng) */}
        <svg
          width={SIZE}
          height={SIZE}
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          className="pointer-events-none absolute inset-0"
        >
          {arcs.map(({ tier, mid }) => {
            const rad = (mid - 90) * (Math.PI / 180);
            const lr = RADIUS * 0.66;
            const x = CENTER + lr * Math.cos(rad);
            const y = CENTER + lr * Math.sin(rad);
            const rotate = mid - 90;

            // Ô nhỏ thì bỏ số, chỉ giữ chấm
            const tooSmall = tier.probability < 0.02;
            return (
              <g key={`lbl-${tier.tier_index}`}>
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#0B1220"
                  fontSize={tooSmall ? 11 : 13}
                  fontWeight="800"
                  transform={`rotate(${rotate} ${x} ${y})`}
                >
                  {tooSmall ? "★" : tier.label}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Kim chỉ */}
        <motion.div
          className="absolute left-1/2 top-0 z-10 -translate-x-1/2"
          animate={spinning ? { rotate: [0, -12, 10, -6, 3, 0] } : { rotate: 0 }}
          transition={{ duration: 0.25, repeat: spinning ? Infinity : 0 }}
        >
          <div
            className="h-0 w-0 border-x-[9px] border-t-[22px] border-x-transparent"
            style={{
              borderTopColor: isPenalty ? "#FF4D6D" : "#0B1220",
              filter: "drop-shadow(0 2px 4px rgba(0,0,0,.25))",
            }}
          />
        </motion.div>

        {/* Nút ở giữa */}
        <button
          type="button"
          onClick={handleSpin}
          disabled={disabled || spinning || alreadySpun}
          className={`absolute left-1/2 top-1/2 z-20 -translate-x-1/2 -translate-y-1/2 rounded-full font-extrabold transition-all disabled:cursor-not-allowed ${
            isPenalty
              ? "size-[86px] bg-gradient-to-br from-red-500 to-red-700 text-white shadow-[0_10px_28px_-8px_rgba(220,38,60,.8)]"
              : "size-[86px] bg-gradient-to-br from-mint to-lime text-ink shadow-glow-mint"
          } ${spinning ? "animate-pulse" : "hover:scale-105 active:scale-95"}`}
          style={{ transitionDuration: "0.16s" }}
        >
          <span className="block text-[0.62rem] font-bold uppercase tracking-wider">
            {alreadySpun ? "Đã quay" : spinning ? "..." : isPenalty ? "Quay" : "Quay"}
          </span>
          <span className="block text-[1.05rem] font-black leading-tight">
            {spinning ? "⏳" : alreadySpun ? "✓" : "💎"}
          </span>
        </button>
      </div>

      {/* ── Chú thích ── */}
      <p className="mt-4 text-center text-[0.78rem] font-semibold text-ink-soft">
        {isPenalty ? (
          alreadySpun ? (
            "Đã quay phạt hôm nay."
          ) : (
            "Bạn bỏ học 1 ngày — quay ngược để nhận phạt."
          )
        ) : alreadySpun ? (
          "Đã quay thưởng hôm nay."
        ) : (
          "Hoàn thành bài hôm nay để mở vòng thưởng."
        )}
      </p>

      {/* ── Kết quả ── */}
      <AnimatePresence>
        {showResult && result && (
          <motion.div
            initial={{ opacity: 0, scale: 0.85, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ type: "spring", stiffness: 340, damping: 20 }}
            className="pop-in mt-5 w-full rounded-lg px-5 py-4 text-center"
            style={{
              background: isPenalty
                ? "linear-gradient(135deg, #FFF1F2, #FFE4E6)"
                : `linear-gradient(135deg, ${result.color}44, white)`,
              border: `1.5px solid ${isPenalty ? "#FCA5A5" : result.color}`,
            }}
          >
            <p className="text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-soft">
              {isPenalty ? "Bị trừ" : "Bạn nhận được"}
            </p>
            <p
              className={`mt-1 text-[2rem] font-black leading-none tabular-nums ${
                isPenalty ? "text-red-600" : "text-ink"
              }`}
            >
              {isPenalty ? "−" : "+"}
              {formatNumber(result.amount)}
            </p>
            <p className="mt-1 text-[0.75rem] font-semibold text-ink-soft">
              💎 diamond
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Confetti khi trúng ───────────────────────────────────────────

function fireWheelConfetti(tier: GachaTier, isPenalty: boolean) {
  if (isPenalty) {
    confetti({
      particleCount: 40,
      spread: 100,
      startVelocity: 20,
      origin: { x: 0.5, y: 0.4 },
      colors: ["#FF4D6D", "#FF8FA3", "#FFB3C0"],
      disableForReducedMotion: true,
    });
    return;
  }

  // Mệnh càng lớn càng pháo nhiều
  const rarity = tier.probability;
  const big = rarity <= 0.006;
  const mid = rarity <= 0.02;

  confetti({
    particleCount: big ? 160 : mid ? 90 : 45,
    spread: big ? 140 : 90,
    startVelocity: big ? 46 : 30,
    origin: { x: 0.5, y: 0.4 },
    colors: [tier.color, "#4FF0C6", "#00DAF3", "#C1FA87", "#F8F971"],
    disableForReducedMotion: true,
  });

  if (big) {
    setTimeout(() => {
      confetti({
        particleCount: 90,
        angle: 60,
        spread: 70,
        origin: { x: 0.2, y: 0.5 },
        colors: ["#C05CFF", "#FF4D9D", "#F8F971"],
        disableForReducedMotion: true,
      });
      confetti({
        particleCount: 90,
        angle: 120,
        spread: 70,
        origin: { x: 0.8, y: 0.5 },
        colors: ["#7C6CFF", "#FF4D9D", "#F8F971"],
        disableForReducedMotion: true,
      });
    }, 260);
  }
}