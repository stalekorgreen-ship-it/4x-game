// @ts-nocheck
// Первые шаги: плавающая карточка с целями, которые считаются по реальному состоянию игры.
import { state } from './01-data.ts';

const STEPS = [
  ['Запустить время (▶ или пробел)', s => s.t > 0],
  ['Посмотреть «Требует внимания» справа на карте: Земле не хватает лекарств, электроники и руды', s => s.t > 30],
  ['Поднять «Госинвестиции в экономику» (Государство → Законы)', s => !!(s.laws && s.laws.inv > 3)],
  ['Построить госзаводы или шахты (Планеты → Постройки → Экономические постройки)', s => (s.econ || []).length > 0 || (s.labs || 0) > 0],
  ['Выбрать исследования (вкладка «Наука»)', s => Object.keys(s.tech || {}).length > 0 || Object.values(s.research || {}).some(Boolean)],
  ['Изучить «Орбитальные верфи» и построить верфь', s => (s.bld.shipyard || 0) > 0],
  ['Отправить поселенцев (Планеты → Колонии)', s => Object.keys(s.cols || {}).length > 1],
  ['Дождаться первой корпорации (около 2035 года)', s => (s.corps || []).length > 0],
];
let el = null;
function render() {
  if (!state || !state.bld) return;
  if (state.tutOff || state.demo) { if (el) el.hidden = true; return; }
  if (!el) {
    el = document.createElement('div'); el.id = 'tut';
    el.style.cssText = 'position:fixed;left:16px;bottom:16px;z-index:20;width:300px;max-width:calc(100vw - 32px);background:var(--panel,#121a26);border:1px solid var(--line,#2b3950);border-radius:8px;padding:10px 12px;font-size:12px;box-shadow:0 6px 24px #0008';
    el.addEventListener('click', e => { const a = e.target.dataset && e.target.dataset.a; if (a === 'off') { state.tutOff = true; el.hidden = true; } if (a === 'min') { state.tutMin = !state.tutMin; render(); } });
    document.body.appendChild(el);
  }
  el.hidden = false;
  const done = STEPS.map(([, f]) => { try { return !!f(state); } catch (e) { return false; } }), n = done.filter(Boolean).length;
  const rd = state.raid && !state.raid.active ? Math.max(0, Math.round(state.raid.eta - state.t)) : null;
  el.innerHTML = `<div style="display:flex;gap:6px;align-items:center"><b style="flex:1">Первые шаги ${n}/${STEPS.length}</b><button class="btn sm" data-a="min">${state.tutMin ? '▢' : '–'}</button><button class="btn sm" data-a="off">×</button></div>` +
    (state.tutMin ? '' : (rd != null ? `<div class="muted" style="margin:4px 0">До налёта на Землю ~${rd} сут</div>` : '') + STEPS.map(([t], i) => `<div style="opacity:${done[i] ? .45 : 1};margin:3px 0">${done[i] ? '✔' : '○'} ${t}</div>`).join(''));
  if (n === STEPS.length) state.tutOff = true;
}
setInterval(render, 1500);
