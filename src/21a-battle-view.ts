// @ts-nocheck
// СЛОЙ ОТОБРАЖЕНИЯ БОЯ: единственная точка, где графика смотрит в симуляцию.
// Графика получает: snapshot() — плоские снимки кораблей (числа и id, без ссылок на объекты боя) и события через курсор (drain).
// Слой ничего не решает и не меняет в бою — только читает состояние и превращает изменения в события.
// События: impact (попадание), fire (выстрел модуля), mod_dead / mod_alive (модуль выбит / починен), ship_dead, ram.
// Очередь общая, у каждого потребителя свой курсор: событие не теряется между кадрами и не воспроизводится повторно.
import { Battle } from './05-battle.ts';

export type ModView = { id: number; k: string; alive: boolean; loc: { zone: number; face: number | null; u: number | null; v: number | null; ti: number } };
export type ShipView = { id: number; side: number; alive: boolean; name: string; cls: string; L: number; tons: number;
  x: number; y: number; z: number; hd: number; roll: number; w: number; sx: number; sy: number; ax: number; ay: number; accMax: number; boost: number;
  hp: number; mods: ModView[] };
export type ViewEvent = { seq: number; t: number; type: string; ship?: number; mod?: number; data?: any };

const MAXQ = 4000; // хвост очереди: потребитель, отставший больше чем на столько событий, теряет самые старые (и узнаёт об этом по lost)
let Q: ViewEvent[] = [], seq = 0, lastImp = 0, ramN = 0, tPrev = -1, battleObj: any = null;
const modAlive = new Map<number, boolean>(), shipAlive = new Map<number, boolean>(), fired = new Map<number, number>();

function push(type: string, t: number, ship?: number, mod?: number, data?: any) { Q.push({ seq: ++seq, t, type, ship, mod, data }); if (Q.length > MAXQ) Q.splice(0, Q.length - MAXQ) }

// новый бой (другой список кораблей или время пошло назад) — состояние слоя с нуля; старые события остаются, их seq не повторяются
function resetIfNew() {
  const sh = Battle.ships(), t = Battle.time();
  if (sh !== battleObj || t < tPrev) {
    battleObj = sh; modAlive.clear(); shipAlive.clear(); fired.clear(); ramN = ((Battle.stat() || {}).ram || []).length;
    const im = Battle.impacts(); lastImp = im.length ? Math.max(...im.map((q: any) => q.id)) : 0;
    for (const s of sh) { shipAlive.set(s.uid, s.alive); for (const z of s.zones || []) for (const m of z.mods) { if (m.id == null) continue; modAlive.set(m.id, m.alive); fired.set(m.id, m.firedT ?? -1e9) } }
  }
  tPrev = t;
}

// раз за кадр (до того, как графика читает события): сравнить бой с прошлым опросом и выпустить события
export function poll() {
  if (!Battle.ships || !Battle.ships()) return; resetIfNew(); const t = Battle.time();
  for (const q of Battle.impacts() as any[]) { if (q.id <= lastImp) continue; lastImp = q.id;
    push('impact', t, q.s && q.s.uid, undefined, { k: q.k, x: q.x, y: q.y, z: q.z, nx: q.nx, ny: q.ny, nz: q.nz, pw: q.pw, left: q.left }) }
  for (const s of Battle.ships() as any[]) {
    const was = shipAlive.get(s.uid); if (was === undefined) shipAlive.set(s.uid, s.alive); else if (was && !s.alive) { shipAlive.set(s.uid, false); push('ship_dead', t, s.uid, undefined, { why: s.why }) }
    for (const z of s.zones || []) for (const m of z.mods) { if (m.id == null) continue;
      const a = modAlive.get(m.id); if (a === undefined) modAlive.set(m.id, m.alive); else if (a !== m.alive) { modAlive.set(m.id, m.alive); push(m.alive ? 'mod_alive' : 'mod_dead', t, s.uid, m.id, { k: m.k, loc: m.loc }) }
      const f = m.firedT; if (f != null && f !== fired.get(m.id)) { fired.set(m.id, f); push('fire', t, s.uid, m.id, { k: m.k, loc: m.loc }) } }
  }
  { const R = ((Battle.stat() || {}).ram || []) as any[]; for (; ramN < R.length; ramN++) push('ram', t, undefined, undefined, { ...R[ramN] }) }
}

// события после курсора; вернуть новый курсор. lost — сколько событий потребитель пропустил из-за переполнения очереди
export function drain(cursor: number): { events: ViewEvent[]; cursor: number; lost: number } {
  const first = Q.length ? Q[0].seq : seq + 1, lost = Math.max(0, first - cursor - 1), events = Q.filter(e => e.seq > cursor);
  return { events, cursor: seq, lost };
}
export const headCursor = () => seq; // «с этого момента»: курсор, с которого видны только новые события

// плоский снимок кораблей: только то, что нужно для отображения
export function snapshot(): { t: number; ships: ShipView[] } {
  const ships: ShipView[] = [];
  for (const s of (Battle.ships() || []) as any[]) {
    const mods: ModView[] = []; for (const z of s.zones || []) for (const m of z.mods) if (m.id != null) mods.push({ id: m.id, k: m.k, alive: m.alive, loc: m.loc });
    ships.push({ id: s.uid, side: s.side, alive: s.alive, name: s.T && s.T.n, cls: s.cls, L: s.T && s.T.L, tons: s.T && s.T.tons,
      x: s.x, y: s.y, z: s.z || 0, hd: s.hd || 0, roll: s.roll || 0, w: s.w || 0, sx: s.sx || 0, sy: s.sy || 0, ax: s.aex || 0, ay: s.aey || 0, accMax: (s.acc || 5) / 1000, boost: s.bst || 1,
      hp: s.total ? s.aliveN / s.total : 1, mods });
  }
  return { t: Battle.time(), ships };
}
// снимок одного корабля по id (для частей графики, которые обновляют модель по кораблю)
export function shipView(id: number): ShipView | null { for (const s of (Battle.ships() || []) as any[]) if (s.uid === id) return snapshot1(s); return null }
function snapshot1(s: any): ShipView { return { id: s.uid, side: s.side, alive: s.alive, name: s.T && s.T.n, cls: s.cls, L: s.T && s.T.L, tons: s.T && s.T.tons,
  x: s.x, y: s.y, z: s.z || 0, hd: s.hd || 0, roll: s.roll || 0, w: s.w || 0, sx: s.sx || 0, sy: s.sy || 0, ax: s.aex || 0, ay: s.aey || 0, accMax: (s.acc || 5) / 1000, boost: s.bst || 1,
  hp: s.total ? s.aliveN / s.total : 1, mods: [] } }
export function modsOf(id: number): ModView[] { for (const s of (Battle.ships() || []) as any[]) if (s.uid === id) { const r: ModView[] = []; for (const z of s.zones || []) for (const m of z.mods) if (m.id != null) r.push({ id: m.id, k: m.k, alive: m.alive, loc: m.loc }); return r } return [] }
export const View = { poll, drain, headCursor, snapshot, shipView, modsOf };
