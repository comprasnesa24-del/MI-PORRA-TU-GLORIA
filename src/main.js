import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseReady = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = supabaseReady ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
const app = document.querySelector('#app')
const SESSION_KEY='mi_porra_session_clean_v1'
const CHAT_READ_KEY='mi_porra_chat_read_v1'
const COMPETITIONS={mundial:{id:'mundial',name:'Mundial 2026',short:'Mundial'},liga:{id:'liga',name:'Liga BBVA 2026/27',short:'Liga BBVA'}}

let currentUser=null,currentPool=null,currentCompetition='mundial',tab='porras'
let users=[],pools=[],poolMembers=[],matches=[],predictions=[],messages=[],teamPlayers=[]
let messagesLoadError=''
let podiumReminderDismissed=false
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
function exactPredictionCount(p,m){if(!currentPool||!p||!m)return 0;return poolPredictions().filter(x=>String(x.match_id)===String(m.id)&&Number(x.pred_home)===Number(p.pred_home)&&Number(x.pred_away)===Number(p.pred_away)).length}
function antiCopyBonus(p,m){if(!currentPool||!p||!m)return 0;if(basePoints(p.pred_home,p.pred_away,m.real_home,m.real_away)!==5)return 0;const n=exactPredictionCount(p,m);return n<=1?3:n===2?2:n===3?1:0}
function pointsForPrediction(p,m){const b=basePoints(p.pred_home,p.pred_away,m.real_home,m.real_away);return b==null?null:(p.is_joker?b*2:b)+antiCopyBonus(p,m)+scorerPoints(p,m)+mvpPoints(p,m)+sentOffPoints(p,m)}
function isLocked(m){return new Date(m.match_date).getTime()<=Date.now()}
function isArchivedMatch(m){return m.real_home!==null&&m.real_away!==null}
function competitionOf(x){return x?.competition||'mundial'}
function competitionName(id=currentCompetition){return COMPETITIONS[id]?.name||COMPETITIONS.mundial.name}
function isWorldCup(){return currentCompetition==='mundial'}
function activeMatches(){return matches.filter(m=>competitionOf(m)===currentCompetition&&!isArchivedMatch(m))}
function resultSortTime(m){return new Date(m.result_updated_at||m.match_date).getTime()}
function archivedMatches(){return matches.filter(m=>competitionOf(m)===currentCompetition&&isArchivedMatch(m)).sort((a,b)=>resultSortTime(b)-resultSortTime(a))}
const KNOCKOUT_LINKS={
  m74:[{target:'m89',field:'home_team',type:'winner'}],m77:[{target:'m89',field:'away_team',type:'winner'}],
  m73:[{target:'m90',field:'home_team',type:'winner'}],m75:[{target:'m90',field:'away_team',type:'winner'}],
  m76:[{target:'m91',field:'home_team',type:'winner'}],m78:[{target:'m91',field:'away_team',type:'winner'}],
  m79:[{target:'m92',field:'home_team',type:'winner'}],m80:[{target:'m92',field:'away_team',type:'winner'}],
  m83:[{target:'m93',field:'home_team',type:'winner'}],m84:[{target:'m93',field:'away_team',type:'winner'}],
  m81:[{target:'m94',field:'home_team',type:'winner'}],m82:[{target:'m94',field:'away_team',type:'winner'}],
  m86:[{target:'m95',field:'home_team',type:'winner'}],m88:[{target:'m95',field:'away_team',type:'winner'}],
  m85:[{target:'m96',field:'home_team',type:'winner'}],m87:[{target:'m96',field:'away_team',type:'winner'}],
  m89:[{target:'m97',field:'home_team',type:'winner'}],m90:[{target:'m97',field:'away_team',type:'winner'}],
  m93:[{target:'m98',field:'home_team',type:'winner'}],m94:[{target:'m98',field:'away_team',type:'winner'}],
  m91:[{target:'m99',field:'home_team',type:'winner'}],m92:[{target:'m99',field:'away_team',type:'winner'}],
  m95:[{target:'m100',field:'home_team',type:'winner'}],m96:[{target:'m100',field:'away_team',type:'winner'}],
  m97:[{target:'m101',field:'home_team',type:'winner'}],m98:[{target:'m101',field:'away_team',type:'winner'}],
  m99:[{target:'m102',field:'home_team',type:'winner'}],m100:[{target:'m102',field:'away_team',type:'winner'}],
  m101:[{target:'m104',field:'home_team',type:'winner'},{target:'m103',field:'home_team',type:'loser'}],
  m102:[{target:'m104',field:'away_team',type:'winner'},{target:'m103',field:'away_team',type:'loser'}]
}
function knockoutResultTeams(m){if(m?.real_home==null||m?.real_away==null)return null;const rh=Number(m.real_home),ra=Number(m.real_away);if(rh===ra){const adv=normTeam(m.advance_team);if(!adv)return null;if(adv===normTeam(m.home_team))return{winner:m.home_team,loser:m.away_team};if(adv===normTeam(m.away_team))return{winner:m.away_team,loser:m.home_team};return null}return rh>ra?{winner:m.home_team,loser:m.away_team}:{winner:m.away_team,loser:m.home_team}}
function advanceSelectHtml(m){if(!isWorldCup()||!KNOCKOUT_LINKS[String(m.id)])return'';return `<label>Pasa eliminatoria</label><select id="adv_${m.id}" class="score-select"><option value="">Solo si hay empate</option><option value="${safe(m.home_team)}" ${normTeam(m.advance_team)===normTeam(m.home_team)?'selected':''}>${teamName(m.home_team)}</option><option value="${safe(m.away_team)}" ${normTeam(m.advance_team)===normTeam(m.away_team)?'selected':''}>${teamName(m.away_team)}</option></select>`}async function propagateKnockoutNames(startId,realData){
  const first=matches.find(x=>String(x.id)===String(startId));
  if(first&&realData)Object.assign(first,realData);
  const queue=[String(startId)];let changed=0;
  while(queue.length){
    const sourceId=queue.shift(),links=KNOCKOUT_LINKS[sourceId]||[];
    const source=matches.find(x=>String(x.id)===sourceId),teams=knockoutResultTeams(source);
    if(!teams)continue;
    for(const link of links){
      const target=matches.find(x=>String(x.id)===String(link.target));
      if(!target)continue;
      const nextName=teams[link.type];
      if(!nextName||target[link.field]===nextName)continue;
      const patch={[link.field]:nextName};
      const res=await supabase.from('matches').update(patch).eq('id',link.target);
      if(res.error)throw res.error;
      Object.assign(target,patch);changed++;
      if(target.real_home!==null&&target.real_away!==null)queue.push(String(target.id));
    }
  }
  return changed;
}
function currentPoolMemberIds(){return currentPool?poolMembers.filter(pm=>pm.pool_id===currentPool.id).map(pm=>pm.user_id):[]}
function poolUsers(){const ids=currentPoolMemberIds();return users.filter(u=>ids.includes(u.id))}
function poolPredictions(){if(!currentPool)return[];const ids=currentPoolMemberIds();return predictions.filter(p=>p.pool_id===currentPool.id&&ids.includes(p.user_id))}
function pred(mid){return poolPredictions().find(p=>p.user_id===currentUser?.id&&String(p.match_id)===String(mid))}
function jokerCount(){return currentUser&&currentPool?poolPredictions().filter(p=>p.user_id===currentUser.id&&p.is_joker).length:0}
function jokerLimit(){return currentCompetition==='liga'?20:5}
function jokerEnabled(){return currentCompetition==='liga'||!!currentPool?.enable_joker}
function jokerUsed(){return jokerCount()>=jokerLimit()}
function myMembership(){return currentUser&&currentPool?poolMembers.find(pm=>pm.user_id===currentUser.id&&pm.pool_id===currentPool.id):null}
function canAdminPool(){return currentUser?.role==='admin'}
function saveSession(){try{localStorage.setItem(SESSION_KEY,JSON.stringify({userId:currentUser?.id||null,poolId:currentPool?.id||null,competition:currentCompetition}))}catch(e){}}
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
const PODIUM_DEADLINE=new Date('2026-06-28T21:00:00+02:00').getTime()
function podiumClosed(){return Date.now()>=PODIUM_DEADLINE}
function podiumDeadlineText(){return '28/06/2026 a las 21:00'}
function podiumMissing(){const pm=myMembership();return !!(currentPool&&currentUser?.role!=='admin'&&pm&&!podiumClosed()&&(!pm.champion_pick||!pm.second_pick||!pm.third_pick))}
function podiumReminderHtml(){if(podiumReminderDismissed||!podiumMissing())return'';return `<div class="podium-modal"><div class="podium-modal-card"><h2>Recuerda el podio</h2><p>Antes del ${podiumDeadlineText()} tienes que elegir:</p><ul><li>Campeón del Mundial</li><li>Segundo del Mundial</li><li>Tercero del Mundial</li></ul><p class="muted">Campeón +20 · Segundo +15 · Tercero +10</p><button class="yellow" onclick="window.showPodiumNow()">Ponerlo ahora</button></div></div>`}
function showPodiumNow(){podiumReminderDismissed=true;tab='partidos';saveSession();render();setTimeout(()=>document.querySelector('.podium-card')?.scrollIntoView({behavior:'smooth',block:'start'}),50)}
function tournamentTeams(){const byCode=new Map();teamPlayers.forEach(p=>{if(p.team_code&&!byCode.has(p.team_code))byCode.set(p.team_code,p.team_name||p.team_code)});if(byCode.size)return Array.from(byCode.entries()).map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name));const names=new Set();matches.forEach(m=>{names.add(m.home_team);names.add(m.away_team)});return Array.from(names).sort().map(name=>({code:name,name}))}
function teamPickSelectHtml(id,value,disabled=false){return `<select id="${id}" class="podium-select" ${disabled?'disabled':''}><option value="">Sin elegir</option>${tournamentTeams().map(t=>`<option value="${safe(t.name)}" ${normTeam(value)===normTeam(t.name)?'selected':''}>${safe(t.name)}</option>`).join('')}</select>`}
function leagueMatches(){return matches.filter(m=>competitionOf(m)==='liga')}
function leagueStarted(){const list=leagueMatches();return !!(list.length&&list.some(m=>new Date(m.match_date).getTime()<=Date.now()))}
function leagueTablePublic(){return !!currentPool?.league_table_public}
function leagueFinished(){const list=leagueMatches();return !!(list.length&&list.every(m=>m.real_home!==null&&m.real_away!==null))}
function leagueTeams(){const names=new Set();leagueMatches().forEach(m=>{if(m.home_team)names.add(m.home_team);if(m.away_team)names.add(m.away_team)});return Array.from(names).sort((a,b)=>a.localeCompare(b))}
function parseLeaguePick(pm){const raw=pm?.league_table_pick;if(Array.isArray(raw))return raw;if(!raw)return[];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:[]}catch(e){return[]}}
function leaguePickComplete(pm){return parseLeaguePick(pm).filter(Boolean).length===leagueTeams().length&&leagueTeams().length>0}
function actualLeagueTable(){const table=new Map();leagueTeams().forEach(t=>table.set(normTeam(t),{team:t,pts:0,gf:0,ga:0,w:0,d:0,l:0}));leagueMatches().filter(m=>m.real_home!==null&&m.real_away!==null).forEach(m=>{const h=table.get(normTeam(m.home_team)),a=table.get(normTeam(m.away_team));if(!h||!a)return;const rh=Number(m.real_home),ra=Number(m.real_away);h.gf+=rh;h.ga+=ra;a.gf+=ra;a.ga+=rh;if(rh>ra){h.pts+=3;h.w++;a.l++}else if(rh<ra){a.pts+=3;a.w++;h.l++}else{h.pts++;a.pts++;h.d++;a.d++}});return Array.from(table.values()).sort((a,b)=>b.pts-a.pts||((b.gf-b.ga)-(a.gf-a.ga))||b.gf-a.gf||a.team.localeCompare(b.team))}
function leagueTablePointsForMember(pm){if(!pm||!leagueFinished())return 0;const pick=parseLeaguePick(pm);const real=actualLeagueTable();let pts=0;real.forEach((row,i)=>{if(normTeam(pick[i])===normTeam(row.team))pts+=i===0?20:i===1?15:i===2?10:3});const realBottom=new Set(real.slice(-3).map(r=>normTeam(r.team)));const pickedBottom=new Set(pick.slice(-3).map(normTeam));realBottom.forEach(t=>{if(pickedBottom.has(t))pts+=5});return pts}
function leagueTableSelectHtml(pos,value,disabled,picks=[]){const used=new Set(picks.filter(Boolean).map(normTeam));return `<select id="league_pos_${pos}" class="league-team-select" onchange="window.refreshLeagueTableSelects()" ${disabled?'disabled':''}><option value="">${pos}</option>${leagueTeams().filter(t=>!used.has(normTeam(t))||normTeam(value)===normTeam(t)).map(t=>`<option value="${safe(t)}" ${normTeam(value)===normTeam(t)?'selected':''}>${pos}. ${safe(t)}</option>`).join('')}</select>`}
function refreshLeagueTableSelects(){if(currentCompetition!=='liga'||leagueStarted())return;const current=leagueTeams().map((_,i)=>document.querySelector('#league_pos_'+(i+1))?.value||'');document.querySelectorAll('.league-team-select').forEach((sel,idx)=>{const pos=idx+1,value=current[idx]||'';const used=new Set(current.filter((x,i)=>x&&i!==idx).map(normTeam));sel.innerHTML=`<option value="">${pos}</option>${leagueTeams().filter(t=>!used.has(normTeam(t))||normTeam(value)===normTeam(t)).map(t=>`<option value="${safe(t)}" ${normTeam(value)===normTeam(t)?'selected':''}>${pos}. ${safe(t)}</option>`).join('')}`;sel.value=value})}
function leagueTablePredictionHtml(){if(!currentPool||currentCompetition!=='liga'||currentUser?.role==='admin')return'';const pm=myMembership();if(!pm)return'';const teams=leagueTeams();if(!teams.length)return'';const closed=leagueStarted();const pick=parseLeaguePick(pm);return `<div class="card league-table-card"><h2>Tu clasificacion de Liga</h2><p class="muted">Pon los 20 equipos en orden antes del primer partido. Por defecto es privada; el admin podra hacer visibles las clasificaciones cuando quiera. Puntos al final: campeon +20, segundo +15, tercero +10, cada puesto exacto del 4 al 20 suma +3 y cada descendido que tengas entre tus 3 ultimos suma +5.</p>${closed?'<div class="notice"><b>Plazo cerrado.</b> Ya no se puede modificar.</div>':''}<div class="league-table-grid">${teams.map((_,i)=>leagueTableSelectHtml(i+1,pick[i],closed,pick)).join('')}</div>${closed?'':`<button class="yellow" onclick="window.saveLeagueTablePrediction()">Guardar mi clasificacion</button>`}${leagueTableSummaryHtml()}</div>`}
function leagueTableSummaryHtml(){if(!currentPool||currentCompetition!=='liga')return'';const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({u,pm:poolMembers.find(pm=>pm.user_id===u.id&&pm.pool_id===currentPool.id)}));const done=rows.filter(r=>leaguePickComplete(r.pm)).length;if(!leagueTablePublic())return `<div class="notice compact-card"><b>${done}/${rows.length}</b> usuarios ya guardaron su clasificacion. Las elecciones de equipos siguen privadas hasta que el admin active la visibilidad.</div>`;return `<div class="notice compact-card"><h3>Clasificaciones visibles</h3>${rows.map(r=>{const pick=parseLeaguePick(r.pm);return `<div class="league-pick-row"><b>${safe(r.u.nick)}</b><span>${leaguePickComplete(r.pm)?pick.map((t,i)=>`${i+1}. ${safe(t)}`).join(' | '):'Sin guardar'}</span>${leagueFinished()?`<em>${leagueTablePointsForMember(r.pm)} pts</em>`:''}</div>`}).join('')}</div>`}
async function saveLeagueTablePrediction(){if(!currentPool||!currentUser)return;if(currentCompetition!=='liga')return;if(leagueStarted())return alert('El plazo para guardar la clasificación ya está cerrado');const picks=leagueTeams().map((_,i)=>document.querySelector('#league_pos_'+(i+1))?.value||'');if(picks.some(x=>!x))return alert('Completa todos los puestos');const keys=picks.map(normTeam);if(new Set(keys).size!==keys.length)return alert('No repitas equipos');const res=await supabase.from('pool_members').update({league_table_pick:picks}).eq('pool_id',currentPool.id).eq('user_id',currentUser.id);if(res.error)return alert(res.error.message);await loadData();alert('Clasificación guardada')}
function matchdayKey(m){return String(m.group_name||'').trim()||new Date(m.match_date).toISOString().slice(0,10)}
function perfectRoundPointsForUser(u){if(!currentPool||currentCompetition!=='liga')return 0;let pts=0;const groups=[...new Set(leagueMatches().map(matchdayKey))];groups.forEach(g=>{const ms=leagueMatches().filter(m=>matchdayKey(m)===g&&m.real_home!==null&&m.real_away!==null);if(!ms.length)return;const allRound=leagueMatches().filter(m=>matchdayKey(m)===g);if(ms.length!==allRound.length)return;const ok=ms.every(m=>{const p=poolPredictions().find(pr=>pr.user_id===u.id&&String(pr.match_id)===String(m.id));return p&&sign(p.pred_home,p.pred_away)===sign(m.real_home,m.real_away)});if(ok)pts+=20});return pts}
function podiumPointsForMember(pm){if(!currentPool||!pm)return 0;let pts=0;if(pm.champion_pick&&currentPool.real_champion&&normTeam(pm.champion_pick)===normTeam(currentPool.real_champion))pts+=20;if(pm.second_pick&&currentPool.real_second&&normTeam(pm.second_pick)===normTeam(currentPool.real_second))pts+=15;if(pm.third_pick&&currentPool.real_third&&normTeam(pm.third_pick)===normTeam(currentPool.real_third))pts+=10;return pts}
function podiumPicksSummaryHtml(){if(!currentPool)return'';const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({u,pm:poolMembers.find(pm=>pm.user_id===u.id&&pm.pool_id===currentPool.id)}));if(!podiumClosed()){const done=rows.filter(r=>r.pm?.champion_pick&&r.pm?.second_pick&&r.pm?.third_pick).length;return `<div class="notice compact-card podium-summary"><h3>Podios de la porra</h3><p class="muted">Se revelan a partir del ${podiumDeadlineText()}.</p><p><b>${done}/${rows.length}</b> usuarios ya lo han guardado.</p></div>`}return `<div class="notice compact-card podium-summary"><h3>Podios de la porra</h3>${rows.map(r=>`<div class="podium-row"><div>${avatar(r.u)}<b>${safe(r.u.nick)}</b></div><div><span>1</span>${safe(r.pm?.champion_pick||'-')}</div><div><span>2</span>${safe(r.pm?.second_pick||'-')}</div><div><span>3</span>${safe(r.pm?.third_pick||'-')}</div></div>`).join('')}</div>`}
function podiumPredictionHtml(){if(!isWorldCup())return'';const pm=myMembership();if(!currentPool||!pm||currentUser?.role==='admin')return'';const closed=podiumClosed();return `<div class="card podium-card"><h2>Podio del Mundial</h2><p class="muted">Campeon +20 · Segundo +15 · Tercero +10<br>Hay que guardarlo antes del ${podiumDeadlineText()}.</p>${closed?'<div class="notice"><b>Plazo cerrado.</b> Ya no se puede modificar el podio.</div>':''}<div class="podium-grid"><label>Campeon${teamPickSelectHtml('pick_champion',pm.champion_pick,closed)}</label><label>Segundo${teamPickSelectHtml('pick_second',pm.second_pick,closed)}</label><label>Tercero${teamPickSelectHtml('pick_third',pm.third_pick,closed)}</label></div>${closed?'':`<button class="yellow" onclick="window.savePodiumPrediction()">Guardar podio</button>`}${podiumPicksSummaryHtml()}</div>`}
async function savePodiumPrediction(){if(!currentPool||!currentUser)return;if(podiumClosed())return alert('El plazo para guardar el podio termino el '+podiumDeadlineText());const champion=document.querySelector('#pick_champion')?.value||null,second=document.querySelector('#pick_second')?.value||null,third=document.querySelector('#pick_third')?.value||null;const picks=[champion,second,third].filter(Boolean).map(normTeam);if(new Set(picks).size!==picks.length)return alert('No repitas equipo en el podio');const res=await supabase.from('pool_members').update({champion_pick:champion,second_pick:second,third_pick:third}).eq('pool_id',currentPool.id).eq('user_id',currentUser.id);if(res.error)return alert(res.error.message);await loadData();alert('Podio guardado')}
function adminPodiumHtml(){if(!isWorldCup()||!currentPool)return'';return `<div class="card podium-card"><h2>Podio real del Mundial</h2><p class="muted">Estos valores suman puntos en esta porra.</p><div class="podium-grid"><label>Campeon${teamPickSelectHtml('real_champion',currentPool.real_champion)}</label><label>Segundo${teamPickSelectHtml('real_second',currentPool.real_second)}</label><label>Tercero${teamPickSelectHtml('real_third',currentPool.real_third)}</label></div><button class="yellow" onclick="window.saveRealPodium()">Guardar podio real</button></div>`}
async function saveRealPodium(){if(currentUser?.role!=='admin'||!currentPool)return alert('Solo admin');const real_champion=document.querySelector('#real_champion')?.value||null,real_second=document.querySelector('#real_second')?.value||null,real_third=document.querySelector('#real_third')?.value||null;const picks=[real_champion,real_second,real_third].filter(Boolean).map(normTeam);if(new Set(picks).size!==picks.length)return alert('No repitas equipo en el podio real');const res=await supabase.from('pools').update({real_champion,real_second,real_third}).eq('id',currentPool.id);if(res.error)return alert(res.error.message);await loadData();alert('Podio real guardado')}


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

