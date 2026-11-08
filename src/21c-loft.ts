// @ts-nocheck
// Корпус корабля «по грузу»: единая шестигранная оболочка с профилем по отсекам, детали врастают в неё, краска/окна/AO запечены в цвета вершин.
// Построено из прототипа proto/ship10.html: форма следует функции (баки → гондолы, ангар → короб, пушки → палубы), а не классу.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
let seed=7; let UU=1; const R=()=>{seed=(seed*16807)%2147483647;return seed/2147483647};
const C={main:0x6e7a93,plate:0x8f9bb3,dark:0x2b3243,eng:0x3b4358,deep:0x181c27,or:0xff9a2e,glow:0x57d4ff,bridge:0x7c8aa6};
const mats=new Map(); const M=(c,e=0)=>{const k=c+'_'+e; if(!mats.has(k))mats.set(k,new THREE.MeshStandardMaterial({color:c,roughness:.62,metalness:.25,flatShading:true,emissive:e?c:0,emissiveIntensity:e?.55:0}));return mats.get(k)};
const edgeMat=new THREE.LineBasicMaterial({color:0x0a0d14,transparent:true,opacity:.35});
function add(g,geo,col,x,y,z,e=0,edges=true){const m=new THREE.Mesh(geo,M(col,e));m.position.set(x,y,z);g.add(m);if(edges){const l=new THREE.LineSegments(new THREE.EdgesGeometry(geo,20),edgeMat);l.position.copy(m.position);l.rotation.copy(m.rotation);g.add(l)}return m}
// бокс len(x) h(y) w(z)
const box=(g,len,h,w,x,y,z,col,e=0)=>add(g,new THREE.BoxGeometry(len,h,w),col,x,y,z,e);
// шестигранная призма вдоль x: верх узкий, бока широкие
function hex(g,len,h,w,x,y,z,col,k=.55){const s=new THREE.Shape();const hw=w/2,hh=h/2;s.moveTo(-hw*k,hh);s.lineTo(hw*k,hh);s.lineTo(hw,0);s.lineTo(hw*k,-hh);s.lineTo(-hw*k,-hh);s.lineTo(-hw,0);s.closePath();
 const geo=new THREE.ExtrudeGeometry(s,{depth:len,bevelEnabled:false});geo.rotateY(Math.PI/2);geo.translate(-len/2,0,0);return add(g,geo,col,x,y,z)}
// клин (сужающийся к носу): усечённая пирамида вдоль x
function wedge(g,len,h,w,x,y,z,col,tip=.2,tipH=.5,rotY=0){const geo=new THREE.CylinderGeometry(.5,.5,len,4,1);geo.rotateZ(-Math.PI/2);geo.rotateX(Math.PI/4);const p=geo.attributes.position;for(let i=0;i<p.count;i++){const t=(p.getX(i)/len)+.5;const k=1-(1-tip)*t;const kh=1-(1-tipH)*t;p.setY(i,p.getY(i)*Math.SQRT2*h*kh);p.setZ(i,p.getZ(i)*Math.SQRT2*w*k)}geo.computeVertexNormals();if(rotY)geo.rotateY(rotY);return add(g,geo,col,x,y,z)}
// дельта-плита (план: корень вдоль x, кончик смещён)
function plate(g,len,span,th,tipX,x,y,z,col,sd){const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(len,0);s.lineTo(tipX,-sd*span);s.closePath();let geo=new THREE.ExtrudeGeometry(s,{depth:th,bevelEnabled:false});geo.rotateX(-Math.PI/2);geo.translate(-len*.5,-th,0);return add(g,geo,col,x,y+th,z)}
function plate4(g,len,span,th,sweep,x,y,z,col,sd){const s=new THREE.Shape();s.moveTo(0,0);s.lineTo(len,0);s.lineTo(len*.55-sweep,-sd*span);s.lineTo(len*.15-sweep,-sd*span*.92);s.closePath();let geo=new THREE.ExtrudeGeometry(s,{depth:th,bevelEnabled:false});geo.rotateX(-Math.PI/2);geo.translate(-len*.5,-th,0);return add(g,geo,col,x,y+th,z)}
const capsule=(g,len,r,x,y,z,col)=>{cyl(g,len,r,x,y,z,col);for(const d of[-1,1])add(g,new THREE.CylinderGeometry(r*.45,r,r*.8,6).rotateZ(-d*Math.PI/2),col,x+d*(len/2+r*.4),y,z,0,true)};
function tankPod(g,v,len,rr,x,y,z,bk){
 if(bk){cyl(g,len*.55,rr,x-len*.22,y,z,0x3a342e);add(g,new THREE.IcosahedronGeometry(rr*.9,0),0x1b1714,x+len*.1,y-rr*.1,z,0,true);add(g,new THREE.CylinderGeometry(rr*.8,rr*.8,.03,6).rotateZ(Math.PI/2),0xff6a1a,x+len*.06,y,z,1,false);return}
 if(v===0){capsule(g,len,rr,x,y,z,C.plate);return}
 if(v===1){const n=3,gp=len*.04,sl=(len-gp*(n-1))/n;for(let k=0;k<n;k++){const xx=x-len/2+sl/2+k*(sl+gp),r2=rr*(k===1?.86:1);cyl(g,sl,r2,xx,y,z,k===1?C.main:C.plate);cyl(g,gp*1.2,rr*.45,xx+sl/2+gp/2,y,z,C.dark)}
  for(const d of[-1,1])add(g,new THREE.CylinderGeometry(rr*.4,rr,rr*.8,6).rotateZ(-d*Math.PI/2),C.plate,x+d*(len/2+rr*.35),y,z,0,true);return}
 const n=Math.max(2,Math.round(len/(rr*2.3))),sl=len/n;for(let k=0;k<n;k++){const xx=x-len/2+sl/2+k*sl;add(g,new THREE.IcosahedronGeometry(Math.min(rr*1.05,sl*.52),0),C.plate,xx,y,z,0,true);cyl(g,sl*.5,rr*.22,xx+sl/2,y,z,C.dark)}
 cyl(g,len*.9,rr*.14,x,y-rr*.55,z,C.deep)}
function turret(g,x,y,z,s=1,twin=true){s*=(UU||1)*.5;const gg=new THREE.Group();gg.position.set(x,y,z);g.add(gg);add(gg,new THREE.CylinderGeometry(.2*s,.26*s,.12*s,8),C.dark,0,.06*s,0,0,false);add(gg,new THREE.SphereGeometry(.2*s,10,8),0x20252f,0,.2*s,0,0,false);
 for(const d of twin?[-1,1]:[0])add(gg,new THREE.CylinderGeometry(.04*s,.05*s,.9*s,6).rotateZ(Math.PI/2),0x12151c,.55*s,.22*s,d*.09*s,0,false)}
function nozzle(g,x,y,z,r,v=0,dead=0){
 if(v===1){add(g,new THREE.CylinderGeometry(r*1.05,r*1.3,r*1.7,6).rotateZ(Math.PI/2),0x14171f,x-r*.85,y,z,0,false);add(g,new THREE.CylinderGeometry(r*1.4,r*1.4,r*.2,6).rotateZ(Math.PI/2),C.dark,x-r*.2,y,z,0,true);add(g,new THREE.CylinderGeometry(r*.75,r*.75,.04,6).rotateZ(Math.PI/2),(dead?0x15171c:C.glow),x-r*1.7,y,z,dead?0:1,false);return}
 if(v===2){add(g,new THREE.CylinderGeometry(r*.6,r*1.6,r*2.1,10).rotateZ(Math.PI/2),0x14171f,x-r*1.0,y,z,0,false);add(g,new THREE.TorusGeometry(r*1.5,r*.13,4,12).rotateY(Math.PI/2),C.or,x-r*2.05,y,z,1,false);add(g,new THREE.CylinderGeometry(r*.5,r*.5,.04,10).rotateZ(Math.PI/2),(dead?0x15171c:C.glow),x-r*1.9,y,z,dead?0:1,false);return}
 add(g,new THREE.CylinderGeometry(r,r*1.25,r*1.6,10).rotateZ(Math.PI/2),0x14171f,x-r*.8,y,z,0,false);add(g,new THREE.CylinderGeometry(r*.8,r*.8,.04,10).rotateZ(Math.PI/2),(dead?0x15171c:C.glow),x-r*1.6,y,z,dead?0:1,false)}
function bridge(g,x,y,z,s=1){s*=UU||1;box(g,.9*s,.32*s,.7*s,x,y+.16*s,z,C.bridge);box(g,.3*s,.07*s,.5*s,x+.2*s,y+.34*s,z,C.or,1);const a=new THREE.Mesh(new THREE.CylinderGeometry(.01,.01,.7*s,4),M(0x9aa5bd));a.position.set(x-.2*s,y+.7*s,z);g.add(a)}
function vents(g,x,y,z,n,len){for(let i=0;i<n;i++)box(g,len*.12,.015,.18,x-len*.4+i*len*.8/Math.max(1,n-1),y,z,C.deep,0)}
// ===== ливрея: полосы, цифры, знаки (канвас-текстуры, плоские декали на палубе) =====
const texC=new Map();
function tex(key,w,h,draw){if(!texC.has(key)){const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');draw(x,w,h);const t=new THREE.CanvasTexture(c);t.anisotropy=4;texC.set(key,t)}return texC.get(key)}
const hexs=c=>'#'+c.toString(16).padStart(6,'0');
function dec(g,t,x,y,z,w,h,rot=0){const m=new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));m.rotation.x=-Math.PI/2;m.rotation.z=rot;m.position.set(x,y,z);g.add(m);return m}
const numTex=(txt,col,bg)=>tex('n'+txt+col+bg,256,128,(x,w,h)=>{if(bg){x.fillStyle=bg;x.fillRect(0,0,w,h)}x.fillStyle=col;x.font='bold 96px Arial Narrow, Arial, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(txt,w/2,h/2+4)});
const hazTex=(a,b)=>tex('h'+a+b,256,64,(x,w,h)=>{x.fillStyle=b;x.fillRect(0,0,w,h);x.fillStyle=a;for(let i=-h;i<w;i+=48){x.beginPath();x.moveTo(i,h);x.lineTo(i+24,h);x.lineTo(i+24+h,0);x.lineTo(i+h,0);x.fill()}});
const wordTex=(t,col)=>tex('w'+t+col,512,128,(x,w,h)=>{x.fillStyle=col;x.fillRect(0,0,w,h);x.fillStyle='#10131b';x.font='bold 78px Arial, sans-serif';x.textAlign='center';x.textBaseline='middle';x.fillText(t,w/2,h/2+4)});
const emblemTex=(col)=>tex('e'+col,128,128,(x,w,h)=>{x.strokeStyle=col;x.lineWidth=10;x.beginPath();x.arc(64,64,48,0,6.283);x.stroke();x.fillStyle=col;x.beginPath();x.moveTo(64,28);x.lineTo(92,92);x.lineTo(64,78);x.lineTo(36,92);x.closePath();x.fill()});
const chevTex=(col)=>tex('c'+col,256,64,(x,w,h)=>{x.strokeStyle=col;x.lineWidth=14;for(let i=0;i<4;i++){x.beginPath();x.moveTo(30+i*58,8);x.lineTo(58+i*58,32);x.lineTo(30+i*58,56);x.stroke()}});
// ===== цельный корпус: одна оболочка с профилем по отсекам; детали врезаны в неё =====
const cyl=(g,len,r,x,y,z,col,e=0)=>add(g,new THREE.CylinderGeometry(r,r,len,6).rotateZ(Math.PI/2),col,x,y,z,e);
const sm=t=>t*t*(3-2*t);

// гладкий loft: возвращает Mesh с метаданными для инкрементального обновления вмятин и ран
function loft(g,prof,x0,x1,col,N,cf,M,ao){
 const rings=[];for(let i=0;i<=N;i++){const x=x0+(x1-x0)*i/N,p=prof(x),hw=p.w/2,hh2=p.h/2,k=p.k||.62;const rg=[[x,p.cy+hh2,-hw*k],[x,p.cy+hh2,hw*k],[x,p.cy,hw],[x,p.cy-hh2,hw*k],[x,p.cy-hh2,-hw*k],[x,p.cy,-hw]];rg.cy=p.cy;rings.push(rg)}
 const pos=[],cl=[],uvs=[],meta=[],cur=[],aov=[];const cc=new THREE.Color();
 const push=(P,f,hex,u,m)=>{pos.push(P[0],P[1],P[2]);uvs.push(u[0],u[1]);cc.set(hex);cur.push(cc.r,cc.g,cc.b);aov.push(f);cl.push(cc.r*f,cc.g*f,cc.b*f);meta.push(m[0],m[1],m[2],m[3])};
 const lp=(a,b,t)=>[a[0],a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t];
 for(let i=0;i<N;i++)for(let j=0;j<6;j++){const j2=(j+1)%6,xm=(rings[i][0][0]+rings[i+1][0][0])/2;for(let m=0;m<M;m++){const c0=cf?cf(xm,j,(m+.5)/M,i):col;
  const A=lp(rings[i][j],rings[i][j2],m/M),B=lp(rings[i][j],rings[i][j2],(m+1)/M),C=lp(rings[i+1][j],rings[i+1][j2],(m+1)/M),D=lp(rings[i+1][j],rings[i+1][j2],m/M);
  const xi=rings[i][0][0],xi2=rings[i+1][0][0],t0=m/M,t1=(m+1)/M,cy0=rings[i].cy,cy1=rings[i+1].cy;
  const aA=ao?ao(xi,j,t0):1,aB=ao?ao(xi,j,t1):1,aC=ao?ao(xi2,j,t1):1,aD=ao?ao(xi2,j,t0):1;
  const uA=[(xi-x0)/(x1-x0),(j+t0)/6],uB=[(xi-x0)/(x1-x0),(j+t1)/6],uC=[(xi2-x0)/(x1-x0),(j+t1)/6],uD=[(xi2-x0)/(x1-x0),(j+t0)/6];
  const mA=[xi,j,t0,cy0],mB=[xi,j,t1,cy0],mC=[xi2,j,t1,cy1],mD=[xi2,j,t0,cy1];
  push(A,aA,c0,uA,mA);push(C,aC,c0,uC,mC);push(D,aD,c0,uD,mD);push(A,aA,c0,uA,mA);push(B,aB,c0,uB,mB);push(C,aC,c0,uC,mC)}}
 const cap=(r,f)=>{for(let j=1;j<5;j++){const t=f?[r[0],r[j+1],r[j]]:[r[0],r[j],r[j+1]];for(const P of t)push(P,1,col,[0,0],[P[0],-1,0,r.cy])}};cap(rings[0],1);cap(rings[N],0);
 const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));geo.setAttribute('color',new THREE.Float32BufferAttribute(cl,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));geo.computeVertexNormals();
 const mm=new THREE.Mesh(geo,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.62,metalness:.25,flatShading:true}));g.add(mm);
 mm.userData.li={N,M,x0,x1,meta:Float32Array.from(meta),cur:Float32Array.from(cur),aov:Float32Array.from(aov),pos0:Float32Array.from(pos),col0:Float32Array.from(cl),geo,k:1};return mm}
