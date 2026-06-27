-- Añade la elección de campeón, segundo y tercero del Mundial.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

alter table public.pool_members
  add column if not exists champion_pick text,
  add column if not exists second_pick text,
  add column if not exists third_pick text;

alter table public.pools
  add column if not exists real_champion text,
  add column if not exists real_second text,
  add column if not exists real_third text;

drop policy if exists "pool_members update all" on public.pool_members;
create policy "pool_members update all"
  on public.pool_members for update
  using (true)
  with check (true);
