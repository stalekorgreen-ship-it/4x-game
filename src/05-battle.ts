// @ts-nocheck
import { RES, compOf, dist, fmtN, log, mkKey, rec, state } from './01-data.ts';
import { effSkill, officerById } from './02-crew.ts';
import { W, bar, cx, focusBattle, ui } from './08-map-ui.ts';

/* ===== БОЙ (движок боя из демо) ===== */
export const Battle = (() => {
const $b = id => document.getElementById(id);

const DOPT={hc:20,dd:20,fr:35,cv:100},JINK=0.0015,VP=6,LIFE=10,RANGE=VP*LIFE,SIGMA=0.02,LAUNCH=450,SUB=0.25,REL=60;
const FI={vmax:2,a:0.25,fuel:1500,ammo:60,hp:8,gun:4},BO={vmax:0.8,a:0.05,fuel:2200,hp:4};
const TORP={sp:2.5,pd:0.02,pdr:35,launch:120,mod:2};
const FLAK={range:60,blast:1.2};
const RC0={dmg:1,vp:6,rng:60,shells:1,rel:1,fail:0,sig:1},FC0={blast:1.2,rng:60,rel:1,fail:0};
const ZN=['нос','правый борт','корма','левый борт'];
const BSPEEDS=[1,5,20,100,300];
let ships,proj,fx,flights,air,torps,shots,fly,t,paused=false,speed=100,acc=0,stat,lastEng=-99,autoSlow=true,autoCam=true,sel=null,projMode=0,done=false,isOpen=false,cfgNow=null,bound=false,last=0;
let pend=[],lastFriend=0,vw={ox:0,oy:0,kk:1},active=false;
const R=(a,b)=>a+Math.random()*(b-a);
const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=Math.random();return (u-2)*1.73};
const adiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;return d};
const classify=sp=>sp.F+sp.B>0?'cv':(sp.flak>=sp.rails&&sp.flak>0)?'fr':(sp.L>=1.6||sp.rails>=40)?'hc':'dd';
function mkShip(side,sp,x,y){
  const T={n:sp.name,defl:sp.defl||0,arm:sp.arm,eng:Math.max(1,sp.eng||3),spd:sp.spd||1,L:Math.max(0.3,sp.L),dopt:sp.dopt};
  const zones=ZN.map(()=>({arm:T.arm,mods:[]}));
  const add=(k,z)=>{const m={k,alive:true,sk:(k==='T'||k==='A')?Math.max(1,Math.min(10,Math.round((sp.sk||5.5)+gauss()*2))):0,cd:R(0,REL),z};zones[z].mods.push(m);return m};
  const tur=[];for(let i=0;i<sp.rails;i++){const m=add('T',i%4);m.cfg=(sp.railCfg&&sp.railCfg[i])||RC0;tur.push(m)}for(let i=0;i<sp.flak;i++){const m=add('A',(i+2)%4);m.cfg=(sp.flakCfg&&sp.flakCfg[i])||FC0;tur.push(m)}
  for(let i=0;i<T.eng;i++)add('E',2);
  const core=add('C',(Math.random()*4)|0),total=sp.rails+sp.flak+T.eng+1;
  const sh={side,cls:sp.cls,T,x,y,vx:0,vy:0,sx:0,sy:0,ax:0,ay:0,next:0,alive:true,car:(sp.F+sp.B)>0,hd:side?Math.PI:0,zones,tur,core,total,aliveN:total,engN:T.eng,pool:{ammo:30*sp.F,torp:sp.B},nextL:0,spec:sp};
  zones.forEach((z,zi)=>{const ms=z.mods.filter(m=>m.k!=='C'),n=ms.length;ms.forEach((m,i)=>{
    if(zi===0){m.u=.3+.06*(i%2);m.v=(i-(n-1)/2)*.16}else if(zi===2){m.u=-.4;m.v=(i-(n-1)/2)*.2}
    else{m.u=-.26+.52*(i+.5)/n;m.v=(zi===1?1:-1)*.2}});});
  core.u=.02;core.v=0;
  const cand=[];for(const z of zones)for(const m of z.mods)if(m.k!=='C')cand.push(m);
  const kill=Math.floor((sp.dmg||0)*(total-1));
  for(let i=0;i<kill&&cand.length;i++){const m=cand.splice((Math.random()*cand.length)|0,1)[0];m.alive=false;sh.aliveN--;if(m.k==='E')sh.engN--}
  return sh;
}
function addFlights(sh,ty,total){
  const q=sh.spec[ty==='F'?'fq':'bq'],P=Object.assign({},ty==='F'?FI:BO);if(q){P.hp=q.hp;P.vmax=q.vmax;if(q.ammo)P.ammo=q.ammo}
  const per=ty==='F'?10:5,nfl=Math.ceil(total/per);let left=total;
  for(let f=0;f<nfl;f++){const n=Math.min(per,left);left-=n;
    const fl={side:sh.side,type:ty,home:sh,cr:[],mode:'bay',svc:0,t0:0,leader:null,lane:(f-(nfl-1)/2)*(ty==='F'?18:30)};
    for(let k=0;k<n;k++){const c={side:sh.side,type:ty,fl,home:sh,own:sh,x:sh.x,y:sh.y,vx:0,vy:0,h:sh.side?Math.PI:0,P,hp:P.hp,ammo:ty==='F'?P.ammo:1,fuel:P.fuel,
      state:'bay',launched:false,launchAt:0,ret:false,cd:R(0,.5),jx:0,jy:0,jt:0,tg:null,goal:null,sh:null,slot:k,eng:-99,tr:[],trT:0,na:0};fl.cr.push(c);air.push(c)}
    flights.push(fl)}
}
function reset(cfg){
  ships=[];smoke=[];proj=[];fx=[];flights=[];air=[];torps=[];shots=[];fly=[[],[]];t=0;lastEng=-99;sel=null;done=false;pend=(cfg.late||[]).map(x=>({t:x.t,spec:x.spec}));lastFriend=0;
  stat={shots:[0,0],hits:[0,0],torp:[0,0],torpHit:[0,0],torpPd:[0,0],flak:[0,0],flakKill:[0,0],lostF:[0,0],lostB:[0,0]};
  const X={dd:8,hc:2,fr:-4,cv:-12};
  cfg.fleets.forEach((list,side)=>{
    const dir=side?-1:1;
    for(const sp of list){sp.cls=classify(sp);sp.dopt=DOPT[sp.cls]}
    for(const cl of ['dd','hc','fr','cv']){const grp=list.filter(sp=>sp.cls===cl);
      grp.forEach((sp,i)=>{const sh=mkShip(side,sp,(side?500:-500)+dir*X[cl],(i-(grp.length-1)/2)*8);ships.push(sh);
        if(sh.car){if(sp.F>0)addFlights(sh,'F',sp.F);if(sp.B>0)addFlights(sh,'B',sp.B)}})}
  });
}
function nearestShip(x,y,side){let b=null,bd=1e9;for(const o of ships){if(!o.alive||o.side!==side)continue;const d=Math.hypot(o.x-x,o.y-y);if(d<bd){bd=d;b=o}}return b?{s:b,d:bd}:null}
function nearestCar(c){let b=null,bd=1e9;for(const o of ships){if(!o.alive||!o.car||o.side!==c.side)continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d<bd){bd=d;b=o}}return b}
function foeCraft(c,maxd,bonusB,onlyF){let b=null,bs=1e9;for(const o of fly[1-c.side]){if(onlyF&&o.type!=='F')continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d>maxd)continue;const sc=d-(o.type==='B'?bonusB:0)+15*o.att;if(sc<bs){bs=sc;b=o}}return b}
function killCraft(c,why){if(c.state==='dead')return;c.state='dead';(stat.why=stat.why||{})[why||'combat']=((stat.why||{})[why||'combat']||0)+1;stat[c.type==='F'?'lostF':'lostB'][c.side]++;fx.push({x:c.x,y:c.y,t0:t,d:6,r:1.2})}
function reloadCraft(c){const P=c.P,p=c.home.pool;c.fuel=P.fuel;c.hp=P.hp;c.ret=false;
  if(c.type==='F'){const k=Math.min(P.ammo-c.ammo,p.ammo);c.ammo+=k;p.ammo-=k}else{const k=Math.min(1-c.ammo,p.torp);c.ammo+=k;p.torp-=k}}
