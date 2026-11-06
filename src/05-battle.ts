// @ts-nocheck
import { RES, compOf, dist, fmtN, log, mkKey, rec, state } from './01-data.ts';
import { effSkill, officerById } from './02-crew.ts';
import { W, H, bar, cx, focusBattle, ui, setTilt } from './08-map-ui.ts';

/* ===== БОЙ (движок боя из демо) ===== */
export const Battle = (() => {
const $b = id => document.getElementById(id);

const DOPT={hc:20,dd:20,fr:35,cv:100},JINK=0.0015,VP=6,LIFE=10,RANGE=VP*LIFE,SIGMA=0.02,LAUNCH=450,SUB=0.25,REL=60;
const FI={vmax:2,a:0.25,fuel:1500,ammo:60,hp:8,gun:4},BO={vmax:0.8,a:0.05,fuel:2200,hp:4};
const TORP={sp:2.5,pd:0.02,pdr:35,launch:120,mod:2};
const FLAK={range:60,blast:1.2};
const RC0={dmg:1,vp:6,rng:60,shells:1,rel:1,fail:0,sig:1,cal:10},FC0={blast:1.2,rng:60,rel:1,fail:0},LC0={dmg:4,rng:250,chg:.08},MC0={hp:2,spd:3.2,dmg:4,blast:6,ammo:4,rng:220,rel:.83};
const BURST={5:10,10:8,15:6,20:5},RCT={5:70,10:130,15:200,20:290};
const ZN=['нос','правый борт','корма','левый борт'];
const BSPEEDS=[1,5,20,100,300];
let mis=[],beams=[],bursts=[],curCT=1,curST=0,ships,proj,fx,flights,air,torps,shots,fly,t,paused=false,speed=100,acc=0,stat,lastEng=-99,autoSlow=true,autoCam=true,sel=null,projMode=0,done=false,isOpen=false,cfgNow=null,bound=false,last=0;
let pend=[],lastFriend=0,vw={ox:0,oy:0,kk:1},active=false;
const R=(a,b)=>a+Math.random()*(b-a);
const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=Math.random();return (u-2)*1.73};
const adiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;return d};
const classify=sp=>sp.F+sp.B>0?'cv':(sp.flak>=sp.rails&&sp.flak>0)?'fr':(sp.L>=1.6||sp.rails>=40)?'hc':'dd';
function mkShip(side,sp,x,y){
  const T={role:sp.role,n:sp.name,defl:sp.defl||0,arm:sp.arm,eng:Math.max(1,sp.eng||3),spd:sp.spd||1,L:Math.max(0.3,sp.L),dopt:sp.dopt};
  const zones=ZN.map(()=>({arm:T.arm,mods:[]}));
  const add=(k,z)=>{const m={k,alive:true,sk:(k==='T'||k==='A')?Math.max(1,Math.min(10,Math.round((sp.sk||5.5)+gauss()*2))):0,cd:R(0,REL),z};zones[z].mods.push(m);return m};
  const tur=[];for(let i=0;i<sp.rails;i++){const m=add('T',i%4);m.cfg=(sp.railCfg&&sp.railCfg[i])||RC0;tur.push(m)}for(let i=0;i<sp.flak;i++){const m=add('A',(i+2)%4);m.cfg=(sp.flakCfg&&sp.flakCfg[i])||FC0;tur.push(m)}
  for(let i=0;i<(sp.lasers||0);i++){const m=add('L',(i+1)%4);m.cfg=(sp.laserCfg&&sp.laserCfg[i])||LC0;tur.push(m)}
  for(let i=0;i<(sp.miss||0);i++){const m=add('M',(i+3)%4);m.cfg=(sp.missCfg&&sp.missCfg[i])||MC0;m.ammo=m.cfg.ammo;tur.push(m)}
  for(let i=0;i<T.eng;i++)add('E',2);
  const core=add('C',(Math.random()*4)|0),total=sp.rails+sp.flak+(sp.lasers||0)+(sp.miss||0)+T.eng+1;
  const sh={fid:sp.fid||0,side,cls:sp.cls,T,x,y,vx:0,vy:0,sx:0,sy:0,ax:0,ay:0,next:0,alive:true,car:(sp.F+sp.B)>0,hd:side?Math.PI:0,zones,tur,core,total,aliveN:total,engN:T.eng,pool:{ammo:30*sp.F,torp:sp.B},nextL:0,spec:sp,z:0,bst:1,lrp:0,srp:0};
  for(const m of tur){if(m.k==='L')sh.lrp+=m.cfg.dmg*m.cfg.rng/100*.5;else if(m.k==='M')sh.lrp+=m.cfg.dmg*.8*m.cfg.ammo/8;else if(m.k==='T')sh.srp+=m.cfg.dmg*m.cfg.shells}
  sh.lrR=Math.max(0,...tur.filter(m=>m.k==='L').map(m=>m.cfg.rng));
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
  hadContact=false;sepT=0;ships=[];FL=new Map();GR=[new Map(),new Map()];smoke=[];proj=[];mis=[];beams=[];bursts=[];fx=[];flights=[];air=[];torps=[];shots=[];fly=[[],[]];t=0;lastEng=-99;sel=null;done=false;pend=(cfg.late||[]).map(x=>({...x}));lastFriend=0;
  stat={las:[0,0],lasHit:[0,0],mis:[0,0],misHit:[0,0],misShot:[0,0],bfail:[0,0],shots:[0,0],hits:[0,0],torp:[0,0],torpHit:[0,0],torpPd:[0,0],flak:[0,0],flakKill:[0,0],lostF:[0,0],lostB:[0,0]};
  const X={dd:8,hc:2,fr:-4,cv:-12};
  cfg.fleets.forEach((list,side)=>{
    const dir=side?-1:1;
    for(const sp of list){sp.cls=classify(sp);sp.dopt=sp.dopt0||DOPT[sp.cls]}
    for(const cl of ['dd','hc','fr','cv']){const grp=list.filter(sp=>sp.cls===cl);
      grp.forEach((sp,i)=>{const sh=mkShip(side,sp,(side?500:-500)+dir*X[cl],(i-(grp.length-1)/2)*8);ships.push(sh);
        if(sh.car){if(sp.F>0)addFlights(sh,'F',sp.F);if(sp.B>0)addFlights(sh,'B',sp.B)}})}
  });
}
/* ===== ИИ ФЛОТОВ: ===== */
const CS=16,VMK=2.4,VAL={cv:3,hc:2.5,dd:1.2,fr:1};
let GR=[new Map(),new Map()],FL=new Map();
const ckey=(cx,cy)=>cx*8192+cy;
function buildGrids(){
  GR=[new Map(),new Map()];
  for(const s of ships){if(!s.alive)continue;const k=ckey(Math.floor(s.x/CS),Math.floor(s.y/CS)),g=GR[s.side];let a=g.get(k);if(!a)g.set(k,a=[]);a.push(s)}
}
// ближайший корабль стороны side (поиск по кольцам ячеек)
function nearestShip(x,y,side){
  const g=GR[side];if(!g.size)return null;const cx=Math.floor(x/CS),cy=Math.floor(y/CS);let b=null,bd=1e18;
  const scan=(i,j)=>{const a=g.get(ckey(cx+i,cy+j));if(!a)return;for(const o of a){const d=(o.x-x)*(o.x-x)+(o.y-y)*(o.y-y);if(d<bd){bd=d;b=o}}};
  for(let r=0;r<48;r++){
    if(b&&(r-1)*CS>Math.sqrt(bd))break;
    if(r===0)scan(0,0);else for(let i=-r;i<=r;i++){scan(i,-r);scan(i,r);if(i>-r&&i<r){scan(-r,i);scan(r,i)}}
  }
  if(!b){for(const o of ships){if(!o.alive||o.side!==side)continue;const d=(o.x-x)*(o.x-x)+(o.y-y)*(o.y-y);if(d<bd){bd=d;b=o}}}
  return b?{s:b,d:Math.sqrt(bd)}:null;
}
function around(side,x,y,rad){ // корабли стороны в радиусе
  const g=GR[side],out=[],n=Math.ceil(rad/CS),cx=Math.floor(x/CS),cy=Math.floor(y/CS),r2=rad*rad;
  for(let i=-n;i<=n;i++)for(let j=-n;j<=n;j++){const a=g.get(ckey(cx+i,cy+j));if(!a)continue;for(const o of a)if((o.x-x)*(o.x-x)+(o.y-y)*(o.y-y)<=r2)out.push(o)}
  return out;
}
const hpf=s=>s.aliveN/s.total;
const val=s=>s.T.role==='freight'?.6:(VAL[s.cls]||1);
function fleetsUpdate(){
  for(const F of FL.values()){F.ships=[];F.lrp=0;F.srp=0;F.lrR=0;F.n=0;F.cx=0;F.cy=0;F.str=0;F.fr=0}
  for(const s of ships){if(!s.alive)continue;const key=s.side*1000+s.fid;let F=FL.get(key);
    if(!F){F={ships:[],n:0,cx:0,cy:0,str:0,fr:0,key,side:s.side,fid:s.fid,next:0,stance:'engage',until:0,flank:Math.random()<.4?(Math.random()<.5?1:-1)*R(.7,1.2):0,tgt:null,focus:null,gx:s.x,gy:s.y,dx:-s.x/(Math.hypot(s.x,s.y)||1),dy:-s.y/(Math.hypot(s.x,s.y)||1),slotsAt:-99,rng:40,lrp:0,srp:0,lrR:0,zl:(((s.side*3+s.fid)%3)-1)*14,wait0:-1};FL.set(key,F)}
    F.ships.push(s);F.lrp+=s.lrp*hpf(s);F.srp+=s.srp*hpf(s);F.lrR=Math.max(F.lrR,s.lrR);F.n++;F.cx+=s.x;F.cy+=s.y;F.str+=s.aliveN*(1+val(s));if(s.T.role==='freight')F.fr++;s.F=F}
  for(const [k,F] of FL){if(!F.n){FL.delete(k);continue}F.cx/=F.n;F.cy/=F.n;F.convoy=F.fr>=F.n*.5}
  const all=[...FL.values()];
  for(const F of all){
    if(t<F.next)continue;F.next=t+R(1.5,3);
    // цель-флот: ближайший вражеский, слабым отдаём предпочтение
    let bf=null,bs=1e18;for(const E of all){if(E.side===F.side)continue;const d=Math.hypot(E.cx-F.cx,E.cy-F.cy),sc=d/(1+.3*Math.log(Math.max(.2,F.str/Math.max(1,E.str))+1))*(E===F.tgt?.75:1);if(sc<bs){bs=sc;bf=E}}
    F.tgt=bf;if(!bf){F.stance='idle';continue}
    const dist=Math.hypot(bf.cx-F.cx,bf.cy-F.cy);let en=0,fr=0;for(const E of all)if(Math.hypot(E.cx-F.cx,E.cy-F.cy)<300){if(E.side!==F.side)en+=E.str;else fr+=E.str}
    const ratio=fr/Math.max(1,en),brave=F.brave||(F.brave=R(.22,.4));
    F.rng=F.ships.reduce((a,s)=>a+s.T.dopt,0)/F.n;
    if(F.convoy)F.stance='convoy';
    else if(t<F.until&&F.stance==='retreat')F.stance='retreat';
    else if(ratio<brave&&dist<300&&t>(F.calm||0)){F.stance='retreat';F.until=t+R(25,45);F.calm=F.until+60}
    else{
      let st=dist>F.rng*2.5&&F.flank?'flank':'engage';const E=bf;
      if(F.lrp>8&&F.lrp>E.lrp*1.3&&F.lrp>=F.srp*.8){st='kite';F.hold=Math.max(60,F.lrR*.8)}
      else if(E.lrp>10&&E.lrp>F.lrp*1.3&&F.srp>0)st='assault';
      // ждём подходящих союзников, чтобы ударить вместе
      let waiting=false;
      if(st!=='assault'||dist>F.rng*3)for(const A of all){if(A.side!==F.side||A===F||A.convoy||A.n<3)continue;
        const dA=Math.hypot(A.cx-bf.cx,A.cy-bf.cy);
        if(dA<450&&dA>F.rng*2&&dA>dist+30&&dist<380&&dist>F.rng*1.8){waiting=true;break}}
      if(waiting){if(F.wait0<0)F.wait0=t;if(t-F.wait0<50)st='wait'}else if(dist>420||st!=='wait')F.wait0=-1;
      F.stance=st}
    // строй держится, пока флот не окружён и враг не вклинился внутрь
    {const dirs=[];let inside=0;for(const E of all){if(E.side===F.side)continue;if(Math.hypot(E.cx-F.cx,E.cy-F.cy)<280)dirs.push(Math.atan2(E.cy-F.cy,E.cx-F.cx))}
      let mx=0;for(let i=0;i<dirs.length;i++)for(let j=i+1;j<dirs.length;j++)mx=Math.max(mx,Math.abs(adiff(dirs[i],dirs[j])));
      for(const E of all)if(E.side!==F.side&&Math.hypot(E.cx-F.cx,E.cy-F.cy)<35)inside+=E.n;
      if(mx>1.9||inside>F.n*.25){F.brk=t+30}
      F.formed=t>(F.brk||0)}
    // общий фокус огня: самая ценная и повреждённая цель в зоне
    const cand=around(1-F.side,F.cx+(bf.cx-F.cx)*.3,F.cy+(bf.cy-F.cy)*.3,110);let fb=null,fs=0;
    for(const o of cand){const sc=val(o)*(1.4-hpf(o))/(1+Math.hypot(o.x-F.cx,o.y-F.cy)/100);if(sc>fs){fs=sc;fb=o}}F.focus=fb;
    // точка сбора флота и направление строя
    let dx=bf.cx-F.cx,dy=bf.cy-F.cy;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
    if(F.stance==='flank'){const a=F.flank*Math.min(1,Math.max(0,(dist-F.rng*2)/160)),c=Math.cos(a),s2=Math.sin(a);[dx,dy]=[dx*c-dy*s2,dx*s2+dy*c]}
    if(F.stance==='retreat'||F.stance==='convoy'){F.tgx=F.cx-dx*160;F.tgy=F.cy-dy*160;if(F.stance==='convoy'){const ne=bf;F.tgx=F.cx-(ne.cx-F.cx)/dl*200;F.tgy=F.cy-(ne.cy-F.cy)/dl*200}}
    else if(F.stance==='wait'){F.tgx=F.cx;F.tgy=F.cy}
    else{const hold=F.stance==='kite'?F.hold:F.stance==='assault'?14:Math.max(25,F.rng*(F.stance==='engage'?.9:1.3));F.tgx=bf.cx-dx*hold;F.tgy=bf.cy-dy*hold}
    // слои по высоте: в бою флоты сближаются по вертикали
    if(F.flank&&dist<420)F.zl+=((F.flank>0?24:-24)-F.zl)*.3;
    F.tdx=dx;F.tdy=dy;
    if(F.n!==F.nSlots||t-F.slotsAt>6){assignSlots(F);F.nSlots=F.n;F.slotsAt=t}
    if(t<45)for(const q of F.ships)if(!q.placed&&q.slotBack!=null){q.placed=1;const px=-F.dy,py=F.dx;q.x=F.gx-F.dx*q.slotBack+px*q.slotLat;q.y=F.gy-F.dy*q.slotBack+py*q.slotLat;q.sx=q.sy=0;q.hd=Math.atan2(F.dy,F.dx)}
  }
  for(const F of all){const dtf=Math.min(5,Math.max(0,t-(F.pt==null?t:F.pt)));F.pt=t;if(F.tgx==null){F.tgx=F.gx;F.tgy=F.gy;F.tdx=F.dx;F.tdy=F.dy}
    const k=1-Math.exp(-dtf/5);F.gx+=(F.tgx-F.gx)*k;F.gy+=(F.tgy-F.gy)*k;F.dx+=(F.tdx-F.dx)*k*.7;F.dy+=(F.tdy-F.dy)*k*.7;const l=Math.hypot(F.dx,F.dy)||1;F.dx/=l;F.dy/=l}
}
function assignSlots(F){ // строй: впереди крепкие, за ними основные стрелки, в хвосте авианосцы, транспорты и ПВО
  const r0=[],r1=[],r2=[],fight=[];
  for(const s of F.ships){if(s.cls==='cv'||s.T.role==='freight'||s.cls==='fr')r2.push(s);else fight.push(s)}
  fight.sort((a,b)=>b.T.arm*(1+b.T.L)-a.T.arm*(1+a.T.L));
  const nt=Math.max(1,Math.round(fight.length*.38));fight.forEach((s,i)=>(i<nt?r0:r1).push(s));
  let back=0;
  [[r0,0],[r1,1],[r2,2]].forEach(([row,ri])=>{if(!row.length)return;
    row.sort((a,b)=>b.T.L-a.T.L);const per=Math.min(16,Math.max(5,Math.ceil(Math.sqrt(row.length*2.4)))),lines=Math.ceil(row.length/per);
    row.forEach((s,i)=>{const line=Math.floor(i/per),col=i%per,n=Math.min(per,row.length-line*per),sp=Math.max(5,s.T.L*2.2+3);
      s.slotLat=(col-(n-1)/2)*sp+(ri===1||line%2?sp*.5:0);s.slotBack=back+line*11;s.row=ri});
    back+=lines*11+(ri===0?20:24)});
}
function retarget(s){
  s.nt=t+R(1.2,2.4);const C=s.F,maxR=s.maxR||60;
  s.near=around(1-s.side,s.x,s.y,maxR*1.25);
  let best=null,bs=-1e9;const big=s.spec.rails>=14;
  for(const o of s.near){const d=Math.hypot(o.x-s.x,o.y-s.y);let sc=-d*.5+(big?val(o)*25:val(o)*8)+(1-hpf(o))*20+(o===C.focus?30*(s.focusW||.5):0);if(sc>bs){bs=sc;best=o}}
  s.tg=best||(C.tgt&&nearestShip(s.x,s.y,1-s.side)?.s)||null;
  if(!s.tg)s.tg=(nearestShip(s.x,s.y,1-s.side)||{}).s||null;
}
function steer(s,dt){
  const T=s.T,F=s.F,eng=Math.max(.15,s.engN/T.eng),hp=hpf(s);let vm=.2*VMK*T.spd,boost=1;
  if(t>=s.nt||!s.tg||!s.tg.alive)retarget(s);
  if(t>=s.next){s.next=t+R(6,14);s.sdir=Math.random()<.5?1:-1}
  const tg=s.tg;let vx=0,vy=0,want=s.hd;
  const formed=F.formed!==false&&F.n>=3,retreating=F.stance==='retreat'&&!F.convoy,flee=(hp<.35&&!T.role)||(retreating&&!formed),tdx=tg?tg.x-s.x:F.dx,tdy=tg?tg.y-s.y:F.dy,td=Math.hypot(tdx,tdy)||1,ux=tdx/td,uy=tdy/td;
  if(flee&&tg){vx=-ux*vm;vy=-uy*vm;want=Math.atan2(-uy,-ux);if(td<120)boost=1.5}
  else{
    // формация
    const fx=F.dx,fy=F.dy,px=-fy,py=fx,Px=F.gx-fx*(s.slotBack||0)+px*(s.slotLat||0),Py=F.gy-fy*(s.slotBack||0)+py*(s.slotLat||0);
    let ex=Px-s.x,ey=Py-s.y;const ed=Math.hypot(ex,ey)||1;
    if(F.n<2||!F.minSpd)F.minSpd=F.minSpd||vm;
    if(!F.spdAt||t-F.spdAt>5){F.spdAt=t;F.minSpd=.2*VMK*Math.min(...F.ships.slice(0,40).map(o=>o.T.spd))}
    const fvm=Math.min(vm,F.minSpd*1.15),sp=ed>40?vm:Math.min(fvm,ed*.2+.01);
    // экстренное ускорение: догнать строй / вовремя встать на место
    if(ed>70)boost=Math.min(2,1+(ed-70)/120);
    let fvx=ex/ed*sp,fvy=ey/ed*sp;
    const er=Math.max(s.maxR,F.stance==='kite'?F.hold:0),dopt=F.stance==='kite'?F.hold:F.stance==='assault'?14:T.dopt;
    if(T.role==='freight'||F.stance==='convoy'&&T.role){vx=fvx;vy=fvy}
    else if(tg&&td<er*1.5){
      const dd=td-dopt,k=Math.abs(dd)<10?0:Math.max(-1,Math.min(1,(dd-Math.sign(dd)*10)/20)),lat=0,w=formed?.93:F.stance==='kite'?.15:s.cls==='hc'||s.cls==='cv'?.55:.25;
      let rx=ux*vm*k*.85-uy*lat,ry=uy*vm*k*.85+ux*lat;want=Math.atan2(uy,ux);
      if(s.cls==='hc'&&s.row===0&&F.stance!=='kite'&&F.stance!=='assault'&&td<er*1.2){ // тяжёлые идут бортом к врагу, как парусники в линии
        const sd=F.bsd||(F.bsd=Math.random()<.5?1:-1);rx=ux*vm*k*.7;ry=uy*vm*k*.7;want=Math.atan2(uy,ux)+sd*Math.PI/2}
      vx=w*fvx+(1-w)*rx;vy=w*fvy+(1-w)*ry;if(retreating)want=Math.atan2(vy,vx);
      if(F.stance==='assault'&&td>s.maxR*.7)boost=Math.max(boost,1.7);
      else if(F.stance==='kite'&&td<F.hold*.6)boost=Math.max(boost,1.4);
    }else{vx=fvx;vy=fvy;if(retreating&&sp>.02)want=Math.atan2(vy,vx);else if(tg)want=Math.atan2(uy,ux);else if(sp>.02)want=Math.atan2(vy,vx);
      if(F.stance==='assault'&&tg)boost=Math.max(boost,1.5)}
  }
  // разлёт: не стоять друг за другом на линии огня и не кучковаться
  for(const o of around(s.side,s.x,s.y,12)){if(o===s)continue;const dx=s.x-o.x,dy=s.y-o.y,d=Math.hypot(dx,dy)||1e-6;
    if(d<5){const f=.2*(5-d)/5/d;vx+=dx*f;vy+=dy*f}
    if(tg&&!formed){const al=(-dx)*ux+(-dy)*uy,pp=(-dx)*(-uy)+(-dy)*ux; // o перед нами на линии на врага
      if(al>0&&Math.abs(pp)<o.T.L*.5+3){const sg=pp>=0?-1:1,f=.12*vm*(1-Math.abs(pp)/(o.T.L*.5+3));vx+=-uy*sg*f*3;vy+=ux*sg*f*3}}}
  {const kf=Math.min(1,dt*.35);s.dvx=s.dvx==null?vx:s.dvx+(vx-s.dvx)*kf;s.dvy=s.dvy==null?vy:s.dvy+(vy-s.dvy)*kf;vx=s.dvx;vy=s.dvy}
  // скорость вперёд больше, назад и вбок — меньше
  const c=Math.cos(s.hd),sn=Math.sin(s.hd);let fw=vx*c+vy*sn,lt=-vx*sn+vy*c;if(fw<0)fw*=.5;lt*=.6;vx=fw*c-lt*sn;vy=fw*sn+lt*c;
  // поломка двигателя при форсаже: чем сильнее ускорение, тем выше шанс
  if(boost>1.02&&s.engN>0&&Math.random()<.00006*(1+3*(boost-1))*dt*s.engN){
    const em=[];for(const z of s.zones)for(const m of z.mods)if(m.k==='E'&&m.alive)em.push(m);
    if(em.length){const m=em[(Math.random()*em.length)|0];m.alive=false;s.aliveN--;s.engN--;stat.bfail[s.side]++;fx.push({x:s.x,y:s.y,t0:t,d:8,r:2});boost=1}}
  s.bst+=(boost-s.bst)*Math.min(1,dt*.8);boost=s.bst;
  vm*=boost;const vl=Math.hypot(vx,vy);if(vl>vm){vx*=vm/vl;vy*=vm/vl}
  // инерция: ускорение ограничено тягой и массой
  const a=.035*VMK*(eng+.1)/(1+T.L*.35)*dt*(1+(boost-1)*1.2),dvx=vx*eng-s.sx,dvy=vy*eng-s.sy,dl=Math.hypot(dvx,dvy);
  if(dl>a){s.sx+=dvx/dl*a;s.sy+=dvy/dl*a}else{s.sx+=dvx;s.sy+=dvy}
  s.x+=s.sx*dt;s.y+=s.sy*dt;
  const turn=(.5/(1+T.L*.8))*dt;s.hd+=Math.max(-turn,Math.min(turn,adiff(s.hd,want)));
  s.vx=s.sx;s.vy=s.sy;
  // высота (псевдо-3D)
  if(t>=(s.zn||0)){s.zn=t+R(40,90);const r=Math.random();s.zo=r<.4?R(10,28):r<.75?R(-28,-10):R(-5,5)}
  const zt=Math.max(-36,Math.min(36,F.zl+s.zo));if(s.zset==null){s.z=zt;s.zset=1}else s.z+=Math.max(-.6*dt,Math.min(.6*dt,zt-s.z));
}
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
  if(c.type==='F'&&mis.length&&t>(c.pd||0)){let q=null,bd=64;for(const m of mis){if(m.side===c.side)continue;const dd=(m.x-c.x)*(m.x-c.x)+(m.y-c.y)*(m.y-c.y);if(dd<bd){bd=dd;q=m}}
    if(q){c.pd=t+1;shots.push({x1:c.x,y1:c.y,x2:q.x,y2:q.y,rt:performance.now(),s:c.side});if(Math.random()<.1)hurtMis(q,1)}}
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
  if(o.T.defl&&Math.random()<o.T.defl){fx.push({z:o.z,x,y,t0:t,d:3,r:0.8});return}
  const a=adiff(o.hd,Math.atan2(-vy,-vx))+R(-0.9,0.9),ab=Math.abs(a);
  const zi=ab<0.785?0:ab>2.356?2:(a>0?1:3);let z=o.zones[zi];
  let dm=kind==='torp'?1:dmg*(kind==='laser'?.7:kind==='mis'?.5:.22);dm=Math.floor(dm)+(Math.random()<dm%1?1:0);
  if(z.arm>0&&dm>0){const c=Math.min(z.arm,dm);z.arm-=c;dm-=c;fx.push({z:o.z,x,y,t0:t,d:4,r:1});if(dm<=0)return}
  else if(dm<=0){fx.push({z:o.z,x,y,t0:t,d:2,r:0.5});return}
  if(!z.mods.some(m=>m.alive)){const cand=o.zones.filter(q=>q.mods.some(m=>m.alive));if(!cand.length)return;z=cand[(Math.random()*cand.length)|0]}
  const k=kind==='torp'?TORP.mod:dm;
  for(let i=0;i<k;i++){const al=z.mods.filter(m=>m.alive);if(!al.length)break;const m=al[(Math.random()*al.length)|0];m.alive=false;o.aliveN--;if(m.k==='E')o.engN--}
  fx.push({z:o.z,x,y,t0:t,d:10,r:3});
  if(!o.core.alive||o.aliveN<o.total*0.22){o.alive=false;fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:40,r:26})}
}
function flakBurst(s,m){
  const F=m.cfg,cand=[];for(const c of fly[1-s.side])if(Math.hypot(c.x-s.x,c.y-s.y)<F.rng)cand.push(c);
  const tp=torps.concat(mis).filter(p=>p.side!==s.side&&Math.hypot(p.x-s.x,p.y-s.y)<F.rng);
  if(!cand.length&&!tp.length){m.cd=2;return false}
  const e=tp.length&&Math.random()<0.5?tp[(Math.random()*tp.length)|0]:(cand.length?cand[(Math.random()*cand.length)|0]:tp[0]);
  const d=Math.hypot(e.x-s.x,e.y-s.y),err=(0.25+0.012*d)*(1.4-0.08*m.sk);
  const bx=e.x+(e.vx||0)*1.5+gauss()*err,by=e.y+(e.vy||0)*1.5+gauss()*err;
  m.fa=Math.atan2(by-s.y,bx-s.x);m.rt=performance.now();stat.flak[s.side]++;shots.push({x1:s.x,y1:s.y,x2:bx,y2:by,rt:performance.now(),s:s.side});fx.push({x:bx,y:by,t0:t,d:3,r:F.blast});
  for(const c of fly[1-s.side])if(c.state==='fly'&&Math.hypot(c.x-bx,c.y-by)<F.blast){c.hp--;if(c.hp<=0){killCraft(c);stat.flakKill[s.side]++}}
  for(let i=torps.length-1;i>=0;i--){const p=torps[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast*1.5&&Math.random()<0.7){torps.splice(i,1);stat.torpPd[p.side]++;stat.flakKill[s.side]++}}
  for(let i=mis.length-1;i>=0;i--){const p=mis[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast*1.5+1&&Math.random()<0.15){p.hp--;if(p.hp<=0){mis.splice(i,1);stat.misShot[p.side]++;stat.flakKill[s.side]++;boom(p,null)}}}
  return true;
}
// осечка: орудие клинит на 4 минуты, иногда взрывается
function jamChk(s,m,C){if(!C.fail||Math.random()>=C.fail)return;stat.jams=(stat.jams||0)+1;m.cd=240;fx.push({x:s.x,y:s.y,t0:t,d:6,r:1.5});if(Math.random()<0.15){m.alive=false;s.aliveN--;stat.boom=(stat.boom||0)+1;if(!s.core.alive||s.aliveN<s.total*0.3){s.alive=false;fx.push({x:s.x,y:s.y,t0:t,d:40,r:26})}}}
function fireShell(s,m,o0,C,lag){
  let o=o0&&o0.alive?o0:(s.tg&&s.tg.alive?s.tg:null);if(!o)return;
  const VPc=C.vp;let T=Math.hypot(o.x-s.x,o.y-s.y)/VPc;
  for(let i=0;i<3;i++){const px=o.x+o.sx*T,py=o.y+o.sy*T;T=Math.hypot(px-s.x,py-s.y)/VPc}
  const px=o.x+o.sx*T,py=o.y+o.sy*T,d=Math.hypot(px-s.x,py-s.y),e=(SIGMA*d+JINK*T*T)*(1.4-0.08*m.sk)*C.sig;
  const ax=px+gauss()*e-s.x,ay=py+gauss()*e-s.y,l=Math.hypot(ax,ay)||1e-6;
  m.fa=Math.atan2(ay,ax);m.rt=performance.now();
  proj.push({x:s.x+ax/l*VPc*lag,y:s.y+ay/l*VPc*lag,z:s.z,vz:(o.z-s.z)/Math.max(.5,T),vx:ax/l*VPc,vy:ay/l*VPc,side:s.side,dist:VPc*lag,dmg:C.dmg,max:C.rng,src:s});
  stat.shots[s.side]++;
}
// взрыв ракеты: бьёт всех рядом, в том числе своих
function boom(p,direct){
  fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:6,r:p.blast*1.3});
  if(direct)stat.misHit[p.side]++;
  for(const side of [0,1]){for(const o of around(side,p.x,p.y,p.blast+2)){
    if(!o.alive||Math.abs(o.z-p.z)>p.blast*1.5+10)continue;
    const d=Math.hypot(o.x-p.x,o.y-p.y),f=o===direct?1:Math.max(0,1-d/(p.blast+2)*.75);
    if(f>0)hitShip(o,'mis',o.x-p.x,o.y-p.y,p.x,p.y,p.dmg*f*(o===direct?1.3:1))}}
  for(const c of fly[0].concat(fly[1]))if(c.state==='fly'&&Math.hypot(c.x-p.x,c.y-p.y)<p.blast){c.hp-=2;if(c.hp<=0)killCraft(c)}
}
function nearMis(s,rg){let b=null,bd=rg*rg;for(const q of mis){if(q.side===s.side)continue;const d=(q.x-s.x)*(q.x-s.x)+(q.y-s.y)*(q.y-s.y);if(d<bd){bd=d;b=q}}return b}
function hurtMis(q,n){q.hp-=n;if(q.hp<=0){const i=mis.indexOf(q);if(i>=0){mis.splice(i,1);stat.misShot[q.side]++;boom(q,null)}}}
function step(dt){
  t+=dt;

  buildGrids();fleetsUpdate();
  for(const s of ships){if(!s.alive)continue;steer(s,dt);}
  for(const s of ships){if(!s.alive)continue;
    s.maxR=s.maxR||Math.max(60,...s.tur.filter(m=>m.cfg&&m.cfg.rng&&m.k!=='L'&&m.k!=='M').map(m=>m.cfg.rng));
    let foes=null;
    for(const m of s.tur){
      if(!m.alive)continue;
      if(mis.length&&(m.k==='T'||m.k==='A')&&t>(m.pd||0)){const q=nearMis(s,m.k==='A'?m.cfg.rng:22);
        if(q){m.pd=t+(m.k==='A'?6:12)*R(.8,1.3);m.fa=Math.atan2(q.y-s.y,q.x-s.x);m.rt=performance.now();shots.push({x1:s.x,y1:s.y,x2:q.x,y2:q.y,rt:performance.now(),s:s.side});
          if(Math.random()<(m.k==='A'?.25:.08))hurtMis(q,1)}}
      m.cd-=dt;if(m.cd>0)continue;
      const C=m.cfg;
      if(m.k==='A'){if(flakBurst(s,m)){m.cd=2*REL*C.rel*(1.3-0.06*m.sk)*R(.75,1.25);jamChk(s,m,C)}continue}
      if(m.k==='L'||m.k==='M'){
        if(m.k==='M'&&m.ammo<=0){m.cd=1e9;continue}
        const rg=C.rng,ok=q=>q&&q.alive&&Math.hypot(q.x-s.x,q.y-s.y)<rg;
        let o=ok(s.F.focus)?s.F.focus:ok(s.tg)?s.tg:null;
        if(!o&&s.tg===null){m.cd=3;continue}
        if(!o){m.cd=m.k==='L'?4:6;continue}
        const d=Math.hypot(o.x-s.x,o.y-s.y);
        m.fa=Math.atan2(o.y-s.y,o.x-s.x)-0;m.rt=performance.now();
        if(m.k==='L'){
          const cost=C.dmg*(.4+(d/120)*(d/120));
          beams.push({a:s,b:o,tx:o.x,ty:o.y,tz:o.z,rt:m.rt,side:s.side,w:C.dmg});
          stat.las[s.side]++;stat.lasHit[s.side]++;hitShip(o,'laser',o.x-s.x,o.y-s.y,o.x,o.y,C.dmg);
          m.cd=cost/C.chg*(1.3-.06*m.sk)*R(.9,1.1);
        }else{
          if(d<18){m.cd=4;continue}
          const hd=Math.atan2(o.y-s.y,o.x-s.x);
          mis.push({x:s.x,y:s.y,z:s.z,h:s.hd,side:s.side,tgt:o,hp:C.hp,spd:C.spd,dmg:C.dmg,blast:C.blast,life:C.rng/C.spd*2.2,tr:[],trT:0,vx:0,vy:0,src:s});
          m.ammo--;stat.mis[s.side]++;m.cd=Math.min(300,100+C.dmg*28)*R(.8,1.25)*(1.3-.06*m.sk);
        }
        continue}
      foes=s.near||[];
      const fl=(s.tg&&s.tg.alive&&Math.hypot(s.tg.x-s.x,s.tg.y-s.y)<C.rng&&Math.random()<.7)?[s.tg]:foes.filter(o=>o.alive&&Math.hypot(o.x-s.x,o.y-s.y)<C.rng);
      if(!fl.length){m.cd=5;continue}
      // не стрелять через своих: если на линии огня союзник — чаще воздерживаемся
      {const o0=fl[0],ux=o0.x-s.x,uy=o0.y-s.y,ul=Math.hypot(ux,uy)||1;let bl=false;
        for(const q of around(s.side,s.x,s.y,14)){if(q===s)continue;const al=((q.x-s.x)*ux+(q.y-s.y)*uy)/ul,pp=Math.abs(((q.x-s.x)*uy-(q.y-s.y)*ux)/ul);if(al>0&&al<ul&&pp<q.T.L*.4+1.5){bl=true;break}}
        if(bl&&Math.random()<.4){m.cd=2+Math.random()*3;continue}}
      const B=BURST[C.cal]||8;
      for(let b=0;b<C.shells;b++)bursts.push({s,m,o:fl[(Math.random()*fl.length)|0],C,n:B,i:0,t0:t+b*.03});
      {const ldf=C.rel/(Math.pow((C.cal||10)/10,.7)*(1+.2*(C.shells-1)));m.cd=(RCT[C.cal]||130)*ldf*(1+.25*(C.shells-1))*(1.3-.06*m.sk)*R(.8,1.25)}jamChk(s,m,C);
    }
  }
  // очереди рельсотронов: выстрелы с задержкой 0,1 с
  for(let i=bursts.length-1;i>=0;i--){const q=bursts[i];
    if(!q.s.alive||!q.m.alive){bursts[i]=bursts[bursts.length-1];bursts.pop();continue}
    while(q.i<q.n&&t>=q.t0+.1*q.i){fireShell(q.s,q.m,q.o,q.C,t-(q.t0+.1*q.i));q.i++}
    if(q.i>=q.n){bursts[i]=bursts[bursts.length-1];bursts.pop()}}
  for(let i=proj.length-1;i>=0;i--){
    const p=proj[i],nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;let hit=null,fr=false;
    const dx=nx-p.x,dy=ny-p.y,l2=dx*dx+dy*dy||1,x0=Math.floor(Math.min(p.x,nx)/CS)-1,x1=Math.floor(Math.max(p.x,nx)/CS)+1,y0=Math.floor(Math.min(p.y,ny)/CS)-1,y1=Math.floor(Math.max(p.y,ny)/CS)+1;
    const scan=(g,self)=>{for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){const a=g.get(ckey(gx,gy));if(!a)continue;
      for(const o of a){if(!o.alive||o===self||Math.abs(p.z-o.z)>o.T.L*.25+22)continue;let u=((o.x-p.x)*dx+(o.y-p.y)*dy)/l2;u=Math.max(0,Math.min(1,u));
        if(Math.hypot(p.x+dx*u-o.x,p.y+dy*u-o.y)<o.T.L*0.25)return o}}return null};
    hit=scan(GR[1-p.side],null);if(!hit&&p.dist>3){hit=scan(GR[p.side],p.src);fr=!!hit}
    if(hit){if(fr)stat.ff=(stat.ff||0)+1;else stat.hits[p.side]++;hitShip(hit,'rail',p.vx,p.vy,nx,ny,p.dmg);proj[i]=proj[proj.length-1];proj.pop();continue}
    p.x=nx;p.y=ny;p.z+=p.vz*dt;p.dist+=Math.hypot(p.vx,p.vy)*dt;
    if(p.dist>=p.max){proj[i]=proj[proj.length-1];proj.pop()}
  }
  // ракеты
  for(let i=mis.length-1;i>=0;i--){
    const p=mis[i];let tg=p.tgt;
    if(!tg||!tg.alive){const nn=nearestShip(p.x,p.y,1-p.side);tg=p.tgt=nn&&nn.s}
    if(!tg){mis.splice(i,1);continue}
    const d=Math.hypot(tg.x-p.x,tg.y-p.y),T0=d/p.spd,ax=tg.x+tg.sx*T0-p.x,ay=tg.y+tg.sy*T0-p.y;
    p.h+=Math.max(-1.6*dt,Math.min(1.6*dt,adiff(p.h,Math.atan2(ay,ax))));
    p.vx=Math.cos(p.h)*p.spd;p.vy=Math.sin(p.h)*p.spd;p.x+=p.vx*dt;p.y+=p.vy*dt;p.z+=Math.max(-p.spd*.4*dt,Math.min(p.spd*.4*dt,tg.z-p.z));
    p.life-=dt;p.trT-=dt;if(p.trT<=0){p.trT=.6;p.tr.push(p.x,p.y,p.z);if(p.tr.length>24)p.tr.splice(0,3)}
    if(Math.hypot(tg.x-p.x,tg.y-p.y)<tg.T.L*.3+1.2){boom(p,tg);mis.splice(i,1);continue}
    if(p.life<=0)mis.splice(i,1);
  }
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
function drawShip(g,s,x,y,k,dp){
  const len=Math.max(7*s.T.L*dp,s.T.L*k),wid=len*(WR[s.cls]||.3)*2,r=len/2,now=performance.now();
  if(x<-len||x>W+len||y<-len||y>H+len)return;
  if(len<11*dp&&s.alive&&s!==sel){g.save();g.translate(x,y);g.scale(1,curCT);g.rotate(s.hd);g.fillStyle=C[s.side];g.fillRect(-r,-wid*.25,len,wid*.5);g.restore();return}
  if(s===sel){g.strokeStyle='#fff';g.lineWidth=dp;g.beginPath();g.arc(x,y,r+6*dp,0,6.283);g.stroke()}
  if(curST>.05&&len>=14*dp&&s.alive){const dep=wid*.2*curST,nL=Math.min(16,Math.max(3,Math.ceil(dep/(.8*dp))));
    for(let i=nL;i>=1;i--){g.save();g.translate(x,y+dep*i/nL);g.scale(1,curCT);g.rotate(s.hd);g.beginPath();HULL.forEach(([a,b],j)=>j?g.lineTo(a*len,b*wid*.5):g.moveTo(a*len,b*wid*.5));g.closePath();
      g.fillStyle=i>nL*.75?'#0a0d13':CD[s.side];g.fill();g.restore()}}
  g.save();g.translate(x,y);g.scale(1,curCT);g.rotate(s.hd);
  const hull=()=>{g.beginPath();HULL.forEach(([a,b],i)=>i?g.lineTo(a*len,b*wid*.5):g.moveTo(a*len,b*wid*.5));g.closePath()};
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
    g.save();hull();g.clip();s.zones.forEach((z,zi)=>{if(z.arm>0)return;g.fillStyle='rgba(255,110,50,.2)';const pad=zi===0?[.25,-.15,.25,.3]:zi===2?[-.5,-.28,.18,.56]:zi===1?[-.3,0,.6,.5]:[-.3,-.5,.6,.5];g.fillRect(pad[0]*len,pad[1]*wid,pad[2]*len,pad[3]*wid)});g.restore();
    const mr=Math.max(1.4*dp,len*.032);
    for(const z of s.zones)for(const m of z.mods){const mx=m.u*len,my=m.v*wid*.7;
      if(!m.alive){g.fillStyle='#1a1d23';g.beginPath();g.arc(mx,my,mr*1.2,0,6.283);g.fill();g.strokeStyle='#ef6a5e';g.lineWidth=dp*.7;g.beginPath();g.moveTo(mx-mr,my-mr);g.lineTo(mx+mr,my+mr);g.moveTo(mx+mr,my-mr);g.lineTo(mx-mr,my+mr);g.stroke();continue}
      if(m.k==='T'||m.k==='A'){
        g.fillStyle='#0d1219';g.beginPath();g.arc(mx,my,mr*1.15,0,6.283);g.fill();g.fillStyle=m.k==='T'?CL[s.side]:'#ffe08a';g.beginPath();g.arc(mx,my,mr*.7,0,6.283);g.fill();
        const aim=(m.fa!=null?m.fa-s.hd:0),bl=mr*(m.k==='T'?2.4:1.5);g.strokeStyle=m.k==='T'?'#e8f3ff':'#ffd27a';g.lineWidth=Math.max(dp,mr*.5);g.beginPath();g.moveTo(mx,my);g.lineTo(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl);g.stroke();
        if(m.rt&&now-m.rt<130){g.fillStyle='rgba(255,245,200,'+(1-(now-m.rt)/130)+')';g.beginPath();g.arc(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl,mr*1.05,0,6.283);g.fill()}}
      else if(m.k==='L'){
        const aim=(m.fa!=null?m.fa-s.hd:0),bl=mr*3.2,hot=m.rt&&now-m.rt<380;
        g.fillStyle='#0d1219';g.beginPath();g.arc(mx,my,mr*1.3,0,6.283);g.fill();g.fillStyle=hot?'#fff':(s.side?'#ff7ad9':'#6af0ff');g.beginPath();g.arc(mx,my,mr*.85,0,6.283);g.fill();
        g.strokeStyle='#d8f6ff';g.lineWidth=Math.max(dp,mr*.45);g.beginPath();g.moveTo(mx,my);g.lineTo(mx+Math.cos(aim)*bl,my+Math.sin(aim)*bl);g.stroke()}
      else if(m.k==='M'){
        g.fillStyle='#0d1219';g.fillRect(mx-mr*1.4,my-mr*1.1,mr*2.8,mr*2.2);g.fillStyle=m.ammo>0?'#ffb36b':'#554';
        g.fillRect(mx-mr*1.1,my-mr*.8,mr*.9,mr*.6);g.fillRect(mx+mr*.2,my-mr*.8,mr*.9,mr*.6);g.fillRect(mx-mr*1.1,my+mr*.2,mr*.9,mr*.6);g.fillRect(mx+mr*.2,my+mr*.2,mr*.9,mr*.6)}
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
    for(const p of proj){if(p.side!==side)continue;const x=X(p.x),y=Y(p.y)+Z(p.z);
      if(projMode){g.moveTo(x,y);g.lineTo(x-p.vx/VP*9*dp,y-p.vy/VP*9*dp)}else{g.moveTo(x+1.6*dp,y);g.arc(x,y,1.6*dp,0,6.283)}}
    if(projMode)g.stroke();else g.fill();
  }
  g.globalAlpha=1;
  for(const side of [0,1]){g.strokeStyle=CL[side];g.lineWidth=2*dp;g.beginPath();
    for(const p of torps){if(p.side!==side||!p.tgt)continue;const x=X(p.x),y=Y(p.y),dx=p.tgt.x-p.x,dy=p.tgt.y-p.y,l=Math.hypot(dx,dy)||1,tl2=Math.max(10*dp,40*k);g.moveTo(x,y);g.lineTo(x-dx/l*tl2,y-dy/l*tl2)}
    g.stroke()}
  const ord=d3?ships.slice().sort((a,b)=>a.z-b.z):ships;
  for(const s of ord)drawShip(g,s,X(s.x),Y(s.y)+Z(s.z),k,dp);
  // ракеты
  for(const side of [0,1]){g.strokeStyle=CL[side];g.lineWidth=dp;g.globalAlpha=.22;g.beginPath();
    for(const p of mis){if(p.side!==side||p.tr.length<6)continue;g.moveTo(X(p.tr[0]),Y(p.tr[1])+Z(p.tr[2]));for(let i=3;i<p.tr.length;i+=3)g.lineTo(X(p.tr[i]),Y(p.tr[i+1])+Z(p.tr[i+2]));g.lineTo(X(p.x),Y(p.y)+Z(p.z))}
    g.stroke();g.globalAlpha=1}
  for(const p of mis){const x=X(p.x),y=Y(p.y)+Z(p.z),L=Math.max(12*dp,k*4),Wd=L*.24;
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
  for(const side of [0,1]){g.strokeStyle=CL[side];g.globalAlpha=.25;g.beginPath();
    for(const c of air){if(c.side!==side||c.state!=='fly'||c.tr.length<4)continue;const zz=Z(c.home.z);g.moveTo(X(c.tr[0]),Y(c.tr[1])+zz);for(let i=2;i<c.tr.length;i+=2)g.lineTo(X(c.tr[i]),Y(c.tr[i+1])+zz);g.lineTo(X(c.x),Y(c.y)+zz)}
    g.stroke()}
  g.globalAlpha=1;
  for(const side of [0,1])for(const type of ['F','B']){
    g.fillStyle=CL[side];g.beginPath();const sz=(type==='F'?3.8:5.2)*dp;
    for(const c of air){if(c.side!==side||c.type!==type||c.state!=='fly')continue;
      const x=X(c.x),y=Y(c.y)+Z(c.home.z),a=c.h;
      g.moveTo(x+Math.cos(a)*sz,y+Math.sin(a)*sz);g.lineTo(x+Math.cos(a+2.5)*sz,y+Math.sin(a+2.5)*sz);g.lineTo(x+Math.cos(a-2.5)*sz,y+Math.sin(a-2.5)*sz);g.closePath()}
    g.fill()}
  const now=performance.now();shots=shots.filter(s=>now-s.rt<140);
  g.lineWidth=1.4*dp;
  for(const sh of shots){g.strokeStyle='#fff';g.globalAlpha=1-(now-sh.rt)/140;g.beginPath();g.moveTo(X(sh.x1),Y(sh.y1));g.lineTo(X(sh.x1+(sh.x2-sh.x1)*.7),Y(sh.y1+(sh.y2-sh.y1)*.7));g.stroke()}
  beams=beams.filter(b=>now-b.rt<420);
  for(const b of beams){const u=(now-b.rt)/420,a=Math.pow(1-u,.7);if(b.b.alive){b.tx=b.b.x;b.ty=b.b.y;b.tz=b.b.z}
    const x1=X(b.a.x),y1=Y(b.a.y)+Z(b.a.z),x2=X(b.tx),y2=Y(b.ty)+Z(b.tz);g.lineCap='round';
    g.strokeStyle=b.side?'#ff5fd0':'#4fe6ff';g.globalAlpha=.25*a;g.lineWidth=(5+b.w*1.1)*dp;g.beginPath();g.moveTo(x1,y1);g.lineTo(x2,y2);g.stroke();
    g.globalAlpha=.6*a;g.lineWidth=(2.4+b.w*.3)*dp;g.stroke();
    g.strokeStyle='#fff';g.globalAlpha=a;g.lineWidth=(1+b.w*.12)*dp;g.stroke();
    const gr=g.createRadialGradient(x2,y2,0,x2,y2,(6+b.w)*dp);gr.addColorStop(0,'rgba(255,255,255,'+a+')');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.globalAlpha=1;g.beginPath();g.arc(x2,y2,(6+b.w)*dp,0,6.283);g.fill();
    g.lineCap='butt'}
  g.globalAlpha=1;
  for(const f of fx){const u=(t-f.t0)/f.d,x=X(f.x),y=Y(f.y)+Z(f.z||0);
    if(f.r>=3){const rr=Math.max(3*dp,f.r*k*Math.min(1,u*2.5)*.6),al=Math.pow(Math.max(0,1-u),1.6);
      if(rr>5*dp){const gr=g.createRadialGradient(x,y,0,x,y,rr);gr.addColorStop(0,'rgba(255,246,210,'+al+')');gr.addColorStop(.45,'rgba(255,150,60,'+al*.65+')');gr.addColorStop(1,'rgba(255,90,30,0)');g.fillStyle=gr;g.globalAlpha=1;g.beginPath();g.arc(x,y,rr,0,6.283);g.fill()}
      else{g.fillStyle='#ffc46a';g.globalAlpha=al;g.beginPath();g.arc(x,y,rr,0,6.283);g.fill()}}
    else{g.globalAlpha=Math.max(0,1-u);g.strokeStyle='#fff3c4';g.lineWidth=1.5*dp;g.beginPath();g.arc(x,y,Math.max(2.5*dp,f.r*k*u*3),0,6.283);g.stroke()}}
  g.globalAlpha=1;
}
const SHORT={cv:'ав',hc:'тк',dd:'эс',fr:'фр'};
const aliveBy=s=>ships.filter(o=>o.side===s&&o.alive).length;
function checkEnd(){
  if(done)return;
  {let md=1e9;const F=[...FL.values()];for(const a of F)for(const b of F)if(a.side===0&&b.side===1)md=Math.min(md,Math.hypot(a.cx-b.cx,a.cy-b.cy));
   if(md<200)hadContact=true;if(hadContact&&md>420&&F.length>1){sepT+=1;if(sepT>90&&cfgNow&&cfgNow.demo)done=true}else sepT=0}
  if(aliveBy(0))lastFriend=t;
  if((!aliveBy(1)&&!pend.length)||(!aliveBy(0)&&t-lastFriend>1800)||t>((cfgNow&&cfgNow.maxT)||14400))done=true;
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
    h+=`<span class="c${'ab'[s]}"><b>${(cfgNow&&cfgNow.names||['Ваш флот','Налётчики'])[s]}</b>${sh} · рельсы ${stat.shots[s]}/${stat.hits[s]} (${acc}) · истр. ${F} (−${stat.lostF[s]}) · бомб. ${Bm} (−${stat.lostB[s]}) · торп. ${stat.torp[s]}→${stat.torpHit[s]} · ПВО ${stat.flak[s]} · лазеры ${stat.las[s]} · ракеты ${stat.mis[s]}→${stat.misHit[s]} (сбито ${stat.misShot[1-s]}) · сломано двиг. ${stat.bfail[s]}</span>`;
  }
  if(done)h+=`<span class="${al[0]?'ca':'cb'}"><b>Итог</b>${!al[1]&&al[0]?'победа':!al[0]&&al[1]?'поражение':!al[0]?'взаимное уничтожение':'враг отступил'}</span>`;
  $b('bstats').innerHTML=h;
  const inf=$b('binfo');
  if(sel){inf.hidden=false;const s=sel,tur=s.tur.filter(m=>m.alive).length,sk=s.tur.length?(s.tur.reduce((a,m)=>a+m.sk,0)/s.tur.length).toFixed(1):'—';
    inf.innerHTML=`<b class="c${'ab'[s.side]}">${s.T.n}</b>${s.alive?'':' <span class="muted">(уничтожен)</span>'}<br>Длина ${Math.round(s.T.L*1000)} м · модули: ${s.aliveN}/${s.total} · ядро ${s.core.alive?'цело':'уничтожено'}<br>Турели: ${tur}/${s.tur.length} · ср. навык ${sk}<br>Двигатели: ${s.engN}/${s.T.eng}${s.bst>1.1?' · форсаж '+Math.round(s.bst*100)+'%':''}${s.lrp?' · дальний бой '+s.lrp.toFixed(0):''}<br>Высота: ${s.z.toFixed(0)}<br>Броня (слоёв): ${s.zones.map((z,i)=>ZN[i]+' '+z.arm+'/'+s.T.arm).join(' · ')}`}
  else inf.hidden=true;
}
const PM=['точки','короткие линии','скрыть'];
let bspeed=30,sepT=0,hadContact=false;
function frame(rdt){if(!active||done)return;const sim=rdt*bspeed,n=Math.min(4,Math.max(1,Math.ceil(sim/2)));for(let i=0;i<n;i++){tick(Math.min(2,sim/n))}}
function tick(dt){
  if(done)return;
  while(pend.length&&pend[0].t<=t){const p=pend.shift();join(p.side==null?1:p.side,p.spec,p.edge||1500,p.ang)}
  step(dt);checkEnd();
}
function join(side,spec,edge,ang){
  spec.cls=classify(spec);spec.dopt=spec.dopt0||DOPT[spec.cls];
  const sh=ang==null?mkShip(side,spec,(side?1:-1)*edge+R(-80,80),R(-150,150)):mkShip(side,spec,Math.cos(ang)*edge+R(-40,40),Math.sin(ang)*edge+R(-40,40));
  if(ang!=null)sh.hd=ang+Math.PI;ships.push(sh);
  if(sh.car){if(spec.F>0)addFlights(sh,'F',spec.F);if(spec.B>0)addFlights(sh,'B',spec.B)}
  return sh;
}
function begin(cfg){cfgNow=cfg;reset(cfg);active=true;acc=0;prevTilt=ui.tilt||0;setTilt(30);
  $b('btitle').textContent=cfg.title||'Бой';$b('battle').hidden=false;bind();}
