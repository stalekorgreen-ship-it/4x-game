// Сводка серии tools/series.sh: по каждому сценарию — команда A (левая в списке) против B с учётом смены сторон.
// node tools/series-sum.cjs [каталог=/tmp/SER] [--json]
const fs=require('fs'),path=require('path');const dir=process.argv[2]&&!process.argv[2].startsWith('--')?process.argv[2]:'/tmp/SER',J=process.argv.includes('--json');
const rd=f=>fs.existsSync(f)?fs.readFileSync(f,'utf8').split('\n').filter(l=>l.startsWith('{')&&l.includes('"ships"')).map(l=>{try{return JSON.parse(l)}catch(e){return null}}).filter(Boolean):[];
const names=[...new Set(fs.readdirSync(dir).filter(f=>f.endsWith('.jsonl')).map(f=>f.replace(/\.(A|B)\.jsonl$/,'')))].sort();const out={};
for(const n of names){const runs=[...rd(path.join(dir,n+'.A.jsonl')).map(o=>({o,a:0})),...rd(path.join(dir,n+'.B.jsonl')).map(o=>({o,a:1}))];
 const T=[0,1].map(()=>({wins:0,lost:0,ships:0,modsL:0,mods0:0,hits:0,shots:0,sw:0,ret:0,back:0,home:0,pvo:0}));const G={runs:runs.length,draws:0,cov:0,held:0,wait:0,xfer:0,scout:0,rep:0,relHit:0,forms:{},slot:0,slotN:0,atk:0,noAtk:0,react:0,fuelLeft:0,dvSum:0,rcs:0,misHit:[0,0],misShot:[0,0],t:0};
 for(const {o,a} of runs){const team=sd=>sd===a?0:1;const al=[0,0];G.t+=o.t||0;
  for(const s of o.ships){const sd=+s.n.slice(-1);if(sd!==0&&sd!==1)continue;const X=T[team(sd)];X.ships++;if(!s.alive)X.lost++;else al[team(sd)]++;const [m,m0]=(s.mod||'0/0').split('/').map(Number);X.modsL+=s.alive?m:0;X.mods0+=m0}
  if(al[0]>al[1])T[0].wins++;else if(al[1]>al[0])T[1].wins++;else G.draws++;
  for(const sd of [0,1]){const X=T[team(sd)];X.hits+=(o.hits||[])[sd]||0;X.shots+=(o.shots||[])[sd]||0;const sw=o.fc&&o.fc.sw;if(sw&&sw.ns)X.sw+=sw.ns[sd]||0;
   for(const [k,v] of Object.entries(o.rs||{})){if(+k[0]!==sd)continue;if(/(ok|prep)→retreat$/.test(k))X.ret+=v;if(/→return$/.test(k))X.back+=v;if(/→home$/.test(k))X.home+=v}
   for(const [k,v] of Object.entries((o.pvo&&o.pvo.kill)||{}))if(+k[0]===sd)X.pvo+=v}
  const fc=o.fc||{},cv=fc.cov||{};G.cov+=cv.as||0;G.held+=cv.held||0;G.wait+=cv.wait||0;G.xfer+=cv.xfer||0;G.scout+=cv.scout||0;G.rep+=cv.rep||0;G.relHit+=(cv.rel||{})['прикрывающий тяжело повреждён']||0;for(const [k,v] of Object.entries(cv.form||{}))G.forms[k]=(G.forms[k]||0)+v;
  if(fc.form){G.slot+=fc.form.slot||0;G.slotN+=fc.form.slotN||0}G.atk+=fc.atkT||0;G.noAtk+=fc.noAtkT||0;G.react+=((fc.sw||{}).why||{})['опаснее']||0;G.fuelLeft+=o.fuelLeft||0;G.dvSum+=o.dvSum||0;G.rcs+=o.rcsT||0}
 const N=Math.max(1,runs.length);for(const X of T){X.acc=X.shots?+(X.hits/X.shots).toFixed(3):0;X.modsLeft=X.mods0?+(X.modsL/X.mods0).toFixed(3):0}
 G.slotAvgKm=G.slotN?+(G.slot/G.slotN).toFixed(2):null;G.atkShare=G.atk+G.noAtk>0?+(G.atk/(G.atk+G.noAtk)).toFixed(3):null;for(const k of ['cov','held','wait','xfer','scout','rep','relHit','react','fuelLeft','dvSum','rcs','t'])G[k]=+(G[k]/N).toFixed(2);
 out[n]={teams:T,g:G}}
if(J){console.log(JSON.stringify(out,null,1));process.exit(0)}
console.log('| сценарий | боёв | победы A / B / ничьи | потери A / B | целые модули A / B | меткость A / B | смен целей A / B | отходов A / B (возвратов) | прикрытий за бой | передано наборов | разведчик / ремонтник назначений | откл. от места в строю, км | доля времени в атаке |');
console.log('|---|---|---|---|---|---|---|---|---|---|---|---|---|');
for(const [n,{teams:[A,B],g}] of Object.entries(out))console.log(`| ${n} | ${g.runs} | ${A.wins} / ${B.wins} / ${g.draws} | ${A.lost}/${A.ships} / ${B.lost}/${B.ships} | ${(A.modsLeft*100).toFixed(0)} % / ${(B.modsLeft*100).toFixed(0)} % | ${(A.acc*100).toFixed(1)} / ${(B.acc*100).toFixed(1)} % | ${A.sw} / ${B.sw} | ${A.ret} (${A.back}) / ${B.ret} (${B.back}) | ${g.cov} | ${g.xfer} | ${g.scout} / ${g.rep} | ${g.slotAvgKm??'—'} | ${g.atkShare??'—'} |`);
