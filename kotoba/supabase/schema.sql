-- ============================================================
--  Kotoba 言葉 - Supabase schema
--  Chay toan bo file nay trong Supabase Dashboard > SQL Editor
--  Khong can auth. Bang app_state la "user" duy nhat.
-- ============================================================

-- Cot lesson_number se duoc tu tao khi goi RPC create_lesson()
-- (alter table if not exists column). Khong can migration thu cong.

-- 1. Bang trang thai (dung lam nguon su that duy nhat)
create table if not exists public.app_state (
  id                text primary key,
  diamonds          bigint  not null default 0,
  lifetime_diamonds bigint  not null default 0,
  current_streak    integer not null default 0,
  longest_streak    integer not null default 0,
  last_study_date   date,
  last_seen_date    date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

comment on table public.app_state is
  'Single-row table acting as the user profile. No auth required.';

-- 2. Tu vung
create table if not exists public.vocab (
  id            uuid primary key default gen_random_uuid(),
  romaji        text    not null,
  hiragana      text    not null default '',
  katakana      text    not null default '',
  meaning_vi    text    not null,
  note          text,
  lesson_number integer not null default 0,   -- 0 = chưa xếp bài
  study_date    date    not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists vocab_study_date_idx    on public.vocab (study_date desc);
create index if not exists vocab_romaji_idx        on public.vocab (romaji);
create index if not exists vocab_lesson_number_idx on public.vocab (lesson_number);

-- 3. Kanji
create table if not exists public.kanji (
  id            uuid primary key default gen_random_uuid(),
  character     text    not null unique,
  meaning_vi    text    not null,
  onyomi        text    not null default '',
  kunyomi       text    not null default '',
  stroke_count  integer,
  note          text,
  lesson_number integer not null default 0,
  study_date    date    not null default current_date,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists kanji_study_date_idx    on public.kanji (study_date desc);
create index if not exists kanji_lesson_number_idx on public.kanji (lesson_number);

-- 4. Lich su tra loi (cho SRS / thong ke)
create table if not exists public.attempts (
  id         uuid primary key default gen_random_uuid(),
  mode       text    not null,   -- 'vocab' | 'kanji'
  item_id    uuid    not null,
  question   text    not null,
  correct    boolean not null,
  answer_ms  integer,
  combo      integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists attempts_created_idx on public.attempts (created_at desc);
create index if not exists attempts_mode_idx    on public.attempts (mode);

-- 5. Phien hoc (mo khoa vong quay thuong)
create table if not exists public.sessions (
  id              uuid primary key default gen_random_uuid(),
  app_id          text    not null references public.app_state(id) on delete cascade,
  mode            text    not null,   -- 'daily'|'review'|'kanji-daily'|'kanji-review'
  study_date      date    not null default current_date,
  total           integer not null default 0,
  correct         integer not null default 0,
  completed       boolean not null default false,
  diamonds_earned integer not null default 0,
  completed_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (app_id, mode, study_date)
);

create index if not exists sessions_date_idx on public.sessions (study_date desc);

-- 6. Cac lan quay (gacha thuong & gacha phat)
create table if not exists public.spins (
  id         uuid primary key default gen_random_uuid(),
  app_id     text    not null references public.app_state(id) on delete cascade,
  kind       text    not null check (kind in ('reward','penalty')),
  mode       text    not null,
  spin_date  date    not null default current_date,
  amount     integer not null,
  tier_index integer not null,
  reversed   boolean not null default false,
  created_at timestamptz not null default now()
);

-- Moi (mode, ngay, kind) chi quay duoc 1 lan
create unique index spins_once_per_day_idx
  on public.spins (app_id, mode, spin_date, kind);

create index if not exists spins_date_idx on public.spins (spin_date desc);

-- 7. Run history cho rogue-lite (ban do node)
create table if not exists public.runs (
  id         uuid primary key default gen_random_uuid(),
  app_id     text    not null references public.app_state(id) on delete cascade,
  mode       text    not null,
  seed       bigint  not null,
  floor      integer not null default 1,
  hp         integer not null default 3,
  max_hp     integer not null default 3,
  nodes_done integer not null default 0,
  won        boolean not null default false,
  map_state  jsonb   not null default '{}'::jsonb,
  run_date   date    not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists runs_date_idx on public.runs (run_date desc);

-- 8. Bang tra cuu gacha (de app doc, khong nhung mang vao JS)
create table if not exists public.gacha_tiers (
  tier_index  integer primary key,
  label       text    not null,
  amount      integer not null,
  probability double precision not null,
  color       text    not null
);

insert into public.gacha_tiers (tier_index, label, amount, probability, color) values
  (0, '2.000',     2000,  0.4400, '#C1FA87'),
  (1, '5.000',     5000,  0.2500, '#8AF7A6'),
  (2, '10.000',   10000,  0.1500, '#4FF0C6'),
  (3, '20.000',   20000,  0.0800, '#00DAF3'),
  (4, '50.000',   50000,  0.0400, '#2EA8FF'),
  (5, '100.000', 100000,  0.0200, '#7C6CFF'),
  (6, '200.000', 200000,  0.0140, '#C05CFF'),
  (7, '500.000', 500000,  0.0060, '#FF4D9D')
on conflict (tier_index) do update
  set label       = excluded.label,
      amount      = excluded.amount,
      probability = excluded.probability,
      color       = excluded.color;

-- 9. Index tim kiem full-text
create index if not exists vocab_search_idx
  on public.vocab using gin (
    to_tsvector('simple', romaji || ' ' || meaning_vi || ' ' || hiragana || ' ' || katakana)
  );

create index if not exists kanji_search_idx
  on public.kanji using gin (
    to_tsvector('simple', character || ' ' || meaning_vi || ' ' || onyomi || ' ' || kunyomi)
  );

-- ============================================================
--  RLS + POLICY cho anon
--  App khong co dang nhap => policy cho phep anon doc/ghi.
--  Day la chu y cho app ca nhan dung chinh ban.
-- ============================================================
alter table public.app_state   enable row level security;
alter table public.vocab       enable row level security;
alter table public.kanji       enable row level security;
alter table public.attempts    enable row level security;
alter table public.sessions    enable row level security;
alter table public.spins       enable row level security;
alter table public.runs        enable row level security;
alter table public.gacha_tiers enable row level security;

drop policy if exists "gacha_tiers_read" on public.gacha_tiers;
create policy "gacha_tiers_read" on public.gacha_tiers
  for select to anon, authenticated using (true);

drop policy if exists "app_state_all" on public.app_state;
create policy "app_state_all" on public.app_state
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "vocab_all" on public.vocab;
create policy "vocab_all" on public.vocab
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "kanji_all" on public.kanji;
create policy "kanji_all" on public.kanji
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "attempts_all" on public.attempts;
create policy "attempts_all" on public.attempts
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "sessions_all" on public.sessions;
create policy "sessions_all" on public.sessions
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "spins_all" on public.spins;
create policy "spins_all" on public.spins
  for all to anon, authenticated using (true) with check (true);

drop policy if exists "runs_all" on public.runs;
create policy "runs_all" on public.runs
  for all to anon, authenticated using (true) with check (true);

-- ============================================================
--  RPC: cap nhat vi an toan (atomic, tranh race khi quay gacha)
-- ============================================================
create or replace function public.apply_wallet(p_app_id text, p_delta bigint)
returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  v_new bigint;
begin
  update public.app_state
     set diamonds         = greatest(0, diamonds + p_delta),
         lifetime_diamonds = lifetime_diamonds + greatest(0, p_delta),
         updated_at        = now()
   where id = p_app_id
  returning diamonds into v_new;

  return coalesce(v_new, 0);
end;
$$;

-- ============================================================
--  RPC: chay ngay moi - phat hien ngay bo hoc
--  Tra ve so ngay da bo (0 = hom nay van chua hoc)
-- ============================================================
create or replace function public.touch_day(
  p_app_id text,
  p_date   date default current_date
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_last   date;
  v_missed integer := 0;
begin
  select last_seen_date into v_last
    from public.app_state
   where id = p_app_id
   for update;

  if v_last is null then
    v_last := p_date;
  elsif v_last < p_date then
    v_missed := (p_date - v_last) - 1;
    if v_missed < 0 then v_missed := 0; end if;
  end if;

  update public.app_state
     set last_seen_date = greatest(coalesce(last_seen_date, p_date), p_date),
         updated_at     = now()
   where id = p_app_id;

  return v_missed;
end;
$$;

-- ============================================================
--  RPC: dang ky phien hoc. Tra ve id neu moi, null neu da co.
--  Khoa chong nhieu phion cung ngay/mode.
-- ============================================================
create or replace function public.start_session(
  p_app_id text,
  p_mode   text,
  p_date   date default current_date
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_id uuid;
begin
  insert into public.sessions (app_id, mode, study_date, total, correct)
  values (p_app_id, p_mode, p_date, 0, 0)
  on conflict (app_id, mode, study_date) do nothing
  returning id into v_id;

  return v_id;
end;
$$;

-- ============================================================
--  RPC: chot phien + cong chuoi ngay + quyet dinh quay gacha
-- ============================================================
create or replace function public.complete_session(
  p_app_id   text,
  p_session  uuid,
  p_total    integer,
  p_correct  integer,
  p_diamonds integer,
  p_date     date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prev    public.sessions%rowtype;
  v_row     public.sessions%rowtype;
  v_streak  integer;
  v_diamond boolean;
begin
  -- Doc trang thai TRUOC khi update
  select * into v_prev
    from public.sessions
   where id = p_session and app_id = p_app_id;

  if v_prev.id is null then
    return jsonb_build_object('ok', false, 'reason', 'session_not_found');
  end if;

  -- Da chot roi -> tra ket qua cu, khong cong streak lan nua
  if v_prev.completed then
    return jsonb_build_object(
      'ok', true,
      'already_completed', true,
      'diamonds', v_prev.diamonds_earned,
      'earned',   (v_prev.total > 0
                    and v_prev.correct::numeric / greatest(v_prev.total, 1) >= 0.8)
    );
  end if;

  update public.sessions
     set total           = p_total,
         correct         = p_correct,
         diamonds_earned = p_diamonds,
         completed       = true,
         completed_at    = now()
   where id = p_session and app_id = p_app_id
  returning * into v_row;

  -- Cong chuoi ngay lien tiep (chi tinh 1 lan / phien)
  select case
           when last_study_date = p_date - 1 then current_streak + 1
           when last_study_date = p_date     then current_streak
           else 1
         end
    into v_streak
    from public.app_state
   where id = p_app_id;

  update public.app_state
     set current_streak = v_streak,
         longest_streak  = greatest(longest_streak, v_streak),
         last_study_date = p_date,
         updated_at      = now()
   where id = p_app_id;

  -- Dat 80% de mo khoa vong quay thuong
  v_diamond := (p_total > 0
                and p_correct::numeric / greatest(p_total, 1) >= 0.8);

  return jsonb_build_object(
    'ok',       true,
    'diamonds', v_row.diamonds_earned,
    'streak',   v_streak,
    'earned',   v_diamond
  );
end;
$$;

-- ============================================================
--  RPC: quay gacha - atomic, chong quay trung trong ngay
--  Tra ve: { ok, amount, tier_index, diamonds, streak, reversed }
-- ============================================================
create or replace function public.spin_wheel(
  p_app_id     text,
  p_kind       text,
  p_mode       text,
  p_tier_index integer,
  p_amount     integer,
  p_reversed   boolean default false,
  p_date       date default current_date
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance bigint;
  v_streak  integer;
begin
  insert into public.spins (app_id, kind, mode, spin_date, amount, tier_index, reversed)
  values (p_app_id, p_kind, p_mode, p_date, p_amount, p_tier_index, p_reversed)
  on conflict (app_id, mode, spin_date, kind) do nothing;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'already_spun_today');
  end if;

  v_balance := public.apply_wallet(
    p_app_id,
    case when p_kind = 'penalty' then -abs(p_amount) else abs(p_amount) end
  );

  select current_streak into v_streak
    from public.app_state where id = p_app_id;

  return jsonb_build_object(
    'ok',        true,
    'amount',    p_amount,
    'tier_index', p_tier_index,
    'diamonds',  v_balance,
    'streak',    v_streak,
    'reversed',  p_reversed
  );
end;
$$;

-- ============================================================
--  RPC: tu dong them cot lesson_number neu chua co, roi gan
--  tat ca item chua xep bai (lesson_number = 0) sang bai `p_lesson`.
--  Tra ve { ok, lesson, moved_vocab, moved_kanji, added_column }.
-- ============================================================
create or replace function public.create_lesson(
  p_lesson integer
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_added boolean := false;
  v_vocab_count integer := 0;
  v_kanji_count integer := 0;
begin
  -- Tu them cot neu bang da ton tai tu truoc migration moi
  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'vocab'
       and column_name = 'lesson_number'
  ) then
    alter table public.vocab add column lesson_number integer not null default 0;
    create index if not exists vocab_lesson_number_idx on public.vocab (lesson_number);
    v_added := true;
  end if;

  if not exists (
    select 1 from information_schema.columns
     where table_schema = 'public' and table_name = 'kanji'
       and column_name = 'lesson_number'
  ) then
    alter table public.kanji add column lesson_number integer not null default 0;
    create index if not exists kanji_lesson_number_idx on public.kanji (lesson_number);
    v_added := true;
  end if;

  update public.vocab
     set lesson_number = p_lesson, updated_at = now()
   where lesson_number = 0;
  get diagnostics v_vocab_count = row_count;

  update public.kanji
     set lesson_number = p_lesson, updated_at = now()
   where lesson_number = 0;
  get diagnostics v_kanji_count = row_count;

  return jsonb_build_object(
    'ok',           true,
    'lesson',       p_lesson,
    'moved_vocab',  v_vocab_count,
    'moved_kanji',  v_kanji_count,
    'added_column', v_added
  );
end;
$$;

-- ============================================================
--  XONG. Kiem tra:
--    select * from public.gacha_tiers order by tier_index;
--    select sum(probability) from public.gacha_tiers;  -- phai = 1
-- ============================================================