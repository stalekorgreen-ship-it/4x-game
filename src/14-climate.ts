// @ts-nocheck
// Климат и условия жизни любого тела. От них считается «стоимость колонии» — показатель того, сколько
// инфраструктуры жизнеобеспечения нужно на человека: одна единица инфраструктуры кормит 10000 / (1 + стоимость) человек.
import { ta } from './15-techs.ts';
import { BODY } from './01-data.ts';

export const G0 = 9.80665, GGRAV = 6.674e-11;
// Данные планет и крупных спутников (давление в атм, доли газов по объёму, массы в тоннах, температуры в °C)
const MOLAR = {n2: 28, o2: 32, ar: 40, co2: 44, ch4: 16, h2o: 18, so2: 64, ne: 20, he: 4};
export const GAS_NAME = {n2: 'Азот', o2: 'Кислород', ar: 'Аргон', co2: 'Углекислый газ', ch4: 'Метан', h2o: 'Водяной пар', so2: 'Диоксид серы', ne: 'Неон', he: 'Гелий'};
const T = {
  earth: {mass: 5.972e24, d: 12742, day: 24, alb: .30, mean: 15, max: 57, min: -89, p: 1, atmT: 5.15e15, gas: {n2: .7808, o2: .2095, ar: .0093, co2: .0004}, water: 1.4e18, wcov: .71, rad: 1, mag: true, under: 15},
  venus: {mass: 4.867e24, d: 12104, day: 2802, alb: .77, mean: 464, max: 465, min: 440, p: 92, atmT: 4.8e17, gas: {co2: .965, n2: .035, so2: .00015}, water: 1.5e13, wcov: 0, rad: .3, mag: false, under: 464},
  mars: {mass: 6.417e23, d: 6779, day: 24.66, alb: .25, mean: -63, max: 20, min: -140, p: .006, atmT: 2.5e13, gas: {co2: .953, n2: .027, ar: .016, o2: .0017}, water: 5e15, wcov: 0, rad: 100, mag: false, under: -55},
  luna: {mass: 7.346e22, d: 3474, day: 708.7, alb: .12, mean: -23, max: 127, min: -173, p: 3e-15, atmT: 1e4, gas: {ar: .3, ne: .3, he: .4}, water: 6e9, wcov: 0, rad: 200, mag: false, under: -23},
  phobos: {day: 7.65, alb: .07}, deimos: {day: 30.3, alb: .08},
};
const hash01 = id => { let h = 2166136261; for (const ch of 'clim:' + id) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return ((h >>> 0) % 100000) / 100000; };
const cache = {};
export function climateOf(id) {
  if (cache[id]) return cache[id];
  const b = BODY[id], t = T[id] || {}, par = b.parent ? BODY[b.parent] : b, a = par.a != null ? par.a : 1;
  const type = b.comet ? 'comet' : b.type || null, alb = t.alb != null ? t.alb : b.comet ? .04 : type === 'C' ? .07 : type === 'S' ? .25 : type === 'M' ? .15 : .12;
  const mass = t.mass || b.mass || 0, d = t.d || b.d || 0, r = d * 500;
  const fk = Math.pow(1 - alb, .25) / Math.sqrt(a);
  const c = {id, a, alb, d, mass, day: t.day || Math.round((2 + 38 * hash01(id)) * 10) / 10,
    mean: t.mean != null ? t.mean : Math.round(278.6 * fk - 273.15), max: 0, min: 0,
    p: t.p || 0, atmT: t.atmT || 0, gas: t.gas || {}, water: t.water != null ? t.water : ((b.ores && (b.ores.ice || 0)) || 0), wcov: t.wcov || 0,
    rad: t.rad != null ? t.rad : Math.round(120 + 80 / (a * a)), mag: !!t.mag, g: r > 0 && mass ? GGRAV * mass / (r * r) / G0 : 0};
  c.under = t.under != null ? t.under : c.mean;
  // суточный размах: чем длиннее сутки и тоньше атмосфера, тем сильнее средняя температура «размазывается» по циклу
  const A0 = .5 * (394 - 79) * fk, tau = 50 + 610 * Math.pow(c.p, 1.1), A = A0 * c.day / (c.day + tau);
  c.amp = Math.round(A); c.max = Math.round(c.mean + A); c.min = Math.round(c.mean - A);
  // массовые доли газов из объёмных
  let mm = 0; for (const k in c.gas) mm += c.gas[k] * (MOLAR[k] || 30);
  c.gasT = {}; for (const k in c.gas) c.gasT[k] = mm > 0 ? c.atmT * c.gas[k] * (MOLAR[k] || 30) / mm : 0;
  return cache[id] = c;
}
// Стоимость колонии: 0 — инфраструктура не нужна (Земля). Считаем два режима: на поверхности и под землёй, берём дешевле.
// Под землёй нет радиации и суточных перепадов, но нужны закрытые помещения и раскопки; со временем (терраформинг) выгоднее станет поверхность.
export function colonyCost(id) {
  const c = climateOf(id), sr = [], ur = [];
  const hot = Math.max(0, c.max - 35) / 20, cold = Math.max(0, -10 - c.min) / 20; sr.push(['Жара днём', hot], ['Холод ночью', cold]);
  const pO2 = (c.gas.o2 || 0) * c.p, pCO2 = (c.gas.co2 || 0) * c.p;
  sr.push(['Давление', c.p < .5 ? (.5 - c.p) / .5 * 8 : c.p > 2 ? Math.sqrt(c.p - 2) : 0]);
  sr.push(['Непригодный воздух', c.p >= .05 && (pO2 < .12 || pCO2 > .02) ? 5 : 0]);
  sr.push(['Радиация', c.mag && c.rad <= 3 ? 0 : Math.log10(Math.max(1, c.rad)) * 2.5]);
  const grav = c.g < 1 ? (1 - c.g) * 6 : (c.g - 1) * 8, wat = c.water > 1e6 ? 0 : 3;
  sr.push(['Гравитация', grav], ['Нет воды', wat]);
  ur.push(['Закрытые помещения и раскопки', 3], ['Температура недр', Math.max(0, Math.abs(c.under - 15) - 10) / 20], ['Гравитация', grav], ['Нет воды', wat]);
  const sum = r => r.reduce((a, x) => a + x[1], 0), S = sum(sr), U = sum(ur), under = U < S;
  const cc = id === 'earth' ? 0 : Math.max(0, Math.round((Math.min(S, U) - ta('ccred')) * 10) / 10);
  return {cc, surf: Math.round(S * 10) / 10, und: Math.round(U * 10) / 10, mode: id === 'earth' ? 'surface' : under ? 'under' : 'surface', rows: id === 'earth' ? sr : under ? ur : sr, srows: sr, urows: ur, per: 10000 / (1 + cc) * (1 + ta('hab'))};
}
