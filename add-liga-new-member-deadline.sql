-- Permite que usuarios nuevos de una porra de Liga tengan 24 horas para guardar su clasificacion final.
-- No reabre el plazo a los miembros antiguos: se les deja como si hubieran entrado antes del inicio.

alter table public.pool_members
  add column if not exists joined_at timestamptz;

update public.pool_members
set joined_at = coalesce(
  joined_at,
  (select min(match_date) from public.matches where competition = 'liga') - interval '25 hours'
)
where joined_at is null;

alter table public.pool_members
  alter column joined_at set default now();
