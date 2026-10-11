const TM={jaune:'Jaune',orange:'Orange',vert:'Vert',bleu:'Bleu'},ALL=['jaune','orange','vert','bleu'];
const $=s=>document.querySelector(s);
const SB_URL='https://fuaihkklnygbbiketvjb.supabase.co';
const SB_KEY='sb_publishable_gpkEUB2YbT1Q6jGO3AoUPQ_EpH6CpZQ';
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function load(){try{return JSON.parse(localStorage.getItem('futsal-v1'))}catch(e){return null}}
function save(){try{localStorage.setItem('futsal-v1',JSON.stringify(S))}catch(e){}}
let S=Object.assign({dur:390,cur:{a:'jaune',b:'orange',sa:0,sb:0},pending:[],setup:{teams:['jaune','orange','vert'],assign:{}},host:'',mine:null,cache:null},load()||{});
if(!S.setup||!S.setup.teams)S.setup={teams:['jaune','orange','vert'],assign:{}};
let T,iv,wl,YR,R=[],M=[],SA=[],PL=[],LOADED=false,MODE='none',prev='',lastJ='',busy=false,ADM='',lastLive='',pushing=false,lastBoard='',lastBan='',lastSetup='',DELP=false;
let SESS=(S.mine&&S.cache&&S.cache.id===S.mine.id)?S.cache:null,TEAMS=S.setup.teams;
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
function saveT(){S.timer=(SESS&&S.mine)?{sid:SESS.id,run:T.run,end:T.end,rem:T.rem,half:T.half,done:T.done,started:T.started}:null;save()}
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
let dirty=false;
async function pushLive(force){if(MODE!=='host'||!SESS)return;if(pushing){if(force)dirty=true;return}
  const l={a:S.cur.a,b:S.cur.b,sa:S.cur.sa,sb:S.cur.sb,dur:S.dur,run:T.run,end:T.run?T.end:0,rem:T.run?0:Math.round(T.rem*10)/10,half:T.half,done:T.done,started:T.started},j=JSON.stringify(l);
  if(j===lastLive&&!force)return;pushing=true;
  try{await sb('rpc/live_update',{method:'POST',body:JSON.stringify({p_id:SESS.id,p_token:S.mine.token,p_live:l})});lastLive=j}catch(e){}
  pushing=false;if(dirty){dirty=false;pushLive(true)}}
function viewSync(){if(MODE!=='view'||!SESS)return;const L=SESS.live||{},d=L.dur||390,rem=L.run?Math.max(0,(L.end-Date.now())/1000):(L.rem==null?d:L.rem);
  drawT({run:L.run&&rem>0,rem,half:L.half,done:L.done||(L.run&&rem<=0),started:L.started,hb:0},d);
  const k=[L.a,L.b,L.sa,L.sb].join();if(k!==lastBoard){lastBoard=k;renderBoard()}}

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
  MODE=!SESS?'none':(S.mine&&S.mine.id===SESS.id?'host':'view');
  document.body.classList.toggle('view',MODE==='view');
  $('#setup').hidden=MODE!=='none';$('#live').hidden=MODE==='none';
  if(MODE==='host')fix()}
function refresh(){setMode();if(MODE!==prev){prev=MODE;lastBoard='';renderBoard();if(MODE==='host')drawT()}rebuild();renderSetup();viewSync()}
async function startSession(){const tm=S.setup.teams,roster={};
  tm.forEach(t=>roster[t]=Object.keys(S.setup.assign).filter(p=>S.setup.assign[p]===t));
  const tok=(window.crypto&&crypto.randomUUID&&crypto.randomUUID())||(Date.now()+'-'+Math.random().toString(36).slice(2));
  const live={a:tm[0],b:tm[1],sa:0,sb:0,dur:S.dur,run:false,end:0,rem:S.dur,half:false,done:false,started:false};
  try{const id=await sb('rpc/start_session',{method:'POST',body:JSON.stringify({p_token:tok,p_date:today(),p_host:'',p_teams:roster,p_live:live})});
    S.mine={id,token:tok};S.setup.assign={};S.cur={a:tm[0],b:tm[1],sa:0,sb:0};lastLive='';
    SESS={id,date:today(),host:'',teams:roster,live,status:'active',max:12};S.cache=SESS;save();
    refresh();rst();toast('Session démarrée')}
  catch(e){toast(e.status>=400&&e.status<500?'Une session est déjà en cours':'Impossible de démarrer : vérifiez la connexion');pull()}}
