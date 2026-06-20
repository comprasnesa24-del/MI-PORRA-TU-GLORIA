import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseReady = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = supabaseReady ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
const app = document.querySelector('#app')
const SESSION_KEY='mi_porra_session_clean_v1'
const CHAT_READ_KEY='mi_porra_chat_read_v1'

let currentUser=null,currentPool=null,tab='porras'
let users=[],pools=[],poolMembers=[],matches=[],predictions=[],messages=[],teamPlayers=[]
let messagesLoadError=''
const ADMIN_NICK='admin', ADMIN_PASSWORD='968085070'

function safe(v){return String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function avatar(u){return `<span style="display:inline-block;width:28px;height:28px;text-align:center;line-height:28px;background:#dcfce7;border-radius:6px;margin-right:8px">${safe(u?.avatar||'⚽')}</span>`}
function generateCode(){return Math.random().toString(36).substring(2,8).toUpperCase()}
function sign(a,b){return a>b?1:a<b?2:'X'}
function scoreEq(p,r){p=Number(p);r=Number(r);return p===r||(p>=9&&r>=9)}
function basePoints(ph,pa,rh,ra){if(rh==null||ra==null)return null;ph=Number(ph);pa=Number(pa);rh=Number(rh);ra=Number(ra);if(scoreEq(ph,rh)&&scoreEq(pa,ra))return 5;if((ph-pa)===(rh-ra))return 3;if(sign(ph,pa)===sign(rh,ra))return 2;return 0}
function normalizeScorer(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9ñ ]/g,'').replace(/\s+/g,' ').trim()}
function scorerPoints(p,m){if(!currentPool?.enable_scorer)return 0;if(Number(m?.real_home)===0&&Number(m?.real_away)===0&&!p?.scorer_prediction)return 2;if(!p?.scorer_prediction||!m?.real_scorers)return 0;const pick=normalizeScorer(p.scorer_prediction);const scorers=String(m.real_scorers).split(',').map(x=>normalizeScorer(x)).filter(Boolean);return scorers.includes(pick)?2:0}
function mvpPoints(p,m){if(!currentPool?.enable_mvp||!p?.mvp_prediction||!m?.real_mvp)return 0;return normalizeScorer(p.mvp_prediction)===normalizeScorer(m.real_mvp)?2:0}
function sentOffPoints(p,m){if(!currentPool?.enable_sent_off||!p?.sent_off_prediction||!m?.real_sent_off)return 0;return normalizeScorer(p.sent_off_prediction)===normalizeScorer(m.real_sent_off)?2:0}
function pointsForPrediction(p,m){const b=basePoints(p.pred_home,p.pred_away,m.real_home,m.real_away);return b==null?null:(p.is_joker?b*2:b)+scorerPoints(p,m)+mvpPoints(p,m)+sentOffPoints(p,m)}
function isLocked(m){return new Date(m.match_date).getTime()<=Date.now()}
function isArchivedMatch(m){return m.real_home!==null&&m.real_away!==null}
function activeMatches(){return matches.filter(m=>!isArchivedMatch(m))}
function resultSortTime(m){return new Date(m.result_updated_at||m.match_date).getTime()}
function archivedMatches(){return matches.filter(m=>isArchivedMatch(m)).sort((a,b)=>resultSortTime(b)-resultSortTime(a))}
function currentPoolMemberIds(){return currentPool?poolMembers.filter(pm=>pm.pool_id===currentPool.id).map(pm=>pm.user_id):[]}
function poolUsers(){const ids=currentPoolMemberIds();return users.filter(u=>ids.includes(u.id))}
function poolPredictions(){if(!currentPool)return[];const ids=currentPoolMemberIds();return predictions.filter(p=>p.pool_id===currentPool.id&&ids.includes(p.user_id))}
function pred(mid){return poolPredictions().find(p=>p.user_id===currentUser?.id&&String(p.match_id)===String(mid))}
function jokerCount(){return currentUser&&currentPool?poolPredictions().filter(p=>p.user_id===currentUser.id&&p.is_joker).length:0}
function jokerLimit(){return 5}
function jokerUsed(){return jokerCount()>=jokerLimit()}
function myMembership(){return currentUser&&currentPool?poolMembers.find(pm=>pm.user_id===currentUser.id&&pm.pool_id===currentPool.id):null}
function canAdminPool(){return currentUser?.role==='admin'}
function saveSession(){try{localStorage.setItem(SESSION_KEY,JSON.stringify({userId:currentUser?.id||null,poolId:currentPool?.id||null}))}catch(e){}}
function clearSession(){try{localStorage.removeItem(SESSION_KEY)}catch(e){}}
function teamName(v){return safe(v)}
function messageText(m){return m?.body??m?.content??m?.message??m?.text??''}
function chatReadKey(){return currentUser&&currentPool?CHAT_READ_KEY+'_'+currentUser.id+'_'+currentPool.id:null}
function chatLastRead(){try{const k=chatReadKey();return k?Number(localStorage.getItem(k)||0):0}catch(e){return 0}}
function latestChatMessageTime(){if(!currentPool)return 0;return messages.filter(m=>String(m.pool_id)===String(currentPool.id)&&String(m.user_id)!==String(currentUser?.id)).reduce((max,m)=>Math.max(max,new Date(m.created_at||0).getTime()||0),0)}
function hasUnreadChat(){return latestChatMessageTime()>chatLastRead()}
function markChatRead(){try{const k=chatReadKey();if(k)localStorage.setItem(k,String(Date.now()))}catch(e){}}


