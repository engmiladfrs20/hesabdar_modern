import React, { useState, useEffect } from "react";
import { ShamsiDatePicker } from "./ShamsiDatePicker";
import { FormattedAmountInput } from "./FormattedAmountInput";
import { getTodayShamsiString } from "../utils/shamsi";
import { toEnglishDigits } from "../utils/digits";
import { 
  Users, 
  Wallet, 
  FileText, 
  MessageSquare, 
  Plus, 
  UserPlus, 
  DollarSign, 
  Calendar, 
  AlertTriangle, 
  CheckCircle, 
  Lock, 
  Unlock, 
  Send, 
  CreditCard, 
  CheckCircle2, 
  XCircle,
  Clock,
  ArrowUpRight,
  ArrowDownLeft,
  Bell,
  Trash2,
  Edit2,
  Save,
  X,
  Receipt,
  Paperclip,
  Search,
  Coins,
  ShieldCheck,
  Building,
  Printer,
  SlidersHorizontal
} from "lucide-react";
import { DatabaseSchema, Project, Account, UnitItem, Contact as DBContact, ImprestExpense } from "../types";
import SearchableCombobox, { ComboboxOption } from "./SearchableCombobox";
import { printStructuredReport } from "../utils/printReport";

// Keep inside module for exact matches
interface Contact {
  id: string;
  name: string;
  phone: string;
  role: "pre_buyer" | "supplier" | "subcontractor" | "imprest_holder" | "admin";
  nationalId?: string;
  bankCardNumber?: string;
  balance: number;
  createdAt?: string;
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
}

interface PreSaleInstallment {
  id: string;
  preSaleId: string;
  installmentName: string;
  dueDate: string;
  amount: number;
  isPaid: boolean;
  paidDate?: string;
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

interface Props {
  db: DatabaseSchema;
  activeCompanyId?: string;
  getApiUrl: (endpoint: string) => string;
  onRefresh: () => Promise<void>;
  projects: Project[];
  onDeletePreSale?: (presaleId: string) => Promise<void>;
  onDeleteImprest?: (imprestId: string) => Promise<void>;
  onDeleteImprestExpense?: (expenseId: string) => Promise<void>;
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

interface BarterUnitInput {
  selectionType: "specific" | "scoring";
  unitId: string;
  blockName?: string;
  saleAreaType?: "useful" | "with_commons";
  usefulArea?: string;
  storageArea?: string;
  parkingArea?: string;
  commonArea?: string;
  area: string;
  price: string;
}

export default function ContractsAndImprests({ db, activeCompanyId, getApiUrl, onRefresh, projects, onDeletePreSale, onDeleteImprest, onDeleteImprestExpense }: Props) {
  const [subTab, setSubTab] = useState<"contacts" | "imprests" | "presales" | "alerts">("contacts");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [materialCategories, setMaterialCategories] = useState<ComboboxOption[]>([
    { value: "آهن‌آلات", label: "آهن‌آلات و فولاد" },
    { value: "سیمان", label: "مصالح سیمانی و پودری" },
    { value: "تأسیسات", label: "تأسیسات الکتریکال/مکانیکال" },
    { value: "سفت‌کاری", label: "سفت‌کاری و آجر" },
    { value: "ابزارآلات", label: "ابزارآلات و وسایل مصرفی" },
    { value: "غذا و ایاب ذهاب", label: "غذا، ایاب ذهاب و اداری" },
    { value: "ماشین‌آلات", label: "اجاره و تعمیر ماشین‌آلات" },
    { value: "دستمزد", label: "دستمزد روزمزد و پیمانکاران" },
  ]);

  const [constructionStages, setConstructionStages] = useState<ComboboxOption[]>([
    { value: "خاک‌برداری", label: "خاک‌برداری و گودبرداری" },
    { value: "فونداسیون", label: "پی‌ریزی و فونداسیون" },
    { value: "اسکلت‌بندی", label: "اسکلت‌بندی و سازه" },
    { value: "سفت‌کاری", label: "سفت‌کاری و تیغه‌چینی" },
    { value: "نازک‌کاری", label: "نازک‌کاری و نما" },
    { value: "تأسیسات", label: "تأسیسات برقی و مکانیکی" },
    { value: "عمومی", label: "هزینه‌های عمومی و کارگاهی" },
  ]);

  // Modal states for detailed quick additions
  const [showContactModal, setShowContactModal] = useState(false);
  const [contactModalName, setContactModalName] = useState("");
  const [contactModalPhone, setContactModalPhone] = useState("");
  const [contactModalRole, setContactModalRole] = useState<string>("supplier");
  const [customRoleInput, setCustomRoleInput] = useState("");
  const [contactModalNationalId, setContactModalNationalId] = useState("");
  const [contactModalCardNumber, setContactModalCardNumber] = useState("");
  const [contactModalBalance, setContactModalBalance] = useState("0");
  const [contactModalBankName, setContactModalBankName] = useState("");
  const [contactModalBankIBAN, setContactModalBankIBAN] = useState("");
  const [contactModalJobCategory, setContactModalJobCategory] = useState("");
  const [contactModalPaymentMethod, setContactModalPaymentMethod] = useState<"cash" | "barter">("cash");
  const [contactModalProjectId, setContactModalProjectId] = useState("");
  const [contactModalBarterUnitId, setContactModalBarterUnitId] = useState("");
  const [contactModalBarterArea, setContactModalBarterArea] = useState("");
  const [contactModalBarterPrice, setContactModalBarterPrice] = useState("");
  const [contactModalRoles, setContactModalRoles] = useState<string[]>([]);
  const [contactModalBarterUnitsList, setContactModalBarterUnitsList] = useState<BarterUnitInput[]>([
    { selectionType: "specific", unitId: "", area: "", price: "" }
  ]);

  const [showProjectModal, setShowProjectModal] = useState(false);
  const [projectModalName, setProjectModalName] = useState("");
  const [projectModalAddress, setProjectModalAddress] = useState("");
  const [projectModalBudget, setProjectModalBudget] = useState("");
  const [projectModalArea, setProjectModalArea] = useState("");
  const [projectModalTotalUnits, setProjectModalTotalUnits] = useState("10");

  const [modalTriggerOrigin, setModalTriggerOrigin] = useState<"imprest_project" | "imprest_contact" | "expense_contact" | "presale_project" | "presale_contact" | null>(null);

  // Forms states
  const [contactForm, setContactForm] = useState({
    name: "",
    phone: "",
    role: "supplier" as string,
    nationalId: "",
    bankCardNumber: "",
    bankName: "",
    bankIBAN: "",
    jobCategory: "",
    balance: ""
  });
  const [editingContactId, setEditingContactId] = useState<string | null>(null);
  const [inlineCustomRoleInput, setInlineCustomRoleInput] = useState("");

  const [imprestForm, setImprestForm] = useState({
    projectId: projects[0]?.id || "p1",
    contactId: "",
    allocatedLimit: ""
  });

  const [expenseForm, setExpenseForm] = useState({
    imprestId: "",
    contactId: "",
    personName: "",
    materialCategory: "تأسیسات",
    stage: "عمومی",
    invoiceNumber: "",
    description: "",
    amount: "",
    expenseDate: getTodayShamsiString(),
    paymentStatus: "paid" as "paid" | "partially_paid" | "unpaid",
    paidAmount: "",
    referenceNumber: "",
    attachmentName: "",
    attachmentData: ""
  });

  const [selectedExpenseForPay, setSelectedExpenseForPay] = useState<ImprestExpense | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => getTodayShamsiString());
  const [payInvoiceNum, setPayInvoiceNum] = useState("");
  const [payRef, setPayRef] = useState("");
  const [payDesc, setPayDesc] = useState("");

  const [presaleForm, setPresaleForm] = useState({
    projectId: projects[0]?.id || "p1",
    contactId: "",
    unitId: "",
    blockName: "",
    saleAreaType: "useful" as "useful" | "with_commons",
    usefulArea: "",
    storageArea: "0",
    parkingArea: "0",
    commonArea: "0",
    contractArea: "",
    pricePerMeter: "",
    contractDate: getTodayShamsiString()
  });

  const [selectedPreSaleId, setSelectedPreSaleId] = useState<string | null>(null);
  const [activeImprestId, setActiveImprestId] = useState<string | null>(null);

  // States for custom installment management
  const [newInstForm, setNewInstForm] = useState({
    installmentName: "",
    dueDate: getTodayShamsiString(),
    amount: ""
  });

  const [editingInstId, setEditingInstId] = useState<string | null>(null);
  const [editingInstForm, setEditingInstForm] = useState({
    installmentName: "",
    dueDate: "",
    amount: ""
  });

  // Pre-sale contract payment forms states
  const [presalePayAmount, setPresalePayAmount] = useState("");
  const [presalePayAccountId, setPresalePayAccountId] = useState("");
  const [presalePaySourceAccount, setPresalePaySourceAccount] = useState("");
  const [presalePayDate, setPresalePayDate] = useState(() => getTodayShamsiString());
  const [presalePayRef, setPresalePayRef] = useState("");
  const [presalePayDesc, setPresalePayDesc] = useState("");
  const [instPayModal, setInstPayModal] = useState<PreSaleInstallment | null>(null);
  const [instPayAccountId, setInstPayAccountId] = useState("");
  const [instPaySourceAccount, setInstPaySourceAccount] = useState("");
  const [instPayDate, setInstPayDate] = useState(() => getTodayShamsiString());
  const [instPayRef, setInstPayRef] = useState("");

  // Search & Advanced Search states across all 4 tabs
  const [contactSearch, setContactSearch] = useState("");
  const [showContactAdv, setShowContactAdv] = useState(false);
  const [contactRoleFilter, setContactRoleFilter] = useState("all");
  const [contactBalanceFilter, setContactBalanceFilter] = useState("all");

  const [imprestSearch, setImprestSearch] = useState("");
  const [showImprestAdv, setShowImprestAdv] = useState(false);
  const [imprestProjectFilter, setImprestProjectFilter] = useState("all");
  const [imprestPaymentFilter, setImprestPaymentFilter] = useState("all");

  const [presaleSearch, setPresaleSearch] = useState("");
  const [showPresaleAdv, setShowPresaleAdv] = useState(false);
  const [presaleProjectFilter, setPresaleProjectFilter] = useState("all");
  const [presaleBlockFilter, setPresaleBlockFilter] = useState("all");

  const [alertSearch, setAlertSearch] = useState("");
  const [showAlertAdv, setShowAlertAdv] = useState(false);
  const [alertTypeFilter, setAlertTypeFilter] = useState("all");

  // States for exact area deed settlement
  const [exactAreaInput, setExactAreaInput] = useState("");
  const [secondaryPriceInput, setSecondaryPriceInput] = useState("");
  const [hasExactAreaChecked, setHasExactAreaChecked] = useState(false);

  useEffect(() => {
    if (projects.length > 0) {
      setImprestForm(prev => (!prev.projectId || !projects.some(p => p.id === prev.projectId)) ? { ...prev, projectId: projects[0].id } : prev);
      setPresaleForm(prev => (!prev.projectId || !projects.some(p => p.id === prev.projectId)) ? { ...prev, projectId: projects[0].id } : prev);
      setContactModalProjectId(prev => (!prev || !projects.some(p => p.id === prev)) ? projects[0].id : prev);
    }
  }, [projects]);

  React.useEffect(() => {
    if (selectedPreSaleId) {
      const ps = (db.preSales || []).find(p => p.id === selectedPreSaleId);
      if (ps) {
        setExactAreaInput(ps.exactArea !== undefined ? ps.exactArea.toString() : ps.contractArea.toString());
        setSecondaryPriceInput(ps.secondaryPricePerMeter !== undefined ? ps.secondaryPricePerMeter.toString() : ps.pricePerMeter.toString());
        setHasExactAreaChecked(!!ps.hasExactArea);
      }
    }
  }, [selectedPreSaleId, db.preSales]);

