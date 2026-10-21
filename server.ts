import express from "express";
import path from "path";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3000;

// Set up larger JSON limit for electronic archive attachments (base64)
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

const BASE_DATA_DIR = process.env.USER_DATA_DIR || process.cwd();
const SETTINGS_FILE = path.join(BASE_DATA_DIR, "settings.json");

interface AppSettings {
  dbPath: string;
  uploadsPath: string;
  cfApiToken: string;
  cfAccountId: string;
  cfWorkerName: string;
  cfWorkerUrl: string;
  syncToken?: string;
  autoBackupSyncIntervalHours?: number;
  lastAutoBackupTime?: string;
  lastAutoSyncTime?: string;
  firstInstallSynced?: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  dbPath: process.env.OFFLINE_DB_PATH || path.join(BASE_DATA_DIR, "db.json"),
  uploadsPath: path.join(BASE_DATA_DIR, "uploads"),
  cfApiToken: "",
  cfAccountId: "",
  cfWorkerName: "hesabdarpeymankar",
  cfWorkerUrl: "https://hesabdarpeymankar.vikoni4694.workers.dev",
  autoBackupSyncIntervalHours: 0,
  lastAutoBackupTime: "",
  lastAutoSyncTime: "",
  firstInstallSynced: false
};

function readSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return {
        ...DEFAULT_SETTINGS,
        ...parsed,
        cfWorkerUrl: parsed.cfWorkerUrl || DEFAULT_SETTINGS.cfWorkerUrl
      };
    }
  } catch (e) {
    console.error("Error reading settings", e);
  }
  return DEFAULT_SETTINGS;
}

function writeSettings(settings: AppSettings) {
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing settings", e);
  }
}

function getDbPath(): string {
  if (process.env.OFFLINE_DB_PATH) return process.env.OFFLINE_DB_PATH;
  const settings = readSettings();
  return settings.dbPath || path.join(BASE_DATA_DIR, "db.json");
}

function getBackupsDir(): string {
  const dir = path.join(BASE_DATA_DIR, "backups");
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// Helper to save base64 to file and return filename
function saveBase64File(base64Data: string, filename: string): string {
  try {
    const settings = readSettings();
    const uploadsDir = settings.uploadsPath || path.join(process.cwd(), "uploads");
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
    
    // Remove header from base64 if present
    const base64Content = base64Data.replace(/^data:image\/\w+;base64,/, "");
    const buffer = Buffer.from(base64Content, "base64");
    
    const ext = path.extname(filename) || ".png";
    const nameWithoutExt = path.basename(filename, ext);
    const safeFilename = `${nameWithoutExt}_${Date.now()}${ext}`;
    const filePath = path.join(uploadsDir, safeFilename);
    
    fs.writeFileSync(filePath, buffer);
    return safeFilename;
  } catch (e) {
    console.error("Error saving base64 file:", e);
    return filename;
  }
}

// Structure interfaces for Farsi Construction Accounting
interface Company {
  id: string;
  name: string;
  code: string;
}

interface Project {
  id: string;
  companyId: string;
  name: string;
  address: string;
  totalArea: number; // متر مربع زیربنا
  budget: number; // بودجه کل به ریال/تومان
  stages: string[]; // مراحل ساخت مثل پی‌ریزی، اسکلت، سفت‌کاری، نازک‌کاری، تاسیسات، نما و غیره
  currentStage: string;
  status: "active" | "completed" | "paused";
  supervisorName?: string;
  numberOfUnits?: number;
  defaultUnitArea?: number;
  defaultUnitPrice?: number;
  isDeleted?: boolean;
  deletedAt?: string;
}

interface User {
  id: string;
  name: string;
  role: "manager" | "accountant" | "investor" | "supervisor";
  roleName: string;
}

interface Account {
  id: string;
  name: string;
  type: "bank" | "cash" | "petty_cash" | "investor" | "contractor" | "person";
  typeName: string;
  accountNumber?: string;
  bankName?: string;
  balance: number;
  code?: string;
  level?: number;
  parentCode?: string;
  nature?: "debtor" | "creditor";
  projectId?: string;
}

interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  averagePrice: number;
  code?: string; // کد کالا
  subCategory?: string; // زیرگروه کالا
  secondaryUnit?: string; // واحد فرعی
  conversionFactor?: number; // ضریب تبدیل واحد
  consumptionType?: "concrete" | "steel" | "common"; // نوع مصرف (بتنی / فلزی / مشترک)
  minStock?: number; // حداقل موجودی
  purchasePrice?: number; // نرخ خرید
  projectId?: string; // پروژه مصرف‌کننده
}

interface MaterialTransaction {
  id: string;
  projectId: string;
  materialId: string;
  type: "in" | "out"; // ورود به انبار مرکزی، خروج به پروژه
  quantity: number;
  unitPrice: number;
  date: string;
  personName: string;
  description: string;
}

interface TransactionPayment {
  id: string;
  rowNumber?: number | string;
  amount: number;
  date: string;
  accountId?: string;
  referenceNumber?: string;
  invoiceNumber?: string;
  invoiceDescription?: string;
  settlementMethod?: string;
  paymentStatus?: string;
  destinationAccount?: string;
  receiptFileName?: string;
  receiptFileData?: string;
  description?: string;
}

interface Transaction {
  id: string;
  companyId: string;
  projectId: string;
  type: "income" | "expense";
  category: string;
  subCategory?: string;
  amount: number;
  accountId: string;
  personName: string;
  date: string;
  description: string;
  invoiceNumber?: string;
  isNonCash: boolean;
  barterDetails?: {
    propertyType: string;
    description: string;
    agreedValue: number;
  };
  attachmentName?: string;
  attachmentData?: string;
  receiptRefNumber?: string;
  receiptFileName?: string;
  receiptFileData?: string;
  paymentStatus?: "paid" | "partially_paid" | "unpaid";
  payments?: TransactionPayment[];
  preSaleId?: string;
  contactId?: string;
  isDeleted?: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedAmount?: number;
  approvedBy?: string;
  approvedDate?: string;
}

interface CheckItem {
  id: string;
  companyId: string;
  projectId: string;
  checkNumber: string;
  bankName: string;
  dueDate: string;
  amount: number;
  type: "incoming" | "outgoing";
  status: "pending" | "passed" | "bounced" | "cancelled";
  personName: string;
  description: string;
}

interface UnitItem {
  id: string;
  projectId: string;
  unitNumber: string;
  blockName?: string;
  floor: string;
  saleAreaType?: "useful" | "with_commons";
  usefulArea?: number;
  storageArea?: number;
  parkingArea?: number;
  commonArea?: number;
  area: number;
  pricePerMeter: number;
  totalPrice: number;
  status: "available" | "pre_sold" | "sold" | "bartered";
  buyerName?: string;
  contactId?: string;
  contractId?: string;
  downPayment?: number;
  barterProperty?: string;
  specificExpenses: {
    id: string;
    title: string;
    amount: number;
    date: string;
  }[];
  isDeleted?: boolean;
  deletedAt?: string;
}

interface Contact {
  id: string;
  name: string;
  phone: string;
  role: string;
  roleName?: string;
  nationalId?: string;
  bankCardNumber?: string;
  bankName?: string;
  bankIBAN?: string;
  jobCategory?: string;
  paymentMethod?: "cash" | "barter";
  barterUnits?: {
    unitId: string;
    blockName?: string;
    saleAreaType?: "useful" | "with_commons";
    usefulArea?: number;
    storageArea?: number;
    parkingArea?: number;
    commonArea?: number;
    area: number;
    price: number;
  }[];
  roles?: string[];
  balance: number;
  createdAt?: string;
  projectId?: string;
}

interface ImprestFund {
  id: string;
  projectId: string;
  contactId: string;
  allocatedLimit: number;
  balance: number;
  status: "active" | "locked" | "closed";
  lastReconciliationDate?: string;
  createdAt: string;
}

interface ImprestExpense {
  id: string;
  imprestId: string;
  expenseDate: string;
  amount: number;
  invoiceNumber?: string;
  description: string;
  materialCategory?: string;
  attachmentUrl?: string;
  status: "pending" | "approved" | "rejected";
  createdAt?: string;
  contactId?: string;
  personName?: string;
  stage?: string;
  paymentStatus?: "unpaid" | "partially_paid" | "paid";
  payments?: TransactionPayment[];
  attachmentName?: string;
  attachmentData?: string;
}

interface PreSale {
  id: string;
  projectId: string;
  contactId: string;
  unitId: string;
  blockName?: string;
  saleAreaType?: "useful" | "with_commons";
  usefulArea?: number;
  storageArea?: number;
  parkingArea?: number;
  commonArea?: number;
  contractArea: number;
  pricePerMeter: number;
  totalPrice: number;
  contractDate: string;
  status: "active" | "completed" | "canceled";
  isScoringPending?: boolean;
  exactArea?: number;
  secondaryPricePerMeter?: number;
  hasExactArea?: boolean;
}

interface PreSaleInstallment {
  id: string;
  preSaleId: string;
  installmentName: string;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  paidDate?: string;
  paidAmount?: number;
  amountPaid?: number;
  percentPaid?: number;
}

interface AlertLog {
  id: string;
  type: "installment" | "check" | "imprest_lock";
  referenceId: string;
  recipientPhone: string;
  message: string;
  sendDate: string;
  isSent: boolean;
}

interface TimesheetItem {
  id: string;
  projectId: string;
  contactId: string;
  personName?: string;
  date: string;
  hoursWorked: number;
  overtimeHours?: number;
  dailyRate: number;
  overtimeRate?: number;
  totalAmount?: number;
  totalPay?: number;
  stage?: string;
  description: string;
  isPaid?: boolean;
}

interface PayrollItem {
  id: string;
  projectId: string;
  contactId: string;
  personName?: string;
  month?: string;
  year?: string;
  baseSalary?: number;
  housingAllowance?: number;
  foodAllowance?: number;
  childAllowance?: number;
  overtimeHours?: number;
  overtimePay?: number;
  bonuses?: number;
  insuranceWorker?: number;
  insuranceEmployer?: number;
  taxDeduction?: number;
  advanceDeduction?: number;
  otherDeductions?: number;
  grossSalary?: number;
  netPayable?: number;
  amount?: number;
  paymentDate: string;
  accountId: string;
  description?: string;
  transactionId?: string;
  isPaid?: boolean;
}

interface DatabaseSchema {
  companies: Company[];
  projects: Project[];
  users: User[];
  accounts: Account[];
  materials: Material[];
  materialTransactions: MaterialTransaction[];
  transactions: Transaction[];
  checks: CheckItem[];
  units: UnitItem[];
  contacts: Contact[];
  imprestFunds: ImprestFund[];
  imprestExpenses: ImprestExpense[];
  preSales: PreSale[];
  preSaleInstallments: PreSaleInstallment[];
  alertsLog: AlertLog[];
  timesheets?: TimesheetItem[];
  payrolls?: PayrollItem[];
}

function getTodayShamsiServer(): string {
  try {
    const parts = new Intl.DateTimeFormat("en-US-u-ca-persian", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(new Date());
    const y = parts.find(p => p.type === "year")?.value;
    const m = parts.find(p => p.type === "month")?.value;
    const d = parts.find(p => p.type === "day")?.value;
    if (y && m && d) {
      return `${y}/${m.padStart(2, "0")}/${d.padStart(2, "0")}`;
    }
  } catch {
    // Fallback
  }
  return "1404/01/01";
}

function addShamsiMonths(shamsiDate: string, monthsToAdd: number): string {
  const parts = (shamsiDate || getTodayShamsiServer()).split("/").map(Number);
  if (parts.length !== 3 || isNaN(parts[0])) return getTodayShamsiServer();
  let [y, m, d] = parts;
  const totalMonths = (y * 12 + (m - 1)) + monthsToAdd;
  y = Math.floor(totalMonths / 12);
  m = (totalMonths % 12) + 1;
  if (m > 6 && d > 30) d = 30;
  if (m === 12 && d > 29) d = 29;
  return `${y}/${String(m).padStart(2, "0")}/${String(d).padStart(2, "0")}`;
}

function getProjectCompanyId(db: DatabaseSchema, projectId?: string, fallbackCompanyId?: string): string {
  if (fallbackCompanyId) return fallbackCompanyId;
  if (projectId && db.projects) {
    const proj = db.projects.find(p => p.id === projectId);
    if (proj && proj.companyId) return proj.companyId;
  }
  return db.companies?.[0]?.id || "c1";
}

const SEED_STAGES = [
  "۱. هزینه‌های زمین و مالکیت",
  "۲. هزینه‌های قانونی و مجوزها",
  "۳. هزینه‌های طراحی و مهندسی",
  "۴. هزینه‌های نظام مهندسی",
  "۵. هزینه‌های مطالعات و خدمات فنی",
  "۶. تجهیز کارگاه",
  "۷. تخریب و آماده‌سازی",
  "۸. گودبرداری و پایدارسازی",
  "۹. فونداسیون",
  "۱۰. اسکلت بتنی",
  "۱۱. راه پله",
  "۱۲. دیوارچینی و سفت‌کاری",
  "۱۳. تأسیسات مکانیکی",
  "۱۴. تأسیسات برقی",
  "۱۵. نازک‌کاری",
  "۱۶. نما",
  "۱۷. درب و پنجره",
  "۱۸. کابینت و دکوراسیون",
  "۱۹. تجهیزات و تأسیسات نهایی",
  "۲۰. محوطه‌سازی",
  "۲۱. هزینه‌های عمومی و سربار",
  "۲۲. هزینه‌های مالی"
];

const DEFAULT_DB: DatabaseSchema = {
  companies: [],
  projects: [],
  users: [
    { id: "u1", name: "مهندس میلاد فرخی", role: "manager", roleName: "مدیر ارشد پروژه" }
  ],
  accounts: [],
  contacts: [],
  imprestFunds: [],
  imprestExpenses: [],
  preSales: [],
  preSaleInstallments: [],
  alertsLog: [],
  materials: [],
  materialTransactions: [],
  transactions: [],
  checks: [],
  units: [],
  timesheets: [],
  payrolls: []
};

// Database helper functions
function recalculatePreSaleInstallments(db: DatabaseSchema, preSaleId: string) {
  if (!db.preSaleInstallments || !db.transactions) return;

  const installments = db.preSaleInstallments.filter(i => i.preSaleId === preSaleId);
  
  installments.sort((a, b) => {
    const isAPrep = a.installmentName.includes("عقد قرارداد") || a.installmentName.includes("پیش‌پرداخت");
    const isBPrep = b.installmentName.includes("عقد قرارداد") || b.installmentName.includes("پیش‌پرداخت");
    if (isAPrep && !isBPrep) return -1;
    if (!isAPrep && isBPrep) return 1;
    return a.dueDate.localeCompare(b.dueDate);
  });

  const preSale = db.preSales?.find(ps => ps.id === preSaleId);
  const contact = preSale ? db.contacts?.find(c => c.id === preSale.contactId) : undefined;
  
  let payments = [];
  if (contact) {
    if (contact.paymentMethod === "barter") {
      // For barter contacts, count all expense transactions under their name for this project, 
      // and any income transactions linked to this pre-sale or their name
      payments = db.transactions.filter(t => 
        ((t.type === "expense" && t.personName.trim() === contact.name.trim()) || 
         (t.type === "income" && (t.preSaleId === preSaleId || t.personName.trim() === contact.name.trim()))) &&
        t.projectId === preSale!.projectId
      );
    } else {
      // For regular contacts, count any income transactions matching their name or preSaleId
      payments = db.transactions.filter(t => 
        t.type === "income" && 
        (t.preSaleId === preSaleId || t.personName.trim() === contact.name.trim())
      );
    }
  }

  let totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);

  for (const inst of installments) {
    if (totalPaid >= inst.amount) {
      inst.isPaid = true;
      inst.amountPaid = inst.amount;
      inst.percentPaid = 100;
      inst.paidDate = payments.length > 0 ? payments[payments.length - 1].date : inst.dueDate;
      totalPaid -= inst.amount;
    } else if (totalPaid > 0) {
      inst.isPaid = false;
      inst.paidDate = undefined;
      inst.amountPaid = totalPaid;
      inst.percentPaid = Math.round((totalPaid / inst.amount) * 100);
      totalPaid = 0;
    } else {
      inst.isPaid = false;
      inst.paidDate = undefined;
      inst.amountPaid = 0;
      inst.percentPaid = 0;
    }
  }
}

function readDb(): DatabaseSchema {
  const dbFile = getDbPath();
  try {
    let db: DatabaseSchema;
    if (!fs.existsSync(dbFile)) {
      db = DEFAULT_DB;
      fs.writeFileSync(dbFile, JSON.stringify(db, null, 2), "utf-8");
    } else {
      const data = fs.readFileSync(dbFile, "utf-8");
      db = JSON.parse(data);
    }
    
    // Recalculate pre-sale installments for all pre-sales to keep DB consistent
    if (db.preSales && db.preSaleInstallments && db.transactions) {
      db.preSales.forEach(ps => {
        recalculatePreSaleInstallments(db, ps.id);
      });
    }
    return db;
  } catch (err) {
    console.error("Error reading db file, falling back to default mock data:", err);
    return DEFAULT_DB;
  }
}

function writeDb(data: DatabaseSchema) {
  const dbFile = getDbPath();
  try {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    console.error("Error writing db file:", err);
  }
}

// Ensure database file is initialized on startup
readDb();

function getShamsiDateTimeServer() {
  const shamsiDate = getTodayShamsiServer();
  let shamsiTime = "00:00:00";
  try {
    const now = new Date();
    const tParts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Tehran",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false
    }).formatToParts(now);
    const hh = tParts.find(p => p.type === "hour")?.value || String(now.getHours()).padStart(2, "0");
    const mm = tParts.find(p => p.type === "minute")?.value || String(now.getMinutes()).padStart(2, "0");
    const ss = tParts.find(p => p.type === "second")?.value || String(now.getSeconds()).padStart(2, "0");
    shamsiTime = `${hh.padStart(2, "0")}:${mm.padStart(2, "0")}:${ss.padStart(2, "0")}`;
  } catch {
    const now = new Date();
    shamsiTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  }
  return {
    shamsiDate,
    shamsiTime,
    versionName: `نسخه ${shamsiDate} - ساعت ${shamsiTime}`
  };
}

function getDbStats(db: DatabaseSchema) {
  return {
    companies: Array.isArray(db.companies) ? db.companies.length : 0,
    projects: Array.isArray(db.projects) ? db.projects.filter(p => !p.isDeleted).length : 0,
    transactions: Array.isArray(db.transactions) ? db.transactions.length : 0,
    accounts: Array.isArray(db.accounts) ? db.accounts.length : 0,
    units: Array.isArray(db.units) ? db.units.filter(u => !u.isDeleted).length : 0,
    contacts: Array.isArray(db.contacts) ? db.contacts.length : 0,
    preSales: Array.isArray(db.preSales) ? db.preSales.length : 0,
    checks: Array.isArray(db.checks) ? db.checks.length : 0
  };
}

