// Сходимость по шагу физики: node tools/conv-test.cjs <режим> <seeds> <секунд> "<шаги через запятую>" ['<json-правка>']
// режимы: fire — два неподвижных броненосца в 40 км (только оружие, снаряды, попадания, повреждения);
//         fly  — один корабль летит к неподвижной цели в 400 км без оружия (движение, вращение, двигатели, топливо, решения ИИ);
//         comp — смешанный бой (COMP как в duel-test).
// Печатает JSON-строку на каждый (шаг, seed): выстрелы, попадания, топливо, траектория (x,y,v,курс каждые 60 с), моменты повреждений.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const [,,mode='fire',N='2',T='600',DTS='1,0.5,0.25,0.125',patch='{}']=process.argv;
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
for(const dt of DTS.split(',').map(Number))for(let seed=1;seed<=+N;seed++){
 const base=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','battle.json'),'utf8'));const P=JSON.parse(patch);P.step={...(P.step||{}),dt};for(const k in P)base[k]=Object.assign(base[k]||{},P[k]);
 const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/data/battle.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(base)}));
 await p.addInitScript(s=>{let a=s>>>0;let c=0,d=1.7e12;window.__reseed=()=>{a=s>>>0;c=0;d=1.7e12};Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};performance.now=()=>(c+=.05);Date.now=()=>(d+=1)},seed);
 await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(2000);
 const r=await p.evaluate(async([T,mode,COMP,seed,MV])=>{try{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
  const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));window.__reseed();D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
  const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
  const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
  const BB=sd=>mk('Броненосец'+sd,{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000},9500,5),FR=sd=>mk('Фрегат'+sd,{L:.15,arm:2,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:300,energy:5000},1500,10),
   PD=sd=>mk('Сторож'+sd,{L:.12,arm:2,gat:6,gatCfg:Array(6).fill(GC),ammoCap:300,energy:5000},1250,12),LR=sd=>mk('Дальнобой'+sd,{L:.25,arm:3,rails:3,railCfg:RC('30',3),gat:1,gatCfg:[GC],ammoCap:400,energy:5000},4500,5),
   IC=sd=>mk('Перехватчик'+sd,{L:.1,arm:1,rails:1,railCfg:RC('10',1),gat:2,gatCfg:[GC,GC],ammoCap:200,energy:5000},700,20),
   MS=sd=>{const MC=D.compOf(D.mkKey('missile',{pw:'30',en:'5',fu:'10',em:'1',ir:'0',ac:'0',hm:'0',mt:'50'})).mcfg;return mk('Ракетоносец'+sd,{L:.2,arm:2,miss:4,missCfg:Array(4).fill(MC),gat:2,gatCfg:[GC,GC],ammoCap:400,energy:5000},3000,8)},
   NO=sd=>mk('Мишень'+sd,{L:.3,arm:5,energy:5000},9500,5),TY={BB,FR,PD,LR,IC,MS};
  const late=[];
  if(mode==='fire'){late.push({t:0,side:0,spec:BB(0),edge:80,ang:0});late.push({t:0,side:1,spec:BB(1),edge:80,ang:Math.PI})}
  else if(mode==='fly'){late.push({t:0,side:0,spec:FR(0),edge:80,ang:0});late.push({t:0,side:1,spec:NO(1),edge:80,ang:Math.PI})}
  else for(const sd of [0,1])for(const k of COMP.split(';')[sd].split(',')){const dm=k.endsWith('*');const x=TY[k.replace('*','')](sd);if(dm)x.dmg=.6;late.push({t:0,side:sd,spec:x,edge:80,ang:sd?Math.PI:0})}
  D.state.demo=true;D.state.paused=false;B.Battle.begin({title:'c',fleets:[[],[]],late,demo:true,maxT:1e5,seed,names:['a','b'],onEnd(){}});
  B.Battle.tickN(1);const SS=B.Battle.ships().filter(s=>!s.bayOf);
  if(mode==='fire'){SS.forEach((s,i)=>{s.x=i?40:0;s.y=0;s.sx=s.vx=s.sy=s.vy=0;if(i)s.sy=s.vy=MV;if(!i&&MV>1)s.sy=s.vy=MV-1;if(i&&MV>1)s.sy=s.vy=0;s.hd=i?Math.PI:0;if(!(i&&MV<0))s.acc=0;if(MV<0)s.sy=s.vy=0})}
  else if(mode==='fly'){SS.forEach((s,i)=>{s.x=i?400:0;s.y=i?150:0;s.sx=s.vx=s.sy=s.vy=0;s.hd=0;if(i)s.acc=0})}
  else{const k=[0,0];for(const s of SS){const i=k[s.side]++;s.sx=s.vx=s.sy=s.vy=0;s.x=s.side?250:0;s.y=(i-4)*6;s.hd=s.side?Math.PI:0}}
  const t0=B.Battle.time(),tr=[],dmg=[];const al0=new Map(SS.map(s=>[s,s.aliveN]));let next=0;
  while(B.Battle.time()-t0<T&&!B.Battle.isDone()){B.Battle.tickN(.125);const el=B.Battle.time()-t0;
   for(const s of SS){const a=al0.get(s);if(s.aliveN<a){for(let q=0;q<a-s.aliveN;q++)dmg.push([+el.toFixed(1),s.side]);al0.set(s,s.aliveN)}}
   if(el>=next){next+=60;tr.push(SS.map(s=>[+s.x.toFixed(2),+s.y.toFixed(2),+Math.hypot(s.sx,s.sy).toFixed(3),+(s.hd%6.2832).toFixed(2),Math.round(100*(s.fuel||0)/(s.fuelCap||1)),s.alive?1:0]))}}
  const st=B.Battle.stat();return {t:Math.round(B.Battle.time()-t0),shots:st.shots,hits:st.hits,dead:SS.filter(s=>!s.alive).length,lost:SS.map(s=>s.total-s.aliveN),fuel:SS.map(s=>+(100*(1-(s.fuel||0)/(s.fuelCap||1))).toFixed(2)),plans:(st.fc||{}).planN||0,rcsT:st.rcsT,rcsN:st.rcsN,mainT:st.mainT,dvK:st.dvK,tr,dmg}}catch(e){return {err:e.stack.slice(0,800)}}},[+T,mode,process.env.COMP||'BB,LR,PD,IC;BB,LR,PD,IC',seed,+(process.env.MV||0)]);
 console.log(JSON.stringify({dt,seed,mode,...r,errs:errs.slice(0,2)}));await p.close()}
await b.close()})();
