// @ts-nocheck
import { BODIES, BODY, FIELDS, GROUND, RES, SAVE_KEY, TERRA, WEAR_AU, WEAR_MINE, canShipMine, cargoTotal, createShip, createStation, designStats, dist, fmtDur, fmtN, fuelPerAU, groupOf, isSh, isSt, log, massOf, nameOf, objPos, programOf, rec, setState, shById, shipSpeed, stById, state, stockOK, storeTotal } from './01-data.ts';
import { veinEff } from './01-data.ts';
import { anyFailed, failed, graduate, minRate, repairParts, shipCond, staffFor, train, useWear } from './02-crew.ts';
import { academyInterval, buildTick, produceSci, researchTick, sciTick, yardSlots, yardSpeed } from './03-build.ts';
import { Battle, raidTick } from './05-battle.ts';
import { PRICE, corpBuyFuel, corpById, corpChargeLoad, corpMine, corpSellToEarth, corpTank, corpTick, initCorps, wipeCorps } from './06-corps.ts';
import { initPop, relinkCols } from './07-population.ts';
import { LAW_DEFAULT } from './12-state.ts';

/* ===== СИМУЛЯЦИЯ ===== */
export const CORP_LOD = 0.5; // сутки между шагами корабля корпорации
export function advance(days) {
  while (days > 1e-9) {
    const h = Math.min(days, Battle.active() ? 1 / 86400 : 1 / 48);
    state.t += h;
    yardTick(h); buildTick(h); sciTick(h); researchTick(h); raidTick(h); corpTick(h);
    while (state.t >= state.nextOfficer) { graduate(); state.nextOfficer += academyInterval(); }
    const bat = Battle.active();
    for (const s of state.ships) {
      // Корабли ИИ вдали от боя считаются крупными шагами (LOD): это в десятки раз дешевле, а результат тот же.
      if (s.corp && !bat) { s.lod = (s.lod === undefined ? (s.id % 50) / 100 : s.lod) + h; if (s.lod < CORP_LOD) continue; const hh = s.lod; s.lod = 0; shipTick(s, hh); }
      else shipTick(s, h);
    }
    days -= h;
  }
}

export function yardTick(h) {
  const CAP = yardSlots();
  let active = state.yard.filter(j => j.started).length;
  for (const j of state.yard) {
    if (j.started || active >= CAP) continue;
    const c = designStats(j.parts).cost;
    if (stockOK(c)) {
      for (const [k, v] of Object.entries(c)) { state.stock[k] -= v; rec(k, 'out', v, 'yard'); }
      j.started = true; active++;
    }
  }
  for (const j of state.yard) if (j.started) j.left -= h * yardSpeed();
  const done = [];
  for (const j of state.yard) {
    if (!j.started || j.left > 0) continue;
    const stt = designStats(j.parts), {crew, miss} = staffFor(stt, j.prio);
    if (miss.length) { j.wait = 'ждёт офицера: ' + miss.join(', '); continue; }
    j.wait = null; done.push(j);
    if (stt.station) { const st = createStation(j, crew); log(`Построена станция «${st.name}» на Земле. Её нужно отбуксировать тягачом.`); }
    else {
      const s = createShip(j, j.groupId, crew);
      log(`Построен корабль «${s.name}»${j.groupId ? ' → группа «' + (groupOf(s)?.name || '?') + '»' : ''}.`);
    }
  }
  if (done.length) state.yard = state.yard.filter(j => !done.includes(j));
}

