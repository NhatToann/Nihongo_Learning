-- ============================================================
--  Kotoba 言葉 — Migration tự động
--  Chạy trong Supabase Dashboard > SQL Editor
--  An toàn chạy nhiều lần (IF NOT EXISTS / CREATE OR REPLACE)
-- ============================================================

-- 1. Cột lesson_number
alter table public.vocab add column if not exists lesson_number integer not null default 0;
alter table public.kanji add column if not exists lesson_number integer not null default 0;

-- 2. Index cho query theo bài
create index if not exists vocab_lesson_number_idx on public.vocab (lesson_number);
create index if not exists kanji_lesson_number_idx on public.kanji (lesson_number);

-- 3. RPC: gộp tất cả item chưa xếp bài (lesson=0) sang bài p_lesson
create or replace function public.create_lesson(p_lesson integer)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_vocab_count integer := 0;
  v_kanji_count integer := 0;
begin
  update public.vocab
     set lesson_number = p_lesson, updated_at = now()
   where lesson_number = 0;
  get diagnostics v_vocab_count = row_count;

  update public.kanji
     set lesson_number = p_lesson, updated_at = now()
   where lesson_number = 0;
  get diagnostics v_kanji_count = row_count;

  return jsonb_build_object(
    'ok',          true,
    'lesson',      p_lesson,
    'moved_vocab', v_vocab_count,
    'moved_kanji', v_kanji_count
  );
end;
$$;

-- 4. Cho phép anon + authenticated gọi RPC
grant execute on function public.create_lesson(integer) to anon, authenticated;

-- 5. Reload schema cache (PostgREST sẽ refresh sau 1-2 phút hoặc tự động)
notify pgrst, 'reload config';

-- Kiểm tra:
-- select * from public.create_lesson(1);
-- select column_name from information_schema.columns where table_name in ('vocab','kanji') and column_name = 'lesson_number';
