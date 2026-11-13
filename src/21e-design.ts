// @ts-nocheck
// Корабли из редактора корпусов (public/data/ships.json, собирает tools/export-ships.cjs).
// Модель: готовая сетка с цветами граней + башни (для хука ствола) + сопла. Повреждения — воронки по новой модели (кубы 10 см) — следующим шагом;
// пока попадание оставляет тёмную воронку на обшивке.
import * as THREE from 'three';
import { rawFile } from './00-gd.ts';
let LIST = null;
function list() { if (LIST) return LIST; const f = rawFile('ships'); LIST = (f && f.list) || []; return LIST; }
export const hasDesigns = () => list().length > 0;
const ub = s => { const b = atob(s), u = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; };
const cache = new Map();
function geo(d) {
  if (cache.has(d.name)) return cache.get(d.name);
  const pi = new Int16Array(ub(d.pos).buffer), ci = ub(d.col), n = pi.length, p = new Float32Array(n), c = new Float32Array(n);
  for (let i = 0; i < n; i++) { p[i] = pi[i] / 20; c[i] = ci[i] / 255; }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(p, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
  cache.set(d.name, g); return g;
}
const mat = new THREE.MeshStandardMaterial({ vertexColors: true, metalness: .55, roughness: .45, flatShading: true });
const darkM = new THREE.MeshBasicMaterial({ color: 0x141210 }), hotM = new THREE.MeshBasicMaterial({ color: 0xff6a20 });
export function pickDesign(tons) { const l = list(); if (!l.length) return null; let b = l[0]; for (const d of l) if (Math.abs(Math.log(d.M / tons)) < Math.abs(Math.log(b.M / tons))) b = d; return b; }
export function buildDesign(d) {
  const g = new THREE.Group(), body = new THREE.Mesh(geo(d), mat); g.add(body);
  const turs = [];
  for (const t of d.turs) { const tu = new THREE.Group(), n = new THREE.Vector3(t.n[0], t.n[1], t.n[2]); tu.position.set(t.p[0], t.p[1], t.p[2]); tu.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    const hd = new THREE.Group(); hd.position.y = .6; tu.add(hd); tu.userData = { isTur: 1, head: hd, tipX: t.k === 'gat' ? 6 : 8, n }; g.add(tu); turs.push(tu); }
  const inner = new THREE.Group(); inner.visible = false; g.add(inner);
  const RC = new THREE.Raycaster(), dec = [];
  g.userData = { L: d.L, turs, inner, hu: { sh: { value: new THREE.Matrix4() } }, design: d.name,
    dmg: { hit(ow, dw, kind, r) { g.updateMatrixWorld(true); RC.set(ow, dw.clone().normalize()); const hs = RC.intersectObject(body, false); if (!hs.length) return false; const h = hs[0], lp = g.worldToLocal(h.point.clone()), ln = h.face.normal.clone();
        const rr = Math.max(.15, Math.min(4, r * .25)), m = new THREE.Mesh(new THREE.CircleGeometry(rr, 8), Math.random() < .25 ? hotM : darkM); m.position.copy(lp).addScaledVector(ln, .03); m.lookAt(lp.clone().add(ln)); g.add(m); dec.push(m); if (dec.length > 400) { const o = dec.shift(); g.remove(o); o.geometry.dispose(); } return false; },
      release() {}, step() {} } };
  return g;
}
