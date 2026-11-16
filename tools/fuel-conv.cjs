// Сходимость топливной дисциплины по шагу физики: node tools/fuel-conv.cjs  (шаги 0.5/0.25/0.125/0.0625, сценарии без боевого хаоса)
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
const STEPS=(process.env.STEPS||'0.5,0.25,0.125,0.0625').split(',').map(Number);
(async()=>{const base=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','battle.json'),'utf8'));const b=await chromium.launch();const res={};
for(const dt of STEPS){const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));
 await p.route('**/data/battle.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify({...base,step:{dt},return:{...(base.return||{}),stay:1}})}));
 if(process.env.SC)await p.addInitScript(x=>{window.__SC=x.split(',')},process.env.SC);await p.addInitScript(()=>{let a=13;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}});
 await p.goto('http://127.0.0.1:'+(process.env.PORT||5200)+'/');await p.waitForTimeout(2500);
 res[dt]=await p.evaluate(async()=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
  const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
  const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg);const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
  const FR=()=>mk('Фрегат',{L:.15,arm:2,rails:2,railCfg:RC('10',2),ammoCap:300,energy:5000},1500,10),BB=()=>mk('Броненосец',{L:.3,arm:5,rails:2,railCfg:RC('20',2),ammoCap:500,energy:5000},9500,5);
  const T=()=>B.Battle.time();const out={};
  // СЦЕНАРИИ БЕЗ БОЕВОГО ХАОСА: враг — далёкий неподвижный остов без двигателей (боя нет). drift — решение об уходе: корабль дрейфует от базы,
  // нужный на возвращение Δv растёт, корабль уходит, когда свободный запас кончается. Остальные — сразу на базу: проверка самого возвращения.
  const C=.025;const SC0={drift:{f:FR,v:.3,dv:.25},fast:{f:FR,v:1.5,dv:C},eng:{f:FR,dv:C,eng:.5,v:.2},heavy:{f:BB,dv:C,v:.2},far:{f:FR,dv:C,home:-3000},turn:{f:FR,dv:C,vy:.6},nope:{f:FR,v:3,dv:-1},part:{f:BB,v:.4,dv:.12,home:-800}};
  const SC=window.__SC?Object.fromEntries(Object.entries(SC0).filter(([k])=>window.__SC.includes(k))):SC0;for(const[k,c]of Object.entries(SC)){B.Battle.begin({title:'c',fleets:[[],[]],late:[{t:0,side:0,spec:c.f(),edge:80,ang:0},{t:0,side:1,spec:FR(),edge:80,ang:Math.PI}],demo:true,maxT:1e6,seed:5,names:['a','b'],onEnd(){}});D.state.demo=true;D.state.paused=false;B.Battle.tickN(.05);
   const S=B.Battle.ships().filter(s=>!s.bayOf),s=S.find(q=>q.side===0),e=S.find(q=>q.side===1);s.x=0;s.y=0;s.sx=s.vx=(c.v||0);s.sy=s.vy=(c.vy||0);s.hd=0;s.home={x:c.home||-200,y:0};e.x=6000;e.y=3000;e.sx=e.vx=0;e.sy=e.vy=0;e.hd=0;for(const m of e.zones.flatMap(z=>z.mods))if(m.alive&&m.k==='E')B.Battle.dmgT.mdead(e,m);
   if(c.eng){const E=s.zones.flatMap(z=>z.mods).filter(m=>m.k==='E'&&m.alive);for(let i=0;i<Math.floor(E.length*c.eng);i++)B.Battle.dmgT.mdead(s,E[i])}
   B.Battle.tickN(.0001);if(c.dv<0)B.Battle.setDv(s,.3);else B.Battle.setDv(s,B.Battle.needNow(s)+c.dv);const f0=s.fuel,t0=T(),dv0=s.dvSum||0,st0=B.Battle.stat().rcsT||0,sp0=B.Battle.stat().spinT||0,dg0=B.Battle.stat().dodge||0;let dep=null,arr=null,dist=0,px=s.x,py=s.y,minD=1e9,vAt=null;
   while(T()<t0+(window.__TMAX||6500)&&s.alive&&!B.Battle.isDone()){B.Battle.tickN(.1);dist+=Math.hypot(s.x-px,s.y-py);px=s.x;py=s.y;
    if(s.rst==='home'&&!dep)dep={t:+(s.rsT-t0).toFixed(2),fuel:+s.fuel.toFixed(3),dvr:+s.dvB.dvr.toFixed(4),need:+s.dvB.rp.need.toFixed(4)};
    const d=Math.hypot(s.x-s.home.x,s.y-s.home.y);if(dep&&d<minD){minD=d;vAt=Math.hypot(s.sx,s.sy)}if(dep&&!arr&&d<5&&Math.hypot(s.sx,s.sy)<.03)arr={t:+(T()-t0).toFixed(0),v:+Math.hypot(s.sx,s.sy).toFixed(4)}}
   out[k]={rotF:+B.Battle.rotF(s).toFixed(2),dep,arr,minD:+minD.toFixed(2),vMin:vAt!=null?+vAt.toFixed(4):null,dist:+dist.toFixed(1),used:+(f0-s.fuel).toFixed(3),left:+s.fuel.toFixed(3),dvMain:+((s.dvSum||0)-dv0).toFixed(3),rcs:+((B.Battle.stat().rcsT||0)-st0).toFixed(2),spin:+((B.Battle.stat().spinT||0)-sp0).toFixed(2),dodge:(B.Battle.stat().dodge||0)-dg0,why:s.homeWhy}}
  return out});await p.close()}
const ks=Object.keys(res[STEPS[0]]);for(const k of ks){console.log('== '+k);for(const dt of STEPS)console.log(String(dt).padEnd(7),JSON.stringify(res[dt][k]))}
console.log('JSON',JSON.stringify(res));await b.close()})();
