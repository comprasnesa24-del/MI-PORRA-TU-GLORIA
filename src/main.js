import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const supabaseReady = SUPABASE_URL && SUPABASE_ANON_KEY
const supabase = supabaseReady ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null

let currentUser = null, tab = 'partidos', matches = [], predictions = [], users = []
const app = document.querySelector('#app')

function sign(a,b){ if(a>b)return '1'; if(a<b)return '2'; return 'X' }
function points(ph,pa,rh,ra){ if(rh===null||ra===null||rh===undefined||ra===undefined)return null; if(ph===rh&&pa===ra)return 5; if((ph-pa)===(rh-ra))return 3; if(sign(ph,pa)===sign(rh,ra))return 2; return 0 }
function isLocked(m){ return new Date(m.match_date).getTime() <= Date.now() }
function pred(mid){ return predictions.find(p=>p.user_id===currentUser?.id&&p.match_id===mid) }
function safe(v){ return String(v ?? '').replace(/[&<>"']/g, s => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s])) }

async function loadData(){
  if(!supabaseReady) return renderNoConfig()
  const [m,p,u] = await Promise.all([
    supabase.from('matches').select('*').order('match_date'),
    supabase.from('predictions').select('*'),
    supabase.from('profiles').select('*')
  ])
  matches=m.data||[]; predictions=p.data||[]; users=u.data||[]
  render()
}
async function register(){
  const nick=document.querySelector('#nick').value.trim(), password=document.querySelector('#password').value
  if(!nick||!password)return alert('Pon nick y contraseña')
  const ex=await supabase.from('profiles').select('*').ilike('nick',nick).maybeSingle()
  if(ex.data)return alert('Ese nick ya existe')
  const ins=await supabase.from('profiles').insert({nick,password,role:nick.toLowerCase()==='admin'?'admin':'user'}).select().single()
  if(ins.error)return alert(ins.error.message)
  currentUser=ins.data; await loadData()
}
async function login(){
  const nick=document.querySelector('#nick').value.trim(), password=document.querySelector('#password').value
  const res=await supabase.from('profiles').select('*').ilike('nick',nick).eq('password',password).maybeSingle()
  if(!res.data)return alert('Nick o contraseña incorrectos')
  currentUser=res.data; await loadData()
}
function logout(){ currentUser=null; tab='partidos'; render() }
function setTab(t){ tab=t; render() }
async function savePrediction(mid){
  const m=matches.find(x=>x.id===mid)
  if(isLocked(m)&&currentUser.role!=='admin')return alert('Este partido ya está bloqueado')
  const ph=parseInt(document.querySelector('#ph_'+mid).value,10), pa=parseInt(document.querySelector('#pa_'+mid).value,10)
  if(isNaN(ph)||isNaN(pa)||ph<0||pa<0)return alert('Pon un resultado válido')
  const existing=pred(mid)
  if(existing) await supabase.from('predictions').update({pred_home:ph,pred_away:pa}).eq('id',existing.id)
  else await supabase.from('predictions').insert({user_id:currentUser.id,match_id:mid,pred_home:ph,pred_away:pa})
  alert('Pronóstico guardado'); await loadData()
}
async function saveReal(mid){
  const rh=parseInt(document.querySelector('#rh_'+mid).value,10), ra=parseInt(document.querySelector('#ra_'+mid).value,10)
  if(isNaN(rh)||isNaN(ra)||rh<0||ra<0)return alert('Pon resultado real válido')
  await supabase.from('matches').update({real_home:rh,real_away:ra}).eq('id',mid)
  await loadData()
}
function hero(){return `<div class="hero"><div><div class="kicker">🏆 MUNDIAL · APP PRIVADA</div><h1>Mi Porra,<br><span>Tu Gloria</span></h1><p>Acierta el marcador, suma puntos y presume en la clasificación.</p></div><div class="ball">⚽</div></div>`}
function renderNoConfig(){app.innerHTML=`<div class="app">${hero()}<div class="card"><h2>Falta conectar Supabase</h2><p>Configura estas variables en Vercel:</p><div class="notice"><b>VITE_SUPABASE_URL</b><br><b>VITE_SUPABASE_ANON_KEY</b></div><p>Usa el archivo <b>supabase.sql</b> para crear la base de datos.</p></div></div>`}
function loginView(){return `<div class="card"><h2>Entrar</h2><p class="muted">Primero registra un usuario. Para ser administrador usa el nick <b>admin</b>.</p><label>Nick</label><input id="nick" placeholder="admin"><label>Contraseña</label><input id="password" type="password" placeholder="Contraseña"><button id="loginBtn">Entrar</button><button id="registerBtn" class="blue">Registrarme</button></div>`}
function tabs(){return `<div class="tabs"><button onclick="window.setTab('partidos')">Partidos</button><button class="blue" onclick="window.setTab('normas')">Normas</button><button class="blue" onclick="window.setTab('clasificacion')">Clasificación</button>${currentUser?.role==='admin'?`<button class="yellow" onclick="window.setTab('admin')">Admin</button>`:''}<button class="red" onclick="window.logout()">Salir</button></div><div class="card"><h2>Hola, ${safe(currentUser.nick)} ⚽</h2><p>“Aquí se viene a sufrir… y a sumar puntos.”</p></div>`}
function matchesView(){return `<div class="card"><h2>Mis pronósticos</h2>${matches.map(m=>{const p=pred(m.id), pts=p?points(p.pred_home,p.pred_away,m.real_home,m.real_away):null, locked=isLocked(m);return `<div class="match"><span class="group">Grupo ${safe(m.group_name)}</span><div class="teams">${safe(m.home_team)} vs ${safe(m.away_team)}</div><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><p><span class="badge ${locked?'closed':''}">${locked?'🔒 Bloqueado':'Abierto'}</span> <span class="badge">${pts===null?'Pendiente':pts+' pts'}</span></p><div class="score"><div><label>${safe(m.home_team)}</label><input ${locked&&currentUser.role!=='admin'?'disabled':''} type="number" min="0" id="ph_${m.id}" value="${p?.pred_home??''}"></div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${safe(m.away_team)}</label><input ${locked&&currentUser.role!=='admin'?'disabled':''} type="number" min="0" id="pa_${m.id}" value="${p?.pred_away??''}"></div></div><button class="small" onclick="window.savePrediction('${m.id}')">Guardar pronóstico</button><span class="muted"> Resultado real: <b>${m.real_home===null?'Pendiente':m.real_home+' - '+m.real_away}</b></span></div>`}).join('')}</div>`}
function rulesView(){return `<div class="card"><h2>📖 Normas de puntuación</h2><div class="rule"><h3>🎯 Resultado exacto: 5 puntos</h3><p>Acertar los goles exactos de los dos equipos.</p></div><div class="rule"><h3>⚽ Diferencia correcta: 3 puntos</h3><p>No es exacto, pero aciertas la diferencia de goles. Ejemplo: queda 1-0 y pusiste 2-1.</p></div><div class="rule"><h3>✅ Signo correcto 1 / X / 2: 2 puntos</h3><p>Acertar ganador o empate, aunque no sea exacto ni diferencia.</p></div><div class="rule"><h3>❌ Fallo: 0 puntos</h3><p>No aciertas quién gana ni el empate.</p></div><div class="rule"><h3>🔒 Bloqueo</h3><p>Los pronósticos se bloquean automáticamente cuando empieza el partido.</p></div></div>`}
function rankingView(){const rows=users.map(u=>{let total=0,exact=0,diff=0,sg=0;predictions.filter(p=>p.user_id===u.id).forEach(p=>{const m=matches.find(x=>x.id===p.match_id);if(!m)return;const pt=points(p.pred_home,p.pred_away,m.real_home,m.real_away);total+=pt||0;if(pt===5)exact++;if(pt===3)diff++;if(pt===2)sg++});return{nick:u.nick,total,exact,diff,sg}}).sort((a,b)=>b.total-a.total||b.exact-a.exact||b.diff-a.diff||b.sg-a.sg);return `<div class="card"><h2>Clasificación privada</h2>${rows.map((r,i)=>`<div class="ranking"><div>${i===0?'🏆':i+1}</div><div>${safe(r.nick)}<br><span class="muted">Exactos: ${r.exact} · Dif: ${r.diff} · Signos: ${r.sg}</span></div><div>${r.total} pts</div></div>`).join('')}</div>`}
function adminView(){return `<div class="card"><h2>Panel administrador</h2><p class="muted">Introduce resultados reales. Después se puede conectar API-Football.</p>${matches.map(m=>`<div class="adminrow"><b>Grupo ${safe(m.group_name)} · ${safe(m.home_team)} vs ${safe(m.away_team)}</b><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><div class="score"><div><label>${safe(m.home_team)}</label><input type="number" min="0" id="rh_${m.id}" value="${m.real_home??''}"></div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${safe(m.away_team)}</label><input type="number" min="0" id="ra_${m.id}" value="${m.real_away??''}"></div></div><button class="small" onclick="window.saveReal('${m.id}')">Guardar resultado</button></div>`).join('')}</div>`}
function render(){if(!supabaseReady)return renderNoConfig();app.innerHTML=`<div class="app">${hero()}${!currentUser?loginView():tabs()+(tab==='partidos'?matchesView():tab==='normas'?rulesView():tab==='clasificacion'?rankingView():adminView())}</div>`;if(!currentUser){document.querySelector('#loginBtn').onclick=login;document.querySelector('#registerBtn').onclick=register}}
window.setTab=setTab;window.logout=logout;window.savePrediction=savePrediction;window.saveReal=saveReal
loadData()
