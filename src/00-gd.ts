// @ts-nocheck
// Данные игры из текстовых файлов data/*.json (правятся без пересборки). Код держит значения по умолчанию,
// файл накладывается поверх: gd('файл', 'раздел', умолчания). Ошибка в файле — берутся умолчания, пишется в консоль.
// Где лежат файлы: Windows-сборка — папка data рядом с Poyas4X.exe; разработка — public/data; тесты — public/data.
const files = {}, bad = [];
export const DEFAULTS = {}; // файл → раздел → умолчания (для выгрузки в data/)
function readFile(name) {
  if (name in files) return files[name];
  let txt = null;
  try {
    const G = typeof window !== 'undefined' && window.GAME_DATA; // Electron: main читает папку data рядом с exe
    if (G && typeof G === 'object' && name in G) txt = G[name];
    else if (typeof process !== 'undefined' && process.versions && process.versions.node && !process.versions.electron && process.getBuiltinModule) { // Node (тесты)
      const fs = process.getBuiltinModule('fs'), url = process.getBuiltinModule('url'), path = process.getBuiltinModule('path');
      const p = path.join(path.dirname(url.fileURLToPath(import.meta.url)), '..', 'public', 'data', name + '.json');
      if (fs.existsSync(p)) txt = fs.readFileSync(p, 'utf8');
    } else if (typeof XMLHttpRequest !== 'undefined') { // браузер: синхронно, до запуска модулей игры
      const x = new XMLHttpRequest(); x.open('GET', './data/' + name + '.json', false); x.send(); if (x.status === 200 || (x.status === 0 && x.responseText)) txt = x.responseText;
    }
  } catch (e) { txt = null; }
  let obj = null;
  if (txt != null) { try { obj = JSON.parse(txt); } catch (e) { bad.push(name + '.json: ' + e.message); console.error('Ошибка в data/' + name + '.json — берутся встроенные значения.', e.message); } }
  return files[name] = obj;
}
const plain = v => v && typeof v === 'object' && !Array.isArray(v);
// наложить src на dst (на месте): объекты — вглубь, массивы и числа — заменой; ключи с «_» — комментарии
export function deepAssign(dst, src) {
  for (const k in src) { if (k[0] === '_') continue; const v = src[k];
    if (plain(v) && plain(dst[k])) deepAssign(dst[k], v); else if (typeof dst[k] !== 'function') dst[k] = plain(v) ? deepAssign({}, v) : v; }
  return dst;
}
const strip = v => Array.isArray(v) ? v.map(strip) : plain(v) ? Object.fromEntries(Object.entries(v).filter(([, x]) => typeof x !== 'function').map(([k, x]) => [k, strip(x)])) : v;
export function gd(file, section, def) {
  (DEFAULTS[file] = DEFAULTS[file] || {})[section] = strip(def);
  const f = readFile(file), s = f && f[section];
  if (s == null) return def;
  if (plain(def) && plain(s)) return deepAssign(def, s);
  return s;
}
export const dataErrors = () => bad.slice();