function normTeam(v){return String(v||'').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9 ]/g,'').replace(/\s+/g,' ').trim()}
const MATCH_TEAM_CODES={
"alemania":"GER","curazao":"CUW","costa de marfil":"CIV","arabia saudi":"KSA","arabia saudí":"KSA",
"uruguay":"URU","argelia":"ALG","austria":"AUT","argentina":"ARG","australia":"AUS",
"turquia":"TUR","turquía":"TUR","jordania":"JOR","belgica":"BEL","bélgica":"BEL",
"egipto":"EGY","iran":"IRN","irán":"IRN","bosnia y herzegovina":"BIH","catar":"QAT",
"brasil":"BRA","marruecos":"MAR","haiti":"HAI","haití":"HAI","cabo verde":"CPV",
"canada":"CAN","canadá":"CAN","suiza":"SUI","colombia":"COL","rd congo":"COD",
"corea del sur":"KOR","republica checa":"CZE","república checa":"CZE","croacia":"CRO",
"ecuador":"ECU","escocia":"SCO","espana":"ESP","españa":"ESP","estados unidos":"USA",
"francia":"FRA","ghana":"GHA","inglaterra":"ENG","irak":"IRQ","japon":"JPN","japón":"JPN",
"mexico":"MEX","méxico":"MEX","noruega":"NOR","nueva zelanda":"NZL","paises bajos":"NED",
"países bajos":"NED","panama":"PAN","panamá":"PAN","paraguay":"PAR","portugal":"POR",
"senegal":"SEN","sudafrica":"RSA","sudáfrica":"RSA","suecia":"SWE","tunez":"TUN",
"túnez":"TUN","uzbekistan":"UZB","uzbekistán":"UZB"
}

const TEAM_ALIASES={
"alemania":"GER","germany":"GER","ger":"GER",
"curazao":"CUW","curaçao":"CUW","curacao":"CUW","cuw":"CUW",
"costa de marfil":"CIV","côte d'ivoire":"CIV","côte divoire":"CIV","cote divoire":"CIV","ivory coast":"CIV","civ":"CIV",
"arabia saudi":"KSA","arabia saudí":"KSA","saudi arabia":"KSA","ksa":"KSA",
"uruguay":"URU","uru":"URU",
"argelia":"ALG","algeria":"ALG","alg":"ALG",
"austria":"AUT","aut":"AUT",
"argentina":"ARG","arg":"ARG",
"australia":"AUS","aus":"AUS",
"turquia":"TUR","turquía":"TUR","turkey":"TUR","türkiye":"TUR","turkiye":"TUR","tur":"TUR",
"jordania":"JOR","jordan":"JOR","jor":"JOR",
"belgica":"BEL","bélgica":"BEL","belgium":"BEL","bel":"BEL",
"egipto":"EGY","egypt":"EGY","egy":"EGY",
"iran":"IRN","irán":"IRN","ir iran":"IRN","irn":"IRN",
"bosnia y herzegovina":"BIH","bosnia and herzegovina":"BIH","bosnia":"BIH","bih":"BIH",
"catar":"QAT","qatar":"QAT","qat":"QAT",
"brasil":"BRA","brazil":"BRA","bra":"BRA",
"marruecos":"MAR","morocco":"MAR","mar":"MAR",
"haiti":"HAI","haití":"HAI","hai":"HAI",
"cabo verde":"CPV","cape verde":"CPV","cpv":"CPV",
"canada":"CAN","canadá":"CAN","can":"CAN",
"suiza":"SUI","switzerland":"SUI","sui":"SUI",
"colombia":"COL","col":"COL",
"rd congo":"COD","r.d. congo":"COD","r d congo":"COD","congo dr":"COD","dr congo":"COD","congo":"COD","republica democratica del congo":"COD","república democrática del congo":"COD","cod":"COD",
"corea del sur":"KOR","korea republic":"KOR","south korea":"KOR","republica de corea":"KOR","república de corea":"KOR","kor":"KOR",
"republica checa":"CZE","república checa":"CZE","chequia":"CZE","czechia":"CZE","czech republic":"CZE","cze":"CZE",
"croacia":"CRO","croatia":"CRO","cro":"CRO",
"ecuador":"ECU","ecu":"ECU",
"escocia":"SCO","scotland":"SCO","sco":"SCO",
"espana":"ESP","españa":"ESP","spain":"ESP","esp":"ESP",
"estados unidos":"USA","eeuu":"USA","ee uu":"USA","united states":"USA","united states of america":"USA","usa":"USA",
"francia":"FRA","france":"FRA","fra":"FRA",
"ghana":"GHA","gha":"GHA",
"inglaterra":"ENG","england":"ENG","eng":"ENG",
"irak":"IRQ","iraq":"IRQ","irq":"IRQ",
"japon":"JPN","japón":"JPN","japan":"JPN","jpn":"JPN",
"mexico":"MEX","méxico":"MEX","mex":"MEX",
"noruega":"NOR","norway":"NOR","nor":"NOR",
"nueva zelanda":"NZL","new zealand":"NZL","nzl":"NZL",
"paises bajos":"NED","países bajos":"NED","holanda":"NED","netherlands":"NED","ned":"NED",
"panama":"PAN","panamá":"PAN","pan":"PAN",
"paraguay":"PAR","par":"PAR",
"portugal":"POR","por":"POR",
"senegal":"SEN","sen":"SEN",
"sudafrica":"RSA","sudáfrica":"RSA","south africa":"RSA","rsa":"RSA",
"suecia":"SWE","sweden":"SWE","swe":"SWE",
"tunez":"TUN","túnez":"TUN","tunisia":"TUN","tun":"TUN",
"uzbekistan":"UZB","uzbekistán":"UZB","uzb":"UZB"
}
function teamCodeForName(name){
  const n=normTeam(name)

  // Primero busca directamente contra team_players, por si hemos cambiado team_name a español en Supabase.
  const direct=teamPlayers.find(p=>normTeam(p.team_name)===n || normTeam(p.team_code)===n)
  if(direct?.team_code)return direct.team_code

  // Luego usa alias español/inglés.
  if(TEAM_ALIASES[n])return TEAM_ALIASES[n]

  // Último intento: coincidencia parcial segura.
  const partial=teamPlayers.find(p=>{
    const tn=normTeam(p.team_name)
    return tn && (tn.includes(n) || n.includes(tn))
  })
  return partial?.team_code||null
}

