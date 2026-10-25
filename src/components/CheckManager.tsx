import React, { useState, useEffect } from "react";
import { CheckItem, Account, Project } from "../types";
import { Clock, Plus, Search, Calendar, CheckSquare, RefreshCw, Landmark, AlertTriangle, Edit, Trash2, Printer, Filter } from "lucide-react";
import { motion } from "motion/react";
import { ShamsiDatePicker } from "./ShamsiDatePicker";
import { FormattedAmountInput } from "./FormattedAmountInput";
import { getTodayShamsiString } from "../utils/shamsi";
import { printStructuredReport } from "../utils/printReport";

interface CheckManagerProps {
  checks: CheckItem[];
  accounts: Account[];
  projects: Project[];
  onAddCheck: (check: Partial<CheckItem>) => void;
  onClearCheck: (checkId: string, accountId: string) => void;
  onDeleteCheck?: (id: string) => void;
}

export default function CheckManager({ 
  checks, 
  accounts, 
  projects, 
  onAddCheck, 
  onClearCheck,
  onDeleteCheck
}: CheckManagerProps) {
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "passed">("all");
  const [isAddingCheck, setIsAddingCheck] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [advType, setAdvType] = useState<"all" | "incoming" | "outgoing">("all");
  const [advProjectId, setAdvProjectId] = useState<string>("all");
  const [advStartDate, setAdvStartDate] = useState("");
  const [advEndDate, setAdvEndDate] = useState("");
  const [advMinAmount, setAdvMinAmount] = useState("");
  const [advMaxAmount, setAdvMaxAmount] = useState("");

  // New Check form state
  const [chkNumber, setChkNumber] = useState("");
  const [chkBank, setChkBank] = useState("");
  const [chkDueDate, setChkDueDate] = useState(() => getTodayShamsiString());
  const [chkAmount, setChkAmount] = useState("");
  const [chkType, setChkType] = useState<"incoming" | "outgoing">("outgoing");
  const [chkPerson, setChkPerson] = useState("");
  const [chkProjId, setChkProjId] = useState(projects[0]?.id || "");
  const [chkDesc, setChkDesc] = useState("");

  // Clearance popup states
  const [clearingCheck, setClearingCheck] = useState<CheckItem | null>(null);
  const [clearanceAccount, setClearanceAccount] = useState(accounts[0]?.id || "");

  useEffect(() => {
    if (projects.length > 0 && (!chkProjId || !projects.some(p => p.id === chkProjId))) {
      setChkProjId(projects[0].id);
    }
  }, [projects, chkProjId]);

  useEffect(() => {
    if (accounts.length > 0 && (!clearanceAccount || !accounts.some(a => a.id === clearanceAccount))) {
      setClearanceAccount(accounts[0].id);
    }
  }, [accounts, clearanceAccount]);

  const formatTomans = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
  };

  const toFarsiDigits = (str: string | number) => {
    const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const [editingCheckId, setEditingCheckId] = useState<string | null>(null);

  const handleEditCheckClick = (chk: CheckItem) => {
    setEditingCheckId(chk.id);
    setChkNumber(chk.checkNumber);
    setChkBank(chk.bankName);
    setChkDueDate(chk.dueDate);
    setChkAmount(chk.amount.toString());
    setChkType(chk.type);
    setChkPerson(chk.personName);
    setChkProjId(chk.projectId);
    setChkDesc(chk.description || "");
    setIsAddingCheck(true);
  };

  const handleSubmitCheck = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chkNumber || !chkBank || !chkAmount || !chkPerson) return;

    onAddCheck({
      id: editingCheckId || undefined,
      projectId: chkProjId,
      checkNumber: chkNumber,
      bankName: chkBank,
      dueDate: chkDueDate,
      amount: Number(chkAmount),
      type: chkType,
      status: "pending",
      personName: chkPerson,
      description: chkDesc
    });

    // Reset Form
    setChkNumber("");
    setChkBank("");
    setChkDueDate(getTodayShamsiString());
    setChkAmount("");
    setChkPerson("");
    setChkDesc("");
    setEditingCheckId(null);
    setIsAddingCheck(false);
  };

  const handleClearanceSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clearingCheck) return;
    onClearCheck(clearingCheck.id, clearanceAccount);
    setClearingCheck(null);
  };

  // Filter checks
  const filteredChecks = checks.filter(c => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
                          c.personName.toLowerCase().includes(q) || 
                          c.checkNumber.toLowerCase().includes(q) ||
                          c.bankName.toLowerCase().includes(q) ||
                          (c.description && c.description.toLowerCase().includes(q));

    if (!matchesSearch) return false;
    if (filterStatus === "pending" && c.status !== "pending") return false;
    if (filterStatus === "passed" && c.status !== "passed") return false;
    if (advType !== "all" && c.type !== advType) return false;
    if (advProjectId !== "all" && c.projectId !== advProjectId) return false;
    if (advStartDate && c.dueDate < advStartDate) return false;
    if (advEndDate && c.dueDate > advEndDate) return false;
    if (advMinAmount && c.amount < Number(advMinAmount)) return false;
    if (advMaxAmount && c.amount > Number(advMaxAmount)) return false;
    return true;
  });

  const handlePrintChecks = (mode: "before_filter" | "after_filter") => {
    const sourceList = mode === "before_filter" ? checks : filteredChecks;
    printStructuredReport({
      title: "گزارش جامع سررسید و وضعیت چک‌های صیادی",
      subtitle: mode === "before_filter" ? "چاپ کامل تمامی چک‌ها (قبل از اعمال فیلتر)" : "چاپ چک‌های انتخابی (بعد از اعمال فیلتر)",
      filterSummary: mode === "after_filter" ? [
        searchQuery ? `جستجو: ${searchQuery}` : "",
        filterStatus !== "all" ? `وضعیت: ${filterStatus === "pending" ? "در جریان وصول" : "پاس شده"}` : "",
        advType !== "all" ? `نوع چک: ${advType === "outgoing" ? "پرداختی" : "دریافتی"}` : "",
        advStartDate ? `از تاریخ: ${advStartDate}` : "",
        advEndDate ? `تا تاریخ: ${advEndDate}` : ""
      ].filter(Boolean).join(" | ") || "بدون فیلتر محدودکننده" : undefined,
      columns: [
        { header: "ردیف", accessor: (_, i) => toFarsiDigits(i + 1) },
        { header: "تاریخ سررسید", accessor: (c) => toFarsiDigits(c.dueDate) },
        { header: "سریال صیادی", accessor: (c) => toFarsiDigits(c.checkNumber) },
        { header: "بانک عهده", accessor: (c) => c.bankName },
        { header: "نوع چک", accessor: (c) => c.type === "outgoing" ? "پرداختی (صادره)" : "دریافتی (وارده)" },
        { header: "ذی‌نفع / واگذارنده", accessor: (c) => c.personName },
        { header: "پروژه", accessor: (c) => projects.find(p => p.id === c.projectId)?.name || "عمومی" },
        { header: "وضعیت", accessor: (c) => c.status === "passed" ? "پاس شده" : "در جریان وصول" },
        { header: "مبلغ (ریال)", accessor: (c) => formatTomans(c.amount) }
      ],
      data: sourceList,
      summaryItems: [
        { label: "تعداد کل چک‌ها", value: `${toFarsiDigits(sourceList.length)} فقره` },
        { label: "جمع چک‌های پرداختی", value: formatTomans(sourceList.filter(x => x.type === "outgoing").reduce((s, x) => s + x.amount, 0)) },
        { label: "جمع چک‌های دریافتی", value: formatTomans(sourceList.filter(x => x.type === "incoming").reduce((s, x) => s + x.amount, 0)) }
      ]
    });
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Header Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">سیستم یادآوری و سررسید چک‌ها</h2>
            <p className="text-slate-400 text-xs font-light">انجام اتوماتیک عملیات وصول، ثبت سررسید موعد چک‌های پرداختی و دریافتی</p>
          </div>
        </div>

        <button 
          onClick={() => {
            if (!isAddingCheck) {
              setEditingCheckId(null);
              setChkDueDate(getTodayShamsiString());
            }
            setIsAddingCheck(!isAddingCheck);
          }}
          className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-xs font-semibold shadow-sm flex items-center gap-1.5 cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          ثبت دسته چک جدید
        </button>
      </div>

      {/* Add Check Modal */}
      {isAddingCheck && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white p-6 rounded-2xl border border-slate-150 shadow-md space-y-4 text-xs"
        >
          <h3 className="font-semibold text-slate-800 border-b border-slate-100 pb-2">مشخصات برگه چک جدید</h3>
          <form onSubmit={handleSubmitCheck} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
            <div className="space-y-1.5">
              <label className="text-slate-500 font-medium">شماره سریال صیادی</label>
              <input 
                type="text" 
                placeholder="مثال: ۴۵۰۹/۸۲۱۰۳۳"
                value={chkNumber}
                onChange={e => setChkNumber(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-medium">بانک صادرکننده</label>
              <input 
                type="text" 
                placeholder="مثال: بانک سامان شعبه نیاوران"
                value={chkBank}
                onChange={e => setChkBank(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-medium">تاریخ سررسید (شمسی)</label>
              <ShamsiDatePicker 
                placeholder="مثال: ۱۴۰۳/۰۴/۱۵"
                value={chkDueDate}
                onChange={setChkDueDate}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-medium">مبلغ چک (ریال)</label>
              <FormattedAmountInput 
                placeholder="مثال: ۲,۵۰۰,۰۰۰,۰۰۰"
                value={chkAmount}
                onChange={setChkAmount}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                required
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-medium">نوع برگه چک</label>
              <div className="grid grid-cols-2 gap-2">
                <button 
                  type="button"
                  onClick={() => setChkType("outgoing")}
                  className={`py-1.5 rounded-lg border text-center font-bold ${chkType === "outgoing" ? "bg-rose-500 text-white border-rose-500" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                >
                  چک پرداختی (صادره)
                </button>
                <button 
                  type="button"
                  onClick={() => setChkType("incoming")}
                  className={`py-1.5 rounded-lg border text-center font-bold ${chkType === "incoming" ? "bg-emerald-500 text-white border-emerald-500" : "bg-slate-50 border-slate-200 text-slate-600"}`}
                >
                  چک دریافتی (مشتری)
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-slate-500 font-medium">پروژه مرتبط</label>
              <select 
                value={chkProjId}
                onChange={e => setChkProjId(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              >
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div className="md:col-span-2 space-y-1.5">
              <label className="text-slate-500 font-medium">در وجه (نام شخص/پیمانکار)</label>
              <input 
                type="text" 
                placeholder="نام کامل ذینفع چک"
                value={chkPerson}
                onChange={e => setChkPerson(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                required
              />
            </div>
            <div className="col-span-full space-y-1.5">
              <label className="text-slate-500 font-medium">بابت (شرح آرتیکل)</label>
              <input 
                type="text" 
                placeholder="بابت خرید میلگرد فاز فونداسیون..."
                value={chkDesc}
                onChange={e => setChkDesc(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
              />
            </div>
            <div className="col-span-full flex justify-end gap-2">
              <button 
                type="submit" 
                className="px-6 py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-semibold cursor-pointer"
              >
                ثبت صیادی چک
              </button>
              <button 
                type="button" 
                onClick={() => setIsAddingCheck(false)}
                className="px-6 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl"
              >
                انصراف
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Filter and Table list */}
      <div className="space-y-4">
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm space-y-3">
          <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            <div className="flex flex-wrap gap-2 text-xs">
              <button 
                onClick={() => setFilterStatus("all")}
                className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${filterStatus === "all" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600"}`}
              >
                همه چک‌ها
              </button>
              <button 
                onClick={() => setFilterStatus("pending")}
                className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${filterStatus === "pending" ? "bg-amber-600 border-amber-600 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600"}`}
              >
                در جریان وصول (سررسید معوق)
              </button>
              <button 
                onClick={() => setFilterStatus("passed")}
                className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${filterStatus === "passed" ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600"}`}
              >
                پاس شده و وصول شده
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex items-center flex-1 sm:flex-initial">
                <input 
                  type="text" 
                  placeholder="جستجو بر اساس شماره چک، صادرکننده، بانک..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 px-3 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
                />
                <Search className="w-4 h-4 text-slate-400 absolute right-2.5" />
              </div>

              <button
                type="button"
                onClick={() => setShowAdvSearch(!showAdvSearch)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer transition-colors ${showAdvSearch ? "bg-amber-50 border-amber-300 text-amber-700" : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"}`}
              >
                <Filter className="w-3.5 h-3.5" />
                جستجوی پیشرفته
              </button>

              <button
                type="button"
                onClick={() => handlePrintChecks("before_filter")}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="چاپ تمامی چک‌ها قبل از اعمال فیلتر"
              >
                <Printer className="w-3.5 h-3.5" />
                چاپ (قبل از فیلتر)
              </button>

              <button
                type="button"
                onClick={() => handlePrintChecks("after_filter")}
                className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="چاپ چک‌های فیلتر شده فعلی"
              >
                <Printer className="w-3.5 h-3.5" />
                چاپ (بعد از فیلتر)
              </button>
            </div>
          </div>

          {showAdvSearch && (
            <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-6 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl">
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">نوع برگه چک</label>
                <select value={advType} onChange={e => setAdvType(e.target.value as any)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none">
                  <option value="all">همه (پرداختی و دریافتی)</option>
                  <option value="outgoing">چک پرداختی (صادره)</option>
                  <option value="incoming">چک دریافتی (وارده)</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">پروژه مرتبط</label>
                <select value={advProjectId} onChange={e => setAdvProjectId(e.target.value)} className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none">
                  <option value="all">همه پروژه‌ها</option>
                  {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">سررسید از تاریخ</label>
                <ShamsiDatePicker value={advStartDate} onChange={setAdvStartDate} placeholder="۱۴۰۳/۰۱/۰۱" className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">سررسید تا تاریخ</label>
                <ShamsiDatePicker value={advEndDate} onChange={setAdvEndDate} placeholder="۱۴۰۳/۱۲/۲۹" className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
              </div>
              <div>
                <label className="block text-[10px] text-slate-500 font-bold mb-1">حداقل مبلغ (ریال)</label>
                <FormattedAmountInput value={advMinAmount} onChange={setAdvMinAmount} placeholder="از مبلغ..." className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
              </div>
              <div className="flex items-end gap-1.5">
                <div className="flex-1">
                  <label className="block text-[10px] text-slate-500 font-bold mb-1">حداکثر مبلغ (ریال)</label>
                  <FormattedAmountInput value={advMaxAmount} onChange={setAdvMaxAmount} placeholder="تا مبلغ..." className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery("");
                    setFilterStatus("all");
                    setAdvType("all");
                    setAdvProjectId("all");
                    setAdvStartDate("");
                    setAdvEndDate("");
                    setAdvMinAmount("");
                    setAdvMaxAmount("");
                  }}
                  className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold text-[10px] cursor-pointer whitespace-nowrap"
                >
                  پاکسازی
                </button>
              </div>
            </div>
          )}
        </div>

        {/* List of Checks */}
        <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-right border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-medium">
                  <th className="p-4">تاریخ سررسید</th>
                  <th className="p-4">سریال چک</th>
                  <th className="p-4">بانک عهده</th>
                  <th className="p-4">نوع</th>
                  <th className="p-4">ذی‌نفع / واگذارنده</th>
                  <th className="p-4">پروژه</th>
                  <th className="p-4 text-left">مبلغ (ریال)</th>
                  <th className="p-4 text-center">وضعیت</th>
                  <th className="p-4 text-center">وصول چک</th>
                  <th className="p-4 text-center">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredChecks.length === 0 ? (
                  <tr>
                    <td colSpan={10} className="text-center py-12 text-slate-400 font-light text-sm">هیچ چک صادر یا دریافت شده‌ای مطابق با فیلتر شما یافت نشد.</td>
                  </tr>
                ) : (
                  filteredChecks.map(check => {
                    const isOutgoing = check.type === "outgoing";
                    const isPending = check.status === "pending";

                    return (
                      <tr key={check.id} className="hover:bg-slate-50/60 transition-colors">
                        <td className="p-4 font-mono font-bold text-amber-700">{toFarsiDigits(check.dueDate)}</td>
                        <td className="p-4 font-mono font-medium text-slate-500">{toFarsiDigits(check.checkNumber)}</td>
                        <td className="p-4 font-light text-slate-700">{check.bankName}</td>
                        <td className="p-4">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                            isOutgoing ? "bg-rose-50 text-rose-700 border border-rose-100" : "bg-emerald-50 text-emerald-700 border border-emerald-100"
                          }`}>
                            {isOutgoing ? "صادره (پرداختی)" : "وارده (دریافتی)"}
                          </span>
                        </td>
                        <td className="p-4 font-semibold text-slate-800">{check.personName}</td>
                        <td className="p-4 font-light text-slate-500">
                          {projects.find(p => p.id === check.projectId)?.name || "عمومی"}
                        </td>
                        <td className="p-4 font-extrabold text-left text-sm text-slate-900">
                          {formatTomans(check.amount)}
                        </td>
                        <td className="p-4 text-center">
                          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${
                            check.status === "passed" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"
                          }`}>
                            {check.status === "passed" ? "وصول شده" : "درحال پیگیری"}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          {isPending ? (
                            <button 
                              onClick={() => setClearingCheck(check)}
                              className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-[10px] font-medium cursor-pointer transition-all border border-slate-800 shadow-sm"
                            >
                              پاس کردن چک
                            </button>
                          ) : (
                            <span className="text-slate-400 italic text-[11px] font-light">وصول قطعی</span>
                          )}
                        </td>
                        <td className="p-4 text-center">
                          <div className="flex justify-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleEditCheckClick(check)}
                              className="p-1 hover:bg-slate-50 rounded text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                              title="ویرایش چک"
                            >
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            {onDeleteCheck && (
                              <button
                                type="button"
                                onClick={() => onDeleteCheck(check.id)}
                                className="p-1 hover:bg-slate-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                                title="حذف چک"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Clearance Modal */}
      {clearingCheck && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-sm w-full p-6 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-1.5">
                <CheckSquare className="w-5 h-5 text-emerald-500" />
                تایید وصول و پاس شدن چک صیادی
              </h4>
              <button 
                onClick={() => setClearingCheck(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                ×
              </button>
            </div>

            <form onSubmit={handleClearanceSubmit} className="space-y-4 text-xs">
              <div className="space-y-2 text-slate-600 bg-slate-50 p-3.5 rounded-xl border border-slate-100">
                <p><span className="font-semibold">شماره چک:</span> {toFarsiDigits(clearingCheck.checkNumber)}</p>
                <p><span className="font-semibold">مبلغ سند:</span> {formatTomans(clearingCheck.amount)}</p>
                <p><span className="font-semibold">ذی‌نفع:</span> {clearingCheck.personName}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500 font-semibold">حساب بانکی جهت واریز/برداشت وجه چک</label>
                <select 
                  value={clearanceAccount}
                  onChange={e => setClearanceAccount(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                >
                  {accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} (موجودی: {formatTomans(a.balance)})</option>
                  ))}
                </select>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button 
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold cursor-pointer transition-colors"
                >
                  تایید و وصـول نهایی
                </button>
                <button 
                  type="button" 
                  onClick={() => setClearingCheck(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl"
                >
                  انصراف
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

    </div>
  );
}
