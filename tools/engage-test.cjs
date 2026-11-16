// Согласованное вступление в бой: зеркальный бой из демо (размер SIZE, по умолчанию 3), N seed; для каждой стороны — момент первого контакта каждого флота
// (любой его корабль в досягаемости своего оружия от врага), разброс контактов, потери в первые 300 с после первого контакта.
// node tools/engage-test.cjs [N=6] ['{правка battle.json}'] ; PORT, SIZE
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const N=+(process.argv[2]||6),P=JSON.parse(process.argv[3]||'{}'),base=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','battle.json'),'utf8'));for(const k in P)base[k]=Object.assign(base[k]||{},P[k]);
const b=await chromium.launch();const res=[];
for(let seed=1;seed<=N;seed++){const p=await b.newPage();p.on('pageerror',e=>console.log('ERR',e.message));await p.route('**/data/battle.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(base)}));
 await p.addInitScript(s=>{let a=s;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}},seed*7919);
 await p.addInitScript(x=>{window.__TMAX=x},process.env.TMAX||1800);await p.goto('http://127.0.0.1:'+(process.env.PORT||5200)+'/');await p.waitForTimeout(2500);
 res.push(await p.evaluate(async([seed,size])=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);const D=await import(U('01-data.ts'));const M=await import(U('16-demo.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
  const cfg=M.makeScenario('line',size);cfg.seed=seed;cfg.env=false;D.state.demo=true;D.state.paused=false;B.Battle.begin(cfg);
  const T=()=>B.Battle.time(),first={},lost0={},fl={};let tc=[null,null];
  while(T()<(+window.__TMAX||1800)&&!B.Battle.isDone()){B.Battle.tickN(.1);const S=B.Battle.ships().filter(s=>s.alive&&!s.bayOf);
   for(const s of S){if(!s.F||s.T.role)continue;const k=s.F.key;fl[k]=s.side;if(first[k])continue;for(const o of S){if(o.side===s.side)continue;if(Math.hypot(o.x-s.x,o.y-s.y)<(s.maxR||60)){first[k]=T();if(tc[s.side]==null)tc[s.side]=T();break}}}
   for(const sd of [0,1])if(tc[sd]!=null&&lost0[sd]==null&&T()>tc[sd]+300)lost0[sd]=B.Battle.stat().lost[sd]}
  const out={seed,t:Math.round(T()),sides:[]};for(const sd of [0,1]){const ks=Object.keys(fl).filter(k=>fl[k]===sd),ts=ks.map(k=>first[k]).filter(x=>x!=null);out.sides.push({fleets:ks.length,engaged:ts.length,first:ts.length?Math.round(Math.min(...ts)):null,spread:ts.length>1?Math.round(Math.max(...ts)-Math.min(...ts)):0,lost300:lost0[sd]??null,lostEnd:B.Battle.stat().lost[sd]})}
  out.sync=B.Battle.stat().sync||null;return out},[seed,+(process.env.SIZE||3)]));await p.close();console.log(JSON.stringify(res[res.length-1]))}
const av=f=>(res.reduce((a,r)=>a+f(r),0)/res.length).toFixed(1);console.log('СВОДКА разброс контактов флотов, с:',av(r=>(r.sides[0].spread+r.sides[1].spread)/2),'· потери за 300 с после первого контакта:',av(r=>((r.sides[0].lost300||0)+(r.sides[1].lost300||0))/2),'· вступило флотов:',av(r=>(r.sides[0].engaged+r.sides[1].engaged)/2),'из',av(r=>(r.sides[0].fleets+r.sides[1].fleets)/2));await b.close()})();
