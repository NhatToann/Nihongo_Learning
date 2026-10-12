import type { Metadata, Viewport } from "next";
import { Be_Vietnam_Pro, Fredoka, Noto_Sans_JP } from "next/font/google";
import "./globals.css";

const beVietnam = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  variable: "--font-bevietnam",
  weight: ["400", "500", "600", "700", "800"],
  display: "swap",
});

const fredoka = Fredoka({
  subsets: ["latin"],
  variable: "--font-fredoka",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const notoJp = Noto_Sans_JP({
  subsets: ["latin"],
  variable: "--font-noto-jp",
  weight: ["400", "500", "700", "900"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Kotoba 言葉 — Học từ vựng Nhật",
    template: "%s · Kotoba",
  },
  description:
    "Học từ vựng & kanji tiếng Nhật bằng trắc nghiệm xáo trộn, quay gacha mỗi ngày và bản đồ roguelike.",
  applicationName: "Kotoba",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Kotoba" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#4FF0C6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${beVietnam.variable} ${fredoka.variable} ${notoJp.variable}`}
    >
      <body>
        <div className="relative mx-auto min-h-dvh w-full max-w-[520px] px-4 pb-28 pt-5">
          {children}
        </div>
      </body>
    </html>
  );
}
