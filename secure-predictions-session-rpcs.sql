-- Sesiones privadas y acceso seguro a pronosticos.
-- Fase 1: crear estas funciones antes de publicar el frontend seguro.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.app_sessions (
  token_hash text primary key,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  last_seen_at timestamptz not null default now()
);

alter table private.app_sessions enable row level security;
create index if not exists app_sessions_profile_id_idx on private.app_sessions(profile_id);
create index if not exists app_sessions_expires_at_idx on private.app_sessions(expires_at);

create or replace function private.app_session_profile_id(p_token text)
returns uuid
language sql
stable
security definer
set search_path = private, extensions
as $$
  select s.profile_id
  from private.app_sessions s
  where s.token_hash = encode(digest(coalesce(p_token, ''), 'sha256'), 'hex')
    and s.expires_at > now()
  limit 1;
$$;

revoke all on function private.app_session_profile_id(text) from public, anon, authenticated;

create or replace function public.app_login_secure(
  p_login text,
  p_email text,
  p_password text
)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  found public.profiles%rowtype;
  raw_token text;
begin
  select p.* into found
  from public.profiles p
  where (
      trim(coalesce(p_login, '')) <> ''
      and lower(unaccent(trim(p.nick))) = lower(unaccent(trim(p_login)))
    ) or (
      trim(coalesce(p_email, '')) <> ''
      and lower(trim(coalesce(p.email, ''))) = lower(trim(p_email))
    )
  order by case when lower(unaccent(trim(p.nick))) = lower(unaccent(trim(coalesce(p_login, '')))) then 0 else 1 end
  limit 1;

  if found.id is null or found.password_hash is null or p_password is null
     or not (found.password_hash = crypt(p_password, found.password_hash)
          or found.password_hash = crypt(trim(p_password), found.password_hash)) then
    raise exception 'Usuario o contrasena incorrectos';
  end if;

  delete from private.app_sessions where expires_at <= now();
  delete from private.app_sessions
  where token_hash in (
    select token_hash from private.app_sessions
    where profile_id = found.id
    order by created_at desc
    offset 9
  );

  raw_token := encode(gen_random_bytes(32), 'hex');
  insert into private.app_sessions(token_hash, profile_id, expires_at)
  values (encode(digest(raw_token, 'sha256'), 'hex'), found.id, now() + interval '30 days');

  return jsonb_build_object(
    'token', raw_token,
    'profile', jsonb_build_object(
      'id', found.id,
      'nick', found.nick,
      'role', found.role,
      'created_at', found.created_at,
      'email', found.email,
      'avatar_emoji', found.avatar_emoji,
      'avatar_color', found.avatar_color,
      'avatar', found.avatar,
      'auto_copy_predictions', found.auto_copy_predictions
    )
  );
end;
$$;

create or replace function public.app_session_profile(p_session_token text)
returns jsonb
language plpgsql
security definer
set search_path = public, private, extensions
as $$
declare
  profile_id uuid;
  found public.profiles%rowtype;
begin
  profile_id := private.app_session_profile_id(p_session_token);
  if profile_id is null then return null; end if;

  update private.app_sessions
  set last_seen_at = now(), expires_at = greatest(expires_at, now() + interval '7 days')
  where token_hash = encode(digest(p_session_token, 'sha256'), 'hex');

  select * into found from public.profiles where id = profile_id;
  if found.id is null then return null; end if;

  return jsonb_build_object(
    'id', found.id,
    'nick', found.nick,
    'role', found.role,
    'created_at', found.created_at,
    'email', found.email,
    'avatar_emoji', found.avatar_emoji,
    'avatar_color', found.avatar_color,
    'avatar', found.avatar,
    'auto_copy_predictions', found.auto_copy_predictions
  );
end;
$$;

create or replace function public.app_logout_secure(p_session_token text)
returns boolean
language plpgsql
security definer
set search_path = private, extensions
as $$
begin
  delete from private.app_sessions
  where token_hash = encode(digest(coalesce(p_session_token, ''), 'sha256'), 'hex');
  return true;
end;
$$;

create or replace function public.get_visible_predictions(p_session_token text)
returns setof public.predictions
language plpgsql
stable
security definer
set search_path = public, private
as $$
declare
  requester uuid;
  requester_role text;
begin
  requester := private.app_session_profile_id(p_session_token);
  if requester is null then raise exception 'Sesion no valida'; end if;
  select role into requester_role from public.profiles where id = requester;

  if requester_role = 'admin' then
    return query select p.* from public.predictions p;
  end if;

  return query
  select p.*
  from public.predictions p
  where exists (
    select 1 from public.pool_members mine
    where mine.pool_id = p.pool_id and mine.user_id = requester
  )
  and (
    p.user_id = requester
    or exists (
      select 1 from public.matches m
      where m.id = p.match_id
        and (
          (m.real_home is not null and m.real_away is not null)
          or (
            m.match_date <= now()
            and upper(coalesce(m.external_status, '')) not in
              ('PST','POSTPONED','SUSPENDED','SUSP','CANCELLED','CANC','ABD')
          )
        )
    )
  );
