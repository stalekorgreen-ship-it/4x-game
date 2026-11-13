// @ts-nocheck
import { gd } from './00-gd.ts';
import { addModuleTechs } from './15-techs.ts';
import { hooks } from './00-hooks.ts';
import { tm } from './15-techs.ts';
import { bindCrew, eqFor, genOfficer, pilFuel, pilSpeed, staffFor } from './02-crew.ts';
import { initCorps } from './06-corps.ts';
import { initPop } from './07-population.ts';
import { H, bar } from './08-map-ui.ts';
'use strict';
/* ===== ДАННЫЕ ===== */
export const SAVE_KEY = 'poyas4x-save-v8';
export const AU_M = 1.496e11;      // метров в а.е.
export const TRAVEL_WARP = 1;      // перелёты честные: скорость по формуле двигателей, без ускорения
export const FUEL_S = 1.8e-10;      // масштаб расхода: т/с на (мощность двигателя)² при КПД 1
export const BAT_FUEL_T = 20000;   // 1 секунда боя = столько секунд работы двигателей (для расхода топлива в бою)
export const SPEED_K = 0.25;   // а.е./сутки на (мощность/масса)
export const FUEL_K = 0.5;       // т топлива на а.е. на тонну массы / КПД
export const WEAR_AU = 1.0;    // % износа на а.е. пути
export const WEAR_MINE = 0.1;  // % износа в сутки добычи
export const REPAIR_RATE = 8;  // % ремонта в сутки
export const ORE_PER_SPARE = 4;
export const EPOCH = Date.UTC(2030, 0, 1);
export const SPEEDS = [{m:1/60,l:'1 сек'},{m:2/60,l:'2 сек'},{m:5/60,l:'5 сек'},{m:.5,l:'30 сек'},{m:1,l:'1 мин'},{m:20,l:'20 мин'},{m:60,l:'1 час'},{m:180,l:'3 часа'},{m:480,l:'8 часов'},{m:1440,l:'1 день'},{m:7200,l:'5 дней'}];

export const COMP = gd('modules', 'modules', {
  ion:   {name:'Ионный двигатель', desc:'Мощность 20, экономичный', power:20, mass:5, eff:1, cost:{ti:15, ree:4, fe: 10, co: 3}},
  chem:  {name:'Химический двигатель', desc:'Мощность 50, жрёт топливо (КПД 0.35)', power:50, mass:6, eff:0.35, cost:{fe:15, co: 5}},
  tank:  {name:'Топливный бак', desc:'50 т топлива', fuel:50, mass:4, cost:{fe:6, ti:4}},
  cargo: {name:'Грузовой отсек / склад', desc:'200 т груза (руда, лёд, платина)', cargo:200, mass:8, cost:{fe:12}},
  laser: {name:'Шахтёрский лазер', desc:'Копает 1 000 т породы в сутки; руда — по содержанию тела (железо до 85%, платина 5–50 г/т) × эффективность жилы; нужно 2 человека экипажа', mine:1, mass:6, cost:{pt:3, ree:3, si:8}},
  cabin: {name:'Каюты экипажа', desc:'5 мест', crew:5, mass:4, cost:{fe:6, c:6}},
  life:  {name:'Система жизнеобеспечения', desc:'Рассчитана на 10 человек', life:10, mass:4, cost:{c:8, si:4, fe: 6}},
  xfer:  {name:'Система передачи топлива', desc:'Перекачка топлива другим кораблям и станциям (нужна технология)', xfer:1, mass:5, cost:{si:6, ti:4, fe: 8}, tech:'xfer'},
  probe: {name:'Штанга дозаправки', desc:'Приёмник топлива: в бою корабль сам подлетает к танкеру (корабль с системой передачи топлива) и заправляется', probe:1, mass:1, cost:{fe:2, ti:1}},
  repair:{name:'Ремонтный док', desc:'Чинит корабли у станции, тратит тех. изделия', repair:1, mass:15, cost:{fe:45, si:10, pt:1}},
  spares:{name:'Склад тех. изделий', desc:'Хранит 100 тех. изделий', spares:100, mass:6, cost:{fe:10, ti:4}},
  lab_phys:{name:'Физическая лаборатория', desc:'Изучает физику у аномальных объектов', lab:'phys', mass:8, cost:{si:10, ree:2, fe: 8}},
  lab_eng: {name:'Инженерная лаборатория', desc:'Изучает инженерные аномалии', lab:'eng', mass:8, cost:{fe:16, ti:5}},
  lab_bio: {name:'Биолаборатория', desc:'Изучает биологические аномалии', lab:'bio', mass:8, cost:{c:10, si:6, fe: 4}},
  fusion:{name:'Термоядерный двигатель', desc:'Мощность 120, КПД 1.6 (нужна технология)', power:120, mass:10, eff:1.6, cost:{u:5, ti:20, ree:6, fe: 15, co: 8}, tech:'fusion'},
  laser2:{name:'Тяжёлый лазер', desc:'2 т/сутки на каждую жилу (нужна технология)', mine:2, mass:9, cost:{pt:5, ree:5, si:12}, tech:'laser2'},
  armor: {name:'Броневая плита', desc:'+1 слой брони на каждом секторе корабля', armor:1, mass:20, cost:{fe:40, ti:10}},
  rail:  {name:'Рельсотрон (турель)', desc:'Бьёт по кораблям на 60 км, перезарядка 60 с', rail:1, mass:6, cost:{fe:18, ti:4}},
  ammo:  {name:'Погреб боеприпасов', desc:'Хранит боеприпасы для рельсотронов и пулемётов; без него орудия молчат', ammoCap:100, mass:110, cost:{fe:80, ti:10}},
  reactor:{name:'Боевой реактор', desc:'Вырабатывает энергию для конденсаторов рельсотронов и лазера', reactor:1, en:100, mass:60, cost:{fe:90, u:2, ti:10}},
  gat:   {name:'Пулемёт Гатлинга', desc:'ПВО и оружие против истребителей: 6000 выстр/мин, дальность 15 км, перегрев 40%/мин, остывание 20%/мин, бронепробитие 2%, 5 т боеприпасов в час', gat:1, mass:25, cost:{fe:34, si:8}},
  flak:  {name:'Зенитная турель', desc:'Сбивает истребители, бомбардировщики и торпеды', flak:1, mass:5, cost:{fe:16, si:6}},
  lgun:  {name:'Боевой лазер', desc:'Гигантская установка: бьёт мгновенно на огромное расстояние, но жрёт энергию и заряжается минутами', lgun:1, mass:450, cost:{fe:530, si:190, ree:48}},
  missile:{name:'Ракетная установка', desc:'Самонаводящиеся ракеты, боезапас ограничен', msl:1, mass:10, cost:{fe:24, ti:6, si:6}},
  irs:{name:'Тепловой сканер (пассивный)', desc:'Ловит тепло чужих кораблей, сам не излучает. Выдаёт контакт, но не наводку', sc:'ir', mass:5, crewN:1, cost:{fe:14, si:10}},
  ems:{name:'ЭМ-сканер (пассивный)', desc:'Ловит радиоизлучение чужих кораблей, сам не излучает. Выдаёт контакт, но не наводку', sc:'em', mass:6, crewN:1, cost:{fe:16, si:12}},
  radar:{name:'Активный радар', desc:'Точные координаты цели для наведения, но выдаёт ваш корабль', sc:'rad', mass:12, crewN:3, cost:{fe:30, si:14}},
  fcs:{name:'Система управления огнём', desc:'Ведёт цели на прицел: по одной цели на канал', fcs:1, mass:4, crewN:2, cost:{fe:18, si:8, ti:2}},
  ew:{name:'Станция РЭБ', desc:'Помехи: сбивает вражескую наводку рядом с кораблём. Нужны 3 человека', ew:1, mass:12, cost:{fe:34, si:16, ti:4}},
  marines:{name:'Десантный отсек', desc:'10 морпехов для абордажа сдавшихся и обездвиженных кораблей. Морпехи занимают койки', mar:10, mass:14, cost:{fe:20, ti:6, si:4}},
  dcon:{name:'Пост аварийной команды', desc:'Быстрее тушит пожары и чинит модули в бою. Нужны 3 человека', dcon:1, mass:6, cost:{fe:8, ti:6}},
  sink:{name:'Радиатор', desc:'Панели по 10 м² (100 кг): 64 кВт каждая при 500 K', sink:1, mass:10, cost:{fe:20}},
  hangar_f:{name:'Ангар истребителей', desc:'10 истребителей (пополняются техизделиями)', hangF:10, hangars:1, mass:30, cost:{fe:60, si:20, ti:10}},
  hangar_b:{name:'Ангар бомбардировщиков', desc:'5 бомбардировщиков с торпедами', hangB:5, hangars:1, mass:30, cost:{fe:60, si:20, ti:10, pt:2}},
  benefm:{name:'Обогатитель', desc:'Порода → концентрат прямо на корабле или станции (вместе с «Плавильней»). Нужно 5 000 человек', mass:2500, crewN:5000, cost:{fe:150000, ti:500}},
  smeltm:{name:'Плавильня', desc:'Концентрат → металл на борту: до 150 000 т в год (с «Обогатителем»). Стоимость ×10 земной, 5 000 человек. Металл везут без плавки на Земле', smeltY:150000, mass:3000, crewN:5000, cost:{fe:600000, ti:2000, w:500}},
  acat:  {name:'Катапульта для контейнеров', desc:'Для станции у астероида: запускает склад станции к Земле контейнерами по медленным траекториям, без кораблей — до 50 000 т в год, ~2 км/с (нужна технология)', acat:50000, mass:800, crewN:20, cost:{fe:20000, ti:500, co:100}, tech:'acat'},
  hook:  {name:'Буксирная сцепка', desc:'Тянет до 2000 т (корабль или станцию)', tow:2000, mass:8, cost:{ti:15, fe:15, co: 2}},
}); // данные модулей можно править в data/modules.json
/* ===== НАСТРАИВАЕМЫЕ МОДУЛИ ===== */
// Ключ варианта: «база|опция=знач|опция=знач». Голый ключ = значения по умолчанию.
export const O = (id, name, def, vals) => ({id, name, def, vals: vals.map(([v, l]) => ({v, l}))});
export const SZ = O('sz', 'Размер', 'm', [['s', 'малый ×½'], ['m', 'средний ×1'], ['l', 'большой ×2'], ['x', 'корабельный ×20']]);
export const SZK = {s: 0.5, m: 1, l: 2, x: 20};
export const scl = (c, k) => {
  for (const f of ['power', 'fuel', 'cargo', 'mine', 'spares', 'tow']) if (c[f]) c[f] = Math.round(c[f] * k * 100) / 100;
  if (c.crew) c.crew = Math.max(1, Math.round(c.crew * k));
  if (c.life) c.life = Math.max(1, Math.round(c.life * k));
  c.mass = Math.round(c.mass * Math.pow(k, 0.9) * 10) / 10;
  const kc = k > 2 ? Math.pow(k, .55) : k;
  for (const r in c.cost) c.cost[r] = Math.max(1, Math.round(c.cost[r] * kc));
};
export const mulCost = (c, m) => { for (const r in c.cost) c.cost[r] = Math.max(1, Math.round(c.cost[r] * m)); };
export const addCost = (c, r, v) => { c.cost[r] = (c.cost[r] || 0) + v; };
export const snapNum = (v, min, max, def) => { let n = +v; if (!(n > 0)) n = def; n = Math.min(max, Math.max(min, n)); return +n.toPrecision(3); };
export const ZS = def => ({id: 'zs', name: 'Размер (0.01–50)', def: String(def || 1), num: {min: 0.01, max: 50}});
export const snapPct = v => { let n = +v; if (!(n > 0)) n = 100; n = Math.min(500, n); return n < 5 ? 1 : Math.round(n / 5) * 5; };
export const engOpts = def => [{id: 'pw', name: 'Мощность, %', def: '100', range: true}, ZS(1), O('tune', 'Настройка', 'n', [['e', 'эконом'], ['n', 'стандарт'], ['b', 'форсаж']])];
// чем больше двигатель, тем выше КПД и легче каждая единица мощности
export const engAp = (c, s) => {
  const k = +s.pw.v / 100, z = +s.zs.v; // размер: чем крупнее корпус, тем больше тяга и выше КПД, но тяжелее
  c.mass = c.mass * Math.pow(z, 0.8); c.power = c.power * Math.pow(z, 0.9); c.eff = c.eff * Math.min(2.5, Math.max(0.5, 1 + 0.1 * Math.log2(z)));
  for (const r in c.cost) c.cost[r] = Math.max(1, Math.round(c.cost[r] * Math.pow(z, 0.8)));
  const e0 = c.eff;
  c.power = c.power * k; c.mass = Math.max(0.1, Math.round(c.mass * Math.pow(k, 0.85) * 10) / 10);
  c.eff = e0 * Math.max(0.3, 1 + 0.18 * Math.log2(k));
  for (const r in c.cost) c.cost[r] = Math.max(1, Math.round(c.cost[r] * Math.pow(k, 0.9)));
  if (s.tune.v === 'e') { c.power *= 0.8; c.eff *= 1.2; } else if (s.tune.v === 'b') { c.power *= 1.3; c.eff *= 0.8; c.mass = Math.round(c.mass * 11) / 10; }
  c.power = Math.round(c.power * 10) / 10; c.eff = Math.round(c.eff * 100) / 100;
  c.size = Math.round(2 * Math.cbrt(c.mass) * 10) / 10;
  c.desc = `${s.pw.v}% · размер ×${s.zs.v} · мощность ${c.power}, КПД ${c.eff}, габарит ~${c.size} м`;
};
export const sizeAp = (txt) => (c, s) => { scl(c, SZK[s.sz.v]); c.desc = txt(c); };
COMP.ion.opts = engOpts(20); COMP.ion.ap = engAp; COMP.ion.elec = 1; // ионному нужно электричество реактора
// Химический двигатель (таблицы «модули кораблей» и «Корабли (система)»): размер 1–1000 т кобальта (без технологий до 100);
// скоростной — 1 МН на тонну, удельный импульс 350 с + 1 за каждую тонну сверх первой; маршевый — тяга ×⅓, импульс ×3. Каждые 10 т — +1 человек.
// Мощность для игры = тяга / 120 000 (ускорение в бою = тяга / масса, не больше 40 м/с²), КПД = импульс / 1000.
export const ENG = gd('modules', 'engine', {thrustT: 1e6, isp: 350, ispT: 1, max0: 100, techK: [2, 1.5], crewPer: 10});
export const engMax = () => { const n = ['eng1', 'eng2', 'eng3', 'eng4', 'eng5'].filter(t => state && state.tech && state.tech[t]).length; let m = ENG.max0; for (let i = 0; i < n; i++) m *= i === 0 ? ENG.techK[0] : ENG.techK[1]; return Math.min(1000, Math.round(m)); };
const engChem = rcs => (c, s) => { const z = Math.max(1, Math.min(1000, +s.zs.v || 1)), sp = s.md.v === 's', al = s.al.v, k = rcs ? 3 : 1;
  const thrust = z * ENG.thrustT * (sp ? 1 : 1 / 3), isp = (ENG.isp + ENG.ispT * (z - 1)) * (sp ? 1 : 3);
  c.mass = z; c.zs = z; c.thrust = thrust; c.isp = isp; c.crewN = Math.ceil(z / ENG.crewPer) * k; c.cost = {co: Math.round(z * k)}; c.cost[al === 'w' ? 'w' : 'ti'] = Math.round(2 * z * k);
  if (rcs) { c.rcsT = thrust; c.power = 0; c.desc = `маневровый ${z} т: ${fmtN(thrust / 1e6, 2)} МН во все стороны и на повороты, ${c.crewN} чел.`; return; }
  c.power = Math.round(thrust / 120000 * 10) / 10; c.eff = Math.round(isp / 1000 * 100) / 100; c.size = Math.round(2 * Math.cbrt(z) * 10) / 10;
  c.desc = `${sp ? 'скоростной' : 'маршевый'} ${z} т: тяга ${fmtN(thrust / 1e6, 2)} МН, импульс ${Math.round(isp)} с, ${c.crewN} чел., ${al === 'w' ? 'вольфрам' : 'титан'}`; };
