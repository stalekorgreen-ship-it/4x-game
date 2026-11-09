// @ts-nocheck
import { COMP, BODIES, BODY, RES, veinEff, canShipMine, designStats, dist, fmtN, fuelPerAU, fuelFor, fuelPlanAU, isSt, log, nameOf, objPos, rec, stById, state, uid } from './01-data.ts';
import { KR } from './00-kr.ts';
import { eqFor, repairParts } from './02-crew.ts';
import { execOrder, isBase, serve, travel } from './04-engine.ts';
import { FC, GOODS, popTaxDay, popTick } from './07-population.ts';
import { freightTick } from './13-freight.ts';
import { CTECH, LAB_COST, MINE_COST, YARD_COST, SHIP_K, canBuildShips, hasXfer, labRP, newCiv, payBuild, rpPrice } from './10-civil.ts';
import { corpLogo } from './17-art.ts';
import { $, esc, setHtml, ui } from './08-map-ui.ts';
import { lendTo } from './12-state.ts';
/* ===== КОРПОРАЦИИ: конкуренты, начинающие с Земли ===== */
// Политика закупок игрока: сколько и по какой цене брать у корпораций (общая для всех продавцов)
export const buyPol = k => { const b = state.buyPol || (state.buyPol = {}); return b[k] || (b[k] = {mode: 'off', amt: 0, max: 0}); };
const bmonth = () => { const m = Math.floor(state.t / 30); if (!state.bm || state.bm.m !== m) state.bm = {m, v: {}, last: state.bm ? state.bm.v : {}}; return state.bm; };
export const boughtMonth = k => bmonth().v[k] || 0;
export const noteBought = (k, q) => { const b = bmonth(); b.v[k] = (b.v[k] || 0) + q; };
// сколько тонн игрок готов взять сейчас по цене price
export function allowBuy(k, price) {
  const p = buyPol(k); if (p.mode === 'off') return 0; if (p.max > 0 && price > p.max) return 0;
  if (p.mode === 'all') return Infinity;
  if (p.mode === 'keep') return Math.max(0, p.amt - (state.stock[k] || 0));
  return Math.max(0, p.amt - boughtMonth(k));
}
export const PRICE = Object.fromEntries(Object.entries({fe: 60, ni: 360, ti: 450, cu: 300, si: 120, c: 90, ice: 45, pt: 12000, ree: 4500, u: 9000, n2: 45, co2: 30, ch4: 180, nh3: 120, fuel: 25, spares: 1500}).map(([k, v]) => [k, v * KR]));
export const SERVICE_MARKUP = 1.6, TAX_PER_DAY = 300000 * KR;
export const CORP_DEF = [
  {name: 'Вега Майнинг', tpl: 'Лёгкий', aggr: 1.0, parts: {ion: 2, tank: 2, cargo: 1, laser: 2, cabin: 2, life: 1}},
  {name: 'Синергия Ресурсов', tpl: 'Дальнобойный', aggr: 0.8, parts: {ion: 3, tank: 6, cargo: 1, laser: 2, cabin: 2, life: 1}},
  {name: 'Ферро-Групп', tpl: 'Грузовой', aggr: 1.2, parts: {ion: 3, tank: 3, cargo: 3, laser: 2, cabin: 2, life: 1}},
  {name: 'Ориент Спейс', tpl: 'Быстрый', aggr: 1.0, parts: {ion: 5, tank: 3, cargo: 1, laser: 3, cabin: 3, life: 1}},
];
export const CORP_STATION = {cargo: 6, tank: 10, spares: 2, xfer: 1, repair: 1, cabin: 1, life: 1};
export const CORP_TANKER = {ion: 4, tank: 12, xfer: 1, cabin: 1, life: 1};
export const costCr = parts => Object.entries(designStats(parts).cost).reduce((a, [k, v]) => a + v * (PRICE[k] || 50), 0) * 0.5;
export const stationCr = () => costCr(CORP_STATION) * 8;
export const corpById = id => (state.corps || []).find(c => c.id === id);
export const corpName = id => { const c = corpById(id); return c ? c.name : 'корпорация'; };
export const svcPrice = (st, k) => Math.round((PRICE[k] || 50) * SERVICE_MARKUP * (1 + 0.15 * dist(objPos(st.at || 'earth', state.t), objPos('earth', state.t))));
export const ownStations = c => state.stations.filter(x => x.corp === c.id);

