// @ts-nocheck
// Модульный корабль «хребет»: секции корпуса, двигатели, носовые орудия, турели, баки/ангары, краска; повреждения в геометрии, дыры, провода, обломки.
import * as THREE from 'three';
import { toCreasedNormals, mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
let P:any={};
const mk=(c,m,r)=>new THREE.MeshPhysicalMaterial({color:c,metalness:m,roughness:r,flatShading:true,envMapIntensity:1.1,side:THREE.DoubleSide});
let silver:any,silver2:any,steel:any,accent:any;const dark=mk(0x242a37,.7,.5);
const glowM=new THREE.MeshBasicMaterial({color:0xcfe8ff,toneMapped:false}),cyan=new THREE.MeshBasicMaterial({color:0x6fe3ff,toneMapped:false});
const plumeM=new THREE.MeshBasicMaterial({color:0x7fb8ff,transparent:true,opacity:.42,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide});

function newHU(){return {uHits:{value:Array.from({length:64},()=>new THREE.Vector4(0,0,0,1e-3))},uNH:{value:0},sh:{value:new THREE.Matrix4()},hoA:{value:Array.from({length:16},()=>new THREE.Vector4(1,0,0,1))},hoB:{value:Array.from({length:16},()=>new THREE.Vector4(0,1,0,1))},hoC:{value:Array.from({length:16},()=>new THREE.Vector4(0,0,0,0))},nHo:{value:0}}}
let CURHU:any=newHU(),hullM:any,innerM:any;
function weather(m,k,hit,holes){const HU=CURHU;m.onBeforeCompile=sh=>{sh.uniforms.uSh=HU.sh;sh.uniforms.uHits=HU.uHits;sh.uniforms.uNH=hit===false?{value:0}:HU.uNH;sh.uniforms.uHoA=HU.hoA;sh.uniforms.uHoB=HU.hoB;sh.uniforms.uHoC=HU.hoC;sh.uniforms.uNHo=holes?HU.nHo:{value:0};
 sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform mat4 uSh;').replace('#include <begin_vertex>','#include <begin_vertex>\nvWP=(uSh*modelMatrix*vec4(transformed,1.)).xyz;');
 sh.fragmentShader=sh.fragmentShader.replace('#include <common>','#include <common>\nvarying vec3 vWP;uniform vec4 uHits[64];uniform int uNH;uniform vec4 uHoA[16],uHoB[16],uHoC[16];uniform int uNHo;\nfloat h31(vec3 p){p=fract(p*.1031);p+=dot(p,p.yzx+33.33);return fract((p.x+p.y)*p.z);}\nfloat vn(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z);}\nfloat fbm(vec3 p){return vn(p)*.55+vn(p*2.3)*.3+vn(p*5.1)*.15;}\n').replace('#include <color_fragment>',`#include <color_fragment>
 float rimAcc=0.;
 for(int hj=0;hj<16;hj++){if(hj>=uNHo)break;vec3 rl=vWP-uHoC[hj].xyz;float uu=dot(rl,uHoA[hj].xyz)/uHoA[hj].w,ww=dot(rl,uHoB[hj].xyz)/uHoB[hj].w;float dd=length(vec2(uu,ww));dd/=1.+.55*(fbm(rl*.45+uHoC[hj].w*7.)-.5)+.3*(fbm(rl*1.4+3.)-.5)+.12*(fbm(rl*4.)-.5);
  if(dd<uHoC[hj].w)discard;rimAcc=max(rimAcc,1.-smoothstep(.0,.2,dd-uHoC[hj].w));}
 vec3 q=vWP+vec3(${k}.);
 vec3 big=floor(q/vec3(26.,15.,15.));float hz=h31(big+1.7);
 vec3 pal=vec3(1.);
 if(hz<.12)pal=vec3(.55,.68,.95);else if(hz<.24)pal=vec3(.3,.38,.6);else if(hz<.34)pal=vec3(1.05,.8,.62);else if(hz<.44)pal=vec3(.55,.95,.95);else if(hz<.54)pal=vec3(.85,.9,.7);else if(hz<.62)pal=vec3(1.0,.62,.58);else if(hz<.72)pal=vec3(1.15,1.15,1.1);
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*pal,.8);
 vec3 sz=vec3(7.,4.8,4.8);vec3 cl=floor(q/sz);
 vec3 tintc=vec3(h31(cl),h31(cl+3.1),h31(cl+6.2));diffuseColor.rgb*=1.+(tintc-.5)*.22;
 // три уровня швов: 26 / 7 / 2.4
 float ln=0.;
 for(int lv=0;lv<3;lv++){vec3 s3=lv==0?vec3(26.,15.,15.):(lv==1?sz:vec3(2.4,1.8,1.8));vec3 fr=fract(q/s3);vec3 d3=min(fr,1.-fr)*s3;float e=min(d3.x,min(d3.y,d3.z));float w=lv==0?.2:(lv==1?.11:.05);ln=max(ln,(1.-smoothstep(w*.4,w,e))*(lv==2?.55:1.));}
 diffuseColor.rgb*=1.-ln*.62;
 // тонкие светлые «травленые» линии вдоль корпуса и поперечные пояса
 float lite=(1.-smoothstep(.0,.05,abs(fract(q.y*.55+q.z*.55)-.5)))*step(.6,h31(cl+9.))*.35;diffuseColor.rgb+=lite;
 float band=1.-smoothstep(.0,.07,abs(fract(q.y/9.+hz)-.5)-.38);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.88,.45,.12),band*step(.7,hz)*.7);
 // шевронные полосы предупреждения на части ячеек
 float hzd=step(.975,h31(cl+4.4));float ch=step(.5,fract((q.x+q.y+q.z)*.5));diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.08),vec3(.95,.7,.1),ch),hzd*.9);
 // заклёпки
 vec2 rv=vec2(fract(q.x*.9),fract((q.y+q.z)*.9))-.5;float riv=1.-smoothstep(.07,.13,length(rv));diffuseColor.rgb*=1.+riv*step(.5,h31(cl+2.))*.25;
 float scr=h31(vec3(floor(q.y*8.),floor(q.z*8.),floor(q.x*.35)));scr=step(.955,scr)*(1.-smoothstep(.0,.14,abs(fract(q.y*8.+q.z*8.)-.5)));diffuseColor.rgb*=1.+scr*.5;
 float dirt=smoothstep(.5,1.,h31(floor(q*vec3(.5,1.6,1.6))))*.3+smoothstep(.65,1.,h31(floor(q*vec3(.15,.9,.9)+3.)))*.2;diffuseColor.rgb*=1.-dirt;
 for(int hi=0;hi<64;hi++){if(hi>=uNH)break;vec4 hv=uHits[hi];float dh=distance(vWP,hv.xyz)/hv.w;float jag=(fbm(vWP*1.1)-.5)*1.1+(fbm(vWP*4.)-.5)*.5;
  float scorch=1.-smoothstep(1.0,1.9,dh+jag*.6);float peel=1.-smoothstep(.5,.85,dh+jag*.6);float burn=1.-smoothstep(.0,1.05,dh);
  diffuseColor.rgb*=1.-scorch*.55;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.36,.38,.42)*(.7+.5*fbm(vWP*14.)),peel*.9);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.025),burn*.9);}
 diffuseColor.rgb=mix(diffuseColor.rgb,mix(vec3(.04),vec3(.85,.32,.07),smoothstep(.75,1.,rimAcc)),rimAcc*.9);
 diffuseColor.rgb*=.82+.18*smoothstep(-1.,1.,vWP.y*.08+.4);`)};m.customProgramCacheKey=()=>'w'+k}
function freshMats(){CURHU=newHU();silver=mk(0xa9b0bc,.8,.36);silver2=mk(0x8a929f,.8,.4);steel=mk(0x6c7482,.85,.42);accent=mk(0xd9822b,.5,.45);weather(silver,1);weather(silver2,5);weather(steel,9);weather(accent,3);hullM=silver.clone();hullM.flatShading=false;weather(hullM,1,true,true);innerM=mk(0x1b2434,.6,.5);weather(innerM,11,false)}
// ---- гранёные заготовки ----
function loftR(rings){const P=[],I=[];const n=rings.length;
 for(let r=0;r<n;r++){const{x,w,h}=rings[r],c=Math.min(w,h)*.3,a=w/2,b=h/2;const ring=[[-(a-c),b],[a-c,b],[a,b-c],[a,-(b-c)],[a-c,-b],[-(a-c),-b],[-a,-(b-c)],[-a,b-c]];for(let k=0;k<=8;k++){const[z,y]=ring[k%8];P.push(x,y,z)}}
 for(let r=0;r<n-1;r++)for(let k=0;k<8;k++){const a=r*9+k,b=a+9;I.push(a,b,a+1,b,b+1,a+1)}
 for(const[r,dir]of[[0,-1],[n-1,1]]){const ci=P.length/3;P.push(rings[r].x,0,0);for(let k=0;k<8;k++){const a=r*9+k;if(dir>0)I.push(ci,a,a+1);else I.push(ci,a+1,a)}}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(P,3));g.setIndex(I);g.computeVertexNormals();return g}
// коробка с фасками 45° по всем рёбрам вдоль X и по торцам
function cb(l,w,h,ch,mat){ch=Math.min(ch,w*.3,h*.3,l*.3);const m=new THREE.Mesh(loftR([{x:-l/2,w:w-2*ch,h:h-2*ch},{x:-l/2+ch,w,h},{x:l/2-ch,w,h},{x:l/2,w:w-2*ch,h:h-2*ch}]),mat);return m}
function poly(pts,th,bev,mat){const sh=new THREE.Shape();pts.forEach((p,i)=>i?sh.lineTo(p[0],p[1]):sh.moveTo(p[0],p[1]));sh.closePath();const ge=new THREE.ExtrudeGeometry(sh,{depth:th,bevelEnabled:true,bevelThickness:bev,bevelSize:bev,bevelSegments:1});ge.translate(0,0,-th/2);return new THREE.Mesh(ge,mat)}
const T30=Math.tan(Math.PI/6);
function cyl(r0,r1,len,mat,open){const m=new THREE.Mesh(new THREE.CylinderGeometry(r1,r0,len,8,1,!!open),mat);m.rotation.z=Math.PI/2;m.rotation.x=Math.PI/8;return m} // ось вдоль X: r0 у корпуса (+X), r1 на срезе (−X)

