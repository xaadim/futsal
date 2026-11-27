const TM={jaune:'Jaune',orange:'Orange',vert:'Vert',bleu:'Bleu'},ALL=['jaune','orange','vert','bleu'];
const $=s=>document.querySelector(s);


const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(){try{return JSON.parse(localStorage.getItem('futsal-v1'))}catch(e){return null}}
function save(){try{localStorage.setItem('futsal-v1',JSON.stringify(S))}catch(e){}}
let S=Object.assign({dur:390,cur:{a:'jaune',b:'orange',sa:0,sb:0},pending:[],setup:{teams:['jaune','orange','vert'],assign:{}},me:null,cache:null},load()||{});
if(!S.setup||!S.setup.teams)S.setup={teams:['jaune','orange','vert'],assign:{}};
if(S.setup.teams.length>3)S.setup.teams=S.setup.teams.slice(0,3);
if(!S.cur.goals)S.cur.goals=[];
let T,iv,wl,YR,R=[],M=[],SA=[],PL=[],USERS=[],LAUNDRY=null,LOADED=false,MODE='none',prev='',VER=0,busy=false,lastLive='',pushing=false,dirty=false,lastBoard='',lastBan='',lastSetup='',lastAdm='',NEWCODE=null,PICK=null,IMPORTED=null,hostLiveKey='';
let ME=S.me,SESS=(ME&&S.cache&&S.cache.host_user===ME.id)?S.cache:null,TEAMS=S.setup.teams,CAN_IMPORT_SUPABASE=false,LEVEL_CHANGES={},LEVEL_TAPS=new WeakMap();
const isHost=()=>!!(SESS&&ME&&SESS.host_user===ME.id),isAdmin=()=>!!(ME&&ME.role==='admin');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dt=m=>m.date||today(),sg=v=>(v>0?'+':'')+v;
const nSess=()=>SESS?M.filter(m=>m.session_id===SESS.id).length:0;
const fmt=s=>{s=Math.ceil(s);return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')};

/* ---- son ---- */
let ac;
function au(){if(!ac)ac=new(window.AudioContext||window.webkitAudioContext)();if(ac.state==='suspended')ac.resume();return ac}
function tone(f,t0,d,type,v){const c=au(),o=c.createOscillator(),g=c.createGain(),s=c.currentTime+t0;
  o.type=type;o.frequency.value=f;o.connect(g);g.connect(c.destination);
  g.gain.setValueAtTime(.0001,s);g.gain.exponentialRampToValueAtTime(v,s+.01);
  g.gain.setValueAtTime(v,s+d-.06);g.gain.exponentialRampToValueAtTime(.0001,s+d);o.start(s);o.stop(s+d+.02)}
function halfBeep(){[0,.35,.7].forEach(t=>tone(1050,t,.2,'square',.45));navigator.vibrate&&navigator.vibrate([200,100,200])}
function endBuzz(){for(let i=0;i<3;i++){const t=i*1.3;tone(220,t,1.05,'sawtooth',.6);tone(224,t,1.05,'sawtooth',.6);tone(440,t,1.05,'square',.3)}
  navigator.vibrate&&navigator.vibrate([500,150,500,150,900])}

/* ---- chrono (géré par l'organisateur de la session) ---- */
function saveT(){S.timer=(SESS&&isHost())?{sid:SESS.id,run:T.run,end:T.end,rem:T.rem,half:T.half,done:T.done,started:T.started}:null;save()}
function rst(){clearInterval(iv);T={run:false,rem:S.dur,end:0,half:false,done:false,started:false,hb:0};saveT();drawT();renderRank();pushLive(true)}
function restoreT(){const t=S.timer;
  if(MODE==='host'&&t&&SESS&&t.sid===SESS.id){clearInterval(iv);T={run:false,rem:t.rem,end:0,half:!!t.half,done:!!t.done,started:!!t.started,hb:0};
    if(t.run){const rem=(t.end-Date.now())/1000;
      if(rem>0){T.run=true;T.end=t.end;T.rem=rem;iv=setInterval(tick,100)}else{T.rem=0;T.done=true;T.half=true}}
    saveT();drawT();pushLive(true)}
  else rst()}
async function lock(){try{if(wl)return;wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}catch(e){wl=null}}
document.addEventListener('pointerdown',lock);
function go(){au();if(T.done)return;
  if(T.run){T.rem=Math.max(0,(T.end-Date.now())/1000);T.run=false;clearInterval(iv)}
  else{T.run=true;T.started=true;T.end=Date.now()+T.rem*1000;lock();iv=setInterval(tick,100)}
  saveT();drawT();renderRank();pushLive(true)}
function tick(){if(!T.run)return;T.rem=Math.max(0,(T.end-Date.now())/1000);
  if(!T.half&&T.rem<=S.dur/2){T.half=true;T.hb=Date.now()+4000;halfBeep();saveT();pushLive(true)}
  if(T.rem<=0){T.run=false;T.done=true;clearInterval(iv);endBuzz();saveT();pushLive(true)}
  drawT()}
function liveState(){const l=MODE==='host'?{...S.cur,run:T.run,started:T.started,done:T.done}:((SESS&&SESS.live)||{});return l||{}}
function updateLiveTabs(){const l=liveState(),active=!!(SESS&&l.started);
  const b=document.querySelector('[data-session-view="match"]');if(b){b.classList.toggle('live-active',active);b.setAttribute('aria-label','Match'+(active?' : match en cours':''))}}
function drawT(t=T,d=S.dur){const c=$('#tc'),hb=t.run&&Date.now()<(t.hb||0);
  updateLiveTabs();
  $('#time').textContent=fmt(t.rem);$('#prog').style.width=Math.min(100,100*(1-t.rem/d))+'%';
  $('#ph').textContent=t.done?'TEMPS ÉCOULÉ !':hb?'🔔 MI-TEMPS':!t.started?(MODE==='view'?'En attente du coup d\'envoi':'Prêt, mi-temps à '+fmt(d/2)):!t.run?'En pause':t.half?'2e mi-temps':'1re mi-temps';
  c.classList.toggle('end',!!t.done);c.classList.toggle('hb',hb);
  if(MODE!=='host'||!SESS)return;
  const g=$('#go'),v=$('#val'),n=nSess(),mx=SESS.max,full=n>=mx;
  g.textContent=t.done?'Terminé':t.run?'⏸ Pause':t.started?'▶ Reprendre':'▶ Démarrer';g.disabled=t.done||full;
  v.classList.toggle('pulse',t.done);v.disabled=full;
  if(!v.dataset.arm)v.textContent=full?'Session terminée ('+mx+' matchs)':'✓ Valider le match ('+(n+1)+'/'+mx+')';
  const end=$('#endS');if(end)end.hidden=MODE!=='host'||!SESS}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lock();if(T.run)tick();pull()}});

/* ---- live : l'organisateur publie, les autres regardent ---- */
async function pushLive(force){if(MODE!=='host'||!SESS)return;if(pushing){if(force)dirty=true;return}
  const l={a:S.cur.a,b:S.cur.b,sa:S.cur.sa,sb:S.cur.sb,g:S.cur.goals,dur:S.dur,run:T.run,end:T.run?T.end:0,rem:T.run?0:Math.round(T.rem*10)/10,half:T.half,done:T.done,started:T.started},j=JSON.stringify(l);
  if(j===lastLive&&!force)return;pushing=true;
  try{await post('session/live',{id:SESS.id,live:l});lastLive=j}catch(e){if(!document.hidden)$('#sync').textContent='Match non synchronisé · vérifiez la connexion'}
  pushing=false;if(dirty){dirty=false;pushLive(true)}}
function viewSync(){if(MODE!=='view'||!SESS)return;const L=SESS.live||{},d=L.dur||390,rem=L.run?Math.max(0,(L.end-Date.now())/1000):(L.rem==null?d:L.rem);
  drawT({run:L.run&&rem>0,rem,half:L.half,done:L.done||(L.run&&rem<=0),started:L.started,hb:0},d);
  const k=[L.a,L.b,L.sa,L.sb,JSON.stringify(L.g||[])].join();if(k!==lastBoard){lastBoard=k;renderBoard();renderRank()}}

