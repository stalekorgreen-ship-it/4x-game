// @ts-nocheck
// Фоновая нагрузка: пока игрок обычно играет, «за кадром» считаются десятки ИИ-систем (по 20 корпораций, корабли, конвои, экономика)
// и параллельные бои. Считается прямо в кадре игры на той же скорости времени — оверлей показывает FPS, лаги и реальную скорость хода.
import { state, setState, newGame } from './01-data.ts';
import { advance } from './04-engine.ts';
import { matureSystem, duelScenario, MIXNAMES } from './16-demo.ts';
import { makeBattle } from './05-battle.ts';
import { hooks } from './00-hooks.ts';

const BUD = 9; // мс на кадр под фон
const bg = { pend: [], need: 0, done: 0, rr: 0, rb: 0, on: false, building: false, states: [], bats: [], want: 0, json: null, o: null, gaps: [], last: 0, bgMs: [], dSum: 0, tSum: 0, batDone: 0, errs: 0, ov: null, nextUi: 0, ships: 0, corps: 0, reqD: 0 };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const mkBattle = () => { const b = makeBattle(), r = () => MIXNAMES[Math.floor(Math.random() * MIXNAMES.length)]; b.beginBg(duelScenario(r(), r(), 10 + Math.floor(Math.random() * 20))); return b; };

function overlay() {
  if (bg.ov) return bg.ov;
  const d = document.createElement('div'); d.id = 'st-ov';
  d.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;background:rgba(8,12,20,.88);border:1px solid #3a4a66;border-radius:6px;padding:6px 9px;font:12px/1.45 ui-monospace,Consolas,monospace;color:#cfe0ff;pointer-events:none;white-space:pre';
  document.body.appendChild(d); return bg.ov = d;
}
function paint() {
  const g = bg.gaps, fps = g.length ? 1000 / avg(g) : 0, p95 = pct(g, .95), mx = Math.max(0, ...g), cost = avg(bg.bgMs);
  const act = bg.tSum > 0 ? bg.dSum / bg.tSum : 0, col = fps >= 50 ? '#7dffb0' : fps >= 30 ? '#ffd36b' : '#ff7b7b';
  overlay().innerHTML = `<b>ФОНОВАЯ НАГРУЗКА</b>${bg.building ? '  (создаю мир…)' : ''}\n<span style="color:${col}">FPS ${fps.toFixed(0)}</span> · кадр 95% ${p95.toFixed(0)} мс · худший ${mx.toFixed(0)} мс\nИИ-систем ${bg.states.length}/${bg.want} · корпораций ${bg.corps} · кораблей ${bg.ships}\nбоёв ${bg.bats.length} (завершено ${bg.batDone}) · ошибок ${bg.errs}\nфон ест ${cost.toFixed(1)} мс/кадр\nскорость игры ${bg.reqD.toFixed(2)} дн/с · фон успевает считать ${bg.need > 0 ? Math.min(100, 100 * bg.done / bg.need).toFixed(0) : 100}% (бюджет ${BUD} мс/кадр)`;
}

export function bgStart(o) {
  if (bg.on) return; bg.on = true; bg.o = o; bg.want = o.systems; bg.states = []; bg.bats = []; bg.gaps = []; bg.bgMs = []; bg.pend = []; bg.need = bg.done = 0; bg.dSum = bg.tSum = bg.batDone = bg.errs = bg.ships = bg.corps = 0; bg.last = 0; bg.building = true; bg.json = null;
  paint(); setBtn();
  setTimeout(() => { // один тяжёлый шаблон (≈1 с), остальные системы — копии, добавляются по несколько штук за кадр
    if (!bg.on) return; const orig = state, onLog0 = hooks.onLog; hooks.onLog = null;
    try { newGame(); matureSystem(o.per, 24, 1, 2); bg.json = JSON.stringify(state); } catch (e) { console.error('stress build', e); bg.errs++; }
    finally { setState(orig); hooks.onLog = onLog0; }
    for (let i = 0; i < o.battles; i++) bg.bats.push(mkBattle());
  }, 60);
}
export function bgStop() { bg.on = false; bg.states = []; bg.bats = []; bg.json = null; if (bg.ov) { bg.ov.remove(); bg.ov = null; } setBtn(); }

