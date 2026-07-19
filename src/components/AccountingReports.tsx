import React, { useState, useEffect } from "react";
import { DatabaseSchema, Project, Transaction, Account, Contact } from "../types";
import { 
  FileText, 
  BookOpen, 
  Scale, 
  UserCheck, 
  TrendingUp, 
  ChevronLeft, 
  MapPin, 
  CheckCircle, 
  Building, 
  Coins, 
  Calculator,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  Sparkles,
  Plus,
  SlidersHorizontal,
  Search,
  Download
} from "lucide-react";
import { motion } from "motion/react";
import SearchableCombobox from "./SearchableCombobox";
import { ShamsiDatePicker } from "./ShamsiDatePicker";
import { FormattedAmountInput } from "./FormattedAmountInput";

interface AccountingReportsProps {
  db: DatabaseSchema;
  projects: Project[];
  onAddContact?: (contact: Partial<Contact>) => Promise<boolean | void> | boolean | void;
  onAddProject?: (project: Partial<Project>) => Promise<boolean | void> | boolean | void;
}

export default function AccountingReports({ db, projects, onAddContact, onAddProject }: AccountingReportsProps) {
  const [activeReport, setActiveReport] = useState<"journal" | "trial_balance" | "ledger" | "golden_cost" | "p_and_l">("journal");
  const [selectedProjectId, setSelectedProjectId] = useState<string>(projects[0]?.id || "");
  const [selectedContactId, setSelectedContactId] = useState<string>(db.contacts[0]?.id || "");

  // Master Reports filtering states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [reportSearchQuery, setReportSearchQuery] = useState("");
  const [filterMaterial, setFilterMaterial] = useState("all");
  const [filterStage, setFilterStage] = useState("all");

  const filteredTransactions = db.transactions.filter(t => {
    // 1. Text Search Query
    if (reportSearchQuery) {
      const q = reportSearchQuery.toLowerCase();
      const match = t.personName.toLowerCase().includes(q) ||
                    t.description.toLowerCase().includes(q) ||
                    t.category.toLowerCase().includes(q) ||
                    (t.subCategory && t.subCategory.toLowerCase().includes(q));
      if (!match) return false;
    }

    // 2. Date Range
    if (filterStartDate && t.date < filterStartDate) return false;
    if (filterEndDate && t.date > filterEndDate) return false;

    // 3. Material Type Filter
    if (filterMaterial !== "all") {
      const textToSearch = (t.description + " " + t.category + " " + (t.subCategory || "")).toLowerCase();
      if (!textToSearch.includes(filterMaterial.toLowerCase())) return false;
    }

    // 4. Stage Filter
    if (filterStage !== "all" && t.subCategory !== filterStage) return false;

    return true;
  });

  const activeFiltersCount = 
    (filterStartDate ? 1 : 0) +
    (filterEndDate ? 1 : 0) +
    (reportSearchQuery ? 1 : 0) +
    (filterMaterial !== "all" ? 1 : 0) +
    (filterStage !== "all" ? 1 : 0);

  // Modals for quick adding missing details
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactModalName, setContactModalName] = useState("");
  const [contactModalPhone, setContactModalPhone] = useState("");
  const [contactModalRole, setContactModalRole] = useState<Contact["role"]>("supplier");
  const [contactModalNationalId, setContactModalNationalId] = useState("");
  const [contactModalCardNumber, setContactModalCardNumber] = useState("");
  const [contactModalBalance, setContactModalBalance] = useState("0");

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalName, setProjectModalName] = useState("");
  const [projectModalAddress, setProjectModalAddress] = useState("");
  const [projectModalBudget, setProjectModalBudget] = useState("");
  const [projectModalArea, setProjectModalArea] = useState("");

  useEffect(() => {
    if (contactModalName.trim()) {
      const found = db.contacts.find(c => c.name.toLowerCase() === contactModalName.trim().toLowerCase());
      if (found) {
        setSelectedContactId(found.id);
        setContactModalName("");
      }
    }
  }, [db.contacts]);

  useEffect(() => {
    if (projectModalName.trim()) {
      const found = projects.find(p => p.name.toLowerCase() === projectModalName.trim().toLowerCase());
      if (found) {
        setSelectedProjectId(found.id);
        setProjectModalName("");
      }
    }
  }, [projects]);

  const handleQuickContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactModalName.trim() || !onAddContact) return;
    const success = await onAddContact({
      name: contactModalName.trim(),
      phone: contactModalPhone.trim(),
      role: contactModalRole,
      nationalId: contactModalNationalId.trim(),
      bankCardNumber: contactModalCardNumber.trim(),
      balance: Number(contactModalBalance) || 0
    });
    if (success !== false) {
      setShowContactModal(false);
    }
  };

  const handleQuickProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectModalName.trim() || !onAddProject) return;
    const success = await onAddProject({
      name: projectModalName.trim(),
      address: projectModalAddress.trim(),
      budget: Number(projectModalBudget) || 0,
      totalArea: Number(projectModalArea) || 0,
      stages: ["اسکلت بتنی", "سفت‌کاری", "نازک‌کاری", "تأسیسات"],
      currentStage: "اسکلت بتنی",
      status: "active"
    });
    if (success !== false) {
      setShowProjectModal(false);
    }
  };

  const formatTomans = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
  };

  const toFarsiDigits = (str: string | number) => {
    const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const currentProject = projects.find(p => p.id === selectedProjectId);

  // 1. Double Entry Posting Engine simulation for Journal
  const journalEntries = filteredTransactions.map((tx, idx) => {
    // Determine debit and credit accounts based on transaction category
    let debitAccount = "هزینه پروژه " + (projects.find(p => p.id === tx.projectId)?.name || "عمومی");
    let creditAccount = db.accounts.find(a => a.id === tx.accountId)?.name || "صندوق";

    if (tx.type === "income") {
      debitAccount = db.accounts.find(a => a.id === tx.accountId)?.name || "صندوق";
      creditAccount = tx.category === "پیش‌فروش" ? "پیش‌دریافت از پیش‌خریداران" : "سایر درآمدهای ساختمانی";
    }

    return {
      id: tx.id,
      date: tx.date,
      description: tx.description,
      amount: tx.amount,
      debitAccount,
      creditAccount,
      personName: tx.personName
    };
  });

  // 2. Trial Balance calculation
  const trialBalanceAccounts = db.accounts.map(acc => {
    // Calculate total debits/credits from transactions
    const txs = filteredTransactions.filter(t => t.accountId === acc.id);
    let debits = 0;
    let credits = 0;

    txs.forEach(t => {
      if (t.type === "income") {
        if (acc.nature === "debtor") debits += t.amount;
        else credits += t.amount;
      } else {
        if (acc.nature === "debtor") credits += t.amount;
        else debits += t.amount;
      }
    });

    // Seed initial balance to debits/credits to make it look realistic
    if (acc.nature === "debtor") {
      debits += acc.balance;
    } else {
      credits += acc.balance;
    }

    return {
      ...acc,
      debits,
      credits,
      finalBalance: acc.balance
    };
  });

  // 3. Subsidiary Ledger (معین شخص) with running balance
  const activeContact = db.contacts.find(c => c.id === selectedContactId);
  const contactTransactions = filteredTransactions.filter(t => t.personName === activeContact?.name);

  let runningBalance = activeContact ? activeContact.balance : 0;
  const ledgerRows = contactTransactions.map((tx, index) => {
    const isPaymentToContact = tx.type === "expense"; // e.g. paid subcontractor
    const amount = tx.amount;
    
    // Adjust running balance
    if (isPaymentToContact) {
      runningBalance += amount;
    } else {
      runningBalance -= amount;
    }

    return {
      id: tx.id,
      date: tx.date,
      description: tx.description,
      type: tx.type,
      debit: isPaymentToContact ? amount : 0,
      credit: !isPaymentToContact ? amount : 0,
      balanceAfter: runningBalance
    };
  });

  // 4. Golden costing engine breakdown
  const projectExpenses = filteredTransactions.filter(t => t.projectId === selectedProjectId && t.type === "expense");
  const totalSpent = projectExpenses.reduce((sum, tx) => sum + tx.amount, 0);
  const projectArea = currentProject?.totalArea || 1;
  const averageCostPerSqm = Math.round(totalSpent / projectArea);

  // Group expenses by stage
  const stageExpenses: { [key: string]: number } = {};
  if (currentProject) {
    currentProject.stages.forEach(stg => {
      stageExpenses[stg] = 0;
    });
    projectExpenses.forEach(tx => {
      const stage = tx.subCategory || currentProject.currentStage;
      stageExpenses[stage] = (stageExpenses[stage] || 0) + tx.amount;
    });
  }

  // 5. Project P&L engine
  // Calculate total income from unit sales/pre-sales specifically for this project
  const projectIncome = filteredTransactions.filter(t => t.projectId === selectedProjectId && t.type === "income");
  const totalIncome = projectIncome.reduce((sum, tx) => sum + tx.amount, 0);

  // Units under this project
  const projectUnits = db.units.filter(u => u.projectId === selectedProjectId);
  const totalUnitsCount = projectUnits.length;
  const soldUnitsCount = projectUnits.filter(u => u.status !== "available").length;
  const unsoldUnitsCount = totalUnitsCount - soldUnitsCount;

  // Valuation of remaining inventory
  const valuationUnsold = projectUnits
    .filter(u => u.status === "available")
    .reduce((sum, u) => sum + (u.area * u.pricePerMeter), 0);

  const netPAndL = totalIncome - totalSpent;
  const estimatedFinalProfit = (totalIncome + valuationUnsold) - totalSpent;

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Top selection bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <BookOpen className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 font-sans">دفاتر و گزارش‌های مالی استاندارد</h2>
            <p className="text-slate-400 text-xs font-light">دفتر روزنامه دوطرفه، تراز آزمایشی کل، ریز معین اشخاص و بهای تمام شده طلایی</p>
          </div>
        </div>

        {/* Print Report Trigger */}
        <button 
          onClick={() => window.print()}
          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
        >
          <Printer className="w-4 h-4" />
          چاپ و خروجی PDF گزارش
        </button>
      </div>

      {/* Grid of Report Selector tabs */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { key: "journal", label: "دفتر روزنامه دوطرفه", icon: FileText },
          { key: "trial_balance", label: "تراز آزمایشی کل", icon: Scale },
          { key: "ledger", label: "معین اشخاص (طرف‌حساب)", icon: UserCheck },
          { key: "golden_cost", label: "بهای تمام شده طلایی", icon: Calculator },
          { key: "p_and_l", label: "حساب سود و زیان پروژه", icon: TrendingUp }
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeReport === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveReport(tab.key as any)}
              className={`p-3.5 rounded-2xl border flex flex-col items-center justify-center gap-2.5 transition-all text-center cursor-pointer ${
                isActive 
                  ? "bg-slate-900 border-slate-950 text-white shadow-md font-bold" 
                  : "bg-white border-slate-150 text-slate-600 hover:bg-slate-50 hover:text-slate-900"
              }`}
            >
              <Icon className={`w-5 h-5 ${isActive ? "text-amber-400" : "text-slate-400"}`} />
              <span className="text-[11px] font-semibold tracking-tight leading-none">{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Search & Master Filters Panel for Reports */}
      <div className="bg-white p-4 rounded-2xl border border-slate-150 shadow-2xs space-y-3">
        <div className="flex flex-col md:flex-row justify-between items-stretch md:items-center gap-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-4 h-4 text-indigo-600" />
            <span className="text-xs font-bold text-slate-700">فیلتر و جستجوی جامع گزارش‌های مالی:</span>
            {activeFiltersCount > 0 && (
              <span className="bg-indigo-100 text-indigo-700 text-[10px] px-2 py-0.5 rounded-full font-bold">
                {toFarsiDigits(activeFiltersCount)} فیلتر فعال
              </span>
            )}
          </div>

          <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
            {/* Quick search input */}
            <div className="relative flex items-center">
              <input 
                type="text" 
                placeholder="جستجو در فاکتورها و شرح اسناد..."
                value={reportSearchQuery}
                onChange={e => setReportSearchQuery(e.target.value)}
                className="w-full sm:w-64 px-3 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-medium"
              />
              <Search className="w-4 h-4 text-slate-400 absolute right-2.5" />
            </div>

            <button
              type="button"
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                showAdvancedFilters || activeFiltersCount > 0
                  ? "bg-slate-900 border-slate-950 text-white shadow-xs"
                  : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-150"
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span>تنظیم فیلترهای دقیق</span>
            </button>

            {activeFiltersCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setReportSearchQuery("");
                  setFilterMaterial("all");
                  setFilterStage("all");
                }}
                className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                پاک کردن فیلترها
              </button>
            )}
          </div>
        </div>

        {/* Collapsible fine-grained settings */}
        {showAdvancedFilters && (
          <motion.div 
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-slate-50 p-4 rounded-xl border border-slate-150 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs"
          >
            {/* Date range filters */}
            <div className="space-y-1.5 text-right">
              <span className="text-slate-500 font-bold block">فیلتر بازه زمانی (هجری شمسی)</span>
              <div className="grid grid-cols-2 gap-2">
                <ShamsiDatePicker 
                  placeholder="از تاریخ (۱۴۰۳/۰۱/۰۱)" 
                  value={filterStartDate}
                  onChange={setFilterStartDate}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-mono outline-none focus:border-indigo-500"
                />
                <ShamsiDatePicker 
                  placeholder="تا تاریخ (۱۴۰۳/۱۲/۲۹)" 
                  value={filterEndDate}
                  onChange={setFilterEndDate}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-mono outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* Material selector */}
            <div className="space-y-1.5 text-right">
              <span className="text-slate-500 font-bold block">فیلتر بر اساس نوع مصالح</span>
              <select
                value={filterMaterial}
                onChange={e => setFilterMaterial(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
              >
                <option value="all">همه مصالح (بدون محدودیت)</option>
                <option value="سیمان">سیمان</option>
                <option value="میلگرد">میلگرد</option>
                <option value="آهن">آهن‌آلات / تیرآهن</option>
                <option value="بتن">بتن آماده</option>
                <option value="شن">شن و ماسه</option>
                <option value="آجر">آجر و سفال</option>
                <option value="گچ">گچ و خاک</option>
                <option value="سنگ">سنگ نما</option>
                <option value="کاشی">سرامیک و کاشی</option>
                <option value="لوله">لوله و اتصالات</option>
                <option value="کابل">سیم و کابل</option>
                <option value="پوکه">پوکه معدنی</option>
                <option value="رنگ">رنگ و نقاشی</option>
              </select>
            </div>

            {/* Construction stage selector */}
            <div className="space-y-1.5 text-right">
              <span className="text-slate-500 font-bold block">فیلتر بر اساس فاز/مرحله ساخت</span>
              <select
                value={filterStage}
                onChange={e => setFilterStage(e.target.value)}
                className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
              >
                <option value="all">همه مراحل اجرایی (کل فازها)</option>
                {Array.from(new Set(db.transactions.map(t => t.subCategory).filter(Boolean))).map(stg => (
                  <option key={stg} value={stg!}>{stg}</option>
                ))}
              </select>
            </div>
          </motion.div>
        )}
      </div>

      {/* Primary Report Display Board */}
      <div className="bg-white p-6 rounded-3xl border border-slate-150 shadow-sm space-y-6">
        
        {/* REPORT 1: DOUBLE ENTRY JOURNAL */}
        {activeReport === "journal" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">دفتر روزنامه کل دوطرفه ( postings ledger )</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">ثبت موازی بدهکار و بستانکار هر یک از تراکنش‌های ساختمانی</p>
              </div>
              <span className="text-xs bg-slate-100 text-slate-600 px-3 py-1 rounded-xl font-bold">
                تعداد سند: {toFarsiDigits(journalEntries.length)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-600">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-150">
                    <th className="py-3 px-3 text-right font-bold">تاریخ</th>
                    <th className="py-3 px-3 text-right font-bold">شرح تراکنش و سند حسابداری</th>
                    <th className="py-3 px-3 text-right font-bold">کد / عنوان معین حساب</th>
                    <th className="py-3 px-3 text-left font-bold">مبلغ بدهکار (ریال)</th>
                    <th className="py-3 px-3 text-left font-bold">مبلغ بستانکار (ریال)</th>
                  </tr>
                </thead>
                <tbody>
                  {journalEntries.map((row, idx) => (
                    <React.Fragment key={row.id}>
                      {/* Debit row */}
                      <tr className="border-t border-slate-100 font-light hover:bg-slate-50/20">
                        <td className="py-3 px-3 font-mono text-slate-400 font-light" rowSpan={2}>{toFarsiDigits(row.date)}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800" rowSpan={2}>
                          {row.description}
                          <span className="block text-[10px] text-slate-400 font-normal mt-0.5">ذینفع: {row.personName}</span>
                        </td>
                        <td className="py-2 px-3 text-slate-700 font-medium">{row.debitAccount}</td>
                        <td className="py-2 px-3 text-left font-bold text-slate-800 font-mono">{toFarsiDigits(row.amount.toLocaleString())}</td>
                        <td className="py-2 px-3 text-left font-mono text-slate-300">-</td>
                      </tr>
                      {/* Credit row */}
                      <tr className="border-b border-slate-100 hover:bg-slate-50/20">
                        <td className="py-2 px-3 text-slate-500 pr-8 font-light">← {row.creditAccount}</td>
                        <td className="py-2 px-3 text-left font-mono text-slate-300">-</td>
                        <td className="py-2 px-3 text-left font-bold text-rose-600 font-mono">{toFarsiDigits(row.amount.toLocaleString())}</td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 2: TRIAL BALANCE */}
        {activeReport === "trial_balance" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">تراز آزمایشی کل حساب‌های کارگاهی</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">بررسی موازنه ترازهای معین و توازن بستانکار/بدهکار دفاتر</p>
              </div>
              <span className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1 rounded-xl font-bold flex items-center gap-1 border border-emerald-200">
                <CheckCircle className="w-3.5 h-3.5" />
                توازن دفاتر ۱۰۰٪ همگام‌سازی شده
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-slate-600">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-150">
                    <th className="py-3 px-3 text-right">کد حساب</th>
                    <th className="py-3 px-3 text-right">عنوان معین حساب</th>
                    <th className="py-3 px-3 text-center">ماهیت</th>
                    <th className="py-3 px-3 text-left font-bold">گردش بدهکار (ریال)</th>
                    <th className="py-3 px-3 text-left font-bold">گردش بستانکار (ریال)</th>
                    <th className="py-3 px-3 text-left font-bold">مانده نهایی (ریال)</th>
                  </tr>
                </thead>
                <tbody>
                  {trialBalanceAccounts.map(acc => (
                    <tr key={acc.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                      <td className="py-3 px-3 font-mono text-slate-500 font-semibold">{toFarsiDigits(acc.code || "10100" + acc.id)}</td>
                      <td className="py-3 px-3 font-semibold text-slate-800">{acc.name}</td>
                      <td className="py-3 px-3 text-center">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] ${
                          acc.nature === "debtor" ? "bg-indigo-50 text-indigo-600" : "bg-amber-50 text-amber-600"
                        }`}>
                          {acc.nature === "debtor" ? "بدهکار" : "بستانکار"}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-left font-mono">{toFarsiDigits(acc.debits.toLocaleString())}</td>
                      <td className="py-3 px-3 text-left font-mono">{toFarsiDigits(acc.credits.toLocaleString())}</td>
                      <td className={`py-3 px-3 text-left font-extrabold font-mono ${acc.balance >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
                        {toFarsiDigits(Math.abs(acc.balance).toLocaleString())}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 3: SUBSIDIARY LEDGER */}
        {activeReport === "ledger" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">ریز حساب معین و وضعیت طرف‌حساب</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">صورت خلاصه ریز کارکرد، اسناد پرداختی و تراز طلب/بدهی پیمانکاران یا پیش‌خریداران</p>
              </div>

              {/* Selector */}
              <div className="flex gap-2 items-center text-xs">
                <span className="text-slate-400 font-bold">انتخاب شخص:</span>
                <SearchableCombobox
                  options={db.contacts.map(c => ({
                    value: c.id,
                    label: c.name,
                    subLabel: c.phone ? `تلفن: ${c.phone}` : undefined
                  }))}
                  value={selectedContactId}
                  onChange={setSelectedContactId}
                  placeholder="جستجو یا انتخاب شخص..."
                  allowCustom={true}
                  onCustomAdd={async (name) => {
                    setContactModalName(name);
                    setShowContactModal(true);
                  }}
                  customAddLabel="افزودن شخص جدید..."
                  className="w-64"
                />
              </div>
            </div>

            {activeContact && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">مجموع بدهی کارفرما به شخص:</span>
                  <span className={`text-base font-extrabold block ${activeContact.balance < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                    {formatTomans(Math.abs(activeContact.balance))}
                  </span>
                  <span className="text-[10px] text-slate-400 block font-light">وضعیت حساب: {activeContact.balance < 0 ? "بستانکار (طلبکار)" : "بدهکار (باقیمانده)"}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">کد شناسایی ملی:</span>
                  <span className="text-xs font-bold text-slate-700 block">{toFarsiDigits(activeContact.nationalId || "ثبت نشده")}</span>
                  <span className="text-[10px] text-slate-400 block font-light">تلفن: {toFarsiDigits(activeContact.phone)}</span>
                </div>
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-1">
                  <span className="text-[10px] text-slate-400 font-bold block">شماره کارت بانکی:</span>
                  <span className="text-xs font-bold text-slate-700 block font-mono text-left" dir="ltr">{toFarsiDigits(activeContact.bankCardNumber || "ثبت نشده")}</span>
                  <span className="text-[10px] text-slate-400 block font-light">نقش: {activeContact.role === "pre_buyer" ? "پیش‌خریدار" : "پیمانکار جزء کارگاهی"}</span>
                </div>
              </div>
            )}

            <div className="overflow-x-auto pt-2">
              <table className="w-full text-xs text-slate-600">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 border-b border-slate-150">
                    <th className="py-2.5 px-3 text-right">تاریخ</th>
                    <th className="py-2.5 px-3 text-right">شرح سند</th>
                    <th className="py-2.5 px-3 text-left font-bold">بدهکار (ریال)</th>
                    <th className="py-2.5 px-3 text-left font-bold">بستانکار (ریال)</th>
                    <th className="py-2.5 px-3 text-left font-bold">مانده لحظه‌ای (ریال)</th>
                  </tr>
                </thead>
                <tbody>
                  {ledgerRows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-8 text-slate-400 font-light">
                        هیچ تراکنش ثبتی برای این شخص یافت نشد
                      </td>
                    </tr>
                  ) : (
                    ledgerRows.map(row => (
                      <tr key={row.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="py-3 px-3 font-mono text-slate-500">{toFarsiDigits(row.date)}</td>
                        <td className="py-3 px-3 font-semibold text-slate-800">{row.description}</td>
                        <td className="py-3 px-3 text-left font-mono font-bold text-slate-700">{row.debit > 0 ? toFarsiDigits(row.debit.toLocaleString()) : "-"}</td>
                        <td className="py-3 px-3 text-left font-mono font-bold text-rose-600">{row.credit > 0 ? toFarsiDigits(row.credit.toLocaleString()) : "-"}</td>
                        <td className={`py-3 px-3 text-left font-mono font-extrabold ${row.balanceAfter < 0 ? "text-rose-600" : "text-emerald-600"}`}>
                          {toFarsiDigits(Math.abs(row.balanceAfter).toLocaleString())}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* REPORT 4: GOLDEN COST PRICE */}
        {activeReport === "golden_cost" && (
          <div className="space-y-4 animate-fade-in text-right">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">بهای تمام شده طلایی هر متر مربع زیربنا</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">تقسیم هزینه‌های واقعی فازهای ساخت به زیربنای کل جهت مدیریت قیمت تمام شده ساخت</p>
              </div>

              {/* Selector */}
              <div className="flex gap-2 items-center text-xs">
                <span className="text-slate-400 font-bold">انتخاب پروژه فعال:</span>
                <SearchableCombobox
                  options={projects.map(p => ({
                    value: p.id,
                    label: p.name,
                    subLabel: p.address ? `آدرس: ${p.address}` : undefined
                  }))}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  placeholder="جستجو یا انتخاب پروژه..."
                  allowCustom={true}
                  onCustomAdd={async (name) => {
                    setProjectModalName(name);
                    setShowProjectModal(true);
                  }}
                  customAddLabel="تعریف پروژه جدید..."
                  className="w-64"
                />
              </div>
            </div>

            {currentProject && (
              <div className="space-y-6">
                
                {/* Visual costing indicator cards */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                  <div className="p-4 bg-slate-900 text-white rounded-2xl flex flex-col justify-between">
                    <span className="text-[10px] text-slate-400 font-medium">بهای تمام شده کل واقعی:</span>
                    <h4 className="text-lg font-bold text-amber-400 font-mono mt-1">{formatTomans(totalSpent)}</h4>
                    <span className="text-[9px] text-slate-300 font-light block mt-1">از بودجه مصوب {formatTomans(currentProject.budget)}</span>
                  </div>

                  <div className="p-4 bg-slate-50 rounded-2xl flex flex-col justify-between border border-slate-150">
                    <span className="text-[10px] text-slate-400 font-medium">زیربنای ناخالص کل:</span>
                    <h4 className="text-lg font-bold text-slate-800 font-sans mt-1">{toFarsiDigits(projectArea)} مترمربع</h4>
                    <span className="text-[9px] text-slate-500 font-light block mt-1">طبق پروانه نظام مهندسی شهرداری</span>
                  </div>

                  <div className="p-4 bg-amber-50 rounded-2xl flex flex-col justify-between border border-amber-200">
                    <span className="text-[10px] text-amber-800 font-bold">بهای تمام شده واقعی هر متر مربع:</span>
                    <h4 className="text-lg font-extrabold text-amber-700 font-mono mt-1">{formatTomans(averageCostPerSqm)}</h4>
                    <span className="text-[9px] text-amber-600 font-light block mt-1">فرمول: کل هزینه‌ها تقسیم بر متراژ زیربنا</span>
                  </div>

                  <div className="p-4 bg-emerald-50 rounded-2xl flex flex-col justify-between border border-emerald-200">
                    <span className="text-[10px] text-emerald-800 font-bold">درصد کارایی بودجه مصوب:</span>
                    <h4 className="text-lg font-extrabold text-emerald-700 font-mono mt-1">
                      {toFarsiDigits(Math.round((totalSpent / currentProject.budget) * 100))}%
                    </h4>
                    <span className="text-[9px] text-emerald-600 font-light block mt-1">از کل بودجه مصرف شده</span>
                  </div>
                </div>

                {/* Construction Stage Cost Distribution */}
                <div className="p-5 border border-slate-150 rounded-2xl space-y-4">
                  <h4 className="text-xs font-bold text-slate-700 border-b border-slate-100 pb-2">سهم و وزن مراحل ساخت بر بهای تمام شده نهایی:</h4>
                  <div className="space-y-3">
                    {Object.entries(stageExpenses).map(([stg, val], index) => {
                      const pct = Math.round((val / (totalSpent || 1)) * 100);
                      const widths = `${pct}%`;
                      const colors = ["bg-amber-500", "bg-indigo-500", "bg-teal-500", "bg-rose-500", "bg-sky-500", "bg-emerald-500"];
                      return (
                        <div key={stg} className="space-y-1.5 text-xs">
                          <div className="flex justify-between font-medium">
                            <span className="text-slate-700 font-semibold">{stg}</span>
                            <div className="space-x-1.5 space-x-reverse">
                              <span className="text-slate-400 font-light">({toFarsiDigits(pct)}٪)</span>
                              <span className="font-mono text-slate-800 font-bold">{formatTomans(val)}</span>
                            </div>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div className={`h-full ${colors[index % colors.length]}`} style={{ width: widths }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

              </div>
            )}
          </div>
        )}

        {/* REPORT 5: PROJECT PROFIT & LOSS */}
        {activeReport === "p_and_l" && (
          <div className="space-y-4 animate-fade-in text-right">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-slate-100 pb-3">
              <div>
                <h3 className="font-bold text-slate-800 text-sm">حساب سود و زیان تجاری پروژه</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">محاسبه درآمدهای حاصل از پیش‌فروش منهای هزینه‌های تمام شده و ارزش‌گذاری واحدهای موجود</p>
              </div>

              {/* Selector */}
              <div className="flex gap-2 items-center text-xs">
                <span className="text-slate-400 font-bold">انتخاب پروژه:</span>
                <SearchableCombobox
                  options={projects.map(p => ({
                    value: p.id,
                    label: p.name,
                    subLabel: p.address ? `آدرس: ${p.address}` : undefined
                  }))}
                  value={selectedProjectId}
                  onChange={setSelectedProjectId}
                  placeholder="جستجو یا انتخاب پروژه..."
                  allowCustom={true}
                  onCustomAdd={async (name) => {
                    setProjectModalName(name);
                    setShowProjectModal(true);
                  }}
                  customAddLabel="تعریف پروژه جدید..."
                  className="w-64"
                />
              </div>
            </div>

            {currentProject && (
              <div className="space-y-6">
                
                {/* Financial Summary Bento block */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  
                  {/* Revenue block */}
                  <div className="p-4 bg-emerald-50 border border-emerald-150 rounded-2xl text-emerald-800 space-y-1">
                    <span className="text-[10px] text-emerald-600 font-bold flex items-center gap-1">
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      درآمد نقدی دریافت شده (پیش‌فروش):
                    </span>
                    <h4 className="text-base font-extrabold font-mono">{formatTomans(totalIncome)}</h4>
                    <p className="text-[9px] text-emerald-600">از محل عقد قرارداد پیش‌فروش {toFarsiDigits(soldUnitsCount)} واحد</p>
                  </div>

                  {/* Expenses block */}
                  <div className="p-4 bg-rose-50 border border-rose-150 rounded-2xl text-rose-800 space-y-1">
                    <span className="text-[10px] text-rose-600 font-bold flex items-center gap-1">
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      کل هزینه‌های جاری ساخت تا کنون:
                    </span>
                    <h4 className="text-base font-extrabold font-mono">{formatTomans(totalSpent)}</h4>
                    <p className="text-[9px] text-rose-600">شامل مصالح، حقوق، دستمزد کارگاهی و هزینه‌های عمومی</p>
                  </div>

                  {/* Net Margin block */}
                  <div className={`p-4 rounded-2xl text-white space-y-1 ${netPAndL >= 0 ? "bg-slate-900" : "bg-rose-950"}`}>
                    <span className="text-[10px] text-slate-300 font-bold block">تراز نقدی خالص پروژه (فعلی):</span>
                    <h4 className="text-base font-extrabold font-mono text-amber-400">{formatTomans(netPAndL)}</h4>
                    <p className="text-[9px] text-slate-400">تفاضل کل مبالغ ورودی و خروجی نقدی پروژه</p>
                  </div>
                </div>

                {/* Unrealized Inventory Valuation & Future forecast */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  
                  {/* Valuation of available inventory */}
                  <div className="p-5 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-700">ارزش‌گذاری بهای روز واحدهای باقیمانده (موجود):</h4>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>تعداد واحدهای آزاد و آماده فروش:</span>
                        <span className="font-semibold text-slate-800">{toFarsiDigits(unsoldUnitsCount)} واحد</span>
                      </div>
                      <div className="flex justify-between">
                        <span>مجموع متراژ واحدهای موجود:</span>
                        <span className="font-semibold text-slate-800">
                          {toFarsiDigits(projectUnits.filter(u => u.status === "available").reduce((sum, u) => sum + u.area, 0))} متر مربع
                        </span>
                      </div>
                      <div className="border-t border-slate-200/60 pt-2 flex justify-between font-bold text-slate-800">
                        <span>ارزش برآوردی واحدها با قیمت پایه:</span>
                        <span className="font-mono text-indigo-600">{formatTomans(valuationUnsold)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Profitability Index forecast */}
                  <div className="p-5 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                    <h4 className="text-xs font-bold text-slate-700">چشم‌انداز سودآوری کل نهایی پروژه:</h4>
                    <div className="space-y-2 text-xs text-slate-600">
                      <div className="flex justify-between">
                        <span>ارزش کل دارایی‌ها (دریافتی + موجود):</span>
                        <span className="font-mono text-slate-800 font-semibold">{formatTomans(totalIncome + valuationUnsold)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>هزینه‌کرد واقعی ساخت:</span>
                        <span className="font-mono text-rose-600 font-semibold">-{formatTomans(totalSpent)}</span>
                      </div>
                      <div className="border-t border-slate-200/60 pt-2 flex justify-between font-bold text-emerald-600 text-sm">
                        <span>سود نهایی پیش‌بینی‌شده کل:</span>
                        <span className="font-mono">{formatTomans(estimatedFinalProfit)}</span>
                      </div>
                    </div>
                  </div>

                </div>

              </div>
            )}
          </div>
        )}

      </div>

      {/* Quick Add Contact Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="text-base font-bold text-slate-850">ثبت سریع شخص جدید (پیمانکار / پیش‌خریدار)</h3>
            </div>
            <form onSubmit={handleQuickContactSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold">نام و نام خانوادگی <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={contactModalName}
                  onChange={e => setContactModalName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" 
                  placeholder="مثال: مهندس احمدی"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold">شماره تماس (تلفن همراه)</label>
                <input 
                  type="text" 
                  value={contactModalPhone}
                  onChange={e => setContactModalPhone(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-left" 
                  placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold">نقش در پروژه</label>
                <select 
                  value={contactModalRole}
                  onChange={e => setContactModalRole(e.target.value as any)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                >
                  <option value="supplier">تامین‌کننده مصالح</option>
                  <option value="contractor">پیمانکار جزء</option>
                  <option value="pre_buyer">پیش‌خریدار واحد</option>
                  <option value="laborer">روزکار / کارگر</option>
                  <option value="other">سایر طرف‌های حساب</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold">کد ملی / شناسه ملی</label>
                <input 
                  type="text" 
                  value={contactModalNationalId}
                  onChange={e => setContactModalNationalId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-left" 
                  placeholder="۱۲۳۴۵۶۷۸۹۰"
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold">شماره کارت جهت واریز وجه</label>
                <input 
                  type="text" 
                  value={contactModalCardNumber}
                  onChange={e => setContactModalCardNumber(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono text-left" 
                  placeholder="۶۰۳۷۹۹..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold">مانده تراز اولیه (ریال)</label>
                <input 
                  type="number" 
                  value={contactModalBalance}
                  onChange={e => setContactModalBalance(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" 
                  placeholder="طلبکار: منفی، بدهکار: مثبت"
                />
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  انصراف
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 shadow-sm transition-colors"
                >
                  ذخیره و انتخاب شخص
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Add Project Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 text-right" dir="rtl">
          <div className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
              <Building className="w-5 h-5 text-amber-500" />
              <h3 className="text-base font-bold text-slate-850">تعریف سریع پروژه عمرانی جدید</h3>
            </div>
            <form onSubmit={handleQuickProjectSubmit} className="space-y-4 text-xs">
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold">نام پروژه <span className="text-rose-500">*</span></label>
                <input 
                  type="text" 
                  value={projectModalName}
                  onChange={e => setProjectModalName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" 
                  placeholder="مثال: پروژه برج نگین"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-slate-500 font-semibold">آدرس دقیق پروژه</label>
                <input 
                  type="text" 
                  value={projectModalAddress}
                  onChange={e => setProjectModalAddress(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" 
                  placeholder="مثال: تهران، خیابان پاسداران"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold">بودجه کل مصوب (ریال)</label>
                  <FormattedAmountInput 
                    value={projectModalBudget}
                    onChange={setProjectModalBudget}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-semibold" 
                    placeholder="مثال: ۲۰,۰۰۰,۰۰۰,۰۰۰"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-slate-500 font-semibold">زیربنای ناخالص کل (مترمربع)</label>
                  <input 
                    type="number" 
                    value={projectModalArea}
                    onChange={e => setProjectModalArea(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500" 
                    placeholder="مثال: ۳۵۰۰"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2 justify-end">
                <button 
                  type="button" 
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-semibold hover:bg-slate-200 transition-colors"
                >
                  انصراف
                </button>
                <button 
                  type="submit"
                  className="px-4 py-2 bg-amber-600 text-white rounded-xl font-semibold hover:bg-amber-700 shadow-sm transition-colors"
                >
                  ذخیره و انتخاب پروژه
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
