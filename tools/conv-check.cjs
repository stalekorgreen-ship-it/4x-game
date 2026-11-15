// Регрессия сходимости по шагу физики: node tools/conv-check.cjs [seeds=8] [секунд=1200]
// Гоняет одинаковый смешанный бой 6×6 с рабочим шагом (battle.json step.dt) и с вдвое меньшим, сравнивает суммы по seed.
// Пределы — из замера (docs/combat-ai/convergence.md): при 0,25 против 0,125 с расхождения ≤3–11%; бой хаотичен, поэтому сравниваются суммы, не траектории.
const {execFileSync}=require('child_process'),fs=require('fs'),path=require('path');
const N=process.argv[2]||'8',T=process.argv[3]||'1200',dt=JSON.parse(fs.readFileSync(path.join(__dirname,'..','public','data','battle.json'),'utf8')).step.dt;
const run=d=>execFileSync('node',[path.join(__dirname,'conv-test.cjs'),'comp',N,T,String(d)],{env:{...process.env,COMP:process.env.COMP||'BB,LR,PD,IC,FR,MS;BB,LR,PD,IC,FR,MS'},maxBuffer:1<<28}).toString().trim().split('\n').map(l=>JSON.parse(l)).filter(o=>!o.err);
const agg=R=>{let sh=0,h=0,T=0,fu=0,n=0,lost=0,dead=0,pl=0;for(const o of R){sh+=o.shots[0]+o.shots[1];h+=o.hits[0]+o.hits[1];T+=o.t;fu+=o.fuel.reduce((a,b)=>a+b,0);n+=o.fuel.length;lost+=o.lost.reduce((a,b)=>a+b,0);dead+=o.dead;pl+=o.plans}
  return {'выстрелов/100с':100*sh/T,'точность':h/sh,'топливо%':fu/n,'модулей потеряно':lost,'уничтожено':dead,'решений ИИ/1000с':1000*pl/T}};
const LIM={'выстрелов/100с':.12,'точность':.2,'топливо%':.12,'модулей потеряно':.12,'уничтожено':.2,'решений ИИ/1000с':.15};
const A=agg(run(dt)),B=agg(run(dt/2));let ok=true;
for(const k in LIM){const r=Math.abs(A[k]-B[k])/Math.max(1e-9,Math.abs(B[k]));const pass=r<=LIM[k];if(!pass)ok=false;console.log(k,+A[k].toFixed(3),'vs',+B[k].toFixed(3),'расхождение',(100*r).toFixed(1)+'%','предел',(100*LIM[k])+'%',pass?'OK':'ПРЕВЫШЕН')}
console.log('сходимость (шаг',dt,'против',dt/2+'):',ok?'OK':'НАРУШЕНА');process.exit(ok?0:1);
