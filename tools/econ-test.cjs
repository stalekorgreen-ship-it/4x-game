// Прогон экономики без графики: node tools/econ-test.cjs [лет] — печатает по годам население, благосостояние, снабжение товарами, цены сырья, казну, корпорации, шахты
const {chromium}=require('playwright');
(async()=>{const Y=+(process.argv[2]||10);
const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(2500);
const r=await p.evaluate(async(Y)=>{try{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
 const D=await import(U('01-data.ts'));const E=await import(U('04-engine.ts'));D.newGame();const st=()=>D.state;st().raid&&(st().raid.eta=1e9);
 const rows=[];const sum=a=>Array.isArray(a)?a.reduce((x,y)=>x+(typeof y==='number'?y:sum(y)),0):typeof a==='number'?a:0;
 const snap=y=>{const S=st(),P=S.cols&&S.cols.earth&&S.cols.earth.pop;const f=P&&P.fill||{},pr=P&&P.price||{},rs=P&&P.rawSat||{};
  const r2=o=>Object.fromEntries(Object.entries(o).filter(([k,v])=>typeof v==='number').map(([k,v])=>[k,+v.toFixed(2)]));
  return {y,popM:P?Math.round(sum(P.n)/1e6):0,wel:P&&P.avgWel!=null?+P.avgWel.toFixed(2):null,money:Math.round((S.money||0)/1e9),corps:(S.corps||[]).length,
   mines:(S.corps||[]).reduce((a,c)=>a+(c.civ&&c.civ.mines?Object.values(c.civ.mines).reduce((x,y)=>x+y,0):0),0)+(P&&P.lmN||0),fill:r2(f),rawSat:r2(rs),price:r2(pr)}};
 rows.push(snap(0));for(let y=1;y<=Y;y++){E.advance(360,1);rows.push(snap(y))}return JSON.stringify(rows)}catch(e){return 'ERR '+e.stack.slice(0,600)}},Y);
if(r.startsWith('ERR'))console.log(r);else for(const x of JSON.parse(r))console.log(JSON.stringify(x));
if(errs.length)console.log('ERRS',[...new Set(errs)].slice(0,5));await b.close()})();
