-- Parche urgente de seguridad para perfiles y contraseñas.
-- Ejecutar en Supabase > SQL Editor después de desplegar el código.
-- Objetivo: no exponer public.profiles.password al navegador y verificar login por RPC.

create extension if not exists pgcrypto;

alter table public.profiles add column if not exists email text;
alter table public.profiles add column if not exists avatar text;

create or replace function public.hash_profile_password()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.password is not null and (tg_op = 'INSERT' or new.password is distinct from old.password) then
    if new.password !~ '^\$2[aby]\$' then
      new.password := crypt(new.password, gen_salt('bf'));
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_hash_profile_password on public.profiles;
create trigger trg_hash_profile_password
before insert or update of password on public.profiles
for each row execute function public.hash_profile_password();

update public.profiles
set password = crypt(password, gen_salt('bf'))
where password !~ '^\$2[aby]\$';

create or replace function public.login_profile(p_nick text, p_password text)
returns table (
  id uuid,
  nick text,
  email text,
  role text,
  avatar text,
  created_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select pr.id, pr.nick, pr.email, pr.role, pr.avatar, pr.created_at
  from public.profiles pr
  where lower(pr.nick) = lower(trim(p_nick))
    and pr.password = crypt(p_password, pr.password)
  limit 1;
$$;

revoke all on function public.login_profile(text,text) from public;
grant execute on function public.login_profile(text,text) to anon, authenticated;

revoke select on public.profiles from anon, authenticated;
grant select (id,nick,email,role,avatar,created_at) on public.profiles to anon, authenticated;
grant insert (nick,email,password,role,avatar) on public.profiles to anon, authenticated;
grant update (email,avatar) on public.profiles to anon, authenticated;

drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read public fields" on public.profiles for select using (true);