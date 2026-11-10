// @ts-nocheck
// Правила ИИ «условие → действие» (без кода): для корпораций (раз в месяц) и кораблей (каждый ход).
// Хранятся в data/ai.json, правятся в игре: Редактор → Правила ИИ. Правило срабатывает, если выполнены ВСЕ его условия;
// у корпораций за месяц срабатывает одно (первое подходящее) правило; «stop» — встроенный ИИ в этом месяце молчит.
import { gd } from './00-gd.ts';
import { hooks } from './00-hooks.ts';
import { state } from './01-data.ts';

export const AI = {corp: gd('ai', 'corp', []), ship: gd('ai', 'ship', [])};
const OPS = {'>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b, '<=': (a, b) => a <= b, '=': (a, b) => a == b, '!=': (a, b) => a != b};
export const OP_LIST = Object.keys(OPS);

// --- параметры (что можно проверять) ---
// arg: g — товар, r — руда; описание показывается в редакторе
export const CORP_P = {
  year: {n: 'Год'}, month: {n: 'Месяц жизни корпорации'}, credits: {n: 'Деньги корпорации, кр'}, avail: {n: 'Свободные деньги (за вычетом зарплат и строек), кр'},
  factories: {n: 'Заводов всего'}, fac: {n: 'Заводов товара', arg: 'g'}, mines: {n: 'Шахт всего'}, labs: {n: 'Лабораторий'}, yard: {n: 'Есть верфь (1/0)'},
  miners: {n: 'Кораблей-шахтёров'}, tankers: {n: 'Танкеров'}, stations: {n: 'Станций'}, debt: {n: 'Долг, кр'}, building: {n: 'Строек в очереди'},
  sat: {n: 'Обеспеченность Земли товаром, %', arg: 'g'}, price: {n: 'Цена товара, × к базовой', arg: 'g'}, ore: {n: 'Цена руды, × к базовой', arg: 'r'},
  corps: {n: 'Корпораций в мире'}, money: {n: 'Казна игрока, кр'},
};
export const SHIP_P = {
  fuel: {n: 'Топливо, %'}, cargo: {n: 'Трюм заполнен, %'}, cond: {n: 'Состояние узлов, %'}, dist: {n: 'До Земли, а.е.'}, year: {n: 'Год'},
  corp: {n: 'Корабль корпорации (1/0)'}, miner: {n: 'Шахтёр (1/0)'}, tanker: {n: 'Танкер (1/0)'},
};
// --- действия ---
export const CORP_A = {
  build_fac: {n: 'Построить заводы товара', arg: 'g', num: 'Сколько'}, build_mine: {n: 'Построить шахту', arg: 'r'}, build_lab: {n: 'Построить лабораторию'},
  build_yard: {n: 'Построить коммерческую верфь'}, build_cb: {n: 'Открыть строительное бюро'}, build_miner: {n: 'Построить корабль-шахтёр'}, build_tanker: {n: 'Построить танкер'},
  focus: {n: 'Сменить стратегию', arg: 'focus'}, nothing: {n: 'Ничего не делать (копить)'},
};
export const SHIP_A = {home: {n: 'Вернуться на ближайшую базу'}, earth: {n: 'Вернуться на Землю'}};
export const FOCI = {expand: 'расширение', industry: 'промышленность', science: 'наука', mining: 'добыча', fleet: 'флот'};

const year = () => 2030 + (state.t || 0) / 360;
function corpVal(c, p, a, X) {
  const v = c.civ, P = state.cols && state.cols.earth && state.cols.earth.pop, ships = (state.ships || []).filter(s => s.corp === c.id);
  switch (p) {
    case 'year': return year(); case 'month': return v.month || 0; case 'credits': return c.credits; case 'avail': return X.avail;
    case 'factories': { let t = 0; for (const g in v.fac) t += v.fac[g]; return t; } case 'fac': return v.fac[a] || 0;
    case 'mines': { let t = 0; for (const r in v.mines) t += v.mines[r]; return t; } case 'labs': return v.labs || 0; case 'yard': return v.yard ? 1 : 0;
    case 'miners': return ships.filter(s => s.role === 'm').length; case 'tankers': return ships.filter(s => s.role === 't').length;
    case 'stations': return (state.stations || []).filter(s => s.corp === c.id).length; case 'debt': return v.debt || 0; case 'building': return X.q || 0;
    case 'sat': return P && P.sat[a] != null ? P.sat[a] * 100 : 100; case 'price': return X.mk && X.mk[a] ? X.mk[a].mult : 1; case 'ore': return (state.mp && state.mp[a]) || 1;
    case 'corps': return (state.corps || []).length; case 'money': return state.money;
  }
  return 0;
}
const ok = (rule, val) => (rule.when || []).every(w => { const f = OPS[w.op] || OPS['>']; return f(val(w.p, w.a), +w.v); });

// вызывается из civTick (10-civil): act — функции стройки; true — встроенный ИИ в этом месяце пропускается
export function aiCorp(c, X, act) {
  for (const r of AI.corp) {
    if (r.off) continue; if (r.only && r.only !== c.name) continue;
    if (!ok(r, (p, a) => corpVal(c, p, a, X))) continue;
    const d = r.do || {}; let done = true;
    switch (d.a) {
      case 'build_fac': done = act.fac(d.arg, Math.max(1, +d.num || 1)); break; case 'build_mine': done = act.mine(d.arg); break; case 'build_lab': done = act.lab(); break;
      case 'build_yard': done = act.yard(); break; case 'build_cb': done = act.cb(); break;
      case 'build_miner': done = hooks.corpShip ? hooks.corpShip(c, 'm') : false; break; case 'build_tanker': done = hooks.corpShip ? hooks.corpShip(c, 't') : false; break;
      case 'focus': c.strat = c.strat || {}; c.strat.focus = d.arg; c.strat.lock = state.t + 360; break; case 'nothing': break;
    }
    if (done) { r.fired = (r.fired || 0) + 1; return r.stop !== false; }
  }
  return false;
}
// вызывается из хода корабля (04-engine): вернуть {cond:'ai', base} или null
export function aiShip(s) {
  for (const r of AI.ship) {
    if (r.off) continue;
    const val = (p) => { const st = s.st || {};
      switch (p) { case 'fuel': return st.fuelCap > 0 ? s.fuel / st.fuelCap * 100 : 100; case 'cargo': { let t = 0; for (const k in s.cargo || {}) t += s.cargo[k]; return st.cargoCap > 0 ? t / st.cargoCap * 100 : 0; }
        case 'cond': return hooks.shipCond ? hooks.shipCond(s) : 100; case 'dist': return hooks.distEarth ? hooks.distEarth(s) : 0; case 'year': return year();
        case 'corp': return s.corp ? 1 : 0; case 'miner': return s.role === 'm' ? 1 : 0; case 'tanker': return s.role === 't' ? 1 : 0; } return 0; };
    if (!ok(r, val)) continue;
    r.fired = (r.fired || 0) + 1; const a = (r.do || {}).a;
    return {cond: 'ai', base: a === 'earth' ? 'earth' : 'nearest', name: r.name};
  }
  return null;
}
hooks.aiCorp = aiCorp; hooks.aiShip = aiShip;
