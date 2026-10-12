// Quick sanity check for the romaji engine (run with: npx tsx scripts/check-romaji.ts)
import { parseWord, displayJapanese, parseInputLine } from "../lib/romaji";

const cases = [
  "nihongo",
  "shouyou",
  "renshuu",
  "kaizen",
  "sakura",
  "tabemono",
  "ryouri",
  "joufu",
  "ippai",
  "kitte",
];

console.log("── Romaji conversion ──");
for (const c of cases) {
  const p = parseWord(c);
  console.log(
    `${c.padEnd(12)} -> kanji=${p.kanji || "-"}  hira=${p.hiragana.padEnd(12)} kata=${p.katakana.padEnd(12)} romaji=${p.romaji}`
  );
}

console.log("\n── Kanji input ──");
for (const c of ["日本語", "日本", "本", " Soup ", "kaizen 改造"]) {
  const p = parseWord(c);
  console.log(
    `${JSON.stringify(c).padEnd(14)} -> display=${displayJapanese(p).padEnd(18)} hira=${p.hiragana.padEnd(10)} kata=${p.katakana}`
  );
}

console.log("\n── Input lines ──");
const lines = [
  "nihongo, tiếng Nhật",
  "sakura, hoa anh đào # mùa xuân",
  "kaizen 改造",
  "renshuu 練習, luyện tập; rất quan trọng",
  "dòng lỗi không có nghĩa",
];
for (const l of lines) {
  const r = parseInputLine(l);
  if (!r) {
    console.log(`${JSON.stringify(l).padEnd(40)} -> null`);
  } else {
    console.log(
      `${JSON.stringify(l).padEnd(40)} -> ${displayJapanese(r.word).padEnd(16)} = ${r.meaning}${r.note ? `  [note: ${r.note}]` : ""}`
    );
  }
}