"use client";

import type { GachaTier } from "@/lib/types";
import { expectedValue } from "@/lib/gacha";
import { formatNumber } from "@/components/ui";

interface SettingsTabProps {
  tiers: GachaTier[];
}

export function SettingsTab({ tiers }: SettingsTabProps) {
  const ev = expectedValue(tiers);

  return (
    <div>
      <div className="pt-1">
        <h1 className="text-[1.5rem] font-extrabold tracking-tight">Cai dat</h1>
        <div className="rainbow-line mt-3 h-[3px] w-full rounded-full opacity-90" />
      </div>

      <section className="card mt-5 overflow-hidden">
        <div className="border-b border-line px-4 py-3.5">
          <p className="text-[0.85rem] font-bold">Bang ti le vong quay</p>
          <p className="mt-0.5 text-[0.72rem] text-ink-soft">
            Sua truc tiep trong Supabase, bang{" "}
            <code className="font-bold">gacha_tiers</code>
          </p>
        </div>

        <div className="divide-y divide-line">
          {tiers.map((t) => (
            <div key={t.tier_index} className="flex items-center gap-3 px-4 py-2.5">
              <span
                className="size-3 shrink-0 rounded-full"
                style={{ background: t.color }}
              />
              <span className="w-20 shrink-0 text-[0.85rem] font-extrabold tabular-nums">
                {t.label}
              </span>
              <div className="min-w-0 flex-1">
                <div
                  className="h-2 rounded-full"
                  style={{
                    width: `${Math.max(3, t.probability * 100)}%`,
                    background: `linear-gradient(90deg, ${t.color}, ${t.color}88)`,
                  }}
                />
              </div>
              <span className="w-14 shrink-0 text-right text-[0.78rem] font-bold tabular-nums text-ink-soft">
                {(t.probability * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-between border-t border-line bg-mist px-4 py-3">
          <span className="text-[0.75rem] font-semibold text-ink-soft">
            Gia tri ky vong / luot
          </span>
          <span className="text-[0.85rem] font-extrabold tabular-nums">
            {formatNumber(Math.round(ev))} diamond
          </span>
        </div>
      </section>

      <section className="card mt-4 px-4 py-4">
        <p className="text-[0.85rem] font-bold">Dieu kien nhan thuong</p>
        <ul className="mt-2.5 space-y-1.5 text-[0.78rem] leading-relaxed text-ink-soft">
          <li>- Dat <b className="text-ink">80% tro len</b> chinh xac de mo vong thuong</li>
          <li>- <b className="text-ink">1 lan/ngay/mode</b> moi mode chi quay thuong 1 lan</li>
          <li>- Bo hoc 1 ngay se mo vong phat, quay nguoc chieu kim do ho</li>
          <li>- Vong phat cung gioi han 1 lan/ngay/mode</li>
        </ul>
      </section>

      <section className="card mt-4 px-4 py-4">
        <p className="text-[0.85rem] font-bold">Ve Kotoba</p>
        <div className="mt-2.5 space-y-1.5 text-[0.76rem] text-ink-soft">
          <p>Stack: Next.js 16, TypeScript, Tailwind v4, Supabase, Vercel</p>
          <p>Engine kana: wanakana. Hieu ung: framer-motion + canvas-confetti</p>
          <p className="mt-2 font-semibold text-ink">
            Chuoc ban hoc deu moi ngay
          </p>
        </div>
      </section>
    </div>
  );
}