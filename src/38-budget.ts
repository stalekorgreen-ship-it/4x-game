// @ts-nocheck
// Бюджет (таблица «Пояс», вкладка «Бюджет»): доходы и расходы государства по статьям, в цифрах.
// Законы задают либо процент (налоги на зарплату, НДС, прибыль; наука и обязательные расходы — % бюджета), либо фиксированное число
// (ставки на здания и субсидии — кр в год на здание, налог на добычу и углеродный — кр за тонну, зарплаты учителей и врачей, пенсии, пособия — кр в сутки).
// Земной бюджет ваш в доле «на космос»; налоги и субсидии, которые касаются корпораций (прибыль, ставки, добыча, углерод, субсидии), идут целиком через вашу казну.
import { gd } from './00-gd.ts';
import { KR } from './00-kr.ts';
import { state, fmtN } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { PT } from './26-goods.ts';

// виды зданий для ставок и субсидий: [ключ, название, что считать у корпорации]
export const BTYPES = gd('economy', 'budgetTypes', [
  ['elx', 'Завод электроники'], ['wear', 'Завод бытовых товаров'], ['mine', 'Шахты'], ['lux', 'Завод роскоши'], ['tps', 'ТЭС'], ['npp', 'АЭС'], ['green', 'Зелёная энергетика'],
  ['fuel', 'Топливный завод'], ['clinic', 'Клиники'], ['school', 'Школы'], ['lab', 'Лаборатории'], ['dc', 'Дата-центры'], ['log', 'Логистические узлы'], ['house', 'Жильё (комплексы)'],
  ['cb', 'Строительные бюро (бригады)'], ['yard', 'Верфи']]);