// пересчёт вершин колец i0..i1 с учётом вмятин и краски ран (всё остальное берётся из чистой копии)
const _cc=new THREE.Color();
function refreshLoft(li,i0,i1,H,hitD,dn,vc,xr){
 const {M,meta,cur,aov,pos0,col0,geo}=li,k=li.k||1,P=geo.attributes.position.array,Cc=geo.attributes.color.array,near=[];
 for(let v=(i0*6*M)*6,e=((i1+1)*6*M)*6;v<e;v++){const x=meta[v*4],j=meta[v*4+1];if(j<0)continue;const t=meta[v*4+2],cy=meta[v*4+3];let nr=near;nr.length=0;for(const h of H)if(Math.abs(x-h.x)<xr(h))nr.push(h);
  let px=pos0[v*3],py=pos0[v*3+1],pz=pos0[v*3+2];
  if(nr.length){const kd=dn(x,j,t,nr);if(kd>0){py=cy+(py-cy)*(1-kd);pz*=1-kd}
   _cc.setRGB(cur[v*3],cur[v*3+1],cur[v*3+2]);const hx=vc(x,j,t,_cc.getHex(),nr);
   if(hx!=null){_cc.set(hx);Cc[v*3]=_cc.r*aov[v];Cc[v*3+1]=_cc.g*aov[v];Cc[v*3+2]=_cc.b*aov[v]}else{Cc[v*3]=col0[v*3];Cc[v*3+1]=col0[v*3+1];Cc[v*3+2]=col0[v*3+2]}}
  else{Cc[v*3]=col0[v*3];Cc[v*3+1]=col0[v*3+1];Cc[v*3+2]=col0[v*3+2]}
  P[v*3]=px*k;P[v*3+1]=py*k;P[v*3+2]=pz*k}
 geo.attributes.position.needsUpdate=true;geo.attributes.color.needsUpdate=true;geo.computeVertexNormals();geo.computeBoundingSphere()}
function radarTower(g,x,y,L,hh,tons,has,base,rv=0,dm=0){
 const H=Math.max(hh*1.1,L*.075)*(has?1:.45),mw=Math.max(hh*.18,L*.012);
 hex(g,mw*3.2,mw*.9,mw*3.2,x,y+mw*.35,0,C.dark,.7); // основание
 for(let k=0;k<3;k++){const a=k*2.094+.5,bx=Math.cos(a)*mw*1.1,bz=Math.sin(a)*mw*1.1;const lg=new THREE.CylinderGeometry(mw*.07,mw*.1,H,4);lg.translate(0,H/2,0);lg.rotateZ(-bx/H*.7);lg.rotateX(bz/H*.7);add(g,lg,0x9aa5bd,x+bx,y+mw*.6,bz,0,false)}
 for(let q=1;q<=Math.floor(H/mw/1.4);q++){const t=q/(H/mw/1.4+1),r=mw*1.1*(1-t*.7);add(g,new THREE.CylinderGeometry(r,r,mw*.06,6),0x6b7690,x,y+mw*.6+H*t,0,0,false)}
 const ty=y+mw*.6+H; hex(g,mw*1.6,mw*.5,mw*1.6,x,ty,0,C.dark,.7);
 if(dm>.9){box(g,mw*.5,mw*.6,mw*.5,x+mw*.3,ty+mw*.3,mw*.2,0x1b1714);box(g,mw*.3,mw*.3,mw*.3,x,ty+mw*.7,0,0xff6a1a,1);return}
 if(!has){box(g,mw*.4,mw*.4,mw*.4,x,ty+mw*.4,0,C.or,1);return}
 const dr=Math.max(hh*.6,L*.035)*(tons>900?1.15:1);
 if(rv===1){const bar=new THREE.BoxGeometry(dr*.18,dr*.35,dr*2.6);bar.rotateX(dm*1.0);add(g,bar,C.plate,x,ty+dr*.4,0,0,true);box(g,dr*.2,dr*.3,dr*2.2,x+dr*.1,ty+dr*.4,0,C.glow,1);add(g,new THREE.SphereGeometry(dr*.55,8,5,0,6.283,0,1.57),0xdfe6f2,x,ty-mw*.1,0,0,false);return}
 if(rv===2){const hg=new THREE.CylinderGeometry(dr*.45,dr*.55,dr*1.6,4);hg.rotateY(Math.PI/4);add(g,hg,C.main,x,ty+dr*.8,0,0,true);for(let k=0;k<4;k++){if(dm>.5&&k%2)continue;const an=k*Math.PI/2+Math.PI/4,pg=new THREE.BoxGeometry(dr*.04,dr*1.0,dr*.7);pg.rotateY(an);add(g,pg,C.glow,x+Math.cos(an)*dr*.45,ty+dr*.85,Math.sin(an)*dr*.45,1,false)}add(g,new THREE.CylinderGeometry(mw*.05,mw*.05,dr,4),0x9aa5bd,x,ty+dr*2.1,0,0,false);return}
 const dg=new THREE.SphereGeometry(dr,10,6,0,6.283,0,1.15);dg.rotateZ(-Math.PI/2);dg.rotateZ(.35+dm*.9);add(g,dg,C.plate,x,ty+dr*.45,0,0,true); // тарелка смотрит вперёд-вверх
 add(g,new THREE.CylinderGeometry(mw*.05,mw*.05,dr*1.1,4).rotateZ(Math.PI/2-.35),0x9aa5bd,x+dr*.55,ty+dr*.7,0,0,false);add(g,new THREE.SphereGeometry(mw*.18,6,4),C.glow,x+dr*1.1,ty+dr*.95,0,1,false);
 if(tons>250&&dm<.5){for(const sd of[-1,1]){const px=x-dr*.2,pg=new THREE.BoxGeometry(dr*.15,dr*.9,dr*.9);pg.rotateX(sd*.35);add(g,pg,C.main,px,ty-mw*.1,sd*(mw*1.7+dr*.45),0,true);box(g,dr*.02,dr*.75,dr*.75,px+dr*.08,ty-mw*.1,sd*(mw*1.7+dr*.45)*1.0,C.glow,1)}} // фазированные решётки
 if(tons>700){const x2=x-L*.07,p=base(x2),t2=p.cy+p.h/2;hex(g,mw*2,mw*.8,mw*2,x2,t2+mw*.3,0,C.dark,.7);cyl(g,H*.5,mw*.12,x2,t2+mw*.7,0,0x9aa5bd);const dg2=new THREE.SphereGeometry(dr*.6,8,5,0,6.283,0,1.15);dg2.rotateZ(-Math.PI/2);dg2.rotateZ(-.3);add(g,dg2,C.plate,x2,t2+mw*.7+H*.5+dr*.25,0,0,true)}
}

// ===== пробоины: торчащие обломки + пар, огонь, хладагент, искры =====

const fxVS='attribute float aS;attribute float aA;attribute vec3 aC;varying float vA;varying vec3 vC;uniform float uS;void main(){vA=aA;vC=aC;vec4 mv=modelViewMatrix*vec4(position,1.);gl_PointSize=aS*uS/-mv.z;gl_Position=projectionMatrix*mv;}';
const fxFS='varying float vA;varying vec3 vC;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);if(d>.5)discard;float a=smoothstep(.5,.0,d)*vA;gl_FragColor=vec4(vC,a);}';
function woundFx(H,base,hh,u){const g=new THREE.Group(),uS_={value:1};g.userData.uS=uS_;
 const surf=(x,v)=>{const p=base(x),hw=p.w/2,h2=p.h/2,k=p.k||.62,R=[[x,p.cy+h2,-hw*k],[x,p.cy+h2,hw*k],[x,p.cy,hw],[x,p.cy-h2,hw*k],[x,p.cy-h2,-hw*k],[x,p.cy,-hw]];let j=((Math.floor(v)%6)+6)%6;const t=v-Math.floor(v),a=R[j],b=R[(j+1)%6];const P=new THREE.Vector3(x,a[1]+(b[1]-a[1])*t,a[2]+(b[2]-a[2])*t);const n=new THREE.Vector3(0,P.y-p.cy,P.z).normalize();if(n.lengthSq()<.01)n.set(0,1,0);return[P,n]};
 const em=[];const cols=[0x3a3f4c,0x5a4636,0x20242f,0x6b717f];let seedq=7;const rr=()=>{seedq=(seedq*16807)%2147483647;return seedq/2147483647};
 H.forEach((h,hi)=>{if(h.sev<.5)return;const vv=((h.v%6)+6)%6,[P,n]=surf(h.x,vv),r=h.r;
  // торчащие обломки: рваные плиты и погнутые стержни
  const nb=2+Math.floor(h.sev*3+rr()*2);for(let q=0;q<nb;q++){const len=r*(.35+rr()*.6),col=cols[Math.floor(rr()*4)],tg=new THREE.Vector3(rr()-.5,rr()-.5,rr()-.5).cross(n).normalize(),off=tg.clone().multiplyScalar(r*(.15+rr()*.4)*(rr()<.5?-1:1)),pos=P.clone().add(off).addScaledVector(n,-r*.08),tgt=pos.clone().addScaledVector(n,len).addScaledVector(tg,len*(rr()-.5)*1.2);
   let geo;if(rr()<.55){geo=new THREE.BoxGeometry(r*(.05+rr()*.12),r*(.015+rr()*.02),len);geo.translate(0,0,len/2)}else{geo=new THREE.CylinderGeometry(r*.018,r*.025,len,5);geo.rotateX(Math.PI/2);geo.translate(0,0,len/2)}
   const m=add(g,geo,col,pos.x,pos.y,pos.z,0,false);m.lookAt(tgt);m.rotateZ(rr()*3)}
  const pr=new THREE.Vector3().copy(P).addScaledVector(n,r*.1);
  em.push({p:pr,n,r,kind:'steam'});if(h.fire)em.push({p:pr,n,r,kind:'fire'});if(h.cool)em.push({p:pr,n,r,kind:'cool'});if(h.spark)em.push({p:pr,n,r,kind:'spark'})});
 const KD={steam:{np:18,life:2.4,sp:.4,add:false},fire:{np:22,life:.9,sp:1.0,add:true},cool:{np:24,life:2.4,sp:.8,add:false},spark:{np:14,life:.7,sp:2.2,add:true}};
 const sets=[];
 for(const kind of Object.keys(KD)){const ems=em.filter(e=>e.kind===kind);if(!ems.length)continue;const K=KD[kind],N=ems.length*K.np;
  const pos=new Float32Array(N*3),col=new Float32Array(N*3),sz=new Float32Array(N),al=new Float32Array(N),age=new Float32Array(N),life=new Float32Array(N),vel=new Float32Array(N*3),eo=new Int32Array(N);
  const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));geo.setAttribute('aC',new THREE.BufferAttribute(col,3));geo.setAttribute('aS',new THREE.BufferAttribute(sz,1));geo.setAttribute('aA',new THREE.BufferAttribute(al,1));
  const mat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,blending:K.add?THREE.AdditiveBlending:THREE.NormalBlending,uniforms:{uS:uS_},vertexShader:fxVS,fragmentShader:fxFS});
  const pts=new THREE.Points(geo,mat);pts.frustumCulled=false;g.add(pts);
  const spawn=(i,warm)=>{const e=ems[Math.floor(i/K.np)],r=e.r;eo[i]=0;age[i]=0;life[i]=K.life*(.6+rr()*.8);const sp=K.sp*r*(.7+rr()*.9);const tg=new THREE.Vector3(rr()-.5,rr()-.5,rr()-.5);
   const sprd=kind==='spark'?.9:kind==='fire'?.35:.3;const v=e.n.clone().multiplyScalar(sp).addScaledVector(tg,sp*sprd*2);
   vel[i*3]=v.x;vel[i*3+1]=v.y;vel[i*3+2]=v.z;pos[i*3]=e.p.x+(rr()-.5)*r*.4;pos[i*3+1]=e.p.y+(rr()-.5)*r*.4;pos[i*3+2]=e.p.z+(rr()-.5)*r*.4;
   if(warm){const a=rr()*life[i];age[i]=a;pos[i*3]+=vel[i*3]*a;pos[i*3+1]+=vel[i*3+1]*a;pos[i*3+2]+=vel[i*3+2]*a}};
  for(let i=0;i<N;i++)spawn(i,true);
  sets.push({kind,N,K,ems,pos,col,sz,al,age,life,vel,spawn,geo});}
 const upd=dt=>{for(const S of sets){const{N,K,pos,col,sz,al,age,life,vel,spawn,kind,ems}=S;for(let i=0;i<N;i++){age[i]+=dt;if(age[i]>life[i])spawn(i,false);const f=age[i]/life[i],r=ems[Math.floor(i/K.np)].r;
   pos[i*3]+=vel[i*3]*dt;pos[i*3+1]+=vel[i*3+1]*dt;pos[i*3+2]+=vel[i*3+2]*dt;
   if(kind==='steam'){const c=.92-.25*f;col[i*3]=c;col[i*3+1]=c+.02;col[i*3+2]=c+.05;sz[i]=r*(.3+f*1.0);al[i]=.3*(1-f)*Math.min(1,f*8)}
   else if(kind==='fire'){col[i*3]=1;col[i*3+1]=.85-.6*f;col[i*3+2]=.35-.35*f;sz[i]=r*(.7-.4*f);al[i]=(1-f)*.95}
   else if(kind==='cool'){pos[i*3+1]+=Math.sin(age[i]*6+i)*dt*r*.4;col[i*3]=.5;col[i*3+1]=.88;col[i*3+2]=1;sz[i]=r*(.18+.2*f);al[i]=.85*(1-f*f)}
   else{col[i*3]=1;col[i*3+1]=.8-.4*f;col[i*3+2]=.35;sz[i]=r*.09;al[i]=1-f}}
   S.geo.attributes.position.needsUpdate=true;S.geo.attributes.aC.needsUpdate=true;S.geo.attributes.aS.needsUpdate=true;S.geo.attributes.aA.needsUpdate=true}};
 upd(.0001);g.userData.upd=upd;return g}

