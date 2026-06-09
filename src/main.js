import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm'

const SUPABASE_URL=import.meta.env.VITE_SUPABASE_URL||''
const SUPABASE_ANON_KEY=import.meta.env.VITE_SUPABASE_ANON_KEY||''
const supabaseReady=SUPABASE_URL&&SUPABASE_ANON_KEY
const supabase=supabaseReady?createClient(SUPABASE_URL,SUPABASE_ANON_KEY):null

let currentUser=null,currentPool=null,tab='porras',teamPlayers=[]
let editingPredictions={}
let matches=[],predictions=[],users=[],winners=[],pools=[],poolMembers=[],chatMessages=[]
const app=document.querySelector('#app')

const SESSION_KEY='mi_porra_session_v2'

function saveSession(){
  try{
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      userId: currentUser?.id || null,
      poolId: currentPool?.id || null
    }))
  }catch(e){}
}

function clearSession(){
  try{ localStorage.removeItem(SESSION_KEY) }catch(e){}
}

async function restoreSession(){
  if(!supabaseReady) return false
  try{
    const raw=localStorage.getItem(SESSION_KEY)
    if(!raw) return false

    const session=JSON.parse(raw)
    if(!session.userId) return false

    const userRes=await supabase.from('profiles').select('*').eq('id',session.userId).maybeSingle()
    if(!userRes.data){
      clearSession()
      return false
    }

    currentUser=userRes.data

    await loadData(false)

    if(session.poolId){
      currentPool=pools.find(p=>p.id===session.poolId)||null
    }

    if(!currentPool){
      const mem=poolMembers.find(pm=>pm.user_id===currentUser.id)
      currentPool=pools.find(p=>p.id===mem?.pool_id)||null
    }

    tab=currentPool?'partidos':'porras'
    document.title='MI PORRA'
    render()
    return true
  }catch(e){
    clearSession()
    return false
  }
}


const shields={'España':'🇪🇸','México':'🇲🇽','Sudáfrica':'🇿🇦','Corea del Sur':'🇰🇷','República Checa':'🇨🇿','Canadá':'🇨🇦','Bosnia y Herzegovina':'🇧🇦','Estados Unidos':'🇺🇸','Paraguay':'🇵🇾','Brasil':'🇧🇷','Marruecos':'🇲🇦','Australia':'🇦🇺','Turquía':'🇹🇷','Haití':'🇭🇹','Escocia':'🏴','Catar':'🇶🇦','Suiza':'🇨🇭','Costa de Marfil':'🇨🇮','Ecuador':'🇪🇨','Alemania':'🇩🇪','Curazao':'🇨🇼','Países Bajos':'🇳🇱','Japón':'🇯🇵','Suecia':'🇸🇪','Túnez':'🇹🇳','Arabia Saudí':'🇸🇦','Uruguay':'🇺🇾','Cabo Verde':'🇨🇻','Irán':'🇮🇷','Nueva Zelanda':'🇳🇿','Bélgica':'🇧🇪','Egipto':'🇪🇬','Francia':'🇫🇷','Senegal':'🇸🇳','Irak':'🇮🇶','Noruega':'🇳🇴','Argentina':'🇦🇷','Argelia':'🇩🇿','Austria':'🇦🇹','Jordania':'🇯🇴','Ghana':'🇬🇭','Panamá':'🇵🇦','Inglaterra':'🏴','Croacia':'🇭🇷','Portugal':'🇵🇹','RD Congo':'🇨🇩','Uzbekistán':'🇺🇿','Colombia':'🇨🇴','Perú':'🇵🇪','Irlanda del Norte':'🇬🇧','Costa Rica':'🇨🇷','CD Castellón':'⚪⚫','UD Almería':'🔴⚪','UD Las Palmas':'🟡🔵','Málaga CF':'🔵⚪','Peor clasificado final':'🏆','Mejor clasificado final':'🏆'}

