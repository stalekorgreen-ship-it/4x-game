// @ts-nocheck
import { gd } from './00-gd.ts';
import { RES, compOf, dist, fmtN, log, mkKey, rec, specTons, fitSpec, CR_DEF, randCraft, craftById, craftStats, state, fuelPerAU, BAT_FUEL_T, shipSpeedTrue, AU_M } from './01-data.ts';
import { tm, ta } from './15-techs.ts';
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
const PLAN_T=8; // ИИ пересматривает желаемую скорость раз в 8 с (импульсами), а не каждый шаг — меньше дёрганья и расхода топлива
const LEAD=gd('battle','lead',{acc:.5,bracket:.8}); // упреждение: доля ускорения цели; вилка — доля возможного уклонения (0 — выкл)
const SALVO=gd('battle','salvo',{on:1,prep:6,fill:.9}); // залп флота: prep — с на подготовку, fill — доля радиуса уклонения, которую засеваем
const PASS=gd('battle','pass',{max:2,mm:300}); // после пробития снаряд выбивает 1 модуль + ещё 1 на каждые 300 мм остатка, не больше 2
const ARMZ=gd('battle','armor',{nose:35,side:5,rear:2}); // слоёв по 2 см стали: нос 70 см, борта 10 см, корма 4 см
const FUEL=gd('battle','fuel',{ve:9,rcsVe:3,cap:.6,keep:.12}); // топливо в бою: vₑ главных двигателей и маневровых (км/с), бак по умолчанию — доля массы
const BT=gd('battle','battle',{DOPT:{hc:20,dd:20,fr:35,cv:100},JINK:0.0015,VP:6,LIFE:10,SIGMA:0.026,LAUNCH:450,SUB:0.25,REL:60,FI:{vmax:2,a:0.25,fuel:1500,ammo:60,hp:8,gun:4},BO:{vmax:0.8,a:0.05,fuel:2200,hp:4},TORP:{sp:2.5,pd:0.02,pdr:35,launch:120,mod:2},FLAK:{range:60,blast:1.2},RC0:{dmg:1,vp:6,rng:60,shells:1,rel:1,fail:0,sig:1,cal:10},FC0:{blast:1.2,rng:60,rel:1,fail:0},GC0:{tw:0,rpm:6000,heat:.4,cool:.2,pen:.02,rng:15,ammoH:5,mass:25},LC0:{dmg:4,rng:250,chg:.08},MC0:{hp:2,spd:8,dmg:4,blast:6,ammo:4,rng:220,rel:.83},BURST:{5:1,10:1,15:1,20:1,25:1,30:1},RCT:{5:6,10:16,15:28,20:45,25:60,30:80},EW:{fr:.12,cv:.05,dd:.02,hc:.02},RADAR:{cv:420,hc:320,dd:260,fr:360},MARN:{cv:20,hc:10,dd:8,fr:4}});
const PMIN=BT.PMIN!=null?BT.PMIN:.08,DISP=BT.DISP!=null?BT.DISP:.0003,GDISP=BT.GDISP!=null?BT.GDISP:.002,DOPT=BT.DOPT,JINK=BT.JINK,VP=BT.VP,LIFE=BT.LIFE,RANGE=VP*LIFE,SIGMA=BT.SIGMA,LAUNCH=BT.LAUNCH,SUB=BT.SUB,REL=BT.REL;
const FI=BT.FI,BO=BT.BO,TORP=BT.TORP,FLAK=BT.FLAK,RC0=BT.RC0,FC0=BT.FC0,GC0=BT.GC0,LC0=BT.LC0,MC0=BT.MC0,BURST=BT.BURST,RCT=BT.RCT;
const ZN=['нос','правый борт','корма','левый борт'];
const BSPEEDS=[1,5,20,100,300];
let lasBeams=[],shuttles=[],hitLog=[],impacts=[],impN=0,frags=[],pyro=[],pods=[],lands=[],mis=[],beams=[],bursts=[],curCT=1,curST=0,ships,proj,fx,flights,air,torps,shots,fly,t,paused=false,speed=100,acc=0,stat,lastEng=-99,autoSlow=true,autoCam=true,sel=null,projMode=0,done=false,isOpen=false,cfgNow=null,bound=false,last=0;
let uidN=0,lastDmgT=0,lastNa=0,lastNaT=0,env=[],ORD={st:null,focus:null},nextVis=0,nextCrew=0,lastCrewT=0,endSaid=false;
const say=(side,key,s)=>{if(active&&!done)SFX.radio(side,key,s)};
const EW=BT.EW,RADAR=BT.RADAR,MARN=BT.MARN;
let pend=[],lastFriend=0,vw={ox:0,oy:0,kk:1},active=false;
const R=(a,b)=>a+Math.random()*(b-a);
const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=Math.random();return (u-2)*1.73};
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
function rangeP(s,o,V,p){let lo=.5,hi=300;for(let i=0;i<14;i++){const d=(lo+hi)/2,tf=d/Math.max(.1,V),e=DISP*d*2,w=Math.min(12,tf),dg=o.T&&o.rcsN>0?.5*(o.acc||5)*.12/1000*w*w:0,h=o.T?o.T.L*.11:.02;if(h/(e+dg+1e-6)>=p)lo=d;else hi=d}return lo}
function hitP(s,o,V,sig){const d=Math.hypot(o.x-s.x,o.y-s.y,(o.z||0)-(s.z||0)),tf=d/Math.max(.1,V+closing(s,o)),e=(V<2?GDISP:DISP)*d*2*(sig||1),w=Math.min(12,tf),
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
  sp={...sp,F0:sp.F||0,lasers:0,laserCfg:null,F:0,B:0,miss:0,missCfg:null}; // ракеты временно отключены (будут переделаны) // лазеры отключены; старые «звенья» истребителей заменены кораблями из ангара (join)
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
  const sh={acc:0,spin:0,trail:sp.trail||null,hv:[[0,1,4],[2,3,0]][side][(Math.random()*3)|0],fid:(()=>{const k=side*1e5+(sp.fid||0),n=FCNT.get(k)||0;FCNT.set(k,n+1);return (sp.fid||0)*100+Math.floor(n/FLEET_MAX)})(),side, /* флоты не больше FLEET_MAX кораблей: каждый десяток — свой флот со своим капитаном */cls:sp.cls,T,x,y,vx:0,vy:0,sx:0,sy:0,ax:0,ay:0,next:0,alive:true,nt:0,car:(sp.F+sp.B)>0,hd:side?Math.PI:0,zones,tur,core,total,aliveN:total,engN:T.eng,pool:{ammo:Math.round(((sp.fq&&sp.fq.ammo)||CR_DEF.F.ammo)*.5)*sp.F,torp:sp.B},nextL:0,spec:sp,mag:0,magMax:0,enR:1,z:0,bst:1,lrp:0,srp:0,crew:1,pers:Math.max(20,Math.round(T.tons/40*(sp.role==='freight'?.25:1))),evac:0,abd:0,ldT:0,mor:Math.min(.95,Math.max(.3,.42+.05*(sp.sk||5.5)+R(-.05,.05))),st:'ok',fire:[0,0,0,0],heat:0,ovh:0,hitT:-99,flash:-99,seen:[-99,-99],lock:[-99,-99],rdOn:false,fine:false,trk:[],sc:sp.scList||[{k:'ir',rng:(RADAR[sp.cls]||280)*.8,res:.6},{k:'em',rng:RADAR[sp.cls]||280,res:.6},{k:'rad',rng:(RADAR[sp.cls]||280)*.9,res:1,fine:1}],ch:sp.fcsN!=null?sp.fcsN:({cv:4,hc:8,dd:3,fr:4}[sp.cls]||3),jam:0,blk:0,reps:0,bdo:0,board:null,rad:sp.radar!=null?70+110*Math.min(3,sp.radar):(RADAR[sp.cls]||280),mar:sp.mar!=null?sp.mar:(sp.role==='freight'?0:((sp.mar!=null?sp.mar:MARN[sp.cls])||0))};
  if(side===0&&sh.ch>0)sh.ch+=ta('fcs');
  sh.acc=accOf(sp,T);sh.raider=sh.acc>=20&&T.tons<=500&&!sp.role; // лёгкий и резвый — перехватчик: кавалерийские наскоки
  {const cons=(sp.rails||0)*2+(sp.gat||0)*5,mx=sp.ammoCap!=null?sp.ammoCap:sp.role==='supply'?Math.round(T.tons*.2):Math.round(cons*1.2);sh.mag=sh.magMax=mx;if(sp.fuel!=null&&sp.fuelCap>0){sh.fuel=sp.fuel;sh.fuelCap=sp.fuelCap;sh.fpa=sp.fpa||T.tons;sh.frate=sp.frate!=null?sp.frate:sp.fuelCap*4.2e-9}else{sh.fuelCap=Math.round(T.tons*FUEL.cap);sh.fuel=sh.fuelCap;sh.fpa=T.tons;sh.frate=sh.fuelCap*4.2e-9} // у налётчиков бак по умолчанию
  if(cfgNow&&cfgNow.demo&&sh.fuelCap<T.tons*FUEL.cap){sh.fuelCap=Math.round(T.tons*FUEL.cap);sh.fuel=sh.fuelCap} // демо-флоты: полный бак (доля массы из battle.json → fuel.cap)
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
  {const ar=Math.min(3,Math.floor(T.arm/3));for(const z of zones)for(const m of z.mods){if('TALMRDG'.includes(m.k))m.ar=ar;if(m.k==='T')m.am=70;else if(m.k==='A')m.am=50}} // у внешних модулей своя броня, у орудий — боезапас
  const cand=[];for(const z of zones)for(const m of z.mods)if(m.k!=='C')cand.push(m);
  const kill=Math.floor((sp.dmg||0)*(total-1));
  for(let i=0;i<kill&&cand.length;i++){const m=cand.splice((Math.random()*cand.length)|0,1)[0];m.alive=false;sh.aliveN--;if(m.k==='E')sh.engN--;else if(m.k==='R')sh.rcsN--;else if(m.k==='D')sh.radN--}
  return sh;
}
const FORMS=['wedge','claw','x','sphere'];
// тепло (таблица «Корабли (система)»): теплоёмкость корпуса 0,5 МДж на т на °C; s.heat = °C выше нормы / 100 (выше +100 °C — сбои)
function addHeat(s,MJ){const T=Math.max(1,(s.T&&s.T.tons)||(s.spec&&s.spec.tons)||1000);s.heat=Math.max(0,s.heat+MJ/(.5*T)/100)}
function mdead(s,m){if(!m.alive)return;m.alive=false;s.aliveN--;if(m.k==='E')s.engN--;else if(m.k==='R')s.rcsN--;else if(m.k==='D')s.radN--}
function mrev(s,m){m.alive=true;s.aliveN++;if(m.k==='E')s.engN++;else if(m.k==='R')s.rcsN++;else if(m.k==='D')s.radN++}
function addFlights(sh,ty,total){
  const q=sh.spec[ty==='F'?'fq':'bq'],D=CR_DEF[ty],P=Object.assign({},ty==='F'?FI:BO);{const g=k=>q&&Number.isFinite(q[k])?q[k]:D[k];P.hp=g('hp');P.vmax=g('vmax');P.a=g('a');P.fuel=g('fuel');P.ammo=g('ammo');P.ng=g('ng');P.dmg=g('dmg');P.cd=g('cd');P.gun=g('gun')||P.gun;P.mass=g('mass');P.trail=q&&q.trail||null;P.eng=q&&q.eng||2;P.arm=q&&q.arm||0;P.mk=ty==='F'?P.eng+'-'+(P.ng||2)+'-'+Math.min(8,Math.round(P.arm/2))+'-'+(P.fuel>1500?1:0):''}
  const per=ty==='F'?10:5,nfl=Math.ceil(total/per);let left=total;const f0=(sh.uid||0)%4;
  for(let f=0;f<nfl;f++){const n=Math.min(per,left);left-=n;
    const fl={side:sh.side,type:ty,home:sh,cr:[],mode:'bay',svc:0,t0:0,leader:null,lane:(f-(nfl-1)/2)*(ty==='F'?18:30),form:ty==='F'?FORMS[(f+f0)%4]:'wedge',a0:Math.random()*6.283,lost:0,broken:false};
    for(let k=0;k<n;k++){const c={side:sh.side,type:ty,fl,home:sh,own:sh,x:sh.x,y:sh.y,vx:0,vy:0,h:sh.side?Math.PI:0,P,hp:P.hp,ammo:ty==='F'?P.ammo:1,fuel:P.fuel,
      ms:sh.spec.fmis&&ty==='F'?sh.spec.fmis.n:0,mk:sh.spec.fmis&&sh.spec.fmis.k,state:'bay',launched:false,launchAt:0,ret:false,cd:R(0,.5),jx:0,jy:0,jt:0,tg:null,goal:null,sh:null,slot:k,eng:-99,tr:[],trT:0,na:0};fl.cr.push(c);air.push(c)}
    flights.push(fl)}
}
function launchBay(s){ // выпуск одного корабля из ангара: сбоку от носителя, с его скоростью, в его флоте
  const cs={...s.bay.shift(),fid:s.fid};fitSpec(cs);cs.cls=classify(cs);cs.dopt=cs.dopt0||DOPT[cs.cls];
  const a=s.hd+(Math.random()<.5?1:-1)*Math.PI/2,off=s.T.L*.6+.05,c=mkShip(s.side,cs,s.x+Math.cos(a)*off,s.y+Math.sin(a)*off);
  c.hd=s.hd;c.sx=s.sx+Math.cos(a)*.02;c.sy=s.sy+Math.sin(a)*.02;c.z=s.z;c.zset=1;c.bayOf=s;c.F=s.F;c.slotBack=s.slotBack||0;c.slotLat=s.slotLat||0;ships.push(c);s.bayT=t+3;stat.launch=(stat.launch||0)+1}
function reset(cfg){
  tracers.length=0;shuttles=[];lasBeams=[];hadContact=false;hitLog=[];impacts=[];sepT=0;lastDmgT=0;lastNa=0;lastNaT=0;frags=[];pyro=[];pods=[];lands=[];ships=[];FL=new Map();GR=[new Map(),new Map()];smoke=[];proj=[];mis=[];beams=[];bursts=[];fx=[];flights=[];air=[];torps=[];shots=[];fly=[[],[]];t=0;lastEng=-99;nextVis=0;nextCrew=0;lastCrewT=0;endSaid=false;ORD={st:null,focus:null};env=[];CMDS=[{},{}];FCNT=new Map();
  if(cfg.envList)for(const e of cfg.envList)env.push(Object.assign({vx:0,vy:0,ttl:1e9},e));
  if(!cfg.envList&&cfg.env!==false&&(cfg.env||Math.random()<.55)){const cl=1+((Math.random()*2)|0);for(let c=0;c<cl;c++){const cx0=R(-220,220),cy0=R(-200,200),n=4+((Math.random()*8)|0);for(let i=0;i<n;i++)env.push({t:'rock',x:cx0+R(-70,70),y:cy0+R(-60,60),r:R(.6,3),vx:0,vy:0,ttl:1e9})}
    if(Math.random()<.35)env.push({t:'planet',x:R(-120,120),y:(Math.random()<.5?-1:1)*R(120,230),r:R(10,22),vx:0,vy:0,ttl:1e9})}
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
const hpf=s=>s.aliveN/s.total,PW=12; // PW: ширина воронки в колонках на единицу урона
const val=s=>s.T.role==='freight'||s.T.role==='supply'?.6:(VAL[s.cls]||1);
// ===== командир стороны: раз в CMD.period с решает план — собраться в кулак, охватить врага 2–5 группами, отойти =====
const CMD=gd('battle','command',{period:30,minGroup:6,fleetMax:10});let CMDS=[{},{}],FCNT=new Map();const FLEET_MAX=CMD.fleetMax;
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
    for(const k in S)S[k]*=.85+Math.random()*.3;if(P0.k&&S[P0.k]>0&&t-(m.at||0)<60&&!(C.bad[fid]&&C.bad[fid][P0.k]>t))S[P0.k]+=10;else if(P0.k&&S[P0.k])S[P0.k]*=1.25;
    let k='wall';for(const q in S)if(S[q]>S[k])k=q;
    const fire=k==='flank'||k==='pass'?'eng':ratio>1.3?'weak':'',plan={k,stance:k,fire,...(k==='flank'?{flank:Math.sign(edge||1)*(1+Math.abs(edge)*.6),env:1}:{})};
    if(P0.k!==k){m.at=t}C.plans[fid]=plan;sum[NM[k]]=(sum[NM[k]]||0)+1});
  stat.plan=stat.plan||['',''];const txt=Object.entries(sum).map(([a,b])=>b>1?a+' ×'+b:a).join(', ');if(txt!==stat.plan[sd]){stat.plan[sd]=txt;if(typeof log==='function'&&!(cfgNow&&cfgNow.bg))try{log(['Синие','Красные'][sd]+': '+txt+'.')}catch(e){}}}
