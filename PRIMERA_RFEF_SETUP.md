# Primera Federacion en MI PORRA

La app ya tiene preparadas estas competiciones:

- `primera_rfef_g1`: Primera Federacion Grupo 1 2026/27
- `primera_rfef_g2`: Primera Federacion Grupo 2 2026/27

Football-data.org no publica Primera Federacion en su API. La app intenta usar API-Football primero, pero si esa fuente no trae la temporada actual de Primera RFEF, la funcion tambien esta preparada para usar `apifootball.com` como respaldo.

La funcion `sync-football-data` ya trae por defecto:

- Liga BBVA: API-Football `140`
- Primera Federacion Grupo 1: API-Football `435`
- Primera Federacion Grupo 2: API-Football `436`

## Variable necesaria en Supabase

Este paso ya no es obligatorio. Solo hace falta si algun dia quieres cambiar IDs, temporada o nombres sin tocar codigo.

En Supabase > Edge Functions > Secrets, puedes configurar `API_FOOTBALL_LEAGUES` con una lista como esta:

```json
[
  {"competition":"liga","league":"140","season":"2026","label":"Liga BBVA"},
  {"competition":"primera_rfef_g1","league":"435","season":"2026","label":"Primera Federacion Grupo 1"},
  {"competition":"primera_rfef_g2","league":"436","season":"2026","label":"Primera Federacion Grupo 2"}
]
```

Si API-Football todavia no tiene cargada una temporada concreta para Primera Federacion, la funcion no rompe la Liga BBVA: registra el aviso en `sync_logs` y puede saltar al respaldo `apifootball.com` si existe su clave.

## Respaldo con apifootball.com

APIFootball lista `Spain > Primera División RFEF` con el ID `299`. Como esa API agrupa la competicion, la funcion separa Grupo 1 y Grupo 2 filtrando por equipos.

Para activarlo hay que crear una cuenta en apifootball.com y guardar esta clave en Supabase > Edge Functions > Secrets:

```text
APIFOOTBALL_KEY=tu_clave_de_apifootball
```

La funcion trae por defecto:

- Liga BBVA: APIFootball `302`
- Primera Federacion Grupo 1: APIFootball `299`, filtrado por equipos del Grupo 1
- Primera Federacion Grupo 2: APIFootball `299`, filtrado por equipos del Grupo 2

Opcionalmente puedes limitar el rango de lectura:

```text
APIFOOTBALL_FROM=2026-08-01
APIFOOTBALL_TO=2027-06-30
```

## Como descubrir los IDs

Despues de desplegar la funcion `sync-football-data`, puedes llamarla con:

```json
{"discoverLeagues":true}
```

La respuesta devuelve ligas espanolas filtradas por nombres tipo Primera, RFEF, LaLiga y Segunda. Con esos IDs se rellena `API_FOOTBALL_LEAGUES`.

## Que queda automatizado

Cuando las variables esten puestas y la funcion desplegada, el cron actual podra traer:

- partidos nuevos,
- cambios de horario,
- resultados oficiales,
- clasificacion de jornadas y general a partir de los resultados guardados.
