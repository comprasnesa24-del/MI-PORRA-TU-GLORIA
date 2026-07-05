-- Corrige pronósticos para Canada - Marruecos.
-- robertosalass: Canada 1 - 2 Marruecos, goleador SAIBARI
-- manoleitor: Canada 0 - 3 Marruecos, goleador BRAHIM
-- Ejecutar en Supabase > SQL Editor.

with target_match as (
  select id
  from public.matches
  where id = 'm90'
     or (lower(trim(home_team)) in (lower('Canadá'), lower('Canada')) and lower(trim(away_team)) = lower('Marruecos'))
  limit 1
), target_rows as (
  select pm.pool_id, pr.id as user_id, tm.id as match_id,
         case when lower(trim(pr.nick)) = lower('robertosalass') then 1 else 0 end as pred_home,
         case when lower(trim(pr.nick)) = lower('robertosalass') then 2 else 3 end as pred_away,
         case when lower(trim(pr.nick)) = lower('robertosalass') then 'SAIBARI' else 'BRAHIM' end as scorer_prediction
  from public.profiles pr
  join public.pool_members pm on pm.user_id = pr.id
  cross join target_match tm
  where lower(trim(pr.nick)) in (lower('robertosalass'), lower('manoleitor'))
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
  where id = 'm90'
     or (lower(trim(home_team)) in (lower('Canadá'), lower('Canada')) and lower(trim(away_team)) = lower('Marruecos'))
  limit 1
), target_rows as (
  select pm.pool_id, pr.id as user_id, tm.id as match_id,
         case when lower(trim(pr.nick)) = lower('robertosalass') then 1 else 0 end as pred_home,
         case when lower(trim(pr.nick)) = lower('robertosalass') then 2 else 3 end as pred_away,
         case when lower(trim(pr.nick)) = lower('robertosalass') then 'SAIBARI' else 'BRAHIM' end as scorer_prediction
  from public.profiles pr
  join public.pool_members pm on pm.user_id = pr.id
  cross join target_match tm
  where lower(trim(pr.nick)) in (lower('robertosalass'), lower('manoleitor'))
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