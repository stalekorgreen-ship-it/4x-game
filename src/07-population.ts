// @ts-nocheck
import {colonyCost} from './14-climate.ts';
import { BODY, RES, fmtN, log, rec, state } from './01-data.ts';
import { PRICE } from './06-corps.ts';
import { laws } from './12-state.ts';
import { LAB_SI, MINE_MIX, civJobs, goodsMarket, rawMult, settleEconomy } from './10-civil.ts';
import { $, H, W, cv, setHtml, ui } from './08-map-ui.ts';
import { dispatchColonists } from './13-freight.ts';
/* ===== НАСЕЛЕНИЕ ЗЕМЛИ: 4 страты × возраст 0..100 ===== */
export const STR = ['Школьное', 'Среднее', 'Высшее', 'Максимальное'], STR_COL = ['#8a97ab', '#4f9d8a', '#d3a44a', '#b8567a'];
export const GOODS = {
  food: {n: 'Еда', raw: 'n2', need: 2.2, mix: [.7, .25, .05, 0]},
  wear: {n: 'Товары', raw: 'fe', need: 1.4, mix: [.6, .35, .05, 0]},
  elec: {n: 'Электроника', raw: 'si', need: .8, mix: [.2, .4, .3, .1]},
  med: {n: 'Медицина', raw: 'c', need: .7, mix: [.1, .3, .4, .2]},
  pow: {n: 'Энергия', raw: 'u', need: 1, mix: [.3, .4, .25, .05]},
};
export const OTHER_MIX = [.45, .4, .13, .02], FACT_W = 10000, PROD = 40, RAW_PER = 1e-7, BASEW = [4, 7, 12, 20], TUIT = [0, 2, 4, 7], FACT_COST = 2e8, TAXK = 1.25e-6;
export const CAPS = [.4, .3, .1], FERT = [1.25, 1.1, .8, .55];
export const ageF = a => a < 25 ? .7 : a < 30 ? .85 : a < 55 ? 1 : 1.05;
export const needF = a => a < 15 ? .7 : a >= 65 ? 1.1 : 1;
export const needOf = (g, a) => GOODS[g].need * needF(a) * (g === 'med' && a >= 50 ? 1 + (a - 50) / 25 : 1);
export const basket = a => { let b = 0; for (const g in GOODS) b += needOf(g, a); return b; };
export const work = a => a >= 15 && a < 65;
export const mortQ = a => a < 1 ? .02 : .0003 + .00002 * Math.exp(Math.min(a, 100) / 11);
export const clampN = (x, a, b) => Math.max(a, Math.min(b, x));
export const fs = () => (state.pop && state.pop.fs) || 1;
export const FW = () => FACT_W * fs();
export const FC = () => FACT_COST * fs();
export const hoursK = () => laws().hours / 40;
export const ctxId = () => state.ctx || 'earth';
function setPop(P) { Object.defineProperty(state, 'pop', {value: P, writable: true, configurable: true, enumerable: false}); }
function setCtx(id) {
  const cs = state.corps || [];
  if (ctxId() === 'earth') for (const c of cs) Object.defineProperty(c, 'home', {value: c.civ, writable: true, configurable: true, enumerable: false});
  state.ctx = id; setPop(state.cols[id].pop);
  for (const c of cs) c.civ = id === 'earth' ? (c.home || c.civ) : ((c.civs && c.civs[id]) || null);
}
// Выполнить fn в контексте колонии id (все функции экономики читают state.pop и civ корпораций)
export function withCtx(id, fn) {
  if (!state.cols || !state.cols[id]) return;
  const prev = ctxId(); if (prev === id) { if (state.pop !== state.cols[id].pop) setPop(state.cols[id].pop); return fn(); }
  setCtx(id);
  try { return fn(); } finally { setCtx(prev); }
}
export function relinkCols() {
  if (!state.cols) { state.cols = {earth: {id: 'earth', name: 'Земля', pop: state.pop}}; }
  state.ctx = 'earth'; setPop(state.cols.earth.pop);
  for (const c of state.corps || []) { Object.defineProperty(c, 'home', {value: c.civ, writable: true, configurable: true, enumerable: false}); for (const id in (c.civs || {})) c.civs[id].tech = c.civ.tech; }
}

