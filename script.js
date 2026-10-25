const TM={jaune:'Jaune',orange:'Orange',vert:'Vert',bleu:'Bleu'},ALL=['jaune','orange','vert','bleu'];
const $=s=>document.querySelector(s);


const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(){try{return JSON.parse(localStorage.getItem('futsal-v1'))}catch(e){return null}}
function save(){try{localStorage.setItem('futsal-v1',JSON.stringify(S))}catch(e){}}
let S=Object.assign({dur:390,cur:{a:'jaune',b:'orange',sa:0,sb:0},pending:[],setup:{teams:['jaune','orange','vert'],assign:{}},me:null,cache:null},load()||{});
if(!S.setup||!S.setup.teams)S.setup={teams:['jaune','orange','vert'],assign:{}};
if(S.setup.teams.length>3)S.setup.teams=S.setup.teams.slice(0,3);
if(!S.cur.goals)S.cur.goals=[];
let T,iv,wl,YR,R=[],M=[],SA=[],PL=[],USERS=[],LOADED=false,MODE='none',prev='',VER=0,busy=false,lastLive='',pushing=false,dirty=false,lastBoard='',lastBan='',lastSetup='',lastAdm='',NEWCODE=null,PICK=null,IMPORTED=null;
let ME=S.me,SESS=(ME&&S.cache&&S.cache.host_user===ME.id)?S.cache:null,TEAMS=S.setup.teams,CAN_IMPORT_SUPABASE=false;
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
function rst(){clearInterval(iv);T={run:false,rem:S.dur,end:0,half:false,done:false,started:false,hb:0};saveT();drawT();pushLive(true)}
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
  saveT();drawT();pushLive(true)}
function tick(){if(!T.run)return;T.rem=Math.max(0,(T.end-Date.now())/1000);
  if(!T.half&&T.rem<=S.dur/2){T.half=true;T.hb=Date.now()+4000;halfBeep();saveT();pushLive(true)}
  if(T.rem<=0){T.run=false;T.done=true;clearInterval(iv);endBuzz();saveT();pushLive(true)}
  drawT()}
function drawT(t=T,d=S.dur){const c=$('#tc'),hb=t.run&&Date.now()<(t.hb||0);
  $('#time').textContent=fmt(t.rem);$('#prog').style.width=Math.min(100,100*(1-t.rem/d))+'%';
  $('#ph').textContent=t.done?'TEMPS ÉCOULÉ !':hb?'🔔 MI-TEMPS':!t.started?(MODE==='view'?'En attente du coup d\'envoi':'Prêt, mi-temps à '+fmt(d/2)):!t.run?'En pause':t.half?'2e mi-temps':'1re mi-temps';
  c.classList.toggle('end',!!t.done);c.classList.toggle('hb',hb);
  if(MODE!=='host'||!SESS)return;
  const g=$('#go'),v=$('#val'),n=nSess(),mx=SESS.max,full=n>=mx;
  g.textContent=t.done?'Terminé':t.run?'⏸ Pause':t.started?'▶ Reprendre':'▶ Démarrer';g.disabled=t.done||full;
  v.classList.toggle('pulse',t.done);v.disabled=full;
  if(!v.dataset.arm)v.textContent=full?'Session terminée ('+mx+' matchs)':'✓ Valider le match ('+(n+1)+'/'+mx+')'}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lock();if(T.run)tick();pull()}});

/* ---- live : l'organisateur publie, les autres regardent ---- */
async function pushLive(force){if(MODE!=='host'||!SESS)return;if(pushing){if(force)dirty=true;return}
  const l={a:S.cur.a,b:S.cur.b,sa:S.cur.sa,sb:S.cur.sb,g:S.cur.goals,dur:S.dur,run:T.run,end:T.run?T.end:0,rem:T.run?0:Math.round(T.rem*10)/10,half:T.half,done:T.done,started:T.started},j=JSON.stringify(l);
  if(j===lastLive&&!force)return;pushing=true;
  try{await post('session/live',{id:SESS.id,live:l});lastLive=j}catch(e){}
  pushing=false;if(dirty){dirty=false;pushLive(true)}}
