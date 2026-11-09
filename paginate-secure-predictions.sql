-- Pagina los pronosticos visibles para no perder historicos por el limite de 1000 filas de PostgREST.

create or replace function public.get_visible_predictions_page(
  p_session_token text,
  p_offset integer default 0,
  p_limit integer default 1000
)
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

  return query
  select p.*
  from public.predictions p
  where (
    requester_role = 'admin'
    or (
      exists (
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
      )
    )
  )
  order by p.created_at desc, p.id
  offset greatest(coalesce(p_offset, 0), 0)
  limit least(greatest(coalesce(p_limit, 1000), 1), 1000);
end;
$$;

revoke all on function public.get_visible_predictions_page(text,integer,integer) from public;
grant execute on function public.get_visible_predictions_page(text,integer,integer) to anon, authenticated;

notify pgrst, 'reload schema';
