// @ts-nocheck
import { gd } from './00-gd.ts';
// Технологии: карточки с рандомным предложением (как в Stellaris). Эффекты — модификаторы по ключам, их читает остальная игра через tm()/ta().
import { state } from './01-data.ts';
export const RARITY = {c: {n: 'Обычная', w: 100, k: 1, col: '#9aa7b8'}, u: {n: 'Необычная', w: 40, k: 1.7, col: '#4aa3ff'}, r: {n: 'Редкая', w: 10, k: 3.2, col: '#e3a94f'}};
// [id, область, редкость, цена (до множителя), название, описание, эффекты {ключ: ±доля}, требуется]
// Технологии только открывают новое (решено с владельцем): модификаторов «+налоги/+заводы» нет.
const L = [
  ['yard', 'eng', 'c', 500, 'Орбитальные верфи', 'Открывает постройку верфи: без неё кораблей не построить.'],
  ['autofab', 'eng', 'c', 450, 'Автоматизация цехов', 'Открывает автоматическую фабрику тех. изделий.'],
  ['rock300', 'eng', 'c', 800, 'Крупные астероиды I', 'Корабельные лазеры берут тела диаметром до 300 км.'],
  ['rock1000', 'eng', 'u', 1100, 'Крупные астероиды II', 'Корабельные лазеры берут тела до 1000 км (Церера, Веста).', 0, 'rock300'],
];
// модули кораблей: [ключ, область, редкость, цена, требуется]
const MOD = {ion: ['phys', 'c', 300], chem: ['phys', 'c', 300], fusion: ['phys', 'u', 700, 'chem'], tank: ['eng', 'c', 250], cargo: ['eng', 'c', 250],
  laser: ['phys', 'c', 300], laser2: ['phys', 'u', 600, 'laser'], cabin: ['bio', 'c', 250], life: ['bio', 'c', 300], xfer: ['eng', 'u', 900, 'tank'],
  repair: ['eng', 'c', 450], spares: ['eng', 'c', 250], lab_phys: ['phys', 'c', 400], lab_eng: ['eng', 'c', 400], lab_bio: ['bio', 'c', 400],
  armor: ['eng', 'c', 400], rail: ['phys', 'u', 650], ammo: ['eng', 'c', 300, 'rail'], reactor: ['phys', 'u', 600], gat: ['phys', 'c', 450], flak: ['phys', 'u', 600, 'gat'],
  lgun: ['phys', 'r', 1000, 'reactor'], missile: ['phys', 'u', 700], irs: ['phys', 'c', 400], ems: ['phys', 'c', 400], radar: ['phys', 'u', 600],
  fcs: ['eng', 'u', 600, 'radar'], ew: ['phys', 'r', 900, 'radar'], marines: ['bio', 'u', 550], dcon: ['eng', 'c', 400], sink: ['eng', 'c', 350],
  hangar_f: ['eng', 'r', 1000], hangar_b: ['eng', 'r', 1100, 'hangar_f'], hook: ['eng', 'c', 400]};
