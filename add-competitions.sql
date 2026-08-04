-- Añade soporte de competiciones en la misma app.
-- Mundial existente queda como competition = 'mundial'.
-- Liga BBVA usara competition = 'liga'.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

alter table public.pools
  add column if not exists competition text not null default 'mundial';

alter table public.matches
  add column if not exists competition text not null default 'mundial';

alter table public.predictions
  add column if not exists competition text not null default 'mundial';

alter table public.messages
  add column if not exists competition text not null default 'mundial';

update public.pools set competition = 'mundial' where competition is null;
update public.matches set competition = 'mundial' where competition is null;
update public.predictions set competition = 'mundial' where competition is null;
update public.messages set competition = 'mundial' where competition is null;

-- Las porras de Liga BBVA se crean desde la app seleccionando "Liga BBVA".