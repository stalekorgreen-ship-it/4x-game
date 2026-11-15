// Сводка серии ai-suite.sh: node tools/ai-suite-sum.cjs <каталог> <json-выход> <md-выход>
// По каждому сценарию и режиму — среднее и значения по seed (разброс виден), разница «текущий − без ролей».
const fs = require('fs'), [, , dir, outJ, outM] = process.argv;
const files = fs.readdirSync(dir).filter(f => f.endsWith('.txt')).sort();
const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null, r2 = v => v == null || !isFinite(v) ? null : +v.toFixed(2);
function metrics(o) {
  const f = o.fc || {}, m = f.form || {}, sw = f.sw || {n: 0, back: 0, kill: 0, lost: 0, why: {}}, rep = f.rep || {}, sh = o.ships || [];
  const side = s => sh.filter(x => x.n.endsWith(String(s))), n = m.n || 1;
  return {
    alive0: side(0).filter(x => x.alive).length, alive1: side(1).filter(x => x.alive).length, n0: side(0).length, n1: side(1).length,
    flee0: side(0).filter(x => x.dbg && x.dbg[11]).length, hits: (o.hits || [0, 0])[0] + (o.hits || [0, 0])[1], hits0: (o.hits || [0, 0])[0], hits1: (o.hits || [0, 0])[1],
    switch: sw.n, swBack: sw.back, swKill: sw.kill, swLeftAlive: sw.lost, swWhy: sw.why, firstAssign: (f.switch || 0) - sw.n,
    noAtkShare: f.atkT ? f.noAtkT / f.atkT : null, acqSec: f.acqN ? f.acqT / f.acqN : null,
    rep, repTotal: Object.values(rep).reduce((a, b) => a + b, 0), repRepeat: f.repRep || 0, repActed: f.repAct || 0, repIgnored: f.repIgn || 0,
    roleChanges: f.roleCh || 0, roleWhy: f.roleWhy || {}, flagLost: f.flagLost || 0,
    roles: Object.fromEntries(Object.keys(m.all || {}).map(k => [k, r2(m.all[k] / n)])),
    roleOk: Object.fromEntries(Object.keys(m.all || {}).map(k => [k, r2((m.ok[k] || 0) / m.all[k])])),
    slotKm: m.slotN ? m.slot / m.slotN : null, lineDepthKm: m.depthN ? m.depth / m.depthN : null, lineSupKm: m.lsN ? m.ls / m.lsN : null, pvoProtKm: m.pvoN ? m.pvo / m.pvoN : null,
    blockedFire: f.blk || 0, dangerReal: (f.cal || {}).real || 0, dangerFlagged: (f.cal || {}).flag || 0, dangerHit: (f.cal || {}).realHit || 0
  };
}
const res = {};
for (const fn of files) {
  const [sc, mode] = fn.replace('.txt', '').split('.'), L = fs.readFileSync(dir + '/' + fn, 'utf8').split('\n').filter(l => l.startsWith('{"pk'));
  const runs = L.map(l => { const o = JSON.parse(l); return {seed: o.seed, t: o.t, ...metrics(o)} });
  (res[sc] = res[sc] || {})[mode] = {runs, err: L.length ? null : fs.readFileSync(dir + '/' + fn, 'utf8').slice(0, 300)};
}
const K = ['alive0', 'alive1', 'hits0', 'hits1', 'switch', 'swBack', 'swKill', 'noAtkShare', 'acqSec', 'repTotal', 'repRepeat', 'repActed', 'repIgnored', 'roleChanges', 'flagLost', 'slotKm', 'lineDepthKm', 'lineSupKm', 'pvoProtKm', 'blockedFire', 'flee0'];
for (const sc in res) for (const md in res[sc]) { const R = res[sc][md].runs; res[sc][md].mean = Object.fromEntries(K.map(k => [k, r2(avg(R.map(r => r[k]).filter(v => v != null && isFinite(v))))])); res[sc][md].bySeed = Object.fromEntries(K.map(k => [k, R.map(r => r2(r[k]))])) }
fs.writeFileSync(outJ, JSON.stringify(res, null, 1));
let md = '# Combat AI v1 — серия испытаний\n\nРежимы: **new** — текущая версия; **base** — без ролей в планировщике и без докладов (`{"planner":{"wrole":0},"fleetcmd":{"fb":0}}`). Значения: среднее [по seed].\n\n';
for (const sc of Object.keys(res).sort()) { md += `## ${sc}\n\n| метрика | new | base |\n|---|---|---|\n`;
  for (const k of K) { const f = m => res[sc][m] ? `${res[sc][m].mean[k]} [${res[sc][m].bySeed[k].join(', ')}]` : '—'; md += `| ${k} | ${f('new')} | ${f('base')} |\n` }
  const rr = res[sc].new && res[sc].new.runs[0]; if (rr) md += `\nРоли (new, seed ${rr.seed}, кораблей на цикл): ${JSON.stringify(rr.roles)}; выполняют роль: ${JSON.stringify(rr.roleOk)}; доклады: ${JSON.stringify(rr.rep)}; причины смен цели: ${JSON.stringify(rr.swWhy)}\n\n` }
fs.writeFileSync(outM, md); console.log('ok', Object.keys(res).length);
