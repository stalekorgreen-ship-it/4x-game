// @ts-nocheck
// Отладочный доступ для тестов в браузере (window.__game)
import { state } from './01-data.ts';
import { showTab } from './09-orders-ui.ts';
window.__game = { get state() { return state; }, showTab };