/* ---- helpers ---- */
function two(b,fn,lbl){if(b.dataset.arm){clearTimeout(+b.dataset.arm);delete b.dataset.arm;b.textContent=b.dataset.o;b.classList.remove('arm');fn()}
  else{b.dataset.o=b.textContent;b.textContent=lbl||'Confirmer ?';b.classList.add('arm');
    b.dataset.arm=setTimeout(()=>{delete b.dataset.arm;b.textContent=b.dataset.o;b.classList.remove('arm')},3000)}}
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3500)}
function fix(){const c=S.cur;let a=c.a,b=c.b;
  if(!TEAMS.includes(a))a=TEAMS.find(t=>t!==b);
  if(!TEAMS.includes(b))b=TEAMS.find(t=>t!==a);
  if(a===b)b=TEAMS.find(t=>t!==a);c.a=a;c.b=b}
const ch=()=>{save();renderBoard();renderRank();pushLive(true)};

/* ---- session ---- */
function setMode(){TEAMS=SESS&&SESS.teams?ALL.filter(t=>SESS.teams[t]):S.setup.teams;
  MODE=!SESS?'none':(isHost()?'host':'view');
  document.body.classList.toggle('anon',!ME);document.body.classList.toggle('view',MODE==='view');
  $('#setup').hidden=MODE!=='none';$('#live').hidden=MODE==='none';
  $('#session-dock').hidden=MODE==='none';
  const ta=$('#tabAdmin');if(ta)ta.hidden=!isAdmin();
  const pa=$('#p-admin');if(pa&&!isAdmin()){const leavingAdmin=!pa.hidden;pa.hidden=true;if(leavingAdmin){$('#p-session').hidden=false;document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('on',n.dataset.tab==='session'))}}
  if(MODE!=='host')closePick();
  if(MODE!=='none')closeQuick();
  if(MODE==='host')fix()}
function syncHostLive(){if(MODE!=='host'||!SESS||!SESS.live)return;const l=SESS.live,key=SESS.id+':'+JSON.stringify(l);if(key===hostLiveKey)return;hostLiveKey=key;
  const local={a:S.cur.a,b:S.cur.b,sa:S.cur.sa,sb:S.cur.sb,g:S.cur.goals,dur:S.dur,run:T.run,end:T.run?T.end:0,rem:T.run?0:Math.round(T.rem*10)/10,half:T.half,done:T.done,started:T.started};
  if(JSON.stringify(local)===JSON.stringify(l))return;
  if(Number.isFinite(+l.dur)&&+l.dur>=10)S.dur=+l.dur;
  S.cur={a:l.a||TEAMS[0],b:l.b||TEAMS[1],sa:+l.sa||0,sb:+l.sb||0,goals:Array.isArray(l.g)?l.g:[]};fix();
  clearInterval(iv);const rem=l.run?Math.max(0,(l.end-Date.now())/1000):Math.max(0,Number(l.rem??l.dur??S.dur));
  T={run:!!l.run&&rem>0,rem,end:l.run?l.end:0,half:!!l.half,done:!!l.done||!!l.run&&rem<=0,started:!!l.started,hb:0};
  if(T.run)iv=setInterval(tick,100);saveT();lastBoard='';renderBoard();drawT()}
function refresh(){setMode();if(MODE==='host')syncHostLive();else if(MODE!=='host')hostLiveKey='';renderAuth();renderWho();if(MODE!==prev){prev=MODE;lastBoard='';renderBoard();if(MODE==='host')drawT()}rebuild();renderSetup();renderAdmin();renderBonus();viewSync()}
const gcount=a=>{const m={};a.forEach(x=>m[x]=(m[x]||0)+1);return Object.entries(m).map(([k,n])=>n>1?k+' ×'+n:k).join(', ')};
function openPick(side){const t=S.cur[side],opponent=S.cur[side==='a'?'b':'a'],ps=(SESS&&SESS.teams&&SESS.teams[t])||[];
  if(!ps.length){addGoal(side,'',0);return}
  PICK=side;const el=$('#pick');
  el.innerHTML=`<div class="sheet t-${t}"><h3>Qui a marqué pour ${TM[t]} ?</h3><div class="pl">${ps.map((p,i)=>`<button class="pc on t-${t}" data-gp="${i}">${esc(p)}</button>`).join('')}</div><div class="set"><button class="sm csc t-${opponent}" data-gp="csc">⚽ Contre son camp</button></div><div class="set"><button class="sm" data-gp="x">Inconnu</button><button class="sm" id="pickx">Annuler</button></div></div>`;
  el.hidden=false}
function closePick(){PICK=null;const el=$('#pick');if(el){el.hidden=true;el.innerHTML=''}}
function addGoal(side,p,og){S.cur['s'+side]++;S.cur.goals.push({s:side,p,og:og?1:0});navigator.vibrate&&navigator.vibrate(20);closePick();ch()}
function pickGoal(v){const side=PICK;if(!side)return;const ps=(SESS&&SESS.teams&&SESS.teams[S.cur[side]])||[];
  if(v==='csc')addGoal(side,'',1);else if(v==='x')addGoal(side,'',0);else if(ps[+v]!==undefined)addGoal(side,ps[+v],0)}
async function startSession(){const tm=S.setup.teams,as=S.setup.assign;
  if(PL.some(p=>as[p]==='P')){toast('Placez tous les joueurs présents dans une équipe, ou touchez 🎲');return}
  const roster={};tm.forEach(t=>roster[t]=PL.filter(p=>as[p]===t));
  if(!tm.every(t=>roster[t].length)){toast('Faites les équipes et placez au moins un joueur dans chaque équipe');return}
  const live={a:tm[0],b:tm[1],sa:0,sb:0,dur:S.dur,run:false,end:0,rem:S.dur,half:false,done:false,started:false};
  try{const r=await post('session/start',{teams:roster,date:today(),live});
    S.setup.assign={};S.cur={a:tm[0],b:tm[1],sa:0,sb:0,goals:[]};lastLive='';
    SESS={id:r.id,date:today(),host_user:ME.id,host_name:ME.name,teams:roster,live,status:'active',max:12};S.cache=SESS;save();
    refresh();rst();toast('Session démarrée')}
  catch(e){toast(e.status===409?'Une session est déjà en cours':'Impossible de démarrer : vérifiez la connexion');pull(true)}}
function endSess(){if(MODE!=='host'||!SESS)return;post('session/end',{id:SESS.id}).then(()=>{S.timer=null;save();toast('Session terminée · vous pouvez en démarrer une nouvelle');pull(true)}).catch(()=>toast('Action refusée'))}
async function gen(){const as=S.setup.assign,names=PL.filter(p=>as[p]),tm=S.setup.teams;
  if(names.length<tm.length){toast('Pas assez de joueurs présents');return}
  try{const r=await post('teams/generate',{names,k:tm.length});
    names.forEach(n=>delete as[n]);r.teams.forEach((t,i)=>t.forEach(n=>as[n]=tm[i]));save();lastSetup='';renderSetup()}
  catch(e){toast('Génération impossible')}}
async function login(){const c=($('#code').value||'').trim();if(!c)return;
  try{const r=await post('login',{code:c});ME=r.me;S.me=ME;save();VER=0;await pull(true)}
  catch(e){$('#autherr').textContent=e.status===429?'Trop d\'essais. Réessayez dans 10 minutes.':e.status===401?'Code invalide.':'Connexion impossible, réessayez.'}}
function boot(){post('bootstrap',{key:$('#sk').value,name:$('#bn').value||'Admin'}).then(r=>{$('#code').value=r.code;$('#autherr').innerHTML='Votre code : <b>'+r.code+'</b>. Notez-le puis touchez « Entrer ».';$('#firstrun').hidden=true;$('#logincard').hidden=false}).catch(e=>{$('#setuperr').textContent=e.status===403?'Clé d\'installation incorrecte.':e.status===409?'Déjà installé : rechargez la page.':'Installation impossible.'})}
function doImport(){post('import-supabase').then(r=>{IMPORTED=r;CAN_IMPORT_SUPABASE=false;lastAdm='';pull(true);toast('Historique repris')}).catch(e=>toast(e.status===409?'Import impossible : la base contient déjà des matchs':e.status===502?'Supabase injoignable':'Import impossible'))}
async function logout(){try{await post('logout')}catch(e){}ME=null;S.me=null;S.cache=null;S.timer=null;SESS=null;save();VER=0;LOADED=false;lastSetup='';lastAdm='';refresh()}
function addUser(){const name=($('#nn').value||'').trim();if(!name)return;
  post('users',{name,level:+$('#nl').value,role:$('#na').checked?'admin':'player'}).then(r=>{NEWCODE={name:r.name,code:r.code};lastAdm='';pull(true)}).catch(e=>toast(e.status===409?'Ce nom existe déjà':'Création impossible'))}
