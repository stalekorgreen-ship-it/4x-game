// @ts-nocheck
// Отладочный доступ для тестов в браузере (window.__game)
import { state } from './01-data.ts';
import { showTab } from './09-orders-ui.ts';
window.__game = { get state() { return state; }, showTab };
import { Battle, startRaid } from './05-battle.ts';
import { focusBattle } from './08-map-ui.ts';
window.__game.Battle = Battle; window.__game.startRaid = startRaid; window.__game.focusBattle = focusBattle;
import { ui } from './08-map-ui.ts'; window.__game.ui = ui;
import { startDemo } from './16-demo.ts'; window.__game.startDemo = startDemo;
import { advance } from './04-engine.ts'; import { drawMap } from './08-map-ui.ts'; window.__game.advance = advance; window.__game.drawMap = drawMap;
import { matureSystem } from './16-demo.ts'; window.__game.matureSystem = matureSystem;
import { makeScenario } from './16-demo.ts'; window.__game.makeScenario = makeScenario;
import { duelScenario, MIXNAMES } from './16-demo.ts'; window.__game.duelScenario = duelScenario; window.__game.MIXNAMES = MIXNAMES;
import * as CB from './19-colbld.ts'; window.__game.CB = CB;
import { designStats } from './01-data.ts'; window.__game.designStats = designStats;
import { War, startWar, warFrame, goBattle } from './22-war.ts'; import { Battles } from './05-battle.ts'; window.__game.War = War; window.__game.startWar = startWar; window.__game.warFrame = warFrame; window.__game.goBattle = goBattle; window.__game.Battles = Battles;
