// @ts-nocheck
// Регионы планет и лун. Есть у всех тел из 'planet'/'moon' и у Земли; число растёт с диаметром (Земля 8, Марс 4, Луна 2, мелочь 1).
// Регион хранит: людей (n), вес рабочих мест (jw), инфраструктуру (inf; на Земле не ограничивает).
// Месячный шаг: рабочие места тянутся к дешёвому труду, люди — к рабочим местам (миграция), на колониях — в пределах вместимости региона.
// Несовпадение людей и мест по регионам снижает укомплектованность заводов (regK); межрегиональные перевозки удлиняют плечо логистики.
import { BODY, state, log } from './01-data.ts';
import { climateBase } from './14-climate.ts';

const ED = 12742;
// диаметры, км
const DIAM = {earth: 12742, mars: 6779, venus: 12104, mercury: 4879, luna: 3474, phobos: 22, deimos: 12, ceres: 940, vesta: 525, eros: 17, apophis: .37, bennu: .49, ryugu: .9,
  io: 3643, europa_j: 3122, ganymede: 5268, callisto: 4821, titan: 5150, enceladus: 504, triton: 2707, pluto: 2377};
export const diamOf = id => { const k = (BODY[id] || {}).kind; return DIAM[id] || (k === 'planet' ? 6000 : k === 'moon' ? 1000 : k === 'ast' ? 5 : 1); };
// Земля 2030. p — доля населения, j — доля промышленных мест, a — суша (млн км²), coast — низкие побережья, t — средняя/мин/макс °C,
// desert/cold/hot — доли пустынь, мерзлоты и тропических низин, mtn — горы, wl — уровень зарплат, amp — во сколько раз регион греется быстрее планеты
const EARTH = [
  {n: 'Северная Америка', p: .046, j: .055, a: 21.8, coast: .3, t: [6, -40, 45], desert: .1, cold: .3, hot: .1, mtn: .25, wl: 2.2, amp: 1.6, note: 'Ураганы на побережье Мексиканского залива, лесные пожары на западе.'},
  {n: 'Южная Америка', p: .08, j: .075, a: 17.8, coast: .35, t: [21, -10, 44], desert: .08, cold: .02, hot: .65, mtn: .2, wl: .8, amp: 1.3, note: 'Амазония и Чако: огромные жаркие низины. Анды.'},
  {n: 'Европа', p: .087, j: .095, a: 10, coast: .4, t: [9, -35, 43], desert: 0, cold: .1, hot: .05, mtn: .15, wl: 1.8, amp: 1.5, note: 'Низкие побережья Нидерландов и Венеции, засухи на юге.'},
  {n: 'Африка', p: .2, j: .165, a: 30.3, coast: .2, t: [25, -5, 50], desert: .4, cold: 0, hot: .5, mtn: .1, wl: .45, amp: 1.3, note: 'Сахара и Сахель; самое быстрорастущее население.'},
  {n: 'Ближний Восток', p: .053, j: .05, a: 11, coast: .25, t: [20, -25, 52], desert: .55, cold: .05, hot: .4, mtn: .3, wl: 1, amp: 1.5, note: 'Уже сейчас летом +50 °C; дефицит воды.'},
  {n: 'Азия', p: .28, j: .3, a: 16, coast: .45, t: [13, -40, 45], desert: .15, cold: .15, hot: .3, mtn: .3, wl: 1, amp: 1.4, note: 'Дельты рек и мегаполисы у моря, тайфуны, пустыня Гоби.'},
  {n: 'Индия', p: .248, j: .24, a: 5.1, coast: .35, t: [25, -20, 49], desert: .1, cold: .03, hot: .6, mtn: .15, wl: .55, amp: 1.3, note: 'Муссоны, жара в Индо-Гангской равнине, дельта Ганга.'},
  {n: 'Океания', p: .006, j: .008, a: 8.5, coast: .6, t: [21, -5, 49], desert: .45, cold: 0, hot: .4, mtn: .05, wl: 2, amp: 1.2, note: 'Пустынный центр Австралии, тонущие атоллы.'}];
