// @ts-nocheck
/* ===== КОРПОРАЦИИ: конкуренты, начинающие с Земли ===== */
const PRICE = {fe: 60, ni: 360, ti: 450, cu: 300, si: 120, c: 90, ice: 45, pt: 12000, ree: 4500, u: 9000, n2: 45, co2: 30, ch4: 180, nh3: 120, fuel: 25, spares: 1500};
const SERVICE_MARKUP = 1.6, TAX_PER_DAY = 300000;
const CORP_DEF = [
  {name: 'Вега Майнинг', tpl: 'Лёгкий', aggr: 1.0, parts: {ion: 2, tank: 2, cargo: 1, laser: 2, cabin: 2, life: 1}},
  {name: 'Синергия Ресурсов', tpl: 'Дальнобойный', aggr: 0.8, parts: {ion: 3, tank: 6, cargo: 1, laser: 2, cabin: 2, life: 1}},
  {name: 'Ферро-Групп', tpl: 'Грузовой', aggr: 1.2, parts: {ion: 3, tank: 3, cargo: 3, laser: 2, cabin: 2, life: 1}},
  {name: 'Ориент Спейс', tpl: 'Быстрый', aggr: 1.0, parts: {ion: 5, tank: 3, cargo: 1, laser: 3, cabin: 3, life: 1}},
];
const CORP_STATION = {cargo: 6, tank: 10, spares: 2, xfer: 1, repair: 1, cabin: 1, life: 1};
const CORP_TANKER = {ion: 4, tank: 12, xfer: 1, cabin: 1, life: 1};
const costCr = parts => Object.entries(designStats(parts).cost).reduce((a, [k, v]) => a + v * (PRICE[k] || 50), 0) * 0.5;
const stationCr = () => costCr(CORP_STATION) * 8;
const corpById = id => (state.corps || []).find(c => c.id === id);
const corpName = id => { const c = corpById(id); return c ? c.name : 'корпорация'; };
const svcPrice = (st, k) => Math.round((PRICE[k] || 50) * SERVICE_MARKUP * (1 + 0.15 * dist(objPos(st.at || 'earth', state.t), objPos('earth', state.t))));
const ownStations = c => state.stations.filter(x => x.corp === c.id);

function createCorpShip(c, role) {
  const parts = role === 'm' ? c.parts : CORP_TANKER, st = designStats(parts);
  const nm = role === 'm' ? 'Рудокоп' : 'Танкер', key = c.name + nm, n = state.counters.ship[key] = (state.counters.ship[key] || 0) + 1;
  const p = objPos('earth', state.t);
  const s = {id: uid(), name: `${nm} «${c.name}» №${n}`, st, x: p.x, y: p.y, at: 'earth', fuel: st.fuelCap, cargo: {}, groupId: c.g[role],
    own: {orders: [], rules: [], loop: false}, pc: 0, wait: null, tmp: null, interrupt: null, eq: eqFor(parts), crew: {}, broken: false, towing: null, towedBy: null,
    status: 'На Земле', air: {F: 0, B: 0}, hullDmg: 0, airAcc: 0, corp: c.id, role};
  c.credits -= st.fuelCap * PRICE.fuel;
  state.ships.push(s); return s;
}
function createCorpStation(c, bodyId) {
  const st = designStats(CORP_STATION), p = objPos(bodyId, state.t), n = ownStations(c).length + 1;
  const s = {id: uid(), name: `${c.name} · ${BODY[bodyId].name}`, st, x: p.x, y: p.y, at: bodyId, fuel: 0, spares: 0, store: {}, towedBy: null, crew: {}, corp: c.id};
  state.stations.push(s);
  log(`Корпорация «${c.name}» построила станцию у «${BODY[bodyId].name}»: там можно заправиться за деньги.`);
  return s;
}
function initCorps() {
  state.corps = []; state.money = state.money || 5e7; state.corpVer = 2;
  for (const d of CORP_DEF) {
    const c = {id: uid(), name: d.name, tpl: d.tpl, aggr: d.aggr, parts: d.parts, credits: 60000, buy: {all: true}, sold: 0, last: 0, g: {}, lost: 0};
    for (const role of ['m', 't']) {
      const g = {id: uid(), name: `${c.name}: ${role === 'm' ? 'рудокопы' : 'танкеры'}`, orders: [{type: role === 'm' ? 'corpmine' : 'corptank'}], rules: [], loop: true, corp: c.id, color: '#6e7b92'};
      state.groups.push(g); c.g[role] = g.id;
    }
    state.corps.push(c); createCorpShip(c, 'm');
  }
}
function wipeCorps() {
  state.ships = state.ships.filter(s => !s.corp); state.stations = state.stations.filter(s => !s.corp); state.groups = state.groups.filter(g => !g.corp); state.corps = null;
}
const allBases = () => [{id: 'earth', at: 'earth', fuel: 1e9}].concat(state.stations.filter(x => !x.towedBy).map(x => ({id: 'st:' + x.id, at: x.id, fuel: x.fuel, st: x})));
const basePos = b => objPos(b.id, state.t);

