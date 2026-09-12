-- Permite que una porra tenga varias competiciones activas.
-- Es no destructivo: mantiene la columna antigua "competition" para compatibilidad.

alter table public.pools
  add column if not exists competitions jsonb not null default '[]'::jsonb;

update public.pools
set competitions = to_jsonb(array[coalesce(nullif(competition, ''), 'mundial')])
where competitions = '[]'::jsonb;

