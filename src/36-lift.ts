// @ts-nocheck
// Подъём на орбиту (таблица «Пояс», шаг 4): всё, что уходит с поверхности Земли в космос, платит за тонну.
// Груз, привезённый из космоса, остаётся на орбитальном складе (state.orb — часть склада) и подъёма не требует.
import { gd } from './00-gd.ts';
import { KR } from './00-kr.ts';
import { state } from './01-data.ts';
// base — цена подъёма т с Земли (×25 кр): 720 000 ≈ 18 млн кр ≈ 2 000 $/кг (одноразовые ракеты 2030 г.);
// techs — множители технологий (берётся лучший): многоразовые ×0,3, сверхтяжёлые многоразовые ×0,1, космический лифт ×0,02
export const LIFT = gd('economy', 'lift', {base: 720000, techs: {reuse: .3, superheavy: .1, elevator: .02}});
export const liftK = () => { let k = 1; for (const t in LIFT.techs) if (state && state.tech && state.tech[t]) k = Math.min(k, LIFT.techs[t]); return k; };
export const liftT = () => LIFT.base * KR * liftK(); // кр за тонну
export const orb = () => (state.orb || (state.orb = {}));
export function clampOrb() { const o = orb(); for (const k in o) o[k] = Math.max(0, Math.min(o[k], (state.stock && state.stock[k]) || 0)); }
export function toOrbit(k, v) { if (v > 0) { const o = orb(); o[k] = (o[k] || 0) + v; } } // прибыло из космоса — лежит на орбите
export function liftNeed(k, v) { clampOrb(); return Math.max(0, v - (orb()[k] || 0)); } // сколько из v придётся поднимать с поверхности
export function liftFrom(k, v) { clampOrb(); const o = orb(), f = Math.min(o[k] || 0, v); o[k] = (o[k] || 0) - f; return v - f; } // забрать v: сначала с орбиты; вернёт поднятое с Земли
export function payLift(t) { if (!(t > 0)) return 0; const c = t * liftT(); state.money -= c; state.liftPaid = (state.liftPaid || 0) + c; return c; }
