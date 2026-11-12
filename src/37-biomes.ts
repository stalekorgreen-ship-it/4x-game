// @ts-nocheck
// Ландшафты регионов (таблица «Пояс», вкладка «Регионы»): у каждого региона — площади ландшафтов (км²).
// Ландшафт даёт альбедо, поглощение CO₂, полезную биомассу, плодородные земли; часть непригодна для жизни.
// Раз в год: климат региона (средняя, размах, осадки, вода, загрязнение) → переходы ландшафтов (не больше RATE км² в год на переход),
// города и пашни следуют за населением. Изменение альбедо и поглощения CO₂ относительно стартовой картины влияет на климат.
import { gd } from './00-gd.ts';
import { state, log } from './01-data.ts';
import { climateBase } from './14-climate.ts';
import { regTemplate, regsOf } from './30-regions.ts';
import { hooks } from './00-hooks.ts';

// [название, альбедо, поглощение CO₂ т/км² в год, биомасса на км² в год, плодородные %, пригоден для жизни]
export const BIOMES = gd('regions', 'biomes', {
  trop: ['Тропический лес', .12, 3000, 1, 0, 1], tropS: ['Тропический сезонный лес', .13, 2500, 1, 0, 1], sav: ['Саванна', .18, 1000, .3, 5, 1],
  decid: ['Умеренный лиственный лес', .16, 2000, 1, 0, 1], mixed: ['Умеренный смешанный лес', .15, 2000, 1, 0, 1], taiga: ['Тайга', .15, 2000, 1, 0, 1],
  meadow: ['Луга / прерии', .18, 0, 0, 5, 1], steppe: ['Степь', .22, 0, 0, 1, 1], semi: ['Полупустыня', .28, 0, 0, .1, 1],
  sand: ['Песчаная пустыня', .35, 0, 0, 0, 0], rockd: ['Каменистая пустыня', .25, 0, 0, 0, 0], salt: ['Солончак', .4, 0, 0, 0, 0],
  swamp: ['Болото', .1, 500, .2, 0, 1], peat: ['Торфяники', .1, 500, .2, 0, 1], mangr: ['Мангровые заросли', .11, 500, .2, 0, 1],
  coast: ['Побережье / пляжи', .3, 0, 0, 0, 1], fjord: ['Фьорды / скалистое побережье', .18, 0, 0, 0, 1], flood: ['Затопленные равнины', .12, 0, 0, 0, 0],
  delta: ['Дельта реки', .15, 0, 0, 5, 1], tundra: ['Тундра', .5, 0, 0, 0, 0], perma: ['Вечная мерзлота', .55, 0, 0, 0, 0], glac: ['Ледник', .65, 0, 0, 0, 0],
  snow: ['Снежные пустоши', .8, 0, 0, 0, 0], mount: ['Горные скалы', .2, 0, 0, 0, 1], alpine: ['Альпийские луга', .22, 0, 0, 0, 1],
  fungi: ['Грибные леса', .12, 0, 0, 1, 1], rad: ['Радиоактивная пустошь', .2, 0, 0, 0, 0], burnt: ['Выжженная земля', .08, 0, 0, 0, 0],
  rdust: ['Красная пыльная пустыня', .2, 0, 0, 0, 0], canyon: ['Сухие каньоны', .18, 0, 0, 0, 0], co2cap: ['Полярные шапки CO₂', .7, 0, 0, 0, 0],
  subice: ['Подземные льды', .6, 0, 0, 0, 0], river0: ['Древние речные русла', .18, 0, 0, 0, 0], basalt: ['Базальтовые равнины', .12, 0, 0, 0, 0],
  acid: ['Кислотные равнины', .12, 0, 0, 0, 0], sulf: ['Серные поля', .25, 0, 0, 0, 0], vplat: ['Базальтовые плато', .12, 0, 0, 0, 0],
  vhp: ['Области высокого давления', .12, 0, 0, 0, 0], vtox: ['Токсичные низменности', .1, 0, 0, 0, 0],
  regol: ['Реголит', .1, 0, 0, 0, 0], crater: ['Ударные кратеры', .07, 0, 0, 0, 0], lmare: ['Базальтовые моря', .12, 0, 0, 0, 0],
  arock: ['Безвоздушные скалы', .12, 0, 0, 0, 0], shadow: ['Вечная тень', .01, 0, 0, 0, 0],
  ishld: ['Ледяной щит', .75, 0, 0, 0, 0], icrack: ['Ледяные трещины', .5, 0, 0, 0, 0], subocn: ['Подлёдный океан', .08, 0, 0, 0, 0], geys: ['Гейзерные поля', .8, 0, 0, 0, 0],
  mlake: ['Метановые озёра', .08, 0, 0, 0, 0], hdune: ['Углеводородные дюны', .08, 0, 0, 0, 0],
  lichen: ['Лишайниковая пустошь', .1, 50, .01, 0, 0], moss: ['Мхи / первичная почва', .1, 200, .05, 0, 0],
  ocean: ['Открытый океан', .06, 300, .1, 0, 0], shelf: ['Мелководье / шельф', .08, 500, .3, 0, 0], coral: ['Коралловые рифы', .1, 300, .5, 0, 0],
  seaice: ['Морской лёд', .7, 0, 0, 0, 0], farm: ['Пашни / пастбища', .15, 100, 0, 100, 1], city: ['Город / застроенная территория', .05, 0, 0, 0, 1],
});
// Переходы: [откуда, куда, условие]. Переменные: T — средняя °C, P — осадки мм/год, co2/o2 — % атмосферы, atm — давление, wat — вода %, pol — загрязнение %, sea — подъём моря, м.
// Условие — «A>x&B<y» (все должны выполняться). Распашка, города, затопление и катастрофы идут отдельно.
export const BTRANS = gd('regions', 'biomeTrans', [
  ['trop', 'tropS', 'P<1800'], ['trop', 'swamp', 'P>2700'], ['trop', 'fungi', 'co2>60&o2<10'],
  ['tropS', 'sav', 'P<900'], ['tropS', 'trop', 'P>2200'],
  ['sav', 'semi', 'P<450'], ['sav', 'tropS', 'P>1100'],
  ['decid', 'mixed', 'T<9'], ['decid', 'meadow', 'P<550'], ['decid', 'fungi', 'co2>60&o2<10'],
  ['mixed', 'taiga', 'T<4'], ['mixed', 'decid', 'T>11'],
  ['taiga', 'tundra', 'T<-12'], ['taiga', 'mixed', 'T>6'],
  ['meadow', 'steppe', 'P<350'], ['meadow', 'decid', 'P>650'],
  ['steppe', 'semi', 'P<220'], ['steppe', 'meadow', 'P>450'],
  ['semi', 'sand', 'P<80'], ['semi', 'steppe', 'P>280&T<25'], ['semi', 'sav', 'P>550&T>20'],
  ['sand', 'semi', 'P>120'], ['rockd', 'semi', 'P>150'], ['salt', 'rockd', 'P<50'], ['salt', 'semi', 'P>200'],
  ['swamp', 'peat', 'T<13'], ['swamp', 'trop', 'P<1300&T>20'], ['swamp', 'meadow', 'P<1300&T<20'],
  ['peat', 'swamp', 'T>16'], ['peat', 'tundra', 'T<-2'], ['mangr', 'coast', 'T<18'],
  ['coast', 'fjord', 'T<3'], ['coast', 'mangr', 'T>22&P>1000'], ['fjord', 'coast', 'T>7'], ['fjord', 'glac', 'T<-12'],
  ['delta', 'swamp', 'P>1600'],
  ['tundra', 'perma', 'T<-17'], ['tundra', 'taiga', 'T>-8'], ['tundra', 'peat', 'P>650&T>2'],
  ['perma', 'glac', 'T<-27&P>200'], ['perma', 'tundra', 'T>-13'],
  ['glac', 'perma', 'T>-8'], ['glac', 'snow', 'P<130'], ['snow', 'glac', 'P>170'], ['snow', 'tundra', 'T>-18'],
  ['mount', 'glac', 'T<-12'], ['fungi', 'decid', 'o2>13&co2<50'], ['fungi', 'swamp', 'co2<50'],
  ['rad', 'burnt', 'pol<60'], ['rad', 'swamp', 'pol<40&P>1500'],
  ['burnt', 'semi', 'T<37&P>120'], ['burnt', 'meadow', 'T<37&P>450'],
  ['trop', 'burnt', 'T>42&P<200'], ['decid', 'burnt', 'T>42&P<200'], ['meadow', 'burnt', 'T>42&P<200'], ['farm', 'burnt', 'T>42'],
  ['farm', 'semi', 'P<200'],
  ['rdust', 'lichen', 'atm>0.1&T>-28&wat>1'], ['rdust', 'salt', 'wat>1&T>2'], ['rdust', 'subice', 'T<-65'],
  ['canyon', 'subice', 'T<-65'], ['canyon', 'shelf', 'atm>0.3&T>2&wat>5'], ['co2cap', 'rdust', 'T>-115'],
  ['subice', 'lichen', 'atm>0.1&T>-28'], ['subice', 'swamp', 'T>2&atm>0.5'], ['subice', 'shelf', 'T>2&atm>0.3&wat>5'],
  ['river0', 'subice', 'T<-5'], ['river0', 'delta', 'atm>0.3&T>2&P>300'], ['basalt', 'lichen', 'atm>0.1&T>-28&wat>1'],
  ['shadow', 'subice', 'T>-200'], ['ishld', 'icrack', 'T>-120'], ['mlake', 'subice', 'T>-90'], ['hdune', 'ishld', 'T<-185'],
  ['lichen', 'moss', 'atm>0.35&T>-8&o2>1&P>120'], ['lichen', 'rdust', 'atm<0.08'], ['lichen', 'rdust', 'T<-33'],
  ['moss', 'tundra', 'atm>0.55&o2>5&T>-18&P>150'], ['moss', 'lichen', 'atm<0.28'], ['moss', 'lichen', 'T<-13'],
  ['ocean', 'seaice', 'T<-4'], ['shelf', 'seaice', 'T<-4'], ['shelf', 'coral', 'T>22&T<28&co2<0.08'], ['seaice', 'shelf', 'T>0'],
  ['coral', 'shelf', 'T>30'], ['coral', 'shelf', 'T<18'], ['coral', 'shelf', 'co2>0.12'],
]);
// параметры: RATE — км² в год на переход; FARM — пашни км² на млн жителей; CITY — км² города на млн жителей и на здание; POL — % загрязнения в год на ТЭС-эквивалент на 1 млн км² (таблица: 0,5% на ТЭС; откалибровано под Землю 2030: ~5–15%, ≈0,1% смертности), очистка 2% в год
export const BP = gd('regions', 'biomePar', {RATE: 100, FARM: 1500, CITY: 1000, CITY_BLD: 10, POL: .0013, CLEAN: .02, POL_MORT: 1e-4, ALB_K: 100});
// наклон оси (°) и широты регионов Земли — для размаха температур
const TILT = {earth: 23.4, mars: 25.2, venus: 2.6, mercury: .03, luna: 1.5, titan: 26.7, europa_j: .1, ganymede: .2, callisto: .2, io: .05, enceladus: 0, triton: 30, pluto: 57};
const LAT_E = [45, -15, 50, 5, 28, 40, 20, -25];
const P0_E = [700, 1600, 800, 700, 200, 900, 1100, 500]; // осадки регионов Земли 2030, мм/год

