import type {
  Kanji,
  Question,
  QuestionKind,
  QuizResult,
  StudyItem,
  Vocab,
} from "@/lib/types";
import { jpEquals, normalizeAnswer } from "@/lib/romaji";

// ═══════════════════════════════════════════════════════════════
//  Shuffle helpers (Fisher–Yates, deterministic khi có seed)
// ═══════════════════════════════════════════════════════════════

export function shuffle<T>(arr: T[]): T[] {
  const out = arr.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Lấy `n` phần tử ngẫu nhiên không trùng */
export function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, Math.max(0, n));
}

// ═══════════════════════════════════════════════════════════════
//  Combo → diamond
//  Mỗi câu đúng 10 ♦ × combo multiplier.
 //  Combo đếm số cây đúng liên tiếp; nhân 1 + 0.1 × (combo - 1), cap ×3.
// ═══════════════════════════════════════════════════════════════

export const BASE_PER_CORRECT = 10;
export const COMBO_STEP = 0.1;
export const COMBO_MAX_MULT = 3;

/** Hệ số nhân cho combo hiện tại (combo >= 1) */
export function comboMultiplier(combo: number): number {
  if (combo <= 1) return 1;
  return Math.min(COMBO_MAX_MULT, 1 + COMBO_STEP * (combo - 1));
}

/** Điểm cho một câu trả lời đúng */
export function scoreForCorrect(comboAfterCorrect: number): number {
  return Math.round(BASE_PER_CORRECT * comboMultiplier(comboAfterCorrect));
}

// ═══════════════════════════════════════════════════════════════
//  Dựng câu hỏi
// ═══════════════════════════════════════════════════════════════

/** Chuỗi hiển thị chính của item (tiếng Nhật) */
function isVocab(i: StudyItem): i is Vocab {
  return "romaji" in i;
}
function isKanji(i: StudyItem): i is Kanji {
  return "character" in i;
}

/** Nhãn tiếng Nhật đầy đủ (kanji + kana nếu có) */
export function japaneseText(item: StudyItem): string {
  if (isVocab(item)) {
    if (item.hiragana) return item.hiragana;
    return item.romaji;
  }
  return item.character;
}

/** Cách đọc của item (katakana ưu tiên) */
export function readingText(item: StudyItem): string {
  if (isVocab(item)) return item.katakana || item.hiragana;
  return item.onyomi || item.kunyomi;
}

/** Text dùng làm đáp án khi hỏi "chọn tiếng Nhật" */
function japaneseAnswer(item: StudyItem): string {
  return japaneseText(item);
}

/**
 * Dựng 1 câu hỏi từ item + pool đáp án sai.
 * Tự chọn `kind` phù hợp với item.
 */
export function buildQuestion(
  item: StudyItem,
  pool: StudyItem[],
  forcedKind?: QuestionKind,
): Question | null {
  const kind = forcedKind ?? pickKind(item);
  if (!kind) return null;

  const id = `${kind}:${item.id}`;

  // Chọn 3 đáp án sai khác item
  const wrongPool = pool.filter(
    (p) =>
      p.id !== item.id &&
      answerValueFor(p, kind) !== answerValueFor(item, kind),
  );
  const distractors = sample(wrongPool, 3).map((p) => answerValueFor(p, kind));

  // Nếu pool quá nhỏ, đáp án trùng là chấp nhận được
  const options = shuffle([answerValueFor(item, kind), ...distractors]);

  let prompt = "";
  let promptSub: string | undefined;
  let answer = "";
  let detail: string | undefined;

  if (kind === "jp2vi" || kind === "romaji2vi" || kind === "kanji2vi") {
    prompt = isKanji(item) ? item.character : japaneseAnswer(item);
    if (isVocab(item)) {
      prompt = item.hiragana || item.romaji;
      promptSub = item.romaji !== prompt ? item.romaji : undefined;
    }
    answer = item.meaning_vi;
    detail = detailFor(item);
  } else if (kind === "vi2jp") {
    prompt = item.meaning_vi;
    promptSub = "Chọn từ tiếng Nhật tương ứng";
    answer = japaneseAnswer(item);
    detail = detailFor(item);
  } else if (kind === "vi2kanji") {
    if (!isKanji(item)) return null;
    prompt = item.meaning_vi;
    promptSub = "Chọn kanji tương ứng";
    answer = item.character;
    detail = detailFor(item);
  } else if (kind === "kanji2reading") {
    if (!isKanji(item)) return null;
    const reading = item.onyomi || item.kunyomi;
    if (!reading) return null;
    prompt = item.character;
    promptSub = "Chọn cách đọc";
    answer = reading;
    detail = `${item.onyomi ? `onyomi: ${item.onyomi}` : ""}${
      item.kunyomi ? ` kunyomi: ${item.kunyomi}` : ""
    }`.trim();
  }

  return {
    id,
    kind,
    itemId: item.id,
    itemKind: isKanji(item) ? "kanji" : "vocab",
    prompt,
    promptSub,
    answer,
    options,
    freeInput: false,
    detail,
  };
}

