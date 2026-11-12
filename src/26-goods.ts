// @ts-nocheck
import { gd } from './00-gd.ts';
// Реестр товаров: 25 обобщённых товаров поверх сырья, с рецептами.
// Единица товара = UT тонн (у всех одинаково), рецепт `in` — сколько единиц входа (товара) или «тонн-единиц» сырья на единицу выхода.
// need — потребность человека в сутки (только у того, что покупает население); ns — множители по 4 слоям; old — растёт с возрастом;
// space — нужно только вне Земли; tech — товар появляется после технологии (unlockGoods).
// Позже технологии добавляют товары и уникальные потребности через addGood().
export const UT = 10 / 1e6 / 30; // старая единица (т): только для товаров без поля t
// Единая шкала (таблица «Пояс»): t — тонн в единице (0 — нематериальное), prod — единиц на рабочего в сутки. Материальные товары — в тоннах.
export const PROD_REF = 40; // прежняя выработка: на ней держится цена труда (40 кр за человеко-день)
export const prodOf = g => { const G = GOODS_ALL[g]; return G && G.prod > 0 ? G.prod : PROD_REF; };
// единица товара для подписи: т, МВт·ч (энергия) или «чел.-дн.» (услуги, медицина, жильё, вода)
export const unitOf = g => { const G = GOODS_ALL[g]; return !G ? '' : G.kind === 'energy' && G.t === 0 ? 'МВт·ч' : G.t === 0 ? 'чел.-дн.' : G.t === 1 ? 'т' : 'ед.'; };
export const tOf = g => { const G = typeof g === 'string' ? GOODS_ALL[g] : g; return G && G.t != null ? G.t : UT; };
const M1 = [.6, .3, .1, 0], M2 = [.4, .4, .15, .05], M3 = [.2, .4, .3, .1], M4 = [.1, .3, .4, .2];
export const GOODS_ALL = gd('goods', 'goods', {
  // энергия и топливо
  pow:   {n: 'Электроэнергия', kind: 'energy', mix: M2, t: 0, prod: 4.8, in: {c: 0.11, u: 7e-06, ch4: 0.02}, need: 0.072},
  fuel:  {n: 'Топливо', kind: 'energy', mix: M1, t: 1, prod: 0.27, in: {c: 1.5, pow: 0.05}},
  // полуфабрикаты
  steel: {n: 'Сталь', kind: 'semi', mix: M1, t: 1, prod: 0.137, in: {fe: 1, c: 0.5, pow: 0.5}},
  alloy: {n: 'Сплавы', kind: 'semi', mix: M2, t: 1, prod: 0.05, in: {fe: 0.9, ti: 0.05, ni: 0.05, pow: 1}},
  plast: {n: 'Пластик', kind: 'semi', mix: M1, t: 1, prod: 0.2, in: {c: 1.2, pow: 0.3}},
  chem:  {n: 'Химия', kind: 'semi', mix: M2, t: 1, prod: 0.2, in: {c: 0.5, n2: 0.3, nh3: 0.2, pow: 0.3}},
  elx:   {n: 'Электроника', kind: 'semi', mix: M3, t: 1, prod: 0.0137, in: {si: 0.2, cu: 0.1, ree: 0.01, fe: 0.3, pow: 2}, need: 1.9e-05},
  glass: {n: 'Стекло', kind: 'semi', mix: M1, t: 1, prod: 0.2, in: {si: 1, pow: 0.5}},
  comp:  {n: 'Композиты', kind: 'semi', mix: M3, t: 1, prod: 0.05, in: {c: 0.6, plast: 0.3, pow: 0.5}},
  opt:   {n: 'Оптика', kind: 'semi', mix: M4, t: 1, prod: 0.01, in: {glass: 0.6, ree: 0.005, pow: 0.5}},
  batt:  {n: 'Аккумуляторы', kind: 'semi', mix: M2, t: 1, prod: 0.05, in: {cu: 0.2, ni: 0.2, chem: 0.2, ree: 0.005, pow: 0.5}},
  // жизнеобеспечение (еды нет: гидропоника — рабочие места жизнеобеспечения)
  water: {n: 'Вода', kind: 'life', mix: M1, t: 0, prod: 40, in: {pow: 0.0002}, need: 0.9},
  air:   {n: 'Воздух и газы', kind: 'life', mix: M1, t: 1, prod: 1, in: {ice: 1.2, pow: 0.01}, need: 0.00084, space: true},
  meds:  {n: 'Медицина', kind: 'life', mix: M4, t: 0, prod: 40, in: {chem: 2e-06, plast: 1e-06}, need: 0.7, old: true},
  // потребительские
  house: {n: 'Жильё', kind: 'cons', mix: M1, t: 0, prod: 40, in: {steel: 3e-05, glass: 1e-05, plast: 1e-05}, need: 0.8},
  wear:  {n: 'Одежда и быт', kind: 'cons', mix: M1, t: 1, prod: 0.055, in: {plast: 0.4, chem: 0.2, steel: 0.3, pow: 0.2}, need: 0.00027},
  tech:  {n: 'Бытовая техника', kind: 'cons', mix: M2, t: 1, prod: 0.03, in: {elx: 0.1, steel: 0.5, plast: 0.3, pow: 0.3}, need: 3e-05},
  lux:   {n: 'Роскошь', kind: 'cons', mix: M4, t: 1, prod: 0.0027, in: {pt: 0.0005, alloy: 0.2, opt: 0.05, pow: 0.5}, need: 2.7e-06, ns: [0, .3, 1, 3]},
  serv:  {n: 'Услуги', kind: 'cons', mix: M2, t: 0, prod: 40, in: {pow: 0.005}, need: 0.8, ns: [.6, 1, 1.4, 2]},
  veh:   {n: 'Машины и транспорт', kind: 'cons', mix: M2, t: 1, prod: 0.04, in: {steel: 0.6, batt: 0.1, mach: 0.2, pow: 0.3}, need: 5.5e-05},
  // промышленные и военные
  mach:  {n: 'Механизмы', kind: 'ind', mix: M2, t: 1, prod: 0.03, in: {steel: 0.6, alloy: 0.2, elx: 0.05, pow: 0.5}},
  spares:{n: 'Запчасти', kind: 'ind', mix: M2, t: 1, prod: 0.03, in: {mach: 0.4, elx: 0.1, steel: 0.4, pow: 0.3}},
  infra: {n: 'Инфраструктура', kind: 'ind', mix: M1, t: 1, prod: 0.2, in: {steel: 0.5, glass: 0.1, comp: 0.1, c: 0.3, pow: 0.2}},
  shipm: {n: 'Модули кораблей', kind: 'ind', mix: M3, t: 1, prod: 0.01, in: {alloy: 0.4, elx: 0.2, comp: 0.2, steel: 0.2, pow: 1}},
  ammo:  {n: 'Боеприпасы', kind: 'ind', mix: M2, t: 1, prod: 0.05, in: {steel: 0.5, chem: 0.3, pow: 0.2}},
  // пример товара от технологии (не входит в 25): роботы — потрясение «роботы вместо людей»
  robot: {n: 'Роботы', kind: 'ind', mix: M4, t: 1, prod: 0.01, in: {mach: 0.5, elx: 0.3, batt: 0.2, pow: 1}, tech: 'robots'},
}); // правится в data/goods.json
// Логистика тоже покупает товары: на 1 т·км
export const LOG_IN = {fuel: .00003, veh: .000002, spares: .000002}; // т на 1 т·км: 30 г топлива, 2 г износа машин и запчастей
// Активные товары (без тех, что ждут технологию). Объект живой: addGood/unlockGoods дописывают в него.
export const GOODS = {};
for (const k in GOODS_ALL) if (!GOODS_ALL[k].tech) GOODS[k] = GOODS_ALL[k];
const prep = g => { g.raw = g.raw || Object.keys(g.in).find(k => !GOODS_ALL[k]) || null; g.need = g.need || 0; return g; };
for (const k in GOODS_ALL) prep(GOODS_ALL[k]);
export function addGood(id, def) { GOODS_ALL[id] = prep(def); if (!def.tech || def.on) GOODS[id] = def; ORDER = null; }
export function unlockGoods(techOn) { for (const k in GOODS_ALL) { const g = GOODS_ALL[k]; if (g.tech && !GOODS[k] && techOn(g.tech)) { GOODS[k] = g; ORDER = null; } } }
export const isGood = k => !!GOODS[k];
// порядок: товар идёт раньше своих входов (спрос сверху вниз по цепочке)
let ORDER = null;
export function goodsOrder() {
  if (ORDER) return ORDER;
  const seen = {}, out = [];
  const visit = k => { if (seen[k]) return; seen[k] = 1; for (const h in GOODS) if (GOODS[h].in[k] != null) visit(h); out.push(k); };
  for (const k in GOODS) visit(k);
  return (ORDER = out);
}
// базовая ценность единицы: труд (1) + ценность входных товаров по рецепту — цены растут вдоль цепочки
const VAL = {};
export function gval(k) { if (VAL[k] != null) return VAL[k]; const G = GOODS_ALL[k]; let v = PROD_REF / prodOf(k); /* труд: человеко-дни на единицу × цена человеко-дня */ for (const h in G.in) if (GOODS_ALL[h]) v += G.in[h] * gval(h); return (VAL[k] = v); }
