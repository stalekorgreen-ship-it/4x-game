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
// Товары как в таблице «Пояс»: энергия, топливо, металлы и компоненты, бытовые товары, роскошь, медицина, жильё, образование, услуги; вода и воздух — только вне Земли.
// ages — доля людей возраста (до N лет), которым нужен товар (образование); old — растёт с возрастом.
const ME = [0, .1, .4, .5];
export const GOODS_ALL = gd('goods', 'goods', {
  pow: {n: 'Энергия', kind: 'energy', mix: M2, t: 0, prod: 4.8, in: {c: 0.11, u: 7e-06, ch4: 0.02}, need: 0.072, na: [3000, 3000, 3000, 3000, 3000, 3000], naK: 2.4e-5, ww: 15},
  fuel: {n: 'Топливо', kind: 'energy', mix: M1, t: 1, prod: 0.27, in: {c: 1.5, pow: 0.05}},
  steel: {n: 'Сталь', kind: 'semi', mix: M1, t: 1, prod: 0.137, in: {fe: 1, c: 0.5, pow: 0.5}},
  alloy: {n: 'Сплавы', kind: 'semi', mix: M2, t: 1, prod: 0.05, in: {fe: 0.9, ti: 0.05, co: 0.02, w: 0.01, pow: 1}},
  elx: {n: 'Электроника', kind: 'semi', mix: M3, t: 1, prod: 0.0137, in: {si: 0.3, ree: 0.01, fe: 0.4, pow: 2}, need: 1.9e-05, na: [5000, 10000, 10000, 8000, 5000, 2000], naK: 1 / 3.6e8, ww: 10, ns: [.714, 1, 1.286, 1.714]},
  shipm: {n: 'Компоненты', kind: 'ind', mix: M3, t: 1, prod: 0.01, in: {alloy: 0.4, elx: 0.2, steel: 0.4, pow: 1}},
  spares: {n: 'Запчасти и припасы', kind: 'ind', mix: M2, t: 1, prod: 0.03, in: {steel: 0.6, alloy: 0.1, elx: 0.05, pow: 0.3}},
  infra: {n: 'Инфраструктура', kind: 'ind', mix: M1, t: 1, prod: 0.2, in: {steel: 0.6, si: 0.1, c: 0.3, pow: 0.2}},
  ammo: {n: 'Боеприпасы', kind: 'ind', mix: M2, t: 1, prod: 0.05, in: {steel: 0.5, w: 0.01, c: 0.2, pow: 0.2}},
  wear: {n: 'Бытовые товары', kind: 'cons', mix: M1, t: 1, prod: 0.055, in: {steel: 0.45, c: 0.35, si: 0.05, elx: 0.02, pow: 0.3}, need: 0.00035, na: [60000, 80000, 100000, 120000, 100000, 60000], naK: 1 / 3.6e8, ww: 15},
  lux: {n: 'Роскошь', kind: 'cons', mix: M4, t: 1, prod: 0.0027, in: {pt: 0.0005, alloy: 0.2, si: 0.05, pow: 0.5}, need: 2.7e-06, ns: [.375, 1, 2.5, 6.25], na: [200, 500, 1000, 1500, 1000, 300], naK: 1 / 3.6e8, ww: 5},
  house: {n: 'Жильё', kind: 'cons', mix: M1, t: 0, prod: 40, in: {steel: 3e-05, si: 1e-05, c: 1e-05}, need: 0.8, na: [1, 1, 1, 1, 1, 1], naK: 0.8, ww: 20},
  meds: {n: 'Медицина', kind: 'life', mix: M4, t: 0, prod: 40, in: {c: 3e-06}, need: 0.7, na: [1e6, 6e5, 6e5, 9e5, 1.5e6, 2.5e6], naK: 7e-7, ww: 15},
  edu: {n: 'Образование', kind: 'cons', mix: M4, t: 0, prod: 15, in: {pow: 0.002}, need: 1, ww: 15, ages: [[12, .8], [18, .9], [30, .2], [55, .02], [80, .005], [101, 0]]},
  exp: {n: 'Экспертное образование', kind: 'cons', mix: ME, t: 0, prod: 2, in: {pow: 0.005}, need: 1, ww: 5, ages: [[18, 0], [30, .05], [55, .01], [80, .001], [101, 0]]},
  serv: {n: 'Услуги', kind: 'cons', mix: M2, t: 0, prod: 40, in: {pow: 0.005}, need: 0.8, ns: [.6, 1, 1.4, 2]},
  water: {n: 'Вода', kind: 'life', mix: M1, t: 0, prod: 40, in: {ice: 0.0001, pow: 0.0002}, need: 0.9, space: true},
  air: {n: 'Воздух и газы', kind: 'life', mix: M1, t: 1, prod: 1, in: {ice: 1.2, pow: 0.01}, need: 0.00084, space: true},
  robot: {n: 'Роботы', kind: 'ind', mix: M4, t: 1, prod: 0.01, in: {shipm: 0.3, elx: 0.3, steel: 0.4, pow: 1}, tech: 'robots'},
}); // правится в data/goods.json
// Энергетика (таблица «Пояс»): ТЭС 2 000 МВт (3 млн т угля и нефти в год), АЭС 6 000 МВт (1 200 т урана), зелёная 600 МВт (без топлива и почти без людей).
// Завод-эквивалент энергии = 2 000 МВт (10 000 чел. ТЭС). k — эквивалентов на здание, wk — рабочих на эквивалент (доля от 10 000), in — сырьё на 1 МВт·ч.
export const PT = gd('goods', 'powTypes', {tps: {n: 'ТЭС', k: 1, wk: 1, in: {c: 0.1736}}, npp: {n: 'АЭС', k: 3, wk: 0.3333, in: {u: 2.31e-5}}, green: {n: 'Зелёная энергетика', k: 0.3, wk: 0, in: {}}});
export const PMIX0 = gd('goods', 'powMix0', {tps: 0.638, npp: 0.319, green: 0.043}); // доли выработки на старте (вкладка «расчеты»: ТЭС 9 000, АЭС 1 500, зелёная 2 000)
export function mixWk(m) { let s = 0, w = 0; for (const t in PT) { s += (m && m[t]) || 0; w += ((m && m[t]) || 0) * PT[t].wk; } return s > 0 ? w / s : 1; }
// рецепт энергии — по реальной смеси станций мира (m — эквиваленты по типам)
export function setPowMix(m) { const G = GOODS_ALL.pow; if (!G) return; let s = 0; for (const t in PT) s += m[t] || 0; if (!(s > 0)) return; const inn = {}; for (const t in PT) for (const r in PT[t].in) inn[r] = (inn[r] || 0) + PT[t].in[r] * (m[t] || 0) / s; G.in = inn; G.raw = Object.keys(inn).find(k => !GOODS_ALL[k]) || G.raw; G.wk = mixWk(m); }
// рабочих на завод-эквивалент: у энергии — по смеси станций владельца
export const wkOf = (g, mix) => g !== 'pow' ? 1 : mix ? mixWk(mix) : (GOODS_ALL.pow.wk != null ? GOODS_ALL.pow.wk : 1);
// Логистика тоже покупает товары: на 1 т·км
export const LOG_IN = {fuel: .00003, spares: .000004}; // т на 1 т·км: 30 г топлива, 4 г запчастей (износ машин)
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
