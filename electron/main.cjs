// Оболочка Electron: открывает собранную игру (dist/) в окне, без браузера и без сервера.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-gpu-rasterization');
function create() {
  const win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1000, minHeight: 640, backgroundColor: '#0b1019', title: 'Пояс 4X', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, backgroundThrottling: false },
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