  const handleUpdateExactArea = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPreSaleId) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/presales/update-area"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedPreSaleId,
          exactArea: Number(exactAreaInput),
          secondaryPricePerMeter: Number(secondaryPriceInput),
          hasExactArea: hasExactAreaChecked
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg("متراژ دقیق سند و مابه‌التفاوت قرارداد با موفقیت اعمال و اقساط بازمحاسبه شدند.");
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در بروزرسانی متراژ دقیق");
      }
    } catch (err: any) {
      setErrorMsg("خطا: " + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper formatting functions
  const formatRial = (num: number) => {
    return num.toLocaleString("fa-IR") + " ریال";
  };

  const handleAddInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPreSaleId || !newInstForm.installmentName || !newInstForm.dueDate || !newInstForm.amount) return;
    const currentContract = (db.preSales || []).find(ps => ps.id === selectedPreSaleId);
    const existingSum = (db.preSaleInstallments || []).filter(i => i.preSaleId === selectedPreSaleId).reduce((s, i) => s + Number(i.amount || 0), 0);
    const nextSum = existingSum + Number(newInstForm.amount);
    if (currentContract && nextSum > currentContract.totalPrice) {
      const proceed = window.confirm(
        `⚠️ هشدار: با ثبت این قسط، جمع کل اقساط ثبت‌شده (${formatRial(nextSum)}) از مبلغ کل قرارداد (${formatRial(currentContract.totalPrice)}) بیشتر خواهد شد!\nآیا همچنان مایل به ثبت این قسط هستید؟`
      );
      if (!proceed) return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/presales/installments/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preSaleId: selectedPreSaleId,
          ...newInstForm,
          amount: Number(newInstForm.amount)
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg("قسط جدید با موفقیت به قرارداد پیش‌فروش اضافه شد.");
        setNewInstForm({ installmentName: "", dueDate: getTodayShamsiString(), amount: "" });
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در افزودن قسط");
      }
    } catch (err) {
      setErrorMsg("خطای ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteInstallment = async (installmentId: string) => {
    if (!window.confirm("آیا از حذف این قسط اطمینان دارید؟")) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/presales/installments/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ installmentId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg("قسط با موفقیت از سیستم حذف شد.");
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در حذف قسط");
      }
    } catch (err) {
      setErrorMsg("خطای ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSaveEditInstallment = async (installmentId: string) => {
    if (!editingInstForm.installmentName || !editingInstForm.dueDate || !editingInstForm.amount) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/presales/installments/edit"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId,
          ...editingInstForm,
          amount: Number(editingInstForm.amount)
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg("قسط با موفقیت ویرایش شد.");
        setEditingInstId(null);
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در ویرایش قسط");
      }
    } catch (err) {
      setErrorMsg("خطای ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickAddContact = async (name: string, role: Contact["role"]) => {
    try {
      const response = await fetch(getApiUrl("/api/contacts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          phone: "",
          role,
          nationalId: "",
          bankCardNumber: "",
          balance: 0
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg(`طرف حساب جدید "${name}" با موفقیت تعریف شد.`);
        await onRefresh();
        return data.contact?.id;
      }
    } catch (err) {
      console.error("Error quick-adding contact:", err);
    }
    return null;
  };

  const handleQuickAddProject = async (name: string) => {
    try {
      const response = await fetch(getApiUrl("/api/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: activeCompanyId || "c1",
          name,
          address: "ثبت سریع از تنخواه",
          totalArea: 0,
          budget: 0,
          status: "active"
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg(`پروژه "${name}" با موفقیت تعریف شد.`);
        await onRefresh();
        return data.project?.id;
      }
    } catch (err) {
      console.error("Error quick-adding project:", err);
    }
    return null;
  };

  const handleQuickContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactModalName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    // If barter is selected, validate that units details are filled
    if (contactModalPaymentMethod === "barter") {
      if (!contactModalProjectId) {
        setErrorMsg("تعیین پروژه برای طرف حساب تهاتری الزامی است.");
        setIsSubmitting(false);
        return;
      }
      for (let i = 0; i < contactModalBarterUnitsList.length; i++) {
        const bu = contactModalBarterUnitsList[i];
        if (bu.selectionType === "specific" && !bu.unitId) {
          setErrorMsg(`انتخاب واحد برای ردیف ${i + 1} الزامی است.`);
          setIsSubmitting(false);
          return;
        }
        if (!bu.area || Number(bu.area) <= 0) {
          setErrorMsg(`وارد کردن متراژ برای ردیف ${i + 1} الزامی است.`);
          setIsSubmitting(false);
          return;
        }
        if (!bu.price || Number(bu.price) <= 0) {
          setErrorMsg(`وارد کردن قیمت هر متر برای ردیف ${i + 1} الزامی است.`);
          setIsSubmitting(false);
          return;
        }
      }
    }

    try {
      const barterUnits = contactModalPaymentMethod === "barter" ? contactModalBarterUnitsList.map(bu => ({
        unitId: bu.selectionType === "scoring" ? "after_scoring" : bu.unitId,
        blockName: bu.blockName || "",
        saleAreaType: bu.saleAreaType || "useful",
        usefulArea: Number(bu.usefulArea || bu.area || 0),
        storageArea: Number(bu.storageArea || 0),
        parkingArea: Number(bu.parkingArea || 0),
        commonArea: (bu.saleAreaType === "with_commons") ? Number(bu.commonArea || 0) : 0,
        area: Number(bu.area),
        price: Number(bu.price),
        selectionType: bu.selectionType
      })) : [];

      const response = await fetch(getApiUrl("/api/contacts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: contactModalName.trim(),
          phone: contactModalPhone.trim(),
          role: contactModalRole === "custom" ? customRoleInput.trim() : contactModalRole,
          nationalId: contactModalNationalId.trim(),
          bankCardNumber: contactModalCardNumber.trim(),
          bankName: contactModalBankName.trim(),
          bankIBAN: contactModalBankIBAN.trim(),
          jobCategory: contactModalJobCategory.trim(),
          paymentMethod: contactModalPaymentMethod,
          barterUnits,
          roles: contactModalRoles.length > 0 ? contactModalRoles : [contactModalRole === "custom" ? customRoleInput.trim() : contactModalRole],
          projectId: contactModalProjectId || undefined,
          balance: Number(contactModalBalance || 0)
        })
      });
      const data = await response.json();
      if (data.status === "success" && data.contact?.id) {
        const newId = data.contact.id;
        const newName = contactModalName.trim();
        setSuccessMsg(`طرف حساب جدید "${newName}" با موفقیت تعریف شد.`);
        await onRefresh();

        // Match with origin
        if (modalTriggerOrigin === "imprest_contact") {
          setImprestForm(prev => ({ ...prev, contactId: newId }));
        } else if (modalTriggerOrigin === "expense_contact") {
          setExpenseForm(prev => ({ ...prev, contactId: newId, personName: newName }));
        } else if (modalTriggerOrigin === "presale_contact") {
          setPresaleForm(prev => ({ ...prev, contactId: newId }));
        }
        
        // Reset states
        setContactModalName("");
        setContactModalPhone("");
        setContactModalRole("supplier");
        setCustomRoleInput("");
        setContactModalNationalId("");
        setContactModalCardNumber("");
        setContactModalBalance("0");
        setContactModalBankName("");
        setContactModalBankIBAN("");
        setContactModalJobCategory("");
        setContactModalPaymentMethod("cash");
        setContactModalRoles([]);
        setContactModalProjectId("");
        setContactModalBarterUnitsList([{ selectionType: "specific", unitId: "", area: "", price: "" }]);
        setShowContactModal(false);
      } else {
        setErrorMsg(data.error || "خطا در ثبت سریع طرف حساب");
      }
    } catch (err) {
      setErrorMsg("خطای ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleQuickProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!projectModalName.trim()) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/projects"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          companyId: activeCompanyId || "c1",
          name: projectModalName.trim(),
          address: projectModalAddress.trim() || "ثبت شده از تنخواه",
          totalUnits: Number(toEnglishDigits(projectModalTotalUnits)) || 0,
          totalArea: Number(toEnglishDigits(projectModalArea)) || 0,
          budget: Number(toEnglishDigits(projectModalBudget)) || 0,
          status: "active"
        })
      });
      const data = await response.json();
      if (data.status === "success" && data.project?.id) {
        const newId = data.project.id;
        setSuccessMsg(`پروژه جدید "${projectModalName.trim()}" با موفقیت تعریف شد.`);
        await onRefresh();

        // Match with origin
        if (modalTriggerOrigin === "imprest_project") {
          setImprestForm(prev => ({ ...prev, projectId: newId }));
        } else if (modalTriggerOrigin === "presale_project") {
          setPresaleForm(prev => ({ ...prev, projectId: newId }));
        }
        setShowProjectModal(false);
      } else {
        setErrorMsg(data.error || "خطا در ثبت سریع پروژه");
      }
    } catch (err) {
      setErrorMsg("خطای ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/contacts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: editingContactId || undefined,
          ...contactForm,
          role: contactForm.role === "custom" ? inlineCustomRoleInput.trim() : contactForm.role,
          balance: Number(contactForm.balance || 0)
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg(editingContactId ? "اطلاعات طرف حساب با موفقیت بروزرسانی شد." : "طرف حساب جدید با موفقیت در سامانه ثبت شد.");
        setEditingContactId(null);
        setContactForm({
          name: "",
          phone: "",
          role: "supplier",
          nationalId: "",
          bankCardNumber: "",
          bankName: "",
          bankIBAN: "",
          jobCategory: "",
          balance: ""
        });
        setInlineCustomRoleInput("");
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در ثبت اطلاعات طرف حساب");
      }
    } catch (err) {
      setErrorMsg("خطای شبکه یا ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditContactClick = (c: any) => {
    setEditingContactId(c.id);
    const isCustomRole = !["supplier", "subcontractor", "imprest_holder", "pre_buyer", "admin"].includes(c.role);
    setContactForm({
      name: c.name,
      phone: c.phone || "",
      role: isCustomRole ? "custom" : c.role,
      nationalId: c.nationalId || "",
      bankCardNumber: c.bankCardNumber || "",
      bankName: c.bankName || "",
      bankIBAN: c.bankIBAN || "",
      jobCategory: c.jobCategory || "",
      balance: String(c.balance || 0)
    });
    if (isCustomRole) {
      setInlineCustomRoleInput(c.role);
    } else {
      setInlineCustomRoleInput("");
    }
  };

  const handleDeleteContactClick = async (contactId: string, contactName: string) => {
    if (!window.confirm(`آیا از حذف طرف حساب "${contactName}" مطمئن هستید؟ با حذف طرف حساب، تمامی حساب‌های تنخواه و قراردادهای مرتبط نیز حذف خواهند شد.`)) {
      return;
    }
    
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    
    try {
      const response = await fetch(getApiUrl("/api/contacts/delete"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: contactId })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg(`طرف حساب "${contactName}" با موفقیت حذف شد.`);
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در حذف طرف حساب");
      }
    } catch (err) {
      setErrorMsg("خطای ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateImprest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!imprestForm.contactId || !imprestForm.allocatedLimit) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/imprests"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: imprestForm.projectId,
          contactId: imprestForm.contactId,
          allocatedLimit: Number(imprestForm.allocatedLimit),
          balance: Number(imprestForm.allocatedLimit)
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg("صندوق تنخواه جدید برای ناظر پروژه تخصیص داده شد.");
        setImprestForm({ projectId: projects[0]?.id || "p1", contactId: "", allocatedLimit: "" });
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در تخصیص تنخواه");
      }
    } catch (err) {
      setErrorMsg("خطای ارتباط با دیتابیس");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLockImprest = async (id: string, currentStatus: string) => {
    setIsSubmitting(true);
    const newStatus = currentStatus === "locked" ? "active" : "locked";
    try {
      const fund = db.imprestFunds?.find(f => f.id === id);
      if (fund) {
        await fetch(getApiUrl("/api/imprests"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...fund, status: newStatus })
        });
        await onRefresh();
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRecordExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expenseForm.imprestId || !expenseForm.amount || !expenseForm.description) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/imprests/expenses"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imprestId: expenseForm.imprestId,
          invoiceNumber: expenseForm.invoiceNumber,
          description: expenseForm.description,
          amount: Number(expenseForm.amount),
          expenseDate: expenseForm.expenseDate,
          materialCategory: expenseForm.materialCategory,
          contactId: expenseForm.contactId,
          personName: expenseForm.personName,
          stage: expenseForm.stage,
          paymentStatus: expenseForm.paymentStatus,
          paidAmount: expenseForm.paymentStatus === "partially_paid" ? Number(expenseForm.paidAmount || 0) : undefined,
          referenceNumber: expenseForm.referenceNumber,
          attachmentName: expenseForm.attachmentName,
          attachmentData: expenseForm.attachmentData
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg("هزینه ناظر در تنخواه ثبت و از صندوق کسر شد.");
        setExpenseForm({
          imprestId: activeImprestId || "",
          contactId: "",
          personName: "",
          materialCategory: "تأسیسات",
          stage: "عمومی",
          invoiceNumber: "",
          description: "",
          amount: "",
          expenseDate: getTodayShamsiString(),
          paymentStatus: "paid",
          paidAmount: "",
          referenceNumber: "",
          attachmentName: "",
          attachmentData: ""
        });
        await onRefresh();
      } else {
        setErrorMsg(data.error || "تنخواه قفل است یا سقف مجاز اجازه ثبت تراکنش نمی‌دهد.");
      }
    } catch (err) {
      setErrorMsg("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayExpenseSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedExpenseForPay || !payAmount) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      const response = await fetch(getApiUrl("/api/imprests/expenses/pay"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          expenseId: selectedExpenseForPay.id,
          amount: Number(payAmount),
          date: payDate,
          invoiceNumber: payInvoiceNum || selectedExpenseForPay.invoiceNumber || "",
          invoiceDescription: payDesc || selectedExpenseForPay.description || "",
          referenceNumber: payRef,
          description: payDesc
        })
      });
      const data = await response.json();
      if (response.ok) {
        setSuccessMsg("پرداخت فاکتور با موفقیت در تنخواه ثبت و از صندوق کسر شد.");
        setSelectedExpenseForPay(null);
        setPayAmount("");
        setPayInvoiceNum("");
        setPayRef("");
        setPayDesc("");
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در ثبت پرداخت");
      }
    } catch (err) {
      setErrorMsg("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreatePresale = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!presaleForm.contactId || !presaleForm.unitId || !presaleForm.contractArea || !presaleForm.pricePerMeter) return;
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    const uArea = Number(presaleForm.usefulArea || presaleForm.contractArea || 0);
    const sArea = Number(presaleForm.storageArea || 0);
    const pArea = Number(presaleForm.parkingArea || 0);
    const cArea = presaleForm.saleAreaType === "with_commons" ? Number(presaleForm.commonArea || 0) : 0;
    const totalArea = Number(presaleForm.contractArea) || (uArea + sArea + pArea + cArea);
    const calculatedTotal = Math.round(totalArea * Number(presaleForm.pricePerMeter));

    try {
      const response = await fetch(getApiUrl("/api/presales"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: presaleForm.projectId,
          contactId: presaleForm.contactId,
          unitId: presaleForm.unitId,
          blockName: presaleForm.blockName,
          saleAreaType: presaleForm.saleAreaType,
          usefulArea: uArea,
          storageArea: sArea,
          parkingArea: pArea,
          commonArea: cArea,
          contractArea: totalArea,
          pricePerMeter: Number(presaleForm.pricePerMeter),
          totalPrice: calculatedTotal,
          contractDate: presaleForm.contractDate
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg("قرارداد پیش‌فروش ثبت شد و طرف قرارداد به اندازه کل مبلغ قرارداد بدهکار گردید. اکنون می‌توانید اقساط یا واریزی‌ها را وارد نمایید.");
        if (data.preSale?.id) {
          setSelectedPreSaleId(data.preSale.id);
        }
        setPresaleForm({
          projectId: projects[0]?.id || "p1",
          contactId: "",
          unitId: "",
          blockName: "",
          saleAreaType: "useful",
          usefulArea: "",
          storageArea: "0",
          parkingArea: "0",
          commonArea: "0",
          contractArea: "",
          pricePerMeter: "",
          contractDate: getTodayShamsiString()
        });
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در تنظیم قرارداد پیش‌فروش");
      }
    } catch (err) {
      setErrorMsg("خطای ارتباط با سرور ساختمانی");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handlePayInstallment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!instPayModal) return;
    if (!instPayAccountId) {
      setErrorMsg("انتخاب حساب دریافتی (بانک یا صندوق شرکت) برای ثبت دریافتی قسط الزامی است.");
      return;
    }
    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/presales/installments/pay"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          installmentId: instPayModal.id,
          accountId: instPayAccountId,
          sourceAccount: instPaySourceAccount,
          referenceNumber: instPayRef,
          paidDate: instPayDate || getTodayShamsiString()
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg("قسط با موفقیت وصول شد، به حساب دریافتی شرکت واریز گردید و از بدهی طرف قرارداد کسر شد.");
        setInstPayModal(null);
        setInstPayAccountId("");
        setInstPaySourceAccount("");
        setInstPayRef("");
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در ثبت پرداخت قسط");
      }
    } catch (err) {
      setErrorMsg("خطای برقراری ارتباط با دیتابیس");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRegisterPresalePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPreSaleId) return;
    if (!presalePayAmount || Number(presalePayAmount) <= 0) {
      setErrorMsg("لطفاً مبلغ دریافتی (آورده طرف قرارداد) را وارد کنید.");
      return;
    }
    if (!presalePayAccountId) {
      setErrorMsg("انتخاب حساب دریافتی شرکت (بانک یا صندوق مقصد) اجباری است تا مشخص شود مبلغ به چه حسابی واریز شده است.");
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const response = await fetch(getApiUrl("/api/presales/payments/add"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preSaleId: selectedPreSaleId,
          amount: Number(presalePayAmount),
          accountId: presalePayAccountId,
          sourceAccount: presalePaySourceAccount,
          paidDate: presalePayDate || getTodayShamsiString(),
          referenceNumber: presalePayRef,
          description: presalePayDesc
        })
      });
      const data = await response.json();
      if (data.status === "success") {
        setSuccessMsg("دریافتی جدید در آورده طرف قرارداد ثبت شد و از بدهی کل قرارداد کسر گردید.");
        setPresalePayAmount("");
        setPresalePayAccountId("");
        setPresalePaySourceAccount("");
        setPresalePayRef("");
        setPresalePayDesc("");
        await onRefresh();
      } else {
        setErrorMsg(data.error || "خطا در ثبت سند دریافت");
      }
    } catch (err) {
      setErrorMsg("خطا در برقراری ارتباط با سرور");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSMS = async (type: "installment" | "check" | "imprest_lock", recipientPhone: string, message: string, referenceId: string) => {
    setIsSubmitting(true);
    try {
      const res = await fetch(getApiUrl("/api/alerts"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, recipientPhone, message, referenceId })
      });
      if (res.ok) {
        alert(`پیامک یادآوری هوشمند به شماره ${recipientPhone} با موفقیت مخابره شد:\n"${message}"`);
        await onRefresh();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Contacts Filtering
  const contactsList = db.contacts || [];
  const imprestList = db.imprestFunds || [];
  const presalesList = db.preSales || [];
  const installmentsList = db.preSaleInstallments || [];
  const alertsLogList = db.alertsLog || [];
  const transactionsList = db.transactions || [];
  const accountsList = db.accounts || [];

  const getContactAccountingSummary = (c: any) => {
    const buyerContracts = presalesList.filter(ps => ps.contactId === c.id);
    const hasPreSaleContract = c.role === "pre_buyer" || buyerContracts.length > 0;
    if (hasPreSaleContract && buyerContracts.length > 0) {
      const preSaleIds = new Set(buyerContracts.map(ps => ps.id));
      const totalContractAmount = buyerContracts.reduce((s, ps) => s + Number(ps.totalPrice || 0), 0);
      const totalPaid = transactionsList
        .filter(tx => tx.type === "income" && (tx.contactId === c.id || (tx.preSaleId && preSaleIds.has(tx.preSaleId))))
        .reduce((s, tx) => s + Number(tx.amount || 0), 0);
      const netDebt = totalContractAmount - totalPaid;
      return {
        isPreBuyer: true,
        totalContractAmount,
        totalPaid,
        netDebt, // > 0 means debtor (بدهکار), < 0 means creditor (طلبکار/اضافه پرداخت)
        isDebtor: netDebt > 0,
        isCreditor: netDebt < 0,
        displayAmount: Math.abs(netDebt)
      };
    }
    const bal = Number(c.balance || 0);
    return {
      isPreBuyer: c.role === "pre_buyer",
      totalContractAmount: 0,
      totalPaid: 0,
      netDebt: c.role === "pre_buyer" ? bal : -bal,
      isDebtor: c.role === "pre_buyer" ? bal > 0 : bal < 0,
      isCreditor: c.role === "pre_buyer" ? bal < 0 : bal > 0,
      displayAmount: Math.abs(bal)
    };
  };

  const filteredContacts = contactsList.filter(c => {
    if (contactRoleFilter !== "all" && c.role !== contactRoleFilter) return false;
    const summary = getContactAccountingSummary(c);
    if (contactBalanceFilter === "debtor" && !summary.isDebtor) return false;
    if (contactBalanceFilter === "creditor" && !summary.isCreditor) return false;
    if (contactBalanceFilter === "settled" && summary.displayAmount !== 0) return false;
    if (contactSearch.trim()) {
      const q = toEnglishDigits(contactSearch).trim().toLowerCase();
      const matchName = (c.name || "").toLowerCase().includes(q);
      const matchPhone = toEnglishDigits(c.phone || "").toLowerCase().includes(q);
      const matchNat = toEnglishDigits(c.nationalId || "").toLowerCase().includes(q);
      const matchJob = (c.jobCategory || "").toLowerCase().includes(q);
      if (!matchName && !matchPhone && !matchNat && !matchJob) return false;
    }
    return true;
  });

  const handlePrintContacts = (mode: "after_filter" | "before_filter") => {
    const source = mode === "after_filter" ? filteredContacts : contactsList;
    printStructuredReport({
      title: "گزارش طرف حساب‌ها و وضعیت بدهی / طلبکاری",
      subtitle: "فهرست اشخاص حقیقی، حقوقی، پیمانکاران و پیش‌خریداران",
      mode,
      filterDescription: mode === "after_filter"
        ? `جستجو: ${contactSearch || "همه"} | نقش: ${contactRoleFilter === "all" ? "همه" : contactRoleFilter} | وضعیت حساب: ${contactBalanceFilter === "all" ? "همه" : contactBalanceFilter}`
        : undefined,
      columns: [
        { header: "ردیف", accessor: r => r.idx, align: "center" },
        { header: "نام طرف حساب", accessor: r => r.name },
        { header: "نقش", accessor: r => r.roleLabel, align: "center" },
        { header: "شماره تماس", accessor: r => r.phone, align: "center" },
        { header: "کد ملی", accessor: r => r.nationalId, align: "center" },
        { header: "کل قرارداد / آورده", accessor: r => r.contractInfo, align: "center" },
        { header: "وضعیت نهایی حساب (ریال)", accessor: r => r.statusText, align: "left" },
      ],
      rows: source.map((c, idx) => {
        const s = getContactAccountingSummary(c);
        const roleLabel = c.role === "pre_buyer" ? "پیش‌خریدار" : c.role === "supplier" ? "تأمین‌کننده" : c.role === "subcontractor" ? "پیمانکار" : c.role === "imprest_holder" ? "تنخواه‌دار" : c.role;
        const statusText = s.displayAmount === 0
          ? "تسویه (۰ ریال)"
          : s.isDebtor
            ? `${s.displayAmount.toLocaleString("fa-IR")} ریال (بدهکار)`
            : `${s.displayAmount.toLocaleString("fa-IR")} ریال (طلبکار)`;
        return {
          idx: (idx + 1).toLocaleString("fa-IR"),
          name: c.name,
          roleLabel,
          phone: c.phone || "—",
          nationalId: c.nationalId || "—",
          contractInfo: s.totalContractAmount > 0 ? `قرارداد: ${s.totalContractAmount.toLocaleString("fa-IR")} | پرداختی: ${s.totalPaid.toLocaleString("fa-IR")}` : "—",
          statusText
        };
      }),
      summaryItems: [
        { label: "تعداد طرف حساب‌ها", value: `${source.length.toLocaleString("fa-IR")} نفر` }
      ]
    });
  };

  return (
    <div className="space-y-6" dir="rtl">
      {/* Top Banner section */}
      <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-slate-900">قراردادها، طرف حساب‌ها و تنخواه گردان</h2>
            <p className="text-xs text-slate-500 mt-1">مدیریت کامل حساب خریداران پیش‌فروش، تدارکات مصالح، ناظرین پروژه و پیگیری اقساط</p>
          </div>
          {/* Quick stats indicators */}
          <div className="flex gap-4">
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-2.5 text-center">
              <span className="text-[10px] text-indigo-500 block font-bold">پیش‌خریداران فعال</span>
              <span className="text-lg font-extrabold text-indigo-950 mt-1 block">
                {contactsList.filter(c => c.role === "pre_buyer").length.toLocaleString("fa-IR")} نفر
              </span>
            </div>
            <div className="bg-amber-50 border border-amber-100 rounded-xl px-4 py-2.5 text-center">
              <span className="text-[10px] text-amber-500 block font-bold">تنخواه‌گردان‌های فعال</span>
              <span className="text-lg font-extrabold text-amber-950 mt-1 block">
                {imprestList.filter(f => f.status === "active").length.toLocaleString("fa-IR")} کارگاه
              </span>
            </div>
          </div>
        </div>

        {/* Sub-Tabs Navigations */}
        <div className="flex flex-wrap gap-2 mt-6 border-t border-slate-100 pt-4">
          <button
            onClick={() => setSubTab("contacts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === "contacts" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Users className="w-4 h-4" />
            طرف حساب‌های سازه
          </button>
          <button
            onClick={() => setSubTab("imprests")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === "imprests" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <Wallet className="w-4 h-4" />
            تنخواه گردان کارگاه
          </button>
          <button
            onClick={() => setSubTab("presales")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === "presales" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <FileText className="w-4 h-4" />
            قراردادهای پیش‌فروش واحدها
          </button>
          <button
            onClick={() => setSubTab("alerts")}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === "alerts" ? "bg-slate-900 text-white shadow-xs" : "bg-slate-50 text-slate-600 hover:bg-slate-100"
            }`}
          >
            <MessageSquare className="w-4 h-4" />
            پنل پیامک و اطلاع‌رسانی هوشمند
          </button>
        </div>
      </div>

      {/* Dynamic Alerts */}
      {successMsg && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <CheckCircle className="w-4 h-4 text-emerald-600" />
          <span>{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-800 text-xs px-4 py-3 rounded-xl flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-600" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* --- SUB-TAB: CONTACTS --- */}
      {subTab === "contacts" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* New Contact Creation Form */}
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm self-start">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <UserPlus className="w-4 h-4 text-indigo-600" />
              {editingContactId ? "ویرایش طرف حساب" : "تعریف طرف حساب جدید"}
            </h3>

            <form onSubmit={handleCreateContact} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">نام و نام خانوادگی / شرکت</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مهندس رادمان، شرکت آجر سفال اصفهان"
                  value={contactForm.name}
                  onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">تلفن همراه</label>
                  <input
                    type="text"
                    placeholder="۰۹۱۲۳۴۵۶۷۸۹"
                    value={contactForm.phone}
                    onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نقش در پروژه (قابل سرچ و تعریف)</label>
                  <select
                    value={contactForm.role}
                    onChange={e => setContactForm({ ...contactForm, role: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none"
                  >
                    <option value="supplier">تأمین‌کننده مصالح و کالا</option>
                    <option value="subcontractor">پیمانکار اجرایی ساختمان</option>
                    <option value="imprest_holder">تنخواه‌دار / ناظر کارگاه</option>
                    <option value="pre_buyer">پیش‌خریدار واحد مسکونی</option>
                    <option value="admin">سایر / اداری</option>
                    <option value="custom">نقش جدید / سفارشی (تایپ کنید)...</option>
                  </select>
                </div>
              </div>

              {contactForm.role === "custom" && (
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-1">
                  <label className="text-[10px] text-indigo-700 font-bold block">تعریف عنوان نقش جدید</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: برق‌کار ساختمان، لوله‌کش"
                    value={inlineCustomRoleInput}
                    onChange={e => setInlineCustomRoleInput(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">صنف کاری طرف حساب</label>
                  <input
                    type="text"
                    placeholder="مثال: آهن آلات، سیمان‌کار، تاسیسات"
                    value={contactForm.jobCategory}
                    onChange={e => setContactForm({ ...contactForm, jobCategory: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نام بانک</label>
                  <input
                    type="text"
                    placeholder="مثال: ملی، ملت، سامان"
                    value={contactForm.bankName}
                    onChange={e => setContactForm({ ...contactForm, bankName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">کد ملی / شناسه ملی</label>
                  <input
                    type="text"
                    placeholder="شناسه ملی ده رقمی"
                    value={contactForm.nationalId}
                    onChange={e => setContactForm({ ...contactForm, nationalId: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره کارت بانکی</label>
                  <input
                    type="text"
                    placeholder="شماره کارت ۱۶ رقمی"
                    value={contactForm.bankCardNumber}
                    onChange={e => setContactForm({ ...contactForm, bankCardNumber: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره شبا (IBAN)</label>
                  <input
                    type="text"
                    placeholder="مثال: IR12..."
                    value={contactForm.bankIBAN}
                    onChange={e => setContactForm({ ...contactForm, bankIBAN: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left font-mono focus:outline-none"
                  />
                </div>
                 <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">مانده اولیه (ریال)</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="مثال: -500000000"
                    value={contactForm.balance}
                    onChange={e => setContactForm({ ...contactForm, balance: toEnglishDigits(e.target.value).replace(/[^0-9.-]/g, "") })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none font-mono"
                  />
                  {contactForm.balance && Number(contactForm.balance) !== 0 && (
                    <div className={`text-[9px] font-bold mt-1 px-1.5 py-0.5 rounded ${Number(contactForm.balance) > 0 ? "text-emerald-700 bg-emerald-50 border border-emerald-150" : "text-rose-700 bg-rose-50 border border-rose-150"}`}>
                      ✍️ {numberToPersianWords(Math.abs(Number(contactForm.balance)))} ریال {Number(contactForm.balance) > 0 ? "(طلبکار)" : "(بدهکار)"}
                      <div className="mt-0.5 font-light">عددی: {Math.abs(Number(contactForm.balance)).toLocaleString("fa-IR")} ریال</div>
                    </div>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-slate-900 hover:bg-slate-850 text-white rounded-xl py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSubmitting ? "در حال ثبت..." : (editingContactId ? "بروزرسانی اطلاعات طرف حساب" : "افزودن به لیست طرف حساب‌ها")}
              </button>

              {editingContactId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingContactId(null);
                    setContactForm({
                      name: "",
                      phone: "",
                      role: "supplier",
                      nationalId: "",
                      bankCardNumber: "",
                      bankName: "",
                      bankIBAN: "",
                      jobCategory: "",
                      balance: ""
                    });
                    setInlineCustomRoleInput("");
                  }}
                  className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl py-2 text-xs font-bold transition-all cursor-pointer mt-2 block"
                >
                  انصراف از ویرایش
                </button>
              )}
            </form>
          </div>

           {/* Counterparties list table */}
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900">لیست تفصیلی طرف حساب‌های حقیقی و حقوقی</h3>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  نمایش {filteredContacts.length.toLocaleString("fa-IR")} از {contactsList.length.toLocaleString("fa-IR")} طرف حساب
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => handlePrintContacts("after_filter")}
                  className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Printer className="w-3.5 h-3.5" />
                  چاپ نتایج فیلتر شده (بعد از فیلتر)
                </button>
                <button
                  type="button"
                  onClick={() => handlePrintContacts("before_filter")}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Printer className="w-3.5 h-3.5" />
                  چاپ کل اطلاعات (قبل از فیلتر)
                </button>
              </div>
            </div>

            {/* Search & Advanced Search Bar for Contacts */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={contactSearch}
                    onChange={e => setContactSearch(e.target.value)}
                    placeholder="جستجو بر اساس نام، شماره تماس، کد ملی یا صنف کاری..."
                    className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowContactAdv(!showContactAdv)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer transition-all ${
                    showContactAdv ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-700 hover:bg-slate-100"
                  }`}
                >
                  <SlidersHorizontal className="w-3.5 h-3.5" />
                  جستجوی پیشرفته
                </button>
              </div>
              {showContactAdv && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">فیلتر نقش طرف حساب</label>
                    <select
                      value={contactRoleFilter}
                      onChange={e => setContactRoleFilter(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <option value="all">همه نقش‌ها</option>
                      <option value="pre_buyer">پیش‌خریدار واحد مسکونی</option>
                      <option value="supplier">تأمین‌کننده مصالح</option>
                      <option value="subcontractor">پیمانکار اجرایی</option>
                      <option value="imprest_holder">تنخواه‌دار کارگاه</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 block mb-1">فیلتر وضعیت بدهی / طلبکاری</label>
                    <select
                      value={contactBalanceFilter}
                      onChange={e => setContactBalanceFilter(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                    >
                      <option value="all">همه وضعیت‌ها</option>
                      <option value="debtor">فقط بدهکاران (بدهکار به شرکت)</option>
                      <option value="creditor">فقط طلبکاران (بستانکار از شرکت)</option>
                      <option value="settled">تسویه شده (بی‌حساب)</option>
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      onClick={() => {
                        setContactSearch("");
                        setContactRoleFilter("all");
                        setContactBalanceFilter("all");
                      }}
                      className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      پاک کردن فیلترها
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-right border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold">
                    <th className="p-3">نام طرف حساب</th>
                    <th className="p-3">نقش</th>
                    <th className="p-3 text-center">شماره تماس</th>
                    <th className="p-3 text-left">وضعیت بدهی / طلبکاری</th>
                    <th className="p-3 text-center">عملیات پیامک</th>
                    <th className="p-3 text-center">عملیات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredContacts.map(c => {
                    const summary = getContactAccountingSummary(c);
                    const balanceAbs = summary.displayAmount;
                    return (
                      <tr key={c.id} className="hover:bg-slate-50/50">
                        <td className="p-3">
                          <span className="font-extrabold text-slate-900 block">{c.name}</span>
                          <span className="text-[10px] text-slate-400 mt-0.5 block font-light">
                            کد ملی: {c.nationalId || "ثبت نشده"} | کارت: {c.bankCardNumber || "ثبت نشده"}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                            c.role === "pre_buyer" ? "bg-indigo-50 text-indigo-700" :
                            c.role === "supplier" ? "bg-amber-50 text-amber-700" :
                            c.role === "subcontractor" ? "bg-emerald-50 text-emerald-700" : "bg-purple-50 text-purple-700"
                          }`}>
                            {c.role === "pre_buyer" ? "پیش‌خریدار" :
                             c.role === "supplier" ? "تأمین‌کننده مصالح" :
                             c.role === "subcontractor" ? "پیمانکار ثانویه" : "تنخواه‌گردان"}
                          </span>
                        </td>
                        <td className="p-3 text-center font-mono text-slate-600">{c.phone || "-"}</td>
                        <td className="p-3 text-left font-extrabold font-mono">
                          {balanceAbs === 0 ? (
                            <span className="text-slate-400">تسویه شده (بی‌حساب)</span>
                          ) : summary.isDebtor ? (
                            <div className="flex flex-col items-end">
                              <span className="text-rose-600 flex items-center justify-end gap-1">
                                {formatRial(balanceAbs)} - ({summary.totalContractAmount > 0 ? "بدهکار قرارداد" : "بدهکار"})
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                              </span>
                              {summary.totalContractAmount > 0 && (
                                <span className="text-[9px] text-slate-500 font-normal mt-0.5">
                                  کل قرارداد: {formatRial(summary.totalContractAmount)} | پرداختی (آورده): {formatRial(summary.totalPaid)}
                                </span>
                              )}
                            </div>
                          ) : (
                            <div className="flex flex-col items-end">
                              <span className="text-emerald-600 flex items-center justify-end gap-1">
                                {formatRial(balanceAbs)} + (طلبکار / بستانکار)
                                <ArrowUpRight className="w-3.5 h-3.5" />
                              </span>
                              {summary.totalContractAmount > 0 && (
                                <span className="text-[9px] text-slate-500 font-normal mt-0.5">
                                  کل قرارداد: {formatRial(summary.totalContractAmount)} | پرداختی: {formatRial(summary.totalPaid)}
                                </span>
                              )}
                            </div>
                          )}
                        </td>
                        <td className="p-3 text-center">
                          {c.phone ? (
                            <button
                              onClick={() => handleSendSMS(
                                "check",
                                c.phone,
                                `جناب آقای/سرکار خانم ${c.name}، مانده بدهی حساب شما به مبلغ ${formatRial(balanceAbs)} می‌باشد. خواهشمند است با بخش حسابداری تماس حاصل فرمایید.`,
                                c.id
                              )}
                              className="p-1 hover:bg-indigo-50 text-indigo-600 rounded-lg cursor-pointer transition-colors"
                              title="ارسال پیامک صورت‌حساب"
                            >
                              <Bell className="w-4 h-4" />
                            </button>
                          ) : "-"}
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1.5">
                            <button
                              onClick={() => handleEditContactClick(c)}
                              className="p-1 hover:bg-amber-50 text-amber-600 rounded-lg cursor-pointer transition-colors"
                              title="ویرایش اطلاعات طرف حساب"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteContactClick(c.id, c.name)}
                              className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer transition-colors"
                              title="حذف طرف حساب"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* --- SUB-TAB: IMPRESTS --- */}
      {subTab === "imprests" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Create Imprest or Record Expense Forms */}
          <div className="space-y-6 self-start">
            {/* Create Petty Cash Box */}
            <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Wallet className="w-4 h-4 text-emerald-600" />
                تخصیص تنخواه‌گردان جدید
              </h3>
              <form onSubmit={handleCreateImprest} className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">انتخاب پروژه هدف</label>
                  <SearchableCombobox
                    options={projects.map(p => ({ value: p.id, label: p.name }))}
                    value={imprestForm.projectId}
                    onChange={val => setImprestForm({ ...imprestForm, projectId: val })}
                    allowCustom={true}
                    onCustomClick={(term) => {
                      setProjectModalName(term);
                      setProjectModalAddress("");
                      setProjectModalBudget("");
                      setProjectModalArea("");
                      setModalTriggerOrigin("imprest_project");
                      setShowProjectModal(true);
                    }}
                    placeholder="جستجو یا افزودن پروژه..."
                    customAddLabel="افزودن و تعریف پروژه جدید"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">تنخواه‌دار مسئول (از لیست طرف حساب‌ها)</label>
                  <SearchableCombobox
                    options={contactsList.filter(c => c.role === "imprest_holder").map(c => ({ value: c.id, label: c.name, subLabel: c.phone || "بدون شماره" }))}
                    value={imprestForm.contactId}
                    onChange={val => setImprestForm({ ...imprestForm, contactId: val })}
                    allowCustom={true}
                    onCustomClick={(term) => {
                      setContactModalName(term);
                      setContactModalPhone("");
                      setContactModalRole("imprest_holder");
                      setContactModalNationalId("");
                      setContactModalCardNumber("");
                      setContactModalBalance("0");
                      setModalTriggerOrigin("imprest_contact");
                      setShowContactModal(true);
                    }}
                    placeholder="جستجو یا تعریف ناظر جدید..."
                    customAddLabel="افزودن و تعریف تنخواه‌دار جدید"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">سقف شارژ مصوب صندوق (ریال)</label>
                  <FormattedAmountInput
                    required
                    placeholder="مثال: ۵۰۰۰۰۰۰۰۰"
                    value={imprestForm.allocatedLimit}
                    onChange={val => setImprestForm({ ...imprestForm, allocatedLimit: val })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                >
                  صداگذاری و شارژ صندوق تنخواه
                </button>
              </form>
            </div>

            {/* Record Expense from active petty cash box */}
            <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Plus className="w-4 h-4 text-emerald-600" />
                ثبت هزینه جدید توسط تنخواه‌دار
              </h3>
              <form onSubmit={handleRecordExpense} className="space-y-4">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">انتخاب صندوق تنخواه فعال</label>
                  <SearchableCombobox
                    options={imprestList.map(im => {
                      const c = contactsList.find(contact => contact.id === im.contactId);
                      const p = projects.find(project => project.id === im.projectId);
                      return {
                        value: im.id,
                        label: `${c ? c.name : "ناظر"} - ${p ? p.name.slice(0, 15) : "پروژه"}`,
                        subLabel: `موجودی: ${formatRial(im.balance)}`
                      };
                    })}
                    value={expenseForm.imprestId}
                    onChange={val => {
                      setExpenseForm(prev => ({ ...prev, imprestId: val }));
                      setActiveImprestId(val);
                    }}
                    placeholder="جستجوی صندوق تنخواه فعال..."
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">طرف حساب فروشنده فاکتور</label>
                  <SearchableCombobox
                    options={contactsList.map(c => ({ 
                      value: c.id, 
                      label: c.name, 
                      subLabel: `${c.phone || "بدون تلفن"} | ${c.role === "supplier" ? "تأمین‌کننده" : c.role === "subcontractor" ? "پیمانکار" : "سایر"}` 
                    }))}
                    value={expenseForm.contactId}
                    onChange={val => {
                      const contactObj = contactsList.find(c => c.id === val);
                      setExpenseForm(prev => ({ 
                        ...prev, 
                        contactId: val, 
                        personName: contactObj ? contactObj.name : val 
                      }));
                    }}
                    allowCustom={true}
                    onCustomClick={(term) => {
                      setContactModalName(term);
                      setContactModalPhone("");
                      setContactModalRole("supplier");
                      setContactModalNationalId("");
                      setContactModalCardNumber("");
                      setContactModalBalance("0");
                      setModalTriggerOrigin("expense_contact");
                      setShowContactModal(true);
                    }}
                    placeholder="جستجو یا افزودن فروشنده..."
                    customAddLabel="تعریف و افزودن فروشنده جدید"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نوع مصالح / دسته‌بندی فاکتور</label>
                  <SearchableCombobox
                    options={materialCategories}
                    value={expenseForm.materialCategory}
                    onChange={val => setExpenseForm(prev => ({ ...prev, materialCategory: val }))}
                    allowCustom={true}
                    onCustomAdd={(name) => {
                      setMaterialCategories(prev => [...prev, { value: name, label: name }]);
                      setExpenseForm(prev => ({ ...prev, materialCategory: name }));
                      return true;
                    }}
                    placeholder="جستجو یا دسته‌بندی جدید..."
                    customAddLabel="افزودن دسته‌بندی فرعی جدید"
                  />
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">مرحله ساخت / فاز اجرا</label>
                  <SearchableCombobox
                    options={constructionStages}
                    value={expenseForm.stage}
                    onChange={val => setExpenseForm(prev => ({ ...prev, stage: val }))}
                    allowCustom={true}
                    onCustomAdd={(name) => {
                      setConstructionStages(prev => [...prev, { value: name, label: name }]);
                      setExpenseForm(prev => ({ ...prev, stage: name }));
                      return true;
                    }}
                    placeholder="جستجو یا فاز ساخت جدید..."
                    customAddLabel="افزودن فاز ساخت جدید"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره فاکتور</label>
                    <input
                      type="text"
                      placeholder="مثال: ۱۰۴۵"
                      value={expenseForm.invoiceNumber}
                      onChange={e => setExpenseForm({ ...expenseForm, invoiceNumber: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">شرح دقیق هزینه / شرح فاکتور *</label>
                    <input
                      type="text"
                      required
                      placeholder="مثال: خرید میخ و سیم آرماتوربندی کارگاه"
                      value={expenseForm.description}
                      onChange={e => setExpenseForm({ ...expenseForm, description: e.target.value })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">مبلغ کل فاکتور (ریال)</label>
                    <FormattedAmountInput
                      required
                      placeholder="مثال: ۵۰۰۰۰۰۰۰"
                      value={expenseForm.amount}
                      onChange={val => setExpenseForm({ ...expenseForm, amount: val })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 font-bold block mb-1">تاریخ خرج کرد</label>
                    <ShamsiDatePicker
                      value={expenseForm.expenseDate}
                      onChange={val => setExpenseForm({ ...expenseForm, expenseDate: val })}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-center focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">وضعیت پرداخت فاکتور از تنخواه</label>
                  <select
                    value={expenseForm.paymentStatus}
                    onChange={e => {
                      const val = e.target.value as "paid" | "partially_paid" | "unpaid";
                      setExpenseForm(prev => ({ 
                        ...prev, 
                        paymentStatus: val,
                        paidAmount: val === "paid" ? prev.amount : val === "unpaid" ? "0" : ""
                      }));
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none"
                  >
                    <option value="paid">تسویه کامل نقدی فاکتور از تنخواه</option>
                    <option value="partially_paid">پرداخت جزئی / تصفیه چند مرحله‌ای</option>
                    <option value="unpaid">پرداخت‌نشده / نسیه کامل (ثبت بدهی کارگاه)</option>
                  </select>
                </div>

                {expenseForm.paymentStatus === "partially_paid" && (
                  <div>
                    <label className="text-[10px] text-rose-500 font-bold block mb-1">مبلغ پرداخت شده فعلی از صندوق (ریال)</label>
                    <FormattedAmountInput
                      required
                      placeholder="مبلغ پرداختی به ریال"
                      value={expenseForm.paidAmount}
                      onChange={val => setExpenseForm(prev => ({ ...prev, paidAmount: val }))}
                      className="w-full bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                )}

                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">تصویر سند / فاکتور خرید (درگ یا انتخاب)</label>
                  <div 
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => {
                      e.preventDefault();
                      const file = e.dataTransfer.files[0];
                      if (file) {
                        const reader = new FileReader();
                        reader.onload = () => {
                          setExpenseForm(prev => ({ 
                            ...prev, 
                            attachmentName: file.name,
                            attachmentData: reader.result as string 
                          }));
                        };
                        reader.readAsDataURL(file);
                      }
                    }}
                    className="border border-dashed border-slate-300 hover:border-indigo-500 rounded-xl p-3 text-center cursor-pointer bg-slate-50 hover:bg-indigo-50/10 transition-colors"
                  >
                    <input 
                      type="file" 
                      id="expense_attach_file" 
                      className="hidden" 
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onload = () => {
                            setExpenseForm(prev => ({ 
                              ...prev, 
                              attachmentName: file.name,
                              attachmentData: reader.result as string 
                            }));
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                    />
                    <label htmlFor="expense_attach_file" className="cursor-pointer block text-[10px] text-slate-500">
                      <Paperclip className="w-4 h-4 mx-auto mb-1 text-slate-400" />
                      {expenseForm.attachmentName ? (
                        <span className="font-bold text-emerald-600 block truncate">{expenseForm.attachmentName} (پیوست شد)</span>
                      ) : (
                        "انتخاب یا رها کردن عکس فاکتور (درگ)"
                      )}
                    </label>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-slate-900 hover:bg-slate-850 text-white rounded-xl py-2 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
                >
                  ثبت هزینه فاکتور و کاهش موجودی تنخواه
                </button>
              </form>
            </div>
          </div>

          {/* Active Petty Cash Boxes Table */}
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-900 mb-4">صندوق‌های فعال تنخواه کارگاه‌ها و پروژه‌ها</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {imprestList.map(im => {
                  const supervisor = contactsList.find(c => c.id === im.contactId);
                  const proj = projects.find(p => p.id === im.projectId);
                  const isLocked = im.status === "locked";
                  return (
                    <div key={im.id} className="border border-slate-150 rounded-2xl p-4 space-y-3 shadow-2xs hover:shadow-xs transition-shadow">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-extrabold text-xs text-slate-900">{supervisor?.name || "ناظر مسئول"}</h4>
                          <span className="text-[10px] text-slate-400 mt-1 block">{proj?.name || "پروژه تعریف نشده"}</span>
                        </div>
                        <div className="flex gap-1">
                          <button
                            type="button"
                            onClick={() => handleLockImprest(im.id, im.status)}
                            className={`p-1.5 rounded-lg border flex items-center gap-1 text-[10px] font-bold cursor-pointer transition-colors ${
                              isLocked 
                                ? "bg-rose-50 border-rose-200 text-rose-700 hover:bg-rose-100" 
                                : "bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100"
                            }`}
                          >
                            {isLocked ? (
                              <>
                                <Lock className="w-3.5 h-3.5" />
                                قفل شده
                              </>
                            ) : (
                              <>
                                <Unlock className="w-3.5 h-3.5" />
                                فعال و باز
                              </>
                            )}
                          </button>
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm("آیا از حذف این تنخواه‌گردان اطمینان دارید؟ تمامی هزینه‌های تابعه نیز حذف خواهند شد.")) return;
                              try {
                                const res = await fetch(getApiUrl("/api/imprests/delete"), {
                                  method: "POST",
                                  headers: { "Content-Type": "application/json" },
                                  body: JSON.stringify({ id: im.id })
                                });
                                const data = await res.json();
                                if (data.status === "success") {
                                  await onRefresh();
                                } else {
                                  alert(data.error || "خطا در حذف تنخواه");
                                }
                              } catch (err: any) {
                                alert("خطا: " + err.message);
                              }
                            }}
                            className="p-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                            title="حذف تنخواه‌گردان"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                        <div>
                          <span className="text-slate-400 block mb-0.5">سقف اعتبار تخصیصی</span>
                          <span className="font-extrabold text-slate-800 font-mono">{formatRial(im.allocatedLimit)}</span>
                        </div>
                        <div>
                          <span className="text-slate-400 block mb-0.5">موجودی فعلی تنخواه</span>
                          <span className={`font-extrabold font-mono ${im.balance < im.allocatedLimit * 0.1 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {formatRial(im.balance)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Imprest Expenses History List */}
            {(() => {
              const allImprestExpenses = db.imprestExpenses || [];
              const filteredImprestExpenses = allImprestExpenses.filter(ie => {
                const fund = imprestList.find(f => f.id === ie.imprestId);
                if (imprestProjectFilter !== "all" && fund?.projectId !== imprestProjectFilter) return false;
                if (imprestPaymentFilter !== "all" && ie.paymentStatus !== imprestPaymentFilter) return false;
                if (imprestSearch.trim()) {
                  const q = toEnglishDigits(imprestSearch).trim().toLowerCase();
                  const supervisor = fund ? contactsList.find(c => c.id === fund.contactId) : null;
                  const vendor = contactsList.find(c => c.id === ie.contactId);
                  const matchDesc = (ie.description || "").toLowerCase().includes(q);
                  const matchInv = toEnglishDigits(ie.invoiceNumber || "").toLowerCase().includes(q);
                  const matchSup = (supervisor?.name || "").toLowerCase().includes(q);
                  const matchVen = (ie.personName || vendor?.name || "").toLowerCase().includes(q);
                  const matchCat = (ie.materialCategory || "").toLowerCase().includes(q);
                  if (!matchDesc && !matchInv && !matchSup && !matchVen && !matchCat) return false;
                }
                return true;
              });

              const handlePrintImprestExpenses = (mode: "after_filter" | "before_filter") => {
                const source = mode === "after_filter" ? filteredImprestExpenses : allImprestExpenses;
                printStructuredReport({
                  title: "گزارش فاکتورها و هزینه‌های تنخواه‌داران کارگاه",
                  subtitle: "فهرست ریز مخارج ثبت شده از صندوق‌های تنخواه",
                  mode,
                  filterDescription: mode === "after_filter"
                    ? `جستجو: ${imprestSearch || "همه"} | پروژه: ${imprestProjectFilter === "all" ? "همه" : (projects.find(p => p.id === imprestProjectFilter)?.name || imprestProjectFilter)} | وضعیت پرداخت: ${imprestPaymentFilter}`
                    : undefined,
                  columns: [
                    { header: "ردیف", accessor: r => r.idx, align: "center" },
                    { header: "شماره فاکتور", accessor: r => r.invoiceNumber, align: "center" },
                    { header: "ناظر تنخواه‌دار", accessor: r => r.supervisor },
                    { header: "فروشنده / طرف حساب", accessor: r => r.vendor },
                    { header: "شرح فاکتور", accessor: r => r.description },
                    { header: "تاریخ", accessor: r => r.date, align: "center" },
                    { header: "مبلغ فاکتور (ریال)", accessor: r => r.amount, align: "left" },
                    { header: "وضعیت", accessor: r => r.status, align: "center" },
                  ],
                  rows: source.map((ie, idx) => {
                    const fund = imprestList.find(f => f.id === ie.imprestId);
                    const supervisor = fund ? contactsList.find(c => c.id === fund.contactId) : null;
                    const vendor = contactsList.find(c => c.id === ie.contactId);
                    return {
                      idx: (idx + 1).toLocaleString("fa-IR"),
                      invoiceNumber: ie.invoiceNumber || "—",
                      supervisor: supervisor?.name || "ناظر کارگاه",
                      vendor: ie.personName || vendor?.name || "بازار",
                      description: ie.description,
                      date: ie.expenseDate,
                      amount: Number(ie.amount || 0).toLocaleString("fa-IR"),
                      status: ie.paymentStatus === "paid" ? "تسویه کامل" : ie.paymentStatus === "unpaid" ? "نسیه" : "پرداخت جزئی"
                    };
                  }),
                  summaryItems: [
                    { label: "تعداد فاکتورها", value: `${source.length.toLocaleString("fa-IR")} فقره` },
                    { label: "جمع کل فاکتورهای تنخواه", value: `${source.reduce((s, x) => s + Number(x.amount || 0), 0).toLocaleString("fa-IR")} ریال` }
                  ]
                });
              };

              return (
                <div className="border-t border-slate-100 pt-6 space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">فهرست آخرین اقلام هزینه و فاکتورهای تنخواه‌داران</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        نمایش {filteredImprestExpenses.length.toLocaleString("fa-IR")} از {allImprestExpenses.length.toLocaleString("fa-IR")} فاکتور تنخواه
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePrintImprestExpenses("after_filter")}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        چاپ نتایج فیلتر شده (بعد از فیلتر)
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintImprestExpenses("before_filter")}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        چاپ کل اطلاعات (قبل از فیلتر)
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={imprestSearch}
                          onChange={e => setImprestSearch(e.target.value)}
                          placeholder="جستجو بر اساس شماره فاکتور، شرح هزینه، ناظر یا فروشنده..."
                          className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowImprestAdv(!showImprestAdv)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                          showImprestAdv ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        جستجوی پیشرفته
                      </button>
                    </div>
                    {showImprestAdv && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">پروژه</label>
                          <select
                            value={imprestProjectFilter}
                            onChange={e => setImprestProjectFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            <option value="all">همه پروژه‌ها</option>
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">وضعیت پرداخت</label>
                          <select
                            value={imprestPaymentFilter}
                            onChange={e => setImprestPaymentFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            <option value="all">همه وضعیت‌ها</option>
                            <option value="paid">تسویه کامل</option>
                            <option value="partially_paid">پرداخت جزئی</option>
                            <option value="unpaid">نسیه پرداخت‌نشده</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => {
                              setImprestSearch("");
                              setImprestProjectFilter("all");
                              setImprestPaymentFilter("all");
                            }}
                            className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            پاک کردن فیلترها
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold">
                          <th className="p-2.5 text-center">ردیف</th>
                          <th className="p-2.5 text-center">شماره فاکتور</th>
                          <th className="p-2.5">ناظر تنخواه‌دار</th>
                          <th className="p-2.5">طرف حساب فروشنده</th>
                          <th className="p-2.5">شرح فاکتور</th>
                          <th className="p-2.5 text-center">تاریخ</th>
                          <th className="p-2.5">دسته‌بندی</th>
                          <th className="p-2.5 text-left">مبلغ کل هزینه</th>
                          <th className="p-2.5 text-center">وضعیت پرداخت</th>
                          <th className="p-2.5 text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredImprestExpenses.length === 0 ? (
                          <tr>
                            <td colSpan={10} className="text-center py-8 text-slate-400 font-light text-sm">هیچ هزینه تنخواهی یافت نشد.</td>
                          </tr>
                        ) : (
                          filteredImprestExpenses.map((ie, idx) => {
                            const fund = imprestList.find(f => f.id === ie.imprestId);
                            const supervisor = fund ? contactsList.find(c => c.id === fund.contactId) : null;
                            const vendor = contactsList.find(c => c.id === ie.contactId);
                            
                            const totalPaid = ie.payments?.reduce((sum, p) => sum + p.amount, 0) || (ie.paymentStatus === "paid" ? ie.amount : 0);
                            const remaining = Math.max(0, ie.amount - totalPaid);
                            
                            return (
                              <tr key={ie.id} className="hover:bg-slate-50/50">
                                <td className="p-2.5 text-center font-mono font-bold text-slate-500">{(idx + 1).toLocaleString("fa-IR")}</td>
                                <td className="p-2.5 text-center font-mono font-bold text-indigo-700">{ie.invoiceNumber || "—"}</td>
                                <td className="p-2.5">
                                  <span className="font-bold text-slate-800 block">{supervisor?.name || "ناظر کارگاه"}</span>
                                  <span className="text-[9px] text-slate-400 font-light block">پروژه {projects.find(p => p.id === fund?.projectId)?.name || "عمومی"}</span>
                                </td>
                                <td className="p-2.5">
                                  <span className="font-extrabold text-slate-900 block">{ie.personName || vendor?.name || "بازار/سایر"}</span>
                                  {ie.stage && (
                                    <span className="text-[9px] text-indigo-600 font-medium block">مرحله: {ie.stage}</span>
                                  )}
                                </td>
                                <td className="p-2.5 text-slate-700">
                                  <span className="block truncate max-w-[160px]" title={ie.description}>
                                    {ie.description}
                                  </span>
                                  {ie.attachmentName && (
                                    <span className="inline-flex items-center gap-1 text-[9px] text-emerald-600 bg-emerald-50 px-1 rounded mt-0.5 font-bold">
                                      <Paperclip className="w-2.5 h-2.5" />
                                      فاکتور پیوست شده
                                    </span>
                                  )}
                                </td>
                                <td className="p-2.5 text-center text-slate-500 font-mono">{ie.expenseDate}</td>
                                <td className="p-2.5">
                                  <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600">
                                    {ie.materialCategory || "سایر"}
                                  </span>
                                </td>
                                <td className="p-2.5 text-left font-extrabold text-rose-600 font-mono">
                                  {formatRial(ie.amount)}
                                </td>
                                <td className="p-2.5 text-center">
                                  {ie.paymentStatus === "paid" ? (
                                    <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-emerald-50 text-emerald-700">
                                      تسویه کامل
                                    </span>
                                  ) : ie.paymentStatus === "unpaid" ? (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-rose-50 text-rose-700">
                                        نسیه پرداخت‌نشده
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedExpenseForPay(ie)}
                                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-850 underline cursor-pointer"
                                      >
                                        ثبت پرداخت
                                      </button>
                                    </div>
                                  ) : (
                                    <div className="flex flex-col items-center gap-1">
                                      <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-700">
                                        پرداخت جزئی (مانده: {formatRial(remaining)})
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => setSelectedExpenseForPay(ie)}
                                        className="text-[9px] font-bold text-indigo-600 hover:text-indigo-850 underline cursor-pointer"
                                      >
                                        پرداخت قسط
                                      </button>
                                    </div>
                                  )}
                                </td>
                                <td className="p-2.5 text-center">
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      if (!window.confirm("آیا از حذف این فاکتور تنخواه اطمینان دارید؟")) return;
                                      try {
                                        const res = await fetch(getApiUrl("/api/imprests/expenses/delete"), {
                                          method: "POST",
                                          headers: { "Content-Type": "application/json" },
                                          body: JSON.stringify({ id: ie.id })
                                        });
                                        const data = await res.json();
                                        if (data.status === "success") {
                                          await onRefresh();
                                        } else {
                                          alert(data.error || "خطا در حذف فاکتور تنخواه");
                                        }
                                      } catch (err: any) {
                                        alert("خطا: " + err.message);
                                      }
                                    }}
                                    className="p-1 hover:bg-rose-50 text-rose-400 hover:text-rose-600 rounded-lg cursor-pointer transition-colors"
                                    title="حذف فاکتور تنخواه"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}
          </div>

            {/* Modal for paying an expense installment */}
            {selectedExpenseForPay && (
              <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 text-right">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-slate-900 text-sm">ثبت پرداخت / پرداخت قسط برای فاکتور</h4>
                    <button 
                      type="button"
                      onClick={() => setSelectedExpenseForPay(null)}
                      className="text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  
                  <div className="bg-slate-50 p-3 rounded-xl space-y-1.5 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">شرح فاکتور:</span>
                      <span className="font-bold text-slate-800">{selectedExpenseForPay.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">مبلغ کل فاکتور:</span>
                      <span className="font-bold text-slate-800 font-mono">{formatRial(selectedExpenseForPay.amount)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">پرداخت شده قبلی:</span>
                      <span className="font-bold text-emerald-600 font-mono">
                        {formatRial(
                          selectedExpenseForPay.payments?.reduce((sum, p) => sum + p.amount, 0) || 
                          (selectedExpenseForPay.paymentStatus === "paid" ? selectedExpenseForPay.amount : 0)
                        )}
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handlePayExpenseSubmit} className="space-y-3">
                    <div>
                      <label className="text-[10px] text-slate-500 font-bold block mb-1">مبلغ پرداختی این نوبت (ریال)</label>
                      <FormattedAmountInput
                        required
                        placeholder="مبلغ پرداخت قسط به ریال"
                        value={payAmount}
                        onChange={setPayAmount}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">تاریخ پرداخت</label>
                        <ShamsiDatePicker
                          required
                          value={payDate}
                          onChange={setPayDate}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-center focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره ارجاع / رسید پرداخت</label>
                        <input
                          type="text"
                          placeholder="مثال: ۱۲۳۴۵۶"
                          value={payRef}
                          onChange={e => setPayRef(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره فاکتور</label>
                        <input
                          type="text"
                          placeholder="مثال: ۱۰۴۵"
                          value={payInvoiceNum}
                          onChange={e => setPayInvoiceNum(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono focus:outline-none"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-slate-500 font-bold block mb-1">شرح فاکتور / توضیحات پرداخت</label>
                        <input
                          type="text"
                          placeholder="مثال: واریز نقدی قسط دوم خرید آهن‌آلات"
                          value={payDesc}
                          onChange={e => setPayDesc(e.target.value)}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                        />
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2 text-xs font-bold transition-all cursor-pointer"
                    >
                      {isSubmitting ? "در حال ثبت..." : "تأیید و کسر از موجودی تنخواه صندوق"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
      )}

      {/* --- SUB-TAB: PRESALES --- */}
      {subTab === "presales" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Pre-sale Contract setup form */}
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm self-start">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
              <FileText className="w-4 h-4 text-indigo-600" />
              ثبت قرارداد پیش‌فروش واحد جدید
            </h3>
            <form onSubmit={handleCreatePresale} className="space-y-4">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">انتخاب پروژه</label>
                <SearchableCombobox
                  options={projects.map(p => ({ value: p.id, label: p.name }))}
                  value={presaleForm.projectId}
                  onChange={val => setPresaleForm({ ...presaleForm, projectId: val })}
                  allowCustom={true}
                  onCustomClick={(term) => {
                    setProjectModalName(term);
                    setProjectModalAddress("");
                    setProjectModalBudget("");
                    setProjectModalArea("");
                    setModalTriggerOrigin("presale_project");
                    setShowProjectModal(true);
                  }}
                  placeholder="جستجو یا افزودن پروژه..."
                  customAddLabel="افزودن و تعریف پروژه جدید"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">پیش‌خریدار (طرف حساب از لیست)</label>
                <SearchableCombobox
                  options={contactsList.map(c => ({ value: c.id, label: c.name, subLabel: `${c.phone || "بدون شماره"} (${c.role === "pre_buyer" ? "پیش‌خریدار" : "طرف حساب"})` }))}
                  value={presaleForm.contactId}
                  onChange={val => setPresaleForm({ ...presaleForm, contactId: val })}
                  allowCustom={true}
                  onCustomClick={(term) => {
                    setContactModalName(term);
                    setContactModalPhone("");
                    setContactModalRole("pre_buyer");
                    setContactModalNationalId("");
                    setContactModalCardNumber("");
                    setContactModalBalance("0");
                    setModalTriggerOrigin("presale_contact");
                    setShowContactModal(true);
                  }}
                  placeholder="جستجو یا تعریف خریدار جدید..."
                  customAddLabel="افزودن و تعریف پیش‌خریدار جدید"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">واحد مسکونی ساختمانی *</label>
                  <select
                    required
                    value={presaleForm.unitId}
                    onChange={e => {
                      const unit = db.units.find(u => u.id === e.target.value);
                      const sType = unit?.saleAreaType || "useful";
                      const uArea = unit?.usefulArea !== undefined ? unit.usefulArea : (unit?.area || (e.target.value === "after_scoring" ? 100 : 0));
                      const stArea = unit?.storageArea || 0;
                      const pkArea = unit?.parkingArea || 0;
                      const cmArea = sType === "with_commons" ? (unit?.commonArea || 0) : 0;
                      const totalA = uArea + stArea + pkArea + cmArea;
                      setPresaleForm({
                        ...presaleForm,
                        unitId: e.target.value,
                        blockName: unit?.blockName || "",
                        saleAreaType: sType,
                        usefulArea: String(uArea || ""),
                        storageArea: String(stArea),
                        parkingArea: String(pkArea),
                        commonArea: String(cmArea),
                        contractArea: totalA > 0 ? String(totalA) : (unit ? unit.area.toString() : (e.target.value === "after_scoring" ? "100" : "")),
                        pricePerMeter: unit && unit.pricePerMeter > 0 ? unit.pricePerMeter.toString() : (e.target.value === "after_scoring" ? "40000000" : presaleForm.pricePerMeter)
                      });
                    }}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none"
                  >
                    <option value="">-- انتخاب آپارتمان‌های فروخته نشده --</option>
                    <option value="after_scoring" className="text-indigo-600 font-bold">✨ تعیین واحد مسکونی بعد از امتیازدهی (انتخاب بر اساس پرداخت‌ها)</option>
                    {db.units.filter(u => u.projectId === presaleForm.projectId && !u.isDeleted && u.status === "available").map(u => (
                      <option key={u.id} value={u.id}>
                        واحد {u.unitNumber}{u.blockName ? ` (بلوک ${u.blockName})` : ""} - طبقه {u.floor} ({u.area > 0 ? `${u.area} مترمربع` : "تعیین متراژ در قرارداد"})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">بلوک بندی (نام یا کد بلوک)</label>
                  <input
                    type="text"
                    placeholder="مثال: بلوک A یا شمالی"
                    value={presaleForm.blockName}
                    onChange={e => setPresaleForm({ ...presaleForm, blockName: e.target.value })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none"
                  />
                </div>
              </div>

              <div className="p-3.5 bg-indigo-50/40 border border-indigo-100 rounded-2xl space-y-3">
                <div>
                  <label className="text-[10px] text-indigo-900 font-extrabold block mb-1">نوع محاسبه متراژ در این قرارداد *</label>
                  <select
                    value={presaleForm.saleAreaType}
                    onChange={e => {
                      const nextType = e.target.value as "useful" | "with_commons";
                      const uA = Number(presaleForm.usefulArea) || 0;
                      const sA = Number(presaleForm.storageArea) || 0;
                      const pA = Number(presaleForm.parkingArea) || 0;
                      const cA = nextType === "with_commons" ? (Number(presaleForm.commonArea) || 0) : 0;
                      const sumA = Number((uA + sA + pA + cA).toFixed(2));
                      setPresaleForm({
                        ...presaleForm,
                        saleAreaType: nextType,
                        commonArea: nextType === "useful" ? "0" : presaleForm.commonArea,
                        contractArea: sumA > 0 ? String(sumA) : presaleForm.contractArea
                      });
                    }}
                    className="w-full bg-white border border-indigo-200 rounded-xl px-3 py-2 text-xs font-bold text-indigo-950 focus:outline-none"
                  >
                    <option value="useful">قرارداد فروش واحد مفید (متراژ مشاعات غیرفعال)</option>
                    <option value="with_commons">قرارداد فروش واحد با مشاعات (متراژ مشاعات فعال)</option>
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">متراژ مفید واحد (مترمربع) *</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      required
                      placeholder="مثال: ۱۱۰"
                      value={presaleForm.usefulArea}
                      onChange={e => {
                        const val = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, "");
                        const uA = Number(val) || 0;
                        const sA = Number(presaleForm.storageArea) || 0;
                        const pA = Number(presaleForm.parkingArea) || 0;
                        const cA = presaleForm.saleAreaType === "with_commons" ? (Number(presaleForm.commonArea) || 0) : 0;
                        const sumA = Number((uA + sA + pA + cA).toFixed(2));
                        setPresaleForm({
                          ...presaleForm,
                          usefulArea: val,
                          contractArea: String(sumA)
                        });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">متراژ انباری (مترمربع)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="۰"
                      value={presaleForm.storageArea}
                      onChange={e => {
                        const val = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, "");
                        const uA = Number(presaleForm.usefulArea) || 0;
                        const sA = Number(val) || 0;
                        const pA = Number(presaleForm.parkingArea) || 0;
                        const cA = presaleForm.saleAreaType === "with_commons" ? (Number(presaleForm.commonArea) || 0) : 0;
                        const sumA = Number((uA + sA + pA + cA).toFixed(2));
                        setPresaleForm({
                          ...presaleForm,
                          storageArea: val,
                          contractArea: String(sumA)
                        });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">متراژ پارکینگ (مترمربع)</label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="۰"
                      value={presaleForm.parkingArea}
                      onChange={e => {
                        const val = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, "");
                        const uA = Number(presaleForm.usefulArea) || 0;
                        const sA = Number(presaleForm.storageArea) || 0;
                        const pA = Number(val) || 0;
                        const cA = presaleForm.saleAreaType === "with_commons" ? (Number(presaleForm.commonArea) || 0) : 0;
                        const sumA = Number((uA + sA + pA + cA).toFixed(2));
                        setPresaleForm({
                          ...presaleForm,
                          parkingArea: val,
                          contractArea: String(sumA)
                        });
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs font-mono font-bold focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-600 font-bold block mb-1">
                      متراژ مشاعات {presaleForm.saleAreaType === "useful" ? "(غیرفعال در فروش مفید)" : "(مترمربع)"}
                    </label>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="۰"
                      disabled={presaleForm.saleAreaType === "useful"}
                      value={presaleForm.saleAreaType === "with_commons" ? presaleForm.commonArea : "0"}
                      onChange={e => {
                        const val = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, "");
                        const uA = Number(presaleForm.usefulArea) || 0;
                        const sA = Number(presaleForm.storageArea) || 0;
                        const pA = Number(presaleForm.parkingArea) || 0;
                        const cA = Number(val) || 0;
                        const sumA = Number((uA + sA + pA + cA).toFixed(2));
                        setPresaleForm({
                          ...presaleForm,
                          commonArea: val,
                          contractArea: String(sumA)
                        });
                      }}
                      className={`w-full border rounded-xl px-3 py-1.5 text-xs font-mono font-bold ${
                        presaleForm.saleAreaType === "useful"
                          ? "bg-slate-200 border-slate-300 text-slate-400 cursor-not-allowed"
                          : "bg-white border-indigo-300 text-indigo-900 focus:outline-none"
                      }`}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">جمع کل متراژ معامله (متر)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    required
                    placeholder="مساحت کل محاسبه شده"
                    value={presaleForm.contractArea}
                    onChange={e => setPresaleForm({ ...presaleForm, contractArea: toEnglishDigits(e.target.value).replace(/[^0-9.]/g, "") })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono font-black focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">فی هر مترمربع (ریال) *</label>
                  <FormattedAmountInput
                    required
                    placeholder="قیمت هر متر"
                    value={presaleForm.pricePerMeter}
                    onChange={val => setPresaleForm({ ...presaleForm, pricePerMeter: val })}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">مبلغ نهایی کل قرارداد</label>
                <div className="bg-slate-50 border border-slate-200 text-slate-800 font-mono px-3 py-2 text-xs rounded-xl font-bold">
                  {presaleForm.contractArea && presaleForm.pricePerMeter 
                    ? formatRial(Number(presaleForm.contractArea) * Number(presaleForm.pricePerMeter))
                    : "۰ ریال"
                  }
                </div>
                {presaleForm.contractArea && presaleForm.pricePerMeter && Number(presaleForm.contractArea) * Number(presaleForm.pricePerMeter) > 0 && (() => {
                  const val = Number(presaleForm.contractArea) * Number(presaleForm.pricePerMeter);
                  return (
                    <div className="text-[10px] font-bold mt-1 px-2.5 py-1 rounded bg-indigo-50 border border-indigo-150 text-indigo-700 block">
                      ✍️ {numberToPersianWords(val)} ریال
                      <div className="mt-0.5 font-light">عددی: {val.toLocaleString("fa-IR")} ریال</div>
                    </div>
                  );
                })()}
              </div>

              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-[10px] text-amber-900 font-bold leading-relaxed">
                📌 در زمان عقد قرارداد، طرف قرارداد به اندازه کل مبلغ قرارداد بدهکار می‌شود و هیچ قسط پیش‌فرضی ثبت نمی‌گردد. پس از ثبت قرارداد، می‌توانید اقساط توافقی یا واریزی‌های طرف قرارداد را ثبت نمایید.
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-2.5 text-xs font-bold transition-all disabled:opacity-50 cursor-pointer"
              >
                ثبت قرارداد پیش‌فروش (بدهکار شدن طرف قرارداد به مبلغ کل)
              </button>
            </form>
          </div>

          {/* Pre-sales contracts list */}
          <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-6">
            {(() => {
              const filteredPresales = presalesList.filter(ps => {
                if (presaleProjectFilter !== "all" && ps.projectId !== presaleProjectFilter) return false;
                const unit = db.units.find(u => u.id === ps.unitId);
                const blockVal = (ps as any).blockName || unit?.blockName || "";
                if (presaleBlockFilter !== "all" && blockVal !== presaleBlockFilter) return false;
                if (presaleSearch.trim()) {
                  const q = toEnglishDigits(presaleSearch).trim().toLowerCase();
                  const buyer = contactsList.find(c => c.id === ps.contactId);
                  const matchBuyer = (buyer?.name || "").toLowerCase().includes(q) || toEnglishDigits(buyer?.phone || "").includes(q);
                  const matchUnit = toEnglishDigits(unit?.unitNumber || "").toLowerCase().includes(q);
                  const matchBlock = blockVal.toLowerCase().includes(q);
                  if (!matchBuyer && !matchUnit && !matchBlock) return false;
                }
                return true;
              });

              const uniqueBlocks = Array.from(new Set(presalesList.map(ps => {
                const u = db.units.find(unit => unit.id === ps.unitId);
                return (ps as any).blockName || u?.blockName || "";
              }).filter(Boolean)));

              const handlePrintPresales = (mode: "after_filter" | "before_filter") => {
                const source = mode === "after_filter" ? filteredPresales : presalesList;
                printStructuredReport({
                  title: "گزارش قراردادهای پیش‌فروش واحدها، اقساط و آورده خریداران",
                  subtitle: "وضعیت مالی قراردادها، جمع قسط‌بندی، مجموع واریزی‌ها (آورده) و مانده بدهی",
                  mode,
                  filterDescription: mode === "after_filter"
                    ? `جستجو: ${presaleSearch || "همه"} | پروژه: ${presaleProjectFilter === "all" ? "همه" : (projects.find(p => p.id === presaleProjectFilter)?.name || presaleProjectFilter)} | بلوک: ${presaleBlockFilter === "all" ? "همه" : presaleBlockFilter}`
                    : undefined,
                  columns: [
                    { header: "ردیف", accessor: r => r.idx, align: "center" },
                    { header: "پیش‌خریدار", accessor: r => r.buyer },
                    { header: "واحد / بلوک", accessor: r => r.unit },
                    { header: "متراژ", accessor: r => r.area, align: "center" },
                    { header: "مبلغ کل قرارداد", accessor: r => r.totalPrice, align: "left" },
                    { header: "جمع قسط‌بندی شده", accessor: r => r.installmentsSum, align: "left" },
                    { header: "آورده طرف قرارداد (پرداختی)", accessor: r => r.paidAmount, align: "left" },
                    { header: "مانده بدهی قرارداد", accessor: r => r.remainingDebt, align: "left" },
                  ],
                  rows: source.map((ps, idx) => {
                    const buyer = contactsList.find(c => c.id === ps.contactId);
                    const unit = db.units.find(u => u.id === ps.unitId);
                    const instSum = installmentsList.filter(i => i.preSaleId === ps.id).reduce((s, i) => s + Number(i.amount || 0), 0);
                    const buyerContractsCount = presalesList.filter(p => p.contactId === ps.contactId).length;
                    const paidSum = transactionsList
                      .filter(tx => tx.type === "income" && (tx.preSaleId === ps.id || (!tx.preSaleId && tx.contactId === ps.contactId && buyerContractsCount === 1)))
                      .reduce((s, tx) => s + Number(tx.amount || 0), 0);
                    const remDebt = Math.max(0, Number(ps.totalPrice || 0) - paidSum);
                    return {
                      idx: (idx + 1).toLocaleString("fa-IR"),
                      buyer: buyer?.name || "پیش‌خریدار",
                      unit: ps.unitId === "after_scoring" ? "تعیین بعد از امتیازدهی" : `واحد ${unit?.unitNumber || "—"}${unit?.blockName ? ` (بلوک ${unit.blockName})` : ""}`,
                      area: `${ps.contractArea} متر`,
                      totalPrice: Number(ps.totalPrice || 0).toLocaleString("fa-IR"),
                      installmentsSum: instSum.toLocaleString("fa-IR"),
                      paidAmount: paidSum.toLocaleString("fa-IR"),
                      remainingDebt: remDebt.toLocaleString("fa-IR")
                    };
                  }),
                  summaryItems: [
                    { label: "تعداد قراردادها", value: `${source.length.toLocaleString("fa-IR")} فقره` },
                    { label: "جمع کل مبالغ قراردادها", value: `${source.reduce((s, p) => s + Number(p.totalPrice || 0), 0).toLocaleString("fa-IR")} ریال` }
                  ]
                });
              };

              return (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">قراردادهای پیش‌فروش فعال و معتبر</h3>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        نمایش {filteredPresales.length.toLocaleString("fa-IR")} از {presalesList.length.toLocaleString("fa-IR")} قرارداد
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handlePrintPresales("after_filter")}
                        className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        چاپ نتایج فیلتر شده (بعد از فیلتر)
                      </button>
                      <button
                        type="button"
                        onClick={() => handlePrintPresales("before_filter")}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <Printer className="w-3.5 h-3.5" />
                        چاپ کل اطلاعات (قبل از فیلتر)
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                    <div className="flex flex-col sm:flex-row gap-2">
                      <div className="relative flex-1">
                        <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          value={presaleSearch}
                          onChange={e => setPresaleSearch(e.target.value)}
                          placeholder="جستجو بر اساس نام پیش‌خریدار، شماره واحد یا کد بلوک..."
                          className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => setShowPresaleAdv(!showPresaleAdv)}
                        className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border cursor-pointer ${
                          showPresaleAdv ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-700"
                        }`}
                      >
                        <SlidersHorizontal className="w-3.5 h-3.5" />
                        جستجوی پیشرفته
                      </button>
                    </div>
                    {showPresaleAdv && (
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-200/80">
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">پروژه</label>
                          <select
                            value={presaleProjectFilter}
                            onChange={e => setPresaleProjectFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            <option value="all">همه پروژه‌ها</option>
                            {projects.map(p => (
                              <option key={p.id} value={p.id}>{p.name}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-500 block mb-1">بلوک</label>
                          <select
                            value={presaleBlockFilter}
                            onChange={e => setPresaleBlockFilter(e.target.value)}
                            className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs"
                          >
                            <option value="all">همه بلوک‌ها</option>
                            {uniqueBlocks.map(b => (
                              <option key={b} value={b}>بلوک {b}</option>
                            ))}
                          </select>
                        </div>
                        <div className="flex items-end">
                          <button
                            type="button"
                            onClick={() => {
                              setPresaleSearch("");
                              setPresaleProjectFilter("all");
                              setPresaleBlockFilter("all");
                            }}
                            className="w-full py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg text-xs font-bold cursor-pointer"
                          >
                            پاک کردن فیلترها
                          </button>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-right border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold">
                          <th className="p-3">پیش‌خریدار</th>
                          <th className="p-3">واحد مسکونی</th>
                          <th className="p-3 text-left">مبلغ کل قرارداد</th>
                          <th className="p-3 text-left">جمع قسط‌بندی</th>
                          <th className="p-3 text-left">آورده خریدار (پرداختی)</th>
                          <th className="p-3 text-left">مانده بدهی</th>
                          <th className="p-3 text-center">اقساط و واریزی‌ها</th>
                          <th className="p-3 text-center">عملیات</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {filteredPresales.map(ps => {
                          const buyer = contactsList.find(c => c.id === ps.contactId);
                          const unit = db.units.find(u => u.id === ps.unitId);
                          const contractInsts = installmentsList.filter(i => i.preSaleId === ps.id);
                          const sumInstallments = contractInsts.reduce((s, i) => s + Number(i.amount || 0), 0);
                          const isOverInstallment = sumInstallments > ps.totalPrice;
                          const buyerContractsCount = presalesList.filter(p => p.contactId === ps.contactId).length;
                          const buyerPayments = transactionsList.filter(
                            tx => tx.type === "income" && (tx.preSaleId === ps.id || (!tx.preSaleId && tx.contactId === ps.contactId && buyerContractsCount === 1))
                          );
                          const totalPaidContribution = buyerPayments.reduce((s, tx) => s + Number(tx.amount || 0), 0);
                          const remainingContractDebt = Math.max(0, Number(ps.totalPrice || 0) - totalPaidContribution);

                          return (
                            <tr key={ps.id} className={`hover:bg-slate-50/50 cursor-pointer ${selectedPreSaleId === ps.id ? "bg-indigo-50/40 font-bold" : ""}`} onClick={() => setSelectedPreSaleId(ps.id)}>
                              <td className="p-3">
                                <span className="font-extrabold text-slate-900 block">{buyer ? buyer.name : "پیش‌خریدار"}</span>
                                <span className="text-[10px] text-slate-400 font-light mt-0.5 block">{buyer?.phone || ""} | {ps.contractDate}</span>
                              </td>
                              <td className="p-3 text-slate-700">
                                {ps.unitId === "after_scoring" ? (
                                  <span className="text-indigo-600 font-semibold bg-indigo-50 px-2 py-0.5 rounded-md text-[10px]">
                                    تعیین واحد بعد از امتیازدهی
                                  </span>
                                ) : (
                                  `واحد ${unit ? unit.unitNumber : ""}${unit?.blockName ? ` (بلوک ${unit.blockName})` : ""}`
                                )}
                                <div className="mt-1 flex flex-wrap gap-1 items-center">
                                  <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded-md">
                                    {ps.contractArea} مترمربع
                                  </span>
                                </div>
                              </td>
                              <td className="p-3 text-left font-extrabold font-mono text-indigo-700">{formatRial(ps.totalPrice)}</td>
                              <td className="p-3 text-left font-mono">
                                {contractInsts.length === 0 ? (
                                  <span className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md font-bold">
                                    قسط‌بندی نشده (۰ قسط)
                                  </span>
                                ) : (
                                  <div className="flex flex-col items-end">
                                    <span className={`font-extrabold ${isOverInstallment ? "text-rose-600" : "text-slate-800"}`}>
                                      {formatRial(sumInstallments)}
                                    </span>
                                    {isOverInstallment && (
                                      <span className="text-[9px] text-rose-600 bg-rose-50 border border-rose-200 px-1.5 py-0.5 rounded font-bold mt-0.5">
                                        ⚠️ بیشتر از مبلغ قرارداد!
                                      </span>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="p-3 text-left font-extrabold font-mono text-emerald-600">
                                {formatRial(totalPaidContribution)}
                                {contractInsts.length === 0 && totalPaidContribution > 0 && (
                                  <span className="block text-[9px] text-emerald-700 font-bold">آورده ثبت‌شده (بدون قسط‌بندی)</span>
                                )}
                              </td>
                              <td className="p-3 text-left font-extrabold font-mono text-rose-600">
                                {remainingContractDebt > 0 ? `${formatRial(remainingContractDebt)} (بدهکار)` : <span className="text-emerald-600">تسویه کامل</span>}
                              </td>
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <button 
                                  onClick={() => setSelectedPreSaleId(ps.id)}
                                  className={`px-2.5 py-1 rounded-lg font-bold text-[10px] transition-colors cursor-pointer ${selectedPreSaleId === ps.id ? "bg-indigo-600 text-white" : "bg-slate-100 text-indigo-700 hover:bg-indigo-955 hover:text-white"}`}
                                >
                                  {selectedPreSaleId === ps.id ? "در حال نمایش" : "مدیریت اقساط و آورده"}
                                </button>
                              </td>
                              <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                                <button
                                  onClick={async () => {
                                    if (!window.confirm("آیا از حذف این قرارداد پیش‌فروش اطمینان دارید؟")) return;
                                    try {
                                      const res = await fetch(getApiUrl("/api/presales/delete"), {
                                        method: "POST",
                                        headers: { "Content-Type": "application/json" },
                                        body: JSON.stringify({ id: ps.id })
                                      });
                                      const data = await res.json();
                                      if (data.status === "success") {
                                        await onRefresh();
                                      } else {
                                        alert(data.error || "خطا در حذف قرارداد");
                                      }
                                    } catch (err: any) {
                                      alert("خطا: " + err.message);
                                    }
                                  }}
                                  className="p-1 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer transition-colors"
                                  title="حذف قرارداد"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })()}

            {/* Selected Pre-Sale Contract Details: Summary, Warning, Direct Buyer Contribution Payments, and Custom Installments */}
            {selectedPreSaleId && (() => {
              const currentPreSale = presalesList.find(ps => ps.id === selectedPreSaleId);
              if (!currentPreSale) return null;
              const buyer = contactsList.find(c => c.id === currentPreSale.contactId);
              const contractInstallments = installmentsList.filter(i => i.preSaleId === selectedPreSaleId);
              const sumInstallments = contractInstallments.reduce((s, i) => s + Number(i.amount || 0), 0);
              const unscheduledAmount = currentPreSale.totalPrice - sumInstallments;
              const isOverScheduled = sumInstallments > currentPreSale.totalPrice;

              const buyerContractsCount = presalesList.filter(p => p.contactId === currentPreSale.contactId).length;
              const contractPayments = transactionsList.filter(
                tx => tx.type === "income" && (
                  tx.preSaleId === currentPreSale.id ||
                  (!tx.preSaleId && tx.contactId === currentPreSale.contactId && buyerContractsCount === 1)
                )
              );
              const totalPaidContribution = contractPayments.reduce((s, tx) => s + Number(tx.amount || 0), 0);
              const remainingDebt = Math.max(0, Number(currentPreSale.totalPrice || 0) - totalPaidContribution);

              return (
                <div className="border-t border-slate-150 pt-6 space-y-6 animate-fadeIn">
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-2">
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        مدیریت مالی، آورده خریدار و اقساط قرارداد ({buyer?.name || "پیش‌خریدار"})
                      </h3>
                      <p className="text-[10px] text-slate-500 mt-0.5">
                        هرگونه پرداخت طرف قرارداد (چه اقساطی ثبت شده باشد و چه خالی باشد) جزو آورده خریدار محسوب شده و از بدهی کل قرارداد کسر می‌گردد.
                      </p>
                    </div>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-200 font-bold px-3 py-1 rounded-xl">
                      پرونده مالی قرارداد #{currentPreSale.id.slice(-5)}
                    </span>
                  </div>

                  {/* Financial Summary Cards (Requirements 4, 5, 6) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200">
                      <span className="text-[10px] font-bold text-slate-500 block">مبلغ کل قرارداد (بدهی اولیه)</span>
                      <span className="text-sm font-black font-mono text-slate-900 mt-1 block">
                        {formatRial(currentPreSale.totalPrice)}
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200">
                      <span className="text-[10px] font-bold text-emerald-700 block">آورده طرف قرارداد (جمع پرداختی‌ها)</span>
                      <span className="text-sm font-black font-mono text-emerald-800 mt-1 block">
                        {formatRial(totalPaidContribution)}
                      </span>
                      <span className="text-[9px] text-emerald-600 font-bold block mt-0.5">
                        {contractPayments.length.toLocaleString("fa-IR")} فقره واریزی ثبت‌شده
                      </span>
                    </div>
                    <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200">
                      <span className="text-[10px] font-bold text-rose-700 block">مانده بدهی طرف قرارداد</span>
                      <span className="text-sm font-black font-mono text-rose-800 mt-1 block">
                        {formatRial(remainingDebt)}
                      </span>
                      <span className="text-[9px] text-rose-600 font-bold block mt-0.5">
                        {remainingDebt > 0 ? "بدهکار به شرکت" : "تسویه کامل قرارداد"}
                      </span>
                    </div>
                    <div className={`p-3.5 rounded-2xl border ${isOverScheduled ? "bg-rose-100 border-rose-400" : "bg-indigo-50 border-indigo-200"}`}>
                      <span className={`text-[10px] font-bold block ${isOverScheduled ? "text-rose-800" : "text-indigo-700"}`}>
                        جمع مبلغ قسط‌بندی شده ({contractInstallments.length.toLocaleString("fa-IR")} قسط)
                      </span>
                      <span className={`text-sm font-black font-mono mt-1 block ${isOverScheduled ? "text-rose-900" : "text-indigo-900"}`}>
                        {formatRial(sumInstallments)}
                      </span>
                      <span className={`text-[9px] font-bold block mt-0.5 ${isOverScheduled ? "text-rose-700" : "text-indigo-600"}`}>
                        {isOverScheduled
                          ? `مازاد بر قرارداد: ${formatRial(sumInstallments - currentPreSale.totalPrice)}`
                          : `مانده قسط‌بندی نشده: ${formatRial(Math.max(0, unscheduledAmount))}`}
                      </span>
                    </div>
                  </div>

                  {/* Requirement 6: Over-Installment Warning Alert */}
                  {isOverScheduled && (
                    <div className="p-4 bg-rose-50 border-2 border-rose-400 rounded-2xl flex items-start gap-3 text-rose-900 animate-pulse">
                      <AlertTriangle className="w-6 h-6 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-black text-rose-900">
                          ⚠️ هشدار مهم: جمع مبالغ اقساط ثبت‌شده ({formatRial(sumInstallments)}) از مبلغ کل قرارداد ({formatRial(currentPreSale.totalPrice)}) به اندازه {formatRial(sumInstallments - currentPreSale.totalPrice)} بیشتر است!
                        </h4>
                        <p className="text-[11px] text-rose-700 font-bold mt-1">
                          لطفاً مبالغ اقساط را بازبینی و ویرایش کنید یا در صورت افزایش متراژ، مبلغ کل قرارداد را بروزرسانی نمایید.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Requirement 4, 8, 10: Buyer Contribution / Payments Section (Shown even when installments list is empty!) */}
                  <div className="p-5 bg-emerald-50/40 border border-emerald-200 rounded-2xl space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-200/70 pb-3">
                      <div className="flex items-center gap-2">
                        <Coins className="w-5 h-5 text-emerald-700" />
                        <div>
                          <h4 className="text-xs font-extrabold text-emerald-950">
                            آورده طرف قرارداد و فهرست پرداختی‌های انجام‌شده (حتی بدون قسط‌بندی)
                          </h4>
                          <p className="text-[10px] text-emerald-700">
                            تمامی مبالغ پرداختی خریدار در این قسمت نمایش داده شده، جزو آورده طرف قرارداد محسوب می‌شوند و مستقیماً از بدهی کل قرارداد کسر می‌گردند.
                          </p>
                        </div>
                      </div>
                      <span className="text-xs font-black font-mono text-emerald-800 bg-white px-3 py-1 rounded-xl border border-emerald-200">
                        جمع آورده: {formatRial(totalPaidContribution)}
                      </span>
                    </div>

                    {/* Direct Payment Registration Form (with Mandatory Receiving Account & Source Account) */}
                    <form onSubmit={handleRegisterPresalePayment} className="bg-white p-4 rounded-xl border border-emerald-200 space-y-3">
                      <h5 className="text-xs font-bold text-slate-800">
                        ثبت دریافتی / واریزی جدید از طرف قرارداد (افزایش آورده و کسر از بدهی قرارداد):
                      </h5>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">مبلغ واریزی خریدار (ریال) *</label>
                          <FormattedAmountInput
                            required
                            placeholder="مبلغ دریافتی به ریال"
                            value={presalePayAmount}
                            onChange={setPresalePayAmount}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-emerald-800 block mb-1">حساب دریافتی (بانک/صندوق شرکت) *</label>
                          <select
                            required
                            value={presalePayAccountId}
                            onChange={e => setPresalePayAccountId(e.target.value)}
                            className="w-full bg-emerald-50/50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold text-slate-900"
                          >
                            <option value="">-- انتخاب اجباری حساب دریافتی شرکت --</option>
                            {accountsList.map(acc => (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({acc.type === "bank" ? "بانک" : "صندوق"} - موجودی: {formatRial(acc.balance)})
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">حساب مبدا (حساب طرف حسابی که واریزی انجام داده)</label>
                          <input
                            type="text"
                            placeholder={`مثال: حساب/کارت ${buyer?.name || "خریدار"}`}
                            value={presalePaySourceAccount}
                            onChange={e => setPresalePaySourceAccount(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">تاریخ واریز *</label>
                          <ShamsiDatePicker
                            required
                            value={presalePayDate}
                            onChange={setPresalePayDate}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-center"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">شماره فیش / پیگیری بانکی</label>
                          <input
                            type="text"
                            placeholder="شماره پیگیری / ارجاع"
                            value={presalePayRef}
                            onChange={e => setPresalePayRef(e.target.value)}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-bold text-slate-600 block mb-1">توضیحات دریافتی</label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              placeholder="شرح واریزی (پیش‌پرداخت، علی‌الحساب و...)"
                              value={presalePayDesc}
                              onChange={e => setPresalePayDesc(e.target.value)}
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                            />
                            <button
                              type="submit"
                              disabled={isSubmitting}
                              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold whitespace-nowrap cursor-pointer shadow-2xs"
                            >
                              + ثبت دریافتی
                            </button>
                          </div>
                        </div>
                      </div>
                    </form>

                    {/* List of Buyer Payments / Contributions */}
                    <div className="bg-white rounded-xl border border-emerald-100 overflow-hidden">
                      <table className="w-full text-xs text-right border-collapse">
                        <thead>
                          <tr className="bg-emerald-50/70 border-b border-emerald-100 text-emerald-900 font-bold">
                            <th className="p-2.5 text-center">ردیف</th>
                            <th className="p-2.5 text-center">تاریخ پرداخت</th>
                            <th className="p-2.5">شرح دریافتی (آورده خریدار)</th>
                            <th className="p-2.5">حساب دریافتی (شرکت)</th>
                            <th className="p-2.5">حساب مبدا (واریزکننده)</th>
                            <th className="p-2.5 text-center">شماره فیش</th>
                            <th className="p-2.5 text-left">مبلغ (ریال)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {contractPayments.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="p-4 text-center text-slate-400 text-xs">
                                هنوز هیچ پرداختی برای این قرارداد ثبت نشده است.
                              </td>
                            </tr>
                          ) : (
                            contractPayments.map((tx, idx) => {
                              const recAcc = accountsList.find(a => a.id === tx.accountId);
                              return (
                                <tr key={tx.id} className="hover:bg-slate-50">
                                  <td className="p-2.5 text-center font-mono text-slate-500">{(idx + 1).toLocaleString("fa-IR")}</td>
                                  <td className="p-2.5 text-center font-mono text-slate-700">{tx.date}</td>
                                  <td className="p-2.5 font-bold text-slate-800">{tx.description || "واریزی پیش‌خریدار"}</td>
                                  <td className="p-2.5 text-emerald-700 font-bold">{recAcc ? recAcc.name : (tx.destinationAccount || "—")}</td>
                                  <td className="p-2.5 text-slate-600">{tx.sourceAccount || buyer?.name || "—"}</td>
                                  <td className="p-2.5 text-center font-mono text-slate-500">{tx.referenceNumber || "—"}</td>
                                  <td className="p-2.5 text-left font-extrabold font-mono text-emerald-700">{formatRial(tx.amount)}</td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  {/* Final Deed Area Adjustment Form */}
                  <div className="p-5 bg-gradient-to-br from-amber-50 to-orange-50/50 border border-amber-200/80 rounded-2xl space-y-4">
                    <div className="flex items-center gap-2 border-b border-amber-200/50 pb-2">
                      <Building className="w-5 h-5 text-amber-700" />
                      <div>
                        <h4 className="text-xs font-extrabold text-amber-950">تعدیل و تصفیه نهایی متراژ واحد (بروزرسانی بعد از صدور سند رسمی)</h4>
                        <p className="text-[10px] text-amber-700 font-medium">پس از مشخص شدن متراژ دقیق واحد در اداره ثبت و سند، مابه‌التفاوت متراژ را ثبت و تسویه کنید.</p>
                      </div>
                    </div>

                    <form onSubmit={handleUpdateExactArea} className="space-y-4">
                      <div className="flex items-center gap-3 bg-white/75 p-3 rounded-xl border border-amber-100">
                        <input
                          type="checkbox"
                          id="hasExactAreaChecked"
                          checked={hasExactAreaChecked}
                          onChange={e => setHasExactAreaChecked(e.target.checked)}
                          className="w-4 h-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500 cursor-pointer"
                        />
                        <label htmlFor="hasExactAreaChecked" className="text-xs font-bold text-amber-900 cursor-pointer select-none">
                          فعال‌سازی ثبت متراژ دقیق سند رسمی برای این قرارداد
                        </label>
                      </div>

                      {hasExactAreaChecked && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-fadeIn">
                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">متراژ دقیق سند رسمی (مترمربع)</label>
                            <input
                              type="text"
                              inputMode="decimal"
                              required
                              placeholder="مثال: ۱۰۵.۴"
                              value={exactAreaInput}
                              onChange={e => setExactAreaInput(toEnglishDigits(e.target.value))}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500 font-mono"
                            />
                            <span className="text-[9px] text-slate-400 font-medium block">متراژ تقریبی اولیه قرارداد: {currentPreSale.contractArea} مترمربع</span>
                          </div>

                          <div className="space-y-1">
                            <label className="text-[10px] text-slate-500 font-bold block">قیمت توافقی هر متر مازاد/کسری (ریال)</label>
                            <FormattedAmountInput
                              required
                              placeholder="قیمت هر متر مازاد"
                              value={secondaryPriceInput}
                              onChange={val => setSecondaryPriceInput(val)}
                              className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-amber-500"
                            />
                            <span className="text-[9px] text-slate-400 font-medium block">قیمت اولیه هر متر قرارداد: {formatRial(currentPreSale.pricePerMeter)}</span>
                          </div>
                        </div>
                      )}

                      <div className="flex justify-end">
                        <button
                          type="submit"
                          disabled={isSubmitting}
                          className="px-5 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all shadow-xs cursor-pointer flex items-center gap-1.5"
                        >
                          {isSubmitting ? "در حال ثبت..." : "بروزرسانی متراژ دقیق و تعدیل قرارداد"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Form to add a custom installment */}
                  <form onSubmit={handleAddInstallment} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <h4 className="text-xs font-bold text-slate-800">تعریف و افزودن قسط جدید برای این قرارداد:</h4>
                      <span className="text-[10px] font-bold text-indigo-700">
                        جمع اقساط فعلی: {formatRial(sumInstallments)} از {formatRial(currentPreSale.totalPrice)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-1">شرح قسط / مرحله ساخت</label>
                        <input
                          type="text"
                          required
                          placeholder="مثال: قسط اول - اسکلت یا نازک‌کاری"
                          value={newInstForm.installmentName}
                          onChange={e => setNewInstForm({ ...newInstForm, installmentName: e.target.value })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-1">تاریخ سررسید قسط</label>
                        <ShamsiDatePicker
                          required
                          placeholder="مثال: ۱۴۰۴/۰۳/۱۵"
                          value={newInstForm.dueDate}
                          onChange={val => setNewInstForm({ ...newInstForm, dueDate: val })}
                          className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-center focus:outline-none focus:border-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="text-[9px] text-slate-500 font-bold block mb-1">مبلغ قسط (ریال)</label>
                        <div className="flex gap-2">
                          <FormattedAmountInput
                            required
                            placeholder="مبلغ قسط به ریال"
                            value={newInstForm.amount}
                            onChange={val => setNewInstForm({ ...newInstForm, amount: val })}
                            className="w-full bg-white border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                          />
                          <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer whitespace-nowrap shadow-2xs"
                          >
                            + ثبت قسط
                          </button>
                        </div>
                      </div>
                    </div>
                  </form>

                  {/* Installments List */}
                  <div className="space-y-2">
                    {contractInstallments.length === 0 ? (
                      <div className="p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center text-xs text-slate-500">
                        برای این قرارداد هنوز قسط‌بندی ثبت نشده است.{totalPaidContribution > 0 ? ` با این حال مبلغ ${formatRial(totalPaidContribution)} به عنوان آورده طرف قرارداد ثبت و از بدهی کسر شده است.` : " در صورت نیاز می‌توانید از فرم بالا اقساط را وارد نمایید."}
                      </div>
                    ) : (
                      contractInstallments.map(inst => {
                        const isEditing = editingInstId === inst.id;
                        return (
                          <div key={inst.id} className="p-3 border border-slate-150 rounded-xl hover:shadow-2xs transition-shadow bg-white">
                            {isEditing ? (
                              <div className="space-y-3">
                                <div className="text-xs font-bold text-slate-900 border-b border-slate-100 pb-1.5 flex justify-between">
                                  <span>ویرایش مشخصات قسط</span>
                                  <span className="text-[10px] text-slate-400 font-normal">تمام مبالغ به ریال ثبت می‌شوند</span>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                  <div>
                                    <label className="text-[9px] text-slate-500 font-bold block mb-1">شرح قسط / مرحله</label>
                                    <input
                                      type="text"
                                      required
                                      value={editingInstForm.installmentName}
                                      onChange={e => setEditingInstForm({ ...editingInstForm, installmentName: e.target.value })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-slate-500 font-bold block mb-1">سررسید</label>
                                    <ShamsiDatePicker
                                      required
                                      value={editingInstForm.dueDate}
                                      onChange={val => setEditingInstForm({ ...editingInstForm, dueDate: val })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs text-center focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                  <div>
                                    <label className="text-[9px] text-slate-500 font-bold block mb-1">مبلغ قسط (ریال)</label>
                                    <FormattedAmountInput
                                      required
                                      value={editingInstForm.amount}
                                      onChange={val => setEditingInstForm({ ...editingInstForm, amount: val })}
                                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
                                    />
                                  </div>
                                </div>
                                <div className="flex justify-end gap-2 pt-1">
                                  <button
                                    type="button"
                                    onClick={() => setEditingInstId(null)}
                                    className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                    انصراف
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditInstallment(inst.id)}
                                    className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer shadow-2xs"
                                  >
                                    <Save className="w-3.5 h-3.5" />
                                    ذخیره تغییرات
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3">
                                <div className="flex items-center gap-2">
                                  {inst.isPaid ? (
                                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                  ) : ((inst as any).percentPaid || 0) > 0 ? (
                                    <Clock className="w-4 h-4 text-amber-500 shrink-0 animate-pulse" />
                                  ) : (
                                    <Clock className="w-4 h-4 text-slate-400 shrink-0" />
                                  )}
                                  <div>
                                    <span className="text-xs font-bold text-slate-800 block">{inst.installmentName}</span>
                                    <span className="text-[9px] text-slate-400 font-light mt-0.5 block font-mono">
                                      سررسید: {inst.dueDate} {inst.isPaid && inst.paidDate && ` | تسویه شده در: ${inst.paidDate}`}
                                    </span>
                                  </div>
                                </div>

                                <div className="flex flex-wrap items-center gap-3 self-end sm:self-auto">
                                  {(((inst as any).percentPaid || 0) > 0 && ((inst as any).percentPaid || 0) < 100) && (
                                    <div className="flex items-center gap-2 bg-amber-50/70 border border-amber-150 rounded-lg px-2 py-1">
                                      <div className="w-16 bg-slate-100 rounded-full h-1.5 overflow-hidden shrink-0">
                                        <div className="bg-amber-500 h-full rounded-full" style={{ width: `${(inst as any).percentPaid}%` }} />
                                      </div>
                                      <span className="text-[10px] font-extrabold text-amber-700 font-mono">
                                        {(inst as any).percentPaid}% ({formatRial((inst as any).amountPaid || 0)})
                                      </span>
                                    </div>
                                  )}

                                  <span className="font-extrabold font-mono text-xs text-slate-800">{formatRial(inst.amount)}</span>
                                  
                                  {inst.isPaid ? (
                                    <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-lg font-bold">وصول کامل (۱۰۰٪)</span>
                                  ) : (
                                    <div className="flex items-center gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setInstPayModal(inst);
                                          setInstPayAccountId("");
                                          setInstPaySourceAccount(buyer?.name || "");
                                          setInstPayDate(getTodayShamsiString());
                                          setInstPayRef("");
                                        }}
                                        className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold cursor-pointer"
                                      >
                                        ثبت وصول قسط
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setEditingInstId(inst.id);
                                          setEditingInstForm({
                                            installmentName: inst.installmentName,
                                            dueDate: inst.dueDate,
                                            amount: inst.amount.toString()
                                          });
                                        }}
                                        className="p-1.5 hover:bg-slate-100 text-slate-600 rounded-lg cursor-pointer transition-colors"
                                        title="ویرایش مشخصات قسط"
                                      >
                                        <Edit2 className="w-3.5 h-3.5" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDeleteInstallment(inst.id)}
                                        className="p-1.5 hover:bg-rose-50 text-rose-600 rounded-lg cursor-pointer transition-colors"
                                        title="حذف قسط"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Modal for Paying an Installment (Requires Mandatory Receiving Account) */}
            {instPayModal && (
              <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
                <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 text-right">
                  <div className="flex justify-between items-center border-b border-slate-100 pb-3">
                    <h4 className="font-bold text-slate-900 text-sm">ثبت وصول قسط و واریز به حساب دریافتی شرکت</h4>
                    <button
                      type="button"
                      onClick={() => setInstPayModal(null)}
                      className="text-slate-400 hover:text-slate-600 font-bold"
                    >
                      ✕
                    </button>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-slate-500">عنوان قسط:</span>
                      <span className="font-bold text-slate-900">{instPayModal.installmentName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">مبلغ قسط:</span>
                      <span className="font-extrabold font-mono text-emerald-700">{formatRial(instPayModal.amount)}</span>
                    </div>
                  </div>
                  <form onSubmit={handlePayInstallment} className="space-y-3 text-xs">
                    <div>
                      <label className="text-[10px] font-bold text-emerald-800 block mb-1">حساب دریافتی (حساب شرکت) *</label>
                      <select
                        required
                        value={instPayAccountId}
                        onChange={e => setInstPayAccountId(e.target.value)}
                        className="w-full bg-emerald-50 border border-emerald-300 rounded-xl px-3 py-2 text-xs font-bold"
                      >
                        <option value="">-- انتخاب اجباری بانک یا صندوق دریافتی شرکت --</option>
                        {accountsList.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({acc.type === "bank" ? "بانک" : "صندوق"} - موجودی: {formatRial(acc.balance)})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-600 block mb-1">حساب مبدا (حساب طرف حسابی که واریزی انجام داده)</label>
                      <input
                        type="text"
                        placeholder="نام بانک / شماره کارت خریدار واریزکننده"
                        value={instPaySourceAccount}
                        onChange={e => setInstPaySourceAccount(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">تاریخ وصول *</label>
                        <ShamsiDatePicker
                          required
                          value={instPayDate}
                          onChange={setInstPayDate}
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-center"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">شماره فیش / پیگیری</label>
                        <input
                          type="text"
                          value={instPayRef}
                          onChange={e => setInstPayRef(e.target.value)}
                          placeholder="شماره ارجاع بانکی"
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl py-2.5 text-xs font-bold cursor-pointer"
                    >
                      {isSubmitting ? "در حال ثبت..." : "تأیید وصول قسط و کسر از بدهی طرف قرارداد"}
                    </button>
                  </form>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- SUB-TAB: ALERTS --- */}
      {subTab === "alerts" && (() => {
        const filteredAlerts = alertsLogList.filter(al => {
          if (alertTypeFilter !== "all" && al.type !== alertTypeFilter) return false;
          if (alertSearch.trim()) {
            const q = toEnglishDigits(alertSearch).trim().toLowerCase();
            const matchPhone = toEnglishDigits(al.recipientPhone || "").toLowerCase().includes(q);
            const matchMsg = (al.message || "").toLowerCase().includes(q);
            if (!matchPhone && !matchMsg) return false;
          }
          return true;
        });

        const handlePrintAlerts = (mode: "after_filter" | "before_filter") => {
          const source = mode === "after_filter" ? filteredAlerts : alertsLogList;
          printStructuredReport({
            title: "گزارش آرشیو پیامک‌ها و اطلاع‌رسانی‌های هوشمند",
            mode,
            filterDescription: mode === "after_filter" ? `جستجو: ${alertSearch || "همه"} | نوع پیامک: ${alertTypeFilter}` : undefined,
            columns: [
              { header: "ردیف", accessor: r => r.idx, align: "center" },
              { header: "شماره گیرنده", accessor: r => r.phone, align: "center" },
              { header: "نوع پیامک", accessor: r => r.type, align: "center" },
              { header: "متن پیامک", accessor: r => r.message },
              { header: "تاریخ ارسال", accessor: r => r.date, align: "center" },
            ],
            rows: source.map((al, idx) => ({
              idx: (idx + 1).toLocaleString("fa-IR"),
              phone: al.recipientPhone,
              type: al.type === "installment" ? "قسط پیش‌فروش" : al.type === "check" ? "سررسید چک" : "تسویه تنخواه",
              message: al.message,
              date: al.sendDate
            })),
            summaryItems: [
              { label: "تعداد پیامک‌ها", value: `${source.length.toLocaleString("fa-IR")} پیامک` }
            ]
          });
        };

        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Quick Alert sender simulator */}
            <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm self-start">
              <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Bell className="w-4 h-4 text-indigo-600" />
                ارسال پیامک اطلاع‌رسانی و یادآوری فوری
              </h3>
              
              <div className="space-y-4 text-xs">
                <p className="text-slate-500 font-light">این ماژول به وب‌سرویس پیامکی متصل است و به صورت خودکار سررسید اقساط یا قفل شدن تنخواه به علت عدم تسویه حساب را به اطلاع طرف‌های حساب می‌رساند.</p>
                
                <div className="p-3.5 bg-indigo-50 border border-indigo-150 rounded-xl space-y-2">
                  <h4 className="font-bold text-indigo-950">سناریوهای پیامکی تعریف شده:</h4>
                  <ul className="list-disc pr-4 space-y-1 font-light text-indigo-850 text-[11px]">
                    <li>اعلام سررسید قسط قرارداد پیش‌فروش</li>
                    <li>پیام هشدار کسر موجودی و قفل شدن تنخواه</li>
                    <li>درخواست واریز علی‌الحساب پیمانکاران جزء</li>
                  </ul>
                </div>

                <div className="border-t border-slate-100 pt-4 space-y-3">
                  <h4 className="font-bold text-slate-800">آمار ارسال‌های سیستمی امروز:</h4>
                  <div className="flex gap-4 text-center">
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                      <span className="text-[9px] text-slate-400 block font-bold">کل پیامک‌های موفق</span>
                      <span className="font-extrabold text-slate-900 mt-1 block font-mono">
                        {alertsLogList.length.toLocaleString("fa-IR")}
                      </span>
                    </div>
                    <div className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-2.5">
                      <span className="text-[9px] text-slate-400 block font-bold">وضعیت پنل مخابرات</span>
                      <span className="font-extrabold text-emerald-600 mt-1 block">متصل (سبز)</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Sent alerts logs table */}
            <div className="bg-white border border-slate-150 rounded-2xl p-6 shadow-sm lg:col-span-2 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <h3 className="text-sm font-bold text-slate-900">آرشیو و لاگ پیامک‌های مخابره شده هوشمند</h3>
                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => handlePrintAlerts("after_filter")}
                    className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    چاپ نتایج فیلتر شده (بعد از فیلتر)
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePrintAlerts("before_filter")}
                    className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    چاپ کل اطلاعات (قبل از فیلتر)
                  </button>
                </div>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-3">
                <div className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={alertSearch}
                      onChange={e => setAlertSearch(e.target.value)}
                      placeholder="جستجو در شماره گیرنده یا متن پیامک..."
                      className="w-full bg-white border border-slate-200 rounded-xl pr-9 pl-3 py-2 text-xs focus:outline-none"
                    />
                  </div>
                  <select
                    value={alertTypeFilter}
                    onChange={e => setAlertTypeFilter(e.target.value)}
                    className="bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs"
                  >
                    <option value="all">همه انواع پیامک</option>
                    <option value="installment">قسط پیش‌فروش</option>
                    <option value="check">سررسید چک</option>
                    <option value="imprest_lock">تسویه تنخواه</option>
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-right border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-150 text-slate-500 font-bold">
                      <th className="p-3">شماره گیرنده</th>
                      <th className="p-3">نوع پیامک</th>
                      <th className="p-3">متن کامل پیامک ارسالی</th>
                      <th className="p-3 text-center">تاریخ ارسال</th>
                      <th className="p-3 text-center">وضعیت دلیوری</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredAlerts.map(al => (
                      <tr key={al.id} className="hover:bg-slate-50/50">
                        <td className="p-3 font-mono text-slate-700">{al.recipientPhone}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 font-bold">
                            {al.type === "installment" ? "قسط پیش‌فروش" :
                             al.type === "check" ? "سررسید چک" : "تسویه تنخواه"}
                          </span>
                        </td>
                        <td className="p-3 text-slate-600 leading-relaxed font-light">{al.message}</td>
                        <td className="p-3 text-center text-slate-400 font-mono font-light">{al.sendDate}</td>
                        <td className="p-3 text-center">
                          <span className="px-2 py-0.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded text-[9px] font-bold">
                            رسیده به گوشی
                          </span>
                        </td>
                      </tr>
                    ))}
                    {filteredAlerts.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-6 text-center text-slate-400 font-light">
                          پیامکی یافت نشد.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Contact Detailed creation Modal */}
      {showContactModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6 shadow-xl border border-slate-100 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-600" />
                تعریف طرف حساب جدید با جزئیات کامل
              </h4>
              <button 
                type="button"
                onClick={() => {
                  setShowContactModal(false);
                  setErrorMsg(null);
                  setSuccessMsg(null);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickContactSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">نام و نام خانوادگی طرف حساب</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: شرکت آذرخش سیمان یا علی علوی"
                  value={contactModalName}
                  onChange={e => setContactModalName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">تلفن همراه</label>
                  <input
                    type="text"
                    placeholder="مثال: 09123456789"
                    value={contactModalPhone}
                    onChange={e => setContactModalPhone(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">کد ملی / شناسه ملی</label>
                  <input
                    type="text"
                    placeholder="مثال: 0012345678"
                    value={contactModalNationalId}
                    onChange={e => setContactModalNationalId(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left font-mono focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نقش در پروژه (قابل سرچ و تعریف)</label>
                  <select
                    value={contactModalRole}
                    onChange={e => setContactModalRole(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-2 py-2 text-xs focus:outline-none"
                  >
                    <option value="supplier">تأمین‌کننده مصالح و کالا</option>
                    <option value="subcontractor">پیمانکار دست دوم</option>
                    <option value="imprest_holder">تنخواه‌دار / ناظر کارگاه</option>
                    <option value="pre_buyer">پیش‌خریدار واحد مسکونی</option>
                    <option value="admin">سایر / اداری</option>
                    <option value="custom">نقش جدید / سفارشی (تایپ کنید)...</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">صنف کاری طرف حساب</label>
                  <input
                    type="text"
                    placeholder="مثال: آهن آلات، سیمان‌کار، تاسیسات"
                    value={contactModalJobCategory}
                    onChange={e => setContactModalJobCategory(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              {contactModalRole === "custom" && (
                <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100 space-y-1">
                  <label className="text-[10px] text-indigo-700 font-bold block">تعریف عنوان نقش جدید</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: برق‌کار ساختمان، لوله‌کش"
                    value={customRoleInput}
                    onChange={e => setCustomRoleInput(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">نام بانک</label>
                  <input
                    type="text"
                    placeholder="مثال: ملی، ملت، سامان"
                    value={contactModalBankName}
                    onChange={e => setContactModalBankName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">مانده اولیه (ریال)</label>
                  <FormattedAmountInput
                    placeholder="مثال: 0"
                    value={contactModalBalance}
                    onChange={setContactModalBalance}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره کارت بانکی</label>
                  <input
                    type="text"
                    placeholder="مثال: ۶۰۳۷۹۹۱۸۱۲۳۴۵۶۷۸"
                    value={contactModalCardNumber}
                    onChange={e => setContactModalCardNumber(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left font-mono focus:outline-none"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">شماره شبا (IBAN)</label>
                  <input
                    type="text"
                    placeholder="مثال: IR120120000000012345678901"
                    value={contactModalBankIBAN}
                    onChange={e => setContactModalBankIBAN(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs text-left font-mono focus:outline-none"
                  />
                </div>
              </div>

              {/* Payment Method Selector */}
              <div className="bg-slate-50 p-3 rounded-2xl border border-slate-150 space-y-2">
                <label className="text-[10px] text-slate-600 font-bold block">نوع تسویه پیش‌فرض با طرف حساب</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setContactModalPaymentMethod("cash")}
                    className={`py-1.5 px-3 rounded-lg border text-center font-bold text-[11px] cursor-pointer transition-all ${contactModalPaymentMethod === "cash" ? "bg-indigo-600 border-indigo-600 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    تسویه نقدی (عادی)
                  </button>
                  <button
                    type="button"
                    onClick={() => setContactModalPaymentMethod("barter")}
                    className={`py-1.5 px-3 rounded-lg border text-center font-bold text-[11px] cursor-pointer transition-all ${contactModalPaymentMethod === "barter" ? "bg-amber-500 border-amber-500 text-white" : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"}`}
                  >
                    تهاتر (ملک/واحد)
                  </button>
                </div>
              </div>

              {/* Multi-role selection for Barter contacts */}
              {contactModalPaymentMethod === "barter" && (
                <div className="p-3 bg-indigo-50/30 rounded-2xl border border-indigo-150 space-y-2">
                  <label className="text-[10px] text-indigo-800 font-bold block mb-1">
                    👥 این شخص علاوه بر تهاتر واحد، چه نقش‌های فعال دیگری دارد؟
                  </label>
                  <div className="grid grid-cols-2 gap-2 text-[11px] text-slate-700">
                    {[
                      { id: "supplier", label: "تأمین‌کننده مصالح و کالا" },
                      { id: "subcontractor", label: "پیمانکار اجرایی/دست دوم" },
                      { id: "imprest_holder", label: "تنخواه‌دار کارگاه" },
                      { id: "pre_buyer", label: "پیش‌خریدار واحد" }
                    ].map(r => {
                      const isSelected = contactModalRoles.includes(r.id);
                      return (
                        <label key={r.id} className="flex items-center gap-1.5 p-1.5 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer select-none">
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {
                              if (isSelected) {
                                setContactModalRoles(contactModalRoles.filter(roleId => roleId !== r.id));
                              } else {
                                setContactModalRoles([...contactModalRoles, r.id]);
                              }
                            }}
                            className="accent-indigo-600 rounded"
                          />
                          <span>{r.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Barter Fields */}
              {contactModalPaymentMethod === "barter" && (
                <div className="p-4 bg-amber-50/50 rounded-2xl border border-amber-150 space-y-4">
                  <div className="flex justify-between items-center">
                    <h5 className="font-extrabold text-amber-950 text-[11px] flex items-center gap-1">
                      🏢 جزئیات اختصاص واحدهای تهاتر شده ({contactModalBarterUnitsList.length} واحد)
                    </h5>
                    <button
                      type="button"
                      onClick={() => {
                        setContactModalBarterUnitsList([
                          ...contactModalBarterUnitsList,
                          { selectionType: "specific", unitId: "", area: "", price: "" }
                        ]);
                      }}
                      className="px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-[9px] font-bold transition-colors cursor-pointer"
                    >
                      ＋ افزودن واحد تهاتری
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-amber-800 font-bold block">پروژه ساختمانی مبدأ تهاتر</label>
                    <select
                      value={contactModalProjectId}
                      onChange={e => {
                        setContactModalProjectId(e.target.value);
                        // Reset all units in list
                        setContactModalBarterUnitsList([
                          { selectionType: "specific", unitId: "", area: "", price: "" }
                        ]);
                      }}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                    >
                      <option value="">انتخاب پروژه...</option>
                      {projects.map(p => (
                        <option key={p.id} value={p.id}>{p.name}</option>
                      ))}
                    </select>
                  </div>

                  {contactModalProjectId && (
                    <div className="space-y-3 divide-y divide-amber-150 max-h-[250px] overflow-y-auto pr-1">
                      {contactModalBarterUnitsList.map((bu, idx) => (
                        <div key={idx} className="pt-3 first:pt-0 space-y-2.5">
                          <div className="flex justify-between items-center text-[10px] font-bold text-amber-900">
                            <span>واحد تهاتری #{idx + 1}</span>
                            {contactModalBarterUnitsList.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  setContactModalBarterUnitsList(
                                    contactModalBarterUnitsList.filter((_, i) => i !== idx)
                                  );
                                }}
                                className="text-rose-600 hover:text-rose-800 font-bold text-[9px] cursor-pointer"
                              >
                                ✕ حذف واحد
                              </button>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] text-amber-800 font-medium block mb-1">نوع واگذاری واحد</label>
                              <select
                                value={bu.selectionType}
                                onChange={e => {
                                  const val = e.target.value as "specific" | "scoring";
                                  const updated = [...contactModalBarterUnitsList];
                                  updated[idx].selectionType = val;
                                  updated[idx].unitId = val === "scoring" ? "after_scoring" : "";
                                  if (val === "scoring") {
                                    updated[idx].area = "100"; // default 100 sqm
                                    updated[idx].price = "40000000"; // default price per meter
                                  } else {
                                    updated[idx].area = "";
                                    updated[idx].price = "";
                                  }
                                  setContactModalBarterUnitsList(updated);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none"
                              >
                                <option value="specific">انتخاب واحد مشخص از لیست</option>
                                <option value="scoring">✨ تعیین واحد بعد از امتیازدهی</option>
                              </select>
                            </div>

                            {bu.selectionType === "specific" ? (
                              <div>
                                <label className="text-[9px] text-amber-800 font-medium block mb-1">انتخاب واحد</label>
                                <select
                                  value={bu.unitId}
                                  onChange={e => {
                                    const uId = e.target.value;
                                    const updated = [...contactModalBarterUnitsList];
                                    updated[idx].unitId = uId;
                                    const found = db.units.find(u => u.id === uId);
                                    if (found) {
                                      updated[idx].area = found.area.toString();
                                      updated[idx].price = (found.pricePerMeter || 0).toString();
                                    }
                                    setContactModalBarterUnitsList(updated);
                                  }}
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none"
                                >
                                  <option value="">انتخاب واحد...</option>
                                  {db.units
                                    .filter(u => u.projectId === contactModalProjectId)
                                    .map(u => (
                                      <option key={u.id} value={u.id}>
                                        واحد {u.unitNumber} - طبقه {u.floor} ({u.status === "available" ? "آزاد" : "غیرآزاد"})
                                      </option>
                                    ))}
                                </select>
                              </div>
                            ) : (
                              <div className="flex items-center justify-center text-[10px] text-indigo-700 bg-indigo-50 border border-indigo-150 rounded-lg p-2 font-medium">
                                🎖️ اختصاص واحد بر اساس رتبه‌بندی پرداخت‌ها صورت می‌گیرد
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2">
                            <div>
                              <label className="text-[9px] text-amber-800 font-semibold block mb-1">متراژ واحد (متر مربع)</label>
                              <input
                                type="text"
                                inputMode="decimal"
                                placeholder="مثال: ۱۰۰"
                                value={bu.area}
                                onChange={e => {
                                  const updated = [...contactModalBarterUnitsList];
                                  updated[idx].area = toEnglishDigits(e.target.value).replace(/[^0-9.]/g, "");
                                  setContactModalBarterUnitsList(updated);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none text-center font-mono"
                              />
                            </div>
                            <div>
                              <label className="text-[9px] text-amber-800 font-semibold block mb-1">قیمت هر متر مربع (ریال)</label>
                              <FormattedAmountInput
                                placeholder="قیمت توافقی هر متر"
                                value={bu.price}
                                onChange={val => {
                                  const updated = [...contactModalBarterUnitsList];
                                  updated[idx].price = val;
                                  setContactModalBarterUnitsList(updated);
                                }}
                                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-[11px] focus:outline-none text-center font-mono"
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="text-[10px] text-amber-850 leading-relaxed font-semibold bg-white p-2.5 rounded-xl border border-amber-100">
                    💡 با ثبت این طرف حساب تهاتری، یک قرارداد پیش‌فروش مجزا با وضعیت ویژه تهاتر و معین اقساط متناظر به صورت خودکار برای هر واحد صادر خواهد شد.
                  </div>
                </div>
              )}

              {errorMsg && (
                <div className="bg-rose-50 border border-rose-200 text-rose-700 p-2.5 rounded-xl text-[11px] font-bold">
                  ⚠️ {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 p-2.5 rounded-xl text-[11px] font-bold">
                  ✅ {successMsg}
                </div>
              )}

              <div className="pt-2 flex justify-end gap-2 border-t border-slate-100 pt-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowContactModal(false);
                    setErrorMsg(null);
                    setSuccessMsg(null);
                  }}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  {isSubmitting ? "در حال ثبت..." : "ثبت و تایید طرف حساب"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Project Detailed creation Modal */}
      {showProjectModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl border border-slate-100 space-y-4 text-right">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h4 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <Plus className="w-5 h-5 text-indigo-600" />
                تعریف پروژه عمرانی جدید با جزئیات کامل
              </h4>
              <button 
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="text-slate-400 hover:text-slate-600 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleQuickProjectSubmit} className="space-y-4 text-xs">
              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">نام پروژه عمرانی</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: مجتمع مسکونی نیایش یا برج نگین"
                  value={projectModalName}
                  onChange={e => setProjectModalName(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div>
                <label className="text-[10px] text-slate-500 font-bold block mb-1">نشانی دقیق کارگاه</label>
                <input
                  type="text"
                  placeholder="مثال: تهران، خیابان شریعتی، بن‌بست لاله، پلاک ۴"
                  value={projectModalAddress}
                  onChange={e => setProjectModalAddress(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">تعداد کل واحدها *</label>
                  <input
                    type="text"
                    inputMode="numeric"
                    placeholder="مثال: ۱۰"
                    value={projectModalTotalUnits}
                    onChange={e => setProjectModalTotalUnits(toEnglishDigits(e.target.value).replace(/[^0-9]/g, ""))}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none font-mono font-bold"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-slate-500 font-bold block mb-1">بودجه کل مصوب ساخت (ریال)</label>
                  <FormattedAmountInput
                    placeholder="مثال: ۵۰۰۰۰۰۰۰۰۰"
                    value={projectModalBudget}
                    onChange={setProjectModalBudget}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs focus:outline-none"
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowProjectModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs cursor-pointer"
                >
                  {isSubmitting ? "در حال ثبت..." : "ثبت و تعریف پروژه عمرانی"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
