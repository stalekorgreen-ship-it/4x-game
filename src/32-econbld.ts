// @ts-nocheck
// Экономические постройки игрока на Земле — то же, что строят корпорации: заводы товаров, шахты, лаборатории.
// Платятся деньгами казны, строятся подрядчиками за срок. Госзаводы и госшахты потом живут на выручку, зарплаты лабораторий — из казны.
import { state, log, fmtN, GROUND } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { GOODS, FC, FW, PROD, hoursK } from './07-population.ts';
import { MC, MINE_T, LAB_COST, LAB_RP, LAB_MIX, lmCap } from './10-civil.ts';
import { esc } from './08-map-ui.ts';

export const ECON_DAYS = {fac: 180, mine: 120, lab: 90};
const E = () => (state.econ = state.econ || []);
const EP = () => state.cols && state.cols.earth && state.cols.earth.pop;
export const econCost = k => k === 'fac' ? FC() : k === 'mine' ? MC() : LAB_COST;
const inBuild = (k, g) => E().filter(x => x.k === k && x.g === g).reduce((a, x) => a + x.n, 0);

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
    else if (x.k === 'mine') { P.lm = P.lm || {}; P.lm[x.g] = (P.lm[x.g] || 0) + x.n; }
    else state.labs = (state.labs || 0) + x.n;
    log(`Достроено: ${x.k === 'fac' ? 'госзавод «' + GOODS[x.g].n + '»' : x.k === 'mine' ? 'госшахта (' + x.g + ')' : 'лаборатория'} × ${x.n}.`);
    E().splice(E().indexOf(x), 1);
  }
  const L = state.labs || 0; if (L > 0) { let w = 0; for (let s = 0; s < 4; s++) w += LAB_MIX[s] * P.wage[s]; state.money -= L * FW() * w * dt; state.rp = (state.rp || 0) + L * LAB_RP * dt; }
}
hooks.econTick = econTick; hooks.econCost = econCost;

const ORE = {fe: 'Железо', si: 'Кремний', cu: 'Медь', c: 'Углерод', ni: 'Никель', ti: 'Титан', ice: 'Лёд', ree: 'Редкоземельные', pt: 'Платиноиды', u: 'Уран'};
export function econHtml() {
  const P = EP(); if (!P) return '';
  const pc = x => `<span class="${x < .7 ? 'err' : x < .95 ? 'warn' : ''}">${fmtN(x * 100, 0)}%</span>`, btn = (k, g) => `<button class="btn sm" data-a="econ" data-k="${k}" data-g="${g}">Построить</button>`;
  const corpFac = g => (state.corps || []).reduce((a, c) => a + ((c.home || c.civ) && (c.home || c.civ).fac[g] || 0), 0);
  let h = `<div class="box"><div class="row"><h2 class="grow">Экономические постройки Земли</h2>Строить за раз <input type="number" id="ec-n" min="1" value="${state.ecN || 10}" style="width:60px"> шт.</div>
    <div class="stats"><span>Фонд госинвестиций</span><span>${fmtN(state.invFund || 0)} кр</span><span>Пополнение в месяц</span><span>${fmtN((P.invDay || 0) * 30)} кр (закон «Госинвестиции», Государство)</span></div>
    <div class="help">То же, что строят корпорации. Оплата из фонда госинвестиций, не хватит — из казны; строят подрядчики. Госзаводы и госшахты продают по себестоимости и живут на выручку; лаборатории — +${LAB_RP} очков науки в сутки, зарплаты из казны.</div>
    <h3>Заводы (${fmtN(FW())} чел., ${fmtN(FW() * PROD * hoursK(), 0)} т/сут; ${fmtN(FC())} кр, ${ECON_DAYS.fac} сут)</h3>
    <table class="grid"><tr><th>Товар</th><th>Спрос/сут</th><th>Удовл.</th><th>Госзаводов</th><th>Корп.</th><th>Строится</th><th></th></tr>${Object.keys(GOODS).map(g => `<tr><td>${esc(GOODS[g].n)}</td><td class="n">${fmtN(P.dem[g] || 0)}</td><td class="n">${pc(P.sat[g] == null ? 1 : P.sat[g])}</td><td class="n">${fmtN(P.fac[g] || 0)}</td><td class="n">${fmtN(corpFac(g))}</td><td class="n">${inBuild('fac', g) || ''}</td><td>${btn('fac', g)}</td></tr>`).join('')}</table>
    <h3>Шахты (${fmtN(MINE_T)} т/сут руды; ${fmtN(MC())} кр, ${ECON_DAYS.mine} сут)</h3>
    <table class="grid"><tr><th>Руда</th><th>Нужно т/сут</th><th>Госшахты т/сут</th><th>Обеспечено</th><th>Недр при полной добыче</th><th>Госшахт</th><th>Строится</th><th></th></tr>${Object.keys(ORE).filter(r => P.rawMk && P.rawMk[r]).map(r => { const m = P.rawMk[r], g = state.ground.earth[r] || 0;
      return `<tr><td>${ORE[r]}</td><td class="n">${fmtN(m.need, 1)}</td><td class="n">${fmtN(lmCap(r), 1)}</td><td class="n">${pc(P.rawSat && P.rawSat[r] != null ? P.rawSat[r] : 1)}</td><td class="n">${m.need > 0 ? fmtN(g / (m.need * 360), 0) + ' лет' : '—'} (${fmtN(g / (GROUND.earth[r] || 1) * 100, 0)}% осталось)</td><td class="n">${fmtN((P.lm && P.lm[r]) || 0, 1)}</td><td class="n">${inBuild('mine', r) || ''}</td><td>${btn('mine', r)}</td></tr>`; }).join('')}</table>
    <h3>Лаборатории (${fmtN(LAB_COST)} кр, ${ECON_DAYS.lab} сут)</h3>
    <table class="grid"><tr><th>Лаборатория</th><th>Есть</th><th>Очков/сут</th><th>Строится</th><th></th></tr><tr><td>Государственная лаборатория</td><td class="n">${state.labs || 0}</td><td class="n">${fmtN((state.labs || 0) * LAB_RP)}</td><td class="n">${inBuild('lab', '') || ''}</td><td>${btn('lab', '')}</td></tr></table></div>`;
  return h;
}