function viewSync(){if(MODE!=='view'||!SESS)return;const L=SESS.live||{},d=L.dur||390,rem=L.run?Math.max(0,(L.end-Date.now())/1000):(L.rem==null?d:L.rem);
  drawT({run:L.run&&rem>0,rem,half:L.half,done:L.done||(L.run&&rem<=0),started:L.started,hb:0},d);
  const k=[L.a,L.b,L.sa,L.sb,JSON.stringify(L.g||[])].join();if(k!==lastBoard){lastBoard=k;renderBoard()}}

/* ---- helpers ---- */
function two(b,fn,lbl){if(b.dataset.arm){clearTimeout(+b.dataset.arm);delete b.dataset.arm;b.textContent=b.dataset.o;b.classList.remove('arm');fn()}
  else{b.dataset.o=b.textContent;b.textContent=lbl||'Confirmer ?';b.classList.add('arm');
    b.dataset.arm=setTimeout(()=>{delete b.dataset.arm;b.textContent=b.dataset.o;b.classList.remove('arm')},3000)}}
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3500)}
function fix(){const c=S.cur;let a=c.a,b=c.b;
  if(!TEAMS.includes(a))a=TEAMS.find(t=>t!==b);
  if(!TEAMS.includes(b))b=TEAMS.find(t=>t!==a);
  if(a===b)b=TEAMS.find(t=>t!==a);c.a=a;c.b=b}
const ch=()=>{save();renderBoard();pushLive(true)};

/* ---- session ---- */
function setMode(){TEAMS=SESS&&SESS.teams?ALL.filter(t=>SESS.teams[t]):S.setup.teams;
  MODE=!SESS?'none':(isHost()?'host':'view');
  document.body.classList.toggle('anon',!ME);document.body.classList.toggle('view',MODE==='view');
  $('#setup').hidden=MODE!=='none';$('#live').hidden=MODE==='none';
  const ta=$('#tabAdmin');if(ta)ta.hidden=!isAdmin();
  const pa=$('#p-admin');if(pa){const leavingAdmin=!isAdmin()&&!pa.hidden;pa.hidden=!isAdmin();if(leavingAdmin){$('#p-session').hidden=false;document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('on',n.dataset.tab==='session'))}}
  if(MODE!=='host')closePick();
  if(MODE==='host')fix()}
function refresh(){setMode();renderAuth();renderWho();if(MODE!==prev){prev=MODE;lastBoard='';renderBoard();if(MODE==='host')drawT()}rebuild();renderSetup();renderAdmin();viewSync()}
const gcount=a=>{const m={};a.forEach(x=>m[x]=(m[x]||0)+1);return Object.entries(m).map(([k,n])=>n>1?k+' ×'+n:k).join(', ')};
function openPick(side){const t=S.cur[side],ps=(SESS&&SESS.teams&&SESS.teams[t])||[];
  if(!ps.length){addGoal(side,'',0);return}
  PICK=side;const el=$('#pick');
  el.innerHTML=`<div class="sheet t-${t}"><h3>Qui a marqué pour ${TM[t]} ?</h3><div class="pl">${ps.map((p,i)=>`<button class="pc on t-${t}" data-gp="${i}">${esc(p)}</button>`).join('')}</div><div class="set"><button class="sm" data-gp="csc">Contre son camp</button><button class="sm" data-gp="x">Inconnu</button><button class="sm" id="pickx">Annuler</button></div></div>`;
  el.hidden=false}
function closePick(){PICK=null;const el=$('#pick');if(el){el.hidden=true;el.innerHTML=''}}
function addGoal(side,p,og){S.cur['s'+side]++;S.cur.goals.push({s:side,p,og:og?1:0});navigator.vibrate&&navigator.vibrate(20);closePick();ch()}
function pickGoal(v){const side=PICK;if(!side)return;const ps=(SESS&&SESS.teams&&SESS.teams[S.cur[side]])||[];
  if(v==='csc')addGoal(side,'',1);else if(v==='x')addGoal(side,'',0);else if(ps[+v]!==undefined)addGoal(side,ps[+v],0)}
