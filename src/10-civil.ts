// @ts-nocheck
// Гражданская экономика корпораций: заводы, шахты, рынок сырья, коммерческая верфь.
import { state, log, rec, fmtN } from './01-data.ts';
import { GOODS, FACT_W, PROD, RAW_PER, FACT_COST, BASEW, clampN } from './07-population.ts';
import { PRICE } from './06-corps.ts';

export const MINE_COST = 5e7, MINE_T = 100, MINE_MIX = [.6, .3, .1, 0], YARD_COST = 2e10, SHIP_K = 250, YARD_MASS = {fe: 800, ni: 60, ti: 50, cu: 50, si: 40};
export const SPECIALTY = ['food', 'elec', 'wear', 'pow'];
export const LAB_COST = 3e7, LAB_RP = 10, LAB_MIX = [0, .3, .5, .2], LAB_SI = 0.1 / 30;
export const CTECH = [
  {id: 'out1', k: 'out', cost: 2000, name: 'Выпуск товара +5%'}, {id: 'out2', k: 'out', cost: 6000, req: 'out1', name: 'Выпуск товара +5% (II)'}, {id: 'out3', k: 'out', cost: 15000, req: 'out2', name: 'Выпуск товара +5% (III)'},
  {id: 'lab1', k: 'lab', cost: 2500, name: 'Штат завода −5%'}, {id: 'lab2', k: 'lab', cost: 7000, req: 'lab1', name: 'Штат завода −5% (II)'}, {id: 'lab3', k: 'lab', cost: 18000, req: 'lab2', name: 'Штат завода −5% (III)'},
  {id: 'raw1', k: 'raw', cost: 1500, name: 'Расход сырья −10%'}, {id: 'raw2', k: 'raw', cost: 4500, req: 'raw1', name: 'Расход сырья −10% (II)'},
  {id: 'xfer', k: 'xfer', cost: 5000, name: 'Передача топлива и припасов в космосе'},
];
const tk = (c, k) => CTECH.filter(t => t.k === k && c.civ.tech[t.id]).length;
export const outMult = c => 1 + .05 * tk(c, 'out');
export const laborMult = c => Math.pow(.95, tk(c, 'lab'));
export const rawMult = c => Math.pow(.9, tk(c, 'raw'));
export const hasXfer = c => !!(c.civ && c.civ.tech && c.civ.tech.xfer);
export const rpPrice = c => c.civ.rpPrice || (c.civ.rpPrice = 8000 + (c.id % 7) * 600);
export const labRP = c => (c.civ.labs || 0) * LAB_RP * ((state.pop && state.pop.fill) ? LAB_MIX.reduce((a, m, s) => a + m * state.pop.fill[s], 0) : 1);
export const newCiv = (spec) => ({fac: {[spec]: 2}, mines: {[GOODS[spec].raw]: 1}, yard: 0, pr: {}, mp: {}, sold: {}, cap: {}, unitc: {}, comp: {}, month: 0, built: 0, labs: 0, tech: {}, cur: null, prog: 0, rpPool: 0, hired: 0});
const corpsAll = () => state.corps || [];
export const yardOwners = () => corpsAll().filter(c => c.civ && c.civ.yard);
export const hasYard = () => yardOwners().length > 0;
export const canBuildShips = c => !!(c.civ && (c.civ.yard || hasYard()));
export function civJobs() {
  const J = [0, 0, 0, 0];
  for (const c of corpsAll()) { if (!c.civ) continue;
    const lm = laborMult(c);
    for (const g in c.civ.fac) for (let s = 0; s < 4; s++) J[s] += c.civ.fac[g] * FACT_W * GOODS[g].mix[s] * lm;
    for (let s = 0; s < 4; s++) J[s] += (c.civ.labs || 0) * FACT_W * LAB_MIX[s];
    let m = 0; for (const r in c.civ.mines) m += c.civ.mines[r];
    for (let s = 0; s < 4; s++) J[s] += m * FACT_W * MINE_MIX[s]; }
  return J;
}
// Оплата постройки корабля: своя верфь — по себестоимости, чужая — плюс 50% владельцу верфи.
// Верфь строит по одному заказу за раз: пока занята, новые заказы ждут (days — срок постройки).
export function payBuild(c, cost, days) {
  const own = c.civ.yard ? c : null, o = own || yardOwners().filter(x => state.t >= (x.civ.busy || 0))[0];
  if (!o || state.t < (o.civ.busy || 0)) return false;
  const price = own ? cost : cost * 1.5;
  if (c.credits < price) return false;
  c.credits -= price; o.civ.busy = state.t + days;
  if (!own) { o.credits += price; o.civ.fees = (o.civ.fees || 0) + cost * .5; }
  return true;
}
export function goodsMarket(g, D, legCap, staff) {
  const P = state.pop, S = [{id: 'leg', cap: legCap, price: 1}];
  for (const c of corpsAll()) { const n = c.civ && c.civ.fac[g] || 0; if (n > 0) { if (!c.civ.pr[g]) c.civ.pr[g] = .95; S.push({id: c.id, c, cap: n * FACT_W * PROD * staff * outMult(c), price: c.civ.pr[g]}); } }
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
      const leg = s.id === 'leg', n = leg ? P.fac[g] : s.c.civ.fac[g], wc = n * FACT_W * wp * (leg ? 1 : laborMult(s.c)), rc = RM.cost[leg ? 'leg:' + g : s.id] || 0;
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
  const sellers = [];
  for (const c of corpsAll()) {
    let m = 0; for (const r in c.civ.mines) m += c.civ.mines[r];
    let wp = 0; for (let s = 0; s < 4; s++) wp += MINE_MIX[s] * W[s] * .96;
    c.credits -= m * FACT_W * wp * dt;
    let lw = 0; for (let s = 0; s < 4; s++) lw += LAB_MIX[s] * W[s] * .96;
    c.credits -= (c.civ.labs || 0) * FACT_W * lw * dt;
    rpMonth(c, dt, sellers);
    civTick(c, mk, dt);
  }
  settleRP(sellers, dt);
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
  if (!hasYard() && tot >= 40) return; // копят на верфь
  const wantLabs = tot >= 6 ? Math.min(40, Math.ceil(tot / 12)) : 0;
  if ((v.labs || 0) < wantLabs && avail > LAB_COST * 1.5) { c.credits -= LAB_COST; v.labs = (v.labs || 0) + 1; return; }
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

// --- исследования корпораций и контракты лабораторий ---
function nextTech(c) {
  const v = c.civ, tot = Object.values(v.fac).reduce((a, b) => a + b, 0);
  const order = ['out1', 'lab1'].concat((hasYard() || tot >= 40) ? ['xfer'] : [], ['raw1', 'out2', 'lab2', 'raw2', 'out3', 'lab3', 'xfer']);
  for (const id of order) { const t = CTECH.find(x => x.id === id); if (!v.tech[id] && (!t.req || v.tech[t.req])) return id; }
  return null;
}
function useRP(c, rp) {
  const v = c.civ; if (!v.cur) v.cur = nextTech(c);
  while (rp > 0 && v.cur) {
    const t = CTECH.find(x => x.id === v.cur), need = t.cost - v.prog, a = Math.min(rp, need);
    v.prog += a; rp -= a;
    if (v.prog >= t.cost - 1e-9) { v.tech[t.id] = true; v.prog = 0; v.cur = null; if (t.id === 'xfer') log(`«${c.name}» научилась передавать топливо и припасы в космосе: можно строить станции и танкеры.`); v.cur = nextTech(c); }
  }
  return rp;
}
function rpMonth(c, dt, sellers) {
  const v = c.civ, rp = labRP(c) * dt; v.hired = 0;
  if (rp <= 0) { if (v.rpPool > 0 && v.cur) v.rpPool = useRP(c, v.rpPool); return; }
  if (state.contracts && state.contracts[c.id]) {
    const pay = rp * rpPrice(c);
    if (state.money >= pay) { state.money -= pay; c.credits += pay; state.rp = (state.rp || 0) + rp; v.hired = rp / dt; return; }
    delete state.contracts[c.id]; log(`Контракт с лабораториями «${c.name}» расторгнут: не хватило кредитов.`);
  }
  const share = v.cur ? .0 : 1; // если своей темы нет — всё на продажу
  const sell = rp * (share || .25);
  if (sell > 0) sellers.push({c, rp: sell});
  const own = rp - sell + (v.rpPool || 0); v.rpPool = 0;
  v.rpPool = useRP(c, own);
}
export function settleRP(sellers, dt) {
  if (!sellers.length) return;
  const buyers = corpsAll().filter(c => c.civ.cur && c.credits > 1e8).sort((a, b) => b.credits - a.credits);
  sellers.sort((a, b) => rpPrice(a.c) - rpPrice(b.c));
  for (const b of buyers) {
    const t = CTECH.find(x => x.id === b.civ.cur); if (!t) continue; let need = t.cost - b.civ.prog;
    for (const s of sellers) {
      if (s.c === b || need <= 0 || s.rp <= 0) continue;
      const q = Math.min(need, s.rp), pay = q * rpPrice(s.c); if (b.credits < pay * 3) continue;
      b.credits -= pay; s.c.credits += pay; s.rp -= q; need -= q; useRP(b, q);
    }
  }
  for (const s of sellers) if (s.rp > 0) s.c.civ.rpPool = useRP(s.c, (s.c.civ.rpPool || 0) + s.rp);
}