const NAMES = {
  mars: ['Фарсида', 'Эллада', 'Утопия', 'Аравия'],
  venus: ['Земля Иштар', 'Земля Афродиты', 'Земля Лады', 'Область Бета', 'Равнина Атланты', 'Область Фемиды', 'Область Альфа', 'Равнина Ниобы'],
  mercury: ['Равнина Жары', 'Северные равнины', 'Южные кратеры'],
  luna: ['Видимая сторона', 'Обратная сторона'],
  titan: ['Ксанаду', 'Шангри-Ла', 'Море Кракена'],
  ganymede: ['Область Галилея', 'Область Мариуса', 'Полярные шапки'],
  callisto: ['Вальхалла', 'Асгард', 'Ледяные равнины'],
  io: ['Пелея', 'Локи'], europa_j: ['Хаос Коннемары', 'Линии Аргадны'], triton: ['Дынная равнина', 'Южная шапка'],
};
const hemi = n => n === 1 ? ['Всё тело'] : n === 2 ? ['Северное полушарие', 'Южное полушарие']
  : ['Северная полярная', 'Южная полярная', ...Array.from({length: n - 2}, (_, i) => 'Экваториальная ' + (i + 1))];
const hash = (s, i) => { let h = 2166136261; for (const ch of s + i) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return ((h >>> 0) % 1000) / 1000; };

export const regCount = id => id === 'earth' ? 8 : Math.max(1, Math.min(12, Math.round(8 * diamOf(id) / ED)));
// Шаблон регионов тела (не сохраняется: детерминирован)
export function regTemplate(id) {
  const D = diamOf(id), A = Math.PI * D * D;
  if (id === 'earth') { const s = EARTH.reduce((a, r) => a + r.a, 0); return EARTH.map(r => ({...r, p0: r.p, j0: r.j, area: A * r.a / s, land: r.a * 1e6})); }
  const n = regCount(id), nm = NAMES[id] && NAMES[id].length === n ? NAMES[id] : hemi(n);
  const w = nm.map((_, i) => .6 + .8 * hash(id, i)), ws = w.reduce((a, b) => a + b, 0);
  return nm.map((x, i) => { const pol = /полярн|шапк/i.test(x), eq = /экватор/i.test(x);
    return {n: x, p0: i === 0 ? 1 : 0, j0: i === 0 ? 1 : 0, area: A * w[i] / ws, land: A * w[i] / ws, coast: 0, desert: 0, cold: 0, hot: 0, mtn: .1 + .3 * hash(id + 'm', i), wl: 1, amp: 1, lat: pol ? -.35 : eq ? .1 : 0,
      note: pol ? 'Полярные шапки: лёд — запас воды.' : ''}; });
}
// Регионы колонии: создаются при первом обращении (в т. ч. в старых сохранениях)
export function regsOf(id) {
  const col = state.cols && state.cols[id]; if (!col) return null;
  if (!col.reg || col.reg.length !== regTemplate(id).length) {
    const T = regTemplate(id), N = col.pop.n || col.pop.T0 || 0, inf = col.infra || 0;
    col.reg = T.map(r => ({n: N * r.p0, jw: r.j0, inf: inf * r.p0, mig: 0}));
  }
  return col.reg;
}
const per = (col) => col.infra > 0 && col.pop.hab ? col.pop.hab / col.infra : 0;
export const regHab = (id, i) => { const col = state.cols[id], R = regsOf(id); return col.pop.hab ? R[i].inf * per(col) : Infinity; };

// Плечо доставки с учётом регионов: внутри региона коротко, между регионами — через всё тело
const D0 = 1, LAM = .2, X0 = .4; // доля межрегиональных перевозок: Земля на старте ≈ прежнему плечу (~1 150 км)
export function regLegDist(id, N, rho) {
  const D = diamOf(id), R = state.cols && state.cols[id] && regsOf(id), T = regTemplate(id);
  if (!R || R.length < 2) { const A = Math.PI * D * D; return D0 + LAM * Math.PI * D / 4 * Math.min(1, Math.sqrt(N / rho / A)); }
  const n = R.reduce((a, r) => a + r.n, 0) || 1, jw = R.reduce((a, r) => a + r.jw, 0) || 1;
  let din = 0, gap = 0;
  R.forEach((r, i) => { const Dr = Math.sqrt(T[i].area / Math.PI), ps = r.n / n; din += ps * (D0 + LAM * (1 + .5 * (T[i].mtn || 0)) * Math.PI * Dr / 4 * Math.min(1, Math.sqrt(r.n / rho / T[i].area))); gap += Math.abs(r.jw / jw - ps); });
  const x = Math.min(1, X0 + .25 * gap), far = D0 + LAM * Math.PI * D / 4;
  return (1 - x) * din + x * far;
}

