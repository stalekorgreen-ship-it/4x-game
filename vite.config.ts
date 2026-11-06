import { defineConfig, type Plugin } from 'vite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GAME_FILES } from './src/files';

// Все файлы игры пока делят одну область видимости (как в исходном прототипе),
// поэтому склеиваются в один модуль в порядке из src/files.ts.
// По мере перехода на import/export файлы переедут на обычные модули.
function gameBundle(): Plugin {
  const id = '\0game-bundle';
  return {
    name: 'game-bundle',
    enforce: 'pre',
    resolveId(src) { return src.endsWith('/src/main.ts') ? id : null; },
    load(i) {
      if (i !== id) return null;
      return GAME_FILES.map((f) => { const p = resolve('src', f); this.addWatchFile(p); return readFileSync(p, 'utf8'); }).join('\n;\n');
    },
    transform(code, i) { return i === id ? { code, map: null } : null; },
  };
}
export default defineConfig({ plugins: [gameBundle()], base: './', build: { target: 'es2022' } });