// сколько зданий вида у корпорации (жильё — комплексами по 10 000 мест, клиники — по 400 000 человек)
export function countOf(v, k) {
  const f = v.fac || {}, m = v.pmix || {};
  switch (k) {
    case 'elx': case 'wear': case 'lux': case 'fuel': return f[k] || 0;
    case 'tps': case 'npp': case 'green': return (m[k] || 0) / (PT[k] ? PT[k].k : 1);
    case 'mine': return Object.values(v.mines || {}).reduce((a, b) => a + b, 0);
    case 'clinic': return (f.meds || 0) / .7; case 'school': return f.edu || 0; case 'house': return (f.house || 0) / .02;
    case 'lab': return Math.max(0, (v.labs || 0) - 5 * (v.dc || 0)); case 'dc': return v.dc || 0;
    case 'log': return Object.values(v.tr || {}).reduce((a, b) => a + b, 0); case 'cb': return v.cb || 0; case 'yard': return v.yard ? 1 : 0;
  } return 0;
}
// новые законы бюджета (по умолчанию — как было: ничего не взимается и не платится сверх старых законов)
export const BUDGET_LAWS = gd('economy', 'budgetLaws', {vat: 0, ptax: 0, carbon: 0, penFix: 0, childFix: 0, unemp: 0, wTeach: 0, wDoc: 0, sciPct: 0});
export const blaw = k => { const L = state.laws || {}; return L[k] != null ? L[k] : BUDGET_LAWS[k] != null ? BUDGET_LAWS[k] : 0; };
const corps = () => (state.corps || []).filter(c => c.civ);
const allCiv = c => [c.home || c.civ, ...Object.values(c.civs || {})].filter(Boolean);
// Месячный шаг бюджета Земли. P — население Земли, dt — дни. k — доля «на космос».
export function budgetTick(P, dt, k) {
  const y = dt / 360, B = {inc: {}, exp: {}}, add = (o, key, v) => { o[key] = (o[key] || 0) + v; };
  // --- доходы ---
  add(B.inc, 'Налог на зарплату', (P.taxFull || 0) * dt);
  const vat = blaw('vat') / 100; if (vat > 0) { let spend = 0; for (const g in P.dem) if (P.price && P.price[g] && P.sat) spend += (P.dem[g] || 0) * (P.sat[g] || 0) * P.price[g]; const v = spend * vat / (1 + vat) * dt; add(B.inc, 'НДС', v); state.money += v * k; }
  const pt = blaw('ptax') / 100;
  for (const c of corps()) {
    if (pt > 0 && (c.lastPm || 0) > 0) { const v = c.lastPm * pt; c.credits -= v; state.money += v; add(B.inc, 'Налог на прибыль', v); }
    for (const [key] of BTYPES) { const n = allCiv(c).reduce((a, v) => a + countOf(v, key), 0); if (!(n > 0)) continue;
      const lv = blaw('lev_' + key), sb = blaw('sub_' + key);
      if (lv > 0) { const v = lv * n * y; c.credits -= v; state.money += v; add(B.inc, 'Ставка: ' + key, v); }
      if (sb > 0) { const v = sb * n * y; if (state.money >= v) { state.money -= v; c.credits += v; add(B.exp, 'Субсидия: ' + key, v); } } }
    const ce = blaw('carbon'); if (ce > 0) { const tps = allCiv(c).reduce((a, v) => a + countOf(v, 'tps'), 0), co2 = tps * 7.5e6 * y; if (co2 > 0) { const v = co2 * ce; c.credits -= v; state.money += v; add(B.inc, 'Углеродный налог', v); } }
  }
  add(B.inc, 'Налог на добычу', state.mtaxInc ? state.mtaxInc - (state.mtaxPrev || 0) : 0); state.mtaxPrev = state.mtaxInc || 0;
  add(B.inc, 'Прибыль госпредприятий (выручка минус зарплаты и сырьё)', P.legPM || 0); P.legPM = 0;
  add(B.inc, 'Пошлины', (P.tarDay || 0) * dt);
  // --- расходы ---
  let ret = 0, un = 0; for (let s = 0; s < 4; s++) { for (let a = 65; a <= 100; a++) ret += P.c[s][a].n; for (let a = 15; a < 65; a++) un += P.c[s][a].un; }
  const pf = blaw('penFix'), uf = blaw('unemp'), cf = blaw('childFix');
  if (pf > 0) { const v = ret * pf * dt; add(B.exp, 'Обязательная пенсия', v); state.money -= v * k; }
  if (uf > 0) { const v = un * uf * dt; add(B.exp, 'Пособия по безработице', v); state.money -= v * k; }
  if (cf > 0) { const v = (P.birth || 0) * y * cf; add(B.exp, 'Пособия семьям за рождение', v); state.money -= v * k; }
  const FWK = 10000, wt = blaw('wTeach'), wd = blaw('wDoc');
  if (wt > 0) { const n = ((P.fac.edu || 0) + (P.fac.exp || 0)) * FWK, v = n * wt * dt; add(B.exp, 'Зарплата учителей', v); state.money -= v * k; }
  if (wd > 0) { const n = (P.fac.meds || 0) * FWK, v = n * wd * dt; add(B.exp, 'Зарплата врачей', v); state.money -= v * k; }
  const total = Object.values(B.inc).reduce((a, b) => a + b, 0);
  const sp = blaw('sciPct') / 100; if (sp > 0) { const v = total * k * sp; if (state.money >= v) { state.money -= v; const pts = v / Math.max(1, hooks.rpCost ? hooks.rpCost() : 1e8); state.rp = (state.rp || 0) + pts; state.sciFund = pts / y; add(B.exp, 'Финансирование науки', v); } }
  add(B.exp, 'Обязательные расходы Земли', total * (hooks.mandK ? hooks.mandK() : 0));
  add(B.exp, 'Зарплаты гос. рабочих: ваши постройки (шахты, стройка, станции)', (state.bldWageDay || 0) * dt); add(B.exp, 'Зарплаты гос. рабочих: госшахты Земли', (state.lmWage || 0) * dt);
  add(B.exp, 'Образование, пенсии, рождаемость (старые законы)', (P.exp || 0) / Math.max(1e-9, k) * dt);
  state.budget = {inc: B.inc, exp: B.exp, k, days: dt, t: state.t};
  state.lawBase = {...(state.laws || {})};
  state.flow = {in: state.mIn || 0, out: state.mOut || 0, days: dt}; state.mIn = 0; state.mOut = 0;
}
// поправки к жизни населения: пенсии и пособия — к доходу, НДС — к цене корзины, рождаемость — от выплат
export const benefits = () => ({ret: blaw('penFix'), un: blaw('unemp'), vat: blaw('vat') / 100, birthK: 1 + .5 * Math.min(1, blaw('childFix') / (40000 * KR))});
// укомплектованность госшкол и госбольниц: фикс. зарплата ниже рыночной — часть мест пустует
export function govStaffK(g, P) { const w = g === 'meds' ? blaw('wDoc') : (g === 'edu' || g === 'exp') ? blaw('wTeach') : 0; if (!(w > 0) || !P.wage) return 1; const m = P.wage[2] || 1; return Math.max(.2, Math.min(1, w / m)); }
// таблица для вкладки «Государство»
export function budgetHtml() {
  const b = state.budget; if (!b) return '<div class="help">Бюджет появится после первого месяца.</div>';
  const m = 30 / Math.max(1, b.days), nm = x => x.startsWith('Ставка: ') || x.startsWith('Субсидия: ') ? x.split(': ')[0] + ': ' + ((BTYPES.find(t => t[0] === x.split(': ')[1]) || [, x])[1]) : x;
  const full = x => /^(Ставка|Субсидия|Налог на прибыль|Углеродный|Налог на добычу|Финансирование|Зарплаты гос. рабочих: ваши)/.test(x);
  const tb = (o, h, cl) => `<h3 style="margin:4px 0 2px;font-size:11px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted)">${h}</h3><table class="grid">${Object.entries(o).filter(([, v]) => Math.abs(v) >= 1).sort((a, c) => c[1] - a[1]).map(([kk, v]) => `<tr><td>${nm(kk)}</td><td class="n ${cl}">${fmtN(v * m)}</td><td class="n" style="color:var(--muted)">${/^Прибыль госпредприятий/.test(kk) ? '→ госсектор' : fmtN(v * m * (full(kk) ? 1 : b.k))}</td></tr>`).join('')}<tr style="font-weight:600"><td>Итого</td><td class="n ${cl}">${fmtN(Object.values(o).reduce((a, c) => a + c, 0) * m)}</td><td></td></tr></table>`;
  const inc = Object.values(b.inc).reduce((a, c) => a + c, 0) * m, exp = Object.values(b.exp).reduce((a, c) => a + c, 0) * m;
  const bal = (inc - exp) * b.k, bcl = bal >= 0 ? 'ok' : 'err';
  return `<div class="box" style="flex-direction:row;gap:12px;align-items:center"><span>Баланс (ваш)/мес:</span><b class="${bcl}" style="font-family:var(--mono);font-size:14px">${bal >= 0 ? '+' : ''}${fmtN(bal)} кр</b><span style="color:var(--muted);font-size:11px">доля ${fmtN(b.k * 100, 1)}%</span></div>` + tb(b.inc, 'Доходы', 'ok') + tb(b.exp, 'Расходы', 'err') + `<div class="help">Колонка «ваших» — с учётом доли на космос. Налог на прибыль, ставки, налог на добычу, углеродный налог и субсидии корпорациям идут целиком через вашу казну.</div>`;
}
hooks.budgetTick = budgetTick; hooks.benefits = benefits; hooks.govStaffK = govStaffK;
// Оценка: сколько закон k при значении v даёт вашей казне в месяц (+ доход, − расход). null — оценить нельзя.
// Отталкивается от прошлого месяца: state.lawBase — значения законов, при которых он считался.
export function lawEff(k, v) {
  const b = state.budget, P = state.pop; if (!b || !P) return null;
  const m = 30 / Math.max(1, b.days), K = b.k, base = state.lawBase || {}, bv = base[k] != null ? base[k] : v;
  const inc = Object.values(b.inc).reduce((a, c) => a + c, 0) * m, sc = (x) => bv > 0 ? x * v / bv : null;
  const cs = corps(), cnt = key => cs.reduce((a, c) => a + allCiv(c).reduce((s, q) => s + countOf(q, key), 0), 0);
  if (k.startsWith('lev_')) return cnt(k.slice(4)) * v / 12;
  if (k.startsWith('sub_')) return -cnt(k.slice(4)) * v / 12;
  if (/^m[A-Z]/.test(k) || k === 'inv') return -inc * K * v / 100;
  let ret = 0, un = 0; if (P.c) for (let s = 0; s < 4; s++) { for (let a = 65; a <= 100; a++) ret += P.c[s][a].n; for (let a = 15; a < 65; a++) un += P.c[s][a].un; }
  const FWK = 10000;
  switch (k) {
    case 'tax': return sc((b.inc['Налог на зарплату'] || 0) * m * K);
    case 'space': return sc(inc * K);
    case 'vat': { let sp = 0; for (const g in P.dem || {}) if (P.price && P.price[g] && P.sat) sp += (P.dem[g] || 0) * (P.sat[g] || 0) * P.price[g]; return sp * (v / 100) / (1 + v / 100) * 30 * K; }
    case 'ptax': return cs.reduce((a, c) => a + Math.max(0, c.lastPm || 0), 0) * v / 100;
    case 'carbon': return cnt('tps') * 7.5e6 / 12 * v;
    case 'penFix': return -ret * v * 30 * K;
    case 'unemp': return -un * v * 30 * K;
    case 'childFix': return -(P.birth || 0) / 12 * v * K;
    case 'wTeach': return -((P.fac.edu || 0) + (P.fac.exp || 0)) * FWK * v * 30 * K;
    case 'wDoc': return -(P.fac.meds || 0) * FWK * v * 30 * K;
    case 'sciPct': return -inc * K * v / 100;
    case 'edu': { const x = sc(-((P.expP && P.expP.edu) || 0) * 30); return x; }
    case 'birthSup': return sc(-((P.expP && P.expP.bth) || 0) * 30);
    case 'pension': return sc(-((P.expP && P.expP.pen) || 0) * 30);
    case 'tariff': return sc((P.tarDay || 0) * 30);
    case 'mineTax': return sc((b.inc['Налог на добычу'] || 0) * m);
  }
  return null;
}
hooks.lawEff = lawEff;
