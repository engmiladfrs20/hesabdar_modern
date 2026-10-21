import React, { useState, useEffect } from "react";
import { Project, Transaction, UnitItem, Contact, PreSale } from "../types";
import { formatRials, toFarsiDigits } from "../utils/shamsi";
import { toEnglishDigits } from "../utils/digits";
import { FormattedAmountInput } from "./FormattedAmountInput";
import {
  Building,
  MapPin,
  Calculator,
  Plus,
  Coins,
  ShieldCheck,
  Edit3,
  Trash2,
  UserCheck,
  Layers,
  Minus,
  CheckCircle2,
  Phone,
  FileText
} from "lucide-react";
import { motion } from "motion/react";

interface ProjectsManagerProps {
  projects: Project[];
  transactions: Transaction[];
  units: UnitItem[];
  contacts?: Contact[];
  preSales?: PreSale[];
  activeCompanyId?: string;
  onAdd?: (p: any) => void;
  onAddProject?: (p: any) => void;
  onEditProject?: (p: any) => void;
  onDeleteProject?: (id: string) => void;
  onRestoreProject?: (id: string) => void;
  onUpdateUnit: (...args: any[]) => void;
  onAddUnitExpense?: (...args: any[]) => void;
  onDeleteUnit?: (id: string) => void;
  onRestoreUnit?: (id: string) => void;
  onBatchGenerateUnits?: (...args: any[]) => void;
  selectedProjId?: string;
  onSelectProjId?: (id: string) => void;
}

