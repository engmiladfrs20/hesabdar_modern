import React from "react";
import { Project, Transaction, Account, CheckItem } from "../types";
import { DollarSign, Briefcase, Landmark, Clock, ArrowUpRight, ArrowDownRight, Package, AlertTriangle } from "lucide-react";
import { motion } from "motion/react";

interface DashboardProps {
  projects: Project[];
  transactions: Transaction[];
  accounts: Account[];
  checks: CheckItem[];
  onNavigate: (tab: string) => void;
}

export default function Dashboard({ projects, transactions, accounts, checks, onNavigate }: DashboardProps) {
  // Format currency in Rials
  const formatTomans = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
  };

  // Convert English numbers to Farsi digits
  const toFarsiDigits = (str: string | number) => {
    const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  // Calculations
  const totalBalance = accounts.reduce((acc, curr) => acc + (curr.balance || 0), 0);
  const incomeTransactions = transactions.filter(t => t.type === "income");
  const expenseTransactions = transactions.filter(t => t.type === "expense");
  const totalIncome = incomeTransactions.reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpenses = expenseTransactions.reduce((acc, curr) => acc + curr.amount, 0);

  // Active Projects
  const activeProjectsCount = projects.filter(p => p.status === "active").length;

  // Pending Checks
  const pendingChecks = checks.filter(c => c.status === "pending");
  const pendingChecksCount = pendingChecks.length;
  const pendingChecksAmount = pendingChecks.reduce((acc, curr) => acc + curr.amount, 0);

  // Category statistics for custom SVG chart
  const expenseByCat: { [key: string]: number } = {};
  expenseTransactions.forEach(t => {
    expenseByCat[t.category] = (expenseByCat[t.category] || 0) + t.amount;
  });

  const categories = Object.keys(expenseByCat);
  const categoryValues = Object.values(expenseByCat);
  const maxCategoryValue = Math.max(...categoryValues, 1);

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-l from-slate-900 via-slate-800 to-slate-950 p-6 rounded-2xl text-white shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-slate-700/50">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">به سامانه هوشمند حسابداری پیمانکاری خوش آمدید</h1>
          <p className="text-slate-300 text-sm mt-1 font-light">مدیریت آسان، هوشمند و تخصصی پروژه‌های ساختمانی بدون نیاز به دانش پیچیده حسابداری</p>
        </div>
        <div className="bg-white/10 backdrop-blur-md px-4 py-2 rounded-xl text-xs font-mono border border-white/20">
          امروز: {toFarsiDigits(new Date().toLocaleDateString("fa-IR"))}
        </div>
      </div>

      {/* Quick Statistics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Cash Balance */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium">موجودی نقد و بانک‌ها</span>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">{formatTomans(totalBalance)}</h3>
            <span className="text-[11px] text-emerald-600 font-light flex items-center gap-1">
              فعال در {toFarsiDigits(accounts.length)} صندوق و حساب بانکی
            </span>
          </div>
          <div className="p-3.5 bg-emerald-50 text-emerald-600 rounded-xl">
            <Landmark className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Card 2: Income */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium">کل دریافتی و درآمدها</span>
            <h3 className="text-lg font-bold text-slate-800 tracking-tight">{formatTomans(totalIncome)}</h3>
            <span className="text-[11px] text-emerald-600 font-light flex items-center gap-0.5" dir="ltr">
              <ArrowUpRight className="w-3 h-3 inline" /> +{toFarsiDigits(incomeTransactions.length)} سند
            </span>
          </div>
          <div className="p-3.5 bg-sky-50 text-sky-600 rounded-xl">
            <DollarSign className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Card 3: Expenses */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium">کل مخارج و هزینه‌ها</span>
            <h3 className="text-lg font-bold text-rose-600 tracking-tight">{formatTomans(totalExpenses)}</h3>
            <span className="text-[11px] text-rose-600 font-light flex items-center gap-0.5" dir="ltr">
              <ArrowDownRight className="w-3 h-3 inline" /> -{toFarsiDigits(expenseTransactions.length)} سند
            </span>
          </div>
          <div className="p-3.5 bg-rose-50 text-rose-600 rounded-xl">
            <Briefcase className="w-6 h-6" />
          </div>
        </motion.div>

        {/* Card 4: Approaching Checks */}
        <motion.div 
          whileHover={{ y: -3 }}
          className="bg-white p-5 rounded-2xl border border-slate-150 shadow-sm flex items-center justify-between"
        >
          <div className="space-y-1">
            <span className="text-xs text-slate-400 font-medium">چک‌های سررسید نشده</span>
            <h3 className="text-lg font-bold text-amber-600 tracking-tight">{formatTomans(pendingChecksAmount)}</h3>
            <span className="text-[11px] text-amber-600 font-light flex items-center gap-1">
              {toFarsiDigits(pendingChecksCount)} فقره چک در انتظار وصول
            </span>
          </div>
          <div className="p-3.5 bg-amber-50 text-amber-600 rounded-xl">
            <Clock className="w-6 h-6" />
          </div>
        </motion.div>
      </div>

      {/* Main Grid: Custom Charts and Quick Action Panel */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Custom SVG Chart of Expenses by Category (Bento Box 1) */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-base font-semibold text-slate-800">توزیع هزینه‌ها به تفکیک دسته‌بندی</h3>
            <span className="text-xs text-slate-400">بیشترین مخارج ساختمانی</span>
          </div>

          <div className="space-y-4 pt-2">
            {categories.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-sm font-light">هیچ تراکنش هزینه‌ای ثبت نشده است</div>
            ) : (
              categories.map((cat, idx) => {
                const val = expenseByCat[cat];
                const percentage = Math.round((val / totalExpenses) * 100) || 0;
                const progressWidth = `${(val / maxCategoryValue) * 100}%`;

                // Beautiful color schemes per index
                const barColors = [
                  "bg-amber-500", "bg-teal-500", "bg-rose-500", "bg-sky-500", "bg-violet-500", "bg-indigo-500"
                ];
                const bgColors = [
                  "bg-amber-50", "bg-teal-50", "bg-rose-50", "bg-sky-50", "bg-violet-50", "bg-indigo-50"
                ];
                const textColors = [
                  "text-amber-700", "text-teal-700", "text-rose-700", "text-sky-700", "text-violet-700", "text-indigo-700"
                ];

                const colorIdx = idx % barColors.length;

                return (
                  <div key={cat} className="space-y-1.5">
                    <div className="flex justify-between text-xs">
                      <span className="font-medium text-slate-700">{cat}</span>
                      <div className="space-x-2 space-x-reverse">
                        <span className="text-slate-400">({toFarsiDigits(percentage)}٪)</span>
                        <span className="font-semibold text-slate-800">{formatTomans(val)}</span>
                      </div>
                    </div>
                    <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: progressWidth }}
                        transition={{ duration: 0.8, delay: idx * 0.1 }}
                        className={`h-full rounded-full ${barColors[colorIdx]}`}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Due Check Alert & Actions (Bento Box 2) */}
        <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center gap-2 text-slate-800 font-semibold mb-4 border-b border-slate-100 pb-2">
              <Clock className="w-5 h-5 text-amber-500 animate-pulse" />
              <h3>چک‌های با سررسید نزدیک</h3>
            </div>

            <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1">
              {pendingChecks.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs font-light">هیچ چک معوق یا سررسید نشده‌ای در سیستم وجود ندارد</div>
              ) : (
                pendingChecks.map(check => (
                  <div 
                    key={check.id} 
                    className="p-3 rounded-xl border border-amber-100 bg-amber-50/50 hover:bg-amber-50 transition-colors flex justify-between items-center text-xs"
                  >
                    <div className="space-y-1">
                      <p className="font-semibold text-slate-800">{check.personName}</p>
                      <p className="text-[11px] text-slate-500 font-light">شماره: {toFarsiDigits(check.checkNumber)} ({check.bankName})</p>
                    </div>
                    <div className="text-left space-y-1">
                      <p className="font-bold text-amber-700">{formatTomans(check.amount)}</p>
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] bg-white text-amber-600 font-mono border border-amber-200">
                        {toFarsiDigits(check.dueDate)}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-slate-100 space-y-2">
            <button 
              onClick={() => onNavigate("checks")}
              className="w-full py-2.5 bg-slate-900 text-white rounded-xl text-xs font-medium hover:bg-slate-800 transition-colors shadow-sm flex justify-center items-center gap-1.5"
            >
              مدیریت و وصول چک‌ها
              <ArrowUpRight className="w-4 h-4" />
            </button>
            <button 
              onClick={() => onNavigate("transactions")}
              className="w-full py-2.5 bg-slate-50 text-slate-700 border border-slate-200 rounded-xl text-xs font-medium hover:bg-slate-100 transition-colors flex justify-center items-center gap-1.5"
            >
              ثبت دریافتی یا پرداختی جدید
            </button>
          </div>
        </div>
      </div>

      {/* Projects Cost Breakdown Progress */}
      <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
        <h3 className="text-base font-semibold text-slate-800">برآورد بودجه و درصد پیشرفت پروژه‌های عمرانی</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {projects.map(proj => {
            // Find total expenses specifically for this project
            const projExpenses = transactions
              .filter(t => t.projectId === proj.id && t.type === "expense")
              .reduce((sum, curr) => sum + curr.amount, 0);

            const pct = Math.round((projExpenses / proj.budget) * 100) || 0;
            const isOverBudget = projExpenses > proj.budget;

            return (
              <div 
                key={proj.id} 
                className="p-4 rounded-xl border border-slate-100 space-y-3 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => onNavigate("projects")}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-semibold text-slate-800 text-sm">{proj.name}</h4>
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] bg-slate-100 text-slate-600 mt-1 font-light">
                      مرحله فعلی: {proj.currentStage}
                    </span>
                  </div>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                    proj.status === "active" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                  }`}>
                    {proj.status === "active" ? "درحال ساخت" : "متوقف"}
                  </span>
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-xs">
                    <span className="text-slate-400">هزینه‌کرد واقعی: {formatTomans(projExpenses)}</span>
                    <span className="text-slate-400 font-light">بودجه کل: {formatTomans(proj.budget)}</span>
                  </div>
                  <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden relative">
                    <div 
                      className={`h-full rounded-full ${isOverBudget ? "bg-rose-500" : "bg-emerald-500"}`}
                      style={{ width: `${Math.min(pct, 100)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] pt-1">
                    <span className={isOverBudget ? "text-rose-600 font-medium" : "text-slate-500"}>
                      {isOverBudget ? "⚠️ بیش از سقف بودجه" : `${toFarsiDigits(pct)}٪ از کل بودجه مصرف شده`}
                    </span>
                    <span className="font-mono text-slate-400">{toFarsiDigits(pct)}٪</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
