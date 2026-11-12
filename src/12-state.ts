// @ts-nocheck
import { gd } from './00-gd.ts';
import { BTYPES, BUDGET_LAWS, budgetHtml, lawEff } from './38-budget.ts';
import { hooks } from './00-hooks.ts';
// Государство и финансы: законы (налоги, субсидии), кредиты, банкротства и поглощения, патенты, кризисы.
import { log, state, fmtN } from './01-data.ts';
import { FACT_COST, GOODS, clampN } from './07-population.ts';
import { CTECH, LAB_COST, MINE_COST, YARD_COST, rpPrice } from './10-civil.ts';
import { $, esc, setHtml } from './08-map-ui.ts';

export const LAW_DEFAULT = gd('economy', 'laws', {tax: 20, subInd: 0, subSci: 0, subSpace: 0, minWage: 0, hours: 40, edu: 0, tariff: 0, birthSup: 0, pension: 0, mineTax: 0, space: .5, inv: 3, mEdu: 8, mMed: 8, mSoc: 10, mInf: 6, mSec: 5, mAdm: 3});
// Обязательные расходы государства (решено с владельцем): доля дохода казны, ниже минимума опустить нельзя
export const MAND = gd('economy', 'mandatory', [['mEdu', 'Образование: школы и вузы', 8, 'Выше минимума: обучение дешевле для семей — больше людей с высшим образованием.'], ['mMed', 'Медицина и клиники', 8, 'Выше минимума: смертность ниже (−1% за каждый процент сверх минимума).'], ['mSoc', 'Пенсии и соцзащита', 10, ''], ['mInf', 'Дороги и ЖКХ', 6, ''], ['mSec', 'Полиция и оборона', 5, ''], ['mAdm', 'Госаппарат', 3, '']]);
export const mandK = () => { const L = laws(); let s = 0; for (const [k, , m] of MAND) s += Math.max(m, L[k] == null ? m : L[k]); return Math.min(.9, s / 100); };
export const mandOver = k => { const L = laws(), m = MAND.find(x => x[0] === k)[2]; return Math.max(0, (L[k] == null ? m : L[k]) - m); };
export const BANK_RATE = .12, PLAYER_RATE = .06;
// Детерминированный генератор случайных чисел (чтобы игры и тесты воспроизводились)
export function rnd() { let a = state.rng = ((state.rng === undefined ? 12345 : state.rng) + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const laws = () => state.laws || (state.laws = {...LAW_DEFAULT, ...BUDGET_LAWS});
// Субсидия: государство берёт на себя долю расхода корпорации, если у вас хватает кредитов.
export function pay(c, cost, kind) {
  const sub = (laws()[kind] || 0) / 100, s = cost * sub;
  if (s > 0 && state.money >= s) { state.money -= s; c.credits -= cost - s; state.subSpent = (state.subSpent || 0) + s; } else c.credits -= cost;
}
export const assets = c => {
  const one = (v, k) => { let f = 0; for (const g in v.fac) f += v.fac[g]; let m = 0; for (const r in v.mines) m += v.mines[r]; return (f * FACT_COST + (v.labs || 0) * LAB_COST + m * MINE_COST + (v.yard ? YARD_COST : 0)) * k; };
  let a = one(c.home || c.civ, 1);
  for (const id in (c.civs || {})) a += one(c.civs[id], (state.cols && state.cols[id] && state.cols[id].pop.fs) || .01);
  return a * .5;
};
export const loansOf = c => (state.loans || []).filter(l => l.corp === c.id);

export function lendTo(c, amt) {
  if (!c || state.money < amt) return false;
  state.money -= amt; c.credits += amt; (state.loans = state.loans || []).push({corp: c.id, p: amt, r: PLAYER_RATE});
  log(`Вы выдали кредит «${c.name}»: ${fmtN(amt)} кр под ${PLAYER_RATE * 100}% годовых.`); return true;
}
// месячный финансовый шаг корпорации; true — корпорация исчезла
export function finTick(c, dt, profit) {
  const v = c.civ; v.debt = v.debt || 0; v.profit = profit;
  c.credits -= v.debt * BANK_RATE / 12 * dt / 30;
  for (const l of loansOf(c)) { const i = l.p * l.r / 12 * dt / 30; c.credits -= i; state.money += i; state.loanInc = (state.loanInc || 0) + i; }
  const monthly = Object.values(v.fac).reduce((a, b) => a + b, 0) * 1e4 * 7;
  const free = c.credits - monthly * 2;
  if (free > FACT_COST * 6) { // возвращают долги: сначала банку, потом вам
    let spare = free - FACT_COST * 4;
    const r = Math.min(v.debt, spare); v.debt -= r; c.credits -= r; spare -= r;
    for (const l of loansOf(c)) { if (spare <= 0) break; const q = Math.min(l.p, spare); l.p -= q; c.credits -= q; state.money += q; spare -= q; }
    state.loans = (state.loans || []).filter(l => l.p > 1);
  } else if (free < FACT_COST * 2 && profit > 0 && v.debt < profit * 10) { const b = Math.min(profit * 10 - v.debt, FACT_COST * 4); if (b > FACT_COST) { v.debt += b; c.credits += b; } }
  v.neg = c.credits < 0 ? (v.neg || 0) + 1 : 0;
  if (v.neg >= 4 || (c.credits + assets(c) - v.debt < 0 && v.neg >= 2)) { bankrupt(c); return true; }
  return false;
}
export function bankrupt(c) {
  const A = assets(c), cs = state.corps, buyer = cs.filter(x => x !== c && x.credits > A * .6).sort((a, b) => b.credits - a.credits)[0];
  const rec = buyer ? A * .4 : A * .1;
  let paid = 0;
  for (const l of loansOf(c)) { const q = Math.min(l.p, rec * .3); state.money += q; paid += q; }
  state.loans = (state.loans || []).filter(l => l.corp !== c.id);
  if (buyer) {
    buyer.credits -= A * .4;
    for (const g in c.civ.fac) buyer.civ.fac[g] = (buyer.civ.fac[g] || 0) + c.civ.fac[g];
    for (const r in c.civ.mines) buyer.civ.mines[r] = (buyer.civ.mines[r] || 0) + c.civ.mines[r];
    buyer.civ.labs = (buyer.civ.labs || 0) + (c.civ.labs || 0); if (!buyer.civ.yard) buyer.civ.yard = c.civ.yard;
    for (const id in (c.civs || {})) { buyer.civs = buyer.civs || {}; const o = c.civs[id], b = buyer.civs[id] || (buyer.civs[id] = {...o, fac: {}, mines: {}, pr: {}, mp: {}, sold: {}, cap: {}, unitc: {}, comp: {}, tech: buyer.civ.tech}); for (const g in o.fac) b.fac[g] = (b.fac[g] || 0) + o.fac[g]; for (const r in o.mines) b.mines[r] = (b.mines[r] || 0) + o.mines[r]; }
    for (const s of state.ships.filter(x => x.corp === c.id)) { s.corp = buyer.id; s.groupId = buyer.g[s.role]; }
    for (const s of state.stations.filter(x => x.corp === c.id)) s.corp = buyer.id;
    log(`Корпорация «${c.name}» обанкротилась. Её активы поглотила «${buyer.name}».${paid > 0 ? ' Вам вернули ' + fmtN(paid) + ' кр из кредита.' : ''}`);
  } else {
    state.ships = state.ships.filter(x => x.corp !== c.id); state.stations = state.stations.filter(x => x.corp !== c.id);
    log(`Корпорация «${c.name}» обанкротилась, активы распроданы.${paid > 0 ? ' Вам вернули ' + fmtN(paid) + ' кр из кредита.' : ''}`);
  }
  state.groups = state.groups.filter(g => g.corp !== c.id); state.corps = cs.filter(x => x !== c);
  state.bankr = (state.bankr || 0) + 1; (state.respawn = state.respawn || []).push(state.t + 360);
}
// Патенты: если у другой корпорации уже есть нужная технология, её можно купить по лицензии
export function licenseTick(c) {
  const v = c.civ; if (!v.cur) return;
  const t = CTECH.find(x => x.id === v.cur), owner = state.corps.find(o => o !== c && o.civ.tech[t.id]);
  if (!owner) return;
  const price = t.cost * rpPrice(owner) * .4;
  if (c.credits > price * 3) { c.credits -= price; owner.credits += price; owner.civ.licInc = (owner.civ.licInc || 0) + price; v.tech[t.id] = true; v.prog = 0; v.cur = null; state.licenses = (state.licenses || 0) + 1; log(`«${c.name}» купила лицензию на «${t.name}» у «${owner.name}» за ${fmtN(price)} кр.`); }
}
// Кризисы
const EVENTS = [
  {k: 'harvest', name: 'Авария водоочистки', months: 6, text: 'Выпуск воды −15%'},
  {k: 'energy', name: 'Энергетический кризис', months: 5, text: 'Выпуск энергии −20%'},
  {k: 'epidemic', name: 'Эпидемия', months: 4, text: 'Спрос на медицину ×1,5'},
  {k: 'strike', name: 'Забастовка', months: 3, text: 'Одна корпорация работает вполсилы'},
  {k: 'blast', name: 'Взрыв на заводе', months: 0, text: 'Корпорация теряет 10% заводов одного вида'},
];
export function eventTick(dt) {
  const P = state.pop; P.ev = (P.ev || []).filter(e => e.until > state.t);
  if (rnd() < .12 * dt / 30) {
    const d = EVENTS[Math.floor(rnd() * EVENTS.length)], cs = state.corps; let target = null;
    if (d.k === 'strike' || d.k === 'blast') { target = cs[Math.floor(rnd() * cs.length)]; if (!target) return; }
    if (d.k === 'blast') {
      const gs = Object.keys(target.civ.fac).filter(g => target.civ.fac[g] > 1), g = gs[Math.floor(rnd() * gs.length)];
      P.evN = (P.evN || 0) + 1;
      if (g) { const n = Math.max(1, Math.floor(target.civ.fac[g] * .1)); target.civ.fac[g] -= n; log(`Взрыв на заводе: «${target.name}» потеряла ${n} заводов («${GOODS[g].n}»).`); }
    } else {
      P.evN = (P.evN || 0) + 1; P.ev.push({k: d.k, until: state.t + d.months * 30, corp: target && target.id}); log(`Кризис: ${d.name}${target ? ' у «' + target.name + '»' : ''}. ${d.text}.`);
    }
  }
  P.evMult = {}; P.evDem = {};
  for (const e of P.ev) {
    if (e.k === 'harvest') P.evMult.water = (P.evMult.water || 1) * .85;
    if (e.k === 'energy') P.evMult.pow = (P.evMult.pow || 1) * .8;
    if (e.k === 'epidemic') P.evDem.med = (P.evDem.med || 1) * 1.5;
    if (e.k === 'strike') { const c = state.corps.find(x => x.id === e.corp); if (c) c.civ.strikeUntil = e.until; }
  }
}

/* --- вкладка «Законы» --- */
export function refreshLaws() {
  { const e = document.getElementById('lw-bud'); if (e) e.innerHTML = budgetHtml(); }
  const p = $('p-laws'); if (!p || !state.pop) return;
  const L = laws(), P = state.pop;
  if (!p._built) {
    p._built = true;
    const row = (k, name, min, max, hint, u = '%', st = 1) => `<div class="nm">${name}</div><input type="range" data-law="${k}" data-u="${u}" min="${min}" max="${max}" step="${st}" value="${L[k] || 0}"><span class="v" id="lv-${k}">${fmtN(L[k] || 0)}${u}</span><span class="d" id="ld-${k}"></span><div class="h">${hint}</div>`;
    const G = [
      ['tax', 'Налоги', row('tax', 'Налог на зарплаты', 5, 40, 'Базовая 20%. Выше — больше кредитов, но ниже доходы и довольство.') + row('vat', 'НДС', 0, 30, 'От трат населения на товары; корзина дороже.') + row('ptax', 'Налог на прибыль корпораций', 0, 50, 'Процент месячной прибыли корпораций — целиком вам.') + row('carbon', 'Углеродный налог', 0, 500, 'Кр за т CO₂ (ТЭС: 7,5 млн т/год).', ' кр/т', 5) + row('mineTax', 'Налог на добычу', 0, 50, 'Доля выручки корпоративных шахт.') + row('tariff', 'Ввозные пошлины', 0, 50, 'На ввоз в колонии; дорожает жизнь.')],
      ['labor', 'Труд', row('minWage', 'Минимальная зарплата, % базовой', 0, 150, '0 — нет. Выше рынка: доход низов растёт, но безработица и цены.') + row('hours', 'Рабочая неделя', 30, 50, 'Больше — выше выпуск, ниже рождаемость, выше смертность.', ' ч') + row('wTeach', 'Зарплата учителя (гос.)', 0, 800, '0 — по рынку. Ниже рынка — часть школ пустует.', ' кр/сут', 10) + row('wDoc', 'Зарплата врача (гос.)', 0, 800, '0 — по рынку. Ниже рынка — часть больниц пустует.', ' кр/сут', 10)],
      ['soc', 'Соцрасходы', row('edu', 'Бюджет образования', 0, 100, 'Доля платы за обучение: больше людей с высшим.') + row('birthSup', 'Поддержка рождаемости', 0, 100, 'Рождаемость до +50%.') + row('pension', 'Пенсии (доплата)', 0, 100, 'Довольство стариков.') + row('penFix', 'Обязательная пенсия', 0, 300, 'Кр в сутки каждому старше 65.', ' кр/сут', 5) + row('childFix', 'Пособие за рождение', 0, 2e6, 'До +50% рождаемости при 1 млн кр.', ' кр', 1e4) + row('unemp', 'Пособие по безработице', 0, 200, 'Кр в сутки безработному.', ' кр/сут', 5)],
      ['state', 'Госрасходы', row('space', 'Доля налогов на космос', .1, 3, 'Остальное — на земные расходы.', '%', .1) + MAND.map(([k, n, m, h]) => row(k, n + ' (мин. ' + m + '%)', m, 40, h || 'Обязательная статья.')).join('') + row('inv', 'Госинвестиции в экономику', 0, 20, 'Фонд госзаводов, госшахт, лабораторий.') + row('sciPct', 'Финансирование науки', 0, 30, 'Процент вашего бюджета на исследования.')],
      ['sub', 'Субсидии', row('subInd', 'Субсидия промышленности', 0, 50, 'Доля стройки заводов и шахт корпораций.') + row('subSci', 'Субсидия науке', 0, 50, 'Доля стоимости лабораторий.') + row('subSpace', 'Субсидия космосу', 0, 50, 'Доля стоимости кораблей и станций.') + BTYPES.map(([key, n]) => row('sub_' + key, n, 0, 5e9, 'Кр в год на здание корпораций.', ' кр/год', 5e7)).join('')],
      ['lev', 'Ставки на здания', BTYPES.filter(t => !['cb', 'green', 'house', 'yard'].includes(t[0])).map(([key, n]) => row('lev_' + key, n, 0, 5e9, 'Сбор с каждого такого здания корпораций.', ' кр/год', 5e7)).join('')],
      ['bud', 'Бюджет', '<div id="lw-bg"></div><div id="lw-st"></div><div id="lw-bud"></div>'],
      ['misc', 'События и кредиты', '<h2>События</h2><div id="lw-ev"></div><h2>Ваши кредиты корпорациям</h2><div id="lw-ln"></div>']];
    p.innerHTML = `<div class="lwtabs">${G.map(([id, n], i) => `<button class="btn sm${i ? '' : ' on'}" data-lwt="${id}">${n}</button>`).join('')}</div><div class="lwhead" id="lw-head"></div>` + G.map(([id, , h], i) => `<div class="box" data-lwg="${id}"${i ? ' hidden' : ''}>${['bud', 'misc'].includes(id) ? h : `<div class="lw">${h}</div>`}</div>`).join('');
    p.querySelectorAll('[data-law]').forEach(i => lawDelta(i.dataset.law));
  }
  lawHead();
  { let tx = 0, ex = 0, tr = 0; const eb = {edu: 0, pen: 0, bth: 0}; for (const id in state.cols) { const q = state.cols[id].pop; tx += q.tax || 0; ex += q.exp || 0; tr += q.tarDay || 0; if (q.expP) for (const k in eb) eb[k] += q.expP[k] || 0; }
    setHtml($('lw-bg'), `<div class="stats"><span>Налоги с зарплат (все колонии)</span><span>${fmtN(tx * 30)} кр/мес</span><span>Пошлины</span><span>${fmtN(tr * 30)} кр/мес</span><span>Налог на добычу (всего)</span><span>${fmtN(state.mtaxInc || 0)} кр</span><span>Образование</span><span>−${fmtN(eb.edu * 30)} кр/мес</span><span>Рождаемость</span><span>−${fmtN(eb.bth * 30)} кр/мес</span><span>Пенсии</span><span>−${fmtN(eb.pen * 30)} кр/мес</span><span>Обязательные расходы (${fmtN(mandK() * 100, 0)}% дохода)</span><span>−${fmtN((state.mandDay || 0) * 30)} кр/мес</span><span><b>Итого в месяц</b></span><span><b>${fmtN((tx + tr - ex - (state.mandDay || 0)) * 30)} кр</b></span></div>`); }
  setHtml($('lw-st'), `<div class="stats"><span>Налоги в месяц</span><span>${fmtN(P.tax * 30)} кр</span><span>Потрачено на субсидии</span><span>${fmtN(state.subSpent || 0)} кр</span><span>Доход с кредитов</span><span>${fmtN(state.loanInc || 0)} кр</span></div>`);
  const ev = P.ev || [];
  setHtml($('lw-ev'), (ev.length ? ev.map(e => { const d = EVENTS.find(x => x.k === e.k); return `<div class="row"><span class="grow">${d.name}</span><span class="muted">${d.text} · ещё ${fmtN((e.until - state.t) / 30, 1)} мес.</span></div>`; }).join('') : `<div class="help">Сейчас кризисов нет.</div>`) + `<div class="help">Банкротств: ${state.bankr || 0}. Лицензий куплено: ${state.licenses || 0}.</div>`);
  const ls = state.loans || [];
  setHtml($('lw-ln'), ls.length ? ls.map(l => { const c = state.corps.find(x => x.id === l.corp); return `<div class="row"><span class="grow">${c ? esc(c.name) : '—'}</span><span class="mono">${fmtN(l.p)} кр · ${l.r * 100}%</span></div>`; }).join('') : `<div class="help">Нет. Выдать кредит можно во вкладке «Корпорации», выбрав корпорацию.</div>`);
}
const sg = v => (v >= 0 ? '+' : '−') + fmtN(Math.abs(v), 0);
function lawDelta(k) { const el = $('ld-' + k); if (!el) return; const L = laws(), B = state.lawBase || {}, v = L[k] || 0, e = lawEff(k, v), e0 = lawEff(k, B[k] != null ? B[k] : v);
  if (e == null || Math.abs(e) < 1) { el.textContent = ''; return; } const d = e - (e0 || 0); el.innerHTML = `<span class="${e >= 0 ? 'ok' : 'err'}">${sg(e)}</span>${Math.abs(d) >= 1 ? ` <span class="${d >= 0 ? 'ok' : 'err'}">(${sg(d)})</span>` : ''}`; el.title = 'в месяц для вашей казны; в скобках — изменение к прошлому месяцу'; }
function lawHead() {
  const h = $('lw-head'), b = state.budget; if (!h) return; if (!b) { h.innerHTML = 'Цифры появятся после первого месяца.'; return; }
  const m = 30 / Math.max(1, b.days), full = x => /^(Ставка|Субсидия|Налог на прибыль|Углеродный|Налог на добычу|Финансирование|Зарплаты гос. рабочих: ваши)/.test(x);
  const sum = o => Object.entries(o).filter(([kk]) => !/^Прибыль госпредприятий/.test(kk)).reduce((a, [kk, v]) => a + v * m * (full(kk) ? 1 : b.k), 0);
  const inc = sum(b.inc), exp = sum(b.exp), L = laws(), B = state.lawBase || {};
  let d = 0; for (const k in L) { if (B[k] == null || B[k] === L[k]) continue; const e = lawEff(k, L[k]), e0 = lawEff(k, B[k]); if (e != null && e0 != null) d += e - e0; }
  const g = document.querySelector('#p-laws [data-lwg]:not([hidden])'); let si = 0, se = 0; if (g) g.querySelectorAll('[data-law]').forEach(i => { const e = lawEff(i.dataset.law, L[i.dataset.law] || 0); if (e > 0) si += e; else if (e < 0) se -= e; });
  const nx = inc - exp + d;
  h.innerHTML = `<span><b>Доход</b><span class="ok">+${fmtN(inc, 0)}</span></span><span><b>Расход</b><span class="err">−${fmtN(exp, 0)}</span></span><span><b>След. месяц</b><span class="${nx >= 0 ? 'ok' : 'err'}">${sg(nx)}</span>${Math.abs(d) >= 1 ? ` <span class="${d >= 0 ? 'ok' : 'err'}">(законы ${sg(d)})</span>` : ''}</span><span><b>Казна через мес.</b>${fmtN((state.money || 0) + nx, 0)}</span>${si || se ? `<span><b>Эта вкладка</b><span class="ok">+${fmtN(si, 0)}</span> / <span class="err">−${fmtN(se, 0)}</span></span>` : ''}<span class="muted" style="font-family:var(--sans)">кр/мес, ваша доля</span>`;
}
(function lawEvents() {
  const p = document.getElementById('p-laws');
  p.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.law; if (k) { laws()[k] = +e.target.value; const el = $('lv-' + k); if (el) el.textContent = fmtN(laws()[k]) + (e.target.dataset.u || '%'); lawDelta(k); lawHead(); } });
  p.addEventListener('click', e => { const t = e.target.closest('[data-lwt]'); if (!t) return; p.querySelectorAll('[data-lwt]').forEach(x => x.classList.toggle('on', x === t)); p.querySelectorAll('[data-lwg]').forEach(x => x.hidden = x.dataset.lwg !== t.dataset.lwt); lawHead(); });
})();

hooks.mandK = mandK; hooks.mandOver = mandOver;
