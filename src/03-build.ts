// @ts-nocheck
import { BODY, FIELDS, GROUND, log, rec, state, stockOK, veinEff } from './01-data.ts';
import { TECH, tm, ensureOffers, dealField } from './15-techs.ts';
import { sciMult, train, useWear } from './02-crew.ts';

/* ===== ЗДАНИЯ НА ЗЕМЛЕ ===== */
export const MINE_RATE = 1;
export const BLD = {
  mine:       {name: 'Шахта на Земле', max: 30, desc: 'Добывает все жилы Земли сразу: 1 т/сутки на жилу × эффективность жилы (40 рабочих). Недр хватит на десятки лет.', cost: {fe: 300, cu: 100, ti: 50}, days: 25},
  fuelplant:  {name: 'Топливный завод', desc: 'Перерабатывает лёд в топливо: 20 т/сутки на завод.', cost: {fe: 300, cu: 80}, days: 20},
  sparesplant:{name: 'Завод тех. изделий', desc: 'Делает 1 тех. изделие в сутки из 1 железа и 1 кремния, пока на складе меньше 200.', cost: {fe: 400, ni: 100, si: 100, cu: 60}, days: 30},
  shipyard:   {name: 'Верфь', level: true, max: 3, desc: 'Каждый уровень: +1 стапель и постройка быстрее на 10%.', cost: {fe: 800, ti: 300, cu: 200}, days: 45},
  scicenter:  {name: 'Научный центр', desc: 'Теоретическая наука на Земле: +1 очко в сутки в каждой области на центр.', cost: {fe: 300, si: 200, cu: 100, c: 100}, days: 25},
  academy:    {name: 'Академия', level: true, max: 3, desc: 'Выпуск офицеров раз в 60 суток: 5 человек, каждый уровень добавляет 5 (до 20) и ускоряет выпуск. Навыки выше.', cost: {fe: 600, si: 300, c: 300, cu: 150}, days: 45},
};
// Сотрудники построек: люди из рынка труда Земли, зарплата — средняя по рынку (в масштабе казны)
export const BW = {mine: 20000, fuelplant: 30000, sparesplant: 30000, shipyard: 100000, scicenter: 10000, academy: 50000}, BLD_MIX = [.5, .35, .15, 0], WK = 1e-3;
export const bldWorkers = () => Object.keys(BW).reduce((a, t) => a + (state.bld[t] || 0) * BW[t], 0);
export const bldJobs = s => state.bld ? bldWorkers() * BLD_MIX[s] : 0;
export function bldWage() { const P = state.cols && state.cols.earth && state.cols.earth.pop; if (!P || !state.bld) return 0; let w = 0; for (let s = 0; s < 4; s++) w += bldJobs(s) * P.wage[s]; return w * WK; }
export const techOn = id => !!(state.tech && state.tech[id]);
export const yardSlots = () => 2 + state.bld.shipyard;
export const yardSpeed = () => (1 + 0.1 * (state.bld.shipyard - 1)) * (techOn('fastbuild') ? 1.2 : 1) * tm('build');
export const academyInterval = () => 60 / (1 + 0.3 * state.bld.academy);
export const academyClass = () => 5 + 5 * state.bld.academy;
export const academyBonus = () => 0.5 * state.bld.academy + (techOn('select') ? 1 : 0);
export function bldCost(t) { const b = BLD[t], k = b.level ? Math.max(1, state.bld[t]) : 1; return Object.fromEntries(Object.entries(b.cost).map(([r, v]) => [r, v * k])); }
export function bldQueued(t) { return state.build.filter(j => j.type === t).length; }
export function bldCanAdd(t) { const b = BLD[t]; return !b.level || state.bld[t] + bldQueued(t) < b.max; }
export function buildTick(h) {
  const B = state.bld, S = state.stock;
  state.money -= bldWage() * h; state.bldWageDay = bldWage();
  const ice = Math.min(20 * B.fuelplant * h, S.ice);
  S.ice -= ice; S.fuel += ice; rec('ice', 'out', ice, 'plant'); rec('fuel', 'in', ice, 'plant');
  const sp = Math.max(0, Math.min(B.sparesplant * h, S.fe, S.si, 200 - S.spares));
  S.fe -= sp; S.si -= sp; S.spares += sp; rec('fe', 'out', sp, 'plant'); rec('si', 'out', sp, 'plant'); rec('spares', 'in', sp, 'plant');
  if (B.mine) {
    const g = state.ground.earth, g0 = GROUND.earth; // каждая шахта берёт все жилы сразу, 1 единица в сутки на жилу × эффективность
    for (const k of Object.keys(g)) { const part = Math.min(g[k], B.mine * MINE_RATE * (techOn('deepdrill') ? 1.5 : 1) * tm('mine') * h * veinEff('earth', k, g[k], g0[k] || g[k])); if (part > 0) { g[k] -= part; S[k] = (S[k] || 0) + part; rec(k, 'in', part, 'mine'); } }
  }
  for (const f in FIELDS) state.sci[f] += B.scicenter * h * tm('sci');
  let active = state.build.filter(j => j.started).length;
  for (const j of state.build) {
    if (j.started || active >= 2) continue;
    const c = bldCost(j.type);
    if (stockOK(c)) { for (const [k, v] of Object.entries(c)) { S[k] -= v; rec(k, 'out', v, 'build'); } j.started = true; active++; }
  }
  for (const j of state.build) if (j.started) j.left -= h * (techOn('fastbuild') ? 1.25 : 1) * tm('build');
  const done = state.build.filter(j => j.started && j.left <= 0);
  for (const j of done) { B[j.type]++; log(`Построено: «${BLD[j.type].name}»${BLD[j.type].level ? ', уровень ' + B[j.type] : ', всего ' + B[j.type]}.`); }
  if (done.length) state.build = state.build.filter(j => !done.includes(j));
}