async function startSession(){const tm=S.setup.teams,as=S.setup.assign;
  if(PL.some(p=>as[p]==='P')){toast('Placez tous les joueurs présents dans une équipe, ou touchez 🎲');return}
  const roster={};tm.forEach(t=>roster[t]=PL.filter(p=>as[p]===t));
  const live={a:tm[0],b:tm[1],sa:0,sb:0,dur:S.dur,run:false,end:0,rem:S.dur,half:false,done:false,started:false};
  try{const r=await post('session/start',{teams:roster,date:today(),live});
    S.setup.assign={};S.cur={a:tm[0],b:tm[1],sa:0,sb:0,goals:[]};lastLive='';
    SESS={id:r.id,date:today(),host_user:ME.id,host_name:ME.name,teams:roster,live,status:'active',max:12};S.cache=SESS;save();
    refresh();rst();toast('Session démarrée')}
  catch(e){toast(e.status===409?'Une session est déjà en cours':'Impossible de démarrer : vérifiez la connexion');pull(true)}}
function endSess(){post('session/end',{id:SESS.id}).then(()=>{toast('Session terminée');pull(true)}).catch(()=>toast('Action refusée'))}
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
  $('#board').innerHTML=['a','b'].map(k=>`<div class="side t-${c[k]}"><select data-sel="${k}"${dis} aria-label="Équipe">${TEAMS.map(x=>`<option value="${x}"${x===c[k]?' selected':''}>${TM[x]}</option>`).join('')}</select><div class="n">${c['s'+k]}</div><div class="gl">${esc(gcount(G.filter(g=>g.s===k).map(g=>g.og?'csc':(g.p||'?'))))}</div><button class="plus ctl" data-add="${k}">+1</button><button class="minus ctl" data-sub="${k}">−1</button></div>`).join('')}
function renderBan(){const b=$('#ban');let h='';
  if(SESS&&MODE!=='none'){const i='match '+Math.min(nSess()+1,SESS.max)+'/'+SESS.max;
    h=MODE==='host'?`<span>Session en cours · ${i}</span><button class="sm" id="endS">Terminer</button>`:`<span>🔒 Session de <b>${esc(SESS.host_name||'?')}</b> · ${i}</span>${isAdmin()?'<button class="sm" id="unl">Débloquer</button>':''}`}
  if(h!==lastBan){lastBan=h;b.innerHTML=h}}
function renderAuth(){const el=$('#auth');if(ME){el.innerHTML='';return}
  if(!el.firstChild){el.innerHTML=`<div class="card empty" id="authwait">Vérification de l'installation…</div><div class="card" id="logincard" hidden><h2>Futsal Aytré</h2><p class="note" style="margin:0 0 12px">Entrez votre code d'activation personnel. Il n'est demandé qu'une seule fois sur ce téléphone.</p><div class="set"><input class="in" id="code" type="text" autocapitalize="characters" autocomplete="off" spellcheck="false" placeholder="XXXXX-XXXXX" maxlength="14"><button id="login">Entrer</button></div><p class="note" id="autherr" role="alert"></p><p class="note">Pas de code ? Demandez-le à un admin du groupe.</p></div><div class="card" id="firstrun" hidden><h2>Première installation</h2><p class="note" style="margin:0 0 10px">Créez le compte administrateur. La clé d'installation est la valeur de SETUP_KEY dans Cloudflare.</p><div class="set"><input class="in" id="sk" type="password" placeholder="Clé d'installation" autocomplete="off"></div><div class="set"><input class="in" id="bn" type="text" maxlength="30" placeholder="Votre prénom"><button id="boot">Créer</button></div><p class="note" id="setuperr" role="alert"></p></div>`;
    api('setup').then(r=>{const w=$('#authwait'),l=$('#logincard'),f=$('#firstrun');if(w)w.hidden=true;if(l)l.hidden=!!r.needsAdmin;if(f)f.hidden=!r.needsAdmin}).catch(()=>{const w=$('#authwait');if(w)w.textContent='Vérification impossible. Rechargez la page pour réessayer.'})}}
