-- Añade las predicciones opcionales de MVP y expulsión sin borrar datos existentes.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

alter table public.pools
  add column if not exists enable_mvp boolean not null default false;

alter table public.predictions
  add column if not exists mvp_prediction text;

alter table public.matches
  add column if not exists real_mvp text;

alter table public.pools
  add column if not exists enable_sent_off boolean not null default false;

alter table public.predictions
  add column if not exists sent_off_prediction text;

alter table public.matches
  add column if not exists real_sent_off text;