let prevTilt=0;
function abort(){setTilt(Math.round(prevTilt*180/Math.PI));ui.bship=false;active=false;$b('battle').hidden=true;cfgNow=null}
function finish(){setTilt(Math.round(prevTilt*180/Math.PI));active=false;$b('battle').hidden=true;const r=result(),cb=cfgNow.onEnd;cfgNow=null;cb(r)}
function bind(){
  if(bound)return;bound=true;
  $b('bspd').onclick=e=>{const v=+e.target.dataset.v;if(!v)return;bspeed=v;for(const b of $b('bspd').children)b.classList.toggle('on',+b.dataset.v===v)};
  $b('bfol').onclick=e=>{ui.bship=!ui.bship;e.target.classList.toggle('on',ui.bship)};
  $b('bstop').onclick=()=>{if(cfgNow&&cfgNow.demo){abort();state.demo=false}};
  $b('bgo').onclick=()=>{ui.bfollow=true;focusBattle()};
  $b('btilt').oninput=e=>setTilt(+e.target.value);
  $b('bpm').onclick=e=>{projMode=(projMode+1)%3;e.target.textContent='Снаряды: '+PM[projMode]};
}
function pick(mx,my){const cT=vw.cT||1,sT=vw.sT||0;let b=null,bd=16;
  for(const s of ships){const d=Math.hypot(vw.ox+s.x*vw.kk-mx,vw.oy+s.y*vw.kk*cT-s.z*vw.kk*sT*.7-my);if(d<bd){bd=d;b=s}}
  if(b){sel=b;return true}return false}
return {stat:()=>stat,frame,setSpeed:v=>{bspeed=v},getSpeed:()=>bspeed,anchorSel:()=>sel,abort,ships:()=>ships,begin,tick,draw,hud,pick,join,finish,isDone:()=>done,active:()=>active,hot:()=>autoSlow&&t-lastEng<3,later:(tt,spec)=>pend.push({t:t+tt,spec}),time:()=>t,clear:()=>{sel=null}};
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
    lasers: st.lgun, laserCfg: st.lasList, miss: st.msl, missCfg: st.misList, railCfg: st.railList, flakCfg: st.flakList, defl: st.defl, fq: st.fq, bq: st.bq};
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