function delPlayer(p){if(!confirm('Supprimer '+p+' de la liste des joueurs ?'))return;
  const c=ADM||prompt('Code administrateur');if(!c)return;
  sb('rpc/delete_player',{method:'POST',body:JSON.stringify({p_name:p,p_code:c})}).then(()=>{ADM=c;delete S.setup.assign[p];PL=PL.filter(x=>x!==p);lastJ='';lastSetup='';save();renderSetup();pull();toast(p+' supprimé')}).catch(()=>{ADM='';toast('Code incorrect, joueur non supprimé')})}
function endSess(sec,adm){sb('rpc/end_session',{method:'POST',body:JSON.stringify({p_id:SESS.id,p_secret:sec})})
  .then(()=>{if(adm)ADM=sec;lastJ='';pull();toast('Session terminée')}).catch(()=>{if(adm)ADM='';toast('Code incorrect')})}
async function addPlayer(){const i=$('#np'),n=i.value.trim().slice(0,30);if(!n)return;
  let p=PL.find(x=>x.toLowerCase()===n.toLowerCase());
  if(!p){p=n;PL.push(p);PL.sort((a,b)=>a.localeCompare(b,'fr'));
    try{await sb('players',{method:'POST',body:JSON.stringify({name:p})})}catch(e){if(e.status!==409)toast('Joueur non enregistré (réseau ?)')}}
  const as=S.setup.assign,cnt=t=>Object.values(as).filter(x=>x===t).length;
  as[p]=S.setup.teams.slice().sort((x,y)=>cnt(x)-cnt(y))[0];save();lastSetup='';renderSetup()}

/* ---- match ---- */
function val(){if(MODE!=='host')return;if(nSess()>=SESS.max){toast('Limite de '+SESS.max+' matchs atteinte');return}
  const c=S.cur,m={date:today(),ts:Date.now(),a:c.a,b:c.b,sa:c.sa,sb:c.sb,session_id:SESS.id,sid:SESS.id,tok:S.mine.token};
  S.pending.push(m);save();rebuild();
  const stay=c.sa>c.sb?c.a:c.b,td=M.filter(x=>x.session_id===SESS.id),last=t=>{for(let i=td.length-1;i>=0;i--)if(td[i].a===t||td[i].b===t)return i;return -1},
    nx=TEAMS.filter(t=>t!==c.a&&t!==c.b).sort((x,y)=>last(x)-last(y))[0];
  if(nx){S.cur={a:stay,b:nx,sa:0,sb:0};toast(TM[stay]+' reste, '+TM[nx]+' entre')}
  else{S.cur={a:c.a,b:c.b,sa:0,sb:0};toast('Match enregistré')}
  save();rst();renderBoard();pull()}

/* ---- rendu ---- */
function renderBoard(){let c=S.cur;if(MODE==='view'){const L=(SESS&&SESS.live)||{};c={a:L.a||TEAMS[0],b:L.b||TEAMS[1],sa:L.sa||0,sb:L.sb||0}}
  const dis=MODE==='view'?' disabled':'';
  $('#board').innerHTML=['a','b'].map(k=>`<div class="side t-${c[k]}"><select data-sel="${k}"${dis} aria-label="Équipe">${TEAMS.map(x=>`<option value="${x}"${x===c[k]?' selected':''}>${TM[x]}</option>`).join('')}</select><div class="n">${c['s'+k]}</div><button class="plus ctl" data-add="${k}">+1</button><button class="minus ctl" data-sub="${k}">−1</button></div>`).join('')}
