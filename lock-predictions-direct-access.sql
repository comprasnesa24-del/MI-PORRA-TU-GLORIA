-- Fase 2: ejecutar solamente despues de publicar y verificar el frontend seguro.

drop policy if exists "predictions read all" on public.predictions;
drop policy if exists "predictions insert all" on public.predictions;
drop policy if exists "predictions update all" on public.predictions;
drop policy if exists "predictions delete all" on public.predictions;

revoke all on public.predictions from anon, authenticated;
alter table public.predictions enable row level security;

notify pgrst, 'reload schema';
