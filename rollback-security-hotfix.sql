-- Reversion de emergencia del parche de seguridad.
-- No borra partidos, resultados, porras ni pronosticos.
-- Ejecutar solo si tras el parche la app queda bloqueada o sin datos.

drop trigger if exists trg_hash_profile_password on public.profiles;
drop function if exists public.hash_profile_password();
drop function if exists public.login_profile(text,text);

grant select on public.profiles to anon, authenticated;
grant insert on public.profiles to anon, authenticated;
grant update on public.profiles to anon, authenticated;

drop policy if exists "profiles read public fields" on public.profiles;
drop policy if exists "profiles read all" on public.profiles;
create policy "profiles read all" on public.profiles for select using (true);

-- ATENCION:
-- Si alguna password se llego a convertir a hash, no se puede recuperar la antigua.
-- En ese caso hay que resetear manualmente la password del usuario afectado, por ejemplo:
-- update public.profiles set password = 'NUEVA_PASSWORD' where lower(trim(nick)) = lower('NICK_DEL_USUARIO');