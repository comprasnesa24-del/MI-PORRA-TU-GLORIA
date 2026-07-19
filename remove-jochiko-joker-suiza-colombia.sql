-- Quitar Joker usado por Jochiko en Suiza vs Colombia.
-- No cambia marcador, goleador, MVP ni expulsión.
-- Ejecutar en Supabase > SQL Editor.

update public.predictions p
set is_joker = false
from public.profiles pr, public.matches m
where p.user_id = pr.id
  and p.match_id = m.id
  and lower(trim(pr.nick)) = lower('Jochiko')
  and (
    m.id = 'm96'
    or (
      lower(trim(m.home_team)) = lower('Suiza')
      and lower(trim(m.away_team)) = lower('Colombia')
    )
  );