// Показательный 3D-бой с диагностикой F4: node tools/demo3d.cjs <префикс png> "<COMP как в duel-test>" "<секунды кадров через запятую>" [дистанция камеры км] [порт]
// Корабли стоят друг против друга в 250 км (сторона 0 слева); на каждом кадре камера над центром флота стороны 0, включён оверлей тактики.
const {chromium}=require('playwright');
(async()=>{const [,,pre,COMP,TS,DIST='120',PORT='5200',SCRIPT='']=process.argv;
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist']});const p=await b.newPage({viewport:{width:1280,height:800}});
const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{let a=7;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}});
await p.goto('http://127.0.0.1:'+PORT+'/');await p.waitForTimeout(2500);
console.log(await p.evaluate(async(COMP)=>{try{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);window.__U=U;
 const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
 const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
 const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
 const TY={BB:sd=>mk('Броненосец',{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000},9500,5),FR:sd=>mk('Фрегат',{L:.15,arm:2,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:300,energy:5000},1500,10),
  PD:sd=>mk('Сторож ПВО',{L:.12,arm:2,gat:6,gatCfg:Array(6).fill(GC),ammoCap:300,energy:5000},1250,12),LR:sd=>mk('Дальнобой',{L:.25,arm:3,rails:3,railCfg:RC('30',3),gat:1,gatCfg:[GC],ammoCap:400,energy:5000},4500,5),
  IC:sd=>mk('Перехватчик',{L:.1,arm:1,rails:1,railCfg:RC('10',1),gat:2,gatCfg:[GC,GC],ammoCap:200,energy:5000},700,20),
  MS:sd=>{const MC=D.compOf(D.mkKey('missile',{pw:'30',en:'5',fu:'10',em:'1',ir:'0',ac:'0',hm:'0',mt:'50'})).mcfg;return mk('Ракетоносец',{L:.2,arm:2,miss:4,missCfg:Array(4).fill(MC),gat:2,gatCfg:[GC,GC],ammoCap:400,energy:5000},3000,8)}};
 const late=[];for(const sd of [0,1])for(const k of COMP.split(';')[sd].split(',')){const x=TY[k.replace(/\*/g,'')](sd);if(k.includes('*'))x.dmg=k.endsWith('**')?.72:.6;late.push({t:0,side:sd,spec:x,edge:80,ang:sd?Math.PI:0})}
 D.state.demo=true;D.state.paused=false;B.Battle.begin({title:'Показательный бой',fleets:[[],[]],late,demo:true,maxT:1e5,seed:7,names:['Синие','Красные'],onEnd(){}});
 B.Battle.tickN(1);const SS=B.Battle.ships().filter(s=>!s.bayOf),k=[0,0];for(const s of SS){const i=k[s.side]++;s.sx=s.vx=s.sy=s.vy=0;s.x=s.side?250:0;s.y=(i-4)*6;s.hd=s.side?Math.PI:0}D.state.paused=true;return 'ok'}catch(e){return 'ERR '+e.stack.slice(0,400)}},COMP));
await p.waitForTimeout(800);await p.evaluate(()=>document.getElementById('b3d').click());await p.waitForTimeout(800);
await p.addStyleTag({content:'canvas{position:fixed!important;left:0;top:0;width:100vw!important;height:100vh!important;z-index:99999!important}'});
let el=0,i=0;for(const ts of TS.split(',').map(Number)){
 const info=await p.evaluate(async([n,dist,SCRIPT,ts])=>{const B=await import(window.__U('05-battle.ts'));const D=await import(window.__U('01-data.ts'));D.state.paused=true;{const t1=B.Battle.time()+n;let g=0;while(B.Battle.time()<t1&&!B.Battle.isDone()&&g++<1e6)B.Battle.tickN(.001)}
  const H=B.Battle.dmgT,S0=B.Battle.ships().filter(s=>!s.bayOf),tgt=S0[0],strip=(s,zi)=>{const z=s.zones[zi];z.cols.fill(0);z.armN=0},log=window.__dlog=window.__dlog||[];
  // сценарии демонстраций: настоящие пробития через hitShip (броня снята — чтобы событие случилось в кадре), дальше всё делает симуляция
  if(SCRIPT&&!window.__done&&tgt.alive){window.__done=1;
   if(SCRIPT==='A'){strip(tgt,0);H.hit(tgt,'rail',0,{v:7,kg:15});H.detonate(tgt,0);log.push('A (бросок детонации задан, взрыв считает симуляция): детонаций '+(tgt.dets||0)+' '+JSON.stringify(tgt.detLog)+', экипаж '+tgt.crN+'/'+tgt.pers0+', модули '+tgt.aliveN+'/'+tgt.total)}
   if(SCRIPT==='B'){tgt.mag=0;for(let i=0;i<60&&tgt.crN>tgt.pers0*.5&&tgt.aliveN>tgt.total*.4;i++){const z=[1,3,0][i%3];strip(tgt,z);H.hit(tgt,'rail',z,{v:7,kg:15})}log.push('B: экипаж '+tgt.crN+'/'+tgt.pers0+' '+JSON.stringify(tgt.dead))}
   if(SCRIPT==='C'){tgt.mag=0;for(let i=0;i<40&&tgt.crN>0;i++)for(let z=0;z<4;z++)H.crewKill(tgt,z,1,'пробитие');tgt.__v0=[tgt.sx,tgt.sy];log.push('C: экипаж '+tgt.crN+', модули '+tgt.aliveN+'/'+tgt.total)}
   if(SCRIPT==='D'){for(let i=0;i<3;i++){strip(tgt,2);H.hit(tgt,'rail',2,{v:7,kg:15})}for(const z of [1,3]){strip(tgt,z);H.hit(tgt,'rail',z,{v:7,kg:15})}if(!tgt.fire[1]&&!tgt.vac[1])tgt.fire[1]=2;H.detonate(tgt,0,4);
     log.push('D: двигатели '+H.sysEff(tgt,'E').toFixed(2)+' сенсоры '+H.sysEff(tgt,'D').toFixed(2)+' оружие '+tgt.tur.filter(m=>H.modEff(tgt,m)>0).length+'/'+tgt.tur.length+' вакуум '+tgt.vac+' пожары '+tgt.fire+' детонаций '+(tgt.dets||0)+' состояние '+H.shipState(tgt)+' ('+tgt.csWhy+')')}}
  const sh=SCRIPT&&tgt?[tgt]:B.Battle.ships().filter(s=>s.alive&&s.side===0&&!s.bayOf);if(!sh.length)return 'нет кораблей: всего '+B.Battle.ships().length+' живых '+B.Battle.ships().filter(s=>s.alive).length+' t='+B.Battle.time()+' done='+B.Battle.isDone();let cx=0,cy=0;for(const q of sh){cx+=q.x;cy+=q.y}window.__b3d.tac(true);window.__b3d.look({x:cx/sh.length,y:cy/sh.length,z:0,hd:0},0,1.2,dist);
  return (window.__dlog||[]).join(' | ')+' || '+B.Battle.ships().filter(s=>!s.bayOf).slice(0,3).map(s=>s.side+(s.T.n||'')+':'+(s.alive?'':'†')+(s.cst||'')+' экипаж '+(s.crN!=null?s.crN+'/'+s.pers0:'-')+(s.derelict?' остов v='+Math.hypot(s.sx,s.sy).toFixed(3):'')).join(' ')},[ts-el,+DIST,SCRIPT,ts]);el=ts;
 await p.waitForTimeout(1500);await p.screenshot({path:`${pre}${i++}.png`});console.log(ts,info)}
console.log(errs.slice(0,3));await b.close()})();
