-- Proteccion de contrasenas de MI-PORRA.
-- Ejecutar una vez en Supabase SQL Editor o aplicar como migracion.
-- Convierte las contrasenas actuales a hash y evita que la API publica lea password/password_hash.

create extension if not exists pgcrypto;

alter table public.profiles
  add column if not exists password_hash text;

update public.profiles
set password_hash = crypt(password, gen_salt('bf'))
where (password_hash is null or password_hash = '')
  and password is not null
  and password <> '[PROTECTED]';

update public.profiles
set password = '[PROTECTED]'
where password is distinct from '[PROTECTED]';

create or replace function public.verify_profile_password(p_profile_id uuid, p_password text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  stored_hash text;
begin
  select password_hash into stored_hash
  from public.profiles
  where id = p_profile_id;

  if stored_hash is null or stored_hash = '' or p_password is null then
    return false;
  end if;

  return stored_hash = crypt(p_password, stored_hash)
      or stored_hash = crypt(trim(p_password), stored_hash);
end;
$$;

create or replace function public.change_profile_password_secure(
  p_profile_id uuid,
  p_current_password text,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if length(coalesce(p_new_password, '')) < 4 then
    raise exception 'La nueva contrasena debe tener al menos 4 caracteres';
  end if;

  if not public.verify_profile_password(p_profile_id, p_current_password) then
    return false;
  end if;

  update public.profiles
  set password = '[PROTECTED]',
      password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = p_profile_id;

  return true;
end;
$$;

create or replace function public.register_profile_secure(
  p_nick text,
  p_email text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  created_profile public.profiles%rowtype;
begin
  if trim(coalesce(p_nick, '')) = '' or length(coalesce(p_password, '')) < 4 then
    raise exception 'Pon nick y una contrasena de al menos 4 caracteres';
  end if;

  if lower(trim(p_nick)) = 'admin' then
    raise exception 'La cuenta admin solo se gestiona desde el panel de administrador';
  end if;

  if exists (
    select 1
    from public.profiles
    where lower(trim(nick)) = lower(trim(p_nick))
  ) then
    raise exception 'Ese nick ya existe';
  end if;

  insert into public.profiles (nick, email, password, password_hash, role, avatar)
  values (trim(p_nick), nullif(trim(coalesce(p_email, '')), ''), '[PROTECTED]', crypt(p_password, gen_salt('bf')), 'user', '🙈')
  returning * into created_profile;

  return jsonb_build_object(
    'profile',
    jsonb_build_object(
      'id', created_profile.id,
      'nick', created_profile.nick,
      'role', created_profile.role,
      'created_at', created_profile.created_at,
      'email', created_profile.email,
      'avatar_emoji', created_profile.avatar_emoji,
      'avatar_color', created_profile.avatar_color,
      'avatar', created_profile.avatar,
      'auto_copy_predictions', created_profile.auto_copy_predictions
    )
  );
end;
$$;

create or replace function public.admin_reset_profile_password_secure(
  p_target_user_id uuid,
  p_new_password text
)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_email text;
  is_admin boolean;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  select email into admin_email
  from auth.users
  where id = auth.uid();

  select exists (
    select 1
    from public.profiles
    where lower(trim(email)) = lower(trim(admin_email))
      and role = 'admin'
  ) into is_admin;

  if not is_admin then
    raise exception 'No autorizado';
  end if;

  if length(coalesce(p_new_password, '')) < 4 then
    raise exception 'La nueva contrasena debe tener al menos 4 caracteres';
  end if;

  update public.profiles
  set password = '[PROTECTED]',
      password_hash = crypt(p_new_password, gen_salt('bf'))
  where id = p_target_user_id
    and role <> 'admin';

  return true;
end;
$$;

revoke all on function public.verify_profile_password(uuid, text) from public;
revoke all on function public.change_profile_password_secure(uuid, text, text) from public;
revoke all on function public.register_profile_secure(text, text, text) from public;
revoke all on function public.admin_reset_profile_password_secure(uuid, text) from public;

grant execute on function public.verify_profile_password(uuid, text) to anon, authenticated;
grant execute on function public.change_profile_password_secure(uuid, text, text) to anon, authenticated;
grant execute on function public.register_profile_secure(text, text, text) to anon, authenticated;
grant execute on function public.admin_reset_profile_password_secure(uuid, text) to authenticated;

revoke select on public.profiles from anon, authenticated;
revoke insert on public.profiles from anon, authenticated;
revoke update on public.profiles from anon, authenticated;

grant select (id, nick, role, created_at, email, avatar_emoji, avatar_color, avatar, auto_copy_predictions)
on public.profiles to anon, authenticated;

grant update (email, avatar_emoji, avatar_color, avatar, auto_copy_predictions)
on public.profiles to anon, authenticated;

notify pgrst, 'reload schema';
