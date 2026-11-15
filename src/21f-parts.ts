// @ts-nocheck
// ПРОЦЕДУРНЫЕ ДЕТАЛИ КОРАБЛЕЙ: единый реестр генераторов и единый интерфейс экземпляра детали.
// Деталь = геометрия Three.js из параметров + именованные части (pieces) + точки крепления (sockets) + привязка к модулю симуляции (moduleId).
// Части можно независимо скрывать, повреждать (0…1), отсоединять (обломок в мире) и чинить. Бой о деталях не знает: связь — через id модуля и события слоя отображения.
import * as THREE from 'three';
import { railTurret } from './21d-spine.ts';

export type Socket = { name: string; pos: THREE.Vector3; dir: THREE.Vector3 }; // в системе детали
export type PartDef = {
  type: string;
  build(params: any): { root: THREE.Object3D; sockets?: Socket[] }; // геометрия из параметров
};

const REG = new Map<string, PartDef>();
export function registerPart(def: PartDef) { REG.set(def.type, def) }
export const partTypes = () => [...REG.keys()];

// Визуальные состояния части (не боевые!): бой сообщает, жив ли модуль; графика только показывает.
//  attached — закреплена; damaged — повреждена (копоть по степени); disabled — функционально уничтожена, остаётся на месте;
//  detached — отсоединена: самостоятельное тело (скорость, вращение, инерция, столкновения); shattered — разбита на обломки (части-обломки тоже тела).
export type PieceState = 'attached' | 'damaged' | 'disabled' | 'detached' | 'shattered';

// ТЕЛО ОБЛОМКА: всё отсоединённое живёт здесь, вне корабля. Мировые координаты three.js; скорость и угловая скорость — в единицах сцены в секунду.
export type Body = { obj: THREE.Object3D; v: THREE.Vector3; w: THREE.Vector3; r: number; part: number; piece: string; gen: number };
const BODIES: Body[] = [];
export const debris = () => BODIES;
const _q = new THREE.Quaternion(), _e = new THREE.Vector3();
function radiusOf(o: THREE.Object3D) { const b = new THREE.Box3().setFromObject(o); return Math.max(1e-3, b.getSize(_e).length() / 2) }
// шаг обломков: инерция и вращение; collide(body) → объект столкновения {normal, v?} или null — кто с кем сталкивается, решает вызывающий (камни, корпуса, другие обломки)
export function stepDebris(dt: number, collide?: (b: Body) => { normal: THREE.Vector3; v?: THREE.Vector3; hard?: number } | null) {
  for (let i = BODIES.length - 1; i >= 0; i--) { const b = BODIES[i]; b.obj.position.addScaledVector(b.v, dt);
    const wl = b.w.length(); if (wl > 1e-9) { _q.setFromAxisAngle(_e.copy(b.w).divideScalar(wl), wl * dt); b.obj.quaternion.premultiply(_q) }
    const c = collide && collide(b); if (c) { const rel = b.v.clone().sub(c.v || new THREE.Vector3()), vn = rel.dot(c.normal);
      if (vn < 0) { b.v.addScaledVector(c.normal, -1.6 * vn); b.w.multiplyScalar(.7) } // отскок без проникновения
      if ((c.hard ?? 1) * -vn > b.r * 2 && b.gen < 2) shatterBody(b, -vn) } } } // удар сильнее порога — тело разлетается на обломки