async function renamePlayer(id){const user=USERS.find(u=>u.id===+id);if(!user)return;const name=prompt('Nouveau nom du joueur (30 caractères maximum) :',user.name);if(name===null)return;
  try{const result=await patch(`users/${user.id}/name`,{name});if(ME.id===user.id){ME.name=result.name;S.me=ME;renderWho()}if(NEWCODE?.name===user.name)NEWCODE.name=result.name;lastAdm='';toast('Nom mis à jour');await pull(true)}
  catch(e){toast(e.status===409?'Ce nom est déjà utilisé':e.status===400?'Le nom doit contenir de 1 à 30 caractères':e.status===403?'Action non autorisée':'Impossible de modifier le nom')}}
async function startLaundry(){const firstUserId=Number($('#laundryFirst')?.value);try{const result=await post('laundry/init',{firstUserId});toast('Rotation démarrée le '+laundryDate(result.startDate));await pull(true)}catch(e){toast(e.status===409?'La rotation est déjà démarrée':'Démarrage impossible')}}
async function recordLaundry(action){try{const result=await post('laundry/action',{action});toast(action==='done'?'Lavage confirmé pour '+result.name:'Tour passé pour '+result.name);await pull(true)}catch(e){toast(e.status===409?'Ce tour a déjà été traité':'Action impossible, réessayez')}}
async function saveLevels(){const levels=Object.entries(LEVEL_CHANGES).map(([id,level])=>({id:+id,level}));if(!levels.length)return;
  const button=$('#saveLevels');if(button)button.disabled=true;
  try{await patch('users/levels',{levels});LEVEL_CHANGES={};lastAdm='';toast('Niveaux sauvegardés');await pull(true)}
  catch(e){toast('Sauvegarde impossible, réessayez');lastAdm='';renderAdmin()}}

/* ---- match ---- */
function val(){if(MODE!=='host')return;if(nSess()>=SESS.max){toast('Limite de '+SESS.max+' matchs atteinte');return}
  const c=S.cur,m={date:today(),ts:Date.now(),a:c.a,b:c.b,sa:c.sa,sb:c.sb,session_id:SESS.id,sid:SESS.id,goals:c.goals.map(g=>({team:g.s==='a'?c.a:c.b,p:g.p,og:g.og}))};
  S.pending.push(m);save();rebuild();
  const td=M.filter(x=>x.session_id===SESS.id),last=t=>{for(let i=td.length-1;i>=0;i--)if(td[i].a===t||td[i].b===t)return i;return -1},
    run=t=>{let n=0;for(let i=td.length-1;i>=0&&(td[i].a===t||td[i].b===t);i--)n++;return n},
    out=run(c.a)>run(c.b)?c.a:c.b,stay=out===c.a?c.b:c.a,
    nx=TEAMS.filter(t=>t!==c.a&&t!==c.b).sort((x,y)=>last(x)-last(y))[0];
  if(nx){S.cur={a:stay,b:nx,sa:0,sb:0,goals:[]};toast(TM[stay]+' reste, '+TM[nx]+' entre, '+TM[out]+' se repose')}
  else{S.cur={a:c.a,b:c.b,sa:0,sb:0,goals:[]};toast('Match enregistré')}
  save();rst();renderBoard();pull()}

/* ---- rendu ---- */
function renderBoard(){let c=S.cur,G=S.cur.goals||[];if(MODE==='view'){const L=(SESS&&SESS.live)||{};c={a:L.a||TEAMS[0],b:L.b||TEAMS[1],sa:L.sa||0,sb:L.sb||0};G=L.g||[]}
  const dis=MODE==='view'?' disabled':'';
  $('#board').innerHTML=['a','b'].map(k=>{const team=c[k],players=(SESS&&SESS.teams&&SESS.teams[team])||[];return `<div class="side t-${team}"><select data-sel="${k}"${dis} aria-label="Équipe">${TEAMS.map(x=>`<option value="${x}"${x===team?' selected':''}>${TM[x]}</option>`).join('')}</select><div class="team-players">${players.length?players.map(esc).join(' · '):'&nbsp;'}</div><div class="n">${c['s'+k]}</div><div class="gl">${esc(gcount(G.filter(g=>g.s===k).map(g=>g.og?'csc':(g.p||'?'))))}</div><button class="plus ctl" data-add="${k}">+1</button><button class="minus ctl" data-sub="${k}">−1</button></div>`}).join('')}
function renderAuth(){const el=$('#auth');if(ME){el.innerHTML='';return}
  if(!el.firstChild){el.innerHTML=`<div class="card empty" id="authwait">Vérification de l'installation…</div><div class="card" id="logincard" hidden><h2>Futsal Aytré</h2><p class="note" style="margin:0 0 12px">Entrez votre code d'activation personnel. Il n'est demandé qu'une seule fois sur ce téléphone.</p><div class="set"><input class="in" id="code" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXXX-XXXXX" maxlength="14"><button id="login">Entrer</button></div><p class="note" id="autherr" role="alert"></p><p class="note">Pas de code ? Demandez-le à un admin du groupe.</p></div><div class="card" id="firstrun" hidden><h2>Première installation</h2><p class="note" style="margin:0 0 10px">Créez le compte administrateur. La clé d'installation est la valeur de SETUP_KEY dans Cloudflare.</p><div class="set"><input class="in" id="sk" type="password" placeholder="Clé d'installation" autocomplete="off"></div><div class="set"><input class="in" id="bn" type="text" maxlength="30" placeholder="Votre prénom"><button id="boot">Créer</button></div><p class="note" id="setuperr" role="alert"></p></div>`;
    api('setup').then(r=>{const w=$('#authwait'),l=$('#logincard'),f=$('#firstrun');if(w)w.hidden=true;if(l)l.hidden=!!r.needsAdmin;if(f)f.hidden=!r.needsAdmin}).catch(()=>{const w=$('#authwait');if(w)w.textContent='Vérification impossible. Rechargez la page pour réessayer.'})}}
function renderWho(){const w=$('#who');if(w)w.innerHTML=ME?`<details class="account-menu"><summary>Connecté : <b>${esc(ME.name)}</b>${isAdmin()?' (admin)':''}</summary><div class="account-pop"><button id="renameMe">Changer mon nom</button><button id="myStats">Mes statistiques</button><button id="logout">Se déconnecter</button></div></details>`:''}
function renderSetup(){const el=$('#setup');if(MODE!=='none'||(DRAG&&DRAG.on))return;let h='';
  if(ME&&!LOADED)h='<div class="card empty">Connexion…</div>';
  else if(ME){const tm=S.setup.teams,as=S.setup.assign,pres=PL.filter(p=>as[p]).length;
    const all=PL.map((p,i)=>({p,i})).sort((a,b)=>a.p.localeCompare(b.p,'fr',{sensitivity:'base'}));
    const chip=({p,i},t)=>`<button class="pc${!t?' absent':t==='P'?' pr':' on t-'+t}" data-pi="${i}">${esc(p)}</button>`;
    const zone=(key,title,cls,list)=>`<div class="zone ${cls}" data-z="${key}"><h4>${title} <span>${list.length}</span></h4><div class="pl">${list.map(x=>chip(x,key)).join('')||'<span class="ph">Déposez des joueurs ici</span>'}</div></div>`;
    const zones=zone('','Absents','z-absent',all.filter(x=>!as[x.p]))+zone('P','Présents, sans équipe','z-pres',all.filter(x=>as[x.p]==='P'))+tm.map(t=>zone(t,TM[t],'t-'+t,all.filter(x=>as[x.p]===t))).join('');
    h=`<div class="card"><h2>Nouvelle session</h2><p class="note" style="margin:0 0 10px">Aucune session en cours. Votre compte (${esc(ME.name)}) gérera le chrono et la validation des scores jusqu'à la fin des 12 matchs. Les autres suivent en direct.</p>
<div class="set"><label>Équipes ce soir (2 ou 3)</label><span>${ALL.map(t=>`<button class="chip t-${t}${tm.includes(t)?' on':''}" data-tg="${t}">${TM[t]}</button>`).join(' ')}</span></div></div>
<div class="card"><h2>Joueurs présents</h2><p class="note" style="margin:0">Glissez-déposez chaque joueur dans une zone, touchez-le deux fois pour choisir son équipe d'un geste, ou une fois pour le faire défiler : présent, ${tm.map(t=>TM[t]).join(', ')}, puis absent. Vous pouvez corriger les équipes à la main après la génération. Ou touchez 🎲 pour des équipes équilibrées.</p>
<div class="set"><button id="gen"${pres<tm.length?' disabled':''}>🎲 Générer les équipes</button><button class="sm" id="toggle-pres">${pres===PL.length&&PL.length?'Tous absents':'Tous présents'}</button></div>
<div class="zones">${zones}</div>${PL.length?'':`<span class="note">${isAdmin()?'Aucun joueur : ajoutez-en dans l\'onglet Joueurs.':'Aucun joueur : demandez à un admin d\'en ajouter.'}</span>`}</div>
<button class="val" id="start">▶ Démarrer la session</button>`}
  if(h!==lastSetup){lastSetup=h;el.innerHTML=h}}
