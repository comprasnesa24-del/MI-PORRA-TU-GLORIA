-- Premios y sanciones economicas por jornada.
-- No borra datos existentes.

alter table public.pools
  add column if not exists round_money_rules jsonb not null default '[]'::jsonb;