// ---- один двигатель: раструб, рёбра, кардан, сопло, факел ----
let PL=1;
function nozzle(r,len,lit=true){const g=new THREE.Group();const rb=r*1.75;
 const bell=cyl(r*.85,rb,len,steel,true);bell.position.x=-len/2;g.add(bell);
 const inner=cyl(r*.8,rb*.94,len*.98,dark,true);inner.material=dark.clone();inner.material.side=THREE.BackSide;inner.position.x=-len/2;g.add(inner);
 for(let i=0;i<5;i++){const t=(i+.5)/5,rr=r*.85+(rb-r*.85)*t;const ring=cyl(rr*1.07,rr*1.07,len*.05,i%2?silver2:silver,false);ring.position.x=-len*t;g.add(ring)}
 const lip=cyl(rb*1.12,rb*1.12,len*.07,accent,false);lip.position.x=-len+len*.035;g.add(lip);
 const col=cb(len*.38,r*3.0,r*3.0,r*.55,silver);col.position.x=r*.05;g.add(col);
 const col2=cb(len*.16,r*2.3,r*2.3,r*.4,dark);col2.position.x=len*.28;g.add(col2);
 if(lit){const d=new THREE.Mesh(new THREE.CircleGeometry(r*.8,8),glowM);d.rotation.y=-Math.PI/2;d.position.x=-len*.55;g.add(d);
  const pl=new THREE.Mesh(new THREE.ConeGeometry(rb*.95,len*1.5*PL,8,1,true),plumeM);pl.rotation.z=Math.PI/2;pl.position.x=-len-len*.75*PL;g.add(pl);
  const pl2=new THREE.Mesh(new THREE.ConeGeometry(rb*.5,len*1.0*PL,8,1,true),new THREE.MeshBasicMaterial({color:0xeaf6ff,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false,toneMapped:false,side:THREE.DoubleSide}));pl2.rotation.z=Math.PI/2;pl2.position.x=-len-len*.5*PL;g.add(pl2)}
 return g}
// раскладка сопел в одной гондоле (до 8 штук)
function podLayout(n,r){
 if(n<=1)return[[0,0,1]];
 if(n===2)return[[-1.5*r,0,1],[1.5*r,0,1]];
 if(n===3)return[[-1.6*r,-.8*r,1],[1.6*r,-.8*r,1],[0,1.2*r,1]];
 if(n===4)return[[-1.6*r,-1.6*r,1],[1.6*r,-1.6*r,1],[-1.6*r,1.6*r,1],[1.6*r,1.6*r,1]];
 if(n===5)return[[-2.3*r,-1.9*r,.8],[2.3*r,-1.9*r,.8],[-2.3*r,1.9*r,.8],[2.3*r,1.9*r,.8],[0,0,1.3]];
 if(n===6)return[[-3.4*r,-1.7*r,1],[0,-1.7*r,1],[3.4*r,-1.7*r,1],[-3.4*r,1.7*r,1],[0,1.7*r,1],[3.4*r,1.7*r,1]];
 if(n===7){const o=[[0,0,1]];for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;o.push([Math.cos(a)*2.4*r,Math.sin(a)*2.4*r,.85])}return o} // цветок: центр + 6
 const cols=Math.ceil(n/2),o=[];for(let i=0;i<n;i++){const rw=i<cols?0:1,inRow=rw?n-cols:cols,cl=rw?i-cols:i;o.push([(cl-(inRow-1)/2)*2.7*r,(rw-.5)*2.7*r,.85])}return o}
const ext=(nz,r)=>{let zm=0,ym=0;for(const[z,y,s]of nz){zm=Math.max(zm,Math.abs(z)+r*1.85*s);ym=Math.max(ym,Math.abs(y)+r*1.85*s)}return[zm,ym]};
// состав кормы: центр + боковые гондолы. До 8 — одна гондола; 9..23 — центр 7 и две боковые; больше — центр и шестиугольник из 6 гондол
function sternPlan(n){
 if(n<=8)return{c:n,pods:[],ring:0};
 if(n<=23){const c=7,rest=n-c;return{c,pods:[Math.ceil(rest/2),Math.floor(rest/2)],ring:0}}
 const c=(n-6)%6===0?6:7,rest=n-c,P=6,pods=[];for(let i=0;i<P;i++)pods.push(Math.floor(rest/P)+(i<rest%P?1:0));return{c,pods,ring:1}}
// ---- блок двигателей для n сопел ----
function engineBlock(n,tons=1){const g=new THREE.Group();const r=Math.cbrt(tons)*(n>=6?.85:1);const len=r*3.6;PL=n>8?.3:1;
 const plan=sternPlan(n);const noz=[],pods=[];
 const cs=plan.pods.length?(plan.ring?1.45:1.6):1,ps=plan.ring?.62:.7;const cen=podLayout(plan.c,r*cs),[cz,cy]=ext(cen,r*cs);pods.push({z:0,y:0,zm:cz,ym:cy,nz:cen,x:0});cen.forEach(([z,y,s])=>noz.push([z,y,s*cs,0]));
 plan.pods.forEach((m,i)=>{if(!m)return;const lay=podLayout(m,r*ps),[pz,py]=ext(lay,r*ps);
  let z,y;if(plan.ring){const a=i*Math.PI/3;const D=Math.max(cz,cy)+Math.max(pz,py)+r*.5;z=Math.cos(a)*D*1.0;y=Math.sin(a)*D*.8}
  else{const sg=i?1:-1;z=sg*(cz+pz+r*.6);y=0}
  const xo=-r*1.0; // гондолы чуть дальше назад
  pods.push({z,y,zm:pz,ym:py,nz:lay,x:xo});lay.forEach(([zz,yy,s])=>noz.push([z+zz,y+yy,s*ps,xo]))});
 let zM=0,yM=0;for(const p of pods){zM=Math.max(zM,Math.abs(p.z)+p.zm);yM=Math.max(yM,Math.abs(p.y)+p.ym)}
 const Wd=zM*2+r*.8,Hd=yM*2+r*.8,Ld=r*(5+2.6*Math.sqrt(Math.min(n,36)));
 const sh=Math.min(1,(zM+yM)/(Math.max(zM,yM)*2.1)); // ступени корпуса
 const h1=cb(Ld*.42,Wd,Hd,r*.7,silver);h1.position.x=Ld*.21;g.add(h1);
 const h2=cb(Ld*.34,Wd*.92,Hd*.8,r*.6,silver2);h2.position.x=Ld*.42+Ld*.17;g.add(h2);
 const h3=cb(Ld*.26,Wd*.66,Hd*.6,r*.5,silver);h3.position.x=Ld*.76+Ld*.13;g.add(h3);
 const fr=cb(r*.6,Wd*1.06,Hd*1.06,r*.4,dark);fr.position.x=-r*.1;g.add(fr);
 const fl=cb(r*.3,Wd*1.12,Hd*1.12,r*.25,accent);fl.position.x=-r*.55;g.add(fl);
 // гондолы: рамка, фермы к центру
 pods.forEach((p,i)=>{if(i===0)return;
  const pw=p.zm*2,ph=p.ym*2;const pf=cb(r*1.4,pw,ph,r*.4,silver2);pf.position.set(-r*1.1+p.x*.1,p.y,p.z);g.add(pf);
  const pa=cb(r*.3,pw*1.1,ph*1.1,r*.2,accent);pa.position.set(-r*1.95+p.x*.1,p.y,p.z);g.add(pa);
  // косые фермы от гондолы к корпусу
  const d=Math.hypot(p.z,p.y),ang=Math.atan2(p.y,p.z);for(const off of[-1,1]){const bm=new THREE.Mesh(new THREE.BoxGeometry(r*.45,r*.45,d*.7),steel);bm.position.set(-r*.3,p.y*.5+off*r*.4*Math.cos(ang),p.z*.5-off*r*.4*Math.sin(ang));bm.rotation.x=-Math.atan2(p.y,p.z)+Math.PI/2*0;bm.rotation.x=0;bm.lookAt(new THREE.Vector3(-r*.3,p.y,p.z).add(new THREE.Vector3(0,off*r*.4*Math.cos(ang),-off*r*.4*Math.sin(ang))));g.add(bm)}});
 // сопла
 for(const[z,y,s,xo]of noz){const nn=nozzle(r*s,len*Math.max(.5,Math.min(1.6,s+.15)));nn.position.set(-r*.7+xo-(xo?0:0),y,z);g.add(nn)}
 // фермы между ближайшими соплами одной гондолы
 for(const p of pods){const nz=p.nz;for(let i=0;i<nz.length;i++)for(let j=i+1;j<nz.length;j++){const[z1,y1]=nz[i],[z2,y2]=nz[j];const dd=Math.hypot(z2-z1,y2-y1);if(dd>r*3.9)continue;
  const q2=new THREE.Mesh(new THREE.BoxGeometry(r*.3,r*.3,dd),steel);q2.position.set(-r*.9+p.x,p.y+(y1+y2)/2,p.z+(z1+z2)/2);q2.rotation.x=-Math.atan2(y2-y1,z2-z1);g.add(q2)}}
 // радиаторные рёбра
 const nf=Math.min(11,Math.max(4,Math.round(Wd/(r*1.6))));for(let i=0;i<nf;i++){for(const sg of[1,-1]){const f=cb(Ld*.3,r*.12,r*.5,r*.04,steel);f.position.set(Ld*.34+(i%2)*Ld*.12,sg*(Hd/2+r*.2),(i-(nf-1)/2)*(Wd*.92/nf));g.add(f)}}
 // стабилизаторы 45/30
 for(const sg of[-1,1]){const sp=Wd*.3,st=poly([[Ld*.62,0],[Ld*.62-sp,sp],[Ld*.62-sp-r*.8,sp],[Ld*.62-sp-r*.8+sp*T30*2,0]],r*.22,r*.08,silver);st.rotation.x=-Math.PI/2;st.position.set(0,-Hd*.18,sg*Wd*.5);if(sg>0)st.scale.set(1,1,-1);g.add(st)}
 for(const sg of[-1,1]){const st=cb(Ld*.28,r*.1,Hd*.5,r*.03,accent);st.position.set(Ld*.28,0,sg*(Wd/2+r*.03));g.add(st)}
 // сокеты под турели
 [[Ld*.48,Hd/2,0],[Ld*.6,Hd*.41,-Wd*.28],[Ld*.6,Hd*.41,Wd*.28],[Ld*.25,Hd*.3,Wd*.5],[Ld*.25,Hd*.3,-Wd*.5]].forEach(([x,y,z])=>{const p=new THREE.Mesh(new THREE.CylinderGeometry(r*.6,r*.78,r*.22,8),dark);p.position.set(x,y+r*.1,z);g.add(p);const dot=new THREE.Mesh(new THREE.CylinderGeometry(r*.14,r*.14,r*.26,8),cyan);dot.position.copy(p.position);g.add(dot)});
 g.userData={r,Wd,Hd,Ld};return g}
// ---- осевое оружие: выходит из корпуса через порт ----
function port(r){const g=new THREE.Group();
 const inn=cyl(r*1.5,r*1.5,r*1.4,dark,true);inn.material=dark.clone();inn.material.side=THREE.BackSide;inn.position.x=-r*.6;g.add(inn);
 const rim=cyl(r*1.72,r*1.72,r*.34,accent,true);rim.position.x=r*.05;g.add(rim);
 const rim2=cyl(r*1.9,r*1.9,r*.22,silver2,true);rim2.position.x=-r*.3;g.add(rim2);return g}
