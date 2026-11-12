// @ts-nocheck
// Экономические постройки игрока на Земле — то же, что строят корпорации: заводы товаров, шахты, лаборатории.
// Платятся деньгами казны, строятся подрядчиками за срок. Госзаводы и госшахты потом живут на выручку, зарплаты лабораторий — из казны.
import { state, log, fmtN, GROUND } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { GOODS, FC, FW, PROD, hoursK } from './07-population.ts';
import { prodOf, unitOf } from './26-goods.ts';
import { MC, LAB_COST, LAB_RP, LAB_MIX, lmCap, lmEff } from './10-civil.ts';
import { esc } from './08-map-ui.ts';
import { matOf, matTxt, queueMat } from './03-build.ts';

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

const ORE = {fe: 'Железо', si: 'Кремний', cu: 'Медь', c: 'Углерод', ni: 'Никель', ti: 'Титан', ice: 'Лёд', ree: 'Редкоземельные', pt: 'Платиноиды', u: 'Уран'};
export function econHtml() {
  const P = EP(); if (!P) return '';
  const pc = x => `<span class="${x < .7 ? 'err' : x < .95 ? 'warn' : ''}">${fmtN(x * 100, 0)}%</span>`, btn = (k, g) => `<button class="btn sm" data-a="econ" data-k="${k}" data-g="${g}">В очередь</button>`;
  const corpFac = g => (state.corps || []).reduce((a, c) => a + ((c.home || c.civ) && (c.home || c.civ).fac[g] || 0), 0);
  const QM = queueMat();
  let h = `<div class="box"><h2>Экономические постройки Земли</h2>
    <div class="help">То же, что строят корпорации. Строятся мощностью стройки (очередь сверху: количество и доля мощности задаются в строке «Новый проект»). Зарплаты стройки и построек платит фонд госинвестиций (закон «Госинвестиции», Государство), не хватит — казна. Фонд: ${fmtN(state.invFund || 0)} кр, +${fmtN((P.invDay || 0) * 30)} в месяц.</div>
    <h3>Госзаводы (${fmtN(FW())} чел., выпуск по товару — см. «Выпуск завода»; 1 000 СБ + ${matTxt(matOf('efac'))} т)</h3>
    <table class="grid"><tr><th>Товар</th><th>Спрос/сут</th><th>Выпуск завода/сут</th><th>Удовл.</th><th>Госзаводов</th><th>Корп.</th><th>В очереди</th><th></th></tr>${Object.keys(GOODS).map(g => `<tr><td>${esc(GOODS[g].n)}</td><td class="n">${fmtN(P.dem[g] || 0)} ${unitOf(g)}</td><td class="n">${fmtN(FW() * prodOf(g) * hoursK(), 1)} ${unitOf(g)}</td><td class="n">${pc(P.sat[g] == null ? 1 : P.sat[g])}</td><td class="n">${fmtN(P.fac[g] || 0)}</td><td class="n">${fmtN(corpFac(g))}</td><td class="n">${inBuild('fac', g) || ''}</td><td>${btn('fac', g)}</td></tr>`).join('')}</table>
    <div class="row"><h3 class="grow">Госшахты: рудных ${fmtN(P.lmN || 0)}, угольных ${fmtN(P.lcN || 0)}${inBuild('mine', '') ? ', в очереди ' + inBuild('mine', '') : ''} — каждая (10 000 чел.) вынимает 1 млн т породы в год: железо 1 165 т/сут, уголь 1 500, титан 2,3, платина 12 кг… × эффективность жилы; руда — на рынок Земли, на ваш склад — доля космоса (как с налогов) (500 СБ + ${matTxt(matOf('emine'))} т)</h3>${btn('mine', '')}</div>
    <table class="grid"><tr><th>Руда</th><th>Нужно т/сут</th><th>Эффективность</th><th>Госшахты дают т/сут</th><th>Земле обеспечено</th><th>Недр (при полной добыче)</th><th>Шахт для 100%</th><th>На складе</th><th>Резерв стройки (30 сут)</th><th>Держать ещё, т</th></tr>${Object.keys(ORE).filter(r => P.rawMk && P.rawMk[r]).map(r => { const m = P.rawMk[r], g = state.ground.earth[r] || 0, e = lmEff(r);
      return `<tr><td>${ORE[r]}</td><td class="n">${fmtN(m.need, 1)}</td><td class="n">${fmtN(e * 100, 1)}%</td><td class="n">${fmtN(lmCap(r), 1)}</td><td class="n">${pc(P.rawSat && P.rawSat[r] != null ? P.rawSat[r] : 1)}</td><td class="n">${lmCap(r) > 0 ? fmtN(g / (lmCap(r) * 360), 0) + ' лет' : '—'} (${fmtN(g / ((state.gMax && state.gMax[r]) || GROUND.earth[r] || 1) * 100, 0)}% осталось)</td><td class="n">${e > 0 ? fmtN(m.need / e, 0) : '—'}</td><td class="n">${fmtN(state.stock[r] || 0)}</td><td class="n">${fmtN(QM[r] || 0)}</td><td><input type="number" min="0" data-keep="${r}" value="${(state.keep && state.keep[r]) || 0}" style="width:70px"></td></tr>`; }).join('')}</table>
    <div class="help">Госшахты везут руду на ваш склад. Заводам Земли склад продаёт только то, что сверх резерва: материалы всей очереди стройки и «держать ещё». Остальное уходит на рынок по рыночной цене, деньги — в казну.</div>
    <h3>Лаборатории (+${LAB_RP} очков науки/сут; 1 000 СБ + ${matTxt(matOf('elab'))} т)</h3>
    <table class="grid"><tr><th>Лаборатория</th><th>Есть</th><th>Очков/сут</th><th>В очереди</th><th></th></tr><tr><td>Государственная лаборатория</td><td class="n">${state.labs || 0}</td><td class="n">${fmtN((state.labs || 0) * LAB_RP)}</td><td class="n">${inBuild('lab', '') || ''}</td><td>${btn('lab', '')}</td></tr></table></div>`;
  return h;
}
