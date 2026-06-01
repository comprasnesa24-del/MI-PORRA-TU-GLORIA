import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseReady = SUPABASE_URL && SUPABASE_ANON_KEY
const supabase = supabaseReady ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

let currentUser = null
let tab = 'partidos'
let matches = []
let predictions = []
let users = []
let winners = []

const app = document.querySelector('#app')

const shields = {
  'España': '🇪🇸', 'México': '🇲🇽', 'Sudáfrica': '🇿🇦', 'Corea del Sur': '🇰🇷',
  'República Checa': '🇨🇿', 'Canadá': '🇨🇦', 'Bosnia y Herzegovina': '🇧🇦',
  'Estados Unidos': '🇺🇸', 'Paraguay': '🇵🇾', 'Brasil': '🇧🇷', 'Marruecos': '🇲🇦',
  'Australia': '🇦🇺', 'Turquía': '🇹🇷', 'Haití': '🇭🇹', 'Escocia': '🏴',
  'Catar': '🇶🇦', 'Suiza': '🇨🇭', 'Costa de Marfil': '🇨🇮', 'Ecuador': '🇪🇨',
  'Alemania': '🇩🇪', 'Curazao': '🇨🇼', 'Países Bajos': '🇳🇱', 'Japón': '🇯🇵',
  'Suecia': '🇸🇪', 'Túnez': '🇹🇳', 'Arabia Saudí': '🇸🇦', 'Uruguay': '🇺🇾',
  'Cabo Verde': '🇨🇻', 'Irán': '🇮🇷', 'Nueva Zelanda': '🇳🇿', 'Bélgica': '🇧🇪',
  'Egipto': '🇪🇬', 'Francia': '🇫🇷', 'Senegal': '🇸🇳', 'Irak': '🇮🇶',
  'Noruega': '🇳🇴', 'Argentina': '🇦🇷', 'Argelia': '🇩🇿', 'Austria': '🇦🇹',
  'Jordania': '🇯🇴', 'Ghana': '🇬🇭', 'Panamá': '🇵🇦', 'Inglaterra': '🏴',
  'Croacia': '🇭🇷', 'Portugal': '🇵🇹', 'RD Congo': '🇨🇩', 'Uzbekistán': '🇺🇿',
  'Colombia': '🇨🇴', 'Perú': '🇵🇪', 'Irlanda del Norte': '🇬🇧', 'Costa Rica': '🇨🇷',

  // Playoff ascenso a Primera
  'CD Castellón': '⚪⚫',
  'UD Almería': '🔴⚪',
  'UD Las Palmas': '🟡🔵',
  'Málaga CF': '🔵⚪',
  'Ganador Castellón/Almería': '🏆',
  'Ganador Las Palmas/Málaga': '🏆',
  'Peor clasificado final': '🏆',
  'Mejor clasificado final': '🏆'
}

function shield(team) {
  return shields[team] || '⚽'
}

function teamName(team) {
  return `${shield(team)} ${safe(team)}`
}

function sign(a, b) { if (a > b) return '1'; if (a < b) return '2'; return 'X' }

function points(ph, pa, rh, ra) {
  if (rh === null || ra === null || rh === undefined || ra === undefined) return null
  if (ph === rh && pa === ra) return 5
  if ((ph - pa) === (rh - ra)) return 3
  if (sign(ph, pa) === sign(rh, ra)) return 2
  return 0
}

function isLocked(m) { return new Date(m.match_date).getTime() <= Date.now() }

function pred(mid) { return predictions.find(p => p.user_id === currentUser?.id && p.match_id === mid) }

function safe(v) {
  return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]))
}

function userStats(userId) {
  let total = 0, exact = 0, diff = 0, sg = 0, played = 0
  predictions.filter(p => p.user_id === userId).forEach(p => {
    const m = matches.find(x => x.id === p.match_id)
    if (!m) return
    const pt = points(p.pred_home, p.pred_away, m.real_home, m.real_away)
    if (pt !== null) played++
    total += pt || 0
    if (pt === 5) exact++
    if (pt === 3) diff++
    if (pt === 2) sg++
  })
  return { total, exact, diff, sg, played }
}

async function loadData() {
  if (!supabaseReady) return renderNoConfig()
  const [m, p, u, w] = await Promise.all([
    supabase.from('matches').select('*').order('match_date'),
    supabase.from('predictions').select('*'),
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('winners_history').select('*').order('created_at', { ascending: false })
  ])
  matches = m.data || []; predictions = p.data || []; users = u.data || []; winners = w.data || []
  render()
}

