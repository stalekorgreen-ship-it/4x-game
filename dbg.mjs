const stub = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.assign(globalThis, { document: stub(), window: stub(), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {}, ResizeObserver: function () { return stub(); } });
const D = await import('/home/claude/4x-game/src/01-data.ts'); const E = await import('/home/claude/4x-game/src/04-engine.ts'); const P = await import('/home/claude/4x-game/src/07-population.ts'); await import('/home/claude/4x-game/src/06-corps.ts'); await import('/home/claude/4x-game/src/09-orders-ui.ts');
D.newGame(); const s = () => D.state; s().paused = true; s().raid.eta = 1e9; s().raid.warned = true;
s().ships[0].at = 'mars'; s().money = 1e10; P.foundColony('mars');
for (let i = 0; i < 2500; i++) E.advance(2);
const mp = s().cols.mars.pop; console.log('t', s().t / 360, 'gImp', JSON.stringify(mp.gImp), 'n', mp.n, 'fac', JSON.stringify(mp.fac));
console.log(s().corps.map(c => Math.round(c.credits / 1e9) + 'B/' + Object.values(c.civ.fac).reduce((a, b) => a + b, 0)).join(' '));
