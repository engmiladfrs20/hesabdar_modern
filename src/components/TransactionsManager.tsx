import React, { useState, useRef, useEffect } from "react";
import { Transaction, Account, Project, Contact } from "../types";
import { getTodayShamsiString } from "../utils/shamsi";
import { toEnglishDigits } from "../utils/digits";
import { Plus, Landmark, DollarSign, Receipt, FileText, ArrowUpRight, ArrowDownRight, Paperclip, Search, Sparkles, SlidersHorizontal, Download, CreditCard, Edit, Trash2, Printer } from "lucide-react";
import { motion } from "motion/react";
import { CONSTRUCTION_STAGES, getProjectEffectiveStageTree, flattenStageTreeToStrings } from "../data/constructionStages";
import { printStructuredReport } from "../utils/printReport";
import SearchableCombobox, { ComboboxOption } from "./SearchableCombobox";
import { ShamsiDatePicker } from "./ShamsiDatePicker";
import { FormattedAmountInput } from "./FormattedAmountInput";

interface TransactionsManagerProps {
  transactions: Transaction[];
  accounts: Account[];
  projects: Project[];
  contacts?: Contact[];
  activeUser?: any;
  onAddTransaction: (tx: Partial<Transaction>) => Promise<boolean | void> | boolean | void;
  onAddAccount: (acc: Partial<Account>) => void;
  onAddContact?: (contact: Partial<Contact>) => Promise<boolean | void> | boolean | void;
  onAddProject?: (project: Partial<Project>) => Promise<boolean | void> | boolean | void;
  onPayTransaction?: (paymentData: {
    transactionId: string;
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
  }) => void;
  onDeleteTransaction?: (id: string) => void;
  onDeleteAccount?: (id: string) => void;
  onApproveTransaction?: (id: string, approvalStatus: "approved" | "rejected", approvedAmount?: number) => void;
}

function numberToPersianWords(num: number): string {
  if (num === 0) return "صفر";

  const yekan = ["", "یک", "دو", "سه", "چهار", "پنج", "شش", "هفت", "هشت", "نه"];
  const dahgan = ["", "ده", "بیست", "سی", "چهل", "پنجاه", "شصت", "هفتاد", "هشتاد", "نود"];
  const sadgan = ["", "صد", "دویست", "سیصد", "چهارصد", "پانصد", "ششصد", "هفتصد", "هشتصد", "نهصد"];
  const dahYek = ["ده", "یازده", "دوازده", "سیزده", "چهارده", "پانزده", "شانزده", "هفده", "هجده", "نوزده"];

  const steps = ["", "هزار", "میلیون", "میلیارد", "تریلیون"];

  function convertThreeDigits(val: number): string {
    let result = "";
    const sad = Math.floor(val / 100);
    const dah = Math.floor((val % 100) / 10);
    const yek = val % 10;

    if (sad > 0) {
      result += sadgan[sad];
    }

    if (dah > 0) {
      if (result !== "") result += " و ";
      if (dah === 1) {
        result += dahYek[yek];
        return result;
      } else {
        result += dahgan[dah];
      }
    }

    if (yek > 0) {
      if (result !== "") result += " و ";
      result += yekan[yek];
    }

    return result;
  }

  let words = "";
  let tempNum = num;
  let stepIdx = 0;

  while (tempNum > 0) {
    const chunk = tempNum % 1000;
    if (chunk > 0) {
      const chunkWords = convertThreeDigits(chunk);
      const stepName = steps[stepIdx];
      const chunkWithStep = chunkWords + (stepName ? " " + stepName : "");
      
      if (words !== "") {
        words = chunkWithStep + " و " + words;
      } else {
        words = chunkWithStep;
      }
    }
    tempNum = Math.floor(tempNum / 1000);
    stepIdx++;
  }

  return words.trim();
}

