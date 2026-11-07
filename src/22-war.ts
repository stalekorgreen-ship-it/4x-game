// @ts-nocheck
// Глобальная война: флоты двух сторон на карте системы. Где флоты сходятся — там идёт настоящий бой (свой экземпляр движка).
// Бой привязан к месту на карте: рядом планета — планета рядом, пояс — поле астероидов, остальное небо — настоящие направления на тела.
import { state, BODIES, BODY, objPos, log } from './01-data.ts';
import { makeBattle, Battles } from './05-battle.ts';
import { ui, cx, W, H, w2s, s2w, $, AU_KM, setTilt } from './08-map-ui.ts';
import { warFleet, warStrength, rockField } from './16-demo.ts';
import { hooks } from './00-hooks.ts';

const R = (a, b) => a + Math.random() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), TAU = Math.PI * 2;
const CONTACT = 0.012, JOIN = 0.03; // а.е.: контакт флотов и подключение к чужому бою
const BATTLE_K = 1.6 / 1500 * AU_KM; // масштаб «влёт в бой» (множитель на min(W,H))
// физические размеры тел (км) и цвета для неба боя
const BODY_KM = {sun: 696000, venus: 6052, earth: 6371, mars: 3390, luna: 1737, phobos: 11, deimos: 6};
const BODY_COL = {sun: '#fff1c0', venus: '#d9b97a', earth: '#4f86d6', mars: '#c2663f', luna: '#b9b6ae'};
const SIDE_COL = ['#5aa9ff', '#ff6a5e'];

export const War: any = {active: false, fleets: [], battles: [], sel: null, minPerSec: 10, auto: false, paused: false, msg: '', camAnim: null, t: 0, nextAi: 0, log: []};
let uid = 1, ui_el: HTMLElement | null = null, uiT = 0;

const wlog = (s: string) => { War.log.unshift(s); if (War.log.length > 6) War.log.pop(); War.msg = s; };
const fstr = (f: any) => Math.round(warStrength(f.specs) * 10) / 10;
const fcnt = (f: any) => f.specs.length;
const dist = (a: any, b: any) => Math.hypot(a.x - b.x, a.y - b.y);

/* ---------- старт ---------- */
function place(side: number, i: number, n: number) {
  // свои — вокруг внутренних тел, чужие — на дальних рубежах
  const homes = side === 0 ? ['earth', 'luna', 'mars', 'venus', 'phobos'] : ['ceres', 'vesta', 'hygiea', 'sylvia', 'davida'];
  const id = homes[i % homes.length], p = objPos(id, state.t), a = R(0, TAU), r = R(.02, .06);
  return {id, x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r};
}
export function startWar(perSide?: number) {
  if (War.active) return;
  const n = perSide || RI(3, 5);
  War.fleets = []; War.battles = []; War.sel = null; War.auto = false; War.paused = false; War.t = 0; War.log = []; War.msg = '';
  const NAMES = [['Первый', 'Второй', 'Третий', 'Четвёртый', 'Пятый'], ['Рейдеры-А', 'Рейдеры-Б', 'Рейдеры-В', 'Рейдеры-Г', 'Рейдеры-Д']];
  for (let side = 0; side < 2; side++) for (let i = 0; i < n; i++) {
    const pl = place(side, i, n), size = RI(8, 22), specs = warFleet(size, side * 10 + i, 1);
    War.fleets.push({id: uid++, side, name: (side ? '' : 'Флот ') + NAMES[side][i], specs, x: pl.x, y: pl.y, home: pl.id, dest: null, tgt: null, state: 'idle', battle: null, spd: R(.3, .42), cool: 0, trail: []});
  }
  state.demo = true; state.paused = false; War.active = true; ui.bfollow = false; ui.bship = false; setTilt(0);
  fitAll(); buildUi(); wlog('Война началась. Выберите свой флот и кликните точку на карте или вражеский флот.');
  log('Глобальная война: ' + n + ' флотов у каждой стороны.');
}
export function stopWar() {
  for (const b of War.battles) { b.inst.unview(); }
  const cur = Battles.cur; if (cur) { cur.hide && cur.hide(); }
  Battles.cur = Battles.main; War.active = false; War.fleets = []; War.battles = []; state.demo = false;
  if (ui_el) { ui_el.remove(); ui_el = null; }
}
function fitAll() { let mx = 0.5; for (const f of War.fleets) mx = Math.max(mx, Math.hypot(f.x, f.y)); ui.follow = false; ui.cam.x = 0; ui.cam.y = 0; ui.cam.k = Math.min(W, H) / 2 / (mx * 1.15); }