// ===== пробоины текстурой: форма рисуется в высоком разрешении (круглые и рваные, не по сетке корпуса) =====

// ран текстурами: форма рисуется в высоком разрешении; рисуется инкрементально по новым попаданиям
const LW=4096,LH=1024;
// детальная «хоумворлдовская» обшивка: панели с фасками, швы, люки, вентиляция, габаритные огни, жёлто-чёрные метки — нарисованы на текстуре корпуса
function makeGreeble(len,hh,fw){
 const mk=(w,h,f)=>{const c=document.createElement('canvas');c.width=w;c.height=h;const x=c.getContext('2d');x.fillStyle=f;x.fillRect(0,0,w,h);x.scale(w/LW,h/LH);return[c,x]};
 const [cm,xm]=mk(4096,1024,'#d6d9de'),[ce,xe]=mk(1024,256,'#000'),[cb,xb]=mk(2048,512,'#808080');
 let sq=91;const rn=()=>{sq=(sq*16807)%2147483647;return sq/2147483647};
 const fh=LH/6,cw=Math.max(40,LW*hh*.85/len);
 for(let j=0;j<6;j++){const y0=j*fh,rh=Math.max(26,fh*hh*.85/Math.max(fw[j],hh*.3)),nr=Math.max(1,Math.round(fh/rh)),ch=fh/nr,nc=Math.round(LW/cw);
  for(let r=0;r<nr;r++)for(let c=0;c<nc;c++){const x0=c*LW/nc,w=LW/nc,y=y0+r*ch,tone=rn(),kind=rn();
   const g=Math.floor(150+tone*70);xm.fillStyle='rgba('+g+','+(g+3)+','+(g+8)+',.55)';xm.fillRect(x0,y,w,ch);
   // фаска панели: светлая сверху-слева, тёмная снизу-справа
   xm.fillStyle='rgba(255,255,255,.35)';xm.fillRect(x0+2,y+2,w-4,3);xm.fillRect(x0+2,y+2,3,ch-4);xm.fillStyle='rgba(0,0,0,.4)';xm.fillRect(x0+2,y+ch-5,w-4,3);xm.fillRect(x0+w-5,y+2,3,ch-4);
   xb.fillStyle='#d0d0d0';xb.fillRect(x0+2,y+2,w-4,3);xb.fillRect(x0+2,y+2,3,ch-4);xb.fillStyle='#303030';xb.fillRect(x0+2,y+ch-5,w-4,3);xb.fillRect(x0+w-5,y+2,3,ch-4);
   xm.fillStyle='rgba(10,12,18,.85)';xm.fillRect(x0,y,w,2.5);xm.fillRect(x0,y,2.5,ch);xb.fillStyle='#101010';xb.fillRect(x0,y,w,3);xb.fillRect(x0,y,3,ch);
   if(kind<.16){const n=3+Math.floor(rn()*3);for(let k=0;k<n;k++){const yy=y+ch*.22+k*ch*.56/n;xm.fillStyle='rgba(8,10,14,.9)';xm.fillRect(x0+w*.2,yy,w*.6,ch*.07);xb.fillStyle='#202020';xb.fillRect(x0+w*.2,yy,w*.6,ch*.09)}} // вентиляция
   else if(kind<.27){xm.fillStyle='rgba(30,34,44,.75)';xm.fillRect(x0+w*.2,y+ch*.2,w*.6,ch*.6);xm.fillStyle='rgba(255,255,255,.3)';xm.fillRect(x0+w*.2,y+ch*.2,w*.6,3);xb.fillStyle='#c0c0c0';xb.fillRect(x0+w*.2,y+ch*.2,w*.6,ch*.6)} // люк-ниша
   else if(kind<.33){xm.fillStyle='#e8c53a';xm.fillRect(x0+4,y+4,w-8,ch-8);xm.fillStyle='#14161b';for(let q=-ch;q<w;q+=22){xm.beginPath();xm.moveTo(x0+4+q,y+ch-4);xm.lineTo(x0+4+q+11,y+ch-4);xm.lineTo(x0+4+q+11+ch,y+4);xm.lineTo(x0+4+q+ch,y+4);xm.fill()}xm.clearRect(0,0,0,0)} // жёлто-чёрная метка
   else if(kind<.42){const n=4+Math.floor(rn()*4);for(let k=0;k<n;k++){const px=x0+w*(.15+.7*k/n),py=y+ch*.5;xm.fillStyle='#fff';xm.fillRect(px,py,6,6);xe.fillStyle=rn()<.7?'#ffd890':'#8fe8ff';xe.fillRect(px,py,8,8)}} // огоньки
   else if(kind<.5){xm.fillStyle='rgba(255,255,255,.22)';xm.fillRect(x0+w*.12,y+ch*.12,w*.76,ch*.76);xb.fillStyle='#b8b8b8';xb.fillRect(x0+w*.12,y+ch*.12,w*.76,ch*.76)} // накладка
  }}
 const T=(c,s)=>{const t=new THREE.CanvasTexture(c);t.flipY=false;t.anisotropy=4;if(s)t.colorSpace=THREE.SRGBColorSpace;return t};
 return{cm,ce,cb,tm:T(cm,true),te:T(ce,true),tb:T(cb,false)}}
function makeWoundTex(len,xmin,hh,base){
 const W=LW,Hh=LH,mk=(src)=>{const c=document.createElement('canvas');c.width=src.width;c.height=src.height;const x=c.getContext('2d');x.drawImage(src,0,0);x.scale(src.width/LW,src.height/LH);return[c,x]};
 const ks=1;
 const [cm,xm]=mk(base.cm),[ce,xe]=mk(base.ce),[cb,xb]=mk(base.cb);
 const poly=(x,cx,cy,rx,ry,k,h)=>{x.beginPath();for(let a=0;a<=6.2832+.001;a+=.03){const rad=k*(1+.28*Math.sin(3*a+h.p1)+.18*Math.sin(5*a+h.p2)+.1*Math.sin(9*a+h.p1*2)+.035*Math.sin(17*a+h.p2*3));const px=cx+Math.cos(a)*rx*rad,py=cy+Math.sin(a)*ry*rad;a?x.lineTo(px,py):x.moveTo(px,py)}x.closePath()};
 const grad=(x,cx,cy,rx,ry,r0,r1,c0,c1)=>{x.save();x.translate(cx,cy);x.scale(1,ry/rx);const g=x.createRadialGradient(0,0,r0,0,0,r1);g.addColorStop(0,c0);g.addColorStop(1,c1);x.fillStyle=g;x.beginPath();x.arc(0,0,r1,0,6.2832);x.fill();x.restore()};
 let sq=11;const rn=()=>{sq=(sq*16807)%2147483647;return sq/2147483647};
 const drawn=new Set();
 const T=(c,srgb)=>{const t=new THREE.CanvasTexture(c);t.flipY=false;t.anisotropy=4;if(srgb)t.colorSpace=THREE.SRGBColorSpace;return t};
 const tm=T(cm,true),te=T(ce,true),tb=T(cb,false);
 const draw=(h)=>{if(drawn.has(h.id))return;drawn.add(h.id);sq=11+h.id*977;
  const cx=((h.x-xmin)/len)*W,cy0=(h.v/6)*Hh,rx=Math.max(4,(h.r*h.asp)/len*W),ry=Math.max(4,(h.r/h.asp)/(hh*.7)/6*Hh),hole=h.sev>.55;
  for(const off of[0,-Hh,Hh]){const cy=cy0+off;if(cy+ry*4<0||cy-ry*4>Hh)continue;
   grad(xm,cx,cy,rx,ry,rx*.4,rx*(1.25+h.sev*.8),'rgba(38,28,24,.8)','rgba(38,28,24,0)');
   if(h.cool){grad(xe,cx-rx*3,cy,rx*3.5,ry*.7,0,rx*3.5,'rgba(90,190,230,.55)','rgba(90,190,230,0)');grad(xm,cx-rx*3,cy,rx*3.5,ry*.7,0,rx*3.5,'rgba(200,225,235,.5)','rgba(200,225,235,0)')}
   if(!hole)continue;
   poly(xm,cx,cy,rx,ry,1.28,h);xm.fillStyle='rgb(48,24,14)';xm.fill();
   poly(xe,cx,cy,rx,ry,1.22,h);xe.fillStyle='#8a2208';xe.fill();poly(xe,cx,cy,rx,ry,1.13,h);xe.fillStyle=h.sev>.75?'#e86a14':'#a03a0c';xe.fill();poly(xe,cx,cy,rx,ry,1.05,h);xe.fillStyle=h.sev>.75?'#ffc040':'#e0701c';xe.fill();
   poly(xb,cx,cy,rx,ry,1.5,h);xb.fillStyle='#d8d8d8';xb.fill();
   poly(xm,cx,cy,rx,ry,1.0,h);xm.fillStyle='#000';xm.fill();poly(xe,cx,cy,rx,ry,.97,h);xe.fillStyle='#2a0600';xe.fill();poly(xb,cx,cy,rx,ry,1.0,h);xb.fillStyle='#000';xb.fill();
   for(let k=0;k<5+Math.floor(h.sev*5);k++){const a=rn()*6.2832,l=1.2+rn()*1.5,mx=cx+Math.cos(a)*rx*1.2,my=cy+Math.sin(a)*ry*1.2,ex=cx+Math.cos(a+(rn()-.5)*.6)*rx*l*1.4,ey=cy+Math.sin(a+(rn()-.5)*.6)*ry*l*1.4;
    for(const [xx,col,w] of[[xm,'#1b1714',2.4*ks*2],[xe,h.sev>.88?'#8a280a':'#000',1.2*ks*2],[xb,'#383838',2.4*ks*2]]){xx.strokeStyle=col;xx.lineWidth=Math.max(1,w);xx.beginPath();xx.moveTo(mx,my);xx.lineTo((mx+ex)/2+(rn()-.5)*rx*.4,(my+ey)/2+(rn()-.5)*ry*.4);xx.lineTo(ex,ey);xx.stroke()}}}
  tm.needsUpdate=te.needsUpdate=tb.needsUpdate=true};
 const apply=(m)=>{m.map=tm;m.emissiveMap=te;m.emissive=new THREE.Color(1,1,1);m.emissiveIntensity=1.1;m.bumpMap=tb;m.bumpScale=3;m.needsUpdate=true};
 const dispose=()=>{tm.dispose();te.dispose();tb.dispose()};
 return{draw,apply,dispose}}

