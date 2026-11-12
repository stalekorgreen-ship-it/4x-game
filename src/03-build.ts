// @ts-nocheck
import { gd, DEFAULTS } from './00-gd.ts';
import { BODY, FIELDS, GROUND, log, rec, state, stockOK, veinEff, myOf } from './01-data.ts';
import { KR } from './00-kr.ts';
import { gval } from './26-goods.ts';
import { TECH, techById, tm, ensureOffers, dealField, BEFF } from './15-techs.ts';
import { sciMult, train, useWear } from './02-crew.ts';

/* ===== ЗДАНИЯ НА ЗЕМЛЕ ===== */
export const MINE_RATE = 1;
export const BLD = gd('buildings', 'buildings', {
  // Здания игрока — по таблице «Пояс» (вкладка «Здания», верх). cost — реальные тонны; crew — рабочих; use — расход в год (энергия — МВт постоянно), оплачивается деньгами по цене товара;
  // sci — очков науки в сутки в каждой области; cbSB — СБ в сутки; make — переработка со склада на склад; fac — сколько госзаводов товара даёт здание Земле.
  lab:       {name: 'Лаборатория', sb: 400, cost: {fe: 5000, ree: 20, pt: 2}, sci: {phys: 10, eng: 10, bio: 10}, use: {pow: 10, elx: 1000}, desc: 'Даёт 10 очков науки в сутки во всех областях. Позволяет изучать аномалии на планете. Расход: 10 МВт, 1 000 т электроники в год, 10 000 человек с высшим образованием.'},
  dcenter:   {name: 'Дата-центр', sb: 800, cost: {fe: 20000, si: 5000, ree: 100, pt: 5}, sci: {phys: 50, eng: 50, bio: 50}, use: {pow: 100, elx: 1000}, desc: 'Даёт 50 очков науки в сутки во всех областях. Расход: 100 МВт, 1 000 т электроники в год, 10 000 экспертов, 7 млн т воды (пар).'},
  mine:      {name: 'Государственная шахта', sb: 100, cost: {fe: 20000, ti: 200}, use: {pow: 50}, desc: 'Добывает 1 млн т породы в год: железо 1 165 т/сут, уголь и нефть 1 500, кремний 582, титан и редкозем 2,3, уран 1,2, платина 12 кг (× эффективность жилы). Всё — на ваш склад. Расход: 50 МВт, 10 000 человек низкого образования.'},
  gbuild:    {name: 'Государственная стройка', sb: 100, cost: {fe: 5000}, cbSB: 10, desc: 'Даёт 10 СБ в сутки на всю стройку. 10 000 человек низкого образования.'},
  shipyard:  {name: 'Военная космическая верфь', sb: 4000, cost: {fe: 100000, ti: 2000, w: 500, ree: 200, pt: 10}, desc: 'Верфь в космосе: стапель до 1 000 т, 1 бригада (10 000 чел.) строит 1 т корабля в сутки. Тоннаж и бригады расширяются ниже, каждый раз дороже. 10 000 экспертов.'},
  green:     {name: 'Зелёная энергетика', sb: 100, cost: {fe: 40000, si: 3000, ree: 50}, crew: 0, fac: {pow: 0.3}, use: {elx: 50}, desc: 'Вырабатывает 600 МВт для Земли по цене самоокупа. Расход: 50 т электроники в год.'},
  tps:       {name: 'Государственная ТЭС', sb: 200, cost: {fe: 100000}, crew: 0, fac: {pow: 1}, desc: 'Вырабатывает 2 000 МВт для Земли по цене самоокупа. Сжигает 3 млн т угля и нефти в год, 7,5 млн т CO₂. 10 000 человек среднего образования.'},
  npp:       {name: 'Государственная АЭС', sb: 1000, cost: {fe: 200000, ti: 500, w: 100, u: 2000}, crew: 0, fac: {pow: 3}, desc: 'Вырабатывает 6 000 МВт для Земли по цене самоокупа. 1 200 т урана в год. 10 000 человек высшего образования.'},
  lifeinfra: {name: 'Инфраструктура жизнеобеспечения', sb: 50, cost: {fe: 20000, w: 100, si: 2000}, crew: 0, desc: 'Позволяет жить 10 000 граждан на непригодной планете (годность 0,1). На Земле не нужна.'},
  fuelplant: {name: 'Топливный завод', sb: 200, cost: {fe: 50000, ree: 100}, make: {in: {c: 1.5}, out: {fuel: 1}, perDay: 2740}, use: {pow: 50}, desc: 'Делает 1 млн т топлива в год (2 740 т/сут) из 1,5 млн т угля и нефти со склада — на ваш склад. Расход: 50 МВт, 10 000 человек среднего образования.'},
  supplies:  {name: 'Фабрика припасов', sb: 200, cost: {fe: 30000, ti: 200}, make: {in: {fe: 0.8, ree: 0.01}, out: {spares: 1}, perDay: 137}, use: {pow: 20}, desc: 'Делает 50 000 т припасов в год (еда в рейс, запчасти, расходники) из 40 000 т железа и 500 т редкозема — на ваш склад. Расход: 20 МВт, 10 000 человек среднего образования.'},
  housing:   {name: 'Социальное жильё', sb: 10, cost: {fe: 5000}, crew: 0, fac: {house: 0.02}, desc: 'Жильё на 10 000 человек бесплатно. Приходит в негодность через 50 лет.'},
  cityhosp:  {name: 'Городская больница', sb: 30, cost: {fe: 10000}, crew: 0, fac: {meds: 0.7}, desc: 'Медицина на 400 000 человек бесплатно. 10 000 человек высшего образования.'},
  school:    {name: 'Образовательное учреждение', sb: 30, cost: {fe: 10000}, crew: 0, fac: {edu: 1}, desc: 'Учит 150 000 учеников бесплатно. 10 000 человек высшего образования.'},
  institute: {name: 'Институт с узкой специализацией', sb: 50, cost: {fe: 10000, si: 500, ree: 20, pt: 2}, crew: 0, fac: {exp: 1}, desc: 'Учит 20 000 студентов-экспертов бесплатно. 10 000 человек высшего образования.'},
}); // правится в data/buildings.json
// модификаторы зданий за уровень (beff) — тоже в файле; встроенные берём из BEFF
for (const t in BEFF) if (BLD[t] && !BLD[t].beff) { BLD[t].beff = {...BEFF[t]}; const D = DEFAULTS.buildings && DEFAULTS.buildings.buildings; if (D && D[t]) D[t].beff = {...BEFF[t]}; }
// Стройка (решено с владельцем): любое здание — в строительных баллах (СБ), только работа бригад, без материалов.
// Бригада = 10 000 человек, 1 СБ в сутки. В каждом здании работают 10 000 человек. Шахта 500 СБ, завод и прочее 1 000, верфь 5 000;
// улучшение уровня — 1 000 × 1,5^уровень. Расширение верфи (+1 000 т или +1 бригада) — 500 × 1,5^(номер расширения этого вида).
export const BRIG = 10000, CREW = 10000, BLD_MIX = [.5, .35, .15, 0], WK = 1; // зарплаты построек — полные (налоги по варианту Б)
export const BW = Object.fromEntries(Object.keys(BLD).map(t => [t, BLD[t].crew != null ? BLD[t].crew : CREW]));
export const bldSB = t => { const b = BLD[t]; return Math.round((b.sb || 1000) * (b.level ? Math.pow(1.5, state.bld[t] || 0) : 1)); };
export const brigades = () => (2 + (state.bld.cbureau || 0)); // свои: зарплата идёт всегда
export const rentN = () => (state.build && state.build.length ? (state.rent || []).reduce((a, r) => a + r.n, 0) : 0); // арендованные у корпораций
export const ECON = gd('buildings', 'econ', {CF_SB: 50, ECON_SB: {efac: 1000, emine: 500, elab: 1000}, ECON_MAT: {efac: {fe: 24, si: 4}, emine: {fe: 15, c: 3}, elab: {fe: 14, si: 12}, yardton: {fe: 80, ti: 10}, yardcrew: {fe: 25}}, matDiv: 1});
export const CF_SB = ECON.CF_SB;
// Постройки корпораций — по таблице «Пояс» (вкладка «Здания», низ). Их же может строить игрок во вкладке «Экономические постройки» (кроме only:true).
// kind: fac — госзавод товара g (k — сколько заводов-эквивалентов), mine — шахта на рынок Земли, lab — лаборатория (k — сколько), corp — только корпорации.
export const CORP = gd('buildings', 'corp', {
  cmine:   {name: 'Коммерческая шахта', kind: 'mine', sb: 100, cost: {fe: 20000, ti: 200}, desc: '1 млн т породы в год, на общий рынок. 10 000 человек низкого образования, 50 МВт.'},
  elx:     {name: 'Фабрика электроники', kind: 'fac', g: 'elx', sb: 100, cost: {fe: 30000, ree: 100}, desc: '50 000 т электроники в год на общий рынок. 10 000 человек высшего образования, 100 МВт.'},
  lux:     {name: 'Фабрика роскоши', kind: 'fac', g: 'lux', sb: 100, cost: {fe: 20000}, desc: '10 000 т роскоши в год на общий рынок. 10 000 человек среднего образования, 50 МВт.'},
  wear:    {name: 'Фабрика бытовых товаров', kind: 'fac', g: 'wear', sb: 100, cost: {fe: 30000}, desc: '200 000 т бытовых товаров в год на общий рынок. 10 000 человек низкого образования, 100 МВт.'},
  green:   {name: 'Зелёная энергетика', kind: 'fac', g: 'pow', k: 0.3, sb: 100, cost: {fe: 40000, si: 3000, ree: 50}, desc: '600 МВт на общий рынок.'},
  tps:     {name: 'ТЭС', kind: 'fac', g: 'pow', sb: 200, cost: {fe: 100000}, desc: '2 000 МВт на общий рынок. 3 млн т угля и нефти в год, загрязнение.'},
  npp:     {name: 'АЭС', kind: 'fac', g: 'pow', k: 3, sb: 1000, cost: {fe: 200000, ti: 500, w: 100, u: 2000}, desc: '6 000 МВт на общий рынок. 1 200 т урана в год.'},
  fuel:    {name: 'Топливный завод', kind: 'fac', g: 'fuel', sb: 200, cost: {fe: 50000, ree: 100}, desc: '1 млн т топлива в год на общий рынок.'},
  yard:    {name: 'Космическая верфь', kind: 'corp', sb: 4000, cost: {fe: 100000, ti: 2000, w: 500, ree: 200, pt: 10}, desc: 'Верфь корпорации в космосе: строит корабли на продажу.'},
  house:   {name: 'Жилой комплекс', kind: 'fac', g: 'house', k: 0.02, sb: 10, cost: {fe: 5000}, desc: 'Жильё на 10 000 человек, на общий рынок.'},
  clinic:  {name: 'Частная клиника', kind: 'fac', g: 'meds', k: 0.7, sb: 30, cost: {fe: 10000}, desc: 'Медицина на 400 000 человек, на общий рынок.'},
  pschool: {name: 'Частная школа', kind: 'fac', g: 'edu', sb: 30, cost: {fe: 10000}, desc: 'Учит 150 000 учеников, на общий рынок.'},
  pinst:   {name: 'Частный институт с узкой специализацией', kind: 'fac', g: 'exp', sb: 50, cost: {fe: 10000, si: 500, ree: 20, pt: 2}, desc: 'Учит 20 000 студентов-экспертов, на общий рынок.'},
  clab:    {name: 'Коммерческая лаборатория', kind: 'lab', sb: 400, cost: {fe: 5000, ree: 20, pt: 2}, desc: '10 очков науки в сутки во всех областях — продаются на рынке науки.'},
  cdc:     {name: 'Коммерческий дата-центр', kind: 'lab', k: 5, sb: 800, cost: {fe: 20000, si: 5000, ree: 100, pt: 5}, desc: '50 очков науки в сутки во всех областях — продаются на рынке науки.'},
  logland: {name: 'Наземный логистический центр', kind: 'corp', sb: 200, cost: {fe: 20000, ti: 100}, desc: '1 млрд т·км в год × эффективность наземной логистики.'},
  logsea:  {name: 'Водный логистический центр', kind: 'corp', sb: 200, cost: {fe: 20000, ti: 100}, desc: '1 млрд т·км в год × эффективность морской логистики.'},
  logair:  {name: 'Воздушный логистический центр', kind: 'corp', sb: 200, cost: {fe: 20000, ti: 100}, desc: '1 млрд т·км в год × эффективность воздушной логистики.'},
});
// товары, заводы которых корпорации могут строить (остальное — фоновое хозяйство Земли)
export const CORP_GOODS = [...new Set(Object.values(CORP).filter(c => c.kind === 'fac').map(c => c.g))]; // СБ в сутки от строительного завода
export const buildUnits = () => ((brigades() + rentN()) + Object.keys(BLD).reduce((a, t) => a + (BLD[t].cbSB || 0) * (state.bld[t] || 0), 0)) * tm('build') * tm('buildu'); // СБ в сутки: бригады + здания с полем cbSB (строительные заводы)
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
export const academyInterval = () => 60 / (1 + 0.3 * (state.bld.academy || 0));
export const academyClass = () => 5 + 5 * (state.bld.academy || 0);
export const academyBonus = () => 0.5 * (state.bld.academy || 0) + (techOn('select') ? 1 : 0);
// Материалы постройки (решено с владельцем): у каждой свой набор, списываются со склада в начале каждой единицы
export const ECON_MAT = ECON.ECON_MAT;
export function matOf(j) { const t = j.type || j; if (t === 'econ' && CORP[j.b]) return CORP[j.b].cost; const m = ECON_MAT[t]; if (m) return m; const c = BLD[t] && BLD[t].cost; if (!c) return {}; const o = {}; for (const r in c) o[r] = Math.max(1, Math.round(c[r] / (ECON.matDiv || 1))); return o; }
export function bldCost(t) { return matOf(t); }
// сколько материалов нужно всей очереди (держим на складе, не продаём Земле)
// резерв: материалы на ближайшие 30 суток стройки по каждому проекту (не вся очередь — иначе Земле ничего не достаётся)
export function queueMat() { const o = {}, cap = buildUnits(); let left = 100;
  for (const j of state.build || []) { const m = matOf(j), e = Math.min(j.pct || 0, left); left -= e; const u = unitSB(j), n = Math.min((j.n || 1) - (j.paid ? 1 : 0), Math.ceil(cap * e / 100 * 30 / Math.max(1, u)));
    for (const r in m) o[r] = (o[r] || 0) + m[r] * Math.max(0, n); } return o; }
