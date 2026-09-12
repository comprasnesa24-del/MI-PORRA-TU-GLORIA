-- Soporte para porras con varias ligas y Copa del Rey.
-- Ejecutar una vez en Supabase > SQL Editor.

alter table public.pool_members
  add column if not exists league_table_picks jsonb not null default '{}'::jsonb;

alter table public.pool_members
  add column if not exists cup_picks jsonb not null default '{}'::jsonb;

alter table public.pools
  add column if not exists cup_results jsonb not null default '{}'::jsonb;

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'pool_members'
      and column_name = 'league_table_pick'
  ) then
    update public.pool_members pm
    set league_table_picks = jsonb_build_object(coalesce(nullif(p.competition, ''), 'liga'), pm.league_table_pick)
    from public.pools p
    where p.id = pm.pool_id
      and pm.league_table_pick is not null
      and pm.league_table_picks = '{}'::jsonb;
  end if;
end $$;
