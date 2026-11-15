// Проверка прогноза: записываем команды настоящего корабля 60 с, прогоняем те же команды на копии состояния, сравниваем через 10/30/60 с; плюс время одного 60-с прогноза.
// node tools/pred-test.cjs [seed=1] [старт, с боя=1]
const {chromium}=require('playwright');
(async()=>{const [,,seed='1',T0='1']=process.argv;const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();
await p.addInitScript(s=>{let a=s>>>0;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};let c=0;performance.now=()=>(c+=.05);let d=1.7e12;Date.now=()=>(d+=1)},+seed);
await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(2500);
const r=await p.evaluate(async([T0])=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
 const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));const DM=await import(U('16-demo.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
 const late=[];for(const sd of [0,1])for(const sp of DM.duelSpecs(sd))late.push({t:0,side:sd,spec:sp,edge:80,ang:sd?Math.PI:0});
 D.state.demo=true;D.state.paused=false;B.Battle.begin({title:'p',fleets:[[],[]],late,demo:true,names:['a','b'],onEnd(){}});B.Battle.tickN(1);const SS=B.Battle.ships().filter(s=>!s.bayOf);DM.duelStart(SS);
 const t1=B.Battle.time();while(B.Battle.time()-t1<T0)B.Battle.tickN(1);
 const out=[];const keys=['x','y','sx','sy','hd','w','fuel'];
 for(const s of SS){if(!s.alive)continue;const ghostSrc=Object.assign(Object.create(Object.getPrototypeOf(s)),s);const snap={};for(const k of Object.keys(s))snap[k]=s[k];
  out.push({s,snap})}
 // снимки состояния и запись команд
 const recs=SS.filter(s=>s.alive).map(s=>{const st={};for(const k of Object.keys(s)){const v=s[k];st[k]=v&&typeof v==='object'&&!Array.isArray(v)&&!v.T?{...v}:v}s.cmdLog=[];s.__post={sx:s.sx,sy:s.sy,x:s.x,y:s.y,fuel:s.fuel,w:s.w||0,hd:s.hd};return {s,st,facts:[]}});
 const tA=B.Battle.time();const marks=[10,30,60];let mi=0;
 while(B.Battle.time()-tA<60.001){B.Battle.tickN(1);for(const R of recs){const s=R.s;R.facts.push({x:s.x,y:s.y,sx:s.sx,sy:s.sy,hd:s.hd,w:s.w||0,fuel:s.fuel,t:B.Battle.time()-tA})}}
 const res=[];for(const R of recs){const s=R.s,cmds=s.cmdLog;s.cmdLog=null;
  // прогон команд на копии исходного состояния
  const live={};for(const k of Object.keys(s))live[k]=s[k];for(const k of Object.keys(s))if(!(k in R.st))s[k]=undefined;for(const k of Object.keys(R.st))s[k]=R.st[k];s.__post=null;const P=B.Battle.predictCmds(s,cmds,tA);const P0=B.Battle.predictCmds(s,cmds.map(c=>[...c.slice(0,7),null,null,null,c[10]]),tA);for(const k of Object.keys(live))s[k]=live[k];
  const row={n:s.T.n};{let first=null;for(let q=0;q<cmds.length;q++){const po=cmds[q][9],g=P[q];if(!po||!g)continue;const e=Math.hypot(po.sx-g.sx,po.sy-g.sy)*1000+Math.abs(po.fuel-g.fuel)*1000+Math.abs(po.hd-g.hd);if(e>1e-6){first={q,dv:+(Math.hypot(po.sx-g.sx,po.sy-g.sy)*1000).toFixed(3),dfu:+((po.fuel-g.fuel)*1000).toFixed(2),dhd:+(po.hd-g.hd).toFixed(5),cmd:cmds[q].slice(0,7).map(v=>typeof v==='number'?+v.toFixed(4):v),ext:cmds[q][7]?Object.fromEntries(Object.entries(cmds[q][7]).filter(([k,v])=>typeof v==='number'&&Math.abs(v)>1e-9).map(([k,v])=>[k,+v.toFixed(6)])):null,ev:!!cmds[q][8]};break}}row.first=first}for(const m of [10,30,60]){let i=R.facts.findIndex(f=>f.t>=m-1e-6);if(i<0)i=R.facts.length-1;const f=R.facts[i];let ct=0,gi=-1;for(let q=0;q<cmds.length;q++){ct+=cmds[q][6];if(Math.abs(ct-f.t)<1e-6){gi=q;break}}const g=P[gi],g0=P0[gi];if(!g){row['t'+m]='нет шага';continue}
   row['t'+m]={dPos_m:+(Math.hypot(f.x-g.x,f.y-g.y)*1000).toFixed(4),dV_ms:+(Math.hypot(f.sx-g.sx,f.sy-g.sy)*1000).toFixed(5),dHd_deg:+(Math.abs(f.hd-g.hd)*57.3).toFixed(5),dW:+Math.abs(f.w-g.w).toExponential(1),dFuel_kg:+(Math.abs(f.fuel-g.fuel)*1000).toFixed(4),безВнешних_dPos_m:+(Math.hypot(f.x-g0.x,f.y-g0.y)*1000).toFixed(1)}}
  res.push(row)}
 // время: 60-с прогон одного корабля с постоянной командой
 const s=recs[0].s,dt=2,cmd=[s.sx,s.sy,s.hd+1,1,1,0,dt];const cmds=Array(Math.round(60/dt)).fill(cmd);let N=200,t0=performance.now.call?0:0;const T1=Date.now;
 const real=window.__realNow;return {res,steps:cmds.length}},[+T0]);
// производительность меряем отдельно, без подмены часов
const p2=await b.newPage();await p2.goto('http://127.0.0.1:5200/');await p2.waitForTimeout(2500);
const perf=await p2.evaluate(async()=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
 const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));const DM=await import(U('16-demo.ts'));D.newGame();D.state.raid.eta=1e9;
 const late=[];for(const sd of [0,1])for(const sp of DM.duelSpecs(sd))late.push({t:0,side:sd,spec:sp,edge:80,ang:sd?Math.PI:0});
 D.state.demo=true;B.Battle.begin({title:'p',fleets:[[],[]],late,demo:true,names:['a','b'],onEnd(){}});B.Battle.tickN(1);const SS=B.Battle.ships().filter(s=>!s.bayOf);DM.duelStart(SS);for(let i=0;i<20;i++)B.Battle.tickN(1);
 const s=SS[1],out={};for(const dt of [2,.5]){const cmds=Array(Math.round(60/dt)).fill([s.sx+.3,s.sy,s.hd+1.5,1,1,0,dt]);for(let i=0;i<50;i++)B.Battle.predictCmds(s,cmds);const N=500,a=performance.now();for(let i=0;i<N;i++)B.Battle.predictCmds(s,cmds);out['dt='+dt]=+((performance.now()-a)/N*1000).toFixed(1)+' мкс ('+cmds.length+' шагов)'}return out});
console.log(JSON.stringify({res:r.res,perf},null,1));await b.close()})();