/* ---------- место боя на карте ---------- */
function locInfo(pos: any) {
  const sunD = Math.hypot(pos.x, pos.y);
  let near: any = null, nd = 1e9;
  for (const b of BODIES) { if (b.kind === 'sun' || b.kind === 'lagrange' || b.comet) continue; const p = objPos(b.id, state.t), d = Math.hypot(p.x - pos.x, p.y - pos.y); if (d < nd) { nd = d; near = b; } }
  // небо: настоящие направления и угловые размеры тел
  const sky: any[] = [];
  for (const b of BODIES) {
    const km = BODY_KM[b.id]; if (!km) continue;
    const p = objPos(b.id, state.t), dx = (p.x - pos.x) * AU_KM, dy = (p.y - pos.y) * AU_KM, d = Math.hypot(dx, dy);
    if (d < 1) continue;
    sky.push({id: b.id, name: b.name, dx: dx / d, dy: dy / d, dist: d, r: km, col: BODY_COL[b.id] || '#aaa', sun: b.kind === 'sun', ang: Math.asin(Math.min(1, km / d))});
  }
  let envList: any[] = [], text = 'открытый космос', kind = 'open';
  if (sunD > 2.15 && sunD < 3.6) { // пояс астероидов
    envList = rockField(95, 0, 0, 260, 200, .5, 4.5).concat(rockField(6, 0, 0, 120, 90, 5, 8)); text = 'пояс астероидов'; kind = 'belt';
  } else if (near && nd < 0.012 && !(near.kind === 'ast' || near.kind === 'moon' && BODY_KM[near.id] < 100)) {
    const a = R(0, TAU); envList = [{t: 'planet', x: Math.cos(a) * 130, y: Math.sin(a) * 130, r: R(34, 44)}]; text = 'у планеты: ' + near.name; kind = 'planet';
  } else if (near && nd < 0.01 && near.kind === 'ast') { envList = rockField(40, 0, 0, 160, 120, .4, 3); text = 'у астероида ' + near.name; kind = 'belt'; }
  return {envList, text, kind, sky, near, nd};
}

