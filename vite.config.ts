import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
// в разработке редактор данных пишет файлы в public/data через POST /__save-data?name=
const saveData = {name: 'save-data', configureServer(s) { s.middlewares.use('/__save-data', (req, res) => {
  const name = new URL(req.url, 'http://x').searchParams.get('name') || ''; let body = '';
  req.on('data', c => { body += c; }); req.on('end', () => { try { if (!/^[a-z0-9_-]+$/i.test(name)) throw new Error('name'); JSON.parse(body); fs.writeFileSync(path.join('public', 'data', name + '.json'), body); res.end('ok'); } catch (e) { res.statusCode = 400; res.end(String(e)); } }); }); }};
export default defineConfig({ base: './', build: { target: 'es2022' }, plugins: [saveData] });
