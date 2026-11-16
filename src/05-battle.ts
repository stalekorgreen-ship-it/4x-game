// @ts-nocheck
import { gd } from './00-gd.ts';
import { RES, compOf, dist, fmtN, log, mkKey, rec, specTons, fitSpec, CR_DEF, randCraft, craftById, craftStats, state, fuelPerAU, BAT_FUEL_T, shipSpeedTrue, AU_M, RAIL_CAL } from './01-data.ts';
import { tm, ta } from './15-techs.ts';
import { initKernel, dpsAt, dpsAt3, warnT, warnR } from './05w-ai-kernel.ts';
import { effSkill, officerById, pilFuel } from './02-crew.ts';
import { W, H, bar, cx, focusBattle, ui, setTilt } from './08-map-ui.ts';
import { Sfx } from './18-audio.ts';

/* ===== БОЙ (движок боя из демо) ===== */
export function makeBattle() {
let viewed=true;const SFX={shot:(...a)=>viewed&&Sfx.shot(...a),boom:(...a)=>viewed&&Sfx.boom(...a),radio:(...a)=>viewed&&Sfx.radio(...a),engine:(...a)=>Sfx.engine(...a),setOn:(...a)=>Sfx.setOn(...a)};
const $b = id => document.getElementById(id);

// Параметры боя — правятся в data/battle.json (SIGMA — разброс выстрела, т.е. точность; VP — скорость снаряда; LIFE — время жизни снаряда; REL — перезарядка, с;
// RC0 — рельсотрон по умолчанию: dmg урон, rng дальность, sig множитель разброса, cal калибр; FC0 — зенитка; GC0 — гатлинг; LC0 — боевой лазер; MC0 — ракета;
// FI/BO — истребитель/бомбардировщик; TORP — торпеда; FLAK — зенитный разрыв; RCT — время перезарядки по калибру; EW — помехи РЭБ; RADAR — дальность радара; MARN — морпехи)
const dryM=s=>Math.max(s.T.tons*.2,s.T.tons-(s.fuelCap||0)); // сухая масса: корабль без топлива
const MOVE=gd('battle','move',{tau:2,thy:1,plan:15,db:.1,lat:.15,coast:.2}); // plan — с между пересмотрами скорости; db — мёртвая зона Δv, км/с; lat — боковая ошибка, ниже которой маневровые не трогаем (км/с); coast — допуск «лечу и так почти куда надо»
const PLAN_T=MOVE.plan; // ИИ пересматривает желаемую скорость раз в 8 с (импульсами), а не каждый шаг — меньше дёрганья и расхода топлива
const LEAD=gd('battle','lead',{acc:.5,bracket:.8}); // упреждение: доля ускорения цели; вилка — доля возможного уклонения (0 — выкл)
const SALVO=gd('battle','salvo',{on:1,prep:6,fill:.9}); // залп флота: prep — с на подготовку, fill — доля радиуса уклонения, которую засеваем
const AMMO_H=gd('battle','ammo',{hours:2}).hours; // запас боеприпасов в часах непрерывной стрельбы
const PASS=gd('battle','pass',{max:2,mm:300}); // после пробития снаряд выбивает 1 модуль + ещё 1 на каждые 300 мм остатка, не больше 2
const ARMZ=gd('battle','armor',{nose:35,side:5,rear:2}); // слоёв по 2 см стали: нос 70 см, борта 10 см, корма 4 см
const FUEL=gd("battle","fuel",{ve:9,rcsVe:3,cap:.6,keep:.12,Tb:3600}); // топливо в бою: vₑ главных двигателей и маневровых (км/с), бак по умолчанию — доля массы
const BT=gd('battle','battle',{DOPT:{hc:20,dd:20,fr:35,cv:100},JINK:0.0015,VP:6,LIFE:10,SIGMA:0.026,LAUNCH:450,SUB:0.25,REL:60,FI:{vmax:2,a:0.25,fuel:1500,ammo:60,hp:8,gun:4},BO:{vmax:0.8,a:0.05,fuel:2200,hp:4},TORP:{sp:2.5,pd:0.02,pdr:35,launch:120,mod:2},FLAK:{range:60,blast:1.2},RC0:{dmg:1,vp:6,rng:60,shells:1,rel:1,fail:0,sig:1,cal:10},FC0:{blast:1.2,rng:60,rel:1,fail:0},GC0:{tw:0,rpm:6000,heat:.4,cool:.2,pen:.02,rng:15,ammoH:5,mass:25},LC0:{dmg:4,rng:250,chg:.08},MC0:{hp:2,spd:8,dmg:4,blast:6,ammo:4,rng:220,rel:.83},BURST:{5:1,10:1,15:1,20:1,25:1,30:1},RCT:{5:6,10:16,15:28,20:45,25:60,30:80},EW:{fr:.12,cv:.05,dd:.02,hc:.02},RADAR:{cv:420,hc:320,dd:260,fr:360},MARN:{cv:20,hc:10,dd:8,fr:4}});
const PMIN=BT.PMIN!=null?BT.PMIN:.08,DISP=BT.DISP!=null?BT.DISP:.0003,GDISP=BT.GDISP!=null?BT.GDISP:.002,DOPT=BT.DOPT,JINK=BT.JINK,VP=BT.VP,LIFE=BT.LIFE,RANGE=VP*LIFE,SIGMA=BT.SIGMA,LAUNCH=BT.LAUNCH,SUB=BT.SUB,REL=BT.REL;
const FI=BT.FI,BO=BT.BO,TORP=BT.TORP,FLAK=BT.FLAK,RC0=BT.RC0,FC0=BT.FC0,GC0=BT.GC0,LC0=BT.LC0,MC0=BT.MC0,BURST=BT.BURST,RCT=BT.RCT;
const ZN=['нос','правый борт','корма','левый борт'];
const BSPEEDS=[1,5,20,100,300];
let MODID=0; // счётчик id модулей: только растёт, не сбрасывается между боями
let lasBeams=[],shuttles=[],hitLog=[],impacts=[],impN=0,frags=[],pyro=[],pods=[],lands=[],mis=[],beams=[],bursts=[],curCT=1,curST=0,ships,proj,fx,flights,air,torps,shots,fly,t,paused=false,speed=100,acc=0,stat,lastEng=-99,autoSlow=true,autoCam=true,sel=null,projMode=0,done=false,isOpen=false,cfgNow=null,bound=false,last=0;
let uidN=0,lastDmgT=0,lastNa=0,lastNaT=0,env=[],ORD={st:null,focus:null},nextVis=0,nextCrew=0,lastCrewT=0,endSaid=false;
const say=(side,key,s)=>{if(active&&!done)SFX.radio(side,key,s)};
const EW=BT.EW,RADAR=BT.RADAR,MARN=BT.MARN;
let pend=[],lastFriend=0,vw={ox:0,oy:0,kk:1},active=false;
// СВОЙ ГЕНЕРАТОР СЛУЧАЙНЫХ ЧИСЕЛ БОЯ: засевается один раз в начале боя (cfg.seed или одно число из общего генератора). Графика, звук и интерфейс тратят общий Math.random
// сколько угодно раз в зависимости от FPS и реального времени — на бой это не влияет. Одинаковый seed — одинаковый бой.
let RS=1;function rnd(){RS|=0;RS=RS+0x6D2B79F5|0;let q=Math.imul(RS^RS>>>15,1|RS);q=q+Math.imul(q^q>>>7,61|q)^q;return((q^q>>>14)>>>0)/4294967296}
const R=(a,b)=>a+rnd()*(b-a);
const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=rnd();return (u-2)*1.73};
const adiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;return d};
// ===== ФИЗИКА БОЯ: км, с, т =====
// ускорение корабля, м/с²: тяга (1 ед. мощности двигателя = 0,12 МН) / масса; без данных — по старой скорости и длине; не больше 40
function accOf(sp,T){const tons=Math.max(1,T.tons||1);let a=sp.pow>0?sp.pow*120/tons:6*(T.spd||1)*Math.sqrt(.3/Math.max(.05,T.L));return Math.max(1,Math.min(40,a))}
// снаряд рельсотрона по калибру (см): масса кг = 3·(cal/5)³, сечение см² = π·(cal/2)²; k — МДж/см² на (км/с)²
const RAIL_K=cal=>{const c=cal||10,m=3*Math.pow(c/5,3),S=Math.PI*(c/2)*(c/2);return .5*m/S},RAIL_M=cal=>3*Math.pow((cal||10)/5,3);
const GATP=gd('battle','gatling',{v:2,m:.4,area:7}); // гатлинг 30 мм: снаряд 0,4 кг, сечение 7 см², 2 км/с (лёгкогазовый/электротермический заряд)
const GAT_K=.5*GATP.m/GATP.area,GAT_M=GATP.m,PEN=gd('battle','pen',{Rt:5.5,rhoT:7.8,rhoP:7.8}),ARM_E=PEN.Rt*2/1000;
// реальная физика пробития: (1) энергия на см² / сопротивление стали Rt (≈5,5 ГПа = 5,5 кДж/см³) — слой 2 см держит 0,011 МДж/см²;
// (2) на гиперзвуке глубже длины снаряда × √(ρснаряда/ρброни) не пробить (гидродинамический предел), сколько энергии ни дай
const penCap=(m,A)=>{const len=m*1000/(PEN.rhoP*A);return len*Math.sqrt(PEN.rhoP/PEN.rhoT)/2*ARM_E}; // МДж/см², эквивалентные предельной глубине // пуля 14 г, 1,65 см²; слой стали 2 см держит 0,3 МДж/см² (15 кДж/см³, как в редакторе)
// оценка шанса попасть: разброс ствола против уклонения цели маневровыми за время полёта (цель видит снаряд за 12 с) и её поперечника
// дальность, на которой шанс попасть ещё ≥ p (бисекция по той же формуле, что hitP)
function rangeP(s,o,V,p){let lo=.5,hi=300;for(let i=0;i<14;i++){const d=(lo+hi)/2,tf=d/Math.max(.1,V),e=DISP*d*2,w=warnT(o,V,tf,closing(s,o)),dg=o.T&&o.rcsN>0?.5*(o.acc||5)*.12/1000*w*w:0,h=o.T?o.T.L*.11:.02;if(h/(e+dg+1e-6)>=p)lo=d;else hi=d}return lo}
// качество сопровождения цели кораблём: свой захват радаром — 1, захват союзника (данные по сети) — ally, видна только ИК/ЭМ — seen, не видна — none; помехи цели снижают
// обнаружение снарядов: корабль уклоняется только от снаряда, который увидели его живые сенсоры и сопровождали track с.
// ИК видит по теплу снаряда: дальность irK·√(площадь см² · (T/1000К)⁴); радар (если включён) — radK·(площадь м²)^¼. Остывание излучением: T=(T0⁻³+k·возраст)^-⅓
const SNS=gd('battle','sens',{on:1,irK:1,radK:60,track:1.5,railT:1800,gunT:700,coolRail:2e-12,coolGun:2e-10});
function seesP(s,p,d){const A=p.cal?Math.PI*p.cal*p.cal/4:GATP.area,T0=p.kk?SNS.railT:SNS.gunT,age=p.dist/Math.max(.01,Math.hypot(p.vx,p.vy)),T=Math.pow(Math.pow(T0,-3)+(p.kk?SNS.coolRail:SNS.coolGun)*age,-1/3);
  let R=0;for(const q of (s.scl||s.sc)){if(q.k==='ir')R=Math.max(R,SNS.irK*Math.sqrt(A*Math.pow(T/1000,4))*(q.res||1));else if(q.k==='rad'&&s.rdOn)R=Math.max(R,SNS.radK*Math.pow(A/1e4,.25)*(s.rad0?s.radN/s.rad0:1))}return d<R}
const PB=gd('battle','prebrake',{on:1,v:.4,near:5,res:1.5,pass:.25,passV:1}); // торможение до встречи: до v км/с, если Δv ≥ res×нужного; на проходе (сближение > passV км/с) стреляем при шансе ≥ PMIN×pass
const GCLOSE=gd('battle','gclose',{on:1,wait:20,r:8}); // если все рельсы заряжаются дольше wait с (или их нет), а гатлинги есть — держим дистанцию r км
const EXTM=gd('battle','extmod',{size:{T:8,G:4,A:4,D:6,R:2,M:5,L:5}}); // внешние модули — физические коробки на корпусе, размер в метрах; пуля попадает в модуль, только если точка удара внутри его контура
// точка удара в системе корабля (м) против центра модуля на той же грани: модуль задет, если удар внутри его квадрата
function extHit(o,zi,x,y){const L=o.T.L*1000,c=Math.cos(o.hd||0),sn=Math.sin(o.hd||0),dx=(x-o.x)*1000,dy=(y-o.y)*1000,au=dx*c+dy*sn,av=-dx*sn+dy*c,wr=(WR[o.cls]||.3)*1.4;
  for(const z of o.zones)for(const q of z.mods){if(!q.alive||z!==o.zones[zi])continue;const h=(EXTM.size[q.k]||0)/2;if(!h)continue;if(Math.abs(au-(q.u||0)*L)<h&&Math.abs(av-(q.v||0)*L*wr)<h)return q}return null}
const RAM=gd('battle','ram',{on:1,mass:1.5,nose:20,dist:4,v:.2,tip:.03,cd:20,sy:.5}); // sy — сопротивление смятию стали при тупом ударе, кДж/см³ (предел текучести ~0,5 ГПа; Rt 5,5 — для пробития на гиперзвуке) // таран: масса ≥ mass× цели, нос ≥ nose слоёв, начинаем ближе dist км, сближение ≤ v км/с; пятно контакта — квадрат tip×длины носа; cd с между ударами
// удар корпусов, неупругий: энергия ½·μ·v² (μ = m1m2/(m1+m2)) уходит в смятие. Сила одна на обоих (3-й закон) — мнётся тот, у кого сейчас слабее сопротивление:
// броня — сталь при смятии RAM.sy (кДж/см³), за бронёй — сталь × заполненность корпуса (масса / (7,8 т/м³ × объём)). После удара — общая скорость (сохранение импульса)
function ramHit(s,o){const rvx=s.sx-o.sx,rvy=s.sy-o.sy,dx=o.x-s.x,dy=o.y-s.y,d=Math.hypot(dx,dy)||1e-6,vr=Math.max(0,(rvx*dx+rvy*dy)/d);if(vr<=0)return;
  const est=ramEst(s,o,vr,zoneTo(s,o.x,o.y),zoneTo(o,s.x,s.y)),al0=[s.aliveN,o.aliveN];
  const m1=s.T.tons,m2=o.T.tons,mu=m1*m2/(m1+m2);let E=.5*mu*vr*vr*1e9; // Дж
  const zs=zoneTo(s,o.x,o.y),zo=zoneTo(o,s.x,s.y),A=Math.pow(Math.max(2,s.T.L*1000*RAM.tip),2)*1e4; // см²
  const fill=q=>{const L=q.T.L*1000,vol=L*Math.pow(L*.22,2)*.5;return Math.min(1,q.T.tons/(7.8*vol))};
  const P=[{q:s,z:s.zones[zs],arm:s.zones[zs].arm*2,dep:0,f:fill(s)},{q:o,z:o.zones[zo],arm:o.zones[zo].arm*2,dep:0,f:fill(o)}],Rt=RAM.sy*1000; // Дж/см³
  for(let i=0;i<20000&&E>0;i++){const r=P.map(p=>Rt*(p.dep<p.arm?1:p.f));const ks=Math.abs(r[0]-r[1])<1e-9?[0,1]:[r[0]<r[1]?0:1];for(const k of ks){const step=(P[k].dep<P[k].arm?1:20)/ks.length,e=r[k]*A*step;P[k].dep+=Math.min(step,step*E/e);E-=e}} // равное сопротивление — мнутся оба поровну // мнём по 1 см брони / 20 см нутра
  for(const p of P){const sg=p.q===s?-1:1,C0=DCTX;DCTX={ram:1,nx:dx/d*sg,ny:dy/d*sg,vr};const lay=Math.round(Math.min(p.dep,p.arm)/2),z=p.z,nc=z.nc,w=Math.max(1,Math.round(nc*.15)),c0=Math.floor(nc/2-w/2);for(let c=c0;c<c0+w;c++){const tk=Math.min(z.cols[c],lay);z.cols[c]-=tk;z.armN-=tk}
    const inner=Math.max(0,p.dep-p.arm)/100,half=p.q.T.L*1000*.11; // м смятия за бронёй против полуширины корпуса
    if(inner>0){const ms=z.mods.filter(m=>m.alive&&m.k!=='C'),n=Math.min(ms.length,Math.round(ms.length*inner/half));for(let i=0;i<n;i++)mdead(p.q,ms[i]);if(inner>half*.8&&p.q.core.alive){p.q.core.alive=false;p.q.aliveN--}
      p.q.crew=Math.max(0,p.q.crew-.3*Math.min(1,inner/half));if(!p.q.core.alive||p.q.aliveN<p.q.total*.22)kill(p.q,'таран')}DCTX=C0}
  if(structs.size){const cx=(s.x+o.x)/2,cy=(s.y+o.y)/2,Er=.25*mu*vr*vr*1e9,J=mu*1000*vr*1000;strHit(s,cx,cy,Er,'ram',-dx/d*J,-dy/d*J);strHit(o,cx,cy,Er,'ram',dx/d*J,dy/d*J)}
  const vx=(m1*s.sx+m2*o.sx)/(m1+m2),vy=(m1*s.sy+m2*o.sy)/(m1+m2);s.sx=o.sx=vx;s.sy=o.sy=vy; // сцепились: общая скорость
  s.ramT=o.ramT=t+RAM.cd;stat.ram=(stat.ram||[]);stat.ram.push({by:s.T.n,to:o.T.n,v:+(vr*1000).toFixed(0),GJ:+(.5*mu*vr*vr).toFixed(2),dep:[+(P[0].dep/100).toFixed(2),+(P[1].dep/100).toFixed(2)],kill:[!s.alive,!o.alive],lost:[al0[0]-s.aliveN,al0[1]-o.aliveN],est:[est[0].mods,est[1].mods,est[0].kill,est[1].kill]});
  fx.push({x:(s.x+o.x)/2,y:(s.y+o.y)/2,z:o.z,t0:t,d:6,r:Math.max(.5,s.T.L*.3)});say(o.side,'hit',o)}
// исход тарана без изменения мира — тот же расчёт смятия, что в ramHit: энергия сближения уходит в сторону с меньшим сопротивлением (броня Rt, за бронёй — заполнение корпуса), по глубине смятия за бронёй гибнут модули зоны, ядро, корабль
// a — таранящий, b — цель; vr — скорость сближения, км/с; za, zb — зоны контакта. Возвращает потерянные модули и гибель каждой стороны
function ramEst(a,b,vr,za,zb){const m1=a.T.tons,m2=b.T.tons,mu=m1*m2/(m1+m2);let E=.5*mu*vr*vr*1e9;const A=Math.pow(Math.max(2,a.T.L*1000*RAM.tip),2)*1e4,Rt=RAM.sy*1000;
  const fill=q=>{const L=q.T.L*1000,vol=L*Math.pow(L*.22,2)*.5;return Math.min(1,q.T.tons/(7.8*vol))};
  const P=[{q:a,z:a.zones[za],arm:a.zones[za].arm*2,dep:0,f:fill(a)},{q:b,z:b.zones[zb],arm:b.zones[zb].arm*2,dep:0,f:fill(b)}];
  for(let i=0;i<20000&&E>0;i++){const r=P.map(p=>Rt*(p.dep<p.arm?1:p.f));const ks=Math.abs(r[0]-r[1])<1e-9?[0,1]:[r[0]<r[1]?0:1];for(const k of ks){const step=(P[k].dep<P[k].arm?1:20)/ks.length,e=r[k]*A*step;P[k].dep+=Math.min(step,step*E/e);E-=e}}
  return P.map(p=>{const inner=Math.max(0,p.dep-p.arm)/100,half=p.q.T.L*1000*.11,ms=p.z.mods.filter(m=>m.alive&&m.k!=='C').length,n=inner>0?Math.min(ms,Math.round(ms*inner/half)):0,core=inner>half*.8&&p.q.core.alive,kill=core||!p.q.core.alive||p.q.aliveN-n-(core?1:0)<p.q.total*.22;
    return {mods:n+(core?1:0),kill,alive:p.q.aliveN,dep:p.dep}})}
// цель тарана, какой её может знать противник: класс корпуса (размер, масса, число модулей по проекту) — виден; броня — типовая по зонам (ARMZ) с разбросом ×0,6/×1/×1,6; живая доля модулей — belief.md
function ramGuess(o,b){const n=Math.max(1,o.total),al=Math.max(1,Math.round(n*b.md)),per=Math.max(1,Math.round(al/4)),A=[ARMZ.nose,ARMZ.side,ARMZ.rear,ARMZ.side];
  return [.6,1,1.6].map(f=>({T:o.T,total:n,aliveN:al,core:{alive:true},zones:A.map(a=>({arm:Math.max(1,Math.round(a*f)),mods:Array.from({length:per},()=>({alive:true,k:'X'}))}))}))}
const zoneAt=(hd,x0,y0,x,y)=>{const a=adiff(hd,Math.atan2(y-y0,x-x0)),ab=Math.abs(a);return ab<0.785?0:ab>2.356?2:(a>0?1:3)};
function zoneTo(o,x,y){const a=adiff(o.hd,Math.atan2(y-o.y,x-o.x)),ab=Math.abs(a);return ab<0.785?0:ab>2.356?2:(a>0?1:3)}
const TESTLOG=typeof window!=='undefined'&&window.__testlog;
const TAC=gd('battle','tactic',{on:1,rich:1.5,re:10,v:.6,adv:1.3,str:.9}); // str — навязываем бой, только если наша сила ≥ str × вражеской: быстрый, но слабый в лобовой не лезет // adv — во сколько раз свободный Δv флота должен превышать вражеский, чтобы самим навязывать бой // rich — свободный Δv (км/с), с которого корабль маневрирует ради позиции; re — с между выбором общей цели флота; v — км/с выхода на позицию
const PLN=gd('battle','planner',{cap:0,f3:1,cache:1,on:1,dt:12,hor:60,step:10,v:.4,wd:1,wr:1,wf:1,tail:300,hyst:1.15,gat:.02,miss:.5,pred:0,pu:2,ai2:1,div:500,wrole:3,gdt:1,rtr:1,icp:1,rfree:10,lam0:200,wfoc:1.5,wp:3,wram:20,wform:.02,rpl:2}); // ai2 — единый тактический планировщик (движение+ориентация+уклонение+таран+строй по траектории призрака); wfoc — вес главной цели среди врагов; wp — вес ожидаемого попадания замеченного снаряда; wram — ценность удачного тарана; wform — штраф за км от места в строю; rpl — с между внеочередными пересмотрами // pred — оценивать кандидатов по траектории призрака (predictCmds) вместо прямой; pu — с между пересчётами курса политики (физика — с тем же dt, что в бою) // планировщик: раз в dt с перебирает манёвры, прогноз на hor с; wd/wr/wf — веса урона врагу, риска себе и топлива; hyst — новый план должен быть лучше старого в столько раз
// оценка противника стороной side: только то, что можно наблюдать. Топливо: априори полбака минус замеченные разгоны; оружие: стволы, которые стреляли (или все, пока не видели); целость: доля живых модулей при захвате радаром, иначе последняя известная
function belief(side,o){const b=(o.bel||(o.bel=[null,null]))[side]||(o.bel[side]={fu:FUEL.ve*Math.log(1+FUEL.cap*.5),md:1,wp:o.tur.length,dv0:o.dvSum||0,seen:-1});
  if(t-o.seen[side]<TRK.ttl){const ds=(o.dvSum||0)-b.dv0;b.dv0=o.dvSum||0;b.fu=Math.max(0,b.fu-ds*1);if(t-o.lock[side]<TRK.ttl)b.md=o.aliveN/o.total;const fired=o.tur.filter(m=>m.alive&&t-(m.firedT||-1e9)<60).length;b.wp=b.seen<0?o.tur.filter(m=>m.alive).length:Math.max(fired,b.wp*Math.exp(-Math.max(0,t-b.seen)/60)); /* молчащие орудия считаем выбывшими постепенно, по времени (прежнее округление не давало опуститься ниже 2) */b.seen=t}else b.dv0=o.dvSum||0;return b}
// урон в секунду, который орудия ws наносят цели o с дистанции d (км): шанс попасть × темп × броня стороны (корма ×3, борт ×1,5, нос ×1)
// dpsAt по трём вариантам манёвренности цели сразу: общая часть (скорость снаряда, время полёта, предупреждение, разброс) считается раз на оружие; результат тот же, что Σ dpsAt(x)/3
// манёвры-кандидаты относительно цели g: инерция, сближение, отход, обход слева/справа, заход в корму, уравнять скорость; прогноз по прямой на hor с
// траектория кандидата: призрак получает команду «скорость cvx,cvy (как в steer: /eng), нос на прогнозную точку цели»; курс пересчитывается раз в PLN.pu с, физика — шагами dt настоящего боя
function predTraj(s,g,cvx,cvy,eng,dt){const n=Math.ceil(PLN.hor/dt-1e-9),pu=PLN.pu||dt,e=Math.max(eng,.05),bst=s.bst||1,gx0=g.x,gy0=g.y,gsx=g.sx,gsy=g.sy;let wN=-1,want=0,tt=0;
  const f=(G,k)=>{if(k>=n)return null;if(tt>=wN-1e-9){wN=tt+pu;want=Math.atan2(gy0+gsy*tt-G.y,gx0+gsx*tt-G.x)}tt+=dt;return [cvx/e,cvy/e,want,bst,eng,0,dt]};f.n=n;return predictCmds(s,f)}
// положение призрака в момент tt: P[k] — состояние после k+1 шагов dt; между шагами — линейная интерполяция (только для выборки, не для физики)
function trajAt(s,P,tt,dt){const u=tt/dt,k=Math.floor(u+1e-9),f=u-k,A=k<=0?s:P[Math.min(P.length-1,k-1)],B=P[Math.min(P.length-1,k)];if(f<1e-9||!B)return {x:A.x,y:A.y,hd:A.hd};return {x:A.x+(B.x-A.x)*f,y:A.y+(B.y-A.y)*f,hd:A.hd}}
function plan(s,g,eng,dt){if(t<(s.plT||0)&&s.plan)return s.plan;s.plT=t+PLN.dt;
  const dx=g.x-s.x,dy=g.y-s.y,d0=Math.hypot(dx,dy)||1e-6,ux=dx/d0,uy=dy/d0,px=-uy,py=ux,V=PLN.v,spend=s.dvB?s.dvB.spend:0,eb=belief(s.side,g),mb=s.tur;
  const C=[['инерция',s.sx,s.sy],['сближение',g.sx+ux*V,g.sy+uy*V],['отход',g.sx-ux*V,g.sy-uy*V],['обход влево',g.sx+px*V+ux*V*.3,g.sy+py*V+uy*V*.3],['обход вправо',g.sx-px*V+ux*V*.3,g.sy-py*V+uy*V*.3],['уравнять',g.sx,g.sy]];
  {const rx=g.x-Math.cos(g.hd||0)*Math.max(5,d0*.5)-s.x,ry=g.y-Math.sin(g.hd||0)*Math.max(5,d0*.5)-s.y,rl=Math.hypot(rx,ry)||1;C.push(['в корму',g.sx+rx/rl*V,g.sy+ry/rl*V])}
  const wf=PLN.wf*(1+2/(1+Math.max(0,spend)));let best=null;
  const PR=PLN.pred&&dt>0,scs={};let m0d=0,sp0=0,tk=null;if(PR){m0d=dryM(s);sp0=spend;tk=s.dvB&&s.dvB.tk;s.planBan=[];s.planRes={}}
  // резерв на возвращение по траектории призрака: на каждом шаге — тот же расчёт, что в budget(), но на состоянии призрака (топливо, скорость, положение; танкер — по прямой)
  const resv=P=>{let mn=1e9;for(let i=0;i<P.length;i++){const q=P[i],tt=(i+1)*dt,dvr=FUEL.ve*Math.log((m0d+fuelM(s,q.fuel))/m0d);let need;
    if(tk){const vr=Math.hypot(q.sx-(tk.sx||0),q.sy-(tk.sy||0)),d=Math.hypot(tk.x+(tk.sx||0)*tt-q.x,tk.y+(tk.sy||0)*tt-q.y);need=vr+2*Math.min(dvr*.4,Math.sqrt(2*s.acc/1000*d)*.6)}else need=retNeed(s,q);
    const sp=dvr-need;if(sp<mn)mn=sp;resv.end=sp}return mn};
  for(const [k,cvx,cvy] of C){let cost=Math.hypot(cvx-s.sx,cvy-s.sy);if(!PR&&cost>Math.max(0,spend)&&k!=='инерция')continue;let sc=0;const P=PR?predTraj(s,g,cvx,cvy,eng,dt):null;
    if(PR){cost=FUEL.ve*Math.log((m0d+s.fuel)/(m0d+P[P.length-1].fuel)); // цена — фактический расход призрака (главный, маневровые, разворот, гашение закрутки), в Δv по Циолковскому с убылью массы; |Δv| команды больше не берём
      const mn=resv(P);(s.planRes||(s.planRes={}))[k]=[mn,resv.end];if(mn<Math.min(0,sp0)-1e-9){s.planBan.push([k,mn,cost]);if(k!=='инерция')continue}} // резерв нарушен хоть на одном шаге — кандидат запрещён (инерция — запасной вариант, только отмечаем)
    for(let tt=PLN.step;tt<=PLN.hor;tt+=PLN.step){const q=PR?trajAt(s,P,tt,dt):null,mx=PR?q.x:s.x+cvx*tt,my=PR?q.y:s.y+cvy*tt,gx=g.x+g.sx*tt,gy=g.y+g.sy*tt,d=Math.hypot(gx-mx,gy-my),
      aG=Math.abs(adiff(g.hd||0,Math.atan2(my-gy,mx-gx))),aS=0;
      sc+=PLN.wd*dpsAt(mb,g,d,aG)*(1/Math.max(.2,eb.md))*PLN.step-PLN.wr*dpsAt(g.tur,s,d,aS,eb.wp)*PLN.step}
    {const T2=PLN.hor,q=PR?trajAt(s,P,T2,dt):null,mx=PR?q.x:s.x+cvx*T2,my=PR?q.y:s.y+cvy*T2,gx=g.x+g.sx*T2,gy=g.y+g.sy*T2,d=Math.hypot(gx-mx,gy-my),aG=Math.abs(adiff(g.hd||0,Math.atan2(my-gy,mx-gx)));
      sc+=PLN.tail*(PLN.wd*dpsAt(mb,g,d,aG)/Math.max(.2,eb.md)-PLN.wr*dpsAt(g.tur,s,d,0,eb.wp))} // ценность позиции: где окажемся через hor с — сколько оттуда сможем бить и получать дальше (tail с боя)
    sc-=wf*cost;scs[k]=sc;(s.planAll=s.planAll&&s.planAll.t===t?s.planAll:Object.assign([],{t})).push([k,sc,cost]);if(!best||sc>best.sc)best={k,vx:cvx,vy:cvy,sc}}
  if(PR&&s.plan&&best&&best.k!==s.plan.k){const now=scs[s.plan.k],old=C.find(c=>c[0]===s.plan.k);if(now!=null&&old&&best.sc<now+(PLN.hyst-1)*Math.abs(now))best={k:s.plan.k,vx:old[1],vy:old[2],sc:now}} /* гистерезис по свежей оценке прежнего плана, при любом знаке; запрещённый прежний план не держим */
  else if(s.plan&&best&&best.k!==s.plan.k){const old=C.find(c=>c[0]===s.plan.k);if(old){/* гистерезис: держим прежний план, если новый не заметно лучше */const o2=best.sc;if(o2<(s.plan.sc||0)*PLN.hyst&&o2>0)best={...s.plan,vx:old[1],vy:old[2]}}}
  s.plan=best;return best}
// ===== ЕДИНЫЙ ТАКТИЧЕСКИЙ ПЛАНИРОВЩИК (ai2) =====
// Кандидат — намерение: движение (скорость/строй/таран) × ориентация (нос на цель / броня к угрозе / к импульсу) [+ уклонение вбок].
// Намерение → функция команды (vx,vy,курс) → тот же ctrlStep и физика: и в прогнозе (призрак), и в бою. Оценка — по траектории призрака.
const ZA=[0,Math.PI/2,Math.PI,-Math.PI/2]; // зона брони → направление угрозы относительно носа (как в zoneTo)
const aspK=a=>a>2.356?3:a>.785?1.5:1;
function threatsOf(s){const out=[],hr=s.T.L*.6+.05;for(const p of proj){if(p.side===s.side||p.g)continue;const rx=s.x-p.x,ry=s.y-p.y;if(rx*rx+ry*ry>3600)continue;const wx=p.vx-s.sx,wy=p.vy-s.sy,w2=wx*wx+wy*wy||1e-9,tc=(rx*wx+ry*wy)/w2;if(tc<0||tc>12)continue;
  const md=Math.hypot(rx-wx*tc,ry-wy*tc);if(md>hr*3)continue;if(SNS.on){const dd=p.dt||(p.dt=[-1,-1]);if(dd[s.side]<0){if(!seesP(s,p,Math.sqrt(rx*rx+ry*ry)))continue;dd[s.side]=t}if(t-dd[s.side]<SNS.track)continue}
  out.push({p,x:p.x,y:p.y,vx:p.vx,vy:p.vy,tc,md,wx,wy})}return out} // замеченные снаряды, которые за ≤12 с пройдут рядом
function slotNow(s,F){const fx=F.dx||1,fy=F.dy||0;return {x:F.gx-fx*(s.slotBack||0)-fy*(s.slotLat||0),y:F.gy-fy*(s.slotBack||0)+fx*(s.slotLat||0),vx:F.vgx||0,vy:F.vgy||0}}
// намерение → команда: tgt(tt), slot(tt) — где цель и место в строю через tt с (в прогнозе — по прямой от снимка, в бою — живые)
function intentCmd(I,tgt,slot,eng){const e=Math.max(eng,.05);return (G,tt)=>{const q=tgt(tt);let vx,vy;
  if(I.mode==='slot'){const S=slot(tt),ex=S.x-G.x,ey=S.y-G.y,ed=Math.hypot(ex,ey)||1;if(ed<I.tol){vx=S.vx;vy=S.vy}else{const sp=Math.min(I.vcap,(ed-I.tol)*.04+.004);vx=S.vx+ex/ed*sp;vy=S.vy+ey/ed*sp}}
  else if(I.mode==='ram'){const dx=q.x-G.x,dy=q.y-G.y,d=Math.hypot(dx,dy)||1e-6,vc=Math.min(RAM.v*.9,Math.max(.02,Math.sqrt(2*G.acc/1000*Math.max(.15,eng)*d)*.7));vx=q.sx+dx/d*vc;vy=q.sy+dy/d*vc} // перехват: в системе цели летим к ней по прямой со сближением vc
  else{vx=I.cvx;vy=I.cvy}
  if(I.mode!=='ram'){const vl=Math.hypot(vx,vy);if(vl>I.vcap){vx*=I.vcap/vl;vy*=I.vcap/vl}} // предел скорости: не разгоняемся выше max(vm, нынешней)
  let want=I.orient==='броня'?I.wA:Math.atan2(q.y-G.y,q.x-G.x);
  if(I.mode==='ram'){const ddx=vx-G.sx,ddy=vy-G.sy;if(Math.hypot(ddx,ddy)>.03&&Math.hypot(q.x-G.x,q.y-G.y)>RAM.dist*.25)want=Math.atan2(ddy,ddx)} // таран: пока далеко и нужен импульс — разворот к нему (тяга главным), у цели — носом (толстая броня вперёд)
  if(I.orient==='импульс'){const ddx=vx-G.sx,ddy=vy-G.sy;if(Math.hypot(ddx,ddy)>.05)want=Math.atan2(ddy,ddx)}
  return [vx/e,vy/e,want,1,eng,0]}}
// защитные слои, которые в бою меняют команду плана (те же формулы, что в steer): отталкивание от камней и общий бюджет Δv
function envPush(G,vx,vy,vm,L){for(const e of env){const dx=G.x-e.x,dy=G.y-e.y,rr=e.r+L*.25+(e.t==='wreck'?1:8);if(dx>rr||dx<-rr||dy>rr||dy<-rr)continue;const d=Math.hypot(dx,dy)||1;if(d<rr){const f=Math.max(vm,.1)*(1-d/rr)*1.6;vx+=dx/d*f;vy+=dy/d*f}}return [vx,vy]}
// ТОПЛИВО МАНЕВРОВЫХ НА ВОЗВРАЩЕНИЕ: у каждого корабля своё — по его маневровым (тяга Fr, угловое ускорение α от массы и длины) и экономному развороту (RET.slew):
// один разворот на угол π при пиковой скорости π/slew стоит 2·Fr·(π/slew)/α / vₑ(маневровых). На возвращение — RET.flips таких разворотов (к импульсу, поправки, торможение).
// Этот запас вычитается из топлива ДО расчёта Δv главных двигателей. Раньше не учитывался: у тяжёлых кораблей маневровые съедали до трети резерва
function rotF(s){if(s._rfT===t)return s._rfV;const rcsF=s.rcs0?.15+.85*(s.rcsN||0)/s.rcs0:1,R=turnPhys(s,rcsF),v=R.al>0?RET.flips*2*R.Fr*(Math.PI/RET.slew)/R.al/(FUEL.rcsVe*1000)/1000:0;s._rfT=t;s._rfV=v;return v}
function fuelM(s,f){return Math.max(0,f-rotF(s))}
function spendAt(s,G,tk,tt){const m0=dryM(s),dvr=FUEL.ve*Math.log((m0+fuelM(s,G.fuel))/m0);let need;if(tk){const vr=Math.hypot(G.sx-(tk.sx||0),G.sy-(tk.sy||0)),d=Math.hypot(tk.x+(tk.sx||0)*tt-G.x,tk.y+(tk.sy||0)*tt-G.y);need=vr+2*Math.min(dvr*.4,Math.sqrt(2*s.acc/1000*d)*.6)}else need=retNeed(s,G);return dvr-need}
function guardCmd(s,G,vx,vy,eng,tk,tt){const e=Math.max(eng,.05);if(env.length)[vx,vy]=envPush(G,vx,vy,.2*VMK*s.T.spd,s.T.L);
  if(G.fuelCap){const sp=spendAt(s,G,tk,tt);if(sp<=0){vx=G.sx/e;vy=G.sy/e}else{const ex=vx*eng-G.sx,ey=vy*eng-G.sy,ed=Math.hypot(ex,ey);if(ed>sp){const k=sp/ed;vx=(G.sx+ex*k)/e;vy=(G.sy+ey*k)/e}}}return [vx,vy]}
function predI(s,I,cf,dt,tk){const n=Math.ceil(PLN.hor/dt-1e-9),pu=PLN.pu||dt;let tt=0,wN=-1,c=null;
  const f=(G,k)=>{if(k>=n)return null;if(k===0){G.ramTg=I.mode==='ram'?1:null;if(I.dodge){G.dg={x:I.dodge.x,y:I.dodge.y};G.dgU=0;G.dgT=t+I.dodge.T;G.dgV=I.dodge.V}}if(tt>=wN-1e-9){wN=tt+pu;c=cf(G,tt)}const v=guardCmd(s,G,c[0],c[1],c[4],tk,tt);tt+=dt;return [v[0],v[1],c[2],c[3],c[4],c[5],dt]};f.n=n;return predictCmds(s,f)}
function resvMin(s,P,dt,m0d,tk){let mn=1e9,end=0;for(let i=0;i<P.length;i++){const q=P[i],tt=(i+1)*dt,dvr=FUEL.ve*Math.log((m0d+fuelM(s,q.fuel))/m0d);let need;
    if(tk){const vr=Math.hypot(q.sx-(tk.sx||0),q.sy-(tk.sy||0)),d=Math.hypot(tk.x+(tk.sx||0)*tt-q.x,tk.y+(tk.sy||0)*tt-q.y);need=vr+2*Math.min(dvr*.4,Math.sqrt(2*s.acc/1000*d)*.6)}else need=retNeed(s,q);
    end=dvr-need;if(end<mn)mn=end}return {mn,end}}
// ПРОГНОЗ ПРОТИВНИКА: только то, что видели сенсоры стороны. Трек: последнее наблюдение (положение, скорость, курс), сглаженное ускорение по изменению видимой скорости,
// наибольшее замеченное ускорение (оценка манёвренности). Не видно — экстраполяция от последнего наблюдения. Три сценария с весами: прямо, продолжает манёвр, уходит вбок от нашей линии визирования; Δv сценария ≤ оценки топлива врага
const EP=gd('battle','epred',{win:2,prior:.002,lat:.5,aMin:.0005,dvMax:1,jump:.001,age:60,acc:5,pseudo:8,burn:10}); // burn — с: сколько длится манёвр в сценариях (импульс, а не бесконечная тяга) // acc — м/с², манёвренность неизвестного корабля (середина гипотез ×½…×2); pseudo — вес априорных весов сценариев в наблюдениях (сколько проверок нужно, чтобы опыт перевесил) // prior — км/с², манёвренность по умолчанию; lat — доля её на уход вбок; aMin — с какого ускорения считаем, что враг маневрирует; jump — смена ускорения, после которой пересматриваем план; age — с, после которых трек забываем
function trackOf(side,o){const T=o.etk||(o.etk=[null,null]);let r=T[side];if(t-o.seen[side]<TRK.ttl){
    if(!r)r=T[side]={t,x:o.x,y:o.y,sx:o.sx||0,sy:o.sy||0,hd:o.hd||0,ax:0,ay:0,am:0,jt:-1};
    else if(t-r.t>=EP.win-1e-9){const h=t-r.t, /* ускорение врага — среднее за окно EP.win с: дробление манёвра на шаги физики не выглядит сменой манёвра */ax=((o.sx||0)-r.sx)/h,ay=((o.sy||0)-r.sy)/h;if(Math.hypot(ax-r.ax,ay-r.ay)>EP.jump)r.jt=t;r.ax=r.ax*.5+ax*.5;r.ay=r.ay*.5+ay*.5;r.am=Math.max(r.am*.98,Math.hypot(ax,ay));r.as=(r.as||0)*.9+Math.hypot(ax,ay)*.1;r.t=t;r.x=o.x;r.y=o.y;r.sx=o.sx||0;r.sy=o.sy||0;r.hd=o.hd||0}}
  return r&&t-r.t<EP.age?r:null}
function scenOf(s,r,b){const aE=Math.max(EP.prior,r.am),man=Math.hypot(r.ax,r.ay)>EP.aMin&&(r.as||0)>EP.aMin,lx=r.x-s.x,ly=r.y-s.y,ll=Math.hypot(lx,ly)||1,qx=-ly/ll,qy=lx/ll,sg=((r.sx-s.sx)*qx+(r.sy-s.sy)*qy)>=0?1:-1,al=aE*EP.lat,dv=Math.min(EP.dvMax,Math.max(0,b.fu));
  const w0=man?[.45,.35,.2]:r.am*1000>EP.acc*.2?[.7,.1,.2]:[.8,.05,.15],n=r.wn||[0,0,0],N=n[0]+n[1]+n[2],A=EP.pseudo; // априорно: без замеченных манёвров — почти наверняка прямо
  const S=[{ax:0,ay:0},{ax:r.ax,ay:r.ay},{ax:qx*al*sg,ay:qy*al*sg}].map((q,i)=>({...q,dv,w:(A*w0[i]+n[i])/(A+N)}));return S} // вес = (априорный × pseudo + сколько раз сценарий оправдался) / (pseudo + проверок)
function scenAt(r,q,tt){const T=t-r.t+tt,a=Math.hypot(q.ax,q.ay),ta=a>1e-9?Math.min(T,q.dv/a,EP.burn):0;return {x:r.x+r.sx*T+q.ax*ta*(T-ta/2),y:r.y+r.sy*T+q.ay*ta*(T-ta/2),sx:r.sx+q.ax*ta,sy:r.sy+q.ay*ta}}
function scenMean(r,S,tt){let x=0,y=0,sx=0,sy=0;for(const q of S){const p=scenAt(r,q,tt);x+=p.x*q.w;y+=p.y*q.w;sx+=p.sx*q.w;sy+=p.sy*q.w}return {x,y,sx,sy}}
const _WB=[];const PERF={pt:{},ring:new Float32Array(4096),ri:0,max:0,steps:0,step:0,fleet:0,sens:0,crew:0,steer:0,weap:0,proj:0,mis:0,rest:0,plan:0,planN:0,dc:0,frame:0,frames:0,simLag:0}; // время по подсистемам, мс (только для замеров; на симуляцию не влияет)
function plan2(s,g,eng,dtPh,F,force){const _q0=performance.now();try{return plan2b(s,g,eng,dtPh,F,force)}finally{PERF.plan+=performance.now()-_q0}}
const _SC=new Map(),_SM=new Map();let _pcT=-1;function scenAtC(r,q,tt){if(!PLN.cache)return scenAt(r,q,tt);if(_pcT!==t){_SC.clear();_SM.clear();_pcT=t}let m=_SC.get(q);if(!m){m=new Map();_SC.set(q,m)}let v=m.get(tt);if(v===undefined){v=scenAt(r,q,tt);m.set(tt,v)}return v} // положения сценариев врага на моменты прогноза: одинаковы для всех вариантов манёвра и всех кораблей в этом шаге — считаются один раз
function scenMeanC(r,S,tt){if(!PLN.cache)return scenMean(r,S,tt);if(_pcT!==t){_SC.clear();_SM.clear();_pcT=t}let m=_SM.get(S);if(!m){m=new Map();_SM.set(S,m)}let v=m.get(tt);if(v===undefined){v=scenMean(r,S,tt);m.set(tt,v)}return v}
let _plT=-1,_plN=0;
function plan2b(s,g,eng,dtPh,F,force){const _T=PERF.pt;let _q=performance.now();const lap=k=>{const n=performance.now();_T[k]=(_T[k]||0)+n-_q;_q=n};if(_pcT!==t){_SC.clear();_SM.clear();_pcT=t}const dt=Math.max(dtPh,PLN.gdt); /* шаг прогноза планировщика — свой, не шаг физики: решения ИИ не зависят от дискретизации физики */if(!force&&t<(s.plT||0)&&s.plan)return s.plan;if(_plT!==t){_plT=t;_plN=0}if(!force&&s.plan&&PLN.cap&&_plN>=PLN.cap)return s.plan;_plN++; /* очередь плановых пересмотров: не больше PLN.cap за шаг; кто не успел — в следующем шаге (решение не теряется, сдвиг на доли секунды; внеочередные — по угрозе, удару — всегда сразу). Иначе в один шаг сходились десятки решений и кадр замирал на полсекунды */s.plT=t+PLN.dt/(s.cg?Math.max(.25,cmdEff(s)):1)*(s.plan?1:.5+((s.uid*.618)%1)); /* после первого решения корабли расходятся по фазе: флот не думает весь в одном шаге (пики кадра), частота та же */ /* мостик выбит — решения реже */{const S0=stat.fc=stat.fc||{};S0.planN=(S0.planN||0)+1;PERF.planN++}
  if(s.planP&&!s.gh){const el=t-s.planT0,P=s.planP;if(el>=dt&&el<=PLN.hor){const q=trajAt(s.planS,P,el,s.planDt),e=Math.hypot(q.x-s.x,q.y-s.y)*1000;stat.pdN=(stat.pdN||0)+1;if(!s.planExt)stat.pdMax=Math.max(stat.pdMax||0,e);if(s.planExt){stat.pdExt=(stat.pdExt||0)+1;stat.pdExtMax=Math.max(stat.pdExtMax||0,e)}else if(e>PLN.div){stat.pdBig=(stat.pdBig||0)+1;(stat.pdL=stat.pdL||[]).push([Math.round(t),Math.round(e),s.T.n])}}} // план против факта: сколько метров ушли от прогноза к моменту пересмотра
  const rg=trackOf(s.side,g),bg=belief(s.side,g),Sg=scenOf(s,rg,bg),G0=scenMean(rg,Sg,0),gv={x:G0.x,y:G0.y,sx:G0.sx,sy:G0.sy,hd:rg.hd}; // цель — какой её видят сенсоры
  if(!s.epC||t>=s.epC.t0+30)s.epC={t0:t,g,r:trackOf(s.side,g),S:Sg.map(q=>scenAt(rg,q,30)),m:scenMean(rg,Sg,30),l:{x:rg.x+rg.sx*(t-rg.t+30),y:rg.y+rg.sy*(t-rg.t+30)}}; // проверка прогноза цели через 30 с
  lap('1 наблюдение цели (сенсоры, сценарии)');const dx=gv.x-s.x,dy=gv.y-s.y,d0=Math.hypot(dx,dy)||1e-6,ux=dx/d0,uy=dy/d0,px=-uy,py=ux,V=PLN.v,spend=s.dvB?s.dvB.spend:0,m0d=dryM(s),tk=s.dvB&&s.dvB.tk,hr=s.T.L*.6+.05,surv=1/Math.max(.25,hpf(s));
  // противники: до 6 ближайших в двойной дальности + главная цель; оценка каждого — один раз до перебора
  const L=[];for(const o of ships){if(!o.alive||o.side===s.side||!o.T||o.st==='surr'||o===g)continue;const r=trackOf(s.side,o);if(!r)continue;const d=Math.hypot(r.x-s.x,r.y-s.y);if(d<Math.max(80,(s.maxR||60)*2,(o.maxR||60)*2))L.push([d,o,r])}L.sort((a,b)=>a[0]-b[0]);
  const EN=[{o:g,r:rg,b:bg,S:Sg,w:PLN.wfoc},...L.slice(0,5).map(([,o,r])=>{const b=belief(s.side,o);return {o,r,b,S:scenOf(s,r,b),w:1}})];
  for(const e of EN){const m=scenMean(e.r,e.S,0);e.x=m.x;e.y=m.y;e.hd=e.r.hd;const a=Math.max(EP.acc,e.r.am*1000);e.px=[.5,1,2].map(k=>({T:e.o.T,acc:a*k,rcsN:1}));e.wt=e.o.__dt||(e.o.__dt=e.o.tur.map(m=>({k:m.k,cfg:m.cfg,face:m.face,alive:true})))} // не знаем: манёвренность (½…×2 от замеченной или типичной), состояние оружия (проект, исправная доля — belief.wp)
  lap('2 оценка врагов (до 6), их оружие');
  // направление суммарной угрозы и лучшая броня к ней
  let tx=0,ty=0;for(const e of EN){const ex=e.x-s.x,ey=e.y-s.y,d=Math.hypot(ex,ey)||1,w=dpsAt(e.wt,s,d,0,e.b.wp)+1e-6;tx+=ex/d*w;ty+=ey/d*w}
  let bz=0,ba=-1;for(let z=0;z<4;z++){const a=(s.zones[z].arm||0)*armFrac(s,z);if(a>ba){ba=a;bz=z}}const wA=Math.atan2(ty,tx)-ZA[bz];
  // предел скорости (как vm в steer): разгон не выше vm и половины свободного Δv; если уже быстрее — не разгоняемся дальше
  let vm=.2*VMK*s.T.spd;vm=Math.min(vm,Math.max(.02,(FUEL.ve*Math.log((m0d+s.fuel)/m0d)-HOME())/2));const vcap=Math.max(vm,Math.hypot(s.sx,s.sy));
  const M=[['инерция',s.sx,s.sy],['сближение',gv.sx+ux*V,gv.sy+uy*V],['отход',gv.sx-ux*V,gv.sy-uy*V],['обход влево',gv.sx+px*V+ux*V*.3,gv.sy+py*V+uy*V*.3],['обход вправо',gv.sx-px*V+ux*V*.3,gv.sy-py*V+uy*V*.3],['уравнять',gv.sx,gv.sy]];
  {const rx=gv.x-Math.cos(gv.hd)*Math.max(5,d0*.5)-s.x,ry=gv.y-Math.sin(gv.hd)*Math.max(5,d0*.5)-s.y,rl=Math.hypot(rx,ry)||1;M.push(['в корму',gv.sx+rx/rl*V,gv.sy+ry/rl*V])}
  const inF=F&&F.n>=2&&F.formed!==false&&F.gx!=null,S0=inF?slotNow(s,F):null,tol=Math.max(1.5,s.T.L*15);if(inF)M.push(['строй',0,0,'slot']);
  const canRam=RAM.on&&g.T&&s.T.tons>=g.T.tons*RAM.mass&&s.zones[0].arm>=RAM.nose&&d0<RAM.dist*4;if(canRam)M.push(['таран',0,0,'ram']);
  const TH=threatsOf(s);let dg=null;if(TH.length){const h=TH.reduce((a,b)=>b.tc<a.tc?b:a),wl=Math.hypot(h.wx,h.wy)||1;dg={x:-h.wy/wl,y:h.wx/wl,V:Math.max(.005,(hr*1.3)/Math.max(1,h.tc)),T:Math.min(4,h.tc+1)}}
  lap('3 угрозы и цель: направление, броня, снаряды');const I0=[];for(const [k,cvx,cvy,mode] of M)for(const orient of mode==='ram'?['нос']:['нос','броня','импульс']){const b={k,cvx,cvy,mode:mode||'v',orient,wA,vcap,tol};I0.push(b);
    if(dg&&mode!=='ram')for(const sg of [1,-1])I0.push({...b,dodge:{x:dg.x*sg,y:dg.y*sg,V:dg.V,T:dg.T}})}
  const tgP=tt=>scenMeanC(rg,Sg,tt),slP=tt=>({x:S0.x+S0.vx*tt,y:S0.y+S0.vy*tt,vx:S0.vx,vy:S0.vy});
  // ЦЕНА ТОПЛИВА (множитель Лагранжа): оценки манёвров — в единицах боя (сотни), Δv без цены почти ничего не стоил — флот сжигал 65–92% за 25 мин.
  // λ подстраивается так, чтобы средний расход шёл по пайку: свободный Δv / FUEL.Tb (ожидаемая длина боя). Расход выше пайка — λ растёт, ниже — падает; λ свой у каждого корабля.
  const lam=(()=>{if(s.lam==null){s.lam=PLN.lam0;s.lamT=t;s.lamDv=s.dvSum||0;return s.lam}const el=t-s.lamT;if(el>=PLN.dt){const r=((s.dvSum||0)-s.lamDv)/el,r0=Math.max(1e-6,Math.max(0,spend)/FUEL.Tb);s.lam=Math.max(PLN.lam0*.1,Math.min(PLN.lam0*1e3,s.lam*Math.max(.5,Math.min(2,Math.sqrt(r/r0||.5)))));s.lamT=t;s.lamDv=s.dvSum||0}return s.lam})();
  const wf=PLN.wf*(1+2/(1+Math.max(0,spend))),ws=s.tur.filter(m=>m.alive&&m.cfg),WC=ws.map(m=>Math.cos(FACE_A[m.face||0]+(s.roll||0))) /* сектор обстрела каждого орудия: cos — один раз на решение */,cd0=s.T.L*.5+(g.T?g.T.L*.12:0);
  const evalAt=(G,tt)=>{const _e0=performance.now();let v=0;for(const e of EN)for(const q of e.S){const E=scenAtC(e.r,q,tt),ex=E.x,ey=E.y,d=Math.hypot(ex-G.x,ey-G.y),bt=Math.atan2(ey-G.y,ex-G.x),a=adiff(G.hd,bt),
      wb=_WB;wb.length=0;if(PLN.cache){const sa=Math.sin(a),aa=Math.abs(a)<.175;for(let i=0;i<ws.length;i++){const m=ws[i];if(m.cfg.ax?aa:WC[i]*sa>-.25)wb.push(m)}}else for(const m of ws)if(m.cfg.ax?Math.abs(a)<.175:bearsDir(m,s.roll||0,a,0))wb.push(m); /* без новой выделенной памяти на каждую оценку */
      const aE=Math.abs(adiff(e.hd,Math.atan2(G.y-ey,G.x-ex)));let dd=0;if(PLN.f3)dd=dpsAt3(wb,e.px,d,aE);else for(const x of e.px)dd+=dpsAt(wb,x,d,aE)/3;v+=q.w*(e.w*PLN.wd*dd/Math.max(.2,e.b.md)-PLN.wr*surv*dpsAt(e.wt,s,d,Math.abs(a),e.b.wp))}PERF.ev=(PERF.ev||0)+performance.now()-_e0;PERF.evN=(PERF.evN||0)+1;return v}; // урон по каждому сценарию врага × его вес
  // РОЛЬ (из задачи командования) — оценка позиции призрака, 0 — идеально, 1 — заметно плохо. Не траектория: корабль сам выбирает, как оказаться в нужном месте.
  // РОЛЬ (назначена командованием) — штраф за позицию призрака, 0 — идеально. Не траектория: корабль сам выбирает, как оказаться в нужном месте.
  // Линия и поддержка — свои места в линии соединения (линия движется вместе с флотом); ПВО — у прикрываемого, между ним и угрозой; перехват — во фланг/корму цели,
  // но только если до неё уже недалеко и он не медленнее её (иначе прямой подход). При устойчивой угрозе роль весит втрое меньше — строй не ценой гибели.
  const role=s.flee&&PLN.rtr?'отход':AB.side>=0&&s.side!==AB.side?null:FC.on&&s.task&&s.task.role,LN=F&&F.line,tl=Math.hypot(tx,ty)||1,tdx=tx/tl,tdy=ty/tl,dopt=Math.max(5,(s.T.dopt||0)||(s.maxR||60)*.6),Rs=(s.maxR||60)*.8;
  const Rf=Math.max(PLN.rfree,dopt*.5); /* свобода манёвра: в пределах Rf от места в строю роль не штрафует — корабль сражается, а не стоит в точке */const dS0=s.slot?Math.hypot(s.slot.x-s.x,s.slot.y-s.y):0,dP0=(role==='ПВО'||role==='прикрытие')&&s.prot&&s.prot.alive?Math.hypot(s.prot.x-s.x,s.prot.y-s.y):0; /* текущие расстояния: оценка роли — доля оставшегося пути, иначе вдали от места все планы равны (насыщение) и строй не собирается */const slotAt=tt=>({x:s.slot.x+(LN?LN.vx:0)*tt,y:s.slot.y+(LN?LN.vy:0)*tt}),prot=(role==='ПВО'||role==='прикрытие')&&s.prot&&s.prot.alive?s.prot:null,spn=LN?LN.sp:3;
  const icFeas=role==='перехват'?Math.max(.3,Math.min(1.5,(s.acc||5)/Math.max(1,(rg.am||0)*1000||EP.acc)))*(d0<(s.maxR||60)*2?1:.3):0;
  const RC=!role||(PLN.roff&&PLN.roff.includes(role))?null:role==='линия'&&s.slot?(G,tt)=>{const S=slotAt(tt),m=scenMeanC(rg,Sg,tt);return Math.min(3,Math.max(0,Math.hypot(G.x-S.x,G.y-S.y)-Rf)/Math.max(spn,dS0-Rf))+.5*Math.min(2,Math.abs(Math.hypot(m.x-G.x,m.y-G.y)-dopt)/dopt)}
    :role==='поддержка'?(G,tt)=>{let p=0,dn=1e9;const oR=s.maxR||60;for(const e of EN){const m=scenMeanC(e.r,e.S,tt),d=Math.hypot(m.x-G.x,m.y-G.y),Re=(e.o.maxR||60)*1.05;dn=Math.min(dn,d);p+=2*Math.max(0,Re-d)/Re}return Math.min(3,p+Math.max(0,dn-oR*.9)/oR)} /* поддержка — огонь с дистанции: вне досягаемости врага, но в своей */
    :role==='разведка'?(G,tt)=>{let dn=1e9,Re=60;for(const e of EN){const m=scenMeanC(e.r,e.S,tt),d=Math.hypot(m.x-G.x,m.y-G.y);if(d<dn){dn=d;Re=(e.o.maxR||60)}}const sRg=Math.max(1,...(s.scl||s.sc||[]).map(c=>c.rng||0)),lo=Re*1.15,hi=Math.max(lo*1.1,sRg*.85);return Math.min(3,dn<lo?3*(lo-dn)/lo:dn>hi?(dn-hi)/hi:0)} /* разведчик: на границе своей дальности обнаружения, вне досягаемости врага — видит для всего флота */
    :role==='ремонт'&&s.rpTg&&s.rpTg.alive?(G,tt)=>{const A=s.rpTg,px=A.x+(A.sx||0)*tt-tdx*KIT.dock*.7,py=A.y+(A.sy||0)*tt-tdy*KIT.dock*.7;return Math.min(3,Math.hypot(G.x-px,G.y-py)/Math.max(3,KIT.dock*2))} /* ремонтник: рядом с повреждённым, с теневой стороны от угрозы */
    :prot?(G,tt)=>{const off=role==='прикрытие'?Math.max(3,Math.min(15,dopt*.4)):Math.max(1.5,prot.T.L*8),px=prot.x+(prot.sx||0)*tt+tdx*off,py=prot.y+(prot.sy||0)*tt+tdy*off; /* прикрытие: между уходящим и угрозой */return Math.min(3,Math.hypot(G.x-px,G.y-py)/Math.max(3,dP0))}
    :role==='отход'?(G,tt)=>{let p=0;for(const e of EN){const m=scenMeanC(e.r,e.S,tt),dn=Math.hypot(m.x-G.x,m.y-G.y),Re=(e.o.maxR||60)*1.3;p+=Math.max(0,Re-dn)/Re}return Math.min(3,3*p)}
    :role==='перехват'?(G,tt)=>{const m=scenMeanC(rg,Sg,tt);return icFeas*(1-Math.abs(adiff(rg.hd,Math.atan2(G.y-m.y,G.x-m.x)))/Math.PI)}
    :null;
  const rK=role==='отход'||role==='ПВО'||role==='прикрытие'?3:role==='ремонт'?6:role==='разведка'?2:1; /* ремонтнику стыковка важнее перестрелки: без сближения на 3 км и уравнивания скорости передать наборы нельзя */ /* отход — выживание важнее боя; ПВО — прикрытие и есть его бой (при весе 1 уходило за целями на 40–100 км): вес роли втрое */const rS=RC?(()=>{let v=0;for(const e of EN){const d=Math.hypot(e.x-s.x,e.y-s.y);v+=dpsAt(ws,e.px[1],d,0)+dpsAt(e.wt,s,d,0,e.b.wp)}return Math.max(.01,.25*v*(PLN.hor+PLN.tail)/(PLN.hor/PLN.step))*((s.riskN||0)>=2?1/3:1)})():0; // lint-ok роль сдвигает оценку в пределах ~15% боевой ценности × PLN.wrole (3 → ~45%: замер — строй вдвое плотнее при тех же потерях); бой не перевешивает
  const scs={},all=[];let best=null;s.planBan=[];
  const EMt=EN.map(e=>({m:[],cd:s.T.L*.5+e.o.T.L*.12+.05}));lap('4 генерация вариантов, цена топлива, роль');for(const I of I0){let P=predI(s,I,intentCmd(I,tgP,slP,eng),dt,tk);PERF.predN=(PERF.predN||0)+1;lap('5 расчёт траекторий (predI)');
    // контакт с кораблём врага: дальше прогноз не знает, что будет (столкновение — внешнее событие), — оцениваем траекторию только до контакта
    let ic=-1,ce=null;if(PLN.cache){for(let i=0;i<P.length&&ic<0;i++){const px=P[i].x,py=P[i].y;for(let j=0;j<EN.length;j++){const M=EMt[j],q=M.m[i]||(M.m[i]=scenMean(EN[j].r,EN[j].S,(i+1)*dt)),dx=q.x-px,dy=q.y-py,c=M.cd;if(dx>c||dx<-c||dy>c||dy<-c)continue;if(Math.hypot(dx,dy)<c){ic=i;ce=EN[j];break}}}} /* положения врагов на шагах прогноза — одни на все варианты; сначала грубая проверка по квадрату */
    else for(let i=0;i<P.length&&ic<0;i++){const tt=(i+1)*dt;for(const e of EN){const cd=s.T.L*.5+e.o.T.L*.12,m=scenMeanC(e.r,e.S,tt);if(Math.hypot(m.x-P[i].x,m.y-P[i].y)<cd+.05){ic=i;ce=e;break}}}
    const tc=ic>=0?(ic+1)*dt:1e9,P0full=P;if(ic>=0)P=P.slice(0,ic+1);lap('6 контакт с кораблями врага');const R=resvMin(s,P,dt,m0d,tk);lap('7 резерв топлива по траектории');const id=I.k+'·'+I.orient+(I.dodge?(I.dodge.x*dg.x+I.dodge.y*dg.y>0?'·уклон+':'·уклон−'):'');
    if(R.mn<Math.min(0,spend)-1e-9){s.planBan.push(id);if(I.k!=='инерция'||I.orient!=='нос'||I.dodge)continue} // резерв нарушен на любом шаге — запрет; «инерция·нос» — запасной вариант
    const cost=FUEL.ve*Math.log((m0d+s.fuel)/(m0d+P[P.length-1].fuel));let sc=0;
    for(let t1=PLN.step;t1<=PLN.hor+1e-9;t1+=PLN.step){const tt=Math.min(t1,tc),G=trajAt(s,P,tt,dt);sc+=evalAt(G,tt)*PLN.step;if(inF){const ds=Math.hypot(S0.x+S0.vx*tt-G.x,S0.y+S0.vy*tt-G.y);sc-=PLN.wform*Math.max(0,ds-tol)}}
    {const tt=Math.min(PLN.hor,tc);sc+=PLN.tail*evalAt(trajAt(s,P,tt,dt),tt)}lap('8 урон нанесённый/полученный (вероятность попадания)');
    if(RC)for(let t1=PLN.step;t1<=PLN.hor+1e-9;t1+=PLN.step){const tt=Math.min(t1,tc);sc-=PLN.wrole*rK*rS*RC(trajAt(s,P,tt,dt),tt)} // роль корабля в соединении: штраф за позицию, неудобную для роли
    lap('9 штраф роли (координация)');for(const h of TH){let mn=1e9,ai=0,px0=h.x-s.x,py0=h.y-s.y;for(let i=0;i<P.length;i++){const tt=(i+1)*dt,px1=h.x+h.vx*tt-P[i].x,py1=h.y+h.vy*tt-P[i].y,qx=px1-px0,qy=py1-py0,l2=qx*qx+qy*qy||1e-12,u=Math.max(0,Math.min(1,-(px0*qx+py0*qy)/l2)),dd=Math.hypot(px0+qx*u,py0+qy*u);
        if(dd<mn){mn=dd;ai=i}px0=px1;py0=py1;if(tt>h.tc+4)break} // сближение снаряда с траекторией призрака (непрерывно между шагами)
      const ph=mn<=hr?1:Math.max(0,1-(mn-hr)/(2*hr)),Q=P[ai];sc-=PLN.wp*surv*ph*aspK(Math.abs(adiff(Q.hd,Math.atan2(-h.vy,-h.vx))))} // ожидаемое попадание × броня стороны × живучесть
    if(I.mode==='ram'){const P0=P0full,gH=ramGuess(g,bg),cdc=s.T.L*.5+g.T.L*.12,val=o=>o.kill?o.alive:o.mods;
      for(const q of Sg){for(let i=0;i<P0.length;i++){const tt=(i+1)*dt,E=scenAt(rg,q,tt),Q=P0[i],nx=E.x-Q.x,ny=E.y-Q.y,nl=Math.hypot(nx,ny);if(nl>=cdc+.05)continue;
        const vr=Math.max(0,((Q.sx-E.sx)*nx+(Q.sy-E.sy)*ny)/(nl||1));if(vr>0){const za=zoneAt(Q.hd,Q.x,Q.y,E.x,E.y),zb=zoneAt(rg.hd,E.x,E.y,Q.x,Q.y);for(const gp of gH){const R=ramEst(s,gp,vr,za,zb);sc+=q.w/gH.length*(PLN.wd*val(R[1])/Math.max(.2,bg.md)-PLN.wr*surv*val(R[0]))}}break}}} // вероятность удара — вес сценариев цели, в которых прогноз доводит до контакта; выгода и цена — модули обеих сторон по модели ramHit
    lap('10 снаряды в полёте, таран');sc-=(wf+lam)*cost;scs[id]=sc;all.push([id,sc,cost]);if(!best||sc>best.sc){best={k:id,I,sc,cost};best.P=P}}
  if(best&&s.plan&&s.plan.k!==best.k){const now=scs[s.plan.k];if(now!=null&&best.sc<now+(PLN.hyst-1)*Math.abs(now)){const I=I0.find(q=>(q.k+'·'+q.orient)===s.plan.k.replace(/·уклон.$/,'')&&!q.dodge===!s.plan.I.dodge);if(I)best={k:s.plan.k,I,sc:now}}} // гистерезис по свежей оценке
  if(best&&best.P&&FC.on&&s.task){let dG=0,rv=0;for(let t1=PLN.step;t1<=PLN.hor+1e-9;t1+=PLN.step){const G=trajAt(s,best.P,t1,dt);for(const e of EN)for(const q of e.S){const E=scenAt(e.r,q,t1),d=Math.hypot(E.x-G.x,E.y-G.y),a=adiff(G.hd,Math.atan2(E.y-G.y,E.x-G.x));
        rv+=q.w*dpsAt(e.wt,s,d,Math.abs(a),e.b.wp)*PLN.step;if(e.o===g)dG+=q.w*dpsAt(ws.filter(m=>m.cfg.ax?Math.abs(a)<.175:bearsDir(m,s.roll||0,a,0)),e.px[1],d,0)*PLN.step}}
    s.noAtk=dG<1e-3?(s.noAtk||0)+PLN.dt:0;{const S3=stat.fc=stat.fc||{};S3.atkT=(S3.atkT||0)+PLN.dt;if(dG<1e-3)S3.noAtkT=(S3.noAtkT||0)+PLN.dt;if(s.task.sw&&s.task.acq==null&&dG>=1e-3){s.task.acq=t-s.task.at;S3.acqT=(S3.acqT||0)+s.task.acq;S3.acqN=(S3.acqN||0)+1}}const left=s.aliveN;let why=null;{const S4=stat.fc=stat.fc||{},cal=S4.cal=S4.cal||{p:0,a:0,n:0,hi:0,hiA:0};(s.rvQ=s.rvQ||[]).push([t,rv,left,(s.riskN||0)>=2]);while(s.rvQ.length&&t-s.rvQ[0][0]>=PLN.hor){const z=s.rvQ.shift(),lf=(z[2]-left)/z[2];cal.p+=z[1];cal.a+=z[2]-left;cal.n++;if(lf>=FC.risk){cal.real=(cal.real||0)+1;if(z[3])cal.realHit=(cal.realHit||0)+1}if(z[3]){cal.flag=(cal.flag||0)+1;cal.flagLoss=(cal.flagLoss||0)+lf}}}
    const H=s.hpH=s.hpH||[];H.push([t,left]);while(H.length>1&&t-H[1][0]>=FC.win)H.shift();const lossF=(H[0][1]-left)/Math.max(1,H[0][1]),grow=rv>=.8*(s.rvP||0);s.rvP=rv;s.riskF=lossF;
    s.riskN=lossF>=FC.risk&&grow?(s.riskN||0)+1:lossF<FC.risk*.4?0:Math.max(0,(s.riskN||0)-1); // устойчивая угроза = корабль уже теряет модули (своё наблюдаемое состояние за FC.win с) И прогноз огня по нему не спадает; абсолютная шкала прогноза ненадёжна (сверка cal: расхождение в 10 раз между боями) // rvK — пересчёт оценки в модули (сверено с фактическими потерями: stat.fc.cal); опасность — доля оставшихся модулей за горизонт; спад ниже половины порога — сброс // временная опасность: счётчик растёт и убывает; доклад — только при устойчивой (3 пересмотра)
    if(hpf(s)<.35)why='критические повреждения';else if(s.dvB&&s.dvB.spend<=0&&s.dvB.tk)why='необходимо отступление';else if(s.riskN>=2)why='устойчивая угроза';else if(s.noAtk>=30&&role!=='ПВО')why='не может атаковать цель'; /* ПВО-сопровождению цель вторична: его пушки сами бьют ракеты и ближних */
    else if(role==='ПВО'&&!s.tur.some(m=>m.alive&&(m.k==='A'||m.k==='G')))why='роль невыполнима';else if(role==='перехват'&&s.dvB&&s.dvB.spend<.2)why='роль невыполнима';
    if(why)reportTask(s,F,why,g)}
  if(best&&all.length>1){const S=stat.fc=stat.fc||{},q=S.pl=S.pl||{n:0,cost:0,rng:0,c0:0,sp:0};q.n++;q.cost+=best.cost||0;const v=all.map(a=>a[1]);q.rng+=Math.max(...v)-Math.min(...v);const ch=all.reduce((a,b)=>b[2]<a[2]?b:a);q.c0+=ch[2];q.sp+=spend;q.dsc=(q.dsc||0)+(best.sc-ch[1])}
  if(best)best.rg0={...rg};s.planAll=Object.assign(all,{t});s.planExt=0;if(best&&best.P){s.planP=best.P;s.planS={x:s.x,y:s.y,hd:s.hd};s.planT0=t;s.planDt=dt}else s.planP=null;s.plan=best;return best}
// что думает ИИ корабля: план, оценки всех манёвров, цель флота и что корабль знает о ней (оценка, не истина)
function sideAI(sd){const c={};let lead=0;for(const o of ships)if(o.alive&&o.side===sd){if(o.plan)c[o.plan.k]=(c[o.plan.k]||0)+1;if(o.F&&o.F.lead)lead=1}const k=Object.entries(c);return (lead?' · <b>наступает</b>':'')+(k.length?' · манёвры: '+k.map(([a,b])=>a+' '+b).join(', '):'')}
function aiInfo(s){if(!s.alive)return '';const F=s.F||{},g=F.focus||s.tg;let h='<br><b>ИИ:</b> '+(F.lead?'флот навязывает бой':'флот держит строй')+(g&&g.alive?' · общая цель: '+g.T.n:'');
  if(s.plan)h+='<br>Манёвр: <b>'+s.plan.k+'</b>'+(s.planAll&&s.planAll.length?' · оценки: '+[...s.planAll].sort((a,b)=>b[1]-a[1]).map(([k,sc,c])=>k+' '+sc.toFixed(1)+(c>.005?' (Δv '+(c*1000).toFixed(0)+' м/с)':'')).join(', '):'');
  if(g&&g.alive&&g.bel&&g.bel[s.side]){const b=g.bel[s.side];h+='<br>Знает о цели: топливо ≈'+b.fu.toFixed(1)+' км/с · оружия ≈'+b.wp+' · целость ≈'+Math.round(b.md*100)+'%'+(b.seen>=0?' (обновлено '+Math.round(t-b.seen)+' с назад)':' (не наблюдалась)')}
  if(s.dvB)h+='<br>Свой запас Δv: '+Math.max(0,s.dvB.spend).toFixed(2)+' км/с сверх «до дома»'+(s.ramTg?' · <b>ТАРАН</b>':'')+(s.dg&&t<s.dgT?' · уклоняется':'');return h}
const PMc=(s,o)=>o&&closing(s,o)>PB.passV?PMIN*PB.pass:PMIN;
// сколько секунд цель видит наш снаряд до удара: дальность её сенсоров по снаряду (калибр ~ по скорости) / скорость сближения снаряда − время сопровождения
const TRK=gd('battle','track',{ally:.75,seen:.5,none:.25,jam:.6,ttl:6,near:1});
function tq(s,o){if(!o||!o.rl)return 1;const side=s.side;let q=o.byL&&t-(o.byL.get(s)??-99)<TRK.ttl?1:t-o.rl[side]<TRK.ttl?TRK.ally:t-o.rs[side]<TRK.ttl?TRK.seen:TRK.none;return Math.max(.1,q*(1-(o.jam||0)*TRK.jam))}
function hitP(s,o,V,sig){const d=Math.hypot(o.x-s.x,o.y-s.y,(o.z||0)-(s.z||0)),tf=d/Math.max(.1,V+closing(s,o)),e=(V<2?GDISP:DISP)*d*2*(sig||1)/(d<TRK.near?1:tq(s,o)),w=warnT(o,V,tf,closing(s,o)),
  dg=o.T&&o.rcsN>0&&o.sc&&o.sc.length?.5*(o.acc||5)*.12/1000*w*w:0,h=o.T?o.T.L*.11:.02;return Math.max(0,Math.min(1,h/(e+dg+1e-6)))}
// тонкая сетка брони: ячейки 10×10 см, в ячейке — остаток толщины, мм (хранятся только тронутые, остальные целые).
// Слой = 2 см стали, держит 2 МДж/см² → удар выбивает 10 мм на каждый 1 МДж/см²; не хватило энергии — остаётся вмятина, следующий удар в то же место пробьёт легче
const CELL=.1,LAYER_MM=20,MM_E=LAYER_MM/ARM_E;
function dig(o,z,x,y,iz,Eu,n,inf){
  const L=o.T.L*1000,cs=Math.cos(o.hd||0),sn=Math.sin(o.hd||0),dx=(x-o.x)*1000,dy=(y-o.y)*1000,u=dx*cs+dy*sn,v=-dx*sn+dy*cs,w=((iz!=null?iz:o.z)-(o.z||0))*1000;
  const NX=Math.max(1,Math.ceil(L/CELL)),W=Math.max(1,Math.ceil(Math.PI*L*.22/4/CELL)),ix0=Math.max(0,Math.min(NX-1,Math.floor((u+L/2)/CELL))),Q=Math.PI/2,qq=((Math.atan2(w,v)%Q)+Q)%Q,iy0=Math.min(W-1,Math.floor(qq/Q*W));
  const F=z.arm*LAYER_MM,dep=Eu*MM_E,h=n>>1;if(!z.g)z.g=new Map();let took=0,left=0,rem=F;
  for(let i=-h;i<n-h;i++)for(let j=-h;j<n-h;j++){const ix=ix0+i,iy=iy0+j;if(ix<0||ix>=NX||iy<0||iy>=W)continue;const k=ix*8192+iy,r=z.g.has(k)?z.g.get(k):F,tk=Math.min(r,dep);if(tk>0)z.g.set(k,r-tk);took+=tk;if(!i&&!j){left=dep-tk;rem=r-tk}}
  const nc=z.nc,c=Math.max(0,Math.min(nc-1,Math.floor(ix0/NX*nc))),lay=Math.floor(rem/LAYER_MM+1e-9);if(lay<z.cols[c]){z.armN-=z.cols[c]-lay;z.cols[c]=lay} // метровая колонка (для ИИ и картинки) — по самому глубокому месту
  stat.armMM=(stat.armMM||0)+took;
  if(inf&&(dep-left>=1||left>0)){const hl=o.hl||(o.hl=[]);hl.unshift({t,k:inf.k,v:inf.v,Eu,F,before:rem+dep-left,dep,after:rem,left,zi:o.zones.indexOf(z),n});if(hl.length>12)hl.pop()} // журнал пробитий для панели корабля (мм)
  return {c,took,left,rem,dep}}
// скорость сближения, км/с (плюс — сходимся)
function closing(s,o){const dx=o.x-s.x,dy=o.y-s.y,d=Math.hypot(dx,dy)||1,ox=o.sx!=null?o.sx:(o.vx||0),oy=o.sy!=null?o.sy:(o.vy||0);return -((ox-(s.sx||0))*dx+(oy-(s.sy||0))*dy)/d}
// дальность огня = (скорость снаряда + скорость сближения) × 20 с жизни снаряда
function effR(s,o,V){return Math.max(0,(V+closing(s,o))*20)}
// отдача: импульс снаряда толкает корабль назад и закручивает его, если ствол не на оси центра масс
function recoil(s,m,mkg,vkms,dx,dy){if(!s.T||!s.alive)return;const dl=Math.hypot(dx,dy)||1,P=mkg*vkms*1000,M=Math.max(1,s.T.tons)*1000,dv=P/M/1000;
  s.sx-=dx/dl*dv;s.sy-=dy/dl*dv;
  const L=s.T.L*1000,c=Math.cos(s.hd),sn=Math.sin(s.hd),u=(m&&m.u||0)*L,v=(m&&m.v||0)*L,rx=u*c-v*sn,ry=u*sn+v*c,px=-dx/dl*P,py=-dy/dl*P,I=M*L*L/12;
  s.spin=(s.spin||0)+(rx*py-ry*px)/I}
const classify=sp=>(sp.flak>=sp.rails&&sp.flak>0)?'fr':((sp.L0!=null?sp.L0>=1.6:specTons(sp)>=50000)||sp.rails>=40)?'hc':'dd';
function mkShip(side,sp,x,y){
  sp={...sp,F0:sp.F||0,lasers:0,laserCfg:null,F:0,B:0}; // ракеты вернулись: полёт с бюджетом Δv (misFly) // лазеры отключены; старые «звенья» истребителей заменены кораблями из ангара (join)
  const T={tons:sp.tons||specTons(sp),role:sp.role,n:sp.name,defl:sp.defl||0,arm:sp.arm,eng:Math.max(1,sp.eng||3),spd:sp.spd||1,L:Math.max(0.06,sp.L),dopt:sp.dopt};
  const nc=Math.max(2,Math.round(T.L*1000/4)); // броня: по одной ячейке на метр длины в каждом слое (4 сектора по L/4 колонок)
  const zones=ZN.map((_,zi)=>{const a=Math.min(255,ARMZ[zi===0?'nose':zi===2?'rear':'side']);return {arm:a,nc,cols:new Uint8Array(nc).fill(a),armN:nc*a,mods:[]}}); // броня по зонам: нос толстый (70 см), борта и корма тонкие
  const add=(k,z)=>{const m={k,alive:true,sk:(k==='T'||k==='A'||k==='G')?Math.max(1,Math.min(10,Math.round((sp.sk||5.5)+gauss()*2))):0,cd:R(0,REL),z};zones[z].mods.push(m);return m};
  const tur=[];for(let i=0;i<sp.rails;i++){const m=add('T',i%4);m.cfg=(sp.railCfg&&sp.railCfg[i])||RC0;tur.push(m)}for(let i=0;i<sp.flak;i++){const m=add('A',(i+2)%4);m.cfg=(sp.flakCfg&&sp.flakCfg[i])||FC0;tur.push(m)}
  for(let i=0;i<(sp.gat||0);i++){const m=add('G',(i+1)%4);m.cfg=(sp.gatCfg&&sp.gatCfg[i])||GC0;m.heat=0;m.lock=false;m.acc=0;tur.push(m)}
  for(let i=0;i<(sp.lasers||0);i++){const m=add('L',(i+1)%4);m.cfg=(sp.laserCfg&&sp.laserCfg[i])||LC0;tur.push(m)}
  for(let i=0;i<(sp.miss||0);i++){const m=add('M',(i+3)%4);m.cfg=(sp.missCfg&&sp.missCfg[i])||MC0;m.ammo=m.cfg.ammo;tur.push(m)}
  for(let i=0;i<T.eng;i++)add('E',2);
  const nR=Math.max(4,Math.min(8,2+Math.round(T.L*4))),nD=T.L>.9?2:1;for(let i=0;i<nR;i++)add('R',i%2?0:2);for(let i=0;i<nD;i++)add('D',i?3:1);
  const core=add('C',2),total=sp.rails+sp.flak+(sp.gat||0)+(sp.lasers||0)+(sp.miss||0)+T.eng+nR+nD+1;
  const sh={acc:0,spin:0,trail:sp.trail||null,hv:[[0,1,4],[2,3,0]][side][(rnd()*3)|0],fid:(()=>{const k=side*1e5+(sp.fid||0),n=FCNT.get(k)||0;FCNT.set(k,n+1);return (sp.fid||0)*100+Math.floor(n/FLEET_MAX)})(),side, /* флоты не больше FLEET_MAX кораблей: каждый десяток — свой флот со своим капитаном */cls:sp.cls,T,x,y,vx:0,vy:0,sx:0,sy:0,ax:0,ay:0,next:0,alive:true,nt:0,car:(sp.F+sp.B)>0,hd:side?Math.PI:0,zones,tur,core,total,aliveN:total,engN:T.eng,pool:{ammo:Math.round(((sp.fq&&sp.fq.ammo)||CR_DEF.F.ammo)*.5)*sp.F,torp:sp.B},nextL:0,spec:sp,mag:0,magMax:0,enR:1,z:0,bst:1,lrp:0,srp:0,crew:1,pers:Math.max(20,Math.round(T.tons/40*(sp.role==='freight'?.25:1))),evac:0,abd:0,ldT:0,mor:Math.min(.95,Math.max(.3,.42+.05*(sp.sk||5.5)+R(-.05,.05))),st:'ok',fire:[0,0,0,0],heat:0,ovh:0,hitT:-99,flash:-99,seen:[-99,-99],lock:[-99,-99],rdOn:false,fine:false,trk:[],sc:sp.scList||[{k:'ir',rng:(RADAR[sp.cls]||280)*.8,res:.6},{k:'em',rng:RADAR[sp.cls]||280,res:.6},{k:'rad',rng:(RADAR[sp.cls]||280)*.9,res:1,fine:1}],ch:sp.fcsN!=null?sp.fcsN:({cv:4,hc:8,dd:3,fr:4}[sp.cls]||3),jam:0,blk:0,reps:0,bdo:0,board:null,rad:sp.radar!=null?70+110*Math.min(3,sp.radar):(RADAR[sp.cls]||280),mar:sp.mar||0 /* морпехи только из модуля абордажа (sp.mar); модуля пока нет — абордажа нет */};
  if(side===0&&sh.ch>0)sh.ch+=ta('fcs');
  crewInit(sh,sp);hullInit(sh);sh.home={x,y}; // база — точка входа в бой
  {const tot0=sp.rails+sp.flak+(sp.gat||0)+(sp.lasers||0)+(sp.miss||0)+T.eng+Math.max(4,Math.min(8,2+Math.round(T.L*4)))+(T.L>.9?2:1)+1,ex=sp.kitsM?0:Math.max(0,(sp.kits!=null?sp.kits:kitDefault(tot0))-kitDefault(tot0));if(ex>0)T.tons+=ex*KIT.m} /* у проектов из конструктора масса склада уже в модуле */ // наборы сверх штатного склада — лишние тонны
  sh.acc=accOf(sp,T);sh.raider=sh.acc>=20&&T.tons<=1000&&!sp.role;sh.probe=!!sp.probe;sh.tnk=!!sp.tanker;sh.dec=sp.dec||0; // лёгкий и резвый — перехватчик: кавалерийские наскоки
  {const cons=(sp.rails||0)*2+(sp.gat||0)*5,mx=sp.ammoCap!=null?sp.ammoCap:sp.role==='supply'?Math.round(T.tons*.2):Math.round(cons*1.2);sh.mag=sh.magMax=mx;{let need=0;for(const m of tur){const C=m.cfg||{};if(m.k==='T')need+=(C.ammoH||2)*(C.shells||1);else if(m.k==='G')need+=(C.ammoH||2);else if(m.k==='M')need+=(C.tons||.5)*(C.ammo||6)*3/AMMO_H/1.05}need*=AMMO_H*1.05;if(need>sh.mag)sh.mag=sh.magMax=need} /* погреб — на AMMO_H часов непрерывного боя всеми орудиями */if(sp.fuel!=null&&sp.fuelCap>0){sh.fuel=sp.fuel;sh.fuelCap=sp.fuelCap;sh.fpa=sp.fpa||T.tons;sh.frate=sp.frate!=null?sp.frate:sp.fuelCap*4.2e-9}else{sh.fuelCap=Math.round(T.tons*FUEL.cap);sh.fuel=sh.fuelCap;sh.fpa=T.tons;sh.frate=sh.fuelCap*4.2e-9} // у налётчиков бак по умолчанию
  if(cfgNow&&cfgNow.demo&&sh.fuelCap<T.tons*FUEL.cap*(sh.tnk?0:1)){sh.fuelCap=Math.round(T.tons*FUEL.cap*(sh.tnk?0:1));sh.fuel=sh.fuelCap} /* танкер везёт вчетверо больше */ // демо-флоты: полный бак (доля массы из battle.json → fuel.cap)
   const draw=(sp.railCfg||[]).slice(0,sp.rails||0).reduce((a,q)=>a+((q&&q.draw)||0),0)+(sp.lasers?800:0);sh.enR=sp.energy!=null&&draw>0?Math.max(.1,Math.min(1,sp.energy/draw)):1}
  for(const m of tur){if(m.k==='L')sh.lrp+=m.cfg.dmg*Math.min(300,m.cfg.rng)/100*.5;else if(m.k==='M')sh.lrp+=m.cfg.dmg*.8*m.cfg.ammo/8;else if(m.k==='T')sh.srp+=m.cfg.dmg*m.cfg.shells}
  sh.lrR=Math.max(0,...tur.filter(m=>m.k==='L').map(m=>Math.min(300,m.cfg.rng)));
  zones.forEach((z,zi)=>{const ms=z.mods.filter(m=>m.k!=='C'),n=ms.length;ms.forEach((m,i)=>{
    const cn=Math.min(n,zi===0||zi===2?7:12),row=Math.floor(i/cn),col=i%cn,nr=Math.ceil(n/cn),cc=Math.min(cn,n-row*cn);
    if(zi===0){m.u=.2+.07*(nr-1-row)+.04*(col%2);m.v=(col-(cc-1)/2)*Math.min(.12,.7/cc)}
    else if(zi===2){m.u=-.42+.07*row;m.v=(col-(cc-1)/2)*Math.min(.12,.7/cc)}
    else{m.u=-.3+.6*(col+.5)/cc;m.v=(zi===1?1:-1)*(.1+.08*row)}});});
  core.u=-.36;core.v=0; // реактор глубоко в корме, у двигателей
  {let ci=0;for(const z of zones)for(const m of z.mods)if(m.k==='T'||m.k==='A'||m.k==='G'||m.k==='L'||m.k==='M')m.face=[0,0,1,3,0,2,1,3,0,2][ci++%10]} // стороны башен: верх/правый/низ/левый
  sh.roll=0;sh.rollT=0;sh.pOff=0;sh.pNext=0;sh.uid=uidN++;sh.rcs0=sh.rcsN=nR;sh.rad0=sh.radN=nD;sh.trn=0;
  {const ar=Math.min(3,Math.floor(T.arm/3));for(const z of zones)for(const m of z.mods){if('TALMRDG'.includes(m.k))m.ar=ar;if(m.k==='T')m.am=Math.ceil(7200/(60*((m.cfg&&m.cfg.rel)||1)*.85))+10;else if(m.k==='A')m.am=50}} /* боезапас башни — на 2 часа непрерывной стрельбы */ // у внешних модулей своя броня, у орудий — боезапас
  zones.forEach((z,zi)=>{for(const m of z.mods){m.id=++MODID;m.loc={zone:zi,face:m.face??null,u:m.u??null,v:m.v??null,ti:sh.tur?sh.tur.indexOf(m):-1}}}); // устойчивый id модуля (сквозной счётчик, не индекс) и его место на корпусе: зона, сторона башни, положение по длине u и вбок v, номер в списке башен — для графики
  const cand=[];for(const z of zones)for(const m of z.mods)if(m.k!=='C')cand.push(m);
  const kill=Math.floor((sp.dmg||0)*(total-1));
  for(let i=0;i<kill&&cand.length;i++){const m=cand.splice((rnd()*cand.length)|0,1)[0];m.alive=false;sh.aliveN--;if(m.k==='E')sh.engN--;else if(m.k==='R')sh.rcsN--;else if(m.k==='D')sh.radN--}
  return sh;
}
const FORMS=['wedge','claw','x','sphere'];
// тепло (таблица «Корабли (система)»): теплоёмкость корпуса 0,5 МДж на т на °C; s.heat = °C выше нормы / 100 (выше +100 °C — сбои)
const HEAT=gd('battle','heat',{engK:20,water:.02,evapAt:.6,evapR:.5,safe:1.5,hull:.1,low:.1,hot:.9,ok:.3,coolV:.15,pas:.4,base:2,irEng:10,irHull:.05,irRad:1,irVap:300,irShot:5,irN:20}); // engK МДж на т·(км/с); water — доля массы; hull — доля радиаторов при убранных панелях; low/hot/ok — пороги ухода и возврата; ir* — вклад в ИК-сигнатуру
const HUNT=gd('battle','hunt',{r:400,cool:4,rad:2,sup:3});
function addHeat(s,MJ){const T=Math.max(1,(s.T&&s.T.tons)||(s.spec&&s.spec.tons)||1000);s.heat=Math.max(0,s.heat+MJ/(.5*T)/100)}
// ОТРЫВ БАШНИ (только для отображения, на бой не влияет): крепление срезано, если удар, выбивший модуль башни, принёс энергии не меньше DET.e на кг массы башни.
// Попадание: E = ½·m·v² снаряда относительно корабля, башня получает импульс снаряда (Δv = m·v / M, неупругий удар). Таран: башня в зоне смятия — ½·M·vr², получает скорость сближения.
const DET=gd('battle','detach',{e:5000}); // Дж/кг — сколько энергии на килограмм башни нужно, чтобы сорвать её с крепления
let DCTX=null,detaches=[],detN=0;
const turMassT=m=>{const c=m.cfg||{};return m.k==='T'?((RAIL_CAL[c.cal||10]||RAIL_CAL[10]).m*(1+1.03*((c.bar||1)-1))*1.25):m.k==='A'?110:m.k==='G'?160:m.k==='M'?320:m.k==='L'?200:0}; // т, как у моделей башен
function detChk(s,m){const C=DCTX;if(!C||!'TAGML'.includes(m.k)||!s.T)return;const M=turMassT(m)*1000;if(!(M>0))return;let dx,dy,dz;
  let E;if(C.ram){dx=C.nx*C.vr;dy=C.ny*C.vr;dz=0;E=.5*M*(C.vr*1000)**2}else{const vl=Math.hypot(C.vx,C.vy,C.vz)||1e-9;if(vl>50||!(C.mp>0))return; /* скорость удара вне физики снарядов (>50 км/с) или масса неизвестна — без отрыва */const dv=C.mp*vl/(C.mp+M);dx=C.vx/vl*dv;dy=C.vy/vl*dv;dz=C.vz/vl*dv;E=.5*C.mp*(vl*1000)**2}
  if(E<M*DET.e)return;
  m.wreck=1;detaches.push({id:++detN,s,m,cause:C.ram?"ram":C.k,t,x:s.x,y:s.y,z:s.z||0,hd:s.hd||0,sx:s.sx||0,sy:s.sy||0,w:s.w||0,dv:[dx,dy,dz]})}
// КОНСТРУКТИВНЫЕ СЕКЦИИ (спонсоны, палубы; дальше — двигательные блоки, радиаторы): своя структурная прочность, отдельно от брони. Только для отображения, на бой не влияет.
// Секцию регистрирует графика (где она: зоны борта, участок по длине u0…u1, объём); масса = объём × заполнение × плотность стали. Каждое попадание/таран в её зону и участок
// добавляет энергию удара (½·m·v²) — с весом зоны; 25/50/75% от массы × STR.e — событие повреждения, 100% — отрыв (один раз). Импульс удара → добавочная скорость секции.
const STR=gd('battle','struct',{e:5000,fill:.2,rho:7800}); // Дж/кг до разрушения крепления секции (как у башен, DET.e); доля металла в объёме; плотность, кг/м³
let structs=new Map(),strEv=[],strN=0;
function attachStructure(uid,q){let L=structs.get(uid);if(!L)structs.set(uid,L=[]);if(L.some(z=>z.id===q.id))return;L.push({id:q.id,zones:q.zones,w:q.w||{},u0:q.u0,u1:q.u1,mass:Math.max(1,q.vol*STR.fill*STR.rho),E:0,step:0,gone:false})}
function strHit(o,x,y,E,cause,jx,jy){const L=o&&structs.get(o.uid);if(!L||!(E>0)||!o.T)return;const zi=zoneTo(o,x,y),c=Math.cos(o.hd||0),sn=Math.sin(o.hd||0),u=((x-o.x)*c+(y-o.y)*sn)/Math.max(1e-6,o.T.L);
  for(const q of L){if(q.gone||!q.zones.includes(zi)||u<q.u0||u>q.u1)continue;const k=q.w[zi]!=null?q.w[zi]:1;q.E+=E*k;const fr=q.E/(q.mass*STR.e),st=Math.min(3,Math.floor(fr*4));
    if(fr<1&&st>q.step){q.step=st;strEv.push({id:++strN,type:'section_damage',s:o,sec:q.id,frac:st/4,cause,t})}
    if(fr>=1){q.gone=true;strEv.push({id:++strN,type:'section_detach',s:o,sec:q.id,cause,t,x:o.x,y:o.y,z:o.z||0,hd:o.hd||0,sx:o.sx||0,sy:o.sy||0,w:o.w||0,dv:[jx*k/q.mass/1000,jy*k/q.mass/1000,0]})}}} // dv — км/с
function mdead(s,m){if(!m.alive)return;detChk(s,m);m.alive=false;s.aliveN--;if(m.k==='E')s.engN--;else if(m.k==='R')s.rcsN--;else if(m.k==='D')s.radN--}
function mrev(s,m){m.alive=true;s.aliveN++;if(m.k==='E')s.engN++;else if(m.k==='R')s.rcsN++;else if(m.k==='D')s.radN++}
function addFlights(sh,ty,total){
  const q=sh.spec[ty==='F'?'fq':'bq'],D=CR_DEF[ty],P=Object.assign({},ty==='F'?FI:BO);{const g=k=>q&&Number.isFinite(q[k])?q[k]:D[k];P.hp=g('hp');P.vmax=g('vmax');P.a=g('a');P.fuel=g('fuel');P.ammo=g('ammo');P.ng=g('ng');P.dmg=g('dmg');P.cd=g('cd');P.gun=g('gun')||P.gun;P.mass=g('mass');P.trail=q&&q.trail||null;P.eng=q&&q.eng||2;P.arm=q&&q.arm||0;P.mk=ty==='F'?P.eng+'-'+(P.ng||2)+'-'+Math.min(8,Math.round(P.arm/2))+'-'+(P.fuel>1500?1:0):''}
  const per=ty==='F'?10:5,nfl=Math.ceil(total/per);let left=total;const f0=(sh.uid||0)%4;
  for(let f=0;f<nfl;f++){const n=Math.min(per,left);left-=n;
    const fl={side:sh.side,type:ty,home:sh,cr:[],mode:'bay',svc:0,t0:0,leader:null,lane:(f-(nfl-1)/2)*(ty==='F'?18:30),form:ty==='F'?FORMS[(f+f0)%4]:'wedge',a0:rnd()*6.283,lost:0,broken:false};
    for(let k=0;k<n;k++){const c={side:sh.side,type:ty,fl,home:sh,own:sh,x:sh.x,y:sh.y,vx:0,vy:0,h:sh.side?Math.PI:0,P,hp:P.hp,ammo:ty==='F'?P.ammo:1,fuel:P.fuel,
      ms:sh.spec.fmis&&ty==='F'?sh.spec.fmis.n:0,mk:sh.spec.fmis&&sh.spec.fmis.k,state:'bay',launched:false,launchAt:0,ret:false,cd:R(0,.5),jx:0,jy:0,jt:0,tg:null,goal:null,sh:null,slot:k,eng:-99,tr:[],trT:0,na:0};fl.cr.push(c);air.push(c)}
    flights.push(fl)}
}
function launchBay(s){ // выпуск одного корабля из ангара: сбоку от носителя, с его скоростью, в его флоте
  const cs={...s.bay.shift(),fid:s.fid};fitSpec(cs);cs.cls=classify(cs);cs.dopt=cs.dopt0||DOPT[cs.cls];
  const a=s.hd+(rnd()<.5?1:-1)*Math.PI/2,off=s.T.L*.6+.05,c=mkShip(s.side,cs,s.x+Math.cos(a)*off,s.y+Math.sin(a)*off);
  c.hd=s.hd;c.sx=s.sx+Math.cos(a)*.02;c.sy=s.sy+Math.sin(a)*.02;c.z=s.z;c.zset=1;c.bayOf=s;c.F=s.F;c.slotBack=s.slotBack||0;c.slotLat=s.slotLat||0;ships.push(c);s.bayT=t+3;stat.launch=(stat.launch||0)+1}
function reset(cfg){simAcc=0;pdQ=[];RS=((cfg&&cfg.seed!=null)?cfg.seed:Math.floor(Math.random()*4294967296))>>>0;
  tracers.length=0;flakS=[];shuttles=[];lasBeams=[];hadContact=false;hitLog=[];impacts=[];detaches=[];structs=new Map();strEv=[];sepT=0;lastDmgT=0;lastNa=0;lastNaT=0;frags=[];pyro=[];pods=[];lands=[];ships=[];FL=new Map();GR=[new Map(),new Map()];smoke=[];proj=[];mis=[];beams=[];bursts=[];fx=[];flights=[];air=[];torps=[];shots=[];fly=[[],[]];t=0;lastEng=-99;nextVis=0;nextCrew=0;lastCrewT=0;endSaid=false;ORD={st:null,focus:null};env=[];CMDS=[{},{}];FCNT=new Map();
  if(cfg.envList)for(const e of cfg.envList)env.push(Object.assign({vx:0,vy:0,ttl:1e9},e));
  if(!cfg.envList&&cfg.env!==false&&(cfg.env||rnd()<.55)){const cl=1+((rnd()*2)|0);for(let c=0;c<cl;c++){const cx0=R(-220,220),cy0=R(-200,200),n=4+((rnd()*8)|0);for(let i=0;i<n;i++)env.push({t:'rock',x:cx0+R(-70,70),y:cy0+R(-60,60),r:R(.6,3),vx:0,vy:0,ttl:1e9})}
    if(rnd()<.35)env.push({t:'planet',x:R(-120,120),y:(rnd()<.5?-1:1)*R(120,230),r:R(10,22),vx:0,vy:0,ttl:1e9})}
  sel=null;done=false;pend=(cfg.late||[]).map(x=>({...x}));lastFriend=0;
  stat={las:[0,0],lasHit:[0,0],mis:[0,0],misHit:[0,0],misShot:[0,0],bfail:[0,0],shots:[0,0],hits:[0,0],torp:[0,0],torpHit:[0,0],torpPd:[0,0],flak:[0,0],flakKill:[0,0],lostF:[0,0],lostB:[0,0],cap:[0,0],surr:[0,0],fires:0,rep:0,lost:[0,0],blk:0,ovh:0,rock:0,decoy:0};
  const X={dd:8,hc:2,fr:-4,cv:-12};
  cfg.fleets.forEach((list,side)=>{
    const dir=side?-1:1;
    for(const sp of list){fitSpec(sp);sp.cls=classify(sp);sp.dopt=sp.dopt0||DOPT[sp.cls]}
    for(const cl of ['dd','hc','fr','cv']){const grp=list.filter(sp=>sp.cls===cl);
      grp.forEach((sp,i)=>{const sh=mkShip(side,sp,(side?500:-500)+dir*X[cl],(i-(grp.length-1)/2)*8);ships.push(sh);
        if(sh.car){if(sp.F>0)addFlights(sh,'F',sp.F);if(sp.B>0)addFlights(sh,'B',sp.B)}})}
  });
}
/* ===== ИИ ФЛОТОВ: ===== */
const CS=16,VMK=2.4,VAL={cv:3,hc:2.5,dd:1.2,fr:1};
let GR=[new Map(),new Map()],GF=[new Map(),new Map()],GL=[[],[]],FL=new Map();const CSF=1.5;
const ckey=(cx,cy)=>cx*8192+cy;
function buildGrids(){
  GR=[new Map(),new Map()];GF=[new Map(),new Map()];GL=[[],[]]; // GF — мелкая сетка 4 км для расталкивания: в плотном строю 300 кораблей не лезут в одну клетку
  for(const s of ships){if(!s.alive)continue;const k=ckey(Math.floor(s.x/CS),Math.floor(s.y/CS)),g=GR[s.side];let a=g.get(k);if(!a)g.set(k,a=[]);a.push(s);GL[s.side].push(s);const k2=ckey(Math.floor(s.x/CSF),Math.floor(s.y/CSF)),g2=GF[s.side];let b=g2.get(k2);if(!b)g2.set(k2,b=[]);b.push(s)}
}
// ближайший корабль стороны side (поиск по кольцам ячеек)
let nsT=-1,nsC=new Map();
function nearestShip(x,y,side){ // кэш на такт по крупной ячейке: сотни звеньев и бомбардировщиков не гоняют спиральный поиск каждый раз
  if(nsT!==t){nsT=t;nsC.clear()}const kk=side*1e9+Math.floor(x/48)*1e4+Math.floor(y/48),hit=nsC.get(kk);if(hit!==undefined&&(hit===null||hit.s.alive)){return hit?{s:hit.s,d:Math.hypot(hit.s.x-x,hit.s.y-y)}:null}
  const r0=nearestShip0(x,y,side);nsC.set(kk,r0);return r0}
function nearestShip0(x,y,side){
  const g=GR[side];if(!g.size)return null;const cx=Math.floor(x/CS),cy=Math.floor(y/CS);let b=null,bd=1e18;
  const scan=(i,j)=>{const a=g.get(ckey(cx+i,cy+j));if(!a)return;for(const o of a){const d=(o.x-x)*(o.x-x)+(o.y-y)*(o.y-y);if(d<bd){bd=d;b=o}}};
  for(let r=0;r<48;r++){
    if(b&&(r-1)*CS>Math.sqrt(bd))break;
    if(r===0)scan(0,0);else for(let i=-r;i<=r;i++){scan(i,-r);scan(i,r);if(i>-r&&i<r){scan(-r,i);scan(r,i)}}
  }
  if(!b){for(const o of ships){if(!o.alive||o.side!==side)continue;const d=(o.x-x)*(o.x-x)+(o.y-y)*(o.y-y);if(d<bd){bd=d;b=o}}}
  return b?{s:b,d:Math.sqrt(bd)}:null;
}
function around(side,x,y,rad,max=1e9){ // корабли стороны в радиусе (малый радиус — по мелкой сетке); max — не больше стольких ближайших (клетки по кольцам от центра)
  const F=rad<=8,cs=F?CSF:CS,g=F?GF[side]:GR[side],out=[],n=Math.ceil(rad/cs),cx=Math.floor(x/cs),cy=Math.floor(y/cs),r2=rad*rad;
  if(max>=1e9&&(2*n+1)*(2*n+1)>GL[side].length*.5){const L=GL[side];for(let i=0;i<L.length;i++){const o=L[i];if((o.x-x)*(o.x-x)+(o.y-y)*(o.y-y)<=r2)out.push(o)}return out} // большой радиус: дешевле пройти список стороны, чем сотни пустых клеток
  const cell=(i,j)=>{const a=g.get(ckey(cx+i,cy+j));if(!a)return;for(const o of a)if((o.x-x)*(o.x-x)+(o.y-y)*(o.y-y)<=r2)out.push(o)};
  for(let r=0;r<=n&&out.length<max;r++){if(!r){cell(0,0);continue}for(let i=-r;i<=r;i++){cell(i,-r);cell(i,r)}for(let j=-r+1;j<r;j++){cell(-r,j);cell(r,j)}}
  return out;
}
const hpf=s=>s.aliveN/s.total,PW=12;
// ===== ВНУТРЕННИЕ ПОВРЕЖДЕНИЯ: экипаж по отсекам, обслуживание систем, погреба и детонации, разгерметизация, состояния боеспособности =====
// Отсек = зона корабля (нос, борта, корма) с её модулями — та же структура, что у брони и модулей (без параллельной модели).
// Экипаж — группы «отсек × специальность»: расчёты орудий и систем привязаны к своему модулю, командование — в носу, аварийные и жилые — по всем отсекам.
const CREW=gd('battle','crew',{T:6,G:2,A:2,M:4,L:4,E:3,R:1,D:3,C:6,cmd:.06,spare:1.25,glob:.25,vacKill:.12,vacEff:.7}); // люди на модуль; доля командования; запас сверх нужного; ниже glob·экипажа — всё работает хуже; разгерметизация: гибель и эффективность в скафандрах
const MAG=gd('battle','magazine',{vol:.1,x0:3,k0:.1,k1:.15,mj:50,y:1.5,adj:.5,cy:4,kill:5,rail:.05,gat:.25,mis:1}); // vol — доля пробитий, задевающих погреб; x0 — т тротил. экв., при которых склад почти наверняка сдетонирует от прямого поражения; k0/k1 — тяжесть по выбитым модулям; mj — МДж удара для полной вероятности; y — модулей на т экв. в отсеке, adj — в соседних; cy — т экв. для цепной детонации; kill — т экв. на 1000 т корпуса, разрушающих корабль; взрывоопасность боеприпасов: рельсовые болванки, патроны, ракеты
function crewInit(sh,sp){const g=[];let need=0;for(const z of sh.zones)for(const m of z.mods){const n=CREW[m.k]||0;if(n>0){const q={zi:m.z,sp:{T:'рельсотрон',G:'картечница',A:'зенитка',M:'ракеты',L:'лазер',E:'двигатель',R:'маневровые',D:'сенсоры',C:'реактор'}[m.k],m,n0:n,n};m.cg=q;g.push(q);need+=n}}
  const cmd=Math.max(2,Math.round(need*CREW.cmd));need+=cmd;const tot=sp.crew!=null?Math.max(need*.5,sp.crew):Math.max(sh.pers||0,Math.round(need*CREW.spare));g.push({zi:0,sp:'командование',m:null,n0:cmd,n:cmd,cmd:1});
  const rest=Math.max(0,Math.round(tot-need-cmd*0));for(let zi=0;zi<4;zi++){const n=Math.round(rest/4);if(n>0)g.push({zi,sp:'аварийные и жилые',m:null,n0:n,n})}
  sh.cg=g;sh.pers0=g.reduce((a,q)=>a+q.n0,0);sh.pers=sh.pers0;sh.crN=sh.pers0;sh.crew=1;sh.vac=[0,0,0,0];sh.dead={};
  const st=stat.crw=stat.crw||{n0:[0,0],dead:{},zone:[0,0,0,0],det:0,chain:0,detDead:0,detKill:0,vac:0,fire:0,derelict:[],ooa:[],sys:{}};st.n0[sh.side]+=sh.pers0}
function crewSync(o){let n=0;for(const q of o.cg)n+=q.n;o.crN=n;o.crew=o.pers0?n/o.pers0:0}
function crewKill(o,zi,L,cause,focus){if(!o.cg||!(L>0))return 0;let d=0;const st=stat.crw;for(const q of o.cg){if(q.zi!==zi||q.n<=0)continue;const p=Math.min(.95,L*(focus&&focus.includes(q.m)?2.5:q.m?1:.6));const k=Math.min(q.n,Math.floor(q.n*p+rnd()));if(k>0){q.n-=k;d+=k}}
  if(d>0){crewSync(o);o.dead[cause]=(o.dead[cause]||0)+d;if(st){st.dead[cause]=(st.dead[cause]||0)+d;st.zone[zi]+=d;if(cause==='детонация')st.detDead+=d}o.mor-=d/Math.max(1,o.pers0)*.5}return d}
function crewScale(o,f){if(!o.cg)return 0;const n0=o.crN;for(const q of o.cg)q.n=Math.floor(q.n*f);crewSync(o);return n0-o.crN} // эвакуация/пересадка — люди уходят, не гибнут
// эффективность модуля: жив, его расчёт (не меньше 1 человека), отсек (в вакууме — в скафандрах), весь экипаж (меньше glob — корабль не обслужить)
function modEff(s,m){if(!m.alive)return 0;const pw=power(s,m.k)*(m.q||1);if(pw<=0)return 0;const q=m.cg;if(!q)return pw;if(q.n<=0)return 0;return pw*modEff0(s,m,q)}
function modEff0(s,m,q){const f=q.n/q.n0;return Math.min(1,.2+.8*f)*(s.vac&&s.vac[q.zi]?CREW.vacEff:1)*Math.min(1,s.crN/Math.max(1,CREW.glob*s.pers0))}
function sysEff(s,k){let e=0,n=0;for(const z of s.zones)for(const m of z.mods)if(m.k===k){n++;e+=modEff(s,m)}return n?e/n:1}
function cmdEff(s){if(!s.cg)return 1;const q=s.cg.find(g=>g.cmd);const f=q?q.n/q.n0:1;return f>0?Math.min(1,.3+.7*f):s.crN>0?.25:0} // без мостика управляют из других отсеков, но хуже
function weapEff(s){let e=0,n=0;for(const m of s.tur){n++;e+=modEff(s,m)}return n?e/n:0}
// погреб отсека: т боеприпасов (доля общего погреба по орудиям отсека) и т тротил. экв. (болванки почти инертны, патроны и ракеты — взрывоопасны)
function zoneAmmo(s,zi){let wT=0,wG=0,WT=0,WG=0,mx=0;for(const m of s.tur){const w=m.k==='T'?2:m.k==='G'||m.k==='A'?5:0;if(m.k==='T'){WT+=w;if(m.z===zi)wT+=w}else if(w){WG+=w;if(m.z===zi)wG+=w}if(m.k==='M'&&m.z===zi)mx+=(m.ammo||0)*((m.cfg&&m.cfg.tons)||.5)}
  const W=WT+WG,a=W?s.mag*(wT+wG)/W:0,x=W?s.mag*(wT*MAG.rail+wG*MAG.gat)/W:0;return {t:a,x:x+mx*MAG.mis,mis:mx}}
function detonate(o,zi,depth,cause,Y0){if(!o.alive)return;const A=zoneAmmo(o,zi);if(A.x<=1e-3)return;const Y=Y0!=null?Y0:A.x*(.6+.4*rnd()),st=stat.crw;
  st.det++;if(depth>0)st.chain++;o.dets=(o.dets||0)+1;(o.detLog=o.detLog||[]).push({t,zi,Y:+Y.toFixed(1),cause,chain:depth});
  // запас ушёл: доля погреба отсека и ракеты в его пусковых
  {const W=o.mag>0?A.t:0;o.mag=Math.max(0,o.mag-W);for(const m of o.tur)if(m.k==='M'&&m.z===zi)m.ammo=0}
  const a=o.hd+[0,Math.PI/2,Math.PI,-Math.PI/2][zi],ex=Math.cos(a),ey=Math.sin(a),px=o.x+ex*o.T.L*.35,py=o.y+ey*o.T.L*.35;
  fx.push({z:o.z,x:px,y:py,t0:t,d:10+Math.min(20,Y),r:Math.max(1.5,o.T.L*(1+Math.min(3,Y/10))),big:1});SFX.boom(Math.min(30,8+Y));
  const C0=DCTX;DCTX={k:'детонация',vx:ex*2,vy:ey*2,vz:0,mp:Math.max(50,Y*400)};
  try{ // отсек: модули, люди, броня изнутри, пожар; соседние — слабее; секции корпуса получают энергию взрыва (могут оторваться)
    const kill=(z,n)=>{const al=o.zones[z].mods.filter(m=>m.alive&&(m.k!=='C'||n>3));for(let i=0;i<Math.min(al.length,n);i++){const m=al.splice((rnd()*al.length)|0,1)[0];mdead(o,m);m.wreck=1;(st.sys[m.k]=st.sys[m.k]||{lost:0}).lost++}};
    kill(zi,Math.round(1+Y*MAG.y));const nb=[(zi+1)%4,(zi+3)%4];for(const z of nb)kill(z,Math.round(Y*MAG.adj));
    crewKill(o,zi,Math.min(.95,.35+.12*Y),'детонация');for(const z of nb)crewKill(o,z,Math.min(.6,.08*Y),'детонация');
    {const z=o.zones[zi],ly=Math.round(Math.min(40,Y*3));for(let c=0;c<z.nc;c++){const k=Math.min(z.cols[c],ly);z.cols[c]-=k;z.armN-=k}}
    if(!o.vac[zi])o.fire[zi]=3;for(const z of nb)if(!o.vac[z])o.fire[z]=Math.min(3,o.fire[z]+1);
    if(!o.vac[zi]){o.vac[zi]=1;st.vac++}
    if(structs.size)strHit(o,px,py,Y*4.2e9*.05,'детонация',ex*Y*1e5,ey*Y*1e5);
    o.mor-=.15+.02*Y;say(o.side,'mod',o);hullHit(o,zi,HST.det*Y,'детонация');for(const z of nb)hullHit(o,z,HST.detAdj*Y,'детонация')}finally{DCTX=C0}
  o.detY=(o.detY||0)+Y;if(o.alive&&o.detY>MAG.kill*o.T.tons/1000){st.detKill++;kill(o,'детонация погреба');return}
  if(depth<3)for(const z of [(zi+1)%4,(zi+3)%4]){const B=zoneAmmo(o,z);if(B.x>0&&rnd()<(1-Math.exp(-Y/MAG.cy))*(1-Math.exp(-B.x/MAG.x0)))detonate(o,z,depth+1,'цепная детонация')}
}
// ===== КОРПУС И БОРЬБА ЗА ЖИВУЧЕСТЬ =====
// Корпус: у каждого отсека (зоны) — прочность набора (100 ед.). Её снимают пробития (по тяжести и энергии), детонации, пожары, взрывы орудий; броня, остановившая удар, набор бережёт.
// Отсек с нулевой прочностью — разрушен (модули в нём уничтожены, люди гибнут, секции корпуса отрываются). Корабль физически уничтожен, когда разрушены два соседних отсека
// или прочность всего корпуса < HST.min. Выбитые модули сами по себе корабль не уничтожают. Прочность корпуса в бою не восстанавливается.
const HST=gd('battle','hull',{pen:4,penK:5,mj:500,det:12,detAdj:4,fire:.02,gun:15,min:.25,brk:.8}); // ед. за пробитие + за каждый выбитый модуль (× энергия/mj, 0,5…1,5); детонация на т экв. (свой и соседние отсеки); пожар в с на уровень; взрыв орудия; порог гибели; гибель людей в разрушенном отсеке
// Ремонт: люди без поста (аварийные, жилые) и расчёты выбитых модулей; один человек — одна задача. Работа — человеко-секунды; скорость × организация (командование) × условия отсека (вакуум 0,5, пожар — только тушение) × под огнём 0,6.
// Уничтоженный (не просто выведенный из строя) модуль восстанавливается только из ремонтного запаса (spares на корабль) и вдвое дольше; восстановленный работает хуже (q).
const DCN=gd('battle','dcon',{fw:60,vw:300,team:2,under:.6,vacW:.5,adj:.6,fireKill:.0006,qFix:.8,qWreck:.6,wreckP:.3,W:{T:6000,G:2000,A:2000,M:4000,L:4000,E:6000,R:1200,D:3000,C:9000},fixMax:2});
// РЕМОНТНЫЕ НАБОРЫ: склад на корабле (вместимость и загрузка — из проекта: spec.kitCap/spec.kits; по умолчанию — штатный склад kitDef наборов на модуль),
// масса набора KIT.m т; наборы сверх штатного утяжеляют корабль (KIT.m т каждый — меньше ускорение). Расход — по мере работы: модуль стоит KIT.cost[k] наборов
// (уничтоженный — ×wreckK, обслуживание живого — ×srvK); работа без наборов не идёт, прерванная — сохраняет сделанное (и потраченное). В бою наборы не появляются.
const KIT=gd('battle','kits',{dock:3,dv:.05,rate:6,m:.5,def:1,cap:1.5,wreckK:2,srvK:.3,low:.3,cost:{T:3,G:1,A:1,M:2,L:2,E:3,R:1,D:2,C:5}});
function kitDefault(total){return Math.round(total*KIT.def)}
function hullInit(sh){for(const z of sh.zones){z.sp0=100;z.sp=100;z.brk=0}sh.hullF=1;const sp=sh.spec||{},def=kitDefault(sh.total);
  sh.kitCap=sp.kitCap!=null?sp.kitCap:Math.round(def*KIT.cap);sh.kits0=Math.min(sh.kitCap,sp.kits!=null?sp.kits:def);sh.kits=sh.kits0;sh.kitUsed=0;sh.dcT=[];sh.dcWhy='';
  const st=stat.crw;if(st){st.kits0=(st.kits0||[0,0]);st.kits0[sh.side]+=sh.kits0}}
function hullHit(o,zi,d,cause){if(!o.alive||!(d>0)||!o.zones[zi]||o.zones[zi].sp==null)return;const z=o.zones[zi];z.sp=Math.max(0,z.sp-d);let a=0,b=0;for(const q of o.zones){a+=q.sp;b+=q.sp0}o.hullF=a/b;
  if(z.sp<=0&&!z.brk){z.brk=1;const st=stat.crw;if(st)st.brk=(st.brk||0)+1;for(const m of z.mods){if(m.alive)mdead(o,m);m.wreck=1;if(m.kres>0){o.kits+=m.kres;m.kres=0;m.rp=0}} /* работы в разрушенном отсеке отменены: неизрасходованные наборы — обратно на склад */crewKill(o,zi,HST.brk,'разрушение отсека');o.fire[zi]=0;o.vac[zi]=1;
    const a2=o.hd+[0,Math.PI/2,Math.PI,-Math.PI/2][zi];fx.push({z:o.z,x:o.x+Math.cos(a2)*o.T.L*.4,y:o.y+Math.sin(a2)*o.T.L*.4,t0:t,d:12,r:o.T.L*1.2,big:1});if(structs.size)strHit(o,o.x+Math.cos(a2)*o.T.L*.4,o.y+Math.sin(a2)*o.T.L*.4,1e13,'разрушение отсека',0,0)}
  const br=o.zones.map(q=>q.brk);if(br.some((v,i)=>v&&br[(i+1)%4]))kill(o,'корпус разломан: два соседних отсека разрушены ('+cause+')');else if(o.hullF<HST.min)kill(o,'корпус разрушен ('+cause+')')}
// питание: реактор выбит — оружию и двигателям нечем работать (картечницы, сенсоры и маневровые — частично от батарей)
const PWR={T:0,M:0,L:0,E:0,G:.3,A:.3,D:.3,R:.5};function power(s,k){return s.core&&s.core.alive?1:(PWR[k]??1)}
// БОРЬБА ЗА ЖИВУЧЕСТЬ (раз в секунду): задачи с приоритетом по обстановке, люди по отсекам, одна задача на человека
// ПЕРЕДАЧА РЕМОНТНЫХ НАБОРОВ: ремонтник рядом с союзником (≤ KIT.dock км, относительная скорость ≤ KIT.dv км/с) передаёт наборы со скоростью KIT.rate в минуту,
// оставляя себе KIT.low своего запаса; принять может только корабль со складом и только в пределах его вместимости. Наборы не создаются — только перемещаются
function kitXfer(dc){for(const q of ships){if(!q.alive||q.role!=='ремонт'||!q.rpTg||!q.rpTg.alive)continue;const a=q.rpTg;if(Math.hypot(a.x-q.x,a.y-q.y)>KIT.dock||Math.hypot((a.sx||0)-(q.sx||0),(a.sy||0)-(q.sy||0))>KIT.dv)continue;
  const give=Math.min(KIT.rate*dc/60,q.kits-KIT.low*q.kits0,Math.max(0,a.kitCap-a.kits));if(give<=1e-6)continue;q.kits-=give;a.kits+=give;const C=stat.fc=stat.fc||{};C.cov=C.cov||{};C.cov.xfer=(C.cov.xfer||0)+give}}
function damageControl(s,dc){const _d0=performance.now();try{return damageControl0(s,dc)}finally{PERF.dc+=performance.now()-_d0}}
function damageControl0(s,dc){if(!s.cg||s.derelict||s.crN<=0){s.dcT=[];return}const org=cmdEff(s),under=t-s.hitT<20,fl=!!s.flee,st=stat.crw,zf=zi=>s.fire[zi]>0,vacF=zi=>s.vac[zi]?DCN.vacW:1;
  const pool=[0,0,0,0];for(const q of s.cg){if(q.n<=0)continue;if(!q.m||(!q.cmd&&!q.m.alive))if(!q.cmd)pool[q.zi]+=q.n}
  const cap=s.capW??1,eng=s.capE??1,near=!!(s.tg&&s.tg.alive&&Math.hypot(s.tg.x-s.x,s.tg.y-s.y)<(s.tg.maxR||60)*1.5);
  const tasks=[];for(let zi=0;zi<4;zi++){if(s.zones[zi].brk)continue;const A=zoneAmmo(s,zi);if(zf(zi))tasks.push({k:'fire',zi,p:100+10*s.fire[zi]+(A.x>0?50:0),need:4*s.fire[zi]});else if(s.vac[zi])tasks.push({k:'vac',zi,p:60,need:4})}
  const base={C:58,R:55,E:50,D:30,T:35,M:35,G:30,A:30,L:30};let noSp=0;
  for(const z of s.zones)for(const m of z.mods){if(m.alive&&(m.q||1)>=1)continue;if(z.brk)continue;let p=(base[m.k]||25)-(m.alive?25:0);
    if(m.k==='E'&&(under||fl)&&eng<.3)p+=20;if(m.k==='R'&&fl)p+=10;if('TGAML'.includes(m.k)){if(fl)p-=15;else if(cap<.2&&near)p+=15}const Cm=(KIT.cost[m.k]||1)*(m.wreck?KIT.wreckK:1)*(m.alive?KIT.srvK:1);if(!(m.kres>0)&&s.kits<Cm-1e-9){noSp++;continue}if(m.alive&&s.kits<KIT.low*s.kits0&&!(m.kres>0))continue; /* наборов мало — мелкое обслуживание откладываем, бережём на выбитое */
    tasks.push({k:'mod',zi:m.z,m,p,need:Math.max(2,(CREW[m.k]||2)*DCN.team)})}
  tasks.sort((a,b)=>b.p-a.p);const left=[...pool],out=[];
  for(const q of tasks){if(q.k!=='fire'&&zf(q.zi))continue;let w=Math.min(left[q.zi],q.need);left[q.zi]-=w;let w2=0;for(const z of [(q.zi+1)%4,(q.zi+3)%4]){if(w+w2>=q.need)break;if(zf(z)&&q.k!=='fire')continue;const g=Math.min(left[z],q.need-w-w2);left[z]-=g;w2+=g}
    const work=(w+w2*DCN.adj)*org*vacF(q.zi)*(under?DCN.under:1)*dc;if(work<=0){out.push({...q,w:0});continue}
    if(q.k==='fire'){const z=s.zones[q.zi];z.fw=(z.fw||0)+work;if(z.fw>=DCN.fw){z.fw=0;s.fire[q.zi]--;if(st){st.fireOut=(st.fireOut||0)+1;if(zoneAmmo(s,q.zi).x>0)st.detPrev=(st.detPrev||0)+1}}}
    else if(q.k==='vac'){const z=s.zones[q.zi];z.vw=(z.vw||0)+work;if(z.vw>=DCN.vw){z.vw=0;s.vac[q.zi]=0;if(st)st.vacFix=(st.vacFix||0)+1}}
    else{const m=q.m,W=(DCN.W[m.k]||300)*(m.wreck?2.5:1)*(m.alive?.3:1),C=(KIT.cost[m.k]||1)*(m.wreck?KIT.wreckK:1)*(m.alive?KIT.srvK:1);if(!(m.kres>0)){if(s.kits<C-1e-9){q.w=0;q.nokit=1;continue}m.kres=C;m.kC=C;s.kits=Math.max(0,s.kits-C)} /* набор берут со склада при начале работ — на весь объём этого ремонта; параллельные работы не делят один набор */const wk=Math.min(work,W-(m.rp||0)),dk=Math.min(m.kres,m.kC*wk/W);m.kres-=dk;s.kitUsed+=dk;if(st)st.kitUsed=(st.kitUsed||0)+dk;q.kit=m.kC;q.eta=(W-(m.rp||0)-wk)/Math.max(1e-6,work/dc);m.rp=(m.rp||0)+wk;q.prog=m.rp/W;
      if(m.rp>=W-1e-6){m.rp=0;if(m.kres>1e-9){s.kitUsed+=m.kres;if(st)st.kitUsed=(st.kitUsed||0)+m.kres}m.kres=0;if(!m.alive){mrev(s,m);m.q=m.wreck?DCN.qWreck:DCN.qFix;m.wreck=0;m.fixN=(m.fixN||0)+1;if(m.fixN>=DCN.fixMax)m.fixed2=1;if(st)st.fixed=(st.fixed||0)+1}else m.q=1}} /* обслуживание доводит модуль до нормы — один раз, а не по кругу */
    if(st)st.dcWork=(st.dcWork||0)+work;out.push({...q,w:w+w2})}
  s.dcT=out.filter(q=>q.w>0).slice(0,8);const why=[];if(noSp)why.push(s.kitCap<=0?'нет ремонтного склада — модули не восстановить':'нет ремонтных наборов — '+noSp+' модулей ждут');if(out.some(q=>!q.w))why.push('не хватает людей на '+out.filter(q=>!q.w).length+' задач');if(org<.5)why.push('нет командования — работы идут медленнее');
  if(tasks.some(q=>q.k!=='fire'&&zf(q.zi)))why.push('в горящих отсеках только тушат');s.dcWhy=why.join('; ')}
// СОСТОЯНИЕ корабля (раз в секунду): физическая целость, экипаж и работающие системы — разные вещи
const CST=['боеспособен','повреждён','потерял часть функциональности','критически повреждён','потерял вооружение','обездвижен','потерял управление','потерял экипаж','выведен из строя','остов','уничтожен'];
function shipState(s){if(!s.alive)return 'уничтожен';if(!s.cg)return 'боеспособен';const we=weapEff(s),me=sysEff(s,'E')*(s.engN>0?1:0),re=sysEff(s,'R'),ce=cmdEff(s),se=sysEff(s,'D'),hp=hpf(s),cf=s.crew;s.capW=we;s.capE=me;s.capC=Math.min(re,ce);s.capS=se;
  const bad=[];if(we<.6)bad.push('оружие '+Math.round(we*100)+'%');if(me<.6)bad.push('двигатели '+Math.round(me*100)+'%');if(re<.6)bad.push('маневровые '+Math.round(re*100)+'%');if(ce<.6)bad.push('командование '+Math.round(ce*100)+'%');if(se<.6)bad.push('сенсоры '+Math.round(se*100)+'%');if(cf<.6)bad.push('экипаж '+s.crN+'/'+s.pers0);
  s.csWhy=bad.join(', ');
  if((s.hullF??1)<.6)bad.push('корпус '+Math.round((s.hullF??1)*100)+'%');if(!(s.core&&s.core.alive))bad.push('реактор выбит');s.csWhy=bad.join(', ');
  if(s.crN<=0)return 'остов';if(we<=0&&me<=0)return 'выведен из строя';if(s.crN<.1*s.pers0)return 'потерял экипаж';if(re<=0||ce<=.05)return 'потерял управление';if(we<=0)return 'потерял вооружение';if(me<=0)return 'обездвижен';
  if(hp<.35||cf<.35||(s.hullF??1)<.5)return 'критически повреждён';if(Math.min(we,me,re,ce,se)<.6)return 'потерял часть функциональности';if(hp<.95||cf<.95)return 'повреждён';return 'боеспособен'} // PW: ширина воронки в колонках на единицу урона
const val=s=>s.T.role==='freight'||s.T.role==='supply'?.6:(VAL[s.cls]||1);
// ===== командир стороны: раз в CMD.period с решает план — собраться в кулак, охватить врага 2–5 группами, отойти =====
const CMD=gd('battle','command',{period:30,minGroup:6,fleetMax:10});let CMDS=[{},{}],FCNT=new Map();const FLEET_MAX=CMD.fleetMax;
// КОМАНДОВАНИЕ СОЕДИНЕНИЕМ: над индивидуальным планировщиком. Раз в FC.re с (и сразу — при потере цели, её гибели или отказе корабля) командир флота
// (флагман — крупнейший живой корабль; погиб — один цикл без распределения) назначает каждому кораблю задачу: роль и цель. Как выполнять — решает сам корабль (plan2).
// Цели — только видимые сенсорами стороны (trackOf), их опасность и целость — по оценке (belief), оружие — по проекту с исправной долей. Без случайности.
// Распределение жадное по предельной пользе: польза цели = опасность × ценность × вероятность выбить её за FC.T с при уже назначенном огне (1−e^(−урон·T/живучесть)).
// Поэтому второй корабль на ту же цель идёт, только если это полезнее новой цели, — концентрация огня осознанная. Гистерезис и минимальное время удержания — без дёрганья.
const AB=gd('battle','ab',{side:-1});
const PVO=gd('battle','pvo',{on:1,dmin:2,dmax:6,vc:.3,tc:60}); // ПВО-сопровождение: на оси угрозы в dmin…dmax км перед защищаемым, догоняет со скоростью ≤ vc км/с сверх его скорости (выход на место за ~tc с)
const RT=gd('battle','retreat',{maxFrac:.5,lose:.6,cw:40,hpIn:.35,hpOut:.6,prep:10,clear:30,try:120,exit:60,ret:30}); // автомат отхода: вход при целости < hpIn; возврат — не раньше hpOut; prep — с подготовки; clear — с вне досягаемости до перегруппировки; try — с без отрыва → бой; exit — с перегруппировки до выхода из боя; ret — с возвращения // испытания A/B: ≥0 — роли и доклады только у этой стороны, другая — без них
const FC=gd('battle','fleetcmd',{grp:1,form:'',fix:1,on:1,re:10,hold:45,hyst:1.6,T:90,R:300,rep:30,repTTL:60,fb:1,risk:.08,win:36,swc:2,sp:3,back:6,cover:1.3}); // sp — км между местами линии; back — км второй линии (поддержка); cover — ценность незанятой серьёзной угрозы // fb — доклады кораблей включены // rep — с между докладами корабля; repTTL — сколько командир учитывает доклад
// РОЛЬ — по возможностям корабля относительно своего соединения (медианы флота), не по абсолютным порогам: однородный флот целиком — линия;
// ПВО — корабль, у которого противоракетные установки (зенитки A, картечницы G) — основное вооружение; перехват — заметно быстрее флота при меньшей живучести и с топливом;
// поддержка — дальнобойный, но слабее линии, или неспособный к линейному бою; всё по исправным модулям и двигателям — повреждения пересматривают роль.
function capOf(s){const al=s.tur.filter(m=>m.alive&&(!m.cg||modEff(s,m)>0)),pd=al.filter(m=>m.k==='A'||m.k==='G').length,main=al.filter(m=>m.k==='T'||m.k==='L'||m.k==='M').length,
  rng=Math.max(0,...al.filter(m=>(m.k==='T'||m.k==='M')&&m.cfg&&m.cfg.rng).map(m=>m.cfg.rng)),fp=dpsAt(al,{T:s.T,acc:EP.acc,rcsN:1},Math.min(40,rng||20),0),
  ac=(s.acc||5)*(s.cg?sysEff(s,'E')*(s.engN>0?1:0):s.T.eng?s.engN/s.T.eng:1),dur=s.T.tons*hpf(s),fuel=s.dvB?s.dvB.spend:1;return {pd,main,rng,fp,ac,dur,fuel}}
const med=a=>{const b=[...a].sort((x,y)=>x-y);return b.length?b[b.length>>1]:0};
function roleOf(s,M,cur){const c=capOf(s),fp=c.fp/Math.max(1e-6,M.fp),du=c.dur/Math.max(1,M.dur),ls=Math.sqrt(fp*du),K=r=>cur===r?.85:1; // K — гистерезис: удержать текущую роль легче, чем войти в неё
  if(c.pd>=3*Math.max(1,c.main)||cur==='ПВО'&&c.pd>=2*Math.max(1,c.main))return 'ПВО'; // противоракетные установки — основное вооружение
  if(c.main===0&&c.pd===0)return 'поддержка';
  if(c.main>=1&&M.erng>0&&c.rng>=1.2*K('поддержка')*M.erng)return 'поддержка'; // бьёт дальше врага — держит дистанцию вне его досягаемости
  if(c.ac>=1.3*K('перехват')*M.ac&&du<=1/K('перехват')&&c.fuel>=.25*K('перехват')&&(c.fp>0||c.pd>0))return 'перехват';
  if(ls>=.7*K('линия')||c.main>=1&&du>=.9)return 'линия';
  return 'поддержка'}
const wtOf=o=>o.__dt||(o.__dt=o.tur.map(m=>({k:m.k,cfg:m.cfg,face:m.face,alive:true}))); // оружие врага по проекту (видно на корпусе), исправная доля — belief.wp
function fleetAssign(F){if(t<(F.faT||0))return;F.faT=t+FC.re;for(const q of F.ships)if(q.rst==='home'||q.derelict)q.task=null; // ушедшие на базу и остовы — без задач
  const sd=F.side,my=F.ships.filter(q=>q.alive&&!q.T.role&&q.tur.length&&q.st!=='surr'&&!q.derelict&&q.rst!=='home'&&!(q.cg&&q.capW!=null&&q.capW<=0));if(!my.length)return;
  const st=stat.fc=stat.fc||{};
  // флагман: крупнейший живой корабль; потеря — один цикл без распределения (новый командир принимает дела)
  const fl=my.reduce((a,q)=>q.T.tons>a.T.tons?q:a,my[0]);if(F.flag&&F.flag!==fl&&!F.flag.alive){F.flag=fl;F.flagT=t;st.flagLost=(st.flagLost||0)+1;return}F.flag=fl;
  const E=[];for(const o of ships){if(!o.alive||o.side===sd||!o.T||o.st==='surr')continue;const r=trackOf(sd,o);if(!r)continue;const d=Math.hypot(r.x-F.cx,r.y-F.cy);if(d>FC.R)continue;
    const b=belief(sd,o);let th=0;for(const q of my)th+=dpsAt(wtOf(o),q,Math.hypot(r.x-q.x,r.y-q.y),0,b.wp);{const M0=F.thE=F.thE||new Map(),p0=M0.get(o);th=p0!=null?p0+.35*(th-p0):th;M0.set(o,th)} /* опасность сглажена по циклам: шум расстояний не гоняет цели */E.push({o,r,b,th,hp:Math.max(1,o.total*b.md),V:(VAL[o.cls]||1)*(o.T.role==='supply'||o.tnk?HUNT.sup:1),D:0,n:0})}
  if(!E.length){for(const q of my)q.task=null;F.line=null;return}
  // РОЛИ: по вооружению и манёвренности; смена роли — только если новая держится 2 цикла подряд (кроме критических повреждений)
  const CP=my.map(capOf),M={fp:med(CP.map(c=>c.fp)),dur:med(CP.map(c=>c.dur)),ac:med(CP.map(c=>c.ac)),erng:Math.max(0,...E.map(e=>Math.max(0,...wtOf(e.o).filter(m=>m.k==='T'&&m.cfg&&m.cfg.rng).map(m=>m.cfg.rng))))}; /* erng — самая дальнобойная пушка врага: «поддержка» только если бьёт дальше всех */
  for(const q of my){const rp=q.report&&t-q.report.t<FC.repTTL?q.report.why:null,crit=rp==='критические повреждения'||rp==='необходимо отступление';if(FC.grp&&!crit&&(q.role==='прикрытие'||q.role==='разведка'||q.role==='ремонт'))continue; /* особые задачи v3 снимает своя логика ниже */let want=crit?'поддержка':roleOf(q,M,q.role);
    q.__rc=0;if(!q.role){q.role=want;q.roleC=null}else if(want!==q.role){if(crit||q.roleC===want){st.roleCh=(st.roleCh||0)+1;(st.roleWhy=st.roleWhy||{})[crit?rp:'состав/состояние']=((st.roleWhy||{})[crit?rp:'состав/состояние']||0)+1;q.roleWhy=crit?rp:'изменилось вооружение/состояние';q.role=want;q.__rc=1;q.roleT=t;q.roleC=null}else q.roleC=want}else q.roleC=null}
  // ===== V3: ОТХОД С ПРИКРЫТИЕМ, РАЗВЕДКА, РЕМОНТНАЯ ПОДДЕРЖКА, ВЫБОР ПОСТРОЕНИЯ =====
  // соотношение сил: наблюдаемая «боевая масса» (тоннаж × целость) своих против видимых врагов
  {let ow=0,ew=0;for(const q of my)ow+=q.T.tons*hpf(q);for(const e of E)ew+=e.o.T.tons*(e.b.md>.05?e.b.md:1);F.str=ow/Math.max(1,ew)}
  const CV=st.cov=st.cov||{as:0,rel:{},held:0,wait:0,maxFrac:0,xfer:0,scout:0,rep:0,form:{}};
  const RS=F.ships.filter(q=>q.alive&&!q.T.role&&(q.rst==='prep'||q.rst==='retreat'||q.rst==='regroup'||q.rst==='cornered')),NF=F.ships.filter(q=>q.alive&&!q.T.role&&q.rst!=='home').length;F.retFrac=RS.length/Math.max(1,NF); /* отходящие — из всего соединения (в т.ч. безоружные, которых нет в списке бойцов) */CV.maxFrac=Math.max(CV.maxFrac,F.retFrac);
  if(FC.grp){
    // прикрывающие: снимаются, когда прикрываемый ушёл из зоны поражения / погиб / вернулся, или сами стали небоеспособны (тогда их отход — обычный, своей логикой)
    for(const q of my)if(q.cvOf){const r=q.cvOf,nn=r.alive?nearestShip(r.x,r.y,1-sd):null,why=!r.alive?'прикрываемый погиб':!RS.includes(r)?'прикрываемый в строю или на базе':nn&&nn.d>(nn.s.maxR||60)*1.6?'прикрываемый вне досягаемости врага':hpf(q)<RT.hpIn*1.2||q.flee||(q.capW!=null&&q.capW<.45)?'прикрывающий тяжело повреждён':q.dvB&&q.dvB.spend<=RET.crit*4?'прикрывающему не хватает топлива':null;
      if(why){CV.rel[why]=(CV.rel[why]||0)+1;q.cvOf=null;q.prot=null;if(q.role==='прикрытие')q.role=null}}
    const covered=new Set(my.filter(q=>q.cvOf&&q.cvOf.alive).map(q=>q.cvOf)),free=my.filter(q=>!RS.includes(q)&&!q.cvOf),
      C=free.filter(q=>hpf(q)>=.55&&(q.capW==null||q.capW>=.6)&&(!q.dvB||q.dvB.spend>RET.crit*6)&&q.engN>0&&capOf(q).fp>0); /* прикрыть может только целый, с оружием, двигателями и топливом сверх резерва */
    let room=Math.max(0,Math.floor(free.length/2)-my.filter(q=>q.cvOf).length); /* в прикрытие — не больше половины оставшихся в бою: флот должен продолжать драться */
    for(const r of [...RS].sort((a,b)=>hpf(a)-hpf(b)||a.uid-b.uid)){if(covered.has(r)||room<=0||!C.length)continue;let bq=null,bs=-1;
      for(const q of C){const c=capOf(q),sc=c.fp*hpf(q)*(.5+Math.min(1,c.ac/10))/(1+Math.hypot(q.x-r.x,q.y-r.y)/50);if(sc>bs){bs=sc;bq=q}}
      if(bq){bq.cvOf=r;covered.add(r);C.splice(C.indexOf(bq),1);room--;CV.as++}}
    for(const q of my)if(q.cvOf){q.role='прикрытие';q.prot=q.cvOf;q.roleC=null}
    F.cvWait=new Set(RS.filter(r=>r.rst==='prep'&&!covered.has(r)&&(C.length>0)));
    // РАЗВЕДКА: корабль с лучшими сенсорами флота (дальность ≥ 1,3 медианы) и не главный по огню — держится на границе своей дальности обнаружения, но вне досягаемости врага
    const sR=q=>Math.max(0,...(q.scl||q.sc||[]).map(c=>c.rng||0)),SR=my.map(sR),mSR=med(SR);
    for(const q of my)if(q.role==='разведка'&&(sR(q)<1.3*mSR||!sR(q)))q.role=null;
    if(my.length>=4&&!my.some(q=>q.role==='разведка')){let bq=null,bv=0;const mfp=med(my.map(q=>capOf(q).fp));for(const q of free){const v=sR(q);if(q.cvOf||!v||v<1.3*mSR||capOf(q).fp>mfp||hpf(q)<.6)continue;if(v>bv){bv=v;bq=q}}if(bq){bq.role='разведка';bq.roleC=null;CV.scout++}}
    // РЕМОНТНАЯ ПОДДЕРЖКА: у кого есть склад и наборы сверх своего запаса (KIT.low), идёт к союзнику, которому нечем чинить выбитые модули; держится позади, за ним
    const need=q=>{if(!q.alive||!q.kitCap)return 0;let c=0;for(const z of q.zones)if(!z.brk)for(const m of z.mods)if(!m.alive)c+=(KIT.cost[m.k]||1)*(m.wreck?KIT.wreckK:1);return Math.max(0,c-q.kits)};
    for(const q of my)if(q.role==='ремонт'&&(!q.rpTg||!q.rpTg.alive||need(q.rpTg)<1||q.kits-KIT.low*q.kits0<1)){q.role=null;q.rpTg=null}
    for(const q of free){if(q.role==='ремонт'||q.cvOf||q.role==='разведка'||!(q.kitCap>0)||q.kits-KIT.low*q.kits0<4||hpf(q)<.5)continue;let bt=null,bn=0;
      for(const a of F.ships){if(a===q||!a.alive||a.rst==='home'||F.ships.some(o=>o!==q&&o.rpTg===a&&o.role==='ремонт'))continue;const n=need(a)/(1+Math.hypot(a.x-q.x,a.y-q.y)/100);if(n>bn){bn=n;bt=a}}
      if(bt&&bn>=2){q.role='ремонт';q.rpTg=bt;q.roleC=null;CV.rep++}}
    // ПОСТРОЕНИЕ: далеко от врага — колонна (узкий фронт, сближение без перестроений); при перевесе ≥1,3 — клин (сосредоточение на точке прорыва); иначе — линия (все борта к врагу)
    {const dE=Math.min(...E.map(e=>Math.hypot(e.r.x-F.cx,e.r.y-F.cy))),mR=med(my.map(q=>q.maxR||60)),want=FC.form||(dE>1.5*mR?'колонна':F.str>=1.3?'клин':'линия');
      if(want!==F.form){if(F.formC===want||!F.form){F.form=want;F.formC=null}else F.formC=want}CV.form[F.form]=(CV.form[F.form]||0)+1}}
  // ЛИНИЯ БОЯ: опорная точка — центр линейных кораблей (или всего соединения), фронт — на видимых врагов; места линии — по боковому порядку (без пересечений), поддержка — второй линией за ней
  {let ex=0,ey=0,ew=0;for(const e of E){const w=e.th+.001;ex+=e.r.x*w;ey+=e.r.y*w;ew+=w}ex/=ew;ey/=ew;const L=my.filter(q=>q.role==='линия'),base=L.length?L:my;let ax=0,ay=0;for(const q of base){ax+=q.x;ay+=q.y}ax/=base.length;ay/=base.length;
    const dl=Math.hypot(ex-ax,ey-ay)||1,ux=(ex-ax)/dl,uy=(ey-ay)/dl,px=-uy,py=ux,sp=Math.max(FC.sp,Math.max(...my.map(q=>q.T.L))*12),vx=F.vgx||0,vy=F.vgy||0;F.line={ax,ay,ux,uy,px,py,sp,vx,vy,t};
    const lat=q=>(q.x-ax)*px+(q.y-ay)*py,fm=FC.grp?F.form||'линия':'линия',put=(arr,back)=>{arr.sort((a,b)=>lat(a)-lat(b)||a.uid-b.uid).forEach((q,i)=>{let o=(i-(arr.length-1)/2)*sp,bk=back;if(fm==='клин'){bk+=Math.abs(o)*.8}else if(fm==='колонна'){bk+=i*sp*1.5;o=0} /* клин: остриё к врагу, крылья назад; колонна: друг за другом по оси на врага */q.slot={x:ax+px*o-ux*bk,y:ay+py*o-uy*bk}})};
    put(L,0);put(my.filter(q=>q.role==='поддержка'),FC.back);for(const q of my)if(q.role!=='линия'&&q.role!=='поддержка')q.slot=null;
    // ПВО прикрывает самого уязвимого ценного союзника (флагман — с запасом), между ним и угрозой
    const prots=my.filter(q=>q.role!=='ПВО'&&!q.flee),MC=E.filter(e=>wtOf(e.o).some(m=>m.k==='M')),taken=new Map();
    // ПВО: защищаемый — ценный союзник под ракетной угрозой (ракеты в полёте на него, носители рядом); один ПВО на корабль, пока есть незащищённые; смена — только если новый заметно важнее
    for(const q of my.filter(q=>q.role==='ПВО').sort((a,b)=>a.uid-b.uid)){let pb=null,ps=-1;for(const a of prots){let mt=0;for(const p of mis)if(p.side!==sd&&(p.tgt===a||p.thO===a))mt++;let mc=0;for(const e of MC)mc+=1/(1+Math.hypot(e.r.x-a.x,e.r.y-a.y)/150);
        const sc=(VAL[a.cls]||1)*(a===F.flag?1.5:1)*(1+2*mt+mc)*(1.3-hpf(a))/(1+Math.hypot(a.x-q.x,a.y-q.y)/60)*(q.prot===a?1.5:1)/(1+(taken.get(a)||0));if(sc>ps){ps=sc;pb=a}}
      q.prot=pb;if(!pb)continue;taken.set(pb,(taken.get(pb)||0)+1);pb.__pvoT=t;let ux=0,uy=0;
      for(const p of mis){const tg2=p.tgt||p.thO;if(p.side===sd||!tg2||tg2.side!==sd)continue;const d=Math.hypot(p.x-pb.x,p.y-pb.y)||1;if(d>200)continue;const w=3/(1+d/30);ux+=(p.x-pb.x)/d*w;uy+=(p.y-pb.y)/d*w} // ракеты в полёте — по направлению прихода
      for(const e of E){const d=Math.hypot(e.r.x-pb.x,e.r.y-pb.y)||1,w=(MC.includes(e)?3:1)*(e.th+.01)/(1+d/100);ux+=(e.r.x-pb.x)/d*w;uy+=(e.r.y-pb.y)/d*w}
      const l=Math.hypot(ux,uy)||1;q.pax=ux/l;q.pay=uy/l}}
  // ЦЕЛИ: жадно по предельной пользе; незанятая серьёзная угроза ценится выше (не все на одну); доклады — безопаснее цели, запрет цели «не может атаковать»
  // устойчивое распределение: сначала учитываем огонь всех, кто уже ведёт цель; каждый корабль, выбирая, снимает только свой вклад —
  // так оценка его цели не скачет от того, в каком порядке пересматривают остальные (главный источник колебаний в 184df06)
  const kill=(e,D)=>D/(D+e.hp/FC.T),thMed=[...E.map(e=>e.th)].sort((a,b)=>a-b)[E.length>>1],cOf=(q,e)=>dpsAt(q.tur,{T:e.o.T,acc:EP.acc,rcsN:1},Math.hypot(e.r.x-q.x,e.r.y-q.y),0),EB=new Map(E.map(e=>[e.o,e]));
  for(const q of my){const g=q.task&&q.task.tg;if(g&&g.alive&&EB.has(g)){const e=EB.get(g);q.__c=cOf(q,e);e.D+=q.__c;e.n++}else q.__c=0}
  for(const q of [...my].sort((a,b)=>a.uid-b.uid)){const rp=q.report&&t-q.report.t<FC.repTTL?q.report.why:null,fresh=q.report&&!q.report.h&&rp,risk=rp==='устойчивая угроза',role=q.role;if(fresh)q.report.h=1;
    if(q.task&&q.task.tg){const w=!q.task.tg.alive?'цель уничтожена':!trackOf(sd,q.task.tg)?'нет сопровождения':null;if(w){(st.why=st.why||{})[w]=(st.why[w]||0)+1;if(w==='цель уничтожена'&&q.task.sw){const S2=st.sw=st.sw||{n:0,why:{},back:0,kill:0,lost:0};S2.kill++}q.task.sw=false;q.task.lastWhy=w;q.task.tg=null}}
    const old=q.task&&q.task.tg&&q.task.tg.alive?q.task:null,oe=old&&EB.get(old.tg);if(oe&&q.__c){oe.D-=q.__c;oe.n--}let best=null,bu=-1,ou=-1;
    for(const e of E){const d=Math.hypot(e.r.x-q.x,e.r.y-q.y),c=cOf(q,e);if(c<=0&&d>(q.maxR||60)*2)continue;if(q.ban&&q.ban.get(e.o)>t)continue;
      const thr=role==='ПВО'?(e.th+.001)/(1+Math.hypot(e.r.x-(q.prot||q).x,e.r.y-(q.prot||q).y)/30):e.th+.001; // ПВО — угрозы рядом с защищаемым
      let u=(thr*e.V)*(kill(e,e.D+c+1e-4)-kill(e,e.D))/Math.max(.2,e.b.md)*(e.b.wp<.3*Math.max(1,e.o.tur.length)?.1:1); /* молчащий (по наблюдению) враг — не первоочередная цель */if(FC.fix){if(e.n===0&&e.th>=thMed)u*=FC.cover;if(risk)u/=1+e.th*3} /* незанятая серьёзная угроза ценится выше (не все на одну цель); при устойчивой угрозе — опасные цели дешевле. Эта строка с dadae4d была случайно закомментирована (код после //) */
      if(old&&old.tg===e.o){u*=t-old.at<FC.hold?2*FC.hyst:FC.hyst;ou=u}else if(oe&&e.th<oe.th*1.5)u/=FC.swc; /* цена смены цели (разворот, новое решение огня — замер acq ≈15–30 с из FC.T): ради перераспределения — только при явной выгоде; новая серьёзная угроза (опасность ×1.5) — сразу */if(u>bu){bu=u;best=e}} // удержание: только множитель — важная перемена обстановки (втрое выгоднее) всё равно переключит
    const SW=st.sw=st.sw||{n:0,why:{},back:0,kill:0,lost:0};
    if(fresh&&rp==='не может атаковать цель'&&old&&best&&best.o!==old.tg&&cOf(q,best)<=0){best=EB.get(old.tg)||best;if(q.ban)q.ban.delete(old.tg)} /* сменить цель стоит, только если новую корабль может бить сейчас — иначе смена ничего не даёт */
    if(!best){if(q.task){if(fresh)st.repIgn=(st.repIgn||0)+1;q.task.tg=null}continue}best.D+=cOf(q,best);best.n++;
    if(!old||old.tg!==best.o){st.switch=(st.switch||0)+1;if(rp)st.byRep=(st.byRep||0)+1;
      const pe=old?EB.get(old.tg):null,why=!old?(q.task&&q.task.lastWhy)||'первое назначение':rp?'доклад: '+rp:pe&&best.th>pe.th*1.2?'опаснее':best.b.md<.4?'добивание':'выгоднее другая цель';
      if(old){(SW.ns=SW.ns||[0,0])[sd]++;{const W=(SW.ws=SW.ws||[{},{}])[sd],k2=(q.role||'')+':'+why;W[k2]=(W[k2]||0)+1}if((SW.dbg=SW.dbg||[]).length<40)SW.dbg.push([Math.round(t),q.uid,why,+(bu/Math.max(1e-12,ou)).toFixed(2),ou<0?'нет в списке':'',pe?+pe.th.toFixed(3):null,+best.th.toFixed(3),pe?pe.n:null,best.n]);SW.n++;SW.why[why]=(SW.why[why]||0)+1;if(q.prevTg===best.o&&t-(q.prevT||-1e9)<90)SW.back++;q.prevTg=old.tg;q.prevT=t}
      if(q.task&&q.task.tg0&&q.task.tg0.alive&&q.task.sw)SW.lost++; // ушёл с цели, взятой переключением, не добив её
      q.task={tg:best.o,tg0:best.o,role,at:t,st:'ok',why,sw:!!old,acq:null};if(fresh)st.repAct=(st.repAct||0)+1}
    else{q.task.role=role;q.task.st='ok';if(fresh)q.__rc?st.repAct=(st.repAct||0)+1:st.repIgn=(st.repIgn||0)+1}}
  // ОЦЕНКА СТРОЯ (только статистика): расстояние до мест, глубина линии, линия↔поддержка, ПВО↔прикрываемый, доля кораблей, выполняющих задачу роли
  {const fm=st.form=st.form||{n:0,slot:0,slotN:0,depth:0,depthN:0,ls:0,lsN:0,pvo:0,pvoN:0,ok:{},all:{}},LN=F.line,cen=a=>{let x=0,y=0;for(const q of a){x+=q.x;y+=q.y}return {x:x/a.length,y:y/a.length}},ne=q=>Math.min(...E.map(e=>Math.hypot(e.r.x-q.x,e.r.y-q.y)));fm.n++;
    const L=my.filter(q=>q.role==='линия'),S=my.filter(q=>q.role==='поддержка'),lc=L.length?cen(L):null,lcE=lc?ne(lc):0;
    if(L.length>1&&LN){const al=L.map(q=>(q.x-lc.x)*LN.ux+(q.y-lc.y)*LN.uy);fm.depth+=Math.sqrt(al.reduce((a,v)=>a+v*v,0)/al.length);fm.depthN++}
    if(lc&&S.length){fm.ls+=Math.hypot(cen(S).x-lc.x,cen(S).y-lc.y);fm.lsN++}
    for(const q of my){const r=q.role;fm.all[r]=(fm.all[r]||0)+1;let ok=false;const sd2=q.slot?Math.hypot(q.slot.x-q.x,q.slot.y-q.y):null;if(sd2!=null){fm.slot+=sd2;fm.slotN++}
      if(r==='линия')ok=sd2!=null&&sd2<=2*(LN?LN.sp:3)+5;else if(r==='поддержка')ok=(lc?ne(q)>=lcE-2:true)||sd2!=null&&sd2<=2*(LN?LN.sp:3)+5;
      else if(r==='ПВО'){const d=q.prot?Math.hypot(q.prot.x-q.x,q.prot.y-q.y):0;if(q.prot){fm.pvo+=d;fm.pvoN++}ok=!q.prot||d<=20}
      else if(r==='перехват'){const g=q.task&&q.task.tg;ok=!!g&&(Math.hypot(g.x-q.x,g.y-q.y)<=(q.maxR||60)*1.2||((g.x-q.x)*(q.vx-g.vx)+(g.y-q.y)*(q.vy-g.vy))>0)}
      if(ok)fm.ok[r]=(fm.ok[r]||0)+1;
      // ФУНКЦИЯ, а не место: реализует ли корабль оружие (план видит урон по цели), ПВО — прикрываемый в досягаемости картечниц (12 км)
      const fn=r==='ПВО'?!!q.prot&&Math.hypot(q.prot.x-q.x,q.prot.y-q.y)<=12:(q.noAtk||0)<1e-9&&!!(q.task&&q.task.tg);if(fn)(fm.fn=fm.fn||{})[r]=((fm.fn||{})[r]||0)+1;if((q.noAtk||0)>=30)fm.noW=(fm.noW||0)+1}}
  // статистика (только для проверок): места в линии, прикрытие, ракурс перехвата, дистанция поддержки, разброс соединения
  {const rm=st.rm=st.rm||{},A=(k,f,v)=>{const a=rm[k]||(rm[k]={n:0});a.n_=a.n_||{};a[f]=(a[f]||0)+v;a.n_[f]=(a.n_[f]||0)+1};
    for(const q of my){const r=q.task&&q.task.tg&&trackOf(sd,q.task.tg);if(q.slot)A(q.role,'доСлота',Math.hypot(q.x-q.slot.x,q.y-q.slot.y));if(q.prot)A(q.role,'доЗащищаемого',Math.hypot(q.x-q.prot.x,q.y-q.prot.y));if(r){A(q.role,'доЦели',Math.hypot(r.x-q.x,r.y-q.y));if(q.role==='перехват')A(q.role,'ракурс',Math.abs(adiff(r.hd,Math.atan2(q.y-r.y,q.x-r.x)))*57.3)}
      if(q.role==='поддержка'){let dn=1e9;for(const e of E)dn=Math.min(dn,Math.hypot(e.r.x-q.x,e.r.y-q.y));A(q.role,'доВрага/дальн',dn/(q.maxR||60))}}
    let sp=0,np=0;for(let i=0;i<my.length;i++)for(let j=i+1;j<my.length;j++){sp+=Math.hypot(my[i].x-my[j].x,my[i].y-my[j].y);np++}if(np){st.spread=(st.spread||0)+sp/np;st.spreadN=(st.spreadN||0)+1}}
  st.cycles=(st.cycles||0)+1;st.tg=(st.tg||0)+E.filter(e=>e.n>0).length;st.conc=(st.conc||0)+E.filter(e=>e.n>1).length;st.ships=(st.ships||0)+my.length}
// ДОКЛАД КОМАНДОВАНИЮ: задача стала невыгодной или опасной. Не чаще раза в FC.rep с от корабля; доклад действует FC.repTTL с. Командование сразу пересматривает распределение.
function reportTask(s,F,why,g){if(!FC.fb||AB.side>=0&&s.side!==AB.side||t-(s.repT??-1e9)<FC.rep)return;s.repT=t;{const st=stat.fc=stat.fc||{};if(s.report&&s.report.why===why)st.repRep=(st.repRep||0)+1}s.report={why,t,tg:g};if(why==='не может атаковать цель'){s.noAtk=0;(s.ban=s.ban||new Map()).set(g,t+60)}if(F)F.faT=0;const st=stat.fc=stat.fc||{};(st.rep=st.rep||{})[why]=(st.rep[why]||0)+1}
// корабль сообщает, что задачу выполнить не может (цель уничтожена, не видна, корабль отходит) — командование пересматривает распределение сразу
function taskTarget(s,F){const k=s.task;if(!k||!k.tg)return null;let bad=null;if(!k.tg.alive)bad='цель уничтожена';else if(!trackOf(s.side,k.tg))bad='нет сопровождения';else if(s.flee)bad='повреждён, отходит'; /* без запаса Δv корабль всё равно стреляет — задачу не снимаем */
  if(bad){k.st=bad;if(F)F.faT=0;const st=stat.fc=stat.fc||{};(st.why=st.why||{})[bad]=(st.why[bad]||0)+1;s.task=null;return null}return k.tg}
function command(sd,all){ // у каждого флота (до 10 кораблей) свой капитан: смотрит на своего противника и на союзников, раз в CMD.period с меняет план
  const C=CMDS[sd];C.plans=C.plans||{};C.bad=C.bad||{};const mine=all.filter(F=>F.side===sd&&F.n>0),foes=all.filter(F=>F.side!==sd&&F.n>0);if(!mine.length||!foes.length)return;
  const ex=foes.reduce((a,F)=>a+F.cx*F.n,0)/foes.reduce((a,F)=>a+F.n,0),ey=foes.reduce((a,F)=>a+F.cy*F.n,0)/foes.reduce((a,F)=>a+F.n,0),mx=mine.reduce((a,F)=>a+F.cx*F.n,0)/mine.reduce((a,F)=>a+F.n,0),my=mine.reduce((a,F)=>a+F.cy*F.n,0)/mine.reduce((a,F)=>a+F.n,0);
  const dd=Math.hypot(ex-mx,ey-my)||1,ux=(ex-mx)/dd,uy=(ey-my)/dd,sideStr=mine.reduce((a,F)=>a+F.str,0)/Math.max(1,foes.reduce((a,F)=>a+F.str,0)),enSalvo=foes.some(F=>F.sv&&F.sv.o&&F.sv.o.side===sd);
  // союзники по фронту слева направо: крайние берут фланги, средние держат центр — так капитаны сами складывают охват
  const ord=mine.map(F=>[(F.cx-mx)*-uy+(F.cy-my)*ux,F]).sort((a,b)=>a[0]-b[0]).map(q=>q[1]),N=ord.length;
  const NM={wall:'стена',wedge:'клин',echelon:'ступени',flank:'обход',pass:'проход насквозь',drift:'засада в дрейфе',retreat:'отход',cover:'прикрытие отхода',kite:'держать дистанцию',assault:'штурм'};const sum={};
  ord.forEach((F,idx)=>{const fid=F.fid,lost=stat.lost[sd];
    let E=null,bd=1e18;for(const G of foes){const d=Math.hypot(G.cx-F.cx,G.cy-F.cy);if(d<bd){bd=d;E=G}} // свой противник — ближайший вражеский флот
    let loc=0,eloc=0;for(const G of all)if(Math.hypot(G.cx-F.cx,G.cy-F.cy)<180){if(G.side===sd)loc+=G.str;else eloc+=G.str} // силы рядом: свои и чужие
    const ratio=loc/Math.max(1,eloc),fuel=F.ships.reduce((a,o)=>a+(o.fuelCap?o.fuel/o.fuelCap:1),0)/F.n,efuel=E.ships.reduce((a,o)=>a+(o.fuelCap?o.fuel/o.fuelCap:1),0)/E.n,hurt=F.ships.filter(o=>hpf(o)<.45).length/F.n;
    const rng=F.ships.reduce((a,o)=>a+(o.maxR||60),0)/F.n,erng=E.ships.reduce((a,o)=>a+(o.maxR||60),0)/E.n,far=bd>rng*1.8,edge=N>1?(idx/(N-1))*2-1:0; // edge: −1 левый край … +1 правый
    const P0=C.plans[fid]||{},memo=C.mem=C.mem||{},m=memo[fid]=memo[fid]||{};const dm=F.ships.length-(m.n0==null?F.ships.length:m.n0);m.n0=F.ships.length;
    if(P0.k&&t-(m.at||0)>=55&&dm<0)(C.bad[fid]=C.bad[fid]||{})[P0.k]=t+180; // план, при котором флот терял корабли, — 3 минуты «плохой»
    const bad=k=>(C.bad[fid]&&C.bad[fid][k]>t)?.25:1,S={};
    S.wall=(far?2:1.6)*bad('wall');S.wedge=(!far&&ratio>1.1?1.6:.5)*bad('wedge');S.echelon=(!far?1.3:.4)*bad('echelon');
    S.flank=(Math.abs(edge)>.4&&fuel>.35&&!far?(enSalvo?2.8:sideStr>1.2?2.4:1.4)*Math.abs(edge):0)*bad('flank');      // крайние флоты — в обход
    S.pass=(fuel>.5&&!far&&ratio>1.2&&Math.abs(edge)<.5?1.4:0)*bad('pass');
    S.drift=(efuel<fuel*.6?3:0)*bad('drift');S.retreat=(ratio<.45&&fuel>.1?5:0);S.cover=(hurt>.3?3.5:0);
    S.kite=(rng>erng*1.2&&fuel>.3?2.6:0)*bad('kite');S.assault=(rng<erng*.85&&ratio>1.1&&!far?2:0)*bad('assault');
    for(const k in S)S[k]*=.85+rnd()*.3;if(P0.k&&S[P0.k]>0&&t-(m.at||0)<60&&!(C.bad[fid]&&C.bad[fid][P0.k]>t))S[P0.k]+=10;else if(P0.k&&S[P0.k])S[P0.k]*=1.25;
    let k='wall';for(const q in S)if(S[q]>S[k])k=q;
    const fire=k==='flank'||k==='pass'?'eng':ratio>1.3?'weak':'',plan={k,stance:k,fire,...(k==='flank'?{flank:Math.sign(edge||1)*(1+Math.abs(edge)*.6),env:1}:{})};
    if(P0.k!==k){m.at=t}C.plans[fid]=plan;sum[NM[k]]=(sum[NM[k]]||0)+1});
  stat.plan=stat.plan||['',''];const txt=Object.entries(sum).map(([a,b])=>b>1?a+' ×'+b:a).join(', ');if(txt!==stat.plan[sd]){stat.plan[sd]=txt;if(typeof log==='function'&&!(cfgNow&&cfgNow.bg))try{log(['Синие','Красные'][sd]+': '+txt+'.')}catch(e){}}}
function fleetsUpdate(){
  for(const F of FL.values()){F.ships=[];F.lrp=0;F.srp=0;F.lrR=0;F.n=0;F.cx=0;F.cy=0;F.str=0;F.fr=0}
  for(const s of ships){if(!s.alive)continue;const key=s.side*1000+s.fid;let F=FL.get(key);
    if(!F){F={ships:[],n:0,cx:0,cy:0,str:0,fr:0,key,side:s.side,fid:s.fid,next:0,stance:'engage',until:0,flank:rnd()<.4?(rnd()<.5?1:-1)*R(.7,1.2):0,tgt:null,focus:null,gx:s.x,gy:s.y,dx:-s.x/(Math.hypot(s.x,s.y)||1),dy:-s.y/(Math.hypot(s.x,s.y)||1),slotsAt:-99,rng:40,lrp:0,srp:0,lrR:0,zl:(((s.side*3+s.fid)%3)-1)*14,wait0:-1,born:t};FL.set(key,F)}
    F.ships.push(s);F.lrp+=s.lrp*hpf(s);F.srp+=s.srp*hpf(s);F.lrR=Math.max(F.lrR,s.lrR);F.n++;F.cx+=s.x;F.cy+=s.y;F.str+=s.aliveN*(1+val(s));if(s.T.role==='freight'||s.T.role==='supply')F.fr++;s.F=F}
  for(const [k,F] of FL){if(!F.n){FL.delete(k);continue}F.cx/=F.n;F.cy/=F.n;F.convoy=F.fr>=F.n*.5}
  const all=[...FL.values()];
  for(const sd of [0,1])if(t>=(CMDS[sd].next||0)){CMDS[sd].next=t+CMD.period;command(sd,all)}
  for(const F of all){
    if(t<F.next)continue;F.next=t+R(1.5,3);
    // цель-флот: ближайший вражеский, слабым отдаём предпочтение
    let bf=null,bs=1e18;for(const E of all){if(E.side===F.side)continue;const d=Math.hypot(E.cx-F.cx,E.cy-F.cy),sc=d/(1+.3*Math.log(Math.max(.2,F.str/Math.max(1,E.str))+1))*(E===F.tgt?.75:1);if(sc<bs){bs=sc;bf=E}}
    F.tgt=bf;if(!bf){F.stance='idle';continue}
    const dist=Math.hypot(bf.cx-F.cx,bf.cy-F.cy);let en=0,fr=0;for(const E of all)if(Math.hypot(E.cx-F.cx,E.cy-F.cy)<300){if(E.side!==F.side)en+=E.str;else fr+=E.str}
    const ratio=fr/Math.max(1,en),brave=F.brave||(F.brave=R(.22,.4));
    F.rng=F.ships.reduce((a,s)=>a+(s.effR?Math.min(s.T.dopt,s.effR):s.T.dopt),0)/F.n;
    if(F.convoy)F.stance='convoy';
    else if(t<F.until&&F.stance==='retreat')F.stance='retreat';
    else if(ratio<brave&&dist<300&&t>(F.calm||0)){F.stance='retreat';F.until=t+R(25,45);F.calm=F.until+60}
    else{
      let st=dist>F.rng*2.5&&F.flank?'flank':'engage';const E=bf;
      if(F.lrp>8&&F.lrp>E.lrp*1.3&&F.lrp>=F.srp*.8){st='kite';F.hold=Math.max(60,F.lrR*.8)}
      else if(E.lrp>10&&E.lrp>F.lrp*1.3&&F.srp>0)st='assault';
      // ждём подходящих союзников, чтобы ударить вместе
      let waiting=false;
      if(dist>F.rng*1.6)for(const A of all){if(A.side!==F.side||A===F||A.convoy||A.n<1)continue;
        const dA=Math.hypot(A.cx-bf.cx,A.cy-bf.cy);
        if(dA<1000&&dA>F.rng*2&&dA>dist+20&&dist<700&&A.born<=t){waiting=true;break}}
      if(waiting&&!(CMDS[F.side]&&CMDS[F.side].plans)){if(F.wait0<0)F.wait0=t;if(t-F.wait0<260)st='wait'}else if(dist>420||st!=='wait')F.wait0=-1;
      { // тактика ИИ по обстановке: топливо, численность, повреждения
        const fq=a=>a.ships.length?a.ships.reduce((x,o)=>x+(o.fuelCap?o.fuel/o.fuelCap:1),0)/a.ships.length:1,Ff=fq(F),Ef=fq(E),dmg=F.ships.filter(o=>hpf(o)<.45).length/Math.max(1,F.n);
        if(st!=='wait'&&st!=='kite'){
          if(Ff<.18&&Ef>Ff*1.5)st='retreat';                         // топлива меньше, чем у врага, — уходим, пока можем затормозить (ничья)
          else if(dmg>.3)st='cover';                                // много побитых — прикрываем их отход
          else if(Ef<Ff*.6&&dist>F.rng*1.3)st='drift';              // у врага бак пустее — ждём по инерции, пусть жжёт
          else if(ratio>1.6)st=(F.fid%2?'flank':'pass');            // нас больше — обход или проход насквозь
          else if(ratio<.8)st='wall';                               // нас меньше — стена носом
          else if(st==='engage')st=['wall','wedge','echelon'][F.fid%3]; // обычный бой — строй носом к врагу
        }
        if(st==='retreat'&&!F.until)F.until=t+40}
      {const P=CMDS[F.side].plans&&CMDS[F.side].plans[F.fid];if(P&&st!=='wait'){st=P.stance;if(st==='kite')F.hold=Math.max(60,F.lrR*.8,F.rng*1.3);if(P.flank!=null)F.flank=P.flank;F.env=!!P.env;F.planFire=P.fire}}
      { // крейсерская скорость: дойти за разумное время, не дороже, чем позволяет бак (каждый км/с — дважды: разгон и торможение)
        const TT={pass:400,assault:500,flank:800,wall:900,wedge:800,echelon:900,cover:600,retreat:500,kite:900,drift:3600,wait:3600,engage:900}[st]||900,ff=F.ships.reduce((a,o)=>Math.min(a,o.fuelCap?FUEL.ve*Math.log((dryM(o)+o.fuel)/dryM(o)):99),99);
        F.cruise=Math.max(.02,Math.min(F.minSpd||.45,Math.max(0,dist-F.rng)/TT,ff*.12))}
      F.stance=st}
    F.ratio=ratio;
    F.fire=(F.side===0&&ORD.fire)||F.planFire||(F.ratio>1.3?'weak':F.ratio<.8?'eng':'');
    if(F.side===0&&ORD.st&&!F.convoy){F.stance=ORD.st;if(ORD.st==='kite')F.hold=Math.max(60,F.lrR*.8,80);if(ORD.st==='retreat')F.until=t+6}
    // строй держится, пока флот не окружён и враг не вклинился внутрь
    {const dirs=[];let inside=0;for(const E of all){if(E.side===F.side)continue;if(Math.hypot(E.cx-F.cx,E.cy-F.cy)<280)dirs.push(Math.atan2(E.cy-F.cy,E.cx-F.cx))}
      let mx=0;for(let i=0;i<dirs.length;i++)for(let j=i+1;j<dirs.length;j++)mx=Math.max(mx,Math.abs(adiff(dirs[i],dirs[j])));
      for(const E of all)if(E.side!==F.side&&Math.hypot(E.cx-F.cx,E.cy-F.cy)<15)inside+=E.n;
      if(mx>2.6||inside>F.n*.4){F.brk=t+20}
      F.formed=t>(F.brk||0)}
    // общий фокус огня: самая ценная и повреждённая цель в зоне
    const cand=around(1-F.side,F.cx+(bf.cx-F.cx)*.3,F.cy+(bf.cy-F.cy)*.3,110);let fb=null,fs=0;
    const vul=o=>(o.cool?HUNT.cool:1)*(o.radOut?HUNT.rad:1)*(o.T.role==='supply'||o.tnk||o.T.role==='freight'?HUNT.sup:1); // остывающие, с открытыми радиаторами, снабжение — лакомые цели
    for(const o of cand){if(!trackOf(F.side,o))continue;const sc=val(o)*vul(o)*(1.4-belief(F.side,o).md)/(1+Math.hypot(o.x-F.cx,o.y-F.cy)/100);if(sc>fs){fs=sc;fb=o}}F.focus=fb; /* только видимые сенсорами стороны; целость — оценка, не факт */
    // фланговый флот — охотник: ищет уязвимых далеко (остывают, снабженцы, танкеры) и идёт к ним в обход, а не в лоб
    F.hunt=null;if(F.stance==='flank'){let hb=null,hs=0;for(const o of around(1-F.side,F.cx,F.cy,HUNT.r)){const v=vul(o);if(v<=1)continue;const sc=v*val(o)/(1+Math.hypot(o.x-F.cx,o.y-F.cy)/150);if(sc>hs){hs=sc;hb=o}}if(hb){F.hunt=hb;F.focus=hb;stat.hunt=(stat.hunt||0)+1}}
    if(SALVO.on&&(!F.sv||t>F.sv.tA+4||!F.sv.o.alive)){const o=F.focus;F.sv=null;if(o&&o.alive){let mx=0,N=0;for(const q of F.ships){if(!q.alive)continue;const nr=q.tur.filter(m=>m.alive&&m.k==='T').length;if(!nr)continue;const d=Math.hypot(o.x-q.x,o.y-q.y,(o.z||0)-(q.z||0)),v=(q.tur.find(m=>m.k==='T').cfg.vp||VP);if(d>effR(q,o,v))continue;mx=Math.max(mx,d/v);N+=nr*8}
      if(N>=4)F.sv={o,tA:t+mx+SALVO.prep,N,k:0}}} // залп флота: все снаряды приходят в одну секунду, каждый в свою точку круга, куда цель может увернутьсяif(F.side===0&&ORD.focus&&ORD.focus.alive)F.focus=ORD.focus;
    if(FC.on)fleetAssign(F);
    // точка сбора флота и направление строя
    let dx=bf.cx-F.cx,dy=bf.cy-F.cy;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
    if(F.hunt){dx=F.hunt.x-F.cx;dy=F.hunt.y-F.cy;const hl=Math.hypot(dx,dy)||1;dx/=hl;dy/=hl}
    else if(F.stance==='flank'){const a=F.env?F.flank:F.flank*Math.min(1,Math.max(0,(dist-F.rng*2)/160)),c=Math.cos(a),s2=Math.sin(a);[dx,dy]=[dx*c-dy*s2,dx*s2+dy*c]}
    {const shp=F.stance==='wedge'?'wedge':F.stance==='echelon'?'echelon':'line';if(F.shape!==shp){F.shape=shp;F.nSlots=-1}}
    if(F.stance==='pass'){ // проход насквозь: цель — точка за строем врага; пролетели — разворот и новый заход
      const ex=bf.cx-F.cx,ey=bf.cy-F.cy;if(!F.pd||Math.hypot(ex,ey)>F.rng*3)F.pd={x:dx,y:dy};F.tgx=bf.cx+F.pd.x*80;F.tgy=bf.cy+F.pd.y*80;if(ex*F.pd.x+ey*F.pd.y<-20)F.pd=null}
    else if(F.stance==='drift'){F.tgx=F.gx;F.tgy=F.gy}
    else if(F.stance==='retreat'||F.stance==='convoy'){F.tgx=F.cx-dx*160;F.tgy=F.cy-dy*160;if(F.stance==='convoy'){const ne=bf;F.tgx=F.cx-(ne.cx-F.cx)/dl*200;F.tgy=F.cy-(ne.cy-F.cy)/dl*200}}
    else if(F.stance==='wait'){F.tgx=F.cx;F.tgy=F.cy}
    else{const hold=F.stance==='kite'?F.hold:F.stance==='assault'?Math.min(14,F.rng):Math.max(3,Math.max(3,F.rng*(F.stance==='kite'?1.3:.55))*Math.max(.3,1-Math.max(0,t-lastDmgT-60)/240));F.tgx=bf.cx-dx*hold;F.tgy=bf.cy-dy*hold}
    // ручной приказ: идти в точку (игрок, сторона 0)
    if(F.side===0&&F.mv){const md=Math.hypot(F.mv.x-F.cx,F.mv.y-F.cy);if(md>6){F.tgx=F.mv.x;F.tgy=F.mv.y;if(F.stance!=='retreat'&&F.stance!=='convoy'){const l=Math.hypot(F.mv.x-F.cx,F.mv.y-F.cy)||1;dx=(F.mv.x-F.cx)/l;dy=(F.mv.y-F.cy)/l}}else F.mv=null}
    // слои по высоте: в бою флоты сближаются по вертикали
    if(F.flank&&dist<420)F.zl+=((F.flank>0?24:-24)-F.zl)*.3;
    // универсальное правило: у кого больше свободного Δv и не меньше силы, тот навязывает бой — идёт к врагу, а не стоит стеной (топливо = инициатива)
    {const E=F.tgt,av=G=>{let a=0,n=0;for(const q of G.ships||[])if(q.alive&&q.dvB){a+=q.dvB.spend;n++}return n?a/n:0};if(TAC.on&&E&&E.n>0&&F.stance!=='retreat'&&!(F.side===0&&F.mv)){const my=av(F);let en=0,es=0,n=0;for(const q of E.ships||[])if(q.alive){const b=belief(F.side,q);en+=b.fu-HOME();es+=b.wp*b.md;n++}en=n?en/n:0;let ms=0;for(const q of F.ships||[])if(q.alive)ms+=q.tur.filter(m=>m.alive).length*q.aliveN/q.total; /* враг оценивается по наблюдениям (belief), не по истине */if(my>TAC.rich&&my>Math.max(.1,en)*TAC.adv&&ms>=es*TAC.str){F.tgx=E.cx;F.tgy=E.cy;F.lead=1}else F.lead=0}}
    F.tdx=dx;F.tdy=dy;
    if(F.n!==F.nSlots||t-F.slotsAt>6){assignSlots(F);F.nSlots=F.n;F.slotsAt=t}
    if(t-F.born<20)for(const q of F.ships)if(!q.placed&&q.slotBack!=null){q.placed=1;const px=-F.dy,py=F.dx;q.x=F.gx-F.dx*q.slotBack+px*q.slotLat;q.y=F.gy-F.dy*q.slotBack+py*q.slotLat;q.sx=q.sy=0;q.hd=Math.atan2(F.dy,F.dx)}
  }
  for(const F of all){const dtf=Math.min(5,Math.max(0,t-(F.pt==null?t:F.pt)));F.pt=t;if(F.tgx==null){F.tgx=F.gx;F.tgy=F.gy;F.tdx=F.dx;F.tdy=F.dy}
    const k=1-Math.exp(-dtf/5),gdx=F.tgx-F.gx,gdy=F.tgy-F.gy,gd=Math.hypot(gdx,gdy)||1,stp=Math.min(gd*k,Math.min(F.minSpd||.45,F.cruise||9)*1.05*dtf);F.gx+=gdx/gd*stp;F.gy+=gdy/gd*stp;F.vgx=gdx/gd*stp/Math.max(dtf,1e-6);F.vgy=gdy/gd*stp/Math.max(dtf,1e-6);F.dx+=(F.tdx-F.dx)*k*.7;F.dy+=(F.tdy-F.dy)*k*.7;const l=Math.hypot(F.dx,F.dy)||1;F.dx/=l;F.dy/=l}
}
function assignSlots(F){ // строй: впереди крепкие, за ними основные стрелки, в хвосте авианосцы, транспорты и ПВО
  const r0=[],r1=[],r2=[],fight=[];
  for(const s of F.ships){if(s.cls==='cv'||s.T.role==='freight'||s.T.role==='supply'||s.cls==='fr')r2.push(s);else fight.push(s)}
  fight.sort((a,b)=>b.T.arm*(1+b.T.L)-a.T.arm*(1+a.T.L));
  const nt=Math.max(1,Math.round(fight.length*.38));fight.forEach((s,i)=>(i<nt?r0:r1).push(s));
  // дальность орудий: каждый ряд встаёт позади переднего ровно на разницу дальностей, чтобы все вступали в огонь одновременно
  const rgOf=o=>{if(o.maxR)return o.maxR;let m=0;for(const q of o.tur)if(q.cfg&&q.cfg.rng&&q.k!=='L'&&q.k!=='M')m=Math.max(m,q.cfg.rng);return m||60};
  for(const o of fight)o.T.dopt=Math.max(14,Math.min(120,rgOf(o)*.8));
  F.rng=F.ships.reduce((a,o)=>a+(o.effR?Math.min(o.T.dopt,o.effR):o.T.dopt),0)/F.n;
  let back=0,frontD=0;
  [[r0,0],[r1,1],[r2,2]].forEach(([row,ri])=>{if(!row.length)return;
    if(ri===0)frontD=row.reduce((a,o)=>a+o.T.dopt,0)/row.length;
    else if(ri===1){const rd=row.reduce((a,o)=>a+o.T.dopt,0)/row.length;back=Math.max(back,rd-frontD)}
    row.sort((a,b)=>b.T.L-a.T.L);const per=Math.min(16,Math.max(4,Math.ceil(Math.sqrt(row.length*2.4)))),lines=Math.ceil(row.length/per);
    row.forEach((s,i)=>{const line=Math.floor(i/per),col=i%per,n=Math.min(per,row.length-line*per),sp=Math.max(.5,s.T.L*2.6+.35);
      s.slotLat=(col-(n-1)/2)*sp+(ri===1||line%2?sp*.5:0);s.slotBack=back+line*1.6;s.row=ri;
      if(F.shape==='wedge')s.slotBack+=Math.abs(s.slotLat)*.7;else if(F.shape==='echelon')s.slotBack+=s.slotLat*.5+ri*1.5}); // клин — острием вперёд; ступени — диагональ, задние стреляют мимо передних
    back+=lines*1.6+(ri===0?3:3.5)});
}
// может ли башня m корабля s (с креном roll, курсом hd+off) бить цель в направлении (ux,uy,vz): полусфера вокруг нормали площадки
const FACE_A=[Math.PI/2,0,-Math.PI/2,Math.PI];
function bearsDir(m,roll,a,vert){const th=FACE_A[m.face||0]+roll,hz=Math.sqrt(Math.max(0,1-vert*vert));return Math.cos(th)*Math.sin(a)*hz+Math.sin(th)*vert>-.25}
function bears(s,m,o){const dx=o.x-s.x,dy=o.y-s.y,dd=Math.hypot(dx,dy,(o.z-s.z)*1)||1;return bearsDir(m,s.roll||0,Math.atan2(dy,dx)-s.hd,(o.z-s.z)/dd)}
function armFrac(s,zi){const z=s.zones[zi];return z.armN/Math.max(1,z.nc*Math.min(255,z.arm))}
function posture(s){ // выбор ракурса и крена: больше башен на цель, а у побитого корабля — самой целой бронёй к врагу
  const o=s.tg;if(!o||!o.alive||t<s.pNext)return;s.pNext=t+R(5,9);
  const dx=o.x-s.x,dy=o.y-s.y,dd=Math.hypot(dx,dy,o.z-s.z)||1,vert=(o.z-s.z)/dd,tur=s.tur.filter(m=>m.alive&&(m.k==='T'||m.k==='L'));if(tur.length<3)return;
  const def=hpf(s)<.55,Q=Math.PI/2;let best=null,bs=-1,cur=-1;
  const fr=[armFrac(s,0),armFrac(s,1),armFrac(s,2)];
  for(const po of def?[0,Q,-Q,Math.PI]:[0])for(let k=0;k<4;k++){const roll=k*Q;let sc=0; // здоровый корабль всегда носом к врагу, боком — только побитый, чтобы подставить целую броню

    for(const m of tur)if(bearsDir(m,roll,-po,vert))sc++;sc/=tur.length;
    if(def){const bow=Math.max(0,Math.cos(po)),str=Math.max(0,-Math.cos(po)),sid=1-Math.abs(Math.cos(po));sc=sc*.35+(fr[0]*bow+fr[2]*str+fr[1]*sid*1.0)*.65+ (po===0?.05:0)}
    const rd=Math.abs(adiff(roll,s.rollT||0))/Math.PI,pd=Math.abs(adiff(po,s.pOff||0))/Math.PI;sc-=.08*rd+.06*pd; // менять ракурс невыгодно без причины
    if(po===(s.pOff||0)&&roll===(s.rollT||0))cur=sc;
    if(sc>bs){bs=sc;best={po,roll}}}
  if(best&&bs>cur+.04){s.pOff=best.po;s.rollT=best.roll}
}
function retarget(s){
  s.nt=t+R(1.2,2.4);{const e=s.tg&&s.tg.alive?s.tg:nearestShip(s.x,s.y,1-s.side)?.s;if(e){const vp=(s.tur.find(m=>m.alive&&m.k==='T')||{cfg:{}}).cfg.vp||VP;s.effR=Math.max(1.5,rangeP(s,e,vp,PMIN*2)*.85)}} /* дистанция, где реально попадаем, — по ней держится и строй */const C=s.F,maxR=s.maxR||60;
  s.near=around(1-s.side,s.x,s.y,maxR*2).filter(o=>o.lock[s.side]>t-5&&o.st!=='surr');
  let best=null,bs=-1e9;const big=s.spec.rails>=14;
  const vpx=Math.max(GV,...s.tur.filter(m=>m.alive&&m.k==='T').map(m=>m.cfg.vp||VP));for(const o of s.near){const d=Math.hypot(o.x-s.x,o.y-s.y);let sc=60*hitP(s,o,vpx,1)-d*.5+(big?val(o)*25:val(o)*8)+(1-hpf(o))*20+(o===C.focus?30*(s.focusW||.5):0);{let r=Math.atan2(o.y-s.y,o.x-s.x)-s.hd;r=Math.atan2(Math.sin(r),Math.cos(r));sc+=Math.cos(r)*35+(o===s.tg?25:0)} /* цель у носа и прежняя — дороже: осевым не нужно ждать разворота */if(C.fire==='weak')sc+=(1-hpf(o))*80;else if(C.fire==='eng'){const hx=Math.cos(o.hd||0),hy=Math.sin(o.hd||0),bx=s.x-o.x,by=s.y-o.y,bl=Math.hypot(bx,by)||1;sc+=Math.max(0,-(hx*bx+hy*by)/bl)*60} /* по слабым — добиваем; по двигателям — кто к нам кормой */if(sc>bs){bs=sc;best=o}}
  if(!best&&t<s.bdo&&s.tg&&s.tg.alive)best=s.tg;
  s.tg=best||null;posture(s);
  // СУО: столько целей, сколько каналов
  const sc2=s.near.map(o=>[-Math.hypot(o.x-s.x,o.y-s.y)*.5+val(o)*8+(1-hpf(o))*20+(o===C.focus?30:0),o]).sort((a,b)=>b[0]-a[0]);
  s.trk=sc2.slice(0,s.ch).map(q=>q[1]);if(best&&!s.trk.includes(best)&&s.ch>0){s.trk.pop();s.trk.unshift(best)}
  if(!s.ch){s.trk=s.near.filter(o=>Math.hypot(o.x-s.x,o.y-s.y)<1);if(s.tg&&!s.trk.includes(s.tg))s.tg=s.trk[0]||null}
}
function turAim(m,s,now){ // плавный поворот башни к цели (~1.6 рад/с) в секторе обстрела: стволы не заходят в корпус
  const tg=s.tg&&s.tg.alive?Math.atan2(s.tg.y-s.y,s.tg.x-s.x):null;
  let want=(m.fa!=null&&m.rt&&now-m.rt<1800)?m.fa:tg!=null?tg:m.fa!=null?m.fa:s.hd;
  const v=m.v||0,ax=m.cfg&&m.cfg.ax,side=!ax&&Math.abs(v)>.28,ctr=side?Math.sign(v)*Math.PI/2:0,hw=ax?.175:side?2.0:2.6; // бортовые — наружу ±115°, осевые ±150°
  let rel=want-s.hd-ctr;rel=Math.atan2(Math.sin(rel),Math.cos(rel));rel=Math.max(-hw,Math.min(hw,rel));const target=ctr+rel;
  if(m.da==null){m.da=target;m.dt=now;return m.da}
  const dt=Math.min(.1,Math.max(0,(now-m.dt)/1000));m.dt=now;
  const d=target-m.da,st=1.6*dt;m.da+=Math.abs(d)<st?d:Math.sign(d)*st;return m.da}
// ФИЗИКА поступательного движения: ограничения тяги (вперёд 100%, назад 35%, вбок 12% × исправность маневровых), импульс, расход по Циолковскому, перемещение, столкновения с камнями. Одна для боя и для прогноза ИИ
function latMax(s,a){return a*.12*(s.rcs0?.25+.75*s.rcsN/s.rcs0:1)}
function actuateMove(s,df,dlt,a,dt,boost,lbl){if(s.__esc)lbl='ПВО';const ch=Math.cos(s.hd),sh=Math.sin(s.hd),lf=latMax(s,a);df=Math.max(-a*.35,Math.min(a,df));dlt=Math.max(-lf,Math.min(lf,dlt));
    {const ax0=(df*ch-dlt*sh)/Math.max(dt,1e-3),ay0=(df*sh+dlt*ch)/Math.max(dt,1e-3);{const k=1-Math.pow(.7,dt);s.aex=(s.aex||0)*(1-k)+ax0*k;s.aey=(s.aey||0)*(1-k)+ay0*k}} /* сглаживание ускорения по времени (τ≈2,8 с), не по числу шагов */s.sx+=df*ch-dlt*sh;s.sy+=df*sh+dlt*ch;s.dvSum=(s.dvSum||0)+Math.hypot(df,dlt);s.dvH=(s.dvH||0)+Math.abs(df);s.dvF=(s.dvF||0)+Math.abs(df);if(s.pb)s.dvP=(s.dvP||0)+Math.abs(df);s.dvL=(s.dvL||0)+Math.abs(dlt);if(!s.gh){const kk=lbl;(stat.dvK=stat.dvK||{})[kk]=(stat.dvK[kk]||0)+Math.hypot(df,dlt)}if(s.fuelCap){s.bst=boost;{const lv=a>0?Math.min(1,Math.hypot(df,dlt)/a)*(1+(boost-1)*1.2):0;{const bt=(dryM(s)+s.fuel)*Math.hypot(df,dlt)/FUEL.ve;s.fuel=Math.max(0,s.fuel-bt);if(!s.gh)stat.mainT=(stat.mainT||0)+bt}void lv /* ракетное уравнение: каждый км/с изменения скорости сжигает топливо, m·Δv/vₑ */}if(s.fuel<=0&&!s.dryFuel){s.dryFuel=1;if(!s.gh){stat.dryFuel=(stat.dryFuel||0)+1;say(s.side,'eng',s)}}}
  s.x+=s.sx*dt;s.y+=s.sy*dt;
  if(env.length)for(const e of env){const dx=s.x-e.x,dy=s.y-e.y,rr=e.r+s.T.L*.3;if(dx>rr||dx<-rr||dy>rr||dy<-rr)continue;const d=Math.hypot(dx,dy)||1;if(d<rr){const nx=dx/d,ny=dy/d;s.x=e.x+nx*rr;s.y=e.y+ny*rr;const vn=(s.sx-(e.vx||0))*nx+(s.sy-(e.vy||0))*ny; // твёрдое тело: выталкиваем из камня и отражаем скорость
    if(vn<0){s.sx-=1.4*vn*nx;s.sy-=1.4*vn*ny;if(!s.gh&&-vn>.04&&t>(s.rockT2||0)){s.rockT2=t+1.5;stat.rock++;hitShip(s,'rock',-dx,-dy,s.x,s.y,Math.min(12,(e.t==='wreck'?4:2)+(-vn)*(e.t==='wreck'?25:10)))}}}}}
// ФИЗИКА разворота: маневровые F = 0,4 МН·∛(т/1000), плечо 0,37·L, I = M·L²/12 → α; расход ṁ = F/vₑ; гашение закрутки
function turnPhys(s,rcsF){const T=s.T,tons=Math.max(1,T.tons||1),Lm=Math.max(5,T.L*1000),Fr=(T.rcsMN?T.rcsMN*1e6:4e5*Math.cbrt(tons/1000))*rcsF*(s.rcsN>0?1:0);return {Fr,al:Fr*.37*Lm/(tons*1000*Lm*Lm/12)}}
function actuateTurn(s,wt,d,dt,R){const Fr=R.Fr,al=R.al;
  s.w=s.w||0;const dw=al*dt;if(s.fuelCap&&s.fuel<=0){s.hd+=s.w*dt}else{const dW=Math.max(-dw,Math.min(dw,wt-s.w));s.w+=dW;if(s.fuelCap&&al>0){const bt=Fr*(Math.abs(dW)/al)/(FUEL.rcsVe*1000)/1000;s.fuel=Math.max(0,s.fuel-bt);if(!s.gh){stat.rcsT=(stat.rcsT||0)+bt;stat.rcsN=(stat.rcsN||0)+1}} /* маневровые тоже жгут топливо: ṁ = F/vₑ */if(Math.abs(d)<1e-3&&Math.abs(s.w)<dw)s.w=0;s.hd+=s.w*dt}
  if(s.spin){s.hd+=s.spin*dt;const L=Math.max(10,s.T.L*1000),dry=s.fuelCap&&s.fuel<=0,al=s.rcsN>0&&!dry?.72*s.acc/L*(s.rcs0?s.rcsN/s.rcs0:1)*(s.dg&&t<s.dgT?.5:1):0,dd=al*dt; // маневровые гасят вращение: α = 6·F·(L/2)/(M·L²/12), F = 12% тяги
    const f=al>0?Math.min(1,Math.abs(s.spin)/dd):0;s.spin=Math.abs(s.spin)<=dd?0:s.spin-Math.sign(s.spin)*dd;if(s.fuelCap&&f){const bs=(s.frate||0)*(.12*f)*(.12*f)*dt*BAT_FUEL_T;s.fuel=Math.max(0,s.fuel-bs);if(!s.gh)stat.spinT=(stat.spinT||0)+bs}}}
// КОНТРОЛЛЕР + исполнение: желаемая скорость (vx,vy × eng) и курс want → команды двигателям → actuateMove/actuateTurn. Один и тот же для боя и для прогноза (s.gh — призрак: без побочных эффектов)
function ctrlStep(s,vx,vy,want,boost,eng,flee,dt){const T=s.T;
  const a=(s.fuelCap&&s.fuel<=0?0:1)*s.acc/1000*eng*dt*(1+(boost-1)*.5),_pl=(t>=(s.vPT||0)||s.ramTg||s.dg&&t<s.dgT||flee||s.ai2)?(s.vPT=t+PLAN_T,s.vTx=vx,s.vTy=vy,1):0,dvx0=s.vTx*eng-s.sx,dvy0=s.vTy*eng-s.sy,dl0=Math.hypot(dvx0,dvy0),fq=s.fuelCap?s.fuel/s.fuelCap:1,db=s.ramTg||s.dockT===t?.003:s.rst==='home'&&s.homeVc!=null?Math.max(.003,Math.min(MOVE.db,s.homeVc*.25,Math.max(.01,(s.homeVd||0)*.5))) /* у базы зона сужается вместе с нужной скоростью — иначе корабль с быстрым перелётом не мог погасить последние 0,05–0,1 км/с */ /* на базу: мёртвая зона меньше скорости перелёта (иначе при полупустом баке зона 0,2 км/с > скорости перелёта — корабль не мог даже набрать курс к базе и дрейфовал прочь) */:fq<.25?MOVE.db*2:MOVE.db,coast=s.dockT!==t&&dl0<Math.hypot(s.sx,s.sy)*MOVE.coast&&(dvx0*s.sx+dvy0*s.sy)<=0===false&&Math.hypot(vx*eng,vy*eng)>Math.hypot(s.sx,s.sy)*.8&&Math.hypot(vx*eng,vy*eng)<Math.hypot(s.sx,s.sy)*1.25&&(vx*s.sx+vy*s.sy)>.97*Math.hypot(vx,vy)*Math.hypot(s.sx,s.sy),hy=s.rst==='home'?(dl0>db?(s.mvOn=1):dl0<db*.3?(s.mvOn=0):s.mvOn):0,off=(dl0<db&&!hy)||coast,dvx=off?0:dvx0,dvy=off?0:dvy0,dl=off?0:dl0; /* на пути к базе — гистерезис: начав поправку, гасим ошибку до 30% зоны, иначе при мелком шаге скорость висела на краю зоны и поправки (с доворотами корпуса) шли чаще — расход зависел от шага физики */ /* coast — идём почти куда надо и почти с нужной скоростью: летим по инерции */ /* мёртвая зона по скорости: мелкие поправки не стоят топлива; при пустеющем баке — шире */
  if(t>=(s.dgN||0)){s.dgN=t+1;if(!(s.dg&&t<s.dgT))s.dg=null;if(s.gh){if(s.ghEv)Object.assign(s,s.ghEv)}else if(!s.ai2&&!s.ramTg&&s.rcsN>0&&s.sc&&s.sc.length&&(!s.fuelCap||!s.dvB||s.dvB.spend>REF.dodge)){ /* уклоняемся, если в бюджете Δv есть лишнее */ /* уклоняемся, только пока в баке больше 40% */let best=1e9; // уклонение: снаряд, который через ≤12 с пройдёт через корабль, — маневровыми вбок от его пути
      const hr=s.T.L*.6+.05;for(const p of proj){if(p.side===s.side||p.g)continue;const rx=s.x-p.x,ry=s.y-p.y;if(rx*rx+ry*ry>3600)continue;const wx=p.vx-s.sx,wy=p.vy-s.sy,w2=wx*wx+wy*wy||1e-9,tc=(rx*wx+ry*wy)/w2;if(tc<0||tc>12||tc>=best)continue;
        const mx=rx-wx*tc,my=ry-wy*tc,md=Math.hypot(mx,my);if(md>hr)continue;if(SNS.on){const dt=p.dt||(p.dt=[-1,-1]);if(dt[s.side]<0){if(!seesP(s,p,Math.sqrt(rx*rx+ry*ry))){stat.blind=(stat.blind||0)+1;continue}dt[s.side]=t}if(t-dt[s.side]<SNS.track)continue}best=tc;const wl=Math.sqrt(w2);s.dg=md>1e-4?{x:mx/md,y:my/md}:{x:-wy/wl,y:wx/wl};s.dgU=0;s.dgT=t+Math.min(4,tc+1);s.dgV=Math.max(0,hr*1.3-md)/Math.max(1,tc)} /* ровно столько боковой скорости, чтобы снаряд прошёл мимо */
      if(best<1e9){stat.dodge=(stat.dodge||0)+1;if(s.cmdLog)s.__ev={dg:{...s.dg},dgU:0,dgT:s.dgT,dgV:s.dgV}}}} /* призрак не видит снарядов: решение уклониться приходит ему как событие из записи */
  { // КОНТРОЛЛЕР: из нужного Δv — команда двигателям (вдоль оси и вбок); физику выполняет actuateMove
    const ch=Math.cos(s.hd),sh=Math.sin(s.hd);let df=dvx*ch+dvy*sh,dlt=-dvx*sh+dvy*ch;
    {const dl2=Math.hypot(df,dlt);if(dl2>1e-9&&Math.abs(df/dl2)<.97&&!(s.dg&&t<s.dgT))df=0;} /* контроллер: главный двигатель включаем, только если нужный импульс почти вдоль оси — иначе тяга уходит вбок впустую */{const lf=latMax(s,a);if(Math.abs(dlt)<MOVE.lat&&!(s.dg&&t<s.dgT)&&!s.ramTg)dlt=0;if(s.dg&&t<s.dgT&&(s.dgU||0)<(s.dgV||0)){const lt2=-s.dg.x*sh+s.dg.y*ch,need=(s.dgV||0)-(s.dgU||0),dd=Math.min(lf,need);dlt=dd*(lt2>=0?1:-1);s.dgU=(s.dgU||0)+dd} /* уклонение — только маневровыми и только на нужную величину */}
    actuateMove(s,df,dlt,a,dt,boost,s.holdK||(flee?'бегство':s.tg?'бой':'строй'))}
  const rcsF=s.gh&&PLN.cache&&s._rcsF!=null&&s._rcsN===s.rcsN?s._rcsF:(s._rcsN=s.rcsN,s._rcsF=(s.rcs0?.15+.85*s.rcsN/s.rcs0:1)*(s.cg?Math.min(sysEff(s,'R'),cmdEff(s)):1)), /* у призрака экипаж за прогноз не меняется — исправность маневровых считаем один раз на прогноз */turn=(.5/(1+Math.pow(T.L/.4,1.7)))*dt*rcsF;s.trn=Math.max(-1,Math.min(1,adiff(s.hd,want)*3))*(s.rcsN>0?1:0); // без маневровых корабль почти не вертится // 1 км — около минуты на разворот, 4 км — минуты
  if(s.gh){if(s.ghWant!=null)want=s.ghWant}else if(!s.ai2){
  {const ax=s.tur.filter(m=>m.alive&&m.cfg&&m.cfg.ax).length,all=s.tur.filter(m=>m.alive&&m.k!=='G'&&m.k!=='A').length;if(ax&&ax*2>=all&&!flee&&!s.rf&&s.tg&&s.tg.alive&&Math.hypot(s.tg.x-s.x,s.tg.y-s.y)<(s.maxR||60)*1.2)want=Math.atan2(s.tg.y-s.y,s.tg.x-s.x)} // общее правило: главный калибр осевой — нос на свою цель, когда она в дальности
  {const rt=s.ramTg||(t<(s.ramT||0)+RAM.cd&&s.ramLast&&s.ramLast.alive&&s.ramLast.side!==s.side&&Math.hypot(s.ramLast.x-s.x,s.ramLast.y-s.y)<1?s.ramLast:null);if(rt&&rt.alive)want=Math.atan2(rt.y-s.y,rt.x-s.x)} // таран — носом вперёд; после удара держим нос (70 см) к врагу, не подставляем тонкую корму
  }if(s.cmdLog)s.__wantF=want; // поворот носа к цели осевых орудий / тарана — решение ИИ по миру; призраку приходит готовым курсом
  { // КОНТРОЛЛЕР разворота: нужная угловая скорость к курсу want (мёртвая зона 2°); физику выполняет actuateTurn
    const R=turnPhys(s,rcsF),d=adiff(s.hd,want),ad=Math.abs(d);if(ad>.035)s.trnOn=1;else if(ad<.006||!MOVE.thy&&s.rst!=='home'&&ad<.035)s.trnOn=0; /* гистерезис: начав доворот, доводим курс почти точно (до 0,3°), а не до края зоны 2° — иначе при мелком шаге курс висел на краю и доворачивался снова и снова (расход маневровых зависел от шага физики) */const wt=!s.trnOn?0:Math.sign(d)*Math.min(Math.sqrt(2*R.al*Math.abs(d))*.9,Math.abs(d)/Math.max(dt,MOVE.tau) /* постоянная времени доворота — в секундах боя, а не «за один шаг»: при мелком шаге малые довороты шли рывком на пиковой скорости, и расход маневровых рос с уменьшением шага (×4,6 от 0,5 до 0,0625 с) */,s.rst==='home'?Math.max(.002,Math.abs(d)/RET.slew):1e9); /* на пути к базе спешить некуда: разворот экономный (расход маневровых ∝ угловой скорости) */ /* не перелетать за шаг: при крупном шаге «оптимальное торможение» давало колебания курса и лишний расход маневровых */actuateTurn(s,wt,d,dt,R)}
return a}
// ПРОГНОЗ: копия состояния корабля (призрак) прогоняется через тот же ctrlStep с тем же физическим шагом dt. Настоящий корабль и бой не меняются
const GH_KEYS=['x','y','z','sx','sy','vx','vy','hd','w','spin','fuel','fuelCap','acc','engN','rcsN','rcs0','radN','bst','dg','dgT','dgU','dgV','dgN','vPT','vTx','vTy','dvx','dvy','aex','aey','dryFuel','ramTg','ramT','ramLast','tg','sc','scl','dvB','holdK','pb','trn','ai2','dvSum','dvH','dvF','dvP','dvL'];
function ghostOf(s){const g={T:s.T,side:s.side,tur:s.tur,zones:s.zones,core:s.core,F:s.F,uid:s.uid,gh:1};for(const k of GH_KEYS)g[k]=s[k]&&typeof s[k]==='object'&&!Array.isArray(s[k])&&!s[k].T?{...s[k]}:s[k];return g}
// cmds — список [vx,vy,want,boost,eng,flee,dt] (как пишет cmdLog); возвращает состояние призрака после каждого шага
function predictCmds(s,cmds,tStart){const g=ghostOf(s),out=[];const t0=t;if(tStart!=null)t=tStart;const fn=typeof cmds==='function';try{for(let i=0;;i++){const c=fn?cmds(g,i):cmds[i];if(!c)break;t+=c[6];const e=c[7];if(e){g.sx+=e.dsx;g.sy+=e.dsy;g.x+=e.dx;g.y+=e.dy;g.fuel+=e.dfu;g.w=(g.w||0)+e.dw;g.hd+=e.dhd;g.rcsN=e.rcsN;g.spin=e.spin;g.ramTg=e.ramTg}g.ghEv=c[8];g.ghWant=c[10]!=null?c[10]:null;ctrlStep(g,c[0],c[1],c[2],c[3],c[4],!!c[5],c[6]);out.push({x:g.x,y:g.y,sx:g.sx,sy:g.sy,hd:g.hd,w:g.w||0,fuel:g.fuel,m:dryM(g)+(g.fuel||0)})}}finally{t=t0}return out} // время боя для призрака идёт вперёд, как в step(), потом возвращается
// исполнение плана в бою: внеочередной пересмотр (новый замеченный снаряд, удар, цель в зоне тарана), команда — та же функция намерения, что в прогнозе, с живыми целью и строем, пересчёт раз в PLN.pu с
const FR_=k=>{const S=stat.fc=stat.fc||{};(S.fr=S.fr||{})[k]=(S.fr[k]||0)+1};
function ai2Step(s,g,eng,dt,F){let force=false;{const C=s.epC;if(C&&!C.done&&t>=C.t0+30&&C.g.alive){C.done=1;if(t-C.t0-30<=dt*1.5+1e-9){const e=p=>Math.hypot(p.x-C.g.x,p.y-C.g.y)*1000;const E=(stat.ep=stat.ep||{n:0,lin:0,mean:0,best:0,man:0});E.n++;E.lin+=e(C.l);E.mean+=e(C.m);E.best+=Math.min(...C.S.map(e));if(e(C.l)>500)E.man++;if(C.r){const Lk=C.S.map(p=>Math.exp(-((e(p)/1000)**2))),z=Lk.reduce((a,b)=>a+b,0);if(z>.05){const n=C.r.wn||(C.r.wn=[0,0,0]);for(let i=0;i<3;i++)n[i]=n[i]*.97+Lk[i]/z}}}}} /* правдоподобие каждого сценария (σ = 1 км) — веса для этой цели */if(t-(s.ai2Last??-1e9)>dt*1.5+1e-9)s.planP=null;else if(s.__a2p){const P=s.__a2p,jv=Math.hypot(s.sx-P.sx,s.sy-P.sy),jx=Math.hypot(s.x-P.x,s.y-P.y);if(jv>.01||jx>.1){s.rplNeed=1;FR_(9);s.planExt=1;stat.extJ=(stat.extJ||0)+1}}s.ai2Last=t; /* внешний толчок (удар, таран, отдача, камень) — пересмотр плана */ /* был перерыв в управлении планом — старый прогноз не сравниваем */if(t>=(s.rplN||0)){
    if(t>=(s.thN||0)){s.thN=t+1;const th=threatsOf(s);const ws=s.thSeen||(s.thSeen=new WeakSet());for(const h of th)if(!ws.has(h.p)){ws.add(h.p);force=(FR_(1),true)}}
    if((s.hitT||-1)>(s.hitSeen||-1)){s.hitSeen=s.hitT;force=(FR_(2),true)}
    {const r=trackOf(s.side,g);if(r&&r.jt>(s.jSeen??-1)){s.jSeen=r.jt;force=(FR_(3),true)}} // цель заметно сменила манёвр
    if(s.rplNeed){s.rplNeed=0;force=(FR_(4),true)}
    if(RAM.on&&g.T&&s.T.tons>=g.T.tons*RAM.mass&&s.zones[0].arm>=RAM.nose&&(r0=>r0&&Math.hypot(r0.x-s.x,r0.y-s.y)<RAM.dist)(trackOf(s.side,g))&&!(s.plan&&s.plan.I&&s.plan.I.mode==='ram')&&!s.ramIn){s.ramIn=1;force=(FR_(5),true)}
    if(force)s.rplN=t+PLN.rpl}
  {const r0=trackOf(s.side,g);if(!r0||Math.hypot(r0.x-s.x,r0.y-s.y)>=RAM.dist)s.ramIn=0}
  const c=plan2(s,g,eng,dt,F,force);
  if(c!==s.planX){s.planX=c;s.intT0=t;s.intN=-1;const S0=F&&F.gx!=null?F:null;s.intF=intentCmd(c.I,()=>{const r=trackOf(s.side,g)||c.rg0;const T=t-r.t;return {x:r.x+r.sx*T,y:r.y+r.sy*T,sx:r.sx,sy:r.sy}},()=>S0?slotNow(s,S0):{x:s.x,y:s.y,vx:s.sx,vy:s.sy},eng);
    if(c.I.dodge){s.dg={x:c.I.dodge.x,y:c.I.dodge.y};s.dgU=0;s.dgT=t+c.I.dodge.T;s.dgV=c.I.dodge.V;stat.dodge=(stat.dodge||0)+1;if(s.task){const st=stat.fc=stat.fc||{};st.override=(st.override||0)+1}}} // уклон при задаче: корабль сам отвлекается на непосредственную угрозу
  if(t>=(s.intN||-1)-1e-9){s.intN=t+(PLN.pu||dt);s.ai2v=s.intF(s,t-s.intT0)}
  s.ramTg=c.I.mode==='ram'&&Math.hypot(g.x-s.x,g.y-s.y)<RAM.dist?g:null}
// АВТОМАТ ОТХОДА: боеспособен → подготовка → отход → (вне досягаемости clear с) перегруппировка → возвращение (целость ≥ hpOut и есть Δv) → боеспособен;
// отход без отрыва try с, а враг ближе, чем в начале, — «прижат»: бой (бесконечно бегать от быстрого противника бессмысленно); перегруппировка, а враг снова рядом — отход.
// Всё по наблюдаемому: свои модули и топливо, сопровождаемые врагами положения и их оружие по проекту.
function repPossible(s){if(!s.cg||s.crN<=0)return false;for(const z of s.zones)if(!z.brk)for(const m of z.mods)if(!m.alive&&(m.kres>0||s.kits>=(KIT.cost[m.k]||1)*(m.wreck?KIT.wreckK:1)-1e-9))return true;return false} // ремонт возможен: есть выбитый модуль и на него набор (уже выданный или на складе) и люди
function retreatState(s,hp,dt){if(s.T.role)return false;let st=s.rst||'ok';
  // топливо: свободного Δv не осталось (с резервом возвращения и торможения) — уходим на базу, в бой больше не возвращаемся без дозаправки
  if(s.fuelCap&&s.dvB&&!s.dvB.tk&&s.dvB.spend<=RET.crit&&st!=='home'&&!s.T.role){const S=stat.rs=stat.rs||{},k=s.side+':'+st+'→home';S[k]=(S[k]||0)+1;s.rst='home';s.rsT=t;s.homeWhy=s.engN<=0?'топливо на исходе, двигатели выбиты — дрейф':'топливо: остался только резерв возвращения ('+s.dvB.dvr.toFixed(2)+' км/с, нужно '+s.dvB.rp.need.toFixed(2)+')';(stat.fuelOut=stat.fuelOut||[0,0])[s.side]++;return true}
  if(st==='home')return true;const nn=nearestShip(s.x,s.y,1-s.side),reach=nn?(nn.s.maxR||60)*1.3:0,inR=!!nn&&nn.d<reach;
  const F=s.F,grp=FC.grp&&F&&F.n>=3;
  if(st==='ok'||st==='return'){if(hp<RT.hpIn){if(grp&&F.retFrac>=RT.maxFrac&&hp>RT.hpIn*.5&&(F.str==null||F.str>=RT.lose)){const C2=stat.fc=stat.fc||{};C2.cov=C2.cov||{};C2.cov.held=(C2.cov.held||0)+1} /* флот: половина уже отходит, силы не проиграны, корабль не при смерти — остаётся в бою, чтобы не бросить уходящих */else{st='prep';s.rsT=t}}else if(st==='return'&&t-s.rsT>=RT.ret)st='ok'}
  else if(st==='prep'){if(t-s.rsT>=RT.prep&&!(grp&&F.cvWait&&F.cvWait.has(s)&&hp>RT.hpIn*.5&&t-s.rsT<RT.cw)){st='retreat';s.rsT=t;s.rsD0=nn?nn.d:1e9;s.rsC=0}else if(grp&&F.cvWait&&F.cvWait.has(s)){const C2=stat.fc=stat.fc||{};C2.cov=C2.cov||{};C2.cov.wait=(C2.cov.wait||0)+1}} /* отход начинается, когда назначено прикрытие (или ждали RT.cw с) */
  else if(st==='retreat'){s.rsC=inR?0:(s.rsC||0)+dt;if(s.rsC>=RT.clear){st='regroup';s.rsT=t}else if(t-s.rsT>RT.try&&inR&&nn.d<s.rsD0*.9){st='cornered';s.rsT=t}}
  else if(st==='regroup'){if(inR&&nn.d<reach*.8){st='retreat';s.rsT=t;s.rsD0=nn.d;s.rsC=0}else if(hp>=RT.hpOut&&s.dvB&&s.dvB.spend>RET.crit*4){st='return';s.rsT=t}else if(!repPossible(s)&&t-s.rsT>RT.exit){if(hp>=.3&&s.dvB&&s.dvB.spend>RET.crit*4){st='return';s.rsT=t}else{st='home';s.rsT=t;s.homeWhy='ремонт невозможен (нет наборов или людей) — уходит на базу'}}} /* ждать ремонта, которого не будет, бессмысленно */
  else if(st==='cornered'){if(hp>=RT.hpOut){st='return';s.rsT=t}else if(!inR){st='regroup';s.rsT=t}} // прижатый, но отремонтировавшийся — снова в строю
  if(st!==(s.rst||'ok')){const S=stat.rs=stat.rs||{};const k=s.side+':'+(s.rst||'ok')+'→'+st;S[k]=(S[k]||0)+1;s.rst=st}
  return st==='prep'||st==='retreat'||st==='regroup'}
function steer(s,dt){
  if(s.derelict){s.x+=s.sx*dt;s.y+=s.sy*dt;s.hd+=((s.w||0)+(s.spin||0))*dt;s.flee=false;s.ai2=0;return} // необитаемый остов: ни тяги, ни маневровых — летит по инерции, вращается как было

  s.ai2=0;const T=s.T,F=s.F,eng=(s.cg?(s.engN>0?Math.max(.05,sysEff(s,'E')):0):Math.max(.15,s.engN/T.eng))*(t<s.blk?.2:1), /* тяга — исправные и обслуживаемые двигатели */hp=hpf(s);let vm=.2*VMK*T.spd,boost=1;s.raidV=0;if(s.st==='surr'||T.role==='station')vm=0;
  if(t>=s.nt||(s.tg&&!s.tg.alive))retarget(s);
  if(t>=s.next){s.next=t+R(6,14);s.sdir=rnd()<.5?1:-1}
  const tg=s.tg;let vx=0,vy=0,want=s.hd;
  const formed=F.formed!==false&&F.n>=3&&!(t<s.bdo),retreating=F.stance==='retreat'&&!F.convoy,flee=(PLN.rtr?retreatState(s,s.cg?Math.min(hp,.15+.85*Math.min(s.capW??1,Math.max(s.capE??1,.3))):hp,dt):(hp<.35&&!T.role))||(F.stance==='cover'&&hp<.45&&!T.role)||(retreating&&!formed)||s.st==='panic'||(s.dry&&!T.role),tdx=tg?tg.x-s.x:F.dx,tdy=tg?tg.y-s.y:F.dy,td=Math.hypot(tdx,tdy)||1,ux=tdx/td,uy=tdy/td;
  s.flee=flee;
  {const f=s.fl;if(flee&&!f){s.fl={t,hp:s.aliveN,fu:s.fuel||0,safe:null,ret:0,on:1};const S=stat.rt=stat.rt||{n:0};S.n++}else if(f){if(!flee&&f.on)f.ret++;f.on=flee?1:0;if(flee&&f.safe==null){const nn=nearestShip(s.x,s.y,1-s.side);if(!nn||nn.d>(nn.s.maxR||60)*1.3)f.safe=t-f.t}}} // отход: начало, модули и топливо в этот момент, когда вышел из досягаемости врага, сколько раз вернулся в бой
  // приказы отдельным кораблям: охранять крупного, прятаться за укрытием, отход
  const ord=s.ord||'auto'; /* сопровождение только по приказу: само по себе оно гоняло фрегаты за кораблём и сжигало топливо */let hold=null;
  if(ord==='retreat'&&tg&&!flee){vx=-ux*vm;vy=-uy*vm;want=Math.atan2(-uy,-ux);s.flee=true;hold={x:s.x-ux*50,y:s.y-uy*50,face:null,spd:1}}
  else if(!flee&&!T.role){
    if(ord==='escort'){let big=s.escT&&s.escT.alive&&t<s.escN?s.escT:null;
      if(!big){s.escN=t+5;let bl=0;for(const o of around(s.side,s.x,s.y,260)){if(o===s||!o.alive||o.T.role||o.st==='surr')continue;if(o.T.L>=s.T.L*1.6&&o.T.L>bl){bl=o.T.L;big=o}}s.escT=big}
      if(big){if(!s.escF||t>s.escFN){s.escFN=t+20;s.escF=nearestShip(big.x,big.y,1-s.side)}const fo=s.escF&&s.escF.s.alive?s.escF:null,ax=fo?fo.s.x-big.x:F.dx,ay=fo?fo.s.y-big.y:F.dy,al=Math.hypot(ax,ay)||1,off=big.T.L*.55+s.T.L*1.3+1.2,sd=((s.uid%3)-1)*(s.T.L+.8);
        hold={x:big.x+ax/al*off-ay/al*sd,y:big.y+ay/al*off+ax/al*sd,face:fo?Math.atan2(ay,ax):null,spd:1,escort:1,vx0:big.sx||0,vy0:big.sy||0}}} /* сопровождение: точка у корабля держится 20 с, к скорости — скорость охраняемого */
    if(!hold&&(ord==='cover'||ord==='auto')&&tg&&s.T.L<1.4){
      if(t>=(s.cvN||0)){s.cvN=t+R(3,5);let rdy=0,tot=0,cdm=1e9;for(const m of s.tur)if(m.alive&&(m.k==='T'||m.k==='L')){tot++;if(m.cd<=1)rdy++;cdm=Math.min(cdm,m.cd)}
        if(!(s.cp&&t<s.cp.until)){s.cp=null;
          const fq=s.fuelCap?s.fuel/s.fuelCap:1,reload=tot>0&&rdy/tot<.3&&cdm>20&&fq>.3&&tg&&Math.hypot(tg.x-s.x,tg.y-s.y)<(s.maxR||60)&&t-(s.hitT||-99)<40; /* прятаться — только если враг в дальности и по нам уже бьют */ /* перезарядка долгая — спрятаться за камень, пока заряжаемся */
          if(tot>0&&(reload||(rdy/tot<.2&&t-s.hitT<15)||(ord==='cover'&&rdy/tot<.5)||hp<.5&&t-s.hitT<10)){
            let best=null,bd=1e9;
            for(const e of env){const d=Math.hypot(e.x-s.x,e.y-s.y);if(d<(reload?Math.min(80,cdm*Math.max(.05,Math.hypot(s.sx,s.sy)+.1)):170)&&d<bd&&e.r>=s.T.L*.3){bd=d;best={x:e.x,y:e.y,r:e.r+s.T.L*.55+1.5}}}
            for(const o of around(s.side,s.x,s.y,120)){if(o===s||!o.alive||o.T.L<s.T.L*1.4)continue;const d=Math.hypot(o.x-s.x,o.y-s.y);if(d<bd){bd=d;best={x:o.x,y:o.y,r:o.T.L*.5+s.T.L*.55+1}}}
            if(best){const ax=best.x-tg.x,ay=best.y-tg.y,al=Math.hypot(ax,ay)||1;s.cp={x:best.x+ax/al*best.r,y:best.y+ay/al*best.r,until:t+(reload?Math.max(10,cdm-5):R(25,45))};stat.cover=(stat.cover||0)+1}}}}
      if(s.cp&&t<s.cp.until)hold={x:s.cp.x,y:s.cp.y,face:Math.atan2(uy,ux),spd:.9,cover:1}}
  }
  if(tg)s.lastTg=t;else if(s.lastTg==null)s.lastTg=t;
  if(!hold&&!tg&&!flee&&!T.role&&s.T.eng>0&&t-s.lastTg>40&&F.n<2){ /* одиночка без цели сам ищет врага; в группе ведёт строй — без рывков туда-обратно */ // потеряли врага из виду и стоим: идём к ближайшему вражескому кораблю, а не ждём на месте
    const nn=nearestShip(s.x,s.y,1-s.side);if(nn&&nn.s&&nn.s.alive&&nn.d>6)hold={x:nn.s.x,y:nn.s.y,face:null,spd:.9}}
  s.holdK=hold&&(hold.cover?'cover':hold.escort?'escort':'');
  if(s.cool&&!flee&&!hold&&!T.role){s.br='cool';const nn=nearestShip(s.x,s.y,1-s.side),safe=nn?Math.max(40,(nn.s.maxR||60))*HEAT.safe:0;if(nn&&nn.d<safe){const ax=s.x-nn.s.x,ay=s.y-nn.s.y,al=Math.hypot(ax,ay)||1;vx=ax/al*HEAT.coolV+(nn.s.sx||0);vy=ay/al*HEAT.coolV+(nn.s.sy||0)}else{vx=(F.vgx||0)*.5;vy=(F.vgy||0)*.5}want=s.hd} // остывает: спокойно выходит за дальность врага, дальше дрейф без тяги; нос не крутим
  else if(flee&&tg&&!hold){s.br='flee';
    // ОТХОД ЧЕРЕЗ ПЛАНИРОВЩИК: те же варианты манёвра (отход бронёй/носом, уклонения, импульсы) по прогнозу врагов, с ролью «отход» — штраф за пребывание в досягаемости их оружия;
    // корабль видит, догонят ли его (прогноз сценариев врага), не разворачивается кормой под огонь без нужды и не тратит Δv сверх резерва. Прежнее «прямо от цели» — при PLN.rtr=0
    if(PLN.rtr&&s.rst==='home'){} /* на базу: курс задаётся ниже, перед исполнением */
    else if(PLN.rtr&&s.rst==='regroup'){const fr=ships.filter(o=>o.alive&&o.side===s.side&&o!==s&&!o.flee&&!o.T.role);if(fr.length){let cx=0,cy=0,vx2=0,vy2=0;for(const o of fr){cx+=o.x;cy+=o.y;vx2+=o.sx;vy2+=o.sy}cx/=fr.length;cy/=fr.length;vx2/=fr.length;vy2/=fr.length;const ex=cx-ux*FC.back*3-s.x,ey=cy-uy*FC.back*3-s.y,ed=Math.hypot(ex,ey)||1,vc=Math.min(.2,ed/120);vx=vx2+ex/ed*vc;vy=vy2+ey/ed*vc}else{vx=s.sx;vy=s.sy}want=Math.atan2(uy,ux);stat.rgT=(stat.rgT||0)+dt} /* перегруппировка: за линией своих, бронёй к врагу; один — по инерции, топливо не жжём */
    else if(PLN.rtr&&PLN.ai2&&s.fuelCap&&s.dvB&&tg.alive&&trackOf(s.side,tg)){s.ai2=1;ai2Step(s,tg,eng,dt,F);vx=s.ai2v[0];vy=s.ai2v[1];want=s.ai2v[2];stat.rtrT=(stat.rtrT||0)+dt}
    else{vx=-ux*vm;vy=-uy*vm;want=Math.atan2(-uy,-ux);if(td<120)boost=1.5}}
  else if(hold){s.br='hold:'+(s.holdK||'');const ex=hold.x-s.x,ey=hold.y-s.y,ed=Math.hypot(ex,ey)||1,sp=Math.min(vm*hold.spd,ed*.25+.005);vx=ex/ed*sp+(hold.vx0||0);vy=ey/ed*sp+(hold.vy0||0);want=hold.face!=null?hold.face:ed>6?Math.atan2(vy,vx):(tg?Math.atan2(uy,ux):Math.atan2(F.dy,F.dx));if(ed>60)boost=Math.max(boost,Math.min(1.6,1+(ed-60)/150))}
  else{
    // формация
    const fx=F.dx,fy=F.dy,px=-fy,py=fx,Px=F.gx-fx*(s.slotBack||0)+px*(s.slotLat||0),Py=F.gy-fy*(s.slotBack||0)+py*(s.slotLat||0);
    let ex=Px-s.x,ey=Py-s.y;const ed=Math.hypot(ex,ey)||1;
    if(F.n<2||!F.minSpd)F.minSpd=F.minSpd||vm;
    if(!F.spdAt||t-F.spdAt>5){F.spdAt=t;F.minSpd=.2*VMK*Math.min(...F.ships.slice(0,40).map(o=>o.T.spd))}
    const fvm=Math.min(vm,Math.min(F.minSpd,F.cruise||9)*1.15),tol=Math.max(1.5,s.T.L*15),sp=ed>40?vm:ed<tol?0:Math.min(fvm,(ed-tol)*.04+.004); /* в пределах допуска места в строю — просто идём со скоростью флота; дальше — мягко, без раскачки */
    // экстренное ускорение: догнать строй / вовремя встать на место
    if(ed>70)boost=Math.min(2,1+(ed-70)/120);
    let fvx=ex/ed*sp+(F.vgx||0),fvy=ey/ed*sp+(F.vgy||0); // к месту в строю + скорость самого строя: корабли идут вместе, а не догоняют рывками
    const er=Math.max(s.maxR,F.stance==='kite'?F.hold:0);let dopt=t<s.bdo?5:F.stance==='kite'?F.hold:F.stance==='assault'?14:T.dopt;
    if(tg&&tg.maxR&&tg.maxR>s.maxR*1.05&&F.stance!=='kite')dopt=Math.min(dopt,Math.max(8,s.maxR*.4));if(tg&&F.stance!=='kite'){const vp=(s.tur.find(m=>m.alive&&m.k==='T')||{cfg:{}}).cfg.vp||VP;dopt=Math.min(dopt,Math.max(1.5,rangeP(s,tg,vp,PMIN*2)*.85))}
    if(tg&&F.stance!=='kite'&&GCLOSE.on){const rl=s.tur.filter(m=>m.alive&&m.k==='T'),gt=s.tur.some(m=>m.alive&&m.k==='G');if(gt&&(!rl.length||rl.every(m=>m.cd>GCLOSE.wait)))dopt=Math.min(dopt,GCLOSE.r)} // рельсы долго заряжаются или их нет — подходим на дистанцию гатлингов // идём на дистанцию, где орудия реально попадают (шанс ≥ 2×порога) // враг бьёт дальше — сближаемся, а не пятимся
    let tk0=null;if(s.rf&&s.rf.alive){tk0=s.rf;const dx=tk0.x-s.x,dy=tk0.y-s.y,d=Math.hypot(dx,dy)||1,ap=Math.min(s.rfV||.5,Math.sqrt(2*s.acc/1000*Math.max(0,d-REF.dist*.5))*.6);vx=(tk0.sx||0)+dx/d*ap;vy=(tk0.sy||0)+dy/d*ap;want=Math.atan2(dy,dx)} // на заправку: к танкеру, сравнять скорость и встать рядом
    else if(s.tnk){const c=sideC(s.side),e=sideC(1-s.side);let dx=c.x-e.x,dy=c.y-e.y;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;const bx=c.x+dx*REF.back,by=c.y+dy*REF.back,ex2=bx-s.x,ey2=by-s.y,ed2=Math.hypot(ex2,ey2)||1,v2=Math.min(sp,ed2*.05);vx=ex2/ed2*v2;vy=ey2/ed2*v2;if(ed2>5)want=Math.atan2(ey2,ex2)} // танкер держится далеко за своими, на линии от противника
    else if(T.role==='supply'||s.tnk){const n=Math.max(1,F.n),cx=F.gx,cy=F.gy;let dx=F.dx||0,dy=F.dy||0;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;const bx=cx-dx*(60+n*3),by=cy-dy*(60+n*3),ex2=bx-s.x,ey2=by-s.y,ed2=Math.hypot(ex2,ey2)||1,v2=Math.min(sp,ed2*.1);vx=ex2/ed2*v2;vy=ey2/ed2*v2}
    else if(T.role==='freight'||F.stance==='convoy'&&T.role){vx=fvx;vy=fvy}
    else if(tg&&s.raider&&!s.rf&&td<Math.max(er*3,150)&&!(PLN.icp&&FC.on&&PLN.ai2&&s.task&&s.task.tg)){ /* при командовании перехватчик ведёт планировщик с ролью «перехват»; прежние наскоки — PLN.icp=0 */ // перехватчик: разгон мимо цели на сближении (дальность и пробитие растут с относительной скоростью), проскок, отход, разворот
      const cl=closing(s,tg);if(!s.rd)s.rd='in';
      if(s.rd==='in'&&cl<0&&td>Math.max(3,tg.T.L*3))s.rd='out';
      else if(s.rd==='out'&&td>Math.max(40,s.maxR*.8))s.rd='in';
      if(s.rd==='in'){const sd=s.uid%2?1:-1,off=Math.max(1.5,tg.T.L*2)+td*CAV.arc,ax=tg.x-uy*off*sd-s.x,ay=tg.y+ux*off*sd-s.y,al=Math.hypot(ax,ay)||1;vx=ax/al*vm*3;vy=ay/al*vm*3;want=Math.atan2(tg.y-s.y,tg.x-s.x)} /* нос на цель: осевые орудия смотрят туда же */
      else{vx=s.sx/Math.max(eng,.05);vy=s.sy/Math.max(eng,.05);want=Math.atan2(tg.y-s.y,tg.x-s.x)} // отход по инерции, нос держит цель
      boost=1.4;s.raidV=1}
    else if(tg&&(td<er*1.5||t<s.bdo)){s.br='combat';
      const dd=td-dopt,bnd=Math.max(10,dopt*.5),k=(Math.abs(dd)<bnd?0:Math.max(-1,Math.min(1,(dd-Math.sign(dd)*bnd)/20)))*Math.min(1,Math.abs(dd)/Math.max(1e-3,vm*240)), /* в полосе дистанции не дёргаемся; к цели — со скоростью, чтобы дойти за ~4 мин, а не на форсаже */lat=0,w=F.n>=2&&F.stance!=='assault'?.75:formed?.93:F.stance==='kite'?.15:s.cls==='hc'||s.cls==='cv'?.55:.25; /* в группе дистанцию держит вся группа, а не каждый корабль сам — без рывков между целями */
      let rx=ux*vm*k*.85-uy*lat,ry=uy*vm*k*.85+ux*lat;want=Math.atan2(uy,ux)+(td<er*.9?(s.pOff||0):0);
      
      vx=w*fvx+(1-w)*rx;vy=w*fvy+(1-w)*ry;if(retreating)want=Math.atan2(vy,vx);
      // тактика при запасе топлива: свободный Δv > TAC.rich — флот бьёт одну цель, держит дистанцию вне её орудий (если наши бьют дальше) и заходит ей в корму (там броня тонкая)
      s.tac=0;if(PLN.on&&!retreating&&s.fuelCap&&s.dvB){ // единый планировщик: общая цель флота + выбор манёвра по оценке вариантов
        if(!F.fT||t>F.fT||!(F.focus&&F.focus.alive)){F.fT=t+TAC.re;let b=null,bs=1e18;for(const o of ships){if(!o.alive||o.side===s.side||!o.T||o.st==='surr')continue;const d=Math.hypot(o.x-s.x,o.y-s.y);if(d>Math.max(er*2,150))continue;const e=belief(s.side,o),sc=e.md*o.T.tons*(1+d/200)/(1+e.wp*.2);if(sc<bs){bs=sc;b=o}}F.focus=b}
        const g=(FC.on&&taskTarget(s,F))||F.focus||tg;if(g&&g.alive&&PLN.ai2&&trackOf(s.side,g)){s.tg=g;s.ai2=1;ai2Step(s,g,eng,dt,F);vx=s.ai2v[0];vy=s.ai2v[1];want=s.ai2v[2];s.tac=1;stat.tac=(stat.tac||0)+dt;const kk=s.plan.k.replace(/·уклон.$/,'');(stat.pk=stat.pk||{})[kk]=(stat.pk[kk]||0)+dt}
        else if(g&&g.alive){s.tg=g;const c=plan(s,g,eng,dt);if(c){vx=c.vx/Math.max(eng,.05);vy=c.vy/Math.max(eng,.05);want=Math.atan2(g.y-s.y,g.x-s.x);s.tac=1;stat.tac=(stat.tac||0)+dt;(stat.pk=stat.pk||{})[c.k]=(stat.pk[c.k]||0)+dt}}}
      if(F.stance==='assault'&&td>s.maxR*.7)boost=Math.max(boost,1.7);
      else if(F.stance==='kite'&&td<F.hold*.6)boost=Math.max(boost,1.4);
    }else{s.br='form';vx=fvx;vy=fvy;if(retreating&&sp>.02)want=Math.atan2(vy,vx);else if(tg)want=Math.atan2(uy,ux);else if(sp>.02&&ed>6)want=Math.atan2(vy,vx);else if(F.dx!=null&&(F.dx||F.dy))want=Math.atan2(F.dy,F.dx);
      if(F.stance==='assault'&&tg)boost=Math.max(boost,1.5)}
  }
  if(env.length)for(const e of env){const dx=s.x-e.x,dy=s.y-e.y,rr=e.r+T.L*.25+(e.t==='wreck'?1:8); /* обломки мелкие — их замечают поздно */if(dx>rr||dx<-rr||dy>rr||dy<-rr)continue;const d=Math.hypot(dx,dy)||1;if(d<rr){const f=Math.max(vm,.1)*(1-d/rr)*1.6;vx+=dx/d*f;vy+=dy/d*f;
    if(d<e.r+T.L*.2&&t>(s.rockT||0)){s.rockT=t+4;s.sx*=.4;s.sy*=.4;stat.rock++;hitShip(s,'rock',-dx,-dy,s.x,s.y,5);say(s.side,'rock',s)}}}
  const sv0x=vx,sv0y=vy;
  // разлёт: не стоять друг за другом на линии огня и не кучковаться
  for(const o of around(s.side,s.x,s.y,6,20)){if(o===s)continue;const dx=s.x-o.x,dy=s.y-o.y,dz=s.z-o.z,d0=Math.hypot(dx,dy)||1e-6,sr=Math.max(.9,(s.T.L+o.T.L)*1.1),d=Math.hypot(d0,dz*1.5);
    if(d<sr){const f=.2*(sr-d)/sr/d;vx+=dx*f;vy+=dy*f;s.zpush=(s.zpush||0)+(dz>=0?1:-1)*(sr-d)/sr*(1+Math.abs(dz)*0)}
    if(Math.abs(dz)>sr*.8)continue;
    if(tg&&!formed){const al=(-dx)*ux+(-dy)*uy,pp=(-dx)*(-uy)+(-dy)*ux; // o перед нами на линии на врага
      if(al>0&&Math.abs(pp)<o.T.L*.5+.8){const sg=pp>=0?-1:1,f=.12*vm*(1-Math.abs(pp)/(o.T.L*.5+.8));vx+=-uy*sg*f*3;vy+=ux*sg*f*3}}}
  if(s.ai2&&Math.hypot(vx-sv0x,vy-sv0y)*eng>.05)s.rplNeed=1; // разлёт заметно поправил команду плана — план надо пересмотреть
  if(!s.ai2){const kf=Math.min(1,dt*.35);s.dvx=s.dvx==null?vx:s.dvx+(vx-s.dvx)*kf;s.dvy=s.dvy==null?vy:s.dvy+(vy-s.dvy)*kf;vx=s.dvx;vy=s.dvy}
  // скорость вперёд больше, назад и вбок — меньше
  if(!s.ai2){const c=Math.cos(s.hd),sn=Math.sin(s.hd);let fw=vx*c+vy*sn,lt=-vx*sn+vy*c;if(fw<0)fw*=.5;lt*=.6;vx=fw*c-lt*sn;vy=fw*sn+lt*c}else boost=1; // план сам задаёт скорость и курс: без сглаживания, перекоса и форсажа
  if(s.ovh)boost=Math.min(boost,1.1); // тепло химического двигателя уходит с выхлопом
  // поломка двигателя при форсаже: чем сильнее ускорение, тем выше шанс
  if(boost>1.02&&s.engN>0&&rnd()<.00006*(1+3*(boost-1))*dt*s.engN){
    const em=[];for(const z of s.zones)for(const m of z.mods)if(m.k==='E'&&m.alive)em.push(m);
    if(em.length){const m=em[(rnd()*em.length)|0];m.alive=false;s.aliveN--;s.engN--;stat.bfail[s.side]++;fx.push({x:s.x,y:s.y,t0:t,d:5,r:1.2});boost=1}}
  s.bst+=(boost-s.bst)*Math.min(1,dt*.8);boost=s.bst;
  if(tg&&!flee&&!s.cool&&!T.role&&!s.ai2){ // тактики строя на уровне корабля
    const ddx=vx-s.sx,ddy=vy-s.sy,ddl=Math.hypot(ddx,ddy),far=td>(s.effR||40)*1.3,mv=F.stance!=='drift'&&F.stance!=='pass';
    if(far&&ddl>.05&&mv)want=Math.atan2(ddy,ddx); /* далеко и нужен разгон/торможение — разворот к нужному импульсу и тяга главным */
    else if(F.stance!=='retreat'&&F.stance!=='drift'&&F.stance!=='pass'&&F.stance!=='kite')want=Math.atan2(uy,ux); // нос (70 см брони) строго к врагу — во всех боевых тактиках, без разворота бортом ради башен
    else if(F.stance==='drift'){vx=s.sx/Math.max(eng,.05);vy=s.sy/Math.max(eng,.05);want=Math.atan2(uy,ux)} // по инерции: двигатели молчат, только поворот носом
    else if(F.stance==='pass'&&F.tgx!=null){const px=F.tgx-s.x,py=F.tgy-s.y,pl=Math.hypot(px,py)||1;vx=px/pl*vm*1.3;vy=py/pl*vm*1.3;want=Math.atan2(uy,ux)}}
  // экономия топлива: скорость не выше четверти оставшегося запаса Δv (чтобы хватило затормозить и маневрировать), форсаж — только при полбака и больше
  if(s.fuelCap){const m0=dryM(s),dvr=FUEL.ve*Math.log((m0+s.fuel)/m0),fq=s.fuel/s.fuelCap;if(fq<.5){boost=Math.min(boost,1);s.bst=Math.min(s.bst,1)}vm=Math.min(vm,Math.max(.02,s.rf?99:(dvr-HOME())/2))} /* разгон — не больше половины свободного Δv (вторая половина на торможение); запас «до дома» не трогаем */
  vm*=boost*(s.raidV?2.5:1);if(s.fuelCap){const m0=dryM(s);vm=Math.min(vm,Math.max(.02,s.rf?99:(FUEL.ve*Math.log((m0+s.fuel)/m0)-HOME())/2))}const vl=Math.hypot(vx,vy);s.vmx=vm;s.vwant=vl;if(vl>vm&&!s.ai2){vx*=vm/vl;vy*=vm/vl}
  if(s.fuelCap&&s.rst==='home'){s.dvB=budget(s)} /* на пути к базе тратится как раз резерв возвращения */
  else if(s.fuelCap&&!s.rf){const B=budget(s);s.dvB=B;if(B.spend<=0){if(B.tk){s.rf=B.tk;s.rfV=Math.max(.1,B.dvr*.25)}else{vx=s.sx/Math.max(eng,.05);vy=s.sy/Math.max(eng,.05)}}else{const ex=vx*eng-s.sx,ey=vy*eng-s.sy,ed=Math.hypot(ex,ey);if(ed>B.spend){const k=B.spend/ed;vx=(s.sx+ex*k)/Math.max(eng,.05);vy=(s.sy+ey*k)/Math.max(eng,.05)}}} // общий бюджет Δv: манёвр не трогает запас на возвращение (к танкеру или до остановки)
  // заблаговременное торможение: на встречном курсе гасим относительную скорость до PB.v ещё до сближения — если хватает топлива (Циолковский) на (rv−PB.v)·res
  {const g=s.tg;if(PB.on&&!s.tac&&g&&g.alive&&g.T&&s.fuelCap&&!flee){const dx=g.x-s.x,dy=g.y-s.y,d=Math.hypot(dx,dy)||1,rv=Math.hypot(s.sx-g.sx,s.sy-g.sy);s.pb=0;
    if(rv>PB.v&&d>PB.near){const m0=dryM(s),dvr=FUEL.ve*Math.log((m0+s.fuel)/m0);{const vt=Math.max(PB.v,rv-dvr/PB.res),aa=s.acc/1000*Math.max(.15,eng),vc=Math.min(Math.max(closing(s,g),vt),Math.max(vt,Math.sqrt(aa*(d-PB.near)))),ux=dx/d,uy=dy/d; /* не разгоняемся сверх нынешнего сближения — только гасим лишнее (инерция бесплатна); топлива мало — гасим скорость частично (до vt), но сразу поворачиваем к врагу, а не расходимся */
      const sh=g.pb?.5:1;vx=(s.sx+(g.sx+ux*vc-s.sx)*sh)/Math.max(eng,.05);vy=(s.sy+(g.sy+uy*vc-s.sy)*sh)/Math.max(eng,.05);s.pb=1; /* враг тоже тормозит — берём на себя только половину разницы скоростей, иначе оба гасят всё и потом исправляют перелёт */stat.pbrake=(stat.pbrake||0)+dt}}}}
  // таран: тяжёлый корабль с толстым носом идёт в лоб на лёгкую цель рядом, сближаясь не быстрее RAM.v (км/с)
  {const g=s.tg;if(!s.ai2)s.ramTg=null;if(RAM.on&&(!s.ai2||s.ramTg)&&g&&g.alive&&g.T&&!flee&&s.T.tons>=g.T.tons*RAM.mass&&s.zones[0].arm>=RAM.nose){const dx=g.x-s.x,dy=g.y-s.y,d=Math.hypot(dx,dy)||1e-6;
    if(d<RAM.dist){s.ramTg=g;s.ramLast=g;const ux=dx/d,uy=dy/d,vc=Math.min(RAM.v*.9,Math.max(.02,Math.sqrt(s.acc/1000*Math.max(.15,eng)*d)));if(!s.ai2)vx=(g.sx+ux*vc)/Math.max(eng,.05);if(!s.ai2)vy=(g.sy+uy*vc)/Math.max(eng,.05);
      const cd0=s.T.L*.5+g.T.L*.12;if(d<cd0){if(t>(s.ramT||0))ramHit(s,g); // корпуса твёрдые: не проходят друг сквозь друга — раздвигаем по нормали, сближающая скорость гасится с сохранением импульса
        s.rplNeed=g.rplNeed=1;const m1=s.T.tons,m2=g.T.tons,pen=cd0-d;s.x-=ux*pen*m2/(m1+m2);s.y-=uy*pen*m2/(m1+m2);g.x+=ux*pen*m1/(m1+m2);g.y+=uy*pen*m1/(m1+m2);
        const vn=(s.sx-g.sx)*ux+(s.sy-g.sy)*uy;if(vn>0){s.sx-=ux*vn*m2/(m1+m2);s.sy-=uy*vn*m2/(m1+m2);g.sx+=ux*vn*m1/(m1+m2);g.sy+=uy*vn*m1/(m1+m2)}}
      if(t<(s.ramT||0)){s.ramTg=null;if(!s.ai2){vx=g.sx/Math.max(eng,.05);vy=g.sy/Math.max(eng,.05)}}}}} // после удара не давим дальше — держимся вплотную до следующего захода
  // инерция: ускорение ограничено тягой и массой
  let ext=null;if(s.cmdLog&&s.__post){const P=s.__post;ext={dsx:s.sx-P.sx,dsy:s.sy-P.sy,dx:s.x-P.x,dy:s.y-P.y,dfu:s.fuel-P.fuel,dw:(s.w||0)-P.w,dhd:s.hd-P.hd,rcsN:s.rcsN,spin:s.spin||0,ramTg:s.ramTg}} // внешнее между шагами: отдача, удары, тараны, потеря маневровых — это «обстановка», не команды
  if(PVO.on&&FC.on&&!flee&&s.role==='ПВО'&&s.prot&&s.prot.alive&&s.pax!=null&&!(AB.side>=0&&s.side!==AB.side)&&!(PLN.roff&&PLN.roff.includes('ПВО'))){const P=s.prot,off=Math.max(PVO.dmin,Math.min(PVO.dmax,P.T.L*10)),ex=P.x+s.pax*off-s.x,ey=P.y+s.pay*off-s.y,ed=Math.hypot(ex,ey),vc=ed<off?0:Math.min(PVO.vc,(ed-off)/PVO.tc); /* в пределах off от места — только идёт со скоростью защищаемого, без подруливания */
    vx=(P.sx||0)+(ed>1e-6?ex/ed*vc:0);vy=(P.sy||0)+(ed>1e-6?ey/ed*vc:0);want=Math.atan2(s.pay,s.pax);s.ai2=0;s.vPT=0;s.__esc=1;stat.escT=(stat.escT||0)+dt}else s.__esc=0; // ПВО-СОПРОВОЖДЕНИЕ: идёт со скоростью защищаемого, место — на оси угрозы перед ним; пушки сами бьют ракеты, летящие к своим (misThreat)
  if(FC.grp&&s.role==='ремонт'&&s.rpTg&&s.rpTg.alive&&!flee&&s.rst!=='home'){const P=s.rpTg,nn=nearestShip(P.x,P.y,1-s.side);let ux=0,uy=0;if(nn){const d=Math.hypot(nn.s.x-P.x,nn.s.y-P.y)||1;ux=(nn.s.x-P.x)/d;uy=(nn.s.y-P.y)/d}
    const ex=P.x-ux*KIT.dock*.6-s.x,ey=P.y-uy*KIT.dock*.6-s.y,ed=Math.hypot(ex,ey),vc=ed<.3?0:Math.min(.2,Math.sqrt(2*.5*.35*(s.acc||5)/1000*Math.max(.05,eng)*ed),(ed-.3)/120),ek=Math.max(eng,.05);vx=((P.sx||0)+(ed>1e-6?ex/ed*vc:0))/ek;vy=((P.sy||0)+(ed>1e-6?ey/ed*vc:0))/ek;{const evx=vx*ek-s.sx,evy=vy*ek-s.sy;if(Math.hypot(evx,evy)>.01)want=Math.atan2(evy,evx)} /* нос — по нужному импульсу: главный двигатель работает только вдоль оси */s.ai2=0;s.vPT=0;s.dockT=t;stat.repT=(stat.repT||0)+dt} // СТЫКОВКА РЕМОНТНИКА: место — за повреждённым с теневой стороны, скорость — его скорость плюс сближение (как сопровождение ПВО); огонь по-прежнему ведут орудия
  if(PLN.rtr&&s.rst==='home'){const rp=s.dvB&&s.dvB.rp||retPlan(s);const ek=Math.max(eng,.05);if(s.engN>0&&s.dvB&&s.dvB.dvr>=rp.turn+rp.brake){if(s.homeVc==null)s.homeVc=rp.vc; /* скорость перелёта фиксируется в момент ухода (на неё и рассчитан резерв); у базы — торможение по профилю √(2·a·d) с запасом, стоп в 1 км */
      const aB=HOMEB*.35*s.acc/1000*Math.max(.05,eng),vd=rp.d<.3?0:Math.min(s.homeVc,aB*(-RET.slew+Math.sqrt(RET.slew*RET.slew+2*rp.d/aB)),rp.d/RET.app), /* профиль торможения с запасом на разворот (slew с): v·T + v²/2a ≤ d */Vx=rp.ux*vd,Vy=rp.uy*vd,_hv=(s.homeVd=vd),ex=Vx-s.sx,ey=Vy-s.sy,el=Math.hypot(ex,ey);vx=Vx/ek;vy=Vy/ek;
      if(t>=(s.hwT||0)||s.hw==null){s.hwT=t+5;s.hw=el<=Math.max(.006,Math.min(.03,s.homeVc*(vd<s.homeVc*.9?.25:.5)))?s.hd /* мелкие поправки — маневровыми вбок и главным вдоль оси, без разворота корпуса */:(ex*rp.ux+ey*rp.uy)/el<-.8?Math.atan2(-ey,-ex) /* торможение обратной тягой: нос строго против нужного импульса — тогда вся поправка (и боковая часть) идёт вдоль оси; раньше нос смотрел на базу, боковая часть ошибки отключала главный двигатель (|df/dl|<0,97), и корабль проскакивал базу */:Math.atan2(ey,ex)}want=s.hw} /* торможение у базы — обратной тягой (35%), носом к базе, без переворота; курс пересматривается раз в 5 с игрового времени — не дёргается на каждом шаге (маневровые не жгутся впустую, и расход не зависит от шага физики) */ /* нос — вдоль нужного импульса (главный двигатель), а не вдоль пути: иначе боковую скорость гасили только слабые маневровые; когда скорость совпала — нос не крутим (маневровые тоже жгут топливо) */else{vx=s.sx/ek;vy=s.sy/ek;want=s.hd;boost=1;s.homeWhy=(s.engN<=0?'двигатели выбиты':'Δv '+(s.dvB?s.dvB.dvr.toFixed(2):'?')+' км/с меньше нужного '+rp.need.toFixed(2))+' — безопасно вернуться нельзя, летит по инерции, топливо бережёт'}s.ai2=0;s.vPT=0;stat.homeT=(stat.homeT||0)+dt} // НА БАЗУ (независимо от цели и строя): скорость перелёта, торможение — в резерве
  const a=ctrlStep(s,vx,vy,want,boost,eng,flee,dt);s.__a2p=s.ai2?{x:s.x,y:s.y,sx:s.sx,sy:s.sy}:null; // a — ускорение за шаг (нужно ниже для высоты)
  if(s.cmdLog){s.cmdLog.push([vx,vy,want,boost,eng,flee?1:0,dt,ext,s.__ev||null,{sx:s.sx,sy:s.sy,fuel:s.fuel,hd:s.hd},s.__wantF]);s.__ev=null;s.__post={sx:s.sx,sy:s.sy,x:s.x,y:s.y,fuel:s.fuel,w:s.w||0,hd:s.hd}} // запись команд для проверки прогноза
  s.vx=s.sx;s.vy=s.sy;
  { const rr=.14/(1+T.L)*dt,dr=adiff(s.roll||0,s.rollT||0);s.roll=(s.roll||0)+Math.max(-rr,Math.min(rr,dr)) } // крен вокруг продольной оси
  // высота (псевдо-3D)
  if(t>=(s.zn||0)){s.zn=t+R(60,200);s.zo=R(-20,20)} // каждый корабль сам выбирает высоту и меняет её: бой идёт в объёме, а не в плоскости
  const zt=Math.max(-36,Math.min(36,F.zl+s.zo+(s.zpush||0)*4)); /* высота своя у каждого корабля */s.zpush=0;if(s.zset==null){s.z=zt;s.zset=1;s.pz=0}else{const spd=Math.hypot(s.sx,s.sy),dA=Math.max(1e-6,a*.12),aZ=dA/Math.max(dt,1e-6),dzz=zt-s.z,vW=Math.sign(dzz)*Math.min(.12,Math.sqrt(2*aZ*Math.abs(dzz))*.9);s.vz=s.vz||0;s.vz+=Math.max(-dA,Math.min(dA,vW-s.vz));const dz=s.vz*dt;s.z+=dz; /* высота по инерции: маневровые разгоняют и тормозят, скорость не меняется мгновенно */const pw=Math.atan2(s.vz,Math.max(spd,.02));s.pz=(s.pz||0)+(pw-(s.pz||0))*Math.min(1,dt*.5)}
}
function nearestCar(c){let b=null,bd=1e9;for(const o of ships){if(!o.alive||!o.car||o.side!==c.side)continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d<bd){bd=d;b=o}}return b}
function foeCraft(c,maxd,bonusB,onlyF){let b=null,bs=1e9;for(const o of fly[1-c.side]){if(onlyF&&o.type!=='F')continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d>maxd)continue;const sc=d-(o.type==='B'?bonusB:0)+15*o.att;if(sc<bs){bs=sc;b=o}}return b}
function foeCraftAt(c,ref,maxd){let b=null,bs=1e9;for(const o of fly[1-c.side]){const dr=Math.hypot(o.x-ref.x,o.y-ref.y);if(dr>maxd)continue;const sc=Math.hypot(o.x-c.x,o.y-c.y)+15*o.att;if(sc<bs){bs=sc;b=o}}return b}
function slotPos(fl,k){const row=Math.ceil(k/2),sg=k%2?1:-1;
  if(fl.form==='claw')return[sg*row*1.8,.6*row-.5*row*row];
  if(fl.form==='x'){const d=Math.ceil(k/4)*1.6,q=k%4;return[(q%2?-1:1)*d,(q<2?1:-1)*d]}
  return[sg*row*1.5,row*1.5]}
function killCraft(c,why){if(c.state==='dead')return;c.state='dead';(stat.why=stat.why||{})[why||'combat']=((stat.why||{})[why||'combat']||0)+1;stat[c.type==='F'?'lostF':'lostB'][c.side]++;fx.push({x:c.x,y:c.y,t0:t,d:6,r:1.2})}
function reloadCraft(c){const P=c.P,p=c.home.pool;c.fuel=P.fuel;c.hp=P.hp;c.ret=false;
  if(c.type==='F'){const k=Math.min(P.ammo-c.ammo,p.ammo);c.ammo+=k;p.ammo-=k;if(c.home.spec.fmis&&c.ms<c.home.spec.fmis.n&&p.ammo>=10){c.ms=c.home.spec.fmis.n;p.ammo-=10}}else{const k=Math.min(1-c.ammo,p.torp);c.ammo+=k;p.torp-=k}}
function stepFlights(){
  for(const fl of flights){
    const live=fl.cr.filter(c=>c.state!=='dead');if(!live.length)continue;
    if(fl.mode==='bay'){
      if(!fl.home.alive){live.forEach(c=>killCraft(c,'hangar'));continue}
      if(fl.svc>0){fl.svc-=1;if(fl.svc<=0)live.forEach(reloadCraft);continue}
      const foe=nearestShip(fl.home.x,fl.home.y,1-fl.side);
      let go=!!foe&&foe.d<LAUNCH;if(go&&fl.type!=='F'){let hb=0;for(const h of hitLog)if(t-h<30)hb++;go=hb>=4||foe.d<120}
      if(go&&fl.type==='F'){ // истребители ждут: вылет, если видны вражеские истребители/бомберы/ракеты/торпеды, либо флоты уже обмениваются огнём
        const R2=300*300,hx=fl.home.x,hy=fl.home.y,near=q=>(q.x-hx)*(q.x-hx)+(q.y-hy)*(q.y-hy)<R2;
        let hr=0;for(const h of hitLog)if(t-h<30)hr++;const R3=140*140,near3=q=>(q.x-hx)*(q.x-hx)+(q.y-hy)*(q.y-hy)<R3;
        go=hr>=8||(fly&&fly[1-fl.side]||[]).some(near3)||mis.some(q=>q.side!==fl.side&&near3(q))||torps.some(q=>q.side!==fl.side&&near3(q))}
      if(go&&live.some(c=>c.ammo>0)){fl.mode='out';fl.t0=t;const h=fl.home;
        for(const c of live){if(c.ammo>0){h.nextL=Math.max(h.nextL,t)+0.4;c.launchAt=h.nextL;c.launched=false}else c.launched=true}}
    }else if(live.every(c=>c.state==='bay'&&c.launched)){fl.mode='bay';fl.atk=false;fl.lastTg=null;fl.svc=90;live.forEach(c=>c.launched=false);fl.broken=false}
    if(fl.mode==='out')for(const c of live){
      if(c.state==='bay'&&!c.launched&&t>=c.launchAt&&c.home.alive){const h=c.home;
        c.state='fly';c.launched=true;c.ret=false;c.x=h.x;c.y=h.y;c.tr=[];
        const dir=h.side?-1:1;c.vx=h.sx+dir*0.5;c.vy=h.sy+R(-0.2,0.2);c.h=dir>0?0:Math.PI}}
  }
}
function assign(){
  fly=[[],[]];for(const c of air){c.att=0;if(c.state==='fly')fly[c.side].push(c)}
  for(const c of air)if(c.state==='fly'&&c.tg&&c.tg.state==='fly')c.tg.att++;
  for(const fl of flights){const live=fl.cr.filter(c=>c.state==='fly'&&!c.ret);fl.leader=live[0]||null;live.forEach((c,i)=>c.slot=i)
    if(fl.type==='F'&&fl.mode==='out'&&t>(fl.bkT||0)){fl.bkT=t+3;let lost=0;for(const c of fl.cr)if(c.state==='dead')lost++;fl.lost=lost;
      if(!fl.broken&&lost>1&&rnd()<.015*lost*lost){fl.broken=true;stat.broke=(stat.broke||0)+1}} // чем больше потерь, тем вероятнее развал строя
    if(fl.type==='F'&&fl.leader&&!fl.broken&&fl.form!=='sphere'&&(!fl.tgt||fl.tgt.state!=='fly'||Math.hypot(fl.tgt.x-fl.leader.x,fl.tgt.y-fl.leader.y)>130))fl.tgt=foeCraft(fl.leader,110,25); // всё звено бьёт одну цель
    if(fl.type==='F'&&fl.form==='sphere'&&fl.mode==='out'&&!fl.atk){ // без угроз вокруг корабля звено не кружит вечно: через 15 с идёт штурмовать вражеский корабль
      if(fl.cr.some(c=>c.state==='fly'&&c.tg))fl.lastTg=t;else if(fl.lastTg==null)fl.lastTg=t;else if(t-fl.lastTg>15)fl.atk=true}
    if(fl.type==='F'&&fl.leader&&(fl.form!=='sphere'||fl.atk)){const L=fl.leader;
      if(!fl.tsh||!fl.tsh.alive||t>(fl.tshT||0)){const n=nearestShip(L.x,L.y,1-fl.side);fl.tsh=n&&n.s;fl.tshT=t+4}
      if(!fl.ph)fl.ph='in';
      if(fl.ph==='in'&&fl.outAt&&t>=fl.outAt){fl.ph='out';fl.rl=t+R(55,95);fl.outAt=0}
      else if(fl.ph==='out'&&fl.tsh&&t>=(fl.rl||0)&&Math.hypot(L.x-fl.tsh.x,L.y-fl.tsh.y)>60)fl.ph='in'}}
  for(const c of air){if(c.state!=='fly')continue;
    const P=c.P;
    if(!c.home.alive){const h=nearestCar(c);if(h)c.home=h}
    if(!c.ret){const dh=Math.hypot(c.home.x-c.x,c.home.y-c.y);
      if(c.fuel<dh/(P.vmax*0.6)+80||(c.type==='F'&&c.ammo<=0))c.ret=true}
    c.bm=(c.type==='F'&&!c.tg&&c.fl.tsh)?1.7:1;
    if(c.ret){c.tg=null;continue}
    if(c.tg&&c.tg.state!=='fly'){c.tg=null;c.na=0}
    if(c.type==='B'){
      if(!c.sh||!c.sh.alive){const n=nearestShip(c.x,c.y,1-c.side);c.sh=n&&n.s}
      if(!c.sh){c.ret=true;continue}
      if(Math.hypot(c.sh.x-c.x,c.sh.y-c.y)<TORP.launch&&c.ammo>0){torps.push({x:c.x,y:c.y,side:c.side,tgt:c.sh});stat.torp[c.side]++;c.ammo=0;c.ret=true;continue}
    }
    if(t<c.na&&(c.tg||c.goal||c.type==='B'))continue;
    c.na=t+R(1,2);
    if(c.type==='F'){
      if(c.fl.form==='sphere'&&!c.fl.atk&&!c.fl.broken){c.tg=foeCraftAt(c,c.home,95);c.goal=null;if(!c.home.alive)c.ret=true;continue}
      const ft=c.fl.tgt;c.tg=(!c.fl.broken&&ft&&ft.state==='fly'&&Math.hypot(ft.x-c.x,ft.y-c.y)<130)?ft:foeCraft(c,110,25);
      if(!c.tg){c.goal=foeCraft(c,1e9,200);if(!c.goal&&!c.fl.tsh)c.ret=true}
    }else c.tg=foeCraft(c,15,0,true);
  }
}
// пуля по цели с упреждением: разброс подобран так, чтобы шанс попасть ≈ p; промахнувшаяся пуля летит дальше, пока во что-то не врежется или не растворится
let MUZ=null;const tracers=[];let trId=0;
function endTr(p,x,y){if(!p.o0)return;tracers.push({id:++trId,x1:p.o0.x,y1:p.o0.y,z1:p.o0.z,x2:x,y2:y,z2:p.z,side:p.side,src:p.src,m:p.m});if(tracers.length>700)tracers.shift()}
function fireAt(sx,sy,sz,src,m,side,e,V,p,cd,max,dmg){if(m)m.firedT=t;
  // V — скорость пули относительно ствола; к ней прибавляется скорость стрелка (Галилей): упреждение считаем в системе стрелка
  const vOf=o=>o?(o.T?[o.sx||0,o.sy||0,o.vz||0]:[o.vx!=null?o.vx:(o.sx||0),o.vy!=null?o.vy:(o.sy||0),0]):[0,0,0]; // у корабля vx/vy — желаемая скорость ИИ, настоящая — sx/sy (+ вертикальная vz)
  const [svx,svy,svz]=vOf(src),[ex0,ey0,ez0]=vOf(e),evx=ex0-svx,evy=ey0-svy,evz=ez0-svz,ez=e.z||0;let T=Math.hypot(e.x-sx,e.y-sy,ez-sz)/V;
  for(let i=0;i<4;i++){const px=e.x+evx*T,py=e.y+evy*T,pz=ez+evz*T;T=Math.hypot(px-sx,py-sy,pz-sz)/V}
  const px=e.x+evx*T,py=e.y+evy*T,pzL=ez+evz*T,d=Math.max(.3,Math.hypot(px-sx,py-sy,pzL-sz)),sig=(V<2?GDISP:DISP)*(1+2*Math.max(0,.6-p)); // разброс ствола (нагрев и навык через p)
  const sg2=sig,dh=Math.hypot(px-sx,py-sy),an=Math.atan2(py-sy,px-sx)+gauss()*sg2,el=Math.atan2(pzL-sz,dh)+gauss()*sg2,vx=Math.cos(an)*Math.cos(el)*V,vy=Math.sin(an)*Math.cos(el)*V,vz=Math.sin(el)*V;
  let VX=vx,VY=vy,VZ=vz;{const mo=MUZ&&src&&src.T?MUZ(src,m,vx,vy,vz):null;if(mo){const T2=d/V,ax=sx+vx*T2-(sx+mo.x),ay=sy+vy*T2-(sy+mo.y),az=sz+vz*T2-(sz+mo.z),l=Math.hypot(ax,ay,az)||1;VX=ax/l*V;VY=ay/l*V;VZ=az/l*V;sx+=mo.x;sy+=mo.y;sz+=mo.z}} // из ствола в ту же точку упреждения
  VX+=svx;VY+=svy;VZ+=svz;const VA=Math.hypot(VX,VY,VZ);
  if(src&&src.T&&src.T.tons){const mk=V<2?GATP.m:3,k=mk/(src.T.tons*1000);src.sx-=(VX-svx)*k;src.sy-=(VY-svy)*k} // отдача: импульс снаряда m·v уходит в корабль назад
  proj.push({bt:t,x:sx,y:sy,z:sz,vz:VZ,vx:VX,vy:VY,side,dist:0,dmg:dmg!=null?dmg:.02*cd,cd,max:Math.hypot(VX,VY)*20,src,m,ev:rnd(),o0:{x:sx,y:sy,z:sz}}); // живёт 20 с
  if(src){src.rt=performance.now()}}
function shoot(c,e,p,dm){fireAt(c.x,c.y,c.z||0,c,null,c.side,e,GV,p,dm||1,600);proj[proj.length-1].g=1} // у истребителя тот же миниган, что у кораблей
function craftStep(c,d){
  const P=c.P,home=c.home;
  if(c.type==='F'&&mis.length&&t>(c.pd||0)){let q=null,bd=200;for(const m of mis){if(m.side===c.side)continue;const dd=(m.x-c.x)*(m.x-c.x)+(m.y-c.y)*(m.y-c.y);if(dd<bd){bd=dd;q=m}}
    if(q){c.pd=t+1;shots.push({x1:c.x,y1:c.y,x2:q.x,y2:q.y,rt:performance.now(),s:c.side,a:c,b:q});if(rnd()<.22)hurtMis(q,1)}}
  let vdx=c.vx,vdy=c.vy,aim=null,fight=false;
  c.jt-=d;
  if(c.jt<=0){c.jt=R(2,5);const a=R(0,6.283),m=R(0.2,0.5)*P.a;c.jx=Math.cos(a)*m;c.jy=Math.sin(a)*m}
  if(c.ret){
    const dx=home.x-c.x,dy=home.y-c.y,dist=Math.hypot(dx,dy)||1e-6,sp=Math.min(P.vmax*0.9,Math.sqrt(1.2*P.a*dist)+0.05);
    vdx=home.sx+dx/dist*sp;vdy=home.sy+dy/dist*sp;
    if(dist<1.2&&Math.hypot(c.vx-home.sx,c.vy-home.sy)<0.4){c.state='bay';c.x=home.x;c.y=home.y;c.tr=[];return}
  }else if(c.type==='F'&&c.tg&&c.tg.state==='fly'){
    const e=c.tg,dx=e.x-c.x,dy=e.y-c.y,dist=Math.hypot(dx,dy)||1e-6;fight=true;c.eng=t;lastEng=t;
    if(c.ph==='break'){if(dist>16||t>c.phEnd)c.ph='run'}
    else{const closing=(dx*(c.vx-e.vx)+dy*(c.vy-e.vy))/dist;if(dist<6&&closing<0.1){c.ph='break';c.phEnd=t+R(6,10);c.bs=rnd()<.5?1:-1}}
    if(c.ph==='break'){
      const a=Math.atan2(c.vy,c.vx)+c.bs*0.6;vdx=Math.cos(a)*P.vmax;vdy=Math.sin(a)*P.vmax;
    }else{
      const tb=dist/6,rx=dx+(e.vx-c.vx)*tb,ry=dy+(e.vy-c.vy)*tb,la=Math.min(dist/2,6),px=dx+e.vx*la,py=dy+e.vy*la,pl=Math.hypot(px,py)||1e-6;
      vdx=px/pl*P.vmax;vdy=py/pl*P.vmax;aim=Math.atan2(ry,rx);
      c.cd-=d;
      if(c.cd<=0&&dist<P.gun&&c.ammo>0&&Math.abs(adiff(c.h,aim))<0.2){const ng=P.ng||1;c.ammo-=ng;c.cd=P.cd||.3;for(let g=0;g<ng;g++)shoot(c,e,(0.12*(1-dist/P.gun)+0.02)*(P.gun>4?1.2:1),P.dmg||1)}
    }
  }else{
    const fl=c.fl,L=fl.leader;
    if(c.type==='F'&&fl.form==='sphere'&&!fl.atk&&!fl.broken&&home.alive){ // сфера вокруг своего корабля: прикрывает от ракет и истребителей
      const n=Math.max(1,fl.cr.length),a=fl.a0+c.slot*6.283/n+t*.12,rr=home.T.L*.5+5+(c.slot%2)*2.5,px=home.x+Math.cos(a)*rr,py=home.y+Math.sin(a)*rr;let ex=px-c.x,ey=py-c.y;const el=Math.hypot(ex,ey),cl=Math.min(el,1.5);if(el>1e-6){ex=ex/el*cl;ey=ey/el*cl}
      vdx=home.sx+ex*1.3;vdy=home.sy+ey*1.3}
    else if(L===c||!L||fl.broken){let G=c.type==='F'?c.goal:c.sh,sf=.8;
      if(c.type==='F'&&fl.tsh){const sh=fl.tsh,ax=c.x-sh.x,ay=c.y-sh.y,ad=Math.hypot(ax,ay)||1;
        if(fl.ph==='in'){G=sh;if(sh.alive&&sh.engN>0){const k=sh.T.L*.38;G={x:sh.x-Math.cos(sh.hd)*k,y:sh.y-Math.sin(sh.hd)*k,sx:sh.sx,sy:sh.sy}} /* заходят с кормы, к двигателям */ sf=1.6}else{G={x:sh.x+ax/ad*130,y:sh.y+ay/ad*130};sf=Math.min(1.6,Math.hypot(G.x-c.x,G.y-c.y)*.05+.1)}}
      if(G){const bx=G.x-c.x,by=G.y-c.y,dist=Math.hypot(bx,by)||1e-6,off=c.fl.lane*Math.min(1,dist/(c.type==='F'?150:200)),dx=bx-by/dist*off,dy=by+bx/dist*off,dd=Math.hypot(dx,dy)||1e-6;vdx=dx/dd*P.vmax*sf;vdy=dy/dd*P.vmax*sf}}
    else{const sp=Math.hypot(L.vx,L.vy),ang=sp>0.05?Math.atan2(L.vy,L.vx):L.h,[lat,back]=slotPos(fl,c.slot);
      const px=L.x+Math.cos(ang)*(-back)-Math.sin(ang)*lat,py=L.y+Math.sin(ang)*(-back)+Math.cos(ang)*lat;
      let ex=px-c.x,ey=py-c.y;const el=Math.hypot(ex,ey),cl=Math.min(el,1);if(el>1e-6){ex=ex/el*cl;ey=ey/el*cl}
      vdx=L.vx+ex*1.2;vdy=L.vy+ey*1.2}
    if(c.type==='B'&&c.tg&&c.tg.state==='fly'){const e=c.tg,dx=e.x-c.x,dy=e.y-c.y,dist=Math.hypot(dx,dy)||1e-6;fight=true;aim=Math.atan2(dy,dx);c.eng=t;lastEng=t;
      c.cd-=d;if(c.cd<=0&&dist<2.5){c.cd=0.6;shoot(c,e,0.03)}}
  }
  if(c.type==='F'&&!c.ret&&!c.tg&&c.fl.tsh&&c.fl.ph==='in'&&c.ammo>0&&t>(c.nf||0)){const sh=c.fl.tsh;
    if(Math.hypot(sh.x-c.x,sh.y-c.y)<sh.T.L*.8+1.2){const n=Math.min(c.ammo,6);c.ammo-=n;c.nf=t+40;
      for(let i=0;i<n*2;i++){fireAt(c.x,c.y,c.z!=null?c.z:sh.z,c,null,c.side,sh,GV,.5,0,600,0);proj[proj.length-1].g=1} /* штурмовка — настоящими пулями, урон по прилёту */stat.strafe=(stat.strafe||0)+1;if(!c.fl.outAt)c.fl.outAt=t+1.5}}
  // ракеты истребителей: «против крупных» бьют по кораблю, «против мелких» — по вражеским истребителям
  if(c.type==='F'&&c.ms>0&&!c.ret&&c.state==='fly'&&t>(c.nm||0)){
    if(c.mk==='big'){const sh=c.fl.tsh;if(sh&&sh.alive&&c.fl.ph==='in'&&Math.hypot(sh.x-c.x,sh.y-c.y)<30){c.ms--;c.nm=t+3;mis.push({x:c.x,y:c.y,z:sh.z,h:c.h,side:c.side,tgt:sh,hp:1,spd:8,dmg:4,blast:3,life:45,tr:[],trT:0,vx:0,vy:0,src:c.own});stat.mis[c.side]++}}
    else if(c.mk==='small'){const e=foeCraft(c,35,0,false);
      if(!e){const sh=c.fl.tsh;if(sh&&sh.alive&&sh.T.tons<14000&&c.fl.ph==='in'&&Math.hypot(sh.x-c.x,sh.y-c.y)<30){c.ms--;c.nm=t+2;shots.push({x1:c.x,y1:c.y,x2:sh.x,y2:sh.y,rt:performance.now(),s:c.side,a:c,b:sh});stat.mis[c.side]++;hitShip(sh,'mis',sh.x-c.x,sh.y-c.y,sh.x,sh.y,6)}}
      if(e&&e.state==='fly'){c.ms--;c.nm=t+2;shots.push({x1:c.x,y1:c.y,x2:e.x,y2:e.y,rt:performance.now(),s:c.side,a:c,b:e});stat.mis[c.side]++;if(rnd()<.55){killCraft(e,'missile');stat.misShot[c.side]++}}}}
  let ax=2*(vdx-c.vx)+(fight?c.jx:0),ay=2*(vdy-c.vy)+(fight?c.jy:0);
  if(fight)for(const m of c.fl.cr){if(m===c||m.state!=='fly')continue;const sx=c.x-m.x,sy=c.y-m.y,sd=Math.hypot(sx,sy);if(sd<1.2&&sd>1e-6){const f=0.15*(1.2-sd)/sd;ax+=sx*f;ay+=sy*f}}
  const bm=c.bm||1,al=Math.hypot(ax,ay);if(al>P.a*bm){ax*=P.a*bm/al;ay*=P.a*bm/al}
  c.vx+=ax*d;c.vy+=ay*d;const v=Math.hypot(c.vx,c.vy);if(v>P.vmax*bm){c.vx*=P.vmax*bm/v;c.vy*=P.vmax*bm/v}
  c.x+=c.vx*d;c.y+=c.vy*d;c.fuel-=d;
  if(c.fuel<=0){killCraft(c,'fuel');return}
  const want=fight&&aim!==null?aim:(v>0.05?Math.atan2(c.vy,c.vx):c.h);
  c.h+=Math.max(-3*d,Math.min(3*d,adiff(c.h,want)));
  c.trT-=d;if(c.trT<=0){c.trT=0.5;c.tr.push(c.x,c.y);const sf=Math.min(1,Math.hypot(c.vx,c.vy)/Math.max(.5,P.vmax));c._sf=sf;const cap=Math.round(3+13*sf)*2;while(c.tr.length>cap)c.tr.splice(0,2)}
}
// armor: a hit pierces one layer in the zone it comes from; with no layers left it destroys modules behind
function spawnFrags(x,y,z,n,sp,L,o){for(let i=0;i<n&&frags.length<900;i++){const a=rnd()*6.283,v=sp*R(.2,1);frags.push({x,y,z,vx:(o?o.sx*.3:0)+Math.cos(a)*v,vy:(o?o.sy*.3:0)+Math.sin(a)*v,rot:rnd()*6.283,vr:R(-3,3),sz:L*R(.05,.16),t0:t,d:R(8,22),side:o?o.side:0,ln:0,hot:0})}}
// куски брони/модулей отлетают от корабля и долго дрейфуют, медленно угасая (сторона и размер — по кораблю)
function spawnPlates(o,x,y,n,big){const L=o.T.L,out=Math.atan2(y-o.y,x-o.x);
  for(let i=0;i<n&&frags.length<900;i++){const a=out+R(-.9,.9),v=(.012+Math.hypot(o.sx,o.sy)*.25)*R(.25,1)*(big?1.4:1);
    frags.push({x,y,z:o.z,vx:o.sx*.85+Math.cos(a)*v,vy:o.sy*.85+Math.sin(a)*v,vz:R(-.012,.012)*(1+L),rot:rnd()*6.283,vr:R(-2,2),rx:rnd()*6,ry:rnd()*6,vrx:R(-1.5,1.5),vry:R(-1.5,1.5),sz:L*R(.012,.03)*(big?2.2:1)+.003,t0:t,d:R(25,70),side:o.side,ln:0,hot:0,plate:1})}}
function addDecal(o,x,y,vx,vy,sz,k){ // след повреждения на корпусе в системе корабля (для 3D): позиция по длине, угол сечения (сторона к стрелку), размер
  const L=o.T.L,dx=x-o.x,dy=y-o.y,ch=Math.cos(o.hd),sh=Math.sin(o.hd),u=Math.max(-.5,Math.min(.5,(dx*ch+dy*sh)/L)),lat=-dx*sh+dy*ch;
  const ang=Math.atan2(R(-.7,.7),Math.sign(lat)||(rnd()<.5?1:-1))-(o.roll||0);(o.vd||(o.vd=[])).push({u,ang,sz,k,t0:t,r:rnd()});if(o.vd.length>240)o.vd.shift()}
function spawnShards(x,y,z,n,sp){for(let i=0;i<n&&frags.length<560;i++){const a=rnd()*6.283,v=sp*R(.4,1);frags.push({x,y,z,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:a,vr:0,sz:R(.5,1.6),t0:t,d:R(1.5,4),side:0,ln:1,hot:1})}}
function launchPods(o,frac){const n=Math.round((o.crN!=null?o.crN:o.pers*o.crew)*frac);if(n<=0)return;if(o.cg){const k=crewScale(o,1-frac);if(stat.crw)stat.crw.evac=(stat.crw.evac||0)+k;if(k<=0)return}else o.crew=Math.max(0,o.crew*(1-frac));
  const np=Math.max(1,Math.min(14,Math.ceil(n/60))),per=n/np;
  for(let i=0;i<np&&pods.length<420;i++){const a=rnd()*6.283,v=R(.4,1.4);pods.push({x:o.x+Math.cos(a)*o.T.L*.3,y:o.y+Math.sin(a)*o.T.L*.3,z:o.z,vx:o.sx*.5+Math.cos(a)*v,vy:o.sy*.5+Math.sin(a)*v,n:per,side:o.side,t0:t,life:700,tg:null,ph:rnd()*6,nx:0})}
  stat.pods=(stat.pods||0)+np;fx.push({x:o.x,y:o.y,z:o.z,t0:t,d:3,r:Math.max(.8,o.T.L*.5)})}
function podStep(dt){
  for(let i=pods.length-1;i>=0;i--){const p=pods[i];
    if(t-p.t0>p.life){pods.splice(i,1);stat.podLost=(stat.podLost||0)+1;continue}
    let g=p.tg;if(g&&(!g.alive||g.side!==p.side||g.abd||g.crew>=.97))g=p.tg=null;
    if(!g&&t>=p.nx){p.nx=t+3;let bd=500,b=null;for(const q of ships){if(!q.alive||q.side!==p.side||q.abd||q.crew>=.97)continue;const d=Math.hypot(q.x-p.x,q.y-p.y);if(d<bd){bd=d;b=q}}p.tg=g=b}
    if(g){const dx=g.x-p.x,dy=g.y-p.y,d=Math.hypot(dx,dy)||1,sp=Math.min(2.5,d*.5+.2),k=Math.min(1,dt*.7);
      p.vx+=(g.sx+dx/d*sp-p.vx)*k;p.vy+=(g.sy+dy/d*sp-p.vy)*k;
      if(d<g.T.L*.5+.7){const add=Math.min(1-g.crew,p.n/g.pers)*g.pers;g.crew=Math.min(1,g.crew+p.n/g.pers);g.mor=Math.min(1,g.mor+.01);(stat.resc=stat.resc||[0,0])[p.side]+=add;pods.splice(i,1);continue}}
    else if(around(1-p.side,p.x,p.y,2.5).length){(stat.pcap=stat.pcap||[0,0])[p.side]+=p.n;pods.splice(i,1);continue}
    p.x+=p.vx*dt;p.y+=p.vy*dt}
  for(let i=lands.length-1;i>=0;i--){const l=lands[i];let o=l.tg;
    if(t-l.t0>150){lands.splice(i,1);continue}
    if(!o||!o.alive||o.side===l.side){o=l.tg=null;let bd=60;for(const q of around(1-l.side,l.x,l.y,60)){if(q.st==='surr'||q.abd||t<q.blk||q.engN===0||hpf(q)<.55){const d=Math.hypot(q.x-l.x,q.y-l.y);if(d<bd){bd=d;o=q}}}l.tg=o;if(!o){lands.splice(i,1);continue}}
    const dx=o.x-l.x,dy=o.y-l.y,d=Math.hypot(dx,dy)||1,sp=5,k=Math.min(1,dt*1.2);
    l.vx+=(o.sx+dx/d*sp-l.vx)*k;l.vy+=(o.sy+dy/d*sp-l.vy)*k;l.x+=l.vx*dt;l.y+=l.vy*dt;l.z=o.z;
    // ПВО сбивает шлюпки
    let dead=false;for(const q of around(1-l.side,l.x,l.y,22)){let na=0;for(const m of q.tur)if(m.k==='A'&&m.alive)na++;if(na&&rnd()<.05*na*dt*(q.fine?1.3:.5)){dead=true;break}}
    if(dead){fx.push({x:l.x,y:l.y,z:l.z,t0:t,d:3,r:1.1});spawnShards(l.x,l.y,l.z,4,5);SFX.boom(4);stat.landLost=(stat.landLost||0)+1;lands.splice(i,1);continue}
    if(d<o.T.L*.5+.8){lands.splice(i,1);resolveBoard(l)}}
}
function kill(o,why){{const k=stat.fk=stat.fk||[null,null];if(o.side!=null&&k[1-o.side]==null&&o.T&&!o.bayOf)k[1-o.side]=Math.round(t)} /* время первого уничтожения каждой стороной */if(!o.alive)return;o.alive=false;if(o.lastBy){const k=o.lastBy;k.kills=(k.kills||0)+1;const g=(k.T.n||'').replace(/ №\d+$/,'');(stat.killBy=stat.killBy||{})[g]=(stat.killBy[g]||0)+1}o.why=why||'другое';(stat.kc=stat.kc||{})[o.why]=(stat.kc[o.why]||0)+1;if(o.crew>.04)launchPods(o,.5);fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:14,r:Math.max(4,o.T.L*7)});SFX.boom(26);stat.lost[o.side]++;
  {const L=o.T.L;spawnFrags(o.x,o.y,o.z,6+Math.floor(L*6),1.2,L,o);
   let ammo=(o.pool&&(o.pool.torp||0)+(o.pool.ammo||0)/10)||0;for(const m of o.tur)if(m.k==='M'&&m.alive)ammo+=m.ammo||0;
   if(ammo>0)pyro.push({x:o.x,y:o.y,z:o.z,hd:o.hd,L,vx:o.sx*.3,vy:o.sy*.3,n:4+Math.min(14,Math.round(L*3+ammo/3)),next:t+.3,t0:t,side:o.side});
   if(rnd()<Math.min(.3,.08+.05*L)){stat.reactor=(stat.reactor||0)+1;const R0=7+L*10;
     fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:9,r:R0,ring:1,big:1});fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:5,r:R0*.7});spawnShards(o.x,o.y,o.z,26,12);spawnFrags(o.x,o.y,o.z,10,5,L,o);SFX.boom(40);
     for(const q of ships){if(q===o||!q.alive)continue;const d=Math.hypot(q.x-o.x,q.y-o.y);if(d<R0*1.2)hitShip(q,'mis',q.x-o.x,q.y-o.y,o.x,o.y,Math.max(1,L*5*(1-d/(R0*1.2))))}}}
  { // обломки корабля остаются висеть: 3 куска летят дальше с его скоростью — смертельное поле для пролетающих
    const L=o.T.L,c=Math.cos(o.hd||0),sn=Math.sin(o.hd||0),nW=env.filter(e=>e.t==='wreck').length;if(nW>240)env.splice(env.findIndex(e=>e.t==='wreck'),3);
    for(let i=-1;i<=1;i++){const a=R(0,6.283),sp=R(.002,.012);env.push({t:'wreck',x:o.x+c*L*.33*i,y:o.y+sn*L*.33*i,r:Math.max(.05,L*.2),vx:(o.sx||0)+Math.cos(a)*sp,vy:(o.sy||0)+Math.sin(a)*sp,ttl:1e9,m:Math.max(5,o.T.tons/3),id:o.uid*10+i+1})}}
  for(const q of ships){if(!q.alive||Math.hypot(q.x-o.x,q.y-o.y)>45)continue;q.mor+=q.side===o.side?-(o.cls==='cv'?.14:.07):.03}
  say(o.side,'lost',o);say(1-o.side,'kill',o)}
function segHit(x1,y1,x2,y2,e,pad){const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy||1e-9;let u=((e.x-x1)*dx+(e.y-y1)*dy)/l2;u=u<0?0:u>1?1:u;return Math.hypot(x1+dx*u-e.x,y1+dy*u-e.y)<e.r+(pad||0)}
function los(x1,y1,x2,y2){for(const e of env)if(segHit(x1,y1,x2,y2,e))return e;return null}
// истребители броню почти не берут: они выбивают внешние модули — башни, радары, маневровые (броня модуля их задерживает)
function fighterHit(o,dmg,x,y,vx,vy){
  const h=Math.floor(dmg*6+rnd()),ex=[];if(h<=0)return;for(const z of o.zones)for(const m of z.mods)if(m.alive&&'TALMRDE'.includes(m.k))ex.push(m);
  // приоритет целей: двигатели (вес 4) и башни (вес 3) — самое уязвимое и самое важное; радары и прочее — реже
  const wt=m=>m.k==='E'?4:m.k==='T'||m.k==='A'?3:1;
  for(let i=0;i<h&&ex.length;i++){let tw=0;for(const q of ex)tw+=wt(q);let r=rnd()*tw,j=0;for(;j<ex.length-1;j++){r-=wt(ex[j]);if(r<=0)break}const m=ex[j];
    if(m.ar>0&&rnd()<.75){m.ar--;fx.push({z:o.z,x,y,t0:t,d:3,r:.6});continue}
    mdead(o,m);ex.splice(j,1);if(o.cg)crewKill(o,m.z,.15,'осколки',[m]);else o.crew=Math.max(0,o.crew-.006);o.mor-=.01;stat.fmod=(stat.fmod||0)+1;fx.push({z:o.z,x,y,t0:t,d:8,r:1.8});say(o.side,'mod',o)}
  addDecal(o,x,y,vx,vy,.4,3)}
// пуля не пробила броню: без вспышки — отскакивает от обшивки и улетает по отражённой траектории, пара искр
function ricochet(o,x,y,vx,vy){
  if(frags.length>520)return;let nx=x-o.x,ny=y-o.y;const nl=Math.hypot(nx,ny)||1;nx/=nl;ny/=nl;const vl=Math.hypot(vx,vy)||1,ux=vx/vl,uy=vy/vl,dn=ux*nx+uy*ny;
  let rx=ux-2*dn*nx,ry=uy-2*dn*ny;const ja=R(-.35,.35),c=Math.cos(ja),sn=Math.sin(ja);[rx,ry]=[rx*c-ry*sn,rx*sn+ry*c];const sp=R(7,12);
  frags.push({x,y,z:o.z,vx:rx*sp,vy:ry*sp,rot:Math.atan2(ry,rx),vr:0,sz:1.1,t0:t,d:R(.25,.45),side:0,ln:1,hot:1,ric:1});
  for(let i=0;i<2;i++){const a=Math.atan2(ry,rx)+R(-.9,.9),v=R(2,5);frags.push({x,y,z:o.z,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:a,vr:0,sz:.5,t0:t,d:R(.15,.3),side:0,ln:1,hot:1,ric:1})}
}
function hitShip(o,kind,vx,vy,x,y,dmg,pw,iz,vz,gat,pr){const C0=DCTX,kg=pr&&pr.kg?pr.kg:kind==='rail'?RAIL_M(pr&&pr.cal||10):kind==='gat'||gat?GAT_M:0;DCTX={k:kind,vx:vx-(o.sx||0),vy:vy-(o.sy||0),vz:vz||0,mp:kg};if(kg>0&&structs.size){const rx=vx-(o.sx||0),ry=vy-(o.sy||0),vl=Math.hypot(rx,ry);if(vl<=50)strHit(o,x,y,.5*kg*(vl*1000)**2,kind,kg*rx*1000,kg*ry*1000)}try{return hitShip0(o,kind,vx,vy,x,y,dmg,pw,iz,vz,gat,pr)}finally{DCTX=C0}}
function hitShip0(o,kind,vx,vy,x,y,dmg,pw,iz,vz,gat,pr){lastDmgT=t;if(pr&&pr.src&&pr.src.T)o.lastBy=pr.src;let imp=null;
  const vr=pr?Math.hypot(pr.vx-(o.sx||0),pr.vy-(o.sy||0),pr.vz||0):0; // относительная скорость удара, км/с: от неё энергия и пробитие
  if(!o.alive)return;o.hitT=t;
  {hitLog.push(t);if(hitLog.length>200)hitLog.shift();const dd=Math.hypot(vx,vy,vz||0)||1;impacts.push(imp={id:++impN,x,y,z:iz!=null?iz:o.z,nx:-vx/dd,ny:-vy/dd,nz:-(vz||0)/dd,pw:Math.min(12,Math.max(.5,dmg||1)),k:gat?'gat':kind,gE:gat?.5*GATP.m*(GATP.v*1000)**2:0,s:o});if(impacts.length>300)impacts.splice(0,100)}{const c=Math.cos(o.hd||0),sn=Math.sin(o.hd||0),dx=x-o.x,dy=y-o.y;(o.h3=o.h3||[]).push({q:imp,lx:dx*c+dy*sn,ly:-dx*sn+dy*c,lz:imp.z-(o.z||0),nx:imp.nx*c+imp.ny*sn,ny:-imp.nx*sn+imp.ny*c});if(o.h3.length>6000)o.h3.splice(0,1000),o.h3b=(o.h3b||0)+1000} // журнал попаданий в координатах корабля — 3D рисует и те, что были вне кадра
  if(o.T.defl&&rnd()<o.T.defl){fx.push({z:o.z,x,y,t0:t,d:3,r:0.8});return}
  if(kind==='fgt'){fighterHit(o,dmg,x,y,vx,vy);return}
  const a=adiff(o.hd,Math.atan2(-(vy-(o.sy||0)),-(vx-(o.sx||0))))+R(-0.35,0.35),ab=Math.abs(a);
  const zi=ab<0.785?0:ab>2.356?2:(a>0?1:3);let z=o.zones[zi];if(TESTLOG){const k=o.T.n+':'+kind+':'+zi;(stat.zh=stat.zh||{})[k]=(stat.zh[k]||0)+1}
  // у корабля нет хп: слои брони по колонкам, потом модули. Попадание снимает слои в случайном месте (воронка шире от тяжёлого снаряда),
  // пробитая колонка пропускает остаток урона к ближайшим модулям; после гибели модуля урон идёт к соседнему
  const fin=(c,nc,cut,pass)=>{ // общий конец: картинка воронки, модули за пробоиной, экипаж, пожары
  if(cut){if(kind==='rail'&&pass<=0)ricochet(o,x,y,vx,vy);else fx.push({z:o.z,x,y,t0:t,d:4,r:1});if(frags.length<300&&rnd()<.5)spawnShards(x,y,o.z,2,3);o.mor-=.002;
    if(cut>=3&&rnd()<Math.min(.9,.15+cut*.04))spawnPlates(o,x,y,1+(cut>14?1:0)+(cut>40?1:0),false);{const rr=rnd();addDecal(o,x,y,vx,vy,kind==='laser'?1.3:cut>20?.8:.5,kind==='laser'?(rr<.5?2:rr<.8?7:5):cut<3?(rr<.25?3:rr<.45?4:rr<.65?9:rr<.85?6:10):(rr<.3?0:rr<.5?5:rr<.65?8:rr<.8?10:rr<.9?7:6))}}
  if(imp){imp.left=z.cols[c];imp.arm=z.arm} // картинка берёт остаток слоёв из расчёта: 0 — сквозная дыра
  if(pass<=0)return;
  const k=kind==='torp'?TORP.mod:pass,f=(c+.5)/nc,pu=zi===0?.33:zi===2?-.4:(f-.5)*.52,pv=zi===1?.2:zi===3?-.2:(f-.5)*.5;
  const killed=[];  for(let i=0;i<k;i++){let m=null,bd=1e9;for(const zz of o.zones)for(const q of zz.mods)if(q.alive){const du=(q.u||0)-pu,dv=(q.v||0)-pv,d=du*du+dv*dv+(q.k==='C'?.04:0); /* реактор за другими модулями: до него доходит, когда соседи выбиты */if(d<bd){bd=d;m=q}}
    if(!m)break;if(m.ar>0&&m.k!=='C'){m.ar--;fx.push({z:o.z,x,y,t0:t,d:3,r:.7});continue}mdead(o,m);killed.push(m);if(rnd()<DCN.wreckP||m.fixed2)m.wreck=1; /* дважды чиненный модуль после нового попадания — только из запаса */if(stat.crw)(stat.crw.sys[m.k]=stat.crw.sys[m.k]||{lost:0}).lost++;if(m.k==='E')say(o.side,'eng',o);else if(m.k!=='C')say(o.side,'mod',o)}
  const tk=(kind==='laser'&&pw&&pw<1)?pw:1; // такт лазера (0,1 с): побочные эффекты проникновения редкие, иначе корабль горит непрерывно
  if(tk===1||rnd()<tk*.5){fx.push({z:o.z,x,y,t0:t,d:10,r:3});SFX.boom(3);spawnPlates(o,x,y,2+Math.min(3,k),true);addDecal(o,x,y,vx,vy,1.2,1)}
  // ПРОБИТИЕ ВНУТРЬ (pass>0): люди отсека, разгерметизация, погреб. Энергия удара — ½·m·v² снаряда; остановленное бронёй сюда не доходит
  {const kgp=pr&&pr.kg?pr.kg:kind==='rail'?RAIL_M(pr&&pr.cal||10):gat?GAT_M:kind==='torp'||kind==='mis'?500:20,EMJ=.5*kgp*(Math.max(.1,vr||5)*1000)**2/1e6,zs=new Set([zi,...killed.map(m=>m.z)]);
   for(const zz of zs)crewKill(o,zz,Math.min(.6,(.03+.03*killed.filter(m=>m.z===zz).length+.02*Math.log10(1+EMJ)+(kind==='torp'||kind==='mis'?.15:0))*tk*(zz===zi?1:.6)),kind==='mis'||kind==='torp'?'ракета/торпеда':kind==='laser'?'лазер':'пробитие',killed);
   hullHit(o,zi,(HST.pen+HST.penK*killed.length)*Math.max(.5,Math.min(1.5,EMJ/HST.mj))*tk,'пробитие');if(!o.alive)return;
   if(!o.vac[zi]&&rnd()<Math.min(.7,(.15+.1*k)*tk)){o.vac[zi]=1;o.fire[zi]=0;stat.crw.vac++;crewKill(o,zi,CREW.vacKill,'разгерметизация')}
   const A=zoneAmmo(o,zi);{const st=stat.crw;st.pen=(st.pen||0)+1;if(A.x>0){st.penAmmo=(st.penAmmo||0)+1;const ty=A.mis>0?'ракеты':'снаряды';(st.penBy=st.penBy||{})[ty]=(st.penBy[ty]||0)+1;st.penE=(st.penE||0)+EMJ}}if(A.x>0&&rnd()<MAG.vol*(1-Math.exp(-A.x/MAG.x0))*Math.min(1,MAG.k0+MAG.k1*k)*Math.min(1,EMJ/MAG.mj)*tk){ // путь снаряда задел погреб отсека
     o.magAr=o.magAr==null?(o.spec.magArm||0):o.magAr;if(o.magAr>0)o.magAr--;else if(o.spec.magEj){if(!o.magEjT)o.magEjT=t+60}else{const ty=A.mis>0?'ракеты':'снаряды';(stat.crw.detBy=stat.crw.detBy||{})[ty]=(stat.crw.detBy[ty]||0)+1;detonate(o,zi,0,'попадание в погреб')}}
   if(!o.alive)return}
  o.mor-=(.012+.01*k)*tk;

  if(rnd()<(.07+.04*k)*tk*(tk<1?.5:1)){const zi2=o.zones.indexOf(z);if(zi2>=0&&!o.vac[zi2]){o.fire[zi2]=Math.min(3,o.fire[zi2]+1);stat.fires++;say(o.side,'fire_',o)}}
  say(o.side,'hit',o);
  if(!o.core.alive&&!o.blackT){o.blackT=t;o.heat=0;stat.blk++;say(o.side,'power',o);fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:12,r:6})}else if(o.core.alive)o.blackT=0; // реактор выбит — обесточен до ремонта (раньше: второй раз — гибель)
  };
  if(gat)stat.gHit=(stat.gHit||0)+1;
  if(gat){ // пуля минигана: по броне — 0,1% снять слой, иначе рикошет; по голому месту — 1% уничтожить ближайший модуль
    const nc=z.nc,uu=Math.max(-.5,Math.min(.5,((x-o.x)*Math.cos(o.hd)+(y-o.y)*Math.sin(o.hd))/o.T.L));let c=Math.max(0,Math.min(nc-1,Math.round((uu+.5)/.84*nc+R(-1.5,1.5))));
    {const m=extHit(o,zi,x,y);if(m){mdead(o,m);stat.extK=(stat.extK||0)+1;if(imp){imp.left=0;imp.arm=z.arm}say(o.side,'mod',o);return}} // пуля физически попала во внешний модуль (стоит снаружи брони)
    if(pr){const g=dig(o,z,x,y,iz,Math.min(GAT_K*vr*vr,penCap(GATP.m,GATP.area)),1,{k:'гатлинг 30 мм',v:vr});c=g.c; // пуля: одна ячейка, глубина по энергии
      if(g.left<=0){if(g.took<.5){ricochet(o,x,y,vx,vy);if(imp)imp.rico=1}if(imp){imp.left=z.cols[c];imp.arm=z.arm;imp.mm=g.rem}return}
      if(imp){imp.left=0;imp.arm=z.arm}if(rnd()>=Math.min(1,.01+g.left/LAYER_MM))return}
    else if(z.cols[c]>0){const gl=(pr?GAT_K*vr*vr:.0015)/ARM_E,ly=Math.floor(gl)+(rnd()<gl%1?1:0); // МДж/см² пули / порог слоя: 0,6 км/с — ~0,08%, от 22 км/с — слой
      if(ly>0){const tk=Math.min(z.cols[c],ly);z.cols[c]-=tk;z.armN-=tk}else{ricochet(o,x,y,vx,vy);if(imp)imp.rico=1}if(imp){imp.left=z.cols[c];imp.arm=z.arm}return}
    else{if(imp){imp.left=0;imp.arm=z.arm}if(rnd()>=.01)return}
    const f=(c+.5)/nc,pu=zi===0?.33:zi===2?-.4:(f-.5)*.52,pv=zi===1?.2:zi===3?-.2:(f-.5)*.5;let m=null,bd=1e9;for(const zz of o.zones)for(const q of zz.mods)if(q.alive){const du=(q.u||0)-pu,dv=(q.v||0)-pv,d=du*du+dv*dv;if(d<bd){bd=d;m=q}}
    if(m){mdead(o,m);if(m.k==='E')say(o.side,'eng',o);else if(m.k!=='C')say(o.side,'mod',o)}return}
  if(kind==='rail'&&pr&&pr.kk){{const m=extHit(o,zi,x,y);if(m){mdead(o,m);stat.extK=(stat.extK||0)+1;say(o.side,'mod',o)}} // рельс: снаряд калибра N см накрывает ⌈N/10⌉² ячеек, глубина = 10 мм на МДж/см²; остаток после пробития — по модулям (1 удар на 2 см лишней глубины)
    const g=dig(o,z,x,y,iz,Math.min(pr.kk*vr*vr,penCap(RAIL_M(pr.cal||10),Math.PI*((pr.cal||10)/2)**2)),Math.max(1,Math.ceil((pr.cal||10)/10)),{k:'рельс '+(pr.cal||10)+' см',v:vr}),cut=g.took/LAYER_MM,pass=g.left>0?Math.min(PASS.max,1+Math.floor(g.left/PASS.mm)):0;if(imp){imp.mm=g.rem;imp.dep=g.dep}
    if(g.took<.5&&!pass){ricochet(o,x,y,vx,vy);if(imp){imp.rico=1;imp.left=z.cols[g.c];imp.arm=z.arm}return}
    fin(g.c,z.nc,cut,pass);return}
  if(kind==='laser'||kind==='torp'||kind==='rock'){ // лазер — пятно 10 см, торпеда — 30 см, камень — 50 см; удельная энергия = прежние «слои» × 2 МДж/см² (торпеда — 30 МДж/см²)
    const Eu=kind==='torp'?30:Math.max(0,dmg*(kind==='laser'?.7:.22))*ARM_E,g=dig(o,z,x,y,iz,Eu,kind==='torp'?3:kind==='rock'?5:1,{k:kind==='laser'?'лазер':kind==='torp'?'торпеда':'камень',v:Math.hypot(vx,vy,vz||0)}),cut=g.took/LAYER_MM,pass=g.left>0?Math.min(PASS.max,1+Math.floor(g.left/PASS.mm)):0;
    if(imp){imp.mm=g.rem;imp.dep=g.dep}if(g.took<.5&&!pass){fx.push({z:o.z,x,y,t0:t,d:2,r:0.5});if(imp){imp.left=z.cols[g.c];imp.arm=z.arm}return}
    fin(g.c,z.nc,cut,pass);return}
  // ракеты: слои по метровым колонкам (переделаем отдельно)
  let dm=kind==='torp'?1:(kind==='rail'&&pr&&pr.kk)?pr.kk*vr*vr/ARM_E:dmg*(kind==='fgt'?1:kind==='laser'?.7:kind==='mis'?.5:.22); dm=Math.floor(dm)+(rnd()<dm%1?1:0);
  if(dm<=0){if(kind==='rail')ricochet(o,x,y,vx,vy);else fx.push({z:o.z,x,y,t0:t,d:2,r:0.5});return}
  const nc=z.nc,uu=Math.max(-.5,Math.min(.5,((x-o.x)*Math.cos(o.hd)+(y-o.y)*Math.sin(o.hd))/o.T.L)),c=Math.max(0,Math.min(nc-1,Math.round((uu+.5)/.84*nc+R(-1.5,1.5)))),w=(kind==='rail'&&pr&&pr.kk)?Math.max(1,Math.round(PW*(pr.cal||10)/10)):Math.max(1,Math.round(dm*PW)),half=w>>1;let pass=dm,cut=0;
  if(kind==='rail'){const oz=o.zones[(zi+2)%4],oc=Math.max(0,Math.min(oz.nc-1,Math.round((c+.5)/nc*oz.nc-.5)));
    if(z.cols[c]<=0&&oz.cols[oc]<=0&&rnd()<.5){fx.push({z:o.z,x,y,t0:t,d:3,r:.6});stat.through=(stat.through||0)+1;return}}
  if(kind==='rail'&&pw&&!(pr&&pr.kk)&&rnd()<pw){pass=dm;fx.push({z:o.z,x,y,t0:t,d:2,r:.5})}else
  if(kind==='mis'){ // ракета: сегмент PW колонок; в центре dm слоёв, к краям спад до 1; число сегментов растёт с мощностью (3→3, 9→5, 25→7, 30→9)
    const P0=pw||dmg,hs=Math.round(Math.sqrt(Math.max(1,P0))/1.5),W=hs*2+1,cen=Math.max(dmg*.5,.5);pass=0;
    for(let sg=-hs;sg<=hs;sg++){let dv=Math.max(sg===0?cen:1,cen*(1-Math.abs(sg)/(hs+1)));if(sg!==0&&dmg<P0*.5)dv*=dmg/P0*2;dv=Math.floor(dv)+(rnd()<dv%1?1:0);if(dv<=0)continue;
      for(let q=0;q<PW;q++){const cc=c+sg*PW+q-(PW>>1);if(cc<0||cc>=nc)continue;const d=z.cols[cc],tk=Math.min(d,dv);if(tk){z.cols[cc]=d-tk;z.armN-=tk;cut+=tk}if(sg===0&&q===(PW>>1))pass=dv-tk}}
    dm=Math.max(dm,1)
  }else
  for(let j=-half;j<w-half;j++){const cc=c+j;if(cc<0||cc>=nc)continue;const d=z.cols[cc],tk=Math.min(d,dm);if(tk){z.cols[cc]=d-tk;z.armN-=tk;cut+=tk}if(j===0)pass=dm-tk}
  fin(c,nc,cut,pass);
}
// пулемёт Гатлинга: непрерывный огонь по истребителям, ракетам и торпедам (в упор — по кораблям); нагрев снижает точность, перегрев — заклинивание или поломка
const GV=GATP.v;initKernel({SNS,GATP,VP,DISP,GDISP,PLN,GV}); /* ядро оценки ИИ — в отдельном чистом модуле */ // пуля гатлинга 0,6 км/с; единицы боя — км и с (рельсотрон 2–10 км/с по калибру)
let pdQ=[];function pdStep(){if(!pdQ.length)return;const keep=[];for(const q of pdQ){if(t<q.at){keep.push(q);continue}if(mis.indexOf(q.p)<0)continue;hurtMis(q.p,1);if(!(q.p.hp>0)){const S=stat.pvo=stat.pvo||{};(S.kill=S.kill||{})[q.r]=(S.kill[q.r]||0)+1;if(q.p.tgt&&q.p.tgt!==q.s)(S.forOther=S.forOther||[0,0])[q.s.side]++}}pdQ=keep}
function gatStep(s,m,dt){
  const C=m.cfg;let e=null,kind=0,bd=Math.min(C.rng,GV*20)**2;
  if(!m.lock){for(const c of fly[1-s.side]){if(c.state!=='fly')continue;const d=(c.x-s.x)**2+(c.y-s.y)**2;if(d<bd){bd=d;e=c;kind=1}}
    if(!e&&mis.length){let bm=MIS.pdR*MIS.pdR;for(const p of mis){if(p.side===s.side)continue;const d=(p.x-s.x)**2+(p.y-s.y)**2;if(d>=bm||!misThreat(s,p))continue;if(MIS.pdPhys){const dd=Math.sqrt(d),cl=Math.max(0,-((p.x-s.x)*(p.vx-(s.sx||0))+(p.y-s.y)*(p.vy-(s.sy||0)))/(dd||1));if(GV*dd/(GV+cl)>C.rng*1.4)continue} /* пули долетают лишь на rng×1,4: стреляем, только если точка встречи с ракетой в досягаемости */bm=d;e=p;kind=2}} // сначала дальность (дёшево), потом угроза // по ракетам пулемёт бьёт до missile.pdR км: ракета сама летит навстречу пулям
    if(!e)for(const p of torps){if(p.side===s.side)continue;const d=(p.x-s.x)**2+(p.y-s.y)**2;if(d<bd){bd=d;e=p;kind=3}}}
  if(!m.lock&&!e&&s.tg&&s.tg.alive&&Math.hypot(s.tg.x-s.x,s.tg.y-s.y)<effR(s,s.tg,GV)&&hitP(s,s.tg,GV,1)>=PMIN){e=s.tg;kind=4} // дальше 12 км пуля всё равно угаснет — не стреляем
  if(!e||m.lock||s.mag<=0){m.why=m.lock?'перегрев: остывает ('+Math.round(m.heat*100)+'%, стрельба с 55%)':s.mag<=0?'нет боеприпасов':'нет целей ближе '+Math.min(C.rng,GV*20).toFixed(0)+' км'+(m.last?' · последний: '+m.last:'');m.heat=Math.max(0,m.heat-C.cool/60*dt);if(m.lock&&m.heat<.55)m.lock=false;return}
  if(C.rot&&!C.ax){const want=Math.atan2(e.y-s.y,e.x-s.x);if(m.ang==null)m.ang=want;const d=adiff(m.ang,want),st=C.rot*Math.PI/180*dt;if(Math.abs(d)>st){m.ang+=Math.sign(d)*st;m.why='турель разворачивается ('+C.rot+'°/с)';m.heat=Math.max(0,m.heat-C.cool/60*dt);return}m.ang=want} // скорость разворота турели
  m.heat+=C.heat/60*dt;addHeat(s,(C.heatMW||.5)*dt);if(C.failM&&rnd()<C.failM/60*dt){mdead(s,m);m.why='пулемёт сломался при стрельбе (1% в минуту)';return}{const tn=C.ammoH/3600*dt;(stat.gatT=stat.gatT||[0,0])[s.side]+=tn;s.mag=Math.max(0,s.mag-tn)}
  if(m.heat>=1){m.heat=1;if(rnd()<.3){mdead(s,m);fx.push({x:s.x,y:s.y,t0:t,d:4,r:1});return}m.lock=true;return}
  m.fa=Math.atan2(e.y-s.y,e.x-s.x);m.rt=performance.now();m.acc+=dt*10;const w=C.rpm/600,dist=Math.hypot(e.x-s.x,e.y-s.y),eR=Math.max(.5,effR(s,e,GV));
  const pAcc=Math.max(.02,(.55-.4*Math.min(1,dist/eR))*(1-.95*m.heat))*(1.2-.05*m.sk);
  if(pAcc<.15){m.why='цель '+(e&&e.T?e.T.n:e&&e.type==='F'?'истребитель':e&&e.type==='B'?'бомбардировщик':'цель')+' в '+dist.toFixed(1)+' км: точность '+Math.round(pAcc*100)+'% ниже порога 15% — не стреляет';m.acc=0;m.heat=Math.max(0,m.heat-C.cool/60*dt*.5);return} // слишком неточно — не поливаем во все стороны
  m.last=m.why='огонь по '+(kind===1?'истребителю':kind===2?'ракете':kind===3?'торпеде':(e&&e.T?e.T.n:e&&e.type==='F'?'истребитель':e&&e.type==='B'?'бомбардировщик':'цель'))+' '+dist.toFixed(1)+' км · точность '+Math.round(pAcc*100)+'% · нагрев '+Math.round(m.heat*100)+'%';SFX.shot('gat');let n=0;while(m.acc>=1&&n<6){m.acc--;n++;
    if(kind===1)fireAt(s.x,s.y,s.z,s,m,s.side,e,GV,pAcc,w*.05,C.rng*1.4);
    else if(kind===4)fireAt(s.x,s.y,s.z,s,m,s.side,e,GV,pAcc,0,C.rng*1.4,w*C.pen*.01);
    else{fireAt(s.x,s.y,s.z,s,m,s.side,e,GV,pAcc*.6,0,C.rng*1.4);if(kind===2&&m.pdT!==e){m.pdT=e;m.pdM=0}if(rnd()<pAcc*.12*w/10*(kind===2?1+MIS.walk*Math.min(MIS.walkN,m.pdM||0):1)){if(kind===2&&MIS.pdPhys){const dd=Math.hypot(e.x-s.x,e.y-s.y),cl=Math.max(0,-((e.x-s.x)*(e.vx-(s.sx||0))+(e.y-s.y)*(e.vy-(s.sy||0)))/(dd||1));pdQ.push({p:e,at:t+dd/(GV+cl),s,r:s.side+':'+(s.role||'—')});m.pdM=0} /* попадание пули засчитывается, когда она долетает до точки встречи (время полёта), а не мгновенно */else if(kind===2){hurtMis(e,1);m.pdM=0;if(!(e.hp>0)){const S=stat.pvo=stat.pvo||{};const r=s.side+':'+(s.role||'—');(S.kill=S.kill||{})[r]=(S.kill[r]||0)+1;if(e.tgt&&e.tgt!==s)(S.forOther=S.forOther||[0,0])[s.side]++}}else{const i=torps.indexOf(e);if(i>=0){torps.splice(i,1);stat.torpPd[e.side]++}}}else if(kind===2)m.pdM=(m.pdM||0)+1}} // промах по ракете — следующая очередь с другим упреждением: шанс растёт (пристрелка)
  if(n)recoil(s,m,GAT_M*n*C.rpm/600,GV,e.x-s.x,e.y-s.y); // каждый выстрел в симуляции — rpm/600 пуль
}
// шрапнель: разрыв в рассчитанной точке, облако шариков радиусом blast. Взрыватель: таймер — промах точки разрыва полный; лазерный — ×laser, РЭБ не мешает; радарный — ×radar, но помехи цели увеличивают промах
const FLAKF=gd('battle','flak',{laser:.5,radar:.3,jam:3,kill:.35,v:1,rof:.5,heatMW:.3,ammoH:3}); // v км/с снаряда, rof с между выстрелами (2/с), тепло МВт при стрельбе, т боеприпасов в час
let flakS=[];
function flakBurst(s,m){
  const F=m.cfg,cand=[];for(const c of fly[1-s.side])if(Math.hypot(c.x-s.x,c.y-s.y)<F.rng)cand.push(c);
  const tp=torps.concat(mis).filter(p=>p.side!==s.side&&Math.hypot(p.x-s.x,p.y-s.y)<F.rng&&(p.tr==null||misThreat(s,p)));
  if(!cand.length&&!tp.length){m.cd=2;return false}
  const e=tp.length&&rnd()<0.5?tp[(rnd()*tp.length)|0]:(cand.length?cand[(rnd()*cand.length)|0]:tp[0]);
  const d=Math.hypot(e.x-s.x,e.y-s.y),fz=m.cfg.fz||'t',src=e.src||null,jm=src&&src.jam||0,err=(0.25+0.012*d)*(1.4-0.08*m.sk)*(fz==='l'?FLAKF.laser:fz==='r'?FLAKF.radar*(1+jm*FLAKF.jam):1)/(d<1?1:tq(s,e.T?e:{rl:null}));
  let Tf=d/FLAKF.v;for(let k=0;k<3;k++){const ex=e.x+((e.vx??e.sx)||0)*Tf,ey=e.y+((e.vy??e.sy)||0)*Tf;Tf=Math.hypot(ex-s.x,ey-s.y)/FLAKF.v}const bx=e.x+((e.vx??e.sx)||0)*Tf+gauss()*err,by=e.y+((e.vy??e.sy)||0)*Tf+gauss()*err; // упреждение на время полёта снаряда (1 км/с)
  m.fa=Math.atan2(by-s.y,bx-s.x);m.rt=performance.now();SFX.shot('flak');stat.flak[s.side]++;{const dd=Math.hypot(bx-s.x,by-s.y);flakS.push({x:s.x,y:s.y,z:s.z||0,vx:(bx-s.x)/dd*FLAKF.v,vy:(by-s.y)/dd*FLAKF.v,tA:t+dd/FLAKF.v,bx,by,side:s.side,blast:F.blast,s})}return true}
// разрыв шрапнели, когда снаряд долетел до рассчитанной точки
function flakPop(q){const s=q.s,bx=q.bx,by=q.by,F={blast:q.blast};fx.push({x:bx,y:by,z:q.z,t0:t,d:3,r:F.blast});
  for(const c of fly[1-s.side])if(c.state==='fly'&&Math.hypot(c.x-bx,c.y-by)<F.blast){c.hp--;if(c.hp<=0){killCraft(c);stat.flakKill[s.side]++}}
  for(let i=torps.length-1;i>=0;i--){const p=torps[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast*1.5&&rnd()<0.7){torps.splice(i,1);stat.torpPd[p.side]++;stat.flakKill[s.side]++}}
  for(let i=mis.length-1;i>=0;i--){const p=mis[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast&&rnd()<FLAKF.kill){if(p.sub>1){splitMis(p);continue}p.end='down';fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:2.5,r:.8,mk:'down'});mis.splice(i,1);stat.misShot[p.side]++;stat.flakKill[s.side]++}}
  return true;
}
// осечка: орудие клинит на 4 минуты, иногда взрывается
function jamChk(s,m,C){if(!C.fail||rnd()>=C.fail)return;stat.jams=(stat.jams||0)+1;m.cd=240;fx.push({x:s.x,y:s.y,t0:t,d:6,r:1.5});if(rnd()<0.15){m.alive=false;s.aliveN--;stat.boom=(stat.boom||0)+1;hullHit(s,m.z,HST.gun,'взрыв своего орудия')}}
function fireShell(s,m,o0,C,lag){if(m)m.firedT=t;
  let o=o0&&o0.alive?o0:(s.tg&&s.tg.alive?s.tg:null);if(!o)return;
  const VPc=C.vp,rsz=(o.vz||0)-(s.vz||0),rsx=o.sx-(s.sx||0),rsy=o.sy-(s.sy||0);let oz=o.z||0;let T=Math.hypot(o.x-s.x,o.y-s.y,oz-s.z)/VPc; // упреждение в системе стрелка
  const oax=(o.aex||0)*LEAD.acc,oay=(o.aey||0)*LEAD.acc; /* ускорение берём вполовину: тяга импульсами и может прекратиться */ // упреждение с ускорением цели: x + v·T + ½·a·T²
  for(let i=0;i<4;i++){const px=o.x+rsx*T+.5*oax*T*T,py=o.y+rsy*T+.5*oay*T*T,pz=(o.z||0)+rsz*T;T=Math.hypot(px-s.x,py-s.y,pz-s.z)/VPc}oz=(o.z||0)+rsz*T;
  // вилка на уклонение: цель за время полёта может сместиться маневровыми на ½·a·t² вбок — часть снарядов бьёт туда, куда она увернётся
  let bkx=0,bky=0;if(m.sv&&m.sv.o===o){ /* залп: точка k из N — «подсолнух» по кругу ½·a·t², вбок и по высоте */const sv=m.sv,k=sv.k++,w=Math.min(12,T),D=(o.T&&o.rcsN>0&&(!o.fuelCap||o.fuel/o.fuelCap>.4))?Math.max(0,.5*(o.acc||5)*.12/1000*w*w-o.T.L*.11)*SALVO.fill:0, /* засеваем только то, куда цель уйдёт дальше своего размера */r=D*Math.sqrt(((k%sv.N)+.5)/sv.N),th=k*2.39996,lx=o.x-s.x,ly=o.y-s.y,ll=Math.hypot(lx,ly)||1;bkx=-ly/ll*r*Math.cos(th);bky=lx/ll*r*Math.cos(th);oz+=r*Math.sin(th);stat.salvo=(stat.salvo||0)+1}
  else{const dodge=o.T&&o.rcsN>0&&(!o.fuelCap||o.fuel/o.fuelCap>.4);if(dodge){const w=Math.min(12,T),D=.5*(o.acc||5)*.12/1000*w*w,lx=o.x-s.x,ly=o.y-s.y,ll=Math.hypot(lx,ly)||1,r=rnd(),sg=r<.34?0:r<.67?1:-1;bkx=-ly/ll*D*LEAD.bracket*sg;bky=lx/ll*D*LEAD.bracket*sg}}
  const px=o.x+rsx*T+.5*oax*T*T+bkx,py=o.y+rsy*T+.5*oay*T*T+bky,d=Math.hypot(px-s.x,py-s.y,oz-s.z),ek=2*(1.4-0.08*m.sk)*C.sig/(d<TRK.near?1:tq(s,o)),e0=DISP*d*ek,kq=1,e=e0,ev=e0; // разброс ствола; цель не «угадывается» — промахи от её настоящего уклонения маневровыми // разброс общий по обеим осям; сужен так, чтобы шанс попасть в 3D ≈ прежнему // по высоте — только рассеяние ствола: цель уклоняется в плоскости
  const ax=px+gauss()*e-s.x,ay=py+gauss()*e-s.y,az=oz+gauss()*ev-s.z,l=Math.hypot(ax,ay,az)||1e-6;let vx=ax/l*VPc,vy=ay/l*VPc,vz=az/l*VPc;
  // башня наводится по вектору полёта снаряда, снаряд выходит из конца её ствола
  const mo=MUZ?MUZ(s,m,vx,vy,vz):null,X0=s.x+(mo?mo.x:0),Y0=s.y+(mo?mo.y:0),Z0=s.z+(mo?mo.z:0),k0=VPc*lag+(mo?0:s.T.L*.4);if(mo){const bx=s.x+ax-X0,by=s.y+ay-Y0,bz=s.z+az-Z0,l2=Math.hypot(bx,by,bz)||1;vx=bx/l2*VPc;vy=by/l2*VPc;vz=bz/l2*VPc}
  m.fa=Math.atan2(ay,ax);m.rt=performance.now();
  vx+=s.sx||0;vy+=s.sy||0;vz+=s.vz||0;
  recoil(s,m,RAIL_M(C.cal),VPc,ax,ay);
  {const k=RAIL_M(C.cal)/(s.T.tons*1000);s.sx-=vx*k;s.sy-=vy*k} // отдача рельсотрона: снаряд (кг) × скорость относительно ствола / масса корабля
  proj.push({bt:t,kk:RAIL_K(C.cal),cal:C.cal||10,x:X0+(vx-(s.sx||0))/VPc*k0,y:Y0+(vy-(s.sy||0))/VPc*k0,z:Z0+(vz-(s.vz||0))/VPc*k0,vz,vx,vy,side:s.side,dist:Math.hypot(vx,vy)*lag,dmg:C.dmg*.4,ap:C.ap||0,cd:3,max:Math.hypot(vx,vy)*20,src:s,m:m,ev:rnd(),o0:{x:X0,y:Y0,z:Z0}});
  stat.shots[s.side]++;s.flash=t;SFX.shot('rail');
  if(fx.length<300)fx.push({x:s.x+ax/l*s.T.L*.45,y:s.y+ay/l*s.T.L*.45,z:s.z,t0:t,d:.3,r:.5,muz:1,side:s.side});
}
// взрыв ракеты: бьёт всех рядом, в том числе своих
// ракеты: полёт с бюджетом Δv. Разгон к точке перехвата, потом наведение: гасим боковой промах (пропорциональная навигация) остатком Δv
const MIS=gd('battle','missile',{pdPhys:1,mc:1,inh:1,dvK:1.5,acc:.5,N:3,boost:.85,cal:1,pdR:120,relK:30,relP:.66,grp:.8,maxW:90,subM:.8,subV:.05,subDv:1,subD:25,walk:.5,walkN:6}); // dvK: Δv = старая «скорость» × dvK; acc км/с²; N — коэффициент навигации; boost — доля Δv на разгон
// залп группы: все трубы флота (своего генерала) копят готовность; когда готово ≥ grp или ждём дольше maxW — окно пуска на 3 с, цель одна на всех
function misGate(F,o){if(!F)return true;if(F.mT!==t){F.mT=t;let n=0,r=0;for(const q of F.ships)if(q.alive)for(const m of q.tur)if(m.alive&&m.k==='M'&&m.ammo>0){n++;if(m.cd<=1)r++}F.mFr=n?r/n:0;
    if(t>=(F.mOpen||0)){if(F.mW==null)F.mW=t;if(n&&(F.mFr>=MIS.grp||t-F.mW>MIS.maxW)){F.mOpen=t+3;F.mW=null;F.mTg=o}}}
  return t<(F.mOpen||0)}
// головки: ir — пассивная по теплу (ловушки уводят), ac — активный радар (батарея на bat с, включается на подлёте; ловушки не берут, РЭБ глушит), c — обе (ловушки — ×DEC.comb), none — по данным корабля
const DEC=gd('battle','decoy',{r:30,every:4,W:400,lv:1,min:.3,max:5});
function skOf(C){const l=C.sl||{};return l.ir&&l.ac?'c':l.ac?'ac':l.ir?'ir':l.em?'em':'none'}
function seekOk(p,tg,d,dt){if(p.sk==='ac'||p.sk==='c'){const cl=Math.max(.2,closing({x:p.x,y:p.y,sx:p.vx,sy:p.vy},tg)),tgo=d/cl;if(tgo<p.bat+2){p.bat=Math.max(0,p.bat-dt);if(p.bat<=0&&p.sk==='ac')return false}}return true} // активная: батарея тратится только на подлёте; кончилась — летит вслепую
// ловушки: корабль с запасом отстреливает ловушку раз в DEC.every с, если к нему летят ракеты ближе DEC.r км; каждая ИК-ракета в зоне уходит на ловушку с шансом ir/(1+уровень), комбинированная — ×comb
function decoyStep(){for(const s of ships){if(!s.alive||!(s.dec>0)||t<(s.decT||0))continue;let any=false;s.decW=DEC.W*Math.exp(R(Math.log(DEC.min),Math.log(DEC.max)));
    for(const p of mis){if(p.side===s.side||p.tgt!==s)continue;if(Math.hypot(p.x-s.x,p.y-s.y)>DEC.r)continue;any=true;
      if(p.sk==='ir'||(p.sk==='c'&&p.bat<=0)){const fl=s.decW/(1+DEC.lv*(p.lv||1));if(fl>irW(s)){p.tgt=null;p.rl=t+30;stat.decoyHit=(stat.decoyHit||0)+1}}} // ИК-головка идёт на самое яркое: ловушка (с поправкой на уровень головки — отличает спектр) против тепла корабля; комбинированная с батареей сверяет с радаром и ловушки отбрасывает
    if(any){s.dec--;s.decT=t+DEC.every;/* яркость каждой ловушки своя (от min до max ×W): головке труднее выучить «как выглядит ловушка» */stat.decoyUse=(stat.decoyUse||0)+1;fx.push({x:s.x+R(-1,1),y:s.y+R(-1,1),z:s.z,t0:t,d:4,r:.5})}}}
// кассетная ракета: при первом попадании ПРО корпус раскрывается, n боеголовок летят дальше сами: вместе весят subM от массы кассеты (каждая — subM×масса/n), у каждой свой маленький бак на subDv км/с; оставшееся топливо кассеты пропадает вместе с корпусом
function splitMis(q){const n=q.sub,i=mis.indexOf(q);if(i<0)return;q.end='split';mis.splice(i,1);stat.misSplit=(stat.misSplit||0)+1;fx.push({x:q.x,y:q.y,z:q.z,t0:t,d:2,r:.4});
  const kg=q.kg*MIS.subM/n;for(let k=0;k<n;k++){const a=rnd()*6.283,v=R(0,MIS.subV);mis.push({...q,sub:0,dart:1,hp:1,kg,tr:[],trT:0,vx:q.vx+Math.cos(a)*v,vy:q.vy+Math.sin(a)*v,dv:MIS.subDv,dv0:MIS.subDv,ph:'boost',sr:0,pd:null})}}
function misFly(p,tg,dt,guide){const rx=tg.x-p.x,ry=tg.y-p.y,d=Math.hypot(rx,ry)||1e-6,rvx=(tg.sx||0)-p.vx,rvy=(tg.sy||0)-p.vy,cl=-(rx*rvx+ry*rvy)/d,tgo=d/Math.max(.2,cl);
  let ax=0,ay=0;if(p.dv>0&&guide){const ux=rx/d,uy=ry/d;
    const zx=rx+rvx*tgo,zy=ry+rvy*tgo,zl=zx*ux+zy*uy,lx=zx-ux*zl,ly=zy-uy*zl; // промах без управления, его боковая часть
    ax=MIS.N*lx/(tgo*tgo);ay=MIS.N*ly/(tgo*tgo);
    if(p.ph==='boost'){ax+=ux*p.acc;ay+=uy*p.acc;if(p.dv<=p.dv0*(1-MIS.boost))p.ph='coast'} // разгон по линии визирования
    const al=Math.hypot(ax,ay),mx=Math.min(p.acc,p.dv/Math.max(dt,1e-6));if(al>mx){ax*=mx/al;ay*=mx/al}p.dv=Math.max(0,p.dv-Math.hypot(ax,ay)*dt)}
  p.vx+=ax*dt;p.vy+=ay*dt;p.x+=p.vx*dt;p.y+=p.vy*dt;p.h=Math.atan2(p.vy,p.vx);p.burn=Math.hypot(ax,ay)>1e-4?1:0;p.tx=ax;p.ty=ay} // tx,ty — тяга для картинки (куда смотрит сопло); на полёт не влияет
// попадание кинетической ракеты: удар как у снаряда — масса и относительная скорость, калибр по массе (сталь: 3·(кал/5)³ кг)
function misHit(p,o){{const S=stat.pvo=stat.pvo||{};if(o.__pvoT&&t-o.__pvoT<15)(S.hitProt=S.hitProt||[0,0])[o.side]++;else (S.hitOther=S.hitOther||[0,0])[o.side]++} /* попадание ракеты: по прикрытому ПВО кораблю или нет */const cal=5*Math.cbrt(p.kg/3)*MIS.cal,vr=Math.hypot(p.vx-(o.sx||0),p.vy-(o.sy||0));stat.misHit[p.side]++;(stat.misV=stat.misV||[]).push(Math.round(vr*10)/10);
  p.end='hit';fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:5,r:1.2,mk:'hit'});SFX.boom(4);hitShip(o,'rail',p.vx,p.vy,p.x,p.y,0,0,p.z,0,false,{kk:RAIL_K(cal),cal,vx:p.vx,vy:p.vy,vz:0,src:p.src})}
// ПРО бьёт только ракеты, которые идут на нас: у ракеты есть цель с нашей стороны и она сближается с этим кораблём. Ушедшие мимо, уведённые ловушкой и потерявшие цель не трогаем — пули их не догонят
// угроза для ПВО: ракета сближается с кораблём и (самонаводящаяся) идёт на корабль его стороны или (неуправляемая) по прямой пройдёт в пределах 2 км (3 длин) от кого-то из своих за 180 с —
// траектория видна сенсорам. Раньше неуправляемые ракеты не считались угрозой вовсе: ПВО их не сбивало (замер: 0 сбитых из ~400)
function misThreat(s,p){const dx=s.x-p.x,dy=s.y-p.y,d=Math.hypot(dx,dy)||1;if(((p.vx-(s.sx||0))*dx+(p.vy-(s.sy||0))*dy)/d<=.05)return false;
  if(p.tgt)return p.tgt.alive&&p.tgt.side===s.side;
  const c=p.thC||(p.thC=[-9,-9,false,false]);if(t-c[s.side]<1)return c[2+s.side];let th=false;
  for(const o of ships){if(!o.alive||o.side!==s.side||o.bayOf)continue;const rx=o.x-p.x,ry=o.y-p.y,wx=p.vx-(o.sx||0),wy=p.vy-(o.sy||0),w2=wx*wx+wy*wy||1e-9,tc=(rx*wx+ry*wy)/w2;if(tc<0||tc>180)continue;if(Math.hypot(rx-wx*tc,ry-wy*tc)<Math.max(2,o.T.L*3)){th=true;p.thO=o;break}}
  c[s.side]=t;c[2+s.side]=th;return th}
function nearMis(s,rg){let b=null,bd=rg*rg;for(const q of mis){if(q.side===s.side||!misThreat(s,q))continue;const d=(q.x-s.x)*(q.x-s.x)+(q.y-s.y)*(q.y-s.y);if(d<bd){bd=d;b=q}}return b}
function hurtMis(q,n){if(q.sub>1){splitMis(q);return}q.hp-=n;if(q.hp<=0){const i=mis.indexOf(q);if(i>=0){{const o=q.tgt||q.thO,S=stat.pvo=stat.pvo||{};if(o&&o.side!=null){if(o.__pvoT&&t-o.__pvoT<15)(S.downProt=S.downProt||[0,0])[o.side]++;else (S.downOther=S.downOther||[0,0])[o.side]++}} /* сбита ракета, летевшая к прикрытому / неприкрытому */q.end='down';fx.push({x:q.x,y:q.y,z:q.z,t0:t,d:2.5,r:.8,mk:'down'});mis.splice(i,1);stat.misShot[q.side]++;fx.push({x:q.x,y:q.y,z:q.z,t0:t,d:3,r:.6})}}} // сбитая кинетическая ракета просто разваливается, взрыва нет
// боевой лазер: на огромной дистанции луч дрожит и уводится движением цели; урон идёт каждые 0,1 с в точку, где луч сейчас, и она ползёт по пластинам; луч оставляет чёрную копоть
function fireLaser(s,m,o,C){
  const bm={a:s,b:o,tx:o.x,ty:o.y,tz:o.z,rt:performance.now()+C.dur*1000,c0:performance.now(),side:s.side,w:C.dmg,ld:1};beams.push(bm);
  lasBeams.push({s,m,o,C,t1:t+C.dur,nx:t,ox:0,oy:0,bm,dc:0});s.flash=t;SFX.shot('laser');say(s.side,'laser',s);m.last=m.why='лазер: импульс по '+(o.T?o.T.n:'цели');stat.las[s.side]++;addHeat(s,2.3*(C.E||1000)) /* КПД 30%: 2,3 МДж тепла на 1 МДж луча */}
function lasStep(dt){
  for(let i=lasBeams.length-1;i>=0;i--){const q=lasBeams[i],{s,o,C}=q;
    if(!s.alive||!q.m.alive||!o.alive||t>=q.t1){if(q.bm.rt>performance.now()+300)q.bm.rt=performance.now()+300;lasBeams[i]=lasBeams[lasBeams.length-1];lasBeams.pop();continue}
    while(t>=q.nx){q.nx+=.1;
      const dx0=o.x-s.x,dy0=o.y-s.y,d=Math.hypot(dx0,dy0)||1,sp=Math.min(2,Math.hypot(o.sx||0,o.sy||0)+Math.hypot(s.sx||0,s.sy||0)*.5),sig=d*(.0003+.0018*sp)+.01;
      q.ox=q.ox*.8+gauss()*sig;q.oy=q.oy*.8+gauss()*sig;
      const px=o.x+q.ox,py=o.y+q.oy,ch=Math.cos(o.hd),sh=Math.sin(o.hd),du=px-o.x,dv=py-o.y,u=du*ch+dv*sh,l=-du*sh+dv*ch,L=o.T.L;
      q.bm.tx=px;q.bm.ty=py;q.bm.tz=o.z;
      if(Math.abs(u)>L*.5||Math.abs(l)>L*.08){stat.lasMiss=(stat.lasMiss||0)+1;continue}
      if(!q.h){q.h=1;stat.lasHit[s.side]++}const ix=o.x+ch*u-sh*Math.max(-L*.05,Math.min(L*.05,l)),iy=o.y+sh*u+ch*Math.max(-L*.05,Math.min(L*.05,l));
      if(rnd()<C.ap)hitShip(o,'laser',px-s.x,py-s.y,ix,iy,C.dmg*1.7*.1,.1);
      if(++q.dc%2===0)addDecal(o,ix,iy,px-s.x,py-s.y,.8,11)}}
}
// снабжение: транспорты держатся в хвосте и шаттлами возят боеприпасы кораблям, у которых погреб опустел меньше чем наполовину
const SHUT_SPD=9,SHUT_T=40; // км/с, тонн за рейс
const CAV=gd('battle','cavalry',{arc:.35}); // наскок по дуге: боковое смещение точки прицеливания = arc × дальность (сходится к проскоку) — траектория кривая, снаряды мажут
const HOME=()=>REF.home;const REF=gd('battle','refuel',{home:1,full:.95,dist:2,dv:.3,rate:6,keep:.15,back:100,mar:2,min:.2,dodge:.3}); // дозаправка в бою: уходить при доле топлива go, до full; перекачка при дистанции dist км и разнице скоростей dv км/с; rate т/с; танкер оставляет себе долю keep
// общий бюджет Δv для любого корабля: запас = погасить скорость относительно танкера (или до нуля) + долететь и затормозить у него, × mar
// ТОПЛИВНАЯ ДИСЦИПЛИНА: свободный для боя Δv = доступный по Циолковскому − Δv возвращения на базу (сменить нынешнюю скорость на скорость перелёта к базе)
// − Δv торможения у базы (отдельно) − резерв на непредвиденное. Скорость перелёта — чтобы дойти за RET.T с, не больше RET.v. База — точка входа корабля в бой.
const HOMEB=.5;const RET=gd('battle','return',{flips:3,app:300,slew:60,stay:0,v:1,T:3600,mar:.15,extra:.3,crit:.05}); // км/с, с, доля запаса, км/с резерв, км/с «критический остаток»
function retNeed(s,q){const h=s.home||{x:q.x,y:q.y},dx=h.x-q.x,dy=h.y-q.y,d=Math.hypot(dx,dy)||1e-6,vc=Math.min(RET.v,d/RET.T),turn=Math.hypot(dx/d*vc-q.sx,dy/d*vc-q.sy);return turn+vc+RET.extra+RET.mar*(turn+vc)} // то же для прогнозного состояния
function retPlan(s){const h=s.home||{x:s.x,y:s.y},dx=h.x-s.x,dy=h.y-s.y,d=Math.hypot(dx,dy)||1e-6,vc=Math.min(RET.v,d/RET.T),ux=dx/d,uy=dy/d,turn=Math.hypot(ux*vc-s.sx,uy*vc-s.sy),brake=vc,extra=RET.extra+RET.mar*(turn+brake);return {d,vc,turn,brake,extra,need:turn+brake+extra,ux,uy}}
function budget(s){const m0=dryM(s),dvr=FUEL.ve*Math.log((m0+fuelM(s,s.fuel))/m0),tk=s.probe?tankerFor(s):null;let need,rp=null;
  if(tk){const vr=Math.hypot(s.sx-(tk.sx||0),s.sy-(tk.sy||0)),d=Math.hypot(tk.x-s.x,tk.y-s.y);need=vr+2*Math.min(dvr*.4,Math.sqrt(2*s.acc/1000*d)*.6)}else{rp=retPlan(s);need=rp.need}
  return {dvr,tk,rp,spend:dvr-need,can:s.engN>0}} // резерв «до дома» теперь считается по положению и скорости, а не константой // тратим всё, кроме Δv на остановку и запаса «до дома» (REF.home км/с)
function tankerFor(s){if(s.rf&&s.rf.alive&&s.rf.fuel>s.rf.fuelCap*REF.keep)return s.rf;let b=null,bd=1e9;for(const o of ships){if(!o.alive||o.side!==s.side||!o.tnk||o===s||o.fuel<=o.fuelCap*REF.keep)continue;const d=Math.hypot(o.x-s.x,o.y-s.y);if(d<bd){bd=d;b=o}}if(!b)s.rf=null;return b}
let _sc=[null,null],_scT=-1;function sideC(sd){if(_scT!==t){_scT=t;_sc=[0,1].map(q=>{let x=0,y=0,n=0;for(const o of ships)if(o.alive&&o.side===q&&!o.tnk){x+=o.x;y+=o.y;n++}return n?{x:x/n,y:y/n}:{x:0,y:0}})}return _sc[sd]}
function refuelStep(dt){for(const s of ships){let k=s.rf;if(!k)continue;if(k.alive&&k.fuel<=k.fuelCap*REF.keep){const n=tankerFor(s);if(n&&n!==k){s.rf=k=n}else{s.rf=null;s.rfOn=0;s.rfV=0;continue}} /* танкер пуст — к другому или в бой с тем, что есть */if(!s.alive||!k.alive||s.fuel>=s.fuelCap*REF.full){s.rf=null;s.rfOn=0;s.rfV=0;continue}
  const d=Math.hypot(k.x-s.x,k.y-s.y),dv=Math.hypot((k.sx||0)-(s.sx||0),(k.sy||0)-(s.sy||0));s.rfOn=d<REF.dist+k.T.L&&dv<REF.dv?1:0;
  if(s.rfOn){const amt=Math.min(REF.rate*dt,s.fuelCap-s.fuel,k.fuel-k.fuelCap*REF.keep);if(amt>0){s.fuel+=amt;k.fuel-=amt;stat.refuel=(stat.refuel||0)+amt}}}}
function supplyStep(dt){refuelStep(dt);
  for(const s of ships){if(!s.alive||s.T.role!=='supply'||s.mag<=1||t<(s.shT||0))continue;s.shT=t+4;
    let b=null,bn=0;for(const o of around(s.side,s.x,s.y,160)){if(o===s||!o.alive||o.T.role==='supply'||o.st==='surr'||!o.magMax)continue;const need=Math.max(o.magMax-o.mag-(o.inc||0),o.tur.some(q=>q.k==='M')?1:0);if((o.mag/o.magMax<.5||o.tur.some(q=>q.k==='M'&&q.alive&&q.cfg.fl&&q.ammo<=q.cfg.ammo*.25))&&need>bn){bn=need;b=o}}
    if(!b)continue;const amt=Math.min(SHUT_T,s.mag,bn);s.mag-=amt;b.inc=(b.inc||0)+amt;shuttles.push({from:s,to:b,side:s.side,x:s.x,y:s.y,z:s.z||0,amt,st:0,id:rnd()})}
  for(let i=shuttles.length-1;i>=0;i--){const q=shuttles[i],tg=q.st?q.from:q.to;
    if(!tg.alive){if(q.st||!q.to.alive){shuttles[i]=shuttles[shuttles.length-1];shuttles.pop()}else q.st=1;continue}
    const dx=tg.x-q.x,dy=tg.y-q.y,d=Math.hypot(dx,dy)||1,v=SHUT_SPD*dt;
    if(d<=v+tg.T.L*.3){if(!q.st){q.to.mag=Math.min(q.to.magMax,q.to.mag+q.amt);q.to.inc=Math.max(0,(q.to.inc||0)-q.amt);q.to.dryS=0;q.st=1;{const ms=q.to.tur.filter(m=>m.k==='M'&&m.alive&&m.cfg.fl&&m.ammo<m.cfg.ammo);if(ms.length){const share=q.amt*.4/ms.length;for(const m of ms){m.ammo=Math.min(m.cfg.ammo,m.ammo+Math.max(1,Math.floor(share/(m.cfg.tons||.5))));if(m.cd>20)m.cd=10}}}stat.resup=(stat.resup||0)+q.amt}else{shuttles[i]=shuttles[shuttles.length-1];shuttles.pop()}continue}
    q.x+=dx/d*v;q.y+=dy/d*v;q.z+=((tg.z||0)-q.z)*Math.min(1,dt*2)}
}
// жёсткое расталкивание: корабли никогда не заходят друг в друга (минимальная дистанция — сумма половин длин с запасом)
function separateShips(){
  for(const s of ships){if(!s.alive||s.T.role==='station')continue;const rs=s.T.L*.5;
    for(let sd=0;sd<2;sd++)for(const o of around(sd,s.x,s.y,rs+2.4)){if(o===s||!o.alive||o.id!=null&&0)continue;if(o.T.role==='station'&&s.T.role==='station')continue;
      const dx=s.x-o.x,dy=s.y-o.y,d=Math.hypot(dx,dy)||1e-6,min=(rs+o.T.L*.5)*1.08;if(d>=min||Math.abs((s.z||0)-(o.z||0))>min*.7)continue;
      const k=(min-d)/d,w=o.T.role==='station'?1:s.T.tons/(s.T.tons+o.T.tons+1e-9)>.5?.35:.65; // лёгкий корабль уступает больше
      s.x+=dx*k*(o.T.role==='station'?1:w)*.5;s.y+=dy*k*(o.T.role==='station'?1:w)*.5;if(o.T.role!=='station'&&sd!==s.side){}
      const dvn=((s.sx||0)-(o.sx||0))*dx/d+((s.sy||0)-(o.sy||0))*dy/d;if(dvn<0){s.sx-=dvn*dx/d*.5;s.sy-=dvn*dy/d*.5}}}
}
function step(dt){
  t+=dt;

  const _p0=performance.now();buildGrids();fleetsUpdate();const _p1=performance.now();PERF.fleet+=_p1-_p0;
  if(t>=nextVis){nextVis=t+Math.max(1,ships.length/160);updVis()} // на больших флотах разведка реже
  const _p2=performance.now();PERF.sens+=_p2-_p1;if(t>=nextCrew){const dc=Math.max(.5,t-lastCrewT);lastCrewT=t;nextCrew=t+1;crewStep(dc);kitXfer(dc)}const _p3=performance.now();PERF.crew+=_p3-_p2;
  supplyStep(dt);lasStep(dt);decoyStep();for(let i=flakS.length-1;i>=0;i--){const q=flakS[i];q.x+=q.vx*dt;q.y+=q.vy*dt;if(t>=q.tA){flakS[i]=flakS[flakS.length-1];flakS.pop();flakPop(q)}}
  for(const s of ships.slice()){if(s.alive&&s.bay&&s.bay.length&&t>=s.bayT&&s.st!=='surr'&&(s.tg||t>60))launchBay(s)}
  for(const s of ships){if(!s.alive)continue;steer(s,dt);}
  separateShips();const _p4=performance.now();PERF.steer+=_p4-_p3;
  for(const s of ships){if(!s.alive)continue;
    s.maxR=s.maxR||Math.max(60,...s.tur.filter(m=>m.cfg&&m.cfg.rng&&m.k!=='L'&&m.k!=='M').map(m=>m.cfg.rng));
    let foes=null;const muted=s.st==='surr'||t<s.blk,slow=s.st==='panic'?.5:1;
    for(const m of s.tur){
      if(!m.alive){m.why='уничтожен';continue}if(muted){m.why=s.st==='surr'?'корабль сдался — огонь прекращён':'оглушён попаданием — расчёт приходит в себя';continue}
      if(m.cfg&&m.cfg.ax){let o=s.tg&&s.tg.alive?s.tg:null;const cone=q=>{let r=Math.atan2(q.y-s.y,q.x-s.x)-s.hd;return Math.abs(Math.atan2(Math.sin(r),Math.cos(r)))};if(!o||cone(o)>.2){let b=null,bd=(m.cfg.rng||s.maxR||60);for(const q of around(1-s.side,s.x,s.y,bd)){if(!q.alive||q.st==='surr'||cone(q)>.2)continue;const d=Math.hypot(q.x-s.x,q.y-s.y);if(d<bd){bd=d;b=q}}if(b)o=b} /* своя цель не в конусе — бьём любого врага, что оказался перед носом */if(!o){m.why='осевое: нет цели';continue}m.axO=o;let r=Math.atan2(o.y-s.y,o.x-s.x)-s.hd;r=Math.atan2(Math.sin(r),Math.cos(r));if(Math.abs(r)>.2){m.why='осевое: цель в '+Math.round(Math.abs(r)*57)+'° от носа, ждёт разворота корабля (нужно ±11°)';continue}} // осевое орудие бьёт только в конусе ±~11° перед носом
      if(m.k==='G'){const ef=m.cg?modEff(s,m):1;if(ef<=0){m.why='нет расчёта';continue}{const _g=performance.now();gatStep(s,m,dt*slow*ef);PERF.gat=(PERF.gat||0)+performance.now()-_g}continue}
      if(mis.length&&s.fine&&(m.k==='T'||m.k==='A')&&t>(m.pd||0)){const q=nearMis(s,m.k==='A'?m.cfg.rng:22);
        if(q){m.pd=t+(m.k==='A'?6:12)*R(.8,1.3);m.fa=Math.atan2(q.y-s.y,q.x-s.x);m.rt=performance.now();shots.push({x1:s.x,y1:s.y,x2:q.x,y2:q.y,rt:performance.now(),s:s.side,a:s,b:q});
          if(rnd()<(m.k==='A'?.25:.08))hurtMis(q,1)}}
      if(m.cg&&modEff(s,m)<=0){m.why=s.vac&&s.vac[m.cg.zi]&&m.cg.n>0?'отсек без воздуха':'нет расчёта';continue}if(m.ov&&m.cd>0&&m.cd<1e6)m.cd-=m.ov;m.ov=0;m.cd-=dt*slow*(m.cg?modEff(s,m):1); /* неполный расчёт — медленнее перезарядка */if(m.cd<=0)m.ov=Math.min(-m.cd,dt*slow); /* перезарядка не теряет «хвост» шага: перескок нуля переносится на следующий цикл — темп стрельбы не зависит от шага физики */if(m.cd>0){m.why=m.cd>1e6?(m.am===0?'боезапас орудия исчерпан':'отключено — бой окончен'):(m.cd>200?'заклинило: ремонт ещё ':m.k==='M'?'перезарядка пусковой: ещё ':'зарядка конденсаторов: ещё ')+fmtT(m.cd)+(m.last?' · последний выстрел: '+m.last:'');continue}
      const C=m.cfg;
      // рельсы отбиваются от истребителей и бомбардировщиков рядом (нужен мелкий радар в сети)
      if((m.k==='T'||(m.k==='L'&&!C.dur))&&fly[1-s.side].length){let e=null,bd=Math.min(C.rng,m.k==='L'?150:110)**2;for(const c of fly[1-s.side]){if(c.state!=='fly')continue;const d=(c.x-s.x)**2+(c.y-s.y)**2;if(d<bd){bd=d;e=c}}
        if(e&&(!s.tg||Math.hypot(s.tg.x-s.x,s.tg.y-s.y)>C.rng*.8||rnd()<.4)){m.last=m.why='отбивается от '+(e&&e.T?e.T.n:e&&e.type==='F'?'истребитель':e&&e.type==='B'?'бомбардировщик':'цель')+' в '+Math.sqrt(bd).toFixed(1)+' км';m.fa=Math.atan2(e.y-s.y,e.x-s.x);m.rt=performance.now();SFX.shot('rail');s.flash=t;s.heat+=.002;
          if(m.k==='L')shots.push({x1:s.x,y1:s.y,x2:e.x,y2:e.y,rt:performance.now(),s:s.side,a:s,b:e});stat.pdRail=(stat.pdRail||0)+1;
          const dd=Math.sqrt(bd),pk=(.02+.0015*(m.sk||5))*(1-Math.min(.6,dd/110*.6));if(m.k==='T'){fireAt(s.x,s.y,s.z,s,m,s.side,e,6,pk,3,3000)}if(m.k==='L'){beams.push({a:s,b:e,tx:e.x,ty:e.y,tz:0,rt:performance.now()+600,c0:performance.now(),side:s.side,w:C.dmg});SFX.shot('laser')}if(m.k==='L'&&rnd()<pk*1.5){e.hp-=m.k==='L'?4:3;if(e.hp<=0){killCraft(e,m.k==='L'?'laser':'rail');stat.flakKill[s.side]++}}m.cd=(m.k==='L'?2.5:R(2,4))*(1.3-.06*m.sk);continue}}
      if(m.k==='A'){m.why='ПВО: ждёт ракет или авиации в радиусе '+C.rng+' км';if(s.mag<=0){m.why='нет боеприпасов';m.cd=5;continue}if(flakBurst(s,m)){m.last=m.why='ПВО: снаряд летит к точке разрыва';m.cd=FLAKF.rof*C.rel*(1.3-0.06*m.sk)*R(.9,1.1);s.mag=Math.max(0,s.mag-FLAKF.ammoH/3600*m.cd);addHeat(s,FLAKF.heatMW*m.cd);jamChk(s,m,C)}continue}
      if(m.k==='L'||m.k==='M'){
        if(m.k==='M'&&m.ammo<=0){const mt=C.tons||.5;if(s.mag>=mt){s.mag-=mt;m.ammo=1;m.cd=MIS.relK*Math.pow(mt,MIS.relP);m.why='перезарядка из погреба';continue}m.cd=10;m.why='ракет нет — погреб пуст, ждёт подвоза';continue} // труба пуста: берём ракету из погреба корабля (по тоннажу), иначе ждём снабженца
        const rg=C.rng,isL=m.k==='L',ok=q=>q&&q.alive&&q.st!=='surr'&&(isL?q.seen[s.side]>t-5:q.lock[s.side]>t-5&&s.ch>0)&&Math.hypot(q.x-s.x,q.y-s.y)<rg;
        if(m.k==='L'&&s.ovh){m.cd=6;continue}
        let o=ok(s.F.focus)?s.F.focus:ok(s.tg)?s.tg:null;
        if(!o&&s.tg===null){m.cd=3;continue}
        if(!o){m.cd=m.k==='L'?4:6;continue}
        const d=Math.hypot(o.x-s.x,o.y-s.y);
        m.fa=Math.atan2(o.y-s.y,o.x-s.x)-0;m.rt=performance.now();
        if(m.k==='L'){
          const cost=C.dmg*(.4+(Math.min(d,300)/120)**2);if(C.dur&&d>C.rng){m.cd=3;continue}
          if(C.dur){fireLaser(s,m,o,C);m.cd=Math.max(180,C.E/800)*R(.95,1.05)/s.enR;continue}
          {const lx=o.x-s.x,ly=o.y-s.y,ll=lx*lx+ly*ly||1;let bk=null,bu=2;for(const f of around(s.side,s.x+lx/2,s.y+ly/2,Math.sqrt(ll)/2+3)){if(f===s||!f.alive)continue;const u=((f.x-s.x)*lx+(f.y-s.y)*ly)/ll;if(u<=.02||u>=1)continue;if(Math.hypot(s.x+lx*u-f.x,s.y+ly*u-f.y)<f.T.L*.38&&u<bu){bu=u;bk=f}}
            if(bk){beams.push({a:s,b:bk,tx:bk.x,ty:bk.y,tz:bk.z,rt:m.rt+(C.dur?C.dur*1000:600),c0:m.rt,ld:C.dur?1:0,side:s.side,w:C.dmg});stat.ff=(stat.ff||0)+1;for(let q=0;q<(C.dur||1);q++)if(!C.dur||rnd()<C.ap)hitShip(bk,'laser',lx,ly,bk.x,bk.y,C.dmg*1.7);m.cd=C.dur?Math.max(180,C.E/800)*R(.95,1.05)/s.enR:cost/C.chg*(1.3-.06*m.sk)*R(.9,1.1)*4.5;continue}}
          const be=env.length?los(s.x,s.y,o.x,o.y):null;s.flash=t;addHeat(s,2.3*(C.E||1000));SFX.shot('laser');say(s.side,'laser',s);
          if(be){const dd=Math.hypot(be.x-s.x,be.y-s.y)||1;beams.push({a:s,b:{alive:false},tx:be.x-(be.x-s.x)/dd*be.r,ty:be.y-(be.y-s.y)/dd*be.r,tz:0,rt:m.rt+(C.dur?C.dur*1000:600),c0:m.rt,ld:C.dur?1:0,side:s.side,w:C.dmg});stat.las[s.side]++;fx.push({x:be.x,y:be.y,t0:t,d:4,r:.8})}
          else{beams.push({a:s,b:o,tx:o.x,ty:o.y,tz:o.z,rt:m.rt+(C.dur?C.dur*1000:600),c0:m.rt,ld:C.dur?1:0,side:s.side,w:C.dmg});
          stat.las[s.side]++;stat.lasHit[s.side]++;for(let q=0;q<(C.dur||1);q++)if(!C.dur||rnd()<C.ap)hitShip(o,'laser',o.x-s.x,o.y-s.y,o.x,o.y,C.dmg*1.7)}
          m.cd=C.dur?Math.max(180,C.E/800)*R(.95,1.05)/s.enR:cost/C.chg*(1.3-.06*m.sk)*R(.9,1.1)*4.5;
        }else{
          if(d<18){m.cd=4;m.why='ракеты: цель ближе 18 км — пуск опасен';continue}
          if(!misGate(s.F,o)){m.cd=.5;m.why='ждёт залпа группы: готовы '+Math.round((s.F.mFr||0)*100)+'% труб';continue} // залп всей группой: ракеты приходят десятками и перегружают ПРО
          if(ok(s.F.mTg))o=s.F.mTg;
          const hd=Math.atan2(o.y-s.y,o.x-s.x);
          {const lv=C.sl||null,mx=lv?Math.max(lv.em,lv.ir,lv.ac):3,dumb=!!C.fl&&(C.hm===false||mx===0);let T0=Math.hypot(o.x-s.x,o.y-s.y)/C.spd;for(let k=0;k<3;k++){T0=Math.hypot(o.x+o.sx*T0-s.x,o.y+o.sy*T0-s.y)/C.spd}
          const lh=C.fl?Math.atan2(o.y+o.sy*T0-s.y,o.x+o.sx*T0-s.x):s.hd;
          mis.push({x:s.x,y:s.y,z:s.z,h:lh,dumb:dumb?1:0,sr:C.fl&&lv?[0,25,70,180][mx]*(lv.ac?1.3:1):0,gq:C.fl&&lv?mx/3:null,jf:lv?(lv.em&&!lv.ir&&!lv.ac?1.6:(lv.ir||lv.ac)?.4:1):1,side:s.side,tgt:dumb?null:o,hp:C.hp,spd:C.spd,dmg:C.dmg,blast:C.blast,life:C.fl?Math.min(2400,C.rng/C.spd):C.rng/C.spd*2.2,tr:[],trT:0,vx:s.sx||0,vy:s.sy||0,dv:C.dv||C.spd*MIS.dvK,acc:C.acc||MIS.acc,kg:Math.max(20,(C.tons||.5)*1000),ph:'boost',sub:C.sub||s.spec.misSub||0,sk:skOf(C),lv:Math.max(1,(C.sl&&Math.max(C.sl.ir||0,C.sl.ac||0))||1),bat:C.bat||0,src:s});mis[mis.length-1].dv0=mis[mis.length-1].dv}
s.flash=t;SFX.shot('missile');m.last=m.why='пуск ракеты по '+(o.T?o.T.n:'цели');say(s.side,'missile',s);say(1-s.side,'inmis',o);m.ammo--;stat.mis[s.side]++;m.cd=MIS.relK*Math.pow(Math.max(.001,C.tons||.5),MIS.relP)*R(.85,1.15)*(1.3-.06*m.sk); // перезарядка трубы — от массы ракеты: 10 кг ≈ 1 с, 0,5 т ≈ 20 с, 10 т ≈ 2,5 мин
        }
        continue}
      foes=s.trk||[];
      const VPc=C.vp||VP,fl=C.ax&&m.axO&&m.axO.alive?[m.axO]:(s.tg&&s.tg.alive&&s.tg.st!=='surr'&&Math.hypot(s.tg.x-s.x,s.tg.y-s.y)<effR(s,s.tg,VPc)&&rnd()<.7)?[s.tg]:foes.filter(o=>o.alive&&Math.hypot(o.x-s.x,o.y-s.y)<effR(s,o,VPc)); // дальность = (скорость снаряда + сближение) × 20 с
      {const P0=fl.length?hitP(s,fl[0],VPc,C.sig):0;if(fl.length&&P0<PMc(s,fl[0])){const alt=fl.slice(1).find(o=>hitP(s,o,VPc,C.sig)>=PMc(s,o));if(alt)fl.unshift(alt);else{m.cd=1;m.why='шанс попасть '+Math.round(P0*100)+'% ниже '+Math.round(PMIN*100)+'% — ждёт сближения';continue}}}
      {const sv=s.F&&s.F.sv;m.sv=null;if(sv&&sv.o.alive&&s.tur.indexOf(m)>=0&&Math.hypot(sv.o.x-s.x,sv.o.y-s.y)<effR(s,sv.o,VPc)){const tf=Math.hypot(sv.o.x-s.x,sv.o.y-s.y,(sv.o.z||0)-(s.z||0))/VPc,fireT=sv.tA-tf;
        if(t<fireT-.3){m.cd=Math.min(2,fireT-t);m.why='залп флота: ждёт своей секунды, чтобы снаряды пришли вместе';continue}
        if(t<fireT+3){fl.length=0;fl.push(sv.o);m.sv=sv}}}
      if(!fl.length){m.cd=2;m.why='нет цели в дальности: (скорость снаряда '+VPc+' км/с + сближение) × 20 с';continue}
      if(!bears(s,m,fl[0])){m.cd=.7+rnd();m.why='цель '+(fl[0].T?fl[0].T.n:'цель')+' вне сектора обстрела этого борта';continue} // цель вне полусферы обстрела этой башни
      // не стрелять через своих: если на линии огня союзник — чаще воздерживаемся
      {const o0=fl[0],ux=o0.x-s.x,uy=o0.y-s.y,ul=Math.hypot(ux,uy)||1;let bl=false;
        for(const q of around(s.side,s.x,s.y,14)){if(q===s)continue;const al=((q.x-s.x)*ux+(q.y-s.y)*uy)/ul,pp=Math.abs(((q.x-s.x)*uy-(q.y-s.y)*ux)/ul);if(al>0&&al<ul&&pp<q.T.L*.4+1.5){bl=true;break}}
        if(bl){const S5=stat.fc=stat.fc||{};S5.blk=(S5.blk||0)+1}if(bl&&rnd()<.4){m.cd=2+rnd()*3;m.why='на линии огня свой корабль — пропускает выстрел';continue}}
      if(s.mag<=0){m.cd=20;m.why='нет боеприпасов';if(!s.dryS){s.dryS=1;say(s.side,'dry',s)}continue}
      m.last=m.why='выстрел по '+(fl[0].T?fl[0].T.n:'цель')+' с '+Math.hypot(fl[0].x-s.x,fl[0].y-s.y).toFixed(1)+' км';addHeat(s,(C.heatGJ!=null?C.heatGJ:.15)*1000*C.shells);say(s.side,'fire',s); /* КПД 50%: половина энергии выстрела — в корпус */
      const B=BURST[C.cal]||8;
      for(let b=0;b<C.shells;b++)bursts.push({s,m,o:fl[(rnd()*fl.length)|0],C,n:B,i:0,t0:t+b*.03});
      {const rs=60*C.rel,tn=(C.ammoH||2)*rs/3600*C.shells;m.cd=rs*(1.3-.06*m.sk)*R(.8,1.25)/s.enR;(stat.railT=stat.railT||[0,0])[s.side]+=tn;s.mag=Math.max(0,s.mag-tn)}jamChk(s,m,C);if(--m.am<=0){m.am=0;m.cd=1e9;say(s.side,'dry',s)}
    }
  }
  const _p5=performance.now();PERF.weap+=_p5-_p4;
  // очереди рельсотронов: выстрелы с задержкой 0,1 с
  for(let i=bursts.length-1;i>=0;i--){const q=bursts[i];
    if(!q.s.alive||!q.m.alive){bursts[i]=bursts[bursts.length-1];bursts.pop();continue}
    while(q.i<q.n&&t>=q.t0+.3*q.i){fireShell(q.s,q.m,q.o,q.C,t-(q.t0+.3*q.i));q.i++}
    if(q.i>=q.n){bursts[i]=bursts[bursts.length-1];bursts.pop()}}
  for(let i=proj.length-1;i>=0;i--){
    const p=proj[i];if(p.bt===t)continue; /* снаряд, выпущенный в этот шаг, уже стоит там, где он в момент t (с учётом задержки очереди): лишний сдвиг на целый шаг уводил его на (скорость стрелка × шаг) вбок — точность зависела от шага */const nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;let hit=null,fr=false,eu=0;
    const dx=nx-p.x,dy=ny-p.y,l2=dx*dx+dy*dy||1,x0=Math.floor(Math.min(p.x,nx)/CS)-1,x1=Math.floor(Math.max(p.x,nx)/CS)+1,y0=Math.floor(Math.min(p.y,ny)/CS)-1,y1=Math.floor(Math.max(p.y,ny)/CS)+1;
    const scan=(g,self)=>{let best=null,bu=2;eu=0;
      const chk=(gx,gy)=>{const a=g.get(ckey(gx,gy));if(!a)return;
        for(const o of a){if(!o.alive||o===self||Math.abs(p.z-o.z)>o.T.L*.25+Math.abs((p.vz||0)*dt)+1)continue;// настоящее попадание: отрезок пути снаряда против коробки корабля (длина × ширина) в его системе координат; малые корабли — малые цели
          { const L=o.T.L,hl=L*.5,hw=L*.11,cs=Math.cos(o.hd||0),sn=Math.sin(o.hd||0),osx=(o.sx||0)*dt,osy=(o.sy||0)*dt,ax=p.x-(o.x-osx),ay=p.y-(o.y-osy),rdx=dx-osx,rdy=dy-osy,x1=ax*cs+ay*sn,y1=-ax*sn+ay*cs,ddx=rdx*cs+rdy*sn,ddy=-rdx*sn+rdy*cs; /* отрезок снаряда в системе корабля за этот шаг (корабль уже сдвинут): при любом шаге проверяется одна и та же относительная траектория */
            let t0=0,t1=1;const slab=(a,d,h)=>{if(Math.abs(d)<1e-12)return a>=-h&&a<=h;let ta=(-h-a)/d,tb=(h-a)/d;if(ta>tb){const q=ta;ta=tb;tb=q}if(ta>t0)t0=ta;if(tb<t1)t1=tb;return t0<=t1};
            if(slab(x1,ddx,hl)&&slab(y1,ddy,hw)&&slab(p.z-(o.z||0),(p.vz||0)*dt,hw)&&t0<bu){bu=t0;best=o;eu=t0} } }};
      const nxc=x1-x0+1,nyc=y1-y0+1;
      if(nxc*nyc<=40){for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++)chk(gx,gy)}
      else if(nxc>=nyc){const lo=Math.min(p.x,nx),hi=Math.max(p.x,nx); // быстрый снаряд: идём по клеткам вдоль отрезка, а не по всему прямоугольнику
        for(let gx=x0+1;gx<=x1-1;gx++){const xa=Math.max(lo,gx*CS),xb=Math.min(hi,(gx+1)*CS);if(xb<xa)continue;const ya=p.y+dy*((xa-p.x)/(dx||1e-9)),yb=p.y+dy*((xb-p.x)/(dx||1e-9));const g0=Math.floor(Math.min(ya,yb)/CS)-1,g1=Math.floor(Math.max(ya,yb)/CS)+1;for(let gy=g0;gy<=g1;gy++)chk(gx,gy)}}
      else{const lo=Math.min(p.y,ny),hi=Math.max(p.y,ny);
        for(let gy=y0+1;gy<=y1-1;gy++){const ya=Math.max(lo,gy*CS),yb=Math.min(hi,(gy+1)*CS);if(yb<ya)continue;const xa=p.x+dx*((ya-p.y)/(dy||1e-9)),xb=p.x+dx*((yb-p.y)/(dy||1e-9));const g0=Math.floor(Math.min(xa,xb)/CS)-1,g1=Math.floor(Math.max(xa,xb)/CS)+1;for(let gx=g0;gx<=g1;gx++)chk(gx,gy)}}
      return best};
    if(env.length){let ee=null;for(const e of env)if(Math.abs(e.x-p.x)<e.r+14&&Math.abs(e.y-p.y)<e.r+14&&segHit(p.x,p.y,nx,ny,e)){ee=e;break}
      if(ee){endTr(p,nx,ny);if(ee.t==='wreck'){const mw=ee.m||500,mp=p.kk?RAIL_M(p.cal||10):GATP.m;ee.vx+=p.vx*mp/(mw*1000);ee.vy+=p.vy*mp/(mw*1000);ee.hitN=(ee.hitN||0)+1} /* обломок получает импульс снаряда: p·v/m — толкает по физике */fx.push({x:nx,y:ny,z:p.z,t0:t,d:3,r:.6});if(ee.t==='debris')ee.ttl-=4;if(rnd()<.02)say(p.side,'rock',p.src);proj[i]=proj[proj.length-1];proj.pop();continue}}
    if(p.cd&&fly[1-p.side].length){let hc=null,bu=2;const mnx=Math.min(p.x,nx)-.12,mxx=Math.max(p.x,nx)+.12,mny=Math.min(p.y,ny)-.12,mxy=Math.max(p.y,ny)+.12;
      for(const c of fly[1-p.side]){if(c.state!=='fly'||c.x<mnx||c.x>mxx||c.y<mny||c.y>mxy)continue;let u=((c.x-p.x)*dx+(c.y-p.y)*dy)/l2;u=Math.max(0,Math.min(1,u));if(Math.hypot(p.x+dx*u-c.x,p.y+dy*u-c.y)<.04&&u<bu){bu=u;hc=c}}
      if(hc){endTr(p,hc.x,hc.y);hc.hp-=p.cd;fx.push({x:hc.x,y:hc.y,t0:t,d:3,r:0.5});if(hc.hp<=0){killCraft(hc,'rail');stat.flakKill[p.side]++}proj[i]=proj[proj.length-1];proj.pop();continue}}
    hit=scan(GR[1-p.side],null);if(!hit&&p.src&&p.src.T&&p.dist>p.src.T.L*.6){hit=scan(GR[p.side],p.src);fr=!!hit}
    if(hit){endTr(p,hit.x,hit.y);if(fr)stat.ff=(stat.ff||0)+1;else if(p.kk)stat.hits[p.side]++; /* попадания считаем только у рельсов — выстрелы тоже только их */{const iu=eu,ix=p.x+dx*iu,iy=p.y+dy*iu,gt=p.g||(p.m&&p.m.k==='G');hitShip(hit,p.k||'rail',p.vx,p.vy,ix,iy,gt?0:p.dmg,gt?0:p.ap,p.z+(p.vz||0)*dt*iu,p.vz||0,gt,p)}proj[i]=proj[proj.length-1];proj.pop();continue}
    p.x=nx;p.y=ny;p.z+=p.vz*dt;p.dist+=Math.hypot(p.vx,p.vy)*dt;
    if(p.dist>=p.max){endTr(p,p.x,p.y);proj[i]=proj[proj.length-1];proj.pop()}
  }
  const _p6=performance.now();PERF.proj+=_p6-_p5;
  // ракеты
  pdStep();for(let i=mis.length-1;i>=0;i--){
    const p=mis[i];let tg=p.tgt;
    if(p.dumb){if(!p.vi){p.vi=1;if(MIS.inh){p.vx=(p.vx||0)+Math.cos(p.h)*p.spd;p.vy=(p.vy||0)+Math.sin(p.h)*p.spd}else{p.vx=Math.cos(p.h)*p.spd;p.vy=Math.sin(p.h)*p.spd}} /* неуправляемая: стартовый импульс складывается со скоростью носителя, дальше — только инерция */p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.trT-=dt;if(p.trT<=0){p.trT=.6;p.tr.push(p.x,p.y,p.z);if(p.tr.length>12)p.tr.splice(0,3)}
      let hitS=null;for(const o of around(1-p.side,p.x,p.y,12)){if(o.alive&&Math.hypot(o.x-p.x,o.y-p.y)<Math.max(.3,o.T.L*.5)+p.blast*.15){hitS=o;break}}
      if(hitS){misHit(p,hitS);mis.splice(i,1);continue}
      if(p.life<=0){p.end='end';fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:3,r:.8,mk:'end'});mis.splice(i,1)}continue}
    if(tg&&!tg.alive){tg=p.tgt=null;p.rl=t+2.5}
    if(!tg){ // цель потеряна: летит прямо, медленно ищет новую впереди (узкий конус), топливо тает
      if(t>=(p.rl||0)){let b=null,bd=1e9;for(const o of around(1-p.side,p.x,p.y,90)){const a=Math.abs(adiff(p.h,Math.atan2(o.y-p.y,o.x-p.x)));if(a>1.1)continue;const dd=Math.hypot(o.x-p.x,o.y-p.y)*(1+a);if(dd<bd){bd=dd;b=o}}
        if(b){tg=p.tgt=b;p.pd=null}else p.rl=t+1.5}
      if(!tg){p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.trT-=dt;if(p.trT<=0){p.trT=.6;p.tr.push(p.x,p.y,p.z);if(p.tr.length>12)p.tr.splice(0,3)}
        if(p.life<=0){p.end='end';fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:3,r:.8,mk:'end'});mis.splice(i,1)}continue}}
    const d=Math.hypot(tg.x-p.x,tg.y-p.y);
    if(p.pd!=null&&d>p.pd&&p.pd<25){p.tgt=null;p.rl=t+3;p.pd=null;continue} // проскочила мимо
    p.pd=d;
    if(p.sub>1&&d<MIS.subD){splitMis(p);continue} // кассета раскрывается за subD км до цели
    if(d<45&&tg.jam>0&&t>=(p.blind||0)&&rnd()<tg.jam*dt*.3*(p.jf||1)){p.blind=t+4;stat.decoy++;fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:3,r:1});say(tg.side,'jam',tg)}
    {const sk=t>=(p.blind||0)&&(!p.sr||d<p.sr)&&seekOk(p,tg,d,dt);if(sk||!MIS.mc){p.mc=0;misFly(p,tg,dt,sk)}else{const r=trackOf(p.side,tg);if(r&&t-r.t<TRK.ttl){const T2=t-r.t;p.mc=1;misFly(p,{x:r.x+r.sx*T2,y:r.y+r.sy*T2,sx:r.sx,sy:r.sy},dt,true)}else{p.mc=0;misFly(p,tg,dt,false)}}} /* вне дальности своей головки ракета летит по данным сопровождения носителя/флота (командное наведение по радиоканалу), как настоящие ракеты на маршевом участке; нет сопровождения — по инерции */ // настоящая физика: скорость, ускорение, остаток Δv
    p.z+=Math.max(-p.spd*.4*dt,Math.min(p.spd*.4*dt,tg.z-p.z));
    if(env.length&&los(p.x-p.vx*dt,p.y-p.vy*dt,p.x,p.y)){p.end='rock';fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:4,r:1.5,mk:'hit'});mis.splice(i,1);continue}
    p.life-=dt;p.trT-=dt;if(p.trT<=0){p.trT=.6;p.tr.push(p.x,p.y,p.z);if(p.tr.length>12)p.tr.splice(0,3)}
    {const hr=Math.max(.05,tg.T.L*.5),rx=tg.x-p.x,ry=tg.y-p.y,rvx=(tg.sx||0)-p.vx,rvy=(tg.sy||0)-p.vy,vv=rvx*rvx+rvy*rvy,tc=vv>1e-9?Math.max(0,Math.min(dt,-(rx*rvx+ry*rvy)/vv)):0,mx=rx+rvx*tc,my=ry+rvy*tc; /* ближайшее сближение за шаг: на 15 км/с ракета проходит десятки км за тик */
      if(Math.hypot(mx,my)<hr+(p.w==='k'?0:p.blast*.05)){p.x+=p.vx*tc;p.y+=p.vy*tc;misHit(p,tg);mis.splice(i,1);continue}}
    if(p.life<=0){p.end='end';fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:3,r:.6,mk:'end'});mis.splice(i,1)}
  }
  for(let i=frags.length-1;i>=0;i--){const f=frags[i];if(t-f.t0>f.d){frags[i]=frags[frags.length-1];frags.pop();continue}f.x+=f.vx*dt;f.y+=f.vy*dt;if(f.vz)f.z+=f.vz*dt;if(f.plate){f.rx+=f.vrx*dt;f.ry+=f.vry*dt}f.rot+=f.vr*dt;if(f.ln)f.vx*=1-.4*dt,f.vy*=1-.4*dt}
  const _p7=performance.now();PERF.mis+=_p7-_p6;podStep(dt);
  for(let i=pyro.length-1;i>=0;i--){const q=pyro[i];if(t<q.next)continue;q.next=t+R(.25,.7);q.n--;
    const ox=q.x+q.vx*(t-q.t0),oy=q.y+q.vy*(t-q.t0),off=R(-.5,.5)*q.L,px=ox+Math.cos(q.hd)*off,py=oy+Math.sin(q.hd)*off;
    fx.push({x:px,y:py,z:q.z,t0:t,d:4,r:q.L*R(1.4,3)});spawnShards(px,py,q.z,6,R(5,10));if(rnd()<.5)spawnFrags(px,py,q.z,2,3,q.L,null);SFX.boom(8);
    // в вакууме взрыв обломка не бьёт соседей: ударной волны нет, разлёт — картинка
    if(q.n<=0){pyro.splice(i,1)}}
  stepFlights();assign();
  const n=Math.min(12,Math.max(1,Math.ceil(dt/SUB))),d=dt/n;
  for(let k=0;k<n;k++)for(const c of air)if(c.state==='fly')craftStep(c,d);
  for(let i=torps.length-1;i>=0;i--){
    const p=torps[i];let tg=p.tgt;
    if(!tg||!tg.alive){const nn=nearestShip(p.x,p.y,1-p.side);tg=p.tgt=nn&&nn.s}
    if(!tg){torps.splice(i,1);continue}
    const dx=tg.x-p.x,dy=tg.y-p.y,dl=Math.hypot(dx,dy)||1e-6,m=Math.min(TORP.sp*dt,dl);p.x+=dx/dl*m;p.y+=dy/dl*m;p.vx=dx/dl*TORP.sp;p.vy=dy/dl*TORP.sp;
    if(Math.hypot(tg.x-p.x,tg.y-p.y)<tg.T.L/2+1.5){stat.torpHit[p.side]++;hitShip(tg,'torp',dx,dy,p.x,p.y,1);torps.splice(i,1);continue}
    let shot=false;
    for(const o of ships){if(!o.alive||o.side===p.side)continue;
      if(Math.hypot(o.x-p.x,o.y-p.y)<TORP.pdr&&rnd()<TORP.pd*dt){shot=true;break}}
    if(shot){stat.torpPd[p.side]++;fx.push({x:p.x,y:p.y,t0:t,d:10,r:4});torps.splice(i,1)}
  }
  smokeStep(dt);
  fx=fx.filter(f=>t-f.t0<f.d);{const _p8=performance.now();PERF.rest+=_p8-_p7;PERF.steps++;PERF.step+=_p8-_p0;PERF.ring[PERF.ri++%PERF.ring.length]=_p8-_p0;PERF.max=Math.max(PERF.max,_p8-_p0)}
}
let smoke=[];
const WR={cv:.38,hc:.32,fr:.3,dd:.24};
// сигнатуры: тепловая (двигатели, форсаж, перегрев, залпы) и электромагнитная (радар, залпы)
// тепловая сигнатура, «МВт излучения»: двигатели (по тяге), нагретый корпус, открытые радиаторы, облако пара, вспышки выстрелов
function irW(o){const tons=Math.max(1,o.T.tons),L2=o.T.L*o.T.L;return HEAT.base*(.3+L2)+(o.thrW||0)*tons*HEAT.irEng+Math.max(0,o.heat)*tons*HEAT.irHull+(o.radOut?(o.spec.sinkMW||6)*HEAT.irRad:0)+(t-(o.vapT||-99)<5?HEAT.irVap:0)+(t-o.flash<3?HEAT.irShot:0)}
function sigOf(o){const L2=o.T.L*o.T.L,sh=t-o.flash<8?1:0;
  const h=irW(o)/HEAT.irN,e=.3+L2*.3+(o.rdOn?3+L2*5:0)+sh*.5;
  const sk=o.side===0?tm('stealth'):1;return [Math.max(.1,h*sk),Math.max(.05,e*sk)]}
// работающие сканеры: чем сильнее повреждён корабль, тем меньше их живо
function scAlive(s){const hp=hpf(s);if(hp<.3)return[];let sc=s.sc;if(s.rad0&&s.radN<=0)sc=sc.filter(q=>q.k!=='rad');const n=Math.ceil(sc.length*Math.min(1,hp/.7));return sc.slice(0,n)}
function updVis(){
  const SB=[[],[]],rr=tm('radarR');for(const o of ships)if(o.alive){SB[o.side].push(o);o._sg=sigOf(o)}
  for(const o of ships){if(!o.alive)continue;let j=0;for(const q of around(o.side,o.x,o.y,30))j+=q.spec.ew!=null?.04*Math.min(5,q.spec.ew):(EW[q.cls]||0);o.jam=Math.min(.6,j)}
  const mode=ORD.sens||'auto';
  for(const s of ships){if(!s.alive)continue;s.rdOn=false;s.fine=false;s.scl=scAlive(s)}
  // ИИ радара: включает при контакте с врагом рядом, молчит в режиме «тишина»
  for(const s of ships){if(!s.alive||s.st==='surr')continue;const rd=s.scl.filter(q=>q.k==='rad');if(!rd.length)continue;
    const m=s.side===0?mode:'auto';if(m==='silent'||m==='pass')continue;
    if(s.spec.reserve&&ships.some(q=>q.alive&&q.side===s.side&&!q.spec.reserve&&q.sc.some(z=>z.k==='rad')&&hpf(q)>=.3))continue;
    let on=m==='active';
    if(!on){const R2=Math.max(2.2*(s.maxR||60),160),R22=R2*R2;for(const o of SB[1-s.side]){const ddx=o.x-s.x,ddy=o.y-s.y;if(ddx*ddx+ddy*ddy<=R22&&o.seen[s.side]>t-8){on=true;break}}}
    if(on){s.rdOn=true;s.fine=rd.some(q=>q.fine)}}
  for(const s of ships){if(!s.alive||!s.rdOn||!s.fine)continue;for(const q of around(s.side,s.x,s.y,45))q.fine=true}
  for(const s of ships){if(!s.alive||t<s.blk)continue;
    let mx=1;for(const q of s.scl)mx=Math.max(mx,q.k==='rad'?(s.rdOn?q.rng:0):q.rng*2);
    const R6=mx*1.6,R62=R6*R6;for(const o of SB[1-s.side]){const ddx=o.x-s.x,ddy=o.y-s.y;if(ddx*ddx+ddy*ddy>R62)continue;const d=Math.hypot(ddx,ddy);
      if(d<1){o.lock[s.side]=t;o.seen[s.side]=t;continue}
      const sg=o._sg,small=o.T.tons<300; /* «мелкая цель» (нужен точный радар) — только меньше 300 т */let det=false,lk=false;
      for(const q of s.scl){
        if(q.k==='rad'){if(!s.rdOn)continue;const er=q.rng*(s.side===0?rr:1)*Math.sqrt(1+o.T.L)*(1-o.jam)*(s.rad0?.55+.45*s.radN/s.rad0:1)*(s.cg?.3+.7*sysEff(s,'D'):1);if(d<er){det=true;if(q.fine||!small)lk=true}}
        else{const er=q.rng*(s.side===0?rr:1)*Math.sqrt(q.k==='ir'?sg[0]:sg[1])*(small&&q.res<.66?.25:1)*(s.cg?.3+.7*sysEff(s,'D'):1); /* сенсорный отсек выбит или без операторов — видит хуже */if(d<er)det=true}}
      if(det){if(o.seen[s.side]<0)say(s.side,'contact',s);o.seen[s.side]=t}
      if(lk){o.lock[s.side]=t;(o.byL||(o.byL=new Map())).set(s,t)}}}
  for(const o of ships)if(o.alive){o.rl=[o.lock[0],o.lock[1]];o.rs=[o.seen[0],o.seen[1]]} // настоящее сопровождение (до упрощения ниже): от него зависит точность — tq()
  for(const sd of [0,1])if(SB[sd].length)for(const o of SB[1-sd]){o.lock[sd]=t;o.seen[sd]=t} // радары пока не нужны: на дистанциях боя все видят всех
  for(const c of air){if(c.state!=='fly')continue;for(const o of around(1-c.side,c.x,c.y,70)){o.seen[c.side]=t;o.lock[c.side]=t}}
}
function crewStep(dc){
  env=env.filter(e=>e.ttl>t);for(const e of env)if(e.vx||e.vy){e.x+=e.vx*dc;e.y+=e.vy*dc}
  for(const s of ships){if(!s.alive)continue;const sk=s.spec.sk||5.5,hp=hpf(s);
    // тепло
    { const sp=s.spec,idle=sp.idleMW!=null&&sp.real?sp.idleMW:6,sink=sp.sinkMW!=null&&sp.real?sp.sinkMW:idle*1.6; // электроника и экипаж греют корпус
      // двигатели: доля тяги уходит в корпус — тепло = масса × Δv главного двигателя × engK (МДж)
      const tons=Math.max(1,s.T.tons);addHeat(s,tons*(s.dvH||0)*HEAT.engK);s.thrW=(s.dvH||0)/Math.max(dc,1e-3);s.dvH=0;
      // радиаторы: в бою убраны (хрупкие), корпус отдаёт только hull от мощности радиаторов; открыты — вне огня или когда корабль уходит остывать
      if(s.water==null){s.water=s.water0=s.spec.water||0} // вода — только из модуля «Испаритель»
      const near=nearestShip(s.x,s.y,1-s.side),danger=near&&near.d<Math.max(60,(s.maxR||60))*HEAT.safe;s.radOut=!danger||s.cool?1:0;
      const out=(s.heat>0?sink*(.5+.5*hp)*(s.side===0?1+ta('dcx'):1):Math.min(sink,idle))*(s.radOut?1:HEAT.hull);addHeat(s,(idle-out)*dc);addHeat(s,-Math.max(0,s.heat)*Math.pow(tons,2/3)*HEAT.pas*dc); // корпус сам излучает: ∝ площади и нагреву (даже без радиаторов)
      // испаритель: выше evapAt сбрасываем пар — 2,5 ГДж на тонну воды, за секунду не больше evapR т; облако пара ярко светит в ИК
      if(s.heat>HEAT.evapAt&&s.water>0){const need=(s.heat-HEAT.evapAt)*100*.5*tons,w=Math.min(s.water,HEAT.evapR*dc,need/2500);s.water-=w;addHeat(s,-w*2500);if(t-(s.vapT||-99)>2)fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:5,r:Math.max(.5,s.T.L*2)});s.vapT=t;stat.water=(stat.water||0)+w}
      // вода почти кончилась и корпус горячий — выходим из боя остывать на радиаторах; вернуться, когда остыли
      if(!s.cool&&s.water<s.water0*HEAT.low&&s.heat>HEAT.hot){s.cool=1;stat.coolOut=(stat.coolOut||0)+1;say(s.side,'heat',s)}else if(s.cool&&s.heat<HEAT.ok)s.cool=0;
      if(s.magEjT&&t>=s.magEjT){s.magEjT=0;s.mag=0;say(s.side,'mod',s)} } // погреб отстрелен
    if(s.heat>1&&!s.ovh){s.ovh=1;stat.ovh++;say(s.side,'heat',s)}else if(s.ovh&&s.heat<.55)s.ovh=0;
    if(s.heat>1.4&&rnd()<.03*dc){const al=s.tur.filter(m=>m.alive);if(al.length){const m=al[(rnd()*al.length)|0];m.alive=false;s.aliveN--;fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:6,r:1.5});s.heat=1}}
    // боезапас орудий: без снарядов корабль уходит из боя
    {let am=0,cp=0,oth=0;for(const m of s.tur){if(!m.alive)continue;if(m.k==='T'){am+=m.am;cp+=70}else if(m.k==='L'||(m.k==='M'&&m.ammo>0))oth++}
     s.ammoF=cp?am/cp:1;s.dry=cp>0&&am<=cp*.06&&!oth&&!s.car}
    if(s.flee&&!s.T.role&&s.st!=='surr'&&t>(s.fleeT0=s.fleeT0||t)+20){const nn=nearestShip(s.x,s.y,1-s.side);if(PLN.rtr?(s.rst==='home'&&!RET.stay&&t-s.rsT>=RT.exit&&(!nn||nn.d>(nn.s.maxR||60)*2)||s.rst==='regroup'&&t-s.rsT>=RT.exit&&(!nn||nn.d>(nn.s.maxR||60)*2)&&!ships.some(o=>o.alive&&o.side===s.side&&o!==s&&!o.flee&&!o.T.role)):(!nn||nn.d>600)){ /* выход из боя: вне двойной досягаемости врага, перегруппировка exit с и некого прикрывать (все свои отходят или погибли) */s.esc=1;s.alive=false;stat.esc=stat.esc||[0,0];stat.esc[s.side]++;fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:6,r:2});continue}}else if(!s.flee)s.fleeT0=0;
    // пожары и аварийная команда
    const dcp=.05*(.4+.6*s.crew)*sk/6*(s.spec.dcon!=null?.4+.9*Math.min(4,s.spec.dcon):1)*(s.side===0?1+ta('dcx'):1);
    for(let zi=0;zi<4;zi++){if(s.vac&&s.vac[zi]&&s.fire[zi]){s.fire[zi]=0;continue} /* вакуум: гореть нечему */const f=s.fire[zi];if(!f)continue;
      if(s.cg){crewKill(s,zi,DCN.fireKill*f*dc,'пожар');if(f>=2&&rnd()<.015*f*dc){const z2=(zi+(rnd()<.5?1:3))%4;if(!s.vac[z2]&&s.fire[z2]<3){s.fire[z2]++;stat.crw.fire++}}
        const A=zoneAmmo(s,zi);if(A.x>0&&rnd()<.002*f*dc*(1-Math.exp(-A.x/MAG.x0)))detonate(s,zi,0,'пожар у погреба');if(!s.alive)break}
      if(rnd()<.5*f*dc/12){const al=s.zones[zi].mods.filter(m=>m.alive&&m.k!=='C');if(al.length){const m=al[(rnd()*al.length)|0];mdead(s,m);fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:5,r:1.6});if(stat.crw)stat.crw.fireMods=(stat.crw.fireMods||0)+1}}
      hullHit(s,zi,HST.fire*f*dc,'пожар');if(s.alive&&!s.cg&&rnd()<dcp*dc)s.fire[zi]--}
    if(!s.alive)continue;
    if(s.cg){damageControl(s,dc);const cs=shipState(s);if(cs!==s.cst){s.cst=cs;s.cstT=t;if((cs==='остов'||cs==='выведен из строя'||cs==='потерял вооружение'||cs==='потерял экипаж')&&s.ooaT==null){s.ooaT=t;stat.crw.ooa.push({n:s.T.n,side:s.side,t:Math.round(t),state:cs,why:s.csWhy,crew:s.crN+'/'+s.pers0,hp:+hpf(s).toFixed(2)})}}
      if(cs==='остов'&&!s.derelict){s.derelict=1;s.st='surr';s.abd=1;s.tg=null;s.task=null;stat.crw.derelict.push({n:s.T.n,side:s.side,t:Math.round(t),hp:+hpf(s).toFixed(2)});say(s.side,'mod',s)}
      for(let zi=0;zi<4;zi++)if(s.fire[zi]&&rnd()<.25*dc)fx.push({x:s.x+R(-.3,.3)*s.T.L,y:s.y+R(-.3,.3)*s.T.L,z:s.z,t0:t,d:4,r:.8+s.fire[zi]*.4,big:1,smoke:1})} // дым пожаров
    // ремонт модулей, когда не под огнём
    if(!s.cg&&t-s.hitT>10&&s.crew>.15&&s.st!=='surr'&&t>=s.blk&&s.reps<s.total*.6&&!s.derelict&&rnd()<.03*dc*(.5+sk/10)*s.crew){
      let pick=null;for(const k of ['E','R','T','A','L','M','D'])for(const z of s.zones)for(const m of z.mods)if(!pick&&!m.alive&&m.k===k)pick=m;
      if(pick){mrev(s,pick);s.reps++;stat.rep++;say(s.side,'dmg',s)}}
    // мораль
    let dm=.004*(.5+sk/10)*dc*(t-s.hitT>6?1:.3);
    if(s.F&&s.F.ratio!=null&&s.F.ratio<.7)dm-=.007*(.7-s.F.ratio)*dc;
    if(s.crew<.25)dm-=.003*dc;
    s.mor=Math.max(0,Math.min(1,s.mor+dm));
    if(false&&s.st==='ok'&&s.mor<.3&&!s.T.role){s.st='panic'; /* паника и сдача отключены */say(s.side,'flee',s)}
    else if(s.st==='panic'&&s.mor>.5)s.st='ok';
    if(false&&(s.st==='panic'||s.st==='ok')&&s.mor<.12&&hp<.6&&!s.T.role&&rnd()<.2*dc){s.st='surr';stat.surr[s.side]++;say(s.side,'surr',s)}
    // эвакуация экипажа: корабль гибнет, горит или остался без жизни
    {const hz=s.hullF??s.aliveN/s.total,fs=s.fire[0]+s.fire[1]+s.fire[2]+s.fire[3];
     if(!s.evac&&s.crew>.1&&(hz<.34||fs>=9)&&rnd()<(.5+.5*(1-s.mor))*dc*.35){s.evac=t;s.abd=1;s.st='surr';s.tg=null;stat.abd=(stat.abd||0)+1;say(s.side,'evac',s)}
     if(s.evac&&s.crew>.01)launchPods(s,.22)}
    // десант: шлюпки с морпехами
    if(s.mar>=3&&s.st==='ok'&&t>=s.blk&&t>=s.ldT&&t>=(s.ldC||0)){
      s.ldC=t+R(3,6);let b=null,bd=110;for(const o of around(1-s.side,s.x,s.y,110)){if(o.st==='surr'||o.abd||t<o.blk||o.engN===0||hpf(o)<.55){const d=Math.hypot(o.x-s.x,o.y-s.y);if(d<bd){bd=d;b=o}}}
      if(b){const n=Math.min(s.mar,Math.max(3,Math.ceil(s.mar*.5))),nb=Math.max(1,Math.min(6,Math.round(n/4)));s.mar-=n;s.ldT=t+30;say(s.side,'board',s);
        for(let i=0;i<nb;i++)lands.push({x:s.x,y:s.y,z:s.z,vx:s.sx,vy:s.sy,n:n/nb,side:s.side,fid:s.fid,sk:(s.spec.sk||5)/10,cr:s.crew,tg:b,t0:t,ph:rnd()*6});
        stat.land=(stat.land||0)+nb}}
  }
}
function resolveBoard(l){const o=l.tg;if(!o||!o.alive)return;
  if(o.side===l.side){o.mar+=l.n;return}
  const att=l.n*(.6+l.sk)*(.4+.6*l.cr),def=(o.st==='surr'?1.5:o.T.role?3:6+o.T.L*10)*(.3+o.crew)*(.4+.6*o.mor)*(o.abd?.4:1);
  fx.push({x:o.x,y:o.y,z:o.z,t0:t,d:4,r:o.T.L*.5});
  if(rnd()<att/(att+def)){
    o.prizeFrom=o.side;o.side=l.side;o.fid=l.fid;o.st='ok';o.mor=.5;if(o.cg){crewScale(o,.5);for(const q of o.cg)if(q.n<1&&q.n0>0)q.n=1;crewSync(o)}else o.crew=Math.max(.2,o.crew*.5);o.evac=0;o.abd=0;o.prize=1;o.tg=null;o.nt=0;o.mar=Math.floor(l.n*.5);o.blk=0;o.seen=[t,t];o.lock=[t,t];
    for(const c of air)if(c.home===o&&c.state!=='dead')killCraft(c,'captured');
    stat.cap[l.side]++;say(l.side,'prize',o)}
  else{stat.bfail[l.side]++;o.mor=Math.max(0,o.mor-.03)}
}
function smokeStep(dt){
  if(smoke.length>700)smoke=smoke.slice(-500);
  smoke=smoke.filter(q=>t-q.t0<q.d);
  for(const s of ships){
    const dead=s.total-s.aliveN;if(dead<=0&&s.alive)continue;
    const rate=s.alive?Math.min(6,dead*.5):4;let n=Math.min(6,Math.floor(rate*dt+rnd()));
    const ms=[];for(const z of s.zones)for(const m of z.mods)if(!m.alive)ms.push(m);
    while(n-->0){const m=ms.length?ms[(rnd()*ms.length)|0]:{u:0,v:0},c=Math.cos(s.hd),sn=Math.sin(s.hd),L=s.T.L,lu=m.u*L,lv=m.v*L*(WR[s.cls]||.3)*1.4;
      smoke.push({z:s.z,x:s.x+lu*c-lv*sn,y:s.y+lu*sn+lv*c,vx:R(-.15,.15)*L,vy:R(-.15,.15)*L,t0:t,d:R(8,18)*(s.alive?1:1.8),r0:L*.025,L,fire:rnd()<(s.alive?.35:.55)})}
  }
}
const C=['#4fc3ff','#ff8a4f'],CL=['#c6ecff','#ffd5bd'],CD=['#1d4f73','#7a3b1a'];
const HULL=[[-.5,-.28],[-.38,-.5],[.2,-.5],[.5,-.14],[.5,.14],[.2,.5],[-.38,.5],[-.5,.28]];
const HULLV=[HULL,
  [[-.5,-.3],[-.45,-.5],[.1,-.38],[.5,0],[.1,.38],[-.45,.5],[-.5,.3]],
  [[-.5,-.2],[-.35,-.5],[-.1,-.5],[0,-.2],[.5,-.1],[.5,.1],[0,.2],[-.1,.5],[-.35,.5],[-.5,.2]],
  [[-.5,-.35],[.3,-.35],[.5,-.15],[.5,.15],[.3,.35],[-.5,.35]],
  [[-.5,-.15],[-.2,-.4],[.2,-.4],[.5,-.08],[.5,.08],[.2,.4],[-.2,.4],[-.5,.15]]];
const hullOf=s=>HULLV[s.hv||0];
function drawShip(g,s,x,y,k,dp){
  const HL=hullOf(s),len=Math.min(Math.max(3*dp,4*dp*Math.sqrt(s.T.L),s.T.L*k*1.8),150*dp),wid=len*(WR[s.cls]||.3)*2,r=len/2,now=performance.now();
  if(x<-len||x>W+len||y<-len||y>H+len)return;
  if(len<14*dp&&s.alive&&s!==sel){const q=Math.max(5*dp,len*.62),c2=Math.cos(s.hd),s2=Math.sin(s.hd);g.save();g.translate(x,y);g.scale(1,curCT);
    g.globalAlpha=.28;g.fillStyle=CL[s.side];g.beginPath();g.arc(0,0,q*1.35,0,6.283);g.fill();g.globalAlpha=1;
    g.rotate(s.hd);g.beginPath();g.moveTo(q,0);g.lineTo(-q*.7,-q*.55);g.lineTo(-q*.35,0);g.lineTo(-q*.7,q*.55);g.closePath();g.fillStyle=C[s.side];g.fill();g.strokeStyle=CL[s.side];g.lineWidth=Math.max(1,dp*.9);g.stroke();
    if(s.cls==='hc'||s.cls==='cv'){g.beginPath();g.arc(0,0,q*1.05,0,6.283);g.stroke()}g.restore();return}
  if(s===sel){g.strokeStyle='#fff';g.lineWidth=dp;g.beginPath();g.arc(x,y,r+6*dp,0,6.283);g.stroke()}
  if(curST>.05&&len>=14*dp&&s.alive){const dep=wid*.2*curST,nL=Math.min(16,Math.max(3,Math.ceil(dep/(.8*dp))));
    for(let i=nL;i>=1;i--){g.save();g.translate(x,y+dep*i/nL);g.scale(1,curCT);g.rotate(s.hd);g.beginPath();HL.forEach(([a,b],j)=>j?g.lineTo(a*len,b*wid*.5):g.moveTo(a*len,b*wid*.5));g.closePath();
      g.fillStyle=i>nL*.75?'#0a0d13':CD[s.side];g.fill();g.restore()}}
  g.save();g.translate(x,y);g.scale(1,curCT);g.rotate(s.hd);
  const hull=()=>{g.beginPath();HL.forEach(([a,b],i)=>i?g.lineTo(a*len,b*wid*.5):g.moveTo(a*len,b*wid*.5));g.closePath()};
  const det=len>=26*dp;
  if(!s.alive){hull();g.fillStyle='#262c36';g.fill();g.strokeStyle='#44505f';g.lineWidth=dp;g.stroke();
    if(det){g.strokeStyle='#161a21';g.beginPath();g.moveTo(-.2*len,-wid*.2);g.lineTo(.1*len,wid*.15);g.moveTo(.15*len,-wid*.25);g.lineTo(-.05*len,wid*.3);g.stroke()}
    g.restore();return}
  const moving=Math.hypot(s.vx,s.vy)>.02;
  if(moving||true){for(const z of s.zones)for(const m of z.mods)if(m.k==='E'&&m.alive&&moving){
      const bo=s.bst>1.15,fl=len*(.14+.06*rnd())*(1+(s.bst-1)*1.8),ex=m.u*len,ey=m.v*wid*.7;
      const gr=g.createLinearGradient(ex,0,ex-fl,0);gr.addColorStop(0,bo?'rgba(200,230,255,.98)':'rgba(255,230,160,.95)');gr.addColorStop(1,'rgba(255,120,40,0)');
      g.fillStyle=gr;g.beginPath();g.moveTo(ex,ey-wid*.06);g.lineTo(ex-fl,ey);g.lineTo(ex,ey+wid*.06);g.fill()}}
  hull();let gr=C[s.side];if(det){gr=g.createLinearGradient(0,-wid/2,0,wid/2);gr.addColorStop(0,CD[s.side]);gr.addColorStop(.5,C[s.side]);gr.addColorStop(1,CD[s.side])}
  g.fillStyle=gr;g.fill();g.strokeStyle=CL[s.side];g.lineWidth=Math.max(.6,dp*.8);g.globalAlpha=.8;g.stroke();g.globalAlpha=1;
  if(det){
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=dp*.7;g.beginPath();g.moveTo(-.4*len,0);g.lineTo(.42*len,0);g.moveTo(-.1*len,-wid*.5);g.lineTo(-.1*len,wid*.5);g.stroke();
    g.save();hull();g.clip();s.zones.forEach((z,zi)=>{if(z.armN>0)return;g.fillStyle='rgba(255,110,50,.2)';const pad=zi===0?[.25,-.15,.25,.3]:zi===2?[-.5,-.28,.18,.56]:zi===1?[-.3,0,.6,.5]:[-.3,-.5,.6,.5];g.fillRect(pad[0]*len,pad[1]*wid,pad[2]*len,pad[3]*wid)});g.restore();
    const mr=Math.max(1.2*dp,Math.min(len*.018,5*dp));
    for(const z of s.zones)for(const m of z.mods){const mx=m.u*len,my=m.v*wid*.7;
      if(!m.alive){g.fillStyle='#1a1d23';g.beginPath();g.arc(mx,my,mr*1.2,0,6.283);g.fill();g.strokeStyle='#ef6a5e';g.lineWidth=dp*.7;g.beginPath();g.moveTo(mx-mr,my-mr);g.lineTo(mx+mr,my+mr);g.moveTo(mx+mr,my-mr);g.lineTo(mx-mr,my+mr);g.stroke();continue}
      if(m.k==='T'||m.k==='A'){
        g.fillStyle='#0d1219';g.beginPath();g.arc(mx,my,mr*1.15,0,6.283);g.fill();g.fillStyle=m.k==='T'?CL[s.side]:'#ffe08a';g.beginPath();g.arc(mx,my,mr*.7,0,6.283);g.fill();
        const aim=turAim(m,s,now),bl=mr*(m.k==='T'?2.4:1.5);g.strokeStyle=m.k==='T'?'#e8f3ff':'#ffd27a';g.lineWidth=Math.max(dp,mr*.5);g.beginPath();g.moveTo(mx,my);g.lineTo(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl);g.stroke();
        if(m.rt&&now-m.rt<130){g.fillStyle='rgba(255,245,200,'+(1-(now-m.rt)/130)+')';g.beginPath();g.arc(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl,mr*1.05,0,6.283);g.fill()}}
      else if(m.k==='G'){
        const aim=turAim(m,s,now),tw=m.cfg&&m.cfg.tw,bl=mr*1.9,h=Math.min(1,m.heat||0);g.fillStyle='#0d1219';g.beginPath();g.arc(mx,my,mr*1.1,0,6.283);g.fill();
        g.fillStyle=m.lock?'#ff5a3c':'rgb('+Math.round(120+135*h)+','+Math.round(150-90*h)+','+Math.round(160-120*h)+')';g.beginPath();g.arc(mx,my,mr*.65,0,6.283);g.fill();
        g.strokeStyle='#cfd8e0';g.lineWidth=Math.max(dp,mr*.32);const nx=-Math.sin(aim)*mr*.28;for(let b=0;b<(tw?2:1);b++){const o=tw?(b?1:-1):0,ox=-Math.sin(aim)*mr*.3*o,oy=Math.cos(aim)*mr*.3*o;g.beginPath();g.moveTo(mx+ox,my+oy);g.lineTo(mx+ox+Math.cos(aim)*bl,my+oy+Math.sin(aim)*bl);g.stroke()}
        if(m.rt&&now-m.rt<90){g.fillStyle='rgba(255,230,150,.8)';g.beginPath();g.arc(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl,mr*.6,0,6.283);g.fill()}}
      else if(m.k==='L'){
        const aim=turAim(m,s,now),bl=mr*3.2,hot=m.rt&&now-m.rt<380;
        g.fillStyle='#0d1219';g.beginPath();g.arc(mx,my,mr*1.3,0,6.283);g.fill();g.fillStyle=hot?'#fff':(s.side?'#ff7ad9':'#6af0ff');g.beginPath();g.arc(mx,my,mr*.85,0,6.283);g.fill();
        g.strokeStyle='#d8f6ff';g.lineWidth=Math.max(dp,mr*.45);g.beginPath();g.moveTo(mx,my);g.lineTo(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl);g.stroke()}
      else if(m.k==='M'){
        g.fillStyle='#0d1219';g.fillRect(mx-mr*1.4,my-mr*1.1,mr*2.8,mr*2.2);g.fillStyle=m.ammo>0?'#ffb36b':'#554';
        g.fillRect(mx-mr*1.1,my-mr*.8,mr*.9,mr*.6);g.fillRect(mx+mr*.2,my-mr*.8,mr*.9,mr*.6);g.fillRect(mx-mr*1.1,my+mr*.2,mr*.9,mr*.6);g.fillRect(mx+mr*.2,my+mr*.2,mr*.9,mr*.6)}
      else if(m.k==='R'){g.fillStyle='#3a4350';g.fillRect(mx-mr*.5,my-mr*.5,mr,mr);if(Math.abs(s.trn||0)>.2){g.fillStyle='#bfe3ff';g.fillRect(mx-mr*.2,my+(my>0?1:-1)*mr*.5,mr*.4,mr*.8)}}
      else if(m.k==='D'){g.strokeStyle='#8fd4ff';g.lineWidth=Math.max(dp*.8,mr*.3);g.beginPath();g.arc(mx,my,mr*.9,-2.2,.8);g.stroke()}
      else if(m.k==='E'){g.fillStyle='#2a323f';g.fillRect(mx-mr*1.2,my-mr*.9,mr*2,mr*1.8);g.fillStyle=moving?'#ffd27a':'#6f7b8c';g.fillRect(mx-mr*1.5,my-mr*.5,mr*.5,mr)}
    }
    const c=s.core;g.fillStyle=c.alive?'#9ff0b4':'#ef6a5e';g.beginPath();g.moveTo(c.u*len,-mr*1.3);g.lineTo(c.u*len+mr*1.3,0);g.lineTo(c.u*len,mr*1.3);g.lineTo(c.u*len-mr*1.3,0);g.closePath();g.fill();
  }
  g.restore();
  const f=s.aliveN/s.total,by=y+Math.max(wid/2,r*0.5)+4*dp;g.fillStyle='#1b2433';g.fillRect(x-r,by,len,2*dp);g.fillStyle=f>.55?'#6fdc8c':f>.35?'#f0c14b':'#ef6a5e';g.fillRect(x-r,by,len*f,2*dp);
}
function draw(g,ox,oy,k,dp){
  const cT=Math.cos(ui.tilt||0),sT=Math.sin(ui.tilt||0),d3=sT>.02;curCT=cT;curST=sT;vw={ox,oy,kk:k,cT,sT};const X=x=>ox+x*k,Y=y=>oy+y*k*cT,Z=z=>-z*k*sT*.7;
  if(projMode<2)for(const side of [0,1]){
    g.strokeStyle=C[side];g.fillStyle=C[side];g.globalAlpha=projMode?.4:.55;g.lineWidth=1.1*dp;g.beginPath();
    for(const p of proj){if(p.side!==side||p.dist>p.max*.8)continue;const x=X(p.x),y=Y(p.y)+Z(p.z);
      if(projMode){g.moveTo(x,y);g.lineTo(x-p.vx/VP/500*9*dp,y-p.vy/VP/500*9*dp)}else{g.moveTo(x+1.6*dp,y);g.arc(x,y,1.6*dp,0,6.283)}}
    if(projMode)g.stroke();else g.fill();
    // у конца дальности снаряды гаснут
    g.beginPath();g.globalAlpha=projMode?.18:.25;for(const p of proj){if(p.side!==side||p.dist<=p.max*.8)continue;const x=X(p.x),y=Y(p.y)+Z(p.z);
      if(projMode){g.moveTo(x,y);g.lineTo(x-p.vx/VP/500*9*dp,y-p.vy/VP/500*9*dp)}else{g.moveTo(x+1.6*dp,y);g.arc(x,y,1.6*dp,0,6.283)}}
    if(projMode)g.stroke();else g.fill();
  }
  g.globalAlpha=1;
  for(const side of [0,1]){g.strokeStyle=CL[side];g.lineWidth=2*dp;g.beginPath();
    for(const p of torps){if(p.side!==side||!p.tgt)continue;const x=X(p.x),y=Y(p.y),dx=p.tgt.x-p.x,dy=p.tgt.y-p.y,l=Math.hypot(dx,dy)||1,tl2=Math.max(10*dp,40*k);g.moveTo(x,y);g.lineTo(x-dx/l*tl2,y-dy/l*tl2)}
    g.stroke()}
  const ord=d3?ships.slice().sort((a,b)=>a.z-b.z):ships;
  // препятствия: астероиды, обломки, планеты (за ними можно спрятаться, лазеры и снаряды в них упираются)
  for(const e of env){const x=X(e.x),y=Y(e.y),rr=Math.max(2*dp,e.r*k);
    if(e.t==='planet'&&e.ring){g.strokeStyle='#b9a98a';g.globalAlpha=.28;g.lineWidth=Math.max(2*dp,(e.ring[1]-e.ring[0])*k);g.beginPath();g.ellipse(x,y,(e.ring[0]+e.ring[1])/2*k,(e.ring[0]+e.ring[1])/2*k*(vw.cT||1),0,0,6.283);g.stroke();g.globalAlpha=1}
    if(e.t==='station'){g.fillStyle='#5a6577';g.globalAlpha=.95;g.beginPath();g.ellipse(x,y,rr*.18,rr*.18*(vw.cT||1),0,0,6.283);g.fill();g.strokeStyle='#9fb4d8';g.lineWidth=Math.max(1.5*dp,rr*.08);g.globalAlpha=.8;g.beginPath();g.ellipse(x,y,rr*.7,rr*.7*(vw.cT||1),0,0,6.283);g.stroke();g.lineWidth=1.5*dp;for(let q=0;q<4;q++){const a=q*1.5708+.4;g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*rr*.7,y+Math.sin(a)*rr*.7*(vw.cT||1));g.stroke()}g.globalAlpha=1;continue}
    if(e.t==='planet'){const gr=g.createRadialGradient(x-rr*.3,y-rr*.3,rr*.1,x,y,rr);gr.addColorStop(0,'#7a8aa8');gr.addColorStop(1,'#1c2436');g.fillStyle=gr;g.globalAlpha=.95;g.beginPath();g.ellipse(x,y,rr,rr*(vw.cT||1),0,0,6.283);g.fill();g.strokeStyle='#9fb4d8';g.globalAlpha=.35;g.lineWidth=1.5*dp;g.stroke()}
    else{g.fillStyle=e.t==='debris'?'#4a3f38':'#6b625a';g.globalAlpha=.95;g.beginPath();g.ellipse(x,y,rr,rr*(vw.cT||1)*.9,e.x,0,6.283);g.fill();g.strokeStyle='#b3a699';g.globalAlpha=.5;g.lineWidth=1*dp;g.stroke()}}
  g.globalAlpha=1;
  // зоны сканеров: у выбранного корабля — радиусы, у всех с включённым радаром — тонкие импульсы
  {const ellip=(x,y,r)=>{g.beginPath();g.ellipse(x,y,r*k,r*k*(vw.cT||1),0,0,6.283);g.stroke()};
   g.lineWidth=1*dp;
   for(const s of ord){if(!s.alive)continue;const x=X(s.x),y=Y(s.y)+Z(s.z);
     if(s.rdOn&&(s===sel||projMode<2)){const ph=((performance.now()/1400+s.x*.01)%1),rr=(s.scl||[]).filter(q=>q.k==='rad').reduce((a,q)=>Math.max(a,q.rng),0);
       g.setLineDash([]);g.strokeStyle=s.side?'#ff5fd0':'#4fe6ff';g.globalAlpha=.35*(1-ph);ellip(x,y,rr*ph);if(s===sel){g.globalAlpha=.25;g.setLineDash([6*dp,6*dp]);ellip(x,y,rr)}}
     if(s===sel){g.setLineDash([2*dp,5*dp]);for(const q of s.scl||[]){if(q.k==='rad')continue;g.strokeStyle=q.k==='ir'?'#ff9a4f':'#a98cff';g.globalAlpha=.3;ellip(x,y,q.rng)}}}
   g.setLineDash([]);g.globalAlpha=1}
  // контакты врага: есть засечка, но нет захвата — размытая метка
  for(const s of ord){if(s.side!==1||!s.alive)continue;const sn=s.seen[0]>t-5,lk=s.lock[0]>t-5;
    if(sn&&!lk){const x=X(s.x),y=Y(s.y)+Z(s.z);g.strokeStyle='#ffd24f';g.globalAlpha=.55;g.setLineDash([3*dp,3*dp]);g.beginPath();g.arc(x,y,Math.max(8*dp,s.T.L*k*.9),0,6.283);g.stroke();g.setLineDash([]);g.globalAlpha=1}}
  for(const s of ord)drawShip(g,s,X(s.x),Y(s.y)+Z(s.z),k,dp);
  // ракеты
  for(const side of [0,1]){g.strokeStyle=CL[side];g.lineWidth=dp;g.globalAlpha=.22;g.beginPath();
    for(const p of mis){if(p.side!==side||p.tr.length<6)continue;g.moveTo(X(p.tr[0]),Y(p.tr[1])+Z(p.tr[2]));for(let i=3;i<p.tr.length;i+=3)g.lineTo(X(p.tr[i]),Y(p.tr[i+1])+Z(p.tr[i+2]));g.lineTo(X(p.x),Y(p.y)+Z(p.z))}
    g.stroke();g.globalAlpha=1}
  for(const p of mis){const x=X(p.x),y=Y(p.y)+Z(p.z),L=Math.min(Math.max(5*dp,k*1.1),13*dp),Wd=L*.2;
    g.save();g.translate(x,y);g.scale(1,curCT>.6?1:curCT);g.rotate(p.h);
    const fg=g.createLinearGradient(-L*.5,0,-L*2.1,0);fg.addColorStop(0,'rgba(255,230,150,.95)');fg.addColorStop(.5,'rgba(255,120,40,.5)');fg.addColorStop(1,'rgba(255,80,20,0)');
    g.fillStyle=fg;g.beginPath();g.moveTo(-L*.5,-Wd*.5);g.lineTo(-L*2.1,0);g.lineTo(-L*.5,Wd*.5);g.fill();
    g.fillStyle=CD[p.side];g.beginPath();g.moveTo(-L*.5,-Wd*.5);g.lineTo(-L*.68,-Wd*1.25);g.lineTo(-L*.2,-Wd*.5);g.moveTo(-L*.5,Wd*.5);g.lineTo(-L*.68,Wd*1.25);g.lineTo(-L*.2,Wd*.5);g.fill();
    g.fillStyle='#e6ecf3';g.fillRect(-L*.5,-Wd*.5,L*.8,Wd);
    g.fillStyle=C[p.side];g.fillRect(-L*.05,-Wd*.5,L*.14,Wd);
    g.beginPath();g.moveTo(L*.3,-Wd*.5);g.lineTo(L*.62,0);g.lineTo(L*.3,Wd*.5);g.closePath();g.fill();
    g.restore()}
  for(const q of smoke){const u=(t-q.t0)/q.d,x=X(q.x+q.vx*(t-q.t0)),y=Y(q.y+q.vy*(t-q.t0))+Z(q.z||0),rr=Math.max(1.2*dp,(q.r0+u*q.L*.035)*k);
    g.globalAlpha=Math.max(0,.3*(1-u));g.fillStyle=u<.2&&q.fire?'#ffb347':'#5a606b';g.beginPath();g.arc(x,y,rr,0,6.283);g.fill();
    if(q.fire&&u<.3){g.globalAlpha=.8*(1-u/.3);g.fillStyle='#ff6a2a';g.beginPath();g.arc(x,y,rr*.5,0,6.283);g.fill()}}
  g.globalAlpha=1;
  g.lineWidth=dp;
  for(const side of [0,1]){g.strokeStyle=CL[side];g.globalAlpha=.32;g.lineWidth=1.2*dp;g.beginPath();
    for(const c of air){if(c.side!==side||c.state!=='fly'||c.tr.length<4)continue;const zz=Z(c.home.z);const i0=Math.max(0,c.tr.length-14)&~1;g.moveTo(X(c.tr[i0]),Y(c.tr[i0+1])+zz);for(let i=i0+2;i<c.tr.length;i+=2)g.lineTo(X(c.tr[i]),Y(c.tr[i+1])+zz);g.lineTo(X(c.x),Y(c.y)+zz)}
    g.stroke()}
  g.globalAlpha=1;
  for(const side of [0,1])for(const type of ['F','B']){
    g.fillStyle=CL[side];g.beginPath();const sz=Math.min(type==='F'?7:9,Math.max(type==='F'?3.6:4.8,k*(type==='F'?.35:.5)))*dp;
    for(const c of air){if(c.side!==side||c.type!==type||c.state!=='fly')continue;
      const x=X(c.x),y=Y(c.y)+Z(c.home.z),a=c.h;
      g.moveTo(x+Math.cos(a)*sz,y+Math.sin(a)*sz);g.lineTo(x+Math.cos(a+2.5)*sz,y+Math.sin(a+2.5)*sz);g.lineTo(x+Math.cos(a-2.5)*sz,y+Math.sin(a-2.5)*sz);g.closePath()}
    g.fill()}
  const now=performance.now();shots=shots.filter(s=>now-s.rt<340);
  g.lineWidth=1.4*dp;
  for(const sh of shots){if(sh.a&&sh.a.alive!==false){sh.x1=sh.a.x;sh.y1=sh.a.y}if(sh.b&&sh.b.alive!==false){sh.x2=sh.b.x;sh.y2=sh.b.y}
    const u=(now-sh.rt)/340,hd=Math.min(1,(now-sh.rt)/110),ax=X(sh.x1),ay=Y(sh.y1),bx=X(sh.x2),by=Y(sh.y2),len=Math.hypot(bx-ax,by-ay)||1,tl=Math.min(1,24*dp/len),tl0=Math.max(0,hd-tl);
    g.strokeStyle='#fff';g.globalAlpha=Math.pow(1-u,1.5);g.beginPath();g.moveTo(ax+(bx-ax)*tl0,ay+(by-ay)*tl0);g.lineTo(ax+(bx-ax)*hd,ay+(by-ay)*hd);g.stroke()}
  beams=beams.filter(b=>now-b.rt<900);
  for(const b of beams){if(now<b.rt){const u=(now-b.c0)/600,x0=X(b.a.x),y0=Y(b.a.y)+Z(b.a.z),r=(6+b.w*1.5)*dp*(.3+u);
      const gr0=g.createRadialGradient(x0,y0,0,x0,y0,r);gr0.addColorStop(0,'rgba(255,255,255,'+(.4+.5*u)+')');gr0.addColorStop(.5,b.side?'rgba(255,95,208,.45)':'rgba(79,230,255,.45)');gr0.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr0;g.globalAlpha=1;g.beginPath();g.arc(x0,y0,r,0,6.283);g.fill();continue}
    const u=(now-b.rt)/900,a=Math.pow(1-u,.7);if(b.b.alive){b.tx=b.b.x;b.ty=b.b.y;b.tz=b.b.z}
    const x1=X(b.a.x),y1=Y(b.a.y)+Z(b.a.z),x2=X(b.tx),y2=Y(b.ty)+Z(b.tz);g.lineCap='round';
    g.strokeStyle=b.side?'#ff5fd0':'#4fe6ff';g.globalAlpha=.25*a;g.lineWidth=(5+b.w*1.1)*dp;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
    g.globalAlpha=.6*a;g.lineWidth=(2.4+b.w*.3)*dp;g.stroke();
    g.strokeStyle='#fff';g.globalAlpha=a;g.lineWidth=(1+b.w*.12)*dp;g.stroke();
    {const ge=g.createRadialGradient(x1,y1,0,x1,y1,(7+b.w)*dp);ge.addColorStop(0,'rgba(255,255,255,'+a+')');ge.addColorStop(.4,(b.side?'rgba(255,95,208,':'rgba(79,230,255,')+(.6*a)+')');ge.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=ge;g.globalAlpha=1;g.beginPath();g.arc(x1,y1,(7+b.w)*dp,0,6.283);g.fill()}
    const gr=g.createRadialGradient(x2,y2,0,x2,y2,(6+b.w)*dp);gr.addColorStop(0,'rgba(255,255,255,'+a+')');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.globalAlpha=1;g.beginPath();g.arc(x2,y2,(6+b.w)*dp,0,6.283);g.fill();
    g.lineCap='butt'}
  g.globalAlpha=1;
  for(const f of frags){const u=(t-f.t0)/f.d,x=X(f.x+f.vx*0),y=Y(f.y)+Z(f.z||0),al=Math.max(0,1-u);
    if(x<-30||x>W+30||y<-30||y>H+30)continue;
    if(f.ln){const ln=Math.max(2*dp,Math.hypot(f.vx,f.vy)*k*.07);g.strokeStyle=u<.5?'#ffd27a':'#ff7a3a';g.globalAlpha=al;g.lineWidth=Math.max(1,dp*.9);const ca=Math.atan2(f.vy,f.vx*1);g.beginPath();g.moveTo(x,y);g.lineTo(x-Math.cos(ca)*ln,y-Math.sin(ca)*ln*(vw.cT||1));g.stroke()}
    else{const sz=Math.max(1.2*dp,f.sz*k*1.8);g.save();g.translate(x,y);g.scale(1,vw.cT||1);g.rotate(f.rot);g.globalAlpha=al*.9;g.fillStyle=u<.25?'#e8863a':'#3a3f4a';g.strokeStyle=CL[f.side];g.lineWidth=.8*dp;g.beginPath();g.moveTo(-sz,-sz*.5);g.lineTo(sz*.8,-sz*.6);g.lineTo(sz,sz*.3);g.lineTo(-sz*.3,sz*.6);g.closePath();g.fill();g.stroke();g.restore()}}
  for(const p of pods){const x=X(p.x),y=Y(p.y)+Z(p.z||0);if(x<-20||x>W+20||y<-20||y>H+20)continue;
    const bl=((t*1.4+p.ph)%1)<.22,r=Math.max(1.3*dp,k*.12);g.globalAlpha=.95;g.fillStyle=CL[p.side];g.beginPath();g.arc(x,y,r,0,6.283);g.fill();
    if(bl){g.strokeStyle='#fff';g.globalAlpha=.8;g.lineWidth=dp*.8;g.beginPath();g.arc(x,y,r*2.4,0,6.283);g.stroke()}}
  for(const l of lands){const x=X(l.x),y=Y(l.y)+Z(l.z||0);if(x<-20||x>W+20||y<-20||y>H+20)continue;
    const r=Math.max(2.4*dp,k*.3),a=Math.atan2(l.vy,l.vx),ln=Math.max(6*dp,Math.hypot(l.vx,l.vy)*k*.9);
    g.globalAlpha=.35;g.strokeStyle=CL[l.side];g.lineWidth=dp*1.2;g.beginPath();g.moveTo(x,y);g.lineTo(x-Math.cos(a)*ln,y-Math.sin(a)*ln*(vw.cT||1));g.stroke();
    g.globalAlpha=1;g.save();g.translate(x,y);g.rotate(a);g.fillStyle='#fff';g.strokeStyle=CL[l.side];g.lineWidth=dp;g.beginPath();g.moveTo(r*1.4,0);g.lineTo(-r,-r*.8);g.lineTo(-r*.5,0);g.lineTo(-r,r*.8);g.closePath();g.fill();g.stroke();g.restore()}
  g.globalAlpha=1;
  for(const f of fx){const u=(t-f.t0)/f.d,x=X(f.x),y=Y(f.y)+Z(f.z||0);
    if(f.ring){const rr=f.r*k*Math.min(1,u*1.6)*.9,al=Math.pow(Math.max(0,1-u),1.3);g.strokeStyle='rgba(255,230,190,'+al+')';g.lineWidth=Math.max(2*dp,rr*.06);g.beginPath();g.ellipse(x,y,rr,rr*(vw.cT||1),0,0,6.283);g.stroke();if(u<.25){const gr=g.createRadialGradient(x,y,0,x,y,rr*.8);gr.addColorStop(0,'rgba(255,255,255,'+(1-u*4)+')');gr.addColorStop(1,'rgba(255,170,80,0)');g.fillStyle=gr;g.globalAlpha=1;g.beginPath();g.arc(x,y,rr*.8,0,6.283);g.fill()}continue}
    if(f.muz){if(x<-20||x>W+20||y<-20||y>H+20)continue;const rr=Math.max(3.5*dp,k*.9)*(1-u*.6),gr=g.createRadialGradient(x,y,0,x,y,rr);gr.addColorStop(0,'rgba(255,255,255,'+(1-u)+')');gr.addColorStop(.5,(f.side?'rgba(255,160,90,':'rgba(120,210,255,')+(.7*(1-u))+')');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.globalAlpha=1;g.beginPath();g.arc(x,y,rr,0,6.283);g.fill();continue}
    if(k<.7&&f.r<3)continue;
    if(f.r>=3){const rr=Math.max(3*dp,f.r*k*Math.min(1,u*2.5)*.6),al=Math.pow(Math.max(0,1-u),1.6);
      if(rr>5*dp){const gr=g.createRadialGradient(x,y,0,x,y,rr);gr.addColorStop(0,'rgba(255,246,210,'+al+')');gr.addColorStop(.45,'rgba(255,150,60,'+al*.65+')');gr.addColorStop(1,'rgba(255,90,30,0)');g.fillStyle=gr;g.globalAlpha=1;g.beginPath();g.arc(x,y,rr,0,6.283);g.fill()}
      else{g.fillStyle='#ffc46a';g.globalAlpha=al;g.beginPath();g.arc(x,y,rr,0,6.283);g.fill()}}
    else{g.globalAlpha=Math.max(0,1-u);g.strokeStyle='#fff3c4';g.lineWidth=1.5*dp;g.beginPath();g.arc(x,y,Math.max(2.5*dp,f.r*k*u*3),0,6.283);g.stroke()}}
  g.globalAlpha=1;
}
const SHORT={cv:'ав',hc:'тк',dd:'эс',fr:'фр'};
const aliveBy=s=>ships.filter(o=>o.side===s&&o.alive&&o.st!=='surr').length;
function checkEnd(){
  if(done)return;
  {let md=1e9;const F=[...FL.values()];for(const a of F)for(const b of F)if(a.side===0&&b.side===1)md=Math.min(md,Math.hypot(a.cx-b.cx,a.cy-b.cy));
   if(md<200)hadContact=true;if(hadContact&&md>420&&F.length>1&&!ships.some(o=>o.alive&&o.dvB&&o.dvB.spend>.3)){sepT+=1;if(sepT>600&&cfgNow&&cfgNow.demo)done=true}else sepT=0} /* бой без лимита времени: кончается, только если разошлись и ни у кого не осталось топлива вернуться */
  if(aliveBy(0))lastFriend=t;
  if((!aliveBy(1)&&!pend.length)||(!aliveBy(0)&&t-lastFriend>1800)||((()=>{const na=aliveBy(0)+aliveBy(1);if(na!==lastNa){lastNa=na;lastNaT=t}return false})()))done=true; // ничья: никто никого не бьёт уже 8 минут (кончились снаряды, сдавшиеся)
}
function result(){
  const mine=ships.filter(s=>s.side===0&&!s.bayOf).map(s=>({ref:s.spec.ref,alive:s.alive||!!s.esc,lost:1-s.aliveN/s.total,fuel:s.spec.fuel!=null&&s.spec.fuelCap>0?s.fuel:null,
    F:ships.filter(q=>q.bayOf===s&&q.alive).length+(s.bay?s.bay.length:0),B:air.filter(c=>c.own===s&&c.type==='B'&&c.state!=='dead').length}));
  const en=ships.filter(s=>s.side===1&&!s.bayOf);
  return {t,mine,enemyKilled:en.filter(s=>!s.alive&&!s.esc).map(s=>s.cls),prizes:ships.filter(s=>s.prize&&s.side===0&&s.alive).map(s=>s.cls),surrendered:stat.surr?stat.surr[1]:0,wrecks:ships.filter(s=>!s.alive&&!s.esc).length,enemyAlive:en.filter(s=>s.alive||s.esc).length,mineAlive:ships.filter(s=>s.side===0&&(s.alive||s.esc)).length,stat};
}
const BFK=.001; // а.е.-эквивалент на единицу набранной скорости: расход топлива в бою = fuelPerAU корабля × Δv × BFK
function shipArms(s){
  const cnt={},al={};for(const m of s.tur){cnt[m.k]=(cnt[m.k]||0)+1;if(m.alive)al[m.k]=(al[m.k]||0)+1}
  const parts=[];
  if(cnt.T){const cal=[...new Set(s.tur.filter(m=>m.k==='T').map(m=>m.cfg&&m.cfg.cal).filter(Boolean))].sort((a,b)=>a-b);parts.push(`рельсотроны ${al.T||0}/${cnt.T}${cal.length?' ('+cal.join('/')+' см)':''}`)}
  if(cnt.G)parts.push(`гатлинги ${al.G||0}/${cnt.G}`);
  if(cnt.A)parts.push(`ПВО ${al.A||0}/${cnt.A}`);
  if(cnt.L)parts.push(`лазер ${al.L||0}/${cnt.L}`);
  if(cnt.M){const am=s.tur.filter(m=>m.k==='M'&&m.alive).reduce((a,m)=>a+(m.ammo||0),0);parts.push(`ракетные ${al.M||0}/${cnt.M} (ракет ${am})`)}
  const mag=s.magMax?`боеприпасы ${Math.round(s.mag)}/${Math.round(s.magMax)} т${s.mag<=0?' — пусто':''}`:'боеприпасы —';
  const en=s.enR!=null&&s.enR<1?` · энергия ${Math.round(s.enR*100)}%`:'';
  const fu=s.fuelCap?`<b style="color:${s.fuel/s.fuelCap<.2?'#ff7b7b':s.fuel/s.fuelCap<.5?'#ffd36b':'#7dffb0'}">топливо ${Math.round(100*(s.fuel||0)/s.fuelCap)}%</b> (${Math.round(s.fuel||0)}/${Math.round(s.fuelCap)} т · запас Δv ${(FUEL.ve*Math.log((dryM(s)+(s.fuel||0))/dryM(s))).toFixed(2)} км/с)`:'топливо —';
  const mt=(s.tur.find(m=>m.k==='M')||{cfg:{}}).cfg.tons||0,msl=mt?` · в погребе ещё ~${Math.floor(Math.max(0,s.mag)/mt)} ракет (${mt} т)`:'';
  const hc=Math.round((s.heat||0)*100),th=`<b style="color:${hc>90?'#ff7b7b':hc>60?'#ffd36b':'#7dffb0'}">корпус +${hc} °C</b>${s.water0?` · вода ${Math.round(s.water)}/${Math.round(s.water0)} т`:''} · радиаторы ${s.radOut?'открыты':'убраны'}${s.cool?' · <b style="color:#ffd36b">уходит остывать</b>':''}`;
  return `Оружие: ${parts.join(' · ')||'нет'}<br>${mag}${msl}${en} · ${fu}<br>${th}`}
// панель справа: каждая деталь выбранного корабля — состояние и что она делает сейчас (и почему)
const MODNAME={T:'Рельсотрон',A:'Зенитка ПВО',G:'Миниган',L:'Лазер',M:'Ракетная установка',E:'Двигатель',R:'Маневровый двигатель',D:'Радар',C:'Ядро (мостик, реактор)'};let mpT=0;
function modPanel(s){let el=document.getElementById('bmods');
  if(!s||!viewed){if(el)el.hidden=true;return}
  if(!el){el=document.createElement('div');el.id='bmods';el.style.cssText='position:fixed;right:8px;top:56px;width:400px;max-height:calc(100vh - 80px);overflow:auto;z-index:60;background:rgba(10,14,22,.93);border:1px solid #2b3647;border-radius:8px;padding:8px 10px;font:12px/1.35 system-ui,sans-serif;color:#cfd8e6';document.body.appendChild(el)}
  el.hidden=false;const now=performance.now();if(now-mpT<250)return;mpT=now;
  const moving=Math.hypot(s.sx||0,s.sy||0)>.002,mods=[];for(const z of s.zones)for(const m of z.mods)mods.push([m,z]);
  const ord={T:0,G:1,A:2,L:3,M:4,E:5,R:6,D:7,C:8};mods.sort((a,b)=>(ord[a[0].k]??9)-(ord[b[0].k]??9));
  const cnt={};let h=`<b class="c${'ab'[s.side]}">${s.T.n}</b> — детали (${s.aliveN}/${s.total})<br><span class="muted">цель: ${s.tg&&s.tg.alive?s.tg.T.n+' · '+Math.hypot(s.tg.x-s.x,s.tg.y-s.y).toFixed(1)+' км':'нет'} · высота ${Math.round(s.z||0)} км</span><hr style="border-color:#2b3647">`;
  if(s.cg){h+=`<b>Состояние:</b> <span style="color:${s.cst==='боеспособен'?'#8fe3a0':s.cst==='повреждён'?'#ffd27a':'#ff6b5a'}">${s.cst||'боеспособен'}</span>${s.csWhy?' <span class="muted">('+s.csWhy+')</span>':''}<br>`;
    h+=`<b>Экипаж</b> ${s.crN}/${s.pers0}${Object.keys(s.dead).length?' · погибли: '+Object.entries(s.dead).map(([k,v])=>k+' '+v).join(', '):''}<br>`;
    for(let zi=0;zi<4;zi++){const g=s.cg.filter(q=>q.zi===zi),n=g.reduce((a,q)=>a+q.n,0),n0=g.reduce((a,q)=>a+q.n0,0),A=zoneAmmo(s,zi);
      h+=`<span class="muted">${ZN[zi]}:</span> люди ${n}/${n0}${s.vac[zi]?' · <span style="color:#7fc8ff">без воздуха</span>':''}${s.fire[zi]?' · <span style="color:#ff8a4a">пожар '+s.fire[zi]+'</span>':''}${A.t>.05?' · погреб '+A.t.toFixed(1)+' т ('+A.x.toFixed(1)+' т экв.)':''}<br>`}
    if(s.detLog)h+=`<span style="color:#ff6b5a">детонации: ${s.detLog.map(d=>ZN[d.zi]+' '+d.Y+' т экв.'+(d.chain?' (цепная)':'')).join(', ')}</span><br>`;
    h+=`<b>Корпус</b> ${Math.round((s.hullF??1)*100)}%: ${s.zones.map((z,i)=>ZN[i]+' '+(z.brk?'<span style="color:#ff6b5a">разрушен</span>':Math.round(z.sp)+'%')).join(' · ')}<br>`;
    {const pool=s.cg.filter(q=>!q.cmd&&(!q.m||!q.m.alive)).reduce((a,q)=>a+q.n,0),busy=(s.dcT||[]).reduce((a,q)=>a+q.w,0);
     h+=`<b>Борьба за живучесть</b>: свободно людей ${pool}, на работах ${busy}${s.derelict?' · <span style="color:#ff6b5a">остов — ремонта нет</span>':''}<br>`;
     h+=`<b>Ремонтный склад</b>: ${s.kitCap>0?`вместимость ${s.kitCap} наб., загружено ${s.kits0}, осталось <b style="color:${s.kits<=1e-6?'#ff6b5a':s.kits<KIT.low*s.kits0?'#ffb27a':'#8fe3a0'}">${s.kits.toFixed(1)}</b>, израсходовано ${s.kitUsed.toFixed(1)}${s.kits<=1e-6?' — <b style="color:#ff6b5a">ПУСТ: модули не чинятся, только тушение и герметизация</b>':''}`:'<b style="color:#ff6b5a">нет склада — модули не чинятся</b>'}<br>`;
     for(const q of s.dcT||[])h+=`<span class="muted">· ${q.k==='fire'?'тушат пожар':q.k==='vac'?'заделывают пробоины':'чинят '+(MODNAME[q.m.k]||q.m.k)+(q.m.wreck?' (уничтожен)':'')} — ${ZN[q.zi]}, ${q.w} чел.${q.prog!=null?', '+Math.round(q.prog*100)+'%':''}${q.kit?', '+q.kit.toFixed(1)+' наб.':''}${q.eta!=null&&isFinite(q.eta)?', ещё ~'+Math.round(q.eta/60)+' мин':''}</span><br>`;
     if(s.dcWhy)h+=`<span style="color:#ffb27a">${s.dcWhy}</span><br>`}
    if(s.fuelCap&&s.dvB){const B=s.dvB,rp=B.rp;h+=`<b>Топливо</b> ${Math.round(100*s.fuel/s.fuelCap)}% · Δv ${B.dvr.toFixed(2)} км/с${rp?` · возврат на базу (${Math.round(rp.d)} км): разворот ${rp.turn.toFixed(2)}, торможение ${rp.brake.toFixed(2)}, резерв ${rp.extra.toFixed(2)}`:B.tk?' · до танкера':''} · <b>для боя ${Math.max(0,B.spend).toFixed(2)} км/с</b>${s.rst==='home'?`<br><span style="color:#ffb27a">уходит на базу: ${s.homeWhy||''}</span>`:''}<br>`}
    h+=`<span class="muted">системы: оружие ${Math.round(weapEff(s)*100)}% · двигатели ${Math.round(sysEff(s,'E')*100)}% · маневровые ${Math.round(sysEff(s,'R')*100)}% · командование ${Math.round(cmdEff(s)*100)}% · сенсоры ${Math.round(sysEff(s,'D')*100)}%</span><hr style="border-color:#2b3647">`}
  { h+=`<b>Броня</b> <span class="muted">· сталь, слой 2 см держит ${(LAYER_MM/MM_E*1000).toFixed(0)} кДж/см²</span>`;
    const sec=s.zones.map((z,i)=>{const F=z.arm*LAYER_MM;let mn=F,n=0;if(z.g)for(const v of z.g.values()){n++;if(v<mn)mn=v}return `<b>${ZN[i]} ${F/10} см</b>: ${n?'тронуто '+n+' яч., тоньше всего '+(Math.round(mn)/10)+' см':'целая'}`});h+=`<div class="muted" style="margin:2px 0 4px">${sec.join(' · ')}</div>`;
    for(const q of (s.hl||[]).slice(0,8)){const W=260,sc=W/Math.max(1,q.F),pre=Math.max(0,q.F-q.before),cut=Math.max(0,q.before-q.after),thr=q.left>0; // полоса = толщина брони: серое — выбито раньше, оранжевое — этим ударом, синее — осталось, красное — пробил насквозь
      h+=`<div style="margin:3px 0"><span class="muted">${q.k}, ${q.v.toFixed(1)} км/с, ${q.Eu<.1?q.Eu.toFixed(3):q.Eu.toFixed(1)} МДж/см² → ${q.dep<10?q.dep.toFixed(1):Math.round(q.dep)} мм</span><br>
        <span style="display:inline-block;width:${W}px;height:9px;background:#1b2433;vertical-align:middle;position:relative"><span style="position:absolute;left:0;width:${pre*sc}px;height:9px;background:#4a5262"></span><span style="position:absolute;left:${pre*sc}px;width:${Math.max(1,cut*sc)}px;height:9px;background:#ffa040"></span><span style="position:absolute;left:${(pre+cut)*sc}px;width:${q.after*sc}px;height:9px;background:#5f9ad8"></span></span>
        <span style="color:${thr?'#ff6b5a':'#8fe3a0'}"> ${thr?'насквозь, +'+Math.round(q.left)+' мм в модули':'осталось '+(q.after<10?q.after.toFixed(1):Math.round(q.after))+' мм'}</span></div>`}
    if(!(s.hl||[]).length)h+='<div class="muted">попаданий в броню ещё не было</div>';h+='<hr style="border-color:#2b3647">'}
  for(const[m,z]of mods){cnt[m.k]=(cnt[m.k]||0)+1;const nm=(MODNAME[m.k]||m.k)+' №'+cnt[m.k],zi=s.zones.indexOf(z),side=ZN[zi]||'';
    let st,col;if(!m.alive){const W=(DCN.W[m.k]||300)*(m.wreck?2.5:1),pr=m.rp?' · ремонт '+Math.round(100*m.rp/W)+'%':'';st=(m.wreck?'уничтожен':'выведен из строя')+' · ремонт: '+((KIT.cost[m.k]||1)*(m.wreck?KIT.wreckK:1)).toFixed(1)+' наб.'+(s.kitCap<=0?' — нет склада':s.kits<=1e-6?' — <b>наборов нет</b>':'')+pr;col=m.rp?'#ffd27a':'#ff6b5a'}else if(s.cg&&modEff(s,m)<=0){st=!power(s,m.k)?'нет питания (реактор)':'нет расчёта';col='#ff9f5a'}else{col=(m.q||1)<1?'#cfe39a':'#8fe3a0';
      if(m.k==='E')st=s.engN>0&&moving?'даёт тягу':'исправен, корабль без хода';
      else if(m.k==='R')st=Math.abs(s.trn||0)>.08?'разворачивает корабль':'ожидает манёвра';
      else if(m.k==='D')st=s.rdOn?'активный поиск: излучает, нас видно':'выключен — пассивный режим, ждёт противника рядом';
      else if(m.k==='C')st='управляет кораблём'+(s.crew!=null?' · экипаж '+Math.round(s.crew*100)+'%':'');
      else{st=m.why||'готов';if(/выстрел|огонь|залп|пуск|импульс|отбивается/.test(st)&&!/последний/.test(st))col='#ffd27a';else if(/нет|вне|ниже|запрещ|сдался|перегрев|заклин|опасен|свой/.test(st))col='#9aa7b8'}}
    const extra=m.alive?[m.ar>0?'своя броня '+m.ar:'',m.sk?'навык '+m.sk:'',m.k==='G'?'нагрев '+Math.round((m.heat||0)*100)+'%':'',m.k==='M'&&m.ammo!=null?'ракет '+m.ammo:''].filter(Boolean).join(' · '):'';
    h+=`<div style="margin:3px 0"><b>${nm}</b> <span class="muted">· ${side}${z.armN!=null?' (броня '+(s.T.arm?Math.round(100*z.armN/(z.nc*s.T.arm)):0)+'%)':''}</span><br><span style="color:${col}">${st}</span>${extra?'<br><span class="muted">'+extra+'</span>':''}</div>`}
  el.innerHTML=h}
const fmtT=x=>x>=60?Math.floor(x/60)+' мин '+Math.round(x%60)+' с':x.toFixed(1)+' с';
function hud(){
  const m=Math.floor(t/60),sec=Math.floor(t%60);
  let h=`<span><b>Время боя</b>${m}:${String(sec).padStart(2,'0')}</span>`;
  const al=[aliveBy(0),aliveBy(1)];
  for(const s of [0,1]){
    const F=air.filter(c=>c.side===s&&c.type==='F'&&c.state!=='dead').length,Bm=air.filter(c=>c.side===s&&c.type==='B'&&c.state!=='dead').length;
    const acc=stat.shots[s]?(100*stat.hits[s]/stat.shots[s]).toFixed(1)+'%':'—';
    const sh=['cv','hc','dd','fr'].map(ty=>SHORT[ty]+' '+ships.filter(o=>o.side===s&&o.cls===ty&&o.alive).length).join(' · ');
    h+=`<span class="c${'ab'[s]}"><b>${(cfgNow&&cfgNow.names||['Ваш флот','Налётчики'])[s]}</b>${sh}${sideAI(s)}${stat.plan&&stat.plan[s]?' · план: <b>'+stat.plan[s]+'</b>':''} · рельсы ${stat.shots[s]}/${stat.hits[s]} (${acc}) · истр. ${F} (−${stat.lostF[s]}) · бомб. ${Bm} (−${stat.lostB[s]}) · торп. ${stat.torp[s]}→${stat.torpHit[s]} · ПВО ${stat.flak[s]} · лазеры ${stat.las[s]} · ракеты ${stat.mis[s]}→${stat.misHit[s]} (сбито ${stat.misShot[1-s]}) · сломано двиг. ${stat.bfail[s]}</span>`;
  }
  if(done)h+=`<span class="${al[0]?'ca':'cb'}"><b>Итог</b>${!al[1]&&al[0]?'победа':!al[0]&&al[1]?'поражение':!al[0]?'взаимное уничтожение':'враг отступил'}</span>`;
  $b('bstats').innerHTML=h;
  const inf=$b('binfo');
  if(sel){inf.hidden=false;const s=sel,tur=s.tur.filter(m=>m.alive).length,sk=s.tur.length?(s.tur.reduce((a,m)=>a+m.sk,0)/s.tur.length).toFixed(1):'—';
    inf.innerHTML=`<b class="c${'ab'[s.side]}">${s.T.n}</b>${s.alive?'':' <span class="muted">(уничтожен)</span>'}<br>Водоизмещение ${fmtN(s.T.tons)} т · длина ${Math.round(s.T.L*1000)} м · модули: ${s.aliveN}/${s.total} · ядро ${s.core.alive?'цело':'уничтожено'}<br>Турели: ${tur}/${s.tur.length} · ср. навык ${sk}<br>Двигатели: ${s.engN}/${s.T.eng} · маневровые ${s.rcsN}/${s.rcs0} · радар ${s.radN}/${s.rad0} · заряжено в башнях ${Math.round((s.ammoF==null?1:s.ammoF)*100)}%${s.holdK==='cover'?' · в укрытии':s.holdK==='escort'?' · охраняет':''}${s.bst>1.1?' · форсаж '+Math.round(s.bst*100)+'%':''}${s.lrp?' · дальний бой '+s.lrp.toFixed(0):''}<br>${shipArms(s)}${aiInfo(s)}<br>Высота: ${s.z.toFixed(0)}<br>Броня по секторам: ${s.zones.map((z,i)=>ZN[i]+' '+(s.T.arm?Math.round(100*z.armN/(z.nc*s.T.arm)):0)+'%').join(' · ')}`}
  else inf.hidden=true;
  modPanel(sel);
  {const so=$b('bsord'),ok=!!(sel&&sel.alive&&sel.side===0);so.hidden=!ok;if(ok)for(const b of so.querySelectorAll('[data-so]'))b.classList.toggle('on',b.dataset.so===(sel.ord||''))}
}
const PM=['точки','короткие линии','скрыть'];
let bspeed=30,sepT=0,hadContact=false;
let rsUiT=0;function frame(rdt){if(!active||done)return;fixedSteps(rdt*bspeed,true);const now=performance.now();if(now-rsUiT>500){rsUiT=now;const b=$b('bspd');if(b){let e=document.getElementById('brs');if(!e){e=document.createElement('span');e.id='brs';e.className='muted';e.style.marginLeft='8px';b.parentNode.insertBefore(e,b.nextSibling)}e.textContent='факт ×'+(rsV<10?rsV.toFixed(1):Math.round(rsV))+(rsV<bspeed*.9?' (не успевает: шаг '+(PERF.steps?(PERF.step/PERF.steps).toFixed(1):'—')+' мс)':'')}}} // фактическая скорость боя: сколько секунд боя посчитано за секунду
function tick(dt){
  if(done)return;
  while(pend.length&&pend[0].t<=t){const p=pend.shift();join(p.side==null?1:p.side,p.spec,p.edge||1500,p.ang)}
  step(dt);checkEnd();
  if(viewed&&!done){let n=0,b=0;for(const s of ships){if(!s.alive||!(s.engN>0))continue;if(Math.hypot(s.sx,s.sy)>.04){n+=Math.min(2,s.T.L);if((s.bst||1)>1.1)b++}}SFX.engine(Math.min(1,n/10),Math.min(1,b/4))}else SFX.engine(0,0);
}
function join(side,spec,edge,ang){
  fitSpec(spec);spec.cls=classify(spec);spec.dopt=spec.dopt0||DOPT[spec.cls];
  const sh=ang==null?mkShip(side,spec,(side?1:-1)*edge+R(-80,80),R(-150,150)):mkShip(side,spec,Math.cos(ang)*edge+R(-40,40),Math.sin(ang)*edge+R(-40,40));
  if(ang!=null)sh.hd=ang+Math.PI;
  // не появляться внутри другого корабля: сдвигаем в сторону, пока не освободится место
  for(let k=0;k<40;k++){let hit=null;for(const o of ships){if(!o.alive)continue;const m=(sh.T.L+o.T.L)*.5*1.15;if(Math.hypot(sh.x-o.x,sh.y-o.y)<m){hit=o;break}}
    if(!hit)break;const a=Math.atan2(sh.y-hit.y,sh.x-hit.x)+R(-.6,.6),st=(sh.T.L+hit.T.L)*.3;sh.x+=Math.cos(a)*st;sh.y+=Math.sin(a)*st}
  ships.push(sh);
  if(sh.car){if(spec.F>0)addFlights(sh,'F',spec.F);if(spec.B>0)addFlights(sh,'B',spec.B)}
  { // ангар: в нём настоящие корабли до 500 т из проектов (истребитель — просто лёгкий корабль); у старых спеков вместо истребителей — «Истребитель (обычный)»
    const hg=spec.hang&&spec.hang.length?spec.hang:((spec.F0||0)>0?[{ds:'p:s',n:Math.min(20,spec.F0)}]:null);
    if(hg){sh.bay=[];for(const h of hg){const d=craftById(h.ds);if(!d)continue;const cs=specFromStats(craftStats(d),d.name,spec.sk);for(let k=0;k<h.n&&sh.bay.length<60;k++)sh.bay.push(cs)}sh.bayT=t+R(5,15)}}
  return sh;
}
function begin(cfg){cfgNow=cfg;reset(cfg);active=true;acc=0;prevTilt=ui.tilt||0;setTilt(30);
  $b('btitle').textContent=cfg.title||'Бой';$b('battle').hidden=false;bind();}
let prevTilt=0;
function beginBg(cfg){cfgNow=cfg;reset(cfg);active=true;acc=0;viewed=false}
function fastForward(ms){if(!active||done)return 0;const t0=t,w0=performance.now();let k=0;while(!done&&k<4000&&performance.now()-w0<ms){tick(2);k++}return t-t0}
// ФИКСИРОВАННЫЙ ШАГ: кадр только добавляет игровое время, бой идёт шагами FDT с. Одинаковая последовательность шагов при любом FPS и нагрузке;
// если кадр не успевает (больше FMAX шагов), лишнее время отбрасывается — бой замедляется, но не меняется.
const FDT=gd('battle','step',{dt:.25}).dt,FMAX=Math.ceil(64/FDT); /* шаг симуляции, с; фиксированный — результат не зависит от FPS */let simAcc=0;
// БЮДЖЕТ КАДРА: шаги идут, пока не исчерпан бюджет времени кадра (STEPB.ms) — кадр не замирает на секунды; недосчитанное время копится (не выбрасывается),
// но не больше STEPB.lag с — дальше игра честно идёт медленнее заданного (фактическая скорость — Battle.realSpeed()). Последовательность шагов та же, детерминизм не страдает.
const STEPB=gd('battle','frame',{ms:14,lag:2});let rsAcc=0,rsWall=0,rsSim=0,rsV=0;
function fixedSteps(sim,budget){simAcc+=sim;let k=0;const w0=performance.now(),useB=!!budget;let t0=t;while(simAcc>=FDT-1e-9&&k<FMAX*8&&active&&!done){tick(FDT);simAcc-=FDT;k++;if(useB&&performance.now()-w0>STEPB.ms)break}
  if(k>=FMAX*8||simAcc>STEPB.lag)simAcc=Math.min(simAcc,STEPB.lag);PERF.frame+=performance.now()-w0;PERF.frames++;
  const now=performance.now();if(!rsWall)rsWall=now;rsSim+=t-t0;if(now-rsWall>1000){rsV=rsSim/((now-rsWall)/1000);rsSim=0;rsWall=now}}
function tickN(rdt){if(!active||done)return;fixedSteps(rdt*bspeed)}
function abort(){setTilt(Math.round(prevTilt*180/Math.PI));ui.bship=false;active=false;$b('battle').hidden=true;cfgNow=null}
function finish(){SFX.engine(0,0);setTilt(Math.round(prevTilt*180/Math.PI));active=false;$b('battle').hidden=true;const r=result(),cb=cfgNow.onEnd;cfgNow=null;cb(r)}
function bind(){
  if(bound)return;bound=true;
  $b('bspd').onclick=e=>{const v=+e.target.dataset.v;if(!v)return;bspeed=v;for(const b of $b('bspd').children)b.classList.toggle('on',+b.dataset.v===v)};
  $b('bfol').onclick=e=>{ui.bship=!ui.bship;e.target.classList.toggle('on',ui.bship)};
  $b('bstop').onclick=()=>{if(cfgNow&&cfgNow.demo){abort();state.demo=false}};
  $b('bsord').onclick=e=>{const o=e.target.dataset&&e.target.dataset.so;if(o===undefined||!sel)return;sel.ord=o||null;sel.cp=null;sel.cvN=0};
  $b('bord').onclick=e=>{const o=e.target.dataset&&e.target.dataset.o;if(o===undefined)return;
    if(o==='focus'){ORD.focus=sel&&sel.alive&&sel.side===1?sel:null;e.target.classList.toggle('on',!!ORD.focus);return}
    ORD.st=o||null;for(const b of $b('bord').querySelectorAll('[data-o]'))if(b.dataset.o!=='focus')b.classList.toggle('on',b.dataset.o===o)};
  $b('bfire').onclick=e=>{const o=e.target.dataset&&e.target.dataset.f;if(o===undefined)return;ORD.fire=o||null;for(const b of $b('bfire').querySelectorAll('[data-f]'))b.classList.toggle('on',b.dataset.f===o)};
  $b('bsens').onclick=e=>{const o=e.target.dataset&&e.target.dataset.s;if(o===undefined)return;ORD.sens=o||null;for(const b of $b('bsens').querySelectorAll('[data-s]'))b.classList.toggle('on',b.dataset.s===o)};
  $b('bmove').onclick=e=>{if(!sel||sel.side!==0){e.target.textContent='Сначала выберите свой корабль';return}moveMode=!moveMode;e.target.classList.toggle('on',moveMode);e.target.textContent=moveMode?'Кликните точку на карте':'Флот: идти в точку'};
  $b('bhold').onclick=()=>{if(sel&&sel.side===0)sel.F.mv=null};
  $b('bsnd').onclick=e=>{const v=e.target.textContent.includes('вкл');SFX.setOn(!v);e.target.textContent='Звук: '+(v?'выкл':'вкл')};
  $b('bgo').onclick=()=>{ui.bfollow=true;focusBattle()};
  $b('btilt').oninput=e=>setTilt(+e.target.value);
  $b('bpm').onclick=e=>{projMode=(projMode+1)%3;e.target.textContent='Снаряды: '+PM[projMode]};
}
let moveMode=false;
function toWorld(mx,my){const cT=vw.cT||1;return {x:(mx-vw.ox)/vw.kk,y:(my-vw.oy)/(vw.kk*cT)}}
function pick(mx,my){
  if(moveMode&&sel&&sel.side===0&&sel.alive){const w=toWorld(mx,my);sel.F.mv={x:w.x,y:w.y};moveMode=false;const b=$b('bmove');if(b){b.classList.remove('on');b.textContent='Флот: идти в точку'}return true}
  return pick0(mx,my)}
function pick0(mx,my){const cT=vw.cT||1,sT=vw.sT||0;let b=null,bd=16;
  for(const s of ships){const d=Math.hypot(vw.ox+s.x*vw.kk-mx,vw.oy+s.y*vw.kk*cT-s.z*vw.kk*sT*.7-my);if(d<bd){bd=d;b=s}}
  if(b){sel=b;return true}return false}
return {kernelConsts:()=>({SNS,GATP,VP,DISP,GDISP,PLN,GV}),setFC:o=>Object.assign(FC,o),rotF:s=>rotF(s),needNow:s=>retPlan(s).need,setDv:(s,dv)=>{s.fuel=dryM(s)*(Math.exp(dv/FUEL.ve)-1)+rotF(s)},perf:()=>PERF,realSpeed:()=>rsV,lead:()=>simAcc,dmgT:{hit:(o,kind,zi,o2)=>{const a=o.hd+[0,Math.PI/2,Math.PI,-Math.PI/2][zi],ex=Math.cos(a),ey=Math.sin(a),v=(o2&&o2.v)||7,x=o.x+ex*o.T.L*.5,y=o.y+ey*o.T.L*.5;return hitShip(o,kind,-ex*v+(o.sx||0),-ey*v+(o.sy||0),x,y,(o2&&o2.dmg)||10,1,o.z,0,kind==='gat',{kg:(o2&&o2.kg)||50,vx:-ex*v+(o.sx||0),vy:-ey*v+(o.sy||0),vz:0,cal:20,src:o2&&o2.src})},detonate:(o,zi,Y)=>detonate(o,zi,0,'тест',Y),zoneAmmo,shipState,modEff,sysEff,cmdEff,crewKill:(o,zi,L,c)=>crewKill(o,zi,L,c||'тест'),mdead,crewSync,hull:(o,zi,d)=>hullHit(o,zi,d,'тест')},killShip:(o,why)=>kill(o,why||'тест'),predictCmds,planT:{plan,belief,predTraj,PLN,ramHit,ramEst},detaches:()=>detaches,attachStructure,structEvents:()=>strEv,ctrlStepT:(s)=>s,tickFixed:n=>{for(let i=0;i<n&&active&&!done;i++)tick(2)},setMuzzle:f=>{MUZ=f},shuttles:()=>shuttles,tracers:()=>tracers,env:()=>env,impacts:()=>impacts,frags:()=>frags,turAim,shots:()=>shots,fx:()=>fx,proj:()=>proj,mis:()=>mis,flakS:()=>flakS,air:()=>air,beams:()=>beams,select:q=>{sel=q},moveFleet:(q,x,y)=>{if(q&&q.F)q.F.mv={x,y}},stat:()=>stat,frame,fastForward,setSpeed:v=>{bspeed=v},getSpeed:()=>bspeed,anchorSel:()=>sel,abort,ships:()=>ships,begin,tick,draw,hud,pick,join,finish,isDone:()=>done,active:()=>active,hot:()=>autoSlow&&t-lastEng<3,later:(tt,spec)=>pend.push({t:t+tt,spec}),time:()=>t,clear:()=>{sel=null},beginBg,view:()=>{viewed=true;bound=false;bind();$b('btitle').textContent=(cfgNow&&cfgNow.title)||'Бой';$b('battle').hidden=false},unview:()=>{viewed=false;const e=document.getElementById('bmods');if(e)e.hidden=true},setViewed:v=>{viewed=v;if(v){bound=false;bind()}},isViewed:()=>viewed,cfg:()=>cfgNow,result,setBSpeed:v=>{bspeed=v},addLate:e=>{pend.push({...e,t:t+(e.t||0)});pend.sort((a,b)=>a.t-b.t)},hide:()=>{$b('battle').hidden=true;const e=document.getElementById('bmods');if(e)e.hidden=true},tickN,sim:()=>({alive:[aliveBy(0),aliveBy(1)]})};
}
export const mainBattle = makeBattle();
let curB = mainBattle;
export const Battles = {main: mainBattle, get cur() { return curB; }, set cur(b) { curB = b; }};
// все остальные модули работают с «текущим» боем (тем, что показан на экране)
export const Battle = new Proxy({}, {get: (_, k) => (typeof curB[k] === 'function' ? (...a) => curB[k](...a) : curB[k])});

/* ===== НАЛЁТЫ ===== */
// примеры кораблей из таблицы: k — с какой силы налёта появляются
export const DOCTRINES = gd('battle', 'doctrines', [
  {name: 'Сторож ПВО', k: 0, tons: 1257, gat: 6, rad: 1, ir: 1, em: 1, fine: 1, fcs: 2, arm: 2, spd: 1.2},
  {name: 'Наводчик', k: 1, tons: 598, gat: 2, rad: 2, ir: 1, em: 1, fine: 1, ew: 1, fcs: 2, arm: 1, spd: 1.4},
  {name: 'Рельсотронщик', k: 1, tons: 8289, rails: 4, cal: 15, gat: 2, rad: 1, ir: 1, fcs: 2, dcon: 1, arm: 4, spd: 1},
  {name: 'Броненосец', k: 2, tons: 9524, rails: 2, cal: 20, gat: 4, rad: 1, ir: 1, em: 1, fcs: 3, dcon: 2, arm: 5, spd: .8},
  {name: 'Носитель', k: 2, tons: 7423, F: 20, gat: 8, rad: 1, ir: 1, em: 1, ew: 1, fcs: 2, dcon: 1, arm: 3, spd: .9}]);
export function raidSpecs(k) {
  const sp = (name, o) => Object.assign({name, rails: 0, flak: 0, arm: 2, eng: 3, L: 0.7, F: 0, B: 0, sk: 4 + Math.min(4, k * 0.5), dmg: 0, spd: 1, ref: null}, o);
  const out = [], rails = 8 + 3 * k, arm = 2 + Math.floor(k / 2);
  const RC = (cal, bar, ld, saf, n) => Array(n).fill(compOf(mkKey('rail', {cal, bar, ld, saf})).rcfg);
  const dc = k >= 3 ? 15 : 10, hc = k >= 2 ? 20 : 15;
  const nd = 2 + k, nl = Math.floor(nd / 3);
  for (let i = 0; i < nd; i++) out.push(sp(i >= nd - nl ? 'Налётчик-эсминец (подкрепление)' : 'Налётчик-эсминец', {rails, arm, L: 0.8, spd: 1.25, late: i >= nd - nl, railCfg: RC(dc, 1, 'a', 1, rails)}));
  for (let i = 0; i < 1 + Math.floor(k / 2); i++) out.push(sp('Налётчик-фрегат', {flak: 8, arm: Math.max(1, arm - 1), L: 0.5}));
  for (let i = 0; i < Math.floor(k / 3); i++) out.push(sp('Налётчик-крейсер', {rails: 30 + 10 * k, arm: arm + 2, eng: 4, L: 1.8, late: true, railCfg: RC(hc, 2, 'a', 2, 30 + 10 * k)}));
  // доктрины ботов из таблицы «Корабли (система)» (классов нет — это намерения, корабль собирается из модулей)
  const SC = (r, i, e, fine) => [...Array(r).fill(0).map((_, j) => ({k: 'rad', rng: 330, res: fine && j === 0 ? 1 : .4, fine: fine && j === 0 ? 1 : 0})), ...(i ? [{k: 'ir', rng: 120, res: 1}] : []), ...(e ? [{k: 'em', rng: 200, res: .4}] : [])];
  for (const d of DOCTRINES) if (k >= d.k) for (let i = 0; i < (d.n || 1); i++) out.push(sp(d.name, {tons: 0, L: d.tons / 50000, rails: d.rails || 0, railCfg: d.rails ? RC(String(d.cal), '1', 'a', 1, d.rails) : undefined, gat: d.gat || 0, F: d.F || 0, fq: d.F ? randCraft('F') : undefined, arm: d.arm, scList: SC(d.rad || 0, d.ir, d.em, d.fine), fcsN: d.fcs || 0, ew: d.ew || 0, dcon: d.dcon || 0, spd: d.spd || 1}));
  if (k >= 2) out.push(sp('Налётчик-авианосец', {fq: randCraft('F'), bq: randCraft('B'), late: true, rails: 4, arm, eng: 4, L: 2.2, F: 10 * (1 + Math.floor(k / 2)), B: 5 * Math.floor(k / 2)}));
  return out;
}
// боевой спек из характеристик проекта (корабль из ангара)
export function specFromStats(st, name, sk) {
  return {real: 1, name: name || 'Корабль', arm: st.armor, rails: st.rail, flak: st.flak, eng: Math.max(1, Math.min(6, st.engines || 1)), L: st.L, tons: st.tons || st.dry, sk: sk || 5,
    spd: st.bspd || 1, railCfg: st.railList, flakCfg: st.flakList, gat: st.gat, gatCfg: st.gatList, miss: st.msl, missCfg: st.misList, water: st.water || 0, dec: st.dec || 0, probe: st.probe || 0, tanker: st.tanker ? 1 : 0, fuelCap: st.fuelCap || 0, frate: st.fuelRate || 0, engT: st.engM || 0, pow: st.power || 0,
    ammoCap: st.ammoCap || 0, kitCap: st.kitCap > 0 ? st.kitCap : undefined, kits: st.kitCap > 0 ? st.kitCap : undefined, kitsM: st.kitCap > 0 ? 1 : 0, energy: st.energy || 0, defl: st.defl, trail: st.trail || null, scList: st.scList || [], fcsN: st.fcsN || 0, ew: st.ew || 0, mar: 0, dcon: st.dcon || 0, sink: st.sink || 0, idleMW: st.enIdle || 0, sinkMW: st.sinkMW || 0, magArm: st.magArm || 0, magEj: st.magEj || 0, magFr: (st.ammoCap || 0) * 1.1 / Math.max(1, st.tons || st.dry)};
}
export function specFromShip(s) {
  const st = s.st, cmd = (function(){ try { return effSkill(s, "cmd") } catch (e) { return 4 } })();
  return {real: 1, engCnt: st.engines || 0, name: s.name, ref: s.id, arm: st.armor, rails: st.rail, flak: st.flak, eng: Math.max(1, Math.min(6, st.engines)), L: st.L, tons: st.tons,
    F: s.air.F, B: s.air.B, sk: Math.max(3, Math.min(9, cmd || 4)), dmg: s.hullDmg || 0, spd: st.bspd || (shipSpeedTrue(s) > 0 ? shipSpeedTrue(s) * AU_M / 86400 / 1000 / (.2 * VMK) : (st.L < 1 ? 1.25 : 1)) /* единая скорость: как на карте, км/с */,
    lasers: st.lgun, laserCfg: st.lasList, miss: st.msl, missCfg: st.misList, railCfg: st.railList, flakCfg: st.flakList, gat: st.gat, gatCfg: st.gatList, fuel: s.fuel != null ? s.fuel : null, water: st.water || 0, dec: st.dec || 0, probe: st.probe || 0, tanker: st.tanker ? 1 : 0, fuelCap: st.fuelCap || 0, frate: (st.fuelRate || 0) * (function(){ try { return pilFuel(s) } catch (e) { return 1 } })(), fpa: (function(){ try { return fuelPerAU(s) } catch (e) { return 0 } })(), engT: st.engM || 0, pow: st.power || 0, hang: st.hangList || null, ammoCap: st.ammoCap || 0, energy: st.energyLeft != null ? st.energyLeft : (st.energy || 0), defl: st.defl, fq: st.fq, bq: st.bq, trail: st.trail || null, scList: st.scList||[], fcsN: st.fcsN||0, ew: st.ew||0, mar: st.mar||0, dcon: st.dcon||0, sink: st.sink||0, idleMW: st.enIdle||0, sinkMW: st.sinkMW||0, magArm: st.magArm||0, magEj: st.magEj||0, magFr: (st.ammoCap||0)*1.1/Math.max(1, st.tons||st.dry)};
}
export function removeShip(s) {
  for (const id of Object.values(s.crew || {})) { const o = officerById(id); if (o) o.where = null; }
  state.ships = state.ships.filter(x => x !== s);
  if (ui.sel.kind === 'ship' && ui.sel.id === s.id) ui.sel = {kind: 'body', id: 'earth'};
}
export function plunder() {
  const f = Math.min(0.5, 0.2 + 0.05 * state.raid.k), lost = [];
  for (const k of ['fe', 'co', 'ti', 'w', 'si', 'c', 'pt', 'ree', 'fuel', 'spares']) {
    const v = Math.floor((state.stock[k] || 0) * f); if (v > 0) { state.stock[k] -= v; rec(k, 'out', v, 'raid'); lost.push(`${v} ${k === 'fuel' ? 'топлива' : k === 'spares' ? 'тех. изд.' : RES[k] || k}`); }
  }
  log(`Налётчики разграбили Землю: потеряно ${Math.round(f * 100)}% запасов (${lost.slice(0, 4).join(', ')}…). Постройте боевые корабли и держите их на Земле.`);
}
export function nextRaid() {
  const r = state.raid; r.k++; r.eta = state.t + 90 + rnd() * 60; r.warned = false; r.active = false; state.inBattle = false;
  for (const s of state.ships) s.inB = false;
}
export function startRaid() {
  const r = state.raid, enemy = raidSpecs(r.k);
  const def = state.ships.filter(s => s.st.warship && s.at === 'earth' && !s.towedBy);
  const first = enemy.filter(e => !e.late), late = enemy.filter(e => e.late);
  r.active = true; def.forEach(s => { s.inB = true; });
  log(`⚔ Налёт на Землю! Первая волна: ${first.length} кораблей${late.length ? `, ещё ${late.length} подойдут через ~50 минут` : ''}. У вас в бою: ${def.length}. Подкрепление может прийти из любой точки — бой идёт на карте у Земли.`);
  Battle.begin({title: `Налёт №${r.k + 1}`, fleets: [def.map(specFromShip), first], late: late.map(spec => ({t: 3000, spec})), onEnd: res => applyRaid(res)});
  ui.bfollow = true; focusBattle();
}
// корабли, пришедшие на помощь во время боя, вступают в него; бой идёт в игровом времени
export function battleTick(h) {
  for (const s of state.ships) {
    if (s.inB || !s.st.warship || s.at !== 'earth' || s.towedBy) continue;
    s.inB = true; Battle.join(0, specFromShip(s), 1500);
    log(`«${s.name}» прибыл на помощь и вступил в бой!`);
  }
  Battle.tick(h * 86400);
  if (Battle.isDone()) Battle.finish();
}
export function applyRaid(res) {
  const lostNames = [];
  for (const r of res.mine) {
    const s = state.ships.find(x => x.id === r.ref); if (!s) continue;
    if (!r.alive) { lostNames.push(s.name); removeShip(s); } else { s.hullDmg = Math.max(s.hullDmg || 0, r.lost); if (r.fuel != null) s.fuel = Math.max(0, Math.min(s.fuel, r.fuel)); s.air = {F: r.F, B: r.B}; }
  }
  if (!res.enemyAlive) {
    const W = {dd: 1, fr: 1, hc: 3, cv: 3}; let w = 0; for (const c of res.enemyKilled) w += W[c] || 1;
    const loot = {fe: 180, co: 4, ti: 30, w: 2, si: 20, pt: .1, spares: 15};
    for (const [k, v] of Object.entries(loot)) { state.stock[k] = (state.stock[k] || 0) + v * w; rec(k, 'in', v * w, 'loot'); }
    const wk=(res.wrecks||0)*20;if(wk){state.stock.fe=(state.stock.fe||0)+wk;rec('fe','in',wk,'loot');state.stock.spares=(state.stock.spares||0)+(res.wrecks||0)*3;rec('spares','in',(res.wrecks||0)*3,'loot')}
    if(res.prizes&&res.prizes.length){const pz=res.prizes.length*60;state.stock.spares=(state.stock.spares||0)+pz;rec('spares','in',pz,'loot');log(`Захвачено кораблей экипажем: ${res.prizes.length} (разобраны на детали: +${pz} техизделий). Обломки собраны: железо +${wk}.`)}
    log(`Налёт отбит! Уничтожено кораблей противника: ${res.enemyKilled.length}. Трофеи: железо ${150 * w}, техизделия ${15 * w} и др.${lostNames.length ? ' Потеряны: ' + lostNames.join(', ') + '.' : ''}`);
  } else if (!res.mineAlive) {
    log(`Ваш флот разбит (${lostNames.join(', ')}).`); plunder();
  } else log(`Налётчики отступили. Потери: ${lostNames.length ? lostNames.join(', ') : 'нет'}. Повреждённые корабли чинятся на Земле.`);
  nextRaid();
}
export function raidTick(h) {
  const r = state.raid; if (!r) return;
  if (state.demo) return;
  for (const s of state.ships) {
    if (s.at !== 'earth' || !s.st.warship) continue;
    if (s.hullDmg > 0) s.hullDmg = Math.max(0, s.hullDmg - 0.1 * h);
    if (s.air.F < s.st.hangF || s.air.B < s.st.hangB) {
      s.airAcc += h * 2;
      while (s.airAcc >= 1) {
        if (s.air.F < s.st.hangF && state.stock.spares >= 1) { s.air.F++; state.stock.spares--; rec('spares', 'out', 1, 'spares'); }
        else if (s.air.B < s.st.hangB && state.stock.spares >= 4) { s.air.B++; state.stock.spares -= 4; rec('spares', 'out', 4, 'spares'); }
        else break;
        s.airAcc--;
      }
      if (s.air.F >= s.st.hangF && s.air.B >= s.st.hangB) s.airAcc = 0;
    }
  }
}
export function raidChip() {
  const r = state.raid; if (!r) return '';
  if (r.active) return `<span class="chip" style="border-color:var(--bad);color:var(--bad)"><b>⚔ Бой у Земли</b>${Math.floor(Battle.time() / 60)} мин</span>`;
  return '';
}
