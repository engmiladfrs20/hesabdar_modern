import React, { useState, useEffect } from "react";
import { wranglerConfig, d1SchemaSql, workerJs } from "../cloudflareKit";
import { 
  Cloud, 
  Terminal, 
  Shield, 
  Download, 
  FileCode, 
  CheckCircle2, 
  Copy, 
  Wifi, 
  WifiOff, 
  Play, 
  RefreshCw,
  Laptop,
  Upload,
  Database,
  AlertTriangle,
  FileJson,
  CheckCircle,
  HelpCircle,
  Link2
} from "lucide-react";
import { motion } from "motion/react";

interface DeveloperKitProps {
  cfEnabled: boolean;
  cfUrl: string;
  onToggleCf: (enabled: boolean) => void;
  onUpdateUrl: (url: string) => void;
  onRefresh: () => void;
}

// Pre-configured scripts for Packaging as an Offline Desktop App (Electron)
const electronMainJs = `const { app, BrowserWindow } = require('electron');
const path = require('path');
const express = require('express');
const fs = require('fs');

// Initialize local offline Express server
const expressApp = express();
const PORT = 3000;

expressApp.use(express.json({ limit: "50mb" }));
expressApp.use(express.urlencoded({ limit: "50mb", extended: true }));

const DB_FILE = path.join(app.getPath('userData'), 'construction_db.json');
const DEFAULT_DB_PATH = path.join(__dirname, 'db.json');

// Helper to read local offline database file
function readDb() {
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
    return JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
  } catch (err) {
    console.error("Error reading database:", err);
    return {};
  }
}

// Helper to write local database file
function writeDb(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error("Error writing database:", err);
  }
}

// REST APIs implementation
expressApp.get('/api/db', (req, res) => res.json(readDb()));
expressApp.post('/api/db/import', (req, res) => {
  writeDb(req.body);
  res.json({ status: 'success', message: 'Offline database imported' });
});

// Capture all requests to serve pre-compiled React frontend static assets
expressApp.use(express.static(path.join(__dirname, 'dist')));
expressApp.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

// Bind server locally only
expressApp.listen(PORT, '127.0.0.1', () => {
  console.log('Local Server running offline on http://127.0.0.1:3000');
});

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

  // Load the offline web server
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
`;

const electronPackageJson = `{
  "name": "construction-accounting-offline",
  "version": "1.0.0",
  "description": "سامانه حسابداری سازه - نسخه آفلاین دسکتاپ ویندوز با قابلیت همگام‌سازی ابری",
  "main": "electron-main.js",
  "author": "Milad Farrokhi",
  "scripts": {
    "start": "electron .",
    "pack": "electron-builder --dir",
    "dist": "electron-builder"
  },
  "dependencies": {
    "express": "^4.19.2",
    "dotenv": "^16.4.5"
  },
  "devDependencies": {
    "electron": "^30.0.1",
    "electron-builder": "^24.13.3"
  },
  "build": {
    "appId": "com.milad.construction.accounting",
    "productName": "ConstructionAccountingOffline",
    "win": {
      "target": "nsis",
      "icon": "icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "perMachine": false,
      "allowElevation": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "سامانه حسابداری سازه"
    },
    "directories": {
      "output": "release"
    }
  }
}`;

const windowsStartBat = `@echo off
title سامانه حسابداری سازه - نسخه آفلاین دسکتاپ ویندوز
color 0B
echo ====================================================================
echo             سامانه حسابداری سازه - راه اندازی خودکار نسخه افلاین
echo               طراحی شده توسط مهندس میلاد فرخی و هوش مصنوعی
echo ====================================================================
echo.

:: Check Node.js installation on Windows
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [خطا] Node.js روی سیستم شما نصب نیست!
    echo لطفا ابتدا Node.js را از سایت زیر دانلود و نصب کنید:
    echo https://nodejs.org/
    echo پس از نصب، این فایل را مجددا اجرا نمایید.
    echo.
    pause
    exit
)

echo [1/3] در حال بررسی و دانلود پکیج های پیش نیاز دسکتاپ...
if not exist node_modules (
    call npm install
) else (
    echo پکیج ها قبلا نصب شده اند.
)
echo.

echo [2/3] در حال کامپایل برنامه جهت اجرا روی ویندوز...
if not exist dist (
    call npm run build
) else (
    echo نسخه کامپایل شده آماده است.
)
echo.

echo [3/3] در حال راه اندازی سیستم افلاین روی پورت 3000...
echo پس از چند لحظه مرورگر شما باز خواهد شد.
start http://localhost:3000
call npm start
pause
`;

