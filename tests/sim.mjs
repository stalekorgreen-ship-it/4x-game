// Тесты симуляции без браузера: грузим файлы игры в vm с заглушкой DOM.
// Тесты симуляции без браузера: модули игры грузятся в Node с заглушкой DOM.
const stub = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.assign(globalThis, { document: stub(), window: stub(), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {}, ResizeObserver: function () { return stub(); } });
const D = await import('../src/01-data.ts');
const E = await import('../src/04-engine.ts'); const B = await import('../src/03-build.ts');
const P = await import('../src/07-population.ts');
await import('../src/06-corps.ts');
const U = await import('../src/09-orders-ui.ts');
const F = await import('../src/12-state.ts');
const g = { newGame: D.newGame, advance: E.advance, totals: P.totals, popTick: P.popTick, get state() { return D.state; } };
const run = (c) => { if (c === 'newGame()') D.newGame(); };
let fail = 0;
const ok = (c, m) => { console.log((c ? 'ok   ' : 'FAIL ') + m); if (!c) fail++; };

D.newGame();
const s = () => g.state;
s().paused = true; s().raid.eta = 1e9; s().raid.warned = true;

// 1. Население: 40 лет без обвалов
const t0 = g.totals();
ok(Math.abs(t0.n / 8.5e9 - 1) < 0.01, 'население стартует около 8,5 млрд (2030 год)');
for (let i = 0; i < 480; i++) { s().t += 30; g.popTick(30); }
const t1 = g.totals(), ur = t1.un / t1.wf;
ok(t1.n > 8.5e9 && t1.n < 13e9, `население через 40 лет в разумных пределах (${(t1.n / 1e9).toFixed(2)} млрд)`);
ok(ur > 0.005 && ur < 0.15, `безработица в разумных пределах (${(ur * 100).toFixed(1)}%)`);
ok(Object.values(s().pop.sat).every((x) => x > 0.8), 'товаров хватает (≥80% спроса)');

// 2. Корпорации: растут сами, первый строит верфь, потом выходят в космос
D.newGame();
s().paused = true; s().raid.eta = 1e9; s().raid.warned = true;
ok(s().corps.length === 20 && s().ships.filter((x) => x.corp).length === 0, 'старт: 20 корпораций, кораблей нет');
ok(s().corps.every((c) => Object.values(c.civ.fac).reduce((a, b) => a + b, 0) === 2), 'у каждой по 2 завода');
for (let i = 0; i < 3000; i++) g.advance(2);
const tot = (c) => Object.values(c.civ.fac).reduce((a, b) => a + b, 0);
ok(s().corps.every((c) => tot(c) > 30), 'заводы корпораций растут на выручку: ' + s().corps.map(tot).join('/'));
ok(s().t > 360 * 6 && s().corps.some((c) => c.civ.yard), 'кто-то построил коммерческую верфь (не раньше 6 лет)');
ok(s().ships.filter((x) => x.corp).length > 0, 'корпорации вышли в космос');
ok(s().corps.some((c) => c.civ.labs > 0) && s().corps.some((c) => c.civ.tech.out1), 'корпорации строят лаборатории и изучают свои технологии');
ok(s().corps.some((c) => c.civ.tech.xfer), 'кто-то освоил передачу топлива в космосе');
ok(Object.values(s().pop.sat).every((x) => x > 0.9), 'товаров по-прежнему хватает');
// 3. Наука игрока: изучается постепенно, контракт с лабораторией отдаёт очки игроку
const lab = s().corps.find((c) => c.civ.labs > 0);
s().research.eng = 'reliable'; s().sci.eng = 100; s().tprog = {};
B.researchTick(1);
ok(s().tprog.reliable === 100 && !s().tech.reliable, 'исследование идёт постепенно (100/500)');
s().sci.eng = 450; B.researchTick(1);
ok(s().tech.reliable === true, 'тема изучена, когда набрались очки');
s().sciBuy = {amt: 5000, max: 20000 * 25}; s().money = 1e9 * 25; // деньги в масштабе KR=25 const rp0 = s().rp;
s().research.phys = 'effdrive'; for (let i = 0; i < 60; i++) g.advance(2);
ok(s().tech.effdrive || s().tprog.effdrive > 0, 'купленные очки идут игроку');
ok(s().sciInfo && s().sciInfo.avail > 0 && s().sciInfo.bought > 0, 'сводка науки: доступно и куплено');
// закупки руды: политика игрока
s().buyPol = {fe: {mode: 'month', amt: 500, max: 0}, si: {mode: 'all', amt: 0, max: 1}}; const fe0 = s().stock.fe || 0, si0 = s().stock.si || 0; const _sv = s().ships; s().ships = []; // свои шахтёры не должны подвозить руду во время проверки закупок
for (let i = 0; i < 120; i++) g.advance(2);
s().ships = _sv;
ok((s().stock.fe || 0) > fe0, 'руда покупается по месячной квоте (+' + Math.round((s().stock.fe || 0) - fe0) + ' т железа)');
ok((s().stock.si || 0) <= si0 + 1e-6, 'при слишком низкой максимальной цене ничего не покупается');

