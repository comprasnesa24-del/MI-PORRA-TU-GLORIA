-- Corrige pronósticos para Paraguay - Francia.
-- Manoleitor: Paraguay 0 - 3 Francia, goleador MBAPPE
-- robertosalass: Paraguay 0 - 2 Francia, goleador MBAPPE
-- Ejecutar en Supabase > SQL Editor.

with target_match as (
  select id
  from public.matches
  where id in ('m90','m89')
    and lower(trim(home_team)) = lower('Paraguay')
    and lower(trim(away_team)) = lower('Francia')
  limit 1
), target_rows as (
  select pm.pool_id, pr.id as user_id, tm.id as match_id,
         case when lower(trim(pr.nick)) = lower('manoleitor') then 0 else 0 end as pred_home,
         case when lower(trim(pr.nick)) = lower('manoleitor') then 3 else 2 end as pred_away,
         'MBAPPE'::text as scorer_prediction
  from public.profiles pr
  join public.pool_members pm on pm.user_id = pr.id
  cross join target_match tm
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

with target_match as (
  select id
  from public.matches
  where id in ('m90','m89')
    and lower(trim(home_team)) = lower('Paraguay')
    and lower(trim(away_team)) = lower('Francia')
  limit 1
), target_rows as (
  select pm.pool_id, pr.id as user_id, tm.id as match_id,
         case when lower(trim(pr.nick)) = lower('manoleitor') then 0 else 0 end as pred_home,
         case when lower(trim(pr.nick)) = lower('manoleitor') then 3 else 2 end as pred_away,
         'MBAPPE'::text as scorer_prediction
  from public.profiles pr
  join public.pool_members pm on pm.user_id = pr.id
  cross join target_match tm
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