export default function DeveloperKit({ cfEnabled, cfUrl, onToggleCf, onUpdateUrl, onRefresh }: DeveloperKitProps) {
  const [activeMode, setActiveMode] = useState<"offline_windows" | "cloudflare">("offline_windows");
  const [copiedSection, setCopiedSection] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");
  const [seedStatus, setSeedStatus] = useState<"idle" | "seeding" | "success" | "failed">("idle");
  const [inputUrl, setInputUrl] = useState(cfUrl);

  // System Settings & Auto Sync States
  const [dbPath, setDbPath] = useState("");
  const [uploadsPath, setUploadsPath] = useState("");
  const [autoBackupSyncIntervalHours, setAutoBackupSyncIntervalHours] = useState<number>(0);
  const [cfApiToken, setCfApiToken] = useState("");
  const [cfAccountId, setCfAccountId] = useState("");
  const [cfWorkerName, setCfWorkerName] = useState("");
  const [cfWorkerUrl, setCfWorkerUrl] = useState("");
  const [syncToken, setSyncToken] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [deployError, setDeployError] = useState("");
  const [syncErrorAll, setSyncErrorAll] = useState("");
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    // Load current system settings on mount
    fetch("/api/settings")
      .then(res => res.json())
      .then(data => {
        if (data) {
          setDbPath(data.dbPath || "");
          setUploadsPath(data.uploadsPath || "");
          setAutoBackupSyncIntervalHours(data.autoBackupSyncIntervalHours || 0);
          setCfApiToken(data.cfApiToken || "");
          setCfAccountId(data.cfAccountId || "");
          setCfWorkerName(data.cfWorkerName || "hesabdarpeymankar");
          setCfWorkerUrl(data.cfWorkerUrl || "");
          setSyncToken(data.syncToken || "");
          if (data.cfWorkerUrl) {
            setInputUrl(data.cfWorkerUrl);
          }
        }
      })
      .catch(err => console.error("Error fetching system settings:", err));
  }, []);

  const handleSaveSettings = async () => {
    setSaveSuccess(false);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbPath, uploadsPath, cfApiToken, cfAccountId, cfWorkerName, autoBackupSyncIntervalHours })
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      } else {
        const d = await res.json();
        alert(d.error || "خطا در ذخیره تنظیمات");
      }
    } catch (e: any) {
      alert("خطا در ارتباط با سرور: " + e.message);
    }
  };

  const handleAutoDeploy = async () => {
    setIsDeploying(true);
    setDeployError("");
    try {
      const res = await fetch("/api/cloudflare/deploy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cfApiToken, cfAccountId, cfWorkerName })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setCfWorkerUrl(data.workerUrl);
        setSyncToken(data.syncToken);
        setInputUrl(data.workerUrl);
        onUpdateUrl(data.workerUrl);
        alert("ورکر، پایگاه داده KV و پیکربندی ابری با موفقیت ساخته، راه‌اندازی و متصل شد!");
        onRefresh();
      } else {
        setDeployError(data.error || "خطا در ساخت ورکر");
      }
    } catch (e: any) {
      setDeployError(e.message || "خطا در ارسال درخواست ساخت");
    } finally {
      setIsDeploying(false);
    }
  };

  const handleConnectExisting = async () => {
    setIsConnecting(true);
    setDeployError("");
    try {
      const res = await fetch("/api/cloudflare/connect", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cfApiToken, cfAccountId, cfWorkerName })
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setCfWorkerUrl(data.workerUrl);
        setSyncToken(data.syncToken);
        setInputUrl(data.workerUrl);
        onUpdateUrl(data.workerUrl);
        alert(`اتصال به ورکر موجود "${cfWorkerName}" با موفقیت برقرار شد!\nآدرس ورکر: ${data.workerUrl}`);
        onRefresh();
      } else {
        setDeployError(data.error || "خطا در اتصال به ورکر موجود");
      }
    } catch (e: any) {
      setDeployError(e.message || "خطا در ارسال درخواست اتصال");
    } finally {
      setIsConnecting(false);
    }
  };

  const handleAutoSync = async () => {
    setIsSyncingAll(true);
    setSyncErrorAll("");
    try {
      const res = await fetch("/api/cloudflare/sync", {
        method: "POST"
      });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        alert(`هماهنگ‌سازی با موفقیت انجام شد! ${data.filesSynced} فایل/فاکتور به همراه کل دیتابیس به سرور کلودفلر آپلود و سینک شد.`);
        onRefresh();
      } else {
        setSyncErrorAll(data.error || "خطا در هماهنگ‌سازی");
      }
    } catch (e: any) {
      setSyncErrorAll(e.message || "خطا در اتصال به وب‌سرویس");
    } finally {
      setIsSyncingAll(false);
    }
  };

  // Offline Import & Sync States
  const [dragOver, setDragOver] = useState(false);
  const [importedDb, setImportedDb] = useState<any | null>(null);
  const [importFileName, setImportFileName] = useState("");
  const [syncingStatus, setSyncingStatus] = useState<"idle" | "processing" | "success" | "failed">("idle");
  const [syncError, setSyncError] = useState("");

  // Backblaze B2 Config States
  const [b2KeyId, setB2KeyId] = useState(() => localStorage.getItem("b2_key_id") || "");
  const [b2AppKey, setB2AppKey] = useState(() => localStorage.getItem("b2_app_key") || "");
  const [b2BucketId, setB2BucketId] = useState(() => localStorage.getItem("b2_bucket_id") || "");
  const [b2BucketName, setB2BucketName] = useState(() => localStorage.getItem("b2_bucket_name") || "");
  const [b2TestStatus, setB2TestStatus] = useState<"idle" | "testing" | "success" | "failed">("idle");
  const [b2TestMsg, setB2TestMsg] = useState("");

  const handleTestB2 = async () => {
    setB2TestStatus("testing");
    setB2TestMsg("");
    try {
      const baseUrl = inputUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/api/b2/test`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-b2-key-id": b2KeyId,
          "x-b2-app-key": b2AppKey,
          "x-b2-bucket-id": b2BucketId,
          "x-b2-bucket-name": b2BucketName
        },
        body: JSON.stringify({
          keyId: b2KeyId,
          appKey: b2AppKey,
          bucketId: b2BucketId,
          bucketName: b2BucketName
        })
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        setB2TestStatus("success");
        localStorage.setItem("b2_key_id", b2KeyId);
        localStorage.setItem("b2_app_key", b2AppKey);
        localStorage.setItem("b2_bucket_id", b2BucketId);
        localStorage.setItem("b2_bucket_name", b2BucketName);
        setB2TestMsg(data.message || "اتصال برقرار شد!");
      } else {
        setB2TestStatus("failed");
        setB2TestMsg(data.message || "اتصال ناموفق بود.");
      }
    } catch (err: any) {
      setB2TestStatus("failed");
      setB2TestMsg("خطا در ارسال درخواست: " + err.message);
    }
  };

  const triggerCopy = (text: string, sectionName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedSection(sectionName);
    setTimeout(() => {
      setCopiedSection(null);
    }, 2000);
  };

  const downloadFile = (content: string, filename: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleDownloadActiveDb = async () => {
    try {
      const targetUrl = cfEnabled && cfUrl ? `${cfUrl.replace(/\/+$/, "")}/api/db` : "/api/db";
      const res = await fetch(targetUrl);
      const json = await res.json();
      downloadFile(JSON.stringify(json, null, 2), "db.json", "application/json");
    } catch (err) {
      alert("خطا در بارگیری نسخه اطلاعاتی جهت همگام‌سازی.");
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processDbFile(file);
    }
  };

  const processDbFile = (file: File) => {
    setImportFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        // Basic schema verification
        if (!parsed.projects || !parsed.transactions || !parsed.accounts || !parsed.contacts) {
          setSyncError("فایل آپلود شده ساختار دیتابیس معتبر سیستم حسابرسی سازه را ندارد.");
          setImportedDb(null);
          return;
        }
        setImportedDb(parsed);
        setSyncError("");
      } catch (err) {
        setSyncError("امکان پارس فایل وجود ندارد. مطمئن شوید فایل دیتابیس با فرمت صحیح JSON است.");
        setImportedDb(null);
      }
    };
    reader.readAsText(file);
  };

  const handleSyncCommit = async () => {
    if (!importedDb) return;
    setSyncingStatus("processing");
    try {
      const targetUrl = cfEnabled && cfUrl ? `${cfUrl.replace(/\/+$/, "")}/api/db/import` : "/api/db/import";
      const response = await fetch(targetUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(importedDb)
      });
      
      const data = await response.json();
      if (response.ok && data.status === "success") {
        setSyncingStatus("success");
        onRefresh();
        setTimeout(() => {
          setSyncingStatus("idle");
          setImportedDb(null);
          setImportFileName("");
        }, 4000);
      } else {
        setSyncingStatus("failed");
        setSyncError(data.error || "بارگذاری دیتابیس با خطا مواجه شد.");
      }
    } catch (err: any) {
      setSyncingStatus("failed");
      setSyncError("بروز خطا در برقراری ارتباط با سرور: " + err.message);
    }
  };

  const handleTestConnection = async () => {
    setTestStatus("testing");
    try {
      const baseUrl = inputUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/api/db`);
      if (res.ok) {
        setTestStatus("connected");
        onUpdateUrl(inputUrl);
        onRefresh();
      } else {
        setTestStatus("failed");
      }
    } catch (err) {
      setTestStatus("failed");
    }
  };

  const handleSeedLiveD1 = async () => {
    if (!window.confirm("آیا از بازنشانی و بارگذاری اطلاعات نمونه فرضی در دیتابیس زنده D1 کلودفلر خود مطمئن هستید؟")) {
      return;
    }
    setSeedStatus("seeding");
    try {
      const baseUrl = inputUrl.replace(/\/+$/, "");
      const res = await fetch(`${baseUrl}/api/db/reset`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.status === "success") {
        setSeedStatus("success");
        onRefresh();
        setTimeout(() => setSeedStatus("idle"), 3000);
      } else {
        setSeedStatus("failed");
      }
    } catch (err) {
      setSeedStatus("failed");
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Visual Top Branding Banner */}
      <div className="bg-gradient-to-l from-indigo-900 via-slate-900 to-indigo-950 p-6 rounded-3xl text-white shadow-xl border border-slate-800/50 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute left-10 bottom-0 w-72 h-72 bg-sky-500/10 rounded-full blur-3xl -z-10"></div>
        
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div>
            <div className="flex items-center gap-2.5">
              <span className="bg-indigo-500/20 text-indigo-300 text-[10px] uppercase tracking-widest px-2.5 py-1 rounded-full font-extrabold border border-indigo-500/30">
                کیت مهندسی ساختمانی
              </span>
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping"></span>
            </div>
            <h2 className="text-xl font-extrabold text-white mt-2 tracking-tight">کنسول ویندوز آفلاین و کیت همگام‌سازی ابری</h2>
            <p className="text-slate-300 text-xs mt-1.5 font-light leading-relaxed max-w-2xl">
              به درخواست شما، این بخش جهت مدیریت و بسته‌بندی ۱۰۰٪ آفلاین نرم‌افزار روی رایانه شخصی ویندوز و کنترل همگام‌سازی دوطرفه داده‌ها توسعه یافته است.
            </p>
          </div>
          
          <div className="flex items-center gap-2 bg-slate-950/40 p-1 rounded-2xl border border-slate-800/60 self-stretch md:self-auto justify-center">
            <button
              onClick={() => setActiveMode("offline_windows")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMode === "offline_windows"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Laptop className="w-4 h-4" />
              نسخه آفلاین دسکتاپ ویندوز
            </button>
            <button
              onClick={() => setActiveMode("cloudflare")}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 cursor-pointer ${
                activeMode === "cloudflare"
                  ? "bg-indigo-600 text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Cloud className="w-4 h-4" />
              تنظیمات سرور آنلاین (Cloudflare)
            </button>
          </div>
        </div>
      </div>

      {activeMode === "offline_windows" ? (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Column 1: Sync and Overwrite Terminal */}
          <div className="xl:col-span-1 space-y-6">
            
            {/* Interactive Data Export Panel */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Database className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">۱. دریافت دیتابیس جهت نسخه آفلاین</h3>
              </div>
              <p className="text-slate-500 font-light text-xs leading-relaxed">
                کل اسناد مالی، انبار، چک‌ها و پروژه‌ها را به صورت یکجا به شکل فایل دیتابیس JSON دانلود کنید و در پوشه برنامه آفلاین دسکتاپ ویندوز خود قرار دهید تا برنامه با آخرین داده‌ها بالا بیاید.
              </p>
              <button
                onClick={handleDownloadActiveDb}
                className="w-full py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl transition-all border border-indigo-150 hover:border-indigo-200 text-xs cursor-pointer flex items-center justify-center gap-2"
              >
                <Download className="w-4 h-4" />
                دانلود دیتابیس فعال (db.json)
              </button>
            </div>

            {/* Interactive Upload/Import Terminal (Sync Engine) */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Upload className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">۲. آپلود و همگام‌سازی از ویندوز آفلاین</h3>
              </div>
              <p className="text-slate-500 font-light text-xs leading-relaxed">
                وقتی روی ویندوز به صورت آفلاین ثبت سند انجام دادید، می‌توانید فایل <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">db.json</code> را از رایانه خود در زیر کشیده یا انتخاب کنید تا کل دیتابیس سرور با داده‌های آفلاین شما به‌روزرسانی شود.
              </p>

              {/* Drag and drop box */}
              <div 
                className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all relative ${
                  dragOver ? "border-indigo-600 bg-indigo-50/50" : "border-slate-250 hover:border-indigo-400 bg-slate-50/50"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragOver(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) processDbFile(file);
                }}
              >
                <input 
                  type="file" 
                  id="db-file-picker" 
                  accept=".json"
                  className="hidden" 
                  onChange={handleFileUpload}
                />
                <label htmlFor="db-file-picker" className="cursor-pointer block space-y-2">
                  <FileJson className="w-8 h-8 text-slate-400 mx-auto" />
                  <span className="text-xs font-bold text-slate-700 block">انتخاب فایل دیتابیس db.json</span>
                  <span className="text-[10px] text-slate-400 font-light block">یا فایل را به اینجا بکشید و رها کنید</span>
                </label>
              </div>

              {importFileName && (
                <div className="p-3 bg-slate-100 border border-slate-200 rounded-xl space-y-2.5 text-xs">
                  <div className="flex justify-between items-center text-slate-700 font-bold">
                    <span>فایل شناسایی شده:</span>
                    <span className="font-mono text-[11px] text-indigo-600">{importFileName}</span>
                  </div>
                  
                  {syncError ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-150 rounded-lg text-rose-600 text-[10px] leading-relaxed flex items-center gap-1.5 font-bold">
                      <AlertTriangle className="w-4 h-4 shrink-0 text-rose-500" />
                      {syncError}
                    </div>
                  ) : importedDb ? (
                    <div className="space-y-2">
                      <div className="grid grid-cols-2 gap-1.5 text-[10px] text-slate-500 bg-white p-2 rounded-lg border border-slate-150">
                        <div>پروژه‌ها: <strong className="text-slate-800 font-bold">{importedDb.projects?.length || 0}</strong></div>
                        <div>تراکنش‌ها: <strong className="text-slate-800 font-bold">{importedDb.transactions?.length || 0}</strong></div>
                        <div>حساب‌های بانکی: <strong className="text-slate-800 font-bold">{importedDb.accounts?.length || 0}</strong></div>
                        <div>اشخاص/طرف‌حساب: <strong className="text-slate-800 font-bold">{importedDb.contacts?.length || 0}</strong></div>
                      </div>

                      <button
                        onClick={handleSyncCommit}
                        disabled={syncingStatus === "processing"}
                        className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5 shadow-sm"
                      >
                        {syncingStatus === "processing" ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle className="w-4 h-4" />
                        )}
                        {syncingStatus === "processing" ? "در حال همگام‌سازی..." : "تأیید نهایی و بارگذاری دیتابیس روی سرور"}
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              {syncingStatus === "success" && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-700 text-xs space-y-1 text-center font-bold"
                >
                  <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                  <p>همگام‌سازی موفقیت‌آمیز بود!</p>
                  <p className="text-[10px] font-light text-slate-500">پایگاه داده زنده سرور به طور کامل با پایگاه داده آفلاین رایانه شما همسان‌سازی گردید.</p>
                </motion.div>
              )}
            </div>

            {/* 3. Settings: Local paths on system */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Terminal className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">۳. تنظیم مسیر ذخیره‌سازی دیتابیس و فاکتورها (نسخه ویندوز)</h3>
              </div>
              
              <p className="text-slate-500 font-light text-xs leading-relaxed">
                در این بخش می‌توانید مشخص کنید دیتابیس سیستم و پوشه فاکتورها دقیقاً در کدام قسمت از ویندوز ذخیره شوند. با تغییر مسیر، داده‌های قبلی شما به صورت خودکار منتقل خواهند شد.
              </p>

              <div className="space-y-3">
                <div className="p-2.5 bg-indigo-50/70 border border-indigo-100 rounded-xl text-[11px] text-indigo-800 font-semibold leading-relaxed">
                  💡 در فایل نصبی ویندوز (<code className="font-mono font-bold">.exe</code>) امکان انتخاب دلخواه مسیر نصب نرم‌افزار در هر درایو و پوشه‌ای فعال شده است. همچنین از بخش زیر می‌توانید مسیر نصب و نگهداری دیتابیس آفلاین را در هر زمان تغییر دهید:
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">مسیر نصب و ذخیره پایگاه داده آفلاین (db.json):</label>
                  <div className="flex gap-1.5">
                    <input 
                      type="text" 
                      value={dbPath}
                      onChange={(e) => setDbPath(e.target.value)}
                      dir="ltr"
                      placeholder="مثال: D:\HesabdarSazeh\db.json"
                      className="flex-1 p-2 border border-slate-200 rounded-xl font-mono text-[11px] bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors"
                    />
                    <button
                      type="button"
                      onClick={async () => {
                        try {
                          const electron = (window as any).require ? (window as any).require("electron") : null;
                          if (electron && electron.ipcRenderer) {
                            const selectedDir = await electron.ipcRenderer.invoke("select-directory");
                            if (selectedDir) {
                              const sep = selectedDir.includes("\\") ? "\\" : "/";
                              setDbPath(`${selectedDir.replace(/[\\/]$/, "")}${sep}db.json`);
                              setUploadsPath(`${selectedDir.replace(/[\\/]$/, "")}${sep}uploads`);
                            }
                          } else {
                            alert("در نسخه نصبی ویندوز (EXE) پنجره انتخاب پوشه ویندوز باز می‌شود. در مرورگر می‌توانید مسیر دلخواه (مثلاً D:\\HesabdarSazeh\\db.json) را تایپ نمایید.");
                          }
                        } catch {
                          // Ignore
                        }
                      }}
                      className="px-3 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-[10px] font-bold shrink-0 cursor-pointer"
                    >
                      انتخاب پوشه...
                    </button>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">مسیر ذخیره فاکتورها (uploads):</label>
                  <input 
                    type="text" 
                    value={uploadsPath}
                    onChange={(e) => setUploadsPath(e.target.value)}
                    dir="ltr"
                    placeholder="مثال: D:\HesabdarSazeh\uploads"
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono text-[11px] bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] text-slate-500 font-bold block">بازه زمانی پشتیبان‌گیری و همگام‌سازی خودکار:</label>
                  <select
                    value={autoBackupSyncIntervalHours}
                    onChange={(e) => setAutoBackupSyncIntervalHours(Number(e.target.value))}
                    className="w-full p-2 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors font-semibold"
                  >
                    <option value={0}>غیرفعال (فقط دستی)</option>
                    <option value={1}>هر ۱ ساعت (بکاپ ویندوز + همگام‌سازی آنلاین)</option>
                    <option value={2}>هر ۲ ساعت (بکاپ ویندوز + همگام‌سازی آنلاین)</option>
                    <option value={4}>هر ۴ ساعت (بکاپ ویندوز + همگام‌سازی آنلاین)</option>
                    <option value={6}>هر ۶ ساعت (بکاپ ویندوز + همگام‌سازی آنلاین)</option>
                    <option value={12}>هر ۱۲ ساعت (بکاپ ویندوز + همگام‌سازی آنلاین)</option>
                    <option value={24}>هر ۲۴ ساعت (بکاپ ویندوز + همگام‌سازی آنلاین)</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-between items-center pt-2 gap-2">
                <button
                  onClick={handleSaveSettings}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <CheckCircle className="w-4 h-4" />
                  ذخیره پیکربندی مسیرها
                </button>
              </div>

              {saveSuccess && (
                <div className="p-2 bg-emerald-50 border border-emerald-150 rounded-lg text-emerald-700 text-[10px] font-bold text-center">
                  تنظیمات مسیر ذخیره‌سازی با موفقیت ذخیره و اعمال شد!
                </div>
              )}
            </div>

          </div>

          {/* Column 2 & 3: Desktop App Guide & Pre-Configured Downloader */}
          <div className="xl:col-span-2 space-y-6">
            
            {/* Download Scripts and Setup Wizard */}
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-xs space-y-6">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Laptop className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-base">کیت ساخت برنامه آفلاین ویندوز (Electron Runner)</h3>
              </div>

              <div className="space-y-4">
                <h4 className="font-bold text-xs text-slate-700">۱. چرا فناوری Electron بهترین گزینه است؟</h4>
                <p className="text-slate-500 text-xs font-light leading-relaxed">
                  فناوری <strong className="text-slate-800 font-extrabold">الکترون (Electron)</strong> به شما امکان می‌دهد تا دقیقاً همین کدها و پنل‌های گرافیکی زیبا را بدون تغییر حتی یک خط کدهای قالب، به یک برنامه مستقل ویندوزی با پسوند <code className="font-mono bg-slate-100 px-1 py-0.5 rounded text-indigo-600 font-bold">.exe</code> تبدیل کنید. این روش به همراه فایل ذخیره اطلاعاتی آفلاین، امن‌ترین و سریع‌ترین کارایی را دارد.
                </p>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="font-bold text-xs text-slate-700 flex items-center gap-1">
                    <Download className="w-4 h-4 text-indigo-600" />
                    دانلود فایلهای آماده پیکربندی ویندوز:
                  </h4>
                  <p className="text-slate-400 font-light text-[11px]">با کلیک روی دکمه‌های زیر فایلهای آماده را دانلود کرده و در ریشه اصلی پوشه پروژه حسابداری خود قرار دهید:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <button 
                      onClick={() => downloadFile(electronMainJs, "electron-main.js", "application/javascript")}
                      className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-indigo-600" />
                      دانلود فایل electron-main.js
                    </button>
                    <button 
                      onClick={() => downloadFile(electronPackageJson, "package-desktop.json", "application/json")}
                      className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-indigo-600" />
                      دانلود فایل package.json دسکتاپ
                    </button>
                    <button 
                      onClick={() => downloadFile(windowsStartBat, "start-offline.bat", "application/octet-stream")}
                      className="px-3 py-2.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Download className="w-4 h-4 text-indigo-600" />
                      دانلود فایل start-offline.bat
                    </button>
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3.5">
                  <h4 className="font-bold text-xs text-slate-700">۲. مراحل راه‌اندازی و اجرای ۱۰۰٪ آفلاین روی رایانه ویندوز شما:</h4>
                  
                  <div className="space-y-4 text-xs">
                    <div className="flex gap-3">
                      <div className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">۱</div>
                      <div>
                        <p className="font-bold text-slate-800">ایجاد پوشه دسکتاپ پروژه</p>
                        <p className="text-slate-500 font-light mt-0.5">کدهای کامل پروژه خود را دانلود کرده و در یک پوشه در درایو <code className="font-mono bg-slate-100 px-1 rounded text-slate-700 text-[10px]">C:\\</code> یا هر محل دیگر روی ویندوز کپی کنید.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">۲</div>
                      <div>
                        <p className="font-bold text-slate-800">قرار دادن فایلهای دسکتاپ</p>
                        <p className="text-slate-500 font-light mt-0.5">سه فایل دانلود شده فوق را کپی کرده و دقیقاً در کنار بقیه فایلهای پروژه (در ریشه اصلی پوشه) پیست کنید.</p>
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <div className="w-6 h-6 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-xs shrink-0">۳</div>
                      <div>
                        <p className="font-bold text-slate-800">اجرای نهایی و لذت بردن آفلاین!</p>
                        <p className="text-slate-500 font-light mt-0.5">روی فایل <strong className="text-slate-800 font-bold">start-offline.bat</strong> دو بار کلیک کنید. سیستم به صورت خودکار Node.js شما را چک می‌کند، کامپایل نهایی را انجام می‌دهد، مرورگر و پنل مدیریتی آفلاین شما را روی رایانه‌تان باز کرده و داده‌ها را در یک فایل محلی ذخیره می‌کند.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-150 p-4 rounded-xl flex items-start gap-2.5 text-xs">
                  <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold text-amber-800 block">نکته بسیار مهم در زمان اتصال به سیستم آنلاین (همگام‌سازی):</span>
                    <p className="text-amber-700 font-light mt-1 leading-relaxed">
                      از آنجا که سیستم آفلاین شما نیازی به اینترنت ندارد، هر زمان مایل بودید داده‌های ویندوز را روی پنل تحت وب یا در ورکر Cloudflare خود آپلود کنید، کافیست فولدری که الکترون فایل دیتابیس را در آن ذخیره کرده را باز کنید، فایل <code className="font-mono text-[10px] bg-amber-100 font-bold px-1 rounded text-amber-800">construction_db.json</code> را برداشته و در کادر چپ همین صفحه آپلود کنید تا کل سرور همگام شود.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>

        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          
          {/* Dynamic Cloudflare Control and Bot Settings (Left & Center Bento) */}
          <div className="lg:col-span-2 space-y-6">
            
            {/* 1. Bot Settings: Local paths on system */}
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Terminal className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">تنظیمات ربات دسکتاپ (محل دیتابیس و فاکتورها)</h3>
              </div>
              
              <p className="text-slate-500 font-light text-xs leading-relaxed">
                در این بخش می‌توانید مشخص کنید دیتابیس سیستم و پوشه فاکتورها و فیش‌های دریافتی دقیقاً در کدام قسمت از ویندوز ذخیره شوند. با تغییر مسیر، داده‌های قبلی شما به صورت خودکار منتقل خواهند شد.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 font-bold block">مسیر ذخیره پایگاه داده (db.json):</label>
                  <input 
                    type="text" 
                    value={dbPath}
                    onChange={(e) => setDbPath(e.target.value)}
                    dir="ltr"
                    placeholder="مثال: C:\SazeAccounting\db.json"
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <span className="text-[10px] text-slate-400 font-light block">خالی رها کردن به منزله استفاده از مسیر پیش‌فرض ریشه برنامه است.</span>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-500 font-bold block">مسیر ذخیره فاکتورها و فیش‌ها (uploads):</label>
                  <input 
                    type="text" 
                    value={uploadsPath}
                    onChange={(e) => setUploadsPath(e.target.value)}
                    dir="ltr"
                    placeholder="مثال: C:\SazeAccounting\uploads"
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                  <span className="text-[10px] text-slate-400 font-light block">پوشه‌ای که عکس فاکتورها و فیش‌ها از ویندوز در آن کپی خواهند شد.</span>
                </div>
              </div>

              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <label className="text-[11px] text-slate-500 font-bold block">بازه زمانی پشتیبان‌گیری و همگام‌سازی خودکار (مخصوص نسخه ویندوز):</label>
                <select
                  value={autoBackupSyncIntervalHours}
                  onChange={(e) => setAutoBackupSyncIntervalHours(Number(e.target.value))}
                  className="w-full md:w-1/2 p-2.5 border border-slate-200 rounded-xl text-xs bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors font-semibold"
                >
                  <option value={0}>غیرفعال (فقط همگام‌سازی و پشتیبان‌گیری دستی)</option>
                  <option value={1}>هر ۱ ساعت (بکاپ خودکار ویندوز + همگام‌سازی خودکار آنلاین)</option>
                  <option value={2}>هر ۲ ساعت (بکاپ خودکار ویندوز + همگام‌سازی خودکار آنلاین)</option>
                  <option value={4}>هر ۴ ساعت (بکاپ خودکار ویندوز + همگام‌سازی خودکار آنلاین)</option>
                  <option value={6}>هر ۶ ساعت (بکاپ خودکار ویندوز + همگام‌سازی خودکار آنلاین)</option>
                  <option value={12}>هر ۱۲ ساعت (بکاپ خودکار ویندوز + همگام‌سازی خودکار آنلاین)</option>
                  <option value={24}>هر ۲۴ ساعت (بکاپ خودکار ویندوز + همگام‌سازی خودکار آنلاین)</option>
                </select>
                <span className="text-[10px] text-slate-400 font-light block leading-relaxed mt-1">
                  سیستم ویندوز شما بر اساس این زمان‌بندی، فایل پشتیبان db.json محلی تهیه کرده و در صورت تعریف ورکر فعال کلودفلر، اطلاعات را به ورکر ابری آپلود می‌نماید.
                </span>
              </div>

              <div className="flex justify-between items-center pt-2">
                <button
                  onClick={handleSaveSettings}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center gap-1.5 shadow-md"
                >
                  <CheckCircle className="w-4 h-4" />
                  ذخیره پیکربندی مسیرها
                </button>

                {saveSuccess && (
                  <motion.span 
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="text-emerald-600 text-xs font-bold"
                  >
                    تنظیمات با موفقیت ذخیره گردید!
                  </motion.span>
                )}
              </div>
            </div>

            {/* 2. Auto Cloudflare deployment config */}
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Cloud className="w-5 h-5 text-sky-500 animate-pulse" />
                <h3 className="font-extrabold text-slate-800 text-sm">ربات ساخت و آپلود خودکار ورکر کلودفلر (One-Click Setup)</h3>
              </div>
              
              <p className="text-slate-500 font-light text-xs leading-relaxed">
                دیگر نیازی به استفاده از خط فرمان و اجرای کدهای سخت نیست! مشخصات توکن کلودفلر خود را وارد کنید، ربات ما به صورت کاملاً اتوماتیک ورکر را ساخته، دیتابیس سریع KV را تعریف کرده و کل کدها را برای شما مستقر می‌کند.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-[11px] text-slate-500 font-bold block">Cloudflare API Token:</label>
                  <input 
                    type="password" 
                    value={cfApiToken}
                    onChange={(e) => setCfApiToken(e.target.value)}
                    dir="ltr"
                    placeholder="توکن API کلودفلر با دسترسی Workers"
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-[11px] text-slate-500 font-bold block">Cloudflare Account ID:</label>
                  <input 
                    type="text" 
                    value={cfAccountId}
                    onChange={(e) => setCfAccountId(e.target.value)}
                    dir="ltr"
                    placeholder="شناسه اکانت کلودفلر شما"
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <div className="space-y-1.5 md:col-span-1">
                  <label className="text-[11px] text-slate-500 font-bold block">نام ورکر انتخابی (Worker Name):</label>
                  <input 
                    type="text" 
                    value={cfWorkerName}
                    onChange={(e) => setCfWorkerName(e.target.value)}
                    dir="ltr"
                    placeholder="hesabdarpeymankar"
                    className="w-full p-2.5 border border-slate-200 rounded-xl font-mono text-xs bg-slate-50 focus:outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>
              </div>

              {deployError && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 text-xs font-bold leading-relaxed flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  {deployError}
                </div>
              )}

              <div className="flex flex-col lg:flex-row gap-4 pt-1 justify-between items-stretch lg:items-center">
                <div className="flex flex-wrap gap-2.5 items-center">
                  <button
                    onClick={handleAutoDeploy}
                    disabled={isDeploying || isConnecting}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {isDeploying ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Play className="w-4 h-4 text-sky-300" />
                    )}
                    {isDeploying ? "در حال ساخت و استقرار..." : "ساخت و پیکربندی خودکار ورکر"}
                  </button>

                  <button
                    onClick={handleConnectExisting}
                    disabled={isDeploying || isConnecting}
                    className="px-4 py-2.5 bg-sky-600 hover:bg-sky-700 disabled:bg-sky-400 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-md"
                  >
                    {isConnecting ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Link2 className="w-4 h-4 text-sky-100" />
                    )}
                    {isConnecting ? "در حال اتصال..." : "اتصال به ورکر از قبل ساخته شده"}
                  </button>

                  <button
                    onClick={handleTestConnection}
                    disabled={testStatus === "testing"}
                    className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl transition-all border border-slate-200 text-xs cursor-pointer flex items-center gap-1.5"
                  >
                    {testStatus === "testing" ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Wifi className="w-3.5 h-3.5" />}
                    آزمایش وضعیت اتصال
                  </button>
                </div>

                <div className="flex items-center gap-2.5 bg-slate-50 p-2 border border-slate-150 rounded-xl shrink-0 self-start lg:self-auto">
                  <span className="text-[10px] text-slate-500 font-bold">حالت دیتابیس ابری:</span>
                  <button
                    onClick={() => onToggleCf(!cfEnabled)}
                    className={`px-3 py-1.5 border rounded-lg font-extrabold transition-all cursor-pointer text-xs ${
                      cfEnabled 
                        ? "bg-emerald-500 border-emerald-600 text-white shadow-xs" 
                        : "bg-slate-200 border-slate-300 text-slate-600"
                    }`}
                  >
                    {cfEnabled ? "فعال (سرور آنلاین)" : "غیرفعال (آفلاین محلی)"}
                  </button>
                </div>
              </div>

              {testStatus === "connected" && (
                <div className="p-3 bg-emerald-50 border border-emerald-150 rounded-xl text-emerald-700 text-xs flex items-center gap-1.5 leading-relaxed font-bold">
                  <CheckCircle className="w-4 h-4 text-emerald-500 shrink-0" />
                  اتصال به وب‌سرویس ابری با موفقیت لود و تأیید شد!
                </div>
              )}

              {cfWorkerUrl && (
                <div className="p-3 bg-slate-50 border border-slate-150 rounded-xl text-slate-600 text-xs space-y-1 font-mono">
                  <div className="flex justify-between">
                    <span className="font-sans font-bold text-[10px] text-slate-400">آدرس سرور زنده:</span>
                    <a href={cfWorkerUrl} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{cfWorkerUrl}</a>
                  </div>
                  <div className="flex justify-between border-t border-slate-100 pt-1 mt-1">
                    <span className="font-sans font-bold text-[10px] text-slate-400">توکن امنیتی هماهنگ‌سازی:</span>
                    <span className="text-slate-700 font-bold">{syncToken}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Right Bento - Synchronization Actions & Storage details */}
          <div className="space-y-6">
            
            {/* Sync Hub Panel */}
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <RefreshCw className={`w-5 h-5 text-indigo-600 ${isSyncingAll ? "animate-spin" : ""}`} />
                <h3 className="font-extrabold text-slate-800 text-sm">هماهنگ‌سازی آفلاین به آنلاین</h3>
              </div>
              
              <p className="text-slate-500 font-light text-xs leading-relaxed">
                این دکمه جادویی تمام اطلاعات ثبت شده محلی شما را برداشته و مستقیماً به هاست کلودفلر ارسال می‌کند. این عملیات شامل:
              </p>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 space-y-2.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>کل دیتابیس ساختار یافته مالی و انبارداری</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>تمامی عکس‌های فیش‌ها و فاکتورها</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-emerald-500" />
                  <span>اسناد و چک‌های اسکن شده صادر شده</span>
                </div>
              </div>

              {syncErrorAll && (
                <div className="p-3 bg-rose-50 border border-rose-150 rounded-xl text-rose-700 text-xs font-bold leading-relaxed flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0" />
                  {syncErrorAll}
                </div>
              )}

              <button
                onClick={handleAutoSync}
                disabled={isSyncingAll || !cfWorkerUrl}
                className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400 text-white font-extrabold rounded-xl transition-all cursor-pointer text-xs flex items-center justify-center gap-2 shadow-md shadow-emerald-600/10"
              >
                {isSyncingAll ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {isSyncingAll ? "در حال انتقال داده‌ها..." : "انتقال کل پایگاه داده و فایل‌ها به آنلاین"}
              </button>

              {!cfWorkerUrl && (
                <p className="text-amber-600 font-bold text-[10px] text-center leading-relaxed">
                  * ابتدا باید مشخصات کلودفلر را در کادر بغلی وارد کرده و گزینه ساخت ورکر را بزنید.
                </p>
              )}
            </div>

            {/* Backblaze B2 Storage Connector */}
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
                <Cloud className="w-5 h-5 text-indigo-600 shrink-0" />
                <h3 className="font-bold text-slate-800 text-sm">تنظیمات ذخیره‌سازی جایگزین S3</h3>
              </div>
              
              <div className="space-y-3 text-xs">
                <p className="text-slate-400 font-light text-[10px] leading-relaxed">
                  اگر به جای Cloudflare KV مایلید از باکت خارجی S3/B2 برای تصاویر اسناد و فاکتورها استفاده کنید، کادرهای زیر را پر کنید:
                </p>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block font-bold">B2 Application Key ID:</label>
                  <input 
                    type="text" 
                    value={b2KeyId}
                    onChange={(e) => setB2KeyId(e.target.value)}
                    dir="ltr"
                    placeholder="004..."
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono text-[10px] bg-slate-50 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] text-slate-500 block font-bold">B2 Application Key:</label>
                  <input 
                    type="password" 
                    value={b2AppKey}
                    onChange={(e) => setB2AppKey(e.target.value)}
                    dir="ltr"
                    placeholder="K004..."
                    className="w-full p-2 border border-slate-200 rounded-xl font-mono text-[10px] bg-slate-50 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 block font-bold">B2 Bucket ID:</label>
                    <input 
                      type="text" 
                      value={b2BucketId}
                      onChange={(e) => setB2BucketId(e.target.value)}
                      dir="ltr"
                      placeholder="Bucket ID"
                      className="w-full p-2 border border-slate-200 rounded-xl font-mono text-[10px] bg-slate-50 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 block font-bold">Bucket Name:</label>
                    <input 
                      type="text" 
                      value={b2BucketName}
                      onChange={(e) => setB2BucketName(e.target.value)}
                      dir="ltr"
                      placeholder="Bucket Name"
                      className="w-full p-2 border border-slate-200 rounded-xl font-mono text-[10px] bg-slate-50 focus:outline-none focus:border-indigo-500"
                    />
                  </div>
                </div>

                <button
                  onClick={handleTestB2}
                  disabled={b2TestStatus === "testing"}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl transition-colors cursor-pointer text-center text-xs"
                >
                  {b2TestStatus === "testing" ? "در حال تست اتصال..." : "تست و ذخیره اتصال B2"}
                </button>

                {b2TestMsg && (
                  <div className={`p-2.5 border rounded-xl text-[10px] leading-relaxed font-semibold ${
                    b2TestStatus === "success" 
                      ? "bg-emerald-50 border-emerald-150 text-emerald-700" 
                      : "bg-rose-50 border-rose-150 text-rose-700"
                  }`}>
                    {b2TestMsg}
                  </div>
                )}
              </div>
            </div>

          </div>

        </div>
      )}
    </div>
  );
}
