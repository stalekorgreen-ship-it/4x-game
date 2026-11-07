// Тестовый настоящий 3D-вид боя (three.js): поверх карты, корабли — объёмные модели, свободная орбитальная камера.
import * as THREE from 'three';
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
    scene.add(new THREE.AmbientLight(0x6070a0, .8));
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

  function build(s: any) {
    const L = s.T.L, g = new THREE.Group();
    const w = L * .17, h = L * .1;
    const body = new THREE.Mesh(geoBox, mats[s.side]); body.scale.set(L * .78, h, w); body.position.x = -L * .11; g.add(body);
    const nose = new THREE.Mesh(geoCone, mats[s.side]); nose.rotation.z = -Math.PI / 2; nose.rotation.x = Math.PI / 4; nose.scale.set(w * 1.0, L * .22, h * 1.0); nose.position.x = L * .39; g.add(nose);
    const keel = new THREE.Mesh(geoBox, matDark); keel.scale.set(L * .5, h * .5, w * .55); keel.position.set(-L * .15, -h * .55, 0); g.add(keel);
    const eng = new THREE.Group(); eng.name = 'eng'; g.add(eng);
    for (const z of s.zones) for (const m of z.mods) if (m.k === 'E') { const e = new THREE.Mesh(geoBox, matGlow); e.scale.set(L * .05, h * .45, w * .18); e.position.set(-L * .5, 0, (m.v || 0) * w * 1.6); eng.add(e) }
    g.userData = { L, w, h, det: false, tur: new THREE.Group() }; g.add(g.userData.tur);
    scene.add(g); return g;
  }
  function detail(s: any, g: THREE.Group, want: boolean) {
    const u = g.userData; if (u.det === want) return; u.det = want;
    const tg: THREE.Group = u.tur; while (tg.children.length) tg.remove(tg.children[0]); u.mods = [];
    if (!want) return;
    for (const z of s.zones) for (const m of z.mods) if ((m.k === 'T' || m.k === 'A' || m.k === 'L' || m.k === 'M') && tg.children.length < 60) {
      const r = Math.max(u.L * .018, .01), t = new THREE.Mesh(geoSph, matTur[s.side]); t.scale.set(r * 1.4, r * .8, r * 1.4);
      t.position.set((m.u || 0) * u.L * .8, u.h * .5 + r * .5, (m.v || 0) * u.w * 1.6); const b = new THREE.Mesh(geoBox, matDark); b.scale.set(r * 2.6, r * .3, r * .3); b.position.set(r * 1.3, r * .4, 0); t.add(b); b.scale.set(1.8, .18, .18); b.position.set(1.1, .6, 0);
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
