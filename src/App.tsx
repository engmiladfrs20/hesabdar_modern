import React, { useEffect, useState } from "react";
import { DatabaseSchema, Project, Transaction, Account, CheckItem, Material, MaterialTransaction, UnitItem, Contact, User } from "./types";
import Dashboard from "./components/Dashboard";
import ProjectsManager from "./components/ProjectsManager";
import TransactionsManager from "./components/TransactionsManager";
import WarehouseManager from "./components/WarehouseManager";
import CheckManager from "./components/CheckManager";
import TaxAdvisor from "./components/TaxAdvisor";
import DeveloperKit from "./components/DeveloperKit";
import ContractsAndImprests from "./components/ContractsAndImprests";
import PayrollTimesheets from "./components/PayrollTimesheets";
import AccountingReports from "./components/AccountingReports";
import DocumentArchive from "./components/DocumentArchive";
import { 
  Building, 
  Briefcase, 
  Receipt, 
  Package, 
  Clock, 
  Sparkles, 
  Cloud, 
  Users, 
  LogOut, 
  RefreshCw, 
  LayoutDashboard,
  ShieldAlert,
  Download,
  CheckCircle,
  TrendingDown,
  BookOpen,
  Trash2,
  Plus,
  X,
  FolderOpen,
  Edit3
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

export const ALL_PERMISSIONS = [
  { id: "view_dashboard", name: "مشاهده میز کار (داشبورد)" },
  { id: "manage_projects", name: "مدیریت پروژه‌ها و واحدها" },
  { id: "manage_transactions", name: "مدیریت دریافت و پرداخت" },
  { id: "manage_warehouse", name: "مدیریت انبارداری و کالا" },
  { id: "manage_checks", name: "مدیریت چک‌های صیادی" },
  { id: "manage_contracts", name: "مدیریت قراردادها و تنخواه" },
  { id: "manage_payroll", name: "مدیریت حقوق و دستمزد" },
  { id: "view_reports", name: "مشاهده گزارش‌ها و دفاتر مالی" },
  { id: "manage_archive", name: "مدیریت بایگانی اسناد" },
  { id: "view_tax", name: "مشاهده مشاور مالیاتی هوشمند" },
  { id: "manage_dev_kit", name: "مدیریت کیت توسعه کلودفلر" },
  { id: "manage_users", name: "مدیریت کاربران و دسترسی‌ها" },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<string>("dashboard");
  const [db, setDb] = useState<DatabaseSchema | null>(null);
  const [activeCompanyId, setActiveCompanyId] = useState<string>("c1");
  const [activeUserId, setActiveUserId] = useState<string>("u1");
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncSuccess, setSyncSuccess] = useState(false);
  
  // --- Automated Database Backup & Recovery States ---
  const [showRestoreBackupBanner, setShowRestoreBackupBanner] = useState(false);
  const [backupDbData, setBackupDbData] = useState<DatabaseSchema | null>(null);

  // --- Versioned Cloud & Local Backup / Startup Update Modal States ---
  const [showVersionUpdateModal, setShowVersionUpdateModal] = useState(false);
  const [backupVersions, setBackupVersions] = useState<any[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [restoringVersionId, setRestoringVersionId] = useState<string | null>(null);
  const [isClosingWithBackup, setIsClosingWithBackup] = useState(false);
  const [closeBackupStatusText, setCloseBackupStatusText] = useState("در حال ثبت بکاپ جدید روی دیتای محلی و سرور آنلاین ابری...");
  const [firstInstallNotice, setFirstInstallNotice] = useState<string | null>(null);
  
  // Custom states for company management & offline sync
  const [showCompanyModal, setShowCompanyModal] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState("");
  const [companyDeleteConfirmId, setCompanyDeleteConfirmId] = useState<string | null>(null);
  const [companyErrorText, setCompanyErrorText] = useState<string | null>(null);

  // Cloudflare D1 Connection States (Offline Priority by default!)
  const [cfEnabled, setCfEnabled] = useState<boolean>(false);
  const [cfUrl, setCfUrl] = useState<string>(() => {
    return localStorage.getItem("cf_url") || "https://hesabdarpeymankar.vikoni4694.workers.dev";
  });
  const [fetchError, setFetchError] = useState<string | null>(null);

  // --- User Authentication States ---
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    return localStorage.getItem("isLoggedIn") === "true";
  });
  const [loginUsername, setLoginUsername] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  // --- User Management Modal States ---
  const [showUserModal, setShowUserModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [userNameInput, setUserNameInput] = useState("");
  const [userRoleInput, setUserRoleInput] = useState<"manager" | "accountant" | "investor" | "supervisor">("supervisor");
  const [userRoleNameInput, setUserRoleNameInput] = useState("");
  const [userUsernameInput, setUserUsernameInput] = useState("");
  const [userPasswordInput, setUserPasswordInput] = useState("");
  const [userErrorText, setUserErrorText] = useState<string | null>(null);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>([]);

  const getApiUrl = (endpoint: string) => {
    if (cfEnabled && cfUrl) {
      const baseUrl = cfUrl.replace(/\/+$/, "");
      return `${baseUrl}${endpoint}`;
    }
    return endpoint;
  };

  const getB2Headers = () => {
    return {
      "x-b2-key-id": localStorage.getItem("b2_key_id") || "",
      "x-b2-app-key": localStorage.getItem("b2_app_key") || "",
      "x-b2-bucket-id": localStorage.getItem("b2_bucket_id") || "",
      "x-b2-bucket-name": localStorage.getItem("b2_bucket_name") || ""
    };
  };

  const toggleCfMode = (enabled: boolean) => {
    localStorage.setItem("cf_enabled", enabled ? "true" : "false");
    setCfEnabled(enabled);
    setFetchError(null);
    // Reload state after switching database mode
    setTimeout(() => {
      fetchDb(enabled, cfUrl);
    }, 100);
  };

  const updateCfUrl = (newUrl: string) => {
    localStorage.setItem("cf_url", newUrl);
    setCfUrl(newUrl);
  };

  // Fetch full DB on startup or switch
  const fetchDb = async (overriddenCfEnabled?: boolean, overriddenCfUrl?: boolean | string) => {
    setIsSyncing(true);
    setFetchError(null);
    const activeCfEnabled = overriddenCfEnabled !== undefined ? overriddenCfEnabled : cfEnabled;
    const activeCfUrl = typeof overriddenCfUrl === "string" ? overriddenCfUrl : cfUrl;

    let targetUrl = "/api/db";
    if (activeCfEnabled && activeCfUrl) {
      const baseUrl = activeCfUrl.replace(/\/+$/, "");
      targetUrl = `${baseUrl}/api/db`;
    }

    try {
      const response = await fetch(targetUrl);
      if (!response.ok) {
        throw new Error(`خطای سرور: ${response.status}`);
      }
      const data = await response.json();
      if (data && data.error) {
        throw new Error(data.error);
      }
      setDb(data);
      if (data.companies && data.companies.length > 0) {
        setActiveCompanyId(prev => data.companies.some((c: any) => c.id === prev) ? prev : data.companies[0].id);
      }
    } catch (err: any) {
      console.error("Error fetching db from database backend:", err);
      setFetchError(err.message || "خطای نامشخص در برقراری ارتباط با پایگاه داده");
    } finally {
      setIsSyncing(false);
    }
  };

  // Fetch available backup versions (Online Cloud + Local)
  const fetchAvailableBackupVersions = async (openModalIfAvailable: boolean = false) => {
    setIsLoadingVersions(true);
    try {
      const targetUrl = `/api/backups?cfUrl=${encodeURIComponent(cfUrl)}`;
      const res = await fetch(targetUrl);
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data.versions)) {
          setBackupVersions(data.versions);
          if (openModalIfAvailable) {
            setShowVersionUpdateModal(true);
          }
          return;
        }
      }
      // Fallback: try direct cloud backups endpoint if running on static/worker directly
      if (cfUrl) {
        const cloudRes = await fetch(`${cfUrl.replace(/\/+$/, "")}/api/backups`);
        if (cloudRes.ok) {
          const cloudData = await cloudRes.json();
          if (cloudData && Array.isArray(cloudData.versions)) {
            setBackupVersions(cloudData.versions);
            if (openModalIfAvailable) {
              setShowVersionUpdateModal(true);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error fetching backup versions:", err);
    } finally {
      setIsLoadingVersions(false);
    }
  };

  // Restore / Update offline software to a selected backup version
  const handleRestoreToVersion = async (version: any) => {
    setRestoringVersionId(version.id);
    setIsSyncing(true);
    try {
      const res = await fetch("/api/backups/restore", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          versionId: version.id,
          location: version.location || "cloud",
          cfUrl
        })
      });

      const data = await res.json();
      if (res.ok && data.status === "success") {
        if (data.db) {
          setDb(data.db);
          if (data.db.companies && data.db.companies.length > 0) {
            setActiveCompanyId(data.db.companies[0].id);
          }
        } else {
          await fetchDb(false, cfUrl);
        }
        setShowVersionUpdateModal(false);
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 3000);
        alert(`نرم‌افزار آفلاین با موفقیت به «${version.versionName}» به‌روزرسانی شد.`);
      } else {
        alert("خطا در به‌روزرسانی به این ورژن: " + (data.error || "خطای نامشخص"));
      }
    } catch (err: any) {
      alert("خطا در ارتباط با سرور جهت به‌روزرسانی ورژن: " + err.message);
    } finally {
      setRestoringVersionId(null);
      setIsSyncing(false);
    }
  };

  const handleRestoreFromBrowserBackup = async () => {
    if (!backupDbData) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/db/import"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupDbData)
      });
      const resData = await response.json();
      if (resData.status === "success" || !resData.error) {
        setShowRestoreBackupBanner(false);
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert("خطا در بازیابی کپی پشتیبان: " + (resData.error || "خطای نامشخص"));
      }
    } catch (err: any) {
      console.error("Error importing backup:", err);
      alert("خطا در همگام‌سازی و اعمال کپی پشتیبان: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Startup initialization:
  // 1) If first time installed and local DB is empty, automatically read from Cloud.
  // 2) Open the Version Update Prompt so user can choose if they want to update to any version.
  useEffect(() => {
    const initApp = async () => {
      setIsSyncing(true);
      try {
        // Check first-install cloud initialization on local server
        const firstSyncRes = await fetch("/api/first-install-sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cfUrl })
        });
        if (firstSyncRes.ok) {
          const syncData = await firstSyncRes.json();
          if (syncData && syncData.db) {
            setDb(syncData.db);
            if (syncData.db.companies && syncData.db.companies.length > 0) {
              setActiveCompanyId(syncData.db.companies[0].id);
            }
            if (syncData.initializedFromCloud) {
              setFirstInstallNotice("در اولین نصب، اطلاعات به صورت خودکار از نسخه ابری خوانده و در نسخه آفلاین بارگذاری شد.");
            }
          } else {
            await fetchDb(false, cfUrl);
          }
        } else {
          await fetchDb(false, cfUrl);
        }
      } catch {
        await fetchDb(false, cfUrl);
      } finally {
        setIsSyncing(false);
      }

      // When offline software opens, fetch backup versions and show the update prompt modal
      await fetchAvailableBackupVersions(true);
    };

    initApp();
  }, []);

  // Pre-close automatic backup on both Local & Online Cloud
  useEffect(() => {
    (window as any).__showClosingBackupModal = () => {
      setIsClosingWithBackup(true);
      setCloseBackupStatusText("در حال ثبت بکاپ جدید روی دیتای محلی و سرور آنلاین قبل از بستن نرم‌افزار...");
    };

    const handleBeforeUnload = () => {
      try {
        const payload = JSON.stringify({
          cfUrl,
          source: "بکاپ خودکار هنگام بستن نرم‌افزار آفلاین"
        });
        fetch("/api/backup-on-close", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: payload,
          keepalive: true
        }).catch(() => {});
      } catch {}
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [cfUrl]);

  const handleSafeExitWithBackup = async () => {
    setIsClosingWithBackup(true);
    setCloseBackupStatusText("در حال ثبت بکاپ جدید با تاریخ و ساعت فعلی روی دیتای محلی و آنلاین...");
    try {
      const res = await fetch("/api/backup-on-close", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cfUrl,
          source: "بکاپ خودکار هنگام بستن نرم‌افزار آفلاین"
        })
      });
      const data = await res.json().catch(() => ({}));
      const verLabel = data?.onlineVersion?.versionName || data?.localVersion?.versionName || "نسخه جدید";
      setCloseBackupStatusText(`بکاپ جدید (${verLabel}) با موفقیت در دیتای محلی و آنلاین ذخیره شد.`);
      setTimeout(() => {
        setIsClosingWithBackup(false);
        window.close();
      }, 1200);
    } catch {
      setCloseBackupStatusText("بکاپ محلی ذخیره شد.");
      setTimeout(() => {
        setIsClosingWithBackup(false);
        window.close();
      }, 1200);
    }
  };

  const handleResetDb = async () => {
    if (!window.confirm("آیا از پاکسازی کامل تمامی اطلاعات و خالی کردن پایگاه داده مطمئن هستید؟")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/db/reset"), { method: "POST" });
      const data = await response.json();
      if (data.status === "success") {
        localStorage.removeItem("hesabdar_db_backup");
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error resetting database:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddProject = async (projectData: Partial<Project>) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...projectData, companyId: activeCompanyId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error adding project:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleUpdateUnit = async (unitIdOrObj: string | Partial<UnitItem>, updatedData?: Partial<UnitItem>) => {
    setIsSyncing(true);
    try {
      const payload = typeof unitIdOrObj === "string"
        ? { id: unitIdOrObj, ...(updatedData || {}) }
        : { ...unitIdOrObj, ...(updatedData || {}) };
      const response = await fetch(getApiUrl("/api/units"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error updating unit status:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddUnitExpense = async (
    unitId: string,
    expenseOrTitle: { title: string; amount: number; date?: string } | string,
    amountArg?: number
  ) => {
    setIsSyncing(true);
    try {
      const expenseObj = typeof expenseOrTitle === "string"
        ? { title: expenseOrTitle, amount: Number(amountArg) || 0, date: new Date().toLocaleDateString("fa-IR") }
        : expenseOrTitle;
      const response = await fetch(getApiUrl("/api/units"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unitId, addExpense: expenseObj })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error adding unit expense:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteUnit = async (unitId: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/units/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unitId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error deleting unit:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreUnit = async (unitId: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/units/restore"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: unitId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error restoring unit:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/projects/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error deleting project:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRestoreProject = async (projectId: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/projects/restore"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: projectId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error restoring project:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddCompany = async (name: string) => {
    if (!name.trim()) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/companies"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        setNewCompanyName("");
        await fetchDb();
        if (data.id) {
          setActiveCompanyId(data.id);
        }
      }
    } catch (err) {
      console.error("Error creating company:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteCompany = async (companyId: string, force: boolean = false) => {
    if (!db) return;
    if (db.companies.length <= 1) {
      setCompanyErrorText("حداقل یک شرکت باید در سیستم ثبت شده باشد.");
      return;
    }
    if (!force) {
      setCompanyDeleteConfirmId(companyId);
      return;
    }
    setCompanyDeleteConfirmId(null);
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/companies/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: companyId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        const remaining = db.companies.filter(c => c.id !== companyId);
        if (remaining.length > 0) {
          setActiveCompanyId(remaining[0].id);
        }
        await fetchDb();
      }
    } catch (err) {
      console.error("Error deleting company:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleOfflineOnlineSync = async (isSilent: boolean = false) => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/backups/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cfUrl,
          source: isSilent ? "بکاپ و همگام‌سازی دوره‌ای خودکار" : "به‌روزرسانی و ثبت بکاپ از نسخه آفلاین به آنلاین"
        })
      });

      const syncResult = await res.json();
      if (res.ok && syncResult.status === "success") {
        setSyncSuccess(true);
        const verName = syncResult.onlineVersion?.versionName || syncResult.localVersion?.versionName || "";
        if (!isSilent) {
          alert(
            syncResult.syncedOnline
              ? `همگام‌سازی و ثبت بکاپ با موفقیت انجام شد!\n\n• ورژن ثبت‌شده در آنلاین و محلی: ${verName}\n• اولویت با نسخه آفلاین حفظ گردید.`
              : `بکاپ در دیتای محلی ثبت شد (${verName})، اما ارتباط با سرور ابری برقرار نشد.`
          );
        }
        setTimeout(() => setSyncSuccess(false), 3000);
        await fetchAvailableBackupVersions(false);
        await fetchDb();
      } else {
        throw new Error(syncResult.error || "خطای همگام‌سازی");
      }
    } catch (err: any) {
      console.error("Sync error:", err);
      if (!isSilent) {
        alert("خطا در فرآیند ثبت بکاپ و همگام‌سازی آنلاین: " + err.message);
      }
    } finally {
      setIsSyncing(false);
    }
  };

  // Automatic Sync & Backup Manager (Scheduler)
  useEffect(() => {
    let intervalHours = 0;
    fetch("/api/settings")
      .then(res => res.json())
      .then(async data => {
        if (data && data.autoBackupSyncIntervalHours) {
          intervalHours = Number(data.autoBackupSyncIntervalHours);
        } else {
          intervalHours = Number(localStorage.getItem("auto_backup_interval") || "0");
        }
        
        if (intervalHours <= 0) return;

        const checkAndSync = async () => {
          const lastBackup = localStorage.getItem("last_backup_timestamp");
          const now = Date.now();
          const intervalMs = intervalHours * 60 * 60 * 1000;

          if (!lastBackup || now - Number(lastBackup) >= intervalMs) {
            console.log(`Auto backup and sync triggered. Interval: ${intervalHours} hours.`);
            
            // 1. Trigger cloud sync silently
            if (cfEnabled && cfUrl) {
              await handleOfflineOnlineSync(true);
            }

            // 2. Trigger automatic local backup by downloading db.json copy
            try {
              const targetUrl = "/api/db";
              const res = await fetch(targetUrl);
              const json = await res.json();
              
              const blob = new Blob([JSON.stringify(json, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = `backup_hesabdar_peymankar_${Date.now()}.json`;
              document.body.appendChild(link);
              link.click();
              document.body.removeChild(link);
              URL.revokeObjectURL(url);
            } catch (err) {
              console.error("Auto-backup local download failed:", err);
            }

            localStorage.setItem("last_backup_timestamp", String(now));
          }
        };

        checkAndSync();
        const timerId = setInterval(checkAndSync, 60000); // Check every 1 minute
        return () => clearInterval(timerId);
      })
      .catch(err => console.error("Error reading settings for auto backup scheduler:", err));
  }, [cfEnabled, cfUrl]);

  // --- User Authentication & Management Helpers ---
  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError("");

    const username = loginUsername.trim();
    const password = loginPassword.trim();

    if (!username || !password) {
      setLoginError("وارد کردن نام کاربری و رمز عبور الزامی است.");
      return;
    }

    if (username.toLowerCase() === "admin" && password === "Miladlar224") {
      setIsLoggedIn(true);
      localStorage.setItem("isLoggedIn", "true");
      if (db && db.users && db.users.length > 0) {
        const defaultU = db.users.find(u => u.role === "manager" || u.id === "u1") || db.users[0];
        setActiveUserId(defaultU.id);
      }
      return;
    }

    if (db && db.users) {
      const matched = db.users.find(
        u => u.username?.toLowerCase() === username.toLowerCase() && u.password === password
      );
      if (matched) {
        setIsLoggedIn(true);
        localStorage.setItem("isLoggedIn", "true");
        setActiveUserId(matched.id);
        return;
      }
    }

    setLoginError("نام کاربری یا کلمه عبور اشتباه است.");
  };

  const handleLogout = () => {
    setIsLoggedIn(false);
    localStorage.removeItem("isLoggedIn");
    setLoginUsername("");
    setLoginPassword("");
    setLoginError("");
  };

  const handleAddOrUpdateUser = async (userData: Partial<User>) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/users"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(userData)
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
        return true;
      } else {
        alert(data.error || "خطا در ثبت کاربر");
        return false;
      }
    } catch (err) {
      console.error("Error adding/updating user:", err);
      alert("خطا در برقراری ارتباط با سرور");
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteUser = async (userId: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/users/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: userId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
        if (activeUserId === userId && db && db.users) {
          const remaining = db.users.filter(u => u.id !== userId);
          if (remaining.length > 0) {
            setActiveUserId(remaining[0].id);
          }
        }
        return true;
      } else {
        alert(data.error || "خطا در حذف کاربر");
        return false;
      }
    } catch (err) {
      console.error("Error deleting user:", err);
      alert("خطا در برقراری ارتباط با سرور");
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleRoleChange = (role: "manager" | "accountant" | "investor" | "supervisor") => {
    setUserRoleInput(role);
    const roleNameMap = {
      manager: "مدیر ارشد پروژه",
      accountant: "حسابدار مالی",
      investor: "سرمایه‌گذار شریک",
      supervisor: "ناظر پروژه"
    };
    setUserRoleNameInput(roleNameMap[role]);
  };

  const handleSubmitUserForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setUserErrorText(null);

    const name = userNameInput.trim();
    const username = userUsernameInput.trim();
    const password = userPasswordInput.trim();
    const roleName = userRoleNameInput.trim();

    if (!name || !username || !password || !roleName) {
      setUserErrorText("تکمیل تمامی فیلدها الزامی است.");
      return;
    }

    const payload: Partial<User> = {
      name,
      role: userRoleInput,
      roleName,
      username,
      password,
      permissions: selectedPermissions
    };

    if (editingUserId) {
      payload.id = editingUserId;
    }

    const success = await handleAddOrUpdateUser(payload);
    if (success) {
      setEditingUserId(null);
      setUserNameInput("");
      setUserRoleInput("supervisor");
      setUserRoleNameInput("");
      setUserUsernameInput("");
      setUserPasswordInput("");
      setSelectedPermissions([]);
    }
  };

  const handleEditUserClick = (u: User) => {
    setEditingUserId(u.id);
    setUserNameInput(u.name);
    setUserRoleInput(u.role);
    setUserRoleNameInput(u.roleName);
    setUserUsernameInput(u.username || "");
    setUserPasswordInput(u.password || "");
    setSelectedPermissions(u.permissions || []);
  };

  const handleApproveTransaction = async (id: string, approvalStatus: "approved" | "rejected", approvedAmount?: number) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/transactions/approve"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id,
          approvalStatus,
          approvedAmount,
          approvedBy: activeUser?.name || "مدیر ارشد",
          approvedDate: new Date().toLocaleDateString("fa-IR")
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert(data.error || "خطا در ثبت تأییدیه");
      }
    } catch (err) {
      console.error("Error approving transaction:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleBatchGenerateUnits = async (projectId: string, unitsList: any[]) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/units/batch"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId, units: unitsList })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error batch saving units:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddTransaction = async (txData: Partial<Transaction>) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/transactions"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getB2Headers()
        },
        body: JSON.stringify({ ...txData, companyId: txData.companyId || activeCompanyId || "c1" })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error logging transaction:", err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handlePayTransaction = async (paymentData: {
    transactionId: string;
    amount: number;
    date: string;
    accountId?: string;
    rowNumber?: number | string;
    invoiceNumber?: string;
    referenceNumber?: string;
    settlementMethod?: string;
    paymentStatus?: string;
    destinationAccount?: string;
    receiptFileName?: string;
    receiptFileData?: string;
    description?: string;
  }) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/transactions/pay"), {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          ...getB2Headers()
        },
        body: JSON.stringify(paymentData)
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error submitting payment document:", err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddAccount = async (accData: Partial<Account>) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/accounts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(accData)
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error creating bank account:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteTransaction = async (txId: string) => {
    if (!window.confirm("آیا از حذف این تراکنش (سند مالی) مطمئن هستید؟")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/transactions/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: txId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert(data.error || "خطا در حذف تراکنش");
      }
    } catch (err) {
      console.error("Error deleting transaction:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteAccount = async (accId: string) => {
    if (!window.confirm("آیا از حذف این حساب مالی مطمئن هستید؟")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/accounts/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: accId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert(data.error || "خطا در حذف حساب");
      }
    } catch (err) {
      console.error("Error deleting account:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteMaterial = async (id: string, isTransaction: boolean) => {
    if (!window.confirm(isTransaction ? "آیا از حذف این سند تراکنش انبار مطمئن هستید؟" : "آیا از حذف این کالای انبار مطمئن هستید؟")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/materials/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isTransaction })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert(data.error || "خطا در حذف از انبار");
      }
    } catch (err) {
      console.error("Error deleting from warehouse:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteCheck = async (checkId: string) => {
    if (!window.confirm("آیا از حذف این چک صیادی مطمئن هستید؟")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/checks/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert(data.error || "خطا در حذف چک");
      }
    } catch (err) {
      console.error("Error deleting check:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeletePreSale = async (presaleId: string) => {
    if (!window.confirm("آیا از حذف این قرارداد پیش‌فروش مطمئن هستید؟ با حذف این قرارداد، وضعیت واحد مربوطه به «موجود» تغییر یافته و تمامی اقساط آن حذف خواهند شد.")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/presales/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: presaleId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert(data.error || "خطا در حذف قرارداد پیش‌فروش");
      }
    } catch (err) {
      console.error("Error deleting pre-sale contract:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteImprest = async (imprestId: string) => {
    if (!window.confirm("آیا از حذف این صندوق تنخواه مطمئن هستید؟ با حذف آن، کلیه هزینه‌ها و فاکتورهای مربوط به این تنخواه نیز حذف خواهند شد.")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/imprests/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: imprestId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert(data.error || "خطا در حذف صندوق تنخواه");
      }
    } catch (err) {
      console.error("Error deleting imprest fund:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeleteImprestExpense = async (expenseId: string) => {
    if (!window.confirm("آیا از حذف این فاکتور هزینه تنخواه مطمئن هستید؟ با حذف آن، مبلغ پرداختی به موجودی صندوق تنخواه‌دار بازگشت داده خواهد شد.")) return;
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/imprests/expenses/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: expenseId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      } else {
        alert(data.error || "خطا در حذف هزینه تنخواه");
      }
    } catch (err) {
      console.error("Error deleting imprest expense:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddContact = async (contactData: Partial<Contact>) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/contacts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactData.name || "",
          phone: contactData.phone || "",
          role: contactData.role || "supplier",
          nationalId: contactData.nationalId || "",
          bankCardNumber: contactData.bankCardNumber || "",
          bankName: contactData.bankName || "",
          bankIBAN: contactData.bankIBAN || "",
          jobCategory: contactData.jobCategory || "",
          paymentMethod: contactData.paymentMethod || "cash",
          barterUnits: contactData.barterUnits || [],
          projectId: contactData.projectId || undefined,
          balance: Number(contactData.balance || 0)
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
        return true;
      }
      return false;
    } catch (err) {
      console.error("Error creating contact:", err);
      return false;
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddMaterial = async (matData: Partial<Material>) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/materials"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(matData)
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error defining material:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddWarehouseTx = async (txData: Partial<MaterialTransaction>) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/materials"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(txData)
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error saving warehouse transaction:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddCheck = async (chkData: Partial<CheckItem>) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/checks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...chkData, companyId: activeCompanyId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error creating check:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleClearCheck = async (checkId: string, accountId: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/checks"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: checkId, status: "passed", accountId: accountId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSyncSuccess(true);
        setTimeout(() => setSyncSuccess(false), 2000);
        await fetchDb();
      }
    } catch (err) {
      console.error("Error clearing check:", err);
    } finally {
      setIsSyncing(false);
    }
  };

  if (!db) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-slate-50 text-slate-700 p-4 animate-fade-in" dir="rtl">
        {fetchError ? (
          <div className="w-full max-w-md bg-white border border-slate-100 rounded-2xl p-6 shadow-xl text-center">
            <div className="w-14 h-14 bg-red-50 text-red-500 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-red-100">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-sm font-extrabold text-slate-900 mb-2">عدم امکان برقراری ارتباط با پایگاه داده ابری</h2>
            <p className="text-xs text-slate-500 mb-4 font-light leading-relaxed">
              سامانه قادر به دریافت اطلاعات از آدرس ورکر Cloudflare نیست. این مورد معمولاً به دلیل فیلترینگ، خاموش بودن ورکر یا تنظیم نبودن دیتابیس D1 رخ می‌دهد.
            </p>
            
            <div className="bg-slate-50 rounded-xl p-3 mb-4 text-start border border-slate-100">
              <span className="text-[10px] text-slate-400 font-bold block mb-1">جزئیات خطا:</span>
              <p className="text-xs text-red-600 font-mono break-all font-semibold leading-relaxed">{fetchError}</p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5 text-start">
                <label className="text-[10px] text-slate-400 font-bold px-1 block">آدرس ورکر Cloudflare فعلی:</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={cfUrl} 
                    onChange={(e) => updateCfUrl(e.target.value)} 
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-indigo-600 bg-slate-50 font-mono"
                    placeholder="https://your-worker.workers.dev"
                  />
                  <button 
                    onClick={() => fetchDb(true, cfUrl)}
                    disabled={isSyncing}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl px-4 py-2 text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    {isSyncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : "تلاش مجدد"}
                  </button>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <button 
                  onClick={() => toggleCfMode(false)}
                  className="w-full bg-slate-900 hover:bg-slate-950 text-white rounded-xl py-2.5 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2 shadow-sm"
                >
                  <LayoutDashboard className="w-4 h-4 shrink-0" />
                  سوئیچ به شبیه‌ساز محلی (آفلاین بدون سرور)
                </button>
                <p className="text-[10px] text-slate-400 font-light mt-2 text-center">
                  با فعال کردن حالت محلی، کل سامانه با داده‌های شبیه‌سازی‌شده به صورت ۱۰۰٪ آماده به کار و پر سرعت لود می‌شود.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center">
            <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin" />
            <p className="mt-4 text-xs font-semibold">در حال بارگذاری ایمن پایگاه داده حسابداری سازه...</p>
            <p className="text-[10px] text-slate-400 mt-2 font-light">پایگاه داده: {cfEnabled ? "Cloudflare D1 ابری زنده" : "SQLite شبیه‌ساز محلی"}</p>
          </div>
        )}
      </div>
    );
  }

  // --- Authentication Protection ---
  if (!isLoggedIn) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col justify-center items-center p-4 font-sans text-slate-100" dir="rtl">
        {/* Glowing Ambient Orbs */}
        <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-indigo-500 rounded-full blur-[100px] opacity-15"></div>
        <div className="absolute bottom-1/4 right-1/4 w-72 h-72 bg-sky-500 rounded-full blur-[100px] opacity-15"></div>

        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="w-full max-w-md bg-slate-800/80 backdrop-blur-md border border-slate-700 p-8 rounded-3xl shadow-2xl relative z-10"
        >
          {/* Logo Brand */}
          <div className="flex flex-col items-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-sky-500 rounded-2xl flex items-center justify-center text-white shadow-lg font-bold text-2xl mb-3">
              س
            </div>
            <h1 className="text-xl font-extrabold text-white tracking-tight">سامانه حسابداری سازه</h1>
            <p className="text-xs text-slate-400 font-light mt-1.5">سیستم مدیریت و پیش‌فروش پروژه‌های ساختمانی</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 mr-1">نام کاربری</label>
              <input 
                type="text" 
                value={loginUsername}
                onChange={(e) => setLoginUsername(e.target.value)}
                placeholder="مثال: admin"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-center ltr font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5 mr-1">کلمه عبور</label>
              <input 
                type="password" 
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-900/50 border border-slate-700 rounded-2xl px-4 py-3.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-center ltr font-mono"
              />
            </div>

            {loginError && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs px-3 py-2.5 rounded-xl text-center font-medium">
                {loginError}
              </div>
            )}

            <button
              type="submit"
              className="w-full bg-gradient-to-r from-indigo-600 to-sky-600 hover:from-indigo-500 hover:to-sky-500 text-white rounded-2xl py-4 font-bold text-sm shadow-lg hover:shadow-indigo-500/15 transition-all cursor-pointer"
            >
              ورود به حساب کاربری
            </button>
          </form>

          {/* Fallback Information Box */}
          <div className="mt-6 pt-5 border-t border-slate-700/60 text-center">
            <p className="text-[10px] text-slate-400 leading-relaxed font-light">
              کد پیش‌فرض ورود به مدیریت ارشد:
              <br />
              <span className="font-mono text-indigo-400 font-bold text-xs select-all">admin</span> / <span className="font-mono text-indigo-400 font-bold text-xs select-all">Miladlar224</span>
            </p>
          </div>
        </motion.div>
      </div>
    );
  }

  // Filter Data by active company to implement multi-company ("قابلیت چند شرکتی")
  const activeCompany = db.companies.find(c => c.id === activeCompanyId) || db.companies[0];
  const hasMultipleCompanies = db.companies && db.companies.length > 1 && !!activeCompany;
  const allProjects = hasMultipleCompanies
    ? db.projects.filter(p => !p.companyId || p.companyId === activeCompany.id)
    : db.projects;
  const filteredProjects = allProjects.filter(p => !p.isDeleted);
  const filteredTransactions = hasMultipleCompanies
    ? db.transactions.filter(t => !t.companyId || t.companyId === activeCompany.id)
    : db.transactions;
  const filteredChecks = hasMultipleCompanies
    ? db.checks.filter(c => !c.companyId || c.companyId === activeCompany.id)
    : db.checks;
  const activeUser = db.users.find(u => u.id === activeUserId) || db.users[0];

  const hasPermission = (permissionId: string) => {
    if (!activeUser) return true;
    if (activeUser.id === "u1" || activeUser.role === "manager" || activeUser.username?.toLowerCase() === "admin") {
      return true;
    }
    return activeUser.permissions?.includes(permissionId) || false;
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans antialiased text-slate-800" dir="rtl">
      
      {/* First Install Cloud Sync Notification Banner */}
      {firstInstallNotice && (
        <div className="bg-emerald-50 border-b border-emerald-200 px-6 py-3 flex justify-between items-center gap-4 relative z-50 animate-fade-in" dir="rtl">
          <div className="flex items-center gap-2 text-xs font-extrabold text-emerald-800">
            <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{firstInstallNotice}</span>
          </div>
          <button
            onClick={() => setFirstInstallNotice(null)}
            className="text-emerald-700 hover:text-emerald-950 text-xs font-bold cursor-pointer"
          >
            بستن
          </button>
        </div>
      )}

      {/* Browser Backup Restore Banner */}
      {showRestoreBackupBanner && backupDbData && (
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-4 flex flex-col md:flex-row justify-between items-center gap-4 relative z-50 shadow-xs animate-fade-in" dir="rtl">
          <div className="flex items-start gap-3">
            <span className="text-xl shrink-0 mt-0.5">⚠️</span>
            <div>
              <h4 className="text-xs font-extrabold text-amber-900">اطلاعات کپی پشتیبان مرورگر شما کامل‌تر است</h4>
              <p className="text-[11px] text-amber-700 font-medium mt-1 leading-relaxed">
                کپی پشتیبان ذخیره شده در مرورگر شما دارای اطلاعات بیشتری است (احتمالاً به دلیل ری‌استارت سرور یا بروزرسانی). 
                اگر مایلید کل اطلاعات ثبت‌شده قبلی خود ({backupDbData.projects?.length || 0} پروژه و {backupDbData.transactions?.length || 0} تراکنش مالی) را بازیابی و روی سرور اعمال کنید، دکمه زیر را کلیک کنید تا اطلاعات به صورت خودکار بازیابی و حفظ شوند.
              </p>
            </div>
          </div>
          <div className="flex gap-2.5 shrink-0">
            <button
              onClick={handleRestoreFromBrowserBackup}
              disabled={isSyncing}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? "animate-spin" : ""}`} />
              <span>✓ بازیابی کپی پشتیبان مرورگر</span>
            </button>
            <button
              onClick={() => setShowRestoreBackupBanner(false)}
              className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              صرف‌نظر
            </button>
          </div>
        </div>
      )}
      
      {/* Top Professional Header Bar */}
      <header className="bg-white border-b border-slate-150 h-16 sticky top-0 z-30 px-6 flex justify-between items-center shadow-xs">
        
        {/* Right Section: Brand Logo and Title */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-md font-bold text-lg tracking-wider border border-slate-700">
            س
          </div>
          <div>
            <h1 className="text-sm font-extrabold text-slate-900 tracking-tight leading-none">سامانه حسابداری سازه</h1>
            <p className="text-[10px] text-slate-400 font-light mt-1">نسخه ویژه کارفرمایان و پیمانکاران ساختمانی (اولویت آفلاین)</p>
          </div>
        </div>

        {/* Center/Left Section: Company, User Profile and DB sync */}
        <div className="flex items-center gap-3 text-xs font-medium">
          
          {/* Synchronizing / Connection Mode Indicator */}
          <div className="flex items-center gap-2">
            {isSyncing ? (
              <span className="text-[10px] text-slate-400 flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg">
                <RefreshCw className="w-3 h-3 animate-spin text-indigo-600" />
                در حال فراخوانی...
              </span>
            ) : syncSuccess ? (
              <span className="text-[10px] text-emerald-600 flex items-center gap-1 font-semibold animate-pulse bg-emerald-50 px-2 py-1 rounded-lg border border-emerald-150">
                <CheckCircle className="w-3.5 h-3.5" />
                ذخیره شد
              </span>
            ) : null}

            {/* Version Selector & Update Modal Button */}
            <button
              onClick={() => {
                fetchAvailableBackupVersions(true);
                setShowVersionUpdateModal(true);
              }}
              title="مشاهده ورژن‌های بکاپ (بر اساس تاریخ و ساعت) و به‌روزرسانی نرم‌افزار آفلاین"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-[10px] font-bold transition-all cursor-pointer shadow-2xs shrink-0"
            >
              <Clock className="w-3.5 h-3.5 text-emerald-600" />
              <span>ورژن‌های بکاپ و به‌روزرسانی</span>
            </button>

            {/* Automatic Offline-to-Online Timestamped Backup & Sync Button */}
            {!cfEnabled && (
              <button
                onClick={() => handleOfflineOnlineSync(false)}
                disabled={isSyncing}
                title="ثبت بکاپ جدید با تاریخ و ساعت فعلی در آنلاین و همگام‌سازی (اولویت با نسخه آفلاین)"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-indigo-200 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 text-[10px] font-bold transition-all cursor-pointer shadow-2xs shrink-0"
              >
                <RefreshCw className={`w-3.5 h-3.5 text-indigo-600 ${isSyncing ? "animate-spin" : ""}`} />
                <span>ثبت بکاپ در آنلاین</span>
              </button>
            )}

            {/* Live Cloudflare Connection Toggle Button */}
            <button
              onClick={() => toggleCfMode(!cfEnabled)}
              title={cfEnabled ? "تغییر به پایگاه داده اصلی آفلاین (اولویت آفلاین)" : "مشاهده مستقیم دیتابیس ابری زنده Cloudflare D1"}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[10px] font-bold transition-all cursor-pointer ${
                cfEnabled 
                  ? "bg-sky-50 border-sky-200 text-sky-700 shadow-2xs hover:bg-sky-100" 
                  : "bg-slate-900 border-slate-800 text-white hover:bg-slate-800"
              }`}
            >
              <Cloud className={`w-3.5 h-3.5 ${cfEnabled ? "text-sky-500 animate-pulse" : "text-emerald-400"}`} />
              {cfEnabled ? "حالت ابری مستقیم D1" : "حالت اصلی آفلاین (فعال)"}
            </button>
          </div>

          {/* Multi-Company Selector ("قابلیت چند شرکتی") */}
          <div className="hidden sm:flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150 shadow-2xs">
            <span className="text-[10px] text-slate-400">شرکت فعال:</span>
            {db.companies.length > 0 ? (
              <select 
                value={activeCompanyId}
                onChange={(e) => setActiveCompanyId(e.target.value)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer pr-1"
              >
                {db.companies.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            ) : (
              <span
                onClick={() => setShowCompanyModal(true)}
                className="text-[10px] text-indigo-600 font-bold cursor-pointer hover:underline px-1"
              >
                + تعریف اولین شرکت
              </span>
            )}
            <button
              onClick={() => setShowCompanyModal(true)}
              title="تعریف یا حذف شرکت‌ها"
              className="p-1 text-slate-450 hover:text-indigo-600 rounded transition-colors cursor-pointer mr-1 border-r border-slate-200 pr-1.5"
            >
              <Building className="w-3.5 h-3.5 shrink-0" />
            </button>
          </div>

          {/* Multi-User Switcher ("چند کاربره") */}
          {hasPermission("manage_users") ? (
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <select 
                value={activeUserId}
                onChange={(e) => setActiveUserId(e.target.value)}
                className="bg-transparent text-slate-800 font-semibold focus:outline-none cursor-pointer"
              >
                {(db?.users || []).map(u => (
                  <option key={u.id} value={u.id}>{u.name} ({u.roleName})</option>
                ))}
              </select>
              <button
                onClick={() => {
                  setEditingUserId(null);
                  setUserNameInput("");
                  setUserRoleInput("supervisor");
                  setUserRoleNameInput("");
                  setUserUsernameInput("");
                  setUserPasswordInput("");
                  setUserErrorText(null);
                  setSelectedPermissions([]);
                  setShowUserModal(true);
                }}
                title="تعریف و مدیریت کاربران سیستم"
                className="p-1 text-slate-450 hover:text-indigo-600 rounded transition-colors cursor-pointer mr-1 border-r border-slate-200 pr-1 flex items-center justify-center"
              >
                <Plus className="w-3 h-3 shrink-0" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-150 shadow-2xs">
              <Users className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-slate-850 font-extrabold text-xs">{activeUser?.name || "مدیر سیستم"} ({activeUser?.roleName || "مدیر ارشد"})</span>
            </div>
          )}

          {/* Save Backup & Safe Exit Button */}
          <button 
            onClick={handleSafeExitWithBackup}
            title="ذخیره بکاپ جدید در محلی و آنلاین و بستن نرم‌افزار"
            className="flex items-center gap-1 px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-[10px] font-bold transition-colors cursor-pointer shrink-0"
          >
            <Download className="w-3.5 h-3.5" />
            <span>بکاپ و خروج</span>
          </button>

          {/* Logout Button */}
          <button 
            onClick={handleLogout}
            title="خروج از حساب کاربری"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </header>

      {/* Main Scaffold Layout */}
      <div className="flex-1 flex flex-col md:flex-row h-[calc(100vh-64px)] overflow-hidden">
        
        {/* Navigation Sidebar Drawer */}
        <aside className="w-full md:w-64 bg-white border-l border-slate-150 flex flex-col justify-between py-4 shrink-0 overflow-y-auto">
          <div className="space-y-6">
            <div className="px-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2 px-2">دفتر اصلی حسابرسی</span>
              
              <nav className="space-y-1">
                {hasPermission("view_dashboard") && (
                  <button 
                    onClick={() => setActiveTab("dashboard")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "dashboard" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <LayoutDashboard className="w-4 h-4 shrink-0" />
                    میز کار (داشبورد)
                  </button>
                )}

                {hasPermission("manage_projects") && (
                  <button 
                    onClick={() => setActiveTab("projects")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "projects" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Building className="w-4 h-4 shrink-0" />
                    پروژه‌ها و واحدها
                  </button>
                )}

                {hasPermission("manage_transactions") && (
                  <button 
                    onClick={() => setActiveTab("transactions")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "transactions" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Receipt className="w-4 h-4 shrink-0" />
                    دریافت و پرداخت
                  </button>
                )}

                {hasPermission("manage_warehouse") && (
                  <button 
                    onClick={() => setActiveTab("warehouse")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "warehouse" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Package className="w-4 h-4 shrink-0" />
                    انبارداری و کالا
                  </button>
                )}

                {hasPermission("manage_checks") && (
                  <button 
                    onClick={() => setActiveTab("checks")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "checks" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Clock className="w-4 h-4 shrink-0" />
                    چک‌های صیادی
                  </button>
                )}

                {hasPermission("manage_contracts") && (
                  <button 
                    onClick={() => setActiveTab("contracts_imprests")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "contracts_imprests" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Users className="w-4 h-4 shrink-0" />
                    قراردادها و تنخواه
                  </button>
                )}

                {hasPermission("manage_payroll") && (
                  <button 
                    onClick={() => setActiveTab("payrolls_timesheets")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "payrolls_timesheets" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Briefcase className="w-4 h-4 shrink-0" />
                    حقوق و دستمزد
                  </button>
                )}

                {hasPermission("view_reports") && (
                  <button 
                    onClick={() => setActiveTab("accounting_reports")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "accounting_reports" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <BookOpen className="w-4 h-4 text-emerald-500 shrink-0" />
                    گزارش‌ها و دفاتر مالی
                  </button>
                )}

                {hasPermission("manage_archive") && (
                  <button 
                    onClick={() => setActiveTab("document_archive")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "document_archive" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <FolderOpen className="w-4 h-4 text-indigo-500 shrink-0" />
                    بایگانی الکترونیک اسناد
                  </button>
                )}
              </nav>
            </div>

            <div className="px-4 border-t border-slate-100 pt-4">
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-2 px-2">ابزارهای پیشرفته</span>
              
              <nav className="space-y-1">
                {hasPermission("view_tax") && (
                  <button 
                    onClick={() => setActiveTab("tax")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "tax" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-amber-500 shrink-0" />
                    مشاور مالیاتی هوشمند
                  </button>
                )}

                {hasPermission("manage_dev_kit") && (
                  <button 
                    onClick={() => setActiveTab("dev_kit")}
                    className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                      activeTab === "dev_kit" ? "bg-slate-900 text-white shadow-md font-bold" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <Cloud className="w-4 h-4 text-sky-500 shrink-0" />
                    کیت کلودفلر و ویندوز
                  </button>
                )}
              </nav>
            </div>
          </div>

          {/* User profile details in sidebar footer */}
          <div className="px-4 border-t border-slate-100 pt-4 space-y-3">
            <div className="p-3 bg-slate-50 rounded-xl flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center font-bold text-slate-700 text-xs shadow-inner">
                {activeUser?.name.slice(0, 2)}
              </div>
              <div>
                <h4 className="font-bold text-xs text-slate-800">{activeUser?.name}</h4>
                <p className="text-[10px] text-slate-400 font-light mt-0.5">{activeUser?.roleName}</p>
              </div>
            </div>
            
            <div className="text-[10px] text-slate-400 text-center font-light leading-relaxed">
              <div className="font-extrabold text-indigo-600 mb-1">ساخته شده توسط مهندس میلاد فرخی</div>
              پایگاه داده: {cfEnabled ? "Cloudflare D1 ابری زنده" : "SQLite شبیه‌ساز محلی"}
              <br />
              هوش مصنوعی فعال: Gemini 3.5 Flash
            </div>
          </div>
        </aside>

        {/* Dynamic Content Frame */}
        <main className="flex-1 bg-slate-50/50 p-6 overflow-y-auto">
          <AnimatePresence mode="wait">
            <motion.div 
              key={activeTab}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.2 }}
              className="h-full"
            >
              {activeTab === "dashboard" && (
                <Dashboard 
                  projects={filteredProjects}
                  transactions={filteredTransactions}
                  accounts={db.accounts}
                  checks={filteredChecks}
                  onNavigate={setActiveTab}
                />
              )}
              {activeTab === "projects" && (
                <ProjectsManager 
                  projects={allProjects}
                  units={db.units}
                  transactions={filteredTransactions}
                  contacts={db.contacts}
                  preSales={db.preSales}
                  activeCompanyId={activeCompany?.id || activeCompanyId}
                  onAddProject={handleAddProject}
                  onEditProject={handleAddProject}
                  onUpdateUnit={handleUpdateUnit}
                  onAddUnitExpense={handleAddUnitExpense}
                  onDeleteUnit={handleDeleteUnit}
                  onRestoreUnit={handleRestoreUnit}
                  onDeleteProject={handleDeleteProject}
                  onRestoreProject={handleRestoreProject}
                  onBatchGenerateUnits={handleBatchGenerateUnits}
                />
              )}
              {activeTab === "transactions" && (
                <TransactionsManager 
                  transactions={filteredTransactions}
                  accounts={db.accounts}
                  projects={filteredProjects}
                  contacts={db.contacts}
                  activeUser={activeUser}
                  onAddTransaction={handleAddTransaction}
                  onAddAccount={handleAddAccount}
                  onAddContact={handleAddContact}
                  onAddProject={handleAddProject}
                  onPayTransaction={handlePayTransaction}
                  onDeleteTransaction={handleDeleteTransaction}
                  onDeleteAccount={handleDeleteAccount}
                  onApproveTransaction={handleApproveTransaction}
                />
              )}
              {activeTab === "warehouse" && (
                <WarehouseManager 
                  materials={db.materials}
                  materialTransactions={db.materialTransactions}
                  projects={filteredProjects}
                  onAddMaterial={handleAddMaterial}
                  onAddWarehouseTx={handleAddWarehouseTx}
                  onDeleteMaterial={handleDeleteMaterial}
                />
              )}
              {activeTab === "checks" && (
                <CheckManager 
                  checks={filteredChecks}
                  accounts={db.accounts}
                  projects={filteredProjects}
                  onAddCheck={handleAddCheck}
                  onClearCheck={handleClearCheck}
                  onDeleteCheck={handleDeleteCheck}
                />
              )}
              {activeTab === "contracts_imprests" && (
                <ContractsAndImprests 
                  db={{
                    ...db,
                    units: db.units.filter(u => !u.isDeleted)
                  }}
                  activeCompanyId={activeCompanyId}
                  getApiUrl={getApiUrl}
                  onRefresh={fetchDb}
                  projects={filteredProjects}
                  onDeletePreSale={handleDeletePreSale}
                  onDeleteImprest={handleDeleteImprest}
                  onDeleteImprestExpense={handleDeleteImprestExpense}
                />
              )}
              {activeTab === "payrolls_timesheets" && (
                <PayrollTimesheets 
                  db={db}
                  activeCompanyId={activeCompanyId}
                  getApiUrl={getApiUrl}
                  onRefresh={fetchDb}
                  projects={filteredProjects}
                />
              )}
              {activeTab === "accounting_reports" && (
                <AccountingReports 
                  db={{
                    ...db,
                    projects: filteredProjects,
                    transactions: filteredTransactions.filter(t => !t.isDeleted),
                    checks: filteredChecks,
                    units: db.units.filter(u => !u.isDeleted && filteredProjects.some(p => p.id === u.projectId))
                  }}
                  projects={filteredProjects}
                  onAddContact={handleAddContact}
                  onAddProject={handleAddProject}
                />
              )}
              {activeTab === "document_archive" && (
                <DocumentArchive 
                  db={db}
                  getApiUrl={getApiUrl}
                  onRefresh={fetchDb}
                  projects={filteredProjects}
                />
              )}
              {activeTab === "tax" && <TaxAdvisor />}
              {activeTab === "dev_kit" && (
                <DeveloperKit 
                  cfEnabled={cfEnabled}
                  cfUrl={cfUrl}
                  onToggleCf={toggleCfMode}
                  onUpdateUrl={updateCfUrl}
                  onRefresh={fetchDb}
                />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Professional Multi-Company Management Dialog */}
      {showCompanyModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-150 shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Building className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">مدیریت شرکت‌های عمرانی و پیمانکاری</h3>
              </div>
              <button 
                onClick={() => setShowCompanyModal(false)}
                className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[60vh]">
              
              {/* Error Alert Banner */}
              {companyErrorText && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex justify-between items-center animate-fade-in">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                    {companyErrorText}
                  </span>
                  <button 
                    onClick={() => setCompanyErrorText(null)}
                    className="text-rose-450 hover:text-rose-750 font-extrabold text-sm"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Part 1: Add New Company */}
              <div className="space-y-2.5">
                <label className="text-[11px] text-slate-400 font-bold block px-1">تعریف شرکت عمرانی جدید:</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newCompanyName}
                    onChange={(e) => setNewCompanyName(e.target.value)}
                    placeholder="نام کامل شرکت پیمانکاری/عمرانی جدید..."
                    className="flex-1 text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
                  />
                  <button 
                    onClick={() => handleAddCompany(newCompanyName)}
                    disabled={!newCompanyName.trim() || isSyncing}
                    className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    ثبت شرکت
                  </button>
                </div>
              </div>

              {/* Part 2: List of Existing Companies */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block px-1">لیست شرکت‌های ثبت شده فعلی:</span>
                
                <div className="space-y-2">
                  {db.companies.map((company) => {
                    const companyProjectsCount = db.projects.filter(p => p.companyId === company.id && !p.isDeleted).length;
                    const isConfirmingDelete = companyDeleteConfirmId === company.id;
                    
                    return (
                      <div 
                        key={company.id}
                        className={`flex flex-col p-3.5 rounded-2xl border transition-all ${
                          activeCompanyId === company.id 
                            ? "bg-indigo-50/50 border-indigo-150 shadow-2xs" 
                            : "bg-white border-slate-150 hover:bg-slate-50"
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className="font-extrabold text-xs text-slate-800">{company.name}</span>
                              {activeCompanyId === company.id && (
                                <span className="bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-full text-[8px]">فعال</span>
                              )}
                            </div>
                            <div className="flex items-center gap-3 text-[10px] text-slate-400 font-medium">
                              <span>کد شرکت: <strong className="font-mono text-slate-600">{company.code}</strong></span>
                              <span>تعداد پروژه‌ها: <strong className="text-indigo-600 font-bold">{companyProjectsCount}</strong></span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1">
                            {activeCompanyId !== company.id && !isConfirmingDelete && (
                              <button
                                onClick={() => {
                                  setActiveCompanyId(company.id);
                                  setShowCompanyModal(false);
                                }}
                                className="px-2.5 py-1.5 hover:bg-indigo-600 hover:text-white border border-indigo-150 text-indigo-700 text-[10px] font-bold rounded-xl transition-all cursor-pointer"
                              >
                                انتخاب شرکت
                              </button>
                            )}
                            {!isConfirmingDelete && (
                              <button
                                onClick={() => handleDeleteCompany(company.id)}
                                disabled={db.companies.length <= 1 || isSyncing}
                                className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 disabled:opacity-30 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-100"
                                title="حذف شرکت"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Inline Delete Confirmation Banner */}
                        {isConfirmingDelete && (
                          <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl space-y-2.5 animate-fade-in w-full">
                            <p className="text-[10px] text-rose-700 font-extrabold leading-relaxed">
                              آیا مطمئن هستید؟ با حذف این شرکت تمام پروژه‌ها و تراکنش‌های مربوطه دیگر در دسترس نخواهند بود.
                            </p>
                            <div className="flex gap-2 justify-end">
                              <button
                                onClick={() => setCompanyDeleteConfirmId(null)}
                                className="px-3 py-1.5 bg-slate-200 hover:bg-slate-250 text-slate-700 rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                انصراف
                              </button>
                              <button
                                onClick={() => handleDeleteCompany(company.id, true)}
                                className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-bold transition-colors cursor-pointer"
                              >
                                بله، حذف شود
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowCompanyModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Professional Multi-User Management Dialog */}
      {showUserModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-xl border border-slate-150 shadow-2xl overflow-hidden flex flex-col">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">تعریف و مدیریت کاربران سیستم</h3>
              </div>
              <button 
                onClick={() => setShowUserModal(false)}
                className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-6 overflow-y-auto max-h-[75vh]">
              
              {/* Error Alert Banner */}
              {userErrorText && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex justify-between items-center animate-fade-in">
                  <span className="flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-rose-500 shrink-0" />
                    {userErrorText}
                  </span>
                  <button 
                    onClick={() => setUserErrorText(null)}
                    className="text-rose-450 hover:text-rose-750 font-extrabold text-sm"
                  >
                    ×
                  </button>
                </div>
              )}

              {/* Part 1: Add or Edit User Form */}
              <form onSubmit={handleSubmitUserForm} className="space-y-4 bg-slate-50/50 p-4 rounded-2xl border border-slate-150">
                <span className="text-[11px] text-slate-400 font-bold block px-1">
                  {editingUserId ? "ویرایش اطلاعات کاربر منتخب:" : "تعریف کاربر جدید سیستم:"}
                </span>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Name Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold mr-1">نام و نام خانوادگی:</label>
                    <input 
                      type="text" 
                      value={userNameInput}
                      onChange={(e) => setUserNameInput(e.target.value)}
                      placeholder="مثال: مهندس میلاد فرخی"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-indigo-600 transition-all font-semibold"
                    />
                  </div>

                  {/* System Role Selection */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold mr-1">نقش سیستمی:</label>
                    <select
                      value={userRoleInput}
                      onChange={(e) => handleRoleChange(e.target.value as any)}
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-indigo-600 transition-all font-semibold cursor-pointer"
                    >
                      <option value="manager">مدیر ارشد پروژه (Manager)</option>
                      <option value="accountant">حسابدار مالی (Accountant)</option>
                      <option value="supervisor">ناظر پروژه (Supervisor)</option>
                      <option value="investor">سرمایه‌گذار شریک (Investor)</option>
                    </select>
                  </div>

                  {/* Role Title Customization */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold mr-1">عنوان نمایش نقش (سمت):</label>
                    <input 
                      type="text" 
                      value={userRoleNameInput}
                      onChange={(e) => setUserRoleNameInput(e.target.value)}
                      placeholder="مثال: مدیر ارشد پروژه"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-indigo-600 transition-all font-semibold"
                    />
                  </div>

                  {/* Username */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold mr-1">نام کاربری ورود:</label>
                    <input 
                      type="text" 
                      value={userUsernameInput}
                      onChange={(e) => setUserUsernameInput(e.target.value)}
                      placeholder="مثال: milad"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-indigo-600 transition-all font-mono text-center ltr font-bold"
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold mr-1">کلمه عبور ورود:</label>
                    <input 
                      type="text" 
                      value={userPasswordInput}
                      onChange={(e) => setUserPasswordInput(e.target.value)}
                      placeholder="مثال: 123456"
                      className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2 bg-white focus:outline-none focus:border-indigo-600 transition-all font-mono text-center ltr font-bold"
                    />
                  </div>
                </div>

                {/* Granular Permissions Checkboxes */}
                <div className="space-y-2 pt-3 border-t border-slate-150">
                  <span className="text-[10px] text-slate-500 font-bold block mr-1">سطوح دسترسی و مجوزها (با جزئیات):</span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 bg-slate-50/50 p-3 rounded-2xl border border-slate-200/60 max-h-48 overflow-y-auto">
                    {ALL_PERMISSIONS.map(p => {
                      const isChecked = selectedPermissions.includes(p.id);
                      return (
                        <label key={p.id} className="flex items-center gap-2.5 p-1.5 hover:bg-slate-100/60 rounded-lg cursor-pointer transition-colors text-[10px] font-bold text-slate-700">
                          <input 
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedPermissions([...selectedPermissions, p.id]);
                              } else {
                                setSelectedPermissions(selectedPermissions.filter(id => id !== p.id));
                              }
                            }}
                            className="w-3.5 h-3.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                          />
                          <span>{p.name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="flex gap-2 pt-2 justify-end">
                  {editingUserId && (
                    <button 
                      type="button"
                      onClick={() => {
                        setEditingUserId(null);
                        setUserNameInput("");
                        setUserRoleInput("supervisor");
                        setUserRoleNameInput("");
                        setUserUsernameInput("");
                        setUserPasswordInput("");
                        setSelectedPermissions([]);
                      }}
                      className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                    >
                      انصراف
                    </button>
                  )}
                  <button 
                    type="submit"
                    disabled={isSyncing}
                    className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  >
                    {editingUserId ? "ثبت تغییرات کاربر" : "ثبت کاربر جدید"}
                  </button>
                </div>
              </form>

              {/* Part 2: List of Users */}
              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="text-[11px] text-slate-400 font-bold block px-1">لیست کاربران فعال سیستم:</span>
                
                <div className="space-y-2 max-h-[30vh] overflow-y-auto pr-1">
                  {(db?.users || []).map((u) => (
                    <div 
                      key={u.id}
                      className={`flex flex-col md:flex-row md:items-center justify-between p-3 rounded-2xl border transition-all ${
                        activeUserId === u.id 
                          ? "bg-indigo-50/50 border-indigo-150" 
                          : "bg-white border-slate-150 hover:bg-slate-50"
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-extrabold text-xs text-slate-800">{u.name}</span>
                          <span className="bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full text-[9px] border border-slate-150">{u.roleName}</span>
                          {activeUserId === u.id && (
                            <span className="bg-indigo-600 text-white font-extrabold px-2 py-0.5 rounded-full text-[8px]">کاربر فعال فعلی</span>
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-[10px] text-slate-400 font-medium">
                          <span>نام کاربری: <strong className="font-mono text-slate-600 font-semibold">{u.username || "ندارد"}</strong></span>
                          <span>کلمه عبور: <strong className="font-mono text-slate-600 font-semibold">{u.password || "ندارد"}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 mt-2 md:mt-0 justify-end">
                        <button
                          onClick={() => handleEditUserClick(u)}
                          className="p-1.5 hover:bg-indigo-50 text-indigo-600 hover:text-indigo-800 rounded-xl transition-all cursor-pointer border border-transparent hover:border-indigo-100"
                          title="ویرایش اطلاعات کاربر"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`آیا از حذف کاربر «${u.name}» مطمئن هستید؟`)) {
                              handleDeleteUser(u.id);
                            }
                          }}
                          disabled={(db?.users || []).length <= 1 || isSyncing}
                          className="p-1.5 hover:bg-rose-50 text-rose-500 hover:text-rose-700 disabled:opacity-30 rounded-xl transition-all cursor-pointer border border-transparent hover:border-rose-100"
                          title="حذف کاربر"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
              <button 
                onClick={() => setShowUserModal(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-250 text-slate-700 text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                بستن پنجره
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Startup & On-Demand Versioned Backup Selector Modal */}
      {showVersionUpdateModal && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl w-full max-w-2xl border border-slate-150 shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
            
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-600 flex items-center justify-center text-white shadow-md">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-sm">به‌روزرسانی نرم‌افزار آفلاین و انتخاب ورژن پشتیبان</h3>
                  <p className="text-[11px] text-slate-300 font-light mt-0.5">
                    آیا مایلید نرم‌افزار آفلاین را به یکی از ورژن‌های پشتیبان (بر اساس تاریخ و ساعت) به‌روزرسانی کنید؟
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowVersionUpdateModal(false)}
                className="p-1.5 hover:bg-slate-800 rounded-xl transition-colors cursor-pointer text-slate-300 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-4 overflow-y-auto flex-1">
              
              {/* Info & Action Bar */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 bg-indigo-50/70 border border-indigo-100 rounded-2xl">
                <div className="space-y-1">
                  <div className="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                    <CheckCircle className="w-4 h-4 text-indigo-600 shrink-0" />
                    <span>اولویت اصلی با نسخه آفلاین شماست</span>
                  </div>
                  <p className="text-[11px] text-indigo-700 leading-relaxed">
                    با کلیک روی هر یک از ورژن‌های زیر، اطلاعات نسخه آفلاین به آن ورژن (طبق تاریخ و ساعت ثبت‌شده) به‌روزرسانی می‌شود.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleOfflineOnlineSync(false)}
                    disabled={isSyncing}
                    className="px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shadow-xs"
                  >
                    <Cloud className="w-3.5 h-3.5" />
                    <span>+ ثبت بکاپ جدید در آنلاین</span>
                  </button>
                  <button
                    onClick={() => fetchAvailableBackupVersions(false)}
                    disabled={isLoadingVersions}
                    title="بروزرسانی لیست ورژن‌ها"
                    className="p-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl transition-all cursor-pointer"
                  >
                    <RefreshCw className={`w-4 h-4 ${isLoadingVersions ? "animate-spin text-indigo-600" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Versions List */}
              {isLoadingVersions ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <RefreshCw className="w-7 h-7 animate-spin text-indigo-600" />
                  <span className="text-xs font-bold text-slate-600">در حال دریافت لیست ورژن‌های پشتیبان آنلاین و محلی...</span>
                </div>
              ) : backupVersions.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-200 p-6 space-y-2">
                  <Cloud className="w-8 h-8 text-slate-400 mx-auto" />
                  <h4 className="text-xs font-extrabold text-slate-700">هنوز هیچ ورژن پشتیبانی ثبت نشده است</h4>
                  <p className="text-[11px] text-slate-500 max-w-md mx-auto leading-relaxed">
                    نرم‌افزار به صورت خام و بدون اطلاعات پیش‌فرض آماده کار است. با هر بار به‌روزرسانی یا بستن برنامه، بکاپ جدید با تاریخ و ساعت دقیق در این لیست قرار می‌گیرد.
                  </p>
                </div>
              ) : (
                <div className="space-y-2.5">
                  <span className="text-[11px] text-slate-400 font-bold block px-1">
                    لیست ورژن‌های موجود ({backupVersions.length} نسخه — برای به‌روزرسانی روی ورژن مورد نظر کلیک کنید):
                  </span>
                  {backupVersions.map((ver, idx) => {
                    const isCloud = ver.location === "cloud";
                    const isRestoringThis = restoringVersionId === ver.id;
                    const stats = ver.stats || {};
                    return (
                      <div
                        key={ver.id + "_" + idx}
                        onClick={() => !isSyncing && handleRestoreToVersion(ver)}
                        className="group p-4 rounded-2xl border border-slate-200 hover:border-indigo-500 bg-white hover:bg-indigo-50/30 transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs"
                      >
                        <div className="space-y-1.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="bg-slate-900 text-white font-extrabold px-2.5 py-0.5 rounded-lg text-[10px]">
                              ورژن {backupVersions.length - idx}
                            </span>
                            <span className="font-extrabold text-xs text-slate-900 group-hover:text-indigo-700 transition-colors">
                              {ver.versionName || `نسخه ${ver.shamsiDate} - ساعت ${ver.shamsiTime}`}
                            </span>
                            {idx === 0 && (
                              <span className="bg-emerald-100 text-emerald-800 border border-emerald-200 font-extrabold px-2 py-0.5 rounded-full text-[9px]">
                                جدیدترین ورژن
                              </span>
                            )}
                            <span
                              className={`px-2 py-0.5 rounded-full text-[9px] font-bold border ${
                                isCloud
                                  ? "bg-sky-50 text-sky-700 border-sky-200"
                                  : "bg-amber-50 text-amber-800 border-amber-200"
                              }`}
                            >
                              {isCloud ? "☁️ بکاپ آنلاین ابری" : "💻 بکاپ محلی ویندوز"}
                            </span>
                          </div>

                          <div className="text-[10px] text-slate-500 font-medium flex flex-wrap items-center gap-x-4 gap-y-1">
                            <span>تاریخ: <strong className="text-slate-700">{ver.shamsiDate || "-"}</strong></span>
                            <span>ساعت: <strong className="text-slate-700 font-mono">{ver.shamsiTime || "-"}</strong></span>
                            <span>نوع ثبت: <strong className="text-slate-700">{ver.source || "همگام‌سازی"}</strong></span>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-0.5 text-[10px] text-slate-600">
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md">پروژه‌ها: <strong>{stats.projects || 0}</strong></span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md">تراکنش‌ها: <strong>{stats.transactions || 0}</strong></span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md">حساب‌ها: <strong>{stats.accounts || 0}</strong></span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md">واحدها: <strong>{stats.units || 0}</strong></span>
                            <span className="bg-slate-100 px-2 py-0.5 rounded-md">اشخاص: <strong>{stats.contacts || 0}</strong></span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (!isSyncing) handleRestoreToVersion(ver);
                          }}
                          disabled={isSyncing}
                          className="px-4 py-2.5 bg-indigo-600 group-hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 shadow-xs"
                        >
                          {isRestoringThis ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              <span>در حال آپدیت...</span>
                            </>
                          ) : (
                            <>
                              <Download className="w-3.5 h-3.5" />
                              <span>به‌روزرسانی به این ورژن</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-4 border-t border-slate-100 bg-slate-50 flex flex-col sm:flex-row justify-between items-center gap-3">
              <span className="text-[10px] text-slate-500 font-medium">
                در صورت عدم انتخاب، نرم‌افزار با اطلاعات فعلی نسخه آفلاین شما ادامه می‌دهد.
              </span>
              <button 
                onClick={() => setShowVersionUpdateModal(false)}
                className="w-full sm:w-auto px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold rounded-xl transition-colors cursor-pointer"
              >
                ادامه با اطلاعات فعلی نسخه آفلاین (بدون تغییر)
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Pre-Close Automatic Local + Cloud Backup Overlay Modal */}
      {isClosingWithBackup && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 animate-fade-in" dir="rtl">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 text-center space-y-4 shadow-2xl border border-slate-150">
            <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mx-auto border border-indigo-100">
              <RefreshCw className="w-7 h-7 animate-spin" />
            </div>
            <h3 className="text-sm font-extrabold text-slate-900">پشتیبان‌گیری خودکار قبل از بستن نرم‌افزار</h3>
            <p className="text-xs text-slate-600 leading-relaxed font-medium">
              {closeBackupStatusText}
            </p>
            <p className="text-[10px] text-slate-400">
              لطفاً چند لحظه صبر کنید تا بکاپ جدید با تاریخ و ساعت فعلی روی دیتای محلی و سرور آنلاین ثبت شود...
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
