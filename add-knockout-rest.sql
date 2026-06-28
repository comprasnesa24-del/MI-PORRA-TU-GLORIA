-- Añade el resto del cuadro del Mundial 2026 con descripciones provisionales.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.

insert into public.matches (id, group_name, home_team, away_team, match_date) values
  ('m89','Octavos','Ganador m74','Ganador m77','2026-07-04T18:00:00+02'),
  ('m90','Octavos','Ganador m73','Ganador m75','2026-07-05T00:00:00+02'),
  ('m91','Octavos','Ganador m76','Ganador m78','2026-07-05T03:00:00+02'),
  ('m92','Octavos','Ganador m79','Ganador m80','2026-07-05T22:00:00+02'),
  ('m93','Octavos','Ganador m83','Ganador m84','2026-07-06T18:00:00+02'),
  ('m94','Octavos','Ganador m81','Ganador m82','2026-07-06T21:00:00+02'),
  ('m95','Octavos','Ganador m86','Ganador m88','2026-07-07T00:00:00+02'),
  ('m96','Octavos','Ganador m85','Ganador m87','2026-07-07T03:00:00+02'),
  ('m97','Cuartos','Ganador m89','Ganador m90','2026-07-09T21:00:00+02'),
  ('m98','Cuartos','Ganador m93','Ganador m94','2026-07-10T03:00:00+02'),
  ('m99','Cuartos','Ganador m91','Ganador m92','2026-07-10T21:00:00+02'),
  ('m100','Cuartos','Ganador m95','Ganador m96','2026-07-11T03:00:00+02'),
  ('m101','Semifinal','Ganador m97','Ganador m98','2026-07-14T21:00:00+02'),
  ('m102','Semifinal','Ganador m99','Ganador m100','2026-07-15T21:00:00+02'),
  ('m103','Tercer puesto','Perdedor m101','Perdedor m102','2026-07-18T21:00:00+02'),
  ('m104','Final','Ganador m101','Ganador m102','2026-07-19T21:00:00+02')
on conflict (id) do update set
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  match_date = excluded.match_date;