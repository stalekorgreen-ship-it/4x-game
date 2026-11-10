// Оболочка Electron: открывает собранную игру (dist/) в окне, без браузера и без сервера.
const { app, BrowserWindow, Menu, shell, ipcMain } = require('electron');
const path = require('path'), fs = require('fs');
// Данные игры (data/*.json): папка data рядом с Poyas4X.exe — правится блокнотом, применяется при перезапуске.
// Если файла там нет — берётся копия из сборки (dist/data), если и её нет — значения из кода.
function readData() {
  const dirs = [path.join(path.dirname(process.execPath), 'data'), path.join(__dirname, '..', 'public', 'data'), path.join(__dirname, '..', 'dist', 'data')], out = {};
  for (const d of dirs) { let list = []; try { list = fs.readdirSync(d); } catch (e) { continue; }
    for (const f of list) if (f.endsWith('.json')) { const k = f.slice(0, -5); if (!(k in out)) try { out[k] = fs.readFileSync(path.join(d, f), 'utf8'); } catch (e) {} } }
  return out;
}
ipcMain.on('game-data', e => { e.returnValue = readData(); });
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
function create() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640, backgroundColor: '#0b1019', title: 'Пояс 4X', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false, preload: path.join(__dirname, 'preload.cjs') },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('before-input-event', (e, i) => { // F11 — полный экран, F12 — отладка
    if (i.type !== 'keyDown') return;
    if (i.key === 'F11') win.setFullScreen(!win.isFullScreen());
    else if (i.key === 'F12') win.webContents.toggleDevTools();
  });
}
app.whenReady().then(() => { create(); app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) create(); }); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