// вызывается из 01-data после объявления COMP (иначе цикл импортов)
export function addModuleTechs(COMP) {
  for (const k in COMP) { const m = MOD[k] || ['eng', 'c', 400], c = COMP[k], req = m[3] && COMP[m[3]] ? COMP[m[3]].tech : null;
    if (BYID[c.tech]) continue; const t = {id: c.tech, f: m[0], r: m[1], cost: Math.round(m[2] * RARITY[m[1]].k), name: 'Модуль: ' + c.name, desc: (c.desc || '') + (c.off ? ' (модуль временно отключён)' : ''), eff: null, req, excl: null};
    TECH.push(t); BYID[t.id] = t; }
  // правки из data/techs.json: по id — name, desc, cost, f (область), r (редкость), req (что нужно до)
  const def = {}; for (const t of TECH) def[t.id] = {name: t.name, desc: t.desc, f: t.f, r: t.r, cost: t.cost, req: t.req};
  const ov = gd('techs', 'techs', def); for (const t of TECH) if (ov[t.id]) Object.assign(t, ov[t.id]);
}
export const TECH = L.map(([id, f, r, base, name, desc, eff, req, excl]) => ({id, f, r, cost: Math.round(base * RARITY[r].k), name, desc, eff: eff || null, req: req || null, excl: excl || null}));
export const excluded = t => !!(t.excl && state.tech && state.tech[t.excl]);
const BYID = {}; for (const t of TECH) BYID[t.id] = t;
export const techById = id => BYID[id];
// модификаторы: tm — произведение (1+v) по изученным, ta — сумма
let ck = null, cv = {};
function agg() {
  const T = state && state.tech || {}, key = Object.keys(T).filter(k => T[k]).join(',');
  if (ck === key && cv._t === T) return cv; cv = {_t: T, m: {}, a: {}}; ck = key;
  for (const id in T) { const t = T[id] && BYID[id]; if (!t || !t.eff) continue; for (const k in t.eff) { cv.m[k] = (cv.m[k] || 1) * (1 + t.eff[k]); cv.a[k] = (cv.a[k] || 0) + t.eff[k]; } }
  return cv;
}
// бонусы построек за каждый уровень
export const BEFF = {market: {rpcost: -.05}, crusher: {mine: .08}, techpark: {prod: .03}, composite: {cargo: .05}, enginefab: {thrust: .05}, spaceport: {fare: -.04, fspeed: .08}, colbureau: {infra: -.05}, testrange: {fail: -.06}, repairdock: {repair: .2}, trainctr: {train: .2}, miningsch: {mining: .06}, hospital: {death: -.03}, maternity: {birth: .04}};
let bcT = -1, bcS = null, bcV = {};
const bmod = k => { const B = state && state.bld; if (!B) return 1; if (bcT !== state.t || bcS !== state) { bcT = state.t; bcS = state; bcV = {}; } if (bcV[k] != null) return bcV[k]; let v = 0; for (const t in BEFF) if (BEFF[t][k] && B[t]) v += BEFF[t][k] * B[t]; return bcV[k] = Math.max(.1, 1 + v); };
export const tm = k => (agg().m[k] || 1) * bmod(k);
export const ta = k => agg().a[k] || 0;
// --- карточки ---
export const OFFER_N = 3;
const pick = (arr, w) => { let s = arr.reduce((a, x) => a + w(x), 0), r = Math.random() * s; for (const x of arr) { r -= w(x); if (r <= 0) return x; } return arr[arr.length - 1]; };
export function dealField(f, keep) {
  state.offers = state.offers || {}; const cur = (keep || []).filter(id => BYID[id] && !state.tech[id]), taken = new Set();
  for (const g in state.offers) for (const id of state.offers[g]) taken.add(id);
  const pool = TECH.filter(t => t.f === f && !state.tech[t.id] && !excluded(t) && (!t.req || state.tech[t.req]) && !taken.has(t.id) && !cur.includes(t.id));
  const out = cur.slice();
  while (out.length < OFFER_N && pool.length) { const t = pick(pool, x => RARITY[x.r].w); pool.splice(pool.indexOf(t), 1); out.push(t.id); const pr = t.excl && pool.find(x => x.id === t.excl); if (pr && out.length < OFFER_N) { pool.splice(pool.indexOf(pr), 1); out.push(pr.id); } }
  state.offers[f] = out;
}
export function ensureOffers(fields) {
  state.offers = state.offers || {}; state.rerolls = state.rerolls || {};
  for (const f of fields) { if (state.rerolls[f] == null) state.rerolls[f] = 1; if (!state.offers[f] || state.offers[f].some(id => state.tech[id]) || state.offers[f].length < Math.min(OFFER_N, 1)) dealField(f, (state.offers[f] || []).filter(id => !state.tech[id])); }
}
export function reroll(f) {
  state.rerolls = state.rerolls || {}; if (!(state.rerolls[f] > 0)) return false;
  state.rerolls[f]--; const cur = state.research && state.research[f]; state.offers[f] = []; dealField(f, cur ? [cur] : []); return true;
}