/* ---------- бой ---------- */
function startBattle(a: any, b: any) {
  const pos = {x: (a.x + b.x) / 2, y: (a.y + b.y) / 2}, loc = locInfo(pos), inst = makeBattle();
  const ang = (f: any) => Math.atan2(f.y - pos.y, f.x - pos.x) + R(-.2, .2), late: any[] = [];
  const add = (f: any, side: number) => { const an = f === a ? ang(a) : ang(b); for (const sp of f.specs) late.push({t: R(0, 18), side, spec: sp, edge: R(330, 450), ang: an + R(-.12, .12)}); };
  add(a, 0); add(b, 1); late.sort((x, y) => x.t - y.t);
  const cfg = {title: `Бой: ${a.name} против ${b.name} (${loc.text})`, fleets: [[], []], late, demo: true, envList: loc.envList, maxT: 7200, names: [a.name, b.name], sky: loc.sky, where: loc.text, onEnd: () => {}};
  inst.beginBg(cfg); inst.setBSpeed(30);
  const bt = {id: uid++, inst, pos, fleets: [a, b], loc, done: false, t0: War.t};
  a.state = b.state = 'fight'; a.battle = b.battle = bt; a.dest = b.dest = null; a.tgt = b.tgt = null;
  War.battles.push(bt); wlog(`⚔ ${cfg.title}`);
  return bt;
}
function joinBattle(f: any, bt: any) {
  const side = f.side, ang = Math.atan2(f.y - bt.pos.y, f.x - bt.pos.x);
  for (const sp of f.specs) bt.inst.addLate({t: R(0, 25), side, spec: sp, edge: R(900, 1400), ang: ang + R(-.12, .12)});
  f.state = 'fight'; f.battle = bt; f.dest = null; f.tgt = null; bt.fleets.push(f); wlog(`${f.name} вступает в бой`);
}
function endBattle(bt: any) {
  bt.done = true; const ships = bt.inst.ships();
  // уцелевшие корабли возвращаются в свои флоты с накопленным повреждением, захваченные переходят к победителю
  const keep = new Map<any, any[]>(); for (const f of bt.fleets) keep.set(f, []);
  const owner = (sp: any) => bt.fleets.find((f: any) => f.specs.includes(sp));
  for (const s of ships) {
    const sp = s.spec, f = owner(sp); if (!f) continue;
    if (!(s.alive || s.esc)) continue;
    sp.dmg = Math.max(0, Math.min(.8, 1 - s.aliveN / s.total));
    let to = f; if (s.prize) { const w = bt.fleets.filter((q: any) => q.side === s.side).sort((x: any, y: any) => fcnt(y) - fcnt(x))[0]; if (w) to = w; }
    keep.get(to)!.push(sp);
  }
  for (const f of bt.fleets) {
    const n0 = fcnt(f); f.specs = keep.get(f)!; f.battle = null; f.state = 'idle';
    if (!f.specs.length) { f.state = 'dead'; wlog(`✖ ${f.name} уничтожен`); }
    else { wlog(`${f.name}: осталось ${fcnt(f)} из ${n0} кораблей`); f.cool = War.t + .25; }
  }
  // победитель остаётся, проигравшие отходят
  const alive = bt.fleets.filter((f: any) => f.state !== 'dead'), sides = new Set(alive.map((f: any) => f.side));
  if (sides.size > 1) for (const f of alive) { const foes = alive.filter((q: any) => q.side !== f.side); const c = foes[0]; if (c) { const dx = f.x - c.x, dy = f.y - c.y, d = Math.hypot(dx, dy) || 1; f.dest = {x: f.x + dx / d * .08, y: f.y + dy / d * .08}; f.state = 'move'; } }
  War.fleets = War.fleets.filter((f: any) => f.state !== 'dead');
  if (Battles.cur === bt.inst) { bt.inst.unview(); bt.inst.hide && bt.inst.hide(); Battles.cur = Battles.main; hooks.reset3d && hooks.reset3d(); }
  War.battles = War.battles.filter((q: any) => q !== bt);
  const left = [0, 1].map(s => War.fleets.filter((f: any) => f.side === s).length);
  if (!left[1] || !left[0]) wlog(left[0] ? '★ Победа: вражеские флоты уничтожены' : '☠ Поражение: ваши флоты уничтожены');
}

/* ---------- стратегический шаг ---------- */
function stepFleets(days: number) {
  for (const f of War.fleets) {
    if (f.state === 'fight') continue;
    if (f.tgt && f.tgt.state !== 'dead' && War.fleets.includes(f.tgt)) f.dest = {x: f.tgt.x, y: f.tgt.y}; else if (f.tgt) f.tgt = null;
    if (f.dest) {
      const dx = f.dest.x - f.x, dy = f.dest.y - f.y, d = Math.hypot(dx, dy), st = f.spd * days;
      if (d <= st) { f.x = f.dest.x; f.y = f.dest.y; if (!f.tgt) { f.dest = null; f.state = 'idle'; } } else { f.x += dx / d * st; f.y += dy / d * st; f.state = 'move'; f.hd = Math.atan2(dy, dx); }
    }
  }
  // контакты
  const fl = War.fleets;
  for (let i = 0; i < fl.length; i++) for (let j = i + 1; j < fl.length; j++) {
    const a = fl[i], b = fl[j]; if (a.side === b.side) continue;
    if (a.state === 'fight' && b.state === 'fight') continue;
    if (Math.max(a.cool || 0, b.cool || 0) > War.t) continue;
    if (dist(a, b) > CONTACT) continue;
    if (a.state !== 'fight' && b.state !== 'fight') startBattle(a.side === 0 ? a : b, a.side === 0 ? b : a);
  }
  // подход к идущему бою
  for (const f of fl) {
    if (f.state === 'fight' || f.cool > War.t) continue;
    for (const bt of War.battles) { if (dist(f, bt.pos) < JOIN && bt.fleets.some((q: any) => q.side !== f.side)) { joinBattle(f, bt); break; } }
  }
}
function ai() {
  const fl = War.fleets;
  for (const f of fl) {
    if (f.state === 'fight' || (f.side === 0 && !War.auto)) continue;
    const foes = fl.filter((o: any) => o.side !== f.side); if (!foes.length) continue;
    let best: any = null, bd = 1e9; for (const o of foes) { const d = dist(f, o); if (d < bd) { bd = d; best = o; } }
    const rs = fstr(f) / Math.max(.1, fstr(best));
    if (rs > .75) { f.tgt = best; f.state = 'move'; f.spd = Math.max(f.spd, .3); }
    else { f.tgt = null; const p = objPos(f.home, state.t); f.dest = {x: p.x, y: p.y}; f.state = 'move'; }
  }
}

