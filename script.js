const TM={jaune:'Jaune',orange:'Orange',vert:'Vert'},ALL=['jaune','orange','vert'];
const $=s=>document.querySelector(s);
const SB_URL='https://fuaihkklnygbbiketvjb.supabase.co';
const SB_KEY='sb_publishable_gpkEUB2YbT1Q6jGO3AoUPQ_EpH6CpZQ';
function load(){try{return JSON.parse(localStorage.getItem('futsal-v1'))}catch(e){return null}}
function save(){try{localStorage.setItem('futsal-v1',JSON.stringify(S))}catch(e){}}
let S=Object.assign({teams:[...ALL],dur:390,cur:{a:'vert',b:'orange',sa:0,sb:0},hist:[],pending:[]},load()||{});
let T,iv,wl,YR,R=[],M=[],lastJ='',busy=false,ADM='';
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const dt=m=>m.date||today(),sg=v=>(v>0?'+':'')+v;
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

/* ---- chrono ---- */
function rst(){clearInterval(iv);T={run:false,rem:S.dur,end:0,half:false,done:false,started:false,hb:0};drawT()}
async function lock(){try{if(wl)return;wl=await navigator.wakeLock.request('screen');wl.addEventListener('release',()=>{wl=null})}catch(e){wl=null}}
document.addEventListener('pointerdown',lock);
function go(){au();if(T.done)return;
  if(T.run){T.rem=Math.max(0,(T.end-Date.now())/1000);T.run=false;clearInterval(iv)}
  else{T.run=true;T.started=true;T.end=Date.now()+T.rem*1000;lock();iv=setInterval(tick,100)}
  drawT()}
function tick(){if(!T.run)return;T.rem=Math.max(0,(T.end-Date.now())/1000);
  if(!T.half&&T.rem<=S.dur/2){T.half=true;T.hb=Date.now()+4000;halfBeep()}
  if(T.rem<=0){T.run=false;T.done=true;clearInterval(iv);endBuzz()}
  drawT()}
function drawT(){const d=S.dur,c=$('#tc'),hb=T.run&&Date.now()<T.hb;
  $('#time').textContent=fmt(T.rem);$('#prog').style.width=(100*(1-T.rem/d))+'%';
  $('#ph').textContent=T.done?'TEMPS ÉCOULÉ !':hb?'🔔 MI-TEMPS':!T.started?'Prêt, mi-temps à '+fmt(d/2):!T.run?'En pause':T.half?'2e mi-temps':'1re mi-temps';
  c.classList.toggle('end',T.done);c.classList.toggle('hb',hb);
  const g=$('#go');g.textContent=T.done?'Terminé':T.run?'⏸ Pause':T.started?'▶ Reprendre':'▶ Démarrer';g.disabled=T.done;
  $('#val').classList.toggle('pulse',T.done)}
document.addEventListener('visibilitychange',()=>{if(!document.hidden){lock();if(T.run)tick();pull()}});

/* ---- helpers ---- */
function two(b,fn,lbl){if(b.dataset.arm){clearTimeout(+b.dataset.arm);delete b.dataset.arm;b.textContent=b.dataset.o;b.classList.remove('arm');fn()}
  else{b.dataset.o=b.textContent;b.textContent=lbl||'Confirmer ?';b.classList.add('arm');
    b.dataset.arm=setTimeout(()=>{delete b.dataset.arm;b.textContent=b.dataset.o;b.classList.remove('arm')},3000)}}
let tt;function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('show');clearTimeout(tt);tt=setTimeout(()=>t.classList.remove('show'),3500)}
function fix(){const c=S.cur;let a=c.a,b=c.b;
  if(!S.teams.includes(a))a=S.teams.find(t=>t!==b);
  if(!S.teams.includes(b))b=S.teams.find(t=>t!==a);
  if(a===b)b=S.teams.find(t=>t!==a);c.a=a;c.b=b}
const ch=()=>{save();renderBoard()};

/* ---- match ---- */
function val(){const c=S.cur;const m={date:today(),ts:Date.now(),a:c.a,b:c.b,sa:c.sa,sb:c.sb};
  S.pending.push(m);save();rebuild();pull();
  const stay=c.sa>c.sb?c.a:c.b,out=stay===c.a?c.b:c.a,nx=S.teams.find(t=>t!==c.a&&t!==c.b);
  if(nx){S.cur={a:stay,b:nx,sa:0,sb:0};toast(TM[stay]+' reste, '+TM[nx]+' entre')}
  else{S.cur={a:c.a,b:c.b,sa:0,sb:0};toast('Match enregistré')}
  save();rst();renderAll()}

