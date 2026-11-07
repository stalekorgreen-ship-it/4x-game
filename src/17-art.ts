// @ts-nocheck
// Процедурная графика: логотипы корпораций и туманности для фона. Всё рисуется кодом по названию, картинок не нужно.
const hash = str => { let h = 2166136261; for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = seed => { let s = seed || 1; return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296; };
const cache = {};
export function corpLogo(name, size = 22) {
  const key = name + size; if (cache[key]) return cache[key];
  const r = rng(hash(name)), hue = Math.floor(r() * 360), h2 = (hue + 150 + Math.floor(r() * 60)) % 360;
  const c1 = `hsl(${hue},65%,55%)`, c2 = `hsl(${h2},70%,62%)`, dark = `hsl(${hue},40%,14%)`;
  const shape = Math.floor(r() * 5), glyph = Math.floor(r() * 6), rot = Math.floor(r() * 4) * 15;
  const shp = [`<circle cx="50" cy="50" r="46" fill="${dark}" stroke="${c1}" stroke-width="5"/>`,
    `<polygon points="50,4 92,28 92,72 50,96 8,72 8,28" fill="${dark}" stroke="${c1}" stroke-width="5"/>`,
    `<path d="M14 10h72v44c0 22-22 34-36 40C36 88 14 76 14 54z" fill="${dark}" stroke="${c1}" stroke-width="5"/>`,
    `<polygon points="50,4 96,50 50,96 4,50" fill="${dark}" stroke="${c1}" stroke-width="5"/>`,
    `<rect x="8" y="8" width="84" height="84" rx="22" fill="${dark}" stroke="${c1}" stroke-width="5"/>`][shape];
  const gl = [`<circle cx="50" cy="50" r="14" fill="${c2}"/><ellipse cx="50" cy="50" rx="32" ry="10" fill="none" stroke="${c1}" stroke-width="4" transform="rotate(-25 50 50)"/>`,
    `<path d="M28 68l22-40 22 40z" fill="${c2}"/><path d="M38 68l12-22 12 22z" fill="${dark}"/>`,
    `<rect x="28" y="30" width="44" height="8" fill="${c2}"/><rect x="28" y="46" width="44" height="8" fill="${c1}"/><rect x="28" y="62" width="44" height="8" fill="${c2}"/>`,
    `<path d="M50 24l8 18 20 2-15 13 5 19-18-10-18 10 5-19-15-13 20-2z" fill="${c2}"/>`,
    `<circle cx="50" cy="50" r="22" fill="none" stroke="${c2}" stroke-width="6"/><circle cx="50" cy="50" r="8" fill="${c1}"/><path d="M50 18v14M50 68v14M18 50h14M68 50h14" stroke="${c2}" stroke-width="5"/>`,
    `<path d="M30 70V30l20 20 20-20v40" fill="none" stroke="${c2}" stroke-width="9" stroke-linejoin="round"/>`][glyph];
  return cache[key] = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="vertical-align:middle;flex:none"><g transform="rotate(${rot} 50 50)">${shp}</g>${gl}</svg>`;
}
// туманность: рисуем один раз в отдельный холст нужного размера
let neb = null, nW = 0, nH = 0;
export function nebula(W, H) {
  if (neb && nW === W && nH === H) return neb;
  neb = document.createElement('canvas'); neb.width = W; neb.height = H; nW = W; nH = H;
  const g = neb.getContext('2d'), r = rng(777), pal = [[70, 90, 200], [150, 60, 170], [40, 140, 160], [200, 90, 90]];
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = r() * H, R = (.18 + r() * .3) * Math.max(W, H), c = pal[Math.floor(r() * pal.length)], a = .035 + r() * .045;
    const gr = g.createRadialGradient(x, y, 0, x, y, R); gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},${a})`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  return neb;
}

// ---------- иллюстрации технологий, событий и фоны панелей: всё рисуется кодом (SVG), без картинок ----------
const AREA = {phys: ['#0f1b4d', '#6a3cc2', '#58c8ff'], eng: ['#251f1b', '#b8742a', '#ffcf6a'], bio: ['#0c2b27', '#2f9d6b', '#9af0b8']};
const RAR = {c: '#9aa7b8', u: '#4aa3ff', r: '#e3a94f'};
const stars = (r, n, W, H, col = '#fff') => Array.from({length: n}, () => `<circle cx="${(r() * W).toFixed(1)}" cy="${(r() * H).toFixed(1)}" r="${(r() * 1.1 + .25).toFixed(2)}" fill="${col}" opacity="${(.25 + r() * .6).toFixed(2)}"/>`).join('');
const planet = (x, y, R, c1, c2, ring) => `<defs><radialGradient id="pg${x | 0}${R | 0}" cx=".35" cy=".3"><stop offset="0" stop-color="${c2}"/><stop offset="1" stop-color="${c1}"/></radialGradient></defs>${ring ? `<ellipse cx="${x}" cy="${y}" rx="${R * 1.9}" ry="${R * .42}" fill="none" stroke="${c2}" stroke-width="${R * .09}" opacity=".55" transform="rotate(-18 ${x} ${y})"/>` : ''}<circle cx="${x}" cy="${y}" r="${R}" fill="url(#pg${x | 0}${R | 0})"/>`;
const ship = (x, y, s, col, rot = 0) => `<g transform="translate(${x} ${y}) rotate(${rot}) scale(${s})"><path d="M-22 0 L10 -5 L24 0 L10 5 Z" fill="${col}"/><path d="M-8 -4 L-14 -11 L-4 -4Z M-8 4 L-14 11 L-4 4Z" fill="${col}" opacity=".8"/><rect x="-26" y="-2" width="6" height="4" fill="#ffb060"/></g>`;
const MOTIF = {
  thrust: (r, c) => { const x = 110 + r() * 40; return `<path d="M${x} 60 L${x + 70} 42 L${x + 70} 78Z" fill="#cfd8e4"/><rect x="${x + 70}" y="38" width="32" height="44" rx="4" fill="#8794a8"/><path d="M${x + 102} 44 L${x + 190 + r() * 40} 60 L${x + 102} 76Z" fill="${c[2]}" opacity=".85"/><path d="M${x + 102} 52 L${x + 170} 60 L${x + 102} 68Z" fill="#fff" opacity=".9"/>` },
  mining: (r, c) => `<path d="M170 20 L230 28 L252 62 L224 100 L170 104 L132 74 L140 38Z" fill="#6b5f55"/><path d="M170 20 L205 40 L190 70 L140 38Z" fill="#8a7b6e"/><circle cx="196" cy="62" r="8" fill="#4a423b"/><path d="M40 28 L180 58" stroke="${c[2]}" stroke-width="5" opacity=".85"/><path d="M40 28 L180 58" stroke="#fff" stroke-width="1.6"/>${ship(40, 28, .9, '#cfd8e4', 12)}`,
  laser: (r, c) => `<circle cx="120" cy="60" r="34" fill="none" stroke="${c[2]}" stroke-width="5"/><circle cx="120" cy="60" r="22" fill="${c[2]}" opacity=".25"/><circle cx="120" cy="60" r="8" fill="#fff"/><path d="M154 60 H300" stroke="${c[2]}" stroke-width="7" opacity=".6"/><path d="M154 60 H300" stroke="#fff" stroke-width="2"/>`,
  reactor: (r, c) => `<ellipse cx="160" cy="60" rx="70" ry="26" fill="none" stroke="${c[2]}" stroke-width="6" opacity=".8"/><ellipse cx="160" cy="60" rx="50" ry="40" fill="none" stroke="${c[1]}" stroke-width="4" opacity=".8" transform="rotate(35 160 60)"/><circle cx="160" cy="60" r="14" fill="#fff"/><circle cx="160" cy="60" r="26" fill="${c[2]}" opacity=".3"/>`,
  armor: (r, c) => Array.from({length: 4}, (_, i) => `<path d="M${70 + i * 30} ${96 - i * 12} L${150 + i * 30} ${74 - i * 12} L${236 + i * 24} ${82 - i * 12} L${160 + i * 24} ${108 - i * 12}Z" fill="${['#5a6577', '#6c7a90', '#8190a8', '#97a6bf'][i]}" stroke="#1a1f29" stroke-width="2"/>`).join(''),
  bio: (r, c) => Array.from({length: 14}, (_, i) => { const x = 60 + i * 15, y1 = 60 + Math.sin(i * .7) * 30, y2 = 60 - Math.sin(i * .7) * 30; return `<line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}" stroke="${c[2]}" stroke-width="2" opacity=".6"/><circle cx="${x}" cy="${y1}" r="4" fill="${c[1]}"/><circle cx="${x}" cy="${y2}" r="4" fill="${c[2]}"/>` }).join(''),
  cargo: (r, c) => `${ship(80, 36, 1.2, '#cfd8e4', 0)}${ship(250, 84, 1.2, '#9fb0c8', 180)}<path d="M104 40 C150 40 190 84 226 84" fill="none" stroke="${c[2]}" stroke-width="4" stroke-dasharray="7 5"/>`,
  rail: (r, c) => `<rect x="60" y="48" width="130" height="8" fill="#9aa7b8"/><rect x="60" y="64" width="130" height="8" fill="#9aa7b8"/><path d="M190 60 H320" stroke="${c[2]}" stroke-width="5"/><circle cx="215" cy="60" r="5" fill="#fff"/>`,
  gear: (r, c) => { const g = (x, y, R, n) => `<g transform="translate(${x} ${y})"><circle r="${R}" fill="#6c7a90"/>${Array.from({length: n}, (_, i) => `<rect x="${-R * .18}" y="${-R * 1.28}" width="${R * .36}" height="${R * .4}" fill="#6c7a90" transform="rotate(${i * 360 / n})"/>`).join('')}<circle r="${R * .4}" fill="#1a1f29"/></g>`; return g(140, 62, 34, 10) + g(206, 44, 22, 8) + g(210, 90, 16, 7) },
};
const motifFor = id => /fuel|thrust|drive|engine|speed/.test(id) ? 'thrust' : /min|rock|drill|ore|ast/.test(id) ? 'mining' : /laser|sci|lens|optic/.test(id) ? 'laser' : /fusion|reactor|energy|power|plasma/.test(id) ? 'reactor' : /arm|hull|plate|def/.test(id) ? 'armor' : /train|select|crew|bio|gene|med|life/.test(id) ? 'bio' : /xfer|cargo|trade|freight|tow/.test(id) ? 'cargo' : /rail|gun|gat|weapon|fire/.test(id) ? 'rail' : 'gear';
const techCache = {};
export function techArt(id, area = 'eng', rar = 'c', w = 320, h = 120) {
  const key = id + area + rar + w; if (techCache[key]) return techCache[key];
  const r = rng(hash(id)), c = AREA[area] || AREA.eng, k = motifFor(id), rc = RAR[rar] || RAR.c;
  const body = `<defs><linearGradient id="tb${hash(id) % 9999}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${c[0]}"/><stop offset="1" stop-color="${c[1]}" stop-opacity=".55"/></linearGradient></defs><rect width="320" height="120" fill="url(#tb${hash(id) % 9999})"/>${stars(r, 34, 320, 120)}${r() < .6 ? planet(32 + r() * 250, 14 + r() * 92, 8 + r() * 14, c[1], c[2], r() < .4) : ''}${MOTIF[k](r, c)}<rect x="1.5" y="1.5" width="317" height="117" fill="none" stroke="${rc}" stroke-width="3" opacity="${rar === 'c' ? .5 : .95}"/>${rar === 'r' ? `<path d="M2 2h22M2 2v22M318 118h-22M318 118v-22" stroke="#fff" stroke-width="2" opacity=".8"/>` : ''}`;
  return techCache[key] = `<svg viewBox="0 0 320 120" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" style="display:block;border-radius:6px;max-width:100%">${body}</svg>`;
}
// события: по тексту журнала подбираем сюжет
export const EV = {
  raid: ['Тревога', '#ff5a4a', '#2a0e14'], victory: ['Победа', '#6fe3a2', '#0d2a1f'], defeat: ['Потери', '#ff8a5a', '#2a1710'], money: ['Деньги', '#ffd36a', '#2b2410'],
  colony: ['Колония', '#6fc8ff', '#0e2236'], discovery: ['Открытие', '#c6a6ff', '#1d1436'], crisis: ['Кризис', '#ff9a4a', '#2a1c10'], war: ['Война', '#ff6a6a', '#2a1014'], ship: ['Корабль', '#9fc4ff', '#102036'],
};
export function eventKind(msg) {
  const m = String(msg).toLowerCase();
  if (/налёт|рейдер|тревог|вражеск/.test(m)) return 'raid';
  if (/победа|разгромлен|захвачен приз|отбит/.test(m)) return 'victory';
  if (/потерян|уничтожен|погиб|разбит|гибель|взорвал/.test(m)) return 'defeat';
  if (/банкрот|долг|кредит|займ|налог/.test(m)) return 'money';
  if (/колони|заселен|поселен|терраформ/.test(m)) return 'colony';
  if (/изучен|открыт|технолог|исследован/.test(m)) return 'discovery';
  if (/голод|забастов|дефицит|кризис|нехватк|авари|отказ/.test(m)) return 'crisis';
  if (/войн|флот.*бой|сражен|бой-демо|бой /.test(m)) return 'war';
  if (/построен|спущен|верфь|готов корабль|запущен/.test(m)) return 'ship';
  return null;
}
const SCN = {
  raid: (r, c) => `<path d="M160 18 L204 96 H116Z" fill="none" stroke="${c}" stroke-width="7" stroke-linejoin="round"/><rect x="156" y="42" width="8" height="30" fill="${c}"/><circle cx="160" cy="82" r="5" fill="${c}"/>${[0, 1, 2, 3, 4].map(i => ship(280 - i * 26 + r() * 10, 18 + i * 20, .8, '#b84a4a', 180)).join('')}`,
  victory: (r, c) => `${ship(110, 66, 1.6, '#9fc4ff', 0)}${ship(200, 90, 1.1, '#9fc4ff', -8)}<path d="M230 20 l8 18 20 2-15 13 5 19-18-10-18 10 5-19-15-13 20-2z" fill="${c}"/>${Array.from({length: 8}, (_, i) => `<line x1="${250 + Math.cos(i) * 30}" y1="${44 + Math.sin(i) * 30}" x2="${250 + Math.cos(i) * 44}" y2="${44 + Math.sin(i) * 44}" stroke="${c}" stroke-width="2"/>`).join('')}`,
  defeat: (r, c) => `${ship(140, 70, 1.5, '#5a6577', 28)}${Array.from({length: 16}, () => `<polygon points="${(60 + r() * 200).toFixed(0)},${(14 + r() * 92).toFixed(0)} ${(66 + r() * 200).toFixed(0)},${(18 + r() * 90).toFixed(0)} ${(58 + r() * 200).toFixed(0)},${(24 + r() * 90).toFixed(0)}" fill="#6a7384" opacity=".8"/>`).join('')}<circle cx="156" cy="72" r="22" fill="${c}" opacity=".7"/><circle cx="156" cy="72" r="11" fill="#fff" opacity=".9"/>`,
  money: (r, c) => `<circle cx="160" cy="60" r="38" fill="${c}"/><circle cx="160" cy="60" r="30" fill="none" stroke="#7a5a10" stroke-width="3"/><text x="160" y="74" text-anchor="middle" font-size="42" font-family="Georgia,serif" font-weight="700" fill="#7a5a10">₡</text><path d="M150 24 L172 96" stroke="#1a1410" stroke-width="3"/>`,
  colony: (r, c) => `${planet(120, 100, 70, '#2a5d8a', '#7fc8ff')}<rect x="104" y="24" width="10" height="20" fill="#cfd8e4"/><path d="M96 24 H122 L109 10Z" fill="${c}"/><rect x="140" y="30" width="16" height="12" fill="#cfd8e4"/><rect x="132" y="28" width="6" height="6" fill="#ffd36a"/>${ship(240, 46, 1.2, '#cfd8e4', 160)}`,
  discovery: (r, c) => `${planet(150, 62, 30, '#5a3c9a', '#c6a6ff', true)}${[0, 1, 2, 3, 4, 5].map(i => `<path d="M${60 + i * 36} ${20 + (i % 3) * 32} l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="${c}"/>`).join('')}`,
  crisis: (r, c) => `<rect x="110" y="50" width="100" height="52" fill="none" stroke="${c}" stroke-width="5"/><path d="M110 50 L160 28 L210 50" fill="none" stroke="${c}" stroke-width="5"/><path d="M128 66 L192 90 M192 66 L128 90" stroke="${c}" stroke-width="5"/>`,
  war: (r, c) => `${[0, 1, 2].map(i => ship(60 + i * 22, 36 + i * 22, 1.1, '#6a9ae8', 0)).join('')}${[0, 1, 2].map(i => ship(260 - i * 22, 36 + i * 22, 1.1, '#e86a6a', 180)).join('')}<path d="M92 50 H228 M90 72 H230" stroke="#ffd36a" stroke-width="2" stroke-dasharray="3 9"/><circle cx="160" cy="62" r="18" fill="${c}" opacity=".5"/>`,
  ship: (r, c) => `${ship(150, 62, 2.4, '#cfd8e4', 0)}<path d="M20 100 H300" stroke="${c}" stroke-width="2" opacity=".6"/><path d="M40 88 V100 M80 82 V100 M240 82 V100 M280 88 V100" stroke="${c}" stroke-width="2" opacity=".6"/>`,
};
export function eventArt(kind, w = 320, h = 120) {
  const e = EV[kind]; if (!e) return '';
  const r = rng(hash(kind));
  return `<svg viewBox="0 0 320 120" width="${w}" height="${h}" preserveAspectRatio="xMidYMid slice" style="display:block;border-radius:6px;max-width:100%"><rect width="320" height="120" fill="${e[2]}"/><defs><radialGradient id="eg${kind}" cx=".5" cy=".5" r=".7"><stop offset="0" stop-color="${e[1]}" stop-opacity=".28"/><stop offset="1" stop-color="${e[1]}" stop-opacity="0"/></radialGradient></defs><rect width="320" height="120" fill="url(#eg${kind})"/>${stars(r, 40, 320, 120)}${SCN[kind](r, e[1])}<rect x="1.5" y="1.5" width="317" height="117" fill="none" stroke="${e[1]}" stroke-width="2.5" opacity=".7"/></svg>`;
}
// плашка события: всплывает в углу на несколько секунд
export function showEventToast(msg) {
  const k = eventKind(msg); if (!k || typeof document === 'undefined' || !document.body || !document.createElement) return;
  try {
    let host = document.getElementById('ev-toasts'); if (!host) { host = document.createElement('div'); host.id = 'ev-toasts'; document.body.appendChild(host) }
    while (host.children.length >= 3) host.firstChild.remove();
    const d = document.createElement('div'); d.className = 'ev-toast'; d.style.borderColor = EV[k][1];
    d.innerHTML = `${eventArt(k, 260, 70)}<div class="ev-t"><b style="color:${EV[k][1]}">${EV[k][0]}</b><span></span></div>`; d.querySelector('span').textContent = String(msg).slice(0, 140);
    host.appendChild(d); setTimeout(() => { d.classList.add('out'); setTimeout(() => d.remove(), 600) }, 6500);
  } catch (e) { }
}
// фон панелей: тонкая туманность, у каждой вкладки свой оттенок
const PANEL_HUE = {obj: 215, orders: 190, yard: 28, earth: 150, corp: 285, trade: 45, cargo: 35, pop: 165, comp: 250, climate: 175, work: 20, col: 130, laws: 265, find: 200, sci: 230, off: 0, fleet: 210, demo: 340, log: 220};
export function panelBg(name) {
  const hue = PANEL_HUE[name] != null ? PANEL_HUE[name] : hash(name) % 360, r = rng(hash(name));
  const blobs = Array.from({length: 4}, () => `<circle cx="${(r() * 100).toFixed(0)}%" cy="${(r() * 100).toFixed(0)}%" r="${(24 + r() * 30).toFixed(0)}%" fill="hsl(${(hue + r() * 50 - 25) | 0},60%,45%)" opacity=".13" filter="url(#b)"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="640"><defs><filter id="b"><feGaussianBlur stdDeviation="46"/></filter></defs>${blobs}${stars(r, 60, 640, 640)}</svg>`;
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`;
}
export function applyPanelBgs() { try { document.querySelectorAll('.panel[id^="p-"]').forEach(p => { p.style.backgroundImage = panelBg(p.id.slice(2)); p.style.backgroundSize = 'cover'; p.style.backgroundAttachment = 'local' }) } catch (e) { } }
