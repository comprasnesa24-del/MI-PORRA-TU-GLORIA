import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseReady = !!(SUPABASE_URL && SUPABASE_ANON_KEY)
const supabase = supabaseReady ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null
const app = document.querySelector('#app')
const SESSION_KEY='mi_porra_session_clean_v1'
const CHAT_READ_KEY='mi_porra_chat_read_v1'
const COMPETITIONS={mundial:{id:'mundial',name:'Mundial 2026',short:'Mundial'},liga:{id:'liga',name:'Liga BBVA 2026/27',short:'Liga BBVA'},mix:{id:'mix',name:'MIX multideporte',short:'MIX'}}

let currentUser=null,currentPool=null,currentCompetition='mundial',tab='porras',selectedRoundKey=''
let users=[],pools=[],poolMembers=[],matches=[],predictions=[],messages=[],teamPlayers=[]
let adminUsersCache={loaded:false,users:[],deleted:[],error:''}
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
const MIX_COMMON_TEAMS=['Real Madrid','FC Barcelona','Atletico de Madrid','Athletic Club','Villarreal CF','Real Betis','Real Sociedad','Sevilla FC','Valencia CF','Manchester City','Liverpool','Arsenal','Chelsea','Manchester United','Tottenham','PSG','Olympique de Marsella','Olympique de Lyon','Monaco','Bayern Munich','Borussia Dortmund','Bayer Leverkusen','RB Leipzig','Juventus','Inter de Milan','AC Milan','Napoli','Roma','Atalanta','Benfica','Sporting CP','FC Porto','Braga'];
const MIX_EVENTS=[
{id:'premier',label:'Campeon Liga inglesa',points:10,options:['Manchester City','Liverpool','Arsenal','Chelsea','Manchester United','Tottenham','Newcastle United','Aston Villa']},
{id:'francia',label:'Campeon Liga francesa',points:10,options:['PSG','Olympique de Marsella','Olympique de Lyon','Monaco','Lille','Rennes','Lens','Niza']},
{id:'alemania',label:'Campeon Liga alemana',points:10,options:['Bayern Munich','Borussia Dortmund','Bayer Leverkusen','RB Leipzig','Stuttgart','Eintracht Frankfurt','Wolfsburg']},
{id:'italia',label:'Campeon Liga italiana',points:10,options:['Inter de Milan','Juventus','AC Milan','Napoli','Roma','Lazio','Atalanta','Fiorentina']},
{id:'portugal',label:'Campeon Liga portuguesa',points:10,options:['Benfica','Sporting CP','FC Porto','Braga','Vitoria Guimaraes']},
{id:'espana',label:'Campeon Liga espanola',points:10,options:['Real Madrid','FC Barcelona','Atletico de Madrid','Athletic Club','Villarreal CF','Real Betis','Real Sociedad','Sevilla FC']},
{id:'segunda',label:'Campeon Segunda Division espanola',points:10,options:['Deportivo La Coruna','Real Zaragoza','Real Valladolid','Granada CF','Cadiz CF','Sporting de Gijon','Racing de Santander','Almeria','Malaga CF','Las Palmas']},
{id:'primera_rfef_1',label:'Campeon Primera RFEF Grupo 1',points:10,options:['Tenerife','Ponferradina','Unionistas','Cultural Leonesa','Lugo','Ourense CF','Real Madrid Castilla','Celta Fortuna']},
{id:'primera_rfef_2',label:'Campeon Primera RFEF Grupo 2',points:10,options:['Ibiza','Recreativo de Huelva','Hercules','Real Murcia','Antequera','Algeciras','Atletico Sanluqueno','Sevilla Atletico']},
{id:'champions',label:'Campeon Champions League',points:15,options:MIX_COMMON_TEAMS},
{id:'europa',label:'Campeon Europa League',points:15,options:MIX_COMMON_TEAMS},
{id:'conference',label:'Campeon Conference League',points:12,options:MIX_COMMON_TEAMS},
{id:'supercopa_europa',label:'Campeon Supercopa de Europa',points:8,options:['PSG','Tottenham']},
{id:'copa_rey',label:'Campeon Copa del Rey',points:12,options:['Real Madrid','FC Barcelona','Atletico de Madrid','Athletic Club','Real Sociedad','Real Betis','Sevilla FC','Valencia CF']},
{id:'nba',label:'Campeon NBA',points:10,options:['Boston Celtics','Denver Nuggets','Oklahoma City Thunder','Minnesota Timberwolves','Dallas Mavericks','New York Knicks','Los Angeles Lakers','Golden State Warriors']},
{id:'nfl',label:'Campeon Super Bowl NFL',points:10,options:['Kansas City Chiefs','Philadelphia Eagles','Buffalo Bills','Baltimore Ravens','Detroit Lions','San Francisco 49ers','Cincinnati Bengals','Dallas Cowboys','Green Bay Packers','Houston Texans']},
{id:'nhl',label:'Campeon NHL',points:10,options:['Florida Panthers','Edmonton Oilers','Colorado Avalanche','Dallas Stars','Vegas Golden Knights','New York Rangers','Toronto Maple Leafs','Carolina Hurricanes','Tampa Bay Lightning','Boston Bruins']},
{id:'mlb',label:'Campeon beisbol americano MLB',points:10,options:['Los Angeles Dodgers','New York Yankees','Atlanta Braves','Houston Astros','Philadelphia Phillies','Texas Rangers','Baltimore Orioles','Boston Red Sox','Chicago Cubs','San Diego Padres']},
{id:'acb',label:'Campeon ACB',points:10,options:['Real Madrid Baloncesto','Barca Basket','Baskonia','Valencia Basket','Unicaja','Joventut','Gran Canaria']},
{id:'euroliga',label:'Campeon Euroliga',points:10,options:['Real Madrid Baloncesto','Barca Basket','Olympiacos','Panathinaikos','Fenerbahce','Monaco','Anadolu Efes','Partizan']},
{id:'f1_pilotos',label:'Campeon F1 pilotos',points:10,options:['Max Verstappen','Lando Norris','Oscar Piastri','Charles Leclerc','Lewis Hamilton','George Russell','Carlos Sainz','Fernando Alonso']},
{id:'f1_constructores',label:'Campeon F1 constructores',points:10,options:['McLaren','Red Bull','Ferrari','Mercedes','Aston Martin','Williams','Alpine']},
{id:'motogp',label:'Campeon MotoGP',points:10,options:['Marc Marquez','Francesco Bagnaia','Jorge Martin','Pedro Acosta','Fabio Quartararo','Enea Bastianini','Maverick Vinales']}
];
function parseJsonMap(raw){if(raw&&typeof raw==='object'&&!Array.isArray(raw))return raw;if(!raw)return{};try{const parsed=JSON.parse(raw);return parsed&&typeof parsed==='object'&&!Array.isArray(parsed)?parsed:{}}catch(e){return{}}}
function mixPicks(pm){return parseJsonMap(pm?.mix_picks)}
function mixResults(){return parseJsonMap(currentPool?.mix_results)}
function mixInputHtml(id,value,options=[],disabled=false){const list='list_'+id;return `<input id="${id}" list="${list}" value="${safe(value||'')}" ${disabled?'disabled':''} placeholder="Elige o escribe"><datalist id="${list}">${[...new Set(options)].map(x=>`<option value="${safe(x)}"></option>`).join('')}</datalist>`}
function mixPointsForMember(pm){if(!currentPool||!pm)return 0;const picks=mixPicks(pm),real=mixResults();return MIX_EVENTS.reduce((sum,ev)=>sum+(picks[ev.id]&&real[ev.id]&&normTeam(picks[ev.id])===normTeam(real[ev.id])?ev.points:0),0)}
function entryBonusForMember(pm){return Number(pm?.entry_bonus_points||0)||0}
function statsInPool(u,pool){const prevPool=currentPool,prevCompetition=currentCompetition;currentPool=pool;currentCompetition=competitionOf(pool);const stats=userStats(u);currentPool=prevPool;currentCompetition=prevCompetition;return stats}
function entryBonusForNewMember(pool){const memberIds=poolMembers.filter(pm=>String(pm.pool_id)===String(pool?.id)).map(pm=>pm.user_id);const rows=users.filter(u=>u.role!=='admin'&&memberIds.includes(u.id));if(!rows.length)return 0;const totals=rows.map(u=>statsInPool(u,pool).total).filter(n=>Number.isFinite(n));return totals.length?Math.min(...totals):0}
function mixSummaryHtml(){if(!currentPool||currentCompetition!=='mix')return'';const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({u,pm:poolMembers.find(pm=>pm.user_id===u.id&&pm.pool_id===currentPool.id)}));const done=rows.filter(r=>MIX_EVENTS.every(ev=>mixPicks(r.pm)[ev.id])).length;const real=mixResults();const closed=MIX_EVENTS.filter(ev=>real[ev.id]).length;return `<div class="notice compact-card"><b>${done}/${rows.length}</b> usuarios completaron el MIX.<br><b>${closed}/${MIX_EVENTS.length}</b> campeones reales puestos.</div>`}
function mixPredictionHtml(){if(!currentPool||currentCompetition!=='mix'||currentUser?.role==='admin')return'';const pm=myMembership();if(!pm)return'';const picks=mixPicks(pm);return `<div class="card league-table-card"><h2>Porra MIX</h2><p class="muted">Elige campeones de futbol, basket, motor y deportes americanos. Cada acierto suma los puntos indicados.</p><div class="league-table-grid">${MIX_EVENTS.map(ev=>`<label><b>${safe(ev.label)} (+${ev.points})</b>${mixInputHtml('mix_'+ev.id,picks[ev.id],ev.options)}</label>`).join('')}</div><button class="yellow" onclick="window.saveMixPrediction()">Guardar MIX</button>${mixSummaryHtml()}</div>`}
async function saveMixPrediction(){if(!currentPool||!currentUser||currentCompetition!=='mix')return;const picks={};MIX_EVENTS.forEach(ev=>{picks[ev.id]=document.querySelector('#mix_'+ev.id)?.value.trim()||''});const missing=MIX_EVENTS.filter(ev=>!picks[ev.id]);if(missing.length&&!confirm('Te faltan '+missing.length+' elecciones. Puedes guardarlo incompleto y terminar luego. ¿Guardar ahora?'))return;const res=await supabase.from('pool_members').update({mix_picks:picks}).eq('pool_id',currentPool.id).eq('user_id',currentUser.id);if(res.error)return alert(res.error.message+' - Si falta la columna, ejecuta add-mix-pool.sql en Supabase.');await loadData();alert('MIX guardado')}
function adminMixHtml(){if(!currentPool||competitionOf(currentPool)!=='mix')return'';const real=mixResults();return `<div class="card league-table-card"><h2>Resultados reales MIX</h2><p class="muted">Cuando una competicion termine, pon aqui el campeon real y se sumaran los puntos automaticamente.</p><div class="league-table-grid">${MIX_EVENTS.map(ev=>`<label><b>${safe(ev.label)} (+${ev.points})</b>${mixInputHtml('mix_real_'+ev.id,real[ev.id],ev.options)}</label>`).join('')}</div><button class="yellow" onclick="window.saveMixResults()">Guardar campeones MIX</button>${mixSummaryHtml()}</div>`}
async function saveMixResults(){if(!currentPool||currentUser?.role!=='admin'||competitionOf(currentPool)!=='mix')return alert('Solo admin');const real={};MIX_EVENTS.forEach(ev=>{real[ev.id]=document.querySelector('#mix_real_'+ev.id)?.value.trim()||''});const res=await supabase.from('pools').update({mix_results:real}).eq('id',currentPool.id);if(res.error)return alert(res.error.message+' - Si falta la columna, ejecuta add-mix-pool.sql en Supabase.');await loadData();alert('Campeones MIX guardados')}

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
function archivedMatches(){return matches.filter(m=>competitionOf(m)===currentCompetition&&isArchivedMatch(m)).sort((a,b)=>resultSortTime(b)-resultSortTime(a)||new Date(b.match_date)-new Date(a.match_date))}
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
function isPoolCreator(pool=currentPool){return !!(currentUser&&pool&&String(pool.created_by)===String(currentUser.id))}
function autoCopyStorageKey(){return currentUser?'auto_copy_predictions_'+currentUser.id:null}
function autoCopyEnabled(){if(!currentUser||currentUser.role==='admin')return false;const key=autoCopyStorageKey();const saved=key?localStorage.getItem(key):null;return saved!==null?saved==='1':!!currentUser.auto_copy_predictions}
function setLocalAutoCopy(value){const key=autoCopyStorageKey();if(key)localStorage.setItem(key,value?'1':'0')}
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
function firstLeagueKickoff(){const times=leagueMatches().map(m=>new Date(m.match_date).getTime()).filter(Boolean);return times.length?Math.min(...times):0}
function leagueTableDeadlineForMember(pm){const first=firstLeagueKickoff();if(!first)return 0;if(Date.now()<first)return first;const joined=new Date(pm?.joined_at||0).getTime();return joined?joined+24*60*60*1000:first}
function leagueTableOpenForMember(pm){const deadline=leagueTableDeadlineForMember(pm);return !!deadline&&Date.now()<deadline}
function leagueTableDeadlineText(pm){const deadline=leagueTableDeadlineForMember(pm);return deadline?new Date(deadline).toLocaleString('es-ES'):'el inicio de la Liga'}
function leagueTablePublic(){return !!currentPool?.league_table_public}
function leagueFinished(){const list=leagueMatches();return !!(list.length&&list.every(m=>m.real_home!==null&&m.real_away!==null))}
function leagueTeams(){const names=new Set();leagueMatches().forEach(m=>{if(m.home_team)names.add(m.home_team);if(m.away_team)names.add(m.away_team)});return Array.from(names).sort((a,b)=>a.localeCompare(b))}
function parseLeaguePick(pm){const raw=pm?.league_table_pick;if(Array.isArray(raw))return raw;if(!raw)return[];try{const parsed=JSON.parse(raw);return Array.isArray(parsed)?parsed:[]}catch(e){return[]}}
function leaguePickComplete(pm){return parseLeaguePick(pm).filter(Boolean).length===leagueTeams().length&&leagueTeams().length>0}
function actualLeagueTable(){const table=new Map();leagueTeams().forEach(t=>table.set(normTeam(t),{team:t,pts:0,gf:0,ga:0,w:0,d:0,l:0}));leagueMatches().filter(m=>m.real_home!==null&&m.real_away!==null).forEach(m=>{const h=table.get(normTeam(m.home_team)),a=table.get(normTeam(m.away_team));if(!h||!a)return;const rh=Number(m.real_home),ra=Number(m.real_away);h.gf+=rh;h.ga+=ra;a.gf+=ra;a.ga+=rh;if(rh>ra){h.pts+=3;h.w++;a.l++}else if(rh<ra){a.pts+=3;a.w++;h.l++}else{h.pts++;a.pts++;h.d++;a.d++}});return Array.from(table.values()).sort((a,b)=>b.pts-a.pts||((b.gf-b.ga)-(a.gf-a.ga))||b.gf-a.gf||a.team.localeCompare(b.team))}
function leagueTablePointsForMember(pm){if(!pm||!leagueFinished())return 0;const pick=parseLeaguePick(pm);const real=actualLeagueTable();let pts=0;real.forEach((row,i)=>{if(normTeam(pick[i])===normTeam(row.team))pts+=i===0?20:i===1?15:i===2?10:3});const realBottom=new Set(real.slice(-3).map(r=>normTeam(r.team)));const pickedBottom=new Set(pick.slice(-3).map(normTeam));realBottom.forEach(t=>{if(pickedBottom.has(t))pts+=5});return pts}
function leagueTableSelectHtml(pos,value,disabled,picks=[]){const used=new Set(picks.filter(Boolean).map(normTeam));return `<select id="league_pos_${pos}" class="league-team-select" onchange="window.refreshLeagueTableSelects()" ${disabled?'disabled':''}><option value="">${pos}</option>${leagueTeams().filter(t=>!used.has(normTeam(t))||normTeam(value)===normTeam(t)).map(t=>`<option value="${safe(t)}" ${normTeam(value)===normTeam(t)?'selected':''}>${pos}. ${safe(t)}</option>`).join('')}</select>`}
function refreshLeagueTableSelects(){if(currentCompetition!=='liga'||!leagueTableOpenForMember(myMembership()))return;const current=leagueTeams().map((_,i)=>document.querySelector('#league_pos_'+(i+1))?.value||'');document.querySelectorAll('.league-team-select').forEach((sel,idx)=>{const pos=idx+1,value=current[idx]||'';const used=new Set(current.filter((x,i)=>x&&i!==idx).map(normTeam));sel.innerHTML=`<option value="">${pos}</option>${leagueTeams().filter(t=>!used.has(normTeam(t))||normTeam(value)===normTeam(t)).map(t=>`<option value="${safe(t)}" ${normTeam(value)===normTeam(t)?'selected':''}>${pos}. ${safe(t)}</option>`).join('')}`;sel.value=value})}
function leagueTablePredictionHtml(){if(!currentPool||currentCompetition!=='liga'||currentUser?.role==='admin')return'';const pm=myMembership();if(!pm)return'';const teams=leagueTeams();if(!teams.length)return'';const closed=!leagueTableOpenForMember(pm);const pick=parseLeaguePick(pm);const intro=leagueStarted()?`Tienes 24 horas desde que entraste en la porra para guardar tu clasificacion.`:'Pon los 20 equipos en orden antes del primer partido.';return `<div class="card league-table-card"><h2>Tu clasificacion de Liga</h2><p class="muted">${intro} Puntos al final: campeon +20, segundo +15, tercero +10, cada puesto exacto del 4 al 20 suma +3 y cada descendido que tengas entre tus 3 ultimos suma +5.</p>${closed?'<div class="notice"><b>Plazo cerrado.</b> Ya no se puede modificar.</div>':`<div class="notice"><b>Plazo abierto hasta:</b> ${leagueTableDeadlineText(pm)}</div>`}<div class="league-table-grid">${teams.map((_,i)=>leagueTableSelectHtml(i+1,pick[i],closed,pick)).join('')}</div>${closed?'':`<button class="yellow" onclick="window.saveLeagueTablePrediction()">Guardar mi clasificacion</button>`}${leagueTableSummaryHtml()}</div>`}
function leagueTableSummaryHtml(){if(!currentPool||currentCompetition!=='liga')return'';const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({u,pm:poolMembers.find(pm=>pm.user_id===u.id&&pm.pool_id===currentPool.id)}));const done=rows.filter(r=>leaguePickComplete(r.pm)).length;if(!leagueTablePublic())return `<div class="notice compact-card"><b>${done}/${rows.length}</b> usuarios ya guardaron su clasificacion.</div>`;return `<div class="notice compact-card"><h3>Clasificaciones visibles</h3>${rows.map(r=>{const pick=parseLeaguePick(r.pm);return `<div class="league-pick-row"><b>${safe(r.u.nick)}</b><span>${leaguePickComplete(r.pm)?pick.map((t,i)=>`${i+1}. ${safe(t)}`).join(' | '):'Sin guardar'}</span>${leagueFinished()?`<em>${leagueTablePointsForMember(r.pm)} pts</em>`:''}</div>`}).join('')}</div>`}
async function saveLeagueTablePrediction(){if(!currentPool||!currentUser)return;if(currentCompetition!=='liga')return;const pm=myMembership();if(!leagueTableOpenForMember(pm))return alert('El plazo para guardar la clasificacion ya esta cerrado');const picks=leagueTeams().map((_,i)=>document.querySelector('#league_pos_'+(i+1))?.value||'');if(picks.some(x=>!x))return alert('Completa todos los puestos');const keys=picks.map(normTeam);if(new Set(keys).size!==keys.length)return alert('No repitas equipos');const res=await supabase.from('pool_members').update({league_table_pick:picks}).eq('pool_id',currentPool.id).eq('user_id',currentUser.id);if(res.error)return alert(res.error.message);await loadData();alert('Clasificación guardada')}
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

  const [u,p,pm,m,pr1,pr2,pr3,pr4,pr5,msg,tp1,tp2]=await Promise.all([
    supabase.from('profiles').select('*'),
    supabase.from('pools').select('*').order('created_at',{ascending:false}),
    supabase.from('pool_members').select('*'),
    supabase.from('matches').select('*').order('match_date'),
    supabase.from('predictions').select('*').range(0,999),
    supabase.from('predictions').select('*').range(1000,1999),
    supabase.from('predictions').select('*').range(2000,2999),
    supabase.from('predictions').select('*').range(3000,3999),
    supabase.from('predictions').select('*').range(4000,4999),
    supabase.from('messages').select('*').order('created_at',{ascending:true}).limit(200),
    supabase.from('team_players').select('*').range(0,999),
    supabase.from('team_players').select('*').range(1000,1999)
  ]);

  users=u.data||[];
  pools=p.data||[];
  poolMembers=pm.data||[];
  matches=m.data||[];
  predictions=[...(pr1.data||[]),...(pr2.data||[]),...(pr3.data||[]),...(pr4.data||[]),...(pr5.data||[])];
  messages=msg.data||[];
  messagesLoadError=msg.error?.message||'';
  teamPlayers=[...(tp1.data||[]),...(tp2.data||[])];

  if(currentUser){currentUser=users.find(x=>x.id===currentUser.id)||currentUser;if(Object.prototype.hasOwnProperty.call(currentUser,'auto_copy_predictions'))setLocalAutoCopy(!!currentUser.auto_copy_predictions)}
  if(currentPool)currentPool=pools.find(x=>x.id===currentPool.id)||currentPool;
  if(doRender)render();
}

