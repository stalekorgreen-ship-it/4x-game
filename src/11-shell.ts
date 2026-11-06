// @ts-nocheck
// Оболочка интерфейса: иконки разделов сверху слева и подвкладки, панели «Состав» и «Работа».
import { BODY, RES, GROUND, TERRA, canShipMine, shipMineLimit, state, fmtN } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { COLONIZABLE, FW, GOODS, STR, STR_COL, colInfo, colPicker, colSel, foundColony, foundWhy, totals, withCtx } from './07-population.ts';
import { MINE_MIX } from './10-civil.ts';
import { $, bar, esc, setHtml, ui } from './08-map-ui.ts';

const I = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const SECTIONS = [
  {id: 'planets', name: 'Планеты', icon: I('<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)"/>'), subs: [['obj', 'Обзор'], ['pop', 'Население'], ['comp', 'Состав'], ['work', 'Работа'], ['col', 'Колонии'], ['earth', 'Постройки']]},
  {id: 'fleet', name: 'Флот', icon: I('<path d="M12 3l4 9v6l-4-2-4 2v-6z"/><path d="M8 12l-4 4M16 12l4 4"/>'), subs: [['fleet', 'Корабли'], ['off', 'Офицеры']]},
  {id: 'orders', name: 'Приказы', icon: I('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'), subs: [['orders', 'Приказы и правила']]},
  {id: 'yard', name: 'Верфь', icon: I('<path d="M4 20h16M6 20v-5h12v5M8 15V9h8v6M12 9V4"/>'), subs: [['yard', 'Верфь и конструктор']]},
  {id: 'sci', name: 'Наука', icon: I('<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>'), subs: [['sci', 'Исследования']]},
  {id: 'corp', name: 'Корпорации', icon: I('<path d="M4 21V7l8-4 8 4v14M9 21v-6h6v6M8 10h2M14 10h2"/>'), subs: [['corp', 'Корпорации']]},
  {id: 'state', name: 'Государство', icon: I('<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 006 0zM17 7l-3 7a3 3 0 006 0z"/>'), subs: [['laws', 'Законы и кредиты']]},
  {id: 'find', name: 'Поиск', icon: I('<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>'), subs: [['find', 'Поиск']]},
  {id: 'log', name: 'Журнал', icon: I('<path d="M6 4h12v14a2 2 0 01-2 2H6zM9 8h6M9 12h6M9 16h4"/>'), subs: [['log', 'Журнал событий']]},
];
const last = {};
export const sectionOf = (tab) => SECTIONS.find((s) => s.subs.some((x) => x[0] === tab)) || SECTIONS[0];
export function buildShell() {
  const bar = $('iconbar'); if (!bar) return;
  bar.innerHTML = SECTIONS.map((s) => `<button class="ico" data-sec="${s.id}" title="${s.name}" aria-label="${s.name}">${s.icon}<span>${s.name}</span></button>`).join('');
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (!b) return; const s = SECTIONS.find((x) => x.id === b.dataset.sec); hooks.showTab(last[s.id] || s.subs[0][0]); });
}
export function syncShell(tab) {
  const s = sectionOf(tab); last[s.id] = tab;
  document.querySelectorAll('#iconbar .ico').forEach((b) => b.classList.toggle('on', b.dataset.sec === s.id));
  const st = $('subtabs'); if (!st) return;
  st.hidden = s.subs.length < 2;
  const h = s.subs.map(([t, n]) => `<button class="tab${t === tab ? ' on' : ''}" data-tab="${t}">${n}</button>`).join('');
  if (st._h !== h) { st._h = h; st.innerHTML = h; }
}