/* --- базы: Земля и станции --- */
export const isBase = id => id === 'earth' || isSt(id);
export const freeStore = st => st.st.cargoCap - storeTotal(st);
export function stationUseful(st) {
  return freeStore(st) > 0.5 || (st.st.xfer && st.fuel > 0.5) || (st.st.repair && st.spares > 0.5) || st.st.spareCap - st.spares > 0.5;
}
export function resolveBase(s, base) {
  if (!base || base === 'earth') return 'earth';
  if (base === 'nearest') {
    let best = 'earth', bd = dist(s, objPos('earth', state.t));
    for (const st of state.stations) {
      if (st.corp || st.towedBy || !stationUseful(st)) continue;
      const d = dist(s, objPos('st:' + st.id, state.t));
      if (d < bd) { bd = d; best = 'st:' + st.id; }
    }
    return best;
  }
  return stById(base) ? base : 'earth';
}
export function takeSpares(n) {
  const got = Math.min(n, state.stock.spares);
  state.stock.spares -= got; rec('spares', 'out', got, 'spares');
  return got;
}
export function serve(s, baseId) {
  const got = [];
  if (s.corp && baseId === 'earth') { corpSellToEarth(s); return; }
  { const cs = stById(baseId); if (cs && cs.corp) { corpBuyFuel(s, cs); return; } }
  if (baseId === 'earth') {
    for (const [k, v] of Object.entries(s.cargo)) {
      if (v <= 0) continue;
      state.stock[k] = (state.stock[k] || 0) + v;
      got.push(`${fmtN(v)} т ${RES[k].toLowerCase()}`);
    }
    s.cargo = {};
    const take = Math.min(s.st.fuelCap - s.fuel, state.stock.fuel);
    s.fuel += take; state.stock.fuel -= take; rec('fuel', 'out', take, 'fuel');
    if (got.length) log(`«${s.name}» разгрузился на Земле: ${got.join(', ')}.`);
    return;
  }
  const st = stById(baseId); if (!st) return;
  let left = false;
  for (const k of Object.keys(s.cargo)) {
    let amt = s.cargo[k] || 0; if (amt <= 0) continue;
    const before = amt;
    if (k === 'ice') { const f = Math.min(amt, st.st.fuelCap - st.fuel); st.fuel += f; amt -= f; }
    if (k === 'spares') { const m = Math.min(amt, st.st.spareCap - st.spares); st.spares += m; amt -= m; }
    else { const m = Math.min(amt, Math.max(0, freeStore(st))); st.store[k] = (st.store[k] || 0) + m; amt -= m; }
    s.cargo[k] = amt;
    if (before - amt > 0.01) got.push(`${fmtN(before - amt)} т ${RES[k].toLowerCase()}`);
    if (amt > 0.01) left = true;
  }
  if (got.length) log(`«${s.name}» разгрузился на станции «${st.name}»: ${got.join(', ')}.`);
  if (left) log(`Склад станции «${st.name}» не вместил весь груз «${s.name}».`);
  if (st.st.xfer) {
    const take = Math.min(s.st.fuelCap - s.fuel, st.fuel);
    s.fuel += take; st.fuel -= take;
  }
}
// ремонт у базы; true — корабль занят ремонтом и ждёт
export function repairStep(s, h) {
  if (!s.at || !isBase(s.at) || shipCond(s) >= 99.5) return false;
  const st = isSt(s.at) ? stById(s.at) : null;
  if (st && !st.st.repair) return false;
  const src = st ? n => { const g = Math.min(n, st.spares); st.spares -= g; return g; } : s.corp ? n => { const c = corpById(s.corp); if (c) c.credits -= n * PRICE.spares * 0.5; return n; } : takeSpares;
  const r = repairParts(s, 12, h, src, false);
  s.status = r === 'lack' ? 'Нет тех. изделий для ремонта' : `Ремонт: ${fmtN(shipCond(s))}%`;
  return r === 'busy';
}

/* --- правила --- */
export function checkRules(s, prog) {
  for (const r of prog.rules || []) {
    if (r.cond === 'cargo' && s.st.cargoCap > 0 && cargoTotal(s) > 0 && cargoTotal(s) / s.st.cargoCap * 100 >= r.val - 1e-6) return r;
    if (r.cond === 'fuel' && s.fuel / s.st.fuelCap * 100 <= r.val) return r;
    if (r.cond === 'cond' && shipCond(s) <= r.val) return r;
    if (r.cond === 'fuelhome') {
      const need = fuelPerAU(s) * dist(s, objPos('earth', state.t));
      if (s.fuel < need * r.val / 100) return r;
    }
  }
  return null;
}
export const RULE_NAME = {cargo: 'трюм заполнен', fuel: 'мало топлива', fuelhome: 'топлива в обрез до Земли', cond: 'сильный износ'};

