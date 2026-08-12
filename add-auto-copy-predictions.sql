-- Personal switch to copy predictions to the user's other pools.
-- Non-destructive: disabled by default.

alter table public.profiles
  add column if not exists auto_copy_predictions boolean not null default false;
