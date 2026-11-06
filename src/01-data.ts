// @ts-nocheck
import { bindCrew, eqFor, genOfficer, pilFuel, pilSpeed, staffFor } from './02-crew.ts';
import { initCorps } from './06-corps.ts';
import { initPop } from './07-population.ts';
import { H, bar } from './08-map-ui.ts';
'use strict';
/* ===== ДАННЫЕ ===== */
export const SAVE_KEY = 'poyas4x-save-v8';
export const SPEED_K = 0.25;   // а.е./сутки на (мощность/масса)
export const FUEL_K = 0.15;    // т топлива на а.е. на тонну массы / КПД
export const WEAR_AU = 1.0;    // % износа на а.е. пути
export const WEAR_MINE = 0.1;  // % износа в сутки добычи
export const REPAIR_RATE = 8;  // % ремонта в сутки
export const ORE_PER_SPARE = 4;
export const EPOCH = Date.UTC(2200, 0, 1);
export const SPEEDS = [{m:1,l:'1 мин'},{m:20,l:'20 мин'},{m:60,l:'1 час'},{m:180,l:'3 часа'},{m:480,l:'8 часов'},{m:1440,l:'1 день'}];

export const COMP = {
  ion:   {name:'Ионный двигатель', desc:'Мощность 20, экономичный', power:20, mass:5, eff:1, cost:{ti:15, ree:4, cu:10}},
  chem:  {name:'Химический двигатель', desc:'Мощность 50, жрёт топливо (КПД 0.35)', power:50, mass:6, eff:0.35, cost:{fe:15, ni:10}},
  tank:  {name:'Топливный бак', desc:'50 т топлива', fuel:50, mass:4, cost:{fe:6, ti:4}},
  cargo: {name:'Грузовой отсек / склад', desc:'200 т груза (руда, лёд, платина)', cargo:200, mass:8, cost:{fe:12}},
  laser: {name:'Шахтёрский лазер', desc:'5 т/сутки, нужно 2 человека экипажа', mine:5, mass:6, cost:{pt:3, ree:3, si:8}},
  cabin: {name:'Каюты экипажа', desc:'5 мест', crew:5, mass:4, cost:{fe:6, c:6}},
  life:  {name:'Система жизнеобеспечения', desc:'Рассчитана на 10 человек', life:10, mass:4, cost:{c:8, cu:6, si:4}},
  xfer:  {name:'Система передачи топлива', desc:'Перекачка топлива другим кораблям и станциям', xfer:1, mass:5, cost:{cu:8, si:6, ti:4}},
  repair:{name:'Ремонтный док', desc:'Чинит корабли у станции, тратит тех. изделия', repair:1, mass:15, cost:{fe:30, cu:15, si:10, pt:1}},
  spares:{name:'Склад тех. изделий', desc:'Хранит 100 тех. изделий', spares:100, mass:6, cost:{fe:10, ti:4}},
  lab_phys:{name:'Физическая лаборатория', desc:'Изучает физику у аномальных объектов', lab:'phys', mass:8, cost:{si:10, cu:8, ree:2}},
  lab_eng: {name:'Инженерная лаборатория', desc:'Изучает инженерные аномалии', lab:'eng', mass:8, cost:{fe:10, ti:5, cu:6}},
  lab_bio: {name:'Биолаборатория', desc:'Изучает биологические аномалии', lab:'bio', mass:8, cost:{c:10, si:6, cu:4}},
  fusion:{name:'Термоядерный двигатель', desc:'Мощность 120, КПД 1.6 (нужна технология)', power:120, mass:10, eff:1.6, cost:{u:5, ti:20, ree:6, cu:15}, tech:'fusion'},
  laser2:{name:'Тяжёлый лазер', desc:'12 т/сутки (нужна технология)', mine:12, mass:9, cost:{pt:5, ree:5, si:12}, tech:'laser2'},
  armor: {name:'Броневая плита', desc:'+1 слой брони на каждом секторе корабля', armor:1, mass:20, cost:{fe:40, ti:10}},
  rail:  {name:'Рельсотрон (турель)', desc:'Бьёт по кораблям на 60 км, перезарядка 60 с', rail:1, mass:6, cost:{fe:10, cu:8, ti:4}},
  flak:  {name:'Зенитная турель', desc:'Сбивает истребители, бомбардировщики и торпеды', flak:1, mass:5, cost:{fe:8, cu:8, si:6}},
  hangar_f:{name:'Ангар истребителей', desc:'10 истребителей (пополняются техизделиями)', hangF:10, hangars:1, mass:30, cost:{fe:60, si:20, ti:10}},
  hangar_b:{name:'Ангар бомбардировщиков', desc:'5 бомбардировщиков с торпедами', hangB:5, hangars:1, mass:30, cost:{fe:60, si:20, ti:10, pt:2}},
  hook:  {name:'Буксирная сцепка', desc:'Тянет до 2000 т (корабль или станцию)', tow:2000, mass:8, cost:{ti:15, fe:15, ni:5}},
};
/* ===== НАСТРАИВАЕМЫЕ МОДУЛИ ===== */
// Ключ варианта: «база|опция=знач|опция=знач». Голый ключ = значения по умолчанию.
export const O = (id, name, def, vals) => ({id, name, def, vals: vals.map(([v, l]) => ({v, l}))});
export const SZ = O('sz', 'Размер', 'm', [['s', 'малый ×½'], ['m', 'средний ×1'], ['l', 'большой ×2']]);
export const SZK = {s: 0.5, m: 1, l: 2};
export const scl = (c, k) => {
  for (const f of ['power', 'fuel', 'cargo', 'mine', 'spares', 'tow']) if (c[f]) c[f] = Math.round(c[f] * k * 100) / 100;
  if (c.crew) c.crew = Math.max(1, Math.round(c.crew * k));
  if (c.life) c.life = Math.max(1, Math.round(c.life * k));
  c.mass = Math.round(c.mass * Math.pow(k, 0.9) * 10) / 10;
  for (const r in c.cost) c.cost[r] = Math.max(1, Math.round(c.cost[r] * k));
};
export const mulCost = (c, m) => { for (const r in c.cost) c.cost[r] = Math.max(1, Math.round(c.cost[r] * m)); };
export const addCost = (c, r, v) => { c.cost[r] = (c.cost[r] || 0) + v; };
export const snapPct = v => { let n = +v; if (!(n > 0)) n = 100; n = Math.min(500, n); return n < 5 ? 1 : Math.round(n / 5) * 5; };
export const engOpts = def => [{id: 'pw', name: 'Мощность, %', def: '100', range: true}, O('tune', 'Настройка', 'n', [['e', 'эконом'], ['n', 'стандарт'], ['b', 'форсаж']])];
// чем больше двигатель, тем выше КПД и легче каждая единица мощности
export const engAp = (c, s) => {
  const k = +s.pw.v / 100, e0 = c.eff;
  c.power = c.power * k; c.mass = Math.max(0.1, Math.round(c.mass * Math.pow(k, 0.85) * 10) / 10);
  c.eff = e0 * Math.max(0.3, 1 + 0.18 * Math.log2(k));
  for (const r in c.cost) c.cost[r] = Math.max(1, Math.round(c.cost[r] * Math.pow(k, 0.9)));
  if (s.tune.v === 'e') { c.power *= 0.8; c.eff *= 1.2; } else if (s.tune.v === 'b') { c.power *= 1.3; c.eff *= 0.8; c.mass = Math.round(c.mass * 11) / 10; }
  c.power = Math.round(c.power * 10) / 10; c.eff = Math.round(c.eff * 100) / 100;
  c.size = Math.round(2 * Math.cbrt(c.mass) * 10) / 10;
  c.desc = `${s.pw.v}% · мощность ${c.power}, КПД ${c.eff}, габарит ~${c.size} м`;
};
export const sizeAp = (txt) => (c, s) => { scl(c, SZK[s.sz.v]); c.desc = txt(c); };
COMP.ion.opts = engOpts(20); COMP.ion.ap = engAp;
COMP.chem.opts = engOpts(50); COMP.chem.ap = engAp;
COMP.fusion.opts = engOpts(120); COMP.fusion.ap = engAp;
COMP.tank.opts = [SZ, O('dn', 'Бак', 'n', [['n', 'обычный'], ['c', 'сжатое топливо +30%']])];
COMP.tank.ap = (c, s) => { if (s.dn.v === 'c') { c.fuel *= 1.3; c.mass = Math.round(c.mass * 1.15 * 10) / 10; addCost(c, 'ti', 3); } scl(c, SZK[s.sz.v]); c.desc = `${c.fuel} т топлива`; };
COMP.cargo.opts = [SZ, O('cn', 'Конструкция', 'n', [['l', 'лёгкая'], ['n', 'стандартная'], ['h', 'усиленная']])];
COMP.cargo.ap = (c, s) => { if (s.cn.v === 'l') { c.cargo = 160; c.mass *= 0.6; } else if (s.cn.v === 'h') { c.cargo = 260; c.mass *= 1.4; addCost(c, 'ti', 6); } scl(c, SZK[s.sz.v]); c.desc = `${c.cargo} т груза`; };
COMP.laser.opts = [SZ, O('cool', 'Охлаждение', 'n', [['n', 'пассивное'], ['a', 'активное +30%']])];
COMP.laser.ap = (c, s) => { if (s.cool.v === 'a') { c.mine *= 1.3; c.mass = Math.round(c.mass * 1.25 * 10) / 10; addCost(c, 'cu', 4); addCost(c, 'si', 4); } scl(c, SZK[s.sz.v]); c.desc = `${Math.round(c.mine * 10) / 10} т/сутки, 2 человека экипажа на лазер`; };
COMP.laser2.opts = COMP.laser.opts; COMP.laser2.ap = (c, s) => { COMP.laser.ap(c, s); c.desc = `${Math.round(c.mine * 10) / 10} т/сутки (нужна технология)`; };
COMP.cabin.opts = [SZ]; COMP.cabin.ap = sizeAp(c => `${c.crew} мест`);
COMP.life.opts = [SZ]; COMP.life.ap = sizeAp(c => `Рассчитана на ${c.life} человек`);
COMP.spares.opts = [SZ]; COMP.spares.ap = sizeAp(c => `Хранит ${c.spares} тех. изделий`);
COMP.hook.opts = [O('sz', 'Мощность', 'm', [['s', '1000 т'], ['m', '2000 т'], ['l', '4000 т']])]; COMP.hook.ap = sizeAp(c => `Тянет до ${c.tow} т`);
for (const k of ['lab_phys', 'lab_eng', 'lab_bio']) {
  COMP[k].opts = [O('eq', 'Оборудование', 's', [['s', 'базовое'], ['a', 'продвинутое ×2']])];
  COMP[k].ap = (c, s) => { if (s.eq.v === 'a') { c.labw = 2; c.mass = Math.round(c.mass * 1.8); mulCost(c, 2); c.desc += ' (×2)'; } };
}
// --- рельсотрон ---
export const RAIL_CAL = {5: {dmg: 0.5, vp: 4, m: 2.1}, 10: {dmg: 1, vp: 6, m: 6}, 15: {dmg: 2, vp: 7, m: 11}, 20: {dmg: 3.5, vp: 8, m: 17}};
export const RAIL_LD = {m: {rel: 1, mass: 1, fail: 1, n: 'ручное'}, a: {rel: 0.8, mass: 1.25, fail: 1.3, n: 'автоматическое'}, f: {rel: 0.6, mass: 1.6, fail: 2.2, n: 'скоростное'}};
COMP.rail.opts = [O('cal', 'Калибр', '10', [['5', '5 мм'], ['10', '10 мм'], ['15', '15 мм'], ['20', '20 мм']]),
  O('bar', 'Стволов', '1', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']]),
  O('ld', 'Заряжание', 'm', [['m', 'ручное'], ['a', 'автомат'], ['f', 'скоростное']]),
  O('saf', 'Предохранители', '0', [['0', 'нет'], ['1', '1'], ['2', '2'], ['3', '3']])];
COMP.rail.ap = (c, s) => {
  const cal = +s.cal.v, bar = +s.bar.v, ld = RAIL_LD[s.ld.v], saf = +s.saf.v, B = RAIL_CAL[cal];
  const f = Math.pow(cal / 10, 1.5) * (1 + 0.55 * (bar - 1));
  c.mass = Math.round(B.m * (1 + 0.55 * (bar - 1)) * ld.mass * (1 + 0.08 * saf) * 10) / 10;
  c.cost = {fe: Math.max(2, Math.round(10 * f)), cu: Math.max(2, Math.round(8 * f * (s.ld.v === 'm' ? 1 : s.ld.v === 'a' ? 1.3 : 1.8))), ti: Math.max(1, Math.round(4 * f)) + 2 * saf};
  c.rcfg = {cal, bar, dmg: B.dmg, vp: B.vp, rng: B.vp * 10, shells: bar,
    rel: Math.round(Math.pow(cal / 10, 0.7) * (1 + 0.2 * (bar - 1)) * ld.rel * 100) / 100,
    fail: Math.round(0.015 * Math.sqrt(cal / 10) * Math.sqrt(bar) * ld.fail * Math.pow(0.5, saf) * 10000) / 10000,
    sig: Math.round(Math.pow(10 / cal, 0.3) * (1 + 0.1 * (bar - 1)) * 100) / 100};
  const r = c.rcfg;
  c.name = `Рельсотрон ${cal} мм${bar > 1 ? ' ×' + bar : ''}`;
  c.desc = `урон ${B.dmg}, ${bar} ств., бьёт на ${r.rng} км, перезарядка ${Math.round(60 * r.rel)} с, ${ld.n} заряжание, ${saf ? saf + ' предохр.' : 'без предохр.'}, осечка ${(r.fail * 100).toFixed(1)}%`;
  c.rail = 1;
};
// --- зенитка ---
export const FLK = {20: {blast: 0.8, rng: 45, rel: 0.7, m: 3}, 40: {blast: 1.2, rng: 60, rel: 1, m: 5}, 76: {blast: 1.8, rng: 75, rel: 1.4, m: 9}};
COMP.flak.opts = [O('cal', 'Калибр', '40', [['20', '20 мм'], ['40', '40 мм'], ['76', '76 мм']]),
  O('rt', 'Темп огня', 'n', [['n', 'обычный'], ['b', 'очередями']]), O('saf', 'Предохранители', '0', [['0', 'нет'], ['1', '1'], ['2', '2']])];
COMP.flak.ap = (c, s) => {
  const B = FLK[+s.cal.v], b = s.rt.v === 'b', saf = +s.saf.v;
  c.mass = Math.round(B.m * (b ? 1.3 : 1) * (1 + 0.08 * saf) * 10) / 10;
  c.cost = {fe: Math.round(B.m * 1.6), cu: Math.round(B.m * 1.6 * (b ? 1.4 : 1)), si: Math.round(B.m * 1.2) + saf * 2};
  c.fcfg = {blast: B.blast, rng: B.rng, rel: Math.round(B.rel * (b ? 0.7 : 1) * 100) / 100, fail: Math.round(0.01 * (b ? 1.8 : 1) * Math.pow(0.5, saf) * 10000) / 10000};
  c.name = `Зенитка ${s.cal.v} мм`;
  c.desc = `взрыв ${B.blast} км, дальность ${B.rng} км, перезарядка ${Math.round(60 * c.fcfg.rel)} с, ${b ? 'очередями' : 'обычный темп'}, осечка ${(c.fcfg.fail * 100).toFixed(1)}%`;
};
// --- броня ---
COMP.armor.opts = [O('th', 'Толщина', '1', [['1', '1 слой'], ['2', '2 слоя'], ['3', '3 слоя']]), O('mat', 'Материал', 's', [['s', 'сталь'], ['t', 'титан (легче)'], ['r', 'реактивная (отражает 20%)']])];
COMP.armor.ap = (c, s) => {
  const th = +s.th.v, m = s.mat.v;
  c.armor = th; c.mass = 20 * th; c.cost = {fe: 40 * th, ti: 10 * th};
  if (m === 't') { c.mass = Math.round(c.mass * 0.7); c.cost = {fe: 15 * th, ti: 35 * th}; }
  if (m === 'r') { c.mass = Math.round(c.mass * 1.25); c.cost = {fe: 40 * th, ti: 10 * th, cu: 12 * th, si: 8 * th}; c.defl = 0.2; }
  c.desc = `+${th} слоя брони на каждом секторе${m === 'r' ? ', 20% попаданий отражается' : ''}`;
};
// --- ангары ---
COMP.hangar_f.opts = [O('cl', 'Класс', 's', [['l', 'лёгкие (15 шт)'], ['s', 'обычные (10 шт)'], ['h', 'тяжёлые (6 шт)']])];
COMP.hangar_f.ap = (c, s) => {
  const t = {l: [15, 6, 2.4, 40, 25], s: [10, 8, 2, 60, 30], h: [6, 14, 1.5, 100, 38]}[s.cl.v];
  c.hangF = t[0]; c.fq = {hp: t[1], v: t[2], am: t[3]}; c.mass = t[4]; c.cost = {fe: 60, si: 20, ti: 10};
  c.desc = `${t[0]} истребителей: прочность ${t[1]}, скорость ${t[2]} км/с, боезапас ${t[3]}`;
};
COMP.hangar_b.opts = [O('cl', 'Класс', 's', [['l', 'лёгкие (7 шт)'], ['s', 'обычные (5 шт)'], ['h', 'тяжёлые (3 шт)']])];
COMP.hangar_b.ap = (c, s) => {
  const t = {l: [7, 3, 0.96], s: [5, 4, 0.8], h: [3, 7, 0.64]}[s.cl.v];
  c.hangB = t[0]; c.bq = {hp: t[1], v: t[2]}; c.cost = {fe: 60, si: 20, ti: 10, pt: 2};
  c.desc = `${t[0]} бомбардировщиков с торпедами: прочность ${t[1]}, скорость ${t[2]} км/с`;
};
export const crewNum = c => c.mine ? 2 : c.lab ? 1 : (c.rail || c.flak) ? 0.1 : c.hangars ? 2 : 0;
export const crewLabel = (c, n) => { const x = crewNum(c); if (!x) return 'персонал не нужен'; if (x < 1) return n ? `персонал ${Math.ceil(n * x)} чел.` : 'персонал: 1 на 10 орудий'; return `персонал ${n ? x * n + ' чел.' : x + ' чел.'}`; };
export const _cc = {};
export const baseOf = k => k.split('|')[0];
export function parseKey(k) { const [b, ...r] = k.split('|'), o = {}; for (const x of r) { const i = x.indexOf('='); o[x.slice(0, i)] = x.slice(i + 1); } return [b, o]; }
export function mkKey(b, o) { const c = COMP[b]; return c.opts ? b + '|' + c.opts.map(p => p.id + '=' + (p.range ? snapPct((o && o[p.id]) || p.def) : ((o && o[p.id]) || p.def))).join('|') : b; }
export function compOf(key) {
  if (_cc[key]) return _cc[key];
  const [b, o] = parseKey(key), base = COMP[b]; if (!base) return null;
  let c = base;
  if (base.opts) {
    c = {...base, cost: {...base.cost}}; const sel = {};
    for (const p of base.opts) sel[p.id] = p.range ? {v: String(snapPct(o[p.id] || p.def))} : (p.vals.find(v => v.v === o[p.id]) || p.vals.find(v => v.v === p.def));
    base.ap(c, sel);
  }
  c.base = b; return _cc[key] = c;
}

export const FIELDS = {phys: 'Физика', eng: 'Инженерия', bio: 'Биология'};
export const RES = {fe:'Железо', ni:'Никель', ti:'Титан', cu:'Медь', si:'Кремний', c:'Углерод', ice:'Лёд', pt:'Платиноиды', ree:'Редкоземельные', n2:'Азот', co2:'Углекислый газ', ch4:'Метан', nh3:'Аммиак', u:'Уран', spares:'Тех. изделия'};

// Точки Лагранжа Солнце–Земля. Расстояния условно увеличены, чтобы их было видно на карте.
export const BODIES = [
  {id:'sun', name:'Солнце', a:0, ang:0, kind:'sun', hot:true, sci:{phys:15}, pool:{phys:12000}},
  {id:'venus', name:'Венера', a:0.723, ang:2.2, kind:'planet', sci:{phys:10, bio:4}, pool:{phys:6000, bio:2000}},
  {id:'earth', name:'Земля', a:1, ang:0.4, kind:'hub'},
  {id:'mars', name:'Марс', a:1.524, ang:4.1, kind:'planet', sci:{bio:10, eng:4}, pool:{bio:6000, eng:2000}},
  {id:'luna', name:'Луна', parent:'earth', r:0.00257, per:27.32, ang:1.0, kind:'moon', ores:{si:30000, fe:20000, ti:8000, ree:500, ice:3000}},
  {id:'phobos', name:'Фобос', parent:'mars', r:0.0000627, per:0.319, ang:0.5, kind:'moon', ores:{c:5000, fe:1500, ice:1000}},
  {id:'deimos', name:'Деймос', parent:'mars', r:0.000157, per:1.263, ang:3.0, kind:'moon', ores:{c:3000, ice:2000}},
  {id:'l1', name:'Земля L1', kind:'lagrange', lp:{r:0.95, da:0}},
  {id:'l2', name:'Земля L2', kind:'lagrange', lp:{r:1.05, da:0}},
  {id:'l3', name:'Земля L3', kind:'lagrange', lp:{r:1.0, da:Math.PI}},
  {id:'l4', name:'Земля L4', kind:'lagrange', lp:{r:1.0, da:Math.PI / 3}},
  {id:'l5', name:'Земля L5', kind:'lagrange', lp:{r:1.0, da:-Math.PI / 3}},
  {id:'apophis', name:'Апофис', a:0.92, ang:5.0, kind:'ast', ores:{pt:800, fe:1500}},
  {id:'bennu', name:'Бенну', a:1.126, ang:1.1, kind:'ast', ores:{ice:6000, c:3000, fe:800}},
  {id:'ryugu', name:'Рюгу', a:1.19, ang:3.3, kind:'ast', ores:{ice:4000, c:4000, si:1000}},
  {id:'eros', name:'Эрос', a:1.458, ang:0.9, kind:'ast', ores:{fe:20000, si:8000, ni:3000, pt:200}},
  {id:'vesta', name:'Веста', a:2.362, ang:5.6, kind:'ast', ores:{fe:25000, ti:6000, si:12000, ree:300}},
  {id:'juno', name:'Юнона', a:2.67, ang:2.5, kind:'ast', ores:{fe:15000, si:7000, ni:3000, pt:1000, u:150}},
  {id:'ceres', name:'Церера', a:2.767, ang:3.9, kind:'ast', ores:{ice:80000, c:20000, si:6000, cu:1500}},
  {id:'pallas', name:'Паллада', a:2.772, ang:0.2, kind:'ast', ores:{fe:15000, si:12000, ti:4000, c:5000}},
  {id:'psyche', name:'Психея', a:2.92, ang:1.7, kind:'ast', ores:{fe:50000, ni:12000, pt:4000, cu:3000, ree:500, u:100}},
  {id:'hygiea', name:'Гигея', a:3.14, ang:4.7, kind:'ast', ores:{ice:30000, c:10000, cu:800}},
  {id:'itokawa', name:'Итокава', a:1.324, ang:2.0, kind:'ast', ores:{si:3000, fe:2000, ni:400}},
  {id:'icarus', name:'Икар', a:1.078, ang:5.5, kind:'ast', ores:{ti:2500, fe:3000, u:60}},
  {id:'orpheus', name:'Орфей', a:1.209, ang:3.6, kind:'ast', ores:{pt:600, ti:700, ree:80}},
  {id:'gaspra', name:'Гаспра', a:2.21, ang:4.4, kind:'ast', ores:{si:2500, fe:4000, cu:300}},
  {id:'toutatis', name:'Таутатис', a:2.51, ang:5.9, kind:'ast', ores:{ni:3000, fe:6000, ti:800}},
  {id:'eunomia', name:'Эвномия', a:2.64, ang:1.3, kind:'ast', ores:{si:10000, fe:12000, ni:2500, ti:1000}},
  {id:'mathilde', name:'Матильда', a:2.65, ang:3.1, kind:'ast', ores:{c:12000, ice:3000}},
  {id:'kleopatra', name:'Клеопатра', a:2.79, ang:0.7, kind:'ast', ores:{fe:30000, ni:9000, pt:2500, cu:1200}},
  {id:'ida', name:'Ида', a:2.86, ang:5.2, kind:'ast', ores:{fe:9000, si:5000, ti:900, ree:60}},
  {id:'interamnia', name:'Интерамния', a:3.06, ang:2.8, kind:'ast', ores:{ice:18000, c:9000, cu:600}},
  {id:'europa', name:'Европа (астероид)', a:3.09, ang:6.0, kind:'ast', ores:{ice:15000, c:8000, u:40}},
  {id:'themis', name:'Фемида', a:3.13, ang:0.4, kind:'ast', ores:{ice:40000, c:6000}},
  {id:'davida', name:'Давида', a:3.17, ang:4.0, kind:'ast', ores:{c:14000, ice:9000, si:3000}},
  {id:'sylvia', name:'Сильвия', a:3.49, ang:1.9, kind:'ast', ores:{ice:12000, c:7000, ree:200, cu:900}},
  {id:'phaethon', name:'Фаэтон', a:1.27, ang:4.9, kind:'ast', strange:true, ores:{fe:3000, ni:1000}, sci:{eng:10, phys:4}, pool:{eng:3500, phys:1000}},
  {id:'xanomaly', name:'Аномалия X', a:2.45, ang:0.1, kind:'ast', strange:true, ores:{}, sci:{phys:10, bio:6, eng:6}, pool:{phys:3000, bio:2000, eng:2000}},
  {id:'oumuamua', name:'Оумуамуа', a:3.3, ang:2.3, kind:'ast', strange:true, ores:{fe:500}, sci:{phys:10, eng:5}, pool:{phys:4000, eng:1500}},
  {id:'chiron', name:'Хирон', a:3.45, ang:3.7, kind:'ast', strange:true, ores:{ice:5000, c:2000}, sci:{bio:10, phys:3}, pool:{bio:4000, phys:800}},
];
// Газы и льды в астероидах
export const GAS_ADD = {ceres: {nh3: 6000, n2: 2500}, bennu: {co2: 1200, ch4: 400}, ryugu: {nh3: 900, ch4: 500}, hygiea: {nh3: 3000, n2: 1500}, themis: {co2: 5000, nh3: 3000},
  interamnia: {n2: 2000, co2: 3000}, chiron: {n2: 3000, ch4: 2500}, mathilde: {ch4: 1500, co2: 2000}, phobos: {co2: 600}, deimos: {nh3: 400}, europa: {n2: 1500, nh3: 1200}, sylvia: {co2: 1500, nh3: 800}};
for (const b of BODIES) if (GAS_ADD[b.id]) Object.assign(b.ores, GAS_ADD[b.id]);
// Кометы: огромные запасы льда и газов
for (let i = 0; i < 400; i++) {
  const m = 1e10 * (1 + ((i * 7919) % 100) / 20); // 1–6 млрд·10 т: ядро кометы, 10–60 млрд т
  BODIES.push({id: 'comet' + i, name: 'Комета К-' + (i + 1), a: 3.6 + ((i * 0.6180339) % 1) * 3.2, ang: (i * 2.39996) % 6.2832, kind: 'ast', comet: true,
    ores: {ice: Math.round(m * 0.40), n2: Math.round(m * 0.20), co2: Math.round(m * 0.17), ch4: Math.round(m * 0.08), nh3: Math.round(m * 0.15)}});
}
// Диаметры (км): оборудование кораблей берёт только небольшие тела
export const DIAM = {ceres: 940, vesta: 525, pallas: 512, hygiea: 430, davida: 270, interamnia: 330, europa: 315, sylvia: 270, eunomia: 255, juno: 234, psyche: 226, themis: 200, kleopatra: 135,
  mathilde: 52, ida: 31, eros: 17, gaspra: 12, toutatis: 4.5, apophis: 0.37, bennu: 0.49, ryugu: 0.9, itokawa: 0.33, icarus: 1.4, orpheus: 1, phaethon: 5.8, xanomaly: 50, oumuamua: 0.4,
  chiron: 220, phobos: 22, deimos: 12, luna: 3474};
for (const b of BODIES) if (DIAM[b.id]) b.d = DIAM[b.id];
// Недра Земли и планет: добываются шахтами при наличии населения
export const GROUND = {
  earth: {fe: 2.4e6, si: 1.5e6, cu: 6e5, c: 5e5, ni: 4e5, ti: 3e5, ice: 5e5, ree: 4e4, pt: 1.5e4, u: 8e3},
  mars: {fe: 9e8, si: 6e8, ti: 5e7, ice: 3e8, ni: 2e7, c: 1e7}, venus: {fe: 8e8, si: 7e8, cu: 4e7, ti: 3e7, ni: 3e7, u: 1e6},
};
export const POP = {earth: 1500}; // рабочие, доступные на Земле (колоний пока нет)
export const shipMineLimit = () => (state && state.tech && state.tech.rock1000) ? 1000 : (state && state.tech && state.tech.rock300) ? 300 : 100;
export const canShipMine = id => { const b = BODY[id]; return !!b && (b.d === undefined || b.d <= shipMineLimit()); };
// Тераформирование: сколько тонн чего нужно доставить на планету
export const TERRA = {mars: {name: 'Марс', unit: 1e10, need: {ice: 3e12, n2: 3e12, co2: 2e12, nh3: 1e12, ch4: 1e12}}};
export const BODY = Object.fromEntries(BODIES.map(b => [b.id, b]));
export const GROUP_COLORS = ['#6fdc8c','#e3a94f','#c58cf0','#5ec8d8','#ef7f9a','#a8d65a'];

export let state = null;
export function setState(s) { state = s; }

/* ===== УТИЛИТЫ ===== */
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const isSt = id => typeof id === 'string' && id.startsWith('st:');
export const isSh = id => typeof id === 'string' && id.startsWith('sh:');
export const myShips = () => state.ships.filter(s => !s.corp), myStations = () => state.stations.filter(s => !s.corp);
export const stById = id => state.stations.find(s => 'st:' + s.id === id);
export const shById = id => state.ships.find(s => 'sh:' + s.id === id);
export function earthAng(t) { const e = BODY.earth; return e.ang + 2 * Math.PI * t / 365.25; }
export function objPos(id, t) {
  if (isSt(id)) { const s = stById(id); if (!s) return {x: 0, y: 0}; return s.at ? objPos(s.at, t) : {x: s.x, y: s.y}; }
  if (isSh(id)) { const s = shById(id); return s ? {x: s.x, y: s.y} : {x: 0, y: 0}; }
  const b = BODY[id];
  if (b && b.parent) { const pp = objPos(b.parent, t), a = b.ang + 2 * Math.PI * t / b.per; return {x: pp.x + b.r * Math.cos(a), y: pp.y + b.r * Math.sin(a)}; }
  if (!b || (b.a === 0 && !b.lp)) return {x: 0, y: 0};
  if (b.lp) { const a = earthAng(t) + b.lp.da; return {x: b.lp.r * Math.cos(a), y: b.lp.r * Math.sin(a)}; }
  const ang = b.ang + 2 * Math.PI * t / (365.25 * Math.pow(b.a, 1.5));
  return {x: b.a * Math.cos(ang), y: b.a * Math.sin(ang)};
}
export function nameOf(id) {
  if (isSt(id)) { const s = stById(id); return s ? s.name : 'станция'; }
  if (isSh(id)) { const s = shById(id); return s ? s.name : 'корабль'; }
  return BODY[id] ? BODY[id].name : String(id);
}
export const sumVals = o => Object.values(o).reduce((a, b) => a + b, 0);
export const cargoTotal = s => sumVals(s.cargo);
export const storeTotal = st => sumVals(st.store);
export function massOf(id) {
  if (isSt(id)) { const s = stById(id); return s ? s.st.dry + s.fuel + s.spares + storeTotal(s) : 0; }
  if (isSh(id)) { const s = shById(id); return s ? shipMass(s) : 0; }
  return 0;
}
export const shipMass = s => s.st.dry + s.fuel + cargoTotal(s) + (s.towing ? massOf(s.towing) : 0);
export const shipSpeed = s => s.st.power / shipMass(s) * SPEED_K * pilSpeed(s);
export const fuelPerAU = s => shipMass(s) * FUEL_K / s.st.eff * pilFuel(s);
export const fmtN = (n, d = 0) => Math.abs(n) >= 1e12 ? fmtN0(n / 1e12, 2) + ' трлн' : Math.abs(n) >= 1e9 ? fmtN0(n / 1e9, 1) + ' млрд' : fmtN0(n, d);
export const fmtN0 = (n, d = 0) => Number(n).toLocaleString('ru-RU', {maximumFractionDigits: d, minimumFractionDigits: d});
export function fmtDate(t) { return new Date(EPOCH + t * 86400000).toISOString().replace('T', ' ').slice(0, 16); }
export function fmtDur(days) {
  if (!isFinite(days)) return '∞';
  if (days < 1) return fmtN(days * 24, 1) + ' ч';
  return fmtN(days, 1) + ' сут';
}
export function log(msg) {
  state.log.unshift({t: state.t, msg});
  if (state.log.length > 200) state.log.length = 200;
}
export const uid = () => ++state.counters.id;
// статистика: сколько ресурса добыто/произведено (in) и потрачено (out) за игровые сутки
export function rec(k, dir, v, cat) {
  if (!(v > 0) || !state) return;
  const H = state.hist = state.hist || {}, day = Math.floor(state.t);
  if (state.histDay !== day) { state.histDay = day; for (const d of Object.keys(H)) if (+d < day - 400) delete H[d]; }
  const e = H[day] || (H[day] = {});
  let a = e[k]; if (!a || Array.isArray(a)) a = e[k] = a ? {'i:old': a[0], 'o:old': a[1]} : {};
  const key = (dir === 'in' ? 'i:' : 'o:') + (cat || 'old'); a[key] = (a[key] || 0) + v;
}
export const STAT_IN = {ship: 'Добыча кораблями', mine: 'Добыча шахтами', plant: 'Заводы (выпуск)', loot: 'Трофеи', corp: 'Покупка у корпораций', old: 'Прочее'};
export const STAT_OUT = {build: 'Строительство', yard: 'Судостроение', plant: 'Заводы (сырьё)', fuel: 'Заправка кораблей', spares: 'Тех. изделия кораблям', raid: 'Потери от налётов', pop: 'Продажа сырья заводам Земли', old: 'Прочее'};

/* ===== ПРОЕКТЫ ===== */
// flags: {station, tanker}
export function designStats(parts, flags) {
  flags = flags || {};
  const r = {dry:0, power:0, eff:1, fuelCap:0, cargoCap:0, mine:0, crewCap:0, lifeCap:0, lasers:0, tow:0, xfer:0, repair:0, spareCap:0, labs:{phys:0, eng:0, bio:0}, labsTotal:0, railList:[], flakList:[], defl:0, fqS:{hp:0,v:0,am:0}, bqS:{hp:0,v:0},
    cost:{}, errors:[], warns:[], station: false, tanker: false, armor:0, rail:0, flak:0, hangF:0, hangB:0, hangars:0, engines:0};
  let effSum = 0;
  for (const [k, n] of Object.entries(parts)) {
    const c = compOf(k); if (!c || !n) continue;
    r.dry += c.mass * n;
    r.power += (c.power || 0) * n;
    effSum += (c.power || 0) * (c.eff || 0) * n;
    r.fuelCap += (c.fuel || 0) * n;
    r.cargoCap += (c.cargo || 0) * n;
    r.mine += (c.mine || 0) * n;
    r.lasers += c.mine ? n : 0;
    r.crewCap += (c.crew || 0) * n;
    r.lifeCap += (c.life || 0) * n;
    r.tow += (c.tow || 0) * n;
    if (c.lab) { r.labs[c.lab] += n * (c.labw || 1); r.labsTotal += n; }
    if (c.rcfg) for (let i = 0; i < n; i++) r.railList.push(c.rcfg);
    if (c.fcfg) for (let i = 0; i < n; i++) r.flakList.push(c.fcfg);
    if (c.defl) r.defl += c.defl * c.armor * n;
    if (c.fq) { r.fqS.hp += c.fq.hp * c.hangF * n; r.fqS.v += c.fq.v * c.hangF * n; r.fqS.am += c.fq.am * c.hangF * n; }
    if (c.bq) { r.bqS.hp += c.bq.hp * c.hangB * n; r.bqS.v += c.bq.v * c.hangB * n; }
    r.xfer += (c.xfer || 0) * n;
    r.armor += (c.armor || 0) * n; r.rail += (c.rail || 0) * n; r.flak += (c.flak || 0) * n;
    r.hangF += (c.hangF || 0) * n; r.hangB += (c.hangB || 0) * n; r.hangars += (c.hangars || 0) * n; if (c.power) r.engines += n;
    r.repair += (c.repair || 0) * n;
    r.spareCap += (c.spares || 0) * n;
    for (const [rk, rv] of Object.entries(c.cost)) r.cost[rk] = (r.cost[rk] || 0) + rv * n;
  }
  r.eff = r.power ? effSum / r.power : 1;
  r.defl = r.armor ? r.defl / r.armor : 0;
  if (r.hangF) { r.fq = {hp: r.fqS.hp / r.hangF, vmax: r.fqS.v / r.hangF, ammo: r.fqS.am / r.hangF}; }
  if (r.hangB) { r.bq = {hp: r.bqS.hp / r.hangB, vmax: r.bqS.v / r.hangB}; }
  r.fire = r.railList.reduce((a, q) => a + q.dmg * q.shells * 60 / (60 * q.rel), 0);
  r.jam = r.railList.length ? r.railList.reduce((a, q) => a + q.fail, 0) / r.railList.length : 0;
  r.bspd = r.power ? Math.max(0.5, Math.min(1.5, (r.power / Math.max(1, r.dry)) / 0.35)) : 1;
  r.station = !r.power; r.tanker = r.xfer > 0 && r.fuelCap > 0 && r.power > 0;
  r.crewNeed = 2 + 2 * r.lasers + r.labsTotal + Math.ceil((r.rail + r.flak) / 10) + 2 * r.hangars;
  r.warship = r.rail + r.flak + r.hangF + r.hangB > 0;
  r.L = Math.max(0.3, Math.min(3, 0.25 * Math.cbrt(r.dry)));
  r.buildDays = Math.max(1, Math.round(r.dry * 0.4));
  const massFull = r.dry + r.fuelCap;
  r.speedFull = r.power ? r.power / massFull * SPEED_K : 0;
  r.range = r.power && r.fuelCap ? r.fuelCap / (massFull * FUEL_K / r.eff) : 0;
  if (r.dry === 0) r.errors.push('Проект пуст.');
  if (!r.station) {
    if (!r.power) r.errors.push('Нужен хотя бы один двигатель.');
    if (!r.fuelCap) r.errors.push('Нужен топливный бак.');
  }
  if (r.warship && !r.armor) r.warns.push('Без брони корабль беззащитен: каждый удар сразу бьёт по модулям.');
  if (r.station && r.dry) r.warns.push('Без двигателей это станция: её перевозит тягач.');
  if (r.crewCap < r.crewNeed) r.errors.push(`Мало кают: нужно ${r.crewNeed} мест, есть ${r.crewCap}.`);
  if (r.lifeCap < r.crewNeed) r.errors.push(`Жизнеобеспечение рассчитано на ${r.lifeCap}, экипажу нужно ${r.crewNeed}.`);
  if (r.station) {
    if (!r.cargoCap && !r.fuelCap && !r.spareCap) r.warns.push('У станции нет складов: принимать ей нечего.');
    if (r.repair && !r.spareCap) r.warns.push('Ремонтному доку нужен склад тех. изделий.');
    if (!r.xfer) r.warns.push('Без системы передачи топлива станция не заправляет корабли.');
  } else {
    if (!r.cargoCap && !r.tanker && !r.warship) r.warns.push('Нет грузового отсека: добытое некуда класть.');
    if (!r.lasers && !r.tow && !r.tanker && r.cargoCap === 0 && !r.warship) r.warns.push('У корабля нет назначения: ни лазеров, ни сцепки, ни груза.');
  }
  return r;
}
export const stockOK = cost => Object.entries(cost).every(([k, v]) => (state.stock[k] || 0) >= v);

/* ===== НАЧАЛО ИГРЫ ===== */
export function newGame() {
  state = {
    t: 0, speedIdx: 1, paused: true,
    counters: {id: 0, ship: {}, station: {}},
    stock: {fe: 3000, ni: 800, ti: 600, cu: 600, si: 600, c: 500, ice: 0, pt: 60, ree: 80, u: 0, fuel: 2000, spares: 100},
    bld: {mine: 0, fuelplant: 1, sparesplant: 1, shipyard: 1, academy: 0, scicenter: 1}, build: [], sci: {phys: 0, eng: 0, bio: 0}, tech: {}, sites: {}, marks: {},
    designs: [], groups: [], ships: [], stations: [], yard: [], log: [], ast: {}, officers: [], nextOfficer: 30,
    raid: {eta: 150, k: 0, warned: false}, inBattle: false, terra: {}, ground: JSON.parse(JSON.stringify(GROUND)),
  };
  for (const b of BODIES) { if (b.ores) state.ast[b.id] = {...b.ores}; if (b.pool) state.sites[b.id] = {...b.pool}; }
  const miner = {ion: 2, tank: 2, cargo: 1, laser: 2, cabin: 2, life: 1};
  const D = (name, parts) => state.designs.push({id: uid(), name, parts, prio: {cmd: 0, eng: 0, pil: 0, min: 0}});
  D('Шахтёр М1', miner);
  D('Грузовик Г1', {ion: 2, tank: 2, cargo: 3, cabin: 1, life: 1});
  D('Тягач Т1', {ion: 3, tank: 3, hook: 1, cabin: 1, life: 1});
  D('Снабженец-танкер С1', {ion: 2, tank: 5, cargo: 2, xfer: 1, cabin: 1, life: 1});
  D('Исследователь Н1', {ion: 3, tank: 3, cabin: 2, life: 1, lab_phys: 1, lab_eng: 1, lab_bio: 1});
  D('Эсминец Э1', {ion: 3, tank: 2, rail: 8, armor: 3, cabin: 1, life: 1});
  D('Фрегат ПВО Ф1', {ion: 3, tank: 2, flak: 8, armor: 2, cabin: 1, life: 1});
  D('Крейсер К1', {ion: 5, tank: 3, rail: 30, armor: 4, cabin: 3, life: 2});
  D('Авианосец А1', {ion: 5, tank: 3, hangar_f: 3, hangar_b: 1, rail: 4, armor: 3, cabin: 3, life: 2});
  D('Станция «Опора»', {cargo: 3, tank: 4, spares: 2, xfer: 1, repair: 1, cabin: 1, life: 1});
  for (let i = 0; i < 12; i++) genOfficer();
  const g = newGroup('Добытчики');
  g.orders = [{type: 'mine', target: 'eros', res: 'all', pct: 100}, {type: 'home', base: 'nearest'}];
  g.loop = true;
  g.rules = [{cond: 'fuelhome', val: 130, base: 'nearest'}, {cond: 'cond', val: 25, base: 'nearest'}];
  createShip({name: 'Шахтёр М1', parts: miner}, g.id, staffFor(designStats(miner)).crew);
  log('Игра началась. «Добытчики» выполняют автодобычу на Эросе. Пока станций нет, они возвращаются на Землю. Нажмите ▶ или пробел. Примерно через 150 суток придёт флот налётчиков: стройте боевые корабли в конструкторе (броня, рельсотроны, зенитки, ангары) и держите их на Земле.');
  initCorps(); initPop();
}
export function newGroup(name) {
  const g = {id: uid(), name: name || 'Группа ' + (state.groups.length + 1), orders: [], rules: [], loop: true,
    color: GROUP_COLORS[state.groups.length % GROUP_COLORS.length]};
  state.groups.push(g);
  return g;
}
export function createShip(job, groupId, crew) {
  const st = designStats(job.parts);
  const n = state.counters.ship[job.name] = (state.counters.ship[job.name] || 0) + 1;
  const p = objPos('earth', state.t);
  const s = {id: uid(), name: `${job.name} №${n}`, st, x: p.x, y: p.y, at: 'earth', fuel: 0,
    cargo: {}, groupId: groupId || null, own: {orders: [], rules: [], loop: false}, pc: 0, wait: null, tmp: null,
    interrupt: null, eq: eqFor(job.parts), crew: crew || {}, broken: false, towing: null, towedBy: null, status: 'На Земле',
    air: {F: st.hangF, B: st.hangB}, hullDmg: 0, airAcc: 0};
  const take = Math.min(st.fuelCap, state.stock.fuel);
  s.fuel = take; state.stock.fuel -= take; rec('fuel', 'out', take, 'fuel');
  state.ships.push(s); bindCrew('ship', s);
  return s;
}
export function createStation(job, crew) {
  const st = designStats(job.parts);
  const n = state.counters.station[job.name] = (state.counters.station[job.name] || 0) + 1;
  const p = objPos('earth', state.t);
  const s = {id: uid(), name: `${job.name} ${n}`, st, x: p.x, y: p.y, at: 'earth', fuel: 0, spares: 0,
    store: {}, towedBy: null, crew: crew || {}};
  state.stations.push(s); bindCrew('station', s);
  return s;
}
export const groupOf = s => state.groups.find(g => g.id === s.groupId) || null;
export const programOf = s => groupOf(s) || s.own;
