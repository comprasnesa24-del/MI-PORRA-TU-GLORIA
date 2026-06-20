-- Guarda cuándo modificó el admin por última vez el resultado de un partido.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

alter table public.matches
  add column if not exists result_updated_at timestamptz;