/* --- ИИ рудокопа: те же правила, что у игрока (топливо, дальность, станции) --- */
function corpMine(s, h) {
  const T = s.tmp || (s.tmp = {ph: 'plan'}), E = objPos('earth', state.t);
  if (T.ph === 'plan') {
    if (!isBase(s.at)) { T.ph = 'back'; return false; }
    serve(s, s.at);
    const fpa = fuelPerAU(s) * 1.7, c = corpById(s.corp), bases = allBases();
    let best = null, bs = 0;
    for (const b of BODIES) {
      if (b.kind !== 'ast' || b.comet || !canShipMine(b.id) || !state.ast[b.id]) continue;
      const ores = state.ast[b.id]; let tot = 0, val = 0;
      for (const k in ores) { tot += ores[k]; val += ores[k] * (PRICE[k] || 30) * ((c.buy.all || c.buy[k]) ? 1 : 0.3); }
      if (tot < 800) continue;
      const P = objPos(b.id, state.t), d1 = dist(s, P);
      let R = 1e9; for (const x of bases) R = Math.min(R, dist(P, basePos(x)));
      if ((d1 + R) * fpa > s.fuel) continue;
      const sc = Math.min(val / tot * s.st.cargoCap, val) / (d1 + R + 0.3);
      if (sc > bs) { bs = sc; best = b.id; }
    }
    if (!best) { s.status = 'Нет достижимых целей: нужны станции дозаправки'; return false; }
    T.tgt = best; T.ph = 'out';
  }
  if (T.ph === 'out') { if (!travel(s, T.tgt, h)) return false; T.ph = 'mine'; }
  if (T.ph === 'mine') { if (execOrder(s, {type: 'mine', target: T.tgt, res: 'all', pct: 90}, h)) T.ph = 'back'; return false; }
  if (T.ph === 'back') {
    const fpa = fuelPerAU(s) * 1.1;
    if (!T.dest || s.at === T.dest) {
      T.dest = null;
      if (s.at === 'earth') { serve(s, 'earth'); s.tmp = {ph: 'plan'}; return false; }
      if (isSt(s.at)) serve(s, s.at);
      if (s.fuel >= dist(s, E) * fpa * 0.9) T.dest = 'earth';
      else {
        let best = null, bd = 1e9;
        for (const x of state.stations) { if (x.towedBy || x.fuel < 5) continue; const p = objPos('st:' + x.id, state.t); if (dist(s, p) * fpa > s.fuel || x === stById(s.at)) continue; const d = dist(p, E); if (d < bd) { bd = d; best = 'st:' + x.id; } }
        if (!best) { s.status = 'Нет топлива до базы: ждёт спасения'; return false; }
        T.dest = best;
      }
    }
    if (travel(s, T.dest, h)) { if (T.dest === 'earth' || isSt(s.at)) { serve(s, s.at); } if (T.dest === 'earth') s.tmp = {ph: 'plan'}; else T.dest = null; }
    return false;
  }
  return false;
}
/* --- ИИ танкера: возит топливо и припасы со своей Земли на станции корпорации --- */
function corpTank(s, h) {
  const c = corpById(s.corp), T = s.tmp || (s.tmp = {ph: 'load'}), E = objPos('earth', state.t);
  if (!c) return true;
  if (T.ph === 'load') {
    if (s.at !== 'earth') { T.ph = 'ret'; return false; }
    serve(s, 'earth');
    const fpa = fuelPerAU(s) * 1.3; let best = null, bn = 0;
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
    const reserve = fuelPerAU(s) * dist(s, E) * 1.3, amt = Math.max(0, Math.min(s.fuel - reserve, st.st.fuelCap - st.fuel));
    s.fuel -= amt; st.fuel += amt;
    const sp = Math.min(st.st.spareCap - st.spares, 40); if (sp > 0 && c.credits > sp * PRICE.spares * 0.5) { st.spares += sp; c.credits -= sp * PRICE.spares * 0.5; }
    if (amt > 1) log(`Танкер «${c.name}» доставил на станцию «${st.name}» ${fmtN(amt)} т топлива.`);
    T.ph = 'ret';
  }
  if (T.ph === 'ret') { if (travel(s, 'earth', h)) s.tmp = {ph: 'load'}; return false; }
  return false;
}