function railOut(L,r){const g=new THREE.Group();
 const br=cb(L+r*6,r*1.3,r*1.3,r*.4,steel);br.position.x=(L-r*6)/2;g.add(br);
 const r1=cb(L*.8,r*.35,r*2.1,r*.1,silver2);r1.position.x=L*.5;g.add(r1);const r2=cb(L*.8,r*2.1,r*.35,r*.1,silver2);r2.position.x=L*.5;g.add(r2);
 const nc=Math.max(2,Math.round(L/(r*2.6)));for(let i=0;i<nc;i++){const c=cb(r*.7,r*2.5,r*2.5,r*.7,i%2?silver:accent);c.position.x=L*.16+i*(L*.7/nc);g.add(c)}
 const mz=cb(r*1.8,r*2.3,r*2.3,r*.55,dark);mz.position.x=L+r*.5;g.add(mz);
 const mg=new THREE.Mesh(new THREE.CircleGeometry(r*.5,8),cyan);mg.rotation.y=Math.PI/2;mg.position.x=L+r*1.42;g.add(mg);
 return g}
function laserOut(L,r){const g=new THREE.Group();
 // ступенчатый ствол из трёх граненых секций
 const sec=[[-6*r,L*.3,1.15],[L*.3,L*.6,.95],[L*.6,L*.84,.74]];
 sec.forEach(([x0,x1,k],i)=>{const m=cyl(r*k*.92,r*k,x1-x0,i%2?steel:silver2,false);m.position.x=(x0+x1)/2;g.add(m)});
 // стыки: кольца + светящиеся щели вдоль граней
 [L*.3,L*.6,L*.84].forEach((x,i)=>{const k=[1.15,.95,.74][i];const rg=cyl(r*k*1.38,r*k*1.38,r*.5,i%2?silver:accent,false);rg.position.x=x;g.add(rg);
  for(let q=0;q<8;q++){const gg=new THREE.Group();const sl=new THREE.Mesh(new THREE.BoxGeometry(i===2?L*.1:L*.22,r*.1,r*.34),cyan);sl.position.set(x-(i===2?L*.07:L*.15),r*k*1.01*Math.cos(Math.PI/8)+r*.02,0);gg.add(sl);gg.rotation.x=q*Math.PI/4+Math.PI/8;g.add(gg)}});
 // клетка из четырёх лап вокруг фокус-кристалла
 for(let k=0;k<4;k++){const lp=L*.34;const pr=poly([[0,r*.35],[lp,-r*.3],[lp,-r*.02],[0,r*.95]],r*.28,r*.08,silver);const gg=new THREE.Group();pr.position.set(L*.82,r*1.55,0);gg.add(pr);gg.rotation.x=k*Math.PI/2+Math.PI/4;g.add(gg)}
 const halo=cyl(r*1.95,r*1.95,r*.3,accent,true);halo.position.x=L*1.0;g.add(halo);
 const gl=cyl(r*1.7,r*1.7,r*.1,cyan,true);gl.position.x=L*1.0;g.add(gl);
 const cr=new THREE.Mesh(new THREE.OctahedronGeometry(r*.95,0),cyan);cr.scale.set(1.7,1,1);cr.position.x=L*1.0;g.add(cr);
 const core=new THREE.Mesh(new THREE.OctahedronGeometry(r*.5,0),glowM);core.scale.set(1.7,1,1);core.position.x=L*1.0;g.add(core);
 return g}
function gatOut(L,r){const g=new THREE.Group();const R=1.15*r;
 const ax=cb(L+6*r,.6*r,.6*r,.15*r,steel);ax.position.x=(L-6*r)/2;g.add(ax);
 for(let k=0;k<6;k++){const a=k*Math.PI/3;const b=cb(L+6*r,.46*r,.46*r,.13*r,k%2?steel:silver2);b.position.set((L-6*r)/2,Math.cos(a)*R,Math.sin(a)*R);g.add(b)}
 [[.22,accent],[.55,silver],[.86,accent]].forEach(([t,m])=>{const d=cb(r*.55,R*2.5,R*2.5,r*.3,m);d.position.x=L*t;g.add(d)});
 const mz=cb(r*.7,R*2.7,R*2.7,r*.35,dark);mz.position.x=L*1.0+r*.2;g.add(mz);
 for(let k=0;k<6;k++){const a=k*Math.PI/3;const hole=new THREE.Mesh(new THREE.CircleGeometry(r*.2,6),cyan);hole.rotation.y=Math.PI/2;hole.position.set(L*1.0+r*.56,Math.cos(a)*R,Math.sin(a)*R);g.add(hole)}
 const fd=cb(L*.25,r*1.4,r*1.2,r*.3,steel);fd.position.set(L*.1,r*1.9,0);g.add(fd);
 return g}
// раскладка сопел в одной гондоле (до 8 штук)
function horn(len,w,h){const g=new THREE.Group();const m1=cb(len*.56,w,h,Math.min(w,h)*.26,silver);m1.position.x=len*.28;g.add(m1);
 const m2=cb(len*.46,w*.82,h*.82,Math.min(w,h)*.22,silver2);m2.position.x=len*.56+len*.2;g.add(m2);
 const pl=cb(len*.5,w*.5,h*.14,.15,steel);pl.position.set(len*.3,0,0);const t=pl.clone();t.position.y=h*.5+.05;g.add(t);const u=pl.clone();u.position.y=-h*.5-.05;g.add(u);
 const st=cb(len*.34,.35,h*.55,.12,accent);st.position.set(len*.34,0,w*.5+.1);g.add(st);const st2=st.clone();st2.position.z=-w*.5-.1;g.add(st2);return g}
function body3(x0,x1,w,h){const g=new THREE.Group();const L=x1-x0;
 const b1=cb(L*.5,w,h,h*.24,silver);b1.position.x=x0+L*.25;g.add(b1);const b2=cb(L*.36,w*.92,h*.9,h*.2,silver2);b2.position.x=x0+L*.5+L*.18;g.add(b2);const b3=cb(L*.2,w*.86,h*.8,h*.18,silver);b3.position.x=x0+L*.86+L*.1-L*.1+L*.04;g.add(b3);
 const tp=cb(L*.5,w*.5,h*.16,.2,steel);tp.position.set(x0+L*.45,h*.5+.05,0);g.add(tp);const bt=tp.clone();bt.position.y=-h*.5-.05;g.add(bt);
 for(const sg of[-1,1]){const ac=cb(L*.3,.4,h*.6,.14,accent);ac.position.set(x0+L*.3,0,sg*(w*.5+.1));g.add(ac)}return g}
