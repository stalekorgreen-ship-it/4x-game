// @ts-nocheck
// Корабли из редактора корпусов (public/data/ships.json, собирает tools/export-ships.cjs).
// Модель: готовая сетка с цветами граней + башни (для хука ствола) + сопла. Повреждения — воронки по новой модели (кубы 10 см) — следующим шагом;
// пока попадание оставляет тёмную воронку на обшивке.
import * as THREE from 'three';
import { rawFile } from './00-gd.ts';
import { state } from './01-data.ts';
import { createPart } from './21f-parts.ts';
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
const plumeTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = 128; c.height = 32; const x = c.getContext('2d'), im = x.createImageData(128, 32);
  for (let j = 0; j < 32; j++) for (let i = 0; i < 128; i++) { const u = (127 - i) / 127, v = Math.abs(j - 15.5) / 16, core = Math.exp(-(v * v) / (.02 + .1 * u)), fall = Math.pow(1 - u, 1.6), hot = Math.exp(-u * 8), o = (j * 128 + i) * 4, a = core * fall;
    im.data[o] = 255; im.data[o + 1] = 255 * (.75 + .25 * hot); im.data[o + 2] = 255 * (.55 + .45 * hot); im.data[o + 3] = Math.min(255, 255 * a); }
  x.putImageData(im, 0, 0); return t = new THREE.CanvasTexture(c); }; })(); // u=0 у сопла (вершина плоскости в 0) → разворачиваем: плоскость идёт от 0 к −len, u=0 справа