/* --- Состав: недра, руды, газы выбранного тела --- */
export function refreshComp() {
  const p = $('p-comp'); if (!p) return;
  const id = ui.sel.kind === 'body' ? ui.sel.id : 'earth', b = BODY[id];
  let h = `<div class="box"><h2>Состав: ${esc(b.name)}</h2>`;
  if (b.d) h += `<div class="muted">Диаметр ${fmtN(b.d, b.d < 10 ? 2 : 0)} км · ${canShipMine(id) ? 'доступен корабельным лазерам' : 'слишком велик для лазеров (лимит ' + shipMineLimit() + ' км)'}</div>`;
  const row = (k, v, max) => `<div class="row"><span style="width:90px">${RES[k] || k}</span>${bar(max ? v / max : 0)}<span class="mono">${fmtN(v)} т</span></div>`;
  const gr = state.ground && state.ground[id];
  if (gr) h += `<h3>Недра (шахты)</h3>` + Object.entries(gr).map(([k, v]) => row(k, v, GROUND[id] ? GROUND[id][k] : v)).join('');
  if (state.ast[id]) h += `<h3>Руды и летучие (корабельная добыча)</h3>` + Object.entries(state.ast[id]).map(([k, v]) => row(k, v, b.ores[k])).join('');
  if (!gr && !state.ast[id]) h += `<div class="help">У этого тела нет разведанных ресурсов.</div>`;
  if (TERRA[id]) { const T = TERRA[id], t = state.terra[id] || {}; h += `<h3>Тераформирование</h3>` + Object.keys(T.need).map((k) => `<div class="row"><span style="width:90px">${RES[k]}</span>${bar((t[k] || 0) / T.need[k])}<span class="mono">${fmtN(t[k] || 0)} / ${fmtN(T.need[k])}</span></div>`).join(''); }
  setHtml(p, h + '</div>');
}

/* --- Работа: где заняты люди (только Земля) --- */
export function refreshWork() { if (state.cols) withCtx(colSel(), refreshWorkI); }
function refreshWorkI() {
  const p = $('p-work'); if (!p || !state.pop) return;
  const P = state.pop, t = totals(), corps = (state.corps || []).filter(c => c.civ), FACT_W = FW();
  const th = 'style="text-align:left;padding:2px 6px"', td = 'style="padding:2px 6px;border-top:1px solid #8883"';
  const rows = [];
  const legacy = (s) => Object.keys(GOODS).reduce((a, g) => a + P.fac[g] * FACT_W * GOODS[g].mix[s], 0);
  const corpF = (s) => corps.reduce((a, c) => a + Object.keys(c.civ.fac).reduce((x, g) => x + c.civ.fac[g] * FACT_W * GOODS[g].mix[s], 0), 0);
  const mines = (s) => corps.reduce((a, c) => a + Object.values(c.civ.mines).reduce((x, n) => x + n, 0) * FACT_W * MINE_MIX[s], 0);
  const cols = [['Старая промышленность', legacy], ['Заводы корпораций', corpF], ['Шахты корпораций', mines], ['Прочее (услуги, государство)', (s) => P.oth[s]]];
  let h = `<div class="box">${colPicker()}<h2>Кто работает: ${esc(state.cols[colSel()].name)}</h2><div data-sc style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr><th ${th}>Сектор</th>${STR.map((x, i) => `<th ${th}><span style="color:${STR_COL[i]}">■</span> ${x}</th>`).join('')}</tr>`;
  for (const [n, f] of cols) h += `<tr><td ${td}>${n}</td>${[0, 1, 2, 3].map((s) => `<td ${td}>${fmtN(f(s))}</td>`).join('')}</tr>`;
  h += `<tr><td ${td}><b>Безработные</b></td>${[0, 1, 2, 3].map((s) => `<td ${td}>${fmtN(t.S[s].un)}</td>`).join('')}</tr>`;
  h += `<tr><td ${td}>Учатся (15+)</td>${[0, 1, 2, 3].map((s) => { let n = 0; for (let a = 15; a <= 100; a++) n += P.c[s][a].st; return `<td ${td}>${fmtN(n)}</td>`; }).join('')}</tr>`;
  h += `<tr><td ${td}>Зарплата в сутки</td>${P.wage.map((w) => `<td ${td}>${fmtN(w, 2)}</td>`).join('')}</tr></table></div><div class="help">Сколько мест нужно секторам и сколько людей реально занято. Если мест больше, чем людей, завод простаивает и выпуск падает.</div></div>`;
  setHtml(p, h);
}

