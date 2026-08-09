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

type ApiFootballFixture = {
  fixture?: { id?: number; date?: string; timestamp?: number; status?: { short?: string; long?: string } }
  league?: { round?: string }
  teams?: { home?: { id?: number; name?: string; code?: string }; away?: { id?: number; name?: string; code?: string } }
  goals?: { home?: number | null; away?: number | null }
  score?: { fulltime?: { home?: number | null; away?: number | null } }
}

type ApiFootballEvent = {
  type?: string
  detail?: string
  player?: { name?: string }
}

type ApiFootballTeam = { team?: { id?: number; name?: string; code?: string } }
type ApiFootballSquadPlayer = { id?: number; name?: string; position?: string }

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-sync-secret',
}

function required(name: string) {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Falta variable ${name}`)
  return value
}

function isFinishedStatus(status?: string) {
  return ['FT', 'AET', 'PEN'].includes(String(status || '').toUpperCase())
}

function cleanName(value?: string | null) {
  return String(value || '').replace(/\s+/g, ' ').trim()
}

function uniqueNames(names: string[]) {
  const seen = new Set<string>()
  return names.filter((name) => {
    const clean = cleanName(name)
    const key = clean.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    if (!clean || seen.has(key)) return false
    seen.add(key)
    return true
  })
}

function playerPosition(position?: string) {
  const p = String(position || '').toLowerCase()
  if (p.includes('goalkeeper')) return 'PO'
  if (p.includes('defender')) return 'DF'
  if (p.includes('midfielder')) return 'MC'
  if (p.includes('attacker') || p.includes('forward')) return 'DL'
  return position || ''
}

function footballDataMatchRow(match: FootballDataMatch, season: string) {
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

function apiFootballMatchRow(match: ApiFootballFixture, season: string, scorersByFixture: Map<string, string>) {
  const fixtureId = String(match.fixture?.id || '')
  const status = match.fixture?.status?.short || ''
  const finished = isFinishedStatus(status)
  const homeScore = match.score?.fulltime?.home ?? match.goals?.home ?? null
  const awayScore = match.score?.fulltime?.away ?? match.goals?.away ?? null
  const home = cleanName(match.teams?.home?.name) || 'Equipo local pendiente'
  const away = cleanName(match.teams?.away?.name) || 'Equipo visitante pendiente'

  return {
    id: `liga_${season}_${fixtureId}`,
    competition: 'liga',
    external_source: 'api-football',
    external_id: fixtureId,
    external_status: status,
    group_name: match.league?.round || 'Liga BBVA',
    home_team: home,
    away_team: away,
    match_date: match.fixture?.date,
    real_home: finished ? homeScore : null,
    real_away: finished ? awayScore : null,
    real_scorers: finished ? (scorersByFixture.get(fixtureId) || '') : null,
    result_updated_at: finished ? new Date().toISOString() : null,
  }
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const response = await fetch(url, { headers })
  const text = await response.text()
  if (!response.ok) throw new Error(`${url} respondio ${response.status}: ${text}`)
  return JSON.parse(text)
}

async function syncFootballData(supabase: ReturnType<typeof createClient>, apiToken: string, competition: string, season: string) {
  const endpoint = `https://api.football-data.org/v4/competitions/${competition}/matches?season=${season}`
  const payload = await fetchJson(endpoint, { 'X-Auth-Token': apiToken })
  const rows = (payload.matches || []).map((m: FootballDataMatch) => footballDataMatchRow(m, season))

  if (rows.length) {
    const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'external_source,external_id' })
    if (error) throw error
  }

  return { provider: 'football-data.org', count: rows.length, details: `Actualizados ${rows.length} partidos de ${competition} temporada ${season}` }
}

async function scorerNamesForFixture(apiKey: string, fixtureId: string) {
  const payload = await fetchJson(`https://v3.football.api-sports.io/fixtures/events?fixture=${fixtureId}`, { 'x-apisports-key': apiKey })
  const names = (payload.response || [])
    .filter((event: ApiFootballEvent) => String(event.type || '').toLowerCase() === 'goal')
    .filter((event: ApiFootballEvent) => !String(event.detail || '').toLowerCase().includes('missed'))
    .map((event: ApiFootballEvent) => cleanName(event.player?.name))
  return uniqueNames(names).join(',')
}