end;
$$;

create or replace function public.save_prediction_secure(
  p_session_token text,
  p_pool_id uuid,
  p_match_id text,
  p_pred_home integer,
  p_pred_away integer,
  p_is_joker boolean default false,
  p_scorer_prediction text default null,
  p_mvp_prediction text default null,
  p_sent_off_prediction text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, private
as $$
declare
  requester uuid;
  requester_role text;
  selected_match public.matches%rowtype;
  saved public.predictions%rowtype;
begin
  requester := private.app_session_profile_id(p_session_token);
  if requester is null then raise exception 'Sesion no valida'; end if;
  select role into requester_role from public.profiles where id = requester;
  if requester_role = 'admin' then raise exception 'El admin no pronostica'; end if;

  if not exists (
    select 1 from public.pool_members
    where pool_id = p_pool_id and user_id = requester
  ) then raise exception 'No perteneces a esta porra'; end if;

  select * into selected_match from public.matches where id = p_match_id;
  if selected_match.id is null then raise exception 'Partido no encontrado'; end if;
  if selected_match.match_date <= now()
     or upper(coalesce(selected_match.external_status, '')) in
       ('PST','POSTPONED','SUSPENDED','SUSP','CANCELLED','CANC','ABD','FT','AET','PEN','FINISHED') then
    raise exception 'El partido ya no admite cambios';
  end if;
  if p_pred_home is null or p_pred_away is null or p_pred_home < 0 or p_pred_away < 0
     or p_pred_home > 99 or p_pred_away > 99 then
    raise exception 'Resultado no valido';
  end if;

  insert into public.predictions(
    pool_id,user_id,match_id,pred_home,pred_away,is_joker,
    scorer_prediction,mvp_prediction,sent_off_prediction,competition
  ) values (
    p_pool_id,requester,p_match_id,p_pred_home,p_pred_away,coalesce(p_is_joker,false),
    nullif(trim(coalesce(p_scorer_prediction,'')),''),
    nullif(trim(coalesce(p_mvp_prediction,'')),''),
    nullif(trim(coalesce(p_sent_off_prediction,'')),''),
    coalesce(selected_match.competition,'mundial')
  )
  on conflict (pool_id,user_id,match_id) do update set
    pred_home=excluded.pred_home,
    pred_away=excluded.pred_away,
    is_joker=excluded.is_joker,
    scorer_prediction=excluded.scorer_prediction,
    mvp_prediction=excluded.mvp_prediction,
    sent_off_prediction=excluded.sent_off_prediction,
    competition=excluded.competition
  returning * into saved;

  return to_jsonb(saved);
end;
$$;

create or replace function public.delete_pool_secure(p_session_token text, p_pool_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public, private
as $$
declare
  requester uuid;
  allowed boolean;
begin
  requester := private.app_session_profile_id(p_session_token);
  if requester is null then raise exception 'Sesion no valida'; end if;

  select exists (
    select 1 from public.profiles where id=requester and role='admin'
    union all
    select 1 from public.pools where id=p_pool_id and created_by=requester
    union all
    select 1 from public.pool_members where pool_id=p_pool_id and user_id=requester and role='admin'
  ) into allowed;
  if not coalesce(allowed,false) then raise exception 'No autorizado'; end if;

  delete from public.messages where pool_id=p_pool_id;
  delete from public.predictions where pool_id=p_pool_id;
  delete from public.pool_members where pool_id=p_pool_id;
  delete from public.pools where id=p_pool_id;
  return true;
end;
$$;

revoke all on function public.app_login_secure(text,text,text) from public;
revoke all on function public.app_session_profile(text) from public;
revoke all on function public.app_logout_secure(text) from public;
revoke all on function public.get_visible_predictions(text) from public;
revoke all on function public.save_prediction_secure(text,uuid,text,integer,integer,boolean,text,text,text) from public;
revoke all on function public.delete_pool_secure(text,uuid) from public;

grant execute on function public.app_login_secure(text,text,text) to anon, authenticated;
grant execute on function public.app_session_profile(text) to anon, authenticated;
grant execute on function public.app_logout_secure(text) to anon, authenticated;
grant execute on function public.get_visible_predictions(text) to anon, authenticated;
grant execute on function public.save_prediction_secure(text,uuid,text,integer,integer,boolean,text,text,text) to anon, authenticated;
grant execute on function public.delete_pool_secure(text,uuid) to anon, authenticated;

notify pgrst, 'reload schema';
