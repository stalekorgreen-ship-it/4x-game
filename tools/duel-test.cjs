// Дуэль 1×1 одинаковых кораблей: node tools/duel-test.cjs <seeds=5> '<json-правка battle.json>' [секунд=900] [тип=bb|fr]
// bb — броненосец 9 500 т (рельсы 20 см ×2 + 4 гатлинга), fr — фрегат 1 500 т (рельсы 10 см ×2 + 2 гатлинга)
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const [,,N='5',patch='{}',T='900',typ='bb']=process.argv;
const base=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','battle.json'),'utf8'));const P=JSON.parse(patch);for(const k in P)base[k]=Object.assign(base[k]||{},P[k]);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const res=[];
for(let seed=1;seed<=+N;seed++){const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
 await p.route('**/data/battle.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(base)}));
 await p.addInitScript(s=>{let a=s>>>0;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}},seed);
 await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(2500);
 const r=await p.evaluate(async([T,typ,TAU])=>{try{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
  const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
  const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
  const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
  const late=[];for(const sd of [0,1]){const a=sd?Math.PI:0;
   late.push({t:0,side:sd,spec:typ==='fr'?mk('Фрегат'+sd,{L:.15,arm:2,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:300,energy:5000},1500,10):mk('Броненосец'+sd,{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000},9500,5),edge:80,ang:a})}
  D.state.demo=true;D.state.paused=false;B.Battle.begin({title:'d',fleets:[[],[]],late,demo:true,maxT:1e5,names:['a','b'],onEnd(){}});
  B.Battle.tickN(1);const SS=B.Battle.ships().filter(s=>!s.bayOf),tau=TAU||300+Math.random()*600; // встречный курс: точка пересечения (0,0) через tau с, скорость до 2 км/с, случайное направление; полбака
  for(const s of SS){const a=Math.random()*6.283,v=Math.random()*2;s.sx=s.vx=Math.cos(a)*v;s.sy=s.vy=Math.sin(a)*v;s.hd=a;if(s.fuelCap)s.fuel=s.fuelCap/2}
  {const[a,c]=SS,rv=Math.hypot(a.sx-c.sx,a.sy-c.sy)||.01,tt=Math.min(tau,350/rv);for(const s of SS){s.x=-s.sx*tt;s.y=-s.sy*tt}} // старт не дальше 350 км друг от друга
  const tr=[];const t0=B.Battle.time();while(B.Battle.time()-t0<T&&!B.Battle.isDone()){B.Battle.tickN(1);const k=Math.round(B.Battle.time()-t0);if(k%60===0&&tr.length<k/60+1){const[a,c]=SS;tr.push([k,+Math.hypot(a.x-c.x,a.y-c.y).toFixed(1),+Math.hypot(a.sx-c.sx,a.sy-c.sy).toFixed(2),Math.round(100*a.fuel/a.fuelCap),Math.round(100*c.fuel/c.fuelCap),(B.Battle.stat().shots||[0,0]).join('/')])}}
  const st=B.Battle.stat(),arm=s=>s.zones.reduce((a,z)=>a+z.armN,0);
  return {gh:st.gHit||0,gs:st.gatT,ext:st.extK||0,tr,t:Math.round(B.Battle.time()-t0),hits:st.hits,shots:st.shots,dodge:st.dodge||0,blind:st.blind||0,ships:B.Battle.ships().filter(s=>!s.bayOf).map(s=>({why:[...new Set(s.tur.map(m=>m.k+':'+(m.why||'')+':'+(m.ammo??'')))].slice(0,4),mag:Math.round(s.mag),n:s.T.n,alive:s.alive,mod:s.aliveN+'/'+s.total,arm:arm(s)}))}}catch(e){return {err:e.stack.slice(0,400)}}},[+T,typ,+(process.env.TAU||0)]);
 r.seed=seed;if(errs.length)r.errs=errs.slice(0,3);res.push(r);await p.close()}
for(const r of res){if(!process.env.TRACE)delete r.tr;console.log(JSON.stringify(r))}
const s=k=>res.reduce((a,r)=>a+(r[k]?(Array.isArray(r[k])?r[k][0]+r[k][1]:r[k]):0),0);
console.log('ИТОГ: попаданий',s('hits'),'выстрелов',s('shots'),'точность %',(100*s('hits')/Math.max(1,s('shots'))).toFixed(1),'уклонений',s('dodge'),'не увидели',s('blind'),'убито',res.reduce((a,r)=>a+(r.ships?r.ships.filter(x=>!x.alive).length:0),0));
await b.close()})();