function renderAdmin(){const el=$('#adm');if(!el)return;if(!isAdmin()){el.replaceChildren();return}let h='';
  if(isAdmin()){
    const nc=NEWCODE?`<div class="card code"><div>Code de <b>${esc(NEWCODE.name||'')}</b></div><div class="big">${esc(NEWCODE.code)}</div><p class="note">À lui transmettre maintenant. Il ne sera plus affiché.</p><div class="set"><button class="sm" id="cpcode">Copier</button><button class="sm" id="hidecode">J'ai noté le code</button></div></div>`:'';
    const levels=['Débutant','À l’aise','Avancé','Pro'];
    const levelSlider=(value,attrs,locked=false)=>{const level=Math.min(4,Math.max(1,Number(value)||2));return `<div class="level-slider${locked?' locked':''}" data-level-slider${locked?' data-locked="true"':''}><input type="range" min="1" max="4" step="1" value="${level}" style="--level-value:${level}" ${locked?'disabled':''} ${attrs}><div class="level-labels">${levels.map((label,i)=>`<span>${label}</span>`).join('')}</div>${locked?'<small class="slider-hint">Touchez deux fois pour modifier</small>':''}</div>`};
    const imp=IMPORTED?`<div class="card code"><h2>Codes des joueurs repris</h2><p class="note">${IMPORTED.stats.matchs} matchs repris. À transmettre maintenant : ces codes ne seront plus affichés.</p>${IMPORTED.codes.map(c=>`<div class="ur"><b>${esc(c.name)}</b><span class="big" style="font-size:26px">${esc(c.code)}</span></div>`).join('')}<div class="set"><button class="sm" id="cpall">Copier la liste</button><button class="sm" id="hideimp">J'ai noté les codes</button></div></div>`:'';
    const importCard=CAN_IMPORT_SUPABASE?`<div class="card"><h2>Historique Supabase</h2><p class="note" style="margin:0 0 10px">Reprend les joueurs, sessions et matchs de l'ancienne base. Possible une seule fois, sur une base sans match.</p><button id="imp">Importer l'historique Supabase</button></div>`:'';
    h=nc+imp+`<div class="card"><h2>Nouveau joueur</h2><div class="set"><input class="in" id="nn" type="text" maxlength="30" placeholder="Prénom"></div><div class="level-field"><label for="nl">Niveau</label>${levelSlider(2,'id="nl" aria-label="Niveau du nouveau joueur"')}</div><div class="set"><label><input type="checkbox" id="na"> Admin</label><button id="addu">Créer</button></div><p class="note">Un code d'activation unique est généré pour ce joueur.</p></div>
${importCard}
  <div class="card"><h2>Joueurs (${USERS.length})</h2>${Object.keys(LEVEL_CHANGES).length?'<p class="note pending-levels">Modifications de niveaux non sauvegardées.</p>':''}${USERS.map(u=>`<div class="ur"><b>${esc(u.name)}${u.role==='admin'?' <span class="badge">admin</span>':''}</b><div class="level-field"><label for="level-${u.id}">Niveau</label>${levelSlider(LEVEL_CHANGES[u.id]??u.level,`id="level-${u.id}" data-lv="${u.id}" aria-label="Niveau de ${esc(u.name)}"`,true)}</div><button class="sm" data-rename="${u.id}">Changer le nom</button><button class="sm" data-nc="${u.id}">Nouveau code</button>${u.id===ME.id?'':`<button class="sm" data-adm="${u.id}">${u.role==='admin'?'Retirer admin':'Passer admin'}</button><button class="sm" data-du="${u.id}" aria-label="Supprimer ${esc(u.name)}">✕</button>`}</div>`).join('')||'<div class="empty">Aucun joueur.</div>'}<button class="val" id="saveLevels"${Object.keys(LEVEL_CHANGES).length?'':' disabled'}>💾 Sauvegarder les niveaux</button></div>`}
  if(h!==lastAdm){lastAdm=h;el.innerHTML=h}}
function calc(L,teams){const r={};teams.forEach(t=>r[t]={t,j:0,v:0,n:0,l:0,gf:0,ga:0,d:0,p:0});
  L.forEach(m=>{const A=r[m.a],B=r[m.b];if(!A||!B)return;A.j++;B.j++;A.gf+=m.sa;B.gf+=m.sb;A.d+=m.sa-m.sb;B.d+=m.sb-m.sa;
    if(m.sa>m.sb){A.v++;B.l++;A.p+=3}else if(m.sb>m.sa){B.v++;A.l++;B.p+=3}else{A.n++;B.n++;A.p++;B.p++}});
  return Object.values(r).sort((x,y)=>y.p-x.p||y.d-x.d||y.gf-x.gf)}
function renderRank(){const games=M.filter(m=>dt(m)===today()),live=liveState();
  if(SESS&&live.started&&live.a&&live.b){games.push({a:live.a,b:live.b,sa:+live.sa||0,sb:+live.sb||0,date:today()})}
  const L=calc(games,ALL).filter(x=>x.j);
  const liveTeams=SESS&&live.started?[live.a,live.b]:[];
  $('#tb').innerHTML=L.length?'<tr><th></th><th>Équipe</th><th>J</th><th>Diff</th><th>Pts</th></tr>'+L.map((x,i)=>{const playing=liveTeams.includes(x.t);return `<tr class="t-${x.t}${playing?' live-team':''}"><td class="rk">${i+1}${playing?'<span class="live-indicator" aria-label="Match en cours"></span>':''}</td><td><i class="dot"></i>${TM[x.t]}</td><td>${x.j}</td><td>${sg(x.d)}</td><td class="pt">${x.p}</td></tr>`}).join(''):'<tr><td class="empty">Aucun match aujourd\'hui.</td></tr>'}