function playersForMatch(m){
  const h=teamCodeForName(m.home_team)
  const a=teamCodeForName(m.away_team)
  const codes=[h,a].filter(Boolean)

  if(!codes.length)return []

  const seen=new Set()
  return teamPlayers
    .filter(p=>codes.includes(p.team_code))
    .filter(p=>{
      const k=p.team_code+'_'+p.player_name
      if(seen.has(k))return false
      seen.add(k)
      return true
    })
    .sort((x,y)=>(x.team_code+x.position+x.player_name).localeCompare(y.team_code+y.position+y.player_name))
}

function scorerSelectHtml(m,p,disabled){if(!currentPool?.enable_scorer)return'';const list=playersForMatch(m);if(!list.length)return `<label style="display:block;margin:10px 0">⚽ Pon un goleador del partido (+2 puntos)</label><input ${disabled?'disabled':''} id="scorer_${m.id}" value="${safe(p?.scorer_prediction||'')}" placeholder="Ejemplo: Messi"><p class="muted">No hay desplegable. Código local: ${teamCodeForName(m.home_team)||'NO'} · Código visitante: ${teamCodeForName(m.away_team)||'NO'} · Jugadores cargados: ${teamPlayers.length}</p>`;return `<label style="display:block;margin:10px 0">⚽ Goleador del partido (+2 puntos)</label><select id="scorer_${m.id}" ${disabled?'disabled':''} style="width:100%;font-size:18px;padding:15px;border:2px solid #dbe3ef;border-radius:17px"><option value="">Sin goleador</option>${list.map(pl=>`<option value="${safe(pl.player_name)}" ${p?.scorer_prediction===pl.player_name?'selected':''}>${safe(pl.team_code)} · ${safe(pl.player_name)} ${pl.position==='PO'?'(portero)':''}</option>`).join('')}</select>`}
function mvpSelectHtml(m,p,disabled){if(!currentPool?.enable_mvp)return'';const list=playersForMatch(m);if(!list.length)return `<label style="display:block;margin:10px 0">⭐ MVP del partido (+2 puntos)</label><input ${disabled?'disabled':''} id="mvp_${m.id}" value="${safe(p?.mvp_prediction||'')}" placeholder="Ejemplo: Messi">`;return `<label style="display:block;margin:10px 0">⭐ MVP del partido (+2 puntos)</label><select id="mvp_${m.id}" ${disabled?'disabled':''} style="width:100%;font-size:18px;padding:15px;border:2px solid #dbe3ef;border-radius:17px"><option value="">Sin MVP</option>${list.map(pl=>`<option value="${safe(pl.player_name)}" ${p?.mvp_prediction===pl.player_name?'selected':''}>${safe(pl.team_code)} · ${safe(pl.player_name)}</option>`).join('')}</select>`}
function sentOffSelectHtml(m,p,disabled){if(!currentPool?.enable_sent_off)return'';const list=playersForMatch(m);if(!list.length)return `<label style="display:block;margin:10px 0">🟥 Posible expulsión (+2 puntos)</label><input ${disabled?'disabled':''} id="sent_off_${m.id}" value="${safe(p?.sent_off_prediction||'')}" placeholder="Opcional: jugador expulsado">`;return `<label style="display:block;margin:10px 0">🟥 Posible expulsión (+2 puntos)</label><select id="sent_off_${m.id}" ${disabled?'disabled':''} style="width:100%;font-size:18px;padding:15px;border:2px solid #dbe3ef;border-radius:17px"><option value="" ${!p?.sent_off_prediction?'selected':''}>Sin apuesta de expulsión</option>${list.map(pl=>`<option value="${safe(pl.player_name)}" ${p?.sent_off_prediction===pl.player_name?'selected':''}>${safe(pl.team_code)} · ${safe(pl.player_name)}</option>`).join('')}</select>`}
function realScorersHtml(m){const list=playersForMatch(m);if(!list.length)return `<label>Goleadores reales separados por coma</label><input id="real_scorers_${m.id}" value="${safe(m.real_scorers||'')}" placeholder="Ejemplo: Messi, J. ALVAREZ">`;const current=String(m.real_scorers||'').split(',').map(x=>normalizeScorer(x));return `<label>Goleadores reales</label><select id="real_scorers_${m.id}" multiple size="6" style="width:100%;font-size:16px;padding:12px;border:2px solid #dbe3ef;border-radius:17px">${list.map(pl=>`<option value="${safe(pl.player_name)}" ${current.includes(normalizeScorer(pl.player_name))?'selected':''}>${safe(pl.team_code)} · ${safe(pl.player_name)}</option>`).join('')}</select><p class="muted">Mantén Ctrl pulsado para seleccionar varios goleadores.</p>`}
function selectedRealScorers(mid){const sel=document.querySelector('#real_scorers_'+mid);if(!sel)return'';return sel.tagName==='SELECT'?Array.from(sel.selectedOptions).map(o=>o.value).join(','):(sel.value||'')}
function realMvpHtml(m){const list=playersForMatch(m);if(!list.length)return `<label>MVP real</label><input id="real_mvp_${m.id}" value="${safe(m.real_mvp||'')}" placeholder="Ejemplo: Messi">`;return `<label>MVP real</label><select id="real_mvp_${m.id}" style="width:100%;font-size:16px;padding:12px;border:2px solid #dbe3ef;border-radius:17px"><option value="">Sin MVP</option>${list.map(pl=>`<option value="${safe(pl.player_name)}" ${normalizeScorer(m.real_mvp)===normalizeScorer(pl.player_name)?'selected':''}>${safe(pl.team_code)} · ${safe(pl.player_name)}</option>`).join('')}</select>`}
function selectedRealMvp(mid){return document.querySelector('#real_mvp_'+mid)?.value||''}
function realSentOffHtml(m){const list=playersForMatch(m);if(!list.length)return `<label>Expulsión real</label><input id="real_sent_off_${m.id}" value="${safe(m.real_sent_off||'')}" placeholder="Vacío si no hubo expulsión">`;return `<label>Expulsión real</label><select id="real_sent_off_${m.id}" style="width:100%;font-size:16px;padding:12px;border:2px solid #dbe3ef;border-radius:17px"><option value="" ${!m.real_sent_off?'selected':''}>Sin expulsión</option>${list.map(pl=>`<option value="${safe(pl.player_name)}" ${normalizeScorer(m.real_sent_off)===normalizeScorer(pl.player_name)?'selected':''}>${safe(pl.team_code)} · ${safe(pl.player_name)}</option>`).join('')}</select>`}
function selectedRealSentOff(mid){return document.querySelector('#real_sent_off_'+mid)?.value||null}
function scoreSelectHtml(id,value,disabled){const v=value??'';return `<select ${disabled?'disabled':''} id="${id}" class="score-select">${Array.from({length:10},(_,n)=>`<option value="${n}" ${String(v)===String(n)?'selected':''}>${n}${n===9?'+':''}</option>`).join('')}</select>`}
function scoreValue(id){const v=document.querySelector('#'+id)?.value;return v===''?NaN:parseInt(v,10)}

