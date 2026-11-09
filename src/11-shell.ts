// @ts-nocheck
import { colBldHtml, colBuildAdd } from './19-colbld.ts';
// Оболочка интерфейса: иконки разделов сверху слева и подвкладки, панели «Состав» и «Работа».
import { depleteYears, veinEff, BODY, RES, GROUND, TERRA, canShipMine, shipMineLimit, state, fmtN } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { COLONIZABLE, FW, GOODS, STR, STR_COL, colInfo, colPicker, colSel, foundColony, foundWhy, totals, withCtx } from './07-population.ts';
import { MINE_MIX } from './10-civil.ts';
import { PRICE, boughtMonth, buyPol } from './06-corps.ts';
import { $, bar, esc, setHtml, ui } from './08-map-ui.ts';

const I = (p) => `<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${p}</svg>`;
export const SECTIONS = [
  {id: 'planets', name: 'Планеты', icon: I('<circle cx="12" cy="12" r="5"/><ellipse cx="12" cy="12" rx="10" ry="3.5" transform="rotate(-20 12 12)"/>'), subs: [['obj', 'Обзор'], ['pop', 'Население'], ['comp', 'Состав'], ['climate', 'Климат'], ['work', 'Работа'], ['col', 'Колонии'], ['earth', 'Постройки']]},
  {id: 'fleet', name: 'Флот', icon: I('<path d="M12 3l4 9v6l-4-2-4 2v-6z"/><path d="M8 12l-4 4M16 12l4 4"/>'), subs: [['fleet', 'Корабли'], ['demo', 'Бой-демо'], ['off', 'Офицеры']]},
  {id: 'orders', name: 'Приказы', icon: I('<path d="M8 6h12M8 12h12M8 18h12"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/>'), subs: [['orders', 'Приказы и правила']]},
  {id: 'yard', name: 'Верфь', icon: I('<path d="M4 20h16M6 20v-5h12v5M8 15V9h8v6M12 9V4"/>'), subs: [['yard', 'Верфь и конструктор']]},
  {id: 'sci', name: 'Наука', icon: I('<path d="M9 3h6M10 3v6l-5 9a2 2 0 002 3h10a2 2 0 002-3l-5-9V3"/>'), subs: [['sci', 'Исследования']]},
  {id: 'corp', name: 'Корпорации', icon: I('<path d="M4 21V7l8-4 8 4v14M9 21v-6h6v6M8 10h2M14 10h2"/>'), subs: [['corp', 'Корпорации'], ['trade', 'Закупки сырья'], ['cargo', 'Грузы']]},
  {id: 'state', name: 'Государство', icon: I('<path d="M12 3v18M5 7h14M7 7l-3 7a3 3 0 006 0zM17 7l-3 7a3 3 0 006 0z"/>'), subs: [['laws', 'Законы и кредиты']]},
  {id: 'find', name: 'Поиск', icon: I('<circle cx="11" cy="11" r="6"/><path d="M16 16l5 5"/>'), subs: [['find', 'Поиск']]},
  {id: 'log', name: 'Журнал', icon: I('<path d="M6 4h12v14a2 2 0 01-2 2H6zM9 8h6M9 12h6M9 16h4"/>'), subs: [['log', 'Журнал событий']]},
];
const last = {};
export const sectionOf = (tab) => SECTIONS.find((s) => s.subs.some((x) => x[0] === tab)) || SECTIONS[0];
export function buildShell() {
  const bar = $('iconbar'); if (!bar) return;
  bar.innerHTML = SECTIONS.map((s) => `<button class="ico" data-sec="${s.id}" title="${s.name}" aria-label="${s.name}">${s.icon}<span>${s.name}</span></button>`).join('');
  bar.addEventListener('click', (e) => { const b = e.target.closest('[data-sec]'); if (!b) return; const s = SECTIONS.find((x) => x.id === b.dataset.sec); if (ui.tab !== 'map' && sectionOf(ui.tab).id === s.id) return hooks.showTab('map'); hooks.showTab(last[s.id] || s.subs[0][0]); });
}
export function syncShell(tab) {
  const s = sectionOf(tab); last[s.id] = tab;
  document.querySelectorAll('#iconbar .ico').forEach((b) => b.classList.toggle('on', b.dataset.sec === s.id));
  const st = $('subtabs'); if (!st) return;
  st.hidden = s.subs.length < 2;
  const h = s.subs.map(([t, n]) => `<button class="tab${t === tab ? ' on' : ''}" data-tab="${t}">${n}</button>`).join('');
  if (st._h !== h) { st._h = h; st.innerHTML = h; }
}