export function createCorpShip(c, role) {
  const parts = role === 'm' ? c.parts : CORP_TANKER, st = designStats(parts);
  const nm = role === 'm' ? 'Рудокоп' : 'Танкер', key = c.name + nm, n = state.counters.ship[key] = (state.counters.ship[key] || 0) + 1;
  const p = objPos('earth', state.t);
  const s = {id: uid(), name: `${nm} «${c.name}» №${n}`, st, x: p.x, y: p.y, at: 'earth', fuel: st.fuelCap, cargo: {}, groupId: c.g[role],
    own: {orders: [], rules: [], loop: false}, pc: 0, wait: null, tmp: null, interrupt: null, eq: eqFor(parts), crew: {}, broken: false, towing: null, towedBy: null,
    status: 'На Земле', air: {F: 0, B: 0}, hullDmg: 0, airAcc: 0, corp: c.id, role};
  c.credits -= st.fuelCap * PRICE.fuel;
  state.ships.push(s); return s;
}
export function createCorpStation(c, bodyId) {
  const st = designStats(CORP_STATION), p = objPos(bodyId, state.t), n = ownStations(c).length + 1;
  const s = {id: uid(), name: `${c.name} · ${BODY[bodyId].name}`, st, x: p.x, y: p.y, at: bodyId, fuel: 0, spares: 0, store: {}, towedBy: null, crew: {}, corp: c.id};
  state.stations.push(s);
  log(`Корпорация «${c.name}» построила станцию у «${BODY[bodyId].name}»: там можно заправиться за деньги.`);
  return s;
}
const CORP_NAMES = ['Вега Майнинг', 'Синергия Ресурсов', 'Ферро-Групп', 'Ориент Спейс', 'Атлас Индастриз', 'Нова Дайнемикс', 'Гелиос', 'Кронос Холдинг', 'Титан-Альянс', 'Аргус', 'Орион Трейд', 'Сигма Ферм', 'Полярис', 'Зенит Груп', 'Меркурий-Капитал', 'Борей', 'Эридан', 'Астра Логистик', 'Вектор', 'Кассиопея', 'Лира', 'Кварк Холдинг', 'Альтаир', 'Мира-Групп', 'Дельта Ресурс', 'Нептун Трейд', 'Радиус', 'Омега Майнинг', 'Феникс', 'Ярило', 'Соль', 'Тритон', 'Кепплер', 'Гранит', 'Вихрь', 'Север-Капитал', 'Мегалит', 'Спутник', 'Ковчег', 'Горизонт'];
const CORP_SPEC = ['food', 'elec', 'wear', 'pow', 'med'];
export const CORP_COUNT = 20;
function makeCorp(i) {
  const d = CORP_DEF[i % CORP_DEF.length];
  const c = {id: uid(), name: CORP_NAMES[i] || 'Корпорация-' + (i + 1), tpl: d.tpl, aggr: d.aggr * (.9 + (i % 5) * .05), parts: d.parts, credits: 1.2e9 * KR, civ: newCiv(CORP_SPEC[i % CORP_SPEC.length]), buy: {all: true}, sold: 0, last: 0, g: {}, lost: 0};
  for (const role of ['m', 't']) {
    const g = {id: uid(), name: `${c.name}: ${role === 'm' ? 'рудокопы' : 'танкеры'}`, orders: [{type: role === 'm' ? 'corpmine' : 'corptank'}], rules: [], loop: true, corp: c.id, color: '#6e7b92'};
    state.groups.push(g); c.g[role] = g.id;
  }
  return c;
}
export function initCorps() {
  state.corps = []; state.money = state.money || 3e6 * KR; state.corpVer = 4; state.nameIdx = CORP_COUNT;
  for (let i = 0; i < CORP_COUNT; i++) state.corps.push(makeCorp(i));
}
// Вместо обанкротившихся через год появляются новые стартапы
export function respawnTick() {
  const q = state.respawn; if (!q || !q.length || q[0] > state.t || state.corps.length >= CORP_COUNT) return;
  q.shift(); state.nameIdx = (state.nameIdx || CORP_COUNT) + 1;
  const c = makeCorp(state.nameIdx - 1); state.corps.push(c); log(`Основана новая корпорация «${c.name}».`);
}
export function wipeCorps() {
  state.ships = state.ships.filter(s => !s.corp); state.stations = state.stations.filter(s => !s.corp); state.groups = state.groups.filter(g => !g.corp); state.corps = null;
}
export const allBases = () => [{id: 'earth', at: 'earth', fuel: 1e9}].concat(state.stations.filter(x => !x.towedBy).map(x => ({id: 'st:' + x.id, at: x.id, fuel: x.fuel, st: x})));
export const basePos = b => objPos(b.id, state.t);