// стартовые ландшафты региона (доли суши)
function startMix(id, T, i, n) {
  const m = {}, add = (k, v) => { if (v > 0) m[k] = (m[k] || 0) + v; };
  if (id === 'earth') { const d = T.desert || 0, c = T.cold || 0, h = T.hot || 0, mt = T.mtn || 0, cs = (T.coast || 0) * .05;
    add('sand', d * .5); add('rockd', d * .3); add('semi', d * .2);
    add('tundra', c * .35); add('taiga', c * .35); add('perma', c * .2); add('glac', c * .1);
    add('trop', h * .45); add('tropS', h * .25); add('sav', h * .25); add('swamp', h * .05);
    add('mount', mt * .4); add('alpine', mt * .6); add('coast', cs * .7); add(h > .3 ? 'mangr' : 'fjord', cs * .1); add('delta', cs * .2);
    const rest = Math.max(0, 1 - d - c - h - mt - cs), t = T.t ? T.t[0] : 10;
    if (t > 20) { add('sav', rest * .5); add('tropS', rest * .5); } else if (t > 10) { add('decid', rest * .4); add('meadow', rest * .3); add('steppe', rest * .3); } else { add('mixed', rest * .5); add('taiga', rest * .3); add('peat', rest * .2); }
    return m; }
  const pol = /полярн|шапк/i.test(T.n), mix = {
    mars: pol ? {co2cap: .4, subice: .4, rdust: .2} : {rdust: .5, canyon: .1, basalt: .2, river0: .12, subice: .08},
    venus: {acid: .4, sulf: .15, vplat: .2, vhp: .15, vtox: .1}, luna: {regol: .5, crater: .25, lmare: .15, arock: .08, shadow: .02}, mercury: {regol: .5, crater: .25, lmare: .15, arock: .08, shadow: .02},
    europa_j: {ishld: .7, icrack: .2, subocn: .05, geys: .05}, enceladus: {ishld: .6, icrack: .2, subocn: .05, geys: .15}, titan: {mlake: .2, hdune: .4, ishld: .4},
    ganymede: {ishld: .6, crater: .3, icrack: .1}, callisto: {ishld: .5, crater: .5}, io: {vplat: .5, sulf: .5}, triton: {ishld: .8, geys: .2}, pluto: {ishld: .9, crater: .1}}[id] || {regol: .7, crater: .3};
  for (const k in mix) add(k, mix[k]); return m;
}
const OCEAN0 = {ocean: 330e6, shelf: 24e6, coral: .3e6, seaice: 7e6}; // Мировой океан Земли, км²
// ландшафты тела: state.bio[id] = {reg: [{km: {биом: км²}, pol, P, T, ...}], ocean: {...}, U0, A0}
export function bioOf(id) {
  const S = state.bio || (state.bio = {}); if (S[id]) return S[id];
  const R = regTemplate(id); if (!R || !R.length) return null;
  const B = {reg: R.map((T, i) => { const land = T.land || T.area || 0, mix = startMix(id, T, i, R.length), km = {}; for (const k in mix) km[k] = mix[k] * land; return {km, pol: 0}; }), ocean: id === 'earth' ? {...OCEAN0} : {}};
  S[id] = B; humanTick(id, B, 1, true); stats(id, B); B.U0 = B.U; B.A0 = B.reg.map(r => r.alb); return B;
}
const KM = r => Object.values(r.km).reduce((a, b) => a + b, 0);
function move(r, from, to, q) { const v = Math.min(r.km[from] || 0, q); if (!(v > 0)) return 0; r.km[from] -= v; r.km[to] = (r.km[to] || 0) + v; if (r.km[from] < 1e-6) delete r.km[from]; return v; }
// города и пашни — за населением региона: расширяются из плодородных/любых ландшафтов, при падении населения — забрасываются
const FERT_FROM = ['meadow', 'steppe', 'sav', 'delta', 'decid', 'tropS', 'trop', 'mixed'];
function humanTick(id, B, y, init) {
  const R = regsOf(id); if (!R) return;
  B.reg.forEach((r, i) => { const popM = (R[i] && R[i].n || 0) / 1e6, bld = id === 'earth' ? Object.keys(state.bldReg || {}).reduce((a, t) => a + bReg(t, i), 0) : 0; // здания региона
    const land = KM(r), city = Math.min(land * .3, popM * BP.CITY + bld * BP.CITY_BLD), farm = id === 'earth' || (r.km.farm || 0) > 0 || r.km.meadow ? Math.min(land * .4, popM * BP.FARM) : 0;
    const go = (k, want) => { const cur = r.km[k] || 0, sp = init ? 1 : Math.min(1, .02 * y * 50); // к цели — до 2% цели в год
      if (want > cur) { let need = (want - cur) * sp; for (const f of (k === 'farm' ? FERT_FROM : [...FERT_FROM, 'farm', 'semi', 'steppe', 'coast', 'taiga', 'sand', 'rockd'])) { if (need <= 0) break; need -= move(r, f, k, need); } if (need > 0 && k === 'city') for (const f in r.km) if (f !== 'city') { need -= move(r, f, k, need); if (need <= 0) break; } }
      else if (cur > want * 1.05) move(r, k, k === 'city' ? 'burnt' : (r.P || 600) > 450 ? 'meadow' : 'steppe', (cur - want) * sp * .5); };
    go('city', city); if (farm > 0) go('farm', farm); });
}
// условие перехода
const ok = (cond, v) => cond.split('&').every(c => { const m = c.match(/^(\w+)([<>])(-?[\d.]+)$/); if (!m) return false; const x = v[m[1]]; return x != null && (m[2] === '<' ? x < +m[3] : x > +m[3]); });
// альбедо, поглощение, биомасса, плодородие, непригодная доля
function stats(id, B) { let U = 0;
  for (const r of B.reg) { let a = 0, s = 0, bio = 0, fert = 0, bad = 0, u = 0; for (const k in r.km) { const b = BIOMES[k] || ['', .2, 0, 0, 0, 0], v = r.km[k]; a += b[1] * v; s += v; u += b[2] * v; bio += b[3] * v; fert += b[4] / 100 * v; if (!b[5]) bad += v; }
    r.alb = s > 0 ? a / s : .2; r.U = u; r.bio = bio; r.fert = fert; r.bad = s > 0 ? bad / s : 1; U += u; }
  for (const k in B.ocean) U += ((BIOMES[k] || [])[2] || 0) * B.ocean[k]; B.U = U; }