async function register() {
  const nick = document.querySelector('#nick').value.trim()
  const password = document.querySelector('#password').value
  const email = document.querySelector('#email')?.value.trim() || ''
  if (!nick || !password) return alert('Pon nick y contraseña')
  const ex = await supabase.from('profiles').select('*').ilike('nick', nick).maybeSingle()
  if (ex.data) return alert('Ese nick ya existe')
  const ins = await supabase.from('profiles').insert({ nick, password, email, role: nick.toLowerCase() === 'admin' ? 'admin' : 'user' }).select().single()
  if (ins.error) return alert(ins.error.message)
  currentUser = ins.data
  await loadData()
}

async function login() {
  const nick = document.querySelector('#nick').value.trim()
  const password = document.querySelector('#password').value
  const res = await supabase.from('profiles').select('*').ilike('nick', nick).eq('password', password).maybeSingle()
  if (!res.data) return alert('Nick o contraseña incorrectos')
  currentUser = res.data
  await loadData()
}

async function recoverPassword() {
  const nickOrEmail = prompt('Escribe tu nick o email para recuperar la contraseña:')
  if (!nickOrEmail) return
  const res = await supabase.from('profiles').select('*').or(`nick.ilike.${nickOrEmail},email.ilike.${nickOrEmail}`).maybeSingle()
  if (!res.data) return alert('No se ha encontrado ese usuario')
  alert(`Contraseña de ${res.data.nick}: ${res.data.password}\n\nNota: versión sencilla. Más adelante se puede hacer recuperación segura por email.`)
}

function logout() { currentUser = null; tab = 'partidos'; render() }
function setTab(t) { tab = t; render() }

async function savePrediction(mid) {
  const m = matches.find(x => x.id === mid)
  if (isLocked(m) && currentUser.role !== 'admin') return alert('Este partido ya está bloqueado')
  const ph = parseInt(document.querySelector('#ph_' + mid).value, 10)
  const pa = parseInt(document.querySelector('#pa_' + mid).value, 10)
  if (isNaN(ph) || isNaN(pa) || ph < 0 || pa < 0) return alert('Pon un resultado válido')
  const existing = pred(mid)
  if (existing) await supabase.from('predictions').update({ pred_home: ph, pred_away: pa }).eq('id', existing.id)
  else await supabase.from('predictions').insert({ user_id: currentUser.id, match_id: mid, pred_home: ph, pred_away: pa })
  alert('Pronóstico guardado')
  await loadData()
}

async function saveReal(mid) {
  const rh = parseInt(document.querySelector('#rh_' + mid).value, 10)
  const ra = parseInt(document.querySelector('#ra_' + mid).value, 10)
  if (isNaN(rh) || isNaN(ra) || rh < 0 || ra < 0) return alert('Pon resultado real válido')
  await supabase.from('matches').update({ real_home: rh, real_away: ra }).eq('id', mid)
  await loadData()
}

async function resetReal(mid) {
  if (!confirm('¿Borrar el resultado real de este partido?')) return
  await supabase.from('matches').update({ real_home: null, real_away: null }).eq('id', mid)
  await loadData()
}

async function resetAllResults() {
  if (!confirm('¿Seguro que quieres borrar TODOS los resultados reales?')) return
  await supabase.from('matches').update({ real_home: null, real_away: null }).neq('id', '')
  await loadData()
  alert('Todos los resultados han sido reiniciados')
}

async function deletePredictionsByMatch(mid) {
  if (!confirm('¿Seguro que quieres borrar los pronósticos de este partido?')) return
  await supabase.from('predictions').delete().eq('match_id', mid)
  await loadData()
  alert('Pronósticos del partido eliminados')
}

async function deleteAllPredictions() {
  if (!confirm('¿Seguro que quieres borrar TODOS los pronósticos de TODOS los usuarios?')) return
  await supabase.from('predictions').delete().neq('id', '')
  await loadData()
  alert('Todos los pronósticos han sido eliminados')
}

async function deleteUser(userId, nick) {
  if (nick.toLowerCase() === 'admin') return alert('No puedes eliminar el usuario admin')
  if (!confirm(`¿Eliminar usuario ${nick}? También se borrarán sus pronósticos.`)) return
  await supabase.from('predictions').delete().eq('user_id', userId)
  await supabase.from('profiles').delete().eq('id', userId)
  await loadData()
  alert('Usuario eliminado')
}

async function resetUserPredictions(userId, nick) {
  if (!confirm(`¿Borrar todos los pronósticos de ${nick}?`)) return
  await supabase.from('predictions').delete().eq('user_id', userId)
  await loadData()
  alert('Pronósticos del usuario reiniciados')
}

async function toggleAdmin(userId, role, nick) {
  if (nick.toLowerCase() === 'admin') return alert('El usuario admin principal no se puede modificar')
  const newRole = role === 'admin' ? 'user' : 'admin'
  if (!confirm(`¿Cambiar a ${nick} a rol ${newRole}?`)) return
  await supabase.from('profiles').update({ role: newRole }).eq('id', userId)
  await loadData()
}