export const stat3 = { chunks: 0 }; const BREAK = { k: .5, r: 2.2, gatN: 50 }; // откол: доля энергии «прорезать» участок радиуса r насквозь
const glowTex = (() => { let t = null; return () => { if (t) return t; const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.18, 'rgba(255,255,255,.8)'); gr.addColorStop(.45, 'rgba(255,255,255,.15)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return t = new THREE.CanvasTexture(c); }; })();
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
const innerMat = new THREE.MeshStandardMaterial({ color: 0x2b2824, metalness: .25, roughness: .9, flatShading: true, side: THREE.DoubleSide }), bulkGeo = new THREE.BoxGeometry(1, 1, 1), bulkMat = new THREE.MeshStandardMaterial({ color: 0x3a3631, metalness: .4, roughness: .8 }), deckMat = new THREE.MeshStandardMaterial({ color: 0x4a443c, metalness: .3, roughness: .85 });
const lodMat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .3, roughness: .5, flatShading: true, side: THREE.DoubleSide });
export function lodInfo(d) { return LODK.map((_, i) => geoLod(d, i).attributes.position.count / 3 | 0); }
// новая модель повреждений: участки брони — сетки кубов 10 см; попадания копят глубину; обшивка вырезается шейдером по маске
const KST = 5500, /* сопротивление стали Rt ≈ 5,5 кДж/см³, как в бою */ C = .1, NP = 128, MS = 128; // все попадания хранятся данными без лимита; на экране — до 128 участков у ближних кораблей
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
  // сажа и содранная краска: рваное тёмное пятно (текстура с шумом), вытянуто вдоль выстрела; свежее попадание светится и остывает
  const SOOT = 1024, sootT = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d'), im = x.createImageData(128, 128);
    for (let y = 0; y < 128; y++) for (let xx = 0; xx < 128; xx++) { const dx = (xx - 64) / 64, dy = (y - 64) / 64, a = Math.atan2(dy, dx), r = Math.hypot(dx, dy), edge = .8 + .1 * Math.sin(a * 5 + 1) + .06 * Math.sin(a * 9 + 2) + .03 * Math.sin(a * 17);
      const k = Math.max(0, 1 - r / edge), ring = Math.exp(-((r - edge * .55) ** 2) / .02) * .35, o = (y * 128 + xx) * 4, inner = r < .22 ? .25 : 1;
      im.data[o] = 30 + 90 * ring; im.data[o + 1] = 24 + 70 * ring; im.data[o + 2] = 18 + 50 * ring; im.data[o + 3] = Math.min(255, 255 * (Math.pow(k, 1.4) * .9 * inner + ring * k * .6)); }
    x.putImageData(im, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t; })();
  const soot = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: sootT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }), SOOT);
  soot.count = 0; soot.frustumCulled = false; g.add(soot); let sootI = 0;
  const GLW = 64, glow = new THREE.InstancedMesh(new THREE.PlaneGeometry(2, 2), new THREE.MeshBasicMaterial({ map: glowTex(), color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }), GLW);
  glow.count = 0; glow.frustumCulled = false; glow.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(GLW * 3), 3); g.add(glow); let glowI = 0; const glowT = new Float32Array(GLW).fill(-1e9), glowS = new Float32Array(GLW);
  const _m4 = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _z = new THREE.Vector3(0, 0, 1);
  const addSoot = (p, n, r, along) => { _q.setFromUnitVectors(_z, n); _q2.setFromAxisAngle(_z, along != null ? along : Math.random() * 6.283); _q.multiply(_q2); const el = along != null ? 2.2 : 1 + Math.random() * .4; _s.set(r * el, r, 1);
    _m4.compose(p.clone().addScaledVector(n, .03), _q, _s); soot.setMatrixAt(sootI % SOOT, _m4); sootI++; soot.count = Math.min(SOOT, sootI); soot.instanceMatrix.needsUpdate = true; };
  const addGlow = (p, n, r, keep) => { _q.setFromUnitVectors(_z, n); _s.set(r, r, 1); _m4.compose(p.clone().addScaledVector(n, .05), _q, _s); const k = glowI % GLW; glow.setMatrixAt(k, _m4); glowT[k] = performance.now(); glowS[k] = keep ? 2 : 1; glowI++; glow.count = Math.min(GLW, glowI); glow.instanceMatrix.needsUpdate = true; };
  D.cool = () => { const now = performance.now(); let ch = false; for (let k = 0; k < glow.count; k++) { const a = (now - glowT[k]) / 1000, v = glowS[k] === 2 ? .45 + .15 * Math.sin(now / 170 + k * 1.7) + .08 * Math.sin(now / 53 + k) : a < 0 ? 0 : Math.max(0, 1 - a / 25); const h = v * v; glow.instanceColor.setXYZ(k, 1.6 * h, .55 * h * h + .1 * h, .12 * h * h); ch = true; } if (ch) glow.instanceColor.needsUpdate = true; };
  const RC = new THREE.Raycaster();
  // выбитый модуль: луч снаружи к корпусу в координатах корабля → пятно сажи и тлеющий огонь, который не гаснет
  D.mark = (o, d, r) => { const mw = body.matrixWorld.clone(); body.matrixWorld.identity(); RC.set(o, d); const hs = RC.intersectObject(body, false); body.matrixWorld.copy(mw); if (!hs.length) return false;
    const n = hs[0].face.normal.clone().normalize(); if (n.dot(d) > 0) n.negate(); D.chunk(hs[0].point, n, r); addSoot(hs[0].point, n, r * 1.6); addGlow(hs[0].point, n, r * .7, true); return true; };
  D.markAt = (p, n, r) => { D.chunk(p, n, r * 1.6); addSoot(p, n, r * 1.6); addGlow(p, n, r * .7, true); }; /* внешний модуль: его геометрия отрывается и улетает */
  D.hit = (ow, dw, kind, r, q) => { g.updateMatrixWorld(true); RC.set(ow, dw.clone().normalize()); const hs = RC.intersectObject(body, false); if (!hs.length) return false;
    const h = hs[0], lp = g.worldToLocal(h.point.clone()), n = h.face.normal.clone().normalize(), dl = dw.clone().transformDirection(new THREE.Matrix4().copy(g.matrixWorld).invert()).normalize(); if (n.dot(dl) > 0) n.negate(); const cs = Math.max(.05, -dl.dot(n));
    if (q && q.k === 'gat') kind = 'gat'; const pw = (q && q.pw) || r || 1, cal = kind === 'gat' ? 3 : kind === 'rail' ? (pw > 6 ? 30 : 15) : 10, E = q && q.gE ? q.gE : pw * (kind === 'gat' ? .15 : 15) * 1e6, eJ = E / (Math.PI * (cal / 2) ** 2) * (.85 + Math.random() * .3), dcm = Math.min(eJ / KST, (kind === 'gat' ? 400 : 3 * (cal / 5) ** 3 * 1000) / (7.8 * Math.PI * (cal / 2) ** 2)) * cs, /* не глубже длины снаряда */ Tt = (T && T.nose) ? (n.x > .7 ? T.nose : n.x < -.7 ? T.rear : T.side) : Math.max(.05, (T || 2) * .5) /* броня по зонам, м: нос/борт/корма */, d = Math.min(Tt, dcm / 100), R = (cal * .6 + Math.min(dcm, Tt * 100) * .35) / 100, scr = cs < .35;
    D.n++; { // накопление энергии по участкам 2 м: хватило — кусок корпуса откалывается и улетает
      const thr = BREAK.k * 5.5e9 * Math.max(.04, Tt) * Math.PI * BREAK.r * BREAK.r, ck = Math.floor(lp.x / 2) + ',' + Math.floor(lp.y / 2) + ',' + Math.floor(lp.z / 2), eAcc = (D.eg = D.eg || new Map()), e1 = (eAcc.get(ck) || 0) + (kind === 'gat' ? Math.max(E, thr / BREAK.gatN) : E); eAcc.set(ck, e1); /* гатлинг: кусок отлетает после ~50 попаданий в участок (усталость и пробоины от очереди) */
      if (e1 > thr) { eAcc.set(ck, 0); D.chunk(lp, n, BREAK.r * (.8 + Math.random() * .5)); } }
    { const dp = dl.clone().addScaledVector(n, -dl.dot(n)), t0b = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), ub = new THREE.Vector3().crossVectors(n, t0b).normalize(), vb = new THREE.Vector3().crossVectors(n, ub), ang = dp.lengthSq() > 1e-6 ? Math.atan2(dp.dot(vb), dp.dot(ub)) : null;
      addSoot(lp, n, Math.max(.5, R * (scr ? 2.5 : 3.5)) * (.7 + Math.random() * .6), scr ? ang : null); if (!scr) addGlow(lp, n, Math.max(.35, R * 1.4)); }
    let P = D.P.find(o => o.n.dot(n) > .995 && Math.abs(lp.clone().sub(o.p3).dot(o.n)) < .15 && lp.distanceTo(o.p3) < o.R + R + 1);
    if (!P) { const t0 = Math.abs(n.y) < .9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0), u = new THREE.Vector3().crossVectors(n, t0).normalize(), v = new THREE.Vector3().crossVectors(n, u);
      P = { p3: lp.clone(), p: lp.toArray(), n, u: u.toArray(), v: v.toArray(), nA: n.toArray(), T: Tt, g: new Map(), h: new Map(), R: 0 }; P.n = n; D.P.push(P); if (D.awake) D.npU.value = Math.min(NP, D.P.length); }
    const dd = lp.clone().sub(P.p3), ci = Math.round(dd.x * P.u[0] + dd.y * P.u[1] + dd.z * P.u[2]) / C | 0, cj = Math.round((dd.x * P.v[0] + dd.y * P.v[1] + dd.z * P.v[2]) / C), ci2 = Math.round((dd.x * P.u[0] + dd.y * P.u[1] + dd.z * P.u[2]) / C);
    const set = (ii, jj, add) => { const k = ii + ',' + jj, old = P.g.get(k) || 0; P.g.set(k, Math.min(P.T, old + add)); P.h.set(k, D.n); P.R = Math.max(P.R, Math.hypot(ii, jj) * C + C); };
    if (scr) { const a = Math.random() * 6.283, ca = Math.cos(a), sa = Math.sin(a), Ls = Math.min(4, R * 8), w = Math.max(.05, R * .35), dep = d * .5 + .02; for (let t = 0; t <= Ls; t += C * .5) { const f = t / Ls, dv0 = dep * Math.sin(Math.PI * Math.min(1, f * 1.3)), ww = w * (1 - f * .6); for (let o = -ww; o <= ww; o += C * .5) { const dv = dv0 * (1 - (o / ww) ** 2); if (dv > 0) set(ci2 + Math.round((ca * t - sa * o) / C), cj + Math.round((sa * t + ca * o) / C), dv * .5); } } }
    else { const N = Math.ceil(R / C); for (let i = -N; i <= N; i++) for (let j = -N; j <= N; j++) { const rr = Math.hypot(i * C, j * C); if (rr <= R) set(ci2 + i, cj + j, d * (1 - (rr / R) ** 2)); } }
    P.dirty = true; return d >= Tt - 1e-4; };
  // откол: треугольники корпуса с центром в радиусе r вырезаются (схлопываются) и становятся обломком, который летит прочь и крутится
  const deb = [];
  D.chunk = (p, n, r) => { const pa = body.geometry.attributes.position, ca = body.geometry.attributes.color, A = pa.array, C = ca.array, out = [], oc = [], r2 = r * r;
    for (let i = 0; i < A.length; i += 9) { const cx = (A[i] + A[i + 3] + A[i + 6]) / 3 - p.x, cy = (A[i + 1] + A[i + 4] + A[i + 7]) / 3 - p.y, cz = (A[i + 2] + A[i + 5] + A[i + 8]) / 3 - p.z; if (cx * cx + cy * cy + cz * cz > r2) continue;
      for (let k = 0; k < 9; k += 3) { out.push(A[i + k] - p.x, A[i + k + 1] - p.y, A[i + k + 2] - p.z); oc.push(C[i + k] * .8, C[i + k + 1] * .75, C[i + k + 2] * .7); A[i + k] = A[i]; A[i + k + 1] = A[i + 1]; A[i + k + 2] = A[i + 2]; } }
    if (!out.length) return; pa.needsUpdate = true; body.geometry.computeBoundingSphere();
    for (const eg of D.extraG || []) { const B = eg.attributes.position.array; for (let i = 0; i < B.length; i += 9) { const cx = (B[i] + B[i + 3] + B[i + 6]) / 3 - p.x, cy = (B[i + 1] + B[i + 4] + B[i + 7]) / 3 - p.y, cz = (B[i + 2] + B[i + 5] + B[i + 8]) / 3 - p.z; if (cx * cx + cy * cy + cz * cz > r2 * 1.3) continue; for (let k = 3; k < 9; k += 3) { B[i + k] = B[i]; B[i + k + 1] = B[i + 1]; B[i + k + 2] = B[i + 2]; } } eg.attributes.position.needsUpdate = true; }
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(out, 3)); dg.setAttribute('color', new THREE.Float32BufferAttribute(oc, 3)); dg.computeVertexNormals();
    const m = new THREE.Mesh(dg, new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .3, roughness: .6, flatShading: true, side: THREE.DoubleSide })); m.position.copy(p); g.add(m);
    deb.push({ m, v: n.clone().multiplyScalar(3 + Math.random() * 6).add(new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(2)), w: new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).multiplyScalar(1.5), t0: performance.now() });
    addSoot(p, n, r * 1.4); addGlow(p, n, r * .8, true); stat3.chunks++; };
  let lastT = performance.now();
  D.release = () => {}; D.step = () => { { const now = performance.now(), dt = Math.min(.1, (now - lastT) / 1000); lastT = now; for (let i = deb.length - 1; i >= 0; i--) { const o = deb[i]; o.m.position.addScaledVector(o.v, dt); o.m.rotation.x += o.w.x * dt; o.m.rotation.y += o.w.y * dt; o.m.rotation.z += o.w.z * dt; if (now - o.t0 > 40000) { g.remove(o.m); o.m.geometry.dispose(); deb.splice(i, 1); } } } if (D.cool) D.cool(); if (D.awake) { let k = 0; for (const P of D.P) if (P.dirty && k < 4) { P.dirty = false; rebuild(P); k++; } } const lo = g.userData.lod; if (!lo) return; const far = lo.getCurrentLevel() > 1; if (far) D.sleep(); else D.wake(); for (const t of g.userData.turs) t.visible = lo.getCurrentLevel() < 4; };
  return D;
}
export function pickDesign(tons, spec) { const l = list(); if (!l.length) return null; const nm = spec && spec.name, ds = nm && state.designs && state.designs.find(x => x.name === nm), want = (spec && spec.hull) || (ds && ds.hull) || nm; if (want) { const e = l.find(d => d.name === want); if (e) return e; } return pickByArms(l, tons, spec); }
// подбор проекта без явного указания: главное — состав вооружения (по видам, с количеством), второе — масса. Ракеты и лазеры не учитываются (у проектов нет их установок).
// Вид не подменяется: рельс ↔ рельсовые установки (калибр — мелкий штраф), гатлинг ↔ gat, зенитка ↔ flak. Модуль без башни — штраф 1, лишняя установка проекта (останется без модуля) — 0,25.
// Масса: проекты легче/тяжелее корабля больше чем в 4 раза не берём, если есть хоть один в пределах; внутри — 3 очка за каждое e-кратное расхождение (один модуль без башни ≈ расхождение массы в 1,4 раза).
const MASS_K = 4, W_MASS = 3;
function armsOf(spec) { const rc = (spec && spec.railCfg) || [], n = (spec && spec.rails) || 0, cal = []; for (let i = 0; i < n; i++) cal.push(+((rc[i] || {}).cal) || 10); return { rail: n, cal, gat: (spec && spec.gat) || 0, flak: (spec && spec.flak) || 0 } }
function designArms(d) { const c = { rail: 0, cal: [], gat: 0, flak: 0 }; for (const t of d.turs || []) { if (t.k === 'gat') c.gat++; else if (t.k === 'flak') c.flak++; else if (/^r\d+$/.test(t.k)) { c.rail++; c.cal.push(+t.k.slice(1)) } } return c }
function armsMiss(a, b) { let m = 0; for (const k of ['rail', 'gat', 'flak']) { const d = a[k] - b[k]; m += d > 0 ? d : -d * .25 }
  const ca = [...a.cal].sort((x, y) => x - y), cb = [...b.cal].sort((x, y) => x - y); for (let i = 0; i < Math.min(ca.length, cb.length); i++) if (ca[i] !== cb[i]) m += .1; return m }
