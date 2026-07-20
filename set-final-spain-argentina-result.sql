-- Actualizar resultado de la final España - Argentina.
-- Resultado real: España 0 - 0 Argentina
-- Campeona tras desempate/penaltis: España
-- Version compatible si no existe result_updated_at.
-- Ejecutar en Supabase > SQL Editor.

update public.matches
set
  group_name = 'Final',
  home_team = 'España',
  away_team = 'Argentina',
  real_home = 0,
  real_away = 0,
  advance_team = 'España'
where id = 'm104'
   or (
    lower(trim(group_name)) = lower('Final')
    and lower(trim(home_team)) = lower('España')
    and lower(trim(away_team)) = lower('Argentina')
  );

-- Si usas el podio real para puntuar campeón/segundo/tercero, deja también campeón y segundo fijados.
update public.pools
set
  real_champion = 'España',
  real_second = 'Argentina'
where true;