async function saveWinnerHistory() {
  const season = prompt('Nombre del campeonato/historial. Ejemplo: Mundial 2026')
  if (!season) return
  const ranked = users.map(u => ({ ...u, ...userStats(u.id) })).sort((a, b) => b.total - a.total || b.exact - a.exact || b.diff - a.diff || b.sg - a.sg)
  if (!ranked.length) return alert('No hay usuarios')
  const winner = ranked[0]
  await supabase.from('winners_history').insert({ season, winner_nick: winner.nick, points: winner.total, exacts: winner.exact, differences: winner.diff, signs: winner.sg })
  await loadData()
  alert('Ganador guardado en el historial')
}

function copyInviteLink() {
  const url = window.location.origin
  navigator.clipboard.writeText(url)
  alert('Enlace copiado para enviar por WhatsApp:\n' + url)
}

function hero() {
  return `<div class="hero"><div><div class="kicker">🏆 MUNDIAL · APP PRIVADA</div><h1>Mi Porra,<br><span>Tu Gloria</span></h1><p>Acierta el marcador, suma puntos y presume en la clasificación.</p></div><div class="ball">⚽</div></div>`
}

function renderNoConfig() {
  app.innerHTML = `<div class="app">${hero()}<div class="card"><h2>Falta conectar Supabase</h2><p>Configura estas variables en Vercel:</p><div class="notice"><b>VITE_SUPABASE_URL</b><br><b>VITE_SUPABASE_ANON_KEY</b></div></div></div>`
}

function loginView() {
  return `<div class="card"><h2>Entrar</h2><p class="muted">Primero registra un usuario. Para ser administrador usa el nick <b>admin</b>.</p><label>Nick</label><input id="nick" placeholder="admin"><label>Email opcional</label><input id="email" type="email" placeholder="tuemail@email.com"><label>Contraseña</label><input id="password" type="password" placeholder="Contraseña"><button id="loginBtn">Entrar</button><button id="registerBtn" class="blue">Registrarme</button><button id="recoverBtn" class="yellow">Recordar contraseña</button></div>`
}

function tabs() {
  return `<div class="tabs"><button onclick="window.setTab('partidos')">Partidos</button><button class="blue" onclick="window.setTab('normas')">Normas</button><button class="blue" onclick="window.setTab('clasificacion')">Clasificación</button><button class="blue" onclick="window.setTab('historial')">Historial</button>${currentUser?.role === 'admin' ? `<button class="yellow" onclick="window.setTab('admin')">Admin</button>` : ''}<button class="red" onclick="window.logout()">Salir</button></div><div class="card"><h2>Hola, ${safe(currentUser.nick)} ⚽</h2><p>“Aquí se viene a sufrir… y a sumar puntos.”</p></div>`
}

function matchesView() {
  return `<div class="card"><h2>Mis pronósticos</h2>${matches.map(m => {
    const p = pred(m.id)
    const pts = p ? points(p.pred_home, p.pred_away, m.real_home, m.real_away) : null
    const locked = isLocked(m)
    return `<div class="match"><span class="group">${safe(m.group_name)}</span><div class="teams">${teamName(m.home_team)} vs ${teamName(m.away_team)}</div><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><p><span class="badge ${locked ? 'closed' : ''}">${locked ? '🔒 Bloqueado' : 'Abierto'}</span> <span class="badge">${pts === null ? 'Pendiente' : pts + ' pts'}</span></p><div class="score"><div><label>${teamName(m.home_team)}</label><input ${locked && currentUser.role !== 'admin' ? 'disabled' : ''} type="number" min="0" id="ph_${m.id}" value="${p?.pred_home ?? ''}"></div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label><input ${locked && currentUser.role !== 'admin' ? 'disabled' : ''} type="number" min="0" id="pa_${m.id}" value="${p?.pred_away ?? ''}"></div></div><button class="small" onclick="window.savePrediction('${m.id}')">Guardar pronóstico</button><span class="muted"> Resultado real: <b>${m.real_home === null ? 'Pendiente' : m.real_home + ' - ' + m.real_away}</b></span></div>`
  }).join('')}</div>`
}

function rulesView() {
  return `<div class="card"><h2>📖 Normas de puntuación</h2><div class="rule"><h3>🎯 Resultado exacto: 5 puntos</h3><p>Acertar los goles exactos de los dos equipos.</p></div><div class="rule"><h3>⚽ Diferencia correcta: 3 puntos</h3><p>No es exacto, pero aciertas la diferencia de goles. Ejemplo: queda 1-0 y pusiste 2-1.</p></div><div class="rule"><h3>✅ Signo correcto 1 / X / 2: 2 puntos</h3><p>Acertar ganador o empate, aunque no sea exacto ni diferencia.</p></div><div class="rule"><h3>❌ Fallo: 0 puntos</h3><p>No aciertas quién gana ni el empate.</p></div><div class="rule"><h3>🔒 Bloqueo</h3><p>Los pronósticos se bloquean automáticamente cuando llega la fecha y hora del partido.</p></div></div>`
}