export function pickByArms(l, tons, spec) { const A = armsOf(spec), inR = l.filter(d => Math.abs(Math.log(d.M / tons)) <= Math.log(MASS_K)), pool = inR.length ? inR : l;
  let b = null, bs = 1e9; for (const d of pool) { const sc = armsMiss(A, designArms(d)) + W_MASS * Math.abs(Math.log(d.M / tons)); if (sc < bs - 1e-9) { bs = sc; b = d } } return b }
// АВТОРАССТАНОВКА БАШЕН: модулю без установки в проекте ставится башня того же вида на свободную ровную площадку корпуса.
// Геометрия — из готовых башен проектов (тот же вид; рельс — ближайший калибр), место — лучами по поверхности: верх, низ, борта; площадка ровная (нормаль ±25°),
// над ней свободно на высоту башни, до соседних башен — не ближе суммы их радиусов ×1,15. Без координат под конкретные проекты.
const TPL = new Map();
function turGeo(t) { const pi = new Int16Array(ub(t.pos).buffer), ci = ub(t.col), k = pi.length, P = new Float32Array(k), C = new Float32Array(k); for (let i = 0; i < k; i++) { P[i] = pi[i] / 20; C[i] = ci[i] / 255 }
  const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(P, 3)); bg.setAttribute('color', new THREE.BufferAttribute(C, 3));
  const tu = new THREE.Object3D(); tu.position.set(t.p[0], t.p[1], t.p[2]); tu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(t.n[0], t.n[1], t.n[2])); tu.updateMatrix(); bg.applyMatrix4(tu.matrix.clone().invert()); bg.computeVertexNormals(); return bg }
