// Тестовый настоящий 3D-вид боя (three.js): поверх карты, корабли — объёмные модели, свободная орбитальная камера.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Battle } from './05-battle.ts';
import { massParts, TON_L, RAIL_CAL } from './01-data.ts';

const wrap = document.getElementById('mapwrap');
const bgo = document.getElementById('bgo');
if (wrap && bgo) {
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'b3d'; btn.textContent = '3D'; btn.title = 'Объёмный вид боя (тест)';
  bgo.after(btn);

  let on = false, ren: THREE.WebGLRenderer | null = null, scene: THREE.Scene, cam: THREE.PerspectiveCamera, raf = 0;
  let fitAll = true; let yaw = .6, pitch = .45, dist = 40, SC = 1.5, follow = true;
  const tgt = new THREE.Vector3();
  const models = new Map<any, THREE.Group>();
  const geoBox = new RoundedBoxGeometry(1, 1, 1, 1, .12), geoCone = new THREE.ConeGeometry(.5, 1, 8), geoSph = new THREE.SphereGeometry(1, 8, 6), geoDome = new THREE.SphereGeometry(1, 16, 10), geoCyl = new THREE.CylinderGeometry(1, 1, 1, 8).rotateZ(Math.PI / 2);
  const mats = [0x4aa8e8, 0xe8803a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .35 }));
  const matDark = new THREE.MeshStandardMaterial({ color: 0x1a1d23, roughness: .8 });
  const matTur = [0xe8f3ff, 0xffd9b0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .4, metalness: .5 }));
  const matGlow = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const matDead = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 1 });
  const MAXPL = 900, MAXD = 160; let plateMesh: THREE.InstancedMesh; const decalGeo = new THREE.CircleGeometry(1, 10), decalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: .92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const MAXC = 300; let casings: THREE.InstancedMesh; const cas: any[] = []; let trailLines: THREE.LineSegments, shotLines: THREE.LineSegments; let ring: THREE.LineLoop | null = null; let fxMesh: THREE.InstancedMesh; const MAXFX = 400;
   let fighters: THREE.InstancedMesh, projLines: THREE.LineSegments, misPts: THREE.Points, beamLines: THREE.LineSegments;
  const MAXT = 14000, MAXF = 4000, MAXP = 4000;

  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:10px;top:44px;z-index:5;color:#cfe;font:12px monospace;background:rgba(10,14,22,.7);padding:6px 8px;border-radius:6px;display:none;pointer-events:none';
  hud.innerHTML = 'ЛКМ: вращать · колесо: зум · ПКМ: сдвиг · [ ] размер · F: следить за выбранным · A: вписать всё поле';
  wrap.appendChild(hud);

  function init() {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;display:block';
    wrap!.appendChild(cv);
    ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    ren.setPixelRatio(Math.min(1.5, devicePixelRatio));
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a12); scene.fog = new THREE.FogExp2(0x070a12, .00008);
    cam = new THREE.PerspectiveCamera(50, 1, .05, 6000);
    scene.add(new THREE.HemisphereLight(0x8aa4d8, 0x20161c, 1.1));
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.2); sun.position.set(300, 400, 200); scene.add(sun);
    const st = new Float32Array(1500 * 3); for (let i = 0; i < st.length; i += 3) { const v = new THREE.Vector3().randomDirection().multiplyScalar(2500); st[i] = v.x; st[i + 1] = v.y; st[i + 2] = v.z }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(st, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaabbdd, size: 2, sizeAttenuation: false, fog: false })));
    fighters = new THREE.InstancedMesh(geoCone, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXF); fighters.frustumCulled = false; fighters.count = 0;
    fighters.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(fighters);
    const addMat = () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 6), 3)); pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXP * 6), 3));
    projLines = new THREE.LineSegments(pg, addMat()); projLines.frustumCulled = false; scene.add(projLines);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2000 * 3), 3));
    misPts = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xff8a50, size: 5, sizeAttenuation: false })); misPts.frustumCulled = false; scene.add(misPts);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 6), 3));
    beamLines = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0x7af4ff })); beamLines.frustumCulled = false; scene.add(beamLines);

    fxMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }), MAXFX); fxMesh.frustumCulled = false; fxMesh.count = 0; fxMesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(fxMesh);
    const tg2 = new THREE.BufferGeometry(); tg2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXT * 6), 3)); tg2.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXT * 6), 3));
    trailLines = new THREE.LineSegments(tg2, addMat()); trailLines.frustumCulled = false; scene.add(trailLines);
    const MAXS = 600, sg2 = new THREE.BufferGeometry(); sg2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXS * 6), 3)); sg2.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXS * 6), 3));
    shotLines = new THREE.LineSegments(sg2, addMat()); shotLines.frustumCulled = false; scene.add(shotLines);
    plateMesh = new THREE.InstancedMesh(unitBox, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .7, metalness: .3, flatShading: true }), MAXPL); plateMesh.frustumCulled = false; plateMesh.count = 0; plateMesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(plateMesh);
    casings = new THREE.InstancedMesh(geoBox, new THREE.MeshBasicMaterial({ color: 0xd9b24a }), MAXC); casings.frustumCulled = false; casings.count = 0; scene.add(casings);
    let drag = 0, lx = 0, ly = 0;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    let dx0 = 0, dy0 = 0;
    cv.addEventListener('mousedown', e => { drag = e.button === 2 ? 2 : 1; lx = dx0 = e.clientX; ly = dy0 = e.clientY });
    cv.addEventListener('mouseup', e => { // клик без перетаскивания — выбрать корабль
      if (e.button !== 0 || Math.hypot(e.clientX - dx0, e.clientY - dy0) > 4) return;
      const r = cv.getBoundingClientRect(), ndc = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
      const rc = new THREE.Raycaster(); rc.setFromCamera(ndc, cam); const roots = [...models.values()].filter(g => g.visible);
      const hit = rc.intersectObjects(roots, true)[0]; let o: any = hit && hit.object; while (o && !(o.userData && o.userData.s)) o = o.parent;
      if (o) { Battle.select(o.userData.s); follow = true; fitAll = false } else Battle.select(null);
    });
    addEventListener('mouseup', () => { drag = 0 });
    addEventListener('mousemove', e => {
      if (!on || !drag) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      if (drag === 1) { yaw -= dx * .006; pitch = Math.max(-1.45, Math.min(1.45, pitch + dy * .006)) }
      else { follow = false; const r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); tgt.addScaledVector(r, -dx * dist * .0016); tgt.y += dy * dist * .0016 }
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); fitAll = false; dist = Math.max(.3, Math.min(2500, dist * Math.exp(e.deltaY * .0012))) }, { passive: false });
    addEventListener('keydown', e => { if (!on) return; if (e.key === '[') SC = Math.max(1, SC / 1.4); else if (e.key === ']') SC = Math.min(40, SC * 1.4); else if (e.key === 'f' || e.key === 'F') { follow = true; fitAll = false } else if (e.key === 'a' || e.key === 'A') { follow = true; fitAll = true } });
  }

  // ---- процедурный «сборный» корпус: ступенчатые блоки, камуфляжные плиты, рубка, антенны, сопла ----
  const PAL = [
    { main: 0x5b86a8, dark: 0x25384d, acc: 0xd8e6f2, acc2: 0x2f9fbf, glow: 0x7af4ff },
    { main: 0xe0743a, dark: 0x2c3a58, acc: 0xb8325f, acc2: 0xf2a65a, glow: 0xffd27a },
  ];
  function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  function piece(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rz = 0) {
    const g = geo.index ? geo.toNonIndexed() : geo.clone(); g.scale(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z);
    const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g;
  }
  const unitBox = new RoundedBoxGeometry(1, 1, 1, 1, .09), unitCyl = new THREE.CylinderGeometry(.5, .5, 1, 10).rotateZ(Math.PI / 2);
  function taper(len: number, h: number, w: number, k: number) { // клиновидный блок: сужается к носу (+x)
    const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) { p.setY(i, p.getY(i) * k); p.setZ(i, p.getZ(i) * k) }
    g.scale(len, h, w); return g;
  }
  function hullGeo(s: any, seed: number) {
    const R = rng(seed), P = PAL[s.side], L = s.T.L, W = L * .17, H = L * .095, parts: THREE.BufferGeometry[] = [];
    const shade = (c: number, f: number) => new THREE.Color(c).multiplyScalar(f).getHex();
    // хребет из блоков: участки идут по модулям корабля (корма → нос), длина участка пропорциональна массе модулей
    const x0 = -L * .5, x1 = L * .34, Lk = x1 - x0; const seg: any[] = [];
    const mp = massParts(s.spec || { rails: 10, flak: 2, tons: L * TON_L }), ORD: [string, string][] = [['eng', 'e'], ['struct', 's'], ['hangF', 'f'], ['hangB', 'b'], ['mar', 's'], ['flak', 'w'], ['rail', 'w'], ['miss', 'm'], ['laser', 'l'], ['core', 'c']];
    const lst: { ty: string; len: number }[] = []; { const raw = ORD.filter(([k]) => mp.parts[k] > 0).map(([k, ty]) => ({ k, ty, w: Math.max(mp.parts[k], 1) })); const tt = raw.reduce((a, q) => a + q.w, 0);
      const sh = raw.map(q => Math.max(q.w / tt, .03)), ss = sh.reduce((a, b) => a + b, 0);
      raw.forEach((q, i) => { const share = sh[i] / ss * Lk, nb = Math.max(1, Math.min(5, Math.round(share / (Lk * .1)))); for (let j = 0; j < nb; j++) lst.push({ ty: q.ty, len: share / nb }) }) }
    let x = x0;
    for (const e of lst) {
      const ty = e.ty, len = e.len, wF = ty === 'e' ? .95 : ty === 'f' || ty === 'b' ? 1.1 : ty === 'w' || ty === 'm' ? .8 : .62 + R() * .38, hF = ty === 'e' ? 1.1 : ty === 'f' || ty === 'b' ? 1.05 : ty === 'w' || ty === 'm' ? .8 : .65 + R() * .45;
      const w = W * wF, h = H * hF, cx = x + len / 2, cy = ty === 's' ? (R() - .5) * H * .25 : 0;
      const col = ty === 'e' ? P.dark : ty === 'f' ? P.main : ty === 'b' ? P.acc2 : R() < .55 ? P.main : R() < .6 ? P.dark : P.acc2;
      seg.push({ cx, w, h, len, cy, weapon: ty === 'w' || ty === 'm' || ty === 'l', ty });
      parts.push(piece(unitBox, shade(col, .85 + R() * .3), cx, cy, 0, len * 1.02, h, w));
      if (ty === 'f' || ty === 'b') for (const sd of [-1, 1]) { // ангарные ворота по бортам
        parts.push(piece(unitBox, 0x0b0d12, cx, cy - h * .05, sd * (w / 2 + w * .01), len * .78, h * .5, w * .03)); parts.push(piece(unitBox, P.glow, cx, cy - h * .3, sd * (w / 2 + w * .02), len * .78, h * .03, w * .02)) }
      if (ty === 'e') for (let i = 0; i < 4; i++) parts.push(piece(unitBox, shade(P.main, .7), cx - len / 2 + (i + .5) * len / 4, cy, 0, len * .07, h * 1.12, w * 1.04)); // рёбра радиатора
      if (ty === 'm') for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) parts.push(piece(unitBox, shade(P.dark, 1.1), cx - len * .4 + (i + .5) * len * .8 / 6, cy + h / 2 + h * .08, sd * w * .22, len * .1, h * .16, w * .3)); // ракетные шахты
      if (ty === 'l') { parts.push(piece(unitCyl, 0x20242c, cx + len * .25, cy + h / 2 + h * .2, 0, len * 1.3, h * .5, h * .5)); parts.push(piece(unitCyl, P.glow, cx + len * .9, cy + h / 2 + h * .2, 0, len * .08, h * .35, h * .35)) } // лазерная пушка
      x += len;
    }
    // нос
    parts.push(piece(taper(1, 1, 1, .25), P.main, x1 + L * .09, 0, 0, L * .2, H * .95, W * .78));
    parts.push(piece(taper(1, 1, 1, .3), P.dark, x1 + L * .02, -H * .35, 0, L * .12, H * .5, W * .6));
    // боковые бронеплиты (камуфляж)
    for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) {
      const sg = seg[Math.floor(R() * seg.length)], len = L * (.1 + R() * .16), h = H * (.5 + R() * .5), w = W * .12, col = R() < .5 ? P.acc : R() < .5 ? P.dark : P.acc2;
      const px = sg.cx + (R() - .5) * sg.len, pz = sd * (sg.w * .5 + w * .35);
      parts.push(piece(unitBox, shade(col, .9 + R() * .2), px, sg.cy + (R() - .5) * H * .35, pz, len, h, w));
      parts.push(piece(unitBox, shade(col, 1.25), px, sg.cy + h * .15, pz + sd * w * .52, len * .8, h * .06, w * .04)); // линии панелей
    }
    // верхние блоки и рубка
    for (let i = 0; i < 9; i++) { const sg = seg[Math.floor(R() * seg.length)], len = sg.len * (.4 + R() * .5), h = H * (.15 + R() * .3), w = sg.w * (.3 + R() * .5);
      parts.push(piece(unitBox, shade(R() < .5 ? P.dark : P.main, .8 + R() * .4), sg.cx + (R() - .5) * sg.len * .5, sg.cy + sg.h / 2 + h / 2, (R() < .5 ? -1 : 1) * sg.w * .38, len, h * .7, w * .22)) }
    const bs = seg[seg.length - 1], bh = H * 1.4, bx = bs.cx;
    parts.push(piece(unitBox, P.dark, bx, bs.cy + bs.h / 2 + bh * .25, 0, L * .07, bh * .5, W * .55));
    parts.push(piece(unitBox, P.acc2, bx + L * .005, bs.cy + bs.h / 2 + bh * .6, 0, L * .055, bh * .22, W * .5));
    parts.push(piece(unitBox, P.glow, bx + L * .006, bs.cy + bs.h / 2 + bh * .6, 0, L * .057, bh * .06, W * .52));
    parts.push(piece(unitBox, P.main, bx, bs.cy + bs.h / 2 + bh * .86, 0, L * .04, bh * .2, W * .36));
    for (const z of [-1, 1]) parts.push(piece(unitBox, 0x8a8f99, bx - L * .01, bs.cy + bs.h / 2 + bh * 1.35, z * W * .12, L * .004, bh * .75, L * .004));
    parts.push(piece(unitBox, 0x8a8f99, bx - L * .01, bs.cy + bs.h / 2 + bh * 1.6, 0, L * .004, L * .004, W * .3));
    // грибы мелкой фурнитуры
    for (let i = 0; i < 50; i++) { const sg = seg[Math.floor(R() * seg.length)], a = R() < .6, r = L * (.003 + R() * .006);
      parts.push(piece(unitBox, shade(R() < .5 ? P.acc : 0x6a707c, .8 + R() * .4), sg.cx + (R() - .5) * sg.len, a ? sg.cy + sg.h / 2 + r / 2 : sg.cy + (R() - .5) * sg.h, a ? (R() < .5 ? -1 : 1) * sg.w * (.3 + R() * .15) : (R() < .5 ? -1 : 1) * (sg.w / 2 + r / 2), r * (1 + R() * 2), r, r * (1 + R() * 1.5))) }
    // кормовой блок и сопла
    const ne = Math.max(2, Math.min(5, s.engN || 3));
    parts.push(piece(unitBox, P.dark, x0 - L * .02, 0, 0, L * .06, H * 1.15, W * 1.05));
    const nozz: any[] = [];
    for (let i = 0; i < ne; i++) { const zz = (i - (ne - 1) / 2) * (W * .8 / Math.max(1, ne - 1)) * (ne > 1 ? 1 : 0), r = Math.min(H * .38, W * .5 / ne * 1.5);
      parts.push(piece(unitCyl, 0x16181d, x0 - L * .075, 0, zz, L * .05, r * 2, r * 2)); nozz.push({ z: zz, r }) }
    // 200 жёстких точек крепления по всему корпусу: сверху, снизу и с обоих бортов (грани 0 верх, 1 правый, 2 низ, 3 левый)
    const nT = (s.spec ? (s.spec.rails || 0) + (s.spec.flak || 0) + (s.spec.lasers || 0) + (s.spec.miss || 0) : 40) || 1;
    let usable = seg.filter(q => q.weapon && Math.abs(q.cx - bx) > L * .06); if (!usable.length) usable = seg.filter(q => Math.abs(q.cx - bx) > L * .06);
    const arOf = (us: any[]) => { let a = 0; for (const q of us) a += (q.len * q.w * 2 + q.len * q.h * 2) * .7; return a };
    if (arOf(usable) < L * L * .05) usable = seg.filter(q => Math.abs(q.cx - bx) > L * .06);
    const rD = (s.spec && s.spec.railCfg && s.spec.railCfg[0] ? (RAIL_CAL as any)[s.spec.railCfg[0].cal] || RAIL_CAL[10] : RAIL_CAL[10]).m / TON_L; // диаметр башни: масса/50 т на метр
    const cell = Math.max(rD * 1.3, L * .004, Math.sqrt(arOf(usable) / (nT * 2.4))), mounts: { x: number; y: number; z: number; face: number }[] = [];
    for (const q of usable) {
      const cols = Math.max(1, Math.floor(q.len / cell)), xs = (a: number) => q.cx - q.len / 2 + (a + .5) * q.len / cols;
      const rw = Math.max(1, Math.floor(q.w * .7 / cell)), rh = Math.max(1, Math.floor(q.h * .7 / cell));
      for (let a = 0; a < cols; a++) {
        for (let b = 0; b < rw; b++) { const z = (b + .5 - rw / 2) * (q.w * .7 / rw); mounts.push({ x: xs(a), y: q.cy + q.h / 2, z, face: 0 }); mounts.push({ x: xs(a), y: q.cy - q.h / 2, z, face: 2 }) }
        for (let b = 0; b < rh; b++) { const y = q.cy + (b + .5 - rh / 2) * (q.h * .7 / rh); mounts.push({ x: xs(a), y, z: q.w / 2, face: 1 }); mounts.push({ x: xs(a), y, z: -q.w / 2, face: 3 }) }
      }
    }
    const g = mergeGeometries(parts, false)!; (g as any).userData = { mounts: mounts.slice(0, 1200), cell, nozz, W, H, x0, seg: seg.map(q => ({ cx: q.cx, top: q.cy + q.h / 2, w: q.w, len: q.len, h: q.h, cy: q.cy })) }; return g;
  }
  let sid = 1;
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .3, flatShading: true });
  // дальний LOD: один склеенный низкополигональный силуэт на сторону (единичной длины)
  const simpleGeo = PAL.map(P => mergeGeometries([
    piece(unitBox, P.main, -.11, 0, 0, .78, .1, .17), piece(taper(1, 1, 1, .3), P.main, .42, 0, 0, .22, .095, .15), piece(unitBox, P.dark, -.5, 0, 0, .06, .11, .18), piece(unitBox, P.acc2, .1, .08, 0, .07, .09, .09)], false)!);
  const glowMats = PAL.map(P => new THREE.MeshBasicMaterial({ color: P.glow }));
  let builds = 0;
  function build(s: any) {
    const L = s.T.L, g = new THREE.Group(), seed = (sid++ * 2654435761) ^ Math.round(L * 1000);
    const body = new THREE.Mesh(simpleGeo[s.side], hullMat); body.scale.setScalar(L); g.add(body);
    g.userData = { s, L, lod: 0, seed, body, full: null, w: L * .17, h: L * .095, det: false, tur: new THREE.Group() }; g.add(g.userData.tur);
    const eng = new THREE.Group(); eng.name = 'eng'; eng.visible = false; g.add(eng); g.userData.eng = eng;
    scene.add(g); return g;
  }
  function setLod(s: any, g: THREE.Group, lod: number) { // 0 — силуэт, 1 — полный корпус
    const u = g.userData; if (u.lod === lod) return;
    if (lod === 1) {
      if (!u.full) { if (builds >= 3) return; builds++; u.full = hullGeo(s, u.seed); const ud = (u.full as any).userData; u.W = ud.W; u.H = ud.H; u.seg = ud.seg; u.mounts = ud.mounts; u.cell = ud.cell;
        for (const n of ud.nozz) { const f = new THREE.Mesh(geoSph, glowMats[s.side]); f.scale.set(u.L * .018, n.r * 1.5, n.r * 1.5); f.position.set(ud.x0 - u.L * .095, 0, n.z); u.eng.add(f) } }
      u.body.geometry = u.full; u.body.scale.setScalar(1);
    } else { u.body.geometry = simpleGeo[s.side]; u.body.scale.setScalar(u.L) }
    u.lod = lod;
  }
  function detail(s: any, g: THREE.Group, want: boolean) {
    const u = g.userData; if (u.det === want) return; u.det = want;
    const tg: THREE.Group = u.tur; while (tg.children.length) tg.remove(tg.children[0]); u.mods = [];
    if (!want) return;
    const free: any[] = (u.mounts || []).map((q: any) => ({ ...q, used: false })), r = Math.max((u.cell || u.L * .02) * .42, .004);
    const N = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)];
    for (const z of s.zones) for (const m of z.mods) if ((m.k === 'T' || m.k === 'A' || m.k === 'L' || m.k === 'M') && tg.children.length < 200) {
      const f = m.face || 0, px = (m.u || 0) * u.L * .8; let best: any = null, bd = 1e18;
      for (const q of free) if (!q.used && q.face === f) { const d = (q.x - px) ** 2 + (q.z + q.y) ** 2 * .02 + Math.random() * u.L * u.L * 1e-5; if (d < bd) { bd = d; best = q } }
      if (!best) continue; best.used = true;
      const mass = m.k === 'T' ? ((RAIL_CAL as any)[(m.cfg && m.cfg.cal) || 10] || RAIL_CAL[10]).m * (1 + 1.03 * (((m.cfg && m.cfg.bar) || 1) - 1)) * 1.25 : m.k === 'A' ? 110 : m.k === 'M' ? 320 : 9000, r = Math.max(mass / TON_L * .55, u.L * .0025); // диаметр башни = масса / 50 т на метр
      const t = new THREE.Group(), lift = r * .3;
      const base = new THREE.Mesh(geoBox, matDark); base.scale.set(r * 1.8, lift * 1.4, r * 1.8); base.position.y = lift * .2; t.add(base);
      const head = new THREE.Group(); head.name = 'head'; t.add(head); // голова башни: поворачивается по полусфере
      const dome = new THREE.Mesh(geoDome, matTur[s.side]); dome.scale.set(r * .95, r * .8, r * .95); dome.position.y = lift; head.add(dome); // сферическая башня
      const nb = m.k === 'T' ? 2 : 1, tips: THREE.Object3D[] = []; for (let b = 0; b < nb; b++) { const zb = (b - (nb - 1) / 2) * r * .55, len = r * 2.1; const br = new THREE.Mesh(geoCyl, matDark); br.scale.set(len, r * .13, r * .13); br.position.set(r * .5 + len / 2, lift + r * .1, zb); head.add(br);
        const mz = new THREE.Mesh(geoCyl, matDark); mz.scale.set(r * .22, r * .19, r * .19); mz.position.set(r * .5 + len, lift + r * .1, zb); head.add(mz); const tp = new THREE.Object3D(); tp.position.set(r * .5 + len + r * .12, lift + r * .1, zb); head.add(tp); tips.push(tp) }
      const fl = new THREE.Mesh(geoSph, new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false })); fl.scale.setScalar(r * .5); fl.position.copy(tips[0].position); fl.position.z = 0; fl.visible = false; head.add(fl);
      // основание ориентируем по нормали грани
      t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), N[f]); t.position.set(best.x, best.y, best.z);
      (t as any).userData = { m, fl, head, n: N[f], r: r * 1.6, lr: 0, tips }; tg.add(t); u.mods.push(m);
    }
  }
  const dummy = new THREE.Object3D(), v3 = new THREE.Vector3(); const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), vX = new THREE.Vector3(1, 0, 0), vY = new THREE.Vector3(0, 1, 0), vZ = new THREE.Vector3(0, 0, 1);
  function frame() {
    raf = requestAnimationFrame(frame); if (!ren) return;
    const r = wrap!.getBoundingClientRect(); if (ren.domElement.width !== Math.round(r.width * ren.getPixelRatio())) { ren.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix() }
    const selS = Battle.anchorSel && Battle.anchorSel();
    if (!ring) { ring = new THREE.LineLoop(new THREE.RingGeometry(.98, 1, 48).setFromPoints ? new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.cos(i / 48 * 6.2832), 0, Math.sin(i / 48 * 6.2832)))) : undefined, new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(ring) }
    ring.visible = !!(selS && selS.alive && models.get(selS)); if (ring.visible) { const g = models.get(selS)!; ring.position.copy(g.position); ring.scale.setScalar(Math.max(selS.T.L * SC * .75, dist * .02)) }
    const ships: any[] = Battle.ships(); let cx = 0, cy = 0, cz = 0, n = 0, rad = 0; builds = 0; const alive = new Set<any>();
    for (const s of ships) if (s.alive) { cx += s.x; cy += s.y; cz += s.z; n++ }
    if (n) { cx /= n; cy /= n; cz /= n; const ds: number[] = []; for (const s of ships) if (s.alive) ds.push(Math.hypot(s.x - cx, s.y - cy, (s.z - cz) * 2)); ds.sort((a, b) => a - b); rad = ds[Math.floor(ds.length * .9)] || 0 }
    for (const s of ships) {
      if (!s.alive) { const g = models.get(s); if (g) g.visible = false; continue }
      alive.add(s);
      let g = models.get(s); if (!g) { g = build(s); models.set(s, g) } g.visible = true;
      g.position.set(s.x, s.z, s.y); g.rotation.order = 'YZX'; const ud = g.userData; if (ud.hd == null) { ud.hd = s.hd; ud.pt = 0 }
      { let dh = s.hd - ud.hd; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); ud.hd += dh * .2; ud.pt += (Math.max(-.2, Math.min(.2, (s.pz || 0) * 2.5)) - ud.pt) * .015 } // сглаживание курса и тангажа
      if (ud.rl == null) ud.rl = s.roll || 0; ud.rl += ((s.roll || 0) - ud.rl) * .2; g.rotation.y = -ud.hd; g.rotation.z = ud.pt; g.rotation.x = ud.rl;
      const dd = cam.position.distanceTo(g.position), L = g.userData.L, sc = Math.max(SC, dd * .011 / L); g.scale.setScalar(sc);
      const app = L * sc / Math.max(dd, .01); // видимый размер
      setLod(s, g, app > .035 ? 1 : 0);
      detail(s, g, g.userData.lod === 1 && app > .09);
      if (g.userData.det) { const tg: THREE.Group = g.userData.tur, np = performance.now(); g.updateMatrixWorld(true); const inv = new THREE.Quaternion().copy(g.quaternion).invert(), tgt0 = s.tg && s.tg.alive ? s.tg : null;
        tg.children.forEach((t: any) => { const m = t.userData.m; t.visible = m.alive; if (!m.alive) return;
          // направление на цель в системе корабля, зажатое в полусферу вокруг нормали площадки
          let d: THREE.Vector3 | null = null; const fa = (m.fa != null && m.rt && np - m.rt < 1800) ? m.fa : null;
          if (fa != null) { d = new THREE.Vector3(Math.cos(fa), tgt0 ? (tgt0.z - s.z) / 60 : 0, Math.sin(fa)) } else if (tgt0) { d = new THREE.Vector3(tgt0.x - s.x, tgt0.z - s.z, tgt0.y - s.y) }
          if (!d || d.lengthSq() < 1e-9) return; d.normalize().applyQuaternion(inv); const n: THREE.Vector3 = t.userData.n, dn = d.dot(n); if (dn < .02) d.addScaledVector(n, .02 - dn).normalize();
          // базис башни: x — на цель, y — по нормали (в её локальных осях основание уже повёрнуто к нормали)
          const lq = t.quaternion.clone().invert(), dl = d.clone().applyQuaternion(lq); // направление в системе основания, y — вверх
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dl.lengthSq() ? dl.normalize() : new THREE.Vector3(1, 0, 0)); t.userData.head.quaternion.slerp(q, .12);
          const fr = m.rt && np - m.rt < 130; t.userData.fl.visible = !!fr;
          if (fr && t.userData.lr !== m.rt) { t.userData.lr = m.rt; { const tp = t.userData.tips[(Math.random() * t.userData.tips.length) | 0], mp = new THREE.Vector3(); tp.updateWorldMatrix(true, false); tp.getWorldPosition(mp); const ev = (g.userData.muz = g.userData.muz || []); ev.push({ p: mp, t: np }); if (ev.length > 40) ev.shift() } if (cas.length < MAXC) { const wp = new THREE.Vector3(); t.getWorldPosition(wp); const ra = Math.random() * 6.283, sp = .006 + Math.random() * .01; cas.push({ x: wp.x, y: wp.y + t.userData.r, z: wp.z, vx: s.sx + Math.cos(ra) * sp, vy: .012 + Math.random() * .012, vz: s.sy + Math.sin(ra) * sp, t0: np, sz: t.userData.r * .45, rx: Math.random() * 6, rs: (Math.random() - .5) * 14 }) } } }) }
      { const u2 = g.userData; // следы повреждений на корпусе: подпалины и пробоины
        if (u2.lod === 1 && app > .05 && s.vd && s.vd.length && u2.seg) { if (!u2.dmg) { u2.dmg = new THREE.InstancedMesh(decalGeo, decalMat, MAXD); u2.dmg.frustumCulled = false; u2.dmg.setColorAt(0, new THREE.Color(1, 1, 1)); g.add(u2.dmg) }
          const nowT = Battle.time(), q = new THREE.Quaternion(), nrm = new THREE.Vector3(), pos = new THREE.Vector3(), sc3 = new THREE.Vector3(), mt = new THREE.Matrix4(), col3 = new THREE.Color(); let k = 0;
          for (const d of s.vd as any[]) { if (k >= MAXD) break; const x = Math.max(-.5 * u2.L, Math.min(.34 * u2.L, d.u * u2.L)); let sg = u2.seg[0]; for (const e of u2.seg) if (Math.abs(e.cx - x) < Math.abs(sg.cx - x)) sg = e;
            const c = Math.cos(d.ang), sn = Math.sin(d.ang), hw = sg.w / 2, hh = sg.h / 2, f = 1 / Math.max(Math.abs(c) / hw, Math.abs(sn) / hh, 1e-6), zz = c * f, yy = sg.cy + sn * f;
            if (Math.abs(c) / hw > Math.abs(sn) / hh) nrm.set(0, 0, Math.sign(c)); else nrm.set(0, Math.sign(sn) || 1, 0);
            pos.set(x, yy + nrm.y * u2.L * .002, zz + nrm.z * u2.L * .002); q.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nrm); const r = u2.L * .012 * d.sz * (.7 + d.r * .6); sc3.set(r * (1 + d.r * .6), r, r);
            mt.compose(pos, q, sc3); u2.dmg.setMatrixAt(k, mt); const age = nowT - d.t0, h = Math.max(0, 1 - age / 5); col3.setRGB(.05 + .95 * h, .05 + .45 * h * h, .05 + .05 * h * h * h); if (d.k === 1) col3.multiplyScalar(.8); u2.dmg.setColorAt(k, col3); k++ }
          u2.dmg.count = k; u2.dmg.instanceMatrix.needsUpdate = true; if (u2.dmg.instanceColor) u2.dmg.instanceColor.needsUpdate = true; u2.dmg.visible = true } else if (u2.dmg) u2.dmg.visible = false }
      g.userData.eng.visible = g.userData.lod === 1 && Math.hypot(s.vx, s.vy) > .02;
    }
    for (const [s, g] of models) if (!alive.has(s) && !s.alive && !ships.includes(s) && g.parent) { scene.remove(g); models.delete(s) }
    if (n && follow) { const sel = Battle.anchorSel && Battle.anchorSel(); if (fitAll || !(sel && sel.alive)) { v3.set(cx, cz, cy); tgt.lerp(v3, .08); if (fitAll) dist += (Math.min(700, Math.max(40, rad * 2.3 / Math.tan(.43))) - dist) * .04 } else { tgt.lerp(v3.set(sel.x, sel.z, sel.y), .08) } }
    cam.position.set(tgt.x + dist * Math.cos(pitch) * Math.sin(yaw), tgt.y + dist * Math.sin(pitch), tgt.z + dist * Math.cos(pitch) * Math.cos(yaw)); cam.lookAt(tgt);
    // истребители и бомбардировщики
    let fc = 0; const col = new THREE.Color();
    for (const c of Battle.air() as any[]) {
      if (c.state !== 'fly' || fc >= MAXF) continue;
      { // полёт в 3D: вертикальное «плетение», крен по скорости поворота, тангаж по набору/снижению высоты
        const T2 = Battle.time(), id = c.slot || 0, ph = (c.fl ? (c.fl.fid || 0) : 0) * 1.7 + id * 2.3, w = .22 + (id % 5) * .07, A = c.type === 'B' ? 1.2 : 2.6 * Math.max(1, SC * .35);
        const yv = (c.home ? c.home.z : 0) + A * Math.sin(w * T2 + ph) + A * .4 * Math.sin(w * 2.7 * T2 + ph * 1.9), dy = A * w * Math.cos(w * T2 + ph) + A * .4 * w * 2.7 * Math.cos(w * 2.7 * T2 + ph * 1.9);
        const sp = Math.max(.5, Math.hypot(c.vx || 0, c.vy || 0)); let dh = 0; if (c._h0 != null) { dh = c.h - c._h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI }
        c._h0 = c.h; c._r = (c._r || 0) + (Math.max(-1.3, Math.min(1.3, dh * 40)) + .35 * Math.sin(w * 3 * T2 + ph) - (c._r || 0)) * .12;
        dummy.position.set(c.x, yv, c.y); qa.setFromAxisAngle(vY, -c.h); qb.setFromAxisAngle(vZ, Math.atan2(dy, sp)); qa.multiply(qb); qb.setFromAxisAngle(vX, c._r); qa.multiply(qb); qb.setFromAxisAngle(vZ, -Math.PI / 2); qa.multiply(qb);
        dummy.quaternion.copy(qa); c._yv = yv; const mc = (c.P && c.P.mass) || (c.type === 'B' ? 300 : 260), tl = mc / TON_L, dc = cam.position.distanceTo(dummy.position), len = Math.max(tl, dc * .0045), sz = len / 2.2; dummy.scale.set(sz * (c.type === 'B' ? 1.5 : 1), len, sz * (c.type === 'B' ? 1.5 : 1)); dummy.updateMatrix() } // длина = масса / 50 т на метр, но не меньше нескольких пикселей
      fighters.setMatrixAt(fc, dummy.matrix); fighters.setColorAt(fc, col.set(c.side ? 0xffb070 : 0x9fd8ff)); fc++;
    }
    fighters.count = fc; fighters.instanceMatrix.needsUpdate = true; if (fighters.instanceColor) fighters.instanceColor.needsUpdate = true;
    // снаряды: разные оттенки, затухание к концу дальности, тонкие
    const pa = (projLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, pcol = (projLines.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array; let pc = 0;
    const tmp = new THREE.Color();
    for (const p of Battle.proj() as any[]) {
      if (pc >= MAXP) break; const o = pc * 6, l = Math.max(.15, dist * .0007) * 10;
      let ox = 0, oy = 0, oz = 0;
      if (p._m === undefined) { p._m = null; const gs = p.src && models.get(p.src); const ev = gs && gs.userData.muz; if (ev && ev.length) { const nw = performance.now(), fresh = ev.filter((q: any) => nw - q.t < 250); if (fresh.length) { const q = fresh[(Math.random() * fresh.length) | 0]; p._m = { x: q.p.x - p.x, y: q.p.y - p.z, z: q.p.z - p.y, d0: p.dist, F: (gs.userData.L || 1) * .5 + .3 } } } }
      if (p._m) { const w = Math.max(0, 1 - (p.dist - p._m.d0) / p._m.F); ox = p._m.x * w; oy = p._m.y * w; oz = p._m.z * w }
      pa[o] = p.x + ox; pa[o + 1] = p.z + oy; pa[o + 2] = p.y + oz; pa[o + 3] = p.x + ox - p.vx * l * .1; pa[o + 4] = p.z + oy - (p.vz || 0) * l * .1; pa[o + 5] = p.y + oz - p.vy * l * .1;
      const e = p.ev == null ? .5 : p.ev, fade = Math.min(1, Math.max(0, (1 - p.dist / Math.max(1, p.max)) / .4)) * .85; // летит яркой, гаснет лишь в последние 40% дальности
      tmp.setHSL(p.side ? .02 + e * .12 : .5 + e * .2, .9, .6); // красные: красный→жёлтый; синие: бирюзовый→фиолетовый
      pcol[o] = tmp.r * fade; pcol[o + 1] = tmp.g * fade; pcol[o + 2] = tmp.b * fade; pcol[o + 3] = tmp.r * fade * .12; pcol[o + 4] = tmp.g * fade * .12; pcol[o + 5] = tmp.b * fade * .12; pc++;
    }
    projLines.geometry.setDrawRange(0, pc * 2); (projLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (projLines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    // следы истребителей и бомбардировщиков
    {const ta = (trailLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, tc = (trailLines.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array; let k = 0;
      for (const c of Battle.air() as any[]) { if (c.state !== 'fly' || !c.tr || c.tr.length < 4) continue; const y0 = c.home ? c.home.z : 0, y = c._yv != null ? c._yv : y0, n2 = c.tr.length, base = c.side ? [1, .55, .25] : [.45, .8, 1];
        let px = c.x, py = c.y; const cnt = n2 / 2;
        for (let i = n2 - 2, q = 0; i >= 0 && k < MAXT; i -= 2, q++) { const o = k * 6, f = Math.max(0, 1 - q / cnt) * .8, f2 = Math.max(0, 1 - (q + 1) / cnt) * .8;
          ta[o] = px; ta[o + 1] = y0 + (y - y0) * Math.max(0, 1 - q / cnt); ta[o + 2] = py; ta[o + 3] = c.tr[i]; ta[o + 4] = y0 + (y - y0) * Math.max(0, 1 - (q + 1) / cnt); ta[o + 5] = c.tr[i + 1];
          tc[o] = base[0] * f; tc[o + 1] = base[1] * f; tc[o + 2] = base[2] * f; tc[o + 3] = base[0] * f2; tc[o + 4] = base[1] * f2; tc[o + 5] = base[2] * f2; px = c.tr[i]; py = c.tr[i + 1]; k++ } }
      trailLines.geometry.setDrawRange(0, k * 2); (trailLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (trailLines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true}
    // мгновенные выстрелы ПВО/зениток: короткая вспышка линии, гаснет за 340 мс
    {const sa = (shotLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, sc2 = (shotLines.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array; let k = 0; const now2 = performance.now();
      for (const q of Battle.shots() as any[]) { if (k >= 600) break; const f = 1 - (now2 - q.rt) / 340; if (f <= 0) continue; const o = k * 6, z1 = q.a ? q.a.z : 0, z2 = q.b ? (q.b.z != null ? q.b.z : (q.b.home ? q.b.home.z : z1)) : z1;
        sa[o] = q.x1; sa[o + 1] = z1; sa[o + 2] = q.y1; sa[o + 3] = q.x2; sa[o + 4] = z2; sa[o + 5] = q.y2; const c = q.s ? [1, .75, .4] : [.55, .9, 1];
        sc2[o] = c[0] * f * .5; sc2[o + 1] = c[1] * f * .5; sc2[o + 2] = c[2] * f * .5; sc2[o + 3] = c[0] * f * .15; sc2[o + 4] = c[1] * f * .15; sc2[o + 5] = c[2] * f * .15; k++ }
      shotLines.geometry.setDrawRange(0, k * 2); (shotLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (shotLines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true}
    const ma = (misPts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array; let mc = 0;
    for (const p of Battle.mis() as any[]) { if (mc >= 2000) break; ma[mc * 3] = p.x; ma[mc * 3 + 1] = p.z; ma[mc * 3 + 2] = p.y; mc++ }
    misPts.geometry.setDrawRange(0, mc); (misPts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const ba = (beamLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array; let bc = 0; const nowp = performance.now();
    for (const b of Battle.beams() as any[]) { if (bc >= 400 || !b.a) continue; const o = bc * 6; ba[o] = b.a.x; ba[o + 1] = b.a.z; ba[o + 2] = b.a.y; ba[o + 3] = b.tx; ba[o + 4] = (b.tz != null ? b.tz : (b.b && b.b.z) || 0); ba[o + 5] = b.ty; bc++ }
    beamLines.geometry.setDrawRange(0, bc * 2); (beamLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    {const tb2 = Battle.time(); let k = 0; const cc = new THREE.Color();
      for (const f of Battle.frags() as any[]) { if (f.ln || k >= MAXPL) continue; const life = (tb2 - f.t0) / f.d; if (life > 1) continue;
        dummy.position.set(f.x, f.z || 0, f.y); const fade = Math.min(1, (1 - life) / .35), sz = Math.max(f.sz, cam.position.distanceTo(dummy.position) * .0009) * (.35 + .65 * fade);
        dummy.rotation.set(f.rx || 0, -f.rot, f.ry || 0); dummy.scale.set(sz * 1.5, sz * .25, sz); dummy.updateMatrix(); plateMesh.setMatrixAt(k, dummy.matrix);
        const hot = Math.max(0, 1 - (tb2 - f.t0) / 4), base = f.side ? [.55, .32, .2] : [.28, .4, .5]; cc.setRGB(base[0] * fade + hot * .9, base[1] * fade + hot * .35, base[2] * fade); plateMesh.setColorAt(k, cc); k++ }
      plateMesh.count = k; plateMesh.instanceMatrix.needsUpdate = true; if (plateMesh.instanceColor) plateMesh.instanceColor.needsUpdate = true}
    {const np2 = performance.now(), dts = 1 / 60; let k = 0; for (let i = cas.length - 1; i >= 0; i--) { const c = cas[i], age = (np2 - c.t0) / 1000; if (age > 3) { cas.splice(i, 1); continue }
        c.x += c.vx * Battle.getSpeed() * .016; c.y += c.vy * Battle.getSpeed() * .016; c.z += c.vz * Battle.getSpeed() * .016; // медленно улетают и вращаются
        dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(c.rx + age * c.rs, age * c.rs * .6, 0); const cz = Math.max(c.sz, cam.position.distanceTo(dummy.position) * .0012); dummy.scale.set(cz * 1.6, cz * .7, cz * .7); dummy.updateMatrix(); casings.setMatrixAt(k++, dummy.matrix) }
      casings.count = k; casings.instanceMatrix.needsUpdate = true}
    {const tb = Battle.time(); let k = 0; const col2 = new THREE.Color();
      for (const f of Battle.fx() as any[]) { if (k >= MAXFX) break; const life = (tb - f.t0) / (f.d || 3); if (life < 0 || life > 1) continue;
        dummy.position.set(f.x, f.z || 0, f.y); const rr = Math.max((f.r || .6) * (.5 + life) * .12, cam.position.distanceTo(dummy.position) * .003); dummy.scale.setScalar(rr); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        fxMesh.setMatrixAt(k, dummy.matrix); fxMesh.setColorAt(k, col2.setRGB(1 - life * .3, .75 - life * .55, .35 - life * .3).multiplyScalar(1 - life)); k++ }
      fxMesh.count = k; fxMesh.instanceMatrix.needsUpdate = true; if (fxMesh.instanceColor) fxMesh.instanceColor.needsUpdate = true}
    ren.render(scene, cam);
  }
  btn.onclick = () => {
    on = !on; btn.classList.toggle('on', on);
    if (on) { if (!ren) init(); (ren!.domElement as HTMLElement).style.display = 'block'; hud.style.display = 'block'; follow = true; const s = Battle.ships().find((q: any) => q.alive); if (s) { tgt.set(s.x, s.z, s.y); fitAll = true; dist = 120 } cancelAnimationFrame(raf); frame() }
    else { cancelAnimationFrame(raf); if (ren) (ren.domElement as HTMLElement).style.display = 'none'; hud.style.display = 'none' }
  };
  (window as any).__b3d = { screenOf: (sh: any) => { const g = models.get(sh); if (!g || !ren) return null; const v = g.position.clone().project(cam), r = ren.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height] }, toggle: () => btn.click(), set: (o: any) => { if (o.yaw != null) yaw = o.yaw; if (o.pitch != null) pitch = o.pitch; if (o.dist != null) dist = o.dist; if (o.sc != null) SC = o.sc; if (o.follow != null) follow = o.follow; if (o.fit != null) fitAll = o.fit } };
}
