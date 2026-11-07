// Долгий прогон: несколько сидов × десятки лет, колонии на всех телах, проверка инвариантов (NaN, отрицательные запасы, взрывной рост).
const stub = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.assign(globalThis, { document: stub(), window: stub(), localStorage: (globalThis.__ls = { m: new Map(), getItem(k) { return this.m.has(k) ? this.m.get(k) : null }, setItem(k, v) { this.m.set(k, v) } }), requestAnimationFrame() {}, ResizeObserver: function () { return stub(); } });
const D = await import('../src/01-data.ts'); const E = await import('../src/04-engine.ts'); await import('../src/03-build.ts');
const P = await import('../src/07-population.ts'); await import('../src/06-corps.ts'); await import('../src/09-orders-ui.ts'); await import('../src/12-state.ts');
const FRt = await import('../src/13-freight.ts');
const seeds = (process.argv[2] || '1,2,3').split(','), years = +process.argv[3] || 40, raids = process.argv[4] === 'raids';
let fail = 0; const issues = new Map();
const note = (k, v) => { if (!issues.has(k)) { issues.set(k, v); console.log('ISSUE', k, v); fail++ } };
function scan(o, path, depth, seen) {
  if (depth > 9 || o === null || typeof o !== 'object' || seen.has(o)) return; seen.add(o);
  for (const k of Object.keys(o)) { const v = o[k], pp = path + '.' + k;
    if (typeof v === 'number') { if (!Number.isFinite(v)) note('nonfinite ' + pp.replace(/\.\d+/g, '[]'), String(v));
      else if (v < -1e-6 && /(^|\.)(n|un|st|fuel|stock|cargo|hab|infra|pop)$/.test(pp) && !/money|credits|debt|neg|bal|profit/.test(pp)) note('negative ' + pp.replace(/\.\d+/g, '[]'), String(v)) }
    else if (typeof v === 'object') scan(v, pp, depth + 1, seen) } }
for (const sd of seeds) {
  let a = +sd * 2654435761 >>> 0; Math.random = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 };
  D.newGame(); let s = D.state; s.paused = true; if (!raids) { s.raid.eta = 1e9; s.raid.warned = true }
  s.money = 1e11; let last = P.totals().n;
  try {
    for (let y = 0; y < years; y++) {
      if (y % 5 === 2) for (const id of ['mars', 'luna', 'ceres', 'ganymede', 'titan', 'venus', 'europa', 'vesta']) { if (s.ships[0] && D.BODY[id] && !s.cols[id]) { s.ships[0].at = id; try { P.foundColony(id) } catch (e) { note('foundColony throws ' + id, e.message) } } }
      for (let i = 0; i < 180; i++) E.advance(2);
      /* popTick и freightTick уже вызываются из advance (corpTick) */
      const tt = P.totals(); if (tt.n > last * 1.6 || tt.n < last * .5) note(`pop jump seed${sd} y${y}`, last + '→' + tt.n); last = tt.n;
      scan(s, 's', 0, new WeakSet());
      if (y % 10 === 4) { // сохранение → загрузка: население, деньги, колонии и корабли должны сохраниться, игра должна идти дальше
        const n0 = P.totals().n, m0 = D.state.money, c0 = Object.keys(D.state.cols).length, sh0 = D.state.ships.length, t0 = D.state.t;
        E.saveGame(); if (!E.loadGame()) note('loadGame failed seed' + sd, 'false'); const st2 = D.state; s = st2;
        const n1 = P.totals().n; if (Math.abs(n1 - n0) / n0 > 1e-6) note('save/load pop mismatch', n0 + '→' + n1);
        if (st2.money !== m0) note('save/load money mismatch', m0 + '→' + st2.money); if (Object.keys(st2.cols).length !== c0 || st2.ships.length !== sh0 || st2.t !== t0) note('save/load struct mismatch', c0 + '/' + sh0 + ' → ' + Object.keys(st2.cols).length + '/' + st2.ships.length);
        st2.paused = true; if (!raids) { st2.raid.eta = 1e9; st2.raid.warned = true } for (let i = 0; i < 60; i++) E.advance(2); }
      for (const id in s.cols) { const c = s.cols[id].pop; if (c && c.n > (c.hab || 1e12) * 1.5 + 1000 && id !== 'earth') note('over hab ' + id, c.n + '>' + c.hab) }
      if (y % 10 === 9) console.log(`seed${sd} y${y + 1}: pop ${(tt.n / 1e9).toFixed(2)}B cols ${Object.keys(s.cols).length} corps ${s.corps.length} ships ${s.ships.length} money ${(s.money / 1e9).toFixed(1)}G sat ${Math.min(...Object.values(s.pop.sat)).toFixed(2)} ur ${(tt.un / tt.wf * 100).toFixed(1)}%`);
    }
  } catch (e) { note('EXCEPTION seed' + sd, e.stack.split('\n').slice(0, 4).join(' | ')) }
}
console.log(fail ? 'ПРОБЛЕМ: ' + fail : 'Долгий прогон: проблем нет'); process.exit(fail ? 1 : 0);