function renderWho(){const w=$('#who');if(w)w.innerHTML=ME?`<span>Connecté : <b>${esc(ME.name)}</b>${isAdmin()?' (admin)':''}</span><button class="sm" id="logout">Se déconnecter</button>`:''}
function renderSetup(){const el=$('#setup');if(MODE!=='none')return;let h='';
  if(ME&&!LOADED)h='<div class="card empty">Connexion…</div>';
  else if(ME){const tm=S.setup.teams,as=S.setup.assign,pres=PL.filter(p=>as[p]).length;
    h=`<div class="card"><h2>Nouvelle session</h2><p class="note" style="margin:0 0 10px">Aucune session en cours. Votre compte (${esc(ME.name)}) gérera le chrono et la validation des scores jusqu'à la fin des 12 matchs. Les autres suivent en direct.</p>
<div class="set"><label>Équipes ce soir (2 ou 3)</label><span>${ALL.map(t=>`<button class="chip t-${t}${tm.includes(t)?' on':''}" data-tg="${t}">${TM[t]}</button>`).join(' ')}</span></div></div>
<div class="card"><h2>Joueurs présents</h2><p class="note" style="margin:0">Touchez un joueur pour le faire passer d’absent à présent, puis choisissez une équipe. Touchez-le à nouveau pour le remettre absent. Ou touchez 🎲 pour des équipes équilibrées.</p>
<div class="pl">${PL.map((p,i)=>{const t=as[p];return `<button class="pc${!t?' absent':t==='P'?' pr':' on t-'+t}" data-pi="${i}">${esc(p)}${!t?'<small>absent</small>':t==='P'?'<small>présent</small>':`<small>${TM[t]}</small>`}</button>`}).join('')||`<span class="note">${isAdmin()?'Aucun joueur : ajoutez-en dans l\'onglet Joueurs.':'Aucun joueur : demandez à un admin d\'en ajouter.'}</span>`}</div>
<div class="set"><button id="gen"${pres<tm.length?' disabled':''}>🎲 Générer les équipes</button><button class="sm" id="toggle-pres">${pres===PL.length&&PL.length?'Tous absents':'Tous présents'}</button></div>
${tm.map(t=>{const n=PL.filter(p=>as[p]===t);return `<div class="ro t-${t}"><b>${TM[t]}</b> (${n.length}) ${n.map(esc).join(', ')}</div>`}).join('')}</div>
<button class="val" id="start">▶ Démarrer la session</button>`}
  if(h!==lastSetup){lastSetup=h;el.innerHTML=h}}