export function ProjectsManager({
  projects,
  transactions,
  units,
  contacts = [],
  preSales = [],
  activeCompanyId,
  onAdd,
  onAddProject,
  onEditProject,
  onDeleteProject,
  onRestoreProject,
  onUpdateUnit,
  onDeleteUnit,
  onRestoreUnit,
  selectedProjId,
  onSelectProjId
}: ProjectsManagerProps) {
  const [internalProjId, setInternalProjId] = useState<string>(projects[0]?.id || "");
  const effectiveProjId = selectedProjId !== undefined ? selectedProjId : internalProjId;
  const handleSelectProjId = (id: string) => {
    setInternalProjId(id);
    if (onSelectProjId) onSelectProjId(id);
  };
  const saveProjectFn = onAddProject || onAdd;
  const editProjectFn = onEditProject || onAddProject || onAdd;
  const triggerUpdateUnit = (unitObj: UnitItem) => {
    if (onUpdateUnit.length >= 2) {
      onUpdateUnit(unitObj.id, unitObj);
    } else {
      onUpdateUnit(unitObj);
    }
  };
  const [selectedUnit, setSelectedUnit] = useState<UnitItem | null>(null);

  const [projDeleteConfirm, setProjDeleteConfirm] = useState<number>(0);
  const [unitDeleteConfirm, setUnitDeleteConfirm] = useState<number>(0);
  const [isTrashOpen, setIsTrashOpen] = useState(false);

  // New project form states (Only unit count is specified here; block, area breakdown, and price are set in Contract or Unit Edit)
  const [isAddingProj, setIsAddingProj] = useState(false);
  const [projName, setProjName] = useState("");
  const [projAddress, setProjAddress] = useState("");
  const [projArea, setProjArea] = useState("");
  const [projBudget, setProjBudget] = useState("");
  const [projSupervisor, setProjSupervisor] = useState("مهندس میلاد فرخی");
  const [projNumUnits, setProjNumUnits] = useState("");

  // Edit active project states
  const [isEditingProj, setIsEditingProj] = useState(false);
  const [editProjName, setEditProjName] = useState("");
  const [editProjAddress, setEditProjAddress] = useState("");
  const [editProjArea, setEditProjArea] = useState("");
  const [editProjBudget, setEditProjBudget] = useState("");
  const [editProjSupervisor, setEditProjSupervisor] = useState("");
  const [editProjStage, setEditProjStage] = useState("");
  const [editProjNumUnits, setEditProjNumUnits] = useState("");

  // Add single unit form states
  const [isAddingSingleUnit, setIsAddingSingleUnit] = useState(false);
  const [newUnitNum, setNewUnitNum] = useState("");
  const [newUnitBlock, setNewUnitBlock] = useState("");
  const [newUnitFloor, setNewUnitFloor] = useState("");
  const [newUnitSaleAreaType, setNewUnitSaleAreaType] = useState<"useful" | "with_commons">("useful");
  const [newUnitUsefulArea, setNewUnitUsefulArea] = useState("");
  const [newUnitStorageArea, setNewUnitStorageArea] = useState("0");
  const [newUnitParkingArea, setNewUnitParkingArea] = useState("0");
  const [newUnitCommonArea, setNewUnitCommonArea] = useState("0");
  const [newUnitPricePerMeter, setNewUnitPricePerMeter] = useState("");

  // Unit Edit & Area Breakdown Form States (Always open when a unit is clicked)
  const [editUnitNumber, setEditUnitNumber] = useState("");
  const [editUnitBlock, setEditUnitBlock] = useState("");
  const [editUnitFloor, setEditUnitFloor] = useState("");
  const [editSaleAreaType, setEditSaleAreaType] = useState<"useful" | "with_commons">("useful");
  const [editUsefulArea, setEditUsefulArea] = useState("0");
  const [editStorageArea, setEditStorageArea] = useState("0");
  const [editParkingArea, setEditParkingArea] = useState("0");
  const [editCommonArea, setEditCommonArea] = useState("0");
  const [editUnitArea, setEditUnitArea] = useState("0");
  const [editUnitPricePerMeter, setEditUnitPricePerMeter] = useState("0");

  // Unit Sales / Allocation Form States
  const [saleStatus, setSaleStatus] = useState<"available" | "pre_sold" | "sold" | "bartered">("available");
  const [buyerName, setBuyerName] = useState("");
  const [selectedContactId, setSelectedContactId] = useState("");
  const [downPayment, setDownPayment] = useState("");
  const [barterProperty, setBarterProperty] = useState("");

  // Unit Specific Expense States
  const [unitExpTitle, setUnitExpTitle] = useState("");
  const [unitExpAmount, setUnitExpAmount] = useState("");
  const [unitSavedToast, setUnitSavedToast] = useState<string | null>(null);

  const activeProjects = projects.filter(p => !p.isDeleted);
  const deletedProjects = projects.filter(p => p.isDeleted);
  const selectedProj = activeProjects.find(p => p.id === effectiveProjId) || activeProjects[0];

  useEffect(() => {
    setProjDeleteConfirm(0);
    if (selectedProj) {
      setEditProjName(selectedProj.name);
      setEditProjAddress(selectedProj.address);
      setEditProjArea(String(selectedProj.totalArea));
      setEditProjBudget(String(selectedProj.budget));
      setEditProjSupervisor((selectedProj as any).supervisorName || "مهندس میلاد فرخی");
      setEditProjStage(selectedProj.currentStage || "تجهیز کارگاه");
      const currentActiveUnitsCount = units.filter(u => u.projectId === selectedProj.id && !u.isDeleted).length;
      setEditProjNumUnits(String(selectedProj.numberOfUnits || currentActiveUnitsCount || ""));
    }
  }, [selectedProj, units]);

  // Keep selectedUnit synced with updated units prop
  useEffect(() => {
    if (selectedUnit) {
      const updated = units.find(u => u.id === selectedUnit.id && !u.isDeleted);
      if (updated) {
        setSelectedUnit(updated);
      }
    }
  }, [units]);

  // Populate unit edit fields whenever selectedUnit changes
  useEffect(() => {
    setUnitDeleteConfirm(0);
    setUnitSavedToast(null);
    if (selectedUnit) {
      setEditUnitNumber(selectedUnit.unitNumber || "");
      setEditUnitBlock(selectedUnit.blockName || "");
      setEditUnitFloor(selectedUnit.floor || "");
      const sType = selectedUnit.saleAreaType || "useful";
      setEditSaleAreaType(sType);
      const uArea = selectedUnit.usefulArea !== undefined ? selectedUnit.usefulArea : (selectedUnit.area || 0);
      const stArea = selectedUnit.storageArea || 0;
      const pkArea = selectedUnit.parkingArea || 0;
      const cmArea = sType === "with_commons" ? (selectedUnit.commonArea || 0) : 0;
      setEditUsefulArea(String(uArea));
      setEditStorageArea(String(stArea));
      setEditParkingArea(String(pkArea));
      setEditCommonArea(String(cmArea));
      const calcTotal = Number((uArea + stArea + pkArea + cmArea).toFixed(2));
      setEditUnitArea(String(selectedUnit.area || calcTotal));
      setEditUnitPricePerMeter(String(selectedUnit.pricePerMeter || 0));

      setSaleStatus(selectedUnit.status || "available");
      setBuyerName(selectedUnit.buyerName || "");
      setSelectedContactId(selectedUnit.contactId || "");
      setDownPayment(selectedUnit.downPayment ? String(selectedUnit.downPayment) : "");
      setBarterProperty(selectedUnit.barterProperty || "");
    }
  }, [selectedUnit?.id]);

  // Automatically recalculate total unit area when component areas or saleAreaType change
  const recomputeTotalArea = (
    uStr: string,
    sStr: string,
    pStr: string,
    cStr: string,
    type: "useful" | "with_commons"
  ) => {
    const u = parseFloat(toEnglishDigits(uStr)) || 0;
    const s = parseFloat(toEnglishDigits(sStr)) || 0;
    const p = parseFloat(toEnglishDigits(pStr)) || 0;
    const c = type === "with_commons" ? (parseFloat(toEnglishDigits(cStr)) || 0) : 0;
    const sum = Number((u + s + p + c).toFixed(2));
    setEditUnitArea(String(sum));
  };

  const adjustAreaField = (
    field: "useful" | "storage" | "parking" | "common" | "total",
    delta: number
  ) => {
    if (field === "useful") {
      const next = Math.max(0, Number(((parseFloat(toEnglishDigits(editUsefulArea)) || 0) + delta).toFixed(2)));
      const nextStr = String(next);
      setEditUsefulArea(nextStr);
      recomputeTotalArea(nextStr, editStorageArea, editParkingArea, editCommonArea, editSaleAreaType);
    } else if (field === "storage") {
      const next = Math.max(0, Number(((parseFloat(toEnglishDigits(editStorageArea)) || 0) + delta).toFixed(2)));
      const nextStr = String(next);
      setEditStorageArea(nextStr);
      recomputeTotalArea(editUsefulArea, nextStr, editParkingArea, editCommonArea, editSaleAreaType);
    } else if (field === "parking") {
      const next = Math.max(0, Number(((parseFloat(toEnglishDigits(editParkingArea)) || 0) + delta).toFixed(2)));
      const nextStr = String(next);
      setEditParkingArea(nextStr);
      recomputeTotalArea(editUsefulArea, editStorageArea, nextStr, editCommonArea, editSaleAreaType);
    } else if (field === "common") {
      if (editSaleAreaType !== "with_commons") return;
      const next = Math.max(0, Number(((parseFloat(toEnglishDigits(editCommonArea)) || 0) + delta).toFixed(2)));
      const nextStr = String(next);
      setEditCommonArea(nextStr);
      recomputeTotalArea(editUsefulArea, editStorageArea, editParkingArea, nextStr, editSaleAreaType);
    } else if (field === "total") {
      // Adjusting total adjusts usefulArea by the same delta so breakdown stays consistent
      const nextUseful = Math.max(0, Number(((parseFloat(toEnglishDigits(editUsefulArea)) || 0) + delta).toFixed(2)));
      const nextUsefulStr = String(nextUseful);
      setEditUsefulArea(nextUsefulStr);
      recomputeTotalArea(nextUsefulStr, editStorageArea, editParkingArea, editCommonArea, editSaleAreaType);
    }
  };

  const projTransactions = transactions.filter(t => t.projectId === selectedProj?.id);
  const projExpenses = projTransactions
    .filter(t => t.type === "expense")
    .reduce((acc, curr) => acc + curr.amount, 0);

  const costPerSqm = selectedProj && selectedProj.totalArea > 0
    ? Math.round(projExpenses / selectedProj.totalArea)
    : 0;

  const projUnits = units.filter(u => u.projectId === selectedProj?.id && !u.isDeleted);
  const deletedProjUnits = units.filter(u => u.projectId === selectedProj?.id && u.isDeleted);

  // Create New Project (Only unit count is specified here)
  const handleCreateProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!projName || !saveProjectFn) return;

    saveProjectFn({
      companyId: activeCompanyId,
      name: projName,
      address: projAddress,
      totalArea: Number(toEnglishDigits(projArea)) || 1000,
      budget: Number(toEnglishDigits(projBudget)) || 0,
      supervisorName: projSupervisor || "مهندس میلاد فرخی",
      stages: ["تجهیز کارگاه", "گودبرداری", "فونداسیون", "اسکلت", "سفت‌کاری", "نازک‌کاری", "نما و تحویل"],
      currentStage: "تجهیز کارگاه",
      status: "active",
      numberOfUnits: Number(toEnglishDigits(projNumUnits)) || 0,
      defaultUnitArea: 0,
      defaultPricePerMeter: 0
    });

    setIsAddingProj(false);
    setProjName("");
    setProjAddress("");
    setProjArea("");
    setProjBudget("");
    setProjNumUnits("");
  };

  const handleSaveEditProj = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !editProjName || !editProjectFn) return;

    editProjectFn({
      ...selectedProj,
      name: editProjName,
      address: editProjAddress,
      totalArea: Number(toEnglishDigits(editProjArea)) || selectedProj.totalArea,
      budget: Number(toEnglishDigits(editProjBudget)) || 0,
      supervisorName: editProjSupervisor || "مهندس میلاد فرخی",
      currentStage: editProjStage || selectedProj.currentStage,
      numberOfUnits: Number(toEnglishDigits(editProjNumUnits)) || 0,
      defaultUnitArea: 0,
      defaultPricePerMeter: 0
    });

    setIsEditingProj(false);
  };

  const handleCreateSingleUnit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProj || !newUnitNum) return;

    const uArea = parseFloat(toEnglishDigits(newUnitUsefulArea)) || 0;
    const sArea = parseFloat(toEnglishDigits(newUnitStorageArea)) || 0;
    const pArea = parseFloat(toEnglishDigits(newUnitParkingArea)) || 0;
    const cArea = newUnitSaleAreaType === "with_commons" ? (parseFloat(toEnglishDigits(newUnitCommonArea)) || 0) : 0;
    const totalUnitArea = Number((uArea + sArea + pArea + cArea).toFixed(2));
    const price = Number(toEnglishDigits(newUnitPricePerMeter)) || 0;

    triggerUpdateUnit({
      id: "u_" + Date.now(),
      projectId: selectedProj.id,
      unitNumber: newUnitNum.trim(),
      blockName: newUnitBlock.trim(),
      floor: newUnitFloor || "1",
      saleAreaType: newUnitSaleAreaType,
      usefulArea: uArea,
      storageArea: sArea,
      parkingArea: pArea,
      commonArea: cArea,
      area: totalUnitArea,
      pricePerMeter: price,
      totalPrice: Math.round(totalUnitArea * price),
      status: "available",
      specificExpenses: []
    });

    setIsAddingSingleUnit(false);
    setNewUnitNum("");
    setNewUnitBlock("");
    setNewUnitFloor("");
    setNewUnitUsefulArea("");
    setNewUnitStorageArea("0");
    setNewUnitParkingArea("0");
    setNewUnitCommonArea("0");
    setNewUnitPricePerMeter("");
  };

  // Save Unit Specifications, Area Breakdown, and Allocation Info together
  const handleSaveUnitFullDetails = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !editUnitNumber) return;

    const uArea = parseFloat(toEnglishDigits(editUsefulArea)) || 0;
    const sArea = parseFloat(toEnglishDigits(editStorageArea)) || 0;
    const pArea = parseFloat(toEnglishDigits(editParkingArea)) || 0;
    const cArea = editSaleAreaType === "with_commons" ? (parseFloat(toEnglishDigits(editCommonArea)) || 0) : 0;
    const computedArea = Number((uArea + sArea + pArea + cArea).toFixed(2));
    const finalArea = computedArea > 0 ? computedArea : (parseFloat(toEnglishDigits(editUnitArea)) || 0);
    const newPricePerMeter = Number(toEnglishDigits(editUnitPricePerMeter)) || 0;

    const resolvedContact = contacts.find(c => c.id === selectedContactId);
    const finalBuyerName = saleStatus === "available"
      ? undefined
      : (buyerName.trim() || resolvedContact?.name || selectedUnit.buyerName);

    const updated: UnitItem = {
      ...selectedUnit,
      unitNumber: editUnitNumber.trim(),
      blockName: editUnitBlock.trim(),
      floor: editUnitFloor.trim() || "1",
      saleAreaType: editSaleAreaType,
      usefulArea: uArea,
      storageArea: sArea,
      parkingArea: pArea,
      commonArea: cArea,
      area: finalArea,
      pricePerMeter: newPricePerMeter,
      totalPrice: Math.round(finalArea * newPricePerMeter),
      status: saleStatus,
      contactId: saleStatus === "available" ? undefined : (selectedContactId || selectedUnit.contactId),
      buyerName: finalBuyerName,
      downPayment: saleStatus === "available" ? undefined : (Number(toEnglishDigits(downPayment)) || 0),
      barterProperty: saleStatus === "bartered" ? barterProperty : undefined
    };

    triggerUpdateUnit(updated);
    setSelectedUnit(updated);
    setUnitSavedToast("مشخصات واحد، متراژ تفکیکی و وضعیت واگذاری با موفقیت ذخیره شد.");
    setTimeout(() => setUnitSavedToast(null), 4000);
  };

  const handleSaveUnitExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUnit || !unitExpTitle || !unitExpAmount) return;

    const newExp = {
      id: "ue_" + Date.now(),
      title: unitExpTitle,
      amount: Number(toEnglishDigits(unitExpAmount)),
      date: new Date().toLocaleDateString("fa-IR")
    };

    const updated: UnitItem = {
      ...selectedUnit,
      specificExpenses: [...(selectedUnit.specificExpenses || []), newExp]
    };

    triggerUpdateUnit(updated);
    setSelectedUnit(updated);
    setUnitExpTitle("");
    setUnitExpAmount("");
  };

  // Resolve allocation details for a unit (from preSales, contacts barterUnits, or unit fields)
  const getUnitAllocationInfo = (unit: UnitItem) => {
    const preSale = preSales.find(ps => ps.unitId === unit.id && ps.status !== "canceled");
    const preSaleContact = preSale ? contacts.find(c => c.id === preSale.contactId) : undefined;

    const barterContact = contacts.find(
      c => c.barterUnits && c.barterUnits.some(bu => bu.unitId === unit.id)
    );
    const directContact = unit.contactId ? contacts.find(c => c.id === unit.contactId) : undefined;

    const assignedContact = preSaleContact || barterContact || directContact;
    const assignedName = assignedContact?.name || unit.buyerName || "";
    const isAllocated = unit.status !== "available" || Boolean(preSale) || Boolean(barterContact) || Boolean(assignedName);

    return {
      isAllocated,
      assignedName,
      assignedContact,
      preSale,
      barterContact
    };
  };

  return (
    <div className="space-y-6">
      {/* Header & Project Selector */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-150 shadow-sm">
        <div>
          <h2 className="text-lg font-extrabold text-slate-900">مهندسی فروش، بهای تمام شده و مدیریت واحدها</h2>
          <p className="text-slate-500 text-xs mt-1 font-light">
            در تعریف پروژه تعداد واحدها مشخص می‌شود؛ بلوک‌بندی، متراژ تفکیکی (مفید، انباری، پارکینگ، مشاعات) و قیمت در قرارداد یا با کلیک روی هر واحد قابل تنظیم است.
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto">
          <select
            value={selectedProj?.id || ""}
            onChange={e => {
              handleSelectProjId(e.target.value);
              setSelectedUnit(null);
            }}
            className="bg-slate-50 border border-slate-200 text-slate-800 text-xs rounded-xl px-3.5 py-2.5 font-bold focus:outline-none focus:border-teal-500"
          >
            {activeProjects.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>

          <button
            onClick={() => {
              setIsAddingProj(!isAddingProj);
              setIsEditingProj(false);
              setIsAddingSingleUnit(false);
            }}
            className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white px-4 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>پروژه جدید</span>
          </button>
        </div>
      </div>

      {/* Add New Project Drawer (Only Unit Count is specified here) */}
      {isAddingProj && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-teal-50/40 border border-teal-200 p-6 rounded-2xl space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-xs font-extrabold text-teal-900 flex items-center gap-1.5">
              <Building className="w-4 h-4 text-teal-600" />
              تعریف پروژه عمرانی جدید
            </h3>
            <span className="text-[11px] text-teal-800 bg-teal-100/70 px-3 py-1 rounded-lg font-semibold">
              💡 در این بخش فقط تعداد کل واحدها مشخص می‌شود؛ بلوک‌بندی، متراژ تفکیکی و قیمت در قرارداد یا ویرایش واحد تعیین می‌گردد
            </span>
          </div>

          <form onSubmit={handleCreateProject} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 text-xs">
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-600">نام پروژه ساختمانی *</label>
              <input
                type="text"
                placeholder="مثال: برج مسکونی افرا"
                value={projName}
                onChange={e => setProjName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500 font-bold"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-600">آدرس کارگاه</label>
              <input
                type="text"
                placeholder="مثال: تهران، سعادت‌آباد"
                value={projAddress}
                onChange={e => setProjAddress(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-600">زیربنای کل ناخالص (مترمربع)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="مثال: ۲۵۰۰"
                value={projArea}
                onChange={e => setProjArea(toEnglishDigits(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-slate-600">بودجه برآوردی کل (ریال)</label>
              <FormattedAmountInput
                value={projBudget}
                onChange={setProjBudget}
                placeholder="مثال: ۱۰۰,۰۰۰,۰۰۰,۰۰۰"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <div className="space-y-1">
              <label className="block text-[10px] font-bold text-teal-800">تعداد کل واحدهای پروژه *</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="مثال: ۱۲"
                value={projNumUnits}
                onChange={e => setProjNumUnits(toEnglishDigits(e.target.value).replace(/[^\d]/g, ""))}
                className="w-full bg-white border-2 border-teal-400 rounded-xl px-3.5 py-2 focus:outline-none focus:border-teal-600 font-mono font-black text-center text-teal-900"
                required
              />
            </div>

            <div className="sm:col-span-2 lg:col-span-5 flex flex-col sm:flex-row justify-between items-center gap-3 pt-2 border-t border-teal-200/60">
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <label className="text-[11px] font-bold text-slate-600 shrink-0">مدیر و ناظر ارشد:</label>
                <input
                  type="text"
                  placeholder="نام مهندس ناظر"
                  value={projSupervisor}
                  onChange={e => setProjSupervisor(e.target.value)}
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs focus:outline-none focus:border-teal-500 font-bold"
                />
              </div>
              <div className="flex gap-2 w-full sm:w-auto justify-end">
                <button
                  type="submit"
                  className="bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl px-6 py-2 transition-all cursor-pointer shadow-sm"
                >
                  ثبت پروژه و ایجاد {projNumUnits ? toFarsiDigits(projNumUnits) : ""} واحد خام
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddingProj(false)}
                  className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl px-4 py-2 transition-all cursor-pointer"
                >
                  انصراف
                </button>
              </div>
            </div>
          </form>
        </motion.div>
      )}

      {/* Edit Active Project Drawer (Only Unit Count is specified here) */}
      {isEditingProj && selectedProj && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-amber-50/50 border border-amber-200 p-6 rounded-2xl space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-extrabold text-amber-900 flex items-center gap-1.5">
              <Edit3 className="w-4 h-4 text-amber-600" />
              ویرایش اطلاعات کلی پروژه «{selectedProj.name}»
            </h3>
            <button onClick={() => setIsEditingProj(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">
              بستن ×
            </button>
          </div>
          <form onSubmit={handleSaveEditProj} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 block">نام پروژه</label>
              <input
                type="text"
                value={editProjName}
                onChange={e => setEditProjName(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500 font-bold text-slate-800"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 block">آدرس پروژه</label>
              <input
                type="text"
                value={editProjAddress}
                onChange={e => setEditProjAddress(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500 text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 block">زیربنای کل (مترمربع)</label>
              <input
                type="text"
                inputMode="decimal"
                value={editProjArea}
                onChange={e => setEditProjArea(toEnglishDigits(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500 font-mono text-slate-800"
                required
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 block">بودجه کل برآوردی (ریال)</label>
              <FormattedAmountInput
                value={editProjBudget}
                onChange={setEditProjBudget}
                placeholder="مثال: ۱۰۰,۰۰۰,۰۰۰,۰۰۰"
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500 font-mono text-slate-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 block">مهندس ناظر / مدیر پروژه</label>
              <input
                type="text"
                value={editProjSupervisor}
                onChange={e => setEditProjSupervisor(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500 font-bold text-teal-800"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-slate-500 block">گام و مرحله فعلی ساخت</label>
              <select
                value={editProjStage}
                onChange={e => setEditProjStage(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500 font-bold text-slate-800"
              >
                {selectedProj.stages.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] text-amber-800 font-bold block">تعداد کل واحدهای پروژه</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="مثال: ۱۰"
                value={editProjNumUnits}
                onChange={e => setEditProjNumUnits(toEnglishDigits(e.target.value).replace(/[^\d]/g, ""))}
                className="w-full bg-white border-2 border-amber-300 rounded-xl px-3.5 py-2 focus:outline-none focus:border-amber-500 font-mono font-bold text-slate-800"
              />
            </div>
            <div className="sm:col-span-2 flex items-end gap-2">
              <button type="submit" className="flex-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl py-2.5 transition-all cursor-pointer shadow-sm">
                ذخیره تغییرات پروژه
              </button>
              <button
                type="button"
                onClick={() => setIsEditingProj(false)}
                className="px-4 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
              >
                لغو
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {/* Add Single Unit Drawer */}
      {isAddingSingleUnit && selectedProj && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="bg-teal-50/40 border border-teal-200 p-6 rounded-2xl space-y-4"
        >
          <div className="flex justify-between items-center">
            <h3 className="text-xs font-extrabold text-teal-900">افزودن تک واحد جدید به «{selectedProj.name}»</h3>
            <button onClick={() => setIsAddingSingleUnit(false)} className="text-slate-400 hover:text-slate-600 text-xs font-bold cursor-pointer">
              بستن ×
            </button>
          </div>
          <form onSubmit={handleCreateSingleUnit} className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">شماره واحد *</label>
              <input
                type="text"
                placeholder="مثال: ۱۰۱"
                value={newUnitNum}
                onChange={e => setNewUnitNum(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-bold"
                required
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">نام بلوک (اختیاری)</label>
              <input
                type="text"
                placeholder="مثال: A یا شمالی"
                value={newUnitBlock}
                onChange={e => setNewUnitBlock(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-bold"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">طبقه</label>
              <input
                type="text"
                placeholder="مثال: ۱"
                value={newUnitFloor}
                onChange={e => setNewUnitFloor(toEnglishDigits(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">نوع محاسبه متراژ فروش</label>
              <select
                value={newUnitSaleAreaType}
                onChange={e => setNewUnitSaleAreaType(e.target.value as "useful" | "with_commons")}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-bold text-slate-800"
              >
                <option value="useful">فروش واحد مفید (بدون مشاعات)</option>
                <option value="with_commons">فروش واحد با مشاعات</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">متراژ مفید (مترمربع)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="مثال: ۱۱۰"
                value={newUnitUsefulArea}
                onChange={e => setNewUnitUsefulArea(toEnglishDigits(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">متراژ انباری (مترمربع)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="۰"
                value={newUnitStorageArea}
                onChange={e => setNewUnitStorageArea(toEnglishDigits(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">متراژ پارکینگ (مترمربع)</label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="۰"
                value={newUnitParkingArea}
                onChange={e => setNewUnitParkingArea(toEnglishDigits(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <div>
              <label className="block text-[10px] text-slate-500 mb-1">
                متراژ مشاعات {newUnitSaleAreaType === "useful" ? "(غیرفعال در فروش مفید)" : "(مترمربع)"}
              </label>
              <input
                type="text"
                inputMode="decimal"
                placeholder="۰"
                value={newUnitSaleAreaType === "with_commons" ? newUnitCommonArea : "0"}
                onChange={e => setNewUnitCommonArea(toEnglishDigits(e.target.value))}
                disabled={newUnitSaleAreaType === "useful"}
                className={`w-full border rounded-xl px-3 py-2 font-mono ${
                  newUnitSaleAreaType === "useful"
                    ? "bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed"
                    : "bg-white border-slate-200 focus:outline-none focus:border-teal-500"
                }`}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-[10px] text-slate-500 mb-1">قیمت پایه هر متر مربع (ریال)</label>
              <FormattedAmountInput
                value={newUnitPricePerMeter}
                onChange={setNewUnitPricePerMeter}
                placeholder="مثال: ۵۰,۰۰۰,۰۰۰ (یا در قرارداد تعیین شود)"
                className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 focus:outline-none focus:border-teal-500 font-mono"
              />
            </div>
            <div className="sm:col-span-2 flex items-end gap-2">
              <button type="submit" className="flex-1 bg-teal-600 hover:bg-teal-500 text-white font-bold rounded-xl py-2 transition-all cursor-pointer">
                افزودن واحد
              </button>
              <button
                type="button"
                onClick={() => setIsAddingSingleUnit(false)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded-xl transition-all cursor-pointer"
              >
                لغو
              </button>
            </div>
          </form>
        </motion.div>
      )}

      {selectedProj && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Bento Box 1: Project Details & Cost per Sqm Calculator */}
          <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-5">
            <div className="border-b border-slate-100 pb-3 flex justify-between items-start">
              <div>
                <span className="text-[10px] bg-teal-50 text-teal-600 px-2.5 py-0.5 rounded-full font-semibold">شناسنامه پروژه عمرانی</span>
                <h3 className="text-sm font-extrabold text-slate-800 mt-2.5 leading-tight">{selectedProj.name}</h3>
                <p className="text-slate-400 text-[11px] mt-1.5 font-light flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {selectedProj.address || "بدون آدرس ثبت‌شده"}
                </p>
                <div className="text-[10px] font-bold text-teal-700 bg-teal-50/50 border border-teal-100 rounded-lg px-2.5 py-1.5 mt-2.5 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  <span>مدیر و ناظر ارشد:</span>
                  <span className="font-extrabold text-teal-900">{(selectedProj as any).supervisorName || "مهندس میلاد فرخی"}</span>
                </div>
              </div>

              {/* Edit and Delete active project buttons */}
              <div className="flex flex-col items-end gap-2">
                <button
                  onClick={() => {
                    setIsEditingProj(!isEditingProj);
                    setIsAddingProj(false);
                    setIsAddingSingleUnit(false);
                  }}
                  className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl border border-slate-100 transition-colors cursor-pointer"
                  title="ویرایش اطلاعات کلی پروژه"
                >
                  <Edit3 className="w-4 h-4" />
                </button>

                {onDeleteProject && (
                  <div className="flex items-center gap-1">
                    {projDeleteConfirm > 0 && (
                      <button
                        type="button"
                        onClick={() => setProjDeleteConfirm(0)}
                        className="text-[9px] text-slate-400 hover:text-slate-600 cursor-pointer px-1 font-bold"
                      >
                        لغو
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        if (projDeleteConfirm === 0) {
                          setProjDeleteConfirm(1);
                        } else if (projDeleteConfirm === 1) {
                          setProjDeleteConfirm(2);
                        } else if (projDeleteConfirm === 2) {
                          onDeleteProject(selectedProj.id);
                          setProjDeleteConfirm(0);
                        }
                      }}
                      className={`p-1.5 border rounded-xl transition-all flex items-center gap-1 cursor-pointer text-[10px] font-bold ${
                        projDeleteConfirm === 1
                          ? "bg-amber-100 text-amber-800 border-amber-300 animate-pulse"
                          : projDeleteConfirm === 2
                          ? "bg-rose-100 text-rose-800 border-rose-300 animate-bounce"
                          : "text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-slate-105"
                      }`}
                      title="انتقال پروژه به سطل زباله (۳ مرحله تایید)"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      {projDeleteConfirm === 0 ? "" : projDeleteConfirm === 1 ? "حذف؟ (۱/۳)" : "تایید نهایی؟ (۲/۳)"}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Calculations widget */}
            <div className="space-y-4">
              <div className="p-4 bg-slate-50 rounded-xl space-y-3.5 border border-slate-100">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5 font-semibold">
                    <Coins className="w-4 h-4 text-teal-500" />
                    کل مخارج جاری ساخت:
                  </span>
                  <span className="font-extrabold text-slate-800 font-mono">{formatRials(projExpenses)}</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5 font-semibold">
                    <Building className="w-4 h-4 text-teal-500" />
                    زیربنای کل:
                  </span>
                  <span className="font-bold text-slate-800 font-mono">{toFarsiDigits(selectedProj.totalArea)} مترمربع</span>
                </div>
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 flex items-center gap-1.5 font-semibold">
                    <Layers className="w-4 h-4 text-indigo-500" />
                    تعداد کل واحدها:
                  </span>
                  <span className="font-bold text-indigo-700 font-mono">{toFarsiDigits(projUnits.length)} واحد</span>
                </div>

                <div className="border-t border-slate-200/60 pt-3 flex justify-between items-center text-xs">
                  <span className="text-slate-600 font-bold flex items-center gap-1.5">
                    <Calculator className="w-4 h-4 text-amber-500" />
                    هزینه تمام شده هر مترمربع:
                  </span>
                  <span className="font-black text-amber-600 text-xs font-mono">
                    {formatRials(costPerSqm)}
                  </span>
                </div>
              </div>

              {/* Construction Stages Track */}
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-slate-800">مراحل و گام‌های فیزیکی ساخت:</h4>
                <div className="space-y-1.5 bg-slate-50/50 p-3 rounded-xl border border-slate-100/70">
                  {selectedProj.stages.map((stg, i) => {
                    const isPassed = selectedProj.stages.indexOf(selectedProj.currentStage) >= i;
                    const isActive = selectedProj.currentStage === stg;

                    return (
                      <div key={stg} className="flex items-center gap-2 text-xs">
                        <span
                          className={`w-2 h-2 rounded-full ${
                            isActive ? "bg-amber-500 animate-pulse" : isPassed ? "bg-teal-500" : "bg-slate-200"
                          }`}
                        />
                        <span
                          className={`${
                            isActive ? "text-amber-600 font-bold" : isPassed ? "text-teal-600" : "text-slate-400 font-light"
                          }`}
                        >
                          {stg} {isActive && "(گام فعلی)"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Trash Bin Section */}
              <div className="bg-slate-100/80 p-4 rounded-2xl border border-slate-200 shadow-xs space-y-3 mt-4">
                <div
                  className="flex justify-between items-center cursor-pointer select-none"
                  onClick={() => setIsTrashOpen(!isTrashOpen)}
                >
                  <h4 className="text-xs font-extrabold text-slate-700 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-slate-500" />
                    سطل زباله و بازگردانی اسناد ({toFarsiDigits(deletedProjects.length + deletedProjUnits.length)})
                  </h4>
                  <span className="text-slate-400 text-[10px]">{isTrashOpen ? "▲" : "▼"}</span>
                </div>

                {isTrashOpen && (
                  <div className="space-y-4 pt-2 border-t border-slate-200/60 animate-fade-in text-xs">
                    <div>
                      <h5 className="font-extrabold text-slate-600 mb-1.5 text-[11px] flex items-center gap-1">📁 پروژه‌های حذف‌شده:</h5>
                      {deletedProjects.length === 0 ? (
                        <p className="text-slate-400 text-[10px] italic">هیچ پروژه‌ای حذف نشده است.</p>
                      ) : (
                        <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-150">
                          {deletedProjects.map(p => (
                            <div key={p.id} className="flex justify-between items-center py-1">
                              <span className="font-bold text-slate-700">{p.name}</span>
                              <button
                                type="button"
                                onClick={() => onRestoreProject && onRestoreProject(p.id)}
                                className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer border border-teal-150"
                              >
                                بازگردانی
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div>
                      <h5 className="font-extrabold text-slate-600 mb-1.5 text-[11px] flex items-center gap-1">🏢 واحدهای حذف‌شده این پروژه:</h5>
                      {deletedProjUnits.length === 0 ? (
                        <p className="text-slate-400 text-[10px] italic">هیچ واحدی از این پروژه حذف نشده است.</p>
                      ) : (
                        <div className="space-y-1 bg-white p-2 rounded-xl border border-slate-150">
                          {deletedProjUnits.map(u => (
                            <div key={u.id} className="flex justify-between items-center py-1">
                              <div>
                                <span className="font-bold text-slate-700">واحد {toFarsiDigits(u.unitNumber)}</span>
                                <span className="text-[10px] text-slate-400 mr-1.5">(طبقه {toFarsiDigits(u.floor)})</span>
                              </div>
                              <button
                                type="button"
                                onClick={() => onRestoreUnit && onRestoreUnit(u.id)}
                                className="px-2 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-[10px] font-bold transition-all cursor-pointer border border-teal-150"
                              >
                                بازگردانی
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Bento Box 2 & 3: Units Grid & Interactive Unit Inspector/Editor */}
          <div className="lg:col-span-2 space-y-6">
            {/* Sales Grid */}
            <div className="bg-white p-6 rounded-2xl border border-slate-150 shadow-sm space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h3 className="text-xs font-extrabold text-slate-800 flex items-center gap-1.5">
                    🏢 لیست واحدهای پروژه (روی هر واحد کلیک کنید تا مشخصات، متراژ و طرف قرارداد باز و ویرایش شود)
                  </h3>
                </div>

                <div className="flex gap-1.5">
                  <button
                    onClick={() => {
                      setIsAddingSingleUnit(!isAddingSingleUnit);
                      setIsAddingProj(false);
                      setIsEditingProj(false);
                    }}
                    className="px-3 py-1.5 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg text-[10px] font-bold border border-teal-200 transition-colors cursor-pointer"
                  >
                    ➕ افزودن تک واحد
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {projUnits.length === 0 ? (
                  <div className="col-span-full text-center py-8 bg-slate-50 border border-dashed rounded-xl text-slate-400 text-xs font-light">
                    هیچ واحدی برای این پروژه تعریف نشده است. می‌توانید از طریق «ویرایش پروژه» تعداد واحدها را وارد کنید یا «افزودن تک واحد» را بزنید.
                  </div>
                ) : (
                  projUnits.map(unit => {
                    const alloc = getUnitAllocationInfo(unit);

                    let colorClasses = "border-slate-200 hover:border-teal-400 bg-white text-slate-700";
                    let badgeText = "آزاد / آماده واگذاری";
                    let badgeClass = "bg-slate-100 text-slate-600";

                    if (unit.status === "sold") {
                      colorClasses = "border-emerald-200 bg-emerald-50/20 hover:border-emerald-400 text-emerald-900";
                      badgeText = "فروخته شده";
                      badgeClass = "bg-emerald-100 text-emerald-700";
                    } else if (unit.status === "pre_sold" || alloc.preSale) {
                      colorClasses = "border-sky-200 bg-sky-50/20 hover:border-sky-400 text-sky-900";
                      badgeText = "پیش‌فروش شده";
                      badgeClass = "bg-sky-100 text-sky-700";
                    } else if (unit.status === "bartered" || alloc.barterContact) {
                      colorClasses = "border-amber-200 bg-amber-50/20 hover:border-amber-400 text-amber-900";
                      badgeText = "واگذار شده (تهاتر)";
                      badgeClass = "bg-amber-100 text-amber-700";
                    }

                    return (
                      <div
                        key={unit.id}
                        onClick={() => setSelectedUnit(unit)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2.5 shadow-2xs hover:shadow-md ${
                          selectedUnit?.id === unit.id ? "ring-2 ring-teal-600 bg-teal-50/20 shadow-md" : ""
                        } ${colorClasses}`}
                      >
                        <div className="flex justify-between items-start gap-1">
                          <div>
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-black text-slate-900">
                                واحد {toFarsiDigits(unit.unitNumber)}
                              </span>
                              {unit.blockName && (
                                <span className="text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded font-bold">
                                  بلوک {unit.blockName}
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-slate-500 font-medium mt-1">
                              طبقه {unit.floor === "0" ? "همکف" : toFarsiDigits(unit.floor)} |{" "}
                              {unit.area > 0 ? `${toFarsiDigits(unit.area)} متر` : "متراژ در انتظار قرارداد"}
                            </p>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold shrink-0 ${badgeClass}`}>
                            {badgeText}
                          </span>
                        </div>

                        {/* Allocation preview on unit card */}
                        {alloc.isAllocated && alloc.assignedName ? (
                          <div className="bg-white/90 border border-slate-200/80 rounded-lg px-2.5 py-1.5 flex items-center gap-1.5 text-[10px]">
                            <UserCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                            <span className="text-slate-500">اختصاص به:</span>
                            <span className="font-extrabold text-slate-900 truncate">{alloc.assignedName}</span>
                          </div>
                        ) : (
                          <div className="text-[10px] text-slate-400 italic py-1">
                            بدون اختصاص (آزاد) — کلیک برای ویرایش
                          </div>
                        )}

                        <div className="border-t border-slate-100 pt-2 flex justify-between items-center text-[10px]">
                          <span className="text-slate-400">
                            {unit.saleAreaType === "with_commons" ? "با مشاعات" : "فروش مفید"}
                          </span>
                          <span className="font-bold text-teal-700">مشاهده و ویرایش ⬅</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Active Selected Unit Detail & Editable Panel */}
            {selectedUnit && (() => {
              const alloc = getUnitAllocationInfo(selectedUnit);
              const computedPreviewTotalPrice = Math.round(
                (parseFloat(toEnglishDigits(editUnitArea)) || 0) *
                (Number(toEnglishDigits(editUnitPricePerMeter)) || 0)
              );

              return (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white p-6 rounded-2xl border-2 border-teal-500/40 shadow-lg space-y-6"
                >
                  {/* Top Bar */}
                  <div className="flex flex-wrap justify-between items-center gap-3 border-b border-slate-100 pb-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-3 h-3 rounded-full bg-teal-500 animate-pulse" />
                      <h4 className="font-black text-slate-900 text-sm">
                        شناسنامه و ویرایش مشخصات واحد {toFarsiDigits(selectedUnit.unitNumber)}
                        {selectedUnit.blockName ? ` (بلوک ${selectedUnit.blockName})` : ""}
                      </h4>
                      <span className="text-xs bg-teal-50 text-teal-800 border border-teal-200 px-2.5 py-0.5 rounded-lg font-bold">
                        متراژ کل: {toFarsiDigits(editUnitArea)} مترمربع
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {onDeleteUnit && (
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => {
                              if (unitDeleteConfirm === 0) {
                                setUnitDeleteConfirm(1);
                              } else if (unitDeleteConfirm === 1) {
                                onDeleteUnit(selectedUnit.id);
                                setSelectedUnit(null);
                                setUnitDeleteConfirm(0);
                              }
                            }}
                            className={`px-2.5 py-1.5 rounded-xl text-[10px] font-bold transition-all flex items-center gap-1 cursor-pointer border ${
                              unitDeleteConfirm === 1
                                ? "bg-amber-100 hover:bg-amber-200 text-amber-800 border-amber-300 animate-pulse"
                                : "bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200"
                            }`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {unitDeleteConfirm === 0 ? "حذف واحد" : "تایید حذف (۲/۲)"}
                          </button>
                          {unitDeleteConfirm > 0 && (
                            <button
                              type="button"
                              onClick={() => setUnitDeleteConfirm(0)}
                              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-bold"
                            >
                              انصراف
                            </button>
                          )}
                        </div>
                      )}
                      <button
                        onClick={() => setSelectedUnit(null)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold cursor-pointer"
                      >
                        بستن ×
                      </button>
                    </div>
                  </div>

                  {unitSavedToast && (
                    <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-bold flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span>{unitSavedToast}</span>
                    </div>
                  )}

                  {/* Allocation Status Banner (نمایش وضعیت اختصاص واحد به خریدار / پیمانکار) */}
                  <div className={`p-4 rounded-2xl border ${
                    alloc.isAllocated
                      ? "bg-teal-50/50 border-teal-200"
                      : "bg-slate-50 border-slate-200"
                  }`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <UserCheck className={`w-5 h-5 ${alloc.isAllocated ? "text-teal-600" : "text-slate-400"}`} />
                        <div>
                          <span className="text-xs font-black text-slate-800 block">
                            {alloc.isAllocated
                              ? `این واحد اختصاص داده شده است به: ${alloc.assignedName || "طرف قرارداد"}`
                              : "این واحد در حال حاضر آزاد است و به کسی اختصاص داده نشده است"}
                          </span>
                          {alloc.assignedContact && (
                            <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 mt-1">
                              {alloc.assignedContact.phone && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 text-teal-600" />
                                  شماره تماس: <strong className="font-mono">{alloc.assignedContact.phone}</strong>
                                </span>
                              )}
                              {alloc.assignedContact.nationalId && (
                                <span>کد ملی: <strong className="font-mono">{alloc.assignedContact.nationalId}</strong></span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {alloc.preSale && (
                        <div className="bg-white px-3 py-2 rounded-xl border border-teal-200 text-[11px] space-y-0.5">
                          <div className="flex items-center gap-1 font-bold text-teal-800">
                            <FileText className="w-3.5 h-3.5" />
                            <span>قرارداد پیش‌فروش فعال ({alloc.preSale.contractDate})</span>
                          </div>
                          <div className="text-slate-600">
                            مبلغ کل قرارداد: <strong className="font-mono text-slate-900">{formatRials(alloc.preSale.totalPrice)}</strong>
                          </div>
                        </div>
                      )}
                      {alloc.barterContact && !alloc.preSale && (
                        <div className="bg-amber-100/70 px-3 py-2 rounded-xl border border-amber-300 text-[11px] font-bold text-amber-900">
                          واگذار شده در قالب تهاتر به «{alloc.barterContact.name}»
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Main Unified Editable Form for Unit Specs, Area Breakdown (+/-), Price, and Allocation */}
                  <form onSubmit={handleSaveUnitFullDetails} className="space-y-6 text-xs">
                    {/* Section 1: Basic Physical & Block Info + Sale Area Mode */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">شماره واحد *</label>
                        <input
                          type="text"
                          value={editUnitNumber}
                          onChange={e => setEditUnitNumber(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-900 font-bold"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">نام بلوک</label>
                        <input
                          type="text"
                          placeholder="مثال: بلوک A"
                          value={editUnitBlock}
                          onChange={e => setEditUnitBlock(e.target.value)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-900 font-bold"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-slate-600 block mb-1">طبقه</label>
                        <input
                          type="text"
                          value={editUnitFloor}
                          onChange={e => setEditUnitFloor(toEnglishDigits(e.target.value))}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-900 font-bold font-mono"
                          required
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-bold text-indigo-700 block mb-1">نوع محاسبه متراژ در قرارداد *</label>
                        <select
                          value={editSaleAreaType}
                          onChange={e => {
                            const nextType = e.target.value as "useful" | "with_commons";
                            setEditSaleAreaType(nextType);
                            if (nextType === "useful") {
                              setEditCommonArea("0");
                              recomputeTotalArea(editUsefulArea, editStorageArea, editParkingArea, "0", nextType);
                            } else {
                              recomputeTotalArea(editUsefulArea, editStorageArea, editParkingArea, editCommonArea, nextType);
                            }
                          }}
                          className="w-full px-3 py-2 bg-white border-2 border-indigo-200 rounded-xl outline-none text-indigo-900 font-bold"
                        >
                          <option value="useful">فروش واحد مفید (مشاعات غیرفعال)</option>
                          <option value="with_commons">فروش واحد با مشاعات (مشاعات فعال)</option>
                        </select>
                      </div>
                    </div>

                    {/* Section 2: Area Breakdown with +/- Controls */}
                    <div className="bg-indigo-50/30 p-4 rounded-2xl border border-indigo-100 space-y-4">
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                        <h5 className="font-extrabold text-indigo-950 flex items-center gap-1.5 text-xs">
                          <Layers className="w-4 h-4 text-indigo-600" />
                          ریزمتره و تفکیک متراژ واحد (با قابلیت کم و زیاد کردن متراژ)
                        </h5>
                        <span className="text-[10px] text-indigo-700 font-semibold">
                          {editSaleAreaType === "useful"
                            ? "🔒 قرارداد فروش بر اساس «متراژ مفید» است؛ بخش متراژ مشاعات غیرفعال می‌باشد."
                            : "🔓 قرارداد فروش «با مشاعات» است؛ متراژ مشاعات فعال بوده و در متراژ کل لحاظ می‌شود."}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                        {/* Useful Area */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-700 block">۱. متراژ مفید واحد (مترمربع)</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustAreaField("useful", -1)}
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold cursor-pointer border border-rose-200"
                              title="کاهش ۱ متر"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editUsefulArea}
                              onChange={e => {
                                const val = toEnglishDigits(e.target.value);
                                setEditUsefulArea(val);
                                recomputeTotalArea(val, editStorageArea, editParkingArea, editCommonArea, editSaleAreaType);
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-black text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => adjustAreaField("useful", 1)}
                              className="p-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg font-bold cursor-pointer border border-teal-200"
                              title="افزایش ۱ متر"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Storage Area */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-700 block">۲. متراژ انباری (مترمربع)</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustAreaField("storage", -1)}
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold cursor-pointer border border-rose-200"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editStorageArea}
                              onChange={e => {
                                const val = toEnglishDigits(e.target.value);
                                setEditStorageArea(val);
                                recomputeTotalArea(editUsefulArea, val, editParkingArea, editCommonArea, editSaleAreaType);
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-black text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => adjustAreaField("storage", 1)}
                              className="p-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg font-bold cursor-pointer border border-teal-200"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Parking Area */}
                        <div className="bg-white p-3 rounded-xl border border-slate-200 space-y-1.5">
                          <label className="text-[10px] font-bold text-slate-700 block">۳. متراژ پارکینگ (مترمربع)</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustAreaField("parking", -1)}
                              className="p-2 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded-lg font-bold cursor-pointer border border-rose-200"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editParkingArea}
                              onChange={e => {
                                const val = toEnglishDigits(e.target.value);
                                setEditParkingArea(val);
                                recomputeTotalArea(editUsefulArea, editStorageArea, val, editCommonArea, editSaleAreaType);
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-black text-slate-900"
                            />
                            <button
                              type="button"
                              onClick={() => adjustAreaField("parking", 1)}
                              className="p-2 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-lg font-bold cursor-pointer border border-teal-200"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Common Area (Disabled when saleAreaType === 'useful') */}
                        <div className={`p-3 rounded-xl border space-y-1.5 ${
                          editSaleAreaType === "useful"
                            ? "bg-slate-100 border-slate-200 opacity-60"
                            : "bg-white border-indigo-300"
                        }`}>
                          <label className="text-[10px] font-bold text-slate-700 block">
                            ۴. متراژ مشاعات {editSaleAreaType === "useful" ? "(غیرفعال)" : "(مترمربع)"}
                          </label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={editSaleAreaType === "useful"}
                              onClick={() => adjustAreaField("common", -1)}
                              className="p-2 bg-rose-50 hover:bg-rose-100 disabled:bg-slate-200 text-rose-700 disabled:text-slate-400 rounded-lg font-bold cursor-pointer disabled:cursor-not-allowed border border-rose-200"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              disabled={editSaleAreaType === "useful"}
                              value={editSaleAreaType === "with_commons" ? editCommonArea : "0"}
                              onChange={e => {
                                const val = toEnglishDigits(e.target.value);
                                setEditCommonArea(val);
                                recomputeTotalArea(editUsefulArea, editStorageArea, editParkingArea, val, editSaleAreaType);
                              }}
                              className="w-full px-2 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-center font-mono font-black text-slate-900 disabled:cursor-not-allowed"
                            />
                            <button
                              type="button"
                              disabled={editSaleAreaType === "useful"}
                              onClick={() => adjustAreaField("common", 1)}
                              className="p-2 bg-teal-50 hover:bg-teal-100 disabled:bg-slate-200 text-teal-700 disabled:text-slate-400 rounded-lg font-bold cursor-pointer disabled:cursor-not-allowed border border-teal-200"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Total Computable Area */}
                        <div className="bg-teal-900 text-white p-3 rounded-xl space-y-1.5 flex flex-col justify-between">
                          <label className="text-[10px] font-bold text-teal-200 block">جمع متراژ نهایی واحد (مترمربع)</label>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => adjustAreaField("total", -1)}
                              className="p-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer"
                              title="کاهش ۱ متر از متراژ واحد"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={editUnitArea}
                              onChange={e => setEditUnitArea(toEnglishDigits(e.target.value))}
                              className="w-full px-2 py-1.5 bg-teal-950 border border-teal-700 rounded-lg text-center font-mono font-black text-amber-300 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => adjustAreaField("total", 1)}
                              className="p-2 bg-teal-800 hover:bg-teal-700 text-white rounded-lg font-bold cursor-pointer"
                              title="افزایش ۱ متر به متراژ واحد"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Section 3: Pricing & Assignment/Allocation Edit */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 block">قیمت هر متر مربع در قرارداد (ریال)</label>
                        <FormattedAmountInput
                          value={editUnitPricePerMeter}
                          onChange={setEditUnitPricePerMeter}
                          placeholder="مثال: ۶۵,۰۰۰,۰۰۰"
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-900 font-mono text-center font-bold"
                        />
                        <div className="text-[10px] text-teal-700 font-bold pt-1">
                          ارزش کل واحد: <span className="font-mono">{formatRials(computedPreviewTotalPrice)}</span>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 block">وضعیت واگذاری واحد</label>
                        <select
                          value={saleStatus}
                          onChange={e => setSaleStatus(e.target.value as any)}
                          className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-800"
                        >
                          <option value="available">آزاد و آماده واگذاری</option>
                          <option value="pre_sold">پیش‌فروش شده</option>
                          <option value="sold">فروخته شده قطعی</option>
                          <option value="bartered">واگذار شده بابت تهاتر با مصالح/خدمات</option>
                        </select>
                      </div>

                      {saleStatus !== "available" && (
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-600 block">اختصاص به شخص / طرف حساب</label>
                          <select
                            value={selectedContactId}
                            onChange={e => {
                              const cid = e.target.value;
                              setSelectedContactId(cid);
                              const c = contacts.find(ct => ct.id === cid);
                              if (c) setBuyerName(c.name);
                            }}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none font-bold text-slate-800 mb-1.5"
                          >
                            <option value="">-- انتخاب از لیست طرف حساب‌ها یا تایپ دستی زیر --</option>
                            {contacts.map(c => (
                              <option key={c.id} value={c.id}>{c.name} ({c.phone || "بدون تلفن"})</option>
                            ))}
                          </select>
                          <input
                            type="text"
                            placeholder="نام خریدار یا طرف قرارداد..."
                            value={buyerName}
                            onChange={e => setBuyerName(e.target.value)}
                            className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl outline-none text-slate-900 font-bold"
                          />
                        </div>
                      )}
                    </div>

                    {saleStatus === "bartered" && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-600 block">شرح مصالح یا خدمات تهاتر شده با این واحد</label>
                        <input
                          type="text"
                          placeholder="مثال: تهاتر با اسکلت فلزی یا تاسیسات مکانیکی..."
                          value={barterProperty}
                          onChange={e => setBarterProperty(e.target.value)}
                          className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none text-slate-900"
                        />
                      </div>
                    )}

                    <div className="flex justify-end">
                      <button
                        type="submit"
                        className="w-full sm:w-auto px-8 py-3 bg-teal-600 hover:bg-teal-500 text-white rounded-xl font-black transition-all cursor-pointer text-xs shadow-md"
                      >
                        ذخیره مشخصات، متراژ تفکیکی و وضعیت اختصاص واحد
                      </button>
                    </div>
                  </form>

                  {/* Specific Unit Expenses Section */}
                  <div className="space-y-3 border-t border-slate-150 pt-4 text-xs">
                    <h5 className="font-extrabold text-slate-700 flex items-center gap-1">
                      <Calculator className="w-4 h-4 text-amber-500" />
                      مخارج و نصبیات اختصاصی این واحد (کابینت، پکیج، شیرآلات و...)
                    </h5>

                    <div className="space-y-2 max-h-[120px] overflow-y-auto pr-1">
                      {(selectedUnit.specificExpenses || []).length === 0 ? (
                        <p className="text-slate-400 font-light italic py-2">هیچ هزینه اختصاصی مازادی برای این واحد ثبت نشده است.</p>
                      ) : (
                        selectedUnit.specificExpenses.map(exp => (
                          <div key={exp.id} className="p-2.5 bg-rose-50/40 border border-rose-100 rounded-lg flex justify-between items-center text-[10px]">
                            <span className="text-slate-700 font-bold">{exp.title}</span>
                            <span className="text-rose-600 font-black font-mono">{formatRials(exp.amount)}</span>
                          </div>
                        ))
                      )}
                    </div>

                    <form onSubmit={handleSaveUnitExpense} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        type="text"
                        placeholder="عنوان هزینه اختصاصی (کابینت، پارکت...)"
                        value={unitExpTitle}
                        onChange={e => setUnitExpTitle(e.target.value)}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                        required
                      />
                      <FormattedAmountInput
                        value={unitExpAmount}
                        onChange={setUnitExpAmount}
                        placeholder="مبلغ هزینه (ریال)"
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl outline-none font-mono"
                        required
                      />
                      <button
                        type="submit"
                        className="py-2 bg-amber-500 hover:bg-amber-600 text-white rounded-xl font-bold transition-colors cursor-pointer text-xs"
                      >
                        + ثبت هزینه اختصاصی واحد
                      </button>
                    </form>
                  </div>
                </motion.div>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}

export default ProjectsManager;

