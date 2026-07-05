-- Corrige el cruce intercambiado entre Paraguay-Francia y Canada-Marruecos.
-- Deja:
--   m89 = Paraguay vs Francia
--   m90 = Canada vs Marruecos
-- Tambien corrige los pronosticos pedidos para Manoleitor y robertosalass en m89.
-- Ejecutar en Supabase > SQL Editor.

insert into public.matches (id, group_name, home_team, away_team, match_date) values
  ('m89','Octavos','Paraguay','Francia','2026-07-04T23:00:00+02'),
  ('m90','Octavos','Canadá','Marruecos','2026-07-04T19:00:00+02')
on conflict (id) do update set
  group_name = excluded.group_name,
  home_team = excluded.home_team,
  away_team = excluded.away_team,
  match_date = excluded.match_date;

-- Si el SQL anterior metio estos pronosticos en m90, quitarlos de Canada-Marruecos.
delete from public.predictions p
using public.profiles pr
where p.user_id = pr.id
  and p.match_id = 'm90'
  and lower(trim(pr.nick)) in (lower('manoleitor'), lower('robertosalass'))
  and p.scorer_prediction = 'MBAPPE';

with target_rows as (
  select pm.pool_id, pr.id as user_id, 'm89'::text as match_id,
         0 as pred_home,
         case when lower(trim(pr.nick)) = lower('manoleitor') then 3 else 2 end as pred_away,
         'MBAPPE'::text as scorer_prediction
  from public.profiles pr
  join public.pool_members pm on pm.user_id = pr.id
  where lower(trim(pr.nick)) in (lower('manoleitor'), lower('robertosalass'))
)
update public.predictions p
set
  pred_home = tr.pred_home,
  pred_away = tr.pred_away,
  scorer_prediction = tr.scorer_prediction
from target_rows tr
where p.pool_id = tr.pool_id
  and p.user_id = tr.user_id
  and p.match_id = tr.match_id;

with target_rows as (
  select pm.pool_id, pr.id as user_id, 'm89'::text as match_id,
         0 as pred_home,
         case when lower(trim(pr.nick)) = lower('manoleitor') then 3 else 2 end as pred_away,
         'MBAPPE'::text as scorer_prediction
  from public.profiles pr
  join public.pool_members pm on pm.user_id = pr.id
  where lower(trim(pr.nick)) in (lower('manoleitor'), lower('robertosalass'))
)
insert into public.predictions (pool_id, user_id, match_id, pred_home, pred_away, scorer_prediction)
select tr.pool_id, tr.user_id, tr.match_id, tr.pred_home, tr.pred_away, tr.scorer_prediction
from target_rows tr
where not exists (
  select 1
  from public.predictions p
  where p.pool_id = tr.pool_id
    and p.user_id = tr.user_id
    and p.match_id = tr.match_id
);