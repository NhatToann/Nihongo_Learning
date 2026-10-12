import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ═══════════════════════════════════════════════════════════════
//  Supabase client (anon key, không auth)
// ═══════════════════════════════════════════════════════════════

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** true khi đã cấu hình env đúng */
export const isSupabaseConfigured = Boolean(url && key);

/** ID cố định — app cá nhân, 1 người dùng */
export const APP_ID = "default";

let cached: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (!url || !key) {
    throw new Error(
      "Thieu NEXT_PUBLIC_SUPABASE_URL hoac NEXT_PUBLIC_SUPABASE_ANON_KEY trong .env.local",
    );
  }
  if (!cached) {
    cached = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "kotoba" } },
    });
  }
  return cached;
}

// ═══════════════════════════════════════════════════════════════
//  Ngay hom nay theo mui gio VN (UTC+7)
// ═══════════════════════════════════════════════════════════════

/** Tra ve 'YYYY-MM-DD' theo gio Viet Nam */
export function todayVN(): string {
  return new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10);
}

/** Ngay truoc do theo gio VN */
export function yesterdayVN(): string {
  return daysAgoVN(1);
}

/** Ngay cach `days` ngay truoc, theo gio VN */
export function daysAgoVN(days: number): string {
  const d = new Date(Date.now() + 7 * 3600_000);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

/** So ngay lich giua hai chuoi YYYY-MM-DD */
export function daysBetween(a: string, b: string): number {
  const da = Date.parse(`${a}T00:00:00Z`);
  const db = Date.parse(`${b}T00:00:00Z`);
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.round((db - da) / 86_400_000);
}