function renderAdmin(){const el=$('#adm');if(!el)return;if(!isAdmin()){el.replaceChildren();return}let h='';
  if(isAdmin()){
    const nc=NEWCODE?`<div class="card code"><div>Code de <b>${esc(NEWCODE.name||'')}</b></div><div class="big">${esc(NEWCODE.code)}</div><p class="note">À lui transmettre maintenant. Il ne sera plus affiché.</p><div class="set"><button class="sm" id="cpcode">Copier</button><button class="sm" id="hidecode">J'ai noté le code</button></div></div>`:'';
    const lv=(n)=>[1,2,3,4,5].map(x=>`<option${x===n?' selected':''}>${x}</option>`).join('');
    const imp=IMPORTED?`<div class="card code"><h2>Codes des joueurs repris</h2><p class="note">${IMPORTED.stats.matchs} matchs repris. À transmettre maintenant : ces codes ne seront plus affichés.</p>${IMPORTED.codes.map(c=>`<div class="ur"><b>${esc(c.name)}</b><span class="big" style="font-size:26px">${esc(c.code)}</span></div>`).join('')}<div class="set"><button class="sm" id="cpall">Copier la liste</button><button class="sm" id="hideimp">J'ai noté les codes</button></div></div>`:'';
    const importCard=CAN_IMPORT_SUPABASE?`<div class="card"><h2>Historique Supabase</h2><p class="note" style="margin:0 0 10px">Reprend les joueurs, sessions et matchs de l'ancienne base. Possible une seule fois, sur une base sans match.</p><button id="imp">Importer l'historique Supabase</button></div>`:'';
    h=nc+imp+`<div class="card"><h2>Nouveau joueur</h2><div class="set"><input class="in" id="nn" type="text" maxlength="30" placeholder="Prénom"></div><div class="set"><label>Niveau</label><select class="sel" id="nl">${lv(3)}</select><label><input type="checkbox" id="na"> Admin</label><button id="addu">Créer</button></div><p class="note">Niveau de 1 (débutant) à 5 (très fort). Un code d'activation unique est généré pour ce joueur.</p></div>
${importCard}
<div class="card"><h2>Joueurs (${USERS.length})</h2>${USERS.map(u=>`<div class="ur"><b>${esc(u.name)}${u.role==='admin'?' <span class="badge">admin</span>':''}</b><label>Niveau <select class="sel" data-lv="${u.id}">${lv(u.level)}</select></label><button class="sm" data-nc="${u.id}">Nouveau code</button>${u.id===ME.id?'':`<button class="sm" data-adm="${u.id}">${u.role==='admin'?'Retirer admin':'Passer admin'}</button><button class="sm" data-du="${u.id}" aria-label="Supprimer ${esc(u.name)}">✕</button>`}</div>`).join('')||'<div class="empty">Aucun joueur.</div>'}</div>`}
  if(h!==lastAdm){lastAdm=h;el.innerHTML=h}}
function calc(L,teams){const r={};teams.forEach(t=>r[t]={t,j:0,v:0,n:0,l:0,gf:0,ga:0,d:0,p:0});
  L.forEach(m=>{const A=r[m.a],B=r[m.b];if(!A||!B)return;A.j++;B.j++;A.gf+=m.sa;B.gf+=m.sb;A.d+=m.sa-m.sb;B.d+=m.sb-m.sa;
    if(m.sa>m.sb){A.v++;B.l++;A.p+=3}else if(m.sb>m.sa){B.v++;A.l++;B.p+=3}else{A.n++;B.n++;A.p++;B.p++}});
  return Object.values(r).sort((x,y)=>y.p-x.p||y.d-x.d||y.gf-x.gf)}
function renderRank(){const L=calc(M.filter(m=>dt(m)===today()),ALL).filter(x=>x.j);
  $('#tb').innerHTML=L.length?'<tr><th></th><th>Équipe</th><th>J</th><th>Diff</th><th>Pts</th></tr>'+L.map((x,i)=>`<tr class="t-${x.t}"><td class="rk">${i+1}</td><td><i class="dot"></i>${TM[x.t]}</td><td>${x.j}</td><td>${sg(x.d)}</td><td class="pt">${x.p}</td></tr>`).join(''):'<tr><td class="empty">Aucun match aujourd\'hui.</td></tr>'}
function renderHist(){const H=$('#hist'),E=M.map((m,i)=>[m,i]).filter(([m])=>dt(m)===today());
  if(!E.length){H.innerHTML='<div class="empty">Aucun match aujourd\'hui.<br>Validez un match pour le voir ici.</div>';return}
  H.innerHTML=E.map(([m,i],k)=>`<div class="h"><span class="no">${k+1}</span><span class="tm t-${m.a}"><i class="dot"></i>${TM[m.a]}</span><span class="sc">${m.sa} – ${m.sb}</span><span class="tm t-${m.b}"><i class="dot"></i>${TM[m.b]}</span>${isAdmin()&&m.id?`<button data-del="${i}" aria-label="Supprimer le match ${k+1}">✕</button>`:'<span></span>'}${gtxt(m)}</div>`).reverse().join('')}
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
  el.innerHTML=h}