async function syncApiFootballSquads(supabase: ReturnType<typeof createClient>, apiKey: string, league: string, season: string) {
  const teamsPayload = await fetchJson(`https://v3.football.api-sports.io/teams?league=${league}&season=${season}`, { 'x-apisports-key': apiKey })
  const teams: ApiFootballTeam[] = teamsPayload.response || []
  const playerRows = []

  for (const item of teams) {
    const team = item.team
    if (!team?.id) continue
    const squadPayload = await fetchJson(`https://v3.football.api-sports.io/players/squads?team=${team.id}`, { 'x-apisports-key': apiKey })
    const squad = squadPayload.response?.[0]?.players || []
    for (const player of squad as ApiFootballSquadPlayer[]) {
      if (!player.name) continue
      playerRows.push({
        team_code: team.code || String(team.id),
        team_name: team.name || team.code || String(team.id),
        player_name: cleanName(player.name),
        position: playerPosition(player.position),
      })
    }
  }

  if (playerRows.length) {
    const { error } = await supabase.from('team_players').upsert(playerRows, { onConflict: 'team_code,player_name' })
    if (error) throw error
  }

  return playerRows.length
}

async function syncApiFootball(supabase: ReturnType<typeof createClient>, apiKey: string, league: string, season: string, options: { syncSquads?: boolean; fullScorers?: boolean }) {
  const payload = await fetchJson(`https://v3.football.api-sports.io/fixtures?league=${league}&season=${season}`, { 'x-apisports-key': apiKey })
  const fixtures: ApiFootballFixture[] = payload.response || []
  const maxEventMatches = Math.max(0, Number(Deno.env.get('API_FOOTBALL_MAX_EVENT_MATCHES') || '12'))
  const finished = fixtures
    .filter((m) => isFinishedStatus(m.fixture?.status?.short))
    .sort((a, b) => (b.fixture?.timestamp || 0) - (a.fixture?.timestamp || 0))
  const eventFixtures = options.fullScorers ? finished : finished.slice(0, maxEventMatches)
  const scorersByFixture = new Map<string, string>()

  for (const fixture of eventFixtures) {
    const fixtureId = String(fixture.fixture?.id || '')
    if (!fixtureId) continue
    scorersByFixture.set(fixtureId, await scorerNamesForFixture(apiKey, fixtureId))
  }

  const rows = fixtures.map((m) => apiFootballMatchRow(m, season, scorersByFixture))
  if (rows.length) {
    const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'external_source,external_id' })
    if (error) throw error
  }

  const squadCount = options.syncSquads ? await syncApiFootballSquads(supabase, apiKey, league, season) : 0
  return { provider: 'api-football', count: rows.length, scorersChecked: eventFixtures.length, squads: squadCount, details: `Actualizados ${rows.length} partidos, ${eventFixtures.length} con goleadores y ${squadCount} jugadores` }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseUrl = required('SUPABASE_URL')
    const serviceRoleKey = required('SUPABASE_SERVICE_ROLE_KEY')
    const cronSecret = Deno.env.get('SYNC_CRON_SECRET')

    if (cronSecret) {
      const auth = req.headers.get('Authorization') || ''
      const syncSecret = req.headers.get('X-Sync-Secret') || (auth.startsWith('Bearer ') ? auth.slice(7) : '')
      if (syncSecret !== cronSecret) {
        return new Response(JSON.stringify({ error: 'No autorizado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        })
      }
    }

    let body: { syncSquads?: boolean; fullScorers?: boolean } = {}
    try { body = await req.json() } catch (_) {}

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY')
    const apiFootballLeague = Deno.env.get('API_FOOTBALL_LEAGUE') || '140'
    const season = Deno.env.get('FOOTBALL_DATA_SEASON') || Deno.env.get('API_FOOTBALL_SEASON') || '2026'

    const result = apiFootballKey
      ? await syncApiFootball(supabase, apiFootballKey, apiFootballLeague, season, body)
      : await syncFootballData(supabase, required('FOOTBALL_DATA_TOKEN'), Deno.env.get('FOOTBALL_DATA_COMPETITION') || 'PD', season)

    await supabase.from('sync_logs').insert({
      source: result.provider,
      competition: 'liga',
      status: 'ok',
      details: result.details,
    })

    return new Response(JSON.stringify({ ok: true, season, ...result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    try {
      const supabase = createClient(required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY'))
      await supabase.from('sync_logs').insert({ source: 'football-sync', competition: 'liga', status: 'error', details: message })
    } catch (_) {}

    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
