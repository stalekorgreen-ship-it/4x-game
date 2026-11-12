// @ts-nocheck
import { gd } from './00-gd.ts';
import { colN } from './19-colbld.ts';
import { tm } from './15-techs.ts';
import {colonyCost} from './14-climate.ts';
import { climTick, heatDeath, heatWork } from './28-climate.ts';
import { BODY, RES, fmtN, log, rec, state } from './01-data.ts';
import { logMarket, logJobs, lsShare } from './25-logistics.ts';
import { GOODS, UT, LOG_IN, goodsOrder, prodOf, tOf, unitOf , wkOf} from './26-goods.ts';
import { KR } from './00-kr.ts';
import { hooks } from './00-hooks.ts';
import { regTick, addRegPeople, regsOf, regTemplate, regHab, regClim } from './30-regions.ts';
import { BIOMES } from './37-biomes.ts';
import { PRICE } from './06-corps.ts';
import { laws } from './12-state.ts';
import { LAB_SI, MINE_MIX, civJobs, goodsMarket, rawMult, settleEconomy, matDemand } from './10-civil.ts';
import { $, H, W, cv, esc, setHtml, ui } from './08-map-ui.ts';
import { dispatchColonists } from './13-freight.ts';
/* ===== НАСЕЛЕНИЕ ЗЕМЛИ: 4 страты × возраст 0..100 ===== */
export const STR = ['Школьное', 'Среднее', 'Высшее', 'Максимальное'], STR_COL = ['#8a97ab', '#4f9d8a', '#d3a44a', '#b8567a'];
export { GOODS };
const EC = gd('economy', 'population', {OTHER_MIX: [.45, .4, .13, .02], FACT_W: 10000, PROD: 40, RAW_PER: 1, BASEW: [100, 175, 300, 500], TUIT: [0, 50, 100, 175], FACT_COST_KR: 2e8, TAXK: 1.25e-6});
// RAW_PER — руда на тонну товара (в 10 раз меньше прежнего, решено с владельцем); FACT_COST_KR — цена завода корпорации в «кр без KR»
export const OTHER_MIX = EC.OTHER_MIX, FACT_W = EC.FACT_W, PROD = EC.PROD, RAW_PER = EC.RAW_PER, BASEW = EC.BASEW, TUIT = EC.TUIT, FACT_COST = EC.FACT_COST_KR * KR, TAXK = EC.TAXK;
/* Налоги, вариант Б: казна собирает полный налог, почти всё уходит на земные расходы (оборона, соцсфера, инфраструктура),
   на космос — доля L.space % (по умолчанию 0,5%), и она проседает при старении (меньше работников на пенсионера). */
export const spaceK = () => ((state.laws && state.laws.space != null ? state.laws.space : .5) / 100);
export const CAPS = [.4, .3, .1], FERT = [1.25, 1.1, .8, .55];
// Рождаемость (реалистичная модель): суммарный коэффициент — детей на женщину за жизнь — по образованию матери; для замещения поколений нужно 2,1.
// Чем больше образованных, тем ниже рождаемость; плюс медленная «модернизация» (урбанизация, контрацепция, поздние браки) снижает её у всех слоёв.
export const TFR0 = [2.6, 1.9, 1.5, 1.2];
export const ASF = (() => { const w = []; let t = 0; for (let a = 0; a <= 100; a++) { const v = a >= 15 && a < 50 ? Math.pow(a - 14, 3) * Math.exp(-(a - 14) / 4.6) : 0; w.push(v); t += v; } return w.map(v => v / t); })(); // пик 27–30 лет
export const tfMod = () => { const y = (state.t || 0) / 360; return .72 + .28 * Math.exp(-y / 40); }; // к 2100 году рождаемость ниже на четверть (мировой коэффициент с 2,3 до ~1,7)
export const ageF = a => a < 25 ? .7 : a < 30 ? .85 : a < 55 ? 1 : 1.05;
export const needF = a => a < 15 ? .7 : a >= 65 ? 1.1 : 1;
const ageK = (G, a) => { for (const [m, k] of G.ages) if (a < m) return k; return 0; };
// Потребление по таблице «Пояс» (вкладка «Потребление»): na — на 1 млн человек в год по возрастам 0–12, 12–18, 18–30, 30–55, 55–80, 80–100; naK — перевод в единицы на человека в сутки
export const NA_AGES = [12, 18, 30, 55, 80, 101];
const naBand = a => { for (let i = 0; i < NA_AGES.length; i++) if (a < NA_AGES[i]) return i; return NA_AGES.length - 1; };
export const needOf = (g, a, s = 1) => { const G = GOODS[g]; if (!G.need || (G.space && ctxId() === 'earth')) return 0; if (G.na) return G.na[naBand(a)] * G.naK * (G.ns ? G.ns[s] : 1); if (G.ages) return G.need * ageK(G, a) * (G.ns ? G.ns[s] : 1); return G.need * needF(a) * (G.old && a >= 50 ? 1 + (a - 50) / 25 : 1) * (G.ns ? G.ns[s] : 1); };
export const basket = (a, s = 1) => { let b = 0; for (const g in GOODS) b += needOf(g, a, s); return b; };
// полный спрос с учётом рецептов: конечный спрос населения тянет полуфабрикаты и энергию
export function fullDemand(c, L = 0) { const D = {}; for (const g of goodsOrder()) D[g] = 0; for (const g in LOG_IN) if (D[g] != null) D[g] += L * LOG_IN[g];
  for (const g of goodsOrder()) { if (GOODS[g].need) for (let a = 0; a <= 100; a++) for (let s = 0; s < 4; s++) D[g] += c[s][a].n * needOf(g, a, s);
    for (const k in GOODS[g].in) if (GOODS[k]) D[k] += D[g] * GOODS[g].in[k]; }
  return D; }
