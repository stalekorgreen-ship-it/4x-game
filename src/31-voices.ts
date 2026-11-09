// @ts-nocheck
// Голоса радиопереговоров: роли, кто что говорит, пути к файлам. Описание и таблица реплик — docs/voices.md.
// Подключение: Sfx.radio(side, key, ship) в 18-audio.ts → voiceFile(key, kindOf(ship), side) → проиграть mp3.

export const VOICES = {
  lead: {voice: 'Artem Lebedev', crew: 'fighters', n: 'Ведущий звена, ас'},
  wing: {voice: 'Maxim (Conversational)', crew: 'fighters', n: 'Ведомый'},
  stealth: {voice: 'Vlad Keep', crew: 'fighters', n: 'Перехватчик-стелс'},
  captain: {voice: 'Sergey', crew: 'bridge', n: 'Капитан флагмана («Вася»)'},
  xo: {voice: 'Alex Bell', crew: 'bridge', n: 'Старпом'},
  gunner: {voice: 'Pavel', crew: 'guns', n: 'Наводчик («Петя»)'},
  fireoff: {voice: 'Egor T', crew: 'guns', n: 'Офицер огня'},
  chief: {voice: 'Viktoriya Voloshina', crew: 'eng', n: 'Главный инженер («Вика»)'},
  mech: {voice: 'VASKO', crew: 'eng', n: 'Механик'},
  medic: {voice: 'Marina', crew: 'base', n: 'Медофицер, связь эвакуации'},
  dispatch: {voice: 'Maksim (Deep Calm)', crew: 'base', n: 'Диспетчер базы, навигатор'},
};
// Кто есть на борту: истребитель, флагман, обычный корабль, база
export const CREW = {
  fighter: ['lead', 'wing', 'stealth'],
  flagship: ['captain', 'xo', 'gunner', 'fireoff', 'chief', 'mech', 'medic'],
  ship: ['gunner', 'fireoff', 'chief', 'mech', 'medic'],
  base: ['dispatch', 'medic'],
};
// Событие → кто говорит (по порядку предпочтения; берётся первый, кто есть на борту), n — сколько записано вариантов
export const LINES = {
  contact: {who: ['stealth', 'xo', 'gunner'], n: 0}, fire: {who: ['captain', 'lead', 'fireoff'], n: 0}, laser: {who: ['gunner'], n: 0},
  missile: {who: ['fireoff', 'lead'], n: 0}, inmis: {who: ['xo', 'wing', 'chief'], n: 0}, hit: {who: ['gunner', 'lead'], n: 0},
  kill: {who: ['gunner', 'lead'], n: 0}, dmg: {who: ['chief', 'wing'], n: 0}, mod: {who: ['chief', 'wing'], n: 0},
  eng: {who: ['mech', 'wing'], n: 0}, power: {who: ['chief', 'wing'], n: 0}, heat: {who: ['chief', 'wing'], n: 0},
  dry: {who: ['fireoff', 'lead'], n: 0}, jam: {who: ['xo', 'stealth'], n: 0}, rock: {who: ['mech', 'wing'], n: 0},
  lost: {who: ['xo', 'lead'], n: 0}, evac: {who: ['medic', 'lead'], n: 0}, flee: {who: ['captain', 'xo', 'lead'], n: 0},
  surr: {who: ['xo', 'lead'], n: 0}, board: {who: ['captain', 'xo'], n: 0}, prize: {who: ['captain', 'xo'], n: 0},
  // будут вместе с механиками
  salvo: {who: ['fireoff'], n: 0}, reload: {who: ['fireoff'], n: 0}, aim: {who: ['gunner'], n: 0}, order: {who: ['captain'], echo: 'xo', n: 0},
  shield: {who: ['chief'], n: 0}, repair: {who: ['mech'], n: 0}, launch: {who: ['lead'], n: 0}, attack: {who: ['lead'], n: 0},
  tail: {who: ['wing'], n: 0}, ambush: {who: ['stealth'], n: 0}, pods: {who: ['medic'], n: 0}, land: {who: ['dispatch'], n: 0}, jump: {who: ['dispatch'], n: 0},
};
// Кто на борту у корабля: истребители по типу, флагман — самый тяжёлый корабль стороны в бою
export function kindOf(ship, fleet) {
  if (!ship) return 'ship';
  if (ship.base || ship.station) return 'base';
  if (ship.ty === 'F' || ship.ty === 'B' || ship.fighter) return 'fighter';
  if (fleet && fleet.length) { const big = fleet.filter(s => s.side === ship.side).reduce((a, s) => (s.mass || 0) > (a.mass || 0) ? s : a, ship); if (big === ship) return 'flagship'; }
  return 'ship';
}
export const speaker = (key, kind) => { const L = LINES[key]; if (!L) return null; const on = CREW[kind] || CREW.ship; return L.who.find(r => on.includes(r)) || null; };
// Путь к файлу реплики или null, если записей ещё нет
export function voiceFile(key, kind, side = 0) {
  const L = LINES[key], r = speaker(key, kind); if (!L || !r || !(L.n > 0)) return null;
  return `voice/${side ? 'enemy/' : ''}${r}/${key}_${1 + Math.floor(Math.random() * L.n)}.mp3`;
}