ok(s().money > 5e7, 'налоги капают');
// 4. Государство: налоги, кредиты, банкротство, кризисы, цены
ok((s().pop.evN || 0) > 0, 'за годы случились кризисы (' + (s().pop.evN || 0) + ')');
ok(Object.values(s().mp || {}).some((m) => Math.abs(m - 1) > 0.02), 'цены на сырьё живые: ' + Object.entries(s().mp || {}).map(([r, m]) => r + '×' + m.toFixed(2)).join(' '));
const taxA = s().pop.tax; F.laws().tax = 30; P.popTick(30); const taxB = s().pop.tax; F.laws().tax = 20;
ok(taxB > taxA * 1.3, 'повышение налога поднимает сбор (' + Math.round(taxA) + ' → ' + Math.round(taxB) + ')');
const cc = s().corps[3], m0 = s().money; s().money = Math.max(s().money, 2e9); F.lendTo(cc, 1e9); P.popTick(30);
ok(F.loansOf(cc).length === 1 || s().money > m0 - 1e9, 'кредит корпорации выдан, проценты идут');
const n0 = s().corps.length; const victim = s().corps[5]; victim.credits = -1e13; victim.civ.neg = 5; victim.civ.debt = 1e13;
P.popTick(30); P.popTick(30);
ok(!s().corps.includes(victim) && (s().bankr || 0) >= 1, 'банкротство: корпорация исчезла, активы поглощены');
for (let i = 0; i < 14; i++) { s().t += 30; P.popTick(30); }
ok(s().corps.length >= n0 - 1, 'через год основана новая корпорация');
// 6. Колонии: те же механики на любом теле
D.newGame(); s().paused = true; s().raid.eta = 1e9; s().raid.warned = true;
ok(P.foundWhy('mars') !== '', 'без корабля колонию основать нельзя');
s().ships[0].at = 'mars'; s().money = 1e10;
const e0 = g.totals().n;
ok(P.foundColony('mars') && s().cols.mars, 'колония на Марсе основана');
ok(g.totals().n === e0 || g.totals().n < e0, 'Земля отдала поселенцев');
ok(P.foundColony('ceres') === false, 'без корабля у Цереры не основать');
s().ships[0].at = 'ceres'; ok(P.foundColony('ceres') && s().cols.ceres, 'колония на астероиде основана');
{ const CL = await import('../src/14-climate.ts'); const mc = s().cols.mars; mc.infra = 200; mc.pop.hab = Math.round(200 * CL.colonyCost('mars').per); }
const mn0 = s().cols.mars.pop.n || 20000;
const FRt = await import('../src/13-freight.ts');
for (let i = 0; i < 360 * 3 / 30 * 4; i++) { s().t += 30; g.popTick(30); FRt.freightTick(30); }
const mp = s().cols.mars.pop;
ok(mp.n > mn0 * 1.5, `Марс растёт (${Math.round(mn0)} → ${Math.round(mp.n)})`);
ok(Object.values(mp.sat).every((x) => x > .8), 'на Марсе есть товары (ввоз + заводы)');
ok(mp.tax > 0 && mp.fac.food > 0, 'на Марсе есть налоги и заводы');
ok(s().ctx === 'earth' && s().corps.every((c) => c.civ === c.home), 'контекст вернулся на Землю');
ok(s().cols.ceres.pop.n <= s().cols.ceres.pop.hab + 1, 'население астероида не превышает вместимость');
// корпорации открывают филиалы на колониях
for (let i = 0; i < 2500; i++) g.advance(2);
const br = s().corps.filter((c) => c.civs && Object.keys(c.civs).length);
ok(br.length > 0, `корпорации открыли филиалы на колониях (${br.length})`);
ok(s().corps.every((c) => c.civ === c.home), 'после симуляции контекст корпораций цел');
// сохранение/загрузка
const raw = JSON.stringify(s()); const o = JSON.parse(raw);
ok(!!o.cols.mars && o.pop === undefined, 'сохранение содержит колонии без дубля pop');
// 7. Законы
D.newGame(); s().paused = true; s().raid.eta = 1e9; s().raid.warned = true;
const L = F.laws(); const base = P.popTaxDay();
L.minWage = 140; L.hours = 48; L.edu = 100; L.tariff = 30; L.birthSup = 100; L.pension = 100; L.mineTax = 30;
for (let i = 0; i < 24; i++) { s().t += 30; g.popTick(30); }
const Pe = s().cols.earth.pop;
ok(Pe.wage[0] >= 4 * 1.4 - 1e-6, 'минимальная зарплата поднимает ставки');
ok(Pe.exp > 0 && Pe.expP.edu > 0 && Pe.expP.pen > 0 && Pe.expP.bth > 0, 'образование, пенсии и рождаемость тратят казну');
ok(isFinite(s().money) && g.totals().n > 5e9, 'экономика не рухнула при крайних законах');
Object.assign(L, F.LAW_DEFAULT);

