-- Porra MIX: elecciones de campeones por usuario y campeones reales por porra.
-- No borra datos existentes.

alter table public.pool_members
  add column if not exists mix_picks jsonb not null default '{}'::jsonb;

alter table public.pools
  add column if not exists mix_results jsonb not null default '{}'::jsonb;
