# Liga BBVA automatica

La app no debe llevar la clave de la API en el navegador. Por eso la sincronizacion se hace con una Supabase Edge Function:

- Fuente recomendada: football-data.org
- Competicion: PD, Primera Division / Liga
- Temporada: 2026 para Liga 2026/27
- Tabla actualizada: public.matches

Pasos:

1. Ejecuta en Supabase SQL Editor:
   - add-competitions.sql
   - add-liga-auto-sync.sql

2. Crea una API key gratuita en football-data.org.

3. En Supabase, anade estos secretos a la funcion:
   - FOOTBALL_DATA_TOKEN = tu token
   - FOOTBALL_DATA_COMPETITION = PD
   - FOOTBALL_DATA_SEASON = 2026
   - SYNC_CRON_SECRET = una contrasena larga inventada por ti

4. Despliega la funcion:
   supabase functions deploy sync-football-data

5. Prueba la funcion:
   supabase functions invoke sync-football-data --no-verify-jwt

6. Para que se ejecute sola cada noche, activa pg_cron + pg_net o crea un Scheduled Function en Supabase llamando a sync-football-data.

Notas:

- No borra tus porras ni pronosticos.
- Los partidos de Liga se guardan con competition = liga.
- El Mundial queda como competition = mundial.
- Si Football-Data cambia horario o resultado, el siguiente sync lo actualiza.