/**
 * Thuật toán tạo đáp án sai (distractor) cho câu hỏi trắc nghiệm.
 *
 * Mục tiêu: 3 đáp án sai phải
 *   1. Cùng "loại từ" với đáp án đúng (danh từ ↔ danh từ, động từ ↔ động từ)
 *   2. Đủ gần để gây nhiễu, nhưng KHÔNG trùng nghĩa / đồng nghĩa
 *   3. Ưu tiên các từ có cùng script (hiragana/katakana) để khó phân biệt
 */
import type { StudyItem } from "./types";

// ═══════════════════════════════════════════════════════════════
//  Vietnamese word classification
// ═══════════════════════════════════════════════════════════════

/** Từ loại tiếng Việt dựa trên hậu tố / mẫu phổ biến */
export type WordClass =
  | "noun" // danh từ
  | "verb" // động từ
  | "adj" // tính từ / trạng từ
  | "counter" // số đếm
  | "particle" // trợ từ
  | "other";

/** Đoán word-class từ nghĩa tiếng Việt */
export function classifyVi(meaning: string): WordClass {
  const m = meaning.trim().toLowerCase();

  // Số đếm: dạng "1 cái", "một người", "2 quyển", v.v. và từ rõ ràng
  if (/^\d+/.test(m)) return "counter";
  if (/\b(số|thứ|cái|người|con|quyển|chiếc|tờ|đôi|cặp)\b/.test(m)) {
    // Có thể là counter, nhưng cũng có thể là noun bình thường
    // Ví dụ "1 con mèo" → counter, "con mèo" → noun. Ưu tiên noun.
    if (/^\d+\s+(cái|con|người|quyển|chiếc|tờ|cây|bức|quả|viên|hạt|đôi)\s/.test(m)) {
      return "counter";
    }
  }

  // Trợ từ / tiểu từ: は, を, に, の, が, で — dạng "trợ từ X"
  if (/^(trợ\s*|tiểu\s*|phó\s*|giới\s*)?từ\b/.test(m)) return "particle";
  if (/\b(trợ từ|tiểu từ|phó từ|giới từ|liên từ)\b/.test(m)) return "particle";

  // Tính từ: cả tính từ đơn (1 từ) lẫn cụm
  const adjWords = [
    "đỏ", "xanh", "vàng", "trắng", "đen", "to", "nhỏ", "dài", "ngắn",
    "cao", "thấp", "đẹp", "xấu", "tốt", "mới", "cũ", "nóng", "lạnh",
    "nhanh", "chậm", "rộng", "hẹp", "sâu", "nông", "nặng", "nhẹ",
    "khó", "dễ", "ít", "nhiều", "xa", "gần", "sáng", "tối",
    "vui", "buồn", "giỏi", "hay", "tệ", "quen", "lạ", "quen thuộc",
  ];
  const adjRe = new RegExp(`\\b(${adjWords.join("|")})\\b`);
  // Nếu cả cụm là 1 tính từ đơn, hoặc cụm bắt đầu bằng tính từ
  if (adjWords.includes(m) || adjRe.test(m)) {
    // Phân biệt: nếu là "1 con đỏ" → counter, không phải adj
    if (!/^\d+\s/.test(m)) return "adj";
  }

  // Động từ
  if (/\b(đi|lại|ra|vào|lên|xuống|qua|đến)$/.test(m)) return "verb";
  if (/^(làm|đi|đến|ra|vào|lên|xuống|ăn|uống|ngủ|học|chơi|làm việc|mua|bán|đọc|viết|nói|nghe|xem|chạy|nhảy|mở|đóng)\b/.test(m))
    return "verb";

  // Mặc định: danh từ
  return "noun";
}

// ═══════════════════════════════════════════════════════════════
//  Độ tương đồng (similarity) giữa 2 chuỗi
// ═══════════════════════════════════════════════════════════════