function stepFlights(){
  for(const fl of flights){
    const live=fl.cr.filter(c=>c.state!=='dead');if(!live.length)continue;
    if(fl.mode==='bay'){
      if(!fl.home.alive){live.forEach(c=>killCraft(c,'hangar'));continue}
      if(fl.svc>0){fl.svc-=1;if(fl.svc<=0)live.forEach(reloadCraft);continue}
      const foe=nearestShip(fl.home.x,fl.home.y,1-fl.side);
      if(foe&&foe.d<LAUNCH&&live.some(c=>c.ammo>0)){fl.mode='out';fl.t0=t;const h=fl.home;
        for(const c of live){if(c.ammo>0){h.nextL=Math.max(h.nextL,t)+0.4;c.launchAt=h.nextL;c.launched=false}else c.launched=true}}
    }else if(live.every(c=>c.state==='bay'&&c.launched)){fl.mode='bay';fl.svc=90;live.forEach(c=>c.launched=false)}
    if(fl.mode==='out')for(const c of live){
      if(c.state==='bay'&&!c.launched&&t>=c.launchAt&&c.home.alive){const h=c.home;
        c.state='fly';c.launched=true;c.ret=false;c.x=h.x;c.y=h.y;c.tr=[];
        const dir=h.side?-1:1;c.vx=h.sx+dir*0.5;c.vy=h.sy+R(-0.2,0.2);c.h=dir>0?0:Math.PI}}
  }
}
function assign(){
  fly=[[],[]];for(const c of air){c.att=0;if(c.state==='fly')fly[c.side].push(c)}
  for(const c of air)if(c.state==='fly'&&c.tg&&c.tg.state==='fly')c.tg.att++;
  for(const fl of flights){const live=fl.cr.filter(c=>c.state==='fly'&&!c.ret);fl.leader=live[0]||null;live.forEach((c,i)=>c.slot=i)}
  for(const c of air){if(c.state!=='fly')continue;
    const P=c.P;
    if(!c.home.alive){const h=nearestCar(c);if(h)c.home=h}
    if(!c.ret){const dh=Math.hypot(c.home.x-c.x,c.home.y-c.y);
      if(c.fuel<dh/(P.vmax*0.6)+80||(c.type==='F'&&c.ammo<=0))c.ret=true}
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
      c.tg=foeCraft(c,60,15);
      if(!c.tg){c.goal=foeCraft(c,1e9,200);if(!c.goal)c.ret=true}
    }else c.tg=foeCraft(c,15,0,true);
  }
}
function shoot(c,e,p){shots.push({x1:c.x,y1:c.y,x2:e.x,y2:e.y,rt:performance.now(),s:c.side});
  if(Math.random()<p){e.hp--;fx.push({x:e.x,y:e.y,t0:t,d:3,r:0.5});if(e.hp<=0)killCraft(e)}}