export const work = a => a >= 15 && a < 65;
export const mortQ = a => a < 1 ? .02 : .0006 + .000035 * Math.exp(Math.min(a, 100) / 10.5); // ожидаемая жизнь ≈ 73–75 лет на старте
export const clampN = (x, a, b) => Math.max(a, Math.min(b, x));
export const fs = () => (state.pop && state.pop.fs) || 1;
export const FW = () => FACT_W * fs();
export const FC = () => FACT_COST * fs();
export const hoursK = () => laws().hours / 40 * heatWork(ctxId()); // жара снижает выработку
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
// старые сохранения: товаров вроде «еды» больше нет
function dropOldGoods(o) { if (o) for (const k of ['fac', 'cap', 'pr', 'sold', 'unitc', 'comp']) if (o[k]) for (const g in o[k]) if (!GOODS[g]) delete o[k][g]; }
export function relinkCols() {
  for (const id in state.cols || {}) dropOldGoods(state.cols[id].pop);
  for (const c of state.corps || []) { dropOldGoods(c.civ); for (const id in c.civs || {}) dropOldGoods(c.civs[id]); }
  if (!state.cols) { state.cols = {earth: {id: 'earth', name: 'Земля', pop: state.pop}}; }
  state.ctx = 'earth'; setPop(state.cols.earth.pop);
  for (const c of state.corps || []) { Object.defineProperty(c, 'home', {value: c.civ, writable: true, configurable: true, enumerable: false}); for (const id in (c.civs || {})) c.civs[id].tech = c.civ.tech; }
}

export const earthF = a => a < 15 ? 1.72 : a < 65 ? 1.62 - .0156 * (a - 15) : .8 * Math.exp(-(a - 65) / 12);
const settlerF = a => a < 15 ? .3 : a < 20 ? .5 : a < 50 ? 1.6 : a < 65 ? .5 : .1;
export function initPop() { state.cols = {}; state.ctx = 'earth'; mkCol('earth', 'Земля', 8.5e9, {f: earthF, fs: 1, cover: EARTH_COVER, hab: 0, dist: 1, seed: 0}); }
const cov = (o, g) => typeof o.cover === 'object' ? (o.cover[g] != null ? o.cover[g] : o.cover.def) : o.cover;
// Земля 2030 (решено с владельцем): мир в плохом состоянии — дефицит медицины, электроники и др.; Африка и Индия страдают сильнее (регионы)
export const EARTH_COVER = gd('economy', 'earthStart', {def: .95, meds: .78, elx: .8, wear: .85, house: .88, edu: .85, exp: .8, pow: .9}); // доля спроса, которую закрывают госзаводы Земли на старте
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
    const FD = fullDemand(c); for (const g in GOODS) { const D = FD[g]; P.fac[g] = Math.ceil(D / (prodOf(g) * hoursK() * FW()) * cov(o, g)); P.cap[g] = o.seed; P.sat[g] = 1; D0 += D; }
    const J = jobsFac(), E = empBy();
    for (let s = 0; s < 4; s++) P.oth[s] = Math.max(0, E[s] - J[s]);
    P.pop0 = totals().n; stepEcon(30, true);
    { const J2 = jobsFac(), E2 = empBy(); for (let s = 0; s < 4; s++) P.oth[s] = Math.max(0, E2[s] - J2[s]); } // госшахты считаются после первого прохода: прочая занятость (сфера услуг) — остаток
    { const FD = fullDemand(c, P.log ? P.log.L : 0); for (const g in GOODS) P.fac[g] = Math.ceil(FD[g] / (prodOf(g) * hoursK() * FW()) * cov(o, g)); { const J2 = jobsFac(), E2 = empBy(); for (let s = 0; s < 4; s++) P.oth[s] = Math.max(0, E2[s] - J2[s]); } stepEcon(30, true); } // второй проход: спрос транспорта на топливо и машины
  });
}
// --- колонии: любое тело можно заселить ---
export const COLONIZABLE = id => { const b = BODY[id]; return !!b && ['planet', 'moon', 'ast'].includes(b.kind); };
export function colInfo(id) {
  const b = BODY[id], a = b.a != null ? b.a : (BODY[b.parent] || {a: 1}).a, d = Math.abs(a - 1), K = colonyCost(id);
  const infra = 2, hab = Math.round(infra * K.per);
  return {hab, infra, per: K.per, cc: K.cc, dist: 1 + .25 * d + (b.kind === 'moon' ? .05 : 0), settlers: Math.min(20000, hab)};
}
export function foundWhy(id) {
  if (!COLONIZABLE(id)) return 'Это тело нельзя заселить';
  if (state.cols[id]) return 'Колония уже есть';
  if (state.freight && state.freight.flights.some(f => f.item === 'col' && f.to === id)) return 'Колонисты уже летят';
  return '';
}
export function foundColony(id) {
  if (foundWhy(id)) return false;
  // колония ничего не стоит: корпорация везёт поселенцев с Земли, колония появляется, когда там живёт хоть один человек
  const I = colInfo(id); takeEarth(I.settlers); hooks.sendColonists(id, I.settlers);
  log(`К «${BODY[id].name}» вылетели ${fmtN(I.settlers)} поселенцев. Колония появится по прибытии.`); return true;
}
export function settle(id, q) { // первые жители прибыли — колония существует
  const I = colInfo(id), b = BODY[id];
  mkCol(id, b.name, q, {f: settlerF, fs: .01, cover: .4, hab: I.hab, dist: I.dist, seed: 2e6 * KR, kind: b.kind});
  state.cols[id].infra = I.infra;
  log(`Основана колония: ${b.name}. Прибыло ${fmtN(q)} поселенцев. Здесь действуют те же законы экономики, что и на Земле.`);
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
  const P = state.cols[id].pop; P.inflight = Math.max(0, (P.inflight || 0) - q); addRegPeople(id, q);
  for (let a = 22; a <= 38; a++) { const sh = [.45, .38, .14, .03]; for (let s = 0; s < 4; s++) { const x = P.c[s][a], m = q / 17 * sh[s]; x.n += m; x.un += m; } }
}
export function jobsFac() { const P = state.pop, J = civJobs(), LJ = logJobs(P, state.corps || []), E = empBy(), ls = lsShare(ctxId()); for (let s = 0; s < 4; s++) J[s] += LJ[s] + E[s] * ls + ((P.lmN || 0) + (P.lcN || 0)) * FW() * MINE_MIX[s]; // + госшахты (10 000 чел. каждая) + жизнеобеспечение (гидропоника и т. п.)
  for (const g in GOODS) { const wk = wkOf(g, g === 'pow' && ctxId() === 'earth' ? state.govMix : null); for (let s = 0; s < 4; s++) J[s] += P.fac[g] * FW() * GOODS[g].mix[s] * wk; } return J; }
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
export function popTaxDay() { if (!state.cols) return 3e5 * KR; let t = 0; for (const id in state.cols) t += state.cols[id].pop.tax || 0; return t; }
export function incomeOf(s, a, kind) { const w = state.pop.wage[s] * ageF(a); return kind === 'emp' ? w * hoursK() : kind === 'un' ? w * .3 : w * .4 * (1 + laws().pension / 100); }