function footBox(g) { const P = g.attributes.position.array; let h = 0, hx = 0, hz = 0; for (let i = 1; i < P.length; i += 3) h = Math.max(h, P[i]); for (let i = 0; i < P.length; i += 3) if (P[i + 1] < h * .25) { hx = Math.max(hx, Math.abs(P[i])); hz = Math.max(hz, Math.abs(P[i + 2])) } return { hx: hx || 1, hz: hz || 1, h: h || 1 } }
// коробка башни в координатах корабля (ось x — вдоль корпуса): по нормали — высота, поперёк — hz
function turBox(p, n, f, gap = 0) { const up = Math.abs(n.y) > .5, e = up ? [f.hx, f.h / 2, f.hz] : [f.hx, f.hz, f.h / 2], c = p.clone().addScaledVector(n, f.h / 2); return new THREE.Box3(new THREE.Vector3(c.x - e[0] - gap, c.y - e[1] - gap, c.z - e[2] - gap), new THREE.Vector3(c.x + e[0] + gap, c.y + e[1] + gap, c.z + e[2] + gap)) }
const boxOf = tu => tu.userData.box || (tu.userData.box = turBox(tu.position, tu.userData.n, tu.userData.f || { hx: 3, hz: 3, h: 3 }));
function footR(g) { const P = g.attributes.position.array; let h = 0; for (let i = 1; i < P.length; i += 3) h = Math.max(h, P[i]); let r = 0; for (let i = 0; i < P.length; i += 3) if (P[i + 1] < h * .25) r = Math.max(r, Math.hypot(P[i], P[i + 2])); return { r: r || 1, h } }
function tplOf(k) { if (TPL.has(k)) return TPL.get(k); const all = []; for (const d of list()) for (const t of d.turs || []) if (t.pos) all.push(t);
  const cal = s => +String(s).slice(1); let t = all.find(q => q.k === k), sc = 1;
  if (!t && /^r\d+$/.test(k)) { const rs = all.filter(q => /^r\d+$/.test(q.k)).sort((a, b) => Math.abs(cal(a.k) - cal(k)) - Math.abs(cal(b.k) - cal(k))); t = rs[0]; if (t) sc = cal(k) / cal(t.k) } // рельс другого калибра: та же установка в масштабе калибров
  let v = null; if (t) { const g = turGeo(t); if (sc !== 1) { g.scale(sc, sc, sc); g.computeVertexNormals() } const f = footR(g), b = footBox(g); v = { geo: g, r: f.r, h: f.h, f: b, sc, from: t.k } } TPL.set(k, v); return v }