/* ---- rendu ---- */
function renderBoard(){const c=S.cur;
  $('#board').innerHTML=['a','b'].map(k=>`<div class="side t-${c[k]}"><select data-sel="${k}" aria-label="Équipe">${S.teams.map(x=>`<option value="${x}"${x===c[k]?' selected':''}>${TM[x]}</option>`).join('')}</select><div class="n">${c['s'+k]}</div><button class="plus" data-add="${k}">+1</button><button class="minus" data-sub="${k}">−1</button></div>`).join('')}
function renderChips(){$('#chips').innerHTML=ALL.map(t=>`<button class="chip t-${t}${S.teams.includes(t)?' on':''}" data-tg="${t}">${TM[t]}</button>`).join(' ')}
function calc(L,teams){const r={};teams.forEach(t=>r[t]={t,j:0,v:0,n:0,l:0,gf:0,ga:0,d:0,p:0});
  L.forEach(m=>{const A=r[m.a],B=r[m.b];if(!A||!B)return;A.j++;B.j++;A.gf+=m.sa;B.gf+=m.sb;A.d+=m.sa-m.sb;B.d+=m.sb-m.sa;
    if(m.sa>m.sb){A.v++;B.l++;A.p+=3}else if(m.sb>m.sa){B.v++;A.l++;B.p+=3}else{A.n++;B.n++;A.p++;B.p++}});
  return Object.values(r).sort((x,y)=>y.p-x.p||y.d-x.d||y.gf-x.gf)}
function renderRank(){const L=calc(M.filter(m=>dt(m)===today()),ALL).filter(x=>S.teams.includes(x.t));
  $('#tb').innerHTML='<tr><th></th><th>Équipe</th><th>J</th><th>Diff</th><th>Pts</th></tr>'+L.map((x,i)=>`<tr class="t-${x.t}"><td class="rk">${i+1}</td><td><i class="dot"></i>${TM[x.t]}</td><td>${x.j}</td><td>${sg(x.d)}</td><td class="pt">${x.p}</td></tr>`).join('')}
function renderHist(){const H=$('#hist'),E=M.map((m,i)=>[m,i]).filter(([m])=>dt(m)===today());
  if(!E.length){H.innerHTML='<div class="empty">Aucun match aujourd\'hui.<br>Validez un match pour le voir ici.</div>';return}
  H.innerHTML=E.map(([m,i],k)=>`<div class="h"><span class="no">${k+1}</span><span class="tm t-${m.a}"><i class="dot"></i>${TM[m.a]}</span><span class="sc">${m.sa} – ${m.sb}</span><span class="tm t-${m.b}"><i class="dot"></i>${TM[m.b]}</span><button data-del="${i}" aria-label="Supprimer le match ${k+1}">✕</button></div>`).reverse().join('')}
function renderSeason(){const ys=[...new Set(M.map(m=>dt(m).slice(0,4)).concat(today().slice(0,4)))].sort().reverse();
  if(!YR||!ys.includes(YR))YR=ys[0];
  $('#yr').innerHTML=ys.map(y=>`<option${y===YR?' selected':''}>${y}</option>`).join('');
  const L=M.filter(m=>dt(m).startsWith(YR)),by={},W={jaune:0,orange:0,vert:0};
  L.forEach(m=>(by[dt(m)]=by[dt(m)]||[]).push(m));
  const evs=Object.keys(by).sort().reverse().map(d=>({d,r:calc(by[d],ALL).filter(x=>x.j)}));
  evs.forEach(e=>{if(e.r.length)W[e.r[0].t]++});
  $('#sea').innerHTML=L.length?'<table class="cp"><tr><th></th><th>Équipe</th><th>J</th><th>V-N-D</th><th>Diff</th><th>Pts</th><th>Moy</th><th>🏅</th></tr>'+calc(L,ALL).map((x,i)=>`<tr class="t-${x.t}"><td class="rk">${i+1}</td><td><i class="dot"></i>${TM[x.t]}</td><td>${x.j}</td><td>${x.v}-${x.n}-${x.l}</td><td>${sg(x.d)}</td><td class="pt">${x.p}</td><td>${x.j?(x.p/x.j).toFixed(2):'–'}</td><td>${W[x.t]}</td></tr>`).join('')+`</table><p class="note">${L.length} matchs sur ${evs.length} soirées. Moy : points par match. 🏅 : soirées gagnées.</p>`:`<div class="empty">Aucun match en ${YR}.</div>`;
  $('#evs').innerHTML=evs.length?evs.map(e=>`<div class="ev"><b>${new Date(e.d+'T12:00').toLocaleDateString('fr-FR',{day:'numeric',month:'short'})}</b><span class="w t-${e.r[0].t}"><i class="dot"></i>${TM[e.r[0].t]}</span><small>${e.r.map(x=>TM[x.t]+' '+x.p).join(', ')}</small></div>`).join(''):''}