function isDbCompletelyEmpty(db: DatabaseSchema): boolean {
  return (
    (!db.companies || db.companies.length === 0) &&
    (!db.projects || db.projects.length === 0) &&
    (!db.transactions || db.transactions.length === 0) &&
    (!db.accounts || db.accounts.length === 0) &&
    (!db.contacts || db.contacts.length === 0)
  );
}

function createLocalBackupSnapshot(db: DatabaseSchema, sourceLabel: string = "بکاپ محلی خودکار") {
  try {
    const backupsDir = getBackupsDir();
    const { shamsiDate, shamsiTime, versionName } = getShamsiDateTimeServer();
    const createdAt = Date.now();
    const id = `local_${createdAt}`;
    const stats = getDbStats(db);

    const payload = {
      id,
      versionName,
      shamsiDate,
      shamsiTime,
      createdAt,
      source: sourceLabel,
      location: "local",
      stats,
      db
    };

    const filename = `version_${createdAt}.json`;
    fs.writeFileSync(path.join(backupsDir, filename), JSON.stringify(payload, null, 2), "utf-8");

    // Keep latest 30 local versioned backups
    const files = fs.readdirSync(backupsDir)
      .filter(f => f.startsWith("version_") && f.endsWith(".json"))
      .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }));

    if (files.length > 30) {
      files.sort((a, b) => a.time - b.time);
      const toDelete = files.length - 30;
      for (let i = 0; i < toDelete; i++) {
        try { fs.unlinkSync(path.join(backupsDir, files[i].name)); } catch {}
      }
    }

    return {
      id,
      versionName,
      shamsiDate,
      shamsiTime,
      createdAt,
      source: sourceLabel,
      location: "local",
      stats
    };
  } catch (err) {
    console.error("Failed to create local backup snapshot:", err);
    return null;
  }
}

async function createOnlineAndLocalBackup(db: DatabaseSchema, sourceLabel: string, customCfUrl?: string) {
  const localVersion = createLocalBackupSnapshot(db, sourceLabel);
  let onlineVersion = null;
  let syncedOnline = false;

  const settings = readSettings();
  const targetCfUrl = (customCfUrl || settings.cfWorkerUrl || DEFAULT_SETTINGS.cfWorkerUrl || "").replace(/\/+$/, "");

  if (targetCfUrl) {
    try {
      const response = await fetch(`${targetCfUrl}/api/db/import`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(settings.syncToken ? { "x-sync-token": settings.syncToken } : {})
        },
        body: JSON.stringify({
          ...db,
          _backupSource: sourceLabel
        })
      });
      if (response.ok) {
        const resData: any = await response.json().catch(() => ({}));
        onlineVersion = resData.backupVersion || null;
        syncedOnline = true;
      }
    } catch (e) {
      console.error("Online backup sync warning (offline mode continues safely):", e);
    }
  }

  return {
    localVersion,
    onlineVersion,
    syncedOnline
  };
}

function markFirstInstallCompleted() {
  try {
    const settings = readSettings();
    if (!settings.firstInstallSynced) {
      settings.firstInstallSynced = true;
      writeSettings(settings);
    }
    if (process.env.USER_DATA_DIR) {
      const flagPath = path.join(process.env.USER_DATA_DIR, "first_install_completed.flag");
      if (!fs.existsSync(flagPath)) {
        fs.writeFileSync(flagPath, new Date().toISOString(), "utf-8");
      }
    }
  } catch (e) {
    console.error("Error marking first install flag:", e);
  }
}

// 1. Get entire DB
app.get("/api/db", (req, res) => {
  res.json(readDb());
});

