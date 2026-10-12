import { getSupabase, APP_ID, todayVN } from "./client";
import type {
  AppState,
  GachaTier,
  Kanji,
  Session,
  Spin,
  StudyMode,
  Vocab,
} from "@/lib/types";

// ═══════════════════════════════════════════════════════════════
//  app_state — ví diamond + streak
// ═══════════════════════════════════════════════════════════════

/** Đảm bảo hàng app_state tồn tại (tự tạo nếu chưa có) */
export async function ensureAppState(): Promise<AppState> {
  const sb = getSupabase();

  const { data, error } = await sb
    .from("app_state")
    .select("*")
    .eq("id", APP_ID)
    .maybeSingle();

  if (error) throw new Error(`ensureAppState: ${error.message}`);
  if (data) return data as AppState;

  const { data: created, error: insErr } = await sb
    .from("app_state")
    .insert({ id: APP_ID })
    .select("*")
    .single();

  if (insErr) {
    // Race: request song song đã tạo trước -> đọc lại
    const { data: retry } = await sb
      .from("app_state")
      .select("*")
      .eq("id", APP_ID)
      .single();
    if (retry) return retry as AppState;
    throw new Error(`ensureAppState insert: ${insErr.message}`);
  }
  return created as AppState;
}

export async function getAppState(): Promise<AppState | null> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("app_state")
    .select("*")
    .eq("id", APP_ID)
    .maybeSingle();
  if (error) throw new Error(`getAppState: ${error.message}`);
  return (data as AppState) ?? null;
}

/** Gọi RPC touch_day → trả về số ngày đã bỏ học */
export async function touchDay(date = todayVN()): Promise<number> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("touch_day", {
    p_app_id: APP_ID,
    p_date: date,
  });
  if (error) throw new Error(`touchDay: ${error.message}`);
  return Number(data ?? 0);
}

// ═══════════════════════════════════════════════════════════════
//  vocab
// ═══════════════════════════════════════════════════════════════

export interface NewVocab {
  romaji: string;
  hiragana: string;
  katakana: string;
  meaning_vi: string;
  note?: string | null;
  lesson_number?: number;
  study_date?: string;
}

export async function insertVocab(rows: NewVocab[]): Promise<Vocab[]> {
  if (rows.length === 0) return [];
  const sb = getSupabase();
  const fullPayload = rows.map((r) => ({
    romaji: r.romaji,
    hiragana: r.hiragana,
    katakana: r.katakana,
    meaning_vi: r.meaning_vi,
    note: r.note ?? null,
    lesson_number: r.lesson_number ?? 0,
    study_date: r.study_date ?? todayVN(),
  }));

  // Thử insert đầy đủ trước
  let { data, error } = await sb.from("vocab").insert(fullPayload).select();
  if (error && /lesson_number|schema cache|does not exist/i.test(error.message)) {
    // Schema cache chưa refresh → thử lại không truyền lesson_number
    // (cột đã có trong DB với default 0, PostgREST chỉ thiếu cache)
    const fallback = rows.map((r) => ({
      romaji: r.romaji,
      hiragana: r.hiragana,
      katakana: r.katakana,
      meaning_vi: r.meaning_vi,
      note: r.note ?? null,
      study_date: r.study_date ?? todayVN(),
    }));
    const res2 = await sb.from("vocab").insert(fallback).select();
    data = res2.data;
    error = res2.error;
    if (!error && data) {
      // Gán lesson_number thủ công sau (khi cột tồn tại)
      // Đợi 1 lần query update nếu cần; bỏ qua vì default = 0
      // Người dùng có thể gán bài sau bằng nút "Tạo bài N+1"
    }
  }
  if (error) throw new Error(`insertVocab: ${error.message}`);
  return (data ?? []) as Vocab[];
}

// ═══════════════════════════════════════════════════════════════
//  Dedupe — chống trùng từ khi nhập hàng loạt
// ═══════════════════════════════════════════════════════════════

/** Chuẩn hoá key để so trùng: bỏ whitespace, lowercase, bỏ dấu */
export function dedupeKey(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "") // bỏ dấu thanh tiếng Việt
    .replace(/\s+/g, "");
}

