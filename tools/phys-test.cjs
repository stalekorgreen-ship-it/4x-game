// Проверка физики боя без графики: node tools/phys-test.cjs [секунд боя]
// Перехватчик (500 т, ~30 м/с²) и тяжёлый (9 500 т, ~5 м/с²) с каждой стороны. Печатает числа: наскоки, сближение, дальности выстрелов, уклонения, вращение, пробития.
const {chromium}=require('playwright');
(async()=>{const T=+(process.argv[2]||600);
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(2500);
const r=await p.evaluate(async(T)=>{try{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
 const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
 const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'10'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
 const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
 const late=[];for(const sd of [0,1]){const a=sd?Math.PI:0;
  late.push({t:0,side:sd,spec:mk('Перехватчик'+sd,{L:.1,arm:1,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:200,energy:5000},500,30),edge:80,ang:a});
  late.push({t:0,side:sd,spec:mk('Броненосец'+sd,{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000},9500,5),edge:80,ang:a+.1})}
 D.state.demo=true;D.state.paused=false;B.Battle.begin({title:'t',fleets:[[],[]],late,demo:true,maxT:1e5,names:['a','b'],onEnd(){}});
 const out={raid:{},cl:{},spin:0,arm0:{},fireD:{rail:[],gat:[]},seen:new Set()};let t0=B.Battle.time();
 const shipArm=s=>s.zones.reduce((a,z)=>a+z.armN,0);
 while(B.Battle.time()-t0<T&&!B.Battle.isDone()){B.Battle.tickN(1);
  for(const s of B.Battle.ships()){if(!s.alive)continue;const n=s.T.n;out.arm0[n]=out.arm0[n]||shipArm(s);
   if(s.raider){out.raid[n]=out.raid[n]||{in:0,out:0,last:null,maxV:0};const R=out.raid[n];if(s.rd!==R.last){if(s.rd)R[s.rd]++;R.last=s.rd}R.maxV=Math.max(R.maxV,Math.hypot(s.sx,s.sy))}
   if(s.tg&&s.tg.alive){const dx=s.tg.x-s.x,dy=s.tg.y-s.y,d=Math.hypot(dx,dy)||1,c=-((s.tg.sx-s.sx)*dx+(s.tg.sy-s.sy)*dy)/d;out.cl[n]=Math.max(out.cl[n]||0,c)}
   out.spin=Math.max(out.spin,Math.abs(s.spin||0))}
  for(const q of B.Battle.proj()){if(out.seen.has(q))continue;out.seen.add(q);if(q.src&&q.src.tg&&q.src.tg.alive){const d=Math.hypot(q.src.tg.x-q.o0.x,q.src.tg.y-q.o0.y);(q.kk?out.fireD.rail:out.fireD.gat).push(d)}}}
 const st=B.Battle.stat(),f=a=>a.length?{n:a.length,max:+Math.max(...a).toFixed(1),avg:+(a.reduce((x,y)=>x+y,0)/a.length).toFixed(1)}:null;
 return JSON.stringify({t:Math.round(B.Battle.time()-t0),raid:out.raid,maxClosingKmS:Object.fromEntries(Object.entries(out.cl).map(([k,v])=>[k,+v.toFixed(2)])),
  fireDistKm:{rail:f(out.fireD.rail),gat:f(out.fireD.gat)},dodges:st.dodge||0,maxSpinDegS:+(out.spin*57.3).toFixed(4),hits:st.hits,shots:st.shots,
  armorLeft:Object.fromEntries(B.Battle.ships().map(s=>[s.T.n,(s.alive?'':'† ')+shipArm(s)+'/'+out.arm0[s.T.n]])),accel:Object.fromEntries(B.Battle.ships().map(s=>[s.T.n,+s.acc.toFixed(1)]))},null,1)}catch(e){return 'ERR '+e.stack.slice(0,500)}},T);
console.log(r);if(errs.length)console.log('ERRS',errs.slice(0,5));await b.close()})();
