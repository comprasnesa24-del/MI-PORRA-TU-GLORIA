# Primera Federacion en MI PORRA

La app ya tiene preparadas estas competiciones:

- `primera_rfef_g1`: Primera Federacion Grupo 1 2026/27
- `primera_rfef_g2`: Primera Federacion Grupo 2 2026/27

Football-data.org no publica Primera Federacion en su API. Para calendario, horarios y resultados automaticos hay que usar API-Football, que si permite sincronizar varias ligas desde la misma funcion.

## Variable necesaria en Supabase

En Supabase > Edge Functions > Secrets, configura `API_FOOTBALL_LEAGUES` con una lista como esta:

```json
[
  {"competition":"liga","league":"140","season":"2026","label":"Liga BBVA"},
  {"competition":"primera_rfef_g1","league":"PON_AQUI_ID_GRUPO_1","season":"2026","label":"Primera Federacion Grupo 1"},
  {"competition":"primera_rfef_g2","league":"PON_AQUI_ID_GRUPO_2","season":"2026","label":"Primera Federacion Grupo 2"}
]
```

Los valores `PON_AQUI_ID_GRUPO_1` y `PON_AQUI_ID_GRUPO_2` deben salir del panel o endpoint de API-Football.

## Como descubrir los IDs

Despues de desplegar la funcion `sync-football-data`, puedes llamarla con:

```json
{"discoverLeagues":true}
```

La respuesta devuelve ligas espanolas filtradas por nombres tipo Primera, RFEF, LaLiga y Segunda. Con esos IDs se rellena `API_FOOTBALL_LEAGUES`.

## Que queda automatizado

Cuando la variable este puesta y la funcion desplegada, el cron actual podra traer:

- partidos nuevos,
- cambios de horario,
- resultados oficiales,
- clasificacion de jornadas y general a partir de los resultados guardados.