function noseBlock(v){const g=new THREE.Group();
 const body=(x0,x1,w,h)=>new THREE.Mesh(loftR([{x:x0,w:w*.8,h:h*.8},{x:x0+w*.25,w,h},{x:x1,w,h}]),silver);
 const put=(m,x,y,z)=>{m.position.set(x,y,z);g.add(m);return m};
 const gun=(x,y,z,r,L)=>{put(port(r),x,y,z);put(railOut(L,r),x,y,z)};
 const las=(x,y,z,r,L)=>{put(port(r*1.4),x,y,z);put(laserOut(L,r),x,y,z)};
 if(v==='a'){ // один лазер: ступенчатые блоки, ствол выходит из порта
  put(cb(10,8.4,8.4,1.7,silver),-9,0,0);put(cb(8,7,7,1.4,silver2),-1.5,0,0);put(cb(5.4,5.8,5.8,1.2,silver),4.9,0,0);
  put(cb(7,5.2,.6,.2,steel),1,3.9,0);put(cb(7,5.2,.6,.2,steel),1,-3.9,0);
  for(const sg of[-1,1]){put(cb(5,.5,3.6,.2,accent),-4,0,sg*4.4);put(cb(3,.5,2.6,.2,steel),3,0,sg*3.6)}
  put(cb(.7,5.8,5.8,.5,silver2),7.7,0,0);las(8.0,0,0,1.5,16)}
  if(v==='b'){ // два рельса: ступенчатый корпус, общая броневая маска, клин-сенсор между стволами
  put(cb(10,11,8,1.8,silver),-9,0,0);put(cb(8,10,7.2,1.6,silver2),-1.5,0,0);put(cb(5.6,9.4,6.6,1.4,silver),4.9,0,0);
  put(cb(8,6.5,.7,.2,steel),0,4.4,0);put(cb(8,6.5,.7,.2,steel),0,-4.4,0);
  for(const sg of[-1,1]){put(cb(7,.6,4.6,.2,accent),-3,0,sg*5.7);put(cb(4,.6,3,.2,steel),3,0,sg*5.2)
   const sh=cb(3.4,4.2,4.2,1,silver2);put(sh,8.2,0,sg*2.5);
   const st=new THREE.Mesh(new THREE.BoxGeometry(2,.14,.6),cyan);st.position.set(3.2,2.6,sg*4.0);g.add(st)}
  // клин-сенсор между стволами: призма 45/30
  const wd=poly([[0,0],[6,0],[0,2.4]],1.2,.25,dark);wd.rotation.x=-Math.PI/2;wd.position.set(7.9,0,0);wd.rotation.z=0;g.add(wd);
  put(cb(.7,9.4,6.6,.5,silver2),7.7,0,0);for(const sg of[-1,1])gun(10,0,sg*2.5,1.05,13)}
  if(v==='c'){ // четыре рельса: ступенчатый корпус, силовая рама, перекрестие между стволами
  put(cb(10,10.6,10.6,2,silver),-9,0,0);put(cb(8,9.4,9.4,1.7,silver2),-1.5,0,0);put(cb(5,8.6,8.6,1.5,silver),4.7,0,0);
  put(cb(8,6.4,.7,.2,steel),0,5.7,0);put(cb(8,6.4,.7,.2,steel),0,-5.7,0);
  for(const sg of[-1,1]){put(cb(7,.6,5.2,.2,accent),-3,0,sg*5.7);put(cb(4,.6,3.4,.2,steel),3,0,sg*5.1);
   const st=new THREE.Mesh(new THREE.BoxGeometry(2.4,.14,.7),cyan);st.position.set(-1,4.0,sg*4.2);g.add(st)}
  put(cb(.7,8.6,8.6,.5,silver2),7.65,0,0);
  // перекрестие между стволами и две квадратные рамы жёсткости
  put(cb(7.5,.6,5.6,.2,steel),12,0,0);put(cb(7.5,5.6,.6,.2,steel),12,0,0);
  for(const [x,m] of [[9.2,steel],[15.2,accent]]){for(const sy of[-1,1]){put(cb(.8,6.2,.7,.25,m),x,sy*3.1,0);put(cb(.8,.7,6.2,.25,m),x,0,sy*3.1)}}
  for(const sy of[-1,1])for(const sg of[-1,1])gun(7.95,sy*2.2,sg*2.2,.85,12)}
  if(v==='d'){ // «П»: рога по краям с пушками, лазер из центральной стенки
  put(body3(-14,3,16,8),0,0,0);
  for(const sg of[-1,1]){const h=horn(11,4.4,6.4);put(h,0,0,sg*5.8);put(cb(.6,4.4*.82,6.4*.82,.4,silver2),11,0,sg*5.8);gun(11.2,0,sg*5.8,.95,10)}
  put(cb(.8,6.2,5.5,.5,silver2),3.3,0,0);las(3.6,0,0,1.25,13)}
 if(v==='e'){ // трезубец: центральный зуб с главным рельсом, боковые рога, распорки и спинной гребень
  put(body3(-14,2,16,8),0,0,0);
  const hc=horn(10,6.8,8);put(hc,0,0,0);put(cb(.6,6.8*.82,8*.82,.4,silver2),10,0,0);gun(10.2,0,0,1.55,15);
  for(const sg of[-1,1]){const h=horn(5.5,3.8,5.2);put(h,0,-.6,sg*6.4);put(cb(.6,3.8*.82,5.2*.82,.4,silver2),5.5,-.6,sg*6.4);gun(5.7,-.6,sg*6.4,.7,9)
   // косые распорки 45° между центральным зубом и боковым рогом
   const br=poly([[0,0],[4.8,0],[0,2.0]],.9,.2,steel);br.rotation.x=-Math.PI/2;br.position.set(1.2,-2.1,sg*3.4);if(sg>0)br.scale.set(1,1,-1);g.add(br)}
  // спинной гребень и радиаторы
  put(cb(11,1.2,1.6,.4,steel),-1,4.9,0);for(let i=0;i<5;i++)put(cb(.4,.3,2.6,.1,accent),-5+i*1.9,5.2,0);
  for(const sg of[-1,1])put(cb(6,.5,.14,.05,cyan),2,2.6,sg*3.46)}
 if(v==='f'){ // один рельс
  put(cb(10,8.4,8.4,1.7,silver),-9,0,0);put(cb(8,7,7,1.4,silver2),-1.5,0,0);put(cb(5.4,5.8,5.8,1.2,silver),4.9,0,0);
  put(cb(7,5.2,.6,.2,steel),1,3.9,0);put(cb(7,5.2,.6,.2,steel),1,-3.9,0);
  for(const sg of[-1,1]){put(cb(5,.5,3.6,.2,accent),-4,0,sg*4.4);put(cb(3,.5,2.6,.2,steel),3,0,sg*3.6)}
  put(cb(.7,5.8,5.8,.5,silver2),7.7,0,0);gun(8.0,0,0,1.4,16)}
 if(v==='g'){ // один миниган
  put(cb(10,8.4,8.4,1.7,silver),-9,0,0);put(cb(8,7,7,1.4,silver2),-1.5,0,0);put(cb(5.4,5.8,5.8,1.2,silver),4.9,0,0);
  put(cb(7,5.2,.6,.2,steel),1,3.9,0);put(cb(7,5.2,.6,.2,steel),1,-3.9,0);
  for(const sg of[-1,1]){put(cb(5,.5,3.6,.2,accent),-4,0,sg*4.4);put(cb(3,.5,2.6,.2,steel),3,0,sg*3.6)}
  put(cb(.7,5.8,5.8,.5,silver2),7.7,0,0);put(port(1.4),8.0,0,0);put(gatOut(13,1.3),8.0,0,0)}
 if(v==='h'){ // два миниганa
  put(cb(10,11,8,1.8,silver),-9,0,0);put(cb(8,10,7.2,1.6,silver2),-1.5,0,0);put(cb(5.6,9.4,6.6,1.4,silver),4.9,0,0);
  put(cb(8,6.5,.7,.2,steel),0,4.4,0);put(cb(8,6.5,.7,.2,steel),0,-4.4,0);
  for(const sg of[-1,1]){put(cb(7,.6,4.6,.2,accent),-3,0,sg*5.7);put(cb(4,.6,3,.2,steel),3,0,sg*5.2);put(cb(3.4,4.2,4.2,1,silver2),8.2,0,sg*2.7)}
  put(cb(.7,9.4,6.6,.5,silver2),7.7,0,0);for(const sg of[-1,1]){put(port(1.15),10,0,sg*2.7);put(gatOut(11,1.1),10,0,sg*2.7)}}
 if(v==='x'){ // как «4 ствола»: 1 центр + 4 вокруг, корпус-якорь с перекладиной, плиты сверху/снизу по 3
  const n=P.n||15,arms=Math.max(0,n-11),ps=Math.ceil(arms/2),rowsA=ps>5?2:1,perRow=Math.ceil(ps/rowsA),pt=2.9;
  const half=Math.max(8,5.3+perRow*2.8+1.6),Ha=rowsA*pt+2.6;
  put(cb(10,10.6,10.6,2,silver),-9,0,0);put(cb(8,9.4,9.4,1.7,silver2),-1.5,0,0);put(cb(5,8.6,8.6,1.5,silver),4.7,0,0);
  put(cb(.7,8.6,8.6,.5,silver2),7.65,0,0);
  // плавники-ступени: передняя кромка параболой, под каждой пушкой своя ступень
  const th=rowsA*pt+.2,fr=(j)=>{const t=perRow>1?j/(perRow-1):0;return 7.6-9*t*t},steps=[];
  for(const sg of[-1,1]){for(let j=0;j<perRow;j++){const xf=Math.round(fr(j)*2)/2,xb=-6+j*pt*.8,len=xf-xb,z=sg*(5.3+1.6+j*2.8);
    put(cb(len,2.8,th,.7,j%2?silver:silver2),xb+len/2,0,z);put(cb(.6,2.9,th+.4,.2,accent),xf-.3,0,z);steps.push([sg,j,xf,z])}
   put(cb(10,1.6,th*.8,.4,steel),-1,0,sg*5.3)}
  // верх и низ: короткие плиты внутри ширины корпуса, три пушки ступенями
  for(const sy of[-1,1]){put(cb(9,9,.9,.3,silver2),1,sy*5.7,0);
   for(const[zz,xf]of[[-3,6.2],[0,7.6],[3,6.2]]){const len=xf-1;put(cb(len,2.8,2.2,.7,zz?silver:silver2),1+len/2,sy*6.4,zz);put(cb(.6,2.9,2.6,.2,accent),xf-.3,sy*6.4,zz)}}
  // центр + 4 вокруг, перекрестие и две рамы
  put(cb(7.5,.6,6.4,.2,steel),12,0,0);put(cb(7.5,6.4,.6,.2,steel),12,0,0);
  for(const[x,m]of[[9.2,steel],[15.2,accent]]){for(const sy of[-1,1]){put(cb(.8,7,.7,.25,m),x,sy*3.5,0);put(cb(.8,.7,7,.25,m),x,0,sy*3.5)}}
  put(port(1.3),7.8,0,0);put(railOut(11,1.3),7.8,0,0);
  for(const sy of[-1,1])for(const sg of[-1,1]){put(port(.85),7.8,sy*3.3,sg*3.3);put(railOut(11,.85),7.8,sy*3.3,sg*3.3)}
  for(const sg of[-1,1]){const cnt=sg<0?Math.ceil(arms/2):Math.floor(arms/2);let m=0;
   for(let rw=0;rw<rowsA&&m<cnt;rw++)for(let j=0;j<perRow&&m<cnt;j++,m++){const xf=Math.round(fr(j)*2)/2,z=sg*(5.3+1.6+j*2.8),y=(rowsA-1)/2*pt-rw*pt;put(port(.6),xf+.15,y,z);put(railOut(3.2,.6),xf+.15,y,z)}}
  for(const sy of[-1,1])for(const[zz,xf]of[[-3,6.2],[0,7.6],[3,6.2]]){put(port(.6),xf+.15,sy*6.4,zz);put(railOut(3.2,.6),xf+.15,sy*6.4,zz)}
 }
 // стабилизаторы 45/30
 for(const sg of[-1,1]){const sp=5,st=poly([[-4,0],[-4-sp,sp],[-4-sp-1.4,sp],[-4-sp-1.4+sp*T30*2,0]],.5,.15,silver);st.rotation.x=-Math.PI/2;st.position.set(-3,0,sg*(v==='d'||v==='e'?8.2:5));if(sg>0)st.scale.set(1,1,-1);g.add(st)}
 g.userData={};return g}
function base(s){const g=new THREE.Group();
 const p=cb(6.2*s,6.2*s,1.2*s,.45*s,silver2);p.position.y=.6*s;g.add(p);
 const r=cb(5.4*s,5.4*s,.35*s,.15*s,accent);r.position.y=1.35*s;g.add(r);
 const q=cb(4.2*s,4.2*s,.4*s,.18*s,dark);q.position.y=1.7*s;g.add(q);return g}
function railTurret(s,n){const g=new THREE.Group();g.add(base(s));const y=3.2*s,rr=.55*s,L=5*s;
 const HH=n>=4?4.6*s:3.2*s,MH=n>=4?4.1*s:2.7*s;const hz=cb(6.4*s,5.8*s,HH,1.0*s,silver);hz.position.set(0,y,0);g.add(hz);
 const up=cb(4.2*s,4.2*s,.6*s,.2*s,steel);up.position.set(-.3*s,y+HH*.56,0);g.add(up);
 const man=cb(1.6*s,5.4*s,MH,.85*s,silver2);man.position.set(3.7*s,y,0);g.add(man);
 const rear=cb(1.8*s,4.4*s,2.4*s,.7*s,silver2);rear.position.set(-3.8*s,y-.1*s,0);g.add(rear);
 for(const sg of[-1,1]){const cap=cb(3.2*s,1.3*s,2.2*s,.45*s,steel);cap.position.set(-.4*s,y-.2*s,sg*3.45*s);g.add(cap);
  const st=new THREE.Mesh(new THREE.BoxGeometry(2.2*s,.14*s,.9*s),cyan);st.position.set(-.4*s,y+.4*s,sg*(3.45*s+.66*s)*.995);st.scale.z=.1;g.add(st);
  const ac=cb(2*s,.3*s,1.3*s,.1*s,accent);ac.position.set(1.2*s,y,sg*(2.9*s+.15*s));g.add(ac)}
 const zs=n===1?[[0,0]]:n===2?[[-1.45*s,0],[1.45*s,0]]:n===3?[[-1.8*s,0],[0,0],[1.8*s,0]]:[[-1.5*s,1.05*s],[1.5*s,1.05*s],[-1.5*s,-1.05*s],[1.5*s,-1.05*s]];
 zs.forEach(([z,dy])=>{const p=port(rr);p.position.set(4.5*s,y+dy,z);g.add(p);const b=railOut(L,rr);b.position.set(4.5*s,y+dy,z);g.add(b)});
 if(n>=2){const tr=cb(L*.3,.4*s,3.4*s,.12*s,steel);tr.position.set(4.5*s+L*.45,y,0);g.add(tr)} // стяжка стволов
 return g}