/** So 2 từ có coi là trùng không. */
export function isVocabDuplicate(a: NewVocab, b: Vocab): boolean {
  // Ưu tiên so romaji (canonical), fallback hiragana/katakana
  const ra = dedupeKey(a.romaji);
  const rb = dedupeKey(b.romaji);
  if (ra && rb && ra === rb) return true;
  const ha = dedupeKey(a.hiragana);
  const hb = dedupeKey(b.hiragana);
  if (ha && hb && ha === hb) return true;
  const ka = dedupeKey(a.katakana);
  const kb = dedupeKey(b.katakana);
  if (ka && kb && ka === kb) return true;
  return false;
}

/** Lọc trùng trong tập rows (so sánh nội bộ trước khi đụng DB) */
export function dedupeVocabWithin(rows: NewVocab[]): {
  unique: NewVocab[];
  duplicates: Array<{ kept: NewVocab; dropped: NewVocab }>;
} {
  const seen: NewVocab[] = [];
  const duplicates: Array<{ kept: NewVocab; dropped: NewVocab }> = [];
  for (const r of rows) {
    const dup = seen.find((s) => isVocabDuplicate(s, r as Vocab));
    if (dup) {
      duplicates.push({ kept: dup, dropped: r });
    } else {
      seen.push(r);
    }
  }
  return { unique: seen, duplicates };
}

/** Lọc trùng so với DB — giữ lại từ chưa có */
export async function filterVocabAgainstDB(
  rows: NewVocab[],
): Promise<{ unique: NewVocab[]; duplicates: Array<{ incoming: NewVocab; existing: Vocab }> }> {
  if (rows.length === 0) return { unique: [], duplicates: [] };
  const sb = getSupabase();
  // Lấy tất cả romaji + hiragana + katakana đang có (chỉ cần 3 cột này)
  const { data: existing, error } = await sb
    .from("vocab")
    .select("id, romaji, hiragana, katakana, meaning_vi, lesson_number, study_date, created_at");
  if (error) {
    // Lỗi → trả về nguyên (không chặn user)
    return { unique: rows, duplicates: [] };
  }
  const list = (existing ?? []) as Vocab[];
  const unique: NewVocab[] = [];
  const duplicates: Array<{ incoming: NewVocab; existing: Vocab }> = [];
  for (const r of rows) {
    const dup = list.find((b) => isVocabDuplicate(r, b));
    if (dup) duplicates.push({ incoming: r, existing: dup });
    else unique.push(r);
  }
  return { unique, duplicates };
}

