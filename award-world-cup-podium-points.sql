-- Activar/repartir puntos del podio real del Mundial.
-- Campeona: España (+20)
-- Segunda: Argentina (+15)
-- Tercera: se calcula desde m103 si el partido de tercer puesto tiene resultado o advance_team.
-- Ejecutar en Supabase > SQL Editor.

with third_place as (
  select
    case
      when nullif(trim(coalesce(advance_team,'')),'') is not null then advance_team
      when real_home is not null and real_away is not null and real_home > real_away then home_team
      when real_home is not null and real_away is not null and real_away > real_home then away_team
      else null
    end as team
  from public.matches
  where id = 'm103'
  limit 1
)
update public.pools p
set
  real_champion = 'España',
  real_second = 'Argentina',
  real_third = coalesce((select team from third_place), p.real_third);

-- Comprobacion rapida: muestra el podio real configurado en cada porra.
select name, real_champion, real_second, real_third
from public.pools
order by created_at desc;