import path from 'node:path';

import { app, BrowserWindow } from 'electron';

import { resolveGrafanaOrigin } from '../shared/origin';

const grafanaOrigin = resolveGrafanaOrigin({ isPackaged: app.isPackaged, env: process.env });

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    webPreferences: {
      preload: path.join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(grafanaOrigin).catch((err: unknown) => {
    console.error(`[desktop] failed to load ${grafanaOrigin}:`, err);
  });

  return win;
}

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