function ship(inv,dmg){
 seed=inv.seed||7;const DG=dmg||{},DM=DG.mod||{},hp=i=>(DG.tur&&DG.tur[i]!=null)?DG.tur[i]:1;const V=k=>{const v=Math.sin((inv.seed||7)*12.9898+k*78.233)*43758.5453;return Math.floor((v-Math.floor(v))*3)}; const g=new THREE.Group();const MOUNTS=[],NOZ=[];
 const tons=inv.eng.t+inv.reac+inv.tank+inv.cab*.6+inv.mag+inv.hang+inv.cargo+inv.turrets.length*8+inv.msl*.6+60;
 const L=inv.L||1.75*Math.cbrt(tons), hh=L*.15, u=hh/.7; UU=u*.7;
 const es=Math.cbrt(inv.eng.t)*.26, eL=Math.min(L*.2,es*1.2), eH=Math.min(hh*2,es*1.1), eW=eH*1.15;
 const bigT=inv.tank>(inv.eng.t+inv.reac+inv.tank+inv.cab*.6+inv.mag+inv.hang+inv.cargo)*.4,bigC=inv.cargo>(inv.eng.t+inv.reac+inv.tank+inv.cab*.6+inv.mag+inv.hang+inv.cargo)*.4;
 const mods=[['reac',inv.reac],['tank',inv.tank],['hang',inv.hang*.5],['cab',inv.cab*.6],['mag',inv.mag],['cargo',inv.cargo]].filter(m=>m[1]>0);
 const x0=-L/2+eL, x1=L*.5-L*.1, span=x1-x0, totM=mods.reduce((a,m)=>a+Math.pow(m[1],.8),0)||1;
 let cx=x0; const segs=[],place={}; // сегменты профиля
 segs.push({a:-L/2,b:x0,w:eW,h:eH,cy:0,k:.7});
 for(const [k,m] of mods){const ml=span*Math.pow(m,.8)/totM; place[k]=[cx,cx+ml];
  
  const d={reac:[.95,.62,0],tank:[1.25,.6,0],cab:[.95,.85,.1],mag:[.85,.48,-.02],cargo:[1.3,.9,.05],hang:[1.3+Math.min(.4,Math.cbrt(inv.hang)*.05),1.0+Math.min(.3,Math.cbrt(inv.hang)*.035),-.02]}[k];
  const thin=(k==='tank'&&bigT)||(k==='cargo'&&bigC)?.5:1;segs.push({a:cx,b:cx+ml,w:thin*hh*1.45*d[0]*(k==='tank'?Math.min(1.3,.8+Math.cbrt(inv.tank)*.05):1),h:thin*hh*1.4*d[1],cy:hh*d[2],k:k==='hang'?.97:.62});cx+=ml}
 const lm=segs[segs.length-1],ar=Math.pow(inv.armor,.7),noseL=L*(.11-.025*ar); segs.push({a:x1,b:x1+noseL,w:hh*.05+(lm.w*.6-hh*.05)*ar,h:hh*.06+(lm.h*.62-hh*.06)*ar,cy:lm.cy*.5,k:.4+.57*ar,nose:1});
 const base=(x)=>{ // профиль с плавным переходом между отсеками (скругление стыков)
  let i=0;while(i<segs.length-1&&x>segs[i].b)i++;const s0=segs[i],r=Math.min(span*.045,L*.03);let w=s0.w,h=s0.h,cy=s0.cy,k=s0.k;
  const prev=segs[i-1],next=segs[i+1];
  if(prev&&x<s0.a+r){const t=sm((x-(s0.a-r))/(2*r));w=prev.w+(s0.w-prev.w)*t;h=prev.h+(s0.h-prev.h)*t;cy=prev.cy+(s0.cy-prev.cy)*t;k=prev.k+(s0.k-prev.k)*t}
  else if(next&&x>s0.b-r&&!next.nose){const t=sm((x-(s0.b-r))/(2*r));w=s0.w+(next.w-s0.w)*t;h=s0.h+(next.h-s0.h)*t;cy=s0.cy+(next.cy-s0.cy)*t;k=s0.k+(next.k-s0.k)*t}
  if(s0.nose){const t=(x-s0.a)/(s0.b-s0.a),pr=segs[i-1];const e=Math.pow(t,.85);w=pr.w*(1-e)+s0.w*e;h=pr.h*(1-e)+s0.h*e;cy=pr.cy*(1-e)+s0.cy*e;k=pr.k*(1-e)+s0.k*e}
  return {w:Math.max(w,.02),h:Math.max(h,.02),cy,k}};
const occ=[],claim=(zone,a,b,z0,z1)=>occ.push({zone,a,b,z0:Math.min(z0,z1),z1:Math.max(z0,z1)});
 const isFree=(zone,a,b,z0,z1)=>{const lo=Math.min(z0,z1),hi=Math.max(z0,z1);return!occ.some(o=>o.zone===zone&&a<o.b&&b>o.a&&lo<o.z1&&hi>o.z0)};
 const fit=(zone,x,len,z0,z1)=>{for(const off of[0,.05,-.05,.1,-.1,.15,-.15,.2,-.2]){const xx=x+off*span;if(isFree(zone,xx-len/2,xx+len/2,z0,z1))return xx}return null};
 const gapIn=(zone,xa,xb,z0,z1,minL)=>{const n=160,st=(xb-xa)/n;let best=null,cur=null;for(let i=0;i<=n;i++){const xx=xa+i*st,fr=i<n&&isFree(zone,xx,xx+st,z0,z1);if(fr){if(!cur)cur={a:xx,b:xx+st};else cur.b=xx+st}else if(cur){if(cur.b-cur.a>=minL&&(!best||cur.b-cur.a>best.b-best.a))best=cur;cur=null}}if(cur&&cur.b-cur.a>=minL&&(!best||cur.b-cur.a>best.b-best.a))best=cur;return best};
 const nzf=(a,b)=>{const v=Math.sin(a*127.1+b*311.7)*43758.5453;return v-Math.floor(v)};
 const mkH=(arr)=>arr.map((h,hi0)=>{const hi=h.id!=null?h.id:hi0;const ty=Math.floor(nzf(hi,11.3)*4);return{id:hi,x:h.x!=null?h.x:-L/2+h.f*(x1+noseL+L/2),v:h.v,r:h.r*L,sev:h.sev,ty,asp:(.65+1.0*nzf(hi,1.3))*(ty===2?1.9:1),p1:nzf(hi,2.1)*6.28,p2:nzf(hi,3.7)*6.28,cool:h.cool!=null?h.cool:nzf(hi,5.5)>.55,fire:h.fire!=null?h.fire:(nzf(hi,7.9)>.5||h.sev>.85),spark:nzf(hi,9.1)<.4}});let H=mkH(DG.hits||[]);
 const TC=inv.col||0xff7a3c,bw=span*.045,bands=[.2,.5,.8].map(f=>x0+span*f),pw=(x1+noseL+L/2)/26;
 const _c=new THREE.Color(),sh=(c,f)=>{_c.set(c);_c.multiplyScalar(f);return _c.getHex()},inR=(r,x)=>r&&x>r[0]&&x<r[1];
 const cf0=(x,j,t,i)=>{const px=(x+L/2)/pw,pf=px-Math.floor(px),pi=Math.floor(px),top=j===0,up=j===1||j===5,lo=j===2||j===4,bot=j===3;
  let c=C.main;c=sh(c,.94+.1*((pi*7)%5)/5);
  if(pf<.07||pf>.975)c=sh(C.main,.32);else if(pf<.1)c=sh(C.main,1.15);
  const win=place.cab&&inR(place.cab,x);
  if(x<-L/2+eL){c=sh(0x3a4258,.9+.2*(pi%2));if(top||up){const d=x*34/L+t*1.5;if(x<-L/2+eL*.8&&((d%1)+1)%1<.5)c=(Math.floor(d)%2)?0xffd23a:0x15181f}if(lo&&t>.5)c=0x20242f;return c}
  if(x>x1+noseL*.3){c=TC;if(((x*16/L)%1+1)%1<.22)c=0xf2f4f8;if(pf<.06)c=sh(TC,.6);return c}
  if(top){const pp=base(x),ed=Math.min(t,1-t)*pp.w*pp.k;if(ed<hh*.2)c=TC;else if(ed<hh*.3)c=0xf2f4f8;else if(Math.abs(t-.5)*pp.w*pp.k<hh*.05)c=sh(C.main,.5);
   for(const b of bands)if(Math.abs(x-b)<bw)c=TC;
   if(place.mag&&inR(place.mag,x)&&t>.2&&t<.8)c=(Math.floor(px*2+t*5)%2)?0xffd23a:0x15181f;
   if(place.cargo&&bigC&&inR(place.cargo,x)){const n=Math.max(3,Math.round(inv.cargo/60)),cell=Math.floor((x-place.cargo[0])/((place.cargo[1]-place.cargo[0])/n));c=[0xd9463c,0x3c82d9,0xe0a63a,0x4aa56a,0xc9ccd4][cell%5]}
   return c}
  const AR=Math.min(1,.35+inv.armor),hs=(a,b2,c2)=>{const v=Math.sin(a*127.1+b2*311.7+c2*74.7)*43758.5453;return v-Math.floor(v)};
  const plates=(c,rows,u0)=>{const cx=px*2+(u0||0),fx=cx-Math.floor(cx),cy=t*rows,fy=cy-Math.floor(cy),h=hs(Math.floor(cx),Math.floor(cy),j);
   if(fx<.07||fx>.94||fy<.09||fy>.93)return sh(c,.5-.1*AR); // кромки бронелистов
   if(fx<.12||fy<.15)return sh(c,1.12); // блик на кромке
   return sh(c,.86+.2*h)};
  if(up){if(t<.2)c=TC;else if(t<.27)c=sh(C.main,.4);else if(t<.33)c=0xf2f4f8;
   else{c=plates(c,2,0);
    // окна: ряд по всему борту, на каютах двойной и ярче
    const wc=(x+L/2)/(span*.011),wf=wc-Math.floor(wc),wi=Math.floor(wc),rowT=t>.55&&t<.82;
    if(win&&((t>.36&&t<.58)||(t>.66&&t<.88))){const rowc=t<.62?.47:.77,inner=Math.abs(t-rowc)<.07&&wf>.12&&wf<.58;c=wf<.7?(inner?(hs(wi,j,1)>.15+(DM.cab||0)*.85?0xffe9a8:0x15130f):sh(C.main,.6)):sh(C.main,.45)}
    else if(rowT&&!(place.hang&&inR(place.hang,x))&&x>-L/2+eL*1.1&&wf<.7){const inner=t>.62&&t<.74&&wf>.12&&wf<.58;c=inner?(hs(wi,j,2)>.3+(DM.cab||0)*.6?0xbfeaff:0x1a2433):sh(C.main,.6)}
    if(x>x1-span*.1&&x<x1+noseL*.2&&t>.4&&t<.9&&wf<.7)c=0xbdf0ff} // остекление мостика
   if(place.hang&&inR(place.hang,x)&&t>.45){c=sh(C.main,.7);if(t>.95||x<place.hang[0]+pw*.2||x>place.hang[1]-pw*.2)c=0xff9a2e;else if(((x*60/L)%1+1)%1<.04)c=sh(C.main,.6)}
   if(place.tank&&inR(place.tank,x)&&(Math.floor(px*1.5)%3===0)&&t>.4)c=sh(C.main,.45);
   return c}
  if(lo){if(t>.7)c=sh(C.main,.55);else c=plates(c,3,.5);if(t<.1)c=sh(TC,.8);if(pi%6===2&&t>.2&&t<.45)c=0xffd23a;
   if(place.hang&&inR(place.hang,x)&&t<.5)c=sh(C.main,.7);return c}
  if(bot){c=sh(C.main,.55);if(t>.4&&t<.6)c=sh(TC,.7);return c}
  return c};
const hitD=(h,x,j,t)=>{let dv=j+t-h.v;if(dv>3)dv-=6;if(dv<-3)dv+=6;const dx=(x-h.x)/(h.r*h.asp),dd=dv*hh*.7/(h.r/h.asp),a=Math.atan2(dd,dx),rad=1+.28*Math.sin(3*a+h.p1)+.18*Math.sin(5*a+h.p2)+.1*Math.sin(9*a+h.p1*2);return Math.sqrt(dx*dx+dd*dd)/rad};
 const mixH=(a,b,f)=>{const ca=new THREE.Color(a),cb=new THREE.Color(b);return ca.lerp(cb,Math.max(0,Math.min(1,f))).getHex()};
 const cf=cf0;
 const vc=(x,j,t,cur,HL)=>{let out=null,bd=9;for(const h of (HL||H)){const d=hitD(h,x,j,t);let c=null;
   if(h.cool){const ddx=(x-h.x)/h.r;let dv=j+t-h.v;if(dv>3)dv-=6;if(dv<-3)dv+=6;const ex=ddx>0&&ddx<4.5?1-ddx/4.5:0;if(ex>0&&Math.abs(dv*hh*.7/h.r)<.5*ex+.12)c=mixH(out!=null?out:cur,0xa8ecff,.75*ex)}
   if(d<1.25){const sv=h.sev;
    if(sv>.6&&d<.3)c=0x040507;else if(sv>.6&&d<.4)c=mixH(0x1a0603,0xc0300c,(d-.3)/.1);else if(sv>.6&&d<.5)c=mixH(0xff7a1a,0xffd24a,(.5-d)/.1);
    else if(d<.5+.45*sv)c=mixH(0x1b1714,0x4a2e1e,Math.abs(Math.sin(x*9+t*7))*.7);
    else c=mixH(cur,0x2a2420,(1.25-d)/.75*.8)}
   if(c!=null&&d<bd){bd=d;out=c}else if(c!=null&&out==null)out=c}return out};
 const dn=(x,j,t,HL)=>{let k=0;for(const h of (HL||H)){if(h.sev<.4)continue;const d=hitD(h,x,j,t);if(d>1.25)continue;const sv=h.sev,ss=(a,b,v)=>{const q=Math.max(0,Math.min(1,(v-a)/(b-a)));return q*q*(3-2*q)};let kk=0;
   if(h.ty===0)kk=.5*sv*Math.pow(Math.max(0,1-d/1.1),1.3); // чаша
   else if(h.ty===1){kk=.55*sv*(1-ss(.62,.95,d));kk-=.1*sv*Math.exp(-Math.pow((d-1.05)/.12,2))} // кратер с плоским дном и вздутым краем
   else if(h.ty===2)kk=.5*sv*Math.pow(Math.max(0,1-d),.6); // разрез: узкий и глубокий
   else{kk=.55*sv*(1-ss(.0,.7,d));kk-=.2*sv*Math.exp(-Math.pow((d-.85)/.22,2))} // пробой изнутри: края выворочены наружу
   if(kk>k||kk<0&&k===0)k=kk}return k};
 const cl01=v=>Math.max(0,Math.min(1,v)),ssm=(a,b,v)=>{const q=cl01((v-a)/(b-a));return q*q*(3-2*q)};
 const ao=(x,j,t)=>{const px=(x+L/2)/pw,pf=px-Math.floor(px),dd=Math.min(pf,1-pf);let v=.8+.2*ssm(0,.18,dd); // затенение у швов
  if(j===0)v*=1.06-.14*Math.pow(Math.abs(2*t-1),2);else if(j===1||j===5)v*=1.35-.3*t;else if(j===2||j===4)v*=1.35-.3*t;else v*=.7;
  if(place.tank&&inR(place.tank,x)&&(j===2||j===4||j===1||j===5))v*=.85; // тень под баками/гондолами
  if(x<-L/2+eL)v*=.7+.3*ssm(0,eL,x+L/2);
  if(x>x1)v*=1.05;return v};
 const hullMesh=loft(g,base,-L/2,x1+noseL,C.main,inv.N||300,cf,inv.M||12,ao);hullMesh.userData.hull=1;
 const li=hullMesh.userData.li;
 const setHits=(oldH,arr,li_)=>{const nh=mkH(arr);const xr=h=>Math.max(2.1*h.r*h.asp,4.8*h.r);let a=1e9,b=-1;for(const h of oldH.concat(nh)){const a0=Math.max(0,Math.floor((h.x-xr(h)-li.x0)/(li.x1-li.x0)*li.N)-1),b0=Math.min(li.N-1,Math.ceil((h.x+xr(h)-li.x0)/(li.x1-li.x0)*li.N)+1);if(a0<a)a=a0;if(b0>b)b=b0}
  if(b>=a)refreshLoft(li_||li,a,b,nh,hitD,dn,vc,xr);return nh};
 g.userData.wd={setHits,mkH,li,base,hh,u,xmin:-L/2,len:x1+noseL+L/2,L};
 // шпангоуты: тонкие рёбра по корпусу поверх оболочки (вырастают из неё, а не стоят рядом)
 for(let q=1;q<14;q++){const x=-L/2+eL+(x1+noseL*.6+L/2-eL)*q/14,p=base(x);hex(g,L*.004,p.h*1.03,p.w*1.03,x,p.cy,0,0x566178,p.k)}
 // двигатель: сопла на кормовой грани + боковые плавники
 const cols=Math.ceil(Math.sqrt(inv.eng.n*eW/eH)),rows=Math.ceil(inv.eng.n/cols),nr=Math.min(eW/cols,eH/rows)*.42;
 for(let k=0;k<inv.eng.n;k++){const c=k%cols,r=Math.floor(k/cols);nozzle(g,-L/2,(r-(rows-1)/2)*eH/rows,(c-(cols-1)/2)*eW/cols*.8,nr,V(1),k<Math.round((DM.eng||0)*inv.eng.n)?1:0);NOZ.push({y:(r-(rows-1)/2)*eH/rows,z:(c-(cols-1)/2)*eW/cols*.8,r:nr})}
 for(const sd of[-1,1])wedge(g,eL*.9,eH*.8,.03,-L/2+eL*.5,0,sd*eW*.52,C.plate,.4,.4);
 if(inv.eng.n>=2)for(const sd of[-1,1]){const nl=eL*1.9,nh=eH*.92,nw=eW*.78,zc=sd*(eW/2+nw*.36),xc=-L/2+nl*.3;
  hex(g,nl,nh,nw,xc,0,zc,C.dark,.8);box(g,.03*u,nh*.7,nw*.78,xc-nl/2-.012*u,0,zc,C.glow,1);dec(g,hazTex('#111','#ffd23a'),xc+nl*.1,nh/2+.004,zc,nl*.45,nw*.62,0);
  box(g,nl*.7,nh*.45,.02*u,xc+nl*.05,0,zc+sd*(nw/2+.008),C.deep);box(g,nl*.7,.02*u,.02*u,xc+nl*.05,-nh*.3,zc+sd*(nw/2+.012),C.or,1)}
 // реактор: кольца-светлые на хребте и радиаторы, растущие из борта
 if(inv.reac>0){const [ra,rb]=place.reac,pr=base((ra+rb)/2);for(let q=0;q<3;q++){const x=ra+(rb-ra)*(.2+.3*q),p=base(x);hex(g,(rb-ra)*.035,p.h*1.05,p.w*1.05,x,p.cy,0,C.or,p.k)}
  const area=Math.sqrt(inv.reac)*.17,len=Math.min(L*.3,area*1.5),sp=Math.min(hh*2.2,area*.8);claim('side',ra,ra+len,0,1);for(const sd of[-1,1]){plate4(g,len,sp,.035*u,len*.45,ra+len*.5,pr.cy,sd*pr.w*.4,C.plate,sd);const rv=V(3);if(rv===0)for(let q=1;q<5;q++)box(g,len*(.8-q*.12),.012,.02,ra+len*(.5-q*.05)-len*.02,pr.cy+.03*u,sd*(pr.w*.4+sp*q/5.5),C.deep);
   else if(rv===1){for(let q=1;q<4;q++)plate4(g,len*(1-q*.15),sp*(1-q*.12),.02*u,len*.4,ra+len*.5,pr.cy+q*.05*u,sd*pr.w*.4,q%2?C.main:C.plate,sd)}
   else{for(let q=0;q<5;q++)cyl(g,len*(.85-q*.08),.022*u,ra+len*.5-q*len*.04,pr.cy+.02*u,sd*(pr.w*.4+sp*(.15+q*.17)),q%2?C.dark:C.plate);box(g,.03,.02*u,sp*.9,ra+len*.1,pr.cy+.02*u,sd*(pr.w*.4+sp*.5),C.or,1)}}}
 // баки: чёрные полосы-швы на выпуклостях; каюты: окна; ангар: щель; груз: секции — всё врезано в борт
 if(place.cab){const [a,b]=place.cab,nw=Math.max(4,Math.round(inv.cab/5)),p=base((a+b)/2);for(let q=0;q<nw;q++)box(g,(b-a)*.5/nw,.025,.02,a+(b-a)*(.2+.6*q/nw),p.cy+p.h*.15,p.w*.5+.005,0xffe9a8,1),box(g,(b-a)*.5/nw,.025,.02,a+(b-a)*(.2+.6*q/nw),p.cy+p.h*.15,-p.w*.5-.005,0xffe9a8,1)}
 if(place.hang){const [a,b]=place.hang,p=base((a+b)/2);claim('side',a,b,0,1);for(const sd of[-1,1]){box(g,(b-a)*.8,p.h*.45,.02,(a+b)/2,p.cy-p.h*.1,sd*(p.w*.5+.01),C.deep);box(g,(b-a)*.8,.02,.02,(a+b)/2,p.cy-p.h*.33,sd*(p.w*.5+.02),C.or,1)}}
 if(place.tank&&bigT){const [a,b]=place.tank,p=base((a+b)/2),rr=Math.min(hh*.75,Math.cbrt(inv.tank)*.075),n=inv.tank>300?2:1;claim('side',a,b,0,1);for(const sd of[-1,1])for(let q=0;q<n;q++){const zz=sd*(p.w*.5+rr*(1.1+q*2)),yy=p.cy+(q?rr*.3:0);tankPod(g,V(4),(b-a)*.95,rr,(a+b)/2,yy,zz,(DM.tank||0)>.5&&sd>0&&q===0);for(let t=0;t<4;t++){const xx=a+(b-a)*(.1+t*.27);cyl(g,.05*L*.5,rr*1.08,xx,yy,zz,C.dark);cyl(g,.012,rr*1.12,xx+.035*L*.5,yy,zz,C.or,1);const gap=Math.abs(zz)-p.w*.5-rr*.5;wedge(g,.1*L*.5,rr*.5,gap+rr*.6,xx,yy,sd*(p.w*.5+gap/2+rr*.2),C.main,.55,.6);box(g,.08*L*.5,rr*.28,rr*.5,xx,yy,sd*(p.w*.5+.01),C.dark)}}}
 else if(place.tank){const [a,b]=place.tank;for(let q=1;q<4;q++){const x=a+(b-a)*q/4,p=base(x);hex(g,.03,p.h*1.04,p.w*1.04,x,p.cy,0,C.deep,p.k)}}
 if(place.cargo&&bigC){const [a,b]=place.cargo,p=base((a+b)/2),nC=Math.max(3,Math.round(inv.cargo/60)),cl=(b-a)/Math.ceil(nC/2)*.92,ch=hh*.95;claim('side',a,b,0,1);for(let q=0;q<Math.ceil(nC/2);q++)for(const sd of[-1,1])for(const lv of[0,1]){if(lv&&q%2)continue;{const cvv=V(5),xc=a+cl*.55+q*(b-a)/Math.ceil(nC/2),yc=p.cy+lv*ch*.95,zc=sd*(p.w*.5+ch*.6);if(cvv===1){cyl(g,cl,ch*.55,xc,yc,zc,(q+lv)%2?C.plate:C.main);for(const dd of[-.35,0,.35])cyl(g,cl*.06,ch*.62,xc+dd*cl,yc,zc,C.dark)}else if(cvv===2){box(g,cl,ch*1.25,ch*.95,xc,yc+ch*.12,zc,(q+lv)%2?C.plate:C.main);for(let r2=-1;r2<=1;r2++)box(g,cl*.9,.012,.012,xc,yc+ch*.12+r2*ch*.35,zc+sd*ch*.48,C.deep)}else box(g,cl,ch,ch*1.1,xc,yc,zc,(q+lv)%2?C.plate:C.main)}box(g,cl*.9,.02,ch*.95,a+cl*.55+q*(b-a)/Math.ceil(nC/2),p.cy+lv*ch*.95+ch*.5+.005,sd*(p.w*.5+ch*.6),C.deep);for(const dx of[-.42,.42])for(const dy of[-.5,.5])box(g,cl*.1,ch*.12,ch*.2,a+cl*.55+q*(b-a)/Math.ceil(nC/2)+dx*cl,p.cy+lv*ch*.95+dy*ch,sd*(p.w*.5+ch*.12),C.dark);if(!lv)box(g,cl*.5,ch*.15,ch*.7,a+cl*.55+q*(b-a)/Math.ceil(nC/2),p.cy,sd*(p.w*.5+ch*.1),C.main)}}
 else if(place.cargo){const [a,b]=place.cargo;for(let q=1;q<5;q++){const x=a+(b-a)*q/5,p=base(x);hex(g,.04,p.h*1.03,p.w*1.03,x,p.cy,0,C.deep,p.k)}}
 { const bx0=x1-span*.03,pb=base(bx0);claim('top',bx0-L*.11,bx0+L*.03,-pb.w*.4,pb.w*.4);
  const T0=inv.turrets,h0=Math.ceil(T0.length/2),a0=x0+span*.22,b0=x1-span*.08;for(let q=0;q<h0;q++)for(const sd of[-1,1]){const t=T0[q*2+(sd>0?0:1)];if(!t)continue;const x=a0+(b0-a0)*(h0===1?.5:q/(h0-1)),p=base(x),ts=(.2+.1*t.cal)*(t.t==='flak'?.8:1),S=ts*u,tz=sd*p.w*.5*p.k*.72;claim('top',x-.8*S,x+1.4*S,tz-.8*S,tz+.8*S);const pl=L*.085*ts+hh*.5;claim('side',x-pl*.8,x+pl*.8,0,1)}}
 // ракетные люки врезаны в палубу
 if(inv.msl>0){const rowsN=Math.ceil(inv.msl/2),pitch=Math.min(.34*u*2,span*.4/rowsN);for(let q=0;q<inv.msl;q++){const row=Math.floor(q/2),sd=q%2?1:-1,x=x0+span*.42+row*pitch,p=base(x);if(!isFree('top',x-pitch*.5,x+pitch*.5,sd*p.w*.2-pitch*.5,sd*p.w*.2+pitch*.5))continue;box(g,pitch*.8,.02,pitch*.8,x,p.cy+p.h/2+.004,sd*p.w*.2,C.deep);box(g,pitch*.5,.025,pitch*.5,x,p.cy+p.h/2+.007,sd*p.w*.2,C.dark)}}
 // орудия: ставятся на плечо корпуса (верхняя грань), парами; короткие стволы, низкая стойка с фаской
 const T=inv.turrets,half=Math.ceil(T.length/2),tx0=x0+span*.22,tx1=x1-span*.08;
 for(let q=0;q<half;q++)for(const sd of[-1,1]){const t=T[q*2+(sd>0?0:1)];if(!t)continue;const x=tx0+(tx1-tx0)*(half===1?.5:q/(half-1)),p=base(x),ts=(.2+.1*t.cal)*(t.t==='flak'?.8:1);
  const pw=(.35+.3*ts)*hh*1.6,pl=L*.085*ts+hh*.5,py=p.cy-p.h*.08;
  plate4(g,pl*1.5,pw,.05*u,pl*.55,x,py,sd*p.w*.3,C.main,sd);plate4(g,pl*.9,pw*.6,.04*u,pl*.3,x+pl*.1,py+.04*u,sd*p.w*.3,C.plate,sd);box(g,pl*.3,.05*u,pw*.2,x+pl*.9,py+.07*u,sd*(p.w*.3+pw*.55),C.dark);box(g,pl*.25,.03*u,pw*.15,x+pl*.45,py+.06*u,sd*(p.w*.3+pw*.3),C.deep); // палуба врастает в борт: корень внутри корпуса
  wedge(g,pl*1.3,p.h*.42,p.w*.36,x-pl*.05,py-p.h*.2,sd*p.w*.42,C.main,.35,.25); // обтекатель-подкос от борта под палубу
  const tz=sd*p.w*.5*p.k*.72,ty=p.cy+p.h/2;
  cyl(g,.05*u,.46*ts*u,x,ty+.012,tz,C.deep);hex(g,.07*u,.07*u,.9*ts*u,x,ty+.04*u,tz,C.dark,.8);for(const a of[0,1.5708,3.1416,4.7124])wedge(g,.22*ts*u,.1*u,.12*u,x+Math.cos(a)*.5*ts*u*1,ty+.03*u,tz+Math.sin(a)*.5*ts*u,C.main,.5,.4); // гнездо: колодец, кольцо-коллар и четыре кронштейна
  const gg=new THREE.Group();gg.position.set(x,ty+.08*u,tz);MOUNTS.push({x,y:ty+.08*u,z:tz,face:0,plat:true,tt:t.t,cal:t.cal});
  { const hpv=hp(q*2+(sd>0?0:1));if(hpv<=.5&&hpv>.15)gg.rotation.z=.3*(1-hpv*2);const S=ts*u,tv=V(100+(t.t==='rail'?0:t.t==='flak'?1:2)),brl=(len,r,y,z,x0=.1)=>add(gg,new THREE.CylinderGeometry(r*S,r*1.25*S,len*S,6).rotateZ(Math.PI/2),0x12151c,(x0+len/2)*S,y*S,z*S,0,false);
   add(gg,new THREE.CylinderGeometry(.24*S,.3*S,.1*S,6),C.dark,0,.05*S,0,0,true);
   if(hpv<=.15){add(gg,new THREE.IcosahedronGeometry(.2*S,0),0x1b1714,0,.12*S,0,0,true);add(gg,new THREE.BoxGeometry(.3*S,.08*S,.12*S),0x2a2622,.05*S,.25*S,0,0,true);add(gg,new THREE.SphereGeometry(.05*S,6,4),0xff6a1a,.1*S,.2*S,0,1,false)}
   else if(tv===0){add(gg,new THREE.SphereGeometry(.2*S,10,8),0x20252f,0,.17*S,0,0,false);if(t.t==='gat')brl(.5,.04,.19,0,.2);else{brl(.5,.035,.19,-.075,.2);brl(.5,.035,.19,.075,.2)}}
   else if(tv===1){add(gg,new THREE.BoxGeometry(.5*S,.2*S,.42*S),0x2a3040,0,.17*S,0,0,true);const sl=new THREE.BoxGeometry(.3*S,.12*S,.36*S);sl.rotateZ(.5);add(gg,sl,0x394258,.22*S,.27*S,0,0,true);
    if(t.t==='rail'){brl(.95,.05,.2,0,.25);add(gg,new THREE.BoxGeometry(.14*S,.1*S,.14*S),0x20252f,1.15*S,.2*S,0,0,true)}
    else if(t.t==='flak'){for(const yy of[.15,.25])for(const zz of[-.08,.08])brl(.4,.025,yy,zz,.25)}
    else{brl(.45,.03,.15,-.06,.25);brl(.45,.03,.15,.06,.25);brl(.45,.03,.24,0,.25)}}
   else{add(gg,new THREE.CylinderGeometry(.18*S,.3*S,.14*S,6),0x20252f,0,.15*S,0,0,true);for(const sd2 of[-1,1]){const ck=new THREE.BoxGeometry(.3*S,.14*S,.06*S);add(gg,ck,0x394258,0,.17*S,sd2*.26*S,0,true)}
    if(t.t==='rail'){for(const zz of[-.09,0,.09])brl(.38,.03,.18,zz,.2)}
    else if(t.t==='flak'){add(gg,new THREE.BoxGeometry(.4*S,.16*S,.34*S),0x2a3040,.1*S,.24*S,0,0,true);add(gg,new THREE.BoxGeometry(.04*S,.12*S,.28*S),C.or,.31*S,.24*S,0,1,false)}
    else{for(let k=0;k<6;k++){const an=k*1.047;brl(.42,.022,.19+Math.cos(an)*.05,Math.sin(an)*.05,.2)}}}}}
 wedge(g,span*.4,hh*.3,hh*.05,x0+span*.2,hh*.62,0,C.main,.25,.3);for(const sd of[-1,1])wedge(g,eL*1.4,eH*.5,eW*.08,-L/2+eL*.9,eH*.45,sd*eW*.55,C.plate,.2,.3);
 if(inv.armor>.45)for(const sd of[-1,1]){const p=base(x0+span*.5);wedge(g,span*.7,p.h*.25*inv.armor+hh*.08,hh*(.3+.3*inv.armor),x0+span*.5,p.cy+p.h*.4,sd*p.w*.36,C.main,.5,.5)}
 // скорость → стройный быстрый корпус; ракеты → широкие плечи с люками; тяжёлые орудия → передняя башенная палуба
 const sf=inv.eng.t/tons; if(sf>.2)for(const sd of[-1,1])wedge(g,eL*2.2,eH*.35,eW*.07,-L/2+eL*1.3,eH*.3,sd*(eW*.5),C.plate,.15,.3);
 if(inv.msl>=6){const p=base(x0+span*.5);for(const sd of[-1,1]){wedge(g,span*.5,p.h*.5,hh*.9,x0+span*.48,p.cy+p.h*.15,sd*(p.w*.5+hh*.25),C.main,.5,.55)}}
 const gunSum=inv.turrets.reduce((a,t)=>a+(t.t==='rail'?t.cal:0),0); if(gunSum>=8){const p=base(x1-span*.18),y0=p.cy+p.h*.5,sx=x1-span*.22;claim('top',sx-span*.16,sx+span*.14,-p.w*.8,p.w*.8);hex(g,span*.3,hh*.3,p.w*1.1,sx,y0+hh*.1,0,C.plate,.8);hex(g,span*.2,hh*.26,p.w*.78,sx-span*.02,y0+hh*.36,0,C.main,.75);hex(g,span*.1,hh*.22,p.w*.46,sx-span*.04,y0+hh*.6,0,C.dark,.7);for(const sd of[-1,1]){box(g,span*.22,hh*.1,.03*u,sx,y0+hh*.12,sd*p.w*.56,C.deep);box(g,span*.12,hh*.06,.02*u,sx+span*.04,y0+hh*.62,sd*p.w*.2,C.or,1)}}
 // лазер: ствол в оси, линза в носу
 if(inv.laser){add(g,new THREE.CylinderGeometry(hh*.1,hh*.1,L*.12,8).rotateZ(Math.PI/2),C.deep,x1+noseL*.9,-hh*.04,0,0,false);add(g,new THREE.SphereGeometry(hh*.1,10,8),C.glow,x1+noseL*.98,-hh*.04,0,1,false)}
 // мостик и радар врезаны в палубу перед носовым клином
 { const bx=x1-span*.03,p=base(bx);const bvr=V(2),by=p.cy+p.h/2;if(bvr===0){wedge(g,L*.04,p.h*.5,p.w*.55,bx,by+p.h*.12,0,C.bridge,.6,.6);box(g,L*.012,p.h*.1,p.w*.4,bx+L*.012,by+p.h*.2,0,C.or,1)}
  else if(bvr===1){box(g,L*.03,hh*.5,p.w*.4,bx-L*.005,by+hh*.25,0,C.bridge);box(g,L*.02,hh*.4,p.w*.28,bx-L*.008,by+hh*.7,0,C.plate);box(g,.012,hh*.14,p.w*.3,bx+L*.008,by+hh*.7,0,C.glow,1);box(g,L*.012,hh*.1,p.w*.3,bx-L*.008,by+hh*.95,0,C.dark)}
  else{hex(g,L*.04,hh*.3,p.w*.55,bx,by+hh*.12,0,C.bridge,.6);wedge(g,L*.022,hh*.25,p.w*.4,bx+L*.012,by+hh*.33,0,C.plate,.5,.3);box(g,.012,hh*.1,p.w*.3,bx+L*.028,by+hh*.3,0,C.glow,1)}
  radarTower(g,bx-L*.05,p.cy+p.h/2,L,hh*.5,tons,inv.radar,base,V(0),DM.radar||0) }

 // ДЕТАЛИ: косые углы, лезвия, плиты брони, мачты, жалюзи — всё растёт из корпуса
 { const rb=(len,h,w,x,y,z,col,ry=0,rz=0,e=0)=>{const geo=new THREE.BoxGeometry(len,h,w);geo.rotateZ(rz);geo.rotateY(ry);return add(g,geo,col,x,y,z,e)};
  const top=x=>{const p=base(x);return p.cy+p.h/2};
  // носовые лезвия: стреловидные плиты по бокам носа, вырастают из борта
  claim('side',-L/2,-L/2+eL*1.5,0,1);for(const sd of[-1,1]){const xb=x1-span*.02,p=base(xb);claim('side',xb-span*.1,xb+span*.14,0,1);{const bv2=V(6);plate4(g,span*[.2,.17,.26][bv2],hh*(1+ar*.6)*[1,.8,1.3][bv2],.03*u,span*[.12,-.05,.18][bv2],xb,p.cy-p.h*.05,sd*p.w*.36,C.plate,sd);if(bv2===1)plate4(g,span*.1,hh*.5,.025*u,-span*.03,xb-span*.1,p.cy-p.h*.05,sd*p.w*.36,C.main,sd)}
   plate4(g,span*.12,hh*.55,.025*u,span*.1,x1+noseL*.2,base(x1+noseL*.2).cy,sd*base(x1+noseL*.2).w*.3,C.main,sd)}
  // спинной гребень (хвост) и килевой плавник
  {const sv=V(7);if(sv===0)wedge(g,span*.28,hh*.75,.035*u,x0+span*.1,top(x0+span*.1)+hh*.15,0,C.plate,.15,.2);else if(sv===1){for(const dd of[.05,.2])wedge(g,span*.12,hh*.6,.035*u,x0+span*dd,top(x0+span*dd)+hh*.1,0,C.plate,.2,.2)}else wedge(g,span*.13,hh*1.25,.04*u,x0+span*.1,top(x0+span*.1)+hh*.3,0,C.plate,.3,.15)}
  wedge(g,span*.22,hh*.5,.03*u,x0+span*.3,base(x0+span*.3).cy-base(x0+span*.3).h*.5-hh*.1,0,C.dark,.3,.2);
  // косые бортовые плиты брони с рёбрами
  const nS=3+Math.round(ar*3);for(let q=0;q<nS;q++){const sl=span*(.13-.02*ar),x=fit('side',x0+span*(.12+.76*q/(nS-1||1)),sl,0,1);if(x==null)continue;claim('side',x-sl/2,x+sl/2,0,1);const p=base(x);for(const sd of[-1,1]){rb(sl,p.h*.5,.025*u,x,p.cy+p.h*.12,sd*(p.w*.5*(1+p.k)*.5+.01),q%2?C.plate:C.main,sd*.1,0);rb(sl*.6,.02,.03*u,x,p.cy+p.h*.12+p.h*.28,sd*(p.w*.5*(1+p.k)*.5+.02),C.or,sd*.1,0,1)}}
  // жалюзи охлаждения у кормы и на боках
  for(let q=0;q<6;q++){const x=x0+span*.04+q*span*.012,p=base(x);for(const sd of[-1,1])box(g,span*.007,p.h*.35,.02*u,x,p.cy-p.h*.12,sd*(p.w*.5+.003),C.deep)}
  // мачты связи с огоньками, косые сенсорные блоки на гребне
  for(const [f,hm] of[[.18,.9],[.55,.6],[.8,.7]]){const zm=(f>.5?1:-1)*base(x0+span*f).w*.12,x=fit('top',x0+span*f,.08*u,zm-.04*u,zm+.04*u);if(x==null)continue;claim('top',x-.04*u,x+.04*u,zm-.04*u,zm+.04*u);const y=top(x);add(g,new THREE.CylinderGeometry(.006*u,.01*u,hh*hm,4),0x9aa5bd,x,y+hh*hm/2,(f>.5?1:-1)*base(x).w*.12,0,false);box(g,.03*u,.03*u,.03*u,x,y+hh*hm,(f>.5?1:-1)*base(x).w*.12,C.glow,1)}
  for(const f of[.3,.68]){const p0=base(x0+span*f),x=fit('top',x0+span*f,span*.07,-p0.w*.12,p0.w*.12);if(x==null)continue;claim('top',x-span*.035,x+span*.035,-p0.w*.12,p0.w*.12);const y=top(x),p=base(x);rb(span*.06,hh*.22,p.w*.22,x,y+hh*.08,0,C.dark,.35,0);rb(span*.035,hh*.1,p.w*.12,x+span*.01,y+hh*.2,0,C.plate,-.35,0)}
  // огни по краям: красный слева, зелёный справа
  const pn=base(x1-span*.02);box(g,.04*u,.03*u,.04*u,x1-span*.02,pn.cy,-pn.w*.5-.01,0xff3b3b,1);box(g,.04*u,.03*u,.04*u,x1-span*.02,pn.cy,pn.w*.5+.01,0x3bff6a,1)}

 // РЕЛЬЕФ: никаких голых плоскостей — на палубе и бортах блоки, надстройки, пояса брони, рёбра разной высоты (с учётом занятости)
 let GP0=null;
 { const gp=gapIn('side',x0+span*.02,x1+noseL*.3,0,1,span*.07);if(gp){const nl=Math.min(span*.17,(gp.b-gp.a)*.9),xn=(gp.a+gp.b)/2;GP0={a:xn-nl*.56,b:xn+nl*.56};claim('side',GP0.a,GP0.b,0,1)}
  let s2=(inv.seed||7)*7919+13;const r2=()=>{s2=(s2*16807)%2147483647;return s2/2147483647};
  const sd0=()=>r2()<.5?-1:1;
  const cl2=[C.plate,C.main,C.dark,C.deep,0x566178,C.plate];let pl=0;
  for(let a=0;a<420&&pl<90;a++){const x=x0+span*(.03+.92*r2()),p=base(x),ln=hh*(.3+r2()*1.2),wd=hh*(.18+r2()*.5),ht=hh*(.05+r2()*(r2()<.3?.45:.15)),zc=(.1+.72*r2())*p.w*p.k*.5,ty=p.cy+p.h/2,col=cl2[Math.floor(r2()*cl2.length)],kind=r2();
   if(!isFree('top',x-ln/2,x+ln/2,-zc-wd/2,-zc+wd/2)||!isFree('top',x-ln/2,x+ln/2,zc-wd/2,zc+wd/2))continue;
   for(const sd of(r2()<.55?[-1,1]:[sd0()])){const z=sd*zc;claim('top',x-ln/2,x+ln/2,z-wd/2,z+wd/2);const y=ty+ht/2-.01*u;
    if(kind<.5)box(g,ln,ht,wd,x,y,z,col);else if(kind<.72)hex(g,ln,ht,wd,x,y,z,col,.7);else if(kind<.88)wedge(g,ln,ht,wd,x,y,z,col,.4,.4);else{cyl(g,ht*1.4,wd*.35,x,ty+ht*.7,z,C.dark);}
    if(kind<.5&&r2()<.4)box(g,ln*.5,ht*.5,wd*.6,x+ln*.1,y+ht*.7,z,C.dark)}pl++}
  let pb=0;for(let a=0;a<700&&pb<100;a++){const x=x0+span*(.03+.92*r2()),p=base(x),h2=p.h/2,ln=hh*(.5+r2()*2.4),lh=hh*(.1+r2()*.22),yy=p.cy+(r2()-.5)*p.h*.7,th=hh*(.05+r2()*.1),kk=p.k||.62;
   if((GP0&&x+ln/2>GP0.a&&x-ln/2<GP0.b)||!isFree('s2',x-ln/2,x+ln/2,yy-lh/2,yy+lh/2))continue;claim('s2',x-ln/2,x+ln/2,yy-lh/2,yy+lh/2);
   const zs=p.w/2*(1-(1-kk)*Math.min(1,Math.abs(yy-p.cy)/h2)),col=cl2[Math.floor(r2()*cl2.length)];
   for(const sd of[-1,1]){box(g,ln,lh,th,x,yy,sd*(zs+th*.35),col);if(r2()<.5)box(g,ln*.6,lh*.4,th*.8,x+ln*.1,yy,sd*(zs+th*.9),C.deep)}pb++}
 }
 // ЛИВРЕЯ: цвет и номер берутся из проекта; полосы идут по профилю палубы
 { const col=hexs(inv.col||0xff7a3c),topY=x=>{const p=base(x);return p.cy+p.h/2+.006};
  { const gp=GP0;if(gp){const nl=Math.min(span*.17,(gp.b-gp.a)*.9),xn=(gp.a+gp.b)/2,pn=base(xn);for(const sd of[-1,1]){const m=new THREE.Mesh(new THREE.PlaneGeometry(nl,nl*.5),new THREE.MeshBasicMaterial({map:numTex(inv.id||'00','#f2f4f8'),transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2}));m.rotation.y=sd>0?0:Math.PI;m.position.set(xn,pn.cy,sd*(pn.w*.5+.004));g.add(m)}}}
  if(inv.hang>0&&place.hang){const [a,b]=place.hang,p=base((a+b)/2);{const gp=gapIn('top',a,b,-p.w*.15,p.w*.15,(b-a)*.2);if(gp){const cl2=Math.min(gp.b-gp.a,(b-a)*.7),xc=(gp.a+gp.b)/2;dec(g,chevTex(col),xc,topY(xc),0,cl2,p.w*.3,0)}}}
  if(inv.eng.n>0){const p=base(-L/2+eL*.5);dec(g,hazTex('#111','#ffd23a'),-L/2+eL*.5,topY(-L/2+eL*.5),0,eL*.7,p.w*.2,0)}
  if(place.tank&&bigT){const [a,b]=place.tank,p=base((a+b)/2),rr=Math.min(hh*.75,Math.cbrt(inv.tank)*.075),n=inv.tank>300?2:1,cl=(b-a)*.95;for(const sd of[-1,1])for(let q=0;q<n;q++){const zz=sd*(p.w*.5+rr*(1.1+q*2)),yy=p.cy+(q?rr*.3:0),ty=yy+rr*.866+.004,xm=(a+b)/2;
   dec(g,hazTex('#111','#ffd23a'),xm-cl*.36,ty,zz,cl*.14,rr*.9,0);dec(g,hazTex('#111','#ffd23a'),xm+cl*.36,ty,zz,cl*.14,rr*.9,0);
   dec(g,numTex(inv.id||'T','#f2f4f8'),xm,ty,zz+sd*rr*.001,0.001,0.001,0)}
   for(const sd of[-1,1]){const zz=sd*(p.w*.5+rr*1.1),yy=p.cy;for(const f of[-.2,.2])cyl(g,cl*.025,rr*1.06,(a+b)/2+f*cl,yy,zz,inv.col||0xff7a3c)}}
  if(place.cargo&&bigC){const [a,b]=place.cargo,p=base((a+b)/2),nC=Math.max(3,Math.round(inv.cargo/60)),ch=hh*.95,pal=['#d9463c','#3c82d9','#e0a63a','#4aa56a','#c9ccd4'];for(let q=0;q<Math.ceil(nC/2);q++)for(const sd of[-1,1]){const cc=pal[(q*2+(sd>0?1:0))%5],cl=(b-a)/Math.ceil(nC/2)*.92;dec(g,tex('p'+cc,8,8,(x2,w,h)=>{x2.fillStyle=cc;x2.fillRect(0,0,w,h)}),a+cl*.55+q*(b-a)/Math.ceil(nC/2),p.cy+ch*.5+.012,sd*(p.w*.5+ch*.6),cl*.7,ch*.45,0)}}
 }
 g.userData.L=L;g.userData.pack={base,segs,place,x0,x1,span,noseL,L,hh,u,eL,eH,eW,MOUNTS,NOZ,isFree,claim,fit,tons,bigT,bigC};return g}

