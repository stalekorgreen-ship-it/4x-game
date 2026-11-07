// @ts-nocheck
import { BODY, FIELDS, GROUND, log, rec, state, stockOK, veinEff } from './01-data.ts';
import { TECH, techById, tm, ensureOffers, dealField } from './15-techs.ts';
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
  cbureau:    {name: 'Строительное бюро', max: 20, desc: '+10 единиц стройки в сутки: здания и улучшения возводятся быстрее, параллельных бригад на одну больше.', cost: {fe: 400, ti: 100, cu: 100, si: 60}, days: 25},
  // --- научные институты ---
  instphys:   {name: 'Институт физики', max: 6, desc: '+4 очка физики в сутки на здание.', cost: {fe: 300, si: 300, cu: 150, c: 100}, days: 30},
  insteng:    {name: 'Инженерное бюро', max: 6, desc: '+4 очка инженерии в сутки на здание.', cost: {fe: 400, ti: 150, cu: 150, si: 150}, days: 30},
  instbio:    {name: 'Биологический институт', max: 6, desc: '+4 очка биологии в сутки на здание.', cost: {fe: 250, c: 300, si: 200, cu: 100}, days: 30},
  market:     {name: 'Научный рынок', level: true, max: 3, desc: 'Очки исследований у лабораторий корпораций дешевле на 5% за уровень.', cost: {fe: 200, si: 250, cu: 150}, days: 30},
  // --- промышленность ---
  fuelplant2: {name: 'Термоядерный топливный завод', max: 10, desc: 'Перерабатывает лёд в топливо: 100 т/сутки на завод. Нужна технология «Термоядерные станции».', cost: {fe: 900, ti: 300, cu: 300, ni: 100}, days: 50, tech: 'power2'},
  sparesfab:  {name: 'Автоматическая фабрика изделий', max: 10, desc: '6 тех. изделий в сутки из железа и кремния, склад до 600. Нужна «Автоматизация цехов».', cost: {fe: 800, ni: 200, si: 300, cu: 200}, days: 45, tech: 'auto1'},
  crusher:    {name: 'Дробильный комплекс', level: true, max: 5, desc: 'Шахты на Земле добывают на 8% больше за уровень.', cost: {fe: 500, ti: 150, cu: 150}, days: 30},
  techpark:   {name: 'Технопарк', level: true, max: 3, desc: 'Заводы мира выпускают на 3% больше за уровень.', cost: {fe: 600, si: 400, cu: 300, c: 150}, days: 40},
  composite:  {name: 'Композитный цех', level: true, max: 3, desc: 'Грузоподъёмность всех кораблей +5% за уровень.', cost: {ti: 300, c: 300, cu: 150}, days: 35},
  enginefab:  {name: 'Двигательный завод', level: true, max: 3, desc: 'Тяга двигателей всех кораблей +5% за уровень.', cost: {ti: 300, ni: 200, pt: 20, cu: 150}, days: 40},
  // --- флот и логистика ---
  spaceport:  {name: 'Космопорт', level: true, max: 3, desc: 'Грузовой фрахт дешевле на 4%, рейсы быстрее на 8% за уровень.', cost: {fe: 700, ti: 250, cu: 200}, days: 45},
  colbureau:  {name: 'Колонизационное бюро', level: true, max: 3, desc: 'Инфраструктура для колоний дешевле на 5% за уровень.', cost: {fe: 400, si: 300, c: 200}, days: 35},
  testrange:  {name: 'Испытательный полигон', level: true, max: 3, desc: 'Отказы узлов реже на 6% за уровень.', cost: {fe: 500, ni: 150, ti: 100, cu: 100}, days: 35},
  repairdock: {name: 'Ремонтный док', level: true, max: 3, desc: 'Ремонт идёт быстрее на 20% за уровень.', cost: {fe: 500, ti: 200, cu: 150}, days: 35},
  trainctr:   {name: 'Учебный центр', level: true, max: 3, desc: 'Навыки офицеров растут быстрее на 20% за уровень.', cost: {fe: 300, si: 250, c: 150}, days: 30},
  miningsch:  {name: 'Горная школа', level: true, max: 3, desc: 'Добыча лазерами кораблей +6% за уровень.', cost: {fe: 300, si: 200, c: 100, cu: 100}, days: 30},
  // --- общество и деньги ---
  hospital:   {name: 'Медицинский центр', level: true, max: 5, desc: 'Смертность во всех колониях −3% за уровень.', cost: {fe: 300, c: 300, si: 200, cu: 100}, days: 30},
  maternity:  {name: 'Центр семьи', level: true, max: 5, desc: 'Рождаемость во всех колониях +4% за уровень.', cost: {fe: 300, c: 250, si: 150}, days: 30},
  chamber:    {name: 'Торговая палата', max: 5, desc: 'Приносит 60 000 кр в сутки на здание.', cost: {fe: 300, si: 200, cu: 150}, days: 30},
  exchange:   {name: 'Биржа', max: 5, desc: 'Приносит 150 000 кр в сутки на здание. Нужна «Здоровая рабочая сила».', cost: {fe: 600, si: 500, cu: 300, c: 200}, days: 45, tech: 'tax1'},
};
// Сотрудники построек: люди из рынка труда Земли, зарплата — средняя по рынку (в масштабе казны)
export const BW = {mine: 20000, fuelplant: 30000, sparesplant: 30000, cbureau: 10000, shipyard: 100000, scicenter: 10000, academy: 50000, instphys: 20000, insteng: 20000, instbio: 20000, market: 10000, fuelplant2: 60000, sparesfab: 50000, crusher: 30000, techpark: 80000, composite: 40000, enginefab: 50000, spaceport: 100000, colbureau: 15000, testrange: 25000, repairdock: 30000, trainctr: 15000, miningsch: 12000, hospital: 40000, maternity: 20000, chamber: 10000, exchange: 25000}, BLD_MIX = [.5, .35, .15, 0], WK = 1e-3;
export const buildUnits = () => (5 + 10 * (state.bld.cbureau || 0) + 10 * (state.hire || 0)) * tm('buildu');
export const buildSlots = () => 2 + (state.bld.cbureau || 0) + (state.hire || 0);
export const HIRE_PRICE = 120000;
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
export function bldGate(t) { const b = BLD[t]; return b.tech && !techOn(b.tech) ? 'Нужна технология: «' + techById(b.tech).name + '»' : ''; }
export function bldCanAdd(t) { const b = BLD[t]; if (bldGate(t)) return false; return state.bld[t] + bldQueued(t) < (b.max || 99999); }
export function buildTick(h) {
  const B = state.bld, S = state.stock; for (const t in BLD) if (B[t] == null) B[t] = 0;
  if (state.hire) { const cs = state.corps || [], pay = state.hire * HIRE_PRICE * tm('hire') * h; if (cs.length && state.money >= pay) { state.money -= pay; cs[Math.floor(state.t) % cs.length].credits += pay; } else state.hire = 0; }
  state.money -= bldWage() * h; state.bldWageDay = bldWage();
  const ice = Math.min(20 * B.fuelplant * h, S.ice);
  S.ice -= ice; S.fuel += ice; rec('ice', 'out', ice, 'plant'); rec('fuel', 'in', ice, 'plant');
  const sp = Math.max(0, Math.min(B.sparesplant * h, S.fe, S.si, 200 - S.spares));
  S.fe -= sp; S.si -= sp; S.spares += sp; rec('fe', 'out', sp, 'plant'); rec('si', 'out', sp, 'plant'); rec('spares', 'in', sp, 'plant');
  if (B.mine) {
    const g = state.ground.earth, g0 = GROUND.earth; // каждая шахта берёт все жилы сразу, 1 единица в сутки на жилу × эффективность
    for (const k of Object.keys(g)) { const part = Math.min(g[k], B.mine * MINE_RATE * (techOn('deepdrill') ? 1.5 : 1) * tm('mine') * h * veinEff('earth', k, g[k], g0[k] || g[k])); if (part > 0) { g[k] -= part; S[k] = (S[k] || 0) + part; rec(k, 'in', part, 'mine'); } }
  }
  for (const f in FIELDS) state.sci[f] += (B.scicenter + 4 * B['inst' + f]) * h * tm('sci');
  { const ice2 = Math.min(100 * B.fuelplant2 * h, S.ice); if (ice2 > 0) { S.ice -= ice2; S.fuel += ice2; rec('ice', 'out', ice2, 'plant'); rec('fuel', 'in', ice2, 'plant'); }
    const sp2 = Math.max(0, Math.min(6 * B.sparesfab * h, S.fe, S.si, 600 - S.spares)); if (sp2 > 0) { S.fe -= sp2; S.si -= sp2; S.spares += sp2; rec('fe', 'out', sp2, 'plant'); rec('si', 'out', sp2, 'plant'); rec('spares', 'in', sp2, 'plant'); }
    const inc = (60000 * B.chamber + 150000 * B.exchange) * h; if (inc > 0) state.money += inc; }
  let active = state.build.filter(j => j.started).length;
  for (const j of state.build) {
    if (j.started || active >= buildSlots()) continue;
    const c = bldCost(j.type);
    if (stockOK(c)) { for (const [k, v] of Object.entries(c)) { S[k] -= v; rec(k, 'out', v, 'build'); } j.started = true; active++; }
  }
  { const act = state.build.filter(j => j.started).length || 1, rate = buildUnits() / act / 5; for (const j of state.build) if (j.started) j.left -= h * rate * (techOn('fastbuild') ? 1.25 : 1) * tm('build'); }
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
