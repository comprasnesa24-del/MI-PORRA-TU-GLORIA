-- Automatic scorer support for Liga BBVA via API-Football.
-- Non-destructive: it only adds missing columns/indexes and creates team_players if needed.

alter table public.matches
  add column if not exists real_scorers text;

alter table public.matches
  add column if not exists external_source text;

alter table public.matches
  add column if not exists external_id text;

alter table public.matches
  add column if not exists external_status text;

alter table public.matches
  add column if not exists result_updated_at timestamptz;

create unique index if not exists matches_external_source_id_idx
  on public.matches (external_source, external_id);

create table if not exists public.team_players (
  id bigserial primary key,
  team_code text not null,
  team_name text,
  player_name text not null,
  position text,
  created_at timestamptz not null default now()
);

alter table public.team_players
  add column if not exists team_code text;

alter table public.team_players
  add column if not exists team_name text;

alter table public.team_players
  add column if not exists player_name text;

alter table public.team_players
  add column if not exists position text;

create unique index if not exists team_players_team_code_player_name_idx
  on public.team_players (team_code, player_name);

alter table public.team_players enable row level security;

drop policy if exists "team_players read all" on public.team_players;
create policy "team_players read all" on public.team_players for select using (true);
