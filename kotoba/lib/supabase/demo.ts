import type { AppState, GachaTier, Kanji, Vocab } from "@/lib/types";
import { DEFAULT_TIERS } from "@/lib/gacha";
import { parseWord } from "@/lib/romaji";

// ═══════════════════════════════════════════════════════════════
//  Demo mode — du lieu gia trong bo nho
//  Bat bang NEXT_PUBLIC_DEMO_MODE=true trong .env.local
//  Dung de xem giao dien truoc khi ket noi Supabase.
// ═══════════════════════════════════════════════════════════════

export const DEMO_ENABLED = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

const WORDS: Array<[string, string]> = [
  ["nihongo", "tiếng Nhật"],
  ["sakura", "hoa anh đào"],
  ["renshuu", "luyện tập"],
  ["tabemono", "món ăn"],
  ["ryouri", "nấu ăn"],
  ["kaizen", "cải tiến"],
  ["hon", "sách"],
  ["mizu", "nước"],
  ["yama", "núi"],
  ["honya", "hiệu sách"],
  ["gakkou", "trường học"],
  ["sensei", "giáo viên"],
  ["tomodachi", "bạn thân"],
  ["yasai", "rau"],
  ["sakana", "cá"],
  ["neko", "mèo"],
  ["inu", "chó"],
  ["houkoku", "báo cáo"],
  ["kigyou", "công nghiệp"],
  ["setsumeikai", "buổi giới thiệu"],
];

const KANJI_LIST: Array<[string, string, string, string]> = [
  ["日", "mặt trời", "ニチ", "ひ"],
  ["水", "nước", "スイ", "みず"],
  ["山", "núi", "サン", "やま"],
  ["本", "sách", "ホン", "ほん"],
  ["人", "người", "ジン", "ひと"],
  ["大", "lớn", "ダイ", "おおきい"],
  ["中", "giữa", "チュウ", "なか"],
  ["小", "nhỏ", "ショウ", "ちいさい"],
  ["上", "trên", "ジョウ", "うえ"],
  ["下", "dưới", "カ", "した"],
];

function todayOffset(offsetDays: number): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  d.setUTCDate(d.getUTCDate() - offsetDays);
  return d.toISOString().slice(0, 10);
}

export function demoVocab(): Vocab[] {
  return WORDS.map(([w, meaning], i) => {
    const p = parseWord(w);
    return {
      id: `demo-v-${i}`,
      romaji: p.romaji,
      hiragana: p.hiragana,
      katakana: p.katakana,
      meaning_vi: meaning,
      note: null,
      // Bài 1 cho 6 từ đầu, Bài 2 cho 6 từ tiếp, Bài 3 cho 4 từ cuối
      lesson_number: i < 6 ? 1 : i < 12 ? 2 : 3,
      study_date: todayOffset(i < 10 ? 0 : i - 9),
    };
  });
}

export function demoKanji(): Kanji[] {
  return KANJI_LIST.map(([c, m, on, kun], i) => ({
    id: `demo-k-${i}`,
    character: c,
    meaning_vi: m,
    onyomi: on,
    kunyomi: kun,
    stroke_count: null,
    note: null,
    lesson_number: i < 3 ? 1 : i < 7 ? 2 : 3,
    study_date: todayOffset(i < 5 ? 0 : i - 4),
  }));
}

export function demoAppState(): AppState {
  return {
    id: "demo",
    diamonds: 128450,
    lifetime_diamonds: 340200,
    current_streak: 12,
    longest_streak: 21,
    last_study_date: todayOffset(1),
    last_seen_date: todayOffset(1),
  };
}

export function demoTiers(): GachaTier[] {
  return DEFAULT_TIERS;
}

/** Lich hoc 28 ngay gia — bo trong vai ngay de nhin ro "nghi" */
export function demoCalendar(): Record<string, number> {
  const map: Record<string, number> = {};
  for (let i = 0; i < 28; i++) {
    if (i === 5 || i === 12 || i === 19) continue;
    map[todayOffset(i)] = 8 + ((i * 7) % 15);
  }
  return map;
}

/** Cac mode da hoan thanh hom nay trong demo */
export const DEMO_COMPLETED = new Set<string>(["review"]);