function renderHist(){const H=$('#hist'),dates=[...new Set(M.map(dt))].sort().reverse();
  if(!dates.length){H.innerHTML='<div class="empty">Aucun match pour l\'instant.<br>Validez un match pour le voir ici.</div>';return}
  if(!HD||!dates.includes(HD))HD=dates.includes(today())?today():dates[0];
  const E=M.map((m,i)=>[m,i]).filter(([m])=>dt(m)===HD),adm=isAdmin(),fd=d=>new Date(d+'T12:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
  H.innerHTML=`<div class="set" style="margin:0 0 6px"><select class="sel" id="hd" aria-label="Soirée">${dates.map(d=>`<option value="${d}"${d===HD?' selected':''}>${fd(d)}${d===today()?' (aujourd\'hui)':''}</option>`).join('')}</select></div>`+
    E.map(([m,i],k)=>`<div class="h"><span class="no">${k+1}</span><span class="tm t-${m.a}"><i class="dot"></i>${TM[m.a]}</span><span class="sc">${m.sa} – ${m.sb}</span><span class="tm t-${m.b}"><i class="dot"></i>${TM[m.b]}</span>${adm&&m.id?`<span class="ha"><button data-edit="${i}" aria-label="Corriger le match ${k+1}">✎</button><button data-del="${i}" aria-label="Supprimer le match ${k+1}">✕</button></span>`:'<span></span>'}${gtxt(m)}</div>`).reverse().join('')}
const gtxt=m=>{const G=m.goals||[];if(!G.length)return '';const f=t=>gcount(G.filter(g=>g.team===t).map(g=>g.og?'csc':(g.p||'?')));return `<span class="gs">⚽ ${esc(f(m.a)||'–')} · ${esc(f(m.b)||'–')}</span>`};
function pstats(L){const SM=Object.fromEntries(SA.map(s=>[s.id,s])),r={},P=n=>r[n]||(r[n]={p:n,j:0,v:0,n:0,l:0,g:0});
  L.forEach(m=>{const s=SM[m.session_id];
    if(s&&s.teams)[[m.a,m.sa,m.sb],[m.b,m.sb,m.sa]].forEach(([t,f,g])=>(s.teams[t]||[]).forEach(p=>{const x=P(p);x.j++;f>g?x.v++:f<g?x.l++:x.n++}));
    (m.goals||[]).forEach(g=>{if(g.p&&!g.og)P(g.p).g++})});
  return Object.values(r)}
const pc=x=>x.j?x.v/x.j:0,pct=x=>Math.round(100*pc(x)),ord=n=>n===1?'1er':n+'e';
const byWins=(x,y)=>y.v-x.v||pc(y)-pc(x)||y.j-x.j,byGoals=(x,y)=>y.g-x.g||(y.j?y.g/y.j:0)-(x.j?x.g/x.j:0)||x.j-y.j;
function renderPlayers(L){const A=pstats(L).sort(byWins),me=ME&&ME.name;
  $('#pls').innerHTML='<h2>Classement des joueurs</h2>'+(A.length?'<table class="cp"><tr><th></th><th>Joueur</th><th>J</th><th>V-N-D</th><th>% V</th><th>⚽</th><th>V</th></tr>'+A.map((x,i)=>`<tr class="${x.p===me?'me':''}"><td class="rk">${i+1}</td><td>${esc(x.p)}</td><td>${x.j}</td><td>${x.v}-${x.n}-${x.l}</td><td>${pct(x)}%</td><td>${x.g}</td><td class="pt">${x.v}</td></tr>`).join('')+'</table><p class="note">Classé par victoires, puis % de victoires.</p>':'<div class="empty">Pas encore de joueurs. Ils apparaissent dès la première session avec des équipes.</div>');
  const B=A.filter(x=>x.g>0).sort(byGoals),sc=$('#scs');
  if(sc)sc.innerHTML='<h2>Meilleurs buteurs</h2>'+(B.length?'<table class="cp"><tr><th></th><th>Joueur</th><th>J</th><th>Moy</th><th>⚽</th></tr>'+B.map((x,i)=>`<tr class="${x.p===me?'me':''}"><td class="rk">${i+1}</td><td>${esc(x.p)}</td><td>${x.j}</td><td>${x.j?(x.g/x.j).toFixed(2):'–'}</td><td class="pt">${x.g}</td></tr>`).join('')+'</table>':'<div class="empty">Les buts s\'affichent dès qu\'un buteur est choisi.</div>')}
const laundryDate=date=>new Date(date+'T12:00:00').toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long',year:'numeric'});
function projectLaundry(startDate,queue,count=52){const start=new Date(startDate+'T00:00:00Z');return Array.from({length:count},(_,index)=>{const date=new Date(start);date.setUTCDate(date.getUTCDate()+index*7);const player=queue.length?queue[index%queue.length]:null;return{date:date.toISOString().slice(0,10),user_id:player?.id??null,name:player?.name??null}})}
function renderBonus(){const el=$('#laundry');if(!el)return;if(!ME){el.innerHTML='';return}
  if(!LAUNDRY?.rotation){el.innerHTML=`<h2>Rotation des chasubles</h2>${isAdmin()&&USERS.length?`<p>Choisissez le premier joueur. La rotation commence ce soir si nous sommes lundi, sinon au prochain lundi.</p><div class="set"><select class="laundry-select" id="laundryFirst" aria-label="Premier joueur">${USERS.map(u=>`<option value="${u.id}">${esc(u.name)}</option>`).join('')}</select><button id="laundryStart">Démarrer la rotation</button></div>`:'<div class="empty">La rotation sera disponible dès qu’un admin l’aura démarrée.</div>'}`;return}
  const {rotation,queue,events}=LAUNDRY,upcoming=projectLaundry(rotation.next_date,queue,52),past=events.filter(event=>event.date<rotation.next_date).slice(-52),schedule=past.concat(upcoming),current=schedule.find(turn=>turn.date===rotation.next_date),due=rotation.next_date<=today()&&!events.some(event=>event.date===rotation.next_date);
  let h=`<h2>Rotation des chasubles</h2><p class="note">Un tour chaque lundi soir · rotation démarrée le ${esc(laundryDate(rotation.start_date))}.</p>`;
  if(current?.name)h+=`<div class="laundry-current"><b>${due?'Ce lundi':'Prochain tour'} · ${esc(laundryDate(current.date))}</b><span>${esc(current.name)}</span>${due?'<div class="set"><button class="laundry-done" id="laundryDone">✓ Chasubles prises / lavées</button><button class="laundry-skip" id="laundrySkip">Passer au suivant</button></div>':''}</div>`;
  h+='<h3>Calendrier annuel</h3><div class="laundry-calendar"><table><thead><tr><th>Date</th><th>Joueur</th><th>État</th></tr></thead><tbody>'+schedule.map(turn=>{
    const status=turn.action==='done'?`✓ Confirmé${turn.actor_name?' par '+esc(turn.actor_name):''}`:turn.action==='skip'?`Tour passé${turn.actor_name?' par '+esc(turn.actor_name):''}`:turn.date===rotation.next_date?'À venir':'Prévu';
    return `<tr${turn.date===rotation.next_date?' class="laundry-today"':''}><td>${esc(laundryDate(turn.date))}</td><td>${esc(turn.name||'—')}</td><td>${status}</td></tr>`}).join('')+'</tbody></table></div>';
  el.innerHTML=h}
function renderMe(){const el=$('#me');if(!el)return;if(!ME){el.innerHTML='';return}
  const y=YR||today().slice(0,4),A=pstats(M.filter(m=>dt(m).startsWith(y))),x=A.find(p=>p.p===ME.name);
  let h=`<h2>${esc(ME.name)} · saison ${y}</h2>`;
  if(!x||(!x.j&&!x.g))h+='<div class="empty">Pas encore de match joué cette saison.<br>Vos statistiques apparaîtront après votre première session.</div>';
  else{const N=A.filter(p=>p.j).length,rw=1+A.filter(p=>p.v>x.v).length,rg=1+A.filter(p=>p.g>x.g).length,lead=Math.max(...A.map(p=>p.v)),top=Math.max(...A.map(p=>p.g));
    const k=(b,t)=>`<div class="kp"><b>${b}</b><span>${t}</span></div>`;
    h+=`<div class="kpis">${k(x.j,'matchs')}${k(x.v,'victoires')}${k(x.n,'nuls')}${k(x.l,'défaites')}${k(pct(x)+'%','de victoires')}${k(x.g,'buts')}</div>
<div class="rkl"><div><b>${ord(rw)}</b> sur ${N} aux victoires<small>${lead>x.v?(lead-x.v)+' victoire'+(lead-x.v>1?'s':'')+' du 1er':'vous êtes en tête'}</small></div>
<div><b>${x.g?ord(rg):'–'}</b> aux buts<small>${x.g?(top>x.g?(top-x.g)+' but'+(top-x.g>1?'s':'')+' du 1er':'vous êtes en tête'):'aucun but encore'}</small></div></div>
<p class="note">${x.j?(x.g/x.j).toFixed(2):'0.00'} but par match. Le classement complet est dans l'onglet Saison.</p>`}
  if(LAUNDRY?.rotation){const {rotation,queue}=LAUNDRY,turn=projectLaundry(rotation.next_date,queue,Math.max(52,queue.length)).find(item=>item.user_id===ME.id);if(turn)h+=`<p class="note next-laundry">Prochaine date de lavage : <b>${esc(laundryDate(turn.date))}</b></p>`}
  el.innerHTML=h}
function renderSeason(){const ys=[...new Set(M.map(m=>dt(m).slice(0,4)).concat(today().slice(0,4)))].sort().reverse();
  if(!YR||!ys.includes(YR))YR=ys[0];
  $('#yr').innerHTML=ys.map(y=>`<option${y===YR?' selected':''}>${y}</option>`).join('');
  const L=M.filter(m=>dt(m).startsWith(YR)),by={},W=Object.fromEntries(ALL.map(t=>[t,0]));
  L.forEach(m=>(by[dt(m)]=by[dt(m)]||[]).push(m));
  const evs=Object.keys(by).sort().reverse().map(d=>({d,r:calc(by[d],ALL).filter(x=>x.j)}));
  evs.forEach(e=>{if(e.r.length)W[e.r[0].t]++});
  $('#sea').innerHTML=L.length?'<table class="cp"><tr><th></th><th>Équipe</th><th>J</th><th>V-N-D</th><th>Diff</th><th>Pts</th><th>Moy</th><th>🏅</th></tr>'+calc(L,ALL).filter(x=>x.j).map((x,i)=>`<tr class="t-${x.t}"><td class="rk">${i+1}</td><td><i class="dot"></i>${TM[x.t]}</td><td>${x.j}</td><td>${x.v}-${x.n}-${x.l}</td><td>${sg(x.d)}</td><td class="pt">${x.p}</td><td>${x.j?(x.p/x.j).toFixed(2):'–'}</td><td>${W[x.t]}</td></tr>`).join('')+`</table><p class="note">${L.length} matchs sur ${evs.length} soirées. Moy : points par match. 🏅 : soirées gagnées.</p>`:`<div class="empty">Aucun match en ${YR}.</div>`;
  renderSessionRank(L);
  renderPlayers(L);
  $('#evs').innerHTML=evs.length?evs.map(e=>`<div class="ev"><b>${new Date(e.d+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</b><span class="w t-${e.r[0].t}"><i class="dot"></i>${TM[e.r[0].t]}</span><small>${e.r.map(x=>TM[x.t]+' '+x.p).join(', ')}</small></div>`).join(''):''}
function renderSessionRank(L){const sessions=SA.filter(s=>String(s.date||'').startsWith(YR)).sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id),select=$('#sessionSelect'),out=$('#sessionRank');if(!select||!out)return;
  const previous=select.value;select.innerHTML=sessions.map(s=>`<option value="${s.id}">${new Date(s.date+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'long',year:'numeric'})} · ${s.status==='active'?'En cours':'Terminée'}</option>`).join('');
  let remove=$('#deleteSession');if(isAdmin()&&sessions.length){if(!remove){remove=document.createElement('button');remove.id='deleteSession';remove.className='sm';remove.textContent='🗑 Supprimer cette session';select.insertAdjacentElement('afterend',remove)}}else remove?.remove();
  if(!sessions.length){out.innerHTML='<div class="empty">Aucune session cette saison.</div>';return}
  const selected=sessions.find(s=>String(s.id)===previous)||sessions[0];select.value=selected.id;
  const matches=L.filter(m=>m.session_id===selected.id),rows=calc(matches,ALL).filter(x=>x.j),adm=isAdmin();
  const table=rows.length?'<table class="cp"><tr><th></th><th>Équipe</th><th>J</th><th>V-N-D</th><th>Diff</th><th>Pts</th></tr>'+rows.map((x,i)=>`<tr class="t-${x.t}"><td class="rk">${i+1}</td><td><i class="dot"></i>${TM[x.t]}</td><td>${x.j}</td><td>${x.v}-${x.n}-${x.l}</td><td>${sg(x.d)}</td><td class="pt">${x.p}</td></tr>`).join('')+'</table>':'<div class="empty">Aucun match enregistré pour cette session.</div>';
  const sessionMatches=M.map((m,i)=>[m,i]).filter(([m])=>m.session_id===selected.id);
  const matchList=sessionMatches.length?`<div class="session-matches"><h3>Matchs de la session (${sessionMatches.length})</h3>${adm?'<p class="note" style="margin:0 0 8px">Touchez ✎ pour corriger le score ou les buteurs : les classements sont recalculés automatiquement.</p>':''}${sessionMatches.map(([m,i],k)=>`<div class="h"><span class="no">${k+1}</span><span class="tm t-${m.a}"><i class="dot"></i>${TM[m.a]}</span><span class="sc">${m.sa} – ${m.sb}</span><span class="tm t-${m.b}"><i class="dot"></i>${TM[m.b]}</span>${adm&&m.id?`<span class="ha"><button data-edit="${i}" aria-label="Corriger le match ${k+1}">✎</button><button data-del="${i}" aria-label="Supprimer le match ${k+1}">✕</button></span>`:'<span></span>'}${gtxt(m)}</div>`).reverse().join('')}</div>`:'';
  out.innerHTML=table+matchList}