const earthF = a => a < 15 ? 1.72 : a < 65 ? 1.62 - .0156 * (a - 15) : .8 * Math.exp(-(a - 65) / 12);
const settlerF = a => a < 15 ? .3 : a < 20 ? .5 : a < 50 ? 1.6 : a < 65 ? .5 : .1;
export function initPop() { state.cols = {}; state.ctx = 'earth'; mkCol('earth', 'Земля', 7e9, {f: earthF, fs: 1, cover: 1, hab: 0, dist: 1, seed: 0}); }
export function mkCol(id, name, T0, o) {
  const f = o.f; let sum = 0; for (let a = 0; a <= 100; a++) sum += f(a);
  const c = [[], [], [], []];
  for (let a = 0; a <= 100; a++) {
    const n = T0 * f(a) / sum;
    let sh = a < 15 ? [1, 0, 0, 0] : a < 26 ? [.7, .24, .05, .01] : [.45, .38, .14, .03];
    for (let s = 0; s < 4; s++) {
      const m = n * sh[s]; let st = 0;
      if (a === 15) st = m; else if (a > 15 && a < 26 && s > 0) st = m * clampN((26 - a) / 12, 0, 1); else if (a < 15) st = m;
      const un = work(a) ? (m - st) * .06 : 0;
      c[s][a] = {n: m, un, st};
    }
  }
  const P = {c, wage: BASEW.slice(), fac: {}, cap: {}, sat: {}, prod: {}, dem: {}, oth: [0, 0, 0, 0], acc: 0, yacc: 0, wbill: 0, tax: 0, birth: 0, death: 0, T0, parInc: [4, 7, 12, 20], bornY: 0, diedY: 0, fs: o.fs, dist: o.dist, hab: o.hab, gImp: {}};
  state.cols[id] = {id, name, pop: P, since: state.t || 0, kind: o.kind || 'hub'};
  withCtx(id, () => {
    let D0 = 0;
    for (const g in GOODS) { let D = 0; for (let a = 0; a <= 100; a++) for (let s = 0; s < 4; s++) D += c[s][a].n * needOf(g, a); P.fac[g] = Math.ceil(D / (PROD * hoursK() * FW()) * o.cover); P.cap[g] = o.seed; P.sat[g] = 1; D0 += D; }
    const J = jobsFac(), E = empBy();
    for (let s = 0; s < 4; s++) P.oth[s] = Math.max(0, E[s] - J[s]);
    P.pop0 = totals().n; stepEcon(30, true);
  });
}
// --- колонии: любое тело можно заселить ---
export const COLONIZABLE = id => { const b = BODY[id]; return !!b && ['planet', 'moon', 'ast'].includes(b.kind); };
export function colInfo(id) {
  const b = BODY[id], a = b.a != null ? b.a : (BODY[b.parent] || {a: 1}).a, d = Math.abs(a - 1), K = colonyCost(id);
  const infra = 2, hab = Math.round(infra * K.per);
  return {hab, infra, per: K.per, cc: K.cc, dist: 1 + .25 * d + (b.kind === 'moon' ? .05 : 0), cost: 2e6 * (1 + d) * (b.kind === 'planet' ? 1.6 : b.kind === 'moon' ? 1.2 : 1), settlers: Math.min(20000, hab)};
}
export function foundWhy(id) {
  if (!COLONIZABLE(id)) return 'Это тело нельзя заселить';
  if (state.cols[id]) return 'Колония уже есть';
  if (!state.ships.some(s => !s.corp && s.at === id)) return 'Нужен ваш корабль на орбите тела';
  const I = colInfo(id); if (state.money < I.cost) return 'Не хватает кредитов: нужно ' + fmtN(I.cost);
  return '';
}
export function foundColony(id) {
  if (foundWhy(id)) return false;
  const I = colInfo(id), b = BODY[id]; state.money -= I.cost;
  takeEarth(I.settlers);
  mkCol(id, b.name, I.settlers, {f: settlerF, fs: .01, cover: .4, hab: I.hab, dist: I.dist, seed: 2e6, kind: b.kind});
  state.cols[id].infra = I.infra;
  log(`Основана колония: ${b.name}. Прибыло ${fmtN(I.settlers)} поселенцев. Здесь действуют те же законы экономики, что и на Земле.`); return true;
}
function takeEarth(q) { // переселенцы уходят из когорт 22–38 лет
  const P = state.cols.earth.pop; let tot = 0; for (let s = 0; s < 4; s++) for (let a = 22; a <= 38; a++) tot += P.c[s][a].n;
  const k = Math.min(.5, q / Math.max(1, tot));
  for (let s = 0; s < 4; s++) for (let a = 22; a <= 38; a++) { const x = P.c[s][a]; x.n *= 1 - k; x.un *= 1 - k; x.st *= 1 - k; }
}
function immigrate(dt) {
  const P = state.pop; if (!P.hab) return;
  const n = P.n || 0, room = P.hab - n - (P.inflight || 0); if (room <= 0) return;
  const vac = clampN(1.02 - (P.mfill || 1), 0, 1), wel = P.avgWel == null ? 1 : P.avgWel;
  const q = Math.min(room, (n * .04 * vac * wel + 100 * wel) * dt / 30);
  if (q <= 0) return;
  takeEarth(q); P.immY = (P.immY || 0) + q;
  if (!dispatchColonists(ctxId(), q)) addSettlers(ctxId(), q); // везут корпорации, без контроля игрока
}
export function addSettlers(id, q) {
  const P = state.cols[id].pop; P.inflight = Math.max(0, (P.inflight || 0) - q);
  for (let a = 22; a <= 38; a++) { const sh = [.45, .38, .14, .03]; for (let s = 0; s < 4; s++) { const x = P.c[s][a], m = q / 17 * sh[s]; x.n += m; x.un += m; } }
}
export function jobsFac() { const P = state.pop, J = civJobs(); for (const g in GOODS) for (let s = 0; s < 4; s++) J[s] += P.fac[g] * FW() * GOODS[g].mix[s]; return J; }
export function empBy() { const P = state.pop, E = [0, 0, 0, 0]; for (let s = 0; s < 4; s++) for (let a = 15; a < 65; a++) { const x = P.c[s][a]; E[s] += Math.max(0, x.n - x.un - x.st); } return E; }
export function totals() {
  const P = state.pop, t = {n: 0, un: 0, st: 0, emp: 0, wf: 0, S: [0, 1, 2, 3].map(() => ({n: 0, un: 0, wf: 0, emp: 0}))};
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    const x = P.c[s][a]; t.n += x.n; t.S[s].n += x.n;
    if (work(a)) { const e = Math.max(0, x.n - x.un - x.st); t.un += x.un; t.emp += e; t.S[s].un += x.un; t.S[s].emp += e; t.S[s].wf += x.n - x.st; t.wf += x.n - x.st; }
    t.st += x.st;
  }
  return t;
}
export function unRate(s) { const t = totals().S[s]; return t.wf > 0 ? t.un / t.wf : 0; }
export function popTaxDay() { if (!state.cols) return 3e5; let t = 0; for (const id in state.cols) t += state.cols[id].pop.tax || 0; return t; }
export function incomeOf(s, a, kind) { const w = state.pop.wage[s] * ageF(a); return kind === 'emp' ? w * hoursK() : kind === 'un' ? w * .3 : w * .4 * (1 + laws().pension / 100); }

