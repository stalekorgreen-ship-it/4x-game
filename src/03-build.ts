// @ts-nocheck
import { gd, DEFAULTS } from './00-gd.ts';
import { BODY, FIELDS, GROUND, log, rec, state, stockOK, veinEff, myOf, objPos } from './01-data.ts';
import { KR } from './00-kr.ts';
import { gval, PT } from './26-goods.ts';
import { TECH, techById, tm, ensureOffers, dealField, BEFF } from './15-techs.ts';
import { sciMult, train, useWear } from './02-crew.ts';

/* ===== ЗДАНИЯ НА ЗЕМЛЕ ===== */
export const MINE_RATE = 1;
export const BLD = gd('buildings', 'buildings', {
  // Здания игрока — по таблице «Пояс» (вкладка «Здания», верх). Все числа — в год. cost — реальные тонны; crew — рабочих; use — расход в год (pow — МВт постоянно), оплачивается по цене товара;
  // sci — очков науки в год в каждой области; cbSB — СБ в год; make — переработка со склада на склад (perYear — т выхода в год); fac — сколько заводов-эквивалентов товара получает Земля; life — лет до износа.
  lab:       {name: 'Лаборатория', sb: 400, cost: {fe: 5000, ree: 20, pt: 2}, sci: {phys: 10, eng: 10, bio: 10}, use: {pow: 10, elx: 1000}, desc: 'Даёт 10 очков науки в год во всех областях. Позволяет изучать аномалии на планете. Расход: 10 МВт, 1 000 т электроники в год, 10 000 человек с высшим образованием.'},
  dcenter:   {name: 'Дата-центр', sb: 800, cost: {fe: 20000, si: 5000, ree: 100, pt: 5}, sci: {phys: 50, eng: 50, bio: 50}, use: {pow: 100, elx: 1000}, desc: 'Даёт 50 очков науки в год во всех областях. Расход: 100 МВт, 1 000 т электроники в год, 10 000 экспертов, 7 млн т воды (пар).'},
  mine:      {name: 'Государственная шахта', sb: 100, cost: {fe: 20000, ti: 200}, use: {pow: 50}, desc: 'Добывает 1 млн т породы в год: железо 420 тыс. т, уголь и нефть 540 тыс., кремний 210 тыс., титан и редкозем по 830, уран 430, платина 4 т (× эффективность жилы). Всё — на ваш склад. Расход: 50 МВт, 10 000 человек низкого образования.'},
  benef:     {name: 'Обогатительная фабрика', sb: 100, cost: {fe: 30000, ti: 100}, use: {pow: 100}, desc: 'Порода → концентрат: 1 млн т породы в год (одна госшахта). Потери 15% металла уже в выходе шахты. Без фабрик шахты стоят. 10 000 человек среднего образования, 100 МВт.'},
  smelt:     {name: 'Плавильный завод', sb: 200, cost: {fe: 60000, ti: 200, w: 50}, desc: 'Концентрат → металл: до 500 000 т в год. Кокс: 0,5 т угля на 1 т железа → 1,8 т CO₂ (с «Водородной плавкой» — без угля, энергии ×2). Энергия ~5,2 МВт·ч на т, редкие металлы ×10. 10 000 человек среднего образования.'},
  spaceport: {name: 'Космодром', sb: 200, cost: {fe: 20000, ti: 400, si: 600}, desc: '+10 000 т в год подъёма с Земли на орбиту (верфь, заправка, запчасти). 10 000 человек среднего образования.'},
  gbuild:    {name: 'Государственная стройка', sb: 100, cost: {fe: 5000}, cbSB: 10, desc: 'Даёт 10 СБ в год на всю стройку. 10 000 человек низкого образования.'},
  shipyard:  {name: 'Военная космическая верфь', sb: 4000, cost: {fe: 100000, ti: 2000, w: 500, ree: 200, pt: 10}, desc: 'Верфь в космосе: стапель до 1 000 т, 1 бригада (10 000 чел.) строит 365 т корабля в год. Тоннаж и бригады расширяются ниже, каждый раз дороже. 10 000 экспертов.'},
  green:     {name: 'Зелёная энергетика', sb: 100, cost: {fe: 40000, si: 3000, ree: 50}, crew: 0, fac: {pow: 0.3}, use: {elx: 50}, desc: 'Вырабатывает 600 МВт для Земли по цене самоокупа. Без топлива и почти без людей. Расход: 50 т электроники в год.'},
  tps:       {name: 'Государственная ТЭС', sb: 200, cost: {fe: 100000}, crew: 0, fac: {pow: 1}, life: 50, desc: 'Вырабатывает 2 000 МВт для Земли по цене самоокупа. Сжигает 3 млн т угля и нефти в год, 7,5 млн т CO₂. 10 000 человек среднего образования. Изнашивается за 50 лет.'},
  npp:       {name: 'Государственная АЭС', sb: 1000, cost: {fe: 200000, ti: 500, w: 100, u: 2000}, crew: 0, fac: {pow: 3}, life: 70, desc: 'Вырабатывает 6 000 МВт для Земли по цене самоокупа. 1 200 т урана в год. 10 000 человек высшего образования. Изнашивается за 70 лет.'},
  lifeinfra: {name: 'Инфраструктура жизнеобеспечения', sb: 50, cost: {fe: 20000, w: 100, si: 2000}, crew: 0, desc: 'Позволяет жить 10 000 граждан на непригодной планете (годность 0,1). На Земле не нужна.'},
  fuelplant: {name: 'Топливный завод', sb: 200, cost: {fe: 50000, ree: 100}, make: {in: {c: 1.5}, out: {fuel: 1}, perYear: 1000000}, use: {pow: 50}, desc: 'Делает 1 млн т топлива в год из 1,5 млн т угля и нефти со склада — на ваш склад. Расход: 50 МВт, 10 000 человек среднего образования.'},
  supplies:  {name: 'Фабрика припасов', sb: 200, cost: {fe: 30000, ti: 200}, make: {in: {fe: 0.8, ree: 0.01}, out: {spares: 1}, perYear: 50000}, use: {pow: 20}, desc: 'Делает 50 000 т припасов в год (еда в рейс, запчасти, расходники) из 40 000 т железа и 500 т редкозема — на ваш склад. Расход: 20 МВт, 10 000 человек среднего образования.'},
  housing:   {name: 'Социальное жильё', sb: 10, cost: {fe: 5000}, crew: 0, fac: {house: 0.02}, life: 50, desc: 'Жильё на 10 000 человек бесплатно. Изнашивается за 50 лет.'},
  cityhosp:  {name: 'Городская больница', sb: 30, cost: {fe: 10000}, crew: 0, fac: {meds: 0.7}, life: 50, desc: 'Медицина на 400 000 человек бесплатно. 10 000 человек высшего образования. Изнашивается за 50 лет.'},
  school:    {name: 'Образовательное учреждение', sb: 30, cost: {fe: 10000}, crew: 0, fac: {edu: 1}, life: 50, desc: 'Учит 150 000 учеников бесплатно. 10 000 человек высшего образования. Изнашивается за 50 лет.'},
  institute: {name: 'Институт с узкой специализацией', sb: 50, cost: {fe: 10000, si: 500, ree: 20, pt: 2}, crew: 0, fac: {exp: 1}, life: 50, desc: 'Учит 20 000 студентов-экспертов бесплатно. 10 000 человек высшего образования. Изнашивается за 50 лет.'},
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
export const ECON = gd('buildings', 'econ', {BRIG_Y: 10, CF_SB: 50, ECON_SB: {efac: 1000, emine: 500, elab: 1000}, ECON_MAT: {efac: {fe: 24, si: 4}, emine: {fe: 15, c: 3}, elab: {fe: 14, si: 12}, yardton: {fe: 80, ti: 10}, yardcrew: {fe: 25}}, matDiv: 1});
export const CF_SB = ECON.CF_SB;
// Постройки корпораций — по таблице «Пояс» (вкладка «Здания», низ). Их же может строить игрок во вкладке «Экономические постройки» (кроме only:true).
// kind: fac — госзавод товара g (k — сколько заводов-эквивалентов), mine — шахта на рынок Земли, lab — лаборатория (k — сколько), corp — только корпорации.
export const CORP = gd('buildings', 'corp', {
  cmine:   {name: 'Коммерческая шахта', kind: 'mine', sb: 100, cost: {fe: 20000, ti: 200}, desc: '1 млн т породы в год, на общий рынок. 10 000 человек низкого образования, 50 МВт.'},
  elx:     {name: 'Фабрика электроники', kind: 'fac', g: 'elx', sb: 100, cost: {fe: 30000, ree: 100}, desc: '50 000 т электроники в год на общий рынок. 10 000 человек высшего образования, 100 МВт.'},
  lux:     {name: 'Фабрика роскоши', kind: 'fac', g: 'lux', sb: 100, cost: {fe: 20000}, desc: '10 000 т роскоши в год на общий рынок. 10 000 человек среднего образования, 50 МВт.'},
  wear:    {name: 'Фабрика бытовых товаров', kind: 'fac', g: 'wear', sb: 100, cost: {fe: 30000}, desc: '200 000 т бытовых товаров в год на общий рынок. 10 000 человек низкого образования, 100 МВт.'},
  green:   {name: 'Зелёная энергетика', kind: 'fac', g: 'pow', k: 0.3, sb: 100, cost: {fe: 40000, si: 3000, ree: 50}, desc: '600 МВт на общий рынок, без топлива и почти без людей.'},
  tps:     {name: 'ТЭС', kind: 'fac', g: 'pow', sb: 200, cost: {fe: 100000}, life: 50, desc: '2 000 МВт на общий рынок. 3 млн т угля и нефти в год, загрязнение. 50 лет.'},
  npp:     {name: 'АЭС', kind: 'fac', g: 'pow', k: 3, sb: 1000, cost: {fe: 200000, ti: 500, w: 100, u: 2000}, life: 70, desc: '6 000 МВт на общий рынок. 1 200 т урана в год. 70 лет.'},
  fuel:    {name: 'Топливный завод', kind: 'fac', g: 'fuel', sb: 200, cost: {fe: 50000, ree: 100}, desc: '1 млн т топлива в год на общий рынок.'},
  yard:    {name: 'Космическая верфь', kind: 'yard', sb: 4000, cost: {fe: 100000, ti: 2000, w: 500, ree: 200, pt: 10}, desc: 'Верфь в космосе: стапель до 1 000 т, 1 бригада строит 365 т корабля в год. Корпорации строят на ней корабли на продажу; ваша — ещё одна верфь игрока.'},
  house:   {name: 'Жилой комплекс', kind: 'fac', g: 'house', k: 0.02, sb: 10, cost: {fe: 5000}, life: 50, desc: 'Жильё на 10 000 человек, на общий рынок. 50 лет.'},
  clinic:  {name: 'Частная клиника', kind: 'fac', g: 'meds', k: 0.7, sb: 30, cost: {fe: 10000}, life: 50, desc: 'Медицина на 400 000 человек, на общий рынок. 50 лет.'},
  pschool: {name: 'Частная школа', kind: 'fac', g: 'edu', sb: 30, cost: {fe: 10000}, life: 50, desc: 'Учит 150 000 учеников, на общий рынок. 50 лет.'},
  pinst:   {name: 'Частный институт с узкой специализацией', kind: 'fac', g: 'exp', sb: 50, cost: {fe: 10000, si: 500, ree: 20, pt: 2}, life: 50, desc: 'Учит 20 000 студентов-экспертов, на общий рынок. 50 лет.'},
  clab:    {name: 'Коммерческая лаборатория', kind: 'lab', sb: 400, cost: {fe: 5000, ree: 20, pt: 2}, desc: '10 очков науки в год во всех областях — продаются на рынке науки.'},
  cdc:     {name: 'Коммерческий дата-центр', kind: 'lab', k: 5, sb: 800, cost: {fe: 20000, si: 5000, ree: 100, pt: 5}, desc: '50 очков науки в год во всех областях — продаются на рынке науки.'},
  logland: {name: 'Наземный логистический центр', kind: 'tr', g: 'land', sb: 200, cost: {fe: 20000, ti: 100}, desc: '1 млрд т·км в год × эффективность наземной логистики. 10 000 человек среднего образования.'},
  logsea:  {name: 'Водный логистический центр', kind: 'tr', g: 'sea', sb: 200, cost: {fe: 20000, ti: 100}, desc: '1 млрд т·км в год × эффективность морской логистики (доля ограничена: груз всё равно довозят по земле).'},
  logair:  {name: 'Воздушный логистический центр', kind: 'tr', g: 'air', sb: 200, cost: {fe: 20000, ti: 100}, desc: '1 млрд т·км в год × эффективность воздушной логистики (слабая без технологий, доля ограничена).'},
  // нет в таблице — остальные товары тоже делают корпорации; цены — как у фабрик таблицы (правьте здесь)
  steel:   {name: 'Сталелитейный завод', kind: 'fac', g: 'steel', sb: 100, cost: {fe: 30000}, desc: '50 000 т стали в год. 10 000 человек низкого образования.'},
  alloy:   {name: 'Завод сплавов', kind: 'fac', g: 'alloy', sb: 100, cost: {fe: 30000, ti: 100}, desc: '18 000 т сплавов в год. 10 000 человек среднего образования.'},
  shipm:   {name: 'Завод компонентов', kind: 'fac', g: 'shipm', sb: 100, cost: {fe: 30000, ree: 50}, desc: '3 600 т компонентов кораблей в год. 10 000 человек высшего образования.'},
  spares:  {name: 'Завод припасов', kind: 'fac', g: 'spares', sb: 100, cost: {fe: 30000, ti: 200}, desc: '11 000 т запчастей и припасов в год.'},
  infra:   {name: 'Завод инфраструктуры', kind: 'fac', g: 'infra', sb: 100, cost: {fe: 30000}, desc: '72 000 т инфраструктуры для колоний в год.'},
  ammo:    {name: 'Завод боеприпасов', kind: 'fac', g: 'ammo', sb: 100, cost: {fe: 30000, w: 50}, desc: '18 000 т боеприпасов в год.'},
  serv:    {name: 'Сервисная компания', kind: 'fac', g: 'serv', sb: 30, cost: {fe: 5000}, desc: 'Услуги для 500 000 человек.'},
  water:   {name: 'Водоочистная станция', kind: 'fac', g: 'water', sb: 50, cost: {fe: 10000}, desc: 'Вода для 450 000 человек (вне Земли).'},
  air:     {name: 'Станция воздуха и газов', kind: 'fac', g: 'air', sb: 50, cost: {fe: 10000, ti: 100}, desc: 'Воздух и газы (вне Земли).'},
  robot:   {name: 'Завод роботов', kind: 'fac', g: 'robot', sb: 200, cost: {fe: 30000, ree: 100, pt: 2}, desc: 'Роботы (после технологии).'},
});
// товары, заводы которых корпорации могут строить (остальное — фоновое хозяйство Земли)
export const CORP_GOODS = [...new Set(Object.values(CORP).filter(c => c.kind === 'fac').map(c => c.g))];
export const YR = 360; // суток в игровом году
export const corpBld = g => Object.keys(CORP).find(i => CORP[i].kind === 'fac' && CORP[i].g === g); // СБ в сутки от строительного завода
export const buildUnits = () => ((brigades() + rentN()) * (ECON.BRIG_Y || 10) + Object.keys(BLD).reduce((a, t) => a + (BLD[t].cbSB || 0) * (state.bld[t] || 0), 0)) / 360 * tm('build') * tm('buildu'); // СБ в сутки: всё в таблице — СБ в год (бригада и госстройка по 10) // СБ в сутки: бригады + здания с полем cbSB (строительные заводы)
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
const hooks = _hk;
const objPosB = id => objPos(id, state.t);
import { toOrbit as toOrbitB } from './36-lift.ts';
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
  state.build.push({id: Date.now() + Math.random(), type: t, yi, g, n, pct, prog: 0, reg: state.bqReg | 0}); return true; } // reg — регион Земли, где встанет постройка
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
  { let d = 0; for (const t in BLD) { const u = BLD[t].use; if (u && B[t]) for (const g in u) d += B[t] * u[g] * (g === 'pow' ? 24 : 1 / 360) * gval(g) * KR; } state.money -= d * h; state.useDay = d; } // поле use: расход товаров зданиями (энергия — МВт, прочее — т в год), платим по цене товара
  wearTick();
  if (B.mine) { // таблица «Переработка»: шахта → обогатительная фабрика (порода) → плавильный завод (металл); шахты добывают только то, что успевают переработать
    const g = state.ground.earth, g0 = GROUND.earth, k0 = B.mine * MINE_RATE * (techOn('deepdrill') ? 1.5 : 1) * tm('mine') * h, part = {}, RARE = {ti: 1, w: 1, co: 1, ree: 1, pt: 1, u: 1};
    for (const k of Object.keys(g)) part[k] = Math.min(g[k], k0 * myOf(k) * veinEff('earth', k, g[k], g0[k] || g[k]));
    const rock = B.mine * 1e6 / 360 * h, pB = Math.min(1, (B.benef || 0) * 1e6 / 360 * h / Math.max(1e-9, rock));
    let met = 0; for (const k in part) if (k !== 'c' && k !== 'ice') met += part[k] * pB;
    const h2 = techOn('h2smelt'), coke = h2 ? 0 : .5, cRes = (queueMat().c || 0) + 5000, coalOK = coke ? Math.max(0, (S.c || 0) + (part.c || 0) * pB - cRes) / Math.max(1e-9, coke * (part.fe || 0) * pB) : Infinity; // уголь под стройку и 5 000 т не идут в кокс
    const pS = Math.min(1, (B.smelt || 0) * 5e5 / 360 * h / Math.max(1e-9, met), coalOK);
    let mwh = 0; state.proc = {pB, pS, rock: rock / h, met: met / h};
    for (const k in part) { const f = k === 'c' || k === 'ice' ? pB : pB * pS, v = part[k] * f; if (!(v > 0)) continue; g[k] -= v; S[k] = (S[k] || 0) + v; rec(k, 'in', v, 'mine'); if (f !== pB) mwh += v * 5.18 * (RARE[k] ? 10 : 1) * (h2 ? 2 : 1); }
    const fe = (part.fe || 0) * pB * pS; if (coke && fe > 0) { const q = Math.min(Math.max(0, (S.c || 0) - cRes), fe * coke); S.c -= q; rec('c', 'out', q, 'plant'); if (hooks.addCO2) hooks.addCO2('earth', fe * 1.8); }
    if (mwh > 0) state.money -= mwh * gval('pow') * KR; // энергия плавки — по цене энергии
  }
  { const C = state.conc; if (C && B.smelt) { // концентрат, привезённый кораблями из космоса: плавится свободной мощностью плавильных заводов
    const used = state.proc ? state.proc.met * h * (state.proc.pS || 0) : 0; let cap = Math.max(0, B.smelt * 5e5 / 360 * h - used); const h2 = techOn('h2smelt'); let mwh = 0, fe = 0;
    for (const k in C) { if (cap <= 0) break; let q = Math.min(C[k], cap); if (k === 'fe' && !h2) q = Math.min(q, Math.max(0, (S.c || 0) - 5000) / .5); if (!(q > 0)) continue; C[k] -= q; cap -= q; S[k] = (S[k] || 0) + q; rec(k, 'in', q, 'mine'); mwh += q * 5.18 * (k === 'fe' || k === 'si' ? 1 : 10) * (h2 ? 2 : 1); if (k === 'fe') fe += q; }
    if (fe > 0 && !h2) { S.c -= fe * .5; rec('c', 'out', fe * .5, 'plant'); if (hooks.addCO2) hooks.addCO2('earth', fe * 1.8); }
    if (mwh > 0) state.money -= mwh * gval('pow') * KR; } }
  // катапульта станции: склад летит к Земле контейнерами (~2 км/с), по прибытии — на орбитальный склад
  for (const st of state.stations || []) if (st.st && st.st.acat && st.store && st.at && st.at !== 'earth' && BODY[st.at]) { let cap = st.st.acat / 360 * h; const box = {}; let tot = 0;
    for (const k in st.store) { const q = Math.min(st.store[k], cap); if (q <= 0) continue; st.store[k] -= q; cap -= q; box[k] = q; tot += q; const rw = st.raw && st.raw[k] ? Math.min(st.raw[k], q) : 0; if (rw) { st.raw[k] -= rw; box['raw:' + k] = rw; } }
    if (tot > 0) { const p0 = objPosB(st.at), pe = objPosB('earth'), dAU = Math.hypot(p0.x - pe.x, p0.y - pe.y); (state.boxes = state.boxes || []).push({cargo: box, arrive: state.t + dAU * 1.496e8 / 2 / 86400, from: st.name}); } }
  if (state.boxes && state.boxes.length) state.boxes = state.boxes.filter(b => { if (b.arrive > state.t) return true; for (const k in b.cargo) { if (k.startsWith('raw:')) { const C = state.conc || (state.conc = {}), r = k.slice(4); C[r] = (C[r] || 0) + b.cargo[k]; S[r] = Math.max(0, (S[r] || 0) - b.cargo[k]); continue; } S[k] = (S[k] || 0) + b.cargo[k]; toOrbitB(k, b.cargo[k]); } log(`Контейнеры со станции «${b.from}» прибыли к Земле.`); return false; });
  // станции с плавильней плавят свой концентрат
  for (const st of state.stations || []) if (st.raw && st.st && st.st.smeltY) { let cap = st.st.smeltY / 360 * h; for (const k in st.raw) { const q = Math.min(st.raw[k], cap); st.raw[k] -= q; cap -= q; if (cap <= 0) break; } }
  for (const t in BLD) { const b = BLD[t], m = b.make; if (!m || !B[t] || !(m.perDay > 0 || m.perYear > 0)) continue; // поле make: переработка {in: {руда: т на 1 т выхода}, out: {что: т}, perDay, max — предел склада выхода}
    let q = (m.perYear ? m.perYear / 360 : m.perDay) * B[t] * h; const QM = queueMat(); for (const r in m.in || {}) q = Math.min(q, Math.max(0, (S[r] || 0) - (QM[r] || 0) - 5000) / Math.max(1e-9, m.in[r])); // запас под стройку и 5 000 т не перерабатываются for (const r in m.out || {}) if (m.max) q = Math.min(q, Math.max(0, (m.max - (S[r] || 0)) / Math.max(1e-9, m.out[r])));
    if (q > 0) { for (const r in m.in || {}) { S[r] -= q * m.in[r]; rec(r, 'out', q * m.in[r], 'plant'); } for (const r in m.out || {}) { S[r] = (S[r] || 0) + q * m.out[r]; rec(r, 'in', q * m.out[r], 'plant'); } } }
  for (const t in BLD) { const b = BLD[t]; if (b.sci && B[t]) for (const f in b.sci) if (f in state.sci) state.sci[f] += b.sci[f] / 360 * B[t] * h * tm('sci'); } // поле sci: очки науки в год на здание
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
  if (j.type === 'econ') { const c = CORP[j.b]; if (c) { if (c.kind === 'fac' && P) addFac(P, c.g, c.k || 1, j.b, c.life); else if (c.kind === 'mine' && P) P.lmN = (P.lmN || 0) + 1; else if (c.kind === 'lab') state.labs = (state.labs || 0) + (c.k || 1); else if (c.kind === 'yard') { B.shipyard = (B.shipyard || 0) + 1; yards(); } if (j.n === 0) log(`Достроено: «${c.name}».`); } return; }
  if (j.type === 'elab') { state.labs = (state.labs || 0) + 1; if (j.n === 0) log('Достроены лаборатории.'); return; }
  B[j.type]++; { const R = state.bldReg || (state.bldReg = {}), a = R[j.type] || (R[j.type] = []); a[j.reg | 0] = (a[j.reg | 0] || 0) + 1; } if (j.type === 'shipyard') yards(); { const b = BLD[j.type], f = b.fac; if (f && P) for (const g in f) addFac(P, g, f[g], j.type, null); if (b.life) (state.ages = state.ages || []).push({t: j.type, end: state.t + b.life * 360}); } // госзаводы Земли от зданий (энергия, жильё, медицина, школы) if (j.n === 0 || BLD[j.type].level) log(`Построено: «${BLD[j.type].name}»${BLD[j.type].level ? ', уровень ' + B[j.type] : ', всего ' + B[j.type]}.`);
}
// госзаводы Земли от построек игрока: энергия помнит тип станции (смесь станций → рецепт и штат); у построек с износом — срок
function addFac(P, g, k, id, life) { P.fac[g] = (P.fac[g] || 0) + k; if (g === 'pow' && PT[id]) { const m = state.pmixP = state.pmixP || {}; m[id] = (m[id] || 0) + k; }
  if (life) (state.ages = state.ages || []).push({g, k, id, end: state.t + life * 360}); }
// износ: срок вышел — здание сносится (здания игрока — минус одно, экономические — минус их заводы-эквиваленты)
export function wearTick() { const A = state.ages; if (!A || !A.length) return; const P = state.cols && state.cols.earth && state.cols.earth.pop;
  for (let i = A.length - 1; i >= 0; i--) { const a = A[i]; if (a.end > state.t) continue; A.splice(i, 1);
    if (a.t) { if (state.bld[a.t] > 0) { state.bld[a.t]--; const f = BLD[a.t] && BLD[a.t].fac; if (f && P) for (const g in f) subFac(P, g, f[g], a.t); log(`Износ: снесено «${BLD[a.t].name}».`); } }
    else if (P) { subFac(P, a.g, a.k, a.id); log(`Износ: закрыто «${(CORP[a.id] || {}).name || a.id}».`); } } }
function subFac(P, g, k, id) { P.fac[g] = Math.max(0, (P.fac[g] || 0) - k); const m = state.pmixP; if (g === 'pow' && m && m[id]) m[id] = Math.max(0, m[id] - k); }
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
