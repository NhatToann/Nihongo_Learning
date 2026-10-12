# 言葉 Kotoba

Web học từ vựng & kanji tiếng Nhật cho cá nhân — trắc nghiệm xáo trộn, vòng quay gacha mỗi ngày, và chế độ roguelike.

---

## Yêu cầu

- Node.js 20+ (khuyến nghị 22 hoặc 24)
- Tài khoản Supabase miễn phí
- Tài khoản Vercel miễn phí

> Không muốn cấu hình Supabase ngay? Thêm `NEXT_PUBLIC_DEMO_MODE=true` vào `.env.local` để dùng dữ liệu mẫu (20 từ + 10 kanji, 12 ngày streak, 128.450 diamond). App tự động fallback sang demo nếu không kết nối được Supabase.

---

## Setup trong 5 bước

### 1. Cài dependencies

```bash
npm install
```

### 2. Tạo project Supabase

1. Vào [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Đặt tên, chọn region gần bạn (Singapore), đặt mật khẩu DB
3. Đợi vài phút để project sẵn sàng

### 3. Tạo bảng dữ liệu

1. Trong project, chọn **SQL Editor** ở menu bên trái → **New query**
2. Mở file `supabase/schema.sql` trong project này, copy **toàn bộ** nội dung
3. Dán vào editor → bấm **Run**

Sau khi chạy xong, kiểm tra bảng đã đủ:

```sql
select * from gacha_tiers order by tier_index;
select sum(probability) from gacha_tiers;  -- phải bằng 1.0
```

Nếu `sum(probability)` = `1.0` thì schema đã đúng.

### 4. Tạo file `.env.local`

Copy file mẫu:

```bash
cp .env.example .env.local
```

Lấy 2 giá trị từ **Project Settings → API**:
- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

File `.env.local` cuối cùng:

```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xxxxx.xxxxx
```

### 5. Chạy app

```bash
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000).

---

## Tính năng

### Nhập từ mới
Tab **Học từ** → nhập mỗi dòng một từ theo định dạng `romaji, nghĩa tiếng Việt`:

```
nihongo, tiếng Nhật
sakura, hoa anh đào # ghi chú tuỳ chọn
renshuu 練習, luyện tập
```

Romaji được tự động chuyển thành hiragana + katakana:

| Nhập vào | Kết quả |
|---|---|
| `nihongo` | にほんご / ニホンゴ |
| `shouyou` | しょうよう / ショウヨウ |
| `renshuu` | れんしゅう / レンシュウ |
| `ryouri` | りょうり / リョウリ |
| `kaizen` | かいぜん / カイゼン |
| `日本語` | hỏi thêm romaji `nihongo` để tạo kana |

Nghĩa tiếng Việt giữ nguyên. Ghi chú tuỳ chọn sau `#` hoặc `;`.

### Học từ mới hôm nay
Tab **Trang chính** → *Học từ mới hôm nay*. Xáo trộn ngẫu nhiên từ của ngày, hỏi 2 chiều:
- Tiếng Nhật → nghĩa tiếng Việt
- Nghĩa tiếng Việt → tiếng Nhật

Mỗi câu đúng 10 diamond, liên hoàn sẽ nhân dần (tối đa ×3).

### Ôn tập tổng hợp
Tab **Ôn tập** → xáo toàn bộ dữ liệu thành bộ trắc nghiệm. Chọn giới hạn: 10 / 20 / 50 / 100 / tất cả.

### Mode kanji
Tab **Kanji**. Nhập kanji ở định dạng `kanji, nghĩa, onyomi, kunyomi`.
Hỏi 3 kiểu: kanji → nghĩa, nghĩa → kanji, kanji → cách đọc.

### Vòng quay gacha
Hoàn thành bài với **≥ 80% chính xác** → mở vòng thưởng. **1 lần/ngày/mode**.

| Mệnh | Tỉ lệ |
|---|---|
| 2.000 | 44,0% |
| 5.000 | 25,0% |
| 10.000 | 15,0% |
| 20.000 | 8,0% |
| 50.000 | 4,0% |
| 100.000 | 2,0% |
| 200.000 | 1,4% |
| 500.000 | 0,6% |

Mệnh giá càng lớn tỉ lệ càng giảm, mệnh lớn nhất **0,6%** (dưới 1%).

### Vòng quay phạt
Nếu bạn **bỏ học 1 ngày**, lần vào app sau sẽ có vòng quay phạt — quay **ngược chiều kim đồng hồ**, **trừ** diamond theo cùng bảng tỉ lệ. Cũng giới hạn 1 lần/ngày/mode.

### Lục địa (roguelike)
Tab **Trang chính** → phần *Chế độ nâng cao*. Bản đồ 8 tầng dạng nhánh với 5 loại node:

- ⚔️ **Trận thường** — 3 câu, sai >1 mất 1 HP
- 💀 **Trận tinh** — 4 câu, sai >2 mất 1 HP, thưởng ×2
- 🍙 **Nghỉ ngơi** — hồi 1 HP
- 🏪 **Cửa hàng** — điểm dừng
- 👑 **BOSS** — 6 câu, thắng = hoàn thành run

Bắt đầu với 3 HP. Sai quá nhiều sẽ mất HP, hết HP là thua.

---

## Cấu trúc project

```
app/
  layout.tsx           fonts + metadata
  globals.css          design tokens (neon palette) + component classes
  page.tsx             entry point

lib/
  types.ts             domain types
  romaji.ts            romaji <-> kana engine (wanakana)
  quiz.ts              câu hỏi, xáo trộn, combo, chấm điểm
  gacha.ts             bảng tỉ lệ, roll, tính góc vòng quay
  rogue.ts             sinh bản đồ roguelike
  supabase/
    client.ts          Supabase client + hàm ngày theo giờ VN
    queries.ts         toàn bộ truy vấn dữ liệu

components/
  kotoba-app.tsx       app shell, điều phối state
  quiz-player.tsx      màn hình quiz (dùng chung 4 mode)
  gacha-wheel.tsx      vòng quay SVG
  result-screen.tsx    kết quả + mở vòng quay
  rogue-screen.tsx     bản đồ roguelike
  screens.tsx          loading + hướng dẫn setup
  ui.tsx               component dùng chung
  tabs/                5 tab chính

supabase/
  schema.sql           toàn bộ bảng + RPC + RLS
```

---

## Tùy chỉnh

### Đổi tỉ lệ gacha
Sửa trực tiếp trong Supabase → bảng `gacha_tiers` → cột `probability`.
App tự chuẩn hoá để tổng luôn bằng 1.

Hoặc sửa fallback trong `lib/gacha.ts` (`DEFAULT_TIERS`).

### Đổi điểm thưởng
Trong `lib/quiz.ts`:
- `BASE_PER_CORRECT = 10` — diamond mỗi câu đúng
- `COMBO_STEP = 0.1` — bước nhân mỗi combo
- `COMBO_MAX_MULT = 3` — hệ số tối đa

### Đổi ngưỡng mở vòng thưởng
Trong `lib/gacha.ts`: `REWARD_ACCURACY = 0.8` (80%).

### Đổi màu giao diện
Trong `app/globals.css`, phần `@theme`:
```css
--color-mint: #4FF0C6;
--color-cyan: #00DAF3;
--color-lime: #C1FA87;
```

### Đổi số tầng roguelike
Trong `lib/rogue.ts`: `RUN_CONFIG.rows = 8`.

---

## Deploy lên Vercel

1. Đẩy code lên GitHub
2. Vào [vercel.com/new](https://vercel.com/new), import repository
3. Thêm 2 environment variables:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy

Sau đó vào **Project Settings → Domains** để gắn tên miền riêng.

### Lưu ý bảo mật
App không có đăng nhập, dùng anon key — anon key có thể đọc công khai trong bundle. Điều này chấp nhận được cho app cá nhân dùng một mình bạn, nhưng **không** phù hợp nếu app được mở cho nhiều người dùng. Schema đã bật RLS với policy `for all to anon`; nếu cần siết hơn, hãy thêm điều kiện lọc theo `app_id`.

---

## Script kiểm tra

```bash
npx tsx scripts/check-romaji.ts   # kiểm tra chuyển romaji
npx tsx scripts/check-quiz.ts     # kiểm tra quiz, combo, tỉ lệ gacha
```

---

## Phím tắt trong quiz

- `1` `2` `3` `4` — chọn đáp án
- `Enter` / `Space` — sang câu tiếp theo