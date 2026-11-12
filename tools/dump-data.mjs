// Выгрузка данных игры в public/data/*.json (значения по умолчанию из кода + то, что уже лежит в файлах).
// Запуск: node tools/dump-data.mjs  — после добавления новых разделов gd(...) в код.
const stub = () => new Proxy(function () {}, { get: (_, k) => (k === Symbol.toPrimitive ? () => 0 : stub()), apply: () => stub(), construct: () => stub(), set: () => true });
Object.assign(globalThis, { document: stub(), window: stub(), localStorage: { getItem: () => null, setItem() {} }, requestAnimationFrame() {}, ResizeObserver: function () { return stub(); } });
const G = await import('../src/00-gd.ts');
await import('../src/01-data.ts'); await import('../src/03-build.ts'); await import('../src/04-engine.ts'); await import('../src/05-battle.ts');
await import('../src/06-corps.ts'); await import('../src/07-population.ts'); await import('../src/10-civil.ts'); await import('../src/12-state.ts'); await import('../src/30-regions.ts'); await import('../src/34-ai.ts');
const fs = await import('node:fs');
const HELP = {
  modules: 'Модули кораблей. name/desc — текст; mass — масса, т; cost — материалы на постройку, т; power/eff — двигатели; fuel/cargo/mine/crew/life/... — характеристики. Поля tech не трогать (связь с технологией).',
  buildings: 'Здания по таблице «Пояс». buildings — здания игрока: name, desc, sb — строительные баллы, cost — материалы, т; crew — рабочих (по умолчанию 10 000); use — расход в год (pow — МВт), платится по цене товара; sci — очков науки в сутки в каждой области; cbSB — СБ в сутки; make — переработка со склада; fac — сколько госзаводов товара получает Земля. corp — постройки корпораций (их же строит игрок во вкладке «Экономические постройки»): kind fac/mine/lab/corp, g — товар, k — заводов-эквивалентов. econ: CF_SB — СБ/сут строительного завода; ECON_SB — СБ госзавода/госшахты/лаборатории; ECON_MAT — их материалы, т; matDiv — делитель cost зданий.',
  goods: 'Товары: n — название, kind — вид (energy/semi/life/cons/ind), need — потребление на человека, mix — доли страт рабочих, in — входы на 1 т (товары и руда), space — только вне Земли.',
  techs: 'Технологии по id: name, desc, cost — очки науки, f — область (phys/eng/bio), r — редкость (c/u/r), req — id технологии, нужной до.',
  economy: 'Экономика. population: FACT_W — людей на завод, PROD — т товара на человека в сутки, RAW_PER — руда на т товара, BASEW — зарплаты страт, TUIT — плата за учёбу, FACT_COST_KR — цена завода корпорации (×25). earthStart — доля спроса, закрытая госзаводами Земли на старте. corps — параметры корпораций. prices — базовые цены сырья за т (×25). laws — законы по умолчанию. mandatory — обязательные расходы [ключ, название, минимум %, подсказка]. corpsCount — сколько корпораций максимум.',
  battle: 'Бой. SIGMA — разброс выстрела (меньше — точнее); VP — скорость снаряда; LIFE — время жизни снаряда, с; REL — перезарядка, с; RC0 — рельсотрон (dmg урон, rng дальность, sig множитель разброса, rel надёжность, cal калибр); FC0 — зенитка; GC0 — гатлинг (rpm, heat нагрев, cool остывание, pen бронепробитие, rng дальность); LC0 — лазер; MC0 — ракета; FI/BO — истребитель/бомбардировщик; TORP — торпеда; RCT — перезарядка по калибру; EW — помехи; RADAR — дальность радара по классу; MARN — морпехи.',
  ai: 'Правила ИИ (правятся в игре: Редактор → Правила ИИ). when — условия {p параметр, a товар/руда, op, v}, do — действие {a, arg, num}; off — выключено; stop:false — не заменять встроенный ИИ; only — имя корпорации.',
  regions: 'Регионы. earth — регионы Земли: p доля населения, j доля рабочих мест, a суша млн км², coast низкие побережья, t [средняя, мин, макс] °C, desert/cold/hot доли пустынь/мерзлоты/жарких низин, mtn горы, wl уровень зарплат, amp скорость потепления. names — названия регионов других тел.',
};
for (const f in G.DEFAULTS) {
  let old = {}; try { old = JSON.parse(fs.readFileSync(new URL('../public/data/' + f + '.json', import.meta.url), 'utf8')); } catch (e) {}
  const out = {_readme: HELP[f] || ''}; // правки владельца в файлах сохраняются: уже записанные значения накладываются поверх умолчаний
  for (const k in G.DEFAULTS[f]) { const d = G.DEFAULTS[f][k], o = old[k]; out[k] = o == null ? d : (d && typeof d === 'object' && !Array.isArray(d) && o && typeof o === 'object' && !Array.isArray(o)) ? G.deepAssign(JSON.parse(JSON.stringify(d)), o) : o; }
  // формат: разделы и их записи — по строке, значения внутри записи — в одну строку
  const J = v => JSON.stringify(v).replace(/,"/g, ', "').replace(/":/g, '": ');
  const sec = v => v && typeof v === 'object' && !Array.isArray(v) ? '{\n' + Object.entries(v).map(([k, x]) => '  ' + JSON.stringify(k) + ': ' + J(x)).join(',\n') + '\n }' : Array.isArray(v) ? '[\n' + v.map(x => '  ' + J(x)).join(',\n') + '\n ]' : J(v);
  const txt = '{\n' + Object.entries(out).map(([k, v]) => ' ' + JSON.stringify(k) + ': ' + (k === '_readme' ? JSON.stringify(v) : sec(v))).join(',\n') + '\n}\n';
  JSON.parse(txt); fs.writeFileSync(new URL('../public/data/' + f + '.json', import.meta.url), txt);
  console.log(f, Object.keys(G.DEFAULTS[f]).join(', '));
}
process.exit(0);
