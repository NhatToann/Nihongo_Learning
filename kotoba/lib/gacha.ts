import type { GachaTier, SpinKind } from "@/lib/types";

// ═══════════════════════════════════════════════════════════════
//  Bảng tỉ lệ gacha
//  Giảm dần theo mệnh giá. Mệnh lớn nhất = 0.6% (< 1%).
//  Tổng = 100%. Đổi được trong Supabase (bảng `gacha_tiers`).
// ═══════════════════════════════════════════════════════════════

export const DEFAULT_TIERS: GachaTier[] = [
  { tier_index: 0, label: "2.000", amount: 2000, probability: 0.44, color: "#C1FA87" },
  { tier_index: 1, label: "5.000", amount: 5000, probability: 0.25, color: "#8AF7A6" },
  { tier_index: 2, label: "10.000", amount: 10000, probability: 0.15, color: "#4FF0C6" },
  { tier_index: 3, label: "20.000", amount: 20000, probability: 0.08, color: "#00DAF3" },
  { tier_index: 4, label: "50.000", amount: 50000, probability: 0.04, color: "#2EA8FF" },
  { tier_index: 5, label: "100.000", amount: 100000, probability: 0.02, color: "#7C6CFF" },
  { tier_index: 6, label: "200.000", amount: 200000, probability: 0.014, color: "#C05CFF" },
  { tier_index: 7, label: "500.000", amount: 500000, probability: 0.006, color: "#FF4D9D" },
];

/** Chuẩn hoá tỉ lệ về tổng = 1 (phòng khi DB có sai lệch) */
export function normalizeTiers(tiers: GachaTier[]): GachaTier[] {
  const sum = tiers.reduce((s, t) => s + t.probability, 0);
  if (sum <= 0) return DEFAULT_TIERS;
  if (Math.abs(sum - 1) < 1e-9) return tiers;
  return tiers.map((t) => ({ ...t, probability: t.probability / sum }));
}

/** Đoạn tròn (arc) của mỗi ô trên vòng quay, theo % góc */
export function tierArcs(tiers: GachaTier[]): Array<{
  tier: GachaTier;
  start: number;
  end: number;
  mid: number;
}> {
  const norm = normalizeTiers(tiers);
  let acc = 0;
  return norm.map((tier) => {
    const start = acc * 360;
    acc += tier.probability;
    const end = acc * 360;
    return { tier, start, end, mid: (start + end) / 2 };
  });
}

/** Chọn 1 tier theo tỉ lệ */
export function rollTier(tiers: GachaTier[]): GachaTier {
  const norm = normalizeTiers(tiers);
  const r = Math.random();
  let acc = 0;
  for (const t of norm) {
    acc += t.probability;
    if (r < acc) return t;
  }
  return norm[norm.length - 1];
}

/**
 * Tính góc dừng của kim để trúng `tier`.
 * @param reversed true = quay ngược chiều kim đồng hồ (mode phạt)
 */
export function targetAngle(
  tiers: GachaTier[],
  tierIndex: number,
  reversed: boolean,
): number {
  const arcs = tierArcs(tiers);
  const arc = arcs.find((a) => a.tier.tier_index === tierIndex) ?? arcs[0];

  // Offset ngẫu nhiên bên trong ô để trông tự nhiên
  const span = arc.end - arc.start;
  const jitter = Math.random() * (span * 0.75);
  const midAngle = arc.start + span * 0.125 + jitter;

  // Quay đủ nhiều vòng cho hào hứng
  const turns = reversed ? 6 : 6;
  const base = 360 * turns;

  // Với chiều kim đồng hồ: kim ở góc 0 (12 giờ) -> cần xoay tới arc
  // Với chiều ngược: xoay âm
  if (!reversed) {
    return base + (360 - midAngle);
  }
  return base + (360 - (360 - midAngle));
}

/**
 * Quyết định hướng quay.
 * Thường (ngày học đủ chuỗi): chiều kim đồng hồ → CỘNG diamond.
 * Ngày bỏ học: chiều ngược → TRỪ diamond.
 */
export function shouldReverse(kind: SpinKind): boolean {
  return kind === "penalty";
}

// ═══════════════════════════════════════════════════════════════
//  Điều kiện mở vòng quay
// ═══════════════════════════════════════════════════════════════

/** Ngưỡng đạt để mở vòng thưởng */
export const REWARD_ACCURACY = 0.8;

export function qualifiesForReward(accuracy: number, total: number): boolean {
  return total > 0 && accuracy >= REWARD_ACCURACY;
}

// ═══════════════════════════════════════════════════════════════
//  Streak → hệ số may mắn (cảm giác "may hơn khi học nhiều")
//  Không thay đổi tỉ lệ gốc; chỉ là hiệu ứng trình bày.
// ═══════════════════════════════════════════════════════════════

export function luckLabel(streak: number): string {
  if (streak >= 30) return "KHỔNG LỒ";
  if (streak >= 14) return "TÀI LỘC CAO";
  if (streak >= 7) return "KHÁ";
  if (streak >= 3) return "ĐANG NÓNG";
  if (streak >= 1) return "KHỞI ĐỘNG";
  return "CHƯA BẮT ĐẦU";
}

// ═══════════════════════════════════════════════════════════════
//  Thống kê mong đợi
// ═══════════════════════════════════════════════════════════════

/** Giá trị kỳ vọng của 1 lần quay */
export function expectedValue(tiers: GachaTier[]): number {
  const norm = normalizeTiers(tiers);
  return norm.reduce((s, t) => s + t.amount * t.probability, 0);
}