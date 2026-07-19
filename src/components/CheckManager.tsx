import React, { useState } from "react";
import { CheckItem, Account, Project } from "../types";
import { Clock, Plus, Search, Calendar, CheckSquare, RefreshCw, Landmark, AlertTriangle, Edit, Trash2 } from "lucide-react";
import { motion } from "motion/react";
import { ShamsiDatePicker } from "./ShamsiDatePicker";
import { FormattedAmountInput } from "./FormattedAmountInput";

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

  // New Check form state
  const [chkNumber, setChkNumber] = useState("");
  const [chkBank, setChkBank] = useState("");
  const [chkDueDate, setChkDueDate] = useState("1403/04/15");
  const [chkAmount, setChkAmount] = useState("");
  const [chkType, setChkType] = useState<"incoming" | "outgoing">("outgoing");
  const [chkPerson, setChkPerson] = useState("");
  const [chkProjId, setChkProjId] = useState(projects[0]?.id || "");
  const [chkDesc, setChkDesc] = useState("");

  // Clearance popup states
  const [clearingCheck, setClearingCheck] = useState<CheckItem | null>(null);
  const [clearanceAccount, setClearanceAccount] = useState(accounts[0]?.id || "");

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
    const matchesSearch = c.personName.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.checkNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          c.bankName.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (filterStatus === "pending") return c.status === "pending";
    if (filterStatus === "passed") return c.status === "passed";
    return true;
  });

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
          onClick={() => setIsAddingCheck(!isAddingCheck)}
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
        <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
          <div className="flex gap-2 text-xs">
            <button 
              onClick={() => setFilterStatus("all")}
              className={`px-3 py-1.5 rounded-lg border transition-all ${filterStatus === "all" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600"}`}
            >
              همه چک‌ها
            </button>
            <button 
              onClick={() => setFilterStatus("pending")}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${filterStatus === "pending" ? "bg-amber-600 border-amber-600 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600"}`}
            >
              در جریان وصول (سررسید معوق)
            </button>
            <button 
              onClick={() => setFilterStatus("passed")}
              className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 ${filterStatus === "passed" ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600"}`}
            >
              پاس شده و وصول شده
            </button>
          </div>

          <div className="relative flex items-center">
            <input 
              type="text" 
              placeholder="جستجو بر اساس شماره چک، صادرکننده..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full sm:w-64 px-3 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-amber-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute right-2.5" />
          </div>
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
