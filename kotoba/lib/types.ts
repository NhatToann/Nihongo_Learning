// ═══════════════════════════════════════════════════════════════
//  Domain types — dùng chung cho toàn bộ app
// ═══════════════════════════════════════════════════════════════

export type StudyMode =
  | "daily"
  | "review"
  | "lesson"
  | "kanji-daily"
  | "kanji-review"
  | "kanji-lesson";

/** Tab điều hướng chính */
export type Tab = "home" | "learn" | "review" | "kanji" | "stats";

export type ItemKind = "vocab" | "kanji";

/** Bảng `vocab` */
export interface Vocab {
  id: string;
  romaji: string;
  hiragana: string;
  katakana: string;
  meaning_vi: string;
  note: string | null;
  /** 0 = chưa xếp bài, 1..N = bài học */
  lesson_number: number;
  study_date: string;
  created_at?: string;
  updated_at?: string;
}

/** Bảng `kanji` */
export interface Kanji {
  id: string;
  character: string;
  meaning_vi: string;
  onyomi: string;
  kunyomi: string;
  stroke_count: number | null;
  note: string | null;
  lesson_number: number;
  study_date: string;
  created_at?: string;
  updated_at?: string;
}

/** Union cho các chế độ học */
export type StudyItem = Vocab | Kanji;

export interface AppState {
  id: string;
  diamonds: number;
  lifetime_diamonds: number;
  current_streak: number;
  longest_streak: number;
  last_study_date: string | null;
  last_seen_date: string | null;
}

export interface Session {
  id: string;
  app_id: string;
  mode: StudyMode;
  study_date: string;
  total: number;
  correct: number;
  completed: boolean;
  diamonds_earned: number;
  completed_at: string | null;
}

export interface Spin {
  id: string;
  app_id: string;
  kind: "reward" | "penalty";
  mode: string;
  spin_date: string;
  amount: number;
  tier_index: number;
  reversed: boolean;
  created_at: string;
}

export interface GachaTier {
  tier_index: number;
  label: string;
  amount: number;
  probability: number;
  color: string;
}

// ── Quiz ──────────────────────────────────────────────────────────

/**
 * Câu hỏi đã dựng sẵn. `kind` quyết định cách hiển thị:
 *  - `jp2vi`   : hiện tiếng Nhật → chọn nghĩa tiếng Việt
 *  - `vi2jp`   : hiện nghĩa tiếng Việt → chọn tiếng Nhật
 *  - `romaji2vi`: hiện romaji → chọn nghĩa
 *  - `kanji2vi`: hiện kanji → chọn nghĩa
 *  - `vi2kanji`: hiện nghĩa → chọn kanji
 *  - `kanji2reading`: hiện kanji → chọn cách đọc
 */
export type QuestionKind =
  | "jp2vi"
  | "vi2jp"
  | "romaji2vi"
  | "kanji2vi"
  | "vi2kanji"
  | "kanji2reading";

export interface Question {
  id: string;
  kind: QuestionKind;
  itemId: string;
  itemKind: ItemKind;
  /** Nội dung câu hỏi (text hiển thị lớn) */
  prompt: string;
  /** Phụ đề nhỏ dưới câu hỏi, vd: romaji của từ */
  promptSub?: string;
  /** Đáp án đúng */
  answer: string;
  /** 4 lựa chọn (đã xáo trộn, luôn chứa `answer`) */
  options: string[];
  /** Dùng cho chế độ nhập tự do */
  freeInput: boolean;
  /** Gợi ý hiển thị sau khi trả lời */
  detail?: string;
}

export interface QuizResult {
  total: number;
  correct: number;
  /** Điểm đã quy về diamond (đã áp combo) */
  diamonds: number;
  accuracy: number;
  bestCombo: number;
}

// ── Gacha ─────────────────────────────────────────────────────────

export type SpinKind = "reward" | "penalty";

export interface SpinResult {
  tierIndex: number;
  amount: number;
  label: string;
  color: string;
  diamonds: number;
  reversed: boolean;
}