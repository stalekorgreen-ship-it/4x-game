// @ts-nocheck
import { AST_TYPE_NAME, depleteYears, veinEff, BODIES, BODY, FIELDS, GROUND, RES, SPEEDS, TERRA, canShipMine, cargoTotal, fmtDate, fmtN, fuelPerAU, groupOf, massOf, myShips, myStations, nameOf, objPos, shipMass, shipMineLimit, shipSpeed, state, storeTotal } from './01-data.ts';
import { GROUP_NAME, ROLES, anyFailed, officerById, shipCond } from './02-crew.ts';
import { Battle, raidChip } from './05-battle.ts';
import { hooks } from './00-hooks.ts';

/* ===== UI: ОБЩЕЕ ===== */
export const $ = id => document.getElementById(id);
// Обновляет содержимое, только если оно изменилось, и сохраняет горизонтальную прокрутку таблиц
export function setHtml(el, html) {
  if (!el || el._h === html) return; el._h = html;
  const sc = [...el.querySelectorAll('[data-sc]')].map(e => [e.scrollLeft, e.scrollTop]), top = el.scrollTop;
  el.innerHTML = html;
  el.querySelectorAll('[data-sc]').forEach((e, i) => { if (sc[i]) { e.scrollLeft = sc[i][0]; e.scrollTop = sc[i][1]; } });
  if (el.scrollTop !== top) el.scrollTop = top;
}
export const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
import { COLONIZABLE, colInfo } from './07-population.ts';
export const ui = {colSel: 'earth', skip: 0, dopt: {}, sel: {kind: 'body', id: 'earth'}, tab: 'obj', edit: null, dsel: null, labels: true,
  cam: {x: 0, y: 0, k: 120}, camInit: false, follow: false, belts: true, find: {q: '', res: '', sort: 'amt'}};