export function shipTick(s, h) {
  shipTickInner(s, h);
  syncTow(s);
}
export function syncTow(s) {
  if (!s.towing) return;
  const e = isSt(s.towing) ? stById(s.towing) : shById(s.towing);
  if (!e) { s.towing = null; return; }
  e.x = s.x; e.y = s.y; e.at = s.at; e.towedBy = s.id;
}
export function finishOrder(s) {
  s.tmp = null;
  if (s.interrupt) s.interrupt = null;
  else { s.pc++; s.wait = null; }
}
export function shipTickInner(s, h) {
  if (s.inB) { s.status = 'В бою'; return; }
  if (s.towedBy) { s.status = 'На буксире'; return; }
  if (s.at) { const p = objPos(s.at, state.t); s.x = p.x; s.y = p.y; }
  s.broken = failed(s, 'engine');
  if (repairStep(s, h)) return;
  if (!isBase(s.at)) {
    useWear(s, 'life', 0.02 * h, 0.0006 * h);
    if (anyFailed(s) && (s.cargo.spares || 0) > 0)
      repairParts(s, 6, h, n => { const g = Math.min(n, s.cargo.spares || 0); s.cargo.spares -= g; return g; }, true);
    if (s.towing) { useWear(s, 'hook', 0.3 * h, 0.003 * h); }
    if (!s.interrupt && !s.broken && (failed(s, 'laser') || failed(s, 'life'))) {
      s.interrupt = {base: 'nearest'}; s.tmp = null; log(`«${s.name}»: неисправность, возвращается на базу.`);
    }
  }
  const prog = programOf(s);
  if (!s.interrupt && !isBase(s.at)) {
    const r = checkRules(s, prog);
    if (r) { s.interrupt = {base: r.base || 'earth'}; s.tmp = null; log(`«${s.name}»: ${RULE_NAME[r.cond]}, возвращается на базу.`); }
  }
  let order;
  if (s.interrupt) order = {type: 'home', base: s.interrupt.base};
  else {
    if (!prog.orders.length) { s.status = isBase(s.at) ? 'На базе, приказов нет' : 'Ждёт приказов'; return; }
    if (s.pc >= prog.orders.length) {
      if (prog.loop) s.pc = 0;
      else { s.status = 'Программа выполнена'; return; }
    }
    order = prog.orders[s.pc];
  }
  if (execOrder(s, order, h)) finishOrder(s);
}

/* --- движение --- */
export function travel(s, tid, h) {
  if (s.at === tid) return true;
  if (s.at && !s.corp) { // на старте: хватит ли топлива долететь и вернуться к ближайшей базе
    const P = objPos(tid, state.t), fpa = fuelPerAU(s) * 1.1;
    let R = 0;
    if (!isBase(tid)) { R = dist(P, objPos('earth', state.t)); for (const x of state.stations) if (!x.towedBy && !x.corp) R = Math.min(R, dist(P, objPos('st:' + x.id, state.t))); }
    const need = (dist(s, P) + R) * fpa;
    if (need > s.fuel + 1e-9 && need < 1e8) { s.status = `Не хватает топлива до цели: нужно ${fmtN(need, 1)} т, есть ${fmtN(s.fuel, 1)} т. Нужны станции дозаправки.`; return false; }
  }
  if (s.broken) { s.status = 'Двигатель неисправен!'; return false; }
  if (s.fuel <= 1e-9) {
    if (!s.stranded) { s.stranded = true; log(`«${s.name}»: топливо кончилось, корабль дрейфует.`); }
    s.status = 'Нет топлива!'; return false;
  }
  s.stranded = false;
  s.at = null;
  const spd = shipSpeed(s);
  let p = objPos(tid, state.t);
  for (let i = 0; i < 3; i++) p = objPos(tid, state.t + dist(s, p) / spd);
  const d = dist(s, p);
  const fpa = fuelPerAU(s);
  let step = spd * h;
  train(s, 'pil', h);
  const maxByFuel = s.fuel / fpa;
  let arrive = d <= step;
  if (arrive) step = d;
  if (step > maxByFuel) { step = maxByFuel; arrive = false; }
  s.fuel = Math.max(0, s.fuel - step * fpa);
  useWear(s, 'engine', step * WEAR_AU, step * 0.004);
  s.eta = (d - step) / spd;
  s.dest = tid;
  if (arrive) {
    const q = objPos(tid, state.t); s.x = q.x; s.y = q.y;
    if (!isSh(tid)) s.at = tid;
    return true;
  }
  if (d > 1e-12) { s.x += (p.x - s.x) / d * step; s.y += (p.y - s.y) / d * step; }
  s.status = `Летит к «${nameOf(tid)}», ${fmtDur(s.eta)}`;
  return false;
}

