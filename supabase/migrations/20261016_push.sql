-- Push-подписки и флаг напоминаний о тренировках.
-- Применить в Supabase Dashboard → SQL Editor (или `supabase db push`).

create table if not exists public.push_subscriptions (
  endpoint text primary key,
  user_id uuid not null references auth.users (id) on delete cascade,
  keys jsonb not null default '{}'::jsonb,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table public.push_subscriptions enable row level security;

-- Пользователь может управлять только своими подписками.
create policy "push_subscriptions_select_own"
  on public.push_subscriptions for select
  using (auth.uid() = user_id);

create policy "push_subscriptions_insert_own"
  on public.push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "push_subscriptions_update_own"
  on public.push_subscriptions for update
  using (auth.uid() = user_id);

create policy "push_subscriptions_delete_own"
  on public.push_subscriptions for delete
  using (auth.uid() = user_id);

-- Флаг «Напоминания о тренировках» в профиле.
alter table public.profiles
  add column if not exists push_reminders_enabled boolean not null default false;
