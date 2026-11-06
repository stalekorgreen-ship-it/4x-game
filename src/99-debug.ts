// @ts-nocheck
// Отладочный доступ для тестов в браузере (window.__game)
import { state } from './01-data.ts';
import { showTab } from './09-orders-ui.ts';
window.__game = { get state() { return state; }, showTab };
import { Battle, startRaid } from './05-battle.ts';
import { focusBattle } from './08-map-ui.ts';
window.__game.Battle = Battle; window.__game.startRaid = startRaid; window.__game.focusBattle = focusBattle;
import { ui } from './08-map-ui.ts'; window.__game.ui = ui;