// ===================== запечка и интерфейс для игры =====================
const edgeMatB = new THREE.LineBasicMaterial({ color: 0x0a0d14, transparent: true, opacity: .35 });
export const loftMats = {
  hull: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .25, flatShading: true, envMapIntensity: 3.2 }),
  parts: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .25, flatShading: true, envMapIntensity: 3.2 }),
  glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  lines: edgeMatB,
};

// ===== трипланарная детальная обшивка для навесных деталей: плиты, клинья, башни получают панели, швы и огни, а не плоский цвет =====
let _tileTex: THREE.CanvasTexture | null = null;
function tileGreeble() {
  if (_tileTex) return _tileTex;
  const S = 1024, c = document.createElement('canvas'); c.width = c.height = S; const x = c.getContext('2d')!; x.fillStyle = '#cfd3da'; x.fillRect(0, 0, S, S);
  let sq = 5; const rn = () => { sq = (sq * 16807) % 2147483647; return sq / 2147483647 };
  const n = 8, cs = S / n;
  for (let r = 0; r < n; r++) for (let q = 0; q < n; q++) {
    const px = q * cs, py = r * cs, tone = rn(), kind = rn(), g = Math.floor(120 + tone * 110);
    x.fillStyle = `rgba(${g},${g + 3},${g + 10},.6)`; x.fillRect(px, py, cs, cs);
    // вложенные панели: кромка, внутреннее поле, фаска
    const m = cs * .07; x.fillStyle = `rgba(${g - 30},${g - 28},${g - 18},.7)`; x.fillRect(px + m, py + m, cs - 2 * m, cs - 2 * m);
    x.fillStyle = 'rgba(255,255,255,.4)'; x.fillRect(px + m, py + m, cs - 2 * m, 4); x.fillRect(px + m, py + m, 4, cs - 2 * m);
    x.fillStyle = 'rgba(0,0,0,.45)'; x.fillRect(px + m, py + cs - m - 4, cs - 2 * m, 4); x.fillRect(px + cs - m - 4, py + m, 4, cs - 2 * m);
    x.fillStyle = 'rgba(8,10,16,.9)'; x.fillRect(px, py, cs, 3); x.fillRect(px, py, 3, cs);
    if (kind < .2) { for (let k = 0; k < 5; k++) { x.fillStyle = 'rgba(8,10,14,.9)'; x.fillRect(px + cs * .2, py + cs * (.22 + k * .12), cs * .6, cs * .06) } }
    else if (kind < .32) { x.fillStyle = 'rgba(20,24,34,.8)'; x.fillRect(px + cs * .25, py + cs * .25, cs * .5, cs * .5); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(px + cs * .25, py + cs * .25, cs * .5, 3) }
    else if (kind < .35) { x.fillStyle = '#e8c53a'; x.fillRect(px + 8, py + 8, cs - 16, cs - 16); x.fillStyle = '#14161b'; for (let k = -cs; k < cs; k += 28) { x.beginPath(); x.moveTo(px + 8 + k, py + cs - 8); x.lineTo(px + 8 + k + 14, py + cs - 8); x.lineTo(px + 8 + k + 14 + cs, py + 8); x.lineTo(px + 8 + k + cs, py + 8); x.fill() } x.clearRect(0, 0, 0, 0) }
    else if (kind < .5) { for (let k = 0; k < 5; k++) { x.fillStyle = rn() < .7 ? '#fff3c4' : '#d8f6ff'; x.fillRect(px + cs * (.15 + k * .16), py + cs * .5, 7, 7) } }
    else if (kind < .6) { x.fillStyle = 'rgba(255,255,255,.2)'; x.fillRect(px + cs * .15, py + cs * .15, cs * .7, cs * .7); x.fillStyle = 'rgba(0,0,0,.35)'; x.beginPath(); x.arc(px + cs * .5, py + cs * .5, cs * .16, 0, 6.2832); x.fill() }
  }
  const t2 = new THREE.CanvasTexture(c); t2.wrapS = t2.wrapT = THREE.RepeatWrapping; t2.colorSpace = THREE.SRGBColorSpace; t2.anisotropy = 4; _tileTex = t2; return t2;
}
const _triCache = new Map<string, THREE.MeshStandardMaterial>();
export function triMat(tile: number) {
  const key = tile.toPrecision(2); let m = _triCache.get(key); if (m) return m;
  m = loftMats.parts.clone(); const u = { value: tile };
  m.onBeforeCompile = (sh: any) => {
    sh.uniforms.uTile = u; sh.uniforms.uGr = { value: tileGreeble() };
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP=position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;uniform float uTile;uniform sampler2D uGr;')
      .replace('#include <map_fragment>', '#include <map_fragment>\nvec3 an=abs(normalize(cross(dFdx(vOP),dFdy(vOP))));vec3 tw=pow(an,vec3(8.));tw/=tw.x+tw.y+tw.z;vec3 tp=vOP*uTile;diffuseColor.rgb*=texture2D(uGr,tp.yz).rgb*tw.x+texture2D(uGr,tp.xz+.37).rgb*tw.y+texture2D(uGr,tp.xy+.71).rgb*tw.z;');
  };
  m.customProgramCacheKey = () => 'tri';
  _triCache.set(key, m); return m;
}

