-- Actualiza los octavos confirmados a 01/07/2026.
-- Fuente verificada: SB Nation, actualizado el 01/07/2026.
-- Ejecuta este archivo en Supabase > SQL Editor.

insert into public.matches (id, group_name, home_team, away_team, match_date) values
  ('m89','Octavos','Paraguay','Francia','2026-07-04T18:00:00+02'),
  ('m90','Octavos','Canadá','Marruecos','2026-07-05T00:00:00+02'),
  ('m91','Octavos','Brasil','Noruega','2026-07-05T03:00:00+02'),
  ('m92','Octavos','México','Inglaterra','2026-07-05T22:00:00+02')
on conflict (id) do update set
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  match_date = excluded.match_date;