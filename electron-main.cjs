const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const USER_DATA_DIR = app.getPath('userData');
const DB_FILE = path.join(USER_DATA_DIR, 'construction_db.json');
const FIRST_INSTALL_FLAG = path.join(USER_DATA_DIR, 'first_install_completed.flag');

// Ensure the local database file exists in userData before loading the server (Empty by default)
let isFirstInstall = false;
try {
  if (!fs.existsSync(DB_FILE)) {
    isFirstInstall = true;
    fs.writeFileSync(DB_FILE, JSON.stringify({
      companies: [],
      projects: [],
      users: [{ id: "u1", name: "مهندس میلاد فرخی", role: "manager", roleName: "مدیر ارشد پروژه" }],
      accounts: [],
      materials: [],
      materialTransactions: [],
      transactions: [],
      checks: [],
      units: [],
      contacts: [],
      imprestFunds: [],
      imprestExpenses: [],
      preSales: [],
      preSaleInstallments: [],
      alertsLog: [],
      timesheets: [],
      payrolls: []
    }, null, 2), 'utf-8');
  } else if (!fs.existsSync(FIRST_INSTALL_FLAG)) {
    isFirstInstall = true;
  }
} catch (err) {
  console.error("Error initializing local offline DB:", err);
}

// Inject database path and environment into process variables
process.env.OFFLINE_DB_PATH = DB_FILE;
process.env.USER_DATA_DIR = USER_DATA_DIR;
process.env.IS_FIRST_INSTALL = isFirstInstall ? 'true' : 'false';
process.env.NODE_ENV = 'production';

// Load our complete backend server bundle
require('./dist/server.cjs');

let mainWindow;
let isQuitting = false;

function triggerPreCloseBackup() {
  return new Promise((resolve) => {
    const timeout = setTimeout(() => {
      resolve();
    }, 8000);

    try {
      const req = http.request({
        hostname: '127.0.0.1',
        port: 3000,
        path: '/api/backup-on-close',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      }, (res) => {
        res.on('data', () => {});
        res.on('end', () => {
          clearTimeout(timeout);
          resolve();
        });
      });

      req.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });

      req.write(JSON.stringify({ source: "بکاپ خودکار هنگام بستن نرم‌افزار آفلاین ویندوز" }));
      req.end();
    } catch (e) {
      clearTimeout(timeout);
      resolve();
    }
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1366,
    height: 850,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    title: "سامانه حسابداری سازه - نسخه آفلاین ویندوز",
    autoHideMenuBar: true
  });

  // Load the offline web server (it binds to port 3000 automatically)
  mainWindow.loadURL('http://127.0.0.1:3000');

  // Before closing the offline app, take a fresh backup on both local and online cloud
  mainWindow.on('close', async (e) => {
    if (isQuitting) return;
    e.preventDefault();
    isQuitting = true;

    try {
      if (mainWindow && mainWindow.webContents) {
        mainWindow.webContents.executeJavaScript(
          'window.__showClosingBackupModal && window.__showClosingBackupModal()'
        ).catch(() => {});
      }
    } catch {}

    await triggerPreCloseBackup();

    if (mainWindow) {
      mainWindow.destroy();
    }
    app.quit();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

app.on('ready', createWindow);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (mainWindow === null) createWindow();
});
