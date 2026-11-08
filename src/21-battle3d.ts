// Тестовый настоящий 3D-вид боя (three.js): поверх карты, корабли — объёмные модели, свободная орбитальная камера.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Battle, Battles, makeBattle } from './05-battle.ts';
import { previewSpec } from './16b-botdesign.ts';
import { massParts, TON_L, RAIL_CAL, TRAIL_COL } from './01-data.ts';
import { hooks } from './00-hooks.ts';
import { buildLoft, invFromSpec, buildWoundFx, makeWoundTex, faceV, loftMats, turretGeo } from './21c-loft.ts';
import type { LoftPack } from './21c-loft.ts';

const wrap = document.getElementById('mapwrap');
const bgo = document.getElementById('bgo');
if (wrap && bgo) {
  const btn = document.createElement('button');
  btn.className = 'btn'; btn.id = 'b3d'; btn.textContent = '3D'; btn.title = 'Объёмный вид боя (тест)';
  bgo.after(btn);

  let on = false, ren: THREE.WebGLRenderer | null = null, scene: THREE.Scene, cam: THREE.PerspectiveCamera, raf = 0;
  const _fr = new THREE.Frustum(), _pm = new THREE.Matrix4(), _sph = new THREE.Sphere(); const MAXEX = 3500; let exMesh: THREE.InstancedMesh; const _ep = new THREE.Vector3(); let fGeoHi: THREE.BufferGeometry, fightersHi: THREE.InstancedMesh; let fGeo: THREE.BufferGeometry, fcam: any = null, tcam: any = null, tcamN = 0, pendT = 0; // камера на башне (клавиша T): видно, как вылетает трассер и отлетают плиты
  function camFighter() { const l = (Battle.air() as any[]).filter(c => c.state === 'fly' && c._len).sort((a, b) => cam.position.distanceToSquared(_p.set(a.x, a._yv || 0, a.y)) - cam.position.distanceToSquared(_p.set(b.x, b._yv || 0, b.y))); if (!l.length) return; fcam = l[(fcamN++) % Math.min(l.length, 8)]; tcam = null; follow = false; fitAll = false; dist = Math.max(.004, fcam._len * 7) }
  let fcamN = 0; const _qz = new THREE.Quaternion(), _zv = new THREE.Vector3(0, 0, 1);
  function camTurret() { let g: any = null, bd = 1e18; for (const [, m] of models) if (m.userData.det && m.userData.tur.children.length) { const d = m.position.distanceToSquared(cam.position); if (d < bd) { bd = d; g = m } } if (!g) { // нет детальных кораблей: подлетаем к ближайшему, башню выберем, когда он прорисуется
      let b2: any = null, bd2 = 1e18; for (const [sh, m] of models) if (sh.alive) { const d = m.position.distanceToSquared(cam.position); if (d < bd2) { bd2 = d; b2 = sh } } if (b2) { Battle.select(b2); follow = true; fitAll = false; dist = Math.max(.05, b2.T.L * .35); pendT = 90 } return }
    const c = (g.userData.tur.children as any[]).filter(t => t.visible && t.userData.m && t.userData.m.alive).sort((a, b) => (b.userData.m.rt || 0) - (a.userData.m.rt || 0)).slice(0, 6); if (!c.length) return; tcam = c[tcamN++ % c.length]; fcam = null; follow = false; fitAll = false; dist = Math.max(.002, tcam.userData.r * 70 * (g.scale.x || 1)) }
  // камера не ближе 10 м (0.01 мировой ед.) к корпусу любого корабля: так не видны огрехи модели
  const KEEP_OFF = .01, _kb = new THREE.Box3(), _kc = new THREE.Vector3(), _ks = new THREE.Vector3(), _kp = new THREE.Vector3(), _kd = new THREE.Vector3();
  function keepOff() {
    for (const [, g] of models) {
      if (!g.visible) continue; const Lw = (g.userData.L || 0) * g.scale.x; if (!(Lw > 0) || cam.position.distanceTo(g.position) > Lw * 3 + 1) continue;
      _kb.setFromObject(g); _kb.expandByScalar(KEEP_OFF); if (!_kb.containsPoint(cam.position)) continue;
      _kb.getCenter(_kc); _kd.copy(cam.position).sub(_kc); if (_kd.lengthSq() < 1e-14) _kd.set(0, 1, 0); _kd.normalize();
      const stp = _kb.getSize(_ks).length() / 160; let t = 0; _kp.copy(_kc);
      while (_kb.containsPoint(_kp) && t < 1e4) { t += stp; _kp.copy(_kc).addScaledVector(_kd, t) }
      cam.position.copy(_kp)
    }
  }
  let lastTr = 0; let qual = 1, lastFT = 0, dtEma = 16, qT = 0; let lastSel: any = null, deadAt = 0; let fitAll = true; let yaw = .6, pitch = .45, dist = 40, SC = 1.5, follow = true;
  const tgt = new THREE.Vector3();
  const models = new Map<any, THREE.Group>();
  const geoBox = new RoundedBoxGeometry(1, 1, 1, 1, .12), geoCone = new THREE.ConeGeometry(.5, 1, 8), geoSph = new THREE.SphereGeometry(1, 8, 6), geoDome = new THREE.SphereGeometry(1, 16, 10), geoCyl = new THREE.CylinderGeometry(1, 1, 1, 8).rotateZ(Math.PI / 2);
  const mats = [0x4aa8e8, 0xe8803a].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .55, metalness: .35 }));
  const matDark = new THREE.MeshStandardMaterial({ color: 0x1a1d23, roughness: .8 });
  const matTur = [0xe8f3ff, 0xffd9b0].map(c => new THREE.MeshStandardMaterial({ color: c, roughness: .4, metalness: .5 }));
  const matGlow = new THREE.MeshBasicMaterial({ color: 0xffd27a });
  const matDead = new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 1 });
  const MAXPL = 900, MAXD = 240; let plateMesh: THREE.InstancedMesh; const decalGeo = (() => { const n = 7, rr = [1, .62, .95, .7, 1.05, .6, .85], pos: number[] = []; for (let i = 0; i < n; i++) { const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, r0 = rr[i], r1 = rr[(i + 1) % n]; pos.push(0, 0, 0, Math.cos(a0) * r0, Math.sin(a0) * r0, 0, Math.cos(a1) * r1, Math.sin(a1) * r1, 0) } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(pos.map((_, i) => i % 3 === 2 ? 1 : 0), 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(new Array(n * 6).fill(0), 2)); return g })(), decalMat = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, transparent: true, opacity: .92, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2 });
  const MAXC = 300; let casings: THREE.InstancedMesh; const cas: any[] = []; let trailLines: THREE.LineSegments, shotLines: THREE.LineSegments; let ring: THREE.LineLoop | null = null; let fxMesh: THREE.InstancedMesh; const MAXFX = 400;
   const dbg: any = { n: 0, m: 0, off: 0 }; const MAXTD = 1500; let tdMesh: THREE.InstancedMesh; const tdeb: any[] = []; const MAXSP = 3000, MAXFL = 200; let sparkLines: THREE.LineSegments, flashPts: THREE.Points, lastImp = 0; const sparks: any[] = [], flashes: any[] = [];
   function glowTex() { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d')!, g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(.25, 'rgba(255,230,170,.8)'); g.addColorStop(1, 'rgba(255,160,60,0)'); x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c) }
   let shutMesh: THREE.InstancedMesh, shutGl: THREE.InstancedMesh, misMesh: THREE.InstancedMesh, misFl: THREE.InstancedMesh, misTr: THREE.LineSegments; const MAXMIS = 1500;
  let bolts: THREE.InstancedMesh, fighters: THREE.InstancedMesh, projLines: THREE.LineSegments, misPts: THREE.Points, beamLines: THREE.LineSegments;
  const MAXT = 14000, MAXF = 4000, MAXP = 4000;

  const hud = document.createElement('div');
  hud.style.cssText = 'position:absolute;left:10px;top:44px;z-index:5;color:#cfe;font:12px monospace;background:rgba(10,14,22,.7);padding:6px 8px;border-radius:6px;display:none;pointer-events:none';
  hud.innerHTML = 'ЛКМ: вращать · колесо: зум · ПКМ: сдвиг · [ ] размер · F: следить за выбранным · A: вписать всё поле · T: камера на башню · V: камера на истребитель';
  wrap.appendChild(hud);
  // F3 — оверлей производительности: FPS, время кадра (JS / отправка отрисовки), вызовы, треугольники, число объектов, качество
  const perf = document.createElement('div'); perf.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:2147483000;color:#9f9;font:12px monospace;background:rgba(0,0,0,.75);padding:6px 8px;border-radius:6px;display:none;pointer-events:none;white-space:pre'; document.body.appendChild(perf);
  let perfOn = false, pfT = 0, pfFrames = 0, pfJs = 0, pfRen = 0, pfExtra = '', pfX = 0, pfN = 0, pfX0 = 0;
  const pfLoop = () => { if (!perfOn) return; requestAnimationFrame(pfLoop); const nn = performance.now(); pfN++; if (nn - pfX0 > 500) { perf.textContent = 'FPS ' + (pfN * 1000 / (nn - pfX0)).toFixed(0) + (pfExtra && nn - pfX < 1500 ? '\n' + pfExtra : '\n(3D-бой не открыт)') + '\nF3 — скрыть'; pfX0 = nn; pfN = 0 } };
  addEventListener('keydown', e => { if (e.key === 'F3' || e.code === 'F3') { e.preventDefault(); perfOn = !perfOn; perf.style.display = perfOn ? 'block' : 'none'; if (perfOn) { pfX0 = performance.now(); pfN = 0; requestAnimationFrame(pfLoop) } } }, true);

  function init() {
    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;display:block';
    wrap!.appendChild(cv);
    ren = new THREE.WebGLRenderer({ canvas: cv, antialias: true }); ren.localClippingEnabled = true;
    ren.setPixelRatio(Math.min(1.5, devicePixelRatio));
    scene = new THREE.Scene(); scene.background = new THREE.Color(0x070a12); scene.fog = new THREE.FogExp2(0x070a12, .00008);
    cam = new THREE.PerspectiveCamera(50, 1, .05, 6000);
    scene.add(new THREE.HemisphereLight(0x8aa4d8, 0x20161c, .85));
    { const rim = new THREE.DirectionalLight(0x6aa8ff, .9); rim.position.set(-300, 120, -250); scene.add(rim); } // холодная контровая подсветка
    { const pm = new THREE.PMREMGenerator(ren), es = new THREE.Scene(), sg0 = new THREE.SphereGeometry(50, 24, 16), cl = new Float32Array(sg0.attributes.position.count * 3), pp = sg0.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pp.count; i++) { const dx = pp.getX(i) / 50, dy = pp.getY(i) / 50, dz = pp.getZ(i) / 50, sun0 = Math.pow(Math.max(0, dx * .55 + dy * .7 + dz * .35), 24), rim0 = Math.pow(Math.max(0, -dx * .7 + dy * .2 - dz * .6), 6), b = .04 + .1 * (dy * .5 + .5);
        cl[i * 3] = b * .6 + sun0 * 9 + rim0 * .5; cl[i * 3 + 1] = b * .8 + sun0 * 8 + rim0 * 1; cl[i * 3 + 2] = b * 1.4 + sun0 * 6 + rim0 * 2.5 }
      sg0.setAttribute('color', new THREE.BufferAttribute(cl, 3)); es.add(new THREE.Mesh(sg0, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));
      hullMat.envMap = pm.fromScene(es, 0.04).texture; hullMat.needsUpdate = true; } // окружение даёт блики только корпусам
    const sun = new THREE.DirectionalLight(0xfff0dd, 2.6); sun.position.set(300, 400, 200); scene.add(sun); sunL = sun;
    const st = new Float32Array(1500 * 3); for (let i = 0; i < st.length; i += 3) { const v = new THREE.Vector3().randomDirection().multiplyScalar(2500); st[i] = v.x; st[i + 1] = v.y; st[i + 2] = v.z }
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(st, 3));
    scene.add(new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xaabbdd, size: 2, sizeAttenuation: false, fog: false })));
    { const cyl = new THREE.CylinderGeometry(.5, .5, 1, 8), cone = new THREE.ConeGeometry(.5, 1, 8), box = new THREE.BoxGeometry(1, 1, 1); fGeo = mergeGeometries([
        piece(cyl, 0xe8ecf2, 0, -.02, 0, .3, .62, .3), piece(cone, 0xf6f8fb, 0, .46, 0, .3, .32, .3), piece(box, 0x8a93a3, 0, -.1, 0, .05, .34, 1.9), piece(box, 0x707a8a, 0, -.06, 0, .035, .18, 2.3),
        piece(box, 0x9aa3b3, .16, -.38, 0, .34, .2, .04), piece(box, 0x8a93a3, 0, -.4, 0, .04, .16, .8), piece(cyl, 0x22252c, 0, -.55, 0, .22, .14, .22), piece(cone, 0x39c5ff, 0, .08, 0, .2, .2, .2).translate(.12, 0, 0)], false)! }
    { const cyl = new THREE.CylinderGeometry(.5, .5, 1, 10), cone = new THREE.ConeGeometry(.5, 1, 10), box = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(.5, 10, 8);
      const lathe = new THREE.LatheGeometry([[0, -.58], [.07, -.56], [.12, -.45], [.15, -.25], [.16, 0], [.14, .22], [.1, .4], [.05, .55], [0, .66]].map(q => new THREE.Vector2(q[0], q[1])), 14);
      const parts: THREE.BufferGeometry[] = [piece(lathe, 0xe8ecf2, 0, 0, 0), piece(sph, 0x39c5ff, .11, .2, 0, .16, .36, .16), piece(cyl, 0x22252c, 0, -.6, 0, .2, .1, .2), piece(cone, 0xff9a3a, 0, -.72, 0, .14, .22, .14).rotateZ(Math.PI),
        piece(box, 0xb9c0cc, 0, -.12, .5, .03, .42, .9), piece(box, 0xb9c0cc, 0, -.12, -.5, .03, .42, .9), piece(box, 0x8a93a3, 0, -.22, 1.02, .025, .22, .28), piece(box, 0x8a93a3, 0, -.22, -1.02, .025, .22, .28),
        piece(box, 0x707a8a, .02, -.46, .3, .02, .2, .5), piece(box, 0x707a8a, .02, -.46, -.3, .02, .2, .5), piece(box, 0xc9ced8, .22, -.4, 0, .3, .24, .03), piece(box, 0xd04a4a, .24, -.46, 0, .12, .1, .035),
        piece(cyl, 0x4a5262, -.05, -.06, .78, .05, .36, .05), piece(cyl, 0x4a5262, -.05, -.06, -.78, .05, .36, .05), piece(cone, 0xd04a4a, -.05, .15, .78, .05, .1, .05), piece(cone, 0xd04a4a, -.05, .15, -.78, .05, .1, .05),
        piece(cyl, 0x22252c, -.06, -.5, .17, .1, .1, .1), piece(cyl, 0x22252c, -.06, -.5, -.17, .1, .1, .1), piece(box, 0x39c5ff, .12, .02, 0, .02, .1, .3)];
      fGeoHi = mergeGeometries(parts, false)! }
    fightersHi = new THREE.InstancedMesh(fGeoHi, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .5, flatShading: true }), 220); fightersHi.frustumCulled = false; fightersHi.count = 0; fightersHi.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(fightersHi);
    fighters = new THREE.InstancedMesh(fGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .45, flatShading: true }), MAXF); fighters.frustumCulled = false; fighters.count = 0;
    fighters.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(fighters);
    const addMat = () => new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false });
    const pg = new THREE.BufferGeometry(); pg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXP * 6), 3)); pg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXP * 6), 3));
    projLines = new THREE.LineSegments(pg, addMat()); projLines.frustumCulled = false; scene.add(projLines);
    { const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXSP * 6), 3)); sg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXSP * 6), 3)); sparkLines = new THREE.LineSegments(sg, addMat()); sparkLines.frustumCulled = false; scene.add(sparkLines);
      const fg = new THREE.BufferGeometry(); fg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXFL * 3), 3)); fg.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXFL * 3), 3)); flashPts = new THREE.Points(fg, new THREE.PointsMaterial({ size: 18, sizeAttenuation: false, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, map: glowTex(), fog: false })); flashPts.frustumCulled = false; scene.add(flashPts) }
    tdMesh = new THREE.InstancedMesh((() => { const t = new THREE.TetrahedronGeometry(.62, 0).toNonIndexed(), a = t.attributes.position as THREE.BufferAttribute, off = [[.2, -.1, .1], [-.15, .2, -.1], [.1, .15, .2], [-.1, -.2, -.15]], seen = new Map<string, number>(); for (let i = 0; i < a.count; i++) { const key = a.getX(i).toFixed(3) + a.getY(i).toFixed(3) + a.getZ(i).toFixed(3); if (!seen.has(key)) seen.set(key, seen.size); const o = off[seen.get(key)! % 4]; a.setXYZ(i, a.getX(i) + o[0], a.getY(i) * .55 + o[1] * .6, a.getZ(i) + o[2]) } t.computeVertexNormals(); return t })(), new THREE.MeshStandardMaterial({ roughness: .6, metalness: .35, flatShading: true }), MAXTD); tdMesh.frustumCulled = false; tdMesh.count = 0; tdMesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(tdMesh);
    tdDec = new THREE.InstancedMesh(decalGeo, decalMat, MAXDD); tdDec.frustumCulled = false; tdDec.count = 0; tdDec.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(tdDec); // следы на сорванных плитах летят вместе с ними
    bolts = new THREE.InstancedMesh(geoCyl, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }), MAXP); bolts.frustumCulled = false; bolts.count = 0; bolts.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(bolts);
    const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(2000 * 3), 3));
    { const body = new THREE.CylinderGeometry(.09, .09, .7, 8).rotateZ(-Math.PI / 2).translate(-.05, 0, 0), nose = new THREE.ConeGeometry(.09, .3, 8).rotateZ(-Math.PI / 2).translate(.45, 0, 0), parts2: THREE.BufferGeometry[] = [body.toNonIndexed(), nose.toNonIndexed()];
      for (let i = 0; i < 4; i++) parts2.push(new THREE.BoxGeometry(.2, .02, .22).translate(-.3, 0, 0).rotateX(i * Math.PI / 2).toNonIndexed());
      misMesh = new THREE.InstancedMesh(mergeGeometries(parts2.map(g2 => { g2.deleteAttribute('uv'); return g2 }), false)!, new THREE.MeshStandardMaterial({ color: 0xd8dde6, roughness: .4, metalness: .6, emissive: 0x552200, flatShading: true }), MAXMIS); misMesh.frustumCulled = false; misMesh.count = 0; scene.add(misMesh);
      { const sg = mergeGeometries([new THREE.BoxGeometry(.8, .3, .3).toNonIndexed(), new THREE.BoxGeometry(.3, .55, .55).translate(-.25, 0, 0).toNonIndexed()].map(g2 => { g2.deleteAttribute('uv'); return g2 }), false)!;
        shutMesh = new THREE.InstancedMesh(sg, new THREE.MeshStandardMaterial({ color: 0xc9d3dc, roughness: .5, metalness: .5, emissive: 0x223344, flatShading: true }), 128); shutMesh.frustumCulled = false; shutMesh.count = 0; scene.add(shutMesh);
        shutGl = new THREE.InstancedMesh(geoSph, new THREE.MeshBasicMaterial({ color: 0x80d0ff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .9 }), 128); shutGl.frustumCulled = false; shutGl.count = 0; scene.add(shutGl) }
      misFl = new THREE.InstancedMesh(geoSph, new THREE.MeshBasicMaterial({ color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .9 }), MAXMIS); misFl.frustumCulled = false; misFl.count = 0; scene.add(misFl);
      const tg2 = new THREE.BufferGeometry(); tg2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXMIS * 12 * 6), 3)); tg2.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXMIS * 12 * 6), 3)); tg2.setDrawRange(0, 0);
      misTr = new THREE.LineSegments(tg2, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false })); misTr.frustumCulled = false; scene.add(misTr) }
    misPts = new THREE.Points(mg, new THREE.PointsMaterial({ color: 0xff8a50, size: 5, sizeAttenuation: false })); misPts.frustumCulled = false; scene.add(misPts);
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(400 * 6), 3));
    beamLines = new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0x7af4ff })); beamLines.frustumCulled = false; scene.add(beamLines);

    fxMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 2), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: .5, blending: THREE.AdditiveBlending, depthWrite: false }), MAXFX); fxMesh.frustumCulled = false; fxMesh.count = 0; fxMesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(fxMesh);
    const tg2 = new THREE.BufferGeometry(); tg2.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAXT * 6), 3)); tg2.setAttribute('color', new THREE.BufferAttribute(new Float32Array(MAXT * 6), 3));
    trailLines = new THREE.LineSegments(tg2, addMat()); trailLines.frustumCulled = false; scene.add(trailLines);
    exMesh = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: .35 }), MAXEX); exMesh.frustumCulled = false; exMesh.count = 0; exMesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(exMesh);
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
    addEventListener('keydown', e => { if (!on) return; if (e.key === '[') SC = Math.max(1, SC / 1.4); else if (e.key === ']') SC = Math.min(40, SC * 1.4); else if (e.key === 'f' || e.key === 'F') { follow = true; fitAll = false; tcam = null; fcam = null } else if (e.key === 'a' || e.key === 'A') { follow = true; fitAll = true; tcam = null; fcam = null } else if (e.key === 't' || e.key === 'T' || e.key === 'е' || e.key === 'Е') camTurret(); else if (e.key === 'v' || e.key === 'V' || e.key === 'м' || e.key === 'М') camFighter() });
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
    g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); return g;
  }
  const unitBox = new RoundedBoxGeometry(1, 1, 1, 1, .09), unitCyl = new THREE.CylinderGeometry(.5, .5, 1, 10).rotateZ(Math.PI / 2);
  function taper(len: number, h: number, w: number, k: number) { // клиновидный блок: сужается к носу (+x)
    const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position;
    for (let i = 0; i < p.count; i++) if (p.getX(i) > 0) { p.setY(i, p.getY(i) * k); p.setZ(i, p.getZ(i) * k) }
    g.scale(len, h, w); return g;
  }
  // сечение корпуса зависит от двигателей: сопла стоят сеткой без наложения, при тяжёлых двигателях и малом тоннаже корабль выходит короче и «квадратнее»
  function shipDims(s: any) { const L = s.T.L, mp = massParts(s.spec || { rails: 10, flak: 2, tons: L * TON_L }), ne = (s.spec && s.spec.real && s.spec.engCnt > 0) ? Math.min(48, s.spec.engCnt) : Math.max(1, Math.min(24, s.engN || 3)), noE = !!(s.spec && s.spec.real && !(s.spec.engT > 0)), cols = Math.ceil(Math.sqrt(ne)), rows = Math.ceil(ne / cols);
    // поперечное сечение корабля задаёт масса двигателей: 1000 т → ~44 м, 5000 т → ~220 м (массивнее прежних 20/100 м), но не тоньше 7,5% длины, независимо от длины корпуса
    const S = Math.min(L * 3, Math.max(L * (s.spec && s.spec.real ? .2 : .075), (mp.parts.eng || 0) / TON_L * 2.2)), d = S / Math.max(cols, rows) * .95;
    const RLd = !!(s.spec && s.spec.real && !noE), dE = L * .06, W = RLd ? Math.min(L * .9, Math.max(S, cols * dE)) : S, H = RLd ? Math.min(L * .9, Math.max(S, rows * dE)) : S;
    return { W, H, ne: noE ? 0 : ne, d: Math.min(W / cols, H / rows) * .95, cols, rows } }
  // истребитель собирается из тех же деталей, что и проект: сопла по числу двигателей, стволы по числу пушек, плиты и крылья по броне, бак-гондола по топливу
  function wingG(tipK: number, sw: number, sd: number) { const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getZ(i) * sd > 0) p.setY(i, p.getY(i) * tipK - sw); return g }
  function wingH(tipK: number, sw: number, sd: number) { const g = new THREE.BoxGeometry(1, 1, 1), p = g.attributes.position; for (let i = 0; i < p.count; i++) if (p.getZ(i) * sd > 0) p.setX(i, p.getX(i) * tipK - sw); return g }
  function craftGeo(P: any, hi: boolean) {
    const ne = Math.max(1, Math.min(8, P.eng || 2)), ng = Math.max(0, Math.min(8, P.ng || 2)), arm = Math.min(8, P.arm || 0), pr: THREE.BufferGeometry[] = [];
    const cyl = new THREE.CylinderGeometry(.5, .5, 1, 8), cone = new THREE.ConeGeometry(.5, 1, 8), box = new THREE.BoxGeometry(1, 1, 1), sph = new THREE.SphereGeometry(.5, 10, 8), rb = 1 + .04 * arm;
    const lathe = new THREE.LatheGeometry([[0, -.55], [.06, -.52], [.1, -.4], [.125, -.1], [.115, .2], [.075, .45], [.03, .62], [0, .74]].map(q => new THREE.Vector2(q[0], q[1])), 12);
    pr.push(piece(lathe, 0xdfe4ec, 0, 0, 0, rb, 1, rb * .9));
    pr.push(piece(sph, 0x2a86b8, -.075, .2, 0, .1, .34, .13)); // фонарь кабины сверху
    const span = .5 + .05 * arm; // крылья растут с бронёй
    for (const sd of [-1, 1]) {
      pr.push(piece(wingG(.3, .85, sd), 0xb9c0cc, 0, -.22, sd * (.1 + span / 2), .022, .55, span));
      pr.push(piece(box, 0x39c5ff, 0, -.69, sd * (.1 + span), .03, .06, .03)); // огонёк на законцовке
      pr.push(piece(wingG(.5, .3, sd), 0x9aa3b3, 0, .3, sd * (.08 + .14), .016, .2, .28)); // передние плоскости
      pr.push(piece(wingG(.4, .6, sd), 0x4a5262, -.1, -.45, sd * .16, .2, .26, .02)); // килевые шайбы на двигателях
    }
    // двигатели: сетка сопел по числу двигателей
    const rows = ne > 4 ? 2 : 1, cols = Math.ceil(ne / rows), er = Math.min(.075, .24 / cols), sp = er * 2.3;
    pr.push(piece(box, 0x4a5262, 0, -.47, 0, rows * sp * 1.05, .14, cols * sp * 1.05)); // моторная рама
    let i = 0; for (let rw = 0; rw < rows; rw++) for (let c = 0; c < cols && i < ne; c++, i++) { const cnt = Math.min(cols, ne - rw * cols), zz = (c - (cnt - 1) / 2) * sp, xx = (rw - (rows - 1) / 2) * sp;
      pr.push(piece(cyl, 0x22252c, xx, -.58, zz, er * 2, .16, er * 2)); if (hi) pr.push(piece(cyl, 0x3d424d, xx, -.5, zz, er * 2.3, .03, er * 2.3));
      pr.push(piece(cone, 0xff9a3a, xx, -.72, zz, er * 1.5, .22, er * 1.5, Math.PI)) }
    // стволы осевых пушек вдоль носа, пары по бортам
    for (let k = 0; k < ng; k++) { const sd = k % 2 ? 1 : -1, q = Math.floor(k / 2), zz = sd * (.1 + .05 * q), xx = q % 2 ? -.03 : .03;
      pr.push(piece(cyl, 0x2b2f38, xx, .3, zz, .028, .62, .028)); if (hi) pr.push(piece(box, 0x39c5ff, xx, .62, zz, .035, .03, .035)) }
    // броневые плиты на бортах
    for (let k = 0; k < Math.min(6, arm); k++) { const sd = k % 2 ? 1 : -1, q = Math.floor(k / 2); pr.push(piece(box, 0x8a93a3, (q - 1) * .06, -.05 + q * .1, sd * (.125 * rb + .008), .09, .2, .02)) }
    if ((P.fuel || 0) > 1500) pr.push(piece(cyl, 0x7d8696, -.12 * rb, -.12, 0, .07, .5, .07)); // верхний бак-гондола
    if (hi) pr.push(piece(box, 0x39c5ff, 0, .05, 0, .26 * rb, .02, .02)); // световая полоса по фюзеляжу
    return mergeGeometries(pr, false)!;
  }
  const fmods = new Map<string, any>();
  function fmod(P: any) { let M = fmods.get(P.mk); if (M) return M;
    const mk = (hi: boolean, n: number) => { const m = new THREE.InstancedMesh(craftGeo(P, hi), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .5, flatShading: true }), n); m.frustumCulled = false; m.count = 0; m.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(m); return m };
    M = { hi: mk(true, 160), lo: mk(false, 1200), nh: 0, nl: 0 }; fmods.set(P.mk, M); return M }
  // блок корпуса: восьмигранная призма (скошенные грани по углам — наклонная броня), торцы плоские, без швов и пересечений
  let curL = 1;
  function chamPrism(len: number, h: number, w: number, c: number, col: number, cy: number, cx: number, nose = 1, hex = false) {
    const hh = h / 2, ww = w / 2, pts = hex ? [[hh, -(ww - c)], [hh, ww - c], [0, ww], [-hh, ww - c], [-hh, -(ww - c)], [0, -ww]] : [[hh, -(ww - c)], [hh, ww - c], [hh - c, ww], [-(hh - c), ww], [-hh, ww - c], [-hh, -(ww - c)], [-(hh - c), -ww], [hh - c, -ww]], pos: number[] = [], x0 = -len / 2, x1 = len / 2;
    const q = (a: number[], b: number[], c2: number[], d: number[]) => { for (const v of [a, b, c2, a, c2, d]) pos.push(v[0], v[1], v[2]) };
    const NP = pts.length;
    for (let i = 0; i < NP; i++) { const A = pts[i], B = pts[(i + 1) % NP]; q([x0, A[0], A[1]], [x1, A[0] * nose, A[1] * nose], [x1, B[0] * nose, B[1] * nose], [x0, B[0], B[1]]) }
    for (let i = 1; i < NP - 1; i++) { const A = pts[0], B = pts[i], C = pts[i + 1]; pos.push(x0, A[0], A[1], x0, C[0], C[1], x0, B[0], B[1]); pos.push(x1, A[0] * nose, A[1] * nose, x1, B[0] * nose, B[1] * nose, x1, C[0] * nose, C[1] * nose) }
    // грани должны смотреть наружу: проверяем каждый треугольник (призма выпуклая, центр в нуле по y,z и в середине по x) и при необходимости меняем обход
    for (let t = 0; t + 8 < pos.length; t += 9) { const ax = pos[t], ay = pos[t + 1], az = pos[t + 2], bx = pos[t + 3], by = pos[t + 4], bz = pos[t + 5], cx2 = pos[t + 6], cy2 = pos[t + 7], cz2 = pos[t + 8];
      const ux = bx - ax, uy = by - ay, uz = bz - az, vx = cx2 - ax, vy = cy2 - ay, vz = cz2 - az, nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx, mx = (ax + bx + cx2) / 3, my = (ay + by + cy2) / 3, mz = (az + bz + cz2) / 3;
      if (nx * mx + ny * my + nz * mz < 0) { pos[t + 3] = cx2; pos[t + 4] = cy2; pos[t + 5] = cz2; pos[t + 6] = bx; pos[t + 7] = by; pos[t + 8] = bz } }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); const n = pos.length / 3, cc = new THREE.Color(col), arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b } g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.computeVertexNormals(); g.translate(cx, cy, 0);
    { const P = g.attributes.position as THREE.BufferAttribute, N = g.attributes.normal as THREE.BufferAttribute, uv = new Float32Array(n * 2), k = 1 / (curL * .05);
      for (let i = 0; i < n; i++) { const nx = Math.abs(N.getX(i)), ny = Math.abs(N.getY(i)), nz = Math.abs(N.getZ(i)); let a: number, b: number;
        if (nx >= ny && nx >= nz) { a = P.getZ(i); b = P.getY(i) } else if (ny >= nz) { a = P.getX(i); b = P.getZ(i) } else { a = P.getX(i); b = P.getY(i) }
        uv[i * 2] = a * k; uv[i * 2 + 1] = b * k }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2)) }
    return g;
  }
  const thL0 = () => 0;
  function hullGeo(s: any, seed: number) {
    const mp0 = massParts(s.spec || { rails: 10, flak: 2, tons: s.T.L * TON_L }), RL = !!(s.spec && s.spec.real), hasBr = !RL || mp0.parts.crew > 0, hasMast = !RL || ((s.spec.scList || []).length > 0 || s.spec.fcsN > 0 || s.spec.ew > 0), R = rng(seed), P = PAL[s.side], L = (curL = s.T.L), D0 = s._dims || (s._dims = shipDims(s)), W = D0.W, H = D0.H, parts: THREE.BufferGeometry[] = [];
    const shade = (c: number, f: number) => new THREE.Color(c).multiplyScalar(f).getHex();
    const neu = (c: number, k = .7) => new THREE.Color(c).lerp(new THREE.Color(0x8d9bb0), k).getHex(); // нейтральный серо-стальной корпус: цвет стороны только в акцентах
    // хребет из блоков: участки идут по модулям корабля (корма → нос), длина участка пропорциональна массе модулей
    const x0 = -L * .5, x1 = L * .34, Lk = x1 - x0; const seg: any[] = [];
    const mp = massParts(s.spec || { rails: 10, flak: 2, tons: L * TON_L }), ORD: [string, string][] = [['eng', 'e'], ['reactor', 'r'], ['tank', 't'], ['frame', 's'], ['hangF', 'f'], ['hangB', 'b'], ['crew', 'q'], ['mar', 'q'], ['flak', 'w'], ['rail', 'w'], ['gat', 'w'], ['miss', 'm'], ['laser', 'l'], ['core', 'c']];
    const lst: { ty: string; len: number }[] = []; { const raw = ORD.filter(([k]) => mp.parts[k] > 0).map(([k, ty]) => ({ k, ty, w: Math.max(mp.parts[k], 1) })); const tt = raw.reduce((a, q) => a + q.w, 0);
      const sh = raw.map(q => Math.max(q.w / tt, .03)), ss = sh.reduce((a, b) => a + b, 0);
      raw.forEach((q, i) => { const share = sh[i] / ss * Lk, nb = Math.max(1, Math.min(5, Math.round(share / (Lk * .1)))); for (let j = 0; j < nb; j++) lst.push({ ty: q.ty, len: share / nb }) }) }
    const engLen = lst.filter(q => q.ty === 'e').reduce((a, q) => a + q.len, 0);
    let x = x0;
    for (const e of lst) {
      const ty = e.ty, len = e.len, wF = ty === 'e' ? .95 : ty === 'f' || ty === 'b' ? 1.1 : ty === 'w' || ty === 'm' ? .8 : .62 + R() * .38, hF = ty === 'e' ? 1.1 : ty === 'f' || ty === 'b' ? 1.05 : ty === 'w' || ty === 'm' ? .8 : .65 + R() * .45;
      const tpar = Math.max(0, Math.min(1, ((x + len / 2 - x0) / Lk - .5) / .5)), tp = RL ? 1 - .55 * tpar * tpar : 1, w = (RL && ty === 'e') ? W * .98 : RL ? Math.max(W * (1.05 + wF * .5) * tp, W * .6) : W * wF, h = RL ? H * (ty === 'e' ? .98 : 1 + (hF - .62) * .25) : H * hF, cx = x + len / 2, cy = ty === 's' ? (R() - .5) * H * .25 : 0;
      const col = RL ? (ty === 'e' ? neu(P.dark, .78) : ty === 't' ? 0x9aa3b2 : neu(R() < .85 ? P.main : P.dark, .8)) : ty === 'e' ? P.dark : ty === 'f' ? P.main : ty === 'b' ? P.acc2 : ty === 't' ? 0x9aa3b2 : ty === 'r' ? P.dark : R() < .55 ? P.main : R() < .6 ? P.dark : P.acc2;
      const cF = ty === 'e' ? .1 : ty === 'w' || ty === 'm' || ty === 'l' ? .24 : ty === 'f' || ty === 'b' ? .12 : ty === 'q' ? .16 : .12 + R() * .16; // наклон угловых плит: оружейные блоки скошены сильнее всего
      seg.push({ cx, w, h, len, cy, c: RL ? Math.min(w, h) * (cF + .12) : 0, weapon: ty === 'w' || ty === 'm' || ty === 'l', ty, col: shade(col, RL ? .94 + R() * .12 : .85 + R() * .3) });
      if (false) for (const sd of [-1, 1]) for (let i = 0; i < 5; i++) parts.push(piece(unitBox, P.glow, cx - len * .4 + (i + .5) * len * .8 / 5, cy + h * .1, sd * (w / 2 + w * .01), len * .1, h * .22, w * .03));
      if (false) { const Rr = Math.max(w, h) * .78, tb = Math.max(w, h) * .05; parts.push(piece(new THREE.TorusGeometry(Rr, tb, 6, 28).rotateY(Math.PI / 2), 0x9aa3b2, cx, cy, 0)); parts.push(piece(new THREE.TorusGeometry(Rr * .985, tb * .4, 6, 28).rotateY(Math.PI / 2), P.glow, cx, cy, 0)); for (let q = 0; q < 4; q++) { const a = q * Math.PI / 2 + Math.PI / 4; parts.push(piece(unitBox, 0x7d8696, cx, cy + Math.sin(a) * Rr * .5, Math.cos(a) * Rr * .5, len * .06, tb * .8 + Math.abs(Math.sin(a)) * Rr * .9, tb * .8 + Math.abs(Math.cos(a)) * Rr * .9)) } } // обитаемое кольцо вокруг жилого отсека
      if (false) for (const sd of [-1, 1]) { parts.push(piece(wingH(.45, .9, sd), shade(P.main, .8), cx, cy, sd * (w / 2 + w * .5), len * 1.2, h * .03, w)); parts.push(piece(unitBox, P.glow, cx - len * .25, cy, sd * (w / 2 + w), len * .5, h * .035, w * .02)) } // крылья-радиаторы реактора
      if (false) parts.push(piece(taper(1, 1, 1, .3), shade(P.dark, 1.25), cx, cy + h / 2 + h * .1, 0, len * .92, h * .22, w * .66)); // угловой обтекатель над оружейным блоком
      if (ty === 't' && !RL) { const kk = 1.02; for (let i = 0; i < 3; i++) parts.push(piece(unitCyl, 0x4a5262, cx - len * .35 + i * len * .35, cy, 0, len * .05, Math.max(RL ? w : 0, h) * kk, Math.max(RL ? h : 0, w) * kk)) } // топливный бак: цилиндр с обручами
      else if (ty === 'r' && !RL) { parts.push(piece(unitBox, P.glow, cx, cy + h * .52, 0, len * .85, h * .05, w * .25)); for (const sd of [-1, 1]) parts.push(piece(unitBox, shade(P.main, .7), cx, cy, sd * (w * .52), len * .8, h * .8, w * .03)) } // реактор: светящаяся шина и радиаторы
      
      if ((ty === 'f' || ty === 'b') && !RL) for (const sd of [-1, 1]) { // ангарные ворота по бортам
        parts.push(piece(unitBox, 0x0b0d12, cx, cy - h * .05, sd * (w / 2 + w * .01), len * .78, h * .5, w * .03)); parts.push(piece(unitBox, P.glow, cx, cy - h * .3, sd * (w / 2 + w * .02), len * .78, h * .03, w * .02)) }
      if (ty === 'e' && !RL) for (let i = 0; i < 4; i++) parts.push(piece(unitBox, shade(P.main, .7), cx - len / 2 + (i + .5) * len / 4, cy, 0, len * .07, h * 1.12, w * 1.04)); // рёбра радиатора
      if (ty === 'm' && !RL) for (let i = 0; i < 6; i++) for (const sd of [-1, 1]) parts.push(piece(unitBox, shade(P.dark, 1.1), cx - len * .4 + (i + .5) * len * .8 / 6, cy + h / 2 + h * .08, sd * w * .22, len * .1, h * .16, w * .3)); // ракетные шахты
      if (ty === 'l' && !RL) { parts.push(piece(unitCyl, 0x20242c, cx + len * .25, cy + h / 2 + h * .2, 0, len * 1.3, h * .5, h * .5)); parts.push(piece(unitCyl, P.glow, cx + len * .9, cy + h / 2 + h * .2, 0, len * .08, h * .35, h * .35)) } // лазерная пушка
      x += len;
    }
    if (!seg.length) seg.push({ cx: (x0 + x1) / 2, w: W, h: H, len: Lk, cy: 0, weapon: true, ty: 's', col: P.main });
    let sty: any = null, extraM: any[] = [];
    if (RL) { // плавный корпус по параметрам проекта: нос заострён тем сильнее, чем мощнее двигатели; ангары и орудия расширяют середину; броня задаёт наклон граней
      const old2 = seg.splice(0), tot = Math.max(1, Object.values(mp.parts).reduce((a: number, b: any) => a + (+b || 0), 0)), eS = Math.min(1, (mp.parts.eng || 0) / tot * 5), hS = Math.min(1, ((mp.parts.hangF || 0) + (mp.parts.hangB || 0)) / tot * 3), wS = Math.min(1, ((mp.parts.rail || 0) + (mp.parts.flak || 0) + (mp.parts.gat || 0) + (mp.parts.miss || 0) + (mp.parts.laser || 0)) / tot * 2), aS = Math.min(1, (mp.armor || 0) / Math.max(1, tot) * 3);
      const nF = .2 + .28 * eS, wMid = 1.15 + .2 * hS + .15 * wS, sm = (a: number) => a * a * (3 - 2 * a);
      const nose0 = R(), nose = wS > .4 && hS < .3 ? 'prong' : nose0 < .4 ? 'wedge' : nose0 < .7 ? 'prong' : 'ram', sweep = nose === 'prong' && wS > .4 ? .75 + R() * .25 : (R() - .5) * 1.0, island = R() < .25 + hS * .5; sty = { eS, hS, wS, aS, nose, sweep, island, tot };
      for (const e of old2) { const n = Math.max(1, Math.round(e.len / (L * .04)));
        for (let j = 0; j < n; j++) { const len = e.len / n, cx = e.cx - e.len / 2 + (j + .5) * len, t = Math.max(0, Math.min(1, (cx - x0) / Lk)); let pw: number, ph: number;
          const kT = t > 1 - nF ? Math.pow((t - (1 - nF)) / nF, 1.2) : 0; pw = .5 * (1 - .3 * kT); ph = .82 * (1 - .22 * kT);
          const w = e.ty === 'e' ? e.w : W * pw, h = e.ty === 'e' ? e.h : H * ph, c = Math.min(w, h) * (e.ty === 'e' ? .14 : .1 + .05 * aS);
          seg.push({ ...e, cx, len, w, h, cy: 0, c: e.ty === 'e' ? c : w * .27, col: e.col });
          if (e.ty === 'm' && j % 2 === 0) for (const sd of [-1, 1]) for (let q = 0; q < 2; q++) parts.push(piece(unitBox, 0x1a1e26, cx, h / 2 + L * .0012, sd * (w * .2 + q * w * .17 * sd), len * .7, L * .0025, w * .13)); // шахты ракет: плоские люки вровень с палубой
          if ((e.ty === 'f' || e.ty === 'b') && hS <= .15 && j === (n >> 1)) for (const sd of [-1, 1]) { const gl = e.len * .8, gh = h * (1 - 2 * c / h) * .45; parts.push(piece(unitBox, 0x0b0d12, cx, -h * .05, sd * (w / 2 + w * .004), gl, gh, w * .012)); parts.push(piece(unitBox, P.glow, cx, -h * .05 - gh / 2, sd * (w / 2 + w * .006), gl, h * .02, w * .014)) } } } }
    const finI: any[] = [];
    // жёсткий корпус: ступенчатые призмы с фасками (сечение — прямоугольник со срезанными углами), никаких сглаживаний
    const dimsAt = (xx: number) => { const q = seg; let i = 0; while (i < q.length - 1 && xx > (q[i].cx + q[i + 1].cx) / 2) i++; return q[i] };
    { const NS = 56, xe = x1 + L * .05, pos: number[] = [], col: number[] = [], idx: number[] = [], nrm: number[] = [], uv: number[] = [], NR = RING.length;
      if (RL) { // настоящий корабль: отдельные блоки-модули со скошенными гранями, встык, без наложений
        for (const e of seg) parts.push(chamPrism(e.len, e.h, e.w, e.ty === 'e' ? e.c : e.w * .27, e.col, e.cy, e.cx, 1, e.ty !== 'e'));
        const lst0 = seg[seg.length - 1], nl = L * .2; parts.push(chamPrism(nl * .55, lst0.h, lst0.w, Math.min(lst0.h, lst0.w) * .3, shade(P.main, 1.1), lst0.cy, x1 + nl * .275, .55)); parts.push(chamPrism(nl * .45, lst0.h * .55, lst0.w * .55, Math.min(lst0.h, lst0.w) * .12, shade(P.main, 1.2), lst0.cy - lst0.h * .1, x1 + nl * .55 + nl * .225, .3)); // клиновидный нос
        if (sty) { // навесные узлы: орудийные платформы, броневые щёки, ангарные коробки, радиаторы, варианты носа — по параметрам проекта
          const Lk2 = x1 - x0, xa = x0 + (lst.filter(q => q.ty === 'e').reduce((a, q) => a + q.len, 0)) + Lk2 * .04, th = L * .03, dm = (xx: number) => dimsAt(xx);
          const att = (len: number, h: number, w: number, c: number, col: number, x: number, y: number, z: number, o: { rot?: number; nose?: number } = {}) => { const g = chamPrism(len, h, w, c, col, 0, 0, o.nose ?? 1); if (o.rot) g.rotateY(o.rot); g.translate(x, y, z); return g };
          const nl2 = L * .2;
          const delta = (len: number, span: number, th2: number, tipX: number, col: number, sd: number) => { // стреловидное крыло-дельта: корень вдоль корпуса, кончик смещён назад/вбок
            const sh = new THREE.Shape(); sh.moveTo(0, 0); sh.lineTo(len, 0); sh.lineTo(tipX, sd * span); sh.closePath();
            let g = new THREE.ExtrudeGeometry(sh, { depth: th2 * 1.2, bevelEnabled: true, bevelThickness: th2 * .25, bevelSize: th2 * .3, bevelOffset: -th2 * .3, bevelSegments: 1 }); g.rotateX(-Math.PI / 2); g.translate(0, 0, 0); g = g.toNonIndexed(); g.clearGroups(); g.deleteAttribute('uv'); g.computeVertexNormals();
            const n = g.attributes.position.count, cc = new THREE.Color(col), arr = new Float32Array(n * 3); for (let i = 0; i < n; i++) { arr[i * 3] = cc.r; arr[i * 3 + 1] = cc.g; arr[i * 3 + 2] = cc.b }
            g.setAttribute('color', new THREE.BufferAttribute(arr, 3)); g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2)); return g };
          const isDelta = sty.nose === 'prong' && sty.wS > .4;
          if (sty.nose === 'prong') for (const sd of [-1, 1]) { parts.push(att(nl2 * 3.6, lst0.h * .42, lst0.w * .2, lst0.h * .08, neu(P.main, .7), x1 + nl2 * 1.5, lst0.cy - lst0.h * .12, sd * lst0.w * .36, { nose: .1, rot: -sd * .1 })); parts.push(att(nl2 * .7, lst0.h * .6, lst0.w * .26, lst0.h * .1, neu(P.dark, .9), x1 + nl2 * .1, lst0.cy - lst0.h * .1, sd * lst0.w * .34, { nose: .6 })) } // два длинных копья-клинка с корнем
          else if (sty.nose === 'ram') parts.push(att(nl2 * .7, lst0.h * 1.05, lst0.w * 1.25, lst0.h * .3, neu(P.main, .75), x1 + nl2 * .2, lst0.cy, 0, { nose: .8 }));
          // броневые щёки на носу
          { const cw = L * (.03 + .06 * sty.aS), cLn = L * (.1 + .16 * sty.aS), xc = x1 - cLn * .35, d0 = dm(xc); for (const sd of [-1, 1]) parts.push(att(cLn, d0.h * .55, cw, cw * .3, neu(P.main, .9), xc, d0.cy - d0.h * .1, sd * (d0.w / 2 + cw / 2 - L * .004), { nose: .4 })) }
          // орудийные платформы: плоские палубы по бортам с башнями на палубе
          const np = Math.max(sty.wS > .05 ? 1 : 0, Math.round(1 + sty.wS * 3)), xs0 = xa + Lk2 * .1, xs1 = x1 - Lk2 * .18;
          const spanP = xs1 - xs0;
          if (isDelta) for (const sd of [-1, 1]) { // два яруса дельта-крыльев с башнями на палубе
            for (const [k, rl, sp, tx, yy] of [[0, .46, .26, .1, .04], [1, .3, .17, .02, -.09]] as number[][]) { const len = Lk2 * rl, x00 = k ? xs1 - len * .9 : xa + Lk2 * .08, dd = dm(x00 + len * .4), y0 = dd.cy + dd.h * yy, span = L * sp * (.7 + .5 * sty.wS);
              const wg = delta(len, span, th, len * tx, neu(P.main, .8 - k * .1), sd); wg.translate(x00, y0, sd * (dd.w / 2 - L * .004)); parts.push(wg);
              const under = delta(len * .8, span * .8, th * .5, len * tx * .8, neu(P.dark, .8), sd); under.translate(x00 + len * .05, y0 - th * .6, sd * (dd.w / 2 - L * .004)); parts.push(under);
              for (const [fx, fz] of k ? [[.4, .3], [.62, .2]] : [[.35, .22], [.52, .14], [.34, .52], [.55, .36]]) extraM.push({ x: x00 + len * fx, y: y0 + th, z: sd * (dd.w / 2 + span * fz), face: 0, plat: true }) } }
          else for (let i = 0; i < np; i++) { const px = np === 1 ? (xs0 + xs1) / 2 : xs0 + (xs1 - xs0) * i / (np - 1), wl = Math.min(L * (.13 + .09 * sty.wS), spanP / np * .86 + L * .02), ww = L * (.075 + .09 * sty.wS) * (1 - i * .12), dd = dm(px), y = dd.cy + dd.h * .05;
            for (const sd of [-1, 1]) { const z = sd * (dd.w / 2 + ww / 2 - L * .005); { const gp = chamPrism(wl, th, ww, th * .14, neu(P.main, .8), 0, 0, .78); gp.translate(0, 0, sd * ww / 2); gp.rotateY(-sd * sty.sweep * .6); gp.translate(px, y, sd * (dd.w / 2 - L * .004)); parts.push(gp) } parts.push(att(wl * .5, th * .7, ww * .5, th * .15, neu(P.dark, .8), px - wl * .1, y - th * .85, z));
              for (let k = 0; k < 2; k++) extraM.push({ x: px + (k ? -wl * .22 : wl * .2), y: y + th / 2, z: z + sd * ww * (k ? -.05 : .05), face: 0, plat: true }) } }
          // ангарные коробки по бортам
          if (sty.hS > .15) { const hl = L * (.12 + .26 * sty.hS), hw = L * (.05 + .09 * sty.hS), px = xa + Lk2 * .25 + hl / 2, dd = dm(px), hh = dd.h * .95;
            for (const sd of [-1, 1]) { const z = sd * (dd.w / 2 + hw / 2 + L * .008); parts.push(att(hl, hh, hw, hh * .15, neu(P.main, .8), px, dd.cy - dd.h * .05, z, { nose: .92 })); parts.push(piece(unitBox, 0x0b0e14, px, dd.cy - dd.h * .1, z + sd * (hw / 2 + L * .0005), hl * .88, hh * .5, L * .002)); parts.push(piece(unitBox, P.glow, px, dd.cy - dd.h * .1 - hh * .27, z + sd * (hw / 2 + L * .001), hl * .88, L * .003, L * .003));
              for (let k = 0; k < 2; k++) extraM.push({ x: px + (k ? -hl * .25 : hl * .25), y: dd.cy - dd.h * .05 + hh / 2, z, face: 0, plat: true }); parts.push(att(L * .02, dd.h * .3, hw * .6, L * .004, P.dark, px, dd.cy - dd.h * .05, sd * (dd.w / 2 + L * .004), {})) } }
          // V-радиаторы у кормы
          if (sty.eS > .25) { const xr = xa + Lk2 * .03, d1 = dm(xr); for (const sd of [-1, 1]) { const g = chamPrism(L * .12, L * .006, L * (.025 + .03 * sty.eS), L * .002, shade(P.dark, 1.15), 0, 0); g.rotateX(sd * .9); g.translate(xr, d1.cy + d1.h * .45, sd * (d1.w / 2 + L * .012)); parts.push(g) } }
        }
      } else {
        for (let i = 0; i <= NS; i++) { const xx = x0 + (xe - x0) * i / NS; let d: any = dimsAt(Math.min(xx, x1)), k = 1;
          if (xx > x1) { const t = Math.min(1, (xx - x1) / (xe - x1)); k = 1 - t * .35 } // тупой срез носа вместо иглы
          const c = new THREE.Color(d.col); const rib = Math.abs(Math.sin(xx / L * 38)) > .93 ? .72 : 1; c.multiplyScalar(rib);
          for (let j = 0; j < NR; j++) { const r = RING[j]; pos.push(xx, d.cy + r.u * d.h / 2 * k * .985, r.v * d.w / 2 * k * .985); col.push(c.r, c.g, c.b); nrm.push(0, 1, 0); uv.push(0, 0) } }
        for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a = i * NR + j, b = i * NR + (j + 1) % NR, c2 = (i + 1) * NR + j, d2 = (i + 1) * NR + (j + 1) % NR; idx.push(a, c2, b, b, c2, d2) }
        const g0 = new THREE.BufferGeometry(); g0.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g0.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g0.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g0.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g0.setIndex(idx);
        const g1 = g0.toNonIndexed(); g1.computeVertexNormals(); flatCol(g1); parts.push(g1);
      }
      { const dN = dimsAt(x1); parts.push(piece(unitBox, shade(dN.col, .8), xe - L * .004, dN.cy, 0, L * .008, dN.h * .65 * .985, dN.w * .65 * .985));
 } // торцевая плита носа и острый нос
      // кормовые стабилизаторы и бортовые спонсоны — силуэт «как на концептах»
      const fin = (sd: number, vy: number) => parts.push(piece(taper(1, 1, 1, .15), shade(P.dark, 1.1), x0 + L * .1, vy * H * .5, sd * W * .62, L * .2, H * .08, W * .5, 0));
      for (const sd of (RL ? [] : [-1, 1])) { finI.push({ pi: parts.length, sd, xc: x0 + L * .1, hl: L * .1 }); fin(sd, 0); finI.push({ pi: parts.length, sd, xc: x0 + L * .3, hl: L * .15 }); parts.push(piece(taper(1, 1, 1, .2), shade(P.main, .8), x0 + L * .3, 0, sd * W * .5, L * .3, H * .15, W * .55)) } }
    // верхние блоки и рубка
    for (let i = 0; i < (RL ? 0 : 9); i++) { const sg = seg[Math.floor(R() * seg.length)], len = sg.len * (.4 + R() * .5), h = H * (.15 + R() * .3), w = sg.w * (.3 + R() * .5);
      parts.push(piece(unitBox, shade(R() < .5 ? P.dark : P.main, .8 + R() * .4), sg.cx + (R() - .5) * sg.len * .5, sg.cy + sg.h / 2 + h / 2, (R() < .5 ? -1 : 1) * sg.w * .38, len, h * .7, w * .22)) }
    const bs = seg[seg.length - 1], bh = RL ? Math.min(H * 1.4, L * .07) : H * 1.4, bx = bs.cx;
    if (hasBr && RL) { // рубка: два ступенчатых блока со скосами и светящимся остеклением, сверху мачта (только если есть сенсоры)
      const top = bs.cy + bs.h / 2 + thL0() * 1.1, b1 = bh * .5, b2 = bh * .38, l1 = L * .075, l2 = L * .045;
      const bz0 = sty && sty.island ? bs.w * .42 : 0;
      parts.push(chamPrism(l1, b1, W * .5, b1 * .3, P.dark, top + b1 / 2, bx, .8).translate(0, 0, bz0));
      parts.push(chamPrism(l2, b2, W * .34, b2 * .3, P.main, top + b1 + b2 / 2, bx - L * .006, .75).translate(0, 0, bz0));
      parts.push(piece(unitBox, P.glow, bx - L * .006 + l2 * .5 * .93, top + b1 + b2 * .55, bz0, L * .002, b2 * .26, W * .28));
      if (hasMast) { parts.push(piece(unitBox, 0x8a8f99, bx - L * .02, top + b1 + b2 + bh * .22, bz0, L * .004, bh * .44, L * .004)); parts.push(piece(unitBox, 0x8a8f99, bx - L * .02, top + b1 + b2 + bh * .4, bz0, L * .003, L * .003, W * .18)) }
    } else if (hasBr) {
    parts.push(piece(unitBox, P.dark, bx, bs.cy + bs.h / 2 + bh * .25, 0, L * .07, bh * .5, W * .55));
    parts.push(piece(unitBox, P.acc2, bx + L * .005, bs.cy + bs.h / 2 + bh * .6, 0, L * .055, bh * .22, W * .5));
    parts.push(piece(unitBox, P.glow, bx + L * .006, bs.cy + bs.h / 2 + bh * .6, 0, L * .057, bh * .06, W * .52));
    parts.push(piece(unitBox, P.main, bx, bs.cy + bs.h / 2 + bh * .86, 0, L * .04, bh * .2, W * .36));
    if (hasMast) { for (const z of [-1, 1]) parts.push(piece(unitBox, 0x8a8f99, bx - L * .01, bs.cy + bs.h / 2 + bh * 1.05, z * W * .12, L * .004, bh * .3, L * .004));
    parts.push(piece(unitBox, 0x8a8f99, bx - L * .01, bs.cy + bs.h / 2 + bh * 1.6, 0, L * .004, L * .004, W * .3)); }
    }
    if (s.T.role === 'station' || (s.spec && s.spec.role === 'station')) { // станция: вращающееся кольцо на спицах и солнечные панели
      const xc = x0 + Lk * .55, Rr = L * .3, tube = L * .022, ring = new THREE.TorusGeometry(Rr, tube, 8, 40).rotateY(Math.PI / 2);
      parts.push(piece(ring, shade(P.main, .9), xc, 0, 0)); parts.push(piece(new THREE.TorusGeometry(Rr * .985, tube * .45, 6, 40).rotateY(Math.PI / 2), P.glow, xc, 0, 0));
      for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2; parts.push(piece(unitBox, shade(P.dark, 1.2), xc, Math.sin(a) * Rr * .5, Math.cos(a) * Rr * .5, L * .012, L * .012 + Math.abs(Math.sin(a)) * Rr, L * .012 + Math.abs(Math.cos(a)) * Rr)) }
      for (const sd of [-1, 1]) for (let k = 0; k < 3; k++) { parts.push(piece(unitBox, 0x1d3a5e, x0 + Lk * (.25 + k * .25), 0, sd * (W * 1.6 + Rr * .0), L * .2, L * .004, L * .12)); parts.push(piece(unitBox, 0x8a8f99, x0 + Lk * (.25 + k * .25), 0, sd * W * .6, L * .01, L * .008, W * 1.2)) } }
    // грибы мелкой фурнитуры
    for (let i = 0; i < (RL ? 0 : 50); i++) { const sg = seg[Math.floor(R() * seg.length)], a = R() < .6, r = L * (.003 + R() * .006);
      parts.push(piece(unitBox, shade(R() < .5 ? P.acc : 0x6a707c, .8 + R() * .4), sg.cx + (R() - .5) * sg.len, a ? sg.cy + sg.h / 2 + r / 2 : sg.cy + (R() - .5) * sg.h, a ? (R() < .5 ? -1 : 1) * sg.w * (.3 + R() * .15) : (R() < .5 ? -1 : 1) * (sg.w / 2 + r / 2), r * (1 + R() * 2), r, r * (1 + R() * 1.5))) }
    // кормовой блок и сопла
    const ne = D0.ne;
    if (ne > 0 && !RL) parts.push(piece(unitBox, P.dark, x0 - L * .02, 0, 0, L * .06, H * 1.15, W * 1.05));
    const nozz: any[] = [];
    if (ne > 0) { const cols = D0.cols, rows = D0.rows, pz = W * .94 / cols, py = H * .94 / rows, r = Math.min(D0.d / 2, pz * .46, py * .46); let i = 0;
      for (let rw = 0; rw < rows && i < ne; rw++) for (let c = 0; c < cols && i < ne; c++, i++) { const cnt = Math.min(cols, ne - rw * cols), zz = (c - (cnt - 1) / 2) * pz, yy = (rw - (rows - 1) / 2) * py;
        if (RL) { const bellG = new THREE.CylinderGeometry(.5, .33, 1, 14).rotateZ(Math.PI / 2); parts.push(piece(bellG, 0x23262d, x0 - r * .85, yy, zz, r * 1.7, r * 2.1, r * 2.1)); parts.push(piece(unitCyl, 0xff8a2a, x0 - r * 1.62, yy, zz, r * .12, r * 1.45, r * 1.45)); parts.push(piece(unitBox, 0x0e1014, x0 - r * .08, yy, zz, r * .16, r * 2.5, r * 2.5)) } // раструб сопла выступает из кормовой стенки блока
        else { parts.push(piece(unitCyl, 0x16181d, x0 - L * .06, yy, zz, L * .07, r * 2.1, r * 2.1)); parts.push(piece(unitCyl, 0x23262d, x0 - L * .105, yy, zz, L * .045, r * 2.5, r * 2.5)) } nozz.push({ z: zz, y: yy, r }) } }
    // 200 жёстких точек крепления по всему корпусу: сверху, снизу и с обоих бортов (грани 0 верх, 1 правый, 2 низ, 3 левый)
    // броневая обшивка: сетка секций по всем четырём граням без щелей; часть секций с отверстием (центральным или смещённым) под башни и малые модули
    const nT = (s.spec ? (s.spec.rails || 0) + (s.spec.flak || 0) + (s.spec.gat || 0) + (s.spec.lasers || 0) + (s.spec.miss || 0) : 40) || 1, smalls: { k: string; D: number }[] = [];
    { const sm = mp.smalls as any; for (const k of Object.keys(sm)) if (sm[k] > 0) { const n = k === 'rad' ? Math.max(1, Math.round(sm[k] / 700)) : 1; for (let i = 0; i < n; i++) smalls.push({ k, D: Math.max(sm[k] / n / TON_L, L * .002) }) } }
    const needH = Math.ceil((nT + smalls.length) * 1.5) + 4, tiles: any[] = [];
    // мелкие плиты: ячейка ≈ L/75, не больше ~2600 плит на корабль; слои кладутся в 3D друг на друга
    const area = Lk * (W + H) * 1.6, cellT = Math.max(L * .0105, Math.sqrt(area / 1800));
    const gridRows: number[] = [0, 0, 0, 0]; let gridCols = 2;
    for (let f = 0; f < 4; f++) {
      const fw = f % 2 === 0 ? W : H, cols = Math.max(2, Math.round(Lk / cellT)), rows = Math.max(1, Math.round(fw / cellT)); gridRows[f] = rows; gridCols = cols;
      for (let a = 0; a < cols; a++) { const x = x0 + (a + .5) * Lk / cols; if (RL && x < x0 + engLen) continue; let sg0 = seg[0]; for (const e of seg) if (Math.abs(e.cx - x) < Math.abs(sg0.cx - x)) sg0 = e; const dd = dimsAt(x), sg = { ...sg0, w: dd.w, h: dd.h, cy: dd.cy, c: dd.c || 0 };
        for (let b = 0; b < rows; b++) { const sw = (f % 2 === 0 ? sg.w : sg.h) - 2 * (sg.c || 0), off = (b + .5 - rows / 2) * (sw / rows);
          tiles.push({ ia: a, ib: b, f, px: x, py: f === 0 ? sg.cy + sg.h / 2 : f === 2 ? sg.cy - sg.h / 2 : sg.cy + off, pz: f === 1 ? sg.w / 2 : f === 3 ? -sg.w / 2 : off, len: Lk / cols, cs: sw / rows, c0: a / cols, c1: (a + 1) / cols, v: 0, wp: sg.weapon ? 1 : 0, sh: .85 + R() * .3, jit: R(), dx: (R() - .5) * .5, dz: (R() - .5) * .5 }) } }
    }
    const order = tiles.map((q, i) => i).filter(i => !(tiles[i].f === 0 && Math.abs(tiles[i].px - bx) < L * .06)).sort((a, b) => (tiles[b].wp - tiles[a].wp) + (R() - .5) * 1.4);
    const mounts: any[] = [], hole = new Set<number>(), rowsOf = (f: number) => gridRows[f];
    for (const i of order) { if (mounts.length >= needH) break; const q = tiles[i]; let ok = true; for (const m of mounts) if (m.face === q.f && Math.abs(m.x - q.px) < q.len * 1.6 && Math.hypot(m.y - q.py, m.z - q.pz) < cellT * 2.4) { ok = false; break } if (!ok) continue;
      hole.add(i); mounts.push({ x: q.px, y: q.py, z: q.pz, face: q.f, sm: false });
      // симметрия: зеркальная точка относительно оси корабля (борт 1↔3, крыша/днище — по z)
      if (Math.abs(q.pz) > cellT * .3) { const mf = q.f === 1 ? 3 : q.f === 3 ? 1 : q.f; const j = tiles.findIndex(t => t.f === mf && t.ia === q.ia && (q.f % 2 === 0 ? t.ib === rowsOf(q.f) - 1 - q.ib : t.ib === q.ib));
        if (j >= 0 && !hole.has(j)) { const t2 = tiles[j]; hole.add(j); mounts.push({ x: t2.px, y: t2.py, z: t2.pz, face: t2.f, sm: false }) } } }
    for (let i = tiles.length - 1; i >= 0; i--) if (hole.has(i)) tiles.splice(i, 1); // в дырах башни и малые модули стоят прямо на обшивке
    // малые модули берут первые отверстия: размер = масса / 50 т на метр
    const NRM = [[0, 1, 0], [0, 0, 1], [0, -1, 0], [0, 0, -1]];
    smalls.forEach((q, i) => { const m = mounts[i * 3 % Math.max(1, mounts.length)]; if (!m || m.sm) return; m.sm = true; const n = NRM[m.face], D = q.D, cx = m.x + n[0] * D * .5, cy = m.y + n[1] * D * .5, cz = m.z + n[2] * D * .5;
      const Dm = Math.min(D, L * .03), bx = m.x + n[0] * Dm * .22, by = m.y + n[1] * Dm * .22, bz = m.z + n[2] * Dm * .22, dm = (a: number, t: number) => (n[a] ? t : Dm);
      if (q.k === 'rad') { parts.push(piece(unitBox, 0x3a3f4a, bx, by, bz, dm(0, Dm * .44), dm(1, Dm * .44), dm(2, Dm * .44) * .6)); parts.push(piece(unitBox, 0xc9ced8, m.x + n[0] * Dm * .5, m.y + n[1] * Dm * .5, m.z + n[2] * Dm * .5, dm(0, Dm * .1), dm(1, Dm * .1), dm(2, Dm * .1))) }
      else parts.push(piece(unitBox, q.k === 'ew' ? P.acc2 : q.k === 'ir' ? 0x8a6a4a : q.k === 'sink' ? 0x707682 : 0x6a707c, bx, by, bz, dm(0, Dm * .44), dm(1, Dm * .44), dm(2, Dm * .44))) });
    for (const m of extraM) mounts.push(m);
    const cell = Math.sqrt(tiles.length ? tiles[0].len * tiles[0].cs : 1);
    const finV: any[] = []; { let o = 0, k = 0; for (let i = 0; i < parts.length && k < finI.length; i++) { const n = parts[i].attributes.position.count; if (finI[k].pi === i) { const f = finI[k++]; finV.push({ ...f, v0: o, n }) } o += n } }
    const g = mergeGeometries(parts, false)!; (g as any).userData = { finV, armorT: mp.armor, x1, x0v: x0, tiles, mounts, cell, nozz, W, H, x0, Lk, gridRows, gridCols, seg: seg.map(q => ({ cx: q.cx, top: q.cy + q.h / 2, w: q.w, len: q.len, h: q.h, cy: q.cy, col: q.col })) }; return g;
  }
  const flatCol = (g: THREE.BufferGeometry) => { const c = g.attributes.color as THREE.BufferAttribute, a = c.array as Float32Array; for (let t = 0; t + 8 < a.length; t += 9) { a[t + 3] = a[t]; a[t + 4] = a[t + 1]; a[t + 5] = a[t + 2]; a[t + 6] = a[t]; a[t + 7] = a[t + 1]; a[t + 8] = a[t + 2] } return g };
  const flashMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, opacity: .9, blending: THREE.AdditiveBlending, depthWrite: false });
  let sid = 1;
  // шаблон сечения: прямоугольник со срезанными углами (8 рёбер), 48 точек; u — вдоль высоты, v — вдоль ширины (−1..1)
  const RING: { u: number; v: number; nu: number; nv: number }[] = (() => { const C: number[][] = [[.5, 1], [-.5, 1], [-1, .5], [-1, -.5], [-.5, -1], [.5, -1], [1, -.5], [1, .5]], N: number[][] = [[0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1], [1, 0], [1, 1]], o: any[] = [];
    for (let e = 0; e < 8; e++) { const A = C[e], B = C[(e + 1) % 8], n = e % 2 ? 4 : 8; for (let m = 0; m < n; m++) { const t = m / n; o.push({ u: A[1] + (B[1] - A[1]) * t, v: A[0] + (B[0] - A[0]) * t, nu: N[e][1], nv: N[e][0] }) } } return o })();
  // текстура обшивки: панели со швами, заклёпки, царапины и потёртости (швы лежат по линиям u,v = .5, так что точка (0,0) нейтральна)
  const panelTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 256; const x = c.getContext('2d')!, rr = rng(777);
    x.fillStyle = '#d4d4d4'; x.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) { const v = 150 + rr() * 90; x.fillStyle = `rgba(${v},${v},${v},${.05 + rr() * .1})`; x.fillRect(rr() * 256, rr() * 256, 1 + rr() * 3, 1 + rr() * 3) }
    for (let i = 0; i < 40; i++) { x.strokeStyle = `rgba(255,255,255,${.04 + rr() * .08})`; x.lineWidth = 1; x.beginPath(); const ax = rr() * 256, ay = rr() * 256; x.moveTo(ax, ay); x.lineTo(ax + (rr() - .5) * 60, ay + (rr() - .5) * 60); x.stroke() }
    for (let i = 0; i < 7; i++) { const gx = rr() * 256, gy = rr() * 256, gr = 18 + rr() * 40, gg = x.createRadialGradient(gx, gy, 0, gx, gy, gr); gg.addColorStop(0, 'rgba(40,40,40,.22)'); gg.addColorStop(1, 'rgba(40,40,40,0)'); x.fillStyle = gg; x.fillRect(gx - gr, gy - gr, gr * 2, gr * 2) }
    x.fillStyle = 'rgba(25,25,25,.9)'; x.fillRect(0, 126, 256, 4); x.fillRect(126, 0, 4, 256); x.fillStyle = 'rgba(255,255,255,.35)'; x.fillRect(0, 130, 256, 1); x.fillRect(130, 0, 1, 256);
    x.fillStyle = 'rgba(30,30,30,.6)'; x.fillRect(0, 127, 256, 1);
    for (let i = 0; i < 256; i += 16) for (const q of [[i, 112], [i, 144], [112, i], [144, i]]) { x.fillStyle = 'rgba(30,30,30,.55)'; x.fillRect(q[0] + 6, q[1], 3, 3); x.fillStyle = 'rgba(255,255,255,.3)'; x.fillRect(q[0] + 6, q[1], 1, 1) }
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.anisotropy = 4; t.colorSpace = THREE.SRGBColorSpace; return t })();
  const hullMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .5, metalness: .32, flatShading: true, map: panelTex, bumpMap: panelTex, bumpScale: .9, envMapIntensity: 2.2 });
  // дальний LOD: один склеенный низкополигональный силуэт на сторону (единичной длины)
  const simpleGeo = PAL.map(P => mergeGeometries([
    piece(unitBox, P.main, -.11, 0, 0, .78, .1, .17), piece(taper(1, 1, 1, .3), P.main, .42, 0, 0, .22, .095, .15), piece(unitBox, P.dark, -.5, 0, 0, .06, .11, .18), piece(unitBox, P.acc2, .1, .08, 0, .07, .09, .09)], false)!);
  const glowMats = PAL.map(P => new THREE.MeshBasicMaterial({ color: P.glow }));

  // средний LOD: гладкий обобщённый корпус единичной длины (суперэллипс, нос, рубка, плавники, сопла)
  function loftUnit(P: any) {
    const NS = 18, pos: number[] = [], col: number[] = [], nrm: number[] = [], uv: number[] = [], idx: number[] = [], NR = RING.length;
    const cM = new THREE.Color(P.main), cD = new THREE.Color(P.dark);
    for (let i = 0; i <= NS; i++) { const t = i / NS, x = -.5 + 1.04 * t; let w = .17, h = .095;
      if (t < .12) { w *= .8; h *= .8 } else if (t < .5) { w *= .96 } if (t > .8) { const q = Math.min(1, (t - .8) / .2), k = Math.max(.06, 1 - q * .94); w *= k; h *= k }
      const c = i < 3 ? cD : (Math.floor(i / 3) % 2 ? cM : cM.clone().multiplyScalar(.8));
      for (let j = 0; j < NR; j++) { const r = RING[j]; pos.push(x, r.u * h / 2, r.v * w / 2); col.push(c.r, c.g, c.b); nrm.push(0, 1, 0); uv.push(0, 0) } }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a = i * NR + j, b = i * NR + (j + 1) % NR, c2 = (i + 1) * NR + j, d2 = (i + 1) * NR + (j + 1) % NR; idx.push(a, c2, b, b, c2, d2) }
    const g0 = new THREE.BufferGeometry(); g0.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g0.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3)); g0.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g0.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g0.setIndex(idx);
    const g1 = flatCol(g0.toNonIndexed()); g1.computeVertexNormals();
    return mergeGeometries([g1, piece(unitBox, P.dark, -.5, 0, 0, .05, .1, .17), piece(unitBox, P.acc2, .02, .075, 0, .06, .05, .08), piece(unitBox, P.glow, .02, .1, 0, .05, .008, .075),
      piece(taper(1, 1, 1, .2), shade2(P.dark, 1.1), -.36, 0, .1, .2, .008, .16), piece(taper(1, 1, 1, .2), shade2(P.dark, 1.1), -.36, 0, -.1, .2, .008, .16),
      piece(unitCyl, 0x16181d, -.53, 0, 0, .04, .06, .06)], false)!;
  }
  const shade2 = (c: number, f: number) => new THREE.Color(c).multiplyScalar(f).getHex();
  const midGeo = PAL.map(P => loftUnit(P));
  // сверхдетальный слой вблизи: линии панелей, окна, трубы, решётки, антенны, тарелки, полосы по бортам, форсуночные кольца
  function ultraGeo(s: any, u: any) {
    const P = PAL[s.side], R = rng((u.seed ^ 0x9e3779b9) >>> 0), L = u.L, parts: THREE.BufferGeometry[] = [], seg: any[] = u.seg || [], zA = ((s.zones && s.zones[0] && s.zones[0].arm) || 0) * thL(u) * 1.05, zS = ((s.zones && s.zones[1] && s.zones[1].arm) || 0) * thL(u) * 1.05, eps = L * .0012;
    const win = 0xffe9a8, dk = 0x15181e, gr = 0x59606d, wins: any[] = [];
    for (const g of seg) { const top = g.top + zA, wS = g.w / 2 + zS, n = Math.max(2, Math.round(g.len / (L * .028))), y0 = g.cy;
      for (const sd of [-1, 1]) { parts.push(piece(unitBox, P.acc2, g.cx, y0 - g.h * .12, sd * (wS + eps), g.len * .94, L * .004, eps * 1.4));
        // ряды иллюминаторов
        const nw = Math.max(3, Math.round(g.len / (L * .012))); for (let i = 0; i < nw; i++) if (R() < .85) { wins.push({ pi: parts.length, x: g.cx - g.len * .46 + (i + .5) * g.len * .92 / nw, sd, y: y0 + g.h * .1, cy: y0, h: g.h }); parts.push(piece(unitBox, R() < .9 ? win : P.glow, g.cx - g.len * .46 + (i + .5) * g.len * .92 / nw, y0 + g.h * .1, sd * (wS + eps), L * .0035, L * .0022, eps * 1.6)) } }
      // решётки вентиляции и трубопроводы
      if (R() < .7) { const vx = g.cx + (R() - .5) * g.len * .5, vz = (R() < .5 ? -1 : 1) * g.w * .22; parts.push(piece(unitBox, dk, vx, top + eps * .8, vz, L * .02, eps * 1.4, L * .014)); for (let k = 0; k < 4; k++) parts.push(piece(unitBox, gr, vx, top + eps * 1.6, vz - L * .006 + k * L * .004, L * .018, eps * .8, L * .0012)) }
    }
    // форсуночные кольца и колокола на корме
    // носовые маркировки
    for (let i = 0; i < 5; i++) parts.push(piece(unitBox, P.acc, u.x1 - L * .02 - i * L * .008, 0, (i % 2 ? 1 : -1) * L * .0005, L * .004, L * .0007, L * .014 + i * L * .002).translate(0, (u.H || L * .095) * .5 + zA + eps, 0));
    { let o = 0, k = 0; const wv: any[] = []; for (let i = 0; i < parts.length && k < wins.length; i++) { const n = parts[i].attributes.position.count; if (wins[k].pi === i) { wv.push({ v0: o, n, x: wins[k].x, sd: wins[k].sd, y: wins[k].y, cy: wins[k].cy, sh: wins[k].h, h: ((k * 2654435761) >>> 0) % 100 / 100 }); k++ } o += n } u.winV = wv }
    return parts.length ? mergeGeometries(parts, false)! : null;
  }
  // гибель корабля: корпус раскалывается на три секции, они расходятся, кувыркаются, горят и гаснут
  const wrecks: any[] = []; let wLast = 0;
  function makeWreck(g: THREE.Group, s: any) {
    const L = g.userData.L, sc = g.scale.x, nw = performance.now(), d0 = cam.position.distanceTo(g.position); dbg.mw = [d0, g.visible]; if (d0 > 4000 || !g.visible) { scene.remove(g); return }
    const cuts = [[-9, -.17], [-.17, .17], [.17, 9]], ch = (() => { const ud = g.userData, kids: any[] = []; g.traverse((o: any) => { if (o !== g && o.userData && Object.keys(o.userData).length) kids.push([o, o.userData]) }); g.userData = {}; kids.forEach(k => k[0].userData = {}); const r = [g, g.clone(true), g.clone(true)]; g.userData = ud; kids.forEach(k => k[0].userData = k[1]); return r })();
    ch.forEach((c, i) => { const pa = new THREE.Plane(), pb = new THREE.Plane();
      c.traverse((o: any) => { if (!o.isMesh || !o.material) return; const mm = Array.isArray(o.material) ? o.material : [o.material]; const cl = mm.map((m: any) => { if (!m.clone) return m; const q = m.clone(); q.clippingPlanes = [pa, pb]; q.needsUpdate = true; return q }); o.material = Array.isArray(o.material) ? cl : cl[0]; o.frustumCulled = false });
      if (i) scene.add(c); const ax = new THREE.Vector3(Math.random() - .5, Math.random() - .5, Math.random() - .5).normalize(), dir = new THREE.Vector3(1, 0, 0).applyQuaternion(g.quaternion);
      wrecks.push({ g: c, pa, pb, lo: cuts[i][0] * L, hi: cuts[i][1] * L, v: dir.clone().multiplyScalar((i - 1) * L * sc * .05).add(new THREE.Vector3((Math.random() - .5) * L * sc * .02, (Math.random() - .5) * L * sc * .03, (Math.random() - .5) * L * sc * .02)), ax, w: (Math.random() - .3) * .5 * (i === 1 ? .4 : 1), t0: nw, sc, L, nf: nw }) });
    for (let i = 0; i < 7; i++) { const lp = new THREE.Vector3((Math.random() - .5) * L, (Math.random() - .5) * L * .1, (Math.random() - .5) * L * .1); g.localToWorld(lp); flashes.push({ p: lp, t0: nw, life: 380 + i * 90 + Math.random() * 300, sz: 22 + Math.random() * 30 }) }
    for (let i = 0; i < 70; i++) { const dd = new THREE.Vector3().randomDirection(), sp = d0 * .07 * (.3 + Math.random()), lp = new THREE.Vector3((Math.random() - .5) * L, 0, 0); g.localToWorld(lp); sparks.push({ p: lp, v: dd.multiplyScalar(sp), t0: nw, life: 700 + Math.random() * 1400, h: Math.random() }) }
  }
  function stepWrecks(nw: number) {
    dbg.wr = wrecks.length; const dt = Math.min(.1, wLast ? (nw - wLast) / 1000 : .016); wLast = nw; const v1 = new THREE.Vector3(), v2 = new THREE.Vector3();
    for (let i = wrecks.length - 1; i >= 0; i--) { const w = wrecks[i], age = (nw - w.t0) / 1000, c = w.g;
      if (age > 14) { scene.remove(c); c.traverse((o: any) => { if (o.isMesh && o.material && o.material.clippingPlanes) { const mm = Array.isArray(o.material) ? o.material : [o.material]; mm.forEach((m: any) => m.dispose && m.dispose()) } }); wrecks.splice(i, 1); continue }
      c.position.addScaledVector(w.v, dt); c.rotateOnAxis(w.ax, w.w * dt); c.scale.setScalar(w.sc * (age > 11 ? Math.max(.01, 1 - (age - 11) / 3) : 1)); c.visible = true; c.updateMatrixWorld(true);
      v1.set(1, 0, 0).applyQuaternion(c.quaternion); v2.set(w.lo, 0, 0); c.localToWorld(v2); w.pa.setFromNormalAndCoplanarPoint(v1, v2); v2.set(w.hi, 0, 0); c.localToWorld(v2); w.pb.setFromNormalAndCoplanarPoint(v1.clone().negate(), v2);
      if (age < 9 && nw - w.nf > 160) { w.nf = nw; const lp = new THREE.Vector3((Math.random() - .5) * w.L * .3 + (w.lo > -5 ? (w.lo + (w.hi > 5 ? .3 * w.L : w.hi)) / 2 : (w.hi - .3 * w.L)), 0, (Math.random() - .5) * w.L * .08); c.localToWorld(lp); flashes.push({ p: lp, t0: nw, life: 260, sz: 10 + Math.random() * 14 }); sparks.push({ p: lp.clone(), v: new THREE.Vector3().randomDirection().multiplyScalar(cam.position.distanceTo(lp) * .03), t0: nw, life: 600, h: Math.random() }) } }
  }
  let builds = 0;
  function build(s: any) {
    const L = s.T.L, g = new THREE.Group(), seed = (sid++ * 2654435761) ^ Math.round(L * 1000);
    const dm0 = s._dims || (s._dims = shipDims(s)), body = new THREE.Mesh(simpleGeo[s.side], hullMat); body.scale.set(L, L * dm0.H / (L * .095), L * dm0.W / (L * .17)); g.add(body);
    g.userData = { s, L, lod: 0, seed, body, full: null, w: dm0.W, h: dm0.H, det: false, tur: new THREE.Group() }; g.add(g.userData.tur);
    const eng = new THREE.Group(); eng.name = 'eng'; eng.visible = false; g.add(eng); g.userData.eng = eng;
    scene.add(g); return g;
  }
  function setLod(s: any, g: THREE.Group, lod: number) { // 0 — силуэт, 1 — средний гладкий корпус, 2 — полный корпус (плиты, башни)
    const u = g.userData; if (u.lod === lod) return;
    if (lod === 2) {
      const stn = s.T.role === 'station' || (s.spec && s.spec.role === 'station'); // станции остаются со старым корпусом (кольцо, панели)
      if (stn && !u.full) {
       if (builds >= 3) return; builds++; u.full = hullGeo(s, u.seed); const ud = (u.full as any).userData; u.W = ud.W; u.H = ud.H; u.seg = ud.seg; u.mounts = ud.mounts; u.cell = ud.cell; u.armorT = ud.armorT; u.x1 = ud.x1; u.x0v = ud.x0v; u.tilesL = ud.tiles; u.Lk = ud.Lk; u.gridRows = ud.gridRows; u.gridCols = ud.gridCols; u.x0 = ud.x0;
        for (const n of ud.nozz) { const f = new THREE.Mesh(geoSph, glowMats[s.side]); f.scale.set(u.L * .02, n.r * 1.15, n.r * 1.15); f.position.set(ud.x0 - u.L * .17, n.y || 0, n.z); u.eng.add(f) }
      }
      if (!stn && !u.full) { if (builds >= 3) return; builds++; const lp = loftFor(s, u); u.lp = lp; u.full = lp.hull; u.W = lp.W; u.H = lp.H; u.seg = lp.seg; u.mounts = lp.mounts; u.cell = lp.W * .02; u.armorT = 0; u.x1 = lp.x1 - u.L * .05; u.x0v = lp.x0; u.tilesL = []; u.Lk = lp.Lk; u.gridRows = [1, 1, 1, 1]; u.gridCols = 2; u.x0 = lp.x0;
        for (const n of lp.nozz) { const f = new THREE.Mesh(geoSph, glowMats[s.side]); f.scale.set(u.L * .02, n.r * 1.15, n.r * 1.15); f.position.set(lp.x0 - u.L * .17, n.y || 0, n.z); u.eng.add(f) }
        const lx = new THREE.Group(); lx.name = 'lx'; if (lp.parts) lx.add(new THREE.Mesh(lp.parts, lp.partsMat)); if (lp.glow) lx.add(new THREE.Mesh(lp.glow, loftMats.glow)); if (lp.lines) lx.add(new THREE.LineSegments(lp.lines, loftMats.lines)); for (const d of lp.decals) lx.add(d.clone()); g.add(lx); u.lx = lx }
      u.body.geometry = u.full; u.body.material = u.lp ? (u.wmat || u.lp.mat) : hullMat; u.body.scale.setScalar(1); if (u.lx) u.lx.visible = true; if (u.fxg) u.fxg.visible = true;
    } else { if (u.lx) u.lx.visible = false; if (u.fxg) u.fxg.visible = false; u.body.material = hullMat; if (lod === 1) { u.body.geometry = midGeo[s.side]; u.body.scale.set(u.L, u.h / .095, u.w / .17) }
      else { u.body.geometry = simpleGeo[s.side]; u.body.scale.set(u.L, u.h / .095, u.w / .17) } }
    u.lod = lod;
  }
  const shTr = new Map<any, number[][]>(); let stepFreeze = false; let ultraBuilds = 0; // вблизи — слой мелких деталей поверх полного корпуса (строится лениво, по одному на кадр)
  function ultra(s: any, g: THREE.Group, want: boolean) {
    const u = g.userData; if (u.lp) return; if (!want) { if (u.ultra) u.ultra.visible = false; return } if (u.ultra) { u.ultra.visible = true; return } if (u.ultraTried || ultraBuilds >= 1 || !u.full) return; ultraBuilds++; u.ultraTried = true;
    const ge = ultraGeo(s, u); if (!ge) return; u.ultra = new THREE.Mesh(ge, hullMat); u.ultra.frustumCulled = false; g.add(u.ultra);
  }
  // износ деталей: окна гаснут и бьются, стабилизаторы и спонсоны отрываются рваным краем по мере попаданий
  const hsh = (v: number) => (Math.imul(v + 1, 2654435761) >>> 0) % 1000 / 1000;
  function wearParts(s: any, g: THREE.Group) {
    const u = g.userData, now = performance.now(); if (now - (u.wearT || 0) < 600) return; u.wearT = now; const vd = s.vd as any[], L = u.L;
    if (u.ultra && u.winV) { const ge2 = u.ultra.geometry as THREE.BufferGeometry, ca = ge2.attributes.color as THREE.BufferAttribute, arr = ca.array as Float32Array, pa2 = ge2.attributes.position as THREE.BufferAttribute, pr = pa2.array as Float32Array, sdt = u.shellData; let ch = false, chp = false;
      const peeled = (w: any) => { if (!u.tilesL || !sdt) return false; const f = w.sd > 0 ? 1 : 3, rows = u.gridRows[f], cols = u.gridCols, ia = Math.round((w.x - u.x0) / u.Lk * cols - .5), ib = Math.round((w.y - w.cy) / (w.sh / rows) + rows / 2 - .5), grid = sdt.grid[f];
        for (let da = -1; da <= 1; da++) { const ga = grid[Math.max(0, Math.min(cols - 1, ia + da))]; if (!ga) continue; for (let db = -1; db <= 1; db++) { const q = ga[Math.max(0, Math.min(rows - 1, ib + db))]; if (q && q.cur < q.n) return true } } return false };
      for (const w of u.winV) { if (w.gone) continue;
        if (peeled(w)) { w.gone = true; const x0 = pr[w.v0 * 3], y0 = pr[w.v0 * 3 + 1], z0 = pr[w.v0 * 3 + 2]; for (let i = 0; i < w.n; i++) { pr[(w.v0 + i) * 3] = x0; pr[(w.v0 + i) * 3 + 1] = y0; pr[(w.v0 + i) * 3 + 2] = z0 } chp = true; continue } // под сорванной бронёй окон нет — не висят в воздухе
        if (w.dead) continue; for (const d of vd) { const c = Math.cos(d.ang), sn = Math.sin(d.ang); if (Math.abs(c) < Math.abs(sn) * .7 || Math.sign(c) !== w.sd) continue; if (Math.abs(d.u * L - w.x) < L * (.01 + .012 * d.sz) && w.h < .85) { w.dead = true; const dark = w.h < .5 ? .025 : .09; for (let i = 0; i < w.n; i++) { arr[(w.v0 + i) * 3] = dark; arr[(w.v0 + i) * 3 + 1] = dark; arr[(w.v0 + i) * 3 + 2] = dark * 1.2 } ch = true; break } } }
      if (ch) ca.needsUpdate = true; if (chp) pa2.needsUpdate = true }
    const key = vd.length + ':' + vd[vd.length - 1].t0; if (u.wearK === key) return; u.wearK = key;
    const ge = u.full as THREE.BufferGeometry | undefined, fv = ge && (ge as any).userData.finV as any[]; if (!fv) return; const pa = ge!.attributes.position as THREE.BufferAttribute, ca2 = ge!.attributes.color as THREE.BufferAttribute; let ch2 = false;
    for (const f of fv) { if (!f.orig) { f.orig = new Float32Array(f.n * 3); f.oc = new Float32Array(f.n * 3); let a = 1e9, b = -1e9; for (let i = 0; i < f.n; i++) { f.orig[i * 3] = pa.getX(f.v0 + i); f.orig[i * 3 + 1] = pa.getY(f.v0 + i); f.orig[i * 3 + 2] = pa.getZ(f.v0 + i); f.oc[i * 3] = ca2.getX(f.v0 + i); f.oc[i * 3 + 1] = ca2.getY(f.v0 + i); f.oc[i * 3 + 2] = ca2.getZ(f.v0 + i); const o = f.sd * f.orig[i * 3 + 2]; if (o < a) a = o; if (o > b) b = o } f.o0 = a; f.o1 = b; f.ft = 0 }
      let cnt = 0; for (const d of vd) if (Math.abs(d.u * L - f.xc) < f.hl * 1.4) cnt += Math.sign(Math.cos(d.ang) || 1) === f.sd ? 1 : .4;
      const ft = Math.min(1, cnt / 9); if (Math.abs(ft - f.ft) < .08) continue; f.ft = ft; ch2 = true; const H = u.H || L * .095, cut = 1 - ft * .7, sp = f.o1 - f.o0 || 1;
      for (let i = 0; i < f.n; i++) { let x = f.orig[i * 3], y = f.orig[i * 3 + 1], z = f.orig[i * 3 + 2], dk = 1; const o = f.sd * z, t = (o - f.o0) / sp, h1 = hsh(f.v0 + i), h2 = hsh(f.v0 * 3 + i);
        if (t > cut) { const no = f.o0 + (cut + (t - cut) * .12) * sp; z = f.sd * no; y += (h1 - .5) * H * .3 * ft; x += (h2 - .5) * L * .035 * ft; dk = .3 } else if (t > cut * .6) { y += (h1 - .5) * H * .12 * ft; dk = .7 }
        pa.setXYZ(f.v0 + i, x, y, z); ca2.setXYZ(f.v0 + i, f.oc[i * 3] * dk, f.oc[i * 3 + 1] * dk, f.oc[i * 3 + 2] * dk) } }
    if (ch2) { pa.needsUpdate = true; ca2.needsUpdate = true }
  }
  // огонь и утечки на живом корабле: языки пламени из горящих отсеков, струи хладагента и пара из пробоин, искры
  const puffs: any[] = []; const MAXPUF = 900;
  function emitDamageFx(s: any, g: THREE.Group, app: number) {
    const u = g.userData, now = performance.now(); if (!u.seg || now - (u.fxT || 0) < 45 || app < .012) return; u.fxT = now; const L = u.L, Ls = u.L * g.scale.x, nrmL = [[0, 1, 0], [0, 0, 1], [0, -1, 0], [0, 0, -1]], vp = new THREE.Vector3(), vn = new THREE.Vector3(), sv = new THREE.Vector3(s.sx || 0, 0, s.sy || 0);
    const at = (x: number, f: number) => { let sg = u.seg[0]; for (const e of u.seg) if (Math.abs(e.cx - x) < Math.abs(sg.cx - x)) sg = e; const rw = (Math.random() - .5) * .8; return f === 0 ? vp.set(x, sg.cy + sg.h / 2, rw * sg.w) : f === 2 ? vp.set(x, sg.cy - sg.h / 2, rw * sg.w) : f === 1 ? vp.set(x, sg.cy + rw * sg.h, sg.w / 2) : vp.set(x, sg.cy + rw * sg.h, -sg.w / 2) };
    const push = (p: THREE.Vector3, v: THREE.Vector3, life: number, a: number, b: number, c: number[]) => { if (puffs.length >= MAXPUF) puffs.shift(); puffs.push({ p: p.clone(), v, t0: now, life, a, b, c }) };
    const wp = new THREE.Vector3(); let fires = 0;
    for (let zi = 0; zi < 4; zi++) { const lv = (s.fire && s.fire[zi]) || 0; if (!lv) continue; fires += lv;
      for (let k = 0; k < 1 + lv * 2; k++) { const x = u.x0 + (u.x1 - u.x0) * (.1 + Math.random() * .85); at(x, zi); g.localToWorld(wp.copy(vp)); const n = vn.set(nrmL[zi][0], nrmL[zi][1], nrmL[zi][2]).applyQuaternion(g.quaternion);
        const sp = Ls * (.012 + Math.random() * .02) * (1 + lv * .4); push(wp, n.clone().multiplyScalar(sp).add(new THREE.Vector3().randomDirection().multiplyScalar(sp * .35)).add(sv.clone().multiplyScalar(.5)), 700 + Math.random() * 900, Ls * (.012 + .008 * lv), Ls * (.04 + .024 * lv), Math.random() < .35 ? [1, .85, .35] : [1, .4 + Math.random() * .2, .08]) }
      if (Math.random() < .25 + lv * .15 && sparks.length < MAXSP - 30) { at(u.x0 + (u.x1 - u.x0) * Math.random(), zi); g.localToWorld(wp.copy(vp)); sparks.push({ p: wp.clone(), v: new THREE.Vector3().randomDirection().multiplyScalar(cam.position.distanceTo(wp) * .035), t0: now, life: 500 + Math.random() * 700, h: Math.random() }) } }
    // струи из пробоин: хладагент (белый), пар и раскалённый газ (оранжевый) бьют по нормали к корпусу
    const vd = s.vd as any[] | undefined; if (vd && vd.length) { const tries = Math.min(5, vd.length); for (let t = 0; t < tries; t++) { const d = vd[(Math.random() * vd.length) | 0]; if (!(d.k === 8 || d.k === 2 || d.k === 4 || d.k === 7 || d.k === 1)) continue; const age = Battle.time() - d.t0; if (age > 90) continue;
        const x = Math.max(-.5 * L, Math.min(.34 * L, d.u * L)); let sg = u.seg[0]; for (const e of u.seg) if (Math.abs(e.cx - x) < Math.abs(sg.cx - x)) sg = e; const c = Math.cos(d.ang), sn = Math.sin(d.ang), hw = sg.w / 2, hh = sg.h / 2, f = 1 / Math.max(Math.abs(c) / hw, Math.abs(sn) / hh, 1e-6), side = Math.abs(c) / hw > Math.abs(sn) / hh;
        wp.set(x, sg.cy + sn * f, c * f); g.localToWorld(wp); const n = (side ? vn.set(0, 0, Math.sign(c)) : vn.set(0, Math.sign(sn) || 1, 0)).applyQuaternion(g.quaternion), cool = d.k === 8, sp = Ls * (cool ? .05 : .03) * (.5 + Math.random());
        for (let j = 0; j < (cool ? 3 : 2); j++) push(wp, n.clone().multiplyScalar(sp).add(new THREE.Vector3().randomDirection().multiplyScalar(sp * (cool ? .18 : .3))).add(sv.clone().multiplyScalar(.5)), cool ? 900 + Math.random() * 900 : 500 + Math.random() * 600, Ls * (cool ? .004 : .005), Ls * (cool ? .016 : .02), cool ? [.7, .88, 1] : Math.random() < .5 ? [1, .55, .15] : [.8, .75, .7]) } }
  }
  const hashStr = (str: string) => { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) } return h >>> 0 };
  // корпус «по грузу»: форма и краска выводятся из состава проекта (двигатели, баки, ангары, орудия), одинаковые проекты делят геометрию
  function loftFor(s: any, u: any): LoftPack {
    const mp = massParts(s.spec || { rails: 10, flak: 2, tons: s.T.L * TON_L }), D0 = s._dims || (s._dims = shipDims(s)), spc = s.spec || {}, hasR = !spc.real || (spc.scList || []).length > 0 || spc.fcsN > 0 || spc.ew > 0;
    const inv: any = invFromSpec(s, mp, D0, PAL[s.side], 0, hasR, '00'), h = hashStr(JSON.stringify({ ...inv, col: 0 })); inv.seed = h % 997 + 3; inv.id = String(h % 90 + 10);
    return buildLoft(inv, u.L);
  }
  // пробоины на корпусе: геометрические вмятины + текстура раны + обломки и пар/огонь/хладагент/искры; рисуется инкрементально
  function loftWounds(s: any, g: THREE.Group, app: number) {
    const u = g.userData, lp = u.lp as LoftPack | undefined; if (!lp) return; const now = performance.now(), vd = (s.vd || []) as any[];
    if (u.fxg && u.lod === 2) { const dt = Math.min(.05, (now - (u.fxT2 || now)) / 1000); u.fxT2 = now; u.fxg.userData.uS.value = ren.domElement.height / (2 * Math.tan(cam.fov * Math.PI / 360)) * g.scale.x * lp.k; u.fxg.userData.upd(dt) }
    if (u.lod !== 2 || app < .04 || !vd.length || now - (u.wT || 0) < 600) return; u.wT = now;
    const key = vd.length + ':' + vd[vd.length - 1].t0; if (u.wK === key) return; u.wK = key;
    const sel: Map<number, any> = u.wSel || (u.wSel = new Map()), L0 = lp.L0, xmax = (lp.x1 / lp.k) * .97, xmin = -L0 * .48;
    for (const d of vd) { const id = Math.floor(d.r * 1e6) + 1; if (sel.has(id) || sel.size >= 24) continue;
      let sev = 0, cool = false, fire = false;
      if (d.k === 2 || d.k === 10) sev = .88; else if (d.k === 4 || d.k === 6) sev = .62; else if (d.k === 1 || d.k === 7) { sev = .45; fire = true } else if (d.k === 8) { sev = .45; cool = true } else continue;
      const x = Math.max(xmin, Math.min(xmax, d.u * L0)), r = Math.max(.008, Math.min(.045, .0042 * d.sz * (.7 + d.r * .6) * 1.6));
      sel.set(id, { id, x, v: faceV(lp, x * lp.k, d.ang), r, sev, cool, fire }) }
    if (sel.size === u.wN) return; u.wN = sel.size;
    if (!u.ownGeo) { const ge = lp.hull.clone(); u.li = { ...lp.li, geo: ge }; u.full = ge; u.body.geometry = ge; u.ownGeo = true }
    const hits = [...sel.values()]; u.wH = lp.wd.setHits(u.wH || [], hits, u.li);
    if (!u.wtex) { u.wtex = makeWoundTex(lp.wd.len, lp.wd.xmin, lp.wd.hh, lp.base); u.wmat = lp.mat.clone(); u.wtex.apply(u.wmat); u.body.material = u.wmat }
    for (const h of u.wH) u.wtex.draw(h);
    if (u.fxg) { g.remove(u.fxg); u.fxg.userData.dispose() } u.fxg = buildWoundFx(lp, hits); g.add(u.fxg);
  }
  const turCache = new Map<string, any>();
  function loftTurret(m: any, r: number, lp: LoftPack) {
    const tt = m.k === 'T' ? 'rail' : m.k === 'A' ? 'flak' : m.k === 'G' ? 'gat' : 'flak';
    const c = (m.cfg && m.cfg.cal) || 10, cal = c <= 8 ? 1 : c <= 14 ? 2 : 3, S = r * 3.4, key = tt + cal + ':' + lp.seedv + ':' + Math.round(S * 1e6);
    let q = turCache.get(key); if (!q) { q = turretGeo(tt, cal, lp.seedv, S); turCache.set(key, q); if (turCache.size > 60) turCache.delete(turCache.keys().next().value as string) } return q }
  function detail(s: any, g: THREE.Group, want: boolean) {
    const u = g.userData; if (u.det === want) return; u.det = want;
    const tg: THREE.Group = u.tur; while (tg.children.length) tg.remove(tg.children[0]); u.mods = []; u.turMap = new Map();
    if (!want) { if (u.arm) { for (const m of u.arm) { g.remove(m); m.dispose() } u.arm = null } return }
    const placed: any[] = [], free: any[] = (u.mounts || []).map((q: any) => ({ ...q, used: !!q.sm })), r = Math.max((u.cell || u.L * .02) * .42, .004);
    const N = [new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -1, 0), new THREE.Vector3(0, 0, -1)];
    // осевые орудия: вварены в носовую плиту лицом вперёд; первое по центру, остальные кругами к краям, не налезая друг на друга
    const axL: any[] = []; for (const z of s.zones) for (const m of z.mods) if (m.cfg && m.cfg.ax && 'TAGLM'.includes(m.k) && !(m.k === 'L' && m.cfg.dur)) axL.push(m);
    const axPos: any[] = (() => { const n = axL.length; if (!n) return []; const sg = (u.seg && u.seg[u.seg.length - 1]) || { w: u.W, h: u.H, cy: 0 }, Wn = sg.w * .62, Hn = sg.h * .62, cols = Math.max(1, Math.ceil(Math.sqrt(n * Wn / Math.max(1e-9, Hn)))), rows = Math.ceil(n / cols), pitch = Math.min(Wn / cols, Hn / rows), cells: any[] = [];
      for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) cells.push({ y: (sg.cy || 0) + (i - (rows - 1) / 2) * pitch, z: (j - (cols - 1) / 2) * pitch, pitch }); cells.sort((a, b) => Math.hypot(a.y, a.z) - Math.hypot(b.y, b.z) || a.z - b.z); return cells.slice(0, n) })();
    const xNose = (u.x1 != null ? u.x1 : u.L * .34) + u.L * .05;
    for (const z of s.zones) for (const m of z.mods) if ((m.k === 'T' || m.k === 'A' || m.k === 'G' || m.k === 'L' || m.k === 'M') && tg.children.length < 200) {
      if (m.k === 'L' && m.cfg && m.cfg.dur) { // боевой лазер встроен в центр корпуса: ствол по оси корабля, линза на носу
        if (!(g as any).userData.laser) { const Lh = u.L, kd = (() => { const a = (u.seg || []).filter((q: any) => q.w && q.len).sort((x: any, y: any) => Math.min(x.w, x.h) - Math.min(y.w, y.h)); return a.length ? Math.min(a[a.length >> 1].w, a[a.length >> 1].h) : Lh * .1 })(), r = Math.max(Math.min((m.cfg.lens || 20) / 1000 * .5, Lh * .12, kd * .36), kd * .34, Lh * .008), cD = (matDark as any).color.getHex(), cT = (matTur[s.side] as any).color.getHex();
          const cS = 0x9aa8bd, cS2 = 0x6f7d92, xm = Lh * .5 + r * 1.2, hp: THREE.BufferGeometry[] = [piece(geoCyl, cD, xm - Lh * .3, 0, 0, Lh * .6, r * .72, r * .72)];
          for (let i = 0; i < 6; i++) { const xx = xm - r * 1.2 - Lh * (.03 + i * .06); hp.push(piece(geoCyl, i % 2 ? cS2 : cS, xx, 0, 0, r * .42, r * 1.02, r * 1.02), piece(geoCyl, cT, xx + r * .3, 0, 0, r * .1, r * 1.08, r * 1.08)) } // фокусирующие кольца с цветными ободками
          for (const a of [0, 1.5708, 3.1416, 4.7124]) hp.push(piece(geoBox, cS2, xm - Lh * .1 - r, Math.sin(a) * r * .95, Math.cos(a) * r * .95, Lh * .16, r * (a % 3.1416 ? .18 : .5), r * (a % 3.1416 ? .5 : .18))); // рёбра охлаждения вдоль ствола
          hp.push(piece(geoCyl, cS, xm - r * .15, 0, 0, r * .7, r * 1.4, r * 1.4), piece(geoCyl, cD, xm + r * .1, 0, 0, r * .45, r * 1.15, r * 1.15), piece(geoCyl, cT, xm + r * .3, 0, 0, r * .16, r * 1.32, r * 1.32)); // раструб и оправа линзы
          for (const a of [.7854, 2.356, 3.927, 5.498]) hp.push(piece(geoBox, cS, xm - r * .2, Math.sin(a) * r * 1.4, Math.cos(a) * r * 1.4, r * 1.1, r * .22, r * .22)); // упоры-кронштейны
          const hm = new THREE.Mesh(mergeGeometries(hp, false)!, hullMat); g.add(hm);
          const ring = new THREE.Mesh(new THREE.TorusGeometry(r * 1.0, r * .07, 6, 20), new THREE.MeshBasicMaterial({ color: 0x4fc3ff, toneMapped: false })); ring.rotation.y = Math.PI / 2; ring.position.set(xm + r * .4, 0, 0); g.add(ring);
          const lens = new THREE.Mesh(geoSph, new THREE.MeshBasicMaterial({ color: 0x9fecff, toneMapped: false })); lens.scale.set(r * .3, r * .85, r * .85); lens.position.set(xm + r * .38, 0, 0); g.add(lens); (g as any).userData.laser = { lens, m } }
        continue }
      const axi = axL.indexOf(m), isAx = axi >= 0, f = isAx ? 0 : (m.face || 0), px = (m.u || 0) * u.L * .8; let best: any = null, bd = 1e18;
      if (isAx) { const c = axPos[axi]; if (!c) continue; best = { x: xNose, y: c.y, z: c.z } }
      else { for (const q of free) if (!q.used && q.face === f) { const d = (q.x - px) ** 2 + (Math.abs(q.z) + Math.abs(q.y)) ** 2 * .02 + (q.z > 0 ? 0 : u.L * u.L * 1e-7); if (d < bd) { bd = d; best = q } }
        if (!best) continue; best.used = true; placed.push(best) }
      const mass = m.k === 'T' ? ((RAIL_CAL as any)[(m.cfg && m.cfg.cal) || 10] || RAIL_CAL[10]).m * (1 + 1.03 * (((m.cfg && m.cfg.bar) || 1) - 1)) * 1.25 : m.k === 'A' ? 110 : m.k === 'G' ? 160 : m.k === 'M' ? 320 : 9000, r0 = Math.max(mass / TON_L * .55 / (isAx ? 3 : 1), u.L * .0025), r = isAx ? Math.min(r0, axPos[axi].pitch * .45) : r0; // диаметр башни = масса / 50 т на метр
      const t = new THREE.Group(), lift = r * .3, zA = isAx || (best && best.plat) ? 0 : (s.zones[f] || s.zones[0]).arm || 0, ped = Math.max(lift * 1.4, zA * thL(u) * 1.15); // стойка поднимает башню над бронёй
      const base = new THREE.Mesh(geoBox, matDark); base.scale.set(r * 1.8, ped, r * 1.8); base.position.y = ped / 2 - lift * .5; t.add(base);
      const head = new THREE.Group(); head.name = 'head'; head.position.y = ped - lift * 1.4; t.add(head); // голова башни: поворачивается по полусфере
      const nb = m.k === 'T' || (m.k === 'G' && m.cfg && m.cfg.tw) ? 2 : 1, tips: THREE.Object3D[] = [], hp: THREE.BufferGeometry[] = [], cD = (matDark as any).color.getHex(), cT = (matTur[s.side] as any).color.getHex();
      const tgm = u.lp ? loftTurret(m, r, u.lp) : null; if (tgm) { for (const tp0 of tgm.tips) { const tp = new THREE.Object3D(); tp.position.set(tp0.x, tp0.y + lift * .5, tp0.z); head.add(tp); tips.push(tp) } if (tgm.parts) head.add(new THREE.Mesh(tgm.parts, tgm.mat)); if (tgm.glow) head.add(new THREE.Mesh(tgm.glow, loftMats.glow)); if (tgm.lines) head.add(new THREE.LineSegments(tgm.lines, loftMats.lines)) }
      if (!tgm) hp.push(piece(geoDome, cT, 0, lift, 0, r * .95, r * .8, r * .95)); // сферическая башня + стволы одним мешем (меньше вызовов отрисовки)
      for (let b = 0; b < (tgm ? 0 : nb); b++) { const zb = (b - (nb - 1) / 2) * r * .55, len = r * 2.1; hp.push(piece(geoCyl, cD, r * .5 + len / 2, lift + r * .1, zb, len, r * .13, r * .13)); hp.push(piece(geoCyl, cD, r * .5 + len, lift + r * .1, zb, r * .22, r * .19, r * .19)); const tp = new THREE.Object3D(); tp.position.set(r * .5 + len + r * .12, lift + r * .1, zb); head.add(tp); tips.push(tp) }
      if (!tgm) { const hm = new THREE.Mesh(mergeGeometries(hp, false)!, hullMat); head.add(hm) }
      const fl = new THREE.Mesh(geoSph, flashMat); fl.scale.setScalar(r * .5); fl.position.copy(tips[0].position); fl.position.z = 0; fl.visible = false; head.add(fl);
      // основание ориентируем по нормали грани
      const nv = isAx ? new THREE.Vector3(1, 0, 0) : N[f]; t.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), nv); t.position.set(best.x - (isAx ? r * .6 : 0), best.y, best.z);
      (t as any).userData = { m, fl, head, ax: isAx, n: nv, r: r * 1.6, lr: 0, tips }; tg.add(t); u.mods.push(m); (u.turMap = u.turMap || new Map()).set(m, t);
    }
    buildTiles(s, g, placed);
  }
  // броня секциями: одна секция = 50 т; сплошные, с центральным и со смещёнными отверстиями; толщина по слоям и тает по мере разрушения
  const tileGeos: THREE.BufferGeometry[] = []; function tileGeo(v: number) {
    if (tileGeos[v]) return tileGeos[v]; let g: THREE.BufferGeometry;
    if (v === 0) g = new THREE.BoxGeometry(1, 1, 1); else { const HV2: [number, number][] = [[0, 0], [.22, .2], [-.22, -.2], [.22, -.2]], [hx, hz] = HV2[v - 1], sh = new THREE.Shape(), hs = .34;
      sh.moveTo(-.5, -.5); sh.lineTo(.5, -.5); sh.lineTo(.5, .5); sh.lineTo(-.5, .5); sh.lineTo(-.5, -.5); const ho = new THREE.Path(); ho.moveTo(hx - hs / 2, hz - hs / 2); ho.lineTo(hx - hs / 2, hz + hs / 2); ho.lineTo(hx + hs / 2, hz + hs / 2); ho.lineTo(hx + hs / 2, hz - hs / 2); ho.lineTo(hx - hs / 2, hz - hs / 2); sh.holes.push(ho);
      g = new THREE.ExtrudeGeometry(sh, { depth: 1, bevelEnabled: true, bevelThickness: .03, bevelSize: .015, bevelSegments: 1 }); g.translate(0, 0, -.5); g.rotateX(Math.PI / 2) }
    return (tileGeos[v] = g) }
  const tileMat = new THREE.MeshStandardMaterial({ roughness: .6, metalness: .35, flatShading: true });
  const thL = (u: any) => { const arm = (u.s && u.s.zones && u.s.zones[0] && u.s.zones[0].arm) || 1, n = Math.max(1, Math.min(10, Math.round(arm))); return Math.max(.001, Math.min(u.L * .0034 * Math.max(1, Math.min(8, arm / 10)), u.L * .03 / n)) }; // толщина слоя (преувеличена, чтобы слои были видны)
  function buildTiles(s: any, g: THREE.Group, _placed: any[]) {
    const u = g.userData; if (u.arm) { for (const m of u.arm) { g.remove(m); m.dispose() } u.arm = null } if (!u.tilesL || !u.tilesL.length) return;
    const tiles = u.tilesL as any[], PALc = PAL[s.side]; let cnt = 0; u.arm = []; const col = new THREE.Color();
    for (const q of tiles) { q.n = Math.max(1, Math.min(10, Math.round((s.zones[q.f] || s.zones[0]).arm || 1))); cnt += q.n; q.cur = q.n; q.dirty = true }
    const im = new THREE.InstancedMesh(tileGeo(0), tileMat, cnt); im.frustumCulled = false; im.visible = false; u.arm.push(im); g.add(im); let k = 0;
    for (const q of tiles) { q.ent = []; for (let l = 0; l < q.n; l++) { q.ent.push(k); im.setColorAt(k++, col.set(q.f === 0 ? PALc.main : PALc.dark).multiplyScalar(q.sh * (q.f === 0 ? 1.15 : 1.5) * (.82 + ((l * 7 + (q.jit * 9 | 0)) % 5) * .07))) } }
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    u.armT = 0; updateTiles(s, g, true); u.shellDirty = true;
  }
  const _m4 = new THREE.Matrix4(), _p = new THREE.Vector3(), _q = new THREE.Quaternion(), _sc = new THREE.Vector3();
  const _cc = new THREE.Color(), _bq = new THREE.Quaternion(), _bd = new THREE.Vector3(); const _qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
  const NRL = [[0, 1, 0], [0, 0, 1], [0, -1, 0], [0, 0, -1]], NS = [1, 1, -1, -1], LS = [1, -1, 1, -1]; let tdDec: THREE.InstancedMesh; const MAXDD = 700;
  // след лежит на верхнем слое конкретной плиты: ищем плиту под ним и запоминаем смещение внутри неё
  function attachDecal(u: any, d: any, x: number, yy: number, zz: number, nrm: THREE.Vector3, m: number) {
    const f = nrm.y > 0 ? 0 : nrm.y < 0 ? 2 : nrm.z > 0 ? 1 : 3, lat = f % 2 ? yy : zz; let best: any = null, bd = 1e18;
    for (const q of u.tilesL as any[]) { if (q.f !== f || q.cur < 1) continue; const dx = q.px - x, dz = (f % 2 ? q.py : q.pz) - lat, dd = dx * dx + dz * dz; if (dd < bd) { bd = dd; best = q } }
    if (!best) return null; const l = best.cur - 1, lp = layerPos(best, l, thL(u), new THREE.Vector3()), mm = Math.min(m, Math.min(best.len, best.cs) * .46), hx = best.len * .5 - mm, hz = best.cs * .5 - mm;
    return { q: best, l, ox: Math.max(-hx, Math.min(hx, x - lp.x)), oz: Math.max(-hz, Math.min(hz, lat - (f % 2 ? lp.y : lp.z))), dead: false, rz: 0, sc: new THREE.Vector3(), col: new THREE.Color() } }
  function decalPos(a: any, th: number, out: THREE.Vector3) { layerPos(a.q, a.l, th, out); const f = a.q.f, nr = NRL[f]; out.x += a.ox; if (f % 2) out.y += a.oz; else out.z += a.oz; out.x += nr[0] * th * .54; out.y += nr[1] * th * .54; out.z += nr[2] * th * .54; return out }
  // положение слоя l плитки q в системе корабля (кирпичная кладка: слои сдвинуты друг относительно друга)
  function layerPos(q: any, l: number, th: number, out: THREE.Vector3) {
    const c = (l + .5) * th, sx = q.dx * q.len * (l % 2 ? 1 : -1) * .5, sz = q.dz * q.cs * (l % 2 ? -1 : 1) * .5;
    if (q.f === 0) out.set(q.px + sx, q.py + c, q.pz + sz); else if (q.f === 2) out.set(q.px + sx, q.py - c, q.pz + sz);
    else if (q.f === 1) out.set(q.px + sx, q.py + sz, q.pz + c); else out.set(q.px + sx, q.py + sz, q.pz - c); return out }
  // плита сорвана: тот же размер, цвет и место, что были на корпусе; отлетает по нормали и кувыркается
  function spawnLayerDebris(s: any, g: THREE.Group, q: any, l: number, org?: THREE.Vector3) {
    dbg.sp = (dbg.sp || 0) + 1; const u = g.userData, th = thL(u), lp = layerPos(q, l, th, new THREE.Vector3()); g.updateMatrixWorld(true);
    const pos0 = org ? org.clone() : g.localToWorld(lp), nr = NRL[q.f], nrW = new THREE.Vector3(nr[0], nr[1], nr[2]).applyQuaternion(g.quaternion);
    const qq0 = g.quaternion.clone(); if (q.f % 2) qq0.multiply(_qx);
    const dec: any[] = []; for (const d of (s.vd || []) as any[]) { const a = d.a3; if (a && !a.dead && a.q === q && a.l === l) { a.dead = true; const lq = new THREE.Quaternion().setFromUnitVectors(_zv, new THREE.Vector3(0, NS[q.f], 0)); if (a.rz) lq.multiply(_qz.setFromAxisAngle(_zv, a.rz)); dec.push({ ox: a.ox, oz: a.oz * LS[q.f], ny: NS[q.f] * th * .54, lq, sc: a.sc.clone(), col: a.col.clone() }) } }
    // 1–4 осколка разного размера, вылетают из точки попадания; крупные иногда раскалываются пополам
    const np = 1 + (Math.random() < .6 ? 1 : 0) + (Math.random() < .35 ? 1 : 0) + (Math.random() < .15 ? 1 : 0), mean = (q.len + q.cs) / 2;
    for (let i = 0; i < np; i++) { if (tdeb.length >= MAXTD) tdeb.shift(); const mul = i === 0 ? .7 + Math.random() * .8 : .25 + Math.random() * .7, sp = u.L * (.008 + Math.random() * .035);
      const v = nrW.clone().multiplyScalar(sp).add(new THREE.Vector3().randomDirection().multiplyScalar(sp * .8)); v.x += s.sx || 0; v.z += s.sy || 0;
      const split = i === 0 && mul > 1 && Math.random() < .5, pieces = split ? 2 : 1;
      for (let k = 0; k < pieces; k++) { const vv = split ? v.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(sp * .5)) : v, m2 = split ? mul * (.5 + Math.random() * .3) : mul;
        tdeb.push({ p: pos0.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(mean * .5)), v: vv, q: qq0.clone().multiply(new THREE.Quaternion().random()), w: new THREE.Vector3().randomDirection().multiplyScalar((Math.random() + .3) * .9), sz: new THREE.Vector3(mean * m2 * (.7 + Math.random() * .8), Math.max(th * 1.2, mean * m2 * (.3 + Math.random() * .6)), mean * m2 * (.6 + Math.random() * .9)), t0: performance.now(), life: 9000 + Math.random() * 5000, side: s.side, f: q.f, dec: i === 0 && k === 0 ? dec : undefined }) } }
  }
  // попадание снимает верхний слой с одной (или нескольких соседних) плит ровно там, куда ударил снаряд
  const _hp = new THREE.Vector3(), _hd = new THREE.Vector3(), _iq = new THREE.Quaternion();
  function peelAt(g: THREE.Group, s: any, imp: any) {
    const u = g.userData, tiles = u.tilesL as any[]; if (!tiles || !u.arm) return; g.updateMatrixWorld(true);
    g.worldToLocal(_hp.set(imp.x, imp.z, imp.y)); _hd.set(imp.nx, 0, imp.ny).applyQuaternion(_iq.copy(g.quaternion).invert()).normalize(); let f = 0, bd = -2;
    for (let i = 0; i < 4; i++) { const d = _hd.x * NRL[i][0] + _hd.y * NRL[i][1] + _hd.z * NRL[i][2]; if (d > bd) { bd = d; f = i } }
    const cs = tiles[0].len, lat = (q: any) => f % 2 === 0 ? q.pz : q.py, hl = f % 2 === 0 ? _hp.z : _hp.y, k = 1 + Math.floor((imp.pw || 1) / 4), cand: { q: any; d: number }[] = [];
    const jx = (Math.random() - .5) * cs * 2, jl = (Math.random() - .5) * cs * 2;
    for (const q of tiles) if (q.f === f && q.cur > 0) cand.push({ q, d: Math.hypot(q.px - _hp.x - jx, lat(q) - hl - jl) });
    cand.sort((a, b) => a.d - b.d);
    let res: any = null;
    for (let i = 0; i < Math.min(k, cand.length); i++) { const q = cand[i].q; q.cur--; q.dirty = true;
      if (!res) { const th = thL(u), lp = layerPos(q, q.cur, th, new THREE.Vector3()), nr = NRL[q.f]; lp.x += nr[0] * th * .5; lp.y += nr[1] * th * .5; lp.z += nr[2] * th * .5; res = { pos: g.localToWorld(lp), nrm: new THREE.Vector3(nr[0], nr[1], nr[2]).applyQuaternion(g.quaternion) } }
      spawnLayerDebris(s, g, q, q.cur, res.pos) }
    u.armT = 0; return res;
  }

  // ===== окружение боя: астероиды, планета (с кольцом), станция =====
  let rockMesh: THREE.InstancedMesh | null = null, beltMesh: THREE.InstancedMesh | null = null; const envObj = new Map<any, THREE.Object3D>(); const MAXR = 700;
  function cvTex(w: number, h: number, draw: (g: CanvasRenderingContext2D) => void) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d')!); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = THREE.RepeatWrapping; return t }
  function makePlanet(e: any) {
    const g = new THREE.Group(), hue = (Math.abs(e.x * 7 + e.y * 3) % 1);
    const tex = cvTex(512, 256, c => { const gr = c.createLinearGradient(0, 0, 0, 256); gr.addColorStop(0, '#6f86a8'); gr.addColorStop(.5, '#a8906c'); gr.addColorStop(1, '#4d5d7a'); c.fillStyle = gr; c.fillRect(0, 0, 512, 256);
      for (let i = 0; i < 90; i++) { c.globalAlpha = .12 + Math.random() * .12; c.fillStyle = Math.random() < .5 ? '#d9c8a4' : '#34415a'; const y = Math.random() * 256, h = 3 + Math.random() * 14; c.fillRect(0, y, 512, h) }
      for (let i = 0; i < 40; i++) { c.globalAlpha = .1; c.fillStyle = '#fff'; c.beginPath(); c.ellipse(Math.random() * 512, Math.random() * 256, 10 + Math.random() * 40, 3 + Math.random() * 8, 0, 0, 6.283); c.fill() } });
    const body = new THREE.Mesh(new THREE.SphereGeometry(e.r, 64, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: .9, metalness: 0 })); g.add(body);
    const atm = new THREE.Mesh(new THREE.SphereGeometry(e.r * 1.03, 48, 32), new THREE.MeshBasicMaterial({ color: 0x7fb4ff, transparent: true, opacity: .13, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(atm);
    if (e.ring) { const rt = cvTex(512, 4, c => { for (let x = 0; x < 512; x++) { const a = .25 + .5 * Math.abs(Math.sin(x * .09) * Math.sin(x * .031 + 1)) + (Math.random() * .15); c.fillStyle = `rgba(${190 + (x % 40)},${170 + (x % 25)},${140},${Math.min(.85, a)})`; c.fillRect(x, 0, 1, 4) } }); const rg = new THREE.RingGeometry(e.ring[0], e.ring[1], 128, 1), pos = rg.attributes.position, uv = rg.attributes.uv;
      for (let i = 0; i < pos.count; i++) uv.setXY(i, (Math.hypot(pos.getX(i), pos.getY(i)) - e.ring[0]) / (e.ring[1] - e.ring[0]), .5);
      const ring = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ map: rt, transparent: true, side: THREE.DoubleSide, depthWrite: false, opacity: .8 })); ring.rotation.x = -Math.PI / 2; g.add(ring) }
    g.userData.spin = body; void hue; return g
  }
  function makeStation(e: any) {
    const g = new THREE.Group(), r = e.r, mat = new THREE.MeshStandardMaterial({ color: 0x8b95a6, roughness: .5, metalness: .6, flatShading: true }), dark = new THREE.MeshStandardMaterial({ color: 0x3a4150, roughness: .6, metalness: .5, flatShading: true }), glow = new THREE.MeshBasicMaterial({ color: 0xffe9a8 });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(r * .13, r * .13, r * .95, 16), mat); g.add(hub);
    for (const sy of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(r * .07, r * .17, r * .12, 16), dark); cap.position.y = sy * r * .52; if (sy < 0) cap.rotation.x = Math.PI; g.add(cap) }
    const ring = new THREE.Mesh(new THREE.TorusGeometry(r * .72, r * .075, 10, 48), mat); ring.rotation.x = Math.PI / 2; g.add(ring);
    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(r * .72, r * .02, 6, 48), glow); ring2.rotation.x = Math.PI / 2; ring2.position.y = r * .075; g.add(ring2);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3, sp = new THREE.Mesh(new THREE.BoxGeometry(r * .72, r * .03, r * .03), dark); sp.position.set(Math.cos(a) * r * .36, 0, Math.sin(a) * r * .36); sp.rotation.y = -a; g.add(sp) }
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + .4, pan = new THREE.Mesh(new THREE.BoxGeometry(r * .5, r * .01, r * .22), new THREE.MeshStandardMaterial({ color: 0x24456e, roughness: .3, metalness: .7 })); pan.position.set(Math.cos(a) * r * .95, r * .36 * (i % 2 ? 1 : -1), Math.sin(a) * r * .95); pan.rotation.y = -a + Math.PI / 2; g.add(pan) }
    for (let i = 0; i < 3; i++) { const dk = new THREE.Mesh(new THREE.BoxGeometry(r * .2, r * .06, r * .06), dark); const a = i * 2.1; dk.position.set(Math.cos(a) * (r * .72 + r * .12), 0, Math.sin(a) * (r * .72 + r * .12)); dk.rotation.y = -a; g.add(dk) }
    g.rotation.x = .25; return g
  }
  function updateEnv() {
    const list = (Battle.env && Battle.env() as any[]) || [], rocks = list.filter(e => e.t === 'rock' || e.t === 'debris'), seen = new Set<any>();
    if (!rockMesh) { const ge = new THREE.IcosahedronGeometry(1, 1), pp = ge.attributes.position; for (let i = 0; i < pp.count; i++) { const k = 1 + .28 * Math.sin(pp.getX(i) * 4.1 + pp.getY(i) * 3.3) * Math.cos(pp.getZ(i) * 3.7); pp.setXYZ(i, pp.getX(i) * k, pp.getY(i) * k * .85, pp.getZ(i) * k) } ge.computeVertexNormals();
      rockMesh = new THREE.InstancedMesh(ge, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: .05, flatShading: true }), MAXR); rockMesh.frustumCulled = false; rockMesh.setColorAt(0, new THREE.Color(1, 1, 1)); scene.add(rockMesh) }
    { const big = rocks.length >= 60; if (big && !beltMesh) { // пояс астероидов вокруг системы: толстая оболочка на тысячи километров во все стороны
        const ge = rockMesh.geometry, N = 7000; beltMesh = new THREE.InstancedMesh(ge, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: .95, metalness: .05, flatShading: true }), N); beltMesh.frustumCulled = false; const col = new THREE.Color(), q = new THREE.Quaternion(), e3 = new THREE.Euler();
        for (let i = 0; i < N; i++) { const R0 = 160 + Math.pow(Math.random(), .8) * 3600, th = Math.random() * 6.283, ph = Math.acos(2 * Math.random() - 1), yy = Math.cos(ph) * R0 * .7, rr = R0 * Math.sin(ph); const sz = (1.2 + Math.random() * Math.random() * 9) * (1 + R0 / 900); dummy.position.set(Math.cos(th) * rr, yy, Math.sin(th) * rr); dummy.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); dummy.scale.set(sz * (.7 + Math.random() * .6), sz * .8, sz); dummy.updateMatrix(); beltMesh.setMatrixAt(i, dummy.matrix); const sh = .45 + Math.random() * .55; beltMesh.setColorAt(i, col.setRGB(.42 * sh, .37 * sh, .33 * sh)) }
        void q; void e3; scene.add(beltMesh) }
      if (beltMesh) beltMesh.visible = big }
    let k = 0; const nw = performance.now() / 1000;
    for (const e of rocks) { if (k >= MAXR) break; if (e._s == null) e._s = Math.random() * 100; dummy.position.set(e.x, (e._s % 1 - .5) * (30 + e.r * 3), e.y); dummy.rotation.set(e._s, e._s * 1.7 + nw * .03 * (1 + e._s % 2), e._s * .6); dummy.scale.set(e.r * (1 + e._s % .3), e.r, e.r * (1.1 - e._s % .2)); dummy.updateMatrix(); rockMesh.setMatrixAt(k, dummy.matrix);
      const sh = .55 + (e._s % 1) * .5; rockMesh.setColorAt(k, _cc2.setRGB(.42 * sh, .37 * sh, .33 * sh).multiplyScalar(e.t === 'debris' ? .7 : 1)); k++ }
    rockMesh.count = k; rockMesh.instanceMatrix.needsUpdate = true; if (rockMesh.instanceColor) rockMesh.instanceColor.needsUpdate = true;
    for (const e of list) { if (e.t !== 'planet' && e.t !== 'station') continue; seen.add(e); let o = envObj.get(e); if (!o) { o = e.t === 'planet' ? makePlanet(e) : makeStation(e); o.position.set(e.x, e.t === 'planet' ? -e.r * .02 : 0, e.y); scene.add(o); envObj.set(e, o) }
      if (e.t === 'station') o.rotation.y += .0015; else if (o.userData.spin) o.userData.spin.rotation.y += .0003 }
    for (const [e, o] of envObj) if (!seen.has(e)) { scene.remove(o); envObj.delete(e) }
  }
  const _cc2 = new THREE.Color();
  const streaks: any[] = []; // последний отрезок трассера: долетает до корпуса и гаснет на плите

  // ЛИТАЯ ОБШИВКА: гладкая оболочка поверх ядра корпуса. Высота над ядром в каждой точке = число оставшихся слоёв брони × толщина слоя.
  // Попадания снимают слои по одному (логика плит осталась прежней) — вмятина углубляется и расширяется метр за метром, пока не дойдёт до основного корпуса.
  const shellMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .52, metalness: .45, flatShading: true });
  let shellBuilds = 0;
  function tileInit(s: any, u: any) { for (const q of u.tilesL as any[]) if (q.n === undefined) { const z = s.zones[q.f] || s.zones[0]; q.n = Math.max(1, Math.min(10, Math.round(z.arm || 1))); q.cur = q.n;
      const nc = z.nc, i0 = Math.floor(q.c0 * nc), i1 = Math.max(i0 + 1, Math.floor(q.c1 * nc)); let sum = 0; for (let k = i0; k < i1; k++) sum += z.cols[k]; q.cur = Math.max(0, Math.min(q.n, Math.floor(sum / (i1 - i0) + q.jit))); q.dirty = true } }
  function shell(s: any, g: THREE.Group, want: boolean) {
    const u = g.userData; if (!want) { if (u.shell) u.shell.visible = false; return } if (!u.full || !u.tilesL || !u.tilesL.length || !u.seg) return;
    if (!u.shell) { if (shellBuilds >= 1) return; shellBuilds++; buildShell(s, g, u) } u.shell.visible = true;
    const now = performance.now(); if (u.shellDirty && now - (u.shellT || 0) > 90) { u.shellT = now; u.shellDirty = false; updateShell(s, u) }
  }
  function buildShell(s: any, g: THREE.Group, u: any) {
    tileInit(s, u); const L = u.L, seg: any[] = u.seg, xe = u.x1 + L * .05, x0 = u.x0, Lk = u.Lk, cols = u.gridCols, rowsF: number[] = u.gridRows, NR = RING.length, NS = Math.min(170, Math.ceil((xe - x0) / (Lk / cols) * 2)), nv = (NS + 1) * NR;
    const dimsAt = (xx: number) => { const q = seg; let i = 0; while (i < q.length - 1 && xx > (q[i].cx + q[i + 1].cx) / 2) i++; return q[i] };
    const pos = new Float32Array(nv * 3), col = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), uv = new Float32Array(nv * 2), base = new Float32Array(nv * 3), dir = new Float32Array(nv * 3), map = new Float32Array(nv * 5), paint = new Float32Array(nv * 3), idx: number[] = [];
    const c = new THREE.Color();
    for (let i = 0; i <= NS; i++) { const xx = x0 + (xe - x0) * i / NS, d: any = dimsAt(Math.min(xx, u.x1)); let k = 1; if (xx > u.x1) { const t = Math.min(1, (xx - u.x1) / (xe - u.x1)); k = 1 - t * .4 }
      c.set(d.col || 0x5b86a8);
      for (let j = 0; j < NR; j++) { const v = i * NR + j, r = RING[j], hh = d.h / 2 * k, ww = d.w / 2 * k, y = d.cy + r.u * hh, z = r.v * ww;
        base[v * 3] = xx; base[v * 3 + 1] = y; base[v * 3 + 2] = z;
        let ny = r.nu / Math.max(1e-9, hh), nz = r.nv / Math.max(1e-9, ww); const nl = Math.hypot(ny, nz) || 1; ny /= nl; nz /= nl; dir[v * 3] = 0; dir[v * 3 + 1] = ny; dir[v * 3 + 2] = nz;
        const f = Math.abs(r.u) >= Math.abs(r.v) ? (r.u > 0 ? 0 : 2) : (r.v > 0 ? 1 : 3);
        const lat = (f % 2 === 0 ? r.v : r.u) * .5;
        const af = (xx - x0) / Lk * cols - .5, bf = (lat + .5) * rowsF[f] - .5;
        map[v * 5] = f; map[v * 5 + 1] = xx <= u.x1 && xx >= x0 ? af : -999; map[v * 5 + 2] = bf; map[v * 5 + 3] = d.cy; map[v * 5 + 4] = k;
        // панельная окраска: плиты 3×3 клетки чуть разного тона, швы темнее
        const pa = Math.floor(af / 3), pb = Math.floor(bf / 3), hs = ((pa * 73856093) ^ (pb * 19349663) ^ (f * 83492791)) >>> 0, seam = (Math.floor(af) % 3 === 0 || Math.floor(bf) % 3 === 0) ? .86 : 1, sh = seam * (.9 + (hs % 100) / 500);
        paint[v * 3] = c.r * sh; paint[v * 3 + 1] = c.g * sh; paint[v * 3 + 2] = c.b * sh;
        pos[v * 3] = xx; pos[v * 3 + 1] = y; pos[v * 3 + 2] = z; col[v * 3] = paint[v * 3]; col[v * 3 + 1] = paint[v * 3 + 1]; col[v * 3 + 2] = paint[v * 3 + 2] } }
    for (let i = 0; i < NS; i++) for (let j = 0; j < NR; j++) { const a = i * NR + j, b = i * NR + (j + 1) % NR, c2 = (i + 1) * NR + j, d2 = (i + 1) * NR + (j + 1) % NR; idx.push(a, c2, b, b, c2, d2) }
    const nT = idx.length, ge = new THREE.BufferGeometry(); ge.setAttribute('position', new THREE.BufferAttribute(new Float32Array(nT * 3), 3)); ge.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(nT * 3), 3)); ge.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(nT * 2), 2)); ge.setAttribute('color', new THREE.BufferAttribute(new Float32Array(nT * 3), 3));
    const grid: any[][][] = [0, 1, 2, 3].map(() => []); for (const q of u.tilesL as any[]) { (grid[q.f][q.ia] || (grid[q.f][q.ia] = []))[q.ib] = q }
    // трещины: ломаные с острыми изломами по краям вмятин
    const CR = 5000, cg = new THREE.BufferGeometry(); cg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(CR * 6), 3)); cg.setDrawRange(0, 0);
    const cl = new THREE.LineSegments(cg, new THREE.LineBasicMaterial({ color: 0x060606 })); cl.frustumCulled = false;
    const m = new THREE.Mesh(ge, shellMat); m.frustumCulled = false; m.add(cl); g.add(m); u.shell = m; u.shellData = { base, dir, map, paint, grid, nv, NS, NR, cl, CR, idx, pv: pos, dmv: new Float32Array(nv) }; u.shellDirty = true; updateShell(s, u);
  }
  function updateShell(s: any, u: any) {
    const sd = u.shellData, m = u.shell as THREE.Mesh, ge = m.geometry, gp = ge.attributes.position.array as Float32Array, gc = ge.attributes.color.array as Float32Array, th = thL(u), { base, dir, map, paint, grid, nv, cl, CR, idx, pv: pos, dmv } = sd, rowsF: number[] = u.gridRows, cols = u.gridCols;
    const tv = (f: number, a: number, b: number) => { const ga = grid[f][Math.max(0, Math.min(cols - 1, a))]; if (!ga) return 1; const q = ga[Math.max(0, Math.min(rowsF[f] - 1, b))]; return q ? Math.max(0, q.cur) / q.n : 1 }; // доля оставшейся брони
    const nQ = (f: number) => { const z = s.zones[f] || s.zones[0]; return Math.max(1, Math.min(10, Math.round(z.arm || 1))) };
    const nF = [nQ(0), nQ(1), nQ(2), nQ(3)], cp = cl.geometry.attributes.position.array as Float32Array, cell = u.cell || th * 6; let ns = 0;
    for (let v = 0; v < nv; v++) { const f = map[v * 5] | 0, af = map[v * 5 + 1]; let fr = 1;
      const hA = (Math.imul(v + 1, 2654435761) >>> 0) % 1000 / 1000, hB = (Math.imul(v + 7, 40503) >>> 0) % 1000 / 1000;
      if (af > -900) fr = tv(f, Math.round(af + (hA - .5) * 1.9), Math.round(map[v * 5 + 2] + (hB - .5) * 1.9)); // ближайшая плита с рваным краем: вмятина неровная, не прямоугольная
      const dm = af > -900 ? 1 - fr : 0, h = af > -900 ? fr * nF[f] * th : 0, hb = h + th * .08 - (dm > .02 && dm < .999 ? th * .45 * hA : 0); dmv[v] = dm;
      pos[v * 3] = base[v * 3]; pos[v * 3 + 1] = base[v * 3 + 1] + dir[v * 3 + 1] * hb; pos[v * 3 + 2] = base[v * 3 + 2] + dir[v * 3 + 2] * hb;
      // трещина от края вмятины: 3 острых звена
      if (dm > .02 && dm < .6 && ns < CR - 3) { if (hA < .22) { const h2 = hB;
        let px = pos[v * 3], py = pos[v * 3 + 1] + dir[v * 3 + 1] * th * .15, pz = pos[v * 3 + 2] + dir[v * 3 + 2] * th * .15, ang = h2 * 6.2832; const ty = -dir[v * 3 + 2], tz = dir[v * 3 + 1];
        for (let k = 0; k < 3; k++) { const ln = cell * (.7 + ((h2 * 997 * (k + 1)) % 1) * 1.4), cx = Math.cos(ang) * ln, sx = Math.sin(ang) * ln, qx = px + cx, qy = py + ty * sx, qz = pz + tz * sx;
          cp[ns * 6] = px; cp[ns * 6 + 1] = py; cp[ns * 6 + 2] = pz; cp[ns * 6 + 3] = qx; cp[ns * 6 + 4] = qy; cp[ns * 6 + 5] = qz; ns++; px = qx; py = qy; pz = qz; ang += (((h2 * 7919 * (k + 2)) % 1) - .5) * 2.4 } } } }
    // в плоские треугольники: цвет одинаков на всей грани, переходов нет
    for (let t = 0; t < idx.length; t += 3) { const i0 = idx[t], i1 = idx[t + 1], i2 = idx[t + 2], o = t * 3;
      for (let k = 0; k < 3; k++) { const i = idx[t + k]; gp[o + k * 3] = pos[i * 3]; gp[o + k * 3 + 1] = pos[i * 3 + 1]; gp[o + k * 3 + 2] = pos[i * 3 + 2] }
      const dm = (dmv[i0] + dmv[i1] + dmv[i2]) / 3; let r: number, g2: number, b: number;
      if (dm < .02) { r = paint[i0 * 3]; g2 = paint[i0 * 3 + 1]; b = paint[i0 * 3 + 2] }
      else if (dm < .3) { r = paint[i0 * 3] * .32 + .06; g2 = paint[i0 * 3 + 1] * .3 + .035; b = paint[i0 * 3 + 2] * .3 + .03 }
      else if (dm < .65) { r = .1; g2 = .085; b = .075 }
      else if (dm < .97) { r = .06; g2 = .052; b = .046 }
      else { r = .36; g2 = .33; b = .31 }
      for (let k = 0; k < 3; k++) { gc[o + k * 3] = r; gc[o + k * 3 + 1] = g2; gc[o + k * 3 + 2] = b } }
    cl.geometry.setDrawRange(0, ns * 2); cl.geometry.attributes.position.needsUpdate = true; ge.attributes.position.needsUpdate = true; ge.attributes.color.needsUpdate = true;
  }
  function updateTiles(s: any, g: THREE.Group, force?: boolean) {
    const u = g.userData, now = performance.now(); if (!u.arm || (!force && now - u.armT < 200)) return; u.armT = now; const th = thL(u); let spawned = 0, chg = false; const im = u.arm[0] as THREE.InstancedMesh;
    for (const q of u.tilesL as any[]) { const z = s.zones[q.f]; if (!z || !q.ent) continue;
      if (force) { const nc = z.nc, i0 = Math.floor(q.c0 * nc), i1 = Math.max(i0 + 1, Math.floor(q.c1 * nc)); let sum = 0; for (let k = i0; k < i1; k++) sum += z.cols[k];
        const cur = Math.max(0, Math.min(q.n, Math.floor(sum / (i1 - i0) + q.jit))); if (cur !== q.cur) { q.cur = cur; q.dirty = true } } // начальное состояние по остатку брони
      if (!q.dirty) continue; q.dirty = false; chg = true;
      for (let l = 0; l < q.n; l++) { if (l >= q.cur) { _sc.set(0, 0, 0); _p.set(q.px, q.py, q.pz); _m4.compose(_p, _q.identity(), _sc) }
        else { layerPos(q, l, th, _p); _sc.set(q.len * .94, th * .95, q.cs * .94); _m4.compose(_p, q.f % 2 ? _qx : _q.identity(), _sc) } im.setMatrixAt(q.ent[l], _m4) } }
    if (chg) { im.instanceMatrix.needsUpdate = true; u.shellDirty = true } u.fresh = false;
  }
  const dummy = new THREE.Object3D(), v3 = new THREE.Vector3(); const qa = new THREE.Quaternion(), qb = new THREE.Quaternion(), vX = new THREE.Vector3(1, 0, 0), vY = new THREE.Vector3(0, 1, 0), vZ = new THREE.Vector3(0, 0, 1);
  const LODT = [.002, .004, .007, .011, .017, .026, .04, .06, .09, .14]; // пороги видимого размера для уровней 1..10
  function frame() { if (!pv) return frame0(); const pc = Battles.cur; Battles.cur = pv.b; try { frame0() } finally { Battles.cur = pc } }
  function frame0() {
    raf = requestAnimationFrame(frame); if (!ren) return; const jsT0 = performance.now();
    { const nf = performance.now(), dtf0 = nf - lastFT; lastFT = nf; if (dtf0 < 500) dtEma += (dtf0 - dtEma) * .08 }
    const r = (pv ? pv.host : wrap!).getBoundingClientRect(); if (pv) { const cs = ren.domElement.style; cs.position = 'fixed'; cs.left = r.left + 'px'; cs.top = r.top + 'px'; cs.width = r.width + 'px'; cs.height = r.height + 'px'; cs.zIndex = '70'; if (!pv.drag) yaw += .004 }
    if (ren.domElement.width !== Math.round(r.width * ren.getPixelRatio()) || ren.domElement.height !== Math.round(r.height * ren.getPixelRatio())) { ren.setSize(r.width, r.height, false); cam.aspect = r.width / Math.max(1, r.height); cam.updateProjectionMatrix() }
    const selS = Battle.anchorSel && Battle.anchorSel();
    if (!ring) { ring = new THREE.LineLoop(new THREE.RingGeometry(.98, 1, 48).setFromPoints ? new THREE.BufferGeometry().setFromPoints(Array.from({ length: 49 }, (_, i) => new THREE.Vector3(Math.cos(i / 48 * 6.2832), 0, Math.sin(i / 48 * 6.2832)))) : undefined, new THREE.LineBasicMaterial({ color: 0xffffff })); scene.add(ring) }
    ring.visible = !!(selS && selS.alive && models.get(selS)); if (ring.visible) { const g = models.get(selS)!; ring.position.copy(g.position); ring.scale.setScalar(Math.max(selS.T.L * SC * .75, dist * .02)) }
    const ships: any[] = Battle.ships(); let cx = 0, cy = 0, cz = 0, n = 0, rad = 0; builds = 0; ultraBuilds = 0; shellBuilds = 0; const alive = new Set<any>();
    for (const s of ships) if (s.alive) { cx += s.x; cy += s.y; cz += s.z; n++ }
    if (n) { cx /= n; cy /= n; cz /= n; const ds: number[] = []; for (const s of ships) if (s.alive) ds.push(Math.hypot(s.x - cx, s.y - cy, (s.z - cz) * 2)); ds.sort((a, b) => a - b); rad = ds[Math.floor(ds.length * .9)] || 0 }
    _fr.setFromProjectionMatrix(_pm.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse)); // видимый объём камеры: что вне его — не обновляем и не рисуем
    // бюджет детализации: полную модель с башнями и броней получают только ближайшие к камере корабли
    const detOK = new Set<any>(), shellOK = new Set<any>();
    { const cand: [number, any][] = []; for (const s of ships) { if (!s.alive) continue; const dd = Math.hypot(cam.position.x - s.x, cam.position.y - s.z, cam.position.z - s.y), L = s.T.L, sc = Math.max(SC, dd * .011 / L), a = L * sc / Math.max(dd, .01); if (a > .026) cand.push([a, s]) }
      cand.sort((a, b) => b[0] - a[0]); const slow = dtEma > 34, nD = slow ? 4 : 8, nS = slow ? 8 : 16; for (let i = 0; i < cand.length; i++) { if (i < nS) shellOK.add(cand[i][1]); if (i < nD && cand[i][0] > .04) detOK.add(cand[i][1]) } }
    for (const s of ships) {
      if (!s.alive) { const g = models.get(s); if (g) { models.delete(s); makeWreck(g, s) } continue }
      alive.add(s);
      let g = models.get(s); if (!g) { g = build(s); models.set(s, g) } g.visible = true;
      g.position.set(s.x, s.z, s.y); g.rotation.order = 'YZX'; const ud = g.userData; if (ud.hd == null) { ud.hd = s.hd; ud.pt = 0 }
      { let dh = s.hd - ud.hd; dh = Math.atan2(Math.sin(dh), Math.cos(dh)); ud.hd += dh * .2; ud.pt += (Math.max(-.2, Math.min(.2, (s.pz || 0) * 2.5)) - ud.pt) * .015 } // сглаживание курса и тангажа
      if (ud.rl == null) ud.rl = s.roll || 0; ud.rl += ((s.roll || 0) - ud.rl) * .2; g.rotation.y = -ud.hd; g.rotation.z = ud.pt; g.rotation.x = ud.rl;
      const dd = cam.position.distanceTo(g.position), L = g.userData.L, sc = Math.max(SC, dd * .011 / L); g.scale.setScalar(sc);
      if (!_fr.intersectsSphere(_sph.set(g.position, L * sc * 1.1 + dd * .02))) { g.visible = false; continue }
      const app = L * sc / Math.max(dd, .01); // видимый размер
      // 11 уровней детализации (0..10) с гистерезисом ±10%: корабль теряет детали постепенно, без скачков
      let lv = ud.lv | 0; while (lv < 10 && app > LODT[lv] * 1.1) lv++; while (lv > 0 && app < LODT[lv - 1] * .9) lv--; ud.lv = lv;
      setLod(s, g, lv >= 6 ? 2 : lv >= 3 ? 1 : 0);
      detail(s, g, g.userData.lod === 2 && lv >= 7 && detOK.has(s)); shell(s, g, g.userData.lod === 2 && shellOK.has(s)); ultra(s, g, g.userData.lod === 2 && app > .22 && dd < 400 && detOK.has(s));
      if (g.userData.det) { updateTiles(s, g); const tg: THREE.Group = g.userData.tur, np = performance.now(); g.updateMatrixWorld(true); const inv = new THREE.Quaternion().copy(g.quaternion).invert(), tgt0 = s.tg && s.tg.alive ? s.tg : null;
        tg.children.forEach((t: any) => { const m = t.userData.m; t.visible = m.alive; if (!m.alive) return;
          // направление на цель в системе корабля, зажатое в полусферу вокруг нормали площадки
          let d: THREE.Vector3 | null = null; const fa = (m.fa != null && m.rt && np - m.rt < 1800) ? m.fa : null;
          if (fa != null) { const hd = tgt0 ? Math.max(1e-3, Math.hypot(tgt0.x - s.x, tgt0.y - s.y)) : 1; d = new THREE.Vector3(Math.cos(fa), tgt0 ? (tgt0.z - s.z) / hd : 0, Math.sin(fa)) } else if (tgt0) { d = new THREE.Vector3(tgt0.x - s.x, tgt0.z - s.z, tgt0.y - s.y) }
          if (!d || d.lengthSq() < 1e-9) return; d.normalize().applyQuaternion(inv); const n: THREE.Vector3 = t.userData.n, dn = d.dot(n); if (dn < .02) d.addScaledVector(n, .02 - dn).normalize();
          if (t.userData.ax) { const ang = Math.acos(Math.max(-1, Math.min(1, d.dot(n)))); if (ang > .175) { const qq = new THREE.Quaternion().setFromUnitVectors(n, d); d.copy(n).applyQuaternion(new THREE.Quaternion().slerp(qq, .175 / ang)) } } // осевое: конус ±10°
          // базис башни: x — на цель, y — по нормали (в её локальных осях основание уже повёрнуто к нормали)
          const lq = t.quaternion.clone().invert(), dl = d.clone().applyQuaternion(lq); // направление в системе основания, y — вверх
          const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dl.lengthSq() ? dl.normalize() : new THREE.Vector3(1, 0, 0)); t.userData.head.quaternion.slerp(q, .12);
          const fr = m.rt && np - m.rt < 260; t.userData.fl.visible = !!fr;
          if (fr && t.userData.lr !== m.rt) { t.userData.lr = m.rt; { const tp = t.userData.tips[(Math.random() * t.userData.tips.length) | 0], mp = new THREE.Vector3(); tp.updateWorldMatrix(true, false); tp.getWorldPosition(mp); const ev = (g.userData.muz = g.userData.muz || []); ev.push({ p: mp, t: np }); if (ev.length > 40) ev.shift(); flashes.push({ p: mp.clone(), t0: np, life: 220, sz: 20 }); for (let j = 0; j < 6 && sparks.length < MAXSP; j++) { const dv = d!.clone().applyQuaternion(g.quaternion); sparks.push({ p: mp.clone(), v: dv.multiplyScalar(g.userData.L * .004 * (.5 + Math.random())).add(new THREE.Vector3().randomDirection().multiplyScalar(g.userData.L * .0012)), t0: np, life: 350 + Math.random() * 250, h: Math.random() }) } } if (cas.length < MAXC) { const wp = new THREE.Vector3(); t.getWorldPosition(wp); const ra = Math.random() * 6.283, sp = .006 + Math.random() * .01; cas.push({ x: wp.x, y: wp.y + t.userData.r, z: wp.z, vx: s.sx + Math.cos(ra) * sp, vy: .012 + Math.random() * .012, vz: s.sy + Math.sin(ra) * sp, t0: np, sz: t.userData.r * .45, rx: Math.random() * 6, rs: (Math.random() - .5) * 14 }) } } }) }
      { const u2 = g.userData; // следы повреждений на корпусе: подпалины и пробоины
        if (u2.lod === 2 && app > .05 && s.vd && s.vd.length && u2.seg && !u2.lp) { if (!u2.dmg) { u2.dmg = new THREE.InstancedMesh(decalGeo, decalMat, MAXD); u2.dmg.frustumCulled = false; u2.dmg.setColorAt(0, new THREE.Color(1, 1, 1)); g.add(u2.dmg) }
          const nowT = Battle.time(), q = new THREE.Quaternion(), nrm = new THREE.Vector3(), pos = new THREE.Vector3(), sc3 = new THREE.Vector3(), mt = new THREE.Matrix4(), col3 = new THREE.Color(); let k = 0;
          const th0 = thL(u2);
          for (const d of s.vd as any[]) { if (k >= MAXD) break; let a = d.a3; if (a && a.dead) continue; if (a && a.q.cur <= a.l) { a.dead = true; continue } // плита со следом сорвана
            const x = Math.max(-.5 * u2.L, Math.min(.34 * u2.L, d.u * u2.L)); let sg = u2.seg[0]; for (const e of u2.seg) if (Math.abs(e.cx - x) < Math.abs(sg.cx - x)) sg = e;
            const c = Math.cos(d.ang), sn = Math.sin(d.ang), hw = sg.w / 2, hh = sg.h / 2, f = 1 / Math.max(Math.abs(c) / hw, Math.abs(sn) / hh, 1e-6), zz = c * f, yy = sg.cy + sn * f;
            if (Math.abs(c) / hw > Math.abs(sn) / hh) nrm.set(0, 0, Math.sign(c)); else nrm.set(0, Math.sign(sn) || 1, 0);
            const r = u2.L * .0042 * d.sz * (.7 + d.r * .6); sc3.set(r * (1 + d.r * .6), r, r); let rz = 0;
            if (d.k === 2) sc3.multiplyScalar(1.7); else if (d.k === 3) { rz = d.r * 6.283; sc3.set(r * 3.6, r * .16, r) } else if (d.k === 4) sc3.multiplyScalar(.7); else if (d.k === 5) { rz = (d.r - .5) * .5; sc3.set(r * 4.5, r * .55, r) } else if (d.k === 6) sc3.multiplyScalar(1.5); else if (d.k === 7) sc3.multiplyScalar(1.2); else if (d.k === 8) sc3.set(r * 1.4, r * 2.2, r); else if (d.k === 9) sc3.multiplyScalar(.45); else if (d.k === 10) sc3.multiplyScalar(2.3); else if (d.k === 11) { rz = d.r * .5 - .25; sc3.set(r * 3.2, r * 1.2, r) };
            if (a === undefined && u2.arm) { a = d.a3 = attachDecal(u2, d, x, yy, zz, nrm, Math.max(sc3.x, sc3.y)); if (a) { const lim = Math.min(a.q.len, a.q.cs) * .34, m = Math.max(sc3.x, sc3.y); if (m > lim) sc3.multiplyScalar(lim / m); a.sc.copy(sc3); a.rz = rz } else d.a3 = null }
            if (a) { const lim = Math.min(a.q.len, a.q.cs) * .34, m = Math.max(sc3.x, sc3.y); if (m > lim) sc3.multiplyScalar(lim / m); a.sc.copy(sc3); decalPos(a, th0, pos); const nr = NRL[a.q.f]; q.setFromUnitVectors(_zv, nrm.set(nr[0], nr[1], nr[2])) }
            else { const fz = s.zones[nrm.y > 0 ? 0 : nrm.y < 0 ? 2 : nrm.z > 0 ? 1 : 3], hz = (Math.max(1, Math.min(10, Math.round((fz && fz.arm) || 1))) + .15) * th0 + u2.L * .001; pos.set(x, yy + nrm.y * hz, zz + nrm.z * hz); q.setFromUnitVectors(_zv, nrm) } // без плиты (голая обшивка) след лежит на корпусе
            if (rz) q.multiply(_qz.setFromAxisAngle(_zv, rz));
            mt.compose(pos, q, sc3); u2.dmg.setMatrixAt(k, mt); const age = nowT - d.t0, h = d.k >= 2 ? 0 : Math.max(0, 1 - age / 5); col3.setRGB(.05 + .95 * h, .05 + .45 * h * h, .05 + .05 * h * h * h); if (d.k === 1) col3.multiplyScalar(.8); else if (d.k === 2) col3.setRGB(.012, .012, .016); else if (d.k === 3) col3.setRGB(.2, .21, .24); else if (d.k === 4) col3.setRGB(.025, .025, .03); else if (d.k === 5) col3.setRGB(.03, .028, .026); else if (d.k === 6) col3.setRGB(.42, .38, .34); else if (d.k === 7) { const hm = Math.max(0, 1 - age / 30); col3.setRGB(.06 + .94 * hm, .04 + .45 * hm * hm, .03) } else if (d.k === 8) { const hm = Math.max(0, 1 - age / 45); col3.setRGB(.25 + .4 * hm, .32 + .5 * hm, .38 + .55 * hm) } else if (d.k === 9) col3.setRGB(.07, .07, .075); else if (d.k === 10) col3.setRGB(.075, .062, .05); else if (d.k === 11) col3.setRGB(.006, .006, .008); u2.dmg.setColorAt(k, col3); if (a) a.col.copy(col3); k++ }
          u2.dmg.count = k; u2.dmg.instanceMatrix.needsUpdate = true; if (u2.dmg.instanceColor) u2.dmg.instanceColor.needsUpdate = true; u2.dmg.visible = true } else if (u2.dmg) u2.dmg.visible = false }
      loftWounds(s, g, app);
      if (g.userData.lod === 2 && app > .05 && s.vd && s.vd.length) wearParts(s, g);
      if (g.userData.lod >= 1) emitDamageFx(s, g, app);
      g.userData.eng.visible = g.userData.lod === 2 && Math.hypot(s.vx, s.vy) > .02;
    }
    for (const [s, g] of models) if (!alive.has(s) && !s.alive && g.parent) { models.delete(s); makeWreck(g, s) }
    { const sn = Battle.anchorSel && Battle.anchorSel(); if (sn && sn.alive) { lastSel = sn; deadAt = 0 } else if (lastSel && !lastSel.alive && !deadAt) deadAt = performance.now() }
    const holdWreck = !!(lastSel && !lastSel.alive && deadAt && performance.now() - deadAt < 16000); if (lastSel && !lastSel.alive && deadAt && !holdWreck) { lastSel = null; deadAt = 0 }
    if (holdWreck && follow) { const ls = lastSel; tgt.lerp(v3.set(ls.x, ls.z, ls.y), .06); fitAll = false; dist += (Math.max(dist, ls.T.L * 1.1) - dist) * .05 } // не уводим камеру, пока корабль разваливается
    else if (n && follow) { const sel = Battle.anchorSel && Battle.anchorSel(); if (fitAll || !(sel && sel.alive)) { v3.set(cx, cz, cy); tgt.lerp(v3, .08); if (fitAll) dist += (Math.min(700, Math.max(40, rad * 2.3 / Math.tan(.43))) - dist) * .04 } else { tgt.lerp(v3.set(sel.x, sel.z, sel.y), .08) } }
    if (fcam) { if (fcam.state === 'fly') { tgt.lerp(v3.set(fcam.x, fcam._yv || 0, fcam.y), .4) } else fcam = null }
    if (pendT > 0 && !tcam && !fcam) { pendT--; camTurret() }
    if (tcam && tcam.parent) { tcam.getWorldPosition(v3); tgt.lerp(v3, .35) } else tcam = null; { const nr = tcam ? Math.max(.0005, Math.min(.05, dist * .01)) : .05; if (cam.near !== nr) { cam.near = nr; cam.updateProjectionMatrix() } }
    cam.position.set(tgt.x + dist * Math.cos(pitch) * Math.sin(yaw), tgt.y + dist * Math.sin(pitch), tgt.z + dist * Math.cos(pitch) * Math.cos(yaw)); keepOff(); cam.lookAt(tgt);
    // истребители и бомбардировщики
    let fc = 0, fh = 0; const col = new THREE.Color(); for (const M of fmods.values()) { M.nh = 0; M.nl = 0 }
    for (const c of Battle.air() as any[]) {
      if (c.state !== 'fly' || fc >= MAXF) continue;
      if (c !== fcam && !_fr.containsPoint(_p.set(c.x, c._yv != null ? c._yv : (c.home ? c.home.z : 0), c.y)) && cam.position.distanceToSquared(_p) > 4) continue;
      { // полёт в 3D: вертикальное «плетение», крен по скорости поворота, тангаж по набору/снижению высоты
        const T2 = Battle.time(), id = c.slot || 0, ph = (c.fl ? (c.fl.fid || 0) : 0) * 1.7 + id * 2.3, w = .22 + (id % 5) * .07, A = c.type === 'B' ? 1.2 : 2.6 * Math.max(1, SC * .35);
        const yv = (c.home ? c.home.z : 0) + A * Math.sin(w * T2 + ph) + A * .4 * Math.sin(w * 2.7 * T2 + ph * 1.9), dy = A * w * Math.cos(w * T2 + ph) + A * .4 * w * 2.7 * Math.cos(w * 2.7 * T2 + ph * 1.9);
        const sp = Math.max(.5, Math.hypot(c.vx || 0, c.vy || 0)); let dh = 0; if (c._h0 != null) { dh = c.h - c._h0; while (dh > Math.PI) dh -= 2 * Math.PI; while (dh < -Math.PI) dh += 2 * Math.PI }
        c._h0 = c.h; c._r = (c._r || 0) + (Math.max(-1.3, Math.min(1.3, dh * 40)) + .35 * Math.sin(w * 3 * T2 + ph) - (c._r || 0)) * .12;
        dummy.position.set(c.x, yv, c.y); qa.setFromAxisAngle(vY, -c.h); qb.setFromAxisAngle(vZ, Math.atan2(dy, sp)); qa.multiply(qb); qb.setFromAxisAngle(vX, c._r); qa.multiply(qb); qb.setFromAxisAngle(vZ, -Math.PI / 2); qa.multiply(qb);
        dummy.quaternion.copy(qa); c._yv = yv; const mc = (c.P && c.P.mass) || (c.type === 'B' ? 300 : 260), tl = mc / TON_L, dc = cam.position.distanceTo(dummy.position), len = Math.max(tl, dc * .0045), sz = len / 2.2; c._len = len; dummy.scale.set(sz * (c.type === 'B' ? 1.5 : 1), len, sz * (c.type === 'B' ? 1.5 : 1)); dummy.updateMatrix() } // длина = масса / 50 т на метр, но не меньше нескольких пикселей
      const dc0 = cam.position.distanceTo(dummy.position), FM = c.type === 'F' && c.P && c.P.mk ? fmod(c.P) : null;
      if (FM) { col.set(c.side ? 0xffb070 : 0x9fd8ff); if (dc0 < c._len * 60 && FM.nh < 160) { FM.hi.setMatrixAt(FM.nh, dummy.matrix); FM.hi.setColorAt(FM.nh, col); FM.nh++ } else if (FM.nl < 1200) { FM.lo.setMatrixAt(FM.nl, dummy.matrix); FM.lo.setColorAt(FM.nl, col); FM.nl++ } continue }
      if (dc0 < c._len * 60 && fh < 220) { fightersHi.setMatrixAt(fh, dummy.matrix); fightersHi.setColorAt(fh, col.set(c.side ? 0xffb070 : 0x9fd8ff)); fh++ }
      else { fighters.setMatrixAt(fc, dummy.matrix); fighters.setColorAt(fc, col.set(c.side ? 0xffb070 : 0x9fd8ff)); fc++ }
    }
    if (!stepFreeze) fightersHi.count = fh; fightersHi.instanceMatrix.needsUpdate = true; if (fightersHi.instanceColor) fightersHi.instanceColor.needsUpdate = true;
    for (const M of fmods.values()) { if (!stepFreeze) M.hi.count = M.nh; M.lo.count = M.nl; for (const m of [M.hi, M.lo]) { m.instanceMatrix.needsUpdate = true; if (m.instanceColor) m.instanceColor.needsUpdate = true } }
    fighters.count = fc; fighters.instanceMatrix.needsUpdate = true; if (fighters.instanceColor) fighters.instanceColor.needsUpdate = true;
    // снаряды: разные оттенки, затухание к концу дальности, тонкие
    const pa = (projLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, pcol = (projLines.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array; let pc = 0;
    const tmp = new THREE.Color();
    for (const p of Battle.proj() as any[]) {
      if (pc >= MAXP) break; const o = pc * 6, cdp = cam.position.distanceTo(_p.set(p.x, p.z, p.y)), tailK = Math.min(.4, Math.max(.02, cdp * .006)) / Math.max(1, Math.hypot(p.vx, p.vy)) / .1;
      let ox = 0, oy = 0, oz = 0;
      if (p._m === undefined) { p._m = null; dbg.n++; const gs = p.src && models.get(p.src); let tt: any = gs && gs.userData.turMap && p.m ? gs.userData.turMap.get(p.m) : null;
        if (!tt && gs && (gs.userData.det && gs.visible) && gs.userData.tur) { // нет привязки к модулю: берём ближайшую живую башню, смотрящую в сторону выстрела
          gs.updateMatrixWorld(true); const hl0 = Math.hypot(p.vx, p.vy, p.vz || 0) || 1, d0 = new THREE.Vector3(p.vx / hl0, (p.vz || 0) / hl0, p.vy / hl0).applyQuaternion(gs.quaternion.clone().invert()), o0 = gs.worldToLocal(new THREE.Vector3(p.x, p.z, p.y)); let bd = 1e18, bt: any = null;
          for (const t of gs.userData.tur.children as any[]) { if (!t.visible || !t.userData.m || !t.userData.m.alive || t.userData.n.dot(d0) < .05) continue; const dd2 = t.position.distanceToSquared(o0); if (dd2 < bd) { bd = dd2; bt = t } }
          tt = bt }
        if (gs && (gs.userData.det && gs.visible)) { dbg.d = (dbg.d || 0) + 1; if (!tt) dbg.nt = (dbg.nt || 0) + 1 }
        if (tt && (gs.userData.det && gs.visible)) { // ствол стреляющей башни: наводим на направление выстрела и берём конец ствола
          const hl = Math.hypot(p.vx, p.vy, p.vz || 0) || 1, dw = new THREE.Vector3(p.vx / hl, (p.vz || 0) / hl, p.vy / hl); gs.updateMatrixWorld(true);
          const inv = new THREE.Quaternion().copy(gs.quaternion).invert(), n: THREE.Vector3 = tt.userData.n, dd = dw.clone().applyQuaternion(inv).normalize(), dn = dd.dot(n); if (dn < .02) dd.addScaledVector(n, .02 - dn).normalize();
          const dl = dd.clone().applyQuaternion(tt.quaternion.clone().invert()), hq = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dl.normalize()); tt.userData.head.quaternion.copy(hq); tt.updateMatrixWorld(true);
          const tip = tt.userData.tips[(Math.random() * tt.userData.tips.length) | 0], mp = new THREE.Vector3(); tip.getWorldPosition(mp);
          p._m = null; if (p.o0) p._O = [p.o0.x + mp.x - gs.position.x, p.o0.z + mp.y - gs.position.y, p.o0.y + mp.z - gs.position.z]; // точка вылета: конец ствола в момент выстрела
           dbg.td = tdeb.length; dbg.m++; dbg.last = { mp: [mp.x, mp.y, mp.z], src: p.src, ship: [gs.position.x, gs.position.y, gs.position.z] }; dbg.off = Math.max(dbg.off, Math.hypot(mp.x - gs.position.x, mp.y - gs.position.y, mp.z - gs.position.z) / (gs.userData.L || 1)) } }
      if (p._m) { const w = Math.max(0, 1 - (p.dist - p._m.d0) / p._m.F); ox = p._m.x * w; oy = p._m.y * w; oz = p._m.z * w }
      pa[o] = p.x + ox; pa[o + 1] = p.z + oy; pa[o + 2] = p.y + oz; { const tx = p.vx * tailK * .1, ty = (p.vz || 0) * tailK * .1, tz = p.vy * tailK * .1;
        if (p._O) { const dx = p.x - p._O[0], dy = p.z - p._O[1], dz = p.y - p._O[2]; if (dx * dx + dy * dy + dz * dz < 16 * (tx * tx + ty * ty + tz * tz)) { pa[o + 3] = p._O[0]; pa[o + 4] = p._O[1]; pa[o + 5] = p._O[2] } else { pa[o + 3] = p.x - tx; pa[o + 4] = p.z - ty; pa[o + 5] = p.y - tz } }
        else { pa[o + 3] = p.x + ox - tx; pa[o + 4] = p.z + oy - ty; pa[o + 5] = p.y + oz - tz } }
      const e = p.ev == null ? .5 : p.ev, fade = Math.min(1, Math.max(0, (1 - p.dist / Math.max(1, p.max)) / .4)) * .85; // летит яркой, гаснет лишь в последние 40% дальности
      tmp.setHSL(p.side ? .02 + e * .12 : .5 + e * .2, .9, .6); // красные: красный→жёлтый; синие: бирюзовый→фиолетовый
      pcol[o] = tmp.r * fade; pcol[o + 1] = tmp.g * fade; pcol[o + 2] = tmp.b * fade; pcol[o + 3] = tmp.r * fade * .12; pcol[o + 4] = tmp.g * fade * .12; pcol[o + 5] = tmp.b * fade * .12;
      pc++;
    }
    updateEnv(); stepWrecks(performance.now());
    { let ek = 0; const nE = performance.now(), st = new THREE.Vector3(), rt = new THREE.Vector3();
      for (const [sh, g] of models) { if (!sh.alive || !g.parent || !g.visible) continue; const u = g.userData, L = u.L, sp = Math.hypot(sh.vx, sh.vy), h: any[] = u.eh || (u.eh = []); if ((u.lv | 0) < 3) { h.length = 0; continue } g.updateMatrixWorld(true); const sc = g.scale.x;
        const nz0 = u.full && (u.full as any).userData.nozz ? (u.full as any).userData.nozz : [{ z: 0, y: 0, r: L * .04 }], nz = (u.lv | 0) < 6 ? nz0.slice(0, 1) : nz0; // далеко — одна общая струя
        if (sp > .02) { st.set(-L * .67, 0, 0); g.localToWorld(st); const last = h[h.length - 1]; if (!last || last.c.distanceTo(st) > L * sc * .02) { h.push({ c: st.clone(), ps: nz.map((n: any) => { const q = new THREE.Vector3(-L * .67, n.y || 0, n.z); g.localToWorld(q); return q }), t: nE }); if (h.length > 18) h.shift() } }
        while (h.length && nE - h[0].t > 2200) h.shift(); if (!h.length) continue; const base = sh.side ? [1, .45, .16] : [.3, .7, 1];
        // дым идёт из среза каждого сопла: сколько двигателей, столько и струй
        for (let i = 0; i < h.length && ek < MAXEX; i++) { const age = (nE - h[i].t) / 2200, f = (1 - age) * (1 - age) * .8;
          for (let j = 0; j < nz.length && j < h[i].ps.length && ek < MAXEX; j++) { const sz = nz[j].r * sc * (.85 + 1.1 * age); dummy.position.copy(h[i].ps[j]); dummy.quaternion.identity(); dummy.scale.setScalar(sz); dummy.updateMatrix(); exMesh.setMatrixAt(ek, dummy.matrix);
            exMesh.setColorAt(ek, _cc2.setRGB(base[0] * f * .9, base[1] * f * .9, base[2] * f * .9)); ek++ } } }
      // маневровые: короткие белые вспышки по бортам, пока корабль крутится (только живые РСУ)
      for (const [sh, g] of models) { if (!sh.alive || !g.visible || !sh.rcs0 || !(sh.rcsN > 0) || Math.abs(sh.trn || 0) < .08) continue; const u = g.userData, L = u.L, sc = g.scale.x, sg = Math.sign(sh.trn), fl = performance.now() % 160 < 100; if (!fl) continue;
        for (let q = 0; q < 2 && ek < MAXEX; q++) { st.set((q ? -1 : 1) * L * .38, 0, -sg * (q ? -1 : 1) * (u.W || L * .17) * .56); g.localToWorld(st); dummy.position.copy(st); dummy.quaternion.identity(); dummy.scale.setScalar(L * sc * .012 * Math.min(1, .4 + sh.rcsN / sh.rcs0)); dummy.updateMatrix(); exMesh.setMatrixAt(ek, dummy.matrix); exMesh.setColorAt(ek, _cc2.setRGB(.9, .95, 1)); ek++ } }
      { const dts = .016 * Battle.getSpeed(); for (let i = puffs.length - 1; i >= 0; i--) { const q = puffs[i], a = (nE - q.t0) / q.life; if (a >= 1) { puffs.splice(i, 1); continue } if (ek >= MAXEX) break;
          q.p.addScaledVector(q.v, dts); q.v.multiplyScalar(.985); const k = Math.pow(1 - a, 1.4); dummy.position.copy(q.p); dummy.quaternion.identity(); dummy.scale.setScalar(q.a + (q.b - q.a) * a); dummy.updateMatrix(); exMesh.setMatrixAt(ek, dummy.matrix); exMesh.setColorAt(ek, _cc2.setRGB(q.c[0] * k, q.c[1] * k, q.c[2] * k)); ek++ } }
      exMesh.count = ek; exMesh.instanceMatrix.needsUpdate = true; if (exMesh.instanceColor) exMesh.instanceColor.needsUpdate = true }
    { const trs = Battle.tracers() as any[]; for (const q of trs) { if (q.id <= lastTr) continue; lastTr = q.id; if (streaks.length > 900) streaks.shift(); const ex = Math.hypot(q.x2 - q.x1, q.y2 - q.y1); if (ex < 1e-3) continue; const A0 = new THREE.Vector3(q.x1, q.z1, q.y1); { const gs = q.src && models.get(q.src), tt = gs && gs.userData.turMap && q.m ? gs.userData.turMap.get(q.m) : null; if (tt && gs.userData.det && gs.visible) { gs.updateMatrixWorld(true); tt.updateMatrixWorld(true); const tip = tt.userData.tips && tt.userData.tips[0]; if (tip) tip.getWorldPosition(A0) } else if (q.src && q.src.T) { const dl = new THREE.Vector3(q.x2 - q.x1, q.z2 - q.z1, q.y2 - q.y1).normalize(); A0.addScaledVector(dl, q.src.T.L * (gs ? gs.scale.x : 1) * .4) } }
      const B0 = new THREE.Vector3(q.x2, q.z2, q.y2), ln0 = A0.distanceTo(B0), tail = Math.min(ln0, Math.max(((q.src && q.src.T) ? q.src.T.L : .5) * 6, cam.position.distanceTo(A0) * .03)), V = 3000; streaks.push({ a: A0, b: B0, t0: performance.now(), dur: Math.max(250, (ln0 + tail) / V * 1000), bolt: 1, k: (ln0 + tail) / Math.max(1e-6, ln0), tl: tail / Math.max(1e-6, ln0), side: q.side }) } }
    { const nwS = performance.now(); for (let i = streaks.length - 1; i >= 0; i--) { const st = streaks[i], u = (nwS - st.t0) / (st.dur || 140); if (u >= 1) { streaks.splice(i, 1); continue } if (pc >= MAXP) break;
        const hh = st.bolt ? Math.min(1, u * st.k) : st.slow ? Math.min(1, u / .12) : Math.min(1, u / .55), tt = st.bolt ? Math.max(0, u * st.k - st.tl) : st.slow ? Math.max(0, (u - .1) / .9) : Math.max(0, (u - .3) / .7), o = pc * 6, f = st.bolt ? 1 - u * .35 : st.slow ? Math.pow(1 - u, .7) : st.dur ? Math.pow(1 - u, 1.3) : 1 - u * .5;
        pa[o] = st.a.x + (st.b.x - st.a.x) * hh; pa[o + 1] = st.a.y + (st.b.y - st.a.y) * hh; pa[o + 2] = st.a.z + (st.b.z - st.a.z) * hh; pa[o + 3] = st.a.x + (st.b.x - st.a.x) * tt; pa[o + 4] = st.a.y + (st.b.y - st.a.y) * tt; pa[o + 5] = st.a.z + (st.b.z - st.a.z) * tt;
        tmp.setHSL(st.side ? .08 : .52, .9, .65); pcol[o] = tmp.r * f; pcol[o + 1] = tmp.g * f; pcol[o + 2] = tmp.b * f; pcol[o + 3] = tmp.r * f * .25; pcol[o + 4] = tmp.g * f * .25; pcol[o + 5] = tmp.b * f * .25; pc++ } }
    bolts.count = 0; projLines.geometry.setDrawRange(0, pc * 2); (projLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (projLines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
    // попадания: вспышка, веер искр от точки удара, у крупных — столб искр
    { const imp = Battle.impacts() as any[], nw = performance.now();
      for (const q of imp) { if (q.id <= lastImp) continue; lastImp = q.id; let hit: any = null; { const gg = models.get(q.s); if (gg && gg.userData.det && q.k !== 'torp') { hit = peelAt(gg, q.s, q); if (hit && q.k !== 'mis') { const sd = new THREE.Vector3(q.nx, 0, q.ny).multiplyScalar(.5).add(hit.nrm.clone().multiplyScalar(.5)).normalize(), ln = Math.max(gg.userData.L * .05, cam.position.distanceTo(hit.pos) * .012); streaks.push({ a: hit.pos.clone().addScaledVector(sd, ln), b: hit.pos.clone(), t0: performance.now(), side: q.s.side }) } } } if (sparks.length > MAXSP - 40) break;
        const cp = cam.position, pos = hit ? hit.pos.clone() : new THREE.Vector3(q.x, q.z, q.y), cd = cp.distanceTo(pos); if (cd > 3000) continue;
        flashes.push({ p: pos, t0: nw, life: 140 + q.pw * 25, sz: Math.min(34, 14 + q.pw * 3) });
        const n = Math.min(26, 8 + Math.round(q.pw * 3)), nrm = hit ? hit.nrm.clone().add(new THREE.Vector3(q.nx * .4, 0, q.ny * .4)).normalize() : new THREE.Vector3(q.nx, .6 + Math.random() * .4, q.ny).normalize();
        for (let i = 0; i < n; i++) { const d = new THREE.Vector3().randomDirection().multiplyScalar(.9).add(nrm.clone().multiplyScalar(1.3)).normalize(), sp = cd * .055 * (.3 + Math.random() * .9) * (.7 + Math.min(1.2, q.pw * .1));
          sparks.push({ p: pos.clone(), v: d.multiplyScalar(sp), t0: nw, life: 350 + Math.random() * 650, h: Math.random() }) } }
      const spa = (sparkLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, sco = (sparkLines.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array; let k = 0;
      for (let i = sparks.length - 1; i >= 0; i--) { const q = sparks[i], a = (nw - q.t0) / q.life; if (a >= 1) { sparks.splice(i, 1); continue } }
      for (const q of sparks) { if (k >= MAXSP) break; const a = (nw - q.t0) / q.life, tt = (nw - q.t0) / 1000, o = k * 6, f = (1 - a) * (1 - a), vx = q.v.x, vy = q.v.y - tt * q.v.length() * .5, vz = q.v.z;
        const hx = q.p.x + vx * tt, hy = q.p.y + vy * tt - 0, hz = q.p.z + vz * tt, tl = .07; spa[o] = hx; spa[o + 1] = hy; spa[o + 2] = hz; spa[o + 3] = hx - vx * tl; spa[o + 4] = hy - vy * tl; spa[o + 5] = hz - vz * tl;
        sco[o] = 1 * f; sco[o + 1] = (.8 - .4 * a - q.h * .15) * f; sco[o + 2] = (.45 - .4 * a) * f; sco[o + 3] = .5 * f; sco[o + 4] = .2 * f; sco[o + 5] = 0; k++ }
      sparkLines.geometry.setDrawRange(0, k * 2); (sparkLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (sparkLines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true;
      const fa = (flashPts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, fcl = (flashPts.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array; let m = 0;
      for (let i = flashes.length - 1; i >= 0; i--) if (nw - flashes[i].t0 > flashes[i].life) flashes.splice(i, 1);
      for (const q of flashes) { if (m >= MAXFL) break; const a = 1 - (nw - q.t0) / q.life; fa[m * 3] = q.p.x; fa[m * 3 + 1] = q.p.y; fa[m * 3 + 2] = q.p.z; fcl[m * 3] = a; fcl[m * 3 + 1] = a * .85; fcl[m * 3 + 2] = a * .55; m++ }
      flashPts.geometry.setDrawRange(0, m); (flashPts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (flashPts.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true }
    // следы истребителей и бомбардировщиков
    {const ta = (trailLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, tc = (trailLines.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array; let k = 0;
      for (const c of Battle.air() as any[]) { if (c.state !== 'fly' || !c.tr || c.tr.length < 4) continue; const y0 = c.home ? c.home.z : 0, y = c._yv != null ? c._yv : y0, n2 = c.tr.length, sf = c._sf != null ? c._sf : 1, base = (c.P && c.P.trail && TRAIL_COL[c.P.trail] ? TRAIL_COL[c.P.trail] : (c.side ? [1, .55, .25] : [.45, .8, 1])).map((v: number) => v * (.2 + .8 * sf));
        let px = c.x, py = c.y; const cnt = n2 / 2;
        for (let i = n2 - 2, q = 0; i >= 0 && k < MAXT; i -= 2, q++) { const o = k * 6, f = Math.max(0, 1 - q / cnt) * .8, f2 = Math.max(0, 1 - (q + 1) / cnt) * .8;
          ta[o] = px; ta[o + 1] = y0 + (y - y0) * Math.max(0, 1 - q / cnt); ta[o + 2] = py; ta[o + 3] = c.tr[i]; ta[o + 4] = y0 + (y - y0) * Math.max(0, 1 - (q + 1) / cnt); ta[o + 5] = c.tr[i + 1];
          tc[o] = base[0] * f; tc[o + 1] = base[1] * f; tc[o + 2] = base[2] * f; tc[o + 3] = base[0] * f2; tc[o + 4] = base[1] * f2; tc[o + 5] = base[2] * f2; px = c.tr[i]; py = c.tr[i + 1]; k++ } }
      // следы кораблей: чем быстрее корабль, тем ярче и длиннее трассер
      for (const sh of Battle.ships() as any[]) { let tr = shTr.get(sh); if (!sh.alive) { shTr.delete(sh); continue } if (!tr) shTr.set(sh, tr = []);
        const sp = Math.hypot(sh.sx || 0, sh.sy || 0), sf = Math.min(1, sp / 1.2), zz = sh.z || 0, last = tr.length ? tr[tr.length - 1] : null;
        if (!stepFreeze && (!last || Math.hypot(last[0] - sh.x, last[2] - sh.y) > .12 + sh.T.L * .15)) { tr.push([sh.x, zz, sh.y]); } const cap = Math.round(4 + 36 * sf); while (tr.length > cap) tr.shift();
        if (sf < .04 || tr.length < 2) continue; const base = (sh.trail && TRAIL_COL[sh.trail] ? TRAIL_COL[sh.trail] : (sh.side ? [1, .55, .25] : [.45, .8, 1]));
        let px = sh.x, py = zz, pz = sh.y; for (let i = tr.length - 1, q = 0; i >= 0 && k < MAXT; i--, q++) { const o = k * 6, f = Math.max(0, 1 - q / tr.length) * (.15 + .85 * sf), f2 = Math.max(0, 1 - (q + 1) / tr.length) * (.15 + .85 * sf);
          ta[o] = px; ta[o + 1] = py; ta[o + 2] = pz; ta[o + 3] = tr[i][0]; ta[o + 4] = tr[i][1]; ta[o + 5] = tr[i][2]; tc[o] = base[0] * f; tc[o + 1] = base[1] * f; tc[o + 2] = base[2] * f; tc[o + 3] = base[0] * f2; tc[o + 4] = base[1] * f2; tc[o + 5] = base[2] * f2; px = tr[i][0]; py = tr[i][1]; pz = tr[i][2]; k++ } }
      trailLines.geometry.setDrawRange(0, k * 2); (trailLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (trailLines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true}
    // мгновенные выстрелы ПВО/зениток: короткая вспышка линии, гаснет за 340 мс
    {const sa = (shotLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array, sc2 = (shotLines.geometry.attributes.color as THREE.BufferAttribute).array as Float32Array; let k = 0; const now2 = performance.now();
      for (const q of Battle.shots() as any[]) { if (k >= 600) break; const age = now2 - q.rt, f = 1 - age / 300; if (f <= 0) continue; const o = k * 6, z1 = q.a ? q.a.z : 0, z2 = q.b ? (q.b.z != null ? q.b.z : (q.b.home ? q.b.home.z : z1)) : z1;
        { const ex = q.ext || 1; let ax = q.x1, ay = z1, az = q.y1;
          if (q.src && q._O === undefined) { q._O = null; const gs = models.get(q.src), tt = gs && gs.userData.turMap && q.m ? gs.userData.turMap.get(q.m) : null; // начало — конец ствола зенитной башни
            if (tt && (gs.userData.det && gs.visible)) { gs.updateMatrixWorld(true); const dw = new THREE.Vector3(q.x2 - q.x1, 0, q.y2 - q.y1).normalize(), inv = new THREE.Quaternion().copy(gs.quaternion).invert(), n: THREE.Vector3 = tt.userData.n, dd = dw.applyQuaternion(inv).normalize(), dn = dd.dot(n); if (dn < .02) dd.addScaledVector(n, .02 - dn).normalize();
              const dl = dd.clone().applyQuaternion(tt.quaternion.clone().invert()); tt.userData.head.quaternion.copy(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), dl.normalize())); tt.updateMatrixWorld(true);
              const tip = tt.userData.tips[0], mp = new THREE.Vector3(); tip.getWorldPosition(mp); q._O = [q.o0.x + mp.x - gs.position.x, q.o0.z + mp.y - gs.position.y, q.o0.y + mp.z - gs.position.z] } }
          if (q._O) { ax = q._O[0]; ay = q._O[1]; az = q._O[2] }
          const ex2 = ax + (q.x2 - ax) * ex, ey2 = ay + (z2 - ay) * ex, ez2 = az + (q.y2 - az) * ex, pr = Math.min(1, age / 120), tp = Math.max(0, pr - .12);
          sa[o] = ax + (ex2 - ax) * pr; sa[o + 1] = ay + (ey2 - ay) * pr; sa[o + 2] = az + (ez2 - az) * pr; sa[o + 3] = ax + (ex2 - ax) * tp; sa[o + 4] = ay + (ey2 - ay) * tp; sa[o + 5] = az + (ez2 - az) * tp } const c = q.s ? [1, .75, .4] : [.55, .9, 1];
        sc2[o] = c[0] * f * .5; sc2[o + 1] = c[1] * f * .5; sc2[o + 2] = c[2] * f * .5; sc2[o + 3] = c[0] * f * .15; sc2[o + 4] = c[1] * f * .15; sc2[o + 5] = c[2] * f * .15; k++ }
      shotLines.geometry.setDrawRange(0, k * 2); (shotLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (shotLines.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true}
    const ma = (misPts.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array; let mc = 0;
    for (const p of Battle.mis() as any[]) { if (mc >= 2000) break; ma[mc * 3] = p.x; ma[mc * 3 + 1] = p.z; ma[mc * 3 + 2] = p.y; mc++ }
    { const mt = new THREE.Matrix4(), qm = new THREE.Quaternion(), dm = new THREE.Vector3(), pm = new THREE.Vector3(), sm = new THREE.Vector3(), ax1 = new THREE.Vector3(1, 0, 0), tp = misTr.geometry.attributes.position.array as Float32Array, tc = misTr.geometry.attributes.color.array as Float32Array; let mk = 0, ts = 0;
      for (const p of Battle.mis() as any[]) { if (mk >= MAXMIS) break; pm.set(p.x, p.z, p.y); const cd = cam.position.distanceTo(pm); if (cd > 6000) continue; const len = Math.max(.08, cd * .032), hd = p.h != null ? p.h : Math.atan2(p.vy, p.vx);
        dm.set(Math.cos(hd), 0, Math.sin(hd)); qm.setFromUnitVectors(ax1, dm); sm.set(len, len, len); mt.compose(pm, qm, sm); misMesh.setMatrixAt(mk, mt);
        const fl = len * (.3 + Math.random() * .2); const pf = pm.clone().addScaledVector(dm, -len * .62); sm.set(fl, len * .1, len * .1); mt.compose(pf, qm, sm); misFl.setMatrixAt(mk, mt); mk++;
        const tr = p.tr as number[]; let px = p.x, py = p.z, pz = p.y; for (let i = tr.length - 3; i >= 0 && ts < MAXMIS * 12; i -= 3) { const f = 1 - (tr.length - 3 - i) / Math.max(3, tr.length) * .9, o = ts * 6; tp[o] = px; tp[o + 1] = py; tp[o + 2] = pz; px = tr[i]; py = tr[i + 2]; pz = tr[i + 1]; tp[o + 3] = px; tp[o + 4] = py; tp[o + 5] = pz; tc[o] = f; tc[o + 1] = f * .55; tc[o + 2] = f * .18; tc[o + 3] = f * .5; tc[o + 4] = f * .25; tc[o + 5] = f * .08; ts++ } }
      misMesh.count = mk; misFl.count = mk; misMesh.instanceMatrix.needsUpdate = true; misFl.instanceMatrix.needsUpdate = true; misTr.geometry.setDrawRange(0, ts * 2); (misTr.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true; (misTr.geometry.attributes.color as THREE.BufferAttribute).needsUpdate = true; mc = 0 }
    { const mt = new THREE.Matrix4(), qm = new THREE.Quaternion(), dm = new THREE.Vector3(), pm = new THREE.Vector3(), sm = new THREE.Vector3(), ax1 = new THREE.Vector3(1, 0, 0); let k = 0;
      for (const q of ((Battle as any).shuttles ? (Battle as any).shuttles() : []) as any[]) { if (k >= 128) break; const tg = q.st ? q.from : q.to; if (!tg) continue; pm.set(q.x, q.z, q.y); const cd = cam.position.distanceTo(pm); if (cd > 4000) continue; const len = Math.max(.04, Math.min(cd * .02, .25));
        dm.set(tg.x - q.x, 0, tg.y - q.y); if (dm.lengthSq() < 1e-9) dm.set(1, 0, 0); dm.normalize(); qm.setFromUnitVectors(ax1, dm); sm.set(len, len, len); mt.compose(pm, qm, sm); shutMesh.setMatrixAt(k, mt);
        const pf = pm.clone().addScaledVector(dm, -len * .6); sm.set(len * .7, len * .25, len * .25); mt.compose(pf, qm, sm); shutGl.setMatrixAt(k, mt); k++ }
      shutMesh.count = k; shutGl.count = k; shutMesh.instanceMatrix.needsUpdate = true; shutGl.instanceMatrix.needsUpdate = true }
    misPts.geometry.setDrawRange(0, mc); (misPts.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    const ba = (beamLines.geometry.attributes.position as THREE.BufferAttribute).array as Float32Array; let bc = 0; const nowp = performance.now();
    // лазерный выстрел — летящий яркий импульс с хвостом, а не постоянная линия через всё поле
    { let bi = bolts.count; const nwb = performance.now();
      for (const b of Battle.beams() as any[]) { if (bi >= MAXP - 1 || !b.a) continue; const dur = Math.max(1, b.rt - b.c0), a = (nwb - b.c0) / dur; if (a < 0 || a > 1.15) continue;
        const sx = b.a.x, sy = b.a.z, sz = b.a.y, ex = b.tx, ey = (b.tz != null ? b.tz : (b.b && b.b.z) || 0), ez = b.ty, len = Math.hypot(ex - sx, ey - sy, ez - sz) || 1e-6, cd2 = cam.position.distanceTo(_p.set((sx + ex) / 2, (sy + ey) / 2, (sz + ez) / 2));
        let hp = Math.min(1, a * 1.25), tail = Math.min(.5, Math.max(.02, cd2 * .03 / len)), tp = Math.max(0, hp - tail), fade = a > 1 ? Math.max(0, 1 - (a - 1) / .15) : 1;
        if (b.ld) { hp = Math.min(1, (nwb - b.c0) / 250); tp = 0; fade = Math.max(0, Math.min(1, (b.rt - nwb) / 400)) }
        const hx = sx + (ex - sx) * hp, hy = sy + (ey - sy) * hp, hz = sz + (ez - sz) * hp, tx = sx + (ex - sx) * tp, ty = sy + (ey - sy) * tp, tz = sz + (ez - sz) * tp, ln = Math.hypot(hx - tx, hy - ty, hz - tz) || 1e-6, rad = Math.max(.0005, cd2 * .0006) * (b.ld ? 2.5 : 1);
        _sc.set(ln, rad, rad); _bq.setFromUnitVectors(vX, _bd.set((hx - tx) / ln, (hy - ty) / ln, (hz - tz) / ln)); _p.set((hx + tx) / 2, (hy + ty) / 2, (hz + tz) / 2); _m4.compose(_p, _bq, _sc); bolts.setMatrixAt(bi, _m4);
        bolts.setColorAt(bi, _cc.setRGB(b.side ? 1 : .35, b.side ? .45 : .9, b.side ? .8 : 1).multiplyScalar(fade * 1.8)); bi++ }
      { const tn = Battle.time(); for (const f of Battle.frags() as any[]) { if (!f.ric || bi >= MAXP - 1) continue; const life = (tn - f.t0) / f.d; if (life < 0 || life > 1) continue; const vl = Math.hypot(f.vx, f.vy) || 1, ln = Math.max(.02, vl * .07), cd2 = cam.position.distanceTo(_p.set(f.x, f.z || 0, f.y)), rad = Math.max(.0004, cd2 * .00045), fade = 1 - life;
          _sc.set(ln, rad, rad); _bq.setFromUnitVectors(vX, _bd.set(f.vx / vl, 0, f.vy / vl)); _p.set(f.x - f.vx / vl * ln * .5, f.z || 0, f.y - f.vy / vl * ln * .5); _m4.compose(_p, _bq, _sc); bolts.setMatrixAt(bi, _m4); bolts.setColorAt(bi, _cc.setRGB(1, .8, .45).multiplyScalar(fade * 2)); bi++ } }
      bolts.count = bi; bolts.instanceMatrix.needsUpdate = true; if (bolts.instanceColor) bolts.instanceColor.needsUpdate = true }
    for (const b of [] as any[]) { if (bc >= 400 || !b.a) continue; const o = bc * 6; bc++ }
    beamLines.geometry.setDrawRange(0, bc * 2); (beamLines.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    {const tb2 = Battle.time(); let k = 0; const cc = new THREE.Color();
      for (const f of Battle.frags() as any[]) { if (f.ln || f.plate || k >= MAXPL) continue; const life = (tb2 - f.t0) / f.d; if (life > 1) continue;
        dummy.position.set(f.x, f.z || 0, f.y); const fade = Math.min(1, (1 - life) / .35), sz = Math.max(f.sz, cam.position.distanceTo(dummy.position) * .0009) * (.35 + .65 * fade);
        dummy.rotation.set(f.rx || 0, -f.rot, f.ry || 0); dummy.scale.set(sz * 1.5, sz * .25, sz); dummy.updateMatrix(); plateMesh.setMatrixAt(k, dummy.matrix);
        const hot = Math.max(0, 1 - (tb2 - f.t0) / 4), base = f.side ? [.55, .32, .2] : [.28, .4, .5]; cc.setRGB(base[0] * fade + hot * .9, base[1] * fade + hot * .35, base[2] * fade); plateMesh.setColorAt(k, cc); k++ }
      plateMesh.count = k; plateMesh.instanceMatrix.needsUpdate = true; if (plateMesh.instanceColor) plateMesh.instanceColor.needsUpdate = true}
    {const np2 = performance.now(), dts = 1 / 60; let k = 0; for (let i = cas.length - 1; i >= 0; i--) { const c = cas[i], age = (np2 - c.t0) / 1000; if (age > 1.2) { cas.splice(i, 1); continue }
        c.x += c.vx * Battle.getSpeed() * .016; c.y += c.vy * Battle.getSpeed() * .016; c.z += c.vz * Battle.getSpeed() * .016; // медленно улетают и вращаются
        dummy.position.set(c.x, c.y, c.z); dummy.rotation.set(c.rx + age * c.rs, age * c.rs * .6, 0); const cz = Math.max(c.sz, cam.position.distanceTo(dummy.position) * .0012); dummy.scale.set(cz * 1.6, cz * .7, cz * .7); dummy.updateMatrix(); casings.setMatrixAt(k++, dummy.matrix) }
      casings.count = k; casings.instanceMatrix.needsUpdate = true}
    { const nw = performance.now(), dtf = .016 * Battle.getSpeed(), cc = new THREE.Color(); let k = 0, kd = 0; const qd = new THREE.Quaternion(), ea = new THREE.Vector3();
      for (let i = tdeb.length - 1; i >= 0; i--) if (nw - tdeb[i].t0 > tdeb[i].life) tdeb.splice(i, 1);
      for (const d of tdeb) { if (k >= MAXTD) break; const a = (nw - d.t0) / d.life; d.p.addScaledVector(d.v, dtf); const wl = d.w.length(); if (wl > 1e-6) { qd.setFromAxisAngle(ea.copy(d.w).normalize(), wl * .016 * Math.max(1, Battle.getSpeed() * .2)); d.q.premultiply(qd) }
        const fade = Math.min(1, (1 - a) / .35), ff = .4 + .6 * fade; _sc.set(d.sz.x * ff, d.sz.y * ff, d.sz.z * ff); _m4.compose(d.p, d.q, _sc); tdMesh.setMatrixAt(k, _m4);
        if (d.dec) for (const e of d.dec) { if (kd >= MAXDD) break; _p.set(e.ox * ff, e.ny * ff, e.oz * ff).applyQuaternion(d.q).add(d.p); _q.copy(d.q).multiply(e.lq); _sc.copy(e.sc).multiplyScalar(ff); _m4.compose(_p, _q, _sc); tdDec.setMatrixAt(kd, _m4); tdDec.setColorAt(kd, e.col); kd++ }
        const hot = Math.max(0, 1 - (nw - d.t0) / 1800), base = d.side ? [.55, .32, .2] : [.28, .4, .5]; cc.setRGB(base[0] * fade + hot * .9, base[1] * fade + hot * .35, base[2] * fade); tdMesh.setColorAt(k, cc); k++ }
      tdMesh.count = k; tdMesh.instanceMatrix.needsUpdate = true; if (tdMesh.instanceColor) tdMesh.instanceColor.needsUpdate = true; tdDec.count = kd; tdDec.instanceMatrix.needsUpdate = true; if (tdDec.instanceColor) tdDec.instanceColor.needsUpdate = true }
    {const tb = Battle.time(); let k = 0; const col2 = new THREE.Color();
      for (const f of Battle.fx() as any[]) { if (k >= MAXFX) break; const life = (tb - f.t0) / (f.d || 3); if (life < 0 || life > 1) continue;
        dummy.position.set(f.x, f.z || 0, f.y); const rr = Math.max((f.r || .6) * (.5 + life) * .12, cam.position.distanceTo(dummy.position) * .003); dummy.scale.setScalar(rr); dummy.rotation.set(0, 0, 0); dummy.updateMatrix();
        fxMesh.setMatrixAt(k, dummy.matrix); fxMesh.setColorAt(k, col2.setRGB(1 - life * .3, .75 - life * .55, .35 - life * .3).multiplyScalar((1 - life) * (1 - life))); k++ }
      fxMesh.count = k; fxMesh.instanceMatrix.needsUpdate = true; if (fxMesh.instanceColor) fxMesh.instanceColor.needsUpdate = true}
    { const cf = Battle.cfg && Battle.cfg(), sk = cf ? cf.sky : null; if (sk !== curSky) buildSky(sk || null); if (skyG) skyG.position.copy(cam.position) }
    const rT0 = performance.now(); ren.render(scene, cam);
    if (perfOn) { const nn = performance.now(); pfFrames++; pfJs += rT0 - jsT0; pfRen += nn - rT0;
      if (nn - pfT > 500) { const inf = ren.info.render, sh = Battle.ships() as any[]; let alive = 0; for (const q of sh) if (q.alive) alive++;
        pfExtra = 'кадр ' + (dtEma).toFixed(0) + ' мс\nJS обновление ' + (pfJs / pfFrames).toFixed(1) + ' мс\nrender() CPU ' + (pfRen / pfFrames).toFixed(1) + ' мс\nвызовы ' + inf.calls + ' · треуг. ' + (inf.triangles / 1000).toFixed(0) + 'k\nкорабли ' + alive + ' · авиа ' + (Battle.air() as any[]).length + '\nснаряды ' + (Battle.proj() as any[]).length + ' · искры ' + sparks.length + ' · обломки ' + tdeb.length + ''; pfX = nn; pfT = nn; pfFrames = 0; pfJs = 0; pfRen = 0 } }
  }
  // небо боя: настоящие направления и угловые размеры тел относительно места боя на карте; Солнце задаёт свет и фазы
  let sunL: THREE.DirectionalLight, skyG: THREE.Group | null = null, curSky: any = undefined;
  function skyTex(id: string) {
    return cvTex(256, 128, c => {
      if (id === 'earth') { c.fillStyle = '#2f64b8'; c.fillRect(0, 0, 256, 128); for (let i = 0; i < 26; i++) { c.fillStyle = Math.random() < .6 ? '#4f8a4a' : '#8a7a50'; c.globalAlpha = .85; c.beginPath(); c.ellipse(Math.random() * 256, 20 + Math.random() * 88, 8 + Math.random() * 26, 5 + Math.random() * 12, Math.random() * 3, 0, 6.3); c.fill() } for (let i = 0; i < 40; i++) { c.fillStyle = '#fff'; c.globalAlpha = .35; c.beginPath(); c.ellipse(Math.random() * 256, Math.random() * 128, 10 + Math.random() * 30, 2 + Math.random() * 5, 0, 0, 6.3); c.fill() } }
      else if (id === 'mars') { c.fillStyle = '#b8582f'; c.fillRect(0, 0, 256, 128); for (let i = 0; i < 40; i++) { c.fillStyle = Math.random() < .5 ? '#6e3320' : '#d88a5a'; c.globalAlpha = .45; c.beginPath(); c.ellipse(Math.random() * 256, Math.random() * 128, 6 + Math.random() * 24, 4 + Math.random() * 10, 0, 0, 6.3); c.fill() } }
      else if (id === 'venus') { c.fillStyle = '#d8bf8a'; c.fillRect(0, 0, 256, 128); for (let i = 0; i < 50; i++) { c.fillStyle = Math.random() < .5 ? '#f1deb0' : '#b99a62'; c.globalAlpha = .3; c.fillRect(0, Math.random() * 128, 256, 2 + Math.random() * 8) } }
      else { c.fillStyle = '#9a978f'; c.fillRect(0, 0, 256, 128); for (let i = 0; i < 70; i++) { c.fillStyle = Math.random() < .5 ? '#6c6a64' : '#b9b6ae'; c.globalAlpha = .5; c.beginPath(); c.arc(Math.random() * 256, Math.random() * 128, 2 + Math.random() * 9, 0, 6.3); c.fill() } }
    });
  }
  function buildSky(sk: any) {
    curSky = sk; if (!scene) return;
    if (skyG) { scene.remove(skyG); skyG.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) { if (o.material.map) o.material.map.dispose(); o.material.dispose() } }); skyG = null }
    if (!sk || !sk.length) { sunL.position.set(300, 400, 200); return }
    skyG = new THREE.Group(); const D = 4300;
    for (const b of sk) {
      const r = D * Math.tan(b.ang); if (r < .6) continue;
      const px = b.dx * D, pz = b.dy * D;
      if (b.sun) {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff1c0, fog: false })); m.position.set(px, 0, pz); skyG.add(m);
        const h = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color: 0xffe3a0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })); h.scale.setScalar(r * 9); h.position.set(px, 0, pz); skyG.add(h);
        sunL.position.set(b.dx * 400, 150, b.dy * 400);
      } else {
        const m = new THREE.Mesh(new THREE.SphereGeometry(r, 40, 28), new THREE.MeshStandardMaterial({ map: skyTex(b.id), roughness: .95, metalness: 0, fog: false })); m.position.set(px, 0, pz); skyG.add(m);
      }
    }
    skyG.renderOrder = -1; scene.add(skyG);
  }
  function reset3d() {
    if (scene) for (const [, g] of models) scene.remove(g);
    puffs.length = 0; for (const w of wrecks) scene.remove(w.g); wrecks.length = 0; models.clear(); tdeb.length = 0; sparks.length = 0; flashes.length = 0; streaks.length = 0; cas.length = 0;
    const im = Battle.impacts() as any[]; lastImp = im.length ? Math.max(...im.map((q: any) => q.id)) : 0;
    follow = true; fitAll = true; curSky = undefined;
  }
  (hooks as any).reset3d = reset3d;
  // превью корабля из конструктора: отдельный мини-бой с одним кораблём, камера медленно крутится вокруг него
  let pv: any = null;
  function pvShow(parts: any, host: HTMLElement, cP?: any) {
    if (pv && pv.cm) { scene.remove(pv.cm); pv.cm = null }
    const spec = cP ? null : previewSpec(parts); // пустой или негодный проект: корабля нет
    const cfg = { fleets: [spec ? [spec] : [], []], env: false, title: 'Превью', onEnd: () => {} };
    if (!pv) { pv = { b: makeBattle(), host, drag: false, wasOn: on, SC0: SC, v0: [yaw, pitch, dist] }; if (!ren) init(); const cvp = ren!.domElement as HTMLElement; cvp.addEventListener('pointerdown', pv.dn = () => { if (pv) pv.drag = true }); addEventListener('pointerup', pv.up = () => { if (pv) pv.drag = false }); (pv.b as any).beginBg(cfg); on = true; SC = 1; reset3d(); pvAim(true) }
    else { pv.host = host; (pv.b as any).beginBg(cfg); const k = [yaw, pitch, dist]; reset3d(); pvAim(false); yaw = k[0]; pitch = k[1] }
    if (cP && pv) { const m = new THREE.Mesh(craftGeo(cP, true), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .45, metalness: .5, flatShading: true })); m.rotation.z = -Math.PI / 2; scene.add(m); pv.cm = m; pvAim(false) }
    (ren!.domElement as HTMLElement).style.display = 'block'; hud.style.display = 'none'; cancelAnimationFrame(raf); frame();
  }
  function pvAim(first: boolean) {
    const s = (pv.b as any).ships()[0]; if (!s) { if (pv.cm) { follow = false; fitAll = false; tgt.set(0, 0, 0); if (first) { yaw = .6; pitch = .3 } dist = 3.4 } return } follow = false; fitAll = false; tgt.set(s.x, s.z, s.y); if (first) { yaw = .6; pitch = .3 } dist = s.T.L * 1.6;
  }
  function pvHide() {
    if (!pv) return; const p = pv; pv = null; if (p.cm) scene.remove(p.cm); cancelAnimationFrame(raf); const cvp = ren!.domElement as HTMLElement; cvp.removeEventListener('pointerdown', p.dn); removeEventListener('pointerup', p.up);
    cvp.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:3;display:' + (p.wasOn ? 'block' : 'none'); ren!.setSize(1, 1, false);
    SC = p.SC0; on = p.wasOn; yaw = p.v0[0]; pitch = p.v0[1]; dist = p.v0[2]; reset3d(); if (on) { hud.style.display = 'block'; frame() }
  }
  (hooks as any).preview3d = pvShow; (hooks as any).preview3dOff = pvHide;
  btn.onclick = () => {
    if (pv) return; on = !on; btn.classList.toggle('on', on);
    if (on) { if (!ren) init(); (ren!.domElement as HTMLElement).style.display = 'block'; hud.style.display = 'block'; follow = true; const s = Battle.ships().find((q: any) => q.alive); if (s) { tgt.set(s.x, s.z, s.y); fitAll = true; dist = 120 } cancelAnimationFrame(raf); frame() }
    else { cancelAnimationFrame(raf); if (ren) (ren.domElement as HTMLElement).style.display = 'none'; hud.style.display = 'none' }
  };
  (window as any).__b3d = { craftGeo, models, lz: (sh: any) => { const g = models.get(sh); const l = g && g.userData.laser; return l ? [l.lens.position.x, l.lens.position.y, g.userData.L, g.userData.x1, g.visible, l.lens.visible] : g ? 'nolaser det=' + g.userData.det + ' lod=' + g.userData.lod : 'nog' }, look: (sh: any, y: number, pt: number, d: number) => { if (sh) tgt.set(sh.x, sh.z || 0, sh.y); follow = false; fitAll = false; yaw = y; pitch = pt; dist = d }, qual: () => qual, info: () => ren ? { c: ren.info.render.calls, t: ren.info.render.triangles, g: ren.info.memory.geometries } : null, puffN: () => puffs.length, dbg, shellMat, crater: (sh: any) => { const g = models.get(sh); if (!g) return -1; const u = g.userData; if (!u.tilesL || !u.shell) return -2; const xm = u.x0 + u.Lk * .5, r = u.L * .09; let n = 0; for (const q of u.tilesL as any[]) if (q.f === 0) { const d = Math.hypot(q.px - xm, q.pz); if (d < r) { q.cur = Math.round(q.n * Math.max(0, d / r - .15) / .85 * (d < r * .25 ? 0 : 1)); q.dirty = true; n++ } } u.shellDirty = true; updateShell(sh, u); const pp = u.shell.geometry.attributes.position.array, bb = u.shellData.base; let dv = 0, mx = 0; for (let i = 0; i < u.shellData.nv; i++) { const d = Math.hypot(pp[i * 3 + 1] - bb[i * 3 + 1], pp[i * 3 + 2] - bb[i * 3 + 2]); if (d > mx) mx = d } for (let i = 0; i < u.shellData.nv; i++) { const d = Math.hypot(pp[i * 3 + 1] - bb[i * 3 + 1], pp[i * 3 + 2] - bb[i * 3 + 2]); if (d < mx * .6) dv++ } let bi = -1, bd = 1e9; for (let i = 0; i < u.shellData.nv; i++) { if ((u.shellData.map[i * 5] | 0) !== 0) continue; const d = Math.hypot(bb[i * 3] - xm, bb[i * 3 + 2]); if (d < bd) { bd = d; bi = i } } const cen = Math.hypot(pp[bi * 3 + 1] - bb[bi * 3 + 1], pp[bi * 3 + 2] - bb[bi * 3 + 2]); return [n, mx, cen, thL(u), bd, r] }, cf: () => camFighter(), fh1: () => { const d = new THREE.Object3D(), f = new THREE.Vector3(); cam.getWorldDirection(f); d.position.copy(cam.position).addScaledVector(f, 3); d.scale.setScalar(1.6); d.rotation.set(.4, .3, .5); d.updateMatrix(); fightersHi.setMatrixAt(0, d.matrix); fightersHi.setColorAt(0, new THREE.Color(0x9fd8ff)); fightersHi.count = 1; fightersHi.instanceMatrix.needsUpdate = true; fightersHi.instanceColor!.needsUpdate = true; stepFreeze = true }, peelDecal: (sh: any, look: boolean, doPeel: boolean) => { const g = models.get(sh); if (!g || !g.userData.arm) return -1; const d = (sh.vd as any[]).find(x => x.a3 && !x.a3.dead && x.a3.q.cur - 1 === x.a3.l); if (!d) return -2; const a = d.a3; g.updateMatrixWorld(true); const w = g.localToWorld(decalPos(a, thL(g.userData), new THREE.Vector3())); if (look) { tgt.copy(w); follow = false; fitAll = false; dist = Math.max(.3, g.userData.L * .02) } if (doPeel) { a.q.cur--; a.q.dirty = true; spawnLayerDebris(sh, g, a.q, a.q.cur); g.userData.armT = 0 } return 1 }, fakeHit: (n: number) => { let g: any = null, bd = 1e18; for (const [, m] of models) if (m.userData.det && m.userData.tilesL) { const d = m.position.distanceToSquared(cam.position); if (d < bd) { bd = d; g = m } } if (!g) return -1; const sh = g.userData.s, im = Battle.impacts() as any[]; for (let i = 0; i < n; i++) { const a = Math.random() * 6.28; im.push({ id: 1e6 + (dbg.fh = (dbg.fh || 0) + 1), x: sh.x + Math.cos(a) * sh.T.L * .12, y: sh.y + Math.sin(a) * sh.T.L * .03, z: sh.z, nx: 0, ny: 1, pw: 5, k: 'rail', s: sh }) } return n },  peeled: () => { let r: any[] = []; for (const [, g] of models) if (g.userData.det && g.userData.tilesL) { let a = 0, l = 0; for (const q of g.userData.tilesL) { if (q.cur < q.n) a++; l += q.n - q.cur } r.push([a, l, g.userData.tilesL.length]) } return r }, dmgNear: (rad: number, layers: number) => { if (!tcam) return -1; const g = tcam.parent.parent, sh = g.userData.s, f = NRL.findIndex(a => Math.abs(a[0] - tcam.userData.n.x) + Math.abs(a[1] - tcam.userData.n.y) + Math.abs(a[2] - tcam.userData.n.z) < .1); let c = 0; const z = sh.zones[f]; for (const q of g.userData.tilesL as any[]) { if (q.f !== f || Math.hypot(q.px - tcam.position.x, q.py - tcam.position.y, q.pz - tcam.position.z) > rad * tcam.userData.r) continue; const i0 = Math.floor(q.c0 * z.nc), i1 = Math.max(i0 + 1, Math.floor(q.c1 * z.nc)); for (let k = i0; k < i1; k++) z.cols[k] = Math.max(0, z.cols[k] - layers); c++ } return c },  camTurret: () => { const sel = Battle.anchorSel && Battle.anchorSel(), g = sel && models.get(sel); return [!!sel, !!g, g && g.userData.det, g && g.userData.tur.children.length, !!tcam] }, dbg, pt: (x: number, y: number, z: number) => { if (!ren) return null; const v = new THREE.Vector3(x, y, z).project(cam), r = ren.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height] }, screenOf: (sh: any) => { const g = models.get(sh); if (!g || !ren) return null; const v = g.position.clone().project(cam), r = ren.domElement.getBoundingClientRect(); return [r.left + (v.x + 1) / 2 * r.width, r.top + (1 - v.y) / 2 * r.height] }, toggle: () => btn.click(), set: (o: any) => { if (o.yaw != null) yaw = o.yaw; if (o.pitch != null) pitch = o.pitch; if (o.dist != null) dist = o.dist; if (o.sc != null) SC = o.sc; if (o.follow != null) follow = o.follow; if (o.fit != null) fitAll = o.fit } };
}
