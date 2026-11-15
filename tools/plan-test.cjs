// Шаг В1: планировщик по прямой против планировщика по траектории призрака (predictCmds) в одинаковых ситуациях.
// node tools/plan-test.cjs [seeds=3] [моменты, с через запятую=60,200,400] [тип=4v4|bb]
// Для каждого корабля под планировщиком: оценки 7 кандидатов (pred=0 и pred=1), выбор, проверка изоляции, время одного планирования.
const {chromium}=require('playwright');
(async()=>{const [,,N='3',TS='60,200,400',typ='4v4']=process.argv;const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const out=[];
for(let seed=1;seed<=+N;seed++){const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.addInitScript(s=>{let a=s>>>0;window.__rnd=0;Math.random=()=>{window.__rnd++;a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}},seed);
 await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(2500);
 const r=await p.evaluate(async([TS,typ])=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
  const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));const DM=await import(U('16-demo.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
  const late=[];for(const sd of [0,1])for(const sp of DM.duelSpecs(sd))late.push({t:0,side:sd,spec:sp,edge:80,ang:sd?Math.PI:0});
  D.state.demo=true;D.state.paused=false;B.Battle.begin({title:'p',fleets:[[],[]],late,demo:true,maxT:1e5,names:['a','b'],onEnd(){}});B.Battle.tickN(1);
  const SS=B.Battle.ships().filter(s=>!s.bayOf);if(typ==='4v4')DM.duelStart(SS);
  const PT=B.Battle.planT,PLN=PT.PLN,DT=2,res=[],t0=B.Battle.time();
  // снимок мира: все примитивные поля всех кораблей + stat + время + счётчик Math.random
  const J=v=>{const W=new WeakSet();return JSON.stringify(v,(k,x)=>{if(x&&typeof x==='object'){if(x.T&&k)return '#'+(x.uid??'');if(W.has(x))return '^';W.add(x)}return x})};
  const snap=skip=>{const o=[];for(const s of B.Battle.ships()){const r={};for(const k of Object.keys(s)){if(skip&&skip.has(k))continue;const v=s[k];if(v==null||typeof v!=='object')r[k]=v;else if(!Array.isArray(v)&&!v.T)r[k]=J(v)}o.push(r)}return J([o,B.Battle.stat(),B.Battle.time(),window.__rnd])};
  const SKIP=new Set(['plT','plan','planAll']);
  for(const T of TS){while(B.Battle.time()-t0<T&&!B.Battle.isDone())B.Battle.tickFixed(1);
   for(const s of SS){if(!s.alive||!s.fuelCap||!s.dvB)continue;const F=s.F,g=(F&&F.focus&&F.focus.alive)?F.focus:s.tg;if(!g||!g.alive||g.side===s.side)continue;
    const eng=Math.max(.15,s.engN/s.T.eng),keep={plT:s.plT,plan:s.plan,planAll:s.planAll},bel=JSON.stringify(g.bel||null);
    const run=pred=>{PLN.pred=pred;s.plT=0;s.plan=null;s.planAll=null;g.bel=JSON.parse(bel);const t1=performance.now();const c=PT.plan(s,g,eng,DT);const ms=performance.now()-t1;const all=(s.planAll||[]).map(([k,sc,c])=>[k,+sc.toFixed(2),+(c*1000).toFixed(0)]);return {k:c&&c.k,all,ms}};
    const before=snap(SKIP);const A=run(0);const mid=snap(SKIP);const P1=run(1);const after=snap(SKIP);const P2=run(1); // P2 — повтор: тот же результат
    // изоляция кандидатов: траектории каждого кандидата по одному, в прямом и обратном порядке, и всех подряд — должны совпасть
    const C=[[s.sx,s.sy],[g.sx+.3,g.sy],[g.sx-.3,g.sy],[g.sx,g.sy+.3],[g.sx,g.sy]];const tr=o=>o.map(([vx,vy])=>JSON.stringify(PT.predTraj(s,g,vx,vy,eng,DT).at(-1)));
    const fw=tr(C),bw=tr([...C].reverse()).reverse(),afterIso=snap(SKIP);
    // время: 50 планирований с pred=1 при dt боя 2 с и при мелком dt 0,1 с (игра в реальном времени)
    const tm=dt=>{PLN.pred=1;const t1=performance.now();for(let i=0;i<50;i++){s.plT=0;s.plan=null;g.bel=JSON.parse(bel);PT.plan(s,g,eng,dt)}return (performance.now()-t1)/50};
    const ms2=tm(2),ms01=tm(.1),ms0=(()=>{PLN.pred=0;const t1=performance.now();for(let i=0;i<50;i++){s.plT=0;s.plan=null;g.bel=JSON.parse(bel);PT.plan(s,g,eng,2)}return (performance.now()-t1)/50})();
    PLN.pred=0;Object.assign(s,keep);g.bel=JSON.parse(bel);
    res.push({T,n:s.T.n,to:g.T.n,d:+Math.hypot(g.x-s.x,g.y-s.y).toFixed(1),old:A,pred:P1,repeat:JSON.stringify(P1.all)===JSON.stringify(P2.all),worldSame:before===mid&&mid===after&&after===afterIso,candIso:JSON.stringify(fw)===JSON.stringify(bw),ms:{lin:+ms0.toFixed(3),pred_dt2:+ms2.toFixed(3),pred_dt01:+ms01.toFixed(3)}})}}
  return res},[TS.split(',').map(Number),typ]);
 out.push({seed,r,errs});await p.close()}
for(const {seed,r,errs} of out){if(errs.length)console.log('ОШИБКИ',seed,errs.slice(0,3));for(const x of r)console.log(JSON.stringify({seed,...x}))}
await b.close()})();
