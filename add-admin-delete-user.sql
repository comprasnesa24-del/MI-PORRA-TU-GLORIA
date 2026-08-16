-- Admin-only hard delete for profiles.
-- Requires a confirmed Supabase Auth session whose email matches the admin profile.

-- Close the unsafe public profile delete path left by older emergency fixes.
drop policy if exists "profiles delete all" on public.profiles;
revoke delete, truncate on public.profiles from anon, authenticated;

create or replace function public.admin_delete_profile(target_user_id uuid, confirm_text text)
returns jsonb
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  admin_email text;
  admin_profile public.profiles%rowtype;
  target_profile public.profiles%rowtype;
  created_pools_count integer := 0;
begin
  if auth.uid() is null then
    raise exception 'No autorizado';
  end if;

  select u.email into admin_email
  from auth.users u
  where u.id = auth.uid();

  select p.* into admin_profile
  from public.profiles p
  where lower(trim(p.email)) = lower(trim(admin_email))
    and p.role = 'admin'
  limit 1;

  if admin_profile.id is null then
    raise exception 'No autorizado';
  end if;

  select p.* into target_profile
  from public.profiles p
  where p.id = target_user_id;

  if target_profile.id is null then
    return jsonb_build_object('ok', true, 'deleted', false, 'message', 'Usuario no encontrado');
  end if;

  if target_profile.role = 'admin' or target_profile.id = admin_profile.id then
    raise exception 'No se puede eliminar al admin';
  end if;

  if confirm_text is distinct from ('ELIMINAR ' || target_profile.nick) then
    raise exception 'Confirmacion incorrecta';
  end if;

  select count(*) into created_pools_count
  from public.pools
  where created_by = target_profile.id;

  delete from public.profiles
  where id = target_profile.id;

  -- This is a hard delete, not a recoverable delete.
  delete from public.deleted_profiles
  where id = target_profile.id;

  return jsonb_build_object(
    'ok', true,
    'deleted', true,
    'nick', target_profile.nick,
    'created_pools', created_pools_count
  );
end;
$$;

revoke all on function public.admin_delete_profile(uuid, text) from public;
revoke all on function public.admin_delete_profile(uuid, text) from anon;
grant execute on function public.admin_delete_profile(uuid, text) to authenticated;

notify pgrst, 'reload schema';
-- Trigger helper only; it should not be callable from the browser.
revoke all on function public.archive_deleted_profile_safe() from public;
revoke all on function public.archive_deleted_profile_safe() from anon;
revoke all on function public.archive_deleted_profile_safe() from authenticated;