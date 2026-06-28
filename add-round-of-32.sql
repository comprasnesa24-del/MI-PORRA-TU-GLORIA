-- Añade los dieciseisavos / Round of 32 del Mundial 2026.
-- Ejecuta este archivo una vez en Supabase > SQL Editor.
-- Fechas convertidas a hora de España peninsular (+02:00).

insert into public.matches (id, group_name, home_team, away_team, match_date) values
('m73','Dieciseisavos','Sudáfrica','Canadá','2026-06-28T21:00:00+02'),
('m74','Dieciseisavos','Alemania','Paraguay','2026-06-29T22:30:00+02'),
('m75','Dieciseisavos','Países Bajos','Marruecos','2026-06-30T03:00:00+02'),
('m76','Dieciseisavos','Brasil','Japón','2026-06-29T19:00:00+02'),
('m77','Dieciseisavos','Francia','Suecia','2026-06-30T23:00:00+02'),
('m78','Dieciseisavos','Costa de Marfil','Noruega','2026-06-30T19:00:00+02'),
('m79','Dieciseisavos','México','3º Grupo C/E','2026-07-01T03:00:00+02'),
('m80','Dieciseisavos','Ganador Grupo L','3º Grupo I/J/K','2026-07-01T18:00:00+02'),
('m81','Dieciseisavos','Estados Unidos','Bosnia y Herzegovina','2026-07-02T02:00:00+02'),
('m82','Dieciseisavos','Bélgica','3º Grupo A/I/J','2026-07-01T22:00:00+02'),
('m83','Dieciseisavos','2º Grupo K','2º Grupo L','2026-07-03T01:00:00+02'),
('m84','Dieciseisavos','España','2º Grupo J','2026-07-02T21:00:00+02'),
('m85','Dieciseisavos','Suiza','3º Grupo G/J','2026-07-03T05:00:00+02'),
('m86','Dieciseisavos','Argentina','Cabo Verde','2026-07-04T00:00:00+02'),
('m87','Dieciseisavos','Ganador Grupo K','3º Grupo E/I/L','2026-07-04T03:30:00+02'),
('m88','Dieciseisavos','Australia','Egipto','2026-07-03T20:00:00+02')
on conflict (id) do update set
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  match_date = excluded.match_date;