function gatTurret(s,tw){const g=new THREE.Group();g.add(base(s));const y=3.1*s;
 const hz=cb(5*s,tw?7.4*s:4.4*s,3*s,.95*s,silver);hz.position.set(-.4*s,y,0);g.add(hz);
 const up=cb(3.4*s,tw?5.4*s:2.8*s,.6*s,.2*s,steel);up.position.set(-.6*s,y+1.75*s,0);g.add(up);
 const mot=cb(1.8*s,2.6*s,2.6*s,.7*s,steel);
 const cl=tw?[-1.9*s,1.9*s]:[0];
 cl.forEach(z=>{
  const m=mot.clone();m.position.set(-3.4*s,y,z);g.add(m);
  const front=cb(1.6*s,2.6*s,2.6*s,.8*s,silver2);front.position.set(2.5*s,y,z);g.add(front);
  const ax=cb(8*s,.55*s,.55*s,.15*s,steel);ax.position.set(3.2*s,y,z);g.add(ax);
  for(let k=0;k<6;k++){const a=k*Math.PI/3;const b=cb(8.2*s,.42*s,.42*s,.12*s,k%2?steel:silver2);b.position.set(4.2*s,y+Math.cos(a)*.95*s,z+Math.sin(a)*.95*s);g.add(b)}
  for(const x of[3.6*s,6.2*s,8.0*s]){const d=cb(.4*s,2.3*s,2.3*s,.2*s,x>7?dark:accent);d.position.set(x,y,z);g.add(d)}
  const mz=cb(.5*s,2.5*s,2.5*s,.25*s,dark);mz.position.set(8.5*s,y,z);g.add(mz)});
 // барабаны с лентой по бокам
 const dz=tw?[-5*s,5*s]:[-3.1*s,3.1*s];
 dz.forEach((z,i)=>{const dr=new THREE.Mesh(new THREE.CylinderGeometry(1.5*s,1.5*s,2.2*s,8),silver2);dr.rotation.x=Math.PI/2;dr.position.set(-1.6*s,y-.3*s,z);g.add(dr);
  const dc=new THREE.Mesh(new THREE.CylinderGeometry(1.0*s,1.0*s,2.5*s,8),accent);dc.rotation.x=Math.PI/2;dc.position.set(-1.6*s,y-.3*s,z);g.add(dc);
  const belt=cb(2.6*s,.35*s,1.2*s,.1*s,steel);belt.position.set(.4*s,y+.2*s,z*.8);belt.rotation.z=.25;g.add(belt)});
 return g}


// детали на плоскости: u вдоль X, v по второй оси; ax: 'z' — боковая грань (нормаль ±Z, v по Y), 'y' — верх/низ (нормаль ±Y, v по Z)
let _sd=7;const rnd=()=>{_sd=(_sd*16807)%2147483647;return _sd/2147483647};
function faceDeco(g,cx,cy,cz,len,hh,ax,sg){const put=(o,u,v,n)=>{if(ax==='z')o.position.set(cx+u,cy+v,cz+sg*n);else o.position.set(cx+u,cy+sg*n,cz+v);g.add(o)};
 const box=(l,w,h,m)=>{const b=new THREE.Mesh(new THREE.BoxGeometry(l,ax==='z'?h:w,ax==='z'?w:h),m);return b};
 const ncol=Math.max(2,Math.floor(len/5));
 for(let i=0;i<ncol;i++){const u=-len/2+(i+.5)*len/ncol,kind=Math.floor(rnd()*6);
  if(kind===0){for(let k=0;k<5;k++)put(box(len/ncol*.7,.14,.28,dark),u,-hh*.35+k*hh*.17,.12)}                 // вентрешётка
  else if(kind===1){put(box(len/ncol*.6,.3,hh*.4,steel),u,hh*.1,.15);put(box(len/ncol*.5,.32,.3,accent),u,hh*.1,.2)} // накладка
  else if(kind===2){for(let k=0;k<4;k++)put(box(.35,.3,.35,k%2?cyan:accent),u+(k-1.5)*.5,hh*.3,.15)}              // огни
  else if(kind===3){const c=new THREE.Mesh(new THREE.CylinderGeometry(.35,.35,hh*.7,8),steel);if(ax==='z'){c.position.set(cx+u,cy,cz+sg*.5)}else{c.rotation.x=Math.PI/2;c.position.set(cx+u,cy+sg*.5,cz)}g.add(c)} // труба
  else if(kind===4){put(box(len/ncol*.75,.25,hh*.55,dark),u,0,.1);put(box(len/ncol*.55,.3,.18,cyan),u,hh*.12,.2);put(box(len/ncol*.55,.3,.18,cyan),u,-hh*.12,.2)} // люк-иллюминаторы
  else{put(box(len/ncol*.8,.2,.2,accent),u,-hh*.3,.1);put(box(len/ncol*.8,.2,.2,accent),u,hh*.3,.1);put(box(.2,.2,hh*.62,accent),u-len/ncol*.4,0,.1)} } // рамка
}
// бронепояс из сегментов с швами, болтами и рёбрами вместо цельной гладкой плиты
function armorBelt(g,cx,cy,cz,len,th,hh,sg){const n=Math.max(3,Math.round(len/9)),sl=len/n;
 for(let i=0;i<n;i++){const hj=hh*(.92+rnd()*.1),m=i%2?silver:silver2;const p=cb(sl-.5,th,hj,.7,m);p.position.set(cx-len/2+(i+.5)*sl,cy,cz);g.add(p);
  const bevel=cb(sl-.9,.35,hj*.7,.2,steel);bevel.position.set(cx-len/2+(i+.5)*sl,cy,cz+sg*(th/2+.15));g.add(bevel);
  for(const yy of[-1,1]){for(const xx of[-.35,.35]){const bt=new THREE.Mesh(new THREE.CylinderGeometry(.2,.2,.3,6),accent);bt.rotation.x=Math.PI/2;bt.position.set(cx-len/2+(i+.5)*sl+xx*sl,cy+yy*hj*.4,cz+sg*(th/2+.35));g.add(bt)}}}
 faceDeco(g,cx,cy,cz+sg*(th/2+.3),len*.95,hh*.8,'z',sg)}

function tower(g,x,y0,tiers){let y=y0;for(const[len,w,h,m]of tiers){const b=cb(len,w,h,Math.min(w,h)*.22,m);b.position.set(x,y+h/2,0);g.add(b);
  for(const sg of[-1,1])faceDeco(g,x,y+h/2,sg*w/2,len*.9,h*.8,'z',sg);faceDeco(g,x,y+h,0,len*.85,w*.7,'y',1);
  // ступенчатые фаски-уступы и рёбра
  for(const ex of[-1,1]){const r=cb(.8,w*1.04,h*1.06,.3,steel);r.position.set(x+ex*(len/2-.4),y+h/2,0);g.add(r)}
  y+=h}
 const top=tiers[tiers.length-1],H=top[2]*1.2;const mast=cb(.5,.5,H,.15,steel);mast.position.set(x,y+H/2,0);g.add(mast);
 const arm=cb(.4,top[1]*.7,.4,.1,steel);arm.position.set(x,y+H*.75,0);g.add(arm);
 const dish=new THREE.Mesh(new THREE.CylinderGeometry(0,2.4,1.2,8,1,true),silver2);dish.position.set(x+top[0]*.25,y+.7,top[1]*.2);g.add(dish);
 const rd=new THREE.Mesh(new THREE.BoxGeometry(.5,.5,.5),cyan);rd.position.set(x,y+H+.3,0);g.add(rd)}

// плотный граненый корпус: 8 граней по 6 сегментов, кольцо каждые 1.2 ед. — для вмятин, дыр и сорванной обшивки
function denseHull(R,mat,k,S0,dx0){const S=S0||12,N=8*S,xs=[];const x0=R[0].x,x1=R[R.length-1].x;for(let x=x0;x<=x1+1e-6;x+=(dx0||.6))xs.push(x);
 const P=[],I=[];
 for(const x of xs){let i=0;while(i<R.length-2&&x>R[i+1].x)i++;const a=R[i],b=R[i+1],t=Math.max(0,Math.min(1,(x-a.x)/((b.x-a.x)||1)));const w=(a.w+(b.w-a.w)*t)*k,h=(a.h+(b.h-a.h)*t)*k,c=Math.min(w,h)*.3,A=w/2,B=h/2;
  const ring=[[-(A-c),B],[A-c,B],[A,B-c],[A,-(B-c)],[A-c,-B],[-(A-c),-B],[-A,-(B-c)],[-A,B-c]];
  for(let e=0;e<8;e++){const p=ring[e],q2=ring[(e+1)%8];for(let j=0;j<S;j++){const u=j/S;P.push(x,p[1]+(q2[1]-p[1])*u,p[0]+(q2[0]-p[0])*u)}}}
 for(let r=0;r<xs.length-1;r++)for(let v=0;v<N;v++){const v2=(v+1)%N,a=r*N+v,b=r*N+v2,c2=(r+1)*N+v,d=(r+1)*N+v2;I.push(a,c2,b,b,c2,d)}
 const ge=new THREE.BufferGeometry();ge.setAttribute('position',new THREE.Float32BufferAttribute(P,3));ge.setIndex(I);ge.computeVertexNormals();
 const m=new THREE.Mesh(toCreasedNormals(ge.clone(),.7),mat);m.userData.base=ge;m.userData.full=I.slice();m.userData.dm=new Float32Array(P.length/3);return m}
// ---- хребет: нос + N секций-ячеек + корма; на каждой секции гнёзда с четырёх сторон ----
function pad(s,mat){const g=new THREE.Group();const b=cb(.5,s,s,s*.3,mat||dark);g.add(b);const r=cb(.3,s*1.25,s*1.25,s*.36,accent);r.position.x=-.12;g.add(r);
 for(const[a,b2]of[[.3,.3],[-.3,.3],[.3,-.3],[-.3,-.3]]){const d=new THREE.Mesh(new THREE.BoxGeometry(.2,.35,.35),cyan);d.position.set(.3,a*s,b2*s);g.add(d)}return g}
// гнёздо на грани: face 'u','d','l','r', центр (x), смещение от оси
function sockets(g,x,w,h,len){const n=Math.max(1,Math.floor(len/7)),s=Math.min(w,h)*.42;
 for(let i=0;i<n;i++){const xx=x+(i-(n-1)/2)*(len/n);
  for(const[fy,fz,ry,rz]of[[1,0,0,-Math.PI/2],[-1,0,0,Math.PI/2],[0,1,Math.PI/2,0],[0,-1,-Math.PI/2,0]]){const p=pad(s);
   // pad по умолчанию смотрит в +X → повернём на нужную грань
   if(fy){p.rotation.z=fy>0?Math.PI/2:-Math.PI/2;p.position.set(xx,fy*(h/2+.05),0)}else{p.rotation.y=fz>0?-Math.PI/2:Math.PI/2;p.position.set(xx,0,fz*(w/2+.05))}
   g.add(p)}}}
function rcs(dir,s){const g=new THREE.Group();g.add(cb(s*2.2,s*2.2,s*1.1,s*.35,silver2));
 for(const[a,b]of[[-.5,-.5],[.5,-.5],[-.5,.5],[.5,.5]]){const n=cyl(s*.34,s*.2,s*.9,dark,true);n.rotation.x=0;n.rotation.z=Math.PI/2*0;const k=new THREE.Group();k.add(n);n.rotation.set(Math.PI/8,0,Math.PI/2);n.rotation.z=0;
  const ng=new THREE.Mesh(new THREE.CylinderGeometry(s*.3,s*.18,s*.9,8,1,true),dark);ng.position.set(a*s*1.1,s*.9,b*s*.9);g.add(ng);
  const gl=new THREE.Mesh(new THREE.CircleGeometry(s*.17,8),cyan);gl.rotation.x=-Math.PI/2;gl.position.set(a*s*1.1,s*1.36,b*s*.9);g.add(gl)}
 g.rotation.set(0,0,0);const o=new THREE.Group();o.add(g);if(dir==='u')return o;if(dir==='d'){o.rotation.x=Math.PI;return o}if(dir==='l'){o.rotation.x=Math.PI/2;return o}o.rotation.x=-Math.PI/2;return o}