/* --- ИИ рудокопа: те же правила, что у игрока (топливо, дальность, станции) --- */
let _mp = {k: '', v: null};
function minePool() {
  const k = Math.floor(state.t / 2) + ':' + state.stations.length;
  if (_mp.k === k) return _mp.v;
  const v = [];
  for (const b of BODIES) {
    if (b.kind !== 'ast' || b.comet || !canShipMine(b.id) || !state.ast[b.id]) continue;
    const ores = state.ast[b.id]; let tot = 0, val = 0, se = 0;
    for (const kk in ores) { tot += ores[kk]; const e = ores[kk] > 0 ? veinEff(b.id, kk, ores[kk], (b.ores && b.ores[kk]) || ores[kk]) : 0; se += e; val += e * (PRICE[kk] || 30) * (allowBuy(kk, PRICE[kk] || 30) > 0 ? 1 : 0.3); }
    if (tot < 800 || se < .05) continue; val = val / se * Math.min(1, .5 + se / 2);
    const P = objPos(b.id, state.t); let Rc = null, Rk = -1;
    v.push({id: b.id, P, tot, val, R: bases => { if (Rk !== state.stations.length || Rc === null) { Rc = 1e9; for (const x of bases) Rc = Math.min(Rc, dist(P, basePos(x))); Rk = state.stations.length; } return Rc; }});
  }
  _mp = {k, v}; return v;
}
export function corpMine(s, h) {
  const T = s.tmp || (s.tmp = {ph: 'plan'}), E = objPos('earth', state.t);
  if (T.ph === 'plan') {
    if (T.wait > state.t) return false;
    if (!isBase(s.at)) { T.ph = 'back'; return false; }
    serve(s, s.at);
    const fpa = fuelPlanAU(s) * 1.7, c = corpById(s.corp), bases = allBases();
    let best = null, bs = 0;
    const cd = minePool();
    for (const q of cd) {
      const P = q.P, d1 = dist(s, P);
      let R = q.R(bases);
      if ((d1 + R) * fpa > s.fuel) continue;
      const sc = Math.min(q.val * s.st.cargoCap, q.val * q.tot) / (d1 + R + 0.3);
      if (sc > bs) { bs = sc; best = q.id; }
    }
    if (!best) { s.status = 'Нет достижимых целей: нужны станции дозаправки'; T.wait = state.t + 3; return false; }
    T.tgt = best; T.ph = 'out';
  }
  if (T.ph === 'out') { if (!travel(s, T.tgt, h)) return false; T.ph = 'mine'; }
  if (T.ph === 'mine') { if (execOrder(s, {type: 'mine', target: T.tgt, res: 'all', pct: 90}, h)) T.ph = 'back'; return false; }
  if (T.ph === 'back') {
    const fpa = fuelPlanAU(s) * 1.1;
    if (!T.dest || s.at === T.dest) {
      if (T.wait > state.t) return false;
      T.dest = null;
      if (s.at === 'earth') { serve(s, 'earth'); s.tmp = {ph: 'plan'}; return false; }
      if (isSt(s.at)) serve(s, s.at);
      if (s.fuel >= dist(s, E) * fpa * 0.9) T.dest = 'earth';
      else {
        let best = null, bd = 1e9;
        for (const x of state.stations) { if (x.towedBy || x.fuel < 5) continue; const p = objPos('st:' + x.id, state.t); if (dist(s, p) * fpa > s.fuel || x === stById(s.at)) continue; const d = dist(p, E); if (d < bd) { bd = d; best = 'st:' + x.id; } }
        if (!best) { s.status = 'Нет топлива до базы: ждёт спасения'; T.wait = state.t + 3; return false; }
        T.dest = best;
      }
    }
    if (travel(s, T.dest, h)) { if (T.dest === 'earth' || isSt(s.at)) { serve(s, s.at); } if (T.dest === 'earth') s.tmp = {ph: 'plan'}; else T.dest = null; }
    return false;
  }
  return false;
}
/* --- ИИ танкера: возит топливо и припасы со своей Земли на станции корпорации --- */
export function corpTank(s, h) {
  const c = corpById(s.corp), T = s.tmp || (s.tmp = {ph: 'load'}), E = objPos('earth', state.t);
  if (!c) return true;
  if (T.ph === 'load') {
    if (s.at !== 'earth') { T.ph = 'ret'; return false; }
    serve(s, 'earth');
    const fpa = fuelPlanAU(s) * 1.3; let best = null, bn = 0;
    for (const st of ownStations(c)) {
      const need = st.st.fuelCap - st.fuel; if (need < 30) continue;
      const d = dist(E, objPos('st:' + st.id, state.t)); if (d * 2 * fpa > s.fuel * 0.9) continue;
      if (need > bn) { bn = need; best = st.id; }
    }
    if (!best) { s.status = 'Ждёт заказа на Земле'; return false; }
    T.st = best; T.ph = 'go';
  }
  if (T.ph === 'go') {
    const st = state.stations.find(x => x.id === T.st); if (!st) { T.ph = 'ret'; return false; }
    if (!travel(s, 'st:' + st.id, h)) return false;
    const reserve = fuelFor(s, dist(s, E)) * 1.3, amt = Math.max(0, Math.min(s.fuel - reserve, st.st.fuelCap - st.fuel));
    s.fuel -= amt; st.fuel += amt;
    const sp = Math.min(st.st.spareCap - st.spares, 40); if (sp > 0 && c.credits > sp * PRICE.spares * 0.5) { st.spares += sp; c.credits -= sp * PRICE.spares * 0.5; }
    if (amt > 1) log(`Танкер «${c.name}» доставил на станцию «${st.name}» ${fmtN(amt)} т топлива.`);
    T.ph = 'ret';
  }
  if (T.ph === 'ret') { if (travel(s, 'earth', h)) s.tmp = {ph: 'load'}; return false; }
  return false;
}

