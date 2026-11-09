// крылья малого корабля после N попаданий: node tools/dmg-wing.cjs  → /tmp/sh/W_<N>.png
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(1500);
const NS=(process.env.NS||'5,10,50,200').split(',').map(Number);if(process.env.M)await p.evaluate(([m,o])=>{window.__M=m;window.__O=JSON.parse(o)},[process.env.M,process.env.O||'{}']);
const out=await p.evaluate(async(NS)=>{const M=await import('/src/21d-spine.ts');const THREE=await import('/node_modules/three/build/three.module.js');
const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1400,800);document.body.innerHTML='';document.body.appendChild(r.domElement);r.domElement.style.cssText='position:fixed;left:0;top:0;z-index:99999';
const sc=new THREE.Scene();sc.background=new THREE.Color(0x070a12);sc.add(new THREE.HemisphereLight(0xcfe0ff,0x302418,1.8));const dl=new THREE.DirectionalLight(0xffffff,3);dl.position.set(40,80,160);sc.add(dl);
const cam=new THREE.PerspectiveCamera(32,1400/800,.1,3000);const o=[];let sd=7;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
let k=0;for(const n of NS){const g=M.buildSpine(+(window.__M||1),window.__O||{tn:1000,ax:2,t:4,en:3,arm:3});const L=g.userData.L;g.position.set(0,0,k*1000);sc.add(g);g.updateMatrixWorld(true);const D=g.userData.dmg;
 let hit=0,wh=0;for(let a=0;a<n*20&&hit<n;a++){const big=window.__M>1,wing=rnd()<.6,t=new THREE.Vector3(big?(rnd()-.5)*L*.9:(rnd()-.5)*L*(wing?.5:.9),big?(rnd()-.5)*14:(rnd()-.5)*2,big?(rnd()-.5)*30:wing?(rnd()<.5?-1:1)*(4+rnd()*9):(rnd()-.5)*8);
  const dir=(big?new THREE.Vector3(rnd()-.5,rnd()-.5,rnd()-.5):new THREE.Vector3(rnd()-.5,.4+rnd()*.6,rnd()-.5)).normalize();const ow=g.localToWorld(t.clone().addScaledVector(dir,120)),dw=dir.clone().negate();if(D.hit(ow,dw,rnd()<.5?'c':'b',3+rnd()*3)){hit++;D.step(.02)}}
 for(let i=0;i<120;i++)D.step(.05);
 const z0=k*1000;cam.position.set(L*.3,L*(window.__M>1?.45:2.1),z0+L*(window.__M>1?.9:1.3));cam.lookAt(0,0,z0);r.render(sc,cam);o.push([hit,r.domElement.toDataURL('image/png')]);k++}
return o},NS);
const fs=require('fs');out.forEach((u,i)=>fs.writeFileSync('/tmp/sh/'+(process.env.PFX||'W_')+NS[i]+'.png',Buffer.from(u[1].split(',')[1],'base64')));console.log('hits',out.map(u=>u[0]).join(','));await b.close()})()