// климат региона для переходов и панели
export function regBioClim(id, i) {
  const B = bioOf(id); if (!B) return null; const r = B.reg[i], T = regTemplate(id)[i], b = climateBase(id), c = state.clim && state.clim[id], n = B.reg.length;
  const dT = (c && c.dT || 0) * (T.amp || 1), dAlb = -(BP.ALB_K || 100) * ((r.alb || 0) - (B.A0 ? B.A0[i] : r.alb || 0));
  const mean = (T.t ? T.t[0] : b.mean + (T.lat || 0) * (b.amp || 0)) + dT + dAlb;
  const lat = id === 'earth' ? LAT_E[i] || 0 : (i + .5) / n * 180 - 90, wf = id === 'earth' ? .3 : Math.min(1, (b.wcov || 0)), p = b.p || 0;
  const daily = 3 * (b.day || 24) / (1 + 5 * p) * (1 - .7 * wf), seas = 2.5 * (TILT[id] || 0) * Math.abs(Math.sin(lat * Math.PI / 180)) * (1 - .7 * wf), rng = Math.min(300, daily + seas);
  const vap = c && c.reg && c.reg[i] ? c.reg[i].rain || 0 : 0, P = Math.max(0, ((id === 'earth' ? P0_E[i] || 600 : 0) + vap * 1000) * Math.pow(1.07, (mean - (T.t ? T.t[0] : mean)))) ;
  const land = KM(r) || 1, wat = ((r.km.swamp || 0) + (r.km.delta || 0) + (r.km.subice || 0) * .3 + (r.km.shelf || 0) + (r.km.subocn || 0)) / land * 100 + P / 100;
  const gas = b.gas || {}, co2 = ((gas.co2 || 0) + (c && c.co2_0 ? (c.co2 - c.co2_0) / Math.max(1, b.atmT) * (29 / 44) : 0)) * 100, o2 = (gas.o2 || 0) * 100 + (c && c.o2add ? c.o2add / Math.max(1, b.atmT) * 100 : 0);
  const h = id === 'earth' ? LAT_H[i] || 500 : Math.round(1000 * (T.mtn || 0) * 3), co2r = co2 * (1 + .002 * (r.pol || 0)); // атмосфера региона: планета + выбросы региона
  return {mean, min: mean - rng / 2, max: mean + rng / 2, rng, P, wat, co2, co2r, o2, atm: p, pol: r.pol || 0, sea: c ? c.sea || 0 : 0, alb: r.alb, bad: r.bad, bio: r.bio, fert: r.fert, h};
}
// ТЭС-эквиваленты Земли (по смеси станций) — источник загрязнения, по регионам — пропорционально рабочим местам
const LAT_H = [720, 600, 340, 600, 900, 960, 400, 340]; // средняя высота регионов Земли, м
const bReg = (t, i) => ((state.bldReg && state.bldReg[t]) || [])[i] || 0; // ваши здания в регионе
const tpsN = () => (state.govMix && state.govMix.tps || 0) + (state.corps || []).reduce((a, c) => a + ((c.civ && c.civ.pmix && c.civ.pmix.tps) || 0), 0);
// Годовой шаг (вызывать раз в месяц с y = доля года)
export function bioTick(id, y) {
  const B = bioOf(id); if (!B) return; const R = regsOf(id), jw = R ? R.reduce((a, r) => a + (r.jw || 0), 0) || 1 : 1, nT = id === 'earth' ? tpsN() : 0, c = state.clim && state.clim[id];
  humanTick(id, B, y, false);
  B.reg.forEach((r, i) => { const land = KM(r) / 1e6 || 1, src = nT * ((R && R[i] && R[i].jw) || 0) / jw + (id === 'earth' ? bReg('tps', i) : 0); // ТЭС мира — по рабочим местам, ваши — где построены
    if (r.pol0 == null) { r.pol0 = 1; r.pol = BP.POL * src / land / BP.CLEAN; } // старт — в равновесии
    r.pol = Math.max(0, r.pol + (BP.POL * src / land - BP.CLEAN * r.pol) * y); // загрязнение: выбросы ТЭС региона − 2% в год очистки
    const v = regBioClim(id, i); r.T = v.mean; r.P = v.P;
    if (v.pol > 80) for (const k in r.km) if (k !== 'rad' && k !== 'city') move(r, k, 'rad', BP.RATE * y); // катастрофа загрязнения
    if (v.sea > 0) for (const k of ['swamp', 'coast', 'mangr', 'delta', 'farm', 'city']) move(r, k, 'flood', BP.RATE * y * Math.min(5, v.sea)); // рост моря
    for (const [f, t, cond] of BTRANS) if (r.km[f] > 0 && ok(cond, {T: v.mean, P: v.P, co2: v.co2, o2: v.o2, atm: v.atm, wat: v.wat, pol: v.pol, sea: v.sea})) { const q = move(r, f, t, BP.RATE * y); if (q > 0 && (BIOMES[t] || [])[5] !== (BIOMES[f] || [])[5]) r.chg = (r.chg || 0) + q; } });
  if (id === 'earth' && B.ocean) { const T = (c && c.dT || 0) + 15; for (const [f, t, cond] of BTRANS) if (B.ocean[f] > 0 && ok(cond, {T, P: 1000, co2: .042 + (c ? (c.co2 - c.co2_0) / 5.15e15 * (29 / 44) * 100 : 0), sea: c ? c.sea : 0})) { const q = Math.min(B.ocean[f], BP.RATE * y); B.ocean[f] -= q; B.ocean[t] = (B.ocean[t] || 0) + q; } }
  stats(id, B);
  if (c) { const dU = (B.U - (B.U0 || B.U)) * y; c.co2 = Math.max(0, c.co2 - dU); if (dU > 0) c.o2add = (c.o2add || 0) + dU * 32 / 44; } // поглощение сверх стартовой картины (леса, лишайники) — минус CO₂, плюс кислород
}
// смертность от загрязнения (+0,01% в год за каждый 1%), средняя по населению
export function polMort(id) { const B = state.bio && state.bio[id], R = regsOf(id); if (!B || !R) return 0; let s = 0, n = 0; B.reg.forEach((r, i) => { const m = (R[i] && R[i].n) || 0; s += (r.pol || 0) * m; n += m; }); return n > 0 ? BP.POL_MORT * s / n : 0; }
hooks.bioTick = bioTick; hooks.polMort = polMort; hooks.regBioClim = (id, i) => { const B = state.bio && state.bio[id]; return B ? regBioClim(id, i) : null; };