function renderSeason(){const ys=[...new Set(M.map(m=>dt(m).slice(0,4)).concat(today().slice(0,4)))].sort().reverse();
  if(!YR||!ys.includes(YR))YR=ys[0];
  $('#yr').innerHTML=ys.map(y=>`<option${y===YR?' selected':''}>${y}</option>`).join('');
  const L=M.filter(m=>dt(m).startsWith(YR)),by={},W=Object.fromEntries(ALL.map(t=>[t,0]));
  L.forEach(m=>(by[dt(m)]=by[dt(m)]||[]).push(m));
  const evs=Object.keys(by).sort().reverse().map(d=>({d,r:calc(by[d],ALL).filter(x=>x.j)}));
  evs.forEach(e=>{if(e.r.length)W[e.r[0].t]++});
  $('#sea').innerHTML=L.length?'<table class="cp"><tr><th></th><th>Équipe</th><th>J</th><th>V-N-D</th><th>Diff</th><th>Pts</th><th>Moy</th><th>🏅</th></tr>'+calc(L,ALL).filter(x=>x.j).map((x,i)=>`<tr class="t-${x.t}"><td class="rk">${i+1}</td><td><i class="dot"></i>${TM[x.t]}</td><td>${x.j}</td><td>${x.v}-${x.n}-${x.l}</td><td>${sg(x.d)}</td><td class="pt">${x.p}</td><td>${x.j?(x.p/x.j).toFixed(2):'–'}</td><td>${W[x.t]}</td></tr>`).join('')+`</table><p class="note">${L.length} matchs sur ${evs.length} soirées. Moy : points par match. 🏅 : soirées gagnées.</p>`:`<div class="empty">Aucun match en ${YR}.</div>`;
  renderPlayers(L);
  $('#evs').innerHTML=evs.length?evs.map(e=>`<div class="ev"><b>${new Date(e.d+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</b><span class="w t-${e.r[0].t}"><i class="dot"></i>${TM[e.r[0].t]}</span><small>${e.r.map(x=>TM[x.t]+' '+x.p).join(', ')}</small></div>`).join(''):''}

/* ---- API ---- */
const api=(p,o={})=>fetch('/api/'+p,{credentials:'same-origin',...o,headers:{'Content-Type':'application/json'}}).then(async r=>{const t=await r.text();let b=null;try{b=t?JSON.parse(t):null}catch(e){}if(!r.ok){const e=new Error(r.status);e.status=r.status;e.body=b;throw e}return b});
const post=(p,b)=>api(p,{method:'POST',body:JSON.stringify(b||{})});
const patch=(p,b)=>api(p,{method:'PATCH',body:JSON.stringify(b||{})});
function rebuild(){M=R.concat(S.pending);renderRank();renderHist();renderSeason();renderMe();renderBan();if(MODE==='host')drawT()}
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
    if(!st.same){const wh=isHost();VER=st.v;LOADED=true;ME=st.me;S.me=ME;CAN_IMPORT_SUPABASE=!!st.canImportSupabase;const gm={};(st.goals||[]).forEach(g=>(gm[g.match_id]=gm[g.match_id]||[]).push({team:g.team,p:g.p,og:g.og}));R=st.matches.map(m=>({...m,goals:gm[m.id]||[]}));SA=st.sessions;USERS=st.users;PL=st.users.map(u=>u.name);
      SESS=st.sessions.find(x=>x.status==='active')||null;S.cache=isHost()?SESS:null;
      if(wh&&!isHost())toast('Session terminée');
      save();refresh()}
    syncStatus()}
  catch(e){if(e.status===401){ME=null;S.me=null;S.cache=null;SESS=null;LOADED=false;save();refresh()}else if(pendingFailure)syncStatus();else $('#sync').textContent=e.status>=400&&e.status<500?'Synchronisation refusée (HTTP '+e.status+')':'Hors ligne, nouvel essai…'}
  busy=false}

