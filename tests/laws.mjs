// Крайние значения законов: случайные комбинации в пределах ползунков, проверка на NaN/отрицательные когорты/обвал
const stub = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.assign(globalThis, { document: stub(), window: stub(), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {}, ResizeObserver: function () { return stub(); } });
const D = await import('../src/01-data.ts'); const E = await import('../src/04-engine.ts'); await import('../src/03-build.ts');
const P = await import('../src/07-population.ts'); await import('../src/06-corps.ts'); await import('../src/09-orders-ui.ts'); const F = await import('../src/12-state.ts');
const R = { tax: [5, 40], subInd: [0, 50], subSci: [0, 50], subSpace: [0, 50], minWage: [0, 150], hours: [30, 50], edu: [0, 100], birthSup: [0, 100], pension: [0, 100], tariff: [0, 50], mineTax: [0, 50] };
let fail = 0; const bad = (m) => { console.log('ISSUE', m); fail++ };
const N = +process.argv[2] || 12;
for (let k = 0; k < N; k++) {
  let a = (k + 1) * 7919 >>> 0; const rr = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296 }; Math.random = rr;
  D.newGame(); const s = D.state; s.paused = true; s.raid.eta = 1e9; s.raid.warned = true; s.rng = k * 977 + 1; s.money = 1e10;
  const L = F.laws(), mode = k % 3, desc = [];
  for (const key in R) { const [lo, hi] = R[key]; L[key] = mode === 0 ? (rr() < .5 ? lo : hi) : mode === 1 ? Math.round(lo + rr() * (hi - lo)) : (rr() < .5 ? lo : hi); desc.push(key + '=' + L[key]) }
  let n0 = P.totals().n;
  try { for (let y = 0; y < 12; y++) { for (let i = 0; i < 180; i++) E.advance(2);
      const t = P.totals(); const vals = [t.n, t.un, t.wf, s.money, s.pop.tax]; if (!vals.every(Number.isFinite)) { bad(`non-finite run${k} y${y} ${desc.join(' ')}`); break }
      let neg = 0; for (const id in s.cols) { const c = s.cols[id].pop; for (let q = 0; q < 4; q++) for (let ag = 0; ag < c.c[q].length; ag++) if (c.c[q][ag].n < -1e-6) neg++ } if (neg) { bad(`negative cohorts ${neg} run${k} y${y} ${desc.join(' ')}`); break }
      if (t.n > n0 * 2.5 || t.n < n0 * .3) { bad(`pop ${n0 / 1e9}→${t.n / 1e9}B run${k} y${y} ${desc.join(' ')}`); break } }
    const t = P.totals(); console.log(`run${k} ok pop ${(t.n / 1e9).toFixed(2)}B ur ${(t.un / t.wf * 100).toFixed(1)}% money ${(s.money / 1e9).toFixed(0)}G | ${desc.join(' ')}`);
  } catch (e) { bad(`EXCEPTION run${k} ${desc.join(' ')} ${e.stack.split('\n').slice(0, 3).join('|')}`) }
}
console.log(fail ? 'ПРОБЛЕМ: ' + fail : 'Законы: проблем нет'); process.exit(fail ? 1 : 0);
