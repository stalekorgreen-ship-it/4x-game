// @ts-nocheck
/* ===== НАСЕЛЕНИЕ ЗЕМЛИ: 4 страты × возраст 0..100 ===== */
const STR = ['Школьное', 'Среднее', 'Высшее', 'Максимальное'], STR_COL = ['#8a97ab', '#4f9d8a', '#d3a44a', '#b8567a'];
const GOODS = {
  food: {n: 'Еда', raw: 'n2', need: 2.2, mix: [.7, .25, .05, 0]},
  wear: {n: 'Товары', raw: 'fe', need: 1.4, mix: [.6, .35, .05, 0]},
  elec: {n: 'Электроника', raw: 'si', need: .8, mix: [.2, .4, .3, .1]},
  med: {n: 'Медицина', raw: 'c', need: .7, mix: [.1, .3, .4, .2]},
  pow: {n: 'Энергия', raw: 'u', need: 1, mix: [.3, .4, .25, .05]},
};
const OTHER_MIX = [.45, .4, .13, .02], FACT_W = 10000, PROD = 40, RAW_PER = 1e-7, BASEW = [4, 7, 12, 20], TUIT = [0, 2, 4, 7], FACT_COST = 2e8, TAXK = 1.25e-5;
const CAPS = [.4, .3, .1], FERT = [1.25, 1.1, .8, .55];
const ageF = a => a < 25 ? .7 : a < 30 ? .85 : a < 55 ? 1 : 1.05;
const needF = a => a < 15 ? .7 : a >= 65 ? 1.1 : 1;
const needOf = (g, a) => GOODS[g].need * needF(a) * (g === 'med' && a >= 50 ? 1 + (a - 50) / 25 : 1);
const basket = a => { let b = 0; for (const g in GOODS) b += needOf(g, a); return b; };
const work = a => a >= 15 && a < 65;
const mortQ = a => a < 1 ? .02 : .0003 + .00002 * Math.exp(Math.min(a, 100) / 11);
const clampN = (x, a, b) => Math.max(a, Math.min(b, x));

function initPop() {
  const T0 = 7e9, f = a => a < 15 ? 1.72 : a < 65 ? 1.62 - .0156 * (a - 15) : .8 * Math.exp(-(a - 65) / 12);
  let sum = 0; for (let a = 0; a <= 100; a++) sum += f(a);
  const c = [[], [], [], []];
  for (let a = 0; a <= 100; a++) {
    const n = T0 * f(a) / sum;
    let sh = a < 15 ? [1, 0, 0, 0] : a < 26 ? [.7, .24, .05, .01] : [.45, .38, .14, .03];
    for (let s = 0; s < 4; s++) {
      const m = n * sh[s]; let st = 0;
      if (a === 15) st = m; else if (a > 15 && a < 26 && s > 0) st = m * clampN((26 - a) / 12, 0, 1); else if (a < 15) st = m;
      const un = work(a) ? (m - st) * .06 : 0;
      c[s][a] = {n: m, un, st};
    }
  }
  state.pop = {c, wage: BASEW.slice(), fac: {}, cap: {}, sat: {}, prod: {}, dem: {}, oth: [0, 0, 0, 0], acc: 0, yacc: 0, wbill: 0, tax: 0, birth: 0, death: 0, T0, parInc: [4, 7, 12, 20], bornY: 0, diedY: 0};
  const P = state.pop; let tot = totals();
  for (const g in GOODS) { let D = 0; for (let a = 0; a <= 100; a++) for (let s = 0; s < 4; s++) D += c[s][a].n * needOf(g, a); P.fac[g] = Math.ceil(D / (PROD * FACT_W)); P.cap[g] = 0; P.sat[g] = 1; }
  const J = jobsFac(), E = empBy();
  for (let s = 0; s < 4; s++) P.oth[s] = Math.max(0, E[s] - J[s]);
  P.pop0 = tot.n; stepEcon(30, true);
}
function jobsFac() { const P = state.pop, J = [0, 0, 0, 0]; for (const g in GOODS) for (let s = 0; s < 4; s++) J[s] += P.fac[g] * FACT_W * GOODS[g].mix[s]; return J; }
function empBy() { const P = state.pop, E = [0, 0, 0, 0]; for (let s = 0; s < 4; s++) for (let a = 15; a < 65; a++) { const x = P.c[s][a]; E[s] += Math.max(0, x.n - x.un - x.st); } return E; }
function totals() {
  const P = state.pop, t = {n: 0, un: 0, st: 0, emp: 0, wf: 0, S: [0, 1, 2, 3].map(() => ({n: 0, un: 0, wf: 0, emp: 0}))};
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    const x = P.c[s][a]; t.n += x.n; t.S[s].n += x.n;
    if (work(a)) { const e = Math.max(0, x.n - x.un - x.st); t.un += x.un; t.emp += e; t.S[s].un += x.un; t.S[s].emp += e; t.S[s].wf += x.n - x.st; t.wf += x.n - x.st; }
    t.st += x.st;
  }
  return t;
}
function unRate(s) { const t = totals().S[s]; return t.wf > 0 ? t.un / t.wf : 0; }
function popTaxDay() { return state.pop ? state.pop.tax : 3e5; }
function incomeOf(s, a, kind) { const w = state.pop.wage[s] * ageF(a); return kind === 'emp' ? w : kind === 'un' ? w * .3 : w * .4; }