export function groupColor(s) { const g = groupOf(s); return g ? g.color : '#9aa7bb'; }
export function groupOpts(sel, withNone, withNew) {
  let h = '';
  if (withNone) h += `<option value="">Без группы</option>`;
  h += state.groups.filter(g => !g.corp).map(g => `<option value="${g.id}"${g.id === sel ? ' selected' : ''}>${esc(g.name)}</option>`).join('');
  if (withNew) h += `<option value="new">+ Новая группа</option>`;
  return h;
}
export const stOpts = sel => state.stations.map(s => `<option value="st:${s.id}"${'st:' + s.id === sel ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
export const targetOpts = sel => `<optgroup label="Тела">${bodyOpts(sel)}</optgroup>` + (state.stations.length ? `<optgroup label="Станции">${stOpts(sel)}</optgroup>` : '');
export const baseOpts = sel => `<option value="earth"${sel === 'earth' ? ' selected' : ''}>Земля</option><option value="nearest"${sel === 'nearest' ? ' selected' : ''}>Ближайшая станция или Земля</option>` + state.stations.map(s => `<option value="st:${s.id}"${'st:' + s.id === sel ? ' selected' : ''}>${esc(s.name)}</option>`).join('');
export const bodyOpts = (sel, only) => BODIES.filter(b => !b.comet && (b.kind !== 'sun' || only === 'sci') && (!only || (only === 'ast' ? (b.kind === 'ast' || b.kind === 'moon') && Object.keys(b.ores).length && canShipMine(b.id) : only === 'sci' ? b.sci : b.kind === only)))
  .map(b => `<option value="${b.id}"${b.id === sel ? ' selected' : ''}>${b.name}</option>`).join('');

/* ===== ПОЯСА ===== */
export function mkBelt(n, a0, a1, col, maxK, seed) {
  let s = seed; const rn = () => (s = (s * 16807) % 2147483647) / 2147483647, p = [];
  for (let i = 0; i < n; i++) p.push({a: a0 + (a1 - a0) * (rn() + rn()) / 2, ang: rn() * 6.2832, s: rn() < 0.08 ? 2 : 1});
  return {p, col, maxK};
}
export const BELTS = [mkBelt(2600, 2.1, 3.3, 'rgba(150,160,175,0.55)', 0, 12345), mkBelt(1800, 30, 50, 'rgba(120,140,170,0.5)', 14, 777)];

/* ===== ШАПКА ===== */
export function buildHeader() {
  $('speeds').innerHTML = `<button class="btn" id="bpause" title="Пауза (пробел)"></button>` +
    SPEEDS.map((s, i) => `<button class="btn" data-sp="${i}" title="Клавиша ${i + 1}">${s.l}/с</button>`).join('') + `<button class="btn" id="bskip" title="Перемотать 5 суток вперёд">+5 сут</button>`;
}
export function refreshHeader() {
  $('clock').textContent = fmtDate(state.t);
  const bp = $('bpause'); bp.textContent = state.paused ? '▶ Пуск' : '⏸ Пауза'; bp.classList.toggle('on', state.paused);
  document.querySelectorAll('[data-sp]').forEach(b => b.classList.toggle('on', !state.paused && +b.dataset.sp === state.speedIdx));
  const st = state.stock;
  $('stock').innerHTML = `<span class="chip"><b>Топливо</b>${fmtN(st.fuel)}</span><span class="chip"><b>Тех. изд.</b>${fmtN(st.spares)}</span><span class="chip"><b>Кораблей</b>${myShips().length}</span><span class="chip"><b>Станций</b>${myStations().length}</span><span class="chip"><b>Кредиты</b>${fmtN(state.money || 0)}</span>` + raidChip();
}

/* ===== КАРТА ===== */
export const cv = $('map'), cx = cv.getContext('2d');
export let W = 300, H = 300;
export function resizeMap() {
  const r = cv.getBoundingClientRect(), d = window.devicePixelRatio || 1;
  W = r.width; H = r.height;
  cv.width = Math.max(1, Math.round(W * d)); cv.height = Math.max(1, Math.round(H * d));
  cx.setTransform(d, 0, 0, d, 0, 0);
  if (!ui.camInit && W > 50) { fitMap(); ui.camInit = true; }
}
export function fitMap() { ui.follow = false; ui.cam.x = 0; ui.cam.y = 0; ui.cam.k = Math.min(W, H) / 2 / 3.4; }
export function w2s(p) { return [(p.x - ui.cam.x) * ui.cam.k + W / 2, (p.y - ui.cam.y) * ui.cam.k + H / 2]; }
export function s2w(x, y) { return {x: (x - W / 2) / ui.cam.k + ui.cam.x, y: (y - H / 2) / ui.cam.k + ui.cam.y}; }

export function shipScreen(s, i) {
  const [x, y] = w2s(s);
  return s.at ? [x + 7, y - 7 - (i % 3) * 5] : [x, y];
}
export function drawMap() {
  cx.clearRect(0, 0, W, H);
  cx.fillStyle = '#070a10'; cx.fillRect(0, 0, W, H);
  const [sx, sy] = w2s({x: 0, y: 0});
  // орбиты
  cx.lineWidth = 1;
  for (const b of BODIES) {
    if (!b.a || b.gen) continue;
    if (b.a * ui.cam.k > 2e6) continue;
    cx.strokeStyle = b.kind === 'ast' ? '#151f2e' : '#1f2d42';
    cx.beginPath(); cx.arc(sx, sy, b.a * ui.cam.k, 0, 7); cx.stroke();
  }
  // пояса астероидов
  if (ui.belts) for (const bt of BELTS) {
    if (bt.maxK && ui.cam.k > bt.maxK) continue;
    cx.fillStyle = bt.col;
    for (const q of bt.p) {
      const a = q.ang + 6.2832 * state.t / (365.25 * Math.pow(q.a, 1.5));
      const x = (q.a * Math.cos(a) - ui.cam.x) * ui.cam.k + W / 2, y = (q.a * Math.sin(a) - ui.cam.y) * ui.cam.k + H / 2;
      if (x > -2 && y > -2 && x < W + 2 && y < H + 2) cx.fillRect(x, y, q.s, q.s);
    }
  }
  // орбиты лун
  for (const b of BODIES) {
    if (b.kind !== 'moon' || b.r * ui.cam.k < 8 || b.r * ui.cam.k > 20000) continue;
    const [px, py] = w2s(objPos(b.parent, state.t));
    cx.strokeStyle = '#1b2a40'; cx.beginPath(); cx.arc(px, py, b.r * ui.cam.k, 0, 7); cx.stroke();
  }
  // солнце
  cx.fillStyle = '#f2c14e'; cx.beginPath(); cx.arc(sx, sy, 5, 0, 7); cx.fill();
  const selB = ui.sel.kind === 'body' ? ui.sel.id : null;
  // тела
  cx.font = '11px "IBM Plex Sans",sans-serif'; cx.textBaseline = 'middle';
  for (const b of BODIES) {
    if (b.kind === 'sun' || (b.kind === 'moon' && b.r * ui.cam.k < 6)) continue;
    const [x, y] = w2s(objPos(b.id, state.t));
    let r = b.kind === 'moon' ? 2 : 2.6, col = '#8f8878';
    if (b.kind === 'lagrange') {
      cx.strokeStyle = selB === b.id ? '#fff' : '#4d6a8f'; cx.beginPath();
      cx.moveTo(x - 4, y); cx.lineTo(x + 4, y); cx.moveTo(x, y - 4); cx.lineTo(x, y + 4); cx.stroke();
      if (ui.labels && ui.cam.k > 70) { cx.fillStyle = '#5f7899'; cx.fillText(b.name.replace('Земля ', ''), x + 7, y + 1); }
      continue;
    }
    if (b.kind === 'moon') col = '#c4c9d4';
    if (b.kind === 'hub') { r = 5.5; col = '#4aa3ff'; }
    else if (b.kind === 'planet') { r = 4.5; col = b.id === 'mars' ? '#c8694f' : '#d8c08a'; }
    else {
      const o = state.ast[b.id], left = Object.values(o).reduce((a, c) => a + c, 0);
      if (left < 1) col = '#3a3f4a';
    }
    cx.fillStyle = col; cx.beginPath(); cx.arc(x, y, r, 0, 7); cx.fill();
    if (b.kind === 'hub') { cx.strokeStyle = '#e3a94f'; cx.beginPath(); cx.arc(x, y, r + 4, 0, 7); cx.stroke(); }
    if (selB === b.id) { cx.strokeStyle = '#fff'; cx.beginPath(); cx.arc(x, y, r + 7, 0, 7); cx.stroke(); }
    if (b.sci && b.kind === 'ast') { cx.strokeStyle = '#a77be0'; cx.setLineDash([2, 3]); cx.beginPath(); cx.arc(x, y, r + 4, 0, 7); cx.stroke(); cx.setLineDash([]); }
    if (b.comet && selB !== b.id) { /* без подписей */ } else if (ui.labels && (b.kind === 'moon' ? ui.cam.k > 3000 || selB === b.id : (b.kind !== 'ast' || ui.cam.k > (b.gen ? 3000 : 150) || b.sci || selB === b.id) || state.marks[b.id])) {
      cx.fillStyle = b.sci ? '#b794e8' : b.kind === 'ast' ? '#8493aa' : '#c3cede'; cx.fillText(b.name, x + r + 5, y + 1);
    }
  }
  // линейка: зажат Shift — от выбранного объекта до курсора
  if (ui.shift && ui.mouse) {
    const f = selPos() || objPos('earth', state.t), [fx, fy] = w2s(f), w = s2w(ui.mouse.x, ui.mouse.y), d = Math.hypot(w.x - f.x, w.y - f.y), p = pickAt(ui.mouse.x, ui.mouse.y);
    cx.save(); cx.strokeStyle = '#7fe3ff'; cx.fillStyle = '#7fe3ff'; cx.lineWidth = 1.5; cx.setLineDash([6, 4]);
    cx.beginPath(); cx.moveTo(fx, fy); cx.lineTo(ui.mouse.x, ui.mouse.y); cx.stroke(); cx.setLineDash([]);
    cx.beginPath(); cx.arc(fx, fy, 4, 0, 7); cx.fill(); cx.beginPath(); cx.arc(ui.mouse.x, ui.mouse.y, 4, 0, 7); cx.stroke();
    const km = d * 149597870.7, txt = `${fmtN(d, d < 0.1 ? 4 : 3)} а.е. · ${fmtN(km / 1e6, km < 1e6 ? 3 : 1)} млн км · свет ${fmtN(d * 8.317, 1)} мин${p && p.kind === 'body' ? ' · ' + BODY[p.id].name : ''}`;
    cx.font = '12px "IBM Plex Mono",monospace'; const tw = cx.measureText(txt).width + 12, mx = Math.min(Math.max((fx + ui.mouse.x) / 2 - tw / 2, 4), W - tw - 4), my = (fy + ui.mouse.y) / 2 - 14;
    cx.fillStyle = 'rgba(5,12,20,.88)'; cx.fillRect(mx, my - 10, tw, 20); cx.fillStyle = '#7fe3ff'; cx.textBaseline = 'middle'; cx.fillText(txt, mx + 6, my); cx.restore();
  }
  // станции
  for (const st of state.stations) {
    const [x, y] = w2s(objPos('st:' + st.id, state.t));
    cx.strokeStyle = '#e3a94f'; cx.lineWidth = 1.5; cx.beginPath();
    cx.moveTo(x, y - 6); cx.lineTo(x + 6, y); cx.lineTo(x, y + 6); cx.lineTo(x - 6, y); cx.closePath(); cx.stroke(); cx.lineWidth = 1;
    if (ui.sel.kind === 'station' && ui.sel.id === st.id) { cx.strokeStyle = '#fff'; cx.beginPath(); cx.arc(x, y, 11, 0, 7); cx.stroke(); }
    if (ui.labels) { cx.fillStyle = '#e3a94f'; cx.fillText(st.name, x + 10, y + 1); }
  }
  // корабли
  state.ships.forEach((s, i) => {
    if (s.inB) return;
    const [x, y] = shipScreen(s, i);
    const col = groupColor(s);
    if (s.dest && !s.at && (!s.corp || (ui.sel.kind === 'ship' && ui.sel.id === s.id))) {
      const [dx, dy] = w2s(objPos(s.dest, state.t + (s.eta || 0)));
      cx.strokeStyle = col; cx.globalAlpha = .55; cx.setLineDash([3, 4]);
      cx.beginPath(); cx.moveTo(x, y); cx.lineTo(dx, dy); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1;
    }
    cx.fillStyle = col;
    cx.beginPath();
    if (s.at) { cx.rect(x - 2.5, y - 2.5, 5, 5); }
    else {
      const [dx, dy] = s.dest ? w2s(objPos(s.dest, state.t + (s.eta || 0))) : [x + 1, y];
      const a = Math.atan2(dy - y, dx - x);
      cx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
      cx.lineTo(x + Math.cos(a + 2.5) * 5, y + Math.sin(a + 2.5) * 5);
      cx.lineTo(x + Math.cos(a - 2.5) * 5, y + Math.sin(a - 2.5) * 5);
    }
    cx.fill();
    if (ui.sel.kind === 'ship' && ui.sel.id === s.id) { cx.strokeStyle = '#fff'; cx.beginPath(); cx.arc(x, y, 9, 0, 7); cx.stroke(); }
  });
  if (Battle.active()) drawBattleLayer();
  // отметки
  cx.lineWidth = 1.5;
  for (const key of Object.keys(state.marks)) {
    const [x, y] = w2s(objPos(key, state.t));
    cx.strokeStyle = '#ffd35c'; cx.beginPath(); cx.arc(x, y, 12, 0, 7); cx.stroke();
    cx.fillStyle = '#ffd35c'; cx.fillText('★ ' + nameOf(key), x + 15, y - 10);
  }
  cx.lineWidth = 1;
}
export function pickAt(mx, my) {
  let best = null, bd = 12;
  state.ships.forEach((s, i) => {
    const [x, y] = shipScreen(s, i), d = Math.hypot(x - mx, y - my);
    if (d < bd) { bd = d; best = {kind: 'ship', id: s.id}; }
  });
  if (best) return best;
  for (const st of state.stations) {
    const [x, y] = w2s(objPos('st:' + st.id, state.t)), d = Math.hypot(x - mx, y - my);
    if (d < bd + 2) { bd = d; best = {kind: 'station', id: st.id}; }
  }
  if (best) return best;
  for (const b of BODIES) {
    if (b.kind === 'sun' || (b.kind === 'moon' && b.r * ui.cam.k < 6)) continue;
    const [x, y] = w2s(objPos(b.id, state.t)), d = Math.hypot(x - mx, y - my);
    if (d < bd + 2) { bd = d; best = {kind: 'body', id: b.id}; }
  }
  return best;
}
export const AU_KM = 149597870.7;
export function focusBattle() { const p = objPos('earth', state.t); ui.cam.x = p.x; ui.cam.y = p.y; ui.follow = false; ui.cam.k = Math.min(W, H * 1.6) / 1500 * AU_KM; }
export function drawBattleLayer() {
  const p = objPos('earth', state.t), [bx, by] = w2s(p), kk = ui.cam.k / AU_KM;
  if (kk * 1500 >= 5) Battle.draw(cx, bx, by, kk, 1);
  if (kk * 3000 < 160) {
    const pulse = 1 + 0.25 * Math.sin(performance.now() / 250);
    cx.strokeStyle = '#ff6a5e'; cx.lineWidth = 2; cx.beginPath(); cx.arc(bx, by, 16 * pulse, 0, 7); cx.stroke(); cx.lineWidth = 1;
    cx.fillStyle = '#ff6a5e'; cx.font = '12px system-ui'; cx.fillText('⚔ БОЙ', bx + 20, by - 12);
  }
}
export function selPos() {
  const s = ui.sel;
  if (s.kind === 'ship') { const x = state.ships.find(q => q.id === s.id); return x ? {x: x.x, y: x.y} : null; }
  return objPos(s.kind === 'station' ? 'st:' + s.id : s.id, state.t);
}
export function focusSel(keepZoom) {
  const p = selPos(); if (!p) return;
  ui.cam.x = p.x; ui.cam.y = p.y;
  const s = ui.sel, b = s.kind === 'body' ? BODY[s.id] : null;
  if (!keepZoom) ui.cam.k = Math.max(ui.cam.k, b && b.kind === 'moon' ? b.r * 6000 > 4000 ? 60000 : 400000 : 600);
}
export function select(sel) {
  ui.sel = sel; renderObj(); hooks.showTab('obj');
}
(function mapEvents() {
  let drag = null, moved = false;
  cv.addEventListener('pointerdown', e => {
    drag = {x: e.clientX, y: e.clientY, cx: ui.cam.x, cy: ui.cam.y}; moved = false;
    cv.setPointerCapture(e.pointerId); cv.classList.add('drag');
  });
  cv.addEventListener('pointermove', e => {
    { const r = cv.getBoundingClientRect(); ui.mouse = {x: e.clientX - r.left, y: e.clientY - r.top}; ui.shift = e.shiftKey; }
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.abs(dx) + Math.abs(dy) > 4) { moved = true; ui.bfollow = false; }
    ui.cam.x = drag.cx - dx / ui.cam.k; ui.cam.y = drag.cy - dy / ui.cam.k;
  });
  cv.addEventListener('pointerup', e => {
    cv.classList.remove('drag');
    if (drag && !moved) {
      const r = cv.getBoundingClientRect();
      if (Battle.active() && Battle.pick(e.clientX - r.left, e.clientY - r.top)) { drag = null; return; }
      const p = pickAt(e.clientX - r.left, e.clientY - r.top);
      if (p) select(p);
    }
    drag = null;
  });
  cv.addEventListener('wheel', e => {
    e.preventDefault();
    const r = cv.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top;
    const before = s2w(mx, my);
    ui.cam.k = Math.min(6e10, Math.max(1.5, ui.cam.k * (e.deltaY < 0 ? 1.25 : 1 / 1.25)));
    const after = s2w(mx, my);
    ui.cam.x += before.x - after.x; ui.cam.y += before.y - after.y;
  }, {passive: false});
  $('mapctl').addEventListener('click', e => {
    const a = e.target.dataset.map; if (!a) return;
    const zoomBy = f => { ui.cam.k = Math.min(6e10, Math.max(1.5, ui.cam.k * f)); };
    if (a === 'in') zoomBy(2.5);
    if (a === 'out') zoomBy(0.4);
    if (a === 'sel') focusSel();
    if (a === 'follow') { ui.follow = !ui.follow; $('btnFollow').classList.toggle('on', ui.follow); if (ui.follow) focusSel(true); }
    if (a === 'belts') { ui.belts = !ui.belts; $('btnBelts').classList.toggle('on', ui.belts); }
    if (a === 'fit') { fitMap(); $('btnFollow').classList.remove('on'); }
    if (a === 'earth') { const p = objPos('earth', state.t); ui.cam.x = p.x; ui.cam.y = p.y; ui.cam.k = Math.max(ui.cam.k, 220); }
    if (a === 'labels') { ui.labels = !ui.labels; $('btnLabels').classList.toggle('on', ui.labels); }
  });
})();

/* ===== ПАНЕЛЬ «ОБЪЕКТ» ===== */
export const actGroupSel = () => `<div class="row"><select id="actGroup">${groupOpts(ui.edit && ui.edit.kind === 'group' ? ui.edit.id : null, false, true)}</select></div>`;
export function renderObj() {
  const p = $('p-obj');
  if (ui.sel.kind === 'ship') {
    const s = state.ships.find(x => x.id === ui.sel.id);
    if (!s) { ui.sel = {kind: 'body', id: 'earth'}; return renderObj(); }
    p.innerHTML = `<div id="od"></div><div class="box"><h2>Группа</h2><div class="row">
      <select id="shipGroup" data-c="shipgroup">${groupOpts(s.groupId, true, true)}</select>
      <button class="btn sm" data-a="editship">Приказы</button></div>
      <div class="help">Корабль в группе выполняет программу группы. Без группы у него своя программа.</div></div>
      <div class="box"><h2>Добавить приказ в группу</h2>${actGroupSel()}
      <div class="row"><button class="btn" data-a="addtow">Взять на буксир</button></div></div>`;
  } else if (ui.sel.kind === 'station') {
    const st = state.stations.find(x => x.id === ui.sel.id);
    if (!st) { ui.sel = {kind: 'body', id: 'earth'}; return renderObj(); }
    p.innerHTML = `<div id="od"></div><div class="box"><h2>Добавить приказ в группу</h2>${actGroupSel()}
      <div class="row"><button class="btn" data-a="addmove">Лететь сюда</button><button class="btn" data-a="addtow">Взять на буксир</button></div>
      <div class="row"><button class="btn" data-a="addhome">Разгружаться и заправляться здесь</button></div>
      <div class="row"><button class="btn" data-a="addtransfer">Передать топливо (танкер)</button></div>
      <div class="help">Станцию двигают только тягачом: приказ «Взять на буксир», затем «Лететь» и «Отцепить».</div></div>`;
  } else {
    const b = BODY[ui.sel.id];
    let act = '';
    if (state.ast[b.id] && Object.keys(b.ores).length) {
      const resOpts = Object.keys(b.ores).map(k => `<option value="${k}">${RES[k]}</option>`).join('');
      act = `<div class="box"><h2>Добавить приказ</h2>${actGroupSel()}
        <div class="row"><select id="actRes">${resOpts}</select><button class="btn" data-a="addmine">Добывать здесь</button></div>
        <div class="row"><button class="btn" data-a="addmove">Лететь сюда</button>${b.sci ? '<button class="btn" data-a="addresearch">Исследовать</button>' : ''}</div></div>`;
    } else if (b.kind === 'hub') {
      act = `<div class="box"><h2>Земля — хаб</h2><div class="help">Корабли разгружаются, заправляются и ремонтируются здесь. Лёд перерабатывается в топливо на заводах, тех. изделия делаются на заводе из железа и кремния.</div>
        <div class="row"><button class="btn" data-a="openearth">Склад и здания</button><button class="btn" data-a="openyard">Верфь</button><button class="btn" data-a="opendesigner">Конструктор кораблей</button></div></div>`;
    } else {
      act = `<div class="box"><h2>Добавить приказ</h2>${actGroupSel()}<div class="row"><button class="btn" data-a="addmove">Лететь сюда</button>${b.sci ? '<button class="btn" data-a="addresearch">Исследовать</button>' : ''}</div></div>`;
    }
    if (['hub', 'planet', 'moon', 'ast'].includes(b.kind) && !b.comet) act += `<div class="box"><h2>Грузовой заказ</h2><div class="row"><button class="btn" data-a="cargoto" data-id="${b.id}">Заказать доставку груза сюда</button></div><div class="help">Корпорации привезут инфраструктуру или ресурсы за фрахт.</div></div>`;
    p.innerHTML = `<div id="od"></div>${act}`;
  }
  refreshObj();
}
export function bar(frac, cls) { return `<span class="bar ${cls || ''}"><i style="width:${Math.max(0, Math.min(1, frac)) * 100}%"></i></span>`; }
export function refreshObj() {
  const od = $('od'); if (!od) return;
  const mk = k => `<button class="btn sm" data-a="mark" data-k="${k}">${state.marks[k] ? '★ Снять отметку' : '☆ Отметить'}</button>`;
  if (ui.sel.kind === 'ship') {
    const s = state.ships.find(x => x.id === ui.sel.id); if (!s) return;
    const g = groupOf(s), load = cargoTotal(s), cargoTxt = Object.entries(s.cargo).filter(([, v]) => v > 0.05).map(([k, v]) => `${RES[k]} ${fmtN(v)}`).join(', ') || 'пусто';
    const range = s.fuel / fuelPerAU(s);
    const tags = [s.st.tow ? 'тягач' : '', s.st.tanker ? 'танкер' : '', s.st.cargoCap ? 'грузовой' : ''].filter(Boolean).join(', ');
    od.innerHTML = `<div class="box"><div><span class="dot" style="background:${groupColor(s)}"></span><b class="grow">${esc(s.name)}</b> <span class="muted">${tags}</span> ${mk('sh:' + s.id)}</div>
      <div class="muted">${g ? 'Группа «' + esc(g.name) + '»' : 'Без группы'}${s.interrupt ? ' · возвращается по правилу' : ''}</div>
      <div class="${s.broken || s.status === 'Нет топлива!' ? 'err' : ''}">${esc(s.status)}</div>
      <div class="row">Топливо ${bar(s.fuel / s.st.fuelCap, 'fuel')}<span class="mono">${fmtN(s.fuel, 1)}/${fmtN(s.st.fuelCap)}</span></div>
      <div class="row">Груз ${bar(s.st.cargoCap ? load / s.st.cargoCap : 0)}<span class="mono">${fmtN(load)}/${fmtN(s.st.cargoCap)}</span></div>
      ${Object.entries(s.eq).map(([g, p]) => `<div class="row">${GROUP_NAME[g]} ${bar(p.cond / 100, p.failed ? 'bad' : p.cond < 40 ? 'warn' : 'good')}<span class="mono">${p.failed ? 'отказ' : fmtN(p.cond) + '%'}</span></div>`).join('')}
      <div class="muted">${Object.entries(s.crew).map(([r, id]) => { const o = officerById(id); return o ? ROLES[r] + ': ' + esc(o.name) + ' (' + fmtN(o.sk[r], 1) + ')' : ''; }).join(' · ') || 'Экипажа нет'}</div>
      <div class="muted">${cargoTxt}</div>
      ${s.towing ? `<div>На буксире: <b>${esc(nameOf(s.towing))}</b> (${fmtN(massOf(s.towing))} т, лимит ${fmtN(s.st.tow)} т)</div>` : ''}
      ${s.towedBy ? `<div class="warn">Его тащит «${esc(nameOf('sh:' + s.towedBy))}»</div>` : ''}
      <div class="stats"><span>Скорость сейчас</span><span>${fmtN(shipSpeed(s), 3)} а.е./сут</span>
      <span>Дальность на топливе</span><span>${fmtN(range, 1)} а.е.</span>
      <span>Масса с грузом</span><span>${fmtN(shipMass(s))} т</span>
      <span>Добыча</span><span>${fmtN(s.st.mine)} т/сут</span></div></div>`;
    return;
  }
  if (ui.sel.kind === 'station') {
    const st = state.stations.find(x => x.id === ui.sel.id); if (!st) return;
    const docked = state.ships.filter(s => s.at === 'st:' + st.id);
    const caps = [st.st.xfer ? 'заправка кораблей' : '', st.st.repair ? 'ремонт' : ''].filter(Boolean).join(', ') || 'только склад';
    od.innerHTML = `<div class="box"><div class="row"><b class="grow">${esc(st.name)}</b> <span class="muted">станция</span> ${mk('st:' + st.id)}</div>
      <div class="muted">${st.towedBy ? 'Её тащит «' + esc(nameOf('sh:' + st.towedBy)) + '»' : st.at ? 'У «' + esc(nameOf(st.at)) + '»' : 'В открытом космосе (на месте)'}</div>
      <div class="muted">Возможности: ${caps}</div>
      <div class="row">Склад ${bar(st.st.cargoCap ? storeTotal(st) / st.st.cargoCap : 0)}<span class="mono">${fmtN(storeTotal(st))}/${fmtN(st.st.cargoCap)}</span></div>
      <div class="muted">${Object.entries(st.store).filter(([, v]) => v > 0.05).map(([k, v]) => RES[k] + ' ' + fmtN(v)).join(', ') || 'пусто'}</div>
      <div class="row">Топливо ${bar(st.st.fuelCap ? st.fuel / st.st.fuelCap : 0, 'fuel')}<span class="mono">${fmtN(st.fuel)}/${fmtN(st.st.fuelCap)}</span></div>
      <div class="row">Тех. изделия ${bar(st.st.spareCap ? st.spares / st.st.spareCap : 0)}<span class="mono">${fmtN(st.spares)}/${fmtN(st.st.spareCap)}</span></div>
      <div class="muted">Масса ${fmtN(massOf('st:' + st.id))} т${docked.length ? ' · на станции: ' + docked.map(s => esc(s.name)).join(', ') : ''}</div></div>`;
    return;
  }
  const b = BODY[ui.sel.id], pos = objPos(b.id, state.t), ep = objPos('earth', state.t);
  const dE = Math.hypot(pos.x - ep.x, pos.y - ep.y);
  const kind = {ast: 'астероид', moon: 'спутник', hub: 'хаб', planet: 'планета', lagrange: 'точка Лагранжа'}[b.kind] || '';
  let h = `<div class="box"><div class="row"><b class="grow">${b.name}</b> <span class="muted">${kind}</span> ${b.kind === 'sun' ? '' : mk(b.id)}</div><div class="stats">`;
  if (b.kind === 'lagrange') h += `<span>Орбита</span><span>вместе с Землёй</span>`;
  else if (b.parent) h += `<span>Вокруг</span><span>${BODY[b.parent].name}</span><span>Расстояние</span><span>${fmtN(b.r * 149597871)} км</span><span>Период</span><span>${fmtN(b.per, 2)} сут</span>`;
  else h += `<span>Орбита</span><span>${fmtN(b.a, 3)} а.е.</span><span>Период</span><span>${fmtN(Math.pow(b.a, 1.5), 2)} лет</span>`;
  h += `<span>От Земли сейчас</span><span>${fmtN(dE, 2)} а.е.</span></div>`;
  if (b.kind === 'lagrange') h += `<div class="help">Здесь тяготение Солнца и Земли уравновешено. Станция, оставленная в точке, летит вместе с Землёй. Расстояния условно увеличены.</div>`;
  if (b.sci) {
    const pl = state.sites[b.id];
    h += `<div class="muted">Научный объект${b.hot ? ' (жара: быстрый износ)' : ''}. Множитель науки:</div>` + Object.entries(b.sci).map(([f, m]) => `<div class="row"><span style="width:90px">${FIELDS[f]} ×${m}</span>${bar(pl[f] / b.pool[f])}<span class="mono">${fmtN(pl[f])}</span></div>`).join('');
  }
  { // сводка по телу
    const rows = [], cn = n => n < 1e5 ? fmtN(n) : Number(n).toExponential(2).replace('e+', 'e').replace('.', ',');
    rows.push(['Тип', b.comet ? 'комета' : b.kind === 'moon' ? 'спутник' : b.kind === 'planet' || b.kind === 'hub' ? 'планета' : b.strange ? 'особый объект' : b.type ? AST_TYPE_NAME[b.type] + ' астероид' : 'астероид']);
    if (b.parent) rows.push(['Обращается вокруг', BODY[b.parent].name]);
    if (b.mass) rows.push(['Масса', cn(b.mass) + ' кг']);
    if (b.d) rows.push(['Диаметр', fmtN(b.d, b.d < 10 ? 2 : 0) + ' км']);
    if (b.mass && b.d) rows.push(['Гравитация', fmtN(6.674e-11 * b.mass / Math.pow(b.d * 500, 2), 4) + ' м/с²']);
    if (COLONIZABLE(b.id)) { const I = colInfo(b.id); rows.push(['Колонизация', state.cols && state.cols[b.id] ? 'колония основана' : `${fmtN(I.cost)} кр, ${fmtN(I.settlers)} поселенцев`]); rows.push(['Стоимость колонии', fmtN(I.cc, 1) + ' (1 ед. инфраструктуры = ' + fmtN(I.per) + ' чел.)']); rows.push(['Надбавка к ввозу', '×' + fmtN(I.dist, 2)]); }
    h += `<div class="stats" style="margin-top:4px">${rows.map(r => `<span>${r[0]}</span><span>${r[1]}</span>`).join('')}</div>`;
  }
  if (b.d) h += `<div class="muted">Диаметр ${fmtN(b.d, b.d < 10 ? 2 : 0)} км · ${canShipMine(b.id) ? 'доступен корабельным лазерам' : 'слишком велик для корабельных лазеров (лимит ' + shipMineLimit() + ' км, растёт с технологиями): нужны шахты и население'}</div>`;
  if (state.ground && state.ground[b.id]) {
    const gr = state.ground[b.id];
    h += `<div class="muted" style="margin-top:6px"><b>Недра</b>${b.id === 'earth' ? ': шахты строятся во вкладке «Земля» (1 т/сутки на жилу каждая).' : ': для добычи нужны шахты и работающее население — колоний пока нет.'}</div>` + (b.id === 'earth' ? '' : Object.entries(gr).map(([k, v]) => `<div class="row"><span style="width:70px">${RES[k]}</span>${bar(v / GROUND[b.id][k])}<span class="mono">${fmtN(v)} т · эфф. ${fmtN(veinEff(b.id, k, v, GROUND[b.id][k]) * 100, 0)}%</span></div>`).join(''));
    if (b.id === 'earth') h += Object.entries(gr).map(([k, v]) => { const n = state.bld.mine * (state.tech && state.tech.deepdrill ? 1.5 : 1), y = depleteYears('earth', k, GROUND.earth[k] || v, n); return `<div class="row"><span style="width:70px">${RES[k]}</span>${bar(v / (GROUND.earth[k] || v))}<span class="mono">${fmtN(v)} т · эфф. ${fmtN(veinEff('earth', k, v, GROUND.earth[k] || v) * 100, 0)}% · ${n > 0 ? '90% за ' + (y > 1e6 ? '>1 млн' : fmtN(y, y < 10 ? 1 : 0)) + ' лет' : 'нет шахт'}</span></div>`; }).join('');
  }
  if (state.ast[b.id]) {
    h += Object.entries(state.ast[b.id]).map(([k, v]) => `<div class="row"><span style="width:70px">${RES[k]}</span>${bar(v / b.ores[k])}<span class="mono">${fmtN(v)} т · эфф. ${fmtN(veinEff(b.id, k, v, b.ores[k]) * 100, 0)}%</span></div>`).join('');
  }
  if (TERRA[b.id]) {
    const T = TERRA[b.id], t = state.terra[b.id] || {}; let tot = 0, got = 0;
    for (const k of Object.keys(T.need)) { tot += T.need[k]; got += Math.min(t[k] || 0, T.need[k]); }
    h += `<div class="muted" style="margin-top:6px"><b>Тераформирование: ${fmtN(got / tot * 100, 1)}%</b>${t.done ? ' — завершено' : ''}<br>≈ ${fmtN(got / T.unit)} из ${fmtN(tot / T.unit)} комет (1 комета ≈ ${fmtN(T.unit)} т). Доставляйте лёд и газы приказом «Сбросить груз на планету».</div>` +
      Object.keys(T.need).map(k => `<div class="row"><span style="width:70px">${RES[k]}</span>${bar((t[k] || 0) / T.need[k])}<span class="mono">${fmtN(t[k] || 0)} / ${fmtN(T.need[k])}</span></div>`).join('');
  }
  const here = state.ships.filter(s => s.at === b.id), hereSt = state.stations.filter(s => s.at === b.id && !s.towedBy);
  if (hereSt.length) h += `<div class="muted">Станции: ${hereSt.map(s => esc(s.name)).join(', ')}</div>`;
  if (here.length) h += `<div class="muted">На месте: ${here.map(s => esc(s.name)).join(', ')}</div>`;
  od.innerHTML = h + '</div>';
}

/* ===== ФЛОТ И ЖУРНАЛ ===== */
export function refreshFleet() {
  const p = $('p-fleet');
  let h = '';
  if (myStations().length) h += '<h2>Станции</h2>' + myStations().map(st => `<div class="ship${ui.sel.kind === 'station' && ui.sel.id === st.id ? ' sel' : ''}" data-st="${st.id}">
      <div class="row"><b class="grow">◇ ${esc(st.name)}</b><span class="muted">${st.towedBy ? 'на буксире' : st.at ? esc(nameOf(st.at)) : 'в космосе'}</span></div>
      <div class="row"><span class="muted">склад</span>${bar(st.st.cargoCap ? storeTotal(st) / st.st.cargoCap : 0)}<span class="muted">топл.</span>${bar(st.st.fuelCap ? st.fuel / st.st.fuelCap : 0, 'fuel')}</div></div>`).join('');
  h += '<h2>Корабли</h2>';
  if (!myShips().length) h += '<div class="help">Кораблей пока нет. Постройте их на верфи.</div>';
  h += myShips().map(s => {
    const load = cargoTotal(s), g = groupOf(s);
    return `<div class="ship${ui.sel.kind === 'ship' && ui.sel.id === s.id ? ' sel' : ''}" data-ship="${s.id}">
      <div class="row"><span class="dot" style="background:${groupColor(s)}"></span><b class="grow">${esc(s.name)}</b><span class="muted">${g ? esc(g.name) : 'без группы'}</span></div>
      <div class="${s.broken || s.status === 'Нет топлива!' ? 'err' : 'muted'}">${esc(s.status)}</div>${s.st.warship ? `<div class="muted">⚔ броня ${s.st.armor} · рельсы ${s.st.rail} · зенитки ${s.st.flak}${s.st.hangF + s.st.hangB ? ` · истр. ${s.air.F}/${s.st.hangF}, бомб. ${s.air.B}/${s.st.hangB}` : ''}${s.hullDmg > 0.01 ? ` · повреждён на ${Math.round(s.hullDmg * 100)}%` : ''}</div>` : ''}
      <div class="row">${bar(s.fuel / s.st.fuelCap, 'fuel')}${bar(s.st.cargoCap ? load / s.st.cargoCap : 0)}${bar(shipCond(s) / 100, anyFailed(s) ? 'bad' : shipCond(s) < 40 ? 'warn' : 'good')}</div></div>`;
  }).join('');
  p.innerHTML = h + '<div class="help">Полосы корабля: топливо (синяя), груз (оранжевая), состояние (зелёная).</div>';
}
export function refreshLog() {
  $('p-log').innerHTML = state.log.slice(0, 80).map(l => `<div><span class="t">${fmtDate(l.t).slice(0, 10)}</span>${esc(l.msg)}</div>`).join('') || '<div class="help">Пока тихо.</div>';
}

document.addEventListener('keydown', e => { if (e.key === 'Shift') ui.shift = true; });
document.addEventListener('keyup', e => { if (e.key === 'Shift') ui.shift = false; });
window.addEventListener('blur', () => { ui.shift = false; });
