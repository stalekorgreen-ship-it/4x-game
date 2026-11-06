// @ts-nocheck
// Бой-демо: случайные сражения разных масштабов, чтобы посмотреть на корабли и бой. Не влияет на игру.
import { state, log } from './01-data.ts';
import { Battle } from './05-battle.ts';
import { focusBattle, ui, setHtml, $ } from './08-map-ui.ts';
import { BODIES, BODY, mkLas, mkMis } from './01-data.ts';
import { COLONIZABLE, colInfo, earthF, mkCol } from './07-population.ts';
import { createCorpShip, createCorpStation, pickStationSpot } from './06-corps.ts';
import { colonyCost } from './14-climate.ts';
import { advance } from './04-engine.ts';

const LC = (n, pw, fr) => Array.from({length: n}, () => mkLas(pw, fr)), MC = (n, a, sp, w, am) => Array.from({length: n}, () => mkMis(a, sp, w, am));
const R = (a, b) => a + Math.random() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), TAU = Math.PI * 2;
// шаблоны кораблей: [название, генератор спецификации]
const TYPES = {
  corvette: n => ({name: 'Корвет', rails: RI(2, 4), flak: 1, eng: 2, L: R(.3, .45), arm: 1, spd: 1.4}),
  destroyer: n => ({name: 'Эсминец', rails: RI(5, 8), flak: 2, eng: 3, L: R(.6, .8), arm: 2, spd: 1.15}),
  frigate: n => ({name: 'Фрегат ПВО', rails: 2, flak: RI(6, 10), eng: 3, L: R(.45, .6), arm: 2, spd: 1.1}),
  cruiser: n => ({name: 'Крейсер', rails: RI(14, 24), flak: 4, eng: 4, L: R(1.6, 2), arm: RI(3, 4), spd: .9}),
  battleship: n => ({name: 'Линкор', rails: RI(30, 40), flak: 6, eng: 5, L: R(2.8, 3.4), arm: 5, spd: .7, defl: .1}),
  carrier: n => ({name: 'Авианосец', rails: 4, flak: 6, eng: 4, L: R(2.2, 2.8), arm: 3, spd: .8, F: RI(6, 14), B: RI(1, 4)}),
  laserCruiser: n => { const k = RI(3, 6), fr = Math.random() < .5 ? 'f' : 'm'; return {name: 'Лазерный крейсер', rails: RI(4, 8), flak: 4, lasers: k, laserCfg: LC(k, 'm', fr), eng: 4, L: R(1.6, 2), arm: 3, spd: .9}; },
  laserBattleship: n => { const k = RI(4, 7); return {name: 'Лазерный линкор', rails: RI(8, 14), flak: 6, lasers: k, laserCfg: LC(k, 'l', 'f'), eng: 5, L: R(2.8, 3.4), arm: 5, spd: .7, defl: .1}; },
  missileFrigate: n => { const k = RI(3, 6); return {name: 'Ракетный фрегат', rails: 2, flak: 3, miss: k, missCfg: MC(k, ['l', 'm', 'h'][RI(0, 2)], ['s', 'm', 'f'][RI(0, 2)], ['s', 'm', 'l'][RI(0, 2)], 8), eng: 3, L: R(.5, .7), arm: 2, spd: 1.1}; },
  missileCruiser: n => { const k = RI(4, 8); return {name: 'Ракетный крейсер', rails: RI(6, 12), flak: 4, miss: k, missCfg: MC(k, 'm', 'm', 'l', 16), eng: 4, L: R(1.5, 1.9), arm: 3, spd: .9}; },
  freighter: n => ({role: 'freight', name: 'Транспорт', rails: 0, flak: 1, eng: 3, L: R(.7, 1), arm: 1, spd: .75}),
};
// доли состава флота (раскладка по размеру)
const MIXES = {
  light: {corvette: 5, destroyer: 3, frigate: 1},
  line: {destroyer: 4, cruiser: 3, frigate: 2, battleship: 1},
  heavy: {cruiser: 3, battleship: 3, carrier: 1, destroyer: 2, frigate: 1},
  carrier: {carrier: 2, frigate: 3, destroyer: 3, cruiser: 1},
  lasers: {laserCruiser: 3, destroyer: 3, frigate: 1, laserBattleship: 1},
  missiles: {missileFrigate: 4, missileCruiser: 2, destroyer: 2, frigate: 2},
  convoy: {freighter: 8, corvette: 2, destroyer: 1},
};
function fleet(n, mix, fid, speed) {
  const keys = Object.keys(mix), tot = keys.reduce((a, k) => a + mix[k], 0), out = [], sk = RI(4, 8);
  for (let i = 0; i < n; i++) { let r = Math.random() * tot, k = keys[0]; for (const q of keys) { r -= mix[q]; if (r <= 0) { k = q; break; } } const sp = TYPES[k](i); sp.name += ' №' + (i + 1); sp.fid = fid; sp.sk = sk; sp.spd = (sp.spd || 1) * speed; out.push(sp); }
  return out;
}
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
  const mixFor = n => { const r = Math.random(); if (n >= 8 && r < .22) return MIXES.lasers; if (n >= 6 && r < .44) return MIXES.missiles; return n < 12 ? MIXES.light : n < 40 ? (Math.random() < .5 ? MIXES.line : MIXES.carrier) : (Math.random() < .5 ? MIXES.heavy : MIXES.line); };
  let title = SCENARIOS[kind].split(':')[0];
  if (kind === 'line') {
    for (const side of [0, 1]) { const n = total(size), m = mixFor(n); place(side, fleet(n, m, side, 1), ang0 + side * Math.PI, E, 0); }
  } else if (kind === 'pincer') {
    const nA = total(size), mA = mixFor(nA); place(0, fleet(nA, mA, 0, 1), ang0, E, 0);
    const k = RI(2, 4), nB = Math.round(total(size) * 1.1); split(nB, k).forEach((n, i) => place(1, fleet(n, mixFor(n), 10 + i, R(.9, 1.2)), ang0 + Math.PI + (i - (k - 1) / 2) * (TAU / (k + 1)), E, 0));
  } else if (kind === 'convoy') {
    const nC = total(size), nR = Math.max(4, Math.round(nC * R(.6, 1.2)));
    place(0, fleet(nC, MIXES.convoy, 0, 1), ang0, E * .8, 0);
    const k = RI(2, 3); split(nR, k).forEach((n, i) => place(1, fleet(n, mixFor(n), 10 + i, R(1, 1.3)), ang0 + Math.PI + (i - (k - 1) / 2) * 1.1, E, i * R(100, 500)));
  } else if (kind === 'chase') {
    for (const side of [0, 1]) { const w = RI(3, 5); split(total(size), w).forEach((n, i) => place(side, fleet(n, mixFor(n), side * 10 + i, R(.7, 1.3)), ang0 + side * Math.PI + R(-.7, .7), E + R(-100, 150), i * R(250, 900))); }
  } else {
    for (const side of [0, 1]) { const w = RI(2, 4); split(total(size) * 1.0, w).forEach((n, i) => place(side, fleet(n, mixFor(n), side * 10 + i, R(.8, 1.25)), ang0 + side * Math.PI + (i - (w - 1) / 2) * .9 + R(-.2, .2), E, 0)); }
  }
  late.sort((a, b) => a.t - b.t);
  const cnt = [late.filter(x => x.side === 0).length, late.filter(x => x.side === 1).length];
  return {title: `Бой-демо: ${title} (${cnt[0]} против ${cnt[1]})`, fleets, late, demo: true, maxT: 5400, names: ['Синие', 'Красные'], onEnd: () => { state.demo = false; }};
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
