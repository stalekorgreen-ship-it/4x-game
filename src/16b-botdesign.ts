// @ts-nocheck
// Проектировщик ИИ: корабли ботов собираются из тех же деталей, что и у игрока (двигатели, баки, реакторы, погреба, орудия, броня, сенсоры, жильё),
// а не берутся из шаблонов. «Намерение» (сколько орудий, какой калибр, сколько брони, какой размер) задаёт шаблон/доктрина,
// а бот экспериментирует с остальным: тип заряжания, число конденсаторов, материал брони, двигатели, реакторы, масштаб вооружения —
// и оставляет лучшие по оценке (огневая мощь × живучесть × скорость, штраф за отклонение от нужного тоннажа и за предупреждения).
import { compOf, mkKey, designStats, TON_L, fuelPerAU } from './01-data.ts';
import { specFromShip } from './05-battle.ts';

const R = (a, b) => a + Math.random() * (b - a), RI = (a, b) => Math.floor(R(a, b + 1)), pick = a => a[Math.floor(Math.random() * a.length)];
const MS = [['10', '1', '1', '1', '1', '0', '1'], ['30', '5', '10', '1', '0', '0', '0'], ['100', '2', '30', '3', '3', '2', '1']]; // мощность, двигатель, топливо, ЭМ, ТЕП, радар, самонаведение
const AMMO_SZ = [1000, 500, 200, 100, 50, 20], REACT_SZ = [5000, 1000, 300, 100, 50, 20];
export let BOT_REAL = true;
export const setBotReal = v => { BOT_REAL = !!v; };

// гены: что бот пробует менять
function randGenes(sp) {
  const big = (sp.tons || (sp.L || .5) * TON_L) > 20000;
  return {k: R(.75, 1.15), ld: pick(['m', 'a', 'a', 'f']), cap: RI(4, 22), mat: pick(['s', 's', 't', 'r']), armAdj: pick([-1, 0, 0, 1]), eng: big && Math.random() < .6 ? 'fusion' : 'ion',
    epw: pick(['100', '200', '300', '500']), tune: pick(['n', 'n', 'e', 'b']), fu: R(.03, .09), am: pick([1, 1.3, 1.8]), ms: RI(0, 2), cl: pick(['l', 's', 's', 'h']), gn: pick(['1', '2', '2', '4'])};
}
function mutate(g) {
  const h = {...g}, f = pick(['k', 'ld', 'cap', 'mat', 'armAdj', 'eng', 'epw', 'tune', 'fu', 'am', 'ms']);
  const r = randGenes({L: .5});
  h[f] = r[f]; return h;
}
const add = (parts, k, n) => { if (n > 0) parts[k] = (parts[k] || 0) + n; };
function sumAmmoParts(parts, need) { let left = need; for (const s of AMMO_SZ) { while (left >= s * .85 && left > 0) { add(parts, mkKey('ammo', {t: String(s)}), 1); left -= s; } } if (left > 0) add(parts, mkKey('ammo', {t: '20'}), Math.ceil(left / 20)); }
function sumReactors(parts, need) { let left = need; for (const s of REACT_SZ) { while (left >= s * .85 && left > 0) { add(parts, mkKey('reactor', {p: String(s)}), 1); left -= s; } } if (left > 0) add(parts, mkKey('reactor', {p: '20'}), Math.ceil(left / 20)); }

