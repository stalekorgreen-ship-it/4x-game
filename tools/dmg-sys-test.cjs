// Внутренние повреждения: 19 автоматических сценариев (20-й — детерминизм — tools/det-test.cjs). node tools/dmg-sys-test.cjs
// Каждый сценарий — настоящий бой (Battle.begin) с кораблями стенда; попадания идут через hitShip (броня → модули → люди/погреб), время — шагами боя.
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{let a=11;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}});
await p.goto('http://127.0.0.1:'+(process.env.PORT||5200)+'/');await p.waitForTimeout(2500);
const R=await p.evaluate(async()=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
 const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
 const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg,MC=D.compOf(D.mkKey('missile',{pw:'30',en:'5',fu:'10',em:'1',ir:'0',ac:'0',hm:'0',mt:'50'})).mcfg;
 const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
 const BB=()=>mk('Броненосец',{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000},9500,5),FR=()=>mk('Фрегат',{L:.15,arm:2,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:300,energy:5000},1500,10),
  MS=()=>mk('Ракетоносец',{L:.2,arm:2,miss:4,missCfg:Array(4).fill(MC),gat:2,gatCfg:[GC,GC],ammoCap:400,energy:5000},3000,8);
 const T=()=>B.Battle.time(),run=s=>{const t1=T()+s;let g=0;while(T()<t1&&!B.Battle.isDone()&&g++<2e6)B.Battle.tickN(.001)};
 const battle=(a,b,place)=>{B.Battle.begin({title:'t',fleets:[[],[]],late:[...a.map(f=>({t:0,side:0,spec:f(),edge:80,ang:0})),...b.map(f=>({t:0,side:1,spec:f(),edge:80,ang:Math.PI}))],demo:true,maxT:1e6,seed:5,names:['a','b'],onEnd(){}});
  D.state.demo=true;D.state.paused=false;B.Battle.tickN(.01);const S=B.Battle.ships().filter(s=>!s.bayOf),k=[0,0];for(const s of S){const i=k[s.side]++;s.sx=s.vx=s.sy=s.vy=0;s.x=s.side?(place||3000):0;s.y=i*20;s.hd=s.side?Math.PI:0}return S};
 const strip=(s,zi)=>{const z=s.zones[zi];z.cols.fill(0);z.armN=0};const H=B.Battle.dmgT,out=[];const ok=(n,c,info)=>out.push({n,ok:!!c,info});
 // 1. пустой погреб
 {const S=battle([BB,BB,BB,BB,BB],[FR]);let dets=0,x=0;for(const s of S.filter(s=>s.side===0)){s.mag=0;x+=H.zoneAmmo(s,0).x;for(let i=0;i<40&&s.alive;i++){strip(s,0);H.hit(s,'rail',0,{v:7,kg:60})}dets+=s.dets||0}ok('1 пустой склад не взрывается',dets===0&&x===0,{x,dets})}
 // 2. полный погреб
 let fullDets=0;{const S=battle(Array(10).fill(BB),[FR]);for(const s of S.filter(s=>s.side===0)){for(let i=0;i<40&&s.alive;i++){strip(s,0);H.hit(s,'rail',0,{v:7,kg:60})}fullDets+=s.dets||0}ok('2 заполненный склад может сдетонировать',fullDets>0,{dets:fullDets,ships:10})}
 // 3. больше запаса — тяжелее последствия (одинаковый тип, взрыв всего запаса отсека)
 {const S=battle(Array(8).fill(BB),[FR]),A=S.filter(s=>s.side===0);let big=0,small=0,xb=0,xs=0;A.forEach((s,i)=>{if(i%2)s.mag/=5;const x=H.zoneAmmo(s,0).x,m0=s.aliveN,c0=s.crN;H.detonate(s,0);const loss=(m0-s.aliveN)+(c0-s.crN)/10;if(i%2){small+=loss;xs+=x}else{big+=loss;xb+=x}});
  ok('3 большой запас — тяжелее последствия',big>small&&xb>xs,{lossBig:big,lossSmall:small,xBig:+xb.toFixed(1),xSmall:+xs.toFixed(1)})}
 // 4. расход уменьшает опасность
 {const S=battle([BB],[FR]),s=S[0],x0=H.zoneAmmo(s,0).x;s.mag*=.3;const x1=H.zoneAmmo(s,0).x;ok('4 расход боезапаса уменьшает силу детонации',x1<x0*.4,{x0:+x0.toFixed(2),x1:+x1.toFixed(2)})}
 // 5. соседние отсеки
 {const S=battle([BB],[FR]),s=S[0],c=[1,3].map(z=>s.cg.filter(q=>q.zi===z).reduce((a,q)=>a+q.n,0)),m=[1,3].map(z=>s.zones[z].mods.filter(q=>q.alive).length);H.detonate(s,0,8);
  const c2=[1,3].map(z=>s.cg.filter(q=>q.zi===z).reduce((a,q)=>a+q.n,0)),m2=[1,3].map(z=>s.zones[z].mods.filter(q=>q.alive).length);ok('5 взрыв повреждает соседние отсеки',c2[0]+c2[1]<c[0]+c[1]&&m2[0]+m2[1]<m[0]+m[1],{crewAdj:[c,c2],modsAdj:[m,m2]})}
 // 6. цепная детонация
 {const S=battle(Array(10).fill(BB),[FR]);const st0=B.Battle.stat().crw.chain;for(const s of S.filter(s=>s.side===0))H.detonate(s,0,8);const ch=B.Battle.stat().crw.chain-st0;ok('6 взрыв может вызвать цепную детонацию',ch>0,{chain:ch,of:10})}
 // 7. пробитие обитаемого отсека
 {const S=battle([BB],[FR]),s=S[0],c0=s.crN;for(let i=0;i<6;i++){strip(s,1);H.hit(s,'rail',1,{v:7,kg:60})}ok('7 пробитие обитаемого отсека убивает людей',s.crN<c0,{before:c0,after:s.crN,dead:s.dead})}
 // 8. броня держит — без гибели
 {const S=battle([BB],[FR]),s=S[0],c0=s.crN,a0=s.zones[0].armN;for(let i=0;i<60;i++)H.hit(s,'gat',0,{v:1,kg:.4});ok('8 попадание, остановленное бронёй, не убивает людей',s.crN===c0,{before:c0,after:s.crN,armorLeft:s.zones[0].armN+'/'+a0})}
 // 9. часть экипажа погибла — бой продолжается
 {const S=battle([BB],[FR],40),s=S[0];for(let z=0;z<4;z++)H.crewKill(s,z,.35);run(30);const sh0=B.Battle.stat().shots[0];run(240);ok('9 часть экипажа погибла — корабль продолжает бой',s.crN>0&&s.capW>0&&B.Battle.stat().shots[0]>sh0,{crew:s.crN+'/'+s.pers0,state:s.cst,shots:B.Battle.stat().shots[0]-sh0})}
 // 10–11. весь экипаж погиб, корпус цел; остов не выполняет приказов
 {const S=battle([BB],[FR],40),s=S[0];s.sx=.1;for(let i=0;i<30&&s.crN>0;i++)for(let z=0;z<4;z++)H.crewKill(s,z,1);const v0=[s.sx,s.sy],hp=s.aliveN/s.total;run(5);
  ok('10 экипаж погиб, корпус цел',s.alive&&s.crN===0&&s.cst==='остов'&&hp>.9,{hp:+hp.toFixed(2),state:s.cst,alive:s.alive});const sh0=B.Battle.stat().shots[0];run(200);
  ok('11 необитаемый: без приказов, по инерции, без прицельного огня',s.derelict&&!s.task&&Math.hypot(s.sx-v0[0],s.sy-v0[1])<.005&&B.Battle.stat().shots[0]===sh0,{dv:+Math.hypot(s.sx-v0[0],s.sy-v0[1]).toFixed(4),shots:B.Battle.stat().shots[0]-sh0,derelict:!!s.derelict})}
 // 12. сенсоры
 {const S=battle([FR,FR],[FR],170),a=S[0],c=S[1],e=S[2];c.y=0;a.y=0;e.y=0;c.side=0;for(const g of c.cg)if(g.sp==='сенсоры')g.n=0;run(3);const sa=a.side;// оба на одном месте: один целый, у другого операторы сенсоров погибли
  const effA=H.sysEff(a,'D'),effC=H.sysEff(c,'D');ok('12 потеря сенсоров ухудшает обнаружение',effC===0&&effA===1,{sensEffIntact:effA,sensEffDamaged:effC,note:'дальность обнаружения ×(0,3+0,7·эфф.)'})}
 // 13. двигатели
 {const S=battle([FR,FR],[FR],200),a=S[0],c=S[1];for(const g of c.cg)if(g.sp==='двигатель')g.n=0;run(60);ok('13 потеря двигателей ухудшает манёвренность',Math.hypot(c.sx,c.sy)<Math.hypot(a.sx,a.sy)*.5,{vIntact:+Math.hypot(a.sx,a.sy).toFixed(3),vDamaged:+Math.hypot(c.sx,c.sy).toFixed(3),state:c.cst})}
 // 14. управление
 {const S=battle([FR,FR],[FR],200),a=S[0],c=S[1];for(const g of c.cg)if(g.sp==='маневровые'||g.cmd)g.n=0;a.hd=c.hd=Math.PI;const h0a=a.hd,h0c=c.hd;run(20);const da=Math.abs(Math.atan2(Math.sin(a.hd-h0a),Math.cos(a.hd-h0a))),dc=Math.abs(Math.atan2(Math.sin(c.hd-h0c),Math.cos(c.hd-h0c)));
  ok('14 повреждение управления ограничивает манёвры',dc<da*.5,{turnIntact:+da.toFixed(2),turnDamaged:+dc.toFixed(2),state:c.cst})}
 // 15. пожар распространяется
 {const S=battle(Array(8).fill(BB),[FR]);const A=S.filter(s=>s.side===0);for(const s of A)s.fire[0]=3;run(240);const spread=A.filter(s=>s.fire[1]||s.fire[3]||(B.Battle.stat().crw.fire>0)).length,dead=A.reduce((x,s)=>x+(s.dead['пожар']||0),0),mods=A.reduce((x,s)=>x+s.total-s.aliveN,0);
  ok('15 пожар распространяется и даёт вторичные повреждения',B.Battle.stat().crw.fire>0&&dead>0&&mods>0,{spreads:B.Battle.stat().crw.fire,crewDead:dead,modsLost:mods})}
 // 16. разгерметизация одного отсека
 {const S=battle([BB],[FR]),s=S[0];s.mag=0;for(const m of s.tur)if(m.k==='M')m.ammo=0;let i=0;while(!s.vac[1]&&i++<50){strip(s,1);H.hit(s,'rail',1,{v:7,kg:60})}const other=s.cg.filter(q=>q.zi===0||q.zi===2).reduce((a,q)=>a+q.n,0),other0=s.cg.filter(q=>q.zi===0||q.zi===2).reduce((a,q)=>a+q.n0,0);
  ok('16 разгерметизация одного отсека не губит корабль',s.alive&&s.vac[1]===1&&s.vac[0]===0&&other===other0,{vac:s.vac,crewOtherZones:other+'/'+other0,alive:s.alive})}
 // 17. ИИ не считает остов угрозой и уходит с него
 {const S=battle([BB],[FR,FR],60),a=S[0],e1=S[1];run(30);for(const g of e1.cg)if(g.m&&'TGAMLE'.includes(g.m.k))g.n=0;run(260);
  ok('17 ИИ корректно оценивает выведенного из строя противника',(!a.task||a.task.tg!==e1),{enemyState:e1.cst,ourTarget:a.task&&a.task.tg?a.task.tg.T.n+(a.task.tg===e1?' (остов!)':''):null})}
 // 18. командование: флагман без оружия — новый флагман, задачи у остальных
 {const S=battle([BB,FR,FR],[FR,FR],90),f=S[0];run(25);for(const g of f.cg)if(g.m&&'TGAML'.includes(g.m.k))g.n=0;run(30);const F=S[1].F;
  ok('18 командование перераспределяет задачи после потери боеспособного корабля',F&&F.flag!==f&&S[1].task&&S[2].task,{flag:F&&F.flag?F.flag.T.n:null,disabled:f.cst})}
 // 19. корабль без данных об экипаже — значения по умолчанию
 {const S=battle([()=>{const x=BB();delete x.crew;return x}],[FR]),s=S[0];ok('19 старые корабли получают экипаж по умолчанию',s.pers0>0&&s.cg.length>5&&s.crew===1,{pers0:s.pers0,groups:s.cg.length})}
 // ===== ЖИВУЧЕСТЬ И РЕМОНТ (R1–R15) =====
 const killAll=(s,f)=>{for(const z of s.zones)for(const m of z.mods)if(m.alive&&(!f||f(m)))B.Battle.dmgT.mdead(s,m)},dead=(s,f)=>s.zones.flatMap(z=>z.mods).filter(m=>!m.alive&&(!f||f(m))).length,W=m=>'TGAML'.includes(m.k);
 // R1
 {const S=battle([BB],[FR]),s=S[0];killAll(s);run(5);ok('R1 все модули выбиты, экипаж и корпус целы — корабль не уничтожен',s.alive&&s.aliveN===0&&s.crN>0,{alive:s.alive,mods:s.aliveN+'/'+s.total,crew:s.crN,hull:s.hullF,state:s.cst})}
 // R2
 {const S=battle([BB,FR],[FR]),s=S[0];killAll(s,W);run(3);const tasks=s.dcT.filter(q=>q.k==='mod'&&W(q.m)).length;run(1500);ok('R2 всё вооружение потеряно — экипаж ремонтирует',tasks>0&&dead(s,W)<s.tur.length,{tasksAt3s:tasks,deadWeaponsAfter1500s:dead(s,W)+'/'+s.tur.length,fixed:B.Battle.stat().crw.fixed})}
 // R3
 {const S=battle([FR],[FR]),s=S[0];killAll(s,m=>m.k==='E');run(3);const st=s.cst;run(2400);ok('R3 двигатели потеряны — корабль остаётся и восстанавливает их',s.alive&&st==='обездвижен'&&s.engN>0,{stateAfterLoss:st,engAfter2400s:s.engN+'/'+s.T.eng,state:s.cst})}
 // R4
 {const S=battle([FR],[FR]),s=S[0];killAll(s,m=>m.k==='D'||(m.k==='R'&&rnd2()<.5));run(2400);ok('R4 сенсоры и часть маневровых — ремонтируются',dead(s,m=>m.k==='D'||m.k==='R')===0,{deadSensRcs:dead(s,m=>m.k==='D'||m.k==='R')})}
 function rnd2(){return .3}
 // R5
 {const S=battle([BB,BB,FR],[FR]),a=S[0],c=S[1];killAll(a);killAll(c);for(const q of c.cg)q.n=Math.min(q.n,q.m?0:1);c.cg.find(q=>q.cmd).n=1;B.Battle.dmgT.crewSync(c);run(3600);
  ok('R5 малый экипаж восстанавливает только часть систем',c.aliveN<a.aliveN&&c.aliveN<c.total,{fullCrewRestored:a.aliveN+'/'+a.total,smallCrew:c.crN,smallRestored:c.aliveN+'/'+c.total})}
 // R6
 {const S=battle([BB],[FR]),s=S[0];killAll(s);for(let i=0;i<30&&s.crN>0;i++)for(let z=0;z<4;z++)H.crewKill(s,z,1);run(600);ok('R6 без экипажа ремонта нет',s.aliveN===0&&s.crN===0,{mods:s.aliveN,crew:s.crN,state:s.cst})}
 // R7
 {const S=battle([BB],[FR]),s=S[0];killAll(s,m=>m.k==='E'&&m.z===2);s.fire[2]=2;run(3);const first=s.dcT[0];ok('R7 горящий отсек: сначала тушат',first&&first.k==='fire'&&!s.dcT.some(q=>q.k==='mod'&&q.zi===2),{firstTask:first&&first.k,zone:first&&first.zi,tasks:s.dcT.map(q=>q.k+':'+q.zi)})}
 // R8
 {const S=battle([BB,BB],[FR]),a=S[0],c=S[1];killAll(a,m=>m.z===1);killAll(c,m=>m.z===1);c.vac[1]=1;for(const z of [0,2,3]){a.zones[z].mods.forEach(()=>0)}run(240);
  const ra=a.zones[1].mods.filter(m=>m.alive).length,rc=c.zones[1].mods.filter(m=>m.alive).length;ok('R8 разгерметизированный отсек ограничивает ремонт',rc<ra||(c.vac[1]===0&&c.zones[1].vw===0),{normal:ra,vacuum:rc,vacNow:c.vac[1]})}
 // R9
 {const S=battle([BB],[FR]),s=S[0];killAll(s);run(3);const pool=s.cg.filter(q=>!q.cmd&&(!q.m||!q.m.alive)).reduce((a,q)=>a+q.n,0),used=s.dcT.reduce((a,q)=>a+q.w,0);ok('R9 одни и те же люди не работают на нескольких задачах',used<=pool,{peopleFree:pool,peopleOnTasks:used,tasks:s.dcT.length})}
 // R10–R11
 {const S=battle([BB],[FR],40),s=S[0];const m=s.tur.find(m=>m.k==='T');B.Battle.dmgT.mdead(s,m);m.wreck=1;run(10);const a10=m.alive;run(3000);ok('R10 уничтоженный модуль не восстанавливается мгновенно',!a10,{aliveAfter10s:a10});
  const sh0=B.Battle.stat().shots[0];run(300);ok('R11 восстановленный модуль снова работает',m.alive&&H.modEff(s,m)>0&&(B.Battle.stat().shots[0]>sh0||m.why),{alive:m.alive,eff:+H.modEff(s,m).toFixed(2),q:m.q,spares:s.spares+'/'+s.spares0,why:m.why})}
 // R12
 {const S=battle([BB],[FR]),s=S[0];H.hull(s,1,100);const sp=s.zones[1].sp;run(900);ok('R12 разрушенный отсек корпуса не восстанавливается',s.zones[1].sp===sp&&s.zones[1].brk===1&&s.zones[1].mods.every(m=>!m.alive),{sp:s.zones[1].sp,brk:s.zones[1].brk,alive:s.alive})}
 // R13
 {const S=battle([BB],[FR]),s=S[0];H.detonate(s,0,80);ok('R13 детонация может уничтожить корабль',!s.alive,{alive:s.alive,why:s.why})}
 // R14
 {const S=battle([BB],[FR]),s=S[0];for(let i=0;i<30&&s.crN>0;i++)for(let z=0;z<4;z++)H.crewKill(s,z,1);run(5);ok('R14 корпус цел, экипаж погиб — остов',s.alive&&s.cst==='остов'&&s.derelict,{state:s.cst,alive:s.alive})}
 // R15: естественный бой: повреждённый корабль отходит, чинится и возвращается
 {const S=battle([BB,BB,BB],[FR,FR],120),s=S[0];s.kitCap=s.kits=s.kits0=60; /* с системой наборов полный ремонт выбитого корабля требует ~30 наборов: корабль с большим складом */killAll(s,m=>m.k!=='C'&&m.k!=='R'&&m.k!=='E');let seen={};for(let i=0;i<120;i++){run(30);seen[s.rst||'ok']=1;if(seen.retreat&&(s.rst==='return'||s.rst==='ok')&&s.aliveN>=s.total*.6)break}
  const foes=S.filter(q=>q.side===1&&q.alive).length;ok('R15 повреждённый отходит, чинится и возвращается (или враг уничтожен, пока чинился)',seen.retreat&&s.aliveN>=s.total*.6&&(s.rst==='return'||s.rst==='ok'||foes===0&&s.rst!=='home'),{states:Object.keys(seen),now:s.rst,mods:s.aliveN+'/'+s.total,foes,t:Math.round(T())})}
 return {out,crw:B.Battle.stat().crw}});
let pass=0;for(const r of R.out){console.log((r.ok?'OK  ':'FAIL')+' '+r.n+' '+JSON.stringify(r.info));if(r.ok)pass++}console.log('итог',pass+'/'+R.out.length);if(errs.length)console.log('ERR',errs.slice(0,3));await b.close();process.exit(pass===R.out.length?0:1)})();