export function stepDemog(dt) { // dt в днях (месяц)
  const P = state.pop, f = dt / 360, L = laws();
  const wel = P.wel || {}, lg = P.hab ? clampN(1 - (P.n || 0) / P.hab, 0, 1) : 1, bk = (1 + .5 * L.birthSup / 100) * clampN(1 - (L.hours - 40) / 100, .3, 1.2), mk = 1 + Math.max(0, L.hours - 40) * .01;
  let b = 0, d = 0;
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    const x = P.c[s][a]; if (x.n <= 0) continue;
    const w = (wel[s] && wel[s][a] != null) ? wel[s][a] : 1;
    const q = clampN(mortQ(a) * mk * (1 + 3 * (1 - w)) * f, 0, .5), dd = x.n * q; d += dd;
    const k = 1 - q; x.n *= k; x.un *= k; x.st *= k;
    if (a >= 20 && a < 40) b += x.n * .056 * FERT[s] * (.6 + .4 * w) * f * bk * lg;
  }
  P.c[0][0].n += b; P.c[0][0].st += b; P.birth = b / f; P.death = d / f; P.bornY += b; P.diedY += d;
}
export function parentInc(s) { // средний доход занятых 30–50 лет страты
  const w = state.pop.wage[s]; return w;
}
export function stepAge() {
  const P = state.pop, nw = [[], [], [], []];
  for (let s = 0; s < 4; s++) { for (let a = 0; a <= 100; a++) nw[s][a] = {n: 0, un: 0, st: 0}; }
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) { const x = P.c[s][a], b = nw[s][Math.min(100, a + 1)]; b.n += x.n; b.un += x.un; b.st += x.st; }
  const wage = P.wage;
  for (let a = 15; a <= 26; a++) for (let s = 3; s >= 0; s--) {
    const x = nw[s][a]; if (x.st <= 0) continue;
    let up = 0;
    if (s < 3 && a <= 25) {
      const aff = clampN(P.parInc[s] * 2 / (TUIT[s + 1] * (1 - laws().edu / 100) * 2 + 1e-9), 0, 1), prem = wage[s + 1] / wage[s], inc = clampN((prem - 1) / .3, 0, 1);
      up = aff * inc * CAPS[s];
    }
    const mv = x.st * up, leave = x.st - mv;
    if (mv > 0) { const y = nw[s + 1][a], fr = mv / x.n; y.n += mv; y.st += mv; }
    x.n -= mv; x.st = 0; x.un += leave;
  }
  P.c = nw;
  // рождаемость за год (сброс счётчиков)
  P.bornY = 0; P.diedY = 0;
}
export function stepEcon(dt, init) {
  const P = state.pop, t = totals();
  // 1) безработица и зарплаты
  const L = laws(), el = [1, 1, 1, 1];
  for (let s = 0; s < 4; s++) { const u = t.S[s].wf > 0 ? t.S[s].un / t.S[s].wf : 0, mw = BASEW[s] * clampN(1.3 - 2 * u, .5, 1.4), fl = BASEW[s] * L.minWage / 100; P.wage[s] = Math.max(mw, fl); if (fl > mw) el[s] = 1 - clampN((fl / mw - 1) * .5, 0, .5); }
  // сколько мест
  const J = jobsFac(), E = empBy();
  if (!init) for (let s = 0; s < 4; s++) { const u = t.S[s].wf > 0 ? t.S[s].un / t.S[s].wf : 0; P.oth[s] *= 1 + clampN((u - .05) / .05, -.3, 1) * .004 * dt / 30; }
  const oth = P.oth;
  const fill = [];
  for (let s = 0; s < 4; s++) {
    const need = (J[s] + oth[s]) * el[s], vac = need - E[s];
    if (vac > 0) { // нанимают безработных, молодых в первую очередь
      let hire = Math.min(vac, t.S[s].un * .4);
      for (let a = 15; a < 65 && hire > 0; a++) { const x = P.c[s][a], h = Math.min(hire, x.un); x.un -= h; hire -= h; }
    } else if (vac < 0) { // увольнения: старших первыми
      let fire = -vac;
      for (let a = 64; a >= 15 && fire > 0; a--) { const x = P.c[s][a], e = Math.max(0, x.n - x.un - x.st), h = Math.min(fire, e); x.un += h; fire -= h; }
    }
    const E2 = empBy()[s]; fill[s] = need > 0 ? Math.min(1, E2 / need) : 1;
  }
  // 2) доходы, зарплатный фонд, налог
  let wb = 0;
  const wel = [[], [], [], []], inc = [[], [], [], []];
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    const x = P.c[s][a]; let i;
    if (a < 15) i = P.parInc[s] * 2;
    else if (!work(a)) i = incomeOf(s, 64, 'ret');
    else { const e = Math.max(0, x.n - x.un - x.st); i = x.n > 0 ? (e * incomeOf(s, a, 'emp') + x.un * incomeOf(s, a, 'un') + x.st * incomeOf(s, a, 'un') * .3) / x.n : 0; wb += e * incomeOf(s, a, 'emp'); }
    inc[s][a] = i * (1 - (L.tax - 20) / 100); wel[s][a] = null;
  }
  P.wbill = wb; P.tax = wb * TAXK * L.tax / 20; P.n = t.n;
  // 3) спрос, выпуск, удовлетворённость: покупают у самого дешёвого продавца
  let sn = 0, sw = 0; for (const g in GOODS) { sw += GOODS[g].need; }
  P.mfill = MINE_MIX.reduce((a, m, s) => a + m * fill[s], 0); P.fill = fill;
  const rawNeed = {}, mk = {}; P.staff = P.staff || {};
  rawNeed.si = rawNeed.si || {};
  for (const c of state.corps || []) if (c.civ && c.civ.labs) rawNeed.si[c.id] = (rawNeed.si[c.id] || 0) + c.civ.labs * LAB_SI;
  for (const g in GOODS) {
    let D = 0; for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) D += P.c[s][a].n * needOf(g, a);
    D *= (P.evDem && P.evDem[g]) || 1;
    let staff = 0; for (let s = 0; s < 4; s++) staff += GOODS[g].mix[s] * fill[s];
    const R = goodsMarket(g, D, P.fac[g] * FW() * PROD * hoursK() * staff, staff); mk[g] = R;
    P.dem[g] = D; P.prod[g] = R.cap; P.sat[g] = R.sat; P.staff[g] = staff;
    const r = GOODS[g].raw; rawNeed[r] = rawNeed[r] || {};
    for (const s of R.S) { const id = s.id === 'leg' ? 'leg:' + g : s.id; rawNeed[r][id] = (rawNeed[r][id] || 0) + s.sold / GOODS[g].need * RAW_PER * (s.c ? rawMult(s.c) : 1); }
  }
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    let ws = 0; for (const g in GOODS) ws += P.sat[g] * GOODS[g].need;
    const aff = clampN(inc[s][a] / (basket(a) * (a < 15 ? 1.5 : 1)), 0, 1);
    wel[s][a] = clampN(aff * ws / sw, 0, 1);
  }
  P.wel = wel; P.inc = inc;
  { let w = 0, n = 0; for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) { const m = P.c[s][a].n; w += wel[s][a] * m; n += m; } P.avgWel = n > 0 ? w / n : 1; }
  // расходы государства по законам (в масштабе налога)
  { let stud = 0, ret = 0, ssum = 0; for (let s = 0; s < 4; s++) { for (let a = 15; a <= 100; a++) stud += P.c[s][a].st * TUIT[s]; for (let a = 65; a <= 100; a++) { ret += P.c[s][a].n * P.wage[s] * .4; } }
    const edu = stud * TAXK * L.edu / 100, pen = ret * TAXK * L.pension / 100, bth = (P.birth || 0) / 360 * 40000 * TAXK * L.birthSup / 100;
    P.exp = edu + pen + bth; P.expP = {edu, pen, bth}; void ssum; }
  // информация для вкладки
  const pi = [4, 7, 12, 20];
  for (let s = 0; s < 4; s++) { let tw = 0, te = 0; for (let a = 30; a < 51; a++) { const x = P.c[s][a], e = Math.max(0, x.n - x.un - x.st); tw += e * incomeOf(s, a, 'emp'); te += e; } pi[s] = te > 0 ? tw / te : BASEW[s]; }
  P.parInc = pi;
  // 4) выручка, расходы, сырьё, инвестиции
  P.tarAcc = 0; settleEconomy(mk, rawNeed, dt, init);
  if (!init) { P.tarDay = P.tarAcc / dt; state.money += (P.tarDay - P.exp) * dt; }
}
export function popTick(h) {
  const cs = state.cols; if (!cs) return;
  for (const id in cs) {
    const P = cs[id].pop; P.acc += h; if (P.acc < 30) continue;
    withCtx(id, () => {
      const dt = P.acc; P.acc = 0;
      stepDemog(dt); P.yacc += dt;
      if (P.yacc >= 360) { P.yacc -= 360; stepAge(); }
      immigrate(dt); stepEcon(dt);
    });
  }
}

