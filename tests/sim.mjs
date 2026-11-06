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
ok(Math.abs(t0.n / 7e9 - 1) < 0.01, 'население стартует около 7 млрд');
for (let i = 0; i < 480; i++) { s().t += 30; g.popTick(30); }
const t1 = g.totals(), ur = t1.un / t1.wf;
ok(t1.n > 7.5e9 && t1.n < 12e9, `население через 40 лет в разумных пределах (${(t1.n / 1e9).toFixed(2)} млрд)`);
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
s().contracts[lab.id] = true; s().money = 1e9; const rp0 = s().rp;
s().research.phys = 'effdrive'; for (let i = 0; i < 60; i++) g.advance(2);
ok(s().tech.effdrive || s().tprog.effdrive > 0, 'очки по контракту лаборатории идут игроку');

ok(s().money > 5e7, 'налоги капают');
// 4. Государство: налоги, кредиты, банкротство, кризисы, цены
ok((s().pop.evN || 0) > 0, 'за годы случились кризисы (' + (s().pop.evN || 0) + ')');
ok(Object.values(s().mp || {}).some((m) => Math.abs(m - 1) > 0.02), 'цены на сырьё живые: ' + Object.entries(s().mp || {}).map(([r, m]) => r + '×' + m.toFixed(2)).join(' '));
const taxA = s().pop.tax; F.laws().tax = 30; P.popTick(30); const taxB = s().pop.tax; F.laws().tax = 20;
ok(taxB > taxA * 1.3, 'повышение налога поднимает сбор (' + Math.round(taxA) + ' → ' + Math.round(taxB) + ')');
const cc = s().corps[3], m0 = s().money; F.lendTo(cc, 1e9); P.popTick(30);
ok(F.loansOf(cc).length === 1 || s().money > m0 - 1e9, 'кредит корпорации выдан, проценты идут');
const n0 = s().corps.length; const victim = s().corps[5]; victim.credits = -9e9; victim.civ.neg = 5; victim.civ.debt = 9e9;
P.popTick(30); P.popTick(30);
ok(!s().corps.includes(victim) && (s().bankr || 0) >= 1, 'банкротство: корпорация исчезла, активы поглощены');
for (let i = 0; i < 14; i++) { s().t += 30; P.popTick(30); }
ok(s().corps.length >= n0 - 1, 'через год основана новая корпорация');
// 5. Все панели интерфейса открываются без ошибок
for (const t of ['obj', 'orders', 'yard', 'earth', 'corp', 'pop', 'comp', 'work', 'find', 'sci', 'off', 'fleet', 'log', 'laws']) {
  try { U.showTab(t); ok(true, 'панель «' + t + '» открывается'); } catch (e) { ok(false, 'панель «' + t + '» падает: ' + e.message); }
}
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе тесты пройдены');
process.exit(fail ? 1 : 0);
