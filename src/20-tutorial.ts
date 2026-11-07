// @ts-nocheck
// Первые шаги: плавающая карточка с целями, которые считаются по реальному состоянию игры.
import { state } from './01-data.ts';

const STEPS = [
  ['Запустить время (▶ или пробел)', s => s.t > 0],
  ['Построить «Строительное бюро» (Планеты → Постройки): без него стройка медленная', s => (s.bld.cbureau || 0) > 0],
  ['Выбрать исследование (вкладка «Наука»): технологии с «Развилкой» исключают друг друга', s => Object.keys(s.tech || {}).length > 0 || Object.values(s.research || {}).some(Boolean)],
  ['Спроектировать боевой корабль с радаром, сканером и СУО (вкладка «Верфь»)', s => (s.designs || []).some(d => d.parts && Object.keys(d.parts).some(k => k.startsWith('fcs')) && Object.keys(d.parts).some(k => k.startsWith('radar')))],
  ['Построить боевой корабль: налёт придёт на Землю', s => (s.ships || []).some(x => x.st && x.st.warship)],
  ['Основать колонию (Планеты → Колонии)', s => Object.keys(s.cols || {}).length > 1],
  ['Заказать груз на колонию (вкладка «Грузы»)', s => !!(s.freight && s.freight.n > 0)],
  ['Построить здание в колонии (Колонии → Здания колонии)', s => Object.values(s.cols || {}).some(c => c.bld && Object.keys(c.bld).length)],
];
let el = null;
function render() {
  if (!state || !state.bld) return;
  if (state.tutOff) { if (el) el.hidden = true; return; }
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