function fleetsUpdate(){
  for(const F of FL.values()){F.ships=[];F.lrp=0;F.srp=0;F.lrR=0;F.n=0;F.cx=0;F.cy=0;F.str=0;F.fr=0}
  for(const s of ships){if(!s.alive)continue;const key=s.side*1000+s.fid;let F=FL.get(key);
    if(!F){F={ships:[],n:0,cx:0,cy:0,str:0,fr:0,key,side:s.side,fid:s.fid,next:0,stance:'engage',until:0,flank:Math.random()<.4?(Math.random()<.5?1:-1)*R(.7,1.2):0,tgt:null,focus:null,gx:s.x,gy:s.y,dx:-s.x/(Math.hypot(s.x,s.y)||1),dy:-s.y/(Math.hypot(s.x,s.y)||1),slotsAt:-99,rng:40,lrp:0,srp:0,lrR:0,zl:(((s.side*3+s.fid)%3)-1)*14,wait0:-1,born:t};FL.set(key,F)}
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
    for(const o of cand){const sc=val(o)*(1.4-hpf(o))/(1+Math.hypot(o.x-F.cx,o.y-F.cy)/100);if(sc>fs){fs=sc;fb=o}}F.focus=fb;
    if(SALVO.on&&(!F.sv||t>F.sv.tA+4||!F.sv.o.alive)){const o=F.focus;F.sv=null;if(o&&o.alive){let mx=0,N=0;for(const q of F.ships){if(!q.alive)continue;const nr=q.tur.filter(m=>m.alive&&m.k==='T').length;if(!nr)continue;const d=Math.hypot(o.x-q.x,o.y-q.y,(o.z||0)-(q.z||0)),v=(q.tur.find(m=>m.k==='T').cfg.vp||VP);if(d>effR(q,o,v))continue;mx=Math.max(mx,d/v);N+=nr*8}
      if(N>=4)F.sv={o,tA:t+mx+SALVO.prep,N,k:0}}} // залп флота: все снаряды приходят в одну секунду, каждый в свою точку круга, куда цель может увернутьсяif(F.side===0&&ORD.focus&&ORD.focus.alive)F.focus=ORD.focus;
    // точка сбора флота и направление строя
    let dx=bf.cx-F.cx,dy=bf.cy-F.cy;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
    if(F.stance==='flank'){const a=F.env?F.flank:F.flank*Math.min(1,Math.max(0,(dist-F.rng*2)/160)),c=Math.cos(a),s2=Math.sin(a);[dx,dy]=[dx*c-dy*s2,dx*s2+dy*c]}
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
function steer(s,dt){
  const T=s.T,F=s.F,eng=Math.max(.15,s.engN/T.eng)*(t<s.blk?.2:1),hp=hpf(s);let vm=.2*VMK*T.spd,boost=1;s.raidV=0;if(s.st==='surr'||T.role==='station')vm=0;
  if(t>=s.nt||(s.tg&&!s.tg.alive))retarget(s);
  if(t>=s.next){s.next=t+R(6,14);s.sdir=Math.random()<.5?1:-1}
  const tg=s.tg;let vx=0,vy=0,want=s.hd;
  const formed=F.formed!==false&&F.n>=3&&!(t<s.bdo),retreating=F.stance==='retreat'&&!F.convoy,flee=(hp<.35&&!T.role)||(F.stance==='cover'&&hp<.45&&!T.role)||(retreating&&!formed)||s.st==='panic'||(s.dry&&!T.role),tdx=tg?tg.x-s.x:F.dx,tdy=tg?tg.y-s.y:F.dy,td=Math.hypot(tdx,tdy)||1,ux=tdx/td,uy=tdy/td;
  s.flee=flee;
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
  if(flee&&tg&&!hold){s.br='flee';vx=-ux*vm;vy=-uy*vm;want=Math.atan2(-uy,-ux);if(td<120)boost=1.5}
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
    if(tg&&tg.maxR&&tg.maxR>s.maxR*1.05&&F.stance!=='kite')dopt=Math.min(dopt,Math.max(8,s.maxR*.4));if(tg&&F.stance!=='kite'){const vp=(s.tur.find(m=>m.alive&&m.k==='T')||{cfg:{}}).cfg.vp||VP;dopt=Math.min(dopt,Math.max(1.5,rangeP(s,tg,vp,PMIN*2)*.85))} // идём на дистанцию, где орудия реально попадают (шанс ≥ 2×порога) // враг бьёт дальше — сближаемся, а не пятимся
    if(T.role==='supply'){const n=Math.max(1,F.n),cx=F.gx,cy=F.gy;let dx=F.dx||0,dy=F.dy||0;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;const bx=cx-dx*(60+n*3),by=cy-dy*(60+n*3),ex2=bx-s.x,ey2=by-s.y,ed2=Math.hypot(ex2,ey2)||1,v2=Math.min(sp,ed2*.1);vx=ex2/ed2*v2;vy=ey2/ed2*v2}
    else if(T.role==='freight'||F.stance==='convoy'&&T.role){vx=fvx;vy=fvy}
    else if(tg&&s.raider&&(!s.fuelCap||s.fuel/s.fuelCap>.6)&&td<Math.max(er*3,150)){ // перехватчик: разгон мимо цели на сближении (дальность и пробитие растут с относительной скоростью), проскок, отход, разворот
      const cl=closing(s,tg);if(!s.rd)s.rd='in';
      if(s.rd==='in'&&cl<0&&td>Math.max(3,tg.T.L*3))s.rd='out';
      else if(s.rd==='out'&&td>Math.max(40,s.maxR*.8))s.rd='in';
      if(s.rd==='in'){const sd=s.uid%2?1:-1,off=Math.max(1.5,tg.T.L*2),ax=tg.x-uy*off*sd-s.x,ay=tg.y+ux*off*sd-s.y,al=Math.hypot(ax,ay)||1;vx=ax/al*vm*3;vy=ay/al*vm*3;want=Math.atan2(ay,ax)}
      else{const sp=Math.hypot(s.sx,s.sy)||1;vx=(s.sx/sp-ux*.3)*vm*3;vy=(s.sy/sp-uy*.3)*vm*3;want=Math.atan2(vy,vx)}
      boost=1.4;s.raidV=1}
    else if(tg&&(td<er*1.5||t<s.bdo)){s.br='combat';
      const dd=td-dopt,bnd=Math.max(10,dopt*.5),k=(Math.abs(dd)<bnd?0:Math.max(-1,Math.min(1,(dd-Math.sign(dd)*bnd)/20)))*Math.min(1,Math.abs(dd)/Math.max(1e-3,vm*240)), /* в полосе дистанции не дёргаемся; к цели — со скоростью, чтобы дойти за ~4 мин, а не на форсаже */lat=0,w=F.n>=2&&F.stance!=='assault'?.75:formed?.93:F.stance==='kite'?.15:s.cls==='hc'||s.cls==='cv'?.55:.25; /* в группе дистанцию держит вся группа, а не каждый корабль сам — без рывков между целями */
      let rx=ux*vm*k*.85-uy*lat,ry=uy*vm*k*.85+ux*lat;want=Math.atan2(uy,ux)+(td<er*.9?(s.pOff||0):0);
      
      vx=w*fvx+(1-w)*rx;vy=w*fvy+(1-w)*ry;if(retreating)want=Math.atan2(vy,vx);
      if(F.stance==='assault'&&td>s.maxR*.7)boost=Math.max(boost,1.7);
      else if(F.stance==='kite'&&td<F.hold*.6)boost=Math.max(boost,1.4);
    }else{s.br='form';vx=fvx;vy=fvy;if(retreating&&sp>.02)want=Math.atan2(vy,vx);else if(tg)want=Math.atan2(uy,ux);else if(sp>.02&&ed>6)want=Math.atan2(vy,vx);else if(F.dx!=null&&(F.dx||F.dy))want=Math.atan2(F.dy,F.dx);
      if(F.stance==='assault'&&tg)boost=Math.max(boost,1.5)}
  }
  if(env.length)for(const e of env){const dx=s.x-e.x,dy=s.y-e.y,rr=e.r+T.L*.25+(e.t==='wreck'?1:8); /* обломки мелкие — их замечают поздно */if(dx>rr||dx<-rr||dy>rr||dy<-rr)continue;const d=Math.hypot(dx,dy)||1;if(d<rr){const f=Math.max(vm,.1)*(1-d/rr)*1.6;vx+=dx/d*f;vy+=dy/d*f;
    if(d<e.r+T.L*.2&&t>(s.rockT||0)){s.rockT=t+4;s.sx*=.4;s.sy*=.4;stat.rock++;hitShip(s,'rock',-dx,-dy,s.x,s.y,5);say(s.side,'rock',s)}}}
  // разлёт: не стоять друг за другом на линии огня и не кучковаться
  for(const o of around(s.side,s.x,s.y,6,20)){if(o===s)continue;const dx=s.x-o.x,dy=s.y-o.y,dz=s.z-o.z,d0=Math.hypot(dx,dy)||1e-6,sr=Math.max(.9,(s.T.L+o.T.L)*1.1),d=Math.hypot(d0,dz*1.5);
    if(d<sr){const f=.2*(sr-d)/sr/d;vx+=dx*f;vy+=dy*f;s.zpush=(s.zpush||0)+(dz>=0?1:-1)*(sr-d)/sr*(1+Math.abs(dz)*0)}
    if(Math.abs(dz)>sr*.8)continue;
    if(tg&&!formed){const al=(-dx)*ux+(-dy)*uy,pp=(-dx)*(-uy)+(-dy)*ux; // o перед нами на линии на врага
      if(al>0&&Math.abs(pp)<o.T.L*.5+.8){const sg=pp>=0?-1:1,f=.12*vm*(1-Math.abs(pp)/(o.T.L*.5+.8));vx+=-uy*sg*f*3;vy+=ux*sg*f*3}}}
  {const kf=Math.min(1,dt*.35);s.dvx=s.dvx==null?vx:s.dvx+(vx-s.dvx)*kf;s.dvy=s.dvy==null?vy:s.dvy+(vy-s.dvy)*kf;vx=s.dvx;vy=s.dvy}
  // скорость вперёд больше, назад и вбок — меньше
  const c=Math.cos(s.hd),sn=Math.sin(s.hd);let fw=vx*c+vy*sn,lt=-vx*sn+vy*c;if(fw<0)fw*=.5;lt*=.6;vx=fw*c-lt*sn;vy=fw*sn+lt*c;
  if(s.ovh)boost=Math.min(boost,1.1); // тепло химического двигателя уходит с выхлопом
  // поломка двигателя при форсаже: чем сильнее ускорение, тем выше шанс
  if(boost>1.02&&s.engN>0&&Math.random()<.00006*(1+3*(boost-1))*dt*s.engN){
    const em=[];for(const z of s.zones)for(const m of z.mods)if(m.k==='E'&&m.alive)em.push(m);
    if(em.length){const m=em[(Math.random()*em.length)|0];m.alive=false;s.aliveN--;s.engN--;stat.bfail[s.side]++;fx.push({x:s.x,y:s.y,t0:t,d:5,r:1.2});boost=1}}
  s.bst+=(boost-s.bst)*Math.min(1,dt*.8);boost=s.bst;
  if(tg&&!flee&&!T.role){ // тактики строя на уровне корабля
    const ddx=vx-s.sx,ddy=vy-s.sy,ddl=Math.hypot(ddx,ddy),far=td>(s.effR||40)*1.3,mv=F.stance!=='drift'&&F.stance!=='pass';
    if(far&&ddl>.05&&mv)want=Math.atan2(ddy,ddx); /* далеко и нужен разгон/торможение — разворот к нужному импульсу и тяга главным */
    else if(F.stance!=='retreat'&&F.stance!=='drift'&&F.stance!=='pass'&&F.stance!=='kite')want=Math.atan2(uy,ux); // нос (70 см брони) строго к врагу — во всех боевых тактиках, без разворота бортом ради башен
    else if(F.stance==='drift'){vx=s.sx/Math.max(eng,.05);vy=s.sy/Math.max(eng,.05);want=Math.atan2(uy,ux)} // по инерции: двигатели молчат, только поворот носом
    else if(F.stance==='pass'&&F.tgx!=null){const px=F.tgx-s.x,py=F.tgy-s.y,pl=Math.hypot(px,py)||1;vx=px/pl*vm*1.3;vy=py/pl*vm*1.3;want=Math.atan2(uy,ux)}}
  // экономия топлива: скорость не выше четверти оставшегося запаса Δv (чтобы хватило затормозить и маневрировать), форсаж — только при полбака и больше
  if(s.fuelCap){const m0=dryM(s),dvr=FUEL.ve*Math.log((m0+s.fuel)/m0),fq=s.fuel/s.fuelCap;if(fq<.5){boost=Math.min(boost,1);s.bst=Math.min(s.bst,1)}vm=Math.min(vm,Math.max(.02,dvr*FUEL.keep))}
  vm*=boost*(s.raidV?2.5:1);if(s.fuelCap){const m0=dryM(s);vm=Math.min(vm,Math.max(.02,FUEL.ve*Math.log((m0+s.fuel)/m0)*FUEL.keep*1.5))}const vl=Math.hypot(vx,vy);if(vl>vm){vx*=vm/vl;vy*=vm/vl}
  // инерция: ускорение ограничено тягой и массой
  const a=(s.fuelCap&&s.fuel<=0?0:1)*s.acc/1000*eng*dt*(1+(boost-1)*.5),_pl=(t>=(s.vPT||0)||s.dg&&t<s.dgT||flee)?(s.vPT=t+PLAN_T,s.vTx=vx,s.vTy=vy,1):0,dvx0=s.vTx*eng-s.sx,dvy0=s.vTy*eng-s.sy,dl0=Math.hypot(dvx0,dvy0),fq=s.fuelCap?s.fuel/s.fuelCap:1,db=fq<.25?.1:.05,coast=dl0<Math.hypot(s.sx,s.sy)*.2&&(dvx0*s.sx+dvy0*s.sy)<=0===false&&Math.hypot(vx*eng,vy*eng)>Math.hypot(s.sx,s.sy)*.8&&Math.hypot(vx*eng,vy*eng)<Math.hypot(s.sx,s.sy)*1.25&&(vx*s.sx+vy*s.sy)>.97*Math.hypot(vx,vy)*Math.hypot(s.sx,s.sy),dvx=dl0<db||coast?0:dvx0,dvy=dl0<db||coast?0:dvy0,dl=dl0<db||coast?0:dl0; /* coast — идём почти куда надо и почти с нужной скоростью: летим по инерции */ /* мёртвая зона по скорости: мелкие поправки не стоят топлива; при пустеющем баке — шире */
  if(t>=(s.dgN||0)){s.dgN=t+1;if(!(s.dg&&t<s.dgT))s.dg=null;if(s.rcsN>0&&s.sc&&s.sc.length&&(!s.fuelCap||s.fuel/s.fuelCap>.4)){ /* уклоняемся, только пока в баке больше 40% */let best=1e9; // уклонение: снаряд, который через ≤12 с пройдёт через корабль, — маневровыми вбок от его пути
      const hr=s.T.L*.6+.05;for(const p of proj){if(p.side===s.side||p.g)continue;const rx=s.x-p.x,ry=s.y-p.y;if(rx*rx+ry*ry>3600)continue;const wx=p.vx-s.sx,wy=p.vy-s.sy,w2=wx*wx+wy*wy||1e-9,tc=(rx*wx+ry*wy)/w2;if(tc<0||tc>12||tc>=best)continue;
        const mx=rx-wx*tc,my=ry-wy*tc,md=Math.hypot(mx,my);if(md>hr)continue;best=tc;const wl=Math.sqrt(w2);s.dg=md>1e-4?{x:mx/md,y:my/md}:{x:-wy/wl,y:wx/wl};s.dgU=0;s.dgT=t+Math.min(4,tc+1);s.dgV=Math.max(0,hr*1.3-md)/Math.max(1,tc)} /* ровно столько боковой скорости, чтобы снаряд прошёл мимо */
      if(best<1e9)stat.dodge=(stat.dodge||0)+1}}
  { // тяга только по оси корабля: вперёд — полная, назад — 35%, боком — 12% (маневровые); скорость сохраняется по инерции
    const ch=Math.cos(s.hd),sh=Math.sin(s.hd);let df=dvx*ch+dvy*sh,dlt=-dvx*sh+dvy*ch;
    {const dl2=Math.hypot(df,dlt);if(dl2>1e-9&&Math.abs(df/dl2)<.97&&!(s.dg&&t<s.dgT))df=0;} /* главный двигатель включается, только если нужный импульс почти вдоль оси (±45°): иначе тяга уходит вбок впустую */df=Math.max(-a*.35,Math.min(a,df));{const lf=a*.12*(s.rcs0?.25+.75*s.rcsN/s.rcs0:1);dlt=Math.max(-lf,Math.min(lf,dlt));if(s.dg&&t<s.dgT&&(s.dgU||0)<(s.dgV||0)){const lt2=-s.dg.x*sh+s.dg.y*ch,need=(s.dgV||0)-(s.dgU||0),dd=Math.min(lf,need);dlt=dd*(lt2>=0?1:-1);s.dgU=(s.dgU||0)+dd} /* уклонение — только маневровыми и только на нужную величину */}
    {const ax0=(df*ch-dlt*sh)/Math.max(dt,1e-3),ay0=(df*sh+dlt*ch)/Math.max(dt,1e-3);s.aex=(s.aex||0)*.7+ax0*.3;s.aey=(s.aey||0)*.7+ay0*.3}s.sx+=df*ch-dlt*sh;s.sy+=df*sh+dlt*ch;s.dvSum=(s.dvSum||0)+Math.hypot(df,dlt);s.dvF=(s.dvF||0)+Math.abs(df);s.dvL=(s.dvL||0)+Math.abs(dlt);{const kk=s.holdK||(flee?'бегство':s.tg?'бой':'строй');(stat.dvK=stat.dvK||{})[kk]=(stat.dvK[kk]||0)+Math.hypot(df,dlt)}if(s.fuelCap){s.bst=boost;{const lv=a>0?Math.min(1,Math.hypot(df,dlt)/a)*(1+(boost-1)*1.2):0;{const bt=(dryM(s)+s.fuel)*Math.hypot(df,dlt)/FUEL.ve;s.fuel=Math.max(0,s.fuel-bt);stat.mainT=(stat.mainT||0)+bt}void lv /* ракетное уравнение: каждый км/с изменения скорости сжигает топливо, m·Δv/vₑ */}if(s.fuel<=0&&!s.dryFuel){s.dryFuel=1;stat.dryFuel=(stat.dryFuel||0)+1;say(s.side,'eng',s)}}}
  s.x+=s.sx*dt;s.y+=s.sy*dt;
  if(env.length)for(const e of env){const dx=s.x-e.x,dy=s.y-e.y,rr=e.r+s.T.L*.3;if(dx>rr||dx<-rr||dy>rr||dy<-rr)continue;const d=Math.hypot(dx,dy)||1;if(d<rr){const nx=dx/d,ny=dy/d;s.x=e.x+nx*rr;s.y=e.y+ny*rr;const vn=(s.sx-(e.vx||0))*nx+(s.sy-(e.vy||0))*ny; // твёрдое тело: выталкиваем из камня и отражаем скорость
    if(vn<0){s.sx-=1.4*vn*nx;s.sy-=1.4*vn*ny;if(-vn>.04&&t>(s.rockT2||0)){s.rockT2=t+1.5;stat.rock++;hitShip(s,'rock',-dx,-dy,s.x,s.y,Math.min(12,(e.t==='wreck'?4:2)+(-vn)*(e.t==='wreck'?25:10)))}}}}
  const rcsF=s.rcs0?.15+.85*s.rcsN/s.rcs0:1,turn=(.5/(1+Math.pow(T.L/.4,1.7)))*dt*rcsF;s.trn=Math.max(-1,Math.min(1,adiff(s.hd,want)*3))*(s.rcsN>0?1:0); // без маневровых корабль почти не вертится // 1 км — около минуты на разворот, 4 км — минуты
  { // разворот физикой: маневровые F = 0,4 МН·∛(т/1000), плечо 0,37·L, I = M·L²/12 → α; тяжёлые корабли разворачиваются минутами
    const tons=Math.max(1,T.tons||1),Lm=Math.max(5,T.L*1000),Fr=(T.rcsMN?T.rcsMN*1e6:4e5*Math.cbrt(tons/1000))*rcsF*(s.rcsN>0?1:0),al=Fr*.37*Lm/(tons*1000*Lm*Lm/12),d=adiff(s.hd,want),wt=Math.abs(d)<.035?0:Math.sign(d)*Math.sqrt(2*al*Math.abs(d))*.9; /* мёртвая зона 2°: не дёргаем маневровые по мелочи */
    s.w=s.w||0;const dw=al*dt;if(s.fuelCap&&s.fuel<=0){s.hd+=s.w*dt;void turn}else{const dW=Math.max(-dw,Math.min(dw,wt-s.w));s.w+=dW;if(s.fuelCap&&al>0){const bt=Fr*(Math.abs(dW)/al)/(FUEL.rcsVe*1000)/1000;s.fuel=Math.max(0,s.fuel-bt);stat.rcsT=(stat.rcsT||0)+bt;stat.rcsN=(stat.rcsN||0)+1} /* маневровые тоже жгут топливо: ṁ = F/vₑ */if(Math.abs(d)<1e-3&&Math.abs(s.w)<dw)s.w=0;s.hd+=s.w*dt;void turn} }
  if(s.spin){s.hd+=s.spin*dt;const L=Math.max(10,s.T.L*1000),dry=s.fuelCap&&s.fuel<=0,al=s.rcsN>0&&!dry?.72*s.acc/L*(s.rcs0?s.rcsN/s.rcs0:1)*(s.dg&&t<s.dgT?.5:1):0,dd=al*dt; // маневровые гасят вращение: α = 6·F·(L/2)/(M·L²/12), F = 12% тяги
    const f=al>0?Math.min(1,Math.abs(s.spin)/dd):0;s.spin=Math.abs(s.spin)<=dd?0:s.spin-Math.sign(s.spin)*dd;if(s.fuelCap&&f)s.fuel=Math.max(0,s.fuel-(s.frate||0)*(.12*f)*(.12*f)*dt*BAT_FUEL_T)}
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
      if(!fl.broken&&lost>1&&Math.random()<.015*lost*lost){fl.broken=true;stat.broke=(stat.broke||0)+1}} // чем больше потерь, тем вероятнее развал строя
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
function fireAt(sx,sy,sz,src,m,side,e,V,p,cd,max,dmg){
  // V — скорость пули относительно ствола; к ней прибавляется скорость стрелка (Галилей): упреждение считаем в системе стрелка
  const vOf=o=>o?(o.T?[o.sx||0,o.sy||0,o.vz||0]:[o.vx!=null?o.vx:(o.sx||0),o.vy!=null?o.vy:(o.sy||0),0]):[0,0,0]; // у корабля vx/vy — желаемая скорость ИИ, настоящая — sx/sy (+ вертикальная vz)
  const [svx,svy,svz]=vOf(src),[ex0,ey0,ez0]=vOf(e),evx=ex0-svx,evy=ey0-svy,evz=ez0-svz,ez=e.z||0;let T=Math.hypot(e.x-sx,e.y-sy,ez-sz)/V;
  for(let i=0;i<4;i++){const px=e.x+evx*T,py=e.y+evy*T,pz=ez+evz*T;T=Math.hypot(px-sx,py-sy,pz-sz)/V}
  const px=e.x+evx*T,py=e.y+evy*T,pzL=ez+evz*T,d=Math.max(.3,Math.hypot(px-sx,py-sy,pzL-sz)),sig=(V<2?GDISP:DISP)*(1+2*Math.max(0,.6-p)); // разброс ствола (нагрев и навык через p)
  const sg2=sig,dh=Math.hypot(px-sx,py-sy),an=Math.atan2(py-sy,px-sx)+gauss()*sg2,el=Math.atan2(pzL-sz,dh)+gauss()*sg2,vx=Math.cos(an)*Math.cos(el)*V,vy=Math.sin(an)*Math.cos(el)*V,vz=Math.sin(el)*V;
  let VX=vx,VY=vy,VZ=vz;{const mo=MUZ&&src&&src.T?MUZ(src,m,vx,vy,vz):null;if(mo){const T2=d/V,ax=sx+vx*T2-(sx+mo.x),ay=sy+vy*T2-(sy+mo.y),az=sz+vz*T2-(sz+mo.z),l=Math.hypot(ax,ay,az)||1;VX=ax/l*V;VY=ay/l*V;VZ=az/l*V;sx+=mo.x;sy+=mo.y;sz+=mo.z}} // из ствола в ту же точку упреждения
  VX+=svx;VY+=svy;VZ+=svz;const VA=Math.hypot(VX,VY,VZ);
  proj.push({x:sx,y:sy,z:sz,vz:VZ,vx:VX,vy:VY,side,dist:0,dmg:dmg!=null?dmg:.02*cd,cd,max:Math.hypot(VX,VY)*20,src,m,ev:Math.random(),o0:{x:sx,y:sy,z:sz}}); // живёт 20 с
  if(src){src.rt=performance.now()}}
function shoot(c,e,p,dm){fireAt(c.x,c.y,c.z||0,c,null,c.side,e,GV,p,dm||1,600);proj[proj.length-1].g=1} // у истребителя тот же миниган, что у кораблей
function craftStep(c,d){
  const P=c.P,home=c.home;
  if(c.type==='F'&&mis.length&&t>(c.pd||0)){let q=null,bd=200;for(const m of mis){if(m.side===c.side)continue;const dd=(m.x-c.x)*(m.x-c.x)+(m.y-c.y)*(m.y-c.y);if(dd<bd){bd=dd;q=m}}
    if(q){c.pd=t+1;shots.push({x1:c.x,y1:c.y,x2:q.x,y2:q.y,rt:performance.now(),s:c.side,a:c,b:q});if(Math.random()<.22)hurtMis(q,1)}}
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
    else{const closing=(dx*(c.vx-e.vx)+dy*(c.vy-e.vy))/dist;if(dist<6&&closing<0.1){c.ph='break';c.phEnd=t+R(6,10);c.bs=Math.random()<.5?1:-1}}
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
      if(e&&e.state==='fly'){c.ms--;c.nm=t+2;shots.push({x1:c.x,y1:c.y,x2:e.x,y2:e.y,rt:performance.now(),s:c.side,a:c,b:e});stat.mis[c.side]++;if(Math.random()<.55){killCraft(e,'missile');stat.misShot[c.side]++}}}}
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
function spawnFrags(x,y,z,n,sp,L,o){for(let i=0;i<n&&frags.length<900;i++){const a=Math.random()*6.283,v=sp*R(.2,1);frags.push({x,y,z,vx:(o?o.sx*.3:0)+Math.cos(a)*v,vy:(o?o.sy*.3:0)+Math.sin(a)*v,rot:Math.random()*6.283,vr:R(-3,3),sz:L*R(.05,.16),t0:t,d:R(8,22),side:o?o.side:0,ln:0,hot:0})}}
// куски брони/модулей отлетают от корабля и долго дрейфуют, медленно угасая (сторона и размер — по кораблю)
function spawnPlates(o,x,y,n,big){const L=o.T.L,out=Math.atan2(y-o.y,x-o.x);
  for(let i=0;i<n&&frags.length<900;i++){const a=out+R(-.9,.9),v=(.012+Math.hypot(o.sx,o.sy)*.25)*R(.25,1)*(big?1.4:1);
    frags.push({x,y,z:o.z,vx:o.sx*.85+Math.cos(a)*v,vy:o.sy*.85+Math.sin(a)*v,vz:R(-.012,.012)*(1+L),rot:Math.random()*6.283,vr:R(-2,2),rx:Math.random()*6,ry:Math.random()*6,vrx:R(-1.5,1.5),vry:R(-1.5,1.5),sz:L*R(.012,.03)*(big?2.2:1)+.003,t0:t,d:R(25,70),side:o.side,ln:0,hot:0,plate:1})}}
