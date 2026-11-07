// @ts-nocheck
import { RES, compOf, dist, fmtN, log, mkKey, rec, specTons, fitSpec, CR_DEF, randCraft, state } from './01-data.ts';
import { tm, ta } from './15-techs.ts';
import { effSkill, officerById } from './02-crew.ts';
import { W, H, bar, cx, focusBattle, ui, setTilt } from './08-map-ui.ts';
import { Sfx } from './18-audio.ts';

/* ===== БОЙ (движок боя из демо) ===== */
export const Battle = (() => {
const $b = id => document.getElementById(id);

const DOPT={hc:20,dd:20,fr:35,cv:100},JINK=0.0015,VP=6,LIFE=10,RANGE=VP*LIFE,SIGMA=0.02,LAUNCH=450,SUB=0.25,REL=60;
const FI={vmax:2,a:0.25,fuel:1500,ammo:60,hp:8,gun:4},BO={vmax:0.8,a:0.05,fuel:2200,hp:4};
const TORP={sp:2.5,pd:0.02,pdr:35,launch:120,mod:2};
const FLAK={range:60,blast:1.2};
const RC0={dmg:1,vp:6,rng:60,shells:1,rel:1,fail:0,sig:1,cal:10},FC0={blast:1.2,rng:60,rel:1,fail:0},LC0={dmg:4,rng:250,chg:.08},MC0={hp:2,spd:8,dmg:4,blast:6,ammo:4,rng:220,rel:.83};
const BURST={5:3,10:5,15:5,20:5},RCT={5:18,10:48,15:85,20:130};
const ZN=['нос','правый борт','корма','левый борт'];
const BSPEEDS=[1,5,20,100,300];
let frags=[],pyro=[],pods=[],lands=[],mis=[],beams=[],bursts=[],curCT=1,curST=0,ships,proj,fx,flights,air,torps,shots,fly,t,paused=false,speed=100,acc=0,stat,lastEng=-99,autoSlow=true,autoCam=true,sel=null,projMode=0,done=false,isOpen=false,cfgNow=null,bound=false,last=0;
let lastDmgT=0,env=[],ORD={st:null,focus:null},nextVis=0,nextCrew=0,lastCrewT=0,endSaid=false;
const say=(side,key,s)=>{if(active&&!done)Sfx.radio(side,key,s)};
const EW={fr:.12,cv:.05,dd:.02,hc:.02},RADAR={cv:420,hc:320,dd:260,fr:360},MARN={cv:20,hc:10,dd:8,fr:4};
let pend=[],lastFriend=0,vw={ox:0,oy:0,kk:1},active=false;
const R=(a,b)=>a+Math.random()*(b-a);
const gauss=()=>{let u=0;for(let i=0;i<4;i++)u+=Math.random();return (u-2)*1.73};
const adiff=(a,b)=>{let d=b-a;while(d>Math.PI)d-=6.283;while(d<-Math.PI)d+=6.283;return d};
const classify=sp=>sp.F+sp.B>0?'cv':(sp.flak>=sp.rails&&sp.flak>0)?'fr':((sp.L0!=null?sp.L0>=1.6:specTons(sp)>=50000)||sp.rails>=40)?'hc':'dd';
function mkShip(side,sp,x,y){
  const T={tons:sp.tons||specTons(sp),role:sp.role,n:sp.name,defl:sp.defl||0,arm:sp.arm,eng:Math.max(1,sp.eng||3),spd:sp.spd||1,L:Math.max(0.06,sp.L),dopt:sp.dopt};
  const nc=Math.max(2,Math.round(T.L*1000/4)); // броня: по одной ячейке на метр длины в каждом слое (4 сектора по L/4 колонок)
  const zones=ZN.map(()=>({arm:T.arm,nc,cols:new Uint8Array(nc).fill(Math.min(255,T.arm)),armN:nc*Math.min(255,T.arm),mods:[]}));
  const add=(k,z)=>{const m={k,alive:true,sk:(k==='T'||k==='A')?Math.max(1,Math.min(10,Math.round((sp.sk||5.5)+gauss()*2))):0,cd:R(0,REL),z};zones[z].mods.push(m);return m};
  const tur=[];for(let i=0;i<sp.rails;i++){const m=add('T',i%4);m.cfg=(sp.railCfg&&sp.railCfg[i])||RC0;tur.push(m)}for(let i=0;i<sp.flak;i++){const m=add('A',(i+2)%4);m.cfg=(sp.flakCfg&&sp.flakCfg[i])||FC0;tur.push(m)}
  for(let i=0;i<(sp.lasers||0);i++){const m=add('L',(i+1)%4);m.cfg=(sp.laserCfg&&sp.laserCfg[i])||LC0;tur.push(m)}
  for(let i=0;i<(sp.miss||0);i++){const m=add('M',(i+3)%4);m.cfg=(sp.missCfg&&sp.missCfg[i])||MC0;m.ammo=m.cfg.ammo;tur.push(m)}
  for(let i=0;i<T.eng;i++)add('E',2);
  const core=add('C',(Math.random()*4)|0),total=sp.rails+sp.flak+(sp.lasers||0)+(sp.miss||0)+T.eng+1;
  const sh={hv:[[0,1,4],[2,3,0]][side][(Math.random()*3)|0],fid:sp.fid||0,side,cls:sp.cls,T,x,y,vx:0,vy:0,sx:0,sy:0,ax:0,ay:0,next:0,alive:true,nt:0,car:(sp.F+sp.B)>0,hd:side?Math.PI:0,zones,tur,core,total,aliveN:total,engN:T.eng,pool:{ammo:Math.round(((sp.fq&&sp.fq.ammo)||CR_DEF.F.ammo)*.5)*sp.F,torp:sp.B},nextL:0,spec:sp,z:0,bst:1,lrp:0,srp:0,crew:1,pers:Math.max(20,Math.round(T.tons/40*(sp.role==='freight'?.25:1))),evac:0,abd:0,ldT:0,mor:Math.min(.95,Math.max(.3,.42+.05*(sp.sk||5.5)+R(-.05,.05))),st:'ok',fire:[0,0,0,0],heat:0,ovh:0,hitT:-99,flash:-99,seen:[-99,-99],lock:[-99,-99],rdOn:false,fine:false,trk:[],sc:sp.scList||[{k:'ir',rng:(RADAR[sp.cls]||280)*.8,res:.6},{k:'em',rng:RADAR[sp.cls]||280,res:.6},{k:'rad',rng:(RADAR[sp.cls]||280)*.9,res:1,fine:1}],ch:sp.fcsN!=null?sp.fcsN:({cv:4,hc:8,dd:3,fr:4}[sp.cls]||3),jam:0,blk:0,reps:0,bdo:0,board:null,rad:sp.radar!=null?70+110*Math.min(3,sp.radar):(RADAR[sp.cls]||280),mar:sp.mar!=null?sp.mar:(sp.role==='freight'?0:((sp.mar!=null?sp.mar:MARN[sp.cls])||0))};
  if(side===0&&sh.ch>0)sh.ch+=ta('fcs');
  for(const m of tur){if(m.k==='L')sh.lrp+=m.cfg.dmg*Math.min(300,m.cfg.rng)/100*.5;else if(m.k==='M')sh.lrp+=m.cfg.dmg*.8*m.cfg.ammo/8;else if(m.k==='T')sh.srp+=m.cfg.dmg*m.cfg.shells}
  sh.lrR=Math.max(0,...tur.filter(m=>m.k==='L').map(m=>Math.min(300,m.cfg.rng)));
  zones.forEach((z,zi)=>{const ms=z.mods.filter(m=>m.k!=='C'),n=ms.length;ms.forEach((m,i)=>{
    const cn=Math.min(n,zi===0||zi===2?7:12),row=Math.floor(i/cn),col=i%cn,nr=Math.ceil(n/cn),cc=Math.min(cn,n-row*cn);
    if(zi===0){m.u=.2+.07*(nr-1-row)+.04*(col%2);m.v=(col-(cc-1)/2)*Math.min(.12,.7/cc)}
    else if(zi===2){m.u=-.42+.07*row;m.v=(col-(cc-1)/2)*Math.min(.12,.7/cc)}
    else{m.u=-.3+.6*(col+.5)/cc;m.v=(zi===1?1:-1)*(.1+.08*row)}});});
  core.u=.02;core.v=0;
  {let ci=0;for(const z of zones)for(const m of z.mods)if(m.k==='T'||m.k==='A'||m.k==='L'||m.k==='M')m.face=[0,0,1,3,0,2,1,3,0,2][ci++%10]} // стороны башен: верх/правый/низ/левый
  sh.roll=0;sh.rollT=0;sh.pOff=0;sh.pNext=0;
  const cand=[];for(const z of zones)for(const m of z.mods)if(m.k!=='C')cand.push(m);
  const kill=Math.floor((sp.dmg||0)*(total-1));
  for(let i=0;i<kill&&cand.length;i++){const m=cand.splice((Math.random()*cand.length)|0,1)[0];m.alive=false;sh.aliveN--;if(m.k==='E')sh.engN--}
  return sh;
}
function addFlights(sh,ty,total){
  const q=sh.spec[ty==='F'?'fq':'bq'],D=CR_DEF[ty],P=Object.assign({},ty==='F'?FI:BO);{const g=k=>q&&Number.isFinite(q[k])?q[k]:D[k];P.hp=g('hp');P.vmax=g('vmax');P.a=g('a');P.fuel=g('fuel');P.ammo=g('ammo');P.ng=g('ng');P.dmg=g('dmg');P.cd=g('cd');P.gun=g('gun')||P.gun;P.mass=g('mass')}
  const per=ty==='F'?10:5,nfl=Math.ceil(total/per);let left=total;
  for(let f=0;f<nfl;f++){const n=Math.min(per,left);left-=n;
    const fl={side:sh.side,type:ty,home:sh,cr:[],mode:'bay',svc:0,t0:0,leader:null,lane:(f-(nfl-1)/2)*(ty==='F'?18:30)};
    for(let k=0;k<n;k++){const c={side:sh.side,type:ty,fl,home:sh,own:sh,x:sh.x,y:sh.y,vx:0,vy:0,h:sh.side?Math.PI:0,P,hp:P.hp,ammo:ty==='F'?P.ammo:1,fuel:P.fuel,
      ms:sh.spec.fmis&&ty==='F'?sh.spec.fmis.n:0,mk:sh.spec.fmis&&sh.spec.fmis.k,state:'bay',launched:false,launchAt:0,ret:false,cd:R(0,.5),jx:0,jy:0,jt:0,tg:null,goal:null,sh:null,slot:k,eng:-99,tr:[],trT:0,na:0};fl.cr.push(c);air.push(c)}
    flights.push(fl)}
}
function reset(cfg){
  hadContact=false;sepT=0;lastDmgT=0;frags=[];pyro=[];pods=[];lands=[];ships=[];FL=new Map();GR=[new Map(),new Map()];smoke=[];proj=[];mis=[];beams=[];bursts=[];fx=[];flights=[];air=[];torps=[];shots=[];fly=[[],[]];t=0;lastEng=-99;nextVis=0;nextCrew=0;lastCrewT=0;endSaid=false;ORD={st:null,focus:null};env=[];
  if(cfg.env!==false&&(cfg.env||Math.random()<.55)){const cl=1+((Math.random()*2)|0);for(let c=0;c<cl;c++){const cx0=R(-220,220),cy0=R(-200,200),n=4+((Math.random()*8)|0);for(let i=0;i<n;i++)env.push({t:'rock',x:cx0+R(-70,70),y:cy0+R(-60,60),r:R(.6,3),vx:0,vy:0,ttl:1e9})}
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
const hpf=s=>s.aliveN/s.total,PW=12; // PW: ширина воронки в колонках на единицу урона
const val=s=>s.T.role==='freight'?.6:(VAL[s.cls]||1);
function fleetsUpdate(){
  for(const F of FL.values()){F.ships=[];F.lrp=0;F.srp=0;F.lrR=0;F.n=0;F.cx=0;F.cy=0;F.str=0;F.fr=0}
  for(const s of ships){if(!s.alive)continue;const key=s.side*1000+s.fid;let F=FL.get(key);
    if(!F){F={ships:[],n:0,cx:0,cy:0,str:0,fr:0,key,side:s.side,fid:s.fid,next:0,stance:'engage',until:0,flank:Math.random()<.4?(Math.random()<.5?1:-1)*R(.7,1.2):0,tgt:null,focus:null,gx:s.x,gy:s.y,dx:-s.x/(Math.hypot(s.x,s.y)||1),dy:-s.y/(Math.hypot(s.x,s.y)||1),slotsAt:-99,rng:40,lrp:0,srp:0,lrR:0,zl:(((s.side*3+s.fid)%3)-1)*14,wait0:-1,born:t};FL.set(key,F)}
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
      if(dist>F.rng*1.6)for(const A of all){if(A.side!==F.side||A===F||A.convoy||A.n<1)continue;
        const dA=Math.hypot(A.cx-bf.cx,A.cy-bf.cy);
        if(dA<1000&&dA>F.rng*2&&dA>dist+20&&dist<700&&A.born<=t){waiting=true;break}}
      if(waiting){if(F.wait0<0)F.wait0=t;if(t-F.wait0<260)st='wait'}else if(dist>420||st!=='wait')F.wait0=-1;
      F.stance=st}
    F.ratio=ratio;
    if(F.side===0&&ORD.st&&!F.convoy){F.stance=ORD.st;if(ORD.st==='kite')F.hold=Math.max(60,F.lrR*.8,80);if(ORD.st==='retreat')F.until=t+6}
    // строй держится, пока флот не окружён и враг не вклинился внутрь
    {const dirs=[];let inside=0;for(const E of all){if(E.side===F.side)continue;if(Math.hypot(E.cx-F.cx,E.cy-F.cy)<280)dirs.push(Math.atan2(E.cy-F.cy,E.cx-F.cx))}
      let mx=0;for(let i=0;i<dirs.length;i++)for(let j=i+1;j<dirs.length;j++)mx=Math.max(mx,Math.abs(adiff(dirs[i],dirs[j])));
      for(const E of all)if(E.side!==F.side&&Math.hypot(E.cx-F.cx,E.cy-F.cy)<35)inside+=E.n;
      if(mx>1.9||inside>F.n*.25){F.brk=t+30}
      F.formed=t>(F.brk||0)}
    // общий фокус огня: самая ценная и повреждённая цель в зоне
    const cand=around(1-F.side,F.cx+(bf.cx-F.cx)*.3,F.cy+(bf.cy-F.cy)*.3,110);let fb=null,fs=0;
    for(const o of cand){const sc=val(o)*(1.4-hpf(o))/(1+Math.hypot(o.x-F.cx,o.y-F.cy)/100);if(sc>fs){fs=sc;fb=o}}F.focus=fb;if(F.side===0&&ORD.focus&&ORD.focus.alive)F.focus=ORD.focus;
    // точка сбора флота и направление строя
    let dx=bf.cx-F.cx,dy=bf.cy-F.cy;const dl=Math.hypot(dx,dy)||1;dx/=dl;dy/=dl;
    if(F.stance==='flank'){const a=F.flank*Math.min(1,Math.max(0,(dist-F.rng*2)/160)),c=Math.cos(a),s2=Math.sin(a);[dx,dy]=[dx*c-dy*s2,dx*s2+dy*c]}
    if(F.stance==='retreat'||F.stance==='convoy'){F.tgx=F.cx-dx*160;F.tgy=F.cy-dy*160;if(F.stance==='convoy'){const ne=bf;F.tgx=F.cx-(ne.cx-F.cx)/dl*200;F.tgy=F.cy-(ne.cy-F.cy)/dl*200}}
    else if(F.stance==='wait'){F.tgx=F.cx;F.tgy=F.cy}
    else{const hold=F.stance==='kite'?F.hold:F.stance==='assault'?14:Math.max(14,Math.max(25,F.rng*(F.stance==='engage'?.9:1.3))*Math.max(.3,1-Math.max(0,t-lastDmgT-60)/240));F.tgx=bf.cx-dx*hold;F.tgy=bf.cy-dy*hold}
    // ручной приказ: идти в точку (игрок, сторона 0)
    if(F.side===0&&F.mv){const md=Math.hypot(F.mv.x-F.cx,F.mv.y-F.cy);if(md>6){F.tgx=F.mv.x;F.tgy=F.mv.y;if(F.stance!=='retreat'&&F.stance!=='convoy'){const l=Math.hypot(F.mv.x-F.cx,F.mv.y-F.cy)||1;dx=(F.mv.x-F.cx)/l;dy=(F.mv.y-F.cy)/l}}else F.mv=null}
    // слои по высоте: в бою флоты сближаются по вертикали
    if(F.flank&&dist<420)F.zl+=((F.flank>0?24:-24)-F.zl)*.3;
    F.tdx=dx;F.tdy=dy;
    if(F.n!==F.nSlots||t-F.slotsAt>6){assignSlots(F);F.nSlots=F.n;F.slotsAt=t}
    if(t-F.born<20)for(const q of F.ships)if(!q.placed&&q.slotBack!=null){q.placed=1;const px=-F.dy,py=F.dx;q.x=F.gx-F.dx*q.slotBack+px*q.slotLat;q.y=F.gy-F.dy*q.slotBack+py*q.slotLat;q.sx=q.sy=0;q.hd=Math.atan2(F.dy,F.dx)}
  }
  for(const F of all){const dtf=Math.min(5,Math.max(0,t-(F.pt==null?t:F.pt)));F.pt=t;if(F.tgx==null){F.tgx=F.gx;F.tgy=F.gy;F.tdx=F.dx;F.tdy=F.dy}
    const k=1-Math.exp(-dtf/5),gdx=F.tgx-F.gx,gdy=F.tgy-F.gy,gd=Math.hypot(gdx,gdy)||1,stp=Math.min(gd*k,(F.minSpd||.45)*1.05*dtf);F.gx+=gdx/gd*stp;F.gy+=gdy/gd*stp;F.dx+=(F.tdx-F.dx)*k*.7;F.dy+=(F.tdy-F.dy)*k*.7;const l=Math.hypot(F.dx,F.dy)||1;F.dx/=l;F.dy/=l}
}
function assignSlots(F){ // строй: впереди крепкие, за ними основные стрелки, в хвосте авианосцы, транспорты и ПВО
  const r0=[],r1=[],r2=[],fight=[];
  for(const s of F.ships){if(s.cls==='cv'||s.T.role==='freight'||s.cls==='fr')r2.push(s);else fight.push(s)}
  fight.sort((a,b)=>b.T.arm*(1+b.T.L)-a.T.arm*(1+a.T.L));
  const nt=Math.max(1,Math.round(fight.length*.38));fight.forEach((s,i)=>(i<nt?r0:r1).push(s));
  // дальность орудий: каждый ряд встаёт позади переднего ровно на разницу дальностей, чтобы все вступали в огонь одновременно
  const rgOf=o=>{if(o.maxR)return o.maxR;let m=0;for(const q of o.tur)if(q.cfg&&q.cfg.rng&&q.k!=='L'&&q.k!=='M')m=Math.max(m,q.cfg.rng);return m||60};
  for(const o of fight)o.T.dopt=Math.max(14,Math.min(120,rgOf(o)*.8));
  F.rng=F.ships.reduce((a,o)=>a+o.T.dopt,0)/F.n;
  let back=0,frontD=0;
  [[r0,0],[r1,1],[r2,2]].forEach(([row,ri])=>{if(!row.length)return;
    if(ri===0)frontD=row.reduce((a,o)=>a+o.T.dopt,0)/row.length;
    else if(ri===1){const rd=row.reduce((a,o)=>a+o.T.dopt,0)/row.length;back=Math.max(back,rd-frontD)}
    row.sort((a,b)=>b.T.L-a.T.L);const per=Math.min(16,Math.max(4,Math.ceil(Math.sqrt(row.length*2.4)))),lines=Math.ceil(row.length/per);
    row.forEach((s,i)=>{const line=Math.floor(i/per),col=i%per,n=Math.min(per,row.length-line*per),sp=Math.max(.5,s.T.L*2.6+.35);
      s.slotLat=(col-(n-1)/2)*sp+(ri===1||line%2?sp*.5:0);s.slotBack=back+line*1.6;s.row=ri});
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
  for(const po of [0,Q,-Q,Math.PI])for(let k=0;k<4;k++){const roll=k*Q;let sc=0;
    for(const m of tur)if(bearsDir(m,roll,-po,vert))sc++;sc/=tur.length;
    if(def){const bow=Math.max(0,Math.cos(po)),str=Math.max(0,-Math.cos(po)),sid=1-Math.abs(Math.cos(po));sc=sc*.35+(fr[0]*bow+fr[2]*str+fr[1]*sid*1.0)*.65+ (po===0?.05:0)}
    const rd=Math.abs(adiff(roll,s.rollT||0))/Math.PI,pd=Math.abs(adiff(po,s.pOff||0))/Math.PI;sc-=.08*rd+.06*pd; // менять ракурс невыгодно без причины
    if(po===(s.pOff||0)&&roll===(s.rollT||0))cur=sc;
    if(sc>bs){bs=sc;best={po,roll}}}
  if(best&&bs>cur+.04){s.pOff=best.po;s.rollT=best.roll}
}
function retarget(s){
  s.nt=t+R(1.2,2.4);const C=s.F,maxR=s.maxR||60;
  s.near=around(1-s.side,s.x,s.y,maxR*1.25).filter(o=>o.lock[s.side]>t-5&&o.st!=='surr');
  let best=null,bs=-1e9;const big=s.spec.rails>=14;
  for(const o of s.near){const d=Math.hypot(o.x-s.x,o.y-s.y);let sc=-d*.5+(big?val(o)*25:val(o)*8)+(1-hpf(o))*20+(o===C.focus?30*(s.focusW||.5):0);if(sc>bs){bs=sc;best=o}}
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
  const v=m.v||0,side=Math.abs(v)>.28,ctr=side?Math.sign(v)*Math.PI/2:0,hw=side?2.0:2.6; // бортовые — наружу ±115°, осевые ±150°
  let rel=want-s.hd-ctr;rel=Math.atan2(Math.sin(rel),Math.cos(rel));rel=Math.max(-hw,Math.min(hw,rel));const target=ctr+rel;
  if(m.da==null){m.da=target;m.dt=now;return m.da}
  const dt=Math.min(.1,Math.max(0,(now-m.dt)/1000));m.dt=now;
  const d=target-m.da,st=1.6*dt;m.da+=Math.abs(d)<st?d:Math.sign(d)*st;return m.da}
function steer(s,dt){
  const T=s.T,F=s.F,eng=Math.max(.15,s.engN/T.eng)*(t<s.blk?.2:1),hp=hpf(s);let vm=.2*VMK*T.spd,boost=1;if(s.st==='surr')vm=0;
  if(t>=s.nt||(s.tg&&!s.tg.alive))retarget(s);
  if(t>=s.next){s.next=t+R(6,14);s.sdir=Math.random()<.5?1:-1}
  const tg=s.tg;let vx=0,vy=0,want=s.hd;
  const formed=F.formed!==false&&F.n>=3&&!(t<s.bdo),retreating=F.stance==='retreat'&&!F.convoy,flee=(hp<.35&&!T.role)||(retreating&&!formed)||s.st==='panic',tdx=tg?tg.x-s.x:F.dx,tdy=tg?tg.y-s.y:F.dy,td=Math.hypot(tdx,tdy)||1,ux=tdx/td,uy=tdy/td;
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
    const er=Math.max(s.maxR,F.stance==='kite'?F.hold:0);let dopt=t<s.bdo?5:F.stance==='kite'?F.hold:F.stance==='assault'?14:T.dopt;
    if(tg&&tg.maxR&&tg.maxR>s.maxR*1.05&&F.stance!=='kite')dopt=Math.min(dopt,Math.max(8,s.maxR*.4)); // враг бьёт дальше — сближаемся, а не пятимся
    if(T.role==='freight'||F.stance==='convoy'&&T.role){vx=fvx;vy=fvy}
    else if(tg&&(td<er*1.5||t<s.bdo)){
      const dd=td-dopt,k=Math.abs(dd)<10?0:Math.max(-1,Math.min(1,(dd-Math.sign(dd)*10)/20)),lat=0,w=formed?.93:F.stance==='kite'?.15:s.cls==='hc'||s.cls==='cv'?.55:.25;
      let rx=ux*vm*k*.85-uy*lat,ry=uy*vm*k*.85+ux*lat;want=Math.atan2(uy,ux)+(td<er*.9?(s.pOff||0):0);
      
      vx=w*fvx+(1-w)*rx;vy=w*fvy+(1-w)*ry;if(retreating)want=Math.atan2(vy,vx);
      if(F.stance==='assault'&&td>s.maxR*.7)boost=Math.max(boost,1.7);
      else if(F.stance==='kite'&&td<F.hold*.6)boost=Math.max(boost,1.4);
    }else{vx=fvx;vy=fvy;if(retreating&&sp>.02)want=Math.atan2(vy,vx);else if(tg)want=Math.atan2(uy,ux);else if(sp>.02)want=Math.atan2(vy,vx);
      if(F.stance==='assault'&&tg)boost=Math.max(boost,1.5)}
  }
  if(env.length)for(const e of env){const dx=s.x-e.x,dy=s.y-e.y,d=Math.hypot(dx,dy)||1,rr=e.r+T.L*.25+8;if(d<rr){const f=Math.max(vm,.1)*(1-d/rr)*1.6;vx+=dx/d*f;vy+=dy/d*f;
    if(d<e.r+T.L*.2&&t>(s.rockT||0)){s.rockT=t+4;s.sx*=.4;s.sy*=.4;stat.rock++;hitShip(s,'rock',-dx,-dy,s.x,s.y,5);say(s.side,'rock',s)}}}
  // разлёт: не стоять друг за другом на линии огня и не кучковаться
  for(const o of around(s.side,s.x,s.y,6)){if(o===s)continue;const dx=s.x-o.x,dy=s.y-o.y,dz=s.z-o.z,d0=Math.hypot(dx,dy)||1e-6,sr=Math.max(.9,(s.T.L+o.T.L)*1.1),d=Math.hypot(d0,dz*1.5);
    if(d<sr){const f=.2*(sr-d)/sr/d;vx+=dx*f;vy+=dy*f;s.zpush=(s.zpush||0)+(dz>=0?1:-1)*(sr-d)/sr*(1+Math.abs(dz)*0)}
    if(Math.abs(dz)>sr*.8)continue;
    if(tg&&!formed){const al=(-dx)*ux+(-dy)*uy,pp=(-dx)*(-uy)+(-dy)*ux; // o перед нами на линии на врага
      if(al>0&&Math.abs(pp)<o.T.L*.5+.8){const sg=pp>=0?-1:1,f=.12*vm*(1-Math.abs(pp)/(o.T.L*.5+.8));vx+=-uy*sg*f*3;vy+=ux*sg*f*3}}}
  {const kf=Math.min(1,dt*.35);s.dvx=s.dvx==null?vx:s.dvx+(vx-s.dvx)*kf;s.dvy=s.dvy==null?vy:s.dvy+(vy-s.dvy)*kf;vx=s.dvx;vy=s.dvy}
  // скорость вперёд больше, назад и вбок — меньше
  const c=Math.cos(s.hd),sn=Math.sin(s.hd);let fw=vx*c+vy*sn,lt=-vx*sn+vy*c;if(fw<0)fw*=.5;lt*=.6;vx=fw*c-lt*sn;vy=fw*sn+lt*c;
  if(s.ovh)boost=Math.min(boost,1.1);if(boost>1.02)s.heat+=.01*(boost-1)*dt;
  // поломка двигателя при форсаже: чем сильнее ускорение, тем выше шанс
  if(boost>1.02&&s.engN>0&&Math.random()<.00006*(1+3*(boost-1))*dt*s.engN){
    const em=[];for(const z of s.zones)for(const m of z.mods)if(m.k==='E'&&m.alive)em.push(m);
    if(em.length){const m=em[(Math.random()*em.length)|0];m.alive=false;s.aliveN--;s.engN--;stat.bfail[s.side]++;fx.push({x:s.x,y:s.y,t0:t,d:8,r:2});boost=1}}
  s.bst+=(boost-s.bst)*Math.min(1,dt*.8);boost=s.bst;
  vm*=boost;const vl=Math.hypot(vx,vy);if(vl>vm){vx*=vm/vl;vy*=vm/vl}
  // инерция: ускорение ограничено тягой и массой
  const a=.035*VMK*(eng+.1)/(1+3*Math.pow(T.L/.5,1.5))*dt*(1+(boost-1)*1.2),dvx=vx*eng-s.sx,dvy=vy*eng-s.sy,dl=Math.hypot(dvx,dvy);
  { // тяга только по оси корабля: вперёд — полная, назад — 35%, боком — 12% (маневровые); скорость сохраняется по инерции
    const ch=Math.cos(s.hd),sh=Math.sin(s.hd);let df=dvx*ch+dvy*sh,dlt=-dvx*sh+dvy*ch;
    df=Math.max(-a*.35,Math.min(a,df));dlt=Math.max(-a*.12,Math.min(a*.12,dlt));
    s.sx+=df*ch-dlt*sh;s.sy+=df*sh+dlt*ch;s.sx*=1-.0006*dt;s.sy*=1-.0006*dt}
  s.x+=s.sx*dt;s.y+=s.sy*dt;
  const turn=(.5/(1+Math.pow(T.L/.4,1.7)))*dt; // 1 км — около минуты на разворот, 4 км — минутыs.hd+=Math.max(-turn,Math.min(turn,adiff(s.hd,want)));
  s.vx=s.sx;s.vy=s.sy;
  { const rr=.14/(1+T.L)*dt,dr=adiff(s.roll||0,s.rollT||0);s.roll=(s.roll||0)+Math.max(-rr,Math.min(rr,dr)) } // крен вокруг продольной оси
  // высота (псевдо-3D)
  if(t>=(s.zn||0)){s.zn=t+R(150,320);const r=Math.random();s.zo=r<.4?R(4,12):r<.75?R(-12,-4):R(-2,2)}
  const zt=Math.max(-36,Math.min(36,F.zl+s.zo+(s.zpush||0)*4));s.zpush=0;if(s.zset==null){s.z=zt;s.zset=1;s.pz=0}else{const spd=Math.hypot(s.sx,s.sy),zr=Math.min(.12,spd*.08)*(.4+.6*Math.min(1,eng)),dz=Math.max(-zr*dt,Math.min(zr*dt,zt-s.z));s.z+=dz;const pw=Math.atan2(dz/Math.max(dt,1e-6),Math.max(spd,.02));s.pz=(s.pz||0)+(pw-(s.pz||0))*Math.min(1,dt*.5)}
}
function nearestCar(c){let b=null,bd=1e9;for(const o of ships){if(!o.alive||!o.car||o.side!==c.side)continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d<bd){bd=d;b=o}}return b}
function foeCraft(c,maxd,bonusB,onlyF){let b=null,bs=1e9;for(const o of fly[1-c.side]){if(onlyF&&o.type!=='F')continue;const d=Math.hypot(o.x-c.x,o.y-c.y);if(d>maxd)continue;const sc=d-(o.type==='B'?bonusB:0)+15*o.att;if(sc<bs){bs=sc;b=o}}return b}
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
      let go=!!foe&&foe.d<LAUNCH;
      if(go&&fl.type==='F'){ // истребители ждут: вылет, если видны вражеские истребители/бомберы/ракеты/торпеды, либо флоты уже обмениваются огнём
        const R2=300*300,hx=fl.home.x,hy=fl.home.y,near=q=>(q.x-hx)*(q.x-hx)+(q.y-hy)*(q.y-hy)<R2;
        go=(fly&&fly[1-fl.side]||[]).some(near)||mis.some(q=>q.side!==fl.side&&near(q))||torps.some(q=>q.side!==fl.side&&near(q))||t-lastDmgT<25}
      if(go&&live.some(c=>c.ammo>0)){fl.mode='out';fl.t0=t;const h=fl.home;
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
  for(const fl of flights){const live=fl.cr.filter(c=>c.state==='fly'&&!c.ret);fl.leader=live[0]||null;live.forEach((c,i)=>c.slot=i)
    if(fl.type==='F'&&fl.leader){const L=fl.leader;
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
      c.tg=foeCraft(c,110,25);
      if(!c.tg){c.goal=foeCraft(c,1e9,200);if(!c.goal&&!c.fl.tsh)c.ret=true}
    }else c.tg=foeCraft(c,15,0,true);
  }
}
function shoot(c,e,p,dm){shots.push({x1:c.x,y1:c.y,x2:e.x,y2:e.y,rt:performance.now(),s:c.side,a:c,b:e});
  if(Math.random()<p){e.hp-=dm||1;fx.push({x:e.x,y:e.y,t0:t,d:3,r:0.5});if(e.hp<=0)killCraft(e)}}
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
    if(L===c||!L){let G=c.type==='F'?c.goal:c.sh,sf=.8;
      if(c.type==='F'&&fl.tsh){const sh=fl.tsh,ax=c.x-sh.x,ay=c.y-sh.y,ad=Math.hypot(ax,ay)||1;
        if(fl.ph==='in'){G=sh;sf=1.6}else{G={x:sh.x+ax/ad*130,y:sh.y+ay/ad*130};sf=Math.min(1.6,Math.hypot(G.x-c.x,G.y-c.y)*.05+.1)}}
      if(G){const bx=G.x-c.x,by=G.y-c.y,dist=Math.hypot(bx,by)||1e-6,off=c.fl.lane*Math.min(1,dist/(c.type==='F'?150:200)),dx=bx-by/dist*off,dy=by+bx/dist*off,dd=Math.hypot(dx,dy)||1e-6;vdx=dx/dd*P.vmax*sf;vdy=dy/dd*P.vmax*sf}}
    else{const sp=Math.hypot(L.vx,L.vy),ang=sp>0.05?Math.atan2(L.vy,L.vx):L.h,row=Math.ceil(c.slot/2),lat=(c.slot%2?1:-1)*row*1.5,back=row*1.5;
      const px=L.x+Math.cos(ang)*(-back)-Math.sin(ang)*lat,py=L.y+Math.sin(ang)*(-back)+Math.cos(ang)*lat;
      let ex=px-c.x,ey=py-c.y;const el=Math.hypot(ex,ey),cl=Math.min(el,1);if(el>1e-6){ex=ex/el*cl;ey=ey/el*cl}
      vdx=L.vx+ex*1.2;vdy=L.vy+ey*1.2}
    if(c.type==='B'&&c.tg&&c.tg.state==='fly'){const e=c.tg,dx=e.x-c.x,dy=e.y-c.y,dist=Math.hypot(dx,dy)||1e-6;fight=true;aim=Math.atan2(dy,dx);c.eng=t;lastEng=t;
      c.cd-=d;if(c.cd<=0&&dist<2.5){c.cd=0.6;shoot(c,e,0.03)}}
  }
  if(c.type==='F'&&!c.ret&&!c.tg&&c.fl.tsh&&c.fl.ph==='in'&&c.ammo>0&&t>(c.nf||0)){const sh=c.fl.tsh;
    if(Math.hypot(sh.x-c.x,sh.y-c.y)<sh.T.L*.8+1.2){const n=Math.min(c.ammo,6);c.ammo-=n;c.nf=t+40;
      for(let i=0;i<3;i++)shots.push({x1:c.x+R(-.5,.5),y1:c.y+R(-.5,.5),x2:sh.x,y2:sh.y,rt:performance.now(),s:c.side,a:c,b:sh});
      hitShip(sh,'fgt',sh.x-c.x,sh.y-c.y,sh.x,sh.y,.035*n);stat.strafe=(stat.strafe||0)+1;if(!c.fl.outAt)c.fl.outAt=t+1.5}}
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
  c.trT-=d;if(c.trT<=0){c.trT=0.5;c.tr.push(c.x,c.y);if(c.tr.length>30)c.tr.splice(0,2)}
}
// armor: a hit pierces one layer in the zone it comes from; with no layers left it destroys modules behind
function spawnFrags(x,y,z,n,sp,L,o){for(let i=0;i<n&&frags.length<900;i++){const a=Math.random()*6.283,v=sp*R(.2,1);frags.push({x,y,z,vx:(o?o.sx*.3:0)+Math.cos(a)*v,vy:(o?o.sy*.3:0)+Math.sin(a)*v,rot:Math.random()*6.283,vr:R(-3,3),sz:L*R(.05,.16),t0:t,d:R(8,22),side:o?o.side:0,ln:0,hot:0})}}
// куски брони/модулей отлетают от корабля и долго дрейфуют, медленно угасая (сторона и размер — по кораблю)
function spawnPlates(o,x,y,n,big){const L=o.T.L,out=Math.atan2(y-o.y,x-o.x);
  for(let i=0;i<n&&frags.length<900;i++){const a=out+R(-.9,.9),v=(.012+Math.hypot(o.sx,o.sy)*.25)*R(.25,1)*(big?1.4:1);
    frags.push({x,y,z:o.z,vx:o.sx*.85+Math.cos(a)*v,vy:o.sy*.85+Math.sin(a)*v,vz:R(-.012,.012)*(1+L),rot:Math.random()*6.283,vr:R(-2,2),rx:Math.random()*6,ry:Math.random()*6,vrx:R(-1.5,1.5),vry:R(-1.5,1.5),sz:L*R(.012,.03)*(big?2.2:1)+.003,t0:t,d:R(25,70),side:o.side,ln:0,hot:0,plate:1})}}
function addDecal(o,x,y,vx,vy,sz,k){ // след повреждения на корпусе в системе корабля (для 3D): позиция по длине, угол сечения (сторона к стрелку), размер
  const L=o.T.L,dx=x-o.x,dy=y-o.y,ch=Math.cos(o.hd),sh=Math.sin(o.hd),u=Math.max(-.5,Math.min(.5,(dx*ch+dy*sh)/L)),lat=-dx*sh+dy*ch;
  const ang=Math.atan2(R(-.7,.7),Math.sign(lat)||(Math.random()<.5?1:-1))-(o.roll||0);(o.vd||(o.vd=[])).push({u,ang,sz,k,t0:t,r:Math.random()});if(o.vd.length>160)o.vd.shift()}
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
    if(dead){fx.push({x:l.x,y:l.y,z:l.z,t0:t,d:3,r:1.1});spawnShards(l.x,l.y,l.z,4,5);Sfx.boom(4);stat.landLost=(stat.landLost||0)+1;lands.splice(i,1);continue}
    if(d<o.T.L*.5+.8){lands.splice(i,1);resolveBoard(l)}}
}
function kill(o){if(!o.alive)return;o.alive=false;if(o.crew>.04)launchPods(o,.5);fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:40,r:26});Sfx.boom(26);stat.lost[o.side]++;
  {const L=o.T.L;spawnFrags(o.x,o.y,o.z,6+Math.floor(L*6),1.2,L,o);
   let ammo=(o.pool&&(o.pool.torp||0)+(o.pool.ammo||0)/10)||0;for(const m of o.tur)if(m.k==='M'&&m.alive)ammo+=m.ammo||0;
   if(ammo>0)pyro.push({x:o.x,y:o.y,z:o.z,hd:o.hd,L,vx:o.sx*.3,vy:o.sy*.3,n:4+Math.min(14,Math.round(L*3+ammo/3)),next:t+.3,t0:t,side:o.side});
   if(Math.random()<Math.min(.3,.08+.05*L)){stat.reactor=(stat.reactor||0)+1;const R0=7+L*10;
     fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:9,r:R0,ring:1,big:1});fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:5,r:R0*.7});spawnShards(o.x,o.y,o.z,26,12);spawnFrags(o.x,o.y,o.z,10,5,L,o);Sfx.boom(40);
     for(const q of ships){if(q===o||!q.alive)continue;const d=Math.hypot(q.x-o.x,q.y-o.y);if(d<R0*1.2)hitShip(q,'mis',q.x-o.x,q.y-o.y,o.x,o.y,Math.max(1,L*5*(1-d/(R0*1.2))))}}}
  if(env.length<90)env.push({t:'debris',x:o.x,y:o.y,r:Math.max(.25,o.T.L*.3),vx:o.sx*.3,vy:o.sy*.3,ttl:t+240});
  for(const q of ships){if(!q.alive||Math.hypot(q.x-o.x,q.y-o.y)>45)continue;q.mor+=q.side===o.side?-(o.cls==='cv'?.14:.07):.03}
  say(o.side,'lost',o);say(1-o.side,'kill',o)}
