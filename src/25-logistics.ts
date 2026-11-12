// @ts-nocheck
// Планетарная логистика: любая сделка на теле (кроме стройки) требует т·км доставки.
// Колония — любое тело: планета, луна, астероид, станция. Плечо доставки d из диздока:
// d = d0 + λ·πD/4·min(1, sqrt((N/ρ)/(πD²)))
import { BODY } from './01-data.ts';
import { tm } from './15-techs.ts';
import { diamOf, regLegDist } from './30-regions.ts';

export const LT = ['land', 'sea', 'air'], LT_N = {land: 'наземная', sea: 'морская', air: 'воздушная'};
export const LCAP = {land: 1, sea: .6, air: .5};           // предельная доля т·км (от порта ещё везти)
export const LOG_T = 2.7e6 /* т·км в сутки на предприятие (10 000 чел.): 1 млрд т·км в год, таблица «Пояс» */, LOG_W = 10000, LMIX = [.5, .35, .15, 0];
const ATM = {venus: .3, titan: .5, mars: .1};               // воздух там, где есть атмосфера
export function bodyEnv(id) {
  const b = BODY[id] || {}, k = b.kind;
  if (id === 'earth') return {D: diamOf('earth'), rho: 50, env: {land: 1, sea: 1.6, air: .4}, how: 'открытая поверхность'};
  const D = diamOf(id);
  if (D > 1500) return {D, rho: 5000, env: {land: 1.3, sea: 0, air: ATM[id] || 0}, how: 'купола'};
  return {D, rho: 20000, env: {land: 1.3, sea: 0, air: 0}, how: D > 2 ? 'подземные города' : 'станция'};
}
// доля работающих на жизнеобеспечении (гидропоника, воздух, вода): Земля 5%, купола 15%, подземные города 20%, станции 30%
export const lsShare = id => { const h = bodyEnv(id).how; return h === 'открытая поверхность' ? .05 : h === 'купола' ? .15 : h === 'станция' ? .3 : .2; };
export const legDist = (id, N) => regLegDist(id, N, bodyEnv(id).rho); // с учётом регионов (30-regions)
// техника вида транспорта: общая (технологии игрока) × специализация корпорации
const techK = (t, c) => tm('log_' + t) * (c ? (c.civ.ltk && c.civ.ltk[t]) || (corpSpec(c) === t ? 1.15 : 1) : 1);
export const corpSpec = c => LT[c.id % 3];
const wpOf = W => LMIX.reduce((a, m, s) => a + m * W[s] * .96, 0);
export const unitCost = (t, env, W, c) => env[t] > 0 ? LOG_W * wpOf(W) / (LOG_T * env[t] * techK(t, c)) : Infinity;
export function logJobs(P, corps) {
  const J = [0, 0, 0, 0]; let n = 0;
  for (const t of LT) n += (P.tr && P.tr[t]) || 0;
  for (const c of corps) if (c.civ && c.civ.tr) for (const t of LT) n += c.civ.tr[t] || 0;
  for (let s = 0; s < 4; s++) J[s] = n * LOG_W * LMIX[s];
  return J;
}
// Рынок т·км одной колонии. tons — т/сут всех сделок. Возвращает долю доставленного и цену 1 т.
export function logMarket(P, id, corps, tons, fill, dt, init) {
  const E = bodyEnv(id), d = legDist(id, P.n || 1), L = tons * d, W = P.wage, staff = LMIX.reduce((a, m, s) => a + m * fill[s], 0);
  P.tr = P.tr || {land: 0, sea: 0, air: 0};
  const S = [];
  for (const t of LT) if (E.env[t] > 0) {
    const u = unitCost(t, E.env, W);
    S.push({t, leg: true, n: P.tr[t], cap: P.tr[t] * LOG_T * E.env[t] * techK(t) * staff, price: u, u});
    for (const c of corps) { const n = c.civ && c.civ.tr && c.civ.tr[t]; if (!n) continue;
      const uc = unitCost(t, E.env, W, c); c.civ.lp = c.civ.lp || {}; if (!c.civ.lp[t]) c.civ.lp[t] = uc * 1.15;
      S.push({t, c, n, cap: n * LOG_T * E.env[t] * techK(t, c) * staff, price: c.civ.lp[t], u: uc}); }
  }
  S.sort((a, b) => a.price - b.price);
  const used = {land: 0, sea: 0, air: 0}; let left = L, paid = 0, corpCap = {land: 0, sea: 0, air: 0};
  for (const s of S) { const room = Math.max(0, LCAP[s.t] * L - used[s.t]); s.sold = Math.min(s.cap, left, room); used[s.t] += s.sold; left -= s.sold; paid += s.sold * s.price; if (!s.leg) corpCap[s.t] += s.cap; }
  const sold = L - left, sat = L > 0 ? Math.min(1, sold / L) : 1, avg = sold > 0 ? paid / sold : (S[0] ? S[0].price : 0);
  if (!init) for (const s of S) {
    const wc = s.n * LOG_W * wpOf(W), rev = s.sold * s.price;
    if (s.leg) continue; // госпредприятия работают по себестоимости
    const c = s.c; c.credits += (rev - wc) * dt; c.civ.pm = (c.civ.pm || 0) + (rev - wc) * dt;
    const util = s.cap > 0 ? s.sold / s.cap : 0;
    if (util < .2 && s.n > 0) { c.civ.tr[s.t]--; continue; } // простаивает — закрывают
    c.civ.lp[s.t] = util >= .97 ? Math.min(c.civ.lp[s.t] * 1.03, s.u * 3) : Math.max(s.u * 1.05, c.civ.lp[s.t] * (util < .5 ? .95 : .985));
  }
  // госпредприятия закрывают то, что не покрыли корпорации (сначала дешёвые виды, с предельными долями)
  const gap = Math.max(0, L - LT.reduce((a, t) => a + corpCap[t], 0)), order = LT.filter(t => E.env[t] > 0).sort((a, b) => unitCost(a, E.env, W) - unitCost(b, E.env, W));
  let g = gap * 1.03;
  for (const t of LT) {
    if (!(E.env[t] > 0)) { P.tr[t] = 0; continue; }
  }
  for (const t of order) {
    const want = Math.min(g, Math.max(0, LCAP[t] * L - corpCap[t])); g -= want;
    const per = LOG_T * E.env[t] * techK(t), need = Math.ceil(want / per), cur = P.tr[t] || 0;
    if (init) P.tr[t] = need;
    else if (cur < need) P.tr[t] = cur + Math.min(need - cur, Math.max(1, Math.ceil(cur * .05)));
    else if (cur > need * 1.05 + 1) P.tr[t] = cur - Math.min(cur, Math.max(1, Math.ceil(cur * .02)));
  }
  P.log = {d, L, sold, sat, price: avg, perT: avg * d, used, how: E.how, D: E.D};
  return P.log;
}
// Корпорация решает, строить ли транспортное предприятие в текущей колонии
export function wantTransport(c, P, id) {
  const lg = P.log; if (!lg || lg.L <= 0) return null;
  const E = bodyEnv(id); let best = null, bs = 1.08;
  for (const t of LT) if (E.env[t] > 0) {
    const u = unitCost(t, E.env, P.wage, c), room = LCAP[t] * lg.L - (lg.used[t] || 0) + (lg.sat < 1 ? (1 - lg.sat) * lg.L : 0);
    const sc = (lg.sat < .98 ? lg.price : unitCost(t, E.env, P.wage)) / u * (room > 0 ? 1 : .8); // конкурент — госпредприятие этого вида
    if (sc > bs) { bs = sc; best = t; }
  }
  return best;
}