const ENG_OPTS = [{id: 'zs', name: 'Размер, т (1–1000; без технологий до 100)', def: '5', num: {min: 1, max: 1000}}, O('md', 'Режим', 's', [['s', 'скоростной (тяга ×3)'], ['m', 'маршевый (импульс ×3)']]), O('al', 'Сопло', 't', [['t', 'титан (×2 размера)'], ['w', 'вольфрам (×2 размера)']])];
COMP.chem.opts = ENG_OPTS; COMP.chem.ap = engChem(false);
COMP.rcs = {name: 'Маневровый двигатель', desc: 'Движение во все стороны и повороты; всё втрое дороже и людей втрое больше', mass: 2, cost: {co: 6}};
COMP.rcs.opts = ENG_OPTS.map(o => o.id === 'zs' ? {...o, def: '2'} : o); COMP.rcs.ap = engChem(true);
COMP.fusion.opts = engOpts(120); COMP.fusion.ap = engAp;
// баки по таблице: [топливо, масса бака, железо, вольфрам на слой брони, титан за сброс]
export const TANKS = gd('modules', 'tanks', {5: [5, 1, 2, 1, 1], 25: [25, 3, 10, 2, 2], 100: [100, 10, 20, 4, 3], 500: [500, 25, 40, 10, 4], 2000: [2000, 50, 100, 20, 5]});
COMP.tank.opts = [O('tv', 'Объём, т', '25', Object.keys(TANKS).map(k => [k, k + ' т'])), O('ta', 'Слоёв брони', '0', [['0', 'нет'], ['1', '1'], ['2', '2'], ['3', '3']]), O('td', 'Внешний сбрасываемый', '0', [['0', 'нет'], ['1', 'да']])];
COMP.tank.ap = (c, s) => { const T = TANKS[s.tv.v] || TANKS[25], a = +s.ta.v; c.fuel = T[0]; c.mass = T[1] + a * T[3]; c.cost = {fe: T[2]}; if (a) c.cost.w = a * T[3]; c.tankArm = a; if (+s.td.v) { c.drop = 1; c.cost.ti = T[4]; }
  c.desc = `${T[0]} т топлива, бак ${T[1]} т${a ? `, ${a} сл. брони (${a * T[3]} т вольфрама)` : ''}${c.drop ? ', сбрасывается пустым' : ''}`; };
const _tankOld = (c, s) => { if (s.dn.v === 'c') { c.fuel *= 1.3; c.mass = Math.round(c.mass * 1.15 * 10) / 10; addCost(c, 'ti', 3); } scl(c, SZK[s.sz.v]); c.desc = `${c.fuel} т топлива`; };
COMP.cargo.opts = [SZ, O('cn', 'Конструкция', 'n', [['l', 'лёгкая'], ['n', 'стандартная'], ['h', 'усиленная']])];
COMP.cargo.ap = (c, s) => { if (s.cn.v === 'l') { c.cargo = 160; c.mass *= 0.6; } else if (s.cn.v === 'h') { c.cargo = 260; c.mass *= 1.4; addCost(c, 'ti', 6); } scl(c, SZK[s.sz.v]); c.desc = `${c.cargo} т груза`; };
for (const k of ['lgun', 'hangar_f', 'hangar_b', 'missile', 'radar']) if (COMP[k]) COMP[k].off = true; // временно отключены
// каждый модуль открывается своей технологией (решено с владельцем): на старте ни одной нет
for (const k in COMP) if (!COMP[k].tech) COMP[k].tech = 'm_' + k;
addModuleTechs(COMP);
COMP.laser.opts = [SZ, O('cool', 'Охлаждение', 'n', [['n', 'пассивное'], ['a', 'активное +30%']])];
COMP.laser.ap = (c, s) => { if (s.cool.v === 'a') { c.mine *= 1.3; c.mass = Math.round(c.mass * 1.25 * 10) / 10; addCost(c, 'fe', 4); addCost(c, 'si', 4); } scl(c, SZK[s.sz.v]); c.desc = `${fmtN(c.mine * SHIP_ROCK)} т породы в сутки, 2 человека экипажа на лазер`; };
COMP.laser2.opts = COMP.laser.opts; COMP.laser2.ap = (c, s) => { COMP.laser.ap(c, s); c.desc = `${fmtN(c.mine * SHIP_ROCK)} т породы в сутки (нужна технология)`; };
const SCW = {w: {k: 1.5, r: .5, m: 1, n: 'широкий (дальше, грубо)'}, n: {k: .8, r: 1, m: 1.3, n: 'узкий (ближе, точно)'}};
for (const k of ['irs', 'ems']) {
  COMP[k].opts = [O('res', 'Разрешение', 'w', [['w', 'широкое: дальше, грубо'], ['n', 'узкое: ближе, видит мелочь']])];
  COMP[k].ap = (c, s) => { const q = SCW[s.res.v]; c.scRng = Math.round((k === 'irs' ? 150 : 180) * q.k); c.scRes = q.r; c.mass = Math.round(c.mass * q.m * 10) / 10; c.desc += ` · дальность ~${c.scRng} км`; };
}
COMP.radar.opts = [O('pw', 'Мощность', 'm', [['s', 'малая'], ['m', 'средняя'], ['l', 'большая']]), O('res', 'Разрешение', 'c', [['c', 'крупное: далеко, не видит мелочь и ракеты'], ['f', 'мелкое: ближе, ловит ракеты и истребителей']])];
COMP.radar.ap = (c, s) => { const P = {s: [180, .6, 2], m: [330, 1.5, 3], l: [600, 3.4, 5]}[s.pw.v], f = s.res.v === 'f'; c.scRng = Math.round(P[0] * (f ? .4 : 1)); c.scRes = f ? 1 : .4; c.scFine = f ? 1 : 0; c.mass = Math.round(c.mass * P[1] * 10) / 10; c.crewN = P[2]; mulCost(c, P[1]); c.desc += ` · дальность ~${c.scRng} км, экипаж ${P[2]}`; };
COMP.fcs.opts = [O('ch', 'Каналов', '2', [['1', '1'], ['2', '2'], ['4', '4'], ['8', '8']])];
COMP.fcs.ap = (c, s) => { const n = +s.ch.v; c.fcs = n; c.mass = Math.round(c.mass * Math.pow(n, .8) * 10) / 10; c.crewN = 2 * n; mulCost(c, Math.pow(n, .8)); c.desc = `${n} целей одновременно, экипаж ${2 * n}`; };
export const CABINS = gd('modules', 'cabins', {1: [1, 1], 5: [3, 3], 25: [12, 10], 100: [45, 25], 500: [200, 70]}); // мест: [масса т, железо]
COMP.cabin.opts = [O('cv', 'Мест', '5', Object.keys(CABINS).map(k => [k, k]))]; COMP.cabin.ap = (c, s) => { const n = +s.cv.v, C = CABINS[n] || CABINS[5]; c.crew = n; c.mass = C[0]; c.cost = {fe: C[1]}; c.desc = `${n} мест, ${C[0]} т`; };
COMP.life.opts = [SZ]; COMP.life.ap = sizeAp(c => `Рассчитана на ${c.life} человек`);
COMP.spares.opts = [SZ]; COMP.spares.ap = sizeAp(c => `Хранит ${c.spares} тех. изделий`);
COMP.hook.opts = [O('sz', 'Мощность', 'm', [['s', '1000 т'], ['m', '2000 т'], ['l', '4000 т']])]; COMP.hook.ap = sizeAp(c => `Тянет до ${c.tow} т`);
for (const k of ['lab_phys', 'lab_eng', 'lab_bio']) {
  COMP[k].opts = [O('eq', 'Оборудование', 's', [['s', 'базовое'], ['a', 'продвинутое ×2']])];
  COMP[k].ap = (c, s) => { if (s.eq.v === 'a') { c.labw = 2; c.mass = Math.round(c.mass * 1.8); mulCost(c, 2); c.desc += ' (×2)'; } };
}
// --- рельсотрон ---
// калибр в см: пробитие 30→80%, дальность 40→200 км, скорость снаряда 2→10 км/с
export const RAIL_CAL = {5: {dmg: 0.5, vp: 2, m: 45, ap: 0.3, rng: 40}, 10: {dmg: 1, vp: 3.6, m: 110, ap: 0.4, rng: 72}, 15: {dmg: 2, vp: 5.2, m: 230, ap: 0.5, rng: 104},
  20: {dmg: 3.5, vp: 6.8, m: 400, ap: 0.6, rng: 136}, 25: {dmg: 5.5, vp: 8.4, m: 650, ap: 0.7, rng: 168}, 30: {dmg: 8, vp: 10, m: 950, ap: 0.8, rng: 200}};
