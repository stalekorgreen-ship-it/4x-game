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
 const r=await p.evaluate(async([T,typ])=>{try{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
  const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
  const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'10'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
  const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
  const late=[];for(const sd of [0,1]){const a=sd?Math.PI:0;
   late.push({t:0,side:sd,spec:typ==='fr'?mk('Фрегат'+sd,{L:.15,arm:2,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:300,energy:5000},1500,10):mk('Броненосец'+sd,{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000},9500,5),edge:80,ang:a})}
  D.state.demo=true;D.state.paused=false;B.Battle.begin({title:'d',fleets:[[],[]],late,demo:true,maxT:1e5,names:['a','b'],onEnd(){}});
  const t0=B.Battle.time();while(B.Battle.time()-t0<T&&!B.Battle.isDone())B.Battle.tickN(1);
  const st=B.Battle.stat(),arm=s=>s.zones.reduce((a,z)=>a+z.armN,0);
  return {t:Math.round(B.Battle.time()-t0),hits:st.hits,shots:st.shots,dodge:st.dodge||0,blind:st.blind||0,ships:B.Battle.ships().filter(s=>!s.bayOf).map(s=>({n:s.T.n,alive:s.alive,mod:s.aliveN+'/'+s.total,arm:arm(s)}))}}catch(e){return {err:e.stack.slice(0,400)}}},[+T,typ]);
 r.seed=seed;if(errs.length)r.errs=errs.slice(0,3);res.push(r);await p.close()}
for(const r of res)console.log(JSON.stringify(r));
const s=k=>res.reduce((a,r)=>a+(r[k]?(Array.isArray(r[k])?r[k][0]+r[k][1]:r[k]):0),0);
console.log('ИТОГ: попаданий',s('hits'),'выстрелов',s('shots'),'точность %',(100*s('hits')/Math.max(1,s('shots'))).toFixed(1),'уклонений',s('dodge'),'не увидели',s('blind'),'убито',res.reduce((a,r)=>a+(r.ships?r.ships.filter(x=>!x.alive).length:0),0));
await b.close()})();