export default function TransactionsManager({
  transactions,
  accounts,
  projects,
  contacts = [],
  activeUser,
  onAddTransaction,
  onAddAccount,
  onAddContact,
  onAddProject,
  onPayTransaction,
  onDeleteTransaction,
  onDeleteAccount,
  onApproveTransaction
}: TransactionsManagerProps) {
  const [activeSubTab, setActiveSubTab] = useState<"logs" | "accounts" | "add_tx" | "approvals">("logs");
  const [filterType, setFilterType] = useState<"all" | "income" | "expense" | "barter" | "attachment">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [personFilter, setPersonFilter] = useState<string>("all");

  // Advanced filter states
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterStage, setFilterStage] = useState("all");
  const [filterMaterial, setFilterMaterial] = useState("all");
  const [filterProject, setFilterProject] = useState("all");
  const [filterMinAmount, setFilterMinAmount] = useState("");
  const [filterMaxAmount, setFilterMaxAmount] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState("all");
  const [filterApprovalStatus, setFilterApprovalStatus] = useState("all");

  // Approvals tab search & filter states
  const [approvalSearchQuery, setApprovalSearchQuery] = useState("");
  const [approvalTabFilter, setApprovalTabFilter] = useState<"all" | "pending_all" | "pending_unpaid" | "pending_paid" | "approved" | "rejected">("pending_all");
  const [approvalProjectFilter, setApprovalProjectFilter] = useState("all");

  // Accounts tab search & filter states
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("all");

  // New Transaction Form state
  const [txType, setTxType] = useState<"income" | "expense">("expense");
  const [customApprovalAmounts, setCustomApprovalAmounts] = useState<Record<string, string>>({});
  const [txProjId, setTxProjId] = useState(projects[0]?.id || "");
  const [txCat, setTxCat] = useState("خرید مصالح");
  const [txSubCat, setTxSubCat] = useState("");
  const [txAmount, setTxAmount] = useState("");
  const [txAccount, setTxAccount] = useState(accounts[0]?.id || "");
  const [txCounterpartyAccount, setTxCounterpartyAccount] = useState("");
  const [txPerson, setTxPerson] = useState("");
  const [txDate, setTxDate] = useState(() => getTodayShamsiString());
  const [txInvoiceNum, setTxInvoiceNum] = useState("");
  const [txDesc, setTxDesc] = useState("");
  const [isNonCash, setIsNonCash] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [barterProperty, setBarterProperty] = useState("");
  const [barterValue, setBarterValue] = useState("");
  const [txPaymentStatus, setTxPaymentStatus] = useState<"paid" | "unpaid">("paid");

  // Editing transaction states
  const [editingTxId, setEditingTxId] = useState<string | null>(null);
  const [newPayments, setNewPayments] = useState<any[]>([]);

  // Individual payment slip creation state
  const [isAddingPaymentDoc, setIsAddingPaymentDoc] = useState(false);
  const [payDocAmount, setPayDocAmount] = useState("");
  const [payDocDate, setPayDocDate] = useState(() => getTodayShamsiString());
  const [payDocAccountId, setPayDocAccountId] = useState(accounts[0]?.id || "");
  const [payDocRefNum, setPayDocRefNum] = useState("");
  const [payDocInvoiceNum, setPayDocInvoiceNum] = useState("");
  const [payDocMethod, setPayDocMethod] = useState("فیش بانکی");
  const [payDocStatus, setPayDocStatus] = useState("تایید نهایی");
  const [payDocDestAcc, setPayDocDestAcc] = useState("");
  const [payDocReceiptName, setPayDocReceiptName] = useState("");
  const [payDocReceiptData, setPayDocReceiptData] = useState("");
  const [payDocDesc, setPayDocDesc] = useState("");
  const payDocFileInputRef = useRef<HTMLInputElement>(null);

  // Attachment states (Electronic Filing System)
  const [attachedFileName, setAttachedFileName] = useState<string>("");
  const [attachedFileData, setAttachedFileData] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // New Account state
  const [isAddingAcc, setIsAddingAcc] = useState(false);
  const [accName, setAccName] = useState("");
  const [accType, setAccType] = useState<"bank" | "petty_cash" | "cash" | "investor">("bank");
  const [accNumber, setAccNumber] = useState("");
  const [accBank, setAccBank] = useState("");
  const [accBalance, setAccBalance] = useState("");
  const [editingAccId, setEditingAccId] = useState<string | null>(null);

  // Selected factor for visual pop-up
  const [viewingAttachment, setViewingAttachment] = useState<Transaction | null>(null);
  const [selectedTxForPayments, setSelectedTxForPayments] = useState<Transaction | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => getTodayShamsiString());
  const [payAccount, setPayAccount] = useState("");
  const [payCounterpartyAccount, setPayCounterpartyAccount] = useState("");
  const [payInvoiceNum, setPayInvoiceNum] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payDesc, setPayDesc] = useState("");
  const [payModalError, setPayModalError] = useState<string | null>(null);

  // Sync default project ID when projects list updates
  useEffect(() => {
    if (!txProjId && projects.length > 0) {
      setTxProjId(projects[0].id);
    }
  }, [projects, txProjId]);

  useEffect(() => {
    if (accounts.length > 0 && txType === "expense") {
      if (!txAccount) setTxAccount(accounts[0].id);
      if (!payDocAccountId) setPayDocAccountId(accounts[0].id);
    }
  }, [accounts, txType]);

  // Keep selectedTxForPayments in sync with updated transactions prop
  useEffect(() => {
    if (selectedTxForPayments) {
      const updated = transactions.find(t => t.id === selectedTxForPayments.id);
      if (updated) setSelectedTxForPayments(updated);
    }
  }, [transactions]);

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

  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountModalName, setAccountModalName] = useState("");
  const [accountModalType, setAccountModalType] = useState<"bank" | "petty_cash" | "cash" | "investor">("bank");
  const [accountModalBankName, setAccountModalBankName] = useState("");
  const [accountModalNumber, setAccountModalNumber] = useState("");
  const [accountModalBalance, setAccountModalBalance] = useState("0");

  const [showStageModal, setShowStageModal] = useState(false);
  const [stageModalName, setStageModalName] = useState("");
  const [stageModalBranchId, setStageModalBranchId] = useState("");

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
      setTxPerson(contactModalName.trim());
      setShowContactModal(false);
    }
  };

  const handleQuickProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectModalName.trim() || !onAddProject) return;
    const defaultTree = getProjectEffectiveStageTree(null);
    const success = await onAddProject({
      name: projectModalName.trim(),
      address: projectModalAddress.trim(),
      budget: Number(projectModalBudget) || 0,
      totalArea: Number(projectModalArea) || 0,
      stageTree: defaultTree,
      stages: flattenStageTreeToStrings(defaultTree),
      currentStage: "اسکلت بتنی",
      status: "active"
    });
    if (success !== false) {
      setShowProjectModal(false);
    }
  };

  const handleQuickAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accountModalName.trim() || !onAddAccount) return;
    
    const typeNameMap = {
      bank: "بانک تجاری",
      petty_cash: "تنخواه گردان",
      cash: "صندوق نقد",
      investor: "آورده سرمایه‌گذار"
    };

    onAddAccount({
      name: accountModalName.trim(),
      type: accountModalType,
      typeName: typeNameMap[accountModalType] || "بانک تجاری",
      bankName: accountModalBankName.trim() || undefined,
      accountNumber: accountModalNumber.trim() || undefined,
      balance: Number(accountModalBalance) || 0
    });
    setShowAccountModal(false);
  };

  const handleQuickStageSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageModalName.trim() || !onAddProject || !txProjId) return;
    
    const activeProj = projects.find(p => p.id === txProjId);
    if (!activeProj) return;

    const currentTree = getProjectEffectiveStageTree(activeProj);
    let updatedTree = [...currentTree];
    let selectedFormattedLabel = stageModalName.trim();

    if (stageModalBranchId && stageModalBranchId !== "new_branch") {
      updatedTree = currentTree.map(branch => {
        if (branch.id !== stageModalBranchId) return branch;
        const nextIdx = (branch.subStages?.length || 0) + 1;
        const branchNum = branch.id.replace(/\D/g, "") || "1";
        const newCode = `${branchNum}-${nextIdx}`;
        selectedFormattedLabel = `${newCode} ${stageModalName.trim()}`;
        return {
          ...branch,
          subStages: [
            ...(branch.subStages || []),
            { id: `sub_${Date.now()}`, code: newCode, name: stageModalName.trim() }
          ]
        };
      });
    } else {
      const nextBranchNum = currentTree.length + 1;
      const newBranchId = `stg_${nextBranchNum}_${Date.now()}`;
      const subCode = `${nextBranchNum}-1`;
      selectedFormattedLabel = `${subCode} ${stageModalName.trim()}`;
      updatedTree.push({
        id: newBranchId,
        name: `${nextBranchNum}. ${stageModalName.trim()}`,
        subStages: [
          { id: `sub_${Date.now()}`, code: subCode, name: stageModalName.trim() }
        ]
      });
    }

    const updatedStages = Array.from(new Set([...(activeProj.stages || []), stageModalName.trim(), ...flattenStageTreeToStrings(updatedTree)]));
    const success = await onAddProject({
      ...activeProj,
      stageTree: updatedTree,
      stages: updatedStages
    });
    if (success !== false) {
      setTxSubCat(selectedFormattedLabel);
      setShowStageModal(false);
    }
  };

  const formatTomans = (num: number) => {
    return new Intl.NumberFormat("fa-IR").format(num) + " ریال";
  };

  const toFarsiDigits = (str: string | number) => {
    const farsiDigits = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
    return String(str).replace(/[0-9]/g, (w) => farsiDigits[parseInt(w)]);
  };

  const handleExportCSV = () => {
    const csvRows: string[] = [];
    csvRows.push("\uFEFFتاریخ,طرف حساب,شرح تراکنش,دسته‌بندی,حساب شرکت,حساب طرف مقابل,مبلغ (ریال),وضعیت پرداخت,وضعیت تأیید مدیریت");

    filteredTx.forEach(tx => {
      const acc = accounts.find(a => a.id === tx.accountId);
      const isIncome = tx.type === "income";
      const sign = isIncome ? "+" : "-";
      const statusText = tx.type === "income" ? "دریافت شده" : (tx.paymentStatus === "paid" ? "تسویه کامل" : (tx.paymentStatus === "partially_paid" ? "پرداخت جزئی" : "پرداخت نشده"));
      const approvalText = tx.type === "income" ? "—" : (tx.approvalStatus === "approved" ? "تأیید شده" : tx.approvalStatus === "rejected" ? "رد شده" : "در انتظار تأیید مدیریت");
      const cleanDesc = tx.description ? tx.description.replace(/"/g, '""') : "";
      const source = tx.isNonCash ? "تهاتر غیرنقدی" : (acc?.name || "صندوق");
      const counterparty = (tx.type === "income" ? tx.sourceAccount : tx.destinationAccount) || "—";

      csvRows.push(`"${tx.date}","${tx.personName}","${cleanDesc}","${tx.category}","${source}","${counterparty}","${sign}${tx.amount}","${statusText}","${approvalText}"`);
    });

    const csvContent = "data:text/csv;charset=utf-8," + csvRows.join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    const fileName = `گزارش_تراکنش_${personFilter === "all" ? "کل" : personFilter}.csv`;
    link.setAttribute("download", fileName);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Convert uploaded file to base64 for electronic filing system
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachedFileName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachedFileData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // Convert payment receipt file to base64
  const handlePayDocFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPayDocReceiptName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPayDocReceiptData(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    // Requirement 10: Mandatory receiving account selection when registering cash income
    if (txType === "income" && !isNonCash) {
      const hasMainAccount = !!txAccount && accounts.some(a => a.id === txAccount);
      const hasSlipAccount = isAddingPaymentDoc && !!payDocAccountId && accounts.some(a => a.id === payDocAccountId);
      const allExistingSlipsHaveAccount = newPayments.length > 0 && newPayments.every(p => !!p.accountId && accounts.some(a => a.id === p.accountId));
      if (!hasMainAccount && !hasSlipAccount && !allExistingSlipsHaveAccount) {
        setFormError("هنگام ثبت دریافتی (درآمد نقدی)، انتخاب «حساب دریافتی (حساب شرکت)» که مبلغ به آن بانک یا صندوق واریز شده اجباری است.");
        return;
      }
    }

    // If user left the inline payment slip sub-form open with an amount entered, auto-include it
    let finalPayments = [...newPayments];
    const cleanPayDocAmt = Number(toEnglishDigits(payDocAmount).replace(/,/g, "")) || 0;
    if (isAddingPaymentDoc && cleanPayDocAmt > 0) {
      if (txType === "income" && !isNonCash && !payDocAccountId && !txAccount) {
        setFormError("لطفاً حساب دریافتی (بانک یا صندوق شرکت) را برای فیش دریافتی مشخص نمایید.");
        return;
      }
      finalPayments.push({
        id: "p_" + Date.now(),
        amount: cleanPayDocAmt,
        date: payDocDate || txDate || getTodayShamsiString(),
        accountId: payDocAccountId || txAccount || (txType === "expense" ? (accounts[0]?.id || "a1") : ""),
        referenceNumber: payDocRefNum || "ثبت مستقیم",
        invoiceNumber: payDocInvoiceNum || txInvoiceNum || "",
        invoiceDescription: payDocDesc || txDesc || "",
        settlementMethod: payDocMethod,
        paymentStatus: payDocStatus,
        sourceAccount: txType === "income" ? (payDocDestAcc || txCounterpartyAccount) : undefined,
        destinationAccount: txType === "expense" ? (payDocDestAcc || txCounterpartyAccount) : (payDocDestAcc || txCounterpartyAccount),
        receiptFileName: payDocReceiptName,
        receiptFileData: payDocReceiptData,
        description: payDocDesc || txDesc || ""
      });
    }

    const sumPaymentsAmt = finalPayments.reduce((s, p) => s + Number(p.amount || 0), 0);
    const cleanTxAmt = Number(toEnglishDigits(txAmount).replace(/,/g, "")) || 0;
    const cleanBarterAmt = Number(toEnglishDigits(barterValue).replace(/,/g, "")) || 0;
    const numericAmount = cleanTxAmt > 0 ? cleanTxAmt : (sumPaymentsAmt > 0 ? sumPaymentsAmt : cleanBarterAmt);

    const resolvedPerson = txPerson.trim() || payDocDestAcc.trim();
    const resolvedInvNum = txInvoiceNum.trim() || finalPayments.find(p => p.invoiceNumber)?.invoiceNumber || "";
    const resolvedDesc = txDesc.trim() || finalPayments.find(p => p.invoiceDescription)?.invoiceDescription || barterProperty.trim() || `${txCat || (txType === "income" ? "پیش‌فروش" : "خرید مصالح")}${resolvedPerson ? " - " + resolvedPerson : ""}`;
    const resolvedSubCat = txSubCat || (isNonCash ? (activeProject?.currentStage || "اسکلت بتنی") : undefined);

    if (numericAmount <= 0) {
      setFormError("لطفاً مبلغ سند فاکتور یا مبلغ فیش پرداختی را وارد نمایید.");
      return;
    }
    if (!resolvedPerson) {
      setFormError("لطفاً نام طرف حساب (شخص/پیمانکار/خریدار) را انتخاب یا تایپ نمایید.");
      return;
    }

    const resolvedAccountId = txAccount || finalPayments[0]?.accountId || (txType === "expense" ? (accounts[0]?.id || "a1") : "");
    if (txType === "income" && !isNonCash && !resolvedAccountId) {
      setFormError("لطفاً حساب دریافتی (بانک یا صندوق شرکت) را به صورت اجباری انتخاب کنید.");
      return;
    }

    const validProjId = projects.some(p => p.id === txProjId) ? txProjId : (projects[0]?.id || "p1");
    const existingEditingTx = editingTxId ? transactions.find(t => t.id === editingTxId) : null;

    const res = await onAddTransaction({
      id: editingTxId || undefined,
      projectId: isBarterContact ? (selectedContact?.projectId || validProjId) : validProjId,
      type: txType,
      category: txCat || (txType === "income" ? "پیش‌فروش" : "خرید مصالح"),
      subCategory: resolvedSubCat,
      amount: numericAmount,
      accountId: resolvedAccountId,
      sourceAccount: txType === "income" ? (txCounterpartyAccount || finalPayments[0]?.sourceAccount || finalPayments[0]?.destinationAccount || undefined) : undefined,
      destinationAccount: txType === "expense" ? (txCounterpartyAccount || finalPayments[0]?.destinationAccount || undefined) : undefined,
      personName: resolvedPerson,
      date: txDate || getTodayShamsiString(),
      invoiceNumber: resolvedInvNum || undefined,
      description: resolvedDesc,
      isNonCash: isNonCash,
      barterDetails: isNonCash ? {
        propertyType: isBarterContact ? "واحد تهاتر شده ثبت شده" : "ملک/دارایی تهاتری",
        description: isBarterContact 
          ? (selectedContact?.barterUnits?.map(bu => bu.unitId === "after_scoring" ? "تعیین واحد بعد از امتیازدهی" : `واحد شماره ${bu.unitId.split("_").pop()}`).join(" - ") || "قرارداد تهاتر طرف حساب")
          : (barterProperty || resolvedDesc),
        agreedValue: isBarterContact ? numericAmount : (cleanBarterAmt || numericAmount)
      } : undefined,
      attachmentName: attachedFileName || undefined,
      attachmentData: attachedFileData || undefined,
      paymentStatus: isNonCash ? "paid" : (txType === "expense" ? txPaymentStatus : "paid"),
      // Requirement 9: Expense invoices ALWAYS start as "pending" (در انتظار تأیید مدیریت) until approved by manager, even if paid with slips attached
      approvalStatus: txType === "expense" ? (existingEditingTx?.approvalStatus === "approved" ? "approved" : "pending") : "approved",
      payments: finalPayments
    });

    if (res === false) {
      setFormError("خطا در ثبت نهایی فاکتور در سرور. لطفاً مقادیر وارد شده را بررسی کنید.");
      return;
    }

    // Reset Form
    setTxAmount("");
    setTxPerson("");
    setTxCounterpartyAccount("");
    setTxInvoiceNum("");
    setTxDesc("");
    setIsNonCash(false);
    setBarterProperty("");
    setBarterValue("");
    setAttachedFileName("");
    setAttachedFileData("");
    setTxPaymentStatus("paid");
    setEditingTxId(null);
    setNewPayments([]);
    setIsAddingPaymentDoc(false);
    setPayDocAmount("");
    setPayDocRefNum("");
    setPayDocInvoiceNum("");
    setPayDocDestAcc("");
    setPayDocDesc("");
    setFormError(null);
    setActiveSubTab("logs");
  };

  const handleEditTransaction = (tx: Transaction) => {
    setEditingTxId(tx.id);
    setTxType(tx.type);
    setTxProjId(tx.projectId);
    setTxCat(tx.category);
    setTxSubCat(tx.subCategory || "");
    setTxAmount(String(tx.amount));
    setTxAccount(tx.accountId);
    setTxCounterpartyAccount((tx.type === "income" ? tx.sourceAccount : tx.destinationAccount) || "");
    setTxPerson(tx.personName || "");
    setTxDate(tx.date);
    setTxInvoiceNum(tx.invoiceNumber || "");
    setTxDesc(tx.description || "");
    setIsNonCash(!!tx.isNonCash);
    setTxPaymentStatus((tx.paymentStatus as any) || "paid");
    setNewPayments(tx.payments || []);
    setAttachedFileName(tx.attachmentName || "");
    setAttachedFileData(tx.attachmentData || "");
    setActiveSubTab("add_tx");
  };

  const handleEditAccountClick = (acc: Account) => {
    setEditingAccId(acc.id);
    setAccName(acc.name);
    setAccType(acc.type as any);
    setAccNumber(acc.accountNumber || "");
    setAccBalance(acc.balance.toString());
    setIsAddingAcc(true);
  };

  const handleSubmitAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName) return;

    const typeNameMap = {
      bank: "بانک تجاری",
      petty_cash: "تنخواه گردان",
      cash: "صندوق نقد",
      investor: "آورده سرمایه‌گذار"
    };

    onAddAccount({
      id: editingAccId || undefined,
      name: accName,
      type: accType,
      typeName: typeNameMap[accType],
      accountNumber: accNumber || undefined,
      bankName: accBank || undefined,
      balance: Number(accBalance || 0)
    });

    setAccName("");
    setAccNumber("");
    setAccBank("");
    setAccBalance("");
    setEditingAccId(null);
    setIsAddingAcc(false);
  };

  const handlePaymentSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPayModalError(null);
    if (!selectedTxForPayments || !payAmount) return;

    // Requirement 10: Mandatory receiving account when registering receipt/income slip
    if (selectedTxForPayments.type === "income" && !payAccount) {
      setPayModalError("انتخاب «حساب دریافتی (حساب شرکت)» جهت مشخص شدن بانک یا صندوق واریزی اجباری است.");
      return;
    }

    if (onPayTransaction) {
      onPayTransaction({
        transactionId: selectedTxForPayments.id,
        amount: Number(payAmount),
        date: payDate,
        accountId: payAccount || (selectedTxForPayments.type === "expense" ? accounts[0]?.id : undefined),
        sourceAccount: selectedTxForPayments.type === "income" ? payCounterpartyAccount || undefined : undefined,
        destinationAccount: selectedTxForPayments.type === "expense" ? payCounterpartyAccount || undefined : payCounterpartyAccount || undefined,
        referenceNumber: payRef || undefined,
        invoiceNumber: payInvoiceNum || selectedTxForPayments.invoiceNumber || undefined,
        invoiceDescription: payDesc || selectedTxForPayments.description || undefined,
        description: payDesc || selectedTxForPayments.description || undefined
      });
    }

    // Reset Form
    setPayAmount("");
    setPayCounterpartyAccount("");
    setPayInvoiceNum("");
    setPayRef("");
    setPayDesc("");
  };

  // Filter and search logic
  const filteredTx = transactions.filter(t => {
    // 1. Person filter
    const matchesPerson = personFilter === "all" || t.personName === personFilter;
    if (!matchesPerson) return false;

    // 2. Search query
    const q = searchQuery.toLowerCase();
    const matchesSearch = !q ||
                          t.personName.toLowerCase().includes(q) || 
                          t.description.toLowerCase().includes(q) ||
                          t.category.toLowerCase().includes(q) ||
                          (t.invoiceNumber && t.invoiceNumber.toLowerCase().includes(q)) ||
                          (t.subCategory && t.subCategory.toLowerCase().includes(q)) ||
                          (t.sourceAccount && t.sourceAccount.toLowerCase().includes(q)) ||
                          (t.destinationAccount && t.destinationAccount.toLowerCase().includes(q));
    if (!matchesSearch) return false;

    // 3. Filter type (tabs)
    if (filterType === "income" && t.type !== "income") return false;
    if (filterType === "expense" && t.type !== "expense") return false;
    if (filterType === "barter" && !t.isNonCash) return false;
    if (filterType === "attachment" && !t.attachmentName) return false;

    // 4. Project filter
    if (filterProject !== "all" && t.projectId !== filterProject) return false;

    // 5. Date filter
    if (filterStartDate && t.date < filterStartDate) return false;
    if (filterEndDate && t.date > filterEndDate) return false;

    // 6. Construction Stage filter
    if (filterStage !== "all" && t.subCategory !== filterStage) return false;

    // 7. Material Type filter
    if (filterMaterial !== "all") {
      const textToSearch = (t.description + " " + t.category + " " + (t.subCategory || "")).toLowerCase();
      if (!textToSearch.includes(filterMaterial.toLowerCase())) return false;
    }

    // 8. Amount range filters
    if (filterMinAmount && t.amount < Number(filterMinAmount)) return false;
    if (filterMaxAmount && t.amount > Number(filterMaxAmount)) return false;

    // 9. Payment Status filter
    if (filterPaymentStatus !== "all") {
      const status = t.paymentStatus || (t.type === "income" ? "paid" : "unpaid");
      if (filterPaymentStatus === "paid" && status !== "paid") return false;
      if (filterPaymentStatus === "unpaid" && status !== "unpaid") return false;
      if (filterPaymentStatus === "partially_paid" && status !== "partially_paid") return false;
    }

    // 10. Manager Approval Status filter
    if (filterApprovalStatus !== "all") {
      const appSt = t.approvalStatus || "pending";
      if (filterApprovalStatus === "pending" && (t.type !== "expense" || (appSt !== "pending" && !!t.approvalStatus))) return false;
      if (filterApprovalStatus === "approved" && appSt !== "approved") return false;
      if (filterApprovalStatus === "rejected" && appSt !== "rejected") return false;
    }

    return true;
  });

  const activeFiltersCount = 
    (personFilter !== "all" ? 1 : 0) +
    (filterStartDate ? 1 : 0) +
    (filterEndDate ? 1 : 0) +
    (filterStage !== "all" ? 1 : 0) +
    (filterMaterial !== "all" ? 1 : 0) +
    (filterProject !== "all" ? 1 : 0) +
    (filterMinAmount ? 1 : 0) +
    (filterMaxAmount ? 1 : 0) +
    (filterPaymentStatus !== "all" ? 1 : 0) +
    (filterApprovalStatus !== "all" ? 1 : 0);

  const handlePrintTransactions = (useFiltered: boolean) => {
    const list = useFiltered ? filteredTx : transactions;
    const sumInc = list.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
    const sumExp = list.filter(t => t.type === "expense").reduce((s, t) => s + t.amount, 0);
    printStructuredReport({
      title: "گزارش دفتر معین تراکنش‌ها، دریافت‌ها و پرداخت‌ها",
      subtitle: useFiltered ? "گزارش بر اساس فیلترهای اعمال شده (بعد از فیلتر)" : "گزارش کامل تمامی تراکنش‌ها (قبل از فیلتر)",
      filterSummary: useFiltered
        ? `تعداد رکورد فیلتر شده: ${toFarsiDigits(list.length)} از ${toFarsiDigits(transactions.length)} | جستجو: ${searchQuery || "ندارد"} | شخص: ${personFilter === "all" ? "همه" : personFilter}`
        : `کل تراکنش‌های ثبت شده در سیستم (${toFarsiDigits(transactions.length)} مورد)`,
      columns: [
        { header: "ردیف", key: "idx" },
        { header: "شماره فاکتور", key: "inv" },
        { header: "تاریخ", key: "date" },
        { header: "طرف حساب", key: "person" },
        { header: "نوع / دسته‌بندی", key: "cat" },
        { header: "شرح تراکنش", key: "desc" },
        { header: "حساب شرکت / طرف مقابل", key: "acc" },
        { header: "وضعیت تأیید و تسویه", key: "status" },
        { header: "مبلغ (ریال)", key: "amount" }
      ],
      rows: list.map((tx, i) => {
        const acc = accounts.find(a => a.id === tx.accountId);
        const isInc = tx.type === "income";
        const dispInv = tx.invoiceNumber || tx.payments?.find(p => p.invoiceNumber)?.invoiceNumber || "—";
        const cpAcc = isInc ? tx.sourceAccount : tx.destinationAccount;
        const accLabel = tx.isNonCash
          ? "تهاتر غیرنقدی"
          : `${isInc ? "دریافتی:" : "مبدا:"} ${acc?.name || "صندوق"}${cpAcc ? ` | ${isInc ? "مبدا:" : "مقصد:"} ${cpAcc}` : ""}`;
        const appLabel = tx.type === "expense"
          ? (tx.approvalStatus === "approved" ? "تأیید مدیریت ✓" : tx.approvalStatus === "rejected" ? "رد شده ❌" : "تأیید نشده ⏳")
          : "دریافت قطعی";
        const paySt = tx.type === "income" ? "دریافت شده" : (tx.paymentStatus === "paid" ? "تسویه کامل" : tx.paymentStatus === "partially_paid" ? "پرداخت جزئی" : "پرداخت نشده");
        return {
          idx: toFarsiDigits(i + 1),
          inv: toFarsiDigits(dispInv),
          date: toFarsiDigits(tx.date),
          person: tx.personName,
          cat: `${isInc ? "دریافتی" : "هزینه"} - ${tx.category}${tx.subCategory ? ` (${tx.subCategory})` : ""}`,
          desc: tx.description,
          acc: accLabel,
          status: `${paySt} (${appLabel})`,
          amount: `${isInc ? "+" : "-"}${formatTomans(tx.amount)}`
        };
      }),
      summaryItems: [
        { label: "تعداد تراکنش‌ها", value: `${toFarsiDigits(list.length)} فقره` },
        { label: "جمع دریافتی‌ها (درآمد)", value: formatTomans(sumInc) },
        { label: "جمع پرداختی‌ها (هزینه)", value: formatTomans(sumExp) },
        { label: "تراز خالص دوره", value: formatTomans(sumInc - sumExp) }
      ]
    });
  };

  const filteredAccounts = accounts.filter(acc => {
    if (accountTypeFilter !== "all" && acc.type !== accountTypeFilter) return false;
    if (accountSearchQuery.trim()) {
      const q = accountSearchQuery.toLowerCase();
      const matchName = acc.name.toLowerCase().includes(q);
      const matchNum = (acc.accountNumber || "").toLowerCase().includes(q);
      const matchBank = (acc.bankName || "").toLowerCase().includes(q);
      if (!matchName && !matchNum && !matchBank) return false;
    }
    return true;
  });

  const handlePrintAccounts = (useFiltered: boolean) => {
    const list = useFiltered ? filteredAccounts : accounts;
    const sumBal = list.reduce((s, a) => s + a.balance, 0);
    printStructuredReport({
      title: "گزارش حساب‌های بانکی، صندوق‌ها و تنخواه‌گردان‌ها",
      subtitle: useFiltered ? "گزارش حساب‌های فیلتر شده (بعد از فیلتر)" : "گزارش کل منابع مالی (قبل از فیلتر)",
      filterSummary: useFiltered
        ? `تعداد حساب فیلتر شده: ${toFarsiDigits(list.length)} از ${toFarsiDigits(accounts.length)}`
        : `کل حساب‌های تعریف شده (${toFarsiDigits(accounts.length)} حساب)`,
      columns: [
        { header: "ردیف", key: "idx" },
        { header: "نام حساب / صندوق", key: "name" },
        { header: "نوع حساب", key: "type" },
        { header: "شماره حساب / کارت", key: "num" },
        { header: "موجودی فعلی (ریال)", key: "balance" }
      ],
      rows: list.map((a, i) => ({
        idx: toFarsiDigits(i + 1),
        name: a.name,
        type: a.typeName,
        num: toFarsiDigits(a.accountNumber || "—"),
        balance: formatTomans(a.balance)
      })),
      summaryItems: [
        { label: "تعداد حساب‌ها", value: `${toFarsiDigits(list.length)} حساب` },
        { label: "مجموع موجودی نقدی", value: formatTomans(sumBal) }
      ]
    });
  };

  const activeProject = projects.find(p => p.id === txProjId);
  const activeProjectStageTree = getProjectEffectiveStageTree(activeProject);

  const selectedContact = (contacts || []).find(c => c.name.trim() === txPerson.trim());
  const isBarterContact = !!(selectedContact?.paymentMethod === "barter" && selectedContact?.barterUnits && selectedContact.barterUnits.length > 0);

  const totalBarterVal = isBarterContact && selectedContact?.barterUnits
    ? selectedContact.barterUnits.reduce((sum, u) => sum + (u.area * u.price), 0)
    : 0;

  const prevBarterSum = isBarterContact && selectedContact
    ? (transactions || [])
        .filter(t => t.isNonCash && t.personName.trim() === selectedContact.name.trim())
        .reduce((sum, t) => sum + t.amount, 0)
    : 0;

  const remainingBarterVal = totalBarterVal - prevBarterSum;
  const currentInvoiceAmount = Number(txAmount || 0);
  const remainingAfterInvoice = remainingBarterVal - currentInvoiceAmount;

  // Preparing Combobox Options
  const projectOptions: ComboboxOption[] = projects.map(p => ({
    value: p.id,
    label: p.name,
    subLabel: p.address
  }));

  const stageOptions: ComboboxOption[] = [
    { value: "", label: "بدون فاز ساخت (عمومی)" }
  ];
  const addedStageValues = new Set<string>([""]);
  if (activeProject) {
    (activeProject.stages || []).forEach(st => {
      if (!addedStageValues.has(st)) {
        addedStageValues.add(st);
        stageOptions.push({
          value: st,
          label: st,
          group: "مراحل اصلی پروژه انتخابی"
        });
      }
    });
  }
  activeProjectStageTree.forEach(cat => {
    const cleanBranchName = cat.name.replace(/^\d+\.\s*/, "");
    if (!addedStageValues.has(cleanBranchName)) {
      addedStageValues.add(cleanBranchName);
      stageOptions.push({
        value: cleanBranchName,
        label: `🔹 شاخه اصلی: ${cat.name}`,
        group: cat.name
      });
    }
    (cat.subStages || []).forEach(sub => {
      const formatted = sub.code 
        ? `${sub.code} ${sub.name}` 
        : `${cleanBranchName} - ${sub.name}`;
      if (!addedStageValues.has(formatted)) {
        addedStageValues.add(formatted);
        stageOptions.push({
          value: formatted,
          label: formatted,
          group: cat.name
        });
      }
    });
  });

  const defaultExpenseCategories = ["خرید مصالح", "دستمزد", "علی‌الحساب", "اجاره ماشین‌آلات", "مالیات و عوارض", "سایر مخارج"];
  const defaultIncomeCategories = ["پیش‌فروش", "فروش واحد", "آورده", "سایر"];

  const customCategories = Array.from(
    new Set(
      (transactions || [])
        .filter(t => t.type === txType && t.category)
        .map(t => t.category)
    )
  ).filter(cat => {
    if (txType === "expense") {
      return !defaultExpenseCategories.includes(cat);
    } else {
      return !defaultIncomeCategories.includes(cat);
    }
  });

  const categoryOptions: ComboboxOption[] = txType === "expense" ? [
    { value: "خرید مصالح", label: "خرید مصالح" },
    { value: "دستمزد", label: "دستمزد روزمزد / پیمانکار دست دوم" },
    { value: "علی‌الحساب", label: "علی‌الحساب پیمانکار" },
    { value: "اجاره ماشین‌آلات", label: "اجاره تاور کرین و ماشین‌آلات" },
    { value: "مالیات و عوارض", label: "مالیات، بیمه و عوارض شهرداری" },
    { value: "سایر مخارج", label: "سایر مخارج کارگاهی" },
    ...customCategories.map(cat => ({ value: cat, label: cat }))
  ] : [
    { value: "پیش‌فروش", label: "پیش‌فروش واحدها" },
    { value: "فروش واحد", label: "فروش قطعی آپارتمان" },
    { value: "آورده", label: "آورده نقدی شریک/سرمایه‌گذار" },
    { value: "سایر", label: "سایر دریافتی‌ها" },
    ...customCategories.map(cat => ({ value: cat, label: cat }))
  ];

  const accountOptions: ComboboxOption[] = accounts.map(a => ({
    value: a.id,
    label: a.name,
    subLabel: `موجودی: ${formatTomans(a.balance)}`,
    group: a.typeName
  }));

  const contactOptions: ComboboxOption[] = (contacts || []).map(c => {
    const roleLabels: Record<string, string> = {
      pre_buyer: "پیش‌خریداران",
      supplier: "تأمین‌کنندگان مصالح / کالا",
      subcontractor: "پیمانکاران و استادکاران",
      imprest_holder: "تنخواه‌داران کارگاه",
      admin: "مدیران و پرسنل اداری"
    };
    return {
      value: c.name,
      label: c.name,
      group: roleLabels[c.role] || "سایر اشخاص",
      subLabel: c.phone ? `تلفن: ${toFarsiDigits(c.phone)}` : undefined
    };
  });

  const handleCustomContactAdd = async (newContactName: string) => {
    if (onAddContact) {
      const success = await onAddContact({
        name: newContactName,
        role: "supplier",
        phone: "",
        balance: 0
      });
      return success;
    }
  };

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* Header Tabs */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-slate-100 pb-2">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl">
            <Receipt className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800">سیستم دریافت و پرداخت</h2>
            <p className="text-slate-400 text-xs font-light">بایگانی الکترونیک اسناد، واریزی‌ها، فاکتورهای هزینه‌ای و حساب‌های بانکی</p>
          </div>
        </div>

        {/* Sub Navigation */}
        <div className="flex bg-slate-100 p-1 rounded-xl text-xs font-medium self-stretch md:self-auto items-center">
          <button 
            onClick={() => setActiveSubTab("logs")}
            className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${activeSubTab === "logs" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"}`}
          >
            دفتر معین تراکنش‌ها
          </button>
          <button 
            onClick={() => setActiveSubTab("accounts")}
            className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${activeSubTab === "accounts" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"}`}
          >
            حساب‌ها و تنخواه‌گردان‌ها
          </button>
          <button 
            onClick={() => setActiveSubTab("add_tx")}
            className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer ${activeSubTab === "add_tx" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"}`}
          >
            ثبت دریافت/پرداخت (فاکتور)
          </button>
          <button 
            onClick={() => setActiveSubTab("approvals")}
            className={`px-4 py-1.5 rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${activeSubTab === "approvals" ? "bg-white text-indigo-600 shadow-sm font-bold" : "text-slate-500 hover:text-slate-800"}`}
          >
            <span>بررسی و تأیید فاکتورها</span>
            {transactions.filter(t => t.type === "expense" && (t.approvalStatus === "pending" || !t.approvalStatus)).length > 0 && (
              <span className="bg-rose-500 text-white text-[9px] font-extrabold px-1.5 py-0.5 rounded-full shadow-xs">
                {transactions.filter(t => t.type === "expense" && (t.approvalStatus === "pending" || !t.approvalStatus)).length}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Tab 1: Logs Dashboard */}
      {activeSubTab === "logs" && (
        <div className="space-y-4">
          
          {/* Filters & Search Row */}
          <div className="space-y-3">
            <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
              <div className="flex flex-wrap gap-2 text-xs">
                <button 
                  onClick={() => setFilterType("all")}
                  className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${filterType === "all" ? "bg-indigo-600 border-indigo-600 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100"}`}
                >
                  همه تراکنش‌ها
                </button>
                <button 
                  onClick={() => setFilterType("income")}
                  className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${filterType === "income" ? "bg-emerald-600 border-emerald-600 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100"}`}
                >
                  دریافتی‌ها
                </button>
                <button 
                  onClick={() => setFilterType("expense")}
                  className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${filterType === "expense" ? "bg-rose-600 border-rose-600 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100"}`}
                >
                  پرداختی‌ها (هزینه‌ها)
                </button>
                <button 
                  onClick={() => setFilterType("barter")}
                  className={`px-3 py-1.5 rounded-lg border transition-all cursor-pointer ${filterType === "barter" ? "bg-amber-600 border-amber-600 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100"}`}
                >
                  تهاتر غیرنقدی
                </button>
                <button 
                  onClick={() => setFilterType("attachment")}
                  className={`px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1 cursor-pointer ${filterType === "attachment" ? "bg-slate-900 border-slate-900 text-white shadow-sm" : "bg-slate-50 border-slate-150 text-slate-600 hover:bg-slate-100"}`}
                >
                  <Paperclip className="w-3.5 h-3.5" />
                  دارای فایل ضمیمه (بایگانی)
                </button>
              </div>

              <div className="flex flex-wrap gap-2 items-center">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-bold whitespace-nowrap">فیلتر طرف حساب:</span>
                  <select
                    value={personFilter}
                    onChange={e => setPersonFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-medium"
                  >
                    <option value="all">همه اشخاص</option>
                    {contacts.map(c => (
                      <option key={c.id} value={c.name}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div className="relative flex items-center">
                  <input 
                    type="text" 
                    placeholder="جستجوی شخص، فاکتور، دسته‌بندی..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="w-full md:w-48 px-3 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500 font-medium"
                  />
                  <Search className="w-4 h-4 text-slate-400 absolute right-2.5" />
                </div>

                <button
                  type="button"
                  onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border cursor-pointer ${
                    showAdvancedFilters || activeFiltersCount > 0
                      ? "bg-indigo-600 border-indigo-600 text-white"
                      : "bg-slate-100 border-slate-200 text-slate-700 hover:bg-slate-150"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  <span>فیلترهای پیشرفته</span>
                  {activeFiltersCount > 0 && (
                    <span className="bg-red-500 text-white text-[9px] px-1.5 py-0.2 rounded-full font-mono">
                      {toFarsiDigits(activeFiltersCount)}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintTransactions(true)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-emerald-200 shadow-xs cursor-pointer"
                  title="چاپ رکوردهای فیلتر شده فعلی"
                >
                  <Printer className="w-3.5 h-3.5" />
                  چاپ بعد از فیلتر ({toFarsiDigits(filteredTx.length)})
                </button>

                <button
                  type="button"
                  onClick={() => handlePrintTransactions(false)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 shadow-xs cursor-pointer"
                  title="چاپ کل تراکنش‌ها بدون فیلتر"
                >
                  <Printer className="w-3.5 h-3.5" />
                  چاپ کل (قبل از فیلتر)
                </button>

                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-indigo-150 shadow-sm cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  دانلود اکسل
                </button>
              </div>
            </div>

            {/* Advanced Filters Expandable Panel */}
            {showAdvancedFilters && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-slate-50 p-4 rounded-xl border border-slate-150 shadow-inner grid grid-cols-1 md:grid-cols-4 gap-4 text-xs text-right animate-fade-in"
              >
                {/* Column 1: Date filters */}
                <div className="space-y-1.5">
                  <span className="text-slate-500 font-bold block">محدوده تاریخ هجری شمسی</span>
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

                {/* Column 2: Stage & Project */}
                <div className="space-y-1.5">
                  <span className="text-slate-500 font-bold block">مراحل اجرایی و پروژه</span>
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={filterProject}
                      onChange={e => setFilterProject(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="all">همه پروژه‌ها</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                    <select
                      value={filterStage}
                      onChange={e => setFilterStage(e.target.value)}
                      className="w-full px-2 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="all">همه مراحل ساخت</option>
                      {Array.from(new Set(transactions.map(t => t.subCategory).filter(Boolean))).map(stg => (
                        <option key={stg} value={stg!}>{stg}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Column 3: Material, Payment Status & Approval Status */}
                <div className="space-y-1.5">
                  <span className="text-slate-500 font-bold block">مصالح، وضعیت پرداخت و تأیید مدیر</span>
                  <div className="grid grid-cols-3 gap-1.5">
                    <select
                      value={filterMaterial}
                      onChange={e => setFilterMaterial(e.target.value)}
                      className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="all">همه مصالح</option>
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
                    <select
                      value={filterPaymentStatus}
                      onChange={e => setFilterPaymentStatus(e.target.value)}
                      className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="all">همه پرداخت‌ها</option>
                      <option value="paid">تسویه کامل</option>
                      <option value="unpaid">پرداخت‌نشده</option>
                      <option value="partially_paid">پرداخت جزئی</option>
                    </select>
                    <select
                      value={filterApprovalStatus}
                      onChange={e => setFilterApprovalStatus(e.target.value)}
                      className="w-full px-1.5 py-1.5 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-medium"
                    >
                      <option value="all">وضعیت تأیید</option>
                      <option value="pending">تأیید نشده (منتظر مدیر)</option>
                      <option value="approved">تأیید شده</option>
                      <option value="rejected">رد شده</option>
                    </select>
                  </div>
                </div>

                {/* Column 4: Amount bounds & clear button */}
                <div className="space-y-1.5">
                  <span className="text-slate-500 font-bold block">محدوده مبلغ (ریال)</span>
                  <div className="flex gap-2 items-center">
                    <FormattedAmountInput 
                      placeholder="حداقل" 
                      value={filterMinAmount}
                      onChange={setFilterMinAmount}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-mono outline-none focus:border-indigo-500 text-xs"
                    />
                    <span className="text-slate-400 font-light text-[10px]">تا</span>
                    <FormattedAmountInput 
                      placeholder="حداکثر" 
                      value={filterMaxAmount}
                      onChange={setFilterMaxAmount}
                      className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-xl text-center font-mono outline-none focus:border-indigo-500 text-xs"
                    />
                    {activeFiltersCount > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setPersonFilter("all");
                          setSearchQuery("");
                          setFilterType("all");
                          setFilterStartDate("");
                          setFilterEndDate("");
                          setFilterStage("all");
                          setFilterMaterial("all");
                          setFilterProject("all");
                          setFilterMinAmount("");
                          setFilterMaxAmount("");
                          setFilterPaymentStatus("all");
                          setFilterApprovalStatus("all");
                        }}
                        className="px-2 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 hover:text-rose-700 rounded-xl transition-all font-bold whitespace-nowrap cursor-pointer border border-rose-100"
                        title="حذف همه فیلترها"
                      >
                        حذف فیلترها
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Records Table/List */}
          <div className="bg-white rounded-2xl border border-slate-150 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-400 font-medium">
                    <th className="p-4 text-center">ردیف</th>
                    <th className="p-4 text-center">شماره فاکتور</th>
                    <th className="p-4">تاریخ</th>
                    <th className="p-4">طرف حساب</th>
                    <th className="p-4">شرح فاکتور / تراکنش</th>
                    <th className="p-4">دسته بندی</th>
                    <th className="p-4">حساب شرکت / حساب طرف حساب</th>
                    <th className="p-4 text-left">مبلغ (ریال)</th>
                    <th className="p-4 text-center">وضعیت تأیید مدیر و پرداخت</th>
                    <th className="p-4 text-center">بایگانی (ضمیمه)</th>
                    <th className="p-4 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {filteredTx.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="text-center py-12 text-slate-400 font-light text-sm">هیچ تراکنشی متناسب با فیلتر انتخابی شما یافت نشد.</td>
                    </tr>
                  ) : (
                    filteredTx.map((tx, idx) => {
                      const acc = accounts.find(a => a.id === tx.accountId);
                      const isIncome = tx.type === "income";

                      // Compute payment values
                      const totalPaid = tx.payments ? tx.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
                      const maxPayable = tx.type === "expense" && tx.approvedAmount !== undefined ? tx.approvedAmount : tx.amount;
                      const remainingToPay = Math.max(0, maxPayable - totalPaid);
                      const paymentStatus = tx.paymentStatus || (tx.type === "income" ? "paid" : "unpaid");
                      const displayInvNum = tx.invoiceNumber || tx.payments?.find(p => p.invoiceNumber)?.invoiceNumber || "—";
                      const counterpartyAcc = isIncome
                        ? (tx.sourceAccount || tx.payments?.find(p => p.sourceAccount || p.destinationAccount)?.sourceAccount || tx.payments?.find(p => p.destinationAccount)?.destinationAccount)
                        : (tx.destinationAccount || tx.payments?.find(p => p.destinationAccount)?.destinationAccount);

                      return (
                        <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-4 text-center font-mono font-bold text-slate-500">{toFarsiDigits(idx + 1)}</td>
                          <td className="p-4 text-center font-mono font-bold text-indigo-700">{toFarsiDigits(displayInvNum)}</td>
                          <td className="p-4 font-mono font-medium text-slate-500">{toFarsiDigits(tx.date)}</td>
                          <td className="p-4 font-semibold text-slate-800">{tx.personName}</td>
                          <td className="p-4 max-w-[220px] truncate font-light text-slate-600">{tx.description}</td>
                          <td className="p-4">
                            <span className={`px-2 py-0.5 rounded-md font-medium text-[10px] ${
                              tx.isNonCash ? "bg-amber-50 text-amber-700 border border-amber-100" : "bg-indigo-50 text-indigo-700"
                            }`}>
                              {tx.category} {tx.subCategory && `(${tx.subCategory})`}
                            </span>
                          </td>
                          <td className="p-4 text-slate-600 text-[11px]">
                            {tx.isNonCash ? (
                              <span className="text-amber-700 font-bold">تهاتر غیرنقدی</span>
                            ) : (
                              <div className="space-y-0.5">
                                <div>
                                  <span className="text-[9px] text-slate-400 font-bold">{isIncome ? "حساب دریافتی (شرکت): " : "منبع مالی (شرکت): "}</span>
                                  <strong className="text-slate-800">{acc?.name || "صندوق"}</strong>
                                </div>
                                {counterpartyAcc && (
                                  <div>
                                    <span className="text-[9px] text-slate-400 font-bold">{isIncome ? "حساب مبدا (واریزکننده): " : "حساب مقصد (گیرنده): "}</span>
                                    <span className="font-mono text-indigo-700">{toFarsiDigits(counterpartyAcc)}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </td>
                          <td className={`p-4 font-bold text-left text-sm ${isIncome ? "text-emerald-600" : "text-rose-600"}`}>
                            {isIncome ? "+" : "-"}{formatTomans(tx.amount)}
                          </td>
                          <td className="p-4 text-center">
                            {tx.type === "expense" && (
                              <div className="mb-2">
                                {tx.approvalStatus === "approved" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-150 text-[9px] font-black" title={`تأیید کننده: ${tx.approvedBy || "مدیر ارشد"}`}>
                                    ✓ تأیید شده توسط مدیریت {tx.approvedAmount !== undefined && `(${formatTomans(tx.approvedAmount)})`}
                                  </span>
                                ) : tx.approvalStatus === "rejected" ? (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-rose-50 text-rose-700 border border-rose-150 text-[9px] font-black">
                                    ❌ رد شده توسط مدیریت
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[9px] font-black animate-pulse">
                                    {(paymentStatus === "paid" || totalPaid > 0)
                                      ? "⏳ تأیید نشده (منتظر رویت و تأیید فاکتور/فیش توسط مدیر)"
                                      : "⏳ تأیید نشده (منتظر تأیید مدیریت جهت پرداخت)"}
                                  </span>
                                )}
                              </div>
                            )}
                            {isIncome ? (
                              <div className="flex flex-col items-center gap-1">
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                                  دریافت شده
                                </span>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayAccount(tx.accountId || "");
                                    setPayCounterpartyAccount(tx.sourceAccount || "");
                                    setPayModalError(null);
                                    setSelectedTxForPayments(tx);
                                  }}
                                  className="mt-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold border border-indigo-100 transition-colors flex items-center gap-0.5 cursor-pointer"
                                >
                                  مشاهده/ثبت اسناد دریافت
                                </button>
                              </div>
                            ) : tx.isNonCash ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 border border-slate-200 text-[10px] font-bold">
                                تسویه تهاتری
                              </span>
                            ) : (
                              <div className="flex flex-col items-center gap-1">
                                {paymentStatus === "paid" || remainingToPay <= 0 ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100 text-[10px] font-bold">
                                    فیش ثبت شده / تسویه کامل
                                  </span>
                                ) : paymentStatus === "partially_paid" ? (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-150 text-[10px] font-bold">
                                    پرداخت جزئی (مانده: {formatTomans(remainingToPay)})
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 text-rose-700 border border-rose-150 text-[10px] font-bold">
                                    پرداخت نشده
                                  </span>
                                )}
                                
                                <button
                                  type="button"
                                  onClick={() => {
                                    setPayAccount(tx.accountId || accounts[0]?.id || "");
                                    setPayCounterpartyAccount(tx.destinationAccount || "");
                                    setPayModalError(null);
                                    setSelectedTxForPayments(tx);
                                  }}
                                  className="mt-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded text-[9px] font-bold border border-indigo-100 transition-colors flex items-center gap-0.5 cursor-pointer"
                                >
                                  {paymentStatus === "paid" ? "مشاهده اسناد پرداخت" : "ثبت/مشاهده پرداخت‌ها"}
                                </button>
                              </div>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            {tx.attachmentName ? (
                              <button 
                                onClick={() => setViewingAttachment(tx)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-[11px] font-medium transition-all flex items-center gap-1 mx-auto cursor-pointer border border-indigo-100"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                فاکتور ضمیمه
                              </button>
                            ) : (
                              <span className="text-slate-300 font-light italic text-[11px]">بدون پیوست</span>
                            )}
                          </td>
                          <td className="p-4 text-center">
                            <div className="flex justify-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => handleEditTransaction(tx)}
                                className="px-2 py-1 bg-amber-50 hover:bg-amber-100 text-amber-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer border border-amber-150 shadow-sm"
                                title="ویرایش و بروزرسانی فاکتور و اسناد مالی"
                              >
                                <Edit className="w-3 h-3 text-amber-600" />
                                ویرایش
                              </button>
                              {onDeleteTransaction && (
                                <button
                                  type="button"
                                  onClick={() => onDeleteTransaction(tx.id)}
                                  className="px-2 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-[10px] font-bold transition-all flex items-center gap-0.5 cursor-pointer border border-rose-150 shadow-sm"
                                  title="حذف تراکنش و اسناد تابعه"
                                >
                                  <Trash2 className="w-3 h-3 text-rose-600" />
                                  حذف
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
      )}

      {/* Tab 2: Accounts Summary */}
      {activeSubTab === "accounts" && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3">
            <h3 className="text-sm font-bold text-slate-800">لیست بانک‌ها، صندوق‌ها و صاحبان سرمایه</h3>
            <div className="flex flex-wrap gap-2 items-center text-xs">
              <div className="relative flex items-center">
                <input
                  type="text"
                  placeholder="جستجوی نام حساب یا شماره کارت..."
                  value={accountSearchQuery}
                  onChange={e => setAccountSearchQuery(e.target.value)}
                  className="px-3 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5" />
              </div>
              <select
                value={accountTypeFilter}
                onChange={e => setAccountTypeFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
              >
                <option value="all">همه انواع حساب</option>
                <option value="bank">بانک تجاری</option>
                <option value="petty_cash">تنخواه گردان</option>
                <option value="cash">صندوق نقد</option>
                <option value="investor">آورده سرمایه‌گذار</option>
              </select>
              <button
                type="button"
                onClick={() => handlePrintAccounts(true)}
                className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-emerald-200 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                چاپ بعد از فیلتر ({toFarsiDigits(filteredAccounts.length)})
              </button>
              <button
                type="button"
                onClick={() => handlePrintAccounts(false)}
                className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                چاپ کل (قبل از فیلتر)
              </button>
              <button 
                onClick={() => setIsAddingAcc(!isAddingAcc)}
                className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs transition-colors flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                تعریف منبع مالی جدید
              </button>
            </div>
          </div>

          {/* Add Account Modal */}
          {isAddingAcc && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white p-5 rounded-xl border border-slate-150 shadow-md space-y-4 text-xs"
            >
              <h4 className="font-bold text-slate-800 border-b border-slate-100 pb-2">
                {editingAccId ? "ویرایش و اصلاح منبع مالی" : "تعریف حساب، صندوق یا تنخواه‌گردان جدید"}
              </h4>
              <form onSubmit={handleSubmitAccount} className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">نام حساب/تنخواه (برچسب)</label>
                  <input 
                    type="text" 
                    placeholder="مثال: تنخواه مهندس اکبری"
                    value={accName}
                    onChange={e => setAccName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                    required
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">نوع حساب</label>
                  <select 
                    value={accType}
                    onChange={e => setAccType(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="bank">بانک تجاری</option>
                    <option value="petty_cash">تنخواه گردان</option>
                    <option value="cash">صندوق نقد</option>
                    <option value="investor">آورده سرمایه‌گذار</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">شماره حساب / کارت (اختیاری)</label>
                  <input 
                    type="text" 
                    placeholder="مثل: ۵۰۲۲..."
                    value={accNumber}
                    onChange={e => setAccNumber(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-slate-500 font-medium">موجودی اولیه (ریال)</label>
                  <FormattedAmountInput 
                    placeholder="مثال: ۱۰۰۰۰۰۰۰"
                    value={accBalance}
                    onChange={setAccBalance}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div className="col-span-full flex justify-end gap-2">
                  <button 
                    type="submit" 
                    className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-medium cursor-pointer"
                  >
                    {editingAccId ? "بروزرسانی منبع مالی" : "ایجاد منبع مالی"}
                  </button>
                  <button 
                    type="button" 
                    onClick={() => {
                      setIsAddingAcc(false);
                      setEditingAccId(null);
                      setAccName("");
                      setAccNumber("");
                      setAccBank("");
                      setAccBalance("");
                    }}
                    className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl"
                  >
                    انصراف
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* Accounts Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredAccounts.map(acc => {
              let iconColor = "bg-indigo-50 text-indigo-600";
              if (acc.type === "petty_cash") iconColor = "bg-amber-50 text-amber-600";
              if (acc.type === "investor") iconColor = "bg-emerald-50 text-emerald-600";

              return (
                <div key={acc.id} className="p-4 bg-white border border-slate-150 rounded-xl flex items-center justify-between shadow-sm hover:border-slate-300 transition-all">
                  <div className="space-y-1">
                    <span className="text-[10px] bg-slate-50 text-slate-400 border border-slate-100 px-2 py-0.5 rounded-full font-medium">
                      {acc.typeName}
                    </span>
                    <h4 className="font-bold text-slate-800 text-xs mt-1">{acc.name}</h4>
                    {acc.accountNumber && (
                      <p className="text-[10px] text-slate-400 font-mono font-light">کارت: {toFarsiDigits(acc.accountNumber)}</p>
                    )}
                    <p className="text-sm font-extrabold text-slate-800 mt-2">{formatTomans(acc.balance)}</p>
                  </div>

                  <div className="flex flex-col items-end gap-3">
                    <div className={`p-2.5 rounded-xl ${iconColor}`}>
                      <Landmark className="w-5 h-5" />
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => handleEditAccountClick(acc)}
                        className="p-1 hover:bg-slate-50 rounded text-slate-400 hover:text-indigo-600 transition-colors cursor-pointer"
                        title="ویرایش"
                      >
                        <Edit className="w-3.5 h-3.5" />
                      </button>
                      {onDeleteAccount && (
                        <button
                          onClick={() => onDeleteAccount(acc.id)}
                          className="p-1 hover:bg-slate-50 rounded text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 3: Create Transaction Form */}
      {activeSubTab === "add_tx" && (
        <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-6">
          <h3 className="text-base font-bold text-slate-800 border-b border-slate-100 pb-2 flex justify-between items-center">
            <span>{editingTxId ? "ویرایش و بروزرسانی فاکتور و اسناد مالی" : "ثبت فاکتور خرید، فروش یا تهاتر واحد"}</span>
            <span className="text-xs font-medium text-slate-400">سیستم مدیریت چندمرحله‌ای اسناد پرداخت و فیش‌های واریزی</span>
          </h3>

          <form onSubmit={handleSubmitTransaction} className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
              
              {/* بخش اول: مشخصات و اطلاعات فاکتور */}
              <div className="bg-slate-50/50 border border-slate-150 p-5 rounded-2xl space-y-4">
                <div className="border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-black text-indigo-700 flex items-center gap-1">
                    <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full inline-block"></span>
                    بخش اول: ثبت و مشخصات عمومی فاکتور
                  </h4>
                </div>

                {editingTxId && (
                  <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded-xl flex justify-between items-center text-[11px]">
                    <span className="font-extrabold">📝 در حال ویرایش فاکتور شناسه: {editingTxId}</span>
                    <button 
                      type="button" 
                      onClick={() => {
                        setEditingTxId(null);
                        setTxAmount("");
                        setTxPerson("");
                        setTxDesc("");
                        setIsNonCash(false);
                        setBarterProperty("");
                        setBarterValue("");
                        setAttachedFileName("");
                        setAttachedFileData("");
                        setTxPaymentStatus("paid");
                        setNewPayments([]);
                        setActiveSubTab("logs");
                      }} 
                      className="text-[10px] bg-amber-200 hover:bg-amber-300 px-2.5 py-1 rounded-lg text-amber-950 font-black cursor-pointer"
                    >
                      انصراف از ویرایش
                    </button>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  {/* Project Selection */}
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-semibold">پروژه ساختمانی مربوطه</label>
                    <SearchableCombobox
                      options={projectOptions}
                      value={txProjId}
                      onChange={val => {
                        setTxProjId(val);
                      }}
                      placeholder="پروژه ساختمانی را انتخاب یا جستجو کنید..."
                      emptyMessage="پروژه‌ای یافت نشد. می‌توانید پروژه جدید ثبت کنید."
                      allowCustom={true}
                      onCustomClick={(term) => {
                        setProjectModalName(term);
                        setProjectModalAddress("");
                        setProjectModalBudget("");
                        setProjectModalArea("");
                        setShowProjectModal(true);
                      }}
                      customAddLabel="تعریف پروژه جدید"
                    />
                  </div>

                  {/* Stage Selection */}
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-semibold">مرحله ساخت (جهت هزینه‌یابی)</label>
                    <SearchableCombobox
                      options={stageOptions}
                      value={txSubCat}
                      onChange={setTxSubCat}
                      placeholder="مرحله ساخت را انتخاب یا جستجو کنید..."
                      emptyMessage="مرحله‌ای یافت نشد. می‌توانید مورد جدید ثبت کنید."
                      allowCustom={true}
                      onCustomClick={(term) => {
                        setStageModalName(term);
                        setShowStageModal(true);
                      }}
                      customAddLabel="افزودن فاز/مرحله ساخت جدید"
                    />
                  </div>

                  {/* Type */}
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-semibold">نوع سند</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        type="button"
                        onClick={() => {
                          setTxType("expense");
                          setTxCat("خرید مصالح");
                          if (!txAccount && accounts.length > 0) setTxAccount(accounts[0].id);
                          if (!payDocAccountId && accounts.length > 0) setPayDocAccountId(accounts[0].id);
                        }}
                        className={`py-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${txType === "expense" ? "bg-rose-500 border-rose-500 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                      >
                        پرداختی (هزینه کارگاه)
                      </button>
                      <button 
                        type="button"
                        onClick={() => {
                          setTxType("income");
                          setTxCat("پیش‌فروش");
                          // Requirement 10: Force explicit selection of receiving account when registering income
                          if (!editingTxId) {
                            setTxAccount("");
                            setPayDocAccountId("");
                          }
                        }}
                        className={`py-2 rounded-xl border text-center font-bold transition-all cursor-pointer ${txType === "income" ? "bg-emerald-500 border-emerald-500 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                      >
                        دریافتی (درآمد/سرمایه)
                      </button>
                    </div>
                  </div>

                  {/* Category */}
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-semibold">دسته‌بندی مالی</label>
                    <SearchableCombobox
                      options={categoryOptions}
                      value={txCat}
                      onChange={setTxCat}
                      placeholder="دسته‌بندی مالی را انتخاب یا جستجو کنید..."
                      emptyMessage="دسته‌بندی یافت نشد."
                      allowCustom={true}
                      customAddLabel="افزودن دسته‌بندی جدید"
                      onCustomAdd={(newValue) => {
                        setTxCat(newValue);
                      }}
                    />
                  </div>

                  {/* Non-cash selector */}
                  <div className="space-y-1.5 col-span-full">
                    <label className="text-slate-500 font-semibold">روش تسویه (نقدی / تهاتر)</label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setIsNonCash(false)}
                        className={`py-2 px-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${!isNonCash ? "bg-indigo-600 border-indigo-600 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                      >
                        نقدی / واریزی چند مرحله‌ای
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsNonCash(true)}
                        className={`py-2 px-3 rounded-xl border text-center font-bold text-xs cursor-pointer transition-all ${isNonCash ? "bg-amber-500 border-amber-500 text-white shadow-xs" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-100"}`}
                      >
                        تهاتر غیرنقدی
                      </button>
                    </div>
                  </div>

                  {isNonCash && (
                    <div className="col-span-full bg-amber-50 border border-amber-150 rounded-xl p-3 text-amber-800 text-[10px] leading-relaxed font-semibold">
                      ⚠️ در وضعیت تهاتر، ثبت نام طرف حساب، مبلغ، فاکتور (شرح سند) و فاز/مرحله ساخت جهت هزینه‌یابی دقیق الزامی است.
                    </div>
                  )}

                  {/* Person Name */}
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-semibold">طرف حساب (شخص/پیمانکار)</label>
                    <SearchableCombobox
                      options={contactOptions}
                      value={txPerson}
                      onChange={setTxPerson}
                      placeholder="نام طرف حساب را انتخاب، جستجو یا تایپ کنید..."
                      emptyMessage="طرف حسابی یافت نشد. می‌توانید مورد جدید ثبت کنید."
                      allowCustom={true}
                      onCustomClick={(term) => {
                        setContactModalName(term);
                        setContactModalPhone("");
                        setContactModalRole("supplier");
                        setContactModalNationalId("");
                        setContactModalCardNumber("");
                        setContactModalBalance("0");
                        setShowContactModal(true);
                      }}
                      customAddLabel="تعریف شخص / طرف حساب جدید"
                    />
                  </div>

                  {/* Date */}
                  <div className="space-y-1.5">
                    <label className="text-slate-500 font-semibold">تاریخ ثبت (هجری شمسی)</label>
                    <ShamsiDatePicker 
                      placeholder="مثال: ۱۴۰۳/۰۴/۰۳"
                      value={txDate}
                      onChange={setTxDate}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                    />
                  </div>

                  {/* Requirement 8 & 10: Main Form Account Selectors (حساب دریافتی شرکت / حساب مبدا طرف حساب) */}
                  {!isNonCash && (
                    <div className="col-span-full grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 bg-white border border-indigo-100 rounded-xl shadow-2xs">
                      <div className="space-y-1.5">
                        <div className="flex justify-between items-center">
                          <label className="text-slate-700 font-bold text-[11px]">
                            {txType === "income" ? (
                              <>حساب دریافتی (حساب شرکت) <span className="text-rose-500 font-black">* (اجباری)</span></>
                            ) : (
                              "منبع مالی (حساب مبدا شرکت)"
                            )}
                          </label>
                          <button
                            type="button"
                            onClick={() => {
                              setAccountModalName("");
                              setAccountModalBankName("");
                              setAccountModalNumber("");
                              setAccountModalBalance("0");
                              setShowAccountModal(true);
                            }}
                            className="text-[10px] text-indigo-600 hover:text-indigo-800 font-bold cursor-pointer"
                          >
                            + تعریف حساب جدید
                          </button>
                        </div>
                        <select
                          value={txAccount}
                          onChange={e => {
                            setTxAccount(e.target.value);
                            if (!payDocAccountId) setPayDocAccountId(e.target.value);
                          }}
                          className={`w-full px-3 py-2 bg-slate-50 border rounded-xl outline-none text-xs font-medium ${
                            txType === "income" && !txAccount ? "border-amber-400 bg-amber-50/40 text-amber-900" : "border-slate-200 focus:border-indigo-500"
                          }`}
                        >
                          {txType === "income" && (
                            <option value="">-- انتخاب بانک یا صندوق دریافتی شرکت (اجباری) --</option>
                          )}
                          {accounts.map(acc => (
                            <option key={acc.id} value={acc.id}>
                              {acc.name} ({acc.typeName} - موجودی: {formatTomans(acc.balance)})
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-slate-700 font-bold text-[11px] block">
                          {txType === "income"
                            ? "حساب مبدا (حساب طرف حسابی که واریزی انجام داده)"
                            : "حساب مقصد (حساب طرف حساب دریافت‌کننده)"}
                        </label>
                        <input
                          type="text"
                          value={txCounterpartyAccount}
                          onChange={e => {
                            setTxCounterpartyAccount(e.target.value);
                            if (!payDocDestAcc) setPayDocDestAcc(e.target.value);
                          }}
                          placeholder={
                            txType === "income"
                              ? "شماره کارت/حساب یا نام بانک طرف حساب واریزکننده..."
                              : "شماره کارت/شبا یا حساب مقصد طرف حساب..."
                          }
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 text-xs font-mono"
                        />
                      </div>
                    </div>
                  )}

                  {/* Amount */}
                  <div className="space-y-1.5 col-span-full">
                    <label className="text-slate-500 font-semibold">مبلغ سند فاکتور (ریال)</label>
                    <FormattedAmountInput 
                      placeholder="مثال: ۵,۰۰۰,۰۰۰"
                      value={txAmount}
                      onChange={setTxAmount}
                      className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono font-bold"
                    />
                    {txAmount && Number(txAmount) > 0 && (
                      <div className={`text-[10px] font-bold mt-1 px-2.5 py-1 rounded-lg block leading-relaxed ${txType === "income" ? "text-emerald-700 bg-emerald-50/70 border border-emerald-150" : "text-rose-700 bg-rose-50/70 border border-rose-150"}`}>
                        <div className="font-light"><span className="font-extrabold text-[11px]">به حروف:</span> {numberToPersianWords(Number(txAmount))} ریال</div>
                        <div><span className="font-extrabold">عدد:</span> {Number(txAmount).toLocaleString("fa-IR")} ریال</div>
                      </div>
                    )}
                  </div>

                  {/* Barter details if active */}
                  {isNonCash && (
                    <div className="col-span-full">
                      {isBarterContact ? (
                        <div className="bg-amber-50/70 border border-amber-200 rounded-2xl p-3.5 space-y-3">
                          <div className="flex justify-between items-center border-b border-amber-200 pb-1.5">
                            <span className="font-extrabold text-[11px] text-amber-950">
                              🏢 اطلاعات قرارداد تهاتری طرف حساب: <span className="text-indigo-700">«{selectedContact?.name}»</span>
                            </span>
                          </div>
                          <div className="grid grid-cols-1 gap-2 pt-1 border-t border-amber-150 text-[10px]">
                            <div className="bg-amber-100/40 p-2 rounded-xl text-center flex justify-between">
                              <span className="text-amber-700 font-bold">کل اعتبار تهاتر</span>
                              <strong className="text-amber-900 font-mono">{totalBarterVal.toLocaleString("fa-IR")} ریال</strong>
                            </div>
                            <div className="bg-emerald-50 p-2 rounded-xl text-center border border-emerald-100 flex justify-between">
                              <span className="text-emerald-700 font-bold">مانده اعتبار تهاتر</span>
                              <strong className="text-emerald-900 font-mono">{remainingBarterVal.toLocaleString("fa-IR")} ریال</strong>
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 gap-3 bg-amber-50/50 p-3 rounded-xl border border-amber-100 text-[11px]">
                          <div className="space-y-1.5">
                            <label className="text-amber-800 font-bold">مشخصات ملک/خودرو تهاتری</label>
                            <input 
                              type="text" 
                              placeholder="مثال: واگذاری یک واحد زمین مسکونی پلاک ۴"
                              value={barterProperty}
                              onChange={e => setBarterProperty(e.target.value)}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-amber-800 font-bold">ارزش توافقی تهاتر (ریال)</label>
                            <FormattedAmountInput 
                              value={barterValue}
                              onChange={setBarterValue}
                              className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-xl outline-none"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {!isNonCash && txType === "expense" && (
                    <div className="space-y-1.5 col-span-full">
                      <label className="text-slate-500 font-semibold">وضعیت اولیه پرداخت فاکتور</label>
                      <select
                        value={txPaymentStatus}
                        onChange={e => setTxPaymentStatus(e.target.value as any)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500"
                      >
                        <option value="paid">تسویه کامل نقدی (پرداخت شده - نیازمند رویت و تأیید نهایی مدیریت)</option>
                        <option value="unpaid">پرداخت‌نشده / نسیه (منتظر تأیید مدیریت جهت پرداخت و ثبت در معین شخص)</option>
                      </select>
                      <p className="text-[10px] text-amber-700 font-bold bg-amber-50 border border-amber-150 px-2.5 py-1.5 rounded-lg">
                        💡 توجه: کلیه فاکتورهای هزینه‌ای (حتی در صورت پرداخت همزمان و ثبت فیش) ابتدا در وضعیت «در انتظار تأیید مدیریت» قرار می‌گیرند تا مدیر رویت و تأیید نماید.
                      </p>
                    </div>
                  )}

                  {/* Electronic Filing System File Attachment */}
                  <div className="col-span-full space-y-1.5">
                    <label className="text-slate-500 font-semibold flex items-center gap-1.5">
                      <Paperclip className="w-4 h-4 text-indigo-500" />
                      پیوست فیزیکی فاکتور خرید / برگه خرید (بایگانی الکترونیک)
                    </label>
                    <div className="border-2 border-dashed border-slate-200 rounded-2xl p-4 hover:border-indigo-500 hover:bg-slate-100/40 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer"
                         onClick={() => fileInputRef.current?.click()}
                    >
                      <input 
                        type="file" 
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept="image/*,application/pdf"
                        className="hidden" 
                      />
                      <Paperclip className="w-6 h-6 text-slate-400" />
                      <p className="text-[10px] font-semibold text-slate-700">کلیک جهت آپلود تصویر فاکتور فیزیکی</p>
                      {attachedFileName && (
                        <span className="inline-block mt-1 px-3 py-0.5 bg-indigo-50 text-indigo-700 rounded-full font-mono font-bold text-[10px] border border-indigo-100">
                          📎 {attachedFileName}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Invoice Number & Description */}
                  <div className="col-span-full grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-slate-500 font-semibold">شماره فاکتور</label>
                      <input
                        type="text"
                        placeholder="مثال: ۱۴۰۳/۱۰۲"
                        value={txInvoiceNum}
                        onChange={e => setTxInvoiceNum(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono font-bold"
                      />
                    </div>
                    <div className="sm:col-span-2 space-y-1.5">
                      <label className="text-slate-500 font-semibold">شرح فاکتور / توضیحات آرتیکل سند</label>
                      <textarea 
                        placeholder="شرح فاکتور یا خرید مصالح..."
                        value={txDesc}
                        onChange={e => setTxDesc(e.target.value)}
                        className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none focus:border-indigo-500 h-16 resize-none"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* بخش دوم: اسناد پرداخت و فیش‌های واریزی چندمرحله‌ای */}
              <div className="bg-slate-50/50 border border-slate-150 p-5 rounded-2xl space-y-5">
                <div className="border-b border-slate-200 pb-2">
                  <h4 className="text-xs font-black text-indigo-700 flex items-center gap-1">
                    <span className="w-1.5 h-3.5 bg-indigo-600 rounded-full inline-block"></span>
                    بخش دوم: اسناد پرداخت و فیش‌های واریزی چند مرحله‌ای
                  </h4>
                </div>

                {/* Progress of Settlement */}
                {(() => {
                  const totalPaidAmount = newPayments.reduce((sum, p) => sum + Number(p.amount), 0);
                  const totalInvoiceAmount = Number(txAmount) || 0;
                  const settlementPct = totalInvoiceAmount > 0 ? Math.min(100, Math.round((totalPaidAmount / totalInvoiceAmount) * 100)) : 0;
                  return (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-2 shadow-xs">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-bold text-slate-700">درصد تسویه فاکتور:</span>
                        <span className="font-black text-indigo-600 font-mono text-[13px]">
                          {toFarsiDigits(settlementPct)}% تسویه شده
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div 
                          className={`h-full rounded-full transition-all duration-500 ${settlementPct === 100 ? "bg-emerald-500" : settlementPct > 0 ? "bg-indigo-600" : "bg-slate-200"}`} 
                          style={{ width: `${settlementPct}%` }}
                        />
                      </div>
                      <div className="flex flex-col gap-1 text-[10px] text-slate-500 font-medium pt-1">
                        <div className="flex justify-between">
                          <span>کل مبلغ فاکتور:</span>
                          <strong className="font-mono text-slate-800">{toFarsiDigits(totalInvoiceAmount.toLocaleString())} ریال</strong>
                        </div>
                        <div className="flex justify-between">
                          <span>کل اسناد پرداخت ضمیمه شده:</span>
                          <strong className="font-mono text-indigo-600">{toFarsiDigits(totalPaidAmount.toLocaleString())} ریال</strong>
                        </div>
                        <div className="flex justify-between border-t border-dashed border-slate-100 pt-1 mt-1 font-bold">
                          <span>مانده نسیه فاکتور:</span>
                          <strong className="font-mono text-rose-600">{toFarsiDigits(Math.max(0, totalInvoiceAmount - totalPaidAmount).toLocaleString())} ریال</strong>
                        </div>
                      </div>
                    </div>
                  );
                })()}

                {/* Payment Slips Controller */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <h5 className="text-[11px] font-black text-slate-700 flex items-center gap-1">
                      <CreditCard className="w-3.5 h-3.5 text-indigo-600" />
                      اسناد بانکی و فیش‌های واریزی ({toFarsiDigits(newPayments.length)} مورد)
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        const totalPaidAmount = newPayments.reduce((sum, p) => sum + Number(p.amount), 0);
                        const totalInvoiceAmount = Number(txAmount) || 0;
                        const remaining = totalInvoiceAmount - totalPaidAmount;
                        
                        setIsAddingPaymentDoc(!isAddingPaymentDoc);
                        setPayDocAmount(String(remaining > 0 ? remaining : ""));
                        setPayDocAccountId(txAccount || (txType === "expense" ? (accounts[0]?.id || "") : ""));
                        setPayDocRefNum("");
                        setPayDocInvoiceNum(txInvoiceNum || "");
                        setPayDocDestAcc(txCounterpartyAccount || "");
                        setPayDocReceiptName("");
                        setPayDocReceiptData("");
                        setPayDocDesc(txDesc || "");
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[9px] font-bold transition-all cursor-pointer shadow-sm flex items-center gap-0.5"
                    >
                      {isAddingPaymentDoc ? "بستن فرم" : "➕ ثبت فیش واریزی جدید"}
                    </button>
                  </div>

                  {isAddingPaymentDoc && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3.5 text-xs shadow-md">
                      <div className="border-b border-slate-100 pb-1.5 mb-1 flex items-center justify-between">
                        <span className="font-extrabold text-[10px] text-indigo-900">
                          {txType === "income" ? "فرم ثبت فیش دریافتی (واریز به حساب شرکت)" : "فرم افزودن فیش واریزی یا سند پرداخت بانکی"}
                        </span>
                        <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded-md font-mono font-bold text-[10px]">
                          ردیف فیش: {toFarsiDigits(newPayments.length + 1)}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="space-y-1">
                          <label className="text-slate-500 font-bold">ردیف فیش</label>
                          <input
                            type="text"
                            readOnly
                            value={`ردیف ${toFarsiDigits(newPayments.length + 1)}`}
                            className="w-full px-2.5 py-1.5 bg-slate-100 border border-slate-200 rounded-xl outline-none font-mono font-bold text-center text-slate-600"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 font-bold">شماره فاکتور</label>
                          <input
                            type="text"
                            value={payDocInvoiceNum}
                            onChange={e => setPayDocInvoiceNum(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono font-bold"
                            placeholder="شماره فاکتور مربوطه"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 font-bold">مبلغ فیش (ریال) <span className="text-rose-500">*</span></label>
                          <FormattedAmountInput
                            value={payDocAmount}
                            onChange={setPayDocAmount}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-500 font-mono font-bold"
                            placeholder="مثال: ۵,۰۰۰,۰۰۰"
                          />
                        </div>

                        <div className="space-y-1 col-span-full">
                          <label className="text-slate-500 font-bold">شرح فاکتور / بابت</label>
                          <input
                            type="text"
                            value={payDocDesc}
                            onChange={e => setPayDocDesc(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                            placeholder="مثال: بابت فاکتور خرید سیمان و مصالح مرحله اول"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 font-bold">شماره پیگیری / ارجاع سند</label>
                          <input
                            type="text"
                            value={payDocRefNum}
                            onChange={e => setPayDocRefNum(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono"
                            placeholder="کد پیگیری تراکنش"
                          />
                        </div>

                        {/* Requirement 8 & 10: In slip form, when income, label is حساب دریافتی (حساب شرکت) * */}
                        <div className="space-y-1 sm:col-span-2">
                          <label className="text-slate-700 font-bold">
                            {txType === "income" ? (
                              <>حساب دریافتی (حساب شرکت) <span className="text-rose-500 font-black">* (انتخاب اجباری)</span></>
                            ) : (
                              "منبع مالی (حساب مبدا)"
                            )}
                          </label>
                          <select
                            value={payDocAccountId}
                            onChange={e => {
                              setPayDocAccountId(e.target.value);
                              if (!txAccount) setTxAccount(e.target.value);
                            }}
                            className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-xl outline-none ${
                              txType === "income" && !payDocAccountId ? "border-amber-400 bg-amber-50/40" : "border-slate-200"
                            }`}
                          >
                            {txType === "income" && (
                              <option value="">-- انتخاب بانک یا صندوق دریافتی شرکت (اجباری) --</option>
                            )}
                            {accounts.map(acc => (
                              <option key={acc.id} value={acc.id}>{acc.name} ({acc.bankName || acc.typeName || "صندوق"})</option>
                            ))}
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 font-bold">روش تسویه</label>
                          <select
                            value={payDocMethod}
                            onChange={e => setPayDocMethod(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-sans font-medium"
                          >
                            <option value="فیش بانکی">فیش بانکی / رسید انتقال وجه</option>
                            <option value="کارت به کارت">کارت به کارت</option>
                            <option value="حواله پایا">حواله پایا / ساتنا</option>
                            <option value="چک">چک صیادی بانکی</option>
                            <option value="اینترنتی">درگاه پرداخت آنلاین</option>
                            <option value="تهاتر">اعتبار تهاتری</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 font-bold">وضعیت فیش</label>
                          <select
                            value={payDocStatus}
                            onChange={e => setPayDocStatus(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                          >
                            <option value="تایید نهایی">تایید نهایی و واریز شده</option>
                            <option value="در جریان تایید">در جریان تایید (وصول‌نشده)</option>
                            <option value="ناموفق">تراکنش ناموفق / برگشتی</option>
                          </select>
                        </div>

                        <div className="space-y-1">
                          <label className="text-slate-500 font-bold">تاریخ سند پرداخت</label>
                          <ShamsiDatePicker
                            value={payDocDate}
                            onChange={setPayDocDate}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                          />
                        </div>

                        {/* Requirement 8: Counterparty account label changes to حساب مبدا (حساب طرف حسابی که واریزی انجام داده) for income */}
                        <div className="space-y-1 col-span-full">
                          <label className="text-slate-700 font-bold">
                            {txType === "income"
                              ? "حساب مبدا (حساب طرف حسابی که واریزی انجام داده)"
                              : "حساب مقصد (طرف حساب)"}
                          </label>
                          <input
                            type="text"
                            value={payDocDestAcc}
                            onChange={e => setPayDocDestAcc(e.target.value)}
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono"
                            placeholder={
                              txType === "income"
                                ? "شماره حساب / کارت یا نام بانک طرف حسابی که واریزی انجام داده"
                                : "شماره حساب مقصد واریز (طرف حساب)"
                            }
                          />
                        </div>

                        {/* Physical Receipt Slip upload */}
                        <div className="col-span-full space-y-1.5">
                          <label className="text-slate-500 font-bold flex items-center gap-1.5">
                            <Paperclip className="w-3.5 h-3.5 text-indigo-500" />
                            پیوست فیزیکی فیش واریزی / رسید بانک (تصویر فیش)
                          </label>
                          <div 
                            className="border-2 border-dashed border-slate-200 rounded-xl p-3 bg-slate-50 hover:bg-slate-100/40 hover:border-indigo-500 transition-all flex flex-col items-center justify-center gap-1 cursor-pointer"
                            onClick={() => payDocFileInputRef.current?.click()}
                          >
                            <input
                              type="file"
                              ref={payDocFileInputRef}
                              onChange={handlePayDocFileChange}
                              accept="image/*,application/pdf"
                              className="hidden"
                            />
                            <Paperclip className="w-5 h-5 text-slate-400" />
                            <span className="text-[9px] font-semibold text-slate-600">بارگذاری تصویر فیش رسید واریزی</span>
                            {payDocReceiptName && (
                              <span className="mt-1 px-2.5 py-0.5 bg-emerald-50 text-emerald-700 rounded-full font-mono text-[9px] border border-emerald-100 font-bold">
                                📎 {payDocReceiptName}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex justify-end gap-1.5 pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            if (!payDocAmount || Number(payDocAmount) <= 0) {
                              setFormError("لطفاً مبلغ فیش را وارد نمایید.");
                              return;
                            }
                            if (txType === "income" && !payDocAccountId) {
                              setFormError("لطفاً «حساب دریافتی (حساب شرکت)» را برای ثبت فیش دریافتی انتخاب نمایید.");
                              return;
                            }
                            const resolvedSlipAcc = payDocAccountId || (txType === "expense" ? (accounts[0]?.id || "a1") : "");
                            if (txType === "income" && !txAccount && resolvedSlipAcc) {
                              setTxAccount(resolvedSlipAcc);
                            }
                            const newSlip = {
                              id: "p_" + Date.now(),
                              amount: Number(payDocAmount),
                              date: payDocDate,
                              accountId: resolvedSlipAcc,
                              referenceNumber: payDocRefNum || "بدون شماره",
                              invoiceNumber: payDocInvoiceNum || txInvoiceNum || "",
                              invoiceDescription: payDocDesc || txDesc || "",
                              settlementMethod: payDocMethod,
                              paymentStatus: payDocStatus,
                              sourceAccount: txType === "income" ? payDocDestAcc : undefined,
                              destinationAccount: payDocDestAcc,
                              receiptFileName: payDocReceiptName,
                              receiptFileData: payDocReceiptData,
                              description: payDocDesc || txDesc || ""
                            };
                            setNewPayments([...newPayments, newSlip]);
                            setFormError(null);
                            
                            // Clear slip states
                            setPayDocAmount("");
                            setPayDocRefNum("");
                            setPayDocInvoiceNum("");
                            setPayDocDestAcc("");
                            setPayDocReceiptName("");
                            setPayDocReceiptData("");
                            setPayDocDesc("");
                            setIsAddingPaymentDoc(false);
                          }}
                          className="px-3.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-[10px] transition-all cursor-pointer shadow-sm"
                        >
                          ✓ ثبت ردیف فیش در لیست
                        </button>
                        <button
                          type="button"
                          onClick={() => setIsAddingPaymentDoc(false)}
                          className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-[10px] transition-all cursor-pointer"
                        >
                          انصراف
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Payments Table List */}
                {newPayments.length === 0 ? (
                  <div className="bg-white border border-slate-150 rounded-2xl p-6 text-center text-slate-400 text-[10px] italic font-light shadow-xs">
                    هیچ فیش یا سند پرداختی جداگانه‌ای وارد نشده است (در صورت انتخاب «تسویه کامل نقدی»، سند پرداخت به صورت خودکار صادر می‌شود).
                  </div>
                ) : (
                  <div className="bg-white border border-slate-150 rounded-2xl overflow-hidden shadow-xs">
                    <table className="w-full text-right border-collapse text-[10px] text-slate-600 font-sans">
                      <thead>
                        <tr className="bg-slate-50/50 border-b border-slate-100 text-slate-500 font-extrabold">
                          <th className="p-2.5 text-center">ردیف</th>
                          <th className="p-2.5 text-center">شماره فاکتور</th>
                          <th className="p-2.5">شرح فاکتور</th>
                          <th className="p-2.5">مبلغ (ریال)</th>
                          <th className="p-2.5">کد پیگیری</th>
                          <th className="p-2.5">{txType === "income" ? "حساب دریافتی (حساب شرکت)" : "منبع مالی (حساب مبدا)"}</th>
                          <th className="p-2.5">{txType === "income" ? "حساب مبدا (طرف حساب)" : "حساب مقصد"}</th>
                          <th className="p-2.5">روش تسویه</th>
                          <th className="p-2.5">وضعیت</th>
                          <th className="p-2.5 text-center">پیوست فیش</th>
                          <th className="p-2.5 text-center">حذف</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {newPayments.map((p, idx) => {
                          const payAcc = accounts.find(a => a.id === p.accountId);
                          return (
                            <tr key={p.id} className="hover:bg-slate-50/50 transition-colors font-medium">
                              <td className="p-2.5 font-mono font-bold text-center text-slate-500">{toFarsiDigits(idx + 1)}</td>
                              <td className="p-2.5 font-mono font-bold text-center text-indigo-700">{toFarsiDigits(p.invoiceNumber || txInvoiceNum || "-")}</td>
                              <td className="p-2.5 max-w-[140px] truncate" title={p.invoiceDescription || p.description || txDesc}>{p.invoiceDescription || p.description || txDesc || "-"}</td>
                              <td className="p-2.5 font-bold text-slate-800 font-mono text-left">{toFarsiDigits(p.amount.toLocaleString())}</td>
                              <td className="p-2.5 font-mono text-center">{toFarsiDigits(p.referenceNumber || "-")}</td>
                              <td className="p-2.5 font-sans font-bold text-indigo-700">{payAcc?.name || "صندوق"}</td>
                              <td className="p-2.5 font-mono">{toFarsiDigits(p.sourceAccount || p.destinationAccount || "-")}</td>
                              <td className="p-2.5 text-center">{p.settlementMethod}</td>
                              <td className="p-2.5 text-center">
                                <span className={`px-1.5 py-0.5 rounded text-[8px] font-black ${
                                  p.paymentStatus === "تایید نهایی" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-amber-50 text-amber-700 border border-amber-100"
                                }`}>
                                  {p.paymentStatus}
                                </span>
                              </td>
                              <td className="p-2.5 text-center">
                                {p.receiptFileName ? (
                                  <button
                                    type="button"
                                    onClick={() => setViewingAttachment({ name: p.receiptFileName || "", data: p.receiptFileData || "", personName: "", date: p.date, amount: p.amount, attachmentName: p.receiptFileName || "" } as any)}
                                    className="px-1.5 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-100 rounded text-[9px] font-bold cursor-pointer"
                                  >
                                    مشاهده فیش
                                  </button>
                                ) : (
                                  <span className="text-slate-400 font-light">-</span>
                                )}
                              </td>
                              <td className="p-2.5 text-center">
                                <button
                                  type="button"
                                  onClick={() => setNewPayments(newPayments.filter((_, i) => i !== idx))}
                                  className="p-1 text-rose-500 hover:text-rose-700 rounded cursor-pointer mx-auto block"
                                >
                                  حذف
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-bold flex items-center gap-2">
                <span>⚠️ {formError}</span>
              </div>
            )}

            {/* Submit and actions */}
            <div className="flex justify-end gap-2.5 pt-4 border-t border-slate-150">
              <button
                type="submit"
                className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-all shadow-md cursor-pointer hover:shadow-lg"
              >
                {editingTxId ? "✓ بروزرسانی فاکتور و اسناد مالی" : "✓ ثبت نهایی فاکتور و اسناد مالی"}
              </button>
              {editingTxId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingTxId(null);
                    setTxCat("خرید مصالح");
                    setTxSubCat("");
                    setTxAmount("");
                    setTxProjId("");
                    setTxAccount("");
                    setTxCounterpartyAccount("");
                    setTxDate(getTodayShamsiString());
                    setTxPerson("");
                    setTxDesc("");
                    setAttachedFileName("");
                    setAttachedFileData("");
                    setNewPayments([]);
                    setActiveSubTab("logs");
                  }}
                  className="px-6 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl font-bold text-xs transition-all cursor-pointer"
                >
                  انصراف از ویرایش
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {/* Tab 4: Factor Approvals panel */}
      {activeSubTab === "approvals" && (() => {
        const allExpenseTx = transactions.filter(t => t.type === "expense");
        const filteredApprovalTx = allExpenseTx.filter(t => {
          const isPending = !t.approvalStatus || t.approvalStatus === "pending";
          const isApproved = t.approvalStatus === "approved";
          const isRejected = t.approvalStatus === "rejected";
          const totalPaidOnTx = t.payments ? t.payments.reduce((s, p) => s + p.amount, 0) : 0;
          const isPaidOrHasSlips = t.paymentStatus === "paid" || totalPaidOnTx > 0;

          if (approvalTabFilter === "pending_all" && !isPending) return false;
          if (approvalTabFilter === "pending_unpaid" && (!isPending || isPaidOrHasSlips)) return false;
          if (approvalTabFilter === "pending_paid" && (!isPending || !isPaidOrHasSlips)) return false;
          if (approvalTabFilter === "approved" && !isApproved) return false;
          if (approvalTabFilter === "rejected" && !isRejected) return false;

          if (approvalProjectFilter !== "all" && t.projectId !== approvalProjectFilter) return false;

          if (approvalSearchQuery.trim()) {
            const q = approvalSearchQuery.toLowerCase();
            const matchPerson = (t.personName || "").toLowerCase().includes(q);
            const matchDesc = (t.description || "").toLowerCase().includes(q);
            const matchCat = (t.category || "").toLowerCase().includes(q);
            const matchInv = (t.invoiceNumber || "").toLowerCase().includes(q);
            if (!matchPerson && !matchDesc && !matchCat && !matchInv) return false;
          }
          return true;
        });

        const handlePrintApprovals = (useFiltered: boolean) => {
          const list = useFiltered ? filteredApprovalTx : allExpenseTx;
          const sumAmt = list.reduce((s, t) => s + t.amount, 0);
          printStructuredReport({
            title: "گزارش بررسی و تأیید فاکتورهای هزینه‌ای توسط مدیریت",
            subtitle: useFiltered ? "گزارش فاکتورهای فیلتر شده (بعد از فیلتر)" : "گزارش کل فاکتورهای هزینه‌ای (قبل از فیلتر)",
            filterSummary: useFiltered
              ? `تعداد فاکتور فیلتر شده: ${toFarsiDigits(list.length)} از ${toFarsiDigits(allExpenseTx.length)}`
              : `کل فاکتورهای هزینه‌ای (${toFarsiDigits(allExpenseTx.length)} فاکتور)`,
            columns: [
              { header: "ردیف", key: "idx" },
              { header: "شماره فاکتور", key: "inv" },
              { header: "تاریخ", key: "date" },
              { header: "پروژه", key: "proj" },
              { header: "طرف حساب", key: "person" },
              { header: "دسته‌بندی / شرح", key: "desc" },
              { header: "مبلغ فاکتور (ریال)", key: "amount" },
              { header: "وضعیت تسویه", key: "payStatus" },
              { header: "وضعیت تأیید مدیریت", key: "appStatus" }
            ],
            rows: list.map((t, i) => {
              const proj = projects.find(p => p.id === t.projectId);
              const totalPaidOnTx = t.payments ? t.payments.reduce((s, p) => s + p.amount, 0) : 0;
              const isPaidOrHasSlips = t.paymentStatus === "paid" || totalPaidOnTx > 0;
              const appSt = t.approvalStatus === "approved"
                ? `تأیید شده ✓ (${t.approvedBy || "مدیر"})`
                : t.approvalStatus === "rejected"
                ? "رد شده ❌"
                : isPaidOrHasSlips
                ? "تأیید نشده ⏳ (پرداخت شده - منتظر رویت و تأیید سند توسط مدیر)"
                : "تأیید نشده ⏳ (منتظر تأیید جهت پرداخت)";
              return {
                idx: toFarsiDigits(i + 1),
                inv: toFarsiDigits(t.invoiceNumber || "—"),
                date: toFarsiDigits(t.date),
                proj: proj?.name || "—",
                person: t.personName,
                desc: `${t.category}${t.subCategory ? ` (${t.subCategory})` : ""} - ${t.description}`,
                amount: formatTomans(t.amount),
                payStatus: isPaidOrHasSlips ? "فیش ثبت شده / پرداخت شده" : "پرداخت نشده (نسیه)",
                appStatus: appSt
              };
            }),
            summaryItems: [
              { label: "تعداد فاکتورها", value: `${toFarsiDigits(list.length)} فقره` },
              { label: "جمع مبالغ فاکتورها", value: formatTomans(sumAmt) }
            ]
          });
        };

        return (
          <div className="space-y-6">
            <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm space-y-4">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-3">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">بررسی و تأیید هزینه‌ها و فاکتورها توسط مدیریت ارشد</h3>
                  <p className="text-[11px] text-slate-400 font-light mt-0.5">
                    کلیه فاکتورهای هزینه‌ای (چه نسیه جهت دستور پرداخت و چه فاکتورهایی که همزمان پرداخت شده و فیش دارند) در وضعیت «تأیید نشده» قرار می‌گیرند تا مدیر سند و فاکتور را رویت و تأیید نماید.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center text-xs">
                  <button
                    type="button"
                    onClick={() => handlePrintApprovals(true)}
                    className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl font-bold flex items-center gap-1 border border-emerald-200 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    چاپ بعد از فیلتر ({toFarsiDigits(filteredApprovalTx.length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintApprovals(false)}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold flex items-center gap-1 border border-slate-200 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    چاپ کل (قبل از فیلتر)
                  </button>
                </div>
              </div>

              {/* Filter & Search Bar for Approvals */}
              <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-3 pt-2 border-t border-slate-100 text-xs">
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => setApprovalTabFilter("pending_all")}
                    className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      approvalTabFilter === "pending_all" ? "bg-amber-500 border-amber-500 text-white" : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    ⏳ همه تأیید نشده‌ها ({toFarsiDigits(allExpenseTx.filter(t => !t.approvalStatus || t.approvalStatus === "pending").length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalTabFilter("pending_unpaid")}
                    className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      approvalTabFilter === "pending_unpaid" ? "bg-rose-600 border-rose-600 text-white" : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    تأیید نشده جهت پرداخت
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalTabFilter("pending_paid")}
                    className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      approvalTabFilter === "pending_paid" ? "bg-indigo-600 border-indigo-600 text-white" : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    پرداخت شده منتظر رویت و تأیید مدیر
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalTabFilter("approved")}
                    className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      approvalTabFilter === "approved" ? "bg-emerald-600 border-emerald-600 text-white" : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    ✓ تأیید شده‌ها ({toFarsiDigits(allExpenseTx.filter(t => t.approvalStatus === "approved").length)})
                  </button>
                  <button
                    type="button"
                    onClick={() => setApprovalTabFilter("all")}
                    className={`px-3 py-1.5 rounded-xl font-bold border transition-all cursor-pointer ${
                      approvalTabFilter === "all" ? "bg-slate-800 border-slate-800 text-white" : "bg-slate-50 border-slate-200 text-slate-600"
                    }`}
                  >
                    همه فاکتورهای هزینه ({toFarsiDigits(allExpenseTx.length)})
                  </button>
                </div>

                <div className="flex flex-wrap gap-2 items-center">
                  <select
                    value={approvalProjectFilter}
                    onChange={e => setApprovalProjectFilter(e.target.value)}
                    className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none"
                  >
                    <option value="all">همه پروژه‌ها</option>
                    {projects.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                  <div className="relative flex items-center">
                    <input
                      type="text"
                      placeholder="جستجوی طرف حساب، شرح، شماره فاکتور..."
                      value={approvalSearchQuery}
                      onChange={e => setApprovalSearchQuery(e.target.value)}
                      className="px-3 py-1.5 pr-8 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-indigo-500"
                    />
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute right-2.5" />
                  </div>
                </div>
              </div>

              {activeUser && activeUser.role !== "manager" && activeUser.username?.toLowerCase() !== "admin" && (
                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl text-[10px] font-bold">
                  ⚠️ هشدار دسترسی: شما با نقش <span className="text-rose-600">({activeUser.roleName})</span> وارد شده‌اید. امکان مشاهده وضعیت فاکتورها وجود دارد اما حق ویرایش و ثبت تأییدیه/رد فاکتورها صرفاً مخصوص مدیریت ارشد پروژه است.
                </div>
              )}
            </div>

            <div className="space-y-3">
              {filteredApprovalTx.length === 0 ? (
                <div className="p-12 bg-white rounded-3xl border border-dashed border-slate-200 text-center text-slate-400 font-light text-xs">
                  هیچ فاکتور هزینه‌ای متناسب با فیلتر انتخابی یافت نشد.
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredApprovalTx.map(t => {
                    const project = projects.find(p => p.id === t.projectId);
                    const isPending = !t.approvalStatus || t.approvalStatus === "pending";
                    const isApproved = t.approvalStatus === "approved";
                    const isRejected = t.approvalStatus === "rejected";
                    const inputVal = customApprovalAmounts[t.id] || "";
                    const totalPaidOnTx = t.payments ? t.payments.reduce((s, p) => s + p.amount, 0) : 0;
                    const isPaidOrHasSlips = t.paymentStatus === "paid" || totalPaidOnTx > 0;

                    return (
                      <div key={t.id} className="bg-white rounded-2xl border border-slate-150 p-5 shadow-xs hover:shadow-md transition-all space-y-4 animate-fade-in">
                        {/* Card Header */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-100 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`w-2.5 h-2.5 rounded-full ${
                              isApproved ? "bg-emerald-500 animate-pulse" : isRejected ? "bg-rose-500" : "bg-amber-500 animate-pulse"
                            }`} />
                            <div>
                              <span className="text-xs font-extrabold text-slate-800 block">
                                فاکتور هزینه‌ای: {t.category} {t.subCategory ? `(${t.subCategory})` : ""} {t.invoiceNumber ? `| شماره فاکتور: ${toFarsiDigits(t.invoiceNumber)}` : ""}
                              </span>
                              <span className="text-[10px] text-slate-400 font-light block mt-0.5">پروژه: {project?.name || "نامشخص"} | تاریخ: {toFarsiDigits(t.date)} | ثبت‌کننده: {t.createdBy || "ناظر فنی"}</span>
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-1.5 items-center">
                            {isPaidOrHasSlips ? (
                              <span className="bg-indigo-50 border border-indigo-200 text-indigo-700 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                                💳 فیش پرداخت ثبت شده ({formatTomans(totalPaidOnTx || t.amount)})
                              </span>
                            ) : (
                              <span className="bg-rose-50 border border-rose-200 text-rose-700 text-[10px] font-bold px-2.5 py-1 rounded-xl">
                                🕒 پرداخت نشده (در انتظار دستور پرداخت)
                              </span>
                            )}
                            {isApproved && (
                              <div className="bg-emerald-50 border border-emerald-150 text-emerald-700 text-[10px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
                                <span>✓ رویت و تأیید شده توسط مدیریت</span>
                                {t.approvedAmount !== undefined && t.approvedAmount !== t.amount && (
                                  <span className="bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[8px]">تأیید جزئی</span>
                                )}
                              </div>
                            )}
                            {isRejected && (
                              <div className="bg-rose-50 border border-rose-150 text-rose-700 text-[10px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
                                <span>❌ رد شده توسط مدیریت</span>
                              </div>
                            )}
                            {isPending && (
                              <div className="bg-amber-50 border border-amber-200 text-amber-800 text-[10px] font-extrabold px-3 py-1.5 rounded-xl flex items-center gap-1.5 shadow-3xs">
                                <span>
                                  {isPaidOrHasSlips
                                    ? "⏳ تأیید نشده (منتظر رویت سند و فاکتور توسط مدیر)"
                                    : "⏳ تأیید نشده (منتظر تأیید مدیریت جهت پرداخت)"}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Card details */}
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                            <span className="text-[10px] text-slate-400 block font-bold">مبلغ اصلی فاکتور:</span>
                            <span className="text-sm font-extrabold text-slate-800 font-mono block mt-1">{formatTomans(t.amount)}</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                            <span className="text-[10px] text-slate-400 block font-bold">طرف حساب (ذی‌نفع):</span>
                            <span className="text-xs font-extrabold text-slate-800 block mt-1.5">{t.personName || "فاقد طرف حساب"}</span>
                          </div>
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150">
                            <span className="text-[10px] text-slate-400 block font-bold">مبلغ مصوب تأیید شده:</span>
                            <span className="text-sm font-extrabold text-indigo-700 font-mono block mt-1">
                              {isApproved ? formatTomans(t.approvedAmount ?? t.amount) : "هنوز توسط مدیر تأیید نشده"}
                            </span>
                          </div>
                        </div>

                        {/* Description & Attached Documents for Manager Inspection */}
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 bg-slate-50/50 p-2.5 rounded-xl border border-slate-150 text-[10px]">
                          <p className="text-slate-600 leading-relaxed font-light">
                            <span className="font-bold text-slate-800">توضیحات فاکتور:</span> {t.description || "بدون توضیحات"}
                          </p>
                          <div className="flex flex-wrap gap-2 items-center">
                            {t.attachmentName && (
                              <button
                                type="button"
                                onClick={() => setViewingAttachment(t)}
                                className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg font-bold border border-indigo-200 cursor-pointer flex items-center gap-1"
                              >
                                <FileText className="w-3.5 h-3.5" />
                                مشاهده تصویر فاکتور ({t.attachmentName})
                              </button>
                            )}
                            {t.payments && t.payments.length > 0 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setPayAccount(t.accountId || accounts[0]?.id || "");
                                  setPayCounterpartyAccount(t.destinationAccount || "");
                                  setPayModalError(null);
                                  setSelectedTxForPayments(t);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-lg font-bold border border-emerald-200 cursor-pointer flex items-center gap-1"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                رویت فیش‌های پرداخت ثبت شده ({toFarsiDigits(t.payments.length)} فیش)
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Audit Details */}
                        {t.approvedBy && (
                          <div className="bg-slate-50 p-3 rounded-xl border border-slate-150 text-[10px] text-slate-500 font-medium grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>✍️ بررسی‌کننده: <span className="font-bold text-slate-700">{t.approvedBy}</span></div>
                            <div className="sm:text-left">📆 تاریخ ثبت نظر: <span className="font-mono text-slate-700">{toFarsiDigits(t.approvedDate || "")}</span></div>
                          </div>
                        )}

                        {/* Actions for Manager */}
                        {isPending && (!activeUser || activeUser?.role === "manager" || activeUser?.username?.toLowerCase() === "admin") && (
                          <div className="pt-3 border-t border-slate-100 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                            {/* Left: Partial payment inputs */}
                            <div className="space-y-1.5 w-full sm:max-w-xs text-right" dir="rtl">
                              <label className="text-[10px] text-slate-500 font-bold block">مبلغ مصوب مورد تأیید مدیریت (ریال):</label>
                              <div className="flex gap-2">
                                <FormattedAmountInput
                                  placeholder={`مبلغ دلخواه (پیش‌فرض کل فاکتور: ${t.amount})`}
                                  value={inputVal}
                                  onChange={val => setCustomApprovalAmounts({ ...customApprovalAmounts, [t.id]: val })}
                                  className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                                />
                              </div>
                              {inputVal && Number(inputVal) > 0 && (
                                <div className="text-[9px] font-bold text-indigo-600 mt-1">
                                  ✍️ تأیید مبلغ {numberToPersianWords(Number(inputVal))} ریال
                                </div>
                              )}
                            </div>

                            {/* Right: Approve/Reject CTA buttons */}
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                              <button
                                onClick={() => {
                                  if (onApproveTransaction) {
                                    onApproveTransaction(t.id, "rejected");
                                  }
                                }}
                                className="px-4 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-150 rounded-xl text-xs font-bold transition-all cursor-pointer shadow-3xs"
                              >
                                ❌ رد کامل فاکتور
                              </button>
                              <button
                                onClick={() => {
                                  if (onApproveTransaction) {
                                    const approvedAmt = inputVal ? Number(inputVal) : undefined;
                                    onApproveTransaction(t.id, "approved", approvedAmt);
                                  }
                                }}
                                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 shadow-sm"
                              >
                                {isPaidOrHasSlips ? "✓ رویت شد و تأیید نهایی سند و فاکتور" : "✓ تأیید مدیریت جهت پرداخت فاکتور"}
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Visual Factor Attachment Viewer Modal (Electronic Archive) */}
      {viewingAttachment && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" dir="rtl">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-4"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <FileText className="w-5 h-5 text-indigo-500" />
                سند پیوست الکترونیکی فاکتور
              </h4>
              <button 
                onClick={() => setViewingAttachment(null)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                بستن ×
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <p><span className="font-semibold">صاحب فاکتور:</span> {viewingAttachment.personName}</p>
                <p><span className="font-semibold">تاریخ سند:</span> {toFarsiDigits(viewingAttachment.date)}</p>
                <p><span className="font-semibold">مبلغ تراکنش:</span> {formatTomans(viewingAttachment.amount)}</p>
                <p><span className="font-semibold">نام فایل:</span> {viewingAttachment.attachmentName}</p>
              </div>

              {/* Visual Simulated Document Card */}
              <div className="border border-slate-150 rounded-xl bg-slate-50 p-6 flex flex-col items-center justify-center min-h-[180px] gap-2">
                <FileText className="w-12 h-12 text-slate-400 animate-pulse" />
                <p className="font-mono font-bold text-slate-600">{viewingAttachment.attachmentName}</p>
                <span className="text-[10px] bg-slate-200 text-slate-600 px-2.5 py-0.5 rounded-full font-light">بایگانی الکترونیکی حفاظت شده</span>
                <p className="text-[10px] text-slate-400 text-center font-light">فایل پیوست به صورت امن در پایگاه داده SQLite ذخیره شده و قابل همگام‌سازی است.</p>
              </div>
            </div>

            <div className="pt-2 flex justify-end gap-2">
              <a 
                href={viewingAttachment.attachmentData}
                download={viewingAttachment.attachmentName}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                دانلود مستقیم فایل پیوست
              </a>
            </div>
          </motion.div>
        </div>
      )}

      {/* Quick Contact Creation Modal */}
      {showContactModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" dir="rtl">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-right"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                تعریف سریع طرف حساب جدید
              </h4>
              <button 
                type="button"
                onClick={() => setShowContactModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                بستن ×
              </button>
            </div>

            <form onSubmit={handleQuickContactSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">نام و نام خانوادگی / شرکت</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مهندس رادمان، شرکت آجر سفال اصفهان"
                  value={contactModalName}
                  onChange={e => setContactModalName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">تلفن همراه</label>
                  <input
                    type="text"
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    value={contactModalPhone}
                    onChange={e => setContactModalPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نقش در پروژه</label>
                  <select
                    value={contactModalRole}
                    onChange={e => setContactModalRole(e.target.value as Contact["role"])}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="supplier">تأمین‌کننده مصالح / کالا</option>
                    <option value="subcontractor">پیمانکار و استادکار</option>
                    <option value="pre_buyer">پیش‌خریدار واحد</option>
                    <option value="imprest_holder">تنخواه‌دار کارگاه</option>
                    <option value="admin">پرسنل اداری / سایر</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">کد ملی / شناسه ملی</label>
                  <input
                    type="text"
                    placeholder="شناسه ملی ده رقمی"
                    value={contactModalNationalId}
                    onChange={e => setContactModalNationalId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره کارت بانکی</label>
                  <input
                    type="text"
                    placeholder="شماره کارت ۱۶ رقمی"
                    value={contactModalCardNumber}
                    onChange={e => setContactModalCardNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">مانده بدهکاری (-) یا طلبکاری (+) اولیه (ریال)</label>
                <FormattedAmountInput
                  placeholder="مثال: ۵۰۰,۰۰۰-"
                  value={contactModalBalance}
                  onChange={setContactModalBalance}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                />
                {contactModalBalance && Number(contactModalBalance) !== 0 && (
                  <div className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded ${Number(contactModalBalance) > 0 ? "text-emerald-700 bg-emerald-50 border border-emerald-150" : "text-rose-700 bg-rose-50 border border-rose-150"}`}>
                    ✍️ {numberToPersianWords(Math.abs(Number(contactModalBalance)))} ریال {Number(contactModalBalance) > 0 ? "(طلبکار)" : "(بدهکار)"}
                    <div className="mt-0.5 font-light">عددی: {Math.abs(Number(contactModalBalance)).toLocaleString("fa-IR")} ریال</div>
                  </div>
                )}
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowContactModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  ثبت و انتخاب طرف حساب
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Quick Project Creation Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" dir="rtl">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-right"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-500" />
                تعریف پروژه ساختمانی جدید
              </h4>
              <button 
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                بستن ×
              </button>
            </div>

            <form onSubmit={handleQuickProjectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">نام پروژه ساختمانی</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: پروژه برج مسکونی آفتاب"
                  value={projectModalName}
                  onChange={e => setProjectModalName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">آدرس دقیق پروژه</label>
                <input
                  type="text"
                  placeholder="مثال: اصفهان، خیابان بزرگمهر، کوچه دهم"
                  value={projectModalAddress}
                  onChange={e => setProjectModalAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">زیربنای کل (متر مربع)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="مثال: ۲۵۰۰"
                    value={projectModalArea}
                    onChange={e => setProjectModalArea(toEnglishDigits(e.target.value))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">بودجه کل پروژه (ریال)</label>
                  <FormattedAmountInput
                    placeholder="مثال: ۱۵۰۰۰۰۰۰۰۰۰"
                    value={projectModalBudget}
                    onChange={setProjectModalBudget}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                <p className="text-[10px] font-bold text-indigo-600 mb-1">فازهای کاری پیش‌فرض پروژه:</p>
                <p className="text-[9px] text-slate-500 leading-relaxed">ساختار درختی ۱۰ شاخه‌ای مراحل ساخت به صورت خودکار به پروژه اختصاص داده می‌شود و قابل ویرایش است.</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  ثبت پروژه
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Quick Account Creation Modal */}
      {showAccountModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" dir="rtl">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-right"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Landmark className="w-5 h-5 text-indigo-500" />
                تعریف حساب بانکی یا تنخواه‌گردان جدید
              </h4>
              <button 
                type="button"
                onClick={() => setShowAccountModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                بستن ×
              </button>
            </div>

            <form onSubmit={handleQuickAccountSubmit} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نام حساب / صندوق</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: صادرات مرکزی، تنخواه کارگاه"
                    value={accountModalName}
                    onChange={e => setAccountModalName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نوع مالی حساب</label>
                  <select
                    value={accountModalType}
                    onChange={e => setAccountModalType(e.target.value as any)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  >
                    <option value="bank">بانک تجاری (جاری/پس‌انداز)</option>
                    <option value="petty_cash">تنخواه‌گردان کارگاه</option>
                    <option value="cash">صندوق نقدی دفتر مرکزی</option>
                    <option value="investor">آورده نقدی شریک</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نام بانک مربوطه</label>
                  <input
                    type="text"
                    placeholder="مثال: بانک ملی ایران"
                    value={accountModalBankName}
                    onChange={e => setAccountModalBankName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره حساب / شماره کارت</label>
                  <input
                    type="text"
                    placeholder="شماره حساب یا کارت بانکی"
                    value={accountModalNumber}
                    onChange={e => setAccountModalNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left focus:outline-none focus:border-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">موجودی نقدی اولیه (ریال)</label>
                <FormattedAmountInput
                  placeholder="مثال: ۱۰۰۰۰۰۰۰"
                  value={accountModalBalance}
                  onChange={setAccountModalBalance}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAccountModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  ثبت حساب مالی
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Quick Stage Creation Modal (Requirement 7: Hierarchical Branch & Sub-Stage support) */}
      {showStageModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50" dir="rtl">
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 text-right"
          >
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-indigo-500" />
                تعریف شاخه یا زیرشاخه مرحله ساخت جدید
              </h4>
              <button 
                type="button"
                onClick={() => setShowStageModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold cursor-pointer"
              >
                بستن ×
              </button>
            </div>

            <form onSubmit={handleQuickStageSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">انتخاب شاخه اصلی (فصل اجرایی)</label>
                <select
                  value={stageModalBranchId}
                  onChange={e => setStageModalBranchId(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                >
                  <option value="new_branch">➕ ایجاد به عنوان یک شاخه اصلی جدید</option>
                  {activeProjectStageTree.map(b => (
                    <option key={b.id} value={b.id}>زیرمجموعهِ {b.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">نام مرحله یا زیرشاخه اجرایی جدید</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: اجرای وال‌پست و میلگرد بستر"
                  value={stageModalName}
                  onChange={e => setStageModalName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
                <p className="text-[9px] text-slate-400 mt-1">این مرحله کاری در ساختار درختی مراحل پروژه ذخیره می‌گردد.</p>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowStageModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  افزودن به درخت مراحل پروژه
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}

      {/* Selected Transaction Payments & Installments Modal */}
      {selectedTxForPayments && (() => {
        const totalPaid = selectedTxForPayments.payments ? selectedTxForPayments.payments.reduce((sum, p) => sum + p.amount, 0) : 0;
        const remainingToPay = selectedTxForPayments.amount - totalPaid;
        const isModalIncome = selectedTxForPayments.type === "income";

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 text-right font-sans" dir="rtl">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-white rounded-3xl max-w-2xl w-full p-6 shadow-2xl border border-slate-150 flex flex-col max-h-[90vh] overflow-hidden"
            >
              <div className="flex justify-between items-center border-b border-slate-100 pb-3 flex-shrink-0">
                <div>
                  <h4 className="font-bold text-slate-850 text-sm flex items-center gap-2">
                    <CreditCard className="w-5 h-5 text-indigo-600" />
                    {isModalIncome ? "مدیریت فیش‌های دریافتی و واریزی به حساب شرکت" : "مدیریت اسناد پرداخت و اقساط فاکتور"}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">ثبت چند مرحله‌ای فیش‌ها و اسناد بانکی مربوط به طرف حساب {selectedTxForPayments.personName}</p>
                </div>
                <button 
                  type="button"
                  onClick={() => setSelectedTxForPayments(null)}
                  className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
                >
                  بستن ×
                </button>
              </div>

              <div className="flex-1 overflow-y-auto py-4 space-y-5 text-xs">
                {/* Financial Summary Cards */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-150 rounded-2xl">
                    <span className="text-[10px] text-slate-400 block font-medium">مبلغ کل سند:</span>
                    <span className="text-sm font-extrabold text-slate-800 font-mono block mt-0.5">{formatTomans(selectedTxForPayments.amount)}</span>
                  </div>
                  <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-2xl">
                    <span className="text-[10px] text-emerald-600 block font-bold">{isModalIncome ? "کل دریافت شده:" : "کل پرداخت شده:"}</span>
                    <span className="text-sm font-extrabold text-emerald-850 font-mono block mt-0.5">{formatTomans(totalPaid)}</span>
                  </div>
                  <div className={`p-3 rounded-2xl border ${remainingToPay <= 0 ? 'bg-emerald-50 border-emerald-150 text-emerald-800' : 'bg-rose-50 border-rose-150 text-rose-800'}`}>
                    <span className="text-[10px] block font-bold">مانده تسویه نشده:</span>
                    <span className="text-sm font-extrabold font-mono block mt-0.5">
                      {remainingToPay <= 0 ? "تسویه کامل" : formatTomans(remainingToPay)}
                    </span>
                  </div>
                </div>

                {/* List of registered payment documents */}
                <div className="space-y-2">
                  <h5 className="font-bold text-slate-700 text-[11px] flex items-center gap-1">
                    <Receipt className="w-3.5 h-3.5 text-slate-400" />
                    اسناد و فیش‌های ثبت‌شده برای این سند
                  </h5>
                  {(!selectedTxForPayments.payments || selectedTxForPayments.payments.length === 0) ? (
                    <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-slate-400 italic">
                      هیچ فیش مجزایی ثبت نشده است.
                    </div>
                  ) : (
                    <div className="border border-slate-100 rounded-xl overflow-hidden">
                      <table className="w-full text-[11px] text-right border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 font-bold">
                            <th className="p-2.5 text-center">ردیف</th>
                            <th className="p-2.5 text-center">شماره فاکتور</th>
                            <th className="p-2.5">شرح</th>
                            <th className="p-2.5">تاریخ</th>
                            <th className="p-2.5">{isModalIncome ? "حساب دریافتی (شرکت)" : "منبع مالی (شرکت)"}</th>
                            <th className="p-2.5">{isModalIncome ? "حساب مبدا (طرف حساب)" : "حساب مقصد (طرف حساب)"}</th>
                            <th className="p-2.5">شماره پیگیری</th>
                            <th className="p-2.5 text-left">مبلغ (ریال)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-slate-700">
                          {selectedTxForPayments.payments.map((p, idx) => {
                            const pAcc = accounts.find(a => a.id === p.accountId);
                            return (
                              <tr key={p.id} className="hover:bg-slate-50/40">
                                <td className="p-2.5 text-center font-mono font-bold text-slate-500">{toFarsiDigits(idx + 1)}</td>
                                <td className="p-2.5 text-center font-mono font-bold text-indigo-700">{toFarsiDigits(p.invoiceNumber || selectedTxForPayments.invoiceNumber || "—")}</td>
                                <td className="p-2.5 text-slate-700">{p.invoiceDescription || p.description || selectedTxForPayments.description || "-"}</td>
                                <td className="p-2.5 font-mono text-slate-500">{toFarsiDigits(p.date)}</td>
                                <td className="p-2.5 font-semibold text-slate-800">{pAcc?.name || "صندوق نقدی"}</td>
                                <td className="p-2.5 font-mono text-indigo-700">{toFarsiDigits(p.sourceAccount || p.destinationAccount || "—")}</td>
                                <td className="p-2.5 font-mono text-slate-600">{toFarsiDigits(p.referenceNumber || "بدون شماره")}</td>
                                <td className="p-2.5 font-bold text-left text-indigo-700 font-mono">{formatTomans(p.amount)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Form to add a new installment/payment */}
                <form onSubmit={handlePaymentSubmit} className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-3">
                  <h5 className="font-bold text-slate-800 text-[11px] flex items-center gap-1 border-b border-slate-200 pb-1.5">
                    <Plus className="w-4 h-4 text-emerald-600" />
                    {isModalIncome ? "ثبت فیش دریافتی جدید (واریز به حساب شرکت)" : "ثبت ردیف پرداخت جدید برای فاکتور"}
                  </h5>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">ردیف فیش</label>
                      <input
                        type="text"
                        readOnly
                        value={`ردیف ${toFarsiDigits((selectedTxForPayments.payments?.length || 0) + 1)}`}
                        className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold text-center text-slate-600 outline-none"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">شماره فاکتور</label>
                      <input
                        type="text"
                        placeholder={selectedTxForPayments.invoiceNumber || "مثال: ۱۴۰۳/۱۰۲"}
                        value={payInvoiceNum}
                        onChange={e => setPayInvoiceNum(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-bold focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">شرح فیش</label>
                      <input
                        type="text"
                        placeholder={selectedTxForPayments.description || "شرح پرداخت / دریافت"}
                        value={payDesc}
                        onChange={e => setPayDesc(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">مبلغ فیش (ریال) <span className="text-rose-500">*</span></label>
                      <FormattedAmountInput
                        required
                        placeholder={`مثال: ${remainingToPay > 0 ? remainingToPay : selectedTxForPayments.amount}`}
                        value={payAmount}
                        onChange={setPayAmount}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      {payAmount && Number(payAmount) > 0 && (
                        <div className="text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded bg-rose-50 border border-rose-150 text-rose-700 block max-w-xs">
                          ✍️ {numberToPersianWords(Number(payAmount))} ریال
                          <div className="mt-0.5 font-light">عددی: {Number(payAmount).toLocaleString("fa-IR")} ریال</div>
                        </div>
                      )}
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-500 font-bold block">تاریخ فیش (شمسی) <span className="text-rose-500">*</span></label>
                      <ShamsiDatePicker
                        required
                        placeholder="مثال: ۱۴۰۳/۰۴/۰۳"
                        value={payDate}
                        onChange={setPayDate}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-700 font-bold block">
                        {isModalIncome ? (
                          <>حساب دریافتی (حساب شرکت) <span className="text-rose-500 font-black">* (اجباری)</span></>
                        ) : (
                          "منبع مالی (حساب مبدا شرکت)"
                        )}
                      </label>
                      <select
                        value={payAccount}
                        onChange={e => setPayAccount(e.target.value)}
                        className={`w-full bg-white border rounded-xl px-2 py-2 text-xs focus:outline-none focus:border-indigo-500 ${
                          isModalIncome && !payAccount ? "border-amber-400 bg-amber-50/40" : "border-slate-200"
                        }`}
                      >
                        {isModalIncome && (
                          <option value="">-- انتخاب حساب دریافتی شرکت (اجباری) --</option>
                        )}
                        {accounts.map(a => (
                          <option key={a.id} value={a.id}>{a.name} (موجودی: {formatTomans(a.balance)})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-700 font-bold block">
                        {isModalIncome
                          ? "حساب مبدا (حساب طرف حسابی که واریزی انجام داده)"
                          : "حساب مقصد (طرف حساب)"}
                      </label>
                      <input
                        type="text"
                        placeholder={isModalIncome ? "شماره کارت/حساب طرف حساب واریزکننده..." : "شماره کارت/حساب مقصد..."}
                        value={payCounterpartyAccount}
                        onChange={e => setPayCounterpartyAccount(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none focus:border-indigo-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] text-slate-500 font-bold block">شماره پیگیری فیش / چک / حواله</label>
                    <input
                      type="text"
                      placeholder="مثال: ۹۸۷۶۵۴۳۲"
                      value={payRef}
                      onChange={e => setPayRef(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-left focus:outline-none focus:border-indigo-500"
                    />
                  </div>

                  {payModalError && (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-[11px] font-bold">
                      ⚠️ {payModalError}
                    </div>
                  )}

                  <div className="pt-2 flex justify-end">
                    <button
                      type="submit"
                      className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-xs transition-colors cursor-pointer flex items-center gap-1 shadow-sm"
                    >
                      <Receipt className="w-4 h-4" />
                      ذخیره و ثبت رسمی فیش
                    </button>
                  </div>
                </form>
              </div>

              <div className="pt-3 border-t border-slate-100 flex justify-end flex-shrink-0">
                <button
                  type="button"
                  onClick={() => setSelectedTxForPayments(null)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-colors cursor-pointer"
                >
                  بستن پنجره
                </button>
              </div>
            </motion.div>
          </div>
        );
      })()}
    </div>
  );
}