// --- полугодовой пересмотр стратегии корпорации ---
const FOCI = {industry: 'промышленность', mining: 'добыча сырья', fleet: 'флот', science: 'наука', expand: 'колонии'};
const worth = c => { const v = c.civ; let w = c.credits; for (const g in v.fac) w += v.fac[g] * FC(); for (const r in v.mines) w += v.mines[r] * MINE_COST; w += (v.labs || 0) * LAB_COST + (v.yard ? YARD_COST : 0);
  for (const s of state.ships) if (s.corp === c.id) w += costCr(s.role === 'm' ? c.parts : CORP_TANKER) * SHIP_K * .5; return w; };
function mutateParts(c) { // добавляем или убираем деталь, сохраняя пригодность корабля
  const p = {...c.parts}, opts = [['laser', 1, 6], ['ion', 1, 8], ['tank', 1, 10], ['cargo', 1, 6], ['laser', -1, 6], ['tank', -1, 10], ['ion', -1, 8], ['cargo', -1, 6]];
  for (let i = 0; i < 8; i++) { const [k, d, mx] = opts[Math.floor(Math.random() * opts.length)]; const n = (p[k] || 0) + d; if (n < 1 || n > mx) continue; p[k] = n; break; }
  p.cabin = Math.max(p.cabin || 1, Math.ceil((p.laser * 2 + 1) / 5)); p.life = Math.max(p.life || 1, Math.ceil(p.cabin * 5 / 10)); return p;
}
export function reviewStrategy(c) {
  const S = c.strat = c.strat || {focus: Object.keys(FOCI)[c.id % 5], t0: state.t, w0: worth(c), g0: 0, streak: 0, mut: false};
  if (state.t - S.t0 < 180) return;
  const w = worth(c), g = (w - S.w0) / Math.max(1, S.w0), ok = g > 0.02 && g >= S.g0 * .6;
  if (S.mut && g < S.g0 && c.partsPrev) { c.parts = c.partsPrev; c.partsPrev = null; log(`«${c.name}»: изменение проекта корабля не оправдалось, возвращён прежний шаблон.`); }
  S.mut = false;
  if (ok) { S.streak++; c.aggr = Math.min(2, c.aggr * 1.04); }
  else {
    const old = S.focus, ks = Object.keys(FOCI).filter(k => k !== old); S.focus = ks[Math.floor(Math.random() * ks.length)]; S.streak = 0;
    log(`«${c.name}» меняет стратегию: ${FOCI[old]} → ${FOCI[S.focus]}.`);
    if (['mining', 'fleet'].includes(S.focus) || S.focus === old) { c.partsPrev = c.parts; c.parts = mutateParts(c); S.mut = true; log(`«${c.name}» дорабатывает проект рудокопа: ${Object.entries(c.parts).map(([k, v]) => v + '×' + (COMP[k] ? COMP[k].name : k)).join(', ')}.`); }
  }
  S.t0 = state.t; S.w0 = w; S.g0 = g;
}
export function corpTick(h) {
  state.money = (state.money || 0) + popTaxDay() * h; popTick(h); freightTick(h);
  state.corpAcc = (state.corpAcc || 0) + h;
  if (state.corpAcc < 0.5) return;
  const dt = state.corpAcc; state.corpAcc = 0;
  for (const c of state.corps || []) {
    // корабли, оставшиеся без топлива вдали от баз, пропадают
    for (const s of state.ships.filter(x => x.corp === c.id)) {
      if ((s.fuel <= 0.01 || (s.status || '').startsWith('Нет топлива до базы')) && !isBase(s.at)) { s.strand = (s.strand || 0) + dt; if (s.strand > 60) { state.ships = state.ships.filter(x => x !== s); c.lost++; log(`Корабль «${s.name}» потерян: кончилось топливо вдали от станций.`); } } else s.strand = 0;
      if (s.broken && !isBase(s.at) && s.fuel > 0.01) { // аварийная бригада работает в полёте, за деньги корпорации (медленно)
        repairParts(s, 12, dt * 0.25, n => { c.credits -= n * PRICE.spares * 1.0; return n; }, false);
      }
    }
    reviewStrategy(c); const fk = c.strat.focus === 'fleet' ? 1.4 : c.strat.focus === 'mining' ? 1.15 : 1, ag = c.aggr / fk;
    if (state.t - c.last < 6 || !canBuildShips(c) || c.credits < 3e7 * KR) continue;
    const mine = state.ships.filter(s => s.corp === c.id), nM = mine.filter(s => s.role === 'm').length, nT = mine.filter(s => s.role === 't').length, sts = ownStations(c), nS = sts.length;
    const mc = costCr(c.parts) * 1.1 * SHIP_K, tc = costCr(CORP_TANKER) * SHIP_K, sc = stationCr() * SHIP_K;
    if (nM < 3 + 3 * nS && c.credits >= mc * ag) { if (payBuild(c, mc, 60)) { c.last = state.t; createCorpShip(c, 'm'); } }
    else if (nM >= 3 && nS < 5 && c.credits >= (sc + tc) * 1.5 * ag) {
      const spot = pickStationSpot(c);
      if (spot && payBuild(c, sc, 200)) { c.last = state.t; createCorpStation(c, spot); if (nT < nS + 1 && payBuild(c, tc, 90)) createCorpShip(c, 't'); }
    } else if (hasXfer(c) && nS && nT < nS && c.credits >= tc * 1.2) { if (payBuild(c, tc, 90)) { c.last = state.t; createCorpShip(c, 't'); } }
  }
}
let _psc = {k: '', v: null};
export function pickStationSpot(c) {
  const k = Math.floor(state.t) + ':' + state.stations.length;
  if (_psc.k === k) return _psc.v;
  const v = pickStationSpot0(c); _psc = {k, v}; return v;
}
function pickStationSpot0(c) {
  const used = new Set(state.stations.map(x => x.at)), bases = allBases(), tfpa = designStats(CORP_TANKER); // дальность танкера
  const tank = designStats(CORP_TANKER), trange = tank.range * 0.4;
  let best = null, bs = 0;
  const ast = BODIES.filter(b => b.kind === 'ast' && !b.comet && !b.strange && state.ast[b.id]);
  for (const b of ast) {
    if (used.has(b.id)) continue;
    const P = objPos(b.id, state.t), E = objPos('earth', state.t), dE = dist(P, E);
    if (dE > trange) continue;
    let near = 1e9; for (const x of bases) near = Math.min(near, dist(P, basePos(x)));
    if (near < 0.5) continue;
    let val = 0; for (const o of ast) { if (!canShipMine(o.id) || dist(P, objPos(o.id, state.t)) > 0.9) continue; const q = state.ast[o.id]; for (const k in q) val += q[k] * (PRICE[k] || 30); }
    const sc = val / (1 + dE * 0.5) * (1 + near * 0.3);
    if (sc > bs) { bs = sc; best = b.id; }
  }
  return best;
}
// Земля покупает у корпорации по полной цене то, что отметил игрок; остальное уходит на общий рынок за 30%
export function corpSellToEarth(s) {
  const c = corpById(s.corp); let sum = 0, plSum = 0; const got = [];
  for (const [k, v] of Object.entries(s.cargo)) {
    if (v <= 0) continue;
    const pr = PRICE[k] || 50, q = Math.max(0, Math.min(v, c ? allowBuy(k, pr) : 0, state.money / pr)), pay = q * pr + (v - q) * pr * 0.3; sum += pay;
    if (q > 0) { plSum += q * pr; state.stock[k] = (state.stock[k] || 0) + q; noteBought(k, q); rec(k, 'in', q, 'corp'); got.push(`${fmtN(q)} т ${RES[k].toLowerCase()}`); }
  }
  s.cargo = {};
  if (c) { c.credits += sum; c.sold += sum; }
  state.money -= plSum;
  if (got.length) log(`«${corpName(s.corp)}» доставила на Землю: ${got.join(', ')}. Оплата: ${fmtN(plSum)} кр.`);
  const take = s.st.fuelCap - s.fuel; if (take > 0.01) { s.fuel = s.st.fuelCap; if (c) c.credits -= take * PRICE.fuel; }
}
// Заправка на станции корпорации: свои корабли бесплатно, чужие платят владельцу
export function corpBuyFuel(s, st) {
  const c = corpById(st.corp), take = Math.min(s.st.fuelCap - s.fuel, st.fuel); if (take <= 0.01) return;
  s.fuel += take; st.fuel -= take;
  if (s.corp === st.corp) return;
  const pay = take * svcPrice(st, 'fuel');
  if (s.corp) { const b = corpById(s.corp); if (b) b.credits -= pay; } else state.money -= pay;
  if (c) c.credits += pay;
  if (!s.corp) log(`«${s.name}» заправился на станции «${st.name}»: ${fmtN(take)} т за ${fmtN(pay)} кр.`);
}
export function corpChargeLoad(s, before, st) {
  let pay = 0; const c = corpById(st.corp);
  for (const k of Object.keys(s.cargo)) { const d = (s.cargo[k] || 0) - (before[k] || 0); if (d > 0) pay += d * svcPrice(st, k); }
  if (pay > 0) { state.money -= pay; if (c) c.credits += pay; log(`«${s.name}» купил груз на станции «${st.name}» за ${fmtN(pay)} кр.`); }
}

