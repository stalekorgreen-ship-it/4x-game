// @ts-nocheck
// Реестр товаров: 25 обобщённых товаров поверх сырья, с рецептами.
// Единица товара = UT тонн (у всех одинаково), рецепт `in` — сколько единиц входа (товара) или «тонн-единиц» сырья на единицу выхода.
// need — потребность человека в сутки (только у того, что покупает население); ns — множители по 4 слоям; old — растёт с возрастом;
// space — нужно только вне Земли; tech — товар появляется после технологии (unlockGoods).
// Позже технологии добавляют товары и уникальные потребности через addGood().
export const UT = 10 / 1e6 / 30; // т на единицу: 1 млн человек при need=1 потребляет 10 т в месяц
const M1 = [.6, .3, .1, 0], M2 = [.4, .4, .15, .05], M3 = [.2, .4, .3, .1], M4 = [.1, .3, .4, .2];
export const GOODS_ALL = {
  // энергия и топливо
  pow:   {n: 'Электроэнергия', kind: 'energy', mix: M2, in: {u: .3, ch4: .3}, need: .8},
  fuel:  {n: 'Топливо', kind: 'energy', mix: M1, in: {ice: 1, pow: .2}},
  // полуфабрикаты
  steel: {n: 'Сталь', kind: 'semi', mix: M1, in: {fe: 1, pow: .3}},
  alloy: {n: 'Сплавы', kind: 'semi', mix: M2, in: {ti: .5, ni: .5, pow: .4}},
  plast: {n: 'Пластик', kind: 'semi', mix: M1, in: {ch4: .6, c: .4, pow: .2}},
  chem:  {n: 'Химия', kind: 'semi', mix: M2, in: {nh3: .5, n2: .3, co2: .2, pow: .2}},
  elx:   {n: 'Электроника', kind: 'semi', mix: M3, in: {si: .6, cu: .3, ree: .05, pow: .3}, need: .4},
  glass: {n: 'Стекло', kind: 'semi', mix: M1, in: {si: .8, pow: .3}},
  comp:  {n: 'Композиты', kind: 'semi', mix: M3, in: {c: .6, plast: .3, pow: .2}},
  opt:   {n: 'Оптика', kind: 'semi', mix: M4, in: {glass: .6, ree: .05, pow: .1}},
  batt:  {n: 'Аккумуляторы', kind: 'semi', mix: M2, in: {cu: .3, ni: .3, chem: .2, ree: .05}},
  // жизнеобеспечение (еды нет: гидропоника — рабочие места жизнеобеспечения)
  water: {n: 'Вода', kind: 'life', mix: M1, in: {ice: 1, pow: .1}, need: .9},
  air:   {n: 'Воздух и газы', kind: 'life', mix: M1, in: {ice: .3, co2: .3, pow: .3}, need: .5, space: true},
  meds:  {n: 'Медицина', kind: 'life', mix: M4, in: {chem: .4, plast: .1}, need: .7, old: true},
  // потребительские
  house: {n: 'Жильё', kind: 'cons', mix: M1, in: {steel: .4, glass: .2, plast: .2}, need: .8},
  wear:  {n: 'Одежда и быт', kind: 'cons', mix: M1, in: {plast: .4, chem: .2}, need: 1},
  tech:  {n: 'Бытовая техника', kind: 'cons', mix: M2, in: {elx: .3, steel: .3, plast: .2}, need: .5},
  lux:   {n: 'Роскошь', kind: 'cons', mix: M4, in: {pt: .05, alloy: .2, opt: .1}, need: .3, ns: [0, .3, 1, 3]},
  serv:  {n: 'Услуги', kind: 'cons', mix: M2, in: {pow: .1}, need: .8, ns: [.6, 1, 1.4, 2]},
  veh:   {n: 'Машины и транспорт', kind: 'cons', mix: M2, in: {steel: .5, batt: .2, mach: .2}, need: .2},
  // промышленные и военные
  mach:  {n: 'Механизмы', kind: 'ind', mix: M2, in: {steel: .5, alloy: .2, elx: .1}},
  spares:{n: 'Запчасти', kind: 'ind', mix: M2, in: {mach: .4, elx: .2}},
  infra: {n: 'Инфраструктура', kind: 'ind', mix: M1, in: {steel: .5, glass: .1, comp: .1}},
  shipm: {n: 'Модули кораблей', kind: 'ind', mix: M3, in: {alloy: .4, elx: .3, comp: .2}},
  ammo:  {n: 'Боеприпасы', kind: 'ind', mix: M2, in: {steel: .4, chem: .4}},
  // пример товара от технологии (не входит в 25): роботы — потрясение «роботы вместо людей»
  robot: {n: 'Роботы', kind: 'ind', mix: M4, in: {mach: .5, elx: .5, batt: .2}, tech: 'robots'},
};
// Логистика тоже покупает товары: на 1 т·км
export const LOG_IN = {fuel: 30, veh: 2, spares: 2};
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
export function gval(k) { if (VAL[k] != null) return VAL[k]; const G = GOODS_ALL[k]; let v = 1; for (const h in G.in) if (GOODS_ALL[h]) v += G.in[h] * gval(h); return (VAL[k] = v); }