// конденсаторы: меньше батарея — легче ствол, но дольше перезарядка
export const RAIL_CAP = {f: {m: 1, rel: 1, n: 'полная батарея'}, m: {m: .85, rel: 1.3, n: 'урезанная батарея'}, l: {m: .73, rel: 1.7, n: 'минимум конденсаторов'}};
export const RAIL_E = gd('modules', 'railE', {5: .012, 10: .31, 15: 2.2, 20: 8.9, 25: 26.5, 30: 64.8}), RAIL_CREW = {5: 2, 10: 2, 15: 3, 20: 4, 25: 5, 30: 6}; // ГДж на выстрел, экипаж на ствол
export const RAIL_LD = {m: {rel: 1, mass: 1, fail: 1, n: 'ручное'}, a: {rel: 0.8, mass: 1.25, fail: 1.3, n: 'автоматическое'}, f: {rel: 0.6, mass: 1.6, fail: 2.2, n: 'скоростное'}};
COMP.rail.opts = [O('cal', 'Калибр', '10', [['5', '5 см'], ['10', '10 см'], ['15', '15 см'], ['20', '20 см'], ['25', '25 см'], ['30', '30 см']]),
  O('bar', 'Стволов', '1', [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4']]),
  O('ld', 'Заряжание', 'm', [['m', 'ручное'], ['a', 'автомат'], ['f', 'скоростное']]),
  O('cap', 'Питание от реактора, МВт (перезарядка = энергия залпа / мощность)', 'a', [['a', 'авто (залп за 20 с)'], ...[5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000].map(v => [String(v), String(v)])]),
  O('saf', 'Предохранители', '0', [['0', 'нет'], ['1', '1'], ['2', '2'], ['3', '3']])];
COMP.rail.ap = (c, s) => {
  // таблица «Корабли (система)»: энергия выстрела (ГДж) и экипаж по калибру; КПД 50% — половина энергии уходит в корпус теплом
  const cal = +s.cal.v, bar = +s.bar.v, ld = RAIL_LD[s.ld.v], saf = +s.saf.v, B = RAIL_CAL[cal], EG = (RAIL_E[cal] || .31), draw0 = s.cap.v === 'a' || !(+s.cap.v > 0) ? Math.max(1, Math.round(EG * 1000 * bar / 20)) : +s.cap.v, caps = draw0 / 2, cp = {m: 1};
  const f = Math.pow(cal / 10, 1.5) * (1 + 0.55 * (bar - 1));
  c.mass = Math.round(B.m * (1 + 1.03 * (bar - 1)) * ld.mass * cp.m * (1 + 0.08 * saf));
  c.cost = {fe: (Math.max(2, Math.round(10 * f))) + (Math.max(2, Math.round(8 * f * (s.ld.v === 'm' ? 1 : s.ld.v === 'a' ? 1.3 : 1.8)))), ti: Math.max(1, Math.round(4 * f)) + 2 * saf};
  const chg = EG * 1000 * bar / draw0; // с на перезарядку: энергия залпа / питание
  c.crewN = (RAIL_CREW[cal] || 2) * bar;
  c.rcfg = {cal, bar, dmg: B.dmg, vp: B.vp, rng: B.rng, ap: B.ap, shells: bar, caps, chg, draw: draw0, ammoH: 2, EG, heatGJ: EG / 2,
    rel: Math.round(chg * ld.rel / 60 * 10000) / 10000,
    fail: Math.round(0.015 * Math.sqrt(cal / 10) * Math.sqrt(bar) * ld.fail * Math.pow(0.5, saf) * 10000) / 10000,
    sig: Math.round(Math.pow(10 / cal, 0.3) * (1 + 0.1 * (bar - 1)) * 100) / 100};
  const r = c.rcfg;
  c.name = `Рельсотрон ${cal} см${bar > 1 ? ' ×' + bar : ''}`;
  c.desc = `урон ${B.dmg}, ${bar} ств., пробитие ${Math.round(B.ap * 100)}%, ${r.rng} км, снаряд ${B.vp} км/с, выстрел ${fmtN(EG, 3)} ГДж (тепла ${fmtN(EG / 2, 3)} ГДж), питание ${draw0} МВт, экипаж ${c.crewN}, перезарядка ${Math.round(chg * ld.rel * 10) / 10} с, ${ld.n} заряжание, ${saf ? saf + ' предохр.' : 'без предохр.'}, осечка ${(r.fail * 100).toFixed(1)}%, 2 т боеприпасов/ч`;
  c.rail = 1;
};
// --- зенитка ---
export const FLK = {20: {blast: 0.8, rng: 45, rel: 0.7, m: 3}, 40: {blast: 1.2, rng: 60, rel: 1, m: 5}, 76: {blast: 1.8, rng: 75, rel: 1.4, m: 9}};
// погреба по таблице: [масса, вольфрам, вольфрам на слой, редкозем и титан за отстрел]
export const MAGS = gd('modules', 'mags', {5: [7, 5, 1, 1, 5], 25: [30, 25, 3, 3, 15], 100: [110, 100, 9, 9, 45], 500: [525, 500, 27, 27, 135]});
COMP.ammo.opts = [O('t', 'Ёмкость, т', '100', Object.keys(MAGS).map(k => [k, k])), O('ma', 'Слоёв брони', '0', [['0', 'нет'], ['1', '1'], ['2', '2'], ['3', '3']]), O('mj', 'Отстрел при пробитии', '0', [['0', 'нет'], ['1', 'да']])];
COMP.ammo.ap = (c, s) => { const t = +s.t.v, M = MAGS[t] || MAGS[100], a = +s.ma.v; c.ammoCap = t; c.mass = Math.round(M[0] * (1 + .02 * a) * 10) / 10; c.cost = {w: M[1] + a * M[2]}; c.magArm = a; if (+s.mj.v) { c.magEj = 1; c.cost.ree = M[3]; c.cost.ti = M[4]; }
  c.name = `Погреб ${t} т`; c.desc = `${t} т боеприпасов${a ? `, ${a} сл. брони (переживёт ${a} попад.)` : ''}${c.magEj ? ', отстрел при пробитии (≈1 мин)' : ''}: рельсотрон 2 т/ч на ствол, пулемёт 5 т/ч`; };
COMP.reactor.opts = [O('p', 'Мощность, МВт', '100', [['5', '5'], ['10', '10'], ['20', '20'], ['50', '50'], ['100', '100'], ['300', '300'], ['1000', '1000'], ['5000', '5000']])];
COMP.reactor.ap = (c, s) => { const p = +s.p.v; c.en = p; c.mass = Math.round(p * 1.2 * 10) / 10; c.crewN = Math.ceil(p / 50); c.uYear = p * .01; c.htMW = 2 * p; /* реактор деления: 1 т на МВт эл. + высокотемп. радиаторы 1 т на 10 МВт (2 МВт тепла на 1 МВт эл.), 1 человек на 50 МВт, уран 0,01 т на МВт в год */ c.cost = {fe: Math.round(p * .9), u: Math.max(1, Math.round(p * .01)), ti: Math.max(1, Math.round(p * .1)), w: Math.max(1, Math.round(p * .05))}; c.name = `Реактор ${p} МВт`; c.desc = `${p} МВт: питает конденсаторы рельсотронов (2 МВт на конденсатор) и лазер (800 МВт на подзарядку)`; };
COMP.gat.opts = [O('tw', 'Установка', '0', [['0', 'одиночный'], ['1', 'спаренный']]), O('rot', 'Разворот турели, °/с', '25', [25, 50, 75, 100, 125, 150, 175, 200].map(v => [String(v), String(v)]))];
COMP.gat.ap = (c, s) => { const tw = +s.tw.v, rot = +s.rot.v || 25; c.mass = tw ? 45 : 25; c.crewN = tw ? 4 : 2; c.enIdle = tw ? .2 : .1; c.cost = {fe: (tw ? 36 : 20) + 2 * (rot - 25), ti: tw ? 9 : 5};
  // таблица: 6000 выстр./мин, пуля 600 м/с, 12 км, 5 т боеприпасов в час, 0,5 МВт тепла при стрельбе, поломка 1% в минуту стрельбы
  c.gcfg = {tw, rpm: 6000 * (tw ? 2 : 1), heat: 0.40, cool: 0.20, pen: 0.02, rng: 12, ammoH: 5 * (tw ? 2 : 1), mass: c.mass, heatMW: .5 * (tw ? 2 : 1), failM: .01, rot};
  c.desc = `${tw ? 'спаренный' : 'одиночный'}: 6000 выстр./мин${tw ? ' ×2' : ''}, 12 км, разворот ${rot}°/с, 0,5 МВт тепла при стрельбе, поломка 1% в минуту стрельбы`; };
COMP.flak.opts = [O('cal', 'Калибр', '40', [['20', '20 мм'], ['40', '40 мм'], ['76', '76 мм']]),
  O('rt', 'Темп огня', 'n', [['n', 'обычный'], ['b', 'очередями']]), O('saf', 'Предохранители', '0', [['0', 'нет'], ['1', '1'], ['2', '2']])];
COMP.flak.ap = (c, s) => {
  const B = FLK[+s.cal.v], b = s.rt.v === 'b', saf = +s.saf.v;
  c.mass = Math.round(B.m * (b ? 1.3 : 1) * (1 + 0.08 * saf) * 10) / 10;
  c.cost = {fe: (Math.round(B.m * 1.6)) + (Math.round(B.m * 1.6 * (b ? 1.4 : 1))), si: Math.round(B.m * 1.2) + saf * 2};
  c.fcfg = {blast: B.blast, rng: B.rng, rel: Math.round(B.rel * (b ? 0.7 : 1) * 100) / 100, fail: Math.round(0.01 * (b ? 1.8 : 1) * Math.pow(0.5, saf) * 10000) / 10000};
  c.name = `Зенитка ${s.cal.v} мм`;
  c.desc = `взрыв ${B.blast} км, дальность ${B.rng} км, перезарядка ${Math.round(60 * c.fcfg.rel)} с, ${b ? 'очередями' : 'обычный темп'}, осечка ${(c.fcfg.fail * 100).toFixed(1)}%`;
};
// --- броня ---
COMP.armor.opts = [O('mat', 'Материал', 's', [['s', 'сталь (2 см, 0,156 т/м², 2 МДж/см²)'], ['w', 'вольфрам (1 см, 0,19 т/м², 5 МДж/см²)']])];
COMP.armor.ap = (c, s) => {
  const w = s.mat && s.mat.v === 'w'; c.armor = 1; c.mass = 0; c.armW = w ? 0 : 1; c.armWw = w ? 1 : 0; c.cost = {}; c.name = w ? 'Слой брони: вольфрам' : 'Слой брони: сталь';
  c.desc = `+1 слой ${w ? 'вольфрама 1 см (5 МДж/см², 0,19 т/м²)' : 'стали 2 см (2 МДж/см², 0,156 т/м²)'} по всей площади корпуса ≈ 5 × (масса / 0,3)^⅔ м²: малому кораблю броня дороже`;
};
// --- ангары ---
// --- лёгкие аппараты: обычные корабли с маленьким двигателем; скорость = тяга/масса, запас хода и боезапас ограничены массой ---
const CR_KEYS = ['hp', 'vmax', 'a', 'fuel', 'ammo', 'ng', 'dmg', 'cd', 'gun', 'mass', 'torp'];
const CR_HULL = {F: {l: [15, 6, 60], s: [10, 8, 110], h: [6, 14, 200]}, B: {l: [7, 3, 90], s: [5, 4, 170], h: [3, 7, 300]}}; // [число в ангаре, прочность, масса корпуса т]
const CR_GUN = {'1': {n: 1, dmg: 3, cd: 1.4, rng: 7, m: 20, t: 'одно крупнокалиберное'}, '2': {n: 2, dmg: 1.4, cd: 1.1, rng: 5, m: 16, t: 'два средних'}, '4': {n: 4, dmg: .6, cd: .8, rng: 3.5, m: 16, t: 'четыре мелких скорострельных'}};
export function craftDesign(kind, o) { // o: {cl, en (т двигателя), fu (минут тяги), gn, am (патронов), tp}
  const H = CR_HULL[kind][o.cl || 's'], en = +o.en || 100, fu = +o.fu || 20, G = kind === 'F' ? CR_GUN[o.gn || '2'] : null, am = kind === 'F' ? (+o.am || 120) : 0;
  const fuelM = en * .012 * fu, ammoM = am * .1, torpM = kind === 'B' ? 20 * (+o.tp || 1) : 0, m = H[2] + en + fuelM + (G ? G.m : 0) + ammoM + torpM;
  const vmax = 8 * Math.sqrt(en / m); // км/с: тяговооружённость решает; ≥3× быстрее крупных кораблей (≈0,5 км/с)
  return {n: H[0], hp: H[1], vmax, a: vmax * .125, fuel: fu * 60, ammo: am, ng: G ? G.n : 0, dmg: G ? G.dmg : 0, cd: G ? G.cd : 0, gun: G ? G.rng : 0, mass: Math.round(m), torp: kind === 'B' ? (+o.tp || 1) : 0, fuelM: Math.round(fuelM), g: G};
}
const pk = a => a[Math.floor(Math.random() * a.length)];
export const randCraft = kind => kind === 'F' ? craftDesign('F', {cl: pk(['l', 's', 's', 'h']), en: pk(['50', '100', '100', '200']), fu: pk(['5', '10', '20', '30', '60']), gn: pk(['1', '2', '2', '4']), am: pk(['60', '120', '240'])}) : craftDesign('B', {cl: pk(['l', 's', 'h']), en: pk(['50', '100', '200']), fu: pk(['10', '20', '30', '60'])});
export const CR_DEF = {F: craftDesign('F', {cl: 's', en: 100, fu: 20, gn: '2', am: 120}), B: craftDesign('B', {cl: 's', en: 100, fu: 30})};
const CR_EN = [['50', 'двигатель 50 т'], ['100', 'двигатель 100 т'], ['200', 'двигатель 200 т']], CR_FU = [['5', '5 мин тяги'], ['10', '10 мин'], ['20', '20 мин'], ['30', '30 мин'], ['60', '60 мин']];
const crSum = q => `${q.mass} т, ${q.vmax.toFixed(1)} км/с, ${Math.round(q.fuel / 60)} мин тяги`;
COMP.hangar_f.opts = [O('cl', 'Корпус', 's', [['l', 'лёгкие (15 шт)'], ['s', 'обычные (10 шт)'], ['h', 'тяжёлые (6 шт)']]), O('en', 'Двигатель', '100', CR_EN), O('fu', 'Запас хода', '20', CR_FU),
  O('gn', 'Пушки', '2', [['1', 'одна крупная'], ['2', 'две средние'], ['4', 'четыре мелких']]), O('am', 'Боезапас', '120', [['60', '60 выстрелов'], ['120', '120'], ['240', '240']])];
COMP.hangar_f.ap = (c, s) => {
  const q = craftDesign('F', {cl: s.cl.v, en: s.en.v, fu: s.fu.v, gn: s.gn.v, am: s.am.v});
  c.hangF = q.n; c.fq = q; c.mass = Math.round(q.n * q.mass * 1.15); c.cost = {fe: 60, si: 20, ti: 10};
  c.desc = `${q.n} истребителей по ${crSum(q)}: прочность ${q.hp}, ${q.g.t} (урон ${q.g.dmg}, дальность ${q.g.rng} км), ${q.ammo} выстрелов`;
};
COMP.hangar_b.opts = [O('cl', 'Корпус', 's', [['l', 'лёгкие (7 шт)'], ['s', 'обычные (5 шт)'], ['h', 'тяжёлые (3 шт)']]), O('en', 'Двигатель', '100', CR_EN), O('fu', 'Запас хода', '30', CR_FU)];
COMP.hangar_b.ap = (c, s) => {
  const q = craftDesign('B', {cl: s.cl.v, en: s.en.v, fu: s.fu.v});
  c.hangB = q.n; c.bq = q; c.mass = Math.round(q.n * q.mass * 1.15); c.cost = {fe: 60, si: 20, ti: 10, pt: 2};
  c.desc = `${q.n} бомбардировщиков по ${crSum(q)} с торпедой: прочность ${q.hp}`;
};
export const crewNum = c => c.mine ? 2 : c.lab ? 1 : (c.rail || c.flak || c.gat) ? 0.1 : c.hangars ? 2 : 0;
export const crewLabel = (c, n) => { const x = crewNum(c); if (!x) return 'персонал не нужен'; if (x < 1) return n ? `персонал ${Math.ceil(n * x)} чел.` : 'персонал: 1 на 10 орудий'; return `персонал ${n ? x * n + ' чел.' : x + ' чел.'}`; };
export const _cc = {};
export const baseOf = k => k.split('|')[0];
export function parseKey(k) { const [b, ...r] = k.split('|'), o = {}; for (const x of r) { const i = x.indexOf('='); o[x.slice(0, i)] = x.slice(i + 1); } return [b, o]; }
export function mkKey(b, o) { const c = COMP[b]; return c.opts ? b + '|' + c.opts.map(p => p.id + '=' + (p.range ? snapPct((o && o[p.id]) || p.def) : p.num ? snapNum((o && o[p.id]) || p.def, p.num.min, p.num.max, +p.def) : ((o && o[p.id]) || p.def))).join('|') : b; }
export function compOf(key) {
  if (_cc[key] && !key.startsWith('hangar_f')) return _cc[key];
  const [b, o] = parseKey(key), base = COMP[b]; if (!base) return null;
  let c = base;
  if (base.opts) {
    c = {...base, cost: {...base.cost}}; const sel = {};
    for (const p of base.opts) sel[p.id] = p.range ? {v: String(snapPct(o[p.id] || p.def))} : p.num ? {v: String(snapNum(o[p.id] || p.def, p.num.min, p.num.max, +p.def))} : p.dyn ? {v: o[p.id] || p.def, l: ''} : (p.vals.find(v => v.v === o[p.id]) || p.vals.find(v => v.v === p.def));
    base.ap(c, sel);
  }
  if (MIL_MASS[b]) { c = {...c, cost: {...c.cost}}; c.mass = Math.round(c.mass * MIL_MASS[b]); }
  c.base = b; if (b === 'hangar_f') return c; return _cc[key] = c;
}
// боевые модули в реальных тоннах (множитель к базовой массе); рельсы и ангары заданы сразу в тоннах
const MIL_MASS = {flak: 22, lgun: 20, missile: 30, irs: 20, ems: 20, radar: 30, fcs: 2, ew: 25, marines: 40, dcon: 25, sink: 30};

export const FIELDS = {phys: 'Физика', eng: 'Инженерия', bio: 'Биология'};
export const RES = {fe:'Железо', ti:'Титан', si:'Кремний', c:'Уголь и нефть', ice:'Лёд', pt:'Платина', ree:'Редкозем', w:'Вольфрам', co:'Кобальт', n2:'Азот', co2:'Углекислый газ', ch4:'Топливные газы', nh3:'Аммиак', u:'Уран', spares:'Тех. изделия'};

// Точки Лагранжа Солнце–Земля. Расстояния условно увеличены, чтобы их было видно на карте.
// Сложность добычи жилы: 0.1–1.0 у каждого тела свой (детерминированно), падает вместе с выработкой.
// Эффективность = сложность × (остаток / исходный запас): выбрали 50% железа — вдвое медленнее.
export function veinBase(id, k) { let h = 2166136261; for (const ch of id + ':' + k) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return Math.round((.1 + .9 * ((h >>> 0) % 1000) / 999) * 20) / 20; }
// Через сколько лет жила выработается на 90% при текущей добыче M т/сутки на жилу (экспоненциально: чем меньше остаток, тем медленнее)
export function depleteYears(id, k, init, M) { const b = veinBase(id, k); if (!(init > 0 && M > 0)) return Infinity; let d = 0; for (let i = 0; i < 9; i++) d += init * .1 / (M * b * (1 - .05 * i)); return d / 360; } // до 90% выработки
// истощение (таблица «Переработка»): каждые выработанные 10% запаса снижают содержание на 5% от исходного — лучшую руду выбирают первой
export function veinEff(id, k, cur, init) { if (!(init > 0) || !(cur > 0)) return 0; const dep = Math.max(0, Math.min(1, 1 - cur / init)); return veinBase(id, k) * (1 - .05 * Math.floor(dep * 10 + 1e-9)); }
export const BODIES = [
  {id:'sun', name:'Солнце', a:0, ang:0, kind:'sun', hot:true, sci:{phys:15}, pool:{phys:12000}},
  {id:'venus', name:'Венера', a:0.723, ang:2.2, kind:'planet', sci:{phys:10, bio:4}, pool:{phys:6000, bio:2000}},
  {id:'earth', name:'Земля', a:1, ang:0.4, kind:'hub'},
  {id:'mars', name:'Марс', a:1.524, ang:4.1, kind:'planet', sci:{bio:10, eng:4}, pool:{bio:6000, eng:2000}},
  {id:'mercury', name:'Меркурий', a:0.387, ang:5.3, kind:'planet', sci:{phys:6}, pool:{phys:3000}},
  // внешняя система: газовые гиганты (не заселяются, но дают сильные гравманёвры) и их луны
  {id:'jupiter', name:'Юпитер', a:5.203, ang:1.6, kind:'giant', sci:{phys:12}, pool:{phys:8000}},
  {id:'saturn', name:'Сатурн', a:9.537, ang:4.9, kind:'giant', sci:{phys:10}, pool:{phys:7000}},
  {id:'uranus', name:'Уран', a:19.19, ang:0.8, kind:'giant', sci:{phys:8}, pool:{phys:5000}},
  {id:'neptune', name:'Нептун', a:30.07, ang:3.4, kind:'giant', sci:{phys:8}, pool:{phys:5000}},
  {id:'pluto', name:'Плутон', a:39.48, ang:2.1, kind:'planet', ores:{ice:.5, n2:.05, ch4:.02, c:.02}},
  {id:'io', name:'Ио', parent:'jupiter', r:0.002819, per:1.769, ang:0.3, kind:'moon', ores:{fe:.2, si:.2, u:.00005, co:.0005}},
  {id:'europa_j', name:'Европа', parent:'jupiter', r:0.004486, per:3.551, ang:2.1, kind:'moon', ores:{ice:.6, si:.1, c:.01}, sci:{bio:12}, pool:{bio:8000}},
  {id:'ganymede', name:'Ганимед', parent:'jupiter', r:0.007155, per:7.155, ang:4.0, kind:'moon', ores:{ice:.5, si:.2, fe:.1}},
  {id:'callisto', name:'Каллисто', parent:'jupiter', r:0.012585, per:16.689, ang:5.5, kind:'moon', ores:{ice:.4, c:.1, si:.2}},
  {id:'titan', name:'Титан', parent:'saturn', r:0.008168, per:15.945, ang:1.2, kind:'moon', ores:{ice:.5, ch4:.1, n2:.1, c:.05}, sci:{bio:10}, pool:{bio:6000}},
  {id:'enceladus', name:'Энцелад', parent:'saturn', r:0.001591, per:1.370, ang:3.8, kind:'moon', ores:{ice:.7, nh3:.01, co2:.01}},
  {id:'triton', name:'Тритон', parent:'neptune', r:0.002371, per:5.877, ang:0.9, kind:'moon', ores:{ice:.5, n2:.1, ch4:.02}},
  {id:'charon', name:'Харон', parent:'pluto', r:0.000131, per:6.387, ang:4.4, kind:'moon', ores:{ice:.5, nh3:.01}},
  {id:'luna', name:'Луна', parent:'earth', r:0.00257, per:27.32, ang:1.0, kind:'moon', ores:{si:.2, fe:.1, ti:.03, ree:.0005, ice:.001, w:.00005, u:.00001}},
  {id:'phobos', name:'Фобос', parent:'mars', r:0.0000627, per:0.319, ang:0.5, kind:'moon', ores:{c:.05, fe:.15, si:.15, ice:.02}},
  {id:'deimos', name:'Деймос', parent:'mars', r:0.000157, per:1.263, ang:3.0, kind:'moon', ores:{c:.05, ice:.03, si:.15}},
  {id:'l1', name:'Земля L1', kind:'lagrange', lp:{r:0.95, da:0}},
  {id:'l2', name:'Земля L2', kind:'lagrange', lp:{r:1.05, da:0}},
  {id:'l3', name:'Земля L3', kind:'lagrange', lp:{r:1.0, da:Math.PI}},
  {id:'l4', name:'Земля L4', kind:'lagrange', lp:{r:1.0, da:Math.PI / 3}},
  {id:'l5', name:'Земля L5', kind:'lagrange', lp:{r:1.0, da:-Math.PI / 3}},
  {id:'apophis', name:'Апофис', a:0.92, ang:5.0, kind:'ast', ores:{si:.2, fe:.2, co:.001, pt:.00005, w:.00005}},
  {id:'bennu', name:'Бенну', a:1.126, ang:1.1, kind:'ast', ores:{ice:.1, c:.05, fe:.15, si:.15}},
  {id:'ryugu', name:'Рюгу', a:1.19, ang:3.3, kind:'ast', ores:{ice:.08, c:.05, si:.15, fe:.15}},
  {id:'eros', name:'Эрос', a:1.458, ang:0.9, kind:'ast', ores:{fe:.2, si:.2, co:.001, ti:.002, pt:.000005}},
  {id:'vesta', name:'Веста', a:2.362, ang:5.6, kind:'ast', ores:{fe:.15, si:.25, ti:.005, ree:.0003, co:.0005}},
  {id:'juno', name:'Юнона', a:2.67, ang:2.5, kind:'ast', ores:{fe:.2, si:.2, co:.001, pt:.000005, u:.00002}},
  {id:'ceres', name:'Церера', a:2.767, ang:3.9, kind:'ast', ores:{ice:.25, c:.05, si:.15, fe:.1, co:.0005}},
  {id:'pallas', name:'Паллада', a:2.772, ang:0.2, kind:'ast', ores:{fe:.15, si:.2, ti:.002, c:.03}},
  {id:'psyche', name:'Психея', a:2.92, ang:1.7, kind:'ast', ores:{fe:.85, co:.005, pt:.00003, w:.0003, ree:.0001, u:.00001}},
  {id:'hygiea', name:'Гигея', a:3.14, ang:4.7, kind:'ast', ores:{ice:.15, c:.05, si:.15, fe:.15, co:.0005}},
  {id:'itokawa', name:'Итокава', a:1.324, ang:2.0, kind:'ast', ores:{si:.2, fe:.2, co:.001}},
  {id:'icarus', name:'Икар', a:1.078, ang:5.5, kind:'ast', ores:{ti:.003, fe:.2, si:.2, u:.00002}},
  {id:'orpheus', name:'Орфей', a:1.209, ang:3.6, kind:'ast', ores:{pt:.00005, ti:.01, ree:.0003, si:.2, fe:.2}},
  {id:'gaspra', name:'Гаспра', a:2.21, ang:4.4, kind:'ast', ores:{si:.2, fe:.25, co:.001}},
  {id:'toutatis', name:'Таутатис', a:2.51, ang:5.9, kind:'ast', ores:{co:.002, fe:.3, ti:.002, si:.2}},
  {id:'eunomia', name:'Эвномия', a:2.64, ang:1.3, kind:'ast', ores:{si:.2, fe:.2, co:.001, ti:.002}},
  {id:'mathilde', name:'Матильда', a:2.65, ang:3.1, kind:'ast', ores:{c:.08, ice:.05, si:.15, fe:.15}},
  {id:'kleopatra', name:'Клеопатра', a:2.79, ang:0.7, kind:'ast', ores:{fe:.85, co:.005, pt:.00003, w:.0003}},
  {id:'ida', name:'Ида', a:2.86, ang:5.2, kind:'ast', ores:{fe:.2, si:.2, ti:.002, ree:.0002}},
  {id:'interamnia', name:'Интерамния', a:3.06, ang:2.8, kind:'ast', ores:{ice:.15, c:.05, si:.15, co:.0005}},
  {id:'europa', name:'Европа (астероид)', a:3.09, ang:6.0, kind:'ast', ores:{ice:.15, c:.05, si:.15, u:.00002}},
  {id:'themis', name:'Фемида', a:3.13, ang:0.4, kind:'ast', ores:{ice:.2, c:.05, si:.15}},
  {id:'davida', name:'Давида', a:3.17, ang:4.0, kind:'ast', ores:{c:.05, ice:.1, si:.15}},
  {id:'sylvia', name:'Сильвия', a:3.49, ang:1.9, kind:'ast', ores:{ice:.15, c:.05, ree:.0002, co:.0005}},
  {id:'phaethon', name:'Фаэтон', a:1.27, ang:4.9, kind:'ast', strange:true, ores:{fe:.3, co:.002, si:.2}, sci:{eng:10, phys:4}, pool:{eng:3500, phys:1000}},
  {id:'xanomaly', name:'Аномалия X', a:2.45, ang:0.1, kind:'ast', strange:true, ores:{}, sci:{phys:10, bio:6, eng:6}, pool:{phys:3000, bio:2000, eng:2000}},
  {id:'oumuamua', name:'Оумуамуа', a:3.3, ang:2.3, kind:'ast', strange:true, ores:{fe:.5}, sci:{phys:10, eng:5}, pool:{phys:4000, eng:1500}},
  {id:'chiron', name:'Хирон', a:3.45, ang:3.7, kind:'ast', strange:true, ores:{ice:.5, c:.05}, sci:{bio:10, phys:3}, pool:{bio:4000, phys:800}},
];
// Газы и льды в астероидах
export const GAS_ADD = {ceres: {nh3: .01, n2: .005}, bennu: {co2: .005, ch4: .002}, ryugu: {nh3: .005, ch4: .003}, hygiea: {nh3: .01, n2: .005}, themis: {co2: .02, nh3: .01}, // доли массы
  interamnia: {n2: .005, co2: .01}, chiron: {n2: .03, ch4: .02}, mathilde: {ch4: .005, co2: .01}, phobos: {co2: .002}, deimos: {nh3: .002}, europa: {n2: .005, nh3: .005}, sylvia: {co2: .005, nh3: .003}};
for (const b of BODIES) if (GAS_ADD[b.id]) Object.assign(b.ores, GAS_ADD[b.id]);
// Диаметры (км): оборудование кораблей берёт только небольшие тела
export const DIAM = {ceres: 940, vesta: 525, pallas: 512, hygiea: 430, davida: 270, interamnia: 330, europa: 315, sylvia: 270, eunomia: 255, juno: 234, psyche: 226, themis: 200, kleopatra: 135,
  mathilde: 52, ida: 31, eros: 17, gaspra: 12, toutatis: 4.5, apophis: 0.37, bennu: 0.49, ryugu: 0.9, itokawa: 0.33, icarus: 1.4, orpheus: 1, phaethon: 5.8, xanomaly: 50, oumuamua: 0.4,
  chiron: 220, phobos: 22, deimos: 12, luna: 3474,
  mercury: 4879, jupiter: 139820, saturn: 116460, uranus: 50724, neptune: 49244, pluto: 2377, io: 3643, europa_j: 3122, ganymede: 5268, callisto: 4821, titan: 5150, enceladus: 504, triton: 2707, charon: 1212};
for (const b of BODIES) if (DIAM[b.id]) b.d = DIAM[b.id];
// Недра Земли и планет: добываются шахтами при наличии населения
// Выход шахты, т в сутки на каждую руду (единая шкала, таблица «Пояс»): шахта (10 000 чел.) вынимает 1 млн т породы в год ≈ 2 740 т/сут,
// руда = порода × содержание × 85% (потери обогащения). Земля: железо 50%, кремний 25%, титан и редкозем 0,1%, уран 0,05%, платина 5 г/т; уголь и нефть, газы — свои жилы.
// Вольфрам 0,05%, кобальт 0,02%. Лёд на Земле не добывают (вода просто есть). Правится в data/economy.json (mineYield).
export const MINE_Y = gd('economy', 'mineYield', {fe: 1165, si: 582, ti: 2.3, ree: 2.3, u: 1.2, pt: .012, w: 1.17, co: .47});
// угольная шахта (уголь и нефть — свои пласты): 1 млн т породы в год ≈ 2 300 т угля в сутки
export const COAL_Y = gd('economy', 'coalYield', {c: 2300});
// корабельный лазер: т породы в сутки на единицу мощности добычи; руда = порода × содержание тела × 85% × эффективность жилы
export const SHIP_ROCK = gd('economy', 'shipRock', 1000);
export const gradeOf = (id, k) => { const b = BODY[id]; if (!b) return 0; if (b.grade && b.grade[k] != null) return b.grade[k]; const o = b.ores || {}, W = Object.values(o).reduce((a, v) => a + v, 0); return W > 0 ? (o[k] || 0) / W * .5 : 0; };
export const isCoal = r => COAL_Y[r] != null;
export const myOf = r => MINE_Y[r] != null ? MINE_Y[r] : COAL_Y[r] != null ? COAL_Y[r] : 0;
export const GROUND = {
  // реальные порядки запасов (т): разведанные запасы земной коры; Марс ~0.1 и Венера ~0.8 от Земли по массе
  // Земля (решено с владельцем): доступных недр — на ~50 лет при полной добыче под потребности 2030 года
  earth: {fe: 7.9e6, si: 6.2e6, c: 3.9e6, ti: 1.5e5, ree: 4e5, pt: 5.4e4, u: 6.6e6, w: 3e5, co: 1.2e5}, // начальные недра этой игры пересчитываются под госшахты (state.gMax)
  mars: {fe: 1.8e10, si: 1e12, ice: 5e15, co: 5e6, w: 9e6, ti: 7e7, c: 1e11, ree: 1.2e7, pt: 7e3}, venus: {fe: 1.4e11, si: 8e12, ti: 5e8, co: 4e7, w: 7e7, u: 5e6, c: 8e11},
};
export const POP = {earth: 1500}; // рабочие, доступные на Земле (колоний пока нет)
export const shipMineLimit = () => (state && state.tech && state.tech.rock1000) ? 1000 : (state && state.tech && state.tech.rock300) ? 300 : 100;
export const canShipMine = id => { const b = BODY[id]; return !!b && (b.d === undefined || b.d <= shipMineLimit()); };
// Тераформирование: сколько тонн чего нужно доставить на планету
export const TERRA = {mars: {name: 'Марс', unit: 1e10, need: {ice: 3e12, n2: 3e12, co2: 2e12, nh3: 1e12, ch4: 1e12}}};

// ===== Реальные массы и запасы: масса тела × доля вещества =====
const MASS = {luna: 7.35e22, phobos: 1.07e16, deimos: 1.5e15, apophis: 6.1e10, bennu: 7.8e10, ryugu: 4.5e11, eros: 6.7e15, vesta: 2.59e20, juno: 2.7e19, ceres: 9.4e20, pallas: 2.04e20, psyche: 2.4e19, hygiea: 8.7e19,
  itokawa: 3.5e10, icarus: 1e12, orpheus: 1e11, gaspra: 1e16, toutatis: 5e13, eunomia: 3.1e19, mathilde: 1e17, kleopatra: 4.6e18, ida: 4.2e16, interamnia: 3.5e19, europa: 2.4e19, themis: 1.2e19, davida: 3.4e19,
  sylvia: 1.5e19, phaethon: 1.4e14, xanomaly: 1e17, oumuamua: 4e9, chiron: 4e18};
const rscale = (b, kg, share) => { const W = Object.values(b.ores).reduce((a, v) => a + v, 0); b.mass = kg; if (W <= 0) return; const t = kg / 1000 * share; for (const k in b.ores) b.ores[k] = Math.round(t * b.ores[k] / W); };
// именные тела: ores — содержание (доля массы); запас = масса × содержание; b.grade — содержание для добычи
for (const b of BODIES) if (b.ores && MASS[b.id]) { b.mass = MASS[b.id]; b.grade = {...b.ores}; for (const k in b.ores) b.ores[k] = Math.round(MASS[b.id] / 1000 * b.grade[k]); }
// Процедурные астероиды и кометы
function mkRng(seed) { let a = seed; return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const GR = mkRng(20240611), LET = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
// Содержание (доля массы) по типам: C — углеродные (лёд, органика), S — каменные, M — металлические (железо-никель, платиноиды ~30 г/т)
const AST_TYPES = [
  {k: 'C', w: .5, rho: 1300, ores: {ice: .15, c: .05, si: .15, fe: .15, nh3: .01, co2: .01, co: .0005, ree: .0001, pt: .000001}},
  {k: 'S', w: .35, rho: 2700, ores: {si: .2, fe: .2, co: .001, ti: .002, ree: .0002, w: .00005, u: .00002, pt: .000005}},
  {k: 'M', w: .15, rho: 5300, ores: {fe: .85, co: .005, ti: .001, w: .0003, ree: .0001, u: .00001, pt: .00003}},
];
export const AST_TYPE_NAME = {C: 'углеродный (C)', S: 'каменный (S)', M: 'металлический (M)'};
for (let i = 0; i < 900; i++) {
  const u = GR(), ty = AST_TYPES[GR() < .5 ? 0 : GR() < .7 ? 1 : 2], r = GR();
  const d = Math.round(.3 * Math.pow(10, 2.7 * Math.pow(u, 1.6)) * 100) / 100, a = r < .7 ? 2.1 + 1.2 * GR() : r < .9 ? .95 + 1.05 * GR() : 3.9 + 1.4 * GR();
  const kg = 4 / 3 * Math.PI * Math.pow(d * 500, 3) * ty.rho, ores = {};
  for (const k in ty.ores) ores[k] = 1;
  const b = {id: 'ga' + i, name: (2001 + Math.floor(GR() * 30)) + ' ' + LET[Math.floor(GR() * 24)] + LET[Math.floor(GR() * 24)] + Math.floor(1 + GR() * 400), a: Math.round(a * 1000) / 1000, ang: GR() * 6.2832, kind: 'ast', gen: true, type: ty.k, d, ores};
  rscale(b, kg, 1); b.grade = {...ty.ores}; for (const k in ty.ores) b.ores[k] = Math.round(kg / 1000 * ty.ores[k]);
  BODIES.push(b);
}
// Кометы: ледяные ядра, закручены в вихрь у внешнего края (три рукава)
for (let i = 0; i < 600; i++) {
  const u = GR(), a = 4 + 14 * Math.pow(u, .85), arm = i % 3, kg = Math.pow(10, 12 + 3.7 * Math.pow(GR(), 1.5)), t = kg / 1000;
  BODIES.push({id: 'comet' + i, name: 'Комета К-' + (i + 1), a: Math.round(a * 1000) / 1000, ang: (arm * 2.0944 + 2.6 * Math.log(a / 4) + (GR() - .5) * .35) % 6.2832, kind: 'ast', comet: true, gen: true, mass: kg, d: Math.max(.1, Math.round(2 * Math.cbrt(kg / 600 * 3 / (4 * Math.PI)) / 10) / 100),
    ores: {ice: Math.round(t * .5), n2: Math.round(t * .06), co2: Math.round(t * .15), ch4: Math.round(t * .05), nh3: Math.round(t * .1), c: Math.round(t * .08), si: Math.round(t * .06)}});
}
export const BODY = Object.fromEntries(BODIES.map(b => [b.id, b]));
export const GROUP_COLORS = ['#6fdc8c','#e3a94f','#c58cf0','#5ec8d8','#ef7f9a','#a8d65a'];

export let state = null;
// Казна со счётчиком реального притока и оттока (для бюджета: что на самом деле пришло и ушло за месяц)
export function wrapMoney(s) { if (!s) return s; const d0 = Object.getOwnPropertyDescriptor(s, 'money'); if (d0 && d0.get) return s; let v = s.money || 0;
  Object.defineProperty(s, 'money', {enumerable: true, configurable: true, get() { return v; }, set(x) { const d = x - v; if (d > 0) s.mIn = (s.mIn || 0) + d; else if (d < 0) s.mOut = (s.mOut || 0) - d; v = x; }}); return s; }
export function setState(s) { state = wrapMoney(s); }

/* ===== УТИЛИТЫ ===== */
export const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
export const isSt = id => typeof id === 'string' && id.startsWith('st:');
export const isSh = id => typeof id === 'string' && id.startsWith('sh:');
export const myShips = () => state.ships.filter(s => !s.corp), myStations = () => state.stations.filter(s => !s.corp);
let _ix = {t: -1, ns: -1, nh: -1, st: null, sh: null, st0: null, sh0: null};
function ix() {
  const I = _ix;
  if (I.t !== state.t || I.ns !== state.stations.length || I.nh !== state.ships.length || I.st0 !== state.stations || I.sh0 !== state.ships) {
    I.t = state.t; I.ns = state.stations.length; I.nh = state.ships.length; I.st0 = state.stations; I.sh0 = state.ships;
    I.st = new Map(); I.sh = new Map(); I.ab = null;
    for (const s of state.stations) I.st.set('st:' + s.id, s);
    for (const s of state.ships) I.sh.set('sh:' + s.id, s);
  }
  return I;
}
export const stById = id => ix().st.get(id);
export const shById = id => ix().sh.get(id);
export function earthAng(t) { const e = BODY.earth; return e.ang + 2 * Math.PI * t / 365.25; }
let _opT = NaN, _opC = new Map();
export function objPos(id, t) {
  if (t !== _opT) { _opT = t; _opC = new Map(); }
  let r = _opC.get(id); if (r) return r;
  r = objPos0(id, t); if (!isSh(id)) _opC.set(id, r); return r;
}
const _hz = id => { let h = 7; for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0; return h / 4294967296; };
// наклон орбиты для псевдо-3D: высота над плоскостью эклиптики
function zOf(b, x, y) {
  if (!b || b.id === 'earth' || b.id === 'sun' || b.lp) return 0;
  const inc = (b.comet ? 0.5 : b.kind === 'ast' ? 0.14 : 0.05) * (_hz(b.id + 'i') * 2 - 1), node = _hz(b.id) * 6.283;
  return Math.hypot(x, y) * Math.sin(inc) * Math.sin(Math.atan2(y, x) - node);
}
function objPos0(id, t) {
  if (isSt(id)) { const s = stById(id); if (!s) return {x: 0, y: 0}; return s.at ? objPos(s.at, t) : {x: s.x, y: s.y}; }
  if (isSh(id)) { const s = shById(id); return s ? {x: s.x, y: s.y} : {x: 0, y: 0}; }
  const b = BODY[id];
  if (b && b.parent) { const pp = objPos(b.parent, t), a = b.ang + 2 * Math.PI * t / b.per; return {x: pp.x + b.r * Math.cos(a), y: pp.y + b.r * Math.sin(a), z: (pp.z || 0) + (b.id === 'luna' ? 0 : b.r * 0.4 * Math.sin(a - _hz(b.id) * 6.283))}; }
  if (!b || (b.a === 0 && !b.lp)) return {x: 0, y: 0};
  if (b.lp) { const a = earthAng(t) + b.lp.da; return {x: b.lp.r * Math.cos(a), y: b.lp.r * Math.sin(a)}; }
  const ang = b.ang + 2 * Math.PI * t / (365.25 * Math.pow(b.a, 1.5));
  const px = b.a * Math.cos(ang), py = b.a * Math.sin(ang);
  return {x: px, y: py, z: zOf(b, px, py)};
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
// скорость, м/с = мощность двигателей / (масса корабля без топлива / 2) · 1000; здесь в а.е./сут
export const shipSpeedTrue = s => s.st.power / Math.max(1e-9, (shipMass(s) - s.fuel) / 2) * 1000 * 86400 / AU_M * pilSpeed(s);
export const shipSpeed = s => shipSpeedTrue(s) * TRAVEL_WARP; // фактическая скорость перелёта, а.е./сут
// расход на а.е.: двигатели жгут (мощность одного)² · (K/КПД) · (1 − доля объёма двигателей) т/с, на пути времени уходит d / скорость
export const fuelPerAU = s => { const sp = shipSpeedTrue(s); if (!(sp > 0)) return 1e9; const fr = s.st.fuelRate != null ? s.st.fuelRate : (shipMass(s) - s.fuel) * FUEL_K / s.st.eff * sp / 86400; return fr * 86400 * pilFuel(s) / sp; };
export const fuelFor = (s, d) => fuelPerAU(s) * d;
export const fuelPlanAU = (s, d = 2) => fuelFor(s, d) / d;
export const fmtN = (n, d = 0) => Math.abs(n) >= 1e15 ? Number(n).toExponential(1).replace('e+', 'e').replace('.', ',') : Math.abs(n) >= 1e12 ? fmtN0(n / 1e12, 2) + ' трлн' : Math.abs(n) >= 1e9 ? fmtN0(n / 1e9, 1) + ' млрд' : fmtN0(n, d);
const NF = {};
export const fmtN0 = (n, d = 0) => (NF[d] || (NF[d] = new Intl.NumberFormat('ru-RU', {maximumFractionDigits: d, minimumFractionDigits: d}))).format(Number(n));
export function fmtDate(t) { return new Date(EPOCH + t * 86400000).toISOString().replace('T', ' ').slice(0, 16); }
export function fmtDur(days) {
  if (!isFinite(days)) return '∞';
  if (days < 1) return fmtN(days * 24, 1) + ' ч';
  return fmtN(days, 1) + ' сут';
}
export function log(msg) {
  state.log.unshift({t: state.t, msg}); if (hooks.onLog) hooks.onLog(msg);
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
// --- боевой лазер ---
export const LAS_D = {s: {dmg: 2, m: 150}, m: {dmg: 4, m: 450}, l: {dmg: 8, m: 1200}};
export const LAS_R = {n: 1500, m: 2500, f: 4000}; // дальнобойная артиллерия: бьёт через всё поле боя
export const mkLas = (pw, fr) => ({dmg: LAS_D[pw].dmg, rng: LAS_R[fr], chg: 0.02 * LAS_D[pw].dmg});
const LAS_LENS = [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 70, 100], LAS_CAPS = [1, 2, 5, 10, 20, 50, 100, 200, 300, 500, 750, 1000];
COMP.lgun.opts = [O('lens', 'Линза, м', '20', LAS_LENS.map(v => [String(v), v + ' м'])), O('dur', 'Длительность луча, с', '5', Array.from({length: 10}, (_, i) => [String(i + 1), i + 1 + ' с'])),
  O('caps', 'Конденсаторов (по 600 МДж)', '100', LAS_CAPS.map(v => [String(v), String(v)]))];
// дальность: линза 1 м → 20 км, 100 м → 6000 км; запас энергии: 10 МВт на км за секунду луча, конденсатор 600 МДж
export const mkLaser = (lens, dur, caps) => {
  const lr = Math.min(6000, 20 * Math.pow(lens, 1.2386)), er = caps * 600 / (10 * dur), rng = Math.max(20, Math.round(Math.min(lr, er)));
  const E = 10 * rng * dur; // МДж на выстрел
  return {lens, dur, caps, rng, E, ap: 0.8, dmg: Math.round((2 + lens / 8) * 10) / 10, chg: 1, mass: Math.round(3.75 * lens * lens + 5 * caps)};
};
COMP.lgun.ap = (c, s) => {
  const L = mkLaser(+s.lens.v, +s.dur.v, +s.caps.v); c.lcfg = L; c.mass = L.mass;
  c.cost = {fe: (Math.round(L.mass * 0.5)) + (Math.round(L.mass * 0.6)), si: Math.round(L.mass * 0.4), ree: Math.max(1, Math.round(L.mass * 0.1))};
  c.name = `Лазер ${L.lens} м / ${L.rng} км`;
  c.desc = `линза ${L.lens} м, луч ${L.dur} с, ${L.caps} конд., дальность ${L.rng} км (линза даёт ${Math.round(Math.min(6000, 20 * Math.pow(L.lens, 1.2386)))}, энергии хватает на ${Math.round(L.caps * 60 / L.dur)}), выстрел ${Math.round(L.E).toLocaleString('ru')} МДж, пробитие 80%/с, перезарядка ${Math.round(Math.max(180, L.E / 800) / 60 * 10) / 10} мин; встраивается в центр корпуса, не более одного на корабль`;
};
// --- ракеты ---
export const MIS_A = {l: {hp: 1, m: 0.7, n: 'лёгкая'}, m: {hp: 2, m: 1, n: 'средняя'}, h: {hp: 3, m: 1.5, n: 'тяжёлая'}};
export const MIS_S = {s: {spd: 6, n: 'медленная (6 км/с)'}, m: {spd: 8, n: 'обычная (8 км/с)'}, f: {spd: 10, n: 'быстрая (10 км/с)'}};
export const MIS_W = {s: {dmg: 2, blast: 3, m: 0.8}, m: {dmg: 4, blast: 6, m: 1}, l: {dmg: 7, blast: 10, m: 1.5}, x: {dmg: 15, blast: 16, m: 3.5}, g: {dmg: 30, blast: 26, m: 7}};
export const misTons = (a, w) => Math.round(0.5 * MIS_W[w].m * MIS_A[a].m * 100) / 100;
export const mkMis = (a, sp, w, ammo) => ({tons: misTons(a, w), hp: MIS_A[a].hp, spd: MIS_S[sp].spd * (a === 'h' ? 0.85 : a === 'l' ? 1.1 : 1), dmg: MIS_W[w].dmg, blast: MIS_W[w].blast, ammo: ammo || 8, rng: 220, rel: 0.5 * (1 + MIS_W[w].dmg / 6)});
const MS_PW = [1, 2, 3, 5, 8, 10, 15, 20, 30, 40, 50, 70, 100], MS_EN = [0.05, 0.1, 0.2, 0.5, 1, 2, 5, 10, 30, 100, 300, 1000], MS_FU = [0.01, 0.03, 0.1, 0.3, 1, 3, 10, 30, 100, 1000, 10000];
const MS_SN = [['0', 'нет'], ['1', 'низкое'], ['2', 'среднее'], ['3', 'высокое']], MS_SM = [0, 0.03, 0.08, 0.2];
// ракета проектируется отдельно: мощность 1–100 (суммарный урон по броне; чем больше, тем шире воронка), двигатель (тонны) → скорость, топливо (тонны) → дальность, сенсоры, самонаведение
export const mkMis2 = (pw, en, fu, em, ir, ac, hm, mt) => {
  const wh = 0.05 * pw, sn = MS_SM[em] + MS_SM[ir] + MS_SM[ac] * 1.5, dry = wh + en + sn + 0.05, tons = dry + fu, spd = Math.round((3 + 15 * en / (en + 0.6 * (tons - en))) * 10) / 10;
  const r = fu / dry, rng = Math.max(1, Math.min(1e6, Math.round(1000 * r * r))), am = Math.max(1, Math.floor(mt / tons));
  return {tons: Math.round(tons * 1000) / 1000, hp: 1 + Math.floor(Math.log10(1 + dry * 2)), spd, dmg: pw, blast: Math.round((3 + 2.3 * Math.sqrt(pw)) * 10) / 10, ammo: am, rng, rel: 0.5 * (1 + pw / 6), fl: 1, hm: !!hm && (em + ir + ac) > 0, sl: {em, ir, ac}, pw, en, fu};
};
COMP.missile.opts = [O('pw', 'Мощность боеголовки (1–100)', '10', MS_PW.map(v => [String(v), String(v)])), O('en', 'Двигатель, т', '1', MS_EN.map(v => [String(v), v + ' т'])), O('fu', 'Топливо, т', '1', MS_FU.map(v => [String(v), v + ' т'])),
  O('em', 'ЭМ-сенсор', '1', MS_SN), O('ir', 'Тепловой сенсор', '1', MS_SN), O('ac', 'Активный (радар)', '0', MS_SN), O('hm', 'Самонаведение', '1', [['1', 'есть'], ['0', 'нет (летит по прямой)']]),
  O('mt', 'Объём погреба, т', '20', [['5', '5'], ['10', '10'], ['20', '20'], ['50', '50'], ['100', '100'], ['500', '500'], ['2000', '2000']])];
COMP.missile.ap = (c, s) => {
  const mt = +s.mt.v, M = mkMis2(+s.pw.v, +s.en.v, +s.fu.v, +s.em.v, +s.ir.v, +s.ac.v, s.hm.v === '1', mt);
  c.mcfg = M; c.mass = Math.round(mt * 1.2 * 10) / 10;
  c.cost = {fe: (Math.round(mt * 1.2)) + (Math.round(mt * .8)), ti: Math.round(mt * .4), si: Math.round(mt * .4 + M.ammo)}; c.name = `Ракеты ${M.pw} ед. ×${M.ammo}`;
  const rn = n => n >= 1e3 ? Math.round(n / 1e3) + ' тыс.' : n;
  c.desc = `ракета ${M.tons} т (в погребе ${mt} т → ${M.ammo} шт.), мощность ${M.pw}, воронка ~${Math.round(M.blast)}, скорость ${M.spd}, дальность ${rn(M.rng)} км, ${M.hm ? 'самонаведение: ЭМ ' + MS_SN[+s.em.v][1] + ', тепло ' + MS_SN[+s.ir.v][1] + ', радар ' + MS_SN[+s.ac.v][1] : 'без самонаведения — летит по прямой в расчётную точку'}`;
};
export const STAT_OUT = {build: 'Строительство', yard: 'Судостроение', plant: 'Заводы (сырьё)', fuel: 'Заправка кораблей', spares: 'Тех. изделия кораблям', raid: 'Потери от налётов', pop: 'Продажа сырья заводам Земли', old: 'Прочее'};

/* ===== ВОДОИЗМЕЩЕНИЕ ===== */
// боевые модули тяжелее в 150 раз; длина корабля: 1 м на каждые 50 т (50 000 т = 1 км); слой брони весит ~925 т на км² поверхности
export const SHIP_CAP = 300000;
export { KR } from './00-kr.ts';
export const TONS_K = 150, TON_L = 50000, ARM_K = 250; // TONS_K — только для срока постройки
export const FGT_T = {l: 200, s: 350, h: 500}, BMB_T = {l: 250, s: 400, h: 500}; // истребитель/торпедоносец влезает в 500 т
export const specTons = sp => sp.tons || Math.round(TON_L * (sp.L || .5) / 100) * 100;
// корабль ИИ собирается из тех же модулей: тоннаж = (модули × накладные: корпус, реактор, жильё, припасы + броня по площади) / (1 − доля двигателей); длина = т / 50 000
export const HULLK = 4.5, ENGF = .049;
export function fitSpec(sp) {
  if (sp.tons) return sp;
  sp.L0 = sp.L;
  if (sp.role === 'freight' || sp.role === 'supply') { sp.tons = Math.round(TON_L * sp.L * .6 / 100) * 100; sp.L = Math.max(.06, sp.tons / TON_L); return sp; }
  const rc = (sp.railCfg && sp.railCfg[0]) || {cal: 10, bar: 1}, rm = (RAIL_CAL[rc.cal] || RAIL_CAL[10]).m * (1 + 1.03 * (rc.bar - 1)) * 1.25;
  let T = 0;
  for (let pass = 0; pass < 6; pass++) {
    const M = (sp.rails || 0) * rm + (sp.flak || 0) * 110 + gatMass(sp) + (sp.miss || 0) * 320 + ((sp.laserCfg && sp.laserCfg[0] && sp.laserCfg[0].mass) || 9000) * (sp.lasers || 0) + (sp.F || 0) * ((sp.fq && sp.fq.mass) || CR_DEF.F.mass) + (sp.B || 0) * ((sp.bq && sp.bq.mass) || CR_DEF.B.mass) + (sp.mar || 0) * 56 + 800;
    T = M * HULLK;
    for (let i = 0; i < 60; i++) { const L = T / TON_L; T = (M * HULLK + Math.min(M * HULLK * .7, ARM_K * (sp.arm || 0) * L * L)) / (1 - ENGF * (sp.spd || 1)); } // броня не тяжелее 70% остальной массы
    if (T <= SHIP_CAP || sp.super) break;
    const f = Math.max(.5, SHIP_CAP / T * .97); // серийный корабль не тяжелее ~300 тыс. т, лишнее вооружение убирается (миллион тонн — только сверхоружие)
    for (const k of ['rails', 'flak', 'gat', 'miss', 'lasers', 'F', 'B', 'mar']) if (sp[k]) sp[k] = Math.max(k === 'rails' ? 2 : 0, Math.round(sp[k] * f));
  }
  sp.tons = Math.round(T / 100) * 100; sp.L = Math.max(.06, T / TON_L); return sp;
}

// разбивка массы корабля по модулям: длина участка корпуса пропорциональна массе (50 т на метр), по ней строится внешний вид
export const gatMass = sp => (sp.gatCfg && sp.gatCfg.length) ? sp.gatCfg.reduce((a, c) => a + (c.mass || 25), 0) : (sp.gat || 0) * 25;
export function massParts(sp) {
  const T = sp.tons || specTons(sp), rc = sp.railCfg || []; let rails = 0;
  for (let i = 0; i < (sp.rails || 0); i++) { const c = rc[i] || {cal: 10, bar: 1}; rails += (RAIL_CAL[c.cal] || RAIL_CAL[10]).m * (1 + 1.03 * ((c.bar || 1) - 1)) * 1.25; }
  const o = {rail: rails, flak: (sp.flak || 0) * 110, gat: gatMass(sp), miss: (sp.miss || 0) * 320, laser: ((sp.laserCfg && sp.laserCfg[0] && sp.laserCfg[0].mass) || 9000) * (sp.lasers || 0), hangF: (sp.F || 0) * ((sp.fq && sp.fq.mass) || CR_DEF.F.mass), hangB: (sp.B || 0) * ((sp.bq && sp.bq.mass) || CR_DEF.B.mass), mar: (sp.mar || 0) * 56, core: 800};
  const sc = sp.scList || [], cnt = k => sc.filter(q => q.k === k).length, sm = {rad: cnt('rad') * 700, ir: cnt('ir') * 120, em: cnt('em') * 200, fcs: (sp.fcsN || 0) * 150, ew: (sp.ew || 0) * 300, dcon: (sp.dcon || 0) * 60, sink: (sp.sink || 0) * 120};
  const M = Object.values(o).reduce((a, b) => a + b, 0), S = M * (HULLK - 1); o.eng = sp.engT > 0 ? sp.engT : sp.real ? 0 : T * ENGF * (sp.spd || 1);
  // оценочная раскладка несущей массы по баку, реактору, жилым отсекам и каркасу (в конструкторе точного списка нет)
  o.tank = S * .3; o.reactor = S * .14; o.crew = S * .16; o.frame = S * .4; if (sp.real) { // настоящий проект: каждый метр корпуса — реальный модуль, никаких оценочных отсеков
    delete o.core; o.tank = 0; o.reactor = 0; o.crew = 0; o.frame = 0;
    for (const [k, n] of Object.entries(sp.parts || {})) { const c = compOf(k), b = baseOf(k); if (!c || !(n > 0) || !c.mass || c.armW) continue; const m = c.mass * n;
      if (b === 'tank') o.tank += m; else if (b === 'reactor') o.reactor += m; else if (b === 'cabin' || b === 'life' || b === 'marines') o.crew += m; else if (['cargo', 'ammo', 'xfer', 'repair', 'spares', 'lab_phys', 'lab_eng', 'lab_bio', 'hook'].includes(b)) o.frame += m; } }
  const L = T / TON_L, armor = Math.min(M * HULLK * .7, ARM_K * (sp.arm || 0) * L * L);
  return {T, parts: o, smalls: sm, armor};
}
// --- осевое крепление: орудие вварено в нос лицом вперёд (±10°), вес в 4,5 раза меньше, цена в 1,5 раза ниже, остальные параметры те же ---
for (const b of ['rail', 'gat', 'flak', 'lgun', 'missile']) {
  COMP[b].opts.push(O('mnt', 'Крепление', 't', [['t', 'турель'], ['a', 'осевое (вес ÷4,5, цена ÷1,5, только вперёд ±10°)']]));
  const ap0 = COMP[b].ap;
  COMP[b].ap = (c, s) => { ap0(c, s); if (s.mnt && s.mnt.v === 'a') { c.mass = Math.max(.1, Math.round(c.mass / 4.5 * 10) / 10); mulCost(c, 1 / 1.5); c.ax = 1;
    for (const k of ['rcfg', 'fcfg', 'gcfg', 'lcfg', 'mcfg']) if (c[k]) { c[k] = {...c[k], ax: 1}; if (c[k].mass != null) c[k].mass = c.mass; }
    c.name += ' · осевое'; c.desc = 'ОСЕВОЕ (в носу, ±10°, вес ÷4,5, цена ÷1,5): ' + c.desc; } };
}
// размер 0.01–50 для лёгких модулей: масса и цена растут как размер^0.8, дальность/каналы — медленнее
for (const b of ['radar', 'irs', 'ems', 'fcs', 'ew', 'dcon']) {
  const C = COMP[b], ap0 = C.ap; C.opts = [...(C.opts || []), ZS(1)];
  C.ap = (c, s) => { if (ap0) ap0(c, s); const z = +s.zs.v; c.mass = Math.max(0.05, Math.round(c.mass * Math.pow(z, 0.8) * 100) / 100); mulCost(c, Math.pow(z, 0.7)); if (c.scRng) c.scRng = Math.round(c.scRng * Math.pow(z, 0.25)); if (c.ew) c.ew = Math.max(0.05, c.ew * Math.pow(z, 0.5)); if (c.fcs) c.fcs = Math.max(1, Math.round(c.fcs * Math.pow(z, 0.5))); if (c.sink) c.sink = Math.max(0.05, c.sink * z); if (c.dcon) c.dcon = Math.max(0.05, c.dcon * z); if (z !== 1) c.desc += ` · размер ×${s.zs.v}`; };
}
// размер 0.01–50 для ёмкостей: вместимость ∝ размер, масса ∝ размер^0.9
for (const b of ['life', 'cargo', 'spares', 'laser']) {
  const C = COMP[b], ap0 = C.ap; C.opts = [...C.opts, ZS(1)]; if (b === 'laser') COMP.laser2.opts = C.opts;
  C.ap = (c, s) => { ap0(c, s); const z = s.zs ? +s.zs.v : 1; if (z === 1) return; scl(c, z);
    const ex = [c.fuel && `топливо ${Math.round(c.fuel * 100) / 100} т`, c.cargo && `груз ${Math.round(c.cargo * 100) / 100} т`, c.crew && `${c.crew} мест`, c.life && `жизнеобеспечение на ${c.life}`, c.mine && `добыча ${fmtN(c.mine * SHIP_ROCK)} т породы/сут`, c.spares && `${Math.round(c.spares)} тех. изделий`].filter(Boolean);
    c.desc = `Размер ×${s.zs.v}: ${ex.join(', ')}`; };
}
// трассер: цвет следа за кораблём; яркость и длина следа растут со скоростью
export const TRAIL_COL = {c: [.45, .8, 1], r: [1, .3, .25], g: [.4, 1, .45], y: [1, .85, .3], v: [.75, .45, 1], w: [1, 1, 1], o: [1, .55, .2]};
// обычный радиатор: панель 10 м², 100 кг; P = 2 × 0,9 × σ × 10 м² × T⁴ — при 500 K ≈ 64 кВт (0,64 МВт на тонну)
export const radP = TK => 2 * .9 * 5.67e-8 * 10 * Math.pow(TK, 4) / 1e6; // МВт на панель
COMP.sink.opts = [O('np', 'Панелей по 10 м²', '100', [10, 20, 50, 100, 200, 500, 1000, 2000].map(v => [String(v), String(v)]))];
COMP.sink.ap = (c, s) => { const n = +s.np.v; c.mass = n * .1; c.sinkMW = n * radP(500); c.sink = n / 100; c.cost = {fe: Math.round(n * .2), ti: Math.max(1, Math.round(n * .02))}; c.name = `Радиаторы ${n} панелей`; c.desc = `${n} панелей, ${fmtN(c.mass, 1)} т: отводят ${fmtN(c.sinkMW, 1)} МВт при 500 K`; };
// ядро корабля (таблица): 20 т, 5 человек, 1 МВт; ставится само на каждый корабль (не на истребители)
export const CORE = gd('modules', 'core', {mass: 20, crew: 5, mw: 1, frame: .08});
COMP.trail = {name: 'Трассер-генератор', desc: 'Цветной след за кораблём: чем быстрее корабль, тем ярче и длиннее', mass: 0.1, cost: {fe: 2}};
COMP.trail.opts = [O('col', 'Цвет', 'c', [['c', 'голубой'], ['r', 'красный'], ['g', 'зелёный'], ['y', 'жёлтый'], ['v', 'фиолетовый'], ['w', 'белый'], ['o', 'оранжевый']])];
COMP.trail.ap = (c, s) => { c.trail = s.col.v; c.desc = `След цвета «${s.col.l}»: ярче и длиннее на скорости`; };
/* ===== ПРОЕКТЫ ===== */
// flags: {station, tanker}
const IDLE_MW = {radar: 5, irs: .1, ems: .1, fcs: .5, ew: 2, hangar_f: 1, hangar_b: 1};
export function designStats(parts, flags) {
  flags = flags || {};
  const r = {dry:0, power:0, eff:1, fuelCap:0, cargoCap:0, mine:0, crewCap:0, lifeCap:0, lasers:0, tow:0, xfer:0, probe:0, repair:0, spareCap:0, labs:{phys:0, eng:0, bio:0}, labsTotal:0, railList:[], flakList:[], gatList:[], lasList:[], misList:[], lgun:0, msl:0, defl:0, fqS:{hp:0,v:0,am:0}, bqS:{hp:0,v:0},
    cost:{}, errors:[], warns:[], station: false, tanker: false, armor:0, rail:0, flak:0, gat:0, hangF:0, hangB:0, hangars:0, hangList:[], engines:0};
  let effSum = 0;
  for (const [k, n] of Object.entries(parts)) {
    const c = compOf(k); if (!c || !n) continue;
    r.dry += c.mass * n; r.armW = (r.armW || 0) + (c.armW || 0) * n;
    r.power += (c.power || 0) * n * tm('thrust'); if (c.power) r.fuelS = (r.fuelS || 0) + Math.pow(c.power * tm('thrust'), 2) * n * FUEL_K / Math.max(.05, c.eff || 1) * FUEL_S; r.engDraw = (r.engDraw || 0) + (c.elec ? (c.power || 0) * n * 0.5 : 0); if (c.power) r.engM = (r.engM || 0) + c.mass * n;
    { const th = c.thrust || (c.power ? c.power * 120000 : 0); if (th) { r.thrust = (r.thrust || 0) + th * n * tm('thrust'); r.ispW = (r.ispW || 0) + th * n / Math.max(1, c.isp || (c.eff || 1) * 1000); if (c.zs > engMax()) r.errors.push(`Двигатель ${c.zs} т больше доступного (${engMax()} т): изучите «Крупные двигатели».`); } }
    r.rcsT = (r.rcsT || 0) + (c.rcsT || 0) * n; r.benef = (r.benef || 0) + (baseOf(k) === 'benefm' ? n : 0); r.smeltY = (r.smeltY || 0) + (c.smeltY || 0) * n; r.acat = (r.acat || 0) + (c.acat || 0) * n; r.sinkMW = (r.sinkMW || 0) + (c.sinkMW || 0) * n; r.htMW = (r.htMW || 0) + (c.htMW || 0) * n; r.uYear = (r.uYear || 0) + (c.uYear || 0) * n;
    r.enIdle = (r.enIdle || 0) + (c.enIdle != null ? c.enIdle : IDLE_MW[baseOf(k)] || 0) * n; // энергия и тепло в корпус в обычном режиме (таблица)
    if (c.drop) { r.dropF = (r.dropF || 0) + c.fuel * n; r.dropM = (r.dropM || 0) + c.mass * n; } if (c.tankArm) r.tankArm = Math.max(r.tankArm || 0, c.tankArm); if (c.magArm) r.magArm = Math.max(r.magArm || 0, c.magArm); if (c.magEj) r.magEj = 1;
    if (c.armWw) r.armWw = (r.armWw || 0) + c.armWw * n;
    effSum += (c.power || 0) * (c.eff || 0) * n;
    r.fuelCap += (c.fuel || 0) * n;
    r.cargoCap += (c.cargo || 0) * n;
    r.mine += (c.mine || 0) * n;
    r.scList=r.scList||[];r.fcsN=(r.fcsN||0)+(c.fcs||0)*n;r.scCrew=(r.scCrew||0)+(c.crewN||0)*n;if(c.sc)for(let i=0;i<n;i++)r.scList.push({k:c.sc,rng:c.scRng,res:c.scRes,fine:c.scFine||0});r.ew=(r.ew||0)+(c.ew||0)*n;r.mar=(r.mar||0)+(c.mar||0)*n;r.dcon=(r.dcon||0)+(c.dcon||0)*n;r.sink=(r.sink||0)+(c.sink||0)*n;
    r.lasers += c.mine ? n : 0;
    r.crewCap += (c.crew || 0) * n;
    r.lifeCap += (c.life || 0) * n;
    r.tow += (c.tow || 0) * n;
    if (c.lab) { r.labs[c.lab] += n * (c.labw || 1); r.labsTotal += n; }
    if (c.rcfg) for (let i = 0; i < n; i++) r.railList.push(c.rcfg);
    if (c.fcfg) for (let i = 0; i < n; i++) r.flakList.push(c.fcfg);
    if (c.gcfg) for (let i = 0; i < n; i++) r.gatList.push(c.gcfg);
    if (c.lcfg) for (let i = 0; i < n; i++) r.lasList.push(c.lcfg);
    r.ammoCap = (r.ammoCap || 0) + (c.ammoCap || 0) * n; r.energy = (r.energy || 0) + (c.en || 0) * n;
    if (c.mcfg) for (let i = 0; i < n; i++) r.misList.push(c.mcfg);
    if (c.trail) r.trail = c.trail; if (c.fq && c.fq.trail) r.fqTrail = c.fq.trail; if (c.fq && c.fq.eng) { r.fqEng = c.fq.eng; r.fqArm = c.fq.arm; }
    r.lgun += (c.lgun || 0) * n; r.msl += (c.msl || 0) * n;
    if (c.defl) r.defl += c.defl * c.armor * n;
    if (c.fq) for (const k of CR_KEYS) r.fqS[k] = (r.fqS[k] || 0) + c.fq[k] * c.hangF * n;
    if (c.bq) for (const k of CR_KEYS) r.bqS[k] = (r.bqS[k] || 0) + c.bq[k] * c.hangB * n;
    r.xfer += (c.xfer || 0) * n; r.probe += (c.probe || 0) * n;
    r.armor += (c.armor || 0) * n; r.rail += (c.rail || 0) * n; r.flak += (c.flak || 0) * n; r.gat += (c.gat || 0) * n;
    if (c.hangD) r.hangList.push({ds: c.hangD, n: (c.hangN || 1) * n});
    r.hangF += (c.hangF || 0) * n; r.hangB += (c.hangB || 0) * n; r.hangars += (c.hangars || 0) * n; if (c.power) r.engines += n;
    r.repair += (c.repair || 0) * n;
    r.spareCap += (c.spares || 0) * n;
    for (const [rk, rv] of Object.entries(c.cost)) r.cost[rk] = (r.cost[rk] || 0) + rv * n;
  }
  // боевые корабли: двигатели питаются от реактора (0,5 МВт на единицу тяги) и берут энергию первыми, остаток идёт орудиям
  { const ws = r.rail + r.flak + r.gat + r.lgun + r.msl + r.hangF + r.hangB > 0, ed = r.engDraw || 0; r.engFactor = 1;
    if (ws && ed > 0) { r.powerNom = r.power; r.engFactor = Math.max(0.2, Math.min(1, (r.energy || 0) / ed)); effSum *= r.engFactor; r.power *= r.engFactor; }
    r.energyLeft = ws ? Math.max(0, (r.energy || 0) - ed) : (r.energy || 0); }
  r.eff = r.power ? effSum / r.power : 1;
  r.defl = r.armor ? r.defl / r.armor : 0;
  if (r.hangF) { r.fq = {}; for (const k of CR_KEYS) r.fq[k] = r.fqS[k] / r.hangF; if (r.fqTrail) r.fq.trail = r.fqTrail; if (r.fqEng) { r.fq.eng = r.fqEng; r.fq.arm = r.fqArm; } }
  if (r.hangB) { r.bq = {}; for (const k of CR_KEYS) r.bq[k] = r.bqS[k] / r.hangB; }
  r.fire = r.railList.reduce((a, q) => a + q.dmg * q.shells * 60 / (60 * q.rel), 0);
  r.jam = r.railList.length ? r.railList.reduce((a, q) => a + q.fail, 0) / r.railList.length : 0;
  r.station = !r.power; r.tanker = r.xfer > 0 && r.fuelCap > 0 && r.power > 0;
  const core = !flags.craft && !flags.station && r.dry > 0; if (core) { r.dry += CORE.mass; r.enIdle = (r.enIdle || 0) + CORE.mw; } // ядро корабля: мостик, компьютер, связь, навигация
  r.crewNeed = (r.scCrew||0) + 3 * (r.ew||0) + (r.mar||0) + 3 * (r.dcon||0) + (core ? CORE.crew : 2) + 2 * r.lasers + r.labsTotal + Math.ceil((r.flak + r.lgun + r.msl) / 10) + 30 * r.hangars; // ангар: 10 пилотов + 20 техников
  { const draw = r.railList.reduce((a, q) => a + (q.draw || 0), 0) + (r.lgun ? 800 : 0); r.draw = draw;
    if ((r.rail || r.gat) && !r.ammoCap) r.warns.push('Нет погреба боеприпасов: рельсотроны и пулемёты не смогут стрелять.');
    if (r.engFactor < 1) r.warns.push(`Реакторов не хватает двигателям: нужно ${r.engDraw} МВт, есть ${r.energy || 0} — тяга ${Math.round(r.engFactor * 100)}%, орудиям энергии не остаётся.`);
    else if (draw > 0 && (r.energyLeft || 0) < draw) r.warns.push(`После двигателей (${r.engDraw} МВт) на орудия остаётся ${r.energyLeft || 0} из ${draw} МВт — орудия будут перезаряжаться в ${Math.round(Math.max(.1, (r.energyLeft || 0) / draw) * 100)}% темпа.`); }
  if (r.lgun > 1) r.errors.push('Боевой лазер встраивается в центр корпуса: на корабль можно только один.');
  r.warship = r.rail + r.flak + r.gat + r.lgun + r.msl + r.hangF + r.hangB > 0;
  if (r.rail + r.flak + r.lgun + r.msl > 0) {
    if (!r.fcsN) r.warns.push('Нет системы управления огнём: орудия не смогут вести цели (только стрельба вблизи на глаз).');
    if (!(r.scList || []).some(q => q.k === 'rad')) r.warns.push('Нет активного радара: наводка возможна только по данным союзников или вблизи (до 1 км).');
    if (r.flak && !(r.scList || []).some(q => q.fine)) r.warns.push('Нет радара с мелким разрешением: зенитки и ПВО не увидят ракеты и истребители.');
  }
  { // таблица: каркас — 8% массы корабля; броня по площади корпуса ≈ 5 × (масса / 0,3)^(2/3) м²: слой стали 0,156 т/м² (2 см, держит 2 МДж/см²), вольфрама 0,19 т/м² (1 см, 5 МДж/см²)
    const M = Math.max(.1, r.dry), sl = r.armW || 0, wl = r.armWw || 0; let T = M / (1 - CORE.frame), A = 0;
    for (let i = 0; i < 60; i++) { A = 5 * Math.pow(T / .3, 2 / 3); T = (M + A * (sl * .156 + wl * .19)) / (1 - CORE.frame); }
    const aS = A * sl * .156, aW = A * wl * .19; r.armT = Math.round(aS + aW); r.area = Math.round(A); r.frameT = Math.round(T * CORE.frame); r.dry = Math.round(T * 10) / 10;
    if (aS) r.cost.fe = (r.cost.fe || 0) + Math.round(aS); if (aW) r.cost.w = (r.cost.w || 0) + Math.round(aW);
    r.armor = sl + 2.5 * wl; r.armSteel = sl; r.armTung = wl; // в бою слой вольфрама = 2,5 слоя стали по МДж/см²
    r.L = r.warship || sl + wl ? Math.max(0.08, Math.min(6, T / TON_L)) : Math.max(0.3, Math.min(3, 0.25 * Math.cbrt(r.dry))); }
  if (r.warship) { // турели не лепятся друг на друга: суммарная площадь стоек ≤ доли наружной обшивки (~0.5·L² · 0.55)
    let foot = 0, nt = 0; for (const [k, n] of Object.entries(parts)) { const c = compOf(k); if (!c || !n || !(c.rcfg || c.fcfg || c.gcfg || c.mcfg)) continue; const d = Math.max(c.mass / TON_L * .55, r.L * .0025) * 1.8; foot += d * d * n; nt += n }
    const cap = .27 * r.L * r.L; r.turCap = cap > 0 ? Math.round(100 * foot / cap) : 0;
    if (nt > 1 && foot > cap) r.errors.push(`Турели не помещаются на корпусе: заняли ${r.turCap}% доступной обшивки. Увеличьте корабль (броню/модули) или уберите часть орудий.`);
  }
  r.bspd = r.power ? (r.warship ? Math.max(0.5, Math.min(1.5, (r.power / Math.max(1, r.dry)) / 0.25)) : Math.max(0.5, Math.min(1.5, (r.power / Math.max(1, r.dry)) / 0.35))) : 1;
  if (r.warship && r.power && r.power / r.dry < 0.12) r.warns.push('Тяги мало для такого водоизмещения: корабль будет ползти. Добавьте двигатели (хорошо подходит размер «корабельный»).');
  r.buildDays = Math.max(1, Math.round((r.warship ? r.dry / TONS_K : r.dry) * 0.4));
  r.tons = r.dry;
  const massFull = r.dry + r.fuelCap;
  { const share = r.dry ? (r.engM || 0) / r.dry * 100 : 0, f = r.engFactor || 1; r.fuelRate = (r.fuelS || 0) * (1 - Math.min(.9, share / 100)) * f * f; } // т/с на полной тяге
  r.speedFull = r.power && r.dry ? r.power / (r.dry / 2) * 1000 * 86400 / AU_M : 0;
  if (r.thrust) { const isp = r.thrust / r.ispW, ve = isp * 9.81, m0 = r.dry + r.fuelCap, Fd = r.dropF || 0, Md = r.dropM || 0; // Циолковский, со сбросом внешних баков
    r.isp = Math.round(isp); r.dv = Math.round(ve * Math.log(m0 / Math.max(1e-6, m0 - Fd)) + ve * Math.log(Math.max(1e-6, m0 - Fd - Md) / Math.max(1e-6, r.dry - Md))); r.acc = Math.round(Math.min(40, r.thrust / (m0 * 1000)) * 10) / 10;
    if (r.thrust / (m0 * 1000) > 40) r.warns.push(`Ускорение ${fmtN(r.thrust / (m0 * 1000), 0)} м/с² больше 40 — экипаж выдержит только 40: часть тяги пропадёт.`); }
  { const heat = (r.enIdle || 0); if (!flags.craft && heat > (r.sinkMW || 0) * 1.0001 && r.dry > 0) r.warns.push(`Радиаторов мало: в обычном режиме ${fmtN(heat, 1)} МВт тепла, отводится ${fmtN(r.sinkMW || 0, 1)} — корпус будет нагреваться (0,5 МДж на т на °C, выше +100 °C сбои).`); }
  r.range = r.speedFull && r.fuelCap ? r.fuelCap / (r.fuelRate * 86400 / r.speedFull) : 0;
  if (flags.craft) { // истребитель: корабль до 500 т без собственных ангаров
    if (r.dry > FGT_MAX) r.errors.push(`Истребитель тяжелее ${FGT_MAX} т (сейчас ${Math.round(r.dry)} т).`);
    if (r.hangars) r.errors.push('Истребитель не может нести ангары.');
    if (!r.rail && !r.gat) r.warns.push('Без пушек истребитель никого не собьёт: поставьте рельсотрон или пулемёт (лучше осевое крепление — втрое легче).');
    if ((r.rail || r.gat) && !r.ammoCap) r.warns.push('Нет погреба: у истребителя не будет боезапаса.');
  }
  if (r.smeltY && !r.benef) r.warns.push('Плавильне нужен «Обогатитель»: без него плавить нечего.'); if (r.benef && !r.smeltY) r.warns.push('«Обогатитель» без «Плавильни» бесполезен.'); if (!r.benef) r.smeltY = 0; else r.smeltY = Math.min(r.smeltY, r.benef * 150000);
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
  r.cargoCap *= tm('cargo');
  return r;
}
export const stockOK = cost => Object.entries(cost).every(([k, v]) => (state.stock[k] || 0) >= v);

/* ===== НАЧАЛО ИГРЫ ===== */
export function newGame() {
  state = {
    t: 0, speedIdx: 5, spv: 2, paused: true,
    counters: {id: 0, ship: {}, station: {}},
    stock: {fe: 3600, ti: 600, si: 600, c: 500, ice: 0, pt: 60, ree: 80, u: 0, fuel: 2000, spares: 100, co: 400},
    bld: {gbuild: 100, mine: 100, benef: 100, smelt: 30, fuelplant: 1, supplies: 1, shipyard: 0, lab: 1}, build: [], sci: {phys: 0, eng: 0, bio: 0}, tech: {}, research: {}, tprog: {}, contracts: {}, rp: 0, sites: {}, marks: {},
    designs: [], groups: [], ships: [], stations: [], yard: [], log: [], ast: {}, officers: [], nextOfficer: 30,
    raid: {eta: 1e12, k: 0, warned: false}, inBattle: false, terra: {}, ground: JSON.parse(JSON.stringify(GROUND)),
  };
  wrapMoney(state);
  for (const b of BODIES) { if (b.ores) state.ast[b.id] = {...b.ores}; if (b.pool) state.sites[b.id] = {...b.pool}; }
  const miner = {ion: 2, [mkKey('tank', {tv: '100'})]: 1, cargo: 1, laser: 2, cabin: 2, life: 1, sink: 1};
  const D = (name, parts) => state.designs.push({id: uid(), name, parts, prio: {cmd: 0, eng: 0, pil: 0, min: 0}});
  // проекты по модулям таблицы: каюты и жизнеобеспечение под экипаж (ядро, двигатели, орудия) и радиаторы под тепло электроники добираются сами
  const fit = p => { p = {...p}; for (let i = 0; i < 12; i++) { const st = designStats(p); if (st.crewCap < st.crewNeed) { const d = st.crewNeed - st.crewCap, k = mkKey('cabin', {cv: d > 25 ? '100' : '25'}); p[k] = (p[k] || 0) + Math.ceil(d / (d > 25 ? 100 : 25)); }
      else if (st.lifeCap < st.crewNeed) p.life = (p.life || 0) + Math.ceil((st.crewNeed - st.lifeCap) / 10); else if ((st.enIdle || 0) > (st.sinkMW || 0) && !st.station) p.sink = (p.sink || 0) + Math.ceil(((st.enIdle || 0) - (st.sinkMW || 0)) / 6.4); else break; } return p; };
  const D2 = (name, parts) => D(name, fit(parts)), T100 = mkKey('tank', {tv: '100'});
  D('Шахтёр М1', miner);
  D2('Грузовик Г1', {ion: 2, [T100]: 1, cargo: 3, cabin: 1, life: 1});
  D2('Тягач Т1', {ion: 3, [T100]: 2, hook: 1, cabin: 1, life: 1});
  D2('Снабженец-танкер С1', {ion: 2, [T100]: 3, cargo: 2, xfer: 1, cabin: 1, life: 1});
  D2('Исследователь Н1', {ion: 3, [T100]: 2, cabin: 2, life: 1, lab_phys: 1, lab_eng: 1, lab_bio: 1});
  const IX = mkKey('ion', {pw: '500'}), TX = mkKey('tank', {tv: '2000'});
  const R15 = mkKey('rail', {cal: '15', bar: '2'}), R20 = mkKey('rail', {cal: '20', bar: '4'}), R10 = mkKey('rail', {cal: '10', bar: '1', cap: 'l'});
  const CH = mkKey('chem', {zs: '50', md: 's', al: 't'}), RE = p => mkKey('reactor', {p: String(p)}), AM = t => mkKey('ammo', {t: String(t)});
  D2('Эсминец Э1', {[IX]: 12, [TX]: 2, [R15]: 8, [RE(1000)]: 1, [AM(100)]: 1, armor: 3, radar: 1, fcs: 2, cabin: 1, life: 1});
  D2('Фрегат ПВО Ф1', {[IX]: 8, [TX]: 2, flak: 8, armor: 2, radar: 1, fcs: 2, cabin: 1, life: 1});
  D2('Сторож ПВО', {[CH]: 1, [mkKey('tank', {tv: '500'})]: 1, gat: 6, irs: 1, ems: 1, [mkKey('radar', {res: 'f'})]: 1, fcs: 2, [AM(25)]: 1, armor: 2, cabin: 1, life: 1});
  D2('Рельсотронщик', {[CH]: 2, [TX]: 2, [mkKey('rail', {cal: '15', bar: '1', cap: 'a'})]: 4, gat: 2, radar: 1, irs: 1, fcs: 2, dcon: 1, [RE(300)]: 2, [AM(100)]: 1, armor: 4, cabin: 1, life: 1});
  D2('Крейсер К1', {[IX]: 160, [TX]: 5, [R20]: 24, flak: 10, [RE(5000)]: 4, [AM(500)]: 1, armor: 5, radar: 1, fcs: 3, cabin: 3, life: 2});
  D2('Авианосец А1', {[IX]: 70, [TX]: 3, hangar_f: 3, hangar_b: 1, [R10]: 6, [AM(100)]: 1, armor: 3, radar: 1, fcs: 2, cabin: 3, life: 2});
  D('Перехватчик-кавалерист', CAV_PARTS());
  D('Боевой танкер', TANK_PARTS());
  D('Осевой рельсотронщик 30 см', AX30_PARTS());
  D('Станция «Опора»', {cargo: 3, [T100]: 2, spares: 2, xfer: 1, repair: 1, cabin: 1, life: 1});
  for (let i = 0; i < 12; i++) genOfficer();
  const g = newGroup('Добытчики');
  g.orders = [{type: 'mine', target: 'eros', res: 'all', pct: 100}, {type: 'home', base: 'nearest'}];
  g.loop = true;
  g.rules = [{cond: 'fuelhome', val: 130, base: 'nearest'}, {cond: 'cond', val: 25, base: 'nearest'}];
  createShip({name: 'Шахтёр М1', parts: miner}, g.id, staffFor(designStats(miner)).crew);
  log('Игра началась. «Добытчики» выполняют автодобычу на Эросе. Пока станций нет, они возвращаются на Землю. Нажмите ▶ или пробел.');
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

// перехватчик-кавалерист: 580 т с топливом, 20,7 м/с², 1 осевой рельсотрон 10 см, 2 слоя брони против пуль, штанга дозаправки; боевой танкер: 20 000 т топлива на передачу
export const CAV_PARTS = () => ({[mkKey('ion', {pw: '100', zs: '1', tune: 'n'})]: 5, [mkKey('reactor', {p: '100'})]: 1, [mkKey('tank', {tv: '25'})]: 3, [mkKey('ammo', {t: '5'})]: 1, [mkKey('rail', {cal: '10', bar: '1', ld: 'a', cap: 'a', saf: '0', mnt: 'a'})]: 1, probe: 1, fcs: 1, [mkKey('cabin', {cv: '5'})]: 3, life: 2, armor: 2});
export const TANK_PARTS = () => ({[mkKey('ion', {pw: '500'})]: 4, [mkKey('reactor', {p: '1000'})]: 1, [mkKey('tank', {tv: '2000'})]: 10, xfer: 1, gat: 2, [mkKey('ammo', {t: '25'})]: 1, fcs: 1, armor: 1, [mkKey('cabin', {cv: '25'})]: 2, life: 4});
// осевой рельсотронщик: ~2 100 т, с радаром, один осевой рельсотрон 30 см (перезарядка медленная — реактор 300 МВт)
export const AX30_PARTS = () => ({[mkKey('ion', {pw: '100', zs: '1', tune: 'n'})]: 10, [mkKey('reactor', {p: '300'})]: 1, [mkKey('tank', {tv: '100'})]: 1, [mkKey('ammo', {t: '25'})]: 1, [mkKey('rail', {cal: '30', bar: '1', ld: 'a', cap: 'a', saf: '0', mnt: 'a'})]: 1, fcs: 1, radar: 1, armor: 2, [mkKey('cabin', {cv: '25'})]: 1, life: 3});
/* ===== ИСТРЕБИТЕЛИ КАК НАСТОЯЩИЕ КОРАБЛИ ===== */
export const FGT_MAX = 500;
export const CR_PRE = {
  'p:l': {name: 'Перехватчик (лёгкий)', parts: {[mkKey('ion', {pw: '100', zs: '1', tune: 'n'})]: 4, [mkKey('reactor', {p: '50'})]: 1, [mkKey('tank', {tv: '25'})]: 1, [mkKey('ammo', {t: '5'})]: 1, [mkKey('rail', {cal: '5', bar: '1', ld: 'a', cap: 'a', saf: '0', mnt: 'a'})]: 3, [mkKey('cabin', {cv: '5'})]: 1, [mkKey('life', {zs: '0.5'})]: 1, armor: 2}},
  'p:s': {name: 'Истребитель (обычный)', parts: {[mkKey('ion', {pw: '100', zs: '1', tune: 'n'})]: 6, [mkKey('reactor', {p: '100'})]: 1, [mkKey('tank', {tv: '25'})]: 1, [mkKey('ammo', {t: '25'})]: 1, [mkKey('rail', {cal: '5', bar: '1', ld: 'a', cap: 'a', saf: '0', mnt: 'a'})]: 5, [mkKey('cabin', {cv: '5'})]: 1, [mkKey('life', {zs: '0.5'})]: 1, armor: 4}},
  'p:h': {name: 'Штурмовик (тяжёлый)', parts: {[mkKey('ion', {pw: '100', zs: '1', tune: 'n'})]: 8, [mkKey('reactor', {p: '100'})]: 1, [mkKey('tank', {tv: '25'})]: 1, [mkKey('ammo', {t: '25'})]: 1, [mkKey('rail', {cal: '10', bar: '1', ld: 'a', cap: 'a', saf: '0', mnt: 'a'})]: 3, [mkKey('cabin', {cv: '5'})]: 1, [mkKey('life', {zs: '0.5'})]: 1, armor: 8}},
};
const _small = {}; let _smallBusy = false;
// в ангар можно поставить любой проект до 500 т без собственных ангаров: истребитель, шахтёр, разведчик
const smallDesign = d => { if (d.craft) return true; const k = JSON.stringify(d.parts); if (k in _small) return _small[k]; if (_smallBusy) return false; _smallBusy = true; try { const st = designStats(d.parts); return _small[k] = st.dry > 0 && st.dry <= FGT_MAX && !st.hangars; } catch (e) { return false; } finally { _smallBusy = false; } };
export const craftList = () => [...Object.entries(CR_PRE).map(([id, v]) => ({id, name: v.name, parts: v.parts})), ...((() => { try { return state.designs || []; } catch (e) { return []; } })().filter(smallDesign))];
export const craftById = id => craftList().find(d => d.id === id) || craftList()[1];
const _crMemo = {};
export const craftStats = d => d.id && d.id.startsWith('p:') ? (_crMemo[d.id] = _crMemo[d.id] || designStats(d.parts, {craft: true})) : designStats(d.parts, {craft: true});
// параметры боевого аппарата из реального проекта: скорость, прочность, пушки и запасы берутся из деталей
export function craftFromStats(st) {
  const mps = (st.speedFull || 0) * AU_M / 86400, vmax = Math.min(12, Math.max(0.5, mps / 1000 * 5));
  const burn = st.fuelRate > 0 && st.fuelCap ? st.fuelCap / st.fuelRate : 1200; // секунд полной тяги
  let dps = 0, ng = 0, rng = 0;
  for (const q of st.railList) { dps += q.dmg * q.shells / Math.max(0.2, 60 * q.rel); ng++; rng = Math.max(rng, q.rng * 0.1); }
  for (const q of st.gatList) { dps += 1.2; ng++; rng = Math.max(rng, 4); }
  ng = Math.min(8, ng); const cd = 0.8, dmg = ng ? dps * cd / ng : 0;
  return {n: 10, hp: Math.max(3, Math.min(40, Math.round(3 + (st.armor || 0) * 1.5 + st.dry / 50))), vmax, a: vmax * .125, fuel: Math.max(120, Math.min(3600, burn)), ammo: Math.min(600, Math.round((st.ammoCap || 0) * 10)), ng, dmg, cd, gun: Math.max(3, Math.min(9, rng)), mass: Math.round(st.dry), torp: 0, trail: st.trail || null, mps: Math.round(mps), eng: Math.max(1, st.engines || 1), arm: st.armor || 0};
}
// ангар теперь вмещает настоящие истребители из проекта
export function syncCraftOpts() { const o = COMP.hangar_f.opts[0]; o.vals = craftList().map(d => ({v: d.id, l: d.name})); }
COMP.hangar_f.opts = [{id: 'ds', name: 'Проект истребителя', def: 'p:s', dyn: true, vals: []}, {id: 'nn', name: 'Число в ангаре', def: '10', num: {min: 1, max: 200}}];
syncCraftOpts();
let _crDepth = 0;
COMP.hangar_f.ap = (c, s) => {
  if (_crDepth > 1) { c.hangF = 1; c.fq = {...CR_DEF.F}; c.mass = 100; c.cost = {fe: 6}; return; }
  _crDepth++; try {
  const d = craftById(s.ds.v), st = craftStats(d), q = craftFromStats(st), n = Math.max(1, Math.round(+s.nn.v));
  q.n = n; c.hangF = n; c.fq = q; c.hangD = s.ds.v; c.hangN = n; c.mass = Math.round(n * q.mass + 200 * Math.ceil(n / 10)); // ангар 200 т на 10 машин (таблица) + сами машины c.cost = {fe: Math.round(n * 6), si: Math.round(n * 2), ti: Math.round(n * 1)};
  c.name = `Ангар: ${d.name}`; c.desc = `${n} × «${d.name}»: ${q.mass} т, ${q.mps} м/с, прочность ${q.hp}, пушек ${q.ng}, боезапас ${q.ammo}, ${Math.round(q.fuel / 60)} мин тяги`;
  if (st.errors.length) c.desc += ' · ОШИБКА проекта: ' + st.errors[0];
  } finally { _crDepth--; }
};