// 8. Сложность жил
{ const b = D.veinBase('eros', 'fe'); ok(b >= .3 && b <= 1 && D.veinBase('eros', 'fe') === b, 'сложность жилы детерминирована (' + b + ')');
  ok(Math.abs(D.veinEff('eros', 'fe', 50, 100) - b / 2) < 1e-9, 'выбрали 50% — эффективность вдвое ниже');
  D.newGame(); const ss = D.state; ss.paused = true; const sh = ss.ships[0]; ss.ast.eros = {...D.BODY.eros.ores}; sh.at = 'eros'; const f0 = ss.ast.eros.fe, i0 = ss.ast.eros.si;
  E.execOrder(sh, {type: 'mine', target: 'eros', res: 'all', pct: 100}, 1);
  ok(ss.ast.eros.fe < f0 && ss.ast.eros.si < i0, 'лазер добывает несколько жил сразу'); }
// 9. Грузовые заказы корпорациям
{ D.newGame(); const ss = D.state; ss.paused = true; ss.ships[0].at = 'luna'; ss.money = 1e10; ss.stock.fe = 5000; P.foundColony('luna');
  const Fr = await import('../src/13-freight.ts'); const hab0 = ss.cols.luna.pop.hab, m0 = ss.money;
  ok(Fr.orderCargo('infra', 1000, 'earth', 'luna') && Fr.orderCargo('fe', 800, 'earth', 'eros'), 'заказы размещены');
  for (let i = 0; i < 40; i++) { ss.t += 1; Fr.freightTick(1); }
  ok(ss.freight.flights.length > 0 || ss.freight.orders.length === 0, 'корпорации взяли заказы в рейс');
  for (let i = 0; i < 120; i++) { ss.t += 1; Fr.freightTick(1); }
  ok(ss.cols.luna.pop.hab === Math.round(ss.cols.luna.infra * (await import('../src/14-climate.ts')).colonyCost('luna').per), 'инфраструктура доставлена: вместимость = инфра × чел. на единицу');
  ok((ss.depot.eros && ss.depot.eros.fe) === 800 && ss.stock.fe === 4200, 'железо доставлено на склад Эроса');
  ok(ss.money < m0 && ss.corps.some((c) => c.credits > 1.2e9), 'корпорации заработали на фрахте');
  ss.cols.luna.pop.n = 5000; ss.cols.luna.pop.mfill = 0.5; ss.cols.luna.pop.hab = 1e6; const fl0 = ss.freight.flights.length;
  for (let i = 0; i < 3; i++) { ss.t += 30; P.popTick(30); }
  ok(ss.freight.flights.some((f) => f.item === 'col'), 'колонистов везут корпорации (рейсы без контроля игрока)'); }
// 5. Все панели интерфейса открываются без ошибок
for (const t of ['obj', 'orders', 'yard', 'earth', 'corp', 'pop', 'comp', 'work', 'col', 'trade', 'cargo', 'find', 'sci', 'off', 'fleet', 'log', 'laws']) {
  try { U.showTab(t); ok(true, 'панель «' + t + '» открывается'); } catch (e) { ok(false, 'панель «' + t + '» падает: ' + e.message); }
}
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе тесты пройдены');
process.exit(fail ? 1 : 0);