export function autoTurrets(sp, kinds) { const d = list().find(q => q.name === sp.userData.design); if (!d || !kinds.length) return [];
  const body = new THREE.Mesh(geo(d), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide })), rc = new THREE.Raycaster(), L = d.L, bb = new THREE.Box3().setFromObject(body), out = [];
  const T = sp.userData.turs, rOf = tu => tu.userData.r || 3, N = [[0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]].map(a => new THREE.Vector3(...a)), cand = [];
  for (const n of N) for (let i = 0; i <= 40; i++) { const x = bb.min.x + (bb.max.x - bb.min.x) * (.05 + .9 * i / 40); for (const off of n.y ? [0, -.25, .25] : [0, -.2, .2]) {
      const o = new THREE.Vector3(x, n.y ? 0 : off * (bb.max.y - bb.min.y), n.y ? off * (bb.max.z - bb.min.z) : 0).addScaledVector(n, L * 2); rc.set(o, n.clone().negate()); const h = rc.intersectObject(body, false)[0];
      if (!h || !h.face) continue; const fn = h.face.normal.clone(); if (Math.abs(fn.dot(n)) < .9) continue; cand.push({ p: h.point, n, pri: (n.y > 0 ? 0 : n.y < 0 ? 1 : 2) * 10 + Math.abs(x - (bb.min.x + bb.max.x) / 2) / L * 4 + Math.abs(off) * 2 }) } }
  cand.sort((a, b) => a.pri - b.pri);
  const left = [];
  for (const k of kinds) { const tp = tplOf(k); if (!tp) { out.push(null); continue } let ok = null;
    for (const c of cand) { if (c.p.x - tp.r < bb.min.x || c.p.x + tp.r > bb.max.x) continue; /* со стволами — в пределах длины корпуса */ const bx = turBox(c.p, c.n, tp.f, tp.f.hx * .1); if (T.some(tu => boxOf(tu).intersectsBox(bx))) continue
      rc.set(c.p.clone().addScaledVector(c.n, .05), c.n); const up = rc.intersectObject(body, false)[0]; if (up && up.distance < tp.h * 1.2) continue; // над площадкой нависает корпус
      ok = c; break }
    if (!ok) { out.push(null); left.push(k); continue }
    const tu = new THREE.Group(); tu.position.copy(ok.p); tu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ok.n); const hd = new THREE.Group(); hd.position.y = .6; tu.add(hd);
    out.push(mkAuto(sp, T, k, tp, ok.p, ok.n)) }
  // не хватило ровных площадок — корпус дополняется бортовыми спонсонами под оставшиеся башни
  if (left.length) { const add = sponsons(sp, d, body, bb, left); let j = 0; for (let i = 0; i < out.length; i++) if (!out[i]) out[i] = add[j++] || null }
  { const left2 = []; for (let i = 0; i < out.length; i++) if (!out[i] && kinds[i] && tplOf(kinds[i])) left2.push(i); if (left2.length) { const add = decks(sp, body, bb, left2.map(i => kinds[i])); left2.forEach((i, j) => { if (add[j]) out[i] = add[j] }) } }
  sp.userData.layout = layoutReport(sp, kinds, out, bb);
  return out }
function mkAuto(sp, T, k, tp, p, n, parent = null) { const tu = new THREE.Group(); tu.position.copy(p); tu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n); const hd = new THREE.Group(); hd.position.y = .6; tu.add(hd);
  const bm = new THREE.Mesh(tp.geo, lodMat); bm.name = 'body'; tu.add(bm); tu.userData = { isTur: 1, head: hd, tipX: k === 'gat' ? 6 : 8, n: n.clone(), k, r: tp.r, f: tp.f, auto: 1 }; (parent || sp).add(tu); T.push(tu); return tu }