/* --- вкладка «Население» --- */
export const popUi = {s: 1, a: 42};
export const colSel = () => (state.cols && state.cols[ui.colSel]) ? ui.colSel : 'earth';
export function colPicker() {
  const sel = colSel();
  return `<div class="row" style="flex-wrap:wrap;gap:4px">${Object.values(state.cols).map(c => `<button class="btn sm${c.id === sel ? ' on' : ''}" data-col="${c.id}">${c.name} · ${fmtN(c.pop.n || 0)}</button>`).join('')}</div>`;
}
export function refreshPop() { if (state.cols) withCtx(colSel(), refreshPopI); }
function refreshPopI() {
  const p = $('p-pop'); if (!p || !state.pop) return;
  if (!p._built) {
    p._built = true;
    p.innerHTML = `<div class="box"><div id="pp-pick"></div><h2 id="pp-h">Население</h2><div id="pp-sum"></div></div>
    <div class="box"><h2>Возрастная пирамида</h2><canvas id="pp-cv" width="560" height="300" style="width:100%;max-width:560px;height:auto;background:var(--panel2,#0003);border-radius:6px"></canvas><div class="help">Слева направо: возраст 0–100 по строкам сверху вниз; цвета — страты: ${STR.map((x, i) => `<span style="color:${STR_COL[i]}">■</span> ${x}`).join(' ')}</div></div>
    <div class="box"><h2>Страты</h2><div id="pp-str"></div></div>
    <div class="box"><h2>Товары и заводы</h2><div id="pp-goods"></div><div class="help">Завод нанимает ${fmtN(FACT_W)} человек (на колониях заводы в 100 раз меньше), молодых в первую очередь. Чем больше свободных рук, тем ниже зарплата. Сырьё: 1 т на 10 млн человек в сутки; закупается у вас по ценам рынка, остальное завозят.</div></div>
    <div class="box"><h2>Когорта</h2><div class="row">Страта <select id="pp-s">${STR.map((x, i) => `<option value="${i}">${x}</option>`).join('')}</select> Возраст <input id="pp-a" type="number" min="0" max="100" value="${popUi.a}" style="width:70px"></div><div id="pp-insp"></div></div>`;
    $('pp-s').value = popUi.s;
    $('pp-s').onchange = e => { popUi.s = +e.target.value; refreshPop(); };
    $('pp-a').oninput = e => { popUi.a = clampN(Math.round(+e.target.value || 0), 0, 100); refreshPop(); };
  }
  const P = state.pop, t = totals(), yr = Math.floor(state.t / 360), CL = state.cols[colSel()];
  setHtml($('pp-pick'), colPicker()); $('pp-h').textContent = 'Население: ' + CL.name;
  const tbl = (head, rows) => `<div data-sc style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr>${head.map(x => `<th style="text-align:left;padding:2px 6px">${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td style="padding:2px 6px;border-top:1px solid #8883">${x}</td>`).join('')}</tr>`).join('')}</table></div>`;
  setHtml($('pp-sum'), tbl(['Показатель', 'Значение'], [
    ['Население', fmtN(t.n)], ['Дети 0–14', fmtN(sumAge(0, 14))], ['Трудоспособные 15–64', fmtN(sumAge(15, 64))], ['Старше 65', fmtN(sumAge(65, 100))],
    ['Занято / безработных', `${fmtN(t.emp)} / ${fmtN(t.un)} (${fmtN(t.un / Math.max(1, t.wf) * 100, 1)}%)`], ['Учатся (15+)', fmtN(t.st - sumSt(0, 14))],
    ['Рождаемость / смертность в год', `${fmtN(P.birth)} / ${fmtN(P.death)}`], ['Прирост в год', fmtN((P.birth - P.death) / Math.max(1, t.n) * 100, 2) + '%'],
    ['Фонд зарплат в сутки', fmtN(P.wbill) + ' кр'], ['Налоги вам в сутки', fmtN(P.tax) + ' кр'], ...(P.hab ? [['Вместимость тела', fmtN(P.hab)], ['Переселенцев с Земли за год', fmtN(P.immY || 0)]] : [])]));
  setHtml($('pp-str'), tbl(['Страта', 'Людей', 'Безработных', '%', 'Зарплата/сут', 'Доход занятого 30–50'], [0, 1, 2, 3].map(s => [`<span style="color:${STR_COL[s]}">■</span> ${STR[s]}`, fmtN(t.S[s].n), fmtN(t.S[s].un), fmtN(t.S[s].wf > 0 ? t.S[s].un / t.S[s].wf * 100 : 0, 1), fmtN(P.wage[s], 2), fmtN(P.parInc[s], 2)])));
  setHtml($('pp-goods'), tbl(['Товар', 'Спрос/сут', 'Выпуск', 'Удовл.', 'Цена ×', 'Старых заводов', 'Заводов корпораций', 'Рабочих', 'Капитал', 'Сырьё т/сут'], Object.keys(GOODS).map(g => [GOODS[g].n, fmtN(P.dem[g]), fmtN(P.prod[g]), fmtN(P.sat[g] * 100, 1) + '%', fmtN(P.price ? P.price[g] : 1, 2), fmtN(P.fac[g]), fmtN((state.corps || []).reduce((a, c) => a + (c.civ && c.civ.fac[g] || 0), 0)), fmtN(P.fac[g] * FW()), fmtN(P.cap[g]) + ' кр', fmtN(P.raw && P.raw[g] ? P.raw[g].t : 0, 0) + ' (' + RES[GOODS[g].raw] + ')'])));
  const s = popUi.s, a = popUi.a, x = P.c[s][a], e = work(a) ? Math.max(0, x.n - x.un - x.st) : 0;
  setHtml($('pp-insp'), tbl(['', ''], [
    ['Людей', fmtN(x.n)], ['Безработных', fmtN(x.un)], ['Учатся', fmtN(x.st)], ['Заняты', fmtN(e)],
    ['Средний доход в сутки', fmtN(P.inc[s][a], 2)], ['Потребности в сутки', fmtN(basket(a), 2) + ' (' + Object.keys(GOODS).map(g => GOODS[g].n + ' ' + fmtN(needOf(g, a), 2)).join(', ') + ')'],
    ['Шанс смерти в год', fmtN(mortQ(a) * (1 + 3 * (1 - P.wel[s][a])) * 100, 2) + '%'], ['Рождаемость на человека в год', a >= 20 && a < 40 ? fmtN(.056 * FERT[s] * (.6 + .4 * P.wel[s][a]) * 100, 1) + '%' : '—'], ['Довольство', fmtN(P.wel[s][a] * 100, 0) + '%']]));
  drawPyr();
}
export function sumAge(a0, a1) { let n = 0; for (let s = 0; s < 4; s++) for (let a = a0; a <= a1; a++) n += state.pop.c[s][a].n; return n; }
export function sumSt(a0, a1) { let n = 0; for (let s = 0; s < 4; s++) for (let a = a0; a <= a1; a++) n += state.pop.c[s][a].st; return n; }
export function drawPyr() {
  const cv = $('pp-cv'); if (!cv) return; const g = cv.getContext('2d'), W = cv.width, H = cv.height, P = state.pop;
  g.clearRect(0, 0, W, H); let mx = 1; for (let a = 0; a <= 100; a++) { let n = 0; for (let s = 0; s < 4; s++) n += P.c[s][a].n; mx = Math.max(mx, n); }
  const rh = (H - 10) / 101;
  for (let a = 0; a <= 100; a++) { let x0 = 40; for (let s = 0; s < 4; s++) { const w = P.c[s][a].n / mx * (W - 60); g.fillStyle = STR_COL[s]; g.fillRect(x0, 5 + a * rh, w, rh - .5); x0 += w; } }
  g.fillStyle = '#999'; g.font = '11px sans-serif'; for (let a = 0; a <= 100; a += 20) g.fillText(a, 6, 5 + a * rh + 9);
  g.fillStyle = '#fff'; const ya = 5 + popUi.a * rh; g.fillRect(30, ya, 8, Math.max(2, rh));
}
