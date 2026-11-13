// @ts-nocheck
// Бой-демо: случайные сражения разных масштабов, чтобы посмотреть на корабли и бой. Не влияет на игру.
import { state, log } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { Battle } from './05-battle.ts';
import { focusBattle, ui, setHtml, $ } from './08-map-ui.ts';
import { randCraft, BODIES, BODY, mkLas, mkMis, compOf, mkKey, specTons, fitSpec, TON_L } from './01-data.ts';
import { COLONIZABLE, colInfo, earthF, mkCol } from './07-population.ts';
import { createCorpShip, createCorpStation, pickStationSpot } from './06-corps.ts';
import { colonyCost } from './14-climate.ts';
import { advance } from './04-engine.ts';
import { botSpec, previewSpec } from './16b-botdesign.ts';
import { designStats, CAV_PARTS, TANK_PARTS } from './01-data.ts';
const realSp = (parts, extra) => { const o = previewSpec(parts) || {rails: 0, flak: 0, L: .1}; o.spd = 1; return Object.assign(o, extra); };

const LC = (n, pw, fr) => Array.from({length: n}, () => mkLas(pw, fr)), MC = (n, a, sp, w, am) => Array.from({length: n}, () => mkMis(a, sp, w, am));
const R = (a, b) => a + Math.random() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), TAU = Math.PI * 2;
// шаблоны кораблей: [название, генератор спецификации]
const _rc = {};
const RCf = (cal, bar, ld) => _rc[cal + '/' + bar] || (_rc[cal + '/' + bar] = compOf(mkKey('rail', {cal, bar, ld: ld || 'a', saf: 1})).rcfg);
const _gc = {};
const GAT = (n, tw) => ({gat: n, gatCfg: Array.from({length: n}, () => _gc[tw || 0] || (_gc[tw || 0] = compOf(mkKey('gat', {tw: String(tw || 0)})).gcfg))});
const LZR = (lens, dur, caps) => compOf(mkKey('lgun', {lens: String(lens), dur: String(dur), caps: String(caps)})).lcfg;
const gun = (n, cal, bar) => ({rails: n, railCfg: Array.from({length: n}, () => RCf(cal, bar || 1))});
const TYPES = {
  corvette: n => ({name: 'Корвет', ...gun(RI(2, 4), 5), ...GAT(1), flak: 1, eng: 2, L: R(.3, .45), arm: 1, spd: 1.5}),
  gunboat: n => ({name: 'Штурмовой катер', ...gun(RI(3, 5), 20), ...GAT(1), flak: 0, eng: 3, L: R(.4, .55), arm: 3, spd: 1.35, dopt0: 8}),
  destroyer: n => ({name: 'Эсминец', ...gun(RI(5, 8), Math.random() < .5 ? 10 : 15), ...GAT(2), flak: 2, eng: 3, L: R(.6, .8), arm: 4, spd: 1.15}),
  frigate: n => ({name: 'Фрегат ПВО', ...gun(2, 10), ...GAT(RI(4, 8), 1), flak: RI(4, 6), eng: 3, L: R(.85, 1), arm: 2, spd: 1.1}),
  cruiser: n => ({name: 'Крейсер', ...gun(RI(14, 24), 15, 2), ...GAT(3, 1), flak: 4, eng: 4, L: R(1.6, 2), arm: RI(6, 8), spd: .9}),
  brawler: n => ({name: 'Броненосец', ...gun(RI(12, 20), Math.random() < .5 ? 20 : 25, 2), ...GAT(3), flak: 3, eng: 5, L: R(1.5, 1.9), arm: RI(8, 10), spd: .8, dopt0: 9}),
  battleship: n => ({name: 'Линкор', ...gun(RI(30, 40), Math.random() < .5 ? 25 : 30, 2), ...GAT(6, 1), flak: 6, eng: 5, L: R(2.8, 3.4), arm: RI(9, 10), spd: .7, defl: .1}),
  carrier: n => ({name: 'Авианосец', fq: randCraft('F'), bq: randCraft('B'), ...gun(4, 10), ...GAT(5, 1), flak: 6, eng: 4, L: R(2.2, 2.8), arm: 5, spd: .8, F: RI(6, 14), B: RI(1, 4)}),
  swarmcarrier: n => ({name: 'Лёгкий авианосец', fq: randCraft('F'), bq: randCraft('B'), ...gun(2, 10), ...GAT(3, 1), flak: 3, eng: 3, L: R(1.1, 1.4), arm: 2, spd: 1, F: RI(14, 22), B: 0}),
  bomber: n => ({name: 'Торпедоносец', fq: randCraft('F'), bq: randCraft('B'), ...gun(2, 10), flak: 2, eng: 3, L: R(1.2, 1.6), arm: 2, spd: .9, F: 2, B: RI(6, 12)}),
  // лазеры редки и огромны: один-два на огромном корабле
  laserCruiser: n => { const k = 1; return {name: 'Лазерный крейсер', ...gun(RI(6, 10), 10), flak: 4, lasers: k, laserCfg: [Math.random() < .5 ? LZR(30, 4, 300) : LZR(20, 5, 200)], eng: 5, L: R(2, 2.4), arm: 7, spd: .75}; },
  laserBattleship: n => { const k = 1; return {name: 'Лазерный линкор', ...gun(RI(10, 16), 15, 2), ...GAT(4, 1), flak: 6, lasers: k, laserCfg: [LZR(50, 6, 600)], eng: 6, L: R(3, 3.6), arm: 9, spd: .65, defl: .1}; },
  missileFrigate: n => { const k = RI(2, 4); return {name: 'Ракетный фрегат', ...gun(2, 10), flak: 3, miss: k, missCfg: MC(k, ['l', 'm', 'h'][RI(0, 2)], ['s', 'm', 'f'][RI(0, 2)], ['s', 'm', 'l'][RI(0, 2)], 4), eng: 3, L: R(.9, 1.1), arm: 2, spd: 1.1}; },
  missileCruiser: n => { const k = RI(3, 6); return {name: 'Ракетный крейсер', ...gun(RI(6, 12), 15), flak: 4, miss: k, missCfg: MC(k, 'm', 'm', 'l', 8), eng: 4, L: R(1.5, 1.9), arm: 6, spd: .9}; },
  supply: n => ({role: 'supply', name: 'Транспорт снабжения', rails: 0, flak: 2, ...GAT(2), eng: 3, L: R(.8, 1.1), arm: 1, spd: .85}),
  tanker: n => realSp(TANK_PARTS(), {role: 'supply', name: 'Боевой танкер'}),
  // перехватчик-кавалерист (470 т, 20 м/с², штанга дозаправки) после наскоков уходит к танкеру
  cavalry: n => realSp(CAV_PARTS(), {name: 'Перехватчик-кавалерист'}),
  freighter: n => ({role: 'freight', name: 'Транспорт', rails: 0, flak: 1, eng: 3, L: R(.7, 1), arm: 1, spd: .75}),
};
// доли состава флота (раскладка по размеру)
// лазеры и истребители временно убраны из игры (механика будет переделана): их типы заменены пушечными
const OFF_T = {carrier: 'cruiser', swarmcarrier: 'destroyer', bomber: 'frigate', laserCruiser: 'cruiser', laserBattleship: 'battleship'};
for (const k in OFF_T) TYPES[k] = TYPES[OFF_T[k]];
const MIXES = {
  light: {corvette: 5, destroyer: 3, frigate: 1, gunboat: 2},
  line: {supply: 1, destroyer: 4, cruiser: 3, frigate: 2, battleship: 1, gunboat: 1},
  heavy: {supply: 1, cruiser: 3, battleship: 3, carrier: 1, destroyer: 2, frigate: 1, brawler: 2},
  carrier: {supply: 1, carrier: 2, frigate: 3, destroyer: 3, cruiser: 1, swarmcarrier: 2, bomber: 1},
  brawl: {brawler: 3, gunboat: 4, corvette: 4, destroyer: 2},
  swarm: {corvette: 12, gunboat: 4, frigate: 1, swarmcarrier: 1},
  strike: {bomber: 3, swarmcarrier: 2, frigate: 3, corvette: 3},
  lasers: {supply: 1, laserCruiser: 1, destroyer: 5, frigate: 2, brawler: 2, cruiser: 2, laserBattleship: 1},
  missiles: {supply: 1, missileFrigate: 5, missileCruiser: 3, frigate: 2},
  cavalry: {tanker: 1, cavalry: 8, destroyer: 2, frigate: 1},
  convoy: {freighter: 8, corvette: 2, destroyer: 1},
};
// ---- доктрины ИИ: у каждой стороны свой замысел при одинаковом весе ----
// вес флота — по тоннажу: корпус 50 000 т на км длины + истребители по 350 т, торпедоносцы по 400 т
const W3 = sp => Math.min(2000, specTons(fitSpec(sp))) / TON_L; // вес в строю — уже с потолком 2000 т, иначе флоты выходят неравными
const setRails = (sp, k) => { const n = Math.max(sp.rails ? 1 : 0, Math.round(sp.rails * k)); if (!sp.rails) return; const base = sp.railCfg[0]; sp.rails = n; sp.railCfg = Array.from({length: n}, () => base); };
const DOCT = {
  cavalry: {n: 'кавалерия перехватчиков с танкером', mix: 'cavalry', mod: sp => {}},
  armor: {n: 'ставка на броню', mix: 'line', mod: sp => { sp.arm = Math.min(10, (sp.arm || 2) + 1); setRails(sp, .95); sp.spd = (sp.spd || 1) * .92; }},
  armorH: {n: 'ставка на броню', mix: 'heavy', mod: sp => { sp.arm = Math.min(10, (sp.arm || 2) + 1); setRails(sp, 1.6); sp.defl = (sp.defl || 0) + .05; sp.spd = (sp.spd || 1) * 1.0; }},
  guns: {n: 'ставка на число орудий', mix: 'line', mod: sp => { sp.arm = Math.max(1, (sp.arm || 2) - 2); setRails(sp, 1.7); sp.spd = (sp.spd || 1) * 1.05; }},
  gunsH: {n: 'ставка на число орудий', mix: 'heavy', mod: sp => { sp.arm = Math.max(2, (sp.arm || 2) - 1); setRails(sp, 2.1); sp.spd = (sp.spd || 1) * 1.05; }},
  balanced: {n: 'сбалансированный флот', mix: 'line', mod: sp => setRails(sp, 1.2)},
  split: {n: 'истребители и бомбардировщики', mix: 'carrier', mod: sp => { if (sp.F) sp.F = Math.round(sp.F * 1.35); if (sp.B) sp.B = Math.round(sp.B * 1.35); }},
  fmBig: {n: 'истребители с противокорабельными ракетами', mix: {swarmcarrier: 6, carrier: 2, frigate: 2, destroyer: 3, cruiser: 1}, mod: sp => { if (sp.F) { sp.B = 0; sp.F = Math.round(sp.F * 1.15); sp.fmis = {n: 2, k: 'big'}; } }},
  fmSmall: {n: 'истребители с ракетами против мелких целей', mix: {swarmcarrier: 6, carrier: 2, frigate: 2, destroyer: 3, cruiser: 1}, mod: sp => { if (sp.F) { sp.B = 0; sp.F = Math.round(sp.F * 2.1); sp.fmis = {n: 2, k: 'small'}; } }},
  strike: {n: 'торпедный удар', mix: 'strike', mod: sp => { if (sp.B) sp.B = Math.round(sp.B * 1.3); if (sp.F) sp.F = Math.round(sp.F * 1.2); }},
  lasers: {n: 'лазерная ставка', mix: 'lasers'},
  missiles: {n: 'ракетная ставка', mix: 'missiles', mod: sp => { if (sp.miss) { sp.miss = Math.max(2, Math.round(sp.miss * .35)); sp.missCfg = sp.missCfg.slice(0, sp.miss); } }},
  brawl: {n: 'ближний бой', mix: 'brawl'},
  swarm: {n: 'рой малых кораблей', mix: 'swarm', mod: sp => { setRails(sp, 2.0); sp.flak = (sp.flak || 0) + 1; }},
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
// демо-корабли не тяжелее MAXT т: длина и число орудий/двигателей ужимаются пропорционально
const MAXT = 2000;
// осевые орудия легче и дешевле: ИИ ставит ~60% рельсотронов осевыми (бой ведётся носом к врагу)
function axify(sp) { if (sp.railCfg && sp.railCfg.length) { const n = Math.ceil(sp.railCfg.length * .6); sp.railCfg = sp.railCfg.map((c, i) => i < n ? {...c, ax: 1} : c); } return sp; }
function capTons(sp) { const t = sp.tons || specTons(sp); if (t <= MAXT) return sp; const k = MAXT / t, cut = (n, a) => { const m = Math.max(n > 0 ? 1 : 0, Math.round(n * k)); return [m, a ? a.slice(0, m) : a]; };
  sp.tons = MAXT; sp.L = Math.max(.02, sp.L * Math.cbrt(k)); [sp.rails, sp.railCfg] = cut(sp.rails || 0, sp.railCfg); [sp.gat, sp.gatCfg] = cut(sp.gat || 0, sp.gatCfg); [sp.flak, sp.flakCfg] = cut(sp.flak || 0, sp.flakCfg); sp.eng = Math.max(1, Math.round((sp.eng || 3) * Math.cbrt(k)));
  if (sp.fuelCap) { sp.fuelCap *= k; if (sp.fuel != null) sp.fuel *= k; } if (sp.ammoCap) sp.ammoCap = Math.round(sp.ammoCap * k); return sp; }
function fleet(n, mixOrDoc, fid, speed, W) {
  const doc = typeof mixOrDoc === 'string' ? DOCT[mixOrDoc] : null, mix = doc ? (typeof doc.mix === 'string' ? MIXES[doc.mix] : doc.mix) : mixOrDoc;
  let mix2 = mix;
  if (doc && mixOrDoc !== 'convoy') { // разнообразие: в любой флот подмешиваем авианосцы, ракетные корабли, торпедоносцы, ПВО
    const t0 = Object.values(mix).reduce((a, b) => a + b, 0); mix2 = {...mix};
    for (const [k, f] of [['swarmcarrier', .1], ['missileFrigate', .08], ['missileCruiser', .06], ['bomber', .06], ['frigate', .08], ['carrier', .04]]) mix2[k] = (mix2[k] || 0) + t0 * f * R(.5, 1.5);
  }
  const keys = Object.keys(mix2), tot = keys.reduce((a, k) => a + mix2[k], 0), out = [], sk = RI(4, 8);
  let w = 0;
  for (let i = 0; W ? (w < W && i < Math.max(8, n * 4)) : i < n; i++) { const k = pickType(mix2, tot, keys), sp = TYPES[k](i); if (doc && doc.mod) doc.mod(sp); const ws = W3(sp); if (W && w > 0 && w + ws > W * 1.25) { if (w >= W * .85) break; continue; } w += ws; sp.name += ' №' + (i + 1); sp.fid = fid; sp.sk = sk; sp.spd = (sp.spd || 1) * speed; out.push(sp); }
  if (!W && n >= 25) { const nl = n >= 60 ? 2 : (Math.random() < .6 ? 1 : 0); for (let q = 0; q < nl; q++) { const sp = TYPES[Math.random() < .6 ? 'laserCruiser' : 'laserBattleship'](q); sp.name += ' №' + (n + q + 1); sp.fid = fid; sp.sk = sk; sp.spd = (sp.spd || 1) * speed; out.push(sp); } }
  if (mix.tanker && out.some(sp => sp.probe) && !out.some(sp => sp.tanker)) { const sp = TYPES.tanker(0); sp.name += ' №' + (out.length + 1); sp.fid = fid; sp.sk = sk; out.push(sp); } // кавалерии без танкера не бывает
  if (!out.length) { const sp = TYPES[keys[0]](0); if (doc && doc.mod) doc.mod(sp); sp.name += ' №1'; sp.fid = fid; sp.sk = sk; out.push(sp); }
  { // лазеры — редкая сверхпушка: не больше одного корабля на 10 и не больше 8 на флот
    const cap = Math.min(8, Math.floor(out.length / 10)), ls = out.filter(sp => sp.lasers > 0);
    ls.slice(cap).forEach(sp => { sp.lasers = 0; sp.laserCfg = []; sp.name = sp.name.replace('Лазерный линкор', 'Линкор').replace('Лазерный крейсер', 'Крейсер'); });
  }
  for (const sp of out) sp.spdMul = speed;
  return outfit(out).map(botSpec).map(capTons).map(axify); // все корабли — из настоящих деталей: бот проектирует и пробует варианты
}
const fleetW = specs => specs.reduce((a, sp) => a + W3(sp), 0);
// сколько кораблей: размер 1 — от 4 до 10, 2 — до 40, 3 — до 200 на сторону
const total = size => size === 5 ? 50 : size === 1 ? RI(4, 10) : size === 2 ? RI(12, 40) : size === 4 ? 300 : RI(70, 200);
const split = (n, parts) => { const w = Array.from({length: parts}, () => R(.5, 1.5)), s = w.reduce((a, b) => a + b, 0), r = w.map(x => Math.max(1, Math.round(n * x / s))); return r; };
export const warFleet = (n, fid, speed) => fleet(n, BYSIZE(n), fid, speed);
export const warStrength = specs => fleetW(specs);
export const rockField = (n, cx, cy, sx, sy, r0, r1) => Array.from({length: n}, () => ({t: 'rock', x: cx + R(-sx, sx), y: cy + R(-sy, sy), r: R(r0, r1)}));
// стреляющая станция: неподвижна, много орудий, толстая броня
export function stationSpec(fid) { return botSpec({name: 'Орбитальная станция', role: 'station', rails: 14, railCfg: Array.from({length: 14}, () => RCf(15, 2)), flak: 8, lasers: 2, laserCfg: LC(2, 'l', 'f'), arm: 7, eng: 1, L: .9, spd: 0, tons: 90000, sk: 6, fid, station: 1, F: 0, B: 0, dmg: 0}); }
export const SCENARIOS = {
  line: 'Линия фронта: два флота лоб в лоб',
  pincer: 'Клещи: один флот против нескольких с разных сторон',
  convoy: 'Налёт на конвой: транспорты с охраной и три группы рейдеров',
  chase: 'Погоня: флоты подходят по очереди, догоняя друг друга',
  armada: 'Армады: по несколько флотов у каждой стороны',
  range: 'Полигон: по одному кораблю каждого типа, близко друг к другу',
  station: 'Бой у станции: оборона орбитальной станции',
  asteroid: 'Бой в поле астероидов: укрытия и тесные проходы',
  planet: 'Бой у планеты: огромный диск закрывает сектор',
  ring: 'Бой у кольцевого мира: планета с поясом обломков',
};
export function makeScenario(kind, size) {
  if (kind === 'random') kind = Object.keys(SCENARIOS)[RI(0, 4)];
  if (kind === 'range') return rangeScenario();
  if (kind === 'station' || kind === 'asteroid' || kind === 'planet' || kind === 'ring') return envScenario(kind, size);
  const ang0 = R(0, TAU), E = R(320, 480), late = [], fleets = [[], []];
  const place = (side, specs, ang, edge, t) => { for (const sp of specs) late.push({t: t + R(0, 20), side, spec: sp, edge, ang: ang + R(-.12, .12)}); };
  const mixFor = BYSIZE;
  let title = SCENARIOS[kind].split(':')[0];
  if (size === 5) { // зеркальный бой: одинаковые флоты по 50 кораблей, одинаковое время прибытия
    const fa = fleet(50, mixFor(50), 0, 1), fb = JSON.parse(JSON.stringify(fa)).map(sp => ({...sp, fid: 1}));
    for (const sp of fa) late.push({t: 0, side: 0, spec: sp, edge: E, ang: ang0}); for (const sp of fb) late.push({t: 0, side: 1, spec: sp, edge: E, ang: ang0 + Math.PI}); title = 'Зеркальный бой';
  } else if (kind === 'line') {
    const n = total(size), fa = fleet(n, mixFor(n), 0, 1), W = fleetW(fa), nb = size === 4 ? n : Math.max(4, Math.round(n * 1.2)); place(0, fa, ang0, E, 0); place(1, fleet(nb, mixFor(n), 1, 1, W), ang0 + Math.PI, E, 0);
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
  setTimeout(() => colInit(p), 0); setTimeout(() => hooks.stressInit && hooks.stressInit(p), 0);
  if (!p._built) {
    p._built = true;
    p.innerHTML = `<div class="box"><h2>Бой-демо</h2><div class="help">Запускает случайное сражение у Земли, не влияющее на игру: можно посмотреть, как выглядят корабли, турели, повреждения и дым. Флоты подходят с разных сторон.</div>
      <div class="row"><label>Сценарий <select id="dm-kind"><option value="random">Случайный</option>${Object.entries(SCENARIOS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}</select></label></div>
      <div class="row"><label>Размер <select id="dm-size"><option value="1">Небольшой (4–10 кораблей на сторону)</option><option value="2" selected>Средний (12–40)</option><option value="3">Огромный (70–200)</option><option value="5">50 на 50, одинаковые флоты</option><option value="4">300 на 300 (проверка производительности, F3 — замер)</option></select></label></div>
      <div class="row"><button class="btn on" id="dm-go">Посмотреть бой</button><button class="btn" id="dm-war">Глобальная война (3–5 флотов у каждой стороны)</button></div><div class="help">Кнопки «К бою» и «Закончить» появятся в окне боя внизу. Скорость времени регулируется обычными кнопками сверху.</div></div>`;
    p.insertAdjacentHTML('beforeend', `<div class="box"><h2>Зрелая система</h2><div class="help">Заселяет 11 планет, спутников и астероидов (всего около 100 млрд человек) и запускает по 100 кораблей у каждой из 20 корпораций (≈2000 штук). Нужно, чтобы посмотреть, как выглядит и как тянет большая система. Текущая игра изменится: после просмотра нажмите «Новая игра».</div><div class="row"><button class="btn" id="dm-mature">Создать зрелую систему</button></div><div class="help" id="dm-msg"></div></div>`);
    p.addEventListener('click', e => { if (e.target.id === 'dm-mature') { $('dm-msg').textContent = 'Считаю, подождите несколько секунд…'; setTimeout(() => { const r = matureSystem(); $('dm-msg').textContent = `Готово: тел ${r.cols}, кораблей ${r.ships}. Нажмите «Пуск».`; ui.sel = {kind: 'body', id: 'earth'}; }, 30); } });
    p.addEventListener('click', e => { if (e.target.id === 'dm-war' && hooks.startWar) hooks.startWar(); });
    p.addEventListener('click', e => { if (e.target.id === 'dm-go') { startDemo($('dm-kind').value, +$('dm-size').value); } });
  }
}

// ===== Колизей: у каждой стороны 100 000 т водоизмещения; игрок набирает флот из своих проектов, бот собирает свой — потом бой =====
export const COL_BUDGET = 100000;
const col = {mine: {}, bot: [], botName: ''};
const colTons = sp => Math.round(sp.tons || 0);
function colMineSpecs() {
  const out = [];
  for (const d of state.designs) { const n = col.mine[d.id] || 0; if (!n) continue; const sp = previewSpec(d.parts); if (!sp) continue; for (let i = 0; i < n; i++) out.push({...sp, name: d.name + ' №' + (i + 1), spd: sp.spd || 1}); }
  return out;
}
function colDesigns() { return state.designs.map(d => { const sp = previewSpec(d.parts), st = designStats(d.parts); return {d, sp, st, tons: sp ? colTons(sp) : 0, ok: !!sp && !st.errors.length}; }); }
export function colBuildBot() { // бот пробует несколько флотов разных доктрин и берёт тот, что полнее использует бюджет
  let best = null, bn = '';
  for (let k = 0; k < 6; k++) {
    const mix = MIXNAMES[RI(0, MIXNAMES.length - 1)], pool = fleet(80, mix, 10 + k, 1), pick = []; let sum = 0;
    for (const sp of pool.sort(() => Math.random() - .5)) { const t = colTons(sp); if (t > 0 && sum + t <= COL_BUDGET) { pick.push(sp); sum += t; } if (sum > COL_BUDGET * .985) break; }
    if (pick.length && (!best || sum > best.sum)) { best = {pick, sum}; bn = DOCT[mix].n; }
  }
  col.bot = best ? best.pick : []; col.botName = bn;
}
function colRender() {
  const box = $('col-box'); if (!box) return;
  const ds = colDesigns(), used = ds.reduce((a, x) => a + (x.ok ? (col.mine[x.d.id] || 0) * x.tons : 0), 0), botT = col.bot.reduce((a, sp) => a + colTons(sp), 0);
  const by = {}; for (const sp of col.bot) by[sp.name.replace(/ №\d+$/, '')] = (by[sp.name.replace(/ №\d+$/, '')] || 0) + 1;
  $('col-list').innerHTML = ds.map(x => `<div class="row"><span class="grow">${x.d.name} <span class="muted">${x.ok ? fmtT(x.tons) + ' т' : 'проект не готов'}</span></span>${x.ok ? `<span class="ct">${[-5, -1].map(v => `<button class="btn sm" data-cd="${x.d.id}" data-cv="${v}">${v < -1 ? '−5' : '−'}</button>`).join('')}<b>${col.mine[x.d.id] || 0}</b>${[1, 5, 25].map(v => `<button class="btn sm" data-cd="${x.d.id}" data-cv="${v}">${v > 1 ? '+' + v : '+'}</button>`).join('')}</span>` : ''}</div>`).join('') || '<div class="muted">Нет проектов: создайте корабль в конструкторе.</div>';
  $('col-sum').innerHTML = `<div class="row"><span>Ваш флот: <b class="${used > COL_BUDGET ? 'warn' : ''}">${fmtT(used)}</b> / ${fmtT(COL_BUDGET)} т</span><span>Бот: <b>${fmtT(botT)}</b> / ${fmtT(COL_BUDGET)} т${col.botName ? ' · ' + col.botName : ''}${col.bot.length ? ' · ' + Object.entries(by).map(([k, v]) => v + '× ' + k).join(', ') : ''}</span></div>`;
  $('col-go').disabled = !(used > 0 && used <= COL_BUDGET && col.bot.length);
}
const fmtT = n => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
export function startColiseum() {
  if (Battle.active()) return;
  const mine = colMineSpecs(), bot = col.bot; if (!mine.length || !bot.length) return;
  const late = [], ang0 = R(0, TAU);
  [mine, bot].forEach((f, side) => { for (const sp of f) late.push({t: R(0, 20), side, spec: sp, edge: 400, ang: ang0 + side * Math.PI + R(-.12, .12)}); });
  const cfg = {title: `Колизей: ${mine.length} против ${bot.length}`, fleets: [[], []], late, demo: true, maxT: 14400, names: ['Игрок', 'Бот'], onEnd: res => { state.demo = false; log(`Колизей завершён. ${res && res.win != null ? 'Победа: ' + (res.win === 0 ? 'игрок' : 'бот') + '.' : ''}`); }};
  state.demo = true; state.paused = false; Battle.begin(cfg); ui.bfollow = true; focusBattle(); ui.bfollow = false;
  log(cfg.title + '.'); const mc = $('mclose'); if (mc) mc.click();
}
function colInit(p) {
  if ($('col-box')) { colRender(); return; }
  p.insertAdjacentHTML('beforeend', `<div class="box" id="col-box"><h2>Колизей</h2><div class="help">У вас и у бота по ${fmtT(COL_BUDGET)} т водоизмещения. Соберите флот из своих проектов, бот соберёт свой (он сам пробует разные доктрины и конструкции) — после этого начнётся бой.</div>
    <div id="col-list"></div><div id="col-sum"></div>
    <div class="row"><button class="btn" id="col-bot">Собрать флот бота</button><button class="btn" id="col-clear">Очистить мой флот</button><button class="btn on" id="col-go">В бой</button></div></div>`);
  p.addEventListener('click', e => {
    const b = e.target.closest('[data-cd]');
    if (b) { const id = +b.dataset.cd, dd = colDesigns().find(x => x.d.id === id); if (!dd || !dd.ok) return; const cur = col.mine[id] || 0, v = +b.dataset.cv;
      let n = Math.max(0, cur + v); const others = colDesigns().reduce((a, x) => a + (x.ok && x.d.id !== id ? (col.mine[x.d.id] || 0) * x.tons : 0), 0); n = Math.min(n, Math.floor((COL_BUDGET - others) / Math.max(1, dd.tons))); col.mine[id] = n; if (!n) delete col.mine[id]; colRender(); return; }
    if (e.target.id === 'col-bot') { colBuildBot(); colRender(); }
    else if (e.target.id === 'col-clear') { col.mine = {}; colRender(); }
    else if (e.target.id === 'col-go') { startColiseum(); }
  });
  colBuildBot(); colRender();
}

// Зрелая система: 12 заселённых тел, ~100 млрд человек, тысячи кораблей корпораций. Только для просмотра, лучше начать потом «Новую игру».
export function matureSystem(perCorp = 100, settle = 160, stCnt = 2, stEvery = 1) {
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
    for (let i = 0; i < perCorp; i++) { createCorpShip(c, i % 8 === 7 ? 't' : 'm'); n++; }
    if (state.corps.indexOf(c) % stEvery === 0) for (let i = 0; i < stCnt; i++) { const sp = pickStationSpot(c); if (sp) createCorpStation(c, sp); }
  }
  for (let i = 0; i < settle; i++) advance(.25); // разлетаются по системе
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

// «Полигон»: по одному кораблю каждого типа с каждой стороны, старт близко
export function rangeScenario() {
  const late = [], types = Object.keys(DOCT).filter(k => k !== 'convoy');
  for (const side of [0, 1]) for (const t of types) { const f = fleet(1, t, side * 20, 1); for (const sp of f) late.push({t: R(0, 5), side, spec: sp, edge: 160, ang: side * Math.PI + R(-.35, .35)}); }
  return {title: 'Полигон: все типы кораблей', fleets: [[], []], late, demo: true, maxT: 14400, names: ['Синие', 'Красные'], onEnd: () => { state.demo = false; }};
}

// бои в особых условиях: те же флоты, но вокруг станция, астероиды, планета или кольцевой мир
export function envScenario(kind, size) {
  const ang0 = R(0, TAU), E = R(330, 450), late = [], rk = (n, cx, cy, sx, sy, r0, r1) => Array.from({length: n}, () => ({t: 'rock', x: cx + R(-sx, sx), y: cy + R(-sy, sy), r: R(r0, r1)}));
  const place = (side, specs, ang, edge, t) => { for (const sp of specs) late.push({t: t + R(0, 20), side, spec: sp, edge, ang: ang + R(-.15, .15)}); };
  const n = total(size), mixFor = BYSIZE, a2 = ang0 + Math.PI / 2 * (Math.random() < .5 ? 1 : -1);
  let envList = [], title = '', defE = E;
  if (kind === 'station') { envList = rk(10, 0, 0, 45, 45, .4, 1.3).filter(r => Math.hypot(r.x, r.y) > 14); title = 'Бой у станции'; defE = E * .3 }
  else if (kind === 'asteroid') { envList = rk(95, 0, 0, 240, 180, .5, 4.5).concat(rk(6, 0, 0, 120, 90, 5, 8)); title = 'Бой в поле астероидов' }
  else if (kind === 'planet') { envList = [{t: 'planet', x: Math.cos(a2) * 120, y: Math.sin(a2) * 120, r: R(34, 44)}]; title = 'Бой у планеты' }
  else { const cx = Math.cos(a2) * 105, cy = Math.sin(a2) * 105; envList = [{t: 'planet', x: cx, y: cy, r: 20, ring: [34, 58]}]; for (let i = 0; i < 130; i++) { const a = R(0, TAU), d = R(34, 58); envList.push({t: 'rock', x: cx + Math.cos(a) * d, y: cy + Math.sin(a) * d, r: R(.35, 1.6)}) } title = 'Бой у кольцевого мира' }
  const fa = fleet(n, mixFor(n), 0, 1), W = fleetW(fa), nb = size === 4 ? n : Math.max(4, Math.round(n * 1.2));
  place(0, fa, ang0, defE, 0); place(1, fleet(nb, mixFor(n), 1, 1, W), ang0 + Math.PI, E, 0);
  if (kind === 'station') late.push({t: 0, side: 0, spec: stationSpec(0), edge: 0, ang: 0});
  late.sort((a, b) => a.t - b.t);
  const cnt = [late.filter(x => x.side === 0).length, late.filter(x => x.side === 1).length];
  return {title: `Бой-демо: ${title} (${cnt[0]} против ${cnt[1]})`, fleets: [[], []], late, demo: true, envList, maxT: 14400, names: ['Синие', 'Красные'], onEnd: () => { state.demo = false; }};
}
