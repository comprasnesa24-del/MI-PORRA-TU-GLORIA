-- Cambiar pronostico de Jochiko para Suiza - Argelia.
-- Resultado: Suiza 3 - 1 Argelia
-- Goleador: Embolo
-- Ejecutar en Supabase > SQL Editor.

with target_user as (
  select id
  from public.profiles
  where lower(trim(nick)) = lower('Jochiko')
  limit 1
), target_match as (
  select id
  from public.matches
  where id = 'm85'
     or (lower(trim(home_team)) = lower('Suiza') and lower(trim(away_team)) = lower('Argelia'))
  limit 1
), target_pools as (
  select pm.pool_id, tu.id as user_id, tm.id as match_id
  from public.pool_members pm
  join target_user tu on tu.id = pm.user_id
  cross join target_match tm
)
update public.predictions p
set
  pred_home = 3,
  pred_away = 1,
  scorer_prediction = 'Embolo'
from target_pools tp
where p.pool_id = tp.pool_id
  and p.user_id = tp.user_id
  and p.match_id = tp.match_id;

with target_user as (
  select id
  from public.profiles
  where lower(trim(nick)) = lower('Jochiko')
  limit 1
), target_match as (
  select id
  from public.matches
  where id = 'm85'
     or (lower(trim(home_team)) = lower('Suiza') and lower(trim(away_team)) = lower('Argelia'))
  limit 1
), target_pools as (
  select pm.pool_id, tu.id as user_id, tm.id as match_id
  from public.pool_members pm
  join target_user tu on tu.id = pm.user_id
  cross join target_match tm
)
insert into public.predictions (pool_id, user_id, match_id, pred_home, pred_away, scorer_prediction)
select tp.pool_id, tp.user_id, tp.match_id, 3, 1, 'Embolo'
from target_pools tp
where not exists (
  select 1
  from public.predictions p
  where p.pool_id = tp.pool_id
    and p.user_id = tp.user_id
    and p.match_id = tp.match_id
);