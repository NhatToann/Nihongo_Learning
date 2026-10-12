/**
 * Chạy SQL migration qua pg REST endpoint của Supabase.
 * Supabase hỗ trợ endpoint POST /rest/v1/rpc cho các function,
 * còn chạy SQL thuần cần dùng `psql` qua connection string.
 *
 * Cách: dùng pg connection string từ Supabase Dashboard
 *   Settings > Database > Connection string > URI (direct)
 *   Cần password database (khác SERVICE_ROLE_KEY).
 *
 * Nếu không có password DB, user phải tự chạy SQL trong Dashboard.
 */

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

const sql = readFileSync("supabase/migrate.sql", "utf8");

// Thử: tạo một function tạm "exec_sql" qua RPC chain — KHÔNG được vì PostgREST không cho exec raw SQL.
// → Giải pháp duy nhất: chạy qua psql với connection string.

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

console.log("=== KIỂM TRA MIGRATION ===\n");

// Check column
const { data: cols, error: colErr } = await sb
  .from("information_schema.columns")
  .select("table_name, column_name")
  .eq("table_schema", "public")
  .in("table_name", ["vocab", "kanji"])
  .eq("column_name", "lesson_number");

if (colErr) {
  console.log("Lỗi truy vấn:", colErr.message);
} else {
  const found = cols.map((c) => c.table_name);
  if (found.length === 2) {
    console.log("✅ Cột lesson_number đã có ở vocab + kanji");
    console.log("→ MIGRATION ĐÃ CHẠY RỒI. App phải hoạt động!");
  } else if (found.length === 1) {
    console.log(`⚠️  Chỉ có ở ${found[0]} — cần ALTER bảng kia`);
  } else {
    console.log("❌ Cột lesson_number CHƯA tồn tại.");
    console.log("\n📋 CÁCH CHẠY MIGRATION (chỉ mất 30 giây):");
    console.log("1. Mở https://supabase.com/dashboard");
    console.log(`2. Chọn project ${env.NEXT_PUBLIC_SUPABASE_URL.split("//")[1].split(".")[0]}`);
    console.log("3. Sidebar trái → SQL Editor → New query");
    console.log("4. Paste nội dung file supabase/migrate.sql");
    console.log("5. Nhấn Run (Ctrl+Enter)");
    console.log("\nSau khi chạy xong, refresh app là dùng được.");
  }
}
