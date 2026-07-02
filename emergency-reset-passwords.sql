-- EMERGENCIA: restaurar acceso tras el parche de seguridad fallido.
-- No borra porras, partidos, resultados, pronosticos ni mensajes.
-- Ejecutar en Supabase > SQL Editor.
-- Despues de entrar, cambiaremos contrasenas una a una con un sistema mejor.

drop trigger if exists trg_hash_profile_password on public.profiles;
drop function if exists public.hash_profile_password();
drop function if exists public.login_profile(text,text);

grant select on public.profiles to anon, authenticated;
grant insert on public.profiles to anon, authenticated;
grant update on public.profiles to anon, authenticated;

drop policy if exists "profiles read public fields" on public.profiles;
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (true);

-- Admin recupera la clave que tenia la app.
update public.profiles
set password = '968085070'
where lower(trim(nick)) = 'admin';

-- Usuarios normales: clave temporal para poder entrar.
update public.profiles
set password = '1234'
where lower(trim(nick)) <> 'admin';