MI PORRA, TU GLORIA - APP ONLINE COMPLETA

Incluye:
- 72 partidos de fase de grupos.
- Registro con nick y contraseña.
- Login.
- Pestaña Normas.
- Pronósticos.
- Bloqueo automático al comenzar el partido.
- Clasificación con desempates.
- Panel admin para meter resultados reales.

Pasos:
1. Crea proyecto gratis en Supabase.
2. En Supabase > SQL Editor pega supabase.sql y pulsa Run.
3. En Supabase > Project Settings > API copia:
   - Project URL
   - anon public key
4. Crea proyecto en Vercel y sube esta carpeta.
5. En Vercel > Settings > Environment Variables añade:
   VITE_SUPABASE_URL
   VITE_SUPABASE_ANON_KEY
6. Deploy.

Primer usuario:
- Registra nick admin.
- Ese usuario tendrá panel administrador.