const endTxt = (id, k, max) => { const n = id === 'earth' ? state.bld.mine * (state.tech && state.tech.deepdrill ? 1.5 : 1) : 0; if (!(n > 0)) return 'нет шахт'; const y = depleteYears(id, k, max, n); return '90% за ' + (y > 1e6 ? '>1 млн' : fmtN(y, y < 10 ? 1 : 0)) + ' лет'; };
/* --- Климат и стоимость колонии --- */
import { climateOf, colonyCost, GAS_NAME } from './14-climate.ts';
import { ppm } from './28-climate.ts';
export function refreshClimate() {
  const p = $('p-climate'); if (!p) return;
  const id = ui.sel.kind === 'body' ? ui.sel.id : 'earth', b = BODY[id], c = climateOf(id), K = colonyCost(id), f = (v, d = 1) => fmtN(v, d);
  const col = state.cols && state.cols[id];
  let h = `<div class="box"><h2>Климат: ${esc(b.name)}</h2><div class="stats">
    <span>Смена дня и ночи</span><span>${f(c.day)} ч</span><span>Альбедо</span><span>${f(c.alb, 2)}</span>
    <span>Средняя температура</span><span>${f(c.mean, 0)} °C</span><span>Днём (максимум)</span><span>${f(c.max, 0)} °C</span><span>Ночью (минимум)</span><span>${f(c.min, 0)} °C</span>
    <span>Температура под землёй</span><span>${f(c.under, 0)} °C</span><span>Атмосферное давление</span><span>${c.p >= .01 ? f(c.p, 2) : c.p.toExponential(1)} атм</span>
    <span>Масса атмосферы</span><span>${c.atmT ? c.atmT.toExponential(2) + ' т' : 'нет'}</span>
    <span>Вода (запас)</span><span>${c.water ? c.water.toExponential(2) + ' т' : 'нет'}</span><span>Гидросфера</span><span>${f(c.wcov * 100, 0)} % поверхности</span>
    <span>Радиация</span><span>${f(c.rad, 1)} × Земли</span><span>Магнитное поле</span><span>${c.mag ? 'есть' : 'нет'}</span>
    <span>Диаметр</span><span>${c.d ? fmtN(c.d, c.d < 10 ? 2 : 0) + ' км' : '—'}</span><span>Гравитация</span><span>${f(c.g, 3)} g</span>
    <span>Удалённость от звезды</span><span>${f(c.a, 2)} а.е.</span></div>`;
  { const d = state.clim && state.clim[id]; if (d) h += `<h3>Изменение климата</h3><div class="stats"><span>Потепление с 2030</span><span>${d.dT >= 0 ? '+' : ''}${f(d.dT, 2)} °C</span><span>CO₂ в атмосфере</span><span>${f(ppm(id), 0)} ppm</span><span>Выбросы</span><span>${f(d.emY / 1e9, 1)} Гт/год</span><span>Уровень моря</span><span>+${f(d.sea, 2)} м</span><span>Затоплено городов</span><span>${f(d.fl * 100, 1)} %</span>${d.reg.map(r => `<span>${esc(r.n)}: пар</span><span>${r.dc > 0 ? f(r.rain * 100, 0) + ' % до вечных дождей' : 'нет источников'}${r.wet ? ' · вечные дожди' : ''}</span>`).join('')}</div>`; }
  const gk = Object.keys(c.gas).sort((x, y) => c.gas[y] - c.gas[x]);
  h += gk.length ? `<h3>Газы атмосферы</h3><div class="stats">${gk.map(k => `<span>${GAS_NAME[k] || k}</span><span>${f(c.gas[k] * 100, c.gas[k] < .01 ? 3 : 1)} % · ${c.gasT[k].toExponential(2)} т</span>`).join('')}</div>` : '<div class="muted">Атмосферы нет.</div>';
  h += `</div><div class="box"><h2>Стоимость колонии: ${f(K.cc, 1)} — ${K.mode === 'under' ? 'под землёй' : 'на поверхности'}</h2><div class="help">Это не цена в кредитах, а показатель эффективности жизнеобеспечения. Одна единица инфраструктуры обеспечивает 10000 / (1 + стоимость) человек.</div><div class="stats"><span>На поверхности</span><span>${f(K.surf, 1)}</span><span>Под землёй</span><span>${f(K.und, 1)}</span></div><div class="help">Берётся дешевле. Если поверхность убийственна, люди живут в подземельях; терраформинг со временем делает выгодной поверхность.</div><div class="stats">${K.rows.filter(r => r[1] >= .05).map(r => `<span>${r[0]}</span><span>+${f(r[1], 1)}</span>`).join('') || '<span>Всё в норме</span><span>0</span>'}<span><b>Человек на 1 ед. инфраструктуры</b></span><span><b>${fmtN(K.per)}</b></span>`;
  if (col) h += `<span>Инфраструктуры в колонии</span><span>${fmtN(col.infra || 0)} ед.</span><span>Вместимость</span><span>${col.pop.hab ? fmtN(col.pop.hab) : 'без ограничений'}</span>`;
  h += '</div></div>';
  setHtml(p, h);
}
/* --- Состав: недра, руды, газы выбранного тела --- */
export function refreshComp() {
  const p = $('p-comp'); if (!p) return;
  const id = ui.sel.kind === 'body' ? ui.sel.id : 'earth', b = BODY[id];
  let h = `<div class="box"><h2>Состав: ${esc(b.name)}</h2>`;
  if (b.d) h += `<div class="muted">Диаметр ${fmtN(b.d, b.d < 10 ? 2 : 0)} км · ${canShipMine(id) ? 'доступен корабельным лазерам' : 'слишком велик для лазеров (лимит ' + shipMineLimit() + ' км)'}</div>`;
  const row = (k, v, max, g) => `<div class="row"><span style="width:90px">${RES[k] || k}</span>${bar(max ? v / max : 0)}<span class="mono">${fmtN(v)} т · эфф. ${fmtN(veinEff(id, k, v, max || v) * 100, 0)}%${g ? ' · ' + endTxt(id, k, max) : ''}</span></div>`;
  const gr = state.ground && state.ground[id];
  if (gr) h += `<h3>Недра (шахты)</h3>` + Object.entries(gr).map(([k, v]) => row(k, v, GROUND[id] ? GROUND[id][k] : v, 1)).join('') + `<div class="help">«90% за» — через сколько лет шахты выработают жилу на 90% при нынешнем числе шахт (дальше добыча всё медленнее).</div>`;
  if (state.ast[id]) h += `<h3>Руды и летучие (корабельная добыча)</h3><div class="help">Эффективность жилы = сложность тела × остаток: выбрали 50% — вдвое медленнее. Лазер и шахта берут все жилы сразу.</div>` + Object.entries(state.ast[id]).map(([k, v]) => row(k, v, b.ores[k])).join('');
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
  if (COLONIZABLE(id) && !state.cols[id]) { const I = colInfo(id); h += `<div class="stats"><span>Поселенцы</span><span>${fmtN(I.settlers)}</span><span>Вместимость</span><span>${fmtN(I.hab)}</span><span>Надбавка к ввозу</span><span>×${fmtN(I.dist, 2)}</span></div>`; }
  h += why ? `<div class="help">${why}</div>` : '';
  h += `<button class="btn" data-found="${esc(id)}"${why ? ' disabled' : ''}>Отправить поселенцев</button><div class="help">Выберите тело на карте и нажмите кнопку: корпорация бесплатно для вас довезёт поселенцев с Земли. Колония появляется, как только там живёт хоть один человек. Годятся планеты, спутники и астероиды.</div></div>`;
  h += colBldHtml(ui.colSel && state.cols[ui.colSel] ? ui.colSel : id);
  setHtml(p, h);
}
(function colEvents() {
  const clk = (e) => {
    const cb = e.target.closest('[data-cbld]'); if (cb) { colBuildAdd(cb.dataset.cid, cb.dataset.cbld); hooks.showTab(ui.tab); return; }
    const f = e.target.closest('[data-found]'); if (f) { if (foundColony(f.dataset.found)) ui.colSel = f.dataset.found; hooks.showTab(ui.tab); return; }
    const c = e.target.closest('[data-col]'); if (c) { ui.colSel = c.dataset.col; hooks.showTab(ui.tab === 'col' ? 'pop' : ui.tab); }
  };
  for (const id of ['p-pop', 'p-work', 'p-col']) { const el = document.getElementById(id); if (el) el.addEventListener('click', clk); }
})();

