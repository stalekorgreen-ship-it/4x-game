// Повторяемый тестовый бой: одинаковые флоты при одинаковом seed. node tools/abtest.cjs <seed> '<json-правка battle.json>' [размер=2] [шагов=450]
// Пример: node tools/abtest.cjs 7 '{"lead":{"acc":0,"bracket":0}}'
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const [,,seed='1',patch='{}',size='2',ticks='1800']=process.argv;
const base=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','battle.json'),'utf8'));const P=JSON.parse(patch);for(const k in P)base[k]=Object.assign(base[k]||{},P[k]);
const b=await chromium.launch({args:['--use-gl=swiftshader']});const p=await b.newPage();
await p.route('**/data/battle.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(base)}));
await p.addInitScript(s=>{let a=s>>>0;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};window.__detNow=()=>{let c=0;performance.now=()=>(c+=.05)}},+seed);
await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(2500);
const r=await p.evaluate(async([size,ticks])=>{const U0=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);const DD=await import(U0('01-data.ts'));window.__detNow();window.__game.startDemo('line',size);DD.state.paused=true;const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);const B=await import(U('05-battle.ts'));B.Battle.tickFixed(ticks);const S=B.Battle.ships(),st=B.Battle.stat();
 return {t:Math.round(B.Battle.time()),alive:[0,1].map(sd=>S.filter(s=>s.side===sd&&s.alive).length+'/'+S.filter(s=>s.side===sd).length),hit:[...st.hits],shot:[...st.shots],salvo:st.salvo||0,acc:[0,1].map(i=>Math.round(100*st.hits[i]/Math.max(1,st.shots[i]))+'%')}},[+size,+ticks]);
console.log(JSON.stringify({seed:+seed,patch:P,...r}));await b.close()})();