// склеивает все меши группы в 3 геометрии (корпус остаётся отдельно: у него UV и раны), декали остаются отдельными плоскостями
export function bakeGroup(grp: THREE.Group) {
  grp.updateMatrixWorld(true);
  const P: THREE.BufferGeometry[] = [], Gl: THREE.BufferGeometry[] = [], Ln: number[] = [], dec: THREE.Mesh[] = []; let hull: THREE.Mesh | null = null;
  const col = new THREE.Color();
  grp.traverse((o: any) => {
    if (o === grp) return;
    if (o.isMesh) {
      if (o.userData.hull) { hull = o; return }
      const mat = o.material; if (mat.map) { dec.push(o); return }
      const ge = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); ge.applyMatrix4(o.matrixWorld);
      const n = ge.attributes.position.count, arr = new Float32Array(n * 3); col.copy(mat.color);
      const em = mat.emissiveIntensity > 0, f = em ? 1.25 : 1;
      for (let i = 0; i < n; i++) { arr[i * 3] = col.r * f; arr[i * 3 + 1] = col.g * f; arr[i * 3 + 2] = col.b * f }
      const out = new THREE.BufferGeometry(); out.setAttribute('position', ge.attributes.position.clone()); out.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      (em ? Gl : P).push(out); ge.dispose();
    } else if (o.isLineSegments) {
      const pa = o.geometry.attributes.position, v = new THREE.Vector3();
      for (let i = 0; i < pa.count; i++) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); Ln.push(v.x, v.y, v.z) }
    }
  });
  const mg = (a: THREE.BufferGeometry[]) => a.length ? mergeGeometries(a, false) : null;
  let lines: THREE.BufferGeometry | null = null; if (Ln.length) { lines = new THREE.BufferGeometry(); lines.setAttribute('position', new THREE.Float32BufferAttribute(Ln, 3)) }
  return { hull, parts: mg(P), glow: mg(Gl), lines, decals: dec };
}

