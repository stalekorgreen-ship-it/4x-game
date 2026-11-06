// @ts-nocheck
import { baseOf, log, state, sumVals, uid } from './01-data.ts';
import { tm } from './15-techs.ts';
import { academyBonus, academyClass, techOn } from './03-build.ts';
import { releaseTow } from './04-engine.ts';

/* ===== ОФИЦЕРЫ И УЗЛЫ ===== */
export const ROLES = {eng: 'Инженер', sci: 'Учёный', min: 'Горняк', pil: 'Пилот', cmd: 'Командир'};
export const SKILLS = {eng: 'Инженерия', sci: 'Наука', min: 'Горное дело', pil: 'Пилотирование', cmd: 'Командование'};
export const SURN = ['Волков','Орлова','Ким','Соколов','Белова','Назаров','Лебедев','Громова','Исаев','Тихонова','Абдрахманов','Жукова','Рахимов','Мельник','Сорокин','Ефимова','Кузьмин','Шевченко','Каримова','Новиков'];
export const INIT = ['А.','Б.','В.','Д.','Е.','И.','К.','М.','Н.','О.','С.','Т.'];
export const rnd = () => Math.random();
export const SK_ROLES = ['eng', 'sci', 'min', 'pil', 'cmd'];
// разные типы выпускников: слабые, средние, сильные и узкие специалисты
export function genSk() {
  const u = rnd(), bonus = state.bld ? academyBonus() : 0, cl = v => Math.min(10, Math.max(1, Math.round(v)));
  const base = u < 0.15 ? 1 + rnd() * 3 : u < 0.65 ? 3 + rnd() * 4 : u < 0.9 ? 6 + rnd() * 3.5 : 3 + rnd() * 3;
  const sk = {};
  for (const r of SK_ROLES) sk[r] = cl(base + (rnd() - 0.5) * 3 + bonus);
  if (u >= 0.9) sk[SK_ROLES[Math.floor(rnd() * 5)]] = cl(9 + rnd() * 1.5);
  return sk;
}
export function genOfficer() {
  const o = {id: uid(), name: SURN[Math.floor(rnd() * SURN.length)] + ' ' + INIT[Math.floor(rnd() * INIT.length)], sk: genSk(), where: null};
  state.officers.push(o); return o;
}
export function graduate() {
  const n = academyClass(), cls = [];
  for (let i = 0; i < n; i++) cls.push(genOfficer());
  const best = cls.reduce((a, c) => Math.max(...Object.values(c.sk)) > Math.max(...Object.values(a.sk)) ? c : a);
  let msg = `Выпуск академии: ${n} офицеров, сильнейший — ${best.name} (${SK_ROLES.map(r => SKILLS[r][0] + best.sk[r]).join(' ')}).`;
  const free = freeOfficers().sort((a, c) => sumVals(a.sk) - sumVals(c.sk));
  if (free.length > 60) { const drop = free.slice(0, free.length - 60); state.officers = state.officers.filter(o => !drop.includes(o)); msg += ` ${drop.length} слабых ушли в отставку.`; }
  log(msg);
}
export const officerById = id => state.officers.find(o => o.id === id);
export const freeOfficers = () => state.officers.filter(o => !o.where);
export const slotsFor = st => ['eng', 'sci', 'min', 'pil', 'cmd'].filter(r => r === 'eng' || r === 'cmd' || (r === 'sci' && st.labsTotal > 0) || (r === 'pil' && st.power > 0) || (r === 'min' && st.lasers > 0));
// prio[role]: 0 = лучший из доступных, N = не ниже N
export function staffFor(st, prio, free) {
  free = (free || freeOfficers()).slice();
  const crew = {}, miss = [];
  for (const role of slotsFor(st)) {
    const need = (prio && prio[role]) || 0;
    let best = null;
    for (const o of free) if (o.sk[role] >= need && (!best || o.sk[role] > best.sk[role])) best = o;
    if (best) { crew[role] = best.id; free.splice(free.indexOf(best), 1); }
    else miss.push(`${ROLES[role].toLowerCase()}${need ? ' ≥' + need : ''}`);
  }
  return {crew, miss};
}
export function bindCrew(kind, ent) {
  for (const [role, oid] of Object.entries(ent.crew)) { const o = officerById(oid); if (o) o.where = {kind, id: ent.id, slot: role}; }
}
export function setCrew(ent, kind, role, oid) {
  const old = officerById(ent.crew[role]); if (old) old.where = null;
  if (oid) { ent.crew[role] = oid; officerById(oid).where = {kind, id: ent.id, slot: role}; } else delete ent.crew[role];
}
export function effSkill(ent, role) {
  if (ent.corp) return 4;
  const o = ent.crew && officerById(ent.crew[role]); if (!o) return 0;
  let v = o.sk[role];
  if (role !== 'cmd') { const c = officerById(ent.crew.cmd); if (c) v += c.sk.cmd / 5; }
  return v;
}
export function train(ent, role, h, days) {
  const o = ent.crew && officerById(ent.crew[role]); if (o) o.sk[role] = Math.min(10, o.sk[role] + h * (techOn('train') ? 2 : 1) * tm('train') / (days || 300));
}
export const pilSpeed = s => 0.9 + 0.02 * effSkill(s, 'pil');
export const pilFuel = s => (1.1 - 0.02 * effSkill(s, 'pil')) * (techOn('effdrive') ? 0.85 : 1) * tm('fuel');
export const minRate = s => (0.7 + 0.06 * effSkill(s, 'min')) * tm('mining');
export const sciMult = s => (0.7 + 0.06 * effSkill(s, 'sci')) * tm('sci');
export const failMult = s => Math.max(0.3, 1.5 - 0.1 * effSkill(s, 'eng')) * (techOn('reliable') ? 0.7 : 1) * tm('fail');
export const repMult = s => (0.6 + 0.08 * effSkill(s, 'eng')) * (techOn('fieldrepair') ? 1.5 : 1) * tm('repair');

