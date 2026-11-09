// @ts-nocheck
// Грузовые заказы: игрок заказывает доставку на любое тело, корпорации со свободным грузовым флотом берутся за работу и зарабатывают.
// Колонисты возят корпорации сами, без контроля игрока.
import { tm } from './15-techs.ts';
import {colonyCost} from './14-climate.ts';
import { BODIES, BODY, RES, dist, fmtN, log, objPos, rec, state } from './01-data.ts';
import { KR } from './00-kr.ts';
import { hooks } from './00-hooks.ts';
import { addSettlers, settle } from './07-population.ts';
import { addRegInfra, regNames } from './30-regions.ts';
import { $, esc, setHtml, ui } from './08-map-ui.ts';

export const INFRA_PRICE = 800 * KR, FARE = 2 * KR, SPEED = 0.04, TICKET = 100 * KR; // кр/т инфраструктуры, кр за т·а.е., а.е. в сутки, кр за колониста
export const ITEMS = () => [['infra', 'Инфраструктура'], ...Object.keys(RES).filter(k => k !== 'spares').map(k => [k, RES[k]])];
export const itemName = k => k === 'infra' ? 'Инфраструктура' : k === 'col' ? 'Колонисты' : (RES[k] || k);
export const cargoBodies = () => BODIES.filter(b => ['hub', 'planet', 'moon', 'ast'].includes(b.kind) && !b.comet && !b.strange);
const bdist = (a, b) => dist(objPos(a, state.t), objPos(b, state.t));
export const fareOf = (a, b) => Math.max(1, FARE * bdist(a, b) * tm('fare'));
const FR = () => state.freight || (state.freight = {orders: [], flights: [], acc: 0, n: 0});
const depot = id => (state.depot || (state.depot = {}))[id] || (state.depot[id] = {});
const facs = c => { const v = c.home || c.civ; let n = 0; if (v) for (const g in v.fac) n += v.fac[g]; return n; };
const capOf = c => 300 + 30 * facs(c);
const cf = c => .8 + ((c.id * 37) % 50) / 100;
const usedBy = c => FR().flights.filter(f => f.corp === c.id && f.item !== 'col').reduce((a, f) => a + f.amt, 0);

export function orderCargo(item, amt, from, to, reg) {
  amt = Math.floor(+amt); if (!(amt > 0) || from === to || !BODY[from] || !BODY[to]) return false;
  const F = FR(); F.orders.push({id: ++F.n, item, amt, left: amt, from, to, t: state.t, got: 0, reg: reg === '' || reg == null ? null : +reg}); return true;
}
export function dispatchColonists(to, q) { // игрок не управляет: корпорация везёт поселенцев с Земли
  const F = FR(), cs = state.corps || [], c = cs.length ? cs[F.n++ % cs.length] : null, d = Math.max(2, bdist('earth', to) / (SPEED * tm('fspeed'))); // без корпораций везёт государство
  F.flights.push({corp: c ? c.id : null, item: 'col', amt: q, to, arrive: state.t + d, oid: 0}); if (c) c.credits += q * TICKET;
  if (state.cols[to]) { const P = state.cols[to].pop; P.inflight = (P.inflight || 0) + q; } return true;
}
hooks.sendColonists = dispatchColonists;
function deliver(f) {
  if (f.item === 'col') { if (state.cols[f.to]) addSettlers(f.to, f.amt); else settle(f.to, f.amt); return; }
  const col = state.cols && state.cols[f.to];
  if (f.item === 'infra' && col) { addRegInfra(f.to, f.amt, f.reg); const P = col.pop, per = colonyCost(f.to).per; for (const g in P.cap) P.cap[g] += f.amt * 4000 * KR; col.infra = (col.infra || 0) + f.amt; P.hab = Math.round(col.infra * per); log(`Инфраструктура (${fmtN(f.amt)} ед.) доставлена на «${BODY[f.to].name}»: вместимость колонии ${fmtN(P.hab)} чел.`); return; }
  const d = depot(f.to); d[f.item] = (d[f.item] || 0) + f.amt; log(`На «${BODY[f.to].name}» доставлено: ${fmtN(f.amt)} т (${itemName(f.item).toLowerCase()}).`);
}
export function freightTick(h) {
  const F = FR(); F.acc += h; if (F.acc < 1) return; F.acc = 0;
  for (const f of [...F.flights]) if (f.arrive <= state.t) { deliver(f); F.flights.splice(F.flights.indexOf(f), 1); }
  const cs = [...(state.corps || [])].sort((a, b) => cf(a) - cf(b));
  for (const o of F.orders) {
    while (o.left > 1e-6) {
      const c = cs.find(x => capOf(x) - usedBy(x) >= Math.min(o.left, 20)); if (!c) break;
      let chunk = Math.min(o.left, capOf(c) - usedBy(c)); const fr = fareOf(o.from, o.to) * cf(c);
      const stock = o.from === 'earth' && o.item !== 'infra' ? (state.stock[o.item] || 0) : o.item === 'infra' ? Infinity : ((state.depot && state.depot[o.from] && state.depot[o.from][o.item]) || 0);
      chunk = Math.min(chunk, stock, state.money / (fr + (o.item === 'infra' ? INFRA_PRICE * tm('infra') : 0)));
      if (!(chunk >= 1) && !(chunk > 0 && chunk >= o.left)) break;
      chunk = chunk >= o.left ? o.left : Math.floor(chunk);
      const pay = chunk * fr + (o.item === 'infra' ? chunk * INFRA_PRICE * tm('infra') : 0); state.money -= pay; c.credits += chunk * fr; o.paid = (o.paid || 0) + pay;
      if (o.item !== 'infra') { if (o.from === 'earth') { state.stock[o.item] -= chunk; rec(o.item, 'out', chunk, 'freight'); } else state.depot[o.from][o.item] -= chunk; }
      F.flights.push({corp: c.id, item: o.item, amt: chunk, to: o.to, arrive: state.t + Math.max(2, bdist(o.from, o.to) / (SPEED * tm('fspeed'))), oid: o.id, reg: o.reg}); o.left -= chunk;
    }
  }
  F.orders = F.orders.filter(o => o.left > 1e-6 || F.flights.some(f => f.oid === o.id));
}