/** Jaccard similarity trên word-tokens */
export function wordJaccard(a: string, b: string): number {
  const ta = new Set(a.toLowerCase().split(/\s+/).filter(Boolean));
  const tb = new Set(b.toLowerCase().split(/\s+/).filter(Boolean));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  return inter / (ta.size + tb.size - inter);
}

/** Levenshtein distance (edit distance) */
export function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const prev = new Array(n + 1);
  for (let j = 0; j <= n; j++) prev[j] = j;
  for (let i = 1; i <= m; i++) {
    let cur = i;
    let prevDiag = prev[0];
    prev[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = prev[j];
      if (a[i - 1] === b[j - 1]) {
        cur = prevDiag;
      } else {
        cur = 1 + Math.min(prev[j], prev[j - 1], prevDiag);
      }
      prevDiag = tmp;
      prev[j] = cur;
    }
  }
  return prev[n];
}

/** Normalized edit similarity (0 → 1) */
export function editSimilarity(a: string, b: string): number {
  if (!a && !b) return 1;
  const dist = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length);
  return maxLen === 0 ? 1 : 1 - dist / maxLen;
}

/** Char-level bigram Jaccard (bắt lỗi chính tả gần giống) */
export function bigramJaccard(a: string, b: string): number {
  const A = a.toLowerCase().replace(/\s+/g, "");
  const B = b.toLowerCase().replace(/\s+/g, "");
  if (A.length < 2 || B.length < 2) {
    return A === B ? 1 : 0;
  }
  const getBigrams = (s: string) => {
    const out = new Map<string, number>();
    for (let i = 0; i < s.length - 1; i++) {
      const bg = s.slice(i, i + 2);
      out.set(bg, (out.get(bg) ?? 0) + 1);
    }
    return out;
  };
  const aBg = getBigrams(A);
  const bBg = getBigrams(B);
  let inter = 0, union = 0;
  const seen = new Set<string>();
  for (const [k, v] of aBg) {
    const bv = bBg.get(k) ?? 0;
    inter += Math.min(v, bv);
    seen.add(k);
  }
  for (const [k, v] of aBg) union += v;
  for (const [k, v] of bBg) if (!seen.has(k)) union += v;
  return union === 0 ? 0 : inter / union;
}

// ═══════════════════════════════════════════════════════════════
//  Loại bỏ đáp án "trùng / đồng nghĩa" với đáp án đúng
// ═══════════════════════════════════════════════════════════════

/** 2 nghĩa được coi là "gần trùng" nếu giống nhau quá nhiều. */
export function isNearSynonym(a: string, b: string): boolean {
  if (a === b) return true;
  const j = wordJaccard(a, b);
  if (j >= 0.6) return true;
  const e = editSimilarity(a, b);
  if (e >= 0.85) return true;
  return false;
}

// ═══════════════════════════════════════════════════════════════
//  Tính "điểm gây nhiễu" cho mỗi distractor
// ═══════════════════════════════════════════════════════════════

export interface DistractorScore {
  item: StudyItem;
  answer: string;
  /** Có cùng word-class với đáp án đúng không */
  sameClass: boolean;
  /** Độ tương đồng về ý nghĩa (cao → dễ gây nhầm) */
  meaningSimilarity: number;
  /** Độ tương đồng về mặt chữ (cho câu hỏi vi→jp) */
  scriptSimilarity: number;
  /** Tổng điểm — càng cao càng "khó" */
  score: number;
}

/** Có phải kanji / kana không (để áp dụng script similarity) */
function isJapanese(s: string): boolean {
  return /[\u3040-\u30ff\u4e00-\u9fff]/.test(s);
}

/**
 * Tính điểm gây nhiễu.
 * - Cùng loại từ: +0.4
 * - Meaning gần: +0.3 × similarity
 * - Script gần: +0.3 × similarity
 * - Trừ nặng nếu gần trùng nghĩa (≥0.85): -1.0
 */