function detailFor(item: StudyItem): string | undefined {
  if ("meaning_vi" in item && "romaji" in item) {
    const parts: string[] = [];
    if (item.romaji) parts.push(item.romaji);
    if (item.katakana && item.katakana !== item.hiragana) parts.push(item.katakana);
    return parts.length ? parts.join(" · ") : undefined;
  }
  if (!("character" in item)) return undefined;
  const parts: string[] = [];
  if (item.onyomi) parts.push(`onyomi ${item.onyomi}`);
  if (item.kunyomi) parts.push(`kunyomi ${item.kunyomi}`);
  if (item.stroke_count) parts.push(`${item.stroke_count} nét`);
  return parts.length ? parts.join(" · ") : undefined;
}

/** Chọn loại câu hỏi ngẫu nhiên nhưng hợp lý với item */
function pickKind(item: StudyItem): QuestionKind | null {
  if (isKanji(item)) {
    const options: QuestionKind[] = ["kanji2vi", "vi2kanji"];
    if (item.onyomi || item.kunyomi) options.push("kanji2reading");
    return options[Math.floor(Math.random() * options.length)];
  }
  const options: QuestionKind[] = ["jp2vi", "vi2jp"];
  return options[Math.floor(Math.random() * options.length)];
}

/** Giá trị dùng cho việc dựng options/so sánh theo `kind` */
function answerValueFor(item: StudyItem, kind: QuestionKind): string {
  if (kind === "jp2vi" || kind === "romaji2vi" || kind === "kanji2vi") {
    return item.meaning_vi;
  }
  if (kind === "vi2jp") return japaneseText(item);
  if (!("character" in item)) return item.meaning_vi;
  if (kind === "vi2kanji") return item.character;
  if (kind === "kanji2reading") return item.onyomi || item.kunyomi;
  return item.meaning_vi;
}

// ═══════════════════════════════════════════════════════════════
//  Dựng cả bộ quiz
// ═══════════════════════════════════════════════════════════════

/**
 * Dựng bộ câu hỏi từ một danh sách item.
 * @param items   các item sẽ xuất hiện trong bài (đã xáo trộn)
 * @param pool    toàn bộ item để lấy đáp án sai
 * @param forcedKind ép buộc loại câu hỏi (vd: chỉ hỏi jp2vi)
 */
export function buildQuiz(
  items: StudyItem[],
  pool: StudyItem[],
  forcedKind?: QuestionKind,
): Question[] {
  const out: Question[] = [];
  for (const item of items) {
    const q = buildQuestion(item, pool, forcedKind);
    if (q) out.push(q);
  }
  return out;
}

/** Tổng hợp kết quả từ danh sách câu trả lời */
export function summarize(
  answers: Array<{ correct: boolean; combo: number; earned: number }>,
): QuizResult {
  const total = answers.length;
  const correct = answers.filter((a) => a.correct).length;
  const diamonds = answers.reduce((s, a) => s + (a.correct ? a.earned : 0), 0);
  const bestCombo = answers.reduce((m, a) => Math.max(m, a.combo), 0);
  return {
    total,
    correct,
    diamonds,
    accuracy: total > 0 ? correct / total : 0,
    bestCombo,
  };
}

// ═══════════════════════════════════════════════════════════════
//  Chấm đáp án
// ═══════════════════════════════════════════════════════════════

/** So khớp đáp án (hỗ trợ tiếng Nhật dài/ngắn) */
export function checkAnswer(input: string, correct: string, kind: QuestionKind): boolean {
  const isJP = kind === "jp2vi" || kind === "vi2jp" || kind === "kanji2reading";
  if (isJP) return jpEquals(input, correct);
  return normalizeAnswer(input) === normalizeAnswer(correct);
}