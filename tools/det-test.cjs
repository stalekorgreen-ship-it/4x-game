// Регрессия детерминированности боя: один и тот же бой (seed) прогоняется тремя способами, итоговое состояние должно совпасть до бита.
//  A — ровные кадры; B — кадры разной длительности (как при скачущем FPS); C — посторонний расход общего Math.random и другой ход часов между кадрами (как графика, звук, интерфейс).
// node tools/det-test.cjs [seeds=3] [секунд боя=600] [состав=FR,BB,PD,FR;BB,FR,PD,BB]
const {chromium}=require('playwright');
(async()=>{const [,,N='3',T='600',COMP='FR,BB,PD,FR;BB,FR,PD,BB']=process.argv;const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});let bad=0;
for(let seed=1;seed<=+N;seed++){const H=[];
 for(const mode of ['A','B','C']){const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
  await p.addInitScript(([s,mode])=>{let a=s>>>0,c=0,d=1.7e12;window.__reseed=()=>{a=s>>>0;c=0;d=1.7e12};Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296};
   const st=mode==='C'?7.3:.05;performance.now=()=>(c+=st);Date.now=()=>(d+=mode==='C'?13:1)},[seed,mode]);
  await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(1500);
  const h=await p.evaluate(async([T,COMP,mode])=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
   const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));window.__reseed();D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
   const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
   const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
   const K={FR:()=>mk('Фрегат',{L:.15,arm:2,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:300,energy:5000},1500,10),BB:()=>mk('Броненосец',{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000},9500,5),PD:()=>mk('Сторож',{L:.12,arm:2,gat:6,gatCfg:Array(6).fill(GC),ammoCap:300,energy:5000},1250,12)};
   const late=[];COMP.split(';').forEach((L,sd)=>L.split(',').forEach((k,i)=>late.push({t:0,side:sd,spec:K[k](),edge:60,ang:sd*Math.PI+(i-1.5)*.1})));
   D.state.demo=true;B.Battle.begin({title:'det',fleets:[[],[]],late,demo:true,maxT:1e5,names:['a','b'],onEnd(){}});
   let i=0;while(B.Battle.time()<T&&!B.Battle.isDone()){i++;if(mode==='A')B.Battle.tickN(1/30);else{const r=.005+((i*7919)%29)/29*.028;B.Battle.tickN(r);if(mode==='C'){const k=(i*31)%17;for(let j=0;j<k;j++)Math.random();performance.now()}}}
   const st=B.Battle.stat();return JSON.stringify({t:B.Battle.time(),hits:st.hits,shots:st.shots,lost:st.lost,s:B.Battle.ships().map(s=>[s.uid,s.alive,s.aliveN,+s.x.toFixed(9),+s.y.toFixed(9),+(s.sx||0).toFixed(12),+(s.hd||0).toFixed(9),+(s.fuel||0).toFixed(6)])})},[+T,COMP,mode]);
  H.push(h);if(errs.length)console.log('ОШИБКИ',mode,errs.slice(0,2));await p.close()}
 const same=H[0]===H[1]&&H[1]===H[2];if(!same)bad++;console.log('seed',seed,same?'совпадает (A=B=C)':'РАСХОДИТСЯ',same?'':H.map(x=>x.slice(0,140)).join('\n'))}
console.log(bad?'ДЕТЕРМИНИРОВАННОСТЬ НАРУШЕНА':'детерминированность: OK');await b.close();process.exit(bad?1:0)})();
