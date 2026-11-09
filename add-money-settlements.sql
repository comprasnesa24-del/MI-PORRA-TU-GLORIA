-- Historial de cierres de las cuentas economicas de cada porra.
-- No borra jornadas, resultados ni cierres anteriores.

alter table public.pools
  add column if not exists money_settlements jsonb not null default '[]'::jsonb;