async function loadData(doRender=true){
  if(!supabaseReady)return renderNoConfig();

  const [u,p,pm,m,pr,msg,tp1,tp2]=await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('pools').select('*').order('created_at',{ascending:false}),
    supabase.from('pool_members').select('*'),
    supabase.from('matches').select('*').order('match_date'),
    supabase.from('predictions').select('*'),
    supabase.from('messages').select('*').order('created_at',{ascending:true}).limit(200),
    supabase.from('team_players').select('*').range(0,999),
    supabase.from('team_players').select('*').range(1000,1999)
  ]);

  users=u.data||[];
  pools=p.data||[];
  poolMembers=pm.data||[];
  matches=m.data||[];
  predictions=pr.data||[];
  messages=msg.data||[];
  messagesLoadError=msg.error?.message||'';
  teamPlayers=[...(tp1.data||[]),...(tp2.data||[])];

  if(currentUser)currentUser=users.find(x=>x.id===currentUser.id)||currentUser;
  if(currentPool)currentPool=pools.find(x=>x.id===currentPool.id)||currentPool;
  if(doRender)render();
}

async function restoreSession(){try{const raw=localStorage.getItem(SESSION_KEY);if(!raw)return false;const s=JSON.parse(raw);if(!s.userId)return false;await loadData(false);currentUser=users.find(u=>u.id===s.userId)||null;if(!currentUser){clearSession();return false}currentPool=currentUser.role==='admin'?(pools.find(p=>p.id===s.poolId)||null):null;tab='porras';saveSession();render();return true}catch(e){clearSession();return false}}
function renderNoConfig(){app.innerHTML='<div class="app"><div class="card"><h1>Falta configurar Supabase</h1></div></div>'}
function loginView(){return `<div class="app"><div class="hero"><div><div class="kicker">MUNDIAL · APP PRIVADA</div><h1>Mi Porra<br><span>Tu Gloria</span></h1><p>Acierta el marcador, suma puntos y presume en la clasificación.</p></div><div class="ball">⚽</div></div><div class="card"><h2>Entrar</h2><label>Nick</label><input id="nick"><label>Email opcional</label><input id="email"><label>Contraseña</label><input id="pass" type="password"><button onclick="window.login()">Entrar</button><button class="blue" onclick="window.register()">Registrarme</button></div></div>`}
async function register(){const nick=document.querySelector('#nick').value.trim(),email=document.querySelector('#email').value.trim(),password=document.querySelector('#pass').value;if(!nick||!password)return alert('Pon nick y contraseña');const exists=await supabase.from('profiles').select('*').eq('nick',nick).maybeSingle();if(exists.data)return alert('Ese nick ya existe');let role='user';if(nick.toLowerCase()===ADMIN_NICK){if(password!==ADMIN_PASSWORD)return alert('Contraseña de admin incorrecta');role='admin'}const ins=await supabase.from('profiles').insert({nick,email,password,role,avatar:role==='admin'?'🛡️':'🙈'}).select().single();if(ins.error)return alert(ins.error.message);currentUser=ins.data;currentPool=null;tab='porras';saveSession();await loadData()}
async function login(){const nick=document.querySelector('#nick').value.trim(),password=document.querySelector('#pass').value;if(!nick||!password)return alert('Pon nick y contraseña');const res=await supabase.from('profiles').select('*').eq('nick',nick).eq('password',password).maybeSingle();if(!res.data)return alert('Usuario o contraseña incorrectos');currentUser=res.data;currentPool=null;tab='porras';saveSession();await loadData()}
function logout(){currentUser=null;currentPool=null;tab='porras';clearSession();render()}
function setTab(t){tab=t;if(t==='chat')markChatRead();saveSession();render()}
function changePool(){currentPool=null;tab='porras';saveSession();render()}
function isClassificationTab(){return ['clasificacion','normas','estadisticas','historial'].includes(tab)}
function tabs(){
  const topbar=`<div class="topbar"><button class="icon-btn" title="Cerrar sesion" onclick="window.logout()">&#x23FB;</button><div><b>Hola, ${safe(currentUser.nick)}</b>${currentPool?`<br><span>${safe(currentPool.name)}</span>`:''}</div>${currentPool&&currentUser?.role!=='admin'?`<button class="icon-btn" title="Cambiar de porra" onclick="window.changePool()">&#x21C4;</button>`:'<span></span>'}</div>`;
  const adminTabs=`<div class="tabs admin-tabs"><button onclick="window.setTab('porras')">Todas las porras</button><button class="yellow" onclick="window.setTab('resultados')">Resultados globales</button><button class="blue" onclick="window.setTab('archivo')">Partidos completados</button><button class="blue" onclick="window.setTab('historial')">Historial</button></div>`;
  const userBottom=currentPool&&currentUser?.role!=='admin'?`<nav class="bottom-nav"><button class="${tab==='partidos'?'active':''}" onclick="window.setTab('partidos')"><span>Pendientes</span></button><button class="${tab==='archivo'?'active':''}" onclick="window.setTab('archivo')"><span>Completados</span></button><button class="${isClassificationTab()?'active':''}" onclick="window.setTab('clasificacion')"><span>Clasificacion</span></button><button class="${tab==='chat'?'active':''}" onclick="window.setTab('chat')"><span>Chat${hasUnreadChat()?'<i class="chat-dot"></i>':''}</span></button></nav>`:'';
  const userCard=`<div class="card profile-card"><h2>${avatar(currentUser)} Hola, ${safe(currentUser.nick)}</h2><p>${currentUser?.role==='admin'?'Modo administrador':'Espa?a campeona del mundo'}</p><button class="small yellow" onclick="window.saveProfile()">Editar avatar</button></div>`;
  const poolLabel=currentPool?`<div class="pool-pill"><b>Porra:</b> ${safe(currentPool.name)} ? Codigo: <b>${safe(currentPool.code)}</b></div>`:'';
  return currentUser?.role==='admin'?`${topbar}${adminTabs}${userCard}${poolLabel}`:`${topbar}${!currentPool?userCard:''}${poolLabel}${userBottom}`;
}
function poolsView(){const myIds=currentUser?.role==='admin'?pools.map(p=>p.id):poolMembers.filter(pm=>pm.user_id===currentUser.id).map(pm=>pm.pool_id);const list=pools.filter(p=>myIds.includes(p.id));return `<div class="card pool-home"><h2>${currentUser?.role==='admin'?'Todas las porras privadas':'Elige tu porra'}</h2>${currentUser?.role!=='admin'?`<p class="muted">Nada mas entrar puedes elegir una porra, crear una privada o unirte con codigo.</p><div class="pool-actions"><button onclick="window.createPool()">Crear porra privada</button><button class="yellow" onclick="window.joinPool()">Unirme a una porra</button></div>`:''}${list.map(p=>`<div class="match pool-choice"><h3>${safe(p.name)}</h3><p>Codigo: <b>${safe(p.code)}</b> ? Participantes: <b>${poolMembers.filter(pm=>pm.pool_id===p.id).length}</b> ? Joker: <b>${p.enable_joker?'Si':'No'}</b> ? Goleador: <b>${p.enable_scorer?'Si':'No'}</b></p>${p.prizes?`<p><b>Premios:</b><br>${safe(p.prizes).replace(/\n/g,'<br>')}</p>`:''}<button onclick="window.selectPool('${p.id}')">Entrar en esta porra</button>${currentUser?.role==='admin'?`<button class="red" onclick="window.deletePool('${p.id}')">Eliminar porra</button>`:''}${currentUser?.role!=='admin'?`<button class="red" onclick="window.leavePool('${p.id}')">Salir de esta porra</button>`:''}</div>`).join('')||'<p class="muted">No tienes porras todavia.</p>'}</div>`}
function selectPool(id){currentPool=pools.find(p=>String(p.id)===String(id))||null;tab=currentUser?.role==='admin'?'admin':'partidos';saveSession();render()}
async function createPool(){if(currentUser?.role==='admin')return alert('El admin no juega');const name=prompt('Nombre de la porra privada:');if(!name)return;let code=prompt('Código invitación. Vacío para automático:');if(!code)code=generateCode();code=code.trim().toUpperCase();const ex=await supabase.from('pools').select('*').eq('code',code).maybeSingle();if(ex.data)return alert('Ese código ya existe');const enable_joker=confirm('¿Activar Joker? Cada usuario tendrá 5 Jokers.');const enable_scorer=confirm('¿Activar goleador? Si acierta, +2 puntos.');const enable_mvp=confirm('¿Activar MVP del partido? Si acierta, +2 puntos.');const enable_sent_off=confirm('¿Activar posible expulsión? Si acierta, +2 puntos.');const prizes=prompt('Premios de esta porra:','')||'';const ins=await supabase.from('pools').insert({name,code,created_by:currentUser.id,enable_joker,enable_scorer,enable_mvp,enable_sent_off,prizes}).select().single();if(ins.error)return alert(ins.error.message);await supabase.from('pool_members').insert({pool_id:ins.data.id,user_id:currentUser.id,role:'admin'});currentPool=ins.data;tab='partidos';saveSession();await loadData()}
async function joinPool(){if(currentUser?.role==='admin')return alert('El admin no participa');const code=prompt('Código de la porra:');if(!code)return;const res=await supabase.from('pools').select('*').eq('code',code.trim().toUpperCase()).maybeSingle();if(!res.data)return alert('Código no encontrado');const exists=await supabase.from('pool_members').select('*').eq('pool_id',res.data.id).eq('user_id',currentUser.id).maybeSingle();if(!exists.data)await supabase.from('pool_members').insert({pool_id:res.data.id,user_id:currentUser.id,role:'user'});currentPool=res.data;tab='partidos';saveSession();await loadData()}