function spine(m){freshMats();const g=new THREE.Group();g.userData.hu=CURHU;
 const put=(o,x,y,z)=>{o.position.set(x,y||0,z||0);g.add(o);return o};
 const wing=(pts,th,mat,y)=>{const p=poly(pts,th,.3,mat);p.rotation.x=-Math.PI/2;p.position.set(0,y-th/2,0);g.add(p)};
 const cls=m<2?0:m<4?1:m<6?2:3,L=[34,58,84,128][cls]+(m-[1,2,4,6][cls])*10,x0=-L/2,xe=L/2;
 const tn=+P.tn||[300,1500,8000,40000][cls],ax=P.ax||[4,3,0,0][cls];let centerN=0;
 const W=[8,8,15,20][cls],Hk=[.95,.62,.8,.7][cls],f=t=>x0+L*t;
 // профиль корпуса по классам (t, ширина, высота)
 const prof=[
  [[0,.7,.8],[.1,1.2,1],[.45,1,.95],[.75,.55,.6],[1,.88,.9]],
  [[0,.8,.9],[.08,1,1],[.55,.95,.95],[.8,.7,.7],[.93,.5,.45],[1,.88,.9]],
  [[0,.95,1],[.06,1.15,1.1],[.3,1.05,1],[.62,1,1.05],[.85,.7,.75],[1,.88,.9]],
  [[0,.9,.9],[.05,1.2,1],[.3,1.1,.95],[.6,1.15,1],[.8,.9,.8],[.93,.55,.5],[1,.88,.9]]][cls];
 const R=prof.map(([t,w,h])=>({x:f(t),w:W*w,h:W*h*Hk*(cls===0?1.2:1.3)}));
 R.unshift({x:x0-6,w:R[0].w*.9,h:R[0].h*.9});
 {const hm=denseHull(R,hullM,1);g.add(hm);g.userData.hull=hm;const inn=denseHull(R,innerM,.9,6,1.2);g.add(inn);g.userData.inner=inn}
 const wAt=t=>{for(let i=0;i<prof.length-1;i++)if(t<=prof[i+1][0]){const k=(t-prof[i][0])/(prof[i+1][0]-prof[i][0]);return W*(prof[i][1]+(prof[i+1][1]-prof[i][1])*k)}return W*.2};
 const hAt=t=>wAt(t)*Hk*1.3;
 // двигательное гнездо и пояса
 const p=pad(W*.7);p.rotation.y=Math.PI;p.position.set(x0-6.1,0,0);g.add(p);
 for(const t of(tn>3000?[.08,.3,.55,.8]:[.3]))put(cb(1,wAt(t)*1.05,hAt(t)*1.04,.35,accent),f(t),0,0);
 // классовые формы
 const wingsOn=tn<=3000&&ax>=2;
 if(cls===0&&!wingsOn){ // дротик: стреловидные дельта-крылья
  for(const sg of[-1,1])wing([[-8,0],[10,0],[2,10],[-10,16]].map(([a,z])=>[f(.45)+a,sg*(z+W*.45)]),1.6,silver2,-1)}
 if(cls===1&&!wingsOn){ // клинок: плоские лезвия-крылья и гребень
  for(const sg of[-1,1]){wing([[-14,0],[12,0],[0,12],[-20,12]].map(([a,z])=>[f(.35)+a,sg*(z+W*.45)]),1.8,silver2,-.6);
   wing([[-6,0],[16,0],[10,6],[-2,6]].map(([a,z])=>[f(.72)+a,sg*(z+W*.3)]),1.4,steel,-.5)}
  put(cb(L*.5,2,3,.8,steel),f(.4),hAt(.4)/2+1,0)}
 if(cls===2){ // крейсер: цитадель-надстройка, бортовые пояса брони
  tower(g,f(.5),hAt(.5)/2-.5,[[L*.3,W*.7,W*.4,silver2],[L*.15,W*.45,W*.35,silver],[L*.07,W*.25,W*.25,silver2]]);
  for(const sg of[-1,1])armorBelt(g,f(.45),0,sg*(wAt(.45)/2+.6),L*.5,2.4,hAt(.5)*.7,sg)}
 if(cls===3){ // линкор: раздвоенный «рогатый» нос, ярусная надстройка, пояса
  for(const sg of[-1,1]){{const hb=cb(L*.32,W*.32,W*.55,2.4,silver2);hb.position.set(f(.88),0,sg*W*.62);g.add(hb);faceDeco(g,f(.88),0,sg*(W*.62+W*.16),L*.28,W*.45,'z',sg);faceDeco(g,f(.88),W*.275,sg*W*.62,L*.28,W*.25,'y',1)}wing([[-L*.1,0],[L*.12,0],[L*.12-5,5],[-L*.1+5,5]].map(([a,z])=>[f(.8)+a,sg*(z+W*.5)]),2,silver,0);
   armorBelt(g,f(.45),0,sg*(wAt(.45)/2+.8),L*.55,3,hAt(.5)*.7,sg)}
  tower(g,f(.45),hAt(.45)/2-.5,[[L*.34,W*.8,W*.4,silver2],[L*.2,W*.55,W*.35,silver],[L*.1,W*.3,W*.3,silver2],[L*.05,W*.15,W*.2,silver]])}
 // надписи и маркировка (канвас-декали)
 const hgl=new THREE.MeshBasicMaterial({color:0x0d3342,toneMapped:false});
 const mkDecal=(txt,sub,w,h)=>{const c=document.createElement('canvas');c.width=1024;c.height=Math.round(1024*h/w);const x=c.getContext('2d');x.clearRect(0,0,c.width,c.height);
  x.fillStyle='#e8eef7';x.font='bold '+Math.round(c.height*.5)+'px "Arial Narrow",Arial,sans-serif';x.textBaseline='middle';x.fillText(txt,20,c.height*.38);
  x.fillStyle='#d9822b';x.fillRect(20,c.height*.74,c.width*.46,c.height*.1);for(let i=0;i<9;i++){x.beginPath();x.moveTo(c.width*.5+i*34,c.height*.84);x.lineTo(c.width*.5+i*34+22,c.height*.84);x.lineTo(c.width*.5+i*34+44,c.height*.64);x.lineTo(c.width*.5+i*34+22,c.height*.64);x.fill()}
  x.fillStyle='#cfd8e6';x.font=Math.round(c.height*.2)+'px monospace';x.fillText(sub,22,c.height*.62);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=4;return new THREE.Mesh(new THREE.PlaneGeometry(w,h),new THREE.MeshBasicMaterial({map:t,transparent:true,side:THREE.DoubleSide,depthWrite:false,toneMapped:false}))};
 {const tD=cls<2?.5:.27,w0=wAt(tD),dw=L*(cls<2?.34:.085),dh=dw*.26,nm=['ПОЯС-4X','ПБ-217','ЛК «ЗАРЯ»','ЛК-04 «ПОЯС»'][cls];
  for(const sg of[-1,1]){const d=mkDecal(nm,'№ '+(cls*131+407)+' · ПРИПИСКА: ПОЯС',dw,dh);d.position.set(f(tD),0,sg*(cls<2?w0/2+.15:wAt(.45)/2+(cls===3?2.3:1.8)+.15));if(sg<0)d.rotation.y=Math.PI;g.add(d)}}
 if(cls>=2&&P.tank!==0){
  // баки: стойка из горизонтальных цилиндров по бортам, с рёбрами и датчиками
  const tank=(l,r)=>{const t=new THREE.Group();const b=cyl(r,r,l,silver2);t.add(b);
   for(const sx of[-1,1]){const c=cyl(r*.75,r*.9,r*.5,steel);c.position.x=sx*(l/2+r*.25);t.add(c)}
   for(const px of[-.35,0,.35]){const band=cyl(r*1.06,r*1.06,.5,accent);band.position.x=px*l;t.add(band)}
   const gg=cb(l*.5,.12,.5,.05,cyan);gg.position.set(0,0,r*1.0);t.add(gg);return t};
  const nTx=P.tankN||(cls===2?2:3),rT=cls===2?1.7:2.3;
  for(const sg of[-1,1])for(let a=0;a<nTx;a++)for(const yy of[-1,1]){const xx=f(.74+a*.0)-0;const tt=.62+a*.12,t=tank(L*.1,rT);t.position.set(f(tt),yy*(rT+.15),sg*(wAt(tt)/2+rT+.3));g.add(t)}
  for(const sg of[-1,1]){const x1=f(.62)+(nTx-1)*L*.06,len=nTx*L*.12;put(cb(len,.5,rT*4.4,.2,steel),x1,0,sg*(wAt(.7)/2+.2));for(let a=0;a<=nTx;a++)put(cb(.6,rT*1.2,rT*4.6,.2,accent),f(.62)-L*.06+a*L*.12,0,sg*(wAt(.7)/2+rT*2.1+.4)).scale.set(1,1,.001)}
 }
 if(cls===3&&P.hang!==0){
  // ангар: бортовая рампа — тёмный проём с рамой, огнями и полосами
  const tH=.42,ho=wAt(tH)/2+3.4,hl=L*.2,hh=hAt(tH)*.42;
  for(const sg of[-1,1]){put(cb(hl,.7,hh,.4,dark),f(tH),0,sg*ho);
   put(cb(hl*1.08,.6,.7,.2,accent),f(tH),hh/2+.3,sg*(ho+.1));put(cb(hl*1.08,.6,.7,.2,accent),f(tH),-hh/2-.3,sg*(ho+.1));
   for(const sx of[-1,1])put(cb(.7,.6,hh+.8,.2,accent),f(tH)+sx*(hl/2+.2),0,sg*(ho+.1));
   put(cb(hl*.85,.1,hh*.6,.05,hgl),f(tH),0,sg*(ho+.4));
   for(let i=0;i<9;i++)put(cb(.5,.3,.3,.05,cyan),f(tH)-hl*.45+i*hl*.1125,-hh/2+.4,sg*(ho+.5));
   for(let i=0;i<8;i++){const st=cb(.8,.2,.5,.05,i%2?dark:accent);st.position.set(f(tH)-hl*.4+i*hl*.115,-hh/2-.8,sg*(ho+.4));g.add(st)}}
 }

 // турельные гнёзда: до 100, размер падает с числом, раскладка сеткой по 4 поверхностям
 const SOC=[],NT=Math.min(100,P.t||12);
 {const avail=[0,0,0,0];const x1=.12,x2=.9;let area=0;for(let t=x1;t<x2;t+=.02)area+=wAt(t)*L*.02*(1+1)+hAt(t)*L*.02*(.7+.7);
  let sz=Math.max(2.2,Math.min(W*(tn>3000?.42:.28),Math.sqrt(L*W*2.2/Math.max(NT,1)))),sh,cand;const big=cls>=2;
  const occ=g.children.filter(c=>c.isMesh||c.isGroup).map(c=>new THREE.Box3().setFromObject(c)).filter(b=>{const z=b.getSize(new THREE.Vector3());return z.x<L*.8&&z.length()>.3});
  for(;;){sh=sz*1.18;cand=[];
  const hit=(surf,t,o,w,h)=>{const X=f(t),e=sz*1.1;let c,sx;if(surf==='u'||surf==='d'){c=[X,(surf==='u'?1:-1)*(h/2+.9),o];sx=[e,1.2,e]}else{c=[X,o,(surf==='l'?-1:1)*(w/2+.9)];sx=[e,e,1.2]}const bx=new THREE.Box3().setFromCenterAndSize(new THREE.Vector3(...c),new THREE.Vector3(...sx));return occ.some(q=>q.intersectsBox(bx))};
  for(const[surf,wgt]of[['u',1],['d',1],['l',.6],['r',.6]]){const lenX=L*(x2-x1);const cols=Math.max(1,Math.floor(lenX/sh));
   for(let c=0;c<cols;c++){const t=x1+(c+.5)/cols*(x2-x1),w=wAt(t),h=hAt(t),span=(surf==='u'||surf==='d'?w:h*.8)*.82;const rows=Math.max(1,Math.floor(span/sh));
    for(let r=0;r<rows;r++){const o=(r-(rows-1)/2)*sh;
     if(hit(surf,t,o,w,h))continue;
     if(big&&surf==='u'&&Math.abs(t-.47)<.13&&Math.abs(o)<W*.4)continue;
     if(big&&(surf==='l'||surf==='r')&&Math.abs(t-.45)<.28)continue;
     cand.push({surf,t,o,w,h,pr:c*.9+r*.3+(surf==='u'||surf==='d'?0:.5)})}}}
  if(cand.length>=NT*1.1||sz<=2.2)break;sz-=.3}
  const sel=[];const wt={u:.4,d:.3,l:.15,r:.15};
  for(const sf of['u','d','l','r']){const cs=cand.filter(c=>c.surf===sf);const cols=[...new Set(cs.map(c=>c.t))].sort((a,b)=>a-b);
   cs.forEach(c=>{const ci=cols.indexOf(c.t);c.key=Math.abs(c.o)/sh*1.01+((ci*.618)%1)*.9});cs.sort((a,b)=>a.key-b.key);sel.push(...cs.slice(0,Math.round(NT*wt[sf])))}
  const cand2=sel;const step=1;
  for(let i=0;i<cand2.length;i++){const k=cand2[i],X=f(k.t);let P,N;
   if(k.surf==='u'){P=[X,k.h/2+.35,k.o];N=[0,1,0]}else if(k.surf==='d'){P=[X,-k.h/2-.35,k.o];N=[0,-1,0]}else if(k.surf==='l'){P=[X,k.o,-(k.w/2+.35)];N=[0,0,-1]}else{P=[X,k.o,k.w/2+.35];N=[0,0,1]}
   const gp=new THREE.Group();gp.add(cb(sz*1.1,sz*1.1,.8,.3,steel));const rg=cb(sz*.9,sz*.9,.2,.25,accent);rg.position.y=0;gp.add(rg.clone());const dk=cb(sz*.75,sz*.75,.4,.3,dark);dk.position.x=0;gp.add(dk);
   gp.children.forEach(m=>m.rotation.z=Math.PI/2);gp.children.forEach((m,ix)=>m.position.x=ix*.22);
   // ориентация: локальная ось X → нормаль
   if(N[1]){gp.rotation.z=N[1]>0?Math.PI/2:-Math.PI/2}else{gp.rotation.y=N[2]>0?-Math.PI/2:Math.PI/2}
   gp.position.set(...P);g.add(gp);
   if(P.tr!==0){const kt=P.tl&&P.tl.length?P.tl[i%P.tl.length]:i%6,ts=sz/6.4*(tn>3000?.5:.34),tu=[()=>railTurret(ts,1),()=>railTurret(ts,2),()=>gatTurret(ts,0),()=>railTurret(ts,3),()=>gatTurret(ts,1),()=>railTurret(ts,4)][kt]();tu.position.set(...P);if(N[1])tu.rotation.x=N[1]>0?0:Math.PI;else tu.rotation.x=N[2]>0?Math.PI/2:-Math.PI/2;g.add(tu)}SOC.push({x:P[0],y:P[1],z:P[2],n:N,size:sz})}}
 g.userData.sockets=SOC;
 if(tn>3000){
  for(const sg of[-1,1])for(const t0 of[.16,.78]){const wA=wAt(t0),hA=hAt(t0);faceDeco(g,f(t0),0,sg*(wA/2+.05),L*.14,hA*.6,'z',sg)}
  for(const t0 of[.2,.74,.86]){const w1=wAt(t0),h1=hAt(t0);faceDeco(g,f(t0),h1/2+.05,0,L*.1,w1*.5,'y',1);faceDeco(g,f(t0),-h1/2-.05,0,L*.1,w1*.5,'y',-1)}
 // детализация: швы панелей, вентрешётки, рёбра, навигационные огни
 for(let t=.12;t<.95;t+=.055){const w=wAt(t),h=hAt(t);put(cb(.22,w*.5,.12,.05,dark),f(t),h/2+.02,0);put(cb(.22,w*.5,.12,.05,dark),f(t),-h/2-.02,0);
  for(const sg of[-1,1])put(cb(.22,.12,h*.45,.05,dark),f(t),0,sg*(w/2+.02))}
 for(let t=.2;t<.9;t+=.16){const w=wAt(t),h=hAt(t);for(const sg of[-1,1])for(let k=0;k<5;k++)put(cb(2.6,.15,.55,.05,dark),f(t),-h*.2+k*.9,sg*(w/2+.1)).scale.y=1}
 for(const t of[.14,.5,.9]){const w=wAt(t);for(const sg of[-1,1]){const l=new THREE.Mesh(new THREE.BoxGeometry(.7,.7,.7),sg>0?cyan:new THREE.MeshBasicMaterial({color:0xff5a3c,toneMapped:false}));l.position.set(f(t),0,sg*(w/2+.5));g.add(l)}}
 for(const sg of[-1,1])for(let t=.1;t<.9;t+=.1){const w=wAt(t),h=hAt(t);put(cb(1.2,.5,h*.55,.15,steel),f(t),0,sg*(w/2+.15))}
 }
 g.userData.sockets=SOC;

 // двигатели и носовое оружие из наших блоков

 // крылья малых кораблей: aw = число осевых пушек. 2/3/4 — крылья (X-wing), пушки на кончиках; сверх 4 — в центр
 
 if(tn<=3000&&ax>=2){const nw=Math.min(4,ax);centerN=ax>4?ax-4:0;const angs={2:[0,Math.PI],3:[-Math.PI/2,Math.PI/6,5*Math.PI/6],4:[Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4]}[nw];
  const xr=f(.55),root=wAt(.55)/2-.4,span=W*1.1,wl=W*1.6,r=.4;
  for(const an of angs){const wg=new THREE.Group();
   const wp=poly([[-wl*.55,0],[wl*.3,0],[wl*.1,span],[-wl*.25,span]].map(([a,z])=>[a,z+root]),.7,.2,silver2);wp.rotation.x=-Math.PI/2;wp.position.set(xr,-.35,0);wg.add(wp);
   const tip=root+span,xt=xr+wl*.1;
   const pod=cb(wl*.9,1.5,1.5,.5,silver);pod.position.set(xt-wl*.35,0,tip);wg.add(pod);const ac=cb(.5,1.7,1.7,.2,accent);ac.position.set(xt-wl*.55,0,tip);wg.add(ac);
   const pp=port(r);pp.position.set(xt+.1,0,tip);wg.add(pp);const ro=railOut(4,r);ro.position.set(xt+.1,0,tip);wg.add(ro);
   wg.rotation.x=an;g.add(wg)}}
 const eN=P.en||[3,6,15,30][cls],nvOff=(tn<=3000&&ax>=2&&centerN===0),nV=centerN>=5?'x':centerN>=3?'c':centerN>=2?'b':'f';
 const eng=engineBlock(eN,1),{Ld,Wd}=eng.userData,es=Math.min(1.6,W*(cls===3?1.15:1.05)/Wd);eng.scale.setScalar(es);eng.position.x=x0-6-Ld*es*.5+1;g.add(eng);
 const ns=W*.88/10.6;if(nvOff){const wN=W*.88;g.add(new THREE.Mesh(loftR([{x:xe,w:wN,h:wN*.95},{x:xe+W*.7,w:wN*.55,h:wN*.5},{x:xe+W*1.3,w:wN*.2,h:wN*.2}]),silver))}
 if(!nvOff){const nb=noseBlock(nV);nb.scale.setScalar(ns);nb.position.x=xe+14*ns-1;g.add(nb)}

 g.userData.mid=0;g.userData.L=L;return g}

