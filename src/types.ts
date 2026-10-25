export interface Company {
  id: string;
  name: string;
  code: string;
}

export interface FloorUnitConfig {
  floorNumber: number; // 0 for Ground floor (همکف), 1 for 1st floor, etc.
  unitsCount: number;
}

export type UnitNumberingStyle =
  | "block_floor_unit_short"
  | "block_seq_padded"
  | "block_unit"
  | "floor_unit"
  | "sequential";

export interface ProjectBlockConfig {
  name: string;
  floors: number;
  groundFloorUnits?: number;
  unitsPerFloor: number;
  floorConfigs?: FloorUnitConfig[];
  totalUnits: number;
}

export interface ProjectStageSubItem {
  id: string;
  name: string;
  code?: string;
  weight?: number;
  status?: "pending" | "in_progress" | "completed";
  progress?: number;
  description?: string;
}

export interface ProjectStageBranch {
  id: string;
  name: string;
  iconName?: string;
  status?: "pending" | "in_progress" | "completed";
  progress?: number;
  subStages: ProjectStageSubItem[];
}

export interface Project {
  id: string;
  companyId: string;
  name: string;
  address: string;
  totalArea: number;
  budget: number;
  stages: string[];
  stageTree?: ProjectStageBranch[];
  currentStage: string;
  status: "active" | "completed" | "paused";
  supervisorName?: string;
  numberOfUnits?: number;
  numberOfBlocks?: number;
  numberingStyle?: UnitNumberingStyle;
  blocks?: ProjectBlockConfig[];
  defaultUnitArea?: number;
  defaultUnitPrice?: number;
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
  permissions?: string[];
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

export interface Material {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  averagePrice: number;
  code?: string;
  subCategory?: string;
  secondaryUnit?: string;
  conversionFactor?: number;
  consumptionType?: "concrete" | "steel" | "common";
  minStock?: number;
  purchasePrice?: number;
  projectId?: string;
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
  rowNumber?: number | string;
  amount: number;
  date: string;
  accountId?: string;
  referenceNumber?: string;
  invoiceNumber?: string;
  invoiceDescription?: string;
  settlementMethod?: string;
  paymentStatus?: string;
  sourceAccount?: string;
  destinationAccount?: string;
  receiptFileName?: string;
  receiptFileData?: string;
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
  sourceAccount?: string;
  destinationAccount?: string;
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
  installmentId?: string;
  contactId?: string;
  isDeleted?: boolean;
  approvalStatus?: "pending" | "approved" | "rejected";
  approvedAmount?: number;
  approvedBy?: string;
  approvedDate?: string;
  createdBy?: string;
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

export interface Contact {
  id: string;
  name: string;
  phone: string;
  role: "pre_buyer" | "supplier" | "subcontractor" | "imprest_holder" | "investor" | "employer" | "admin" | string;
  roleName?: string;
  roles?: string[];
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
  balance: number;
  createdAt?: string;
  projectId?: string;
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

export interface PreSale {
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

export interface PreSaleInstallment {
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

export interface AlertLog {
  id: string;
  type: "installment" | "check" | "imprest_lock";
  referenceId: string;
  recipientPhone: string;
  message: string;
  sendDate: string;
  isSent: boolean;
}

export interface TimesheetItem {
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

export interface PayrollItem {
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
  timesheets?: TimesheetItem[];
  payrolls?: PayrollItem[];
}
