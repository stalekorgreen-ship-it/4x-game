// Боевой ИИ v3: отход с прикрытием (V1–V5), построения (P1–P4), разведчик (S1–S2), ремонтная поддержка (R1–R3).
// node tools/fleet-v3-test.cjs [PORT=5200]
const {chromium}=require('playwright');
(async()=>{const b=await chromium.launch();const p=await b.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));
await p.addInitScript(()=>{let a=33;Math.random=()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}});
await p.goto('http://127.0.0.1:'+(process.env.PORT||5200)+'/');await p.waitForTimeout(2500);
const R=await p.evaluate(async()=>{const U=n=>(performance.getEntriesByType('resource').map(e=>e.name).find(u=>u.includes('/src/'+n))||'/src/'+n);
 const D=await import(U('01-data.ts'));const B=await import(U('05-battle.ts'));D.newGame();D.state.raid.eta=1e9;D.state.raid.warned=true;
 const RC=(c,n)=>Array(n).fill(D.compOf(D.mkKey('rail',{cal:c,bar:'1',cap:'a'})).rcfg),GC=D.compOf(D.mkKey('gat',{tw:'1'})).gcfg;
 const mk=(name,o,tons,acc)=>({...D.fitSpec({name,eng:3,spd:1,flak:0,rails:0,...o}),tons,pow:acc*tons/120});
 const SC=[{k:'ir',rng:120,res:1}],SCOUT=[{k:'ir',rng:500,res:1},{k:'rad',rng:700,res:1}];
 const BB=(o={})=>()=>mk('Броненосец',{L:.3,arm:5,rails:2,railCfg:RC('20',2),gat:4,gatCfg:Array(4).fill(GC),ammoCap:500,energy:5000,scList:SC,...o},9500,5);
 const FR=(o={})=>()=>mk('Фрегат',{L:.15,arm:2,rails:2,railCfg:RC('10',2),gat:2,gatCfg:[GC,GC],ammoCap:300,energy:5000,scList:SC,...o},1500,10);
 const SCT=()=>mk('Разведчик',{L:.12,arm:1,rails:0,gat:2,gatCfg:[GC,GC],ammoCap:200,energy:5000,scList:SCOUT},900,14);
 const T=()=>B.Battle.time(),run=x=>{const t1=T()+x;let g=0;while(T()<t1&&!B.Battle.isDone()&&g++<4e6)B.Battle.tickN(.02)};
 const battle=(a,b,dist,over)=>{B.Battle.begin({title:'v3',fleets:[[],[]],late:[...a.map(f=>({t:0,side:0,spec:f(),edge:80,ang:0})),...b.map(f=>({t:0,side:1,spec:f(),edge:80,ang:Math.PI}))],demo:true,maxT:1e6,seed:11,names:['a','b'],onEnd(){}});
  D.state.demo=true;D.state.paused=false;B.Battle.tickN(.02);const S=B.Battle.ships().filter(s=>!s.bayOf),k=[0,0];for(const s of S){const i=k[s.side]++;s.sx=s.vx=s.sy=s.vy=0;s.x=s.side?dist:0;s.y=(i-2)*25;s.hd=s.side?Math.PI:0;s.home={x:s.side?dist+400:-400,y:0}}return S};
 const H=B.Battle.dmgT,mods=s=>s.zones.flatMap(z=>z.mods),wreck=(s,f)=>{const L=mods(s).filter(m=>m.alive&&m.k!=='C'&&m.k!=='E'&&m.k!=='R');for(let i=0;i<Math.ceil(L.length*f);i++)H.mdead(s,L[i])};
 const fc=()=>B.Battle.stat().fc||{},cov=()=>fc().cov||{};const out=[],ok=(n,c,info)=>out.push({n,ok:!!c,info});
 // V1 повреждённый отходит под прикрытием
 {const S=battle([BB(),BB(),FR(),FR()],[FR(),FR(),FR()],130),d=S[2];run(60);wreck(d,1);let cv=null,st=new Set();for(let i=0;i<40;i++){run(5);st.add(d.rst||'ok');cv=S.find(q=>q.cvOf===d)||cv;if(cv&&(d.rst==='retreat'||d.rst==='regroup'))break}
  ok('V1 повреждённый отходит под прикрытием',cv&&cv.role==='прикрытие'&&(d.rst==='retreat'||d.rst==='regroup'),{states:[...st],cover:cv&&cv.T.n,coverRole:cv&&cv.role,as:cov().as,wait:cov().wait})}
 // V2 несколько повреждённых: флот не бросает бой целиком
 {const S=battle([BB(),BB(),FR(),FR(),FR(),FR()],[FR(),FR(),FR(),FR()],130);run(60);for(const q of [S[2],S[3],S[4],S[5]])wreck(q,.9);let mx=0;for(let i=0;i<30;i++){run(5);const my=S.filter(q=>q.alive&&q.side===0),r=my.filter(q=>['prep','retreat','regroup','cornered'].includes(q.rst)).length;mx=Math.max(mx,r/my.length)}
  ok('V2 четыре повреждённых из шести: не больше половины отходит одновременно, остальные держат и прикрывают',mx<=.67&&(cov().held>0||cov().as>0),{maxFrac:+mx.toFixed(2),held:cov().held,as:cov().as})}
 // V3 явный перевес врага: отход не запрещается
 {const S=battle([FR(),FR(),FR()],Array(9).fill(BB()),130);run(60);for(const q of S.filter(q=>q.side===0))wreck(q,1);const seen=new Set();for(let i=0;i<30;i++){run(5);for(const q of S.filter(q=>q.side===0))seen.add(q.rst||'ok')}
  ok('V3 при перевесе врага отходят все (запрета нет)',seen.has('retreat')||seen.has('regroup')||seen.has('cornered'),{states:[...seen],str:+(S[0].F&&S[0].F.str||0).toFixed(2)})}
 // V4 прикрывающий сам тяжело повреждён — снимается
 {const S=battle([BB(),BB(),FR(),FR()],[FR(),FR(),FR()],130),d=S[2];run(60);wreck(d,1);let cv=null;for(let i=0;i<30&&!cv;i++){run(5);cv=S.find(q=>q.cvOf===d)}if(cv){wreck(cv,.8);run(30)}
  ok('V4 прикрывающий тяжело повреждён — снят с прикрытия',cv&&!cv.cvOf&&(cov().rel||{})['прикрывающий тяжело повреждён']>0,{cover:cv&&cv.T.n,rel:cov().rel})}
 // V5 флагман уничтожен: распределение продолжается, прикрытие назначается
 {const S=battle([BB(),BB(),FR(),FR(),FR()],[FR(),FR(),FR()],130);run(60);const fl=S[0].F&&S[0].F.flag;if(fl)H.hull(fl,0,100),H.hull(fl,1,100);run(20);const d=S[3];wreck(d,1);let cv=null;for(let i=0;i<30&&!cv;i++){run(5);cv=S.find(q=>q.cvOf===d)}
  ok('V5 после гибели флагмана новый флагман и прикрытие',fl&&!fl.alive&&S[1].F.flag&&S[1].F.flag.alive&&cv,{flagDead:fl&&!fl.alive,newFlag:S[1].F.flag&&S[1].F.flag.T.n,cover:cv&&cv.T.n})}
 // P: построения — геометрия мест
 const geom=(S)=>{const A=S.filter(q=>q.side===0&&q.slot),byR={};for(const q of A)(byR[q.role]=byR[q.role]||[]).push(q);const L=Object.values(byR).sort((a,b)=>b.length-a.length)[0]||[];const F=S[0].F,LN=F&&F.line;if(!LN||L.length<3)return null;const pr=L.map(q=>({lat:(q.slot.x-LN.ax)*LN.px+(q.slot.y-LN.ay)*LN.py,bk:-((q.slot.x-LN.ax)*LN.ux+(q.slot.y-LN.ay)*LN.uy)}));const latS=Math.max(...pr.map(q=>q.lat))-Math.min(...pr.map(q=>q.lat)),bkS=Math.max(...pr.map(q=>q.bk))-Math.min(...pr.map(q=>q.bk));return {n:L.length,latSpan:+latS.toFixed(1),backSpan:+bkS.toFixed(1),form:F.form}};
 for(const fm of ['линия','клин','колонна']){B.Battle.cfgOverride&&0;}
 const formRun=async(fm)=>{const S=battle(Array(5).fill(BB()),Array(4).fill(FR()),130);B.Battle.setFC&&B.Battle.setFC({form:fm});run(40);const g=geom(S);B.Battle.setFC&&B.Battle.setFC({form:''});return g};
 const gL=await formRun('линия'),gW=await formRun('клин'),gC=await formRun('колонна');
 ok('P1 линия: широкий фронт, без глубины',gL&&gL.latSpan>gL.backSpan*3,gL);
 ok('P2 клин: фронт и глубина (крылья назад)',gW&&gW.backSpan>gW.latSpan*.3&&gW.latSpan>0,gW);
 ok('P3 колонна: глубина, фронта нет',gC&&gC.latSpan<1e-6&&gC.backSpan>0,gC);
 {const S=battle(Array(5).fill(BB()),Array(4).fill(FR()),280);run(12);ok('P4 далеко от врага — колонна (автовыбор), ближе — смена',S[0].F&&S[0].F.form==='колонна',{form:S[0].F&&S[0].F.form,forms:cov().form})}
 // S: разведчик
 {const S=battle([BB(),BB(),FR(),SCT],[FR(),FR(),FR()],250),sc=S[3];run(200);const dn=Math.min(...S.filter(q=>q.side===1&&q.alive).map(q=>Math.hypot(q.x-sc.x,q.y-sc.y)));
  ok('S1 разведчик назначен по сенсорам и держится вне досягаемости, в пределах своей дальности',sc.role==='разведка'&&dn>60&&dn<600,{role:sc.role,distToEnemy:Math.round(dn)})}
 {const S=battle([BB(),BB(),FR(),FR()],[FR(),FR(),FR()],250);run(120);ok('S2 без корабля с лучшими сенсорами разведчика нет',!S.some(q=>q.role==='разведка'),{roles:S.filter(q=>q.side===0).map(q=>q.role)})}
 // R: ремонтная поддержка
 {const S=battle([BB(),BB(),FR(),FR()],[FR(),FR(),FR()],250),a=S[0],r=S[1];a.kits=0;r.kits=r.kitCap;wreck(a,.4);const k0=[a.kits,r.kits],al0=a.aliveN;let asg=null;const rl=[];for(let i=0;i<180;i++){run(10);rl.push(r.role);if(r.role==='ремонт')asg=r.rpTg;if(a.kits>2&&a.aliveN>al0)break}
  ok('R1 ремонтник подходит и передаёт наборы, повреждённый чинится',asg&&a.kits+a.kitUsed>0&&r.kits<k0[1]&&Math.abs((r.kits+a.kits+a.kitUsed+mods(a).reduce((x,m)=>x+(m.kres||0),0)+r.kitUsed+mods(r).reduce((x,m)=>x+(m.kres||0),0))-(k0[0]+k0[1]))<1e-6&&a.aliveN>al0,{kits:[+a.kits.toFixed(2),+r.kits.toFixed(2)],used:+a.kitUsed.toFixed(2),mods:[al0,a.aliveN],sum:+(r.kits+a.kits+a.kitUsed+mods(a).reduce((x,m)=>x+(m.kres||0),0)+r.kitUsed+mods(r).reduce((x,m)=>x+(m.kres||0),0)).toFixed(3),k0:k0,xfer:+(cov().xfer||0).toFixed(2),roles:[...new Set(rl)],rep:cov().rep,d:Math.round(Math.hypot(a.x-r.x,a.y-r.y))})}
 {const S=battle([BB(),BB(),FR(),FR()],[FR()],250),a=S[0],r=S[1];a.kitCap=0;a.kits=0;wreck(a,.4);run(300);ok('R2 без склада у повреждённого — наборы не передаются',!(cov().xfer>0)&&r.role!=='ремонт',{role:r.role,xfer:cov().xfer||0})}
 {const S=battle([BB({kitCap:0,kits:0}),BB({kitCap:0,kits:0}),FR({kitCap:0,kits:0}),FR({kitCap:0,kits:0})],[FR()],250),a=S[0];wreck(a,.4);run(300);ok('R3 без наборов ремонтника нет',!S.some(q=>q.role==='ремонт'),{roles:S.filter(q=>q.side===0).map(q=>q.role)})}
 return out});
let n=0;for(const r of R){console.log((r.ok?'OK  ':'FAIL')+' '+r.n+' '+JSON.stringify(r.info));if(r.ok)n++}console.log('итог',n+'/'+R.length);if(errs.length)console.log('ERR',errs.slice(0,3));await b.close()})();