// 1b. First-Install Cloud Initialization Check & Sync
app.post("/api/first-install-sync", async (req, res) => {
  try {
    const settings = readSettings();
    const localDb = readDb();
    const isEmpty = isDbCompletelyEmpty(localDb);
    const isFirstInstall = !settings.firstInstallSynced || process.env.IS_FIRST_INSTALL === "true";

    if (!isFirstInstall || !isEmpty) {
      markFirstInstallCompleted();
      return res.json({
        status: "success",
        initializedFromCloud: false,
        message: "نسخه آفلاین دارای اطلاعات است (اولویت با نسخه آفلاین)",
        db: localDb
      });
    }

    const targetCfUrl = (req.body?.cfUrl || settings.cfWorkerUrl || DEFAULT_SETTINGS.cfWorkerUrl || "").replace(/\/+$/, "");
    let initializedFromCloud = false;
    let finalDb = localDb;

    if (targetCfUrl) {
      try {
        const cloudRes = await fetch(`${targetCfUrl}/api/db`);
        if (cloudRes.ok) {
          const cloudDb: any = await cloudRes.json();
          if (cloudDb && Array.isArray(cloudDb.projects) && !isDbCompletelyEmpty(cloudDb)) {
            writeDb(cloudDb);
            createLocalBackupSnapshot(cloudDb, "دریافت اولیه اطلاعات از فضای ابری در اولین نصب");
            finalDb = readDb();
            initializedFromCloud = true;
          }
        }
      } catch (cloudErr) {
        console.warn("Could not reach cloud on first install, keeping empty default DB:", cloudErr);
      }
    }

    markFirstInstallCompleted();
    process.env.IS_FIRST_INSTALL = "false";

    res.json({
      status: "success",
      initializedFromCloud,
      message: initializedFromCloud
        ? "در اولین نصب، اطلاعات به صورت خودکار از نسخه ابری خوانده و در نسخه آفلاین ذخیره شد."
        : "نرم‌افزار به صورت خام و بدون اطلاعات پیش‌فرض آماده استفاده است.",
      db: finalDb
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 1c. Get All Available Backup Versions (Cloud + Local, Sorted by Date & Time)
app.get("/api/backups", async (req, res) => {
  try {
    const settings = readSettings();
    const targetCfUrl = ((req.query.cfUrl as string) || settings.cfWorkerUrl || DEFAULT_SETTINGS.cfWorkerUrl || "").replace(/\/+$/, "");
    const backupsDir = getBackupsDir();

    // 1. Read local versions
    const localVersions: any[] = [];
    if (fs.existsSync(backupsDir)) {
      const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("version_") && f.endsWith(".json"));
      for (const file of files) {
        try {
          const raw = fs.readFileSync(path.join(backupsDir, file), "utf-8");
          const parsed = JSON.parse(raw);
          localVersions.push({
            id: parsed.id,
            versionName: parsed.versionName,
            shamsiDate: parsed.shamsiDate,
            shamsiTime: parsed.shamsiTime,
            createdAt: parsed.createdAt,
            source: parsed.source,
            location: "local",
            stats: parsed.stats || {}
          });
        } catch {}
      }
    }

    // 2. Fetch cloud versions
    let cloudVersions: any[] = [];
    if (targetCfUrl) {
      try {
        const cloudRes = await fetch(`${targetCfUrl}/api/backups`);
        if (cloudRes.ok) {
          const cloudData: any = await cloudRes.json();
          if (cloudData && Array.isArray(cloudData.versions)) {
            cloudVersions = cloudData.versions.map((v: any) => ({
              ...v,
              location: "cloud"
            }));
          }
        }

        // Also check current live cloud DB so if there is live data on cloud, it appears as latest cloud version
        const liveRes = await fetch(`${targetCfUrl}/api/db`);
        if (liveRes.ok) {
          const liveDb: any = await liveRes.json();
          if (liveDb && Array.isArray(liveDb.projects) && !isDbCompletelyEmpty(liveDb)) {
            const { shamsiDate, shamsiTime } = getShamsiDateTimeServer();
            const liveStats = getDbStats(liveDb);
            // If cloudVersions is empty, add live cloud state as an available version
            if (cloudVersions.length === 0) {
              cloudVersions.unshift({
                id: "cloud_live",
                versionName: `آخرین وضعیت زنده سرور ابری (${shamsiDate})`,
                shamsiDate,
                shamsiTime,
                createdAt: Date.now(),
                source: "دیتابیس آنلاین کلودفلر (D1)",
                location: "cloud",
                stats: liveStats
              });
            }
          }
        }
      } catch (e) {
        // Offline or cloud unreachable: continue with localVersions
      }
    }

    const allVersions = [...cloudVersions, ...localVersions].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
    res.json({
      status: "success",
      versions: allVersions,
      localStats: getDbStats(readDb())
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در دریافت لیست ورژن‌های پشتیبان: " + err.message });
  }
});

// 1d. Create New Timestamped Backup (Local + Online Cloud)
app.post(["/api/backups/create", "/api/backups"], async (req, res) => {
  try {
    const db = readDb();
    const sourceLabel = req.body?.source || "ثبت بکاپ و به‌روزرسانی دستی به سرور آنلاین";
    const result = await createOnlineAndLocalBackup(db, sourceLabel, req.body?.cfUrl);
    res.json({
      status: "success",
      message: result.syncedOnline
        ? "بکاپ جدید با تاریخ و ساعت فعلی در دیتابیس محلی و سرور آنلاین ابری ثبت شد."
        : "بکاپ جدید با تاریخ و ساعت فعلی در دیتابیس محلی ثبت شد (سرور ابری در دسترس نبود).",
      backupVersion: result.localVersion,
      ...result
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در ثبت بکاپ جدید: " + err.message });
  }
});

// 1e. Restore / Update Offline App to a Selected Backup Version
app.post("/api/backups/restore", async (req, res) => {
  try {
    const { versionId, location, cfUrl } = req.body;
    const settings = readSettings();
    const targetCfUrl = (cfUrl || settings.cfWorkerUrl || DEFAULT_SETTINGS.cfWorkerUrl || "").replace(/\/+$/, "");

    let targetDb: DatabaseSchema | null = null;
    let restoredVersionInfo: any = null;

    if (req.body.dbData && typeof req.body.dbData === "object") {
      targetDb = req.body.dbData;
    } else if (location === "local") {
      const backupsDir = getBackupsDir();
      const files = fs.readdirSync(backupsDir).filter(f => f.startsWith("version_") && f.endsWith(".json"));
      for (const file of files) {
        const raw = fs.readFileSync(path.join(backupsDir, file), "utf-8");
        const parsed = JSON.parse(raw);
        if (parsed.id === versionId && parsed.db) {
          targetDb = parsed.db;
          restoredVersionInfo = parsed;
          break;
        }
      }
    } else if (location === "cloud" && targetCfUrl) {
      if (versionId === "cloud_live") {
        const liveRes = await fetch(`${targetCfUrl}/api/db`);
        if (liveRes.ok) {
          targetDb = await liveRes.json() as DatabaseSchema;
        }
      } else {
        const verRes = await fetch(`${targetCfUrl}/api/backups/${encodeURIComponent(versionId)}`);
        if (verRes.ok) {
          const verData: any = await verRes.json();
          if (verData && verData.db) {
            targetDb = verData.db;
            restoredVersionInfo = verData.version;
          }
        }
      }
    }

    if (!targetDb || !Array.isArray(targetDb.projects)) {
      return res.status(404).json({ error: "اطلاعات ورژن انتخاب‌شده یافت نشد یا معتبر نیست." });
    }

    // Save a safety snapshot of current offline DB before overwriting (if not empty)
    const currentDb = readDb();
    if (!isDbCompletelyEmpty(currentDb)) {
      createLocalBackupSnapshot(currentDb, "بکاپ محافظتی خودکار قبل از تغییر ورژن");
    }

    writeDb(targetDb);
    markFirstInstallCompleted();

    res.json({
      status: "success",
      message: `نرم‌افزار آفلاین با موفقیت به ورژن انتخاب‌شده (${restoredVersionInfo?.versionName || versionId}) به‌روزرسانی شد.`,
      db: readDb()
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در به‌روزرسانی به ورژن انتخاب‌شده: " + err.message });
  }
});

// 1f. Pre-Close Automatic Backup Endpoint (Local + Online Cloud)
app.post("/api/backup-on-close", async (req, res) => {
  try {
    const db = readDb();
    const sourceLabel = req.body?.source || "بکاپ خودکار هنگام بستن نرم‌افزار آفلاین";
    const result = await createOnlineAndLocalBackup(db, sourceLabel, req.body?.cfUrl);
    res.json({
      status: "success",
      ...result
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Reset database to empty clean state
app.post("/api/db/reset", (req, res) => {
  writeDb(DEFAULT_DB);
  res.json({ status: "success", message: "تمامی اطلاعات پاکسازی شد و پایگاه داده به حالت خام بازگشت." });
});

// 2b. Import and synchronize complete database (Offline Sync)
app.post("/api/db/import", async (req, res) => {
  try {
    const incomingDb = req.body;
    
    // Validate schema
    if (!incomingDb || typeof incomingDb !== "object") {
      return res.status(400).json({ error: "فرمت داده‌های ارسالی نامعتبر است" });
    }

    const requiredKeys = ["companies", "projects", "users", "accounts", "materials", "transactions", "checks", "units", "contacts"];
    const missingKeys = requiredKeys.filter(key => !Array.isArray(incomingDb[key]));

    if (missingKeys.length > 0) {
      return res.status(400).json({ 
        error: `آرایه‌های مربوط به داده‌های زیر یافت نشد یا معتبر نیست: ${missingKeys.join(", ")}` 
      });
    }

    // Save local timestamped backup before & after import
    const cleanDb = { ...incomingDb };
    delete cleanDb._backupSource;
    delete cleanDb._skipBackupSnapshot;

    writeDb(cleanDb);
    createLocalBackupSnapshot(cleanDb, incomingDb._backupSource || "به‌روزرسانی پایگاه داده آفلاین");
    markFirstInstallCompleted();

    res.json({ 
      status: "success", 
      message: "پایگاه داده آفلاین با موفقیت همگام‌سازی و ذخیره شد.",
      statistics: {
        projects: cleanDb.projects.length,
        transactions: cleanDb.transactions.length,
        accounts: cleanDb.accounts.length,
        contacts: cleanDb.contacts.length,
        checks: cleanDb.checks.length,
        materials: cleanDb.materials.length
      }
    });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در پردازش و همگام‌سازی پایگاه داده: " + err.message });
  }
});

// 2c. Add or Update Company
app.post("/api/companies", (req, res) => {
  try {
    const db = readDb();
    const companyId = req.body.id || "c_" + Date.now();
    const newCompany: Company = {
      id: companyId,
      name: req.body.name,
      code: req.body.code || String(Math.floor(Math.random() * 90000) + 10000)
    };

    const index = db.companies.findIndex(c => c.id === companyId);
    if (index >= 0) {
      db.companies[index] = newCompany;
    } else {
      db.companies.push(newCompany);
    }

    writeDb(db);
    res.json({ status: "success", id: companyId, company: newCompany });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در ثبت شرکت: " + err.message });
  }
});

// 2d. Delete Company
app.post("/api/companies/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    
    // Find all projects of this company
    const projectIds = db.projects.filter(p => p.companyId === id).map(p => p.id);
    
    // Cascade delete: filter out company
    db.companies = db.companies.filter(c => c.id !== id);
    
    // Cascade delete: filter out projects of this company
    db.projects = db.projects.filter(p => p.companyId !== id);
    
    // Cascade delete: filter out transactions of this company or its projects
    db.transactions = db.transactions.filter(t => t.companyId !== id && !projectIds.includes(t.projectId));
    
    // Cascade delete: filter out checks of this company or its projects
    db.checks = db.checks.filter(ch => ch.companyId !== id && !projectIds.includes(ch.projectId));
    
    // Cascade delete: filter out units of deleted projects
    if (db.units) {
      db.units = db.units.filter(u => !projectIds.includes(u.projectId));
    }
    
    // Cascade delete: filter out material transactions of deleted projects
    if (db.materialTransactions) {
      db.materialTransactions = db.materialTransactions.filter(mt => !projectIds.includes(mt.projectId));
    }
    
    // Cascade delete: preSales
    if (db.preSales) {
      db.preSales = db.preSales.filter(ps => !projectIds.includes(ps.projectId));
    }
    
    // Cascade delete: imprest funds & expenses
    if (db.imprestFunds) {
      const deletedImprestIds = db.imprestFunds.filter(imp => projectIds.includes(imp.projectId)).map(imp => imp.id);
      db.imprestFunds = db.imprestFunds.filter(imp => !projectIds.includes(imp.projectId));
      if (db.imprestExpenses) {
        db.imprestExpenses = db.imprestExpenses.filter(ie => !deletedImprestIds.includes(ie.imprestId));
      }
    }
    
    writeDb(db);
    res.json({ status: "success", message: "شرکت به همراه تمامی پروژه‌ها، تراکنش‌ها، چک‌ها و انبارهای مربوطه حذف گردید" });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف شرکت: " + err.message });
  }
});

// 3. Add or Update Project
app.post("/api/projects", (req, res) => {
  const db = readDb();
  const index = db.projects.findIndex(p => p.id === req.body.id);
  const isNew = index < 0;
  const existingProj = !isNew ? db.projects[index] : undefined;

  const resolvedCompanyId = req.body.companyId || existingProj?.companyId || db.companies[0]?.id || "c1";
  if (!db.companies || db.companies.length === 0) {
    db.companies = [{ id: resolvedCompanyId, name: "دفتر مرکزی", code: "1001" }];
  }

  const newProject: Project = {
    id: req.body.id || "p_" + Date.now(),
    companyId: resolvedCompanyId,
    name: req.body.name,
    address: req.body.address || "",
    totalArea: Number(req.body.totalArea || 0),
    budget: Number(req.body.budget || 0),
    stages: req.body.stages || existingProj?.stages || SEED_STAGES,
    currentStage: req.body.currentStage || existingProj?.currentStage || SEED_STAGES[0],
    status: req.body.status || existingProj?.status || "active",
    supervisorName: req.body.supervisorName || existingProj?.supervisorName || "مهندس میلاد فرخی",
    numberOfUnits: (req.body.numberOfUnits ?? req.body.totalUnits) !== undefined ? Number(req.body.numberOfUnits ?? req.body.totalUnits) : existingProj?.numberOfUnits,
    defaultUnitArea: req.body.defaultUnitArea !== undefined ? Number(req.body.defaultUnitArea) : existingProj?.defaultUnitArea,
    defaultUnitPrice: req.body.defaultUnitPrice !== undefined ? Number(req.body.defaultUnitPrice) : existingProj?.defaultUnitPrice,
    isDeleted: req.body.isDeleted !== undefined ? !!req.body.isDeleted : existingProj?.isDeleted,
    deletedAt: req.body.deletedAt !== undefined ? req.body.deletedAt : existingProj?.deletedAt
  };

  if (!isNew) {
    db.projects[index] = newProject;
  } else {
    db.projects.push(newProject);
  }

  // Auto-generate units if requested (on new project or if numberOfUnits/totalUnits increased on edit)
  // Note: Only number of units is specified in project management; block, area breakdown, and price are defined in contracts or unit edit modal.
  const requestedUnitsCount = Number(req.body.numberOfUnits ?? req.body.totalUnits ?? 0);
  if (requestedUnitsCount > 0) {
    const requestedUnits = requestedUnitsCount;
    const defArea = Number(req.body.defaultUnitArea || newProject.defaultUnitArea || 0);
    const defPrice = Number(req.body.defaultUnitPrice || newProject.defaultUnitPrice || 0);
    
    if (!db.units) db.units = [];
    const currentActiveUnits = db.units.filter(u => u.projectId === newProject.id && !u.isDeleted);
    const startIdx = isNew ? 1 : (currentActiveUnits.length + 1);

    if (requestedUnits >= startIdx) {
      for (let i = startIdx; i <= requestedUnits; i++) {
        const unitNumber = String(i);
        const floor = String(Math.ceil(i / 2)); // 2 units per floor by default
        db.units.push({
          id: "u_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 100),
          projectId: newProject.id,
          unitNumber,
          blockName: "",
          floor,
          saleAreaType: "useful",
          usefulArea: defArea,
          storageArea: 0,
          parkingArea: 0,
          commonArea: 0,
          area: defArea,
          pricePerMeter: defPrice,
          totalPrice: defArea * defPrice,
          status: "available",
          specificExpenses: []
        });
      }
    }
  }

  writeDb(db);
  res.json({ status: "success", project: newProject });
});

// 5. Add/Update Account
app.post("/api/accounts", (req, res) => {
  const db = readDb();
  const index = db.accounts.findIndex(a => a.id === req.body.id);
  const existingAcc = index >= 0 ? db.accounts[index] : undefined;

  const newAccount: Account = {
    id: req.body.id || "a_" + Date.now(),
    name: req.body.name,
    type: req.body.type,
    typeName: req.body.typeName || existingAcc?.typeName || "حساب",
    accountNumber: req.body.accountNumber !== undefined ? req.body.accountNumber : existingAcc?.accountNumber,
    bankName: req.body.bankName !== undefined ? req.body.bankName : existingAcc?.bankName,
    balance: Number(req.body.balance || 0),
    code: req.body.code || existingAcc?.code || ("101" + String(db.accounts.length + 1).padStart(3, "0")),
    level: req.body.level || existingAcc?.level || 3,
    parentCode: req.body.parentCode || existingAcc?.parentCode || (req.body.type === "investor" ? "301" : "101"),
    nature: req.body.nature || existingAcc?.nature || (req.body.type === "investor" ? "creditor" : "debtor"),
    projectId: req.body.projectId || existingAcc?.projectId || undefined
  };

  if (index >= 0) {
    db.accounts[index] = newAccount;
  } else {
    db.accounts.push(newAccount);
  }

  writeDb(db);
  res.json({ status: "success", account: newAccount });
});

// 5b. Delete Account
app.post("/api/accounts/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    const idx = db.accounts.findIndex(a => a.id === id);
    if (idx >= 0) {
      db.accounts.splice(idx, 1);
      writeDb(db);
      res.json({ status: "success", message: "حساب مالی با موفقیت حذف شد" });
    } else {
      res.status(404).json({ error: "حساب مالی یافت نشد" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف حساب: " + err.message });
  }
});

// Helper to get how much of an expense transaction was paid in cash/bank
function getTxPaidAmount(tx: Transaction): number {
  if (tx.isNonCash) return tx.amount;
  if (tx.payments && tx.payments.length > 0) {
    return tx.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  }
  if (tx.paymentStatus === "unpaid") return 0;
  return tx.amount;
}

// 6. Add/Update Transaction (Receipts & Payments)
app.post("/api/transactions", (req, res) => {
  const db = readDb();
  
  const existingIndex = db.transactions.findIndex(t => t.id === req.body.id);
  if (existingIndex >= 0) {
    const oldTx = db.transactions[existingIndex];
    // Revert old transaction account balance adjustments
    if (!oldTx.isNonCash) {
      if (oldTx.payments && oldTx.payments.length > 0) {
        oldTx.payments.forEach(p => {
          const acc = db.accounts.find(a => a.id === p.accountId);
          if (acc) {
            if (oldTx.type === "expense") {
              acc.balance += p.amount; // Add back expense
            } else {
              acc.balance -= p.amount; // Deduct back income
            }
          }
        });
      } else if (oldTx.paymentStatus !== "unpaid" && oldTx.accountId) {
        const acc = db.accounts.find(a => a.id === oldTx.accountId);
        if (acc) {
          if (oldTx.type === "expense") {
            acc.balance += oldTx.amount;
          } else {
            acc.balance -= oldTx.amount;
          }
        }
      }
    }

    // Revert old transaction contact balance adjustments
    if (oldTx.personName && db.contacts) {
      const oldContact = db.contacts.find(c => c.name.trim() === oldTx.personName.trim());
      if (oldContact) {
        if (oldTx.type === "expense" && !oldTx.isNonCash) {
          const oldUnpaid = Math.max(0, oldTx.amount - getTxPaidAmount(oldTx));
          if (oldUnpaid > 0) {
            oldContact.balance = (oldContact.balance || 0) - oldUnpaid;
          }
        } else if (oldTx.type === "income" && oldContact.role === "pre_buyer") {
          oldContact.balance = (oldContact.balance || 0) + oldTx.amount;
        }
      }
    }
  }

  // Ensure there is at least one default account if accounts list is empty and transaction is cash/bank
  if (!db.accounts) db.accounts = [];
  if (db.accounts.length === 0 && !req.body.isNonCash) {
    db.accounts.push({
      id: "a1",
      name: "حساب بانکی و صندوق اصلی کارگاه",
      type: "bank",
      typeName: "بانک تجاری",
      balance: 0,
      code: "101001",
      level: 3,
      parentCode: "101",
      nature: "debtor"
    });
  }

  const resolvedAccountId = req.body.accountId || db.accounts[0]?.id || "a1";
  const resolvedProjectId = req.body.projectId || db.projects.find(p => !p.isDeleted)?.id || "";

  const newTransaction: Transaction = {
    id: req.body.id || "t_" + Date.now(),
    companyId: getProjectCompanyId(db, resolvedProjectId, req.body.companyId),
    projectId: resolvedProjectId,
    type: req.body.type, // income / expense
    category: req.body.category || (req.body.type === "expense" ? "خرید مصالح" : "پیش‌فروش"),
    subCategory: req.body.subCategory,
    amount: Number(req.body.amount || 0),
    accountId: resolvedAccountId,
    personName: req.body.personName || "طرف حساب عمومی",
    date: req.body.date || getTodayShamsiServer(),
    description: req.body.description || "",
    invoiceNumber: req.body.invoiceNumber || "",
    isNonCash: !!req.body.isNonCash,
    barterDetails: req.body.barterDetails,
    attachmentName: req.body.attachmentName,
    attachmentData: req.body.attachmentData, // base64 document attachment
    paymentStatus: req.body.paymentStatus || (req.body.type === "expense" ? "paid" : "paid"),
    payments: (req.body.payments || []).map((p: any) => ({
      ...p,
      accountId: p.accountId || resolvedAccountId,
      invoiceNumber: p.invoiceNumber || req.body.invoiceNumber || "",
      invoiceDescription: p.invoiceDescription || p.description || req.body.description || ""
    })),
    approvalStatus: req.body.approvalStatus || "approved",
    approvedAmount: req.body.approvedAmount !== undefined ? Number(req.body.approvedAmount) : undefined,
    approvedBy: req.body.approvedBy,
    approvedDate: req.body.approvedDate
  };

  // Determine paymentStatus accurately when payments array is provided
  if (newTransaction.type === "expense" && !newTransaction.isNonCash) {
    if (newTransaction.payments && newTransaction.payments.length > 0) {
      const sumPayments = newTransaction.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
      if (sumPayments >= newTransaction.amount) {
        newTransaction.paymentStatus = "paid";
      } else if (sumPayments > 0) {
        newTransaction.paymentStatus = "partially_paid";
      }
    } else if (newTransaction.paymentStatus === "paid") {
      newTransaction.payments = [{
        id: "p_" + Date.now(),
        amount: newTransaction.amount,
        date: newTransaction.date,
        accountId: newTransaction.accountId,
        referenceNumber: req.body.referenceNumber || "تسویه نقدی فوری",
        invoiceNumber: newTransaction.invoiceNumber || "",
        invoiceDescription: newTransaction.description || "ثبت همزمان با فاکتور",
        settlementMethod: "فیش بانکی",
        paymentStatus: "تایید نهایی",
        description: newTransaction.description || "ثبت همزمان با فاکتور"
      }];
    }
  } else if (newTransaction.type === "income" && !newTransaction.isNonCash && (!newTransaction.payments || newTransaction.payments.length === 0)) {
    newTransaction.payments = [{
      id: "p_" + Date.now(),
      amount: newTransaction.amount,
      date: newTransaction.date,
      accountId: newTransaction.accountId,
      referenceNumber: req.body.referenceNumber || "واریزی دریافتی",
      invoiceNumber: newTransaction.invoiceNumber || "",
      invoiceDescription: newTransaction.description || "سند دریافت وجه",
      settlementMethod: "فیش بانکی",
      paymentStatus: "تایید نهایی",
      description: newTransaction.description || "سند دریافت وجه"
    }];
  }

  // Save attachment as local file if provided
  if (req.body.attachmentData && req.body.attachmentName) {
    const savedFilename = saveBase64File(req.body.attachmentData, req.body.attachmentName);
    newTransaction.attachmentName = savedFilename;
  }

  // Save payments receipt files as local files if provided
  if (newTransaction.payments) {
    newTransaction.payments.forEach(p => {
      if (p.receiptFileData && p.receiptFileName) {
        const savedFilename = saveBase64File(p.receiptFileData, p.receiptFileName);
        p.receiptFileName = savedFilename;
      }
    });
  }

  // Adjust account balance based on payments (if it is cash / bank and not non-cash barter)
  if (!newTransaction.isNonCash) {
    if (newTransaction.payments && newTransaction.payments.length > 0) {
      newTransaction.payments.forEach(p => {
        const acc = db.accounts.find(a => a.id === p.accountId);
        if (acc) {
          if (newTransaction.type === "expense") {
            acc.balance -= p.amount;
          } else {
            acc.balance += p.amount;
          }
        }
      });
    } else if (newTransaction.paymentStatus !== "unpaid" && newTransaction.accountId) {
      const acc = db.accounts.find(a => a.id === newTransaction.accountId);
      if (acc) {
        if (newTransaction.type === "expense") {
          acc.balance -= newTransaction.amount;
        } else {
          acc.balance += newTransaction.amount;
        }
      }
    }
  }

  // Auto-pairing with pre-sales & updating contact balance
  if (newTransaction.personName) {
    const contact = db.contacts?.find(c => c.name.trim() === newTransaction.personName!.trim());
    if (contact) {
      const preSale = db.preSales?.find(ps => ps.contactId === contact.id);
      if (preSale) {
        newTransaction.preSaleId = preSale.id;
        // If it's an income, automatically categorize as "پیش‌فروش" so it deducts from installments
        if (newTransaction.type === "income") {
          newTransaction.category = "پیش‌فروش";
        }
        
        // Attach the projectId if not set or empty
        if (!newTransaction.projectId) {
          newTransaction.projectId = preSale.projectId;
        }
      }

      // Sync contact balance for credit/unpaid invoices or pre-buyer receipts
      if (newTransaction.type === "expense" && !newTransaction.isNonCash) {
        const unpaidAmt = Math.max(0, newTransaction.amount - getTxPaidAmount(newTransaction));
        if (unpaidAmt > 0) {
          contact.balance = (contact.balance || 0) + unpaidAmt;
        }
      } else if (newTransaction.type === "income" && contact.role === "pre_buyer") {
        contact.balance = Math.max(0, (contact.balance || 0) - newTransaction.amount);
      }
    }
  }

  if (existingIndex >= 0) {
    db.transactions[existingIndex] = newTransaction;
  } else {
    db.transactions.push(newTransaction);
  }

  // Trigger recalculation for all pre-sales to make sure any installments are instantly updated
  if (db.preSales && db.preSaleInstallments) {
    db.preSales.forEach(ps => {
      recalculatePreSaleInstallments(db, ps.id);
    });
  }
  
  writeDb(db);
  res.json({ status: "success", transaction: newTransaction });
});

// 6a2. Approve/Reject Transaction (For Senior Manager Workflow)
app.post("/api/transactions/approve", (req, res) => {
  try {
    const db = readDb();
    const { id, approvalStatus, approvedAmount, approvedBy, approvedDate } = req.body;
    
    if (!id) {
      return res.status(400).json({ error: "شناسه تراکنش الزامی است" });
    }
    
    const txIdx = db.transactions.findIndex(t => t.id === id);
    if (txIdx < 0) {
      return res.status(404).json({ error: "تراکنش یافت نشد" });
    }
    
    const tx = db.transactions[txIdx];
    tx.approvalStatus = approvalStatus || "approved";
    if (approvedAmount !== undefined) {
      tx.approvedAmount = Number(approvedAmount);
    }
    if (approvedBy !== undefined) {
      tx.approvedBy = approvedBy;
    }
    if (approvedDate !== undefined) {
      tx.approvedDate = approvedDate;
    }
    
    writeDb(db);
    res.json({ status: "success", transaction: tx });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در ثبت تاییدیه تراکنش: " + err.message });
  }
});

// 6b. Add installment / payment to existing transaction
app.post("/api/transactions/pay", (req, res) => {
  const db = readDb();
  const { 
    transactionId, 
    rowNumber,
    amount, 
    date, 
    accountId, 
    referenceNumber,
    invoiceNumber,
    invoiceDescription,
    description,
    settlementMethod,
    paymentStatus,
    destinationAccount,
    receiptFileName,
    receiptFileData
  } = req.body;
  
  const tx = db.transactions.find(t => t.id === transactionId);
  if (!tx) {
    return res.status(404).json({ status: "error", message: "تراکنش یافت نشد" });
  }
  
  if (!tx.payments) {
    tx.payments = [];
  }
  
  let savedReceiptName = receiptFileName || "";
  if (receiptFileData && receiptFileName) {
    savedReceiptName = saveBase64File(receiptFileData, receiptFileName);
  }
  
  const payNum = Number(amount);
  const resolvedAccId = accountId || tx.accountId || db.accounts[0]?.id || "a1";
  const newPayment: TransactionPayment = {
    id: "p_" + Date.now(),
    rowNumber: rowNumber !== undefined ? (Number(rowNumber) || rowNumber) : (tx.payments.length + 1),
    amount: payNum,
    date: date || getTodayShamsiServer(),
    accountId: resolvedAccId,
    referenceNumber: referenceNumber || "",
    invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : (tx.invoiceNumber || ""),
    invoiceDescription: invoiceDescription !== undefined ? invoiceDescription : (description || tx.description || ""),
    settlementMethod: settlementMethod || "فیش بانکی",
    paymentStatus: paymentStatus || "موفق",
    destinationAccount: destinationAccount || "",
    receiptFileName: savedReceiptName,
    receiptFileData: receiptFileData || "",
    description: description || invoiceDescription || ""
  };
  
  tx.payments.push(newPayment);
  
  // Calculate total paid
  const totalPaid = tx.payments.reduce((sum, p) => sum + p.amount, 0);
  if (totalPaid >= tx.amount) {
    tx.paymentStatus = "paid";
  } else if (totalPaid > 0) {
    tx.paymentStatus = "partially_paid";
  } else {
    tx.paymentStatus = "unpaid";
  }
  
  // Adjust bank account balance
  if (resolvedAccId) {
    const acc = db.accounts.find(a => a.id === resolvedAccId);
    if (acc) {
      if (tx.type === "income") {
        acc.balance += payNum;
      } else {
        acc.balance -= payNum;
      }
    }
  }

  // Deduct from contact creditor balance when paying an expense invoice
  if (tx.personName && db.contacts && tx.type === "expense") {
    const contact = db.contacts.find(c => c.name.trim() === tx.personName.trim());
    if (contact) {
      contact.balance = Math.max(0, (contact.balance || 0) - payNum);
    }
  }

  // Trigger recalculation for all pre-sales to keep installments in sync
  if (db.preSales && db.preSaleInstallments) {
    db.preSales.forEach(ps => {
      recalculatePreSaleInstallments(db, ps.id);
    });
  }
  
  writeDb(db);
  res.json({ status: "success", transaction: tx });
});

// 6c. Delete Transaction
app.post("/api/transactions/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    const idx = db.transactions.findIndex(t => t.id === id);
    if (idx >= 0) {
      const tx = db.transactions[idx];
      // Revert account balance logic
      if (!tx.isNonCash) {
        if (tx.payments && tx.payments.length > 0) {
          tx.payments.forEach(p => {
            const acc = db.accounts.find(a => a.id === p.accountId);
            if (acc) {
              if (tx.type === "expense") {
                acc.balance += p.amount; // Give back money
              } else {
                acc.balance -= p.amount; // Take away money
              }
            }
          });
        } else if (tx.paymentStatus !== "unpaid" && tx.accountId) {
          const acc = db.accounts.find(a => a.id === tx.accountId);
          if (acc) {
            if (tx.type === "expense") {
              acc.balance += tx.amount;
            } else {
              acc.balance -= tx.amount;
            }
          }
        }
      }

      // Revert contact balance logic
      if (tx.personName && db.contacts) {
        const contact = db.contacts.find(c => c.name.trim() === tx.personName.trim());
        if (contact) {
          if (tx.type === "expense" && !tx.isNonCash) {
            const unpaidAmt = Math.max(0, tx.amount - getTxPaidAmount(tx));
            if (unpaidAmt > 0) {
              contact.balance = (contact.balance || 0) - unpaidAmt;
            }
          } else if (tx.type === "income" && contact.role === "pre_buyer") {
            contact.balance = (contact.balance || 0) + tx.amount;
          }
        }
      }
      
      // Delete from pre-sales triggers recalculation
      db.transactions.splice(idx, 1);
      
      if (db.preSales && db.preSaleInstallments) {
        db.preSales.forEach(ps => {
          recalculatePreSaleInstallments(db, ps.id);
        });
      }
      
      writeDb(db);
      res.json({ status: "success", message: "تراکنش با موفقیت حذف گردید" });
    } else {
      res.status(404).json({ error: "تراکنش یافت نشد" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف تراکنش: " + err.message });
  }
});

// Helper to recalculate weighted average price of a material from its "in" transactions
function recalculateMaterialAveragePrice(db: DatabaseSchema, mat: Material) {
  const inTxs = (db.materialTransactions || []).filter(mt => mt.materialId === mat.id && mt.type === "in");
  if (inTxs.length > 0) {
    const totalQty = inTxs.reduce((s, t) => s + Number(t.quantity || 0), 0);
    const totalVal = inTxs.reduce((s, t) => s + (Number(t.quantity || 0) * Number(t.unitPrice || 0)), 0);
    if (totalQty > 0) {
      mat.averagePrice = Math.round(totalVal / totalQty);
    }
  } else if (mat.purchasePrice) {
    mat.averagePrice = mat.purchasePrice;
  }
}

// 7. Add Material or Warehouse Transaction
app.post("/api/materials", (req, res) => {
  const db = readDb();
  const isTransaction = !!req.body.projectId;

  if (isTransaction) {
    const txId = req.body.id || "mt_" + Date.now();
    const existingIdx = db.materialTransactions.findIndex(mt => mt.id === txId);
    
    // If it exists, revert its old effect on stock before applying new details
    if (existingIdx >= 0) {
      const oldTx = db.materialTransactions[existingIdx];
      const oldMat = db.materials.find(m => m.id === oldTx.materialId);
      if (oldMat) {
        if (oldTx.type === "in") {
          oldMat.stock = Math.max(0, oldMat.stock - oldTx.quantity);
        } else {
          oldMat.stock += oldTx.quantity;
        }
      }
    }
    
    // Warehouse log
    const tx: MaterialTransaction = {
      id: txId,
      projectId: req.body.projectId,
      materialId: req.body.materialId,
      type: req.body.type, // in / out
      quantity: Number(req.body.quantity || 0),
      unitPrice: Number(req.body.unitPrice || 0),
      date: req.body.date || getTodayShamsiServer(),
      personName: req.body.personName || "انباردار",
      description: req.body.description || ""
    };

    // Update material stocks with new details
    const mat = db.materials.find(m => m.id === tx.materialId);
    if (mat) {
      if (tx.type === "in") {
        const totalValue = (mat.stock * mat.averagePrice) + (tx.quantity * tx.unitPrice);
        mat.stock += tx.quantity;
        mat.averagePrice = mat.stock > 0 ? Math.round(totalValue / mat.stock) : mat.averagePrice;
      } else {
        mat.stock = Math.max(0, mat.stock - tx.quantity);
      }
    }

    if (existingIdx >= 0) {
      db.materialTransactions[existingIdx] = tx;
      if (mat) recalculateMaterialAveragePrice(db, mat);
    } else {
      db.materialTransactions.push(tx);
    }
    
    writeDb(db);
    res.json({ status: "success", transaction: tx, material: mat });
  } else {
    // Creating/updating material itself
    const newMat: Material = {
      id: req.body.id || "m_" + Date.now(),
      name: req.body.name,
      category: req.body.category || "عمومی",
      unit: req.body.unit || "عدد",
      stock: Number(req.body.stock || 0),
      averagePrice: Number(req.body.averagePrice || 0),
      code: req.body.code || undefined,
      subCategory: req.body.subCategory || undefined,
      secondaryUnit: req.body.secondaryUnit || undefined,
      conversionFactor: req.body.conversionFactor ? Number(req.body.conversionFactor) : undefined,
      consumptionType: req.body.consumptionType || undefined,
      minStock: req.body.minStock ? Number(req.body.minStock) : undefined,
      purchasePrice: req.body.purchasePrice ? Number(req.body.purchasePrice) : undefined,
      projectId: req.body.projectId || undefined
    };

    const idx = db.materials.findIndex(m => m.id === newMat.id);
    if (idx >= 0) {
      db.materials[idx] = newMat;
    } else {
      db.materials.push(newMat);
    }

    writeDb(db);
    res.json({ status: "success", material: newMat });
  }
});

// 7b. Delete Material or Warehouse Transaction
app.post("/api/materials/delete", (req, res) => {
  try {
    const db = readDb();
    const { id, isTransaction } = req.body;
    
    if (isTransaction) {
      const idx = db.materialTransactions.findIndex(mt => mt.id === id);
      if (idx >= 0) {
        const tx = db.materialTransactions[idx];
        // Revert material stocks
        const mat = db.materials.find(m => m.id === tx.materialId);
        db.materialTransactions.splice(idx, 1);
        if (mat) {
          if (tx.type === "in") {
            mat.stock = Math.max(0, mat.stock - tx.quantity);
            recalculateMaterialAveragePrice(db, mat);
          } else {
            mat.stock += tx.quantity;
          }
        }
        writeDb(db);
        res.json({ status: "success", message: "تراکنش انبار با موفقیت حذف شد" });
      } else {
        res.status(404).json({ error: "تراکنش انبار یافت نشد" });
      }
    } else {
      const idx = db.materials.findIndex(m => m.id === id);
      if (idx >= 0) {
        db.materials.splice(idx, 1);
        // Also remove related transactions
        db.materialTransactions = db.materialTransactions.filter(mt => mt.materialId !== id);
        writeDb(db);
        res.json({ status: "success", message: "کالای انبار به همراه تمامی تراکنش‌های مربوطه با موفقیت حذف شد" });
      } else {
        res.status(404).json({ error: "کالای انبار یافت نشد" });
      }
    }
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف از انبار: " + err.message });
  }
});

// 8. Add/Update Check
app.post("/api/checks", (req, res) => {
  const db = readDb();
  const checkId = req.body.id;

  if (checkId) {
    // Updating existing check
    const idx = db.checks.findIndex(ch => ch.id === checkId);
    if (idx >= 0) {
      const oldStatus = db.checks[idx].status;
      const newStatus = req.body.status || db.checks[idx].status;

      // Update fields
      db.checks[idx] = {
        ...db.checks[idx],
        checkNumber: req.body.checkNumber !== undefined ? req.body.checkNumber : db.checks[idx].checkNumber,
        bankName: req.body.bankName !== undefined ? req.body.bankName : db.checks[idx].bankName,
        dueDate: req.body.dueDate !== undefined ? req.body.dueDate : db.checks[idx].dueDate,
        amount: req.body.amount !== undefined ? Number(req.body.amount) : db.checks[idx].amount,
        type: req.body.type !== undefined ? req.body.type : db.checks[idx].type,
        status: newStatus,
        personName: req.body.personName !== undefined ? req.body.personName : db.checks[idx].personName,
        description: req.body.description !== undefined ? req.body.description : db.checks[idx].description,
        projectId: req.body.projectId !== undefined ? req.body.projectId : db.checks[idx].projectId,
        companyId: req.body.companyId !== undefined ? req.body.companyId : db.checks[idx].companyId
      };

      // If a check is passed (cleared), register a real transaction to deduct or add to bank account!
      if (oldStatus !== "passed" && newStatus === "passed") {
        const check = db.checks[idx];
        const transaction: Transaction = {
          id: "t_ch_" + Date.now(),
          companyId: check.companyId,
          projectId: check.projectId,
          type: check.type === "outgoing" ? "expense" : "income",
          category: "پاس شدن چک",
          amount: check.amount,
          accountId: req.body.accountId || "a1", // Chosen bank account
          personName: check.personName,
          date: req.body.clearanceDate || check.dueDate,
          description: `وصول خودکار چک شماره ${check.checkNumber} عهده بانک ${check.bankName} - بابت: ${check.description}`,
          isNonCash: false
        };

        // Deduct/add balance
        const acc = db.accounts.find(a => a.id === transaction.accountId);
        if (acc) {
          if (transaction.type === "expense") {
            acc.balance -= transaction.amount;
          } else {
            acc.balance += transaction.amount;
          }
        }
        db.transactions.push(transaction);
      }

      writeDb(db);
      res.json({ status: "success", check: db.checks[idx] });
    } else {
      res.status(404).json({ error: "چک پیدا نشد" });
    }
  } else {
    // Adding new check
    const newCheck: CheckItem = {
      id: "ch_" + Date.now(),
      companyId: req.body.companyId || "c1",
      projectId: req.body.projectId,
      checkNumber: req.body.checkNumber,
      bankName: req.body.bankName,
      dueDate: req.body.dueDate,
      amount: Number(req.body.amount || 0),
      type: req.body.type, // incoming / outgoing
      status: req.body.status || "pending",
      personName: req.body.personName,
      description: req.body.description || ""
    };

    db.checks.push(newCheck);
    writeDb(db);
    res.json({ status: "success", check: newCheck });
  }
});

// 8b. Delete Check
app.post("/api/checks/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    const idx = db.checks.findIndex(ch => ch.id === id);
    if (idx >= 0) {
      const check = db.checks[idx];
      // If check was already cleared/passed, revert its bank balance impact and remove auto-generated transaction
      if (check.status === "passed") {
        const txIdx = db.transactions.findIndex(t =>
          t.category === "پاس شدن چک" &&
          t.amount === check.amount &&
          t.description.includes(check.checkNumber)
        );
        if (txIdx >= 0) {
          const tx = db.transactions[txIdx];
          const acc = db.accounts.find(a => a.id === tx.accountId);
          if (acc) {
            if (tx.type === "expense") acc.balance += tx.amount;
            else acc.balance -= tx.amount;
          }
          db.transactions.splice(txIdx, 1);
        }
      }
      db.checks.splice(idx, 1);
      writeDb(db);
      res.json({ status: "success", message: "چک با موفقیت حذف شد" });
    } else {
      res.status(404).json({ error: "چک یافت نشد" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف چک: " + err.message });
  }
});

// 9. Add Unit or Unit Expenses (Pre-sale, barter)
app.post("/api/units", (req, res) => {
  const db = readDb();
  const unitId = req.body.id;

  const idx = db.units.findIndex(u => u.id === unitId);
  if (idx >= 0) {
    const unitCompanyId = getProjectCompanyId(db, db.units[idx].projectId);
    // If we're adding a specific expense to this unit
    if (req.body.addExpense || req.body.expenseTitle) {
      const rawExp = req.body.addExpense || {
        title: req.body.expenseTitle,
        amount: req.body.expenseAmount,
        date: req.body.expenseDate,
        accountId: req.body.accountId
      };
      const expenseItem = {
        id: "se_" + Date.now(),
        title: rawExp.title,
        amount: Number(rawExp.amount),
        date: rawExp.date || getTodayShamsiServer()
      };
      db.units[idx].specificExpenses.push(expenseItem);

      const accountId = rawExp.accountId || db.accounts[0]?.id || "a2";
      // Also log as an expense in transaction logs
      const tx: Transaction = {
        id: "t_unit_exp_" + Date.now(),
        companyId: unitCompanyId,
        projectId: db.units[idx].projectId,
        type: "expense",
        category: "هزینه اختصاصی واحد " + db.units[idx].unitNumber,
        amount: expenseItem.amount,
        accountId,
        personName: db.units[idx].buyerName || "کارفرما",
        date: expenseItem.date,
        description: `هزینه ساخت سفارشی برای واحد ${db.units[idx].unitNumber}: ${expenseItem.title}`,
        isNonCash: false,
        paymentStatus: "paid",
        payments: [{
          id: "p_uexp_" + Date.now(),
          amount: expenseItem.amount,
          date: expenseItem.date,
          accountId,
          description: expenseItem.title
        }]
      };
      const acc = db.accounts.find(a => a.id === accountId);
      if (acc) {
        acc.balance -= expenseItem.amount;
      }
      db.transactions.push(tx);
    } else {
      const prevStatus = db.units[idx].status;
      const saleAreaType = req.body.saleAreaType !== undefined ? req.body.saleAreaType : (db.units[idx].saleAreaType || "useful");
      const usefulArea = req.body.usefulArea !== undefined ? Number(req.body.usefulArea) : (db.units[idx].usefulArea ?? db.units[idx].area ?? 0);
      const storageArea = req.body.storageArea !== undefined ? Number(req.body.storageArea) : (db.units[idx].storageArea ?? 0);
      const parkingArea = req.body.parkingArea !== undefined ? Number(req.body.parkingArea) : (db.units[idx].parkingArea ?? 0);
      const commonArea = saleAreaType === "with_commons"
        ? (req.body.commonArea !== undefined ? Number(req.body.commonArea) : (db.units[idx].commonArea ?? 0))
        : 0;

      const hasBreakdownProvided =
        req.body.usefulArea !== undefined ||
        req.body.storageArea !== undefined ||
        req.body.parkingArea !== undefined ||
        req.body.commonArea !== undefined ||
        req.body.saleAreaType !== undefined;

      const computedBreakdownSum = Number((usefulArea + storageArea + parkingArea + commonArea).toFixed(2));
      const nextArea = req.body.area !== undefined
        ? Number(req.body.area)
        : (hasBreakdownProvided ? computedBreakdownSum : db.units[idx].area);
      const nextPrice = req.body.pricePerMeter !== undefined ? Number(req.body.pricePerMeter) : db.units[idx].pricePerMeter;

      const updatedUnit: UnitItem = {
        ...db.units[idx],
        ...req.body,
        unitNumber: req.body.unitNumber !== undefined ? String(req.body.unitNumber) : db.units[idx].unitNumber,
        blockName: req.body.blockName !== undefined ? String(req.body.blockName) : db.units[idx].blockName,
        floor: req.body.floor !== undefined ? String(req.body.floor) : db.units[idx].floor,
        saleAreaType,
        usefulArea: req.body.usefulArea !== undefined ? Number(req.body.usefulArea) : (req.body.area !== undefined && !hasBreakdownProvided ? Number(req.body.area) : usefulArea),
        storageArea,
        parkingArea,
        commonArea,
        area: nextArea,
        pricePerMeter: nextPrice,
        totalPrice: Math.round(nextArea * nextPrice)
      };
      db.units[idx] = updatedUnit;

      // Sync with any linked PreSale contract for this unit
      if (db.preSales) {
        const linkedPs = db.preSales.find(ps => ps.unitId === unitId);
        if (linkedPs) {
          const oldTotalPrice = linkedPs.totalPrice;
          linkedPs.blockName = updatedUnit.blockName;
          linkedPs.saleAreaType = updatedUnit.saleAreaType;
          linkedPs.usefulArea = updatedUnit.usefulArea;
          linkedPs.storageArea = updatedUnit.storageArea;
          linkedPs.parkingArea = updatedUnit.parkingArea;
          linkedPs.commonArea = updatedUnit.commonArea;
          linkedPs.contractArea = updatedUnit.area;
          linkedPs.pricePerMeter = updatedUnit.pricePerMeter;
          linkedPs.totalPrice = updatedUnit.totalPrice;

          const priceDiff = linkedPs.totalPrice - oldTotalPrice;
          if (priceDiff !== 0) {
            const installments = (db.preSaleInstallments || []).filter(i => i.preSaleId === linkedPs.id);
            if (installments.length > 0) {
              const lastInst = installments[installments.length - 1];
              lastInst.amount = Math.max(0, lastInst.amount + priceDiff);
            }
            const buyer = (db.contacts || []).find(c => c.id === linkedPs.contactId);
            if (buyer) {
              buyer.balance = Math.max(0, (buyer.balance || 0) + priceDiff);
            }
            recalculatePreSaleInstallments(db, linkedPs.id);
          }
        }
      }

      // Sync with any contact barterUnits referencing this unit
      if (db.contacts) {
        db.contacts.forEach(c => {
          if (c.barterUnits && c.barterUnits.length > 0) {
            c.barterUnits.forEach(bu => {
              if (bu.unitId === unitId) {
                bu.blockName = updatedUnit.blockName;
                bu.saleAreaType = updatedUnit.saleAreaType;
                bu.usefulArea = updatedUnit.usefulArea;
                bu.storageArea = updatedUnit.storageArea;
                bu.parkingArea = updatedUnit.parkingArea;
                bu.commonArea = updatedUnit.commonArea;
                bu.area = updatedUnit.area;
                bu.price = updatedUnit.pricePerMeter;
              }
            });
          }
        });
      }

      // Only register sale/barter transaction if status newly changed to pre_sold/sold/bartered
      if (req.body.status && prevStatus !== req.body.status) {
        if ((req.body.status === "pre_sold" || req.body.status === "sold") && Number(req.body.downPayment || 0) > 0) {
          const downPayment = Number(req.body.downPayment || 0);
          const accountId = req.body.accountId || db.accounts[0]?.id || "a1";
          const txDate = req.body.date || getTodayShamsiServer();
          const tx: Transaction = {
            id: "t_sale_" + Date.now(),
            companyId: unitCompanyId,
            projectId: db.units[idx].projectId,
            type: "income",
            category: req.body.status === "pre_sold" ? "پیش‌فروش" : "فروش واحد",
            amount: downPayment,
            accountId,
            personName: req.body.buyerName || "خریدار واحد",
            date: txDate,
            description: `پیش‌دریافت بابت فروش واحد شماره ${db.units[idx].unitNumber} به مساحت ${db.units[idx].area} مترمربع`,
            isNonCash: false,
            paymentStatus: "paid",
            payments: [{
              id: "p_sale_" + Date.now(),
              amount: downPayment,
              date: txDate,
              accountId
            }]
          };
          const acc = db.accounts.find(a => a.id === accountId);
          if (acc) {
            acc.balance += downPayment;
          }
          db.transactions.push(tx);
        } else if (req.body.status === "bartered") {
          const tx: Transaction = {
            id: "t_barter_" + Date.now(),
            companyId: unitCompanyId,
            projectId: db.units[idx].projectId,
            type: "income",
            category: "تهاتر",
            amount: Number(db.units[idx].totalPrice),
            accountId: db.accounts[0]?.id || "a1",
            personName: req.body.buyerName || "طرف تهاتر",
            date: req.body.date || getTodayShamsiServer(),
            description: `تهاتر کامل واحد شماره ${db.units[idx].unitNumber} بابت: ${req.body.barterProperty || "تهاتر مصالح/خدمات"}`,
            isNonCash: true,
            barterDetails: {
              propertyType: "ملک/تهاتر",
              description: req.body.barterProperty || "",
              agreedValue: db.units[idx].totalPrice
            }
          };
          db.transactions.push(tx);
        }
      }
    }

    writeDb(db);
    res.json({ status: "success", unit: db.units[idx] });
  } else {
    // Add new unit
    const saleAreaType = req.body.saleAreaType || "useful";
    const usefulArea = Number(req.body.usefulArea ?? req.body.area ?? 0);
    const storageArea = Number(req.body.storageArea || 0);
    const parkingArea = Number(req.body.parkingArea || 0);
    const commonArea = saleAreaType === "with_commons" ? Number(req.body.commonArea || 0) : 0;
    const areaVal = req.body.area !== undefined ? Number(req.body.area) : Number((usefulArea + storageArea + parkingArea + commonArea).toFixed(2));
    const priceVal = Number(req.body.pricePerMeter || 0);

    const newUnit: UnitItem = {
      id: "u_" + (req.body.projectId || "p1") + "_" + (req.body.unitNumber || Date.now()),
      projectId: req.body.projectId || "p1",
      unitNumber: req.body.unitNumber,
      blockName: req.body.blockName || "",
      floor: req.body.floor || "اول",
      saleAreaType,
      usefulArea,
      storageArea,
      parkingArea,
      commonArea,
      area: areaVal,
      pricePerMeter: priceVal,
      totalPrice: Math.round(areaVal * priceVal),
      status: req.body.status || "available",
      buyerName: req.body.buyerName,
      downPayment: Number(req.body.downPayment || 0),
      barterProperty: req.body.barterProperty,
      specificExpenses: []
    };

    db.units.push(newUnit);
    writeDb(db);
    res.json({ status: "success", unit: newUnit });
  }
});

app.post("/api/units/delete", (req, res) => {
  const db = readDb();
  const { id } = req.body;
  if (!db.units) db.units = [];
  const idx = db.units.findIndex(u => u.id === id);
  if (idx >= 0) {
    db.units[idx].isDeleted = true;
    db.units[idx].deletedAt = new Date().toISOString();
  }
  writeDb(db);
  res.json({ status: "success" });
});

app.post("/api/units/restore", (req, res) => {
  const db = readDb();
  const { id } = req.body;
  if (!db.units) db.units = [];
  const idx = db.units.findIndex(u => u.id === id);
  if (idx >= 0) {
    db.units[idx].isDeleted = false;
  }
  writeDb(db);
  res.json({ status: "success" });
});

app.post("/api/projects/delete", (req, res) => {
  const db = readDb();
  const { id } = req.body;
  if (!db.projects) db.projects = [];
  const idx = db.projects.findIndex(p => p.id === id);
  if (idx >= 0) {
    // Soft-delete the project and its units so that restoring the project preserves all financial history and balances
    db.projects[idx].isDeleted = true;
    db.projects[idx].deletedAt = new Date().toISOString();
    if (db.units) {
      db.units.forEach(u => {
        if (u.projectId === id) {
          u.isDeleted = true;
          u.deletedAt = new Date().toISOString();
        }
      });
    }
  }
  writeDb(db);
  res.json({ status: "success", message: "پروژه به سطل زباله منتقل شد و در صورت نیاز قابل بازیابی است" });
});

app.post("/api/projects/restore", (req, res) => {
  const db = readDb();
  const { id } = req.body;
  if (!db.projects) db.projects = [];
  const idx = db.projects.findIndex(p => p.id === id);
  if (idx >= 0) {
    db.projects[idx].isDeleted = false;
    if (db.units) {
      db.units.forEach(u => {
        if (u.projectId === id) {
          u.isDeleted = false;
        }
      });
    }
  }
  writeDb(db);
  res.json({ status: "success" });
});

app.post("/api/units/batch", (req, res) => {
  const db = readDb();
  const { projectId, units } = req.body;
  if (!db.units) db.units = [];
  
  units.forEach((newU: any) => {
    const uItem = {
      id: newU.id || "u_" + projectId + "_" + newU.unitNumber + "_" + Math.floor(Math.random() * 100),
      projectId: projectId,
      unitNumber: newU.unitNumber,
      floor: String(newU.floor),
      area: Number(newU.area || 0),
      pricePerMeter: Number(newU.pricePerMeter || 0),
      totalPrice: Number(newU.area || 0) * Number(newU.pricePerMeter || 0),
      status: newU.status || "available",
      buyerName: newU.buyerName,
      downPayment: Number(newU.downPayment || 0),
      barterProperty: newU.barterProperty,
      specificExpenses: newU.specificExpenses || []
    };
    const idx = db.units.findIndex(u => u.id === uItem.id || (u.projectId === projectId && u.unitNumber === uItem.unitNumber));
    if (idx >= 0) {
      db.units[idx] = {
        ...db.units[idx],
        ...uItem,
        status: db.units[idx].status !== "available" ? db.units[idx].status : uItem.status,
        buyerName: db.units[idx].buyerName || uItem.buyerName,
        downPayment: db.units[idx].downPayment || uItem.downPayment,
        barterProperty: db.units[idx].barterProperty || uItem.barterProperty
      };
    } else {
      db.units.push(uItem);
    }
  });
  
  writeDb(db);
  res.json({ status: "success" });
});

// 9b. Add/Update Contact
app.post("/api/contacts", (req, res) => {
  const db = readDb();
  const contact = req.body;
  const id = contact.id || "co_" + Date.now();
  const todayShamsi = getTodayShamsiServer();

  const newContact: Contact = {
    id,
    name: contact.name,
    phone: contact.phone || "",
    role: contact.role || "pre_buyer",
    roleName: contact.roleName,
    roles: contact.roles || [],
    nationalId: contact.nationalId,
    bankCardNumber: contact.bankCardNumber,
    bankName: contact.bankName,
    bankIBAN: contact.bankIBAN,
    jobCategory: contact.jobCategory,
    paymentMethod: contact.paymentMethod || "cash",
    barterUnits: contact.barterUnits || [],
    balance: Number(contact.balance || 0),
    createdAt: contact.createdAt || todayShamsi,
    projectId: contact.projectId
  };

  // If this is a barter contact, check if we need to auto-create/update pre-sale contract and unit details
  if (newContact.paymentMethod === "barter" && newContact.barterUnits && newContact.barterUnits.length > 0) {
    newContact.barterUnits.forEach((bu: any) => {
      if (!db.preSales) db.preSales = [];
      const saleAreaType = bu.saleAreaType || "useful";
      const usefulArea = Number(bu.usefulArea ?? bu.area ?? 0);
      const storageArea = Number(bu.storageArea || 0);
      const parkingArea = Number(bu.parkingArea || 0);
      const commonArea = saleAreaType === "with_commons" ? Number(bu.commonArea || 0) : 0;
      const totalArea = Number(bu.area || (usefulArea + storageArea + parkingArea + commonArea) || 0);
      const pricePerMeter = Number(bu.price || 0);
      const totalP = Math.round(totalArea * pricePerMeter);

      // Update the unit in db.units as "bartered" with full area breakdown & block
      if (!db.units) db.units = [];
      const unitIdx = db.units.findIndex(u => u.id === bu.unitId);
      if (unitIdx >= 0) {
        db.units[unitIdx].status = "bartered";
        db.units[unitIdx].buyerName = newContact.name;
        db.units[unitIdx].contactId = id;
        if (bu.blockName !== undefined) db.units[unitIdx].blockName = bu.blockName;
        db.units[unitIdx].saleAreaType = saleAreaType;
        db.units[unitIdx].usefulArea = usefulArea;
        db.units[unitIdx].storageArea = storageArea;
        db.units[unitIdx].parkingArea = parkingArea;
        db.units[unitIdx].commonArea = commonArea;
        if (totalArea > 0) db.units[unitIdx].area = totalArea;
        if (pricePerMeter > 0) db.units[unitIdx].pricePerMeter = pricePerMeter;
        db.units[unitIdx].totalPrice = totalP;
      }

      const existingPreSale = db.preSales.find(ps => ps.contactId === id && ps.unitId === bu.unitId);
      if (!existingPreSale) {
        const preSaleId = "ps_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        const newPreSale: PreSale = {
          id: preSaleId,
          projectId: newContact.projectId || (unitIdx >= 0 ? db.units[unitIdx].projectId : "p1"),
          contactId: id,
          unitId: bu.unitId,
          blockName: bu.blockName || (unitIdx >= 0 ? db.units[unitIdx].blockName : ""),
          saleAreaType,
          usefulArea,
          storageArea,
          parkingArea,
          commonArea,
          contractArea: totalArea,
          pricePerMeter,
          totalPrice: totalP,
          contractDate: newContact.createdAt || todayShamsi,
          status: "active"
        };
        db.preSales.push(newPreSale);
        if (unitIdx >= 0) {
          db.units[unitIdx].contractId = preSaleId;
        }

        // Create default installments (100% of the price as single installment)
        if (!db.preSaleInstallments) db.preSaleInstallments = [];
        db.preSaleInstallments.push({
          id: "inst_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          preSaleId: preSaleId,
          installmentName: "مبلغ کل تهاتر واحد مسکونی",
          dueDate: newContact.createdAt || todayShamsi,
          amount: totalP,
          isPaid: false
        });
      } else {
        existingPreSale.blockName = bu.blockName || existingPreSale.blockName;
        existingPreSale.saleAreaType = saleAreaType;
        existingPreSale.usefulArea = usefulArea;
        existingPreSale.storageArea = storageArea;
        existingPreSale.parkingArea = parkingArea;
        existingPreSale.commonArea = commonArea;
        existingPreSale.contractArea = totalArea;
        existingPreSale.pricePerMeter = pricePerMeter;
        existingPreSale.totalPrice = totalP;
      }
    });
  }

  const idx = db.contacts.findIndex(c => c.id === id);
  if (idx >= 0) {
    db.contacts[idx] = newContact;
  } else {
    db.contacts.push(newContact);
  }

  writeDb(db);
  res.json({ status: "success", contact: newContact });
});

// Delete Contact
app.post("/api/contacts/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "شناسه طرف حساب وارد نشده است" });
    }
    
    // Cascading deletion
    // 1. Filter out the contact
    db.contacts = db.contacts.filter((c: any) => c.id !== id);
    
    // 2. Clear preSales and update corresponding units
    if (db.preSales) {
      const psIds = db.preSales.filter((ps: any) => ps.contactId === id).map((ps: any) => ps.id);
      const unitIdsToFree = db.preSales.filter((ps: any) => ps.contactId === id).map((ps: any) => ps.unitId);
      db.preSales = db.preSales.filter((ps: any) => ps.contactId !== id);
      
      // Clear installments
      if (db.preSaleInstallments) {
        db.preSaleInstallments = db.preSaleInstallments.filter((inst: any) => !psIds.includes(inst.preSaleId));
      }
      
      // Update units status back to 'available' and remove buyerName
      if (db.units) {
        db.units.forEach((u: any) => {
          if (unitIdsToFree.includes(u.id)) {
            const isPreSold = db.preSales.some((ps: any) => ps.unitId === u.id);
            if (!isPreSold && u.status !== "available") {
              u.status = "available";
              u.buyerName = undefined;
              u.downPayment = undefined;
            }
          }
        });
      }
    }
    
    // 3. Clear imprestFunds and their expenses
    if (db.imprestFunds) {
      const impIds = db.imprestFunds.filter((f: any) => f.contactId === id).map((f: any) => f.id);
      db.imprestFunds = db.imprestFunds.filter((f: any) => f.contactId !== id);
      if (db.imprestExpenses) {
        db.imprestExpenses = db.imprestExpenses.filter((e: any) => !impIds.includes(e.imprestId));
      }
    }
    
    writeDb(db);
    res.json({ status: "success", message: "طرف حساب با موفقیت حذف شد" });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف طرف حساب: " + err.message });
  }
});

// --- User Management API Endpoints ---
app.post("/api/users", (req, res) => {
  const db = readDb();
  const user = req.body;
  const id = user.id || "u_" + Date.now();

  const newUser: any = {
    id,
    name: user.name,
    role: user.role || "supervisor",
    roleName: user.roleName || "ناظر پروژه",
    username: user.username ? user.username.trim() : "",
    password: user.password ? user.password.trim() : "",
    permissions: Array.isArray(user.permissions) ? user.permissions : []
  };

  if (!db.users) db.users = [];
  const idx = db.users.findIndex(u => u.id === id);
  if (idx >= 0) {
    db.users[idx] = newUser;
  } else {
    db.users.push(newUser);
  }

  writeDb(db);
  res.json({ status: "success", user: newUser });
});

app.post("/api/users/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    if (!id) {
      return res.status(400).json({ error: "شناسه کاربر وارد نشده است" });
    }
    
    if (!db.users) db.users = [];
    db.users = db.users.filter((u: any) => u.id !== id);
    
    writeDb(db);
    res.json({ status: "success", message: "کاربر با موفقیت حذف شد" });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف کاربر: " + err.message });
  }
});

// 9c. Add/Update Imprest Fund
app.post("/api/imprests", (req, res) => {
  const db = readDb();
  const fund = req.body;
  const id = fund.id || "im_" + Date.now();
  const todayShamsi = getTodayShamsiServer();
  const idx = db.imprestFunds.findIndex(f => f.id === id);

  let computedBalance = Number(fund.balance !== undefined ? fund.balance : fund.allocatedLimit || 0);
  if (idx >= 0 && fund.balance === undefined && fund.allocatedLimit !== undefined) {
    const diff = Number(fund.allocatedLimit) - db.imprestFunds[idx].allocatedLimit;
    computedBalance = Math.max(0, db.imprestFunds[idx].balance + diff);
  }

  const newFund: ImprestFund = {
    id,
    projectId: fund.projectId,
    contactId: fund.contactId,
    allocatedLimit: Number(fund.allocatedLimit || 0),
    balance: computedBalance,
    status: fund.status || "active",
    lastReconciliationDate: fund.lastReconciliationDate || todayShamsi,
    createdAt: fund.createdAt || (idx >= 0 ? db.imprestFunds[idx].createdAt : todayShamsi)
  };

  if (idx >= 0) {
    db.imprestFunds[idx] = newFund;
  } else {
    db.imprestFunds.push(newFund);
  }

  writeDb(db);
  res.json({ status: "success", imprestFund: newFund });
});

// 9d. Record Imprest Expense
app.post("/api/imprests/expenses", (req, res) => {
  const db = readDb();
  const exp = req.body;
  const id = exp.id || "ie_" + Date.now();
  const todayShamsi = getTodayShamsiServer();

  // Find associated fund
  const fundIdx = db.imprestFunds.findIndex(f => f.id === exp.imprestId);
  if (fundIdx < 0) {
    return res.status(404).json({ error: "تنخواه‌گردان یافت نشد" });
  }

  const fund = db.imprestFunds[fundIdx];
  if (fund.status === "locked") {
    return res.status(400).json({ error: "تنخواه‌گردان به علت عدم تسویه حساب یا سقف بدهی قفل شده است" });
  }

  const amount = Number(exp.amount || 0);
  const paymentStatus = exp.paymentStatus || "paid";
  let paidAmount = 0;
  if (paymentStatus === "paid") {
    paidAmount = amount;
  } else if (paymentStatus === "partially_paid") {
    paidAmount = Number(exp.paidAmount || 0);
  }

  if (fund.balance < paidAmount) {
    return res.status(400).json({ error: `موجودی صندوق تنخواه کافی نیست. (موجودی فعلی: ${fund.balance.toLocaleString("fa-IR")} ریال)` });
  }

  const newExpense: ImprestExpense = {
    id,
    imprestId: exp.imprestId,
    expenseDate: exp.expenseDate || todayShamsi,
    amount,
    invoiceNumber: exp.invoiceNumber || "",
    description: exp.description,
    materialCategory: exp.materialCategory || "سایر",
    attachmentUrl: exp.attachmentUrl,
    status: exp.status || "approved",
    createdAt: todayShamsi,
    contactId: exp.contactId,
    personName: exp.personName,
    stage: exp.stage,
    paymentStatus,
    attachmentName: exp.attachmentName,
    attachmentData: exp.attachmentData,
    payments: []
  };

  if (paidAmount > 0) {
    newExpense.payments!.push({
      id: "p_" + Date.now(),
      amount: paidAmount,
      date: newExpense.expenseDate,
      accountId: "a3",
      referenceNumber: exp.referenceNumber || "تسویه تنخواه",
      invoiceNumber: exp.invoiceNumber || "",
      invoiceDescription: exp.description || "ثبت پرداخت فاکتور از صندوق تنخواه",
      description: exp.description || "ثبت پرداخت فاکتور از صندوق تنخواه"
    });
    fund.balance = Math.max(0, fund.balance - paidAmount);
  }

  const remainingAmount = amount - paidAmount;
  if (remainingAmount > 0 && exp.contactId) {
    const contactIdx = db.contacts.findIndex(c => c.id === exp.contactId);
    if (contactIdx >= 0) {
      db.contacts[contactIdx].balance = (db.contacts[contactIdx].balance || 0) + remainingAmount;
    }
  }

  db.imprestExpenses.push(newExpense);

  // Also record a standard transaction in the company ledger!
  const supervisorContact = db.contacts.find(c => c.id === fund.contactId);
  const ledgerTxId = "t_im_exp_" + id;
  const imprestAccId = "a3";
  const tx: Transaction = {
    id: ledgerTxId,
    companyId: getProjectCompanyId(db, fund.projectId),
    projectId: fund.projectId,
    type: "expense",
    category: "هزینه تنخواه",
    subCategory: `${newExpense.materialCategory} - ${newExpense.stage || "عمومی"}`,
    amount: newExpense.amount,
    accountId: imprestAccId,
    contactId: exp.contactId,
    personName: newExpense.personName || (supervisorContact ? supervisorContact.name : "تنخواه‌دار"),
    date: newExpense.expenseDate,
    description: `[هزینه تنخواه‌گردان] ${newExpense.description}`,
    isNonCash: false,
    attachmentName: exp.attachmentName,
    attachmentData: exp.attachmentData,
    paymentStatus: newExpense.paymentStatus,
    payments: newExpense.payments || []
  };
  db.transactions.push(tx);

  // Update the imprest account balance in db.accounts to stay synced
  if (paidAmount > 0) {
    const acc = db.accounts.find(a => a.id === imprestAccId);
    if (acc) {
      acc.balance -= paidAmount;
    }
  }

  writeDb(db);
  res.json({ status: "success", imprestExpense: newExpense, imprestFund: fund });
});

// 9d-1b. Delete Imprest Fund
app.post("/api/imprests/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    const idx = db.imprestFunds.findIndex(f => f.id === id);
    if (idx >= 0) {
      db.imprestFunds.splice(idx, 1);
      // Delete associated imprest expenses
      db.imprestExpenses = db.imprestExpenses.filter(ie => ie.imprestId !== id);
      writeDb(db);
      res.json({ status: "success", message: "تنخواه‌گردان با موفقیت حذف شد" });
    } else {
      res.status(404).json({ error: "تنخواه‌گردان یافت نشد" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف تنخواه‌گردان: " + err.message });
  }
});

// 9d-1c. Delete Imprest Expense
app.post("/api/imprests/expenses/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    const idx = db.imprestExpenses.findIndex(ie => ie.id === id);
    if (idx >= 0) {
      const expense = db.imprestExpenses[idx];
      const paidAmount = expense.payments ? expense.payments.reduce((sum, p) => sum + p.amount, 0) : (expense.paymentStatus === "paid" ? expense.amount : 0);
      const remainingUnpaid = Math.max(0, expense.amount - paidAmount);

      // 1. Refund the imprest fund balance if it was paid
      const fund = db.imprestFunds.find(f => f.id === expense.imprestId);
      if (fund) {
        fund.balance += paidAmount;
      }

      // 2. Revert vendor contact balance if it had an unpaid portion
      if (remainingUnpaid > 0 && expense.contactId) {
        const contact = db.contacts.find(c => c.id === expense.contactId);
        if (contact) {
          contact.balance = Math.max(0, (contact.balance || 0) - remainingUnpaid);
        }
      }

      // 3. Delete corresponding ledger transaction and refund account balance
      const txIdx = db.transactions.findIndex(t =>
        t.id === "t_im_exp_" + id ||
        (t.category === "هزینه تنخواه" && t.amount === expense.amount && t.description.includes(expense.description))
      );
      if (txIdx >= 0) {
        const tx = db.transactions[txIdx];
        const acc = db.accounts.find(a => a.id === tx.accountId);
        if (acc && paidAmount > 0) {
          acc.balance += paidAmount;
        }
        db.transactions.splice(txIdx, 1);
      }

      db.imprestExpenses.splice(idx, 1);
      writeDb(db);
      res.json({ status: "success", message: "هزینه تنخواه و سند مالی متناظر با موفقیت حذف شد" });
    } else {
      res.status(404).json({ error: "هزینه تنخواه یافت نشد" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف هزینه تنخواه: " + err.message });
  }
});

// 9d-2. Add installment / payment to existing Imprest Expense
app.post("/api/imprests/expenses/pay", (req, res) => {
  const db = readDb();
  const { expenseId, rowNumber, amount, date, referenceNumber, invoiceNumber, invoiceDescription, description } = req.body;

  const expense = db.imprestExpenses.find(ie => ie.id === expenseId);
  if (!expense) {
    return res.status(404).json({ error: "فاکتور تنخواه یافت نشد" });
  }

  const fund = db.imprestFunds.find(f => f.id === expense.imprestId);
  if (!fund) {
    return res.status(404).json({ error: "تنخواه‌گردان مربوطه یافت نشد" });
  }

  if (fund.status === "locked") {
    return res.status(400).json({ error: "تنخواه‌گردان قفل است" });
  }

  const payVal = Number(amount || 0);
  if (fund.balance < payVal) {
    return res.status(400).json({ error: `موجودی صندوق تنخواه کافی نیست. (موجودی فعلی: ${fund.balance.toLocaleString("fa-IR")} ریال)` });
  }

  if (!expense.payments) {
    expense.payments = [];
  }

  const newPayment: TransactionPayment = {
    id: "p_" + Date.now(),
    rowNumber: rowNumber !== undefined ? (Number(rowNumber) || rowNumber) : (expense.payments.length + 1),
    amount: payVal,
    date: date || expense.expenseDate,
    accountId: "a3",
    referenceNumber: referenceNumber || "",
    invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : (expense.invoiceNumber || ""),
    invoiceDescription: invoiceDescription !== undefined ? invoiceDescription : (description || expense.description || ""),
    description: description || invoiceDescription || ""
  };

  expense.payments.push(newPayment);
  fund.balance = Math.max(0, fund.balance - payVal);

  // Update paymentStatus
  const totalPaid = expense.payments.reduce((sum, p) => sum + p.amount, 0);
  if (totalPaid >= expense.amount) {
    expense.paymentStatus = "paid";
  } else {
    expense.paymentStatus = "partially_paid";
  }

  // Deduct from Vendor outstanding creditor balance
  if (expense.contactId) {
    const contactIdx = db.contacts.findIndex(c => c.id === expense.contactId);
    if (contactIdx >= 0) {
      db.contacts[contactIdx].balance = Math.max(0, (db.contacts[contactIdx].balance || 0) - payVal);
    }
  }

  // Synchronize with the corresponding ledger transaction if found
  const matchedTxIdx = db.transactions.findIndex(t =>
    t.id === "t_im_exp_" + expense.id ||
    (t.description && t.description.includes(expense.description) && t.amount === expense.amount)
  );
  if (matchedTxIdx >= 0) {
    db.transactions[matchedTxIdx].payments = expense.payments;
    db.transactions[matchedTxIdx].paymentStatus = expense.paymentStatus;
    const acc = db.accounts.find(a => a.id === db.transactions[matchedTxIdx].accountId);
    if (acc) {
      acc.balance -= payVal;
    }
  }

  writeDb(db);
  res.json({ status: "success", imprestExpense: expense, imprestFund: fund });
});

// 9e. Create Pre-Sale Contract
app.post("/api/presales", (req, res) => {
  const db = readDb();
  const presale = req.body;
  const id = "ps_" + Date.now();
  const contractDate = presale.contractDate || getTodayShamsiServer();
  const saleAreaType = presale.saleAreaType || "useful";
  const usefulArea = Number(presale.usefulArea ?? presale.contractArea ?? 0);
  const storageArea = Number(presale.storageArea || 0);
  const parkingArea = Number(presale.parkingArea || 0);
  const commonArea = saleAreaType === "with_commons" ? Number(presale.commonArea || 0) : 0;
  const computedArea = Number(presale.contractArea || (usefulArea + storageArea + parkingArea + commonArea) || 0);
  const pricePerMeter = Number(presale.pricePerMeter || 0);
  const totalPrice = Math.round(Number(presale.totalPrice || (computedArea * pricePerMeter)));

  const newPreSale: PreSale = {
    id,
    projectId: presale.projectId,
    contactId: presale.contactId,
    unitId: presale.unitId,
    blockName: presale.blockName || "",
    saleAreaType,
    usefulArea,
    storageArea,
    parkingArea,
    commonArea,
    contractArea: computedArea,
    pricePerMeter,
    totalPrice,
    contractDate,
    status: "active"
  };

  db.preSales.push(newPreSale);

  // Update associated unit status, block, area breakdown, and price
  const unitIdx = db.units.findIndex(u => u.id === presale.unitId);
  const buyer = db.contacts.find(c => c.id === presale.contactId);
  const downPaymentAmount = Math.round(totalPrice * 0.30);
  if (unitIdx >= 0) {
    db.units[unitIdx].status = "pre_sold";
    db.units[unitIdx].buyerName = buyer ? buyer.name : "پیش‌خریدار";
    db.units[unitIdx].contactId = presale.contactId;
    db.units[unitIdx].contractId = id;
    if (presale.blockName !== undefined) {
      db.units[unitIdx].blockName = presale.blockName;
    }
    db.units[unitIdx].saleAreaType = saleAreaType;
    db.units[unitIdx].usefulArea = usefulArea;
    db.units[unitIdx].storageArea = storageArea;
    db.units[unitIdx].parkingArea = parkingArea;
    db.units[unitIdx].commonArea = commonArea;
    db.units[unitIdx].area = computedArea;
    db.units[unitIdx].pricePerMeter = pricePerMeter;
    db.units[unitIdx].totalPrice = totalPrice;
    db.units[unitIdx].downPayment = downPaymentAmount; // 30% contract downpayment
  }

  // Generate 7-stage standard installment schedule summing to 100% of totalPrice
  const inst1 = downPaymentAmount; // 30%
  const inst2 = Math.round(totalPrice * 0.10); // 10%
  const inst3 = Math.round(totalPrice * 0.15); // 15%
  const inst4 = Math.round(totalPrice * 0.15); // 15%
  const inst5 = Math.round(totalPrice * 0.10); // 10%
  const inst6 = Math.round(totalPrice * 0.10); // 10%
  const inst7 = Math.max(0, totalPrice - (inst1 + inst2 + inst3 + inst4 + inst5 + inst6)); // 10% exact remainder

  const installments: PreSaleInstallment[] = [
    { id: "psi_1_" + Date.now(), preSaleId: id, installmentName: "پیش‌پرداخت (عقد قرارداد)", dueDate: contractDate, amount: inst1, isPaid: false },
    { id: "psi_2_" + Date.now(), preSaleId: id, installmentName: "پایان پی‌ریزی و فونداسیون", dueDate: addShamsiMonths(contractDate, 2), amount: inst2, isPaid: false },
    { id: "psi_3_" + Date.now(), preSaleId: id, installmentName: "پایان اسکلت و سازه", dueDate: addShamsiMonths(contractDate, 5), amount: inst3, isPaid: false },
    { id: "psi_4_" + Date.now(), preSaleId: id, installmentName: "پایان سفت‌کاری و دیوارچینی", dueDate: addShamsiMonths(contractDate, 8), amount: inst4, isPaid: false },
    { id: "psi_5_" + Date.now(), preSaleId: id, installmentName: "پایان نازک‌کاری و نصبیات", dueDate: addShamsiMonths(contractDate, 11), amount: inst5, isPaid: false },
    { id: "psi_6_" + Date.now(), preSaleId: id, installmentName: "تحویل فیزیکی واحد مسکونی", dueDate: addShamsiMonths(contractDate, 13), amount: inst6, isPaid: false },
    { id: "psi_7_" + Date.now(), preSaleId: id, installmentName: "تنظیم سند رسمی انتقال در دفترخانه", dueDate: addShamsiMonths(contractDate, 15), amount: inst7, isPaid: false }
  ];

  db.preSaleInstallments.push(...installments);

  const downAccountId = presale.accountId || db.accounts[0]?.id || "a1";
  // Also record downpayment transaction
  const tx: Transaction = {
    id: "t_ps_down_" + Date.now(),
    companyId: getProjectCompanyId(db, newPreSale.projectId),
    projectId: newPreSale.projectId,
    type: "income",
    category: "پیش‌فروش",
    amount: downPaymentAmount,
    accountId: downAccountId,
    contactId: presale.contactId,
    personName: buyer ? buyer.name : "پیش‌خریدار",
    date: contractDate,
    description: `پیش‌دریافت پیش‌پرداخت قرارداد پیش‌فروش واحد شماره ${db.units[unitIdx]?.unitNumber || ""}`,
    isNonCash: false,
    preSaleId: id,
    paymentStatus: "paid",
    payments: [{
      id: "p_ps_down_" + Date.now(),
      amount: downPaymentAmount,
      date: contractDate,
      accountId: downAccountId
    }]
  };
  db.transactions.push(tx);

  // Add downpayment to bank account balance
  const acc = db.accounts.find(a => a.id === downAccountId);
  if (acc) {
    acc.balance += downPaymentAmount;
  }

  // Update buyer contact balance (remaining unpaid contract amount)
  if (buyer) {
    buyer.balance = (buyer.balance || 0) + (totalPrice - downPaymentAmount);
  }

  // Recalculate installments so downpayment registers immediately
  recalculatePreSaleInstallments(db, id);

  writeDb(db);
  res.json({ status: "success", preSale: newPreSale, installments });
});

// 9e-2. Delete Pre-Sale Contract
app.post("/api/presales/delete", (req, res) => {
  try {
    const db = readDb();
    const { id } = req.body;
    const idx = db.preSales.findIndex(ps => ps.id === id);
    if (idx >= 0) {
      const presale = db.preSales[idx];
      
      // 1. Revert associated unit status
      const unitIdx = db.units.findIndex(u => u.id === presale.unitId);
      if (unitIdx >= 0) {
        db.units[unitIdx].status = "available";
        delete db.units[unitIdx].buyerName;
        delete db.units[unitIdx].downPayment;
      }

      // 2. Revert all transactions associated with this preSale and deduct from bank accounts
      const relatedTxs = db.transactions.filter(t => t.preSaleId === id);
      const totalPaidOnPreSale = relatedTxs.reduce((sum, t) => sum + t.amount, 0);
      relatedTxs.forEach(t => {
        if (!t.isNonCash) {
          const acc = db.accounts.find(a => a.id === t.accountId);
          if (acc) {
            acc.balance -= t.amount;
          }
        }
      });
      db.transactions = db.transactions.filter(t => t.preSaleId !== id);

      // 3. Revert buyer remaining balance
      const buyer = db.contacts.find(c => c.id === presale.contactId);
      if (buyer) {
        const remainingDebtOnContract = Math.max(0, presale.totalPrice - totalPaidOnPreSale);
        buyer.balance = Math.max(0, (buyer.balance || 0) - remainingDebtOnContract);
      }
      
      // 4. Remove installments
      db.preSaleInstallments = db.preSaleInstallments.filter(psi => psi.preSaleId !== id);
      
      // 5. Delete presale
      db.preSales.splice(idx, 1);
      
      writeDb(db);
      res.json({ status: "success", message: "قرارداد پیش‌فروش و تراکنش‌های مرتبط با موفقیت حذف شد" });
    } else {
      res.status(404).json({ error: "قرارداد پیش‌فروش یافت نشد" });
    }
  } catch (err: any) {
    res.status(500).json({ error: "خطا در حذف قرارداد: " + err.message });
  }
});

// 9e-3. Update Pre-Sale Exact Area & Secondary Price (Deed settlement)
app.post("/api/presales/update-area", (req, res) => {
  try {
    const db = readDb();
    const { id, exactArea, secondaryPricePerMeter, hasExactArea } = req.body;

    const idx = db.preSales.findIndex(ps => ps.id === id);
    if (idx < 0) {
      return res.status(404).json({ error: "قرارداد پیش‌فروش یافت نشد" });
    }

    const preSale = db.preSales[idx];
    const prevTotalPrice = preSale.totalPrice;

    preSale.hasExactArea = !!hasExactArea;
    if (hasExactArea) {
      preSale.exactArea = Number(exactArea);
      preSale.secondaryPricePerMeter = Number(secondaryPricePerMeter);
      const diffArea = preSale.exactArea - preSale.contractArea;
      const adjustment = diffArea * preSale.secondaryPricePerMeter;
      preSale.totalPrice = Math.round((preSale.contractArea * preSale.pricePerMeter) + adjustment);
    } else {
      preSale.exactArea = undefined;
      preSale.secondaryPricePerMeter = undefined;
      preSale.totalPrice = Math.round(preSale.contractArea * preSale.pricePerMeter);
    }

    const diffAmount = preSale.totalPrice - prevTotalPrice;

    // Also update the unit's area in db.units if exactArea is provided
    if (hasExactArea && preSale.exactArea) {
      const unitIdx = db.units.findIndex(u => u.id === preSale.unitId);
      if (unitIdx >= 0) {
        db.units[unitIdx].area = preSale.exactArea;
        db.units[unitIdx].totalPrice = preSale.totalPrice;
      }
    }

    // Adjust installments
    const installments = db.preSaleInstallments.filter(i => i.preSaleId === id);
    let targetInst = installments.find(i => 
      i.installmentName.includes("سند") || 
      i.installmentName.includes("دفترخانه") || 
      i.installmentName.includes("نهایی")
    );

    if (!targetInst && installments.length > 0) {
      // Find the last installment chronologically
      installments.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
      targetInst = installments[installments.length - 1];
    }

    if (targetInst) {
      targetInst.amount = Math.max(0, targetInst.amount + diffAmount);
    }

    // Adjust buyer balance
    const buyer = db.contacts.find(c => c.id === preSale.contactId);
    if (buyer) {
      buyer.balance = Math.max(0, (buyer.balance || 0) + diffAmount);
    }

    // Recalculate
    recalculatePreSaleInstallments(db, id);

    writeDb(db);
    res.json({ status: "success", preSale, installments });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در بروزرسانی متراژ دقیق قرارداد: " + err.message });
  }
});

// 9f. Pay Pre-Sale Installment
app.post("/api/presales/installments/pay", (req, res) => {
  const db = readDb();
  const { installmentId, accountId, paidDate } = req.body;

  const instIdx = db.preSaleInstallments.findIndex(i => i.id === installmentId);
  if (instIdx < 0) {
    return res.status(404).json({ error: "قسط مورد نظر یافت نشد" });
  }

  const inst = db.preSaleInstallments[instIdx];
  if (inst.isPaid) {
    return res.status(400).json({ error: "این قسط قبلاً پرداخت شده است" });
  }

  const remainingToPay = Math.max(0, inst.amount - (inst.paidAmount || 0));
  const payAmount = remainingToPay > 0 ? remainingToPay : inst.amount;

  inst.isPaid = true;
  inst.paidAmount = inst.amount;
  inst.paidDate = paidDate || getTodayShamsiServer();

  // Find associated pre-sale & buyer
  const presale = db.preSales.find(p => p.id === inst.preSaleId);
  if (presale) {
    const buyer = db.contacts.find(c => c.id === presale.contactId);
    const unit = db.units.find(u => u.id === presale.unitId);
    const targetAccId = accountId || db.accounts[0]?.id || "a1";
    
    // Register transaction with preSaleId so recalculatePreSaleInstallments recognizes it
    const tx: Transaction = {
      id: "t_ps_inst_" + Date.now(),
      companyId: getProjectCompanyId(db, presale.projectId),
      projectId: presale.projectId,
      type: "income",
      category: "پیش‌فروش",
      amount: payAmount,
      accountId: targetAccId,
      contactId: presale.contactId,
      personName: buyer ? buyer.name : "پیش‌خریدار",
      date: inst.paidDate,
      description: `دریافت قسط "${inst.installmentName}" قرارداد پیش‌فروش واحد ${unit ? unit.unitNumber : ""}`,
      isNonCash: false,
      preSaleId: presale.id,
      paymentStatus: "paid",
      payments: [{
        id: "p_psi_" + Date.now(),
        amount: payAmount,
        date: inst.paidDate,
        accountId: targetAccId
      }]
    };
    db.transactions.push(tx);

    // Update account balance
    const acc = db.accounts.find(a => a.id === tx.accountId);
    if (acc) {
      acc.balance += tx.amount;
    }

    // Update buyer contact balance
    if (buyer) {
      buyer.balance = Math.max(0, (buyer.balance || 0) - payAmount);
    }

    recalculatePreSaleInstallments(db, presale.id);
  }

  writeDb(db);
  res.json({ status: "success", installment: inst });
});

// 9f-1. Add Pre-Sale Custom Installment
app.post("/api/presales/installments/add", (req, res) => {
  const db = readDb();
  const { preSaleId, installmentName, dueDate, amount } = req.body;

  if (!preSaleId || !installmentName || !dueDate || !amount) {
    return res.status(400).json({ error: "اطلاعات قسط کامل نیست" });
  }

  const preSale = db.preSales.find(p => p.id === preSaleId);
  if (!preSale) {
    return res.status(404).json({ error: "قرارداد یافت نشد" });
  }

  const newInstallment: PreSaleInstallment = {
    id: "psi_custom_" + Date.now(),
    preSaleId,
    installmentName,
    dueDate,
    amount: Number(amount),
    isPaid: false
  };

  db.preSaleInstallments.push(newInstallment);

  const buyer = db.contacts.find(c => c.id === preSale.contactId);
  if (buyer) {
    buyer.balance = (buyer.balance || 0) + Number(amount);
  }

  // Recalculate pre-sale installments
  recalculatePreSaleInstallments(db, preSaleId);

  writeDb(db);
  res.json({ status: "success", installment: newInstallment });
});

// 9f-2. Delete Pre-Sale Installment
app.post("/api/presales/installments/delete", (req, res) => {
  const db = readDb();
  const { installmentId } = req.body;

  if (!installmentId) {
    return res.status(400).json({ error: "شناسه قسط مشخص نیست" });
  }

  const instIdx = db.preSaleInstallments.findIndex(i => i.id === installmentId);
  if (instIdx < 0) {
    return res.status(404).json({ error: "قسط یافت نشد" });
  }

  const inst = db.preSaleInstallments[instIdx];
  if (inst.isPaid) {
    return res.status(400).json({ error: "قسط پرداخت شده را نمی‌توان حذف کرد" });
  }

  const presale = db.preSales.find(p => p.id === inst.preSaleId);
  if (presale) {
    const buyer = db.contacts.find(c => c.id === presale.contactId);
    if (buyer) {
      buyer.balance = Math.max(0, (buyer.balance || 0) - inst.amount);
    }
  }

  db.preSaleInstallments.splice(instIdx, 1);

  if (presale) {
    // Recalculate pre-sale installments
    recalculatePreSaleInstallments(db, presale.id);
  }

  writeDb(db);
  res.json({ status: "success", message: "قسط با موفقیت حذف شد" });
});

// 9f-3. Edit Pre-Sale Installment
app.post("/api/presales/installments/edit", (req, res) => {
  const db = readDb();
  const { installmentId, installmentName, dueDate, amount } = req.body;

  if (!installmentId) {
    return res.status(400).json({ error: "شناسه قسط مشخص نیست" });
  }

  const instIdx = db.preSaleInstallments.findIndex(i => i.id === installmentId);
  if (instIdx < 0) {
    return res.status(404).json({ error: "قسط یافت نشد" });
  }

  const inst = db.preSaleInstallments[instIdx];
  if (inst.isPaid) {
    return res.status(400).json({ error: "قسط پرداخت شده را نمی‌توان ویرایش کرد" });
  }

  const presale = db.preSales.find(p => p.id === inst.preSaleId);
  if (presale) {
    const buyer = db.contacts.find(c => c.id === presale.contactId);
    if (buyer) {
      const difference = Number(amount) - inst.amount;
      buyer.balance = Math.max(0, (buyer.balance || 0) + difference);
    }
  }

  inst.installmentName = installmentName || inst.installmentName;
  inst.dueDate = dueDate || inst.dueDate;
  inst.amount = Number(amount) || inst.amount;

  if (presale) {
    // Recalculate pre-sale installments
    recalculatePreSaleInstallments(db, presale.id);
  }

  writeDb(db);
  res.json({ status: "success", installment: inst });
});

// 9f-4. Register Pre-Sale Payment Document (ثبت سند دریافت قسط)
app.post("/api/presales/payments/add", (req, res) => {
  const db = readDb();
  const { preSaleId, amount, accountId, paidDate, referenceNumber, invoiceNumber, invoiceDescription, description } = req.body;

  if (!preSaleId || !amount || !paidDate) {
    return res.status(400).json({ error: "اطلاعات سند پرداخت ناقص است. تعیین مبلغ و تاریخ الزامی است." });
  }

  const preSale = db.preSales.find(p => p.id === preSaleId);
  if (!preSale) {
    return res.status(404).json({ error: "قرارداد پیش‌فروش یافت نشد" });
  }

  const buyer = db.contacts.find(c => c.id === preSale.contactId);
  const unit = db.units.find(u => u.id === preSale.unitId);
  const resolvedAccountId = accountId || db.accounts[0]?.id || "a1";
  const acc = db.accounts.find(a => a.id === resolvedAccountId);

  const payVal = Number(amount);
  const finalDesc = description || invoiceDescription || `دریافت پرداختی پیش‌فروش واحد ${unit ? unit.unitNumber : ""} - شماره سند ${referenceNumber || ""}`;
  // Register transaction
  const tx: Transaction = {
    id: "t_ps_pay_" + Date.now(),
    companyId: getProjectCompanyId(db, preSale.projectId),
    projectId: preSale.projectId,
    type: "income",
    category: "پیش‌فروش",
    amount: payVal,
    accountId: resolvedAccountId,
    contactId: preSale.contactId,
    personName: buyer ? buyer.name : "پیش‌خریدار",
    date: paidDate,
    description: finalDesc,
    invoiceNumber: invoiceNumber || "",
    isNonCash: false,
    preSaleId,
    paymentStatus: "paid",
    payments: [{
      id: "p_psp_" + Date.now(),
      amount: payVal,
      date: paidDate,
      accountId: resolvedAccountId,
      referenceNumber,
      invoiceNumber: invoiceNumber || "",
      invoiceDescription: invoiceDescription || finalDesc,
      description: finalDesc
    }]
  };
  db.transactions.push(tx);

  // Update account balance
  if (acc) {
    acc.balance += payVal;
  }

  // Update buyer contact balance
  if (buyer) {
    buyer.balance = Math.max(0, (buyer.balance || 0) - payVal);
  }

  // Recalculate installments
  recalculatePreSaleInstallments(db, preSaleId);

  writeDb(db);
  res.json({ status: "success", transaction: tx });
});

// 9g. Record SMS Alert
app.post("/api/alerts", (req, res) => {
  const db = readDb();
  const alert = req.body;
  const id = "al_" + Date.now();

  const newLog: AlertLog = {
    id,
    type: alert.type || "installment",
    referenceId: alert.referenceId || "",
    recipientPhone: alert.recipientPhone || "",
    message: alert.message || "",
    sendDate: getTodayShamsiServer(),
    isSent: true
  };

  db.alertsLog.push(newLog);
  writeDb(db);
  res.json({ status: "success", alertLog: newLog });
});

// 9g-2. Timesheets & Payrolls Endpoints
app.post("/api/timesheets", (req, res) => {
  const db = readDb();
  if (!db.timesheets) db.timesheets = [];
  const item: TimesheetItem = {
    id: req.body.id || "ts_" + Date.now(),
    projectId: req.body.projectId,
    contactId: req.body.contactId,
    personName: req.body.personName,
    date: req.body.date || getTodayShamsiServer(),
    hoursWorked: Number(req.body.hoursWorked || 0),
    overtimeHours: Number(req.body.overtimeHours || 0),
    dailyRate: Number(req.body.dailyRate || 0),
    overtimeRate: Number(req.body.overtimeRate || 0),
    totalPay: Number(req.body.totalPay || 0),
    stage: req.body.stage || "سفت‌کاری",
    description: req.body.description || "",
    isPaid: !!req.body.isPaid
  };
  const idx = db.timesheets.findIndex(t => t.id === item.id);
  if (idx >= 0) db.timesheets[idx] = item;
  else db.timesheets.push(item);
  writeDb(db);
  res.json({ status: "success", timesheet: item });
});

app.post("/api/timesheets/delete", (req, res) => {
  const db = readDb();
  if (!db.timesheets) db.timesheets = [];
  db.timesheets = db.timesheets.filter(t => t.id !== req.body.id);
  writeDb(db);
  res.json({ status: "success" });
});

app.post("/api/payrolls", (req, res) => {
  const db = readDb();
  if (!db.payrolls) db.payrolls = [];
  const item: PayrollItem = {
    id: req.body.id || "pr_" + Date.now(),
    projectId: req.body.projectId,
    contactId: req.body.contactId,
    personName: req.body.personName,
    month: req.body.month,
    year: req.body.year,
    baseSalary: Number(req.body.baseSalary || 0),
    housingAllowance: Number(req.body.housingAllowance || 0),
    foodAllowance: Number(req.body.foodAllowance || 0),
    childAllowance: Number(req.body.childAllowance || 0),
    overtimeHours: Number(req.body.overtimeHours || 0),
    overtimePay: Number(req.body.overtimePay || 0),
    bonuses: Number(req.body.bonuses || 0),
    insuranceWorker: Number(req.body.insuranceWorker || 0),
    insuranceEmployer: Number(req.body.insuranceEmployer || 0),
    taxDeduction: Number(req.body.taxDeduction || 0),
    advanceDeduction: Number(req.body.advanceDeduction || 0),
    otherDeductions: Number(req.body.otherDeductions || 0),
    grossSalary: Number(req.body.grossSalary || 0),
    netPayable: Number(req.body.netPayable || 0),
    paymentDate: req.body.paymentDate || getTodayShamsiServer(),
    accountId: req.body.accountId || "a1",
    isPaid: !!req.body.isPaid
  };
  const idx = db.payrolls.findIndex(p => p.id === item.id);
  if (idx >= 0) db.payrolls[idx] = item;
  else db.payrolls.push(item);
  writeDb(db);
  res.json({ status: "success", payroll: item });
});

app.post("/api/payrolls/delete", (req, res) => {
  const db = readDb();
  if (!db.payrolls) db.payrolls = [];
  db.payrolls = db.payrolls.filter(p => p.id !== req.body.id);
  writeDb(db);
  res.json({ status: "success" });
});

// 9h. Settings Management
app.get("/api/settings", (req, res) => {
  res.json(readSettings());
});

app.post("/api/settings", (req, res) => {
  try {
    const oldSettings = readSettings();
    const newSettings = { ...oldSettings, ...req.body };
    
    if (newSettings.cfApiToken) newSettings.cfApiToken = newSettings.cfApiToken.trim();
    if (newSettings.cfAccountId) newSettings.cfAccountId = newSettings.cfAccountId.trim();
    if (newSettings.cfWorkerName) newSettings.cfWorkerName = newSettings.cfWorkerName.trim();
    
    if (req.body.autoBackupSyncIntervalHours !== undefined) {
      newSettings.autoBackupSyncIntervalHours = Number(req.body.autoBackupSyncIntervalHours) || 0;
    }
    
    // If dbPath has changed, copy the current db file to the new path to avoid data loss
    if (newSettings.dbPath && newSettings.dbPath !== oldSettings.dbPath) {
      const oldDbFile = oldSettings.dbPath || path.join(process.cwd(), "db.json");
      const newDbFile = newSettings.dbPath;
      
      const newDbDir = path.dirname(newDbFile);
      if (!fs.existsSync(newDbDir)) {
        fs.mkdirSync(newDbDir, { recursive: true });
      }
      
      if (fs.existsSync(oldDbFile)) {
        fs.copyFileSync(oldDbFile, newDbFile);
      } else {
        fs.writeFileSync(newDbFile, JSON.stringify(DEFAULT_DB, null, 2), "utf-8");
      }
    }
    
    // Ensure uploads directory exists
    if (newSettings.uploadsPath) {
      if (!fs.existsSync(newSettings.uploadsPath)) {
        fs.mkdirSync(newSettings.uploadsPath, { recursive: true });
      }
    }
    
    writeSettings(newSettings);
    res.json({ status: "success", settings: newSettings });
  } catch (err: any) {
    res.status(500).json({ error: "خطا در بروزرسانی تنظیمات: " + err.message });
  }
});

// File serving endpoint
app.get("/api/uploads/:filename", (req, res) => {
  const settings = readSettings();
  const uploadsDir = settings.uploadsPath || path.join(process.cwd(), "uploads");
  const filePath = path.join(uploadsDir, req.params.filename);
  if (fs.existsSync(filePath)) {
    res.sendFile(filePath);
  } else {
    res.status(404).send("فایل یافت نشد");
  }
});

// 9i. Cloudflare Worker Auto-Deployment & Synchronization
app.post("/api/cloudflare/deploy", async (req, res) => {
  try {
    let { cfApiToken, cfAccountId, cfWorkerName } = req.body;
    if (cfApiToken) cfApiToken = cfApiToken.trim();
    if (cfAccountId) cfAccountId = cfAccountId.trim();
    if (cfWorkerName) cfWorkerName = cfWorkerName.trim();

    if (!cfApiToken || !cfAccountId || !cfWorkerName) {
      return res.status(400).json({ error: "لطفا توکن کلودفلر، شناسه اکانت و نام ورکر را وارد نمایید" });
    }

    // 1. Check or Create D1 Database
    let d1DatabaseId = "";
    const listD1Url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/d1/database`;
    const d1Response = await fetch(listD1Url, {
      headers: { "Authorization": `Bearer ${cfApiToken}` }
    });
    
    if (!d1Response.ok) {
      const errText = await d1Response.text();
      return res.status(500).json({ error: "خطا در اتصال به کلودفلر (لیست کردن دیتابیس‌های D1): " + errText });
    }
    
    const d1Data: any = await d1Response.json();
    const existingD1 = d1Data.result?.find((db: any) => db.name === "CONSTRUCTION_ACCOUNTING_D1" || db.name === "construction-accounting-db");
    
    if (existingD1) {
      d1DatabaseId = existingD1.uuid;
    } else {
      // Create it
      const createD1Response = await fetch(listD1Url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${cfApiToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ name: "construction-accounting-db" })
      });
      
      if (!createD1Response.ok) {
        const errText = await createD1Response.text();
        return res.status(500).json({ error: "خطا در ایجاد دیتابیس D1 در کلودفلر: " + errText });
      }
      const newD1Data: any = await createD1Response.json();
      d1DatabaseId = newD1Data.result?.uuid;
    }

    if (!d1DatabaseId) {
      return res.status(500).json({ error: "خطا در یافتن یا ایجاد دیتابیس D1 کلودفلر" });
    }

    // 2. Fetch Subdomain
    const subdomainUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/subdomain`;
    const subResponse = await fetch(subdomainUrl, {
      headers: { "Authorization": `Bearer ${cfApiToken}` }
    });
    
    let subdomain = "workers.dev";
    if (subResponse.ok) {
      const subData: any = await subResponse.json();
      if (subData.result?.subdomain) {
        subdomain = subData.result.subdomain;
      }
    }

    // 3. Generate or Load syncToken
    const currentSettings = readSettings();
    let syncToken = currentSettings.syncToken;
    if (!syncToken) {
      syncToken = "st_" + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    }

    // 4. Construct Worker Script using D1 Database
    const workerScript = `
const SYNC_TOKEN = "${syncToken}";

export default {
  async fetch(request, env) {
    return handleRequest(request, env);
  }
};

async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, x-sync-token, Authorization',
        'Access-Control-Max-Age': '86400',
      }
    });
  }
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, x-sync-token, Authorization',
    'Content-Type': 'application/json'
  };
  
  const providedToken = request.headers.get('x-sync-token') || request.headers.get('Authorization');
  if (providedToken !== SYNC_TOKEN && providedToken !== 'Bearer ' + SYNC_TOKEN) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: corsHeaders
    });
  }
  
  try {
    // Ensure kv_store table exists in Cloudflare D1
    await env.DB.prepare("CREATE TABLE IF NOT EXISTS kv_store (key TEXT PRIMARY KEY, value TEXT)").run();

    if (path === '/api/db' && request.method === 'GET') {
      const result = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind("db").first();
      return new Response(result ? result.value : '{}', {
        status: 200,
        headers: corsHeaders
      });
    }
    
    if (path === '/api/db/import' && request.method === 'POST') {
      const body = await request.text();
      JSON.parse(body); // validate JSON
      await env.DB.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").bind("db", body).run();
      return new Response(JSON.stringify({ status: 'success' }), {
        status: 200,
        headers: corsHeaders
      });
    }
    
    if (path.startsWith('/api/uploads/') && request.method === 'GET') {
      const filename = path.substring('/api/uploads/'.length);
      const result = await env.DB.prepare("SELECT value FROM kv_store WHERE key = ?").bind('file_' + filename).first();
      const fileData = result ? result.value : null;
      if (!fileData) {
        return new Response(JSON.stringify({ error: 'File not found' }), {
          status: 404,
          headers: corsHeaders
        });
      }
      
      let contentType = 'application/octet-stream';
      if (filename.endsWith('.png')) contentType = 'image/png';
      else if (filename.endsWith('.jpg') || filename.endsWith('.jpeg')) contentType = 'image/jpeg';
      else if (filename.endsWith('.pdf')) contentType = 'application/pdf';
      
      try {
        const base64Content = fileData.replace(/^data:image\\\\/\\\\w+;base64,/, "");
        const binaryString = atob(base64Content);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        return new Response(bytes.buffer, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': contentType
          }
        });
      } catch (e) {
        // Fallback to text
        return new Response(fileData, {
          status: 200,
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'text/plain'
          }
        });
      }
    }
    
    if (path.startsWith('/api/uploads/') && request.method === 'POST') {
      const filename = path.substring('/api/uploads/'.length);
      const body = await request.text();
      await env.DB.prepare("INSERT OR REPLACE INTO kv_store (key, value) VALUES (?, ?)").bind('file_' + filename, body).run();
      return new Response(JSON.stringify({ status: 'success', filename }), {
        status: 200,
        headers: corsHeaders
      });
    }
    
    return new Response(JSON.stringify({ error: 'Not found' }), {
      status: 404,
      headers: corsHeaders
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: corsHeaders
    });
  }
}
`;

    // 5. Multi-part Upload to Cloudflare API
    const boundary = "----CfDeployBoundary" + Date.now();
    const metadataPart = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="metadata"\r\n` +
      `Content-Type: application/json\r\n\r\n` +
      JSON.stringify({
        main_module: "worker.js",
        bindings: [
          {
            type: "d1",
            name: "DB",
            id: d1DatabaseId
          }
        ]
      }) + "\r\n";

    const scriptPart = 
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="script"; filename="worker.js"\r\n` +
      `Content-Type: application/javascript+module\r\n\r\n` +
      workerScript + "\r\n" +
      `--${boundary}--`;

    const bodyBuffer = Buffer.concat([
      Buffer.from(metadataPart, "utf-8"),
      Buffer.from(scriptPart, "utf-8")
    ]);

    const uploadUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/scripts/${cfWorkerName}`;
    const deployResponse = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Authorization": `Bearer ${cfApiToken}`,
        "Content-Type": `multipart/form-data; boundary=${boundary}`
      },
      body: bodyBuffer
    });

    if (!deployResponse.ok) {
      const errText = await deployResponse.text();
      return res.status(500).json({ error: "خطا در آپلود اسکریپت ورکر به کلودفلر: " + errText });
    }

    // 6. Subdomain activation / routing
    const subdomainActiveUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/scripts/${cfWorkerName}/subdomain`;
    await fetch(subdomainActiveUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${cfApiToken}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ enabled: true })
    });

    const cfWorkerUrl = `https://${cfWorkerName}.${subdomain}.workers.dev`;

    // Save settings
    const updatedSettings: AppSettings = {
      ...currentSettings,
      cfApiToken,
      cfAccountId,
      cfWorkerName,
      cfWorkerUrl,
      syncToken
    };
    writeSettings(updatedSettings);

    res.json({
      status: "success",
      message: "ورکر کلودفلر با موفقیت ساخته، کانفیگ و متصل گردید!",
      workerUrl: cfWorkerUrl,
      syncToken
    });

  } catch (err: any) {
    res.status(500).json({ error: "خطا در پیاده‌سازی آنلاین کلودفلر: " + err.message });
  }
});

// Connect existing Cloudflare Worker
app.post("/api/cloudflare/connect", async (req, res) => {
  try {
    let { cfApiToken, cfAccountId, cfWorkerName } = req.body;
    if (cfApiToken) cfApiToken = cfApiToken.trim();
    if (cfAccountId) cfAccountId = cfAccountId.trim();
    if (cfWorkerName) cfWorkerName = cfWorkerName.trim();

    if (!cfApiToken || !cfAccountId || !cfWorkerName) {
      return res.status(400).json({ error: "لطفا توکن کلودفلر، شناسه اکانت و نام ورکر را وارد نمایید" });
    }

    // 1. Fetch Subdomain
    const subdomainUrl = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/workers/subdomain`;
    const subResponse = await fetch(subdomainUrl, {
      headers: { "Authorization": `Bearer ${cfApiToken}` }
    });
    
    let subdomain = "workers.dev";
    if (subResponse.ok) {
      const subData: any = await subResponse.json();
      if (subData.result?.subdomain) {
        subdomain = subData.result.subdomain;
      }
    } else {
      const errText = await subResponse.text();
      return res.status(500).json({ error: "خطا در دریافت ساب‌دومین کلودفلر. مطمئن شوید توکن و شناسه اکانت صحیح هستند: " + errText });
    }

    const cfWorkerUrl = `https://${cfWorkerName}.${subdomain}.workers.dev`;

    // 2. Generate or Load syncToken
    const currentSettings = readSettings();
    let syncToken = currentSettings.syncToken;
    if (!syncToken) {
      syncToken = "st_" + Math.random().toString(36).substring(2) + Math.random().toString(36).substring(2);
    }

    // 3. Find existing D1 database or try to locate construction-accounting-db
    let d1DatabaseId = "";
    const listD1Url = `https://api.cloudflare.com/client/v4/accounts/${cfAccountId}/d1/database`;
    const d1Response = await fetch(listD1Url, {
      headers: { "Authorization": `Bearer ${cfApiToken}` }
    });
    
    if (d1Response.ok) {
      const d1Data: any = await d1Response.json();
      const existingD1 = d1Data.result?.find((db: any) => db.name === "CONSTRUCTION_ACCOUNTING_D1" || db.name === "construction-accounting-db");
      if (existingD1) {
        d1DatabaseId = existingD1.uuid;
      }
    }

    // 4. Update settings
    const updatedSettings: AppSettings = {
      ...currentSettings,
      cfApiToken,
      cfAccountId,
      cfWorkerName,
      cfWorkerUrl,
      syncToken
    };
    writeSettings(updatedSettings);

    res.json({
      status: "success",
      message: "اتصال به ورکر موجود با موفقیت برقرار شد!",
      workerUrl: cfWorkerUrl,
      syncToken,
      d1DatabaseId: d1DatabaseId || "یافت نشد"
    });

  } catch (err: any) {
    res.status(500).json({ error: "خطا در اتصال به ورکر کلودفلر: " + err.message });
  }
});

app.post("/api/cloudflare/sync", async (req, res) => {
  try {
    const settings = readSettings();
    if (!settings.cfWorkerUrl || !settings.syncToken) {
      return res.status(400).json({ error: "ابتدا باید اتصال ورکر کلودفلر را برقرار و پروژه را آپلود نمایید" });
    }

    // 1. Sync Database
    const db = readDb();
    const syncDbUrl = `${settings.cfWorkerUrl}/api/db/import`;
    const syncDbResponse = await fetch(syncDbUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-sync-token": settings.syncToken
      },
      body: JSON.stringify(db)
    });

    if (!syncDbResponse.ok) {
      const errText = await syncDbResponse.text();
      return res.status(500).json({ error: "خطا در هماهنگ‌سازی دیتابیس با کلودفلر: " + errText });
    }

    // 2. Sync Files (images)
    const uploadsDir = settings.uploadsPath || path.join(process.cwd(), "uploads");
    let filesSynced = 0;
    
    if (fs.existsSync(uploadsDir)) {
      const files = fs.readdirSync(uploadsDir);
      for (const filename of files) {
        const filePath = path.join(uploadsDir, filename);
        if (fs.statSync(filePath).isFile()) {
          const fileBuffer = fs.readFileSync(filePath);
          const base64Data = fileBuffer.toString("base64");
          
          const ext = path.extname(filename).toLowerCase();
          let mime = "image/png";
          if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
          else if (ext === ".pdf") mime = "application/pdf";
          
          const dataUri = `data:${mime};base64,${base64Data}`;
          
          const syncFileUrl = `${settings.cfWorkerUrl}/api/uploads/${filename}`;
          const syncFileResponse = await fetch(syncFileUrl, {
            method: "POST",
            headers: {
              "Content-Type": "text/plain",
              "x-sync-token": settings.syncToken
            },
            body: dataUri
          });
          
          if (syncFileResponse.ok) {
            filesSynced++;
          }
        }
      }
    }

    res.json({
      status: "success",
      message: "هماهنگ‌سازی با موفقیت پایان یافت!",
      filesSynced,
      dbSynced: true
    });

  } catch (err: any) {
    res.status(500).json({ error: "خطا در هماهنگ‌سازی آنلاین: " + err.message });
  }
});

// 10. Gemini-Powered Iranian Construction Accounting & Tax Expert Advisor
app.post("/api/assistant", async (req, res) => {
  try {
    const { message, history } = req.body;
    if (!message) {
      return res.status(400).json({ error: "لطفا پیام خود را ارسال فرمایید" });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.json({
        reply: "پیکربندی کلید Gemini API یافت نشد. با این حال به عنوان مشاور حسابداری ساختمانی ایران می‌توانم به شما بگویم:\n\n۱. قوانین مالیات بر ارزش افزوده (VAT) در سال ۱۴۰۳ معادل ۱۰٪ می‌باشد که برای خرید مصالح از شرکت‌های رسمی قابل کسر از اعتبار مالیاتی کارفرما است.\n۲. مطابق ماده ۱۶۹ قانون مالیات‌های مستقیم، کلیه صورت معاملات فصلی پیمانکاران می‌بایست تا ۴۵ روز پس از پایان هر فصل در سامانه سازمان امور مالیاتی ثبت گردد.\n۳. مالیات تکلیفی ۳٪ از صورت‌وضعیت‌ها دیگر ملغی شده و پیمانکاران مشمول علی‌الحساب مالیاتی کارگاه‌ها نمی‌شوند بلکه باید مالیات سالانه عملکرد خود را بر اساس سود ابرازی ثبت کنند.",
        isMocked: true
      });
    }

    const { GoogleGenAI } = require("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build"
        }
      }
    });

    const systemInstruction = `
You are a highly professional Iranian Construction Contracting Accounting & Tax Auditor (حسابرس و مشاور مالیاتی تخصصی پیمانکاری و ساخت و ساز در ایران).
Answer the user's questions in fluent Persian (Farsi).
Format your response using professional markdown with bullet points and bold headers.
Always conform to real, accurate Iranian Tax Laws, including:
1. ارزش افزوده (VAT) for current years (which is 10% in 1403/1404). Explain how purchase invoices with VAT can be used as input tax credit (اعتبار مالیاتی).
2. ماده 169 قانون مالیات های مستقیم (Seasonal Reports / گزارش معاملات فصلی) and the 45-day deadline after each season.
3. نحوه محاسبه بهای تمام شده ساختمان (Cost per square meter calculation) and depreciation.
4. مالیات تکلیفی پیمانکاری (Withholding tax history and updates, like the historical 3% and the current rules where withholding isn't deducted at source, but is based on annual corporate/individual profit).
5. تهاتر ملکی (Bartering) and its accounting treatment in construction (how it's recorded as a non-cash transaction with output sales and input expenses).
6. تفاوت پیش‌فروش ساختمان با فروش قطعی از نظر زمان شناسایی درآمد در حسابداری ساخت و ساز (Accounting for pre-sales vs definitive sales under Standard No. 9 / استاندارد حسابداری شماره ۹ پیمانکاری ایران).

Keep your language polite, highly expert, clear, and easy to understand, avoiding overly academic accounting jargon but offering pristine fiscal accuracy.
`;

    const chatHistory = history ? history.map((h: any) => ({
      role: h.role === "user" ? "user" : "model",
      parts: [{ text: h.text }]
    })) : [];

    const chat = ai.chats.create({
      model: "gemini-3.5-flash",
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7
      },
      history: chatHistory
    });

    const response = await chat.sendMessage({ message: message });
    res.json({ reply: response.text });

  } catch (error: any) {
    console.error("Gemini Assistant error:", error);
    res.status(500).json({
      error: "خطایی در برقراری ارتباط با مشاور هوش مصنوعی رخ داد",
      details: error.message
    });
  }
});

// 11. Export D1 (SQLite) DB SQL Dump
app.get("/api/export/sqlite", (req, res) => {
  const db = readDb();
  let sql = `-- Cloudflare D1 Construction Accounting Database Schema and Initial Seed\n`;
  sql += `-- Generated on ${new Date().toISOString()}\n\n`;

  // Create tables
  sql += `CREATE TABLE IF NOT EXISTS companies (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT
);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  name TEXT NOT NULL,
  address TEXT,
  total_area REAL,
  budget REAL,
  stages TEXT,
  current_stage TEXT,
  status TEXT
);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT,
  type_name TEXT,
  account_number TEXT,
  bank_name TEXT,
  balance REAL
);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS materials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  unit TEXT,
  stock REAL,
  average_price REAL
);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS material_transactions (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  material_id TEXT,
  type TEXT,
  quantity REAL,
  unit_price REAL,
  date TEXT,
  person_name TEXT,
  description TEXT
);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  project_id TEXT,
  type TEXT,
  category TEXT,
  sub_category TEXT,
  amount REAL,
  account_id TEXT,
  person_name TEXT,
  date TEXT,
  description TEXT,
  is_non_cash INTEGER,
  barter_property_type TEXT,
  barter_description TEXT,
  barter_agreed_value REAL,
  attachment_name TEXT
);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS checks (
  id TEXT PRIMARY KEY,
  company_id TEXT,
  project_id TEXT,
  check_number TEXT,
  bank_name TEXT,
  due_date TEXT,
  amount REAL,
  type TEXT,
  status TEXT,
  person_name TEXT,
  description TEXT
);\n\n`;

  sql += `CREATE TABLE IF NOT EXISTS units (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  unit_number TEXT,
  floor TEXT,
  area REAL,
  price_per_meter REAL,
  total_price REAL,
  status TEXT,
  buyer_name TEXT,
  down_payment REAL,
  barter_property TEXT
);\n\n`;

  // Seed commands
  db.companies.forEach(c => {
    sql += `INSERT OR REPLACE INTO companies VALUES ('${c.id}', '${c.name.replace(/'/g, "''")}', '${c.code}');\n`;
  });
  sql += `\n`;

  db.projects.forEach(p => {
    sql += `INSERT OR REPLACE INTO projects VALUES ('${p.id}', '${p.companyId}', '${p.name.replace(/'/g, "''")}', '${p.address.replace(/'/g, "''")}', ${p.totalArea}, ${p.budget}, '${JSON.stringify(p.stages)}', '${p.currentStage}', '${p.status}');\n`;
  });
  sql += `\n`;

  db.accounts.forEach(a => {
    sql += `INSERT OR REPLACE INTO accounts VALUES ('${a.id}', '${a.name.replace(/'/g, "''")}', '${a.type}', '${a.typeName}', '${a.accountNumber || ""}', '${a.bankName || ""}', ${a.balance});\n`;
  });
  sql += `\n`;

  db.materials.forEach(m => {
    sql += `INSERT OR REPLACE INTO materials VALUES ('${m.id}', '${m.name.replace(/'/g, "''")}', '${m.category.replace(/'/g, "''")}', '${m.unit}', ${m.stock}, ${m.averagePrice});\n`;
  });
  sql += `\n`;

  db.transactions.forEach(t => {
    sql += `INSERT OR REPLACE INTO transactions VALUES ('${t.id}', '${t.companyId}', '${t.projectId}', '${t.type}', '${t.category}', '${t.subCategory || ""}', ${t.amount}, '${t.accountId}', '${t.personName.replace(/'/g, "''")}', '${t.date}', '${t.description.replace(/'/g, "''")}', ${t.isNonCash ? 1 : 0}, '${t.barterDetails?.propertyType || ""}', '${t.barterDetails?.description || ""}', ${t.barterDetails?.agreedValue || 0}, '${t.attachmentName || ""}');\n`;
  });
  sql += `\n`;

  db.checks.forEach(ch => {
    sql += `INSERT OR REPLACE INTO checks VALUES ('${ch.id}', '${ch.companyId}', '${ch.projectId}', '${ch.checkNumber}', '${ch.bankName.replace(/'/g, "''")}', '${ch.dueDate}', ${ch.amount}, '${ch.type}', '${ch.status}', '${ch.personName.replace(/'/g, "''")}', '${ch.description.replace(/'/g, "''")}');\n`;
  });
  sql += `\n`;

  db.units.forEach(u => {
    sql += `INSERT OR REPLACE INTO units VALUES ('${u.id}', '${u.projectId}', '${u.unitNumber}', '${u.floor}', ${u.area}, ${u.pricePerMeter}, ${u.totalPrice}, '${u.status}', '${u.buyerName || ""}', ${u.downPayment || 0}, '${u.barterProperty || ""}');\n`;
  });

  res.setHeader("Content-Disposition", "attachment; filename=cloudflare-d1-construction-schema.sql");
  res.setHeader("Content-Type", "application/sql");
  res.send(sql);
});

// 12. Windows PowerShell Backup Script Generator
app.get("/api/export/backup-script", (req, res) => {
  const hostUrl = process.env.APP_URL || `http://localhost:3000`;
  const powershellScript = `# Construction Accounting System (Cloudflare Workers & D1 / Local DB) - Automatic Windows Backup Script
# Place this script on your Windows machine and register it in Windows Task Scheduler (e.g., every 4 hours)
# Author: AI Studio Construction Accounting Suite

$BackupDir = Join-Path $HOME "Documents\\ConstructionAccountingBackups"
if (!(Test-Path $BackupDir)) {
    New-Item -ItemType Directory -Path $BackupDir | Out-Null
    Write-Host "Created backup folder: $BackupDir" -ForegroundColor Green
}

$Timestamp = Get-Date -Format "yyyy-MM-dd_HH-mm-ss"
$BackupFile = Join-Path $BackupDir "Accounting_Backup_$Timestamp.json"

# Option A: Pulling active database backup from Cloud API
$ApiUrl = "${hostUrl}/api/db"
Write-Host "Attempting backup from Cloud API: $ApiUrl" -ForegroundColor Cyan

try {
    Invoke-RestMethod -Uri $ApiUrl -Method Get -OutFile $BackupFile -TimeoutSec 15
    Write-Host "Successfully backup saved locally to: $BackupFile" -ForegroundColor Green
} catch {
    Write-Warning "Could not reach remote cloud server. Attempting Option B (Cloudflare D1 Local SQLite Extraction)..."
    
    # Option B: Run Wrangler CLI if local project development environment is set up
    # If using Cloudflare D1 database:
    # Set the target D1 Database Name from your wrangler.toml
    $D1_DB_NAME = "construction-accounting-db"
    $LocalSqlDump = Join-Path $BackupDir "D1_Export_$Timestamp.sql"
    
    try {
        & npx wrangler d1 export $D1_DB_NAME --remote --output=$LocalSqlDump
        Write-Host "Successfully exported Cloudflare D1 remote database into: $LocalSqlDump" -ForegroundColor Green
    } catch {
        Write-Error "Backup failed completely! Please check internet connection, Wrangler login, or if the API URL is accessible."
    }
}

# Auto-prune backups older than 30 days to save space on Windows
$DaysToKeep = 30
Get-ChildItem -Path $BackupDir | Where-Object { $_.LastWriteTime -lt (Get-Date).AddDays(-$DaysToKeep) } | Remove-Item -Force
Write-Host "Auto-cleanup complete: Backups older than $DaysToKeep days have been pruned." -ForegroundColor Yellow
`;

  res.setHeader("Content-Disposition", "attachment; filename=windows-auto-backup.ps1");
  res.setHeader("Content-Type", "text/plain; charset=utf-8");
  res.send(powershellScript);
});

// --- Automated Local Backup and Cloudflare Worker Online Sync background loop ---
let isProcessingAutoBackupSync = false;

async function runAutoBackupAndSync() {
  if (isProcessingAutoBackupSync) return;
  isProcessingAutoBackupSync = true;
  
  try {
    const settings = readSettings();
    const intervalHours = Number(settings.autoBackupSyncIntervalHours);
    
    if (!intervalHours || intervalHours <= 0) {
      isProcessingAutoBackupSync = false;
      return;
    }
    
    const intervalMs = intervalHours * 60 * 60 * 1000;
    const now = Date.now();
    
    // 1. Local Auto Backup
    const lastBackup = settings.lastAutoBackupTime ? new Date(settings.lastAutoBackupTime).getTime() : 0;
    if (now - lastBackup >= intervalMs) {
      console.log(`[AutoBackup] Starting automated backup (Interval: ${intervalHours}h)...`);
      const backupsDir = path.join(process.cwd(), "backups");
      if (!fs.existsSync(backupsDir)) {
        fs.mkdirSync(backupsDir, { recursive: true });
      }
      
      const db = readDb();
      const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
      const backupFilename = `backup_db_${timestamp}.json`;
      const backupPath = path.join(backupsDir, backupFilename);
      
      fs.writeFileSync(backupPath, JSON.stringify(db, null, 2), "utf-8");
      console.log(`[AutoBackup] Backup successfully written to ${backupPath}`);
      
      // Clean up old backups: keep only last 10 backups
      const files = fs.readdirSync(backupsDir)
        .filter(f => f.startsWith("backup_db_") && f.endsWith(".json"))
        .map(f => ({ name: f, time: fs.statSync(path.join(backupsDir, f)).mtime.getTime() }));
        
      if (files.length > 10) {
        files.sort((a, b) => a.time - b.time); // oldest first
        const toDeleteCount = files.length - 10;
        for (let i = 0; i < toDeleteCount; i++) {
          const filePathToDelete = path.join(backupsDir, files[i].name);
          fs.unlinkSync(filePathToDelete);
          console.log(`[AutoBackup] Deleted old backup file: ${files[i].name}`);
        }
      }
      
      settings.lastAutoBackupTime = new Date().toISOString();
      writeSettings(settings);
    }
    
    // 2. Cloudflare D1 Auto Sync
    const lastSync = settings.lastAutoSyncTime ? new Date(settings.lastAutoSyncTime).getTime() : 0;
    if (settings.cfWorkerUrl && settings.syncToken && (now - lastSync >= intervalMs)) {
      console.log(`[AutoSync] Starting automated online sync (Interval: ${intervalHours}h)...`);
      
      const db = readDb();
      const syncDbUrl = `${settings.cfWorkerUrl.replace(/\/+$/, "")}/api/db/import`;
      const syncDbResponse = await fetch(syncDbUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-sync-token": settings.syncToken
        },
        body: JSON.stringify(db)
      });
      
      if (!syncDbResponse.ok) {
        throw new Error(`Cloudflare response status: ${syncDbResponse.status}`);
      }
      
      // Also sync files if uploads directory exists
      const uploadsDir = settings.uploadsPath || path.join(process.cwd(), "uploads");
      if (fs.existsSync(uploadsDir)) {
        const files = fs.readdirSync(uploadsDir);
        for (const filename of files) {
          const filePath = path.join(uploadsDir, filename);
          if (fs.statSync(filePath).isFile()) {
            const fileBuffer = fs.readFileSync(filePath);
            const base64Data = fileBuffer.toString("base64");
            
            const ext = path.extname(filename).toLowerCase();
            let mime = "image/png";
            if (ext === ".jpg" || ext === ".jpeg") mime = "image/jpeg";
            else if (ext === ".pdf") mime = "application/pdf";
            
            const dataUri = `data:${mime};base64,${fileBuffer.toString("base64")}`;
            const syncFileUrl = `${settings.cfWorkerUrl.replace(/\/+$/, "")}/api/uploads/${filename}`;
            
            await fetch(syncFileUrl, {
              method: "POST",
              headers: {
                "Content-Type": "text/plain",
                "x-sync-token": settings.syncToken
              },
              body: dataUri
            });
          }
        }
      }
      
      console.log("[AutoSync] Automated online sync finished successfully!");
      settings.lastAutoSyncTime = new Date().toISOString();
      writeSettings(settings);
    }
  } catch (err: any) {
    console.error("[AutoBackupSync] Error in background job:", err.message || err);
  } finally {
    isProcessingAutoBackupSync = false;
  }
}

// Serve frontend with Vite middleware / SPA router
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    let distPath = path.join(process.cwd(), "dist");
    if (fs.existsSync(path.join(__dirname, "index.html"))) {
      distPath = __dirname;
    } else if (fs.existsSync(path.join(__dirname, "dist", "index.html"))) {
      distPath = path.join(__dirname, "dist");
    }
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
    
    // Start automated background backup & sync check immediately, then run every 2 minutes
    runAutoBackupAndSync();
    setInterval(runAutoBackupAndSync, 2 * 60 * 1000);
  });
}

startServer();
