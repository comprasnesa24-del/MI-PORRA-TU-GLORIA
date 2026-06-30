-- Correccion manual del podio de robertosalass.
-- Ejecuta esto en Supabase > SQL Editor.

update public.pool_members pm
set
  champion_pick = 'Francia',
  second_pick = 'Argentina',
  third_pick = 'España'
from public.profiles p
where pm.user_id = p.id
  and lower(trim(p.nick)) = lower('robertosalass');