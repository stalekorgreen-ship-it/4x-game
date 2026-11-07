// @ts-nocheck
// Здания колоний: строятся из материалов, доставленных на тело (вкладка «Грузы»), силами местной бригады.
// Так грузоперевозки, корпорации, строительство, население и наука связаны одной цепочкой.
import { BODY, RES, fmtN, log, state } from './01-data.ts';

export const CBLD = {
  clinic:  {name: 'Поликлиника', desc: 'Смертность в колонии −8% за здание', cost: {fe: 60, si: 30, cu: 30}, units: 30, max: 5},
  school:  {name: 'Школа', desc: 'Образование доступнее: дети чаще идут на следующую ступень (+12% за здание)', cost: {fe: 50, si: 40, cu: 20}, units: 25, max: 5},
  nursery: {name: 'Дом семьи', desc: 'Рождаемость в колонии +6% за здание', cost: {fe: 50, si: 30, cu: 20, c: 20}, units: 25, max: 5},
  lab:     {name: 'Колониальная лаборатория', desc: '+2 очка науки в сутки в каждой области', cost: {fe: 80, si: 80, cu: 60, c: 20}, units: 40, max: 5},
};
export const colB = id => { const c = state.cols && state.cols[id]; if (!c) return {}; return c.bld || (c.bld = {}); };
export const colN = (id, t) => (state.cols && state.cols[id] && state.cols[id].bld && state.cols[id].bld[t]) || 0;
const depot = id => (state.depot || (state.depot = {}))[id] || (state.depot[id] = {});
export const crewUnits = () => 3 + 2 * ((state.bld && state.bld.colbureau) || 0);
export function colQueue(id) { const c = state.cols[id]; return c.q || (c.q = []); }
export function colBuildAdd(id, t) { const B = CBLD[t], c = state.cols[id]; if (!B || !c) return false; if (colN(id, t) + colQueue(id).filter(j => j.t === t).length >= B.max) return false; colQueue(id).push({t, left: B.units, total: B.units, started: false}); return true; }
export function colBuildTick(h) {
  for (const id in state.cols) {
    if (id === 'earth') continue;
    const c = state.cols[id], q = c.q; if (!q || !q.length) continue;
    const j = q[0], d = depot(id), B = CBLD[j.t];
    if (!j.started) { if (Object.entries(B.cost).every(([k, v]) => (d[k] || 0) >= v)) { for (const [k, v] of Object.entries(B.cost)) d[k] -= v; j.started = true; } else continue; }
    j.left -= crewUnits() * h;
    if (j.left <= 0) { colB(id)[j.t] = colN(id, j.t) + 1; q.shift(); log(`${c.name}: построено «${B.name}» (${colN(id, j.t)} шт.).`); }
  }
  // колониальные лаборатории дают очки науки всем областям
  let lab = 0; for (const id in state.cols) lab += colN(id, 'lab');
  if (lab) for (const f of ['phys', 'eng', 'bio']) state.sci[f] += 2 * lab * h;
}
export function colBldHtml(id) {
  const c = state.cols && state.cols[id]; if (!c || id === 'earth') return '';
  const d = depot(id), q = colQueue(id), name = BODY[id] ? BODY[id].name : id;
  let h = `<div class="box"><h2>Здания колонии «${name}»</h2><div class="help">Материалы нужно доставить на тело (вкладка «Грузы»: заказ груза с Земли на ${name}). Строит местная бригада: ${crewUnits()} ед./сутки; бригад больше, если на Земле построены колонизационные бюро.</div>`;
  h += `<div class="stats"><span>На складе колонии</span><span>${Object.keys(d).filter(k => d[k] > 0).map(k => (RES[k] || k) + ' ' + fmtN(d[k])).join(', ') || 'пусто'}</span></div>`;
  for (const t in CBLD) { const b = CBLD[t], n = colN(id, t), inq = q.filter(j => j.t === t).length;
    h += `<div class="row"><b class="grow">${b.name} <span class="muted">${n}/${b.max}${inq ? ' (в очереди ' + inq + ')' : ''}</span></b></div><div class="help">${b.desc}. Материалы: ${Object.entries(b.cost).map(([k, v]) => (RES[k] || k).toLowerCase() + ' ' + v).join(', ')}. Объём работ ${b.units} ед.</div><div class="row"><span class="grow"></span><button class="btn sm" data-cbld="${t}" data-cid="${id}"${n + inq >= b.max ? ' disabled' : ''}>Построить</button></div>`; }
  if (q.length) h += `<h3>Очередь</h3>` + q.map(j => `<div class="row"><span>${CBLD[j.t].name}</span><span class="muted grow">${j.started ? 'строится: осталось ' + fmtN(j.left, 0) + ' ед.' : 'ждёт материалы'}</span></div>`).join('');
  return h + '</div>';
}
