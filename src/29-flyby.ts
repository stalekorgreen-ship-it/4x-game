// @ts-nocheck
// Гравитационные манёвры. Формула общая — подходит и для планет, и для звёзд, и для чёрных дыр в галактике:
//   Δv = 2·v∞ / (1 + rₚ·v∞² / μ)
// v∞ — скорость корабля относительно тела, μ = G·M (км³/с²), rₚ — ближайший безопасный пролёт (радиус тела × запас).
// Предел: Δv ≤ 2·v∞ (разворот на 180°) и ≤ круговой скорости у поверхности √(μ/rₚ). Выгода в скорости относительно звезды
// ещё умножается на «удачность» — насколько движение тела совпадает с нужным направлением (0…1).
import { BODY, objPos, dist } from './01-data.ts';

export const KMS = 86400 / 1.496e8; // 1 км/с в а.е./сут
// μ, км³/с² и радиус, км; запас пролёта: каменные тела ×1.1, газовые гиганты ×1.5 (радиация), звёзды ×3 (жар)
const GM = {sun: [1.327e11, 696000, 3], mercury: [22032, 2440], venus: [324859, 6052], earth: [398600, 6371], luna: [4905, 1737], mars: [42828, 3390],
  phobos: [.71, 11], deimos: [.096, 6.2], ceres: [62.6, 470], vesta: [17.3, 263], jupiter: [1.26687e8, 69911, 1.5], saturn: [3.7931e7, 58232, 1.5],
  uranus: [5.794e6, 25362, 1.5], neptune: [6.8365e6, 24622, 1.5], io: [5960, 1822], europa: [3203, 1561], ganymede: [9887, 2634], callisto: [7179, 2410],
  titan: [8978, 2575], triton: [1428, 1353], pluto: [870, 1188]};
// для тел без таблицы: масса в кг (b.mkg) или по диаметру как камень 2,5 г/см³; звёзды — b.msun (массы Солнца), чёрные дыры — b.bh
export function gmOf(id) {
  const b = BODY[id] || {};
  if (GM[id]) return {mu: GM[id][0], rp: GM[id][1] * (GM[id][2] || 1.1)};
  if (b.bh) { const mu = 1.327e11 * b.bh, rs = 2 * mu / 9e10; return {mu, rp: rs * 10}; } // 10 радиусов Шварцшильда
  if (b.msun) return {mu: 1.327e11 * b.msun, rp: 696000 * (b.rsun || b.msun) * 3};
  const r = (b.d || 0) / 2; if (b.mkg) return {mu: 6.674e-20 * b.mkg, rp: Math.max(r, 1) * 1.1};
  return {mu: 6.674e-20 * 2500 * 4 / 3 * Math.PI * Math.pow(r * 1000, 3), rp: Math.max(r, .1) * 1.1};
}
export function flybyDv(id, vKms) { const {mu, rp} = gmOf(id); if (!(mu > 0) || !(vKms > 0)) return 0; return Math.min(2 * vKms / (1 + rp * vKms * vKms / mu), Math.sqrt(mu / rp)); }
// тела, у которых манёвр имеет смысл: заметная гравитация, не центральная звезда системы
export const ASSIST = () => Object.keys(BODY).filter(id => { const b = BODY[id]; return b.kind !== 'sun' && b.kind !== 'lagrange' && gmOf(id).mu > 100; });

// ближайшее время прибытия (сут) на скорости v (а.е./сут) из точки/тела fromF к телу to, начиная с t0
export function arrive(fromF, to, t0, v) {
  let D = dist(fromF(t0), objPos(to, t0));
  for (let T = .5; T < 40000; T *= 1.03) { const d = dist(fromF(t0 + T), objPos(to, t0 + T)); if (v * T >= d) return {T, D: d}; D = d; }
  return {T: D / v, D};
}
// удачность манёвра: тело движется туда, куда нам дальше лететь
function align(id, t, to, tt) {
  const p0 = objPos(id, t), p1 = objPos(id, t + 1), q = objPos(to, tt), vx = p1.x - p0.x, vy = p1.y - p0.y, dx = q.x - p0.x, dy = q.y - p0.y;
  const c = (vx * dx + vy * dy) / (Math.hypot(vx, vy) * Math.hypot(dx, dy) || 1); return (1 + c) / 2;
}
// Маршрут: прямой или через одно тело. Возвращает плечи [{from, fx, fy, to, D, boost}] и время.
export function planRoute(from, f0, to, t0, v) {
  const fromF = from ? t => objPos(from, t) : () => f0, direct = arrive(fromF, to, t0, v);
  let best = {T: direct.T, legs: [{from, fx: f0.x, fy: f0.y, to, D: direct.D, boost: 0}]};
  for (const b of ASSIST()) {
    if (b === from || b === to) continue;
    const a = arrive(fromF, b, t0, v); if (a.T >= best.T) continue;
    const t1 = t0 + a.T, dv0 = flybyDv(b, v / KMS) * KMS; if (dv0 <= 0) continue;
    const g = arrive(t => objPos(b, t), to, t1, v + dv0 * .5); // удачность оцениваем по середине
    const dv = dv0 * align(b, t1, to, t1 + g.T), c = arrive(t => objPos(b, t), to, t1, v + dv);
    if (a.T + c.T < best.T * .97) best = {T: a.T + c.T, via: b, dv, legs: [{from, fx: f0.x, fy: f0.y, to: b, D: a.D, boost: 0}, {from: b, to, D: c.D, boost: dv}]};
  }
  return best;
}

