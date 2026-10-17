-- 006_add_custom_exercises.sql
-- Пользовательские упражнения: авторство (created_by) и флаг is_custom + RLS-политики.
-- Применить в Supabase Dashboard → SQL Editor (или `supabase db push`).

-- Добавляем поля для отслеживания авторства упражнения
alter table public.exercises add column if not exists created_by uuid references auth.users(id) default null;
alter table public.exercises add column if not exists is_custom boolean default false;

-- Обновляем RLS: пользователи могут читать все упражнения, но изменять/удалять только свои
-- Идемпотентно: сначала удаляем политики с такими именами, если они уже существуют
-- (Postgres не поддерживает "create policy if not exists").
drop policy if exists "Enable insert for authenticated users only" on public.exercises;
drop policy if exists "Users can insert custom exercises" on public.exercises;
drop policy if exists "Users can update own custom exercises" on public.exercises;
drop policy if exists "Users can delete own custom exercises" on public.exercises;

create policy "Users can insert custom exercises" on public.exercises
  for insert with check (auth.uid() is not null);

create policy "Users can update own custom exercises" on public.exercises
  for update using (auth.uid() = created_by);

create policy "Users can delete own custom exercises" on public.exercises
  for delete using (auth.uid() = created_by);

-- Политика чтения: все упражнения (базовые + пользовательские) видны авторизованным.
-- Postgres не поддерживает "create policy if not exists", поэтому сначала drop, затем create.
drop policy if exists "Exercises are viewable by everyone" on public.exercises;
create policy "Exercises are viewable by everyone" on public.exercises
  for select using (true);