function segHit(x1,y1,x2,y2,e,pad){const dx=x2-x1,dy=y2-y1,l2=dx*dx+dy*dy||1e-9;let u=((e.x-x1)*dx+(e.y-y1)*dy)/l2;u=u<0?0:u>1?1:u;return Math.hypot(x1+dx*u-e.x,y1+dy*u-e.y)<e.r+(pad||0)}
function los(x1,y1,x2,y2){for(const e of env)if(segHit(x1,y1,x2,y2,e))return e;return null}
function hitShip(o,kind,vx,vy,x,y,dmg,pw){lastDmgT=t;
  if(!o.alive)return;o.hitT=t;
  if(o.T.defl&&Math.random()<o.T.defl){fx.push({z:o.z,x,y,t0:t,d:3,r:0.8});return}
  const a=adiff(o.hd,Math.atan2(-vy,-vx))+R(-0.9,0.9),ab=Math.abs(a);
  const zi=ab<0.785?0:ab>2.356?2:(a>0?1:3);let z=o.zones[zi];
  // у корабля нет хп: слои брони по колонкам, потом модули. Попадание снимает слои в случайном месте (воронка шире от тяжёлого снаряда),
  // пробитая колонка пропускает остаток урона к ближайшим модулям; после гибели модуля урон идёт к соседнему
  let dm=kind==='torp'?1:dmg*(kind==='fgt'?1:kind==='laser'?.7:kind==='mis'?.5:.22);dm=Math.floor(dm)+(Math.random()<dm%1?1:0);
  if(dm<=0){fx.push({z:o.z,x,y,t0:t,d:2,r:0.5});return}
  const nc=z.nc,c=(Math.random()*nc)|0,w=Math.max(1,Math.round(dm*PW)),half=w>>1;let pass=dm,cut=0;
  if(kind==='mis'){ // ракета: сегмент PW колонок; в центре dm слоёв, к краям спад до 1; число сегментов растёт с мощностью (3→3, 9→5, 25→7, 30→9)
    const P0=pw||dmg,hs=Math.round(Math.sqrt(Math.max(1,P0))/1.5),W=hs*2+1,cen=Math.max(dmg*.5,.5);pass=0;
    for(let sg=-hs;sg<=hs;sg++){let dv=Math.max(sg===0?cen:1,cen*(1-Math.abs(sg)/(hs+1)));if(sg!==0&&dmg<P0*.5)dv*=dmg/P0*2;dv=Math.floor(dv)+(Math.random()<dv%1?1:0);if(dv<=0)continue;
      for(let q=0;q<PW;q++){const cc=c+sg*PW+q-(PW>>1);if(cc<0||cc>=nc)continue;const d=z.cols[cc],tk=Math.min(d,dv);if(tk){z.cols[cc]=d-tk;z.armN-=tk;cut+=tk}if(sg===0&&q===(PW>>1))pass=dv-tk}}
    dm=Math.max(dm,1)
  }else
  for(let j=-half;j<w-half;j++){const cc=c+j;if(cc<0||cc>=nc)continue;const d=z.cols[cc],tk=Math.min(d,dm);if(tk){z.cols[cc]=d-tk;z.armN-=tk;cut+=tk}if(j===0)pass=dm-tk}
  if(cut){fx.push({z:o.z,x,y,t0:t,d:4,r:1});if(frags.length<300&&Math.random()<.5)spawnShards(x,y,o.z,2,3);o.mor-=.002;
    if(cut>=3&&Math.random()<Math.min(.9,.15+cut*.04))spawnPlates(o,x,y,1+(cut>14?1:0)+(cut>40?1:0),false);addDecal(o,x,y,vx,vy,cut>20?.8:.5,0)}
  if(pass<=0)return;
  const k=kind==='torp'?TORP.mod:pass,f=(c+.5)/nc,pu=zi===0?.33:zi===2?-.4:(f-.5)*.52,pv=zi===1?.2:zi===3?-.2:(f-.5)*.5;
  for(let i=0;i<k;i++){let m=null,bd=1e9;for(const zz of o.zones)for(const q of zz.mods)if(q.alive){const du=(q.u||0)-pu,dv=(q.v||0)-pv,d=du*du+dv*dv;if(d<bd){bd=d;m=q}}
    if(!m)break;m.alive=false;o.aliveN--;if(m.k==='E'){o.engN--;say(o.side,'eng',o)}else if(m.k!=='C')say(o.side,'mod',o)}
  fx.push({z:o.z,x,y,t0:t,d:10,r:3});Sfx.boom(3);spawnPlates(o,x,y,2+Math.min(3,k),true);addDecal(o,x,y,vx,vy,1.2,1);
  o.crew=Math.max(0,o.crew-.012*k-.004);o.mor-=.012+.01*k;
  if(Math.random()<.07+.04*k){const zi2=o.zones.indexOf(z);if(zi2>=0){o.fire[zi2]=Math.min(3,o.fire[zi2]+1);stat.fires++;say(o.side,'fire_',o)}}
  say(o.side,'hit',o);
  if(!o.core.alive){if(!o.ecore){o.ecore=1;o.core.alive=true;o.aliveN++;o.blk=t+R(40,70);o.heat=0;stat.blk++;say(o.side,'power',o);fx.push({z:o.z,x:o.x,y:o.y,t0:t,d:12,r:6})}else kill(o)}
  if(o.alive&&o.aliveN<o.total*0.22)kill(o);
}
function flakBurst(s,m){
  if(!s.fine){m.cd=3;return false}
  const F=m.cfg,cand=[];for(const c of fly[1-s.side])if(Math.hypot(c.x-s.x,c.y-s.y)<F.rng)cand.push(c);
  const tp=torps.concat(mis).filter(p=>p.side!==s.side&&Math.hypot(p.x-s.x,p.y-s.y)<F.rng);
  if(!cand.length&&!tp.length){m.cd=2;return false}
  const e=tp.length&&Math.random()<0.5?tp[(Math.random()*tp.length)|0]:(cand.length?cand[(Math.random()*cand.length)|0]:tp[0]);
  const d=Math.hypot(e.x-s.x,e.y-s.y),err=(0.25+0.012*d)*(1.4-0.08*m.sk);
  const bx=e.x+(e.vx||0)*1.5+gauss()*err,by=e.y+(e.vy||0)*1.5+gauss()*err;
  m.fa=Math.atan2(by-s.y,bx-s.x);m.rt=performance.now();Sfx.shot('flak');stat.flak[s.side]++;shots.push({x1:s.x,y1:s.y,x2:bx,y2:by,rt:performance.now(),s:s.side});fx.push({x:bx,y:by,t0:t,d:3,r:F.blast});
  for(const c of fly[1-s.side])if(c.state==='fly'&&Math.hypot(c.x-bx,c.y-by)<F.blast){c.hp--;if(c.hp<=0){killCraft(c);stat.flakKill[s.side]++}}
  for(let i=torps.length-1;i>=0;i--){const p=torps[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast*1.5&&Math.random()<0.7){torps.splice(i,1);stat.torpPd[p.side]++;stat.flakKill[s.side]++}}
  for(let i=mis.length-1;i>=0;i--){const p=mis[i];if(p.side!==s.side&&Math.hypot(p.x-bx,p.y-by)<F.blast*1.5+1&&Math.random()<0.15){p.hp--;if(p.hp<=0){mis.splice(i,1);stat.misShot[p.side]++;stat.flakKill[s.side]++;boom(p,null)}}}
  return true;
}
// осечка: орудие клинит на 4 минуты, иногда взрывается
function jamChk(s,m,C){if(!C.fail||Math.random()>=C.fail)return;stat.jams=(stat.jams||0)+1;m.cd=240;fx.push({x:s.x,y:s.y,t0:t,d:6,r:1.5});if(Math.random()<0.15){m.alive=false;s.aliveN--;stat.boom=(stat.boom||0)+1;if(!s.core.alive||s.aliveN<s.total*0.3)kill(s)}}
function fireShell(s,m,o0,C,lag){
  let o=o0&&o0.alive?o0:(s.tg&&s.tg.alive?s.tg:null);if(!o)return;
  const VPc=C.vp;let T=Math.hypot(o.x-s.x,o.y-s.y)/VPc;
  for(let i=0;i<3;i++){const px=o.x+o.sx*T,py=o.y+o.sy*T;T=Math.hypot(px-s.x,py-s.y)/VPc}
  const px=o.x+o.sx*T,py=o.y+o.sy*T,d=Math.hypot(px-s.x,py-s.y),e=(SIGMA*d+JINK*T*T)*(1.4-0.08*m.sk)*C.sig;
  const ax=px+gauss()*e-s.x,ay=py+gauss()*e-s.y,l=Math.hypot(ax,ay)||1e-6;
  m.fa=Math.atan2(ay,ax);m.rt=performance.now();
  proj.push({x:s.x+ax/l*(VPc*lag+s.T.L*.4),y:s.y+ay/l*(VPc*lag+s.T.L*.4),z:s.z,vz:(o.z-s.z)/Math.max(.5,T),vx:ax/l*VPc,vy:ay/l*VPc,side:s.side,dist:VPc*lag,dmg:C.dmg,max:C.rng,src:s,ev:Math.random()});
  stat.shots[s.side]++;s.flash=t;Sfx.shot('rail');
  if(fx.length<300)fx.push({x:s.x+ax/l*s.T.L*.45,y:s.y+ay/l*s.T.L*.45,z:s.z,t0:t,d:.3,r:.5,muz:1,side:s.side});
}
// взрыв ракеты: бьёт всех рядом, в том числе своих
function boom(p,direct){
  fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:6,r:p.blast*1.3});Sfx.boom(p.blast);
  if(direct)stat.misHit[p.side]++;
  for(const side of [0,1]){for(const o of around(side,p.x,p.y,p.blast+2)){
    if(!o.alive||Math.abs(o.z-p.z)>p.blast*1.5+10)continue;
    const d=Math.hypot(o.x-p.x,o.y-p.y),f=o===direct?1:Math.max(0,1-d/(p.blast+2)*.75);
    if(f>0)hitShip(o,'mis',o.x-p.x,o.y-p.y,p.x,p.y,p.dmg*f*(o===direct?1.3:1),p.dmg)}}
  for(const c of fly[0].concat(fly[1]))if(c.state==='fly'&&Math.hypot(c.x-p.x,c.y-p.y)<p.blast){c.hp-=2;if(c.hp<=0)killCraft(c)}
}
function nearMis(s,rg){let b=null,bd=rg*rg;for(const q of mis){if(q.side===s.side)continue;const d=(q.x-s.x)*(q.x-s.x)+(q.y-s.y)*(q.y-s.y);if(d<bd){bd=d;b=q}}return b}
function hurtMis(q,n){q.hp-=n;if(q.hp<=0){const i=mis.indexOf(q);if(i>=0){mis.splice(i,1);stat.misShot[q.side]++;boom(q,null)}}}
function step(dt){
  t+=dt;

  buildGrids();fleetsUpdate();
  if(t>=nextVis){nextVis=t+Math.max(1,ships.length/160);updVis()} // на больших флотах разведка реже
  if(t>=nextCrew){const dc=Math.max(.5,t-lastCrewT);lastCrewT=t;nextCrew=t+1;crewStep(dc)}
  for(const s of ships){if(!s.alive)continue;steer(s,dt);}
  for(const s of ships){if(!s.alive)continue;
    s.maxR=s.maxR||Math.max(60,...s.tur.filter(m=>m.cfg&&m.cfg.rng&&m.k!=='L'&&m.k!=='M').map(m=>m.cfg.rng));
    let foes=null;const muted=s.st==='surr'||t<s.blk,slow=s.st==='panic'?.5:1;
    for(const m of s.tur){
      if(!m.alive||muted)continue;
      if(mis.length&&s.fine&&(m.k==='T'||m.k==='A')&&t>(m.pd||0)){const q=nearMis(s,m.k==='A'?m.cfg.rng:22);
        if(q){m.pd=t+(m.k==='A'?6:12)*R(.8,1.3);m.fa=Math.atan2(q.y-s.y,q.x-s.x);m.rt=performance.now();shots.push({x1:s.x,y1:s.y,x2:q.x,y2:q.y,rt:performance.now(),s:s.side,a:s,b:q});
          if(Math.random()<(m.k==='A'?.25:.08))hurtMis(q,1)}}
      m.cd-=dt*slow;if(m.cd>0)continue;
      const C=m.cfg;
      // рельсы отбиваются от истребителей и бомбардировщиков рядом (нужен мелкий радар в сети)
      if((m.k==='T'||m.k==='L')&&fly[1-s.side].length){let e=null,bd=Math.min(C.rng,m.k==='L'?150:110)**2;for(const c of fly[1-s.side]){if(c.state!=='fly')continue;const d=(c.x-s.x)**2+(c.y-s.y)**2;if(d<bd){bd=d;e=c}}
        if(e&&(!s.tg||Math.hypot(s.tg.x-s.x,s.tg.y-s.y)>C.rng*.8||Math.random()<.4)){m.fa=Math.atan2(e.y-s.y,e.x-s.x);m.rt=performance.now();Sfx.shot('rail');s.flash=t;s.heat+=.002;
          shots.push({x1:s.x,y1:s.y,x2:e.x,y2:e.y,rt:performance.now(),s:s.side,a:s,b:e});stat.pdRail=(stat.pdRail||0)+1;
          const dd=Math.sqrt(bd),pk=(.02+.0015*(m.sk||5))*(1-Math.min(.6,dd/110*.6));if(m.k==='L'){beams.push({a:s,b:e,tx:e.x,ty:e.y,tz:0,rt:performance.now()+600,c0:performance.now(),side:s.side,w:C.dmg});Sfx.shot('laser')}if(Math.random()<pk*(m.k==='L'?1.5:1)){e.hp-=m.k==='L'?4:3;if(e.hp<=0){killCraft(e,m.k==='L'?'laser':'rail');stat.flakKill[s.side]++}}m.cd=(m.k==='L'?2.5:R(2,4))*(1.3-.06*m.sk);continue}}
      if(m.k==='A'){if(flakBurst(s,m)){m.cd=2*REL*C.rel*(1.3-0.06*m.sk)*R(.75,1.25);jamChk(s,m,C)}continue}
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
          const cost=C.dmg*(.4+(Math.min(d,300)/120)**2);
          {const lx=o.x-s.x,ly=o.y-s.y,ll=lx*lx+ly*ly||1;let bk=null,bu=2;for(const f of around(s.side,s.x+lx/2,s.y+ly/2,Math.sqrt(ll)/2+3)){if(f===s||!f.alive)continue;const u=((f.x-s.x)*lx+(f.y-s.y)*ly)/ll;if(u<=.02||u>=1)continue;if(Math.hypot(s.x+lx*u-f.x,s.y+ly*u-f.y)<f.T.L*.38&&u<bu){bu=u;bk=f}}
            if(bk){beams.push({a:s,b:bk,tx:bk.x,ty:bk.y,tz:bk.z,rt:m.rt+600,c0:m.rt,side:s.side,w:C.dmg});stat.ff=(stat.ff||0)+1;hitShip(bk,'laser',lx,ly,bk.x,bk.y,C.dmg*1.7);m.cd=cost/C.chg*(1.3-.06*m.sk)*R(.9,1.1)*2.6;continue}}
          const be=env.length?los(s.x,s.y,o.x,o.y):null;s.flash=t;s.heat+=C.dmg*.12;Sfx.shot('laser');say(s.side,'laser',s);
          if(be){const dd=Math.hypot(be.x-s.x,be.y-s.y)||1;beams.push({a:s,b:{alive:false},tx:be.x-(be.x-s.x)/dd*be.r,ty:be.y-(be.y-s.y)/dd*be.r,tz:0,rt:m.rt+600,c0:m.rt,side:s.side,w:C.dmg});stat.las[s.side]++;fx.push({x:be.x,y:be.y,t0:t,d:4,r:.8})}
          else{beams.push({a:s,b:o,tx:o.x,ty:o.y,tz:o.z,rt:m.rt+600,c0:m.rt,side:s.side,w:C.dmg});
          stat.las[s.side]++;stat.lasHit[s.side]++;hitShip(o,'laser',o.x-s.x,o.y-s.y,o.x,o.y,C.dmg*1.7)}
          m.cd=cost/C.chg*(1.3-.06*m.sk)*R(.9,1.1)*2.6;
        }else{
          if(d<18){m.cd=4;continue}
          const hd=Math.atan2(o.y-s.y,o.x-s.x);
          mis.push({x:s.x,y:s.y,z:s.z,h:s.hd,side:s.side,tgt:o,hp:C.hp,spd:C.spd,dmg:C.dmg,blast:C.blast,life:C.rng/C.spd*2.2,tr:[],trT:0,vx:0,vy:0,src:s});
          s.flash=t;Sfx.shot('missile');say(s.side,'missile',s);say(1-s.side,'inmis',o);m.ammo--;stat.mis[s.side]++;m.cd=Math.min(2400,43*Math.pow(C.dmg,1.15))*R(.8,1.25)*(1.3-.06*m.sk);
        }
        continue}
      foes=s.trk||[];
      const fl=(s.tg&&s.tg.alive&&s.tg.st!=='surr'&&Math.hypot(s.tg.x-s.x,s.tg.y-s.y)<C.rng&&Math.random()<.7)?[s.tg]:foes.filter(o=>o.alive&&Math.hypot(o.x-s.x,o.y-s.y)<C.rng);
      if(!fl.length){m.cd=5;continue}
      if(!bears(s,m,fl[0])){m.cd=.7+Math.random();continue} // цель вне полусферы обстрела этой башни
      // не стрелять через своих: если на линии огня союзник — чаще воздерживаемся
      {const o0=fl[0],ux=o0.x-s.x,uy=o0.y-s.y,ul=Math.hypot(ux,uy)||1;let bl=false;
        for(const q of around(s.side,s.x,s.y,14)){if(q===s)continue;const al=((q.x-s.x)*ux+(q.y-s.y)*uy)/ul,pp=Math.abs(((q.x-s.x)*uy-(q.y-s.y)*ux)/ul);if(al>0&&al<ul&&pp<q.T.L*.4+1.5){bl=true;break}}
        if(bl&&Math.random()<.4){m.cd=2+Math.random()*3;continue}}
      s.heat+=.004;say(s.side,'fire',s);
      const B=BURST[C.cal]||8;
      for(let b=0;b<C.shells;b++)bursts.push({s,m,o:fl[(Math.random()*fl.length)|0],C,n:B,i:0,t0:t+b*.03});
      {const ldf=C.rel/(1+.2*(C.shells-1));m.cd=(RCT[C.cal]||130)*ldf*(1+.25*(C.shells-1))*(1.3-.06*m.sk)*R(.8,1.25)}jamChk(s,m,C);
    }
  }
  // очереди рельсотронов: выстрелы с задержкой 0,1 с
  for(let i=bursts.length-1;i>=0;i--){const q=bursts[i];
    if(!q.s.alive||!q.m.alive){bursts[i]=bursts[bursts.length-1];bursts.pop();continue}
    while(q.i<q.n&&t>=q.t0+.3*q.i){fireShell(q.s,q.m,q.o,q.C,t-(q.t0+.3*q.i));q.i++}
    if(q.i>=q.n){bursts[i]=bursts[bursts.length-1];bursts.pop()}}
  for(let i=proj.length-1;i>=0;i--){
    const p=proj[i],nx=p.x+p.vx*dt,ny=p.y+p.vy*dt;let hit=null,fr=false;
    const dx=nx-p.x,dy=ny-p.y,l2=dx*dx+dy*dy||1,x0=Math.floor(Math.min(p.x,nx)/CS)-1,x1=Math.floor(Math.max(p.x,nx)/CS)+1,y0=Math.floor(Math.min(p.y,ny)/CS)-1,y1=Math.floor(Math.max(p.y,ny)/CS)+1;
    const scan=(g,self)=>{for(let gx=x0;gx<=x1;gx++)for(let gy=y0;gy<=y1;gy++){const a=g.get(ckey(gx,gy));if(!a)continue;
      for(const o of a){if(!o.alive||o===self||Math.abs(p.z-o.z)>o.T.L*.25+22)continue;if(o.T.tons<15000&&p.dmg>=1.5&&p.ev>.55)continue; // малые корабли уворачиваются от тяжёлых снарядов
        let u=((o.x-p.x)*dx+(o.y-p.y)*dy)/l2;u=Math.max(0,Math.min(1,u));
        if(Math.hypot(p.x+dx*u-o.x,p.y+dy*u-o.y)<o.T.L*0.38)return o}}return null};
    if(env.length){let ee=null;for(const e of env)if(Math.abs(e.x-p.x)<e.r+14&&Math.abs(e.y-p.y)<e.r+14&&segHit(p.x,p.y,nx,ny,e)){ee=e;break}
      if(ee){fx.push({x:nx,y:ny,z:p.z,t0:t,d:3,r:.6});if(ee.t==='debris')ee.ttl-=4;if(Math.random()<.02)say(p.side,'rock',p.src);proj[i]=proj[proj.length-1];proj.pop();continue}}
    hit=scan(GR[1-p.side],null);if(!hit&&p.dist>(p.src&&p.src.T?p.src.T.L*.6:1)){hit=scan(GR[p.side],p.src);fr=!!hit}
    if(hit){if(fr)stat.ff=(stat.ff||0)+1;else stat.hits[p.side]++;{const iu=Math.max(0,Math.min(1,((hit.x-p.x)*dx+(hit.y-p.y)*dy)/l2)),ix=p.x+dx*iu,iy=p.y+dy*iu;hitShip(hit,'rail',p.vx,p.vy,ix,iy,p.dmg)}proj[i]=proj[proj.length-1];proj.pop();continue}
    p.x=nx;p.y=ny;p.z+=p.vz*dt;p.dist+=Math.hypot(p.vx,p.vy)*dt;
    if(p.dist>=p.max){proj[i]=proj[proj.length-1];proj.pop()}
  }
  // ракеты
  for(let i=mis.length-1;i>=0;i--){
    const p=mis[i];let tg=p.tgt;
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
    if(d<45&&tg.jam>0&&t>=(p.blind||0)&&Math.random()<tg.jam*dt*.3){p.blind=t+4;stat.decoy++;fx.push({x:p.x,y:p.y,z:p.z,t0:t,d:3,r:1});say(tg.side,'jam',tg)}
    const TR=Math.min(1.2,3.2/p.spd);if(t>=(p.blind||0))p.h+=Math.max(-TR*dt,Math.min(TR*dt,adiff(p.h,Math.atan2(ay,ax))));
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
    fx.push({x:px,y:py,z:q.z,t0:t,d:4,r:q.L*R(1.4,3)});spawnShards(px,py,q.z,6,R(5,10));if(Math.random()<.5)spawnFrags(px,py,q.z,2,3,q.L,null);Sfx.boom(8);
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
function scAlive(s){const hp=hpf(s);if(hp<.3)return[];const n=Math.ceil(s.sc.length*Math.min(1,hp/.7));return s.sc.slice(0,n)}
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
      const sg=o._sg,small=o.T.tons<15000;let det=false,lk=false;
      for(const q of s.scl){
        if(q.k==='rad'){if(!s.rdOn)continue;const er=q.rng*(s.side===0?rr:1)*Math.sqrt(1+o.T.L)*(1-o.jam);if(d<er){det=true;if(q.fine||!small)lk=true}}
        else{const er=q.rng*(s.side===0?rr:1)*Math.sqrt(q.k==='ir'?sg[0]:sg[1])*(small&&q.res<.66?.25:1);if(d<er)det=true}}
      if(det){if(o.seen[s.side]<0)say(s.side,'contact',s);o.seen[s.side]=t}
      if(lk)o.lock[s.side]=t}}
  for(const c of air){if(c.state!=='fly')continue;for(const o of around(1-c.side,c.x,c.y,70)){o.seen[c.side]=t;o.lock[c.side]=t}}
}
function crewStep(dc){
  env=env.filter(e=>e.ttl>t);for(const e of env)if(e.vx||e.vy){e.x+=e.vx*dc;e.y+=e.vy*dc}
  for(const s of ships){if(!s.alive)continue;const sk=s.spec.sk||5.5,hp=hpf(s);
    // тепло
    s.heat=Math.max(0,s.heat-.004*dc*(.5+.5*hp)*(t<s.blk?2:1)*(s.spec.sink!=null?.6+.5*Math.min(5,s.spec.sink):1)*(s.side===0?1+ta('dcx'):1));
    if(s.heat>1&&!s.ovh){s.ovh=1;stat.ovh++;say(s.side,'heat',s)}else if(s.ovh&&s.heat<.55)s.ovh=0;
    if(s.heat>1.4&&Math.random()<.03*dc){const al=s.tur.filter(m=>m.alive);if(al.length){const m=al[(Math.random()*al.length)|0];m.alive=false;s.aliveN--;fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:6,r:1.5});s.heat=1}}
    // пожары и аварийная команда
    const dcp=.05*(.4+.6*s.crew)*sk/6*(s.spec.dcon!=null?.4+.9*Math.min(4,s.spec.dcon):1)*(s.side===0?1+ta('dcx'):1);
    for(let zi=0;zi<4;zi++){const f=s.fire[zi];if(!f)continue;
      if(Math.random()<.5*f*dc/12){const al=s.zones[zi].mods.filter(m=>m.alive&&m.k!=='C');if(al.length){const m=al[(Math.random()*al.length)|0];m.alive=false;s.aliveN--;if(m.k==='E')s.engN--;fx.push({x:s.x,y:s.y,z:s.z,t0:t,d:5,r:1.6});if(s.aliveN<s.total*.22)kill(s)}}
      if(s.alive&&Math.random()<dcp*dc)s.fire[zi]--}
    if(!s.alive)continue;
    // ремонт модулей, когда не под огнём
    if(t-s.hitT>10&&s.crew>.15&&s.st!=='surr'&&t>=s.blk&&s.reps<s.total*.6&&Math.random()<.03*dc*(.5+sk/10)*s.crew){
      let pick=null;for(const k of ['E','T','A','L','M'])for(const z of s.zones)for(const m of z.mods)if(!pick&&!m.alive&&m.k===k)pick=m;
      if(pick){pick.alive=true;s.aliveN++;if(pick.k==='E')s.engN++;s.reps++;stat.rep++;say(s.side,'dmg',s)}}
    // мораль
    let dm=.004*(.5+sk/10)*dc*(t-s.hitT>6?1:.3);
    if(s.F&&s.F.ratio!=null&&s.F.ratio<.7)dm-=.007*(.7-s.F.ratio)*dc;
    if(s.crew<.25)dm-=.003*dc;
    s.mor=Math.max(0,Math.min(1,s.mor+dm));
    if(s.st==='ok'&&s.mor<.3&&!s.T.role){s.st='panic';say(s.side,'flee',s)}
    else if(s.st==='panic'&&s.mor>.5)s.st='ok';
    if((s.st==='panic'||s.st==='ok')&&s.mor<.12&&hp<.6&&!s.T.role&&Math.random()<.2*dc){s.st='surr';stat.surr[s.side]++;say(s.side,'surr',s)}
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
      else if(m.k==='L'){
        const aim=turAim(m,s,now),bl=mr*3.2,hot=m.rt&&now-m.rt<380;
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
    for(const p of proj){if(p.side!==side||p.dist>p.max*.8)continue;const x=X(p.x),y=Y(p.y)+Z(p.z);
      if(projMode){g.moveTo(x,y);g.lineTo(x-p.vx/VP*9*dp,y-p.vy/VP*9*dp)}else{g.moveTo(x+1.6*dp,y);g.arc(x,y,1.6*dp,0,6.283)}}
    if(projMode)g.stroke();else g.fill();
    // у конца дальности снаряды гаснут
    g.beginPath();g.globalAlpha=projMode?.18:.25;for(const p of proj){if(p.side!==side||p.dist<=p.max*.8)continue;const x=X(p.x),y=Y(p.y)+Z(p.z);
      if(projMode){g.moveTo(x,y);g.lineTo(x-p.vx/VP*9*dp,y-p.vy/VP*9*dp)}else{g.moveTo(x+1.6*dp,y);g.arc(x,y,1.6*dp,0,6.283)}}
    if(projMode)g.stroke();else g.fill();
  }
  g.globalAlpha=1;
  for(const side of [0,1]){g.strokeStyle=CL[side];g.lineWidth=2*dp;g.beginPath();
    for(const p of torps){if(p.side!==side||!p.tgt)continue;const x=X(p.x),y=Y(p.y),dx=p.tgt.x-p.x,dy=p.tgt.y-p.y,l=Math.hypot(dx,dy)||1,tl2=Math.max(10*dp,40*k);g.moveTo(x,y);g.lineTo(x-dx/l*tl2,y-dy/l*tl2)}
    g.stroke()}
  const ord=d3?ships.slice().sort((a,b)=>a.z-b.z):ships;
  // препятствия: астероиды, обломки, планеты (за ними можно спрятаться, лазеры и снаряды в них упираются)
  for(const e of env){const x=X(e.x),y=Y(e.y),rr=Math.max(2*dp,e.r*k);
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
  if((!aliveBy(1)&&!pend.length)||(!aliveBy(0)&&t-lastFriend>1800)||t>((cfgNow&&cfgNow.maxT)||14400))done=true;
}
function result(){
  const mine=ships.filter(s=>s.side===0).map(s=>({ref:s.spec.ref,alive:s.alive,lost:1-s.aliveN/s.total,
    F:air.filter(c=>c.own===s&&c.type==='F'&&c.state!=='dead').length,B:air.filter(c=>c.own===s&&c.type==='B'&&c.state!=='dead').length}));
  const en=ships.filter(s=>s.side===1);
  return {t,mine,enemyKilled:en.filter(s=>!s.alive).map(s=>s.cls),prizes:ships.filter(s=>s.prize&&s.side===0&&s.alive).map(s=>s.cls),surrendered:stat.surr?stat.surr[1]:0,wrecks:ships.filter(s=>!s.alive).length,enemyAlive:en.filter(s=>s.alive).length,mineAlive:aliveBy(0),stat};
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
    inf.innerHTML=`<b class="c${'ab'[s.side]}">${s.T.n}</b>${s.alive?'':' <span class="muted">(уничтожен)</span>'}<br>Водоизмещение ${fmtN(s.T.tons)} т · длина ${Math.round(s.T.L*1000)} м · модули: ${s.aliveN}/${s.total} · ядро ${s.core.alive?'цело':'уничтожено'}<br>Турели: ${tur}/${s.tur.length} · ср. навык ${sk}<br>Двигатели: ${s.engN}/${s.T.eng}${s.bst>1.1?' · форсаж '+Math.round(s.bst*100)+'%':''}${s.lrp?' · дальний бой '+s.lrp.toFixed(0):''}<br>Высота: ${s.z.toFixed(0)}<br>Броня по секторам: ${s.zones.map((z,i)=>ZN[i]+' '+(s.T.arm?Math.round(100*z.armN/(z.nc*s.T.arm)):0)+'%').join(' · ')}`}
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
  fitSpec(spec);spec.cls=classify(spec);spec.dopt=spec.dopt0||DOPT[spec.cls];
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
  $b('bord').onclick=e=>{const o=e.target.dataset&&e.target.dataset.o;if(o===undefined)return;
    if(o==='focus'){ORD.focus=sel&&sel.alive&&sel.side===1?sel:null;e.target.classList.toggle('on',!!ORD.focus);return}
    ORD.st=o||null;for(const b of $b('bord').querySelectorAll('[data-o]'))if(b.dataset.o!=='focus')b.classList.toggle('on',b.dataset.o===o)};
  $b('bsens').onclick=e=>{const o=e.target.dataset&&e.target.dataset.s;if(o===undefined)return;ORD.sens=o||null;for(const b of $b('bsens').querySelectorAll('[data-s]'))b.classList.toggle('on',b.dataset.s===o)};
  $b('bmove').onclick=e=>{if(!sel||sel.side!==0){e.target.textContent='Сначала выберите свой корабль';return}moveMode=!moveMode;e.target.classList.toggle('on',moveMode);e.target.textContent=moveMode?'Кликните точку на карте':'Флот: идти в точку'};
  $b('bhold').onclick=()=>{if(sel&&sel.side===0)sel.F.mv=null};
  $b('bsnd').onclick=e=>{const v=e.target.textContent.includes('вкл');Sfx.setOn(!v);e.target.textContent='Звук: '+(v?'выкл':'вкл')};
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
return {frags:()=>frags,turAim,shots:()=>shots,fx:()=>fx,proj:()=>proj,mis:()=>mis,air:()=>air,beams:()=>beams,select:q=>{sel=q},moveFleet:(q,x,y)=>{if(q&&q.F)q.F.mv={x,y}},stat:()=>stat,frame,setSpeed:v=>{bspeed=v},getSpeed:()=>bspeed,anchorSel:()=>sel,abort,ships:()=>ships,begin,tick,draw,hud,pick,join,finish,isDone:()=>done,active:()=>active,hot:()=>autoSlow&&t-lastEng<3,later:(tt,spec)=>pend.push({t:t+tt,spec}),time:()=>t,clear:()=>{sel=null}};
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
  if (k >= 2) out.push(sp('Налётчик-авианосец', {fq: randCraft('F'), bq: randCraft('B'), late: true, rails: 4, arm, eng: 4, L: 2.2, F: 10 * (1 + Math.floor(k / 2)), B: 5 * Math.floor(k / 2)}));
  return out;
}
export function specFromShip(s) {
  const st = s.st, cmd = effSkill(s, 'cmd');
  return {name: s.name, ref: s.id, arm: st.armor, rails: st.rail, flak: st.flak, eng: Math.max(1, Math.min(6, st.engines)), L: st.L, tons: st.tons,
    F: s.air.F, B: s.air.B, sk: Math.max(3, Math.min(9, cmd || 4)), dmg: s.hullDmg || 0, spd: st.bspd || (st.L < 1 ? 1.25 : 1),
    lasers: st.lgun, laserCfg: st.lasList, miss: st.msl, missCfg: st.misList, railCfg: st.railList, flakCfg: st.flakList, defl: st.defl, fq: st.fq, bq: st.bq, scList: st.scList||[], fcsN: st.fcsN||0, ew: st.ew||0, mar: st.mar||0, dcon: st.dcon||0, sink: st.sink||0};
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