// ТРЕБОВАНИЯ К ПЛОЩАДКАМ: что нужно компоненту на корпусе (радиус основания, высота, поверхности). Сейчас — башни; дальше сюда же двигатели, сенсоры, радиаторы.
export function layoutPlan(kinds) { const reqs = kinds.map(padReq); return { reqs, area: +reqs.reduce((a, q) => a + (q ? 4 * q.hx * q.hz * (1 + q.gap) ** 2 : 0), 0).toFixed(0), limits: { sponson: SPN, deck: DECK } } } // до постройки: что нужно и в каких пределах можно расширять корпус
export function padReq(kind) { const tp = tplOf(kind); return tp ? { kind, hx: tp.f.hx, hz: tp.f.hz, h: tp.f.h, gap: .15, faces: ['top', 'side', 'bottom'] } : null }
// СПОНСОНЫ: блочный выступ на борту (по обе стороны поровну), верх — площадка под башни в ряд с интервалом. Ограничения формы:
// длина спонсона ≤ 60% длины корпуса, вынос ≤ 35% ширины корпуса (если башня шире — не ставим), не ближе к соседним башням корпуса, чем сумма оснований.
// НАДСТРОЕЧНАЯ ПАЛУБА: если не хватило ни корпуса, ни спонсонов — блок на самом длинном свободном от башен участке верха; башни — на нём в один или два ряда.
// Ограничения: длина ≤ 50% корпуса, ширина ≤ 70% ширины, высота ≤ 30% высоты корпуса; только над участком, где на верху корпуса нет башен.
const DECK = { len: .5, w: .7, h: .3 };
function decks(sp, body, bb, kinds) { const T = sp.userData.turs, rc = new THREE.Raycaster(), W = bb.max.z - bb.min.z, H = bb.max.y - bb.min.y, L = bb.max.x - bb.min.x, N = 40, cell = L / N, res = [];
  const reqs = kinds.map(padReq).filter(Boolean); if (!reqs.length) return [];
  const hz = Math.max(...reqs.map(q => q.hz)), hx = Math.max(...reqs.map(q => q.hx)), hmax = Math.max(...reqs.map(q => q.h)), w = Math.min(W * DECK.w, hz * 2.2 * 2), rows = w >= hz * 2.2 * 2 ? 2 : 1; if (w < hz * 2.2) return [];
  const free = [], top = []; for (let i = 0; i < N; i++) { const x = bb.min.x + (i + .5) * cell; rc.set(new THREE.Vector3(x, bb.max.y + H * 2, 0), new THREE.Vector3(0, -1, 0)); const h = rc.intersectObject(body, false)[0]; top.push(h ? h.point.y : null);
    const col = new THREE.Box3(new THREE.Vector3(x - cell / 2, (h ? h.point.y : bb.max.y) - .2, -w / 2), new THREE.Vector3(x + cell / 2, bb.max.y + H, w / 2)); free.push(!!h && i > N * .06 && i < N * .94 && !T.some(tu => boxOf(tu).intersectsBox(col))) }
  let bi = -1, bl = 0; for (let i = 0; i < N;) { if (!free[i]) { i++; continue } let j = i; while (j < N && free[j]) j++; if (j - i > bl) { bl = j - i; bi = i } i = j }
  let post = 0, len, a, y0; const h = Math.max(1, Math.min(H * DECK.h, hmax * .8));
  if (bi >= 0 && bl * cell >= hx * 2.6) { len = Math.min(bl * cell, L * DECK.len); a = bb.min.x + bi * cell + (bl * cell - len) / 2; y0 = Math.max(...top.slice(bi, bi + bl).filter(v => v != null)) }
  else { // верх занят башнями — второй ярус: палуба над ними на стойках, подъём ≤ 60% высоты корпуса
    len = L * DECK.len; a = (bb.min.x + bb.max.x) / 2 - len / 2; const span = new THREE.Box3(new THREE.Vector3(a, bb.min.y, -w / 2), new THREE.Vector3(a + len, bb.max.y + H * 2, w / 2));
    const ht = Math.max(...top.filter((v, i) => v != null && bb.min.x + (i + .5) * cell >= a && bb.min.x + (i + .5) * cell <= a + len)), tb = Math.max(ht, ...T.filter(tu => boxOf(tu).intersectsBox(span)).map(tu => boxOf(tu).max.y)) + .5;
    if (tb - ht > H * .6) return []; y0 = tb; post = tb - ht }
  const ch = Math.min(h * 1.2, len * .2), part = createPart('deck', { len, w, h, x: a, y: y0, mat: lodMat, post }); part.root.userData.sec = 'deck'; sp.add(part.root); (sp.userData.sections = sp.userData.sections || []).push(part); const deckG = part.piece('deck');
  let placed = 0; const zs = rows === 2 ? [-w / 4, w / 4] : [0], occ = []; kinds.forEach((k, ki) => { const q = padReq(k); if (!q) return; let done = false;
    for (let x = a + ch + q.hx * (1 + q.gap); x <= a + len - ch - q.hx * (1 + q.gap) + 1e-6 && !done; x += cell / 2) for (const z of zs) { const p = new THREE.Vector3(x, y0 + h, z), bx = turBox(p, new THREE.Vector3(0, 1, 0), { hx: q.hx, hz: q.hz, h: q.h }, .1);
      if (p.x - tplOf(k).r < bb.min.x || p.x + tplOf(k).r > bb.max.x || occ.some(o => o.intersectsBox(bx)) || T.some(tu => boxOf(tu).intersectsBox(bx))) continue; occ.push(bx); res[ki] = mkAuto(sp, T, k, tplOf(k), p, new THREE.Vector3(0, 1, 0), deckG); placed++; done = true; break } });
  if (!placed) { sp.remove(part.root); sp.userData.sections.pop() } return kinds.map((_, i) => res[i] || null) }
