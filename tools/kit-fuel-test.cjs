// Ремонтные наборы (K1–K15) и топливная дисциплина (F1–F10): node tools/kit-fuel-test.cjs [шаг физики, по умолчанию из battle.json]
// F10 — сравнение двух прогонов с разным шагом: запусти дважды (0.25 и 0.125) — скрипт печатает строку F10 с моментом и запасом при уходе на базу.
const {chromium}=require('playwright');const fs=require('fs'),path=require('path');
(async()=>{const STEP=process.argv[2];const base=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','battle.json'),'utf8'));if(STEP)base.step={dt:+STEP};
const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.route('**/data/battle.json',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(base)}));
await p.addInitScript(()=>{let a=13;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}});
await p.goto('http://127.0.0.1:'+(process.env.PORT||5200)+'/');await p.waitForTimeout(2500);
const R=await p.evaluate(async()=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
 const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
 const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
 const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
 const BB=(o={})=>mk('Броненосец',{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000,...o},9500,5),FR=(o={})=>mk('Фрегат',{L:.15,arm:2,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:300,energy:5000,...o},1500,10);
 const T=()=>B.Battle.time(),run=s=>{const t1=T()+s;let g=0;while(T()<t1&&!B.Battle.isDone()&&g++<4e6)B.Battle.tickN(.001)};
 const battle=(a,b,place,keepPos)=>{B.Battle.begin({title:'t',fleets:[[],[]],late:[...a.map(f=>({t:0,side:0,spec:f(),edge:80,ang:0})),...b.map(f=>({t:0,side:1,spec:f(),edge:80,ang:Math.PI}))],demo:true,maxT:1e6,seed:5,names:['a','b'],onEnd(){}});
  D.state.demo=true;D.state.paused=false;B.Battle.tickN(.01);const S=B.Battle.ships().filter(s=>!s.bayOf),k=[0,0];if(!keepPos)for(const s of S){const i=k[s.side]++;s.sx=s.vx=s.sy=s.vy=0;s.x=s.side?(place||3000):0;s.y=i*20;s.hd=s.side?Math.PI:0;s.home={x:s.side?(place||3000)+200:-200,y:0}}return S};
 const H=B.Battle.dmgT,out=[],ok=(n,c,info)=>out.push({n,ok:!!c,info});const mods=s=>s.zones.flatMap(z=>z.mods),kill=(s,f)=>{for(const m of mods(s))if(m.alive&&f(m))H.mdead(s,m)},alive=(s,f)=>mods(s).filter(m=>m.alive&&f(m)).length;
 const G=m=>m.k==='G',Tk=m=>m.k==='T';
 // K1 пустой склад
 {const S=battle([BB,FR],[FR]),s=S[0];s.kits=0;kill(s,G);run(1200);ok('K1 пустой склад — модули не чинятся',alive(s,G)===0&&/нет ремонтных наборов/.test(s.dcWhy),{gatAlive:alive(s,G),why:s.dcWhy})}
 // K2 нет склада
 {const S=battle([()=>BB({kitCap:0,kits:0}),FR],[FR]),s=S[0];kill(s,G);run(1200);ok('K2 нет склада — модули не чинятся',s.kitCap===0&&alive(s,G)===0&&/нет ремонтного склада/.test(s.dcWhy),{cap:s.kitCap,why:s.dcWhy})}
 // K3 один набор
 {const S=battle([BB,FR],[FR]),s=S[0];s.kits=1;kill(s,G);run(3000);ok('K3 один набор — ровно на один простой модуль',alive(s,G)===1&&s.kits<1e-6,{gatAlive:alive(s,G),kitsLeft:+s.kits.toFixed(3),used:+s.kitUsed.toFixed(3)})}
 // K4 сложный дороже
 {const S=battle([BB,BB,FR],[FR]),a=S[0],c=S[1];a.kits=c.kits=20;const mt=mods(a).find(Tk),mg=mods(c).find(G);H.mdead(a,mt);H.mdead(c,mg);run(2400);ok('K4 сложный модуль расходует больше',mt.alive&&mg.alive&&a.kitUsed>c.kitUsed*2,{railUsed:+a.kitUsed.toFixed(2),gatUsed:+c.kitUsed.toFixed(2)})}
 // K5 без двойного расхода: потрачено = сумма стоимостей восстановленного
 {const S=battle([BB,FR],[FR]),s=S[0];s.kits=30;kill(s,m=>G(m)||Tk(m));run(3600);const n=alive(s,m=>G(m)||Tk(m));ok('K5 наборы не расходуются дважды',n===6&&Math.abs(s.kitUsed-(4*1+2*3)*1.3)<1e-6,{restored:n,used:+s.kitUsed.toFixed(4),expected:'10 ремонт + 3 обслуживание = 13'})}
 // K6 прерывание: сделанное сохраняется, бесплатного восстановления нет
 {const S=battle([BB,FR],[FR]),s=S[0];s.kits=10;const m=mods(s).find(Tk);H.mdead(s,m);let i=0;while(!(m.rp>0&&s.kitUsed>0)&&i++<200)run(5);run(120);const u1=s.kitUsed,p1=m.rp;const keep=s.cg.map(q=>q.n);for(const q of s.cg)if(!q.cmd&&!(q.m&&q.m.alive))q.n=0;H.crewSync(s);run(60);const u2=s.kitUsed,p2=m.rp;const stopped=!m.alive&&Math.abs(u2-u1)<1e-9&&p2===p1;s.cg.forEach((q,i)=>q.n=keep[i]);H.crewSync(s);run(2400);
  ok('K6 прерванный ремонт: без бесплатного восстановления и без потерь',stopped&&m.alive&&Math.abs(s.kitUsed-3*1.3)<1e-6,{usedBefore:+u1.toFixed(2),usedDuringFire:+u2.toFixed(2),progress:[Math.round(p1),Math.round(p2)],final:+s.kitUsed.toFixed(3),alive:m.alive})}
 // K7–K8 пустой склад: тушат и герметизируют
 {const S=battle([BB,FR],[FR]),s=S[0];s.kits=0;s.fire[1]=2;run(400);ok('K7 пустой склад — пожар тушат',s.fire[1]===0,{fire:s.fire})}
 {const S=battle([BB,FR],[FR]),s=S[0];s.kits=0;s.vac[3]=1;run(600);ok('K8 пустой склад — пробоины заделывают',s.vac[3]===0,{vac:s.vac})}
 // K9 нет людей для работ
 {const S=battle([BB,FR],[FR]),s=S[0];kill(s,G);for(const q of s.cg)if(!q.cmd&&!(q.m&&q.m.alive))q.n=0;H.crewSync(s);run(1200);ok('K9 без свободных людей ремонта нет',alive(s,G)===0&&/не хватает людей|людей/.test(s.dcWhy),{crew:s.crN,why:s.dcWhy})}
 // K10 разрушенный отсек
 {const S=battle([BB,FR],[FR]),s=S[0];H.hull(s,1,100);run(2400);ok('K10 в разрушенном отсеке не чинят',s.zones[1].mods.every(m=>!m.alive&&!(m.rp>0)),{brk:s.zones[1].brk,used:+s.kitUsed.toFixed(2)})}
 // K11 общий запас на несколько групп
 {const S=battle([BB,FR],[FR]),s=S[0];s.kits=2.5;kill(s,m=>G(m)||Tk(m));run(3600);ok('K11 несколько групп не тратят больше, чем есть',s.kits>=0&&s.kitUsed<=2.5+1e-9,{left:+s.kits.toFixed(3),used:+s.kitUsed.toFixed(3),restored:alive(s,m=>G(m)||Tk(m))})}
 // K12 больше запас — больше восстановлено
 {const S=battle([BB,BB,FR],[FR]),a=S[0],c=S[1];a.kits=2;c.kits=20;kill(a,m=>m.k!=='C');kill(c,m=>m.k!=='C');run(3600);ok('K12 большой запас восстанавливает больше',c.aliveN>a.aliveN,{small:a.aliveN+'/'+a.total,big:c.aliveN+'/'+c.total})}
 // K13 без экипажа
 {const S=battle([BB,FR],[FR]),s=S[0];kill(s,G);for(let i=0;i<30&&s.crN>0;i++)for(let z=0;z<4;z++)H.crewKill(s,z,1);const k0=s.kits;run(1200);ok('K13 без экипажа — ни ремонта, ни расхода',alive(s,G)===0&&s.kits===k0,{kits:[k0,s.kits]})}
 // K14 отход-ремонт-возвращение с расходом наборов
 {const S=battle([BB,BB,BB],[FR,FR],120),s=S[0];const k0=s.kits;kill(s,m=>m.k!=='C'&&m.k!=='R'&&m.k!=='E');const seen={};for(let i=0;i<120;i++){run(30);seen[s.rst||'ok']=1;if(seen.retreat&&(s.rst==='return'||s.rst==='ok')&&s.capW>.5)break}
  ok('K14 отход, ремонт (с расходом наборов), возвращение',seen.retreat&&(s.rst==='return'||s.rst==='ok')&&s.kitUsed>0,{states:Object.keys(seen),now:s.rst,used:+s.kitUsed.toFixed(1)+'/'+k0})}
 // K15 без наборов — не застревает
 {const S=battle([BB,BB,BB],[FR,FR],120),s=S[0];s.kits=0;kill(s,m=>m.k!=='C'&&m.k!=='R'&&m.k!=='E');const seen={};for(let i=0;i<60;i++){run(30);seen[s.rst||'ok']=1;if(s.rst==='home'||s.rst==='return'||!s.alive)break}
  ok('K15 без наборов не ждёт ремонта бесконечно',s.rst==='home'||s.rst==='return'||!s.alive,{states:Object.keys(seen),now:s.rst,t:Math.round(T())})}
 // ===== топливо
 const dvOk=s=>!s.dvB||!s.dvB.rp||s.dvB.dvr>=s.dvB.rp.need-1e-6;
 // F1 полный бак: резерв сохраняется
 {const S=battle([FR,FR],[FR,FR],120);let bad=0,smp=0;for(let i=0;i<40;i++){run(15);for(const s of S.filter(s=>s.alive&&s.side===0&&s.rst!=='home')){smp++;if(!dvOk(s))bad++}}ok('F1 полный бак — резерв возвращения сохраняется',bad===0,{samples:smp,violations:bad})}
 // F2 критический остаток — своевременный уход
 let f2={};{const S=battle([FR,FR],[FR,FR],120),s=S[0];const m0=s.fuelCap;run(2);B.Battle.setDv(s,s.dvB.rp.need+.15);let tr=null;for(let i=0;i<120&&s.alive;i++){run(10);if(s.rst==='home'&&tr==null)tr={t:Math.round(T()),dvr:+s.dvB.dvr.toFixed(3),need:+s.dvB.rp.need.toFixed(3),fuel:+(s.fuel/s.fuelCap*100).toFixed(2)}}f2=tr||{};
  ok('F2 у критического остатка уходит заранее (резерв цел)',tr&&tr.dvr>=tr.need-.06,tr||{none:1})}
 // F3 прекращает преследование
 {const S=battle([FR],[FR],60),s=S[0],e=S[1];e.sx=.3;run(2);B.Battle.setDv(s,s.dvB.rp.need+.03);run(120);const toE=((e.x-s.x)*s.sx+(e.y-s.y)*s.sy)/Math.max(1e-6,Math.hypot(e.x-s.x,e.y-s.y)),toH=((s.home.x-s.x)*s.sx+(s.home.y-s.y)*s.sy)/Math.max(1e-6,Math.hypot(s.home.x-s.x,s.home.y-s.y));
  ok('F3 без топлива не преследует',s.rst==='home'&&toH>=toE,{state:s.rst,vToEnemy:+toE.toFixed(3),vToHome:+toH.toFixed(3)})}
 // F4 торможение в резерве
 {const S=battle([FR],[FR],3000),s=S[0];run(2);B.Battle.setDv(s,s.dvB.rp.need+.02);let mn=1e9;for(let i=0;i<60;i++){run(20);if(s.rst==='home'&&s.dvB){mn=Math.min(mn,s.dvB.dvr-s.dvB.rp.brake)}}ok('F4 топливо на торможение у базы сохраняется',mn>=0,{minMargin:+mn.toFixed(3)})}
 // F5 высокая скорость
 {const S=battle([FR],[FR],3000),s=S[0];run(2);const n0=s.dvB.rp.need;s.sx=s.vx=-3;run(2);const n1=s.dvB.rp.need;ok('F5 высокая скорость увеличивает Δv возвращения',n1>n0+2,{needAtRest:+n0.toFixed(2),needAt3kms:+n1.toFixed(2)})}
 // F6 двигатели выбиты
 {const S=battle([FR],[FR],3000),s=S[0];for(const m of mods(s))if(m.k==='E'&&m.alive)H.mdead(s,m);run(2);B.Battle.setDv(s,.3);const f0=s.fuel;run(200);ok('F6 без двигателей — расчёт возврата невозможен, топливо не жжётся',s.dvB&&s.dvB.can===false&&s.fuel>=f0*.9,{can:s.dvB&&s.dvB.can,fuel:[+f0.toFixed(1),+s.fuel.toFixed(1)]})}
 // F7 вернуться невозможно — не тратит бездумно
 {const S=battle([FR],[FR],3000),s=S[0];s.sx=s.vx=-6;run(1);B.Battle.setDv(s,.3);const f0=s.fuel;run(300);ok('F7 возврат невозможен — топливо не сжигается',s.rst==='home'&&s.fuel>=f0*.9,{state:s.rst,fuel:[+f0.toFixed(1),+s.fuel.toFixed(1)],need:+s.dvB.rp.need.toFixed(2),dvr:+s.dvB.dvr.toFixed(2)})}
 // F8 флагман не держит ушедшего
 {const S=battle([BB,FR,FR],[FR,FR],120),s=S[1];run(2);B.Battle.setDv(s,s.dvB.rp.need+.02);run(90);ok('F8 корабль на резерве не получает боевой задачи',s.rst==='home'&&(!s.task||!s.task.tg||s.F&&s.F.flag!==s),{state:s.rst,task:s.task&&s.task.tg?'есть':'нет'})}
 // F9 не возвращается без топлива
 {const S=battle([FR,FR],[FR,FR],120),s=S[0];run(2);B.Battle.setDv(s,s.dvB.rp.need+.05);run(1500);ok('F9 ушедший на базу не возвращается в бой без дозаправки',s.rst==='home'||!s.alive||s.esc,{state:s.rst,esc:!!s.esc,alive:s.alive})}
 return {out,f2}});
let pass=0;for(const r of R.out){console.log((r.ok?'OK  ':'FAIL')+' '+r.n+' '+JSON.stringify(r.info));if(r.ok)pass++}console.log('F10 (шаг '+(STEP||'по умолчанию')+'): уход на базу',JSON.stringify(R.f2));console.log('итог',pass+'/'+R.out.length);if(errs.length)console.log('ERR',errs.slice(0,3));await b.close()})();
