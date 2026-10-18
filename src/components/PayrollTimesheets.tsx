import React, { useState, useEffect } from "react";
import { DatabaseSchema, Project, Contact, Account, TimesheetItem, PayrollItem } from "../types";
import { Plus, Users, Calendar, Coins, CheckCircle, RefreshCw, Briefcase, FileText, Landmark, Clock, Trash } from "lucide-react";
import { motion } from "motion/react";
import { ShamsiDatePicker } from "./ShamsiDatePicker";
import { FormattedAmountInput } from "./FormattedAmountInput";
import { getTodayShamsiString } from "../utils/shamsi";

interface PayrollTimesheetsProps {
  db: DatabaseSchema;
  activeCompanyId?: string;
  getApiUrl: (endpoint: string) => string;
  onRefresh: () => Promise<void>;
  projects: Project[];
}

export default function PayrollTimesheets({ db, activeCompanyId, getApiUrl, onRefresh, projects }: PayrollTimesheetsProps) {
  const [subTab, setSubTab] = useState<"timesheet" | "payroll">("timesheet");
  const [isSyncing, setIsSyncing] = useState(false);

  // Filter contacts to subcontractors/workers or other active parties
  const workers = db.contacts.filter(c => c.role === "subcontractor" || c.role === "imprest_holder" || c.role === "admin" || c.role === "supplier");

  // Sync state with db.timesheets & db.payrolls (with localStorage fallback)
  const [timesheets, setTimesheets] = useState<TimesheetItem[]>(() => {
    if (db.timesheets && db.timesheets.length > 0) return db.timesheets;
    const saved = localStorage.getItem("ns_timesheets");
    if (saved) return JSON.parse(saved);
    return [
      { id: "ts1", projectId: "p1", contactId: "co3", date: "1403/03/10", hoursWorked: 8, dailyRate: 150000, totalAmount: 1200000, description: "نظارت بر آرماتوربندی ستون‌ها" },
      { id: "ts2", projectId: "p1", contactId: "co4", date: "1403/03/12", hoursWorked: 10, dailyRate: 180000, totalAmount: 1800000, description: "تخلیه بتن‌ریزی فونداسیون" }
    ];
  });

  const [payrolls, setPayrolls] = useState<PayrollItem[]>(() => {
    if (db.payrolls && db.payrolls.length > 0) return db.payrolls;
    const saved = localStorage.getItem("ns_payrolls");
    if (saved) return JSON.parse(saved);
    return [
      { id: "pr1", projectId: "p1", contactId: "co3", amount: 1200000000, paymentDate: "1403/02/18", accountId: "a3", description: "پرداخت قسط اول دستمزد آرماتوربندی قاسمی", transactionId: "t2" }
    ];
  });

  useEffect(() => {
    if (db.timesheets) {
      setTimesheets(db.timesheets);
      localStorage.setItem("ns_timesheets", JSON.stringify(db.timesheets));
    }
    if (db.payrolls) {
      setPayrolls(db.payrolls);
      localStorage.setItem("ns_payrolls", JSON.stringify(db.payrolls));
    }
  }, [db.timesheets, db.payrolls]);

  // Form States - Timesheet
  const [tsProjectId, setTsProjectId] = useState(projects[0]?.id || "");
  const [tsContactId, setTsContactId] = useState(workers[0]?.id || "");
  const [tsDate, setTsDate] = useState(() => getTodayShamsiString());
  const [tsHours, setTsHours] = useState("");
  const [tsRate, setTsRate] = useState("");
  const [tsDesc, setTsDesc] = useState("");

  // Form States - Payroll
  const [prProjectId, setPrProjectId] = useState(projects[0]?.id || "");
  const [prContactId, setPrContactId] = useState(workers[0]?.id || "");
  const [prAmount, setPrAmount] = useState("");
  const [prDate, setPrDate] = useState(() => getTodayShamsiString());
  const [prAccountId, setPrAccountId] = useState(db.accounts[0]?.id || "");
  const [prDesc, setPrDesc] = useState("");

  const formatTomans = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
  };

  const toFarsiDigits = (str: string | number) => {
    const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const saveTimesheets = (list: TimesheetItem[]) => {
    localStorage.setItem("ns_timesheets", JSON.stringify(list));
    setTimesheets(list);
  };

  const savePayrolls = (list: PayrollItem[]) => {
    localStorage.setItem("ns_payrolls", JSON.stringify(list));
    setPayrolls(list);
  };

  const handleAddTimesheet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tsProjectId || !tsContactId || !tsHours || !tsRate) return;

    const hours = Number(tsHours);
    const rate = Number(tsRate);
    const total = hours * rate;

    const newTs: TimesheetItem = {
      id: "ts_" + Date.now(),
      projectId: tsProjectId,
      contactId: tsContactId,
      date: tsDate || getTodayShamsiString(),
      hoursWorked: hours,
      dailyRate: rate,
      totalAmount: total,
      description: tsDesc || "ثبت کارکرد روزانه"
    };

    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/timesheets"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTs)
      });
      if (response.ok) {
        await onRefresh();
      } else {
        saveTimesheets([newTs, ...timesheets]);
      }
    } catch {
      saveTimesheets([newTs, ...timesheets]);
    } finally {
      setIsSyncing(false);
    }

    setTsHours("");
    setTsRate("");
    setTsDesc("");
    setTsDate(getTodayShamsiString());
  };

  const handleDeleteTimesheet = async (id: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/timesheets/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (response.ok) {
        await onRefresh();
      } else {
        saveTimesheets(timesheets.filter(t => t.id !== id));
      }
    } catch {
      saveTimesheets(timesheets.filter(t => t.id !== id));
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddPayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prProjectId || !prContactId || !prAmount || !prAccountId) return;

    setIsSyncing(true);
    const amount = Number(prAmount);
    const targetProject = projects.find(p => p.id === prProjectId);
    const targetContact = workers.find(c => c.id === prContactId);

    try {
      const response = await fetch(getApiUrl("/api/payrolls"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: prProjectId,
          companyId: targetProject?.companyId || "c1",
          contactId: prContactId,
          personName: targetContact ? targetContact.name : "پیمانکار کارگاه",
          stage: targetProject?.currentStage || "سایر",
          amount: amount,
          paymentDate: prDate || getTodayShamsiString(),
          accountId: prAccountId,
          description: prDesc || `پرداخت حقوق/کارکرد به ${targetContact?.name || "پیمانکار"}`
        })
      });

      if (!response.ok) {
        throw new Error("خطا در ثبت سند مالی حقوق");
      }

      setPrAmount("");
      setPrDesc("");
      setPrDate(getTodayShamsiString());

      await onRefresh();
    } catch (err) {
      console.error("Error creating payroll transaction:", err);
      alert("خطا در ثبت پرداخت حقوق. لطفا اتصال اینترنت یا آدرس ورکر را بررسی کنید.");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleDeletePayroll = async (id: string) => {
    setIsSyncing(true);
    try {
      const response = await fetch(getApiUrl("/api/payrolls/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (response.ok) {
        await onRefresh();
      } else {
        savePayrolls(payrolls.filter(p => p.id !== id));
      }
    } catch {
      savePayrolls(payrolls.filter(p => p.id !== id));
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">حقوق، دستمزد و کارکرد روزانه</h2>
            <p className="text-slate-400 text-xs font-light">
              ثبت تایم‌شیت کارگران، استادکاران و مدیریت مبالغ پرداختی دستمزد به پیمانکاران جزء پروژه‌ها
            </p>
          </div>
        </div>

        {/* Sub-tabs */}
        <div className="bg-slate-100 p-1 rounded-xl flex gap-1">
          <button
            onClick={() => setSubTab("timesheet")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === "timesheet" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            دفتر کارکرد روزانه (تایم‌شیت)
          </button>
          <button
            onClick={() => setSubTab("payroll")}
            className={`px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              subTab === "payroll" ? "bg-white text-indigo-600 shadow-sm" : "text-slate-500 hover:text-slate-800"
            }`}
          >
            پرداخت حقوق و دستمزد (لیست معین)
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* RIGHT COLUMN: Form Entry */}
        <div className="lg:col-span-1 space-y-4">
          
          {subTab === "timesheet" ? (
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Clock className="w-4.5 h-4.5 text-indigo-500" />
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">ورود کارکرد روزانه</h3>
              </div>

              <form onSubmit={handleAddTimesheet} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">پروژه ساختمانی:</label>
                  <select
                    value={tsProjectId}
                    onChange={e => setTsProjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">پیمانکار / کارگر:</label>
                  <select
                    value={tsContactId}
                    onChange={e => setTsContactId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  >
                    {workers.length === 0 ? (
                      <option value="">هیچ کاربری با نقش پیمانکار تعریف نشده</option>
                    ) : (
                      workers.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.phone})</option>
                      ))
                    )}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold">میزان کارکرد (ساعت/روز):</label>
                    <input
                      type="number"
                      placeholder="مثال: ۸"
                      value={tsHours}
                      onChange={e => setTsHours(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold">نرخ واحد (ریال):</label>
                    <FormattedAmountInput
                      placeholder="مثال: ۱۵۰۰۰۰"
                      value={tsRate}
                      onChange={setTsRate}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">تاریخ ثبت:</label>
                  <ShamsiDatePicker
                    placeholder="۱۴۰۳/۰۴/۰۵"
                    value={tsDate}
                    onChange={setTsDate}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-center font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">توضیح کارکرد:</label>
                  <textarea
                    placeholder="مثال: سیم‌کشی سیستم روشنایی سقف طبقه سوم"
                    rows={2}
                    value={tsDesc}
                    onChange={e => setTsDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-colors cursor-pointer flex justify-center items-center gap-1.5 shadow-sm"
                >
                  <Plus className="w-4 h-4" />
                  ثبت کارکرد جدید
                </button>
              </form>
            </div>
          ) : (
            <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-xs space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <Landmark className="w-4.5 h-4.5 text-emerald-500" />
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">پرداخت دستمزد کارگاهی</h3>
              </div>

              <form onSubmit={handleAddPayroll} className="space-y-4 text-xs">
                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">پروژه ساختمانی مربوطه:</label>
                  <select
                    value={prProjectId}
                    onChange={e => setPrProjectId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">پیمانکار مقصد:</label>
                  <select
                    value={prContactId}
                    onChange={e => setPrContactId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  >
                    {workers.map(w => (
                      <option key={w.id} value={w.id}>{w.name} (طلب/بدهی: {toFarsiDigits(w.balance.toLocaleString())} ریال)</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold">مبلغ پرداختی (ریال):</label>
                    <FormattedAmountInput
                      placeholder="مثال: ۵,۰۰۰,۰۰۰"
                      value={prAmount}
                      onChange={setPrAmount}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      required
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-slate-500 font-bold">حساب پرداخت‌کننده:</label>
                    <select
                      value={prAccountId}
                      onChange={e => setPrAccountId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    >
                      {db.accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({toFarsiDigits(acc.balance.toLocaleString())})</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">تاریخ پرداخت:</label>
                  <ShamsiDatePicker
                    placeholder="۱۴۰۳/۰۴/۰۵"
                    value={prDate}
                    onChange={setPrDate}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-center font-mono"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-slate-500 font-bold">بابت / توضیحات سند:</label>
                  <textarea
                    placeholder="مثال: تسویه صورت وضعیت دستمزد اسکلت فاز ۲"
                    rows={2}
                    value={prDesc}
                    onChange={e => setPrDesc(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSyncing}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 cursor-pointer flex justify-center items-center gap-1.5 shadow-sm"
                >
                  {isSyncing ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      پرداخت و صدور سند دستمزد
                    </>
                  )}
                </button>
              </form>
            </div>
          )}

        </div>

        {/* LEFT COLUMN: Data Table / Log Details */}
        <div className="lg:col-span-2">
          
          {subTab === "timesheet" ? (
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4 h-full">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">ریز سوابق کارکرد روزانه (تایم‌شیت کارگران)</h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                  کل کارکرد: {toFarsiDigits(timesheets.length)} فقره
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <th className="py-2.5 px-3 text-right">تاریخ</th>
                      <th className="py-2.5 px-3 text-right">پروژه</th>
                      <th className="py-2.5 px-3 text-right">نیرو / استادکار</th>
                      <th className="py-2.5 px-3 text-center">میزان کارکرد</th>
                      <th className="py-2.5 px-3 text-left">نرخ (ریال)</th>
                      <th className="py-2.5 px-3 text-left">مجموع (ریال)</th>
                      <th className="py-2.5 px-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {timesheets.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center py-8 text-slate-400 font-light">
                          هیچ تایم‌شیت کارکردی ثبت نشده است
                        </td>
                      </tr>
                    ) : (
                      timesheets.map(t => {
                        const proj = projects.find(p => p.id === t.projectId);
                        const contact = workers.find(c => c.id === t.contactId);
                        return (
                          <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3 px-3 font-mono text-slate-500">{toFarsiDigits(t.date)}</td>
                            <td className="py-3 px-3 font-semibold text-slate-800">{proj?.name || "پروژه عمومی"}</td>
                            <td className="py-3 px-3">{contact?.name || "نیروی روزمزد"}</td>
                            <td className="py-3 px-3 text-center font-bold text-slate-700">{toFarsiDigits(t.hoursWorked)} روز/ساعت</td>
                            <td className="py-3 px-3 text-left font-mono">{toFarsiDigits(t.dailyRate.toLocaleString())}</td>
                            <td className="py-3 px-3 text-left font-bold text-indigo-600 font-mono">{toFarsiDigits(t.totalAmount.toLocaleString())}</td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleDeleteTimesheet(t.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                              >
                                <Trash className="w-4 h-4 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total earnings stats */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">مجموع مبالغ کارکرد ثبت‌شده:</span>
                <span className="text-base font-extrabold text-indigo-600">
                  {formatTomans(timesheets.reduce((acc, curr) => acc + curr.totalAmount, 0))}
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4 h-full">
              <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                <h3 className="font-bold text-slate-800 text-xs sm:text-sm">سوابق پرداخت‌های دستمزد و حقوق</h3>
                <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-1 rounded-lg">
                  تعداد اسناد پرداختی: {toFarsiDigits(payrolls.length)} سند
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-slate-600">
                  <thead>
                    <tr className="bg-slate-50 text-slate-500 border-b border-slate-100">
                      <th className="py-2.5 px-3 text-right">تاریخ</th>
                      <th className="py-2.5 px-3 text-right">پروژه ساختمانی</th>
                      <th className="py-2.5 px-3 text-right">پیمانکار جزء دریافت‌کننده</th>
                      <th className="py-2.5 px-3 text-right">حساب بانکی مبدأ</th>
                      <th className="py-2.5 px-3 text-left">مبلغ پرداختی (ریال)</th>
                      <th className="py-2.5 px-3 text-center">عملیات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="text-center py-8 text-slate-400 font-light">
                          هیچ سند پرداخت حقوقی ثبت نشده است
                        </td>
                      </tr>
                    ) : (
                      payrolls.map(p => {
                        const proj = projects.find(pr => pr.id === p.projectId);
                        const contact = workers.find(c => c.id === p.contactId);
                        const acc = db.accounts.find(a => a.id === p.accountId);
                        return (
                          <tr key={p.id} className="border-b border-slate-100 hover:bg-slate-50/50">
                            <td className="py-3 px-3 font-mono text-slate-500">{toFarsiDigits(p.paymentDate)}</td>
                            <td className="py-3 px-3 font-semibold text-slate-800">{proj?.name || "پروژه عمومی"}</td>
                            <td className="py-3 px-3">{contact?.name || "پیمانکار جزء"}</td>
                            <td className="py-3 px-3 font-light text-slate-500">{acc?.name || "صندوق"}</td>
                            <td className="py-3 px-3 text-left font-extrabold text-emerald-600 font-mono">{toFarsiDigits(p.amount.toLocaleString())}</td>
                            <td className="py-3 px-3 text-center">
                              <button
                                onClick={() => handleDeletePayroll(p.id)}
                                className="text-slate-400 hover:text-rose-600 p-1 rounded-lg hover:bg-rose-50 transition-colors"
                              >
                                <Trash className="w-4 h-4 mx-auto" />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Total payroll stats */}
              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                <span className="text-slate-500 font-medium">مجموع کل حقوق و دستمزد پرداخت‌شده:</span>
                <span className="text-base font-extrabold text-emerald-600">
                  {formatTomans(payrolls.reduce((acc, curr) => acc + curr.amount, 0))}
                </span>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
