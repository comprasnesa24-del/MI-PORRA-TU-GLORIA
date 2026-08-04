-- Automatic Liga BBVA sync from an external football API.
-- Run this after add-competitions.sql in Supabase > SQL Editor.
-- It does not delete existing matches or predictions.

alter table public.matches
  add column if not exists competition text not null default 'mundial';

alter table public.matches
  add column if not exists external_source text;

alter table public.matches
  add column if not exists external_id text;

alter table public.matches
  add column if not exists external_status text;

alter table public.matches
  add column if not exists result_updated_at timestamptz;

create unique index if not exists matches_external_source_id_idx
  on public.matches (external_source, external_id);

create table if not exists public.sync_logs (
  id bigserial primary key,
  source text not null,
  competition text not null,
  status text not null,
  details text,
  created_at timestamptz not null default now()
);

-- Optional nightly cron if pg_cron + pg_net are enabled in Supabase.
-- Replace TU_PROJECT_REF and CRON_SECRET with your real values.
-- select cron.schedule(
--   'sync-liga-bbva-daily',
--   '10 4 * * *',
--   $$select net.http_post(
--     url := 'https://TU_PROJECT_REF.functions.supabase.co/sync-football-data',
--     headers := jsonb_build_object('Authorization','Bearer CRON_SECRET'),
--     body := '{}'::jsonb
--   );$$
-- );