async function deletePool(id){
  if(currentUser?.role!=='admin') return alert('Solo el admin puede eliminar porras');

  const pool = pools.find(p=>String(p.id)===String(id));
  const name = pool?.name || 'esta porra';

  if(!confirm(`¿Eliminar la porra "${name}" definitivamente?\n\nSe borrarán sus miembros, pronósticos y mensajes. Esta acción no se puede deshacer.`)) return;

  await supabase.from('predictions').delete().eq('pool_id',id);
  await supabase.from('messages').delete().eq('pool_id',id);
  await supabase.from('pool_members').delete().eq('pool_id',id);
  await supabase.from('pools').delete().eq('id',id);

  if(currentPool?.id===id){
    currentPool=null;
  }

  tab='porras';
  saveSession();
  await loadData();
  alert('Porra eliminada');
}

async function leavePool(id){if(!confirm('¿Salir de esta porra?'))return;await supabase.from('pool_members').delete().eq('pool_id',id).eq('user_id',currentUser.id);if(currentPool?.id===id)currentPool=null;tab='porras';saveSession();await loadData()}
function matchesView(){if(currentUser?.role==='admin')return `<div class="card"><h2>Modo administrador</h2><p>Usa Resultados globales.</p></div>`;if(!currentPool)return poolsView();return `<div class="card"><h2>Mis pronósticos</h2>${currentPool.enable_joker?`<div class="notice"><b>🃏 Joker:</b> te quedan ${jokerLimit()-jokerCount()}.</div>`:''}${currentPool.enable_scorer?`<div class="notice"><b>⚽ Goleador:</b> acierto +2 puntos.</div>`:''}${currentPool.enable_mvp?`<div class="notice"><b>⭐ MVP:</b> acierto +2 puntos.</div>`:''}${currentPool.enable_sent_off?`<div class="notice"><b>🟥 Posible expulsión:</b> acierto +2 puntos.</div>`:''}${activeMatches().map(m=>{const p=pred(m.id),pt=p?pointsForPrediction(p,m):null,locked=isLocked(m),fieldsLocked=locked,jokerDisabled=fieldsLocked||!currentPool.enable_joker||(jokerUsed()&&!p?.is_joker);return `<div class="match"><span class="group">${safe(m.group_name)}</span><div class="teams">${teamName(m.home_team)} vs ${teamName(m.away_team)}</div><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><p><span class="badge ${locked?'closed':''}">${locked?'🔒 Partido iniciado':'Abierto'}</span><span class="badge">${p?'Guardado':'Sin guardar'}</span><span class="badge">${pt===null?'Pendiente':pt+' pts'}</span>${p?.is_joker?'<span class="badge-gold">🃏 Joker</span>':''}</p><div class="score compact-score"><div><label>${teamName(m.home_team)}</label>${scoreSelectHtml('ph_'+m.id,p?.pred_home,fieldsLocked)}</div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label>${scoreSelectHtml('pa_'+m.id,p?.pred_away,fieldsLocked)}</div></div>${currentPool.enable_joker?`<label style="display:block;margin:10px 0"><input type="checkbox" id="joker_${m.id}" ${p?.is_joker?'checked':''} ${jokerDisabled?'disabled':''}> 🃏 Usar Joker</label>`:''}${scorerSelectHtml(m,p,fieldsLocked)}${mvpSelectHtml(m,p,fieldsLocked)}${sentOffSelectHtml(m,p,fieldsLocked)}${locked?`<p class="muted"><b>Partido iniciado:</b> no se puede modificar.</p>`:`<button class="small" onclick="window.savePrediction('${m.id}')">Guardar pronóstico</button>`}<p class="muted">Resultado real: <b>${m.real_home===null?'Pendiente':m.real_home+' - '+m.real_away}</b></p>${locked?matchPoolPredictions(m.id):''}</div>`}).join('')}</div>`}
function matchPoolPredictions(mid){if(!currentPool)return'';const match=matches.find(x=>String(x.id)===String(mid));const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({user:u,prediction:poolPredictions().find(pr=>pr.user_id===u.id&&String(pr.match_id)===String(mid))}));return `<div class="notice compact-card"><h3>Pronosticos</h3>${rows.map(r=>{const pts=r.prediction&&match?pointsForPrediction(r.prediction,match):null;return `<div class="prediction-row"><div>${avatar(r.user)}<b>${safe(r.user.nick)}</b>${r.prediction?.is_joker?' <span class="mini-badge">J</span>':''}</div><div>${r.prediction?`<b>${r.prediction.pred_home}-${r.prediction.pred_away}</b>`:'<span class="muted">Sin pronostico</span>'}</div><div>${pts===null?'<span class="muted">-</span>':`<b>${pts} pts</b>`}</div>${r.prediction?.scorer_prediction||r.prediction?.mvp_prediction||r.prediction?.sent_off_prediction?`<div class="prediction-extra">${r.prediction?.scorer_prediction?`G: ${safe(r.prediction.scorer_prediction)} `:''}${r.prediction?.mvp_prediction?`MVP: ${safe(r.prediction.mvp_prediction)} `:''}${r.prediction?.sent_off_prediction?`R: ${safe(r.prediction.sent_off_prediction)}`:''}</div>`:''}</div>`}).join('')}</div>`}
async function savePrediction(mid){if(currentUser?.role==='admin')return alert('El admin no pronostica');if(!currentPool)return alert('Selecciona una porra');const m=matches.find(x=>String(x.id)===String(mid));if(!m)return;if(isLocked(m))return alert('Este partido ya ha empezado');const ph=scoreValue('ph_'+mid),pa=scoreValue('pa_'+mid);if(isNaN(ph)||isNaN(pa)||ph<0||pa<0)return alert('Pon resultado válido');const wants=!!document.querySelector('#joker_'+mid)?.checked;if(wants&&jokerUsed()&&!pred(mid)?.is_joker)return alert('Ya has usado tus 5 Jokers');const scorer=document.querySelector('#scorer_'+mid)?.value.trim()||null;const mvp=document.querySelector('#mvp_'+mid)?.value.trim()||null;const sent_off=document.querySelector('#sent_off_'+mid)?.value.trim()||null;const ex=pred(mid);if(ex)await supabase.from('predictions').update({pred_home:ph,pred_away:pa,is_joker:wants,scorer_prediction:scorer,mvp_prediction:mvp,sent_off_prediction:sent_off}).eq('id',ex.id);else await supabase.from('predictions').insert({pool_id:currentPool.id,user_id:currentUser.id,match_id:mid,pred_home:ph,pred_away:pa,is_joker:wants,scorer_prediction:scorer,mvp_prediction:mvp,sent_off_prediction:sent_off});await loadData()}
function rulesView(){if(!currentPool)return poolsView();return `<div class="card classification-card"><h2>Normas</h2><div class="rule"><h3>Exacto: 5 puntos</h3></div><div class="rule"><h3>Diferencia correcta: 3 puntos</h3></div><div class="rule"><h3>Signo: 2 puntos</h3></div><div class="rule"><h3>Joker</h3><p>${currentPool.enable_joker?'5 Jokers por usuario. Puntuan doble.':'Desactivado.'}</p></div><div class="rule"><h3>Goleador</h3><p>${currentPool.enable_scorer?'Si aciertas un goleador, +2 puntos. Dejarlo vacio da 0 puntos, salvo 0-0 con sin goleador.':'Desactivado.'}</p></div><div class="rule"><h3>MVP</h3><p>${currentPool.enable_mvp?'Si aciertas el MVP del partido, +2 puntos.':'Desactivado.'}</p></div><div class="rule"><h3>Posible expulsion</h3><p>${currentPool.enable_sent_off?'Si eliges y aciertas el jugador expulsado, +2 puntos. No apostar da 0 puntos.':'Desactivado.'}</p></div>${classificationTabs()}</div>`}
function userStats(u){let total=0,exact=0,diff=0,sg=0,played=0,jokers=0,scorersOk=0,mvpsOk=0,sentOffsOk=0;predictions.filter(p=>p.user_id===u.id&&p.pool_id===currentPool?.id).forEach(p=>{const m=matches.find(x=>String(x.id)===String(p.match_id));if(!m)return;const pts=pointsForPrediction(p,m);if(pts===null)return;total+=pts;played++;if(p.is_joker)jokers++;if(scorerPoints(p,m)>0)scorersOk++;if(mvpPoints(p,m)>0)mvpsOk++;if(sentOffPoints(p,m)>0)sentOffsOk++;const b=basePoints(p.pred_home,p.pred_away,m.real_home,m.real_away);if(b===5)exact++;else if(b===3)diff++;else if(b===2)sg++});return{total,exact,diff,sg,played,jokers,scorersOk,mvpsOk,sentOffsOk}}
function userStreak(u){const recent=predictions.filter(p=>p.user_id===u.id&&p.pool_id===currentPool?.id).map(p=>{const m=matches.find(x=>String(x.id)===String(p.match_id));return{m,pts:m?pointsForPrediction(p,m):null}}).filter(x=>x.pts!==null).sort((a,b)=>new Date(b.m.match_date)-new Date(a.m.match_date));if(!recent.length)return{type:'',count:0};const positive=recent[0].pts>0;let count=0;for(const x of recent){if((x.pts>0)!==positive)break;count++}return{type:positive?'positive':'negative',count}}
function rankingTags(r,i,totalRows){const tags=[];if(r.played>0&&totalRows>1&&i===0)tags.push('<span class="taunt good">👑 Dueño provisional del cortijo</span>');if(r.played>0&&totalRows>1&&i===totalRows-1)tags.push('<span class="taunt bad">🪵 Sosteniendo la clasificación</span>');const streak=userStreak(r.u);if(streak.count>=3&&streak.type==='positive')tags.push(`<span class="taunt good">🔥 En llamas: ${streak.count} partidos puntuando</span>`);if(streak.count>=3&&streak.type==='negative')tags.push(`<span class="taunt bad">🥶 Más frío que el banquillo: ${streak.count} ceros seguidos</span>`);return tags.length?`<div class="taunts">${tags.join('')}</div>`:''}
function classificationTabs(){return `<div class="section-tabs"><button class="${tab==='clasificacion'?'active':''}" onclick="window.setTab('clasificacion')">Clasificacion</button><button class="${tab==='normas'?'active':''}" onclick="window.setTab('normas')">Normas</button><button class="${tab==='estadisticas'?'active':''}" onclick="window.setTab('estadisticas')">Estadisticas</button><button class="${tab==='historial'?'active':''}" onclick="window.setTab('historial')">Historial</button></div>`}
function rankingView(){if(!currentPool)return poolsView();const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({u,...userStats(u)})).sort((a,b)=>b.total-a.total||b.exact-a.exact);return `<div class="card classification-card"><h2>Clasificacion</h2><div class="ranking-list">${rows.map((r,i)=>`<div class="ranking compact-ranking"><div>${i+1}</div><div>${avatar(r.u)} <b>${safe(r.u.nick)}</b>${rankingTags(r,i,rows.length)}<span class="muted">Ex ${r.exact} ? Dif ${r.diff} ? Sig ${r.sg} ? J ${r.jokers} ? G ${r.scorersOk} ? MVP ${r.mvpsOk} ? R ${r.sentOffsOk}</span></div><div><b>${r.total}</b><br><span class="muted">pts</span></div></div>`).join('')||'<p class="muted">Sin participantes.</p>'}</div>${classificationTabs()}</div>`}
function statsView(){if(!currentPool)return poolsView();return `<div class="card classification-card"><h2>Estadisticas</h2><p>Participantes: <b>${poolUsers().filter(u=>u.role!=='admin').length}</b></p><p>Pronosticos: <b>${poolPredictions().length}</b></p>${classificationTabs()}</div>`}
function chatView(){
  if(!currentPool)return poolsView();
  markChatRead();
  const ms=messages.filter(m=>String(m.pool_id)===String(currentPool.id));
  return `<div class="card">
    ${messagesLoadError?`<div class="notice"><b>El chat necesita configurarse en Supabase.</b><br>${safe(messagesLoadError)}</div>`:''}
    <h2>💬 Chat</h2>
    <div class="match">
      ${ms.map(m=>{
        const u=users.find(u=>String(u.id)===String(m.user_id));
        const txt=messageText(m);
        return `<p><b>${safe(u?.nick||'Usuario')}:</b> ${safe(txt)}</p>`
      }).join('')||'<p class="muted">Sin mensajes.</p>'}
    </div>
    <input id="chatmsg" placeholder="Mensaje" onkeydown="if(event.key==='Enter')window.sendMessage()">
    <button onclick="window.sendMessage()">Enviar</button>
    <button class="small blue" onclick="window.refreshChat()">Actualizar chat</button>
  </div>`
}

