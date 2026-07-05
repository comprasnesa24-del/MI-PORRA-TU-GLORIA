-- Actualiza horarios y cruces de octavos confirmados.
-- Fuente: SB Nation, actualizado 04/07/2026. Horarios publicados en Eastern; aquí convertidos a Europe/Madrid (+6h).
-- Ejecutar en Supabase > SQL Editor.

insert into public.matches (id, group_name, home_team, away_team, match_date) values
  ('m89','Octavos','Canadá','Marruecos','2026-07-04T19:00:00+02'),
  ('m90','Octavos','Paraguay','Francia','2026-07-04T23:00:00+02'),
  ('m91','Octavos','Brasil','Noruega','2026-07-05T22:00:00+02'),
  ('m92','Octavos','México','Inglaterra','2026-07-06T02:00:00+02'),
  ('m93','Octavos','Portugal','España','2026-07-06T21:00:00+02'),
  ('m94','Octavos','Estados Unidos','Bélgica','2026-07-07T02:00:00+02'),
  ('m95','Octavos','Argentina','Egipto','2026-07-07T18:00:00+02'),
  ('m96','Octavos','Suiza','Colombia','2026-07-07T22:00:00+02')
on conflict (id) do update set
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  match_date = excluded.match_date;