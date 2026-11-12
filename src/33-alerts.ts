// @ts-nocheck
// Сводка «Требует внимания»: проблемы и возможности на карте справа сверху. Клик по строке открывает нужный экран.
import { state, fmtN } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { GOODS, totals, withCtx } from './07-population.ts';
import { regsOf, regTemplate, regClim } from './30-regions.ts';
import { techOn, pctSum, buildUnits } from './03-build.ts';
import { GROUND } from './01-data.ts';
import { esc, ui } from './08-map-ui.ts';

const pc = x => fmtN(x * 100, 0) + '%';
const ORE = {fe: 'железа', si: 'кремния', w: 'вольфрама', c: 'угля и нефти', co: 'кобальта', ti: 'титана', ice: 'льда', ree: 'редкозема', pt: 'платины', u: 'урана'};
// lvl: 2 — плохо, 1 — внимание, 0 — возможность. go — куда вести: [вкладка, вид построек]
export function alerts() {
  const A = [], P = state.cols && state.cols.earth && state.cols.earth.pop; if (!P) return A;
  const R = regsOf('earth') || [], T = regTemplate('earth');
  // товары: по стране и худший регион
  const bad = Object.keys(GOODS).filter(g => (P.sat[g] ?? 1) < .9).sort((a, b) => P.sat[a] - P.sat[b]);
  for (const g of bad.slice(0, 4)) { let wi = -1, wv = 1; R.forEach((r, i) => { const v = r.sat && r.sat[g]; if (v != null && v < wv) { wv = v; wi = i; } });
    A.push({lvl: P.sat[g] < .75 ? 2 : 1, t: `Дефицит: ${GOODS[g].n} ${pc(P.sat[g])}${wi >= 0 && wv < P.sat[g] - .05 ? ` (${T[wi].n} ${pc(wv)})` : ''}`, go: ['earth', 'econ']}); }
  if (bad.length > 4) A.push({lvl: 1, t: `Ещё дефицитных товаров: ${bad.length - 4}`, go: ['earth', 'econ']});
  // сырьё и недра
  for (const r in ORE) { const s = P.rawSat && P.rawSat[r], m = P.rawMk && P.rawMk[r]; if (s != null && s < .95) A.push({lvl: s < .75 ? 2 : 1, t: `Не хватает ${ORE[r]}: добыча ${pc(s)} потребности`, go: ['earth', 'econ']});
    const g = state.ground && state.ground.earth && state.ground.earth[r]; if (m && m.need > 0 && g != null && GROUND.earth[r]) { const y = g / (m.need * 360); if (y < 60) A.push({lvl: y < 25 ? 2 : 1, t: `Недр ${ORE[r]} на ${fmtN(y, 0)} лет`, go: ['earth', 'econ']}); } }
  // регионы: безработица, бедность, климат
  R.forEach((r, i) => { const u = (r.un || 0) / Math.max(1, (r.un || 0) + (r.emp || 0)); if (u > .08) A.push({lvl: u > .15 ? 2 : 1, t: `${T[i].n}: безработица ${pc(u)}`, go: ['pop']});
    if (r.wel != null && r.wel < .8) A.push({lvl: r.wel < .65 ? 2 : 1, t: `${T[i].n}: товаров ${pc(r.wel)} от нужного`, go: ['pop']});
    if (r.ul != null) { const c = regClim('earth', i); if (c.u.heat > .05 || c.u.flood > .05) A.push({lvl: 1, t: `${T[i].n}: климат выгоняет людей (жара ${pc(c.u.heat)}, вода ${pc(c.u.flood)})`, go: ['pop']}); } });
  { const t = withCtx('earth', totals), u = t.wf > 0 ? t.un / t.wf : 0; if (u > .07) A.push({lvl: 1, t: `Безработица на Земле ${pc(u)}`, go: ['pop']}); }
  // наука, верфь, стройка, деньги
  const act = Object.values(state.research || {}).some(Boolean); if (!act) A.push({lvl: 2, t: 'Наука стоит: выберите исследования', go: ['sci']});
  if (!techOn('yard')) A.push({lvl: 1, t: 'Нет верфи: изучите «Орбитальные верфи»', go: ['sci']});
  else if (!(state.bld.shipyard > 0) && !(state.build || []).some(j => j.type === 'shipyard')) A.push({lvl: 1, t: 'Верфь изучена — постройте её', go: ['earth', '']});
  { const ps = pctSum(); if (ps < 99.5) A.push({lvl: 1, t: `Стройка: простаивает ${fmtN(100 - ps, 0)}% мощности (${fmtN(buildUnits() * (100 - ps) / 100, 0)} СБ/сут)`, go: ['earth', '']}); }
  const F = state.invFund || 0, fc = hooks.econCost ? hooks.econCost('fac') : 0; if (fc && F > fc * 10) A.push({lvl: 0, t: `Фонд госинвестиций: ${fmtN(F)} кр — хватит на ${fmtN(F / fc, 0)} заводов`, go: ['earth', 'econ']});
  if (state.money < 0) A.push({lvl: 2, t: `Казна в минусе: ${fmtN(state.money)} кр`, go: ['laws']});
  for (const a of A) a.k = /^Дефицит|Ещё дефицит/.test(a.t) ? 'goods' : /руд|железа|меди|Недр|кремния|углерода|льда|урана|платиноидов|редкоземельных|никеля|титана/.test(a.t) ? 'ore' : /климат/.test(a.t) ? 'clim' : /безработица|товаров \d/.test(a.t) ? 'pop' : /Наука/.test(a.t) ? 'sci' : /верф/i.test(a.t) ? 'yard' : /Стройка/.test(a.t) ? 'build' : /Казна/.test(a.t) ? 'money' : 'other';
  return A.sort((a, b) => b.lvl - a.lvl);
}
// красные иконки в верхней панели: по одной на вид проблемы, клик — сразу к нужному экрану
const ICON = {sci: ['⚗', 'Наука'], goods: ['⚕', 'Дефицит товаров'], ore: ['⛏', 'Руда'], pop: ['☹', 'Население'], clim: ['☀', 'Климат'], yard: ['⚓', 'Верфь'], build: ['⚒', 'Стройка'], money: ['₵', 'Казна'], other: ['!', 'Внимание']};
function renderIcons(A) {
  const box = document.getElementById('alicons'); if (!box) return;
  const by = {}; for (const a of A) if (a.lvl >= 2) (by[a.k] = by[a.k] || []).push(a);
  const h = Object.keys(by).map(k => `<button class="alic" data-alk="${k}" title="${esc(by[k].map(a => a.t).join('\n'))}">${ICON[k][0]}<span>${by[k].length > 1 ? by[k].length : ''}</span></button>`).join('');
  if (box._h !== h) { box._h = h; box.innerHTML = h; } box._by = by;
}
let open = true;
export function renderAlerts() {
  if (typeof document === 'undefined') return; const box = document.getElementById('alerts'); if (!box) return;
  let A = []; try { A = alerts(); } catch (e) { return; }
  const col = ['var(--good)', 'var(--warn)', 'var(--bad)'];
  const h = `<div class="ah" data-al="t">Требует внимания: ${A.length} ${open ? '▾' : '▸'}</div>` + (open ? A.slice(0, 18).map((a, i) => `<div class="ai" data-al="${i}"><i style="background:${col[a.lvl]}"></i>${esc(a.t)}</div>`).join('') + (A.length > 18 ? `<div class="ai muted">…и ещё ${A.length - 18}</div>` : '') : '');
  if (box._h !== h) { box._h = h; box.innerHTML = h; box._a = A; }
  renderIcons(A);
}
if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('click', e => { const ic = e.target && e.target.closest && e.target.closest('[data-alk]');
    if (ic) { const a = ((document.getElementById('alicons')._by || {})[ic.dataset.alk] || [])[0]; if (a) { if (a.go[1] != null) ui.bview = a.go[1]; hooks.showTab(a.go[0]); } return; }
    const el = e.target && e.target.closest && e.target.closest('[data-al]'); if (!el) return; const k = el.dataset.al;
    if (k === 't') { open = !open; renderAlerts(); return; }
    const a = (document.getElementById('alerts')._a || [])[+k]; if (!a) return; if (a.go[1] != null) ui.bview = a.go[1]; hooks.showTab(a.go[0]); });
  setInterval(renderAlerts, 1500);
}
