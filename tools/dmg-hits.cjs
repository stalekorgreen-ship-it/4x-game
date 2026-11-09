const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(1500);
const M0=+process.env.SM||6;
const out=await p.evaluate(async(M0)=>{const M=await import('/src/21d-spine.ts');const THREE=await import('/node_modules/three/build/three.module.js');
const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1400,800);document.body.innerHTML='';document.body.appendChild(r.domElement);r.domElement.style.cssText='position:fixed;left:0;top:0;z-index:99999';
const sc=new THREE.Scene();sc.background=new THREE.Color(0x070a12);sc.add(new THREE.HemisphereLight(0xcfe0ff,0x302418,1.8));const dl=new THREE.DirectionalLight(0xffffff,3);dl.position.set(40,80,160);sc.add(dl);
const cam=new THREE.PerspectiveCamera(32,1400/800,.1,3000);const o=[];let sd=11;const rnd=()=>{sd=(sd*16807)%2147483647;return sd/2147483647};
let k=0;for(const n of [5,10,20,50,100,200]){const g=M.buildSpine(M0,{tn:M0*1000,t:12,en:6,arm:3});const L=g.userData.L;g.position.set(0,0,k*1000);sc.add(g);if(g.userData.inner)g.userData.inner.visible=true;const D=g.userData.dmg;
 const nc=Math.ceil(n/8),cs=[];for(let i=0;i<nc;i++)cs.push([(rnd()-.5)*L*.8,(rnd()-.5)*1.4]);
 for(let i=0;i<n;i++){const c=cs[i%nc];D.shoot(c[0]+(rnd()-.5)*L*.05,c[1]+(rnd()-.5)*.25,rnd()<.5?'c':'b',3+rnd()*3)}
 g.updateMatrixWorld(true);const z0=k*1000;cam.position.set(0,L*.12,z0+L*1.55);cam.lookAt(0,0,z0);r.render(sc,cam);o.push([L,r.domElement.toDataURL('image/png')]);k++}
return o},M0);
const fs=require('fs');out.forEach((u,i)=>fs.writeFileSync('/tmp/sh/N'+M0+'_'+i+'.png',Buffer.from(u[1].split(',')[1],'base64')));console.log('ok',out[0][0]);await b.close()})()
