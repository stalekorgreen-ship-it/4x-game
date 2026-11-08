// @ts-nocheck
// Тест нагрузки: десятки/сотни ИИ-систем (по 20 корпораций, сотни кораблей, конвои, экономика) + параллельные бои вне поля зрения игрока.
// Каждая система — отдельное состояние игры; считаем их по очереди, не давая зависнуть интерфейсу, и замеряем стоимость игрового дня.
import { state, setState, newGame } from './01-data.ts';
import { advance } from './04-engine.ts';
import { matureSystem, duelScenario, MIXNAMES } from './16-demo.ts';
import { makeBattle } from './05-battle.ts';
import { hooks } from './00-hooks.ts';

const tick = () => new Promise(r => setTimeout(r, 0));
const pct = (a, p) => { if (!a.length) return 0; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))]; };
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
let abort = false, running = false;

export async function runStress(o, say) {
  const orig = state, states = [], t0 = performance.now(); let ships = 0, errs = 0, corps = 0;
  let last = performance.now(), gaps = [], raf = 0; const mon = t => { gaps.push(t - last); last = t; raf = requestAnimationFrame(mon); }; raf = requestAnimationFrame(mon);
  const heap = () => (performance.memory ? Math.round(performance.memory.usedJSHeapSize / 1048576) : null);
  const h0 = heap(), onLog0 = hooks.onLog; hooks.onLog = null; // события фоновых систем не показываем игроку
  try {
    for (let i = 0; i < o.systems && !abort; i++) {
      newGame(); matureSystem(o.per, o.settle, 1, 2); states.push(state); ships += state.ships.length; corps += (state.corps || []).length;
      say(`Создаю системы: ${i + 1}/${o.systems} · корпораций ${corps} · кораблей ${ships}`); await tick();
    }
    const tBuild = performance.now() - t0, hBuild = heap();
    const mkBattle = () => { const b = makeBattle(), cfg = duelScenario(MIXNAMES[Math.floor(Math.random() * MIXNAMES.length)], MIXNAMES[Math.floor(Math.random() * MIXNAMES.length)], 10 + Math.floor(Math.random() * 20)); b.beginBg(cfg); return b; };
    let bats = []; for (let i = 0; i < o.battles; i++) bats.push(mkBattle());
    const dayMs = [], sysMs = [], batMs = []; let batDone = 0;
    for (let d = 0; d < o.days && !abort; d++) {
      const ds = performance.now(); let acc = performance.now();
      for (const st of states) {
        setState(st); const a = performance.now();
        try { advance(1); } catch (e) { errs++; if (errs < 3) console.error('stress', e); }
        sysMs.push(performance.now() - a);
        if (performance.now() - acc > 12) { await tick(); acc = performance.now(); }
      }
      for (let i = 0; i < bats.length; i++) {
        const a = performance.now();
        try { for (let k = 0; k < 12; k++) bats[i].tickN(5); } catch (e) { errs++; if (errs < 3) console.error('stress battle', e); }
        batMs.push((performance.now() - a) / 12);
        if (bats[i].isDone()) { batDone++; bats[i] = mkBattle(); }
      }
      dayMs.push(performance.now() - ds); say(`Считаю: день ${d + 1}/${o.days} · ${Math.round(dayMs[dayMs.length - 1])} мс на день всего мира`); await tick();
    }
    const hEnd = heap();
    return {systems: states.length, corps, ships, tBuild, mem0: h0, memBuild: hBuild, memEnd: hEnd, days: dayMs.length, dayAvg: avg(dayMs), dayP95: pct(dayMs, .95), dayMax: Math.max(0, ...dayMs), sysAvg: avg(sysMs), sysP95: pct(sysMs, .95), batAvg: avg(batMs), batP95: pct(batMs, .95), batDone, battles: o.battles, errs, gapP95: pct(gaps, .95), gapMax: Math.max(0, ...gaps), aborted: abort};
  } finally { cancelAnimationFrame(raf); setState(orig); hooks.onLog = onLog0; }
}

