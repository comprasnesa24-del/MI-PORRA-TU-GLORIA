-- Parche no destructivo para activar el chat de cada porra.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  pool_id uuid not null references public.pools(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.messages add column if not exists body text;
alter table public.messages add column if not exists created_at timestamptz default now();

create index if not exists messages_pool_created_idx
  on public.messages (pool_id, created_at);

alter table public.messages enable row level security;

drop policy if exists "messages read all" on public.messages;
drop policy if exists "messages insert all" on public.messages;
drop policy if exists "messages delete all" on public.messages;

create policy "messages read all"
  on public.messages for select
  using (true);

create policy "messages insert all"
  on public.messages for insert
  with check (true);

create policy "messages delete all"
  on public.messages for delete
  using (true);
