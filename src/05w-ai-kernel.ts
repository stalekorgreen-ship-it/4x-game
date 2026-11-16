// @ts-nocheck
// ЯДРО ОЦЕНКИ ИИ МАНЁВРА (вынесено из 05-battle.ts без изменений арифметики): урон в секунду по цели с учётом разброса, времени полёта и
// предупреждения цели (её сенсоров), дальность обнаружения снаряда. Чистые функции от переданных данных и констант — модуль можно загрузить
// в Web Worker: ему не нужны ни DOM, ни состояние боя. Первый шаг к переносу планировщика в отдельный поток (см. docs/fleet/combat-benchmarks.md)
let SNS, GATP, VP, DISP, GDISP, PLN, GV;
export function initKernel(c){({SNS,GATP,VP,DISP,GDISP,PLN,GV}=c)}
export const _D3=[0,0,0];export function dpsAt3(ws,X,d,asp){_D3[0]=_D3[1]=_D3[2]=0;const o=X[0],h=o.T.L*.11;for(const m of ws){if(!m.alive||!m.cfg)continue;const C=m.cfg;let V,rate,dm;if(m.k==='T'){V=C.vp||VP;rate=1/Math.max(5,C.chg||20);dm=1}else if(m.k==='G'){V=GV;rate=50;dm=PLN.gat}else if(m.k==='M'){for(let i=0;i<3;i++)_D3[i]+=PLN.miss/60;continue}else continue;
    if(d>(m.k==='G'?12:(V*20)))continue;const tf=d/V,w=warnT(o,V,tf,0),e=(V<2?GDISP:DISP)*d*2;for(let i=0;i<3;i++){const dg=.5*(X[i].acc||5)*.12/1000*w*w;_D3[i]+=Math.min(1,h/(e+dg+1e-6))*rate*dm}}
  const f=asp>2.356?3:asp>.785?1.5:1;return _D3[0]*f/3+_D3[1]*f/3+_D3[2]*f/3}
export function dpsAt(ws,o,d,asp,wpN){let D=0;const h=o.T.L*.11,acc=o.acc||5;for(const m of ws){if(!m.alive||!m.cfg)continue;const C=m.cfg;let V,rate,dm;if(m.k==='T'){V=C.vp||VP;rate=1/Math.max(5,C.chg||20);dm=1}else if(m.k==='G'){V=GV;rate=50;dm=PLN.gat}else if(m.k==='M'){D+=PLN.miss/60;continue}else continue;
    if(d>(m.k==='G'?12:(V*20)))continue;const tf=d/V,w=warnT(o,V,tf,0),e=(V<2?GDISP:DISP)*d*2,dg=.5*acc*.12/1000*w*w;D+=Math.min(1,h/(e+dg+1e-6))*rate*dm}
  if(wpN!=null&&ws.length){let na=0;for(const m of ws)if(m.alive)na++;D*=wpN/na||0}return D*(asp>2.356?3:asp>.785?1.5:1)}
export function warnR(o,V,L){const kk=V>=2,cal=kk?Math.max(5,V*3):0,A=kk?Math.PI*cal*cal/4:GATP.area,T=kk?SNS.railT:SNS.gunT;let R=0;for(const q of L){if(q.k==='ir')R=Math.max(R,SNS.irK*Math.sqrt(A*Math.pow(T/1000,4))*(q.res||1));else if(q.k==='rad'&&o.rdOn)R=Math.max(R,SNS.radK*Math.pow(A/1e4,.25))}return R}
export function warnT(o,V,tf,cl){if(!SNS.on||!o||!o.T)return Math.min(12,tf);const L=o.scl||o.sc||[];let c=o._wc;if(!c||c.L!==L||c.rd!==!!o.rdOn){c=o._wc={L,rd:!!o.rdOn,m:new Map()}}let R=c.m.get(V);if(R===undefined){R=warnR(o,V,L);c.m.set(V,R)} /* дальность обнаружения снаряда зависит только от сенсоров цели и скорости снаряда — считаем один раз */
  return Math.max(0,Math.min(tf,R/Math.max(.1,V+(cl||0)))-SNS.track)}