/* ---- API ---- */
const api=(p,o={})=>fetch('/api/'+p,{credentials:'same-origin',...o,headers:{'Content-Type':'application/json'}}).then(async r=>{const t=await r.text();let b=null;try{b=t?JSON.parse(t):null}catch(e){}if(!r.ok){const e=new Error(r.status);e.status=r.status;e.body=b;throw e}return b});
const post=(p,b)=>api(p,{method:'POST',body:JSON.stringify(b||{})});
const patch=(p,b)=>api(p,{method:'PATCH',body:JSON.stringify(b||{})});
function rebuild(){M=R.concat(S.pending);renderRank();renderHist();renderSeason();renderMe();if(MODE==='host')drawT()}
function syncStatus(){const n=S.pending.filter(m=>m.syncError).length,el=$('#sync');if(!el)return;
  el.innerHTML=n?`${n} match${n>1?'s':''} conservé${n>1?'s':''} localement · <button class="sm" id="retryMatches">Réessayer</button>`:'☁ Synchronisé'}
async function pull(force){if(busy||document.hidden)return;busy=true;
  let pendingFailure=false;
  try{
    for(const m of [...S.pending]){
      if(m.syncError){pendingFailure=true;continue}
      try{await post('match',{sid:m.sid,ts:m.ts,a:m.a,b:m.b,sa:m.sa,sb:m.sb,goals:m.goals||[]})}
      catch(e){
        if(e.status===401)throw e;
        if(e.status>=400&&e.status<500){const first=!m.syncError;m.syncError=e.status;pendingFailure=true;save();if(first)toast('Match conservé localement, synchronisation refusée.');continue}
        throw e}
      S.pending=S.pending.filter(x=>x!==m);save()}
    const st=await api('state?v='+(force?0:VER));
    const canImport=!!st.canImportSupabase;
    if(CAN_IMPORT_SUPABASE!==canImport){CAN_IMPORT_SUPABASE=canImport;lastAdm='';renderAdmin()}
    if(!st.same){const wh=isHost();VER=st.v;LOADED=true;ME=st.me;S.me=ME;CAN_IMPORT_SUPABASE=!!st.canImportSupabase;LAUNDRY=st.laundry||null;const gm={};(st.goals||[]).forEach(g=>(gm[g.match_id]=gm[g.match_id]||[]).push({team:g.team,p:g.p,og:g.og}));R=st.matches.map(m=>({...m,goals:gm[m.id]||[]}));SA=st.sessions;USERS=st.users;PL=st.users.map(u=>u.name);
      SESS=st.sessions.find(x=>x.status==='active')||null;S.cache=isHost()?SESS:null;
      if(wh&&!isHost())toast('Session terminée');
      save();refresh()}
    syncStatus()}
  catch(e){if(e.status===401){ME=null;S.me=null;S.cache=null;SESS=null;LOADED=false;save();refresh()}else if(pendingFailure)syncStatus();else $('#sync').textContent=e.status>=400&&e.status<500?'Synchronisation refusée (HTTP '+e.status+')':'Hors ligne, nouvel essai…'}
  busy=false}

/* ---- ajout rapide : double appui sur un joueur ---- */
function cycle(i){const p=PL[i],as=S.setup.assign,teams=S.setup.teams,current=as[p];if(!p)return;
  if(!current)as[p]='P';else if(current==='P')as[p]=teams[0];else{const next=teams.indexOf(current)+1;if(next<teams.length)as[p]=teams[next];else delete as[p]}
  save();lastSetup='';renderSetup()}
function closeQuick(){const q=$('#quick');if(q){q.hidden=true;q.innerHTML=''}QI=-1}
function openQuick(i,el){const p=PL[i],q=$('#quick');if(!p||!q)return;QI=i;
  const as=S.setup.assign,tm=S.setup.teams,r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,W=innerWidth,H=innerHeight,R=92;
  const items=[...tm.map(t=>({v:t,l:TM[t],c:'t-'+t,a:TM[t]})),{v:'P',l:'Présent',c:'pr',a:'Présent, sans équipe'},{v:'',l:'✕',c:'x',a:'Absent'}];
  q.innerHTML=`<div class="qname" style="left:${cx}px;top:${cy}px">${esc(p)}</div>`+items.map((it,k)=>{const a=-Math.PI/2+k*2*Math.PI/items.length,x=Math.min(W-38,Math.max(38,cx+R*Math.cos(a))),y=Math.min(H-38,Math.max(38,cy+R*Math.sin(a)));
    return `<button class="qb ${it.c}${(as[p]||'')===it.v?' cur':''}" data-q="${it.v}" style="left:${x}px;top:${y}px" aria-label="${it.a}">${it.l}</button>`}).join('');
  q.hidden=false}
