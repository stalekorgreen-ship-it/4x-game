// @ts-nocheck
// Бой-демо: случайные сражения разных масштабов, чтобы посмотреть на корабли и бой. Не влияет на игру.
import { state, log } from './01-data.ts';
import { Battle } from './05-battle.ts';
import { focusBattle, ui, setHtml, $ } from './08-map-ui.ts';
import { BODIES, BODY, mkLas, mkMis, compOf, mkKey, specTons, fitSpec, TON_L } from './01-data.ts';
import { COLONIZABLE, colInfo, earthF, mkCol } from './07-population.ts';
import { createCorpShip, createCorpStation, pickStationSpot } from './06-corps.ts';
import { colonyCost } from './14-climate.ts';
import { advance } from './04-engine.ts';

const LC = (n, pw, fr) => Array.from({length: n}, () => mkLas(pw, fr)), MC = (n, a, sp, w, am) => Array.from({length: n}, () => mkMis(a, sp, w, am));
const R = (a, b) => a + Math.random() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), TAU = Math.PI * 2;
// шаблоны кораблей: [название, генератор спецификации]
const _rc = {};
const RCf = (cal, bar, ld) => _rc[cal + '/' + bar] || (_rc[cal + '/' + bar] = compOf(mkKey('rail', {cal, bar, ld: ld || 'a', saf: 1})).rcfg);
const gun = (n, cal, bar) => ({rails: n, railCfg: Array.from({length: n}, () => RCf(cal, bar || 1))});
const TYPES = {
  corvette: n => ({name: 'Корвет', ...gun(RI(2, 4), 5), flak: 1, eng: 2, L: R(.3, .45), arm: 1, spd: 1.5}),
  gunboat: n => ({name: 'Штурмовой катер', ...gun(RI(3, 5), 20), flak: 0, eng: 3, L: R(.4, .55), arm: 3, spd: 1.35, dopt0: 8}),
  destroyer: n => ({name: 'Эсминец', ...gun(RI(5, 8), Math.random() < .5 ? 10 : 15), flak: 2, eng: 3, L: R(.6, .8), arm: 4, spd: 1.15}),
  frigate: n => ({name: 'Фрегат ПВО', ...gun(2, 10), flak: RI(6, 10), eng: 3, L: R(.85, 1), arm: 2, spd: 1.1}),
  cruiser: n => ({name: 'Крейсер', ...gun(RI(14, 24), 15, 2), flak: 4, eng: 4, L: R(1.6, 2), arm: RI(6, 8), spd: .9}),
  brawler: n => ({name: 'Броненосец', ...gun(RI(12, 20), 20, 2), flak: 3, eng: 5, L: R(1.5, 1.9), arm: RI(8, 10), spd: .8, dopt0: 9}),
  battleship: n => ({name: 'Линкор', ...gun(RI(30, 40), 20, 2), flak: 6, eng: 5, L: R(2.8, 3.4), arm: RI(9, 10), spd: .7, defl: .1}),
  carrier: n => ({name: 'Авианосец', ...gun(4, 10), flak: 6, eng: 4, L: R(2.2, 2.8), arm: 5, spd: .8, F: RI(6, 14), B: RI(1, 4)}),
  swarmcarrier: n => ({name: 'Лёгкий авианосец', ...gun(2, 10), flak: 3, eng: 3, L: R(1.1, 1.4), arm: 2, spd: 1, F: RI(14, 22), B: 0}),
  bomber: n => ({name: 'Торпедоносец', ...gun(2, 10), flak: 2, eng: 3, L: R(1.2, 1.6), arm: 2, spd: .9, F: 2, B: RI(6, 12)}),
  // лазеры редки и огромны: один-два на огромном корабле
  laserCruiser: n => { const k = 1; return {name: 'Лазерный крейсер', ...gun(RI(6, 10), 10), flak: 4, lasers: k, laserCfg: LC(k, 'm', Math.random() < .5 ? 'f' : 'm'), eng: 5, L: R(2, 2.4), arm: 7, spd: .75}; },
  laserBattleship: n => { const k = 1; return {name: 'Лазерный линкор', ...gun(RI(10, 16), 15, 2), flak: 6, lasers: k, laserCfg: LC(k, 'l', 'f'), eng: 6, L: R(3, 3.6), arm: 9, spd: .65, defl: .1}; },
  missileFrigate: n => { const k = RI(2, 4); return {name: 'Ракетный фрегат', ...gun(2, 10), flak: 3, miss: k, missCfg: MC(k, ['l', 'm', 'h'][RI(0, 2)], ['s', 'm', 'f'][RI(0, 2)], ['s', 'm', 'l'][RI(0, 2)], 4), eng: 3, L: R(.9, 1.1), arm: 2, spd: 1.1}; },
  missileCruiser: n => { const k = RI(3, 6); return {name: 'Ракетный крейсер', ...gun(RI(6, 12), 15), flak: 4, miss: k, missCfg: MC(k, 'm', 'm', 'l', 8), eng: 4, L: R(1.5, 1.9), arm: 6, spd: .9}; },
  freighter: n => ({role: 'freight', name: 'Транспорт', rails: 0, flak: 1, eng: 3, L: R(.7, 1), arm: 1, spd: .75}),
};
// доли состава флота (раскладка по размеру)
const MIXES = {
  light: {corvette: 5, destroyer: 3, frigate: 1, gunboat: 2},
  line: {destroyer: 4, cruiser: 3, frigate: 2, battleship: 1, gunboat: 1},
  heavy: {cruiser: 3, battleship: 3, carrier: 1, destroyer: 2, frigate: 1, brawler: 2},
  carrier: {carrier: 2, frigate: 3, destroyer: 3, cruiser: 1, swarmcarrier: 2, bomber: 1},
  brawl: {brawler: 3, gunboat: 4, corvette: 4, destroyer: 2},
  swarm: {corvette: 12, gunboat: 4, frigate: 1, swarmcarrier: 1},
  strike: {bomber: 3, swarmcarrier: 2, frigate: 3, corvette: 3},
  lasers: {laserCruiser: 1, destroyer: 5, frigate: 2, brawler: 2, cruiser: 2, laserBattleship: 1},
  missiles: {missileFrigate: 4, missileCruiser: 2, destroyer: 2, frigate: 2, gunboat: 2},
  convoy: {freighter: 8, corvette: 2, destroyer: 1},
};
// ---- доктрины ИИ: у каждой стороны свой замысел при одинаковом весе ----
// вес флота — по тоннажу: корпус 50 000 т на км длины + истребители по 350 т, торпедоносцы по 400 т
const W3 = sp => specTons(fitSpec(sp)) / TON_L;
const setRails = (sp, k) => { const n = Math.max(sp.rails ? 1 : 0, Math.round(sp.rails * k)); if (!sp.rails) return; const base = sp.railCfg[0]; sp.rails = n; sp.railCfg = Array.from({length: n}, () => base); };
const DOCT = {
  armor: {n: 'ставка на броню', mix: 'line', mod: sp => { sp.arm = Math.min(10, (sp.arm || 2) + 2); setRails(sp, .85); sp.spd = (sp.spd || 1) * .92; }},
  armorH: {n: 'ставка на броню', mix: 'heavy', mod: sp => { sp.arm = Math.min(10, (sp.arm || 2) + 1); setRails(sp, 1.6); sp.defl = (sp.defl || 0) + .05; sp.spd = (sp.spd || 1) * 1.0; }},
  guns: {n: 'ставка на число орудий', mix: 'line', mod: sp => { sp.arm = Math.max(1, (sp.arm || 2) - 2); setRails(sp, 1.7); sp.spd = (sp.spd || 1) * 1.05; }},
  gunsH: {n: 'ставка на число орудий', mix: 'heavy', mod: sp => { sp.arm = Math.max(2, (sp.arm || 2) - 1); setRails(sp, 2.1); sp.spd = (sp.spd || 1) * 1.05; }},
  balanced: {n: 'сбалансированный флот', mix: 'line', mod: sp => setRails(sp, 1.2)},
  split: {n: 'истребители и бомбардировщики', mix: 'carrier', mod: sp => { if (sp.F) sp.F = Math.round(sp.F * 1.35); if (sp.B) sp.B = Math.round(sp.B * 1.35); }},
  fmBig: {n: 'истребители с противокорабельными ракетами', mix: {swarmcarrier: 6, carrier: 2, frigate: 2, destroyer: 3, cruiser: 1}, mod: sp => { if (sp.F) { sp.B = 0; sp.F = Math.round(sp.F * 1.15); sp.fmis = {n: 2, k: 'big'}; } }},
  fmSmall: {n: 'истребители с ракетами против мелких целей', mix: {swarmcarrier: 6, carrier: 2, frigate: 2, destroyer: 3, cruiser: 1}, mod: sp => { if (sp.F) { sp.B = 0; sp.F = Math.round(sp.F * 1.75); sp.fmis = {n: 2, k: 'small'}; } }},
  strike: {n: 'торпедный удар', mix: 'strike', mod: sp => { if (sp.B) sp.B = Math.round(sp.B * 1.3); if (sp.F) sp.F = Math.round(sp.F * 1.2); }},
  lasers: {n: 'лазерная ставка', mix: 'lasers'},
  missiles: {n: 'ракетная ставка', mix: 'missiles', mod: sp => { if (sp.miss) { sp.miss = Math.max(2, Math.round(sp.miss * .55)); sp.missCfg = sp.missCfg.slice(0, sp.miss); } }},
  brawl: {n: 'ближний бой', mix: 'brawl'},
  swarm: {n: 'рой малых кораблей', mix: 'swarm'},
  light: {n: 'лёгкий флот', mix: 'light', mod: sp => { sp.arm = Math.max(1, (sp.arm || 2) - 1); sp.spd = (sp.spd || 1) * .92; }},
  convoy: {n: 'конвой', mix: 'convoy'},
  assault: {n: 'десантный флот', mix: {frigate: 3, destroyer: 3, cruiser: 2, carrier: 1, brawler: 1}, mod: sp => { sp.mar = Math.round(({cv: 20, hc: 10, dd: 8, fr: 4}[sp.cls] || 4) * 4); setRails(sp, 1.3); sp.spd = (sp.spd || 1) * 1.08; }},
};
const BYSIZE = n => { const r = Math.random();  if (r < .08) return 'assault'; if (r < .3) return 'missiles'; if (r < .34) return 'brawl'; if (r < .44) return 'swarm'; if (r < .52) return 'strike'; if (r < .6) return Math.random() < .5 ? 'fmBig' : 'fmSmall';
  if (n < 12) return Math.random() < .5 ? 'light' : (Math.random() < .5 ? 'armor' : 'guns'); if (n < 40) { const q = Math.random(); return q < .22 ? 'split' : q < .5 ? 'armor' : q < .8 ? 'guns' : 'balanced'; } return Math.random() < .5 ? (Math.random() < .5 ? 'armorH' : 'gunsH') : (Math.random() < .5 ? 'armor' : 'guns'); };