// вызывается из кадра игры после хода основной системы; days — сколько игровых суток прошло за кадр
export function bgStep(days, dt, reqDays) {
  if (!bg.on) return; const now = performance.now(); if (bg.last) { bg.gaps.push(now - bg.last); if (bg.gaps.length > 180) bg.gaps.shift() } bg.last = now;
  bg.reqD = reqDays; bg.dSum += days; bg.tSum += dt; if (bg.tSum > 6) { bg.dSum *= .5; bg.tSum *= .5 } if (bg.need > 2e3) { bg.need *= .5; bg.done *= .5 }
  const t0 = performance.now(), orig = state, onLog0 = hooks.onLog; hooks.onLog = null;
  try {
    if (bg.json) { const a = performance.now(); while (bg.states.length < bg.want && performance.now() - a < 5) { const st = JSON.parse(bg.json); bg.states.push(st); bg.ships += st.ships.length; bg.corps += (st.corps || []).length } if (bg.states.length >= bg.want) bg.building = false }
    // бюджет кадра: системы считаются по кругу, пока не выйдет время; недосчитанные сутки копятся и догоняются (фон отстаёт, но игра не виснет)
    const n = bg.states.length; while (bg.pend.length < n) bg.pend.push(0);
    for (let i = 0; i < n; i++) bg.pend[i] = Math.min(20, bg.pend[i] + (days > 0 ? days : 0));
    if (days > 0) bg.need += days * n;
    const tEnd = t0 + BUD; let k = 0; // далёкие системы считаются крупными шагами (сутки), а не 48 раз в сутки
    while (k < n && performance.now() < tEnd) { const i = bg.rr = (bg.rr + 1) % n; k++; if (bg.pend[i] < 1) continue; const d = Math.min(5, bg.pend[i]); setState(bg.states[i]); try { advance(d, 1) } catch (e) { bg.errs++; if (bg.errs < 3) console.error('stress', e) } bg.pend[i] -= d; bg.done += d }
    setState(orig);
    const nb = bg.bats.length; for (let j = 0; j < nb; j++) { const i = bg.rb = (bg.rb + 1) % nb; if (j > 0 && performance.now() > tEnd + BUD * .6) break; try { bg.bats[i].tickN(2) } catch (e) { bg.errs++; if (bg.errs < 3) console.error('stress battle', e) } if (bg.bats[i].isDone()) { bg.batDone++; bg.bats[i] = mkBattle() } }
  } finally { setState(orig); hooks.onLog = onLog0 }
  bg.bgMs.push(performance.now() - t0); if (bg.bgMs.length > 120) bg.bgMs.shift();
  if (now > bg.nextUi) { bg.nextUi = now + 400; paint() }
}

let btn = null;
function setBtn() { if (btn) { btn.textContent = bg.on ? 'Нагрузка: ВКЛ' : 'Нагрузка: выкл'; btn.classList.toggle('on', bg.on) } const p = document.getElementById('st-go'); if (p) p.textContent = bg.on ? 'Выключить фоновую нагрузку' : 'Включить фоновую нагрузку' }
const opts = () => { const g = (id, d) => { const e = document.getElementById(id); return e ? +e.value || d : d }; return { systems: g('st-sys', 100), per: g('st-per', 10), battles: g('st-bat', 8) } };
const toggle = () => bg.on ? bgStop() : bgStart(opts());

export function stressInit(p) {
  if (!btn) { btn = document.createElement('button'); btn.className = 'btn'; btn.title = 'Фоновая нагрузка: ИИ-системы и бои считаются за кадром, пока вы играете'; btn.onclick = toggle; const top = document.getElementById('top'); if (top) top.appendChild(btn); setBtn() }
  if (document.getElementById('st-box')) return;
  p.insertAdjacentHTML('beforeend', `<div class="box" id="st-box"><h2>Фоновая нагрузка</h2><div class="help">Пока вы играете в своей системе, «за кадром» считаются ИИ-системы (по 20 корпораций, корабли, конвои, экономика) и параллельные бои. Слева внизу показаны FPS, лаги и реальная скорость времени. Кнопка есть и в шапке. Меняйте скорость времени — смотрите, где начинаются лаги.</div>
    <div class="row"><label>Систем <input type="number" id="st-sys" value="100" min="1" max="300" style="width:70px"></label><label>Кораблей на корпорацию <input type="number" id="st-per" value="10" min="1" max="100" style="width:70px"></label><label>Боёв параллельно <input type="number" id="st-bat" value="8" min="0" max="40" style="width:60px"></label></div>
    <div class="row"><button class="btn on" id="st-go">Включить фоновую нагрузку</button></div></div>`);
  document.getElementById('st-go').onclick = toggle; setBtn();
}
const mkBtn = n => { if (btn) return; const top = document.getElementById('top'); if (!top) { if (n < 40) setTimeout(() => mkBtn(n + 1), 250); return } btn = document.createElement('button'); btn.className = 'btn'; btn.title = 'Фоновая нагрузка: ИИ-системы и бои считаются за кадром, пока вы играете'; btn.onclick = toggle; top.appendChild(btn); setBtn() };
setTimeout(() => mkBtn(0), 500);
hooks.stressInit = stressInit; hooks.bgStep = bgStep;
