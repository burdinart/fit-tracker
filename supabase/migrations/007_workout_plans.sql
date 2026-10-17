-- Система планов тренировок (workout plans).
-- Применить в Supabase Dashboard → SQL Editor (или `supabase db push`).

-- Таблица планов тренировок (шаблонов)
create table if not exists public.workout_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade not null,
  name text not null,
  description text,
  day_of_week text, -- 'monday', 'tuesday', etc. (опционально для расписания)
  created_at timestamptz default now()
);

-- Таблица упражнений внутри плана
create table if not exists public.workout_plan_exercises (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid references public.workout_plans(id) on delete cascade not null,
  exercise_id uuid references public.exercises(id) on delete cascade not null,
  "order" int default 0,
  target_sets int default 3,
  target_reps int default 10,
  target_weight numeric default 0,
  rest_time_sec int default 90,
  notes text
);

-- Включаем RLS
alter table public.workout_plans enable row level security;
alter table public.workout_plan_exercises enable row level security;

-- Индексы для быстрых выборок
create index if not exists workout_plans_user_id_idx on public.workout_plans(user_id);
create index if not exists workout_plan_exercises_plan_id_idx on public.workout_plan_exercises(plan_id);

-- Политики RLS (идемпотентно: drop + create)
drop policy if exists "Users can view own plans" on public.workout_plans;
create policy "Users can view own plans" on public.workout_plans
  for select using (auth.uid() = user_id);

drop policy if exists "Users can insert own plans" on public.workout_plans;
create policy "Users can insert own plans" on public.workout_plans
  for insert with check (auth.uid() = user_id);

drop policy if exists "Users can update own plans" on public.workout_plans;
create policy "Users can update own plans" on public.workout_plans
  for update using (auth.uid() = user_id);

drop policy if exists "Users can delete own plans" on public.workout_plans;
create policy "Users can delete own plans" on public.workout_plans
  for delete using (auth.uid() = user_id);

drop policy if exists "Users can view own plan exercises" on public.workout_plan_exercises;
create policy "Users can view own plan exercises" on public.workout_plan_exercises
  for select using (
    exists (select 1 from public.workout_plans where id = plan_id and user_id = auth.uid())
  );

drop policy if exists "Users can insert own plan exercises" on public.workout_plan_exercises;
create policy "Users can insert own plan exercises" on public.workout_plan_exercises
  for insert with check (
    exists (select 1 from public.workout_plans where id = plan_id and user_id = auth.uid())
  );

drop policy if exists "Users can update own plan exercises" on public.workout_plan_exercises;
create policy "Users can update own plan exercises" on public.workout_plan_exercises
  for update using (
    exists (select 1 from public.workout_plans where id = plan_id and user_id = auth.uid())
  );

drop policy if exists "Users can delete own plan exercises" on public.workout_plan_exercises;
create policy "Users can delete own plan exercises" on public.workout_plan_exercises
  for delete using (
    exists (select 1 from public.workout_plans where id = plan_id and user_id = auth.uid())
  );