function safe(v){return String(v??'').replace(/[&<>"']/g,s=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[s]))}
function shield(t){return shields[t]||'⚽'}
function teamName(t){return `${shield(t)} ${safe(t)}`}
function avatar(u){return `<span class="avatar" style="background:${safe(u?.avatar_color||'#22c55e')}">${safe(u?.avatar_emoji||'⚽')}</span>`}
function isGlobalAdmin(){ return currentUser?.role === 'admin' }

function sign(a,b){if(a>b)return'1';if(a<b)return'2';return'X'}
function basePoints(ph,pa,rh,ra){if(rh==null||ra==null)return null;if(ph===rh&&pa===ra)return 5;if((ph-pa)===(rh-ra))return 3;if(sign(ph,pa)===sign(rh,ra))return 2;return 0}
function normTeam(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim()}
const TEAM_ALIASES={
  "argelia":"ALG","algeria":"ALG","alg":"ALG",
  "argentina":"ARG","arg":"ARG",
  "australia":"AUS","aus":"AUS",
  "austria":"AUT","aut":"AUT",
  "belgica":"BEL","bélgica":"BEL","belgium":"BEL","bel":"BEL",
  "bosnia":"BIH","bosnia y herzegovina":"BIH","bosnia and herzegovina":"BIH","bih":"BIH",
  "brasil":"BRA","brazil":"BRA","bra":"BRA",
  "cabo verde":"CPV","cape verde":"CPV","cpv":"CPV",
  "canada":"CAN","canadá":"CAN","can":"CAN",
  "colombia":"COL","col":"COL",
  "congo":"COD","rd congo":"COD","congo dr":"COD","dr congo":"COD","república democrática del congo":"COD","republica democratica del congo":"COD","cod":"COD",
  "costa de marfil":"CIV","côte divoire":"CIV","cote divoire":"CIV","civ":"CIV",
  "croacia":"CRO","croatia":"CRO","cro":"CRO",
  "curazao":"CUW","curaçao":"CUW","curacao":"CUW","cuw":"CUW",
  "ecuador":"ECU","ecu":"ECU",
  "egipto":"EGY","egypt":"EGY","egy":"EGY",
  "inglaterra":"ENG","england":"ENG","eng":"ENG",
  "francia":"FRA","france":"FRA","fra":"FRA",
  "alemania":"GER","germany":"GER","ger":"GER",
  "ghana":"GHA","gha":"GHA",
  "haiti":"HAI","haití":"HAI","hai":"HAI",
  "iran":"IRN","irán":"IRN","irn":"IRN",
  "irak":"IRQ","iraq":"IRQ","irq":"IRQ",
  "japon":"JPN","japón":"JPN","japan":"JPN","jpn":"JPN",
  "jordania":"JOR","jordan":"JOR","jor":"JOR",
  "marruecos":"MAR","morocco":"MAR","mar":"MAR",
  "mexico":"MEX","méxico":"MEX","mex":"MEX",
  "paises bajos":"NED","países bajos":"NED","holanda":"NED","netherlands":"NED","ned":"NED",
  "nueva zelanda":"NZL","new zealand":"NZL","nzl":"NZL",
  "noruega":"NOR","norway":"NOR","nor":"NOR",
  "panama":"PAN","panamá":"PAN","pan":"PAN",
  "paraguay":"PAR","par":"PAR",
  "portugal":"POR","por":"POR",
  "catar":"QAT","qatar":"QAT","qat":"QAT",
  "arabia saudi":"KSA","arabia saudí":"KSA","saudi arabia":"KSA","ksa":"KSA",
  "escocia":"SCO","scotland":"SCO","sco":"SCO",
  "senegal":"SEN","sen":"SEN",
  "corea del sur":"KOR","south korea":"KOR","korea republic":"KOR","república de corea":"KOR","republica de corea":"KOR","kor":"KOR",
  "espana":"ESP","españa":"ESP","spain":"ESP","esp":"ESP",
  "suecia":"SWE","sweden":"SWE","swe":"SWE",
  "suiza":"SUI","switzerland":"SUI","sui":"SUI",
  "tunez":"TUN","túnez":"TUN","tunisia":"TUN","tun":"TUN",
  "turquia":"TUR","turquía":"TUR","turkey":"TUR","tur":"TUR",
  "uruguay":"URU","uru":"URU",
  "uzbekistan":"UZB","uzbekistán":"UZB","uzb":"UZB",
  "estados unidos":"USA","eeuu":"USA","ee uu":"USA","united states":"USA","usa":"USA"
}
function teamCodeForName(name){const n=normTeam(name);if(TEAM_ALIASES[n])return TEAM_ALIASES[n];const found=teamPlayers.find(p=>normTeam(p.team_name)===n||normTeam(p.team_code)===n);return found?.team_code||null}
function playersForMatch(m){
  const h=teamCodeForName(m.home_team)
  const a=teamCodeForName(m.away_team)
  const codes=[h,a].filter(Boolean)

  let list = codes.length
    ? teamPlayers.filter(p=>codes.includes(p.team_code))
    : teamPlayers

  // Si solo reconoce un equipo, añade todos como apoyo para que nunca salga campo manual.
  if(list.length===0) list = teamPlayers

  return list.sort((x,y)=>(x.team_code+x.position+x.player_name).localeCompare(y.team_code+y.position+y.player_name))
}

function jokerLimit(){return 5}
function jokerUsed(){return jokerCount()>=jokerLimit()}

function userStats(uid){let total=0,exact=0,diff=0,sg=0,played=0,jokers=0,positive=0,scorersOk=0;poolPredictions().filter(p=>p.user_id===uid).forEach(p=>{const m=matches.find(x=>x.id===p.match_id);if(!m)return;const b=basePoints(p.pred_home,p.pred_away,m.real_home,m.real_away);const pt=pointsForPrediction(p,m);if(pt!==null)played++;total+=pt||0;if(b===5)exact++;if(b===3)diff++;if(b===2)sg++;if(b&&b>0)positive++;if(p.is_joker)jokers++;if(scorerPoints(p,m)>0)scorersOk++});return{total,exact,diff,sg,played,jokers,scorersOk,percent:played?Math.round((positive/played)*100):0}}
function badgeForUser(s,all){if(!s.played)return'';const mt=Math.max(...all.map(x=>x.total),0),me=Math.max(...all.map(x=>x.exact),0);if(s.total===mt&&s.total>0)return'<span class="badge-gold">🔥 Líder</span>';if(s.exact===me&&s.exact>0)return'<span class="badge-gold">🎯 Rey de exactos</span>';if(s.percent>=75&&s.played>=3)return'<span class="badge-gold">🧠 Experto</span>';return''}

async function loadData(doRender=true){if(!supabaseReady)return renderNoConfig();const [m,p,u,w,po,pm,c,tp]=await Promise.all([supabase.from('matches').select('*').order('match_date'),supabase.from('predictions').select('*'),supabase.from('profiles').select('*').order('created_at'),supabase.from('winners_history').select('*').order('created_at',{ascending:false}),supabase.from('pools').select('*').order('created_at'),supabase.from('pool_members').select('*'),supabase.from('chat_messages').select('*').order('created_at',{ascending:true}),supabase.from('team_players').select('*')]);matches=m.data||[];teamPlayers=tp?.data||[];predictions=p.data||[];users=u.data||[];winners=w.data||[];pools=po.data||[];poolMembers=pm.data||[];chatMessages=c.data||[];if(currentPool)currentPool=pools.find(p=>p.id===currentPool.id)||null;if(doRender)render()}
async function ensureDefaultPoolForUser(user){ return }

async function register(){const nick=document.querySelector('#nick').value.trim(),password=document.querySelector('#password').value,email=document.querySelector('#email')?.value.trim()||'';if(!nick||!password)return alert('Pon nick y contraseña');const ex=await supabase.from('profiles').select('*').ilike('nick',nick).maybeSingle();if(ex.data)return alert('Ese nick ya existe');const ins=await supabase.from('profiles').insert({nick,password,email,role:'user'}).select().single();if(ins.error)return alert(ins.error.message);currentUser=ins.data;saveSession();await loadData();await ensureDefaultPoolForUser(currentUser);await loadData();const mem=poolMembers.filter(pm=>pm.user_id===currentUser.id);currentPool=pools.find(p=>p.id===mem[0]?.pool_id)||null;tab='porras';saveSession();document.title='MI PORRA';render()}
async function login(){const nick=document.querySelector('#nick').value.trim(),password=document.querySelector('#password').value;const res=await supabase.from('profiles').select('*').ilike('nick',nick).eq('password',password).maybeSingle();if(!res.data)return alert('Nick o contraseña incorrectos');currentUser=res.data;saveSession();await loadData();await ensureDefaultPoolForUser(currentUser);await loadData();const mem=poolMembers.filter(pm=>pm.user_id===currentUser.id);currentPool=pools.find(p=>p.id===mem[0]?.pool_id)||null;tab=currentUser?.role==='admin'?'porras':(currentPool?'partidos':'porras');saveSession();document.title='MI PORRA';render()}
async function recoverPassword(){const q=prompt('Escribe tu nick o email:');if(!q)return;const r=await supabase.from('profiles').select('*').or(`nick.ilike.${q},email.ilike.${q}`).maybeSingle();if(!r.data)return alert('No encontrado');alert(`Contraseña de ${r.data.nick}: ${r.data.password}`)}
async function saveProfile(){const emoji=prompt('Emoji avatar',currentUser.avatar_emoji||'⚽');if(!emoji)return;const color=prompt('Color fondo',currentUser.avatar_color||'#22c55e');if(!color)return;await supabase.from('profiles').update({avatar_emoji:emoji,avatar_color:color}).eq('id',currentUser.id);currentUser={...currentUser,avatar_emoji:emoji,avatar_color:color};await loadData()}
function logout(){currentUser=null;currentPool=null;tab='porras';saveSession();document.title='MI PORRA';render()}
function setTab(t){tab=t;render()}
function selectPool(id){currentPool=pools.find(p=>p.id===id)||null;tab=currentUser?.role==='admin'?'porras':(currentPool?'partidos':'porras');saveSession();document.title='MI PORRA';render()}
async function createPool(){
  const name=prompt('Nombre de la porra privada:')
  if(!name)return

  let code=prompt('Código invitación. Vacío para automático:')
  if(!code)code=generateCode()
  code=code.trim().toUpperCase()

  const ex=await supabase.from('pools').select('*').eq('code',code).maybeSingle()
  if(ex.data)return alert('Ese código ya existe')

  const jokerConfirm=confirm('¿Quieres activar el Joker en esta porra?\n\nSi lo activas, cada jugador tendrá 5 Jokers para duplicar los puntos de hasta 5 partidos.')
  const prizes=prompt('Premios de esta porra. Ejemplo:\n1º 100€\n2º Cena\n3º Botella de vino','') || ''
  const scorerConfirm=confirm('¿Quieres activar la apuesta de goleador?\n\nCada usuario podrá poner un goleador por partido. Si acierta, suma +2 puntos.')

  const ins=await supabase.from('pools').insert({
    name,
    code,
    created_by:currentUser.id,
    enable_joker:jokerConfirm,
    enable_scorer:scorerConfirm,
    prizes
  }).select().single()

  if(ins.error)return alert(ins.error.message)

  await supabase.from('pool_members').insert({
    pool_id:ins.data.id,
    user_id:currentUser.id,
    role:'user'
  })

  currentPool=ins.data
  tab='partidos'
  saveSession()
  await loadData()
}

async function joinPool(){let code=prompt('Código de la porra:');if(!code)return;code=code.trim().toUpperCase();const res=await supabase.from('pools').select('*').eq('code',code).maybeSingle();if(!res.data)return alert('No existe');const ex=await supabase.from('pool_members').select('*').eq('pool_id',res.data.id).eq('user_id',currentUser.id).maybeSingle();if(!ex.data)await supabase.from('pool_members').insert({pool_id:res.data.id,user_id:currentUser.id,role:'user'});currentPool=res.data;tab='partidos';saveSession();document.title='MI PORRA';await loadData()}
function copyPoolInvite(){if(!currentPool)return;const text=`Únete a "${currentPool.name}" en Mi Porra, Tu Gloria.\n${window.location.origin}\nCódigo: ${currentPool.code}`;navigator.clipboard.writeText(text);alert('Invitación copiada')}

function editPrediction(mid){
  const m = matches.find(x => x.id === mid)
  if(!m) return
  if(isLocked(m) && !isGlobalAdmin()) return alert('Este partido ya ha empezado y no se puede editar')
  editingPredictions[mid] = true
  render()
}

async function leavePool(poolId, poolName){
  if(!currentUser) return
  if(!confirm(`¿Quieres salir de la porra "${poolName}"? Se borrarán tus pronósticos de esta porra.`)) return

  await supabase.from('predictions')
    .delete()
    .eq('pool_id', poolId)
    .eq('user_id', currentUser.id)

  await supabase.from('pool_members')
    .delete()
    .eq('pool_id', poolId)
    .eq('user_id', currentUser.id)

  if(currentPool?.id === poolId){
    currentPool = null
    tab = 'porras'
  }

  await loadData()
}

async function updatePoolSettings(){
  if(!currentPool) return alert('Selecciona una porra')
  if(currentUser?.role !== 'admin' && currentPool.created_by !== currentUser.id) return alert('Solo el creador o el admin puede editar esta porra')

  const enable_joker = confirm('¿Quieres que esta porra tenga Joker activado?')
  const scorerOption = confirm('¿Quieres activar la apuesta de goleador en esta porra?')
  const prizes = prompt('Premios de esta porra:', currentPool.prizes || '') || ''

  await supabase.from('pools').update({
    enable_joker,
    enable_scorer:scorerOption,
    prizes
  }).eq('id', currentPool.id)

  await loadData()
}

async function togglePoolJoker(){if(!canAdminPool())return;await supabase.from('pools').update({enable_joker:!currentPool.enable_joker}).eq('id',currentPool.id);await loadData()}
async function sendChatMessage(){const i=document.querySelector('#chatInput'),msg=i.value.trim();if(!msg)return;await supabase.from('chat_messages').insert({pool_id:currentPool.id,user_id:currentUser.id,message:msg});i.value='';await loadData();tab='chat';render()}
async function deleteChatMessage(id){if(!canAdminPool())return;if(!confirm('¿Borrar mensaje?'))return;await supabase.from('chat_messages').delete().eq('id',id);await loadData()}

async function deletePool(poolId, poolName){
  if(currentUser?.role !== 'admin') return alert('Solo el admin principal puede eliminar porras')
  if(!confirm(`¿Eliminar completamente la porra "${poolName}"? Se borrarán sus participantes, chat y pronósticos.`)) return

  await supabase.from('predictions').delete().eq('pool_id', poolId)
  await supabase.from('chat_messages').delete().eq('pool_id', poolId)
  await supabase.from('pool_members').delete().eq('pool_id', poolId)
  await supabase.from('pools').delete().eq('id', poolId)

  if(currentPool?.id === poolId){
    currentPool = null
    tab = 'porras'
  }

  await loadData()
}

async function removeUserFromPool(uid,nick){if(uid===currentPool.created_by)return alert('No puedes quitar al creador');if(!confirm(`¿Quitar a ${nick}?`))return;await supabase.from('predictions').delete().eq('pool_id',currentPool.id).eq('user_id',uid);await supabase.from('pool_members').delete().eq('pool_id',currentPool.id).eq('user_id',uid);await loadData()}
async function savePrediction(mid){
  if(currentUser?.role === 'admin') return alert('El admin no puede participar ni hacer pronósticos');if(!currentPool)return alert('Selecciona porra');const m=matches.find(x=>x.id===mid);if(isLocked(m)&&currentUser.role!=='admin')return alert('Bloqueado');const ph=parseInt(document.querySelector('#ph_'+mid).value,10),pa=parseInt(document.querySelector('#pa_'+mid).value,10);if(isNaN(ph)||isNaN(pa)||ph<0||pa<0)return alert('Resultado inválido');const wants=!!document.querySelector('#joker_'+mid)?.checked;const scorer=document.querySelector('#scorer_'+mid)?.value.trim()||null;if(wants&&!currentPool.enable_joker)return alert('Joker no activo');if(wants&&jokerUsed()&&!pred(mid)?.is_joker)return alert('Ya has usado tus 5 Jokers en esta porra');const ex=pred(mid);if(ex)await supabase.from('predictions').update({pred_home:ph,pred_away:pa,is_joker:wants,scorer_prediction:scorer}).eq('id',ex.id);else await supabase.from('predictions').insert({user_id:currentUser.id,match_id:mid,pool_id:currentPool.id,pred_home:ph,pred_away:pa,is_joker:wants,scorer_prediction:scorer});alert('Guardado');await loadData()}
async function saveReal(mid){const rh=parseInt(document.querySelector('#rh_'+mid).value,10),ra=parseInt(document.querySelector('#ra_'+mid).value,10);if(isNaN(rh)||isNaN(ra)||rh<0||ra<0)return alert('Resultado inválido');const scorers=selectedRealScorers(mid);await supabase.from('matches').update({real_home:rh,real_away:ra,real_scorers:scorers}).eq('id',mid);await loadData()}
async function resetReal(mid){if(!confirm('¿Borrar resultado?'))return;await supabase.from('matches').update({real_home:null,real_away:null}).eq('id',mid);await loadData()}
async function resetAllResults(){if(!confirm('¿Borrar TODOS los resultados?'))return;await supabase.from('matches').update({real_home:null,real_away:null}).neq('id','');await loadData()}
async function deletePredictionsByMatch(mid){if(!confirm('¿Borrar pronósticos partido?'))return;await supabase.from('predictions').delete().eq('pool_id',currentPool.id).eq('match_id',mid);await loadData()}
async function deleteAllPredictions(){if(!confirm('¿Borrar pronósticos de ESTA porra?'))return;await supabase.from('predictions').delete().eq('pool_id',currentPool.id);await loadData()}
async function resetUserPredictions(uid,nick){if(!confirm(`¿Reset puntos de ${nick}?`))return;await supabase.from('predictions').delete().eq('pool_id',currentPool.id).eq('user_id',uid);await loadData()}
async function deleteUser(uid,nick){if(nick.toLowerCase()==='admin')return alert('No admin');if(!confirm(`¿Eliminar ${nick} de toda app?`))return;await supabase.from('predictions').delete().eq('user_id',uid);await supabase.from('pool_members').delete().eq('user_id',uid);await supabase.from('profiles').delete().eq('id',uid);await loadData()}
async function toggleAdmin(uid,role,nick){const mem=poolMembers.find(pm=>pm.pool_id===currentPool.id&&pm.user_id===uid);if(!mem)return;const nr=mem.role==='admin'?'user':'admin';if(!confirm(`¿Cambiar ${nick} a ${nr}?`))return;await supabase.from('pool_members').update({role:nr}).eq('id',mem.id);await loadData()}
async function saveWinnerHistory(){const season=prompt('Nombre historial:');if(!season)return;const ranked=poolUsers().filter(u=>u.role!=='admin').map(u=>({...u,...userStats(u.id)})).sort((a,b)=>b.total-a.total||b.exact-a.exact);if(!ranked.length)return;const w=ranked[0];await supabase.from('winners_history').insert({season:`${season} · ${currentPool.name}`,winner_nick:w.nick,points:w.total,exacts:w.exact,differences:w.diff,signs:w.sg});await loadData()}

function hero(){return `<div class="hero"><div><div class="kicker">🏆 MUNDIAL · APP PRIVADA</div><h1>Mi Porra,<br><span>Tu Gloria</span></h1><p>Acierta el marcador, suma puntos y presume en la clasificación.</p></div><img class="hero-art" src="/assets/hero-porra-gloria.png" alt=""><div class="ball">⚽</div></div>`}
function renderNoConfig(){app.innerHTML=`<div class="app">${hero()}<div class="card"><h2>Falta conectar Supabase</h2></div></div>`}
function loginView(){return `<div class="card"><h2>Entrar</h2><p class="muted">Primero registra un usuario.</p><label>Nick</label><input id="nick" placeholder="admin"><label>Email opcional</label><input id="email" type="email"><label>Contraseña</label><input id="password" type="password"><button id="loginBtn">Entrar</button><button id="registerBtn" class="blue">Registrarme</button><button id="recoverBtn" class="yellow">Recordar contraseña</button></div>`}
function tabs(){
  const poolLabel=currentPool?`<div class="card"><b>Porra actual:</b> ${safe(currentPool.name)} · Código: <b>${safe(currentPool.code)}</b> · Goleador: <b>${currentPool.enable_scorer?'Sí':'No'}</b>${currentPool.prizes?`<br><br><b>🏆 Premios:</b><br>${safe(currentPool.prizes).replace(/\n/g,'<br>')}`:''}</div>`:''

  const adminTabs = `
    <div class="tabs">
      <button onclick="window.setTab('porras')">Todas las porras</button>
      <button class="yellow" onclick="window.setTab('resultados')">Resultados globales</button>
      <button class="blue" onclick="window.setTab('archivo')">Archivo</button>
      <button class="blue" onclick="window.setTab('historial')">Historial</button>
      ${currentPool?`<button class="blue" onclick="window.setTab('clasificacion')">Clasificación</button><button class="blue" onclick="window.setTab('estadisticas')">Estadísticas</button><button class="blue" onclick="window.setTab('chat')">Chat</button><button class="yellow" onclick="window.setTab('admin')">Admin porra</button>`:''}
      <button class="red" onclick="window.logout()">Salir</button>
    </div>
  `

  const userTabs = `
    <div class="tabs">
      <button onclick="window.setTab('porras')">Mis porras</button>
      <button onclick="window.setTab('partidos')">Partidos</button>
      <button class="blue" onclick="window.setTab('normas')">Normas</button>
      <button class="blue" onclick="window.setTab('clasificacion')">Clasificación</button>
      <button class="blue" onclick="window.setTab('estadisticas')">Estadísticas</button>
      <button class="blue" onclick="window.setTab('chat')">Chat</button>
      <button class="blue" onclick="window.setTab('historial')">Historial</button>
      <button class="blue" onclick="window.setTab('archivo')">Archivo</button>
      <button class="red" onclick="window.logout()">Salir</button>
    </div>
  `

  return `
    ${currentUser?.role === 'admin' ? adminTabs : userTabs}
    <div class="card">
      <h2>${avatar(currentUser)} Hola, ${safe(currentUser.nick)}</h2>
      <p>${currentUser?.role === 'admin' ? 'Modo administrador: puedes poner resultados globales, controlar porras y revisar usuarios. No participas en la clasificación.' : 'El Mundial pasa cada cuatro años; las bromas al último de la porra duran mucho más.'}</p>
      <button class="small blue" onclick="window.saveProfile()">Editar avatar</button>
    </div>
    ${poolLabel}
  `
}

function poolsView(){
  const isAdmin = currentUser?.role === 'admin'
  const myIds=poolMembers.filter(pm=>pm.user_id===currentUser.id).map(pm=>pm.pool_id)
  const visiblePools = isAdmin ? pools : pools.filter(p=>myIds.includes(p.id))

  return `
    <div class="card">
      <h2>🏆 ${isAdmin ? 'Todas las porras privadas' : 'Mis porras privadas'}</h2>
      <p class="muted">${isAdmin ? 'Como admin principal puedes controlar cualquier porra, pero no participas como jugador.' : 'Para jugar debes crear una porra privada o unirte a una existente con código.'}</p>

      ${!isAdmin ? `
      <div style="margin-bottom:18px">
        <button onclick="window.createPool()">➕ Crear porra privada</button>
        <button class="blue" onclick="window.joinPool()">🔑 Unirme con código</button>
      </div>` : ''}

      ${visiblePools.length===0?'<p class="muted">Todavía no hay porras.</p>':visiblePools.map(p=>{
        const count = poolMembers.filter(pm=>pm.pool_id===p.id).length
        const amMember = myIds.includes(p.id)
        return `
          <div class="match">
            <h3>${safe(p.name)}</h3>
            <p class="muted">Código: <b>${safe(p.code)}</b> · Participantes: <b>${count}</b> · Joker: <b>${p.enable_joker?'Sí':'No'}</b> · Goleador: <b>${p.enable_scorer?'Sí':'No'}</b>${p.prizes?`<br>🏆 Premios:<br>${safe(p.prizes).replace(/\n/g,'<br>')}`:''}</p>
            <button onclick="window.selectPool('${p.id}')">${isAdmin ? 'Administrar esta porra' : 'Entrar en esta porra'}</button>
            ${!isAdmin && amMember ? `<button class="red" onclick="window.leavePool('${p.id}','${safe(p.name)}')">Salir de esta porra</button>` : ''}
            ${isAdmin ? `<button class="red" onclick="window.deletePool('${p.id}','${safe(p.name)}')">Eliminar porra</button>` : ''}
          </div>
        `
      }).join('')}
    </div>
  `
}

function matchPoolPredictions(matchId){
  if(!currentPool) return ''

  const rows = poolUsers()
    .filter(u => u.role !== 'admin')
    .map(u => {
      const p = poolPredictions().find(pr => pr.user_id === u.id && pr.match_id === matchId)
      return { user:u, prediction:p }
    })

  if(!rows.length){
    return '<div class="joker-box"><p class="muted">Todavía no hay participantes en esta porra.</p></div>'
  }

  return `
    <div class="joker-box">
      <h3>👀 Pronósticos de este partido</h3>
      <p class="muted">Se muestran porque el partido ya ha comenzado.</p>

      ${rows.map(r => `
        <div class="ranking">
          <div>${avatar(r.user)}</div>
          <div>
            ${safe(r.user.nick)}
            ${r.prediction?.is_joker ? '<br><span class="badge-gold">🃏 Joker</span>' : ''}${r.prediction?.scorer_prediction ? `<br><span class="badge">⚽ ${safe(r.prediction.scorer_prediction)}</span>` : ''}
          </div>
          <div>
            ${
              r.prediction
                ? `<b>${r.prediction.pred_home} - ${r.prediction.pred_away}</b>`
                : '<span class="muted">Sin pronóstico</span>'
            }
          </div>
        </div>
      `).join('')}
    </div>
  `
}

function matchesView(){
  if(currentUser?.role === 'admin') {
    return `<div class="card"><h2>Modo administrador</h2><p>El usuario admin no participa en la porra. Entra en <b>Admin</b> o <b>Resultados globales</b> para poner resultados oficiales, ver usuarios y revisar clasificaciones.</p><button class="yellow" onclick="window.setTab('resultados')">Ir a resultados globales</button></div>`
  }

  if(!currentPool) return poolsView()

  return `
    <div class="card"><h2>Mis pronósticos</h2>
      ${currentPool.enable_joker?`<div class="joker-box"><b>🃏 Joker activado:</b> tienes 5 Jokers para usar en esta porra. Cada partido Joker puntúa doble. Te quedan ${jokerLimit()-jokerCount()}.</div>`:''}

      ${activeMatches().map(m=>{
        const p=pred(m.id)
        const pt=p?pointsForPrediction(p,m):null
        const locked=isLocked(m)
        const hasSaved=!!p
        const editing=!!editingPredictions?.[m.id]

        const fieldsLocked = locked || (hasSaved && !editing)
        const jokerDisabled = fieldsLocked || !currentPool.enable_joker || (jokerUsed() && !p?.is_joker)

        return `
          <div class="match">
            <span class="group">${safe(m.group_name)}</span>
            <div class="teams">${teamName(m.home_team)} vs ${teamName(m.away_team)}</div>
            <div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div>

            <p>
              <span class="badge ${locked?'closed':''}">${locked?'🔒 Partido iniciado':'Abierto'}</span>
              <span class="badge">${hasSaved && !editing ? '🔐 Pronóstico guardado' : 'Editable'}</span>
              <span class="badge">${pt===null?'Pendiente':pt+' pts'}</span>
              ${p?.is_joker?'<span class="badge-gold">🃏 Joker</span>':''}
            </p>

            <div class="score">
              <div>
                <label>${teamName(m.home_team)}</label>
                <input ${fieldsLocked?'disabled':''} type="number" min="0" id="ph_${m.id}" value="${p?.pred_home??''}">
              </div>

              <div style="font-weight:900;padding-bottom:17px">-</div>

              <div>
                <label>${teamName(m.away_team)}</label>
                <input ${fieldsLocked?'disabled':''} type="number" min="0" id="pa_${m.id}" value="${p?.pred_away??''}">
              </div>
            </div>

            ${currentPool.enable_joker?`<label style="display:block;margin:10px 0"><input type="checkbox" id="joker_${m.id}" ${p?.is_joker?'checked':''} ${jokerDisabled?'disabled':''}> 🃏 Usar Joker en este partido</label>`:''}${scorerSelectHtml(m,p,fieldsLocked)}

            ${
              locked
                ? `<p class="muted"><b>Partido iniciado:</b> ya no se puede modificar el pronóstico.</p>`
                : hasSaved && !editing
                  ? `<button class="small blue" onclick="window.editPrediction('${m.id}')">Editar pronóstico</button><span class="muted"> Puedes editarlo hasta que empiece el partido.</span>`
                  : `<button class="small" onclick="window.savePrediction('${m.id}')">Guardar pronóstico</button>`
            }

            <span class="muted"> Resultado real: <b>${m.real_home===null?'Pendiente':m.real_home+' - '+m.real_away}</b></span>

            ${locked ? matchPoolPredictions(m.id) : ''}
          </div>
        `
      }).join('')}
    </div>
  `
}

function globalResultsView(){
  if(currentUser?.role!=='admin')return `<div class="card"><h2>Acceso no permitido</h2></div>`;
  const list=activeMatches();
  const pending=list.filter(m=>m.real_home===null||m.real_away===null);
  const resolved=list.filter(m=>m.real_home!==null&&m.real_away!==null);
  const renderMatch=(m)=>`
    <div class="adminrow">
      <b>${safe(m.group_name)} · ${teamName(m.home_team)} vs ${teamName(m.away_team)}</b>
      <div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div>
      <div class="score">
        <div><label>${teamName(m.home_team)}</label><input type="number" min="0" id="grh_${m.id}" value="${m.real_home??''}"></div>
        <div style="font-weight:900;padding-bottom:17px">-</div>
        <div><label>${teamName(m.away_team)}</label><input type="number" min="0" id="gra_${m.id}" value="${m.real_away??''}"></div>
      </div>
      ${realScorersHtml(m)}<button class="small" onclick="window.saveGlobalReal('${m.id}')">Guardar resultado global</button>
      <button class="small red" onclick="window.resetGlobalReal('${m.id}')">Reset resultado</button>
      <p class="muted">Este resultado se aplica a TODAS las porras.</p>
    </div>`;
  return `
    <div class="card">
      <h2>⚽ Resultados globales</h2>
      <p class="muted">Aquí pones los resultados una sola vez. Valen para todas las porras y todas las clasificaciones.</p>
      <h3>🔴 Pendientes (${pending.length})</h3>
      ${pending.length?pending.map(renderMatch).join(''):'<p class="muted">No hay pendientes.</p>'}
      <h3>🟢 Resueltos recientes (${resolved.length})</h3>
      ${resolved.length?resolved.map(renderMatch).join(''):'<p class="muted">No hay resueltos recientes.</p>'}
      <p class="muted">Los partidos con más de 7 días pasan automáticamente al Archivo.</p>
    </div>`;
}

async function saveGlobalReal(mid){
  if(currentUser?.role!=='admin')return alert('Solo el admin puede guardar resultados');
  const rh=parseInt(document.querySelector('#grh_'+mid).value,10);
  const ra=parseInt(document.querySelector('#gra_'+mid).value,10);
  if(isNaN(rh)||isNaN(ra)||rh<0||ra<0)return alert('Pon resultado válido');
  const scorers=selectedRealScorers(mid);
  await supabase.from('matches').update({real_home:rh,real_away:ra,real_scorers:scorers}).eq('id',mid);
  await loadData();
  alert('Resultado guardado para todas las porras');
}

async function resetGlobalReal(mid){
  if(currentUser?.role!=='admin')return alert('Solo el admin puede reiniciar resultados');
  if(!confirm('¿Borrar este resultado global? Afectará a todas las porras.'))return;
  await supabase.from('matches').update({real_home:null,real_away:null}).eq('id',mid);
  await loadData();
}

function rulesView(){
  const jokerText = currentPool?.enable_joker
    ? '<b>Joker activado:</b> cada jugador puede elegir hasta 5 partidos Joker. Cada usuario tiene 5 Jokers por porra. Cada partido marcado como Joker puntúa doble: exacto 10, diferencia 6, signo 4 y fallo 0.'
    : '<b>Joker desactivado:</b> en esta porra no se usa Joker.'

  const prizesText = currentPool?.prizes
    ? safe(currentPool.prizes).replace(/\n/g,'<br>')
    : 'Esta porra no tiene premios escritos.'

  return `
    <div class="card">
      <h2>📖 Normas</h2>
      <div class="rule"><h3>🎯 Exacto: 5 puntos</h3></div>
      <div class="rule"><h3>⚽ Diferencia correcta: 3 puntos</h3></div>
      <div class="rule"><h3>✅ Signo 1/X/2: 2 puntos</h3></div>
      <div class="rule"><h3>❌ Fallo: 0 puntos</h3></div><div class="rule"><h3>⚽ Goleador del partido</h3><p>Si está activado, cada usuario puede poner un goleador por partido. Si el jugador marca y el admin lo añade como goleador real, suma +2 puntos.</p></div>
      <div class="rule"><h3>🃏 Joker</h3><p>${jokerText}</p></div>
      <div class="rule"><h3>🏆 Premios</h3><p>${prizesText}</p></div>
      <div class="rule"><h3>🔒 Bloqueo</h3><p>Al comenzar el partido ya no se puede cambiar el pronóstico. En ese momento se muestran automáticamente los pronósticos de todos los integrantes de la porra para ese partido.</p></div>
      <div class="rule"><h3>💬 Frase oficial</h3><p>El Mundial pasa cada cuatro años; las bromas al último de la porra duran mucho más.</p></div>
    </div>
  `
}
function rankingView(){if(!currentPool)return poolsView();const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({...u,...userStats(u.id)})).sort((a,b)=>b.total-a.total||b.exact-a.exact),all=rows;return `<div class="card"><h2>Clasificación · ${safe(currentPool.name)}</h2>${rows.map((r,i)=>`<div class="ranking"><div>${i===0?'🥇':i===1?'🥈':i===2?'🥉':i+1}</div><div>${avatar(r)} ${safe(r.nick)}<br><span class="muted">Jugados: ${r.played} · Exactos: ${r.exact} · Dif: ${r.diff} · Signos: ${r.sg} · ${r.percent}% · Joker: ${r.jokers} · Goleadores: ${r.scorersOk||0}</span><br>${badgeForUser(r,all)}</div><div>${r.total} pts</div></div>`).join('')}</div>`}
function statsView(){if(!currentPool)return poolsView();const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({...u,...userStats(u.id)}));return `<div class="card"><h2>📊 Estadísticas</h2><div class="pro-grid"><div class="pro-stat"><h3>${poolUsers().filter(u=>u.role!=='admin').length}</h3><p>Participantes</p></div><div class="pro-stat"><h3>${matches.length}</h3><p>Partidos</p></div><div class="pro-stat"><h3>${poolPredictions().length}</h3><p>Pronósticos</p></div><div class="pro-stat"><h3>${rows.reduce((s,r)=>s+r.exact,0)}</h3><p>Exactos</p></div><div class="pro-stat"><h3>${rows.reduce((s,r)=>s+r.jokers,0)}</h3><p>Jokers usados</p></div></div></div>`}
function chatView(){if(!currentPool)return poolsView();return `<div class="card"><h2>💬 Chat</h2>${poolChat().map(msg=>{const u=users.find(x=>x.id===msg.user_id);return `<div class="chat-message"><b>${avatar(u)} ${safe(u?.nick||'Usuario')}</b><br>${safe(msg.message)}<br><span class="muted">${new Date(msg.created_at).toLocaleString('es-ES')}</span> ${canAdminPool()?`<button class="small red" onclick="deleteChatMessage('${msg.id}')">Borrar</button>`:''}</div>`}).join('')}<input id="chatInput" placeholder="Escribe un mensaje..."><button onclick="sendChatMessage()">Enviar</button></div>`}
function historyView(){return `<div class="card"><h2>🏆 Historial</h2>${winners.length?winners.map(w=>`<div class="ranking"><div>🏆</div><div>${safe(w.winner_nick)}<br><span class="muted">${safe(w.season)}</span></div><div>${w.points} pts</div></div>`).join(''):'<p class="muted">Sin ganadores guardados.</p>'}</div>`}
function adminView(){if(!currentPool)return poolsView();const members=poolUsers().filter(u=>u.role!=='admin');return `<div class="card"><h2>Admin · ${safe(currentPool.name)}</h2><div style="margin-bottom:20px"><button class="small blue" onclick="copyPoolInvite()">📲 Copiar invitación</button><button class="small yellow" onclick="updatePoolSettings()">⚙️ Joker/Premios</button><button class="small yellow" onclick="togglePoolJoker()">🃏 Joker: ${currentPool.enable_joker?'Activado':'Desactivado'}</button><button class="small yellow" onclick="saveWinnerHistory()">🏆 Guardar ganador</button><button class="small red" onclick="resetAllResults()">🔄 Reiniciar resultados</button><button class="small red" onclick="deleteAllPredictions()">🗑️ Borrar pronósticos</button></div><h3>Usuarios</h3>${members.map(u=>{const s=userStats(u.id),mem=poolMembers.find(pm=>pm.pool_id===currentPool.id&&pm.user_id===u.id);return `<div class="ranking"><div>${mem?.role==='admin'?'👑':'👤'}</div><div>${avatar(u)} ${safe(u.nick)}<br><span class="muted">${mem?.role||'user'} · ${s.total} pts</span></div><div><button class="small yellow" onclick="toggleAdmin('${u.id}','${mem?.role||'user'}','${safe(u.nick)}')">${mem?.role==='admin'?'Quitar admin':'Hacer admin'}</button><button class="small red" onclick="resetUserPredictions('${u.id}','${safe(u.nick)}')">Reset</button>${u.id!==currentUser.id?`<button class="small red" onclick="removeUserFromPool('${u.id}','${safe(u.nick)}')">Quitar</button>`:''}${currentUser.role==='admin'&&u.nick.toLowerCase()!=='admin'?`<button class="small red" onclick="deleteUser('${u.id}','${safe(u.nick)}')">Eliminar app</button>`:''}</div></div>`}).join('')}<h3>Resultados</h3>${matches.map(m=>`<div class="adminrow"><b>${safe(m.group_name)} · ${teamName(m.home_team)} vs ${teamName(m.away_team)}</b><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><div class="score"><div><label>${teamName(m.home_team)}</label><input type="number" min="0" id="rh_${m.id}" value="${m.real_home??''}"></div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label><input type="number" min="0" id="ra_${m.id}" value="${m.real_away??''}"></div></div><label>Goleadores reales separados por coma</label><input id="real_scorers_admin_${m.id}" value="${safe(m.real_scorers||'')}" placeholder="Ejemplo: Mbappé, Griezmann"><button class="small" onclick="saveReal('${m.id}')">Guardar resultado</button><button class="small red" onclick="resetReal('${m.id}')">Reset resultado</button><button class="small red" onclick="deletePredictionsByMatch('${m.id}')">Borrar pronósticos partido</button></div>`).join('')}</div>`}
function archiveView(){
  const list=archivedMatches();
  if(!list.length)return `<div class="card"><h2>📦 Archivo</h2><p class="muted">Todavía no hay partidos archivados. Se archivarán automáticamente cuando hayan pasado más de 7 días desde el partido.</p></div>`;
  return `
    <div class="card">
      <h2>📦 Archivo de partidos</h2>
      <p class="muted">Aquí puedes consultar partidos antiguos, resultados, puntos y pronósticos.</p>
      ${list.map(m=>{
        const p=currentUser?.role==='admin'?null:pred(m.id);
        const pt=p?pointsForPrediction(p,m):null;
        return `
          <div class="match">
            <span class="group">${safe(m.group_name)}</span>
            <div class="teams">${teamName(m.home_team)} vs ${teamName(m.away_team)}</div>
            <div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div>
            <p>Resultado real: <b>${m.real_home===null?'Pendiente':m.real_home+' - '+m.real_away}</b></p>
            ${currentUser?.role!=='admin'?`<p>Tu pronóstico: <b>${p?p.pred_home+' - '+p.pred_away:'Sin pronóstico'}</b> ${p?.is_joker?'<span class="badge-gold">🃏 Joker</span>':''} · Puntos: <b>${pt===null?'Pendiente':pt}</b></p>`:''}
            ${currentPool?matchPoolPredictions(m.id):''}
          </div>`;
      }).join('')}
    </div>`;
}

function render(){if(!supabaseReady)return renderNoConfig();app.innerHTML=`<div class="app">${hero()}${!currentUser?loginView():tabs()+(tab==='porras'?poolsView():tab==='partidos'?matchesView():tab==='normas'?rulesView():tab==='resultados'?globalResultsView():tab==='clasificacion'?rankingView():tab==='estadisticas'?statsView():tab==='chat'?chatView():tab==='historial'?historyView():tab==='archivo'?archiveView():adminView())}</div>`;if(!currentUser){document.querySelector('#loginBtn').onclick=login;document.querySelector('#registerBtn').onclick=register;document.querySelector('#recoverBtn').onclick=recoverPassword}}
Object.assign(window,{setTab,logout,saveProfile,selectPool,createPool,joinPool,copyPoolInvite,togglePoolJoker,sendChatMessage,deleteChatMessage,removeUserFromPool,savePrediction,saveReal,resetReal,resetAllResults,deletePredictionsByMatch,deleteAllPredictions,deleteUser,resetUserPredictions,toggleAdmin,saveWinnerHistory,editPrediction,leavePool,updatePoolSettings,saveGlobalReal,resetGlobalReal})
document.title='MI PORRA'
restoreSession().then(ok=>{if(!ok)loadData()})

window.deletePool=deletePool
