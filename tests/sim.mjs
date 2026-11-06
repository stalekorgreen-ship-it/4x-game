// Тесты симуляции без браузера: грузим файлы игры в vm с заглушкой DOM.
// Тесты симуляции без браузера: модули игры грузятся в Node с заглушкой DOM.
const stub = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.assign(globalThis, { document: stub(), window: stub(), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {}, ResizeObserver: function () { return stub(); } });
const D = await import('../src/01-data.ts');
const E = await import('../src/04-engine.ts');
const P = await import('../src/07-population.ts');
await import('../src/06-corps.ts');
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
ok(ur > 0.02 && ur < 0.15, `безработица в разумных пределах (${(ur * 100).toFixed(1)}%)`);
ok(Object.values(s().pop.sat).every((x) => x > 0.8), 'товаров хватает (≥80% спроса)');

// 2. Корпорации: 800 дней игры, у них растёт число кораблей
D.newGame();
s().paused = true; s().raid.eta = 1e9; s().raid.warned = true;
for (let i = 0; i < 1600; i++) g.advance(0.5);
const ships = s().ships.filter((x) => x.corp).length;
ok(s().corps.length === 4, '4 корпорации');
ok(ships >= 4, `корабли корпораций живы (${ships})`);
ok(s().money > 5e7, 'налоги капают');
console.log(fail ? `\nПровалено: ${fail}` : '\nВсе тесты пройдены');
process.exit(fail ? 1 : 0);
