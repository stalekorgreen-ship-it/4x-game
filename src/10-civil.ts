// @ts-nocheck
// Гражданская экономика корпораций: заводы, шахты, рынок сырья, коммерческая верфь.
import { tm } from './15-techs.ts';
import { state, log, rec, fmtN } from './01-data.ts';
import { KR } from './00-kr.ts';
import { GOODS, PROD, RAW_PER, BASEW, clampN, FW, FC, fs, hoursK, ctxId } from './07-population.ts';
import { bldJobs } from './03-build.ts';
import { PRICE, allowBuy, noteBought, respawnTick } from './06-corps.ts';
import { eventTick, finTick, laws, licenseTick, pay } from './12-state.ts';

export const MINE_COST = 5e7 * KR, MINE_T = 100, MINE_MIX = [.6, .3, .1, 0], YARD_COST = 2e10 * KR, SHIP_K = 250, YARD_MASS = {fe: 800, ni: 60, ti: 50, cu: 50, si: 40};
export const mpOf = r => (state.mp && state.mp[r]) || 1;
export const SPECIALTY = ['food', 'elec', 'wear', 'pow'];
export const LAB_COST = 3e7 * KR, LAB_RP = 10, LAB_MIX = [0, .3, .5, .2], LAB_SI = 0.1 / 30;
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
export const rpPrice = c => (c.civ.rpPrice || (c.civ.rpPrice = (8000 + (c.id % 7) * 600) * KR)) * tm('rpcost');
export const labRP = c => (c.civ.labs || 0) * LAB_RP * ((state.pop && state.pop.fill) ? LAB_MIX.reduce((a, m, s) => a + m * state.pop.fill[s], 0) : 1);
export const newCiv = (spec) => ({fac: {[spec]: 2}, mines: {[GOODS[spec].raw]: 1}, yard: 0, pr: {}, mp: {}, sold: {}, cap: {}, unitc: {}, comp: {}, month: 0, built: 0, labs: 0, tech: {}, cur: null, prog: 0, rpPool: 0, hired: 0});
const corpsAll = () => (state.corps || []).filter(c => c.civ);
export const MC = () => MINE_COST * fs();
export const yardOwners = () => corpsAll().filter(c => c.civ && c.civ.yard);
export const hasYard = () => yardOwners().length > 0;
export const canBuildShips = c => !!(c.civ && (c.civ.yard || hasYard()));
export function civJobs() {
  const J = [0, 0, 0, 0], FACT_W = FW();
  for (const c of corpsAll()) { if (!c.civ) continue;
    const lm = laborMult(c);
    for (const g in c.civ.fac) for (let s = 0; s < 4; s++) J[s] += c.civ.fac[g] * FACT_W * GOODS[g].mix[s] * lm;
    for (let s = 0; s < 4; s++) J[s] += (c.civ.labs || 0) * FACT_W * LAB_MIX[s];
    let m = 0; for (const r in c.civ.mines) m += c.civ.mines[r];
    for (let s = 0; s < 4; s++) J[s] += m * FACT_W * MINE_MIX[s]; }
  if (ctxId() === 'earth') for (let s = 0; s < 4; s++) J[s] += bldJobs(s);
  return J;
}
// Оплата постройки корабля: своя верфь — по себестоимости, чужая — плюс 50% владельцу верфи.
// Верфь строит по одному заказу за раз: пока занята, новые заказы ждут (days — срок постройки).
export function payBuild(c, cost, days) {
  const own = c.civ.yard ? c : null, o = own || yardOwners().filter(x => state.t >= (x.civ.busy || 0))[0];
  if (!o || state.t < (o.civ.busy || 0)) return false;
  const price = own ? cost : cost * 1.5;
  if (c.credits < price) return false;
  pay(c, price, 'subSpace'); o.civ.busy = state.t + days;
  if (!own) { o.credits += price; o.civ.fees = (o.civ.fees || 0) + cost * .5; }
  return true;
}
export function goodsMarket(g, D, legCap, staff) {
  const P = state.pop, S = [{id: 'leg', cap: legCap * ((P.evMult && P.evMult[g]) || 1), price: KR}], FACT_W = FW(), tf = laws().tariff / 100;
  for (const c of corpsAll()) { const n = c.civ && c.civ.fac[g] || 0; if (n > 0) { if (!c.civ.pr[g]) c.civ.pr[g] = .95 * KR; S.push({id: c.id, c, cap: n * FACT_W * PROD * hoursK() * staff * outMult(c) * ((P.evMult && P.evMult[g]) || 1) * (c.civ.strikeUntil > state.t ? .5 : 1), price: c.civ.pr[g]}); } }
  if (ctxId() !== 'earth') S.push({id: 'imp', cap: D, price: 1.7 * KR * (P.dist || 1) * (1 + tf)});
  S.sort((a, b) => a.price - b.price);
  let left = D; for (const s of S) { s.sold = Math.min(s.cap, left); left -= s.sold; }
  const sold = D - left, sat = D > 0 ? Math.min(1, sold / D) : 1, mult = clampN(1 + 1.5 * (1 - sat), 1, 3);
  let paid = 0, cap = 0; for (const s of S) { paid += s.sold * s.price; if (s.id !== 'imp') cap += s.cap; }
  for (const s of S) s.comp = S.filter(x => x !== s).reduce((m, x) => Math.min(m, x.price), 9 * KR);
  const im = S.find(x => x.id === 'imp'); P.gImp = P.gImp || {}; P.gImp[g] = im ? im.sold : 0;
  return {S, sold, sat, mult, cap, avg: sold > 0 ? paid / sold : 1};
}
function rawMarket(rawNeed, dt, init) {
  const P = state.pop, avg = {}, cost = {}; P.rawMk = P.rawMk || {};
  for (const r in rawNeed) {
    const needs = rawNeed[r], pool = []; let total = 0, own = 0;
    for (const c of corpsAll()) {
      const out = (c.civ.mines[r] || 0) * MINE_T * fs() * (P.mfill || 1), use = Math.min(out, needs[c.id] || 0);
      if (use > 0) needs[c.id] -= use; own += use;
      if (c.civ.mp[r] == null) c.civ.mp[r] = PRICE[r] * .97;
      if (out - use > 1e-9) pool.push({id: c.id, c, cap: out - use, price: c.civ.mp[r], r});
    }
    const stock = ctxId() === 'earth' ? (state.stock[r] || 0) : 0; if (stock > 0) pool.push({id: 'pl', cap: stock / dt, price: PRICE[r] * mpOf(r)});
    const tf = laws().tariff / 100; pool.push({id: 'imp', cap: 1e12, price: PRICE[r] * 1.8 * (P.dist || 1) * (1 + tf)});
    for (const k in needs) total += needs[k];
    pool.sort((a, b) => a.price - b.price);
    let left = total, paid = 0, imp = 0;
    for (const s of pool) { s.sold = Math.min(s.cap, left); left -= s.sold; paid += s.sold * s.price; if (s.id === 'imp') imp = s.sold; }
    const a = total > 0 ? paid / total : PRICE[r]; avg[r] = a;
    for (const k in needs) cost[k] = (cost[k] || 0) + needs[k] * a;
    if (!init && ctxId() === 'earth') { // игрок скупает излишки шахт по своей политике (дешёвые первыми)
      let al = allowBuy(r, 0) === 0 ? 0 : 1; const cand = pool.filter(x => x.c && x.cap - x.sold > 1e-9).sort((a, b) => a.price - b.price);
      for (const x of cand) { al = allowBuy(r, x.price); if (!(al > 0)) continue; const q = Math.min(al, (x.cap - x.sold) * dt, state.money / x.price); if (!(q > 0)) continue;
        const pay = q * x.price, mt = pay * laws().mineTax / 100; state.money -= pay - mt; x.c.credits += pay - mt; state.stock[r] = (state.stock[r] || 0) + q; x.sold += q / dt; noteBought(r, q); rec(r, 'in', q, 'corp'); state.mtaxInc = (state.mtaxInc || 0) + mt; }
    }
    if (!init) for (const s of pool) {
      if (s.c) { const rv = s.sold * s.price * dt, mt = rv * laws().mineTax / 100; s.c.credits += rv - mt; state.money += mt; state.mtaxInc = (state.mtaxInc || 0) + mt; s.c.civ.mp[r] = s.sold >= s.cap * .98 ? Math.min(PRICE[r] * 1.7, s.price * 1.03) : Math.max(PRICE[r] * .5, s.price * .97); }
      else if (s.id === 'imp' && s.sold > 0) { const ti = s.sold * PRICE[r] * 1.8 * (P.dist || 1) * tf / (1 + tf); P.tarAcc = (P.tarAcc || 0) + ti * dt; }
      else if (s.id === 'pl' && s.sold > 0) { const t = s.sold * dt; state.stock[r] -= t; state.money += t * s.price; rec(r, 'out', t, 'pop'); }
    }
    if (!init) { // живая цена: дефицит (ввоз) поднимает, избыток нераспроданного сырья снижает
      state.mp = state.mp || {}; let cc = 0, un = 0; for (const s of pool) if (s.c) { cc += s.cap; un += s.cap - s.sold; }
      let m = mpOf(r) * (1 + .35 * (total > 0 ? imp / total : 0) - .05 * (cc > 0 ? un / cc : 0)); m += (1 - m) * .08; state.mp[r] = clampN(m, .6, 3);
    }
    P.rawMk[r] = {need: total + own, own, imp, avg: a, mp: mpOf(r)};
  }
  return {avg, cost};
}
export function settleEconomy(mk, rawNeed, dt, init) {
  const P = state.pop, W = P.wage, RM = rawMarket(rawNeed, dt, init), FACT_W = FW(), FACT_COST = FC(), home = ctxId() === 'earth', hk = hoursK();
  P.legRaw = P.legRaw || {};
  for (const g in GOODS) {
    const R = mk[g], G = GOODS[g]; let wp = 0; for (let s = 0; s < 4; s++) wp += G.mix[s] * W[s] * .96 * hk;
    let corpCap = 0;
    for (const s of R.S) {
      if (s.id === 'imp') { if (!init) { const ti = s.sold * s.price * R.mult * (laws().tariff / 100) / (1 + laws().tariff / 100); P.tarAcc = (P.tarAcc || 0) + ti * dt; } continue; }
      const leg = s.id === 'leg', n = leg ? P.fac[g] : s.c.civ.fac[g], wc = n * FACT_W * wp * (leg ? 1 : laborMult(s.c)), rc = RM.cost[leg ? 'leg:' + g : s.id] || 0;
      if (!leg) corpCap += s.cap;
      const rev = s.sold * s.price * R.mult;
      if (init) continue;
      if (leg) { P.cap[g] += (rev - wc - rc) * dt * .5; P.rev = P.rev || {}; P.rev[g] = rev; }
      else {
        const c = s.c; c.credits += (rev - wc - rc) * dt; c.civ.pm = (c.civ.pm || 0) + (rev - wc - rc) * dt; c.civ.sold[g] = s.sold; c.civ.cap[g] = s.cap; c.civ.unitc[g] = (wc + rc) / Math.max(1, s.cap); c.civ.comp[g] = s.comp * R.mult;
        const util = s.cap > 0 ? s.sold / s.cap : 0, u = c.civ.unitc[g];
        if (util >= .97) c.civ.pr[g] = Math.min(c.civ.pr[g] * 1.03, Math.max(s.comp * 1.4, .3 * KR)); else c.civ.pr[g] = Math.max(u * 1.05, c.civ.pr[g] * (util < .5 ? .95 : .985));
      }
    }
    if (!init) { // старая промышленность: достраивает только то, что не покрыто корпорациями
      const D = P.dem[g], want = Math.ceil(Math.max(0, D - corpCap) / (PROD * hk * FACT_W) * 1.03), canBuild = Math.floor(P.cap[g] / FACT_COST);
      if (P.fac[g] < want && canBuild > 0) { const k = Math.min(want - P.fac[g], canBuild, Math.ceil(P.fac[g] * .02)); P.fac[g] += k; P.cap[g] -= k * FACT_COST; }
      else if (P.fac[g] > want * 1.05 + 1) P.fac[g] -= Math.min(P.fac[g], Math.ceil(P.fac[g] * .01));
    }
    P.price = P.price || {}; P.price[g] = R.avg * R.mult; P.raw = P.raw || {}; P.raw[g] = {t: R.sold / G.need * RAW_PER};
  }
  if (init) return;
  const sellers = [], off = new Map();
  if (home) playerBuyRP(off, dt);
  for (const c of [...corpsAll()]) {
    let m = 0; for (const r in c.civ.mines) m += c.civ.mines[r];
    let wp = 0; for (let s = 0; s < 4; s++) wp += MINE_MIX[s] * W[s] * .96 * hk;
    c.credits -= m * FACT_W * wp * dt;
    if (!home) { const pm = c.civ.pm || 0; c.civ.pm = 0; c.pmAdd = (c.pmAdd || 0) + pm; civTick(c, mk, dt, true); continue; }
    let lw = 0; for (let s = 0; s < 4; s++) lw += LAB_MIX[s] * W[s] * .96;
    c.credits -= (c.civ.labs || 0) * FACT_W * lw * dt;
    rpMonth(c, dt, sellers, off.get(c) ? off.get(c).rp : 0);
    licenseTick(c);
    const pm = (c.civ.pm || 0) + (c.pmAdd || 0); c.civ.pm = 0; c.pmAdd = 0;
    if (finTick(c, dt, pm)) continue;
    civTick(c, mk, dt);
  }
  if (home) { settleRP(sellers, dt); eventTick(dt); respawnTick(); }
}
function civTick(c, mk, dt, col) {
  const v = c.civ, FACT_W = FW(), FACT_COST = FC(), MINE_COST = MC(); v.month++;
  let tot = 0; for (const g in v.fac) tot += v.fac[g];
  let monthly = 0; for (const g in v.fac) monthly += v.fac[g] * FACT_W * 7;
  const avail = c.credits - monthly * 2, foc = c.strat && c.strat.focus;
  // верфь: первый, кто накопил, строит её; остальные покупают постройки у него
  if (!col && !v.yard && avail > YARD_COST * 1.2 && (!hasYard() || avail > YARD_COST * 8)) {
    pay(c, YARD_COST, 'subSpace'); v.yard = 1; log(`Корпорация «${c.name}» построила коммерческую верфь: теперь корабли можно строить и покупать у неё.`); return;
  }
  if (!col && !hasYard() && tot >= 40) return; // копят на верфь
  if (!col && v.month % (foc === 'expand' ? 1 : 4) === 0 && avail > FC() * (foc === 'expand' ? 3 : 6) && tryExpand(c)) return;
  const wantLabs = col ? 0 : tot >= 6 ? Math.min(40, Math.ceil(tot / 12 * (foc === 'science' ? 2.5 : foc === 'industry' ? .7 : 1))) : 0;
  if ((v.labs || 0) < wantLabs && avail > LAB_COST * 1.5) { pay(c, LAB_COST, 'subSci'); v.labs = (v.labs || 0) + 1; return; }
  // сырьё: нет шахты — строят
  let g = null, best = -1;
  for (const k in GOODS) { const own = v.fac[k] || 0; if (own <= 0) continue; const util = v.cap[k] > 0 ? v.sold[k] / v.cap[k] : 0; if (util >= .9 && mk[k].sat < 1.001) { const sc = mk[k].avg * mk[k].mult * (1 + (SPECIALTY.indexOf(k) >= 0 ? .1 : 0)); if (sc > best) { best = sc; g = k; } } }
  if (g === null) for (const k in v.fac) if (v.fac[k] > 0) { g = k; break; }
  if (g === null) return;
  if (tot >= 6 && v.month % 3 === 0) { let o = null, ob = 0; for (const k in GOODS) if (k !== g && (v.fac[k] || 0) < tot * .3) { const sc = mk[k].avg * mk[k].mult; if (sc > ob) { ob = sc; o = k; } } if (o) g = o; }
  for (const r of Object.keys(PRICE)) if (state.mp && state.mp[r] > 1.3 && (v.mines[r] || 0) > 0 && v.mines[r] < (foc === 'mining' ? 9 : 5) && avail > MINE_COST * 4) { pay(c, MINE_COST, 'subInd'); v.mines[r]++; return; }
  const raw = GOODS[g].raw;
  if (!(v.mines[raw] > 0) && tot >= 3) { if (avail > MINE_COST * 1.2) { pay(c, MINE_COST, 'subInd'); v.mines[raw] = 1; log(`«${c.name}» открыла шахту: ${raw}.`); } return; }
  const k = Math.min(Math.floor(avail / FACT_COST), Math.max(1, Math.ceil(tot * .1 * (foc === 'industry' ? 2.2 : 1))));
  if (k > 0) { pay(c, k * FACT_COST, 'subInd'); v.fac[g] = (v.fac[g] || 0) + k; v.built += k; if (!v.pr[g]) v.pr[g] = .95 * KR; }
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
function rpMonth(c, dt, sellers, rp) {
  const v = c.civ;
  if (rp <= 0) { if (v.rpPool > 0 && v.cur) v.rpPool = useRP(c, v.rpPool); return; }
  const share = v.cur ? .0 : 1; // если своей темы нет — всё на продажу
  const sell = rp * (share || .25);
  if (sell > 0) sellers.push({c, rp: sell});
  const own = rp - sell + (v.rpPool || 0); v.rpPool = 0;
  v.rpPool = useRP(c, own);
}
export function settleRP(sellers, dt) {
  if (!sellers.length) return;
  const buyers = corpsAll().filter(c => c.civ.cur && c.credits > 1e8 * KR).sort((a, b) => b.credits - a.credits);
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

// Расширение на колонии: богатая корпорация открывает филиал там, где товары завозят с Земли
export const newBranch = c => ({fac: {}, mines: {}, yard: 0, pr: {}, mp: {}, sold: {}, cap: {}, unitc: {}, comp: {}, month: 0, built: 0, labs: 0, tech: c.home ? c.home.tech : c.civ.tech, pm: 0});
function tryExpand(c) {
  const cs = state.cols; if (!cs) return false;
  let best = null, bs = 0;
  for (const id in cs) {
    if (id === 'earth') continue; const P = cs[id].pop; if ((P.n || 0) < 2000) continue;
    let imp = P.n; for (const g in P.gImp) imp += P.gImp[g] * 10;
    const mine = (c.civs && c.civs[id]) ? 1 : 0, sc = imp / (1 + 3 * mine) * (1 + (c.id * 7 + id.length) % 5 * .1);
    if (sc > bs) { bs = sc; best = id; }
  }
  if (!best) return false;
  const P = cs[best].pop, cost = 2e8 * KR * (P.fs || 1) * 4; if (c.credits < cost * 4) return false;
  c.civs = c.civs || {};
  if (!c.civs[best]) { c.credits -= cost; c.civs[best] = newBranch(c); { let bg = 'food', bm = -1; for (const g in GOODS) { const sc = (P.price && P.price[g] || 1) * (P.dem[g] || 0); if (sc > bm) { bm = sc; bg = g; } } c.civs[best].fac[bg] = 1; c.civs[best].pr[bg] = .95; } log(`«${c.name}» открыла филиал на колонии «${cs[best].name}».`); }
  else return false;
  return true;
}

// Игрок покупает очки исследований: сколько в месяц и не дороже какой цены — игра сама берёт у самых дешёвых лабораторий
export const sciPol = () => state.sciBuy || (state.sciBuy = {amt: 0, max: 15000 * KR});
function playerBuyRP(off, dt) {
  const L = sciPol(); let avail = 0, val = 0;
  for (const c of corpsAll()) { const rp = labRP(c) * dt; if (rp > 0) { off.set(c, {rp, price: rpPrice(c)}); avail += rp; val += rp * rpPrice(c); c.civ.hired = 0; } }
  state.sciInfo = {avail: avail * 30 / dt, avg: avail > 0 ? val / avail : 0, bought: 0, spent: 0};
  let want = L.amt * dt / 30;
  for (const [c, o] of [...off.entries()].sort((a, b) => a[1].price - b[1].price)) {
    if (want <= 0) break; if (L.max > 0 && o.price > L.max) break;
    const q = Math.min(want, o.rp, state.money / o.price); if (!(q > 0)) break;
    const pay = q * o.price; state.money -= pay; c.credits += pay; state.rp = (state.rp || 0) + q; o.rp -= q; want -= q; c.civ.hired = q / dt;
    state.sciInfo.bought += q * 30 / dt; state.sciInfo.spent += pay * 30 / dt;
  }
}
