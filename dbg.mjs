const stub = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.assign(globalThis, { document: stub(), window: stub(), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {}, ResizeObserver: function () { return stub(); } });
const D = await import('./src/01-data.ts'); const P = await import('./src/07-population.ts'); await import('./src/06-corps.ts'); await import('./src/09-orders-ui.ts');
D.newGame(); const s = () => D.state; s().paused = true;
for (let i = 0; i < 3; i++) { s().t += 30; P.popTick(30); }
const v = s().corps[5]; v.credits = -9e9; v.civ.neg = 5; v.civ.debt = 9e9;
P.popTick(30); console.log(s().corps.includes(v), v.credits, v.civ.neg, v.civ.debt, s().bankr);
P.popTick(30); console.log(s().corps.includes(v), v.credits, v.civ.neg, v.civ.debt, s().bankr);
