// @ts-nocheck
// Экономические постройки игрока на Земле — то же, что строят корпорации: заводы товаров, шахты, лаборатории.
// Платятся деньгами казны, строятся подрядчиками за срок. Госзаводы и госшахты потом живут на выручку, зарплаты лабораторий — из казны.
import { state, log, fmtN, GROUND } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { GOODS, FC, FW, PROD, hoursK } from './07-population.ts';
import { prodOf, unitOf } from './26-goods.ts';
import { MC, LAB_COST, LAB_RP, LAB_MIX, lmCap, lmEff } from './10-civil.ts';
import { esc } from './08-map-ui.ts';
import { matOf, matTxt, queueMat, CORP } from './03-build.ts';
import { PT } from './26-goods.ts';

export const ECON_DAYS = {fac: 180, mine: 120, lab: 90};
const E = () => (state.econ = state.econ || []);
const EP = () => state.cols && state.cols.earth && state.cols.earth.pop;
export const econCost = k => k === 'fac' ? FC() : k === 'mine' ? MC() : LAB_COST;
const inBuild = (k, g) => (state.build || []).filter(x => x.type === 'e' + k && (x.g || '') === (g || '')).reduce((a, x) => a + x.n, 0) + E().filter(x => x.k === k && x.g === g).reduce((a, x) => a + x.n, 0);

export function econOrder(k, g, n) {
  n = Math.max(1, Math.floor(+n || 1)); const c = econCost(k) * n, F = state.invFund || 0;
  if (F + state.money < c) { log(`Не хватает денег: нужно ${fmtN(c)} кр, в фонде госинвестиций ${fmtN(F)}, в казне ${fmtN(state.money)}.`); return false; }
  const f = Math.min(F, c); state.invFund = F - f; state.money -= c - f; // сначала фонд госинвестиций, остаток — из казны
  E().push({k, g, n, done: state.t + ECON_DAYS[k]}); return true;
}
// раз в месяц (из экономики Земли)
export function econTick(dt) {
  const P = EP(); if (!P) return;
  for (const x of [...E()]) if (x.done <= state.t) {
    if (x.k === 'fac') P.fac[x.g] = (P.fac[x.g] || 0) + x.n;
    else if (x.k === 'mine') P.lmN = (P.lmN || 0) + x.n;
    else state.labs = (state.labs || 0) + x.n;
    log(`Достроено: ${x.k === 'fac' ? 'госзавод «' + GOODS[x.g].n + '»' : x.k === 'mine' ? 'госшахта' : 'лаборатория'} × ${x.n}.`);
    E().splice(E().indexOf(x), 1);
  }
  const L = state.labs || 0; if (L > 0) { let w = 0; for (let s = 0; s < 4; s++) w += LAB_MIX[s] * P.wage[s]; state.money -= L * FW() * w * dt; state.rp = (state.rp || 0) + L * LAB_RP * dt; }
}
hooks.econTick = econTick; hooks.econCost = econCost;