/* --- буксир --- */
export function releaseTow(s) {
  if (!s.towing) return;
  const e = isSt(s.towing) ? stById(s.towing) : shById(s.towing);
  if (e) {
    e.towedBy = null; e.at = s.at; e.x = s.x; e.y = s.y;
    log(`«${s.name}» отцепил «${e.name}» ${s.at ? 'у «' + nameOf(s.at) + '»' : 'в открытом космосе'}.`);
  }
  s.towing = null;
}

/* --- приказы --- */
export function execOrder(s, o, h) {
  switch (o.type) {
    case 'move':
      if (!o.target || (isSt(o.target) && !stById(o.target))) return true;
      return travel(s, o.target, h);
    case 'home': {
      if (!s.tmp) s.tmp = {base: resolveBase(s, o.base)};
      const base = s.tmp.base;
      if (!travel(s, base, h)) return false;
      if (s.towing) releaseTow(s);
      serve(s, base);
      return true;
    }
    case 'wait': {
      if (s.wait === null) s.wait = (o.hours || 1) / 24;
      s.wait -= h; s.status = `Ждёт ещё ${fmtDur(Math.max(0, s.wait))}`;
      return s.wait <= 0;
    }
    case 'mine': {
      const ores = state.ast[o.target];
      if (!ores) return true;
      if (!canShipMine(o.target)) { s.status = `«${BODY[o.target].name}» слишком велико (${BODY[o.target].d} км) для корабельных лазеров`; return true; }
      if (!travel(s, o.target, h)) return false;
      if (failed(s, 'laser') || failed(s, 'life')) { s.status = 'Неисправность: ' + (failed(s, 'laser') ? 'лазер' : 'жизнеобеспечение'); return false; }
      const ks = (o.res && o.res !== 'all' && ores[o.res] > 0) ? [o.res] : Object.keys(ores).filter(k => ores[k] > 0);
      if (!ks.length) { log(`«${BODY[o.target].name}» выработан, приказ пропущен.`); return true; }
      if (s.st.mine <= 0 || s.st.cargoCap <= 0) { s.status = 'Нечем добывать'; return true; }
      const lim = s.st.cargoCap * (o.pct || 100) / 100;
      const load = cargoTotal(s);
      if (load >= lim - 1e-6) return true;
      // каждый лазер добывает все жилы сразу: по единице в сутки на жилу × эффективность жилы
      const base = BODY[o.target].ores || {}, rate = s.st.mine * minRate(s) * h, want = {}; let sum = 0;
      for (const k of ks) { want[k] = Math.min(ores[k], rate * veinEff(o.target, k, ores[k], base[k] || ores[k])); sum += want[k]; }
      const kf = sum > lim - load ? Math.max(0, lim - load) / sum : 1;
      for (const k of ks) { const part = want[k] * kf; ores[k] -= part; s.cargo[k] = (s.cargo[k] || 0) + part; rec(k, 'in', part, 'ship'); }
      useWear(s, 'laser', WEAR_MINE * h, 0.004 * h); train(s, 'min', h);
      s.status = ks.length > 1 ? `Добывает всё сразу на «${BODY[o.target].name}»` : `Добывает ${RES[ks[0]].toLowerCase()} на «${BODY[o.target].name}»`;
      return cargoTotal(s) >= lim - 1e-6;
    }
    case 'corpmine': return corpMine(s, h);
    case 'corptank': return corpTank(s, h);
    case 'load': {
      const before = {...s.cargo};
      if (!s.tmp) s.tmp = {base: resolveBase(s, o.base)};
      const base = s.tmp.base;
      if (!travel(s, base, h)) return false;
      const free = s.st.cargoCap - cargoTotal(s);
      let room = Math.min(free, o.amount || 100);
      if (base === 'earth') {
        if (o.item === 'spares' && room > 0) s.cargo.spares = (s.cargo.spares || 0) + takeSpares(room);
      } else {
        const st = stById(base);
        if (st && o.item === 'spares') { const m = Math.min(room, st.spares); st.spares -= m; s.cargo.spares = (s.cargo.spares || 0) + m; }
        else if (st) for (const k of Object.keys(st.store)) { const m = Math.min(room, st.store[k]); st.store[k] -= m; room -= m; s.cargo[k] = (s.cargo[k] || 0) + m; }
        if (st && st.corp && !s.corp) corpChargeLoad(s, before, st);
      }
      return true;
    }
    case 'tow': {
      if (s.towing) return true;
      if (!s.st.tow) { s.status = 'Нет буксирной сцепки'; return true; }
      if (failed(s, 'hook')) { s.status = 'Сцепка неисправна'; return true; }
      if (!s.tmp) s.tmp = {target: null};
      let tid = o.target;
      if (tid === 'broken') {
        if (!s.tmp.target) {
          let best = null, bd = 1e9;
          for (const x of state.ships) { if (x === s || !x.broken || x.towedBy) continue; const d = dist(s, x); if (d < bd) { bd = d; best = x; } }
          if (!best) { s.status = 'Нет сломанных кораблей'; return true; }
          s.tmp.target = 'sh:' + best.id;
        }
        tid = s.tmp.target;
      }
      const e = isSt(tid) ? stById(tid) : shById(tid);
      if (!e || e === s) return true;
      if (e.towedBy && e.towedBy !== s.id) { s.status = 'Цель уже на буксире'; return true; }
      if (massOf(tid) > s.st.tow) { log(`«${s.name}» не потянет «${e.name}»: ${fmtN(massOf(tid))} т при лимите ${fmtN(s.st.tow)} т.`); return true; }
      if (!travel(s, tid, h)) return false;
      s.towing = tid; e.towedBy = s.id; s.at = e.at || null;
      e.x = s.x; e.y = s.y;
      log(`«${s.name}» взял на буксир «${e.name}».`);
      return true;
    }
    case 'research': {
      if (!s.tmp) s.tmp = {};
      let tgt = o.target;
      if (tgt === 'auto') {
        if (!s.tmp.t) {
          let best = null, bs = 0;
          for (const x of BODIES) {
            if (!x.sci) continue;
            const pl = state.sites[x.id]; let rem = 0;
            for (const f in FIELDS) if (s.st.labs[f] && x.sci[f]) rem += Math.min(pl[f], 1500) * x.sci[f];
            const sc = rem / (0.5 + dist(s, objPos(x.id, state.t)));
            if (sc > bs) { bs = sc; best = x.id; }
          }
          if (!best) { s.status = 'Нет доступных объектов для исследования'; return true; }
          s.tmp.t = best;
        }
        tgt = s.tmp.t;
      }
      const b = BODY[tgt];
      if (!b || !b.sci || !s.st.labsTotal) return true;
      if (!travel(s, tgt, h)) return false;
      if (failed(s, 'life')) { s.status = 'Неисправно жизнеобеспечение'; return false; }
      if (s.wait === null) s.wait = o.days || 30;
      const got = produceSci(s, tgt, h);
      s.wait -= h;
      s.status = got > 0 ? `Исследует «${b.name}»: +${fmtN(got / h, 1)}/сут` : `«${b.name}»: нет доступной науки`;
      return s.wait <= 0 || got <= 0;
    }
    case 'minebest': {
      if (!s.tmp) s.tmp = {};
      if (!s.tmp.t) {
        let best = null, bs = 0;
        for (const x of BODIES) {
          if (x.comet || !canShipMine(x.id)) continue;
          const a = state.ast[x.id] && (o.res === 'all' ? Object.values(state.ast[x.id]).reduce((q, w) => q + w, 0) : state.ast[x.id][o.res]); if (!(a > 500)) continue;
          const sc = a / (0.5 + dist(s, objPos(x.id, state.t)));
          if (sc > bs) { bs = sc; best = x.id; }
        }
        if (!best) { s.status = `Нет цели: ${o.res === 'all' ? 'ничего' : RES[o.res].toLowerCase()}`; return true; }
        s.tmp.t = best;
      }
      return execOrder(s, {type: 'mine', target: s.tmp.t, res: o.res, pct: o.pct}, h);
    }
    case 'jump': {
      const c = o.cond || 'always', load = cargoTotal(s) / Math.max(1, s.st.cargoCap) * 100;
      const ok = c === 'always' || (c === 'cargo' && load >= o.val) || (c === 'fuel' && s.fuel / s.st.fuelCap * 100 <= o.val) || (c === 'cond' && shipCond(s) <= o.val);
      if (ok) s.pc = (o.to || 1) - 2;
      return true;
    }
    case 'redirect': {
      const T = TERRA[o.planet || 'mars']; if (!T) return true;
      const t = (state.terra[o.planet || 'mars'] = state.terra[o.planet || 'mars'] || {});
      if (t.done) { s.status = 'Тераформирование завершено'; return true; }
      if (s.st.power <= 0) { s.status = 'Нет двигателей'; return true; }
      const left = id => { const q = state.ast[id]; return q ? Object.values(q).reduce((a, v) => a + v, 0) : 0; };
      if (!s.tmp) s.tmp = {};
      if (!s.tmp.c || left(s.tmp.c) < 1e8) {
        let best = null, bd = 1e9;
        for (const x of BODIES) { if (!x.comet || left(x.id) < 1e8) continue; const d = dist(s, objPos(x.id, state.t)); if (d < bd) { bd = d; best = x.id; } }
        if (!best) { s.status = 'Кометы закончились'; return true; }
        s.tmp.c = best;
      }
      if (s.at !== s.tmp.c && s.fuel < fuelPerAU(s) * (dist(s, objPos(s.tmp.c, state.t)) + dist(objPos(s.tmp.c, state.t), objPos('earth', state.t))) * 1.15 + 1) { s.status = 'Нужна заправка перед вылетом'; return true; }
      if (!travel(s, s.tmp.c, h)) return false;
      if (s.fuel < fuelPerAU(s) * dist(s, objPos('earth', state.t)) * 1.3 + 1) { s.status = 'Мало топлива: нужна заправка'; return true; }
      s.fuel = Math.max(0, s.fuel - s.st.power / Math.max(0.2, s.st.eff) * 0.02 * h);
      const ores = state.ast[s.tmp.c], ks = Object.keys(ores).filter(k => ores[k] > 0), tot = left(s.tmp.c);
      const m = Math.min(s.st.power * 1e7 * h, tot);
      for (const k of ks) { const part = m * ores[k] / tot; ores[k] -= part; if (T.need[k]) t[k] = Math.min(T.need[k], (t[k] || 0) + part); }
      s.status = `Толкает «${BODY[s.tmp.c].name}» к ${T.name}: осталось ${fmtN(left(s.tmp.c))} т`;
      if (left(s.tmp.c) < 1e8) { log(`«${BODY[s.tmp.c].name}» упала на ${T.name}.`); s.tmp.c = null; }
      if (Object.keys(T.need).every(k => (t[k] || 0) >= T.need[k])) { t.done = true; log(`★ Тераформирование планеты ${T.name} завершено!`); return true; }
      return false;
    }
    case 'terraform': {
      const T = TERRA[o.target]; if (!T) return true;
      if (!travel(s, o.target, h)) return false;
      const t = (state.terra[o.target] = state.terra[o.target] || {}), moved = [];
      for (const k of Object.keys(T.need)) {
        const a = s.cargo[k] || 0; if (a <= 0) continue;
        const m = Math.min(a, Math.max(0, T.need[k] - (t[k] || 0))); if (m <= 0) continue;
        t[k] = (t[k] || 0) + m; s.cargo[k] = a - m; moved.push(`${fmtN(m)} т ${RES[k].toLowerCase()}`);
      }
      if (moved.length) log(`«${s.name}» сбросил на ${T.name}: ${moved.join(', ')}.`);
      if (!t.done && Object.keys(T.need).every(k => (t[k] || 0) >= T.need[k])) { t.done = true; log(`★ Тераформирование планеты ${T.name} завершено!`); }
      return true;
    }
    case 'dump': {
      const t = cargoTotal(s); if (t > 0.5) log(`«${s.name}» сбросил груз (${fmtN(t)} т).`);
      s.cargo = {}; return true;
    }
    case 'joingroup': {
      const g = state.groups.find(x => x.id === o.group); if (!g) return true;
      s.groupId = g.id; s.pc = -1; s.wait = null; s.tmp = null;
      log(`«${s.name}» перешёл в группу «${g.name}».`); return true;
    }
    case 'stop':
      s.status = 'Остановлен приказом'; return false;
    case 'release':
      releaseTow(s); return true;
    case 'transfer': {
      const st = stById(o.target);
      if (!st || !s.st.xfer) return true;
      if (failed(s, 'xfer')) { s.status = 'Передача топлива неисправна'; return true; }
      if (!travel(s, o.target, h)) return false;
      const reserve = fuelPerAU(s) * dist(s, objPos('earth', state.t)) * 1.3;
      const amt = Math.max(0, Math.min(s.fuel - reserve, st.st.fuelCap - st.fuel));
      s.fuel -= amt; st.fuel += amt; if (amt > 0.5) useWear(s, 'xfer', 3, 0.02);
      if (amt > 0.5) log(`«${s.name}» передал станции «${st.name}» ${fmtN(amt)} т топлива.`);
      return true;
    }
    case 'refuelships': {
      if (!s.st.xfer || failed(s, 'xfer')) return true;
      if (!s.tmp) {
        let best = null, bd = 1e9;
        for (const x of state.ships) {
          if (x === s || x.towedBy || isBase(x.at)) continue;
          if (x.fuel / x.st.fuelCap * 100 >= (o.pct || 40)) continue;
          const d = dist(s, x); if (d < bd) { bd = d; best = x; }
        }
        if (!best) { s.status = 'Нет кораблей, которым нужно топливо'; return true; }
        s.tmp = {target: 'sh:' + best.id};
      }
      const x = shById(s.tmp.target);
      if (!x) return true;
      const reserve = fuelPerAU(s) * dist(s, objPos('earth', state.t)) * 1.3;
      if (s.fuel <= reserve) { s.status = 'Мало топлива для передачи'; return true; }
      if (!travel(s, s.tmp.target, h)) return false;
      const amt = Math.max(0, Math.min(s.fuel - reserve, x.st.fuelCap - x.fuel));
      s.fuel -= amt; x.fuel += amt; x.stranded = false; if (amt > 0.5) useWear(s, 'xfer', 3, 0.02);
      if (amt > 0.5) log(`«${s.name}» заправил «${x.name}» на ${fmtN(amt)} т.`);
      return true;
    }
  }
  return true;
}

