// @ts-nocheck
import { gd } from './00-gd.ts';
import { BODY, FIELDS, GROUND, log, rec, state, stockOK, veinEff } from './01-data.ts';
import { KR } from './00-kr.ts';
import { TECH, techById, tm, ensureOffers, dealField } from './15-techs.ts';
import { sciMult, train, useWear } from './02-crew.ts';

/* ===== ЗДАНИЯ НА ЗЕМЛЕ ===== */
export const MINE_RATE = 1;
export const BLD = gd('buildings', 'buildings', {
  cfactory:   {name: 'Строительный завод', sb: 2000, cost: {fe: 400, cu: 80, c: 80}, desc: 'Даёт 50 СБ в сутки на всю стройку (здания, госзаводы, шахты, верфи). На старте 10.'},
  mine:       {name: 'Шахта на Земле', sb: 500, desc: 'Добывает все жилы Земли сразу: 1 т/сутки на жилу × эффективность жилы (40 рабочих). Недр хватит на десятки лет.', cost: {fe: 300, cu: 100, ti: 50}, days: 25},
  fuelplant:  {name: 'Топливный завод', desc: 'Перерабатывает лёд в топливо: 20 т/сутки на завод.', cost: {fe: 300, cu: 80}, days: 20},
  sparesplant:{name: 'Завод тех. изделий', desc: 'Делает 1 тех. изделие в сутки из 1 железа и 1 кремния, пока на складе меньше 200.', cost: {fe: 400, ni: 100, si: 100, cu: 60}, days: 30},
  shipyard:   {name: 'Верфь', sb: 5000, tech: 'yard', desc: 'Новая верфь: свой стапель, до 1 000 т корабля, 1 бригада (10 000 чел., 1 т корабля в сутки). Тоннаж и бригады верфи расширяются ниже, каждый раз дороже.', cost: {fe: 800, ti: 300, cu: 200}, days: 45},
  scicenter:  {name: 'Научный центр', desc: 'Теоретическая наука на Земле: +1 очко в сутки в каждой области на центр.', cost: {fe: 300, si: 200, cu: 100, c: 100}, days: 25},
  academy:    {name: 'Академия', level: true, desc: 'Выпуск офицеров раз в 60 суток: 5 человек, каждый уровень добавляет 5 (до 20) и ускоряет выпуск. Навыки выше.', cost: {fe: 600, si: 300, c: 300, cu: 150}, days: 45},
  cbureau:    {name: 'Строительное бюро', desc: '+1 бригада (10 000 чел., 1 СБ в сутки). Зарплата идёт всегда; когда у вас нет стройки, бригады сдаются корпорациям', cost: {fe: 400, ti: 100, cu: 100, si: 60}, days: 25},
  // --- научные институты ---
  instphys:   {name: 'Институт физики', desc: '+4 очка физики в сутки на здание.', cost: {fe: 300, si: 300, cu: 150, c: 100}, days: 30},
  insteng:    {name: 'Инженерное бюро', desc: '+4 очка инженерии в сутки на здание.', cost: {fe: 400, ti: 150, cu: 150, si: 150}, days: 30},
  instbio:    {name: 'Биологический институт', desc: '+4 очка биологии в сутки на здание.', cost: {fe: 250, c: 300, si: 200, cu: 100}, days: 30},
  market:     {name: 'Научный рынок', level: true, desc: 'Очки исследований у лабораторий корпораций дешевле на 5% за уровень.', cost: {fe: 200, si: 250, cu: 150}, days: 30},
  // --- промышленность ---
  fuelplant2: {name: 'Термоядерный топливный завод', desc: 'Перерабатывает лёд в топливо: 100 т/сутки на завод. Нужна технология «Модуль: Термоядерный двигатель».', cost: {fe: 900, ti: 300, cu: 300, ni: 100}, days: 50, tech: 'fusion'},
  sparesfab:  {name: 'Автоматическая фабрика изделий', desc: '6 тех. изделий в сутки из железа и кремния, склад до 600. Нужна «Автоматизация цехов».', cost: {fe: 800, ni: 200, si: 300, cu: 200}, days: 45, tech: 'autofab'},
  crusher:    {name: 'Дробильный комплекс', level: true, desc: 'Шахты на Земле добывают на 8% больше за уровень.', cost: {fe: 500, ti: 150, cu: 150}, days: 30},
  techpark:   {name: 'Технопарк', level: true, desc: 'Заводы мира выпускают на 3% больше за уровень.', cost: {fe: 600, si: 400, cu: 300, c: 150}, days: 40},
  composite:  {name: 'Композитный цех', level: true, desc: 'Грузоподъёмность всех кораблей +5% за уровень.', cost: {ti: 300, c: 300, cu: 150}, days: 35},
  enginefab:  {name: 'Двигательный завод', level: true, desc: 'Тяга двигателей всех кораблей +5% за уровень.', cost: {ti: 300, ni: 200, pt: 20, cu: 150}, days: 40},
  // --- флот и логистика ---
  spaceport:  {name: 'Космопорт', level: true, desc: 'Грузовой фрахт дешевле на 4%, рейсы быстрее на 8% за уровень.', cost: {fe: 700, ti: 250, cu: 200}, days: 45},
  colbureau:  {name: 'Колонизационное бюро', level: true, desc: 'Инфраструктура для колоний дешевле на 5% за уровень.', cost: {fe: 400, si: 300, c: 200}, days: 35},
  testrange:  {name: 'Испытательный полигон', level: true, desc: 'Отказы узлов реже на 6% за уровень.', cost: {fe: 500, ni: 150, ti: 100, cu: 100}, days: 35},
  repairdock: {name: 'Ремонтный док', level: true, desc: 'Ремонт идёт быстрее на 20% за уровень.', cost: {fe: 500, ti: 200, cu: 150}, days: 35},
  trainctr:   {name: 'Учебный центр', level: true, desc: 'Навыки офицеров растут быстрее на 20% за уровень.', cost: {fe: 300, si: 250, c: 150}, days: 30},
  miningsch:  {name: 'Горная школа', level: true, desc: 'Добыча лазерами кораблей +6% за уровень.', cost: {fe: 300, si: 200, c: 100, cu: 100}, days: 30},
  // --- общество и деньги ---
  hospital:   {name: 'Медицинский центр', level: true, desc: 'Смертность во всех колониях −3% за уровень.', cost: {fe: 300, c: 300, si: 200, cu: 100}, days: 30},
  maternity:  {name: 'Центр семьи', level: true, desc: 'Рождаемость во всех колониях +4% за уровень.', cost: {fe: 300, c: 250, si: 150}, days: 30},
  chamber:    {name: 'Торговая палата', desc: '+2% к налогам на космос на здание.', cost: {fe: 300, si: 200, cu: 150}, days: 30},
  exchange:   {name: 'Биржа', desc: '+5% к налогам на космос на здание. ', cost: {fe: 600, si: 500, cu: 300, c: 200}, days: 45, },
}); // правится в data/buildings.json
// Стройка (решено с владельцем): любое здание — в строительных баллах (СБ), только работа бригад, без материалов.
// Бригада = 10 000 человек, 1 СБ в сутки. В каждом здании работают 10 000 человек. Шахта 500 СБ, завод и прочее 1 000, верфь 5 000;
// улучшение уровня — 1 000 × 1,5^уровень. Расширение верфи (+1 000 т или +1 бригада) — 500 × 1,5^(номер расширения этого вида).
export const BRIG = 10000, CREW = 10000, BLD_MIX = [.5, .35, .15, 0], WK = 1; // зарплаты построек — полные (налоги по варианту Б)
export const BW = Object.fromEntries(Object.keys(BLD).map(t => [t, CREW]));
export const bldSB = t => { const b = BLD[t]; return Math.round((b.sb || 1000) * (b.level ? Math.pow(1.5, state.bld[t] || 0) : 1)); };
export const brigades = () => (2 + (state.bld.cbureau || 0)); // свои: зарплата идёт всегда
export const rentN = () => (state.build && state.build.length ? (state.rent || []).reduce((a, r) => a + r.n, 0) : 0); // арендованные у корпораций
export const ECON = gd('buildings', 'econ', {CF_SB: 50, ECON_SB: {efac: 1000, emine: 500, elab: 1000}, ECON_MAT: {efac: {fe: 20, cu: 4, si: 4}, emine: {fe: 15, c: 3}, elab: {fe: 10, si: 12, cu: 4}, yardton: {fe: 80, ti: 10}, yardcrew: {fe: 20, cu: 5}}, matDiv: 10});
export const CF_SB = ECON.CF_SB; // СБ в сутки от строительного завода
export const buildUnits = () => ((brigades() + rentN()) + (state.bld.cfactory || 0) * CF_SB) * tm('build') * tm('buildu'); // СБ в сутки: бригады + строительные заводы
export const buildSlots = () => brigades() + rentN();
export const HIRE_PRICE = 120000 * KR;
// верфи игрока: у каждой свой предельный тоннаж и свои бригады; 1 бригада (10 000 чел.) = 1 т корабля в сутки
export function yards() { if (!state.yards) { state.yards = []; for (let i = 0; i < (state.bld.shipyard || 0); i++) state.yards.push({ton: 1000, crews: 1, nt: 0, nc: 0}); } while (state.yards.length < (state.bld.shipyard || 0)) state.yards.push({ton: 1000, crews: 1, nt: 0, nc: 0}); return state.yards; }
export const yardUpSB = (y, kind) => Math.round(500 * Math.pow(1.5, kind === 'ton' ? y.nt : y.nc));
export const yardRate = y => y.crews * (techOn('fastbuild') ? 1.2 : 1) * tm('build'); // т корабля в сутки
export const bldWorkers = () => Object.keys(BW).reduce((a, t) => a + (state.bld[t] || 0) * BW[t], 0) - (state.bld.shipyard || 0) * CREW + brigades() * BRIG + yards().reduce((a, y) => a + y.crews * CREW, 0);
export const bldJobs = s => state.bld ? bldWorkers() * BLD_MIX[s] : 0;
export function bldWage() { const P = state.cols && state.cols.earth && state.cols.earth.pop; if (!P || !state.bld) return 0; let w = 0; for (let s = 0; s < 4; s++) w += bldJobs(s) * P.wage[s]; return w * WK; }
export const techOn = id => !!(state.tech && state.tech[id]);
export const yardSlots = () => yards().length;
export const yardSpeed = () => yards().reduce((a, y) => a + yardRate(y), 0); // т/сут всеми верфями
export const academyInterval = () => 60 / (1 + 0.3 * state.bld.academy);
export const academyClass = () => 5 + 5 * state.bld.academy;
export const academyBonus = () => 0.5 * state.bld.academy + (techOn('select') ? 1 : 0);
// Материалы постройки (решено с владельцем): у каждой свой набор, списываются со склада в начале каждой единицы
export const ECON_MAT = ECON.ECON_MAT;
export function matOf(j) { const t = j.type || j, m = ECON_MAT[t]; if (m) return m; const c = BLD[t] && BLD[t].cost; if (!c) return {}; const o = {}; for (const r in c) o[r] = Math.max(1, Math.round(c[r] / (ECON.matDiv || 1))); return o; }
export function bldCost(t) { return matOf(t); }
// сколько материалов нужно всей очереди (держим на складе, не продаём Земле)
// резерв: материалы на ближайшие 30 суток стройки по каждому проекту (не вся очередь — иначе Земле ничего не достаётся)
export function queueMat() { const o = {}, cap = buildUnits(); let left = 100;
  for (const j of state.build || []) { const m = matOf(j), e = Math.min(j.pct || 0, left); left -= e; const u = unitSB(j), n = Math.min((j.n || 1) - (j.paid ? 1 : 0), Math.ceil(cap * e / 100 * 30 / Math.max(1, u)));
    for (const r in m) o[r] = (o[r] || 0) + m[r] * Math.max(0, n); } return o; }
