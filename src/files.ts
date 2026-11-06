// Порядок важен: файлы делят общую область видимости.
export const GAME_FILES = [
  '01-data.ts', '02-crew.ts', '03-build.ts', '04-engine.ts', '05-battle.ts',
  '06-corps.ts', '07-population.ts', '08-map-ui.ts', '09-orders-ui.ts', '99-debug.ts',
];
// Файлы без DOM (для тестов симуляции в Node)
export const MODEL_FILES = ['01-data.ts', '02-crew.ts', '03-build.ts', '04-engine.ts', '06-corps.ts', '07-population.ts'];
