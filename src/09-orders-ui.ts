// @ts-nocheck
import { GOODS } from './07-population.ts';
import { econHtml, econOrder } from './32-econbld.ts';
import { techArt } from './17-art.ts';
import { craftFromStats, syncCraftOpts, FGT_MAX, snapNum, veinBase, BODIES, BODY, COMP, FIELDS, RES, SPEEDS, STAT_IN, STAT_OUT, TERRA, baseOf, compOf, crewLabel, designStats, fmtDur, fmtN, groupOf, isSh, isSt, mkKey, myShips, myStations, nameOf, newGame, newGroup, objPos, snapPct, state, stockOK, sumVals, uid } from './01-data.ts';
import { ROLES, SKILLS, freeOfficers, officerById, setCrew, slotsFor, staffFor } from './02-crew.ts';
import { refreshDemo } from './16-demo.ts';
import { RARITY, techById, ensureOffers, reroll } from './15-techs.ts';
import { rentN, buildUnits, buildSlots, HIRE_PRICE, BW, bldWage, bldWorkers, BLD, TECH, academyClass, academyInterval, bldCanAdd, bldCost, bldGate, techOn, techSet, yardSlots, yardSpeed, yards, yardRate, yardUpSB, bldSB, queueBld, unitSB, pctSum, CF_SB } from './03-build.ts';
import { advance, loadGame, saveGame } from './04-engine.ts';
import { Battle } from './05-battle.ts';
import { refreshCorp } from './06-corps.ts';
import { rpPrice, labRP, sciPol } from './10-civil.ts';
import { refreshLaws } from './12-state.ts';
import { refreshPop } from './07-population.ts';
import { hooks } from './00-hooks.ts';
import { refreshCargo } from './13-freight.ts';
import { buildShell, refreshTrade, refreshCol, refreshClimate, refreshComp, refreshWork, syncShell } from './11-shell.ts';
import { setHtml, setTilt } from './08-map-ui.ts';
import { $, bar, baseOpts, bodyOpts, buildHeader, drawMap, esc, focusSel, groupOpts, refreshFleet, refreshHeader, refreshLog, refreshObj, renderObj, resizeMap, selPos, select, stOpts, targetOpts, ui } from './08-map-ui.ts';