// проект → описание груза для генератора; доли масс сохраняются, абсолютный тоннаж приводится к рабочему диапазону генератора
export function invFromSpec(s: any, mp: any, D0: any, P: any, seed: number, hasRadar: boolean, id: string) {
  const pt = mp.parts, T = Math.max(1, mp.T), tot = Math.max(1, Object.values(pt).reduce((a: number, b: any) => a + (+b || 0), 0));
  const Pt = Math.max(30, Math.min(900, Math.pow(T / 40, .62) * 4)), F = Pt / tot, sp = s.spec || {};
  const tur: any[] = [], rc = sp.railCfg || [];
  const calOf = (c: number) => c <= 8 ? 1 : c <= 14 ? 2 : 3;
  for (let i = 0; i < Math.min(sp.rails || 0, 8); i++) tur.push({ t: 'rail', cal: calOf((rc[i] && rc[i].cal) || 10) });
  for (let i = 0; i < Math.min(sp.flak || 0, 4); i++) tur.push({ t: 'flak', cal: 1 });
  for (let i = 0; i < Math.min(sp.gat || sp.gats || (pt.gat > 0 ? 2 : 0), 4); i++) tur.push({ t: 'gat', cal: 1 });
  while (tur.length > 12) tur.splice(Math.floor(tur.length / 2), 1);
  const cab = ((pt.crew || 0) + (pt.mar || 0)) * F, hang = ((pt.hangF || 0) + (pt.hangB || 0)) * F, cargoRaw = (pt.frame || 0) * F;
  const eN = Math.max(1, Math.min(9, D0.ne || 1));
  return {
    eng: { n: eN, t: Math.max(6, (pt.eng || 0) * F) }, reac: Math.max(4, (pt.reactor || 0) * F), tank: Math.max(5, (pt.tank || 0) * F), cab: Math.max(3, cab), mag: (pt.core || 0) * F * .5 + (pt.miss || 0) * F * .3,
    hang, cargo: cargoRaw * .6, armor: Math.max(.05, Math.min(1, (mp.armor || 0) / T * 2.2)), turrets: tur, msl: Math.min(24, (sp.miss || 0) * 2), laser: pt.laser > 0 ? 1 : 0, radar: hasRadar ? 1 : 0,
    seed: (seed >>> 0) % 997 + 3, col: P.acc2, id,
  };
}

