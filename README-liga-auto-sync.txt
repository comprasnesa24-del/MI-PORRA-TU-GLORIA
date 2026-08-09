# Liga BBVA automatica

La app no debe llevar claves privadas en el navegador. Por eso la sincronizacion se hace con una Supabase Edge Function.

Fuentes:

- football-data.org: calendario y resultados basicos. Ya esta funcionando.
- API-Football: eventos del partido, incluidos goleadores. Hace falta una API key gratis aparte.

Tablas actualizadas:

- public.matches: partidos, resultados y real_scorers.
- public.team_players: plantillas para desplegables de goleador.
- public.sync_logs: historial de sincronizaciones.

Pasos ya preparados en el repositorio:

1. SQL base de competiciones:
   - add-competitions.sql
   - add-liga-auto-sync.sql

2. SQL extra para goleadores automaticos:
   - add-liga-auto-scorers.sql

3. Funcion Supabase:
   - supabase/functions/sync-football-data/index.ts

Secretos necesarios en Supabase:

- FOOTBALL_DATA_TOKEN: token de football-data.org.
- FOOTBALL_DATA_COMPETITION: PD.
- FOOTBALL_DATA_SEASON: 2026.
- SYNC_CRON_SECRET: secreto privado para el cron.

Para activar goleadores automaticos hay que anadir tambien:

- API_FOOTBALL_KEY: clave gratis de API-Football.
- API_FOOTBALL_LEAGUE: 140.
- API_FOOTBALL_SEASON: 2026.
- API_FOOTBALL_MAX_EVENT_MATCHES: 12.

Uso:

- El cron normal actualiza calendario, resultados y los goleadores de los ultimos partidos finalizados.
- Para cargar plantillas una vez, invoca la funcion con este body:
  { "syncSquads": true }

Notas:

- No borra porras ni pronosticos.
- Si no existe API_FOOTBALL_KEY, la funcion sigue usando football-data.org como respaldo.
- Con API-Football gratis hay 100 peticiones/dia, por eso las plantillas deben cargarse solo cuando haga falta y el cron limita goleadores recientes.
