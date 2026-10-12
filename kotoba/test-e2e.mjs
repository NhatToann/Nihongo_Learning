import { readFileSync } from "fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const [k, ...rest] = l.split("=");
      return [k.trim(), rest.join("=").replace(/^"|"$/g, "").trim()];
    }),
);

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== TEST TỪNG BƯỚC (giả lập end-user) ===\n");

async function check(name, fn) {
  process.stdout.write(`▶ ${name} … `);
  try {
    const r = await fn();
    console.log("✅", r ?? "");
    return true;
  } catch (e) {
    console.log("❌", e.message);
    return false;
  }
}

const results = [];
results.push(
  await check("Bước 1: SELECT vocab.lesson_number", async () => {
    const { error } = await sb.from("vocab").select("lesson_number").limit(1);
    if (error) throw new Error(error.message);
    return "OK — cột đã có trong schema cache";
  }),
);
results.push(
  await check("Bước 2: SELECT kanji.lesson_number", async () => {
    const { error } = await sb.from("kanji").select("lesson_number").limit(1);
    if (error) throw new Error(error.message);
    return "OK";
  }),
);
results.push(
  await check("Bước 3: RPC create_lesson(999)", async () => {
    const { error } = await sb.rpc("create_lesson", { p_lesson: 999 });
    if (error) throw new Error(error.message);
    return "OK";
  }),
);
results.push(
  await check("Bước 4: insert vocab mới với lesson_number=0", async () => {
    const { data, error } = await sb
      .from("vocab")
      .insert({
        romaji: "test-e2e",
        hiragana: "テスト",
        katakana: "テスト",
        meaning_vi: "test",
        lesson_number: 0,
        study_date: "2026-10-13",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    // cleanup
    await sb.from("vocab").delete().eq("id", data.id);
    return `id=${data.id.slice(0, 8)}…`;
  }),
);
results.push(
  await check("Bước 5: insert kanji mới với lesson_number=0", async () => {
    const { data, error } = await sb
      .from("kanji")
      .insert({
        character: "日",
        meaning_vi: "mặt trời",
        onyomi: "ニチ",
        kunyomi: "ひ",
        lesson_number: 0,
        study_date: "2026-10-13",
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    await sb.from("kanji").delete().eq("id", data.id);
    return `id=${data.id.slice(0, 8)}…`;
  }),
);
results.push(
  await check("Bước 6: gacha_spin (kiểm tra bảng spins)", async () => {
    const { error } = await sb.from("gacha_tiers").select("tier_index").limit(1);
    if (error) throw new Error(error.message);
    return "OK";
  }),
);

const pass = results.filter(Boolean).length;
const total = results.length;
console.log(`\n=== KẾT QUẢ: ${pass}/${total} bước PASS ===`);

if (pass < total) {
  console.log("\n⚠️  CẦN CHẠY MIGRATION:");
  console.log("1. Mở https://supabase.com/dashboard");
  console.log(
    `2. Chọn project: ${env.NEXT_PUBLIC_SUPABASE_URL.split("//")[1].split(".")[0]}`,
  );
  console.log("3. SQL Editor → New query");
  console.log("4. Paste nội dung file supabase/migrate.sql");
  console.log("5. Nhấn Run");
  console.log("\nFile SQL sẵn ở: kotoba/supabase/migrate.sql");
}