/* ---------- кадр ---------- */
export function warFrame(dt: number) {
  if (!War.active) return;
  const days = War.paused ? 0 : dt * War.minPerSec / 1440;
  War.t += days; state.t += days;
  stepFleets(days);
  War.nextAi -= dt; if (War.nextAi <= 0) { War.nextAi = 4; ai(); }
  for (const bt of War.battles.slice()) { if (!War.paused) bt.inst.tickN(dt); if (bt.inst.isDone()) endBattle(bt); }
  // анимация камеры
  const ca = War.camAnim;
  if (ca) { const k = Math.min(1, dt * 3); ui.cam.x += (ca.x - ui.cam.x) * k; ui.cam.y += (ca.y - ui.cam.y) * k; ui.cam.k *= Math.pow(ca.k / ui.cam.k, k); if (Math.abs(Math.log(ca.k / ui.cam.k)) < .02 && Math.hypot(ca.x - ui.cam.x, ca.y - ui.cam.y) * ui.cam.k < 2) War.camAnim = null; }
  chooseView();
  if (Battles.cur && Battles.cur.isViewed && Battles.cur.isViewed() && Battles.cur.active()) Battles.cur.hud();
  uiT -= dt; if (uiT <= 0) { uiT = .4; refreshUi(); }
  const w = War.fleets.filter((f: any) => f.side === 0).length, e = War.fleets.filter((f: any) => f.side === 1).length;
  if ((!w || !e) && !War.over) { War.over = true; wlog(w ? '★ Победа: вражеских флотов не осталось' : '☠ Поражение: у вас не осталось флотов'); }
}
function chooseView() {
  // смотрим тот бой, на который наведена камера и к которому приблизились
  const kk = ui.cam.k / AU_KM; let best: any = null, bd = 1e9;
  for (const bt of War.battles) { const d = Math.hypot(bt.pos.x - ui.cam.x, bt.pos.y - ui.cam.y) * AU_KM; if (kk * 1500 >= 100 && d < 1500 && d < bd) { bd = d; best = bt; } }
  const cur = Battles.cur;
  if (best) {
    if (cur !== best.inst) { if (cur && cur !== Battles.main) cur.unview(); Battles.cur = best.inst; best.inst.view(); if (!War.tilted) { setTilt(30); War.tilted = true; } hooks.reset3d && hooks.reset3d(); }
  } else if (cur && cur !== Battles.main) { cur.unview(); cur.hide && cur.hide(); Battles.cur = Battles.main; hooks.reset3d && hooks.reset3d(); }
}