export function stepDemog(dt) { // dt в днях (месяц)
  const P = state.pop, f = dt / 360, L = laws();
  const wel = P.wel || {}, lg = P.hab ? clampN(1 - (P.n || 0) / P.hab, 0, 1) : 1, bk = tm('birth') * (1 + .5 * L.birthSup / 100) * (ctxId() === 'earth' && hooks.benefits ? hooks.benefits().birthK : 1) * clampN(1 - (L.hours - 40) / 100, .3, 1.2), mk = heatDeath(ctxId()) * tm('death') * (1 - .01 * (hooks.mandOver ? hooks.mandOver('mMed') : 0)) * (1 + Math.max(0, L.hours - 40) * .01) * Math.pow(.92, colN(ctxId(), 'clinic')); const bk2 = 1 + .06 * colN(ctxId(), 'nursery');
  let b = 0, d = 0; const medQ = 1e-4 * 100 * Math.max(0, 1 - ((P.sat && P.sat.meds != null) ? P.sat.meds : 1)) + (hooks.polMort ? hooks.polMort(ctxId()) : 0); // + загрязнение: 0,01% за каждый 1% // нехватка медицины: +0,01% смертности в год за каждый недостающий процент
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    const x = P.c[s][a]; if (x.n <= 0) continue;
    const w = (wel[s] && wel[s][a] != null) ? wel[s][a] : 1;
    const q = clampN((mortQ(a) * mk * (1 + 3 * (1 - w)) + medQ) * f, 0, .5), dd = x.n * q; d += dd;
    const k = 1 - q; x.n *= k; x.un *= k; x.st *= k;
    if (a >= 15 && a < 50) b += x.n * .5 * TFR0[s] * ASF[a] * tfMod() * (.85 + .15 * w) * f * bk * bk2 * lg; // половина — женщины; дети на женщину по образованию × возрастной профиль
  }
  P.c[0][0].n += b; P.c[0][0].st += b; P.birth = b / f; P.death = d / f; P.bornY += b; P.diedY += d;
}
export function parentInc(s) { // средний доход занятых 30–50 лет страты
  const w = state.pop.wage[s]; return w;
}
// f — доля года: старение идёт плавно каждый месяц (раньше раз в год скачком — от этого прыгали занятость, налоги и прирост)
export function stepAge(f = 1, reset = true) {
  const P = state.pop, old = P.c, nw = [[], [], [], []];
  for (let s = 0; s < 4; s++) { for (let a = 0; a <= 100; a++) nw[s][a] = {n: 0, un: 0, st: 0}; }
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) { const x = P.c[s][a], b = nw[s][Math.min(100, a + 1)]; b.n += x.n; b.un += x.un; b.st += x.st; }
  const wage = P.wage;
  for (let a = 15; a <= 26; a++) for (let s = 3; s >= 0; s--) {
    const x = nw[s][a]; if (x.st <= 0) continue;
    let up = 0;
    if (s < 3 && a <= 25) {
      const aff = clampN((1 + .12 * colN(ctxId(), 'school')) * P.parInc[s] * 2 / (TUIT[s + 1] * (1 - Math.min(100, laws().edu + 3 * (hooks.mandOver ? hooks.mandOver('mEdu') : 0)) / 100) * 2 + 1e-9), 0, 1), prem = wage[s + 1] / wage[s], inc = clampN((prem - 1) / .3, 0, 1);
      const es = P.sat && (s < 2 ? P.sat.edu : P.sat.exp); up = aff * inc * CAPS[s] * (es == null ? 1 : es); // нехватка образования (экспертного — для перехода в эксперты) снижает переход в следующую страту
    }
    const mv = x.st * up, leave = x.st - mv;
    if (mv > 0) { const y = nw[s + 1][a], fr = mv / x.n; y.n += mv; y.st += mv; }
    x.n -= mv; x.st = 0; x.un += leave;
  }
  if (f < 1) for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) { const o = old[s][a], q = nw[s][a]; q.n = o.n + (q.n - o.n) * f; q.un = o.un + (q.un - o.un) * f; q.st = o.st + (q.st - o.st) * f; }
  P.c = nw;
  // рождаемость за год (сброс счётчиков)
  if (reset) { P.bornY = 0; P.diedY = 0; }
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
  // регионы: миграция и несовпадение людей и рабочих мест по регионам (30-regions)
  if (!init) { P.n = t.n; let Jt = 0; for (let s = 0; s < 4; s++) Jt += J[s] + oth[s]; P.regK = regTick(ctxId(), P, Jt, t.wf, dt, t); }
  for (let s = 0; s < 4; s++) fill[s] *= P.regK || 1;
  // 2) доходы, зарплатный фонд, налог
  let wb = 0; const BEN = ctxId() === 'earth' && hooks.benefits ? hooks.benefits() : {ret: 0, un: 0, vat: 0, birthK: 1};
  const wel = [[], [], [], []], inc = [[], [], [], []];
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    const x = P.c[s][a]; let i;
    if (a < 15) i = P.parInc[s] * 2;
    else if (!work(a)) i = incomeOf(s, 64, 'ret') + BEN.ret; // + обязательная пенсия (бюджет)
    else { const e = Math.max(0, x.n - x.un - x.st); i = x.n > 0 ? (e * incomeOf(s, a, 'emp') + x.un * (incomeOf(s, a, 'un') + BEN.un) + x.st * incomeOf(s, a, 'un') * .3) / x.n : 0; wb += e * incomeOf(s, a, 'emp'); }
    inc[s][a] = i * (1 - (L.tax - 20) / 100); wel[s][a] = null;
  }
  P.wbill = wb; P.taxFull = wb * L.tax / 100 * tm('tax');
  { let wk = 0, rt = 0; for (let s = 0; s < 4; s++) { for (let a = 15; a < 65; a++) wk += P.c[s][a].n; for (let a = 65; a <= 100; a++) rt += P.c[s][a].n; }
    const r = rt > 0 ? wk / rt : 10; if (!P.dep0) P.dep0 = r; P.depK = clampN(r / P.dep0, .3, 1.5); }
  P.tax = P.taxFull * spaceK() * P.depK; P.invDay = ctxId() === 'earth' ? P.taxFull * ((L.inv == null ? 3 : L.inv) / 100) : 0; P.earthExp = P.taxFull - P.tax - P.invDay; P.n = t.n;
  if (!init && P.invDay) state.invFund = (state.invFund || 0) + P.invDay * dt; // фонд госинвестиций (экономические постройки)
  // 3) спрос, выпуск, удовлетворённость: покупают у самого дешёвого продавца
  let sn = 0, sw = 0; for (const g in GOODS) { sw += GOODS[g].need; }
  P.mfill = MINE_MIX.reduce((a, m, s) => a + m * fill[s], 0); P.fill = fill;
  const rawNeed = {}, mk = {}; P.staff = P.staff || {};
  rawNeed.si = rawNeed.si || {};
  for (const c of state.corps || []) if (c.civ && c.civ.labs) rawNeed.si[c.id] = (rawNeed.si[c.id] || 0) + c.civ.labs * LAB_SI;
  const DI = {}; for (const g in GOODS) DI[g] = 0;
  if (P.log) for (const g in LOG_IN) if (GOODS[g]) DI[g] += P.log.L * LOG_IN[g]; // транспорт жжёт топливо, изнашивает машины
  if (ctxId() === 'earth' && !init) { const MD = matDemand(); for (const g in MD) if (GOODS[g]) DI[g] += MD[g]; } // корабли и станции корпораций
  const sat0 = P.sat0 || {}, add = (r, id, q) => { rawNeed[r] = rawNeed[r] || {}; rawNeed[r][id] = (rawNeed[r][id] || 0) + q; };
  for (const g of goodsOrder()) { // сверху вниз по цепочке: сначала конечные товары, потом их входы
    const G = GOODS[g]; if (P.fac[g] == null) { P.fac[g] = 0; P.cap[g] = 0; P.sat[g] = 1; }
    let D = 0; if (G.need) for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) D += P.c[s][a].n * needOf(g, a, s);
    D = D * ((P.evDem && P.evDem[g]) || 1) + DI[g];
    let staff = 0; for (let s = 0; s < 4; s++) staff += G.mix[s] * fill[s];
    let inS = 1; for (const k in G.in) if (GOODS[k]) inS = Math.min(inS, sat0[k] == null ? 1 : sat0[k]); else if (P.rawSat && P.rawSat[k] != null) inS = Math.min(inS, .3 + .7 * P.rawSat[k]); // нет входа — нет выпуска
    const gk = ctxId() === 'earth' && hooks.govStaffK ? hooks.govStaffK(g, P) : 1; // фикс. зарплата учителей/врачей ниже рынка — часть госшкол и больниц пустует
    const R = goodsMarket(g, D, P.fac[g] * FW() * prodOf(g) * tm('prod') * hoursK() * staff * inS * gk, staff, inS); mk[g] = R;
    P.dem[g] = D; P.prod[g] = R.cap; P.sat[g] = R.sat; P.staff[g] = staff;
    for (const k in G.in) if (GOODS[k]) DI[k] += R.sold * G.in[k];
      else for (const s of R.S) if (s.id !== 'imp') add(k, s.id === 'leg' ? 'leg:' + g : s.id, s.sold * G.in[k] * RAW_PER * (s.c ? rawMult(s.c) : 1));
  }
  P.sat0 = {...P.sat};
  // логистика: все сделки на теле требуют т·км; не хватило — часть товара не доезжает
  { let T = 0; for (const g in GOODS) T += mk[g].sold * tOf(g); for (const r in rawNeed) for (const id in rawNeed[r]) T += rawNeed[r][id];
    const lg = logMarket(P, ctxId(), (state.corps || []).filter(c => c.civ), T, fill, dt, init);
    if (lg.sat < 1) for (const g in GOODS) P.sat[g] *= lg.sat; }
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    let ws = 0, sw = 0; for (const g in GOODS) { const q = needOf(g, a, s); if (!(q > 0)) continue; const w = GOODS[g].ww != null ? GOODS[g].ww : 5; ws += P.sat[g] * w; sw += w; } // вклад в довольство — веса из таблицы «Потребление»
    const aff = clampN(inc[s][a] / (basket(a, s) * (a < 15 ? 1.5 : 1) * (1 + BEN.vat)), 0, 1); // НДС дорожит корзину
    wel[s][a] = clampN(aff * (sw > 0 ? ws / sw : 1), 0, 1);
  }
  P.wel = wel; P.inc = inc;
  { let w = 0, n = 0; for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) { const m = P.c[s][a].n; w += wel[s][a] * m; n += m; } P.avgWel = n > 0 ? w / n : 1; }
  // расходы государства по законам (в масштабе налога)
  { let stud = 0, ret = 0, ssum = 0; for (let s = 0; s < 4; s++) { for (let a = 15; a <= 100; a++) stud += P.c[s][a].st * TUIT[s]; for (let a = 65; a <= 100; a++) { ret += P.c[s][a].n * P.wage[s] * .4; } }
    const k = spaceK(), edu = stud * k * L.edu / 100, pen = ret * k * L.pension / 100, bth = (P.birth || 0) / 360 * 40000 * KR * k * L.birthSup / 100;
    P.exp = edu + pen + bth; P.expP = {edu, pen, bth}; void ssum; }
  // информация для вкладки
  const pi = BASEW.slice();
  for (let s = 0; s < 4; s++) { let tw = 0, te = 0; for (let a = 30; a < 51; a++) { const x = P.c[s][a], e = Math.max(0, x.n - x.un - x.st); tw += e * incomeOf(s, a, 'emp'); te += e; } pi[s] = te > 0 ? tw / te : BASEW[s]; }
  P.parInc = pi;
  // 4) выручка, расходы, сырьё, инвестиции
  P.tarAcc = 0; settleEconomy(mk, rawNeed, dt, init);
  if (!init) { P.tarDay = P.tarAcc / dt; state.money += (P.tarDay - P.exp) * dt; if (ctxId() === 'earth' && hooks.budgetTick) hooks.budgetTick(P, dt, spaceK() * (P.depK || 1)); }
}
export function popTick(h) {
  const cs = state.cols; if (!cs) return;
  for (const id in cs) {
    const P = cs[id].pop; P.acc += h; if (P.acc < 30) continue;
    withCtx(id, () => {
      const dt = P.acc; P.acc = 0;
      stepDemog(dt); P.yacc += dt;
      stepAge(Math.min(1, dt / 360), false); if (P.yacc >= 360) { P.yacc -= 360; P.bornY = 0; P.diedY = 0; }
      immigrate(dt); stepEcon(dt);
      climTick(id, P, GOODS, g => (P.dem[g] || 0) * (P.sat[g] || 0) / (FW() * prodOf(g) * hoursK()), dt); if (hooks.bioTick) hooks.bioTick(id, dt / 360);
    });
  }
}