const fmt = (x, n = 1) => (Math.round(x * Math.pow(10, n)) / Math.pow(10, n)).toLocaleString('ru');
function report(r) {
  const sp = (k) => r.dayAvg > 0 ? fmt(1000 / r.dayAvg * k, 1) : '∞';
  const ok = r.dayAvg < 250 && r.gapP95 < 60, mid = r.dayAvg < 800;
  return `<table class="mono" style="width:100%"><tr><td>Систем / корпораций / кораблей</td><td>${r.systems} / ${r.corps} / ${r.ships}</td></tr>
  <tr><td>Создание мира</td><td>${fmt(r.tBuild / 1000)} с</td></tr>
  <tr><td>Память (JS-куча)</td><td>${r.mem0 != null ? `${r.mem0} → ${r.memEnd} МБ` : 'нет данных'}</td></tr>
  <tr><td>Игровой день для всего ИИ-мира</td><td>среднее ${fmt(r.dayAvg, 0)} мс · 95% ≤ ${fmt(r.dayP95, 0)} мс · худший ${fmt(r.dayMax, 0)} мс</td></tr>
  <tr><td>Одна система за день</td><td>среднее ${fmt(r.sysAvg, 2)} мс · 95% ≤ ${fmt(r.sysP95, 2)} мс</td></tr>
  <tr><td>Бои параллельно (${r.battles}, по 10–29 кораблей на сторону)</td><td>шаг боя ${fmt(r.batAvg, 2)} мс · 95% ≤ ${fmt(r.batP95, 2)} мс · завершено боёв ${r.batDone}</td></tr>
  <tr><td>Плавность интерфейса при расчёте</td><td>кадр 95% ≤ ${fmt(r.gapP95, 0)} мс · худший ${fmt(r.gapMax, 0)} мс</td></tr>
  <tr><td>Скорость времени при полной загрузке ядра</td><td>до ${sp(1)} дн/с (при 50% ядра: ${sp(.5)} дн/с)</td></tr>
  <tr><td>Ошибок в расчёте</td><td>${r.errs}</td></tr></table>
  <div class="${ok ? '' : 'warn'}" style="margin-top:6px"><b>${ok ? 'Игра справляется: мир такого размера тянется на обычных скоростях.' : mid ? 'Тяжеловато: на скоростях выше ×1 день/с будут подтормаживания, нужен LOD/вынос в Worker.' : 'Слишком тяжело для одного потока: мир такого размера нужно считать реже, упрощать далёкие системы или переносить в Web Worker.'}</b></div>`;
}

export function stressInit(p) {
  if (document.getElementById('st-box')) return;
  p.insertAdjacentHTML('beforeend', `<div class="box" id="st-box"><h2>Тест нагрузки</h2><div class="help">Создаёт много ИИ-систем (в каждой 20 корпораций, корабли, конвои, экономика) и считает их вместе с несколькими боями параллельно, пока вы ничего этого не видите. Показывает, сколько стоит игровой день и не лагает ли интерфейс. Ваша текущая игра не затрагивается.</div>
    <div class="row"><label>Систем <input type="number" id="st-sys" value="100" min="1" max="300" style="width:70px"></label><label>Кораблей на корпорацию <input type="number" id="st-per" value="10" min="1" max="100" style="width:70px"></label><label>Боёв параллельно <input type="number" id="st-bat" value="8" min="0" max="40" style="width:60px"></label><label>Игровых дней <input type="number" id="st-days" value="20" min="1" max="365" style="width:60px"></label></div>
    <div class="row"><button class="btn on" id="st-go">Запустить тест</button><button class="btn" id="st-stop" hidden>Остановить</button></div><div class="help" id="st-msg"></div><div id="st-res"></div></div>`);
  p.addEventListener('click', async e => {
    if (e.target.id === 'st-stop') { abort = true; return; }
    if (e.target.id !== 'st-go' || running) return;
    running = true; abort = false; const g = id => +document.getElementById(id).value, go = e.target, stop = document.getElementById('st-stop'); go.disabled = true; stop.hidden = false;
    const msg = document.getElementById('st-msg'), res = document.getElementById('st-res'); res.innerHTML = '';
    try { const r = await runStress({systems: g('st-sys'), per: g('st-per'), battles: g('st-bat'), days: g('st-days'), settle: 24}, t => { msg.textContent = t; }); msg.textContent = r.aborted ? 'Остановлено.' : 'Готово.'; res.innerHTML = report(r); console.log('STRESS', r); window.__stress = r; }
    catch (err) { msg.textContent = 'Ошибка: ' + err.message; console.error(err); }
    running = false; go.disabled = false; stop.hidden = true;
  });
}
hooks.stressInit = stressInit;
