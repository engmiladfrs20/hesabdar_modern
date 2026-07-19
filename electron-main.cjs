const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const DB_FILE = path.join(app.getPath('userData'), 'construction_db.json');
const DEFAULT_DB_PATH = path.join(__dirname, 'db.json');

// Ensure the local database file exists in userData before loading the server
try {
  if (!fs.existsSync(DB_FILE)) {
    if (fs.existsSync(DEFAULT_DB_PATH)) {
      fs.copyFileSync(DEFAULT_DB_PATH, DB_FILE);
    } else {
      fs.writeFileSync(DB_FILE, JSON.stringify({
        companies: [{ id: "c1", name: "شرکت عمرانی رادین سازه شیراز", code: "10243" }],
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
        alertsLog: []
      }, null, 2));
    }
  }
} catch (err) {
  console.error("Error initializing local offline DB:", err);
}

// Inject database path and environment into process variables
process.env.OFFLINE_DB_PATH = DB_FILE;
process.env.NODE_ENV = 'production';

// Load our complete, robust backend server bundle
require('./dist/server.cjs');

let mainWindow;
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