export const GROUP_OF = {ion: 'engine', chem: 'engine', laser: 'laser', laser2: 'laser', fusion: 'engine', life: 'life', hook: 'hook', xfer: 'xfer'};
export const GROUP_NAME = {engine: 'Двигатели', laser: 'Лазеры', life: 'Жизнеобеспечение', hook: 'Сцепка', xfer: 'Передача топлива'};
export const GROUP_SPARES = {engine: 3, laser: 2, life: 2, hook: 1, xfer: 1};
export function eqFor(parts) {
  const eq = {};
  for (const [k, n] of Object.entries(parts)) if (GROUP_OF[baseOf(k)] && n > 0) eq[GROUP_OF[baseOf(k)]] = {cond: 100, failed: false};
  return eq;
}
export const shipCond = s => { const v = Object.values(s.eq).map(p => p.cond); return v.length ? Math.min(...v) : 100; };
export const failed = (s, g) => !!(s.eq[g] && s.eq[g].failed);
export const anyFailed = s => Object.values(s.eq).some(p => p.failed);
// износ и шанс отказа узла: wear — потеря %, fail — базовый шанс отказа за это использование
export function useWear(s, g, wear, fail) {
  const p = s.eq[g]; if (!p || p.failed) return;
  p.cond = Math.max(0, p.cond - wear);
  if (rnd() < fail * (1 + (100 - p.cond) / 25) * failMult(s)) {
    p.failed = true; p.cond = Math.min(p.cond, 15);
    log(`«${s.name}»: отказ узла «${GROUP_NAME[g].toLowerCase()}».`);
    if (g === 'hook') releaseTow(s);
  }
}
// ремонт узлов; source(n) возвращает сколько тех. изделий удалось взять; onlyFailed — полевой ремонт
export function repairParts(s, rate, h, source, onlyFailed) {
  let busy = false, lack = false;
  for (const [g, p] of Object.entries(s.eq)) {
    if (onlyFailed ? !p.failed || p.cond >= 40 : p.cond >= 99.5) continue;
    const dc = Math.min((onlyFailed ? 40 : 100) - p.cond, rate * h * repMult(s));
    const need = dc / 100 * GROUP_SPARES[g], got = source(need), frac = need > 0 ? got / need : 1;
    p.cond += dc * frac; if (p.failed && p.cond >= 40) p.failed = false;
    if (frac < 0.999) lack = true; else busy = true;
  }
  if (busy) train(s, 'eng', h, 150);
  return busy ? 'busy' : lack ? 'lack' : 'done';
}