function stepDemog(dt) { // dt в днях (месяц)
  const P = state.pop, f = dt / 360;
  const wel = P.wel || {};
  let b = 0, d = 0;
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    const x = P.c[s][a]; if (x.n <= 0) continue;
    const w = (wel[s] && wel[s][a] != null) ? wel[s][a] : 1;
    const q = clampN(mortQ(a) * (1 + 3 * (1 - w)) * f, 0, .5), dd = x.n * q; d += dd;
    const k = 1 - q; x.n *= k; x.un *= k; x.st *= k;
    if (a >= 20 && a < 40) b += x.n * .056 * FERT[s] * (.6 + .4 * w) * f;
  }
  P.c[0][0].n += b; P.c[0][0].st += b; P.birth = b / f; P.death = d / f; P.bornY += b; P.diedY += d;
}
function parentInc(s) { // средний доход занятых 30–50 лет страты
  const w = state.pop.wage[s]; return w;
}
function stepAge() {
  const P = state.pop, nw = [[], [], [], []];
  for (let s = 0; s < 4; s++) { for (let a = 0; a <= 100; a++) nw[s][a] = {n: 0, un: 0, st: 0}; }
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) { const x = P.c[s][a], b = nw[s][Math.min(100, a + 1)]; b.n += x.n; b.un += x.un; b.st += x.st; }
  const wage = P.wage;
  for (let a = 15; a <= 26; a++) for (let s = 3; s >= 0; s--) {
    const x = nw[s][a]; if (x.st <= 0) continue;
    let up = 0;
    if (s < 3 && a <= 25) {
      const aff = clampN(P.parInc[s] * 2 / (TUIT[s + 1] * 2 + 1e-9), 0, 1), prem = wage[s + 1] / wage[s], inc = clampN((prem - 1) / .3, 0, 1);
      up = aff * inc * CAPS[s];
    }
    const mv = x.st * up, leave = x.st - mv;
    if (mv > 0) { const y = nw[s + 1][a], fr = mv / x.n; y.n += mv; y.st += mv; }
    x.n -= mv; x.st = 0; x.un += leave;
  }
  P.c = nw;
  // рождаемость за год (сброс счётчиков)
  P.bornY = 0; P.diedY = 0;
}
function stepEcon(dt, init) {
  const P = state.pop, t = totals();
  // 1) безработица и зарплаты
  for (let s = 0; s < 4; s++) { const u = t.S[s].wf > 0 ? t.S[s].un / t.S[s].wf : 0; P.wage[s] = BASEW[s] * clampN(1.3 - 2 * u, .5, 1.4); }
  // сколько мест
  const J = jobsFac(), E = empBy();
  if (!init) for (let s = 0; s < 4; s++) { const u = t.S[s].wf > 0 ? t.S[s].un / t.S[s].wf : 0; P.oth[s] *= 1 + clampN((u - .05) / .05, -.3, 1) * .004 * dt / 30; }
  const oth = P.oth;
  const fill = [];
  for (let s = 0; s < 4; s++) {
    const need = J[s] + oth[s], vac = need - E[s];
    if (vac > 0) { // нанимают безработных, молодых в первую очередь
      let hire = Math.min(vac, t.S[s].un * .4);
      for (let a = 15; a < 65 && hire > 0; a++) { const x = P.c[s][a], h = Math.min(hire, x.un); x.un -= h; hire -= h; }
    } else if (vac < 0) { // увольнения: старших первыми
      let fire = -vac;
      for (let a = 64; a >= 15 && fire > 0; a--) { const x = P.c[s][a], e = Math.max(0, x.n - x.un - x.st), h = Math.min(fire, e); x.un += h; fire -= h; }
    }
    const E2 = empBy()[s]; fill[s] = need > 0 ? Math.min(1, E2 / need) : 1;
  }
  // 2) доходы, зарплатный фонд, налог
  let wb = 0;
  const wel = [[], [], [], []], inc = [[], [], [], []];
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    const x = P.c[s][a]; let i;
    if (a < 15) i = P.parInc[s] * 2;
    else if (!work(a)) i = incomeOf(s, 64, 'ret');
    else { const e = Math.max(0, x.n - x.un - x.st); i = x.n > 0 ? (e * incomeOf(s, a, 'emp') + x.un * incomeOf(s, a, 'un') + x.st * incomeOf(s, a, 'un') * .3) / x.n : 0; wb += e * incomeOf(s, a, 'emp'); }
    inc[s][a] = i; wel[s][a] = null;
  }
  P.wbill = wb; P.tax = wb * TAXK;
  // 3) спрос, выпуск, удовлетворённость
  let sn = 0, sw = 0; for (const g in GOODS) { sw += GOODS[g].need; }
  const rawUse = {};
  for (const g in GOODS) {
    let D = 0; for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) D += P.c[s][a].n * needOf(g, a);
    let staff = 0; for (let s = 0; s < 4; s++) staff += GOODS[g].mix[s] * fill[s];
    const prod = P.fac[g] * FACT_W * PROD * staff;
    P.dem[g] = D; P.prod[g] = prod; P.sat[g] = D > 0 ? Math.min(1, prod / D) : 1;
    P.staff = P.staff || {}; P.staff[g] = staff;
  }
  for (let s = 0; s < 4; s++) for (let a = 0; a <= 100; a++) {
    let ws = 0; for (const g in GOODS) ws += P.sat[g] * GOODS[g].need;
    const aff = clampN(inc[s][a] / (basket(a) * (a < 15 ? 1.5 : 1)), 0, 1);
    wel[s][a] = clampN(aff * ws / sw, 0, 1);
  }
  P.wel = wel; P.inc = inc;
  // информация для вкладки
  const pi = [4, 7, 12, 20];
  for (let s = 0; s < 4; s++) { let tw = 0, te = 0; for (let a = 30; a < 51; a++) { const x = P.c[s][a], e = Math.max(0, x.n - x.un - x.st); tw += e * incomeOf(s, a, 'emp'); te += e; } pi[s] = te > 0 ? tw / te : BASEW[s]; }
  P.parInc = pi;
  // 4) фирмы: выручка, расходы, сырьё, инвестиции
  for (const g in GOODS) {
    const G = GOODS[g], D = P.dem[g], sat = P.sat[g], price = clampN(1 + 1.5 * (1 - sat), 1, 3);
    const rev = Math.min(D, P.prod[g]) * price;
    let wc = 0; for (let s = 0; s < 4; s++) wc += P.fac[g] * FACT_W * G.mix[s] * P.wage[s] * .96;
    const tonsDay = P.prod[g] / G.need * RAW_PER, tons = tonsDay * dt;
    let rc = tonsDay * (PRICE[G.raw] || 50);
    if (!init) { const have = state.stock[G.raw] || 0, take = Math.min(have, tons); if (take > 0) { state.stock[G.raw] -= take; state.money += take * (PRICE[G.raw] || 50); rec(G.raw, 'out', take, 'pop'); } P.raw = P.raw || {}; P.raw[g] = {t: tonsDay, stock: take / dt}; }
    P.rev = P.rev || {}; P.rev[g] = rev; P.cost = P.cost || {}; P.cost[g] = wc + rc; P.price = P.price || {}; P.price[g] = price;
    if (!init) {
      P.cap[g] += (rev - wc - rc) * dt * .5;
      const want = Math.ceil(D / (PROD * FACT_W) * 1.03), canBuild = Math.floor(P.cap[g] / FACT_COST);
      if (P.fac[g] < want && canBuild > 0) { const k = Math.min(want - P.fac[g], canBuild, Math.ceil(P.fac[g] * .02)); P.fac[g] += k; P.cap[g] -= k * FACT_COST; }
      else if (P.prod[g] > D * 1.12 && P.fac[g] > want) P.fac[g] -= Math.min(P.fac[g] - want, Math.ceil(P.fac[g] * .01));
    }
  }
}
function popTick(h) {
  const P = state.pop; if (!P) return;
  P.acc += h; if (P.acc < 30) return;
  const dt = P.acc; P.acc = 0;
  stepDemog(dt); P.yacc += dt;
  if (P.yacc >= 360) { P.yacc -= 360; stepAge(); }
  stepEcon(dt);
}

