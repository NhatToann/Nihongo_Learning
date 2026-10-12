import { toHiragana, toKatakana, toRomaji, isKanji, isKana, isRomaji } from "wanakana";

// ═══════════════════════════════════════════════════════════════
//  Romaji -> Kana conversion
//  Dùng `wanakana` làm engine. Xử lý thêm:
//   - "shou" -> しょう, "ou" -> おう, "tsu" -> つ
//   - chuỗi kanji trong nội dung: "漢字" giữ nguyên
//   - khi người dùng gõ kana/kanji sẵn: không cần convert, vẫn tách ra
// ═══════════════════════════════════════════════════════════════

export interface ParsedWord {
  /** Nhập gốc, đã trim + chuẩn hoá khoảng trắng */
  raw: string;
  /** Chuỗi kanji nếu có (vd: 日本語) */
  kanji: string;
  /** Chuỗi hiragana từ phần romaji/kana (vd: にほんご) */
  hiragana: string;
  /** Chuỗi katakana (vd: ニホンゴ) */
  katakana: string;
  /** Romaji chuẩn hoá (nếu convert được) */
  romaji: string;
  /** true nếu có phần kanji */
  hasKanji: boolean;
  /**
   * true khi người dùng chỉ nhập kanji mà không kèm cách đọc.
   * `wanakana` không có CSDL tra kanji → app cần hỏi thêm romaji.
   */
  needsReading: boolean;
  /**
   * Nghĩa từ Jisho (nếu đã lookup) — gợi ý cho user.
   * Đặc biệt hữu ích với loan word: user chỉ cần gõ romaji, có nghĩa luôn.
   */
  jishoMeaning?: string;
  /**
   * true nếu Jisho xác nhận từ này gốc katakana (loan word).
   * Khi đó form sẽ ưu tiên hiển thị katakana làm chính.
   */
  isKatakanaWord?: boolean;
  /**
   * Nguồn quyết định script chính hiển thị:
   *  - "kanji"  : có kanji (vd: 日本語)
   *  - "katakana" : loan word từ Jisho (vd: エアコン)
   *  - "hiragana" : mặc định (vd: さくら)
   *  - "raw"     : không convert được
   */
  script?: "kanji" | "katakana" | "hiragana" | "raw";
}

/** Chuẩn hoá romaji cho wanakana: bỏ khoảng trắng thừa, giữ nguyên dấu * */
function normalize(input: string) {
  return input
    .trim()
    .replace(/\s+/g, " ")
    // Cho phép dấu gạch dưới/nháy thay cho khoảng trắng: "hon_de" -> "hon de"
    .replace(/[_-]+/g, " ");
}

/**
 * Parse một mục từ người dùng nhập.
 * Hỗ trợ:
 *   "nihongo"      -> にほんご / ニホンゴ
 *   "shouyou"      -> しょうよう / ショウヨウ
 *   "renshuu"      -> れんしゅう
 *   "kaizen"       -> かいぜん
 *   "日本語"         -> kanji: 日本語, hiragana: にほんご
 *   "日本"          -> kanji 日本, hiragana にほん
 *   "ほん"          -> kana-only
 */
export function parseWord(input: string): ParsedWord {
  const raw = normalize(input);

  if (!raw) {
    return {
      raw: "",
      kanji: "",
      hiragana: "",
      katakana: "",
      romaji: "",
      hasKanji: false,
      needsReading: false,
    };
  }

  // ── Bóc tách kanji / kana / romaji ───────────────────────────
  let kanji = "";
  let rest = "";

  for (const ch of raw) {
    if (isKanji(ch) || (ch === "々" && !rest)) {
      kanji += ch;
    } else {
      rest += ch;
    }
  }

  const restTrimmed = normalize(rest);

  // ── Trường hợp 1: chỉ có kanji ────────────────────────────────
  // "日本語" -> wanakana không tra được CSDL -> hỏi người dùng thêm romaji
  if (!restTrimmed) {
    if (!kanji) {
      return {
        raw,
        kanji: "",
        hiragana: "",
        katakana: "",
        romaji: "",
        hasKanji: false,
        needsReading: false,
      };
    }
    const hira = toHiragana(kanji);
    // Nếu chuỗi kanji đi qua mà không đổi -> không có mapping
    const converted = hira !== kanji && /[\u3040-\u309f]/.test(hira);
    return {
      raw,
      kanji,
      hiragana: converted ? hira : "",
      katakana: converted ? toKatakana(kanji) : "",
      romaji: converted ? toRomaji(kanji) : "",
      hasKanji: true,
      needsReading: !converted,
    };
  }

  // ── Trường hợp 2: phần còn lại đã là kana ─────────────────────
  if (isKana(restTrimmed)) {
    const hira = toHiragana(restTrimmed);
    const kata = toKatakana(restTrimmed);
    return {
      raw,
      kanji,
      hiragana: hira,
      katakana: kata,
      romaji: toRomaji(restTrimmed),
      hasKanji: kanji.length > 0,
      needsReading: false,
    };
  }

  // ── Trường hợp 3: romaji thuần ───────────────────────────────
  if (isRomaji(restTrimmed)) {
    const hira = toHiragana(restTrimmed);
    const kata = toKatakana(restTrimmed);
    return {
      raw,
      kanji,
      hiragana: hira,
      katakana: kata,
      romaji: toRomaji(hira),
      hasKanji: kanji.length > 0,
      needsReading: false,
    };
  }

  // ── Trường hợp 4: lẫn lộn (ví dụ "kaizen 改造") ─────────────
  // Thử từng từ trong rest
  const words = restTrimmed.split(" ");
  const hiraParts: string[] = [];
  const kataParts: string[] = [];
  const romajiParts: string[] = [];

  for (const w of words) {
    if (!w) continue;
    if (isKanji(w)) {
      kanji += w;
      continue;
    }
    const h = isKana(w) ? toHiragana(w) : toHiragana(w);
    hiraParts.push(h);
    kataParts.push(toKatakana(w));
    romajiParts.push(toRomaji(h));
  }

  const hira = hiraParts.join(" ");
  return {
    raw,
    kanji,
    hiragana: hira,
    katakana: kataParts.join(" "),
    romaji: romajiParts.join(" "),
    hasKanji: kanji.length > 0,
    needsReading: kanji.length > 0 && hiraParts.length === 0,
  };
}