// Климат региона сейчас: температуры и доля территории, где жить нельзя (пустыни, мерзлота, жара, затопление; без воздуха — вся)
export function regClim(id, i) {
  const T = regTemplate(id)[i], b = climateBase(id), d = (state.clim && state.clim[id]) || {}, dT = d.dT || 0, dTl = dT * (T.amp || 1);
  let mean, min, max;
  if (T.t) { mean = T.t[0] + dTl; min = T.t[1] + dTl * 1.2; max = T.t[2] + dTl * 1.5; } // зимы и пики жары меняются сильнее средней
  else { const A = b.amp || 0; mean = b.mean + (T.lat || 0) * A + dT; min = Math.max(b.min + dT, mean - A * .8); max = Math.min(b.max + dT, mean + A * .8); }
  const o2 = (b.gas && b.gas.o2) || 0, air = id === 'earth' || (b.p >= .5 && b.p <= 3 && o2 >= .15);
  const flG = .32 * (1 - Math.exp(-(d.sea || 0) / 25)) / .32; // доля «низких побережий», ушедших под воду
  const u = {desert: Math.min(.95, (T.desert || 0) * (1 + .05 * Math.max(0, dTl))), cold: T.t ? (T.cold || 0) * Math.max(0, 1 - dTl / 10) : clamp((-5 - mean) / 20, 0, 1),
    heat: (T.t ? (T.hot || 0) : 1) * clamp((max - 50) / 15, 0, 1), flood: clamp((T.coast || 0) * flG, 0, .9)};
  const total = air ? Math.min(.97, 1 - (1 - u.desert) * (1 - u.cold) * (1 - u.heat) * (1 - u.flood)) : 1;
  return {mean, min, max, dTl, air, u, total};
}
// Месячный шаг. J — рабочих мест всего, W — людей трудового возраста, dt — дни. Возвращает долю мест, которые реально можно занять.
export function regTick(id, P, J, W, dt, t) {
  const col = state.cols[id], R = regsOf(id); if (!R) return 1;
  const N = P.n || 0, y = dt / 360;
  let n = R.reduce((a, r) => a + r.n, 0);
  if (n <= 0) { const T = regTemplate(id); R.forEach((r, i) => { r.n = N * T[i].p0; }); n = N; }
  { const si = R.reduce((a, r) => a + r.inf, 0), ci = col.infra || 0; // инфраструктура, добавленная в обход addRegInfra (основание, сохранения)
    if (ci > si + 1e-9) addRegInfra(id, ci - si); else if (si > ci + 1e-9 && si > 0) for (const r of R) r.inf *= ci / si; }
  for (const r of R) r.n *= N / n; // рождения и смерти — пропорционально
  if (R.length < 2) { R[0].inf = col.infra || 0; R[0].ul = regClim(id, 0).total; if (t) { R[0].emp = t.emp; R[0].un = t.un; R[0].wg = 1; R[0].wage = P.wbill && t.emp ? P.wbill / t.emp : 0; } return 1; }
  // 0) климат: где жить стало нельзя (жара, море, пустыня), люди и заводы уходят в пригодные регионы
  const C = R.map((r, i) => regClim(id, i)), TT = regTemplate(id);
  if (!P.hab) R.forEach((r, i) => { const ul = C[i].total; if (r.ul == null) r.ul = ul; const du = ul - r.ul;
    if (du > 1e-6 && r.ul < 1) { const k = Math.min(1, du / (1 - r.ul)), q = r.n * k; r.n -= q; r.jw *= 1 - k; r.dis = (r.dis || 0) + q;
      const w = R.map((x, j) => j === i ? 0 : (1 - C[j].total) * Math.max(x.n, 1)), ws = w.reduce((a, b) => a + b, 0) || 1; R.forEach((x, j) => { x.n += q * w[j] / ws; }); }
    if (Math.floor(ul * 20) > Math.floor(r.ul * 20) && ul > .3) log(`Климат: ${TT[i].n} — жить нельзя уже на ${Math.round(ul * 100)}% территории, люди уезжают.`);
    r.ul = ul; });
  const jws = R.reduce((a, r) => a + r.jw, 0) || 1, wk = N > 0 ? W / N : .6;
  const jobs = R.map(r => J * r.jw / jws), wrk = R.map(r => r.n * wk), Wt = wrk.reduce((a, b) => a + b, 0) || 1, Jt = J || 1;
  // 1) рабочие места тянутся туда, где людей больше, чем мест (дешёвый труд); в пустые регионы — нет
  R.forEach((r, i) => { if (r.n > 0) r.jw = Math.max(1e-4, r.jw + (wrk[i] / Wt - jobs[i] / Jt) * jws * (P.hab ? 1 : .1) * y); }); // Земля ~10% разрыва в год, колонии (маленькие, новые заводы) — быстро
  // 2) миграция: из регионов, где мест мало, туда, где их много (до 2% населения в год), не выше вместимости
  const out = R.map((r, i) => Math.max(0, wrk[i] / Wt - jobs[i] / Jt) * N * .025 * y);
  const pull = R.map((r, i) => { const room = regHab(id, i) - r.n; return room > 0 ? (Math.max(0, jobs[i] / Jt - wrk[i] / Wt) + (r.n <= 0 ? .02 : 0)) * (1 - C[i].total * (P.hab ? 0 : 1)) : 0; });
  const ps = pull.reduce((a, b) => a + b, 0), mv = ps > 0 ? out.reduce((a, b) => a + b, 0) : 0;
  R.forEach((r, i) => { const q = Math.min(r.n * .02 * y, out[i]) * (ps > 0 ? 1 : 0); r.n -= q; r.mig = -q / y; });
  if (mv > 0) R.forEach((r, i) => { const q = mv * pull[i] / ps, room = regHab(id, i) - r.n, got = Math.max(0, Math.min(q, room)); r.n += got; r.mig += got / y; });
  { const s = R.reduce((a, r) => a + r.n, 0); if (s > 0) for (const r of R) r.n *= N / s; } // что не влезло — осталось дома
  // 3) сколько мест можно занять: в каждом регионе не больше, чем там людей с той же общей занятостью
  const e = Math.min(1, Jt / Wt); let ok = 0; // общую нехватку людей уже учла колония; здесь — только разнобой по регионам
  R.forEach((r, i) => { ok += Math.min(jobs[i], r.n * wk * e * 1.15); }); // до 15% нехватки регион закрывает сам (смены, поездки)
  regStats(R, TT, jobs, wrk, Jt, Wt, P, t, y);
  return clamp(ok / Math.min(Jt, Wt * e * 1.15), .3, 1);
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
// Занятые, безработные и средняя зарплата по регионам (сумма сходится с колонией)
function regStats(R, TT, jobs, wrk, Jt, Wt, P, t, y) {
  if (!t) return;
  const E = t.emp, emp = R.map((r, i) => Math.min(wrk[i] * .98, jobs[i] * E / Jt)), es = emp.reduce((a, b) => a + b, 0) || 1;
  R.forEach((r, i) => { r.emp = emp[i] * E / es; });
  const sur = R.map((r, i) => Math.max(0, wrk[i] - r.emp) + .02 * wrk[i]), ss = sur.reduce((a, b) => a + b, 0) || 1;
  R.forEach((r, i) => { r.un = t.un * sur[i] / ss; });
  // зарплаты: исходный уровень региона медленно (1%/год) сходится к среднему, плюс напряжённость рынка труда
  R.forEach((r, i) => { if (r.wl == null) r.wl = TT[i].wl || 1; r.wl += (1 - r.wl) * .01 * y;
    const ws = wrk[i] / Wt; r.wg = r.wl * clamp(1 + .5 * (ws > 0 ? (jobs[i] / Jt - ws) / ws : 0), .7, 1.4); });
  const ew = R.reduce((a, r) => a + r.wg * r.emp, 0) || 1, avg = P.wbill && E ? P.wbill / E : 0;
  R.forEach(r => { r.wg *= E / ew; r.wage = avg * r.wg; });
}

// Новая инфраструктура: в регион, выбранный игроком, иначе в самый тесный из заселённых
export function addRegInfra(id, q, ri) {
  const R = regsOf(id); if (!R) return;
  let i = ri != null && R[ri] ? ri : -1;
  if (i < 0) { let best = -1; R.forEach((r, k) => { const c = r.inf > 0 ? r.n / (r.inf * (per(state.cols[id]) || 1)) : r.n > 0 ? 9 : -1; if (c > best) { best = c; i = k; } }); }
  R[i].inf += q;
}
// Прибывшие поселенцы: в выбранный регион или туда, где больше свободного места
export function addRegPeople(id, q, ri) {
  const R = regsOf(id); if (!R) return;
  let i = ri != null && R[ri] ? ri : 0, best = -Infinity;
  if (ri == null) { const n = R.reduce((a, r) => a + r.n, 0) || 1, jw = R.reduce((a, r) => a + r.jw, 0) || 1;
    const rt = R.reduce((a, r, k) => a + Math.max(0, regHab(id, k) - r.n), 0) || 1;
    R.forEach((r, k) => { const room = regHab(id, k) - r.n; if (room <= 0) return; const sc = r.jw / jw - r.n / n + .5 * room / rt; if (sc > best) { best = sc; i = k; } }); } // туда, где есть работа и жильё
  R[i].n += q; if (R[i].jw < .05) R[i].jw = .05;
}
export const regNames = id => regTemplate(id).map(r => r.n);