function quickPick(v){const p=PL[QI],as=S.setup.assign;if(!p)return;
  if(v==='')delete as[p];else if(v==='P'||S.setup.teams.includes(v))as[p]=v;else return;
  closeQuick();save();lastSetup='';renderSetup()}

/* ---- correction d'un match validé (admins) ---- */
function closeEdit(){EDIT=null;const el=$('#edit');if(el){el.hidden=true;el.innerHTML=''}}
function openEdit(i){const m=M[i];if(!m||!m.id||!isAdmin())return;
  const s=SA.find(x=>x.id===m.session_id),ros=t=>{const list=(s&&s.teams&&s.teams[t])||[];return list.length?list:PL},G=m.goals||[],gl=t=>G.filter(g=>g.team===t).map(g=>({p:g.og?'':(g.p||''),og:g.og?1:0}));
  EDIT={id:m.id,a:m.a,b:m.b,sa:m.sa,sb:m.sb,ra:ros(m.a),rb:ros(m.b),ga:gl(m.a),gb:gl(m.b)};
  EDIT.ga.length=Math.min(EDIT.ga.length,EDIT.sa);EDIT.gb.length=Math.min(EDIT.gb.length,EDIT.sb);
  renderEdit()}
function renderEdit(){const e=EDIT,el=$('#edit');if(!e||!el)return;
  const col=k=>{const t=e[k],sc=e['s'+k],G=e['g'+k],ro=e['r'+k];
    const opts=cur=>{const extra=cur&&!cur.startsWith('__')&&!ro.includes(cur)?[cur]:[];
      return [...ro,...extra].map(n=>`<option value="${esc(n)}"${n===cur?' selected':''}>${esc(n)}</option>`).join('')+`<option value="__csc"${cur==='__csc'?' selected':''}>Contre son camp</option><option value="__x"${cur==='__x'?' selected':''}>Inconnu</option>`};
    const rows=G.map((g,ix)=>{const cur=g.og?'__csc':(g.p||'__x');return `<div class="erow"><select class="sel" data-eg="${k}" data-ix="${ix}" aria-label="Buteur ${ix+1}">${opts(cur)}</select><button class="sm" data-egx="${k}" data-ix="${ix}" aria-label="Retirer ce buteur">✕</button></div>`}).join('');
    return `<div class="ecol t-${t}"><b>${TM[t]}</b><div class="stp"><button data-es="${k}" data-d="-1" aria-label="Moins un but">−</button><span class="n">${sc}</span><button data-es="${k}" data-d="1" aria-label="Plus un but">+</button></div>${rows}<button class="sm" data-ega="${k}"${G.length>=sc?' disabled':''}>+ Buteur</button></div>`};
  el.innerHTML=`<div class="sheet"><h3>Corriger le match</h3><p class="note" style="margin:0">Statistiques, classements et saison sont recalculés. Un buteur par but au maximum : les buts sans buteur restent « inconnus ».</p><div class="eg">${col('a')}${col('b')}</div><div class="set"><button id="esave">Enregistrer</button><button class="sm" id="ecancel">Annuler</button></div></div>`;
  el.hidden=false}
function editStep(k,d){const e=EDIT;if(!e)return;e['s'+k]=Math.max(0,Math.min(99,e['s'+k]+d));if(e['g'+k].length>e['s'+k])e['g'+k].length=e['s'+k];renderEdit()}
function editAdd(k){const e=EDIT;if(e&&e['g'+k].length<e['s'+k]){e['g'+k].push({p:'',og:0});renderEdit()}}
function editRemove(k,ix){if(EDIT){EDIT['g'+k].splice(ix,1);renderEdit()}}
function editSet(k,ix,v){const g=EDIT&&EDIT['g'+k][ix];if(!g)return;if(v==='__csc'){g.p='';g.og=1}else if(v==='__x'){g.p='';g.og=0}else{g.p=v;g.og=0}}
function saveEdit(){const e=EDIT;if(!e)return;
  const goals=[...e.ga.map(g=>({team:e.a,p:g.p,og:g.og})),...e.gb.map(g=>({team:e.b,p:g.p,og:g.og}))];
  patch('matches/'+e.id,{sa:e.sa,sb:e.sb,goals}).then(()=>{closeEdit();pull(true);toast('Match corrigé · classements mis à jour')}).catch(()=>toast('Correction impossible'))}
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeQuick();closeEdit();closePick()}});

/* ---- glisser-déposer des joueurs (souris et tactile) ---- */
let DRAG=null,DRAGEND=0,TAP={},QI=-1,EDIT=null,HD=null;
const zoneAt=(x,y)=>{const e=document.elementFromPoint(x,y);return e&&e.closest?e.closest('#setup .zone'):null};
function dragStart(e){clearTimeout(TAP.h);TAP={};const d=DRAG,r=d.el.getBoundingClientRect(),g=d.el.cloneNode(true);
  g.classList.add('ghost');g.removeAttribute('data-pi');g.style.width=r.width+'px';
  g.style.transform=`translate(${e.clientX-r.width/2}px,${e.clientY-r.height/2}px)`;
  document.body.appendChild(g);Object.assign(d,{ghost:g,w:r.width,h:r.height,on:true,z:null});
  d.el.classList.add('dragging');document.body.classList.add('dnd');
  try{d.el.setPointerCapture(d.id)}catch(err){}
  d.timer=setInterval(()=>{if(d.y<90)scrollBy(0,-16);else if(d.y>innerHeight-90)scrollBy(0,16)},30)}
function dragMove(e){const d=DRAG;d.x=e.clientX;d.y=e.clientY;
  d.ghost.style.transform=`translate(${d.x-d.w/2}px,${d.y-d.h/2}px)`;
  const z=zoneAt(d.x,d.y);if(z!==d.z){if(d.z)d.z.classList.remove('over');if(z)z.classList.add('over');d.z=z}}
function dragEnd(cancel){const d=DRAG;DRAG=null;if(!d||!d.on)return;
  clearInterval(d.timer);d.ghost.remove();d.el.classList.remove('dragging');document.body.classList.remove('dnd');
  if(d.z)d.z.classList.remove('over');DRAGEND=Date.now();
  const v=d.z&&d.z.dataset.z,p=PL[d.i],ok=v===''||v==='P'||S.setup.teams.includes(v);
  if(cancel||!d.z||!p||!ok)return;
  if(v==='')delete S.setup.assign[p];else S.setup.assign[p]=v;
  navigator.vibrate&&navigator.vibrate(12);save();lastSetup='';renderSetup()}
document.addEventListener('pointerdown',e=>{const c=e.target.closest&&e.target.closest('#setup .pc[data-pi]');
  if(!c||(e.pointerType==='mouse'&&e.button!==0))return;
  DRAG={el:c,i:+c.dataset.pi,id:e.pointerId,sx:e.clientX,sy:e.clientY,x:e.clientX,y:e.clientY,on:false}});
document.addEventListener('pointermove',e=>{const d=DRAG;if(!d||e.pointerId!==d.id)return;
  if(!d.on){if(Math.hypot(e.clientX-d.sx,e.clientY-d.sy)<8)return;dragStart(e)}dragMove(e)});
document.addEventListener('pointerup',e=>{if(DRAG&&e.pointerId===DRAG.id)dragEnd(false)});
document.addEventListener('pointercancel',e=>{if(DRAG&&e.pointerId===DRAG.id)dragEnd(true)});

