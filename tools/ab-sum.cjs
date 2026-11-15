// Сводка ab-suite.sh: node tools/ab-sum.cjs <каталог> [json-выход]
// Для каждого боя — ИИ-сторона A против базовой B. Δ = (B − A) для потерь (положительно — ИИ лучше). Среднее ± стандартная ошибка по всем боям (seed × смена сторон).
// Плюс: расход топлива, смены целей, защита от ракет (доля попаданий по прикрытым/неприкрытым), переходы автомата отхода — у ИИ-стороны и у базы.
const fs=require('fs'),dir=process.argv[2],G={};
const ms=x=>+x.mod.split('/')[1]-+x.mod.split('/')[0];
for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.txt')).sort()){const [tag,mode,sdt]=f.replace('.txt','').split('.'),A=+sdt[1],B=1-A;
 for(const l of fs.readFileSync(dir+'/'+f,'utf8').split('\n').filter(l=>l.startsWith('{')&&l.includes('"ships"'))){const o=JSON.parse(l),sd=s=>o.ships.filter(x=>x.n.endsWith(String(s)));
  const ml=s=>sd(s).reduce((a,x)=>a+ms(x),0),tl=s=>sd(s).filter(x=>!x.alive).reduce((a,x)=>a+x.dbg[10],0)/1000,al=s=>sd(s).filter(x=>x.alive).length,fu=s=>{const a=sd(s);return a.reduce((q,x)=>q+(50-x.dv[3])*2,0)/Math.max(1,a.length)} /* % стартового топлива (стенд даёт полбака) */;
  const sw=(o.fc&&o.fc.sw&&o.fc.sw.ns)||[0,0],pv=o.pvo||{},g=(k,i)=>(pv[k]||[0,0])[i]||0,rs=o.rs||{},rsN=i=>Object.entries(rs).filter(([k])=>k.startsWith(i+':')).reduce((a,[,v])=>a+v,0),pk=i=>Object.entries(pv.kill||{}).filter(([k])=>k.startsWith(i+':ПВО')).reduce((a,[,v])=>a+v,0);
  (G[tag+' '+mode]=G[tag+' '+mode]||[]).push({side:A,seed:o.seed,dMod:ml(B)-ml(A),dTons:tl(B)-tl(A),dAlive:al(A)-al(B),hitsA:o.hits[A],hitsB:o.hits[B],fuelA:fu(A),fuelB:fu(B),swA:sw[A],swB:sw[B],
   misAtProtA:g('hitProt',A)+g('downProt',A),misHitProtA:g('hitProt',A),misAtOtherA:g('hitOther',A)+g('downOther',A),misHitOtherA:g('hitOther',A),misAtB:g('hitProt',B)+g('downProt',B)+g('hitOther',B)+g('downOther',B),misHitB:g('hitProt',B)+g('hitOther',B),pvoKillsA:pk(A),rsA:rsN(A),rsB:rsN(B),escA:(o.esc||[0,0])[A]})}}
const out={};const mean=(R,x)=>R.reduce((a,r)=>a+r[x],0)/R.length,se=(R,x)=>{const m=mean(R,x);return Math.sqrt(R.reduce((a,r)=>a+(r[x]-m)**2,0)/Math.max(1,R.length-1)/R.length)},f=v=>+v.toFixed(2);
for(const k in G){const R=G[k],S=x=>R.reduce((a,r)=>a+r[x],0),o={n:R.length};for(const x of ['dMod','dTons','dAlive','fuelA','fuelB','swA','swB','hitsA','hitsB','rsA','rsB'])o[x]=[f(mean(R,x)),f(se(R,x))];
 o.wins=R.filter(r=>r.dTons>0).length;o.losses=R.filter(r=>r.dTons<0).length;o.misProt=[S('misHitProtA'),S('misAtProtA')];o.misOther=[S('misHitOtherA'),S('misAtOtherA')];o.misBase=[S('misHitB'),S('misAtB')];o.pvoKillsA=S('pvoKillsA');o.escA=S('escA');o.runs=R;out[k]=o;
 const z=o.dTons[1]>0?o.dTons[0]/o.dTons[1]:0;
 console.log(k.padEnd(18),'n',o.n,'Δмод',o.dMod.join('±'),'Δт',o.dTons.join('±'),'(z',z.toFixed(1)+')','Δживых',o.dAlive.join('±'),'перевес',o.wins+':'+o.losses,'топливо% ИИ/база',o.fuelA[0]+'/'+o.fuelB[0],'смен целей',o.swA[0]+'/'+o.swB[0],'ракеты попали/(попали+сбиты): прикрытые',o.misProt.join('/'),'прочие',o.misOther.join('/'),'база',o.misBase.join('/'),'сбито ПВО',o.pvoKillsA,'переходов отхода',o.rsA[0]+'/'+o.rsB[0])}
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(out,null,1));