// ОТЧЁТ КОМПОНОВКИ: что требовалось (площадь оснований с интервалами), куда встало (корпус / спонсон / палуба), что осталось, габариты корпуса и добавленных секций
function layoutReport(sp, kinds, out, bb) { const r = { need: 0, hull: 0, sponson: 0, deck: 0, none: 0, area: 0, dims: bb.getSize(new THREE.Vector3()).toArray().map(v => +v.toFixed(1)), sections: (sp.userData.sections || []).map(p => p.type) };
  kinds.forEach((k, i) => { const q = padReq(k); if (q) r.area += 4 * q.hx * q.hz * (1 + q.gap) ** 2; r.need++; const tu = out[i]; if (!tu) { r.none++; return } let o = tu.parent, sec = null; while (o && o !== sp && !sec) { sec = o.userData.sec; o = o.parent } r[sec || 'hull']++ }); r.area = +r.area.toFixed(0); return r }
const SPN = { len: .6, out: .65, wall: .4 }; // длина ≤ 60% корпуса, вынос ≤ 65% ширины корпуса, заход внутрь борта
function sponsons(sp, d, body, bb, kinds) { const T = sp.userData.turs, res = [], rc = new THREE.Raycaster(), W = bb.max.z - bb.min.z, H = bb.max.y - bb.min.y, L = bb.max.x - bb.min.x, xm = (bb.min.x + bb.max.x) / 2, ym = (bb.min.y + bb.max.y) / 2;
  const reqs = kinds.map(padReq), side = [[], []]; reqs.forEach((q, i) => side[i % 2].push({ q, i })); // поровну по бортам — симметрия силуэта
  const hullZ = (x, y, sg) => { rc.set(new THREE.Vector3(x, y, sg * W * 4), new THREE.Vector3(0, 0, -sg)); const h = rc.intersectObject(body, false)[0]; return h ? sg * h.point.z : 0 };
  [1, -1].forEach((sg, si) => { const S = side[si].filter(e => e.q && e.q.hz * 2.2 <= W * SPN.out); if (!S.length) return;
    const pitch = S.map(e => e.q.hx * 2 * (1 + e.q.gap)), need = Math.min(pitch.reduce((a, b) => a + b, 0), L * SPN.len), wo = Math.max(...S.map(e => e.q.hz)) * 2.2, th = Math.max(.8, Math.min(H * .14, wo * .18)), hmax = Math.max(...S.map(e => e.q.h));
    // место: уровень по высоте борта × сдвиг вдоль корпуса; объём спонсона вместе с башнями не задевает ни одной башни
    let at = null; for (const lv of [0, .3, -.3, .45, -.45]) { const yl = ym + lv * H; for (let k = 0; k <= 30 && !at; k++) for (const sgn of [1, -1]) { const c = xm + sgn * k * L * .02, a = c - need / 2, b = c + need / 2; if (a < bb.min.x + L * .08 || b > bb.max.x - L * .08) continue;
        let zi = 0, hit = 0, ns = 0; for (let x = a; x <= b + 1e-6; x += need / 8) { ns++; const z = hullZ(x, yl, sg); if (z) { hit++; zi = Math.max(zi, z) } } if (!zi || hit < ns * .7) continue; // борт под спонсоном почти на всём участке (вырезы и ниши допустимы)
        const side = T.filter(tu => tu.userData.n && tu.userData.n.z * sg > .5).map(tu => sg > 0 ? boxOf(tu).max.z : -boxOf(tu).min.z), clr = side.length ? Math.max(0, Math.max(...side) - zi + .5) : 0;
        for (const off of [0, clr]) { if (off > W * .4) continue; const z0 = zi + off, vol = new THREE.Box3(new THREE.Vector3(a, yl - th / 2, sg > 0 ? z0 - (off ? 0 : SPN.wall) : -(z0 + wo)), new THREE.Vector3(b, yl + th / 2 + hmax, sg > 0 ? z0 + wo : -(z0 - (off ? 0 : SPN.wall))));
          if (T.some(tu => boxOf(tu).intersectsBox(vol))) continue; at = { a, yl, zi, off }; break } if (at) break } if (at) break }
    if (!at) return;
    let x = at.a, placed = []; S.forEach((e, j) => { const pt = pitch[j]; if (x + pt > at.a + need + 1e-6) return; const p = new THREE.Vector3(x + pt / 2, at.yl + th / 2, sg * (at.zi + at.off + wo / 2)); x += pt;
      if (p.x - tplOf(e.q.kind).r < bb.min.x || p.x + tplOf(e.q.kind).r > bb.max.x) return; placed.push({ e, p }) });
    if (!placed.length) return; // ни одна башня не встала — спонсон не нужен
    const a = Math.min(...placed.map(q => q.p.x - q.e.q.hx * 1.15)), b = Math.max(...placed.map(q => q.p.x + q.e.q.hx * 1.15)), len = b - a, ch = Math.min(wo * .7, len * .3);
    // плита-трапеция в плане: у борта во всю длину, наружу сужается скосами — палубное крыло, а не коробка
    const part = createPart('sponson', { len, wo, th, ch, wall: SPN.wall, x: a, y: at.yl, z: sg * (at.zi + at.off), sg, off: at.off, mat: lodMat }); part.root.userData.sec = 'sponson'; sp.add(part.root); (sp.userData.sections = sp.userData.sections || []).push(part); (sp.userData.sponsons = sp.userData.sponsons || []).push(part.root);
    const deckG = part.piece('deck');
    for (const q of placed) res[q.e.i] = mkAuto(sp, T, q.e.q.kind, tplOf(q.e.q.kind), q.p, new THREE.Vector3(0, 1, 0), deckG) });
  return kinds.map((_, i) => res[i] || null) }
