// Испытания ракет по типам: управляемая (G), неуправляемая (U), кассета с суббоеприпасами (S), массовый залп (MASS).
// node tools/missile-test.cjs  → сводка по каждой ракете: время полёта, работа двигателя, расход Δv, повороты курса, исход (попала / сбита / самоликвидация / раскрылась)
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{let a=21;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}});
await p.goto('http://127.0.0.1:'+(process.env.PORT||5200)+'/');await p.waitForTimeout(2500);
const R=await p.evaluate(async()=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
 const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
 const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
 const MCF=o=>D.compOf(D.mkKey('missile',{pw:'10',en:'1',fu:'1',em:'1',ir:'1',ac:'0',hm:'1',mt:'20',...o})).mcfg;
 const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
 const CAR=(cfg,n)=>()=>mk('Носитель',{L:.2,arm:2,miss:n||4,missCfg:Array(n||4).fill(cfg),ammoCap:400,energy:5000},3000,8);
 const TGT=(gat,x={})=>()=>mk('Цель',{...x,L:.2,arm:3,rails:1,railCfg:RC('10',1),gat:gat,gatCfg:Array(gat).fill(GC),ammoCap:400,energy:5000},3000,8);
 const T=()=>B.Battle.time();
 function run(name,side0,side1,dist,secs,opt={}){B.Battle.begin({title:name,fleets:[[],[]],late:[...side0.map(f=>({t:0,side:0,spec:f(),edge:80,ang:0})),...side1.map(f=>({t:0,side:1,spec:f(),edge:80,ang:Math.PI}))],demo:true,maxT:1e6,seed:9,names:['a','b'],onEnd(){}});D.state.demo=true;D.state.paused=false;B.Battle.tickN(.05);
  const S=B.Battle.ships().filter(s=>!s.bayOf),k=[0,0];for(const s of S){const i=k[s.side]++;s.sx=s.vx=s.side?0:(opt.v0||0);s.sy=s.vy=0;s.x=s.side?dist:0;s.y=i*15-(s.side?opt.off||0:0);s.hd=s.side?Math.PI:0}
  if(opt.evade)for(const s of S)if(s.side===1){s.sy=s.vy=opt.evade}
  const M=new Map(),st={};const t0=T();let maxN=0;
  while(T()<t0+secs&&!B.Battle.isDone()){B.Battle.tickN(.02);const L=B.Battle.mis();maxN=Math.max(maxN,L.length);const now=new Set(L);
   for(const m of L){let r=M.get(m);if(!r){r={typ:m.dart?'S':m.dumb?'U':m.sub>1?'S-кассета':'G',side:m.side,t0:T(),v0:Math.hypot(m.vx,m.vy),dv0:m.dv0||0,burn:0,turn:0,h:m.h,last:T(),lost:0,launcherV:opt.v0||0};M.set(m,r)}
    const dt=T()-r.last;if(m.burn)r.burn+=dt;if(r.h!=null&&m.h!=null)r.turn+=Math.abs(Math.atan2(Math.sin(m.h-r.h),Math.cos(m.h-r.h)));r.h=m.h;r.last=T();r.v=Math.hypot(m.vx,m.vy);r.dv=m.dv;if(m.mc)r.mc=(r.mc||0)+dt;if(!m.tgt&&!m.dumb)r.lost=1}
   for(const [m,r] of M)if(!now.has(m)&&!r.done){r.done=1;r.end=m.end||'?';r.fl=T()-r.t0}}
  for(const [m,r] of M){if(!r.done){r.end='в полёте';r.fl=T()-r.t0}const key=r.typ+':'+r.end;st[key]=(st[key]||0)+1}
  const arr=[...M.values()],by=k=>{const a=arr.filter(r=>r.typ===k);if(!a.length)return null;const av=f=>+(a.reduce((x,r)=>x+f(r),0)/a.length).toFixed(2);return {n:a.length,полёт_с:av(r=>r.fl),двигатель_с:av(r=>r.burn),скорость_старт:av(r=>r.v0),скорость_конец:av(r=>r.v||0),израсходовано_dv:av(r=>(r.dv0||0)-(r.dv||0)),повороты_рад:av(r=>r.turn),без_цели:a.filter(r=>r.lost).length,наведение_по_флоту_с:av(r=>r.mc||0)}};
  const s0=B.Battle.stat();return {name,maxInFlight:maxN,исходы:st,G:by('G'),U:by('U'),S_кассета:by('S-кассета'),S:by('S'),stat:{misHit:s0.misHit,misShot:s0.misShot,misSplit:s0.misSplit||0,am:s0.am,dcy:s0.dcy,mpick:s0.mpick}}}
 const G=MCF({}),Ud=MCF({hm:'0'}),Cl={...MCF({}),sub:4};
 return [
  run('G: управляемые против цели без ПВО',[CAR(G)],[TGT(0)],120,240),
  run('G: управляемые против уклоняющейся цели (боковые 0,3 км/с)',[CAR(G)],[TGT(0)],120,240,{evade:.3}),
  run('G: управляемые против цели с ПВО (4 пулемёта)',[CAR(G)],[TGT(4)],120,240),
  run('U: неуправляемые, носитель неподвижен',[CAR(Ud)],[TGT(0)],60,200),
  run('U: неуправляемые, носитель летит 1 км/с к цели',[CAR(Ud)],[TGT(0)],60,200,{v0:1}),
  run('U: неуправляемые против цели с ПВО',[CAR(Ud)],[TGT(4)],60,200),
  run('S: кассеты против цели',[CAR(Cl)],[TGT(0)],120,240),
  run('S: кассеты против цели с ПВО',[CAR(Cl)],[TGT(4)],120,240),
  run('DEC: ИК-головки против цели с ловушками',[CAR(G)],[TGT(0,{dec:20})],120,240),
  run('DEC: радарные (ir=0) против цели с ловушками',[CAR(MCF({ir:'0'}))],[TGT(0,{dec:20})],120,240),
  run('AM: залп против цели с 4 противоракетами',[CAR(G,8)],[TGT(0,{miss:4,missCfg:Array(4).fill({...G,am:1}),ammoCap:400})],150,300),
  run('MASS: 10 носителей × 4 против 10 целей с ПВО',Array(10).fill(CAR(G)),Array(10).fill(TGT(4)),150,300)]});
for(const r of R)console.log(JSON.stringify(r));console.log('ERR',errs.slice(0,3));await b.close()})();
