-- Fija los horarios desde octavos hasta la final en hora de España (Europe/Madrid, UTC+02).
-- Fuentes revisadas el 06/07/2026:
-- - What Hi-Fi?: calendario completo en ET/PT/BST, actualizado 06/07/2026.
-- - Economic Times: cruces y horarios de octavos/cuartos/semis/final en IST, actualizado 06/07/2026.
-- Ejecutar en Supabase > SQL Editor.

insert into public.matches (id, group_name, home_team, away_team, match_date) values
  -- Octavos
  ('m89','Octavos','Paraguay','Francia','2026-07-04T23:00:00+02'),
  ('m90','Octavos','Canadá','Marruecos','2026-07-04T19:00:00+02'),
  ('m91','Octavos','Brasil','Noruega','2026-07-05T22:00:00+02'),
  ('m92','Octavos','México','Inglaterra','2026-07-06T02:00:00+02'),
  ('m93','Octavos','Portugal','España','2026-07-06T21:00:00+02'),
  ('m94','Octavos','Estados Unidos','Bélgica','2026-07-07T02:00:00+02'),
  ('m95','Octavos','Argentina','Egipto','2026-07-07T18:00:00+02'),
  ('m96','Octavos','Suiza','Colombia','2026-07-07T22:00:00+02'),

  -- Cuartos
  ('m97','Cuartos','Francia','Marruecos','2026-07-09T22:00:00+02'),
  ('m98','Cuartos','Ganador m93','Ganador m94','2026-07-10T21:00:00+02'),
  ('m99','Cuartos','Noruega','Inglaterra','2026-07-11T23:00:00+02'),
  ('m100','Cuartos','Ganador m95','Ganador m96','2026-07-12T03:00:00+02'),

  -- Semifinales, tercer puesto y final
  ('m101','Semifinal','Ganador m97','Ganador m98','2026-07-14T21:00:00+02'),
  ('m102','Semifinal','Ganador m99','Ganador m100','2026-07-15T21:00:00+02'),
  ('m103','Tercer puesto','Perdedor m101','Perdedor m102','2026-07-18T23:00:00+02'),
  ('m104','Final','Ganador m101','Ganador m102','2026-07-19T21:00:00+02')
on conflict (id) do update set
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  match_date = excluded.match_date;