function rankingView() {
  const rows = users.map(u => ({ ...u, ...userStats(u.id) })).sort((a, b) => b.total - a.total || b.exact - a.exact || b.diff - a.diff || b.sg - a.sg)
  return `<div class="card"><h2>Clasificación privada</h2>${rows.map((r, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : i + 1
    return `<div class="ranking"><div>${medal}</div><div>${safe(r.nick)}<br><span class="muted">Jugados: ${r.played} · Exactos: ${r.exact} · Dif: ${r.diff} · Signos: ${r.sg}</span></div><div>${r.total} pts</div></div>`
  }).join('')}</div>`
}

function historyView() {
  return `<div class="card"><h2>🏆 Historial de ganadores</h2>${winners.length === 0 ? '<p class="muted">Todavía no hay ganadores guardados.</p>' : winners.map(w => `<div class="ranking"><div>🏆</div><div>${safe(w.winner_nick)}<br><span class="muted">${safe(w.season)} · Exactos: ${w.exacts} · Dif: ${w.differences} · Signos: ${w.signs}</span></div><div>${w.points} pts</div></div>`).join('')}</div>`
}

function adminView() {
  return `<div class="card"><h2>Panel administrador</h2><div style="margin-bottom:20px"><button class="small blue" onclick="window.copyInviteLink()">📲 Copiar enlace de invitación</button><button class="small yellow" onclick="window.saveWinnerHistory()">🏆 Guardar ganador en historial</button><button class="small red" onclick="window.resetAllResults()">🔄 Reiniciar TODOS los resultados</button><button class="small red" onclick="window.deleteAllPredictions()">🗑️ Borrar TODOS los pronósticos</button></div><h3>👥 Usuarios registrados</h3>${users.map(u => {
    const s = userStats(u.id)
    return `<div class="ranking"><div>${u.role === 'admin' ? '👑' : '👤'}</div><div>${safe(u.nick)}<br><span class="muted">${safe(u.email || 'Sin email')} · ${u.role} · ${s.total} pts</span></div><div><button class="small yellow" onclick="window.toggleAdmin('${u.id}', '${u.role}', '${safe(u.nick)}')">${u.role === 'admin' ? 'Quitar admin' : 'Hacer admin'}</button><button class="small red" onclick="window.resetUserPredictions('${u.id}', '${safe(u.nick)}')">Reset puntos</button>${u.nick.toLowerCase() !== 'admin' ? `<button class="small red" onclick="window.deleteUser('${u.id}', '${safe(u.nick)}')">Eliminar</button>` : ''}</div></div>`
  }).join('')}<h3>⚽ Resultados</h3><p class="muted">Introduce resultados reales. También puedes reiniciar resultados o borrar pronósticos de prueba.</p>${matches.map(m => `<div class="adminrow"><b>${safe(m.group_name)} · ${teamName(m.home_team)} vs ${teamName(m.away_team)}</b><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><div class="score"><div><label>${teamName(m.home_team)}</label><input type="number" min="0" id="rh_${m.id}" value="${m.real_home ?? ''}"></div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label><input type="number" min="0" id="ra_${m.id}" value="${m.real_away ?? ''}"></div></div><button class="small" onclick="window.saveReal('${m.id}')">Guardar resultado</button><button class="small red" onclick="window.resetReal('${m.id}')">Reset resultado</button><button class="small red" onclick="window.deletePredictionsByMatch('${m.id}')">Borrar pronósticos partido</button></div>`).join('')}</div>`
}

function render() {
  if (!supabaseReady) return renderNoConfig()
  app.innerHTML = `<div class="app">${hero()}${!currentUser ? loginView() : tabs() + (tab === 'partidos' ? matchesView() : tab === 'normas' ? rulesView() : tab === 'clasificacion' ? rankingView() : tab === 'historial' ? historyView() : adminView())}</div>`
  if (!currentUser) {
    document.querySelector('#loginBtn').onclick = login
    document.querySelector('#registerBtn').onclick = register
    document.querySelector('#recoverBtn').onclick = recoverPassword
  }
}

window.setTab = setTab
window.logout = logout
window.savePrediction = savePrediction
window.saveReal = saveReal
window.resetReal = resetReal
window.resetAllResults = resetAllResults
window.deletePredictionsByMatch = deletePredictionsByMatch
window.deleteAllPredictions = deleteAllPredictions
window.deleteUser = deleteUser
window.resetUserPredictions = resetUserPredictions
window.toggleAdmin = toggleAdmin
window.saveWinnerHistory = saveWinnerHistory
window.copyInviteLink = copyInviteLink

loadData()