function craftStep(c,d){
  const P=c.P,home=c.home;
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
      if(c.cd<=0&&dist<P.gun&&c.ammo>0&&Math.abs(adiff(c.h,aim))<0.2){c.ammo--;c.cd=0.3;shoot(c,e,0.12*(1-dist/P.gun)+0.02)}
    }
  }else{
    const fl=c.fl,L=fl.leader;
    if(L===c||!L){const G=c.type==='F'?c.goal:c.sh;
      if(G){const bx=G.x-c.x,by=G.y-c.y,dist=Math.hypot(bx,by)||1e-6,off=c.fl.lane*Math.min(1,dist/(c.type==='F'?150:200)),dx=bx-by/dist*off,dy=by+bx/dist*off,dd=Math.hypot(dx,dy)||1e-6;vdx=dx/dd*P.vmax*0.8;vdy=dy/dd*P.vmax*0.8}}
    else{const sp=Math.hypot(L.vx,L.vy),ang=sp>0.05?Math.atan2(L.vy,L.vx):L.h,row=Math.ceil(c.slot/2),lat=(c.slot%2?1:-1)*row*1.5,back=row*1.5;
      const px=L.x+Math.cos(ang)*(-back)-Math.sin(ang)*lat,py=L.y+Math.sin(ang)*(-back)+Math.cos(ang)*lat;
      let ex=px-c.x,ey=py-c.y;const el=Math.hypot(ex,ey),cl=Math.min(el,1);if(el>1e-6){ex=ex/el*cl;ey=ey/el*cl}
      vdx=L.vx+ex*1.2;vdy=L.vy+ey*1.2}
    if(c.type==='B'&&c.tg&&c.tg.state==='fly'){const e=c.tg,dx=e.x-c.x,dy=e.y-c.y,dist=Math.hypot(dx,dy)||1e-6;fight=true;aim=Math.atan2(dy,dx);c.eng=t;lastEng=t;
      c.cd-=d;if(c.cd<=0&&dist<2.5){c.cd=0.6;shoot(c,e,0.03)}}
  }
  let ax=2*(vdx-c.vx)+(fight?c.jx:0),ay=2*(vdy-c.vy)+(fight?c.jy:0);
  if(fight)for(const m of c.fl.cr){if(m===c||m.state!=='fly')continue;const sx=c.x-m.x,sy=c.y-m.y,sd=Math.hypot(sx,sy);if(sd<1.2&&sd>1e-6){const f=0.15*(1.2-sd)/sd;ax+=sx*f;ay+=sy*f}}
  const al=Math.hypot(ax,ay);if(al>P.a){ax*=P.a/al;ay*=P.a/al}
  c.vx+=ax*d;c.vy+=ay*d;const v=Math.hypot(c.vx,c.vy);if(v>P.vmax){c.vx*=P.vmax/v;c.vy*=P.vmax/v}
  c.x+=c.vx*d;c.y+=c.vy*d;c.fuel-=d;
  if(c.fuel<=0){killCraft(c,'fuel');return}
  const want=fight&&aim!==null?aim:(v>0.05?Math.atan2(c.vy,c.vx):c.h);
  c.h+=Math.max(-3*d,Math.min(3*d,adiff(c.h,want)));
  c.trT-=d;if(c.trT<=0){c.trT=0.5;c.tr.push(c.x,c.y);if(c.tr.length>30)c.tr.splice(0,2)}
}
// armor: a hit pierces one layer in the zone it comes from; with no layers left it destroys modules behind
function hitShip(o,kind,vx,vy,x,y,dmg){
  if(!o.alive)return;
  if(o.T.defl&&Math.random()<o.T.defl){fx.push({x,y,t0:t,d:3,r:0.8});return}
  const a=adiff(o.hd,Math.atan2(-vy,-vx))+R(-0.9,0.9),ab=Math.abs(a);
  const zi=ab<0.785?0:ab>2.356?2:(a>0?1:3);let z=o.zones[zi];
  let dm=kind==='torp'?1:dmg;dm=Math.floor(dm)+(Math.random()<dm%1?1:0);
  if(z.arm>0&&dm>0){const c=Math.min(z.arm,dm);z.arm-=c;dm-=c;fx.push({x,y,t0:t,d:4,r:1});if(dm<=0)return}
  else if(dm<=0){fx.push({x,y,t0:t,d:2,r:0.5});return}
  if(!z.mods.some(m=>m.alive)){const cand=o.zones.filter(q=>q.mods.some(m=>m.alive));if(!cand.length)return;z=cand[(Math.random()*cand.length)|0]}
  const k=kind==='torp'?TORP.mod:dm;
  for(let i=0;i<k;i++){const al=z.mods.filter(m=>m.alive);if(!al.length)break;const m=al[(Math.random()*al.length)|0];m.alive=false;o.aliveN--;if(m.k==='E')o.engN--}
  fx.push({x,y,t0:t,d:10,r:3});
  if(!o.core.alive||o.aliveN<o.total*0.3){o.alive=false;fx.push({x:o.x,y:o.y,t0:t,d:40,r:26})}
}
function flakBurst(s,m){
  const F=m.cfg,cand=[];for(const c of fly[1-s.side])if(Math.hypot(c.x-s.x,c.y-s.y)<F.rng)cand.push(c);
  const tp=torps.filter(p=>p.side!==s.side&&Math.hypot(p.x-s.x,p.y-s.y)<F.rng);
  if(!cand.length&&!tp.length){m.cd=2;return false}
  const e=tp.length&&Math.random()<0.5?tp[(Math.random()*tp.length)|0]:(cand.length?cand[(Math.random()*cand.length)|0]:tp[0]);
  const d=Math.hypot(e.x-s.x,e.y-s.y),err=(0.25+0.012*d)*(1.4-0.08*m.sk);
  const bx=e.x+(e.vx||0)*1.5+gauss()*err,by=e.y+(e.vy||0)*1.5+gauss()*err;
  m.fa=Math.atan2(by-s.y,bx-s.x);m.rt=performance.now();stat.flak[s.side]++;shots.push({x1:s.x,y1:s.y,x2:bx,y2:by,rt:performance.now(),s:s.side});fx.push({x:bx,y:by,t0:t,d:3,r:F.blast});
  for(const c of fly[1-s.side])if(c.state==='fly'&&Math.hypot(c.x-bx,c.y-by)<F.blast){c.hp--;if(c.hp<=0){killCraft(c);stat.flakKill[s.side]++}}
  for(let i=torps.length-1;i>=0;i--){const p=torps[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast*1.5&&Math.random()<0.7){torps.splice(i,1);stat.torpPd[p.side]++;stat.flakKill[s.side]++}}
  return true;
}
// осечка: орудие клинит на 4 минуты, иногда взрывается
function jamChk(s,m,C){if(!C.fail||Math.random()>=C.fail)return;stat.jams=(stat.jams||0)+1;m.cd=240;fx.push({x:s.x,y:s.y,t0:t,d:6,r:1.5});if(Math.random()<0.15){m.alive=false;s.aliveN--;stat.boom=(stat.boom||0)+1;if(!s.core.alive||s.aliveN<s.total*0.3){s.alive=false;fx.push({x:s.x,y:s.y,t0:t,d:40,r:26})}}}
function step(dt){
  t+=dt;

  for(const s of ships){if(!s.alive)continue;
    if(t>=s.next){s.next=t+R(20,60);const a=R(0,6.283),m=R(0,0.003);s.ax=Math.cos(a)*m;s.ay=Math.sin(a)*m}
    s.vx+=s.ax*dt;s.vy+=s.ay*dt;const v=Math.hypot(s.vx,s.vy);if(v>0.03){s.vx*=0.03/v;s.vy*=0.03/v}
    const nr=nearestShip(s.x,s.y,1-s.side),eng=s.engN/s.T.eng,vm=0.2*s.T.spd;
    let vx=0,vy=0;
    if(nr){const dx=nr.s.x-s.x,dy=nr.s.y-s.y,dl=Math.hypot(dx,dy)||1,k=Math.max(-1,Math.min(1,(nr.d-s.T.dopt)/15));
      vx+=dx/dl*vm*k;vy+=dy/dl*vm*k;s.hd+=adiff(s.hd,Math.atan2(dy,dx))*Math.min(1,dt*0.05)}
    let cx=0,cy=0,cn=0;
    for(const o of ships){if(o===s||!o.alive||o.side!==s.side)continue;
      const dx=s.x-o.x,dy=s.y-o.y,d=Math.hypot(dx,dy)||1e-6;
      if(!o.car){cx+=o.x;cy+=o.y;cn++}
      if(d<5){const f=0.15*(5-d)/5/d;vx+=dx*f;vy+=dy*f}}
    if(!s.car&&cn){cx/=cn;cy/=cn;const dc=Math.hypot(cx-s.x,cy-s.y);if(dc>12){const m=Math.min(0.08,(dc-12)*0.01);vx+=(cx-s.x)/dc*m;vy+=(cy-s.y)/dc*m}}
    const vl=Math.hypot(vx,vy);if(vl>vm){vx*=vm/vl;vy*=vm/vl}
    s.sx=vx*eng+s.vx;s.sy=vy*eng+s.vy;
    s.x+=s.sx*dt;s.y+=s.sy*dt;
    let foes=null;
    for(const m of s.tur){
      if(!m.alive)continue;m.cd-=dt;if(m.cd>0)continue;
      const C=m.cfg;
      if(m.k==='A'){if(flakBurst(s,m)){m.cd=REL*C.rel*(1.3-0.06*m.sk)*R(.75,1.25);jamChk(s,m,C)}continue}
      if(!foes)foes=ships.filter(o=>o.alive&&o.side!==s.side&&Math.hypot(o.x-s.x,o.y-s.y)<80);
      const fl=foes.filter(o=>Math.hypot(o.x-s.x,o.y-s.y)<C.rng);
      if(!fl.length){m.cd=5;continue}
      const VPc=C.vp;
      for(let b=0;b<C.shells;b++){
      const o=fl[(Math.random()*fl.length)|0];
      let T=Math.hypot(o.x-s.x,o.y-s.y)/VPc;
      for(let i=0;i<3;i++){const px=o.x+o.sx*T,py=o.y+o.sy*T;T=Math.hypot(px-s.x,py-s.y)/VPc}
      const px=o.x+o.sx*T,py=o.y+o.sy*T,d=Math.hypot(px-s.x,py-s.y),e=(SIGMA*d+JINK*T*T)*(1.4-0.08*m.sk)*C.sig;
      const ax=px+gauss()*e-s.x,ay=py+gauss()*e-s.y,l=Math.hypot(ax,ay);
      m.fa=Math.atan2(ay,ax);m.rt=performance.now();
      proj.push({x:s.x,y:s.y,vx:ax/l*VPc,vy:ay/l*VPc,side:s.side,dist:0,dmg:C.dmg,max:C.rng});
      stat.shots[s.side]++}
      m.cd=REL*C.rel*(1.3-0.06*m.sk)*R(.75,1.25);jamChk(s,m,C);
    }
  }
  for(let i=proj.length-1;i>=0;i--){
    const p=proj[i],nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;let hit=null;
    for(const o of ships){if(!o.alive||o.side===p.side)continue;
      const dx=nx-p.x,dy=ny-p.y,l2=dx*dx+dy*dy||1;
      let u=((o.x-p.x)*dx+(o.y-p.y)*dy)/l2;u=Math.max(0,Math.min(1,u));
      if(Math.hypot(p.x+dx*u-o.x,p.y+dy*u-o.y)<o.T.L*0.25){hit=o;break}}
    if(hit){stat.hits[p.side]++;hitShip(hit,'rail',p.vx,p.vy,nx,ny,p.dmg);proj[i]=proj[proj.length-1];proj.pop();continue}
    p.x=nx;p.y=ny;p.dist+=Math.hypot(p.vx,p.vy)*dt;
    if(p.dist>=p.max){proj[i]=proj[proj.length-1];proj.pop()}
  }
  stepFlights();assign();
  const n=Math.max(1,Math.ceil(dt/SUB)),d=dt/n;
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
function smokeStep(dt){
  if(smoke.length>700)smoke=smoke.slice(-500);
  smoke=smoke.filter(q=>t-q.t0<q.d);
  for(const s of ships){
    const dead=s.total-s.aliveN;if(dead<=0&&s.alive)continue;
    const rate=s.alive?Math.min(6,dead*.5):4;let n=Math.min(6,Math.floor(rate*dt+Math.random()));
    const ms=[];for(const z of s.zones)for(const m of z.mods)if(!m.alive)ms.push(m);
    while(n-->0){const m=ms.length?ms[(Math.random()*ms.length)|0]:{u:0,v:0},c=Math.cos(s.hd),sn=Math.sin(s.hd),L=s.T.L,lu=m.u*L,lv=m.v*L*(WR[s.cls]||.3)*1.4;
      smoke.push({x:s.x+lu*c-lv*sn,y:s.y+lu*sn+lv*c,vx:R(-.15,.15)*L,vy:R(-.15,.15)*L,t0:t,d:R(8,18)*(s.alive?1:1.8),r0:L*.025,L,fire:Math.random()<(s.alive?.35:.55)})}
  }
}
const C=['#4fc3ff','#ff8a4f'],CL=['#c6ecff','#ffd5bd'],CD=['#1d4f73','#7a3b1a'];
const HULL=[[-.5,-.28],[-.38,-.5],[.2,-.5],[.5,-.14],[.5,.14],[.2,.5],[-.38,.5],[-.5,.28]];
function drawShip(g,s,x,y,k,dp){
  const len=Math.max(7*s.T.L*dp,s.T.L*k),wid=len*(WR[s.cls]||.3)*2,r=len/2,now=performance.now();
  if(s===sel){g.strokeStyle='#fff';g.lineWidth=dp;g.beginPath();g.arc(x,y,r+6*dp,0,6.283);g.stroke()}
  g.save();g.translate(x,y);g.rotate(s.hd);
  const hull=()=>{g.beginPath();HULL.forEach(([a,b],i)=>i?g.lineTo(a*len,b*wid*.5):g.moveTo(a*len,b*wid*.5));g.closePath()};
  const det=len>=26*dp;
  if(!s.alive){hull();g.fillStyle='#262c36';g.fill();g.strokeStyle='#44505f';g.lineWidth=dp;g.stroke();
    if(det){g.strokeStyle='#161a21';g.beginPath();g.moveTo(-.2*len,-wid*.2);g.lineTo(.1*len,wid*.15);g.moveTo(.15*len,-wid*.25);g.lineTo(-.05*len,wid*.3);g.stroke()}
    g.restore();return}
  const moving=Math.hypot(s.vx,s.vy)>.02;
  if(moving||true){for(const z of s.zones)for(const m of z.mods)if(m.k==='E'&&m.alive&&moving){
      const fl=len*(.14+.06*Math.random()),ex=m.u*len,ey=m.v*wid*.7;
      const gr=g.createLinearGradient(ex,0,ex-fl,0);gr.addColorStop(0,'rgba(255,230,160,.95)');gr.addColorStop(1,'rgba(255,120,40,0)');
      g.fillStyle=gr;g.beginPath();g.moveTo(ex,ey-wid*.06);g.lineTo(ex-fl,ey);g.lineTo(ex,ey+wid*.06);g.fill()}}
  hull();const gr=g.createLinearGradient(0,-wid/2,0,wid/2);gr.addColorStop(0,CD[s.side]);gr.addColorStop(.5,C[s.side]);gr.addColorStop(1,CD[s.side]);
  g.fillStyle=gr;g.fill();g.strokeStyle=CL[s.side];g.lineWidth=Math.max(.6,dp*.8);g.globalAlpha=.8;g.stroke();g.globalAlpha=1;
  if(det){
    g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=dp*.7;g.beginPath();g.moveTo(-.4*len,0);g.lineTo(.42*len,0);g.moveTo(-.1*len,-wid*.5);g.lineTo(-.1*len,wid*.5);g.stroke();
    g.save();hull();g.clip();s.zones.forEach((z,zi)=>{if(z.arm>0)return;g.fillStyle='rgba(255,110,50,.2)';const pad=zi===0?[.25,-.15,.25,.3]:zi===2?[-.5,-.28,.18,.56]:zi===1?[-.3,0,.6,.5]:[-.3,-.5,.6,.5];g.fillRect(pad[0]*len,pad[1]*wid,pad[2]*len,pad[3]*wid)});g.restore();
    const mr=Math.max(1.4*dp,len*.032);
    for(const z of s.zones)for(const m of z.mods){const mx=m.u*len,my=m.v*wid*.7;
      if(!m.alive){g.fillStyle='#1a1d23';g.beginPath();g.arc(mx,my,mr*1.2,0,6.283);g.fill();g.strokeStyle='#ef6a5e';g.lineWidth=dp*.7;g.beginPath();g.moveTo(mx-mr,my-mr);g.lineTo(mx+mr,my+mr);g.moveTo(mx+mr,my-mr);g.lineTo(mx-mr,my+mr);g.stroke();continue}
      if(m.k==='T'||m.k==='A'){
        g.fillStyle='#0d1219';g.beginPath();g.arc(mx,my,mr*1.15,0,6.283);g.fill();g.fillStyle=m.k==='T'?CL[s.side]:'#ffe08a';g.beginPath();g.arc(mx,my,mr*.7,0,6.283);g.fill();
        const aim=(m.fa!=null?m.fa-s.hd:0),bl=mr*(m.k==='T'?2.4:1.5);g.strokeStyle=m.k==='T'?'#e8f3ff':'#ffd27a';g.lineWidth=Math.max(dp,mr*.5);g.beginPath();g.moveTo(mx,my);g.lineTo(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl);g.stroke();
        if(m.rt&&now-m.rt<130){g.fillStyle='rgba(255,245,200,'+(1-(now-m.rt)/130)+')';g.beginPath();g.arc(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl,mr*1.05,0,6.283);g.fill()}}
      else if(m.k==='E'){g.fillStyle='#2a323f';g.fillRect(mx-mr*1.2,my-mr*.9,mr*2,mr*1.8);g.fillStyle=moving?'#ffd27a':'#6f7b8c';g.fillRect(mx-mr*1.5,my-mr*.5,mr*.5,mr)}
    }
    const c=s.core;g.fillStyle=c.alive?'#9ff0b4':'#ef6a5e';g.beginPath();g.moveTo(c.u*len,-mr*1.3);g.lineTo(c.u*len+mr*1.3,0);g.lineTo(c.u*len,mr*1.3);g.lineTo(c.u*len-mr*1.3,0);g.closePath();g.fill();
  }
  g.restore();
  const f=s.aliveN/s.total,by=y+Math.max(wid/2,r*0.5)+4*dp;g.fillStyle='#1b2433';g.fillRect(x-r,by,len,2*dp);g.fillStyle=f>.55?'#6fdc8c':f>.35?'#f0c14b':'#ef6a5e';g.fillRect(x-r,by,len*f,2*dp);
}
function draw(g,ox,oy,k,dp){
  vw={ox,oy,kk:k};const X=x=>ox+x*k,Y=y=>oy+y*k;
  if(projMode<2)for(const side of [0,1]){
    g.strokeStyle=C[side];g.fillStyle=C[side];g.globalAlpha=projMode?.4:.55;g.lineWidth=1.1*dp;g.beginPath();
    for(const p of proj){if(p.side!==side)continue;const x=X(p.x),y=Y(p.y);
      if(projMode){g.moveTo(x,y);g.lineTo(x-p.vx/VP*9*dp,y-p.vy/VP*9*dp)}else{g.moveTo(x+1.6*dp,y);g.arc(x,y,1.6*dp,0,6.283)}}
    if(projMode)g.stroke();else g.fill();
  }
  g.globalAlpha=1;
  for(const side of [0,1]){g.strokeStyle=CL[side];g.lineWidth=2*dp;g.beginPath();
    for(const p of torps){if(p.side!==side||!p.tgt)continue;const x=X(p.x),y=Y(p.y),dx=p.tgt.x-p.x,dy=p.tgt.y-p.y,l=Math.hypot(dx,dy)||1,tl2=Math.max(10*dp,40*k);g.moveTo(x,y);g.lineTo(x-dx/l*tl2,y-dy/l*tl2)}
    g.stroke()}
  for(const s of ships)drawShip(g,s,X(s.x),Y(s.y),k,dp);
  for(const q of smoke){const u=(t-q.t0)/q.d,x=X(q.x+q.vx*(t-q.t0)),y=Y(q.y+q.vy*(t-q.t0)),rr=Math.max(1.2*dp,(q.r0+u*q.L*.035)*k);
    g.globalAlpha=Math.max(0,.3*(1-u));g.fillStyle=u<.2&&q.fire?'#ffb347':'#5a606b';g.beginPath();g.arc(x,y,rr,0,6.283);g.fill();
    if(q.fire&&u<.3){g.globalAlpha=.8*(1-u/.3);g.fillStyle='#ff6a2a';g.beginPath();g.arc(x,y,rr*.5,0,6.283);g.fill()}}
  g.globalAlpha=1;
  g.lineWidth=dp;
  for(const side of [0,1]){g.strokeStyle=CL[side];g.globalAlpha=.25;g.beginPath();
    for(const c of air){if(c.side!==side||c.state!=='fly'||c.tr.length<4)continue;g.moveTo(X(c.tr[0]),Y(c.tr[1]));for(let i=2;i<c.tr.length;i+=2)g.lineTo(X(c.tr[i]),Y(c.tr[i+1]));g.lineTo(X(c.x),Y(c.y))}
    g.stroke()}
  g.globalAlpha=1;
  for(const side of [0,1])for(const type of ['F','B']){
    g.fillStyle=CL[side];g.beginPath();const sz=(type==='F'?3.8:5.2)*dp;
    for(const c of air){if(c.side!==side||c.type!==type||c.state!=='fly')continue;
      const x=X(c.x),y=Y(c.y),a=c.h;
      g.moveTo(x+Math.cos(a)*sz,y+Math.sin(a)*sz);g.lineTo(x+Math.cos(a+2.5)*sz,y+Math.sin(a+2.5)*sz);g.lineTo(x+Math.cos(a-2.5)*sz,y+Math.sin(a-2.5)*sz);g.closePath()}
    g.fill()}
  const now=performance.now();shots=shots.filter(s=>now-s.rt<140);
  g.lineWidth=1.4*dp;
  for(const sh of shots){g.strokeStyle='#fff';g.globalAlpha=1-(now-sh.rt)/140;g.beginPath();g.moveTo(X(sh.x1),Y(sh.y1));g.lineTo(X(sh.x1+(sh.x2-sh.x1)*.7),Y(sh.y1+(sh.y2-sh.y1)*.7));g.stroke()}
  g.globalAlpha=1;
  for(const f of fx){const u=(t-f.t0)/f.d;g.globalAlpha=Math.max(0,1-u);g.strokeStyle='#fff3c4';g.lineWidth=2*dp;g.beginPath();g.arc(X(f.x),Y(f.y),Math.max(3*dp,f.r*k*u*3),0,6.283);g.stroke()}
  g.globalAlpha=1;
}
const SHORT={cv:'ав',hc:'тк',dd:'эс',fr:'фр'};
const aliveBy=s=>ships.filter(o=>o.side===s&&o.alive).length;
function checkEnd(){
  if(done)return;
  if(aliveBy(0))lastFriend=t;
  if((!aliveBy(1)&&!pend.length)||(!aliveBy(0)&&t-lastFriend>1800)||t>14400)done=true;
}
function result(){
  const mine=ships.filter(s=>s.side===0).map(s=>({ref:s.spec.ref,alive:s.alive,lost:1-s.aliveN/s.total,
    F:air.filter(c=>c.own===s&&c.type==='F'&&c.state!=='dead').length,B:air.filter(c=>c.own===s&&c.type==='B'&&c.state!=='dead').length}));
  const en=ships.filter(s=>s.side===1);
  return {t,mine,enemyKilled:en.filter(s=>!s.alive).map(s=>s.cls),enemyAlive:en.filter(s=>s.alive).length,mineAlive:aliveBy(0),stat};
}
function hud(){
  const m=Math.floor(t/60),sec=Math.floor(t%60);
  let h=`<span><b>Время боя</b>${m}:${String(sec).padStart(2,'0')}</span>`;
  const al=[aliveBy(0),aliveBy(1)];
  for(const s of [0,1]){
    const F=air.filter(c=>c.side===s&&c.type==='F'&&c.state!=='dead').length,Bm=air.filter(c=>c.side===s&&c.type==='B'&&c.state!=='dead').length;
    const acc=stat.shots[s]?(100*stat.hits[s]/stat.shots[s]).toFixed(1)+'%':'—';
    const sh=['cv','hc','dd','fr'].map(ty=>SHORT[ty]+' '+ships.filter(o=>o.side===s&&o.cls===ty&&o.alive).length).join(' · ');
    h+=`<span class="c${'ab'[s]}"><b>${s?'Налётчики':'Ваш флот'}</b>${sh} · рельсы ${stat.shots[s]}/${stat.hits[s]} (${acc}) · истр. ${F} (−${stat.lostF[s]}) · бомб. ${Bm} (−${stat.lostB[s]}) · торп. ${stat.torp[s]}→${stat.torpHit[s]} · ПВО ${stat.flak[s]}</span>`;
  }
  if(done)h+=`<span class="${al[0]?'ca':'cb'}"><b>Итог</b>${!al[1]&&al[0]?'победа':!al[0]&&al[1]?'поражение':!al[0]?'взаимное уничтожение':'враг отступил'}</span>`;
  $b('bstats').innerHTML=h;
  const inf=$b('binfo');
  if(sel){inf.hidden=false;const s=sel,tur=s.tur.filter(m=>m.alive).length,sk=s.tur.length?(s.tur.reduce((a,m)=>a+m.sk,0)/s.tur.length).toFixed(1):'—';
    inf.innerHTML=`<b class="c${'ab'[s.side]}">${s.T.n}</b>${s.alive?'':' <span class="muted">(уничтожен)</span>'}<br>Длина ${Math.round(s.T.L*1000)} м · модули: ${s.aliveN}/${s.total} · ядро ${s.core.alive?'цело':'уничтожено'}<br>Турели: ${tur}/${s.tur.length} · ср. навык ${sk}<br>Двигатели: ${s.engN}/${s.T.eng}<br>Броня (слоёв): ${s.zones.map((z,i)=>ZN[i]+' '+z.arm+'/'+s.T.arm).join(' · ')}`}
  else inf.hidden=true;
}
const PM=['точки','короткие линии','скрыть'];
function tick(dt){
  if(done)return;
  while(pend.length&&pend[0].t<=t){const p=pend.shift();join(1,p.spec,1500)}
  step(dt);checkEnd();
}
function join(side,spec,edge){
  spec.cls=classify(spec);spec.dopt=DOPT[spec.cls];
  const sh=mkShip(side,spec,(side?1:-1)*edge+R(-80,80),R(-150,150));ships.push(sh);
  if(sh.car){if(spec.F>0)addFlights(sh,'F',spec.F);if(spec.B>0)addFlights(sh,'B',spec.B)}
  return sh;
}
function begin(cfg){cfgNow=cfg;reset(cfg);active=true;acc=0;
  $b('btitle').textContent=cfg.title||'Бой';$b('battle').hidden=false;bind();}
function finish(){active=false;$b('battle').hidden=true;const r=result(),cb=cfgNow.onEnd;cfgNow=null;cb(r)}
function bind(){
  if(bound)return;bound=true;
  $b('bgo').onclick=()=>{ui.bfollow=true;focusBattle()};
  $b('bas').onclick=e=>{autoSlow=!autoSlow;e.target.classList.toggle('on',autoSlow)};
  $b('bpm').onclick=e=>{projMode=(projMode+1)%3;e.target.textContent='Снаряды: '+PM[projMode]};
}
function pick(mx,my){let b=null,bd=16;
  for(const s of ships){const d=Math.hypot(vw.ox+s.x*vw.kk-mx,vw.oy+s.y*vw.kk-my);if(d<bd){bd=d;b=s}}
  if(b){sel=b;return true}return false}
return {ships:()=>ships,begin,tick,draw,hud,pick,join,finish,isDone:()=>done,active:()=>active,hot:()=>autoSlow&&t-lastEng<3,later:(tt,spec)=>pend.push({t:t+tt,spec}),time:()=>t,clear:()=>{sel=null}};
})();

