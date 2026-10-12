"use client";

/**
 * Hook tra romaji/kana trên Jisho qua /api/jisho.
 * - Trả về katakana nếu là loan word (vd: エアコン)
 * - Trả về hiragana/kanji nếu từ thuần Nhật (vd: 日本語)
 * - Debounce 300ms, cache 24h ở server
 */

import { useEffect, useRef, useState } from "react";

export interface JishoHit {
  katakana: string;
  hiragana: string;
  kanji: string;
  isKatakanaWord: boolean;
  isCommon: boolean;
  englishDef: string;
}

export function useJishoLookup(query: string, debounceMs = 300) {
  const [hit, setHit] = useState<JishoHit | null>(null);
  const [loading, setLoading] = useState(false);
  const lastQuery = useRef("");

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setHit(null);
      return;
    }
    lastQuery.current = q;
    const ctrl = new AbortController();
    setLoading(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/jisho?keyword=${encodeURIComponent(q)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) {
          setHit(null);
          return;
        }
        const data = (await res.json()) as JishoHit | { hit: null };
        // API trả null khi miss, hoặc object khi hit
        const result = "katakana" in data ? data : null;
        if (lastQuery.current === q) setHit(result);
      } catch {
        // ignore aborted
      } finally {
        if (lastQuery.current === q) setLoading(false);
      }
    }, debounceMs);

    return () => {
      ctrl.abort();
      clearTimeout(timer);
    };
  }, [query, debounceMs]);

  return { hit, loading };
}
