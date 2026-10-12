/**
 * GET /api/jisho?keyword=eakon
 * Server-side proxy cho Jisho.org API.
 * Cache in-memory 24h + edge-friendly headers.
 */

import { NextRequest, NextResponse } from "next/server";

const JISHO_BASE = "https://jisho.org/api/v1/search/words";
const TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 1000 * 60 * 60 * 24;

interface JishoEntry {
  slug: string;
  is_common: boolean;
  jlpt: string[];
  japanese: { word?: string; reading: string }[];
  senses: { english_definitions: string[]; parts_of_speech: string[] }[];
}

interface JishoResponse {
  meta: { status: number };
  data: JishoEntry[];
}

interface CacheEntry {
  hit: unknown | null;
  ts: number;
}

// Tránh chia sẻ state giữa các serverless instances — dùng Map local
const cache = new Map<string, CacheEntry>();

function getCached(key: string): unknown | undefined {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (Date.now() - entry.ts > CACHE_TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  return entry.hit;
}

function setCache(key: string, hit: unknown | null) {
  cache.set(key, { hit, ts: Date.now() });
}

function romajiVariants(input: string): string[] {
  const out: string[] = [input];
  const macron = input
    .replace(/oo/g, "ō")
    .replace(/aa/g, "ā")
    .replace(/ee/g, "ē")
    .replace(/uu/g, "ū")
    .replace(/ou/g, "ō");
  if (macron !== input) out.push(macron);

  const hyphen = macron
    .replace(/ō/g, "o-o")
    .replace(/ā/g, "a-a")
    .replace(/ē/g, "e-e")
    .replace(/ū/g, "u-u");
  if (hyphen !== macron) out.push(hyphen);

  const stripped = input.replace(/['\u2019]/g, "");
  if (stripped !== input) out.push(stripped);

  const dashed = input.replace(/([aeiou])\1/g, "$1-$1");
  if (dashed !== input) out.push(dashed);

  return Array.from(new Set(out));
}

function isKana(s: string) {
  return /^[ぁ-ヿー]+$/.test(s);
}
function isKatakana(s: string) {
  return /^[ァ-ヿー]+$/.test(s);
}

function pickBest(entries: JishoEntry[]) {
  for (const e of entries) {
    const isProperNoun = e.senses[0]?.parts_of_speech?.some((p) =>
      /proper noun|place name|person name|organization/i.test(p),
    );
    if (isProperNoun) continue;

    const ja = e.japanese[0];
    if (!ja?.reading) continue;
    if (!isKana(ja.reading)) continue;

    const kanji = ja.word ?? "";
    const reading = ja.reading;
    const isKatakanaOnly = isKatakana(reading) && !kanji;

    return {
      katakana: toKatakana(reading),
      hiragana: toHiragana(reading),
      kanji,
      isKatakanaWord: isKatakanaOnly,
      isCommon: e.is_common,
      englishDef: e.senses[0]?.english_definitions?.[0] ?? "",
    };
  }
  return null;
}

// Lazy-loaded wanakana (giữ bundle server nhỏ)
let wk: typeof import("wanakana") | null = null;
async function getWanakana() {
  if (!wk) wk = await import("wanakana");
  return wk;
}

async function toKatakana(s: string) {
  const w = await getWanakana();
  return w.toKatakana(s);
}
async function toHiragana(s: string) {
  const w = await getWanakana();
  return w.toHiragana(s);
}

export async function GET(req: NextRequest) {
  const keyword = req.nextUrl.searchParams.get("keyword")?.trim();
  if (!keyword) {
    return NextResponse.json(
      { error: "Missing ?keyword=" },
      { status: 400 },
    );
  }
  if (keyword.length > 100) {
    return NextResponse.json({ error: "Keyword too long" }, { status: 400 });
  }

  const cacheKey = keyword.toLowerCase();
  const cached = getCached(cacheKey);
  if (cached !== undefined) {
    return NextResponse.json(cached, {
      headers: { "X-Cache": "HIT", "Cache-Control": "public, max-age=3600" },
    });
  }

  const variants = romajiVariants(cacheKey);
  for (const v of variants) {
    const url = `${JISHO_BASE}?keyword=${encodeURIComponent(v)}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        headers: {
          Accept: "application/json",
          "User-Agent": "kotoba-japanese-learner/1.0",
        },
      });
      if (!res.ok) continue;
      const json = (await res.json()) as JishoResponse;
      if (!json.data?.length) continue;
      const hit = pickBest(json.data);
      if (hit) {
        setCache(cacheKey, hit);
        return NextResponse.json(hit, {
          headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=3600" },
        });
      }
    } catch {
      // timeout / network — thử variant tiếp
    } finally {
      clearTimeout(timer);
    }
  }

  setCache(cacheKey, null);
  return NextResponse.json(
    { hit: null },
    { headers: { "X-Cache": "MISS", "Cache-Control": "public, max-age=600" } },
  );
}
