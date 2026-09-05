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
type SyncCompetition = { competition: string; league: string; season: string; label: string }

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

function competitionLabel(competition: string) {
  const labels: Record<string, string> = {
    liga: 'Liga BBVA',
    primera_rfef_g1: 'Primera Federacion Grupo 1',
    primera_rfef_g2: 'Primera Federacion Grupo 2',
  }
  return labels[competition] || competition
}

function parseApiFootballLeagues(defaultSeason: string): SyncCompetition[] {
  const raw = Deno.env.get('API_FOOTBALL_LEAGUES')
  const fallback = [{
    competition: 'liga',
    league: Deno.env.get('API_FOOTBALL_LEAGUE') || '140',
    season: Deno.env.get('API_FOOTBALL_SEASON') || defaultSeason,
    label: 'Liga BBVA',
  }]

  if (!raw) return fallback

  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) {
      const configs = parsed.map((item) => ({
        competition: cleanName(item?.competition),
        league: cleanName(item?.league),
        season: cleanName(item?.season) || defaultSeason,
        label: cleanName(item?.label) || competitionLabel(cleanName(item?.competition)),
      })).filter((item) => item.competition && item.league)
      if (configs.length) return configs
    }
  } catch (_) {}

  const configs = raw.split(',').map((part) => {
    const [competition, league, season, ...labelParts] = part.split(':').map(cleanName)
    return {
      competition,
      league,
      season: season || defaultSeason,
      label: labelParts.join(':') || competitionLabel(competition),
    }
  }).filter((item) => item.competition && item.league)

  return configs.length ? configs : fallback
}

function playerPosition(position?: string) {
  const p = String(position || '').toLowerCase()
  if (p.includes('goalkeeper')) return 'PO'
  if (p.includes('defender')) return 'DF'
  if (p.includes('midfielder')) return 'MC'
  if (p.includes('attacker') || p.includes('forward')) return 'DL'
  return position || ''
}

function footballDataMatchRow(match: FootballDataMatch, season: string, competitionId = 'liga', label = 'Liga BBVA') {
  const home = match.homeTeam?.name || 'Equipo local pendiente'
  const away = match.awayTeam?.name || 'Equipo visitante pendiente'
  const finished = match.status === 'FINISHED'
  const homeScore = match.score?.fullTime?.home ?? null
  const awayScore = match.score?.fullTime?.away ?? null

  return {
    id: `${competitionId}_${season}_${match.id}`,
    competition: competitionId,
    external_source: 'football-data.org',
    external_id: String(match.id),
    external_status: match.status,
    group_name: match.matchday ? `Jornada ${match.matchday}` : label,
    home_team: home,
    away_team: away,
    match_date: match.utcDate,
    ...(finished ? {
      real_home: homeScore,
      real_away: awayScore,
      result_updated_at: new Date().toISOString(),
    } : {}),
  }
}

function apiFootballMatchRow(match: ApiFootballFixture, season: string, scorersByFixture: Map<string, string>, competitionId = 'liga', label = 'Liga BBVA') {
  const fixtureId = String(match.fixture?.id || '')
  const status = match.fixture?.status?.short || ''
  const finished = isFinishedStatus(status)
  const homeScore = match.score?.fulltime?.home ?? match.goals?.home ?? null
  const awayScore = match.score?.fulltime?.away ?? match.goals?.away ?? null
  const home = cleanName(match.teams?.home?.name) || 'Equipo local pendiente'
  const away = cleanName(match.teams?.away?.name) || 'Equipo visitante pendiente'

  return {
    id: `${competitionId}_${season}_${fixtureId}`,
    competition: competitionId,
    external_source: 'api-football',
    external_id: fixtureId,
    external_status: status,
    group_name: match.league?.round || label,
    home_team: home,
    away_team: away,
    match_date: match.fixture?.date,
    ...(finished ? {
      real_home: homeScore,
      real_away: awayScore,
      real_scorers: scorersByFixture.get(fixtureId) || '',
      result_updated_at: new Date().toISOString(),
    } : {}),
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function shouldRetryStatus(status: number) {
  return status === 408 || status === 429 || status >= 500
}

async function fetchJson(url: string, headers: Record<string, string>) {
  const maxAttempts = Math.max(1, Number(Deno.env.get('SYNC_FETCH_ATTEMPTS') || '4'))
  const baseDelayMs = Math.max(250, Number(Deno.env.get('SYNC_RETRY_DELAY_MS') || '2500'))
  let lastError: unknown

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(url, { headers })
      const text = await response.text()
      if (response.ok) return JSON.parse(text)
      const error = new Error(`${url} respondio ${response.status}: ${text}`)
      if (!shouldRetryStatus(response.status) || attempt === maxAttempts) throw error
      lastError = error
    } catch (error) {
      lastError = error
      if (attempt === maxAttempts) break
    }
    await sleep(baseDelayMs * attempt)
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError))
}