/* --- вкладка «Население» --- */
export const popUi = {s: 1, a: 42, reg: null};
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
    p.innerHTML = `
    <div class="box"><div id="pp-pick"></div>
      <div class="row" style="gap:4px;margin-top:6px" id="pp-tabs">
        <button class="btn sm on" data-ppt="sum">Сводка</button>
        <button class="btn sm" data-ppt="reg">Регионы</button>
        <button class="btn sm" data-ppt="str">Страты</button>
        <button class="btn sm" data-ppt="goods">Товары</button>
        <button class="btn sm" data-ppt="coh">Когорта</button>
      </div>
    </div>
    <div id="pp-t-sum">
      <div class="box"><h2 id="pp-h">Население</h2>
        <div class="pop-top"><div id="pp-sum"></div><div><canvas id="pp-cv" width="180" height="220" style="width:100%;height:auto;background:var(--panel2,#0003);border-radius:4px;display:block"></canvas><div class="help" style="font-size:10px;margin-top:3px">${STR.map((x, i) => `<span style="color:${STR_COL[i]}">■</span>${x}`).join(' ')}</div></div></div>
      </div>
    </div>
    <div id="pp-t-reg" hidden><div class="box"><h2>Регионы</h2><div id="pp-reg"></div><div class="help">Заводы нанимают людей своего региона; мигранты едут туда, где не хватает рабочих мест.</div></div></div>
    <div id="pp-t-str" hidden><div class="box"><h2>Страты</h2><div id="pp-str"></div></div></div>
    <div id="pp-t-goods" hidden><div class="box"><h2>Товары и заводы</h2><div id="pp-goods"></div><div class="help">Завод нанимает ${fmtN(FACT_W)} чел. Сырьё: 1 т на 10 млн чел./сут.</div></div></div>
    <div id="pp-t-coh" hidden><div class="box"><h2>Когорта</h2><div class="row">Страта <select id="pp-s">${STR.map((x, i) => `<option value="${i}">${x}</option>`).join('')}</select> Возраст <input id="pp-a" type="number" min="0" max="100" value="${popUi.a}" style="width:70px"></div><div id="pp-insp"></div></div></div>`;
    $('pp-s').value = popUi.s;
    $('pp-s').onchange = e => { popUi.s = +e.target.value; refreshPop(); };
    $('pp-a').oninput = e => { popUi.a = clampN(Math.round(+e.target.value || 0), 0, 100); refreshPop(); };
    $('pp-tabs').addEventListener('click', e => {
      const b = e.target.closest('[data-ppt]'); if (!b) return;
      $('pp-tabs').querySelectorAll('.btn').forEach(x => x.classList.remove('on')); b.classList.add('on');
      ['sum','reg','str','goods','coh'].forEach(t => { const el = $('pp-t-' + t); if (el) el.hidden = t !== b.dataset.ppt; });
      popUi.tab = b.dataset.ppt; refreshPop();
    });
  }
  popUi.tab = popUi.tab || 'sum';
  const P = state.pop, t = totals(), yr = Math.floor(state.t / 360), CL = state.cols[colSel()];
  setHtml($('pp-pick'), colPicker()); const ppH = $('pp-h'); if(ppH) ppH.textContent = 'Население: ' + CL.name;
  const pTab = popUi.tab || 'sum';
  const tbl = (head, rows) => `<div data-sc style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr>${head.map(x => `<th style="text-align:left;padding:2px 6px">${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td style="padding:2px 6px;border-top:1px solid #8883">${x}</td>`).join('')}</tr>`).join('')}</table></div>`;
  const kv2 = rows => `<div class="kv2">${rows.map(([k, v]) => `<span class="kv-k">${k}</span><span class="kv-v">${v}</span>`).join('')}</div>`;
  setHtml($('pp-sum'), kv2([
    ['Население', fmtN(t.n)], ['Прирост/год', fmtN((P.birth - P.death) / Math.max(1, t.n) * 100, 2) + '%'],
    ['Дети 0–14', fmtN(sumAge(0, 14))], ['15–64', fmtN(sumAge(15, 64))],
    ['Занято', fmtN(t.emp)], ['Безраб.', `${fmtN(t.un)} (${fmtN(t.un / Math.max(1, t.wf) * 100, 1)}%)`],
    ['Рождений/год', fmtN(P.birth)], ['Смертей/год', fmtN(P.death)],
    ['ФЗП/мес', fmtN(P.wbill * 30) + ' кр'], ['Налоги/мес', fmtN((P.taxFull || 0) * 30) + ' кр'],
    ['Расходы Земли/мес', fmtN((P.earthExp || 0) * 30) + ' кр'], ['Доля космоса', fmtN(spaceK() * 100, 2) + '%×' + fmtN((P.depK || 1) * 100, 0) + '%'],
    ['Вам/мес', fmtN(P.tax * 30) + ' кр'], ...(P.hab ? [['Вместимость', fmtN(P.hab)], ['Иммигр./год', fmtN(P.immY || 0)]] : []),
    ...(P.log ? [['Логистика', P.log.how], ['Плечо', `${fmtN(P.log.D, 0)} / ${fmtN(P.log.d, 0)} км`], ['Доставка 1 т', fmtN(P.log.perT, 2) + ' кр'], ['Покрытие', fmtN(P.log.sat * 100, 1) + '%']] : [])
  ]));
  if (pTab === 'sum') {
    setHtml($('pp-sum'), kv2([
      ['Население', fmtN(t.n)], ['Прирост/год', fmtN((P.birth - P.death) / Math.max(1, t.n) * 100, 2) + '%'],
      ['Дети 0–14', fmtN(sumAge(0, 14))], ['15–64', fmtN(sumAge(15, 64))],
      ['Занято', fmtN(t.emp)], ['Безраб.', `${fmtN(t.un)} (${fmtN(t.un / Math.max(1, t.wf) * 100, 1)}%)`],
      ['Рождений/год', fmtN(P.birth)], ['Смертей/год', fmtN(P.death)],
      ['ФЗП/мес', fmtN(P.wbill * 30) + ' кр'], ['Налоги/мес', fmtN((P.taxFull || 0) * 30) + ' кр'],
      ['Расходы Земли/мес', fmtN((P.earthExp || 0) * 30) + ' кр'], ['Доля космоса', fmtN(spaceK() * 100, 2) + '%×' + fmtN((P.depK || 1) * 100, 0) + '%'],
      ['Вам/мес', fmtN(P.tax * 30) + ' кр'], ...(P.hab ? [['Вместимость', fmtN(P.hab)], ['Иммигр./год', fmtN(P.immY || 0)]] : []),
      ...(P.log ? [['Логистика', P.log.how], ['Плечо', `${fmtN(P.log.D, 0)} / ${fmtN(P.log.d, 0)} км`], ['Доставка 1 т', fmtN(P.log.perT, 2) + ' кр'], ['Покрытие', fmtN(P.log.sat * 100, 1) + '%']] : [])
    ]));
    drawPyr();
  }
  if (pTab === 'reg') {
    const id = colSel(), R = regsOf(id), T = regTemplate(id), n = R.reduce((a, r) => a + r.n, 0) || 1, jw = R.reduce((a, r) => a + r.jw, 0) || 1, f0 = x => (x >= 0 ? '+' : '') + fmtN(x, 0);
    const C = R.map((r, i) => regClim(id, i)), pc = x => fmtN(x * 100, 1) + '%', sel = popUi.reg != null && R[popUi.reg] ? popUi.reg : null;
    const rows = R.map((r, i) => `<tr data-reg="${i}" style="cursor:pointer${sel === i ? ';background:#ffffff14' : ''}">` + [T[i].n, fmtN(r.n), r.un != null ? `${fmtN(r.un)} (${pc(r.un / Math.max(1, r.un + (r.emp || 0)))})` : '—', r.wage ? fmtN(r.wage, 0) + ' кр' : '—',
      (r.mig > 0 ? '+' : '') + fmtN(r.mig || 0), r.sat ? (() => { const w = Object.keys(r.sat).sort((a, b) => r.sat[a] - r.sat[b])[0]; return w && r.sat[w] < .95 ? `<span class="${r.sat[w] < .7 ? 'err' : 'warn'}">${pc(r.wel)} (${GOODS[w].n} ${pc(r.sat[w])})</span>` : pc(r.wel); })() : '—', `${fmtN(C[i].mean, 0)} (${fmtN(C[i].min, 0)}…${fmtN(C[i].max, 0)})`, C[i].air ? pc(C[i].total) : 'вся (нет воздуха)', ...(P.hab ? [fmtN(regHab(id, i))] : [])].map(x => `<td style="padding:2px 6px;border-top:1px solid #ffffff14">${x}</td>`).join('') + '</tr>').join('');
    let h = `<div data-sc style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr>${['Регион', 'Население', 'Безработных', 'Ср. зарплата/сут', 'Миграция в год', 'Товаров (худший)', 'T °C ср. (мин…макс)', 'Непригодно для жизни', ...(P.hab ? ['Вместимость'] : [])].map(x => `<th style="text-align:left;padding:2px 6px">${x}</th>`).join('')}</tr>${rows}</table></div>
      <div class="help">Заводы укомплектованы с учётом регионов на ${fmtN((P.regK || 1) * 100, 1)}%. Нажмите строку — подробная статистика региона.</div>`;
    if (sel != null) { const r = R[sel], t0 = T[sel], c = C[sel], mts = Math.round((t0.mtn || 0) * 100);
      const feat = [t0.desert ? `пустыни ${pc(t0.desert)}` : '', t0.cold ? `мерзлота и лёд ${pc(t0.cold)}` : '', t0.hot ? `жаркие низины ${pc(t0.hot)}` : '', t0.coast ? `низкие побережья ${pc(t0.coast)}` : '', mts ? `${t0.t ? 'горы' : 'горы и кратеры'} ${mts}% (перевозки внутри региона дороже на ${Math.round(mts / 2)}%)` : ''].filter(Boolean).join(', ');
      h += `<h3>${esc(t0.n)}: вся статистика</h3>` + tbl(['Показатель', 'Значение'], [
        ['Площадь суши', fmtN(t0.land) + ' км²'], ['Население', `${fmtN(r.n)} (${pc(r.n / n)} колонии)`], ['Плотность', fmtN(r.n / Math.max(1, t0.land * (1 - c.total)), 1) + ' чел./км² пригодной земли'],
        ['Занято', fmtN(r.emp || 0)], ['Безработных', `${fmtN(r.un || 0)} (${pc((r.un || 0) / Math.max(1, (r.un || 0) + (r.emp || 0)))})`],
        ['Средняя зарплата', `${fmtN(r.wage || 0, 0)} кр/сут`], ['Миграция в год', f0(r.mig || 0)],
        ['Средняя температура', `${fmtN(c.mean, 1)} °C`], ['Минимум / максимум', `${fmtN(c.min, 0)} / ${fmtN(c.max, 0)} °C`],
        ['Товары в дефиците', r.sat ? Object.keys(GOODS).filter(g => r.sat[g] < .95).sort((a, b) => r.sat[a] - r.sat[b]).map(g => `${GOODS[g].n} ${pc(r.sat[g])}`).join(', ') || 'всего хватает' : '—'],
        ['Особенности', feat || 'нет']]); }
    setHtml($('pp-reg'), h);
    $('pp-reg').onclick = e => { const tr = e.target.closest('[data-reg]'); if (!tr) return; const i = +tr.dataset.reg; popUi.reg = popUi.reg === i ? null : i; refreshPop(); };
  }
  if (pTab === 'str') {
    setHtml($('pp-str'), tbl(['Страта', 'Людей', 'Безработных', '%', 'Зарплата/сут', 'Доход занятого 30–50'], [0, 1, 2, 3].map(s => [`<span style="color:${STR_COL[s]}">■</span> ${STR[s]}`, fmtN(t.S[s].n), fmtN(t.S[s].un), fmtN(t.S[s].wf > 0 ? t.S[s].un / t.S[s].wf * 100 : 0, 1), fmtN(P.wage[s], 2), fmtN(P.parInc[s], 2)])));
  }
  if (pTab === 'goods') {
    const satColor = (s) => s >= .95 ? 'var(--good)' : s >= .75 ? 'var(--warn)' : 'var(--bad)';
    const satBar = (s) => { const p = Math.round(s*100); const col = satColor(s); return `<div style="display:flex;align-items:center;gap:4px"><div style="width:50px;height:6px;background:var(--bg);border-radius:3px;overflow:hidden"><div style="width:${p}%;height:100%;background:${col}"></div></div><span style="color:${col};font-family:var(--mono)">${fmtN(p,0)}%</span></div>`; };
    let gh = `<table class="grid"><tr><th>Товар</th><th>Спрос/сут</th><th>Выпуск</th><th>Удовл.</th><th>Цена ×</th><th>Гос.заводов</th><th>Корп.</th><th>Рабочих</th><th>Сырьё т/сут</th></tr>`;
    for (const g of Object.keys(GOODS)) {
      const sat = P.sat[g] || 0, corpF = (state.corps||[]).reduce((a,c)=>a+(c.civ&&c.civ.fac[g]||0),0);
      gh += `<tr><td>${GOODS[g].n}<span class="muted" style="font-size:10px"> ${unitOf(g)}</span></td><td class="n">${fmtN(P.dem[g])}</td><td class="n">${fmtN(P.prod[g])}</td><td>${satBar(sat)}</td><td class="n" style="color:${sat>=.95?'var(--good)':sat<.5?'var(--bad)':'var(--fg)'}">${fmtN(P.price?P.price[g]:1,2)} кр</td><td class="n">${fmtN(P.fac[g])}</td><td class="n">${fmtN(corpF)}</td><td class="n">${fmtN(P.fac[g]*FW())}</td><td class="n">${fmtN(P.raw&&P.raw[g]?P.raw[g].t:0,0)} <span class="muted">${RES[GOODS[g].raw]||''}</span></td></tr>`;
    }
    gh += '</table>';
    setHtml($('pp-goods'), gh);
  }
  if (pTab === 'coh') {
    const s = popUi.s, a = popUi.a, x = P.c[s][a], e = work(a) ? Math.max(0, x.n - x.un - x.st) : 0;
    setHtml($('pp-insp'), tbl(['', ''], [
      ['Людей', fmtN(x.n)], ['Безработных', fmtN(x.un)], ['Учатся', fmtN(x.st)], ['Заняты', fmtN(e)],
      ['Средний доход в сутки', fmtN(P.inc[s][a], 2)], ['Потребности в сутки', fmtN(basket(a), 2) + ' (' + Object.keys(GOODS).map(g => GOODS[g].n + ' ' + fmtN(needOf(g, a), 2)).join(', ') + ')'],
      ['Шанс смерти в год', fmtN(mortQ(a) * (1 + 3 * (1 - P.wel[s][a])) * 100, 2) + '%'], ['Рождаемость на человека в год', a >= 20 && a < 40 ? fmtN(.056 * FERT[s] * (.6 + .4 * P.wel[s][a]) * 100, 1) + '%' : '—'], ['Довольство', fmtN(P.wel[s][a] * 100, 0) + '%']]));
  }
}
export function sumAge(a0, a1) { let n = 0; for (let s = 0; s < 4; s++) for (let a = a0; a <= a1; a++) n += state.pop.c[s][a].n; return n; }
export function sumSt(a0, a1) { let n = 0; for (let s = 0; s < 4; s++) for (let a = a0; a <= a1; a++) n += state.pop.c[s][a].st; return n; }
export function drawPyr() {
  const cv = $('pp-cv'); if (!cv) return;
  const dpr = window.devicePixelRatio || 1, cw = cv.clientWidth || 180, ch = cv.clientHeight || 220;
  if (cv.width !== Math.round(cw * dpr) || cv.height !== Math.round(ch * dpr)) { cv.width = Math.round(cw * dpr); cv.height = Math.round(ch * dpr); }
  const g = cv.getContext('2d'), W = cv.width / dpr, H = cv.height / dpr, P = state.pop;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, W, H); let mx = 1; for (let a = 0; a <= 100; a++) { let n = 0; for (let s = 0; s < 4; s++) n += P.c[s][a].n; mx = Math.max(mx, n); }
  const lm = 22, rh = (H - 6) / 101;
  for (let a = 0; a <= 100; a++) { let x0 = lm; for (let s = 0; s < 4; s++) { const w = P.c[s][a].n / mx * (W - lm - 2); g.fillStyle = STR_COL[s]; g.fillRect(x0, 3 + a * rh, w, rh - .3); x0 += w; } }
  g.fillStyle = '#888'; g.font = `${Math.max(8, Math.round(9 * Math.min(1, W / 180)))}px sans-serif`;
  for (let a = 0; a <= 100; a += 20) g.fillText(a, 2, 3 + a * rh + rh * .7);
  g.fillStyle = 'rgba(255,255,255,.7)'; const ya = 3 + popUi.a * rh; g.fillRect(lm - 4, ya, 3, Math.max(1.5, rh));
}
