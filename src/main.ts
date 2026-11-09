// Точка входа: модули выполняются в этом порядке.
import './01-data.ts';
import './02-crew.ts';
import './03-build.ts';
import './04-engine.ts';
import './05-battle.ts';
import './06-corps.ts';
import './07-population.ts';
import './10-civil.ts';
import './08-map-ui.ts';
import './11-shell.ts';
import './12-state.ts';
import './09-orders-ui.ts';
import './21-battle3d.ts';
import './22-war.ts';
import './23-stress.ts';
import './99-debug.ts';
import './20-tutorial.ts';
import './33-alerts.ts';

import { hooks } from './00-hooks.ts';
import { showEventToast, applyPanelBgs } from './17-art.ts';
hooks.onLog = msg => showEventToast(msg);
applyPanelBgs(); setTimeout(applyPanelBgs, 500);