export async function getVocabByDate(date: string): Promise<Vocab[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("vocab")
    .select("*")
    .eq("study_date", date)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getVocabByDate: ${error.message}`);
  return (data ?? []) as Vocab[];
}

export async function getAllVocab(): Promise<Vocab[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("vocab")
    .select("*")
    .order("study_date", { ascending: false });
  if (error) throw new Error(`getAllVocab: ${error.message}`);
  return (data ?? []) as Vocab[];
}

/** Tất cả từ trong 1 bài (lesson_number = N) */
export async function getVocabByLesson(lesson: number): Promise<Vocab[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("vocab")
    .select("*")
    .eq("lesson_number", lesson)
    .order("created_at", { ascending: true });
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(`getVocabByLesson: ${error.message}`);
  }
  return (data ?? []) as Vocab[];
}

/** Thống kê lesson: { 1: 6, 2: 10, ... } (loại bỏ lesson = 0) */
export async function getLessonStats(
  kind: "vocab" | "kanji",
): Promise<Record<number, number>> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from(kind)
    .select("lesson_number")
    .gt("lesson_number", 0);
  if (error) {
    // Cột chưa có (migration chưa chạy) → trả rỗng, không crash
    if (error.message.includes("does not exist")) return {};
    throw new Error(`getLessonStats(${kind}): ${error.message}`);
  }
  const out: Record<number, number> = {};
  for (const row of data ?? []) {
    const n = (row as { lesson_number: number }).lesson_number;
    out[n] = (out[n] ?? 0) + 1;
  }
  return out;
}

export async function deleteVocab(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("vocab").delete().eq("id", id);
  if (error) throw new Error(`deleteVocab: ${error.message}`);
}

export async function updateVocab(
  id: string,
  patch: Partial<NewVocab>,
): Promise<void> {
  const sb = getSupabase();
  let { error } = await sb
    .from("vocab")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error && /lesson_number|schema cache|does not exist/i.test(error.message)) {
    // Retry không kèm lesson_number
    const { lesson_number: _omit, ...rest } = patch;
    const res = await sb
      .from("vocab")
      .update({ ...rest, updated_at: new Date().toISOString() })
      .eq("id", id);
    error = res.error;
  }
  if (error) throw new Error(`updateVocab: ${error.message}`);
}

/**
 * Tạo bài mới: gán tất cả item chưa xếp bài (lesson_number = 0) sang bài `to`.
 * Gọi RPC create_lesson phía Postgres — tự động thêm cột lesson_number nếu thiếu.
 * Trả về số item đã gán (vocab + kanji).
 * Nếu cả RPC + REST đều fail → ném lỗi kèm hướng dẫn migration.
 */
export async function bulkAssignLesson(
  _kind: "vocab" | "kanji",
  to: number,
): Promise<number> {
  const sb = getSupabase();

  // Thử RPC trước (tự tạo cột + gán)
  const { data, error } = await sb.rpc("create_lesson", { p_lesson: to });
  if (!error) {
    const r = data as { moved_vocab?: number; moved_kanji?: number } | null;
    return (r?.moved_vocab ?? 0) + (r?.moved_kanji ?? 0);
  }

  // RPC fail → thử REST update trực tiếp (khi cột đã tồn tại nhưng cache chưa reload)
  const [vResult, kResult] = await Promise.all([
    sb
      .from("vocab")
      .update({ lesson_number: to, updated_at: new Date().toISOString() })
      .eq("lesson_number", 0),
    sb
      .from("kanji")
      .update({ lesson_number: to, updated_at: new Date().toISOString() })
      .eq("lesson_number", 0),
  ]);

  if (vResult.error || kResult.error) {
    // Lỗi này có thể do cột chưa tồn tại trong DB.
    // Bất kể lỗi gì, user cần chạy migration.
    throw new Error(
      "Migration chưa được chạy. Vui lòng chạy SQL migration trong Supabase Dashboard → SQL Editor.",
    );
  }

  // Sau đây TypeScript biết không có error → count từ update result
  // update().eq() trả data: T[] | null
  const vData = ((vResult.data as unknown) as Array<unknown>) ?? [];
  const kData = ((kResult.data as unknown) as Array<unknown>) ?? [];
  return vData.length + kData.length;
}

/** Thống kê nhanh: tổng số từ + số từ hôm nay */
export async function getVocabStats(): Promise<{
  total: number;
  today: number;
}> {
  const sb = getSupabase();
  const today = todayVN();
  const [{ count: total }, { count: todayCount }] = await Promise.all([
    sb.from("vocab").select("*", { count: "exact", head: true }),
    sb
      .from("vocab")
      .select("*", { count: "exact", head: true })
      .eq("study_date", today),
  ]);
  return { total: total ?? 0, today: todayCount ?? 0 };
}

// ═══════════════════════════════════════════════════════════════
//  kanji
// ═══════════════════════════════════════════════════════════════

export interface NewKanji {
  character: string;
  meaning_vi: string;
  onyomi?: string;
  kunyomi?: string;
  stroke_count?: number | null;
  note?: string | null;
  lesson_number?: number;
  study_date?: string;
}

/** Lọc trùng kanji trong chính tập rows (so sánh character). */
export function dedupeKanjiWithin(rows: NewKanji[]): {
  unique: NewKanji[];
  duplicates: Array<{ kept: NewKanji; dropped: NewKanji }>;
} {
  const seen = new Map<string, NewKanji>();
  const duplicates: Array<{ kept: NewKanji; dropped: NewKanji }> = [];
  for (const r of rows) {
    const key = r.character.trim();
    if (!key) continue;
    if (seen.has(key)) {
      duplicates.push({ kept: seen.get(key)!, dropped: r });
    } else {
      seen.set(key, r);
    }
  }
  return { unique: Array.from(seen.values()), duplicates };
}

/** Lọc trùng kanji so với DB theo `character` (đã unique trong schema). */
export async function filterKanjiAgainstDB(
  rows: NewKanji[],
): Promise<{ unique: NewKanji[]; duplicates: Array<{ incoming: NewKanji; existing: Kanji }> }> {
  if (rows.length === 0) return { unique: [], duplicates: [] };
  const sb = getSupabase();
  const { data: existing, error } = await sb
    .from("kanji")
    .select("id, character, meaning_vi, onyomi, kunyomi, stroke_count, note, lesson_number, study_date, created_at");
  if (error) return { unique: rows, duplicates: [] };
  const list = (existing ?? []) as Kanji[];
  const existingSet = new Set(list.map((k) => k.character.trim()));
  const unique = rows.filter((r) => !existingSet.has(r.character.trim()));
  const duplicates = rows
    .filter((r) => existingSet.has(r.character.trim()))
    .map((r) => ({ incoming: r, existing: list.find((k) => k.character.trim() === r.character.trim())! }));
  return { unique, duplicates };
}

export async function insertKanji(rows: NewKanji[]): Promise<Kanji[]> {
  if (rows.length === 0) return [];
  const sb = getSupabase();

  // Lọc trùng character trong chính payload trước
  const seen = new Set<string>();
  const unique = rows.filter((r) => {
    const key = r.character.trim();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const payload = unique.map((r) => ({
    character: r.character.trim(),
    meaning_vi: r.meaning_vi,
    onyomi: r.onyomi ?? "",
    kunyomi: r.kunyomi ?? "",
    stroke_count: r.stroke_count ?? null,
    note: r.note ?? null,
    lesson_number: r.lesson_number ?? 0,
    study_date: r.study_date ?? todayVN(),
  }));

  let { data, error } = await sb.from("kanji").insert(payload).select();
  if (error && /lesson_number|schema cache|does not exist/i.test(error.message)) {
    const fallback = unique.map((r) => ({
      character: r.character.trim(),
      meaning_vi: r.meaning_vi,
      onyomi: r.onyomi ?? "",
      kunyomi: r.kunyomi ?? "",
      stroke_count: r.stroke_count ?? null,
      note: r.note ?? null,
      study_date: r.study_date ?? todayVN(),
    }));
    const res2 = await sb.from("kanji").insert(fallback).select();
    data = res2.data;
    error = res2.error;
  }
  if (error) throw new Error(`insertKanji: ${error.message}`);
  return (data ?? []) as Kanji[];
}

export async function getKanjiByDate(date: string): Promise<Kanji[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("kanji")
    .select("*")
    .eq("study_date", date)
    .order("created_at", { ascending: true });
  if (error) throw new Error(`getKanjiByDate: ${error.message}`);
  return (data ?? []) as Kanji[];
}

export async function getAllKanji(): Promise<Kanji[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("kanji")
    .select("*")
    .order("study_date", { ascending: false });
  if (error) throw new Error(`getAllKanji: ${error.message}`);
  return (data ?? []) as Kanji[];
}

/** Tất cả kanji trong 1 bài */
export async function getKanjiByLesson(lesson: number): Promise<Kanji[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("kanji")
    .select("*")
    .eq("lesson_number", lesson)
    .order("created_at", { ascending: true });
  if (error) {
    if (error.message.includes("does not exist")) return [];
    throw new Error(`getKanjiByLesson: ${error.message}`);
  }
  return (data ?? []) as Kanji[];
}

export async function deleteKanji(id: string): Promise<void> {
  const sb = getSupabase();
  const { error } = await sb.from("kanji").delete().eq("id", id);
  if (error) throw new Error(`deleteKanji: ${error.message}`);
}

export async function getKanjiStats(): Promise<{ total: number; today: number }> {
  const sb = getSupabase();
  const today = todayVN();
  const [{ count: total }, { count: todayCount }] = await Promise.all([
    sb.from("kanji").select("*", { count: "exact", head: true }),
    sb
      .from("kanji")
      .select("*", { count: "exact", head: true })
      .eq("study_date", today),
  ]);
  return { total: total ?? 0, today: todayCount ?? 0 };
}

// ═══════════════════════════════════════════════════════════════
//  sessions
// ═══════════════════════════════════════════════════════════════

export interface CompletedSession {
  id: string;
  completed: boolean;
  correct: number;
  total: number;
  diamonds_earned: number;
}

/** Tất cả phiên của hôm nay */
export async function getTodaySessions(date = todayVN()): Promise<Session[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("sessions")
    .select("*")
    .eq("app_id", APP_ID)
    .eq("study_date", date);
  if (error) throw new Error(`getTodaySessions: ${error.message}`);
  return (data ?? []) as Session[];
}

/** Tạo (hoặc lấy) phiên cho mode hôm nay. Trả về id + đã hoàn thành chưa */
export async function startSession(
  mode: StudyMode,
  date = todayVN(),
): Promise<{ id: string; completed: boolean; total: number; correct: number }> {
  const sb = getSupabase();
  const { data: id, error } = await sb.rpc("start_session", {
    p_app_id: APP_ID,
    p_mode: mode,
    p_date: date,
  });

  if (error) throw new Error(`startSession: ${error.message}`);

  // id null = đã tồn tại (do unique constraint)
  const sessionId = id ?? null;
  if (sessionId) {
    return { id: sessionId, completed: false, total: 0, correct: 0 };
  }

  const { data: existing, error: readErr } = await sb
    .from("sessions")
    .select("*")
    .eq("app_id", APP_ID)
    .eq("mode", mode)
    .eq("study_date", date)
    .single();

  if (readErr || !existing) {
    throw new Error(`startSession read: ${readErr?.message ?? "not found"}`);
  }
  return {
    id: existing.id,
    completed: existing.completed,
    total: existing.total,
    correct: existing.correct,
  };
}

export interface CompleteSessionResult {
  ok: boolean;
  reason?: string;
  already_completed?: boolean;
  diamonds?: number;
  streak?: number;
  /** true nếu đủ điều kiện mở vòng quay thưởng */
  earned?: boolean;
}

/** Chốt phiên + cộng streak */
export async function completeSession(params: {
  sessionId: string;
  total: number;
  correct: number;
  diamonds: number;
  date?: string;
}): Promise<CompleteSessionResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("complete_session", {
    p_app_id: APP_ID,
    p_session: params.sessionId,
    p_total: params.total,
    p_correct: params.correct,
    p_diamonds: params.diamonds,
    p_date: params.date ?? todayVN(),
  });
  if (error) throw new Error(`completeSession: ${error.message}`);
  return data as CompleteSessionResult;
}

// ═══════════════════════════════════════════════════════════════
//  spins (gacha)
// ═══════════════════════════════════════════════════════════════

/** Các mode đã quay trong ngày */
export async function getTodaySpins(date = todayVN()): Promise<Spin[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("spins")
    .select("*")
    .eq("app_id", APP_ID)
    .eq("spin_date", date);
  if (error) throw new Error(`getTodaySpins: ${error.message}`);
  return (data ?? []) as Spin[];
}

export interface SpinWheelResult {
  ok: boolean;
  reason?: string;
  amount?: number;
  tier_index?: number;
  diamonds?: number;
  streak?: number;
  reversed?: boolean;
}

export async function spinWheel(params: {
  kind: "reward" | "penalty";
  mode: string;
  tierIndex: number;
  amount: number;
  reversed: boolean;
  date?: string;
}): Promise<SpinWheelResult> {
  const sb = getSupabase();
  const { data, error } = await sb.rpc("spin_wheel", {
    p_app_id: APP_ID,
    p_kind: params.kind,
    p_mode: params.mode,
    p_tier_index: params.tierIndex,
    p_amount: params.amount,
    p_reversed: params.reversed,
    p_date: params.date ?? todayVN(),
  });
  if (error) throw new Error(`spinWheel: ${error.message}`);
  return data as SpinWheelResult;
}

export async function getSpinHistory(limit = 30): Promise<Spin[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("spins")
    .select("*")
    .eq("app_id", APP_ID)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`getSpinHistory: ${error.message}`);
  return (data ?? []) as Spin[];
}

// ═══════════════════════════════════════════════════════════════
//  gacha_tiers
// ═══════════════════════════════════════════════════════════════

/** Bảng tỉ lệ, có fallback cục bộ nếu bảng chưa tồn tại */
const FALLBACK_TIERS: GachaTier[] = [
  { tier_index: 0, label: "2.000", amount: 2000, probability: 0.44, color: "#C1FA87" },
  { tier_index: 1, label: "5.000", amount: 5000, probability: 0.25, color: "#8AF7A6" },
  { tier_index: 2, label: "10.000", amount: 10000, probability: 0.15, color: "#4FF0C6" },
  { tier_index: 3, label: "20.000", amount: 20000, probability: 0.08, color: "#00DAF3" },
  { tier_index: 4, label: "50.000", amount: 50000, probability: 0.04, color: "#2EA8FF" },
  { tier_index: 5, label: "100.000", amount: 100000, probability: 0.02, color: "#7C6CFF" },
  { tier_index: 6, label: "200.000", amount: 200000, probability: 0.014, color: "#C05CFF" },
  { tier_index: 7, label: "500.000", amount: 500000, probability: 0.006, color: "#FF4D9D" },
];

export async function getGachaTiers(): Promise<GachaTier[]> {
  const sb = getSupabase();
  const { data, error } = await sb
    .from("gacha_tiers")
    .select("*")
    .order("tier_index", { ascending: true });
  if (error || !data || data.length === 0) return FALLBACK_TIERS;
  return data as GachaTier[];
}

// ═══════════════════════════════════════════════════════════════
//  attempts (lịch sử)
// ═══════════════════════════════════════════════════════════════

export async function logAttempts(
  rows: Array<{
    mode: "vocab" | "kanji";
    itemId: string;
    question: string;
    correct: boolean;
    answerMs?: number;
    combo: number;
  }>,
): Promise<void> {
  if (rows.length === 0) return;
  const sb = getSupabase();
  // Bảng attempts dùng snake_case columns (item_id, answer_ms) — convert
  const payload = rows.map((r) => ({
    mode: r.mode,
    item_id: r.itemId,
    question: r.question,
    correct: r.correct,
    answer_ms: r.answerMs ?? null,
    combo: r.combo,
  }));
  const { error } = await sb.from("attempts").insert(payload);
  if (error) {
    // Không chặn luồng học nếu log lỗi
    console.warn("logAttempts failed:", error.message);
  }
}

export interface StudyStats {
  todayAttempts: number;
  todayCorrect: number;
  totalAttempts: number;
  totalCorrect: number;
}

export async function getStudyStats(date = todayVN()): Promise<StudyStats> {
  const sb = getSupabase();
  const todayISO = `${date}T00:00:00.000Z`;

  const { data: todayRows, error: tErr } = await sb
    .from("attempts")
    .select("correct")
    .gte("created_at", todayISO);
  if (tErr) throw new Error(`getStudyStats today: ${tErr.message}`);

  const { count: totalAttempts } = await sb
    .from("attempts")
    .select("*", { count: "exact", head: true });

  // Đếm tổng đúng bằng cách đếm dòng correct = true
  const { count: totalCorrect } = await sb
    .from("attempts")
    .select("*", { count: "exact", head: true })
    .eq("correct", true);

  const today = todayRows ?? [];
  return {
    todayAttempts: today.length,
    todayCorrect: today.filter((r) => r.correct).length,
    totalAttempts: totalAttempts ?? 0,
    totalCorrect: totalCorrect ?? 0,
  };
}

/** Chuỗi ngày học liên tiếp gần nhất (dùng cho lịch) */
export async function getStudyCalendar(days = 28): Promise<Record<string, number>> {
  const sb = getSupabase();
  const since = new Date(Date.now() - days * 86_400_000).toISOString();

  const { data, error } = await sb
    .from("attempts")
    .select("created_at, correct")
    .gte("created_at", since);
  if (error) return {};

  const map: Record<string, number> = {};
  for (const row of data ?? []) {
    // Đổi sang ngày VN (UTC+7)
    const d = new Date(new Date(row.created_at).getTime() + 7 * 3600_000)
      .toISOString()
      .slice(0, 10);
    const bucket = row.correct ? 1 : -1;
    map[d] = (map[d] ?? 0) + bucket;
  }
  return map;
}