/* ---- événements ---- */
document.addEventListener('click',e=>{if(e.target.id==='pick'){closePick();return}const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.sessionView){document.querySelectorAll('.session-view').forEach(v=>v.hidden=v.id!=='session-'+d.sessionView);
    document.querySelectorAll('[data-session-view]').forEach(t=>{const active=t===b;t.classList.toggle('on',active);t.setAttribute('aria-pressed',String(active))});scrollTo(0,0)}
  else if(d.tab){if(d.tab==='admin'&&!isAdmin())return;const pane=d.tab==='session'?'p-session':'p-'+d.tab;
    document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!==pane);
    document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('on',n===b));scrollTo(0,0)}
  else if(d.add&&MODE==='host')openPick(d.add);
  else if(d.gp!==undefined)pickGoal(d.gp);
  else if(b.id==='pickx')closePick();
  else if(d.sub&&MODE==='host'){const g=S.cur.goals;let i=-1;for(let x=g.length-1;x>=0;x--)if(g[x].s===d.sub){i=x;break}if(i>=0)g.splice(i,1);S.cur['s'+d.sub]=Math.max(0,S.cur['s'+d.sub]-1);ch()}
  else if(d.tg){const t=d.tg,L=S.setup.teams;
    if(L.includes(t)){if(L.length>2){S.setup.teams=L.filter(x=>x!==t);for(const p in S.setup.assign)if(S.setup.assign[p]===t)delete S.setup.assign[p]}}
    else if(L.length>=3){toast('Maximum 3 équipes ce soir');return}
    else S.setup.teams=ALL.filter(x=>x===t||L.includes(x));
    save();renderSetup()}
  else if(d.pi!==undefined){const p=PL[+d.pi],as=S.setup.assign;
    if(!as[p])as[p]='P';else if(as[p]==='P')as[p]=S.setup.teams[0];else delete as[p];
    save();lastSetup='';renderSetup()}
  else if(b.id==='toggle-pres'){const as=S.setup.assign,allPresent=PL.length>0&&PL.every(p=>!!as[p]);
    PL.forEach(p=>{if(allPresent)delete as[p];else if(!as[p])as[p]='P'});save();lastSetup='';renderSetup()}
  else if(d.del!==undefined)two(b,()=>{const m=M[+d.del];if(m&&m.id)api('matches/'+m.id,{method:'DELETE'}).then(()=>pull(true)).catch(()=>toast('Suppression impossible'))},'Sûr ?');
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
  else if(b.id==='logout')logout();
  else if(b.id==='addu')addUser();
  else if(b.id==='cpcode'){try{navigator.clipboard.writeText(NEWCODE.code);toast('Copié')}catch(err){}}
  else if(b.id==='hidecode'){NEWCODE=null;lastAdm='';renderAdmin()}});
document.addEventListener('change',e=>{const el=e.target,s=el.dataset.sel;
  if(el.id==='yr'){YR=el.value;renderSeason();renderMe()}
  else if(el.dataset.lv)patch('users/'+el.dataset.lv,{level:+el.value}).then(()=>pull(true)).catch(()=>toast('Action refusée'));
  else if(s&&MODE==='host'){const o=s==='a'?'b':'a';if(el.value===S.cur[o])S.cur[o]=S.cur[s];S.cur[s]=el.value;S.cur.goals.forEach(g=>{g.p=''});ch()}
  else if(el.id==='mm'||el.id==='ss'){S.dur=Math.max(10,((+$('#mm').value||0)*60)+(+$('#ss').value||0));save();if(!T.started)rst();else{drawT();pushLive(true)}}});
document.addEventListener('keydown',e=>{if(e.key!=='Enter')return;if(e.target.id==='code')login();if(e.target.id==='nn')addUser()});

/* ---- init ---- */
$('#date').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
$('#mm').value=Math.floor(S.dur/60);$('#ss').value=S.dur%60;
$('#sync').textContent='Connexion…';
{const v=$('#ver'),y=$('#cy');if(v)v.textContent='v'+(window.APP_VERSION||'');if(y)y.textContent=new Date().getFullYear()}
lock();setMode();restoreT();refresh();
pull();setInterval(pull,3000);setInterval(viewSync,250);setInterval(pushLive,1500);