function renderBan(){const b=$('#ban');let h='';
  if(SESS&&MODE!=='none'){const i='match '+Math.min(nSess()+1,SESS.max)+'/'+SESS.max;
    h=MODE==='host'?`<span>Session en cours · ${i}</span><button class="sm" id="endS">Terminer</button>`:`<span>🔒 Session en cours sur un autre téléphone · ${i}</span><button class="sm" id="unl">Débloquer</button>`}
  if(h!==lastBan){lastBan=h;b.innerHTML=h}}
function renderSetup(){const el=$('#setup');if(MODE!=='none')return;let h;
  if(!LOADED)h='<div class="card empty">Connexion à la base…</div>';
  else{const tm=S.setup.teams,as=S.setup.assign;
    h=`<div class="card"><h2>Nouvelle session</h2><p class="note" style="margin:0 0 10px">Aucune session en cours. Ce téléphone gérera le chrono et la validation des scores jusqu'à la fin des 12 matchs. Les autres téléphones suivront en direct.</p>
<div class="set"><label>Équipes ce soir</label><span>${ALL.map(t=>`<button class="chip t-${t}${tm.includes(t)?' on':''}" data-tg="${t}">${TM[t]}</button>`).join(' ')}</span></div></div>
<div class="card"><h2>Joueurs présents</h2><p class="note" style="margin:0">Touchez un joueur pour le placer dans une équipe. Touchez encore pour changer d'équipe, puis « absent ».</p>
<div class="pl">${PL.map((p,i)=>{const t=as[p];return `<button class="pc${t?' on t-'+t:''}${DELP?' del':''}" data-pi="${i}">${DELP?'✕ ':''}${esc(p)}${t&&!DELP?`<small>${TM[t]}</small>`:''}</button>`}).join('')||'<span class="note">Aucun joueur pour l\'instant, ajoutez-en ci-dessous.</span>'}</div>
<div class="set"><input class="in" id="np" type="text" maxlength="30" placeholder="Nouveau joueur"><button id="addp">Ajouter</button></div>
<div class="set"><button class="sm" id="delmode">${DELP?'Terminé':'✎ Supprimer un joueur'}</button>${DELP?'<span class="note">Touchez un joueur pour le supprimer (code admin).</span>':''}</div>
${tm.map(t=>{const n=PL.filter(p=>as[p]===t);return `<div class="ro t-${t}"><b>${TM[t]}</b> (${n.length}) ${n.map(esc).join(', ')}</div>`}).join('')}</div>
<button class="val" id="start">▶ Démarrer la session</button>`}
  if(h!==lastSetup){lastSetup=h;el.innerHTML=h}}
function calc(L,teams){const r={};teams.forEach(t=>r[t]={t,j:0,v:0,n:0,l:0,gf:0,ga:0,d:0,p:0});
  L.forEach(m=>{const A=r[m.a],B=r[m.b];if(!A||!B)return;A.j++;B.j++;A.gf+=m.sa;B.gf+=m.sb;A.d+=m.sa-m.sb;B.d+=m.sb-m.sa;
    if(m.sa>m.sb){A.v++;B.l++;A.p+=3}else if(m.sb>m.sa){B.v++;A.l++;B.p+=3}else{A.n++;B.n++;A.p++;B.p++}});
  return Object.values(r).sort((x,y)=>y.p-x.p||y.d-x.d||y.gf-x.gf)}
function renderRank(){const L=calc(M.filter(m=>dt(m)===today()),ALL).filter(x=>x.j);
  $('#tb').innerHTML=L.length?'<tr><th></th><th>Équipe</th><th>J</th><th>Diff</th><th>Pts</th></tr>'+L.map((x,i)=>`<tr class="t-${x.t}"><td class="rk">${i+1}</td><td><i class="dot"></i>${TM[x.t]}</td><td>${x.j}</td><td>${sg(x.d)}</td><td class="pt">${x.p}</td></tr>`).join(''):'<tr><td class="empty">Aucun match aujourd\'hui.</td></tr>'}
