import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type FootballDataMatch = {
  id: number
  utcDate: string
  status: string
  matchday?: number
  homeTeam?: { name?: string }
  awayTeam?: { name?: string }
  score?: { fullTime?: { home?: number | null; away?: number | null } }
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function required(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta variable ${name}`)
  return value
}

function matchRow(match: FootballDataMatch, season: string) {
  const home = match.homeTeam?.name || 'Equipo local pendiente'
  const away = match.awayTeam?.name || 'Equipo visitante pendiente'
  const finished = match.status === 'FINISHED'
  const homeScore = match.score?.fullTime?.home ?? null
  const awayScore = match.score?.fullTime?.away ?? null

  return {
    id: `liga_${season}_${match.id}`,
    competition: 'liga',
    external_source: 'football-data.org',
    external_id: String(match.id),
    external_status: match.status,
    group_name: match.matchday ? `Jornada ${match.matchday}` : 'Liga BBVA',
    home_team: home,
    away_team: away,
    match_date: match.utcDate,
    real_home: finished ? homeScore : null,
    real_away: finished ? awayScore : null,
    result_updated_at: finished ? new Date().toISOString() : null,
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = required('SUPABASE_URL')
    const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
    const apiToken = required('FOOTBALL_DATA_TOKEN')
    const cronSecret = Deno.env.get('SYNC_CRON_SECRET')

    if (cronSecret) {
      const auth = req.headers.get('Authorization') || ''
      if (auth !== `Bearer ${cronSecret}`) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    const competition = Deno.env.get('FOOTBALL_DATA_COMPETITION') || 'PD'
    const season = Deno.env.get('FOOTBALL_DATA_SEASON') || '2026'
    const endpoint = `https://api.football-data.org/v4/competitions/${competition}/matches?season=${season}`

    const response = await fetch(endpoint, { headers: { 'X-Auth-Token': apiToken } })
    if (!response.ok) throw new Error(`Football-Data respondio ${response.status}: ${await response.text()}`)

    const payload = await response.json()
    const rows = (payload.matches || []).map((m: FootballDataMatch) => matchRow(m, season))
    const supabase = createClient(supabaseUrl, serviceRoleKey)

    if (rows.length) {
      const { error } = await supabase
        .from('matches')
        .upsert(rows, { onConflict: 'external_source,external_id' })
      if (error) throw error
    }

    await supabase.from('sync_logs').insert({
      source: 'football-data.org',
      competition: 'liga',
      status: 'ok',
      details: `Actualizados ${rows.length} partidos de ${competition} temporada ${season}`,
    })

    return new Response(JSON.stringify({ ok: true, count: rows.length, competition, season }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'))
      await supabase.from('sync_logs').insert({ source: 'football-data.org', competition: 'liga', status: 'error', details: message })
    } catch (_) {}

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})