function corpTick(h) {
  state.money = (state.money || 0) + popTaxDay() * h; popTick(h);
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
    if (!state.ships.some(s => s.corp === c.id) && c.credits < costCr(c.parts) * 1.1 + 20000) { c.credits = costCr(c.parts) * 1.1 + 40000; c.lost++; log(`«${c.name}» реструктурирована после банкротства.`); createCorpShip(c, 'm'); }
    if (state.t - c.last < 6) continue;
    const mine = state.ships.filter(s => s.corp === c.id), nM = mine.filter(s => s.role === 'm').length, nT = mine.filter(s => s.role === 't').length, sts = ownStations(c), nS = sts.length;
    const mc = costCr(c.parts) * 1.1, tc = costCr(CORP_TANKER), sc = stationCr();
    if (nM < 3 + 3 * nS && c.credits >= mc * c.aggr) { c.credits -= mc; c.last = state.t; createCorpShip(c, 'm'); }
    else if (nM >= 3 && nS < 5 && c.credits >= (sc + tc) * 1.5 * c.aggr) {
      const spot = pickStationSpot(c);
      if (spot) { c.credits -= sc; c.last = state.t; createCorpStation(c, spot); if (nT < nS + 1) { c.credits -= tc; createCorpShip(c, 't'); } }
    } else if (nS && nT < nS && c.credits >= tc * 1.2) { c.credits -= tc; c.last = state.t; createCorpShip(c, 't'); }
  }
}
function pickStationSpot(c) {
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
function corpSellToEarth(s) {
  const c = corpById(s.corp); let sum = 0, plSum = 0; const got = [];
  for (const [k, v] of Object.entries(s.cargo)) {
    if (v <= 0) continue;
    const want = c && (c.buy.all || c.buy[k]), pay = v * (PRICE[k] || 50) * (want ? 1 : 0.3); sum += pay;
    if (want) { plSum += pay; state.stock[k] = (state.stock[k] || 0) + v; rec(k, 'in', v, 'corp'); got.push(`${fmtN(v)} т ${RES[k].toLowerCase()}`); }
  }
  s.cargo = {};
  if (c) { c.credits += sum; c.sold += sum; }
  state.money -= plSum;
  if (got.length) log(`«${corpName(s.corp)}» доставила на Землю: ${got.join(', ')}. Оплата: ${fmtN(plSum)} кр.`);
  const take = s.st.fuelCap - s.fuel; if (take > 0.01) { s.fuel = s.st.fuelCap; if (c) c.credits -= take * PRICE.fuel; }
}
// Заправка на станции корпорации: свои корабли бесплатно, чужие платят владельцу
function corpBuyFuel(s, st) {
  const c = corpById(st.corp), take = Math.min(s.st.fuelCap - s.fuel, st.fuel); if (take <= 0.01) return;
  s.fuel += take; st.fuel -= take;
  if (s.corp === st.corp) return;
  const pay = take * svcPrice(st, 'fuel');
  if (s.corp) { const b = corpById(s.corp); if (b) b.credits -= pay; } else state.money -= pay;
  if (c) c.credits += pay;
  if (!s.corp) log(`«${s.name}» заправился на станции «${st.name}»: ${fmtN(take)} т за ${fmtN(pay)} кр.`);
}
function corpChargeLoad(s, before, st) {
  let pay = 0; const c = corpById(st.corp);
  for (const k of Object.keys(s.cargo)) { const d = (s.cargo[k] || 0) - (before[k] || 0); if (d > 0) pay += d * svcPrice(st, k); }
  if (pay > 0) { state.money -= pay; if (c) c.credits += pay; log(`«${s.name}» купил груз на станции «${st.name}» за ${fmtN(pay)} кр.`); }
}

/* --- вкладка «Корпорации» --- */
function refreshCorp() {
  const p = $('p-corp'); if (!p || !state.corps) return;
  let h = `<div class="box"><h2>Корпорации</h2><div class="help">Корпорации стартуют с Земли с одним рудокопом и соревнуются, у кого выгоднее шаблон корабля. Добыча продаётся вам: отмеченное вы покупаете по полной цене, остальное они сбывают на общем рынке за 30%. Когда денег хватает, строят новые рудокопы, потом станции дозаправки и танкеры, которые возят туда топливо. Чужие корабли на станции платят владельцу за топливо. Налоги Земли: +${fmtN(popTaxDay())} кр/сут.</div><div class="row"><b>Кредиты игрока: ${fmtN(state.money)}</b></div></div>`;
  for (const c of [...state.corps].sort((a, b) => b.sold - a.sold)) {
    const sts = ownStations(c), ships = state.ships.filter(s => s.corp === c.id);
    h += `<div class="box"><h2>${esc(c.name)} <span class="muted">· шаблон «${c.tpl}»</span></h2><div class="stats"><span>Рудокопов / танкеров</span><span>${ships.filter(s => s.role === 'm').length} / ${ships.filter(s => s.role === 't').length}</span><span>Станции</span><span>${sts.length ? sts.map(s => `${esc(nameOf(s.at))} (топл. ${fmtN(s.fuel)} т)`).join(', ') : 'нет'}</span><span>Капитал</span><span>${fmtN(c.credits)} кр.</span><span>Продано всего</span><span>${fmtN(c.sold)} кр.</span><span>Потеряно кораблей</span><span>${c.lost}</span></div>
      <label class="row"><input type="checkbox" data-corp="${c.id}" data-all="1"${c.buy.all ? ' checked' : ''}> <b>Покупать всё</b></label>
      <div class="res">${Object.keys(RES).filter(k => k !== 'spares').map(k => `<label><input type="checkbox" data-corp="${c.id}" data-res="${k}"${c.buy.all || c.buy[k] ? ' checked' : ''}${c.buy.all ? ' disabled' : ''}> ${RES[k]}</label><span class="mono muted">${PRICE[k]} кр/т</span>`).join('')}</div>
      ${sts.length ? `<div class="help">Топливо на станциях: ${fmtN(svcPrice(sts[0], 'fuel'))} кр/т у «${esc(nameOf(sts[0].at))}».</div>` : ''}</div>`;
  }
  if (p._h !== h) { p.innerHTML = h; p._h = h; }
}
(function corpEvents() {
  const p = document.getElementById('p-corp');
  p.addEventListener('change', e => {
    const t = e.target, c = corpById(+t.dataset.corp); if (!c) return;
    if (t.dataset.all) c.buy.all = t.checked; else if (t.dataset.res) c.buy[t.dataset.res] = t.checked;
    p._h = null; refreshCorp();
  });
})();
