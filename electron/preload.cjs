// Отдаёт игре текстовые данные из папки data рядом с exe (читает main, до запуска модулей игры).
const { contextBridge, ipcRenderer } = require('electron');
try { contextBridge.exposeInMainWorld('GAME_DATA', ipcRenderer.sendSync('game-data')); } catch (e) {}
