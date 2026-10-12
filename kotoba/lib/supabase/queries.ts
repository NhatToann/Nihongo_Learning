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
  study_date?: string;
}

export async function insertVocab(rows: NewVocab[]): Promise<Vocab[]> {
  if (rows.length === 0) return [];
  const sb = getSupabase();
  const payload = rows.map((r) => ({
    romaji: r.romaji,
    hiragana: r.hiragana,
    katakana: r.katakana,
    meaning_vi: r.meaning_vi,
    note: r.note ?? null,
    study_date: r.study_date ?? todayVN(),
  }));

  const { data, error } = await sb.from("vocab").insert(payload).select();
  if (error) throw new Error(`insertVocab: ${error.message}`);
  return (data ?? []) as Vocab[];
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
  const { error } = await sb
    .from("vocab")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", id);
  if (error) throw new Error(`updateVocab: ${error.message}`);
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
  study_date?: string;
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
    study_date: r.study_date ?? todayVN(),
  }));

  const { data, error } = await sb.from("kanji").insert(payload).select();
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
  const { error } = await sb.from("attempts").insert(rows);
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