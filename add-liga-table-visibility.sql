-- Liga table visibility switch.
-- Non-destructive: lets the admin decide when users can see saved league tables.

alter table public.pools
  add column if not exists league_table_public boolean not null default false;
