export interface Company {
  id: string;
  name: string;
  code: string;
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  address: string;
  totalArea: number;
  budget: number;
  stages: string[];
  currentStage: string;
  status: "active" | "completed" | "paused";
  supervisorName?: string;
  numberOfUnits?: number; // تعداد واحدهای پروژه
  defaultUnitArea?: number; // متراژ هر واحد
  defaultUnitPrice?: number; // قیمت هر متر واحد
  isDeleted?: boolean;
  deletedAt?: string;
}

export interface User {
  id: string;
  name: string;
  role: "manager" | "accountant" | "investor" | "supervisor";
  roleName: string;
  username?: string;
  password?: string;
}

export interface Account {
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

export interface Contact {
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
  barterUnits?: { unitId: string; area: number; price: number; selectionType?: "specific" | "scoring" }[]; // واحدهای تهاتر شده
  roles?: string[]; // نقش‌های چندگانه طرف حساب
  balance: number;
  createdAt?: string;
  projectId?: string; // پروژه مورد نظر در صورت تهاتر یا ارتباط مستقیم
}

export interface ImprestFund {
  id: string;
  projectId: string;
  contactId: string;
  allocatedLimit: number;
  balance: number;
  status: "active" | "locked" | "closed";
  lastReconciliationDate?: string;
  createdAt: string;
}

export interface ImprestExpense {
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

export interface PreSale {
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
}

export interface PreSaleInstallment {
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

export interface AlertLog {
  id: string;
  type: "installment" | "check" | "imprest_lock";
  referenceId: string;
  recipientPhone: string;
  message: string;
  sendDate: string;
  isSent: boolean;
}

export interface Material {
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

export interface MaterialTransaction {
  id: string;
  projectId: string;
  materialId: string;
  type: "in" | "out";
  quantity: number;
  unitPrice: number;
  date: string;
  personName: string;
  description: string;
}

export interface TransactionPayment {
  id: string;
  amount: number;
  date: string;
  accountId: string;
  referenceNumber: string; // شماره سند پرداخت / فیش
  settlementMethod?: string; // روش تسویه
  paymentStatus?: string; // وضعیت پرداخت
  destinationAccount?: string; // شماره حساب واریزی
  receiptFileName?: string; // پیوست فیزیکی فیش واریزی
  receiptFileData?: string; // داده تصویر فیش واریزی
  description?: string;
}

export interface Transaction {
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
  isNonCash: boolean;
  barterDetails?: {
    propertyType: string;
    description: string;
    agreedValue: number;
  };
  attachmentName?: string;
  attachmentData?: string;
  receiptRefNumber?: string; // شماره فیش / سند تسویه
  receiptFileName?: string; // نام فایل تصویر فیش واریز
  receiptFileData?: string; // محتوای تصویر فیش واریز
  paymentStatus?: "unpaid" | "partially_paid" | "paid";
  payments?: TransactionPayment[];
  preSaleId?: string;
  isDeleted?: boolean;
}

export interface CheckItem {
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

export interface UnitItem {
  id: string;
  projectId: string;
  unitNumber: string;
  floor: string;
  area: number;
  pricePerMeter: number;
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

export interface DatabaseSchema {
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

