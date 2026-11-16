// Ядро оценки ИИ в Web Worker: те же входы → те же числа (бит в бит), и время пакета в потоке против главного. node tools/worker-test.cjs
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));await p.goto('http://127.0.0.1:'+(process.env.PORT||5200)+'/');await p.waitForTimeout(2500);
console.log(await p.evaluate(async()=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);const D=await import(U('01-data.ts'));const K=await import(U('05w-ai-kernel.ts'));const M=await import(U('16-demo.ts'));const B=await import(U('05-battle.ts'));
 M.startBench(25,'');B.Battle.tickN(.2);const S=B.Battle.ships();const C=B.Battle.kernelConsts();K.initKernel(C);
 const clean=o=>JSON.parse(JSON.stringify(o));const batch=[];let r=1;const rnd=()=>{r=(r*16807)%2147483647;return r/2147483647};
 for(let i=0;i<20000;i++){const a=S[i%S.length],o=S[(i*7+3)%S.length];const ws=a.tur.filter(m=>m.cfg).map(m=>({k:m.k,cfg:m.cfg,alive:m.alive,face:m.face}));const tgt={T:{L:o.T.L},acc:o.acc||5,scl:(o.scl||[]).map(q=>({k:q.k,rng:q.rng,res:q.res})),rdOn:!!o.rdOn};
  if(i%2)batch.push({k3:1,ws,X:[{...tgt,acc:3},{...tgt,acc:5},{...tgt,acc:9}],d:5+rnd()*120,asp:rnd()*3});else batch.push({ws,o:tgt,d:5+rnd()*120,asp:rnd()*3,wpN:i%3?null:ws.length})}
 const B2=clean(batch);let t0=performance.now();const main=B2.map(q=>q.k3?K.dpsAt3(q.ws,q.X,q.d,q.asp):K.dpsAt(q.ws,q.o,q.d,q.asp,q.wpN));const mainMs=performance.now()-t0;
 const w=new Worker(new URL(U('05w-ai-worker.ts'),location.href),{type:'module'});await new Promise(res=>{w.onmessage=()=>res();w.postMessage({init:clean(C)})});
 t0=performance.now();const R=await new Promise(res=>{w.onmessage=e=>res(e.data);w.postMessage({batch:clean(batch)})});const rt=performance.now()-t0;w.terminate();
 let diff=0;for(let i=0;i<main.length;i++)if(main[i]!==R.out[i])diff++;
 return JSON.stringify({calls:main.length,mismatches:diff,mainMs:+mainMs.toFixed(1),workerMs:+R.ms.toFixed(1),roundTripMs:+rt.toFixed(1)})}));if(errs.length)console.log('ERR',errs);await b.close()})();