export function scoreDistractor(
  candidate: StudyItem,
  correctItem: StudyItem,
  candidateAnswer: string,
  correctAnswer: string,
  mode: "meaning" | "japanese",
): DistractorScore {
  const sameClass =
    mode === "meaning"
      ? classifyVi(candidateAnswer) === classifyVi(correctAnswer)
      : true;

  const meaningSimilarity = mode === "meaning" ? wordJaccard(candidateAnswer, correctAnswer) : 0;

  let scriptSimilarity = 0;
  if (mode === "japanese" && isJapanese(candidateAnswer) && isJapanese(correctAnswer)) {
    scriptSimilarity = bigramJaccard(candidateAnswer, correctAnswer);
  }

  let score = 0;
  if (sameClass) score += 0.4;
  if (mode === "meaning") score += 0.3 * meaningSimilarity;
  if (mode === "japanese") score += 0.3 * scriptSimilarity;

  // Phạt nặng nếu gần trùng nghĩa
  if (mode === "meaning" && meaningSimilarity >= 0.85) {
    score -= 1.0;
  }

  return {
    item: candidate,
    answer: candidateAnswer,
    sameClass,
    meaningSimilarity,
    scriptSimilarity,
    score,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Hàm chính: chọn 3 distractor tốt nhất
// ═══════════════════════════════════════════════════════════════

/**
 * Chọn 3 distractor tốt nhất từ `pool` để làm đáp án sai.
 *
 * Ưu tiên:
 *  1. Cùng word-class với đáp án đúng
 *  2. Nghĩa gần nhưng KHÔNG đồng nghĩa
 *  3. Cùng script (cho câu hỏi tiếng Nhật)
 *
 * Nếu pool cạn (< 3) → trả về bao nhiêu có.
 *
 * @param correctItem item đang hỏi
 * @param correctAnswer giá trị đáp án đúng (đã qua answerValueFor)
 * @param pool các item khác trong bộ (toàn bộ từ điển)
 * @param answerFor hàm lấy answer value theo kind
 * @param kind loại câu hỏi
 * @param topN số distractor cần (mặc định 3)
 * @param random RNG (mặc định Math.random)
 */
export function pickSmartDistractors(
  correctItem: StudyItem,
  correctAnswer: string,
  pool: StudyItem[],
  answerFor: (item: StudyItem) => string,
  kind: "meaning" | "japanese",
  topN = 3,
  random: () => number = Math.random,
): StudyItem[] {
  // 1. Lọc pool: bỏ chính item, bỏ trùng answer, bỏ đồng nghĩa
  const valid: StudyItem[] = [];
  for (const p of pool) {
    if (p.id === correctItem.id) continue;
    const a = answerFor(p);
    if (!a) continue;
    if (a === correctAnswer) continue;
    if (kind === "meaning" && isNearSynonym(a, correctAnswer)) continue;
    valid.push(p);
  }

  if (valid.length === 0) return [];

  // 2. Tính điểm cho từng candidate
  const scored: DistractorScore[] = valid.map((p) =>
    scoreDistractor(p, correctItem, answerFor(p), correctAnswer, kind),
  );

  // 3. Sắp xếp theo score giảm dần
  scored.sort((a, b) => b.score - a.score);

  // 4. Lấy top N, nhưng ưu tiên cùng class trước
  const sameClass = scored.filter((s) => s.sameClass);
  const otherClass = scored.filter((s) => !s.sameClass);

  // Lấy 80% từ same-class, 20% từ other để có đa dạng
  const sameClassCount = Math.min(sameClass.length, Math.ceil(topN * 0.8));
  const otherClassCount = Math.min(otherClass.length, topN - sameClassCount);

  // Shuffle trong từng nhóm để tránh cùng thứ tự
  const shuffleInPlace = <T>(arr: T[]) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
  };
  shuffleInPlace(sameClass);
  shuffleInPlace(otherClass);

  return [...sameClass.slice(0, sameClassCount), ...otherClass.slice(0, otherClassCount)].map(
    (s) => s.item,
  );
}