/* --- вкладка «Грузы» --- */
export function refreshCargo() {
  const p = $('p-cargo'); if (!p) return;
  const opt = (arr, sel) => arr.map(([v, n]) => `<option value="${v}"${v === sel ? ' selected' : ''}>${esc(n)}</option>`).join('');
  if (!p._built) {
    p._built = true;
    p.innerHTML = `<div class="box"><h2>Заказ доставки груза</h2><div class="help">Корпорации со свободными грузовыми мощностями сами берутся за заказ и зарабатывают на фрахте. Груз берётся с вашего склада на Земле (или со склада тела); инфраструктуру покупают по ${fmtN(INFRA_PRICE)} кр/т — на колонии она увеличивает вместимость и капитал заводов. Колонистов корпорации возят сами.</div>
    <div class="row"><select id="cg-item"></select><input type="number" id="cg-amt" min="1" value="1000" style="width:90px"> т</div>
    <div class="row">Откуда <select id="cg-from"></select> Куда <select id="cg-to"></select> Регион <select id="cg-reg"></select></div><div id="cg-est" class="help"></div><button class="btn" id="cg-go">Заказать</button></div>
    <div class="box"><h2>Заказы и рейсы</h2><div id="cg-list"></div></div><div class="box"><h2>Склады тел</h2><div id="cg-dp"></div></div>`;
    const bs = cargoBodies().map(b => [b.id, b.name]);
    $('cg-item').innerHTML = opt(ITEMS(), 'infra'); $('cg-from').innerHTML = opt(bs, 'earth'); $('cg-to').innerHTML = opt(bs, 'luna');
    const est = () => { const a = $('cg-from').value, b = $('cg-to').value, n = +$('cg-amt').value || 0, f = fareOf(a, b), inf = $('cg-item').value === 'infra' ? INFRA_PRICE * tm('infra') : 0; $('cg-est').textContent = `Фрахт ≈ ${fmtN(f)} кр/т, всего ≈ ${fmtN(n * (f + inf))} кр. В пути ≈ ${fmtN(Math.max(2, bdist(a, b) / SPEED), 0)} сут.`; };
    const regs = () => { const v = $('cg-reg').value; $('cg-reg').innerHTML = opt([['', 'авто (самый тесный)'], ...regNames($('cg-to').value).map((n, i) => [String(i), n])], v); };
    p.addEventListener('input', e => { if (e.target.id === 'cg-to') regs(); est(); }); regs(); est();
    $('cg-go').onclick = () => { if (orderCargo($('cg-item').value, $('cg-amt').value, $('cg-from').value, $('cg-to').value, $('cg-reg').value)) refreshCargo(); };
  }
  if (ui.cargoTo && BODY[ui.cargoTo]) { $('cg-to').value = ui.cargoTo; ui.cargoTo = null; $('cg-to').dispatchEvent(new Event('input', {bubbles: true})); }
  const F = FR();
  setHtml($('cg-list'), (F.orders.length ? F.orders.map(o => `<div class="row"><span class="grow">#${o.id} ${esc(itemName(o.item))}: ${fmtN(o.amt)} т · ${esc(BODY[o.from].name)} → ${esc(BODY[o.to].name)}</span><span class="mono muted">ждёт ${fmtN(o.left)} т</span></div>`).join('') : '<div class="help">Заказов нет.</div>') +
    (F.flights.length ? '<h2 style="margin-top:6px">В пути</h2>' + F.flights.map(f => { const c = (state.corps || []).find(x => x.id === f.corp); return `<div class="row"><span class="grow">${esc(c ? c.name : 'Государство')}: ${esc(itemName(f.item))} ${fmtN(f.amt)}${f.item === 'col' ? ' чел.' : ' т'} → ${esc(BODY[f.to].name)}</span><span class="mono muted">прибудет через ${fmtN(Math.max(0, f.arrive - state.t), 0)} сут</span></div>`; }).join('') : ''));
  const dp = state.depot || {}, ids = Object.keys(dp).filter(id => Object.values(dp[id]).some(v => v > 0));
  setHtml($('cg-dp'), ids.length ? ids.map(id => `<div class="row"><b style="width:120px">${esc(BODY[id].name)}</b><span class="mono">${Object.entries(dp[id]).filter(([, v]) => v > 0).map(([k, v]) => itemName(k) + ' ' + fmtN(v)).join(', ')}</span></div>`).join('') : '<div class="help">Пусто.</div>');
}