// ── Nhãn hiển thị ────────────────────────────────────────────────

/** Chuỗi tiếng Nhật "đẹp nhất" để hiển thị: ưu tiên kanji nếu có */
export function displayJapanese(p: ParsedWord): string {
  // Loan word katakana — luôn hiển thị katakana
  if (p.script === "katakana" && p.katakana) return p.katakana;
  if (p.kanji && p.hiragana) return `${p.kanji}（${p.hiragana}）`;
  if (p.kanji) return p.kanji;
  if (p.katakana) return p.katakana;
  if (p.hiragana) return p.hiragana;
  return p.raw;
}

/** Chuỗi đọc bằng katakana (dùng cho mục "cách đọc") */
export function readingOf(p: ParsedWord): string {
  return p.katakana || p.hiragana || "";
}

/**
 * Gộp kanji với romaji để tạo mục đầy đủ.
 * Dùng khi người dùng nhập kanji thuần rồi bổ sung cách đọc.
 */
export function withReading(p: ParsedWord, romaji: string): ParsedWord {
  const hira = toHiragana(normalize(romaji));
  return {
    ...p,
    hiragana: hira,
    katakana: toKatakana(normalize(romaji)),
    romaji: toRomaji(hira),
    needsReading: false,
  };
}

/**
 * Áp dụng kết quả Jisho lên ParsedWord.
 * Nếu Jisho xác nhận loan word → đổi script chính sang katakana.
 * Nếu Jisho trả kanji cho romaji → bổ sung kanji.
 * Nếu user đã gõ kanji từ trước → giữ nguyên kanji của user.
 */
export interface JishoLite {
  kanji: string;
  katakana: string;
  hiragana: string;
  isKatakanaWord: boolean;
  englishDef: string;
}
export function applyJishoHit(p: ParsedWord, hit: JishoLite): ParsedWord {
  // Nếu Jisho tìm được kanji mà user chưa có → bổ sung
  const kanji = p.kanji || hit.kanji;
  const hasKanji = kanji.length > 0;
  const hira = hit.hiragana || p.hiragana;
  const kata = hit.katakana || p.katakana;
  const script = hasKanji
    ? "kanji"
    : hit.isKatakanaWord
      ? "katakana"
      : hira
        ? "hiragana"
        : "raw";
  return {
    ...p,
    kanji,
    hiragana: hira,
    katakana: kata,
    romaji: p.romaji || toRomaji(hira || kata),
    hasKanji,
    isKatakanaWord: hit.isKatakanaWord,
    jishoMeaning: hit.englishDef,
    script,
    needsReading: false,
  };
}

/**
 * Chuẩn hoá chuỗi để so sánh đáp án nhập tự do:
 * bỏ khoảng trắng, kana dài/ngắn, dấu câu.
 */
export function normalizeAnswer(s: string): string {
  return toHiragana(
    s
      .trim()
      .toLowerCase()
      .replace(/[\s　]/g, "")
      .replace(/[.。!！?？,，;；:：'"“”‘’()（）\-–—]/g, ""),
  );
}

/** Kiểm tra gần đúng 2 chuỗi tiếng Nhật có tương đương không */
export function jpEquals(a: string, b: string): boolean {
  return normalizeAnswer(a) === normalizeAnswer(b);
}

/**
 * Parse dòng input "romaji, nghĩa tiếng Việt" hoặc "romaji - nghĩa"
 * Trả về null nếu dòng không hợp lệ.
 */
export function parseInputLine(line: string): {
  word: ParsedWord;
  meaning: string;
  note?: string;
} | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // Tách theo dấu phẩy trước, nếu không có thì theo gạch ngang / tab / 2 space
  let head: string;
  let tail: string;

  const commaIdx = trimmed.indexOf(",");
  if (commaIdx > 0) {
    head = trimmed.slice(0, commaIdx);
    tail = trimmed.slice(commaIdx + 1);
  } else {
    const m = trimmed.match(/^(.+?)(?:\s{2,}|\t|\s-\s|\s–\s)(.+)$/);
    if (!m) return null;
    head = m[1];
    tail = m[2];
  }

  // Ghi chú tuỳ chọn sau dấu ";" hoặc "#"
  let note: string | undefined;
  const noteSplit = tail.split(/\s*[;#]\s*/);
  if (noteSplit.length > 1) {
    tail = noteSplit[0];
    note = noteSplit.slice(1).join(" ").trim() || undefined;
  }

  const meaning = tail.trim();
  if (!meaning) return null;

  const word = parseWord(head.trim());
  if (!word.raw) return null;

  return { word, meaning, note };
}