import { hooks as _hk } from './00-hooks.ts';
_hk.queueMat = () => queueMat(); _hk.BLD = BLD;
export const matTxt = m => Object.entries(m).map(([r, v]) => `${(RESN[r] || r).toLowerCase()} ${(+v).toLocaleString("ru-RU")}`).join(', ');
const RESN = {fe: 'Железо', co: 'Кобальт', ti: 'Титан', w: 'Вольфрам', si: 'Кремний', c: 'Уголь и нефть', ice: 'Лёд', pt: 'Платина', ree: 'Редкозем', u: 'Уран'};
export function bldQueued(t) { return state.build.filter(j => j.type === t).reduce((a, j) => a + (j.n || 1), 0); }
// Очередь стройки (как в Aurora): у проекта количество n и доля мощности pct (%). Мощность = бригады + строительные заводы.
// Типы: здание из BLD; 'yardton'/'yardcrew' (yi — верфь); 'efac' (g — товар: госзавод Земли), 'emine' (госшахта), 'elab' (лаборатория).
export const ECON_SB = ECON.ECON_SB;
export function unitSB(j) { if (j.type === 'econ') return (CORP[j.b] && CORP[j.b].sb) || 100; return j.type === 'yardton' || j.type === 'yardcrew' ? yardUpSB(yards()[j.yi] || {nt: 0, nc: 0}, j.type === 'yardton' ? 'ton' : 'crew') : ECON_SB[j.type] || bldSB(j.type); }
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
  { let d = 0; for (const t in BLD) { const u = BLD[t].use; if (u && B[t]) for (const g in u) d += B[t] * u[g] * (g === 'pow' ? 24 : 1 / 365) * gval(g) * KR; } state.money -= d * h; state.useDay = d; } // поле use: расход товаров зданиями (энергия — МВт, прочее — т в год), платим по цене товара
  if (B.mine) {
    const g = state.ground.earth, g0 = GROUND.earth; // каждая шахта берёт все жилы сразу: myOf(руда) т в сутки × эффективность
    for (const k of Object.keys(g)) { const part = Math.min(g[k], B.mine * MINE_RATE * myOf(k) * (techOn('deepdrill') ? 1.5 : 1) * tm('mine') * h * veinEff('earth', k, g[k], g0[k] || g[k])); if (part > 0) { g[k] -= part; S[k] = (S[k] || 0) + part; rec(k, 'in', part, 'mine'); } }
  }
  for (const t in BLD) { const b = BLD[t], m = b.make; if (!m || !B[t] || !(m.perDay > 0)) continue; // поле make: переработка {in: {руда: т на 1 т выхода}, out: {что: т}, perDay, max — предел склада выхода}
    let q = m.perDay * B[t] * h; for (const r in m.in || {}) q = Math.min(q, (S[r] || 0) / Math.max(1e-9, m.in[r])); for (const r in m.out || {}) if (m.max) q = Math.min(q, Math.max(0, (m.max - (S[r] || 0)) / Math.max(1e-9, m.out[r])));
    if (q > 0) { for (const r in m.in || {}) { S[r] -= q * m.in[r]; rec(r, 'out', q * m.in[r], 'plant'); } for (const r in m.out || {}) { S[r] = (S[r] || 0) + q * m.out[r]; rec(r, 'in', q * m.out[r], 'plant'); } } }
  for (const t in BLD) { const b = BLD[t]; if (b.sci && B[t]) for (const f in b.sci) if (f in state.sci) state.sci[f] += b.sci[f] * B[t] * h * tm('sci'); } // поле sci: очки науки в сутки на здание
  {
    const T = (state.cols && state.cols.earth && state.cols.earth.pop.tax) || 0, inc = T * Object.keys(BLD).reduce((a, t) => a + (BLD[t].taxPct || 0) / 100 * (B[t] || 0), 0) * h; if (inc > 0) state.money += inc; } // поле taxPct: % к налогам на космос на здание
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
  if (j.type === 'econ') { const c = CORP[j.b]; if (c) { if (c.kind === 'fac' && P) P.fac[c.g] = (P.fac[c.g] || 0) + (c.k || 1); else if (c.kind === 'mine' && P) P.lmN = (P.lmN || 0) + 1; else if (c.kind === 'lab') state.labs = (state.labs || 0) + (c.k || 1); if (j.n === 0) log(`Достроено: «${c.name}».`); } return; }
  if (j.type === 'elab') { state.labs = (state.labs || 0) + 1; if (j.n === 0) log('Достроены лаборатории.'); return; }
  B[j.type]++; if (j.type === 'shipyard') yards(); { const f = BLD[j.type].fac; if (f && P) for (const g in f) P.fac[g] = (P.fac[g] || 0) + f[g]; } // госзаводы Земли от зданий (энергия, жильё, медицина, школы) if (j.n === 0 || BLD[j.type].level) log(`Построено: «${BLD[j.type].name}»${BLD[j.type].level ? ', уровень ' + B[j.type] : ', всего ' + B[j.type]}.`);
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