async function syncFootballData(supabase: ReturnType<typeof createClient>, apiToken: string, competition: string, season: string, competitionId = 'liga', label = 'Liga BBVA') {
  const endpoint = `https://api.football-data.org/v4/competitions/${competition}/matches?season=${season}`
  const payload = await fetchJson(endpoint, { 'X-Auth-Token': apiToken })
  const rows = (payload.matches || []).map((m: FootballDataMatch) => footballDataMatchRow(m, season, competitionId, label))

  if (rows.length) {
    const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'external_source,external_id' })
    if (error) throw error
  }

  return { provider: 'football-data.org', competition: competitionId, count: rows.length, details: `Actualizados ${rows.length} partidos de ${label} temporada ${season}` }
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

async function syncApiFootball(supabase: ReturnType<typeof createClient>, apiKey: string, config: SyncCompetition, options: { syncSquads?: boolean; fullScorers?: boolean }) {
  const payload = await fetchJson(`https://v3.football.api-sports.io/fixtures?league=${config.league}&season=${config.season}`, { 'x-apisports-key': apiKey })
  if (payload.errors && Object.keys(payload.errors).length) throw new Error(`API-Football no disponible: ${JSON.stringify(payload.errors)}`)
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

  const rows = fixtures.map((m) => apiFootballMatchRow(m, config.season, scorersByFixture, config.competition, config.label))
  if (rows.length) {
    const { error } = await supabase.from('matches').upsert(rows, { onConflict: 'external_source,external_id' })
    if (error) throw error
  }

  const squadCount = options.syncSquads ? await syncApiFootballSquads(supabase, apiKey, config.league, config.season) : 0
  return { provider: 'api-football', competition: config.competition, count: rows.length, scorersChecked: eventFixtures.length, squads: squadCount, details: `Actualizados ${rows.length} partidos de ${config.label}, ${eventFixtures.length} con goleadores y ${squadCount} jugadores` }
}

async function discoverSpanishLeagues(apiKey: string, season: string) {
  const payload = await fetchJson(`https://v3.football.api-sports.io/leagues?country=Spain&season=${season}`, { 'x-apisports-key': apiKey })
  const items = payload.response || []
  return items
    .map((item: any) => ({
      id: item?.league?.id,
      name: cleanName(item?.league?.name),
      type: cleanName(item?.league?.type),
      country: cleanName(item?.country?.name),
      season,
    }))
    .filter((item: any) => item.id && /primera|rfef|laliga|segunda/i.test(item.name))
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

    let body: { syncSquads?: boolean; fullScorers?: boolean; discoverLeagues?: boolean } = {}
    try { body = await req.json() } catch (_) {}

    const supabase = createClient(supabaseUrl, serviceRoleKey)
    const apiFootballKey = Deno.env.get('API_FOOTBALL_KEY')
    const season = Deno.env.get('FOOTBALL_DATA_SEASON') || Deno.env.get('API_FOOTBALL_SEASON') || '2026'
    const apiFootballLeagues = parseApiFootballLeagues(season)

    if (body.discoverLeagues) {
      if (!apiFootballKey) throw new Error('Falta API_FOOTBALL_KEY para descubrir ligas')
      const leagues = await discoverSpanishLeagues(apiFootballKey, season)
      return new Response(JSON.stringify({ ok: true, season, leagues }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const results = []
    if (apiFootballKey) {
      for (const config of apiFootballLeagues) {
        try {
          let result = await syncApiFootball(supabase, apiFootballKey, config, body)
          if (!result.count && config.competition === 'liga') {
            const fallbackToken = Deno.env.get('FOOTBALL_DATA_TOKEN')
            if (fallbackToken) result = await syncFootballData(supabase, fallbackToken, Deno.env.get('FOOTBALL_DATA_COMPETITION') || 'PD', config.season, config.competition, config.label)
          }
          results.push(result)
        } catch (apiFootballError) {
          const fallbackToken = Deno.env.get('FOOTBALL_DATA_TOKEN')
          if (config.competition !== 'liga' || !fallbackToken) throw apiFootballError
          results.push(await syncFootballData(supabase, fallbackToken, Deno.env.get('FOOTBALL_DATA_COMPETITION') || 'PD', config.season, config.competition, config.label))
        }
      }
    } else {
      results.push(await syncFootballData(supabase, required('FOOTBALL_DATA_TOKEN'), Deno.env.get('FOOTBALL_DATA_COMPETITION') || 'PD', season))
    }

    await supabase.from('sync_logs').insert(results.map((result) => ({
      source: result.provider,
      competition: result.competition,
      status: 'ok',
      details: result.details,
    })))

    const count = results.reduce((sum, result) => sum + result.count, 0)
    return new Response(JSON.stringify({ ok: true, season, count, results }), {
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