// ===== система повреждений: кратеры в геометрии, дыры, провода, обломки, отскоки, сдираемая краска =====
function makeDamage(ship,L){const HU=ship.userData.hu;const hull=ship.userData.hull,inner=ship.userData.inner,sc2=ship.parent;let nh=0;const debris=[],sparks=[];const RC=new THREE.Raycaster();
 const bm=[silver,silver2,steel,dark,accent];const wireM=[accent,cyan,new THREE.MeshBasicMaterial({color:0xff4a3c,toneMapped:false}),dark];
 const addHit=(p,r)=>{if(nh>=64)return;HU.uHits.value[nh].set(p.x,p.y,p.z,r);nh++;HU.uNH.value=nh};
 const rayHit=(x,ang)=>{const o=new THREE.Vector3(x,Math.sin(ang)*200,Math.cos(ang)*200);RC.set(o,new THREE.Vector3(0,-Math.sin(ang),-Math.cos(ang)).normalize());hull.geometry.computeBoundingSphere();const r=RC.intersectObject(hull)[0];return r?{p:r.point.clone(),n:r.face.normal.clone()}:null};
 const spark=(p,v,life,m)=>{const e=new THREE.Mesh(new THREE.BoxGeometry(.18,.18,.9),m||cyan);e.position.copy(p);e.lookAt(p.clone().add(v));g2.add(e);sparks.push({e,v,t:0,life})};
 const g2=ship;
 const hash3=(x,y,z)=>{let h=Math.sin(x*127.1+y*311.7+z*74.7)*43758.5453;return h-Math.floor(h)};
 const vnoise=(x,y,z)=>{const ix=Math.floor(x),iy=Math.floor(y),iz=Math.floor(z),fx=x-ix,fy=y-iy,fz=z-iz,sx=fx*fx*(3-2*fx),sy=fy*fy*(3-2*fy),sz=fz*fz*(3-2*fz),L=(a,b,t)=>a+(b-a)*t;
  return L(L(L(hash3(ix,iy,iz),hash3(ix+1,iy,iz),sx),L(hash3(ix,iy+1,iz),hash3(ix+1,iy+1,iz),sx),sy),L(L(hash3(ix,iy,iz+1),hash3(ix+1,iy,iz+1),sx),L(hash3(ix,iy+1,iz+1),hash3(ix+1,iy+1,iz+1),sx),sy),sz)};
 const holes=[];
 // lobe: {c,rx,ry,th,depth,hole}; общая нормаль n; неровный контур шумом, валик по краю
 function deform(p,n,lobes){const t1=new THREE.Vector3().crossVectors(n,Math.abs(n.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize(),t2=new THREE.Vector3().crossVectors(n,t1);
  const pos=hull.userData.base.attributes.position,v=new THREE.Vector3(),rel=new THREE.Vector3();
  const infl=(vec,lb)=>{rel.copy(vec).sub(lb.c);const u0=rel.dot(t1),w0=rel.dot(t2),cs=Math.cos(lb.th),sn=Math.sin(lb.th),u=u0*cs+w0*sn,w=-u0*sn+w0*cs;let d=Math.hypot(u/lb.rx,w/lb.ry);d/=1+.45*(vnoise(rel.x*.3+lb.s,rel.y*.3,rel.z*.3)-.5)+.2*(vnoise(rel.x*.9,rel.y*.9+lb.s,rel.z*.9)-.5);return d};
  for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i);let off=0;
   for(const lb of lobes){const d=infl(v,lb);if(d<1){const k=1-d;off=Math.max(off,lb.depth*Math.pow(k,.65))}else if(d<1.3)off=Math.min(off,0)-lb.depth*.1*(1-(d-1)/.3)*(1-off*0)}
   if(off!==0){v.addScaledVector(n,-off);pos.setXYZ(i,v.x,v.y,v.z)}}
  for(const lb of lobes)if(lb.hole>0&&holes.length<16){const cs=Math.cos(lb.th),sn=Math.sin(lb.th),i2=holes.length;holes.push(lb);
   HU.hoA.value[i2].set(t1.x*cs+t2.x*sn,t1.y*cs+t2.y*sn,t1.z*cs+t2.z*sn,lb.rx);HU.hoB.value[i2].set(-t1.x*sn+t2.x*cs,-t1.y*sn+t2.y*cs,-t1.z*sn+t2.z*cs,lb.ry);HU.hoC.value[i2].set(lb.c.x,lb.c.y,lb.c.z,lb.hole);HU.nHo.value=holes.length}
  hull.userData.base.computeVertexNormals();hull.geometry.dispose();hull.geometry=toCreasedNormals(hull.userData.base.clone(),.7);hull.geometry.computeBoundingSphere();
  for(const lb of lobes){const k=Math.max(1,Math.min(7,Math.round(lb.rx/lb.ry)));for(let i=0;i<k;i++){const o=k>1?(i/(k-1)-.5)*2*(lb.rx-lb.ry):0;addHit(lb.c.clone().addScaledVector(t1,o*Math.cos(lb.th)).addScaledVector(t2,o*Math.sin(lb.th)),lb.ry*(lb.ry<1?1.6:.85))}}}
 function crater(p,n,r,depth,lobes){deform(p,n,lobes);
  // сорванные детали
  for(const ch of[...ship.children]){if(ch===hull||ch===inner||ch.userData.keep)continue;const bb=new THREE.Box3().setFromObject(ch),sz=bb.getSize(new THREE.Vector3());if(sz.length()>L*.2)continue;if(bb.distanceToPoint(p)<r*.7){ship.remove(ch);ch.userData.v=n.clone().multiplyScalar(6+Math.random()*10).add(new THREE.Vector3((Math.random()-.5)*8,(Math.random()-.5)*8,(Math.random()-.5)*8));ch.userData.w=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(3);ship.add(ch);debris.push({e:ch,t:0,life:5})}}
  // осколки брони
  for(let i=0;i<14;i++){const sz=.5+Math.random()*1.4,m=new THREE.Mesh(i%2?new THREE.TetrahedronGeometry(sz*.8):new THREE.OctahedronGeometry(sz*.6),bm[i%3]);m.scale.set(1,.3+Math.random()*.4,.5+Math.random()*.8);m.position.copy(p).addScaledVector(n,.5);m.rotation.set(Math.random()*6,Math.random()*6,0);ship.add(m);
   const dv=n.clone().multiplyScalar(5+Math.random()*9).add(new THREE.Vector3((Math.random()-.5)*10,(Math.random()-.5)*10,(Math.random()-.5)*10));m.userData.v=dv;m.userData.w=new THREE.Vector3(Math.random()-.5,Math.random()-.5,Math.random()-.5).multiplyScalar(5);debris.push({e:m,t:0,life:5})}
  // провода из дыры
  for(let i=0;i<7;i++){const a=new THREE.Vector3().copy(p).addScaledVector(n,-depth*.6+Math.random()*.3).add(new THREE.Vector3((Math.random()-.5)*r*.5,(Math.random()-.5)*r*.5,(Math.random()-.5)*r*.5));
   const dir=n.clone().add(new THREE.Vector3((Math.random()-.5)*.9,(Math.random()-.5)*.9,(Math.random()-.5)*.9)).normalize();const len=1.5+Math.random()*3;
   const pts=[a,a.clone().addScaledVector(dir,len*.5),a.clone().addScaledVector(dir,len).add(new THREE.Vector3(0,-len*.25*Math.random(),0)),a.clone().addScaledVector(dir,len*1.3).add(new THREE.Vector3((Math.random()-.5),-len*.5,(Math.random()-.5)))];
   const w=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts),10,.07+Math.random()*.06,5),wireM[i%4]);w.userData.keep=1;ship.add(w);
   const tip=pts[3];for(let k=0;k<2;k++)spark(tip,new THREE.Vector3((Math.random()-.5)*6,(Math.random()-.5)*6,(Math.random()-.5)*6),.5+Math.random()*.5)}
  // вспышка и искры
  for(let i=0;i<22;i++)spark(p,n.clone().multiplyScalar(8+Math.random()*14).add(new THREE.Vector3((Math.random()-.5)*14,(Math.random()-.5)*14,(Math.random()-.5)*14)),.5+Math.random()*.7,i%3?glowM:accent)}
 function graze(p,n,dirv,len){const tg=dirv.clone().sub(n.clone().multiplyScalar(dirv.dot(n))).normalize(),sd=new THREE.Vector3().crossVectors(n,tg);const lobes=[];let cur=p.clone(),ang=0;const nseg=Math.max(6,Math.round(len/1.3)),seed=Math.random()*50;
  for(let i=0;i<nseg;i++){ang+=(Math.random()-.5)*.5;const stp=len/nseg;cur=cur.clone().addScaledVector(tg,stp*Math.cos(ang)).addScaledVector(sd,stp*Math.sin(ang));lobes.push({c:cur.clone(),rx:stp*.9,ry:.3+Math.random()*.4,th:Math.atan2(Math.sin(ang),Math.cos(ang)),depth:.12+Math.random()*.25,hole:0,s:seed});
   if(Math.random()<.35)for(let k=0;k<3;k++)spark(cur,tg.clone().multiplyScalar(8+Math.random()*16).addScaledVector(n,3+Math.random()*9).add(new THREE.Vector3((Math.random()-.5)*5,(Math.random()-.5)*5,(Math.random()-.5)*5)),.3+Math.random()*.5,k%2?glowM:accent)}
  deform(p,n,lobes)}
 function step(dt){for(const d of debris){d.t+=dt;d.e.position.addScaledVector(d.e.userData.v,dt);d.e.rotation.x+=d.e.userData.w.x*dt;d.e.rotation.y+=d.e.userData.w.y*dt;d.e.rotation.z+=d.e.userData.w.z*dt}
  for(let i=sparks.length-1;i>=0;i--){const s2=sparks[i];s2.t+=dt;s2.e.position.addScaledVector(s2.v,dt);s2.v.multiplyScalar(1-dt*.9);if(s2.t>s2.life){ship.remove(s2.e);sparks.splice(i,1)}else s2.e.scale.setScalar(1-s2.t/s2.life)}}
 const doHit=(h,gd,kind,r)=>{const rr=()=>Math.random(),S=rr()*100;
  const mk=(c,rx,ry,depth,hole)=>({c,rx,ry,th:rr()*Math.PI,depth,hole,s:S+rr()*9});
  if(kind==='g'){graze(h.p,h.n,gd,r);return}
  let lobes=[];const t1=new THREE.Vector3().crossVectors(h.n,Math.abs(h.n.y)<.9?new THREE.Vector3(0,1,0):new THREE.Vector3(1,0,0)).normalize(),t2=new THREE.Vector3().crossVectors(h.n,t1);
  if(kind==='c')lobes=[mk(h.p,r,r*(.55+rr()*.45),r*.85,.38)];
  else if(kind==='b'){for(let i=0;i<4;i++){const o=new THREE.Vector3().addScaledVector(t1,(rr()-.5)*r*.9).addScaledVector(t2,(rr()-.5)*r*.9);lobes.push(mk(h.p.clone().add(o),r*(.45+rr()*.4),r*(.3+rr()*.4),r*.65,.35+rr()*.2))}lobes.push(mk(h.p,r*.9,r*.6,r*.4,0))}
  else if(kind==='p')lobes=[mk(h.p,r,r*(.8+rr()*.2),r*1.2,.75),mk(h.p,r*2.4,r*2.1,r*.6,0)];
  else if(kind==='s')lobes=[mk(h.p,r*2.8,r*.35,r*.7,.5),mk(h.p,r*3.4,r*.6,r*.3,0)];
  crater(h.p,h.n,r,r*.3,lobes)};
 return{shoot(x,ang,kind,r){const h=rayHit(x,ang);if(!h)return;doHit(h,new THREE.Vector3(1,0,0).add(new THREE.Vector3(0,Math.sin(ang),Math.cos(ang)).multiplyScalar(-.6)).normalize(),kind,r)},
  hit(ow,dw,kind,r){ship.updateMatrixWorld(true);RC.set(ow,dw);const rs=RC.intersectObject(hull)[0];if(!rs||!rs.face)return false;const h={p:ship.worldToLocal(rs.point.clone()),n:rs.face.normal.clone()};const gd=dw.clone().transformDirection(new THREE.Matrix4().copy(ship.matrixWorld).invert());doHit(h,gd,kind,r);return true},step}}

