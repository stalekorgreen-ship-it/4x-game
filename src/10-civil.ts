// @ts-nocheck
// Гражданская экономика корпораций: заводы, шахты, рынок сырья, коммерческая верфь.
import { state, log, rec, fmtN } from './01-data.ts';
import { GOODS, FACT_W, PROD, RAW_PER, FACT_COST, BASEW, clampN } from './07-population.ts';
import { PRICE } from './06-corps.ts';

export const MINE_COST = 5e7, MINE_T = 100, MINE_MIX = [.6, .3, .1, 0], YARD_COST = 6e8;
export const SPECIALTY = ['food', 'elec', 'wear', 'pow'];
export const newCiv = (spec) => ({fac: {[spec]: 2}, mines: {[GOODS[spec].raw]: 1}, yard: 0, pr: {}, mp: {}, sold: {}, cap: {}, unitc: {}, comp: {}, month: 0, built: 0});
const corpsAll = () => state.corps || [];
export const yardOwners = () => corpsAll().filter(c => c.civ && c.civ.yard);
export const hasYard = () => yardOwners().length > 0;
export const canBuildShips = c => !!(c.civ && (c.civ.yard || hasYard()));
export function civJobs() {
  const J = [0, 0, 0, 0];
  for (const c of corpsAll()) { if (!c.civ) continue;
    for (const g in c.civ.fac) for (let s = 0; s < 4; s++) J[s] += c.civ.fac[g] * FACT_W * GOODS[g].mix[s];
    let m = 0; for (const r in c.civ.mines) m += c.civ.mines[r];
    for (let s = 0; s < 4; s++) J[s] += m * FACT_W * MINE_MIX[s]; }
  return J;
}
// Оплата постройки корабля: своя верфь — по себестоимости, чужая — плюс 50% владельцу верфи.
export function payBuild(c, cost) {
  if (c.civ.yard) { if (c.credits < cost) return false; c.credits -= cost; return true; }
  const o = yardOwners()[0]; if (!o || c.credits < cost * 1.5) return false;
  c.credits -= cost * 1.5; o.credits += cost * 1.5; o.civ.fees = (o.civ.fees || 0) + cost * .5; return true;
}
export function goodsMarket(g, D, legCap, staff) {
  const P = state.pop, S = [{id: 'leg', cap: legCap, price: 1}];
  for (const c of corpsAll()) { const n = c.civ && c.civ.fac[g] || 0; if (n > 0) { if (!c.civ.pr[g]) c.civ.pr[g] = .95; S.push({id: c.id, c, cap: n * FACT_W * PROD * staff, price: c.civ.pr[g]}); } }
  S.sort((a, b) => a.price - b.price);
  let left = D; for (const s of S) { s.sold = Math.min(s.cap, left); left -= s.sold; }
  const sold = D - left, sat = D > 0 ? Math.min(1, sold / D) : 1, mult = clampN(1 + 1.5 * (1 - sat), 1, 3);
  let paid = 0, cap = 0; for (const s of S) { paid += s.sold * s.price; cap += s.cap; }
  for (const s of S) s.comp = S.filter(x => x !== s).reduce((m, x) => Math.min(m, x.price), 9);
  return {S, sold, sat, mult, cap, avg: sold > 0 ? paid / sold : 1};
}
function rawMarket(rawNeed, dt, init) {
  const P = state.pop, avg = {}, cost = {}; P.rawMk = P.rawMk || {};
  for (const r in rawNeed) {
    const needs = rawNeed[r], pool = []; let total = 0, own = 0;
    for (const c of corpsAll()) {
      const out = (c.civ.mines[r] || 0) * MINE_T * (P.mfill || 1), use = Math.min(out, needs[c.id] || 0);
      if (use > 0) needs[c.id] -= use; own += use;
      if (c.civ.mp[r] == null) c.civ.mp[r] = PRICE[r] * .97;
      if (out - use > 1e-9) pool.push({id: c.id, c, cap: out - use, price: c.civ.mp[r], r});
    }
    const stock = state.stock[r] || 0; if (stock > 0) pool.push({id: 'pl', cap: stock / dt, price: PRICE[r]});
    pool.push({id: 'imp', cap: 1e12, price: PRICE[r] * 1.8});
    for (const k in needs) total += needs[k];
    pool.sort((a, b) => a.price - b.price);
    let left = total, paid = 0, imp = 0;
    for (const s of pool) { s.sold = Math.min(s.cap, left); left -= s.sold; paid += s.sold * s.price; if (s.id === 'imp') imp = s.sold; }
    const a = total > 0 ? paid / total : PRICE[r]; avg[r] = a;
    for (const k in needs) cost[k] = (cost[k] || 0) + needs[k] * a;
    if (!init) for (const s of pool) {
      if (s.c) { s.c.credits += s.sold * s.price * dt; s.c.civ.mp[r] = s.sold >= s.cap * .98 ? Math.min(PRICE[r] * 1.7, s.price * 1.03) : Math.max(PRICE[r] * .5, s.price * .97); }
      else if (s.id === 'pl' && s.sold > 0) { const t = s.sold * dt; state.stock[r] -= t; state.money += t * PRICE[r]; rec(r, 'out', t, 'pop'); }
    }
    P.rawMk[r] = {need: total + own, own, imp, avg: a};
  }
  return {avg, cost};
}
export function settleEconomy(mk, rawNeed, dt, init) {
  const P = state.pop, W = P.wage, RM = rawMarket(rawNeed, dt, init);
  P.legRaw = P.legRaw || {};
  for (const g in GOODS) {
    const R = mk[g], G = GOODS[g]; let wp = 0; for (let s = 0; s < 4; s++) wp += G.mix[s] * W[s] * .96;
    let corpCap = 0;
    for (const s of R.S) {
      const leg = s.id === 'leg', n = leg ? P.fac[g] : s.c.civ.fac[g], wc = n * FACT_W * wp, rc = RM.cost[leg ? 'leg:' + g : s.id] || 0;
      if (!leg) corpCap += s.cap;
      const rev = s.sold * s.price * R.mult;
      if (init) continue;
      if (leg) { P.cap[g] += (rev - wc - rc) * dt * .5; P.rev = P.rev || {}; P.rev[g] = rev; }
      else {
        const c = s.c; c.credits += (rev - wc - rc) * dt; c.civ.sold[g] = s.sold; c.civ.cap[g] = s.cap; c.civ.unitc[g] = (wc + rc) / Math.max(1, s.cap); c.civ.comp[g] = s.comp * R.mult;
        const util = s.cap > 0 ? s.sold / s.cap : 0, u = c.civ.unitc[g];
        if (util >= .97) c.civ.pr[g] = Math.min(c.civ.pr[g] * 1.03, Math.max(s.comp * 1.4, .3)); else c.civ.pr[g] = Math.max(u * 1.05, c.civ.pr[g] * (util < .5 ? .95 : .985));
      }
    }
    if (!init) { // старая промышленность: достраивает только то, что не покрыто корпорациями
      const D = P.dem[g], want = Math.ceil(Math.max(0, D - corpCap) / (PROD * FACT_W) * 1.03), canBuild = Math.floor(P.cap[g] / FACT_COST);
      if (P.fac[g] < want && canBuild > 0) { const k = Math.min(want - P.fac[g], canBuild, Math.ceil(P.fac[g] * .02)); P.fac[g] += k; P.cap[g] -= k * FACT_COST; }
      else if (P.fac[g] > want * 1.05 + 1) P.fac[g] -= Math.min(P.fac[g], Math.ceil(P.fac[g] * .01));
    }
    P.price = P.price || {}; P.price[g] = R.avg * R.mult; P.raw = P.raw || {}; P.raw[g] = {t: R.sold / G.need * RAW_PER};
  }
  if (init) return;
  for (const c of corpsAll()) {
    let m = 0; for (const r in c.civ.mines) m += c.civ.mines[r];
    let wp = 0; for (let s = 0; s < 4; s++) wp += MINE_MIX[s] * W[s] * .96;
    c.credits -= m * FACT_W * wp * dt;
    civTick(c, mk, dt);
  }
}
function civTick(c, mk, dt) {
  const v = c.civ; v.month++;
  let tot = 0; for (const g in v.fac) tot += v.fac[g];
  let monthly = 0; for (const g in v.fac) monthly += v.fac[g] * FACT_W * 7;
  const avail = c.credits - monthly * 2;
  // верфь: первый, кто накопил, строит её; остальные покупают постройки у него
  if (!v.yard && avail > YARD_COST * 1.2 && (!hasYard() || avail > YARD_COST * 8)) {
    c.credits -= YARD_COST; v.yard = 1; log(`Корпорация «${c.name}» построила коммерческую верфь: теперь корабли можно строить и покупать у неё.`); return;
  }
  if (!hasYard() && tot >= 20) return; // копят на верфь
  // сырьё: нет шахты — строят
  let g = null, best = -1;
  for (const k in GOODS) { const own = v.fac[k] || 0; if (own <= 0) continue; const util = v.cap[k] > 0 ? v.sold[k] / v.cap[k] : 0; if (util >= .9 && mk[k].sat < 1.001) { const sc = mk[k].avg * mk[k].mult * (1 + (SPECIALTY.indexOf(k) >= 0 ? .1 : 0)); if (sc > best) { best = sc; g = k; } } }
  if (g === null) for (const k in v.fac) if (v.fac[k] > 0) { g = k; break; }
  if (g === null) return;
  if (tot >= 6 && v.month % 3 === 0) { let o = null, ob = 0; for (const k in GOODS) if (k !== g && (v.fac[k] || 0) < tot * .3) { const sc = mk[k].avg * mk[k].mult; if (sc > ob) { ob = sc; o = k; } } if (o) g = o; }
  const raw = GOODS[g].raw;
  if (!(v.mines[raw] > 0) && tot >= 3) { if (avail > MINE_COST * 1.2) { c.credits -= MINE_COST; v.mines[raw] = 1; log(`«${c.name}» открыла шахту: ${raw}.`); } return; }
  const k = Math.min(Math.floor(avail / FACT_COST), Math.max(1, Math.ceil(tot * .1)));
  if (k > 0) { c.credits -= k * FACT_COST; v.fac[g] = (v.fac[g] || 0) + k; v.built += k; if (!v.pr[g]) v.pr[g] = .95; }
}