const sb=(p,o={})=>fetch(SB_URL+'/rest/v1/'+p,{...o,headers:{apikey:SB_KEY,...(SB_KEY.startsWith('eyJ')?{Authorization:'Bearer '+SB_KEY}:{}),'Content-Type':'application/json',Prefer:'return=minimal'}}).then(async r=>{if(!r.ok)throw new Error(r.status);const t=await r.text();return t?JSON.parse(t):null});
function rebuild(){M=R.concat(S.pending);renderRank();renderHist();renderSeason()}
async function pull(){if(busy||SB_URL.startsWith('COLLER')||SB_URL.startsWith('TON_URL'))return;busy=true;
  try{let fl=false;for(const m of [...S.pending]){await sb('matches',{method:'POST',body:JSON.stringify(m)});S.pending=S.pending.filter(x=>x!==m);save();fl=true}
    const n=await sb('matches?select=*&order=ts.asc'),j=JSON.stringify(n);
    $('#sync').textContent='☁ Synchronisé';if(j!==lastJ||fl){lastJ=j;R=n;rebuild()}}
  catch(e){$('#sync').textContent='Hors ligne, nouvel essai…'}
  busy=false}
function renderAll(){renderBoard();renderChips();renderRank();renderHist();renderSeason()}

/* ---- événements ---- */
document.addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;const d=b.dataset;
  if(d.tab){document.querySelectorAll('.pane').forEach(p=>p.hidden=p.id!=='p-'+d.tab);
    document.querySelectorAll('nav button').forEach(n=>n.classList.toggle('on',n===b));scrollTo(0,0)}
  else if(d.add){S.cur['s'+d.add]++;navigator.vibrate&&navigator.vibrate(20);ch()}
  else if(d.sub){S.cur['s'+d.sub]=Math.max(0,S.cur['s'+d.sub]-1);ch()}
  else if(d.tg){const t=d.tg;
    if(S.teams.includes(t)){if(S.teams.length>2)S.teams=S.teams.filter(x=>x!==t)}else S.teams=ALL.filter(x=>x===t||S.teams.includes(x));
    fix();save();renderAll()}
  else if(d.del!==undefined)two(b,()=>{const m=M[+d.del];if(m.id){const c=ADM||prompt('Code administrateur');if(!c)return;sb('rpc/delete_match',{method:'POST',body:JSON.stringify({match_id:m.id,admin_code:c})}).then(()=>{ADM=c;lastJ='';pull()}).catch(()=>{ADM='';toast('Code incorrect, match non supprimé')})}else{S.pending=S.pending.filter(x=>x!==m);save();rebuild()}},'Sûr ?');
  else if(b.id==='go')go();
  else if(b.id==='rst'){T.started&&!T.done?two(b,rst,'?'):rst()}
  else if(b.id==='val'){T.done?val():two(b,val)}
  else if(b.id==='t1'){au();halfBeep()}
  else if(b.id==='t2'){au();endBuzz()}});
document.addEventListener('change',e=>{const el=e.target,s=el.dataset.sel;
  if(el.id==='yr'){YR=el.value;renderSeason()}
  else if(s){const o=s==='a'?'b':'a';if(el.value===S.cur[o])S.cur[o]=S.cur[s];S.cur[s]=el.value;ch()}
  else if(el.id==='mm'||el.id==='ss'){S.dur = Math.max(10, ((+$('#mm').val() || 0) * 60) + (+$('#ss').val() || 0));save();if(!T.started)rst();else drawT()});

/* ---- init ---- */
$('#date').textContent=new Date().toLocaleDateString('fr-FR',{weekday:'long',day:'numeric',month:'long'});
$('#mm').value=Math.floor(S.dur/60);$('#ss').value=S.dur%60;
$('#sync').textContent=SB_URL.startsWith('TON_URL')?'Base non configurée':'Connexion…';
lock();
fix();renderAll();rst();
pull();setInterval(pull,6000);