// разбить тело: дочерние сетки становятся отдельными телами; одиночная сетка — несколько осколков-кубиков её материала
function shatterBody(b: Body, energy: number) { const i = BODIES.indexOf(b); if (i < 0) return []; BODIES.splice(i, 1); const par = b.obj.parent, out: Body[] = [], meshes: THREE.Mesh[] = [];
  b.obj.traverse((m: any) => { if (m.isMesh) meshes.push(m) }); b.obj.updateMatrixWorld(true);
  const spread = Math.max(b.v.length() * .2, energy * .3, b.r * .5);
  if (meshes.length > 1) for (const m of meshes) { par.attach(m); out.push(addBody(m, b.v.clone().add(_e.randomDirection().multiplyScalar(spread)), b.w.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(1.5)), b.part, b.piece, b.gen + 1)) }
  else { const m = meshes[0], sz = b.r * .4; for (let k = 0; k < 6; k++) { const sh = new THREE.Mesh(new THREE.BoxGeometry(sz * (.5 + Math.random()), sz * (.3 + Math.random() * .5), sz * (.4 + Math.random() * .6)), m ? m.material : undefined);
      sh.position.copy(b.obj.getWorldPosition(new THREE.Vector3())).add(new THREE.Vector3().randomDirection().multiplyScalar(b.r * .5)); par.add(sh); out.push(addBody(sh, b.v.clone().add(new THREE.Vector3().randomDirection().multiplyScalar(spread)), new THREE.Vector3().randomDirection().multiplyScalar(3), b.part, b.piece, b.gen + 1)) } }
  if (meshes.length <= 1 || b.obj.children.length === 0) b.obj.removeFromParent(); return out }
function addBody(obj: THREE.Object3D, v: THREE.Vector3, w: THREE.Vector3, part: number, piece: string, gen = 0) { const b = { obj, v, w, r: radiusOf(obj), part, piece, gen }; BODIES.push(b); return b }

let PID = 0;
export class Part {
  id = ++PID; type: string; params: any; root: THREE.Group; sockets = new Map<string, Socket>(); pieces = new Map<string, THREE.Object3D>();
  moduleId: number | null = null; state = new Map<string, PieceState>(); dmg = new Map<string, number>(); private def: PartDef; private orig = new Map<THREE.Mesh, any>();
  constructor(def: PartDef, params: any) {
    this.def = def; this.type = def.type; this.params = params;
    const b = def.build(params); this.root = new THREE.Group(); this.root.name = 'part:' + def.type; this.root.add(b.root);
    for (const c of b.root.children) if (c.name) { this.pieces.set(c.name, c); this.state.set(c.name, 'attached') } // части — именованные дочерние объекты генератора
    for (const s of b.sockets || []) this.sockets.set(s.name, s);
    this.root.userData.part = this;
  }
  // положение детали на корпусе: точка и нормаль корпуса (ось Y детали), поворот вокруг неё
  mount(pos: THREE.Vector3, normal = new THREE.Vector3(0, 1, 0), spin = 0) { this.root.position.copy(pos); this.root.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), normal.clone().normalize()); this.root.rotateY(spin); return this }
  bindModule(id: number) { this.moduleId = id; BIND.set(id, this); return this }
  piece(name: string) { return this.pieces.get(name) || null }
  hide(name: string) { const p = this.piece(name); if (p) p.visible = false }
  show(name: string) { const p = this.piece(name); if (p && this.onShip(name)) p.visible = true }
  onShip(name: string) { const st = this.state.get(name); return st === 'attached' || st === 'damaged' || st === 'disabled' }
  // повреждение части 0…1 — копоть; материалы копируются при первом повреждении, общие материалы генератора не трогаем
  damage(name: string, k: number) { const p = this.piece(name); if (!p) return; const v = Math.max(0, Math.min(1, k)); this.dmg.set(name, v);
    if (this.state.get(name) === 'attached' && v > 0) this.state.set(name, 'damaged');
    p.traverse((m: any) => { if (!m.isMesh) return; if (!this.orig.has(m)) { this.orig.set(m, m.material); m.material = Array.isArray(m.material) ? m.material.map(x => x.clone()) : m.material.clone() }
      const O = this.orig.get(m), set = (mt, o) => { if (mt.color && o.color) mt.color.copy(o.color).multiplyScalar(1 - .82 * v); if (mt.emissiveIntensity != null) mt.emissiveIntensity = (o.emissiveIntensity || 0) * (1 - v) };
      if (Array.isArray(m.material)) m.material.forEach((mt, i) => set(mt, O[i])); else set(m.material, O) }) }
  // функционально уничтожена: остаётся на месте, в копоти, без свечения
  disable(name?: string) { for (const n of name ? [name] : [...this.pieces.keys()]) { if (!this.onShip(n)) continue; this.damage(n, 1); this.state.set(n, 'disabled') } }
  // отсоединить часть: уходит из корабля в мир с прежними мировыми координатами и ориентацией и становится телом.
  // shipV — скорость корабля в мире, impulse — добавка от причины отрыва (удар, взрыв, таран), w — угловая скорость (если не задана — небольшая от импульса)
  detach(name: string, o: { world?: THREE.Object3D; shipV?: THREE.Vector3; shipW?: THREE.Vector3; impulse?: THREE.Vector3; w?: THREE.Vector3 } = {}) {
    const p = this.piece(name); if (!p || !this.onShip(name)) return null; let top: any = o.world || this.root; if (!o.world) while (top.parent) top = top.parent;
    p.updateMatrixWorld(true); const wp = p.getWorldPosition(new THREE.Vector3()), rp = this.root.getWorldPosition(new THREE.Vector3());
    top.attach(p); this.state.set(name, 'detached');
    const v = (o.shipV ? o.shipV.clone() : new THREE.Vector3()).add(o.impulse || new THREE.Vector3());
    if (o.shipW) v.add(o.shipW.clone().cross(wp.clone().sub(rp))); // точка вращающегося корабля движется ещё и по кругу
    const w = o.w ? o.w.clone() : (o.shipW ? o.shipW.clone() : new THREE.Vector3()).add(new THREE.Vector3().randomDirection().multiplyScalar((o.impulse ? o.impulse.length() : 0) / Math.max(.1, radiusOf(p))));
    return addBody(p, v, w, this.id, name) }
  // разбить часть на обломки (на месте или уже оторванную)
  shatter(name: string, o: { world?: THREE.Object3D; shipV?: THREE.Vector3; impulse?: THREE.Vector3 } = {}) {
    let b = BODIES.find(q => q.part === this.id && q.piece === name); if (!b) b = this.detach(name, o); if (!b) return [];
    this.state.set(name, 'shattered'); return shatterBody(b, o.impulse ? o.impulse.length() : b.r * 4) }
  // модуль снова жив: копоть снимается с того, что осталось на корабле; оторванное не возвращается
  repair() { for (const [m, o] of this.orig) m.material = o; this.orig.clear(); this.dmg.clear(); for (const [n, st] of this.state) if (st === 'damaged' || st === 'disabled') this.state.set(n, 'attached') }
}
export function createPart(type: string, params: any = {}) { const d = REG.get(type); if (!d) throw new Error('нет детали ' + type); return new Part(d, params) }