/* ---- événements ---- */
document.addEventListener('click',e=>{if(e.target.id==='pick'){closePick();return}if(e.target.id==='quick'||(e.target.classList&&e.target.classList.contains('qname'))){closeQuick();return}if(e.target.id==='edit'){closeEdit();return}const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.sessionView){document.querySelectorAll('.session-view').forEach(v=>v.hidden=v.id!=='session-'+d.sessionView);
    document.querySelectorAll('[data-session-view]').forEach(t=>{const active=t.dataset.sessionView===d.sessionView;t.classList.toggle('on',active);t.setAttribute('aria-pressed',String(active))});scrollTo(0,0)}
  else if(d.tab){if(d.tab==='admin'&&!isAdmin())return;const pane=d.tab==='session'?'p-session':'p-'+d.tab;
    document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!==pane);
    document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('on',n===b));$('#session-dock').hidden=d.tab!=='session'||MODE==='none';scrollTo(0,0)}
  else if(d.add&&MODE==='host')openPick(d.add);
  else if(d.gp!==undefined)pickGoal(d.gp);
  else if(b.id==='pickx')closePick();
  else if(d.sub&&MODE==='host'){const g=S.cur.goals;let i=-1;for(let x=g.length-1;x>=0;x--)if(g[x].s===d.sub){i=x;break}if(i>=0)g.splice(i,1);S.cur['s'+d.sub]=Math.max(0,S.cur['s'+d.sub]-1);ch()}
  else if(d.tg){const t=d.tg,L=S.setup.teams;
    if(L.includes(t)){if(L.length>2){S.setup.teams=L.filter(x=>x!==t);for(const p in S.setup.assign)if(S.setup.assign[p]===t)delete S.setup.assign[p]}}
    else if(L.length>=3){toast('Maximum 3 équipes ce soir');return}
    else S.setup.teams=ALL.filter(x=>x===t||L.includes(x));
    save();renderSetup()}
  else if(d.pi!==undefined){if(Date.now()-DRAGEND<400)return;const i=+d.pi;
    if(TAP.i===i&&Date.now()-TAP.t<350){clearTimeout(TAP.h);TAP={};openQuick(i,b);return}
    if(TAP.h){clearTimeout(TAP.h);cycle(TAP.i);TAP={}}
    TAP={i,t:Date.now(),h:setTimeout(()=>{TAP={};cycle(i)},330)}}
  else if(d.q!==undefined)quickPick(d.q);
  else if(d.edit!==undefined)openEdit(+d.edit);
  else if(d.es)editStep(d.es,+d.d);
  else if(d.egx)editRemove(d.egx,+d.ix);
  else if(d.ega)editAdd(d.ega);
  else if(b.id==='esave')saveEdit();
  else if(b.id==='ecancel')closeEdit();
  else if(b.id==='toggle-pres'){const as=S.setup.assign,allPresent=PL.length>0&&PL.every(p=>!!as[p]);
    PL.forEach(p=>{if(allPresent)delete as[p];else if(!as[p])as[p]='P'});save();lastSetup='';renderSetup()}
  else if(d.del!==undefined)two(b,()=>{const m=M[+d.del];if(m&&m.id)api('matches/'+m.id,{method:'DELETE'}).then(()=>pull(true)).catch(()=>toast('Suppression impossible'))},'Sûr ?');
  else if(b.id==='deleteSession')two(b,async()=>{const id=$('#sessionSelect').value;if(!id)return;try{await api('sessions/'+id,{method:'DELETE'});toast('Session, matchs et buts supprimés');await pull(true)}catch(e){toast(e.status===409?'Terminez la session avant de la supprimer':e.status===404?'Cette session n’existe plus':'Suppression impossible')}},'Supprimer tout ?');
  else if(b.id==='retryMatches'){S.pending.forEach(m=>delete m.syncError);save();pull(true)}
  else if(d.nc)two(b,()=>post('users/'+d.nc+'/code').then(r=>{NEWCODE={name:(USERS.find(u=>String(u.id)===d.nc)||{}).name,code:r.code};lastAdm='';pull(true)}).catch(()=>toast('Action refusée')),'Sûr ?');
  else if(d.adm){const u=USERS.find(x=>String(x.id)===d.adm);patch('users/'+d.adm,{role:u&&u.role==='admin'?'player':'admin'}).then(()=>pull(true)).catch(()=>toast('Action refusée'))}
  else if(d.du)two(b,()=>api('users/'+d.du,{method:'DELETE'}).then(()=>pull(true)).catch(e=>toast(e.status===409?'Terminez la session active de ce joueur avant de le supprimer':'Suppression impossible')),'Sûr ?');
  else if(b.id==='go')go();
  else if(b.id==='rst'){T.started&&!T.done?two(b,rst,'?'):rst()}
  else if(b.id==='val'){T.done?val():two(b,val)}
  else if(b.id==='t1'){au();halfBeep()}
  else if(b.id==='t2'){au();endBuzz()}
  else if(b.id==='gen')gen();
  else if(b.id==='clr'){S.setup.assign={};save();renderSetup()}
  else if(b.id==='start')startSession();
  else if(b.id==='endS')two(b,endSess,'Terminer ?');
  else if(b.id==='unl')two(b,endSess,'Débloquer ?');
  else if(b.id==='login')login();
  else if(b.id==='boot')boot();
  else if(b.id==='imp')two(b,doImport,'Confirmer ?');
  else if(b.id==='cpall'){try{navigator.clipboard.writeText(IMPORTED.codes.map(c=>c.name+' : '+c.code).join('\n'));toast('Copié')}catch(err){}}
  else if(b.id==='hideimp'){IMPORTED=null;lastAdm='';renderAdmin()}
  else if(b.id==='laundryStart')startLaundry();
  else if(b.id==='laundryDone')recordLaundry('done');
  else if(b.id==='laundrySkip')recordLaundry('skip');
  else if(b.id==='logout')logout();
  else if(b.id==='renameMe')renamePlayer(ME.id);
  else if(b.id==='myStats'){document.querySelector('[data-tab="me"]').click()}
  else if(d.rename)renamePlayer(d.rename);
  else if(b.id==='addu')addUser();
  else if(b.id==='saveLevels')saveLevels();
  else if(b.id==='cpcode'){try{navigator.clipboard.writeText(NEWCODE.code);toast('Copié')}catch(err){}}
  else if(b.id==='hidecode'){NEWCODE=null;lastAdm='';renderAdmin()}});
document.addEventListener('change',e=>{const el=e.target,s=el.dataset.sel;
  if(el.id==='yr'){YR=el.value;renderSeason();renderMe()}
  else if(el.id==='hd'){HD=el.value;renderHist()}
  else if(el.dataset.eg)editSet(el.dataset.eg,+el.dataset.ix,el.value)
  else if(el.id==='sessionSelect')renderSessionRank(M.filter(m=>dt(m).startsWith(YR)));
  else if(el.dataset.lv){LEVEL_CHANGES[el.dataset.lv]=+el.value;lastAdm='';renderAdmin()}
  else if(s&&MODE==='host'){const o=s==='a'?'b':'a';if(el.value===S.cur[o])S.cur[o]=S.cur[s];S.cur[s]=el.value;S.cur.goals.forEach(g=>{g.p=''});ch()}
  else if(el.id==='mm'||el.id==='ss'){S.dur=Math.max(10,((+$('#mm').value||0)*60)+(+$('#ss').value||0));save();if(!T.started)rst();else{drawT();pushLive(true)}}});
document.addEventListener('input',e=>{if(e.target.matches('.level-slider input[type="range"]'))e.target.style.setProperty('--level-value',e.target.value)});
document.addEventListener('click',e=>{const wrapper=e.target.closest('.level-slider[data-locked]');if(!wrapper)return;
  const now=Date.now(),last=LEVEL_TAPS.get(wrapper)||0;
  if(now-last<450){wrapper.removeAttribute('data-locked');wrapper.classList.remove('locked');const input=wrapper.querySelector('input[type="range"]');input.disabled=false;input.focus({preventScroll:true});wrapper.querySelector('.slider-hint')?.remove();LEVEL_TAPS.delete(wrapper)}
  else{LEVEL_TAPS.set(wrapper,now);toast('Touchez encore une fois rapidement pour activer le curseur')}});
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;if(e.target.id==='code')login();if(e.target.id==='nn')addUser()});

/* ---- init ---- */
$('#mm').value=Math.floor(S.dur/60);$('#ss').value=S.dur%60;
$('#sync').textContent='Connexion…';
{const v=$('#ver'),y=$('#cy');if(v)v.textContent='v'+(window.APP_VERSION||'');if(y)y.textContent=new Date().getFullYear()}
lock();setMode();restoreT();refresh();
pull();setInterval(pull,3000);setInterval(viewSync,250);setInterval(pushLive,1500);
