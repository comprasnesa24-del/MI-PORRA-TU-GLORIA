-- Liga fun scoring: hypothetical full league table.
-- Non-destructive: only adds the column used to store each member's saved table.

alter table public.pool_members
  add column if not exists league_table_pick jsonb;
