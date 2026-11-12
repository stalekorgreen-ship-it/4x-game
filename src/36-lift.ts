// @ts-nocheck
// Подъём на орбиту (таблица «Пояс», шаг 4): всё, что уходит с поверхности Земли в космос, платит за тонну.
// Груз, привезённый из космоса, остаётся на орбитальном складе (state.orb — часть склада) и подъёма не требует.
import { gd } from './00-gd.ts';
import { KR } from './00-kr.ts';
import { state } from './01-data.ts';
// base — цена подъёма т с Земли (×25 кр): 720 000 ≈ 18 млн кр ≈ 2 000 $/кг (одноразовые ракеты 2030 г.);
// techs — множители технологий (берётся лучший): многоразовые ×0,3, сверхтяжёлые многоразовые ×0,1, космический лифт ×0,02
export const LIFT = gd('economy', 'lift', {base: 720000, techs: {reuse: .3, superheavy: .1}, body: {earth: {elevator: .02}, luna: {catapult: .01, bodylift: .02}, mars: {bodylift: .02}}, capBase: 20000, capPort: 10000,
  grav: {earth: 1, venus: .9, mercury: .3, mars: .25, luna: .05, io: .05, europa_j: .04, ganymede: .06, callisto: .06, titan: .05, triton: .03, pluto: .02, small: .01}});
// capBase — подъём с Земли, т в год (космодромы 2030 г.); capPort — +т в год на каждый «Космодром»; grav — множитель цены подъёма по телу (Земля = 1; астероиды и малые луны — small)
// ракеты — для всех тел; лифт на Земле, лунная катапульта, лифт на Луне и Марсе — только для своего тела (body)
export const liftK = (id = 'earth') => { const T = state && state.tech || {}, B = (LIFT.body || {})[id] || {}; let k = 1; for (const t in LIFT.techs) if (T[t]) k = Math.min(k, LIFT.techs[t]); for (const t in B) if (T[t]) k = Math.min(k, B[t]); return k; };
export const gravK = (id = 'earth') => { const g = LIFT.grav || {}; return g[id] != null ? g[id] : (g.small != null ? g.small : .01); };
export const liftT = (id = 'earth') => LIFT.base * KR * liftK(id) * gravK(id); // кр за тонну с поверхности тела id
// пропускная способность подъёма с Земли: копится понемногу (не больше 60 суток), тратится на верфь, заправку и запчасти
export const liftCap = () => ((LIFT.capBase || 0) + (LIFT.capPort || 0) * ((state.bld && state.bld.spaceport) || 0)) / 360; // т в сутки
export function liftTick(h) { state.liftBank = Math.min(liftCap() * 60, (state.liftBank == null ? liftCap() * 30 : state.liftBank) + liftCap() * h); }
export const liftBank = () => (state.liftBank == null ? liftCap() * 30 : state.liftBank);
export function useLift(t) { const b = liftBank(), u = Math.max(0, Math.min(b, t)); state.liftBank = b - u; return u; }
export const orb = () => (state.orb || (state.orb = {}));
export function clampOrb() { const o = orb(); for (const k in o) o[k] = Math.max(0, Math.min(o[k], (state.stock && state.stock[k]) || 0)); }
export function toOrbit(k, v) { if (v > 0) { const o = orb(); o[k] = (o[k] || 0) + v; } } // прибыло из космоса — лежит на орбите
export function liftNeed(k, v) { clampOrb(); return Math.max(0, v - (orb()[k] || 0)); } // сколько из v придётся поднимать с поверхности
export function liftFrom(k, v) { clampOrb(); const o = orb(), f = Math.min(o[k] || 0, v); o[k] = (o[k] || 0) - f; return v - f; } // забрать v: сначала с орбиты; вернёт поднятое с Земли
export function payLift(t) { if (!(t > 0)) return 0; const c = t * liftT(); state.money -= c; state.liftPaid = (state.liftPaid || 0) + c; return c; }
