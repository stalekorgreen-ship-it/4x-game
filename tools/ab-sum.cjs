// Сводка ab-suite.sh: преимущество ИИ-стороны = (потери врага − свои потери) по модулям и по тоннажу; среднее по seed и обеим сменам сторон, разброс по seed
const fs=require('fs'),dir=process.argv[2],G={};
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.txt')).sort()){const [tag,mode,sdt]=f.replace('.txt','').split('.'),A=+sdt[1],L=fs.readFileSync(dir+'/'+f,'utf8').split('\n').filter(l=>l.startsWith('{')&&l.includes('"ships"'));
 for(const l of L){const o=JSON.parse(l),sd=s=>o.ships.filter(x=>x.n.endsWith(String(s))),ml=s=>sd(s).reduce((a,x)=>a+(+x.mod.split('/')[1]-+x.mod.split('/')[0]),0),tl=s=>sd(s).filter(x=>!x.alive).reduce((a,x)=>a+x.dbg[10],0)/1000,al=s=>sd(s).filter(x=>x.alive).length;
  (G[tag+' '+mode]=G[tag+' '+mode]||[]).push({side:A,seed:o.seed,dMod:ml(1-A)-ml(A),dTons:tl(1-A)-tl(A),dAlive:al(A)-al(1-A),hitsAI:o.hits[A],hitsB:o.hits[1-A]})}}
const out={};for(const k in G){const R=G[k],m=x=>+(R.reduce((a,r)=>a+r[x],0)/R.length).toFixed(2),sdv=x=>{const mu=R.reduce((a,r)=>a+r[x],0)/R.length;return +Math.sqrt(R.reduce((a,r)=>a+(r[x]-mu)**2,0)/Math.max(1,R.length-1)/R.length).toFixed(2)},win=R.filter(r=>r.dTons>0).length,loss=R.filter(r=>r.dTons<0).length;
 out[k]={n:R.length,dMod:m('dMod'),dMod_se:sdv('dMod'),dTons:m('dTons'),dTons_se:sdv('dTons'),dAlive:m('dAlive'),dAlive_se:sdv('dAlive'),hitsAI:m('hitsAI'),hitsBase:m('hitsB'),winsByTons:win,lossesByTons:loss,runs:R};
 console.log(k.padEnd(16),'n',R.length,'Δмодулей',out[k].dMod,'±'+out[k].dMod_se,'Δтонн(тыс)',out[k].dTons,'±'+out[k].dTons_se,'Δживых',out[k].dAlive,'±'+out[k].dAlive_se,'попаданий ИИ/база',out[k].hitsAI+'/'+out[k].hitsBase,'перевес по тоннажу',win+':'+loss)}
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(out,null,1));
