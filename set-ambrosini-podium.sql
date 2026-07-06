-- Asignar podio del Mundial a Ambrosini.
-- 1 España, 2 Inglaterra, 3 Francia
-- Ejecutar en Supabase > SQL Editor.

update public.pool_members pm
set
  champion_pick = 'España',
  second_pick = 'Inglaterra',
  third_pick = 'Francia'
from public.profiles p
where pm.user_id = p.id
  and lower(trim(p.nick)) = lower('Ambrosini');