function renderHist(){const H=$('#hist'),E=M.map((m,i)=>[m,i]).filter(([m])=>dt(m)===today());
  if(!E.length){H.innerHTML='<div class="empty">Aucun match aujourd\'hui.<br>Validez un match pour le voir ici.</div>';return}
  H.innerHTML=E.map(([m,i],k)=>`<div class="h"><span class="no">${k+1}</span><span class="tm t-${m.a}"><i class="dot"></i>${TM[m.a]}</span><span class="sc">${m.sa} – ${m.sb}</span><span class="tm t-${m.b}"><i class="dot"></i>${TM[m.b]}</span><button data-del="${i}" aria-label="Supprimer le match ${k+1}">✕</button></div>`).reverse().join('')}
function renderPlayers(L){const SM=Object.fromEntries(SA.map(s=>[s.id,s])),r={};
  L.forEach(m=>{const s=SM[m.session_id];if(!s||!s.teams)return;
    [[m.a,m.sa,m.sb],[m.b,m.sb,m.sa]].forEach(([t,f,g])=>(s.teams[t]||[]).forEach(p=>{const x=r[p]||(r[p]={p,j:0,v:0,n:0,l:0});x.j++;f>g?x.v++:f<g?x.l++:x.n++}))});
  const A=Object.values(r).sort((x,y)=>y.v-x.v||y.v/y.j-x.v/x.j||y.j-x.j);
  $('#pls').innerHTML='<h2>Classement des joueurs</h2>'+(A.length?'<table class="cp"><tr><th></th><th>Joueur</th><th>J</th><th>V-N-D</th><th>% V</th><th>V</th></tr>'+A.map((x,i)=>`<tr><td class="rk">${i+1}</td><td>${esc(x.p)}</td><td>${x.j}</td><td>${x.v}-${x.n}-${x.l}</td><td>${Math.round(100*x.v/x.j)}%</td><td class="pt">${x.v}</td></tr>`).join('')+'</table><p class="note">Classé par victoires, puis % de victoires.</p>':'<div class="empty">Pas encore de joueurs. Ajoutez-les au démarrage d\'une session.</div>')}
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

/* ---- base de données ---- */
const sb=(p,o={})=>fetch(SB_URL+'/rest/v1/'+p,{...o,headers:{apikey:SB_KEY,...(SB_KEY.startsWith('eyJ')?{Authorization:'Bearer '+SB_KEY}:{}),'Content-Type':'application/json',Prefer:'return=minimal'}}).then(async r=>{if(!r.ok){const e=new Error(r.status);e.status=r.status;throw e}const t=await r.text();return t?JSON.parse(t):null});
function rebuild(){M=R.concat(S.pending);renderRank();renderHist();renderSeason();renderBan();if(MODE==='host')drawT()}
async function pull(){if(busy||document.hidden)return;busy=true;
  try{let fl=false;
    for(const m of [...S.pending]){
      try{await sb('rpc/add_match',{method:'POST',body:JSON.stringify({p_id:m.sid,p_token:m.tok,p_ts:m.ts,p_date:m.date,p_a:m.a,p_b:m.b,p_sa:m.sa,p_sb:m.sb})})}
      catch(e){if(e.status===409){}else if(e.status>=400&&e.status<500)toast('Un match n\'a pas pu être enregistré (session terminée)');else throw e}
      S.pending=S.pending.filter(x=>x!==m);save();fl=true}
    const [n,ss,pl]=await Promise.all([sb('matches?select=*&order=ts.asc'),sb('sessions?select=id,date,host,teams,live,status,max&order=id.asc'),sb('players?select=name&order=name.asc')]);
    $('#sync').textContent='☁ Synchronisé';
    const j=JSON.stringify([n,ss,pl]);
    if(j!==lastJ||fl||!LOADED){lastJ=j;LOADED=true;R=n;SA=ss;PL=pl.map(p=>p.name);
      let a=ss.find(x=>x.status==='active')||null;
      if(S.mine){const mine=ss.find(x=>x.id===S.mine.id);
        if(mine&&mine.status!=='active'){S.mine=null;S.cache=null;toast('Session terminée')}
        else if(!mine&&!a&&SESS&&SESS.id===S.mine.id)a=SESS}
      SESS=a;if(S.mine&&a&&a.id===S.mine.id)S.cache=a;save();refresh()}}
  catch(e){$('#sync').textContent='Hors ligne, nouvel essai…'}
  busy=false}

