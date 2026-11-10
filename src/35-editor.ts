// @ts-nocheck
// Редактор (вкладка «Редактор»): 1) Данные — таблицы файлов data/*.json: добавить, скопировать, удалить запись, поменять поле, добавить поле;
// 2) Правила ИИ — конструктор «условия → действие» для корпораций и кораблей (data/ai.json, действуют сразу).
// Сохранение: Electron — в папку data рядом с exe; разработка — public/data. Большинство данных применяется после перезапуска игры.
import { DEFAULTS, fileModel, saveFile } from './00-gd.ts';
import { hooks } from './00-hooks.ts';
import { state, RES } from './01-data.ts';
import { GOODS } from './07-population.ts';
import { AI, CORP_P, SHIP_P, CORP_A, SHIP_A, OP_LIST, FOCI } from './34-ai.ts';
import { $, esc } from './08-map-ui.ts';
import { saveGame } from './04-engine.ts';

const FILES = {modules: 'Модули кораблей', buildings: 'Здания и стройка', goods: 'Товары', techs: 'Технологии', economy: 'Экономика', battle: 'Бой', regions: 'Регионы'};
const E = {file: 'modules', sec: null, model: null, del: {}, dirty: false, msg: '', q: ''};
const plain = v => v && typeof v === 'object' && !Array.isArray(v);
const clone = v => JSON.parse(JSON.stringify(v));
function load(f) { E.file = f; E.model = fileModel(f); E.del = {}; E.dirty = false; const ks = Object.keys(E.model).filter(k => k[0] !== '_'); if (!ks.includes(E.sec)) E.sec = ks[0]; }
// значение ячейки → текст и обратно
const isFlatObj = v => plain(v) && Object.values(v).every(x => x == null || typeof x !== 'object');
const isFlatArr = v => Array.isArray(v) && v.every(x => x == null || typeof x !== 'object');
function toText(v) { if (isFlatObj(v)) return Object.entries(v).map(([k, x]) => k + ': ' + x).join(', '); if (isFlatArr(v)) return v.join(', '); return JSON.stringify(v); }
const num = s => { const t = String(s).trim(); return t !== '' && !isNaN(+t) ? +t : t === 'true' ? true : t === 'false' ? false : t; };
function fromText(t, old) {
  if (isFlatObj(old) || (old == null && /:/.test(t) && !/^[\[{]/.test(t.trim()))) { const o = {}; for (const part of t.split(',')) { const m = part.split(':'); if (m.length >= 2 && m[0].trim()) o[m[0].trim()] = num(m.slice(1).join(':')); } return o; }
  if (isFlatArr(old)) return t.split(',').map(x => num(x)).filter(x => x !== '');
  if (typeof old === 'object' && old !== null) { try { return JSON.parse(t); } catch (e) { return old; } }
  return num(t);
}
function cell(path, v) {
  const p = esc(JSON.stringify(path));
  if (typeof v === 'boolean') return `<input type="checkbox" data-ep="${p}"${v ? ' checked' : ''}>`;
  if (typeof v === 'number') return `<input type="number" step="any" data-ep="${p}" value="${v}" style="width:80px">`;
  if (v == null) return '';
  const t = typeof v === 'string' ? v : toText(v);
  return `<input type="text" data-ep="${p}" value="${esc(t)}" style="width:${Math.min(420, Math.max(70, t.length * 6.5))}px">`;
}
function getAt(path) { let o = E.model; for (const k of path) o = o == null ? undefined : o[k]; return o; }
function setAt(path, v) { let o = E.model; for (let i = 0; i < path.length - 1; i++) o = o[path[i]]; o[path[path.length - 1]] = v; E.dirty = true; }

function sectionHtml() {
  const S = E.sec, V = E.model[S];
  if (plain(V) && Object.values(V).length && Object.values(V).every(plain)) { // записи: строка на запись
    const freq = {}; for (const r of Object.values(V)) for (const f in r) freq[f] = (freq[f] || 0) + 1;
    const cols = Object.keys(freq).sort((a, b) => freq[b] - freq[a]);
    const ids = Object.keys(V).filter(id => !E.q || (id + ' ' + JSON.stringify(V[id])).toLowerCase().includes(E.q.toLowerCase()));
    const rows = ids.map(id => `<tr><td><b>${esc(id)}</b></td>${cols.map(f => `<td>${f in V[id] ? cell([S, id, f], V[id][f]) : ''}</td>`).join('')}
      <td style="white-space:nowrap"><select data-eadd="${esc(id)}"><option value="">+ поле</option>${cols.filter(f => !(f in V[id])).map(f => `<option>${esc(f)}</option>`).join('')}<option value="*">своё…</option></select>
      <button class="btn sm" data-ecopy="${esc(id)}" title="Копировать запись">⧉</button><button class="btn sm" data-edel="${esc(id)}" title="Удалить запись">✕</button></td></tr>`).join('');
    return `<div class="row">Новая запись: id <input type="text" id="ed-nid" style="width:110px"> как <select id="ed-tpl"><option value="">пустая</option>${Object.keys(V).map(k => `<option>${esc(k)}</option>`).join('')}</select><button class="btn sm" id="ed-new">Добавить</button> · Поиск <input type="text" id="ed-q" value="${esc(E.q)}" style="width:140px"> · записей ${Object.keys(V).length}</div>
      <div data-sc style="overflow:auto;max-height:calc(100vh - 260px)"><table class="grid"><tr><th>id</th>${cols.map(c => `<th>${esc(c)}</th>`).join('')}<th></th></tr>${rows}</table></div>`;
  }
  if (Array.isArray(V)) return `<div data-sc style="overflow:auto"><table class="grid">${V.map((r, i) => `<tr><td class="n">${i + 1}</td>${plain(r) ? Object.keys(r).map(f => `<td title="${esc(f)}">${esc(f)}: ${cell([S, i, f], r[f])}</td>`).join('') : Array.isArray(r) ? r.map((x, j) => `<td>${cell([S, i, j], x)}</td>`).join('') : `<td>${cell([S, i], r)}</td>`}</tr>`).join('')}</table></div>`;
  if (plain(V)) return `<table class="grid">${Object.keys(V).map(k => `<tr><td><b>${esc(k)}</b></td><td>${cell([S, k], V[k])}</td></tr>`).join('')}</table>`;
  return `<table class="grid"><tr><td><b>${esc(S)}</b></td><td>${cell([S], V)}</td></tr></table>`;
}
export function renderEditor() {
  const p = $('p-edit'); if (!p) return; if (!E.model) load(E.file);
  const secs = Object.keys(E.model).filter(k => k[0] !== '_');
  p.innerHTML = `<div class="box"><div class="row"><b>Файл</b><select id="ed-file">${Object.keys(FILES).filter(f => DEFAULTS[f]).map(f => `<option value="${f}"${f === E.file ? ' selected' : ''}>${FILES[f]} (data/${f}.json)</option>`).join('')}</select>
    <b>Раздел</b><select id="ed-sec">${secs.map(s => `<option${s === E.sec ? ' selected' : ''}>${esc(s)}</option>`).join('')}</select>
    <span class="grow"></span>${E.dirty ? '<span class="warn">есть несохранённые правки</span>' : ''}<button class="btn sm" id="ed-save">Сохранить</button><button class="btn sm" id="ed-saver">Сохранить и перезапустить</button><button class="btn sm" id="ed-undo">Отменить правки</button></div>
    <div class="help">${esc(E.model._readme || '')} Объект (например, материалы) пишется как «fe: 10, cu: 4»; список — через запятую. Сохранённое применяется после перезапуска игры.</div>${E.msg ? `<div class="ok">${esc(E.msg)}</div>` : ''}</div>
    <div class="box">${sectionHtml()}</div>`;
}
async function doSave(restart) {
  const obj = clone(E.model); for (const s in E.del) for (const id of E.del[s]) if (obj[s] && !(id in obj[s])) obj[s][id] = null; // удалённые встроенные записи
  E.msg = await saveFile(E.file, obj); E.dirty = false; renderEditor();
  if (restart) { try { saveGame(); } catch (e) {} setTimeout(() => location.reload(), 300); }
}

/* ===== правила ИИ ===== */
const goodsOpts = sel => Object.keys(GOODS).map(g => `<option value="${g}"${g === sel ? ' selected' : ''}>${esc(GOODS[g].n)}</option>`).join('');
const oreOpts = sel => Object.keys(RES).filter(r => r !== 'spares').map(r => `<option value="${r}"${r === sel ? ' selected' : ''}>${esc(RES[r])}</option>`).join('');
const argSel = (kind, val, attr) => kind === 'g' ? `<select ${attr}>${goodsOpts(val)}</select>` : kind === 'r' ? `<select ${attr}>${oreOpts(val)}</select>` : kind === 'focus' ? `<select ${attr}>${Object.entries(FOCI).map(([k, n]) => `<option value="${k}"${k === val ? ' selected' : ''}>${n}</option>`).join('')}</select>` : '';
function ruleHtml(kind, r, i) {
  const PP = kind === 'corp' ? CORP_P : SHIP_P, AA = kind === 'corp' ? CORP_A : SHIP_A, at = (f, extra = '') => `data-rk="${kind}" data-ri="${i}" data-rf="${f}"${extra}`;
  const conds = (r.when || []).map((w, j) => `<div class="row">• <select ${at('p', ` data-rj="${j}"`)}>${Object.entries(PP).map(([k, x]) => `<option value="${k}"${k === w.p ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select>
    ${PP[w.p] && PP[w.p].arg ? argSel(PP[w.p].arg, w.a, at('a', ` data-rj="${j}"`)) : ''}<select ${at('op', ` data-rj="${j}"`)}>${OP_LIST.map(o => `<option${o === w.op ? ' selected' : ''}>${o}</option>`).join('')}</select>
    <input type="number" step="any" value="${w.v}" ${at('v', ` data-rj="${j}"`)} style="width:110px"><button class="btn sm" data-rdc="${kind}:${i}:${j}">✕</button></div>`).join('');
  const d = r.do || {}, A = AA[d.a] || {};
  return `<div class="box" style="${r.off ? 'opacity:.5' : ''}"><div class="row"><label><input type="checkbox" ${at('on')}${r.off ? '' : ' checked'}> вкл</label>
    <input type="text" value="${esc(r.name || '')}" placeholder="название" ${at('name')} style="width:220px"><span class="muted">сработало: ${r.fired || 0}</span><span class="grow"></span>
    ${kind === 'corp' ? `<label title="Если правило сработало — встроенный ИИ в этом месяце ничего не строит"><input type="checkbox" ${at('stop')}${r.stop === false ? '' : ' checked'}> вместо встроенного ИИ</label>
    <select ${at('only')}><option value="">все корпорации</option>${(state.corps || []).map(c => `<option${c.name === r.only ? ' selected' : ''}>${esc(c.name)}</option>`).join('')}</select>` : ''}
    <button class="btn sm" data-rmv="${kind}:${i}:-1">▲</button><button class="btn sm" data-rmv="${kind}:${i}:1">▼</button><button class="btn sm" data-rdel="${kind}:${i}">Удалить</button></div>
    <div class="help">ЕСЛИ (все условия):</div>${conds || '<div class="help">— условий нет: срабатывает всегда</div>'}<button class="btn sm" data-radd="${kind}:${i}">+ условие</button>
    <div class="row"><span class="help">ТО:</span><select ${at('a')}>${Object.entries(AA).map(([k, x]) => `<option value="${k}"${k === d.a ? ' selected' : ''}>${esc(x.n)}</option>`).join('')}</select>
    ${A.arg ? argSel(A.arg, d.arg, at('darg')) : ''}${A.num ? ` ${A.num} <input type="number" min="1" value="${d.num || 1}" ${at('num')} style="width:60px">` : ''}</div></div>`;
}
export function renderRules() {
  const p = $('p-airules'); if (!p) return;
  p.innerHTML = `<div class="box"><div class="row"><h2 class="grow">Правила ИИ</h2><button class="btn sm" id="ai-save">Сохранить в data/ai.json</button><button class="btn sm" id="ai-ex">Добавить примеры</button></div>
    <div class="help">Правило срабатывает, когда выполнены все его условия. Корпорации проверяют правила раз в месяц, сверху вниз; срабатывает одно — первое подходящее. Корабли — каждый ход: первое подходящее правило отправляет корабль на базу. Правки действуют сразу; «Сохранить» — чтобы остались после перезапуска.</div>${E.aimsg ? `<div class="ok">${esc(E.aimsg)}</div>` : ''}</div>
    <h3>Корпорации <button class="btn sm" data-rnew="corp">+ правило</button></h3>${AI.corp.map((r, i) => ruleHtml('corp', r, i)).join('') || '<div class="help">Правил нет — корпорации думают сами.</div>'}
    <h3>Корабли <button class="btn sm" data-rnew="ship">+ правило</button></h3>${AI.ship.map((r, i) => ruleHtml('ship', r, i)).join('') || '<div class="help">Правил нет.</div>'}`;
}
const EX = {corp: [{name: 'Дефицит медицины — строить заводы', when: [{p: 'sat', a: 'meds', op: '<', v: 70}, {p: 'avail', op: '>', v: 2e10}], do: {a: 'build_fac', arg: 'meds', num: 2}},
  {name: 'Богатые — в космос', when: [{p: 'credits', op: '>', v: 5e11}, {p: 'miners', op: '<', v: 6}], do: {a: 'build_miner'}}],
  ship: [{name: 'Шахтёр с полным трюмом — домой', when: [{p: 'miner', op: '=', v: 1}, {p: 'cargo', op: '>=', v: 95}], do: {a: 'earth'}}]};

/* ===== события ===== */
function onEditInput(e) {
  const t = e.target, d = t.dataset || {};
  if (d.ep) { const path = JSON.parse(d.ep), old = getAt(path); setAt(path, t.type === 'checkbox' ? t.checked : t.type === 'number' ? (t.value === '' ? 0 : +t.value) : fromText(t.value, old)); return; }
  if (t.id === 'ed-q') { E.q = t.value; renderEditor(); const q = $('ed-q'); if (q) { q.focus(); q.setSelectionRange(q.value.length, q.value.length); } return; }
  if (d.rk) { const r = AI[d.rk][+d.ri]; if (!r) return; const f = d.rf, j = d.rj != null ? +d.rj : null;
    if (f === 'on') r.off = !t.checked; else if (f === 'stop') r.stop = t.checked; else if (f === 'name') r.name = t.value; else if (f === 'only') r.only = t.value || undefined;
    else if (f === 'p') { r.when[j].p = t.value; r.when[j].a = undefined; renderRules(); } else if (f === 'a' && j != null) r.when[j].a = t.value; else if (f === 'op') r.when[j].op = t.value; else if (f === 'v') r.when[j].v = +t.value;
    else if (f === 'a') { r.do = {a: t.value}; renderRules(); } else if (f === 'darg') r.do.arg = t.value; else if (f === 'num') r.do.num = +t.value; }
}
function onEditClick(e) {
  const t = e.target, d = t.dataset || {}; const S = E.sec, V = E.model && E.model[S];
  if (t.id === 'ed-save') return doSave(false); if (t.id === 'ed-saver') return doSave(true);
  if (t.id === 'ed-undo') { load(E.file); E.msg = 'Правки отменены.'; return renderEditor(); }
  if (t.id === 'ed-new') { const id = ($('ed-nid').value || '').trim().replace(/\s+/g, '_'), tp = $('ed-tpl').value; if (!id || V[id]) { E.msg = id ? 'Такой id уже есть.' : 'Введите id.'; return renderEditor(); } V[id] = tp ? clone(V[tp]) : {}; if (V[id].tech) V[id].tech = 'm_' + id; E.dirty = true; E.msg = `Добавлено: ${id}${tp ? ' (копия ' + tp + ')' : ''}.`; return renderEditor(); }
  if (d.ecopy) { let id = d.ecopy + '_2', n = 2; while (V[id]) id = d.ecopy + '_' + (++n); V[id] = clone(V[d.ecopy]); if (V[id].tech) V[id].tech = 'm_' + id; if (V[id].name) V[id].name += ' (копия)'; E.dirty = true; E.msg = 'Скопировано: ' + id; return renderEditor(); }
  if (d.edel) { delete V[d.edel]; const D = DEFAULTS[E.file] && DEFAULTS[E.file][S]; if (D && D[d.edel]) (E.del[S] = E.del[S] || []).push(d.edel); E.dirty = true; E.msg = 'Удалено: ' + d.edel + ' (встроенные записи могут понадобиться старым сохранениям).'; return renderEditor(); }
  if (d.rnew) { AI[d.rnew].push({name: 'Новое правило', when: [], do: {a: Object.keys(d.rnew === 'corp' ? CORP_A : SHIP_A)[0]}}); return renderRules(); }
  if (d.radd) { const [k, i] = d.radd.split(':'); AI[k][+i].when = AI[k][+i].when || []; AI[k][+i].when.push({p: Object.keys(k === 'corp' ? CORP_P : SHIP_P)[0], op: '>', v: 0}); return renderRules(); }
  if (d.rdc) { const [k, i, j] = d.rdc.split(':'); AI[k][+i].when.splice(+j, 1); return renderRules(); }
  if (d.rdel) { const [k, i] = d.rdel.split(':'); AI[k].splice(+i, 1); return renderRules(); }
  if (d.rmv) { const [k, i, s] = d.rmv.split(':'), a = AI[k], x = +i, y = x + +s; if (y >= 0 && y < a.length) [a[x], a[y]] = [a[y], a[x]]; return renderRules(); }
  if (t.id === 'ai-ex') { for (const k of ['corp', 'ship']) for (const r of EX[k]) AI[k].push(clone(r)); return renderRules(); }
  if (t.id === 'ai-save') { const strip = a => a.map(r => { const o = {...r}; delete o.fired; return o; }); saveFile('ai', {_readme: 'Правила ИИ (правятся в игре: Редактор → Правила ИИ). when — условия {p параметр, a товар/руда, op, v}, do — действие {a, arg, num}; off — выключено; stop:false — не заменять встроенный ИИ; only — имя корпорации.', corp: strip(AI.corp), ship: strip(AI.ship)}).then(m => { E.aimsg = m; renderRules(); }); }
}
function onEditChange(e) {
  const t = e.target, d = t.dataset || {};
  if (t.id === 'ed-file') { if (E.dirty && !confirm('Есть несохранённые правки. Отбросить?')) { t.value = E.file; return; } load(t.value); E.msg = ''; return renderEditor(); }
  if (t.id === 'ed-sec') { E.sec = t.value; E.q = ''; return renderEditor(); }
  if (d.eadd) { const id = d.eadd, V = E.model[E.sec]; let f = t.value; if (!f) return; if (f === '*') { f = (prompt('Название поля') || '').trim(); if (!f) return; }
    const sample = Object.values(V).map(r => r[f]).find(x => x !== undefined); V[id][f] = sample === undefined ? 0 : typeof sample === 'number' ? 0 : typeof sample === 'string' ? '' : Array.isArray(sample) ? [] : typeof sample === 'object' ? {} : sample; E.dirty = true; return renderEditor(); }
  onEditInput(e);
}
if (typeof document !== 'undefined' && document.addEventListener) {
  const wire = () => { for (const id of ['p-edit', 'p-airules']) { const el = document.getElementById(id); if (!el || el._ed) continue; el._ed = true; el.addEventListener('click', onEditClick); el.addEventListener('change', onEditChange); el.addEventListener('input', e => { if (e.target.dataset && (e.target.dataset.ep || e.target.dataset.rf === 'name' || e.target.dataset.rf === 'v' || e.target.dataset.rf === 'num') || e.target.id === 'ed-q') onEditInput(e); }); } };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', wire); else wire(); setTimeout(wire, 500);
}
hooks.renderEditor = renderEditor; hooks.renderRules = renderRules;
