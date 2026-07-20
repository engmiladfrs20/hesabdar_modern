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

const SETTINGS_FILE = path.join(process.cwd(), "settings.json");

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
}

const DEFAULT_SETTINGS: AppSettings = {
  dbPath: path.join(process.cwd(), "db.json"),
  uploadsPath: path.join(process.cwd(), "uploads"),
  cfApiToken: "",
  cfAccountId: "",
  cfWorkerName: "construction-accounting-worker",
  cfWorkerUrl: "",
  autoBackupSyncIntervalHours: 0,
  lastAutoBackupTime: "",
  lastAutoSyncTime: ""
};

function readSettings(): AppSettings {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const data = fs.readFileSync(SETTINGS_FILE, "utf-8");
      return { ...DEFAULT_SETTINGS, ...JSON.parse(data) };
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
  const settings = readSettings();
  return settings.dbPath || process.env.OFFLINE_DB_PATH || path.join(process.cwd(), "db.json");
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
  amount: number;
  date: string;
  accountId?: string;
  referenceNumber?: string;
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
  category: string; // علی‌الحساب، آورده، خرید مصالح، دستمزد، پیش‌فروش، تهاتر، امور مالیاتی، سایر
  subCategory?: string; // مرحله ساخت مربوطه
  amount: number;
  accountId: string; // بانک یا صندوق مربوطه
  personName: string; // نام شخص، پیمانکار، سرمایه‌گذار
  date: string; // تاریخ هجری شمسی یا میلادی
  description: string;
  isNonCash: boolean;
  barterDetails?: {
    propertyType: string; // ملک، خودرو، زمین
    description: string;
    agreedValue: number;
  };
  attachmentName?: string;
  attachmentData?: string; // Base64 simulated document
  receiptRefNumber?: string;
  receiptFileName?: string;
  receiptFileData?: string;
  paymentStatus?: "paid" | "partially_paid" | "unpaid";
  payments?: TransactionPayment[];
  preSaleId?: string;
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
  dueDate: string; // تاریخ سررسید شمسی
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
  floor: string;
  area: number; // متراژ متر مربع
  pricePerMeter: number; // قیمت هر متر مربع
  totalPrice: number;
  status: "available" | "pre_sold" | "sold" | "bartered";
  buyerName?: string;
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
  bankIBAN?: string; // شماره شبا
  jobCategory?: string; // نوع صنف کاری
  paymentMethod?: "cash" | "barter"; // نقدی یا تهاتر
  barterUnits?: { unitId: string; area: number; price: number }[]; // واحدهای تهاتر شده
  roles?: string[]; // نقش‌های چندگانه طرف حساب
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
  companies: [
    { id: "c1", name: "شرکت عمرانی رادین سازه شیراز", code: "10243" },
    { id: "c2", name: "پیشگامان مسکن مهرگان", code: "55890" }
  ],
  projects: [
    {
      id: "p1",
      companyId: "c1",
      name: "پروژه مسکونی مروارید نیاوران",
      address: "تهران، نیاوران، خیابان یاسر، پلاک ۱۲",
      totalArea: 2400,
      budget: 48000000000, // ۴۸ میلیارد تومان
      stages: SEED_STAGES,
      currentStage: "۱۰. اسکلت بتنی",
      status: "active"
    },
    {
      id: "p2",
      companyId: "c1",
      name: "مجتمع تجاری آرامش سعادت‌آباد",
      address: "تهران، سعادت‌آباد، میدان کاج، نبش خیابان نهم",
      totalArea: 5500,
      budget: 120000000000, // ۱۲۰ میلیارد تومان
      stages: SEED_STAGES,
      currentStage: "۸. گودبرداری و پایدارسازی",
      status: "active"
    }
  ],
  users: [
    { id: "u1", name: "مهندس میلاد فرخی", role: "manager", roleName: "مدیر ارشد پروژه" },
    { id: "u2", name: "خانم مریم احمدی", role: "accountant", roleName: "حسابدار مالی" },
    { id: "u3", name: "حاج علی عباسی", role: "investor", roleName: "سرمایه‌گذار شریک" },
    { id: "u4", name: "مهندس میلاد فرخی", role: "supervisor", roleName: "مهندس ارشد پروژه" }
  ],
  accounts: [
    { id: "a1", name: "بانک ملی - جاری کارفرما (۱۴۰۲)", type: "bank", typeName: "بانک تجاری", accountNumber: "0105432109002", bankName: "ملی ایران", balance: 14200000000, code: "101001", level: 3, parentCode: "101", nature: "debtor" },
    { id: "a2", name: "بانک سامان - حساب پروژه مروارید", type: "bank", typeName: "بانک تجاری", accountNumber: "820-410-432190-1", bankName: "سامان", balance: 8500000000, code: "101002", level: 3, parentCode: "101", nature: "debtor" },
    { id: "a3", name: "تنخواه مهندس میلاد فرخی (نیاوران)", type: "petty_cash", typeName: "تنخواه گردان کارگاه", balance: 450000000, code: "101003", level: 3, parentCode: "101", nature: "debtor" },
    { id: "a4", name: "تنخواه مهندس کریمی (سعادت‌آباد)", type: "petty_cash", typeName: "تنخواه گردان کارگاه", balance: 350000000, code: "101004", level: 3, parentCode: "101", nature: "debtor" },
    { id: "a5", name: "آورده نقدی حاج علی عباسی", type: "investor", typeName: "حساب شریک/سرمایه‌گذار", balance: 25000000000, code: "301001", level: 3, parentCode: "301", nature: "creditor" },
    { id: "a6", name: "صندوق مرکزی دفتر مرکزی", type: "cash", typeName: "صندوق نقد دفتر", balance: 120000000, code: "101010", level: 3, parentCode: "101", nature: "debtor" }
  ],
  contacts: [
    { id: "co1", name: "خانم دکتر مهدوی", phone: "09121111111", role: "pre_buyer", nationalId: "0012233445", bankCardNumber: "6037991122334455", balance: 23800000000 },
    { id: "co2", name: "مهندس شفیعی", phone: "09122222222", role: "pre_buyer", nationalId: "0022233446", bankCardNumber: "6104332211005544", balance: 30400000000 },
    { id: "co3", name: "شرکت فلزات آریا", phone: "02188888888", role: "subcontractor", nationalId: "10100293810", balance: -8000000000 },
    { id: "co4", name: "صنایع بتن تهران کادوس", phone: "02144444444", role: "supplier", nationalId: "14002931201", balance: -1800000000 },
    { id: "co5", name: "مهندس میلاد فرخی", phone: "09123333333", role: "imprest_holder", nationalId: "0033344556", balance: 450000000 },
    { id: "co6", name: "مهندس کریمی", phone: "09124444444", role: "imprest_holder", nationalId: "0044455667", balance: 350000000 }
  ],
  imprestFunds: [
    { id: "im1", projectId: "p1", contactId: "co5", allocatedLimit: 500000000, balance: 450000000, status: "active", createdAt: "1403/01/10" },
    { id: "im2", projectId: "p2", contactId: "co6", allocatedLimit: 400000000, balance: 350000000, status: "active", createdAt: "1403/01/12" }
  ],
  imprestExpenses: [
    { id: "ie1", imprestId: "im1", expenseDate: "1403/02/12", amount: 50000000, description: "خرید لوله اتصالات پلیکا فاضلابی کارگاه", materialCategory: "تأسیسات", status: "approved" }
  ],
  preSales: [
    { id: "ps1", projectId: "p1", contactId: "co1", unitId: "u_p1_301", contractArea: 140, pricePerMeter: 170000000, totalPrice: 23800000000, contractDate: "1403/01/20", status: "active" },
    { id: "ps2", projectId: "p1", contactId: "co2", unitId: "u_p1_402", contractArea: 160, pricePerMeter: 190000000, totalPrice: 30400000000, contractDate: "1403/02/01", status: "active" }
  ],
  preSaleInstallments: [
    { id: "psi1", preSaleId: "ps1", installmentName: "پیش‌پرداخت (عقد قرارداد)", dueDate: "1403/01/20", amount: 8000000000, isPaid: true, paidDate: "1403/01/20" },
    { id: "psi2", preSaleId: "ps1", installmentName: "پایان پی‌ریزی و فونداسیون", dueDate: "1403/03/10", amount: 2380000000, isPaid: false },
    { id: "psi3", preSaleId: "ps1", installmentName: "پایان اسکلت و سازه", dueDate: "1403/05/15", amount: 3570000000, isPaid: false },
    { id: "psi4", preSaleId: "ps2", installmentName: "پیش‌پرداخت (عقد قرارداد)", dueDate: "1403/02/01", amount: 15000000000, isPaid: true, paidDate: "1403/02/01" }
  ],
  alertsLog: [],
  materials: [
    { id: "m1", name: "میلگرد آجدار سایز ۱۶ ذوب آهن", category: "فولاد و آهن‌آلات", unit: "تن", stock: 45, averagePrice: 285000000 },
    { id: "m2", name: "سیمان پرتلند تیپ ۲ ساوه", category: "سیمان و گچ", unit: "پاکت", stock: 1200, averagePrice: 85000 },
    { id: "m3", name: "بتن آماده عیار ۳۵۰ استاندارد", category: "بتن و پایدارسازی", unit: "متر مکعب", stock: 0, averagePrice: 1650000 },
    { id: "m4", name: "بلوک سبک لیکا سایز ۱۵", category: "دیوارچینی", unit: "عدد", stock: 8500, averagePrice: 12500 },
    { id: "m5", name: "لوله پنج لایه نیوپایپ سایز ۲0", category: "تأسیسات", unit: "متر", stock: 600, averagePrice: 68000 }
  ],
  materialTransactions: [
    { id: "mt1", projectId: "p1", materialId: "m1", type: "in", quantity: 20, unitPrice: 280000000, date: "1403/02/10", personName: "آهن‌آلات برادران رضایی", description: "خرید میلگرد برای اسکلت نیاوران" },
    { id: "mt2", projectId: "p1", materialId: "m1", type: "out", quantity: 12, unitPrice: 280000000, date: "1403/02/15", personName: "مهندس اکبری", description: "تحویل به کارگاه جهت بافت آرماتور فونداسیون" },
    { id: "mt3", projectId: "p2", materialId: "m2", type: "in", quantity: 500, unitPrice: 82000, date: "1403/03/01", personName: "مصالح ساختمانی پارس", description: "تأمین سیمان سفت‌کاری پروژه تجاری" },
    { id: "mt4", projectId: "p2", materialId: "m2", type: "out", quantity: 350, unitPrice: 82000, date: "1403/03/05", personName: "مهندس کریمی", description: "مصرف جهت ملات دیوارچینی طبقه منفی یک" }
  ],
  transactions: [
    {
      id: "t1",
      companyId: "c1",
      projectId: "p1",
      type: "expense",
      category: "خرید مصالح",
      subCategory: "خاک‌برداری و پی‌ریزی",
      amount: 5600000000, // ۵۶۰ میلیون تومان
      accountId: "a2",
      personName: "آهن‌آلات برادران رضایی",
      date: "1403/02/10",
      description: "خرید ۲۰ تن میلگرد آجدار سایز ۱۶",
      isNonCash: false,
      attachmentName: "factor_milgard_16.pdf",
      attachmentData: "JVBERi0xLjQKJSDi498gZW50ZXI=" // Simulated PDF content
    },
    {
      id: "t2",
      companyId: "c1",
      projectId: "p1",
      type: "expense",
      category: "دستمزد",
      subCategory: "خاک‌برداری و پی‌ریزی",
      amount: 1200000000,
      accountId: "a3",
      personName: "پیمانکار آرماتوربندی استاد قاسمی",
      date: "1403/02/18",
      description: "پرداخت قسط اول دستمزد آرماتوربندی فونداسیون",
      isNonCash: false
    },
    {
      id: "t_ps_down_ps1",
      companyId: "c1",
      projectId: "p1",
      type: "income",
      category: "پیش‌فروش",
      amount: 8000000000,
      accountId: "a1",
      personName: "خانم دکتر مهدوی",
      date: "1403/01/20",
      description: "پیش‌دریافت پیش‌پرداخت قرارداد پیش‌فروش واحد ۳۰۱ مروارید",
      isNonCash: false,
      preSaleId: "ps1"
    },
    {
      id: "t3",
      companyId: "c1",
      projectId: "p1",
      type: "income",
      category: "پیش‌فروش",
      amount: 15000000000, // ۱.۵ میلیارد تومان
      accountId: "a2",
      personName: "مهندس شفیعی (خریدار واحد ۴۰۲)",
      date: "1403/03/01",
      description: "دریافت قسط اول پیش‌فروش واحد مسکونی ۴۰۲ نیاوران",
      isNonCash: false,
      preSaleId: "ps2"
    },
    {
      id: "t4",
      companyId: "c1",
      projectId: "p1",
      type: "income",
      category: "آورده",
      amount: 10000000000, // ۱ میلیارد تومان
      accountId: "a1",
      personName: "حاج علی عباسی",
      date: "1403/01/15",
      description: "واریز آورده نقدی شریک جهت شروع فاز اسکلت",
      isNonCash: false
    },
    {
      id: "t5",
      companyId: "c1",
      projectId: "p2",
      type: "expense",
      category: "تهاتر",
      amount: 8000000000, // ۸۰۰ میلیون تومان
      accountId: "a1",
      personName: "شرکت فلزات آریا",
      date: "1403/03/20",
      description: "تهاتر ارزش اسکلت فلزی با واگذاری واحد ۱0۱ تجاری",
      isNonCash: true,
      barterDetails: {
        propertyType: "واحد تجاری شماره ۱۰۱",
        description: "واگذاری سند موقت پیش‌فروش واحد تجاری به مساحت ۴۵ مترمربع در طبقه همکف",
        agreedValue: 8000000000
      }
    }
  ],
  checks: [
    {
      id: "ch1",
      companyId: "c1",
      projectId: "p1",
      checkNumber: "4509/821033",
      bankName: "سامان شعبه نیاوران",
      dueDate: "1403/04/15",
      amount: 1800000000,
      type: "outgoing",
      status: "pending",
      personName: "صنایع بتن تهران کادوس",
      description: "خرید سیمان و بتن آماده عیار ۳۵۰ فونداسیون"
    },
    {
      id: "ch2",
      companyId: "c1",
      projectId: "p2",
      checkNumber: "122/8879410",
      bankName: "ملی ایران شعبه مرکزی",
      dueDate: "1403/03/25",
      amount: 3200000000,
      type: "outgoing",
      status: "passed",
      personName: "مهندس صادقی (پیمانکار اسکلت فلزی)",
      description: "پرداخت بابت نصب ستون‌های سگمنت پارت اول"
    },
    {
      id: "ch3",
      companyId: "c1",
      projectId: "p1",
      checkNumber: "99041235",
      bankName: "پاسارگاد شعبه اندرزگو",
      dueDate: "1403/05/10",
      amount: 2500000000,
      type: "incoming",
      status: "pending",
      personName: "خانم دکتر مهدوی (خریدار واحد ۳۰۱)",
      description: "چک سررسید مرحله اتمام سفت‌کاری واحد ۳۰۱"
    }
  ],
  units: [
    {
      id: "u_p1_101",
      projectId: "p1",
      unitNumber: "۱۰۱",
      floor: "اول",
      area: 120,
      pricePerMeter: 150000000, // ۱۵۰ میلیون تومان
      totalPrice: 18000000000,
      status: "available",
      specificExpenses: [
        { id: "se1", title: "طراحی کناف اختصاصی سالن", amount: 150000000, date: "1403/02/20" }
      ]
    },
    {
      id: "u_p1_301",
      projectId: "p1",
      unitNumber: "۳۰۱",
      floor: "سوم",
      area: 140,
      pricePerMeter: 170000000,
      totalPrice: 23800000000,
      status: "pre_sold",
      buyerName: "خانم دکتر مهدوی",
      downPayment: 8000000000,
      specificExpenses: []
    },
    {
      id: "u_p1_402",
      projectId: "p1",
      unitNumber: "۴۰۲",
      floor: "چهارم",
      area: 160,
      pricePerMeter: 190000000,
      totalPrice: 30400000000,
      status: "pre_sold",
      buyerName: "مهندس شفیعی",
      downPayment: 15000000000,
      specificExpenses: [
        { id: "se2", title: "تغییر سیستم گرمایشی به مینی چیلر اختصاصی", amount: 450000000, date: "1403/02/25" }
      ]
    },
    {
      id: "u_p2_101",
      projectId: "p2",
      unitNumber: "۱۰۱ تجاری",
      floor: "همکف",
      area: 45,
      pricePerMeter: 350000000,
      totalPrice: 15750000000,
      status: "bartered",
      buyerName: "شرکت فلزات آریا",
      barterProperty: "تهاتر با ۸۰ تن سازه اسکلت فلزی کارخانه آریا",
      specificExpenses: []
    }
  ]
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

// 1. Get entire DB
app.get("/api/db", (req, res) => {
  res.json(readDb());
});

// 2. Reset database to default mock state
app.post("/api/db/reset", (req, res) => {
  writeDb(DEFAULT_DB);
  res.json({ status: "success", message: "پایگاه داده با اطلاعات دمو مجددا بارگذاری شد" });
});

// 2b. Import and synchronize complete database (Offline Sync)
app.post("/api/db/import", (req, res) => {
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

    // Merge or overwrite database
    writeDb(incomingDb);
    res.json({ 
      status: "success", 
      message: "پایگاه داده آفلاین با موفقیت همگام‌سازی و روی سرور اصلی اعمال شد.",
      statistics: {
        projects: incomingDb.projects.length,
        transactions: incomingDb.transactions.length,
        accounts: incomingDb.accounts.length,
        contacts: incomingDb.contacts.length,
        checks: incomingDb.checks.length,
        materials: incomingDb.materials.length
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

// 3. Add Project
app.post("/api/projects", (req, res) => {
  const db = readDb();
  const newProject: Project = {
    id: req.body.id || "p_" + Date.now(),
    companyId: req.body.companyId || "c1",
    name: req.body.name,
    address: req.body.address,
    totalArea: Number(req.body.totalArea || 0),
    budget: Number(req.body.budget || 0),
    stages: req.body.stages || SEED_STAGES,
    currentStage: req.body.currentStage || SEED_STAGES[0],
    status: req.body.status || "active",
    supervisorName: req.body.supervisorName || "مهندس میلاد فرخی"
  };

  // Check if exists (update) or create new
  const index = db.projects.findIndex(p => p.id === newProject.id);
  const isNew = index < 0;
  if (!isNew) {
    db.projects[index] = newProject;
  } else {
    db.projects.push(newProject);
  }

  // Auto-generate units if requested (only for newly created projects)
  if (isNew && req.body.numberOfUnits && Number(req.body.numberOfUnits) > 0) {
    const numUnits = Number(req.body.numberOfUnits);
    const defArea = Number(req.body.defaultUnitArea || 100);
    const defPrice = Number(req.body.defaultUnitPrice || 35000000);
    
    if (!db.units) db.units = [];
    for (let i = 1; i <= numUnits; i++) {
      const unitNumber = String(100 + i);
      const floor = String(Math.ceil(i / 2)); // 2 units per floor
      db.units.push({
        id: "u_" + Date.now() + "_" + i + "_" + Math.floor(Math.random() * 100),
        projectId: newProject.id,
        unitNumber,
        floor,
        area: defArea,
        pricePerMeter: defPrice,
        totalPrice: defArea * defPrice,
        status: "available",
        specificExpenses: []
      });
    }
  }

  writeDb(db);
  res.json({ status: "success", project: newProject });
});

// 4. Add Company
app.post("/api/companies", (req, res) => {
  const db = readDb();
  const newCompany: Company = {
    id: "c_" + Date.now(),
    name: req.body.name,
    code: req.body.code || String(Math.floor(Math.random() * 90000) + 10000)
  };
  db.companies.push(newCompany);
  writeDb(db);
  res.json({ status: "success", company: newCompany });
});

// 5. Add/Update Account
app.post("/api/accounts", (req, res) => {
  const db = readDb();
  const newAccount: Account = {
    id: req.body.id || "a_" + Date.now(),
    name: req.body.name,
    type: req.body.type,
    typeName: req.body.typeName || "حساب",
    accountNumber: req.body.accountNumber,
    bankName: req.body.bankName,
    balance: Number(req.body.balance || 0),
    projectId: req.body.projectId || undefined
  };

  const index = db.accounts.findIndex(a => a.id === newAccount.id);
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

// 6. Add/Update Transaction (Receipts & Payments)
app.post("/api/transactions", (req, res) => {
  const db = readDb();
  
  const existingIndex = db.transactions.findIndex(t => t.id === req.body.id);
  if (existingIndex >= 0) {
    const oldTx = db.transactions[existingIndex];
    // Revert old transaction balance adjustments
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
  }

  const newTransaction: Transaction = {
    id: req.body.id || "t_" + Date.now(),
    companyId: req.body.companyId || "c1",
    projectId: req.body.projectId,
    type: req.body.type, // income / expense
    category: req.body.category,
    subCategory: req.body.subCategory,
    amount: Number(req.body.amount || 0),
    accountId: req.body.accountId,
    personName: req.body.personName,
    date: req.body.date || "1403/01/01",
    description: req.body.description || "",
    isNonCash: !!req.body.isNonCash,
    barterDetails: req.body.barterDetails,
    attachmentName: req.body.attachmentName,
    attachmentData: req.body.attachmentData, // base64 document attachment
    paymentStatus: req.body.paymentStatus || (req.body.type === "expense" ? "paid" : "paid"),
    payments: req.body.payments || [],
    approvalStatus: req.body.approvalStatus || (req.body.type === "expense" ? "pending" : "approved"),
    approvedAmount: req.body.approvedAmount !== undefined ? Number(req.body.approvedAmount) : undefined,
    approvedBy: req.body.approvedBy,
    approvedDate: req.body.approvedDate
  };

  // If status is paid and payments is empty, automatically create a single full payment
  if (newTransaction.type === "expense" && !newTransaction.isNonCash && newTransaction.paymentStatus === "paid" && (!newTransaction.payments || newTransaction.payments.length === 0)) {
    newTransaction.payments = [{
      id: "p_" + Date.now(),
      amount: newTransaction.amount,
      date: newTransaction.date,
      accountId: newTransaction.accountId,
      referenceNumber: req.body.referenceNumber || "تسویه نقدی فوری",
      description: "ثبت همزمان با فاکتور"
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

  // Auto-pairing with pre-sales if personName matches a pre-buyer contact
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
        
        // Let's also attach the projectId if not set or empty
        if (!newTransaction.projectId) {
          newTransaction.projectId = preSale.projectId;
        }
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
    amount, 
    date, 
    accountId, 
    referenceNumber, 
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
  
  const newPayment = {
    id: "p_" + Date.now(),
    amount: Number(amount),
    date: date || "1403/01/01",
    accountId,
    referenceNumber: referenceNumber || "",
    settlementMethod: settlementMethod || "فیش بانکی",
    paymentStatus: paymentStatus || "موفق",
    destinationAccount: destinationAccount || "",
    receiptFileName: savedReceiptName,
    receiptFileData: receiptFileData || "",
    description: description || ""
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
  
  // Deduct from bank account balance
  if (accountId) {
    const acc = db.accounts.find(a => a.id === accountId);
    if (acc) {
      acc.balance -= Number(amount);
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
      date: req.body.date || "1403/01/01",
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
        if (mat) {
          if (tx.type === "in") {
            mat.stock = Math.max(0, mat.stock - tx.quantity);
          } else {
            mat.stock += tx.quantity;
          }
        }
        db.materialTransactions.splice(idx, 1);
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
    // If we're adding a specific expense to this unit
    if (req.body.addExpense) {
      const expenseItem = {
        id: "se_" + Date.now(),
        title: req.body.addExpense.title,
        amount: Number(req.body.addExpense.amount),
        date: req.body.addExpense.date || "1403/01/01"
      };
      db.units[idx].specificExpenses.push(expenseItem);

      // Also log as an expense in transaction logs
      const tx: Transaction = {
        id: "t_unit_exp_" + Date.now(),
        companyId: "c1",
        projectId: db.units[idx].projectId,
        type: "expense",
        category: "هزینه اختصاصی واحد " + db.units[idx].unitNumber,
        amount: expenseItem.amount,
        accountId: "a2", // bank account default
        personName: db.units[idx].buyerName || "کارفرما",
        date: expenseItem.date,
        description: `هزینه ساخت سفارشی برای واحد ${db.units[idx].unitNumber}: ${expenseItem.title}`,
        isNonCash: false
      };
      db.transactions.push(tx);
    } else {
      // General update of unit status/pre-sales/barter
      const updatedUnit = { ...db.units[idx], ...req.body };
      db.units[idx] = updatedUnit;

      // If unit status changed to sold / pre_sold, register an income transaction!
      if (req.body.status === "pre_sold" || req.body.status === "sold") {
        const tx: Transaction = {
          id: "t_sale_" + Date.now(),
          companyId: "c1",
          projectId: db.units[idx].projectId,
          type: "income",
          category: req.body.status === "pre_sold" ? "پیش‌فروش" : "فروش واحد",
          amount: Number(req.body.downPayment || 0),
          accountId: "a1", // default account
          personName: req.body.buyerName || "خریدار واحد",
          date: "1403/01/01",
          description: `پیش‌دریافت بابت فروش واحد شماره ${db.units[idx].unitNumber} به مساحت ${db.units[idx].area} مترمربع`,
          isNonCash: false
        };
        db.transactions.push(tx);
      } else if (req.body.status === "bartered") {
        const tx: Transaction = {
          id: "t_barter_" + Date.now(),
          companyId: "c1",
          projectId: db.units[idx].projectId,
          type: "income",
          category: "تهاتر",
          amount: Number(db.units[idx].totalPrice),
          accountId: "a1",
          personName: req.body.buyerName || "طرف تهاتر",
          date: "1403/01/01",
          description: `تهاتر کامل واحد شماره ${db.units[idx].unitNumber} بابت: ${req.body.barterProperty}`,
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

    writeDb(db);
    res.json({ status: "success", unit: db.units[idx] });
  } else {
    // Add new unit
    const newUnit: UnitItem = {
      id: "u_" + (req.body.projectId || "p1") + "_" + (req.body.unitNumber || Date.now()),
      projectId: req.body.projectId || "p1",
      unitNumber: req.body.unitNumber,
      floor: req.body.floor || "اول",
      area: Number(req.body.area || 0),
      pricePerMeter: Number(req.body.pricePerMeter || 0),
      totalPrice: Number(req.body.area || 0) * Number(req.body.pricePerMeter || 0),
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
    db.projects[idx].isDeleted = true;
    db.projects[idx].deletedAt = new Date().toISOString();
    
    // Cascade delete associated transactions
    db.transactions = db.transactions.filter(t => t.projectId !== id);
    
    // Cascade delete associated checks
    db.checks = db.checks.filter(ch => ch.projectId !== id);
    
    // Cascade delete units
    if (db.units) {
      db.units = db.units.filter(u => u.projectId !== id);
    }
    
    // Cascade delete material transactions
    if (db.materialTransactions) {
      db.materialTransactions = db.materialTransactions.filter(mt => mt.projectId !== id);
    }
    
    // Cascade delete preSales
    if (db.preSales) {
      db.preSales = db.preSales.filter(ps => ps.projectId !== id);
    }
    
    // Cascade delete imprest funds & expenses
    if (db.imprestFunds) {
      const deletedImprestIds = db.imprestFunds.filter(imp => imp.projectId === id).map(imp => imp.id);
      db.imprestFunds = db.imprestFunds.filter(imp => imp.projectId !== id);
      if (db.imprestExpenses) {
        db.imprestExpenses = db.imprestExpenses.filter(ie => !deletedImprestIds.includes(ie.imprestId));
      }
    }
  }
  writeDb(db);
  res.json({ status: "success", message: "پروژه به همراه کلیه تراکنش‌ها، واحدها و اسناد وابسته به آن حذف گردید" });
});

app.post("/api/projects/restore", (req, res) => {
  const db = readDb();
  const { id } = req.body;
  if (!db.projects) db.projects = [];
  const idx = db.projects.findIndex(p => p.id === id);
  if (idx >= 0) {
    db.projects[idx].isDeleted = false;
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
    createdAt: contact.createdAt || "1403/04/03",
    projectId: contact.projectId
  };

  // If this is a barter contact, check if we need to auto-create pre-sale contract
  if (newContact.paymentMethod === "barter" && newContact.barterUnits && newContact.barterUnits.length > 0) {
    newContact.barterUnits.forEach((bu: any) => {
      // Find if there is an existing PreSale for this contact and unit
      if (!db.preSales) db.preSales = [];
      const existingPreSale = db.preSales.find(ps => ps.contactId === id && ps.unitId === bu.unitId);
      if (!existingPreSale) {
        const preSaleId = "ps_" + Date.now() + "_" + Math.floor(Math.random() * 1000);
        const totalP = Number(bu.area || 0) * Number(bu.price || 0);
        const newPreSale: PreSale = {
          id: preSaleId,
          projectId: newContact.projectId || "p1",
          contactId: id,
          unitId: bu.unitId,
          contractArea: Number(bu.area || 0),
          pricePerMeter: Number(bu.price || 0),
          totalPrice: totalP,
          contractDate: newContact.createdAt || "1403/04/03",
          status: "active"
        };
        db.preSales.push(newPreSale);

        // Mark the unit in db.units as "bartered"
        if (!db.units) db.units = [];
        const unitIdx = db.units.findIndex(u => u.id === bu.unitId);
        if (unitIdx >= 0) {
          db.units[unitIdx].status = "bartered";
          db.units[unitIdx].buyerName = newContact.name;
        }

        // Create default installments (100% of the price as single installment)
        if (!db.preSaleInstallments) db.preSaleInstallments = [];
        db.preSaleInstallments.push({
          id: "inst_" + Date.now() + "_" + Math.floor(Math.random() * 1000),
          preSaleId: preSaleId,
          installmentName: "مبلغ کل تهاتر واحد مسکونی",
          dueDate: newContact.createdAt || "1403/04/03",
          amount: totalP,
          isPaid: false
        });
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
      db.preSales = db.preSales.filter((ps: any) => ps.contactId !== id);
      
      // Clear installments
      if (db.preSaleInstallments) {
        db.preSaleInstallments = db.preSaleInstallments.filter((inst: any) => !psIds.includes(inst.preSaleId));
      }
      
      // Update units status back to 'available' and remove buyerName
      if (db.units) {
        db.units.forEach((u: any) => {
          if (psIds.includes(u.id) || u.buyerName) {
            const isPreSold = db.preSales.some((ps: any) => ps.unitId === u.id);
            if (!isPreSold && u.status !== 'available') {
              u.status = 'available';
              u.buyerName = undefined;
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

  const newFund: ImprestFund = {
    id,
    projectId: fund.projectId,
    contactId: fund.contactId,
    allocatedLimit: Number(fund.allocatedLimit || 0),
    balance: Number(fund.balance || fund.allocatedLimit || 0),
    status: fund.status || "active",
    lastReconciliationDate: fund.lastReconciliationDate || "1403/04/03",
    createdAt: fund.createdAt || "1403/04/03"
  };

  const idx = db.imprestFunds.findIndex(f => f.id === id);
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
    expenseDate: exp.expenseDate || "1403/04/03",
    amount,
    description: exp.description,
    materialCategory: exp.materialCategory || "سایر",
    attachmentUrl: exp.attachmentUrl,
    status: exp.status || "approved",
    createdAt: "1403/04/03",
    contactId: exp.contactId,
    personName: exp.personName,
    stage: exp.stage,
    paymentStatus,
    attachmentName: exp.attachmentName,
    attachmentData: exp.attachmentData,
    payments: []
  };

  if (paidAmount > 0) {
    newExpense.payments.push({
      id: "p_" + Date.now(),
      amount: paidAmount,
      date: newExpense.expenseDate,
      accountId: fund.contactId,
      referenceNumber: exp.referenceNumber || "تسویه تنخواه",
      description: "ثبت پرداخت فاکتور از صندوق تنخواه"
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
  const ledgerTxId = "t_im_exp_" + Date.now();
  const tx: Transaction = {
    id: ledgerTxId,
    companyId: "c1",
    projectId: fund.projectId,
    type: "expense",
    category: "هزینه تنخواه",
    subCategory: `${newExpense.materialCategory} - ${newExpense.stage || "عمومی"}`,
    amount: newExpense.amount,
    accountId: "a3", // default to Akbari imprest account
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
      // Refund the imprest fund balance if it was paid
      const fund = db.imprestFunds.find(f => f.id === expense.imprestId);
      if (fund) {
        const paidAmount = expense.payments ? expense.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        fund.balance += paidAmount;
      }
      db.imprestExpenses.splice(idx, 1);
      writeDb(db);
      res.json({ status: "success", message: "هزینه تنخواه با موفقیت حذف شد" });
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
  const { expenseId, amount, date, referenceNumber, description } = req.body;

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

  const newPayment = {
    id: "p_" + Date.now(),
    amount: payVal,
    date: date || expense.expenseDate,
    accountId: fund.contactId,
    referenceNumber: referenceNumber || "",
    description: description || ""
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
  const matchedTxIdx = db.transactions.findIndex(t => t.description && t.description.includes(expense.description) && t.amount === expense.amount);
  if (matchedTxIdx >= 0) {
    db.transactions[matchedTxIdx].payments = expense.payments;
    db.transactions[matchedTxIdx].paymentStatus = expense.paymentStatus;
  }

  writeDb(db);
  res.json({ status: "success", imprestExpense: expense, imprestFund: fund });
});

// 9e. Create Pre-Sale Contract
app.post("/api/presales", (req, res) => {
  const db = readDb();
  const presale = req.body;
  const id = "ps_" + Date.now();

  const newPreSale: PreSale = {
    id,
    projectId: presale.projectId,
    contactId: presale.contactId,
    unitId: presale.unitId,
    contractArea: Number(presale.contractArea),
    pricePerMeter: Number(presale.pricePerMeter),
    totalPrice: Number(presale.totalPrice || (presale.contractArea * presale.pricePerMeter)),
    contractDate: presale.contractDate || "1403/04/03",
    status: "active"
  };

  db.preSales.push(newPreSale);

  // Update associated unit status
  const unitIdx = db.units.findIndex(u => u.id === presale.unitId);
  const buyer = db.contacts.find(c => c.id === presale.contactId);
  if (unitIdx >= 0) {
    db.units[unitIdx].status = "pre_sold";
    db.units[unitIdx].buyerName = buyer ? buyer.name : "پیش‌خریدار";
    db.units[unitIdx].downPayment = Math.round(newPreSale.totalPrice * 0.30); // 30% contract downpayment
  }

  // Generate 7-stage standard installment schedule
  const installments: PreSaleInstallment[] = [
    { id: "psi_1_" + Date.now(), preSaleId: id, installmentName: "پیش‌پرداخت (عقد قرارداد)", dueDate: newPreSale.contractDate, amount: Math.round(newPreSale.totalPrice * 0.30), isPaid: false },
    { id: "psi_2_" + Date.now(), preSaleId: id, installmentName: "پایان پی‌ریزی و فونداسیون", dueDate: "1403/06/15", amount: Math.round(newPreSale.totalPrice * 0.10), isPaid: false },
    { id: "psi_3_" + Date.now(), preSaleId: id, installmentName: "پایان اسکلت و سازه", dueDate: "1403/09/01", amount: Math.round(newPreSale.totalPrice * 0.15), isPaid: false },
    { id: "psi_4_" + Date.now(), preSaleId: id, installmentName: "پایان سفت‌کاری و دیوارچینی", dueDate: "1403/11/15", amount: Math.round(newPreSale.totalPrice * 0.15), isPaid: false },
    { id: "psi_5_" + Date.now(), preSaleId: id, installmentName: "پایان نازک‌کاری و نصبیات", dueDate: "1404/02/20", amount: Math.round(newPreSale.totalPrice * 0.10), isPaid: false },
    { id: "psi_6_" + Date.now(), preSaleId: id, installmentName: "تحویل فیزیکی واحد مسکونی", dueDate: "1404/04/01", amount: Math.round(newPreSale.totalPrice * 0.05), isPaid: false },
    { id: "psi_7_" + Date.now(), preSaleId: id, installmentName: "تنظیم سند رسمی انتقال در دفترخانه", dueDate: "1404/06/10", amount: Math.round(newPreSale.totalPrice * 0.10), isPaid: false }
  ];

  db.preSaleInstallments.push(...installments);

  // Also record downpayment transaction
  const tx: Transaction = {
    id: "t_ps_down_" + Date.now(),
    companyId: "c1",
    projectId: newPreSale.projectId,
    type: "income",
    category: "پیش‌فروش",
    amount: Math.round(newPreSale.totalPrice * 0.30),
    accountId: "a1", // Bank Melli default
    personName: buyer ? buyer.name : "پیش‌خریدار",
    date: newPreSale.contractDate,
    description: `پیش‌دریافت پیش‌پرداخت قرارداد پیش‌فروش واحد شماره ${db.units[unitIdx]?.unitNumber || ""}`,
    isNonCash: false,
    preSaleId: id
  };
  db.transactions.push(tx);

  // Update buyer contact balance (balance increases by the contract price owed, or similar)
  if (buyer) {
    buyer.balance = (buyer.balance || 0) + newPreSale.totalPrice - Math.round(newPreSale.totalPrice * 0.30);
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
      
      // Revert associated unit status
      const unitIdx = db.units.findIndex(u => u.id === presale.unitId);
      if (unitIdx >= 0) {
        db.units[unitIdx].status = "available";
        delete db.units[unitIdx].buyerName;
        delete db.units[unitIdx].downPayment;
      }
      
      // Remove installments
      db.preSaleInstallments = db.preSaleInstallments.filter(psi => psi.preSaleId !== id);
      
      // Delete presale
      db.preSales.splice(idx, 1);
      
      writeDb(db);
      res.json({ status: "success", message: "قرارداد پیش‌فروش با موفقیت حذف شد" });
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

  inst.isPaid = true;
  inst.paidDate = paidDate || "1403/04/03";

  // Find associated pre-sale & buyer
  const presale = db.preSales.find(p => p.id === inst.preSaleId);
  if (presale) {
    const buyer = db.contacts.find(c => c.id === presale.contactId);
    const unit = db.units.find(u => u.id === presale.unitId);
    
    // Register transaction
    const tx: Transaction = {
      id: "t_ps_inst_" + Date.now(),
      companyId: "c1",
      projectId: presale.projectId,
      type: "income",
      category: "پیش‌فروش",
      amount: inst.amount,
      accountId: accountId || "a1",
      personName: buyer ? buyer.name : "پیش‌خریدار",
      date: inst.paidDate,
      description: `دریافت قسط "${inst.installmentName}" قرارداد پیش‌فروش واحد ${unit ? unit.unitNumber : ""}`,
      isNonCash: false
    };
    db.transactions.push(tx);

    // Update account balance
    const acc = db.accounts.find(a => a.id === tx.accountId);
    if (acc) {
      acc.balance += tx.amount;
    }

    // Update buyer contact balance
    if (buyer) {
      buyer.balance = Math.max(0, buyer.balance - inst.amount);
    }
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
  const { preSaleId, amount, accountId, paidDate, referenceNumber, description } = req.body;

  if (!preSaleId || !amount || !accountId || !paidDate) {
    return res.status(400).json({ error: "اطلاعات سند پرداخت ناقص است. تعیین مبلغ، تاریخ و حساب بانکی الزامی است." });
  }

  const preSale = db.preSales.find(p => p.id === preSaleId);
  if (!preSale) {
    return res.status(404).json({ error: "قرارداد پیش‌فروش یافت نشد" });
  }

  const buyer = db.contacts.find(c => c.id === preSale.contactId);
  const unit = db.units.find(u => u.id === preSale.unitId);
  const acc = db.accounts.find(a => a.id === accountId);

  if (!acc) {
    return res.status(400).json({ error: "حساب مالی مشخص شده یافت نشد" });
  }

  // Register transaction
  const tx: Transaction = {
    id: "t_ps_pay_" + Date.now(),
    companyId: "c1",
    projectId: preSale.projectId,
    type: "income",
    category: "پیش‌فروش",
    amount: Number(amount),
    accountId,
    personName: buyer ? buyer.name : "پیش‌خریدار",
    date: paidDate,
    description: description || `دریافت پرداختی پیش‌فروش واحد ${unit ? unit.unitNumber : ""} - شماره سند ${referenceNumber || ""}`,
    isNonCash: false,
    preSaleId
  };
  db.transactions.push(tx);

  // Update account balance
  acc.balance += Number(amount);

  // Update buyer contact balance
  if (buyer) {
    buyer.balance = Math.max(0, (buyer.balance || 0) - Number(amount));
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
    sendDate: "1403/04/03",
    isSent: true
  };

  db.alertsLog.push(newLog);
  writeDb(db);
  res.json({ status: "success", alertLog: newLog });
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
