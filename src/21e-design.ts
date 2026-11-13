// @ts-nocheck
// Корабли из редактора корпусов (public/data/ships.json, собирает tools/export-ships.cjs).
// Модель: готовая сетка с цветами граней + башни (для хука ствола) + сопла. Повреждения — воронки по новой модели (кубы 10 см) — следующим шагом;
// пока попадание оставляет тёмную воронку на обшивке.
import * as THREE from 'three';
import { rawFile } from './00-gd.ts';
import { state } from './01-data.ts';
let LIST = null;
function list() { if (LIST) return LIST; const f = rawFile('ships'); LIST = (f && f.list) || []; return LIST; }
export const hasDesigns = () => list().length > 0;
export const designNames = () => list().map(d => d.name);
const ub = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const cache = new Map();
function geo(d) {
  if (cache.has(d.name)) return cache.get(d.name);
  const pi = new Int16Array(ub(d.pos).buffer), ci = ub(d.col), n = pi.length, p = new Float32Array(n), c = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i] = pi[i] / 20; c[i] = ci[i] / 255; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
  cache.set(d.name, g); return g;
}
// лоды: кластеризация вершин по сетке (L/300, L/120, L/50, L/20); треугольники, схлопнувшиеся в линию/точку, выбрасываются
const LODK = [0, 1 / 300, 1 / 120, 1 / 50, 1 / 20], LODD = [0, 1.5, 4, 10, 25];
function geoLod(d, lv) {
  if (!lv) return geo(d); const key = d.name + '#' + lv; if (cache.has(key)) return cache.get(key);
  const b = geo(d), P = b.attributes.position.array, Cc = b.attributes.color.array, h = d.L * LODK[lv], q = v => Math.round(v / h) * h, op = [], oc = [];
  const sum = new Map(), kf = (x, y, z) => Math.round(x / h) + ',' + Math.round(y / h) + ',' + Math.round(z / h);
  for (let i = 0; i < P.length; i += 3) { const k = kf(P[i], P[i + 1], P[i + 2]); let s = sum.get(k); if (!s) sum.set(k, s = [0, 0, 0, 0]); s[0] += P[i]; s[1] += P[i + 1]; s[2] += P[i + 2]; s[3]++; }
  const seen = new Set();
  for (let t = 0; t < P.length; t += 9) { const ks = [0, 3, 6].map(o => kf(P[t + o], P[t + o + 1], P[t + o + 2])); if (ks[0] === ks[1] || ks[1] === ks[2] || ks[0] === ks[2]) continue; const tk = ks.join('|'); if (seen.has(tk)) continue; seen.add(tk);
    for (let o = 0; o < 3; o++) { const s = sum.get(ks[o]); op.push(s[0] / s[3], s[1] / s[3], s[2] / s[3]); oc.push(Cc[t + o * 3], Cc[t + o * 3 + 1], Cc[t + o * 3 + 2]); } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(op, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(oc, 3)); g.computeVertexNormals(); void q;
  cache.set(key, g); return g;
}
const lodMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .3, roughness: .5, flatShading: true, side: THREE.DoubleSide });
export function lodInfo(d) { return LODK.map((_, i) => geoLod(d, i).attributes.position.count / 3 | 0); }
// новая модель повреждений: участки брони — сетки кубов 10 см; попадания копят глубину; обшивка вырезается шейдером по маске
const KST = 15000, C = .1, NP = 128, MS = 128; // все попадания хранятся данными без лимита; на экране — до 128 участков у ближних кораблей
function mkMat(D) {
  const m = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .3, roughness: .5, flatShading: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.uniforms.pd = { value: D.pdTex }; sh.uniforms.pm = { value: D.mTex }; sh.uniforms.np = D.npU;
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvOP=position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying vec3 vOP;uniform sampler2D pd;uniform sampler2D pm;uniform int np;')
      .replace('#include <clipping_planes_fragment>', `#include <clipping_planes_fragment>
for(int i=0;i<${NP};i++){if(i>=np)break;float u=(float(i)+.5)/${NP}.;vec4 cp=texture2D(pd,vec2(u,.25));vec3 dd=vOP-cp.xyz;if(dot(dd,dd)>cp.w*cp.w)continue;vec3 cn=texture2D(pd,vec2(u,.75)).xyz;float h=dot(dd,cn);
if(h>-.12&&h<.9){vec3 cu=normalize(cross(cn,abs(cn.y)<.9?vec3(0.,1.,0.):vec3(1.,0.,0.)));vec3 cv=cross(cn,cu);float a=dot(dd,cu)/${C}+${MS / 2}.5,b=dot(dd,cv)/${C}+${MS / 2}.5;if(a>0.&&a<${MS}.&&b>0.&&b<${MS}.){if(texture2D(pm,vec2(a/${MS}.,(floor(b)+.5+float(i)*${MS}.)/${NP * MS}.)).r>.5)discard;}}}`);
  };
  return m;
}
function mkDmg(g, body, T) {
  const pdA = new Float32Array(NP * 2 * 4); let mA = new Uint8Array(1);
  const pdTex = new THREE.DataTexture(pdA, NP, 2, THREE.RGBAFormat, THREE.FloatType), mTex = new THREE.DataTexture(mA, 1, 1, THREE.RedFormat, THREE.UnsignedByteType);
  [pdTex, mTex].forEach(t => { t.magFilter = t.minFilter = THREE.NearestFilter; t.needsUpdate = true; });
  const D: any = { pdTex, mTex, npU: { value: 0 }, P: [], n: 0, awake: false };
  const slot = P => { const i = D.P.indexOf(P); return i < NP ? i : -1; };
  function upPD(P) { const i = slot(P); if (i < 0) return; pdA.set([...P.p, P.R + .5], i * 4); pdA.set([...P.nA, 0], (NP + i) * 4); pdTex.needsUpdate = true; }
  D.wake = () => { if (D.awake) return; D.awake = true; mA = new Uint8Array(MS * NP * MS); mTex.image = { data: mA, width: MS, height: NP * MS } as any; mTex.dispose(); for (const P of D.P) rebuild(P); D.npU.value = Math.min(NP, D.P.length); mTex.needsUpdate = true; };
  D.sleep = () => { if (!D.awake) return; D.awake = false; mA = new Uint8Array(1); mTex.image = { data: mA, width: 1, height: 1 } as any; mTex.dispose(); mTex.needsUpdate = true; D.npU.value = 0; for (const P of D.P) if (P.mesh) { g.remove(P.mesh); P.mesh.geometry.dispose(); P.mesh = null; } };
  const steel = t => { const q = Math.max(.22, .6 - t * .32); return [q, q * .97, q * .92]; };
  function rebuild(P) {
    upPD(P); if (!D.awake) return;
    const pos = [], col = [], c = C, Tt = P.T, dp = k => { const d = P.g.get(k) || 0; return d >= Tt - 1e-6 ? Tt : Math.floor(d / c + 1e-6) * c; };
    const Pt = (i, j, dd) => [0, 1, 2].map(k => P.p[k] + P.u[k] * i * c + P.v[k] * j * c - P.nA[k] * dd);
    const quad = (a, b, cc, d, rgb) => { for (const q of [a, b, cc, a, cc, d]) { pos.push(...q); col.push(...rgb); } };
    P.g.forEach((rw, key) => { const [i, j] = key.split(',').map(Number); let d0 = dp(key); const fr = (rw - d0) / c, thr = d0 >= Tt - 1e-4, age = D.n - (P.h.get(key) || 0), hot = Math.max(0, 1 - age / 60); if (thr) return; if (d0 <= 0) d0 = .01 * fr;
      let rgb = steel(Math.min(1, d0 / Math.max(.3, Tt * .4))); if (d0 < .05) rgb = [.55 - fr * .15, .53 - fr * .15, .5 - fr * .15]; else if (hot > .05 && d0 > .15) { const b = hot * Math.min(1, d0 / .6); rgb = [(70 + 110 * b) / 255, (45 + 35 * b * b) / 255, (35 + 5 * b) / 255]; }
      quad(Pt(i - .5, j - .5, d0), Pt(i + .5, j - .5, d0), Pt(i + .5, j + .5, d0), Pt(i - .5, j + .5, d0), rgb);
      for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k2 = (i + a) + ',' + (j + b), d1 = P.g.has(k2) ? dp(k2) : 0; if (d1 >= d0) continue; const e0 = [i + a * .5, j + b * .5], o = [b * .5, a * .5];
        quad(Pt(e0[0] - o[0], e0[1] - o[1], d1), Pt(e0[0] + o[0], e0[1] + o[1], d1), Pt(e0[0] + o[0], e0[1] + o[1], d0), Pt(e0[0] - o[0], e0[1] - o[1], d0), steel(Math.min(1, (d0 + d1) / 2 / Math.max(.3, Tt * .4)))); } });
    if (!P.mesh) { P.mesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .3, roughness: .8, flatShading: true, side: THREE.DoubleSide })); g.add(P.mesh); }
    const gm = P.mesh.geometry; gm.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); gm.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); gm.computeVertexNormals(); gm.computeBoundingSphere();
    const pi = slot(P); if (pi >= 0) P.g.forEach((d, key) => { if (d < .005) return; const [a, b] = key.split(',').map(Number), x = a + MS / 2, y = b + MS / 2; if (x < 0 || x >= MS || y < 0 || y >= MS) return; mA[(pi * MS + y) * MS + x] = 255; }); mTex.needsUpdate = true;
  }
  // сажа и содранная краска вокруг попаданий (в т.ч. рикошетов): тёмные пятна поверх корпуса, радиус в разы больше воронки
  const SOOT = 1024, soot = new THREE.InstancedMesh(new THREE.CircleGeometry(1, 10), new THREE.MeshBasicMaterial({ color: 0x0c0a08, transparent: true, opacity: .55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), SOOT);
  soot.count = 0; soot.frustumCulled = false; g.add(soot); let sootI = 0; const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
  const addSoot = (p, n, r) => { _q.setFromUnitVectors(_z, n); _s.set(r, r, r); _m4.compose(p.clone().addScaledVector(n, .03), _q, _s); soot.setMatrixAt(sootI % SOOT, _m4); sootI++; soot.count = Math.min(SOOT, sootI); soot.instanceMatrix.needsUpdate = true; };
  const RC = new THREE.Raycaster();
  D.hit = (ow, dw, kind, r, q) => { g.updateMatrixWorld(true); RC.set(ow, dw.clone().normalize()); const hs = RC.intersectObject(body, false); if (!hs.length) return false;
    const h = hs[0], lp = g.worldToLocal(h.point.clone()), n = h.face.normal.clone().normalize(), dl = dw.clone().transformDirection(new THREE.Matrix4().copy(g.matrixWorld).invert()).normalize(); if (n.dot(dl) > 0) n.negate(); const cs = Math.max(.05, -dl.dot(n));
    const pw = (q && q.pw) || r || 1, cal = kind === 'gat' ? 3 : kind === 'rail' ? (pw > 6 ? 30 : 15) : 10, E = pw * (kind === 'gat' ? .15 : 15) * 1e6, eJ = E / (Math.PI * (cal / 2) ** 2) * (.85 + Math.random() * .3), dcm = eJ / KST * cs, Tt = Math.max(.05, (T || 2) * .5), d = Math.min(Tt, dcm / 100), R = (cal * .6 + Math.min(dcm, Tt * 100) * .35) / 100, scr = cs < .35;
    D.n++; addSoot(lp, n, Math.max(.8, R * (scr ? 3 : 7)) * (.7 + Math.random() * .6));
    let P = D.P.find(o => o.n.dot(n) > .995 && Math.abs(lp.clone().sub(o.p3).dot(o.n)) < .15 && lp.distanceTo(o.p3) < o.R + R + 1);
    if (!P) { const t0 = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), u = new THREE.Vector3().crossVectors(n, t0).normalize(), v = new THREE.Vector3().crossVectors(n, u);
      P = { p3: lp.clone(), p: lp.toArray(), n, u: u.toArray(), v: v.toArray(), nA: n.toArray(), T: Tt, g: new Map(), h: new Map(), R: 0 }; P.n = n; D.P.push(P); if (D.awake) D.npU.value = Math.min(NP, D.P.length); }
    const dd = lp.clone().sub(P.p3), ci = Math.round(dd.x * P.u[0] + dd.y * P.u[1] + dd.z * P.u[2]) / C | 0, cj = Math.round((dd.x * P.v[0] + dd.y * P.v[1] + dd.z * P.v[2]) / C), ci2 = Math.round((dd.x * P.u[0] + dd.y * P.u[1] + dd.z * P.u[2]) / C);
    const set = (ii, jj, add) => { const k = ii + ',' + jj, old = P.g.get(k) || 0; P.g.set(k, Math.min(P.T, old + add)); P.h.set(k, D.n); P.R = Math.max(P.R, Math.hypot(ii, jj) * C + C); };
    if (scr) { const a = Math.random() * 6.283, ca = Math.cos(a), sa = Math.sin(a), Ls = Math.min(4, R * 8), w = Math.max(.05, R * .35), dep = d * .5 + .02; for (let t = 0; t <= Ls; t += C * .5) { const f = t / Ls, dv0 = dep * Math.sin(Math.PI * Math.min(1, f * 1.3)), ww = w * (1 - f * .6); for (let o = -ww; o <= ww; o += C * .5) { const dv = dv0 * (1 - (o / ww) ** 2); if (dv > 0) set(ci2 + Math.round((ca * t - sa * o) / C), cj + Math.round((sa * t + ca * o) / C), dv * .5); } } }
    else { const N = Math.ceil(R / C); for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) { const rr = Math.hypot(i * C, j * C); if (rr <= R) set(ci2 + i, cj + j, d * (1 - (rr / R) ** 2)); } }
    P.dirty = true; return d >= Tt - 1e-4; };
  D.release = () => {}; D.step = () => { if (D.awake) { let k = 0; for (const P of D.P) if (P.dirty && k < 4) { P.dirty = false; rebuild(P); k++; } } const lo = g.userData.lod; if (!lo) return; const far = lo.getCurrentLevel() > 1; if (far) D.sleep(); else D.wake(); for (const t of g.userData.turs) t.visible = lo.getCurrentLevel() < 4; };
  return D;
}
export function pickDesign(tons, spec) { const l = list(); if (!l.length) return null; const nm = spec && spec.name, ds = nm && state.designs && state.designs.find(x => x.name === nm), want = (spec && spec.hull) || (ds && ds.hull) || nm; if (want) { const e = l.find(d => d.name === want); if (e) return e; } let b = l[0]; for (const d of l) if (Math.abs(Math.log(d.M / tons)) < Math.abs(Math.log(b.M / tons))) b = d; return b; }
export function buildDesign(d, opt) {
  const g = new THREE.Group(), body0 = new THREE.Mesh(geo(d)); const D = mkDmg(g, body0, opt && opt.arm); const body = new THREE.Mesh(geo(d), mkMat(D)); const lod = new THREE.LOD(); lod.addLevel(body, 0); for (let i = 1; i < LODK.length; i++) lod.addLevel(new THREE.Mesh(geoLod(d, i), lodMat), 1e9); g.add(lod); D.hit2 = D.hit; D.hit = (ow, dw, kind, r, q) => { body0.matrixWorld = body.matrixWorld; return D.hit2(ow, dw, kind, r, q); };
  const turs = [];
  for (const t of d.turs) { const tu = new THREE.Group(), n = new THREE.Vector3(t.n[0], t.n[1], t.n[2]); tu.position.set(t.p[0], t.p[1], t.p[2]); tu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const hd = new THREE.Group(); hd.position.y = .6; tu.add(hd); tu.userData = { isTur: 1, head: hd, tipX: t.k === 'gat' ? 6 : 8, n }; g.add(tu); turs.push(tu); }
  // огни и факелы двигателей из редактора: аддитивные спрайты (огни мигают) и конусы пламени
  const glowT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const lights = [];
  for (const o of d.gl || []) { const col = new THREE.Color(o.c || '#7fd3ff');
    if (o.t === 'lt') { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(o.p[0], o.p[1], o.p[2]); sp.scale.setScalar(o.r * 2.2); sp.userData.ph = Math.random() * 6; g.add(sp); lights.push(sp); }
    else { const len = o.len || o.r * 5, cg = new THREE.ConeGeometry(o.r, len, 12, 1, true); cg.rotateZ(Math.PI / 2); cg.translate(-len / 2, 0, 0);
      const pl = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: col, blending: THREE.AdditiveBlending, transparent: true, opacity: .55, depthWrite: false, side: THREE.DoubleSide })); pl.position.set(o.p[0], o.p[1], o.p[2]); g.add(pl);
      const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); hs.position.copy(pl.position); hs.scale.setScalar(o.r * 4); g.add(hs); } }
  const inner = new THREE.Group(); inner.visible = false; g.add(inner);
  g.userData = { lod, setLodScale: (k) => { const Lw = d.L * k; lod.levels.forEach((l, i) => l.distance = Lw * LODD[i]); }, L: d.L, turs, inner, hu: { sh: { value: new THREE.Matrix4() } }, design: d.name, dmg: D };
  return g;
}
