const {chromium}=require('playwright');(async()=>{const b=await chromium.launch({args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});const p=await b.newPage({viewport:{width:1400,height:800}});p.on('pageerror',e=>console.log('ERR',e.message));await p.goto('http://127.0.0.1:5200/');await p.waitForTimeout(1500);
const out=await p.evaluate(async()=>{const M=await import('/src/21d-spine.ts');const THREE=await import('/node_modules/three/build/three.module.js');
const r=new THREE.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});r.setSize(1400,800);document.body.innerHTML='';document.body.appendChild(r.domElement);r.domElement.style.cssText='position:fixed;left:0;top:0;z-index:99999';
const sc=new THREE.Scene();sc.background=new THREE.Color(0x070a12);sc.add(new THREE.HemisphereLight(0xcfe0ff,0x201810,1.6));const dl=new THREE.DirectionalLight(0xffffff,3);dl.position.set(40,80,60);sc.add(dl);
const cam=new THREE.PerspectiveCamera(40,1400/800,.1,3000);
const mkRow=(specs)=>{const row=[];specs.forEach(([m,arm,hits],k)=>{const g=M.buildSpine(m,{tn:m*1000,t:12,en:6,arm});g.position.set(0,0,rowZ+k*200);sc.add(g);if(g.userData.inner)g.userData.inner.visible=true;const D=g.userData.dmg;for(let i=0;i<hits;i++)D.shoot(-6+i*.04,0,'c',3);row.push(g)});return row};
let rowZ=0;const sets={C:[[6,3,3],[6,5,5],[6,10,10]],A:[[6,3,0],[6,3,1],[6,3,2],[6,3,3]],B:[[1,2,2],[3,4,3],[6,6,5],[6,6,6]]};
const sh=(pos,look)=>{cam.position.set(...pos);cam.lookAt(...look);r.render(sc,cam);return r.domElement.toDataURL('image/png')};
const o={A:[],B:[],C:[]};
for(const key of ['C']){const row=mkRow(sets[key]);for(const g of row){g.traverse(m=>{if(m.isMesh&&m!==g.userData.hull&&m!==g.userData.inner&&m.parent!==g.userData.inner)m.visible=false});g.updateMatrixWorld(true);const zm=new THREE.Box3().setFromObject(g.userData.hull).max.z-g.position.z;o[key].push(sh([-6,1.5,g.position.z+zm+6],[-6,0,g.position.z+zm-.5]))}rowZ+=1000}
return o});
const fs=require('fs');for(const k of ['C'])out[k].forEach((u,i)=>fs.writeFileSync('/tmp/sh/'+k+i+'.png',Buffer.from(u.split(',')[1],'base64')));console.log('ok');await b.close()})()