// оснащение сканерами: радарщики, запасные радарщики, ПВО-радары и «слепая» основная масса
function outfit(specs) {
  const el = specs.filter(sp => (sp.L0 || sp.L) >= .6 && sp.role !== 'freight' && !sp.F).sort((a, b) => b.arm - a.arm || b.L - a.L), nP = Math.max(1, Math.ceil(el.length * .15)), nR = Math.max(1, Math.ceil(el.length * .1));
  const IR = (res) => ({k: 'ir', rng: res === 'n' ? 120 : 225, res: res === 'n' ? 1 : .5}), EM = {k: 'em', rng: 270, res: .5}, RAD = (rng, fine) => ({k: 'rad', rng: fine ? rng * .4 : rng, res: fine ? 1 : .4, fine: fine ? 1 : 0});
  const chOf = sp => Math.max(1, Math.min(8, Math.round((sp.rails + (sp.lasers || 0) * 2 + (sp.miss || 0)) / 6) + 1));
  el.forEach((sp, i) => { if (i < nP) { sp.scList = [IR('w'), EM, RAD(330), RAD(330, 1)]; sp.fcsN = Math.max(4, chOf(sp)); setRails(sp, .88); sp.prim = 1; } else if (i < nP + nR) { sp.scList = [IR('w'), RAD(180), RAD(180, 1)]; sp.fcsN = chOf(sp); sp.reserve = 1; } });
  for (const sp of specs) { if (sp.scList) continue; if (sp.name.includes('ПВО')) { sp.scList = [IR('n'), RAD(180, 1)]; sp.fcsN = 4; sp.reserve = 1; } else if (sp.F || sp.B) { sp.scList = [IR('w'), RAD(180, 1)]; sp.fcsN = 3; sp.reserve = 1; } else { sp.scList = (sp.L0 || sp.L) < .6 ? [IR('n')] : [IR('w')]; sp.fcsN = sp.role === 'freight' ? 0 : chOf(sp); } }
  return specs;
}
function pickType(mix, tot, keys) { let r = Math.random() * tot, k = keys[0]; for (const q of keys) { r -= mix[q]; if (r <= 0) { k = q; break; } } return k; }
// флот по числу кораблей или (если задан вес W) по весу
function fleet(n, mixOrDoc, fid, speed, W) {
  const doc = typeof mixOrDoc === 'string' ? DOCT[mixOrDoc] : null, mix = doc ? (typeof doc.mix === 'string' ? MIXES[doc.mix] : doc.mix) : mixOrDoc;
  const keys = Object.keys(mix), tot = keys.reduce((a, k) => a + mix[k], 0), out = [], sk = RI(4, 8);
  let w = 0;
  for (let i = 0; W ? (w < W && i < Math.max(8, n * 4)) : i < n; i++) { const k = pickType(mix, tot, keys), sp = TYPES[k](i); if (doc && doc.mod) doc.mod(sp); const ws = W3(sp); if (W && w > 0 && w + ws > W * 1.25) { if (w >= W * .85) break; continue; } w += ws; sp.name += ' №' + (i + 1); sp.fid = fid; sp.sk = sk; sp.spd = (sp.spd || 1) * speed; out.push(sp); }
  if (!W && n >= 25) { const nl = n >= 60 ? 2 : (Math.random() < .6 ? 1 : 0); for (let q = 0; q < nl; q++) { const sp = TYPES[Math.random() < .6 ? 'laserCruiser' : 'laserBattleship'](q); sp.name += ' №' + (n + q + 1); sp.fid = fid; sp.sk = sk; sp.spd = (sp.spd || 1) * speed; out.push(sp); } }
  if (!out.length) { const sp = TYPES[keys[0]](0); if (doc && doc.mod) doc.mod(sp); sp.name += ' №1'; sp.fid = fid; sp.sk = sk; out.push(sp); }
  return outfit(out);
}
const fleetW = specs => specs.reduce((a, sp) => a + W3(sp), 0);
// сколько кораблей: размер 1 — от 4 до 10, 2 — до 40, 3 — до 200 на сторону
const total = size => size === 1 ? RI(4, 10) : size === 2 ? RI(12, 40) : RI(70, 200);
const split = (n, parts) => { const w = Array.from({length: parts}, () => R(.5, 1.5)), s = w.reduce((a, b) => a + b, 0), r = w.map(x => Math.max(1, Math.round(n * x / s))); return r; };
export const SCENARIOS = {
  line: 'Линия фронта: два флота лоб в лоб',
  pincer: 'Клещи: один флот против нескольких с разных сторон',
  convoy: 'Налёт на конвой: транспорты с охраной и три группы рейдеров',
  chase: 'Погоня: флоты подходят по очереди, догоняя друг друга',
  armada: 'Армады: по несколько флотов у каждой стороны',
};
export function makeScenario(kind, size) {
  if (kind === 'random') kind = Object.keys(SCENARIOS)[RI(0, 4)];
  const ang0 = R(0, TAU), E = R(320, 480), late = [], fleets = [[], []];
  const place = (side, specs, ang, edge, t) => { for (const sp of specs) late.push({t: t + R(0, 20), side, spec: sp, edge, ang: ang + R(-.12, .12)}); };
  const mixFor = BYSIZE;
  let title = SCENARIOS[kind].split(':')[0];
  if (kind === 'line') {
    const n = total(size), fa = fleet(n, mixFor(n), 0, 1), W = fleetW(fa), nb = Math.max(4, Math.round(n * 1.2)); place(0, fa, ang0, E, 0); place(1, fleet(nb, mixFor(n), 1, 1, W), ang0 + Math.PI, E, 0);
  } else if (kind === 'pincer') {
    const nA = total(size), mA = mixFor(nA); place(0, fleet(nA, mA, 0, 1), ang0, E, 0);
    const k = RI(2, 4), nB = Math.round(total(size) * 1.1); split(nB, k).forEach((n, i) => place(1, fleet(n, mixFor(n), 10 + i, R(.9, 1.2)), ang0 + Math.PI + (i - (k - 1) / 2) * (TAU / (k + 1)), E, 0));
  } else if (kind === 'convoy') {
    const nC = total(size), nR = Math.max(4, Math.round(nC * R(.6, 1.2)));
    place(0, fleet(nC, 'convoy', 0, 1), ang0, E * .8, 0);
    const k = RI(2, 3); split(nR, k).forEach((n, i) => place(1, fleet(n, mixFor(n), 10 + i, R(1, 1.3)), ang0 + Math.PI + (i - (k - 1) / 2) * 1.1, E, i * R(100, 500)));
  } else if (kind === 'chase') {
    for (const side of [0, 1]) { const w = RI(3, 5); split(total(size), w).forEach((n, i) => place(side, fleet(n, mixFor(n), side * 10 + i, R(.7, 1.3)), ang0 + side * Math.PI + R(-.7, .7), E + R(-100, 150), i * R(250, 900))); }
  } else {
    for (const side of [0, 1]) { const w = RI(2, 4); split(total(size) * 1.0, w).forEach((n, i) => place(side, fleet(n, mixFor(n), side * 10 + i, R(.8, 1.25)), ang0 + side * Math.PI + (i - (w - 1) / 2) * .9 + R(-.2, .2), E, 0)); }
  }
  late.sort((a, b) => a.t - b.t);
  const cnt = [late.filter(x => x.side === 0).length, late.filter(x => x.side === 1).length];
  return {title: `Бой-демо: ${title} (${cnt[0]} против ${cnt[1]})`, fleets, late, demo: true, maxT: 14400, names: ['Синие', 'Красные'], onEnd: () => { state.demo = false; }};
}
export function startDemo(kind, size) {
  if (Battle.active()) return;
  const cfg = makeScenario(kind, size);
  state.demo = true; state.paused = false; Battle.begin(cfg); ui.bfollow = true; focusBattle(); ui.bfollow = false;
  log(cfg.title + '.');
}
export function refreshDemo() {
  const p = $('p-demo'); if (!p) return;
  if (!p._built) {
    p._built = true;
    p.innerHTML = `<div class="box"><h2>Бой-демо</h2><div class="help">Запускает случайное сражение у Земли, не влияющее на игру: можно посмотреть, как выглядят корабли, турели, повреждения и дым. Флоты подходят с разных сторон.</div>
      <div class="row"><label>Сценарий <select id="dm-kind"><option value="random">Случайный</option>${Object.entries(SCENARIOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
      <div class="row"><label>Размер <select id="dm-size"><option value="1">Небольшой (4–10 кораблей на сторону)</option><option value="2" selected>Средний (12–40)</option><option value="3">Огромный (70–200)</option></select></label></div>
      <div class="row"><button class="btn on" id="dm-go">Посмотреть бой</button></div><div class="help">Кнопки «К бою» и «Закончить» появятся в окне боя внизу. Скорость времени регулируется обычными кнопками сверху.</div></div>`;
    p.insertAdjacentHTML('beforeend', `<div class="box"><h2>Зрелая система</h2><div class="help">Заселяет 11 планет, спутников и астероидов (всего около 100 млрд человек) и запускает по 100 кораблей у каждой из 20 корпораций (≈2000 штук). Нужно, чтобы посмотреть, как выглядит и как тянет большая система. Текущая игра изменится: после просмотра нажмите «Новая игра».</div><div class="row"><button class="btn" id="dm-mature">Создать зрелую систему</button></div><div class="help" id="dm-msg"></div></div>`);
    p.addEventListener('click', e => { if (e.target.id === 'dm-mature') { $('dm-msg').textContent = 'Считаю, подождите несколько секунд…'; setTimeout(() => { const r = matureSystem(); $('dm-msg').textContent = `Готово: тел ${r.cols}, кораблей ${r.ships}. Нажмите «Пуск».`; ui.sel = {kind: 'body', id: 'earth'}; }, 30); } });
    p.addEventListener('click', e => { if (e.target.id === 'dm-go') { startDemo($('dm-kind').value, +$('dm-size').value); } });
  }
}