/* ===== СОХРАНЕНИЕ ===== */
export function saveGame() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(state)); } catch (e) {} }
export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return false;
    const s = JSON.parse(raw);
    if (!s || !s.ships || !s.designs || !s.stations) return false;
    setState(s); state.inBattle = false; state.terra = state.terra || {};
    if (!state.ground) state.ground = JSON.parse(JSON.stringify(GROUND)); if (state.bld && state.bld.mine === undefined) state.bld.mine = 0;
    if (state.corps && (state.corpVer || 1) < 3) wipeCorps();
    if (!state.corps) { state.money = state.money || 3e6; initCorps(); }
    if (!state.pop && !state.cols) initPop(); relinkCols(); state.laws = {...LAW_DEFAULT, ...(state.laws || {})};
    state.research = state.research || {}; state.tprog = state.tprog || {}; state.contracts = state.contracts || {}; state.rp = state.rp || 0;
    for (const x of state.ships) x.inB = false; if (state.raid) { if (state.raid.active) { state.raid.k++; state.raid.eta = state.t + 60; state.raid.warned = false; } state.raid.active = false; }
    for (const b of BODIES) if (b.ores && !state.ast[b.id]) state.ast[b.id] = {...b.ores};
    return true;
  } catch (e) { console.error('loadGame', e); return false; }
}
