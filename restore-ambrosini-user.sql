-- Restaurar usuario Ambrosini.
-- Ejecutar en Supabase > SQL Editor.
-- No borra datos. Crea/actualiza el usuario y lo añade a las porras existentes si falta.

insert into public.profiles (nick, email, password, role, avatar)
values ('Ambrosini', '', '1234', 'user', '🙈')
on conflict (nick) do update set
  password = '1234',
  role = 'user',
  avatar = coalesce(public.profiles.avatar, excluded.avatar);

insert into public.pool_members (pool_id, user_id, role)
select po.id, pr.id, 'user'
from public.pools po
cross join public.profiles pr
where lower(trim(pr.nick)) = lower('Ambrosini')
  and not exists (
    select 1
    from public.pool_members pm
    where pm.pool_id = po.id
      and pm.user_id = pr.id
  );