export function buildDesign(d, opt) {
  const g = new THREE.Group(), gB = geo(d).clone(), body0 = new THREE.Mesh(gB); /* своя копия корпуса: из неё откалываются куски */ const D = mkDmg(g, body0, opt && opt.arm); const body = new THREE.Mesh(gB, mkMat(D)); { // нутро: тёмный внутренний корпус (меньше на 10–20%) и переборки — в пробоине видно конструкцию, а не пустоту насквозь
    gB.computeBoundingBox(); const bb = gB.boundingBox, c = bb.getCenter(new THREE.Vector3()), sz = bb.getSize(new THREE.Vector3()), inner = new THREE.Group(); inner.position.copy(c); inner.scale.set(.9, .78, .78);
    const im = new THREE.Mesh(geo(d), innerMat); im.position.copy(c).negate(); inner.add(im);
    body.add(inner); body.updateMatrix(); } const lod = new THREE.LOD(); lod.addLevel(body, 0); D.extraG = []; for (let i = 1; i < LODK.length; i++) { const gl = i <= 2 ? geoLod(d, i).clone() : geoLod(d, i); if (i <= 2) D.extraG.push(gl); lod.addLevel(new THREE.Mesh(gl, lodMat), 1e9); } /* ближние лоды — свои копии: откол виден и на них */ g.add(lod); D.hit2 = D.hit; D.hit = (ow, dw, kind, r, q) => { body0.matrixWorld = body.matrixWorld; return D.hit2(ow, dw, kind, r, q); };
  const turs = [];
  for (const t of d.turs) { const tu = new THREE.Group(), n = new THREE.Vector3(t.n[0], t.n[1], t.n[2]); tu.position.set(t.p[0], t.p[1], t.p[2]); tu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const hd = new THREE.Group(); hd.position.y = .6; tu.add(hd); tu.userData = { isTur: 1, head: hd, tipX: t.k === 'gat' ? 6 : 8, n, k: t.k }; g.add(tu); turs.push(tu);
    if (t.pos) { const pi = new Int16Array(ub(t.pos).buffer), ci = ub(t.col), k = pi.length, P = new Float32Array(k), C = new Float32Array(k); for (let i = 0; i < k; i++) { P[i] = pi[i] / 20; C[i] = ci[i] / 255 } // геометрия башни из редактора — отдельно от корпуса (те же треугольники)
      const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(P, 3)); bg.setAttribute('color', new THREE.BufferAttribute(C, 3)); tu.updateMatrix(); bg.applyMatrix4(tu.matrix.clone().invert()); bg.computeVertexNormals();
      const bm = new THREE.Mesh(bg, lodMat); bm.name = 'body'; tu.add(bm); tu.userData.r = footR(bg).r; tu.userData.f = footBox(bg) } }
  // огни и факелы двигателей из редактора: аддитивные спрайты (огни мигают) и конусы пламени
  const glowT = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const lights = [], plumes = [];
  for (const o of d.gl || []) { const col = new THREE.Color(o.c || '#7fd3ff');
    if (o.t === 'lt') { const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); sp.position.set(o.p[0], o.p[1], o.p[2]); sp.scale.setScalar(o.r * 2.2); sp.userData.ph = Math.random() * 6; g.add(sp); lights.push(sp); }
    else { // факел: два скрещённых узких луча, яркое ядро у сопла гаснет к концу (как трассер), плюс горячая точка в сопле
      const len = (o.len || o.r * 5) * 1.4, w = o.r * .9, pl = new THREE.Group(); pl.position.set(o.p[0], o.p[1], o.p[2]);
      for (const rx of [0, Math.PI / 2]) { const pg = new THREE.PlaneGeometry(len, w * 2); pg.translate(-len / 2, 0, 0); pg.rotateX(rx); pl.add(new THREE.Mesh(pg, new THREE.MeshBasicMaterial({ map: plumeTex(), color: col, blending: THREE.AdditiveBlending, transparent: true, depthWrite: false, side: THREE.DoubleSide }))); }
      const hs = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowT, color: col, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true })); hs.scale.setScalar(o.r * 2.2); pl.add(hs);
      g.add(pl); plumes.push(pl); } }
  const inner = new THREE.Group(); inner.visible = false; g.add(inner);
  g.userData = { plumes, lod, setLodScale: (k) => { const Lw = d.L * k; lod.levels.forEach((l, i) => l.distance = Lw * LODD[i]); }, L: d.L, turs, inner, hu: { sh: { value: new THREE.Matrix4() } }, design: d.name, dmg: D };
  return g;
}