/* --- вкладка «Корпорации» --- */
export function refreshCorp() {
  const p = $('p-corp'); if (!p || !state.corps) return;
  const P = state.pop, fm = (n, d = 2) => fmtN(n, d);
  let h = `<div class="box"><h2>Корпорации</h2><div class="help">Корпорации начинают с Земли с двумя заводами и своей шахтой. Они сами строят новые заводы на выручку, торгуют на рынке по самой низкой цене, а лишнее сырьё продают. Когда копят достаточно, строят коммерческую верфь: минимум 1000 т (около 800 т стали и 200 т прочего), это очень дорого и окупается годами. Верфь строит один заказ за раз: миньер ~60 суток, танкер ~90, станция ~200. Остальные покупают у владельца постройку кораблей и станций с наценкой 50%, и он зарабатывает на этом. Кто первым строит новое, тот получает преимущество в цене. Налоги Земли: +${fmtN(popTaxDay())} кр/сут. Кредиты игрока: <b>${fmtN(state.money)}</b></div></div>`;
  if (P && P.price) h += `<div class="box"><h2>Рынок товаров</h2><div data-sc style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr><th style="text-align:left">Товар</th><th style="text-align:left">Цена ×</th><th style="text-align:left">Лучшая цена корпорации</th></tr>${Object.keys(GOODS).map(g => { const prs = state.corps.filter(c => c.civ && c.civ.pr[g] && c.civ.fac[g]).map(c => c.civ.pr[g]); return `<tr><td>${GOODS[g].n}</td><td>${fm(P.price[g])}</td><td>${prs.length ? fm(Math.min(...prs)) : '—'}</td></tr>`; }).join('')}</table></div></div>`;
  const sorted = [...state.corps].sort((a, b) => b.credits - a.credits), sel = state.corps.find(c => c.id === ui.corpSel) || sorted[0];
  h += `<div class="box"><h2>Список (${state.corps.length})</h2><div data-sc style="overflow-x:auto;max-height:260px;overflow-y:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr>${['Корпорация', 'Капитал', 'Заводов', 'Лаб.', 'Верфь', 'Корабли', 'Техи'].map(x => `<th style="text-align:left;padding:2px 6px">${x}</th>`).join('')}</tr>${sorted.map(c => `<tr data-corpsel="${c.id}" style="cursor:pointer;${c === sel ? 'background:#ffffff14' : ''}"><td style="padding:2px 6px">${corpLogo(c.name, 16)} ${esc(c.name)}</td><td style="padding:2px 6px">${fmtN(c.credits)}</td><td style="padding:2px 6px">${fmtN(Object.values(c.civ.fac).reduce((a, b) => a + b, 0))}</td><td style="padding:2px 6px">${c.civ.labs}</td><td style="padding:2px 6px">${c.civ.yard ? '✓' : ''}</td><td style="padding:2px 6px">${state.ships.filter(s => s.corp === c.id).length}</td><td style="padding:2px 6px">${Object.keys(c.civ.tech).length}</td></tr>`).join('')}</table></div></div>`;
  for (const c of [sel]) {
    const sts = ownStations(c), ships = state.ships.filter(s => s.corp === c.id);
    h += `<div class="box"><h2>${corpLogo(c.name, 30)} ${esc(c.name)} <span class="muted">· шаблон «${c.tpl}»</span></h2><div class="stats"><span>Рудокопов / танкеров</span><span>${ships.filter(s => s.role === 'm').length} / ${ships.filter(s => s.role === 't').length}</span><span>Станции</span><span>${sts.length ? sts.map(s => `${esc(nameOf(s.at))} (топл. ${fmtN(s.fuel)} т)`).join(', ') : 'нет'}</span><span>Капитал</span><span>${fmtN(c.credits)} кр.</span><span>Продано всего</span><span>${fmtN(c.sold)} кр.</span><span>Потеряно кораблей</span><span>${c.lost}</span></div>
      <div class="help">Стратегия: ${FOCI[(c.strat || {}).focus] || '—'}${c.strat && c.strat.streak ? ' (успешных полугодий подряд: ' + c.strat.streak + ')' : ''}. Проект рудокопа: ${Object.entries(c.parts).map(([k, v]) => v + '×' + (COMP[k] ? COMP[k].name : k)).join(', ')}.</div>
      <div class="help">Исследования: ${CTECH.filter(x => c.civ.tech[x.id]).map(x => x.name).join(', ') || 'пока нет'}${c.civ.cur ? '. Сейчас: ' + CTECH.find(x => x.id === c.civ.cur).name + ' (' + fmtN(c.civ.prog) + '/' + CTECH.find(x => x.id === c.civ.cur).cost + ' ОИ)' : ''}. Лаборатории: ${c.civ.labs} (${fmtN(labRP(c), 1)} ОИ/сут).</div>
      <div class="help">Заводы: ${Object.keys(c.civ.fac).filter(g => c.civ.fac[g] > 0).map(g => GOODS[g].n + ' ' + fmtN(c.civ.fac[g]) + ' (цена ' + fm(c.civ.pr[g] || 0) + ')').join(', ') || 'нет'}. Шахты: ${Object.keys(c.civ.mines).filter(r => c.civ.mines[r] > 0).map(r => RES[r].toLowerCase() + ' ×' + c.civ.mines[r]).join(', ') || 'нет'}. ${c.civ.yard ? '<b>Есть коммерческая верфь</b>, доход от чужих заказов: ' + fmtN(c.civ.fees || 0) + ' кр.' : 'Верфи нет.'}</div>
      <div class="row">Долг банку: ${fmtN(c.civ.debt || 0)} кр. <select id="lendamt">${[1e6 * KR, 5e6 * KR, 2e7 * KR].map(x => `<option value="${x}">${fmtN(x)} кр</option>`).join('')}</select><button class="btn sm" data-lend="${c.id}">Выдать кредит (6%)</button></div>
      ${sts.length ? `<div class="help">Топливо на станциях: ${fmtN(svcPrice(sts[0], 'fuel'))} кр/т у «${esc(nameOf(sts[0].at))}».</div>` : ''}</div>`;
  }
  setHtml(p, h);
}
(function corpEvents() {
  const p = document.getElementById('p-corp');
  p.addEventListener('click', e => { const lb = e.target.closest('[data-lend]'); if (lb) { lendTo(corpById(+lb.dataset.lend), +document.getElementById('lendamt').value); p._h = null; refreshCorp(); return; } const r = e.target.closest('[data-corpsel]'); if (r) { ui.corpSel = +r.dataset.corpsel; p._h = null; refreshCorp(); } });
  p.addEventListener('change', e => {
    const t = e.target, c = corpById(+t.dataset.corp); if (!c) return;
    p._h = null; refreshCorp();
  });
})();