async function restoreSession(){try{const raw=localStorage.getItem(SESSION_KEY);if(!raw)return false;const s=JSON.parse(raw);if(!s.userId)return false;currentCompetition=s.competition||'mundial';await loadData(false);currentUser=users.find(u=>u.id===s.userId)||null;if(!currentUser){clearSession();return false}currentPool=currentUser.role==='admin'?(pools.find(p=>p.id===s.poolId)||null):null;if(currentPool)currentCompetition=competitionOf(currentPool);tab='porras';saveSession();render();return true}catch(e){clearSession();return false}}
function renderNoConfig(){app.innerHTML='<div class="app"><div class="card"><h1>Falta configurar Supabase</h1></div></div>'}
function loginView(){return `<div class="app"><div class="hero"><div><div class="kicker">MUNDIAL · APP PRIVADA</div><h1>Mi Porra<br><span>Tu Gloria</span></h1><p>Acierta el marcador, suma puntos y presume en la clasificación.</p></div><div class="ball">⚽</div></div><div class="card"><h2>Entrar</h2><label>Nick</label><input id="nick" autocomplete="username" autocapitalize="none" spellcheck="false"><label>Email opcional</label><input id="email" type="email" autocomplete="email" autocapitalize="none" spellcheck="false"><label>Contraseña</label><input id="pass" type="password" autocomplete="current-password" autocapitalize="none" spellcheck="false"><button onclick="window.login()">Entrar</button><button class="blue" onclick="window.register()">Registrarme</button><p class="muted login-help">El nick no distingue mayusculas ni acentos. Si copias la contrasena, revisa que no se haya pegado un punto o espacio.</p><p class="muted login-help"><a href="/privacy.html" target="_blank">Politica de privacidad</a></p></div></div>`}
function cleanLoginValue(v){return String(v||'').trim()}
function loginKey(v){return cleanLoginValue(v).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function sameLoginText(a,b){return loginKey(a)===loginKey(b)}
function samePassword(saved,typed){const a=String(saved??''),b=String(typed??''),bt=b.trim();return a===b||a===bt||a.trim()===bt}
async function findLoginProfile(nick,email){const key=loginKey(nick),mail=cleanLoginValue(email).toLowerCase();if(key){const byNick=await supabase.from('profiles').select('*');if(byNick.error)return{error:byNick.error};const matches=(byNick.data||[]).filter(p=>loginKey(p.nick)===key);if(matches.length)return{data:matches[0],many:matches.length>1,mode:'nick'}}if(mail){const byEmail=await supabase.from('profiles').select('*').ilike('email',mail).limit(2);if(byEmail.error)return{error:byEmail.error};if((byEmail.data||[]).length)return{data:byEmail.data[0],many:byEmail.data.length>1,mode:'email'}}return{data:null}}
async function register(){const nick=cleanLoginValue(document.querySelector('#nick').value),email=cleanLoginValue(document.querySelector('#email').value),password=cleanLoginValue(document.querySelector('#pass').value);if(!nick||!password)return alert('Pon nick y contraseña');const existing=await supabase.from('profiles').select('id,nick');if(existing.error)return alert(existing.error.message);if((existing.data||[]).some(u=>sameLoginText(u.nick,nick)))return alert('Ese nick ya existe, aunque cambies mayusculas, minusculas o acentos');let role='user';if(loginKey(nick)===ADMIN_NICK){if(password!==ADMIN_PASSWORD)return alert('Contraseña de admin incorrecta');role='admin'}const ins=await supabase.from('profiles').insert({nick,email,password,role,avatar:role==='admin'?'🛡️':'🙈'}).select().single();if(ins.error)return alert(ins.error.message);currentUser=ins.data;currentPool=null;tab='porras';saveSession();await loadData()}
async function login(){const nick=document.querySelector('#nick').value,email=document.querySelector('#email').value,password=document.querySelector('#pass').value;if(!cleanLoginValue(nick)||!cleanLoginValue(password))return alert('Pon nick y contraseña');const found=await findLoginProfile(nick,email);if(found.error)return alert(found.error.message);if(found.many)return alert('Hay mas de un usuario parecido. Escribe el nick completo exactamente.');if(!found.data)return alert('No encuentro ese nick. Revisa que sea el nick de la porra, no el nombre de la porra.');if(!samePassword(found.data.password,password))return alert('La contraseña no coincide. Revisa mayusculas, numeros y que no se haya pegado un punto al final.');currentUser=found.data;currentPool=null;tab='porras';saveSession();await loadData()}
function logout(){currentUser=null;currentPool=null;tab='porras';clearSession();render()}
function setTab(t){tab=t;if(t==='chat')markChatRead();saveSession();render()}
function changePool(){currentPool=null;tab='porras';saveSession();render()}
function setCompetition(id){if(!COMPETITIONS[id])return;currentCompetition=id;currentPool=null;tab='porras';saveSession();render()}
function competitionSwitcherHtml(){return `<div class="competition-switch">${Object.values(COMPETITIONS).map(c=>`<button class="${currentCompetition===c.id?'active':''}" onclick="window.setCompetition('${c.id}')">${safe(c.short)}</button>`).join('')}</div>`}
function isClassificationTab(){return ['clasificacion','jornadas','mi_pronostico','normas','estadisticas','historial'].includes(tab)}
function tabs(){
  const topbar=`<div class="topbar"><button class="icon-btn" title="Cerrar sesion" onclick="window.logout()">&#x23FB;</button><div><b>Hola, ${safe(currentUser.nick)}</b>${currentPool?`<br><span>${safe(currentPool.name)}</span>`:''}</div>${currentPool&&currentUser?.role!=='admin'?`<button class="icon-btn" title="Cambiar de porra" onclick="window.changePool()">&#x21C4;</button>`:'<span></span>'}</div>`;
  const adminTabs=`<div class="tabs admin-tabs"><button onclick="window.setTab('porras')">Todas las porras</button><button class="yellow" onclick="window.setTab('usuarios')">Usuarios</button><button class="yellow" onclick="window.setTab('resultados')">Resultados globales</button><button class="blue" onclick="window.setTab('archivo')">Partidos completados</button><button class="blue" onclick="window.setTab('historial')">Historial</button></div>`;
  const userBottom=currentPool&&currentUser?.role!=='admin'?`<nav class="bottom-nav"><button class="${tab==='partidos'?'active':''}" onclick="window.setTab('partidos')"><span>Pendientes</span></button><button class="${tab==='archivo'?'active':''}" onclick="window.setTab('archivo')"><span>Completados</span></button><button class="${isClassificationTab()?'active':''}" onclick="window.setTab('clasificacion')"><span>Clasificacion</span></button><button class="${tab==='chat'?'active':''}" onclick="window.setTab('chat')"><span>Chat${hasUnreadChat()?'<i class="chat-dot"></i>':''}</span></button></nav>`:'';
  const userCard=`<div class="card profile-card"><h2>${avatar(currentUser)} Hola, ${safe(currentUser.nick)}</h2><p>${currentUser?.role==='admin'?'Modo administrador':'Listo para repartir disgustos'}</p>${currentUser?.role!=='admin'?`<div class="notice compact-card"><b>Autocopiar pronosticos:</b> ${autoCopyEnabled()?'Activado':'Desactivado'}<br><span class="muted">Copia el marcador a tus otras porras de la misma competicion. El Joker no se copia.</span></div><button class="small yellow" onclick="window.toggleAutoCopyPredictions()">${autoCopyEnabled()?'Desactivar autocopia':'Activar autocopia'}</button>`:''}<button class="small yellow" onclick="window.saveProfile()">Editar avatar</button><button class="small blue" onclick="window.changePassword()">Cambiar contrasena</button></div>`;
  const poolLabel=currentPool?`<div class="pool-pill"><b>Porra:</b> ${safe(currentPool.name)} - Codigo: <b>${safe(currentPool.code)}</b></div>`:'';
  return currentUser?.role==='admin'?`${topbar}${adminTabs}${userCard}${poolLabel}`:`${topbar}${!currentPool?userCard:''}${poolLabel}${userBottom}`;
}
function poolPrizeButton(pool){return isPoolCreator(pool)?`<button class="small yellow" onclick="window.editPoolPrizes('${pool.id}')">Cambiar premios</button>`:''}
async function editPoolPrizes(id){const pool=pools.find(p=>String(p.id)===String(id));if(!pool||!isPoolCreator(pool))return alert('Solo el creador de la porra puede cambiar los premios');const prizes=prompt('Premios de esta porra:',pool.prizes||'');if(prizes===null)return;const res=await supabase.from('pools').update({prizes}).eq('id',pool.id).eq('created_by',currentUser.id);if(res.error)return alert(res.error.message);await loadData();alert('Premios actualizados')}
async function editRoundMoneyRules(){if(!currentPool||!isPoolCreator())return alert('Solo el creador de la porra puede cambiar esto');const first=Number(prompt('Premio para el 1º de cada jornada (€). 0 para quitar:',moneyRuleAmount(1)||5)||0);const second=Number(prompt('Premio para el 2º de cada jornada (€). 0 para quitar:',moneyRuleAmount(2)||3)||0);const last=Number(prompt('Sancion para el ultimo de cada jornada (€). 0 para quitar:',Math.abs(moneyRuleAmount(-1))||5)||0);const penultimate=Number(prompt('Sancion para el penultimo de cada jornada (€). 0 para quitar:',Math.abs(moneyRuleAmount(-2))||3)||0);if([first,second,last,penultimate].some(Number.isNaN))return alert('Pon cantidades validas');const rules=[];if(first)rules.push({position:1,amount:first});if(second)rules.push({position:2,amount:second});if(last)rules.push({position:-1,amount:-Math.abs(last)});if(penultimate)rules.push({position:-2,amount:-Math.abs(penultimate)});const res=await supabase.from('pools').update({round_money_rules:rules}).eq('id',currentPool.id).eq('created_by',currentUser.id);if(res.error)return alert(res.error.message+' - Si falta la columna, ejecuta add-round-money-rules.sql en Supabase.');await loadData();alert('Premios y sanciones por jornada actualizados')}
function poolsView(){const myIds=currentUser?.role==='admin'?pools.map(p=>p.id):poolMembers.filter(pm=>pm.user_id===currentUser.id).map(pm=>pm.pool_id);const list=pools.filter(p=>myIds.includes(p.id)&&competitionOf(p)===currentCompetition);return `<div class="card pool-home"><h2>${currentUser?.role==='admin'?'Todas las porras privadas':'Elige competicion y porra'}</h2>${competitionSwitcherHtml()}<p class="muted">Ahora estas en <b>${safe(competitionName())}</b>.</p>${currentUser?.role!=='admin'?`<p class="muted">Puedes elegir una porra, crear una privada o unirte con codigo para esta competicion.</p><div class="pool-actions"><button onclick="window.createPool()">Crear porra privada</button><button class="yellow" onclick="window.joinPool()">Unirme a una porra</button></div>`:''}${currentCompetition==='mix'?'<div class="notice compact-card"><b>Idea MIX:</b> campeones de ligas, copas, basket, motor y deportes americanos. No hay calendario partido a partido.</div>':''}${list.map(p=>`<div class="match pool-choice"><h3>${safe(p.name)}</h3><p>Competicion: <b>${safe(competitionName(competitionOf(p)))}</b> - Codigo: <b>${safe(p.code)}</b> - Participantes: <b>${poolMembers.filter(pm=>pm.pool_id===p.id).length}</b> - Joker: <b>${competitionOf(p)==='liga'?'Si (20)':(competitionOf(p)==='mix'?'No':(p.enable_joker?'Si':'No'))}</b> - Goleador: <b>${p.enable_scorer?'Si':'No'}</b></p>${p.prizes?`<p><b>Premios:</b><br>${safe(p.prizes).replace(/\n/g,'<br>')}</p>`:''}${poolPrizeButton(p)}<button onclick="window.selectPool('${p.id}')">Entrar en esta porra</button>${currentUser?.role==='admin'?`<button class="red" onclick="window.deletePool('${p.id}')">Eliminar porra</button>`:''}${currentUser?.role!=='admin'?`<details class="leave-pool-box"><summary>Opciones de salida</summary><button class="small red" onclick="window.leavePool('${p.id}')">Salir de esta porra</button></details>`:''}</div>`).join('')||'<p class="muted">No tienes porras todavia en esta competicion.</p>'}</div>`}
function selectPool(id){currentPool=pools.find(p=>String(p.id)===String(id))||null;if(currentPool)currentCompetition=competitionOf(currentPool);tab=currentUser?.role==='admin'?'admin':'partidos';saveSession();render()}
async function createPool(){if(currentUser?.role==='admin')return alert('El admin no juega');const name=prompt('Nombre de la porra privada:');if(!name)return;let code=prompt('Codigo invitacion. Vacio para automatico:');if(!code)code=generateCode();code=code.trim().toUpperCase();const ex=await supabase.from('pools').select('*').eq('code',code).maybeSingle();if(ex.data)return alert('Ese codigo ya existe');const isLiga=currentCompetition==='liga',isMix=currentCompetition==='mix';const enable_joker=isLiga?true:(isMix?false:confirm('Activar Joker? Cada usuario tendra 5 Jokers.'));const enable_scorer=isLiga||isMix?false:confirm('Activar goleador? Si acierta, +2 puntos.');const enable_mvp=isLiga||isMix?false:confirm('Activar MVP del partido? Si acierta, +2 puntos.');const enable_sent_off=isLiga||isMix?false:confirm('Activar posible expulsion? Si acierta, +2 puntos.');const prizes=prompt('Premios de esta porra:','')||'';const poolData={name,code,created_by:currentUser.id,enable_joker,enable_scorer,enable_mvp,enable_sent_off,prizes,competition:currentCompetition};let ins=await supabase.from('pools').insert(poolData).select().single();if(ins.error&&/competition|schema cache|column/i.test(ins.error.message)){delete poolData.competition;ins=await supabase.from('pools').insert(poolData).select().single()}if(ins.error)return alert(ins.error.message);await supabase.from('pool_members').insert({pool_id:ins.data.id,user_id:currentUser.id,role:'admin'});currentPool=ins.data;currentCompetition=competitionOf(currentPool);tab='partidos';saveSession();await loadData()}
async function joinPool(){if(currentUser?.role==='admin')return alert('El admin no participa');const code=prompt('Código de la porra:');if(!code)return;const res=await supabase.from('pools').select('*').eq('code',code.trim().toUpperCase()).maybeSingle();if(!res.data)return alert('Código no encontrado');const exists=await supabase.from('pool_members').select('*').eq('pool_id',res.data.id).eq('user_id',currentUser.id).maybeSingle();if(!exists.data){const entry_bonus_points=entryBonusForNewMember(res.data);let ins=await supabase.from('pool_members').insert({pool_id:res.data.id,user_id:currentUser.id,role:'user',entry_bonus_points});if(ins.error&&/entry_bonus_points|schema cache|column/i.test(ins.error.message||''))ins=await supabase.from('pool_members').insert({pool_id:res.data.id,user_id:currentUser.id,role:'user'});if(ins.error)return alert(ins.error.message);if(entry_bonus_points>0)alert('Entras con '+entry_bonus_points+' puntos iniciales, igual que el ultimo clasificado.')}currentPool=res.data;currentCompetition=competitionOf(currentPool);tab='partidos';saveSession();await loadData()}

async function deletePool(id){
  if(currentUser?.role!=='admin') return alert('Solo el admin puede eliminar porras');

  const pool = pools.find(p=>String(p.id)===String(id));
  const name = pool?.name || 'esta porra';

  if(!confirm(`¿Eliminar la porra "${name}" definitivamente?

Se borrarán sus miembros, pronósticos y mensajes. Esta acción no se puede deshacer.`)) return;

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

async function leavePool(id){const pool=pools.find(p=>String(p.id)===String(id));const name=pool?.name||'esta porra';if(!confirm('Vas a salir de '+name+'.\\n\\nDejaras de verla en tu lista y tendras que volver a entrar con codigo si cambias de idea.\\n\\nQuieres salir de esta porra?'))return;await supabase.from('pool_members').delete().eq('pool_id',id).eq('user_id',currentUser.id);if(currentPool?.id===id)currentPool=null;tab='porras';saveSession();await loadData()}function matchesView(){if(currentUser?.role==='admin')return `<div class="card"><h2>Modo administrador</h2><p>Usa Resultados globales.</p></div>`;if(!currentPool)return poolsView();if(currentCompetition==='mix')return mixPredictionHtml();return `<div class="card"><h2>Mis pronosticos</h2>${isPoolCreator()?`<div class="notice compact-card"><b>Premios:</b><br>${safe(currentPool.prizes||'Sin premios escritos').replace(/\n/g,'<br>')}<br><button class="small yellow" onclick="window.editPoolPrizes('${currentPool.id}')">Cambiar premios</button></div>`:''}${currentCompetition==='liga'&&leagueTableOpenForMember(myMembership())?leagueTablePredictionHtml():''}${jokerEnabled()?`<div class="notice"><b>Joker:</b> te quedan ${jokerLimit()-jokerCount()} de ${jokerLimit()}.</div>`:''}${currentPool.enable_scorer?`<div class="notice"><b>Goleador:</b> acierto +2 puntos.</div>`:''}${currentPool.enable_mvp?`<div class="notice"><b>MVP:</b> acierto +2 puntos.</div>`:''}${currentPool.enable_sent_off?`<div class="notice"><b>Posible expulsion:</b> acierto +2 puntos.</div>`:''}${activeMatches().map(m=>{const p=pred(m.id),pt=p?pointsForPrediction(p,m):null,locked=isLocked(m),fieldsLocked=locked,jokerDisabled=fieldsLocked||!jokerEnabled()||(jokerUsed()&&!p?.is_joker);return `<div class="match"><span class="group">${safe(m.group_name)}</span><div class="teams">${teamName(m.home_team)} vs ${teamName(m.away_team)}</div><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><p><span class="badge ${locked?'closed':''}">${locked?'Partido iniciado':'Abierto'}</span><span class="badge">${p?'Guardado':'Sin guardar'}</span><span class="badge">${pt===null?'Pendiente':pt+' pts'}</span>${p?.is_joker?'<span class="badge-gold">Joker</span>':''}</p><div class="score compact-score"><div><label>${teamName(m.home_team)}</label>${scoreSelectHtml('ph_'+m.id,p?.pred_home,fieldsLocked)}</div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label>${scoreSelectHtml('pa_'+m.id,p?.pred_away,fieldsLocked)}</div></div>${jokerEnabled()?`<label style="display:block;margin:10px 0"><input type="checkbox" id="joker_${m.id}" ${p?.is_joker?'checked':''} ${jokerDisabled?'disabled':''}> Usar Joker</label>`:''}${scorerSelectHtml(m,p,fieldsLocked)}${mvpSelectHtml(m,p,fieldsLocked)}${sentOffSelectHtml(m,p,fieldsLocked)}${locked?`<p class="muted"><b>Partido iniciado:</b> no se puede modificar.</p>`:`<button class="small" onclick="window.savePrediction('${m.id}')">Guardar pronostico</button>`}<p class="muted">Resultado real: <b>${m.real_home===null?'Pendiente':m.real_home+' - '+m.real_away}</b></p>${locked?matchPoolPredictions(m.id):''}</div>`}).join('')}${podiumPredictionHtml()}${currentCompetition==='liga'?'':leagueTablePredictionHtml()}</div>`}
async function savePredictionRow(payload){const keys={pool_id:payload.pool_id,user_id:payload.user_id,match_id:payload.match_id};let res=await supabase.from('predictions').update(payload).eq('pool_id',keys.pool_id).eq('user_id',keys.user_id).eq('match_id',keys.match_id).select('id').maybeSingle();if(res.error&&!/0 rows|multiple/i.test(res.error.message||''))return res;if(res.data)return res;res=await supabase.from('predictions').insert(payload).select('id').single();if(res.error&&/duplicate key|unique/i.test(res.error.message||''))return await supabase.from('predictions').update(payload).eq('pool_id',keys.pool_id).eq('user_id',keys.user_id).eq('match_id',keys.match_id).select('id').maybeSingle();return res}
function matchPoolPredictions(mid){if(!currentPool)return'';const match=matches.find(x=>String(x.id)===String(mid));const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({user:u,prediction:poolPredictions().find(pr=>pr.user_id===u.id&&String(pr.match_id)===String(mid))}));return `<div class="notice compact-card"><h3>Pronosticos</h3>${rows.map(r=>{const pts=r.prediction&&match?pointsForPrediction(r.prediction,match):null;return `<div class="prediction-row"><div>${avatar(r.user)}<b>${safe(r.user.nick)}</b>${r.prediction?.is_joker?' <span class="mini-badge">J</span>':''}</div><div>${r.prediction?`<b>${r.prediction.pred_home}-${r.prediction.pred_away}</b>`:'<span class="muted">Sin pronostico</span>'}</div><div>${pts===null?'<span class="muted">-</span>':`<b>${pts} pts</b>`}</div>${r.prediction?.scorer_prediction||r.prediction?.mvp_prediction||r.prediction?.sent_off_prediction?`<div class="prediction-extra">${r.prediction?.scorer_prediction?`G: ${safe(r.prediction.scorer_prediction)} `:''}${r.prediction?.mvp_prediction?`MVP: ${safe(r.prediction.mvp_prediction)} `:''}${r.prediction?.sent_off_prediction?`R: ${safe(r.prediction.sent_off_prediction)}`:''}</div>`:''}</div>`}).join('')}</div>`}
async function copyPredictionToOtherPools(mid,data){if(!autoCopyEnabled()||!currentPool)return 0;const targetPools=pools.filter(p=>p.id!==currentPool.id&&competitionOf(p)===currentCompetition&&poolMembers.some(pm=>pm.pool_id===p.id&&pm.user_id===currentUser.id));let copied=0;for(const pool of targetPools){const payload={pool_id:pool.id,user_id:currentUser.id,match_id:mid,is_joker:false,pred_home:data.pred_home,pred_away:data.pred_away,scorer_prediction:pool.enable_scorer?data.scorer_prediction:null,mvp_prediction:pool.enable_mvp?data.mvp_prediction:null,sent_off_prediction:pool.enable_sent_off?data.sent_off_prediction:null};const res=await savePredictionRow(payload);if(!res.error)copied++}return copied}
async function savePrediction(mid){if(currentUser?.role==='admin')return alert('El admin no pronostica');if(!currentPool)return alert('Selecciona una porra');const m=matches.find(x=>String(x.id)===String(mid));if(!m)return;if(isLocked(m))return alert('Este partido ya ha empezado');const ph=scoreValue('ph_'+mid),pa=scoreValue('pa_'+mid);if(isNaN(ph)||isNaN(pa)||ph<0||pa<0)return alert('Pon resultado valido');const wants=!!document.querySelector('#joker_'+mid)?.checked;if(wants&&jokerUsed()&&!pred(mid)?.is_joker)return alert('Ya has usado tus '+jokerLimit()+' Jokers');const scorer=document.querySelector('#scorer_'+mid)?.value.trim()||null;const mvp=document.querySelector('#mvp_'+mid)?.value.trim()||null;const sent_off=document.querySelector('#sent_off_'+mid)?.value.trim()||null;const data={pool_id:currentPool.id,user_id:currentUser.id,match_id:mid,pred_home:ph,pred_away:pa,is_joker:wants,scorer_prediction:scorer,mvp_prediction:mvp,sent_off_prediction:sent_off};const res=await savePredictionRow(data);if(res.error)return alert(res.error.message);const copied=await copyPredictionToOtherPools(mid,data);await loadData();if(copied)alert('Pronostico guardado y copiado a '+copied+' porra(s).')}
function rulesView(){if(!currentPool)return poolsView();if(currentCompetition==='mix')return `<div class="card classification-card"><h2>Normas MIX</h2><div class="rule"><h3>Campeones</h3><p>Cada competicion tiene sus puntos junto al nombre. Cuando el admin ponga el campeon real, se suma automaticamente.</p></div><div class="rule"><h3>Sin calendario</h3><p>Esta porra no depende de partidos: es una lista larga de campeones de temporada.</p></div>${classificationTabs()}</div>`;return `<div class="card classification-card"><h2>Normas</h2><div class="rule"><h3>Exacto: 5 puntos</h3></div><div class="rule"><h3>Diferencia correcta: 3 puntos</h3></div><div class="rule"><h3>Signo: 2 puntos</h3></div><div class="rule"><h3>Bonus Anti-Copia</h3><p>Si aciertas exacto y pocos pusieron lo mismo: unico +3, dos iguales +2, tres iguales +1, cuatro o mas +0.</p></div><div class="rule"><h3>Pleno de jornada</h3><p>Si aciertas el signo de todos los partidos de una jornada de Liga, +20 puntos.</p></div>${currentCompetition==='liga'?'<div class="rule"><h3>Empate en una jornada</h3><p>Si dos o mas usuarios terminan una jornada con los mismos puntos, queda por delante quien tenga menos puntos en la clasificacion general en ese momento.</p></div><div class="rule"><h3>Clasificacion hipotetica de Liga</h3><p>Se guarda antes del primer partido. Por defecto es privada, pero el admin puede hacerla visible cuando quiera. Al final: campeon +20, segundo +15, tercero +10, cada puesto exacto del 4 al 20 suma +3 y cada descendido acertado entre tus 3 ultimos suma +5.</p></div>':''}<div class="rule"><h3>Joker</h3><p>${jokerEnabled()?jokerLimit()+' Jokers por usuario para toda la temporada. Puntuan doble.':'Desactivado.'}</p></div><div class="rule"><h3>Goleador</h3><p>${currentPool.enable_scorer?'Si aciertas un goleador, +2 puntos. Dejarlo vacio da 0 puntos, salvo 0-0 con sin goleador.':'Desactivado.'}</p></div><div class="rule"><h3>MVP</h3><p>${currentPool.enable_mvp?'Si aciertas el MVP del partido, +2 puntos.':'Desactivado.'}</p></div><div class="rule"><h3>Posible expulsion</h3><p>${currentPool.enable_sent_off?'Si eliges y aciertas el jugador expulsado, +2 puntos. No apostar da 0 puntos.':'Desactivado.'}</p></div>${classificationTabs()}</div>`}
function userStats(u){let total=0,exact=0,diff=0,sg=0,played=0,jokers=0,scorersOk=0,mvpsOk=0,sentOffsOk=0,antiCopy=0;predictions.filter(p=>p.user_id===u.id&&p.pool_id===currentPool?.id).forEach(p=>{const m=matches.find(x=>String(x.id)===String(p.match_id));if(!m)return;const pts=pointsForPrediction(p,m);if(pts===null)return;total+=pts;played++;if(p.is_joker)jokers++;antiCopy+=antiCopyBonus(p,m);if(scorerPoints(p,m)>0)scorersOk++;if(mvpPoints(p,m)>0)mvpsOk++;if(sentOffPoints(p,m)>0)sentOffsOk++;const b=basePoints(p.pred_home,p.pred_away,m.real_home,m.real_away);if(b===5)exact++;else if(b===3)diff++;else if(b===2)sg++});const pm=poolMembers.find(pm=>pm.user_id===u.id&&pm.pool_id===currentPool?.id);const podium=podiumPointsForMember(pm),leagueTable=leagueTablePointsForMember(pm),perfectRounds=perfectRoundPointsForUser(u),mix=mixPointsForMember(pm),entryBonus=entryBonusForMember(pm);total+=podium+leagueTable+perfectRounds+mix+entryBonus;return{total,exact,diff,sg,played,jokers,scorersOk,mvpsOk,sentOffsOk,podium,antiCopy,leagueTable,perfectRounds,mix,entryBonus}}
function roundOrderKey(name){const n=String(name||'').match(/(\d+)/);return n?Number(n[1]):9999}
function competitionRounds(){const map=new Map();matches.filter(m=>competitionOf(m)===currentCompetition).forEach(m=>{const key=matchdayKey(m);if(!map.has(key))map.set(key,[]);map.get(key).push(m)});return Array.from(map.entries()).map(([key,ms])=>({key,matches:ms.sort((a,b)=>new Date(a.match_date)-new Date(b.match_date)),finished:ms.length>0&&ms.every(m=>m.real_home!==null&&m.real_away!==null),firstDate:Math.min(...ms.map(m=>new Date(m.match_date).getTime()||0))})).sort((a,b)=>roundOrderKey(a.key)-roundOrderKey(b.key)||a.firstDate-b.firstDate)}
function roundPredictionPointsForUser(u,round){return round.matches.reduce((sum,m)=>{const p=poolPredictions().find(pr=>pr.user_id===u.id&&String(pr.match_id)===String(m.id));const pts=p?pointsForPrediction(p,m):null;return sum+(pts||0)},0)}
function roundPerfectBonusForUser(u,round){if(currentCompetition!=='liga'||!round.finished)return 0;const ok=round.matches.every(m=>{const p=poolPredictions().find(pr=>pr.user_id===u.id&&String(pr.match_id)===String(m.id));return p&&sign(p.pred_home,p.pred_away)===sign(m.real_home,m.real_away)});return ok?20:0}
function jornadaRows(){const usersInPool=poolUsers().filter(u=>u.role!=='admin');const totals=new Map(usersInPool.map(u=>[u.id,entryBonusForMember(poolMembers.find(pm=>pm.user_id===u.id&&pm.pool_id===currentPool?.id))]));return competitionRounds().filter(r=>r.finished).map(round=>{const rows=usersInPool.map(u=>{const roundPts=roundPredictionPointsForUser(u,round)+roundPerfectBonusForUser(u,round);const total=(totals.get(u.id)||0)+roundPts;totals.set(u.id,total);return{u,roundPts,total}}).sort((a,b)=>b.roundPts-a.roundPts||a.total-b.total||String(a.u.nick).localeCompare(String(b.u.nick)));return{round,rows}})}
function jornadasGeneralRows(rounds){const usersInPool=poolUsers().filter(u=>u.role!=='admin');return usersInPool.map(u=>{const total=rounds.reduce((sum,item)=>{const row=item.rows.find(r=>r.u.id===u.id);return sum+(row?.roundPts||0)},entryBonusForMember(poolMembers.find(pm=>pm.user_id===u.id&&pm.pool_id===currentPool?.id)));return{u,total}}).sort((a,b)=>b.total-a.total||String(a.u.nick).localeCompare(String(b.u.nick)))}
function roundShortLabel(key){const n=String(key||'').match(/(\d+)/);return n?'J'+Number(n[1]):String(key||'Jornada')}
function setRoundTab(key){selectedRoundKey=String(key||'');render()}
function roundMoneyRules(){const raw=currentPool?.round_money_rules;if(Array.isArray(raw))return raw;if(!raw)return[];try{const parsed=typeof raw==='string'?JSON.parse(raw):raw;return Array.isArray(parsed)?parsed:[]}catch(e){return[]}}
function moneyFmt(value){const n=Number(value||0);return (n>0?'+':'')+n.toFixed(2).replace('.',',')+' EUR'}
function moneyRuleAmount(position){const found=roundMoneyRules().find(r=>Number(r.position)===Number(position));return Number(found?.amount||0)}
function roundMoneyForIndex(index,totalRows){let amount=0;roundMoneyRules().forEach(rule=>{const pos=Number(rule.position),value=Number(rule.amount||0);if(!pos||!value)return;const target=pos>0?pos:totalRows+pos+1;if(index+1===target)amount+=value});return amount}
function moneyLedger(){const usersInPool=poolUsers().filter(u=>u.role!=='admin');const balances=new Map(usersInPool.map(u=>[u.id,0]));const byRound=new Map();jornadaRows().forEach(item=>{const rows=item.rows.map((r,i)=>{const roundMoney=roundMoneyForIndex(i,item.rows.length);const balance=(balances.get(r.u.id)||0)+roundMoney;balances.set(r.u.id,balance);return{...r,roundMoney,balance}});byRound.set(item.round.key,rows)});const totals=usersInPool.map(u=>({u,balance:balances.get(u.id)||0})).sort((a,b)=>b.balance-a.balance||String(a.u.nick).localeCompare(String(b.u.nick)));const bank=-(totals.reduce((sum,r)=>sum+r.balance,0));return{byRound,totals,bank}}
function roundMoneySettingsHtml(){if(!currentPool)return'';const rules=roundMoneyRules();const summary=rules.length?rules.map(r=>{const pos=Number(r.position);return (pos>0?pos+'º':pos===-1?'Ultimo':Math.abs(pos)+'º por la cola')+': '+moneyFmt(r.amount)}).join(' · '):'Sin premios ni sanciones por jornada';return `<div class="notice compact-card"><b>Premios/sanciones por jornada:</b><br>${safe(summary)}${isPoolCreator()?`<br><button class="small yellow" onclick="window.editRoundMoneyRules()">Configurar dinero por jornada</button>`:''}</div>`}
function moneyLedgerHtml(ledger){if(!ledger.totals.length)return'';const bankLine=Math.abs(ledger.bank||0)>0.004?`<div class="bank-row"><span><b>BANCO</b></span><b class="${ledger.bank>=0?'money-good':'money-bad'}">${moneyFmt(ledger.bank)}</b></div>`:'';return `<div class="notice compact-card money-ledger"><h3>Cuenta acumulada</h3>${ledger.totals.map(r=>`<div><span>${avatar(r.u)}<b>${safe(r.u.nick)}</b></span><b class="${r.balance>=0?'money-good':'money-bad'}">${moneyFmt(r.balance)}</b></div>`).join('')}${bankLine}</div>`}
function userStreak(u){const recent=predictions.filter(p=>p.user_id===u.id&&p.pool_id===currentPool?.id).map(p=>{const m=matches.find(x=>String(x.id)===String(p.match_id));return{m,pts:m?pointsForPrediction(p,m):null}}).filter(x=>x.pts!==null).sort((a,b)=>new Date(b.m.match_date)-new Date(a.m.match_date));if(!recent.length)return{type:'',count:0};const positive=recent[0].pts>0;let count=0;for(const x of recent){if((x.pts>0)!==positive)break;count++}return{type:positive?'positive':'negative',count}}
function tauntPick(list,r,salt=''){if(!list.length)return'';const key=String(r?.u?.id||r?.u?.nick||'')+salt;let n=0;for(let i=0;i<key.length;i++)n=(n*31+key.charCodeAt(i))>>>0;return list[n%list.length]}
function tauntHtml(kind,text){return `<span class="taunt ${kind}">${safe(text)}</span>`}
function rankingTags(r,i,totalRows){
  const tags=[];
  const leader=['Lider con pinta de haber estudiado','Va primero y ya se cree director deportivo','Ahora mismo manda y molesta bastante','Se ha subido al trono sin pedir permiso','Liderato con olor a provocacion'];
  const second=['A un tropiezo de dar el golpe','Pegado arriba, esperando la caida','Segundo, que suena bien hasta que miras al primero','Ahi arriba, metiendo presion sin hacer ruido'];
  const third=['Zona noble, pero sin sacar pecho todavia','Tercero: ni gloria ni desastre, de momento','En podio, sobreviviendo con estilo','Arriba, pero no tanto como para hablar fuerte'];
  const bottom=['Ultimo y con el suelo pidiendo explicaciones','La clasificacion termina aqui por culpa suya','Cerrando la tabla como si fuera un candado','Ahora mismo es el ejemplo que nadie pidio','Su estrategia parece escrita en una servilleta mojada'];
  const penult=['Penultimo: todavia respira, pero poco','Mirando al ultimo y diciendo: casi soy yo','Zona de peligro con las luces encendidas','A una mala jornada del drama completo'];
  const zero=['Cero puntos: ni el Excel le encuentra defensa','Sigue a cero, pero con una fe absurda','No suma ni por accidente administrativo','Tiene menos puntos que excusas disponibles'];
  const exact=['Marcadores exactos con mano de cirujano','Esta afinando demasiado, sospechoso','Cuando acierta exacto duele al resto','Tiene el modo francotirador activado'];
  const podium=['Vio el podio antes que los demas','Ahi saco la bola de cristal y funciono','Podio leido con una sangre fria insultante'];
  const hot=['Racha caliente: que alguien revise esa calculadora','Viene lanzado y empieza a dar rabia','Esta puntuando tanto que ya cae mal','Ahora mismo todo le rebota a favor'];
  const cold=['Racha negra: el boton de sumar no le carga','Viene coleccionando ceros con disciplina militar','No puntua ni aunque el partido le deje pistas','Esta convirtiendo el fallo en una rutina'];
  if(r.played>0&&totalRows>1&&i===0)tags.push(tauntHtml('good',tauntPick(leader,r,'leader')));
  if(r.played>0&&totalRows>1&&i===1)tags.push(tauntHtml('good',tauntPick(second,r,'second')));
  if(r.played>0&&totalRows>2&&i===2)tags.push(tauntHtml('good',tauntPick(third,r,'third')));
  if(r.played>0&&totalRows>1&&i===totalRows-1)tags.push(tauntHtml('bad',tauntPick(bottom,r,'bottom')));
  if(r.played>0&&totalRows>2&&i===totalRows-2)tags.push(tauntHtml('bad',tauntPick(penult,r,'penult')));
  if(r.played>0&&r.total===0)tags.push(tauntHtml('bad',tauntPick(zero,r,'zero')));
  if(r.exact>=3)tags.push(tauntHtml('good',tauntPick(exact,r,'exact')));
  if(r.podium>=20)tags.push(tauntHtml('good',tauntPick(podium,r,'podium')));
  const streak=userStreak(r.u);
  if(streak.count>=3&&streak.type==='positive')tags.push(tauntHtml('good',tauntPick(hot,r,'hot')+' · '+streak.count+' seguidos'));
  if(streak.count>=3&&streak.type==='negative')tags.push(tauntHtml('bad',tauntPick(cold,r,'cold')+' · '+streak.count+' ceros'));
  return tags.length?`<div class="taunts">${tags.join('')}</div>`:''
}
function classificationTabs(){const mine=currentCompetition==='liga'&&leagueStarted()?`<button class="${tab==='mi_pronostico'?'active':''}" onclick="window.setTab('mi_pronostico')">Mi pronostico</button>`:'';return `<div class="section-tabs"><button class="${tab==='clasificacion'?'active':''}" onclick="window.setTab('clasificacion')">Clasificacion</button><button class="${tab==='jornadas'?'active':''}" onclick="window.setTab('jornadas')">Jornadas</button>${mine}<button class="${tab==='normas'?'active':''}" onclick="window.setTab('normas')">Normas</button><button class="${tab==='estadisticas'?'active':''}" onclick="window.setTab('estadisticas')">Estadisticas</button><button class="${tab==='historial'?'active':''}" onclick="window.setTab('historial')">Historial</button></div>`}
function rankingView(){if(!currentPool)return poolsView();const rows=poolUsers().filter(u=>u.role!=='admin').map(u=>({u,...userStats(u)})).sort((a,b)=>b.total-a.total||b.exact-a.exact);return `<div class="card classification-card"><h2>Clasificacion</h2><div class="ranking-list">${rows.map((r,i)=>`<div class="ranking compact-ranking"><div>${i+1}</div><div>${avatar(r.u)} <b>${safe(r.u.nick)}</b>${rankingTags(r,i,rows.length)}<span class="muted">Ex ${r.exact} ? Dif ${r.diff} ? Sig ${r.sg} ? J ${r.jokers} ? G ${r.scorersOk} ? MVP ${r.mvpsOk} ? R ${r.sentOffsOk} ? Podio ${r.podium} · Anti ${r.antiCopy} · Pleno ${r.perfectRounds} · Liga ${r.leagueTable}</span></div><div><b>${r.total}</b><br><span class="muted">pts</span></div></div>`).join('')||'<p class="muted">Sin participantes.</p>'}</div>${classificationTabs()}</div>`}
function myLeaguePredictionView(){if(!currentPool)return poolsView();if(currentCompetition!=='liga')return rankingView();const pm=myMembership();const pick=parseLeaguePick(pm);return `<div class="card classification-card"><h2>Mi pronostico</h2>${leagueTableOpenForMember(pm)?'<div class="notice"><b>Todavia puedes modificarla en Pendientes.</b></div>':'<div class="notice"><b>Clasificacion guardada.</b> Ya no se puede modificar.</div>'}${pick.length?`<div class="league-pick-list">${pick.map((t,i)=>`<div><b>${i+1}</b><span>${safe(t)}</span></div>`).join('')}</div>`:'<p class="muted">Aun no has guardado tu clasificacion.</p>'}${classificationTabs()}</div>`}
function jornadasView(){if(!currentPool)return poolsView();const rounds=jornadaRows();const ledger=moneyLedger();const allRounds=Array.from({length:currentCompetition==='liga'?38:Math.max(rounds.length,1)},(_,i)=>rounds.find(r=>roundOrderKey(r.round.key)===i+1)||{round:{key:'Jornada '+(i+1)},rows:[],pending:true});const selected=selectedRoundKey?allRounds.find(r=>r.round.key===selectedRoundKey):[...allRounds].reverse().find(r=>r.rows.length)||allRounds[0];if(selected)selectedRoundKey=selected.round.key;const rows=selected?(ledger.byRound.get(selected.round.key)||selected.rows):[];const best=[...rows].sort((a,b)=>b.roundPts-a.roundPts||a.total-b.total)[0];const worst=[...rows].sort((a,b)=>a.roundPts-b.roundPts||b.total-a.total)[0];const general=jornadasGeneralRows(rounds);return `<div class="card classification-card"><h2>Jornadas</h2><p class="muted">General acumulada y detalle de cada jornada.</p>${roundMoneySettingsHtml()}${moneyLedgerHtml(ledger)}<div class="round-standing general-standing"><h3>General acumulada</h3>${general.map((r,i)=>`<div class="round-row general-round-row"><div><b>${i+1}</b></div><div>${avatar(r.u)}<b>${safe(r.u.nick)}</b></div><div><span>${r.total}</span><small>total</small></div></div>`).join('')||'<p class="muted">Sin participantes.</p>'}</div><div class="round-tab-grid">${allRounds.map(item=>`<button class="${item.round.key===selectedRoundKey?'active':''} ${item.rows.length?'':'pending'}" onclick="window.setRoundTab('${safe(item.round.key)}')">${safe(roundShortLabel(item.round.key))}</button>`).join('')}</div>${selected?`<div class="round-standing"><h3>${safe(selected.round.key)}</h3>${rows.length?`<div class="round-awards"><span>Mejor: <b>${safe(best?.u?.nick||'-')} +${best?.roundPts??0}</b></span><span>Peor: <b>${safe(worst?.u?.nick||'-')} +${worst?.roundPts??0}</b></span></div>${rows.map((r,i)=>`<div class="round-row money-round-row"><div><b>${i+1}</b></div><div>${avatar(r.u)}<b>${safe(r.u.nick)}</b></div><div><span>+${r.roundPts}</span><small>jornada</small></div><div><span>${r.total}</span><small>total</small></div><div><span class="${(r.balance||0)>=0?'money-good':'money-bad'}">${moneyFmt(r.balance||0)}</span><small>dinero</small></div></div>`).join('')}`:'<p class="muted">Esta jornada aun no esta cerrada.</p>'}</div>`:''}${classificationTabs()}</div>`}
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
function archiveView(){if(currentCompetition==='mix')return `<div class="card"><h2>Completados MIX</h2>${mixSummaryHtml()}<p class="muted">Aqui no hay partidos completados; los puntos entran cuando el admin pone campeones reales.</p></div>`;const list=archivedMatches();return `<div class="card"><h2>Partidos completados</h2>${list.map(m=>`<div class="match"><span class="group">${safe(m.group_name)}</span><div class="teams">${teamName(m.home_team)} vs ${teamName(m.away_team)}</div><p>Resultado: <b>${m.real_home===null?'Pendiente':m.real_home+' - '+m.real_away}</b></p>${currentPool?matchPoolPredictions(m.id):''}</div>`).join('')||'<p class="muted">Sin partidos completados.</p>'}</div>`}
async function ensureAdminAuthSession(){
  if(currentUser?.role!=='admin')return null;
  const email=cleanLoginValue(currentUser.email);
  if(!email||!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)){
    alert('El admin necesita un email valido guardado.');
    return null;
  }
  const existing=await supabase.auth.getSession();
  const session=existing.data?.session;
  if(session?.access_token&&String(session.user?.email||'').toLowerCase()===email.toLowerCase())return session;
  const pass=prompt('Contraseña del admin para activar Usuarios:');
  if(!pass)return null;
  let sign=await supabase.auth.signInWithPassword({email,password:pass});
  if(sign.data?.session)return sign.data.session;
  const up=await supabase.auth.signUp({email,password:pass,options:{emailRedirectTo:location.origin}});
  if(up.error&&!/already|registered|exists|confirm/i.test(up.error.message||'')){
    alert(up.error.message);
    return null;
  }
  if(up.data?.session)return up.data.session;
  alert('He preparado el acceso seguro. Revisa el correo de '+email+' y confirma el enlace. Luego vuelve a entrar como admin y pulsa Usuarios otra vez.');
  return null;
}
async function adminUsersRequest(action,payload={}){
  const session=await ensureAdminAuthSession();
  if(!session)return null;
  const res=await fetch(`${SUPABASE_URL}/functions/v1/admin-users`,{
    method:'POST',
    headers:{'Content-Type':'application/json','Authorization':'Bearer '+session.access_token,'apikey':SUPABASE_ANON_KEY},
    body:JSON.stringify({action,...payload})
  });
  const data=await res.json().catch(()=>({error:'Respuesta no valida'}));
  if(!res.ok||data.error)throw new Error(data.error||'Error de admin');
  return data;
}
async function loadAdminUsers(){
  try{
    const data=await adminUsersRequest('list');
    if(!data)return;
    adminUsersCache={loaded:true,users:data.users||[],deleted:data.deleted||[],error:''};
    render();
  }catch(e){adminUsersCache={...adminUsersCache,error:e.message||String(e)};render()}
}
async function adminResetUserPassword(userId){
  const target=(adminUsersCache.users||[]).find(u=>String(u.id)===String(userId))||users.find(u=>String(u.id)===String(userId));
  if(!target)return alert('Usuario no encontrado');
  if(!confirm('Poner contraseña 123456 a '+target.nick+'?'))return;
  try{await adminUsersRequest('reset_password',{userId,newPassword:'123456'});await loadAdminUsers();alert('Contraseña de '+target.nick+' cambiada a 123456')}catch(e){alert(e.message||String(e))}
}
async function adminRestoreUser(userId){
  const target=(adminUsersCache.deleted||[]).find(u=>String(u.id)===String(userId));
  if(!target)return alert('Usuario eliminado no encontrado');
  if(!confirm('Recuperar '+target.nick+' con contraseña 123456?'))return;
  try{await adminUsersRequest('restore_user',{userId,newPassword:'123456'});await loadData(false);await loadAdminUsers();alert('Usuario '+target.nick+' recuperado con contraseña 123456')}catch(e){alert(e.message||String(e))}
}
function createdPoolsCount(userId){return pools.filter(p=>String(p.created_by)===String(userId)).length}
async function adminDeleteUser(userId){
  const target=(adminUsersCache.users||[]).find(u=>String(u.id)===String(userId))||users.find(u=>String(u.id)===String(userId));
  if(!target)return alert('Usuario no encontrado');
  if(target.role==='admin')return alert('No se puede eliminar al admin');
  const created=createdPoolsCount(target.id);
  const confirmText='ELIMINAR '+target.nick;
  const warning='Vas a eliminar completamente a '+target.nick+'.\n\nSe borraran sus pronosticos, mensajes, participaciones y no aparecera como recuperable. '+(created?'\n\nATENCION: tambien creo '+created+' porra(s), y esas porras se borraran con sus datos. ':'')+'\n\nPara confirmar escribe exactamente:\n'+confirmText;
  if(prompt(warning)!==confirmText)return alert('Eliminacion cancelada');
  try{
    const session=await ensureAdminAuthSession();
    if(!session)return;
    const {data,error}=await supabase.rpc('admin_delete_profile',{target_user_id:userId,confirm_text:confirmText});
    if(error)throw error;
    await loadData(false);
    await loadAdminUsers();
    alert('Usuario '+(data?.nick||target.nick)+' eliminado completamente');
  }catch(e){alert(e.message||String(e))}
}
function adminUsersView(){
  if(currentUser?.role!=='admin')return `<div class="card"><h2>Acceso no permitido</h2></div>`;
  const loaded=adminUsersCache.loaded;
  const userRows=adminUsersCache.users||[];
  const deletedRows=adminUsersCache.deleted||[];
  return `<div class="card classification-card"><h2>Usuarios</h2><p class="muted">Desde aqui puedes poner la contraseña <b>123456</b>, recuperar usuarios eliminados y eliminar usuarios completamente.</p><button class="yellow" onclick="window.loadAdminUsers()">${loaded?'Actualizar usuarios':'Cargar usuarios'}</button>${adminUsersCache.error?`<div class="notice"><b>Error:</b> ${safe(adminUsersCache.error)}</div>`:''}${loaded?`<h3>Registrados</h3>${userRows.map(u=>{const created=createdPoolsCount(u.id);return `<div class="prediction-row"><div>${avatar(u)}<b>${safe(u.nick)}</b><br><span class="muted">${safe(u.email||'Sin email')}</span></div><div>${safe(u.role||'user')}${created?`<br><span class="muted">${created} porra(s) creadas</span>`:''}</div><div>${u.role==='admin'?'<span class="muted">Admin</span>':`<button class="small yellow" onclick="window.adminResetUserPassword('${u.id}')">Poner 123456</button><button class="small red" onclick="window.adminDeleteUser('${u.id}')">Eliminar</button>`}</div></div>`}).join('')||'<p class="muted">No hay usuarios.</p>'}<h3>Eliminados recuperables</h3>${deletedRows.map(u=>`<div class="prediction-row"><div>${avatar(u)}<b>${safe(u.nick)}</b><br><span class="muted">${safe(u.email||'Sin email')}</span></div><div>${u.deleted_at?new Date(u.deleted_at).toLocaleString('es-ES'):''}</div><div><button class="small yellow" onclick="window.adminRestoreUser('${u.id}')">Recuperar</button></div></div>`).join('')||'<p class="muted">No hay usuarios eliminados guardados.</p>'}`:''}</div>`;
}
function globalResultsView(){if(currentUser?.role!=='admin')return `<div class="card"><h2>Acceso no permitido</h2></div>`;const list=activeMatches();const renderMatch=m=>`<div class="adminrow"><b>${safe(m.group_name)} · ${teamName(m.home_team)} vs ${teamName(m.away_team)}</b><div class="muted">${new Date(m.match_date).toLocaleString('es-ES')}</div><div class="score"><div><label>${teamName(m.home_team)}</label><input type="number" min="0" id="grh_${m.id}" value="${m.real_home??''}"></div><div style="font-weight:900;padding-bottom:17px">-</div><div><label>${teamName(m.away_team)}</label><input type="number" min="0" id="gra_${m.id}" value="${m.real_away??''}"></div></div>${advanceSelectHtml(m)}${realScorersHtml(m)}${realMvpHtml(m)}${realSentOffHtml(m)}<button class="small" onclick="window.saveGlobalReal('${m.id}')">Guardar resultado global</button><button class="small red" onclick="window.resetGlobalReal('${m.id}')">Reset</button></div>`;return `<div class="card"><h2>⚽ Resultados globales</h2>${list.map(renderMatch).join('')}</div>`}
async function saveGlobalReal(mid){const rh=parseInt(document.querySelector('#grh_'+mid).value,10),ra=parseInt(document.querySelector('#gra_'+mid).value,10);if(isNaN(rh)||isNaN(ra)||rh<0||ra<0)return alert('Pon resultado valido');const advance=document.querySelector('#adv_'+mid)?.value||null;if(KNOCKOUT_LINKS[String(mid)]&&rh===ra&&!advance)return alert('Hay empate: elige quien pasa la eliminatoria.');const data={real_home:rh,real_away:ra,real_scorers:selectedRealScorers(mid),real_mvp:selectedRealMvp(mid),real_sent_off:selectedRealSentOff(mid),advance_team:advance,result_updated_at:new Date().toISOString()};let res=await supabase.from('matches').update(data).eq('id',mid);if(res.error&&/result_updated_at|advance_team|schema cache|column/i.test(res.error.message||'')){const fallback={...data};delete fallback.result_updated_at;delete fallback.advance_team;res=await supabase.from('matches').update(fallback).eq('id',mid)}if(res.error)return alert(res.error.message);let propagated=0;try{propagated=await propagateKnockoutNames(mid,data)}catch(e){await loadData();return alert('Resultado guardado, pero no pude actualizar el siguiente cruce: '+(e.message||e))}await loadData();alert(propagated?'Resultado guardado y cuadro actualizado':'Resultado guardado')}async function resetGlobalReal(mid){if(!confirm('¿Borrar resultado?'))return;let res=await supabase.from('matches').update({real_home:null,real_away:null,real_scorers:'',real_mvp:'',real_sent_off:null,advance_team:null}).eq('id',mid);if(res.error&&/advance_team|schema cache|column/i.test(res.error.message||''))res=await supabase.from('matches').update({real_home:null,real_away:null,real_scorers:'',real_mvp:'',real_sent_off:null}).eq('id',mid);if(res.error)return alert(res.error.message);await loadData()}function adminView(){if(currentUser?.role!=='admin')return `<div class="card"><h2>Acceso no permitido</h2></div>`;if(!currentPool)return poolsView();return `${adminPodiumHtml()}${adminMixHtml()}${adminLeagueTableVisibilityHtml()}<div class="card"><h2>Admin ? ${safe(currentPool.name)}</h2><button class="yellow" onclick="window.updatePoolSettings()">Joker / Goleador / Premios</button><h3>Participantes</h3>${poolUsers().map(u=>`<p>${avatar(u)} ${safe(u.nick)} ${u.role==='admin'?'(admin)':''}</p>`).join('')}</div>`}
async function updatePoolSettings(){if(currentUser?.role!=='admin')return alert('Solo el admin puede cambiar estos parametros');if(!currentPool)return;const isLiga=competitionOf(currentPool)==='liga',isMix=competitionOf(currentPool)==='mix';const enable_joker=isLiga?true:(isMix?false:confirm('Activar Joker?'));const enable_scorer=isLiga||isMix?false:confirm('Activar goleador?');const enable_mvp=isLiga||isMix?false:confirm('Activar MVP del partido?');const enable_sent_off=isLiga||isMix?false:confirm('Activar posible expulsion?');const prizes=prompt('Premios:',currentPool.prizes||'')||'';await supabase.from('pools').update({enable_joker,enable_scorer,enable_mvp,enable_sent_off,prizes}).eq('id',currentPool.id);await loadData()}
function adminLeagueTableVisibilityHtml(){if(!currentPool||competitionOf(currentPool)!=='liga')return'';return `<div class="card"><h2>Clasificacion de Liga</h2><p class="muted">Ahora esta <b>${leagueTablePublic()?'VISIBLE':'PRIVADA'}</b> para los usuarios.</p><button class="yellow" onclick="window.toggleLeagueTableVisibility()">${leagueTablePublic()?'Ocultar clasificaciones':'Hacer visibles las clasificaciones'}</button></div>`}
async function toggleLeagueTableVisibility(){if(currentUser?.role!=='admin'||!currentPool)return alert('Solo admin');const next=!leagueTablePublic();const res=await supabase.from('pools').update({league_table_public:next}).eq('id',currentPool.id);if(res.error)return alert(res.error.message+' - Si falta la columna, ejecuta add-liga-table-visibility.sql en Supabase.');await loadData();alert(next?'Clasificaciones visibles':'Clasificaciones privadas')}
async function saveProfile(){const av=prompt('Emoji avatar:',currentUser.avatar||':)');if(!av)return;await supabase.from('profiles').update({avatar:av}).eq('id',currentUser.id);await loadData()}
async function toggleAutoCopyPredictions(){if(!currentUser||currentUser.role==='admin')return;const next=!autoCopyEnabled();setLocalAutoCopy(next);if(Object.prototype.hasOwnProperty.call(currentUser,'auto_copy_predictions')){const res=await supabase.from('profiles').update({auto_copy_predictions:next}).eq('id',currentUser.id);if(res.error&&!/auto_copy_predictions|schema cache|column/i.test(res.error.message||''))return alert(res.error.message);currentUser={...currentUser,auto_copy_predictions:next}}await loadData();alert(next?'Autocopia activada':'Autocopia desactivada')}
async function changePassword(){if(!currentUser)return alert('Inicia sesión');const current=prompt('Contraseña actual:');if(!current)return;const check=await supabase.from('profiles').select('id').eq('id',currentUser.id).eq('password',current).maybeSingle();if(!check.data)return alert('La contraseña actual no es correcta');const next=prompt('Nueva contraseña:');if(!next||next.length<4)return alert('La nueva contraseña debe tener al menos 4 caracteres');const repeat=prompt('Repite la nueva contraseña:');if(next!==repeat)return alert('Las contraseñas no coinciden');const res=await supabase.from('profiles').update({password:next}).eq('id',currentUser.id);if(res.error)return alert(res.error.message);alert('Contraseña cambiada. Vuelve a entrar con la nueva.');logout()}
function render(){document.title='MI PORRA';if(!currentUser){app.innerHTML=loginView();return}let content='';try{content=tab==='porras'?poolsView():tab==='partidos'?matchesView():tab==='normas'?rulesView():tab==='clasificacion'?rankingView():tab==='mi_pronostico'?myLeaguePredictionView():tab==='jornadas'?jornadasView():tab==='estadisticas'?statsView():tab==='chat'?chatView():tab==='historial'?historyView():tab==='archivo'?archiveView():tab==='usuarios'?adminUsersView():tab==='resultados'?globalResultsView():tab==='admin'?adminView():poolsView()}catch(e){console.error(e);content=`<div class="card"><h2>Error</h2><p>${safe(e.message)}</p><button onclick="window.setTab('porras')">Volver</button></div>`}app.innerHTML=`<div class="app has-bottom-nav">${tabs()}<main class="screen">${content}</main>${podiumReminderHtml()}</div>`}
Object.assign(window,{login,register,logout,setTab,setRoundTab,changePool,setCompetition,selectPool,createPool,joinPool,leavePool,deletePool,savePrediction,saveGlobalReal,resetGlobalReal,updatePoolSettings,editPoolPrizes,saveProfile,toggleAutoCopyPredictions,changePassword,loadAdminUsers,adminResetUserPassword,adminRestoreUser,adminDeleteUser,sendMessage,refreshChat,savePodiumPrediction,saveRealPodium,saveLeagueTablePrediction,refreshLeagueTableSelects,toggleLeagueTableVisibility,editRoundMoneyRules,showPodiumNow,saveMixPrediction,saveMixResults})
document.title='MI PORRA';restoreSession().then(ok=>{if(!ok)loadData()})