function addDecal(o,x,y,vx,vy,sz,k){ // след повреждения на корпусе в системе корабля (для 3D): позиция по длине, угол сечения (сторона к стрелку), размер
  const L=o.T.L,dx=x-o.x,dy=y-o.y,ch=Math.cos(o.hd),sh=Math.sin(o.hd),u=Math.max(-.5,Math.min(.5,(dx*ch+dy*sh)/L)),lat=-dx*sh+dy*ch;
  const ang=Math.atan2(R(-.7,.7),Math.sign(lat)||(Math.random()<.5?1:-1))-(o.roll||0);(o.vd||(o.vd=[])).push({u,ang,sz,k,t0:t,r:Math.random()});if(o.vd.length>240)o.vd.shift()}
function spawnShards(x,y,z,n,sp){for(let i=0;i<n&&frags.length<560;i++){const a=Math.random()*6.283,v=sp*R(.4,1);frags.push({x,y,z,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:a,vr:0,sz:R(.5,1.6),t0:t,d:R(1.5,4),side:0,ln:1,hot:1})}}
function launchPods(o,frac){const n=Math.round(o.pers*o.crew*frac);if(n<=0)return;o.crew=Math.max(0,o.crew*(1-frac));
  const np=Math.max(1,Math.min(14,Math.ceil(n/60))),per=n/np;
  for(let i=0;i<np&&pods.length<420;i++){const a=Math.random()*6.283,v=R(.4,1.4);pods.push({x:o.x+Math.cos(a)*o.T.L*.3,y:o.y+Math.sin(a)*o.T.L*.3,z:o.z,vx:o.sx*.5+Math.cos(a)*v,vy:o.sy*.5+Math.sin(a)*v,n:per,side:o.side,t0:t,life:700,tg:null,ph:Math.random()*6,nx:0})}
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
    let dead=false;for(const q of around(1-l.side,l.x,l.y,22)){let na=0;for(const m of q.tur)if(m.k==='A'&&m.alive)na++;if(na&&Math.random()<.05*na*dt*(q.fine?1.3:.5)){dead=true;break}}
    if(dead){fx.push({x:l.x,y:l.y,z:l.z,t0:t,d:3,r:1.1});spawnShards(l.x,l.y,l.z,4,5);SFX.boom(4);stat.landLost=(stat.landLost||0)+1;lands.splice(i,1);continue}
    if(d<o.T.L*.5+.8){lands.splice(i,1);resolveBoard(l)}}
}
function kill(o,why){if(!o.alive)return;o.alive=false;o.why=why||'другое';(stat.kc=stat.kc||{})[o.why]=(stat.kc[o.why]||0)+1;if(o.crew>.04)launchPods(o,.5);fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:14,r:Math.max(4,o.T.L*7)});SFX.boom(26);stat.lost[o.side]++;
  {const L=o.T.L;spawnFrags(o.x,o.y,o.z,6+Math.floor(L*6),1.2,L,o);
   let ammo=(o.pool&&(o.pool.torp||0)+(o.pool.ammo||0)/10)||0;for(const m of o.tur)if(m.k==='M'&&m.alive)ammo+=m.ammo||0;
   if(ammo>0)pyro.push({x:o.x,y:o.y,z:o.z,hd:o.hd,L,vx:o.sx*.3,vy:o.sy*.3,n:4+Math.min(14,Math.round(L*3+ammo/3)),next:t+.3,t0:t,side:o.side});
   if(Math.random()<Math.min(.3,.08+.05*L)){stat.reactor=(stat.reactor||0)+1;const R0=7+L*10;
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
  const h=Math.floor(dmg*6+Math.random()),ex=[];if(h<=0)return;for(const z of o.zones)for(const m of z.mods)if(m.alive&&'TALMRDE'.includes(m.k))ex.push(m);
  // приоритет целей: двигатели (вес 4) и башни (вес 3) — самое уязвимое и самое важное; радары и прочее — реже
  const wt=m=>m.k==='E'?4:m.k==='T'||m.k==='A'?3:1;
  for(let i=0;i<h&&ex.length;i++){let tw=0;for(const q of ex)tw+=wt(q);let r=Math.random()*tw,j=0;for(;j<ex.length-1;j++){r-=wt(ex[j]);if(r<=0)break}const m=ex[j];
    if(m.ar>0&&Math.random()<.75){m.ar--;fx.push({z:o.z,x,y,t0:t,d:3,r:.6});continue}
    mdead(o,m);ex.splice(j,1);o.crew=Math.max(0,o.crew-.006);o.mor-=.01;stat.fmod=(stat.fmod||0)+1;fx.push({z:o.z,x,y,t0:t,d:8,r:1.8});say(o.side,'mod',o)}
  addDecal(o,x,y,vx,vy,.4,3);if(o.alive&&o.aliveN<o.total*.22)kill(o,'броня пробита: модули выбиты')}
// пуля не пробила броню: без вспышки — отскакивает от обшивки и улетает по отражённой траектории, пара искр
function ricochet(o,x,y,vx,vy){
  if(frags.length>520)return;let nx=x-o.x,ny=y-o.y;const nl=Math.hypot(nx,ny)||1;nx/=nl;ny/=nl;const vl=Math.hypot(vx,vy)||1,ux=vx/vl,uy=vy/vl,dn=ux*nx+uy*ny;
  let rx=ux-2*dn*nx,ry=uy-2*dn*ny;const ja=R(-.35,.35),c=Math.cos(ja),sn=Math.sin(ja);[rx,ry]=[rx*c-ry*sn,rx*sn+ry*c];const sp=R(7,12);
  frags.push({x,y,z:o.z,vx:rx*sp,vy:ry*sp,rot:Math.atan2(ry,rx),vr:0,sz:1.1,t0:t,d:R(.25,.45),side:0,ln:1,hot:1,ric:1});
  for(let i=0;i<2;i++){const a=Math.atan2(ry,rx)+R(-.9,.9),v=R(2,5);frags.push({x,y,z:o.z,vx:Math.cos(a)*v,vy:Math.sin(a)*v,rot:a,vr:0,sz:.5,t0:t,d:R(.15,.3),side:0,ln:1,hot:1,ric:1})}
}
function hitShip(o,kind,vx,vy,x,y,dmg,pw,iz,vz,gat,pr){lastDmgT=t;let imp=null;
  const vr=pr?Math.hypot(pr.vx-(o.sx||0),pr.vy-(o.sy||0),pr.vz||0):0; // относительная скорость удара, км/с: от неё энергия и пробитие
  if(!o.alive)return;o.hitT=t;
  {hitLog.push(t);if(hitLog.length>200)hitLog.shift();const dd=Math.hypot(vx,vy,vz||0)||1;impacts.push(imp={id:++impN,x,y,z:iz!=null?iz:o.z,nx:-vx/dd,ny:-vy/dd,nz:-(vz||0)/dd,pw:Math.min(12,Math.max(.5,dmg||1)),k:gat?'gat':kind,gE:gat?.5*GATP.m*(GATP.v*1000)**2:0,s:o});if(impacts.length>300)impacts.splice(0,100)}{const c=Math.cos(o.hd||0),sn=Math.sin(o.hd||0),dx=x-o.x,dy=y-o.y;(o.h3=o.h3||[]).push({q:imp,lx:dx*c+dy*sn,ly:-dx*sn+dy*c,lz:imp.z-(o.z||0),nx:imp.nx*c+imp.ny*sn,ny:-imp.nx*sn+imp.ny*c});if(o.h3.length>6000)o.h3.splice(0,1000),o.h3b=(o.h3b||0)+1000} // журнал попаданий в координатах корабля — 3D рисует и те, что были вне кадра
  if(o.T.defl&&Math.random()<o.T.defl){fx.push({z:o.z,x,y,t0:t,d:3,r:0.8});return}
  if(kind==='fgt'){fighterHit(o,dmg,x,y,vx,vy);return}
  const a=adiff(o.hd,Math.atan2(-vy,-vx))+R(-0.35,0.35),ab=Math.abs(a);
  const zi=ab<0.785?0:ab>2.356?2:(a>0?1:3);let z=o.zones[zi];
  // у корабля нет хп: слои брони по колонкам, потом модули. Попадание снимает слои в случайном месте (воронка шире от тяжёлого снаряда),
  // пробитая колонка пропускает остаток урона к ближайшим модулям; после гибели модуля урон идёт к соседнему
  const fin=(c,nc,cut,pass)=>{ // общий конец: картинка воронки, модули за пробоиной, экипаж, пожары
  if(cut){if(kind==='rail'&&pass<=0)ricochet(o,x,y,vx,vy);else fx.push({z:o.z,x,y,t0:t,d:4,r:1});if(frags.length<300&&Math.random()<.5)spawnShards(x,y,o.z,2,3);o.mor-=.002;
    if(cut>=3&&Math.random()<Math.min(.9,.15+cut*.04))spawnPlates(o,x,y,1+(cut>14?1:0)+(cut>40?1:0),false);{const rr=Math.random();addDecal(o,x,y,vx,vy,kind==='laser'?1.3:cut>20?.8:.5,kind==='laser'?(rr<.5?2:rr<.8?7:5):cut<3?(rr<.25?3:rr<.45?4:rr<.65?9:rr<.85?6:10):(rr<.3?0:rr<.5?5:rr<.65?8:rr<.8?10:rr<.9?7:6))}}
  if(imp){imp.left=z.cols[c];imp.arm=z.arm} // картинка берёт остаток слоёв из расчёта: 0 — сквозная дыра
  if(pass<=0)return;
  const k=kind==='torp'?TORP.mod:pass,f=(c+.5)/nc,pu=zi===0?.33:zi===2?-.4:(f-.5)*.52,pv=zi===1?.2:zi===3?-.2:(f-.5)*.5;
  for(let i=0;i<k;i++){let m=null,bd=1e9;for(const zz of o.zones)for(const q of zz.mods)if(q.alive){const du=(q.u||0)-pu,dv=(q.v||0)-pv,d=du*du+dv*dv+(q.k==='C'?.04:0); /* реактор за другими модулями: до него доходит, когда соседи выбиты */if(d<bd){bd=d;m=q}}
    if(!m)break;if(m.ar>0&&m.k!=='C'){m.ar--;fx.push({z:o.z,x,y,t0:t,d:3,r:.7});continue}mdead(o,m);if(m.k==='E')say(o.side,'eng',o);else if(m.k!=='C')say(o.side,'mod',o)}
  const tk=(kind==='laser'&&pw&&pw<1)?pw:1; // такт лазера (0,1 с): побочные эффекты проникновения редкие, иначе корабль горит непрерывно
  if(tk===1||Math.random()<tk*.5){fx.push({z:o.z,x,y,t0:t,d:10,r:3});SFX.boom(3);spawnPlates(o,x,y,2+Math.min(3,k),true);addDecal(o,x,y,vx,vy,1.2,1)}
  if(o.mag>0&&o.spec.magFr&&Math.random()<Math.min(.5,o.spec.magFr*k*1.5)*tk){ // пробоина у погреба: слой брони погреба держит одно попадание, отстрел — без взрыва, иначе детонация
    o.magAr=o.magAr==null?(o.spec.magArm||0):o.magAr;
    if(o.magAr>0)o.magAr--;else if(o.spec.magEj){if(!o.magEjT)o.magEjT=t+60}else{o.mag=0;fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:14,r:Math.max(2,o.T.L*.8)});SFX.boom(6);
      const al=[];for(const zz of o.zones)for(const q of zz.mods)if(q.alive&&q.k!=='C')al.push(q);for(let i=0;i<Math.min(al.length,4+Math.round(o.spec.magFr*40));i++)mdead(o,al.splice((Math.random()*al.length)|0,1)[0]);o.crew=Math.max(0,o.crew-.15);o.mor-=.2;say(o.side,'mod',o)}}
  o.crew=Math.max(0,o.crew-(.012*k+.004)*tk);o.mor-=(.012+.01*k)*tk;
  if(Math.random()<(.07+.04*k)*tk*(tk<1?.5:1)){const zi2=o.zones.indexOf(z);if(zi2>=0){o.fire[zi2]=Math.min(3,o.fire[zi2]+1);stat.fires++;say(o.side,'fire_',o)}}
  say(o.side,'hit',o);
  if(!o.core.alive){if(!o.ecore){o.ecore=1;o.core.alive=true;o.aliveN++;o.blk=t+R(40,70);o.heat=0;stat.blk++;say(o.side,'power',o);fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:12,r:6})}else kill(o,'реактор: второе отключение')}
  if(o.alive&&o.aliveN<o.total*0.22)kill(o,'модули выбиты попаданиями');
  };
  if(gat){ // пуля минигана: по броне — 0,1% снять слой, иначе рикошет; по голому месту — 1% уничтожить ближайший модуль
    const nc=z.nc,uu=Math.max(-.5,Math.min(.5,((x-o.x)*Math.cos(o.hd)+(y-o.y)*Math.sin(o.hd))/o.T.L));let c=Math.max(0,Math.min(nc-1,Math.round((uu+.5)/.84*nc+R(-1.5,1.5))));
    if(pr){const g=dig(o,z,x,y,iz,Math.min(GAT_K*vr*vr,penCap(GATP.m,GATP.area)),1,{k:'гатлинг 30 мм',v:vr});c=g.c; // пуля: одна ячейка, глубина по энергии
      if(g.left<=0){if(g.took<.5){ricochet(o,x,y,vx,vy);if(imp)imp.rico=1}if(imp){imp.left=z.cols[c];imp.arm=z.arm;imp.mm=g.rem}return}
      if(imp){imp.left=0;imp.arm=z.arm}if(Math.random()>=Math.min(1,.01+g.left/LAYER_MM))return}
    else if(z.cols[c]>0){const gl=(pr?GAT_K*vr*vr:.0015)/ARM_E,ly=Math.floor(gl)+(Math.random()<gl%1?1:0); // МДж/см² пули / порог слоя: 0,6 км/с — ~0,08%, от 22 км/с — слой
      if(ly>0){const tk=Math.min(z.cols[c],ly);z.cols[c]-=tk;z.armN-=tk}else{ricochet(o,x,y,vx,vy);if(imp)imp.rico=1}if(imp){imp.left=z.cols[c];imp.arm=z.arm}return}
    else{if(imp){imp.left=0;imp.arm=z.arm}if(Math.random()>=.01)return}
    const f=(c+.5)/nc,pu=zi===0?.33:zi===2?-.4:(f-.5)*.52,pv=zi===1?.2:zi===3?-.2:(f-.5)*.5;let m=null,bd=1e9;for(const zz of o.zones)for(const q of zz.mods)if(q.alive){const du=(q.u||0)-pu,dv=(q.v||0)-pv,d=du*du+dv*dv;if(d<bd){bd=d;m=q}}
    if(m){mdead(o,m);if(m.k==='E')say(o.side,'eng',o);else if(m.k!=='C')say(o.side,'mod',o)}return}
  if(kind==='rail'&&pr&&pr.kk){ // рельс: снаряд калибра N см накрывает ⌈N/10⌉² ячеек, глубина = 10 мм на МДж/см²; остаток после пробития — по модулям (1 удар на 2 см лишней глубины)
    const g=dig(o,z,x,y,iz,Math.min(pr.kk*vr*vr,penCap(RAIL_M(pr.cal||10),Math.PI*((pr.cal||10)/2)**2)),Math.max(1,Math.ceil((pr.cal||10)/10)),{k:'рельс '+(pr.cal||10)+' см',v:vr}),cut=g.took/LAYER_MM,pass=g.left>0?Math.min(PASS.max,1+Math.floor(g.left/PASS.mm)):0;if(imp){imp.mm=g.rem;imp.dep=g.dep}
    if(g.took<.5&&!pass){ricochet(o,x,y,vx,vy);if(imp){imp.rico=1;imp.left=z.cols[g.c];imp.arm=z.arm}return}
    fin(g.c,z.nc,cut,pass);return}
  if(kind==='laser'||kind==='torp'||kind==='rock'){ // лазер — пятно 10 см, торпеда — 30 см, камень — 50 см; удельная энергия = прежние «слои» × 2 МДж/см² (торпеда — 30 МДж/см²)
    const Eu=kind==='torp'?30:Math.max(0,dmg*(kind==='laser'?.7:.22))*ARM_E,g=dig(o,z,x,y,iz,Eu,kind==='torp'?3:kind==='rock'?5:1,{k:kind==='laser'?'лазер':kind==='torp'?'торпеда':'камень',v:Math.hypot(vx,vy,vz||0)}),cut=g.took/LAYER_MM,pass=g.left>0?Math.min(PASS.max,1+Math.floor(g.left/PASS.mm)):0;
    if(imp){imp.mm=g.rem;imp.dep=g.dep}if(g.took<.5&&!pass){fx.push({z:o.z,x,y,t0:t,d:2,r:0.5});if(imp){imp.left=z.cols[g.c];imp.arm=z.arm}return}
    fin(g.c,z.nc,cut,pass);return}
  // ракеты: слои по метровым колонкам (переделаем отдельно)
  let dm=kind==='torp'?1:(kind==='rail'&&pr&&pr.kk)?pr.kk*vr*vr/ARM_E:dmg*(kind==='fgt'?1:kind==='laser'?.7:kind==='mis'?.5:.22); dm=Math.floor(dm)+(Math.random()<dm%1?1:0);
  if(dm<=0){if(kind==='rail')ricochet(o,x,y,vx,vy);else fx.push({z:o.z,x,y,t0:t,d:2,r:0.5});return}
  const nc=z.nc,uu=Math.max(-.5,Math.min(.5,((x-o.x)*Math.cos(o.hd)+(y-o.y)*Math.sin(o.hd))/o.T.L)),c=Math.max(0,Math.min(nc-1,Math.round((uu+.5)/.84*nc+R(-1.5,1.5)))),w=(kind==='rail'&&pr&&pr.kk)?Math.max(1,Math.round(PW*(pr.cal||10)/10)):Math.max(1,Math.round(dm*PW)),half=w>>1;let pass=dm,cut=0;
  if(kind==='rail'){const oz=o.zones[(zi+2)%4],oc=Math.max(0,Math.min(oz.nc-1,Math.round((c+.5)/nc*oz.nc-.5)));
    if(z.cols[c]<=0&&oz.cols[oc]<=0&&Math.random()<.5){fx.push({z:o.z,x,y,t0:t,d:3,r:.6});stat.through=(stat.through||0)+1;return}}
  if(kind==='rail'&&pw&&!(pr&&pr.kk)&&Math.random()<pw){pass=dm;fx.push({z:o.z,x,y,t0:t,d:2,r:.5})}else
  if(kind==='mis'){ // ракета: сегмент PW колонок; в центре dm слоёв, к краям спад до 1; число сегментов растёт с мощностью (3→3, 9→5, 25→7, 30→9)
    const P0=pw||dmg,hs=Math.round(Math.sqrt(Math.max(1,P0))/1.5),W=hs*2+1,cen=Math.max(dmg*.5,.5);pass=0;
    for(let sg=-hs;sg<=hs;sg++){let dv=Math.max(sg===0?cen:1,cen*(1-Math.abs(sg)/(hs+1)));if(sg!==0&&dmg<P0*.5)dv*=dmg/P0*2;dv=Math.floor(dv)+(Math.random()<dv%1?1:0);if(dv<=0)continue;
      for(let q=0;q<PW;q++){const cc=c+sg*PW+q-(PW>>1);if(cc<0||cc>=nc)continue;const d=z.cols[cc],tk=Math.min(d,dv);if(tk){z.cols[cc]=d-tk;z.armN-=tk;cut+=tk}if(sg===0&&q===(PW>>1))pass=dv-tk}}
    dm=Math.max(dm,1)
  }else
  for(let j=-half;j<w-half;j++){const cc=c+j;if(cc<0||cc>=nc)continue;const d=z.cols[cc],tk=Math.min(d,dm);if(tk){z.cols[cc]=d-tk;z.armN-=tk;cut+=tk}if(j===0)pass=dm-tk}
  fin(c,nc,cut,pass);
}
// пулемёт Гатлинга: непрерывный огонь по истребителям, ракетам и торпедам (в упор — по кораблям); нагрев снижает точность, перегрев — заклинивание или поломка
const GV=GATP.v; // пуля гатлинга 0,6 км/с; единицы боя — км и с (рельсотрон 2–10 км/с по калибру)
function gatStep(s,m,dt){
  const C=m.cfg;let e=null,kind=0,bd=Math.min(C.rng,GV*20)**2;
  if(!m.lock&&s.fine){for(const c of fly[1-s.side]){if(c.state!=='fly')continue;const d=(c.x-s.x)**2+(c.y-s.y)**2;if(d<bd){bd=d;e=c;kind=1}}
    if(!e)for(const p of mis){if(p.side===s.side)continue;const d=(p.x-s.x)**2+(p.y-s.y)**2;if(d<bd){bd=d;e=p;kind=2}}
    if(!e)for(const p of torps){if(p.side===s.side)continue;const d=(p.x-s.x)**2+(p.y-s.y)**2;if(d<bd){bd=d;e=p;kind=3}}}
  if(!m.lock&&!e&&s.tg&&s.tg.alive&&Math.hypot(s.tg.x-s.x,s.tg.y-s.y)<effR(s,s.tg,GV)&&hitP(s,s.tg,GV,1)>=PMIN){e=s.tg;kind=4} // дальше 12 км пуля всё равно угаснет — не стреляем
  if(!e||m.lock||s.mag<=0){m.why=m.lock?'перегрев: остывает ('+Math.round(m.heat*100)+'%, стрельба с 55%)':s.mag<=0?'нет боеприпасов':'нет целей ближе '+Math.min(C.rng,GV*20).toFixed(0)+' км'+(m.last?' · последний: '+m.last:'');m.heat=Math.max(0,m.heat-C.cool/60*dt);if(m.lock&&m.heat<.55)m.lock=false;return}
  if(C.rot&&!C.ax){const want=Math.atan2(e.y-s.y,e.x-s.x);if(m.ang==null)m.ang=want;const d=adiff(m.ang,want),st=C.rot*Math.PI/180*dt;if(Math.abs(d)>st){m.ang+=Math.sign(d)*st;m.why='турель разворачивается ('+C.rot+'°/с)';m.heat=Math.max(0,m.heat-C.cool/60*dt);return}m.ang=want} // скорость разворота турели
  m.heat+=C.heat/60*dt;addHeat(s,(C.heatMW||.5)*dt);if(C.failM&&Math.random()<C.failM/60*dt){m.alive=false;mdead(s,m);m.why='пулемёт сломался при стрельбе (1% в минуту)';return}{const tn=C.ammoH/3600*dt;(stat.gatT=stat.gatT||[0,0])[s.side]+=tn;s.mag=Math.max(0,s.mag-tn)}
  if(m.heat>=1){m.heat=1;if(Math.random()<.3){m.alive=false;mdead(s,m);fx.push({x:s.x,y:s.y,t0:t,d:4,r:1});return}m.lock=true;return}
  m.fa=Math.atan2(e.y-s.y,e.x-s.x);m.rt=performance.now();m.acc+=dt*10;const w=C.rpm/600,dist=Math.hypot(e.x-s.x,e.y-s.y),eR=Math.max(.5,effR(s,e,GV));
  const pAcc=Math.max(.02,(.55-.4*Math.min(1,dist/eR))*(1-.95*m.heat))*(1.2-.05*m.sk);
  if(pAcc<.15){m.why='цель '+(e&&e.T?e.T.n:e&&e.type==='F'?'истребитель':e&&e.type==='B'?'бомбардировщик':'цель')+' в '+dist.toFixed(1)+' км: точность '+Math.round(pAcc*100)+'% ниже порога 15% — не стреляет';m.acc=0;m.heat=Math.max(0,m.heat-C.cool/60*dt*.5);return} // слишком неточно — не поливаем во все стороны
  m.last=m.why='огонь по '+(kind===1?'истребителю':kind===2?'ракете':kind===3?'торпеде':(e&&e.T?e.T.n:e&&e.type==='F'?'истребитель':e&&e.type==='B'?'бомбардировщик':'цель'))+' '+dist.toFixed(1)+' км · точность '+Math.round(pAcc*100)+'% · нагрев '+Math.round(m.heat*100)+'%';SFX.shot('gat');let n=0;while(m.acc>=1&&n<6){m.acc--;n++;
    if(kind===1)fireAt(s.x,s.y,s.z,s,m,s.side,e,GV,pAcc,w*.05,C.rng*1.4);
    else if(kind===4)fireAt(s.x,s.y,s.z,s,m,s.side,e,GV,pAcc,0,C.rng*1.4,w*C.pen*.01);
    else{fireAt(s.x,s.y,s.z,s,m,s.side,e,GV,pAcc*.6,0,C.rng*1.4);if(Math.random()<pAcc*.12*w/10){if(kind===2)hurtMis(e,1);else{const i=torps.indexOf(e);if(i>=0){torps.splice(i,1);stat.torpPd[e.side]++}}}}}
  if(n)recoil(s,m,GAT_M*n*C.rpm/600,GV,e.x-s.x,e.y-s.y); // каждый выстрел в симуляции — rpm/600 пуль
}
function flakBurst(s,m){
  if(!s.fine){m.cd=3;return false}
  const F=m.cfg,cand=[];for(const c of fly[1-s.side])if(Math.hypot(c.x-s.x,c.y-s.y)<F.rng)cand.push(c);
  const tp=torps.concat(mis).filter(p=>p.side!==s.side&&Math.hypot(p.x-s.x,p.y-s.y)<F.rng);
  if(!cand.length&&!tp.length){m.cd=2;return false}
  const e=tp.length&&Math.random()<0.5?tp[(Math.random()*tp.length)|0]:(cand.length?cand[(Math.random()*cand.length)|0]:tp[0]);
  const d=Math.hypot(e.x-s.x,e.y-s.y),err=(0.25+0.012*d)*(1.4-0.08*m.sk);
  const bx=e.x+(e.vx||0)*1.5+gauss()*err,by=e.y+(e.vy||0)*1.5+gauss()*err;
  m.fa=Math.atan2(by-s.y,bx-s.x);m.rt=performance.now();SFX.shot('flak');stat.flak[s.side]++;shots.push({x1:s.x,y1:s.y,x2:bx,y2:by,rt:performance.now(),s:s.side,ext:1.7,src:s,m:m,o0:{x:s.x,y:s.y,z:s.z}});fx.push({x:bx,y:by,t0:t,d:3,r:F.blast});
  for(const c of fly[1-s.side])if(c.state==='fly'&&Math.hypot(c.x-bx,c.y-by)<F.blast){c.hp--;if(c.hp<=0){killCraft(c);stat.flakKill[s.side]++}}
  for(let i=torps.length-1;i>=0;i--){const p=torps[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast*1.5&&Math.random()<0.7){torps.splice(i,1);stat.torpPd[p.side]++;stat.flakKill[s.side]++}}
  for(let i=mis.length-1;i>=0;i--){const p=mis[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast*1.5+1&&Math.random()<0.15){p.hp--;if(p.hp<=0){mis.splice(i,1);stat.misShot[p.side]++;stat.flakKill[s.side]++;boom(p,null)}}}
  return true;
}
// осечка: орудие клинит на 4 минуты, иногда взрывается
function jamChk(s,m,C){if(!C.fail||Math.random()>=C.fail)return;stat.jams=(stat.jams||0)+1;m.cd=240;fx.push({x:s.x,y:s.y,t0:t,d:6,r:1.5});if(Math.random()<0.15){m.alive=false;s.aliveN--;stat.boom=(stat.boom||0)+1;if(!s.core.alive||s.aliveN<s.total*0.3)kill(s,'взрыв своего орудия')}}
function fireShell(s,m,o0,C,lag){
  let o=o0&&o0.alive?o0:(s.tg&&s.tg.alive?s.tg:null);if(!o)return;
  const VPc=C.vp,rsz=(o.vz||0)-(s.vz||0),rsx=o.sx-(s.sx||0),rsy=o.sy-(s.sy||0);let oz=o.z||0;let T=Math.hypot(o.x-s.x,o.y-s.y,oz-s.z)/VPc; // упреждение в системе стрелка
  const oax=(o.aex||0)*LEAD.acc,oay=(o.aey||0)*LEAD.acc; /* ускорение берём вполовину: тяга импульсами и может прекратиться */ // упреждение с ускорением цели: x + v·T + ½·a·T²
  for(let i=0;i<4;i++){const px=o.x+rsx*T+.5*oax*T*T,py=o.y+rsy*T+.5*oay*T*T,pz=(o.z||0)+rsz*T;T=Math.hypot(px-s.x,py-s.y,pz-s.z)/VPc}oz=(o.z||0)+rsz*T;
  // вилка на уклонение: цель за время полёта может сместиться маневровыми на ½·a·t² вбок — часть снарядов бьёт туда, куда она увернётся
  let bkx=0,bky=0;if(m.sv&&m.sv.o===o){ /* залп: точка k из N — «подсолнух» по кругу ½·a·t², вбок и по высоте */const sv=m.sv,k=sv.k++,w=Math.min(12,T),D=(o.T&&o.rcsN>0&&(!o.fuelCap||o.fuel/o.fuelCap>.4))?Math.max(0,.5*(o.acc||5)*.12/1000*w*w-o.T.L*.11)*SALVO.fill:0, /* засеваем только то, куда цель уйдёт дальше своего размера */r=D*Math.sqrt(((k%sv.N)+.5)/sv.N),th=k*2.39996,lx=o.x-s.x,ly=o.y-s.y,ll=Math.hypot(lx,ly)||1;bkx=-ly/ll*r*Math.cos(th);bky=lx/ll*r*Math.cos(th);oz+=r*Math.sin(th);stat.salvo=(stat.salvo||0)+1}
  else{const dodge=o.T&&o.rcsN>0&&(!o.fuelCap||o.fuel/o.fuelCap>.4);if(dodge){const w=Math.min(12,T),D=.5*(o.acc||5)*.12/1000*w*w,lx=o.x-s.x,ly=o.y-s.y,ll=Math.hypot(lx,ly)||1,r=Math.random(),sg=r<.34?0:r<.67?1:-1;bkx=-ly/ll*D*LEAD.bracket*sg;bky=lx/ll*D*LEAD.bracket*sg}}
  const px=o.x+rsx*T+.5*oax*T*T+bkx,py=o.y+rsy*T+.5*oay*T*T+bky,d=Math.hypot(px-s.x,py-s.y,oz-s.z),ek=2*(1.4-0.08*m.sk)*C.sig,e0=DISP*d*ek,kq=1,e=e0,ev=e0; // разброс ствола; цель не «угадывается» — промахи от её настоящего уклонения маневровыми // разброс общий по обеим осям; сужен так, чтобы шанс попасть в 3D ≈ прежнему // по высоте — только рассеяние ствола: цель уклоняется в плоскости
  const ax=px+gauss()*e-s.x,ay=py+gauss()*e-s.y,az=oz+gauss()*ev-s.z,l=Math.hypot(ax,ay,az)||1e-6;let vx=ax/l*VPc,vy=ay/l*VPc,vz=az/l*VPc;
  // башня наводится по вектору полёта снаряда, снаряд выходит из конца её ствола
  const mo=MUZ?MUZ(s,m,vx,vy,vz):null,X0=s.x+(mo?mo.x:0),Y0=s.y+(mo?mo.y:0),Z0=s.z+(mo?mo.z:0),k0=VPc*lag+(mo?0:s.T.L*.4);if(mo){const bx=s.x+ax-X0,by=s.y+ay-Y0,bz=s.z+az-Z0,l2=Math.hypot(bx,by,bz)||1;vx=bx/l2*VPc;vy=by/l2*VPc;vz=bz/l2*VPc}
  m.fa=Math.atan2(ay,ax);m.rt=performance.now();
  vx+=s.sx||0;vy+=s.sy||0;vz+=s.vz||0;
  recoil(s,m,RAIL_M(C.cal),VPc,ax,ay);
  proj.push({kk:RAIL_K(C.cal),cal:C.cal||10,x:X0+vx/VPc*k0,y:Y0+vy/VPc*k0,z:Z0+vz/VPc*k0,vz,vx,vy,side:s.side,dist:Math.hypot(vx,vy)*lag,dmg:C.dmg*.4,ap:C.ap||0,cd:3,max:Math.hypot(vx,vy)*20,src:s,m:m,ev:Math.random(),o0:{x:X0,y:Y0,z:Z0}});
  stat.shots[s.side]++;s.flash=t;SFX.shot('rail');
  if(fx.length<300)fx.push({x:s.x+ax/l*s.T.L*.45,y:s.y+ay/l*s.T.L*.45,z:s.z,t0:t,d:.3,r:.5,muz:1,side:s.side});
}
// взрыв ракеты: бьёт всех рядом, в том числе своих
function boom(p,direct){
  fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:6,r:p.blast*1.3});SFX.boom(p.blast);
  if(direct)stat.misHit[p.side]++;
  for(const side of [0,1]){for(const o of around(side,p.x,p.y,p.blast+2)){
    if(!o.alive||Math.abs(o.z-p.z)>p.blast*1.5+10)continue;
    const d=Math.hypot(o.x-p.x,o.y-p.y),f=o===direct?1:Math.max(0,1-d/(p.blast+2)*.75);
    if(f>0)hitShip(o,'mis',o.x-p.x,o.y-p.y,p.x,p.y,p.dmg*f*(o===direct?1.3:1),p.dmg)}}
  for(const c of fly[0].concat(fly[1]))if(c.state==='fly'&&Math.hypot(c.x-p.x,c.y-p.y)<p.blast){c.hp-=2;if(c.hp<=0)killCraft(c)}
}
function nearMis(s,rg){let b=null,bd=rg*rg;for(const q of mis){if(q.side===s.side)continue;const d=(q.x-s.x)*(q.x-s.x)+(q.y-s.y)*(q.y-s.y);if(d<bd){bd=d;b=q}}return b}
function hurtMis(q,n){q.hp-=n;if(q.hp<=0){const i=mis.indexOf(q);if(i>=0){mis.splice(i,1);stat.misShot[q.side]++;boom(q,null)}}}
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
      if(Math.random()<C.ap)hitShip(o,'laser',px-s.x,py-s.y,ix,iy,C.dmg*1.7*.1,.1);
      if(++q.dc%2===0)addDecal(o,ix,iy,px-s.x,py-s.y,.8,11)}}
}
// снабжение: транспорты держатся в хвосте и шаттлами возят боеприпасы кораблям, у которых погреб опустел меньше чем наполовину
const SHUT_SPD=9,SHUT_T=40; // км/с, тонн за рейс
function supplyStep(dt){
  for(const s of ships){if(!s.alive||s.T.role!=='supply'||s.mag<=1||t<(s.shT||0))continue;s.shT=t+4;
    let b=null,bn=0;for(const o of around(s.side,s.x,s.y,160)){if(o===s||!o.alive||o.T.role==='supply'||o.st==='surr'||!o.magMax)continue;const need=Math.max(o.magMax-o.mag-(o.inc||0),o.tur.some(q=>q.k==='M')?1:0);if((o.mag/o.magMax<.5||o.tur.some(q=>q.k==='M'&&q.alive&&q.cfg.fl&&q.ammo<=q.cfg.ammo*.25))&&need>bn){bn=need;b=o}}
    if(!b)continue;const amt=Math.min(SHUT_T,s.mag,bn);s.mag-=amt;b.inc=(b.inc||0)+amt;shuttles.push({from:s,to:b,side:s.side,x:s.x,y:s.y,z:s.z||0,amt,st:0,id:Math.random()})}
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

  buildGrids();fleetsUpdate();
  if(t>=nextVis){nextVis=t+Math.max(1,ships.length/160);updVis()} // на больших флотах разведка реже
  if(t>=nextCrew){const dc=Math.max(.5,t-lastCrewT);lastCrewT=t;nextCrew=t+1;crewStep(dc)}
  supplyStep(dt);lasStep(dt);
  for(const s of ships.slice()){if(s.alive&&s.bay&&s.bay.length&&t>=s.bayT&&s.st!=='surr'&&(s.tg||t>60))launchBay(s)}
  for(const s of ships){if(!s.alive)continue;steer(s,dt);}
  separateShips();
  for(const s of ships){if(!s.alive)continue;
    s.maxR=s.maxR||Math.max(60,...s.tur.filter(m=>m.cfg&&m.cfg.rng&&m.k!=='L'&&m.k!=='M').map(m=>m.cfg.rng));
    let foes=null;const muted=s.st==='surr'||t<s.blk,slow=s.st==='panic'?.5:1;
    for(const m of s.tur){
      if(!m.alive){m.why='уничтожен';continue}if(muted){m.why=s.st==='surr'?'корабль сдался — огонь прекращён':'оглушён попаданием — расчёт приходит в себя';continue}
      if(m.cfg&&m.cfg.ax){const o=s.tg&&s.tg.alive?s.tg:null;if(!o){m.why='осевое: нет цели';continue}let r=Math.atan2(o.y-s.y,o.x-s.x)-s.hd;r=Math.atan2(Math.sin(r),Math.cos(r));if(Math.abs(r)>.2){m.why='осевое: цель в '+Math.round(Math.abs(r)*57)+'° от носа, ждёт разворота корабля (нужно ±11°)';continue}} // осевое орудие бьёт только в конусе ±~11° перед носом
      if(m.k==='G'){gatStep(s,m,dt*slow);continue}
      if(mis.length&&s.fine&&(m.k==='T'||m.k==='A')&&t>(m.pd||0)){const q=nearMis(s,m.k==='A'?m.cfg.rng:22);
        if(q){m.pd=t+(m.k==='A'?6:12)*R(.8,1.3);m.fa=Math.atan2(q.y-s.y,q.x-s.x);m.rt=performance.now();shots.push({x1:s.x,y1:s.y,x2:q.x,y2:q.y,rt:performance.now(),s:s.side,a:s,b:q});
          if(Math.random()<(m.k==='A'?.25:.08))hurtMis(q,1)}}
      m.cd-=dt*slow;if(m.cd>0){m.why=m.cd>1e6?(m.am===0?'боезапас орудия исчерпан':'отключено — бой окончен'):(m.cd>200?'заклинило: ремонт ещё ':m.k==='M'?'перезарядка пусковой: ещё ':'зарядка конденсаторов: ещё ')+fmtT(m.cd)+(m.last?' · последний выстрел: '+m.last:'');continue}
      const C=m.cfg;
      // рельсы отбиваются от истребителей и бомбардировщиков рядом (нужен мелкий радар в сети)
      if((m.k==='T'||(m.k==='L'&&!C.dur))&&fly[1-s.side].length){let e=null,bd=Math.min(C.rng,m.k==='L'?150:110)**2;for(const c of fly[1-s.side]){if(c.state!=='fly')continue;const d=(c.x-s.x)**2+(c.y-s.y)**2;if(d<bd){bd=d;e=c}}
        if(e&&(!s.tg||Math.hypot(s.tg.x-s.x,s.tg.y-s.y)>C.rng*.8||Math.random()<.4)){m.last=m.why='отбивается от '+(e&&e.T?e.T.n:e&&e.type==='F'?'истребитель':e&&e.type==='B'?'бомбардировщик':'цель')+' в '+Math.sqrt(bd).toFixed(1)+' км';m.fa=Math.atan2(e.y-s.y,e.x-s.x);m.rt=performance.now();SFX.shot('rail');s.flash=t;s.heat+=.002;
          if(m.k==='L')shots.push({x1:s.x,y1:s.y,x2:e.x,y2:e.y,rt:performance.now(),s:s.side,a:s,b:e});stat.pdRail=(stat.pdRail||0)+1;
          const dd=Math.sqrt(bd),pk=(.02+.0015*(m.sk||5))*(1-Math.min(.6,dd/110*.6));if(m.k==='T'){fireAt(s.x,s.y,s.z,s,m,s.side,e,6,pk,3,3000)}if(m.k==='L'){beams.push({a:s,b:e,tx:e.x,ty:e.y,tz:0,rt:performance.now()+600,c0:performance.now(),side:s.side,w:C.dmg});SFX.shot('laser')}if(m.k==='L'&&Math.random()<pk*1.5){e.hp-=m.k==='L'?4:3;if(e.hp<=0){killCraft(e,m.k==='L'?'laser':'rail');stat.flakKill[s.side]++}}m.cd=(m.k==='L'?2.5:R(2,4))*(1.3-.06*m.sk);continue}}
      if(m.k==='A'){m.why='ПВО: ждёт ракет или авиации в радиусе '+C.rng+' км';if(flakBurst(s,m)){m.last=m.why='ПВО: залп по воздушной цели';m.cd=2*REL*C.rel*(1.3-0.06*m.sk)*R(.75,1.25);jamChk(s,m,C);if(--m.am<=0){m.am=0;m.cd=1e9}}continue}
      if(m.k==='L'||m.k==='M'){
        if(m.k==='M'&&m.ammo<=0){m.cd=1e9;continue}
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
            if(bk){beams.push({a:s,b:bk,tx:bk.x,ty:bk.y,tz:bk.z,rt:m.rt+(C.dur?C.dur*1000:600),c0:m.rt,ld:C.dur?1:0,side:s.side,w:C.dmg});stat.ff=(stat.ff||0)+1;for(let q=0;q<(C.dur||1);q++)if(!C.dur||Math.random()<C.ap)hitShip(bk,'laser',lx,ly,bk.x,bk.y,C.dmg*1.7);m.cd=C.dur?Math.max(180,C.E/800)*R(.95,1.05)/s.enR:cost/C.chg*(1.3-.06*m.sk)*R(.9,1.1)*4.5;continue}}
          const be=env.length?los(s.x,s.y,o.x,o.y):null;s.flash=t;addHeat(s,2.3*(C.E||1000));SFX.shot('laser');say(s.side,'laser',s);
          if(be){const dd=Math.hypot(be.x-s.x,be.y-s.y)||1;beams.push({a:s,b:{alive:false},tx:be.x-(be.x-s.x)/dd*be.r,ty:be.y-(be.y-s.y)/dd*be.r,tz:0,rt:m.rt+(C.dur?C.dur*1000:600),c0:m.rt,ld:C.dur?1:0,side:s.side,w:C.dmg});stat.las[s.side]++;fx.push({x:be.x,y:be.y,t0:t,d:4,r:.8})}
          else{beams.push({a:s,b:o,tx:o.x,ty:o.y,tz:o.z,rt:m.rt+(C.dur?C.dur*1000:600),c0:m.rt,ld:C.dur?1:0,side:s.side,w:C.dmg});
          stat.las[s.side]++;stat.lasHit[s.side]++;for(let q=0;q<(C.dur||1);q++)if(!C.dur||Math.random()<C.ap)hitShip(o,'laser',o.x-s.x,o.y-s.y,o.x,o.y,C.dmg*1.7)}
          m.cd=C.dur?Math.max(180,C.E/800)*R(.95,1.05)/s.enR:cost/C.chg*(1.3-.06*m.sk)*R(.9,1.1)*4.5;
        }else{
          if(d<18){m.cd=4;m.why='ракеты: цель ближе 18 км — пуск опасен';continue}
          const hd=Math.atan2(o.y-s.y,o.x-s.x);
          {const lv=C.sl||null,mx=lv?Math.max(lv.em,lv.ir,lv.ac):3,dumb=!!C.fl&&(C.hm===false||mx===0);let T0=Math.hypot(o.x-s.x,o.y-s.y)/C.spd;for(let k=0;k<3;k++){T0=Math.hypot(o.x+o.sx*T0-s.x,o.y+o.sy*T0-s.y)/C.spd}
          const lh=C.fl?Math.atan2(o.y+o.sy*T0-s.y,o.x+o.sx*T0-s.x):s.hd;
          mis.push({x:s.x,y:s.y,z:s.z,h:lh,dumb:dumb?1:0,sr:C.fl&&lv?[0,25,70,180][mx]*(lv.ac?1.3:1):0,gq:C.fl&&lv?mx/3:null,jf:lv?(lv.em&&!lv.ir&&!lv.ac?1.6:(lv.ir||lv.ac)?.4:1):1,side:s.side,tgt:dumb?null:o,hp:C.hp,spd:C.spd,dmg:C.dmg,blast:C.blast,life:C.fl?Math.min(2400,C.rng/C.spd):C.rng/C.spd*2.2,tr:[],trT:0,vx:0,vy:0,src:s})}
          s.flash=t;SFX.shot('missile');m.last=m.why='пуск ракеты по '+(o.T?o.T.n:'цели');say(s.side,'missile',s);say(1-s.side,'inmis',o);m.ammo--;stat.mis[s.side]++;m.cd=Math.min(2400,43*Math.pow(C.dmg,1.15))*R(.8,1.25)*(1.3-.06*m.sk);
        }
        continue}
      foes=s.trk||[];
      const VPc=C.vp||VP,fl=(s.tg&&s.tg.alive&&s.tg.st!=='surr'&&Math.hypot(s.tg.x-s.x,s.tg.y-s.y)<effR(s,s.tg,VPc)&&Math.random()<.7)?[s.tg]:foes.filter(o=>o.alive&&Math.hypot(o.x-s.x,o.y-s.y)<effR(s,o,VPc)); // дальность = (скорость снаряда + сближение) × 20 с
      {const P0=fl.length?hitP(s,fl[0],VPc,C.sig):0;if(fl.length&&P0<PMIN){const alt=fl.slice(1).find(o=>hitP(s,o,VPc,C.sig)>=PMIN);if(alt)fl.unshift(alt);else{m.cd=1;m.why='шанс попасть '+Math.round(P0*100)+'% ниже '+Math.round(PMIN*100)+'% — ждёт сближения';continue}}}
      {const sv=s.F&&s.F.sv;m.sv=null;if(sv&&sv.o.alive&&s.tur.indexOf(m)>=0&&Math.hypot(sv.o.x-s.x,sv.o.y-s.y)<effR(s,sv.o,VPc)){const tf=Math.hypot(sv.o.x-s.x,sv.o.y-s.y,(sv.o.z||0)-(s.z||0))/VPc,fireT=sv.tA-tf;
        if(t<fireT-.3){m.cd=Math.min(2,fireT-t);m.why='залп флота: ждёт своей секунды, чтобы снаряды пришли вместе';continue}
        if(t<fireT+3){fl.length=0;fl.push(sv.o);m.sv=sv}}}
      if(!fl.length){m.cd=2;m.why='нет цели в дальности: (скорость снаряда '+VPc+' км/с + сближение) × 20 с';continue}
      if(!bears(s,m,fl[0])){m.cd=.7+Math.random();m.why='цель '+(fl[0].T?fl[0].T.n:'цель')+' вне сектора обстрела этого борта';continue} // цель вне полусферы обстрела этой башни
      // не стрелять через своих: если на линии огня союзник — чаще воздерживаемся
      {const o0=fl[0],ux=o0.x-s.x,uy=o0.y-s.y,ul=Math.hypot(ux,uy)||1;let bl=false;
        for(const q of around(s.side,s.x,s.y,14)){if(q===s)continue;const al=((q.x-s.x)*ux+(q.y-s.y)*uy)/ul,pp=Math.abs(((q.x-s.x)*uy-(q.y-s.y)*ux)/ul);if(al>0&&al<ul&&pp<q.T.L*.4+1.5){bl=true;break}}
        if(bl&&Math.random()<.4){m.cd=2+Math.random()*3;m.why='на линии огня свой корабль — пропускает выстрел';continue}}
      if(s.mag<=0){m.cd=20;m.why='нет боеприпасов';if(!s.dryS){s.dryS=1;say(s.side,'dry',s)}continue}
      m.last=m.why='выстрел по '+(fl[0].T?fl[0].T.n:'цель')+' с '+Math.hypot(fl[0].x-s.x,fl[0].y-s.y).toFixed(1)+' км';addHeat(s,(C.heatGJ!=null?C.heatGJ:.15)*1000*C.shells);say(s.side,'fire',s); /* КПД 50%: половина энергии выстрела — в корпус */
      const B=BURST[C.cal]||8;
      for(let b=0;b<C.shells;b++)bursts.push({s,m,o:fl[(Math.random()*fl.length)|0],C,n:B,i:0,t0:t+b*.03});
      {const rs=60*C.rel,tn=(C.ammoH||2)*rs/3600*C.shells;m.cd=rs*(1.3-.06*m.sk)*R(.8,1.25)/s.enR;(stat.railT=stat.railT||[0,0])[s.side]+=tn;s.mag=Math.max(0,s.mag-tn)}jamChk(s,m,C);if(--m.am<=0){m.am=0;m.cd=1e9;say(s.side,'dry',s)}
    }
  }
  // очереди рельсотронов: выстрелы с задержкой 0,1 с
  for(let i=bursts.length-1;i>=0;i--){const q=bursts[i];
    if(!q.s.alive||!q.m.alive){bursts[i]=bursts[bursts.length-1];bursts.pop();continue}
    while(q.i<q.n&&t>=q.t0+.3*q.i){fireShell(q.s,q.m,q.o,q.C,t-(q.t0+.3*q.i));q.i++}
    if(q.i>=q.n){bursts[i]=bursts[bursts.length-1];bursts.pop()}}
  for(let i=proj.length-1;i>=0;i--){
    const p=proj[i],nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;let hit=null,fr=false,eu=0;
    const dx=nx-p.x,dy=ny-p.y,l2=dx*dx+dy*dy||1,x0=Math.floor(Math.min(p.x,nx)/CS)-1,x1=Math.floor(Math.max(p.x,nx)/CS)+1,y0=Math.floor(Math.min(p.y,ny)/CS)-1,y1=Math.floor(Math.max(p.y,ny)/CS)+1;
    const scan=(g,self)=>{let best=null,bu=2;eu=0;
      const chk=(gx,gy)=>{const a=g.get(ckey(gx,gy));if(!a)return;
        for(const o of a){if(!o.alive||o===self||Math.abs(p.z-o.z)>o.T.L*.25+Math.abs((p.vz||0)*dt)+1)continue;// настоящее попадание: отрезок пути снаряда против коробки корабля (длина × ширина) в его системе координат; малые корабли — малые цели
          { const L=o.T.L,hl=L*.5,hw=L*.11,cs=Math.cos(o.hd||0),sn=Math.sin(o.hd||0),ax=p.x-o.x,ay=p.y-o.y,x1=ax*cs+ay*sn,y1=-ax*sn+ay*cs,ddx=dx*cs+dy*sn,ddy=-dx*sn+dy*cs;
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
      if(ee){endTr(p,nx,ny);if(ee.t==='wreck'){const mw=ee.m||500,mp=p.kk?RAIL_M(p.cal||10):GATP.m;ee.vx+=p.vx*mp/(mw*1000);ee.vy+=p.vy*mp/(mw*1000);ee.hitN=(ee.hitN||0)+1} /* обломок получает импульс снаряда: p·v/m — толкает по физике */fx.push({x:nx,y:ny,z:p.z,t0:t,d:3,r:.6});if(ee.t==='debris')ee.ttl-=4;if(Math.random()<.02)say(p.side,'rock',p.src);proj[i]=proj[proj.length-1];proj.pop();continue}}
    if(p.cd&&fly[1-p.side].length){let hc=null,bu=2;const mnx=Math.min(p.x,nx)-.12,mxx=Math.max(p.x,nx)+.12,mny=Math.min(p.y,ny)-.12,mxy=Math.max(p.y,ny)+.12;
      for(const c of fly[1-p.side]){if(c.state!=='fly'||c.x<mnx||c.x>mxx||c.y<mny||c.y>mxy)continue;let u=((c.x-p.x)*dx+(c.y-p.y)*dy)/l2;u=Math.max(0,Math.min(1,u));if(Math.hypot(p.x+dx*u-c.x,p.y+dy*u-c.y)<.04&&u<bu){bu=u;hc=c}}
      if(hc){endTr(p,hc.x,hc.y);hc.hp-=p.cd;fx.push({x:hc.x,y:hc.y,t0:t,d:3,r:0.5});if(hc.hp<=0){killCraft(hc,'rail');stat.flakKill[p.side]++}proj[i]=proj[proj.length-1];proj.pop();continue}}
    hit=scan(GR[1-p.side],null);if(!hit&&p.src&&p.src.T&&p.dist>p.src.T.L*.6){hit=scan(GR[p.side],p.src);fr=!!hit}
    if(hit){endTr(p,hit.x,hit.y);if(fr)stat.ff=(stat.ff||0)+1;else if(p.kk)stat.hits[p.side]++; /* попадания считаем только у рельсов — выстрелы тоже только их */{const iu=eu,ix=p.x+dx*iu,iy=p.y+dy*iu,gt=p.g||(p.m&&p.m.k==='G');hitShip(hit,p.k||'rail',p.vx,p.vy,ix,iy,gt?0:p.dmg,gt?0:p.ap,p.z+(p.vz||0)*dt*iu,p.vz||0,gt,p)}proj[i]=proj[proj.length-1];proj.pop();continue}
    p.x=nx;p.y=ny;p.z+=p.vz*dt;p.dist+=Math.hypot(p.vx,p.vy)*dt;
    if(p.dist>=p.max){endTr(p,p.x,p.y);proj[i]=proj[proj.length-1];proj.pop()}
  }
  // ракеты
  for(let i=mis.length-1;i>=0;i--){
    const p=mis[i];let tg=p.tgt;
    if(p.dumb){p.vx=Math.cos(p.h)*p.spd;p.vy=Math.sin(p.h)*p.spd;p.x+=p.vx*dt;p.y+=p.vy*dt;p.life-=dt;p.trT-=dt;if(p.trT<=0){p.trT=.6;p.tr.push(p.x,p.y,p.z);if(p.tr.length>12)p.tr.splice(0,3)}
      let hitS=null;for(const o of around(1-p.side,p.x,p.y,12)){if(o.alive&&Math.hypot(o.x-p.x,o.y-p.y)<Math.max(.3,o.T.L*.5)+p.blast*.15){hitS=o;break}}
      if(hitS){boom(p,hitS);mis.splice(i,1);continue}
      if(p.life<=0){fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:3,r:.8});mis.splice(i,1)}continue}
    if(tg&&!tg.alive){tg=p.tgt=null;p.rl=t+2.5}
    if(!tg){ // цель потеряна: летит прямо, медленно ищет новую впереди (узкий конус), топливо тает
      if(t>=(p.rl||0)){let b=null,bd=1e9;for(const o of around(1-p.side,p.x,p.y,90)){const a=Math.abs(adiff(p.h,Math.atan2(o.y-p.y,o.x-p.x)));if(a>1.1)continue;const dd=Math.hypot(o.x-p.x,o.y-p.y)*(1+a);if(dd<bd){bd=dd;b=o}}
        if(b){tg=p.tgt=b;p.pd=null}else p.rl=t+1.5}
      if(!tg){p.x+=Math.cos(p.h)*p.spd*dt;p.y+=Math.sin(p.h)*p.spd*dt;p.life-=dt;p.trT-=dt;if(p.trT<=0){p.trT=.6;p.tr.push(p.x,p.y,p.z);if(p.tr.length>12)p.tr.splice(0,3)}
        if(p.life<=0){fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:3,r:.8});mis.splice(i,1)}continue}}
    const d=Math.hypot(tg.x-p.x,tg.y-p.y),T0=d/p.spd;
    if(p.pd!=null&&d>p.pd&&p.pd<25){p.tgt=null;p.rl=t+3;p.pd=null;continue} // проскочила мимо
    p.pd=d;
    const ax=tg.x+tg.sx*T0-p.x,ay=tg.y+tg.sy*T0-p.y;
    if(d<45&&tg.jam>0&&t>=(p.blind||0)&&Math.random()<tg.jam*dt*.3*(p.jf||1)){p.blind=t+4;stat.decoy++;fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:3,r:1});say(tg.side,'jam',tg)}
    const TR=Math.min(1.2,3.2/p.spd)*(p.gq!=null?.5+.5*p.gq:1);if(t>=(p.blind||0)&&(!p.sr||d<p.sr))p.h+=Math.max(-TR*dt,Math.min(TR*dt,adiff(p.h,Math.atan2(ay,ax))));
    p.vx=Math.cos(p.h)*p.spd;p.vy=Math.sin(p.h)*p.spd;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=Math.max(-p.spd*.4*dt,Math.min(p.spd*.4*dt,tg.z-p.z));
    if(env.length&&los(p.x-p.vx*dt,p.y-p.vy*dt,p.x,p.y)){fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:4,r:1.5});mis.splice(i,1);continue}
    p.life-=dt;p.trT-=dt;if(p.trT<=0){p.trT=.6;p.tr.push(p.x,p.y,p.z);if(p.tr.length>12)p.tr.splice(0,3)}
    if(t>=(p.blind||0)&&Math.hypot(tg.x-p.x,tg.y-p.y)<Math.max(.3,tg.T.L*.8)+p.blast*.25){boom(p,tg);mis.splice(i,1);continue}
    if(p.life<=0)mis.splice(i,1);
  }
  for(let i=frags.length-1;i>=0;i--){const f=frags[i];if(t-f.t0>f.d){frags[i]=frags[frags.length-1];frags.pop();continue}f.x+=f.vx*dt;f.y+=f.vy*dt;if(f.vz)f.z+=f.vz*dt;if(f.plate){f.rx+=f.vrx*dt;f.ry+=f.vry*dt}f.rot+=f.vr*dt;if(f.ln)f.vx*=1-.4*dt,f.vy*=1-.4*dt}
  podStep(dt);
  for(let i=pyro.length-1;i>=0;i--){const q=pyro[i];if(t<q.next)continue;q.next=t+R(.25,.7);q.n--;
    const ox=q.x+q.vx*(t-q.t0),oy=q.y+q.vy*(t-q.t0),off=R(-.5,.5)*q.L,px=ox+Math.cos(q.hd)*off,py=oy+Math.sin(q.hd)*off;
    fx.push({x:px,y:py,z:q.z,t0:t,d:4,r:q.L*R(1.4,3)});spawnShards(px,py,q.z,6,R(5,10));if(Math.random()<.5)spawnFrags(px,py,q.z,2,3,q.L,null);SFX.boom(8);
    for(const o of ships){if(!o.alive||o.side===q.side&&false)continue;if(Math.hypot(o.x-px,o.y-py)<q.L*1.8+2)hitShip(o,'mis',o.x-px,o.y-py,px,py,1)}
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
      if(Math.hypot(o.x-p.x,o.y-p.y)<TORP.pdr&&Math.random()<TORP.pd*dt){shot=true;break}}
    if(shot){stat.torpPd[p.side]++;fx.push({x:p.x,y:p.y,t0:t,d:10,r:4});torps.splice(i,1)}
  }
  smokeStep(dt);
  fx=fx.filter(f=>t-f.t0<f.d);
}
let smoke=[];
const WR={cv:.38,hc:.32,fr:.3,dd:.24};
// сигнатуры: тепловая (двигатели, форсаж, перегрев, залпы) и электромагнитная (радар, залпы)
function sigOf(o){const L2=o.T.L*o.T.L,sh=t-o.flash<8?1:0;
  const h=(.6+L2)*(1+1.8*Math.max(0,o.bst-1)+o.heat*1.2+sh*.6-(o.engN>0?0:.5)),e=.3+L2*.3+(o.rdOn?3+L2*5:0)+sh*.5;
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
        if(q.k==='rad'){if(!s.rdOn)continue;const er=q.rng*(s.side===0?rr:1)*Math.sqrt(1+o.T.L)*(1-o.jam)*(s.rad0?.55+.45*s.radN/s.rad0:1);if(d<er){det=true;if(q.fine||!small)lk=true}}
        else{const er=q.rng*(s.side===0?rr:1)*Math.sqrt(q.k==='ir'?sg[0]:sg[1])*(small&&q.res<.66?.25:1);if(d<er)det=true}}
      if(det){if(o.seen[s.side]<0)say(s.side,'contact',s);o.seen[s.side]=t}
      if(lk)o.lock[s.side]=t}}
  for(const sd of [0,1])if(SB[sd].length)for(const o of SB[1-sd]){o.lock[sd]=t;o.seen[sd]=t} // радары пока не нужны: на дистанциях боя все видят всех
  for(const c of air){if(c.state!=='fly')continue;for(const o of around(1-c.side,c.x,c.y,70)){o.seen[c.side]=t;o.lock[c.side]=t}}
}
function crewStep(dc){
  env=env.filter(e=>e.ttl>t);for(const e of env)if(e.vx||e.vy){e.x+=e.vx*dc;e.y+=e.vy*dc}
  for(const s of ships){if(!s.alive)continue;const sk=s.spec.sk||5.5,hp=hpf(s);
    // тепло
    { const sp=s.spec,idle=sp.idleMW!=null&&sp.real?sp.idleMW:6,sink=sp.sinkMW!=null&&sp.real?sp.sinkMW:idle*1.6; // электроника и экипаж греют корпус; радиаторы (64 кВт на панель при 500 K) отводят, пока корпус теплее нормы
      const out=s.heat>0?sink*(.5+.5*hp)*(s.side===0?1+ta('dcx'):1):Math.min(sink,idle);addHeat(s,(idle-out)*dc);
      if(s.magEjT&&t>=s.magEjT){s.magEjT=0;s.mag=0;say(s.side,'mod',s)} } // погреб отстрелен
    if(s.heat>1&&!s.ovh){s.ovh=1;stat.ovh++;say(s.side,'heat',s)}else if(s.ovh&&s.heat<.55)s.ovh=0;
    if(s.heat>1.4&&Math.random()<.03*dc){const al=s.tur.filter(m=>m.alive);if(al.length){const m=al[(Math.random()*al.length)|0];m.alive=false;s.aliveN--;fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:6,r:1.5});s.heat=1}}
    // боезапас орудий: без снарядов корабль уходит из боя
    {let am=0,cp=0,oth=0;for(const m of s.tur){if(!m.alive)continue;if(m.k==='T'){am+=m.am;cp+=70}else if(m.k==='L'||(m.k==='M'&&m.ammo>0))oth++}
     s.ammoF=cp?am/cp:1;s.dry=cp>0&&am<=cp*.06&&!oth&&!s.car}
    if(s.flee&&!s.T.role&&s.st!=='surr'&&t>(s.fleeT0=s.fleeT0||t)+20){const nn=nearestShip(s.x,s.y,1-s.side);if(!nn||nn.d>600){s.esc=1;s.alive=false;stat.esc=stat.esc||[0,0];stat.esc[s.side]++;fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:6,r:2});continue}}else if(!s.flee)s.fleeT0=0;
    // пожары и аварийная команда
    const dcp=.05*(.4+.6*s.crew)*sk/6*(s.spec.dcon!=null?.4+.9*Math.min(4,s.spec.dcon):1)*(s.side===0?1+ta('dcx'):1);
    for(let zi=0;zi<4;zi++){const f=s.fire[zi];if(!f)continue;
      if(Math.random()<.5*f*dc/12){const al=s.zones[zi].mods.filter(m=>m.alive&&m.k!=='C');if(al.length){const m=al[(Math.random()*al.length)|0];mdead(s,m);fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:5,r:1.6});if(s.aliveN<s.total*.22)kill(s,'пожар')}}
      if(s.alive&&Math.random()<dcp*dc)s.fire[zi]--}
    if(!s.alive)continue;
    // ремонт модулей, когда не под огнём
    if(t-s.hitT>10&&s.crew>.15&&s.st!=='surr'&&t>=s.blk&&s.reps<s.total*.6&&Math.random()<.03*dc*(.5+sk/10)*s.crew){
      let pick=null;for(const k of ['E','R','T','A','L','M','D'])for(const z of s.zones)for(const m of z.mods)if(!pick&&!m.alive&&m.k===k)pick=m;
      if(pick){mrev(s,pick);s.reps++;stat.rep++;say(s.side,'dmg',s)}}
    // мораль
    let dm=.004*(.5+sk/10)*dc*(t-s.hitT>6?1:.3);
    if(s.F&&s.F.ratio!=null&&s.F.ratio<.7)dm-=.007*(.7-s.F.ratio)*dc;
    if(s.crew<.25)dm-=.003*dc;
    s.mor=Math.max(0,Math.min(1,s.mor+dm));
    if(false&&s.st==='ok'&&s.mor<.3&&!s.T.role){s.st='panic'; /* паника и сдача отключены */say(s.side,'flee',s)}
    else if(s.st==='panic'&&s.mor>.5)s.st='ok';
    if(false&&(s.st==='panic'||s.st==='ok')&&s.mor<.12&&hp<.6&&!s.T.role&&Math.random()<.2*dc){s.st='surr';stat.surr[s.side]++;say(s.side,'surr',s)}
    // эвакуация экипажа: корабль гибнет, горит или остался без жизни
    {const hz=s.aliveN/s.total,fs=s.fire[0]+s.fire[1]+s.fire[2]+s.fire[3];
     if(!s.evac&&s.crew>.1&&(hz<.34||(s.ecore&&hz<.5)||fs>=7||s.heat>1.5)&&Math.random()<(.5+.5*(1-s.mor))*dc*.35){s.evac=t;s.abd=1;s.st='surr';s.tg=null;stat.abd=(stat.abd||0)+1;say(s.side,'evac',s)}
     if(s.evac&&s.crew>.01)launchPods(s,.22)}
    // десант: шлюпки с морпехами
    if(s.mar>=3&&s.st==='ok'&&t>=s.blk&&t>=s.ldT&&t>=(s.ldC||0)){
      s.ldC=t+R(3,6);let b=null,bd=110;for(const o of around(1-s.side,s.x,s.y,110)){if(o.st==='surr'||o.abd||t<o.blk||o.engN===0||hpf(o)<.55){const d=Math.hypot(o.x-s.x,o.y-s.y);if(d<bd){bd=d;b=o}}}
      if(b){const n=Math.min(s.mar,Math.max(3,Math.ceil(s.mar*.5))),nb=Math.max(1,Math.min(6,Math.round(n/4)));s.mar-=n;s.ldT=t+30;say(s.side,'board',s);
        for(let i=0;i<nb;i++)lands.push({x:s.x,y:s.y,z:s.z,vx:s.sx,vy:s.sy,n:n/nb,side:s.side,fid:s.fid,sk:(s.spec.sk||5)/10,cr:s.crew,tg:b,t0:t,ph:Math.random()*6});
        stat.land=(stat.land||0)+nb}}
  }
}
function resolveBoard(l){const o=l.tg;if(!o||!o.alive)return;
  if(o.side===l.side){o.mar+=l.n;return}
  const att=l.n*(.6+l.sk)*(.4+.6*l.cr),def=(o.st==='surr'?1.5:o.T.role?3:6+o.T.L*10)*(.3+o.crew)*(.4+.6*o.mor)*(o.abd?.4:1);
  fx.push({x:o.x,y:o.y,z:o.z,t0:t,d:4,r:o.T.L*.5});
  if(Math.random()<att/(att+def)){
    o.prizeFrom=o.side;o.side=l.side;o.fid=l.fid;o.st='ok';o.mor=.5;o.crew=Math.max(.2,o.crew*.5);o.evac=0;o.abd=0;o.prize=1;o.tg=null;o.nt=0;o.mar=Math.floor(l.n*.5);o.blk=0;o.seen=[t,t];o.lock=[t,t];
    for(const c of air)if(c.home===o&&c.state!=='dead')killCraft(c,'captured');
    stat.cap[l.side]++;say(l.side,'prize',o)}
  else{stat.bfail[l.side]++;o.mor=Math.max(0,o.mor-.03)}
}
function smokeStep(dt){
  if(smoke.length>700)smoke=smoke.slice(-500);
  smoke=smoke.filter(q=>t-q.t0<q.d);
  for(const s of ships){
    const dead=s.total-s.aliveN;if(dead<=0&&s.alive)continue;
    const rate=s.alive?Math.min(6,dead*.5):4;let n=Math.min(6,Math.floor(rate*dt+Math.random()));
    const ms=[];for(const z of s.zones)for(const m of z.mods)if(!m.alive)ms.push(m);
    while(n-->0){const m=ms.length?ms[(Math.random()*ms.length)|0]:{u:0,v:0},c=Math.cos(s.hd),sn=Math.sin(s.hd),L=s.T.L,lu=m.u*L,lv=m.v*L*(WR[s.cls]||.3)*1.4;
      smoke.push({z:s.z,x:s.x+lu*c-lv*sn,y:s.y+lu*sn+lv*c,vx:R(-.15,.15)*L,vy:R(-.15,.15)*L,t0:t,d:R(8,18)*(s.alive?1:1.8),r0:L*.025,L,fire:Math.random()<(s.alive?.35:.55)})}
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
      const bo=s.bst>1.15,fl=len*(.14+.06*Math.random())*(1+(s.bst-1)*1.8),ex=m.u*len,ey=m.v*wid*.7;
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
   if(md<200)hadContact=true;if(hadContact&&md>420&&F.length>1){sepT+=1;if(sepT>90&&cfgNow&&cfgNow.demo)done=true}else sepT=0}
  if(aliveBy(0))lastFriend=t;
  if((!aliveBy(1)&&!pend.length)||(!aliveBy(0)&&t-lastFriend>1800)||t>((cfgNow&&cfgNow.maxT)||14400)||((()=>{const na=aliveBy(0)+aliveBy(1);if(na!==lastNa){lastNa=na;lastNaT=t}return false})()))done=true; // ничья: никто никого не бьёт уже 8 минут (кончились снаряды, сдавшиеся)
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
  return `Оружие: ${parts.join(' · ')||'нет'}<br>${mag}${en} · ${fu}`}