/* --- вкладка «Население» --- */
const popUi = {s: 1, a: 42};
function refreshPop() {
  const p = $('p-pop'); if (!p || !state.pop) return;
  if (!p._built) {
    p._built = true;
    p.innerHTML = `<div class="box"><h2>Население Земли</h2><div id="pp-sum"></div></div>
    <div class="box"><h2>Возрастная пирамида</h2><canvas id="pp-cv" width="560" height="300" style="width:100%;max-width:560px;height:auto;background:var(--panel2,#0003);border-radius:6px"></canvas><div class="help">Слева направо: возраст 0–100 по строкам сверху вниз; цвета — страты: ${STR.map((x, i) => `<span style="color:${STR_COL[i]}">■</span> ${x}`).join(' ')}</div></div>
    <div class="box"><h2>Страты</h2><div id="pp-str"></div></div>
    <div class="box"><h2>Товары и заводы</h2><div id="pp-goods"></div><div class="help">Завод нанимает ${fmtN(FACT_W)} человек, молодых в первую очередь. Чем больше свободных рук, тем ниже зарплата. Сырьё: 1 т на 10 млн человек в сутки; закупается у вас по ценам рынка, остальное завозят.</div></div>
    <div class="box"><h2>Когорта</h2><div class="row">Страта <select id="pp-s">${STR.map((x, i) => `<option value="${i}">${x}</option>`).join('')}</select> Возраст <input id="pp-a" type="number" min="0" max="100" value="${popUi.a}" style="width:70px"></div><div id="pp-insp"></div></div>`;
    $('pp-s').value = popUi.s;
    $('pp-s').onchange = e => { popUi.s = +e.target.value; refreshPop(); };
    $('pp-a').oninput = e => { popUi.a = clampN(Math.round(+e.target.value || 0), 0, 100); refreshPop(); };
  }
  const P = state.pop, t = totals(), yr = Math.floor(state.t / 360);
  const tbl = (head, rows) => `<div style="overflow-x:auto"><table class="mono" style="width:100%;border-collapse:collapse"><tr>${head.map(x => `<th style="text-align:left;padding:2px 6px">${x}</th>`).join('')}</tr>${rows.map(r => `<tr>${r.map(x => `<td style="padding:2px 6px;border-top:1px solid #8883">${x}</td>`).join('')}</tr>`).join('')}</table></div>`;
  $('pp-sum').innerHTML = tbl(['Показатель', 'Значение'], [
    ['Население', fmtN(t.n)], ['Дети 0–14', fmtN(sumAge(0, 14))], ['Трудоспособные 15–64', fmtN(sumAge(15, 64))], ['Старше 65', fmtN(sumAge(65, 100))],
    ['Занято / безработных', `${fmtN(t.emp)} / ${fmtN(t.un)} (${fmtN(t.un / Math.max(1, t.wf) * 100, 1)}%)`], ['Учатся (15+)', fmtN(t.st - sumSt(0, 14))],
    ['Рождаемость / смертность в год', `${fmtN(P.birth)} / ${fmtN(P.death)}`], ['Прирост в год', fmtN((P.birth - P.death) / Math.max(1, t.n) * 100, 2) + '%'],
    ['Фонд зарплат в сутки', fmtN(P.wbill) + ' кр'], ['Налоги вам в сутки', fmtN(P.tax) + ' кр']]);
  $('pp-str').innerHTML = tbl(['Страта', 'Людей', 'Безработных', '%', 'Зарплата/сут', 'Доход занятого 30–50'], [0, 1, 2, 3].map(s => [`<span style="color:${STR_COL[s]}">■</span> ${STR[s]}`, fmtN(t.S[s].n), fmtN(t.S[s].un), fmtN(t.S[s].wf > 0 ? t.S[s].un / t.S[s].wf * 100 : 0, 1), fmtN(P.wage[s], 2), fmtN(P.parInc[s], 2)]));
  $('pp-goods').innerHTML = tbl(['Товар', 'Спрос/сут', 'Выпуск', 'Удовл.', 'Цена ×', 'Заводов', 'Рабочих', 'Капитал', 'Сырьё т/сут'], Object.keys(GOODS).map(g => [GOODS[g].n, fmtN(P.dem[g]), fmtN(P.prod[g]), fmtN(P.sat[g] * 100, 1) + '%', fmtN(P.price ? P.price[g] : 1, 2), fmtN(P.fac[g]), fmtN(P.fac[g] * FACT_W), fmtN(P.cap[g]) + ' кр', fmtN(P.raw && P.raw[g] ? P.raw[g].t : 0, 0) + ' (' + RES[GOODS[g].raw] + ')']));
  const s = popUi.s, a = popUi.a, x = P.c[s][a], e = work(a) ? Math.max(0, x.n - x.un - x.st) : 0;
  $('pp-insp').innerHTML = tbl(['', ''], [
    ['Людей', fmtN(x.n)], ['Безработных', fmtN(x.un)], ['Учатся', fmtN(x.st)], ['Заняты', fmtN(e)],
    ['Средний доход в сутки', fmtN(P.inc[s][a], 2)], ['Потребности в сутки', fmtN(basket(a), 2) + ' (' + Object.keys(GOODS).map(g => GOODS[g].n + ' ' + fmtN(needOf(g, a), 2)).join(', ') + ')'],
    ['Шанс смерти в год', fmtN(mortQ(a) * (1 + 3 * (1 - P.wel[s][a])) * 100, 2) + '%'], ['Рождаемость на человека в год', a >= 20 && a < 40 ? fmtN(.056 * FERT[s] * (.6 + .4 * P.wel[s][a]) * 100, 1) + '%' : '—'], ['Довольство', fmtN(P.wel[s][a] * 100, 0) + '%']]);
  drawPyr();
}
function sumAge(a0, a1) { let n = 0; for (let s = 0; s < 4; s++) for (let a = a0; a <= a1; a++) n += state.pop.c[s][a].n; return n; }
function sumSt(a0, a1) { let n = 0; for (let s = 0; s < 4; s++) for (let a = a0; a <= a1; a++) n += state.pop.c[s][a].st; return n; }
function drawPyr() {
  const cv = $('pp-cv'); if (!cv) return; const g = cv.getContext('2d'), W = cv.width, H = cv.height, P = state.pop;
  g.clearRect(0, 0, W, H); let mx = 1; for (let a = 0; a <= 100; a++) { let n = 0; for (let s = 0; s < 4; s++) n += P.c[s][a].n; mx = Math.max(mx, n); }
  const rh = (H - 10) / 101;
  for (let a = 0; a <= 100; a++) { let x0 = 40; for (let s = 0; s < 4; s++) { const w = P.c[s][a].n / mx * (W - 60); g.fillStyle = STR_COL[s]; g.fillRect(x0, 5 + a * rh, w, rh - .5); x0 += w; } }
  g.fillStyle = '#999'; g.font = '11px sans-serif'; for (let a = 0; a <= 100; a += 20) g.fillText(a, 6, 5 + a * rh + 9);
  g.fillStyle = '#fff'; const ya = 5 + popUi.a * rh; g.fillRect(30, ya, 8, Math.max(2, rh));
}