async function restoreSession(){try{const raw=localStorage.getItem(SESSION_KEY);if(!raw)return false;const s=JSON.parse(raw);if(!s.userId)return false;currentCompetition=s.competition||'mundial';await loadData(false);currentUser=users.find(u=>u.id===s.userId)||null;if(!currentUser){clearSession();return false}currentPool=currentUser.role==='admin'?(pools.find(p=>p.id===s.poolId)||null):null;if(currentPool)currentCompetition=competitionOf(currentPool);tab='porras';saveSession();render();return true}catch(e){clearSession();return false}}
function renderNoConfig(){app.innerHTML='<div class="app"><div class="card"><h1>Falta configurar Supabase</h1></div></div>'}
function loginView(){return `<div class="app"><div class="hero"><div><div class="kicker">MUNDIAL · APP PRIVADA</div><h1>Mi Porra<br><span>Tu Gloria</span></h1><p>Acierta el marcador, suma puntos y presume en la clasificación.</p></div><div class="ball">⚽</div></div><div class="card"><h2>Entrar</h2><label>Nick</label><input id="nick"><label>Email opcional</label><input id="email"><label>Contraseña</label><input id="pass" type="password"><button onclick="window.login()">Entrar</button><button class="blue" onclick="window.register()">Registrarme</button></div></div>`}
async function register(){const nick=document.querySelector('#nick').value.trim(),email=document.querySelector('#email').value.trim(),password=document.querySelector('#pass').value;if(!nick||!password)return alert('Pon nick y contraseña');const exists=await supabase.from('profiles').select('*').eq('nick',nick).maybeSingle();if(exists.data)return alert('Ese nick ya existe');let role='user';if(nick.toLowerCase()===ADMIN_NICK){if(password!==ADMIN_PASSWORD)return alert('Contraseña de admin incorrecta');role='admin'}const ins=await supabase.from('profiles').insert({nick,email,password,role,avatar:role==='admin'?'🛡️':'🙈'}).select().single();if(ins.error)return alert(ins.error.message);currentUser=ins.data;currentPool=null;tab='porras';saveSession();await loadData()}
async function login(){const nick=document.querySelector('#nick').value.trim(),password=document.querySelector('#pass').value;if(!nick||!password)return alert('Pon nick y contraseña');const res=await supabase.from('profiles').select('*').eq('nick',nick).eq('password',password).maybeSingle();if(!res.data)return alert('Usuario o contraseña incorrectos');currentUser=res.data;currentPool=null;tab='porras';saveSession();await loadData()}
function logout(){currentUser=null;currentPool=null;tab='porras';clearSession();render()}
function setTab(t){tab=t;if(t==='chat')markChatRead();saveSession();render()}
function changePool(){currentPool=null;tab='porras';saveSession();render()}
function setCompetition(id){if(!COMPETITIONS[id])return;currentCompetition=id;currentPool=null;tab='porras';saveSession();render()}
function competitionSwitcherHtml(){return `<div class="competition-switch">${Object.values(COMPETITIONS).map(c=>`<button class="${currentCompetition===c.id?'active':''}" onclick="window.setCompetition('${c.id}')">${safe(c.short)}</button>`).join('')}</div>`}
function isClassificationTab(){return ['clasificacion','normas','estadisticas','historial'].includes(tab)}
function tabs(){
  const topbar=`<div class="topbar"><button class="icon-btn" title="Cerrar sesion" onclick="window.logout()">&#x23FB;</button><div><b>Hola, ${safe(currentUser.nick)}</b>${currentPool?`<br><span>${safe(currentPool.name)}</span>`:''}</div>${currentPool&&currentUser?.role!=='admin'?`<button class="icon-btn" title="Cambiar de porra" onclick="window.changePool()">&#x21C4;</button>`:'<span></span>'}</div>`;
  const adminTabs=`<div class="tabs admin-tabs"><button onclick="window.setTab('porras')">Todas las porras</button><button class="yellow" onclick="window.setTab('resultados')">Resultados globales</button><button class="blue" onclick="window.setTab('archivo')">Partidos completados</button><button class="blue" onclick="window.setTab('historial')">Historial</button></div>`;
  const userBottom=currentPool&&currentUser?.role!=='admin'?`<nav class="bottom-nav"><button class="${tab==='partidos'?'active':''}" onclick="window.setTab('partidos')"><span>Pendientes</span></button><button class="${tab==='archivo'?'active':''}" onclick="window.setTab('archivo')"><span>Completados</span></button><button class="${isClassificationTab()?'active':''}" onclick="window.setTab('clasificacion')"><span>Clasificacion</span></button><button class="${tab==='chat'?'active':''}" onclick="window.setTab('chat')"><span>Chat${hasUnreadChat()?'<i class="chat-dot"></i>':''}</span></button></nav>`:'';
  const userCard=`<div class="card profile-card"><h2>${avatar(currentUser)} Hola, ${safe(currentUser.nick)}</h2><p>${currentUser?.role==='admin'?'Modo administrador':'Pepe es tu lider'}</p>${currentUser?.role!=='admin'?`<div class="notice compact-card"><b>Autocopiar pronosticos:</b> ${currentUser.auto_copy_predictions?'Activado':'Desactivado'}<br><span class="muted">Copia el marcador a tus otras porras de la misma competicion. El Joker no se copia.</span></div><button class="small yellow" onclick="window.toggleAutoCopyPredictions()">${currentUser.auto_copy_predictions?'Desactivar autocopia':'Activar autocopia'}</button>`:''}<button class="small yellow" onclick="window.saveProfile()">Editar avatar</button><button class="small blue" onclick="window.changePassword()">Cambiar contrasena</button></div>`;
  const poolLabel=currentPool?`<div class="pool-pill"><b>Porra:</b> ${safe(currentPool.name)} - Codigo: <b>${safe(currentPool.code)}</b></div>`:'';
  return currentUser?.role==='admin'?`${topbar}${adminTabs}${userCard}${poolLabel}`:`${topbar}${!currentPool?userCard:''}${poolLabel}${userBottom}`;
}
function poolsView(){const myIds=currentUser?.role==='admin'?pools.map(p=>p.id):poolMembers.filter(pm=>pm.user_id===currentUser.id).map(pm=>pm.pool_id);const list=pools.filter(p=>myIds.includes(p.id)&&competitionOf(p)===currentCompetition);return `<div class="card pool-home"><h2>${currentUser?.role==='admin'?'Todas las porras privadas':'Elige competición y porra'}</h2>${competitionSwitcherHtml()}<p class="muted">Ahora estás en <b>${safe(competitionName())}</b>.</p>${currentUser?.role!=='admin'?`<p class="muted">Puedes elegir una porra, crear una privada o unirte con codigo para esta competición.</p><div class="pool-actions"><button onclick="window.createPool()">Crear porra privada</button><button class="yellow" onclick="window.joinPool()">Unirme a una porra</button></div>`:''}${list.map(p=>`<div class="match pool-choice"><h3>${safe(p.name)}</h3><p>Competición: <b>${safe(competitionName(competitionOf(p)))}</b> · Codigo: <b>${safe(p.code)}</b> · Participantes: <b>${poolMembers.filter(pm=>pm.pool_id===p.id).length}</b> · Joker: <b>${competitionOf(p)==='liga'?'Si (20)':(p.enable_joker?'Si':'No')}</b> · Goleador: <b>${p.enable_scorer?'Si':'No'}</b></p>${p.prizes?`<p><b>Premios:</b><br>${safe(p.prizes).replace(/\n/g,'<br>')}</p>`:''}<button onclick="window.selectPool('${p.id}')">Entrar en esta porra</button>${currentUser?.role==='admin'?`<button class="red" onclick="window.deletePool('${p.id}')">Eliminar porra</button>`:''}${currentUser?.role!=='admin'?`<button class="red" onclick="window.leavePool('${p.id}')">Salir de esta porra</button>`:''}</div>`).join('')||'<p class="muted">No tienes porras todavía en esta competición.</p>'}</div>`}
function selectPool(id){currentPool=pools.find(p=>String(p.id)===String(id))||null;if(currentPool)currentCompetition=competitionOf(currentPool);tab=currentUser?.role==='admin'?'admin':'partidos';saveSession();render()}
async function createPool(){if(currentUser?.role==='admin')return alert('El admin no juega');const name=prompt('Nombre de la porra privada:');if(!name)return;let code=prompt('Codigo invitacion. Vacio para automatico:');if(!code)code=generateCode();code=code.trim().toUpperCase();const ex=await supabase.from('pools').select('*').eq('code',code).maybeSingle();if(ex.data)return alert('Ese codigo ya existe');const isLiga=currentCompetition==='liga';const enable_joker=isLiga?true:confirm('Activar Joker? Cada usuario tendra 5 Jokers.');const enable_scorer=isLiga?false:confirm('Activar goleador? Si acierta, +2 puntos.');const enable_mvp=isLiga?false:confirm('Activar MVP del partido? Si acierta, +2 puntos.');const enable_sent_off=isLiga?false:confirm('Activar posible expulsion? Si acierta, +2 puntos.');const prizes=prompt('Premios de esta porra:','')||'';const poolData={name,code,created_by:currentUser.id,enable_joker,enable_scorer,enable_mvp,enable_sent_off,prizes,competition:currentCompetition};let ins=await supabase.from('pools').insert(poolData).select().single();if(ins.error&&/competition|schema cache|column/i.test(ins.error.message)){delete poolData.competition;ins=await supabase.from('pools').insert(poolData).select().single()}if(ins.error)return alert(ins.error.message);await supabase.from('pool_members').insert({pool_id:ins.data.id,user_id:currentUser.id,role:'admin'});currentPool=ins.data;currentCompetition=competitionOf(currentPool);tab='partidos';saveSession();await loadData()}
async function joinPool(){if(currentUser?.role==='admin')return alert('El admin no participa');const code=prompt('Código de la porra:');if(!code)return;const res=await supabase.from('pools').select('*').eq('code',code.trim().toUpperCase()).maybeSingle();if(!res.data)return alert('Código no encontrado');const exists=await supabase.from('pool_members').select('*').eq('pool_id',res.data.id).eq('user_id',currentUser.id).maybeSingle();if(!exists.data)await supabase.from('pool_members').insert({pool_id:res.data.id,user_id:currentUser.id,role:'user'});currentPool=res.data;currentCompetition=competitionOf(currentPool);tab='partidos';saveSession();await loadData()}

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
function matchesView(){if(currentUser?.role==='admin')return `<div class="card"><h2>Modo administrador</h2><p>Usa Resultados globales.</p></div>`;if(!currentPool)return poolsView();return `<div class="card"><h2>Mis pronosticos</h2>${currentCompetition==='liga'?leagueTablePredictionHtml():''}${jokerEnabled()?`<div class="notice"><b>Joker:</b> te quedan ${jokerLimit()-jokerCount()} de ${jokerLimit()}.</div>`:''}${currentPool.enable_scorer?`<div class="notice"><b>Goleador:</b> acierto +2 puntos.</div>`:''}${currentPool.enable_mvp?`<div class="notice"><b>MVP:</b> acierto +2 puntos.</div>`:''}${currentPool.enable_sent_off?`<div class="notice"><b>Posible expulsion:</b> acierto +2 puntos.</div>`:''}${activeMatches().map(m=>{const p=pred(m.id),pt=p?pointsForPrediction(p,m):null,locked=isLocked(m),fieldsLocked=locked,jokerDisabled=fieldsLocked||!jokerEnabled()||(jokerUsed()&&!p?.is_joker);return `<div class="match"><span class="group">${safe(m.group_name)}</span><div class="teams">${teamName(m.home_team)} vs ${teamName(m.away_team)}</div><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><p><span class="badge ${locked?'closed':''}">${locked?'Partido iniciado':'Abierto'}</span><span class="badge">${p?'Guardado':'Sin guardar'}</span><span class="badge">${pt===null?'Pendiente':pt+' pts'}</span>${p?.is_joker?'<span class="badge-gold">Joker</span>':''}</p><div class="score compact-score"><div><label>${teamName(m.home_team)}</label>${scoreSelectHtml('ph_'+m.id,p?.pred_home,fieldsLocked)}</div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label>${scoreSelectHtml('pa_'+m.id,p?.pred_away,fieldsLocked)}</div></div>${jokerEnabled()?`<label style="display:block;margin:10px 0"><input type="checkbox" id="joker_${m.id}" ${p?.is_joker?'checked':''} ${jokerDisabled?'disabled':''}> Usar Joker</label>`:''}${scorerSelectHtml(m,p,fieldsLocked)}${mvpSelectHtml(m,p,fieldsLocked)}${sentOffSelectHtml(m,p,fieldsLocked)}${locked?`<p class="muted"><b>Partido iniciado:</b> no se puede modificar.</p>`:`<button class="small" onclick="window.savePrediction('${m.id}')">Guardar pronostico</button>`}<p class="muted">Resultado real: <b>${m.real_home===null?'Pendiente':m.real_home+' - '+m.real_away}</b></p>${locked?matchPoolPredictions(m.id):''}</div>`}).join('')}${podiumPredictionHtml()}${currentCompetition==='liga'?'':leagueTablePredictionHtml()}</div>`}
function matchPoolPredictions(mid){if(!currentPool)return'';const match=matches.find(x=>String(x.id)===String(mid));const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({user:u,prediction:poolPredictions().find(pr=>pr.user_id===u.id&&String(pr.match_id)===String(mid))}));return `<div class="notice compact-card"><h3>Pronosticos</h3>${rows.map(r=>{const pts=r.prediction&&match?pointsForPrediction(r.prediction,match):null;return `<div class="prediction-row"><div>${avatar(r.user)}<b>${safe(r.user.nick)}</b>${r.prediction?.is_joker?' <span class="mini-badge">J</span>':''}</div><div>${r.prediction?`<b>${r.prediction.pred_home}-${r.prediction.pred_away}</b>`:'<span class="muted">Sin pronostico</span>'}</div><div>${pts===null?'<span class="muted">-</span>':`<b>${pts} pts</b>`}</div>${r.prediction?.scorer_prediction||r.prediction?.mvp_prediction||r.prediction?.sent_off_prediction?`<div class="prediction-extra">${r.prediction?.scorer_prediction?`G: ${safe(r.prediction.scorer_prediction)} `:''}${r.prediction?.mvp_prediction?`MVP: ${safe(r.prediction.mvp_prediction)} `:''}${r.prediction?.sent_off_prediction?`R: ${safe(r.prediction.sent_off_prediction)}`:''}</div>`:''}</div>`}).join('')}</div>`}
async function copyPredictionToOtherPools(mid,data){if(!currentUser?.auto_copy_predictions||!currentPool)return 0;const targetPools=pools.filter(p=>p.id!==currentPool.id&&competitionOf(p)===currentCompetition&&poolMembers.some(pm=>pm.pool_id===p.id&&pm.user_id===currentUser.id));let copied=0;for(const pool of targetPools){const existing=predictions.find(p=>p.pool_id===pool.id&&p.user_id===currentUser.id&&String(p.match_id)===String(mid));const payload={pred_home:data.pred_home,pred_away:data.pred_away,scorer_prediction:pool.enable_scorer?data.scorer_prediction:null,mvp_prediction:pool.enable_mvp?data.mvp_prediction:null,sent_off_prediction:pool.enable_sent_off?data.sent_off_prediction:null};let res;if(existing)res=await supabase.from('predictions').update(payload).eq('id',existing.id);else res=await supabase.from('predictions').insert({...payload,pool_id:pool.id,user_id:currentUser.id,match_id:mid,is_joker:false});if(!res.error)copied++}return copied}
async function savePrediction(mid){if(currentUser?.role==='admin')return alert('El admin no pronostica');if(!currentPool)return alert('Selecciona una porra');const m=matches.find(x=>String(x.id)===String(mid));if(!m)return;if(isLocked(m))return alert('Este partido ya ha empezado');const ph=scoreValue('ph_'+mid),pa=scoreValue('pa_'+mid);if(isNaN(ph)||isNaN(pa)||ph<0||pa<0)return alert('Pon resultado valido');const wants=!!document.querySelector('#joker_'+mid)?.checked;if(wants&&jokerUsed()&&!pred(mid)?.is_joker)return alert('Ya has usado tus '+jokerLimit()+' Jokers');const scorer=document.querySelector('#scorer_'+mid)?.value.trim()||null;const mvp=document.querySelector('#mvp_'+mid)?.value.trim()||null;const sent_off=document.querySelector('#sent_off_'+mid)?.value.trim()||null;const data={pred_home:ph,pred_away:pa,is_joker:wants,scorer_prediction:scorer,mvp_prediction:mvp,sent_off_prediction:sent_off};const ex=pred(mid);let res;if(ex)res=await supabase.from('predictions').update(data).eq('id',ex.id);else res=await supabase.from('predictions').insert({pool_id:currentPool.id,user_id:currentUser.id,match_id:mid,...data});if(res.error)return alert(res.error.message);const copied=await copyPredictionToOtherPools(mid,data);await loadData();if(copied)alert('Pronostico guardado y copiado a '+copied+' porra(s).')}
function rulesView(){if(!currentPool)return poolsView();return `<div class="card classification-card"><h2>Normas</h2><div class="rule"><h3>Exacto: 5 puntos</h3></div><div class="rule"><h3>Diferencia correcta: 3 puntos</h3></div><div class="rule"><h3>Signo: 2 puntos</h3></div><div class="rule"><h3>Bonus Anti-Copia</h3><p>Si aciertas exacto y pocos pusieron lo mismo: unico +3, dos iguales +2, tres iguales +1, cuatro o mas +0.</p></div><div class="rule"><h3>Pleno de jornada</h3><p>Si aciertas el signo de todos los partidos de una jornada de Liga, +20 puntos.</p></div>${currentCompetition==='liga'?'<div class="rule"><h3>Clasificacion hipotetica de Liga</h3><p>Se guarda antes del primer partido. Por defecto es privada, pero el admin puede hacerla visible cuando quiera. Al final: campeon +20, segundo +15, tercero +10, cada puesto exacto del 4 al 20 suma +3 y cada descendido acertado entre tus 3 ultimos suma +5.</p></div>':''}<div class="rule"><h3>Joker</h3><p>${jokerEnabled()?jokerLimit()+' Jokers por usuario para toda la temporada. Puntuan doble.':'Desactivado.'}</p></div><div class="rule"><h3>Goleador</h3><p>${currentPool.enable_scorer?'Si aciertas un goleador, +2 puntos. Dejarlo vacio da 0 puntos, salvo 0-0 con sin goleador.':'Desactivado.'}</p></div><div class="rule"><h3>MVP</h3><p>${currentPool.enable_mvp?'Si aciertas el MVP del partido, +2 puntos.':'Desactivado.'}</p></div><div class="rule"><h3>Posible expulsion</h3><p>${currentPool.enable_sent_off?'Si eliges y aciertas el jugador expulsado, +2 puntos. No apostar da 0 puntos.':'Desactivado.'}</p></div>${classificationTabs()}</div>`}
function userStats(u){let total=0,exact=0,diff=0,sg=0,played=0,jokers=0,scorersOk=0,mvpsOk=0,sentOffsOk=0,antiCopy=0;predictions.filter(p=>p.user_id===u.id&&p.pool_id===currentPool?.id).forEach(p=>{const m=matches.find(x=>String(x.id)===String(p.match_id));if(!m)return;const pts=pointsForPrediction(p,m);if(pts===null)return;total+=pts;played++;if(p.is_joker)jokers++;antiCopy+=antiCopyBonus(p,m);if(scorerPoints(p,m)>0)scorersOk++;if(mvpPoints(p,m)>0)mvpsOk++;if(sentOffPoints(p,m)>0)sentOffsOk++;const b=basePoints(p.pred_home,p.pred_away,m.real_home,m.real_away);if(b===5)exact++;else if(b===3)diff++;else if(b===2)sg++});const pm=poolMembers.find(pm=>pm.user_id===u.id&&pm.pool_id===currentPool?.id);const podium=podiumPointsForMember(pm),leagueTable=leagueTablePointsForMember(pm),perfectRounds=perfectRoundPointsForUser(u);total+=podium+leagueTable+perfectRounds;return{total,exact,diff,sg,played,jokers,scorersOk,mvpsOk,sentOffsOk,podium,antiCopy,leagueTable,perfectRounds}}
function userStreak(u){const recent=predictions.filter(p=>p.user_id===u.id&&p.pool_id===currentPool?.id).map(p=>{const m=matches.find(x=>String(x.id)===String(p.match_id));return{m,pts:m?pointsForPrediction(p,m):null}}).filter(x=>x.pts!==null).sort((a,b)=>new Date(b.m.match_date)-new Date(a.m.match_date));if(!recent.length)return{type:'',count:0};const positive=recent[0].pts>0;let count=0;for(const x of recent){if((x.pts>0)!==positive)break;count++}return{type:positive?'positive':'negative',count}}
function rankingTags(r,i,totalRows){
  const tags=[];
  if(r.played>0&&totalRows>1&&i===0)tags.push('<span class="taunt good">👑 Pepe mira esto y sonríe</span>');
  if(r.played>0&&totalRows>1&&i===1)tags.push('<span class="taunt good">💨 A rueda del líder</span>');
  if(r.played>0&&totalRows>2&&i===2)tags.push('<span class="taunt good">🥉 Zona noble, sin marearse</span>');
  if(r.played>0&&totalRows>1&&i===totalRows-1)tags.push('<span class="taunt bad">🪵 Sosteniendo la clasificación</span>');
  if(r.played>0&&totalRows>2&&i===totalRows-2)tags.push('<span class="taunt bad">🚨 Coqueteando con el sótano</span>');
  if(r.played>0&&r.total===0)tags.push('<span class="taunt bad">🔎 Buscando el primer punto con lupa</span>');
  if(r.exact>=3)tags.push('<span class="taunt good">🎯 Cirujano del marcador exacto</span>');
  if(r.podium>=20)tags.push('<span class="taunt good">🏆 Visionario del podio</span>');
  const streak=userStreak(r.u);
  if(streak.count>=3&&streak.type==='positive')tags.push(`<span class="taunt good">🔥 En llamas: ${streak.count} partidos puntuando</span>`);
  if(streak.count>=3&&streak.type==='negative')tags.push(`<span class="taunt bad">🥶 Más frío que el banquillo: ${streak.count} ceros seguidos</span>`);
  return tags.length?`<div class="taunts">${tags.join('')}</div>`:''
}
function classificationTabs(){return `<div class="section-tabs"><button class="${tab==='clasificacion'?'active':''}" onclick="window.setTab('clasificacion')">Clasificacion</button><button class="${tab==='normas'?'active':''}" onclick="window.setTab('normas')">Normas</button><button class="${tab==='estadisticas'?'active':''}" onclick="window.setTab('estadisticas')">Estadisticas</button><button class="${tab==='historial'?'active':''}" onclick="window.setTab('historial')">Historial</button></div>`}
function rankingView(){if(!currentPool)return poolsView();const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({u,...userStats(u)})).sort((a,b)=>b.total-a.total||b.exact-a.exact);return `<div class="card classification-card"><h2>Clasificacion</h2><div class="ranking-list">${rows.map((r,i)=>`<div class="ranking compact-ranking"><div>${i+1}</div><div>${avatar(r.u)} <b>${safe(r.u.nick)}</b>${rankingTags(r,i,rows.length)}<span class="muted">Ex ${r.exact} ? Dif ${r.diff} ? Sig ${r.sg} ? J ${r.jokers} ? G ${r.scorersOk} ? MVP ${r.mvpsOk} ? R ${r.sentOffsOk} ? Podio ${r.podium} · Anti ${r.antiCopy} · Pleno ${r.perfectRounds} · Liga ${r.leagueTable}</span></div><div><b>${r.total}</b><br><span class="muted">pts</span></div></div>`).join('')||'<p class="muted">Sin participantes.</p>'}</div>${classificationTabs()}</div>`}
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
function globalResultsView(){if(currentUser?.role!=='admin')return `<div class="card"><h2>Acceso no permitido</h2></div>`;const list=activeMatches();const renderMatch=m=>`<div class="adminrow"><b>${safe(m.group_name)} · ${teamName(m.home_team)} vs ${teamName(m.away_team)}</b><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><div class="score"><div><label>${teamName(m.home_team)}</label><input type="number" min="0" id="grh_${m.id}" value="${m.real_home??''}"></div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label><input type="number" min="0" id="gra_${m.id}" value="${m.real_away??''}"></div></div>${advanceSelectHtml(m)}${realScorersHtml(m)}${realMvpHtml(m)}${realSentOffHtml(m)}<button class="small" onclick="window.saveGlobalReal('${m.id}')">Guardar resultado global</button><button class="small red" onclick="window.resetGlobalReal('${m.id}')">Reset</button></div>`;return `<div class="card"><h2>⚽ Resultados globales</h2>${list.map(renderMatch).join('')}</div>`}
async function saveGlobalReal(mid){const rh=parseInt(document.querySelector('#grh_'+mid).value,10),ra=parseInt(document.querySelector('#gra_'+mid).value,10);if(isNaN(rh)||isNaN(ra)||rh<0||ra<0)return alert('Pon resultado valido');const advance=document.querySelector('#adv_'+mid)?.value||null;if(KNOCKOUT_LINKS[String(mid)]&&rh===ra&&!advance)return alert('Hay empate: elige quien pasa la eliminatoria.');const data={real_home:rh,real_away:ra,real_scorers:selectedRealScorers(mid),real_mvp:selectedRealMvp(mid),real_sent_off:selectedRealSentOff(mid),advance_team:advance,result_updated_at:new Date().toISOString()};let res=await supabase.from('matches').update(data).eq('id',mid);if(res.error&&/result_updated_at|advance_team|schema cache|column/i.test(res.error.message||'')){const fallback={...data};delete fallback.result_updated_at;delete fallback.advance_team;res=await supabase.from('matches').update(fallback).eq('id',mid)}if(res.error)return alert(res.error.message);let propagated=0;try{propagated=await propagateKnockoutNames(mid,data)}catch(e){await loadData();return alert('Resultado guardado, pero no pude actualizar el siguiente cruce: '+(e.message||e))}await loadData();alert(propagated?'Resultado guardado y cuadro actualizado':'Resultado guardado')}async function resetGlobalReal(mid){if(!confirm('¿Borrar resultado?'))return;let res=await supabase.from('matches').update({real_home:null,real_away:null,real_scorers:'',real_mvp:'',real_sent_off:null,advance_team:null}).eq('id',mid);if(res.error&&/advance_team|schema cache|column/i.test(res.error.message||''))res=await supabase.from('matches').update({real_home:null,real_away:null,real_scorers:'',real_mvp:'',real_sent_off:null}).eq('id',mid);if(res.error)return alert(res.error.message);await loadData()}function adminView(){if(currentUser?.role!=='admin')return `<div class="card"><h2>Acceso no permitido</h2></div>`;if(!currentPool)return poolsView();return `${adminPodiumHtml()}${adminLeagueTableVisibilityHtml()}<div class="card"><h2>Admin · ${safe(currentPool.name)}</h2><button class="yellow" onclick="window.updatePoolSettings()">⚙️ Joker / Goleador / Premios</button><h3>Participantes</h3>${poolUsers().map(u=>`<p>${avatar(u)} ${safe(u.nick)} ${u.role==='admin'?'(admin)':''}</p>`).join('')}</div>`}
async function updatePoolSettings(){if(currentUser?.role!=='admin')return alert('Solo el admin puede cambiar estos parametros');if(!currentPool)return;const isLiga=competitionOf(currentPool)==='liga';const enable_joker=isLiga?true:confirm('Activar Joker?');const enable_scorer=isLiga?false:confirm('Activar goleador?');const enable_mvp=isLiga?false:confirm('Activar MVP del partido?');const enable_sent_off=isLiga?false:confirm('Activar posible expulsion?');const prizes=prompt('Premios:',currentPool.prizes||'')||'';await supabase.from('pools').update({enable_joker,enable_scorer,enable_mvp,enable_sent_off,prizes}).eq('id',currentPool.id);await loadData()}
function adminLeagueTableVisibilityHtml(){if(!currentPool||competitionOf(currentPool)!=='liga')return'';return `<div class="card"><h2>Clasificacion de Liga</h2><p class="muted">Ahora esta <b>${leagueTablePublic()?'VISIBLE':'PRIVADA'}</b> para los usuarios.</p><button class="yellow" onclick="window.toggleLeagueTableVisibility()">${leagueTablePublic()?'Ocultar clasificaciones':'Hacer visibles las clasificaciones'}</button></div>`}
async function toggleLeagueTableVisibility(){if(currentUser?.role!=='admin'||!currentPool)return alert('Solo admin');const next=!leagueTablePublic();const res=await supabase.from('pools').update({league_table_public:next}).eq('id',currentPool.id);if(res.error)return alert(res.error.message+' - Si falta la columna, ejecuta add-liga-table-visibility.sql en Supabase.');await loadData();alert(next?'Clasificaciones visibles':'Clasificaciones privadas')}
async function saveProfile(){const av=prompt('Emoji avatar:',currentUser.avatar||':)');if(!av)return;await supabase.from('profiles').update({avatar:av}).eq('id',currentUser.id);await loadData()}
async function toggleAutoCopyPredictions(){if(!currentUser||currentUser.role==='admin')return;const next=!currentUser.auto_copy_predictions;const res=await supabase.from('profiles').update({auto_copy_predictions:next}).eq('id',currentUser.id);if(res.error)return alert(res.error.message+' - Si falta la columna, ejecuta add-auto-copy-predictions.sql en Supabase.');currentUser={...currentUser,auto_copy_predictions:next};await loadData();alert(next?'Autocopia activada':'Autocopia desactivada')}
async function changePassword(){if(!currentUser)return alert('Inicia sesión');const current=prompt('Contraseña actual:');if(!current)return;const check=await supabase.from('profiles').select('id').eq('id',currentUser.id).eq('password',current).maybeSingle();if(!check.data)return alert('La contraseña actual no es correcta');const next=prompt('Nueva contraseña:');if(!next||next.length<4)return alert('La nueva contraseña debe tener al menos 4 caracteres');const repeat=prompt('Repite la nueva contraseña:');if(next!==repeat)return alert('Las contraseñas no coinciden');const res=await supabase.from('profiles').update({password:next}).eq('id',currentUser.id);if(res.error)return alert(res.error.message);alert('Contraseña cambiada. Vuelve a entrar con la nueva.');logout()}
function render(){document.title='MI PORRA';if(!currentUser){app.innerHTML=loginView();return}let content='';try{content=tab==='porras'?poolsView():tab==='partidos'?matchesView():tab==='normas'?rulesView():tab==='clasificacion'?rankingView():tab==='estadisticas'?statsView():tab==='chat'?chatView():tab==='historial'?historyView():tab==='archivo'?archiveView():tab==='resultados'?globalResultsView():tab==='admin'?adminView():poolsView()}catch(e){console.error(e);content=`<div class="card"><h2>Error</h2><p>${safe(e.message)}</p><button onclick="window.setTab('porras')">Volver</button></div>`}app.innerHTML=`<div class="app has-bottom-nav">${tabs()}<main class="screen">${content}</main>${podiumReminderHtml()}</div>`}
Object.assign(window,{login,register,logout,setTab,changePool,setCompetition,selectPool,createPool,joinPool,leavePool,deletePool,savePrediction,saveGlobalReal,resetGlobalReal,updatePoolSettings,saveProfile,toggleAutoCopyPredictions,changePassword,sendMessage,refreshChat,savePodiumPrediction,saveRealPodium,saveLeagueTablePrediction,refreshLeagueTableSelects,toggleLeagueTableVisibility,showPodiumNow})
document.title='MI PORRA';restoreSession().then(ok=>{if(!ok)loadData()})
