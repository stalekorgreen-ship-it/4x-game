// Тестовый настоящий 3D-вид боя (three.js): поверх карты, корабли — объёмные модели, свободная орбитальная камера.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Battle } from './05-battle.ts';

const wrap = document.getElementById('mapwrap');
const bgo = document.getElementById('bgo');
if (wrap && bgo) {
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'b3d'; btn.textContent = '3D'; btn.title = 'Объёмный вид боя (тест)';
  bgo.after(btn);

  let on = false, ren: THREE.WebGLRenderer | null = null, scene: THREE.Scene, cam: THREE.PerspectiveCamera, raf = 0;
  let yaw = .6, pitch = .45, dist = 40, SC = 4, follow = true;
  const tgt = new THREE.Vector3();
  const models = new Map<any, THREE.Group>();
  const geoBox = new THREE.BoxGeometry(1, 1, 1), geoCone = new THREE.ConeGeometry(.5, 1, 8), geoSph = new THREE.SphereGeometry(1, 8, 6);
  const mats = [0x4aa8e8, 0xe8803a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .35 }));
  const matDark = new THREE.MeshStandardMaterial({ color: 0x1a1d23, roughness: .8 });
  const matTur = [0xe8f3ff, 0xffd9b0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .4, metalness: .5 }));
  const matGlow = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const matDead = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 1 });
  let fighters: THREE.InstancedMesh, projLines: THREE.LineSegments, misPts: THREE.Points, beamLines: THREE.LineSegments;
  const MAXF = 4000, MAXP = 4000;

  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:10px;top:44px;z-index:5;color:#cfe;font:12px monospace;background:rgba(10,14,22,.7);padding:6px 8px;border-radius:6px;display:none;pointer-events:none';
  hud.innerHTML = 'ЛКМ: вращать · колесо: зум · ПКМ: сдвиг · [ ] размер моделей · F: следить';
  wrap.appendChild(hud);

  function init() {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;display:block';
    wrap!.appendChild(cv);
    ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true });
    ren.setPixelRatio(Math.min(2, devicePixelRatio));
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a12); scene.fog = new THREE.FogExp2(0x070a12, .0012);
    cam = new THREE.PerspectiveCamera(50, 1, .05, 6000);
    scene.add(new THREE.HemisphereLight(0x8aa4d8, 0x20161c, 1.1));
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.2); sun.position.set(300, 400, 200); scene.add(sun);
    const st = new Float32Array(1500 * 3); for (let i = 0; i < st.length; i += 3) { const v = new THREE.Vector3().randomDirection().multiplyScalar(2500); st[i] = v.x; st[i + 1] = v.y; st[i + 2] = v.z }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(st, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaabbdd, size: 2, sizeAttenuation: false, fog: false })));
    const gh = new THREE.GridHelper(600, 60, 0x1c2a44, 0x121a2c); gh.position.y = -45; scene.add(gh);
    fighters = new THREE.InstancedMesh(geoCone, new THREE.MeshBasicMaterial({ color: 0xffffff }), MAXF); fighters.frustumCulled = false; fighters.count = 0;
    fighters.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(fighters);
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 6), 3));
    projLines = new THREE.LineSegments(pg, new THREE.LineBasicMaterial({ color: 0xffe9a0 })); projLines.frustumCulled = false; scene.add(projLines);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2000 * 3), 3));
    misPts = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xff8a50, size: 5, sizeAttenuation: false })); misPts.frustumCulled = false; scene.add(misPts);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 6), 3));
    beamLines = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0x7af4ff })); beamLines.frustumCulled = false; scene.add(beamLines);

    let drag = 0, lx = 0, ly = 0;
    cv.addEventListener('contextmenu', e => e.preventDefault());
    cv.addEventListener('mousedown', e => { drag = e.button === 2 ? 2 : 1; lx = e.clientX; ly = e.clientY });
    addEventListener('mouseup', () => { drag = 0 });
    addEventListener('mousemove', e => {
      if (!on || !drag) return; const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      if (drag === 1) { yaw -= dx * .006; pitch = Math.max(-1.45, Math.min(1.45, pitch + dy * .006)) }
      else { follow = false; const r = new THREE.Vector3(Math.cos(yaw), 0, -Math.sin(yaw)); tgt.addScaledVector(r, -dx * dist * .0016); tgt.y += dy * dist * .0016 }
    });
    cv.addEventListener('wheel', e => { e.preventDefault(); dist = Math.max(.3, Math.min(900, dist * Math.exp(e.deltaY * .0012))) }, { passive: false });
    addEventListener('keydown', e => { if (!on) return; if (e.key === '[') SC = Math.max(1, SC / 1.4); else if (e.key === ']') SC = Math.min(40, SC * 1.4); else if (e.key === 'f' || e.key === 'F') follow = true });
  }

  // ---- процедурный «сборный» корпус: ступенчатые блоки, камуфляжные плиты, рубка, антенны, сопла ----
  const PAL = [
    { main: 0x5b86a8, dark: 0x25384d, acc: 0xd8e6f2, acc2: 0x2f9fbf, glow: 0x7af4ff },
    { main: 0xe0743a, dark: 0x2c3a58, acc: 0xb8325f, acc2: 0xf2a65a, glow: 0xffd27a },
  ];
  function rng(seed: number) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296 } }
  function piece(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1, rz = 0) {
    const g = geo.clone(); g.scale(sx, sy, sz); if (rz) g.rotateZ(rz); g.translate(x, y, z);
    const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return g;
  }
  const unitBox = new THREE.BoxGeometry(1, 1, 1), unitCyl = new THREE.CylinderGeometry(.5, .5, 1, 10).rotateZ(Math.PI / 2);
  function taper(len: number, h: number, w: number, k: number) { // клиновидный блок: сужается к носу (+x)
    const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) { p.setY(i, p.getY(i) * k); p.setZ(i, p.getZ(i) * k) }
    g.scale(len, h, w); return g;
  }
  function hullGeo(s: any, seed: number) {
    const R = rng(seed), P = PAL[s.side], L = s.T.L, W = L * .17, H = L * .095, parts: THREE.BufferGeometry[] = [];
    const shade = (c: number, f: number) => new THREE.Color(c).multiplyScalar(f).getHex();
    // хребет из блоков
    const n = 7 + Math.floor(R() * 4), x0 = -L * .5, x1 = L * .34; let x = x0; const seg: any[] = [];
    for (let i = 0; i < n; i++) {
      const len = (x1 - x0) / n * (.8 + R() * .5), w = W * (.62 + R() * .38), h = H * (.65 + R() * .45), cx = x + len / 2, cy = (R() - .5) * H * .25;
      const col = R() < .55 ? P.main : R() < .6 ? P.dark : P.acc2; seg.push({ cx, w, h, len, cy });
      parts.push(piece(unitBox, shade(col, .85 + R() * .3), cx, cy, 0, len * 1.02, h, w)); x += len;
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
      parts.push(piece(unitBox, shade(R() < .5 ? P.dark : P.main, .8 + R() * .4), sg.cx + (R() - .5) * sg.len * .5, sg.cy + sg.h / 2 + h / 2, (R() - .5) * sg.w * .3, len, h, w)) }
    const bs = seg[Math.floor(seg.length * .66)], bh = H * 1.4, bx = bs.cx;
    parts.push(piece(unitBox, P.dark, bx, bs.cy + bs.h / 2 + bh * .25, 0, L * .07, bh * .5, W * .55));
    parts.push(piece(unitBox, P.acc2, bx + L * .005, bs.cy + bs.h / 2 + bh * .6, 0, L * .055, bh * .22, W * .5));
    parts.push(piece(unitBox, P.glow, bx + L * .006, bs.cy + bs.h / 2 + bh * .6, 0, L * .057, bh * .06, W * .52));
    parts.push(piece(unitBox, P.main, bx, bs.cy + bs.h / 2 + bh * .86, 0, L * .04, bh * .2, W * .36));
    for (const z of [-1, 1]) parts.push(piece(unitBox, 0x8a8f99, bx - L * .01, bs.cy + bs.h / 2 + bh * 1.35, z * W * .12, L * .004, bh * .75, L * .004));
    parts.push(piece(unitBox, 0x8a8f99, bx - L * .01, bs.cy + bs.h / 2 + bh * 1.6, 0, L * .004, L * .004, W * .3));
    // грибы мелкой фурнитуры
    for (let i = 0; i < 50; i++) { const sg = seg[Math.floor(R() * seg.length)], a = R() < .6, r = L * (.003 + R() * .006);
      parts.push(piece(unitBox, shade(R() < .5 ? P.acc : 0x6a707c, .8 + R() * .4), sg.cx + (R() - .5) * sg.len, a ? sg.cy + sg.h / 2 + r / 2 : sg.cy + (R() - .5) * sg.h, a ? (R() - .5) * sg.w : (R() < .5 ? -1 : 1) * (sg.w / 2 + r / 2), r * (1 + R() * 2), r, r * (1 + R() * 1.5))) }
    // кормовой блок и сопла
    const ne = Math.max(2, Math.min(5, s.engN || 3));
    parts.push(piece(unitBox, P.dark, x0 - L * .02, 0, 0, L * .06, H * 1.15, W * 1.05));
    const nozz: any[] = [];
    for (let i = 0; i < ne; i++) { const zz = (i - (ne - 1) / 2) * (W * .8 / Math.max(1, ne - 1)) * (ne > 1 ? 1 : 0), r = Math.min(H * .38, W * .5 / ne * 1.5);
      parts.push(piece(unitCyl, 0x16181d, x0 - L * .075, 0, zz, L * .05, r * 2, r * 2)); nozz.push({ z: zz, r }) }
    const g = mergeGeometries(parts, false)!; (g as any).userData = { nozz, W, H, x0 }; return g;
  }
  let sid = 1;
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .62, metalness: .3, flatShading: true });
  function build(s: any) {
    const L = s.T.L, g = new THREE.Group();
    const geo = hullGeo(s, (sid++ * 2654435761) ^ Math.round(L * 1000)); const u = (geo as any).userData;
    const body = new THREE.Mesh(geo, hullMat); g.add(body);
    const eng = new THREE.Group(); eng.name = 'eng'; g.add(eng);
    for (const n of u.nozz) { const f = new THREE.Mesh(geoSph, new THREE.MeshBasicMaterial({ color: PAL[s.side].glow })); f.scale.set(L * .018, n.r * 1.5, n.r * 1.5); f.position.set(u.x0 - L * .095, 0, n.z); eng.add(f) }
    g.userData = { L, w: u.W, h: u.H, det: false, tur: new THREE.Group() }; g.add(g.userData.tur);
    scene.add(g); return g;
  }
  function detail(s: any, g: THREE.Group, want: boolean) {
    const u = g.userData; if (u.det === want) return; u.det = want;
    const tg: THREE.Group = u.tur; while (tg.children.length) tg.remove(tg.children[0]); u.mods = [];
    if (!want) return;
    const R = rng(Math.round(u.L * 7919));
    for (const z of s.zones) for (const m of z.mods) if ((m.k === 'T' || m.k === 'A' || m.k === 'L' || m.k === 'M') && tg.children.length < 70) {
      const r = Math.max(u.L * .016, .012), t = new THREE.Group();
      const base = new THREE.Mesh(geoBox, matDark); base.scale.set(r * 2, r * .7, r * 2); t.add(base);
      const dome = new THREE.Mesh(geoBox, matTur[s.side]); dome.scale.set(r * 1.5, r * .6, r * 1.5); dome.position.y = r * .55; t.add(dome);
      const nb = m.k === 'T' ? 2 : 1; for (let b = 0; b < nb; b++) { const br = new THREE.Mesh(geoBox, matDark); br.scale.set(r * 3.2, r * .28, r * .28); br.position.set(r * 1.9, r * .6, (b - (nb - 1) / 2) * r * .6); t.add(br) }
      t.position.set((m.u || 0) * u.L * .8, u.h * .62 + r * .5 + R() * u.h * .15, (m.v || 0) * u.w * 1.3);
      (t as any).userData = { m }; tg.add(t); u.mods.push(m);
    }
  }
  const dummy = new THREE.Object3D(), v3 = new THREE.Vector3();
  function frame() {
    raf = requestAnimationFrame(frame); if (!ren) return;
    const r = wrap!.getBoundingClientRect(); if (ren.domElement.width !== Math.round(r.width * ren.getPixelRatio())) { ren.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix() }
    const ships: any[] = Battle.ships(); let cx = 0, cy = 0, cz = 0, n = 0;
    for (const s of ships) {
      if (!s.alive) { const g = models.get(s); if (g) g.visible = false; continue }
      let g = models.get(s); if (!g) { g = build(s); models.set(s, g) } g.visible = true;
      g.position.set(s.x, s.z, s.y); g.rotation.y = -s.hd; g.scale.setScalar(SC);
      const dd = cam.position.distanceTo(g.position); detail(s, g, dd < 28 * g.userData.L * SC + 6);
      if (g.userData.det) { const tg: THREE.Group = g.userData.tur; tg.children.forEach((t: any, i) => { const m = t.userData.m; t.visible = m.alive; const a = (m.da != null ? m.da : 0); t.rotation.y = -a }) }
      const eg = g.getObjectByName('eng'); if (eg) eg.visible = Math.hypot(s.vx, s.vy) > .02;
      cx += s.x; cy += s.y; cz += s.z; n++;
    }
    for (const [s, g] of models) if (!ships.includes(s) && g.parent) { scene.remove(g); models.delete(s) }
    if (n && follow) { const sel = Battle.anchorSel && Battle.anchorSel(); const a = sel && sel.alive ? v3.set(sel.x, sel.z, sel.y) : v3.set(cx / n, cz / n, cy / n); tgt.lerp(a, .08) }
    cam.position.set(tgt.x + dist * Math.cos(pitch) * Math.sin(yaw), tgt.y + dist * Math.sin(pitch), tgt.z + dist * Math.cos(pitch) * Math.cos(yaw)); cam.lookAt(tgt);
    // истребители и бомбардировщики
    let fc = 0; const col = new THREE.Color();
    for (const c of Battle.air() as any[]) {
      if (c.state !== 'fly' || fc >= MAXF) continue;
      dummy.position.set(c.x, (c.home ? c.home.z : 0), c.y); dummy.rotation.set(0, -c.h, -Math.PI / 2); const sz = (c.type === 'B' ? .06 : .04) * Math.max(1, SC * .7); dummy.scale.set(sz, sz * 2.2, sz); dummy.updateMatrix();
      fighters.setMatrixAt(fc, dummy.matrix); fighters.setColorAt(fc, col.set(c.side ? 0xffb070 : 0x9fd8ff)); fc++;
    }
    fighters.count = fc; fighters.instanceMatrix.needsUpdate = true; if (fighters.instanceColor) fighters.instanceColor.needsUpdate = true;
    // снаряды
    const pa = (projLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array; let pc = 0;
    for (const p of Battle.proj() as any[]) { if (pc >= MAXP) break; const o = pc * 6, l = .9; pa[o] = p.x; pa[o + 1] = p.z; pa[o + 2] = p.y; pa[o + 3] = p.x - p.vx * l * .12; pa[o + 4] = p.z - (p.vz || 0) * l * .12; pa[o + 5] = p.y - p.vy * l * .12; pc++ }
    projLines.geometry.setDrawRange(0, pc * 2); (projLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const ma = (misPts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array; let mc = 0;
    for (const p of Battle.mis() as any[]) { if (mc >= 2000) break; ma[mc * 3] = p.x; ma[mc * 3 + 1] = p.z; ma[mc * 3 + 2] = p.y; mc++ }
    misPts.geometry.setDrawRange(0, mc); (misPts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const ba = (beamLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array; let bc = 0; const nowp = performance.now();
    for (const b of Battle.beams() as any[]) { if (bc >= 400 || !b.a) continue; const o = bc * 6; ba[o] = b.a.x; ba[o + 1] = b.a.z; ba[o + 2] = b.a.y; ba[o + 3] = b.tx; ba[o + 4] = (b.tz != null ? b.tz : (b.b && b.b.z) || 0); ba[o + 5] = b.ty; bc++ }
    beamLines.geometry.setDrawRange(0, bc * 2); (beamLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    ren.render(scene, cam);
  }
  btn.onclick = () => {
    on = !on; btn.classList.toggle('on', on);
    if (on) { if (!ren) init(); (ren!.domElement as HTMLElement).style.display = 'block'; hud.style.display = 'block'; follow = true; const s = Battle.ships().find((q: any) => q.alive); if (s) { tgt.set(s.x, s.z, s.y); dist = Math.max(20, 12 * s.T.L * SC) } cancelAnimationFrame(raf); frame() }
    else { cancelAnimationFrame(raf); if (ren) (ren.domElement as HTMLElement).style.display = 'none'; hud.style.display = 'none' }
  };
  (window as any).__b3d = { toggle: () => btn.click(), set: (o: any) => { if (o.yaw != null) yaw = o.yaw; if (o.pitch != null) pitch = o.pitch; if (o.dist != null) dist = o.dist; if (o.sc != null) SC = o.sc } };
}