/* ---- événements ---- */
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.tab){document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!=='p-'+d.tab);
    document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('on',n===b));scrollTo(0,0)}
  else if(d.add&&MODE==='host'){S.cur['s'+d.add]++;navigator.vibrate&&navigator.vibrate(20);ch()}
  else if(d.sub&&MODE==='host'){S.cur['s'+d.sub]=Math.max(0,S.cur['s'+d.sub]-1);ch()}
  else if(d.tg){const t=d.tg,L=S.setup.teams;
    if(L.includes(t)){if(L.length>2){S.setup.teams=L.filter(x=>x!==t);for(const p in S.setup.assign)if(S.setup.assign[p]===t)delete S.setup.assign[p]}}
    else S.setup.teams=ALL.filter(x=>x===t||L.includes(x));
    save();renderSetup()}
  else if(d.pi!==undefined){if(DELP){delPlayer(PL[+d.pi]);return}const p=PL[+d.pi],as=S.setup.assign,o=[null,...S.setup.teams],nx=o[(o.indexOf(as[p]||null)+1)%o.length];
    if(nx)as[p]=nx;else delete as[p];save();renderSetup()}
  else if(d.del!==undefined)two(b,()=>{const m=M[+d.del];if(m.id){const c=ADM||prompt('Code administrateur');if(!c)return;sb('rpc/delete_match',{method:'POST',body:JSON.stringify({match_id:m.id,admin_code:c})}).then(()=>{ADM=c;lastJ='';pull()}).catch(()=>{ADM='';toast('Code incorrect, match non supprimé')})}else{S.pending=S.pending.filter(x=>x!==m);save();rebuild()}},'Sûr ?');
  else if(b.id==='go')go();
  else if(b.id==='rst'){T.started&&!T.done?two(b,rst,'?'):rst()}
  else if(b.id==='val'){T.done?val():two(b,val)}
  else if(b.id==='t1'){au();halfBeep()}
  else if(b.id==='t2'){au();endBuzz()}
  else if(b.id==='addp')addPlayer();
  else if(b.id==='delmode'){DELP=!DELP;renderSetup()}
  else if(b.id==='start')startSession();
  else if(b.id==='endS')two(b,()=>endSess(S.mine.token),'Terminer ?');
  else if(b.id==='unl'){const c=ADM||prompt('Code administrateur');if(c)endSess(c,true)}});
document.addEventListener('change',e=>{const el=e.target,s=el.dataset.sel;
  if(el.id==='yr'){YR=el.value;renderSeason()}
  else if(s&&MODE==='host'){const o=s==='a'?'b':'a';if(el.value===S.cur[o])S.cur[o]=S.cur[s];S.cur[s]=el.value;ch()}
  else if(el.id==='mm'||el.id==='ss'){S.dur=Math.max(10,((+$('#mm').value||0)*60)+(+$('#ss').value||0));save();if(!T.started)rst();else{drawT();pushLive(true)}}});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target.id==='np')addPlayer()});

/* ---- init ---- */
$('#date').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
$('#mm').value=Math.floor(S.dur/60);$('#ss').value=S.dur%60;
$('#sync').textContent='Connexion…';
lock();setMode();restoreT();refresh();
pull();setInterval(pull,3000);setInterval(viewSync,250);setInterval(pushLive,1500);