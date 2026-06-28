-- Correccion manual del podio de Pepe.
-- Ejecuta esto en Supabase > SQL Editor.

update public.pool_members pm
set
  champion_pick = 'España',
  second_pick = 'Argentina',
  third_pick = 'Francia'
from public.profiles p
where pm.user_id = p.id
  and lower(trim(p.nick)) = lower('Pepe');