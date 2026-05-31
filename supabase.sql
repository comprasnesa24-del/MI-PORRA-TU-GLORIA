-- MI PORRA, TU GLORIA
-- Supabase > SQL Editor > pega todo y pulsa Run

drop table if exists predictions;
drop table if exists matches;
drop table if exists profiles;

create table profiles (
  id uuid primary key default gen_random_uuid(),
  nick text unique not null,
  password text not null,
  role text not null default 'user',
  created_at timestamptz default now()
);

create table matches (
  id text primary key,
  group_name text not null,
  home_team text not null,
  away_team text not null,
  match_date timestamptz not null,
  real_home int,
  real_away int
);

create table predictions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  match_id text references matches(id) on delete cascade,
  pred_home int not null,
  pred_away int not null,
  created_at timestamptz default now(),
  unique(user_id, match_id)
);

alter table profiles enable row level security;
alter table matches enable row level security;
alter table predictions enable row level security;

create policy "profiles read all" on profiles for select using (true);
create policy "profiles insert all" on profiles for insert with check (true);
create policy "matches read all" on matches for select using (true);
create policy "matches update all" on matches for update using (true);
create policy "predictions read all" on predictions for select using (true);
create policy "predictions insert all" on predictions for insert with check (true);
create policy "predictions update all" on predictions for update using (true);

insert into matches (id, group_name, home_team, away_team, match_date) values
('m1','A','México','Sudáfrica','2026-06-11T21:00:00+02'),
('m2','A','Corea del Sur','República Checa','2026-06-12T04:00:00+02'),
('m3','B','Canadá','Bosnia y Herzegovina','2026-06-12T21:00:00+02'),
('m4','D','Estados Unidos','Paraguay','2026-06-13T03:00:00+02'),
('m5','C','Brasil','Marruecos','2026-06-14T00:00:00+02'),
('m6','D','Australia','Turquía','2026-06-14T06:00:00+02'),
('m7','C','Haití','Escocia','2026-06-14T03:00:00+02'),
('m8','B','Catar','Suiza','2026-06-13T21:00:00+02'),
('m9','E','Costa de Marfil','Ecuador','2026-06-15T01:00:00+02'),
('m10','E','Alemania','Curazao','2026-06-14T19:00:00+02'),
('m11','F','Países Bajos','Japón','2026-06-14T22:00:00+02'),
('m12','F','Suecia','Túnez','2026-06-15T04:00:00+02'),
('m13','H','Arabia Saudí','Uruguay','2026-06-16T00:00:00+02'),
('m14','H','España','Cabo Verde','2026-06-15T18:00:00+02'),
('m15','G','Irán','Nueva Zelanda','2026-06-16T03:00:00+02'),
('m16','G','Bélgica','Egipto','2026-06-15T21:00:00+02'),
('m17','I','Francia','Senegal','2026-06-16T21:00:00+02'),
('m18','I','Irak','Noruega','2026-06-17T00:00:00+02'),
('m19','J','Argentina','Argelia','2026-06-17T03:00:00+02'),
('m20','J','Austria','Jordania','2026-06-17T06:00:00+02'),
('m21','L','Ghana','Panamá','2026-06-18T01:00:00+02'),
('m22','L','Inglaterra','Croacia','2026-06-17T22:00:00+02'),
('m23','K','Portugal','RD Congo','2026-06-17T19:00:00+02'),
('m24','K','Uzbekistán','Colombia','2026-06-18T04:00:00+02'),
('m25','A','República Checa','Sudáfrica','2026-06-18T18:00:00+02'),
('m26','B','Suiza','Bosnia y Herzegovina','2026-06-18T21:00:00+02'),
('m27','B','Canadá','Catar','2026-06-19T00:00:00+02'),
('m28','A','México','Corea del Sur','2026-06-19T03:00:00+02'),
('m29','C','Brasil','Haití','2026-06-20T02:30:00+02'),
('m30','C','Escocia','Marruecos','2026-06-20T00:00:00+02'),
('m31','D','Turquía','Paraguay','2026-06-20T05:00:00+02'),
('m32','D','Estados Unidos','Australia','2026-06-19T21:00:00+02'),
('m33','E','Alemania','Costa de Marfil','2026-06-20T22:00:00+02'),
('m34','E','Ecuador','Curazao','2026-06-21T02:00:00+02'),
('m35','F','Países Bajos','Suecia','2026-06-20T19:00:00+02'),
('m36','F','Túnez','Japón','2026-06-21T06:00:00+02'),
('m37','H','Uruguay','Cabo Verde','2026-06-22T00:00:00+02'),
('m38','H','España','Arabia Saudí','2026-06-21T18:00:00+02'),
('m39','G','Bélgica','Irán','2026-06-21T21:00:00+02'),
('m40','G','Nueva Zelanda','Egipto','2026-06-22T03:00:00+02'),
('m41','I','Noruega','Senegal','2026-06-23T02:00:00+02'),
('m42','I','Francia','Irak','2026-06-22T23:00:00+02'),
('m43','J','Argentina','Austria','2026-06-22T19:00:00+02'),
('m44','J','Jordania','Argelia','2026-06-23T05:00:00+02'),
('m45','L','Inglaterra','Ghana','2026-06-23T22:00:00+02'),
('m46','L','Panamá','Croacia','2026-06-24T01:00:00+02'),
('m47','K','Portugal','Uzbekistán','2026-06-23T19:00:00+02'),
('m48','K','Colombia','RD Congo','2026-06-24T04:00:00+02'),
('m49','C','Escocia','Brasil','2026-06-25T00:00:00+02'),
('m50','C','Marruecos','Haití','2026-06-25T00:00:00+02'),
('m51','B','Suiza','Canadá','2026-06-24T21:00:00+02'),
('m52','B','Bosnia y Herzegovina','Catar','2026-06-24T21:00:00+02'),
('m53','A','República Checa','México','2026-06-25T03:00:00+02'),
('m54','A','Sudáfrica','Corea del Sur','2026-06-25T03:00:00+02'),
('m55','E','Curazao','Costa de Marfil','2026-06-25T22:00:00+02'),
('m56','E','Ecuador','Alemania','2026-06-25T22:00:00+02'),
('m57','F','Japón','Suecia','2026-06-26T01:00:00+02'),
('m58','F','Túnez','Países Bajos','2026-06-26T01:00:00+02'),
('m59','D','Turquía','Estados Unidos','2026-06-26T04:00:00+02'),
('m60','D','Paraguay','Australia','2026-06-26T04:00:00+02'),
('m61','I','Noruega','Francia','2026-06-26T21:00:00+02'),
('m62','I','Senegal','Irak','2026-06-26T21:00:00+02'),
('m63','G','Egipto','Irán','2026-06-27T05:00:00+02'),
('m64','G','Nueva Zelanda','Bélgica','2026-06-27T05:00:00+02'),
('m65','H','Cabo Verde','Arabia Saudí','2026-06-27T02:00:00+02'),
('m66','H','Uruguay','España','2026-06-27T02:00:00+02'),
('m67','L','Panamá','Inglaterra','2026-06-27T23:00:00+02'),
('m68','L','Croacia','Ghana','2026-06-27T23:00:00+02'),
('m69','J','Argelia','Austria','2026-06-28T04:00:00+02'),
('m70','J','Jordania','Argentina','2026-06-28T04:00:00+02'),
('m71','K','Colombia','Portugal','2026-06-28T01:30:00+02'),
('m72','K','RD Congo','Uzbekistán','2026-06-28T01:30:00+02');