// привязка деталей к модулям симуляции. События слоя отображения задают боевое состояние; графика его только показывает:
// mod_dead → disabled (на месте). Отрыв и разрушение — только по явной команде (будущие события боя с причиной и импульсом: part_detach / part_shatter).
const BIND = new Map<number, Part>();
export const partOfModule = (id: number) => BIND.get(id) || null;
export function unbindAll() { BIND.clear() }
export function applyViewEvent(ev: any, o: any = {}) { const p = ev.mod != null ? BIND.get(ev.mod) : null; if (!p) return null;
  if (ev.type === 'mod_dead') { p.disable(); return p } if (ev.type === 'mod_alive') { p.repair(); return p }
  if (ev.type === 'part_detach') return p.detach(ev.data.piece, { ...o, impulse: ev.data.impulse }); if (ev.type === 'part_shatter') return p.shatter(ev.data.piece, { ...o, impulse: ev.data.impulse }); return null }

// ── детали ──────────────────────────────────────────────────────────────
// Рельсовая башня из 21d-spine: s — масштаб, n — число стволов (1–4). Крепление — основание (ось Y — нормаль корпуса), дула — по +X.
registerPart({ type: 'rail_turret',
  build({ s = 1, n = 1 }) { const root = railTurret(s, n), sockets: Socket[] = [{ name: 'mount', pos: new THREE.Vector3(0, 0, 0), dir: new THREE.Vector3(0, 1, 0) }];
    for (const c of root.children) if (/^barrel_\d$/.test(c.name)) sockets.push({ name: 'muzzle_' + c.name.slice(7), pos: c.position.clone().add(new THREE.Vector3(5 * s, 0, 0)), dir: new THREE.Vector3(1, 0, 0) });
    return { root, sockets } } });