/* --- Закупки сырья: общая политика игрока, склад на Земле --- */
const TR_MODES = [['off', 'Не покупать'], ['all', 'Всё, что продают'], ['keep', 'Пока на складе меньше N т'], ['month', 'N т в месяц']];
export function refreshTrade() {
  const p = $('p-trade'); if (!p) return;
  const ks = Object.keys(RES).filter((k) => k !== 'spares');
  if (!p._built) {
    p._built = true;
    p.innerHTML = `<div class="box"><h2>Закупки сырья у корпораций</h2><div class="help">Игра сама покупает у самых дешёвых продавцов (шахты корпораций и их корабли-рудокопы) и кладёт на склад Земли. Режим «Пока на складе меньше N т» — докупать только при нехватке на производство. «Не дороже» 0 — без ограничения цены; всё, что вы не берёте, корпорации сбывают на рынке за 30% цены.</div>
    <div data-sc style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr>${['Ресурс', 'Режим', 'N т', 'Не дороже, кр/т', 'Цена', 'На складе', 'Куплено: сейчас / прошлый мес.'].map((x) => `<th style="text-align:left;padding:2px 6px">${x}</th>`).join('')}</tr>
    ${ks.map((k) => { const q = buyPol(k); return `<tr><td style="padding:2px 6px;border-top:1px solid #8883">${RES[k]}</td><td style="padding:2px 6px;border-top:1px solid #8883"><select data-tr="mode" data-k="${k}">${TR_MODES.map(([v, n]) => `<option value="${v}"${q.mode === v ? ' selected' : ''}>${n}</option>`).join('')}</select></td><td style="padding:2px 6px;border-top:1px solid #8883"><input type="number" min="0" data-tr="amt" data-k="${k}" value="${q.amt}" style="width:90px"></td><td style="padding:2px 6px;border-top:1px solid #8883"><input type="number" min="0" data-tr="max" data-k="${k}" value="${q.max}" style="width:80px"></td><td style="padding:2px 6px;border-top:1px solid #8883">${fmtN(PRICE[k] || 0)}</td><td id="tr-s-${k}" style="padding:2px 6px;border-top:1px solid #8883"></td><td id="tr-b-${k}" style="padding:2px 6px;border-top:1px solid #8883"></td></tr>`; }).join('')}</table></div></div>`;
    p.addEventListener('input', (e) => { const t = e.target, k = t.dataset && t.dataset.k; if (!k) return; const q = buyPol(k); if (t.dataset.tr === 'mode') q.mode = t.value; else q[t.dataset.tr] = Math.max(0, +t.value || 0); });
  }
  for (const k of ks) { const a = $('tr-s-' + k), b = $('tr-b-' + k); if (a) a.textContent = fmtN(state.stock[k] || 0); if (b) b.textContent = fmtN(boughtMonth(k)) + ' / ' + fmtN((state.bm && state.bm.last && state.bm.last[k]) || 0); }
}
