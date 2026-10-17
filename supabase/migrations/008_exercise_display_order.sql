-- Миграция 008: порядок отображения упражнений (drag-and-drop)
-- Выполняется в Supabase Dashboard -> SQL Editor. Идемпотентна.

alter table public.exercises add column if not exists display_order int default 0;

-- Хранимая функция: сохраняет новый порядок всего списка упражнений.
-- Вызывается из приложения как supabase.rpc('update_exercises_order', { exercise_ids }).
-- SECURITY DEFINER нужен потому, что по RLS пользователь не может UPDATE базовые
-- упражнения справочника (created_by IS NULL), а упорядочивать нужно весь список.
create or replace function public.update_exercises_order(exercise_ids uuid[])
returns void
language sql
security definer
set search_path = public
as $$
  update public.exercises e
  set display_order = ord.n
  from unnest(exercise_ids) with ordinality as ord(id, n)
  where e.id = ord.id
    -- обновляем либо базовые (created_by is null),
    -- либо свои кастомные упражнения текущего пользователя
    and (e.created_by is null or e.created_by = auth.uid());
$$;

-- Разрешаем вызов только авторизованным пользователям
revoke all on function public.update_exercises_order(uuid[]) from public;
grant execute on function public.update_exercises_order(uuid[]) to authenticated;