import { hooks as _hk } from './00-hooks.ts';
_hk.queueMat = () => queueMat();
export const matTxt = m => Object.entries(m).map(([r, v]) => `${(RESN[r] || r).toLowerCase()} ${v}`).join(', ');
const RESN = {fe: 'Железо', ni: 'Никель', ti: 'Титан', cu: 'Медь', si: 'Кремний', c: 'Углерод', ice: 'Лёд', pt: 'Платиноиды', ree: 'Редкоземельные', u: 'Уран'};
export function bldQueued(t) { return state.build.filter(j => j.type === t).reduce((a, j) => a + (j.n || 1), 0); }
// Очередь стройки (как в Aurora): у проекта количество n и доля мощности pct (%). Мощность = бригады + строительные заводы.
// Типы: здание из BLD; 'yardton'/'yardcrew' (yi — верфь); 'efac' (g — товар: госзавод Земли), 'emine' (госшахта), 'elab' (лаборатория).
export const ECON_SB = ECON.ECON_SB;
export function unitSB(j) { return j.type === 'yardton' || j.type === 'yardcrew' ? yardUpSB(yards()[j.yi] || {nt: 0, nc: 0}, j.type === 'yardton' ? 'ton' : 'crew') : ECON_SB[j.type] || bldSB(j.type); }
export function queueBld(t, yi, n = 1, pct = 10, g) { n = Math.max(1, Math.floor(+n || 1)); pct = Math.max(0, Math.min(100, +pct || 0)); // доля сохраняется как задана; лишнее ждёт своей очереди
  if (BLD[t]) { const b = BLD[t], room = (b.max || 99999) - state.bld[t] - bldQueued(t); n = Math.min(n, room); if (n <= 0) return false; }
  state.build.push({id: Date.now() + Math.random(), type: t, yi, g, n, pct, prog: 0}); return true; }
