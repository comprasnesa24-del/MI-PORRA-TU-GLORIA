-- Prevent stale external providers from clearing already saved results.
-- Run once in Supabase SQL Editor if this protection is missing.

create or replace function public.prevent_match_result_clear_from_stale_sync()
returns trigger
language plpgsql
as $$
begin
  if old.real_home is not null
     and old.real_away is not null
     and (new.real_home is null or new.real_away is null)
     and coalesce(new.external_source, old.external_source) in ('football-data.org', 'api-football') then
    new.real_home := old.real_home;
    new.real_away := old.real_away;
    new.result_updated_at := coalesce(old.result_updated_at, new.result_updated_at, now());
    if new.external_status is null or upper(new.external_status) in ('TIMED', 'SCHEDULED', 'NS', 'TBD') then
      new.external_status := old.external_status;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_match_result_clear_from_stale_sync on public.matches;

create trigger prevent_match_result_clear_from_stale_sync
before update of real_home, real_away, external_status on public.matches
for each row
execute function public.prevent_match_result_clear_from_stale_sync();
