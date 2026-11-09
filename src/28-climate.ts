// @ts-nocheck
// Живой климат любого тела с атмосферой. Шаг — раз в месяц вместе с экономикой колонии.
// CO2: люди + заводы (по видам) → атмосфера тела; океан и суша поглощают часть избытка.
// Температура тянется к равновесной (3 °C на удвоение CO2 для Земли, слабее в тонкой атмосфере) с инерцией океана.
// Тепло топит ледники → уровень моря растёт → города уходят под воду (люди теряют жильё, заводы гибнут).
// Пар: датацентры (и любые источники addVapor) — короткоживущий парниковый газ, копится по регионам; много пара — вечные дожди.
import { state, log } from './01-data.ts';
import { climateBase } from './14-climate.ts';
import { regNames } from './30-regions.ts';

const GT = 1e9, YR = 360;
export const PEOPLE_CO2 = 1.4;                    // т CO2 на человека в год (быт, транспорт)
export const EF = {energy: 6, semi: 2.5, ind: 1.2, life: .8, cons: .6}; // выбросы по виду производства (энергетика грязнее всех)
export const FAC_CO2 = 6.6e4;                     // т CO2 в год на «завод-эквивалент» при EF = 1 (Земля 2030 ≈ 37 Гт/год вместе с людьми)
const SINK = .02, TAU_T = 30, TAU_SEA = 150, VAP_LIFE = 9 / YR; // поглощение избытка CO2 в год; инерция, лет; жизнь пара, лет
const ICE_M = {earth: 70, mars: 11};              // сколько метров даст весь растаявший лёд
const flooded = h => .32 * (1 - Math.exp(-h / 25)); // доля населения ниже h метров над морем (Земля)

export function clim(id) {
  const C = state.clim || (state.clim = {});
  if (C[id]) return C[id];
  const b = climateBase(id); if (!(b.atmT > 1e10)) return null; // без атмосферы климата нет: выбросы уходят в космос
  const co2 = b.gasT.co2 || 0;
  return (C[id] = {co2, co2_0: co2, pi: id === 'earth' ? co2 * 280 / 420 : co2, /* доиндустриальный уровень: к нему тянет поглощение */ dT: 0, sea: 0, fl: 0, vap: 0, rain: 0, emY: 0, reg: regNames(id).map(n => ({n, vap: 0, dc: 0, rain: 0}))});
}
export const ppm = (id) => { const c = clim(id), b = climateBase(id); return c ? c.co2 / b.atmT * (29 / 44) * 1e6 : 0; };
// чувствительность: Земля 3 °C на удвоение; тонкая атмосфера слабо держит тепло, сверхплотная уже насыщена
const sens = b => 3 * Math.min(1, Math.sqrt(Math.max(b.p, 1e-4))) * (b.p > 10 ? 10 / b.p : 1);
// Источник пара в регионе (т/год): датацентры и пр. Вызывать при постройке/сносе.
export function addVapor(id, reg, tY) { const c = clim(id); if (!c) return; const r = c.reg[Math.min(reg | 0, c.reg.length - 1)]; r.dc = Math.max(0, r.dc + tY); }

// Месячный шаг колонии: P — экономика колонии, goods — реестр товаров, fe(g) — сколько «заводов» реально работает на товар.
export function climTick(id, P, goods, fe, dt) {
  const c = clim(id); if (!c) return;
  const b = climateBase(id), y = dt / YR;
  let ind = 0; for (const g in goods) ind += fe(g) * (EF[goods[g].kind] || 1);
  const em = ((P.n || 0) * PEOPLE_CO2 + ind * FAC_CO2) * y;
  c.emY = em / y; c.co2 += em - Math.max(0, c.co2 - (c.pi || c.co2_0)) * SINK * y;
  // пар: сколько висит в воздухе = источник × время жизни; региональная концентрация → дожди
  let vap = 0; for (const r of c.reg) { r.vap = r.dc * VAP_LIFE; vap += r.vap; r.rain = r.vap / (b.atmT * 2e-6 / c.reg.length); }
  c.vap = vap; c.rain = Math.max(...c.reg.map(r => r.rain));
  for (const r of c.reg) if (r.rain > 1 && !r.wet) { r.wet = true; log(`Климат: ${r.n} — пара так много, что дожди не прекращаются.`); } else if (r.rain < .7) r.wet = false;
  const eq = sens(b) * Math.log2(Math.max(1e-9, c.co2) / Math.max(1e-9, c.co2_0)) + 2 * Math.log2(1 + vap / (b.atmT * 1e-5));
  c.dT += (eq - c.dT) * Math.min(1, y / (b.water > 1e15 ? TAU_T : 1));
  // лёд и море
  const iceM = ICE_M[id] != null ? ICE_M[id] : (b.water > 1e15 ? 5 : 0);
  if (iceM > 0) { const seaEq = Math.min(iceM, Math.max(0, c.dT) * 10); c.sea += (seaEq - c.sea) * (seaEq > c.sea ? y / TAU_SEA : 0); }
  const f1 = b.wcov > 0 ? flooded(c.sea) : 0, df = f1 - c.fl; c.fl = f1;
  if (df > 0) { // затопление: доля людей и заводов, оказавшихся ниже воды
    P.evDem = P.evDem || {}; P.evDem.house = Math.min(3, (P.evDem.house || 1) + df * 20); // жильё для переселенцев
    for (const g in P.fac) P.fac[g] = Math.max(0, P.fac[g] * (1 - df));
    for (const co of state.corps || []) if (co.civ && co.civ.fac) for (const g in co.civ.fac) co.civ.fac[g] = Math.floor(co.civ.fac[g] * (1 - df) + Math.random());
    if (Math.floor(c.sea) > (c.seaLog || 0)) { c.seaLog = Math.floor(c.sea); log(`Климат: уровень моря поднялся на ${c.seaLog} м. Под водой ${Math.round(f1 * 1000) / 10}% городов.`); }
  } else if (P.evDem && P.evDem.house > 1) P.evDem.house = Math.max(1, P.evDem.house - .05 * dt / 30);
}
// Поправки к жизни: жара повышает смертность и снижает выработку
export const heatDeath = id => { const c = state.clim && state.clim[id]; return c ? 1 + .03 * Math.max(0, c.dT - 1.5) : 1; };
export const heatWork = id => { const c = state.clim && state.clim[id]; return c ? 1 - .02 * Math.max(0, c.dT - 2) : 1; };