export const pctSum = () => Math.min(100, state.build.reduce((a, j) => a + (j.pct || 0), 0)); // сколько мощности реально занято
// по порядку очереди: каждый берёт свою долю, пока сумма не дойдёт до 100%; остальные ждут
export function effPct() { let left = 100; for (const j of state.build) { j.eff = j.paid === false && j.wait ? 0 : Math.max(0, Math.min(j.pct || 0, left)); left -= j.eff; } } // ждущие материалы мощность не занимают
export function bldGate(t) { const b = BLD[t]; return b.tech && !techOn(b.tech) ? 'Нужна технология: «' + techById(b.tech).name + '»' : ''; }
export function bldCanAdd(t) { const b = BLD[t]; if (bldGate(t)) return false; return state.bld[t] + bldQueued(t) < (b.max || 99999); }
export function buildTick(h) {
  const B = state.bld, S = state.stock; for (const t in BLD) if (B[t] == null) B[t] = 0;
  if (state.rent && state.rent.length) { // аренда бригад у корпораций: платим, пока есть стройка
    if (!state.build.length) state.rent = [];
    for (const r of state.rent) { const c = (state.corps || []).find(x => x.id === r.id), p = r.n * r.price * tm('hire') * h; if (!c || state.money < p) { r.n = 0; continue; } state.money -= p; c.credits += p; c.brigInc = (c.brigInc || 0) + p; }
    state.rent = state.rent.filter(r => r.n > 0); }
  { const w = bldWage() * h, f = Math.min(w, Math.max(0, state.invFund || 0)); state.invFund = (state.invFund || 0) - f; state.money -= w - f; state.bldWageDay = bldWage(); } // зарплаты стройки и построек: сначала фонд госинвестиций
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
    const T = (state.cols && state.cols.earth && state.cols.earth.pop.tax) || 0, inc = T * (.02 * B.chamber + .05 * B.exchange) * h; if (inc > 0) state.money += inc; } // палата/биржа — доля налогов на космос
  // мощность делится по долям проектов (сумма долей больше 100% — урезается пропорционально)
  const cap = buildUnits();
  for (const j of state.build) { if (j.paid) continue; const m = matOf(j), lack = Object.keys(m).filter(r => (S[r] || 0) < m[r]); // оплатить материалы текущей единицы
    if (lack.length) { j.paid = false; j.wait = 'нет материалов: ' + lack.map(r => `${(RESN[r] || r).toLowerCase()} ${Math.ceil(m[r] - (S[r] || 0))}`).join(', '); continue; }
    for (const r in m) { S[r] -= m[r]; rec(r, 'out', m[r], 'build'); } j.paid = true; j.wait = null; }
  effPct();
  for (const j of state.build) {
    if (j.n == null) { j.n = 1; j.pct = j.pct == null ? 100 / Math.max(1, state.build.length) : j.pct; j.prog = (j.total || 0) - (j.left || 0); } // старые сохранения
    j.prog += cap * j.eff / 100 * h; j.rate = cap * j.eff / 100;
    let c = unitSB(j);
    if (!j.paid) { j.rate = 0; continue; }
    if (j.n > 0 && j.prog >= c) { j.prog -= c; j.n--; finish(j); j.paid = false; c = unitSB(j); if (j.prog >= c) j.prog = c - 1e-9; } // каждая следующая единица снова платит материалы
  }
  state.build = state.build.filter(j => j.n > 0);
}

