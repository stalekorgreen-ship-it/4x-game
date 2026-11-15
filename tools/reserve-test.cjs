// Шаг В1.1: проверка резерва на возвращение в планировщике (planner.pred=1). Почти пустой бак, танкер.
// node tools/reserve-test.cjs
// A — разные манёвры с разным расходом; B — поиск нарушения только посередине прогноза; C — уже отрицательный запас (без ухудшения);
// D — запрещённый прежний план не удерживается гистерезисом; E — длительный бой с малым топливом: выбранный план ни разу не нарушает резерв (кроме инерции-запасного)
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(()=>{let a=7;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};let c=0;performance.now=()=>(c+=.05);let d=1.7e12;Date.now=()=>(d+=1)});
 await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(2500);
 const r=await p.evaluate(async()=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
  const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));const DM=await import(U('16-demo.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
  const late=[];for(const sd of [0,1])for(const sp of DM.duelSpecs(sd).slice(0,1))late.push({t:0,side:sd,spec:sp,edge:80,ang:sd?Math.PI:0});
  D.state.demo=true;D.state.paused=false;B.Battle.begin({title:'r',fleets:[[],[]],late,demo:true,maxT:1e5,names:['a','b'],onEnd(){}});B.Battle.tickN(1);
  const PT=B.Battle.planT,PLN=PT.PLN,DT=2,ve=PLN&&9;const [s,g]=B.Battle.ships().filter(q=>!q.bayOf);PLN.pred=1;
  const dry=s.T.tons-0>0?Math.max(s.T.tons*.2,s.T.tons-(s.fuelCap||0)):0,VE=9,REFH=1; // как dryM, FUEL.ve, REF.home
  const dvr=f=>VE*Math.log((dry+f)/dry),fuelFor=dv=>dry*(Math.exp(dv/VE)-1);
  const save=JSON.stringify({x:s.x,y:s.y,sx:s.sx,sy:s.sy,hd:s.hd,w:s.w,fuel:s.fuel,acc:s.acc});
  // постановка: корабль в начале координат со скоростью (vx,vy), враг на +x в 40 км, танкер в (tx,ty) неподвижен; топливо — чтобы свободный Δv был spend км/с
  const setup=(o)=>{Object.assign(s,JSON.parse(save));s.x=0;s.y=0;s.sx=o.vx;s.sy=o.vy;s.vx=o.vx;s.vy=o.vy;s.hd=o.hd??0;s.w=0;s.spin=0;s.dg=null;s.ramTg=null;
   g.x=40;g.y=0;g.sx=0;g.sy=0;g.hd=Math.PI;const tk={x:o.tx,y:o.ty,sx:0,sy:0};
   const vr=Math.hypot(o.vx,o.vy),d=Math.hypot(o.tx,o.ty);
   // need = vr + 2·min(0,4·dvr, 0,6·√(2a·d)); подбираем топливо так, чтобы spend = o.spend (несколько итераций)
   let f=fuelFor(3);for(let i=0;i<40;i++){const R=dvr(f),need=vr+2*Math.min(R*.4,Math.sqrt(2*s.acc/1000*d)*.6);f=fuelFor(Math.max(0,o.spend+need+REFH))}
   s.fuel=f;const R=dvr(f),need=vr+2*Math.min(R*.4,Math.sqrt(2*s.acc/1000*d)*.6);s.dvB={dvr:R,tk,spend:R-need-REFH};return s.dvB.spend};
  const plan=(prev)=>{s.plT=0;s.plan=prev||null;s.planAll=null;const c=PT.plan(s,g,1,DT);return {k:c.k,sc:+c.sc.toFixed(3),spend0:+s.dvB.spend.toFixed(4),
    all:Object.fromEntries((s.planAll||[]).map(([k,sc,c])=>[k,[+sc.toFixed(3),+(c*1000).toFixed(1)]])),res:Object.fromEntries(Object.entries(s.planRes||{}).map(([k,v])=>[k,[+v[0].toFixed(4),+v[1].toFixed(4)]])),ban:(s.planBan||[]).map(q=>q[0])}};
  const out={fuelCap:s.fuelCap,dry:+dry.toFixed(0),acc:s.acc};
  // A: малый свободный Δv, танкер в 30 км позади, корабль стоит
  out.A=[];for(const sp of [.6,.25,.1,.03]){out.A.push({spend:+setup({vx:0,vy:0,tx:-30,ty:0,spend:sp}).toFixed(3),fuel_t:+s.fuel.toFixed(1),...plan()})}
  // B: перебор постановок, ищем кандидата с нарушением только посередине (min<0, конец ≥0): корабль уходит от танкера, манёвр разворачивает к нему
  out.B={tried:0,found:[]};for(const u of [.05,.1,.2,.3,.5])for(const sp of [.02,.05,.1,.2])for(const tx of [10,30,80])for(const a of [0,1]){out.B.tried++;setup({vx:-u,vy:0,tx,ty:0,spend:sp,hd:a?Math.PI:0});const P=plan();
    for(const k in P.res){const [mn,en]=P.res[k],lim=Math.min(0,P.spend0);if(mn<lim-1e-9&&en>=lim)out.B.found.push({u,sp,tx,hd:a?'к танкеру кормой':'носом',k,min:mn,end:en,banned:P.ban.includes(k),chosen:P.k})}}
  out.B.found=out.B.found.slice(0,6).concat(out.B.found.length>6?[{всего:out.B.found.length}]:[]);
  // C: уже отрицательный запас — корабль летит от танкера; разрешены только кандидаты, не ухудшающие минимум
  out.C=[];for(const [u,sp] of [[.3,-.05],[.6,-.2],[1.2,-.5]]){setup({vx:-u,vy:0,tx:30,ty:0,spend:sp});const P=plan();const bad=Object.entries(P.res).filter(([k,[mn]])=>k!==P.k?false:mn<P.spend0-1e-9&&k!=='инерция');out.C.push({...P,chosenWorsens:bad.length>0})}
  // D: прежний план «сближение» с высокой старой оценкой; теперь он запрещён — гистерезис не должен его удержать
  setup({vx:0,vy:0,tx:-30,ty:0,spend:.03});const D0=plan({k:'сближение',vx:0,vy:0,sc:1e6});out.D={...D0,keptBanned:D0.ban.includes(D0.k)&&D0.k!=='инерция'};
  // и наоборот: прежний план «инерция», всё кроме неё запрещено, потом бак пополнили — план должен смениться, если что-то стало заметно лучше
  {const P1=plan({k:'инерция',vx:s.sx,vy:s.sy,sc:-5});s.fuel=s.fuelCap;s.dvB.spend=dvr(s.fuel)-1-REFH;const P2=plan({k:P1.k,vx:s.sx,vy:s.sy,sc:P1.sc});out.D2={low:{k:P1.k,ban:P1.ban},refueled:{k:P2.k,ban:P2.ban,all:P2.all}}}
  // E: живой бой 1×1, оба с 6% бака, pred=1, 40 мин; на каждом пересмотре проверяем выбранный план против его резерва
  Object.assign(s,JSON.parse(save));s.x=-60;s.y=0;g.x=60;g.y=0;s.sx=.3;g.sx=-.3;s.sy=g.sy=0;for(const q of [s,g]){q.fuel=q.fuelCap*.06;q.dvB=null;q.plan=null;q.plT=0}
  const E={plans:0,chosenBanned:0,inertiaFallback:0,stuckMax:0,kinds:{},negSpend:0};let last=null,run=0,lastT=-1;const t0=B.Battle.time();
  while(B.Battle.time()-t0<2400&&!B.Battle.isDone()){B.Battle.tickFixed(1);for(const q of [s,g]){if(!q.alive||!q.plan||!q.planRes||q.__seen===q.plT)continue;q.__seen=q.plT;E.plans++;const k=q.plan.k;E.kinds[k]=(E.kinds[k]||0)+1;
    const rs=q.planRes[k],sp0=q.dvB?q.dvB.spend:0;if(sp0<0)E.negSpend++;if(rs&&rs[0]<Math.min(0,sp0)-1e-9){if(k==='инерция')E.inertiaFallback++;else E.chosenBanned++}}}
  E.t=Math.round(B.Battle.time()-t0);E.fuel=[s,g].map(q=>+(100*q.fuel/q.fuelCap).toFixed(2));out.E=E;
  return out});
 console.log(JSON.stringify(r,null,1));if(errs.length)console.log('ОШИБКИ',errs.slice(0,3));await b.close()})();