// Зрелая система: 12 заселённых тел, ~100 млрд человек, тысячи кораблей корпораций. Только для просмотра, лучше начать потом «Новую игру».
export function matureSystem() {
  const want = ['venus', 'mars', 'luna', 'phobos', 'deimos', 'ceres', 'vesta', 'pallas', 'hygiea', 'eros', 'davida'];
  const pool = BODIES.filter(b => COLONIZABLE(b.id) && !b.comet && !b.gen && !state.cols[b.id]).sort((a, b) => (b.d || 0) - (a.d || 0)).map(b => b.id);
  const ids = want.filter(id => BODY[id] && COLONIZABLE(id) && !state.cols[id]);
  for (const id of pool) { if (ids.length >= 11) break; if (!ids.includes(id)) ids.push(id); }
  const total = 100e9 - 9.6e9, T0 = total / ids.length;
  for (const id of ids) {
    const I = colInfo(id), b = BODY[id], per = colonyCost(id).per;
    mkCol(id, b.name, T0, {f: earthF, fs: 1, cover: 1, hab: Math.round(T0 * 1.4), dist: I.dist, seed: 0, kind: b.kind});
    state.cols[id].infra = Math.round(T0 * 1.4 / per);
  }
  let n = 0;
  for (const c of state.corps) {
    c.credits = 1e13;
    for (let i = 0; i < 100; i++) { createCorpShip(c, i % 8 === 7 ? 't' : 'm'); n++; }
    for (let i = 0; i < 2; i++) { const sp = pickStationSpot(c); if (sp) createCorpStation(c, sp); }
  }
  for (let i = 0; i < 160; i++) advance(.25); // разлетаются по системе
  log(`Демо «зрелая система»: заселено тел ${ids.length}, население ~100 млрд, кораблей корпораций ${n}.`);
  return {cols: ids.length, ships: n};
}
// контролируемый матч «состав против состава» (для проверки баланса)
export function duelScenario(a, b, n) {
  const late = [], fa = fleet(n, a, 0, 1), W = fleetW(fa), fb = fleet(n, b, 10, 1, W);
  [fa, fb].forEach((f, side) => { for (const sp of f) late.push({t: R(0, 20), side, spec: sp, edge: 400, ang: side * Math.PI + R(-.1, .1)}); });
  return {title: 'duel', fleets: [[], []], late, demo: true, maxT: 14400, names: [DOCT[a].n, DOCT[b].n], W: [fleetW(fa), fleetW(fb)], onEnd: () => { state.demo = false; }};
}
export const MIXNAMES = Object.keys(DOCT).filter(k => k !== 'convoy');