const ORE = {fe: 'Железо', si: 'Кремний', w: 'Вольфрам', c: 'Уголь и нефть', co: 'Кобальт', ti: 'Титан', ice: 'Лёд', ree: 'Редкозем', pt: 'Платина', u: 'Уран'};
export function econHtml() {
  const P = EP(); if (!P) return '';
  const pc = x => `<span class="${x < .7 ? 'err' : x < .95 ? 'warn' : ''}">${fmtN(x * 100, 0)}%</span>`, btn = (k, g) => `<button class="btn sm" data-a="econ" data-k="${k}" data-g="${g}">В очередь</button>`;
  const corpFac = g => (state.corps || []).reduce((a, c) => a + ((c.home || c.civ) && (c.home || c.civ).fac[g] || 0), 0);
  const QM = queueMat();
  const qd = id => (state.build || []).filter(x => x.type === 'econ' && x.b === id).reduce((a, x) => a + x.n, 0), corpMines = () => (state.corps || []).reduce((a, c) => a + Object.values(((c.home || c.civ) || {}).mines || {}).reduce((x, y) => x + y, 0), 0), corpLabs = () => (state.corps || []).reduce((a, c) => a + (((c.home || c.civ) || {}).labs || 0), 0);
  const rows = Object.entries(CORP).map(([id, c]) => { const g = c.g, mine = c.kind === 'mine', lab = c.kind === 'lab', fac = c.kind === 'fac';
    const tr = c.kind === 'tr', yd = c.kind === 'yard', pw = g === 'pow' && PT[id], cm = pw ? (state.corps || []).reduce((a, x) => a + (((x.home || x.civ) || {}).pmix || {})[id] || 0, 0) : 0;
    const gov = pw ? fmtN((state.govMix || {})[id] || 0, 1) : fac ? fmtN(P.fac[g] || 0, 1) : mine ? fmtN(P.lmN || 0) : lab ? fmtN(state.labs || 0) : tr ? fmtN((P.tr || {})[c.g] || 0) : yd ? fmtN(state.bld.shipyard || 0) : '—', corp = pw ? fmtN(cm, 1) : fac ? fmtN(corpFac(g), 1) : mine ? fmtN(corpMines()) : lab ? fmtN(corpLabs()) : tr ? fmtN((state.corps || []).reduce((a, x) => a + ((((x.home || x.civ) || {}).tr || {})[c.g] || 0), 0)) : yd ? fmtN((state.corps || []).filter(x => (x.home || x.civ || {}).yard).length) : '—';
    return `<tr><td><b>${esc(c.name)}</b></td><td class="ds" title="${esc(c.desc)}">${esc(c.desc)}</td><td class="n">${fac ? fmtN(P.dem[g] || 0) + ' ' + unitOf(g) : ''}</td><td class="n">${fac ? pc(P.sat[g] == null ? 1 : P.sat[g]) : ''}</td><td class="n">${fmtN(c.sb)}</td><td>${matTxt(c.cost)}</td><td class="n">${gov}</td><td class="n">${corp}</td><td class="n">${qd(id) || ''}</td><td>${c.kind === 'tr' ? '<span class="muted">госсектор Земли строит сам</span>' : `<button class="btn sm" data-a="econ" data-b="${id}">В очередь</button>`}</td></tr>`; }).join('');
  let h = `<div class="box"><h2>Экономические постройки Земли</h2>
    <div class="help">Постройки корпораций из таблицы «Пояс». Их строят корпорации, можно строить и вам — тогда это госпредприятие, продаёт на общий рынок. Строятся мощностью стройки (очередь снизу) из материалов вашего склада. Зарплаты платит фонд госинвестиций (закон «Госинвестиции»), не хватит — казна. Фонд: ${fmtN(state.invFund || 0)} кр, +${fmtN((P.invDay || 0) * 30)} в месяц. «Гос.» и «У корпораций» — в заводах-эквивалентах по 10 000 чел. (у электростанций — по типу: ТЭС = 1, АЭС = 3, зелёная = 0,3; у логистики — центров, у верфи — верфей). ТЭС, АЭС, жильё, клиники, школы и институты изнашиваются за 50–70 лет.</div>
    <table class="grid"><tr><th>Постройка</th><th>Что делает</th><th>Спрос/сут</th><th>Удовл.</th><th>СБ</th><th>Материалы, т</th><th>Гос.</th><th>У корпораций</th><th>В очереди</th><th></th></tr>${rows}</table>
    <div class="row"><h3 class="grow">Руда Земли · коммерческих госшахт: рудных ${fmtN(P.lmN || 0)}, угольных ${fmtN(P.lcN || 0)}${inBuild('mine', '') ? ', в очереди ' + inBuild('mine', '') : ''} — каждая (10 000 чел.) вынимает 1 млн т породы в год: железо 1 165 т/сут, уголь 1 500, титан 2,3, платина 12 кг… × эффективность жилы; руда — на рынок Земли, на ваш склад — доля космоса (как с налогов) </h3></div>
    <table class="grid"><tr><th>Руда</th><th>Нужно т/сут</th><th>Эффективность</th><th>Госшахты дают т/сут</th><th>Земле обеспечено</th><th>Недр (при полной добыче)</th><th>Шахт для 100%</th><th>На складе</th><th>Резерв стройки (30 сут)</th><th>Держать ещё, т</th></tr>${Object.keys(ORE).filter(r => P.rawMk && P.rawMk[r]).map(r => { const m = P.rawMk[r], g = state.ground.earth[r] || 0, e = lmEff(r);
      return `<tr><td>${ORE[r]}</td><td class="n">${fmtN(m.need, 1)}</td><td class="n">${fmtN(e * 100, 1)}%</td><td class="n">${fmtN(lmCap(r), 1)}</td><td class="n">${pc(P.rawSat && P.rawSat[r] != null ? P.rawSat[r] : 1)}</td><td class="n">${lmCap(r) > 0 ? fmtN(g / (lmCap(r) * 360), 0) + ' лет' : '—'} (${fmtN(g / ((state.gMax && state.gMax[r]) || GROUND.earth[r] || 1) * 100, 0)}% осталось)</td><td class="n">${e > 0 ? fmtN(m.need / e, 0) : '—'}</td><td class="n">${fmtN(state.stock[r] || 0)}</td><td class="n">${fmtN(QM[r] || 0)}</td><td><input type="number" min="0" data-keep="${r}" value="${(state.keep && state.keep[r]) || 0}" style="width:70px"></td></tr>`; }).join('')}</table>
    <div class="help">Госшахты везут руду на ваш склад. Заводам Земли склад продаёт только то, что сверх резерва: материалы всей очереди стройки и «держать ещё». Остальное уходит на рынок по рыночной цене, деньги — в казну.</div>
    </div>`;
  return h;
}