/* ===== НАЛЁТЫ ===== */
export function raidSpecs(k) {
  const sp = (name, o) => Object.assign({name, rails: 0, flak: 0, arm: 2, eng: 3, L: 0.7, F: 0, B: 0, sk: 4 + Math.min(4, k * 0.5), dmg: 0, spd: 1, ref: null}, o);
  const out = [], rails = 8 + 3 * k, arm = 2 + Math.floor(k / 2);
  const RC = (cal, bar, ld, saf, n) => Array(n).fill(compOf(mkKey('rail', {cal, bar, ld, saf})).rcfg);
  const dc = k >= 3 ? 15 : 10, hc = k >= 2 ? 20 : 15;
  const nd = 2 + k, nl = Math.floor(nd / 3);
  for (let i = 0; i < nd; i++) out.push(sp(i >= nd - nl ? 'Налётчик-эсминец (подкрепление)' : 'Налётчик-эсминец', {rails, arm, L: 0.8, spd: 1.25, late: i >= nd - nl, railCfg: RC(dc, 1, 'a', 1, rails)}));
  for (let i = 0; i < 1 + Math.floor(k / 2); i++) out.push(sp('Налётчик-фрегат', {flak: 8, arm: Math.max(1, arm - 1), L: 0.5}));
  for (let i = 0; i < Math.floor(k / 3); i++) out.push(sp('Налётчик-крейсер', {rails: 30 + 10 * k, arm: arm + 2, eng: 4, L: 1.8, late: true, railCfg: RC(hc, 2, 'a', 2, 30 + 10 * k)}));
  if (k >= 2) out.push(sp('Налётчик-авианосец', {late: true, rails: 4, arm, eng: 4, L: 2.2, F: 10 * (1 + Math.floor(k / 2)), B: 5 * Math.floor(k / 2)}));
  return out;
}
export function specFromShip(s) {
  const st = s.st, cmd = effSkill(s, 'cmd');
  return {name: s.name, ref: s.id, arm: st.armor, rails: st.rail, flak: st.flak, eng: Math.max(1, Math.min(6, st.engines)), L: st.L,
    F: s.air.F, B: s.air.B, sk: Math.max(3, Math.min(9, cmd || 4)), dmg: s.hullDmg || 0, spd: st.bspd || (st.L < 1 ? 1.25 : 1),
    railCfg: st.railList, flakCfg: st.flakList, defl: st.defl, fq: st.fq, bq: st.bq};
}
export function removeShip(s) {
  for (const id of Object.values(s.crew || {})) { const o = officerById(id); if (o) o.where = null; }
  state.ships = state.ships.filter(x => x !== s);
  if (ui.sel.kind === 'ship' && ui.sel.id === s.id) ui.sel = {kind: 'body', id: 'earth'};
}
export function plunder() {
  const f = Math.min(0.5, 0.2 + 0.05 * state.raid.k), lost = [];
  for (const k of ['fe', 'ni', 'ti', 'cu', 'si', 'c', 'pt', 'ree', 'fuel', 'spares']) {
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
    if (!r.alive) { lostNames.push(s.name); removeShip(s); } else { s.hullDmg = Math.max(s.hullDmg || 0, r.lost); s.air = {F: r.F, B: r.B}; }
  }
  if (!res.enemyAlive) {
    const W = {dd: 1, fr: 1, hc: 3, cv: 3}; let w = 0; for (const c of res.enemyKilled) w += W[c] || 1;
    const loot = {fe: 150, ni: 40, ti: 30, cu: 30, si: 20, pt: 4, spares: 15};
    for (const [k, v] of Object.entries(loot)) { state.stock[k] = (state.stock[k] || 0) + v * w; rec(k, 'in', v * w, 'loot'); }
    log(`Налёт отбит! Уничтожено кораблей противника: ${res.enemyKilled.length}. Трофеи: железо ${150 * w}, техизделия ${15 * w} и др.${lostNames.length ? ' Потеряны: ' + lostNames.join(', ') + '.' : ''}`);
  } else if (!res.mineAlive) {
    log(`Ваш флот разбит (${lostNames.join(', ')}).`); plunder();
  } else log(`Налётчики отступили. Потери: ${lostNames.length ? lostNames.join(', ') : 'нет'}. Повреждённые корабли чинятся на Земле.`);
  nextRaid();
}
export function raidTick(h) {
  const r = state.raid; if (!r) return;
  if (r.active) { battleTick(h); return; }
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
  if (!r.warned && state.t >= r.eta - 30) {
    r.warned = true; const n = raidSpecs(r.k).length;
    log(`Радары видят флот налётчиков: ${n} кораблей. Прибытие на Землю через ~30 суток. Держите боевые корабли у Земли или будьте готовы привести подкрепление.`);
  }
  if (state.t >= r.eta) startRaid();
}
export function raidChip() {
  const r = state.raid; if (!r) return '';
  if (r.active) return `<span class="chip" style="border-color:var(--bad);color:var(--bad)"><b>⚔ Бой у Земли</b>${Math.floor(Battle.time() / 60)} мин</span>`;
  if (r.warned) return `<span class="chip" style="border-color:var(--bad);color:var(--bad)"><b>Налёт</b>через ${fmtN(Math.max(0, r.eta - state.t))} сут</span>`;
  return `<span class="chip"><b>След. налёт</b>~${fmtN(Math.max(0, r.eta - state.t))} сут</span>`;
}