async function sendMessage(){
  const el=document.querySelector('#chatmsg');
  const body=el?.value.trim();
  if(!body)return alert('Escribe un mensaje');
  if(!currentPool)return alert('Selecciona una porra');

  const base={pool_id:currentPool.id,user_id:currentUser.id};
  let ins=null;
  for(const column of ['body','content','message','text']){
    ins=await supabase.from('messages').insert({...base,[column]:body});
    if(!ins.error)break;
    if(!/column|schema cache|null value/i.test(ins.error.message||''))break;
  }

  if(ins.error){
    alert('Error al enviar mensaje: '+ins.error.message);
    return;
  }

  if(el)el.value='';
  await loadData();
}

async function refreshChat(){await loadData()}

function historyView(){return `<div class="card classification-card"><h2>Historial</h2>${matches.filter(m=>m.real_home!==null&&!isArchivedMatch(m)).map(m=>`<div class="match"><b>${teamName(m.home_team)} ${m.real_home} - ${m.real_away} ${teamName(m.away_team)}</b><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div></div>`).join('')||'<p class="muted">Sin resultados recientes.</p>'}${currentUser?.role!=='admin'?classificationTabs():''}</div>`}
function archiveView(){const list=archivedMatches();return `<div class="card"><h2>📦 Partidos completados</h2>${list.map(m=>`<div class="match"><span class="group">${safe(m.group_name)}</span><div class="teams">${teamName(m.home_team)} vs ${teamName(m.away_team)}</div><p>Resultado: <b>${m.real_home===null?'Pendiente':m.real_home+' - '+m.real_away}</b></p>${currentPool?matchPoolPredictions(m.id):''}</div>`).join('')||'<p class="muted">Sin partidos completados.</p>'}</div>`}
function globalResultsView(){if(currentUser?.role!=='admin')return `<div class="card"><h2>Acceso no permitido</h2></div>`;const list=activeMatches();const renderMatch=m=>`<div class="adminrow"><b>${safe(m.group_name)} · ${teamName(m.home_team)} vs ${teamName(m.away_team)}</b><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><div class="score"><div><label>${teamName(m.home_team)}</label><input type="number" min="0" id="grh_${m.id}" value="${m.real_home??''}"></div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label><input type="number" min="0" id="gra_${m.id}" value="${m.real_away??''}"></div></div>${realScorersHtml(m)}${realMvpHtml(m)}${realSentOffHtml(m)}<button class="small" onclick="window.saveGlobalReal('${m.id}')">Guardar resultado global</button><button class="small red" onclick="window.resetGlobalReal('${m.id}')">Reset</button></div>`;return `<div class="card"><h2>⚽ Resultados globales</h2>${list.map(renderMatch).join('')}</div>`}
async function saveGlobalReal(mid){const rh=parseInt(document.querySelector('#grh_'+mid).value,10),ra=parseInt(document.querySelector('#gra_'+mid).value,10);if(isNaN(rh)||isNaN(ra)||rh<0||ra<0)return alert('Pon resultado valido');const data={real_home:rh,real_away:ra,real_scorers:selectedRealScorers(mid),real_mvp:selectedRealMvp(mid),real_sent_off:selectedRealSentOff(mid),result_updated_at:new Date().toISOString()};let res=await supabase.from('matches').update(data).eq('id',mid);if(res.error&&/result_updated_at|schema cache|column/i.test(res.error.message||'')){delete data.result_updated_at;res=await supabase.from('matches').update(data).eq('id',mid)}if(res.error)return alert(res.error.message);await loadData();alert('Resultado guardado')}
async function resetGlobalReal(mid){if(!confirm('¿Borrar resultado?'))return;await supabase.from('matches').update({real_home:null,real_away:null,real_scorers:'',real_mvp:'',real_sent_off:null}).eq('id',mid);await loadData()}
function adminView(){if(currentUser?.role!=='admin')return `<div class="card"><h2>Acceso no permitido</h2></div>`;if(!currentPool)return poolsView();return `<div class="card"><h2>Admin · ${safe(currentPool.name)}</h2><button class="yellow" onclick="window.updatePoolSettings()">⚙️ Joker / Goleador / Premios</button><h3>Participantes</h3>${poolUsers().map(u=>`<p>${avatar(u)} ${safe(u.nick)} ${u.role==='admin'?'(admin)':''}</p>`).join('')}</div>`}
async function updatePoolSettings(){if(currentUser?.role!=='admin')return alert('Solo el admin puede cambiar estos parámetros');if(!currentPool)return;const enable_joker=confirm('¿Activar Joker?');const enable_scorer=confirm('¿Activar goleador?');const enable_mvp=confirm('¿Activar MVP del partido?');const enable_sent_off=confirm('¿Activar posible expulsión?');const prizes=prompt('Premios:',currentPool.prizes||'')||'';await supabase.from('pools').update({enable_joker,enable_scorer,enable_mvp,enable_sent_off,prizes}).eq('id',currentPool.id);await loadData()}
async function saveProfile(){const av=prompt('Emoji avatar:',currentUser.avatar||'🙈');if(!av)return;await supabase.from('profiles').update({avatar:av}).eq('id',currentUser.id);await loadData()}
function render(){document.title='MI PORRA';if(!currentUser){app.innerHTML=loginView();return}let content='';try{content=tab==='porras'?poolsView():tab==='partidos'?matchesView():tab==='normas'?rulesView():tab==='clasificacion'?rankingView():tab==='estadisticas'?statsView():tab==='chat'?chatView():tab==='historial'?historyView():tab==='archivo'?archiveView():tab==='resultados'?globalResultsView():tab==='admin'?adminView():poolsView()}catch(e){console.error(e);content=`<div class="card"><h2>Error</h2><p>${safe(e.message)}</p><button onclick="window.setTab('porras')">Volver</button></div>`}app.innerHTML=`<div class="app has-bottom-nav">${tabs()}<main class="screen">${content}</main></div>`}
Object.assign(window,{login,register,logout,setTab,changePool,selectPool,createPool,joinPool,leavePool,deletePool,savePrediction,saveGlobalReal,resetGlobalReal,updatePoolSettings,saveProfile,sendMessage,refreshChat})
document.title='MI PORRA';restoreSession().then(ok=>{if(!ok)loadData()})
