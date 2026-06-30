-- Permite guardar quien pasa una eliminatoria si el resultado acaba empatado.
-- Ejecuta esto en Supabase > SQL Editor.

alter table public.matches
  add column if not exists advance_team text;