/* ===== ПАНЕЛЬ «ПРИКАЗЫ» ===== */
export const ORDER_TYPES = {
  move: 'Лететь к', mine: 'Добывать', home: 'Вернуться на базу: разгрузка, заправка, ремонт', load: 'Погрузить на базе', wait: 'Ждать',
  research: 'Исследовать объект', minebest: 'Добывать лучшее по ископаемому', jump: 'Перейти к приказу (условие)', dump: 'Сбросить груз', joingroup: 'Перейти в группу', stop: 'Остановиться', tow: 'Взять на буксир', terraform: 'Сбросить груз на планету (тераформирование)', redirect: 'Направить комету на планету (тераформирование)', release: 'Отцепить буксир', transfer: 'Передать топливо станции', refuelships: 'Заправить нуждающиеся корабли',
};
export const ORDER_NEEDS = {minebest: 'шахтёр', research: 'учёный', tow: 'тягач', release: 'тягач', transfer: 'танкер', refuelships: 'танкер'};
export function typeAllowed(t, members, prog) {
  const need = ORDER_NEEDS[t];
  if (!need || prog.orders.some(o => o.type === t) || !members.length) return true;
  return members.some(s => need === 'шахтёр' ? s.st.lasers > 0 : need === 'учёный' ? s.st.labsTotal > 0 : need === 'тягач' ? s.st.tow > 0 : s.st.xfer > 0);
}
export function typeOpts(sel, members, prog) {
  return Object.entries(ORDER_TYPES).filter(([k]) => k === sel || typeAllowed(k, members, prog))
    .map(([k, v]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${v}${ORDER_NEEDS[k] ? ' (' + ORDER_NEEDS[k] + ')' : ''}</option>`).join('');
}
export const defOrder = t => ({
  move: {type: 'move', target: 'l1'}, mine: {type: 'mine', target: 'eros', res: 'all', pct: 100},
  home: {type: 'home', base: 'earth'}, load: {type: 'load', base: 'earth', item: 'spares', amount: 100},
  wait: {type: 'wait', hours: 24}, research: {type: 'research', target: 'auto', days: 30},
  minebest: {type: 'minebest', res: 'all', pct: 100}, terraform: {type: 'terraform', target: 'mars'}, redirect: {type: 'redirect', planet: 'mars'}, jump: {type: 'jump', to: 1, cond: 'always', val: 50}, dump: {type: 'dump'}, joingroup: {type: 'joingroup', group: state.groups[0] ? state.groups[0].id : 0}, stop: {type: 'stop'}, tow: {type: 'tow', target: 'broken'}, release: {type: 'release'},
  transfer: {type: 'transfer', target: state.stations[0] ? 'st:' + state.stations[0].id : ''}, refuelships: {type: 'refuelships', pct: 40},
}[t]);
export function towOpts(sel) {
  return `<option value="broken"${sel === 'broken' ? ' selected' : ''}>Ближайший сломанный корабль</option>` +
    (state.stations.length ? `<optgroup label="Станции">${stOpts(sel)}</optgroup>` : '') +
    `<optgroup label="Корабли">${myShips().map(s => `<option value="sh:${s.id}"${'sh:' + s.id === sel ? ' selected' : ''}>${esc(s.name)}</option>`).join('')}</optgroup>`;
}

export function currentHolder() {
  let e = ui.edit;
  if (e && e.kind === 'group' && !state.groups.find(g => g.id === e.id)) e = null;
  if (e && e.kind === 'ship' && !state.ships.find(s => s.id === e.id)) e = null;
  if (!e && state.groups.some(g => !g.corp)) e = {kind: 'group', id: state.groups.find(g => !g.corp).id};
  ui.edit = e;
  if (!e) return null;
  if (e.kind === 'group') { const g = state.groups.find(x => x.id === e.id); return {kind: 'group', g, prog: g}; }
  const s = state.ships.find(x => x.id === e.id);
  return {kind: 'ship', s, prog: s.own, grouped: !!groupOf(s)};
}
export function resetPc(h) {
  const ships = h.kind === 'group' ? state.ships.filter(s => s.groupId === h.g.id) : [h.s];
  for (const s of ships) { s.pc = 0; s.wait = null; s.tmp = null; }
}
export function orderFields(o, i) {
  if (o.type === 'move') return `<select data-c="otarget" data-i="${i}">${targetOpts(o.target)}</select>`;
  if (o.type === 'mine') {
    const b = BODY[o.target], ro = '<option value="all"' + (!o.res || o.res === 'all' ? ' selected' : '') + '>Всё сразу</option>' + Object.keys(b ? b.ores || {} : {}).map(k => `<option value="${k}"${k === o.res ? ' selected' : ''}>${RES[k]}</option>`).join('');
    return `<div class="row"><select data-c="otarget" data-i="${i}">${bodyOpts(o.target, 'ast')}</select><select data-c="ores" data-i="${i}">${ro}</select></div>
      <div class="row">пока трюм заполнен на <input type="number" min="1" max="100" value="${o.pct}" data-c="opct" data-i="${i}"> %</div>`;
  }
  if (o.type === 'research') return `<select data-c="otarget" data-i="${i}"><option value="auto"${o.target === 'auto' ? ' selected' : ''}>Лучший доступный</option>${bodyOpts(o.target, 'sci')}</select><div class="row">не дольше <input type="number" min="1" max="999" value="${o.days}" data-c="odays" data-i="${i}"> сут</div>`;
  if (o.type === 'minebest') return `<div class="row"><select data-c="ores" data-i="${i}"><option value="all"${!o.res || o.res === 'all' ? ' selected' : ''}>Всё сразу</option>${Object.keys(RES).filter(k => k !== 'spares').map(k => `<option value="${k}"${k === o.res ? ' selected' : ''}>${RES[k]}</option>`).join('')}</select></div><div class="row">пока трюм заполнен на <input type="number" min="1" max="100" value="${o.pct}" data-c="opct" data-i="${i}"> %</div><div class="help">Сам выбирает астероид или спутник с самым большим запасом рядом.</div>`;
  if (o.type === 'jump') return `<div class="row">к приказу № <input type="number" min="1" max="99" value="${o.to}" data-c="ojto" data-i="${i}"></div><div class="row"><select data-c="ojcond" data-i="${i}">${[['always', 'всегда'], ['cargo', 'если трюм ≥'], ['fuel', 'если топливо ≤'], ['cond', 'если состояние ≤']].map(([k, v]) => `<option value="${k}"${k === o.cond ? ' selected' : ''}>${v}</option>`).join('')}</select>${o.cond === 'always' ? '' : `<input type="number" min="1" max="100" value="${o.val}" data-c="ojval" data-i="${i}"> %`}</div>`;
  if (o.type === 'terraform') return `<select data-c="otarget" data-i="${i}">${Object.keys(TERRA).map(k => `<option value="${k}"${k === o.target ? ' selected' : ''}>${TERRA[k].name}</option>`).join('')}</select><div class="help">Летит к планете и сбрасывает лёд и газы из трюма. Нужны только те, что требуются для тераформирования.</div>`;
  if (o.type === 'redirect') return `<select data-c="oplanet" data-i="${i}">${Object.keys(TERRA).map(k => `<option value="${k}"${k === o.planet ? ' selected' : ''}>${TERRA[k].name}</option>`).join('')}</select><div class="help">Корабль берёт ближайшую комету и толкает её к планете. Скорость: мощность двигателей × 10 млн т в сутки. Корабль тратит топливо, а при нехватке переходит к следующему приказу (поставьте после него «Вернуться на базу»).</div>`;
  if (o.type === 'dump') return '<div class="help">Выбросить весь груз (чтобы освободить трюм).</div>';
  if (o.type === 'stop') return '<div class="help">Корабль стоит и ждёт, пока вы измените программу.</div>';
  if (o.type === 'joingroup') return `<select data-c="ogroup" data-i="${i}">${groupOpts(o.group, false, false)}</select><div class="help">Корабль переходит в другую группу и выполняет её программу с начала.</div>`;
  if (o.type === 'wait') return `<div class="row"><input type="number" min="1" max="9999" value="${o.hours}" data-c="ohours" data-i="${i}"> часов</div>`;
  if (o.type === 'home') return `<div class="row"><select data-c="obase" data-i="${i}">${baseOpts(o.base)}</select></div>
    <div class="help">Выгрузить груз, заправиться, отремонтироваться. Тягач на базе отцепляет груз.</div>`;
  if (o.type === 'load') return `<div class="row"><select data-c="obase" data-i="${i}">${baseOpts(o.base)}</select></div>
    <div class="row"><select data-c="oitem" data-i="${i}"><option value="spares"${o.item === 'spares' ? ' selected' : ''}>Тех. изделия</option><option value="cargo"${o.item === 'cargo' ? ' selected' : ''}>Руда, лёд, платина со станции</option></select>
    до <input type="number" min="1" max="9999" value="${o.amount}" data-c="oamt" data-i="${i}"> т</div>`;
  if (o.type === 'tow') return `<select data-c="otarget" data-i="${i}">${towOpts(o.target)}</select><div class="help">Лететь к цели и взять её на буксир. Дальше добавьте «Лететь» и «Отцепить» (или «Вернуться на базу»).</div>`;
  if (o.type === 'transfer') return state.stations.length ? `<select data-c="otarget" data-i="${i}">${stOpts(o.target)}</select><div class="help">Передаёт топливо сверх запаса на возвращение.</div>` : '<div class="warn">Станций пока нет.</div>';
  if (o.type === 'refuelships') return `<div class="row">топливо ниже <input type="number" min="1" max="99" value="${o.pct}" data-c="opct" data-i="${i}"> %</div><div class="help">Летит к ближайшему такому кораблю вне баз. Если таких нет, приказ пропускается.</div>`;
  return '<div class="help">Отцепить груз здесь. Если рядом тело или станция, он останется возле них.</div>';
}
export function renderOrders() {
  const p = $('p-orders'), h = currentHolder();
  if (!h) { p.innerHTML = `<div class="box"><div class="help">Групп пока нет.</div><button class="btn" data-a="newgroup">Создать группу</button></div>`; return; }
  const e = ui.edit;
  const sel = `<select id="editSel" data-c="editsel" class="grow"><optgroup label="Группы">` +
    state.groups.filter(g => !g.corp).map(g => `<option value="g${g.id}"${e.kind === 'group' && e.id === g.id ? ' selected' : ''}>${esc(g.name)}</option>`).join('') +
    `</optgroup><optgroup label="Корабли">` +
    myShips().map(s => `<option value="s${s.id}"${e.kind === 'ship' && e.id === s.id ? ' selected' : ''}>${esc(s.name)}${s.groupId ? ' (в группе)' : ''}</option>`).join('') + `</optgroup></select>`;
  let html = `<div class="box"><div class="row">${sel}<button class="btn sm" data-a="newgroup">+ Группа</button></div>`;
  if (h.kind === 'group') html += `<div class="row"><input type="text" class="grow" value="${esc(h.g.name)}" data-c="gname" aria-label="Название группы"><button class="btn sm danger" data-a="delgroup">Удалить</button></div>`;
  html += '</div>';
  if (h.kind === 'ship' && h.grouped) {
    const g = groupOf(h.s);
    p.innerHTML = html + `<div class="box"><div>Корабль следует программе группы «${esc(g.name)}».</div>
      <div class="row"><button class="btn" data-a="togroup" data-id="${g.id}">Открыть группу</button><button class="btn" data-a="unassign" data-id="${h.s.id}">Вывести из группы</button></div></div>`;
    return;
  }
  const prog = h.prog;
  const members = h.kind === 'group' ? state.ships.filter(s => s.groupId === h.g.id) : [h.s];
  const orderHtml = prog.orders.map((o, i) => {
    const run = members.filter(s => !s.interrupt && s.pc === i).length;
    return `<div class="order${run ? ' cur' : ''}"><span class="n">${i + 1}</span>
      <div class="dcol" style="gap:4px"><select data-c="otype" data-i="${i}">${typeOpts(o.type, members, prog)}</select>${orderFields(o, i)}
      ${run ? `<span class="ok">выполняют: ${run}</span>` : ''}</div>
      <div class="row" style="flex-direction:column;gap:3px"><button class="btn sm" data-a="oup" data-i="${i}" ${i ? '' : 'disabled'} aria-label="Выше">↑</button><button class="btn sm" data-a="odown" data-i="${i}" ${i < prog.orders.length - 1 ? '' : 'disabled'} aria-label="Ниже">↓</button><button class="btn sm danger" data-a="odel" data-i="${i}" aria-label="Удалить">✕</button></div></div>`;
  }).join('') || '<div class="help">Приказов нет. Добавьте приказ или примените шаблон.</div>';
  const hasUnlock = state.designs.some(d => Object.entries(d.parts).some(([k, n]) => n && (baseOf(k) === 'xfer' || baseOf(k) === 'hook')));
  html += `<div class="box"><h2>Программа</h2>
    <label class="row"><input type="checkbox" data-c="loop" ${prog.loop ? 'checked' : ''}> Повторять по кругу</label>${orderHtml}
    <div class="row"><select id="newType">${typeOpts('', members, prog)}</select><button class="btn" data-a="oadd">Добавить приказ</button></div>
    ${members.length && hasUnlock ? '<div class="help">Приказы тягача и танкера видны, когда в группе есть такой корабль.</div>' : ''}
    <div class="row"><select id="presetAst">${bodyOpts('eros', 'ast')}</select><button class="btn" data-a="preset">Шаблон автодобычи</button></div>
    <div class="help">Шаблон: добывать до полного трюма, вернуться на ближайшую станцию или Землю, разгрузиться, повторять. Заменяет программу.</div></div>`;
  const ruleHtml = prog.rules.map((r, i) => {
    const label = {cargo: 'Трюм заполнен на ≥', fuel: 'Топливо ≤', fuelhome: 'Топлива до Земли меньше, чем', cond: 'Состояние корабля ≤'}[r.cond];
    const unit = r.cond === 'fuelhome' ? '% от нужного' : '%';
    return `<div class="order"><span class="n">${i + 1}</span><div class="dcol" style="gap:4px">
      <select data-c="rcond" data-i="${i}">${[['cargo', 'Трюм заполнен'], ['fuel', 'Мало топлива'], ['fuelhome', 'Топлива в обрез до Земли'], ['cond', 'Сильный износ']].map(([k, v]) => `<option value="${k}"${k === r.cond ? ' selected' : ''}>${v}</option>`).join('')}</select>
      <div class="row">${label} <input type="number" min="1" max="500" value="${r.val}" data-c="rval" data-i="${i}"> ${unit}</div>
      <div class="row">лететь на: <select data-c="rbase" data-i="${i}">${baseOpts(r.base || 'earth')}</select></div></div>
      <button class="btn sm danger" data-a="rdel" data-i="${i}" aria-label="Удалить правило">✕</button></div>`;
  }).join('') || '<div class="help">Правил нет.</div>';
  html += `<div class="box"><h2>Правила</h2><div class="help">Срабатывают в любой момент: корабль бросает приказ, летит на базу, разгружается, заправляется, ремонтируется и продолжает программу.</div>${ruleHtml}
    <div class="row"><button class="btn" data-a="radd">Добавить правило</button></div></div>`;
  if (h.kind === 'group') {
    const free = myShips().filter(s => !s.groupId);
    html += `<div class="box"><h2>Корабли группы (${members.length})</h2>` +
      (members.map(s => `<div class="row"><span class="grow"><span class="dot" style="background:${h.g.color}"></span>${esc(s.name)}</span><button class="btn sm" data-a="unassign" data-id="${s.id}">Убрать</button></div>`).join('') || '<div class="help">Пока пусто. Корабли с верфи можно сразу ставить в группу.</div>') +
      (free.length ? `<div class="row"><select id="addShip">${free.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select><button class="btn" data-a="assign">Добавить</button></div>` : '') + '</div>';
  }
  p.innerHTML = html;
}
export function ordersClick(a, d) {
  const h = currentHolder();
  if (a === 'newgroup') { const g = newGroup(); ui.edit = {kind: 'group', id: g.id}; }
  else if (a === 'togroup') ui.edit = {kind: 'group', id: +d.id};
  else if (a === 'unassign') { const s = state.ships.find(x => x.id === +d.id); if (s) { s.groupId = null; s.pc = 0; s.interrupt = null; s.tmp = null; } }
  else if (a === 'assign') { const s = state.ships.find(x => x.id === +$('addShip').value); if (s && h.g) { s.groupId = h.g.id; s.pc = 0; s.wait = null; s.tmp = null; } }
  else if (a === 'delgroup' && h && h.g) {
    state.ships.forEach(s => { if (s.groupId === h.g.id) { s.groupId = null; s.pc = 0; s.tmp = null; } });
    state.groups = state.groups.filter(g => g !== h.g); ui.edit = null;
  } else if (h && h.prog && !h.grouped) {
    const pr = h.prog, i = +d.i;
    if (a === 'oadd') { pr.orders.push(defOrder($('newType').value)); resetPc(h); }
    else if (a === 'odel') { pr.orders.splice(i, 1); resetPc(h); }
    else if (a === 'oup' && i > 0) { [pr.orders[i - 1], pr.orders[i]] = [pr.orders[i], pr.orders[i - 1]]; resetPc(h); }
    else if (a === 'odown' && i < pr.orders.length - 1) { [pr.orders[i + 1], pr.orders[i]] = [pr.orders[i], pr.orders[i + 1]]; resetPc(h); }
    else if (a === 'radd') pr.rules.push({cond: 'cargo', val: 100, base: 'earth'});
    else if (a === 'rdel') pr.rules.splice(i, 1);
    else if (a === 'preset') {
      const t = $('presetAst').value, ores = BODY[t].ores;
      pr.orders = [{type: 'mine', target: t, res: Object.keys(ores)[0], pct: 100}, {type: 'home', base: 'nearest'}];
      pr.loop = true; pr.rules = [{cond: 'fuelhome', val: 130, base: 'nearest'}, {cond: 'cond', val: 25, base: 'nearest'}]; resetPc(h);
    }
  }
  renderOrders();
}
export function ordersChange(c, el) {
  const h = currentHolder(), i = +el.dataset.i, v = el.value;
  if (c === 'editsel') { ui.edit = {kind: v[0] === 'g' ? 'group' : 'ship', id: +v.slice(1)}; return renderOrders(); }
  if (!h) return;
  if (c === 'gname') { if (h.g) h.g.name = v.trim() || h.g.name; return renderOrders(); }
  const pr = h.prog; if (!pr) return;
  const o = pr.orders[i], r = pr.rules[i];
  if (c === 'loop') pr.loop = el.checked;
  else if (c === 'otype') { pr.orders[i] = defOrder(v); resetPc(h); }
  else if (c === 'otarget') { o.target = v; if (o.type === 'mine') o.res = 'all'; resetPc(h); }
  else if (c === 'ores') o.res = v;
  else if (c === 'oplanet') o.planet = v;
  else if (c === 'obase') { o.base = v; resetPc(h); }
  else if (c === 'oitem') o.item = v;
  else if (c === 'oamt') o.amount = Math.max(1, +v || 100);
  else if (c === 'opct') o.pct = Math.min(100, Math.max(1, +v || 100));
  else if (c === 'ojto') o.to = Math.max(1, +v || 1);
  else if (c === 'ojcond') o.cond = v;
  else if (c === 'ojval') o.val = Math.min(100, Math.max(1, +v || 50));
  else if (c === 'ogroup') o.group = +v;
  else if (c === 'odays') o.days = Math.max(1, +v || 30);
  else if (c === 'ohours') o.hours = Math.max(1, +v || 1);
  else if (c === 'rcond') { r.cond = v; r.val = {cargo: 100, fuel: 25, fuelhome: 130, cond: 25}[v]; }
  else if (c === 'rval') r.val = Math.max(1, +v || 1);
  else if (c === 'rbase') r.base = v;
  renderOrders();
}

/* ===== ПАНЕЛЬ «ВЕРФЬ» ===== */
ui.y = {design: null, count: 1, group: null};
export function costTxt(c) { return Object.entries(c).map(([k, v]) => `${RES[k].toLowerCase()} ${fmtN(v)}`).join(', '); }
export const yDesign = () => state.designs.find(x => x.id === ui.y.design);
export const isStationDesign = () => { const d = yDesign(); return !!(d && designStats(d.parts).station); };
export const designTag = d => { const s = designStats(d.parts), t = [s.station ? 'станция' : '', s.parts_hook ? '' : '', s.tow ? 'тягач' : '', s.tanker ? 'танкер' : '', s.lasers ? 'шахтёр' : '', d.craft ? 'истребитель' : s.warship ? 'боевой' : '', s.labsTotal ? 'учёный' : '', !s.station && s.cargoCap && !s.lasers ? 'грузовой' : ''].filter(Boolean); return t.length ? ' [' + t.join(', ') + ']' : ''; };
export const dStats = d => designStats(d.parts, d.craft ? {craft: true} : undefined);
export function renderYard() {
  const y = ui.y, p = $('p-yard');
  if (!state.designs.find(d => d.id === y.design)) y.design = state.designs[0] ? state.designs[0].id : null;
  if (y.group === null) y.group = '';
  p.innerHTML = `<div class="box"><h2>Заказ кораблей</h2>
    <div class="row"><select id="yDesign" data-c="ydesign" class="grow">${state.designs.map(d => `<option value="${d.id}"${d.id === y.design ? ' selected' : ''}>${esc(d.name)}${designTag(d)}</option>`).join('')}</select>
    <button class="btn sm" data-a="opendesigner">Конструктор</button></div>
    <div id="yInfo"></div>
    <div class="row">Количество <input type="number" id="yCount" data-c="ycount" min="1" max="20" value="${y.count}"></div>
    ${isStationDesign() ? '<div class="help">Станция появится на Земле. Отвезти её на место нужно тягачом.</div>' : `<div class="row">Сразу в группу <select id="yGroup" data-c="ygroup">${groupOpts(+y.group, true, true)}</select></div>`}
    <button class="btn on" data-a="enqueue">Поставить в очередь</button>
    <div class="help">Новый корабль появится на Земле, заправится и сразу начнёт выполнять программу группы.</div></div>
    <div class="box"><h2>Очередь (3 стапеля)</h2><div id="yq"></div></div>`;
  const sel = $('yGroup'); if (sel) sel.value = y.group;
  refreshYardInfo(); refreshYq();
}
export function refreshYardInfo() {
  const d = state.designs.find(x => x.id === ui.y.design), el = $('yInfo'); if (!el) return;
  if (!d) { el.innerHTML = '<div class="help">Нет проектов. Откройте конструктор.</div>'; return; }
  const st = dStats(d);
  el.innerHTML = `<div class="stats"><span>Стоимость</span><span>${costTxt(st.cost)}</span><span>Время постройки</span><span>${st.buildDays} сут</span>
    <span>Скорость</span><span>${mps(st.speedFull)}</span><span>Дальность</span><span>${fmtN(st.range * 0.1496, 2)} млрд км</span></div>` +
    (stockOK(st.cost) ? '' : `<div class="warn">Не хватает на складе: ${lackTxt(st.cost)}</div>`) +
    st.errors.map(e => `<div class="err">${e}</div>`).join('') + st.warns.map(e => `<div class="warn">${e}</div>`).join('');
}
export function refreshYq() {
  const el = $('yq'); if (!el) return;
  el.innerHTML = state.yard.length ? state.yard.map(j => {
    const g = state.groups.find(x => x.id === j.groupId);
    const Y = yards(), y = Y[j.yi], rt = y ? yardRate(y) : 0, st = j.started ? (j.wait ? `<span class="warn grow">${j.wait}</span>` : `${bar(1 - j.left / j.total)}<span class="mono">${fmtN(j.total - j.left)} / ${fmtN(j.total)} т · верфь №${j.yi + 1} · ${rt > 0 ? fmtDur(j.left / rt) : '—'}</span>`)
      : `<span class="warn grow">${j.why === 'не хватает материалов' || !j.why ? (stockOK(designStats(j.parts).cost) ? (j.why || 'ждёт верфь') : 'не хватает: ' + lackTxt(designStats(j.parts).cost)) : j.why}</span><button class="btn sm danger" data-a="ycancel" data-id="${j.id}">Отмена</button>`;
    return `<div class="row"><span style="min-width:110px">${esc(j.name)}${j.station ? ' (станция)' : ''}${g ? ' → ' + esc(g.name) : ''}</span>${st}</div>`;
  }).join('') : '<div class="help">Очередь пуста.</div>';
}
export function yardClick(a, d) {
  if (a === 'enqueue') {
    const des = state.designs.find(x => x.id === ui.y.design); if (!des) return;
    const st = dStats(des);
    if (st.errors.length) { refreshYardInfo(); return; }
    let gid = null;
    if (!st.station) {
      gid = ui.y.group === 'new' ? newGroup('Группа ' + des.name).id : (+ui.y.group || null);
      if (ui.y.group === 'new') ui.y.group = String(gid);
    }
    for (let i = 0; i < ui.y.count; i++) state.yard.push({id: uid(), name: des.name, parts: {...des.parts}, station: st.station, prio: {...des.prio}, groupId: gid, started: false, left: st.buildDays, total: st.buildDays});
    renderYard();
  } else if (a === 'ycancel') { state.yard = state.yard.filter(j => j.id !== +d.id); refreshYq(); }
}
export function yardChange(c, el) {
  if (c === 'ydesign') { ui.y.design = +el.value; refreshYardInfo(); }
  else if (c === 'ycount') ui.y.count = Math.min(20, Math.max(1, +el.value || 1));
  else if (c === 'ygroup') ui.y.group = el.value;
}

/* ===== КОНСТРУКТОР ===== */
export function curDesign() { return state.designs.find(d => d.id === ui.dsel); }
const burnTxt = m => fmtN(Math.round(m)) + ' мин' + (m > 2880 ? ' (≈ ' + fmtN(m / 1440, 1) + ' сут)' : m > 180 ? ' (≈ ' + fmtN(m / 60, 1) + ' ч)' : '');
const mps = v => fmtN(Math.round(v * 1.7314e6)) + ' м/с'; // 1 а.е./сут = 1,731·10⁶ м/с
export function openDesigner() {
  if (!curDesign()) ui.dsel = state.designs[0] ? state.designs[0].id : null;
  if (!curDesign()) { const d = {id: uid(), name: 'Новый проект', parts: {}, prio: {cmd: 0, eng: 0, pil: 0, min: 0}}; state.designs.push(d); ui.dsel = d.id; }
  $('designer').hidden = false; renderDesigner(true);
}
export function closeDesigner() { pv3d(false); $('designer').hidden = true; if (ui.tab === 'yard') renderYard(); }
let pvT: any = 0;
function pv3d(on, refresh?) {
  const h = $('dpv'); if (!h) return;
  if (on === false) { clearTimeout(pvT); h.hidden = true; ui.dpv = false; hooks.preview3dOff && hooks.preview3dOff(); const b = $('dpvb'); if (b) b.classList.remove('on'); return; }
  if (on === true) { ui.dpv = true; h.hidden = false; const b = $('dpvb'); if (b) b.classList.add('on'); }
  const d = curDesign(); if (!ui.dpv || !d) return;
  clearTimeout(pvT); pvT = setTimeout(() => { if (ui.dpv && hooks.preview3d) hooks.preview3d(d.parts, h, d.craft ? (st => st.dry > 0 ? { ...craftFromStats(st), mk: 'pv' } : null)(designStats(d.parts, { craft: true })) : null); }, refresh ? 120 : 30);
}
export function renderDesigner(full) {
  const d = curDesign(); if (!d) return;
  if (ui.dpv) pv3d(null, true);
  syncCraftOpts();
  $('dlist').innerHTML = state.designs.map(x => `<div class="item${x.id === d.id ? ' sel' : ''}" data-d="${x.id}">${esc(x.name)}<span class="muted">${designTag(x)}</span></div>`).join('');
  if (full) $('dname').value = d.name;
  $('dflags').innerHTML = prioHtml(d) + `<label class="row"><input type="checkbox" data-craft="1" ${d.craft ? 'checked' : ''}> Истребитель <span class="muted">(собирается как корабль, но до ${FGT_MAX} т; потом выбирается в «Ангаре истребителей»)</span></label>`; if (0) `<label><input type="checkbox" data-flag="station" ${d.station ? 'checked' : ''}> Станция <span class="muted">(не летает сама, принимает грузы, везёт тягач)</span></label>
    <label><input type="checkbox" data-flag="tanker" ${d.tanker ? 'checked' : ''}> Танкер <span class="muted">(передаёт топливо станциям и кораблям)</span></label>`;
  const ctl = (k, n) => `<span class="ct">${[-25, -5, -1].map(v => `<button class="btn sm" data-dp="${k}" data-dd="${v}" aria-label="Меньше">${v < -1 ? '−' + -v : '−'}</button>`).join('')}<b>${n}</b>${[1, 5, 25].map(v => `<button class="btn sm" data-dp="${k}" data-dd="${v}" aria-label="Больше">${v > 1 ? '+' + v : '+'}</button>`).join('')}</span>`;
  const used = b => Object.keys(d.parts).filter(k => d.parts[k] > 0 && baseOf(k) === b);
  const tab = ui.dtab || 'build';
  const tabs = `<div class="dtabs"><button class="btn sm${tab === 'build' ? ' on' : ''}" data-dtab="build">Сборка</button><button class="btn sm${tab === 'ship' ? ' on' : ''}" data-dtab="ship">На корабле (${Object.values(d.parts).reduce((a, n) => a + n, 0)})</button></div>`;
  if (tab === 'ship') {
    const rows = Object.keys(d.parts).filter(k => d.parts[k] > 0 && compOf(k)).sort();
    $('dcomps').innerHTML = tabs + (rows.length ? rows.map(k => { const q = compOf(k), n = d.parts[k]; return `<div class="comp"><span class="nm">${q.name}</span><span class="ds">${q.desc}</span><span class="ds">${crewLabel(q, n)} · ${q.armW ? 'масса по длине корабля' : q.mass + ' т × ' + n + ' = ' + fmtN(q.mass * n, 1) + ' т'} · ${costTxt(Object.fromEntries(Object.entries(q.cost).map(([r, v]) => [r, v * n])))}</span>${ctl(k, n)}</div>`; }).join('') : '<div class="help">Пока ничего не установлено. Перейдите на вкладку «Сборка».</div>');
  } else {
  const CAT = {ion: 'Двигатели', chem: 'Двигатели', fusion: 'Двигатели', reactor: 'Энергия', tank: 'Топливо и грузы', cargo: 'Топливо и грузы', xfer: 'Топливо и грузы', rail: 'Оружие', gat: 'Оружие', flak: 'Оружие', lgun: 'Оружие', missile: 'Оружие', ammo: 'Оружие', armor: 'Защита', dcon: 'Защита', sink: 'Защита', irs: 'Сенсоры и РЭБ', ems: 'Сенсоры и РЭБ', radar: 'Сенсоры и РЭБ', fcs: 'Сенсоры и РЭБ', ew: 'Сенсоры и РЭБ', cabin: 'Экипаж', life: 'Экипаж', marines: 'Экипаж', hangar_f: 'Авиация', hangar_b: 'Авиация'}, CATS = ['Двигатели', 'Энергия', 'Топливо и грузы', 'Оружие', 'Защита', 'Сенсоры и РЭБ', 'Экипаж', 'Авиация', 'Прочее'], hid = ui.dcatc || (ui.dcatc = {});
  const rowsC = {};
  Object.entries(COMP).filter(([b, c]) => !c.off && (!c.tech || techOn(c.tech) || used(b).length)).forEach(([b, c]) => { (rowsC[CAT[b] || 'Прочее'] = rowsC[CAT[b] || 'Прочее'] || []).push([b, c]) });
  $('dcomps').innerHTML = tabs + CATS.filter(n => rowsC[n]).map(n => { const cnt = rowsC[n].reduce((a, [b]) => a + used(b).reduce((x, k) => x + d.parts[k], 0), 0); return `<button class="dcat" data-cat="${n}">${hid[n] ? '▸' : '▾'} ${n}${cnt ? ' · ' + cnt : ''}</button>` + (hid[n] ? '' : rowsC[n].map(([b, c]) => {
    if (!c.opts) return `<div class="comp"><span class="nm">${c.name}</span><span class="ds">${c.desc} · ${c.armW ? 'масса по длине корабля' : c.mass + ' т'} · ${costTxt(c.cost)} · ${crewLabel(c)}</span>${ctl(b, d.parts[b] || 0)}</div>`;
    const cur = ui.dopt[b] || {}, key = mkKey(b, cur), cc = compOf(key);
    const sels = c.opts.map(p => p.num ? `<label>${p.name}<input type="number" min="${p.num.min}" max="${p.num.max}" step="0.01" value="${snapNum(cur[p.id] || p.def, p.num.min, p.num.max, +p.def)}" data-op="${b}" data-oi="${p.id}"></label>` : p.range ? (v => `<label>${p.name}: <b>${v}%</b><span class="rg"><input type="range" min="0" max="500" step="5" value="${v}" data-op="${b}" data-oi="${p.id}"><input type="number" min="0" max="500" step="5" value="${v}" data-op="${b}" data-oi="${p.id}"></span></label>`)(snapPct(cur[p.id] || p.def)) : `<label>${p.name}<select data-op="${b}" data-oi="${p.id}">${p.vals.map(v => `<option value="${v.v}"${v.v === (cur[p.id] || p.def) ? ' selected' : ''}>${v.l}</option>`).join('')}</select></label>`).join('');
    const others = used(b).filter(k => k !== key).map(k => { const q = compOf(k); return `<div class="vr"><span>${q.name} <span class="muted">${q.desc} · ${q.armW ? 'масса по длине' : q.mass + ' т'}</span></span>${ctl(k, d.parts[k])}</div>`; }).join('');
    return `<div class="comp cfg"><span class="nm">${cc.name}</span><div class="opts">${sels}</div><span class="ds">${cc.desc} · ${cc.armW ? 'масса по длине корабля' : cc.mass + ' т'} · ${costTxt(cc.cost)} · ${crewLabel(cc)}</span>${ctl(key, d.parts[key] || 0)}${used(b).length ? `<span class="ds">Всего этого типа на корабле: ${used(b).reduce((a, k) => a + d.parts[k], 0)}</span>` : ''}</div>`;
  }).join('')) }).join(''); }
  const s = dStats(d), aff = stockOK(s.cost);
  $('dstats').innerHTML = `<div class="stats">
    <span>Водоизмещение (без топлива)</span><span>${fmtN(s.dry)} т</span>${s.warship ? `<span>Длина (50 т на метр)</span><span>${fmtN(s.L * 1000)} м${s.armT ? ' · броня ' + fmtN(s.armT) + ' т' : ''}</span>` : ''}<span>Мощность двигателей</span><span>${fmtN(s.power)}${s.engFactor < 1 ? ' <span class="warn">из ' + fmtN(s.powerNom) + ' (тяга ' + Math.round(s.engFactor * 100) + '%: мало энергии реакторов)</span>' : ''}</span>
    <span>КПД двигателей</span><span>${fmtN(s.eff, 2)}</span><span>Скорость (полный бак)</span><span>${mps(s.speedFull)}</span>
    <span>Дальность на баке</span><span>${fmtN(s.range * 0.1496, 2)} млрд км</span><span>Работа на полной тяге (весь бак)</span><span>${s.fuelRate > 0 && s.fuelCap ? burnTxt(s.fuelCap / s.fuelRate / 60) : '—'}</span><span>Расход на полной тяге</span><span>${fmtN((s.fuelRate || 0) * 86400, 2)} т/сут</span><span>Топливо на 1 а.е.</span><span>${s.speedFull ? fmtN((s.fuelRate || 0) * 86400 / s.speedFull, 1) : '—'} т</span><span>Топливо</span><span>${fmtN(s.fuelCap)} т</span>
    <span>Груз</span><span>${fmtN(s.cargoCap)} т</span><span>Добыча</span><span>${fmtN(s.mine)} т/сут</span>
    <span>Экипаж: нужно / мест</span><span>${s.crewNeed} / ${s.crewCap}</span><span>Жизнеобеспечение</span><span>на ${s.lifeCap}</span>
    ${s.tow ? `<span>Буксир</span><span>до ${fmtN(s.tow)} т</span>` : ''}${s.xfer ? '<span>Передача топлива</span><span>есть</span>' : ''}${s.repair ? '<span>Ремонтный док</span><span>есть</span>' : ''}${s.spareCap ? `<span>Склад тех. изделий</span><span>${fmtN(s.spareCap)}</span>` : ''}
    ${s.warship ? `<span>Броня</span><span>${s.armor} слоёв</span><span>Рельсотроны / зенитки</span><span>${s.rail} / ${s.flak}</span>${(s.scList && s.scList.length) || s.fcsN ? `<span>Сканеры (тепл. / ЭМ / радар) · каналов СУО</span><span>${s.scList.filter(q=>q.k==='ir').length} / ${s.scList.filter(q=>q.k==='em').length} / ${s.scList.filter(q=>q.k==='rad').length} · ${s.fcsN||0}</span>` : ''}${s.ew || s.mar || s.dcon || s.sink ? `<span>РЭБ / десант / аварийн. / радиат.</span><span>${s.ew||0} / ${s.mar||0} / ${s.dcon||0} / ${s.sink||0}</span>` : ''}${s.lgun || s.msl ? `<span>Лазеры / ракетные установки</span><span>${s.lgun} / ${s.msl}</span>` : ''}${s.rail ? `<span>Огневая мощь рельсов</span><span>${fmtN(s.fire, 2)} ур./мин · осечка ${(s.jam * 100).toFixed(1)}%</span>` : ''}${s.defl ? `<span>Отражение</span><span>${Math.round(s.defl * 100)}%</span>` : ''}<span>Манёвренность в бою</span><span>×${fmtN(s.bspd, 2)}</span><span>Истребители / бомбардировщики</span><span>${s.hangF} / ${s.hangB}</span><span>Длина корабля</span><span>${Math.round(s.L * 1000)} м</span>` : ''}
    <span>Стоимость</span><span class="${aff ? '' : 'warn'}">${costTxt(s.cost) || '—'}${aff ? '' : '<br>не хватает: ' + lackTxt(s.cost)}</span><span>Постройка</span><span>${s.buildDays} сут</span></div>` +
    (s.errors.length ? s.errors.map(e => `<div class="err">${e}</div>`).join('') : '<div class="ok">Проект готов к постройке.</div>') +
    s.warns.map(e => `<div class="warn">${e}</div>`).join('') +
    (s.errors.length ? '' : `<button class="btn on" id="dbuild">Строить на верфи</button>`);
  const b = $('dbuild'); if (b) b.onclick = () => { ui.y.design = d.id; closeDesigner(); showTab('yard'); };
}
(function designerEvents() {
  $('dlist').addEventListener('click', e => { const it = e.target.closest('[data-d]'); if (it) { ui.dsel = +it.dataset.d; renderDesigner(true); } });
  $('dcomps').addEventListener('click', e => {
    const tb = e.target.closest('[data-dtab]'); if (tb) { ui.dtab = tb.dataset.dtab; renderDesigner(false); return; }
    const ct = e.target.closest('[data-cat]'); if (ct) { const h = ui.dcatc || (ui.dcatc = {}); h[ct.dataset.cat] = !h[ct.dataset.cat]; renderDesigner(false); return; }
    const b = e.target.closest('[data-dp]'); if (!b) return;
    const d = curDesign(), k = b.dataset.dp;
    d.parts[k] = Math.min(999, Math.max(0, (d.parts[k] || 0) + +b.dataset.dd)); if (!d.parts[k]) delete d.parts[k];
    renderDesigner(false);
  });
  $('dcomps').addEventListener('change', e => {
    const s = e.target.closest('[data-op]'); if (!s) return;
    (ui.dopt[s.dataset.op] = ui.dopt[s.dataset.op] || {})[s.dataset.oi] = s.value; renderDesigner(false);
  });
  $('dflags').addEventListener('change', e => {
    if (e.target.dataset.craft) { curDesign().craft = e.target.checked; renderDesigner(false); return; }
    const r = e.target.dataset.prio; if (!r) return;
    curDesign().prio[r] = +e.target.value; renderDesigner(false);
  });
  $('dname').addEventListener('input', e => { const d = curDesign(); d.name = e.target.value || 'Без названия'; renderDesigner(false); });
  $('dnew').onclick = () => { const d = {id: uid(), name: 'Проект ' + (state.designs.length + 1), parts: {}, prio: {cmd: 0, eng: 0, pil: 0, min: 0}}; state.designs.push(d); ui.dsel = d.id; renderDesigner(true); };
  $('dcopy').onclick = () => { const o = curDesign(), d = {id: uid(), name: o.name + ' (копия)', parts: {...o.parts}, prio: {...o.prio}}; state.designs.push(d); ui.dsel = d.id; renderDesigner(true); };
  $('ddel').onclick = () => {
    if (state.designs.length <= 1) return;
    state.designs = state.designs.filter(d => d.id !== ui.dsel); ui.dsel = state.designs[0].id; renderDesigner(true);
  };
  $('dclose').onclick = closeDesigner;
  $('dpvb').onclick = () => pv3d(!ui.dpv);
  $('designer').addEventListener('pointerdown', e => { if (e.target === $('designer')) closeDesigner(); });
})();


/* ===== ПАНЕЛЬ «ЗЕМЛЯ» ===== */
export function refreshEarth() {
  { const ae = document.activeElement, pe = $('p-earth'); if (ae && ae.tagName === 'INPUT' && pe && pe.contains && pe.contains(ae)) return; } // не мешать вводу
  const S = state.stock, B = state.bld; for (const t in BLD) if (B[t] == null) B[t] = 0;
  const vw = queueHtml() + `<div class="row"><button class="btn sm${ui.bview === 'econ' ? '' : ' on'}" data-a="bview" data-v="">Здания и склад</button><button class="btn sm${ui.bview === 'econ' ? ' on' : ''}" data-a="bview" data-v="econ">Экономические постройки</button></div>`;
  if (ui.bview === 'econ') { $('p-earth').innerHTML = vw + econHtml(); const n = $('ec-n'); if (n) n.onchange = () => { state.ecN = Math.max(1, +n.value || 1); }; return; }
  const keys = Object.keys(RES).filter(k => k !== 'spares').concat(['fuel', 'spares']);
  const name = k => k === 'fuel' ? 'Топливо' : RES[k];
  let h = vw + `<div class="box"><h2>Склад Земли</h2><button class="btn sm" data-a="openstats">Ресурсы: приток и расход</button><div class="res">${keys.map(k => `<span>${name(k)}</span><span>${fmtN(S[k] || 0)}</span>`).join('')}</div>
    <div class="help">Безлимитный склад. Лёд превращается в топливо на топливных заводах.</div></div>`;
  h += '<div class="box"><h2>Здания</h2><table class="grid"><tr><th>Здание</th><th>Есть</th><th>СБ</th><th>Описание (наведите — целиком)</th><th></th></tr>' + Object.entries(BLD).map(([t, b]) => {
    const have = b.level ? `ур. ${B[t] || 0}/${b.max}` : `${B[t] || 0}${b.max ? '/' + b.max : ''}`, can = bldCanAdd(t), gate = bldGate(t), full = `${b.desc} Нанимает ${fmtN(BW[t])} чел. Одной бригадой ${fmtN(bldSB(t))} сут.${gate ? ' ' + gate : ''}`;
    return `<tr><td><b>${b.name}</b></td><td class="n">${have}</td><td class="n">${fmtN(bldSB(t))}</td><td class="ds" title="${esc(full)}">${gate ? `<span class="warn">${esc(gate)}</span> · ` : ''}${esc(b.desc)}</td><td><button class="btn sm" data-a="bbuild" data-t="${t}" ${can ? '' : 'disabled'}>В очередь</button></td></tr>`;
  }).join('') + '</table></div>';
  h += `<div class="box"><div class="stats"><span>Сотрудников построек</span><span>${fmtN(bldWorkers())}</span><span>Зарплаты построек</span><span>${fmtN(bldWage())} кр/сут</span></div></div>`;
  h += `<div class="box"><h2>Верфи</h2>${yards().map((y, i) => `<div class="row"><span class="grow">Верфь №${i + 1}: до ${fmtN(y.ton)} т · бригад ${y.crews} (${fmtN(yardRate(y), 1)} т/сут)</span><button class="btn sm" data-a="yton" data-i="${i}">+1 000 т · ${fmtN(yardUpSB(y, 'ton'))} СБ</button><button class="btn sm" data-a="ycrew" data-i="${i}">+1 бригада · ${fmtN(yardUpSB(y, 'crew'))} СБ</button></div>`).join('')}<div class="help">Корабль строится на одной верфи, если влезает в её тоннаж: каждая бригада (10 000 чел.) делает 1 т корабля в сутки. Расширение — работа строительных бригад, каждое следующее дороже в 1,5 раза.</div></div><div class="box"><div class="stats"><span>Выпуск офицеров</span><span>${academyClass()} чел. раз в ${fmtN(academyInterval(), 0)} сут</span></div></div>`;
  $('p-earth').innerHTML = h;
}
// Очередь стройки: доля мощности у каждого проекта, количество; общие поля «сколько» и «доля» для новых проектов
const qN = () => { const v = Math.max(1, Math.floor(+(($('bq-n') || {}).value) || state.bqN || 1)); state.bqN = v; return v; };
const qP = () => { const v = Math.max(0, Math.min(100, +(($('bq-p') || {}).value) || state.bqP || 10)); state.bqP = v; return v; };
export function qName(q) { return q.type === 'yardton' ? `Верфь №${q.yi + 1}: +1 000 т` : q.type === 'yardcrew' ? `Верфь №${q.yi + 1}: +1 бригада` : q.type === 'efac' ? `Госзавод: ${GOODS[q.g] ? GOODS[q.g].n : q.g}` : q.type === 'emine' ? 'Госшахта' : q.type === 'elab' ? 'Лаборатория' : BLD[q.type].name; }
function queueHtml() {
  const cap = buildUnits(), ps = pctSum();
  const rows = state.build.map(q => { const c = unitSB(q), r = q.rate || cap * (q.pct || 0) / Math.max(100, ps), d1 = r > 0 ? (c - q.prog) / r : Infinity, dall = r > 0 ? ((q.n - 1) * c + c - q.prog) / r : Infinity;
    return `<tr><td>${esc(qName(q))}</td><td class="n">${fmtN(q.n)}</td><td><input type="number" min="0" max="100" value="${fmtN(q.pct || 0, 0)}" data-qp="${q.id}" style="width:48px">%</td><td class="n">${fmtN(r, 1)}</td><td>${bar(q.prog / c)}</td><td class="n">${fmtN(q.prog, 0)} / ${fmtN(c)}</td><td class="n">${isFinite(d1) ? fmtN(d1, 0) + ' сут' : 'стоит'}</td><td class="n">${isFinite(dall) ? fmtDur(dall) : '—'}</td><td><button class="btn sm" data-a="bcancel" data-id="${q.id}">✕</button></td></tr>`; }).join('');
  return `<div class="box"><div class="row"><h2 class="grow">Очередь стройки · мощность ${fmtN(cap, 0)} СБ/сут (строительных заводов ${state.bld.cfactory || 0} × ${CF_SB} + бригад ${buildSlots()}) · распределено ${fmtN(ps, 0)}%${ps < 100 ? ` <span class="warn">(${fmtN(100 - ps, 0)}% простаивает)</span>` : ps > 100 ? ' <span class="warn">(больше 100% — доли урезаны)</span>' : ''}</h2>
    Новый проект: <input type="number" id="bq-n" min="1" value="${state.bqN || 1}" style="width:60px"> шт., доля <input type="number" id="bq-p" min="0" max="100" value="${state.bqP || 10}" style="width:48px">%</div>
    ${rows ? `<table class="grid"><tr><th>Проект</th><th>Осталось</th><th>Доля мощности</th><th>СБ/сут</th><th></th><th>Текущая, СБ</th><th>След. через</th><th>Вся партия</th><th></th></tr>${rows}</table>` : '<div class="help">Очередь пуста: мощность простаивает. Выберите здание или экономическую постройку, задайте количество и долю мощности.</div>'}</div>`;
}
export const lackTxt = c => Object.entries(c).filter(([k, v]) => (state.stock[k] || 0) < v).map(([k, v]) => `${RES[k].toLowerCase()} ${fmtN(v - (state.stock[k] || 0))}`).join(', ');
export function earthClick(a, d) {
  if (a === 'openstats') return openStats();
  if (a === 'bview') { ui.bview = d.v; return refreshEarth(); }
  if (a === 'econ') { queueBld({fac: 'efac', mine: 'emine', lab: 'elab'}[d.k], undefined, qN(), qP(), d.g || undefined); return refreshEarth(); }
  if (a === 'bbuild' && bldCanAdd(d.t)) queueBld(d.t, undefined, qN(), qP());
  if ((a === 'yton' || a === 'ycrew') && !state.build.some(q => q.yi === +d.i && q.type === (a === 'yton' ? 'yardton' : 'yardcrew'))) queueBld(a === 'yton' ? 'yardton' : 'yardcrew', +d.i);
  if (a === 'hire') state.hireMax = Math.max(0, Math.min(500, (state.hireMax == null ? 50 : state.hireMax) + (+d.d) * 5));
  if (a === 'bcancel') state.build = state.build.filter(j => j.id !== +d.id);
  refreshEarth();
}

/* ===== ПАНЕЛЬ «НАУКА» ===== */
export function refreshScience() {
  const S = state.sci, act = state.research || {}, prog = state.tprog || {};
  let h = `<div class="box"><h2>Очки науки (поступают в текущее исследование)</h2><div class="stats">${Object.entries(FIELDS).map(([f, n]) => `<span>${n}</span><span>${fmtN(S[f], 1)}</span>`).join('')}<span>Купленные очки</span><span>${fmtN(state.rp || 0, 1)}</span></div>
    <div class="help">Выберите тему в каждой области: очки области идут в неё сами, пока тема не изучена. Научные центры на Земле дают по ${fmtN(state.bld.scicenter)} очку в сутки в каждой области. Купленные очки лабораторий делятся между активными темами.</div></div>`;
  ensureOffers(Object.keys(FIELDS));
  for (const f in FIELDS) {
    const offer = state.offers[f], rr = (state.rerolls && state.rerolls[f]) || 0, nDone = TECH.filter(t => t.f === f && state.tech[t.id]).length, nAll = TECH.filter(t => t.f === f).length;
    h += `<div class="box"><div class="row"><h2 class="grow">${FIELDS[f]} <span class="muted">${nDone}/${nAll}</span></h2><button class="btn sm" data-a="reroll" data-f="${f}"${rr > 0 ? '' : ' disabled'}>Сменить карточки (${rr})</button></div>` +
      (offer.length ? `<div class="cards">` + offer.map(id => { const t = techById(id), R = RARITY[t.r], cur = act[f] === t.id, p = prog[t.id] || 0;
        return `<div class="tcard${cur ? ' on' : ''}" style="border-color:${R.col}">${techArt(t.id, t.f, t.r)}<div class="row" style="margin-top:6px"><b class="grow">${t.name}</b></div><div class="muted" style="color:${R.col}">${R.n}</div><div class="help">${t.desc}</div>${t.excl ? `<div class="warn">Развилка: исключает «${techById(t.excl).name}» навсегда</div>` : ''}${bar(p / t.cost)}<div class="row"><span class="mono muted grow">${fmtN(p)} / ${t.cost}</span><button class="btn sm ${cur ? 'on' : ''}" data-a="buytech" data-t="${t.id}">${cur ? 'Изучается' : 'Изучать'}</button></div></div>`; }).join('') + '</div>' : '<div class="muted">Все технологии области изучены.</div>') +
      `<details><summary class="muted">Изучено (${nDone})</summary><div class="help">${TECH.filter(t => t.f === f && state.tech[t.id]).map(t => `<div style="display:flex;gap:8px;align-items:center;margin:3px 0"><span style="flex:none;width:72px">${techArt(t.id, t.f, t.r, 72, 27)}</span><span><b style="color:${RARITY[t.r].col}">${t.name}</b>: ${t.desc}</span></div>`).join('<br>') || 'пока ничего'}</div></details></div>`;
  }
  h += '<div class="box"><h2>Научные объекты</h2>' + BODIES.filter(b => b.sci).map(b => `<div class="dcol" style="gap:2px"><div class="row"><b class="grow" style="color:#b794e8">${b.name}</b><button class="btn sm" data-a="selbody" data-id="${b.id}">На карте</button></div>` +
    Object.entries(b.sci).map(([f, m]) => `<div class="row"><span style="width:110px">${FIELDS[f]} ×${m}</span>${bar(state.sites[b.id][f] / b.pool[f])}<span class="mono">${fmtN(state.sites[b.id][f])}</span></div>`).join('') + '</div>').join('') + '</div>';
  const p = $('p-sci');
  if (!p._built) { p._built = true; p.innerHTML = `<div class="box"><h2>Покупка очков исследований у лабораторий корпораций</h2><div id="sc-info"></div>
    <div class="row"><label>Покупать в месяц, ОИ <input type="number" min="0" step="10" data-sci="amt" id="sc-amt" value="${sciPol().amt}"></label><label>Не дороже, кр за ОИ <input type="number" min="0" step="100" data-sci="max" id="sc-max" value="${sciPol().max}" style="width:90px"></label></div>
    <div class="help">Игра сама заключает сделки с самыми дешёвыми лабораториями. 0 в «Не дороже» — без ограничения цены. Купленные очки идут в изучаемые темы.</div></div><div id="sc-main" class="dcol" style="gap:6px"></div>`; }
  const I = state.sciInfo || {avail: 0, avg: 0, bought: 0, spent: 0};
  setHtml($('sc-info'), `<div class="stats"><span>Доступно у лабораторий в месяц</span><span>${fmtN(I.avail, 0)} ОИ</span><span>Средняя цена</span><span>${fmtN(I.avg, 0)} кр/ОИ</span><span>Куплено за прошлый месяц</span><span>${fmtN(I.bought, 0)} ОИ за ${fmtN(I.spent, 0)} кр</span></div>`);
  setHtml($('sc-main'), h);
}
(function sciEvents() {
  const p = document.getElementById('p-sci');
  p.addEventListener('input', (e) => { const k = e.target.dataset && e.target.dataset.sci; if (k) sciPol()[k] = Math.max(0, +e.target.value || 0); });
})();

/* ===== ПОИСК И ОТМЕТКИ ===== */
export function toggleMark(k) { if (state.marks[k]) delete state.marks[k]; else state.marks[k] = 1; }
export function renderFindIfOpen() { if (ui.tab === 'find') refreshFindList(); }
export function renderFind() {
  const f = ui.find; f.type = f.type || 'all';
  const sel = (id, arr, cur) => `<select id="${id}" data-c="${id}">${arr.map(([v, n]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${n}</option>`).join('')}</select>`;
  $('p-find').innerHTML = `<div class="box"><h2>Поиск и обзор тел</h2><div class="row"><input type="text" id="fq" data-c="fq" placeholder="Название" value="${esc(f.q)}" style="width:150px">
    ${sel('ftype', [['all', 'Все тела'], ['rock', 'Планеты и спутники'], ['ast', 'Астероиды'], ['comet', 'Кометы'], ['mark', 'Отмеченные'], ['special', 'Особые']], f.type)}
    ${sel('fres', [['', 'Сортировка по ресурсу…'], ...Object.keys(RES).filter(k => k !== 'spares').map(k => [k, RES[k]])], f.res)}
    ${sel('fsort', [['amt', 'по запасу'], ['dist', 'по расстоянию'], ['mass', 'по массе'], ['a', 'по орбите']], f.sort)}</div>
    <div class="help">Ячейка ресурса: запас, т / доступность жилы (сложность ×1.0 — лучшая). Клик по строке — выбрать тело, ★ — отметка.</div></div>
    <div id="fmarks"></div><div id="flist"></div>`;
  refreshFindList();
}
const FCOLS = ['fe', 'ni', 'ti', 'cu', 'si', 'c', 'ice', 'pt', 'ree', 'u', 'vol'];
const VOLS = ['n2', 'co2', 'ch4', 'nh3'];
const cn = n => n < 1e5 ? fmtN(n) : Number(n).toExponential(1).replace('e+', 'e').replace('.', ',');
export function refreshFindList() {
  if (!$('flist')) return;
  const f = ui.find, ep = objPos('earth', state.t), q = f.q.trim().toLowerCase(), G = 6.674e-11;
  const oresOf = b => state.ast[b.id] || (state.ground && state.ground[b.id]) || null;
  const rows = BODIES.filter(b => ['ast', 'moon', 'planet', 'hub'].includes(b.kind) && oresOf(b) && (!q || b.name.toLowerCase().includes(q)) &&
    (f.type === 'all' || (f.type === 'rock' && b.kind !== 'ast') || (f.type === 'ast' && b.kind === 'ast' && !b.comet && !b.strange) || (f.type === 'comet' && b.comet) || (f.type === 'special' && (b.strange || b.sci)) || (f.type === 'mark' && state.marks[b.id])) &&
    (!f.res || (oresOf(b)[f.res] > 0))).map(b => {
    const o = oresOf(b), p = objPos(b.id, state.t), vol = VOLS.reduce((a, k) => a + (o[k] || 0), 0);
    return {b, o, vol, d: Math.hypot(p.x - ep.x, p.y - ep.y), amt: f.res ? o[f.res] : sumVals(o)};
  }).sort((a, c) => f.sort === 'dist' ? a.d - c.d : f.sort === 'mass' ? (c.b.mass || 0) - (a.b.mass || 0) : f.sort === 'a' ? (a.b.a || 0) - (c.b.a || 0) : c.amt - a.amt);
  const total = rows.length, shown = rows.slice(0, 150);
  const star = k => `<span data-a="mark" data-k="${k}" style="cursor:pointer">${state.marks[k] ? '★' : '☆'}</span>`;
  const th = t => `<th style="text-align:right;padding:1px 5px;white-space:nowrap">${t}</th>`;
  const cell = (b, o, k) => { const v = k === 'vol' ? VOLS.reduce((a, x) => a + (o[x] || 0), 0) : (o[k] || 0); if (!(v > 0)) return '<td style="text-align:right;color:#555">–</td>'; const e = k === 'vol' ? .5 : veinBase(b.id, k); return `<td style="text-align:right;padding:1px 5px;white-space:nowrap">${cn(v)} <span style="color:${e >= .7 ? 'var(--good)' : e >= .4 ? 'var(--warn)' : 'var(--bad)'}">${e.toFixed(1)}</span></td>`; };
  const TYPE = b => b.comet ? 'комета' : b.kind === 'moon' ? 'спутник' : b.kind === 'planet' || b.kind === 'hub' ? 'планета' : b.strange ? 'особый' : (b.type ? b.type + '-тип' : 'астероид');
  setHtml($('flist'), `<div class="box"><h2>Найдено: ${total}${total > 150 ? ' (показаны первые 150)' : ''}</h2><div data-sc style="overflow:auto;max-height:calc(100vh - 330px)"><table class="mono" style="border-collapse:collapse;font-size:11px;min-width:100%"><tr style="position:sticky;top:0;background:var(--panel2)">
    <th></th><th style="text-align:left;padding:1px 5px">Тело</th><th style="text-align:left">Тип</th>${th('а.е.')}${th('От Земли')}${th('Диам. км')}${th('Масса кг')}${FCOLS.map(k => th(k === 'vol' ? 'Летучие' : RES[k])).join('')}</tr>` +
    shown.map(({b, o, d}) => `<tr data-a="selbody" data-id="${b.id}" style="cursor:pointer;border-top:1px solid #8882"><td style="padding:1px 4px">${star(b.id)}</td><td style="padding:1px 5px;white-space:nowrap;color:${b.sci ? '#b794e8' : 'inherit'}">${esc(b.name)}</td><td style="color:var(--muted)">${TYPE(b)}</td>
      <td style="text-align:right;padding:1px 5px">${b.a != null ? fmtN(b.a, 2) : '—'}</td><td style="text-align:right;padding:1px 5px">${fmtN(d, 2)}</td><td style="text-align:right;padding:1px 5px">${b.d ? fmtN(b.d, b.d < 10 ? 2 : 0) : '—'}</td><td style="text-align:right;padding:1px 5px">${b.mass ? cn(b.mass) : '—'}</td>${FCOLS.map(k => cell(b, o, k)).join('')}</tr>`).join('') + '</table></div></div>');
  const keys = Object.keys(state.marks);
  $('fmarks').innerHTML = keys.length ? '<div class="box"><h2>Отмеченные (' + keys.length + ')</h2>' + keys.map(k => {
    const p = objPos(k, state.t), d = Math.hypot(p.x - ep.x, p.y - ep.y);
    return `<div class="row">${mkBtn(k)}<b class="grow">${esc(nameOf(k))}</b><span class="muted mono">${fmtN(d, 2)} а.е.</span><button class="btn sm" data-a="focus" data-k="${k}">На карте</button></div>`;
  }).join('') + '</div>' : '<div class="help">Отмечайте любые объекты звёздочкой (в этом списке или на вкладке «Объект»): астероиды, корабли, станции. Метки видны на карте всегда.</div>';
}

/* ===== ОФИЦЕРЫ ===== */
export function prioHtml(d) {
  const s = dStats(d), slots = slotsFor(s), pr = d.prio || (d.prio = {cmd: 0, eng: 0, pil: 0, min: 0});
  const opt = (v, cur) => `<option value="${v}"${v === cur ? ' selected' : ''}>${v ? 'не ниже ' + v : 'лучший из доступных'}</option>`;
  const {miss} = staffFor(s, pr);
  return '<h2>Офицеры для экипажа</h2>' + slots.map(r => `<label class="row"><span style="min-width:96px">${ROLES[r]}</span><select data-prio="${r}">${[0, 3, 4, 5, 6, 7, 8, 9, 10].map(v => opt(v, pr[r] || 0)).join('')}</select></label>`).join('') +
    (miss.length ? `<div class="warn">Сейчас нет свободных: ${miss.join(', ')}. Корабль достроится, когда они появятся.</div>` : '<div class="ok">Свободные офицеры подходят.</div>');
}
export const skHtml = (o, role) => ['eng', 'sci', 'min', 'pil', 'cmd'].map(r => `<span class="sk${r === role ? ' hi' : ''}" title="${SKILLS[r]}">${r === 'eng' ? 'И' : r === 'sci' ? 'Н' : r === 'min' ? 'Г' : r === 'pil' ? 'П' : 'К'}${fmtN(o.sk[r], 1)}</span>`).join('');
export function renderOfficers() {
  const p = $('p-off'), free = freeOfficers().sort((a, b) => b.sk.eng + b.sk.cmd - a.sk.eng - a.sk.cmd);
  let h = `<div class="help">Академия выпускает класс офицеров (до 20 за выпуск на высоком уровне), качество самое разное: от слабых до узких специалистов. И — инженерия, Н — наука, Г — горное дело, П — пилотирование, К — командование. Со временем навыки растут от практики.</div>
    <div class="box"><h2>Свободные (${free.length})</h2>${free.slice(0, 30).map(o => `<div class="row"><span class="grow">${esc(o.name)}</span>${skHtml(o)}</div>`).join('') || '<div class="help">Свободных нет.</div>'}${free.length > 30 ? `<div class="help">Показаны 30 лучших, ещё ${free.length - 30} в запасе.</div>` : ''}</div>`;
  const ents = [...myShips().map(s => ({kind: 'ship', e: s})), ...myStations().map(s => ({kind: 'station', e: s}))];
  for (const {kind, e} of ents) {
    h += `<div class="box"><div><b>${esc(e.name)}</b> <span class="muted">${kind === 'station' ? 'станция' : ''}</span></div>` +
      slotsFor(e.st).map(r => {
        const cur = officerById(e.crew[r]);
        const opts = [cur, ...free].filter(Boolean).sort((a, b) => b.sk[r] - a.sk[r]);
        return `<div class="row"><span style="min-width:84px">${ROLES[r]}</span><select data-c="crew" data-kind="${kind}" data-id="${e.id}" data-role="${r}" class="grow"><option value="">— нет —</option>${opts.map(o => `<option value="${o.id}"${cur && o.id === cur.id ? ' selected' : ''}>${esc(o.name)} · ${fmtN(o.sk[r], 1)}</option>`).join('')}</select></div>`;
      }).join('') + '</div>';
  }
  p.innerHTML = h;
}
export function crewChange(el) {
  const kind = el.dataset.kind, id = +el.dataset.id;
  const e = (kind === 'ship' ? state.ships : state.stations).find(x => x.id === id);
  if (e) setCrew(e, kind, el.dataset.role, el.value ? +el.value : 0);
  renderOfficers();
}

/* ===== ВКЛАДКИ, СОБЫТИЯ, ЦИКЛ ===== */
export function showTab(name) {
  ui.tab = name;
  // 'map' — только карта; любой раздел (в т. ч. «Обзор») открывается окном по центру
  const side = $('side'), v = $('veil'); if (side) { side.hidden = name === 'map'; side.classList.add('modal'); side.classList.remove('card'); } if (v) v.hidden = name === 'map';
  if (name === 'map') { document.querySelectorAll('#iconbar .ico').forEach(b => b.classList.remove('on')); return; }
  syncShell(name);
  for (const n of ['obj', 'orders', 'yard', 'earth', 'corp', 'trade', 'cargo', 'pop', 'comp', 'climate', 'work', 'col', 'laws', 'find', 'sci', 'off', 'fleet', 'demo', 'log']) $('p-' + n).hidden = n !== name;
  if (name === 'orders') renderOrders();
  if (name === 'yard') renderYard();
  if (name === 'obj') renderObj();
  if (name === 'off') renderOfficers();
  if (name === 'earth') refreshEarth();
  if (name === 'corp') refreshCorp();
  if (name === 'pop') refreshPop();
  if (name === 'comp') refreshComp();
  if (name === 'laws') refreshLaws();
  if (name === 'work') refreshWork();
  if (name === 'col') refreshCol();
  if (name === 'trade') refreshTrade();
  if (name === 'cargo') refreshCargo();
  if (name === 'demo') refreshDemo();
  if (name === 'climate') refreshClimate();
  if (name === 'sci') refreshScience();
  if (name === 'find') renderFind();
  if (name === 'fleet') refreshFleet();
  if (name === 'log') refreshLog();
}
export function addOrderTo(groupVal, order) {
  let g;
  if (groupVal === 'new') { g = newGroup(); } else g = state.groups.find(x => x.id === +groupVal);
  if (!g) return;
  g.orders.push(order);
  ui.edit = {kind: 'group', id: g.id};
  showTab('orders');
}
export function sideAction(a, d) {
  if (a === 'openstats') return openStats();
  if (a === 'opendesigner') return openDesigner();
  if (a === 'openyard') return showTab('yard');
  if (a === 'openearth') return showTab('earth');
  if (a === 'selbody') return select({kind: 'body', id: d.id});
  if (a === 'cargoto') { ui.cargoTo = d.id; showTab('cargo'); return; }
  if (['bbuild', 'bcancel', 'yton', 'ycrew', 'bview', 'econ'].includes(a)) return earthClick(a, d);
  if (a === 'mark') { toggleMark(d.k); refreshObj(); return renderFindIfOpen(); }
  if (a === 'focus') { const k = d.k; select(isSt(k) ? {kind: 'station', id: +k.slice(3)} : isSh(k) ? {kind: 'ship', id: +k.slice(3)} : {kind: 'body', id: k}); focusSel(); return; }
  if (a === 'reroll') { reroll(d.f); return refreshScience(); }
  if (a === 'buytech') { techSet(d.t); return refreshScience(); }
  if (a === 'editship') { ui.edit = {kind: 'ship', id: ui.sel.id}; return showTab('orders'); }
  if (a === 'addmine') { const t = ui.sel.id; return addOrderTo($('actGroup').value, {type: 'mine', target: t, res: $('actRes').value, pct: 100}); }
  const selId = ui.sel.kind === 'station' ? 'st:' + ui.sel.id : ui.sel.kind === 'ship' ? 'sh:' + ui.sel.id : ui.sel.id;
  if (a === 'addmove') return addOrderTo($('actGroup').value, {type: 'move', target: selId});
  if (a === 'addresearch') return addOrderTo($('actGroup').value, {type: 'research', target: selId, days: 30});
  if (a === 'addtow') return addOrderTo($('actGroup').value, {type: 'tow', target: selId});
  if (a === 'addhome') return addOrderTo($('actGroup').value, {type: 'home', base: selId});
  if (a === 'addtransfer') return addOrderTo($('actGroup').value, {type: 'transfer', target: selId});
  if (['newgroup', 'togroup', 'unassign', 'assign', 'delgroup', 'oadd', 'odel', 'oup', 'odown', 'radd', 'rdel', 'preset'].includes(a)) return ordersClick(a, d);
  if (['enqueue', 'ycancel'].includes(a)) return yardClick(a, d);
}
$('side').addEventListener('click', e => {
  const t = e.target.closest('.tab'); if (t) return showTab(t.dataset.tab);
  const sh = e.target.closest('[data-ship]'); if (sh) return select({kind: 'ship', id: +sh.dataset.ship});
  const sts = e.target.closest('[data-st]'); if (sts) return select({kind: 'station', id: +sts.dataset.st});
  const b = e.target.closest('[data-a]'); if (b && b.tagName === 'BUTTON') sideAction(b.dataset.a, b.dataset);
});
document.addEventListener('pointerdown', () => { ui.down = true; }, true);
document.addEventListener('pointerup', () => { setTimeout(() => { ui.down = false; }, 0); }, true);
document.addEventListener('pointercancel', () => { ui.down = false; }, true);
$('side').addEventListener('change', e => { const d = e.target.dataset || {};
  if (d.qp) { const q = state.build.find(j => String(j.id) === d.qp); if (q) q.pct = Math.max(0, Math.min(100, +e.target.value || 0)); refreshEarth(); }
  if (e.target.id === 'bq-n') state.bqN = Math.max(1, Math.floor(+e.target.value || 1)); if (e.target.id === 'bq-p') state.bqP = Math.max(0, Math.min(100, +e.target.value || 0)); });
$('side').addEventListener('input', e => { if (e.target.dataset.c === 'fq') { ui.find.q = e.target.value; refreshFindList(); } });
document.addEventListener('pointerdown', () => { ui.down = true; }, true);
document.addEventListener('pointerup', () => { setTimeout(() => { ui.down = false; }, 0); }, true);
document.addEventListener('pointercancel', () => { ui.down = false; }, true);
$('side').addEventListener('change', e => {
  const el = e.target, c = el.dataset.c; if (!c) return;
  if (c === 'crew') return crewChange(el);
  if (c === 'shipgroup') {
    const s = state.ships.find(x => x.id === ui.sel.id); if (!s) return;
    if (el.value === 'new') { const g = newGroup('Группа ' + s.name); s.groupId = g.id; ui.edit = {kind: 'group', id: g.id}; }
    else s.groupId = el.value ? +el.value : null;
    s.pc = 0; s.wait = null; s.interrupt = null; s.tmp = null; renderObj();
  } else if (['fq', 'fres', 'fsort', 'ftype'].includes(c)) { ui.find[c === 'fq' ? 'q' : c === 'fres' ? 'res' : c === 'ftype' ? 'type' : 'sort'] = el.value; refreshFindList(); }
  else if (['ydesign', 'ycount', 'ygroup'].includes(c)) yardChange(c, el);
  else ordersChange(c, el);
});
document.addEventListener('keydown', e => {
  if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
  if (e.code === 'Escape' && ui.tab !== 'map') { showTab('map'); }
  else if (e.code === 'Space') { e.preventDefault(); state.paused = !state.paused; }
  else if (e.key >= '1' && e.key <= '7') { state.speedIdx = +e.key + 3; state.paused = false; }
  else if (e.key === 'Escape') closeDesigner();
});
$('speeds').addEventListener('click', e => {
  if (e.target.id === 'bpause') state.paused = !state.paused;
  else if (e.target.id === 'bskip') ui.skip += 5;
  else if (e.target.dataset.sp) { state.speedIdx = +e.target.dataset.sp; state.paused = false; }
  refreshHeader();
});
export function addNewGameButton() {
  const b = document.createElement('button'); b.className = 'btn sm'; b.textContent = 'Новая игра';
  let armed = 0;
  b.onclick = () => {
    if (!armed) { armed = 1; b.textContent = 'Точно? Нажмите ещё раз'; setTimeout(() => { armed = 0; b.textContent = 'Новая игра'; }, 3000); return; }
    newGame(); ui.edit = null; ui.sel = {kind: 'body', id: 'earth'}; armed = 0; b.textContent = 'Новая игра'; saveGame(); showTab(ui.tab); refreshHeader();
  };
  $('top').appendChild(b);
}

export let lastT = performance.now(), lastUi = 0;
export function frame(now) {
  const dt = Math.min(0.25, (now - lastT) / 1000); lastT = now;
  const WARM = !!(hooks.warActive && hooks.warActive()); let days_ = 0;
  if (WARM) hooks.warFrame(dt);
  else if (Battle.active() && state.demo) { if (!state.paused) Battle.frame(dt); }
  else if (!state.paused) {
    let days = dt * SPEEDS[state.speedIdx].m / 1440;
    if (Battle.active()) days = Math.min(days, (Battle.hot() ? 40 : 300) * dt / 86400);
    advance(days); days_ = days;
  }
  if (hooks.bgStep) hooks.bgStep(WARM || state.paused || (Battle.active() && state.demo) ? 0 : days_, dt, state.paused ? 0 : SPEEDS[state.speedIdx].m / 1440);
  if (!WARM && Battle.active() && !state.demo && !state.paused && (ui.skip > 0 || SPEEDS[state.speedIdx].m >= 1440)) { const sim = Battle.fastForward(10); state.t += sim / 86400; if (ui.skip > 0) ui.skip = Math.max(0, ui.skip - sim / 86400); } // перемотка: бой просчитывается мгновенно
  if (ui.skip > 0 && !Battle.active()) { const t0 = performance.now(); while (ui.skip > 1e-9 && performance.now() - t0 < 14) { const d = Math.min(0.25, ui.skip); advance(d); ui.skip -= d; } }
  if (!WARM && Battle.active()) { if (ui.bfollow) { const p = objPos('earth', state.t); ui.cam.x = p.x; ui.cam.y = p.y; } else if (ui.bship) { const q = Battle.anchorSel(), e = objPos('earth', state.t); if (q && q.alive) { ui.cam.x = e.x + q.x / 149597870.7; ui.cam.y = e.y + q.y / 149597870.7; } } Battle.hud(); }
  if (ui.follow) { const sp = selPos(); if (sp) { ui.cam.x = sp.x; ui.cam.y = sp.y; } }
  drawMap();
  if (now - lastUi > 250) {
    lastUi = now; refreshHeader();
    if (!ui.down) // пока кнопка мыши зажата, панель не перерисовываем: иначе кнопка заменяется под курсором и клик теряется
    if (ui.tab === 'obj') refreshObj();
    else if (ui.tab === 'fleet') refreshFleet();
    else if (ui.tab === 'log') refreshLog();
    else if (ui.tab === 'yard') refreshYq();
    else if (ui.tab === 'earth') refreshEarth();
    else if (ui.tab === 'corp') refreshCorp();
    else if (ui.tab === 'pop') refreshPop();
    else if (ui.tab === 'comp') refreshComp();
    else if (ui.tab === 'laws') refreshLaws();
    else if (ui.tab === 'work') refreshWork();
    else if (ui.tab === 'col') refreshCol();
    else if (ui.tab === 'trade') refreshTrade();
    else if (ui.tab === 'cargo') refreshCargo();
    else if (ui.tab === 'climate') refreshClimate();
    else if (ui.tab === 'sci') refreshScience();
  }
  requestAnimationFrame(frame);
}
(function init() {
  if (!loadGame()) newGame();
  buildHeader(); addNewGameButton();
  $('btnLabels').classList.add('on'); $('mtilt').oninput = e => setTilt(+e.target.value); if (ui.tilt == null) { setTilt(35); ui.yaw = .5; } /* карта сразу объёмная */
  new ResizeObserver(resizeMap).observe($('mapwrap')); resizeMap();
  buildShell(); showTab('map'); refreshHeader();
  setInterval(saveGame, 5000);
  window.addEventListener('pagehide', saveGame);
  requestAnimationFrame(frame);
})();

/* ===== СТАТИСТИКА РЕСУРСОВ ===== */
export const STAT_PER = {30: {n: 30, size: 1, l: '1 месяц'}, 90: {n: 30, size: 3, l: '3 месяца'}, 180: {n: 30, size: 6, l: '6 месяцев'}, 360: {n: 12, size: 30, l: '1 год'}};
ui.st = ui.st || {res: 'fe', per: 30, view: 'table'};
export const statRes = () => Object.keys(RES).concat(['fuel']);
export const statName = k => k === 'fuel' ? 'Топливо' : RES[k];
export function openStats() {
  $('sres').innerHTML = statRes().map(k => `<option value="${k}">${statName(k)}</option>`).join('');
  $('sres').value = ui.st.res;
  $('sper').innerHTML = Object.entries(STAT_PER).map(([k, v]) => `<button class="btn sm${+k === ui.st.per ? ' on' : ''}" data-per="${k}">${v.l}</button>`).join('');
  $('stats').hidden = false; renderStats();
}
export const dayVals = (day, k) => { const e = state.hist && state.hist[day] && state.hist[day][k]; if (!e) return null; if (Array.isArray(e)) return {'i:old': e[0], 'o:old': e[1]}; return e; };
export function renderStats() {
  [...$('stab').children].forEach(b => b.classList.toggle('on', b.dataset.v === ui.st.view));
  $('stable').hidden = ui.st.view !== 'table'; $('schartwrap').hidden = ui.st.view !== 'chart';
  if (ui.st.view === 'table') renderStatTable(); else renderStatChart();
}
export function renderStatTable() {
  const day0 = Math.floor(state.t), P = ui.st.per, keys = statRes(), sums = {};
  for (const k of keys) { sums[k] = {}; for (let d = day0 - P + 1; d <= day0; d++) { const e = dayVals(d, k); if (e) for (const q in e) sums[k][q] = (sums[k][q] || 0) + e[q]; } }
  const val = (k, q) => sums[k][q] || 0;
  const row = (label, q, cls) => { if (!keys.some(k => val(k, q))) return ''; return `<tr${cls ? ` class="${cls}"` : ''}><td>${label}</td>${keys.map(k => `<td>${val(k, q) ? fmtN(val(k, q)) : '<span class="dim">–</span>'}</td>`).join('')}</tr>`; };
  const tot = (k, p) => Object.keys(sums[k]).filter(q => q.startsWith(p)).reduce((a, q) => a + sums[k][q], 0);
  const gap = '<tr><td colspan="' + (keys.length + 1) + '" style="border:0;padding:3px"></td></tr>';
  let h = `<table><thead><tr><th></th>${keys.map(k => `<th data-res="${k}">${statName(k)}</th>`).join('')}</tr></thead><tbody>`;
  for (const q of Object.keys(STAT_IN)) h += row(STAT_IN[q], 'i:' + q);
  h += `<tr class="tot"><td>Общий приток</td>${keys.map(k => `<td>${fmtN(tot(k, 'i:'))}</td>`).join('')}</tr>` + gap;
  for (const q of Object.keys(STAT_OUT)) h += row(STAT_OUT[q], 'o:' + q);
  h += `<tr class="tot"><td>Общий отток</td>${keys.map(k => `<td>${fmtN(tot(k, 'o:'))}</td>`).join('')}</tr>` + gap;
  h += `<tr class="tot"><td>Чистый приток</td>${keys.map(k => { const n = tot(k, 'i:') - tot(k, 'o:'); return `<td class="${n < 0 ? 'neg' : n > 0 ? 'pos' : ''}">${fmtN(n)}</td>`; }).join('')}</tr>` + gap;
  h += `<tr><td>На складе сейчас</td>${keys.map(k => `<td>${fmtN(state.stock[k] || 0)}</td>`).join('')}</tr></tbody></table>`;
  $('stable').innerHTML = h;
}
export function renderStatChart() {
  const k = ui.st.res, P = STAT_PER[ui.st.per], day0 = Math.floor(state.t);
  const bins = [];
  for (let i = 0; i < P.n; i++) {
    const to = day0 - (P.n - 1 - i) * P.size, from = to - P.size + 1; let a = 0, b = 0;
    for (let d = from; d <= to; d++) { const e = dayVals(d, k); if (e) for (const q in e) { if (q[0] === 'i') a += e[q]; else b += e[q]; } }
    bins.push({from, to, a, b});
  }
  const tin = bins.reduce((s, x) => s + x.a, 0), tout = bins.reduce((s, x) => s + x.b, 0);
  $('sin').textContent = fmtN(tin) + ' т'; $('sout').textContent = fmtN(tout) + ' т';
  const mx = Math.max(1, ...bins.map(x => Math.max(x.a, x.b))), Wd = 720, Ht = 260, L = 46, B = 24, T = 10, pw = Wd - L - 8, ph = Ht - B - T, bw = pw / P.n;
  let s = `<svg viewBox="0 0 ${Wd} ${Ht}" role="img" aria-label="График">`;
  for (let g = 0; g <= 4; g++) { const y = T + ph - ph * g / 4; s += `<line class="ax" x1="${L}" x2="${Wd - 8}" y1="${y}" y2="${y}"/><text x="${L - 4}" y="${y + 4}" text-anchor="end">${fmtN(mx * g / 4)}</text>`; }
  bins.forEach((x, i) => {
    const x0 = L + i * bw, h1 = ph * x.a / mx, h2 = ph * x.b / mx, w = Math.max(1, bw * 0.4);
    const tip = `${P.size > 1 ? `сутки ${Math.max(0, x.from)}–${Math.max(0, x.to)}` : `сутки ${Math.max(0, x.to)}`}: приток ${fmtN(x.a)} т, расход ${fmtN(x.b)} т`;
    s += `<g><title>${tip}</title><rect class="gi" x="${x0 + bw * 0.08}" y="${T + ph - h1}" width="${w}" height="${h1}"/><rect class="go" x="${x0 + bw * 0.08 + w + 1}" y="${T + ph - h2}" width="${w}" height="${h2}"/></g>`;
    if (x.to >= 0 && (i % Math.ceil(P.n / 10) === 0 || i === P.n - 1)) s += `<text x="${x0 + bw / 2}" y="${Ht - 6}" text-anchor="middle">${Math.max(0, x.to)}</text>`;
  });
  $('schart').innerHTML = s + '</svg><div class="muted" style="font-size:11px">Ось X — игровые сутки. Столбец = ' + (P.size === 1 ? 'сутки' : P.size + ' сут') + '.</div>';
}
$('sres').addEventListener('change', e => { ui.st.res = e.target.value; renderStats(); });
$('sper').addEventListener('click', e => { const b = e.target.closest('[data-per]'); if (!b) return; ui.st.per = +b.dataset.per; [...$('sper').children].forEach(x => x.classList.toggle('on', x === b)); renderStats(); });
$('stab').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (!b) return; ui.st.view = b.dataset.v; renderStats(); });
$('stable').addEventListener('click', e => { const th = e.target.closest('[data-res]'); if (!th) return; ui.st.res = th.dataset.res; $('sres').value = ui.st.res; ui.st.view = 'chart'; renderStats(); });
$('sclose').onclick = () => { $('stats').hidden = true; };
$('stats').addEventListener('pointerdown', e => { if (e.target === $('stats')) $('stats').hidden = true; });

hooks.showTab = showTab;

(function modalClose() { const c = document.getElementById('mclose'), v = document.getElementById('veil'); if (c) c.onclick = () => showTab('map'); if (v) v.onclick = () => showTab('map'); })();
