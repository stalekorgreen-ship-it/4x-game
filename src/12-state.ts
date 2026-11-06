// @ts-nocheck
// Государство и финансы: законы (налоги, субсидии), кредиты, банкротства и поглощения, патенты, кризисы.
import { log, state, fmtN } from './01-data.ts';
import { FACT_COST, GOODS, clampN } from './07-population.ts';
import { CTECH, LAB_COST, MINE_COST, YARD_COST, rpPrice } from './10-civil.ts';
import { $, esc, setHtml } from './08-map-ui.ts';

export const LAW_DEFAULT = {tax: 20, subInd: 0, subSci: 0, subSpace: 0};
export const BANK_RATE = .12, PLAYER_RATE = .06;
// Детерминированный генератор случайных чисел (чтобы игры и тесты воспроизводились)
export function rnd() { let a = state.rng = ((state.rng === undefined ? 12345 : state.rng) + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }
export const laws = () => state.laws || (state.laws = {...LAW_DEFAULT});
// Субсидия: государство берёт на себя долю расхода корпорации, если у вас хватает кредитов.
export function pay(c, cost, kind) {
  const sub = (laws()[kind] || 0) / 100, s = cost * sub;
  if (s > 0 && state.money >= s) { state.money -= s; c.credits -= cost - s; state.subSpent = (state.subSpent || 0) + s; } else c.credits -= cost;
}
export const assets = c => { const v = c.civ; let f = 0; for (const g in v.fac) f += v.fac[g]; let m = 0; for (const r in v.mines) m += v.mines[r]; return (f * FACT_COST + (v.labs || 0) * LAB_COST + m * MINE_COST + (v.yard ? YARD_COST : 0)) * .5; };
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
  {k: 'harvest', name: 'Неурожай', months: 6, text: 'Выпуск еды −25%'},
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
    if (e.k === 'harvest') P.evMult.food = (P.evMult.food || 1) * .75;
    if (e.k === 'energy') P.evMult.pow = (P.evMult.pow || 1) * .8;
    if (e.k === 'epidemic') P.evDem.med = (P.evDem.med || 1) * 1.5;
    if (e.k === 'strike') { const c = state.corps.find(x => x.id === e.corp); if (c) c.civ.strikeUntil = e.until; }
  }
}

/* --- вкладка «Законы» --- */
export function refreshLaws() {
  const p = $('p-laws'); if (!p || !state.pop) return;
  const L = laws(), P = state.pop;
  if (!p._built) {
    p._built = true;
    const row = (k, name, min, max, hint) => `<div class="dcol" style="gap:2px"><div class="row"><b class="grow">${name}</b><span class="mono" id="lv-${k}">${L[k]}%</span></div><input type="range" data-law="${k}" min="${min}" max="${max}" step="1" value="${L[k]}" style="width:100%"><div class="help">${hint}</div></div>`;
    p.innerHTML = `<div class="box"><h2>Налоги и субсидии</h2>${row('tax', 'Налог на зарплаты', 5, 40, 'Базовая ставка 20%. Выше: кредитов у вас больше, но доходы людей и довольство падают. Ниже: наоборот.')}
      ${row('subInd', 'Субсидия промышленности', 0, 50, 'Государство оплачивает долю строительства заводов и шахт корпораций (из ваших кредитов).')}
      ${row('subSci', 'Субсидия науке', 0, 50, 'Доля стоимости лабораторий, которую платите вы.')}
      ${row('subSpace', 'Субсидия космосу', 0, 50, 'Доля стоимости кораблей и станций корпораций, которую платите вы.')}<div id="lw-st"></div></div>
      <div class="box"><h2>События</h2><div id="lw-ev"></div></div><div class="box"><h2>Ваши кредиты корпорациям</h2><div id="lw-ln"></div></div>`;
  }
  setHtml($('lw-st'), `<div class="stats"><span>Налоги в сутки</span><span>${fmtN(P.tax)} кр</span><span>Потрачено на субсидии</span><span>${fmtN(state.subSpent || 0)} кр</span><span>Доход с кредитов</span><span>${fmtN(state.loanInc || 0)} кр</span></div>`);
  const ev = P.ev || [];
  setHtml($('lw-ev'), (ev.length ? ev.map(e => { const d = EVENTS.find(x => x.k === e.k); return `<div class="row"><span class="grow">${d.name}</span><span class="muted">${d.text} · ещё ${fmtN((e.until - state.t) / 30, 1)} мес.</span></div>`; }).join('') : `<div class="help">Сейчас кризисов нет.</div>`) + `<div class="help">Банкротств: ${state.bankr || 0}. Лицензий куплено: ${state.licenses || 0}.</div>`);
  const ls = state.loans || [];
  setHtml($('lw-ln'), ls.length ? ls.map(l => { const c = state.corps.find(x => x.id === l.corp); return `<div class="row"><span class="grow">${c ? esc(c.name) : '—'}</span><span class="mono">${fmtN(l.p)} кр · ${l.r * 100}%</span></div>`; }).join('') : `<div class="help">Нет. Выдать кредит можно во вкладке «Корпорации», выбрав корпорацию.</div>`);
}
(function lawEvents() {
  const p = document.getElementById('p-laws');
  p.addEventListener('input', e => { const k = e.target.dataset && e.target.dataset.law; if (k) { laws()[k] = +e.target.value; const el = $('lv-' + k); if (el) el.textContent = laws()[k] + '%'; } });
})();
