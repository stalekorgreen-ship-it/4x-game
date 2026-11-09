// @ts-nocheck
// Регионы планет и лун. Есть у всех тел из 'planet'/'moon' и у Земли; число растёт с диаметром (Земля 8, Марс 4, Луна 2, мелочь 1).
// Регион хранит: людей (n), вес рабочих мест (jw), инфраструктуру (inf; на Земле не ограничивает).
// Месячный шаг: рабочие места тянутся к дешёвому труду, люди — к рабочим местам (миграция), на колониях — в пределах вместимости региона.
// Несовпадение людей и мест по регионам снижает укомплектованность заводов (regK); межрегиональные перевозки удлиняют плечо логистики.
import { BODY, state } from './01-data.ts';

const ED = 12742;
// диаметры, км
const DIAM = {earth: 12742, mars: 6779, venus: 12104, mercury: 4879, luna: 3474, phobos: 22, deimos: 12, ceres: 940, vesta: 525, eros: 17, apophis: .37, bennu: .49, ryugu: .9,
  io: 3643, europa_j: 3122, ganymede: 5268, callisto: 4821, titan: 5150, enceladus: 504, triton: 2707, pluto: 2377};
export const diamOf = id => { const k = (BODY[id] || {}).kind; return DIAM[id] || (k === 'planet' ? 6000 : k === 'moon' ? 1000 : k === 'ast' ? 5 : 1); };
// Земля 2030: доля населения, условная доля промышленных рабочих мест, площадь суши (млн км²), доля побережья
const EARTH = [
  ['Северная Америка', .046, .055, 21.8, .3], ['Южная Америка', .08, .075, 17.8, .35], ['Европа', .087, .095, 10, .4], ['Африка', .2, .165, 30.3, .2],
  ['Ближний Восток', .053, .05, 11, .25], ['Азия', .28, .3, 16, .45], ['Индия', .248, .24, 5.1, .35], ['Океания', .006, .008, 8.5, .6]];
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
  if (id === 'earth') { const s = EARTH.reduce((a, r) => a + r[3], 0); return EARTH.map(([n, p, j, a, c]) => ({n, p0: p, j0: j, area: A * a / s, land: a * 1e6, coast: c})); }
  const n = regCount(id), nm = NAMES[id] && NAMES[id].length === n ? NAMES[id] : hemi(n);
  const w = nm.map((_, i) => .6 + .8 * hash(id, i)), ws = w.reduce((a, b) => a + b, 0);
  return nm.map((x, i) => ({n: x, p0: i === 0 ? 1 : 0, j0: i === 0 ? 1 : 0, area: A * w[i] / ws, land: A * w[i] / ws, coast: 0}));
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
  R.forEach((r, i) => { const Dr = Math.sqrt(T[i].area / Math.PI), ps = r.n / n; din += ps * (D0 + LAM * Math.PI * Dr / 4 * Math.min(1, Math.sqrt(r.n / rho / T[i].area))); gap += Math.abs(r.jw / jw - ps); });
  const x = Math.min(1, X0 + .25 * gap), far = D0 + LAM * Math.PI * D / 4;
  return (1 - x) * din + x * far;
}

// Месячный шаг. J — рабочих мест всего, W — людей трудового возраста, dt — дни. Возвращает долю мест, которые реально можно занять.
export function regTick(id, P, J, W, dt) {
  const col = state.cols[id], R = regsOf(id); if (!R) return 1;
  const N = P.n || 0, y = dt / 360;
  let n = R.reduce((a, r) => a + r.n, 0);
  if (n <= 0) { const T = regTemplate(id); R.forEach((r, i) => { r.n = N * T[i].p0; }); n = N; }
  { const si = R.reduce((a, r) => a + r.inf, 0), ci = col.infra || 0; // инфраструктура, добавленная в обход addRegInfra (основание, сохранения)
    if (ci > si + 1e-9) addRegInfra(id, ci - si); else if (si > ci + 1e-9 && si > 0) for (const r of R) r.inf *= ci / si; }
  for (const r of R) r.n *= N / n; // рождения и смерти — пропорционально
  if (R.length < 2) { R[0].inf = col.infra || 0; return 1; }
  const jws = R.reduce((a, r) => a + r.jw, 0) || 1, wk = N > 0 ? W / N : .6;
  const jobs = R.map(r => J * r.jw / jws), wrk = R.map(r => r.n * wk), Wt = wrk.reduce((a, b) => a + b, 0) || 1, Jt = J || 1;
  // 1) рабочие места тянутся туда, где людей больше, чем мест (дешёвый труд); в пустые регионы — нет
  R.forEach((r, i) => { if (r.n > 0) r.jw = Math.max(1e-4, r.jw + (wrk[i] / Wt - jobs[i] / Jt) * jws * (P.hab ? 1 : .1) * y); }); // Земля ~10% разрыва в год, колонии (маленькие, новые заводы) — быстро
  // 2) миграция: из регионов, где мест мало, туда, где их много (до 2% населения в год), не выше вместимости
  const out = R.map((r, i) => Math.max(0, wrk[i] / Wt - jobs[i] / Jt) * N * .025 * y);
  const pull = R.map((r, i) => { const room = regHab(id, i) - r.n; return room > 0 ? Math.max(0, jobs[i] / Jt - wrk[i] / Wt) + (r.n <= 0 ? .02 : 0) : 0; });
  const ps = pull.reduce((a, b) => a + b, 0), mv = ps > 0 ? out.reduce((a, b) => a + b, 0) : 0;
  R.forEach((r, i) => { const q = Math.min(r.n * .02 * y, out[i]) * (ps > 0 ? 1 : 0); r.n -= q; r.mig = -q / y; });
  if (mv > 0) R.forEach((r, i) => { const q = mv * pull[i] / ps, room = regHab(id, i) - r.n, got = Math.max(0, Math.min(q, room)); r.n += got; r.mig += got / y; });
  { const s = R.reduce((a, r) => a + r.n, 0); if (s > 0) for (const r of R) r.n *= N / s; } // что не влезло — осталось дома
  // 3) сколько мест можно занять: в каждом регионе не больше, чем там людей с той же общей занятостью
  const e = Math.min(1, Jt / Wt); let ok = 0; // общую нехватку людей уже учла колония; здесь — только разнобой по регионам
  R.forEach((r, i) => { ok += Math.min(jobs[i], r.n * wk * e * 1.15); }); // до 15% нехватки регион закрывает сам (смены, поездки)
  return clamp(ok / Math.min(Jt, Wt * e * 1.15), .3, 1);
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));

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

