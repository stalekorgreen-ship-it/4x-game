// @ts-nocheck
// Оболочка интерфейса: иконки разделов сверху слева и подвкладки, панели «Состав» и «Работа».
import { BODY, RES, GROUND, TERRA, canShipMine, shipMineLimit, state, fmtN } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { FACT_W, GOODS, STR, STR_COL, totals } from './07-population.ts';
import { MINE_MIX } from './10-civil.ts';
import { $, bar, esc, setHtml, ui } from './08-map-ui.ts';

const I = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const SECTIONS = [
  {id: 'planets', name: 'Планеты', icon: I('<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)"/>'), subs: [['obj', 'Обзор'], ['pop', 'Население'], ['comp', 'Состав'], ['work', 'Работа'], ['earth', 'Постройки']]},
  {id: 'fleet', name: 'Флот', icon: I('<path d="M12 3l4 9v6l-4-2-4 2v-6z"/><path d="M8 12l-4 4M16 12l4 4"/>'), subs: [['fleet', 'Корабли'], ['off', 'Офицеры']]},
  {id: 'orders', name: 'Приказы', icon: I('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'), subs: [['orders', 'Приказы и правила']]},
  {id: 'yard', name: 'Верфь', icon: I('<path d="M4 20h16M6 20v-5h12v5M8 15V9h8v6M12 9V4"/>'), subs: [['yard', 'Верфь и конструктор']]},
  {id: 'sci', name: 'Наука', icon: I('<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>'), subs: [['sci', 'Исследования']]},
  {id: 'corp', name: 'Корпорации', icon: I('<path d="M4 21V7l8-4 8 4v14M9 21v-6h6v6M8 10h2M14 10h2"/>'), subs: [['corp', 'Корпорации']]},
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
export function refreshWork() {
  const p = $('p-work'); if (!p || !state.pop) return;
  const P = state.pop, t = totals(), corps = state.corps || [];
  const th = 'style="text-align:left;padding:2px 6px"', td = 'style="padding:2px 6px;border-top:1px solid #8883"';
  const rows = [];
  const legacy = (s) => Object.keys(GOODS).reduce((a, g) => a + P.fac[g] * FACT_W * GOODS[g].mix[s], 0);
  const corpF = (s) => corps.reduce((a, c) => a + Object.keys(c.civ.fac).reduce((x, g) => x + c.civ.fac[g] * FACT_W * GOODS[g].mix[s], 0), 0);
  const mines = (s) => corps.reduce((a, c) => a + Object.values(c.civ.mines).reduce((x, n) => x + n, 0) * FACT_W * MINE_MIX[s], 0);
  const cols = [['Старая промышленность', legacy], ['Заводы корпораций', corpF], ['Шахты корпораций', mines], ['Прочее (услуги, государство)', (s) => P.oth[s]]];
  let h = `<div class="box"><h2>Кто работает</h2><div data-sc style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr><th ${th}>Сектор</th>${STR.map((x, i) => `<th ${th}><span style="color:${STR_COL[i]}">■</span> ${x}</th>`).join('')}</tr>`;
  for (const [n, f] of cols) h += `<tr><td ${td}>${n}</td>${[0, 1, 2, 3].map((s) => `<td ${td}>${fmtN(f(s))}</td>`).join('')}</tr>`;
  h += `<tr><td ${td}><b>Безработные</b></td>${[0, 1, 2, 3].map((s) => `<td ${td}>${fmtN(t.S[s].un)}</td>`).join('')}</tr>`;
  h += `<tr><td ${td}>Учатся (15+)</td>${[0, 1, 2, 3].map((s) => { let n = 0; for (let a = 15; a <= 100; a++) n += P.c[s][a].st; return `<td ${td}>${fmtN(n)}</td>`; }).join('')}</tr>`;
  h += `<tr><td ${td}>Зарплата в сутки</td>${P.wage.map((w) => `<td ${td}>${fmtN(w, 2)}</td>`).join('')}</tr></table></div><div class="help">Сколько мест нужно секторам и сколько людей реально занято. Если мест больше, чем людей, завод простаивает и выпуск падает.</div></div>`;
  setHtml(p, h);
}