/* ---------- рисование на карте ---------- */
const mil = (n: number) => n >= 1e3 ? (n / 1e3).toFixed(1) + 'k' : String(Math.round(n));
export function warDraw() {
  if (!War.active) return;
  const kk = ui.cam.k / AU_KM, zoomIn = kk * 1500 >= 5;
  // бои
  for (const bt of War.battles) {
    const [bx, by] = w2s({x: bt.pos.x, y: bt.pos.y, z: 0});
    if (zoomIn) { bt.inst.draw(cx, bx, by, kk, 1); continue; }
    const pulse = 1 + .25 * Math.sin(performance.now() / 250);
    cx.strokeStyle = '#ff6a5e'; cx.lineWidth = 2; cx.beginPath(); cx.arc(bx, by, 11 * pulse, 0, 7); cx.stroke(); cx.lineWidth = 1;
    cx.fillStyle = '#ff6a5e'; cx.font = '12px system-ui'; cx.fillText('⚔ ' + bt.loc.text, bx + 16, by - 10);
  }
  if (zoomIn && War.battles.length) { /* в бою корабли рисует сам бой */ }
  // флоты
  cx.font = '11px system-ui';
  for (const f of War.fleets) {
    if (f.state === 'fight' && zoomIn) continue;
    const [x, y] = w2s({x: f.x, y: f.y, z: 0}), col = SIDE_COL[f.side];
    if (f.dest && f.state !== 'fight') { const [dx, dy] = w2s({x: f.dest.x, y: f.dest.y, z: 0}); cx.strokeStyle = col; cx.globalAlpha = .5; cx.setLineDash([4, 4]); cx.beginPath(); cx.moveTo(x, y); cx.lineTo(dx, dy); cx.stroke(); cx.setLineDash([]); cx.globalAlpha = 1; }
    if (zoomIn) continue; // при сильном приближении флот — это точка в бою; не рисуем значок
    const a = f.hd != null ? f.hd : (f.side ? Math.PI : 0), sz = 8 + Math.min(6, fcnt(f) * .3);
    cx.save(); cx.translate(x, y); cx.rotate(a); cx.fillStyle = col; cx.strokeStyle = '#0a0e15'; cx.lineWidth = 1.5;
    cx.beginPath(); cx.moveTo(sz, 0); cx.lineTo(-sz * .7, sz * .65); cx.lineTo(-sz * .35, 0); cx.lineTo(-sz * .7, -sz * .65); cx.closePath(); cx.fill(); cx.stroke(); cx.restore();
    if (War.sel === f) { cx.strokeStyle = '#fff'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(x, y, sz + 6, 0, 7); cx.stroke(); cx.lineWidth = 1; }
    cx.fillStyle = col; cx.fillText(`${f.name} · ${fcnt(f)}`, x + sz + 5, y + 4);
  }
}

/* ---------- ввод ---------- */
export function warClick(mx: number, my: number) {
  if (!War.active) return false;
  const kk = ui.cam.k / AU_KM, zoomIn = kk * 1500 >= 5;
  const cur = Battles.cur;
  if (zoomIn && cur !== Battles.main && cur.isViewed && cur.isViewed() && cur.pick(mx, my)) return true;
  // метки боёв
  if (!zoomIn) for (const bt of War.battles) { const [bx, by] = w2s({x: bt.pos.x, y: bt.pos.y, z: 0}); if (Math.hypot(bx - mx, by - my) < 16) { goBattle(bt); return true; } }
  if (zoomIn) return false;
  // флоты
  let hit: any = null, bd = 16; for (const f of War.fleets) { const [x, y] = w2s({x: f.x, y: f.y, z: 0}), d = Math.hypot(x - mx, y - my); if (d < bd) { bd = d; hit = f; } }
  if (hit) {
    if (hit.side === 0) { War.sel = hit; refreshUi(); return true; }
    if (War.sel && War.sel.side === 0 && War.sel.state !== 'fight') { War.sel.tgt = hit; War.sel.state = 'move'; wlog(`${War.sel.name} идёт в атаку на ${hit.name}`); return true; }
    return true;
  }
  if (War.sel && War.sel.side === 0 && War.sel.state !== 'fight') { const p = s2w(mx, my); War.sel.dest = {x: p.x, y: p.y}; War.sel.tgt = null; War.sel.state = 'move'; return true; }
  return false;
}
export function goBattle(bt: any) { War.camAnim = {x: bt.pos.x, y: bt.pos.y, k: Math.min(W, H) * BATTLE_K}; }
function goFleet(f: any) { War.camAnim = {x: f.x, y: f.y, k: Math.max(ui.cam.k, 60)}; }

