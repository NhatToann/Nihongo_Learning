import { buildQuiz, shuffle, comboMultiplier, scoreForCorrect } from "../lib/quiz";
import { rollTier, tierArcs, normalizeTiers, DEFAULT_TIERS, expectedValue } from "../lib/gacha";
import { parseWord } from "../lib/romaji";
import type { Vocab, Kanji } from "../lib/types";

const words = ["nihongo", "sakura", "renshuu", "tabemono", "ryouri", "kaizen", "hon", "mizu", "yama", "honya"];
const meanings = ["tieng Nhat", "hoa anh dao", "luyen tap", "mon an", "nau an", "cai tien", "sach", "nuoc", "nui", "hieu sach"];

const vocab: Vocab[] = words.map((w, i) => {
  const p = parseWord(w);
  return {
    id: `v${i}`,
    romaji: p.romaji,
    hiragana: p.hiragana,
    katakana: p.katakana,
    meaning_vi: meanings[i],
    note: null,
    study_date: "2026-10-12",
  };
});

const kanjiChars: Array<[string, string, string]> = [
  ["日", "mat troi", "ニチ"],
  ["水", "nuoc", "スイ"],
  ["山", "nui", "サン"],
  ["本", "sach", "ホン"],
  ["人", "nguoi", "ジン"],
];
const kanji: Kanji[] = kanjiChars.map(([c, m, o], i) => ({
  id: `k${i}`,
  character: c,
  meaning_vi: m,
  onyomi: o,
  kunyomi: "",
  stroke_count: null,
  note: null,
  study_date: "2026-10-12",
}));

console.log("── 1. Romaji conversion ──");
for (const v of vocab.slice(0, 5)) {
  console.log(`  ${v.romaji.padEnd(10)} -> ${v.hiragana.padEnd(10)} / ${v.katakana}`);
}

console.log("\n── 2. Quiz vocab ──");
for (const q of buildQuiz(shuffle(vocab).slice(0, 5), vocab)) {
  console.log(`  [${q.kind}] "${q.prompt}" -> "${q.answer}" | ${q.options.length} lua chon`);
  if (!q.options.includes(q.answer)) console.log("    ✗ dap an dung khong co trong options!");
}

console.log("\n── 3. Quiz kanji ──");
for (const q of buildQuiz(shuffle(kanji).slice(0, 5), kanji)) {
  console.log(`  [${q.kind}] "${q.prompt}" -> "${q.answer}" | ${q.options.length} lua chon`);
  if (!q.options.includes(q.answer)) console.log("    ✗ dap an dung khong co trong options!");
}

console.log("\n── 4. Combo & scoring ──");
for (let c = 1; c <= 12; c++) {
  console.log(`  combo ${String(c).padStart(2)}: x${comboMultiplier(c).toFixed(1)} -> ${scoreForCorrect(c)} diamond`);
}

console.log("\n── 5. Gacha arcs ──");
const arcs = tierArcs(DEFAULT_TIERS);
for (const a of arcs) {
  console.log(`  ${a.tier.label.padStart(9)} ${(a.tier.probability * 100).toFixed(1).padStart(5)}%  ${a.start.toFixed(1)} -> ${a.end.toFixed(1)}`);
}
console.log(`  Tong goc: ${arcs[arcs.length - 1].end.toFixed(2)} (phai = 360)`);

console.log("\n── 6. Mo phong 100.000 luot quay ──");
const counts = new Array(DEFAULT_TIERS.length).fill(0);
const N = 100_000;
for (let i = 0; i < N; i++) counts[rollTier(DEFAULT_TIERS).tier_index]++;
for (let i = 0; i < DEFAULT_TIERS.length; i++) {
  const observed = (counts[i] / N) * 100;
  const expected = DEFAULT_TIERS[i].probability * 100;
  console.log(`  ${DEFAULT_TIERS[i].label.padStart(9)} thuc ${observed.toFixed(2)}% | ky vong ${expected.toFixed(2)}%`);
}
console.log(`  Gia tri ky vong/luot: ${Math.round(expectedValue(DEFAULT_TIERS))} diamond`);

console.log("\n── 7. Normalize tiers ──");
const broken = DEFAULT_TIERS.map((t) => ({ ...t, probability: t.probability * 2 }));
console.log(`  Tong sau normalize: ${normalizeTiers(broken).reduce((s, t) => s + t.probability, 0).toFixed(4)} (phai = 1.0000)`);

console.log("\nXong kiem tra.\n");