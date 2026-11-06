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