export { TECH };
// Исследование идёт постепенно: выбранной теме достаются очки области и очки по контрактам лабораторий.
export function techSet(id) {
  const t = TECH.find(x => x.id === id); if (!t || state.tech[id]) return;
  state.research = state.research || {}; ensureOffers(['phys', 'eng', 'bio']); if (!(state.offers[t.f] || []).includes(id) && state.research[t.f] !== id) return; state.research[t.f] = state.research[t.f] === id ? null : id;
}
export function researchTick(h) {
  state.research = state.research || {}; state.tprog = state.tprog || {}; state.rp = state.rp || 0; ensureOffers(['phys', 'eng', 'bio']);
  const act = Object.keys(state.research).filter(f => state.research[f]);
  for (const f of act) {
    const t = TECH.find(x => x.id === state.research[f]); if (!t) { state.research[f] = null; continue; }
    let add = state.sci[f]; state.sci[f] = 0;
    if (state.rp > 0) { add += state.rp / act.length; }
    state.tprog[t.id] = (state.tprog[t.id] || 0) + add;
    if (state.tprog[t.id] >= t.cost) { state.tech[t.id] = true; state.research[f] = null; state.offers[f] = (state.offers[f] || []).filter(x => x !== t.id); state.rerolls = state.rerolls || {}; state.rerolls[f] = Math.min(2, (state.rerolls[f] || 0) + 1); dealField(f, state.offers[f]); log(`Изучено: «${t.name}» (${f === 'phys' ? 'физика' : f === 'eng' ? 'инженерия' : 'биология'}). Новые карточки исследований.`); }
  }
  if (act.length) state.rp = 0;
}
// наука от лабораторий корабля или станции на теле с аномалией
export function produceSci(ent, bodyId, h) {
  const b = BODY[bodyId], pool = state.sites[bodyId]; if (!b || !b.sci || !pool) return 0;
  let tot = 0;
  for (const f in FIELDS) {
    const n = ent.st.labs[f]; if (!n || !b.sci[f] || pool[f] <= 0) continue;
    const a = Math.min(pool[f], n * b.sci[f] * h * sciMult(ent));
    pool[f] -= a; state.sci[f] += a; tot += a;
  }
  if (tot > 0) { train(ent, 'sci', h, 200); if (b.hot && ent.eq) useWear(ent, 'life', 1.5 * h, 0.01 * h); }
  return tot;
}
export function sciTick(h) {
  for (const st of state.stations) if (st.at && !st.towedBy && BODY[st.at] && BODY[st.at].sci && st.st.labsTotal) produceSci(st, st.at, h);
}