/* ---------- панель ---------- */
function buildUi() {
  if (ui_el) ui_el.remove();
  const el = document.createElement('div'); ui_el = el; el.id = 'warui';
  el.style.cssText = 'position:fixed;left:16px;top:184px;z-index:45;width:min(300px,calc(100vw - 32px));max-height:40vh;overflow:auto;background:rgba(17,24,35,.94);border:1px solid #243247;border-radius:8px;padding:8px 10px;font:12px/1.35 system-ui;color:#d3dbe8';
  el.addEventListener('click', e => {
    const t = e.target as HTMLElement, a = t.dataset.a, id = +(t.dataset.id || 0);
    if (a === 'speed') War.minPerSec = +t.dataset.v; else if (a === 'pause') War.paused = !War.paused; else if (a === 'auto') War.auto = !War.auto;
    else if (a === 'exit') stopWar(); else if (a === 'fleet') { const f = War.fleets.find((q: any) => q.id === id); if (f) { if (f.side === 0) War.sel = f; goFleet(f); } }
    else if (a === 'battle') { const b = War.battles.find((q: any) => q.id === id); if (b) goBattle(b); } else if (a === 'fit') fitAll();
    else if (a === 'hold' && War.sel) { War.sel.dest = null; War.sel.tgt = null; War.sel.state = 'idle'; }
    refreshUi();
  });
  document.body.appendChild(el); refreshUi();
}
function refreshUi() {
  if (!ui_el) return;
  const row = (f: any) => `<div style="display:flex;gap:6px;align-items:center;padding:2px 0;${War.sel === f ? 'background:#17202e' : ''}"><span style="color:${SIDE_COL[f.side]}">●</span><a href="#" data-a="fleet" data-id="${f.id}" style="color:inherit;flex:1;text-decoration:none">${f.name} · ${fcnt(f)} кор. · сила ${fstr(f)}</a><span style="color:#7f90a8">${f.state === 'fight' ? 'бой' : f.state === 'move' ? (f.tgt ? 'атака' : 'в пути') : 'стоит'}</span></div>`;
  const sp = [[10, '×1'], [30, '×3'], [100, '×10'], [400, '×40']].map(([v, l]) => `<button class="btn${War.minPerSec === v ? ' on' : ''}" data-a="speed" data-v="${v}">${l}</button>`).join('');
  ui_el.innerHTML = `<div style="display:flex;gap:4px;flex-wrap:wrap;align-items:center"><b style="flex:1">Война · день ${War.t.toFixed(1)}</b><button class="btn${War.paused ? ' on' : ''}" data-a="pause">⏸</button>${sp}</div>
  <div style="margin:4px 0;color:#7f90a8">Свой флот (синий): выбрать и кликнуть точку или красный флот. Клик по ⚔ — перелёт в бой.</div>
  <div>${War.fleets.filter((f: any) => f.side === 0).map(row).join('')}</div><div style="margin-top:4px">${War.fleets.filter((f: any) => f.side === 1).map(row).join('')}</div>
  ${War.battles.length ? `<div style="margin-top:4px"><b>Бои:</b> ${War.battles.map((b: any) => `<a href="#" data-a="battle" data-id="${b.id}" style="color:#ff6a5e">⚔ ${b.loc.text}</a>`).join(' · ')}</div>` : ''}
  <div style="margin-top:4px;display:flex;gap:4px;flex-wrap:wrap"><button class="btn${War.auto ? ' on' : ''}" data-a="auto">Автопилот флотов</button><button class="btn" data-a="hold">Стоять</button><button class="btn" data-a="fit">Вся карта</button><button class="btn" data-a="exit">Выйти</button></div>
  <div style="margin-top:4px;color:#e3a94f">${War.log.map((l: string) => l).join('<br>')}</div>`;
}

hooks.startWar = startWar; hooks.warFrame = warFrame; hooks.warDraw = warDraw; hooks.warClick = warClick;
hooks.warActive = () => War.active;