// панель справа: каждая деталь выбранного корабля — состояние и что она делает сейчас (и почему)
const MODNAME={T:'Рельсотрон',A:'Зенитка ПВО',G:'Миниган',L:'Лазер',M:'Ракетная установка',E:'Двигатель',R:'Маневровый двигатель',D:'Радар',C:'Ядро (мостик, реактор)'};let mpT=0;
function modPanel(s){let el=document.getElementById('bmods');
  if(!s||!viewed){if(el)el.hidden=true;return}
  if(!el){el=document.createElement('div');el.id='bmods';el.style.cssText='position:fixed;right:8px;top:56px;width:400px;max-height:calc(100vh - 80px);overflow:auto;z-index:60;background:rgba(10,14,22,.93);border:1px solid #2b3647;border-radius:8px;padding:8px 10px;font:12px/1.35 system-ui,sans-serif;color:#cfd8e6';document.body.appendChild(el)}
  el.hidden=false;const now=performance.now();if(now-mpT<250)return;mpT=now;
  const moving=Math.hypot(s.sx||0,s.sy||0)>.002,mods=[];for(const z of s.zones)for(const m of z.mods)mods.push([m,z]);
  const ord={T:0,G:1,A:2,L:3,M:4,E:5,R:6,D:7,C:8};mods.sort((a,b)=>(ord[a[0].k]??9)-(ord[b[0].k]??9));
  const cnt={};let h=`<b class="c${'ab'[s.side]}">${s.T.n}</b> — детали (${s.aliveN}/${s.total})<br><span class="muted">цель: ${s.tg&&s.tg.alive?s.tg.T.n+' · '+Math.hypot(s.tg.x-s.x,s.tg.y-s.y).toFixed(1)+' км':'нет'} · высота ${Math.round(s.z||0)} км</span><hr style="border-color:#2b3647">`;
  { h+=`<b>Броня</b> <span class="muted">· сталь, слой 2 см держит ${(LAYER_MM/MM_E*1000).toFixed(0)} кДж/см²</span>`;
    const sec=s.zones.map((z,i)=>{const F=z.arm*LAYER_MM;let mn=F,n=0;if(z.g)for(const v of z.g.values()){n++;if(v<mn)mn=v}return `<b>${ZN[i]} ${F/10} см</b>: ${n?'тронуто '+n+' яч., тоньше всего '+(Math.round(mn)/10)+' см':'целая'}`});h+=`<div class="muted" style="margin:2px 0 4px">${sec.join(' · ')}</div>`;
    for(const q of (s.hl||[]).slice(0,8)){const W=260,sc=W/Math.max(1,q.F),pre=Math.max(0,q.F-q.before),cut=Math.max(0,q.before-q.after),thr=q.left>0; // полоса = толщина брони: серое — выбито раньше, оранжевое — этим ударом, синее — осталось, красное — пробил насквозь
      h+=`<div style="margin:3px 0"><span class="muted">${q.k}, ${q.v.toFixed(1)} км/с, ${q.Eu<.1?q.Eu.toFixed(3):q.Eu.toFixed(1)} МДж/см² → ${q.dep<10?q.dep.toFixed(1):Math.round(q.dep)} мм</span><br>
        <span style="display:inline-block;width:${W}px;height:9px;background:#1b2433;vertical-align:middle;position:relative"><span style="position:absolute;left:0;width:${pre*sc}px;height:9px;background:#4a5262"></span><span style="position:absolute;left:${pre*sc}px;width:${Math.max(1,cut*sc)}px;height:9px;background:#ffa040"></span><span style="position:absolute;left:${(pre+cut)*sc}px;width:${q.after*sc}px;height:9px;background:#5f9ad8"></span></span>
        <span style="color:${thr?'#ff6b5a':'#8fe3a0'}"> ${thr?'насквозь, +'+Math.round(q.left)+' мм в модули':'осталось '+(q.after<10?q.after.toFixed(1):Math.round(q.after))+' мм'}</span></div>`}
    if(!(s.hl||[]).length)h+='<div class="muted">попаданий в броню ещё не было</div>';h+='<hr style="border-color:#2b3647">'}
  for(const[m,z]of mods){cnt[m.k]=(cnt[m.k]||0)+1;const nm=(MODNAME[m.k]||m.k)+' №'+cnt[m.k],zi=s.zones.indexOf(z),side=ZN[zi]||'';
    let st,col;if(!m.alive){st='уничтожен';col='#ff6b5a'}else{col='#8fe3a0';
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
    h+=`<span class="c${'ab'[s]}"><b>${(cfgNow&&cfgNow.names||['Ваш флот','Налётчики'])[s]}</b>${sh}${stat.plan&&stat.plan[s]?' · план: <b>'+stat.plan[s]+'</b>':''} · рельсы ${stat.shots[s]}/${stat.hits[s]} (${acc}) · истр. ${F} (−${stat.lostF[s]}) · бомб. ${Bm} (−${stat.lostB[s]}) · торп. ${stat.torp[s]}→${stat.torpHit[s]} · ПВО ${stat.flak[s]} · лазеры ${stat.las[s]} · ракеты ${stat.mis[s]}→${stat.misHit[s]} (сбито ${stat.misShot[1-s]}) · сломано двиг. ${stat.bfail[s]}</span>`;
  }
  if(done)h+=`<span class="${al[0]?'ca':'cb'}"><b>Итог</b>${!al[1]&&al[0]?'победа':!al[0]&&al[1]?'поражение':!al[0]?'взаимное уничтожение':'враг отступил'}</span>`;
  $b('bstats').innerHTML=h;
  const inf=$b('binfo');
  if(sel){inf.hidden=false;const s=sel,tur=s.tur.filter(m=>m.alive).length,sk=s.tur.length?(s.tur.reduce((a,m)=>a+m.sk,0)/s.tur.length).toFixed(1):'—';
    inf.innerHTML=`<b class="c${'ab'[s.side]}">${s.T.n}</b>${s.alive?'':' <span class="muted">(уничтожен)</span>'}<br>Водоизмещение ${fmtN(s.T.tons)} т · длина ${Math.round(s.T.L*1000)} м · модули: ${s.aliveN}/${s.total} · ядро ${s.core.alive?'цело':'уничтожено'}<br>Турели: ${tur}/${s.tur.length} · ср. навык ${sk}<br>Двигатели: ${s.engN}/${s.T.eng} · маневровые ${s.rcsN}/${s.rcs0} · радар ${s.radN}/${s.rad0} · заряжено в башнях ${Math.round((s.ammoF==null?1:s.ammoF)*100)}%${s.holdK==='cover'?' · в укрытии':s.holdK==='escort'?' · охраняет':''}${s.bst>1.1?' · форсаж '+Math.round(s.bst*100)+'%':''}${s.lrp?' · дальний бой '+s.lrp.toFixed(0):''}<br>${shipArms(s)}<br>Высота: ${s.z.toFixed(0)}<br>Броня по секторам: ${s.zones.map((z,i)=>ZN[i]+' '+(s.T.arm?Math.round(100*z.armN/(z.nc*s.T.arm)):0)+'%').join(' · ')}`}
  else inf.hidden=true;
  modPanel(sel);
  {const so=$b('bsord'),ok=!!(sel&&sel.alive&&sel.side===0);so.hidden=!ok;if(ok)for(const b of so.querySelectorAll('[data-so]'))b.classList.toggle('on',b.dataset.so===(sel.ord||''))}
}
const PM=['точки','короткие линии','скрыть'];
let bspeed=30,sepT=0,hadContact=false;
function frame(rdt){if(!active||done)return;const sim=rdt*bspeed,n=Math.min(4,Math.max(1,Math.ceil(sim/2)));for(let i=0;i<n;i++){tick(Math.min(2,sim/n))}}
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
function tickN(rdt){if(!active||done)return;const sim=rdt*bspeed,n=Math.min(4,Math.max(1,Math.ceil(sim/2)));for(let i=0;i<n;i++){tick(Math.min(2,sim/n))}}
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
return {tickFixed:n=>{for(let i=0;i<n&&active&&!done;i++)tick(2)},setMuzzle:f=>{MUZ=f},shuttles:()=>shuttles,tracers:()=>tracers,env:()=>env,impacts:()=>impacts,frags:()=>frags,turAim,shots:()=>shots,fx:()=>fx,proj:()=>proj,mis:()=>mis,air:()=>air,beams:()=>beams,select:q=>{sel=q},moveFleet:(q,x,y)=>{if(q&&q.F)q.F.mv={x,y}},stat:()=>stat,frame,fastForward,setSpeed:v=>{bspeed=v},getSpeed:()=>bspeed,anchorSel:()=>sel,abort,ships:()=>ships,begin,tick,draw,hud,pick,join,finish,isDone:()=>done,active:()=>active,hot:()=>autoSlow&&t-lastEng<3,later:(tt,spec)=>pend.push({t:t+tt,spec}),time:()=>t,clear:()=>{sel=null},beginBg,view:()=>{viewed=true;bound=false;bind();$b('btitle').textContent=(cfgNow&&cfgNow.title)||'Бой';$b('battle').hidden=false},unview:()=>{viewed=false;const e=document.getElementById('bmods');if(e)e.hidden=true},setViewed:v=>{viewed=v;if(v){bound=false;bind()}},isViewed:()=>viewed,cfg:()=>cfgNow,result,setBSpeed:v=>{bspeed=v},addLate:e=>{pend.push({...e,t:t+(e.t||0)});pend.sort((a,b)=>a.t-b.t)},hide:()=>{$b('battle').hidden=true;const e=document.getElementById('bmods');if(e)e.hidden=true},tickN,sim:()=>({alive:[aliveBy(0),aliveBy(1)]})};
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
    spd: st.bspd || 1, railCfg: st.railList, flakCfg: st.flakList, gat: st.gat, gatCfg: st.gatList, miss: st.msl, missCfg: st.misList, fuelCap: st.fuelCap || 0, frate: st.fuelRate || 0, engT: st.engM || 0, pow: st.power || 0,
    ammoCap: st.ammoCap || 0, energy: st.energy || 0, defl: st.defl, trail: st.trail || null, scList: st.scList || [], fcsN: st.fcsN || 0, ew: st.ew || 0, mar: 0, dcon: st.dcon || 0, sink: st.sink || 0, idleMW: st.enIdle || 0, sinkMW: st.sinkMW || 0, magArm: st.magArm || 0, magEj: st.magEj || 0, magFr: (st.ammoCap || 0) * 1.1 / Math.max(1, st.tons || st.dry)};
}
export function specFromShip(s) {
  const st = s.st, cmd = (function(){ try { return effSkill(s, "cmd") } catch (e) { return 4 } })();
  return {real: 1, engCnt: st.engines || 0, name: s.name, ref: s.id, arm: st.armor, rails: st.rail, flak: st.flak, eng: Math.max(1, Math.min(6, st.engines)), L: st.L, tons: st.tons,
    F: s.air.F, B: s.air.B, sk: Math.max(3, Math.min(9, cmd || 4)), dmg: s.hullDmg || 0, spd: st.bspd || (shipSpeedTrue(s) > 0 ? shipSpeedTrue(s) * AU_M / 86400 / 1000 / (.2 * VMK) : (st.L < 1 ? 1.25 : 1)) /* единая скорость: как на карте, км/с */,
    lasers: st.lgun, laserCfg: st.lasList, miss: st.msl, missCfg: st.misList, railCfg: st.railList, flakCfg: st.flakList, gat: st.gat, gatCfg: st.gatList, fuel: s.fuel != null ? s.fuel : null, fuelCap: st.fuelCap || 0, frate: (st.fuelRate || 0) * (function(){ try { return pilFuel(s) } catch (e) { return 1 } })(), fpa: (function(){ try { return fuelPerAU(s) } catch (e) { return 0 } })(), engT: st.engM || 0, pow: st.power || 0, hang: st.hangList || null, ammoCap: st.ammoCap || 0, energy: st.energyLeft != null ? st.energyLeft : (st.energy || 0), defl: st.defl, fq: st.fq, bq: st.bq, trail: st.trail || null, scList: st.scList||[], fcsN: st.fcsN||0, ew: st.ew||0, mar: st.mar||0, dcon: st.dcon||0, sink: st.sink||0, idleMW: st.enIdle||0, sinkMW: st.sinkMW||0, magArm: st.magArm||0, magEj: st.magEj||0, magFr: (st.ammoCap||0)*1.1/Math.max(1, st.tons||st.dry)};
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
  const r = state.raid; r.k++; r.eta = state.t + 90 + Math.random() * 60; r.warned = false; r.active = false; state.inBattle = false;
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