function finish(j) {
  const B = state.bld, P = state.cols && state.cols.earth && state.cols.earth.pop;
  if (j.type === 'yardton' || j.type === 'yardcrew') { const y = yards()[j.yi]; if (y) { if (j.type === 'yardton') { y.ton += 1000; y.nt++; } else { y.crews++; y.nc++; } log(`Верфь №${j.yi + 1}: ${j.type === 'yardton' ? 'предельный тоннаж ' + fmtT(y.ton) : 'бригад ' + y.crews}.`); } return; }
  if (j.type === 'efac') { if (P) P.fac[j.g] = (P.fac[j.g] || 0) + 1; if (j.n === 0) log(`Достроены госзаводы: ${j.g}.`); return; }
  if (j.type === 'emine') { if (P) P.lmN = (P.lmN || 0) + 1; if (j.n === 0) log('Достроены госшахты.'); return; }
  if (j.type === 'elab') { state.labs = (state.labs || 0) + 1; if (j.n === 0) log('Достроены лаборатории.'); return; }
  B[j.type]++; if (j.type === 'shipyard') yards(); if (j.n === 0 || BLD[j.type].level) log(`Построено: «${BLD[j.type].name}»${BLD[j.type].level ? ', уровень ' + B[j.type] : ', всего ' + B[j.type]}.`);
}
const fmtT = x => Math.round(x).toLocaleString('ru-RU') + ' т';
export { TECH };
// Исследование идёт постепенно: выбранной теме достаются очки области и очки по контрактам лабораторий.
export function techSet(id) {
  const t = TECH.find(x => x.id === id); if (!t || state.tech[id]) return;
  state.research = state.research || {}; ensureOffers(['phys', 'eng', 'bio']); if (!(state.offers[t.f] || []).includes(id) && state.research[t.f] !== id) return; state.research[t.f] = state.research[t.f] === id ? null : id;
}
export function researchTick(h) {
  state.research = state.research || {}; state.tprog = state.tprog || {}; state.rp = state.rp || 0; ensureOffers(['phys', 'eng', 'bio']);
  const act = Object.keys(state.research).filter(f => state.research[f]);
  // копилка: пока тема не выбрана, очки области не сгорают — копятся до 60 суток выработки (решено с владельцем)
  { const L = state.sciLast = state.sciLast || {}, R = state.sciRate = state.sciRate || {};
    for (const f of ['phys', 'eng', 'bio']) { const inflow = Math.max(0, (state.sci[f] || 0) - (L[f] || 0)); if (h > 0) R[f] = (R[f] || inflow / h) * .98 + inflow / h * .02;
      if (!state.research[f]) state.sci[f] = Math.min(state.sci[f] || 0, Math.max(60 * (R[f] || 0), 1)); }
    const rin = Math.max(0, state.rp - (L.rp || 0)); if (h > 0) R.rp = (R.rp || rin / h) * .98 + rin / h * .02; if (!act.length) state.rp = Math.min(state.rp, Math.max(60 * (R.rp || 0), 1)); }
  for (const f of act) {
    const t = TECH.find(x => x.id === state.research[f]); if (!t) { state.research[f] = null; continue; }
    let add = state.sci[f]; state.sci[f] = 0;
    if (state.rp > 0) { add += state.rp / act.length; }
    state.tprog[t.id] = (state.tprog[t.id] || 0) + add;
    if (state.tprog[t.id] >= t.cost) { state.sci[f] = (state.sci[f] || 0) + state.tprog[t.id] - t.cost; /* остаток не сгорает */ state.tech[t.id] = true; state.research[f] = null; state.offers[f] = (state.offers[f] || []).filter(x => x !== t.id); state.rerolls = state.rerolls || {}; state.rerolls[f] = Math.min(2, (state.rerolls[f] || 0) + 1); dealField(f, state.offers[f]); log(`Изучено: «${t.name}» (${f === 'phys' ? 'физика' : f === 'eng' ? 'инженерия' : 'биология'}). Новые карточки исследований.`); }
  }
  if (act.length) state.rp = 0;
  { const L = state.sciLast; for (const f of ['phys', 'eng', 'bio']) L[f] = state.sci[f] || 0; L.rp = state.rp; }
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
