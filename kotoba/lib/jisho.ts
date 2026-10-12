/**
 * Jisho.org API client + heuristics.
 *
 * - Lookup romaji/kana từ Jisho.org
 * - Trả về katakana nếu từ gốc loan word (vd: エアコン)
 * - Trả về hiragana/kanji nếu từ gốc Nhật (vd: 日本語)
 * - Normalize romaji trước khi gọi API (eakon, ko-hi, kōhī → eakon, ko-hi, kōhī)
 *
 * Cache ở memory: tránh gọi lại nhiều lần trong cùng session.
 */

const JISHO_BASE = "https://jisho.org/api/v1/search/words";
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24; // 24h

interface JishoEntry {
  slug: string;
  is_common: boolean;
  jlpt: string[];
  japanese: { word?: string; reading: string }[];
  senses: { english_definitions: string[]; parts_of_speech: string[] }[];
  attribution: { jmdict: boolean; jmnedict: boolean };
}

interface JishoResponse {
  meta: { status: number };
  data: JishoEntry[];
}

export interface JishoHit {
  /** Katakana của từ (vd: エアコン) */
  katakana: string;
  /** Hiragana cách đọc (vd: えあこん) */
  hiragana: string;
  /** Kanji nếu có (vd: 日本語) */
  kanji: string;
  /** Romaji (vd: eakon) */
  romaji: string;
  /** true nếu từ vựng loan word (gốc katakana, không có kanji) */
  isKatakanaWord: boolean;
  /** true nếu là từ thông dụng theo Jisho */
  isCommon: boolean;
  /** Nghĩa tiếng Anh (để debug / autocomplete) */
  englishDef: string;
}

// ── In-memory cache (24h TTL) ─────────────────────────────────────
const cache = new Map<string, { hit: JishoHit | null; ts: number }>();

function getCached(key: string): JishoHit | null | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.hit;
}

function setCache(key: string, hit: JishoHit | null) {
  cache.set(key, { hit, ts: Date.now() });
}

// ── Public API ────────────────────────────────────────────────────
/**
 * Tra romaji/kana trong Jisho.
 * Trả null nếu không tìm thấy từ phù hợp.
 */
export async function lookupJisho(query: string): Promise<JishoHit | null> {
  const q = query.trim().toLowerCase();
  if (!q) return null;

  const cached = getCached(q);
  if (cached !== undefined) return cached;

  // Thử nhiều biến thể romaji vì Jisho nhạy với cách gõ
  const variants = romajiVariants(q);
  for (const v of variants) {
    const hit = await fetchJisho(v);
    if (hit) {
      setCache(q, hit);
      return hit;
    }
  }
  setCache(q, null);
  return null;
}

/** Chỉ fetch khi thật sự cần, bỏ qua cache */
async function fetchJisho(keyword: string): Promise<JishoHit | null> {
  if (!keyword) return null;
  const url = `${JISHO_BASE}?keyword=${encodeURIComponent(keyword)}`;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: ctrl.signal,
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const json = (await res.json()) as JishoResponse;
    if (!json.data?.length) return null;
    return pickBest(json.data, keyword);
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Chọn entry tốt nhất: ưu tiên common, JLPT thấp, không phải proper noun */
function pickBest(entries: JishoEntry[], query: string): JishoHit | null {
  for (const e of entries) {
    // bỏ proper noun / tên riêng
    const isProperNoun = e.senses[0]?.parts_of_speech?.some((p) =>
      /proper noun|place name|person name|organization/i.test(p),
    );
    if (isProperNoun) continue;

    const ja = e.japanese[0];
    if (!ja?.reading) continue;

    // Lấy kanji nếu có, nếu không dùng reading (tức là katakana-only)
    const kanji = ja.word ?? "";
    const reading = ja.reading;
    const isKatakanaOnly = isKatakana(reading) && !kanji;
    const isKanaOnly = isKana(reading);

    if (!isKanaOnly) continue; // reading phải là kana (bỏ entries lỗi)

    const hit: JishoHit = {
      katakana: toKatakana(reading),
      hiragana: toHiragana(reading),
      kanji,
      romaji: toRomaji(reading),
      isKatakanaWord: isKatakanaOnly,
      isCommon: e.is_common,
      englishDef: e.senses[0]?.english_definitions?.[0] ?? "",
    };
    return hit;
  }
  return null;
}

// ── Romaji normalization ──────────────────────────────────────────
/**
 * Wanakana gõ `koohii` thành コーヒー nhưng Jisho không chấp nhận.
 * Cần thử nhiều biến thể: ko-hi-, kōhī, koohi
 */
function romajiVariants(input: string): string[] {
  const out: string[] = [input];

  // 1. Thay "oo/aa/ee/uu/ou" (gõ đôi) bằng dấu macron
  const macron = input
    .replace(/oo/g, "ō")
    .replace(/aa/g, "ā")
    .replace(/ee/g, "ē")
    .replace(/uu/g, "ū")
    .replace(/ou/g, "ō"); // 多い
  if (macron !== input) out.push(macron);

  // 2. Thay dấu macron bằng gạch ngang
  const hyphen = macron
    .replace(/ō/g, "o-o")
    .replace(/ā/g, "a-a")
    .replace(/ē/g, "e-e")
    .replace(/ū/g, "u-u");
  if (hyphen !== macron) out.push(hyphen);

  // 3. Bỏ dấu nháy
  const stripped = input.replace(/['\u2019]/g, "");
  if (stripped !== input) out.push(stripped);

  // 4. Thêm gạch ngang vào giữa nguyên âm đôi (koohii -> ko-ohi-i, ko-o-hi-i)
  const dashed = input.replace(/([aeiou])\1/g, "$1-$1");
  if (dashed !== input) out.push(dashed);

  return Array.from(new Set(out));
}

// ── Helpers (re-export từ wanakana để type-safe) ──────────────────
// eslint-disable-next-line @typescript-eslint/no-var-requires
const wanakana = require("wanakana");

function toKatakana(s: string) {
  return wanakana.isKana(s) ? wanakana.toKatakana(s) : wanakana.toKatakana(s);
}
function toHiragana(s: string) {
  return wanakana.isKana(s) ? wanakana.toHiragana(s) : wanakana.toHiragana(s);
}
function toRomaji(s: string) {
  return wanakana.toRomaji(s);
}
function isKatakana(s: string) {
  return /^[ァ-ヿー]+$/.test(s);
}
function isKana(s: string) {
  return /^[ぁ-ヿー]+$/.test(s);
}
