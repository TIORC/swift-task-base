const { app, BrowserWindow, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const os = require('os');

let mainWindow = null;
let tray = null;

const WINDOW_WIDTH = 440;
const WINDOW_HEIGHT = 720;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: WINDOW_WIDTH,
    height: WINDOW_HEIGHT,
    resizable: false,
    frame: false,
    skipTaskbar: true,
    show: false,
    alwaysOnTop: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));

  mainWindow.on('blur', () => {
    if (mainWindow && mainWindow.isVisible()) {
      mainWindow.hide();
    }
  });

  mainWindow.on('close', (e) => {
    e.preventDefault();
    mainWindow.hide();
  });
}

function createTray() {
  const iconPath = path.join(__dirname, 'icon.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 });
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  tray = new Tray(trayIcon);
  tray.setToolTip('ORCOMA Suporte - Abrir Chamado');

  const contextMenu = Menu.buildFromTemplate([
    { label: 'Abrir Chamado', click: toggleWindow },
    { type: 'separator' },
    { label: 'Sair', click: () => { app.exit(0); } },
  ]);

  tray.setContextMenu(contextMenu);
  tray.on('click', toggleWindow);
}

function toggleWindow() {
  if (!mainWindow) return;
  if (mainWindow.isVisible()) {
    mainWindow.hide();
  } else {
    const trayBounds = tray.getBounds();
    const x = Math.round(trayBounds.x + trayBounds.width / 2 - WINDOW_WIDTH / 2);
    const y = Math.round(trayBounds.y - WINDOW_HEIGHT - 4);
    mainWindow.setPosition(x, y);
    mainWindow.show();
    mainWindow.focus();
  }
}

app.whenReady().then(() => {
  createWindow();
  createTray();

  // Send machine info to renderer
  mainWindow.webContents.on('did-finish-load', () => {
    mainWindow.webContents.send('machine-info', {
      username: os.userInfo().username,
      hostname: os.hostname(),
    });
  });
});

app.on('window-all-closed', (e) => {
  e.preventDefault();
});