/* --- Колонии: обзор как в Авроре, основание на выбранном теле --- */
export function refreshCol() {
  const p = $('p-col'); if (!p || !state.cols) return;
  const th = 'style="text-align:left;padding:2px 6px"', td = 'style="padding:2px 6px;border-top:1px solid #8883;cursor:pointer"';
  const rows = Object.values(state.cols).map((c) => {
    const P = c.pop; let imp = 0; for (const g in (P.gImp || {})) imp += P.gImp[g];
    let fac = 0; for (const g in P.fac) fac += P.fac[g]; let cf = 0; for (const k of state.corps || []) { const v = c.id === 'earth' ? k.home || k.civ : (k.civs || {})[c.id]; if (v) for (const g in v.fac) cf += v.fac[g]; }
    const grow = P.n > 0 ? (P.birth - P.death) / P.n * 100 : 0;
    return `<tr data-col="${c.id}"><td ${td}><b>${esc(c.name)}</b></td><td ${td}>${fmtN(P.n || 0)}${P.hab ? ' / ' + fmtN(P.hab) : ''}</td><td ${td}>${fmtN(grow, 2)}%</td><td ${td}>${fmtN((P.avgWel == null ? 1 : P.avgWel) * 100, 0)}%</td><td ${td}>${fmtN(fac)} / ${fmtN(cf)}</td><td ${td}>${fmtN(P.tax || 0)}</td><td ${td}>${imp > 0 ? fmtN(imp) : '—'}</td></tr>`;
  }).join('');
  const id = ui.sel.kind === 'body' ? ui.sel.id : 'earth', b = BODY[id], why = foundWhy(id);
  let h = `<div class="box"><h2>Колонии</h2><div data-sc style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr>${['Колония', 'Население / вместимость', 'Рост в год', 'Довольство', 'Заводов старых / корп.', 'Налог/сут', 'Ввоз товаров/сут'].map((x) => `<th ${th}>${x}</th>`).join('')}</tr>${rows}</table></div><div class="help">Нажмите строку — открыть население колонии. На колониях работают те же механики, что на Земле: страты, возраст, зарплаты, заводы, шахты, налоги. Недостающее завозят с Земли дороже, поэтому корпорации сами открывают на колониях филиалы.</div></div>`;
  h += `<div class="box"><h2>Основать колонию: ${esc(b ? b.name : '—')}</h2>`;
  if (COLONIZABLE(id) && !state.cols[id]) { const I = colInfo(id); h += `<div class="stats"><span>Стоимость</span><span>${fmtN(I.cost)} кр</span><span>Поселенцы</span><span>${fmtN(I.settlers)}</span><span>Вместимость</span><span>${fmtN(I.hab)}</span><span>Надбавка к ввозу</span><span>×${fmtN(I.dist, 2)}</span></div>`; }
  h += why ? `<div class="help">${why}</div>` : '';
  h += `<button class="btn" data-found="${esc(id)}"${why ? ' disabled' : ''}>Основать колонию</button><div class="help">Выберите тело на карте, приведите туда любой свой корабль, затем нажмите кнопку. Годятся планеты, спутники и астероиды.</div></div>`;
  setHtml(p, h);
}
(function colEvents() {
  const clk = (e) => {
    const f = e.target.closest('[data-found]'); if (f) { if (foundColony(f.dataset.found)) ui.colSel = f.dataset.found; hooks.showTab(ui.tab); return; }
    const c = e.target.closest('[data-col]'); if (c) { ui.colSel = c.dataset.col; hooks.showTab(ui.tab === 'col' ? 'pop' : ui.tab); }
  };
  for (const id of ['p-pop', 'p-work', 'p-col']) { const el = document.getElementById(id); if (el) el.addEventListener('click', clk); }
})();