// оружие, броня, ангары, сенсоры — всё, кроме двигателей, реакторов, баков, жилья
function weaponsPart(sp, g) {
  const p = {}, k = g.k, rc = (sp.railCfg && sp.railCfg[0]) || {cal: 10, bar: 1};
  const nr = sp.rails ? Math.max(1, Math.round(sp.rails * k)) : 0, ng = sp.gat ? Math.max(1, Math.round(sp.gat * k)) : 0, nf = sp.flak ? Math.max(1, Math.round(sp.flak * k)) : 0;
  if (nr) add(p, mkKey('rail', {cal: String(rc.cal), bar: String(rc.bar), ld: g.ld, cap: String(g.cap), saf: '1'}), nr);
  if (ng) add(p, mkKey('gat', {tw: String((sp.gatCfg && sp.gatCfg[0] && sp.gatCfg[0].tw) || 0)}), ng);
  if (nf) add(p, mkKey('flak', {cal: '40', rt: 'n', saf: '0'}), nf);
  if (sp.lasers && sp.laserCfg && sp.laserCfg[0]) { const L = sp.laserCfg[0]; add(p, mkKey('lgun', {lens: String(L.lens || 20), dur: String(L.dur || 5), caps: String(L.caps || 100)}), 1); }
  if (sp.miss) { const m = MS[g.ms]; add(p, mkKey('missile', {pw: m[0], en: m[1], fu: m[2], em: m[3], ir: m[4], ac: m[5], hm: m[6], mt: '50'}), Math.max(1, Math.round(sp.miss * k))); }
  if (sp.F) { const key = mkKey('hangar_f', {cl: g.cl, en: '100', fu: '20', gn: g.gn, am: '120'}); add(p, key, Math.max(1, Math.ceil(sp.F / (compOf(key).hangF || 10)))); }
  if (sp.B) { const key = mkKey('hangar_b', {cl: g.cl === 'l' ? 's' : g.cl, en: '100', fu: '30'}); add(p, key, Math.max(1, Math.ceil(sp.B / (compOf(key).hangB || 5)))); }
  const arm = Math.max(0, Math.min(12, (sp.arm || 0) + g.armAdj));
  if (arm) { for (let q = 0; q < Math.floor(arm / 3); q++) add(p, mkKey('armor', {th: '3', mat: g.mat}), 1); if (arm % 3) add(p, mkKey('armor', {th: String(arm % 3), mat: g.mat}), 1); }
  for (const s of sp.scList || []) { if (s.k === 'ir') add(p, mkKey('irs', {res: s.res >= 1 ? 'n' : 'w'}), 1); else if (s.k === 'em') add(p, mkKey('ems', {res: 'w'}), 1); else if (s.k === 'rad') add(p, mkKey('radar', {pw: s.rng >= 500 ? 'l' : s.rng >= 250 ? 'm' : 's', res: s.fine ? 'f' : 'c'}), 1); }
  { let n = sp.fcsN || 0; while (n >= 8) { add(p, mkKey('fcs', {ch: '8'}), 1); n -= 8; } if (n >= 4) { add(p, mkKey('fcs', {ch: '4'}), 1); n -= 4; } if (n >= 2) { add(p, mkKey('fcs', {ch: '2'}), 1); n -= 2; } if (n >= 1) add(p, mkKey('fcs', {ch: '1'}), 1); }
  if (sp.mar) add(p, 'marines', Math.max(1, Math.ceil(sp.mar / 10)));
  const tn = (sp.L || .5) * TON_L; if (tn > 20000) add(p, 'dcon', 1);
  if (sp.lasers || nr > 16) add(p, 'sink', Math.max(1, Math.ceil((nr + (sp.lasers || 0) * 10) / 20)));
  return p;
}
// достроить до рабочего корабля: боеприпасы, двигатели (по нужной скорости), реакторы (двигателям и орудиям), баки, каюты и жизнеобеспечение
function complete(sp, g, base, ship) {
  const parts = {...base}, role = sp.role;
  const rails = Object.entries(parts).reduce((a, [k, n]) => a + (compOf(k).rcfg ? n : 0), 0), gats = Object.entries(parts).reduce((a, [k, n]) => a + (compOf(k).gcfg ? n : 0), 0);
  const tonsT = Math.max(300, (sp.L || .5) * TON_L * (role === 'supply' || role === 'freight' ? .6 : 1));
  if (role === 'supply') { sumAmmoParts(parts, Math.max(100, tonsT * .25)); }
  else if (role === 'freight') { add(parts, mkKey('cargo', {sz: 'x', cn: 'n'}), Math.max(1, Math.round(tonsT * .35 / 4000))); }
  else if (rails + gats) sumAmmoParts(parts, Math.max(20, (rails * 2 + gats * 5) * g.am));
  const draw = Object.entries(parts).reduce((a, [k, n]) => a + ((compOf(k).rcfg ? compOf(k).rcfg.draw : 0) + (compOf(k).lcfg ? 800 : 0)) * n, 0);
  const target = ship ? 0 : Math.max(.5, Math.min(1.5, sp.spd || 1)) * .9;
  let best = null;
  for (let e = 1; e <= 16; e++) {
    const p = {...parts}; let engMW = 0;
    if (!ship) { add(p, mkKey(g.eng, {pw: g.epw, tune: g.tune}), e); engMW = compOf(mkKey(g.eng, {pw: g.epw, tune: g.tune})).power * e * .5; }
    sumReactors(p, engMW + draw);
    let st = designStats(p), dry = st.dry;
    const fuelNeed = Math.max(100, dry * g.fu);
    if (!ship) { const key = mkKey('tank', {sz: 'x', dn: 'n'}), per = compOf(key).fuel; add(p, key, Math.max(1, Math.ceil(fuelNeed / per))); }
    st = designStats(p);
    for (let i = 0; i < 6 && st.errors.length; i++) {
      for (const er of st.errors) {
        if (er.includes('кают')) add(p, mkKey('cabin', {sz: 'x'}), Math.max(1, Math.ceil((st.crewNeed - st.crewCap) / 100)));
        else if (er.includes('Жизнеобеспечение')) add(p, mkKey('life', {sz: 'x'}), Math.max(1, Math.ceil((st.crewNeed - st.lifeCap) / 200)));
      }
      st = designStats(p);
    }
    if (st.errors.length) continue;
    best = {p, st};
    if (ship ? e >= 1 : (st.power / Math.max(1, st.dry) >= target * .25 || st.bspd >= target)) break;
  }
  return best;
}
function score(sp, st) {
  const lg = st.lgun ? 400 : 0, fp = (st.fire || 0) * 1 + st.gat * 8 + lg + st.msl * 18 + st.hangF * 6 + st.hangB * 10 + st.flak * 3;
  const en = st.draw > 0 ? Math.min(1, Math.max(.1, (st.energyLeft || 0) / st.draw)) : 1;
  const surv = (1 + .3 * st.armor) * (1 + (st.defl || 0) * 2) * Math.log2(2 + st.crewCap / 20);
  const want = Math.max(300, (sp.L || .5) * TON_L), dev = Math.abs(Math.log(st.tons / want));
  const spd = Math.min(1.5, st.bspd || .5), pen = st.warns.length * .05 + dev * .6;
  const fuelOk = st.range > .02 ? 1 : .7;
  return (Math.max(1, fp * (.5 + .5 * en)) * surv * (.55 + .45 * spd) * fuelOk) / (1 + pen);
}
const _pool = {};
const sig = sp => [sp.name && sp.name.replace(/ №\d+$/, ''), sp.role, sp.rails, sp.railCfg && sp.railCfg[0] && sp.railCfg[0].cal + 'x' + sp.railCfg[0].bar, sp.gat, sp.flak, sp.lasers, sp.miss, sp.F, sp.B, sp.arm, Math.round((sp.L || 0) * 20), Math.round((sp.spd || 1) * 10), (sp.scList || []).length, sp.fcsN, sp.mar].join('|');
function evolve(sp) {
  const N = 12, cands = [];
  const tryG = g => { const base = weaponsPart(sp, g), r = complete(sp, g, base, sp.role === 'station'); if (r) cands.push({g, parts: r.p, st: r.st, sc: score(sp, r.st)}); };
  for (let i = 0; i < N; i++) tryG(randGenes(sp));
  cands.sort((a, b) => b.sc - a.sc);
  for (const c of cands.slice(0, 3).slice()) { tryG(mutate(c.g)); tryG(mutate(c.g)); }
  cands.sort((a, b) => b.sc - a.sc);
  return cands.slice(0, 3);
}
// перевод «намерения» ИИ в настоящий проект: возвращает спецификацию боя, посчитанную из деталей
export function botSpec(sp) {
  if (!BOT_REAL || sp.real) return sp;
  try {
    const key = sig(sp); let pool = _pool[key];
    if (!pool) { pool = _pool[key] = evolve(sp); if (!pool.length) return sp; }
    const c = pool[Math.floor(Math.random() * Math.min(pool.length, 3))], st = c.st;
    const ship = {name: sp.name, id: 'bot' + Math.random(), st, air: {F: Math.min(sp.F || 0, st.hangF), B: Math.min(sp.B || 0, st.hangB)}, hullDmg: 0, crew: {}, fuel: st.fuelCap, cargo: {}};
    const out = specFromShip(ship);
    out.name = sp.name; out.ref = null; out.real = 1; out.parts = c.parts; out.fid = sp.fid; out.sk = sp.sk; out.role = sp.role; out.dopt0 = sp.dopt0; out.mar = sp.mar || st.mar || 0; out.fmis = sp.fmis;
    out.prim = sp.prim; out.reserve = sp.reserve; out.L0 = sp.L0 || sp.L; out.spd = (st.bspd || 1) * (sp.spdMul || 1);
    if (sp.F && out.F > 0) { out.fq = st.fq; out.bq = st.bq; }
    if (sp.station) { out.station = 1; out.spd = 0; out.role = 'station'; out.dmg = 0; }
    if (sp.defl != null && !out.defl) out.defl = sp.defl;
    return out;
  } catch (e) { return sp; }
}
// Спек для 3D-превью в конструкторе: один корабль по текущему проекту игрока.
export function previewSpec(parts) {
  try {
    const st = designStats(parts); if (!st || !(st.L > 0) || !(st.dry > 0) || !Object.values(parts || {}).some(n => n > 0)) return null;
    const ship = {name: 'Превью', id: 'pv', st, air: {F: st.hangF || 0, B: st.hangB || 0}, hullDmg: 0, crew: {}, fuel: st.fuelCap, cargo: {}};
    const out = specFromShip(ship);
    out.ref = null; out.real = 1; out.parts = parts; out.fid = 0; out.spd = 0; out.fuel = out.fuelCap;
    return out;
  } catch (e) { return null; }
}