// склейка статичной мелочи в несколько мешей по материалам: тысячи draw call'ов на корабль -> десяток
function bake(g:any){g.updateMatrixWorld(true);const inv=new THREE.Matrix4().copy(g.matrixWorld).invert(),by=new Map(),rm=[];
 g.traverse((o:any)=>{if(o===g||o===g.userData.hull||o===g.userData.inner||!o.isMesh||o.isInstancedMesh)return;let p=o,skip=false;while(p&&p!==g){if(p===g.userData.hull||p===g.userData.inner){skip=true;break}p=p.parent}if(skip)return;
  const mat=Array.isArray(o.material)?null:o.material;if(!mat)return;let ge=o.geometry.clone();if(ge.index)ge=ge.toNonIndexed();for(const k of Object.keys(ge.attributes))if(k!=='position'&&k!=='normal'&&k!=='uv'&&k!=='color')ge.deleteAttribute(k);
  if(mat.map||mat.vertexColors){return}
  if(!ge.attributes.normal)ge.computeVertexNormals();ge.deleteAttribute('uv');ge.deleteAttribute('color');ge.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv,o.matrixWorld));if(!by.has(mat))by.set(mat,[]);by.get(mat).push(ge);rm.push(o)});
 for(const o of rm)o.parent&&o.parent.remove(o);
 for(const[mat,arr] of by){const mg=mergeGeometries(arr,false);if(!mg)continue;const me=new THREE.Mesh(mg,mat);me.userData.keep=true;g.add(me)}}
export function buildSpine(m:number,opt:any){P=opt||{};const g=spine(m);bake(g);g.userData.dmg=makeDamage(g,g.userData.L||100);return g}