export type LoftPack = { key: string; k: number; hull: THREE.BufferGeometry; li: any; parts: THREE.BufferGeometry | null; glow: THREE.BufferGeometry | null; lines: THREE.BufferGeometry | null; decals: THREE.Mesh[]; partsMat: THREE.MeshStandardMaterial; seedv: number; mat: THREE.MeshStandardMaterial; base: any; mounts: any[]; nozz: any[]; seg: any[]; W: number; H: number; x0: number; x1: number; Lk: number; wd: any; L0: number };
const cache = new Map<string, LoftPack>();
export function buildLoft(inv: any, Lgame: number): LoftPack {
  const key = JSON.stringify(inv) + '|' + Math.round(Lgame * 1e5);
  const hit = cache.get(key); if (hit) return hit;
  const g = ship(inv, null), pk = g.userData.pack, wd = g.userData.wd, k = Lgame / pk.L;
  const b = bakeGroup(g);
  const hull = b.hull!.geometry as THREE.BufferGeometry, li = b.hull!.userData.li; hull.scale(k, k, k); li.k = k; hull.computeBoundingSphere();
  for (const q of [b.parts, b.glow, b.lines]) if (q) q.scale(k, k, k);
  for (const d of b.decals) { d.position.multiplyScalar(k); d.scale.multiplyScalar(k) }
  const sc = (m: any) => ({ ...m, x: m.x * k, y: m.y * k, z: m.z * k });
  const mounts = pk.MOUNTS.map(sc);
  // дополнительные точки крепления: по палубе и бортам в свободных местах (реестр занятости)
  const base = pk.base, span = pk.span, x0 = pk.x0, x1 = pk.x1, L = pk.L, hh = pk.hh;
  const extra: any[] = [];
  const step = Math.max(L * .018, hh * .35);
  for (let x = x0 + span * .04; x < x1 + pk.noseL * .3; x += step) {
    const p = base(x);
    for (const fz of [-.62, -.32, 0, .32, .62]) {
      const z = fz * p.w * .5 * p.k, fp = step * .45;
      if (!pk.isFree('top', x - fp, x + fp, z - fp, z + fp)) continue;
      extra.push({ x, y: p.cy + p.h / 2, z, face: 0, sm: false, pr: Math.abs(fz) + Math.abs(x - (x0 + x1) / 2) / span * .3 });
    }
    for (const sd of [-1, 1]) {
      if (!pk.isFree('side', x - step * .45, x + step * .45, 0, 1)) continue;
      extra.push({ x, y: p.cy, z: sd * p.w * .5, face: sd > 0 ? 1 : 3, sm: false, pr: 2 + Math.abs(x - (x0 + x1) / 2) / span });
    }
  }
  extra.sort((a, c) => a.pr - c.pr);
  for (const e of extra.slice(0, 220)) mounts.push(sc(e));
  const seg = pk.segs.map((q: any) => ({ cx: (q.a + q.b) / 2 * k, top: (q.cy + q.h / 2) * k, w: q.w * k, len: (q.b - q.a) * k, h: q.h * k, cy: q.cy * k, col: C.main }));
  let W = 0, H = 0; for (const q of seg) { W = Math.max(W, q.w); H = Math.max(H, q.h) }
  const pm = base((x0 + x1) / 2), fwd = Math.hypot(pm.h / 2, pm.w * (1 - pm.k) / 2), gb = makeGreeble(x1 + pk.noseL + L / 2, hh, [pm.w * pm.k, fwd, fwd, pm.w * pm.k, fwd, fwd]);
  const mat = loftMats.hull.clone(); mat.map = gb.tm; mat.emissiveMap = gb.te; mat.emissive = new THREE.Color(1, 1, 1); mat.emissiveIntensity = 1.0; mat.bumpMap = gb.tb; mat.bumpScale = 1.5;
  const out: LoftPack = { key, k, hull, li, partsMat: triMat(1 / (hh * k * 1.3)), seedv: inv.seed, mat, base: gb, parts: b.parts, glow: b.glow, lines: b.lines, decals: b.decals, mounts, nozz: pk.NOZ.map((n: any) => ({ y: n.y * k, z: n.z * k, r: n.r * k })), seg, W, H, x0: -L / 2 * k, x1: (x1 + pk.noseL) * k, Lk: (x1 + pk.noseL + L / 2) * k, wd, L0: L };
  cache.set(key, out); if (cache.size > 24) cache.delete(cache.keys().next().value as string);
  return out;
}

// пробоины: ломаный мир-к-пакету; рисуются обломки и эмиттеры (пар/огонь/хладагент/искры) для списка попаданий
export function buildWoundFx(pk: LoftPack, hits: any[]) {
  const Hs = pk.wd.mkH(hits), k = pk.k;
  const fx = woundFx(Hs, pk.wd.base, pk.wd.hh, pk.wd.u);
  const b = bakeGroup(fx);
  const grp = new THREE.Group(); grp.scale.setScalar(k);
  const meshes: THREE.Mesh[] = [];
  if (b.parts) { const m = new THREE.Mesh(b.parts, triMat(1 / (pk.wd.hh * k * 1.3))); m.frustumCulled = false; grp.add(m); meshes.push(m) }
  if (b.glow) { const m = new THREE.Mesh(b.glow, loftMats.glow); m.frustumCulled = false; grp.add(m); meshes.push(m) }
  const pts: THREE.Points[] = []; fx.children.forEach((o: any) => { if (o.isPoints) { grp.add(o); pts.push(o) } });
  grp.userData.upd = fx.userData.upd; grp.userData.uS = fx.userData.uS;
  grp.userData.dispose = () => { meshes.forEach(m => m.geometry.dispose()); pts.forEach(p => { p.geometry.dispose(); (p.material as any).dispose() }) };
  return grp;
}
export { makeWoundTex };

// положение раны на шестиграннике: угол вокруг оси (z=cos, y=sin) → координата грани v ∈ [0,6)
export function faceV(pk: LoftPack, x: number, ang: number) {
  const p = pk.wd.base(x / pk.k), hw = p.w / 2, h2 = p.h / 2, kk = p.k || .62;
  const R = [[p.cy + h2, -hw * kk], [p.cy + h2, hw * kk], [p.cy, hw], [p.cy - h2, hw * kk], [p.cy - h2, -hw * kk], [p.cy, -hw]];
  const dy = Math.sin(ang), dz = Math.cos(ang); let best = 0, bt = 0, bs = 1e9;
  for (let j = 0; j < 6; j++) { const a = R[j], c = R[(j + 1) % 6], ey = c[0] - a[0], ez = c[1] - a[1], den = dy * ez - dz * ey; if (Math.abs(den) < 1e-9) continue;
    const s = ((a[0] - p.cy) * ez - a[1] * ey) / den, t = ((a[0] - p.cy) * dz - a[1] * dy) / den; if (s > 0 && t >= -1e-6 && t <= 1 + 1e-6 && s < bs) { bs = s; best = j; bt = Math.max(0, Math.min(1, t)) } }
  return best + bt;
}

// башня в том же стиле, что и корпус: 3 варианта на тип орудия, стволы вдоль +x, начало — на основании; возвращает склеенные геометрии и кончики стволов
export function turretGeo(tt: string, cal: number, seed: number, S: number, hp0 = 1) {
  const gg = new THREE.Group(), tips: any[] = [], t = { t: tt, cal };
  const V = (k: number) => { const v = Math.sin((seed || 7) * 12.9898 + k * 78.233) * 43758.5453; return Math.floor((v - Math.floor(v)) * 3) };
  { const hpv=hp0,tv=V(100+(t.t==='rail'?0:t.t==='flak'?1:2)),brl=(len,r,y,z,x0=.1)=>{tips.push({x:(x0+len)*S+.12*S,y:y*S,z:z*S});return add(gg,new THREE.CylinderGeometry(r*S,r*1.25*S,len*S,6).rotateZ(Math.PI/2),0x12151c,(x0+len/2)*S,y*S,z*S,0,false)};
   add(gg,new THREE.CylinderGeometry(.24*S,.3*S,.1*S,6),C.dark,0,.05*S,0,0,true);
   if(hpv<=.15){add(gg,new THREE.IcosahedronGeometry(.2*S,0),0x1b1714,0,.12*S,0,0,true);add(gg,new THREE.BoxGeometry(.3*S,.08*S,.12*S),0x2a2622,.05*S,.25*S,0,0,true);add(gg,new THREE.SphereGeometry(.05*S,6,4),0xff6a1a,.1*S,.2*S,0,1,false)}
   else if(tv===0){add(gg,new THREE.SphereGeometry(.2*S,10,8),0x20252f,0,.17*S,0,0,false);if(t.t==='gat')brl(.5,.04,.19,0,.2);else{brl(.5,.035,.19,-.075,.2);brl(.5,.035,.19,.075,.2)}}
   else if(tv===1){add(gg,new THREE.BoxGeometry(.5*S,.2*S,.42*S),0x2a3040,0,.17*S,0,0,true);const sl=new THREE.BoxGeometry(.3*S,.12*S,.36*S);sl.rotateZ(.5);add(gg,sl,0x394258,.22*S,.27*S,0,0,true);
    if(t.t==='rail'){brl(.95,.05,.2,0,.25);add(gg,new THREE.BoxGeometry(.14*S,.1*S,.14*S),0x20252f,1.15*S,.2*S,0,0,true)}
    else if(t.t==='flak'){for(const yy of[.15,.25])for(const zz of[-.08,.08])brl(.4,.025,yy,zz,.25)}
    else{brl(.45,.03,.15,-.06,.25);brl(.45,.03,.15,.06,.25);brl(.45,.03,.24,0,.25)}}
   else{add(gg,new THREE.CylinderGeometry(.18*S,.3*S,.14*S,6),0x20252f,0,.15*S,0,0,true);for(const sd2 of[-1,1]){const ck=new THREE.BoxGeometry(.3*S,.14*S,.06*S);add(gg,ck,0x394258,0,.17*S,sd2*.26*S,0,true)}
    if(t.t==='rail'){for(const zz of[-.09,0,.09])brl(.38,.03,.18,zz,.2)}
    else if(t.t==='flak'){add(gg,new THREE.BoxGeometry(.4*S,.16*S,.34*S),0x2a3040,.1*S,.24*S,0,0,true);add(gg,new THREE.BoxGeometry(.04*S,.12*S,.28*S),C.or,.31*S,.24*S,0,1,false)}
    else{for(let k=0;k<6;k++){const an=k*1.047;brl(.42,.022,.19+Math.cos(an)*.05,Math.sin(an)*.05,.2)}}}
}
  if (hp0 <= .5 && hp0 > .15) gg.rotation.z = .3 * (1 - hp0 * 2);
  if (!tips.length) tips.push({ x: .45 * S, y: .22 * S, z: 0 });
  const b = bakeGroup(gg); return { parts: b.parts, glow: b.glow, lines: b.lines, tips, mat: triMat(1 / (S * 1.7)) };
}
