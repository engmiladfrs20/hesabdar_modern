import React, { useState, useRef } from "react";
import { DatabaseSchema, Transaction, Project, ImprestExpense } from "../types";
import { 
  FileText, 
  Image as ImageIcon, 
  Upload, 
  Search, 
  Filter, 
  Download, 
  Trash2, 
  Eye, 
  Calendar, 
  User, 
  Building, 
  Plus, 
  CheckCircle, 
  AlertCircle, 
  Printer, 
  Database,
  X,
  FileCheck,
  FolderOpen
} from "lucide-react";
import { ShamsiDatePicker } from "./ShamsiDatePicker";
import { FormattedAmountInput } from "./FormattedAmountInput";
import { printStructuredReport } from "../utils/printReport";

interface DocumentArchiveProps {
  db: DatabaseSchema;
  getApiUrl: (endpoint: string) => string;
  onRefresh: () => void;
  projects: Project[];
}

export default function DocumentArchive({ db, getApiUrl, onRefresh, projects }: DocumentArchiveProps) {
  // Filters state
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedType, setSelectedType] = useState("all"); // 'all', 'factor', 'receipt', 'imprest', 'standalone'
  const [showAdvSearch, setShowAdvSearch] = useState(false);
  const [advStartDate, setAdvStartDate] = useState("");
  const [advEndDate, setAdvEndDate] = useState("");
  const [advMinAmount, setAdvMinAmount] = useState("");
  const [advMaxAmount, setAdvMaxAmount] = useState("");
  
  // Standalone upload state
  const [showUploadForm, setShowUploadForm] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState("");
  const [newDocProject, setNewDocProject] = useState("");
  const [newDocType, setNewDocType] = useState("factor"); // 'factor', 'receipt', 'contract', 'other'
  const [newDocAmount, setNewDocAmount] = useState("");
  const [newDocPerson, setNewDocPerson] = useState("");
  const [newDocDate, setNewDocDate] = useState(() => {
    // Return simple today date (Farsi approximation or standard representation)
    return "1403/04/20";
  });
  const [newDocDesc, setNewDocDesc] = useState("");
  const [newDocFileName, setNewDocFileName] = useState("");
  const [newDocFileData, setNewDocFileData] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [errorText, setErrorText] = useState("");

  // Lightbox view state
  const [activeLightboxDoc, setActiveLightboxDoc] = useState<any | null>(null);

  // File Input Ref
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreDbRef = useRef<HTMLInputElement>(null);

  // Parse all files from transactions and imprest expenses
  const documents: any[] = [];

  // 1. Invoices / Factors from transactions
  if (db.transactions) {
    db.transactions.forEach((tx) => {
      if (tx.attachmentData && tx.attachmentName) {
        documents.push({
          id: `tx-factor-${tx.id}`,
          sourceType: "transaction_factor",
          docType: "factor", // Invoice / Factor
          title: tx.description || `فاکتور خرید - ${tx.personName}`,
          fileName: tx.attachmentName,
          fileData: tx.attachmentData,
          amount: tx.amount,
          date: tx.date,
          person: tx.personName,
          category: tx.category,
          projectId: tx.projectId,
          referenceId: tx.id,
          rawTx: tx
        });
      }
      
      // 2. Receipts / Fishes from transaction level
      if (tx.receiptFileData && tx.receiptFileName) {
        documents.push({
          id: `tx-receipt-${tx.id}`,
          sourceType: "transaction_receipt",
          docType: "receipt", // Fish / Receipt
          title: `فیش واریز تسویه - ${tx.personName}`,
          fileName: tx.receiptFileName,
          fileData: tx.receiptFileData,
          amount: tx.amount,
          date: tx.date,
          person: tx.personName,
          category: tx.category,
          projectId: tx.projectId,
          referenceId: tx.id,
          rawTx: tx
        });
      }

      // 3. Receipts / Fishes inside transaction payments list
      if (tx.payments) {
        tx.payments.forEach((p) => {
          if (p.receiptFileData && p.receiptFileName) {
            documents.push({
              id: `tx-payment-${p.id}`,
              sourceType: "payment_receipt",
              docType: "receipt",
              title: p.description || `فیش پرداختی سند ${p.referenceNumber || ""}`,
              fileName: p.receiptFileName,
              fileData: p.receiptFileData,
              amount: p.amount,
              date: p.date,
              person: tx.personName,
              category: "پرداخت قسط / سند مالی",
              projectId: tx.projectId,
              referenceId: tx.id,
              paymentId: p.id
            });
          }
        });
      }
    });
  }

  // 4. Imprest Expenses / Scans
  if (db.imprestExpenses) {
    db.imprestExpenses.forEach((ie) => {
      if (ie.attachmentData && ie.attachmentName) {
        // Find associated imprest fund and project
        const fund = db.imprestFunds?.find(f => f.id === ie.imprestId);
        documents.push({
          id: `imprest-exp-${ie.id}`,
          sourceType: "imprest_expense",
          docType: "imprest",
          title: ie.description || `سند تنخواه - ${ie.personName || "کارگاه"}`,
          fileName: ie.attachmentName,
          fileData: ie.attachmentData,
          amount: ie.amount,
          date: ie.expenseDate,
          person: ie.personName || "تنخواه‌دار",
          category: ie.materialCategory || "هزینه کارگاه",
          projectId: fund ? fund.projectId : undefined,
          referenceId: ie.id,
          rawExpense: ie
        });
      }
    });
  }

  // File Reader for base64
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/") && file.type !== "application/pdf" && !file.name.endsWith(".pdf")) {
      setErrorText("فقط تصاویر (PNG, JPG, JPEG) و فایل‌های PDF برای بایگانی مجاز هستند.");
      return;
    }

    if (file.size > 8 * 1024 * 1024) {
      setErrorText("حجم فایل انتخابی بیش از حد مجاز (8 مگابایت) است.");
      return;
    }

    setErrorText("");
    setNewDocFileName(file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      if (event.target?.result) {
        setNewDocFileData(event.target.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  // Submit new standalone archive document
  const handleUploadStandalone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocTitle.trim()) {
      setErrorText("عنوان سند الزامی است.");
      return;
    }
    if (!newDocProject) {
      setErrorText("انتخاب پروژه الزامی است.");
      return;
    }
    if (!newDocFileData) {
      setErrorText("لطفا تصویر سند یا فاکتور را انتخاب کنید.");
      return;
    }

    setIsUploading(true);
    setErrorText("");

    try {
      // Save standalone document as a special transaction category "بایگانی دیجیتال اسناد"
      // This will seamlessly sync with the server database without breaking existing structures.
      const payload: Partial<Transaction> = {
        id: "doc_" + Date.now(),
        projectId: newDocProject,
        companyId: db.projects.find(p => p.id === newDocProject)?.companyId || "c1",
        type: newDocType === "receipt" ? "income" : "expense",
        category: `بایگانی ${newDocType === "factor" ? "فاکتور" : newDocType === "receipt" ? "فیش" : "سند"}`,
        subCategory: "بایگانی بایگانی",
        amount: Number(newDocAmount) || 0,
        accountId: "a6", // Central Box or petty cash default
        personName: newDocPerson || "ثبت مستقیم بایگانی",
        date: newDocDate,
        description: newDocDesc || `سند بایگانی شده: ${newDocTitle}`,
        isNonCash: false,
        attachmentName: newDocFileName,
        attachmentData: newDocFileData
      };

      const response = await fetch(getApiUrl("/api/transactions"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const result = await response.json();
      if (result.status === "success" || result.id) {
        setUploadSuccess(true);
        setTimeout(() => {
          setUploadSuccess(false);
          setShowUploadForm(false);
          setNewDocTitle("");
          setNewDocAmount("");
          setNewDocPerson("");
          setNewDocDesc("");
          setNewDocFileName("");
          setNewDocFileData("");
        }, 1500);
        onRefresh();
      } else {
        throw new Error(result.error || "خطایی رخ داد");
      }
    } catch (err: any) {
      setErrorText("خطا در ذخیره فایل در پایگاه داده: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Delete associated document
  const handleDeleteDoc = async (doc: any) => {
    if (!window.confirm("آیا از حذف دائم تصویر پیوست این سند اطمینان دارید؟ کدهای تراکنش حفظ شده اما تصویر پاک خواهد شد.")) {
      return;
    }

    setIsUploading(true);
    try {
      if (doc.sourceType === "transaction_factor") {
        // Update transaction and clear attachment fields
        const updatedTx = { ...doc.rawTx, attachmentName: null, attachmentData: null };
        await fetch(getApiUrl("/api/transactions"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedTx)
        });
      } else if (doc.sourceType === "transaction_receipt") {
        const updatedTx = { ...doc.rawTx, receiptFileName: null, receiptFileData: null };
        await fetch(getApiUrl("/api/transactions"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedTx)
        });
      } else if (doc.sourceType === "payment_receipt") {
        // Find transaction raw object
        const rawTx = db.transactions.find(t => t.id === doc.referenceId);
        if (rawTx && rawTx.payments) {
          const updatedPayments = rawTx.payments.map((p: any) => {
            if (p.id === doc.paymentId) {
              return { ...p, receiptFileName: null, receiptFileData: null };
            }
            return p;
          });
          const updatedTx = { ...rawTx, payments: updatedPayments };
          await fetch(getApiUrl("/api/transactions"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(updatedTx)
          });
        }
      } else if (doc.sourceType === "imprest_expense") {
        // Update imprest expense attachment fields on backend (POST request to appropriate route if exists or simulation)
        const updatedExp = { ...doc.rawExpense, attachmentName: null, attachmentData: null };
        await fetch(getApiUrl("/api/imprest-expenses"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(updatedExp)
        });
      }

      setActiveLightboxDoc(null);
      onRefresh();
    } catch (err: any) {
      alert("خطا در حذف تصویر: " + err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // Export full JSON database
  const handleExportDb = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(db, null, 2));
    const downloadAnchor = document.createElement("a");
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `hesabdar_peymankar_backup_${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  // Import / Restore full database
  const handleImportDb = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!window.confirm("هشدار جدی: با بازیابی دیتابیس پشتیبان، کل دیتابیس فعلی شما پاک شده و فایل پشتیبان جایگزین می‌شود. آیا ادامه می‌دهید؟")) {
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const importedData = JSON.parse(event.target?.result as string);
        
        // Basic structure check
        if (!importedData.projects || !importedData.transactions || !importedData.companies) {
          alert("فایل پشتیبان معتبر نیست. آرایه‌های اصلی سیستم وجود ندارند.");
          return;
        }

        const response = await fetch(getApiUrl("/api/db/import"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(importedData)
        });

        const resData = await response.json();
        if (resData.status === "success") {
          alert("پایگاه داده آفلاین شما با موفقیت از روی فایل پشتیبان بازگردانی شد!");
          onRefresh();
        } else {
          throw new Error(resData.error || "خطای همگام‌سازی ابری");
        }
      } catch (err: any) {
        alert("خطا در بارگذاری فایل پشتیبان: " + err.message);
      }
    };
    reader.readAsText(file);
  };

  // Filter and search
  const filteredDocs = documents.filter((doc) => {
    const matchesSearch = !searchTerm ||
      doc.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (doc.person && doc.person.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.category && doc.category.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (doc.fileName && doc.fileName.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesProject = selectedProject === "all" || doc.projectId === selectedProject;
    const matchesType = selectedType === "all" || doc.docType === selectedType;
    if (!matchesSearch || !matchesProject || !matchesType) return false;
    if (advStartDate && doc.date < advStartDate) return false;
    if (advEndDate && doc.date > advEndDate) return false;
    if (advMinAmount && (doc.amount || 0) < Number(advMinAmount)) return false;
    if (advMaxAmount && (doc.amount || 0) > Number(advMaxAmount)) return false;

    return true;
  });

  const handlePrintArchive = (mode: "before_filter" | "after_filter") => {
    const sourceList = mode === "before_filter" ? documents : filteredDocs;
    printStructuredReport({
      title: "گزارش فهرست اسناد و مدارک بایگانی الکترونیک",
      subtitle: mode === "before_filter" ? "چاپ کامل کلیه اسناد بایگانی (قبل از اعمال فیلتر)" : "چاپ اسناد بایگانی انتخابی (بعد از اعمال فیلتر)",
      filterSummary: mode === "after_filter" ? [
        searchTerm ? `جستجو: ${searchTerm}` : "",
        selectedProject !== "all" ? `پروژه: ${projects.find(p => p.id === selectedProject)?.name || ""}` : "",
        selectedType !== "all" ? `نوع سند: ${selectedType}` : "",
        advStartDate ? `از تاریخ: ${advStartDate}` : "",
        advEndDate ? `تا تاریخ: ${advEndDate}` : ""
      ].filter(Boolean).join(" | ") || "بدون فیلتر محدودکننده" : undefined,
      columns: [
        { header: "ردیف", accessor: (_, i) => String(i + 1) },
        { header: "تاریخ سند", accessor: (d) => d.date || "—" },
        { header: "عنوان سند", accessor: (d) => d.title },
        { header: "نوع پیوست", accessor: (d) => d.docType === "factor" ? "فاکتور خرید" : d.docType === "receipt" ? "فیش واریزی" : "سند تنخواه" },
        { header: "طرف حساب", accessor: (d) => d.person || "—" },
        { header: "پروژه", accessor: (d) => projects.find(p => p.id === d.projectId)?.name || "عمومی" },
        { header: "مبلغ (ریال)", accessor: (d) => d.amount ? `${Number(d.amount).toLocaleString("fa-IR")} ریال` : "—" }
      ],
      data: sourceList,
      summaryItems: [
        { label: "تعداد کل اسناد", value: `${sourceList.length} سند` },
        { label: "جمع مبالغ اسناد", value: `${sourceList.reduce((s, d) => s + (Number(d.amount) || 0), 0).toLocaleString("fa-IR")} ریال` }
      ]
    });
  };

  // Calculate stats
  const totalBase64Size = documents.reduce((sum, doc) => sum + (doc.fileData?.length || 0), 0);
  const sizeInMB = (totalBase64Size / (1024 * 1024)).toFixed(2);
  const invoiceCount = documents.filter(d => d.docType === "factor").length;
  const receiptCount = documents.filter(d => d.docType === "receipt").length;
  const imprestCount = documents.filter(d => d.docType === "imprest").length;

  return (
    <div className="space-y-6" dir="rtl">
      
      {/* Top Header Row with action buttons */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-3xl border border-slate-150 shadow-xs">
        <div>
          <h2 className="text-base font-extrabold text-slate-800 flex items-center gap-2">
            <FolderOpen className="w-5 h-5 text-indigo-600" />
            <span>بایگانی الکترونیک فاکتورها، فیش‌ها و ضمایم اسناد</span>
          </h2>
          <p className="text-[11px] text-slate-400 mt-1 font-medium">ذخیره، جستجو و نمایش تصاویر رسیدها و فاکتورها به همراه خروجی کامل دیتابیس</p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => setShowUploadForm(true)}
            className="flex items-center gap-2 px-3.5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
          >
            <Upload className="w-4 h-4" />
            <span>آپلود مستقیم سند یا فاکتور</span>
          </button>

          <button
            onClick={handleExportDb}
            title="پشتیبان‌گیری کامل از دیتابیس"
            className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            <Database className="w-4 h-4 text-emerald-600" />
            <span>پشتیبان‌گیری (Export DB)</span>
          </button>

          <label className="flex items-center gap-1.5 px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 rounded-xl text-xs font-bold transition-all cursor-pointer">
            <Upload className="w-4 h-4 text-amber-600" />
            <span>بازیابی پشتیبان</span>
            <input
              type="file"
              ref={restoreDbRef}
              onChange={handleImportDb}
              accept=".json"
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        <div className="bg-white p-4 rounded-2xl border border-slate-150 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-50 flex items-center justify-center text-indigo-600">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">کل اسناد دیجیتال</span>
            <span className="text-lg font-black text-slate-800">{documents.length} <span className="text-xs font-medium text-slate-400">سند</span></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-150 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-sky-50 flex items-center justify-center text-sky-600">
            <ImageIcon className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">فاکتورهای خرید</span>
            <span className="text-lg font-black text-slate-800">{invoiceCount} <span className="text-xs font-medium text-slate-400">تصویر فاکتور</span></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-150 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-emerald-50 flex items-center justify-center text-emerald-600">
            <FileCheck className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">فیش‌های واریزی و فیش‌ها</span>
            <span className="text-lg font-black text-slate-800">{receiptCount} <span className="text-xs font-medium text-slate-400">فیش تسویه</span></span>
          </div>
        </div>

        <div className="bg-white p-4 rounded-2xl border border-slate-150 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-amber-50 flex items-center justify-center text-amber-600">
            <Database className="w-6 h-6" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">فضای پایگاه داده مصرفی</span>
            <span className="text-lg font-black text-slate-800">{sizeInMB} <span className="text-xs font-medium text-slate-400">مگابایت</span></span>
          </div>
        </div>

      </div>

      {/* Filter and Search Panel */}
      <div className="bg-white p-5 rounded-2xl border border-slate-150 shadow-2xs space-y-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center">
          
          {/* Search Box */}
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="جستجو در عنوان سند، نام شخص، گروه مصالح یا نام فایل..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl pr-10 pl-3.5 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
            />
          </div>

          {/* Project Filter */}
          <div className="w-full md:w-44">
            <select
              value={selectedProject}
              onChange={(e) => setSelectedProject(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
            >
              <option value="all">همه پروژه‌ها</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          {/* Document Type Filter */}
          <div className="w-full md:w-44">
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
            >
              <option value="all">همه انواع پیوست‌ها</option>
              <option value="factor">فاکتورهای خرید (فاکتور)</option>
              <option value="receipt">فیش‌های بانکی و پرداختی</option>
              <option value="imprest">ضمایم تنخواه‌گردان کارگاه</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => setShowAdvSearch(!showAdvSearch)}
            className={`px-3 py-2.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 cursor-pointer ${showAdvSearch ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-slate-50 border-slate-200 text-slate-600"}`}
          >
            <Filter className="w-4 h-4" />
            جستجوی پیشرفته
          </button>

          <button
            type="button"
            onClick={() => handlePrintArchive("before_filter")}
            className="px-3 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            چاپ (قبل از فیلتر)
          </button>

          <button
            type="button"
            onClick={() => handlePrintArchive("after_filter")}
            className="px-3 py-2.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-xl text-xs font-bold flex items-center gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            چاپ (بعد از فیلتر)
          </button>

        </div>

        {showAdvSearch && (
          <div className="pt-3 border-t border-slate-100 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs bg-slate-50/70 p-3 rounded-xl">
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">از تاریخ</label>
              <ShamsiDatePicker value={advStartDate} onChange={setAdvStartDate} placeholder="۱۴۰۳/۰۱/۰۱" className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg outline-none" />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 font-bold mb-1">تا تاریخ</label>
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
                  setSearchTerm("");
                  setSelectedProject("all");
                  setSelectedType("all");
                  setAdvStartDate("");
                  setAdvEndDate("");
                  setAdvMinAmount("");
                  setAdvMaxAmount("");
                }}
                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-lg font-bold text-[10px] cursor-pointer"
              >
                پاکسازی
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Grid of Documents */}
      {filteredDocs.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-150 p-12 text-center text-slate-400 space-y-3">
          <ImageIcon className="w-12 h-12 text-slate-250 mx-auto" />
          <h3 className="font-extrabold text-slate-600 text-xs">هیچ پیوست یا فایلی یافت نشد</h3>
          <p className="text-[11px] text-slate-400 font-medium max-w-sm mx-auto leading-relaxed">
            موردی با فیلترهای انتخابی پیدا نشد. برای پیوست کردن تصاویر فاکتور یا فیش پرداخت می‌توانید در تراکنش‌ها فایلی انتخاب کنید یا با کلیک بر روی دکمه «آپلود مستقیم سند»، فایل جدید ثبت کنید.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5">
          {filteredDocs.map((doc) => {
            const associatedProj = projects.find(p => p.id === doc.projectId);
            const isImage = doc.fileData && doc.fileData.startsWith("data:image/");
            
            return (
              <div 
                key={doc.id}
                className="bg-white rounded-2xl border border-slate-150 overflow-hidden hover:shadow-md transition-all flex flex-col group"
              >
                {/* File Thumbnail Preview */}
                <div className="h-44 bg-slate-100 relative overflow-hidden flex items-center justify-center border-b border-slate-100">
                  {isImage ? (
                    <img 
                      src={doc.fileData} 
                      alt={doc.title}
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" 
                    />
                  ) : (
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-12 h-12 text-slate-300" />
                      <span className="text-[9px] text-slate-400 font-mono font-bold max-w-[150px] truncate">{doc.fileName}</span>
                    </div>
                  )}

                  {/* Badge */}
                  <span className={`absolute top-3 right-3 text-[9px] font-extrabold px-2.5 py-1 rounded-full text-white shadow-xs ${
                    doc.docType === "factor" 
                      ? "bg-sky-600" 
                      : doc.docType === "receipt" 
                        ? "bg-emerald-600" 
                        : "bg-amber-600"
                  }`}>
                    {doc.docType === "factor" ? "فاکتور خرید" : doc.docType === "receipt" ? "فیش واریز" : "سند تنخواه"}
                  </span>

                  {/* Hover action overlay */}
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-2 transition-opacity">
                    <button 
                      onClick={() => setActiveLightboxDoc(doc)}
                      className="p-2 bg-white hover:bg-slate-100 rounded-full text-slate-700 transition-colors shadow-xs cursor-pointer"
                      title="مشاهده بزرگنمایی"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <a
                      href={doc.fileData}
                      download={doc.fileName}
                      className="p-2 bg-white hover:bg-slate-100 rounded-full text-slate-700 transition-colors shadow-xs cursor-pointer flex items-center justify-center"
                      title="دانلود مستقیم"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <button
                      onClick={() => handleDeleteDoc(doc)}
                      className="p-2 bg-rose-600 hover:bg-rose-700 rounded-full text-white transition-colors shadow-xs cursor-pointer"
                      title="حذف ضمیمه"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Info details */}
                <div className="p-4 flex-1 flex flex-col justify-between space-y-3">
                  <div className="space-y-1">
                    <h4 className="font-extrabold text-xs text-slate-800 line-clamp-1 group-hover:text-indigo-600 transition-colors" title={doc.title}>
                      {doc.title}
                    </h4>
                    <span className="text-[9px] text-indigo-600 font-bold block max-w-full truncate">{associatedProj ? associatedProj.name : "بدون تخصیص پروژه"}</span>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex justify-between items-center text-[10px] text-slate-400 font-semibold">
                    <div className="flex items-center gap-1">
                      <Calendar className="w-3 h-3 text-slate-300" />
                      <span>{doc.date}</span>
                    </div>
                    {doc.amount > 0 && (
                      <span className="text-slate-700 font-black">
                        {doc.amount.toLocaleString()} <span className="text-[8px] font-medium text-slate-400">ریال</span>
                      </span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Standalone Upload Modal Form */}
      {showUploadForm && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-lg border border-slate-150 shadow-2xl overflow-hidden flex flex-col">
            
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50">
              <div className="flex items-center gap-2">
                <Upload className="w-5 h-5 text-indigo-600" />
                <h3 className="font-extrabold text-slate-800 text-sm">آپلود و ثبت مستقیم سند در بایگانی</h3>
              </div>
              <button 
                onClick={() => setShowUploadForm(false)}
                className="p-1.5 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-slate-400 hover:text-slate-700"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleUploadStandalone} className="p-6 space-y-4 overflow-y-auto max-h-[70vh]">
              
              {/* Error display */}
              {errorText && (
                <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs font-bold flex items-center gap-1.5">
                  <AlertCircle className="w-4 h-4" />
                  <span>{errorText}</span>
                </div>
              )}

              {/* Success display */}
              {uploadSuccess && (
                <div className="p-3 bg-emerald-50 border border-emerald-100 rounded-xl text-emerald-600 text-xs font-bold flex items-center gap-1.5">
                  <CheckCircle className="w-4 h-4" />
                  <span>سند دیجیتال با موفقیت در بایگانی دیتابیس ذخیره شد!</span>
                </div>
              )}

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold block">عنوان یا موضوع سند:</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: فاکتور خرید سیمان بتن پارت اول..."
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
                />
              </div>

              {/* Grid 2 Columns */}
              <div className="grid grid-cols-2 gap-3">
                {/* Project selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">پروژه مرتبط:</label>
                  <select
                    required
                    value={newDocProject}
                    onChange={(e) => setNewDocProject(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
                  >
                    <option value="">انتخاب پروژه...</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>

                {/* Type selector */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">نوع سند:</label>
                  <select
                    value={newDocType}
                    onChange={(e) => setNewDocType(e.target.value)}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
                  >
                    <option value="factor">فاکتور خرید (هزینه)</option>
                    <option value="receipt">فیش پرداختی / تسویه</option>
                    <option value="contract">سند قرارداد یا تعهد</option>
                    <option value="other">سایر اسناد کارگاهی</option>
                  </select>
                </div>
              </div>

              {/* Grid 2 Columns Info */}
              <div className="grid grid-cols-2 gap-3">
                {/* Amount */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">مبلغ به ریال (اختیاری):</label>
                  <FormattedAmountInput
                    placeholder="مبلغ به ریال..."
                    value={newDocAmount}
                    onChange={setNewDocAmount}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
                  />
                </div>

                {/* Date */}
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-bold block">تاریخ سند (روز/ماه/سال):</label>
                  <ShamsiDatePicker
                    required
                    placeholder="مثال: ۱۴۰۳/۰۴/۲۰"
                    value={newDocDate}
                    onChange={setNewDocDate}
                    className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
                  />
                </div>
              </div>

              {/* Person */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold block">طرف حساب / پیمانکار مرتبط (اختیاری):</label>
                <input
                  type="text"
                  placeholder="نام شخص یا شرکت طرف حساب..."
                  value={newDocPerson}
                  onChange={(e) => setNewDocPerson(e.target.value)}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2.5 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold block">توضیحات تکمیلی:</label>
                <textarea
                  placeholder="جزئیات بیشتر در مورد اقلام فاکتور یا فیش واریز..."
                  value={newDocDesc}
                  onChange={(e) => setNewDocDesc(e.target.value)}
                  rows={2}
                  className="w-full text-xs border border-slate-200 rounded-xl px-3.5 py-2 bg-slate-50 focus:outline-none focus:border-indigo-600 focus:bg-white transition-all font-semibold resize-none"
                />
              </div>

              {/* File input area */}
              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-bold block">انتخاب فایل تصویر فاکتور یا فیش:</label>
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-200 hover:border-indigo-500 rounded-2xl p-6 text-center cursor-pointer hover:bg-slate-50 transition-all flex flex-col items-center gap-2"
                >
                  <ImageIcon className="w-8 h-8 text-slate-300" />
                  {newDocFileName ? (
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-indigo-600 truncate max-w-xs">{newDocFileName}</p>
                      <p className="text-[9px] text-emerald-500 font-extrabold">✓ فایل با موفقیت خوانده شد</p>
                    </div>
                  ) : (
                    <div>
                      <p className="text-xs font-extrabold text-slate-600">کلیک کنید یا تصویر فاکتور را اینجا رها کنید</p>
                      <p className="text-[9px] text-slate-400 font-semibold mt-1">پسوندهای مجاز: PNG, JPG, JPEG و حداکثر حجم 8 مگابایت</p>
                    </div>
                  )}
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    accept="image/*"
                    className="hidden"
                  />
                </div>
              </div>

              {/* Footer buttons */}
              <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadForm(false)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-250 text-slate-750 text-xs font-bold rounded-xl transition-all cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isUploading || !newDocFileData}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold rounded-xl transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                >
                  <Upload className="w-4 h-4" />
                  <span>{isUploading ? "در حال ذخیره‌سازی..." : "ذخیره سند دیجیتال"}</span>
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* Lightbox Modal */}
      {activeLightboxDoc && (
        <div className="fixed inset-0 z-55 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white rounded-3xl w-full max-w-4xl border border-slate-200 shadow-2xl overflow-hidden flex flex-col md:flex-row h-[85vh]">
            
            {/* Left side: Image viewport */}
            <div className="flex-1 bg-slate-900 flex items-center justify-center p-4 relative h-[50vh] md:h-full">
              {activeLightboxDoc.fileData && activeLightboxDoc.fileData.startsWith("data:image/") ? (
                <img
                  src={activeLightboxDoc.fileData}
                  alt={activeLightboxDoc.title}
                  referrerPolicy="no-referrer"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400">
                  <FileText className="w-20 h-20 text-slate-500" />
                  <span className="text-xs font-bold">{activeLightboxDoc.fileName}</span>
                  <span className="text-[10px] text-slate-500">فایل غیر تصویری امکان پیش‌نمایش ندارد</span>
                </div>
              )}

              {/* Quick actions atop image */}
              <div className="absolute bottom-4 right-4 flex gap-2">
                <button
                  onClick={() => {
                    const printWin = window.open("", "_blank");
                    if (printWin) {
                      printWin.document.write(`<img src="${activeLightboxDoc.fileData}" style="max-width:100%; max-height:100%; display:block; margin:auto;" />`);
                      printWin.document.close();
                      printWin.print();
                    }
                  }}
                  className="p-2 bg-slate-800/80 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 shadow-md"
                  title="چاپ مستقیم فاکتور/فیش"
                >
                  <Printer className="w-4 h-4" />
                  <span>چاپ سند</span>
                </button>
                <a
                  href={activeLightboxDoc.fileData}
                  download={activeLightboxDoc.fileName}
                  className="p-2 bg-slate-800/80 hover:bg-slate-800 text-white rounded-xl text-xs font-semibold transition-colors flex items-center gap-1 shadow-md"
                >
                  <Download className="w-4 h-4" />
                  <span>دانلود فایل اصلی</span>
                </a>
              </div>
            </div>

            {/* Right side: Information block */}
            <div className="w-full md:w-80 border-t md:border-t-0 md:border-r border-slate-100 flex flex-col justify-between p-6 bg-slate-50">
              
              <div className="space-y-5">
                
                {/* Header */}
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className={`text-[9px] font-extrabold px-2.5 py-0.5 rounded-full text-white ${
                      activeLightboxDoc.docType === "factor" 
                        ? "bg-sky-600" 
                        : activeLightboxDoc.docType === "receipt" 
                          ? "bg-emerald-600" 
                          : "bg-amber-600"
                    }`}>
                      {activeLightboxDoc.docType === "factor" ? "فاکتور خرید" : activeLightboxDoc.docType === "receipt" ? "فیش واریز" : "سند کارگاهی"}
                    </span>
                    <h3 className="font-extrabold text-slate-800 text-sm mt-1 leading-relaxed">{activeLightboxDoc.title}</h3>
                  </div>
                  <button
                    onClick={() => setActiveLightboxDoc(null)}
                    className="p-1 hover:bg-slate-200 rounded-lg text-slate-450 hover:text-slate-700 transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Details list */}
                <div className="space-y-3 pt-4 border-t border-slate-150 text-xs font-semibold text-slate-600">
                  
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">تاریخ ثبت:</span>
                    <span className="text-slate-750 font-extrabold flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-slate-350" />
                      {activeLightboxDoc.date}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">طرف حساب:</span>
                    <span className="text-slate-750 font-extrabold flex items-center gap-1">
                      <User className="w-3.5 h-3.5 text-slate-350" />
                      {activeLightboxDoc.person || "-"}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">سرفصل مالی:</span>
                    <span className="text-slate-750 font-extrabold">{activeLightboxDoc.category || "-"}</span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-slate-400">نام فایل پیوست:</span>
                    <span className="text-slate-500 font-mono text-[10px] truncate max-w-[130px]" title={activeLightboxDoc.fileName}>{activeLightboxDoc.fileName}</span>
                  </div>

                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-200">
                    <span className="text-slate-400 text-xs">مبلغ سند:</span>
                    <span className="text-indigo-600 text-sm font-black">
                      {activeLightboxDoc.amount > 0 ? activeLightboxDoc.amount.toLocaleString() : "۰"} <span className="text-[9px] font-medium text-slate-400">ریال</span>
                    </span>
                  </div>

                </div>

              </div>

              {/* Delete button at bottom of drawer */}
              <div className="pt-4 border-t border-slate-150 flex gap-2">
                <button
                  onClick={() => handleDeleteDoc(activeLightboxDoc)}
                  disabled={isUploading}
                  className="flex-1 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100 font-bold rounded-xl text-xs transition-colors cursor-pointer flex items-center justify-center gap-1"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف این فایل پیوست
                </button>
                <button
                  onClick={() => setActiveLightboxDoc(null)}
                  className="px-4 py-2.5 bg-slate-200 hover:bg-slate-250 text-slate-750 font-bold rounded-xl text-xs transition-colors cursor-pointer"
                >
                  بستن
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

    </div>
  );
}
